"""Fotos de frente e de lado (argila) com grade de 0,25 m, para posicionar os ossos.
Uso: python guia_rig.py <malha.glb> <pasta> [ossos.json]
Grade: linha forte a cada 1 m. Frente: eixo horizontal = X; lado: eixo horizontal = Y (direita = costas)."""
import sys, os, json, math
import bpy, numpy as np
from mathutils import Vector

ENT, OUT = sys.argv[1], sys.argv[2]
OSSOS = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ENT)
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
sc = bpy.context.scene
mat = bpy.data.materials.new("argila"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.77, 0.72, 1)
bpy.context.view_layer.material_override = mat
sc.render.engine = "CYCLES"; sc.cycles.samples = 12; sc.cycles.use_denoising = False
R = 1000
sc.render.resolution_x = sc.render.resolution_y = R
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.2, 0.22, 0.26, 1)
sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN")); sol.data.energy = 3.5
sol.rotation_euler = (math.radians(45), 0, math.radians(-20)); sc.collection.objects.link(sol)
v = np.array([tuple(mesh.matrix_world @ p.co) for p in mesh.data.vertices])
mn, mx = v.min(0), v.max(0); c = (mn + mx) / 2
S = float((mx - mn).max()) * 1.08
print(f"bbox min {np.round(mn, 2).tolist()} max {np.round(mx, 2).tolist()}")
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.type = "ORTHO"; cam.data.ortho_scale = S
sc.collection.objects.link(cam); sc.camera = cam

for vista, d, rot, eixo in (("frente", Vector((0, -1, 0)), (math.radians(90), 0, 0), 0),
                            ("lado", Vector((1, 0, 0)), (math.radians(90), 0, math.radians(90)), 1)):
    cam.location = Vector(c.tolist()) + d * S * 2
    cam.rotation_euler = rot
    p = f"{OUT}/guia_{vista}.png"; sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(p)
    a = np.array(im.pixels[:]).reshape(R, R, 4)  # linha 0 = baixo
    px = lambda h, cen: int(round((h - cen) / S * R + R / 2))
    for k in np.arange(math.floor(mn[eixo] * 4) / 4, mx[eixo] + 0.26, 0.25):
        u = px(k, c[eixo])
        if 0 <= u < R:
            forte = abs(k - round(k)) < 1e-6
            a[:, u, :3] = a[:, u, :3] * (0.3 if forte else 0.7) + (np.array([0.2, 0.6, 1]) * (0.7 if forte else 0.3))
    for k in np.arange(0, mx[2] + 0.26, 0.25):
        r = px(k, c[2])
        if 0 <= r < R:
            forte = abs(k - round(k)) < 1e-6
            a[r, :, :3] = a[r, :, :3] * (0.3 if forte else 0.7) + (np.array([0.2, 0.6, 1]) * (0.7 if forte else 0.3))
    for nome, (h, t) in OSSOS.items():
        for q, cor in ((h, (1, 0.1, 0.1)), (t, (1, 0.9, 0.1))):
            u, r = px(q[eixo], c[eixo]), px(q[2], c[2])
            a[max(r - 4, 0):r + 5, max(u - 4, 0):u + 5, :3] = cor
        for s in np.linspace(0, 1, 40):
            q = np.array(h) * (1 - s) + np.array(t) * s
            u, r = px(q[eixo], c[eixo]), px(q[2], c[2])
            if 0 <= u < R and 0 <= r < R:
                a[r - 1:r + 2, u - 1:u + 2, :3] = (1, 0.4, 0.1)
    im.pixels = a.ravel(); im.save()
    print(f"OK {p}  centro_{'xy'[eixo]}={c[eixo]:.2f} centro_z={c[2]:.2f} metros_por_pixel={S / R:.4f}")
