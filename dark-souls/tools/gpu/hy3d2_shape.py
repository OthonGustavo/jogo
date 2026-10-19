"""Imagem -> forma 3D com o Hunyuan3D 2.0 turbo do pacote Hunyuan3D2_WinPortable (YanWenKun).

Roda com o Python do pacote, a partir da pasta Hunyuan3D-2 dele, com as mesmas otimizações de memória
do gradio_app.py (mmgp, perfil 5 = "pouquíssima RAM, pouca VRAM"):

  set HY3DGEN_MODELS=C:\\ia\\Hunyuan3D\\Hunyuan3D2_WinPortable\\HuggingFaceHub
  ..\\python_standalone\\python.exe -s hy3d2_shape.py <imagem.png> <saida.glb> [passos] [octree]
"""
import sys
import time
from pathlib import Path

import torch
from PIL import Image
from mmgp import offload

from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import (DegenerateFaceRemover, FaceReducer, FloaterRemover,
                              Hunyuan3DDiTFlowMatchingPipeline)
from hy3dgen.shapegen.pipelines import export_to_trimesh
from hy3dgen.shapegen.utils import logger  # noqa: F401  (inicializa o log do hy3dgen)

image_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
steps = int(sys.argv[3]) if len(sys.argv) > 3 else 5
octree = int(sys.argv[4]) if len(sys.argv) > 4 else 380

t0 = time.time()
pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    "tencent/Hunyuan3D-2", subfolder="hunyuan3d-dit-v2-0-turbo", use_safetensors=True, device="cuda"
)
pipe.enable_flashvdm(mc_algo="mc")

# Mesmo truque do gradio_app.py para o mmgp mover os modelos entre RAM e VRAM
type(pipe)._execution_device = property(lambda self: "cuda")
models = offload.extract_models("i23d_worker", pipe)
offload.profile(models, profile_no=5, verboseLevel=1, budgets={"*": 2200})
print(f"carregar modelo: {time.time() - t0:.1f}s", flush=True)

image = Image.open(image_path).convert("RGB")
image = BackgroundRemover()(image)
image.save(out_path.with_suffix(".sem-fundo.png"))

torch.cuda.reset_peak_memory_stats()
t = time.time()
mesh = pipe(
    image=image,
    num_inference_steps=steps,
    guidance_scale=5.0,
    generator=torch.manual_seed(1234),
    octree_resolution=octree,
    num_chunks=20000,
    output_type="mesh",
)
mesh = export_to_trimesh(mesh)[0]
gen = time.time() - t
mesh = FloaterRemover()(mesh)
mesh = DegenerateFaceRemover()(mesh)
mesh.export(out_path)
print(f"forma: passos={steps} octree={octree} tempo={gen:.1f}s "
      f"VRAM_pico_torch={torch.cuda.max_memory_allocated() / 2**30:.2f}GB "
      f"vertices={len(mesh.vertices)} triangulos={len(mesh.faces)}", flush=True)
