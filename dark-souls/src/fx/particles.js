import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { rand, TAU } from '../utils.js';
import { glowTex } from '../world/materials.js';

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

// ---------- Fogo em partículas (chama + brasas aditivas, fumaça normal) ----------
// Dois THREE.Points no total (2 draw calls) para TODAS as fogueiras/tochas.
// Emissores: createFire(x,y,z,escala) -> { visible, ... }; o resto é automático.
const MAXF = 1400, MAXS = 220; // chama/brasa, fumaça
const fireVert = `
  attribute float aSize; attribute vec4 aColor; varying vec4 vC; varying float vFog;
  uniform float uScale; uniform float uFog;
  void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.);
    gl_PointSize = aSize * uScale / -mv.z; vFog = exp(-uFog*uFog*mv.z*mv.z); gl_Position = projectionMatrix * mv; }`;
const fireFrag = `
  uniform sampler2D uMap; varying vec4 vC; varying float vFog;
  void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a * vFog) * vec4(vec3(1.), 1.); }`;
function makePoints(max, blending) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: fireVert, fragmentShader: fireFrag, transparent: true, depthWrite: false, blending,
    uniforms: { uMap: { value: glowTex }, uScale: { value: 600 }, uFog: { value: 0.028 } },
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 5; scene.add(p);
  return p;
}
const flamePts = makePoints(MAXF, THREE.AdditiveBlending);
const smokePts = makePoints(MAXS, THREE.NormalBlending);
const flame = [], smoke = [];
const emitters = [];
let fireDensity = 1; // 'low' reduz partículas e some com a fumaça
function createFire(x, y, z, scale = 1) {
  const e = { x, y, z, scale, visible: true, acc: 0, accS: 0 };
  emitters.push(e); return e;
}
function removeFire(e) { const i = emitters.indexOf(e); if (i >= 0) emitters.splice(i, 1); }
function setFireQuality(q) { fireDensity = q === 'low' ? 0.35 : 1; smokePts.visible = q !== 'low'; }
const _cam = new THREE.Vector3();
function updateFire(dt, camera, pixelRatio) {
  const h = innerHeight * pixelRatio;
  flamePts.material.uniforms.uScale.value = smokePts.material.uniforms.uScale.value = h / (2 * Math.tan(camera.fov * Math.PI / 360));
  if (scene.fog) flamePts.material.uniforms.uFog.value = smokePts.material.uniforms.uFog.value = scene.fog.density;
  camera.getWorldPosition(_cam);
  for (const e of emitters) {
    if (!e.visible) continue;
    if (_cam.distanceToSquared({ x: e.x, y: e.y, z: e.z }) > 70 * 70) continue; // longe demais: não emite
    e.acc += dt * 55 * e.scale * fireDensity;
    while (e.acc >= 1 && flame.length < MAXF) {
      e.acc -= 1;
      const ember = Math.random() < 0.14;
      const r = rand(0, 0.22) * e.scale, a = rand(0, TAU);
      flame.push({ x: e.x + Math.cos(a) * r, y: e.y + rand(0, 0.15), z: e.z + Math.sin(a) * r,
        vx: rand(-0.15, 0.15), vy: ember ? rand(0.9, 2.2) : rand(0.8, 1.6) * Math.sqrt(e.scale), vz: rand(-0.15, 0.15),
        life: ember ? rand(1.4, 2.8) : rand(0.5, 0.95), age: 0, ember, s: ember ? rand(0.07, 0.13) : rand(0.7, 1.1) * e.scale, ph: rand(0, TAU) });
    }
    e.accS += dt * 4 * e.scale * fireDensity;
    while (e.accS >= 1 && smoke.length < MAXS && smokePts.visible) {
      e.accS -= 1;
      smoke.push({ x: e.x + rand(-0.1, 0.1), y: e.y + 0.9 * e.scale, z: e.z + rand(-0.1, 0.1), vx: rand(-0.1, 0.1), vy: rand(0.5, 0.9), vz: rand(-0.1, 0.1), life: rand(2, 3.2), age: 0, s: rand(0.8, 1.2) * e.scale });
    }
    e.accS = Math.min(e.accS, 2); e.acc = Math.min(e.acc, 4);
  }
  fill(flamePts, flame, dt, false);
  fill(smokePts, smoke, dt, true);
}
function fill(pts, list, dt, isSmoke) {
  const pos = pts.geometry.attributes.position.array, sz = pts.geometry.attributes.aSize.array, col = pts.geometry.attributes.aColor.array;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.age += dt;
    if (p.age >= p.life) { list[i] = list[list.length - 1]; list.pop(); }
  }
  for (const p of list) {
    const k = p.age / p.life;
    p.x += (p.vx + Math.sin(p.age * 5 + p.ph) * 0.12) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(p.age * 4 + p.ph) * 0.12) * dt;
    if (!isSmoke && !p.ember) p.vy *= 1 - 0.6 * dt;
    pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
    if (isSmoke) { sz[n] = p.s * (1 + k * 2.2); col[n * 4] = col[n * 4 + 1] = col[n * 4 + 2] = 0.16; col[n * 4 + 3] = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.2)); }
    else if (p.ember) { sz[n] = p.s * (1 - k * 0.5); col[n * 4] = 1; col[n * 4 + 1] = 0.55 - k * 0.3; col[n * 4 + 2] = 0.12; col[n * 4 + 3] = (1 - k) * (0.7 + Math.random() * 0.3); }
    else { sz[n] = p.s * (1 - k * 0.75); col[n * 4] = 1; col[n * 4 + 1] = 0.62 - k * 0.42; col[n * 4 + 2] = 0.14 - k * 0.1; col[n * 4 + 3] = 0.26 * Math.sin(Math.PI * Math.min(1, 0.15 + k * 0.85)) ; }
    n++;
  }
  pts.geometry.setDrawRange(0, n);
  for (const a of ['position', 'aSize', 'aColor']) pts.geometry.attributes[a].needsUpdate = true;
}
export { createFire, removeFire, setFireQuality, updateFire, flame, smoke };
