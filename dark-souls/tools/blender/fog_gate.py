"""Portao de nevoa: dois montantes de pedra + plano translucido 4 x 4 m (alpha em textura)."""
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

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

# plano de nevoa: t# plano de nevoa translucido
fm = bpy.data.materials.new('fog'); fm.use_nodes = True
fm.surface_render_method = 'BLENDED'
fm.use_backface_culling = False
nt = fm.node_tree; bs = nt.nodes['Principled BSDF']
vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
nt.links.new(vc.outputs['Color'], bs.inputs['Base Color'])
nt.links.new(vc.outputs['Alpha'], bs.inputs['Alpha'])
nt.links.new(vc.outputs['Color'], bs.inputs['Emission Color'])
bs.inputs['Emission Strength'].default_value = 0.6
bs.inputs['Roughness'].default_value = 1.0
# plano em grade 32x32; nevoa por vertex color (cor + alpha), esfumada nas bordas
G = 32
bm = bmesh.new()
grid = [[bm.verts.new((-2 + 4 * i / G, 0, 0.35 + 4 * j / G)) for i in range(G + 1)] for j in range(G + 1)]
for j in range(G):
    for i in range(G):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
if bm.faces[0].normal.y > 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
ca = bm.loops.layers.float_color.new('Col')
for f in bm.faces:
    for l in f.loops:
        u = (l.vert.co.x + 2) / 4; v = (l.vert.co.z - 0.35) / 4
        n = 0.5 + 0.5 * (math.sin(9 * u + 4 * math.sin(5 * v)) * math.sin(7 * v + 3 * u) * 0.6 + math.sin(21 * u + 13 * v) * 0.25)
        edge = min(1.0, min(u, 1 - u) * 6, min(v, 1 - v) * 3.5)
        a = (0.2 + 0.55 * n) * edge
        l[ca] = (0.78 + 0.15 * n, 0.85 + 0.1 * n, 0.95, a)
plane = from_bm('fog_plane', bm, fm)
finish('fog_gate', [o, plane])
