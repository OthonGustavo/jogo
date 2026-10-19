import * as THREE from '../vendor/three.module.min.js';
import { S } from './state.js';
import { $ } from './utils.js';
import { scene, canvas, camera } from './core/renderer.js';
import { audio } from './core/audio.js';
import { keys, bufferAction } from './core/input.js';
import { updateCamera } from './core/camera.js';
import { flickers } from './world/level.js';
import { bonfires, items, setBonfireLit, fogMat, fogGate, fogWall } from './world/props.js';
import { player, updatePlayer } from './entities/player.js';
import { enemies, boss, updateEnemy, updateArrows } from './entities/enemy.js';
import { updateSparks } from './fx/particles.js';
import { renderFrame } from './fx/post.js';
import { removeFire } from './fx/particles.js';
import { setGameState, banner, updateHUD } from './ui/hud.js';
import { findInteract, interact } from './interaction.js';
import { respawn, hurtPlayer, killPlayer } from './combat.js';

$('ngPlus').addEventListener('click', () => {
  S.ngLevel++;
  S.bossDefeated = false; fogWall.active = true; fogGate.visible = true;
  if (S.finalBonfire) { removeFire(S.finalBonfire.fire); scene.remove(S.finalBonfire.group); bonfires.splice(bonfires.indexOf(S.finalBonfire), 1); S.finalBonfire = null; }
  bonfires.forEach(b => setBonfireLit(b, false));
  items.forEach(i => { i.taken = false; i.sprite.visible = true; });
  S.spawnPoint = { pos: new THREE.Vector3(0, 0, -68), yaw: 0 };
  respawn(); S.currentArea = '';
  setGameState('play'); canvas.requestPointerLock();
  banner(`JORNADA NOVA+${S.ngLevel}`, 'gold');
});

$('startBtn').addEventListener('click', () => {
  audio();
  S.startTime = performance.now();
  setGameState('play');
  canvas.requestPointerLock();
  setTimeout(() => banner('DESPERTAR', 'gold', 2500), 300);
});
// ---------- loop ----------
let last = performance.now(), elapsed = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  elapsed += dt;
  if (S.gameState === 'play') {
    if (S.hitStop > 0) { S.hitStop -= dt; dt *= 0.15; }
    updatePlayer(dt);
    for (const e of enemies) updateEnemy(e, dt);
    updateArrows(dt);
    S.currentInteract = player.state === 'idle' ? findInteract() : null;
    const pr = $('prompt');
    pr.classList.toggle('show', !!S.currentInteract);
    if (S.currentInteract) pr.textContent = '[E] ' + S.currentInteract.label;
    updateHUD(dt);
  }
  if (S.gameState === 'title') { S.camYaw += dt * 0.08; S.camPitch = 0.25; }
  updateSparks(dt);
  // fogo das fogueiras e tochas
  for (const bf of bonfires) {
    if (!bf.lit) continue;
    bf.light.intensity = 26 + Math.sin(elapsed * 13) * 3 + Math.random() * 4;
    for (const em of bf.embers) {
      em.t += dt * 0.6; if (em.t > 1) em.t = 0;
      const a = em.t * 9 + em.s.id;
      em.s.position.set(Math.sin(a) * 0.3 * (1 - em.t), 0.5 + em.t * 2.6, Math.cos(a) * 0.3 * (1 - em.t));
      em.s.material.opacity = 1 - em.t;
    }
  }
  for (const f of flickers) { f.light.intensity = f.base * (0.85 + Math.random() * 0.3); }
  items.forEach(i => { if (!i.taken) i.sprite.position.y = 0.5 + Math.sin(elapsed * 3 + i.pos.x) * 0.12; });
  if (S.bloodstain) S.bloodstain.sprite.material.opacity = 0.7 + Math.sin(elapsed * 4) * 0.3;
  fogMat.opacity = 0.45 + Math.sin(elapsed * 2) * 0.1;
  updateCamera(dt);
  renderFrame();
}
setGameState('title');
camera.position.set(0, 3, -75);
requestAnimationFrame(frame);

// gancho para testes automatizados
window.__game = { player, enemies, boss, setGameState, hurtPlayer, killPlayer, interact, bufferAction, keys, get state() { return S.gameState; } };
