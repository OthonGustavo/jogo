import * as THREE from '../../vendor/three.module.min.js';
import { S } from '../state.js';
import { TAU, clamp, lerp, wrap, lerpAngle, yawTo, dist2d, rand } from '../utils.js';
import { sfx } from '../core/audio.js';
import { keys } from '../core/input.js';
import { resolveWalls, onGround } from '../world/level.js';
import { burst } from '../fx/particles.js';
import { buildHumanoid } from './humanoid.js';
import { buildCharacter } from './character.js';
import { scene } from '../core/renderer.js';
import { enemies, boss } from './enemy.js';
import { hurtEnemy, killPlayer } from '../combat.js';
import { showArea } from '../ui/hud.js';

// ---------- jogador ----------
const player = {
  pos: new THREE.Vector3(0, 0, -68), yaw: 0, vy: 0,
  stats: { vig: 10, end: 10, str: 10 },
  hp: 0, st: 0, hpLag: 0, estus: 4, estusMax: 4, souls: 0,
  state: 'idle', t: 0, data: {}, stDelay: 0, moving: 0, walkPhase: 0,
  blocking: false, lastSafe: new THREE.Vector3(0, 0, -68), deaths: 0, kills: 0,
};
const maxHp = () => 200 + player.stats.vig * 15;
const maxSt = () => 60 + player.stats.end * 4;
const level = () => player.stats.vig + player.stats.end + player.stats.str - 29;
const levelCost = () => Math.round(150 * Math.pow(1.12, level() - 1));
const baseDmg = () => 14 + player.stats.str * 2.4;
player.hp = player.hpLag = maxHp(); player.st = maxSt();
player.model = buildHumanoid({ armor: 0x6e675c, cloth: 0x4a3a2a, shield: true, weapon: 'sword' });
// Troca o humanoide de primitivas pelo cavaleiro glTF (se o asset carregou). Chamado por main.js.
function upgradePlayerModel() {
  const m = buildCharacter('player', { height: 1.8 });
  if (!m) return false;
  scene.remove(player.model.root);
  player.model = m;
  return true;
}
function setPlayerState(s, data) { player.state = s; player.t = 0; player.data = { ...data, knock: player.data?.knock }; }
const PLAYER_ATTACKS = {
  light: { dur: 0.62, hitStart: 0.2, hitEnd: 0.34, cost: 18, mult: 1, range: 2.4, arc: 1.1, lunge: 2.5, combo: 0.42 },
  heavy: { dur: 1.05, hitStart: 0.48, hitEnd: 0.62, cost: 32, mult: 1.9, range: 2.7, arc: 1.0, lunge: 4, combo: 0.85 },
};

