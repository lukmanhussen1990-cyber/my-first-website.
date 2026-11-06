"""Pregnant Man: build the animated short in Blender (bpy) -> pregnant_man.blend

    python scripts/build_scene.py <assets_dir> build/characters.blend build/timing.json pregnant_man.blend

Ready-made assets only: MakeHuman/MPFB2 actors (the pillow bump is MakeHuman's own 'stomach-pregnant' target),
Poly Haven (CC0) living-room furniture, textures and HDRIs, Sketchfab models (CC-BY, via the Objaverse mirror)
for the watermelon, belt, harness straps, motor, stethoscope, exam table and front door. The silicone belly is
a smooth sphere with the MakeHuman skin material (as the brief allows). Shots are fractions of narration lines.
"""
import json, math, os, random, sys

import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses as PZ          # noqa: E402
from scenelib import (F, Actor, box, chair_info, constant_interp, face_dir, flat_material, import_model,  # noqa: E402
                      key_obj, key_visible, make_camera, meshes, pbr_material, place, uv_box_project)

ASSETS = os.path.abspath(sys.argv[1]); CHARS, TIMING, OUT = [os.path.abspath(a) for a in sys.argv[2:5]]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(5)
T = json.load(open(TIMING))
LINES = {l["i"]: l for l in T["lines"]}
DUR = T["duration"]
LAST = int(math.floor(DUR * 30))
PI = math.pi
OJ = lambda uid: os.path.join(ASSETS, "objaverse", uid + ".glb")
PH = lambda slug: os.path.join(ASSETS, "polyhaven", slug, f"{slug}_1k.gltf")
TEX = lambda slug: os.path.join(ASSETS, "polyhaven", "tex", slug)

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

# ---------------------------------------------------------------- world (sunny suburban street HDRI) + lights
world = bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
env = wn.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(ASSETS, "polyhaven", "hdri", "pretville_street_2k.hdr"))
wl.new(env.outputs["Color"], wn["Background"].inputs["Color"])
wn["Background"].inputs["Strength"].default_value = 0.9
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); SET.objects.link(sun)
sun.data.energy = 3.0; sun.data.angle = math.radians(3); sun.data.color = (1.0, 0.96, 0.9)
sun.rotation_euler = (math.radians(38), math.radians(8), math.radians(150))
H = 2.8


def room(cx, cy, w, d, floor_tex, wall_tex, name, door=None, wall_tint=(1, 1, 1)):
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    fm = pbr_material(name + "Floor", TEX(floor_tex), 1.0)
    wm = pbr_material(name + "Wall", TEX(wall_tex), 1.0, tint=wall_tint)
    cm = flat_material(name + "Ceil", (0.92, 0.92, 0.9), 0.9, emission=((1.0, 0.99, 0.97), 0.55))
    f = box(name + "Floor", (w, d, 0.02), (cx, cy, -0.01), fm, SET); uv_box_project(f, 1.5)
    c = box(name + "Ceiling", (w, d, 0.04), (cx, cy, H + 0.02), cm, SET); uv_box_project(c, 1.2); c.visible_shadow = False
    walls = [box(name + "WallFront", (w, 0.1, H), (cx, y0 - 0.05, H / 2), wm, SET),
             box(name + "WallL", (0.1, d, H), (x0 - 0.05, cy, H / 2), wm, SET),
             box(name + "WallR", (0.1, d, H), (x1 + 0.05, cy, H / 2), wm, SET)]
    if door:                       # back wall with a doorway between door[0]..door[1] (x), 2.15 m tall
        dx0, dx1 = door
        walls += [box(name + "WallBackL", (dx0 - x0, 0.1, H), ((x0 + dx0) / 2, y1 + 0.05, H / 2), wm, SET),
                  box(name + "WallBackR", (x1 - dx1, 0.1, H), ((dx1 + x1) / 2, y1 + 0.05, H / 2), wm, SET),
                  box(name + "WallBackTop", (dx1 - dx0, 0.1, H - 2.15), ((dx0 + dx1) / 2, y1 + 0.05, 2.15 + (H - 2.15) / 2), wm, SET)]
    else:
        walls.append(box(name + "WallBack", (w, 0.1, H), (cx, y1 + 0.05, H / 2), wm, SET))
    for wl_ in walls:
        uv_box_project(wl_, 2.0); wl_.visible_shadow = False
    for i, (lx, ly) in enumerate([(cx - w / 4, cy - d / 4), (cx + w / 4, cy - d / 4), (cx - w / 4, cy + d / 4), (cx + w / 4, cy + d / 4)]):
        l = bpy.data.objects.new(f"{name}Panel{i}", bpy.data.lights.new(f"{name}Panel{i}", "AREA")); SET.objects.link(l)
        l.data.shape = "RECTANGLE"; l.data.size = 1.2; l.data.size_y = 0.6; l.data.energy = 230
        l.data.use_shadow = False; l.location = (lx, ly, H - 0.04)
    return x0, x1, y0, y1


def model(path, name, size, axis="z", x=0.0, y=0.0, z=0.0, face=0.0, coll=SET, chair=False):
    r = import_model(path, name, size, axis, coll)
    if chair:
        chair_info(r)
    place(r, x, y, z, face)
    return r


