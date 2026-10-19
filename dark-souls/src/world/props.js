import * as THREE from '../../vendor/three.module.min.js';
import { scene } from '../core/renderer.js';
import { mat, glowSprite } from './materials.js';
import { addWall } from './level.js';
import { createFire } from '../fx/particles.js';
import { TAU, rand } from '../utils.js';

const bonfires = [];
function addBonfire(x, z, name, lit = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 12), mat(0x2a2620)); ash.position.y = 0.12; g.add(ash);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9), mat(0xcfc4ac));
    b.position.set(Math.cos(i) * 0.4, 0.3, Math.sin(i) * 0.4); b.rotation.set(rand(-1.4, 1.4), rand(0, TAU), rand(-1.4, 1.4));
    g.add(b);
  }
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.03), mat(0x5a4a3a, { metalness: 0.7, roughness: 0.4 }));
  sword.position.y = 0.85; sword.rotation.z = 0.12; g.add(sword);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 4, 10), mat(0x3a2a1a)); coil.position.y = 0.9; coil.rotation.x = Math.PI / 2; g.add(coil);
  const fire = createFire(x, 0.55, z, 1.25); // chama em partículas (fx/particles.js); .visible liga/desliga
  const light = new THREE.PointLight(0xff8a30, 0, 20, 1.6); light.position.y = 1.4; g.add(light);
  const embers = []; // brasas agora fazem parte do sistema de partículas
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const bf = { pos: new THREE.Vector3(x, 0, z), name, lit, group: g, fire, light, embers };
  setBonfireLit(bf, lit);
  bonfires.push(bf);
  return bf;
}
function setBonfireLit(bf, lit) {
  bf.lit = lit; bf.fire.visible = lit; bf.embers.forEach(e => e.s.visible = lit);
  bf.light.intensity = lit ? 30 : 0;
}

const items = [];
function addItem(x, z, kind, label) {
  const s = glowSprite(kind === 'estus' ? 0xffb040 : 0xd0e0ff, 0.9);
  s.position.set(x, 0.5, z); scene.add(s);
  items.push({ pos: new THREE.Vector3(x, 0, z), kind, label, sprite: s, taken: false });
}
const messages = [];
function addMessage(x, z, text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(255,140,40,0.9)'; g.font = 'italic 34px serif';
  g.fillText('~ ' + text.slice(0, 10) + '... ~', 8, 42);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m);
  messages.push({ pos: new THREE.Vector3(x, 0, z), text });
}

// névoa do chefe
const fogMat = new THREE.MeshBasicMaterial({ color: 0xe8e8f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
const fogGate = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fogMat);
fogGate.position.set(0, 3, 73); scene.add(fogGate);
const fogWall = addWall(-3, 72.6, 3, 73.4, 6, false);

// colocação inicial: fogueiras, itens e mensagens
const startBonfire = addBonfire(0, -57, 'Asilo dos Mortos-Vivos');
const plazaBonfire = addBonfire(-14, 45, 'Praça dos Esquecidos');
addItem(-16, -60, 'souls', 'Alma de Morto-Vivo Perdido');
addItem(17, -2, 'estus', 'Fragmento de Estus');
addItem(-16, 69, 'souls', 'Alma de Cavaleiro');
addItem(15, 42, 'estus', 'Fragmento de Estus');
addMessage(0, -65, 'Tente rolar com Espaço — você fica invencível no início da rolagem.');
addMessage(2, -55, 'Fogueira adiante. Descanse, mas saiba: os mortos se levantam de novo.');
addMessage(0, -2, 'Abismo adiante. Cuidado com os pés.');
addMessage(2, 68, 'Névoa adiante... prepare-se. Use Q para travar a mira no inimigo.');
addMessage(-4, 46, 'Tente defender (botão direito) — mas a estamina acaba.');
export { bonfires, addBonfire, setBonfireLit, items, addItem, messages, addMessage, fogMat, fogGate, fogWall };
