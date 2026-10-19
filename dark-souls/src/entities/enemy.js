import * as THREE from '../../vendor/three.module.min.js';
import { S } from '../state.js';
import { scene } from '../core/renderer.js';
import { clamp, lerp, wrap, lerpAngle, yawTo, dist2d, rand } from '../utils.js';
import { sfx } from '../core/audio.js';
import { mat } from '../world/materials.js';
import { resolveWalls, onGround, insideWall } from '../world/level.js';
import { burst } from '../fx/particles.js';
import { buildHumanoid, setFlash } from './humanoid.js';
import { player } from './player.js';
import { hurtPlayer } from '../combat.js';

// ---------- inimigos ----------
const arrows = [];
const TYPES = {
  hollow: { hp: 70, speed: 2.4, sight: 14, r: 0.45, souls: 40, poise: 0, model: { armor: 0x5a5048, skin: 0x6a5a48, cloth: 0x2e241c, weapon: 'rusty', helm: false, eyes: 0x000000 },
    attacks: [{ wind: 0.55, active: 0.18, recover: 0.7, range: 2.0, arc: 1.0, dmg: 22, lunge: 2 }] },
  archer: { hp: 45, speed: 2.0, sight: 20, r: 0.45, souls: 55, poise: 0, ranged: true, model: { armor: 0x4a4a3a, skin: 0x6a5a48, cloth: 0x2a3020, weapon: 'none', bow: true, helm: false, eyes: 0x000000 },
    attacks: [{ wind: 1.0, active: 0.1, recover: 0.9, range: 18, arc: 0.3, dmg: 18, shoot: true }] },
  knight: { hp: 220, speed: 2.8, sight: 16, r: 0.55, souls: 180, poise: 1, blocks: true, model: { armor: 0x2a2a30, cloth: 0x1a1a22, weapon: 'greatsword', shield: true, eyes: 0xff3020 },
    attacks: [
      { wind: 0.7, active: 0.2, recover: 0.8, range: 2.8, arc: 1.2, dmg: 38, lunge: 3 },
      { wind: 1.1, active: 0.25, recover: 1.0, range: 3.2, arc: 0.8, dmg: 55, lunge: 5, heavy: true },
    ] },
  boss: { hp: 1400, speed: 3.0, sight: 80, r: 1.8, souls: 2500, poise: 99, boss: true, model: { armor: 0x3a3428, skin: 0x5a4a3a, cloth: 0x2a2018, weapon: 'club', helm: false, horns: true, eyes: 0xffaa30, scale: 3.2 },
    attacks: [
      { name: 'smash', wind: 1.1, active: 0.18, recover: 1.2, range: 5.5, arc: 0.8, dmg: 70, lunge: 1, slam: true },
      { name: 'sweep', wind: 0.8, active: 0.25, recover: 1.0, range: 6.2, arc: 1.6, dmg: 50, lunge: 0 },
      { name: 'jump', wind: 0.9, active: 0.2, recover: 1.5, range: 99, arc: 9, dmg: 80, jump: true, aoe: 5.5, slam: true },
    ] },
};
const enemies = [];
function addEnemy(type, x, z, yaw = Math.PI) {
  const cfg = TYPES[type];
  const e = { type, cfg, spawn: new THREE.Vector3(x, 0, z), spawnYaw: yaw, pos: new THREE.Vector3(), yaw, model: buildHumanoid(cfg.model), alive: true, flash: 0 };
  resetEnemy(e);
  enemies.push(e);
  return e;
}
function resetEnemy(e) {
  const mult = 1 + S.ngLevel * 0.6;
  e.maxHp = e.cfg.hp * mult; e.hp = e.maxHp; e.hpLag = e.hp;
  e.pos.copy(e.spawn); e.yaw = e.spawnYaw; e.state = 'idle'; e.t = 0; e.atk = null; e.cool = rand(0.5, 1.5);
  e.alive = true; e.aggro = false; e.deadT = 0; e.walkPhase = 0; e.phase2 = false; e.jumpFrom = null;
  e.model.root.visible = true; e.model.pivot.rotation.set(0, 0, 0); e.model.pivot.position.y = 0.9;
  if (e.cfg.boss) e.active = false;
}

