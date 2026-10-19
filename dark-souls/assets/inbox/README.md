# inbox: chefe gerado por IA no notebook

| Arquivo | O que é |
|---|---|
| `boss.glb` | Demônio do Asilo: 28.000 triângulos, textura 2048×2048 (JPEG), altura 5,0 m (1 unidade = 1 m), origem nos pés, frente para +Z |
| `boss-preview.png` | Prévia renderizada no Blender 5.0.1 (Cycles) |
| `boss-concept.png` | Imagem conceito usada como entrada |

Ainda **sem esqueleto (rig) e sem animações**: é só o modelo estático pintado.

## Como foi feito

1. Imagem conceito: **SDXL base 1.0** (Stability AI), `tools/gpu/gen_concept.py`, semente 2002.
2. Forma 3D: **Tencent Hunyuan3D 2.0** (`hunyuan3d-dit-v2-0-turbo`), `tools/gpu/hy3d2_shape.py`.
3. Textura: **Tencent Hunyuan3D-Paint 2.0** (`hunyuan3d-paint-v2-0-turbo` + `hunyuan3d-delight-v2-0`), `tools/gpu/hy3d2_paint.py`,
   com a malha reduzida para 28 mil faces.
4. Escala, origem, normais e exportação: Blender 5.0.1 (`bpy`), `tools/gpu/blender_boss.py textura`.

Pacote usado: Hunyuan3D2_WinPortable v4-cu129 (YanWenKun, GPL-3.0), código `Hunyuan3D-2` commit `76a3e08`.
Números de tempo e memória em `tools/gpu/BENCH.md`.

## Licenças (leia antes de vender o jogo)

- **Hunyuan3D 2.0: Tencent Hunyuan 3D 2.0 Community License.**
  - **Não vale na União Europeia, no Reino Unido e na Coreia do Sul.** A licença proíbe usar, distribuir ou exibir o modelo
    **e os resultados gerados (o `boss.glb`)** fora do "Território". Ou seja: um jogo com este chefe não pode ser vendido/distribuído
    nesses lugares sob esta licença.
  - Se a empresa tiver **mais de 1 milhão de usuários ativos por mês**, precisa pedir licença à Tencent.
  - A Tencent diz não reivindicar direitos sobre os resultados gerados; quem gera é responsável pelo uso.
  - Não pode usar os resultados para treinar/melhorar outro modelo de IA.
- **SDXL base 1.0: CreativeML Open RAIL++-M.** Permite uso comercial, com as restrições de uso indevido da licença.
- **Blender:** GPL; o arquivo exportado é seu.

Se o plano for vender na Europa, no Reino Unido ou na Coreia do Sul, troque este chefe por um feito com ferramenta de licença
compatível (por exemplo, modelado no Blender ou gerado por um serviço cuja licença cubra esses países).
