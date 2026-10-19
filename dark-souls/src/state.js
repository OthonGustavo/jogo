import * as THREE from '../vendor/three.module.min.js';

// Estado mutável compartilhado entre os módulos. Bindings importados não podem ser
// reatribuídos fora do módulo que os declara, então tudo que muda vive aqui (S.x).
export const S = {
  gameState: 'title',     // 'title' | 'play' | 'pause' | 'bonfire' | 'ending'
  lockTarget: null,       // inimigo com a mira travada
  camYaw: 0, camPitch: 0.32, shake: 0,
  mouseDX: 0, mouseDY: 0, lmb: false, rmb: false,
  buffered: null, bufferedT: 0,   // buffer de ação (rolar/atacar/beber)
  hitStop: 0,
  bloodstain: null,       // { pos, souls, sprite }
  currentInteract: null,
  currentArea: '',
  spawnPoint: { pos: new THREE.Vector3(0, 0, -68), yaw: 0 },
  ngLevel: 0,
  bossDefeated: false,
  finalBonfire: null,
  startTime: 0,
};
