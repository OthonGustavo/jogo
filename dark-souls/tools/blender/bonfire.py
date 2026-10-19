"""Fogueira: cinzas, pedras, ossos, toras queimadas + espada espiralada cravada."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

random.seed(7)
reset()
stone, ash, bone, wood, rust = STONE('stone', moss=0.15), ASH(), BONE(), BURNT_WOOD(), RUST()
body, metal = [], []

# cinzas
a = ico('ash', 0.8, ash, 2, scale=(1, 1, 0.16), loc=(0, 0, 0.04))
mod_displace(a, 0.05, 0.3)
body.append(a)
# anel de pedras
N = 11
for i in range(N):
    th = 2 * math.pi * i / N + random.uniform(-.1, .1)
    r = 0.78 + random.uniform(-.04, .06)
    s = random.uniform(0.7, 1.0)
    o = ico('rock%d' % i, 0.2, stone, 1, loc=(math.cos(th) * r, math.sin(th) * r, 0.09),
            rot=(random.uniform(0, 3), random.uniform(0, 3), th),
            scale=(1.1 * s, 0.85 * s, 0.65 * s))
    mod_subsurf(o, 1, simple=True)
    mod_displace(o, 0.07, 0.25 + 0.05 * i)
    body.append(o)
# ossos
for i in range(7):
    th = 2 * math.pi * i / 7 + 0.3
    r = 0.55 + random.uniform(-.05, .05)
    c = (math.cos(th) * r, math.sin(th) * r, 0.12)
    ang = th + math.pi / 2 + random.uniform(-.5, .5)
    d = (math.cos(ang), math.sin(ang), 0)
    L = random.uniform(0.16, 0.26)
    p0 = (c[0] - d[0] * L / 2, c[1] - d[1] * L / 2, c[2])
    p1 = (c[0] + d[0] * L / 2, c[1] + d[1] * L / 2, c[2])
    body.append(sweep('bone%d' % i, [p0, c, p1], [0.03, 0.024, 0.03], 6, bone))
    for p in (p0, p1):
        body.append(uvsphere('bk', 0.042, bone, 6, 4, loc=p, scale=(1, 1, 0.9)))
# toras queimadas
for i in range(6):
    th = 2 * math.pi * i / 6 + random.uniform(-.2, .2)
    r0 = 0.5
    base = (math.cos(th) * r0, math.sin(th) * r0, 0.08)
    top = (math.cos(th) * 0.09, math.sin(th) * 0.09, 0.62 + random.uniform(-.08, .1))
    pts = [tuple(base[k] + (top[k] - base[k]) * t / 5 for k in range(3)) for t in range(6)]
    rad = [0.075 - 0.005 * t + random.uniform(-.008, .008) for t in range(6)]
    lg = sweep('log%d' % i, pts, rad, 8, wood)
    mod_displace(lg, 0.035, 0.12 + 0.02 * i)
    body.append(lg)

# espada espiralada (cravada no centro)
zb, zt = 0.04, 1.0
n = 18
blade_pts = [(0, 0, zb + (zt - zb) * k / (n - 1)) for k in range(n)]
rad = [0.034 * (1 - 0.75 * max(0, (k - (n - 4)) / 3.0)) if k >= n - 4 else 0.034 for k in range(n)]
rad[-1] = 0.004
metal.append(sweep('blade', blade_pts, rad, 4, rust, shape=(1.0, 0.28),
                   twist=lambda i, n: i * 0.22 + math.pi / 4))
# espiral ao redor da lamina
hp = []
turns, steps = 3.2, 30
for k in range(steps):
    t = k / (steps - 1)
    ang = turns * 2 * math.pi * t
    hp.append((0.05 * math.cos(ang), 0.05 * math.sin(ang), 0.15 + 0.7 * t))
metal.append(sweep('spiral', hp, 0.0085, 5, rust, caps=True))
metal.append(box('guard', (0.30, 0.045, 0.035), rust, loc=(0, 0, 1.015)))
for sx in (-1, 1):
    metal.append(ico('gtip', 0.028, rust, 1, loc=(sx * 0.155, 0, 1.015), scale=(1, 1, 0.8)))
grip = [(0, 0, 1.03 + 0.19 * k / 8) for k in range(9)]
metal.append(sweep('grip', grip, [0.02 if k % 2 == 0 else 0.026 for k in range(9)], 6, BURNT_WOOD('wood2')))
metal.append(uvsphere('pommel', 0.037, rust, 8, 5, loc=(0, 0, 1.245)))

b = bake_group(body, 'bonfire_body', 1024)
m = bake_group(metal, 'bonfire_sword', 512, metallic=0.75)
finish('bonfire', [b, m])
