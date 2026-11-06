"""Step 3: build the whole animated short in Blender (bpy) -> chair_sniff.blend

    python scripts/build_scene.py <assets_dir> build/characters.blend build/timing.json chair_sniff.blend

Office set + props (Poly Haven CC0 / Sketchfab-via-Objaverse CC-BY), MakeHuman actors,
per-line shots and cameras timed from build/timing.json (re-run make_timing.py for a new voiceover).
"""
import json
import math
import os
import random
import sys

import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses as PZ          # noqa: E402
import rigpose as rp        # noqa: E402
from scenelib import (F, Actor, box, chair_info, constant_interp, face_dir, flat_material, import_model,  # noqa: E402
                      key_obj, key_visible, make_camera, meshes, pbr_material, place, uv_box_project)

ASSETS, CHARS, TIMING, OUT = [os.path.abspath(a) for a in sys.argv[1:5]]
random.seed(7)
T = json.load(open(TIMING))
LINES = {l["i"]: l for l in T["lines"]}
DUR = T["duration"]
LAST = int(math.floor(DUR * 30))      # last frame
PI = math.pi
OJ = lambda uid: os.path.join(ASSETS, "objaverse", uid + ".glb")
PH = lambda slug: os.path.join(ASSETS, "polyhaven", slug, f"{slug}_1k.gltf")
TEX = lambda slug: os.path.join(ASSETS, "polyhaven", "tex", slug)

# ---------------------------------------------------------------- scene / render settings
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
sc.frame_start, sc.frame_end = 1, LAST
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.engine = "BLENDER_EEVEE"
ee = sc.eevee
ee.taa_render_samples = 16
for attr, val in [("use_shadows", True), ("shadow_ray_count", 1), ("shadow_step_count", 6), ("use_raytracing", False),
                  ("use_fast_gi", True), ("fast_gi_distance", 1.5), ("use_bloom", False), ("use_volumetric_shadows", False)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
sc.view_settings.view_transform = "AgX"
try:
    sc.view_settings.look = "AgX - Base Contrast"
except TypeError:
    pass
sc.view_settings.exposure = 0.45
sc.render.film_transparent = False
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
sun.rotation_euler = (math.radians(38), math.radians(8), math.radians(-35))
for i, (x, y) in enumerate([(x, y) for x in (-3.6, -1.2, 1.2, 3.6) for y in (-1.8, 1.4)]):
    l = bpy.data.objects.new(f"Panel{i}", bpy.data.lights.new(f"Panel{i}", "AREA")); SET.objects.link(l)
    l.data.shape = "RECTANGLE"; l.data.size = 1.2; l.data.size_y = 0.6; l.data.energy = 200; l.data.color = (1.0, 0.98, 0.95); l.data.use_shadow = False
    l.location = (x, y, 2.86)

# ---------------------------------------------------------------- room
ROOM_X, ROOM_Y0, ROOM_Y1, H = 6.4, -5.0, 4.6, 2.9
floor_m = pbr_material("Floor", TEX("laminate_floor_02"), 1.0)
wall_m = pbr_material("Wall", TEX("beige_wall_001"), 1.0, tint=(1.0, 1.0, 1.0))
ceil_m = pbr_material("Ceiling", TEX("ceiling_interior"), 1.0, tint=(1.6, 1.6, 1.6))
base_m = flat_material("Skirting", (0.3, 0.3, 0.32), 0.6)
floor = box("Floor", (2 * ROOM_X, ROOM_Y1 - ROOM_Y0, 0.02), (0, (ROOM_Y0 + ROOM_Y1) / 2, -0.01), floor_m, SET)
uv_box_project(floor, 1.6)
walls = [box("WallBack", (2 * ROOM_X, 0.1, H), (0, ROOM_Y1 + 0.05, H / 2), wall_m, SET),
         box("WallFront", (2 * ROOM_X, 0.1, H), (0, ROOM_Y0 - 0.05, H / 2), wall_m, SET),
         box("WallL", (0.1, ROOM_Y1 - ROOM_Y0, H), (-ROOM_X - 0.05, (ROOM_Y0 + ROOM_Y1) / 2, H / 2), wall_m, SET),
         box("WallR", (0.1, ROOM_Y1 - ROOM_Y0, H), (ROOM_X + 0.05, (ROOM_Y0 + ROOM_Y1) / 2, H / 2), wall_m, SET)]
for w in walls:
    uv_box_project(w, 2.0)
    w.visible_shadow = False
ceil = box("Ceiling", (2 * ROOM_X, ROOM_Y1 - ROOM_Y0, 0.04), (0, (ROOM_Y0 + ROOM_Y1) / 2, H + 0.02), ceil_m, SET)
uv_box_project(ceil, 1.2)
ceil.visible_shadow = False
box("SkirtBack", (2 * ROOM_X, 0.02, 0.08), (0, ROOM_Y1 - 0.01, 0.04), base_m, SET)
box("SkirtL", (0.02, ROOM_Y1 - ROOM_Y0, 0.08), (-ROOM_X + 0.01, (ROOM_Y0 + ROOM_Y1) / 2, 0.04), base_m, SET)
box("SkirtR", (0.02, ROOM_Y1 - ROOM_Y0, 0.08), (ROOM_X - 0.01, (ROOM_Y0 + ROOM_Y1) / 2, 0.04), base_m, SET)


# ---------------------------------------------------------------- furniture & props
def model(path, name, size, axis="z", x=0.0, y=0.0, z=0.0, face=0.0, coll=SET, chair=False):
    r = import_model(path, name, size, axis, coll)
    if chair:
        chair_info(r)
    place(r, x, y, z, face)
    return r


DESK_Z = 0.788
desks = {}
for name, (x, y) in {"D3": (-2.4, 0.0), "D1": (0.0, 0.0), "D2": (2.4, 0.0), "D4": (-1.2, 2.8), "D5": (1.2, 2.8),
                     "D6": (3.6, 2.8), "D7": (-3.6, 2.8)}.items():
    desks[name] = model(PH("metal_office_desk"), name, 0.788, "z", x, y)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorD1", 0.56, "x", 0.15, 0.22, DESK_Z)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorD3", 0.56, "x", -2.3, 0.22, DESK_Z)
