# Plano: Almas Sombrias com visual 3D refinado (agentes Sonnet)

## 1. Resumo
Hoje todos os modelos do jogo são caixas e cilindros montados em código. O plano troca isso por:
- **Personagens prontos e animados**, gratuitos (CC0), baixados direto do GitHub: esqueletos para os inimigos e aventureiros para o jogador.
- **Cenário modular**: mais de 200 peças de masmorra (paredes, arcos, portas, tochas).
- **Peças únicas geradas no Blender por script** na nuvem (fogueira, espada espiralada, lápides, névoa), e o **chefe gerado por IA na sua RTX 5060**.
- **Iluminação e pós-processamento** (brilho do fogo, sombras suaves, oclusão, correção de cor). É isso que mais aproxima o visual de um jogo profissional.

O trabalho é dividido entre agentes Sonnet que rodam em paralelo, cada um responsável por arquivos próprios.

## 2. Como os devs fazem hoje (resumo)
- **Código**: agentes de IA (Claude Code, Cursor) escrevem o motor e a lógica. Isso a IA já faz bem.
- **Modelos 3D**, três caminhos combinados:
  1. **Bibliotecas gratuitas** (KayKit, Quaternius, Kenney, Poly Haven): é o caminho mais barato e confiável.
  2. **Geradores de modelo por IA** a partir de imagem ou texto (Meshy, Tripo, Hunyuan3D, TRELLIS). Depois o modelo passa por uma limpeza no Blender: reduzir polígonos e conferir as texturas.
  3. **Blender controlado por IA**, via script Python ou um "MCP do Blender". Funciona bem para objetos e arquitetura e mal para personagens orgânicos.
- **Animação**: bibliotecas prontas ou Mixamo (gratuito com conta Adobe), adaptadas ao esqueleto do personagem.
- **O maior salto visual** vem de iluminação, materiais com textura realista (PBR) e pós-processamento, não de mais polígonos.

## 3. Onde cada coisa roda

| Nuvem (agentes Sonnet) | Seu notebook (RTX 5060) |
|---|---|
| Código do jogo, testes, screenshots | Gerar o chefe e peças especiais com IA a partir de imagem |
| Blender sem GPU, por script (**testado: bpy 5.0.1 funciona**) | Blender com interface, para ajustes manuais opcionais |
| Download dos pacotes KayKit (**testado: acessível**) | Mixamo (site da Adobe) para animações extras, se precisar |
| Otimizar `.glb` (gltf-transform, pelo npm) | |

**Limites da nuvem (testados):**
- Não tem GPU.
- Roda **só 2 agentes ao mesmo tempo**.
- A rede só acessa npm, pypi e `raw.githubusercontent.com`.

**Para liberar mais sites** (opcional): menu do ambiente na barra de título da sessão → Editar → Network access → Allowed domains. Deixe marcada a caixa de gerenciadores de pacotes. Domínios úteis:
- `dl.polyhaven.org` e `api.polyhaven.com`: texturas e HDRIs realistas.
- `ambientcg.com`: texturas.
- `github.com`, `codeload.github.com` e `objects.githubusercontent.com`: pacotes zip e releases.
- `huggingface.co`: modelos de IA.
- `kenney.nl`.

## 4. Ferramentas

| Ferramenta | Para quê | Onde | Licença/custo | Como instalar |
|---|---|---|---|---|
| Blender `bpy` 5.0.1 | modelar, assar texturas e exportar `.glb` por script | nuvem | GPL, grátis | `pip install uv && uv python install 3.11 && uv venv -p 3.11 .bvenv && uv pip install -p .bvenv/bin/python bpy` |
| `@gltf-transform/cli` | comprimir e otimizar `.glb` | nuvem | MIT | `npx @gltf-transform/cli optimize in.glb out.glb` |
| `three` (npm) + `postprocessing` | renderização e efeitos | nuvem/jogo | MIT | `npm i three postprocessing` (copiar o build para `vendor/`) |
| `three-mesh-bvh` | colisão precisa com o cenário | jogo | MIT | `npm i three-mesh-bvh` |
| KayKit Skeletons / Adventurers / Dungeon Remastered | inimigos, jogador, cenário (animados) | GitHub raw | **CC0** | `raw.githubusercontent.com/KayKit-Game-Assets/<pacote>/main/...` |
| Blender 4.x/5.x desktop | ajustes manuais (opcional) | notebook | grátis | blender.org |
| Pinokio | instala apps de IA com 1 clique no Windows | notebook | grátis | pinokio.co |
| Hunyuan3D 2.1 ou TRELLIS 2 (via Pinokio/ComfyUI) | imagem → modelo 3D (chefe) | notebook | ver licença de cada um | pelo Pinokio |
| Meshy / Tripo (alternativa paga) | imagem → modelo já texturizado | site | créditos grátis limitados | site oficial |

