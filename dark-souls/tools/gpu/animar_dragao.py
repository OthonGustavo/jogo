"""Rig + animações do dragão (bípede com asas). Rodar com o python do Blender (.bvenv).
Uso: python animar_dragao.py <entrada.glb> <saida.glb>"""
import sys, math
import bpy, numpy as np
from mathutils import Vector, Quaternion

ENTRADA, SAIDA = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ENTRADA)
malhas = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in malhas:
    o.select_set(True)
bpy.context.view_layer.objects.active = malhas[0]
if len(malhas) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
for o in list(bpy.data.objects):
    if o.type == "EMPTY":
        for c in list(o.children):
            m = c.matrix_world.copy(); c.parent = None; c.matrix_world = m
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

v = np.array([tuple(p.co) for p in mesh.data.vertices])
mn, mx = v.min(0), v.max(0)
cx, cy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2
W, D, H = mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]
z0 = mn[2]
print(f"AVISO bbox {W:.2f} x {D:.2f} x {H:.2f}")


def P(x, y, z):  # x lateral (fração de W), y profundidade (fração de D, +=trás), z altura (fração de H)
    return Vector((cx + x * W, cy + y * D, z0 + z * H))


# (nome, pai, início, fim)
OSSOS = [
    ("Hips", None, P(0, 0.05, .40), P(0, 0.05, .50)),
    ("Spine", "Hips", P(0, 0.05, .50), P(0, 0.03, .62)),
    ("Chest", "Spine", P(0, 0.03, .62), P(0, 0.0, .74)),
    ("Neck", "Chest", P(0, 0.0, .74), P(0, -0.05, .84)),
    ("Head", "Neck", P(0, -0.05, .84), P(0, -0.12, .97)),
    ("Tail1", "Hips", P(0, 0.05, .40), P(0, 0.30, .30)),
    ("Tail2", "Tail1", P(0, 0.30, .30), P(0.05, 0.42, .22)),
    ("Tail3", "Tail2", P(0.05, 0.42, .22), P(0.10, 0.50, .18)),
]
for s, k in (("L", 1), ("R", -1)):
    OSSOS += [
        (f"Thigh.{s}", "Hips", P(k * .06, 0.05, .40), P(k * .07, 0.0, .20)),
        (f"Shin.{s}", f"Thigh.{s}", P(k * .07, 0.0, .20), P(k * .07, 0.0, .08)),
        (f"Foot.{s}", f"Shin.{s}", P(k * .07, 0.0, .08), P(k * .07, -0.12, .02)),
        (f"UpperArm.{s}", "Chest", P(k * .10, 0.0, .70), P(k * .17, -0.02, .56)),
        (f"Forearm.{s}", f"UpperArm.{s}", P(k * .17, -0.02, .56), P(k * .21, -0.05, .42)),
        (f"Wing1.{s}", "Chest", P(k * .10, 0.10, .70), P(k * .28, 0.10, .84)),
        (f"Wing2.{s}", f"Wing1.{s}", P(k * .28, 0.10, .84), P(k * .40, 0.10, .60)),
    ]

arm_d = bpy.data.armatures.new("Armadura")
arm = bpy.data.objects.new("Armadura", arm_d)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for nome, pai, a, b in OSSOS:
    e = arm_d.edit_bones.new(nome)
    e.head, e.tail = a, b
    if pai:
        e.parent = arm_d.edit_bones[pai]
bpy.ops.object.mode_set(mode="OBJECT")

# pesos por distância ao segmento do osso (rápido e previsível)
nomes = [o[0] for o in OSSOS]
dist = np.zeros((len(v), len(OSSOS)))
for i, (_, _, a, b) in enumerate(OSSOS):
    a, b = np.array(a), np.array(b)
    ab = b - a
    t = np.clip(((v - a) @ ab) / (ab @ ab), 0, 1)
    dist[:, i] = np.linalg.norm(v - (a + t[:, None] * ab), axis=1)
w = 1.0 / (dist + 0.02) ** 4
mantem = np.argsort(-w, axis=1)[:, :3]
mask = np.zeros_like(w, dtype=bool)
np.put_along_axis(mask, mantem, True, axis=1)
w = np.where(mask, w, 0)
w /= w.sum(1, keepdims=True)
grupos = [mesh.vertex_groups.new(name=n) for n in nomes]
for vi in range(len(v)):
    for bi in mantem[vi]:
        if w[vi, bi] > 0.01:
            grupos[bi].add([vi], float(w[vi, bi]), "REPLACE")
mesh.parent = arm
mod = mesh.modifiers.new("Armadura", "ARMATURE")
mod.object = arm

# ---------- animações ----------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
EX, EY, EZ = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def gira(nome, eixo, graus, f):
    pb = arm.pose.bones[nome]
    R = pb.bone.matrix_local.to_3x3()
    eixo_local = R.inverted() @ Vector(eixo)
    pb.rotation_mode = "QUATERNION"
    q = Quaternion(eixo_local.normalized(), math.radians(graus))
    pb.rotation_quaternion = q
    pb.keyframe_insert("rotation_quaternion", frame=f)


def move(nome, dz, f, dy=0.0):
    pb = arm.pose.bones[nome]
    pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, dy, dz))
    pb.keyframe_insert("location", frame=f)


def reset(f):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.keyframe_insert("rotation_quaternion", frame=f)
        pb.location = (0, 0, 0)
        pb.keyframe_insert("location", frame=f)


