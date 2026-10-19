import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { mat } from '../world/materials.js';

// Modelos procedurais de humanoides (jogador, inimigos, chefe).
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
export { buildHumanoid, setFlash };
