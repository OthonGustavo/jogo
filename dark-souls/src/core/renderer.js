import * as THREE from '../../vendor/three.module.min.js';
import { $ } from '../utils.js';

// Renderer, cena, câmera e luzes base.
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15; // no modo 'high' o tone mapping passa para o pós-processamento (fx/post.js)
renderer.info.autoReset = false; // post.js zera por quadro, para contar draw calls de todas as passadas

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
// frustum menor (a luz segue o jogador) = mais texels por metro; normalBias evita acne sem 'peter-panning'
Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
moon.shadow.bias = -0.0003;
moon.shadow.normalBias = 0.04;
scene.add(moon, moon.target);
export { canvas, renderer, scene, camera, moon };
