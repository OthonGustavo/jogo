"""Utilidades comuns: geometria, materiais procedurais, bake, export e preview.
Convencoes: 1 unidade = 1 m, Z para cima no Blender; a FRENTE da peca aponta para
Blender -Y (vira +Z no glTF). Origem na base."""
import bpy, bmesh, math, os, sys, time
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "generated"))
PREV = os.path.join(OUT, "previews")
os.makedirs(PREV, exist_ok=True)
_T0 = time.time()


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'


# ---------------------------------------------------------------- geometria
def _xf(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return (Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4()
            @ Matrix.Diagonal((*scale, 1)))


def from_bm(name, bm, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), smooth=True):
    """Cria objeto; a transformacao e embutida nos vertices (objeto fica na origem)."""
    bmesh.ops.transform(bm, matrix=_xf(loc, rot, scale), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth
    return ob


def box(name, size, mat=None, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    kw.setdefault('smooth', False)
    return from_bm(name, bm, mat, **kw)


def ico(name, radius, mat=None, subdiv=1, **kw):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return from_bm(name, bm, mat, **kw)


def uvsphere(name, radius, mat=None, seg=8, rings=5, **kw):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=radius)
    return from_bm(name, bm, mat, **kw)


def sweep(name, pts, radii, seg=8, mat=None, caps=True, shape=(1, 1), twist=None, **kw):
    """Tubo ao longo de uma trilha de pontos. radii: numero ou lista (um por ponto).
    shape: escala (a,b) da secao; twist(i,n)->angulo extra (lamina espiralada)."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * n
    bm = bmesh.new()
    rings = []
    ref = Vector((0, 1, 0))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if abs(t.dot(ref)) > 0.95:
            ref = Vector((1, 0, 0))
        a = t.cross(ref).normalized()
        b = t.cross(a).normalized()
        r = radii[i]
        tw = twist(i, n) if twist else 0.0
        ring = []
        for k in range(seg):
            th = 2 * math.pi * k / seg + tw
            c, s = math.cos(th) * shape[0], math.sin(th) * shape[1]
            ring.append(bm.verts.new(p + (a * c + b * s) * r))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    if caps:
        for ring, rev in ((rings[0], True), (rings[-1], False)):
            try:
                bm.faces.new(ring[::-1] if rev else ring)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, mat, **kw)


def extrude_poly(name, pts2d, depth, mat=None, **kw):
    """Poligono no plano XZ extrudado ao longo de Y (centrado em y=0)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -depth / 2, z)) for x, z in pts2d]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=vv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    kw.setdefault('smooth', False)
    return from_bm(name, bm, mat, **kw)


# -------------------------------------------------------------- modificadores
_tex_i = [0]


def mod_subsurf(ob, levels=1, simple=False):
    m = ob.modifiers.new('sub', 'SUBSURF')
    m.subdivision_type = 'SIMPLE' if simple else 'CATMULL_CLARK'
    m.levels = m.render_levels = levels
    return m


def mod_displace(ob, strength, scale=0.5, depth=2, kind='CLOUDS', mid=0.5):
    _tex_i[0] += 1
    t = bpy.data.textures.new('nz%d' % _tex_i[0], kind)
    t.noise_scale = scale
    if hasattr(t, 'noise_depth'):
        t.noise_depth = depth
    m = ob.modifiers.new('disp', 'DISPLACE')
    m.texture = t
    m.strength = strength
    m.mid_level = mid
    return m