# ---------------------------------------------------------------- living room (origin) with the front door in the back wall
DOOR = (1.45, 2.45)
LX0, LX1, LY0, LY1 = room(0, 0.3, 7.2, 6.6, "wood_floor", "beige_wall_001", "Living", DOOR, (1.05, 1.03, 1.0))
outside = box("Patio", (8, 6, 0.02), (1.9, LY1 + 3.1, -0.01), pbr_material("Patio", TEX("patio_tiles"), 1.0), SET)
uv_box_project(outside, 1.0)
model(OJ("b1a2328c3af342adae6da2acc45ee3fb"), "FrontDoor", 2.17, "z", DOOR[0] + 0.05, LY1 - 0.45, face=-PI / 2 + 0.25)
poster = model(PH("hanging_picture_frame_02"), "BabyPoster", 0.9, "x", -0.9, LY1 - 0.03, 1.35, face=0.0)
baby_img = bpy.data.images.load(os.path.join(HERE, "build", "baby_poster.png"))
import bmesh  # noqa: E402
for o in meshes(poster):                      # drop the frame's glass pane (renders dark without ray tracing)
    gi = [i for i, m in enumerate(o.data.materials) if m and "glass" in m.name]
    if gi:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in gi], context="FACES")
        bm.to_mesh(o.data); bm.free()
for o in meshes(poster):
    for m in o.data.materials:
        if "artwork" in m.name:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and "diff" in n.image.name:
                    n.image = baby_img
SOFA = model(PH("sofa_03"), "Sofa", 1.0, "z", LX0 + 0.55, 0.4, face=PI / 2, chair=True)
model(PH("modern_coffee_table_01"), "CoffeeTable", 0.39, "z", -1.75, 0.4)
model(PH("modern_wooden_cabinet"), "TVCabinet", 0.62, "z", LX1 - 0.32, 0.4, face=-PI / 2)
model(PH("Television_01"), "TV", 0.47, "z", LX1 - 0.4, 0.4, 0.62, face=-PI / 2)
model(PH("side_table_01"), "SideTable", 0.55, "z", LX0 + 0.4, 2.3)
model(PH("potted_plant_04"), "PlantSide", 0.27, "z", LX0 + 0.4, 2.3, 0.55)
model(PH("potted_plant_02"), "PlantCorner", 0.9, "z", LX1 - 0.45, LY1 - 0.45)
model(PH("potted_plant_01"), "PlantFront", 1.35, "z", LX0 + 0.5, LY0 + 0.5)
model(PH("standing_picture_frame_01"), "PhotoFrame", 0.22, "z", LX1 - 0.3, 0.9, 0.62, face=-PI / 2)
for i, (x, y) in enumerate([(-1.8, -1.3), (1.8, -1.3), (-1.8, 1.9), (1.8, 1.9)]):
    model(PH("mounted_fluorescent_lights"), f"Fixture{i}", 1.1, "max", x, y, H - 0.04)

# ---------------------------------------------------------------- clinic (x = +20)
CX = 20.0
CX0, CX1, CY0, CY1 = room(CX, 0.0, 6.0, 5.4, "laminate_floor_02", "beige_wall_001", "Clinic", None, (0.95, 1.02, 1.08))
EXAM = model(OJ("f8c7b550578541ebafe3bb09911f2f17"), "ExamTable", 1.0, "z", CX + 1.1, 1.6, face=PI, chair=True)
model(PH("metal_office_desk"), "DocDesk", 0.788, "z", CX - 1.6, 1.75)
DOCCHAIR = model(OJ("675f34f7304e4d92812a41e9750539aa"), "DocChair", 1.05, "z", CX - 1.4, 0.85, face=-PI / 2 + 0.5, chair=True)
model(OJ("3dfd70d1c9404b0997b0fb456a91fd02"), "DocMonitor", 0.56, "x", CX - 1.5, 1.98, 0.788)
model(PH("drawer_cabinet"), "DocCabinet", 1.6, "z", CX + 2.5, CY1 - 0.3)
model(PH("potted_plant_02"), "DocPlant", 0.9, "z", CX0 + 0.45, CY1 - 0.45)
model(PH("hanging_picture_frame_02"), "DocChart", 0.9, "x", CX + 0.1, CY1 - 0.03, 1.45, face=0.0)
model(PH("wall_clock"), "DocClock", 0.34, "z", CX - 1.6, CY1 - 0.03, 2.1)
for i, (x, y) in enumerate([(CX - 1.5, -1.2), (CX + 1.5, -1.2), (CX - 1.5, 1.2), (CX + 1.5, 1.2)]):
    model(PH("mounted_fluorescent_lights"), f"DocFixture{i}", 1.1, "max", x, y, H - 0.04)
for o in SET.all_objects:
    if o.type == "MESH" and o.name.split("__")[0].startswith(("Fixture", "DocFixture", "Plant", "DocPlant", "PhotoFrame",
                                                              "BabyPoster", "DocChart", "DocClock", "TV")):
        o.visible_shadow = False
print("sofa seat", round(SOFA["seat_z"], 3), "exam seat", round(EXAM["seat_z"], 3), "doc chair", round(DOCCHAIR["seat_z"], 3))

# ---------------------------------------------------------------- characters
with bpy.data.libraries.load(CHARS, link=False) as (src_l, dst):
    dst.collections = [c for c in src_l.collections if c.startswith("CHR_") and c != "CHR_baby"]