addEnemy('hollow', -6, -44); addEnemy('hollow', 7, -36); addEnemy('hollow', -2, -24);
addEnemy('hollow', 9, -12); addEnemy('archer', -15, -4, 0); addEnemy('hollow', 1, -6);
addEnemy('hollow', 0, 22);
addEnemy('knight', 2, 64); addEnemy('hollow', -9, 52); addEnemy('hollow', 11, 56); addEnemy('archer', 14, 69);
const boss = addEnemy('boss', 0, 112);
boss.name = 'Demônio do Asilo';
// ---------- IA ----------
function updateEnemy(e, dt) {
  const m = e.model;
  e.flash = Math.max(0, e.flash - dt * 5); setFlash(m, e.flash * 0.6);
  if (!e.alive) {
    e.deadT += dt;
    const k = clamp(e.deadT / 1.0, 0, 1);
    m.pivot.rotation.x = -Math.PI / 2 * k; m.pivot.position.y = 0.9 - 0.75 * k;
    if (e.deadT > 2.5) {
      m.root.position.y = -(e.deadT - 2.5) * 0.8;
      if (e.deadT > 4) m.root.visible = false;
    }
    return;
  }
  if (e.cfg.boss && !e.active) { animateEnemy(e, dt, 0); return; }
  e.t += dt; e.cool -= dt;
  const pl = player, d = dist2d(e.pos, pl.pos) - e.cfg.r;
  const playerOk = pl.state !== 'dead' && pl.state !== 'falling';
  const speedMul = e.phase2 ? 1.3 : 1;

  if (e.cfg.boss && !e.phase2 && e.hp < e.maxHp * 0.5) {
    e.phase2 = true; sfx.roar(); S.shake = 0.6;
    m.skinM.color.setHex(0x8a2a1a);
  }
  if (!e.aggro && playerOk && d < e.cfg.sight && Math.abs(pl.pos.y) < 1) e.aggro = true;
  if (e.aggro && (!playerOk || (!e.cfg.boss && dist2d(e.pos, e.spawn) > 35))) { e.aggro = false; e.state = 'return'; }

  let moveAmt = 0;
  const face = (target, rate) => { e.yaw = lerpAngle(e.yaw, yawTo(e.pos, target), Math.min(1, rate * dt)); };
  const fwd = () => new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
  const tryMove = (dir, sp) => {
    const np = e.pos.clone().addScaledVector(dir, sp * dt);
    if (onGround(np.x, np.z)) { e.pos.copy(np); moveAmt = sp / 2.4; }
  };

  switch (e.state) {
    case 'idle':
      if (e.aggro) { e.state = 'chase'; e.t = 0; }
      break;
    case 'return': {
      if (dist2d(e.pos, e.spawn) < 0.5) { e.state = 'idle'; e.hp = e.maxHp; break; }
      face(e.spawn, 5);
      const dir = e.spawn.clone().sub(e.pos).setY(0).normalize();
      tryMove(dir, e.cfg.speed);
      if (e.aggro) e.state = 'chase';
      break;
    }
    case 'chase': {
      if (!e.aggro) { e.state = 'return'; break; }
      face(pl.pos, e.cfg.boss ? 2.5 : 5);
      const atks = e.cfg.attacks;
      if (e.cfg.ranged) {
        const away = e.pos.clone().sub(pl.pos).setY(0).normalize();
        if (d < 5) tryMove(away, e.cfg.speed);
        else if (d > 16) tryMove(fwd(), e.cfg.speed);
        if (e.cool <= 0 && d < 18) startAttack(e, atks[0]);
        break;
      }
      let choice = null;
      if (e.cool <= 0) {
        const ok = atks.filter(a => d <= a.range && (!a.jump || d > 7));
        if (ok.length) choice = ok[Math.floor(Math.random() * ok.length)];
        else if (e.cfg.boss && d > 9 && Math.random() < 0.02) choice = atks.find(a => a.jump);
      }
      if (choice) startAttack(e, choice);
      else if (d > (e.cfg.boss ? 3.5 : 1.4)) tryMove(fwd(), e.cfg.speed * speedMul);
      else if (!e.cfg.boss) {
        // circula o jogador quando está perto e em cooldown
        const side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
        tryMove(side, e.cfg.speed * 0.4);
      }
      break;
    }
    case 'windup': {
      const a = e.atk;
      const wind = a.wind / speedMul;
      if (!a.jump) face(pl.pos, e.cfg.boss ? 1.8 : 3);
      if (a.jump) {
        if (!e.jumpFrom) { e.jumpFrom = e.pos.clone(); e.jumpTo = pl.pos.clone(); }
        const k = clamp(e.t / wind, 0, 1);
        face(e.jumpTo, 6);
        e.pos.lerpVectors(e.jumpFrom, e.jumpTo, k);
        m.root.position.y = Math.sin(k * Math.PI) * 6;
      }
      if (e.t >= wind) {
        e.state = 'active'; e.t = 0; e.hitDone = false;
        if (a.shoot) shootArrow(e);
        else if (e.cfg.boss) sfx.heavy(); else sfx.swing();
        if (a.slam) { sfx.slam(); S.shake = Math.max(S.shake, 0.7); burst(e.pos.clone().add(fwd().multiplyScalar(a.jump ? 0 : 3.5)).setY(0.2), 0x8a7a60, 30, 7); }
      }
      break;
    }
    case 'active': {
      const a = e.atk;
      if (a.lunge) tryMove(fwd(), a.lunge * 3);
      if (!e.hitDone && !a.shoot && playerOk) {
        let hit;
        if (a.aoe) hit = dist2d(e.pos, pl.pos) < a.aoe;
        else hit = d <= a.range && Math.abs(wrap(yawTo(e.pos, pl.pos) - e.yaw)) < a.arc;
        if (hit) { e.hitDone = true; hurtPlayer(a.dmg * rand(0.9, 1.1), e.pos, !!(a.heavy || e.cfg.boss)); }
      }
      if (e.t >= a.active) { e.state = 'recover'; e.t = 0; m.root.position.y = 0; e.jumpFrom = null; }
      break;
    }
    case 'recover':
      if (e.t >= e.atk.recover / speedMul) {
        // combo da fase 2 do chefe
        if (e.cfg.boss && e.phase2 && e.atk.name === 'sweep' && Math.random() < 0.6) startAttack(e, e.cfg.attacks[0]);
        else { e.state = 'chase'; e.t = 0; e.cool = rand(0.4, 1.4) / speedMul; e.atk = null; }
      }
      break;
    case 'stagger':
      if (e.t > 0.6) { e.state = 'chase'; e.t = 0; e.cool = rand(0.1, 0.6); }
      break;
  }

  resolveWalls(e.pos, e.cfg.r);
  // separação jogador/inimigo
  const sep = dist2d(e.pos, pl.pos), minD = e.cfg.r + 0.42;
  if (sep < minD && sep > 1e-4 && pl.state !== 'dead' && pl.state !== 'falling') {
    const push = (minD - sep);
    const dx = (pl.pos.x - e.pos.x) / sep, dz = (pl.pos.z - e.pos.z) / sep;
    const wp = e.cfg.boss ? 1 : 0.5;
    pl.pos.x += dx * push * wp; pl.pos.z += dz * push * wp;
    if (!e.cfg.boss) { e.pos.x -= dx * push * 0.5; e.pos.z -= dz * push * 0.5; }
  }
  for (const o of enemies) {
    if (o === e || !o.alive) continue;
    const dd = dist2d(e.pos, o.pos), md = e.cfg.r + o.cfg.r;
    if (dd < md && dd > 1e-4 && !e.cfg.boss) { e.pos.x += (e.pos.x - o.pos.x) / dd * (md - dd) * 0.5; e.pos.z += (e.pos.z - o.pos.z) / dd * (md - dd) * 0.5; }
  }
  animateEnemy(e, dt, moveAmt);
}
function startAttack(e, a) { e.state = 'windup'; e.t = 0; e.atk = a; e.jumpFrom = null; }

