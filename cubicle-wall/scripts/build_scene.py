"""Cubicle Wall: build the animated short in Blender (bpy) -> cubicle_wall.blend

    python scripts/build_scene.py <assets_dir> build/characters.blend build/timing.json cubicle_wall.blend

Ready-made assets only: MakeHuman/MPFB2 actors, Poly Haven (CC0) office dressing, Sketchfab models
(CC-BY, via the Objaverse mirror) for the cubicle partitions, plastic chairs and the drafting stool, which
is assembled from a gas-lift bar stool (cylinder, lever, seat, backrest), an office chair's chrome 5-star
base and a metal ring (foot ring). Shots are timed as fractions of each narration line (build/timing.json).
"""
import json, math, os, random, sys

import bpy
import bmesh  # noqa: E402  (bpy must be imported first)
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses as PZ          # noqa: E402
from scenelib import (F, Actor, box, chair_info, constant_interp, face_dir, flat_material, import_model,  # noqa: E402
                      key_obj, key_visible, make_camera, meshes, pbr_material, place, uv_box_project)

ASSETS = os.path.abspath(sys.argv[1]); CHARS, TIMING, OUT = [os.path.abspath(a) for a in sys.argv[2:5]]
random.seed(11)
T = json.load(open(TIMING))
LINES = {l["i"]: l for l in T["lines"]}
DUR = T["duration"]
LAST = int(math.floor(DUR * 30))
PI = math.pi
OJ = lambda uid: os.path.join(ASSETS, "objaverse", uid + ".glb")
PH = lambda slug: os.path.join(ASSETS, "polyhaven", slug, f"{slug}_1k.gltf")
TEX = lambda slug: os.path.join(ASSETS, "polyhaven", "tex", slug)

# ---------------------------------------------------------------- render settings
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
sc.frame_start, sc.frame_end = 1, LAST
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.engine = "BLENDER_EEVEE"
ee = sc.eevee
ee.taa_render_samples = 2
for attr, val in [("use_shadows", True), ("shadow_ray_count", 1), ("shadow_step_count", 6), ("use_raytracing", False),
                  ("use_fast_gi", True), ("fast_gi_distance", 1.5)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
sc.view_settings.view_transform = "AgX"
try:
    sc.view_settings.look = "AgX - Base Contrast"
except TypeError:
    pass
sc.view_settings.exposure = 0.3
SET = bpy.data.collections.new("SET"); sc.collection.children.link(SET)
PROPS = bpy.data.collections.new("PROPS"); sc.collection.children.link(PROPS)
CAMS = bpy.data.collections.new("CAMERAS"); sc.collection.children.link(CAMS)

# ---------------------------------------------------------------- world + lights
world = bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
env = wn.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(ASSETS, "polyhaven", "hdri", "unfinished_office_2k.hdr"))
wl.new(env.outputs["Color"], wn["Background"].inputs["Color"])
wn["Background"].inputs["Strength"].default_value = 0.8
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); SET.objects.link(sun)
sun.data.energy = 2.6; sun.data.angle = math.radians(4); sun.data.color = (1.0, 0.96, 0.9)
sun.rotation_euler = (math.radians(32), math.radians(10), math.radians(-30))
H = 3.4
for i, (x, y) in enumerate([(x, y) for x in (-3.6, -1.2, 1.2, 3.6) for y in (-2.2, 2.2)]):
    l = bpy.data.objects.new(f"Panel{i}", bpy.data.lights.new(f"Panel{i}", "AREA")); SET.objects.link(l)
    l.data.shape = "RECTANGLE"; l.data.size = 1.2; l.data.size_y = 0.6; l.data.energy = 260
    l.data.color = (1.0, 0.98, 0.95); l.data.use_shadow = False
    l.location = (x, y, H - 0.04)

# ---------------------------------------------------------------- room
RX, RY0, RY1 = 6.4, -5.0, 5.2
floor_m = pbr_material("Carpet", TEX("jersey_melange"), 1.0, tint=(0.46, 0.5, 0.6))
wall_m = pbr_material("Wall", TEX("beige_wall_001"), 1.0)
ceil_m = pbr_material("Ceiling", TEX("ceiling_interior"), 1.0, tint=(1.6, 1.6, 1.6))
floor = box("Floor", (2 * RX, RY1 - RY0, 0.02), (0, (RY0 + RY1) / 2, -0.01), floor_m, SET); uv_box_project(floor, 0.8)
for nm, size, loc in [("WallBack", (2 * RX, 0.1, H), (0, RY1 + 0.05, H / 2)), ("WallFront", (2 * RX, 0.1, H), (0, RY0 - 0.05, H / 2)),
                      ("WallL", (0.1, RY1 - RY0, H), (-RX - 0.05, (RY0 + RY1) / 2, H / 2)),
                      ("WallR", (0.1, RY1 - RY0, H), (RX + 0.05, (RY0 + RY1) / 2, H / 2))]:
    w = box(nm, size, loc, wall_m, SET); uv_box_project(w, 2.0); w.visible_shadow = False
ceil = box("Ceiling", (2 * RX, RY1 - RY0, 0.04), (0, (RY0 + RY1) / 2, H + 0.02), ceil_m, SET); uv_box_project(ceil, 1.2)
ceil.visible_shadow = False


def model(path, name, size, axis="z", x=0.0, y=0.0, z=0.0, face=0.0, coll=SET, chair=False):
    r = import_model(path, name, size, axis, coll)
    if chair:
        chair_info(r)
    place(r, x, y, z, face)
    return r


SX, SY = -1.35, -0.85          # where the chair stack / drafting stool stands (in front of the wall)

