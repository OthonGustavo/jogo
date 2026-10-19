"""Folhas de quadros de cada animação (frente + lado, cor argila) para conferir deformação.
Uso: python fotos_animacao.py <animado.glb> <pasta_saida> [acao:passo ...]   ex.: Andar:2 Ataque:3"""
import sys, os, math
import bpy, numpy as np
from mathutils import Vector

ENT, OUT = sys.argv[1], sys.argv[2]
PEDIDOS = [a.split(":") for a in sys.argv[3:]] or [["Parado", "6"], ["Andar", "2"], ["Ataque", "3"], ["Voar", "2"]]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ENT)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
sc = bpy.context.scene

# argila clara: deformação fica visível
mat = bpy.data.materials.new("argila")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.72, 0.68, 1)
bpy.context.view_layer.material_override = mat
sc.render.engine = "CYCLES"
sc.cycles.samples = 6
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 250, 290
sc.render.film_transparent = False
w = bpy.data.worlds.new("w"); sc.world = w
w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.25, 0.27, 0.32, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN"))
sol.data.energy = 3.5; sol.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
sc.collection.objects.link(sol)

v = np.array([tuple(mesh.matrix_world @ p.co) for p in mesh.data.vertices])
mn, mx = v.min(0), v.max(0)
c = Vector(((mn + mx) / 2).tolist())
H = float(mx[2] - mn[2])
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"; cam.data.ortho_scale = H * 1.45
sc.collection.objects.link(cam); sc.camera = cam
VISTAS_TODAS = {"tras": (Vector((0, 1, 0)), (math.radians(90), 0, math.radians(180))), "frente": (Vector((0, -1, 0)), (math.radians(90), 0, 0)),
          "lado": (Vector((1, 0, 0)), (math.radians(90), 0, math.radians(90)))}
VISTAS = {k: VISTAS_TODAS[k] for k in os.environ.get("VISTAS", "frente,lado").split(",")}


def pixels(path):
    im = bpy.data.images.load(path)
    a = np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)
    bpy.data.images.remove(im)
    return a


for nome, passo in PEDIDOS:
    acao = next(a for a in bpy.data.actions if a.name.startswith(nome))
    arm.animation_data_create()
    arm.animation_data.action = acao
    if hasattr(arm.animation_data, "action_suitable_slots") and arm.animation_data.action_suitable_slots:
        arm.animation_data.action_slot = arm.animation_data.action_suitable_slots[0]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    f0, f1 = map(int, acao.frame_range)
    quadros = list(range(f0, f1 + 1, int(passo)))
    linhas = []
    for vista, (d, rot) in VISTAS.items():
        cam.location = c + d * H * 3 + Vector((0, 0, H * 0.12))
        cam.rotation_euler = rot
        # de lado: corta a asa da frente (tudo com x > 0,85 m) para ver pernas, braço e tronco
        cam.data.clip_start = H * 3 - 0.85 if vista == "lado" else 0.1
        cam.data.clip_end = H * 6
        fila = []
        for f in quadros:
            sc.frame_set(f)
            p = f"{OUT}/_{nome}_{vista}_{f}.png"
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            fila.append(pixels(p)); os.remove(p)
        linhas.append(fila)
    # folhas de 8 quadros: linha de cima frente, de baixo lado
    for k in range(0, len(quadros), 8):
        blocos = [np.concatenate(l[k:k + 8] + [np.zeros_like(l[0])] * (8 - len(l[k:k + 8])), axis=1) for l in linhas]
        folha = np.concatenate(blocos[::-1], axis=0)  # imagem do Blender é de baixo para cima
        im = bpy.data.images.new("f", folha.shape[1], folha.shape[0])
        im.pixels = folha.ravel()
        im.filepath_raw = f"{OUT}/{nome}_{k // 8 + 1}.png"; im.file_format = "PNG"; im.save()
        print(f"OK folha {nome}_{k // 8 + 1}.png quadros {quadros[k:k + 8]}")
print("PRONTO")