model(OJ("561abc2fc95941609fc7bc6f232895c2"), "DesktopD2", 0.48, "z", 2.45, 0.12, DESK_Z)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorD5", 0.56, "x", 1.2, 3.02, DESK_Z)
model(OJ("561abc2fc95941609fc7bc6f232895c2"), "DesktopD6", 0.48, "z", 3.6, 2.92, DESK_Z)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "MonitorD7", 0.56, "x", -3.6, 3.02, DESK_Z)
model(PH("classic_laptop"), "LaptopD4", 0.35, "x", -1.2, 2.75, DESK_Z, face=0.0)
model(PH("office_notepads"), "NotesD1", 0.45, "x", -0.5, -0.05, DESK_Z)
model(PH("stationery_supplies"), "StationeryD3", 0.3, "x", -1.85, 0.05, DESK_Z)
model(PH("stationery_supplies"), "StationeryD1", 0.3, "x", 0.62, 0.15, DESK_Z)
model(PH("desk_lamp_arm_01"), "LampD2", 0.6, "z", 3.15, 0.25, DESK_Z, face=0.6)
model(PH("potted_plant_04"), "PlantD1", 0.27, "z", -0.75, 0.3, DESK_Z)
model(PH("potted_plant_04"), "PlantD5", 0.27, "z", 1.8, 2.95, DESK_Z)
model(PH("binder_notebook"), "BinderD3", 0.4, "x", -2.95, -0.05, DESK_Z)
model(OJ("d0b05bd140734a799666f0a29e1fe1bb"), "Whiteboard", 1.9, "x", 0.6, ROOM_Y1 - 0.06, 0.85)
model(OJ("4b88c4c4e94c497ca39f831f374e89fc"), "WaterCooler", 1.3, "z", 2.9, ROOM_Y1 - 0.35)
model(PH("potted_plant_01"), "PlantBig1", 1.35, "z", -5.7, 4.0)
model(PH("potted_plant_02"), "PlantBig2", 0.9, "z", 5.6, 3.9)
model(PH("potted_plant_02"), "PlantBig3", 0.9, "z", -5.8, -1.6)
model(PH("drawer_cabinet"), "Cabinet", 1.6, "z", -3.0, ROOM_Y1 - 0.3)
model(PH("wall_clock"), "Clock", 0.34, "z", -1.4, ROOM_Y1 - 0.03, 2.05)
for i, (x, y) in enumerate([(x, y) for x in (-3.6, -1.2, 1.2, 3.6) for y in (-1.8, 1.4)]):
    model(PH("mounted_fluorescent_lights"), f"Fixture{i}", 1.1, "max", x, y, H - 0.04)

# cheaper sun shadows: only furniture, chairs and people cast them (fixtures/plants/small props don't)
for o in SET.all_objects:
    if o.type == "MESH" and o.name.split("__")[0].startswith(("Fixture", "Plant", "Notes", "Stationery", "Binder", "Lamp",
                                                              "Clock", "Monitor", "Desktop", "Laptop", "Whiteboard")):
        o.visible_shadow = False

# chairs (front faces the desk = +Y -> face = pi)
CHAIR_Y = -1.05
chA = model(PH("dining_chair_02"), "ChairA_padded", 0.97, "z", 0.0, -1.0, face=PI, coll=PROPS, chair=True)
chB = model(PH("SchoolChair_01"), "ChairB_school", 0.86, "z", -2.4, CHAIR_Y, face=PI, coll=PROPS, chair=True)
chX = model(PH("modern_arm_chair_01"), "ChairX_arm", 0.92, "z", -1.2, 2.0, face=PI, coll=PROPS, chair=True)
chC = model(OJ("cd5ef0305d8545dd8cd934ebb99cf7d5"), "ChairC_mesh", 1.12, "z", 4.5, -3.5, face=PI, coll=PROPS, chair=True)
chD = model(OJ("29c10eb4b62e464caae5d62ac7dd19f8"), "ChairD_gaslift", 1.08, "z", 4.5, -3.0, face=PI, coll=PROPS, chair=True)
chE = model(OJ("675f34f7304e4d92812a41e9750539aa"), "ChairE_his", 1.05, "z", 2.4, -1.0, face=PI, coll=PROPS, chair=True)
chF = model(OJ("af2f07d06f6349158c1d24d87f5ceb95"), "ChairF_bg", 1.05, "z", 1.2, 2.0, face=PI, coll=SET, chair=True)
chG = model(OJ("87a8de3461bf44848f3629fa8a8dcd68"), "ChairG_bg", 1.1, "z", 3.6, 2.0, face=PI + 0.3, coll=SET, chair=True)
chH = model(OJ("675f34f7304e4d92812a41e9750539aa"), "ChairH_bg", 1.05, "z", -3.6, 2.0, face=PI - 0.4, coll=SET, chair=True)
chX["seat_z"] = 0.47          # lounge chair: top of its leather seat cushion (auto-detect finds the frame under it)
for c in (chA, chB, chX, chC, chD, chE):
    print("chair", c.name, "seat", round(c["seat_z"], 3), "yaw", round(math.degrees(c["front_yaw"])))

# hand props
perfume = model(OJ("a1f355ffea18473a99f04c3009ae48cb"), "Perfume", 0.15, "z", 5, -4, coll=PROPS)
gel = model(OJ("8c551e4f6bf248db99aa77a3d0221497"), "GelPad", 0.44, "x", 5, -4.5, coll=PROPS)
gel.scale.z *= 7.0
gel_m = flat_material("CoolingGel", (0.1, 0.55, 0.95), 0.12, alpha=0.85, transmission=0.3)
for o in meshes(gel):
    o.data.materials.clear(); o.data.materials.append(gel_m)
pill = import_model(PH("throw_pillows_01"), "PillowSrc", 1.0, "max", PROPS)
pm = sorted(meshes(pill), key=lambda o: o.name)
for o in pm[1:]:
    bpy.data.objects.remove(o)
pillow_mesh = pm[0]


def make_cushion(name):
    """A flat seat cushion: one Poly Haven throw pillow laid flat (40 x 40 cm, 9 cm thick)."""
    o = pillow_mesh.copy(); PROPS.objects.link(o); o.name = name; o.parent = None
    o.matrix_world = Matrix()
    bb = [Vector(c) for c in o.bound_box]
    ext = Vector([max(p[i] for p in bb) - min(p[i] for p in bb) for i in range(3)])
    thin = min(range(3), key=lambda i: ext[i])
    rot = {0: Euler((0, math.radians(90), 0)), 1: Euler((math.radians(90), 0, 0)), 2: Euler()}[thin]
    root = bpy.data.objects.new(name + "_root", None); PROPS.objects.link(root)
    o.parent = root
    o.rotation_euler = rot
    o.location = (0, 0, 0)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    s = 0.42 / max(mx.x - mn.x, mx.y - mn.y)
    o.location = -Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    root.scale = (s, s, 0.09 / ((mx.z - mn.z) * s) * s)
    root["thick"] = 0.09
    return root


cushA, cushB, cushX = make_cushion("CushionA"), make_cushion("CushionB"), make_cushion("CushionX")
bpy.data.objects.remove(bpy.data.objects["PillowSrc"])
bpy.data.objects.remove(pillow_mesh)
for c in (cushA, cushB, cushX):
    c.location = (6, -4.5, 0)