⚠️ **Não confirmado**: se a geração por IA cabe nos 8 GB da RTX 5060. Guias da comunidade dizem que a **forma** do Hunyuan3D 2.1 roda com cerca de 6–8 GB, mas a **textura** pede mais. Para o TRELLIS 2 em "low VRAM", um site que vende créditos fala em 6–8 GB. Teste antes de contar com isso. Se não couber: gere só a forma e deixe o agente de Blender pintar a textura, ou use os créditos grátis do Meshy/Tripo.

O estilo do KayKit é low-poly estilizado. Para chegar ao clima sombrio, o agente de render escurece e desatura os materiais, aumenta a rugosidade e aplica névoa e correção de cor.

## 5. Arquitetura alvo (pré-requisito para paralelizar)
Hoje o código fica todo em um `game.js` de cerca de 900 linhas, e vários agentes editando o mesmo arquivo dá conflito. Por isso a **Fase 0** separa o código em módulos:

```
dark-souls/
  src/main.js            loop principal, estados do jogo
  src/core/renderer.js   renderer, câmera, luzes base
  src/core/input.js      teclado/mouse, buffer de ações
  src/core/audio.js      sfx
  src/world/level.js     chão, paredes, colisões (grounds/walls)
  src/world/props.js     fogueiras, itens, mensagens, névoa
  src/entities/player.js jogador (estado, combate, animação)
  src/entities/enemy.js  IA de inimigos + chefe
  src/fx/post.js         pós-processamento
  src/fx/particles.js    faíscas, brasas
  src/ui/hud.js          HUD e menus
  src/assets/loader.js   carrega manifest + GLTFLoader
  assets/manifest.json   { "player": "assets/chars/knight.glb", ... }
  tests/smoke.mjs        Playwright: carrega, joga roteiro, tira screenshots
```

**Contratos fixos** (nenhum agente muda sem avisar):
- `loader.get(key)` devolve `{ scene, animations }`.
- Todo personagem expõe `model.play(nome, { loop, fade })` com os nomes padrão `idle`, `walk`, `run`, `roll`, `attack_light`, `attack_heavy`, `block`, `hit`, `death`.
- Colisão continua por AABB (`walls`) e retângulos (`grounds`).
- `window.__game` continua existindo para os testes.

## 6. Fases e agentes
Todos os agentes usam **Sonnet**. Cada um é "dono" de arquivos e não edita os dos outros. Como aqui só rodam 2 ao mesmo tempo, as equipes têm no máximo 2–3 agentes.

| Fase | Agente | Dono de | Entrega | Critério de aceite |
|---|---|---|---|---|
| 0 | **Modularizador** | tudo (sozinho) | código dividido em `src/`, `tests/smoke.mjs` | `node tests/smoke.mjs` passa; o jogo se comporta igual (mesmos checks do teste atual: combate, rolagem, Estus, névoa, chefe, queda) |
| 1 | **Assets** | `assets/`, `tools/fetch-assets.mjs`, `tools/optimize.mjs` | KayKit baixado, `.glb` otimizados, `manifest.json`, `assets/CREDITS.md` | cada `.glb` com menos de 2 MB; manifest válido |
| 1 | **Render/FX** | `src/core/renderer.js`, `src/fx/*` | pós-processamento (bloom, SSAO, SMAA, vinheta, LUT), sombras suaves, fogo com partículas | screenshots antes/depois; menos de 120 draw calls na cena inicial |
| 1 | **Blender procedural** | `tools/blender/*.py`, `assets/generated/` | fogueira, espada espiralada, pilar quebrado, lápide, arco, portão de névoa com textura PBR assada | cada `.py` roda headless em menos de 3 min; render preview `.png` de cada peça |
| 2 | **Personagens** | `src/entities/*`, `src/anim/*` | jogador e inimigos com modelos KayKit + AnimationMixer + troca suave de animações | screenshot de cada estado; o teste continua passando |
| 2 | **Level art** | `src/world/*` | cenário montado com peças do Dungeon kit + props gerados, colisões ajustadas | screenshot de cada área; queda da ponte ainda funciona |
| 2 | **Chefe** | `src/entities/boss.js`, `assets/boss/` | modelo do chefe (da IA do notebook ou fallback no Blender) com rig e ataques | luta completa no teste |
| 3 | **Integrador/QA** | merge + correções | tudo junto, README atualizado | teste verde + 6 screenshots revisados |