function updatePlayer(dt) {
  const p = player, st = p.state;
  p.t += dt;
  S.bufferedT -= dt; if (S.bufferedT <= 0) S.buffered = null;

  // entrada de movimento relativa à câmera
  let ix = 0, iz = 0;
  if (keys.KeyW) iz += 1; if (keys.KeyS) iz -= 1; if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1;
  const fw = new THREE.Vector3(Math.sin(S.camYaw), 0, Math.cos(S.camYaw));
  const rt = new THREE.Vector3(-Math.cos(S.camYaw), 0, Math.sin(S.camYaw));
  const move = fw.multiplyScalar(iz).add(rt.multiplyScalar(ix));
  if (move.lengthSq() > 0) move.normalize();
  const moving = move.lengthSq() > 0;

  if (p.data.knock) {
    p.pos.addScaledVector(p.data.knock, dt);
    p.data.knock.multiplyScalar(Math.pow(0.002, dt));
    if (p.data.knock.lengthSq() < 0.01) p.data.knock = null;
  }

  p.blocking = false;
  let sprinting = false;
  if (st === 'idle') {
    const canAct = a => {
      if (a === 'drink') return p.estus > 0;
      return p.st > 0;
    };
    if (S.buffered && canAct(S.buffered)) {
      const a = S.buffered; S.buffered = null;
      if (a === 'roll') {
        const dir = moving ? move.clone() : new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
        p.st -= 20; p.stDelay = 0.6; sfx.roll();
        if (moving) p.yaw = Math.atan2(dir.x, dir.z);
        setPlayerState('roll', { dir, back: !moving });
      } else if (a === 'drink') {
        setPlayerState('drink', { healed: false });
      } else {
        const atk = PLAYER_ATTACKS[a];
        p.st -= atk.cost; p.stDelay = 0.7;
        if (S.lockTarget) p.yaw = yawTo(p.pos, S.lockTarget.pos); else if (moving) p.yaw = Math.atan2(move.x, move.z);
        (a === 'heavy' ? sfx.heavy : sfx.swing)();
        setPlayerState('attack', { kind: a, atk, hit: new Set(), sound: false });
      }
    } else {
      p.blocking = S.rmb && p.st > 0;
      sprinting = (keys.ShiftLeft || keys.ShiftRight) && moving && p.st > 0 && !p.blocking;
      const speed = p.blocking ? 1.8 : sprinting ? 6.2 : 3.8;
      if (moving) p.pos.addScaledVector(move, speed * dt);
      if (sprinting) { p.st -= 14 * dt; p.stDelay = 0.4; }
      let desired = p.yaw;
      if (S.lockTarget && !sprinting) desired = yawTo(p.pos, S.lockTarget.pos);
      else if (moving) desired = Math.atan2(move.x, move.z);
      p.yaw = lerpAngle(p.yaw, desired, Math.min(1, 14 * dt));
      p.moving = moving ? (sprinting ? 1.6 : p.blocking ? 0.5 : 1) : 0;
    }
  } else if (st === 'attack') {
    const { atk } = p.data;
    if (p.t < atk.hitStart) p.pos.add(new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(atk.lunge * dt));
    if (p.t >= atk.hitStart && p.t <= atk.hitEnd) {
      for (const e of enemies) {
        if (p.state !== 'attack') break; // ricocheteou no escudo
        if (!e.alive || p.data.hit.has(e)) continue;
        const d = dist2d(e.pos, p.pos) - e.cfg.r;
        if (d > atk.range) continue;
        if (Math.abs(wrap(yawTo(p.pos, e.pos) - p.yaw)) > atk.arc) continue;
        p.data.hit.add(e);
        hurtEnemy(e, baseDmg() * atk.mult * rand(0.9, 1.1), p.data.kind === 'heavy');
        S.hitStop = 0.06;
      }
    }
    if (p.state !== 'attack') { /* interrompido */ }
    else if (p.t > atk.combo && S.buffered && (S.buffered === 'light' || S.buffered === 'heavy' || S.buffered === 'roll') && p.st > 0) { p.state = 'idle'; }
    else if (p.t >= atk.dur) setPlayerState('idle', {});
    p.moving = 0;
  } else if (st === 'roll') {
    const k = p.data.back ? 0.5 : 1;
    const dur = p.data.back ? 0.4 : 0.62;
    const sp = (p.t < dur * 0.7 ? 7.5 : 3) * k;
    p.pos.addScaledVector(p.data.dir, sp * dt);
    if (p.t >= dur) setPlayerState('idle', {});
    p.moving = 0;
  } else if (st === 'drink') {
    if (moving) p.pos.addScaledVector(move, 1.2 * dt);
    if (!p.data.healed && p.t > 0.65) {
      p.data.healed = true; p.estus--;
      p.hp = Math.min(maxHp(), p.hp + maxHp() * 0.45);
      p.hpLag = Math.max(p.hpLag, p.hp);
      sfx.drink(); burst(p.pos.clone().setY(1.5), 0xffb040, 14, 2);
    }
    if (p.t >= 1.2) setPlayerState('idle', {});
    p.moving = moving ? 0.4 : 0;
  } else if (st === 'stagger') {
    if (p.t >= p.data.dur) setPlayerState('idle', {});
    p.moving = 0;
  } else if (st === 'fog') {
    p.pos.x = lerp(p.pos.x, 0, dt * 4);
    p.pos.z += 2.2 * dt;
    p.moving = 0.6;
    if (p.pos.z > 75) {
      setPlayerState('idle', {});
      boss.active = true; boss.aggro = true; sfx.roar(); S.shake = 0.6;
      showArea('Arena do Demônio');
    }
  } else if (st === 'falling') {
    p.vy -= 25 * dt; p.pos.y += p.vy * dt;
    if (p.pos.y < -14) killPlayer();
  }

  // estamina
  p.stDelay -= dt;
  if (p.stDelay <= 0 && st !== 'attack' && st !== 'roll' && !sprinting) p.st = Math.min(maxSt(), p.st + (p.blocking ? 14 : 42) * dt);

  if (st !== 'falling' && st !== 'dead' && st !== 'fog') {
    resolveWalls(p.pos, 0.42);
    if (!onGround(p.pos.x, p.pos.z)) { setPlayerState('falling', {}); p.vy = 0; S.lockTarget = null; }
    else p.lastSafe.copy(p.pos);
  }
  // áreas
  if (st !== 'dead') {
    if (p.pos.z < 0) showArea('Asilo dos Mortos-Vivos');
    else if (p.pos.z < 40) showArea('Ponte do Abismo');
    else if (p.pos.z < 72) showArea('Praça dos Esquecidos');
  }
  animatePlayer(dt);
}

