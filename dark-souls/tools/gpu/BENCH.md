# BENCH: geração por IA no notebook (RTX 5060 Laptop, 8 GB)

Medido em 19/10/2026 no notebook do dono. Todos os números abaixo foram medidos de verdade; o que não foi testado está marcado.

## Máquina

| Item | Valor |
|---|---|
| GPU | NVIDIA GeForce RTX 5060 Laptop, 8 GB (8151 MiB), Blackwell sm_120 |
| Driver | 617.14 (não foi alterado) |
| RAM | 15,6 GB |
| CUDA Toolkit | 12.9.86 (só compilador e bibliotecas; sem driver) |
| Compilador C++ | Visual Studio 2022 Build Tools, MSVC 14.44 |

## Gerador 3D: Hunyuan3D 2.0 (pacote Hunyuan3D2_WinPortable v4-cu129, YanWenKun)

- Pacote: `Hunyuan3D2_WinPortable_cu129.7z.001/.002` (3,3 GB), SHA-256 conferido com o GitHub.
- Código: `Hunyuan3D-2` commit `76a3e08` (2025-08-18). PyTorch 2.8.0+cu129, diffusers 0.35.1, mmgp 3.5.10.
- Rodado por script, com as mesmas otimizações do `gradio_app.py` do pacote (mmgp perfil 5, "pouquíssima RAM, pouca VRAM"):
  `hy3d2_shape.py` (forma) e `hy3d2_paint.py` (textura).
- Modelos baixados (~24 GB): `hunyuan3d-dit-v2-0-turbo`, `hunyuan3d-vae-v2-0(-turbo)`, `hunyuan3d-delight-v2-0`, `hunyuan3d-paint-v2-0-turbo`.

| Etapa | Tempo | VRAM pico | RAM pico | Resultado |
|---|---|---|---|---|
| Forma (DiT turbo, 5 passos, octree 380) | 15,4 s (+27 s para carregar) | 5,3 GB (nvidia-smi) / 2,3 GB (torch) | — | 916 mil triângulos |
| Textura (Paint turbo, malha reduzida a 28 mil) | 109 s (+137 s para carregar) | 3,5 GB (nvidia-smi) / 2,5 GB (torch) | 15,6 GB (no limite; usou memória virtual) | textura 2048×2048 |

**Conclusão:** forma **e** textura cabem nos 8 GB de VRAM com o mmgp perfil 5. O gargalo é a **RAM**: a textura encheu os 16 GB
(o README do pacote recomenda 24 GB). Funciona, mas feche jogos e outros programas antes; com outro processo pesado aberto ao mesmo
tempo, a máquina ficou muito lenta.

Para compilar a textura foi preciso: CUDA Toolkit 12.9 + Build Tools e `TORCH_CUDA_ARCH_LIST=12.0`
(`custom_rasterizer` e `differentiable_renderer` compilaram sem erro).

**Não testado:** a interface web do pacote (`RUN.bat` → http://localhost:8080/). O mesmo código foi rodado direto por script.
**Não testado:** TRELLIS 2 (não foi necessário, o Hunyuan3D funcionou).

## Imagem conceito: SDXL base 1.0 (diffusers, CPU offload)

| Item | Valor |
|---|---|
| Tempo por imagem 896×1152, 30 passos | ~30 s (a 1ª da leva ~60 s) |
| VRAM pico | 5,2 GB |
| Licença | CreativeML Open RAIL++-M (permite uso comercial) |

Script: `gen_concept.py`. O texto do prompt tem limite de 77 tokens (CLIP); o que passa disso é cortado.

## Recomendação

Usar **Hunyuan3D 2.0 turbo com textura**, perfil mmgp 5, com o notebook livre (sem jogos abertos). Pipeline completo:
`gen_concept.py` → `hy3d2_shape.py` → `hy3d2_paint.py` (reduz para 28 mil faces) → `blender_boss.py textura`.
