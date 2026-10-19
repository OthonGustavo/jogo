// Carregador de assets. Contrato: get(key) devolve { scene, animations } (glTF carregado) ou null.
// O manifest (assets/manifest.json) mapeia chave -> caminho, ex.: { "player": "assets/chars/knight.glb" }.
// Os .glb usam compressão meshopt + texturas webp, por isso o decodificador é obrigatório.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const cache = new Map();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadManifest(url = 'assets/manifest.json') {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

// Carrega as chaves pedidas (ou todas, se `keys` for omitido). Falha de uma não derruba as outras.
export async function loadAll(manifest = {}, keys = Object.keys(manifest)) {
  await Promise.all(keys.map(async key => {
    if (cache.has(key) || !manifest[key]) return;
    try {
      const g = await loader.loadAsync(manifest[key]);
      cache.set(key, { scene: g.scene, animations: g.animations });
    } catch (e) {
      console.warn('asset não carregou:', key, e.message);
    }
  }));
  return cache;
}

export function get(key) {
  return cache.get(key) || null;
}

// Cópia independente (com esqueleto próprio) para instanciar o mesmo modelo várias vezes.
export function instance(key) {
  const a = cache.get(key);
  return a ? { scene: clone(a.scene), animations: a.animations } : null;
}