def nova(nome, n):
    a = bpy.data.actions.new(nome)
    a.use_fake_user = True
    arm.animation_data_create().action = a
    reset(1)
    return a


def senoide(n, passos=8):
    return [1 + round(i * n / passos) for i in range(passos + 1)]


# parado: respirar
n = 60
nova("Parado", n)
for f in senoide(n):
    t = (f - 1) / n * 2 * math.pi
    gira("Chest", EY, 0, f)
    gira("Spine", EX, 2 * math.sin(t), f)
    gira("Chest", EX, 3 * math.sin(t), f)
    gira("Head", EX, -2 * math.sin(t + .5), f)
    gira("Tail1", EZ, 6 * math.sin(t), f)
    gira("Tail2", EZ, 10 * math.sin(t - .6), f)
    gira("Tail3", EZ, 14 * math.sin(t - 1.2), f)
    for s, k in (("L", 1), ("R", -1)):
        gira(f"Wing1.{s}", EY, -k * 4 * math.sin(t), f)
        gira(f"UpperArm.{s}", EX, 2 * math.sin(t), f)

# andar
n = 32
nova("Andar", n)
for f in senoide(n):
    t = (f - 1) / n * 2 * math.pi
    for s, ph in (("L", 0), ("R", math.pi)):
        k = 1 if s == "L" else -1
        gira(f"Thigh.{s}", EX, 28 * math.sin(t + ph), f)
        gira(f"Shin.{s}", EX, -18 - 18 * math.sin(t + ph + math.pi / 2), f)
        gira(f"UpperArm.{s}", EX, -20 * math.sin(t + ph), f)
        gira(f"Wing1.{s}", EY, -k * (5 + 3 * math.sin(2 * t)), f)
    gira("Hips", EZ, 6 * math.sin(t), f)
    gira("Chest", EZ, -8 * math.sin(t), f)
    gira("Head", EZ, 5 * math.sin(t), f)
    gira("Tail1", EZ, 14 * math.sin(t + math.pi), f)
    gira("Tail2", EZ, 18 * math.sin(t + math.pi - .5), f)
    gira("Tail3", EZ, 22 * math.sin(t + math.pi - 1), f)
    move("Hips", 0.05 * H * abs(math.sin(t)), f)

# ataque: recua, avança, morde e volta
n = 40
nova("Ataque", n)
pose = {  # frame: (peito, cabeça, braçoD, braçoE, asa, cauda)
    1: (0, 0, 0, 0, 0, 0),
    10: (-18, -15, -50, 10, 15, -15),
    16: (22, 25, 55, -20, -10, 25),
    22: (30, 30, 70, -25, -15, 30),
    32: (10, 8, 20, -5, 0, 10),
    40: (0, 0, 0, 0, 0, 0),
}
for f, (pe, ca, bd, be, asa, ct) in pose.items():
    gira("Spine", EX, pe * .5, f)
    gira("Chest", EX, pe * .5, f)
    gira("Neck", EX, ca * .5, f)
    gira("Head", EX, ca * .5, f)
    gira("UpperArm.R", EX, -bd, f)
    gira("Forearm.R", EX, -bd * .5, f)
    gira("UpperArm.L", EX, -be, f)
    gira("Wing1.L", EY, -asa, f)
    gira("Wing1.R", EY, asa, f)
    gira("Tail1", EX, -ct * .3, f)
    gira("Tail2", EZ, ct * .6, f)
    move("Hips", -0.03 * H if f in (10,) else (0.0 if f in (1, 40) else 0.02 * H), f,
         dy=0.0 if f in (1, 40) else (0.08 * D if f in (16, 22) else 0.0))

# voar: bater asas
n = 32
nova("Voar", n)
for f in senoide(n, 16):
    t = (f - 1) / n * 2 * math.pi
    for s, k in (("L", 1), ("R", -1)):
        gira(f"Wing1.{s}", EY, -k * (-10 + 45 * math.sin(t)), f)
        gira(f"Wing2.{s}", EY, -k * (25 * math.sin(t - 1.0)), f)
        gira(f"Thigh.{s}", EX, -20 + 4 * math.sin(t), f)
        gira(f"Shin.{s}", EX, 30, f)
        gira(f"UpperArm.{s}", EX, -15, f)
    gira("Spine", EX, 6 - 4 * math.sin(t), f)
    gira("Neck", EX, -6 * math.sin(t - .5), f)
    gira("Tail1", EX, -10 * math.sin(t - .4), f)
    gira("Tail2", EX, -14 * math.sin(t - .9), f)
    gira("Tail3", EX, -18 * math.sin(t - 1.4), f)
    move("Hips", -0.06 * H * math.sin(t) + 0.12 * H, f)

bpy.ops.object.mode_set(mode="OBJECT")
# teste: deslocamento máximo da malha na pose da asa no auge
arm.animation_data.action = bpy.data.actions["Voar"]
bpy.context.scene.frame_set(9)
dg = bpy.context.evaluated_depsgraph_get()
ev = mesh.evaluated_get(dg)
v2 = np.array([tuple(p.co) for p in ev.data.vertices])
print(f"AVISO deslocamento máx. voar={np.abs(v2 - v).max():.2f} m; ações={[a.name for a in bpy.data.actions]}")
arm.animation_data.action = bpy.data.actions["Parado"]
bpy.context.scene.frame_set(1)

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=SAIDA, export_format="GLB", use_selection=True,
                          export_animations=True, export_animation_mode="ACTIONS",
                          export_apply=False)
print("PRONTO", SAIDA)
