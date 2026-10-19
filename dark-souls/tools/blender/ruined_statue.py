"""Estatua em ruina: figura encapuzada sobre pedestal, braco direito quebrado (frente = -Y)."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from common import _xf

random.seed(21)
reset()
stone = STONE('stone', moss=0.3)
fig = make_mat('fig', (0.04, 0.04, 0.045), (0.14, 0.135, 0.125), scale=3, grain=20, bump=0.6, cracks=0.25, crack_scale=2.5, moss=0.2)
dark = make_mat('void', (0.01, 0.01, 0.012), (0.03, 0.03, 0.035), scale=4, bump=0.1)
objs = []
# pedestal em degraus
objs.append(box('step', (1.5, 1.5, 0.25), stone, loc=(0, 0, 0.125)))
objs.append(box('ped', (1.1, 1.1, 0.75), stone, loc=(0, 0, 0.625)))
objs.append(box('ped_top', (1.3, 1.3, 0.12), stone, loc=(0, 0, 1.06)))
for o in objs:
    mod_subsurf(o, 2, True); mod_displace(o, 0.025, 0.45); mod_bevel(o, 0.03, 2, 50)
ped_n = len(objs)
Z0 = 1.12
# manto (silhueta de tunica), base mais larga que ombros
pts = [(0, 0, Z0 + h) for h in (0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.05, 1.18, 1.28, 1.34)]
rad = [0.34, 0.33, 0.29, 0.25, 0.22, 0.2, 0.21, 0.19, 0.12, 0.05]
robe = sweep('robe', pts, rad, 16, fig, shape=(1.0, 0.75), twist=lambda i, n: 0.0)
mod_displace(robe, 0.03, 0.4)
# pregas: ondulacao radial via displace adicional
mod_displace(robe, 0.02, 0.12, 2)
objs.append(robe)
# capuz (esfera alongada, ponta para tras) e vazio do rosto
hood = uvsphere('hood', 0.17, fig, 14, 9, loc=(0, 0.02, Z0 + 1.5), scale=(1.0, 1.15, 1.25))
mod_displace(hood, 0.015, 0.2)
objs.append(hood)
objs.append(sweep('hood_tail', [(0, 0.1, Z0 + 1.55), (0, 0.22, Z0 + 1.45), (0, 0.27, Z0 + 1.25)], [0.14, 0.11, 0.05], 8, fig))
objs.append(uvsphere('face', 0.11, dark, 10, 6, loc=(0, -0.14, Z0 + 1.47), scale=(0.85, 0.7, 1.15)))
# braco esquerdo dobrado, mao sobre o peito
objs.append(sweep('arm_l', [(0.2, -0.02, Z0 + 1.2), (0.3, -0.12, Z0 + 0.95), (0.22, -0.28, Z0 + 0.95), (0.08, -0.3, Z0 + 1.08)],
                  [0.075, 0.07, 0.06, 0.05], 8, fig))
# braco direito quebrado no cotovelo (estendido para frente, interrompido)
arm = sweep('arm_r', [(-0.2, -0.02, Z0 + 1.2), (-0.3, -0.1, Z0 + 0.98), (-0.34, -0.2, Z0 + 0.88)],
            [0.08, 0.07, 0.06], 8, fig, caps=True)
mod_displace(arm, 0.025, 0.1)
objs.append(arm)
# antebraco caido no pedestal
fa = sweep('forearm', [(0, 0, 0), (0.12, -0.12, 0), (0.28, -0.25, 0.02)], [0.058, 0.05, 0.04], 8, fig)
fa.data.transform(_xf((-0.1, -0.1, 1.18), (0, 0, 0.3)))
mod_displace(fa, 0.02, 0.1)
objs.append(fa)
objs.append(ico('rubble', 0.1, fig, 1, loc=(0.35, -0.3, 1.18), scale=(1.3, 0.9, 0.5)))
objs.append(ico('rubble2', 0.12, fig, 1, loc=(0.9, -0.5, 0.1), scale=(1.2, 0.9, 0.6)))
objs[-1].modifiers.new('s', 'SUBSURF')
for o in objs[ped_n:-1]:
    o.data.transform(Matrix.Translation((0, 0, Z0)) @ Matrix.Scale(1.25, 4) @ Matrix.Translation((0, 0, -Z0)))
objs[-1].data.materials[0] = stone
o = bake_group(objs, 'ruined_statue', 1024)
finish('ruined_statue', [o])