# ---------------------------------------------------------------- cubicles: partition wall along y = 0
WALL_H = 1.7
panels = []
for i, x in enumerate([-4.8, -3.6, -2.4, -1.2, 0.0, 1.2, 2.4, 3.6, 4.8]):
    panels.append(model(OJ("0f244a4985134d38ae4dec414499ccee"), f"Partition{i}", WALL_H, "z", x, 0.0))
PANEL_W = panels[0]["size"][0]
fabric = pbr_material("PartitionFabric", TEX("jersey_melange"), 2.5, tint=(0.42, 0.44, 0.47))
# side panels framing his cubicle and hers
model(OJ("0f244a4985134d38ae4dec414499ccee"), "PartitionSideHis", WALL_H, "z", 1.95, -0.7, face=PI / 2)
model(OJ("0f244a4985134d38ae4dec414499ccee"), "PartitionSideHer", WALL_H, "z", 1.95, 0.7, face=PI / 2)
model(OJ("0f244a4985134d38ae4dec414499ccee"), "PartitionBack1", WALL_H, "z", -2.2, 3.4, face=0)
model(OJ("0f244a4985134d38ae4dec414499ccee"), "PartitionBack2", WALL_H, "z", -1.0, 3.4, face=0)
# the extension panel the boss slides on top (1.0 m tall), above the section in front of the stool
ext = model(OJ("0f244a4985134d38ae4dec414499ccee"), "WallExtension", WALL_H, "z", -1.2, 0.0, WALL_H, coll=PROPS)
ext.scale.z *= 1.0 / WALL_H

for o in SET.all_objects:
    if o.type == "MESH" and o.name.startswith("Partition"):
        for slot in o.material_slots:
            if slot.material and not any(k in slot.material.name for k in ("Silver", "Alumin", "Metal")):
                slot.material = fabric
for o in meshes(ext):
    for slot in o.material_slots:
        if slot.material and not any(k in slot.material.name for k in ("Silver", "Alumin", "Metal")):
            slot.material = fabric

# desks, monitors, dressing
DESK_Z = 0.788
model(PH("metal_office_desk"), "DeskHis", 0.788, "z", 0.15, -0.6)
model(PH("metal_office_desk"), "DeskHer", 0.788, "z", 1.05, 2.0, face=-PI / 2)
model(PH("metal_office_desk"), "DeskBG1", 0.788, "z", 3.5, -0.6)
model(PH("metal_office_desk"), "DeskBG2", 0.788, "z", 3.3, 2.1)
model(PH("metal_office_desk"), "DeskBG3", 0.788, "z", -3.6, -0.6)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorHis", 0.56, "x", 0.25, -0.38, DESK_Z)
model(OJ("561abc2fc95941609fc7bc6f232895c2"), "DesktopHer", 0.48, "z", 1.3, 2.05, DESK_Z, face=-PI / 2)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorBG1", 0.56, "x", 3.5, -0.38, DESK_Z)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorBG2", 0.56, "x", 3.3, 2.32, DESK_Z, face=PI)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorBG3", 0.56, "x", -3.6, -0.38, DESK_Z)
model(PH("office_notepads"), "NotesHis", 0.45, "x", -0.4, -0.7, DESK_Z)
model(PH("stationery_supplies"), "StationeryHis", 0.3, "x", 0.85, -0.5, DESK_Z)
model(PH("potted_plant_04"), "PlantHer", 0.27, "z", 1.05, 2.6, DESK_Z)
model(PH("potted_plant_04"), "PlantHis", 0.27, "z", 0.95, -0.35, DESK_Z)
model(PH("potted_plant_01"), "PlantBig1", 1.35, "z", -5.6, 4.4)
model(PH("potted_plant_02"), "PlantBig2", 0.9, "z", 5.6, -4.3)
model(OJ("4b88c4c4e94c497ca39f831f374e89fc"), "WaterCooler", 1.3, "z", 4.6, RY1 - 0.35)
model(OJ("d0b05bd140734a799666f0a29e1fe1bb"), "Whiteboard", 1.9, "x", 1.6, RY1 - 0.06, 0.95)
model(PH("wall_clock"), "Clock", 0.34, "z", -1.4, RY1 - 0.03, 2.3)
for i, (x, y) in enumerate([(x, y) for x in (-3.6, -1.2, 1.2, 3.6) for y in (-2.2, 2.2)]):
    model(PH("mounted_fluorescent_lights"), f"Fixture{i}", 1.1, "max", x, y, H - 0.04)
for o in SET.all_objects:
    if o.type == "MESH" and o.name.split("__")[0].startswith(("Fixture", "Plant", "Notes", "Stationery", "Clock", "Monitor",
                                                              "Desktop", "Whiteboard")):
        o.visible_shadow = False

# chairs
chHis = model(OJ("675f34f7304e4d92812a41e9750539aa"), "ChairHis", 1.05, "z", 0.35, -1.4, face=PI, coll=PROPS, chair=True)
chHer = model(OJ("af2f07d06f6349158c1d24d87f5ceb95"), "ChairHer", 1.05, "z", 0.15, 2.0, face=PI / 2, coll=PROPS, chair=True)
P1 = model(OJ("3f63a5ab46df4f78a5df646001a5fced"), "PlasticChair1", 0.86, "z", SX, SY, face=PI, coll=PROPS, chair=True)
P2 = model(OJ("3f63a5ab46df4f78a5df646001a5fced"), "PlasticChair2", 0.86, "z", -2.3, -1.6, face=PI / 2, coll=PROPS, chair=True)
model(OJ("af2f07d06f6349158c1d24d87f5ceb95"), "ChairBG1", 1.05, "z", 3.5, -1.4, face=PI + 0.3, chair=True)
model(OJ("87a8de3461bf44848f3629fa8a8dcd68"), "ChairBG2", 1.1, "z", 3.3, 1.35, face=0.4, chair=True)
for c in (chHis, chHer, P1, P2):
    print("chair", c.name, "seat", round(c["seat_z"], 3), "yaw", round(math.degrees(c["front_yaw"])))

