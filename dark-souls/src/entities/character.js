import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { instance } from '../assets/loader.js';
import { Animator } from '../anim/animator.js';

// Personagem com modelo glTF. Devolve null se o asset não carregou (o chamador cai no humanoide de primitivas).
// `height`: altura alvo em metros; `tint`: multiplica a cor (clona os materiais por instância).
export function buildCharacter(key, { height = 1.8, tint = null, scale = 1, map } = {}) {
  const inst = instance(key);
  if (!inst) return null;
  const root = new THREE.Group();
  const holder = new THREE.Group(); // recebe a escala de normalização
  holder.add(inst.scene); root.add(holder);
  const mats = [];
  inst.scene.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true;
    const clone = m => {
      const c = m.clone();
      if (tint) c.color.multiply(tint);
      if (c.emissive) { c.emissive.setRGB(0, 0, 0); mats.push(c); }
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
  });
  inst.scene.updateMatrixWorld(true);
  const h = new THREE.Box3().setFromObject(inst.scene).getSize(new THREE.Vector3()).y || 1;
  const s = (height * scale) / h;
  holder.scale.setScalar(s);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.y -= box.min.y; // pés no chão
  scene.add(root);
  const anim = new Animator(inst.scene, inst.animations, map);
  anim.play('idle');
  return { root, pivot: new THREE.Group(), mats, skinM: null, anim, rigged: true, rawHeight: h };
}
