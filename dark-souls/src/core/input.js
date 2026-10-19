import { S } from '../state.js';
import { $ } from '../utils.js';
import { canvas } from './renderer.js';
import { audio } from './audio.js';
import { toggleLock } from './camera.js';
import { interact } from '../interaction.js';
import { setGameState } from '../ui/hud.js';

// ---------- entrada ----------
const keys = {};
const bufferAction = a => { S.buffered = a; S.bufferedT = 0.35; };
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (S.gameState !== 'play') return;
  if (e.code === 'Space') { bufferAction('roll'); e.preventDefault(); }
  if (e.code === 'KeyF') bufferAction('heavy');
  if (e.code === 'KeyR') bufferAction('drink');
  if (e.code === 'KeyQ') toggleLock();
  if (e.code === 'KeyE') interact();
});
addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousedown', e => {
  audio();
  if (S.gameState === 'play' && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) { S.lmb = true; if (S.gameState === 'play') bufferAction('light'); }
  if (e.button === 1 && S.gameState === 'play') toggleLock();
  if (e.button === 2) S.rmb = true;
});
addEventListener('mouseup', e => { if (e.button === 0) S.lmb = false; if (e.button === 2) S.rmb = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { S.mouseDX += e.movementX; S.mouseDY += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && S.gameState === 'play') setGameState('pause');
});
$('pause').addEventListener('click', () => { setGameState('play'); canvas.requestPointerLock(); });
export { keys, bufferAction };
