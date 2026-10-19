import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { mat, floorTex, wallTex, glowSprite } from './materials.js';
import { createFire } from '../fx/particles.js';
import { TAU, clamp, rand } from '../utils.js';

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
  const fire = createFire(x, y + 0.35, z, 0.55);
  const l = new THREE.PointLight(0xff8a30, 18, 14, 1.8); l.position.set(x, y + 0.5, z); world.add(l);
  flickers.push({ light: l, fire, base: 18 });
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
export { grounds, walls, world, addGround, addWall, addPillar, addGrave, addTree, addTorch, flickers, buildWorld, onGround, resolveWalls, insideWall };