# ---------------------------------------------------------------- the drafting stool (assembled from ready-made parts)
STOOL_XY = Vector((SX, SY, 0))
src = import_model(OJ("d052b9ddea1c4528a221c3869273a5af"), "StoolSrc", 1.0, "z", PROPS)
chair_info(src)
place(src, STOOL_XY.x, STOOL_XY.y, 0.0, PI)          # seat front faces the wall (+Y)
bpy.context.view_layer.update()
STOOL = bpy.data.objects.new("STOOL", None); PROPS.objects.link(STOOL); STOOL.location = STOOL_XY
TOP = bpy.data.objects.new("STOOL_TOP", None); PROPS.objects.link(TOP); TOP.parent = STOOL
BACKREST = bpy.data.objects.new("STOOL_BACKREST", None); PROPS.objects.link(BACKREST); BACKREST.parent = TOP
parts = {o.name.split("__", 1)[1]: o for o in meshes(src)}
tube = next(o for n, o in parts.items() if n.startswith("Leg.004"))
tpts = [tube.matrix_world @ Vector(c) for c in tube.bound_box]
TUBE_Z0, TUBE_Z1 = min(p.z for p in tpts), max(p.z for p in tpts)
TUBE = bpy.data.objects.new("STOOL_TUBE", None); PROPS.objects.link(TUBE); TUBE.parent = STOOL; TUBE.location = (0, 0, TUBE_Z0)
bpy.context.view_layer.update()


def reparent(o, new_parent):
    mw = o.matrix_world.copy()
    o.parent = new_parent
    o.matrix_parent_inverse = new_parent.matrix_world.inverted()
    o.matrix_world = mw


seat_top = 0.0
for n, o in parts.items():
    if n.startswith("Footrest"):
        bpy.data.objects.remove(o)
    elif n.startswith("Leg.004"):
        reparent(o, TUBE)
    elif n.startswith("Stool_Feet"):
        reparent(o, STOOL); PLASTIC_BASE = o
    elif n.startswith(("Back.", "Back_Cushion")) or (n.startswith("Screw") and
                                                      max((o.matrix_world @ Vector(c)).z for c in o.bound_box) > 0.79):
        reparent(o, BACKREST)
    else:
        reparent(o, TOP)
        if n.startswith("Seat_Cushion"):
            seat_top = max((o.matrix_world @ Vector(c)).z for c in o.bound_box)
        if n.startswith("HandlerPath"):
            LEVER = o
bpy.data.objects.remove(src)
SEAT_Z0 = seat_top
TUBE_L0 = TUBE_Z1 - TUBE_Z0
plastic = flat_material("PlasticBase", (0.04, 0.04, 0.045), 0.45)
PLASTIC_BASE.data.materials.clear(); PLASTIC_BASE.data.materials.append(plastic)
# crack-able plastic base: two halves of the same mesh
halves = []
for k, (clear_in, clear_out) in enumerate([(True, False), (False, True)]):
    h = PLASTIC_BASE.copy(); h.data = PLASTIC_BASE.data.copy(); PROPS.objects.link(h); h.name = f"PlasticBaseHalf{k}"
    bm = bmesh.new(); bm.from_mesh(h.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(1, 0.15, 0),
                           clear_inner=clear_in, clear_outer=clear_out)
    bm.to_mesh(h.data); bm.free()
    halves.append(h)
bpy.data.objects.remove(PLASTIC_BASE)
# steel 5-star base (chrome base + casters of a ready-made office chair)
steel = import_model(OJ("41973aa1808d4a13b84c24497fc77c63"), "SteelBaseSrc", 1.05, "z", PROPS)
keep = ("Rectangle02_Chrome", "Cylinder02_", "Cylinder19_", "Cylinder22_", "Cylinder24_", "Cylinder25_",
        "Cylinder04_", "Cylinder20_", "Cylinder21_", "Cylinder23_", "Cylinder26_")
STEEL_PARTS = []
place(steel, STOOL_XY.x, STOOL_XY.y)
bpy.context.view_layer.update()
for o in meshes(steel):
    if o.name.split("__", 1)[1].startswith(keep):
        reparent(o, STOOL); STEEL_PARTS.append(o)
    else:
        bpy.data.objects.remove(o)
bpy.data.objects.remove(steel)
chrome = flat_material("Chrome", (0.86, 0.87, 0.9), 0.12, metallic=1.0)
# foot ring: one ring of a ready-made metal-rings model, laid flat, chrome, attached under the seat
rings = import_model(OJ("7ec7baa8878b41fc969f5ffa542c7176"), "RingSrc", 1.0, "max", PROPS)
ring = sorted(meshes(rings), key=lambda o: o.name)[0]
for o in meshes(rings):
    if o != ring:
        bpy.data.objects.remove(o)
bpy.context.view_layer.update()
mw = ring.matrix_world.copy()
ring.parent = None; ring.matrix_world = mw
pts = [ring.matrix_world @ v.co for v in ring.data.vertices]
c = sum(pts, Vector()) / len(pts)
cov = Matrix(((0, 0, 0), (0, 0, 0), (0, 0, 0)))
for p in pts[::3]:
    d = p - c
    for a in range(3):
        for b in range(3):
            cov[a][b] += d[a] * d[b]