# ---------------------------------------------------------------- characters
with bpy.data.libraries.load(CHARS, link=False) as (src, dst):
    dst.collections = [c for c in src.collections if c.startswith("CHR_")]
for c in dst.collections:
    sc.collection.children.link(c)
for c in dst.collections:
    for o in c.objects:
        if o.type == "MESH" and o.data.shape_keys:
            with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
main, crush, boss = Actor("main"), Actor("crush"), Actor("boss")
cws = [Actor("cw1"), Actor("cw2"), Actor("cw3")]
ACTORS = [main, crush, boss] + cws

# crush outfit: white blouse (desaturate the striped print via a saturation mask), dark tights
for o in crush.objs:
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type == "TEX_IMAGE" and n.image and "elegantsuit" in n.image.name and "diffuse" in n.image.name.lower():
                outs = [l.to_socket for l in n.outputs["Color"].links]
                sep = nt.nodes.new("ShaderNodeSeparateColor"); sep.mode = "HSV"
                nt.links.new(n.outputs["Color"], sep.inputs["Color"])
                ramp = nt.nodes.new("ShaderNodeMapRange")
                ramp.inputs["From Min"].default_value = 0.25; ramp.inputs["From Max"].default_value = 0.4
                nt.links.new(sep.outputs[1], ramp.inputs["Value"])
                mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
                nt.links.new(ramp.outputs["Result"], mix.inputs["Factor"])
                nt.links.new(n.outputs["Color"], mix.inputs[6])
                mix.inputs[7].default_value = (0.92, 0.92, 0.9, 1)
                for s in outs:
                    nt.links.new(mix.outputs[2], s)
            if n.type == "TEX_IMAGE" and n.image and "shoes04" in n.image.name and "diffuse" in n.image.name.lower():
                outs = [l.to_socket for l in n.outputs["Color"].links]
                hsv = nt.nodes.new("ShaderNodeHueSaturation"); hsv.inputs["Value"].default_value = 0.22
                nt.links.new(n.outputs["Color"], hsv.inputs["Color"])
                for s in outs:
                    nt.links.new(hsv.outputs["Color"], s)

# park everyone off-set and hidden at frame 1
for i, a in enumerate(ACTORS):
    a.key(1, PZ.STAND, (5.5, -4.2 + 0.0 * i), 0.0)
    key_visible(a.objs, 1, False)

# ---------------------------------------------------------------- helpers for staging
def seat_point(ch, dz=0.0, back=0.04):
    """World position on the seat (slightly behind centre, towards the backrest)."""
    fy = ch.rotation_euler.z - ch["front_yaw"]               # world facing angle of the chair front
    fwd = Vector((math.sin(fy), -math.cos(fy), 0))
    p = ch.location + fwd * (0.06 - back)
    return Vector((p.x, p.y, ch.location.z + ch["seat_z"] + dz))


def chair_face(ch):
    return ch.rotation_euler.z - ch["front_yaw"]


def sit_key(a, f, ch, pose=PZ.SIT, extra=0.085):
    yaw = chair_face(ch)
    return a.key(f, pose, (0, 0), yaw, hips=seat_point(ch, extra, back=0.06))


def stand_in_front(a, f, ch, pose=PZ.STAND, d=0.3):
    yaw = chair_face(ch)
    p = seat_point(ch) + Vector((math.sin(yaw), -math.cos(yaw), 0)) * d
    return a.key(f, pose, (p.x, p.y), yaw)


def sit_down(a, f0, f1, ch, end_pose=PZ.SIT):
    stand_in_front(a, f0, ch)
    yaw = chair_face(ch)
    mid = seat_point(ch, 0.25, back=-0.12)
    a.key(int(f0 + (f1 - f0) * 0.55), PZ.SIT_MID, (0, 0), yaw, hips=mid)
    sit_key(a, f1, ch, end_pose)


def stand_up(a, f0, f1, ch, start_pose=PZ.SIT):
    sit_key(a, f0, ch, start_pose)
    yaw = chair_face(ch)
    a.key(int(f0 + (f1 - f0) * 0.45), PZ.SIT_MID, (0, 0), yaw, hips=seat_point(ch, 0.25, back=-0.12))
    stand_in_front(a, f1, ch)


def sniff_key(a, f, ch, pose=PZ.SNIFF, side=1.0, dz=0.06, along=0.0):
    """Bend over the seat from the chair's side (+1 = chair's left when facing it from the front... world +X for a +Y chair)."""
    yaw_c = chair_face(ch)
    right = Vector((-math.cos(yaw_c), -math.sin(yaw_c), 0))    # side=+1 -> world +X for a chair facing +Y
    yaw = face_dir(*(-right * side)[:2])
    target = seat_point(ch, dz) + Vector((math.sin(yaw_c), -math.cos(yaw_c), 0)) * along
    return a.key(f, pose, (0, 0), yaw, nose=target)


def side_spot(ch, side=1.0, dist=0.62):
    yaw_c = chair_face(ch)
    right = Vector((-math.cos(yaw_c), -math.sin(yaw_c), 0))
    p = seat_point(ch) + right * side * dist
    return (p.x, p.y), face_dir(*(-right * side)[:2])


SHOTS = []          # (name, f0, f1, visible actor list)


def shot(name, t0, t1, cam_loc, cam_target, lens, actors, push=0.03):
    f0, f1 = F(t0), F(t1) - 1
    make_camera("CAM_" + name, f0, f1, cam_loc, cam_target, lens, push, CAMS)
    SHOTS.append((name, f0, f1, actors))
    return f0, f1


def fr(f0, f1, a):
    return int(round(f0 + (f1 - f0) * a))


def L(i, a, b, word=None):
    """Sub-shot of narration line i between fractions a..b (or cut at a given word)."""
    ln = LINES[i]
    s, e = ln["start"], ln["end"]
    return s + (e - s) * a, s + (e - s) * b


def word_time(i, token):
    for w in LINES[i]["words"]:
        if w["w"].lower().startswith(token.lower()):
            return w["s"]
    return None


def move_obj(ob, f, dx=0.0, dy=0.0, dz=0.0, base=None):
    p = (base or ob.location).copy() + Vector((dx, dy, dz))
    key_obj(ob, f, loc=p)
    return p


def hold_obj(ob, f0, f1):
    key_obj(ob, f0, loc=ob.location.copy(), rot=ob.rotation_euler.copy(), scale=ob.scale.copy())
    key_obj(ob, f1, loc=ob.location.copy(), rot=ob.rotation_euler.copy(), scale=ob.scale.copy())


# initial prop states
PROP_SET = [chA, chB, chX, chC, chD, chE, cushA, cushB, cushX, perfume, gel]
for p in PROP_SET:
    key_obj(p, 1, loc=p.location.copy(), rot=p.rotation_euler.copy(), scale=p.scale.copy())
