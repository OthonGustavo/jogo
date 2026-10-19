"""Limpa o chefe gerado por IA e exporta o .glb do jogo (Blender como módulo Python, `pip install bpy`).

Uso:
  python blender_boss.py foto  <entrada.glb> <saida.png>                 # só tira uma foto "de argila"
  python blender_boss.py final <entrada.glb> <saida.glb> <pasta_fotos> [imagem]  # limpa, pinta, exporta e fotografa
  python blender_boss.py textura <pintado.glb> <saida.glb> <pasta_fotos> # mantém a textura da IA, acerta e exporta

O "final" faz: junta as peças, mede, escala para ~5 m de altura (1 unidade = 1 metro), põe a origem nos pés,
reduz para menos de 30 mil triângulos (Decimate), recalcula normais, desdobra UV, assa uma textura de pele
de pedra rachada com oclusão de ambiente (2048 px) e exporta .glb com a frente virada para +Z (padrão glTF).
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ALTURA_M = 5.0
MAX_TRIS = 28000
TEX = 2048


def limpar_cena():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def importar(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # tira o objeto de dentro de vazios do glTF, mantendo a posição
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def bbox(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def normalizar(obj):
    lo, hi = bbox(obj)
    s = ALTURA_M / (hi.z - lo.z)
    obj.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    lo, hi = bbox(obj)
    obj.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)
    bpy.ops.object.transform_apply(location=True)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def reduzir(obj):
    antes = tris(obj)
    if antes > MAX_TRIS:
        mod = obj.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = MAX_TRIS / antes
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    return antes, tris(obj)


def silhueta(img):
    """Caixa (u0, u1, v0, v1) da parte não transparente da imagem, em coordenadas 0..1."""
    import numpy as np

    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    alfa = px.reshape(h, w, 4)[:, :, 3] > 0.5
    linhas = np.where(alfa.any(axis=1))[0]
    colunas = np.where(alfa.any(axis=0))[0]
    return colunas[0] / w, (colunas[-1] + 1) / w, linhas[0] / h, (linhas[-1] + 1) / h


def projetar_imagem(nt, cor_costas, img_path, lo, hi):
    """Projeta a imagem conceito de frente (eixo -Y do Blender) sobre o modelo.

    A silhueta da imagem é encaixada na caixa do modelo (X -> u, Z -> v). Onde a superfície não olha para a
    frente (costas, laterais), entra a pele de pedra procedural, com transição suave.
    """
    n, l = nt.nodes, nt.links
    img = bpy.data.images.load(str(img_path))
    u0, u1, v0, v1 = silhueta(img)
    coord = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(coord.outputs["Object"], sep.inputs["Vector"])
    u = n.new("ShaderNodeMapRange")
    u.inputs["From Min"].default_value = lo.x
    u.inputs["From Max"].default_value = hi.x
    u.inputs["To Min"].default_value = u0
    u.inputs["To Max"].default_value = u1
    l.new(sep.outputs["X"], u.inputs["Value"])
    v = n.new("ShaderNodeMapRange")
    v.inputs["From Min"].default_value = lo.z
    v.inputs["From Max"].default_value = hi.z
    v.inputs["To Min"].default_value = v0
    v.inputs["To Max"].default_value = v1
    l.new(sep.outputs["Z"], v.inputs["Value"])
    uv = n.new("ShaderNodeCombineXYZ")
    l.new(u.outputs["Result"], uv.inputs["X"])
    l.new(v.outputs["Result"], uv.inputs["Y"])
    tex = n.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "EXTEND"
    l.new(uv.outputs["Vector"], tex.inputs["Vector"])
    # quanto a superfície olha para a frente (-Y): 0 nas costas, 1 de frente
    geo = n.new("ShaderNodeNewGeometry")
    nsep = n.new("ShaderNodeSeparateXYZ")
    l.new(geo.outputs["Normal"], nsep.inputs["Vector"])
    frente = n.new("ShaderNodeMapRange")
    frente.inputs["From Min"].default_value = 0.05
    frente.inputs["From Max"].default_value = -0.35
    l.new(nsep.outputs["Y"], frente.inputs["Value"])
    fator = n.new("ShaderNodeMath")
    fator.operation = "MULTIPLY"
    l.new(frente.outputs["Result"], fator.inputs[0])
    l.new(tex.outputs["Alpha"], fator.inputs[1])
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    l.new(fator.outputs["Value"], mix.inputs["Factor"])
    l.new(cor_costas, mix.inputs["A"])
    l.new(tex.outputs["Color"], mix.inputs["B"])
    return mix.outputs["Result"]


def material_pedra(projecao=None):
    mat = bpy.data.materials.new("PeleDePedra")
    mat.use_nodes = True
    nt = mat.node_tree
    n, l = nt.nodes, nt.links
    bsdf = n["Principled BSDF"]
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.6, 1.6, 1.6)
    l.new(coord.outputs["Object"], mapping.inputs["Vector"])
    # rachaduras: bordas de Voronoi
    vor = n.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 4.0
    l.new(mapping.outputs["Vector"], vor.inputs["Vector"])
    crack = n.new("ShaderNodeMapRange")
    crack.inputs["From Min"].default_value = 0.0
    crack.inputs["From Max"].default_value = 0.06
    l.new(vor.outputs["Distance"], crack.inputs["Value"])
    # manchas da pele
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 8.0
    l.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.10, 0.095, 0.09, 1)
    ramp.color_ramp.elements[1].color = (0.38, 0.36, 0.33, 1)
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (0.03, 0.025, 0.02, 1)  # fundo das rachaduras
    inv = n.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    l.new(crack.outputs["Result"], inv.inputs[1])
    l.new(inv.outputs["Value"], mix.inputs["Factor"])
    l.new(ramp.outputs["Color"], mix.inputs["A"])
    cor = mix.outputs["Result"]
    if projecao:
        cor = projetar_imagem(nt, cor, *projecao)
    # escurece as dobras com oclusão de ambiente
    ao = n.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.4
    mul = n.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 0.6 if projecao else 0.85
    l.new(cor, mul.inputs["A"])
    l.new(ao.outputs["AO"], mul.inputs["B"])
    l.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    l.new(crack.outputs["Result"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def usar_gpu():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for tipo in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = tipo
                prefs.get_devices()
                if any(d.type == tipo for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type == tipo
                    scene.cycles.device = "GPU"
                    print(f"Cycles usando {tipo}")
                    return
            except TypeError:
                continue
    except KeyError:
        pass
    print("Cycles usando CPU")


def assar(obj, mat):
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    img = bpy.data.images.new("boss_basecolor", TEX, TEX)
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.nodes.active = tex
    usar_gpu()
    scene = bpy.context.scene
    scene.cycles.samples = 32
    scene.cycles.bake_type = "DIFFUSE"
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.margin = 8
    bpy.ops.object.bake(type="DIFFUSE")
    # troca o material procedural pela textura assada (é o que o glTF entende)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    for link in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(link)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    for link in list(bsdf.inputs["Normal"].links):
        nt.links.remove(link)
    img.pack()
    return img


def foto(obj, out_png, argila=False, angulo=35):
    scene = bpy.context.scene
    lo, hi = bbox(obj)
    h = hi.z - lo.z
    centro = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2))
    if argila:
        m = bpy.data.materials.new("Argila")
        m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.53, 0.5, 1)
        obj.data.materials.clear()
        obj.data.materials.append(m)
    # câmera: a frente do modelo olha para -Y no Blender (= +Z no glTF)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    dist = h * 2.2
    a = math.radians(angulo)
    cam.location = centro + Vector((math.sin(a) * dist, -math.cos(a) * dist, h * 0.15))
    direcao = centro - cam.location
    cam.rotation_euler = direcao.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.0
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(50), 0, math.radians(30) + a)  # luz acompanha a câmera
    scene.collection.objects.link(sol_obj)
    world = bpy.data.worlds.new("Mundo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.18, 0.2, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    usar_gpu()
    scene.cycles.samples = 48
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.filepath = str(out_png)
    bpy.ops.render.render(write_still=True)
    for o in (cam, sol_obj):
        bpy.data.objects.remove(o)


def main():
    modo = sys.argv[1]
    limpar_cena()
    obj = importar(sys.argv[2])
    if modo == "foto":
        normalizar(obj)
        print(f"triangulos={tris(obj)}")
        foto(obj, sys.argv[3], argila=True)
        return
    if modo == "textura":
        # o .glb já vem pintado pela IA: só acerta escala/origem/normais, limita a textura e exporta
        saida, fotos = Path(sys.argv[3]), Path(sys.argv[4])
        fotos.mkdir(parents=True, exist_ok=True)
        normalizar(obj)
        antes, depois = reduzir(obj)
        for img in bpy.data.images:
            if max(img.size) > TEX:
                img.scale(TEX, TEX)
        lo, hi = bbox(obj)
        print(f"triangulos {antes} -> {depois}; tamanho {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f} m; "
              f"texturas {[tuple(i.size) for i in bpy.data.images]}")
        obj.name = "AsylumDemon"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(saida), export_format="GLB", use_selection=True, export_yup=True,
            export_image_format="JPEG", export_jpeg_quality=88,
        )
        for ang in (35, -35, 180):
            foto(obj, fotos / f"5-textura-ia-{ang}.png", angulo=ang)
        print(f"exportado {saida}")
        return
    saida = Path(sys.argv[3])
    fotos = Path(sys.argv[4])
    fotos.mkdir(parents=True, exist_ok=True)
    normalizar(obj)
    antes, depois = reduzir(obj)
    lo, hi = bbox(obj)
    print(f"triangulos {antes} -> {depois}; tamanho {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f} m")
    foto(obj, fotos / "3-reduzido-argila.png", argila=True)
    imagem = sys.argv[5] if len(sys.argv) > 5 else None
    mat = material_pedra((imagem, lo, hi) if imagem else None)
    assar(obj, mat)
    obj.name = "AsylumDemon"
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(saida), export_format="GLB", use_selection=True, export_yup=True,
        export_image_format="JPEG", export_jpeg_quality=88,
    )
    for ang in (35, -35, 180):
        foto(obj, fotos / f"4-final-{ang}.png", angulo=ang)
    print(f"exportado {saida}")


main()
