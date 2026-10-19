"""Pinta a textura de uma malha com o Hunyuan3D-Paint 2.0 turbo do pacote Hunyuan3D2_WinPortable.

Mesmo caminho do gradio_app.py: reduz a malha (FaceReducer) e pinta com as otimizações de memória mmgp
(perfil 5, "pouquíssima RAM, pouca VRAM"). Requer as extensões custom_rasterizer e differentiable_renderer
compiladas (CUDA Toolkit + Visual Studio Build Tools).

  set HY3DGEN_MODELS=C:\\ia\\Hunyuan3D\\Hunyuan3D2_WinPortable\\HuggingFaceHub
  ..\\python_standalone\\python.exe -s hy3d2_paint.py <forma.glb> <imagem_sem_fundo.png> <saida.glb> [max_faces]
"""
import sys
import time
from pathlib import Path

import torch
import trimesh
from PIL import Image
from mmgp import offload

from hy3dgen.shapegen import FaceReducer
from hy3dgen.texgen import Hunyuan3DPaintPipeline

mesh_path, image_path, out_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])
max_faces = int(sys.argv[4]) if len(sys.argv) > 4 else 40000

t0 = time.time()
paint = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2")
paint.enable_model_cpu_offload()
models = offload.extract_models("texgen_worker", paint)
paint.models["multiview_model"].pipeline.vae.use_slicing = True
offload.profile(models, profile_no=5, verboseLevel=1, budgets={"*": 2200})
print(f"carregar pintor: {time.time() - t0:.1f}s", flush=True)

mesh = trimesh.load(mesh_path, force="mesh")
antes = len(mesh.faces)
mesh = FaceReducer()(mesh, max_facenum=max_faces)
print(f"faces {antes} -> {len(mesh.faces)}", flush=True)

image = Image.open(image_path)
torch.cuda.reset_peak_memory_stats()
t = time.time()
textured = paint(mesh, image)
elapsed = time.time() - t
textured.export(out_path)
print(f"textura: tempo={elapsed:.1f}s VRAM_pico_torch={torch.cuda.max_memory_allocated() / 2**30:.2f}GB "
      f"faces={len(textured.faces)}", flush=True)