// Escolhe o clip pelo estado; a duração dos clips é ajustada às janelas de dano atuais (só apresentação).
function animateRigged(p, m, dt) {
  const a = m.anim, key = p.state === 'attack' || p.state === 'stagger' ? p.data : p.state;
  if (m.animKey !== key || (p.state === 'idle' && m.animName !== idleClip(p))) {
    m.animKey = key;
    if (p.state === 'attack') { m.animName = 'attack_' + (p.data.kind === 'heavy' ? 'heavy' : 'light'); a.play(m.animName, { loop: false, restart: true, fade: 0.08, timeScale: a.fit(m.animName, p.data.atk.dur) }); }
    else if (p.state === 'roll') { m.animName = 'roll'; a.play('roll', { loop: false, restart: true, fade: 0.08, timeScale: a.fit('roll', p.data.back ? 0.4 : 0.62) }); }
    else if (p.state === 'stagger') { m.animName = 'hit'; a.play('hit', { loop: false, restart: true, fade: 0.05, timeScale: a.fit('hit', Math.max(0.3, p.data.dur)) }); }
    else if (p.state === 'dead') { m.animName = 'death'; a.play('death', { loop: false, restart: true, fade: 0.1 }); }
    else if (p.state === 'drink') { m.animName = 'drink'; a.play('drink', { fade: 0.2 }); }
    else if (p.state === 'falling' || p.state === 'fog') { m.animName = 'walk'; a.play('walk', { fade: 0.2 }); }
    else { m.animName = idleClip(p); a.play(m.animName, { fade: 0.2 }); }
  }
  a.update(dt);
}
const idleClip = p => p.blocking ? 'block' : p.moving > 1.2 ? 'run' : p.moving > 0 ? 'walk' : 'idle';

function animatePlayer(dt) {
  const p = player, m = p.model;
  m.root.position.copy(p.pos);
  m.root.rotation.y = p.yaw;
  if (m.rigged) return animateRigged(p, m, dt);
  p.walkPhase += dt * 9 * (p.moving || 0);
  const sw = Math.sin(p.walkPhase) * 0.7 * Math.min(1, p.moving);
  m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
  let armR = -0.5 - sw * 0.3, armL = sw * 0.4, armLy = 0, torsoX = 0, torsoY = 0;
  let pivotX = 0, pivotY = 0.9, headX = 0;
  if (p.state === 'attack') {
    const { atk } = p.data, t = p.t;
    const heavy = p.data.kind === 'heavy';
    if (t < atk.hitStart) { const k = t / atk.hitStart; armR = lerp(-0.5, heavy ? -3.1 : -2.7, k); torsoX = -0.25 * k; torsoY = 0.3 * k; }
    else if (t < atk.hitEnd) { const k = (t - atk.hitStart) / (atk.hitEnd - atk.hitStart); armR = lerp(heavy ? -3.1 : -2.7, -0.1, k); torsoX = lerp(-0.25, 0.35, k); torsoY = lerp(0.3, -0.4, k); }
    else { const k = (t - atk.hitEnd) / (atk.dur - atk.hitEnd); armR = lerp(-0.1, -0.5, k); torsoX = lerp(0.35, 0, k); torsoY = lerp(-0.4, 0, k); }
    m.legL.rotation.x = 0.4; m.legR.rotation.x = -0.3;
  } else if (p.state === 'roll') {
    const dur = p.data.back ? 0.4 : 0.62;
    const k = clamp(p.t / dur, 0, 1);
    if (!p.data.back) { pivotX = k * TAU; pivotY = 0.9 - Math.sin(k * Math.PI) * 0.45; }
    else { pivotX = -Math.sin(k * Math.PI) * 0.3; pivotY = 0.9 + Math.sin(k * Math.PI) * 0.15; }
    m.legL.rotation.x = -1.2; m.legR.rotation.x = -1.2; armR = -1; armL = -1;
  } else if (p.state === 'drink') {
    const k = Math.sin(clamp(p.t / 1.2, 0, 1) * Math.PI);
    armL = -2.3 * k; armLy = 0.6 * k; headX = -0.4 * k;
  } else if (p.state === 'stagger') {
    torsoX = -0.4 * Math.sin(clamp(p.t / p.data.dur, 0, 1) * Math.PI); armR = -0.2; armL = 0.3;
  } else if (p.state === 'dead') {
    const k = clamp(p.t / 0.9, 0, 1);
    pivotX = -Math.PI / 2 * k; pivotY = 0.9 - 0.7 * k;
  } else if (p.blocking) {
    armL = -1.35; armLy = 0.55; torsoY = 0.15;
  }
  m.armR.rotation.x = armR; m.armL.rotation.x = armL; m.armL.rotation.y = armLy;
  m.torso.rotation.x = torsoX; m.torso.rotation.y = torsoY; m.head.rotation.x = headX;
  m.pivot.rotation.x = pivotX; m.pivot.position.y = pivotY;
}
export { player, maxHp, maxSt, level, levelCost, baseDmg, setPlayerState, upgradePlayerModel, PLAYER_ATTACKS, updatePlayer, animatePlayer };