function animateEnemy(e, dt, moveAmt) {
  const m = e.model;
  m.root.position.x = e.pos.x; m.root.position.z = e.pos.z;
  if (!(e.state === 'windup' && e.atk?.jump)) m.root.position.y = 0;
  m.root.rotation.y = e.yaw;
  e.walkPhase += dt * 7 * moveAmt;
  const sw = Math.sin(e.walkPhase) * 0.6 * Math.min(1, moveAmt);
  m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
  let armR = -0.4 - sw * 0.3, armL = sw * 0.3, torsoX = e.type === 'hollow' ? 0.25 : 0, torsoY = 0;
  if (e.type === 'archer') { armL = -1.5; }
  const a = e.atk;
  if (e.state === 'windup' && a) {
    const k = clamp(e.t / (a.wind / (e.phase2 ? 1.3 : 1)), 0, 1);
    if (a.shoot) { armL = -1.57; armR = lerp(-1.2, -1.6, k); }
    else if (a.name === 'sweep') { armR = -1.6; torsoY = 1.2 * k; }
    else { armR = lerp(-0.4, -3.0, k); torsoX = -0.3 * k; }
  } else if (e.state === 'active' && a) {
    const k = clamp(e.t / a.active, 0, 1);
    if (a.shoot) { armL = -1.57; armR = -0.6; }
    else if (a.name === 'sweep') { armR = -1.6; torsoY = lerp(1.2, -1.2, k); }
    else { armR = lerp(-3.0, -0.2, k); torsoX = lerp(-0.3, 0.4, k); }
  } else if (e.state === 'recover' && a && !a.shoot) {
    armR = a.name === 'sweep' ? -1.4 : -0.2; torsoX = 0.3;
  } else if (e.state === 'stagger') {
    torsoX = -0.5; armR = 0; armL = 0.4;
  }
  if (e.cfg.boss && !e.active) { torsoX = 0.2; }
  m.armR.rotation.x = armR; m.armL.rotation.x = armL;
  m.torso.rotation.x = torsoX; m.torso.rotation.y = torsoY;
}
const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4).rotateX(Math.PI / 2);
const arrowMat = mat(0x8a7050);
function shootArrow(e) {
  sfx.arrow();
  const m = new THREE.Mesh(arrowGeo, arrowMat);
  const from = e.pos.clone().setY(1.4);
  const to = player.pos.clone().setY(1.1);
  const v = to.sub(from).normalize().multiplyScalar(22);
  m.position.copy(from); m.lookAt(from.clone().add(v));
  scene.add(m);
  arrows.push({ m, v, life: 2.5, src: e.pos.clone(), dmg: e.atk.dmg });
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.m.position.addScaledVector(a.v, dt); a.life -= dt;
    const pp = player.pos.clone().setY(1.1);
    let dead = a.life <= 0 || insideWall(a.m.position);
    const dodging = player.state === 'roll' && player.t > 0.04 && player.t < 0.42;
    if (!dead && !dodging && player.state !== 'dead' && a.m.position.distanceTo(pp) < 0.6) {
      hurtPlayer(a.dmg, a.src);
      dead = true;
    }
    if (dead) { scene.remove(a.m); arrows.splice(i, 1); }
  }
}
export { TYPES, enemies, addEnemy, resetEnemy, boss, startAttack, updateEnemy, animateEnemy, arrows, shootArrow, updateArrows };
