"""Pilar quebrado: base, fuste em tambores com caneluras, topo irregular, capitel e blocos caidos."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from common import _xf

random.seed(11)
reset()
stone = STONE('stone', moss=0.25)
objs = []

# base (plinto + toro)
objs.append(box('plinth', (1.5, 1.5, 0.3), stone, loc=(0, 0, 0.15)))
objs[-1].modifiers.new('b', 'BEVEL').width = 0.03
tor = sweep('torus', [(0, 0, 0.3), (0, 0, 0.38), (0, 0, 0.46)], [0.66, 0.68, 0.58], 24, stone)
objs.append(tor)

# fuste: aneis em z com caneluras, tambores com junta marcada
SEG, R = 32, 0.5
zs, rs = [], []
z = 0.46
drum = 0.85
joints = [0.46 + drum * k for k in range(1, 4)]
while z < 3.3:
    zs.append(z)
    z += 0.17
zs += [j for j in joints] + [j + 0.02 for j in joints] + [j - 0.02 for j in joints]
zs = sorted(set(round(v, 3) for v in zs))
bm = bmesh.new()
rings = []
def cut(x, y):  # superficie de fratura (topo irregular inclinado)
    return 2.75 + 0.55 * (x / R) + 0.18 * math.sin(7 * x + 2 * y) + random.uniform(-0.05, 0.05)
for zz in zs:
    taper = 1 - 0.07 * (zz - 0.46) / 3
    near_joint = any(abs(zz - j) < 0.03 for j in joints)
    ring = []
    for k in range(SEG):
        th = 2 * math.pi * k / SEG
        r = R * taper * (1 + 0.07 * math.cos(8 * th)) * (0.96 if near_joint else 1)
        x, y = r * math.cos(th), r * math.sin(th)
        ring.append(bm.verts.new((x, y, min(zz, cut(x, y)))))
    rings.append(ring)
for i in range(len(rings) - 1):
    for k in range(SEG):
        k2 = (k + 1) % SEG
        bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
bm.faces.new(rings[0][::-1])
c = bm.verts.new((0, 0, 2.9))
top = rings[-1]
for k in range(SEG):
    bm.faces.new((top[k], top[(k + 1) % SEG], c))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
shaft = from_bm('shaft', bm, stone)
mod_displace(shaft, 0.03, 0.35, 3)
objs.append(shaft)

# blocos caidos: capitel e tambor tombado e lascas
cap = box('capital', (1.1, 1.1, 0.35), stone, loc=(0, 0, 0))
mod_bevel(cap, 0.04)
cap2 = sweep('capital_neck', [(0, 0, 0.17), (0, 0, 0.45), (0, 0, 0.6)], [0.58, 0.5, 0.45], 16, stone)
capm = [cap, cap2]
for o in capm:
    for v in o.data.vertices:
        pass
# posicionar capitel tombado ao lado (rotacao embutida)
import bmesh as _b
def place(o, loc, rot):
    m = _xf(loc, rot)
    me = o.data
    me.transform(m)
    me.update()
for o in capm:
    place(o, (1.45, -0.55, 0.55), (math.radians(90), 0, math.radians(25)))
    objs.append(o)
dr = sweep('fallen_drum', [(0, 0, -0.42), (0, 0, 0), (0, 0, 0.42)], [0.45, 0.46, 0.45], 16, stone)
mod_displace(dr, 0.04, 0.3)
place(dr, (-1.15, -0.8, 0.45), (math.radians(90), 0, math.radians(-30)))
objs.append(dr)
for i, (x, y, s) in enumerate([(0.9, 0.75, 0.3), (-0.8, 0.9, 0.22), (1.2, 0.3, 0.18)]):
    o = ico('chunk%d' % i, s, stone, 1, loc=(x, y, s * 0.5), rot=(i, 2 * i, 1), scale=(1, 0.8, 0.7))
    mod_subsurf(o, 1, True); mod_displace(o, 0.05, 0.25)
    objs.append(o)

o = bake_group(objs, 'broken_pillar', 1024)
finish('broken_pillar', [o])