import numpy as np  # noqa: E402
w_, v_ = np.linalg.eigh(np.array(cov))
normal = Vector(v_[:, 0])
rot = normal.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
ring.matrix_world = Matrix.Translation(-c) @ ring.matrix_world
ring.matrix_world = rot @ ring.matrix_world
bpy.context.view_layer.update()
rp_ = [ring.matrix_world @ v.co for v in ring.data.vertices]
diam = max(p.x for p in rp_) - min(p.x for p in rp_)
ring.matrix_world = Matrix.Diagonal((0.44 / diam, 0.44 / diam, 0.44 / diam, 1)) @ ring.matrix_world
ring.matrix_world = Matrix.Translation((STOOL_XY.x, STOOL_XY.y, SEAT_Z0 - 0.4)) @ ring.matrix_world
ring.data.materials.clear(); ring.data.materials.append(chrome)
ring.name = "FootRing"
bpy.data.objects.remove(rings)
reparent(ring, TOP)
print("stool seat", round(SEAT_Z0, 3), "tube", round(TUBE_Z0, 3), round(TUBE_Z1, 3))

# ---------------------------------------------------------------- characters
with bpy.data.libraries.load(CHARS, link=False) as (src_l, dst):
    dst.collections = [c for c in src_l.collections if c.startswith("CHR_")]
for c in dst.collections:
    sc.collection.children.link(c)
    for o in c.objects:
        if o.type == "MESH" and o.data.shape_keys:
            with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
main, crush, boss, kid = Actor("main"), Actor("crush"), Actor("boss"), Actor("cousin")
ACTORS = [main, crush, boss, kid]
for o in crush.objs:                      # white blouse + dark tights (as in Chair Sniff)
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.node_tree:
            continue
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type == "TEX_IMAGE" and n.image and "elegantsuit" in n.image.name and "diffuse" in n.image.name.lower():
                outs = [l.to_socket for l in n.outputs["Color"].links]
                sep = nt.nodes.new("ShaderNodeSeparateColor"); sep.mode = "HSV"
                nt.links.new(n.outputs["Color"], sep.inputs["Color"])
                rmp = nt.nodes.new("ShaderNodeMapRange"); rmp.inputs["From Min"].default_value = 0.25; rmp.inputs["From Max"].default_value = 0.4
                nt.links.new(sep.outputs[1], rmp.inputs["Value"])
                mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
                nt.links.new(rmp.outputs["Result"], mix.inputs["Factor"]); nt.links.new(n.outputs["Color"], mix.inputs[6])
                mix.inputs[7].default_value = (0.92, 0.92, 0.9, 1)
                for s_ in outs:
                    nt.links.new(mix.outputs[2], s_)
            if n.type == "TEX_IMAGE" and n.image and "shoes04" in n.image.name and "diffuse" in n.image.name.lower():
                outs = [l.to_socket for l in n.outputs["Color"].links]
                hsv = nt.nodes.new("ShaderNodeHueSaturation"); hsv.inputs["Value"].default_value = 0.22
                nt.links.new(n.outputs["Color"], hsv.inputs["Color"])
                for s_ in outs:
                    nt.links.new(hsv.outputs["Color"], s_)
for i, a in enumerate(ACTORS):
    a.key(1, PZ.STAND, (5.5, -4.2 + 0.4 * i), 0.0)
    key_visible(a.objs, 1, False)

# ---------------------------------------------------------------- staging helpers
SHOTS = []


def L(i, a, b):
    s, e = LINES[i]["start"], LINES[i]["end"]
    return s + (e - s) * a, s + (e - s) * b


def word_time(i, token):
    return next((w["s"] for w in LINES[i]["words"] if w["w"].lower().startswith(token.lower())), None)


def shot(name, t0, t1, cam_loc, cam_target, lens, actors, push=0.03):
    f0, f1 = F(t0), F(t1) - 1
    make_camera("CAM_" + name, f0, f1, cam_loc, cam_target, lens, push, CAMS)
    SHOTS.append((name, f0, f1, actors))
    return f0, f1


def fr(f0, f1, a):
    return int(round(f0 + (f1 - f0) * a))


def seat_point(ch, dz=0.0, back=0.04):
    fy = ch.rotation_euler.z - ch["front_yaw"]
    fwd = Vector((math.sin(fy), -math.cos(fy), 0))
    p = ch.location + fwd * (0.06 - back)
    return Vector((p.x, p.y, ch.location.z + ch["seat_z"] + dz))


def chair_face(ch):
    return ch.rotation_euler.z - ch["front_yaw"]


def sit_key(a, f, ch, pose=PZ.SIT, extra=0.085):
    return a.key(f, pose, (0, 0), chair_face(ch), hips=seat_point(ch, extra, back=0.06))


def stand_in_front(a, f, ch, pose=PZ.STAND, d=0.3):
    yaw = chair_face(ch)
    p = seat_point(ch) + Vector((math.sin(yaw), -math.cos(yaw), 0)) * d
    return a.key(f, pose, (p.x, p.y), yaw)


def sit_down(a, f0, f1, ch, end_pose=PZ.SIT):
    stand_in_front(a, f0, ch)
    a.key(int(f0 + (f1 - f0) * 0.55), PZ.SIT_MID, (0, 0), chair_face(ch), hips=seat_point(ch, 0.25, back=-0.12))
    sit_key(a, f1, ch, end_pose)


# stool state: h = rise of the seat (m), spin = rotation (rad)
STOOL_FACE = PI       # sitter faces +Y (the wall)


