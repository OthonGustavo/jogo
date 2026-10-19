import * as THREE from '../../vendor/three.module.min.js';
import { rand } from '../utils.js';

// Texturas procedurais e materiais comuns.
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
export { stoneTexture, glowTexture, floorTex, wallTex, glowTex, mat, glowSprite };
