import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { rand } from '../utils.js';

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
export { sparks, burst, updateSparks };
