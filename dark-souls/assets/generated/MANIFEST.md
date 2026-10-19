# Pecas geradas (Blender procedural)

1 unidade = 1 m, frente = +Z, origem na base. Gerado por `tools/blender/build_all.py`. Dimensoes = bounding box (X x Y(prof.) x Z(altura) em Blender; no glTF Y/Z trocam de eixo: largura x altura x profundidade).

| arquivo | triangulos | KB | dimensoes (m, largura x profundidade x altura) |
|---|---|---|---|
| bonfire.glb | 3336 | 681 | 1.78 x 1.88 x 1.38 |
| broken_pillar.glb | 2298 | 675 | 3.86 x 2.44 x 3.27 |
| gravestone.glb | 2972 | 637 | 4.05 x 1.36 x 1.25 |
| gothic_arch.glb | 4314 | 877 | 5.75 x 1.09 x 5.61 |
| fog_gate.glb | 2010 | 790 | 5.65 x 0.9 x 5.3 |
| ruined_statue.glb | 2264 | 654 | 1.76 x 1.5 x 3.26 |

Notas: bonfire.glb inclui a espada espiralada (malha/material proprios `bonfire_sword`, sem arquivo separado). gothic_arch: vao livre 4 m x 5 m (apice interno), pilares em x=+-2.35. fog_gate: plano de nevoa 4x4 m com alpha em textura (alphaMode BLEND), montantes em x=+-2.35. gravestone: 3 lapides espacadas 1.5 m no mesmo arquivo.
