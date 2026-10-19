import * as THREE from '../vendor/three.module.min.js';
import { S } from './state.js';
import { scene } from './core/renderer.js';
import { wrap, yawTo } from './utils.js';
import { sfx } from './core/audio.js';
import { glowSprite } from './world/materials.js';
import { onGround } from './world/level.js';
import { addBonfire, fogWall, fogGate } from './world/props.js';
import { burst } from './fx/particles.js';
import { player, maxHp, maxSt, setPlayerState } from './entities/player.js';
import { enemies, resetEnemy, arrows } from './entities/enemy.js';
import { banner } from './ui/hud.js';

// ---------- combate ----------
function resetWorld() {
  for (const e of enemies) {
    if (e.cfg.boss) { if (!S.bossDefeated) resetEnemy(e); continue; }
    resetEnemy(e);
  }
  arrows.forEach(a => scene.remove(a.m)); arrows.length = 0;
}
function hurtPlayer(dmg, src, heavy = false) {
  if (player.state === 'dead' || player.state === 'fog') return;
  if (player.state === 'roll' && player.t > 0.04 && player.t < 0.42) return; // i-frames
  dmg *= 1 + S.ngLevel * 0.4;
  const facing = Math.abs(wrap(yawTo(player.pos, src) - player.yaw)) < 1.1;
  if (player.blocking && facing && player.state === 'idle') {
    player.st -= dmg * (heavy ? 1.4 : 0.9);
    player.stDelay = 0.8;
    sfx.block(); burst(player.pos.clone().setY(1.3), 0xffe0a0, 8, 3);
    if (player.st < 0) {
      player.st = 0; player.hp -= dmg * 0.6;
      setPlayerState('stagger', { dur: 1.2 });
    } else { player.hp -= dmg * 0.05; knock(src, 1.5); }
  } else {
    player.hp -= dmg;
    sfx.hurt(); burst(player.pos.clone().setY(1.2), 0x8a0a0a, 14, 4);
    setPlayerState('stagger', { dur: heavy ? 0.8 : 0.45 });
    knock(src, heavy ? 6 : 3);
    S.shake = Math.max(S.shake, heavy ? 0.5 : 0.2);
  }
  if (player.hp <= 0) killPlayer();
}
function knock(src, f) {
  const a = yawTo(src, player.pos);
  player.data.knock = new THREE.Vector3(Math.sin(a) * f, 0, Math.cos(a) * f);
}
function hurtEnemy(e, dmg, heavy) {
  if (!e.alive) return;
  if (e.cfg.blocks && e.state !== 'windup' && e.state !== 'active' && Math.abs(wrap(yawTo(e.pos, player.pos) - e.yaw)) < 1.0 && Math.random() < 0.6) {
    dmg *= 0.25; sfx.block(); burst(e.pos.clone().setY(1.3), 0xffe0a0, 8, 3);
    if (!heavy) { setPlayerState('stagger', { dur: 0.5 }); } // ricochete
  } else { sfx.hit(); burst(e.pos.clone().setY(1.2 * (e.cfg.model.scale || 1)), 0x9a0c0c, 16, 5); }
  e.hp -= dmg; e.flash = 1; e.aggro = true;
  if (e.cfg.boss && !e.active) return;
  if (e.hp <= 0) return killEnemy(e);
  if (e.cfg.poise === 0 || (e.cfg.poise === 1 && heavy)) { e.state = 'stagger'; e.t = 0; e.atk = null; }
}
function killEnemy(e) {
  e.alive = false; e.state = 'dead'; e.deadT = 0; player.kills++;
  const souls = Math.round(e.cfg.souls * (1 + S.ngLevel));
  player.souls += souls;
  if (S.lockTarget === e) S.lockTarget = null;
  if (e.cfg.boss) {
    S.bossDefeated = true; fogWall.active = false; fogGate.visible = false;
    sfx.victory(); banner('GRANDE INIMIGO ABATIDO', 'gold', 5000);
    setTimeout(() => {
      S.finalBonfire = addBonfire(0, 108, 'Fim do Asilo');
      banner('UMA FOGUEIRA SURGIU', 'gold', 2500);
    }, 5500);
  }
}
function killPlayer() {
  if (player.state === 'dead') return;
  player.hp = 0; player.deaths++;
  setPlayerState('dead', {});
  S.lockTarget = null;
  sfx.death();
  banner('VOCÊ MORREU', 'death', 4200);
  if (S.bloodstain) { scene.remove(S.bloodstain.sprite); S.bloodstain = null; }
  if (player.souls > 0) {
    const p = onGround(player.pos.x, player.pos.z) && player.pos.y > -1 ? player.pos.clone() : player.lastSafe.clone();
    p.y = 0;
    const s = glowSprite(0x40ff70, 1.1); s.position.copy(p).setY(0.4); scene.add(s);
    S.bloodstain = { pos: p, souls: player.souls, sprite: s };
    player.souls = 0;
  }
  setTimeout(respawn, 4500);
}
function respawn() {
  player.pos.copy(S.spawnPoint.pos); player.pos.y = 0; player.vy = 0; player.yaw = S.spawnPoint.yaw; S.camYaw = player.yaw;
  player.hp = player.hpLag = maxHp(); player.st = maxSt(); player.estus = player.estusMax;
  setPlayerState('idle', {});
  player.model.pivot.rotation.set(0, 0, 0); player.model.pivot.position.y = 0.9;
  resetWorld();
}
export { resetWorld, hurtPlayer, knock, hurtEnemy, killEnemy, killPlayer, respawn };
