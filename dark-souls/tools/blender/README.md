# Pecas procedurais (Blender headless)

Gera `.glb` + previews em `assets/generated/` (1 unidade = 1 m, frente = +Z no glTF, origem na base).
Texturas PBR (cor, normal, rugosidade) sao assadas com Cycles CPU e exportadas como JPEG dentro do .glb.

Instalar (fora do repo):

    pip install uv && uv python install 3.11 && uv venv -p 3.11 /tmp/blender-venv
    uv pip install -p /tmp/blender-venv/bin/python bpy numpy

Rodar tudo (de `dark-souls/`), ou uma peca so:

    /tmp/blender-venv/bin/python tools/blender/build_all.py
    /tmp/blender-venv/bin/python tools/blender/bonfire.py

Pecas: bonfire (com a espada espiralada), pillar, gravestone (3 lapides), gothic_arch (vao 4x5 m),
fog_gate, ruined_statue. Utilidades (geometria, materiais, bake, export, preview) em `common.py`.
