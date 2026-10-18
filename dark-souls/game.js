import * as THREE from './vendor/three.module.min.js';

// ---------- utilidades ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rand = (a, b) => a + Math.random() * (b - a);
const $ = id => document.getElementById(id);

// ---------- render ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080c);
scene.fog = new THREE.FogExp2(0x0a0b10, 0.028);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

scene.add(new THREE.HemisphereLight(0x8090b0, 0x201810, 0.55));
scene.add(new THREE.AmbientLight(0x303040, 0.5));
const moon = new THREE.DirectionalLight(0xa8b8e0, 1.1);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
moon.shadow.bias = -0.0005;
scene.add(moon, moon.target);

// ---------- texturas procedurais ----------
function stoneTexture(base = [70, 66, 60], grout = '#1a1814') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = grout; g.fillRect(0, 0, 256, 256);
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const h = 256 / rows, off = (r % 2) * 32;
    for (let x = -64; x < 256; x += 64) {
      const v = rand(-14, 14);
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect(x + off + 2, r * h + 2, 60, h - 4);
    }
  }
  for (let i = 0; i < 2500; i++) {
    const v = rand(-25, 25);
    g.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.35)`;
    g.fillRect(rand(0, 256), rand(0, 256), 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 12; i++) {
    g.beginPath(); let x = rand(0, 256), y = rand(0, 256); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += rand(-15, 15); y += rand(-15, 15); g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function glowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.3, inner.replace(/[\d.]+\)$/, '0.5)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const floorTex = stoneTexture([62, 60, 56]);
const wallTex = stoneTexture([78, 74, 68]);
const glowTex = glowTexture();

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, ...o });
const glowSprite = (color, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); return s;
};

// ---------- mundo ----------
const grounds = [];   // retângulos onde se pode pisar
const walls = [];     // AABBs de colisão
const world = new THREE.Group(); scene.add(world);

function addGround(x1, z1, x2, z2) {
  grounds.push({ x1, z1, x2, z2 });
  const w = x2 - x1, d = z2 - z1;
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(w / 4, d / 4);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 14, d), [mat(0x2a2622), mat(0x2a2622), mat(0xffffff, { map: t }), mat(0x111111), mat(0x2a2622), mat(0x2a2622)]);
  m.position.set((x1 + x2) / 2, -7, (z1 + z2) / 2);
  m.receiveShadow = true;
  world.add(m);
}
function addWall(x1, z1, x2, z2, h = 7, visible = true) {
  const w = { x1, z1, x2, z2, active: true };
  walls.push(w);
  if (visible) {
    const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(x2 - x1, z2 - z1) / 4, h / 4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, h, z2 - z1), mat(0xffffff, { map: t }));
    m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
    m.castShadow = m.receiveShadow = true;
    world.add(m); w.mesh = m;
  }
  return w;
}
function addPillar(x, z, h = 6, r = 0.7, broken = false) {
  const hh = broken ? h * rand(0.3, 0.7) : h;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, hh, 10), mat(0x6a655c, { map: wallTex }));
  m.position.set(x, hh / 2, z); m.castShadow = m.receiveShadow = true;
  world.add(m);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.4, 0.4, r * 2.4), mat(0x5a554c));
  cap.position.set(x, 0.2, z); world.add(cap);
  walls.push({ x1: x - r, z1: z - r, x2: x + r, z2: z + r, active: true });
}
function addGrave(x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.2), mat(0x55524c));
  m.position.set(x, 0.5, z); m.rotation.set(rand(-0.15, 0.15), rand(-0.4, 0.4), rand(-0.15, 0.15));
  m.castShadow = true; world.add(m);
}
function addTree(x, z) {
  const g = new THREE.Group();
  const bark = mat(0x2a2018);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 5, 6), bark);
  trunk.position.y = 2.5; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, rand(1.5, 2.5), 4), bark);
    b.position.y = rand(3, 4.8); b.rotation.set(rand(-1.2, 1.2), rand(0, TAU), rand(-1.2, 1.2));
    g.add(b);
  }
  g.traverse(o => o.castShadow = true);
  g.position.set(x, 0, z); world.add(g);
}
function addTorch(x, z, y = 3.2) {
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6), mat(0x222222));
  holder.position.set(x, y, z); world.add(holder);
  const fire = glowSprite(0xff8a30, 1.2); fire.position.set(x, y + 0.45, z); world.add(fire);
  const l = new THREE.PointLight(0xff8a30, 18, 14, 1.8); l.position.set(x, y + 0.5, z); world.add(l);
  flickers.push({ light: l, sprite: fire, base: 18 });
}
const flickers = [];

function buildWorld() {
  // Asilo / pátio
  addGround(-20, -72, 20, 0);
  addWall(-22, -74, -20, 0); addWall(20, -74, 22, 0); addWall(-22, -74, 22, -72);
  addWall(-22, 0, -4, 2); addWall(4, 0, 22, 2);
  // cela inicial
  addWall(-6, -62, -1.5, -61, 5); addWall(1.5, -62, 6, -61, 5);
  addWall(-6, -72, -5, -62, 5); addWall(5, -72, 6, -62, 5);
  for (const z of [-48, -34, -20, -8]) { addPillar(-13, z, 7, 0.7, Math.random() < 0.3); addPillar(13, z, 7, 0.7, Math.random() < 0.3); }
  for (let i = 0; i < 14; i++) addGrave(rand(-18, -15) * (Math.random() < 0.5 ? 1 : -1), rand(-55, -5));
  addTree(-17, -26); addTree(17, -40); addTree(16, -12);
  addTorch(-19.6, -50); addTorch(19.6, -30); addTorch(-19.6, -5);

  // ponte sobre o abismo (sem paredes: dá para cair)
  addGround(-3.2, 0, 3.2, 40);
  for (let z = 2; z < 40; z += 4) {
    for (const x of [-3, 3]) {
      if (Math.random() < 0.35) continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, rand(0.4, 1.1), 0.35), mat(0x5a554c));
      p.position.set(x, 0.4, z); p.castShadow = true; world.add(p);
    }
  }

  // praça
  addGround(-18, 40, 18, 72);
  addWall(-20, 38, -3.2, 40); addWall(3.2, 38, 20, 40);
  addWall(-20, 38, -18, 74); addWall(18, 38, 20, 74);
  addWall(-20, 72, -3, 74, 9); addWall(3, 72, 20, 74, 9);
  for (const x of [-10, 10]) for (const z of [50, 62]) addPillar(x, z, 8, 0.8, Math.random() < 0.4);
  addTree(-15, 58); addTree(14, 47);
  addTorch(-17.6, 52); addTorch(17.6, 66);
  // estátua quebrada
  const st = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), mat(0x4a4640)); st.position.set(0, 0.5, 56); world.add(st);
  const fig = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.5, 8), mat(0x7a756a)); fig.position.set(0, 2.2, 56); fig.rotation.z = 0.2; fig.castShadow = true; world.add(fig);
  walls.push({ x1: -1, z1: 55, x2: 1, z2: 57, active: true });

  // arena do chefe
  addGround(-26, 72, 26, 132);
  addWall(-28, 72, -26, 134, 12); addWall(26, 72, 28, 134, 12); addWall(-28, 132, 28, 134, 12);
  addWall(-28, 72, -3, 74, 12); addWall(3, 72, 28, 74, 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    addPillar(Math.cos(a) * 21, 102 + Math.sin(a) * 24, 11, 1, i % 3 === 0);
  }
  for (let i = 0; i < 40; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, rand(0.3, 0.8)), mat(0xbdb3a0));
    b.position.set(rand(-24, 24), 0.05, rand(76, 130)); b.rotation.set(Math.PI / 2, 0, rand(0, TAU)); world.add(b);
  }
  addTorch(-25.6, 90); addTorch(25.6, 90); addTorch(-25.6, 118); addTorch(25.6, 118);

  // abismo
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x020203 }));
  abyss.rotation.x = -Math.PI / 2; abyss.position.y = -40; scene.add(abyss);
}
buildWorld();

const onGround = (x, z) => grounds.some(g => x >= g.x1 && x <= g.x2 && z >= g.z1 && z <= g.z2);
function resolveWalls(p, r) {
  for (const w of walls) {
    if (!w.active) continue;
    const cx = clamp(p.x, w.x1, w.x2), cz = clamp(p.z, w.z1, w.z2);
    let dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x += dx / d * (r - d); p.z += dz / d * (r - d);
    } else {
      const pens = [p.x - w.x1, w.x2 - p.x, p.z - w.z1, w.z2 - p.z];
      const m = Math.min(...pens), i = pens.indexOf(m);
      if (i === 0) p.x = w.x1 - r; else if (i === 1) p.x = w.x2 + r; else if (i === 2) p.z = w.z1 - r; else p.z = w.z2 + r;
    }
  }
}
const insideWall = p => walls.some(w => w.active && p.x > w.x1 && p.x < w.x2 && p.z > w.z1 && p.z < w.z2);

// ---------- áudio sintetizado ----------
let actx = null;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }
function tone(freq, dur, type = 'sine', vol = 0.2, slide = null) {
  if (!actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.2, freq = 1000, q = 1) {
  if (!actx) return;
  const t = actx.currentTime, len = Math.ceil(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = actx.createBufferSource(); s.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(actx.destination); s.start(t);
}
const sfx = {
  swing: () => noise(0.18, 0.25, 1800, 2),
  heavy: () => noise(0.3, 0.3, 900, 1.5),
  hit: () => { noise(0.12, 0.4, 400); tone(90, 0.15, 'square', 0.12, 50); },
  block: () => { tone(900, 0.25, 'square', 0.08, 600); tone(1350, 0.2, 'triangle', 0.06); },
  hurt: () => { tone(160, 0.25, 'sawtooth', 0.15, 70); noise(0.15, 0.3, 300); },
  roll: () => noise(0.3, 0.12, 400, 0.7),
  drink: () => { tone(500, 0.4, 'sine', 0.1, 800); tone(750, 0.5, 'sine', 0.08, 1100); },
  souls: () => { tone(880, 0.6, 'sine', 0.1); tone(1320, 0.8, 'sine', 0.07); },
  bonfire: () => { noise(1.2, 0.3, 500, 0.5); tone(220, 1.5, 'sine', 0.08, 330); },
  death: () => { tone(110, 2.5, 'sawtooth', 0.12, 40); tone(82, 3, 'sine', 0.15, 41); },
  roar: () => { tone(70, 1.4, 'sawtooth', 0.25, 45); noise(1.2, 0.3, 200, 0.6); },
  slam: () => { tone(55, 0.6, 'sine', 0.4, 30); noise(0.5, 0.4, 150, 0.5); },
  victory: () => { [440, 554, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'triangle', 0.08), i * 180)); },
  arrow: () => noise(0.1, 0.15, 3000, 3),
};

// ---------- modelos ----------
function buildHumanoid({ armor = 0x5a5650, skin = 0x7a6a58, cloth = 0x3a2a20, weapon = 'sword', shield = false, bow = false, helm = true, eyes = null, horns = false, scale = 1 }) {
  const mats = [];
  const M = (c, o) => { const m = mat(c, o); mats.push(m); return m; };
  const root = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 0.9; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -0.9; pivot.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const armorM = M(armor, { metalness: 0.5, roughness: 0.55 }), skinM = M(skin), clothM = M(cloth);
  const box = (w, h, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = true; return x; };

  const leg = side => {
    const g = new THREE.Group(); g.position.x = side * 0.17;
    const l = box(0.22, 0.95, 0.24, clothM); l.position.y = -0.47; g.add(l);
    const boot = box(0.24, 0.2, 0.32, armorM); boot.position.set(0, -0.88, 0.04); g.add(boot);
    hips.add(g); return g;
  };
  const legL = leg(-1), legR = leg(1);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = box(0.62, 0.72, 0.36, armorM); chest.position.y = 0.38; torso.add(chest);
  const skirt = box(0.66, 0.3, 0.4, clothM); skirt.position.y = 0.02; torso.add(skirt);
  const head = new THREE.Group(); head.position.y = 0.92; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skinM); skull.castShadow = true; head.add(skull);
  if (helm) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.36, 10), armorM); h.position.y = 0.03; h.castShadow = true; head.add(h);
    const slit = box(0.3, 0.035, 0.05, M(0x050505)); slit.position.set(0, 0.03, 0.2); head.add(slit);
  }
  if (eyes) for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035), new THREE.MeshBasicMaterial({ color: eyes }));
    e.position.set(s * 0.07, 0.03, 0.18); head.add(e);
  }
  if (horns) for (const s of [-1, 1]) {
    const hn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6), M(0xd8ccb0));
    hn.position.set(s * 0.17, 0.25, 0); hn.rotation.z = -s * 0.6; head.add(hn);
  }
  const arm = side => {
    const g = new THREE.Group(); g.position.set(side * 0.41, 0.66, 0);
    const a = box(0.17, 0.68, 0.17, armorM); a.position.y = -0.32; g.add(a);
    const pad = box(0.26, 0.16, 0.26, armorM); pad.position.y = 0.02; g.add(pad);
    torso.add(g); return g;
  };
  const armL = arm(-1), armR = arm(1);
  let blade = null;
  if (weapon === 'sword' || weapon === 'greatsword') {
    const len = weapon === 'greatsword' ? 1.6 : 1.05;
    const hilt = box(0.3, 0.05, 0.08, M(0x6a5020)); hilt.position.y = -0.7; armR.add(hilt);
    blade = box(0.07, len, 0.03, M(0xb8bcc4, { metalness: 0.9, roughness: 0.3 })); blade.position.y = -0.72 - len / 2; armR.add(blade);
  } else if (weapon === 'club') {
    blade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 1.9, 8), M(0x3a3028)); blade.position.y = -1.5; blade.castShadow = true; armR.add(blade);
  } else if (weapon === 'rusty') {
    blade = box(0.08, 0.8, 0.03, M(0x6a4a30, { metalness: 0.6 })); blade.position.y = -1.1; armR.add(blade);
  }
  if (shield) {
    const s = box(0.08, 0.66, 0.52, M(0x6a4a28, { metalness: 0.3 })); s.position.set(-0.12, -0.42, 0.05); armL.add(s);
    const boss = box(0.1, 0.16, 0.16, armorM); boss.position.set(-0.17, -0.42, 0.05); armL.add(boss);
  }
  if (bow) {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 4, 12, Math.PI), M(0x4a3420));
    b.position.set(0, -0.65, 0.15); b.rotation.set(0, Math.PI / 2, Math.PI / 2); armL.add(b);
  }
  root.scale.setScalar(scale);
  scene.add(root);
  return { root, pivot, hips, torso, head, armL, armR, legL, legR, mats, skinM };
}
function setFlash(model, v) { for (const m of model.mats) m.emissive.setRGB(v, v * 0.8, v * 0.6); }

// ---------- partículas ----------
const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
const sparks = [];
function burst(pos, color, n = 12, speed = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    scene.add(m);
    sparks.push({ m, v: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.5), rand(-1, 1)).multiplyScalar(speed), life: rand(0.3, 0.7) });
  }
}
function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt; s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt);
    if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); }
  }
}

// ---------- interativos: fogueiras, itens, mensagens ----------
const bonfires = [];
function addBonfire(x, z, name, lit = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 12), mat(0x2a2620)); ash.position.y = 0.12; g.add(ash);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9), mat(0xcfc4ac));
    b.position.set(Math.cos(i) * 0.4, 0.3, Math.sin(i) * 0.4); b.rotation.set(rand(-1.4, 1.4), rand(0, TAU), rand(-1.4, 1.4));
    g.add(b);
  }
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.03), mat(0x5a4a3a, { metalness: 0.7, roughness: 0.4 }));
  sword.position.y = 0.85; sword.rotation.z = 0.12; g.add(sword);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 4, 10), mat(0x3a2a1a)); coil.position.y = 0.9; coil.rotation.x = Math.PI / 2; g.add(coil);
  const fire = glowSprite(0xff7a20, 2.4); fire.position.y = 0.8; g.add(fire);
  const light = new THREE.PointLight(0xff8a30, 0, 20, 1.6); light.position.y = 1.4; g.add(light);
  const embers = [];
  for (let i = 0; i < 16; i++) { const e = glowSprite(0xffa040, 0.12); g.add(e); embers.push({ s: e, t: Math.random() }); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const bf = { pos: new THREE.Vector3(x, 0, z), name, lit, group: g, fire, light, embers };
  setBonfireLit(bf, lit);
  bonfires.push(bf);
  return bf;
}
function setBonfireLit(bf, lit) {
  bf.lit = lit; bf.fire.visible = lit; bf.embers.forEach(e => e.s.visible = lit);
  bf.light.intensity = lit ? 30 : 0;
}

const items = [];
function addItem(x, z, kind, label) {
  const s = glowSprite(kind === 'estus' ? 0xffb040 : 0xd0e0ff, 0.9);
  s.position.set(x, 0.5, z); scene.add(s);
  items.push({ pos: new THREE.Vector3(x, 0, z), kind, label, sprite: s, taken: false });
}
const messages = [];
function addMessage(x, z, text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(255,140,40,0.9)'; g.font = 'italic 34px serif';
  g.fillText('~ ' + text.slice(0, 10) + '... ~', 8, 42);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m);
  messages.push({ pos: new THREE.Vector3(x, 0, z), text });
}

// névoa do chefe
const fogMat = new THREE.MeshBasicMaterial({ color: 0xe8e8f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
const fogGate = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fogMat);
fogGate.position.set(0, 3, 73); scene.add(fogGate);
const fogWall = addWall(-3, 72.6, 3, 73.4, 6, false);

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

let spawnPoint = { pos: new THREE.Vector3(0, 0, -68), yaw: 0 };
let ngLevel = 0;

// ---------- inimigos ----------
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
  const mult = 1 + ngLevel * 0.6;
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
let bossDefeated = false;

const startBonfire = addBonfire(0, -57, 'Asilo dos Mortos-Vivos');
const plazaBonfire = addBonfire(-14, 45, 'Praça dos Esquecidos');
let finalBonfire = null;

addItem(-16, -60, 'souls', 'Alma de Morto-Vivo Perdido');
addItem(17, -2, 'estus', 'Fragmento de Estus');
addItem(-16, 69, 'souls', 'Alma de Cavaleiro');
addItem(15, 42, 'estus', 'Fragmento de Estus');
addMessage(0, -65, 'Tente rolar com Espaço — você fica invencível no início da rolagem.');
addMessage(2, -55, 'Fogueira adiante. Descanse, mas saiba: os mortos se levantam de novo.');
addMessage(0, -2, 'Abismo adiante. Cuidado com os pés.');
addMessage(2, 68, 'Névoa adiante... prepare-se. Use Q para travar a mira no inimigo.');
addMessage(-4, 46, 'Tente defender (botão direito) — mas a estamina acaba.');

// ---------- entrada ----------
const keys = {};
let mouseDX = 0, mouseDY = 0, lmb = false, rmb = false;
let buffered = null, bufferedT = 0;
const bufferAction = a => { buffered = a; bufferedT = 0.35; };
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (gameState !== 'play') return;
  if (e.code === 'Space') { bufferAction('roll'); e.preventDefault(); }
  if (e.code === 'KeyF') bufferAction('heavy');
  if (e.code === 'KeyR') bufferAction('drink');
  if (e.code === 'KeyQ') toggleLock();
  if (e.code === 'KeyE') interact();
});
addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousedown', e => {
  audio();
  if (gameState === 'play' && document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) { lmb = true; if (gameState === 'play') bufferAction('light'); }
  if (e.button === 1 && gameState === 'play') toggleLock();
  if (e.button === 2) rmb = true;
});
addEventListener('mouseup', e => { if (e.button === 0) lmb = false; if (e.button === 2) rmb = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && gameState === 'play') setGameState('pause');
});
$('pause').addEventListener('click', () => { setGameState('play'); canvas.requestPointerLock(); });

// ---------- câmera e mira ----------
let camYaw = 0, camPitch = 0.32, shake = 0;
let lockTarget = null;
function toggleLock() {
  if (lockTarget) { lockTarget = null; return; }
  let best = null, bestScore = Infinity;
  for (const e of enemies) {
    if (!e.alive || (e.cfg.boss && !e.active)) continue;
    const d = dist2d(e.pos, player.pos);
    if (d > 22) continue;
    const ang = Math.abs(wrap(yawTo(player.pos, e.pos) - camYaw));
    const score = d + ang * 8;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  lockTarget = best;
}

// ---------- HUD ----------
let gameState = 'title';
let menuOpen = null;
function setGameState(s) {
  gameState = s;
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
let areaTimer = null, currentArea = '';
function showArea(name) {
  if (name === currentArea) return;
  currentArea = name;
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
  if (lockTarget) {
    const p = lockTarget.pos.clone(); p.y = 1.3 * (lockTarget.cfg.model.scale || 1);
    p.project(camera);
    ret.classList.remove('hidden');
    ret.style.left = ((p.x + 1) / 2 * innerWidth) + 'px';
    ret.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
  } else ret.classList.add('hidden');
}

// ---------- interação ----------
let bloodstain = null; // { pos, souls, sprite }
let currentInteract = null;
function findInteract() {
  const p = player.pos;
  for (const bf of bonfires) if (dist2d(bf.pos, p) < 2.4) return { kind: 'bonfire', obj: bf, label: bf.lit ? 'Descansar na fogueira' : 'Acender fogueira' };
  for (const it of items) if (!it.taken && dist2d(it.pos, p) < 1.8) return { kind: 'item', obj: it, label: 'Pegar item' };
  if (bloodstain && dist2d(bloodstain.pos, p) < 1.8) return { kind: 'blood', label: 'Recuperar almas' };
  if (fogWall.active && !boss.active && Math.abs(p.x) < 3 && p.z > 70 && p.z < 72.6) return { kind: 'fog', label: 'Atravessar a névoa' };
  for (const m of messages) if (dist2d(m.pos, p) < 1.5) return { kind: 'msg', obj: m, label: 'Ler mensagem' };
  return null;
}
function interact() {
  if (!$('msgbox').classList.contains('hidden')) { $('msgbox').classList.add('hidden'); return; }
  if (player.state !== 'idle' || !currentInteract) return;
  const it = currentInteract;
  if (it.kind === 'bonfire') {
    const bf = it.obj;
    if (!bf.lit) { setBonfireLit(bf, true); sfx.bonfire(); banner('FOGUEIRA ACESA', 'gold'); }
    else if (bf === finalBonfire) { endGame(); return; }
    else rest(bf);
    spawnPoint = { pos: bf.pos.clone().add(new THREE.Vector3(0, 0, 1.8)), yaw: 0 };
  } else if (it.kind === 'item') {
    it.obj.taken = true; it.obj.sprite.visible = false;
    if (it.obj.kind === 'estus') { player.estusMax++; player.estus++; }
    else player.souls += it.obj.label.includes('Cavaleiro') ? 400 : 200;
    sfx.souls(); banner(it.obj.label.toUpperCase(), 'gold', 2200);
  } else if (it.kind === 'blood') {
    player.souls += bloodstain.souls; scene.remove(bloodstain.sprite); bloodstain = null;
    sfx.souls(); banner('ALMAS RECUPERADAS', 'gold', 2200);
  } else if (it.kind === 'fog') {
    player.state = 'fog'; player.t = 0; player.yaw = 0; lockTarget = null;
  } else if (it.kind === 'msg') {
    $('msgText').textContent = it.obj.text; $('msgbox').classList.remove('hidden');
  }
}
function rest(bf) {
  sfx.bonfire();
  player.hp = player.hpLag = maxHp(); player.st = maxSt(); player.estus = player.estusMax;
  resetWorld();
  lockTarget = null;
  document.exitPointerLock?.();
  setGameState('bonfire');
  refreshLevelUI();
}
function resetWorld() {
  for (const e of enemies) {
    if (e.cfg.boss) { if (!bossDefeated) resetEnemy(e); continue; }
    resetEnemy(e);
  }
  arrows.forEach(a => scene.remove(a.m)); arrows.length = 0;
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

// ---------- combate ----------
const arrows = [];
function hurtPlayer(dmg, src, heavy = false) {
  if (player.state === 'dead' || player.state === 'fog') return;
  if (player.state === 'roll' && player.t > 0.04 && player.t < 0.42) return; // i-frames
  dmg *= 1 + ngLevel * 0.4;
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
    shake = Math.max(shake, heavy ? 0.5 : 0.2);
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
  const souls = Math.round(e.cfg.souls * (1 + ngLevel));
  player.souls += souls;
  if (lockTarget === e) lockTarget = null;
  if (e.cfg.boss) {
    bossDefeated = true; fogWall.active = false; fogGate.visible = false;
    sfx.victory(); banner('GRANDE INIMIGO ABATIDO', 'gold', 5000);
    setTimeout(() => {
      finalBonfire = addBonfire(0, 108, 'Fim do Asilo');
      banner('UMA FOGUEIRA SURGIU', 'gold', 2500);
    }, 5500);
  }
}
function killPlayer() {
  if (player.state === 'dead') return;
  player.hp = 0; player.deaths++;
  setPlayerState('dead', {});
  lockTarget = null;
  sfx.death();
  banner('VOCÊ MORREU', 'death', 4200);
  if (bloodstain) { scene.remove(bloodstain.sprite); bloodstain = null; }
  if (player.souls > 0) {
    const p = onGround(player.pos.x, player.pos.z) && player.pos.y > -1 ? player.pos.clone() : player.lastSafe.clone();
    p.y = 0;
    const s = glowSprite(0x40ff70, 1.1); s.position.copy(p).setY(0.4); scene.add(s);
    bloodstain = { pos: p, souls: player.souls, sprite: s };
    player.souls = 0;
  }
  setTimeout(respawn, 4500);
}
function respawn() {
  player.pos.copy(spawnPoint.pos); player.pos.y = 0; player.vy = 0; player.yaw = spawnPoint.yaw; camYaw = player.yaw;
  player.hp = player.hpLag = maxHp(); player.st = maxSt(); player.estus = player.estusMax;
  setPlayerState('idle', {});
  player.model.pivot.rotation.set(0, 0, 0); player.model.pivot.position.y = 0.9;
  resetWorld();
}
function setPlayerState(s, data) { player.state = s; player.t = 0; player.data = { ...data, knock: player.data?.knock }; }

const PLAYER_ATTACKS = {
  light: { dur: 0.62, hitStart: 0.2, hitEnd: 0.34, cost: 18, mult: 1, range: 2.4, arc: 1.1, lunge: 2.5, combo: 0.42 },
  heavy: { dur: 1.05, hitStart: 0.48, hitEnd: 0.62, cost: 32, mult: 1.9, range: 2.7, arc: 1.0, lunge: 4, combo: 0.85 },
};

function updatePlayer(dt) {
  const p = player, st = p.state;
  p.t += dt;
  bufferedT -= dt; if (bufferedT <= 0) buffered = null;

  // entrada de movimento relativa à câmera
  let ix = 0, iz = 0;
  if (keys.KeyW) iz += 1; if (keys.KeyS) iz -= 1; if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1;
  const fw = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
  const rt = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
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
    if (buffered && canAct(buffered)) {
      const a = buffered; buffered = null;
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
        if (lockTarget) p.yaw = yawTo(p.pos, lockTarget.pos); else if (moving) p.yaw = Math.atan2(move.x, move.z);
        (a === 'heavy' ? sfx.heavy : sfx.swing)();
        setPlayerState('attack', { kind: a, atk, hit: new Set(), sound: false });
      }
    } else {
      p.blocking = rmb && p.st > 0;
      sprinting = (keys.ShiftLeft || keys.ShiftRight) && moving && p.st > 0 && !p.blocking;
      const speed = p.blocking ? 1.8 : sprinting ? 6.2 : 3.8;
      if (moving) p.pos.addScaledVector(move, speed * dt);
      if (sprinting) { p.st -= 14 * dt; p.stDelay = 0.4; }
      let desired = p.yaw;
      if (lockTarget && !sprinting) desired = yawTo(p.pos, lockTarget.pos);
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
        hitStop = 0.06;
      }
    }
    if (p.state !== 'attack') { /* interrompido */ }
    else if (p.t > atk.combo && buffered && (buffered === 'light' || buffered === 'heavy' || buffered === 'roll') && p.st > 0) { p.state = 'idle'; }
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
      boss.active = true; boss.aggro = true; sfx.roar(); shake = 0.6;
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
    if (!onGround(p.pos.x, p.pos.z)) { setPlayerState('falling', {}); p.vy = 0; lockTarget = null; }
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

function animatePlayer(dt) {
  const p = player, m = p.model;
  m.root.position.copy(p.pos);
  m.root.rotation.y = p.yaw;
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
    e.phase2 = true; sfx.roar(); shake = 0.6;
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
        if (a.slam) { sfx.slam(); shake = Math.max(shake, 0.7); burst(e.pos.clone().add(fwd().multiplyScalar(a.jump ? 0 : 3.5)).setY(0.2), 0x8a7a60, 30, 7); }
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

// ---------- câmera ----------
function updateCamera(dt) {
  const sens = 0.0025;
  if (!lockTarget) {
    camYaw -= mouseDX * sens;
    camPitch = clamp(camPitch + mouseDY * sens, -0.15, 1.1);
  }
  if (keys.ArrowLeft) camYaw += 2.2 * dt; if (keys.ArrowRight) camYaw -= 2.2 * dt;
  if (keys.ArrowUp) camPitch = clamp(camPitch - 1.5 * dt, -0.15, 1.1); if (keys.ArrowDown) camPitch = clamp(camPitch + 1.5 * dt, -0.15, 1.1);
  mouseDX = mouseDY = 0;
  if (lockTarget) {
    if (!lockTarget.alive || dist2d(lockTarget.pos, player.pos) > 26) lockTarget = null;
    else {
      camYaw = lerpAngle(camYaw, yawTo(player.pos, lockTarget.pos), Math.min(1, 6 * dt));
      camPitch = lerp(camPitch, lockTarget.cfg.boss ? 0.15 : 0.3, Math.min(1, 3 * dt));
    }
  }
  const dist = boss.active && boss.alive ? 7.5 : 5.2;
  const focus = player.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  if (player.state === 'falling') focus.y = Math.max(focus.y, -2);
  const off = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch)).multiplyScalar(dist);
  const camPos = focus.clone().add(off);
  // evita a câmera atravessar paredes: aproxima até achar espaço livre
  for (let k = 0.1; k <= 1.001; k += 0.1) {
    const probe = focus.clone().addScaledVector(off, k);
    if (insideWall(probe)) { camPos.copy(focus).addScaledVector(off, Math.max(0.12, k - 0.15)); break; }
  }
  camera.position.lerp(camPos, Math.min(1, 14 * dt));
  if (shake > 0) {
    camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.3));
    shake = Math.max(0, shake - dt * 1.5);
  }
  const look = lockTarget ? focus.clone().lerp(lockTarget.pos.clone().setY(1.2 * (lockTarget.cfg.model.scale || 1)), 0.35) : focus;
  camera.lookAt(look);
  moon.position.copy(player.pos).add(new THREE.Vector3(-15, 30, -10));
  moon.target.position.copy(player.pos);
}

// ---------- fim de jogo ----------
let startTime = 0;
function endGame() {
  const secs = Math.round((performance.now() - startTime) / 1000);
  $('endStats').innerHTML = `Tempo: ${Math.floor(secs / 60)}m ${secs % 60}s · Mortes: ${player.deaths} · Inimigos abatidos: ${player.kills} · Nível: ${level()}`;
  document.exitPointerLock?.();
  setGameState('ending');
}
$('ngPlus').addEventListener('click', () => {
  ngLevel++;
  bossDefeated = false; fogWall.active = true; fogGate.visible = true;
  if (finalBonfire) { scene.remove(finalBonfire.group); bonfires.splice(bonfires.indexOf(finalBonfire), 1); finalBonfire = null; }
  bonfires.forEach(b => setBonfireLit(b, false));
  items.forEach(i => { i.taken = false; i.sprite.visible = true; });
  spawnPoint = { pos: new THREE.Vector3(0, 0, -68), yaw: 0 };
  respawn(); currentArea = '';
  setGameState('play'); canvas.requestPointerLock();
  banner(`JORNADA NOVA+${ngLevel}`, 'gold');
});

$('startBtn').addEventListener('click', () => {
  audio();
  startTime = performance.now();
  setGameState('play');
  canvas.requestPointerLock();
  setTimeout(() => banner('DESPERTAR', 'gold', 2500), 300);
});

// ---------- loop ----------
let last = performance.now(), hitStop = 0, elapsed = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  elapsed += dt;
  if (gameState === 'play') {
    if (hitStop > 0) { hitStop -= dt; dt *= 0.15; }
    updatePlayer(dt);
    for (const e of enemies) updateEnemy(e, dt);
    updateArrows(dt);
    currentInteract = player.state === 'idle' ? findInteract() : null;
    const pr = $('prompt');
    pr.classList.toggle('show', !!currentInteract);
    if (currentInteract) pr.textContent = '[E] ' + currentInteract.label;
    updateHUD(dt);
  }
  if (gameState === 'title') { camYaw += dt * 0.08; camPitch = 0.25; }
  updateSparks(dt);
  // fogo das fogueiras e tochas
  for (const bf of bonfires) {
    if (!bf.lit) continue;
    bf.light.intensity = 26 + Math.sin(elapsed * 13) * 3 + Math.random() * 4;
    bf.fire.scale.setScalar(2.2 + Math.sin(elapsed * 9) * 0.2 + Math.random() * 0.15);
    for (const em of bf.embers) {
      em.t += dt * 0.6; if (em.t > 1) em.t = 0;
      const a = em.t * 9 + em.s.id;
      em.s.position.set(Math.sin(a) * 0.3 * (1 - em.t), 0.5 + em.t * 2.6, Math.cos(a) * 0.3 * (1 - em.t));
      em.s.material.opacity = 1 - em.t;
    }
  }
  for (const f of flickers) { f.light.intensity = f.base * (0.85 + Math.random() * 0.3); f.sprite.scale.setScalar(1.1 + Math.random() * 0.25); }
  items.forEach(i => { if (!i.taken) i.sprite.position.y = 0.5 + Math.sin(elapsed * 3 + i.pos.x) * 0.12; });
  if (bloodstain) bloodstain.sprite.material.opacity = 0.7 + Math.sin(elapsed * 4) * 0.3;
  fogMat.opacity = 0.45 + Math.sin(elapsed * 2) * 0.1;
  updateCamera(dt);
  renderer.render(scene, camera);
}
setGameState('title');
camera.position.set(0, 3, -75);
requestAnimationFrame(frame);

// gancho para testes automatizados
window.__game = { player, enemies, boss, setGameState, hurtPlayer, killPlayer, interact, bufferAction, keys, get state() { return gameState; } };