for c in dst.collections:
    sc.collection.children.link(c)
    for o in c.objects:
        if o.type == "MESH" and o.data.shape_keys:
            with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
main, preg, doc, kid = Actor("main"), Actor("main_preg"), Actor("doctor"), Actor("cousin")
ACTORS = [main, preg, doc, kid]
for o in doc.objs:                                     # doctor's suit -> white coat
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.node_tree:
            continue
        for n in list(m.node_tree.nodes):
            if n.type == "TEX_IMAGE" and n.image and "elegantsuit" in n.image.name and "diffuse" in n.image.name.lower():
                outs = [l.to_socket for l in n.outputs["Color"].links]
                hsv = m.node_tree.nodes.new("ShaderNodeHueSaturation")
                hsv.inputs["Saturation"].default_value = 0.15; hsv.inputs["Value"].default_value = 4.5
                m.node_tree.links.new(n.outputs["Color"], hsv.inputs["Color"])
                for s_ in outs:
                    m.node_tree.links.new(hsv.outputs["Color"], s_)
for i, a in enumerate(ACTORS):
    a.key(1, PZ.STAND, (9.0 + 0.6 * i, -4.0), 0.0)
    key_visible(a.objs, 1, False)


def bone_world(actor, bone, at="head"):
    b = actor.rig.data.bones["mixamorig:" + bone]
    return actor.rig.matrix_world @ (b.head_local if at == "head" else b.tail_local)


# ---------------------------------------------------------------- props attached to the bodies
def attach(obj, actor, bone, world_pos, rot=Euler()):
    """Bone-parent obj to actor's bone so that (in the rig's rest pose at the origin) it sits at world_pos."""
    rig = actor.rig
    saved = (rig.location.copy(), rig.rotation_euler.copy())
    obj.parent = rig; obj.parent_type = "BONE"; obj.parent_bone = "mixamorig:" + bone
    bpy.context.view_layer.update()
    pb = rig.pose.bones["mixamorig:" + bone]
    for p in rig.pose.bones:
        p.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.view_layer.update()
    obj.matrix_world = rig.matrix_world @ Matrix.Translation(world_pos) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal(obj.scale.to_4d())
    return obj


# reference: belly front of the rest pose (rig at its own origin, facing -Y)
def belly_point(actor, fwd=0.2, up=0.0):
    sp = actor.rig.data.bones["mixamorig:Spine"].head_local
    return Vector((0.0, sp.y - fwd, sp.z + up))


# rig at origin for attaching
for a in (main, preg, kid, doc):
    a.rig.animation_data_clear() if False else None
melon = import_model(OJ("5a0ae2276ac845c9a93b240c076aae19"), "Watermelon", 0.36, "max", PROPS)
belt_src = import_model(OJ("8cba1fb2d0b6442cb0b7aa903025676c"), "BeltSrc", 0.74, "max", PROPS)
for o in meshes(belt_src):
    if not o.name.split("__", 1)[1].startswith(("belt_leather", "buckle_metal")):
        bpy.data.objects.remove(o)
harness = import_model(OJ("41638e5ec5264ed481d7cda15806ca0e"), "Harness", 0.82, "z", PROPS)
motor = import_model(OJ("048b9dc3095e44c0883b6b7944ad4916"), "Motor", 0.14, "max", PROPS)
steth = import_model(OJ("0d6d1f290ed94ee2a930d569b3893e56"), "Stethoscope", 0.36, "max", PROPS)
pillow_src = import_model(PH("throw_pillows_01"), "PillowSrc", 1.0, "max", PROPS)
pm = sorted(meshes(pillow_src), key=lambda o: o.name)
for o in pm[1:]:
    bpy.data.objects.remove(o)
PILLOW = pillow_src
PILLOW.scale *= 0.48 / max(PILLOW["size"][:2])
# silicone belly: a smooth sphere with the MakeHuman skin material of the main guy (allowed by the brief)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0)
belly = bpy.context.object; belly.name = "SiliconeBelly"
bpy.ops.object.shade_smooth()
belly.scale = (0.18, 0.15, 0.19)
skin = flat_material("SiliconeSkin", (0.78, 0.52, 0.4), 0.42)
skin.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.25
belly.data.materials.append(skin)
for c in list(belly.users_collection):
    c.objects.unlink(belly)
PROPS.objects.link(belly)
belly_slide = belly.copy(); belly_slide.data = belly.data; PROPS.objects.link(belly_slide); belly_slide.name = "SiliconeBellySlide"