def stool_key(f, h=0.0, spin=0.0):
    key_obj(TOP, f, loc=(0, 0, h), rot=Euler((0, 0, spin)))
    TUBE.scale = (1, 1, max(0.05, (TUBE_L0 + h) / TUBE_L0))
    TUBE.keyframe_insert("scale", frame=f)


def stool_seat(h=0.0):
    return Vector((STOOL_XY.x, STOOL_XY.y - 0.03, SEAT_Z0 + h))


def sit_stool(a, f, h=0.0, pose=PZ.SIT, spin=0.0, extra=0.075):
    return a.key(f, pose, (0, 0), STOOL_FACE + spin, hips=stool_seat(h) + Vector((0, 0, extra)))


# initial prop states
for p in [chHis, chHer, P1, P2, ext, STOOL, TOP, BACKREST] + halves + STEEL_PARTS:
    key_obj(p, 1, loc=p.location.copy(), rot=p.rotation_euler.copy())
stool_key(1, 0.0)
STOOL_ALL = [o for o in PROPS.all_objects if o.type == "MESH" and (o.parent in (STOOL, TOP, BACKREST, TUBE))]
key_visible(STOOL_ALL + meshes(ext) + meshes(P2), 1, False)
key_visible(meshes(chHis) + meshes(chHer) + meshes(P1), 1, True)
BACK0 = BACKREST.location.copy()

# ================================================================ SHOTS
# ---- 1: the wall; she walks to her desk on the other side
t0, t1 = L(1, 0.0, 0.55)
f0, f1 = shot("01a_ots_staring_at_wall", t0, t1, (0.75, -2.45, 1.32), (0.1, 0.0, 1.3), 26, [main], push=0.05)
sit_key(main, f0, chHis, dict(PZ.SIT, **{"Head": ("rot", (-14, 0, 0))}))
sit_key(main, f1, chHis, dict(PZ.SIT, **{"Head": ("rot", (-16, 0, 4))}))
t0, t1 = L(1, 0.55, 1.0)
f0, f1 = shot("01b_wide_crush_walks_to_desk", t0, t1, (0.35, 4.95, 1.45), (0.6, 2.1, 0.92), 20, [crush])
sp = seat_point(chHer)
crush.walk(f0, f1 + 15, (1.55, 3.25), (sp.x + 0.05, sp.y + 0.55))

