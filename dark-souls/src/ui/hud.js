import { S } from '../state.js';
import { $ } from '../utils.js';
import { sfx } from '../core/audio.js';
import { canvas, camera } from '../core/renderer.js';
import { player, maxHp, maxSt, level, levelCost } from '../entities/player.js';
import { boss } from '../entities/enemy.js';

// ---------- HUD e menus ----------
function setGameState(s) {
  S.gameState = s;
  $('title').classList.toggle('hidden', s !== 'title');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('levelup').classList.toggle('hidden', s !== 'bonfire');
  $('ending').classList.toggle('hidden', s !== 'ending');
  $('hud').classList.toggle('hidden', s === 'title' || s === 'ending');
}
let bannerTimer = null;
function banner(text, cls, ms = 3500) {
  const b = $('banner');
  $('bannerText').textContent = text;
  b.className = 'show ' + cls;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.className = cls, ms);
}
let areaTimer = null;
function showArea(name) {
  if (name === S.currentArea) return;
  S.currentArea = name;
  $('area').textContent = name; $('area').classList.add('show');
  clearTimeout(areaTimer); areaTimer = setTimeout(() => $('area').classList.remove('show'), 3000);
}
function updateHUD(dt) {
  player.hpLag = player.hpLag > player.hp ? Math.max(player.hp, player.hpLag - maxHp() * 0.35 * dt) : player.hp;
  const pxPerHp = 1.1, pxPerSt = 2.2;
  $('hpBar').style.width = maxHp() * pxPerHp + 'px';
  $('stBar').style.width = maxSt() * pxPerSt + 'px';
  $('hpFill').style.width = (player.hp / maxHp() * 100) + '%';
  $('hpLag').style.width = (player.hpLag / maxHp() * 100) + '%';
  $('stFill').style.width = (Math.max(0, player.st) / maxSt() * 100) + '%';
  $('estusCount').textContent = player.estus;
  $('estus').classList.toggle('empty', player.estus === 0);
  $('soulsCount').textContent = player.souls;
  const showBoss = boss.active && boss.alive;
  $('bossbar').classList.toggle('hidden', !showBoss);
  if (showBoss) {
    boss.hpLag = boss.hpLag > boss.hp ? Math.max(boss.hp, boss.hpLag - boss.maxHp * 0.2 * dt) : boss.hp;
    $('bossFill').style.width = (boss.hp / boss.maxHp * 100) + '%';
    $('bossLag').style.width = (boss.hpLag / boss.maxHp * 100) + '%';
  }
  const ret = $('reticle');
  if (S.lockTarget) {
    const p = S.lockTarget.pos.clone(); p.y = 1.3 * (S.lockTarget.cfg.model.scale || 1);
    p.project(camera);
    ret.classList.remove('hidden');
    ret.style.left = ((p.x + 1) / 2 * innerWidth) + 'px';
    ret.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
  } else ret.classList.add('hidden');
}
function refreshLevelUI() {
  $('lvl').textContent = level(); $('lvSouls').textContent = player.souls; $('lvCost').textContent = levelCost();
  $('sVig').textContent = player.stats.vig; $('sEnd').textContent = player.stats.end; $('sStr').textContent = player.stats.str;
  document.querySelectorAll('#levelup button[data-stat]').forEach(b => b.disabled = player.souls < levelCost());
}
document.querySelectorAll('#levelup button[data-stat]').forEach(b => b.addEventListener('click', () => {
  const c = levelCost(); if (player.souls < c) return;
  player.souls -= c; player.stats[b.dataset.stat]++;
  player.hp = player.hpLag = maxHp(); player.st = maxSt();
  sfx.souls(); refreshLevelUI();
}));
$('leaveBonfire').addEventListener('click', () => { setGameState('play'); canvas.requestPointerLock(); });
export { setGameState, banner, showArea, updateHUD, refreshLevelUI };
