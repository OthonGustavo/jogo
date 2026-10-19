// Teste de fumaça do jogo (Playwright). Uso:
//   node tests/smoke.mjs           -> testa o jogo em src/ (servido com python http.server)
//   node tests/smoke.mjs --dist    -> testa dist/almas-sombrias.html (gerado por tools/build-single.mjs)
// Como o render headless é lento (~1 fps), os passos avançam por TEMPO SIMULADO
// (contador window.__simT acumulado por requestAnimationFrame, dt limitado a 0.05 como no jogo).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttp } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.argv.includes('--dist');
const SERVE_DIR = DIST ? join(ROOT, 'dist') : ROOT;
const PAGE = DIST ? '/almas-sombrias.html' : '/index.html';
const SHOTS = join(ROOT, 'tests', 'shots');
mkdirSync(SHOTS, { recursive: true });
if (DIST && !existsSync(join(SERVE_DIR, 'almas-sombrias.html'))) {
  console.error('dist/almas-sombrias.html não existe. Rode "npm run build" antes.'); process.exit(1);
}

// ---------- servidor estático ----------
const freePort = () => new Promise((ok, fail) => {
  const s = createServer(); s.unref(); s.on('error', fail);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});
const isUp = async port => { try { return (await fetch(`http://127.0.0.1:${port}${PAGE}`)).ok; } catch { return false; } };
const waitUp = async (port, ms) => { for (let t = 0; t < ms; t += 100) { if (await isUp(port)) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };
let stopServer = () => {};
async function startServer() {
  const port = await freePort();
  for (const py of ['python3', 'python']) {
    const child = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', SERVE_DIR], { stdio: 'ignore' });
    let failed = false; child.on('error', () => { failed = true; });
    if (!failed && await waitUp(port, 4000)) { stopServer = () => child.kill(); return port; }
    child.kill();
  }
  // fallback (sem python): servidor estático em Node
  const srv = createHttp((req, res) => {
    const f = normalize(join(SERVE_DIR, decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(SERVE_DIR) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  stopServer = () => srv.close();
  return port;
}

// ---------- resultados ----------
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
const pageErrors = [];

const port = await startServer();
const exe = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  ...(existsSync(exe) ? { executablePath: exe } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let crashed = null;
try {
  const p = await browser.newPage({ viewport: { width: 480, height: 270 } });
  p.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGEERROR ' + e.message); });
  await p.goto(`http://127.0.0.1:${port}${PAGE}`, { waitUntil: 'load' });

  const G = f => p.evaluate(f);
  const W = 'window.__game';
  // espera por uma condição (expressão JS) ou até passar `maxSim` segundos simulados
  const until = async (expr, maxSim) => {
    await G(() => { window.__simT = 0; });
    await p.waitForFunction(`(${expr}) || window.__simT > ${maxSim}`, null, { timeout: 420000, polling: 'raf' });
    return G(`!!(${expr})`);
  };
  const sim = s => until('false', s);
  const shot = async name => {
    await p.setViewportSize({ width: 800, height: 450 }); await sim(0.2);
    await p.screenshot({ path: join(SHOTS, name) });
    await p.setViewportSize({ width: 480, height: 270 }); await sim(0.1);
  };

  // carregou? clica em Novo Jogo e força o estado 'play' (o pointer lock não existe no headless)
  await p.waitForFunction('!!window.__game', null, { timeout: 60000 });
  check('jogo carregou (window.__game)', true);
  await p.click('#startBtn');
  await G(() => {
    window.__game.setGameState('play');
    window.__simT = 0; let last = performance.now();
    (function tick(n) { window.__simT += Math.min(0.05, (n - last) / 1000); last = n; requestAnimationFrame(tick); })(last);
  });
  await sim(0.3);
  check('estado "play" após Novo Jogo', await G(`${W}.state === 'play'`), await G(`${W}.state`));
  await shot('01-inicio.png');

  // (a) atacar um oco até matar dá almas
  const souls0 = await G(`${W}.player.souls`);
  await G(() => { const { player: pl, enemies: [e] } = window.__game; pl.pos.set(e.pos.x, 0, e.pos.z - 1.6); pl.yaw = 0; });
  await sim(0.2);
  for (let i = 0; i < 15 && await G(`${W}.enemies[0].alive`); i++) {
    await until(`${W}.player.state === 'idle'`, 2);
    await G(() => {
      const g = window.__game, pl = g.player, e = g.enemies[0];
      if (Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) > 2.2) pl.pos.set(e.pos.x, 0, e.pos.z - 1.6);
      pl.yaw = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z); pl.st = Math.max(pl.st, 60); pl.hp = Math.max(pl.hp, 300);
      g.bufferAction('light');
    });
    await sim(0.7);
  }
  const dead0 = !(await G(`${W}.enemies[0].alive`)), gained = (await G(`${W}.player.souls`)) - souls0;
  check('(a) atacar o oco até matar dá almas', dead0 && gained === 40, `morto=${dead0} almas +${gained}`);
  await shot('02-combate.png');

  // (b) rolar entra no estado 'roll'
  await G(() => { const pl = window.__game.player; pl.pos.set(0, 0, -66); pl.state = 'idle'; pl.st = 100; });
  await sim(0.2);
  await G(`${W}.bufferAction('roll')`);
  const rolled = await until(`${W}.player.state === 'roll'`, 1);
  check('(b) rolar entra no estado roll', rolled, await G(`${W}.player.state`));
  await until(`${W}.player.state === 'idle'`, 2);

  // (c) Estus cura e gasta 1 frasco
  const estus0 = await G(`${W}.player.estus`);
  await G(() => { const pl = window.__game.player; pl.hp = pl.hpLag = 100; });
  await G(`${W}.bufferAction('drink')`);
  await until(`${W}.player.estus === ${estus0 - 1}`, 3);
  await until(`${W}.player.state === 'idle'`, 3);
  const hp1 = await G(`${W}.player.hp`), estus1 = await G(`${W}.player.estus`);
  check('(c) Estus cura e gasta 1 frasco', hp1 >= 250 && estus1 === estus0 - 1, `hp 100 -> ${Math.round(hp1)}, frascos ${estus0} -> ${estus1}`);

  // (d) atravessar a névoa ativa o chefe
  await G(() => {
    const g = window.__game;
    g.enemies.filter(e => !e.cfg.boss).forEach(e => { e.alive = false; e.model.root.visible = false; });
    g.player.pos.set(0, 0, 71.5); g.player.state = 'idle'; g.player.hp = g.player.hpLag = 350;
  });
  await sim(0.3);
  const bossBefore = await G(`${W}.boss.active`);
  await G(`${W}.interact()`);
  const bossOn = await until(`${W}.boss.active === true`, 6);
  check('(d) atravessar a névoa ativa o chefe', !bossBefore && bossOn, `chefe ativo antes=${bossBefore} depois=${bossOn}, jogador z=${(await G(`${W}.player.pos.z`)).toFixed(1)}`);
  await until(`${W}.player.state === 'idle'`, 2);
  // trava a mira no chefe (Q) para a captura mostrar a arena
  await G(() => { window.__game.player.pos.set(0, 0, 94); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); });
  await sim(1.5);
  await shot('03-chefe.png');

  // (e) matar o chefe dá 2500 almas
  const soulsB = await G(`${W}.player.souls`);
  await G(() => { const g = window.__game; g.boss.hp = 1; g.boss.state = 'stagger'; g.boss.t = -99; });
  for (let i = 0; i < 6 && await G(`${W}.boss.alive`); i++) {
    await until(`${W}.player.state === 'idle'`, 2);
    await G(() => {
      const g = window.__game, pl = g.player, b = g.boss;
      pl.pos.set(b.pos.x, 0, b.pos.z - 3.2); pl.yaw = 0; pl.st = Math.max(pl.st, 60); pl.hp = pl.hpLag = 350;
      g.bufferAction('light');
    });
    await sim(0.8);
  }
  const bossDead = !(await G(`${W}.boss.alive`)), gainedB = (await G(`${W}.player.souls`)) - soulsB;
  check('(e) matar o chefe dá 2500 almas', bossDead && gainedB === 2500, `chefe morto=${bossDead} almas +${gainedB}`);

  // (f) cair da ponte -> 'falling' -> renasce no início, almas zeradas, inimigos de volta
  const nonBoss = await G(`${W}.enemies.filter(e => !e.cfg.boss).length`);
  await G(() => {
    const g = window.__game, pl = g.player;
    pl.pos.set(2.5, 0, 10); pl.state = 'idle'; pl.hp = pl.hpLag = 350; pl.souls = 123; pl.yaw = 0;
    g.keys.KeyA = true;
  });
  const falling = await until(`${W}.player.state === 'falling'`, 3);
  await G(() => { window.__game.keys.KeyA = false; });
  check('(f1) andar para fora da ponte entra em falling', falling, await G(`${W}.player.state`));
  const respawned = await until(`${W}.player.state === 'idle' && ${W}.player.pos.z < -60`, 60);
  const fin = await G(() => { const g = window.__game; return { souls: g.player.souls, deaths: g.player.deaths, y: g.player.pos.y, z: g.player.pos.z, back: g.enemies.filter(e => !e.cfg.boss && e.alive).length }; });
  check('(f2) renasce no início, almas zeradas, inimigos de volta',
    respawned && fin.souls === 0 && fin.deaths >= 1 && fin.back === nonBoss && Math.abs(fin.y) < 0.01,
    `renasceu=${respawned} z=${fin.z.toFixed(1)} almas=${fin.souls} mortes=${fin.deaths} inimigos vivos=${fin.back}/${nonBoss}`);
  await shot('04-renasceu.png');

  check('nenhum pageerror', pageErrors.length === 0, pageErrors.join(' | '));
} catch (err) {
  crashed = err;
  console.log('ERRO NO TESTE: ' + (err && err.stack || err));
} finally {
  await browser.close().catch(() => {});
  stopServer();
}
const failed = results.filter(r => !r.ok).length + (crashed ? 1 : 0) + (pageErrors.length && !results.some(r => r.name === 'nenhum pageerror') ? 1 : 0);
console.log(failed ? `\n${failed} CHECK(S) FALHARAM` : `\nTODOS OS ${results.length} CHECKS PASSARAM`);
process.exit(failed ? 1 : 0);
