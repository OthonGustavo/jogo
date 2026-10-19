// Arte do cenário: troca as primitivas de level.js/props.js pelas peças glTF (Dungeon KayKit + props do Blender).
// Só muda a APRESENTAÇÃO — colisões (grounds/walls) não são tocadas. Cada categoria tem fallback:
// se o asset não carregar (ou algo der erro), o grupo de primitivas correspondente continua na cena.
// Peças repetidas viram InstancedMesh (1 draw call por tipo de peça).
import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { loadManifest, loadAll, get, instance } from '../assets/loader.js';
import { world, prim, data, grounds } from './level.js';
import { bonfires, artBonfire, fogGate } from './props.js';

const PECAS = ['wall', 'wall_cracked', 'floor_tile_large', 'pillar', 'torch_mounted', 'banner_red', 'barrel_large', 'crates_stacked', 'box_large', 'rubble_large'].map(k => 'dungeon_' + k)
  .concat(['broken_pillar', 'gravestone', 'gothic_arch', 'fog_gate', 'ruined_statue', 'bonfire'].map(k => 'gen_' + k));

const dummy = new THREE.Object3D();
let batches = new Map(); // chave -> { geo, material, list, cast }

// geometria da primeira malha da peça, com a transformação do nó já aplicada
function geoDe(key) {
  const a = get(key); if (!a) return null;
  a.scene.updateMatrixWorld(true);
  let m = null; a.scene.traverse(o => { if (o.isMesh && !m) m = o; });
  return m ? { geo: m.geometry.clone().applyMatrix4(m.matrixWorld), material: m.material } : null;
}
function place(key, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, cast = false) {
  let b = batches.get(key);
  if (!b) {
    const g = geoDe(key); if (!g) throw new Error('sem ' + key);
    if (key === 'dungeon_floor_tile_large') { g.material = g.material.clone(); g.material.color.setHex(0x7d7d82); } // piso menos claro
    b = { ...g, list: [], cast }; batches.set(key, b);
  }
  dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  b.list.push(dummy.matrix.clone());
}
function flush() {
  const objs = [];
  for (const b of batches.values()) {
    const im = new THREE.InstancedMesh(b.geo, b.material, b.list.length);
    b.list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = b.cast; im.receiveShadow = true; im.frustumCulled = false;
    objs.push(im);
  }
  batches = new Map();
  return objs;
}
// roda uma categoria: monta as peças; só se tudo der certo remove o grupo de primitivas
function categoria(nome, monta, grupo) {
  try {
    batches = new Map();
    monta();
    const objs = flush();
    objs.forEach(o => world.add(o));
    if (grupo) world.remove(grupo);
    return true;
  } catch (e) { console.warn('arte do cenário (' + nome + ') ficou nas primitivas:', e.message); batches = new Map(); }
  return false;
}
const hash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

