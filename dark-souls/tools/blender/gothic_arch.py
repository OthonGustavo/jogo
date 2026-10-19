"""Arco gotico ogival: vao livre de 4 m (x) por 5 m (z) no apice; 2 pilares + arco com desgaste."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from common import _xf

random.seed(3)
reset()
stone = STONE('stone', moss=0.2)
objs = []
SPAN, SPRING, RISE = 4.0, 2.6, 2.4          # vao, altura da imposta, flecha (apice = 5.0)
R = (RISE ** 2 + (SPAN / 2) ** 2) / SPAN     # raio dos arcos ogivais
C = SPAN / 2 - R                              # centro do arco esquerdo em x=-C... (ver abaixo)
T, D = 0.6, 0.85                              # espessura radial e profundidade do arco

def arc_pts(cx, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * k / n), SPRING + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]

# arco esquerdo: parte de (-2, SPRING) com centro em (+(R-2), SPRING); lado direito espelhado
cx = R - SPAN / 2
a_in = math.acos(-cx / R)             # angulo em que x=0 (interno)
a_out = math.acos(-cx / (R + T))
nL = 12
inner = arc_pts(cx, R, math.pi, a_in, nL)             # (-2,spring) -> apice
outer = arc_pts(cx, R + T, math.pi, a_out, nL)         # (-2-T,spring) -> apice externo
mir = lambda pts: [(-x, z) for x, z in pts]
poly = inner + mir(inner)[::-1][1:] + mir(outer)[1:] + outer[::-1]
# poligono: interno esq->dir, depois externo dir->esq
poly = inner[:-1] + mir(inner)[::-1] + mir(outer) [:-0 or None]
# reconstroi com ordem correta
inner_full = inner[:-1] + mir(inner)[::-1]       # esquerda -> direita (pela borda interna)
outer_full = outer[:-1] + mir(outer)[::-1]
poly = inner_full + outer_full[::-1]
ring = extrude_poly('arch_band', poly, D, stone)
bm = bmesh.new(); bm.from_mesh(ring.data)
bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(ring.data); bm.free()
mod_subsurf(ring, 1, True)
mod_displace(ring, 0.035, 0.4)
# lasca arrancada no canto externo direito
chip = ico('chip', 0.42, stone, 1, loc=(1.95, -0.35, 4.55), scale=(1, 1, 0.9))
mod_boolean(ring, chip)
mod_bevel(ring, 0.025, 2, 50)
apply_mods(ring)
remove_objs(chip)
objs.append(ring)

# pilares
for sx in (-1, 1):
    x0 = sx * (SPAN / 2 + T / 2 + 0.05)
    objs.append(box('base', (T + 0.45, D + 0.2, 0.4), stone, loc=(x0, 0, 0.2)))
    sh = box('shaft', (T + 0.1, D - 0.05, SPRING - 0.4 - 0.35), stone, loc=(x0, 0, 0.4 + (SPRING - 0.75) / 2))
    mod_subsurf(sh, 3, True); mod_displace(sh, 0.03, 0.5)
    objs.append(sh)
    # semi-colunas coladas (nervuras) na frente
    for sy in (-1, 1):
        objs.append(sweep('rib', [(x0, sy * (D / 2 + 0.02), 0.4), (x0, sy * (D / 2 + 0.02), SPRING - 0.35)],
                          0.1, 8, stone, loc=(0, 0, 0)))
    objs.append(box('cap', (T + 0.4, D + 0.15, 0.35), stone, loc=(x0, 0, SPRING - 0.175)))
    # arranque do arco entre capitel e arco (ja encosta em z=SPRING)
for o in objs:
    if o.name.startswith(('base', 'cap')):
        mod_bevel(o, 0.035, 2, 50)
o = bake_group(objs, 'gothic_arch', 1024)
finish('gothic_arch', [o])
