"""Portao de nevoa: dois montantes de pedra + plano translucido 4 x 4 m (alpha em textura)."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import numpy as np

random.seed(9)
reset()
stone = STONE('stone', moss=0.12)
objs = []
for sx in (-1, 1):
    x0 = sx * 2.35
    objs.append(box('base', (0.95, 0.9, 0.35), stone, loc=(x0, 0, 0.175)))
    sh = box('pillar', (0.7, 0.6, 4.1), stone, loc=(x0, 0, 0.35 + 2.05))
    mod_subsurf(sh, 3, True); mod_displace(sh, 0.04, 0.5)
    objs.append(sh)
    cp = box('top', (0.9, 0.8, 0.3), stone, loc=(x0, 0, 4.6))
    objs.append(cp)
    # ponta pontiaguda
    objs.append(sweep('spire', [(x0, 0, 4.75), (x0, 0, 5.0), (x0, 0, 5.3)], [0.32, 0.2, 0.02], 4, stone))
for o in objs:
    if o.name.startswith(('base', 'top')):
        mod_bevel(o, 0.04, 2, 50)
o = bake_group(objs, 'gate_stone', 1024)

# plano de nevoa: textura RGBA gerada com numpy (esfumada nas bordas, com ondas)
N = 256
rng = np.random.default_rng(4)
yy0, xx0 = np.mgrid[0:N, 0:N] / (N - 1)
def waves(k, fmax):
    out = np.zeros((N, N))
    for _ in range(k):
        fx, fy = rng.uniform(-fmax, fmax, 2)
        out += np.sin(2 * np.pi * (fx * xx0 + fy * yy0) + rng.uniform(0, 6.28)) * rng.uniform(0.5, 1)
    return out
nz = waves(10, 3) + 0.5 * waves(14, 9) + 0.5 * np.sin(2 * np.pi * (3 * xx0 + 2 * np.sin(5 * yy0)))
nz = (nz - nz.min()) / (nz.max() - nz.min())
yy, xx = np.mgrid[0:N, 0:N] / (N - 1)
edge = np.clip(np.minimum(np.minimum(xx, 1 - xx) * 6, np.minimum(yy, 1 - yy) * 3.5), 0, 1)
alpha = (0.25 + 0.5 * nz) * edge
rgb = np.stack([0.78 + 0.15 * nz, 0.85 + 0.1 * nz, 0.95 + 0 * nz], -1)
px = np.dstack([rgb, alpha])[::-1].reshape(-1)       # origem da imagem embaixo
img = bpy.data.images.new('fog_tex', N, N, alpha=True)
img.pixels = px.astype('float32').tolist()
img.pack()
fm = bpy.data.materials.new('fog'); fm.use_nodes = True
fm.surface_render_method = 'BLENDED'
fm.use_backface_culling = False
nt = fm.node_tree; bs = nt.nodes['Principled BSDF']
ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img
nt.links.new(ti.outputs['Color'], bs.inputs['Base Color'])
nt.links.new(ti.outputs['Alpha'], bs.inputs['Alpha'])
nt.links.new(ti.outputs['Color'], bs.inputs['Emission Color'])
bs.inputs['Emission Strength'].default_value = 0.6
bs.inputs['Roughness'].default_value = 1.0
bm = bmesh.new()
vs = [bm.verts.new(p) for p in ((-2, 0, 0.35), (2, 0, 0.35), (2, 0, 4.35), (-2, 0, 4.35))]
f = bm.faces.new(vs[::1]); 
uv = bm.loops.layers.uv.new('UVMap')
for l, uvv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    l[uv].uv = uvv
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
if f.normal.y > 0:
    bmesh.ops.reverse_faces(bm, faces=[f])  # frente para -Y (Blender)
plane = from_bm('fog_plane', bm, fm)
finish('fog_gate', [o, plane])