key_visible(meshes(chC) + meshes(chD) + meshes(perfume) + meshes(gel) + [o for c in (cushA, cushB, cushX) for o in c.children], 1, False)
key_visible(meshes(chA) + meshes(chB) + meshes(chX), 1, True)
CUSH_SCALE = {c.name: c.scale.copy() for c in (cushA, cushB, cushX)}


def cushion_on(c, ch, f, squash=1.0):
    p = seat_point(ch, 0.0, back=0.0)
    s = CUSH_SCALE[c.name].copy(); s.z *= squash
    key_obj(c, f, loc=p, rot=Euler((0, 0, chair_face(ch))), scale=s)


# ================================================================ SHOTS
A0 = chA.location.copy()
seatA_out = Vector((0.0, -1.32, 0))
# ---- line 1: she leaves her chair; he sneaks in and sniffs
t0, t1 = L(1, 0.0, 0.48)
f0, f1 = shot("01a_wide_she_leaves", t0, t1, (2.7, -3.5, 1.28), (-0.4, -0.8, 0.85), 22, [crush])
sit_key(crush, f0, chA, PZ.SIT_TYPE)
sit_key(crush, fr(f0, f1, 0.12), chA, PZ.SIT_TYPE)
key_obj(chA, fr(f0, f1, 0.15), loc=A0)
stand_up(crush, fr(f0, f1, 0.15), fr(f0, f1, 0.5), chA, PZ.SIT_TYPE)
key_obj(chA, fr(f0, f1, 0.45), loc=seatA_out)
yaw_l = face_dir(-1, -0.15)
p_up = crush.rig.location.copy()
crush.walk(fr(f0, f1, 0.52), f1 + 12, (p_up.x - 0.1, p_up.y - 0.05), (p_up.x - 2.6, p_up.y - 0.45))

t0, t1 = L(1, 0.48, 1.0)
f0, f1 = shot("01b_ots_sneak_sniff", t0, t1, (1.75, -1.75, 1.62), (-0.05, -1.3, 0.55), 30, [main])
spot, yaw = side_spot(chA, 1.0, 0.62)
main.walk(f0, fr(f0, f1, 0.45), (spot[0] + 1.1, spot[1] - 0.35), (spot[0] + 0.15, spot[1]), cycle=PZ.SNEAK, step=0.3)
sniff_key(main, fr(f0, f1, 0.82), chA, PZ.SNIFF)
sniff_key(main, f1, chA, PZ.SNIFF_IN)

# ---- line 2: close-up sniff, then recoil
t0, t1 = L(2, 0.0, 0.46)
cu = seat_point(chA, 0.0)
f0, f1 = shot("02a_cu_face_seat", t0, t1, (cu.x - 0.5, cu.y + 0.24, cu.z + 0.05), (cu.x + 0.06, cu.y, cu.z + 0.1), 40, [main], push=0.06)
for k, a in enumerate((0.0, 0.3, 0.6, 1.0)):
    sniff_key(main, fr(f0, f1, a), chA, PZ.SNIFF_CU_IN if k % 2 else PZ.SNIFF_CU, dz=0.07)
t0, t1 = L(2, 0.46, 1.0)
f0, f1 = shot("02b_med_recoil", t0, t1, (1.35, -3.5, 1.3), (0.85, -1.32, 1.05), 30, [main])
sniff_key(main, f0, chA, PZ.SNIFF)
spot, yaw = side_spot(chA, 1.0, 0.62)
main.key(f0 + 5, PZ.RECOIL, (spot[0] + 0.25, spot[1]), yaw)
main.key(fr(f0, f1, 0.6), PZ.RECOIL, (spot[0] + 0.4, spot[1]), yaw)
main.key(f1, PZ.RECOIL, (spot[0] + 0.45, spot[1]), yaw)

# ---- line 3: perfume spray, sniff again
t0, t1 = L(3, 0.0, 0.49)
spot, yaw = side_spot(chA, 1.0, 0.72)
hw = main.hand_world(PZ.SPRAY, spot, yaw)
mid = (hw + seat_point(chA, 0.0)) / 2
f0, f1 = shot("03a_cu_perfume_spray", t0, t1, (mid.x - 0.85, mid.y + 0.62, mid.z + 0.12), (mid.x, mid.y, mid.z), 30, [main], push=0.05)
main.key(f0, PZ.SPRAY, spot, yaw)
main.key(f1, PZ.SPRAY, spot, yaw)
sc.frame_set(f0)
bpy.context.view_layer.update()
hand = main.rig.matrix_world @ main.rig.pose.bones["mixamorig:RightHand"].matrix
perfume.parent = main.rig
perfume.parent_type = "BONE"
perfume.parent_bone = "mixamorig:RightHand"
bpy.context.view_layer.update()
grip = hand.translation + (hand.to_3x3() @ Vector((0, 0.07, 0.0)))
perfume.matrix_world = Matrix.Translation(grip - Vector((0, 0, 0.06))) @ Euler((0, 0, yaw + PI / 2)).to_matrix().to_4x4() @ Matrix.Diagonal(perfume.scale.to_4d())
perfume.animation_data_clear()
key_visible(meshes(perfume), f0, True)
key_visible(meshes(perfume), f1 + 1, False)
# mist particles from the nozzle towards the seat
mist_mat = flat_material("Mist", (1, 0.95, 0.98), 0.5, alpha=0.35, emission=((1, 0.92, 0.97), 0.6))
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(6, -4, 1))
mist_obj = bpy.context.object; mist_obj.name = "MistDroplet"; mist_obj.data.materials.append(mist_mat)
mist_obj.hide_render = True
bpy.ops.mesh.primitive_plane_add(size=0.012)
em = bpy.context.object; em.name = "MistEmitter"
bpy.context.view_layer.update()
nozzle = perfume.matrix_world.translation + Vector((0, 0, 0.12))
seat_t = seat_point(chA, 0.02)
em.location = nozzle
em.rotation_euler = (seat_t - nozzle).to_track_quat("Z", "Y").to_euler()
em.parent = perfume
em.matrix_parent_inverse = perfume.matrix_world.inverted()
ps = em.modifiers.new("Mist", "PARTICLE_SYSTEM").particle_system
pst = ps.settings
pst.count = 260; pst.frame_start = fr(f0, f1, 0.18); pst.frame_end = fr(f0, f1, 0.8); pst.lifetime = 22
pst.normal_factor = 2.2; pst.factor_random = 0.35; pst.effector_weights.gravity = 0.08
pst.render_type = "OBJECT"; pst.instance_object = mist_obj; pst.particle_size = 0.01; pst.size_random = 0.7
pst.use_rotations = False; pst.physics_type = "NEWTON"; pst.drag_factor = 0.4
em.show_instancer_for_render = False
key_visible([em], 1, False); key_visible([em], f0, True); key_visible([em], f1 + 1, False)