bpy.context.view_layer.update()
BP = belly_point(main, 0.24, -0.08)
attach(melon, main, "Spine", BP + Vector((0, -0.04, 0.0)), Euler((0, 0, 0)))
attach(belt_src, main, "Spine", BP + Vector((0, 0.13, -0.12)), Euler((0, 0, 0)))
attach(belly, main, "Spine", BP + Vector((0, 0.03, 0.02)))
sh_top = main.rig.data.bones["mixamorig:Spine2"].tail_local
attach(harness, main, "Spine1", Vector((0.0, sh_top.y + 0.05, sh_top.z - 0.82 + 0.06)), Euler((0, 0, 0)))
neck = doc.rig.data.bones["mixamorig:Neck"].head_local
attach(steth, doc, "Spine2", Vector((0.0, neck.y - 0.13, neck.z - 0.33)), Euler((0, 0, 0)))
belly_slide.parent = main.rig
BELLY_SLIDE_TOP = Vector((0, BP.y - 0.02, BP.z))
belly_slide.location = BELLY_SLIDE_TOP
MELON_L = melon.location.copy(); BELT_L = belt_src.location.copy(); BELLY_L = belly.location.copy(); HARN_L = harness.location.copy()
BELLY_S = belly.scale.copy()
PROP_MESHES = {n: meshes(o) if o.type == "EMPTY" else [o] for n, o in
               {"melon": melon, "belt": belt_src, "belly": belly, "slide": belly_slide, "harness": harness, "motor": motor,
                "steth": steth, "pillow": PILLOW}.items()}
for n, ms in PROP_MESHES.items():
    key_visible(ms, 1, n == "steth")
for o in (melon, belt_src, belly, belly_slide, harness, motor, PILLOW):
    key_obj(o, 1, loc=o.location.copy(), rot=o.rotation_euler.copy(), scale=o.scale.copy())

# watermelon burst: red flesh + green rind chunks (particles)
flesh = flat_material("MelonFlesh", (0.85, 0.08, 0.12), 0.45)
rind = flat_material("MelonRind", (0.12, 0.42, 0.12), 0.5)
chunks = []
for nm, mat, sz in [("ChunkFlesh", flesh, 0.03), ("ChunkRind", rind, 0.028)]:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=sz * 1.6, location=(12, -6, 0))
    ch = bpy.context.object; ch.name = nm; ch.data.materials.append(mat); ch.scale = (1, 0.7, 0.55); chunks.append(ch)
chunk_coll = bpy.data.collections.new("MelonChunks")
for ch in chunks:
    for c in list(ch.users_collection):
        c.objects.unlink(ch)
    chunk_coll.objects.link(ch)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.12, location=(0, 0, 0))
burst = bpy.context.object; burst.name = "MelonBurstEmitter"; burst.show_instancer_for_render = False
bpy.ops.mesh.primitive_plane_add(size=1)
floor_col = bpy.context.object; floor_col.name = "BurstFloorCollider"; floor_col.hide_render = True
floor_col.modifiers.new("col", "COLLISION")

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


def sit_key(a, f, ch, pose=PZ.SIT, extra=0.085, back=0.06):
    return a.key(f, pose, (0, 0), chair_face(ch), hips=seat_point(ch, extra, back=back))


def both(f, pose, loc, yaw, **kw):
    """Key the flat and the pillow-belly versions of the main guy identically (for mid-shot swaps)."""
    main.key(f, pose, loc, yaw, **kw)
    preg.key(f, pose, loc, yaw, **kw)


def vis_swap(f, show_preg):
    key_visible(preg.objs, f, show_preg)
    key_visible(main.objs, f, not show_preg)


def melon_pose(f, dz=0.0, dy=0.0):
    key_obj(melon, f, loc=MELON_L + Vector((0, dz, dy)))


EXTRA_VIS = []
# ================================================================ SHOTS
# ---- 1: baby poster; rubbing his flat belly
t0, t1 = L(1, 0.0, 0.52)
f0, f1 = shot("01a_ots_baby_poster", t0, t1, (-0.35, 0.95, 1.62), (-0.9, LY1, 1.48), 30, [main], push=0.06)
main.key(f0, PZ.LOOK_WALL if hasattr(PZ, "LOOK_WALL") else PZ.STAND, (-0.85, 2.15), face_dir(0, 1))
main.key(f1, dict(PZ.STAND, **{"Head": ("rot", (-14, 0, 0))}), (-0.85, 2.15), face_dir(0, 1))
t0, t1 = L(1, 0.52, 1.0)
f0, f1 = shot("01b_side_rubbing_flat_belly", t0, t1, (0.7, 2.45, 1.2), (-0.85, 2.15, 1.05), 30, [main])
for k, a in enumerate((0.0, 0.25, 0.5, 0.75, 1.0)):
    main.key(fr(f0, f1, a), PZ.RUB_A if k % 2 == 0 else PZ.RUB_B, (-0.85, 2.15), face_dir(0.15, 1))

# ---- 2: pillow under the shirt (flat -> MakeHuman pregnant target version)
t0, t1 = L(2, 0.0, 1.0)
pos2, yaw2 = (0.2, 0.9), face_dir(-1, -0.3)
cb = Vector(pos2) + Vector((math.sin(yaw2), -math.cos(yaw2))) * 0.0
f0, f1 = shot("02_cu_shoving_pillow", t0, t1, (pos2[0] - 1.05, pos2[1] - 0.55, 1.18), (pos2[0], pos2[1], 1.0), 30, [main, preg], push=0.06)
both(f0, PZ.SHOVE, pos2, yaw2)
both(fr(f0, f1, 0.45), PZ.SHOVE_IN, pos2, yaw2)
both(fr(f0, f1, 0.7), PZ.RUB_A, pos2, yaw2)
both(f1, PZ.RUB_B, pos2, yaw2)
fs = fr(f0, f1, 0.5)
EXTRA_VIS.append((fs, True))
fwd2 = Vector((math.sin(yaw2), -math.cos(yaw2), 0))
key_visible(PROP_MESHES["pillow"], f0, True)
PILLOW.rotation_euler = Euler((math.radians(85), 0, yaw2))
key_obj(PILLOW, f0, loc=Vector((pos2[0], pos2[1], 1.02)) + fwd2 * 0.42, rot=PILLOW.rotation_euler.copy())
key_obj(PILLOW, fr(f0, f1, 0.42), loc=Vector((pos2[0], pos2[1], 1.0)) + fwd2 * 0.22)
key_obj(PILLOW, fs, loc=Vector((pos2[0], pos2[1], 1.0)) + fwd2 * 0.12)
key_visible(PROP_MESHES["pillow"], fs + 1, False)

