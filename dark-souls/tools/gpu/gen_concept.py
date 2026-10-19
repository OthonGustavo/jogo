"""Gera imagens conceito do chefe com SDXL base 1.0 (licenÃ§a CreativeML OpenRAIL++-M, permite uso comercial).

Uso: python gen_concept.py <pasta_saida> [n_imagens] [seed_inicial]
"""
import sys
import time
from pathlib import Path

import torch
from diffusers import StableDiffusionXLPipeline

out = Path(sys.argv[1])
n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
seed0 = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
out.mkdir(parents=True, exist_ok=True)

PROMPT = (
    "plain grey background, full body, obese fat ogre demon, huge round pot belly, hunched back, "
    "short thick legs, holding giant stone hammer, small horns, glowing amber eyes, tiny wings, "
    "cracked grey stone skin, three-quarter view, dark fantasy, grim"
)
NEGATIVE = (
    "muscular, six pack abs, athletic, slim, large wings, loincloth, cropped, cut off, out of frame, "
    "multiple characters, scenery, text, watermark, blurry, lowres, deformed, extra limbs, dark background"
)

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()

torch.cuda.reset_peak_memory_stats()
for i in range(n):
    seed = seed0 + i
    t = time.time()
    img = pipe(
        PROMPT,
        negative_prompt=NEGATIVE,
        width=896,
        height=1152,
        num_inference_steps=30,
        guidance_scale=7.0,
        generator=torch.Generator("cpu").manual_seed(seed),
    ).images[0]
    path = out / f"conceito_{seed}.png"
    img.save(path)
    print(f"{path.name}: {time.time() - t:.1f}s", flush=True)

print(f"VRAM pico: {torch.cuda.max_memory_allocated() / 2**30:.2f} GB")