t0, t1 = L(3, 0.49, 1.0)
f0, f1 = shot("03b_side_sniff_again", t0, t1, (1.85, -2.45, 1.38), (0.15, -1.3, 0.7), 32, [main])
main.key(f0, PZ.STAND, spot, yaw)
sniff_key(main, fr(f0, f1, 0.45), chA, PZ.SNIFF)
sniff_key(main, fr(f0, f1, 0.7), chA, PZ.SNIFF_IN)
sniff_key(main, f1, chA, PZ.SNIFF)

# ---- line 4: perfumed ass -> bigger recoil
t0, t1 = L(4, 0.0, 0.47)
cu = seat_point(chA, 0.0)
f0, f1 = shot("04a_cu_face_perfumed", t0, t1, (cu.x - 0.46, cu.y + 0.38, cu.z + 0.03), (cu.x + 0.06, cu.y, cu.z + 0.1), 40, [main], push=0.06)
for k, a in enumerate((0.0, 0.35, 0.7, 1.0)):
    sniff_key(main, fr(f0, f1, a), chA, PZ.SNIFF_CU_IN if k % 2 else PZ.SNIFF_CU, dz=0.07)
t0, t1 = L(4, 0.47, 1.0)
f0, f1 = shot("04b_wide_big_recoil", t0, t1, (1.2, -4.5, 1.35), (1.25, -1.35, 0.95), 24, [main])
sniff_key(main, f0, chA, PZ.SNIFF)
spot, yaw = side_spot(chA, 1.0, 0.62)
main.key(f0 + 5, PZ.RECOIL_BIG, (spot[0] + 0.45, spot[1]), yaw, zoff=0.12)
main.key(f0 + 10, PZ.RECOIL_BIG, (spot[0] + 0.75, spot[1] - 0.05), yaw)
main.key(fr(f0, f1, 0.6), PZ.RECOIL, (spot[0] + 1.05, spot[1] - 0.1), yaw)
main.key(f1, PZ.RECOIL, (spot[0] + 1.15, spot[1] - 0.1), yaw)

# ---- line 5: she walks past her chair and sits on a different one, glancing at him
t0, t1 = L(5, 0.0, 0.47)
f0, f1 = shot("05a_wide_she_walks_past", t0, t1, (-3.3, -3.6, 1.32), (-0.5, -1.15, 0.9), 22, [crush, main])
crush.walk(f0, f1, (1.9, -1.85), (-1.3, -1.75))
main.key(f0, PZ.STAND, (1.5, -1.25), face_dir(-1, -0.2))
main.key(f1, PZ.STAND, (1.5, -1.25), face_dir(-1, -0.1))
t0, t1 = L(5, 0.47, 1.0)
f0, f1 = shot("05b_wide_she_sits_elsewhere", t0, t1, (-4.7, -3.1, 1.22), (-2.1, -1.0, 0.8), 22, [crush, main])
p = seat_point(chB) + Vector((0, 0.3, 0))
crush.walk(f0, fr(f0, f1, 0.3), (-1.2, -1.7), (p.x + 0.35, p.y - 0.25))
sit_down(crush, fr(f0, f1, 0.33), fr(f0, f1, 0.58), chB)
sit_key(crush, fr(f0, f1, 0.68), chB, PZ.SIT)
sit_key(crush, fr(f0, f1, 0.8), chB, PZ.SIT_GLANCE)
sit_key(crush, f1, chB, PZ.SIT_GLANCE)
main.key(f0, PZ.STAND, (0.2, -1.75), face_dir(-1, 0.1))
main.key(f1, PZ.STAND, (0.2, -1.75), face_dir(-1, 0.2))

# ---- line 6: cushions on every chair, Genius!
g = word_time(6, "Genius")
cut6 = (g - 0.08 - LINES[6]["start"]) / (LINES[6]["end"] - LINES[6]["start"]) if g else 0.735
cush_shots = [("06a_cushion_A", chA, cushA, (1.25, -2.75, 1.35), 0.0, cut6 / 3),
              ("06b_cushion_B", chB, cushB, (-3.95, -2.45, 1.3), cut6 / 3, 2 * cut6 / 3),
              ("06c_cushion_X", chX, cushX, (0.05, 0.75, 1.3), 2 * cut6 / 3, cut6)]
for name, ch, cu, cam, a, b in cush_shots:
    t0, t1 = L(6, a, b)
    tgt = seat_point(ch, 0.1)
    f0, f1 = shot(name, t0, t1, cam, (tgt.x, tgt.y, tgt.z + 0.2), 30, [main])
    spot, yaw = side_spot(ch, 1.0, 0.55)
    main.key(f0, PZ.HOLD, spot, yaw)
    main.key(fr(f0, f1, 0.35), PZ.HOLD, spot, yaw)
    main.key(fr(f0, f1, 0.55), PZ.STAND, spot, yaw)
    main.key(f1, PZ.PROUD, spot, yaw)
    sc.frame_set(fr(f0, f1, 0.35)); bpy.context.view_layer.update()
    pb = main.rig.pose.bones
    hands = (main.rig.matrix_world @ pb["mixamorig:LeftHand"].tail + main.rig.matrix_world @ pb["mixamorig:RightHand"].tail) / 2
    key_visible(list(cu.children), f0, True)
    key_obj(cu, f0, loc=hands - Vector((0, 0, 0.06)), rot=Euler((0, 0, chair_face(ch))), scale=CUSH_SCALE[cu.name])
    key_obj(cu, fr(f0, f1, 0.35), loc=hands - Vector((0, 0, 0.06)))
    cushion_on(cu, ch, fr(f0, f1, 0.5), 0.7)
    cushion_on(cu, ch, fr(f0, f1, 0.58), 1.08)
    cushion_on(cu, ch, fr(f0, f1, 0.66), 1.0)
t0, t1 = L(6, cut6, 1.0)
f0, f1 = shot("06d_low_genius", t0, t1, (1.25, -2.85, 0.55), (0.45, -1.55, 1.35), 22, [main])
pos, yaw = (0.45, -1.6), face_dir(-0.3, 1)
main.key(f0, PZ.STAND, pos, yaw)
main.key(fr(f0, f1, 0.22), PZ.FIST, pos, yaw)
main.key(fr(f0, f1, 0.48), PZ.FIST_DOWN, pos, yaw)
main.key(fr(f0, f1, 0.72), PZ.FIST, pos, yaw)
main.key(f1, PZ.FIST, pos, yaw)

