"""Tres lapides inclinadas com musgo (arredondada, cruz, quebrada) num so arquivo."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from common import _xf

random.seed(5)
reset()
stone = STONE('stone', moss=0.55)
dirt = make_mat('dirt', (0.015, 0.012, 0.01), (0.07, 0.05, 0.035), scale=5, grain=30, bump=0.5,
                rough=(0.9, 1.0), moss=0.35)
objs = []

def tilt(o, loc, rx, rz):
    o.data.transform(_xf(loc, (rx, 0, rz)))

def arc_top(w, h, n=8):
    pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h - w / 2)]
    for k in range(1, n):
        a = math.pi * k / n
        pts.append((w / 2 * math.cos(a), h - w / 2 + w / 2 * math.sin(a)))
    pts.append((-w / 2, h - w / 2))
    return pts

def slab(name, pts, depth, loc, rx, rz, disp=0.03):
    o = extrude_poly(name, pts, depth, stone)
    # triangular + subdivisao simples para o deslocamento
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free()
    mod_subsurf(o, 2, True)
    mod_displace(o, disp, 0.25 + random.random() * 0.1)
    apply_mods(o)
    tilt(o, loc, rx, rz)
    return o

# 1) arredondada
objs.append(slab('round', arc_top(0.7, 1.1), 0.16, (-1.5, 0, 0.0), math.radians(-7), math.radians(8)))
# relevo de cruz na frente
cr = [box('c1', (0.05, 0.015, 0.4), stone, loc=(0, 0, 0)), box('c2', (0.24, 0.015, 0.05), stone, loc=(0, 0, 0.08))]
for c in cr:
    tilt(c, (-1.5, -0.085, 0.72), math.radians(-7), math.radians(8)); objs.append(c)
# 2) cruz
cross = [(-0.09, 0), (0.09, 0), (0.09, 0.55), (0.3, 0.55), (0.3, 0.75), (0.09, 0.75), (0.09, 1.1),
         (-0.09, 1.1), (-0.09, 0.75), (-0.3, 0.75), (-0.3, 0.55), (-0.09, 0.55)]
objs.append(slab('cross', cross, 0.14, (0.0, 0.1, 0.0), math.radians(6), math.radians(-15), 0.025))
# 3) quebrada
brk = [(-0.4, 0), (0.4, 0), (0.4, 0.55), (0.25, 0.7), (0.1, 0.62), (-0.05, 0.92), (-0.22, 0.8), (-0.4, 0.6)]
objs.append(slab('broken', brk, 0.18, (1.5, 0.05, 0.0), math.radians(-4), math.radians(20), 0.035))
# montes de terra e lascas
for x, y, s in [(-1.5, 0.35, 0.5), (0.0, 0.45, 0.45), (1.5, 0.4, 0.5)]:
    o = ico('mound', s, dirt, 2, loc=(x, y, 0.0), scale=(1.1, 1.0, 0.28))
    mod_displace(o, 0.03, 0.3)
    objs.append(o)
o = ico('shard', 0.12, stone, 1, loc=(1.1, -0.35, 0.05), rot=(1, 0.5, 2), scale=(1.2, 0.8, 0.5))
mod_displace(o, 0.03, 0.2); objs.append(o)

o = bake_group(objs, 'gravestone', 1024)
finish('gravestone', [o])
