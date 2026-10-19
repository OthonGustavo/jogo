"""Rig + animações do dragão (bípede com asas), versão 2.
- ossos posicionados à mão (ossos_dragao.json, em metros; conferir com guia_rig.py)
- pesos por "calor" (Blender) calculados numa cópia fechada da malha e transferidos para a malha real
- pernas com IK (pés presos no chão), depois tudo é "assado" em FK para o glTF
Uso: python animar_dragao.py <entrada.glb> <saida.glb> <ossos.json>"""
import sys, json, math
import bpy, numpy as np
from mathutils import Vector, Quaternion

ENTRADA, SAIDA, JSON = sys.argv[1], sys.argv[2], sys.argv[3]
POS = json.load(open(JSON, encoding="utf-8"))
FPS = 24

PAIS = {"Root": None, "Hips": "Root", "Spine": "Hips", "Chest": "Spine", "Neck": "Chest", "Head": "Neck",
        "Jaw": "Head", "Tail1": "Hips", "Tail2": "Tail1", "Tail3": "Tail2", "Tail4": "Tail3"}
for s in "LR":
    PAIS.update({f"Thigh.{s}": "Hips", f"Shin.{s}": f"Thigh.{s}", f"Foot.{s}": f"Shin.{s}",
                 f"UpperArm.{s}": "Chest", f"Forearm.{s}": f"UpperArm.{s}", f"Hand.{s}": f"Forearm.{s}",
                 f"Wing1.{s}": "Chest", f"Wing2.{s}": f"Wing1.{s}", f"Wing3.{s}": f"Wing2.{s}",
                 f"WingM.{s}": f"Wing2.{s}"})

# ---------------- malha ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ENTRADA)
malhas = [o for o in bpy.data.objects if o.type == "MESH"]
for o in malhas:
    m = o.matrix_world.copy(); o.parent = None; o.matrix_world = m
for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="DESELECT")
for o in malhas:
    o.select_set(True)
bpy.context.view_layer.objects.active = malhas[0]
if len(malhas) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = "Dragao"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
V0 = np.array([tuple(p.co) for p in mesh.data.vertices])
H = float(V0[:, 2].max() - V0[:, 2].min())

# ---------------- esqueleto ----------------
arm_d = bpy.data.armatures.new("Esqueleto")
arm = bpy.data.objects.new("Esqueleto", arm_d)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_d.edit_bones
for nome in PAIS:
    h, t = POS[nome]
    e = eb.new(nome); e.head, e.tail = Vector(h), Vector(t); e.roll = 0
for nome, pai in PAIS.items():
    if pai:
        eb[nome].parent = eb[pai]
# controles (não deformam): alvo do pé = cópia do osso do pé, polo do joelho à frente
for s in "LR":
    f = eb[f"Foot.{s}"]
    ik = eb.new(f"IK_Foot.{s}"); ik.head, ik.tail, ik.roll = f.head, f.tail, f.roll
    ik.parent = eb["Root"]; ik.use_deform = False
    jo = eb[f"Shin.{s}"].head
    po = eb.new(f"Pole.{s}"); po.head = jo + Vector((0, -1.5, 0)); po.tail = po.head + Vector((0, -0.3, 0))
    po.parent = eb["Root"]; po.use_deform = False