# ---- line 7: she sits on the cushion (squish), leaves; warm cushion; he sniffs happily
t0, t1 = L(7, 0.0, 0.32)
f0, f1 = shot("07a_wide_she_sits_cushion", t0, t1, (-0.2, -3.6, 1.18), (-2.4, -1.0, 0.75), 26, [crush])
p = seat_point(chB)
crush.walk(f0, fr(f0, f1, 0.35), (-4.0, -1.75), (p.x - 0.3, p.y - 0.15))
sit_down(crush, fr(f0, f1, 0.38), fr(f0, f1, 0.72), chB)
cushion_on(cushB, chB, fr(f0, f1, 0.6), 1.0)
cushion_on(cushB, chB, fr(f0, f1, 0.74), 0.42)
sit_key(crush, f1, chB, PZ.SIT)
cushion_on(cushB, chB, f1, 0.42)
t0, t1 = L(7, 0.32, 0.56)
f0, f1 = shot("07b_behind_chair_she_leaves", t0, t1, (-2.4, -3.05, 1.08), (-2.4, -0.4, 0.95), 28, [crush])
sit_key(crush, f0, chB, PZ.SIT)
cushion_on(cushB, chB, f0, 0.42)
stand_up(crush, fr(f0, f1, 0.15), fr(f0, f1, 0.55), chB)
cushion_on(cushB, chB, fr(f0, f1, 0.4), 0.42)
p = crush.rig.location.copy()
crush.walk(fr(f0, f1, 0.58), f1 + 10, (p.x, p.y), (p.x - 2.0, p.y - 0.25))
cushion_on(cushB, chB, f1, 0.5)
t0, t1 = L(7, 0.56, 0.75)
tgt = seat_point(chB, 0.04)
f0, f1 = shot("07c_cu_warm_cushion", t0, t1, (tgt.x + 0.5, tgt.y + 0.42, tgt.z + 0.32), tgt, 40, [], push=0.08)
cushion_on(cushB, chB, f0, 0.5)
cushion_on(cushB, chB, f1, 0.78)
t0, t1 = L(7, 0.75, 1.0)
f0, f1 = shot("07d_med_happy_sniff", t0, t1, (-0.85, -2.45, 1.22), (-2.3, -1.1, 0.68), 32, [main])
cushion_on(cushB, chB, f0, 0.82)
cushion_on(cushB, chB, f1, 0.9)
sniff_key(main, f0, chB, PZ.SNIFF, dz=0.12)
sniff_key(main, fr(f0, f1, 0.35), chB, PZ.SNIFF_IN, dz=0.12)
sniff_key(main, fr(f0, f1, 0.6), chB, PZ.SNIFF_HAPPY, dz=0.14)
sniff_key(main, f1, chB, PZ.SNIFF_HAPPY, dz=0.15)

# ---- line 8: three coworkers sit on it; he sniffs and recoils
cams8 = [(-4.4, -2.7, 1.2), (-0.5, -3.1, 1.3), (-2.45, -3.6, 1.55)]
for k, cw in enumerate(cws):
    t0, t1 = L(8, 0.22 * k, 0.22 * (k + 1))
    f0, f1 = shot(f"08{'abc'[k]}_coworker{k + 1}_sits", t0, t1, cams8[k], (-2.4, -1.0, 0.75), 26, [cw])
    sit_down(cw, f0, fr(f0, f1, 0.6), chB)
    sit_key(cw, f1, chB, PZ.SIT_HEAVY if k == 2 else PZ.SIT)
    cushion_on(cushB, chB, f0, 0.95)
    cushion_on(cushB, chB, fr(f0, f1, 0.6), 0.42)
    cushion_on(cushB, chB, f1, 0.42)
t0, t1 = L(8, 0.66, 1.0)
f0, f1 = shot("08d_med_sniff_recoil", t0, t1, (-0.45, -3.05, 1.25), (-1.85, -1.1, 0.8), 26, [main])
cushion_on(cushB, chB, f0, 0.6)
sniff_key(main, f0, chB, PZ.SNIFF, dz=0.1)
sniff_key(main, fr(f0, f1, 0.4), chB, PZ.SNIFF_IN, dz=0.1)
spot, yaw = side_spot(chB, 1.0, 0.62)
main.key(fr(f0, f1, 0.55), PZ.RECOIL, (spot[0] + 0.3, spot[1]), yaw)
main.key(f1, PZ.RECOIL, (spot[0] + 0.45, spot[1]), yaw)

# ---- line 9: swap in the breathable mesh chair
t0, t1 = L(9, 0.0, 0.44)
f0, f1 = shot("09a_med_drag_old_chair", t0, t1, (-1.6, -3.5, 1.35), (-2.9, -1.05, 0.7), 26, [main])
B0, CB0 = chB.location.copy(), cushB.location.copy()
main.key(f0, PZ.PUSH, (B0.x + 0.62, B0.y), face_dir(-1, 0))
main.key(fr(f0, f1, 0.2), PZ.PUSH, (B0.x + 0.62, B0.y), face_dir(-1, 0))
key_obj(chB, fr(f0, f1, 0.2), loc=B0); key_obj(cushB, fr(f0, f1, 0.2), loc=CB0)
main.walk(fr(f0, f1, 0.2), f1 + 2, (B0.x + 0.62, B0.y), (B0.x - 1.6, B0.y - 0.1),
          cycle=[dict(c, **{k: v for k, v in PZ.PUSH.items() if "Arm" in k or "Hand" in k or k in ("Hips", "Spine")}) for c in PZ.WALK])
key_obj(chB, f1 + 2, loc=B0 + Vector((-2.22, -0.1, 0))); key_obj(cushB, f1 + 2, loc=CB0 + Vector((-2.22, -0.1, 0)))
key_visible(meshes(chB) + list(cushB.children), f1 + 1, False)
t0, t1 = L(9, 0.44, 1.0)
f0, f1 = shot("09b_wide_mesh_chair_arrives", t0, t1, (-4.5, -3.1, 1.3), (-2.0, -1.0, 0.8), 22, [main])
key_visible(meshes(chC), f0, True)
C_end = Vector((-2.4, CHAIR_Y, 0))
key_obj(chC, f0, loc=C_end + Vector((1.9, -0.1, 0)))
key_obj(chC, fr(f0, f1, 0.55), loc=C_end)
main.walk(f0, fr(f0, f1, 0.55), (C_end.x + 2.55, C_end.y - 0.1), (C_end.x + 0.66, C_end.y),
          cycle=[dict(c, **{k: v for k, v in PZ.PUSH.items() if "Arm" in k or "Hand" in k or k in ("Hips", "Spine")}) for c in PZ.WALK])
main.key(fr(f0, f1, 0.7), PZ.STAND, (C_end.x + 0.75, C_end.y - 0.25), face_dir(0, -1))
main.key(fr(f0, f1, 0.82), PZ.PRESENT, (C_end.x + 0.75, C_end.y - 0.3), face_dir(-0.3, -1))
main.key(f1, PZ.PRESENT, (C_end.x + 0.75, C_end.y - 0.3), face_dir(-0.3, -1))
key_obj(chC, f1, loc=C_end)

