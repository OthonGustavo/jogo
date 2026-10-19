import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';

// Névoa baixa: 3 planos transparentes com ruído, centrados na câmera e "ancorados" ao mundo
// pelo deslocamento da textura (parecem fixos no chão e derivam devagar).
function noiseTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const grid = Array.from({ length: 9 * 9 }, () => Math.random());
  const v = (x, y) => grid[(y % 8) * 9 + (x % 8)]; // 8x8 periódico
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, amp = 0.55, f = 8;
    for (let o = 0; o < 3; o++, f *= 2, amp *= 0.5) {
      // interpolação bilinear periódica
      const gx = (x / N) * f, gy = (y / N) * f, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
      const h = (i, j) => { const r = Math.sin((i % f) * 127.1 + (j % f) * 311.7 + o * 74.7) * 43758.5453; return r - Math.floor(r); };
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      a += amp * ((h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx) * (1 - sy) + (h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx) * sy);
    }
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 200; img.data[i + 3] = Math.max(0, Math.min(255, (a - 0.25) * 420));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SIZE = 70, TILE = 28; // plano de 70 m; a textura repete a cada 28 m
const layers = [];
let group = null;
function initFog() {
  group = new THREE.Group(); group.name = 'fog-layers';
  const tex = noiseTexture();
  [0.25, 0.7, 1.3].forEach((y, i) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(SIZE / TILE, SIZE / TILE);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE),
      new THREE.MeshBasicMaterial({ map: t, color: 0x7d8aa0, transparent: true, opacity: 0.11 - i * 0.025, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 4; m.frustumCulled = false;
    group.add(m); layers.push({ m, t, sp: 0.35 + i * 0.25, dir: i % 2 ? 1 : -1 });
  });
  scene.add(group);
}
function updateFog(time, camera) {
  if (!group) return;
  const cx = Math.round(camera.position.x), cz = Math.round(camera.position.z);
  for (const l of layers) {
    l.m.position.x = cx; l.m.position.z = cz;
    l.t.offset.set((cx / TILE) % 1 + (time * l.sp * l.dir) / TILE, -(cz / TILE) % 1 + (time * l.sp * 0.6) / TILE);
  }
}
function setFogVisible(v) { if (group) group.visible = v; }
export { initFog, updateFog, setFogVisible };
