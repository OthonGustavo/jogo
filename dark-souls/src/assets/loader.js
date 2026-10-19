// Carregador de assets (Fases 1 e 2). Esqueleto: ainda não é usado pelo jogo.
// Contrato: get(key) devolve { scene, animations } (um glTF carregado) ou null.
// O manifest (assets/manifest.json) mapeia chave -> caminho, ex.: { "player": "assets/chars/knight.glb" }.
// Quando os .glb chegarem, importar o GLTFLoader do three (examples/jsm) e preencher loadAll().
const cache = new Map();

export async function loadManifest(url = 'assets/manifest.json') {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

export async function loadAll(manifest = {}) {
  // TODO: carregar cada entrada com GLTFLoader e guardar em `cache`.
  return cache;
}

export function get(key) {
  return cache.get(key) || null;
}