bpy.ops.object.mode_set(mode="POSE")
for s in "LR":
    c = arm.pose.bones[f"Shin.{s}"].constraints.new("IK")
    c.target, c.subtarget = arm, f"IK_Foot.{s}"
    c.pole_target, c.pole_subtarget = arm, f"Pole.{s}"
    c.chain_count = 2
    cr = arm.pose.bones[f"Foot.{s}"].constraints.new("COPY_ROTATION")
    cr.target, cr.subtarget = arm, f"IK_Foot.{s}"
    # escolhe o ângulo do polo que mantém o joelho no lugar na pose de descanso
    joelho = arm.data.bones[f"Shin.{s}"].head_local.copy()
    melhor = None
    for ang in range(-180, 180, 15):
        c.pole_angle = math.radians(ang)
        bpy.context.view_layer.update()
        d = (arm.pose.bones[f"Shin.{s}"].head - joelho).length
        if melhor is None or d < melhor[0]:
            melhor = (d, ang)
    c.pole_angle = math.radians(melhor[1])
    print(f"AVISO polo {s}: {melhor[1]} graus, erro {melhor[0]:.3f} m")
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------- pesos ----------------
proxy = mesh.copy(); proxy.data = mesh.data.copy(); bpy.context.collection.objects.link(proxy)
proxy.vertex_groups.clear()
bpy.ops.object.select_all(action="DESELECT"); proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
r = proxy.modifiers.new("rm", "REMESH"); r.mode = "VOXEL"; r.voxel_size = H / 160
bpy.ops.object.modifier_apply(modifier=r.name)
n = len(proxy.data.polygons)
if n > 60000:
    d = proxy.modifiers.new("dc", "DECIMATE"); d.ratio = 60000 / n
    bpy.ops.object.modifier_apply(modifier=d.name)
arm.data.bones["Root"].use_deform = False
arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
arm.data.bones["Root"].use_deform = True
deform = [b.name for b in arm.data.bones if b.use_deform]
pw = np.zeros((len(proxy.data.vertices), len(deform)))
idx = {g.index: deform.index(g.name) for g in proxy.vertex_groups if g.name in deform}
for vtx in proxy.data.vertices:
    for g in vtx.groups:
        if g.group in idx:
            pw[vtx.index, idx[g.group]] = g.weight
semp = (pw.sum(1) < 1e-4).mean()
print(f"AVISO calor: {semp * 100:.1f}% dos vértices da cópia sem peso")

# transfere: média dos 6 vértices mais próximos da cópia (KD-tree)
from mathutils.kdtree import KDTree
PV = np.array([tuple(p.co) for p in proxy.data.vertices])
kd = KDTree(len(PV))
for i, p in enumerate(PV):
    kd.insert(p, i)
kd.balance()
W = np.zeros((len(V0), len(deform)))
for i, p in enumerate(V0):
    viz = kd.find_n(p, 6)
    tot = 0
    for _, j, dist in viz:
        if pw[j].sum() > 1e-4:
            k = 1 / (dist + 1e-3); W[i] += k * pw[j] / pw[j].sum(); tot += k
    if tot:
        W[i] /= tot
# quem ficou sem peso: osso mais próximo (segmento)
falta = W.sum(1) < 1e-4
if falta.any():
    segs = [(np.array(arm.data.bones[n].head_local), np.array(arm.data.bones[n].tail_local)) for n in deform]
    for i in np.where(falta)[0]:
        ds = [np.linalg.norm(V0[i] - (a + np.clip((V0[i] - a) @ (b - a) / ((b - a) @ (b - a)), 0, 1) * (b - a)))
              for a, b in segs]
        W[i, int(np.argmin(ds))] = 1
# membrana fina -> só ossos da asa do mesmo lado; corpo grosso -> sem asa (exceto perto da raiz da asa)
from mathutils.bvhtree import BVHTree
bvh = BVHTree.FromPolygons([tuple(p) for p in V0], [tuple(pg.vertices) for pg in mesh.data.polygons])
esp = np.full(len(V0), 1.0)
for i, vt in enumerate(mesh.data.vertices):
    nrm = vt.normal
    for sgn in (-1, 1):
        hit = bvh.ray_cast(vt.co + nrm * sgn * 0.003, nrm * sgn, 0.6)
        if hit[0] is not None:
            esp[i] = min(esp[i], hit[3])
            break