function aplicar() {
  // chão: tiles 4x4 esticados para cobrir exatamente cada retângulo (topo em y=0)
  const chaoOk = categoria('chão', () => {
    for (const g of grounds) {
      const w = g.x2 - g.x1, d = g.z2 - g.z1, nx = Math.ceil(w / 4), nz = Math.ceil(d / 4);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
        place('dungeon_floor_tile_large', g.x1 + (i + 0.5) * w / nx, -0.05, g.z1 + (j + 0.5) * d / nz, 0, 1.08 * w / nx / 4, 1, 1.08 * d / nz / 4);
    }
  }, null);
  if (chaoOk) prim.floor.position.y = -0.15; // base escura sob os tiles (cobre os cantos chanfrados)

  // paredes: módulos de 4 m esticados ao comprimento/altura/espessura de cada AABB
  categoria('paredes', () => {
    for (const w of data.walls) {
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1, horiz = dx >= dz;
      const len = horiz ? dx : dz, t = horiz ? dz : dx, n = Math.max(1, Math.round(len / 4)), step = len / n;
      for (let i = 0; i < n; i++) {
        const c = (horiz ? w.x1 : w.z1) + (i + 0.5) * step;
        const x = horiz ? c : (w.x1 + w.x2) / 2, z = horiz ? (w.z1 + w.z2) / 2 : c;
        const rach = hash(x, z) < 0.18, key = rach ? 'dungeon_wall_cracked' : 'dungeon_wall';
        place(key, x, -2, z, horiz ? 0 : Math.PI / 2, step / 4, (w.h + 2) / 4, t / (rach ? 1.26 : 1), true);
      }
    }
  }, prim.wall);

  // pilares: pilar KayKit esticado em altura; os "quebrados" usam o pilar quebrado do Blender
  categoria('pilares', () => {
    for (const p of data.pillars) {
      if (p.broken) place('gen_broken_pillar', p.x, 0, p.z, hash(p.x, p.z) * 6.28, 0.55 * p.r / 0.7, 0.55 * p.r / 0.7, 0.55 * p.r / 0.7, true);
      else place('dungeon_pillar', p.x, 0, p.z, 0, 2 * p.r / 1.5, p.h / 4, 2 * p.r / 1.5, true);
    }
  }, prim.pillar);

  // lápides: grupos de 3 (gravestone.glb) encostados nas laterais do pátio
  categoria('lápides', () => {
    data.graves.forEach((g, i) => {
      if (i % 3) return;
      const s = Math.sign(g.x) || 1;
      place('gen_gravestone', s * (15.8 + hash(g.z, 1) * 1.3), 0, g.z, -s * Math.PI / 2 + (hash(g.z, 2) - 0.5) * 0.4, 0.65, 0.65, 0.65);
    });
  }, prim.grave);

  // tochas: suporte KayKit na parede (luz e fogo continuam os de addTorch)
  categoria('tochas', () => {
    for (const t of data.torches) {
      const s = Math.sign(t.x);
      place('dungeon_torch_mounted', t.x + 0.4 * s, t.y, t.z, -s * Math.PI / 2, 1.1);
    }
  }, prim.torch);

  // estátua quebrada
  categoria('estátua', () => { if (data.statue) place('gen_ruined_statue', data.statue.x, 0, data.statue.z, Math.PI, 1.15, 1.15, 1.15, true); }, prim.statue);

  // arcos góticos nas entradas do pátio (z≈1) e da ponte/praça (z≈39); só decoração, sem colisão
  categoria('arcos', () => {
    place('gen_gothic_arch', 0, 0, 1, 0, 1.9, 1.35, 1.8, true);
    place('gen_gothic_arch', 0, 0, 39, 0, 1.5, 1.2, 1.8, true);
  });

  // decoração fora do caminho (cantos e paredes); sem colisão
  categoria('decoração', () => {
    const banner = (xf, z) => { const s = Math.sign(xf); place('dungeon_banner_red', xf + s * 0.5, 0.2, z, -s * Math.PI / 2 + 0 * s, 1.3); };
    [[-20, -38], [20, -44], [20, -16], [-20, -24], [-18, 62], [18, 54], [-18, 46], [26, 80], [-26, 80], [26, 104], [-26, 104]]
      .forEach(([x, z]) => banner(x, z));
    const d = (k, x, z, ry = 0, s = 1) => place(k, x, 0, z, ry, s, s, s);
    d('dungeon_crates_stacked', -18, -70, 0.6); d('dungeon_barrel_large', -16.2, -70.8); d('dungeon_barrel_large', -18.5, -67.6);
    d('dungeon_barrel_large', 18, -70.5); d('dungeon_box_large', 16.3, -70.2, 0.3);
    d('dungeon_crates_stacked', -17.2, 41.4, 2.4); d('dungeon_barrel_large', -15.6, 41);
    d('dungeon_barrel_large', 17.3, 71.2); d('dungeon_crates_stacked', 16, 71.2, 3.6, 0.9);
    d('dungeon_crates_stacked', -24, 130.4, 0.4); d('dungeon_barrel_large', 24, 130.5); d('dungeon_barrel_large', 22, 130.8);
    d('dungeon_rubble_large', -22, 77, 0.5, 0.5); d('dungeon_rubble_large', 21, 126, 2.5, 0.5);
  });

  // portão de névoa: só os montantes do glb; o plano de névoa continua sendo o fogGate de props.js (animado/ocultado pelo jogo)
  try {
    const a = instance('gen_fog_gate'); if (!a) throw new Error('sem gen_fog_gate');
    const rm = [];
    a.scene.traverse(o => { if (o.isMesh) { if (o.material.transparent) rm.push(o); else { o.castShadow = o.receiveShadow = true; } } });
    rm.forEach(o => o.parent.remove(o));
    a.scene.position.set(0, 0, 73); a.scene.scale.set(1.06, 1.06, 1.3);
    scene.add(a.scene);
  } catch (e) { console.warn('portão de névoa ficou sem moldura:', e.message); }

  bonfires.forEach(artBonfire);
}

export const levelArtReady = (async () => {
  try {
    const m = await loadManifest();
    await loadAll(m, PECAS.filter(k => m[k]));
    aplicar();
  } catch (e) { console.warn('arte do cenário não aplicada:', e.message); }
})();