# ---- 2: stack two chairs, climb on top
P1_SEAT = seat_point(P1, 0.0, back=0.0)
t0, t1 = L(2, 0.0, 0.5)
f0, f1 = shot("02a_med_stacking_chairs", t0, t1, (SX + 1.75, SY - 1.9, 1.35), (SX, SY, 0.75), 24, [main])
key_visible(meshes(P2), f0, True)
main.key(f0, PZ.HOLD, (SX, SY - 0.9), face_dir(0, 1))
main.key(fr(f0, f1, 0.45), PZ.HOLD_LOW, (SX, SY - 0.65), face_dir(0, 1))
main.key(f1, PZ.STAND, (SX, SY - 0.75), face_dir(0, 1))
P2_ON = Vector((P1_SEAT.x, P1_SEAT.y, P1_SEAT.z))
key_obj(P2, f0, loc=Vector((SX, SY - 0.45, 0.55)), rot=Euler((0, 0, P1.rotation_euler.z)))
key_obj(P2, fr(f0, f1, 0.45), loc=P2_ON + Vector((0, 0, 0.12)), rot=Euler((0, 0, P1.rotation_euler.z)))
key_obj(P2, fr(f0, f1, 0.6), loc=P2_ON, rot=Euler((0, 0, P1.rotation_euler.z)))
P2_SEAT_Z = P2_ON.z + P2["seat_z"]
t0, t1 = L(2, 0.5, 1.0)
f0, f1 = shot("02b_wide_climbing_up", t0, t1, (SX - 2.0, SY - 1.85, 1.25), (SX, SY, 1.55), 22, [main])
main.key(f0, PZ.STAND, (SX, SY - 0.7), face_dir(0, 1))
main.key(fr(f0, f1, 0.3), PZ.CLIMB, (SX, SY - 0.45), face_dir(0, 1), zoff=0.15)
main.key(fr(f0, f1, 0.5), PZ.STAND, (SX, SY - 0.05), face_dir(0, 1), zoff=P1_SEAT.z)
main.key(fr(f0, f1, 0.72), PZ.CLIMB, (SX, SY - 0.05), face_dir(0, 1), zoff=P1_SEAT.z + 0.15)
main.key(fr(f0, f1, 0.9), PZ.BALANCE, (SX, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)
main.key(f1, PZ.BALANCE, (SX, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)

# ---- 3: they wobble
t0, t1 = L(3, 0.0, 0.5)
f0, f1 = shot("03a_cu_wobbling_legs", t0, t1, (SX + 0.75, SY - 0.95, 0.42), (SX, SY, 0.6), 26, [main], push=0.0)
n = 8
for k in range(n + 1):
    f = fr(f0, f1, k / n); s_ = 1 if k % 2 else -1
    key_obj(P1, f, rot=Euler((math.radians(1.5 * s_), math.radians(2.2 * s_), P1.rotation_euler.z)))
    key_obj(P2, f, loc=P2_ON + Vector((0.02 * s_, 0, 0)), rot=Euler((math.radians(-3 * s_), math.radians(4 * s_), P1.rotation_euler.z)))
    main.key(f, PZ.BALANCE_L if k % 2 else PZ.BALANCE_R, (SX + 0.03 * s_, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)
t0, t1 = L(3, 0.5, 1.0)
f0, f1 = shot("03b_med_balancing_arms_out", t0, t1, (SX - 1.9, SY - 1.4, 2.05), (SX, SY, 2.0), 24, [main])
for k in range(n + 1):
    f = fr(f0, f1, k / n); s_ = 1 if k % 2 else -1
    key_obj(P1, f, rot=Euler((math.radians(1.5 * s_), math.radians(2.2 * s_), P1.rotation_euler.z)))
    key_obj(P2, f, loc=P2_ON + Vector((0.02 * s_, 0, 0)), rot=Euler((math.radians(-3 * s_), math.radians(4 * s_), P1.rotation_euler.z)))
    main.key(f, PZ.BALANCE_L if k % 2 else PZ.BALANCE_R, (SX + 0.03 * s_, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)

# ---- 4: the boss makes the wall taller; he falls off
t0, t1 = L(4, 0.0, 0.6)
f0, f1 = shot("04a_side_boss_extends_wall", t0, t1, (SX - 3.4, 0.25, 2.0), (SX + 0.05, 0.0, 1.95), 22, [boss, main])
key_visible(meshes(ext), f0, True)
EXT_DOWN = ext.location.copy()
key_obj(ext, f0, loc=EXT_DOWN + Vector((0, 0.35, 0.65)))
key_obj(ext, fr(f0, f1, 0.25), loc=EXT_DOWN + Vector((0, 0.1, 0.55)))
key_obj(ext, fr(f0, f1, 0.6), loc=EXT_DOWN + Vector((0, 0, 0.05)))
key_obj(ext, fr(f0, f1, 0.68), loc=EXT_DOWN)
boss.key(f0, PZ.HOLD_UP, (-1.2, 0.85), face_dir(0, -1))
boss.key(fr(f0, f1, 0.6), PZ.HOLD_UP, (-1.2, 0.72), face_dir(0, -1))
boss.key(f1, PZ.PROUD, (-1.2, 0.75), face_dir(0, -1))
main.key(f0, PZ.BALANCE, (SX, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)
main.key(fr(f0, f1, 0.5), PZ.BALANCE_L, (SX, SY - 0.03), face_dir(0, 1), zoff=P2_SEAT_Z)
main.key(fr(f0, f1, 0.7), PZ.SHOCK, (SX, SY - 0.05), face_dir(0, 1), zoff=P2_SEAT_Z)
main.key(f1, PZ.SHOCK, (SX, SY - 0.07), face_dir(0, 1), zoff=P2_SEAT_Z)
t0, t1 = L(4, 0.6, 1.0)
f0, f1 = shot("04b_wide_falls_off_chairs", t0, t1, (SX + 2.0, SY - 2.75, 1.45), (SX - 0.05, SY - 0.25, 1.0), 22, [main])
main.key(f0, PZ.SHOCK, (SX, SY - 0.07), face_dir(0, 1), zoff=P2_SEAT_Z)
main.key(fr(f0, f1, 0.35), PZ.FALLING, (0, 0), face_dir(0, 1), hips=(SX, SY - 0.5, 1.6), tilt=-0.6)
main.key(fr(f0, f1, 0.7), PZ.FALLEN, (0, 0), face_dir(0, 1), hips=(SX, SY - 1.05, 0.14), tilt=-1.5)
main.key(f1, PZ.FALLEN, (0, 0), face_dir(0, 1), hips=(SX, SY - 1.1, 0.14), tilt=-1.5)
key_obj(P2, f0, loc=P2_ON, rot=Euler((0, 0, P1.rotation_euler.z)))
key_obj(P2, fr(f0, f1, 0.6), loc=Vector((SX - 0.65, SY - 0.6, 0.25)), rot=Euler((math.radians(85), 0.4, P1.rotation_euler.z + 0.6)))
key_obj(P2, f1, loc=Vector((SX - 0.75, SY - 0.65, 0.27)), rot=Euler((math.radians(88), 0.4, P1.rotation_euler.z + 0.7)))
key_obj(P1, f0, loc=P1.location.copy(), rot=Euler((0, 0, P1.rotation_euler.z)))
key_obj(P1, fr(f0, f1, 0.55), loc=P1.location + Vector((0.2, -0.35, 0.25)), rot=Euler((math.radians(-80), 0, P1.rotation_euler.z - 0.3)))
key_obj(P1, f1, loc=P1.location + Vector((0.25, -0.4, 0.27)), rot=Euler((math.radians(-88), 0, P1.rotation_euler.z - 0.35)))

# ---- 5: gas spring under the chair; Genius!
g = word_time(5, "Genius")
cut5 = (g - 0.1 - LINES[5]["start"]) / (LINES[5]["end"] - LINES[5]["start"]) if g else 0.72
t0, t1 = L(5, 0.0, cut5)
f0, f1 = shot("05a_cu_gas_spring_stool", t0, t1, (SX + 0.55, SY - 0.85, 0.66), (SX, SY, 0.45), 30, [], push=0.08)
key_visible(meshes(P1) + meshes(P2), f0, False)
key_visible([o for o in STOOL_ALL if o.parent is not BACKREST and o not in STEEL_PARTS and o.name != "FootRing"], f0, True)
stool_key(f0, 0.0)
t0, t1 = L(5, cut5, 1.0)
f0, f1 = shot("05b_low_genius", t0, t1, (SX + 0.65, SY - 2.05, 0.55), (SX + 0.2, SY - 0.75, 1.4), 22, [main])
pos, yaw = (SX + 0.35, SY - 0.85), face_dir(-0.2, 1)
main.key(f0, PZ.STAND, pos, yaw)
main.key(fr(f0, f1, 0.25), PZ.FIST, pos, yaw)
main.key(fr(f0, f1, 0.5), PZ.FIST_DOWN, pos, yaw)
main.key(fr(f0, f1, 0.75), PZ.FIST, pos, yaw)
main.key(f1, PZ.FIST, pos, yaw)

# ---- 6: pull the lever, launch above the wall
H_UP = 1.3
lever_c = sum((LEVER.matrix_world @ Vector(c) for c in LEVER.bound_box), Vector()) / 8
t0, t1 = L(6, 0.0, 0.42)
f0, f1 = shot("06a_cu_hand_pulls_lever", t0, t1, (lever_c.x + 0.62, lever_c.y - 0.62, lever_c.z + 0.08),
              (lever_c.x, lever_c.y, lever_c.z), 30, [main], push=0.06)
stool_key(f0, 0.0)
sit_stool(main, f0, 0.0, PZ.SIT_LEVER)
sit_stool(main, fr(f0, f1, 0.55), 0.0, PZ.SIT_LEVER_PULL)
sit_stool(main, f1, 0.0, PZ.SIT_LEVER_PULL)
key_obj(LEVER, fr(f0, f1, 0.4), rot=LEVER.rotation_euler.copy())
key_obj(LEVER, fr(f0, f1, 0.6), rot=Euler((LEVER.rotation_euler.x + 0.35, LEVER.rotation_euler.y, LEVER.rotation_euler.z)))
t0, t1 = L(6, 0.42, 1.0)
f0, f1 = shot("06b_low_stool_launches", t0, t1, (SX + 1.25, SY - 1.9, 0.3), (SX, SY + 0.05, 2.0), 18, [main], push=0.0)
stool_key(f0, 0.0); sit_stool(main, f0, 0.0, PZ.SIT_LEVER_PULL)
stool_key(fr(f0, f1, 0.08), 0.0); sit_stool(main, fr(f0, f1, 0.08), 0.0, PZ.SIT_SPIN)
stool_key(fr(f0, f1, 0.32), H_UP + 0.08); sit_stool(main, fr(f0, f1, 0.32), H_UP + 0.08, PZ.SIT_SPIN)
stool_key(fr(f0, f1, 0.42), H_UP); sit_stool(main, fr(f0, f1, 0.42), H_UP, PZ.SIT_PEEK)
stool_key(f1, H_UP); sit_stool(main, f1, H_UP, PZ.SIT_PEEK)
key_obj(LEVER, f1, rot=LEVER.rotation_euler.copy())

# ---- 7: the plastic base cracks, the stool drops hard
t0, t1 = L(7, 0.0, 1.0)
f0, f1 = shot("07_low_cu_base_cracks", t0, t1, (SX + 0.75, SY - 0.8, 0.22), (SX, SY, 0.42), 24, [main], push=0.0)
stool_key(f0, H_UP); sit_stool(main, f0, H_UP, PZ.SIT_DANGLE)
fc = fr(f0, f1, 0.3)
stool_key(fc, H_UP); sit_stool(main, fc, H_UP, PZ.SIT_DANGLE)
stool_key(fr(f0, f1, 0.42), -0.12); sit_stool(main, fr(f0, f1, 0.42), -0.12, PZ.SIT_SLUMP)
stool_key(f1, -0.12); sit_stool(main, f1, -0.12, PZ.SIT_SLUMP)
for k, hh in enumerate(halves):
    s_ = 1 if k else -1
    key_obj(hh, fc, loc=hh.location.copy(), rot=hh.rotation_euler.copy())
    key_obj(hh, fr(f0, f1, 0.45), loc=hh.location + Vector((0.09 * s_, 0.02, 0.0)), rot=Euler((0.0, math.radians(18 * s_), 0.0)))
    key_obj(hh, f1, loc=hh.location + Vector((0.13 * s_, 0.03, 0.0)), rot=Euler((0.0, math.radians(24 * s_), 0.0)))
key_obj(STOOL, fr(f0, f1, 0.45), rot=Euler((math.radians(6), 0, 0)))
key_obj(STOOL, f1, rot=Euler((math.radians(6), 0, 0)))

# ---- 8: steel base
t0, t1 = L(8, 0.0, 1.0)
f0, f1 = shot("08_cu_shiny_steel_base", t0, t1, (SX + 0.55, SY - 0.65, 0.38), (SX, SY, 0.12), 30, [], push=0.12)
key_obj(STOOL, f0, rot=Euler((0, 0, 0)))
stool_key(f0, 0.0)
key_visible(halves, f0, False)
key_visible(STEEL_PARTS, f0, True)
for o in STEEL_PARTS:
    if "Chrome" in o.name:
        o.data.materials.clear(); o.data.materials.append(chrome)

# ---- 9: next ride up, legs dangle
t0, t1 = L(9, 0.0, 1.0)
f0, f1 = shot("09_side_legs_dangle", t0, t1, (SX - 2.3, SY - 0.2, 2.15), (SX, SY, 1.85), 28, [main])
stool_key(f0, H_UP)
n = 10
for k in range(n + 1):
    f = fr(f0, f1, k / n)
    sit_stool(main, f, H_UP, PZ.SIT_DANGLE if k % 2 else PZ.SIT_DANGLE_B)

# ---- 10: foot ring
t0, t1 = L(10, 0.0, 1.0)
ring_c = Vector((STOOL_XY.x, STOOL_XY.y, SEAT_Z0 - 0.4 + H_UP))
f0, f1 = shot("10_cu_shoes_on_foot_ring", t0, t1, (ring_c.x + 0.42, ring_c.y - 0.55, ring_c.z + 0.18),
              (ring_c.x, ring_c.y + 0.05, ring_c.z + 0.05), 32, [main], push=0.06)
key_visible([ring], f0, True)
stool_key(f0, H_UP)
sit_stool(main, f0, H_UP, PZ.SIT_RING)
sit_stool(main, f1, H_UP, PZ.SIT_RING)

# ---- 11: the little cousin spins off
t0, t1 = L(11, 0.0, 1.0)
f0, f1 = shot("11_wide_cousin_spins_off", t0, t1, (SX + 2.7, SY - 2.6, 1.6), (SX + 0.35, SY - 0.4, 1.1), 22, [kid])
stool_key(f0, 0.0, 0.0)
sit_stool(kid, f0, 0.0, PZ.SIT_LEVER, extra=0.06)
fl = fr(f0, f1, 0.2)
stool_key(fl, 0.0, 0.0); sit_stool(kid, fl, 0.0, PZ.SIT_LEVER_PULL, extra=0.06)
spin_end = fr(f0, f1, 0.6)
for k in range(1, 7):
    f = fr(fl, spin_end, k / 6)
    hh = H_UP * min(1.0, k / 3)
    ang = 2 * PI * 1.5 * k / 6
    stool_key(f, hh, ang); sit_stool(kid, f, hh, PZ.SIT_SPIN, spin=ang, extra=0.06)
ang_end = 2 * PI * 1.5
yaw_k = STOOL_FACE + ang_end
out = Vector((math.sin(yaw_k + PI / 2), -math.cos(yaw_k + PI / 2), 0))
start = stool_seat(H_UP) + Vector((0, 0, 0.06))
land = Vector((STOOL_XY.x + 1.6, STOOL_XY.y - 1.1, 0.14))
mid = (start + land) / 2 + Vector((0, 0, 0.55))
kid.key(fr(f0, f1, 0.72), PZ.FLY, (0, 0), yaw_k + 1.2, hips=tuple(mid), tilt=-0.6)
kid.key(fr(f0, f1, 0.86), PZ.FALLEN, (0, 0), yaw_k + 2.0, hips=tuple(land + Vector((0, 0, 0.05))), tilt=-1.45)
kid.key(f1, PZ.FALLEN, (0, 0), yaw_k + 2.0, hips=tuple(land), tilt=-1.5)
stool_key(fr(f0, f1, 0.8), H_UP, ang_end + 0.6); stool_key(f1, H_UP, ang_end + 0.75)

# ---- 12: backrest snaps on
t0, t1 = L(12, 0.0, 1.0)
f0, f1 = shot("12_cu_backrest_snaps_on", t0, t1, (SX + 0.8, SY - 1.05, 1.25), (SX, SY - 0.1, 0.95), 30, [], push=0.06)
stool_key(f0, 0.0, 0.0)
key_visible([o for o in STOOL_ALL if o.parent is BACKREST], f0, True)
key_obj(BACKREST, f0, loc=BACK0 + Vector((0, -0.05, 0.45)))
key_obj(BACKREST, fr(f0, f1, 0.35), loc=BACK0 + Vector((0, -0.02, 0.18)))
key_obj(BACKREST, fr(f0, f1, 0.45), loc=BACK0 + Vector((0, 0, -0.02)))
key_obj(BACKREST, fr(f0, f1, 0.52), loc=BACK0)
key_obj(BACKREST, f1, loc=BACK0)

# ---- 13: final over-the-shoulder: he rises above the wall, she sits down at her desk
t0, t1 = L(13, 0.0, 1.0)
f0, f1 = shot("13_ots_final_above_wall", t0, t1, (SX + 0.5, SY - 2.3, 3.2), (-0.35, 2.0, 1.25), 24, [main, crush], push=0.0)
stool_key(f0, 0.0); sit_stool(main, f0, 0.0, PZ.SIT_LEVER_PULL)
stool_key(fr(f0, f1, 0.08), 0.0); sit_stool(main, fr(f0, f1, 0.08), 0.0, PZ.SIT_RING)
stool_key(fr(f0, f1, 0.3), H_UP + 0.06); sit_stool(main, fr(f0, f1, 0.3), H_UP + 0.06, PZ.SIT_RING)
stool_key(fr(f0, f1, 0.38), H_UP); sit_stool(main, fr(f0, f1, 0.38), H_UP, PZ.SIT_PEEK)
stool_key(f1, H_UP); sit_stool(main, f1, H_UP, PZ.SIT_PEEK)
sp = seat_point(chHer)
crush.walk(f0, fr(f0, f1, 0.3), (sp.x + 0.2, sp.y + 1.3), (sp.x + 0.32, sp.y + 0.25))
sit_down(crush, fr(f0, f1, 0.32), fr(f0, f1, 0.6), chHer)
sit_key(crush, f1, chHer, PZ.SIT_TYPE)

# ---------------------------------------------------------------- visibility per shot, save
for name, f0, f1, vis in SHOTS:
    for a in ACTORS:
        key_visible(a.objs, f0, a in vis)
for o in bpy.data.objects:
    constant_interp(o)
sc.camera = bpy.data.objects["CAM_01a_ots_staring_at_wall"]
json.dump([{"name": n, "f0": a, "f1": b} for n, a, b, _ in SHOTS], open(os.path.join(os.path.dirname(OUT), "build", "shots.json"), "w"), indent=1)
print("SHOTS", len(SHOTS))
for img in bpy.data.images:
    fp = bpy.path.abspath(img.filepath)
    if "/mh/data/" in fp and not fp.startswith(ASSETS):
        img.filepath = os.path.join(ASSETS, "mh", "data", fp.split("/mh/data/", 1)[1])
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True, relative_remap=True)