# ---- 3: it falls out when he walks
t0, t1 = L(3, 0.0, 1.0)
f0, f1 = shot("03_wide_walk_pillow_drops", t0, t1, (-0.2, LY0 + 0.25, 1.3), (-0.2, -0.85, 0.9), 20, [main, preg])
EXTRA_VIS.append((f0, True))
p_start, p_end = (-2.3, -0.9), (1.6, -0.9)
main.walk(f0, f1, p_start, p_end); preg.walk(f0, f1, p_start, p_end)
fd = fr(f0, f1, 0.55)
EXTRA_VIS.append((fd, False))
yaw3 = face_dir(1, 0)
pd = Vector(p_start).lerp(Vector(p_end), 0.55)
key_visible(PROP_MESHES["pillow"], fd, True)
key_obj(PILLOW, fd, loc=Vector((pd.x + 0.22, pd.y, 0.85)), rot=Euler((math.radians(80), 0, yaw3)))
key_obj(PILLOW, fr(f0, f1, 0.7), loc=Vector((pd.x + 0.3, pd.y, 0.07)), rot=Euler((math.radians(10), 0.2, yaw3 + 0.4)))
key_obj(PILLOW, f1, loc=Vector((pd.x + 0.3, pd.y, 0.07)), rot=Euler((math.radians(10), 0.2, yaw3 + 0.4)))
key_visible(PROP_MESHES["pillow"], f1 + 1, False)

# ---- 4: clinic, the doctor laughs in his face
t0, t1 = L(4, 0.0, 0.45)
f0, f1 = shot("04a_wide_clinic", t0, t1, (CX + 0.2, CY0 + 0.45, 1.55), (CX - 0.2, 1.2, 0.95), 20, [preg, doc])
sit_key(preg, f0, EXAM, PZ.SIT, extra=0.1, back=0.0)
sit_key(preg, f1, EXAM, dict(PZ.SIT, **PZ.HANDS_BELLY), extra=0.1, back=0.0)
for k, a in enumerate((0.0, 0.3, 0.6, 1.0)):
    sit_key(doc, fr(f0, f1, a), DOCCHAIR, PZ.LAUGH_POINT if k % 2 else PZ.LAUGH_POINT_B)
t0, t1 = L(4, 0.45, 1.0)
dcp = seat_point(DOCCHAIR, 0.6)
f0, f1 = shot("04b_med_doctor_laughing", t0, t1, (dcp.x + 1.15, dcp.y - 0.75, 1.15), (dcp.x, dcp.y, 1.05), 28, [doc, preg])
for k, a in enumerate((0.0, 0.2, 0.4, 0.6, 0.8, 1.0)):
    sit_key(doc, fr(f0, f1, a), DOCCHAIR, PZ.LAUGH_POINT if k % 2 else PZ.LAUGH_POINT_B)
sit_key(preg, f0, EXAM, dict(PZ.SIT, **PZ.HANDS_BELLY), extra=0.1, back=0.0)
sit_key(preg, f1, EXAM, dict(PZ.SIT, **PZ.HANDS_BELLY), extra=0.1, back=0.0)

# ---- 5: watermelon + belt, Genius!
g = word_time(5, "Genius")
cut5 = (g - 0.1 - LINES[5]["start"]) / (LINES[5]["end"] - LINES[5]["start"]) if g else 0.75
t0, t1 = L(5, 0.0, cut5)
pos5, yaw5 = (0.4, 1.0), face_dir(-1, -0.4)
f0, f1 = shot("05a_cu_belt_buckles_melon", t0, t1, (pos5[0] - 0.75, pos5[1] - 0.45, 1.08), (pos5[0], pos5[1], 0.98), 30, [main], push=0.07)
key_visible(PROP_MESHES["melon"] + PROP_MESHES["belt"], f0, True)
main.key(f0, PZ.BUCKLE, pos5, yaw5)
main.key(fr(f0, f1, 0.5), dict(PZ.BUCKLE, **{"Head": ("rot", (32, 0, 6))}), pos5, yaw5)
main.key(f1, PZ.BUCKLE, pos5, yaw5)
key_obj(belt_src, f0, loc=BELT_L + Vector((0, 0.0, -0.06)))
key_obj(belt_src, fr(f0, f1, 0.55), loc=BELT_L)
t0, t1 = L(5, cut5, 1.0)
f0, f1 = shot("05b_low_genius", t0, t1, (pos5[0] + 0.55, pos5[1] - 1.55, 0.55), (pos5[0], pos5[1] - 0.2, 1.35), 22, [main])
yaw5b = face_dir(0.3, 1)
main.key(f0, PZ.STAND, pos5, yaw5b)
main.key(fr(f0, f1, 0.25), PZ.FIST, pos5, yaw5b)
main.key(fr(f0, f1, 0.5), PZ.FIST_DOWN, pos5, yaw5b)
main.key(fr(f0, f1, 0.75), PZ.FIST, pos5, yaw5b)
main.key(f1, PZ.FIST, pos5, yaw5b)

