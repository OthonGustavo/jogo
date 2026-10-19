# dragao

Gerado por `tools/gpu/criar_personagem.py` (SDXL base 1.0 -> Hunyuan3D 2.0 turbo forma+textura -> Blender 5.0.1),
refeito em qualidade maior: forma com 10 passos e octree 512 (2 milhões de triângulos antes da redução), textura pintada
sobre 60 mil faces. Resultado: **60 mil triângulos**, textura 2048, altura 5,0 m, origem nos pés, frente +Z.

Prompt: `plain grey background, full body, large dark fantasy dragon, full body, standing on four legs, folded wings, horned head, scaly black and dark red hide, spiked tail, glowing eyes, menacing, standing, three-quarter view, head to feet visible, dark fantasy, grim` (semente 3003, opção 4)

## dragao_animado.glb

Esqueleto de 31 ossos (`Root` no chão entre os pés -> `Hips` -> coluna, pescoço, cabeça, mandíbula; rabo em 4 partes;
pernas e braços com 3 ossos de cada lado, asas com 4: `Wing1`, `Wing2`, `Wing3` = borda da frente, `WingM` = borda de trás).
Feito por `tools/gpu/animar_dragao.py` com `tools/gpu/ossos_dragao.json`. Pesos por "calor" do Blender numa cópia
fechada da malha; a membrana fina das asas só segue os ossos da asa. Pernas animadas com IK e assadas em FK.

| Animação | Quadros (24 fps) | Loop | Notas |
|---|---|---|---|
| `Parado` | 73 (3 s) | sim | respiração, rabo e pescoço |
| `Andar` | 37 (1,5 s) | sim | **no lugar**: cada pé recua 0,9 m no apoio; para casar com o chão, mova o personagem a ~1,0 m/s (0,9 m em 0,9 s de apoio) |
| `Ataque` | 64 (2,7 s) | não | soco do braço direito (impacto no quadro 15), depois giro de 360° sobre os pés com chicotada do rabo (quadros 32-48) |
| `Voar` | 29 (1,2 s) | sim | pairando: `Root` sobe 1,0 m; asa desce em 40% do ciclo e sobe em 60% |

Licenças: ver `README.md` desta pasta (Hunyuan3D 2.0 Community License: **não vale na UE, Reino Unido e Coreia do Sul**; SDXL: CreativeML Open RAIL++-M).