def dist_ossos(nomes_):
    d = np.full(len(V0), 9.0)
    for n in nomes_:
        a, b = np.array(arm.data.bones[n].head_local), np.array(arm.data.bones[n].tail_local)
        t = np.clip(((V0 - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
        d = np.minimum(d, np.linalg.norm(V0 - (a + t[:, None] * (b - a)), axis=1))
    return d


D_RABO = dist_ossos(["Tail1", "Tail2", "Tail3", "Tail4"])
D_CABECA = np.full(len(V0), 9.0)
for n in ("Head", "Neck", "Jaw"):
    a, b = np.array(arm.data.bones[n].head_local), np.array(arm.data.bones[n].tail_local)
    t = np.clip(((V0 - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
    D_CABECA = np.minimum(D_CABECA, np.linalg.norm(V0 - (a + t[:, None] * (b - a)), axis=1))
ASA = {s: [deform.index(f"{n}.{s}") for n in ("Wing1", "Wing2", "Wing3", "WingM")] for s in "LR"}
CH = deform.index("Chest")
fino = esp < 0.07
# distância de cada vértice ao osso do corpo (não-asa) mais próximo
D_CORPO = np.full(len(V0), 9.0)
for n in deform:
    if n.startswith("Wing") or n == "Root":
        continue
    a, b = np.array(arm.data.bones[n].head_local), np.array(arm.data.bones[n].tail_local)
    t = np.clip(((V0 - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
    D_CORPO = np.minimum(D_CORPO, np.linalg.norm(V0 - (a + t[:, None] * (b - a)), axis=1))
n_mem = 0
for s, k in (("L", 1), ("R", -1)):
    ia = ASA[s]
    raiz = np.array(arm.data.bones[f"Wing1.{s}"].head_local)
    lado_ok = V0[:, 0] * k > 0.5
    asa_peso = W[:, ia].sum(1)
    mem = fino & lado_ok & ((asa_peso > 0.05) | (np.abs(V0[:, 0]) > 1.35)) & (D_CABECA > 0.5) & (D_RABO > 0.5)
    n_mem += mem.sum()
    keep = np.zeros(len(deform), bool); keep[ia] = True
    perto_raiz = np.linalg.norm(V0 - raiz, axis=1) < 0.45
    keep2 = keep.copy(); keep2[CH] = True
    W[mem & ~perto_raiz] *= keep
    W[mem & perto_raiz] *= keep2
    corpo = ~fino & (V0[:, 0] * k > 0) & ~perto_raiz & (D_CORPO < 0.35)
    W[np.ix_(corpo, ia)] = 0
    W[np.ix_(D_RABO < 0.45, ia)] = 0      # rabo (e seus espinhos) nunca seguem a asa
    # membrana que ficou sem peso: segmento de asa mais próximo
    vaz = mem & (W.sum(1) < 1e-4)
    for i in np.where(vaz)[0]:
        ds = []
        for j in ia:
            a, b = np.array(arm.data.bones[deform[j]].head_local), np.array(arm.data.bones[deform[j]].tail_local)
            ds.append(np.linalg.norm(V0[i] - (a + np.clip((V0[i] - a) @ (b - a) / ((b - a) @ (b - a)), 0, 1) * (b - a))))
        W[i, ia[int(np.argmin(ds))]] = 1
print(f"AVISO espessura: {fino.mean() * 100:.0f}% fino; membrana das asas = {n_mem} vértices")
# suaviza os pesos pela superfície (evita rasgos onde a regra muda de um vértice para o vizinho)
E = np.array([tuple(e.vertices) for e in mesh.data.edges])
grau = np.bincount(E.ravel(), minlength=len(V0)).astype(float)[:, None]
for _ in range(12):
    viz = np.zeros_like(W)
    np.add.at(viz, E[:, 0], W[E[:, 1]]); np.add.at(viz, E[:, 1], W[E[:, 0]])
    W = 0.5 * W + 0.5 * viz / np.maximum(grau, 1)
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
# no máximo 4 ossos por vértice
top = np.argsort(-W, axis=1)[:, :4]
M = np.zeros_like(W, dtype=bool); np.put_along_axis(M, top, True, axis=1)
W2 = np.where(M & (W > 0.02), W, 0)
vazio = W2.sum(1) < 1e-6
W2[vazio, np.argmax(W[vazio], axis=1)] = 1
W = W2 / W2.sum(1, keepdims=True)
print(f"AVISO vértices com peso inválido: {int(np.isnan(W).any(1).sum())}")
bpy.data.objects.remove(proxy)
mesh.vertex_groups.clear()
grupos = {n: mesh.vertex_groups.new(name=n) for n in deform}
for bi, n in enumerate(deform):
    nz = np.nonzero(W[:, bi])[0]
    for i in nz:
        grupos[n].add([int(i)], float(W[i, bi]), "REPLACE")
mesh.parent = arm
for m in list(mesh.modifiers):
    mesh.modifiers.remove(m)
mod = mesh.modifiers.new("Esqueleto", "ARMATURE"); mod.object = arm
print(f"AVISO pesos prontos; {falta.mean() * 100:.1f}% caíram no plano B")

# ---------------- ferramentas de animação ----------------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
EX, EY, EZ = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def q_mundo(nome, rots):
    """rots = [(eixo_mundo, graus), ...] aplicados em ordem; devolve quaternion local do osso."""
    R = arm.data.bones[nome].matrix_local.to_3x3()
    q = Quaternion()
    for eixo, g in rots:
        q = Quaternion((R.inverted() @ eixo).normalized(), math.radians(g)) @ q
    return q


def pose(f, rot=None, loc=None):
    """rot: {osso: [(eixo, graus), ...]}  loc: {osso: (dx, dy, dz) no espaço do mundo, em metros}"""
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = q_mundo(pb.name, (rot or {}).get(pb.name, []))
        d = Vector((loc or {}).get(pb.name, (0, 0, 0)))
        pb.location = arm.data.bones[pb.name].matrix_local.to_3x3().inverted() @ d
        pb.keyframe_insert("rotation_quaternion", frame=f)
        pb.keyframe_insert("location", frame=f)


def nova(nome):
    a = bpy.data.actions.new(nome); a.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = a
    return a


def lado(s):
    return 1 if s == "L" else -1


def sn(x):
    return math.sin(x)


def onda(nomes, eixo, amp, t, atraso):
    return {n: [(eixo, amp[i] * sn(t - atraso * (i + 1)))] for i, n in enumerate(nomes)}


CAUDA = ["Tail1", "Tail2", "Tail3", "Tail4"]
TAU = 2 * math.pi


def suave(x):  # 0..1 com aceleração e desaceleração
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def interp(chaves, f):
    """chaves = {frame: valor}; interpolação suave entre as chaves vizinhas."""
    ks = sorted(chaves)
    if f <= ks[0]:
        return chaves[ks[0]]
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b:
            return chaves[a] + (chaves[b] - chaves[a]) * suave((f - a) / (b - a))
    return chaves[ks[-1]]


# ---------- Parado (respirar), 72 quadros, loop ----------
N = 72
nova("Parado")
for f in range(1, N + 2, 2):
    t = (f - 1) / N * TAU
    rot = {"Chest": [(EX, -1.5 * sn(t))], "Spine": [(EX, -0.8 * sn(t))],
           "Neck": [(EZ, 4 * sn(t / 1)), (EX, 1.0 * sn(t - 0.6))], "Head": [(EX, 1.0 * sn(t - 1.0))],
           "Jaw": [(EX, 1.5 + 1.5 * sn(t))]}
    rot.update(onda(CAUDA, EZ, [3, 4, 5, 6], t, 0.5))
    for s in "LR":
        k = lado(s)
        rot[f"Wing1.{s}"] = [(EY, k * 2 * sn(t - 0.4))]
        rot[f"Wing2.{s}"] = [(EY, k * 1.5 * sn(t - 0.9))]
        rot[f"UpperArm.{s}"] = [(EX, -2 * sn(t - 0.3))]
        rot[f"Forearm.{s}"] = [(EX, -2 * sn(t - 0.7))]
    pose(f, rot, {"Hips": (0, 0, 0.015 * sn(t))})

# ---------- Andar, 36 quadros, loop, no lugar (o jogo move o personagem) ----------
N = 36
PASSO = 0.9          # metros que cada pé percorre por ciclo de apoio
ALTURA_PE = 0.28
APOIO = 0.6          # fração do ciclo com o pé no chão
nova("Andar")


def pe(fase):
    """posição (dy, dz, inclinação) de um pé: no apoio desliza para trás, no balanço volta pelo ar."""
    fase %= 1.0
    if fase < APOIO:
        u = fase / APOIO
        return (-PASSO / 2 + PASSO * u, 0.0, -10 * suave((u - 0.75) / 0.25))   # calcanhar sobe no fim
    u = (fase - APOIO) / (1 - APOIO)
    return (PASSO / 2 - PASSO * suave(u), ALTURA_PE * sn(math.pi * u), 20 * sn(math.pi * u))


for f in range(1, N + 2):
    ph = (f - 1) / N
    t = ph * TAU
    rot, loc = {}, {}
    for s, off in (("L", 0.0), ("R", 0.5)):
        k = lado(s)
        dy, dz, inc = pe(ph + off)
        loc[f"IK_Foot.{s}"] = (0, dy, dz)
        rot[f"IK_Foot.{s}"] = [(EX, inc)]
        rot[f"UpperArm.{s}"] = [(EX, k * 12 * math.cos(t))]   # braço oposto à perna do mesmo lado
        rot[f"Forearm.{s}"] = [(EX, -6 - 5 * sn(t - 0.6 + (0 if s == "L" else math.pi)))]
        rot[f"Wing1.{s}"] = [(EY, k * (2 + 2 * sn(2 * t - 0.8)))]
        rot[f"Wing2.{s}"] = [(EY, k * 2 * sn(2 * t - 1.4))]
    giro = -4 * math.cos(t)         # quadril acompanha a perna que avança
    rot["Hips"] = [(EZ, giro), (EY, -2 * sn(t))]
    rot["Spine"] = [(EZ, -giro / 2)]
    rot["Chest"] = [(EZ, -giro / 2), (EX, 1.5 * math.cos(2 * t))]
    rot["Neck"] = [(EX, -1.5 * math.cos(2 * t - 0.5))]
    rot["Head"] = [(EZ, -giro / 2)]
    rot.update({n: [(EZ, a * sn(t - 0.7 * (i + 1))), (EX, 2 * math.cos(2 * t - 0.6 * (i + 1)))]
                for i, (n, a) in enumerate(zip(CAUDA, [5, 7, 9, 11]))})
    loc["Hips"] = (0.06 * math.cos(t - 0.3 * TAU), 0, -0.08 - 0.06 * math.cos(2 * t - 0.4))
    pose(f, rot, loc)

# ---------- Ataque: soco + giro com chicotada de rabo, 64 quadros ----------
N = 64
nova("Ataque")
C = {  # quadro: valor  (graus ou metros)
    "torcao": {1: 0, 10: -16, 15: 24, 21: 26, 28: 0, 64: 0},
    "agacha": {1: 0, 10: -0.12, 15: -0.16, 21: -0.14, 28: -0.12, 34: -0.05, 52: -0.08, 64: 0},
    "avanco": {1: 0, 10: 0.06, 15: -0.30, 21: -0.30, 28: 0, 64: 0},
    "braco": {1: 0, 10: 45, 15: -88, 21: -85, 28: -10, 34: 0, 64: 0},
    "cotovelo": {1: 0, 10: -70, 15: -8, 21: -10, 28: -30, 34: 0, 64: 0},
    "guarda": {1: 0, 10: -25, 15: 28, 21: 25, 28: 0, 64: 0},
    "boca": {1: 0, 10: 5, 15: 18, 21: 14, 28: 4, 64: 0},
    "giro": {1: 0, 28: 25, 32: -45, 36: -135, 40: -225, 44: -315, 48: -360, 64: -360},
    "rabo": {1: 0, 21: -8, 28: -20, 32: 25, 36: 40, 40: 42, 44: 10, 48: -35, 53: -20, 58: 6, 64: 0},
    "rabo_sobe": {1: 0, 28: 0, 33: 22, 44: 22, 50: 5, 64: 0},
    "abre": {1: 0, 10: 8, 15: 18, 21: 15, 28: 5, 32: 25, 44: 25, 50: 8, 64: 0},
}
for f in range(1, N + 1):
    g = {k: interp(v, f) for k, v in C.items()}
    tor = g["torcao"]
    rot = {"Root": [(EZ, g["giro"])],
           "Hips": [(EZ, tor * 0.25)], "Spine": [(EZ, tor * 0.35)], "Chest": [(EZ, tor * 0.4), (EX, 6 * g["avanco"] / -0.3)],
           "Neck": [(EZ, -tor * 0.4)], "Head": [(EZ, -tor * 0.2)], "Jaw": [(EX, g["boca"])],
           "UpperArm.R": [(EX, g["braco"])], "Forearm.R": [(EX, g["cotovelo"])],
           "UpperArm.L": [(EX, g["guarda"]), (EY, -g["abre"] * 0.6)], "Forearm.L": [(EX, -15)]}
    for i, n in enumerate(CAUDA):
        atraso = interp(C["rabo"], f - 1.5 * i)
        rot[n] = [(EZ, atraso * (0.6 + 0.2 * i)), (EX, interp(C["rabo_sobe"], f - i) * (1 - 0.25 * i))]
    for s in "LR":
        rot[f"Wing1.{s}"] = [(EY, lado(s) * g["abre"])]
        rot[f"Wing2.{s}"] = [(EY, lado(s) * interp(C["abre"], f - 2) * 0.5)]
    pose(f, rot, {"Hips": (0, g["avanco"], g["agacha"])})

# ---------- Voar (pairar), 28 quadros, loop ----------
N = 28
DESCE = 0.4          # fração do ciclo na descida da asa (rápida)
nova("Voar")


def batida(fase):
    """0 = asa em cima, 1 = asa embaixo; desce rápido, sobe devagar."""
    fase %= 1.0
    return suave(fase / DESCE) if fase < DESCE else 1 - suave((fase - DESCE) / (1 - DESCE))


for f in range(1, N + 2):
    ph = (f - 1) / N
    rot, loc = {}, {}
    b0, b1, b2 = batida(ph), batida(ph - 0.08), batida(ph - 0.16)
    for s in "LR":
        k = lado(s)
        w1 = 8 + 50 * b0            # braço da asa: quase em pé em cima, deitado embaixo
        w2 = 4 + 18 * b1            # antebraço atrasa um pouco
        fi = 100 - 55 * b2          # dedos: para fora e para cima em cima, para fora e para baixo embaixo
        rot[f"Wing1.{s}"] = [(EY, k * w1), (EX, -6 + 14 * b0)]
        rot[f"Wing2.{s}"] = [(EY, k * w2)]
        # dedos apontam para baixo no descanso: "para fora" é o sentido contrário; desconta o giro dos pais
        rot[f"Wing3.{s}"] = [(EY, -k * (fi + w1 + w2))]
        rot[f"WingM.{s}"] = [(EY, -k * (0.8 * fi + w1 + w2)), (EX, -15)]
        rot[f"UpperArm.{s}"] = [(EX, -25)]
        rot[f"Forearm.{s}"] = [(EX, -45)]
        loc[f"IK_Foot.{s}"] = (0, 0.35 + 0.06 * sn(ph * TAU - 1.2), 0.45 + 0.05 * sn(ph * TAU - 1.0))
        rot[f"IK_Foot.{s}"] = [(EX, 30)]
    sobe = batida(ph - 0.1)
    rot["Hips"] = [(EX, 10)]
    rot["Chest"] = [(EX, -3 + 4 * sobe)]
    rot["Neck"] = [(EX, -4 * sobe)]
    rot["Head"] = [(EX, -3 * sobe)]
    for i, n in enumerate(CAUDA):
        rot[n] = [(EX, (8 + 4 * i) * (batida(ph - 0.15 - 0.07 * i) - 0.5))]
    loc["Root"] = (0, 0, 1.0 + 0.18 * sobe)
    pose(f, rot, loc)


# ---------------- assar IK em FK e exportar ----------------
for a in [a for a in bpy.data.actions if a.use_fake_user]:
    arm.animation_data.action = a
    f0, f1 = map(int, a.frame_range)
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, step=1, only_selected=False, visual_keying=True,
                     clear_constraints=False, use_current_action=True, bake_types={"POSE"})
for pb in arm.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
bpy.ops.object.mode_set(mode="OBJECT")
arm.animation_data.action = bpy.data.actions["Parado"]
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=SAIDA, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_def_bones=True, export_apply=False,
                          export_image_format="JPEG", export_jpeg_quality=90)
print("PRONTO", SAIDA, "ações", [a.name for a in bpy.data.actions if a.use_fake_user])
