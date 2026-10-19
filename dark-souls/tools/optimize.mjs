#!/usr/bin/env node
// Otimiza assets/raw/** -> assets/chars e assets/dungeon (meshopt + texturas webp 256px),
// grava assets/manifest.json e assets/ANIMS.md. `--check` só valida o manifest.
// Dependências ficam fora do repo (os.tmpdir()/ds-gt) para não mexer no package.json.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARS, DUNGEON } from './fetch-assets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = (p) => join(ROOT, 'assets', p);
const TOOLS = join(tmpdir(), 'ds-gt');
const MAX = 2 * 1024 * 1024;

if (!existsSync(join(TOOLS, 'node_modules/.bin/gltf-transform'))) {
  mkdirSync(TOOLS, { recursive: true });
  writeFileSync(join(TOOLS, 'package.json'), '{"name":"ds-gt","private":true}');
  execFileSync('npm', ['i', '@gltf-transform/cli', '@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', 'meshoptimizer', 'sharp'], { cwd: TOOLS, stdio: 'inherit' });
}
const req = createRequire(join(TOOLS, 'x.js'));
const GT = join(TOOLS, 'node_modules/.bin/gltf-transform');

const MANIFEST = {
  player: 'assets/chars/knight.glb',
  enemy_hollow: 'assets/chars/skeleton_minion.glb',
  enemy_archer: 'assets/chars/skeleton_rogue.glb',
  enemy_knight: 'assets/chars/skeleton_warrior.glb',
  enemy_mage: 'assets/chars/skeleton_mage.glb',
  ...Object.fromEntries(DUNGEON.map((n) => [`dungeon_${n}`, `assets/dungeon/${n}.glb`])),
};

async function load() {
  const { NodeIO } = req('@gltf-transform/core');
  const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
  const { MeshoptDecoder, MeshoptEncoder } = req('meshoptimizer');
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

// Remove animações que o jogo não usa (poses, sentar, deitar...) para caber em < 2 MB.
const DROP = /^(Sit_|Lie_|T-Pose|Cheer|Interact|PickUp|Dualwield|Unarmed_|Taunt|Throw|Use_Item|Jump_|Spawn_|Spellcast|2H_Ranged|1H_Ranged|Skeleton_Inactive|Skeletons_Inactive|Skeletons_Awaken|Death_._Pose|Death_C)/;
async function stripAnims(io, src, dst) {
  const doc = await io.read(src);
  for (const a of doc.getRoot().listAnimations()) if (DROP.test(a.getName())) a.dispose();
  await io.write(dst, doc);
}

async function optimizeAll(io) {
  const jobs = [
    ...CHARS.map(([k, p]) => [A(`raw/chars/${basename(p)}`), A(`chars/${k}.glb`)]),
    ...DUNGEON.map((n) => [A(`raw/dungeon/${n}.glb`), A(`dungeon/${n}.glb`)]),
  ];
  mkdirSync(A('chars'), { recursive: true }); mkdirSync(A('dungeon'), { recursive: true });
  for (const [i0, o] of jobs) {
    const i = join(TOOLS, 'strip.glb');
    await stripAnims(io, i0, i);
    // simplify desligado: malhas skinned são baixa poly e simplificar quebra a pele.
    execFileSync(GT, ['optimize', i, o, '--compress', 'meshopt', '--simplify', 'false', '--texture-compress', 'webp', '--texture-size', '256'], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  console.log(`optimize: ${jobs.length} arquivos otimizados`);
}

async function anims(io) {
  const md = ['# Animações dos personagens (KayKit)', '',
    'Todos os `.glb` usam **EXT_meshopt_compression** e **EXT_texture_webp**: o jogo precisa de `MeshoptDecoder` (`three/examples/jsm/libs/meshopt_decoder.module.js`) via `loader.setMeshoptDecoder(MeshoptDecoder)`.',
    'Animações vêm embutidas em cada `.glb` (Rig_Medium_*); não há arquivo de animação separado.', ''];
  const pick = (names, re) => names.filter((n) => re.test(n));
  for (const [k, p] of CHARS) {
    const doc = await io.read(A(`chars/${k}.glb`));
    const names = doc.getRoot().listAnimations().map((a) => a.getName());
    const has = (n) => names.includes(n);
    const first = (...c) => c.find(has);
    const map = {
      idle: first('Idle', '2H_Melee_Idle', 'Unarmed_Idle'),
      walk: first('Walking_A', 'Walking_B'),
      run: first('Running_A', 'Running_B'),
      roll: first('Dodge_Forward', 'Dodge_Backward', 'Jump_Full_Long'),
      attack_light: first('1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'),
      attack_heavy: first('2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '1H_Melee_Attack_Stab'),
      block: first('Blocking', 'Block'),
      hit: first('Hit_A', 'Hit_B'),
      death: first('Death_A', 'Death_B'),
    };
    md.push(`## ${k} (\`${MANIFEST[Object.keys(MANIFEST).find((m) => MANIFEST[m].endsWith(`/${k}.glb`))]}\`)`, '',
      '| contrato | animação sugerida |', '|---|---|',
      ...Object.entries(map).map(([c, n]) => `| ${c} | ${n ? '`' + n + '`' : '**FALTA** (usar procedural)'} |`), '',
      `Todas (${names.length}): ${names.map((n) => '`' + n + '`').join(', ')}`, '');
  }
  writeFileSync(A('ANIMS.md'), md.join('\n'));
}

async function check() {
  const io = await load();
  let bad = 0;
  for (const [key, rel] of Object.entries(JSON.parse(readFileSync(A('manifest.json'), 'utf8')))) {
    const f = join(ROOT, rel);
    let msg = 'ok';
    try {
      const size = statSync(f).size;
      const doc = await io.read(f); // falha se não for glTF válido
      const r = doc.getRoot();
      if (!r.listMeshes().length) throw new Error('sem malhas');
      if (size >= MAX) throw new Error(`>= 2MB (${size})`);
      msg = `ok ${(size / 1024).toFixed(0)}KB meshes=${r.listMeshes().length} anims=${r.listAnimations().length}`;
    } catch (e) { msg = `ERRO ${e.message}`; bad++; }
    console.log(`${key.padEnd(34)} ${msg}`);
  }
  console.log(bad ? `FALHOU: ${bad} problema(s)` : 'CHECK OK');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--check')) await check();
else {
  const io = await load();
  await optimizeAll(io);
  writeFileSync(A('manifest.json'), JSON.stringify(MANIFEST, null, 2) + '\n');
  await anims(io);
  await check();
}