# ---- 6: he walks proudly, the melon bounces
t0, t1 = L(6, 0.0, 0.55)
f0, f1 = shot("06a_side_walks_proudly", t0, t1, (0.2, LY0 + 0.25, 1.25), (0.2, -0.75, 0.95), 20, [main])
main.walk(f0, f1 + 2, (2.3, -0.85), (-0.4, -0.85), cycle=PZ.PROUD_WALK)
for k in range(9):
    melon_pose(fr(f0, f1, k / 8), dz=0.025 if k % 2 else -0.02)
t0, t1 = L(6, 0.55, 1.0)
f0, f1 = shot("06b_cu_melon_bounce", t0, t1, (-1.2, -2.55, 1.0), (-1.2, -0.85, 0.95), 30, [main], push=0.0)
main.walk(f0, f1, (-0.4, -0.85), (-1.9, -0.85), cycle=PZ.PROUD_WALK)
for k in range(9):
    melon_pose(fr(f0, f1, k / 8), dz=0.03 if k % 2 else -0.025)

# ---- 7: sits on the sofa, the melon slips under him and bursts
t0, t1 = L(7, 0.0, 0.5)
f0, f1 = shot("07a_wide_sits_on_sofa", t0, t1, (-0.2, -1.6, 1.3), (LX0 + 0.6, 0.4, 0.75), 22, [main])
sp = seat_point(SOFA)
stand_p = sp + Vector((0.42, 0, 0))
main.key(f0, PZ.STAND, (stand_p.x, stand_p.y), face_dir(1, 0))
main.key(fr(f0, f1, 0.45), PZ.SIT_MID, (0, 0), face_dir(1, 0), hips=seat_point(SOFA, 0.32, back=-0.15))
sit_key(main, f1, SOFA, PZ.SIT_BACK)
melon_pose(f0); melon_pose(fr(f0, f1, 0.45), dz=-0.06, dy=-0.22)
melon_pose(f1, dz=0.05, dy=-0.42)
fb = F(t1)
key_visible(PROP_MESHES["melon"] + PROP_MESHES["belt"], fb, False)
burst.location = seat_point(SOFA, 0.05, back=0.0) + Vector((0.12, 0, 0))
floor_col.location = (burst.location.x, burst.location.y, seat_point(SOFA)[2] - 0.0); floor_col.scale = (2.5, 2.5, 1)
ps = burst.modifiers.new("Burst", "PARTICLE_SYSTEM").particle_system
st = ps.settings
st.count = 220; st.frame_start = fb; st.frame_end = fb + 2; st.lifetime = 400
st.normal_factor = 3.0; st.factor_random = 1.4; st.effector_weights.gravity = 1.0
st.render_type = "COLLECTION"; st.instance_collection = chunk_coll; st.particle_size = 1.0; st.size_random = 0.5
st.use_rotations = True; st.rotation_mode = "NOR"; st.phase_factor_random = 2.0; st.use_dynamic_rotation = True
key_visible([burst], 1, False); key_visible([burst], fb, True)
t0, t1 = L(7, 0.5, 1.0)
f0, f1 = shot("07b_low_melon_bursts", t0, t1, (sp.x + 1.2, sp.y - 0.85, 0.55), (sp.x + 0.15, sp.y, 0.55), 22, [main], push=0.0)
sit_key(main, f0, SOFA, PZ.SIT_BACK); sit_key(main, f0 + 4, SOFA, PZ.SURPRISED if False else dict(PZ.SIT, **{"Spine": ("rot", (-10, 0, 0)), "Head": ("rot", (-14, 0, 0)), "LeftArm": ("aim", (0.7, -0.4, 0.3)), "RightArm": ("aim", (-0.7, -0.4, 0.3)), "LeftForeArm": ("aim", (0.2, -0.4, 1)), "RightForeArm": ("aim", (-0.2, -0.4, 1))}))
sit_key(main, f1, SOFA, dict(PZ.SIT, **{"Spine": ("rot", (-10, 0, 0)), "Head": ("rot", (6, 0, 0)), "LeftArm": ("aim", (0.6, -0.4, 0.1)), "RightArm": ("aim", (-0.6, -0.4, 0.1))}))