# ---- line 10: nose stuck in the mesh
t0, t1 = L(10, 0.0, 0.4)
f0, f1 = shot("10a_ots_sniff_mesh", t0, t1, (-1.05, -1.62, 1.6), (-2.45, -1.1, 0.55), 30, [main])
spot, yaw = side_spot(chC, 1.0, 0.62)
main.key(f0, PZ.STAND, spot, yaw)
sniff_key(main, fr(f0, f1, 0.55), chC, PZ.SNIFF, dz=0.04)
sniff_key(main, f1, chC, PZ.SNIFF_IN, dz=0.0)
t0, t1 = L(10, 0.4, 1.0)
nose_pt = seat_point(chC, 0.0)
f0, f1 = shot("10b_ecu_nose_stuck", t0, t1, (nose_pt.x - 0.3, nose_pt.y + 0.26, nose_pt.z + 0.42),
              (nose_pt.x + 0.05, nose_pt.y, nose_pt.z + 0.06), 38, [main], push=0.08)
n = 8
for k in range(n + 1):
    f = fr(f0, f1, k / n)
    sniff_key(main, f, chC, PZ.STUCK2 if k % 2 else PZ.STUCK, dz=-0.01)
    key_obj(chC, f, loc=C_end + Vector((0.035 if k % 2 else 0.0, 0, 0)), rot=Euler((0, math.radians(-3 if k % 2 else 0), chC.rotation_euler.z)))

# ---- line 11: cooling gel layer
t0, t1 = L(11, 0.0, 1.0)
tgt = seat_point(chC, 0.05)
f0, f1 = shot("11a_cu_place_gel", t0, t1, (tgt.x + 0.55, tgt.y + 0.6, tgt.z + 0.72), (tgt.x + 0.05, tgt.y, tgt.z + 0.12), 30, [main], push=0.06)
key_obj(chC, f0, loc=C_end, rot=Euler((0, 0, chC.rotation_euler.z)))
spot, yaw = side_spot(chC, 1.0, 0.6)
main.key(f0, PZ.HOLD, spot, yaw)
main.key(fr(f0, f1, 0.55), PZ.PLACE, spot, yaw)
main.key(fr(f0, f1, 0.75), PZ.PLACE, spot, yaw)
main.key(f1, PZ.STAND, (spot[0] + 0.1, spot[1]), yaw)
key_visible(meshes(gel), f0, True)
sp = seat_point(chC, 0.012, back=0.0)
key_obj(gel, f0, loc=sp + Vector((0.12, 0, 0.42)), rot=Euler((0, 0, chair_face(chC))))
key_obj(gel, fr(f0, f1, 0.55), loc=sp + Vector((0, 0, 0.03)))
key_obj(gel, fr(f0, f1, 0.66), loc=sp)
key_obj(gel, f1, loc=sp)

# ---- line 12: the boss sits and the chair collapses
t0, t1 = L(12, 0.0, 0.41)
f0, f1 = shot("12a_wide_boss_sits", t0, t1, (-4.7, -3.3, 1.3), (-2.2, -0.95, 0.85), 22, [boss, main])
p = seat_point(chC)
boss.walk(f0, fr(f0, f1, 0.45), (0.2, -1.9), (p.x + 0.35, p.y + 0.15))
sit_down(boss, fr(f0, f1, 0.5), fr(f0, f1, 0.82), chC, PZ.SIT_HEAVY)
sit_key(boss, f1, chC, PZ.SIT_HEAVY)
main.key(f0, PZ.STAND, (-0.6, -2.2), face_dir(-1, 0.6))
main.key(f1, PZ.SHOCK, (-0.6, -2.2), face_dir(-1, 0.6))
# collapse: base parts fly out, seat drops, boss falls back
t0, t1 = L(12, 0.41, 0.70)
f0, f1 = shot("12b_wide_collapse", t0, t1, (0.35, -3.7, 1.05), (-2.4, -1.0, 0.55), 26, [boss])
seat_z = chC["seat_z"]
parts = meshes(chC)
sc.frame_set(f0); bpy.context.view_layer.update()
fb = fr(f0, f1, 0.15)
centre = C_end.copy()
for o in parts:
    mw = o.matrix_world.copy()
    pts = [mw @ Vector(c) for c in o.bound_box]
    zc = sum(p.z for p in pts) / 8
    c = sum(pts, Vector()) / 8
    o.rotation_mode = "XYZ"
    key_obj(o, f0, loc=o.location.copy(), rot=o.rotation_euler.copy())
    key_obj(o, fb, loc=o.location.copy(), rot=o.rotation_euler.copy())
    if max(p.z for p in pts) < seat_z - 0.08:     # star base, wheels, cylinder: break apart
        d = Vector((c.x - centre.x, c.y - centre.y, 0))
        d = d.normalized() if d.length > 0.01 else Vector((random.uniform(-1, 1), random.uniform(-1, 1), 0)).normalized()
        new = Matrix.Translation(d * random.uniform(0.25, 0.55) + Vector((0, 0, -zc + 0.03))) @ mw
        new = Matrix.Translation(new.translation) @ Euler((random.uniform(-1.2, 1.2), random.uniform(-1.2, 1.2), random.uniform(-2, 2))).to_matrix().to_4x4() @ Matrix.Translation(-new.translation) @ new
    else:                                          # seat + back drop to the floor and tip back
        new = Matrix.Translation(Vector((0, -0.12, -(seat_z - 0.14)))) @ mw
    o.matrix_world = new
    key_obj(o, fr(f0, f1, 0.45), loc=o.location.copy(), rot=o.rotation_euler.copy())
    key_obj(o, f1, loc=o.location.copy(), rot=o.rotation_euler.copy())
key_obj(gel, fb, loc=sp)
key_obj(gel, fr(f0, f1, 0.45), loc=sp + Vector((0, -0.12, -(seat_z - 0.14))))
sit_key(boss, f0, chC, PZ.SIT_HEAVY)
sit_key(boss, fb, chC, PZ.SIT_HEAVY)
yawb = chair_face(chC)
back = Vector((-math.sin(yawb), math.cos(yawb), 0))
hp = seat_point(chC, 0.09)
boss.key(fr(f0, f1, 0.4), PZ.SIT_HEAVY, (0, 0), yawb, hips=(hp.x, hp.y, 0.22), tilt=-0.35)
boss.key(fr(f0, f1, 0.7), PZ.FALLEN, (0, 0), yawb, hips=tuple(Vector((hp.x, hp.y, 0.13)) + back * 0.25), tilt=-1.45)
boss.key(f1, PZ.FALLEN, (0, 0), yawb, hips=tuple(Vector((hp.x, hp.y, 0.13)) + back * 0.25), tilt=-1.5)
t0, t1 = L(12, 0.70, 1.0)
f0, f1 = shot("12c_low_boss_down", t0, t1, (-1.25, -2.75, 0.32), (-2.45, -1.2, 0.25), 24, [boss, main])
for k, a in enumerate((0.0, 0.3, 0.6, 1.0)):
    pz = dict(PZ.FALLEN, **({"LeftUpLeg": ("aim", (0.3, -1, 0.3)), "RightUpLeg": ("aim", (-0.3, -0.7, -0.6))} if k % 2 else {}))
    boss.key(fr(f0, f1, a), pz, (0, 0), yawb, hips=tuple(Vector((hp.x, hp.y, 0.13)) + back * 0.25), tilt=-1.5)