def mod_bevel(ob, width=0.02, segs=2, angle=40):
    m = ob.modifiers.new('bev', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    return m


def mod_boolean(ob, other, op='DIFFERENCE'):
    m = ob.modifiers.new('bool', 'BOOLEAN')
    m.object = other
    m.operation = op
    m.solver = 'EXACT'
    return m


def apply_mods(ob):
    if not ob.modifiers:
        return ob
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.materials.clear()
    for m in old.materials:
        me.materials.append(m)
    return ob


def smooth_auto(ob, angle=45):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        ob.select_set(False)
    except Exception:
        pass


def remove_objs(*obs):
    for o in obs:
        bpy.data.objects.remove(o, do_unlink=True)


# ------------------------------------------------------------------ materiais
def _n(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def make_mat(name, c1, c2, scale=3.0, grain=18.0, bump=0.4, rough=(0.55, 0.9),
             cracks=0.0, crack_scale=1.4, moss=0.0, mossc=(0.02, 0.045, 0.012),
             stretch=(1, 1, 1), c3=None):
    """Material procedural (para ser assado). c1->c2 por ruido; c3 opcional = manchas escuras
    (carvao/ferrugem). Metalico e aplicado so no material final."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    L = nt.links
    out = _n(nt, 'ShaderNodeOutputMaterial')
    bs = _n(nt, 'ShaderNodeBsdfPrincipled')
    L.new(bs.outputs['BSDF'], out.inputs['Surface'])
    tc = _n(nt, 'ShaderNodeTexCoord')

    def mapping(sc):
        mp = _n(nt, 'ShaderNodeMapping')
        mp.inputs['Scale'].default_value = tuple(sc * s for s in stretch)
        L.new(tc.outputs['Object'], mp.inputs['Vector'])
        return mp

    n1 = _n(nt, 'ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 1.0
    n1.inputs['Detail'].default_value = 7
    n1.inputs['Roughness'].default_value = 0.6
    L.new(mapping(scale).outputs['Vector'], n1.inputs['Vector'])
    n2 = _n(nt, 'ShaderNodeTexNoise')
    n2.inputs['Scale'].default_value = 1.0
    n2.inputs['Detail'].default_value = 3
    L.new(mapping(grain).outputs['Vector'], n2.inputs['Vector'])

    def math(op, a, b=None, clamp=False):
        mn = _n(nt, 'ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                mn.inputs[i].default_value = v
            else:
                L.new(v, mn.inputs[i])
        return mn.outputs[0]

    def rng(v, a, b, c=0.0, d=1.0):
        r = _n(nt, 'ShaderNodeMapRange')
        r.clamp = True
        for k, x in (('From Min', a), ('From Max', b), ('To Min', c), ('To Max', d)):
            r.inputs[k].default_value = x
        L.new(v, r.inputs['Value'])
        return r.outputs['Result']

    def mix(fac, ca, cb):
        mx = _n(nt, 'ShaderNodeMix', data_type='RGBA')
        L.new(fac, mx.inputs[0])
        for idx, c in ((6, ca), (7, cb)):
            if isinstance(c, tuple):
                mx.inputs[idx].default_value = (*c, 1.0)
            else:
                L.new(c, mx.inputs[idx])
        return mx.outputs[2]

    base_f = math('ADD', math('MULTIPLY', n1.outputs['Fac'], 0.7), math('MULTIPLY', n2.outputs['Fac'], 0.3))
    ramp = _n(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    L.new(rng(base_f, 0.3, 0.7), ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    if c3:  # manchas escuras
        spot = rng(n1.outputs['Fac'], 0.55, 0.75)
        col = mix(spot, col, tuple(c3))
    height = base_f
    if cracks > 0:
        vo = _n(nt, 'ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
        L.new(mapping(crack_scale).outputs['Vector'], vo.inputs['Vector'])
        cr = math('SUBTRACT', 1.0, rng(vo.outputs['Distance'], 0.0, 0.05))
        # so em parte das celulas: modula por ruido
        cr = math('MULTIPLY', cr, rng(n1.outputs['Fac'], 0.35, 0.6))
        cr = math('MULTIPLY', cr, cracks)
        col = mix(rng(cr, 0.0, 1.0, 0.0, 0.85), col, (0.01, 0.01, 0.01))
        height = math('SUBTRACT', height, math('MULTIPLY', cr, 0.9))
    rgh = rng(height, 0.2, 0.8, rough[1], rough[0])
    if moss > 0:
        gn = _n(nt, 'ShaderNodeNewGeometry')
        sep = _n(nt, 'ShaderNodeSeparateXYZ')
        L.new(gn.outputs['Normal'], sep.inputs['Vector'])
        mv = math('ADD', sep.outputs['Z'], math('MULTIPLY', math('SUBTRACT', n1.outputs['Fac'], 0.5), 1.4))
        t = 0.8 - 0.7 * moss
        fac = rng(mv, t, t + 0.18)
        mcol = mix(rng(n2.outputs['Fac'], 0.3, 0.7), mossc, tuple(v * 1.8 for v in mossc))
        col = mix(fac, col, mcol)
        rgh = math('MAXIMUM', rgh, math('MULTIPLY', fac, 0.95))
        height = math('ADD', height, math('MULTIPLY', fac, 0.25))
    bp = _n(nt, 'ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.03
    L.new(height, bp.inputs['Height'])
    L.new(col, bs.inputs['Base Color'])
    L.new(rgh, bs.inputs['Roughness'])
    L.new(bp.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value = 0.0
    return m


def STONE(name='stone', moss=0.0, tint=(1, 1, 1)):
    c1 = tuple(v * t for v, t in zip((0.10, 0.10, 0.105), tint))
    c2 = tuple(v * t for v, t in zip((0.27, 0.265, 0.25), tint))
    return make_mat(name, c1, c2, scale=2.5, grain=22, bump=0.9, cracks=1.0, moss=moss)


def RUST(name='rust'):
    return make_mat(name, (0.06, 0.06, 0.065), (0.22, 0.12, 0.065), scale=6, grain=40, bump=0.25,
                    rough=(0.45, 0.85), c3=(0.02, 0.018, 0.016))


def BURNT_WOOD(name='burnt_wood'):
    return make_mat(name, (0.008, 0.007, 0.006), (0.05, 0.035, 0.025), scale=5, grain=30, bump=0.7,
                    rough=(0.75, 0.98), stretch=(4, 4, 1), cracks=0.6, crack_scale=6)


def BONE(name='bone'):
    return make_mat(name, (0.25, 0.22, 0.17), (0.5, 0.46, 0.38), scale=8, grain=40, bump=0.15,
                    rough=(0.55, 0.8), c3=(0.15, 0.12, 0.08))


def ASH(name='ash'):
    return make_mat(name, (0.02, 0.02, 0.022), (0.11, 0.105, 0.10), scale=7, grain=45, bump=0.5,
                    rough=(0.9, 1.0))


# ------------------------------------------------------------------ bake
def _new_img(name, res, color=True):
    img = bpy.data.images.new(name, res, res, alpha=False)
    img.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return img


def bake_group(objs, name, res=512, metallic=0.0, samples=4):
    """Junta objs numa malha, Smart UV, assa cor+normal+rugosidade e troca por 1 material."""
    for o in objs:
        apply_mods(o)
        o.select_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    # triangulacao antes do UV (contagem real)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.012)
    bpy.ops.object.mode_set(mode='OBJECT')

    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 6
    sc.render.bake.use_clear = True
    imgs = {k: _new_img('%s_%s' % (name, k), res, k == 'color') for k in ('color', 'normal', 'rough')}
    mats = [m for m in ob.data.materials if m]
    for m in mats:
        nd = m.node_tree.nodes.new('ShaderNodeTexImage')
        nd.name = 'BAKE_TARGET'
        m.node_tree.nodes.active = nd
    passes = [('color', dict(type='DIFFUSE', pass_filter={'COLOR'})),
              ('normal', dict(type='NORMAL')),
              ('rough', dict(type='ROUGHNESS'))]
    for key, kw in passes:
        for m in mats:
            nd = m.node_tree.nodes['BAKE_TARGET']
            nd.image = imgs[key]
            m.node_tree.nodes.active = nd
        bpy.ops.object.bake(margin=6, use_clear=True, **kw)
    # material final (PBR com as tres texturas)
    fm = bpy.data.materials.new(name + '_baked')
    fm.use_nodes = True
    nt = fm.node_tree
    bs = nt.nodes['Principled BSDF']
    tcol = nt.nodes.new('ShaderNodeTexImage'); tcol.image = imgs['color']
    tnor = nt.nodes.new('ShaderNodeTexImage'); tnor.image = imgs['normal']
    trgh = nt.nodes.new('ShaderNodeTexImage'); trgh.image = imgs['rough']
    nm = nt.nodes.new('ShaderNodeNormalMap')
    sp = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tcol.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(tnor.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(trgh.outputs['Color'], sp.inputs['Color'])
    nt.links.new(sp.outputs['Green'], bs.inputs['Roughness'])
    bs.inputs['Metallic'].default_value = metallic
    ob.data.materials.clear()
    ob.data.materials.append(fm)
    for m in mats:
        bpy.data.materials.remove(m)
    for p in ob.data.polygons:
        p.material_index = 0
    return ob


# ------------------------------------------------------------- export/preview
def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def tri_count(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def export_glb(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True,
                              export_image_format='JPEG', export_jpeg_quality=82,
                              export_cameras=False, export_lights=False)
    return path


def preview(name, objs, target_h=None, light_warm=False):
    lo, hi = bbox(objs)
    ctr = (lo + hi) / 2
    size = max(hi - lo)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 640, 480
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.09, 0.09, 0.10, 1)
    bg.inputs[1].default_value = 1.0
    sc.world = w
    # chao
    gm = bpy.data.materials.new('gm'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.05, 0.05, 0.055, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    g = box('ground', (size * 6, size * 6, 0.1), gm, loc=(0, 0, -0.05))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    d = Vector((0.75, -1.0, 0.6)).normalized()
    cam.location = ctr + d * size * 2.5
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.0
    sun.data.color = (0.8, 0.85, 1.0)
    sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
    sc.collection.objects.link(sun)
    pl = bpy.data.objects.new('warm', bpy.data.lights.new('warm', 'POINT'))
    pl.data.energy = 120 * size
    pl.data.color = (1.0, 0.55, 0.25)
    pl.location = ctr + Vector((-size * 0.6, -size * 0.9, size * 0.5))
    pl.data.shadow_soft_size = 0.3
    sc.collection.objects.link(pl)
    sc.render.filepath = os.path.join(PREV, name + '.png')
    bpy.ops.render.render(write_still=True)


def finish(name, groups_objs, preview_objs=None):
    """groups_objs: lista de objetos ja assados (ou materiais proprios). Exporta e gera preview."""
    export_glb(name, groups_objs)
    lo, hi = bbox(groups_objs)
    info = dict(name=name, tris=tri_count(groups_objs), dims=tuple(round(v, 2) for v in (hi - lo)),
                size_kb=round(os.path.getsize(os.path.join(OUT, name + '.glb')) / 1024))
    preview(name, groups_objs)
    print('RESULT', info, 'tempo %.0fs' % (time.time() - _T0))
    return info