# ---- 8: silicone belly strapped on, soft wobble
t0, t1 = L(8, 0.0, 1.0)
pos8, yaw8 = (0.3, 1.1), face_dir(-1, -0.5)
f0, f1 = shot("08_cu_silicone_belly", t0, t1, (pos8[0] - 0.8, pos8[1] - 0.6, 1.12), (pos8[0], pos8[1], 1.0), 30, [main], push=0.06)
key_visible(PROP_MESHES["belly"], f0, True)
main.key(f0, PZ.BUCKLE, pos8, yaw8)
main.key(fr(f0, f1, 0.4), PZ.RUB_A, pos8, yaw8)
main.key(fr(f0, f1, 0.7), PZ.RUB_B, pos8, yaw8)
main.key(f1, PZ.RUB_A, pos8, yaw8)
key_obj(belly, f0, loc=BELLY_L + Vector((0, -0.12, 0.0)), scale=BELLY_S)
key_obj(belly, fr(f0, f1, 0.25), loc=BELLY_L, scale=BELLY_S)
for k in range(1, 9):
    s_ = 1 + (0.07 if k % 2 else -0.06) * (1 - k / 10)
    key_obj(belly, fr(f0, f1, 0.25 + 0.75 * k / 8), scale=Vector((BELLY_S.x * (2 - s_), BELLY_S.y * s_, BELLY_S.z * (2 - s_))))

# ---- 9: next walk, it slides down to his knees (low angle)
t0, t1 = L(9, 0.0, 1.0)
f0, f1 = shot("09_low_belly_slides_down", t0, t1, (0.6, LY0 + 0.6, 0.3), (0.2, -0.85, 0.75), 18, [main], push=0.0)
key_visible(PROP_MESHES["belly"], f0, False); key_visible(PROP_MESHES["slide"], f0, True)
main.walk(f0, f1, (-2.0, -0.85), (1.8, -0.85))
key_obj(belly_slide, f0, loc=BELLY_SLIDE_TOP)
key_obj(belly_slide, fr(f0, f1, 0.25), loc=BELLY_SLIDE_TOP)
knee = main.rig.data.bones["mixamorig:LeftLeg"].head_local
key_obj(belly_slide, fr(f0, f1, 0.7), loc=Vector((0, BELLY_SLIDE_TOP.y + 0.04, knee.z + 0.05)))
key_obj(belly_slide, f1, loc=Vector((0, BELLY_SLIDE_TOP.y + 0.04, knee.z + 0.03)))
key_visible(PROP_MESHES["slide"], f1 + 1, False)

# ---- 10: shoulder straps click on
t0, t1 = L(10, 0.0, 1.0)
pos10, yaw10 = (0.2, 1.2), face_dir(-1, -0.35)
f0, f1 = shot("10_cu_straps_click_on", t0, t1, (pos10[0] - 0.75, pos10[1] - 0.45, 1.62), (pos10[0], pos10[1], 1.38), 30, [main], push=0.05)
key_visible(PROP_MESHES["belly"] + PROP_MESHES["harness"], f0, True)
main.key(f0, PZ.STRAPS, pos10, yaw10)
main.key(fr(f0, f1, 0.55), PZ.STRAPS, pos10, yaw10)
main.key(f1, PZ.PROUD, pos10, yaw10)
key_obj(harness, f0, loc=HARN_L + Vector((0, 0.22, 0.0)))
key_obj(harness, fr(f0, f1, 0.5), loc=HARN_L + Vector((0, -0.01, 0.0)))
key_obj(harness, fr(f0, f1, 0.58), loc=HARN_L)
key_obj(belly, f0, loc=BELLY_L, scale=BELLY_S)

# ---- 11: the little cousin punches it, nothing kicks back
t0, t1 = L(11, 0.0, 1.0)
pos11, yaw11 = (0.6, 0.9), face_dir(-1, 0)
kpos = (pos11[0] - 0.62, pos11[1])
f0, f1 = shot("11_wide_cousin_punches", t0, t1, (pos11[0] - 0.3, pos11[1] - 2.25, 1.15), (pos11[0] - 0.3, pos11[1], 0.9), 22, [main, kid])
main.key(f0, PZ.PROUD, pos11, yaw11); main.key(f1, PZ.PROUD, pos11, yaw11)
kid.key(f0, PZ.STAND, kpos, face_dir(1, 0))
kid.key(fr(f0, f1, 0.15), PZ.PUNCH_WIND, kpos, face_dir(1, 0))
kid.key(fr(f0, f1, 0.25), PZ.PUNCH, (kpos[0] + 0.08, kpos[1]), face_dir(1, 0))
kid.key(fr(f0, f1, 0.4), PZ.WAIT_LOOK, kpos, face_dir(1, 0))
kid.key(fr(f0, f1, 0.7), PZ.WAIT_LOOK, kpos, face_dir(1, 0))
kid.key(fr(f0, f1, 0.85), PZ.DISAPPOINTED, kpos, face_dir(1, 0))
kid.key(f1, PZ.DISAPPOINTED, kpos, face_dir(1, 0))
key_obj(belly, fr(f0, f1, 0.24), scale=BELLY_S)
key_obj(belly, fr(f0, f1, 0.28), scale=Vector((BELLY_S.x * 1.05, BELLY_S.y * 0.88, BELLY_S.z * 1.04)))
key_obj(belly, fr(f0, f1, 0.36), scale=BELLY_S)

