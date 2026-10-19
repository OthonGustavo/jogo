import * as THREE from '../vendor/three.module.min.js';
import { S } from './state.js';
import { $, dist2d } from './utils.js';
import { scene } from './core/renderer.js';
import { sfx } from './core/audio.js';
import { bonfires, items, messages, setBonfireLit, fogWall } from './world/props.js';
import { player, maxHp, maxSt, level } from './entities/player.js';
import { boss } from './entities/enemy.js';
import { resetWorld } from './combat.js';
import { banner, setGameState, refreshLevelUI } from './ui/hud.js';

// ---------- interação (fogueiras, itens, mensagens, névoa) e fim de jogo ----------
function findInteract() {
  const p = player.pos;
  for (const bf of bonfires) if (dist2d(bf.pos, p) < 2.4) return { kind: 'bonfire', obj: bf, label: bf.lit ? 'Descansar na fogueira' : 'Acender fogueira' };
  for (const it of items) if (!it.taken && dist2d(it.pos, p) < 1.8) return { kind: 'item', obj: it, label: 'Pegar item' };
  if (S.bloodstain && dist2d(S.bloodstain.pos, p) < 1.8) return { kind: 'blood', label: 'Recuperar almas' };
  if (fogWall.active && !boss.active && Math.abs(p.x) < 3 && p.z > 70 && p.z < 72.6) return { kind: 'fog', label: 'Atravessar a névoa' };
  for (const m of messages) if (dist2d(m.pos, p) < 1.5) return { kind: 'msg', obj: m, label: 'Ler mensagem' };
  return null;
}
function interact() {
  if (!$('msgbox').classList.contains('hidden')) { $('msgbox').classList.add('hidden'); return; }
  if (player.state !== 'idle' || !S.currentInteract) return;
  const it = S.currentInteract;
  if (it.kind === 'bonfire') {
    const bf = it.obj;
    if (!bf.lit) { setBonfireLit(bf, true); sfx.bonfire(); banner('FOGUEIRA ACESA', 'gold'); }
    else if (bf === S.finalBonfire) { endGame(); return; }
    else rest(bf);
    S.spawnPoint = { pos: bf.pos.clone().add(new THREE.Vector3(0, 0, 1.8)), yaw: 0 };
  } else if (it.kind === 'item') {
    it.obj.taken = true; it.obj.sprite.visible = false;
    if (it.obj.kind === 'estus') { player.estusMax++; player.estus++; }
    else player.souls += it.obj.label.includes('Cavaleiro') ? 400 : 200;
    sfx.souls(); banner(it.obj.label.toUpperCase(), 'gold', 2200);
  } else if (it.kind === 'blood') {
    player.souls += S.bloodstain.souls; scene.remove(S.bloodstain.sprite); S.bloodstain = null;
    sfx.souls(); banner('ALMAS RECUPERADAS', 'gold', 2200);
  } else if (it.kind === 'fog') {
    player.state = 'fog'; player.t = 0; player.yaw = 0; S.lockTarget = null;
  } else if (it.kind === 'msg') {
    $('msgText').textContent = it.obj.text; $('msgbox').classList.remove('hidden');
  }
}
function rest(bf) {
  sfx.bonfire();
  player.hp = player.hpLag = maxHp(); player.st = maxSt(); player.estus = player.estusMax;
  resetWorld();
  S.lockTarget = null;
  document.exitPointerLock?.();
  setGameState('bonfire');
  refreshLevelUI();
}
function endGame() {
  const secs = Math.round((performance.now() - S.startTime) / 1000);
  $('endStats').innerHTML = `Tempo: ${Math.floor(secs / 60)}m ${secs % 60}s · Mortes: ${player.deaths} · Inimigos abatidos: ${player.kills} · Nível: ${level()}`;
  document.exitPointerLock?.();
  setGameState('ending');
}
export { findInteract, interact, rest, endGame };
