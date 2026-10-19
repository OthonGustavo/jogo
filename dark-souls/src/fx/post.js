import * as THREE from '../../vendor/three.module.min.js';
import {
  EffectComposer, RenderPass, EffectPass, SMAAEffect, BloomEffect, VignetteEffect, ToneMappingEffect,
  ToneMappingMode, Effect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { renderer, scene, camera } from '../core/renderer.js';
import { updateFire, setFireQuality } from './particles.js';
import { initFog, updateFog, setFogVisible } from './fog.js';

// Pós-processamento "Dark Souls": AO (N8AO), bloom leve (só o que passa de luminância alta = fogo),
// correção de cor fria/dessaturada, vinheta, ACES e SMAA. Qualidade 'low' = render direto, sem nada disso.
// Duas libs vendorizadas (vendor/postprocessing.js, vendor/n8ao.js) e UMA instância de three
// (importmap no index.html; alias no esbuild em tools/build-single.mjs).

// Grade de cor procedural: dessatura, esfria as sombras, esquenta levemente as altas luzes.
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= 1.75; l *= 1.75;                                          // exposição (substitui o toneMappingExposure)
        c = mix(vec3(l), c, 0.72);                                  // dessaturação
        c = mix(c, c * vec3(0.84, 0.95, 1.14), 1.0 - smoothstep(0.0, 0.45, l)); // sombras frias
        c = mix(c, c * vec3(1.08, 1.0, 0.9), smoothstep(0.35, 1.4, l));          // luzes quentes
        c = (c - 0.5) * 1.06 + 0.5 + 0.012;                         // contraste leve
        outputColor = vec4(max(c, 0.0), inputColor.a);
      }`, { blendFunction: BlendFunction.NORMAL });
  }
}

let composer = null, ao = null, quality = 'high';
let fpsOn = false, fpsEl = null, frames = 0, fpsT = performance.now(), fps = 0, last = performance.now(), clock = 0;
let calls = 0, tris = 0;

function buildComposer() {
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
  const c = ao.configuration;
  c.aoRadius = 2.2; c.distanceFalloff = 1.0; c.intensity = 2.0; c.aoSamples = 8; c.denoiseSamples = 4; c.denoiseRadius = 10;
  c.halfRes = true; c.gammaCorrection = false; c.transparencyAware = false;
  composer.addPass(ao);
  const bloom = new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.85, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.7 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, bloom, new GradeEffect(), new VignetteEffect({ offset: 0.3, darkness: 0.5 }), tone));
  composer.addPass(new EffectPass(camera, new SMAAEffect()));
}

export function initPost() {
  initFog();
  buildComposer();
  setQuality(quality);
  addEventListener('resize', () => { applySize(); });
  addEventListener('keydown', e => {
    if (e.code !== 'F3') return;
    e.preventDefault(); fpsOn = !fpsOn; setQuality(quality === 'high' ? 'low' : 'high'); showFps();
  });
}

function applySize() {
  if (composer) composer.setSize(innerWidth, innerHeight, false);
}
function showFps() {
  if (!fpsEl) {
    fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:fixed;right:8px;bottom:6px;font:11px monospace;color:#9a9;opacity:.7;pointer-events:none;z-index:50';
    document.body.appendChild(fpsEl);
  }
  fpsEl.style.display = fpsOn ? 'block' : 'none';
}

export function setQuality(q) {
  quality = q === 'low' ? 'low' : 'high';
  const high = quality === 'high';
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : 1);
  renderer.setSize(innerWidth, innerHeight);
  // com pós-processamento o ACES é aplicado no efeito; no modo low, pelo próprio renderer
  renderer.toneMapping = high ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = high ? 1 : 1.25;
  setFireQuality(quality);
  setFogVisible(high);
  if (composer) { composer.setSize(innerWidth, innerHeight, false); }
  if (ao) ao.enabled = high;
}

export function getStats() {
  return { quality, fps: Math.round(fps), drawCalls: calls, triangles: tris, pixelRatio: renderer.getPixelRatio() };
}
export const fx = { setQuality, getStats };
window.fx = fx;

let started = false;
export function renderFrame() {
  if (!started) { started = true; initPost(); }
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now; clock += dt;
  updateFire(dt, camera, renderer.getPixelRatio());
  updateFog(clock, camera);
  renderer.info.reset();
  if (quality === 'high' && composer) composer.render(dt);
  else renderer.render(scene, camera);
  calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
  frames++;
  if (now - fpsT >= 500) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; if (fpsOn && fpsEl) fpsEl.textContent = `${quality} ${fps.toFixed(0)} fps · ${calls} dc`; }
}