# ---- 12: a motor inside that kicks; the cousin falls backwards
t0, t1 = L(12, 0.0, 0.5)
f0, f1 = shot("12a_cu_motor_dropped_in", t0, t1, (pos11[0] - 0.6, pos11[1] - 0.5, 1.45), (pos11[0] - 0.25, pos11[1], 1.08), 32, [main], push=0.05)
main.key(f0, PZ.PROUD, pos11, yaw11); main.key(f1, PZ.PROUD, pos11, yaw11)
sc.frame_set(f0); bpy.context.view_layer.update()
bc = belly.matrix_world.translation.copy()
key_visible(PROP_MESHES["motor"], f0, True)
key_obj(motor, f0, loc=bc + Vector((0, 0, 0.45)), rot=Euler((0.3, 0.2, 0)))
key_obj(motor, fr(f0, f1, 0.55), loc=bc + Vector((0, 0, 0.12)), rot=Euler((0.6, 0.4, 0.3)))
key_obj(motor, fr(f0, f1, 0.75), loc=bc + Vector((0, 0, -0.02)), rot=Euler((0.7, 0.5, 0.4)))
key_visible(PROP_MESHES["motor"], fr(f0, f1, 0.75), False)
t0, t1 = L(12, 0.5, 1.0)
f0, f1 = shot("12b_wide_belly_kicks_cousin_falls", t0, t1, (pos11[0] - 0.3, pos11[1] - 2.3, 1.1), (pos11[0] - 0.45, pos11[1], 0.8), 22, [main, kid])
main.key(f0, PZ.PROUD, pos11, yaw11); main.key(f1, dict(PZ.PROUD, **{"Head": ("rot", (14, 0, 0))}), pos11, yaw11)
kid.key(f0, PZ.WAIT_LOOK, kpos, face_dir(1, 0))
fk = fr(f0, f1, 0.2)
kid.key(fk, PZ.WAIT_LOOK, kpos, face_dir(1, 0))
kid.key(fr(f0, f1, 0.45), PZ.FALLING, (0, 0), face_dir(1, 0), hips=(kpos[0] - 0.45, kpos[1], 0.5), tilt=-0.9)
kid.key(fr(f0, f1, 0.65), PZ.FALLEN, (0, 0), face_dir(1, 0), hips=(kpos[0] - 0.75, kpos[1], 0.1), tilt=-1.5)
kid.key(f1, PZ.FALLEN, (0, 0), face_dir(1, 0), hips=(kpos[0] - 0.78, kpos[1], 0.1), tilt=-1.5)
key_obj(belly, fk - 2, scale=BELLY_S)
key_obj(belly, fk + 2, scale=Vector((BELLY_S.x * 0.92, BELLY_S.y * 1.45, BELLY_S.z * 0.95)))
key_obj(belly, fk + 7, scale=BELLY_S)
key_obj(belly, fk + 12, scale=Vector((BELLY_S.x * 0.96, BELLY_S.y * 1.2, BELLY_S.z * 0.97)))
key_obj(belly, fk + 16, scale=BELLY_S)

# ---- 13: final over-the-shoulder: he walks out of the house holding his kicking belly
t0, t1 = L(13, 0.0, 1.0)
dcx = (DOOR[0] + DOOR[1]) / 2
f0, f1 = shot("13_ots_walks_out_front_door", t0, t1, (dcx + 0.35, LY1 - 2.2, 1.65), (dcx, LY1 + 2.5, 1.15), 24, [main], push=0.03)
main.walk(f0, fr(f0, f1, 0.55), (dcx, LY1 - 1.3), (dcx, LY1 + 1.05), cycle=PZ.HOLD_BELLY_WALK)
main.key(fr(f0, f1, 0.62), dict(PZ.PROUD, **PZ.HANDS_BELLY), (dcx, LY1 + 1.1), face_dir(0, 1))
main.key(f1, dict(PZ.PROUD, **PZ.HANDS_BELLY, **{"Head": ("rot", (-12, 0, 0))}), (dcx, LY1 + 1.1), face_dir(0, 1))
for k, a in enumerate((0.15, 0.35, 0.55, 0.75, 0.92)):
    fk_ = fr(f0, f1, a)
    key_obj(belly, fk_ - 2, scale=BELLY_S)
    key_obj(belly, fk_ + 1, scale=Vector((BELLY_S.x * 0.95, BELLY_S.y * 1.25, BELLY_S.z * 0.97)))
    key_obj(belly, fk_ + 5, scale=BELLY_S)

# ---------------------------------------------------------------- visibility per shot, mid-shot swaps, save
for name, f0, f1, vis in SHOTS:
    for a in ACTORS:
        key_visible(a.objs, f0, a in vis)
# main vs pillow-belly version within shots 2-3 and the clinic
for name, f0, f1, vis in SHOTS:
    if name.startswith("02"):
        vis_swap(f0, False)
    if name.startswith("04"):
        vis_swap(f0, True)
    if name.startswith(("05", "06", "07", "08", "09", "10", "11", "12", "13")):
        vis_swap(f0, False)
for f, show in EXTRA_VIS:
    vis_swap(f, show)
for o in bpy.data.objects:
    constant_interp(o)
sc.camera = bpy.data.objects["CAM_01a_ots_baby_poster"]
json.dump([{"name": n, "f0": a, "f1": b} for n, a, b, _ in SHOTS], open(os.path.join(HERE, "build", "shots.json"), "w"), indent=1)
print("SHOTS", len(SHOTS))
for img in bpy.data.images:
    fp = bpy.path.abspath(img.filepath)
    if "/mh/data/" in fp and not fp.startswith(ASSETS):
        img.filepath = os.path.join(ASSETS, "mh", "data", fp.split("/mh/data/", 1)[1])
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True, relative_remap=True)