Faixa paralela do **dono (notebook)**, durante as Fases 1–2:
1. Instalar o Pinokio e, por ele, o Hunyuan3D 2.1 ou o TRELLIS 2.
2. Gerar uma imagem do "Demônio do Asilo" (qualquer gerador de imagem) e passar pelo imagem→3D.
3. Subir o `.glb` em `dark-souls/assets/inbox/` pelo site do GitHub, ou mandar aqui no chat.

## 7. Prompts prontos (copiar e colar, um por agente)

**Fase 0, Modularizador**
> Leia `dark-souls/PLANO-3D.md` (seção 5). Divida `dark-souls/game.js` nos módulos listados, sem mudar nenhum comportamento nem valor de balanceamento. Mantenha `window.__game`. Crie `tests/smoke.mjs` (Playwright, Chromium em `/opt/pw-browsers/chromium`, flags `--use-angle=swiftshader`): sirva a pasta com `python3 -m http.server`, avance o tempo simulado esperando `window.__simT` (o render é ~1 fps) e verifique combate, rolagem, Estus, névoa do chefe, morte do chefe e queda da ponte. Salve screenshots em `tests/shots/`. Rode até passar. Commit.

**Fase 1, Assets**
> Leia `PLANO-3D.md`. Você é dono só de `dark-souls/assets/` e `dark-souls/tools/fetch-assets.mjs` e `optimize.mjs`. Baixe por `raw.githubusercontent.com` os pacotes CC0 `KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`, `KayKit-Character-Pack-Adventures-1.0` e `KayKit-Dungeon-Remastered-1.0` (descubra os caminhos dos `.glb`/`.gltf` lendo os READMEs e testando URLs; a API do GitHub e os zips estão bloqueados). Pegue só o necessário: 1 cavaleiro, 3 esqueletos, cerca de 30 peças de masmorra. Otimize com `npx @gltf-transform/cli optimize` (meshopt, texturas webp). Gere `assets/manifest.json` com as chaves do contrato e `assets/CREDITS.md`. Liste os nomes de animação de cada personagem em `assets/ANIMS.md`. Commit.

**Fase 1, Render/FX**
> Leia `PLANO-3D.md`. Você é dono só de `src/core/renderer.js` e `src/fx/*`. Adicione pós-processamento com a lib `postprocessing` (npm, copie o build ESM para `vendor/`): SMAA, N8AO ou SSAO, bloom só nas luzes de fogo, vinheta e grading frio e dessaturado (clima Dark Souls). Melhore as sombras (PCFSoft, cascata simples se couber), a névoa em camadas e um fogo de fogueira com partículas e brasas. Exponha `fx.setQuality('low'|'high')`. Gere screenshots antes/depois com `tests/smoke.mjs`. Não mexa em gameplay. Commit.

**Fase 1, Blender procedural**
> Leia `PLANO-3D.md`. Você é dono só de `tools/blender/` e `assets/generated/`. Instale o Blender: `pip install uv && uv python install 3.11 && uv venv -p 3.11 .bvenv && uv pip install -p .bvenv/bin/python bpy`. Escreva um script `.py` por peça: fogueira (cinzas, ossos, espada espiralada), pilar quebrado, lápide, arco gótico, portão de névoa, estátua em ruína. Use modificadores (bevel, displace com ruído, subdivisão), Smart UV Project e asse textura PBR (base color, rugosidade, normal) no Cycles CPU com baixa amostragem (≤64). Exporte `.glb` (menos de 5k triângulos por peça). Renderize um preview `.png` de cada uma para conferir o resultado olhando a imagem. Commit.

