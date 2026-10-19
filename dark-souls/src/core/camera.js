import * as THREE from '../../vendor/three.module.min.js';
import { S } from '../state.js';
import { clamp, lerp, wrap, lerpAngle, yawTo, dist2d, rand } from '../utils.js';
import { camera, moon } from './renderer.js';
import { keys } from './input.js';
import { insideWall } from '../world/level.js';
import { player } from '../entities/player.js';
import { enemies, boss } from '../entities/enemy.js';

// ---------- câmera e mira ----------
function toggleLock() {
  if (S.lockTarget) { S.lockTarget = null; return; }
  let best = null, bestScore = Infinity;
  for (const e of enemies) {
    if (!e.alive || (e.cfg.boss && !e.active)) continue;
    const d = dist2d(e.pos, player.pos);
    if (d > 22) continue;
    const ang = Math.abs(wrap(yawTo(player.pos, e.pos) - S.camYaw));
    const score = d + ang * 8;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  S.lockTarget = best;
}
function updateCamera(dt) {
  const sens = 0.0025;
  if (!S.lockTarget) {
    S.camYaw -= S.mouseDX * sens;
    S.camPitch = clamp(S.camPitch + S.mouseDY * sens, -0.15, 1.1);
  }
  if (keys.ArrowLeft) S.camYaw += 2.2 * dt; if (keys.ArrowRight) S.camYaw -= 2.2 * dt;
  if (keys.ArrowUp) S.camPitch = clamp(S.camPitch - 1.5 * dt, -0.15, 1.1); if (keys.ArrowDown) S.camPitch = clamp(S.camPitch + 1.5 * dt, -0.15, 1.1);
  S.mouseDX = S.mouseDY = 0;
  if (S.lockTarget) {
    if (!S.lockTarget.alive || dist2d(S.lockTarget.pos, player.pos) > 26) S.lockTarget = null;
    else {
      S.camYaw = lerpAngle(S.camYaw, yawTo(player.pos, S.lockTarget.pos), Math.min(1, 6 * dt));
      S.camPitch = lerp(S.camPitch, S.lockTarget.cfg.boss ? 0.15 : 0.3, Math.min(1, 3 * dt));
    }
  }
  const dist = boss.active && boss.alive ? 7.5 : 5.2;
  const focus = player.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  if (player.state === 'falling') focus.y = Math.max(focus.y, -2);
  const off = new THREE.Vector3(-Math.sin(S.camYaw) * Math.cos(S.camPitch), Math.sin(S.camPitch), -Math.cos(S.camYaw) * Math.cos(S.camPitch)).multiplyScalar(dist);
  const camPos = focus.clone().add(off);
  // evita a câmera atravessar paredes: aproxima até achar espaço livre
  for (let k = 0.1; k <= 1.001; k += 0.1) {
    const probe = focus.clone().addScaledVector(off, k);
    if (insideWall(probe)) { camPos.copy(focus).addScaledVector(off, Math.max(0.12, k - 0.15)); break; }
  }
  camera.position.lerp(camPos, Math.min(1, 14 * dt));
  if (S.shake > 0) {
    camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(S.shake * 0.3));
    S.shake = Math.max(0, S.shake - dt * 1.5);
  }
  const look = S.lockTarget ? focus.clone().lerp(S.lockTarget.pos.clone().setY(1.2 * (S.lockTarget.cfg.model.scale || 1)), 0.35) : focus;
  camera.lookAt(look);
  moon.position.copy(player.pos).add(new THREE.Vector3(-15, 30, -10));
  moon.target.position.copy(player.pos);
}
export { toggleLock, updateCamera };