main.key(f0, PZ.SHOCK, (-3.65, -0.8), face_dir(1, -0.4))
main.key(f1, PZ.SHOCK, (-3.65, -0.8), face_dir(1, -0.4))

# ---- line 13: gas lift + five wheels
t0, t1 = L(13, 0.0, 0.49)
D_pos = Vector((-2.4, CHAIR_Y, 0))
f0, f1 = shot("13a_low_cu_gaslift", t0, t1, (D_pos.x + 0.42, D_pos.y - 0.62, 0.1), (D_pos.x, D_pos.y, 0.36), 26, [], push=0.04)
key_visible(meshes(chC) + meshes(gel), f0, False)
key_visible([o for o in [boss.rig] + boss.objs], f0, False)
key_visible(meshes(chD), f0, True)
key_obj(chD, f0, loc=D_pos, rot=Euler((0, 0, chD["front_yaw"] + PI)))
# rise: only the parts above the gas cylinder top move up
sc.frame_set(f0); bpy.context.view_layer.update()
for o in meshes(chD):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    if min(p.z for p in pts) > 0.22:
        mw = o.matrix_world.copy()
        key_obj(o, fr(f0, f1, 0.15), loc=o.location.copy())
        o.matrix_world = Matrix.Translation((0, 0, 0.07)) @ mw
        key_obj(o, fr(f0, f1, 0.85), loc=o.location.copy())
        print("rising part", o.name)
t0, t1 = L(13, 0.49, 1.0)
f0, f1 = shot("13b_low_wide_new_chair", t0, t1, (-1.05, -3.25, 0.42), (-2.3, -1.0, 0.8), 22, [main])
main.key(f0, PZ.STAND, (-1.55, -1.45), face_dir(0.2, -1))
main.key(fr(f0, f1, 0.4), PZ.PROUD, (-1.55, -1.45), face_dir(0.2, -1))
main.key(f1, PZ.PROUD, (-1.55, -1.45), face_dir(0.2, -1))

# ---- line 14: final over-the-shoulder: she leaves, he rolls in on his own chair and sniffs
t0, t1 = L(14, 0.0, 1.0)
f0, f1 = shot("14a_ots_roll_in_final", t0, t1, (-0.45, -1.85, 1.38), (-2.4, -1.0, 0.62), 28, [crush, main], push=0.04)
chD.location = D_pos
sit_key(crush, f0, chD, PZ.SIT_TYPE)
sit_key(crush, fr(f0, f1, 0.06), chD, PZ.SIT_TYPE)
stand_up(crush, fr(f0, f1, 0.08), fr(f0, f1, 0.3), chD, PZ.SIT_TYPE)
p = crush.rig.location.copy()
crush.walk(fr(f0, f1, 0.32), fr(f0, f1, 0.72), (p.x, p.y), (p.x - 0.95, p.y - 2.1))
key_visible(meshes(chE), 1, True)
yaw_e = face_dir(-1, 0.05)
E0 = chE.location.copy(); E0r = chE.rotation_euler.copy()
key_obj(chE, f0 - 1, loc=E0, rot=E0r)
# where must his chair end so that the nose reaches the seat?
sp = seat_point(chD, 0.1)
chE.rotation_euler = (0, 0, chE["front_yaw"] + yaw_e)
basis, posed = rp.solve(main.rig, PZ.SIT_LEAN)
Mtmp = Matrix.Rotation(yaw_e, 4, "Z")
off = (Mtmp @ (posed[rp.P + "Head"] @ Vector((0, 0.085, 0.105)))) - (Mtmp @ posed[rp.P + "Hips"].translation)
hips_final = sp - off
hips_final.z = chE["seat_z"] + 0.085
E_final = Vector((hips_final.x, hips_final.y, 0)) - Vector((math.sin(yaw_e), -math.cos(yaw_e), 0)) * 0.0
E_start = E_final + Vector((1.9, -0.25, 0))
for f, ep, pose in [(f0, E_start, PZ.SIT_ROLL), (fr(f0, f1, 0.22), E_start, PZ.SIT_ROLL), (fr(f0, f1, 0.36), E_start.lerp(E_final, 0.5), PZ.SIT_ROLL),
                    (fr(f0, f1, 0.5), E_final, PZ.SIT), (fr(f0, f1, 0.6), E_final, PZ.SIT_LEAN), (f1 + 1, E_final, PZ.SIT_LEAN)]:
    key_obj(chE, f, loc=ep, rot=Euler((0, 0, chE["front_yaw"] + yaw_e)))
    hp = Vector((ep.x, ep.y, chE["seat_z"] + 0.085))
    main.key(f, pose, (0, 0), yaw_e, hips=hp)
key_visible(meshes(chA), f0, True)

# ---------------------------------------------------------------- visibility per shot
for name, f0, f1, vis in SHOTS:
    for a in ACTORS:
        key_visible(a.objs, f0, a in vis)
for o in bpy.data.objects:
    constant_interp(o)
    if o.animation_data and o.animation_data.action:
        pass
# frame 1 camera
sc.camera = bpy.data.objects["CAM_01a_wide_she_leaves"]
json.dump([{"name": n, "f0": a, "f1": b} for n, a, b, _ in SHOTS], open(os.path.join(os.path.dirname(OUT), "build", "shots.json") if os.path.isdir(os.path.join(os.path.dirname(OUT), "build")) else OUT + ".shots.json", "w"), indent=1)
print("SHOTS", len(SHOTS))
# portable file: MakeHuman textures point at <assets>/mh/data, all paths relative to the .blend
for img in bpy.data.images:
    fp = bpy.path.abspath(img.filepath)
    if "/mh/data/" in fp and not fp.startswith(ASSETS):
        img.filepath = os.path.join(ASSETS, "mh", "data", fp.split("/mh/data/", 1)[1])
try:
    bpy.ops.file.make_paths_relative()
except RuntimeError as e:
    print("relative paths:", e)
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True, relative_remap=True)
