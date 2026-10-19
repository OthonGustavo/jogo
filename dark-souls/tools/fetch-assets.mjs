#!/usr/bin/env node
// Baixa os pacotes KayKit (CC0, Kay Lousberg) via raw.githubusercontent.com para assets/raw/.
// Idempotente: pula arquivos que já existem. Uso: node tools/fetch-assets.mjs
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://raw.githubusercontent.com/KayKit-Game-Assets';
const ADV = 'KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures';
const SKE = 'KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons';
const DUN = 'KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered/Assets/gltf';

// Personagens já trazem a malha + todas as animações embutidas no .glb (não há arquivo de animação separado).
export const CHARS = [
  ['knight', `${ADV}/Characters/gltf/Knight.glb`],
  ['skeleton_warrior', `${SKE}/Characters/gltf/Skeleton_Warrior.glb`],
  ['skeleton_minion', `${SKE}/Characters/gltf/Skeleton_Minion.glb`],
  ['skeleton_mage', `${SKE}/Characters/gltf/Skeleton_Mage.glb`],
  ['skeleton_rogue', `${SKE}/Characters/gltf/Skeleton_Rogue.glb`],
];
// No Dungeon Remastered os arquivos se chamam "<nome>.gltf.glb".
export const DUNGEON = `wall wall_corner wall_arched wall_half wall_broken wall_cracked wall_gated wall_endcap
wall_pillar wall_window_open floor_tile_large floor_tile_small floor_tile_large_rocks floor_dirt_large
floor_tile_big_grate floor_foundation_allsides pillar pillar_decorated column stairs stairs_wide stairs_walled
torch_mounted torch_lit candle_triple barrel_large barrel_small barrel_small_stack box_large box_stacked
crates_stacked banner_red rubble_large shelf_large keg`.split(/\s+/);

export const FILES = [
  ...CHARS.map(([k, p]) => ({ key: k, url: `${BASE}/${p}`, out: `raw/chars/${p.split('/').pop()}` })),
  ...DUNGEON.map((n) => ({ key: n, url: `${BASE}/${DUN}/${n}.gltf.glb`, out: `raw/dungeon/${n}.glb` })),
  { key: 'LICENSE', url: `${BASE}/KayKit-Dungeon-Remastered-1.0/main/LICENSE.txt`, out: 'raw/LICENSE-dungeon.txt' },
];

async function get(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let baixados = 0, pulados = 0;
  for (const f of FILES) {
    const dest = join(ROOT, 'assets', f.out);
    if (await stat(dest).then((s) => s.size > 0, () => false)) { pulados++; continue; }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await get(f.url));
    baixados++;
  }
  console.log(`fetch-assets: ${baixados} baixados, ${pulados} já existiam (total ${FILES.length})`);
}
