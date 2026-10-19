import { renderer, scene, camera } from '../core/renderer.js';

// Pós-processamento (bloom, SSAO, SMAA, vinheta, LUT) — Fase 1 "Render/FX".
// Esqueleto: por enquanto renderiza a cena direto, sem efeito nenhum.
// O loop principal chama renderFrame() em vez de renderer.render(), então os
// efeitos entram aqui (ex.: EffectComposer) sem mexer em mais nada.
export function initPost() {}

export function renderFrame() {
  renderer.render(scene, camera);
}
