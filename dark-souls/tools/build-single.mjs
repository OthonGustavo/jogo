// Gera dist/almas-sombrias.html: um único HTML autocontido (CSS, corpo do index.html
// e o JS empacotado com o three.js minificado, tudo inline). Uso: npm run build
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'almas-sombrias.html');

const result = await build({
  entryPoints: [join(ROOT, 'src', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  legalComments: 'none',
});
// "</script" dentro do bundle fecharia a tag inline; escapa por segurança
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const css = readFileSync(join(ROOT, 'style.css'), 'utf8');
const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
const title = (index.match(/<title>([\s\S]*?)<\/title>/) || [, 'Almas Sombrias'])[1];
const bodyInner = index.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
  .replace(/<script[^>]*src=["'][^"']*["'][^>]*><\/script>\s*/g, '')
  .trim();
// mantém as fontes do Google (se estiverem offline o navegador usa a fonte serifada padrão)
const fonts = (index.match(/<link[^>]*(?:preconnect|fonts\.googleapis)[^>]*>/g) || []).join('\n');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${fonts}
<style>
${css}
</style>
</head>
<body>
${bodyInner}

<script type="module">
${js}
</script>
</body>
</html>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`dist/almas-sombrias.html gerado: ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