**Fase 2, Personagens**
> Leia `PLANO-3D.md` e `assets/ANIMS.md`. Você é dono só de `src/entities/*` e `src/anim/*`. Troque os humanoides de primitivas pelos modelos do manifest: jogador = cavaleiro KayKit, ocos = esqueletos, arqueiro = esqueleto com arco, cavaleiro negro = cavaleiro escurecido. Use `AnimationMixer` com crossfade, mapeie as animações do contrato e sincronize os golpes com a janela de dano que já existe (`hitStart`/`hitEnd`). Se faltar uma animação (ex.: rolagem), mantenha a rotação procedural atual. Rode o teste e gere screenshots de cada estado. Commit.

**Fase 2, Level art**
> Leia `PLANO-3D.md`. Você é dono só de `src/world/*`. Substitua as caixas por peças do Dungeon kit e de `assets/generated/` (paredes, arcos, chão, tochas), mantendo exatamente o layout e as colisões de `grounds`/`walls`. Use instanciamento (`InstancedMesh`) para peças repetidas. Rode o teste (a queda da ponte precisa continuar funcionando) e gere screenshots de cada área. Commit.

**Fase 2, Chefe**
> Leia `PLANO-3D.md`. Você é dono só de `src/entities/boss.js` e `assets/boss/`. Se existir `assets/inbox/boss*.glb` (gerado pelo dono), otimize, faça o rig por script no `bpy` (armature simples: quadril, tronco, braços, cabeça) e crie as animações smash, sweep, jump e death por keyframes. Se não existir, faça o fallback: esqueleto KayKit em escala 3x com chifres e clava gerados no Blender. Mantenha a IA e o timing atuais. Teste a luta completa. Commit.

**Fase 3, Integrador/QA**
> Leia `PLANO-3D.md`. Junte as branches/worktrees das fases 1–2, resolva conflitos respeitando a posse de arquivos, rode `tests/smoke.mjs` até passar, revise os 6 screenshots principais e corrija problemas visuais óbvios (modelos flutuando, escala, materiais pretos). Atualize o README. Gere o arquivo único para publicar. Commit.

## 8. Como economizar
- **Tudo em Sonnet.** Só chame Opus se um agente travar duas vezes no mesmo problema.
- **Não use "fork"** para isso: fork sempre usa o modelo da conversa principal. Use agentes comuns ou um workflow com `model: 'sonnet'`.
- **Desligue o "ultracode"** nessas execuções. Ele força pesquisa exaustiva e gasta muito.
- **Faça a Fase 0 primeiro.** Sem ela os agentes brigam pelo mesmo arquivo e refazem trabalho.
- **Prompts curtos que apontam para este arquivo**, em vez de repetir o contexto.
- **Screenshots só no fim de cada tarefa**: o navegador daqui é lento, cerca de 1 fps.
- **Equipes de 2–3 agentes por fase**: o ambiente só roda 2 de cada vez, e mais que isso só fica na fila.
- **Uma fase por vez**: você vê o resultado e decide se segue, sem gastar às cegas.

## 9. Riscos
- **GitHub:** o envio para o repositório está bloqueado (sem permissão). Corrija isso antes, senão o trabalho fica só neste ambiente temporário.
- **Estilo dos modelos:** os modelos KayKit são estilizados. O clima sombrio depende do agente de render; para realismo maior, libere Poly Haven/ambientCG na rede.
- **IA no notebook:** a geração com 8 GB de VRAM não está confirmada. O fallback do chefe pelo Blender existe para isso.
- **Licenças:** KayKit é CC0. Confira a licença de cada gerador de IA antes de uso comercial (algumas têm restrições regionais).
- **Peso do jogo:** com modelos reais o jogo fica mais pesado. O agente de render inclui a opção de qualidade baixa.
