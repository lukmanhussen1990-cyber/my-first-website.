"""Cock Coop: build the animated short in Blender (bpy) -> cock_coop.blend

    python scripts/build_scene.py <assets_dir> build/characters.blend build/timing.json cock_coop.blend

Ready-made assets only: MakeHuman/MPFB2 actors, Poly Haven (CC0) grass, crate, hammer, chain-link gate, latch,
furniture, textures and HDRIs, and Sketchfab models (CC-BY, via the Objaverse mirror) for the rooster, the fox,
the coop, the fence, the house, the bed, the rope and the bedroom door. Day, sunset and night are three Poly Haven
HDRIs keyed per shot. Every shot is a fraction of its narration line, so the cut follows the voice.
"""
import json, math, os, random, sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses as PZ          # noqa: E402
from animals import Creature, import_creature, linear_root  # noqa: E402
from scenelib import (F, Actor, box, chair_info, constant_interp, face_dir, flat_material, import_model,  # noqa: E402
                      iter_fcurves, key_obj, key_visible, make_camera, meshes, pbr_material, place, uv_box_project)

ASSETS = os.path.abspath(sys.argv[1]); CHARS, TIMING, OUT = [os.path.abspath(a) for a in sys.argv[2:5]]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(7)
T = json.load(open(TIMING))
LINES = {l["i"]: l for l in T["lines"]}
DUR = T["duration"]
LAST = int(math.floor(DUR * 30))
PI = math.pi
OJ = lambda uid: os.path.join(ASSETS, "objaverse", uid + ".glb")
PH = lambda slug: os.path.join(ASSETS, "polyhaven", slug, f"{slug}_1k.gltf")
TEX = lambda slug: os.path.join(ASSETS, "polyhaven", "tex", slug)
HDRI = lambda slug: os.path.join(ASSETS, "polyhaven", "hdri", f"{slug}_2k.hdr")

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
ANIM = bpy.data.collections.new("ANIMALS"); sc.collection.children.link(ANIM)
CAMS = bpy.data.collections.new("CAMERAS"); sc.collection.children.link(CAMS)
SRC = bpy.data.collections.new("SOURCES"); sc.collection.children.link(SRC)

# ---------------------------------------------------------------- world: day / sunset / night HDRIs mixed per shot
world = bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
tco = wn.new("ShaderNodeTexCoord")


def env(slug, rotz, tint):
    """HDRI rotated so its sun/moon sits where the sun lamp shines from, multiplied by a colour grade."""
    mp = wn.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0, math.radians(rotz))
    wl.new(tco.outputs["Generated"], mp.inputs["Vector"])
    e = wn.new("ShaderNodeTexEnvironment"); e.image = bpy.data.images.load(HDRI(slug))
    wl.new(mp.outputs["Vector"], e.inputs["Vector"])
    t = wn.new("ShaderNodeMix"); t.data_type = "RGBA"; t.blend_type = "MULTIPLY"; t.inputs[0].default_value = 1.0
    wl.new(e.outputs["Color"], t.inputs[6]); t.inputs[7].default_value = (*tint, 1.0)
    return t.outputs[2]


# the three HDRIs keep their sun/moon at azimuth ~-35 deg; rotate each to match the sun lamp of its mood
o_day = env("kloofendal_48d_partly_cloudy_puresky", 86, (1.0, 1.0, 1.0))
o_sunset = env("belfast_sunset_puresky", -91, (1.0, 0.74, 0.52))
o_night = env("qwantani_moon_noon_puresky", -146, (0.42, 0.58, 1.0))
mix1 = wn.new("ShaderNodeMix"); mix1.data_type = "RGBA"
mix2 = wn.new("ShaderNodeMix"); mix2.data_type = "RGBA"
wl.new(o_day, mix1.inputs[6]); wl.new(o_sunset, mix1.inputs[7])
wl.new(mix1.outputs[2], mix2.inputs[6]); wl.new(o_night, mix2.inputs[7])
wl.new(mix2.outputs[2], wn["Background"].inputs["Color"])
BG = wn["Background"].inputs["Strength"]

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); SET.objects.link(sun)
sun.data.angle = math.radians(3)
porch = bpy.data.objects.new("PorchLight", bpy.data.lights.new("PorchLight", "POINT")); SET.objects.link(porch)
porch.data.color = (1.0, 0.7, 0.42); porch.data.shadow_soft_size = 0.08; porch.data.use_shadow = False

MOODS = {   # hdri mix (sunset, night), hdri strength, sun energy / colour / rotation (deg), porch light W
    "day":     dict(m1=0.0, m2=0.0, bg=1.0, sun=3.2, col=(1.0, 0.96, 0.9), rot=(40, 0, -30), porch=0),
    "sunset":  dict(m1=1.0, m2=0.0, bg=0.6, sun=3.2, col=(1.0, 0.52, 0.22), rot=(80, 0, 143), porch=80),
    "night":   dict(m1=1.0, m2=1.0, bg=0.22, sun=0.75, col=(0.38, 0.52, 1.0), rot=(50, 0, -160), porch=700),
    "inside":  dict(m1=1.0, m2=1.0, bg=0.25, sun=0.2, col=(0.38, 0.52, 1.0), rot=(50, 0, -160), porch=0),
}


def mood(f, name):
    m = MOODS[name]
    mix1.inputs[0].default_value = m["m1"]; mix1.inputs[0].keyframe_insert("default_value", frame=f)
    mix2.inputs[0].default_value = m["m2"]; mix2.inputs[0].keyframe_insert("default_value", frame=f)
    BG.default_value = m["bg"]; BG.keyframe_insert("default_value", frame=f)
    sun.data.energy = m["sun"]; sun.data.keyframe_insert("energy", frame=f)
    sun.data.color = m["col"]; sun.data.keyframe_insert("color", frame=f)
    sun.rotation_euler = [math.radians(a) for a in m["rot"]]; sun.keyframe_insert("rotation_euler", frame=f)
    porch.data.energy = m["porch"]; porch.data.keyframe_insert("energy", frame=f)


def all_constant(idblock):
    ad = getattr(idblock, "animation_data", None)
    if ad and ad.action:
        for fc in iter_fcurves(ad.action):
            for k in fc.keyframe_points:
                k.interpolation = "CONSTANT"


def model(path, name, size, axis="z", x=0.0, y=0.0, z=0.0, face=0.0, coll=SET, chair=False):
    r = import_model(path, name, size, axis, coll)
    if chair:
        chair_info(r)
    place(r, x, y, z, face)
    return r


def dup(root, name, x, y, z=0.0, face=0.0, scale=1.0, coll=SET):
    """Linked copy of an imported model hierarchy (shares mesh data)."""
    r = bpy.data.objects.new(name, None); coll.objects.link(r)
    r.scale = root.scale * scale
    if "front_yaw" in root:
        r["front_yaw"] = root["front_yaw"]

    def rec(src, dst):
        for o in src.children:
            c = o.copy(); coll.objects.link(c); c.parent = dst; c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
            rec(o, c)
    rec(root, r)
    place(r, x, y, z, face)
    return r


H = 2.7


def room(cx, cy, w, d, floor_tex, wall_tex, name, wall_tint=(1, 1, 1), panel=60):
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    fm = pbr_material(name + "Floor", TEX(floor_tex), 1.0)
    wm = pbr_material(name + "Wall", TEX(wall_tex), 1.0, tint=wall_tint)
    cm = flat_material(name + "Ceil", (0.9, 0.9, 0.88), 0.9, emission=((1.0, 0.95, 0.85), 0.12))
    f = box(name + "Floor", (w, d, 0.02), (cx, cy, -0.01), fm, SET); uv_box_project(f, 1.5)
    c = box(name + "Ceiling", (w, d, 0.04), (cx, cy, H + 0.02), cm, SET); uv_box_project(c, 1.2); c.visible_shadow = False
    walls = [box(name + "WallFront", (w, 0.1, H), (cx, y0 - 0.05, H / 2), wm, SET),
             box(name + "WallL", (0.1, d, H), (x0 - 0.05, cy, H / 2), wm, SET),
             box(name + "WallR", (0.1, d, H), (x1 + 0.05, cy, H / 2), wm, SET),
             box(name + "WallBack", (w, 0.1, H), (cx, y1 + 0.05, H / 2), wm, SET)]
    for wl_ in walls:
        uv_box_project(wl_, 2.0); wl_.visible_shadow = False
    l = bpy.data.objects.new(f"{name}Ceiling", bpy.data.lights.new(f"{name}Ceiling", "AREA")); SET.objects.link(l)
    l.data.shape = "RECTANGLE"; l.data.size = 1.6; l.data.size_y = 1.0; l.data.energy = panel
    l.data.color = (1.0, 0.86, 0.68); l.data.use_shadow = False; l.location = (cx, cy, H - 0.05)
    return x0, x1, y0, y1


def lamp_light(name, loc, watts, color=(1.0, 0.72, 0.45)):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, "POINT")); SET.objects.link(l)
    l.data.energy = watts; l.data.color = color; l.data.shadow_soft_size = 0.12; l.data.use_shadow = False
    l.location = loc
    return l


# ---------------------------------------------------------------- backyard (origin): grass, house, fence, dressing
grass_m = pbr_material("Lawn", TEX("leafy_grass"), 1.0, tint=(0.55, 0.92, 0.5))
ground = box("Lawn", (70, 70, 0.02), (0, 0, -0.01), grass_m, SET); uv_box_project(ground, 1.6)
HX, HY = -1.0, -11.0
HOUSE = model(OJ("db5d2cc306e84411945b2528dec37cd4"), "House", 7.9, "z", HX, HY)
HB = HY + HOUSE["size"][1] / 2          # back wall of the house (faces the yard)
FY, FX = 6.2, 6.8                       # back fence line, side fences at +-FX
FENCE_LIFT = 0.2                        # gap under the boards (the rooster squeezes under it)
fence0 = model(OJ("43f8b3127fba4800bfc3f36078393e87"), "Fence0", 1.65, "z", 0.0, FY, FENCE_LIFT, face=PI / 2)
FL = fence0["size"][1]
fence0.location.x = -1.5 * FL
for i, k in enumerate((-0.5, 0.5, 1.5)):
    dup(fence0, f"FenceB{i}", k * FL, FY, FENCE_LIFT, face=PI / 2)
side_c = (HB + FY) / 2
for s_ in (-1, 1):
    for j in range(4):
        dup(fence0, f"FenceS{s_}{j}", s_ * FX, side_c + (j - 1.5) * FL, FENCE_LIFT, face=0.0)
wall_lamp = model(PH("industrial_wall_lamp"), "PorchLamp", 0.42, "z", HX + 1.6, HB + 0.02, 2.05, face=PI)
porch.location = (HX + 1.6, HB + 0.32, 2.2)
model(PH("wooden_picnic_table"), "PicnicTable", 0.75, "z", -5.0, 3.6, face=PI / 2 - 0.2)
for i, (x, y, fc) in enumerate([(-7.5, 17.0, PI), (7.0, 16.5, PI), (-17.5, -2.0, -PI / 2), (17.5, 0.5, PI / 2)]):
    dup(HOUSE, f"Neighbour{i}", x, y, 0.0, face=fc)          # neighbours' houses over the fence
model(PH("planter_box_01"), "Planter0", 0.42, "z", -6.15, 1.0, face=PI / 2)
model(PH("planter_box_01"), "Planter1", 0.42, "z", -6.15, 3.0, face=PI / 2)
SHRUB = model(PH("shrub_02"), "ShrubBig", 1.6, "z", -5.4, 5.3)
for i, (x, y, sc_) in enumerate([(-2.5, 7.6, 1.3), (3.0, 8.0, 1.5), (8.4, 4.0, 1.4), (-8.6, 1.0, 1.3), (8.3, -3.5, 1.2)]):
    dup(SHRUB, f"ShrubOut{i}", x, y, 0.0, face=random.uniform(0, 6.28), scale=sc_)
model(PH("shrub_04"), "ShrubA", 0.6, "z", 6.0, -1.5, face=PI / 2)
model(PH("shrub_04"), "ShrubB", 0.55, "z", -2.8, 5.7)
model(PH("wooden_bucket_01"), "Bucket", 0.32, "z", 5.6, 1.2)
# grass clumps: linked copies of Poly Haven grass pieces along the fences and over the lawn
grass_src = import_model(PH("grass_medium_01"), "GrassSrc", 1.0, "max", SRC)
grass_src.scale = (1, 1, 1)
bpy.context.view_layer.update()
pieces = []
for o in meshes(grass_src):            # bake each tuft to its own bottom-centred mesh (real size, metres)
    if any(k in o.name for k in ("large", "mid")):
        me = o.data.copy()
        me.transform(o.matrix_world)
        vs = [v.co for v in me.vertices]
        c_ = Vector((sum(v.x for v in vs) / len(vs), sum(v.y for v in vs) / len(vs), min(v.z for v in vs)))
        me.transform(Matrix.Translation(-c_))
        pieces.append(me)
    bpy.data.objects.remove(o)
bpy.data.objects.remove(grass_src)
gi = 0


def clump(x, y, s):
    global gi
    c = bpy.data.objects.new(f"Grass{gi}", random.choice(pieces)); SET.objects.link(c)
    c.matrix_world = (Matrix.Translation((x, y, 0)) @ Matrix.Rotation(random.uniform(0, 2 * PI), 4, "Z")
                      @ Matrix.Diagonal((s, s, s * random.uniform(0.9, 1.5), 1)))
    c.visible_shadow = False
    gi += 1


for k in range(80):                        # along the fences (hide the gap under the boards)
    t = random.uniform(-FX, FX); clump(t, FY - random.uniform(0.0, 0.25), random.uniform(1.7, 2.5))
for s_ in (-1, 1):
    for k in range(45):
        clump(s_ * (FX - random.uniform(0.0, 0.25)), random.uniform(HB, FY), random.uniform(1.7, 2.5))
for k in range(110):                       # scattered tufts on the lawn
    clump(random.uniform(-FX + 0.5, FX - 0.5), random.uniform(HB + 1.0, FY - 0.5), random.uniform(1.0, 1.7))
print("grass clumps", gi)
for o in SET.all_objects:
    if o.type == "MESH" and o.name.split("__")[0].startswith(("Shrub", "Planter", "Bucket", "PorchLamp")):
        o.visible_shadow = False

# ---------------------------------------------------------------- coop (revealed in line 9) with a hinged chain-link door + latch
CP = Vector((3.2, 3.3))
COOP = model(OJ("360923e446994fe8a3db68e016cc57b1"), "Coop", 2.3, "z", CP.x, CP.y, coll=PROPS)
bpy.context.view_layer.update()
inv = COOP.matrix_world.inverted()
door_pts = []
for o in meshes(COOP):                     # remove the cloth curtain over the door opening -> open doorway
    M = inv @ o.matrix_world
    S = Matrix.Diagonal(COOP.scale.to_4d())
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = []
    for v in bm.verts:
        p = S @ (M @ v.co)
        if o.data.materials and "Cloth" in o.data.materials[0].name and p.y < -0.4 and p.z > 0.45:
            kill.append(v); door_pts.append(p.copy())
    if kill:
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.to_mesh(o.data)
    bm.free()
DX0 = min(p.x for p in door_pts); DX1 = max(p.x for p in door_pts)
DZ0 = min(p.z for p in door_pts); DZ1 = max(p.z for p in door_pts)
DWY = min(p.y for p in door_pts) - 0.025            # front face of the wall (local, coop faces -Y)
DOORC = Vector((CP.x + (DX0 + DX1) / 2, CP.y + DWY, (DZ0 + DZ1) / 2))
RAMP_FOOT = Vector((DOORC.x, CP.y + COOP["size"][1] * 0 - 1.27, 0.0))
print("coop door x", round(DX0, 3), round(DX1, 3), "z", round(DZ0, 3), round(DZ1, 3), "wall y", round(DWY, 3))
chain_src = import_model(PH("modular_chainlink_fence"), "ChainSrc", 1.0, "max", SRC)
gate = next(o for o in meshes(chain_src) if o.name.split("__")[1].startswith("modular_chainlink_fence_door_gate"))
gate_mesh = gate.copy(); gate_mesh.data = gate.data.copy(); PROPS.objects.link(gate_mesh); gate_mesh.parent = None
gate_mesh.hide_render = False
gate_mesh.matrix_world = gate.matrix_world.copy()
for o in meshes(chain_src):
    bpy.data.objects.remove(o)
bpy.data.objects.remove(chain_src)
bpy.context.view_layer.update()
gw = [gate_mesh.matrix_world @ Vector(c) for c in gate_mesh.bound_box]
gmn = Vector([min(p[i] for p in gw) for i in range(3)]); gmx = Vector([max(p[i] for p in gw) for i in range(3)])
DOOR_W, DOOR_H = (DX1 - DX0) + 0.06, (DZ1 - DZ0) + 0.06
hinge = bpy.data.objects.new("MeshDoorHinge", None); PROPS.objects.link(hinge)
hinge.location = (CP.x + DX0 - 0.03, CP.y + DWY - 0.03, DZ0 - 0.03)
hinge.rotation_mode = "XYZ"
bpy.context.view_layer.update()
sx, sz = DOOR_W / (gmx.x - gmn.x), DOOR_H / (gmx.z - gmn.z)
gate_mesh.parent = hinge
gate_mesh.matrix_world = (Matrix.Translation(hinge.location) @ Matrix.Diagonal((sx, 1.0, sz, 1)) @ Matrix.Translation(-gmn)
                          @ gate_mesh.matrix_world)
for c in list(gate_mesh.users_collection):
    if c != PROPS:
        c.objects.unlink(gate_mesh)
LATCH = model(PH("gate_latch_01"), "Latch", 0.3, "x", CP.x + DX1 + 0.12, CP.y + DWY - 0.005, (DZ0 + DZ1) / 2 - 0.02,
              face=PI, coll=PROPS)
latch_bar = next(o for o in meshes(LATCH) if o.name.split("__")[1].startswith("gate_latch_01_latch"))
latch_bar.rotation_mode = "XYZ"
LATCH_BAR_R = latch_bar.rotation_euler.copy()

# ---------------------------------------------------------------- crate on its side (lines 6-8)
CR = Vector((-1.5, 1.7))
crate_src = import_model(PH("wooden_crate_01"), "Crate", 1.32, "x", PROPS)
for o in meshes(crate_src):
    if o.name.split("__")[1] != "wooden_crate_01":
        bpy.data.objects.remove(o)
crate_rig = bpy.data.objects.new("CrateRig", None); PROPS.objects.link(crate_rig)
crate_rig.location = (CR.x, CR.y, 0)
CRATE_D = crate_src["size"][2]; CRATE_H = crate_src["size"][1]
crate_src.parent = crate_rig
crate_src.location = (0, CRATE_D / 2, CRATE_H / 2)
crate_src.rotation_euler = (PI / 2, 0, 0)
CRATE_TOP = CRATE_H
CRATE_FLOOR = 0.035

# ---------------------------------------------------------------- bedroom (x = +30) and living room (x = +60)
BX = 60.0
RX0, RX1, RY0, RY1 = room(BX, 0.0, 4.8, 4.6, "wood_floor", "beige_wall_001", "Bed", (1.02, 1.0, 0.98), panel=45)
BED = model(OJ("16070c2e6faa405391ab7ada8bb0aed6"), "Bed", 2.15, "y", BX + 0.3, RY1 - 1.1)
BED_W = BED["size"][0]
BED_TOP = 0.40
model(PH("painted_wooden_nightstand"), "Nightstand", 0.55, "z", BX + 0.3 - BED_W / 2 - 0.35, RY1 - 0.35)
model(PH("desk_lamp_arm_01"), "BedLamp", 0.5, "z", BX + 0.3 - BED_W / 2 - 0.35, RY1 - 0.3, 0.55, face=0.4)
lamp_light("BedLampLight", (BX + 0.3 - BED_W / 2 - 0.3, RY1 - 0.45, 1.0), 70)
model(OJ("b1a2328c3af342adae6da2acc45ee3fb"), "BedroomDoor", 2.1, "z", RX0 + 0.75, RY0 + 0.06, face=PI)
model(PH("potted_plant_02"), "BedPlant", 0.9, "z", RX1 - 0.4, RY0 + 0.45)
LX = 90.0
LX0, LX1, LY0, LY1 = room(LX, 0.0, 5.0, 4.4, "wood_floor", "beige_wall_001", "Living", (1.04, 1.02, 0.98), panel=40)
SOFA = model(PH("sofa_03"), "Sofa", 1.0, "z", LX, LY1 - 0.48, face=0.0, chair=True)
model(PH("modern_coffee_table_01"), "CoffeeTable", 0.39, "z", LX + 1.6, 0.7)
model(PH("potted_plant_01"), "LivingPlant", 1.35, "z", LX1 - 0.45, LY1 - 0.45)
model(PH("side_table_01"), "SideTable", 0.55, "z", LX - 1.55, LY1 - 0.4)
model(PH("desk_lamp_arm_01"), "SofaLamp", 0.5, "z", LX - 1.55, LY1 - 0.4, 0.55, face=-0.4)
lamp_light("SofaLampLight", (LX - 1.5, LY1 - 0.55, 1.0), 60)
for o in SET.all_objects:
    if o.type == "MESH" and o.name.split("__")[0].startswith(("BedPlant", "LivingPlant", "BedLamp", "SofaLamp", "Nightstand")):
        o.visible_shadow = False
SEAT = SOFA["seat_z"]
print("sofa seat", round(SEAT, 3))

# ---------------------------------------------------------------- characters
with bpy.data.libraries.load(CHARS, link=False) as (src_l, dst):
    dst.collections = [c for c in src_l.collections if c in ("CHR_main", "CHR_main_night", "CHR_wife", "CHR_cousin")]
for c in dst.collections:
    sc.collection.children.link(c)
    for o in c.objects:
        if o.type == "MESH" and o.data.shape_keys:
            with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
                bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
main, mainN, wife, kid = Actor("main"), Actor("main_night"), Actor("wife"), Actor("cousin")
ACTORS = [main, mainN, wife, kid]


def attach(obj, actor, bone, world_pos, rot=Euler()):
    """Bone-parent obj to actor's bone so that (in the rig's rest pose) it sits at world_pos (rig space)."""
    rig = actor.rig
    obj.parent = rig; obj.parent_type = "BONE"; obj.parent_bone = "mixamorig:" + bone
    for p in rig.pose.bones:
        p.rotation_quaternion = (1, 0, 0, 0)
    bpy.context.view_layer.update()
    obj.matrix_world = rig.matrix_world @ Matrix.Translation(world_pos) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal(obj.scale.to_4d())
    return obj


HAMMER = import_model(PH("wooden_hammer_01"), "Hammer", 0.32, "z", PROPS)
hb = main.rig.data.bones["mixamorig:RightHand"]
grip = hb.head_local.lerp(hb.tail_local, 0.5)
attach(HAMMER, main, "RightHand", grip + Vector((0, 0.1, 0)), Euler((PI / 2, 0, 0)))
for i, a in enumerate(ACTORS):
    a.key(1, PZ.STAND, (12.0 + 0.8 * i, -14.0), 0.0)
    key_visible(a.objs, 1, False)

# ---------------------------------------------------------------- rooster and fox (rigged Sketchfab models)
rr, ra = import_creature(OJ("f0acb761248b489689ef87c726d43959"), "Rooster", 0.52, "z", ANIM, 0.0)
rr.scale = (rr.scale.x * 1.38, rr.scale.y * 1.08, rr.scale.z * 1.02)      # big and fat
ROO = Creature(rr, ra, 0.0)
fr_, fa = import_creature(OJ("b8a7c0e7778741568dd3d4ad80a01249"), "Fox", 1.15, "x", ANIM, -PI / 2)
FOX = Creature(fr_, fa, -PI / 2)
for m_ in FOX.meshes:                       # brighten the fox fur a little so it reads at night
    for slot in m_.material_slots:
        if slot.material and slot.material.node_tree:
            b = slot.material.node_tree.nodes.get("Principled BSDF")
            if b:
                b.inputs["Roughness"].default_value = 0.75
P_ = "bip001_"
RN = {"pelvis": P_ + "pelvis_05", "spine1": P_ + "spine1_031", "neck": P_ + "neck_032", "head": P_ + "head_033",
      "lt": P_ + "l_thigh_07", "rt": P_ + "r_thigh_019", "lc": P_ + "l_calf_08", "rc": P_ + "r_calf_020",
      "lh": P_ + "l_horselink_09", "wl": "bone001_047", "wr": "bone0001_045", "tail": "bone003_051"}


def rp(**kw):
    """Rooster pose from short names: rp(lt=(x,y,z), neck=...)"""
    return {RN[k]: v for k, v in kw.items()}


R_STAND = {}
R_WALK = [rp(neck=(6, 0, 0)), rp(lt=(32, 0, 0), rt=(-30, 0, 0), rc=(-25, 0, 0), neck=(-4, 0, 0))]
R_RUN = [rp(pelvis=(12, 0, 0), lt=(-38, 0, 0), rt=(42, 0, 0), neck=(28, 0, 0), wl=(0, -40, 0), wr=(0, 40, 0)),
         rp(pelvis=(12, 0, 0), lt=(42, 0, 0), rt=(-38, 0, 0), lc=(-30, 0, 0), neck=(22, 0, 0), wl=(0, -60, 0), wr=(0, 60, 0))]
R_PECK = rp(pelvis=(18, 0, 0), spine1=(20, 0, 0), neck=(48, 0, 0), head=(28, 0, 0))
R_PECK_UP = rp(pelvis=(8, 0, 0), neck=(-12, 0, 0), head=(-6, 0, 0))
R_FLAP_UP = rp(wl=(0, -105, -25), wr=(0, 105, 25), neck=(-18, 0, 0), tail=(-12, 0, 0))
R_FLAP_DN = rp(wl=(0, -30, -10), wr=(0, 30, 10), neck=(-8, 0, 0))
R_SIT = rp(lt=(-70, 0, 0), rt=(-70, 0, 0), lc=(120, 0, 0), rc=(120, 0, 0))
R_SIT_LOOK_L = dict(R_SIT, **rp(neck=(-6, 0, 35), head=(0, 0, 20)))
R_SIT_LOOK_R = dict(R_SIT, **rp(neck=(-6, 0, -35), head=(0, 0, -20)))
R_SQUEEZE = dict(R_SIT, **rp(neck=(55, 0, 0), head=(20, 0, 0), pelvis=(10, 0, 0)))
R_HELD = rp(lt=(-25, 0, 0), rt=(-20, 0, 0), wl=(0, -10, 0), wr=(0, 10, 0), neck=(-6, 0, 10))
R_TUG = rp(pelvis=(14, 0, 0), neck=(30, 0, 0), wl=(0, -70, -20), wr=(0, 70, 20), lt=(28, 0, 0))
R_LOOK_L = rp(neck=(-4, 0, 35), head=(0, 0, 18))
R_LOOK_R = rp(neck=(-4, 0, -35), head=(0, 0, -18))
SIT_DROP = -0.11                         # sitting lowers the body (legs folded under it)
FN = {"pelvis": "Bip01_Pelvis_01", "neck": "Bip01_Neck_07", "head": "Bip01_Head_022", "la": "Bip01_L_UpperArm_09",
      "ra": "Bip01_R_UpperArm_015", "lt": "Bip01_L_Thigh_033", "rt": "Bip01_R_Thigh_027", "tail": "BN_Tail_01_02"}


def fp(**kw):
    return {FN[k]: v for k, v in kw.items()}


F_TROT = [fp(tail=(-8, 0, 0)), fp(la=(55, 0, 0), ra=(-50, 0, 0), lt=(35, 0, 0), rt=(-40, 0, 0), tail=(-14, 0, 0))]
F_RUN = [fp(la=(-25, 0, 0), ra=(25, 0, 0), lt=(-20, 0, 0), rt=(25, 0, 0), neck=(-12, 0, 0), tail=(-24, 0, 0)),
         fp(la=(70, 0, 0), ra=(-60, 0, 0), lt=(45, 0, 0), rt=(-50, 0, 0), neck=(-6, 0, 0), tail=(-30, 0, 0))]
F_SNEAK = [dict(f, **fp(neck=(28, 0, 0), head=(8, 0, 0))) for f in F_TROT]

# rest the animals out of sight
ROO.key(1, R_STAND, (14.0, -16.0), 0.0)
FOX.key(1, F_TROT[0], (16.0, -16.0), 0.0)
key_visible(FOX.meshes, 1, False)

# ---------------------------------------------------------------- rope: a ready-made straight rope bent along a curve
rope_src = import_model(OJ("6429ddecad104f13b45b17062ccb9ed8"), "RopeSrc", 0.78, "z", PROPS)
bpy.context.view_layer.update()
rbm = bmesh.new()                       # the model's rope is split in two meshes: join them into one straight rope
rope_mat = meshes(rope_src)[0].data.materials[0]
for o in meshes(rope_src):
    me_ = o.data.copy(); me_.transform(o.matrix_world); rbm.from_mesh(me_); bpy.data.meshes.remove(me_)
    bpy.data.objects.remove(o)
bpy.data.objects.remove(rope_src)
rope_me = bpy.data.meshes.new("Rope"); rbm.to_mesh(rope_me); rbm.free()
rope_me.materials.clear(); rope_me.materials.append(rope_mat)
for poly in rope_me.polygons:
    poly.use_smooth = True
    poly.material_index = 0
rope = bpy.data.objects.new("Rope", rope_me); PROPS.objects.link(rope)
vz = [v.co.z for v in rope.data.vertices]
r_len = max(vz) - min(vz)
cx_ = sum(v.co.x for v in rope.data.vertices) / len(rope.data.vertices)
cy_ = sum(v.co.y for v in rope.data.vertices) / len(rope.data.vertices)
for v in rope.data.vertices:
    v.co = Vector((v.co.x - cx_, v.co.y - cy_, v.co.z - min(vz)))
rope_curve_data = bpy.data.curves.new("RopeCurve", "CURVE"); rope_curve_data.dimensions = "3D"
rope_curve = bpy.data.objects.new("RopeCurve", rope_curve_data); PROPS.objects.link(rope_curve)
spl = rope_curve_data.splines.new("BEZIER")
NROPE = 6
spl.bezier_points.add(NROPE - 1)
for bp in spl.bezier_points:
    bp.handle_left_type = bp.handle_right_type = "AUTO"
arr = rope.modifiers.new("Array", "ARRAY"); arr.relative_offset_displace = (0, 0, 1); arr.count = 3
rope_curve_data.use_stretch = True; rope_curve_data.use_deform_bounds = True     # fit the rope exactly to the curve
cm_ = rope.modifiers.new("Curve", "CURVE"); cm_.object = rope_curve; cm_.deform_axis = "POS_Z"
rope_curve.hide_render = True


def rope_shape(f, pts):
    """Key the rope curve through world points pts (len NROPE)."""
    rope_curve.location = pts[0]
    rope.location = pts[0]
    rope_curve.keyframe_insert("location", frame=f); rope.keyframe_insert("location", frame=f)
    length = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    arr.count = max(1, int(round(length / r_len)))
    for bp, p in zip(spl.bezier_points, pts):
        bp.co = p - pts[0]
        bp.keyframe_insert("co", frame=f)


# ---------------------------------------------------------------- staging helpers
SHOTS = []


def L(i, a, b):
    s, e = LINES[i]["start"], LINES[i]["end"]
    return s + (e - s) * a, s + (e - s) * b


def word_time(i, token):
    return next((w["s"] for w in LINES[i]["words"] if w["w"].lower().startswith(token.lower())), None)


def frac(i, t):
    return (t - LINES[i]["start"]) / (LINES[i]["end"] - LINES[i]["start"])


def shot(name, t0, t1, cam_loc, cam_target, lens, cast, md, push=0.03):
    f0, f1 = F(t0), F(t1) - 1
    make_camera("CAM_" + name, f0, f1, cam_loc, cam_target, lens, push, CAMS)
    SHOTS.append((name, f0, f1, cast))
    mood(f0, md)
    return f0, f1


def fr(f0, f1, a):
    return int(round(f0 + (f1 - f0) * a))


def hands_mid(actor, pose, loc, yaw):
    l_ = actor.hand_world(pose, loc, yaw, "Left"); r_ = actor.hand_world(pose, loc, yaw, "Right")
    return (l_ + r_) / 2


def roo_at(f, pose, target, yaw, bone="pelvis", tilt=0.0, scale=None):
    """Key the rooster so that one of its bones (default pelvis) lands on a world point."""
    basis, posed = ROO.solve(pose)
    off = ROO.point(posed, RN[bone], (0, 0, 0), yaw, tilt=tilt)
    ROO.key(f, pose, Vector(target) - off, yaw, tilt=tilt, scale=scale)


def roo_held(f, actor, pose_a, loc, yaw, rpose=R_HELD, up=0.04, fwd=0.05, ryaw=None):
    m = hands_mid(actor, pose_a, loc, yaw)
    fwdv = Vector((math.sin(yaw), -math.cos(yaw), 0))
    roo_at(f, rpose, m + fwdv * fwd + Vector((0, 0, up)), yaw if ryaw is None else ryaw)


def seat_point(ch, dz=0.0, back=0.04):
    fy = ch.rotation_euler.z - ch["front_yaw"]
    fwd = Vector((math.sin(fy), -math.cos(fy), 0))
    p = ch.location + fwd * (0.06 - back)
    return Vector((p.x, p.y, ch.location.z + ch["seat_z"] + dz))


def hinge_key(f, deg):
    hinge.rotation_euler = (0, 0, math.radians(deg)); hinge.keyframe_insert("rotation_euler", frame=f)


def latch_key(f, deg):
    latch_bar.rotation_euler = LATCH_BAR_R.copy()
    latch_bar.rotation_euler.y += math.radians(deg)
    latch_bar.keyframe_insert("rotation_euler", frame=f)


def crate_key(f, sz=1.0, sxy=1.0):
    crate_rig.scale = (sxy, sxy * 1.05, sz); crate_rig.keyframe_insert("scale", frame=f)


crate_key(1)
hinge_key(1, 0)
latch_key(1, -70)
PROPV = {}      # prop name -> shot-name prefixes where it is visible


def show(name, *prefixes):
    PROPV.setdefault(name, []).extend(prefixes)


# ================================================================ SHOTS
# ---- 1: day, he proudly hugs the fat rooster
t0, t1 = L(1, 0.0, 1.0)
p1, y1 = Vector((-0.6, -1.6)), face_dir(0.25, -1)
f0, f1 = shot("01_hug_rooster", t0, t1, (0.35, -3.25, 1.42), (-0.6, -1.6, 1.25), 30, [main, ROO], "day", push=0.07)
for k, a in enumerate((0.0, 0.33, 0.66, 1.0)):
    pz = PZ.HUG if k % 2 == 0 else PZ.HUG_B
    main.key(fr(f0, f1, a), pz, p1, y1)
    roo_held(fr(f0, f1, a), main, pz, p1, y1, R_HELD if k % 2 == 0 else dict(R_HELD, **rp(neck=(-10, 0, -15))), up=-0.07, fwd=0.07)

# ---- 2: night, it runs off across the grass and squeezes under the fence
t0, t1 = L(2, 0.0, 1.0)
f0, f1 = shot("02_night_runs_under_fence", t0, t1, (0.15, 0.4, 0.5), (1.55, 5.6, 0.42), 26, [ROO], "night", push=0.0)
sq0 = fr(f0, f1, 0.68)
ROO.path(f0, sq0, (0.55, 1.5), (1.8, FY - 0.42), R_RUN, step_frames=3)
yaw2 = face_dir(1.8, FY - 0.2)
ROO.key(sq0 + 3, R_SQUEEZE, (1.8, FY - 0.3), face_dir(0, 1), z=SIT_DROP, scale=(1.15, 1.0, 0.72))
ROO.key(fr(f0, f1, 0.86), R_SQUEEZE, (1.82, FY + 0.05), face_dir(0, 1), z=SIT_DROP, scale=(1.2, 1.0, 0.62))
ROO.key(f1, R_RUN[0], (1.85, FY + 0.65), face_dir(0, 1))

# ---- 3: bedroom, tied to the bed with a rope
BEDC = Vector((BX + 0.3 - BED_W / 2 + 0.11, RY1 - 1.1 - 1.075 + 0.1, 0.13))       # into the bed frame's foot corner
RP3, ry3 = Vector((BX - 1.35, -0.55)), face_dir(-0.6, -1)
t0, t1 = L(3, 0.0, 0.48)
f0, f1 = shot("03a_tie_rooster_to_bed", t0, t1, (BX + 0.8, RY0 + 0.45, 1.35), (BX - 1.15, -0.2, 0.5), 24, [mainN, ROO], "inside")
man3 = (RP3.x - 0.55, RP3.y + 0.35)
mainN.key(f0, PZ.PLACE, man3, face_dir(0.8, -0.6))
mainN.key(fr(f0, f1, 0.5), dict(PZ.PLACE, **{"Head": ("rot", (30, 0, 0))}), man3, face_dir(0.8, -0.6))
mainN.key(f1, PZ.PLACE, man3, face_dir(0.8, -0.6))
ROO.key(f0, R_STAND, RP3, ry3)
ROO.key(fr(f0, f1, 0.5), R_LOOK_L, RP3, ry3)
ROO.key(f1, R_STAND, RP3, ry3)
t0, t1 = L(3, 0.48, 1.0)
f0b, f1b = shot("03b_cu_rope_leg_to_bed", t0, t1, (BX - 0.3, -1.95, 0.5), (BX - 1.15, -0.25, 0.15), 22, [ROO], "inside", push=0.05)
for k, a in enumerate((0.0, 0.2, 0.4, 0.6, 0.8, 1.0)):
    ROO.key(fr(f0b, f1b, a), R_TUG if k % 2 else dict(R_TUG, **R_FLAP_DN), RP3 + Vector((0, -0.02 * (k % 2))), ry3)
sc.frame_set(f0b)
basis, posed = ROO.solve(R_STAND)
leg = ROO.point(posed, RN["lh"], (RP3.x, RP3.y, 0), ry3)
mid = BEDC.lerp(leg, 0.5); mid.z = 0.05
pts = [BEDC, BEDC.lerp(mid, 0.5) + Vector((0, 0, -0.03)), mid, mid.lerp(leg, 0.6) + Vector((0, 0, 0.01)),
       leg + Vector((0.02, 0.0, 0.0)), leg + Vector((-0.015, -0.015, 0.005))]
for f in (f0, f0b):
    rope_shape(f, pts)
show("rope", "03a", "03b")

# ---- 4: in bed it pecks his face all night; he swats
LHIP = Vector((BX + 0.3 - BED_W / 4 + 0.05, RY1 - 1.25, BED_TOP + 0.11))
RP4, ry4 = Vector((LHIP.x - 0.42, RY1 - 0.45)), face_dir(1, -0.15)
t0, t1 = L(4, 0.0, 0.56)
f0, f1 = shot("04a_cu_pecks_face", t0, t1, (LHIP.x - 1.05, RY1 - 1.05, 0.95), (LHIP.x - 0.1, RY1 - 0.42, 0.62), 30, [mainN, ROO], "inside", push=0.06)
for k in range(9):
    a = k / 8
    mainN.key(fr(f0, f1, a), dict(PZ.LIE, **{"Head": ("rot", (0, 0, (-14, 10, 22)[k % 3]))}), (0, 0), 0.0, hips=LHIP, tilt=-PI / 2)
    ROO.key(fr(f0, f1, a), R_PECK if k % 2 else R_PECK_UP, (RP4.x, RP4.y, BED_TOP), ry4)
t0, t1 = L(4, 0.56, 1.0)
f0, f1 = shot("04b_top_swats_rooster", t0, t1, (BX + 0.9, RY1 - 2.5, 2.05), (LHIP.x - 0.15, RY1 - 0.7, 0.5), 22, [mainN, ROO], "inside")
for k in range(7):
    a = k / 6
    mainN.key(fr(f0, f1, a), PZ.SWAT_UP if k % 2 else PZ.SWAT_OUT, (0, 0), 0.0, hips=LHIP, tilt=-PI / 2)
    ROO.key(fr(f0, f1, a), (R_FLAP_UP if k % 2 else R_PECK), (RP4.x - 0.04 * (k % 2), RP4.y, BED_TOP + 0.05 * (k % 2)), ry4)

# ---- 5: the wife points at the door -> he sleeps on the sofa holding the rooster
t0, t1 = L(5, 0.0, 0.47)
WP = Vector((BX + 0.3 + BED_W / 2 + 0.45, 0.55))
f0, f1 = shot("05a_wife_points_at_door", t0, t1, (RX0 + 0.55, RY0 + 0.5, 1.6), (BX + 0.6, 0.9, 1.0), 22, [mainN, wife, ROO], "inside")
door_dir = Vector((RX0 + 0.75, RY0)) - WP
wyaw = face_dir(-1, -0.25)


def to_rig(v, yaw):
    """world direction -> armature-space aim for a rig facing yaw"""
    c, s = math.cos(-yaw), math.sin(-yaw)
    return (c * v[0] - s * v[1], s * v[0] + c * v[1], v[2])


pd = to_rig((door_dir.x, door_dir.y, 0.25 * door_dir.length), wyaw)
POINT = dict(PZ.CROSS, **{"LeftArm": ("aim", pd), "LeftForeArm": ("aim", pd), "LeftHand": ("aim", pd),
                          "Head": ("rot", (-4, 0, 14)), "Spine": ("rot", (-4, 0, 8))})
wife.key(f0, PZ.CROSS, WP, wyaw)
wife.key(fr(f0, f1, 0.3), POINT, WP, wyaw)
wife.key(fr(f0, f1, 0.65), dict(POINT, **{"Head": ("rot", (-8, 0, 25))}), WP, wyaw)
wife.key(f1, POINT, WP, wyaw)
LOOK_WIFE = dict(PZ.LIE, **{"Head": ("rot", (0, 0, 40)), "Neck": ("rot", (0, 0, 15))})
mainN.key(f0, LOOK_WIFE, (0, 0), 0.0, hips=LHIP, tilt=-PI / 2)
mainN.key(f1, LOOK_WIFE, (0, 0), 0.0, hips=LHIP, tilt=-PI / 2)
ROO.key(f0, R_STAND, (LHIP.x + 0.15, LHIP.y - 0.85, BED_TOP + 0.03), face_dir(1, 0.3))
ROO.key(f1, R_LOOK_R, (LHIP.x + 0.15, LHIP.y - 0.85, BED_TOP + 0.03), face_dir(1, 0.3))
t0, t1 = L(5, 0.47, 1.0)
sp = seat_point(SOFA, 0.12, back=0.02)
SHIP = Vector((LX - 0.25, sp.y, sp.z))
f0, f1 = shot("05b_sofa_holding_rooster", t0, t1, (LX + 0.35, LY0 + 0.9, 1.25), (LX - 0.1, sp.y, 0.62), 24, [mainN, ROO], "inside", push=0.05)
for k, a in enumerate((0.0, 0.5, 1.0)):
    mainN.key(fr(f0, f1, a), PZ.SOFA_HOLD, (0, 0), -PI / 2, hips=SHIP, tilt=-PI / 2)
sc.frame_set(f0)
chest = mainN.rig.matrix_world @ mainN.rig.pose.bones["mixamorig:Spine1"].head
for k, a in enumerate((0.0, 0.35, 0.7, 1.0)):
    ROO.key(fr(f0, f1, a), R_SIT if k % 2 == 0 else R_SIT_LOOK_L, (chest.x + 0.02, chest.y - 0.05, chest.z + 0.06 + SIT_DROP + 0.04), face_dir(0, -1))

# ---- 6: day, he puts the rooster in a wooden box outside. Genius!
g = word_time(6, "Genius")
cutg = frac(6, g - 0.1) if g else 0.73
t0, t1 = L(6, 0.0, cutg * 0.52)
f0, f1 = shot("06a_carries_rooster_to_box", t0, t1, (-4.3, -4.6, 1.45), (-2.0, 0.3, 0.75), 22, [main, ROO], "day")
PL6, yaw6 = Vector((CR.x, CR.y - 0.98)), face_dir(0, 1)
start6 = Vector((-3.6, -2.3))
yw = main.walk(f0, f1, start6, PL6, cycle=PZ.CARRY_WALK)
n6 = 8
for i in range(n6 + 1):
    t = i / n6
    f = fr(f0, f1, t)
    roo_held(f, main, PZ.CARRY_WALK[0], start6.lerp(PL6, t), yw, up=0.05, fwd=0.07)
t0, t1 = L(6, cutg * 0.52, cutg)
f0, f1 = shot("06b_cu_places_rooster_in_box", t0, t1, (CR.x + 1.75, CR.y - 2.2, 1.0), (CR.x + 0.05, CR.y - 0.55, 0.7), 24, [main, ROO], "day")
main.key(f0, PZ.HUG, PL6, yaw6)
fp_ = fr(f0, f1, 0.45)
main.key(fp_, PZ.PLACE, PL6, yaw6)
main.key(fr(f0, f1, 0.7), PZ.PLACE, PL6, yaw6)
main.key(f1, PZ.STAND, PL6, yaw6)
roo_held(f0, main, PZ.HUG, PL6, yaw6, up=0.07, fwd=0.07, ryaw=face_dir(0, -1))
roo_held(fp_, main, PZ.PLACE, PL6, yaw6, up=0.12, fwd=0.04, ryaw=face_dir(0, -1))
ROO.key(fr(f0, f1, 0.62), R_STAND, (CR.x, CR.y - 0.02, CRATE_FLOOR), face_dir(0, -1))
ROO.key(f1, R_LOOK_L, (CR.x, CR.y - 0.02, CRATE_FLOOR), face_dir(0.2, -1))
t0, t1 = L(6, cutg, 1.0)
P6c = Vector((CR.x + 0.55, CR.y - 1.35))
f0, f1 = shot("06c_low_genius_fist_pump", t0, t1, (P6c.x + 0.45, P6c.y - 1.55, 0.42), (P6c.x, P6c.y, 1.38), 22, [main, ROO], "day")
yaw6c = face_dir(-0.15, -1)
main.key(f0, PZ.STAND, P6c, yaw6c)
main.key(fr(f0, f1, 0.25), PZ.FIST, P6c, yaw6c)
main.key(fr(f0, f1, 0.5), PZ.FIST_DOWN, P6c, yaw6c)
main.key(fr(f0, f1, 0.75), PZ.FIST, P6c, yaw6c)
main.key(f1, PZ.FIST, P6c, yaw6c)
ROO.key(f0, R_STAND, (CR.x, CR.y - 0.02, CRATE_FLOOR), face_dir(0, -1))
ROO.key(f1, R_LOOK_R, (CR.x, CR.y - 0.02, CRATE_FLOOR), face_dir(0, -1))
show("crate", "06", "07", "08")

# ---- 7: sunset, it walks into the box by itself -> safe all night
t0, t1 = L(7, 0.0, 0.36)
f0, f1 = shot("07a_sunset_wide_yard", t0, t1, (2.6, -5.2, 2.3), (-0.6, 1.4, 0.3), 20, [ROO], "sunset", push=0.02)
ROO.path(f0, f1, (1.6, -1.7), (0.1, -0.2), R_WALK, step_frames=5)
t0, t1 = L(7, 0.36, 0.66)
f0, f1 = shot("07b_low_walks_into_box", t0, t1, (CR.x + 0.8, CR.y - 2.35, 0.28), (CR.x, CR.y - 0.2, 0.3), 26, [ROO], "sunset", push=0.04)
ROO.path(f0, fr(f0, f1, 0.8), (CR.x + 0.45, CR.y - 1.5), (CR.x, CR.y - 0.1), R_WALK, step_frames=5)
ROO.key(fr(f0, f1, 0.8) + 1, R_WALK[0], (CR.x, CR.y - 0.1, CRATE_FLOOR), face_dir(0.1, 1))
ROO.key(f1, R_STAND, (CR.x, CR.y, CRATE_FLOOR), face_dir(1, 0.2))
t0, t1 = L(7, 0.66, 1.0)
f0, f1 = shot("07c_night_safe_in_box", t0, t1, (CR.x + 0.3, CR.y - 1.55, 0.42), (CR.x, CR.y, 0.3), 28, [ROO], "night", push=0.12)
ROO.key(f0, R_SIT, (CR.x, CR.y - 0.02, CRATE_FLOOR + SIT_DROP), face_dir(0, -1))
ROO.key(f1, R_SIT_LOOK_L, (CR.x, CR.y - 0.02, CRATE_FLOOR + SIT_DROP), face_dir(0, -1))

# ---- 8: the box collapses under its fat ass
cl = word_time(8, "collapses")
fc8 = frac(8, cl) if cl else 0.21
t0, t1 = L(8, 0.0, 0.45)
f0, f1 = shot("08a_box_collapses", t0, t1, (CR.x - 1.45, CR.y - 1.65, 1.0), (CR.x, CR.y, 0.5), 26, [ROO], "night")
fcol = F(LINES[8]["start"] + (LINES[8]["end"] - LINES[8]["start"]) * (fc8 + 0.03))
TOPY = (CR.x, CR.y, CRATE_TOP)
ROO.key(f0, R_STAND, TOPY, face_dir(1, -0.4))
ROO.key(fcol - 5, R_STAND, TOPY, face_dir(1, -0.4))
ROO.key(fcol - 1, R_SIT, (CR.x, CR.y, CRATE_TOP + SIT_DROP), face_dir(1, -0.4))
crate_key(fcol - 1)
crate_key(fcol + 3, 0.16, 1.14)
crate_key(fcol + 6, 0.12, 1.18)
flat_top = CRATE_TOP * 0.12
ROO.key(fcol + 3, R_SIT, (CR.x, CR.y, flat_top + 0.03 + SIT_DROP), face_dir(1, -0.4), scale=(1.06, 1.0, 0.92))
ROO.key(fcol + 7, R_SIT_LOOK_L, (CR.x, CR.y, flat_top + SIT_DROP), face_dir(1, -0.4))
ROO.key(f1, R_SIT_LOOK_R, (CR.x, CR.y, flat_top + SIT_DROP), face_dir(1, -0.4))
t0, t1 = L(8, 0.45, 1.0)
f0, f1 = shot("08b_low_fat_ass_on_flat_box", t0, t1, (CR.x + 0.95, CR.y + 1.0, 0.38), (CR.x, CR.y, 0.22), 30, [ROO], "night", push=0.05)
crate_key(f0, 0.12, 1.18)
for k, a in enumerate((0.0, 0.3, 0.6, 1.0)):
    ROO.key(fr(f0, f1, a), (R_SIT_LOOK_L, R_SIT_LOOK_R, R_SIT, R_SIT_LOOK_L)[k], (CR.x, CR.y, flat_top + SIT_DROP), face_dir(-1, -0.6))

# ---- 9: he builds it out of strong wood (hammering) -> the coop with a ramp
t0, t1 = L(9, 0.0, 0.5)
W9, yaw9 = Vector((CP.x + COOP["size"][0] / 2 + 0.42, CP.y + 0.25)), face_dir(-1, 0.05)
f0, f1 = shot("09a_cu_hammering", t0, t1, (W9.x + 0.55, W9.y - 0.95, 1.3), (W9.x - 0.42, W9.y + 0.05, 1.12), 28, [main], "day", push=0.06)
for k in range(9):
    main.key(fr(f0, f1, k / 8), PZ.HAMMER_UP if k % 2 == 0 else PZ.HAMMER_DOWN, W9, yaw9)
t0, t1 = L(9, 0.5, 1.0)
P9b = Vector((CP.x + 1.25, CP.y - 1.05))
f0, f1 = shot("09b_wide_coop_reveal", t0, t1, (CP.x - 0.6, CP.y - 4.9, 0.85), (CP.x + 0.25, CP.y - 0.4, 1.05), 22, [main, ROO], "day", push=0.03)
main.key(f0, PZ.PROUD_HAMMER, P9b, face_dir(-0.3, -1))
main.key(f1, PZ.PROUD_HAMMER, P9b, face_dir(-0.3, -1))
ROO.key(f0, R_STAND, (RAMP_FOOT.x - 0.35, RAMP_FOOT.y - 0.35), face_dir(0.2, 1))
ROO.key(f1, R_LOOK_L, (RAMP_FOOT.x - 0.35, RAMP_FOOT.y - 0.35), face_dir(0.2, 1))
show("coop", "09", "10", "11", "12", "13", "14")
show("hammer", "09", "11")

# ---- 10: night, a fox sneaks in and runs off with it; he chases in his underwear
t0, t1 = L(10, 0.0, 0.4)
f0, f1 = shot("10a_low_fox_sneaks", t0, t1, (CP.x - 2.4, CP.y - 3.7, 0.3), (CP.x + 0.6, CP.y - 1.8, 0.42), 22, [FOX], "night", push=0.03)
FOX.path(f0, f1, (CP.x + 3.3, CP.y - 3.0), (RAMP_FOOT.x + 0.35, RAMP_FOOT.y - 0.45), F_SNEAK, step_frames=6)
ROO.key(f0, R_STAND, (DOORC.x, DOORC.y + 0.4, 0.3), 0.0)
t0, t1 = L(10, 0.4, 0.68)
f0, f1 = shot("10b_fox_breaks_in", t0, t1, (CP.x + 1.75, CP.y - 2.45, 0.7), (CP.x, CP.y - 0.95, 0.62), 24, [FOX], "night")
ramp_tilt = -math.atan2(DZ0, abs(RAMP_FOOT.y - DOORC.y))
fa_ = fr(f0, f1, 0.18)
FOX.path(f0, fa_, (RAMP_FOOT.x + 0.3, RAMP_FOOT.y - 0.5), (RAMP_FOOT.x, RAMP_FOOT.y), F_TROT, step_frames=4)
FOX.path(fa_ + 1, fr(f0, f1, 0.85), (RAMP_FOOT.x, RAMP_FOOT.y), (DOORC.x, DOORC.y + 0.35), F_RUN, step_frames=3,
         z0=0.02, z1=DZ0 + 0.02, tilt=ramp_tilt)
FOX.key(f1, F_RUN[0], (DOORC.x, DOORC.y + 0.7, DZ0 + 0.02), 0.0)
t0, t1 = L(10, 0.68, 1.0)
f0, f1 = shot("10c_fox_runs_off_with_rooster", t0, t1, (CP.x - 3.0, CP.y - 5.3, 0.45), (CP.x - 1.6, CP.y - 1.9, 0.5), 20, [FOX, ROO, mainN], "night", push=0.0)
FOX.path(f0, f1, (RAMP_FOOT.x - 0.2, RAMP_FOOT.y - 0.2), (CP.x - 5.2, CP.y - 2.6), F_RUN, step_frames=3)
mainN.walk(f0, f1, (CP.x + 1.8, CP.y - 3.3), (CP.x - 2.6, CP.y - 3.1), cycle=PZ.RUN, step=0.26)
# rooster in the fox's mouth: Child Of the fox head bone (influence keyed), placed relative to that bone
co = ROO.root.constraints.new("CHILD_OF"); co.target = FOX.arm; co.subtarget = FN["head"]
co.use_scale_x = co.use_scale_y = co.use_scale_z = False
co.inverse_matrix = Matrix.Identity(4)
if hasattr(co, "set_inverse_pending"):
    co.set_inverse_pending = False
co.influence = 0.0; co.keyframe_insert("influence", frame=1)
co.influence = 1.0; co.keyframe_insert("influence", frame=f0)
co.influence = 0.0; co.keyframe_insert("influence", frame=f1 + 1)
ROO.key(f0 - 1, R_STAND, (DOORC.x, DOORC.y + 0.4, 0.3), 0.0)
for f in list(range(f0, f1, 2)) + [f1]:
    sc.frame_set(f)
    hbm = FOX.arm.matrix_world @ FOX.arm.pose.bones[FN["head"]].matrix
    hl, hr, _ = hbm.decompose()
    B = Matrix.Translation(hl) @ hr.to_matrix().to_4x4()
    mouth = FOX.arm.matrix_world @ FOX.arm.pose.bones["BN_Mouth_01_023"].head
    fyaw = FOX.root.rotation_euler.z - FOX.front_yaw
    ryaw = fyaw + PI / 2
    pose = R_FLAP_UP if (f // 4) % 2 else R_FLAP_DN
    basis, posed = ROO.solve(pose)
    off = ROO.point(posed, RN["neck"], (0, 0, 0), ryaw)
    want = Matrix.Translation(mouth - off + Vector((0, 0, -0.02))) @ Matrix.Rotation(ryaw, 4, "Z") @ Matrix.Diagonal(ROO.base_scale.to_4d())
    local = B.inverted() @ want
    lc, lr, ls = local.decompose()
    ROO.root.location = lc; ROO.root.keyframe_insert("location", frame=f)
    ROO.root.rotation_euler = lr.to_euler("XYZ", ROO.root.rotation_euler); ROO.root.keyframe_insert("rotation_euler", frame=f)
    ROO.root.scale = ROO.base_scale; ROO.root.keyframe_insert("scale", frame=f)
    for name, q in basis.items():
        pb = ROO.arm.pose.bones[name]; pb.rotation_quaternion = q; pb.keyframe_insert("rotation_quaternion", frame=f, group=name)

# ---- 11: day, wire mesh nailed over the opening
t0, t1 = L(11, 0.0, 1.0)
P11, yaw11 = Vector((DOORC.x + 0.62, DOORC.y - 0.62)), face_dir(-0.55, 1)
f0, f1 = shot("11_cu_wire_mesh_nailed", t0, t1, (DOORC.x - 0.55, DOORC.y - 1.0, 1.2), (DOORC.x + 0.04, DOORC.y, 0.98), 28, [main, ROO], "day", push=0.05)
for k in range(7):
    main.key(fr(f0, f1, k / 6), PZ.HAMMER_UP if k % 2 == 0 else PZ.HAMMER_DOWN, P11, yaw11)
INSIDE = (DOORC.x, DOORC.y + 0.16, DZ0 - 0.1)
ROO.key(f0, R_LOOK_L, INSIDE, 0.0)
ROO.key(f1, R_LOOK_R, INSIDE, 0.0)
show("meshdoor", "11", "12", "13", "14")

# ---- 12: the little cousin opens the door, the rooster runs out
op = word_time(12, "opens")
fo = frac(12, op) if op else 0.48
t0, t1 = L(12, 0.0, 0.56)
K12 = Vector((DOORC.x + 0.45, DOORC.y - 0.55))
f0, f1 = shot("12a_cousin_opens_door", t0, t1, (CP.x + 2.5, CP.y - 3.9, 1.15), (CP.x + 0.1, CP.y - 0.9, 0.8), 22, [kid, ROO], "day")
fw = fr(f0, f1, fo / 0.56 * 0.85)
kid.walk(f0, fw, (CP.x + 1.6, CP.y - 2.6), K12, step=0.3)
kyaw = face_dir(-0.35, 1)
kid.key(fw + 3, PZ.REACH, K12, kyaw)
fo_ = fr(f0, f1, fo / 0.56)
kid.key(fo_ + 2, PZ.PULL, K12, kyaw)
kid.key(f1, PZ.OOPS, K12, kyaw)
hinge_key(f0, 0); hinge_key(fo_, 0); hinge_key(fo_ + 6, -95); hinge_key(f1, -110)
ROO.key(f0, R_LOOK_L, INSIDE, 0.0)
ROO.key(fo_ + 2, R_STAND, INSIDE, 0.0)
ROO.key(f1, R_RUN[0], (DOORC.x, DOORC.y - 0.15, DZ0), 0.0)
t0, t1 = L(12, 0.56, 1.0)
f0, f1 = shot("12b_rooster_escapes", t0, t1, (CP.x - 2.6, CP.y - 5.0, 0.55), (CP.x - 0.8, CP.y - 1.5, 0.55), 20, [kid, ROO], "day", push=0.0)
hinge_key(f0, -110)
kid.key(f0, PZ.OOPS, K12, kyaw)
kid.key(f1, dict(PZ.OOPS, **{"Head": ("rot", (0, 0, 45))}), K12, face_dir(-1, -0.2))
fr1 = fr(f0, f1, 0.25)
ROO.path(f0, fr1, (DOORC.x, DOORC.y - 0.1), (RAMP_FOOT.x, RAMP_FOOT.y + 0.05), R_RUN, step_frames=3, z0=DZ0, z1=0.0, tilt=-ramp_tilt * 0.8)
ROO.path(fr1 + 1, f1, (RAMP_FOOT.x - 0.1, RAMP_FOOT.y - 0.1), (CP.x - 2.2, CP.y - 2.0), R_RUN, step_frames=3)
hinge_key(f1, -110)

# ---- 13: so you add a latch (click)
la = word_time(13, "latch")
fl = frac(13, la) if la else 0.5
t0, t1 = L(13, 0.0, 1.0)
P13, yaw13 = Vector((DOORC.x + 0.78, DOORC.y - 0.52)), face_dir(-0.85, 0.9)
f0, f1 = shot("13_cu_latch_clicks", t0, t1, (DOORC.x - 0.42, DOORC.y - 0.6, 1.1), (CP.x + DX1 + 0.08, DOORC.y, DOORC.z - 0.02), 32, [main, ROO], "day", push=0.06)
hinge_key(f0, 0)
fclick = fr(f0, f1, fl)
latch_key(f0, -70); latch_key(fclick - 4, -70); latch_key(fclick, 0); latch_key(f1, 0)
main.key(f0, PZ.STAND, P13 + Vector((0.15, -0.2)), yaw13)
main.key(fclick - 6, PZ.PUSH_LATCH, P13, yaw13)
main.key(fclick + 2, PZ.PUSH_LATCH, P13 + Vector((-0.02, 0.03)), yaw13)
main.key(f1, PZ.STAND, P13 + Vector((0.1, -0.15)), yaw13)
ROO.key(f0, R_LOOK_R, INSIDE, 0.0)
ROO.key(f1, R_LOOK_L, INSIDE, 0.0)
show("latch", "13", "14")

# ---- 14: final over-the-shoulder at sunset, locked coop, the rooster looks out through the mesh
t0, t1 = L(14, 0.0, 1.0)
P14, yaw14 = Vector((CP.x - 0.15, CP.y - 2.1)), face_dir(0.1, 1)
f0, f1 = shot("14_ots_proud_locked_coop", t0, t1, (CP.x + 0.6, CP.y - 3.3, 1.62), (CP.x + 0.02, CP.y - 0.5, 1.0), 26, [main, ROO], "sunset", push=0.04)
hinge_key(f0, 0); latch_key(f0, 0)
main.key(f0, PZ.PROUD, P14, yaw14)
main.key(f1, dict(PZ.PROUD, **{"Head": ("rot", (-12, 0, 0))}), P14, yaw14)
LOOKOUT = (DOORC.x, DOORC.y + 0.13, DZ0 - 0.06)
ROO.key(f0, R_LOOK_L, LOOKOUT, 0.0)
ROO.key(fr(f0, f1, 0.5), R_LOOK_R, LOOKOUT, 0.0)
ROO.key(f1, R_STAND, LOOKOUT, 0.0)

# ---------------------------------------------------------------- visibility per shot, props, save
glow = bpy.data.objects.new("CoopGlow", bpy.data.lights.new("CoopGlow", "POINT")); PROPS.objects.link(glow)
glow.data.color = (1.0, 0.78, 0.55); glow.data.shadow_soft_size = 0.1; glow.data.use_shadow = False
glow.location = (DOORC.x + 0.05, DOORC.y + 0.4, DZ1 - 0.05)
GLOW = {"11": 20, "12a": 20, "13": 20, "14": 28}       # warm light inside the coop so the rooster reads behind the mesh
glow.data.energy = 0.0; glow.data.keyframe_insert("energy", frame=1)
for name, f0, f1, cast in SHOTS:
    glow.data.energy = next((v for k, v in GLOW.items() if name.startswith(k)), 0.0)
    glow.data.keyframe_insert("energy", frame=f0)
all_constant(glow.data)
PROP_OBJS = {"coop": meshes(COOP), "crate": meshes(crate_src), "meshdoor": [gate_mesh], "latch": meshes(LATCH),
             "hammer": meshes(HAMMER), "rope": [rope]}
for n, objs in PROP_OBJS.items():
    key_visible(objs, 1, False)
for name, f0, f1, cast in SHOTS:
    for a in ACTORS:
        key_visible(a.objs, f0, a in cast)
    key_visible(ROO.meshes, f0, ROO in cast)
    key_visible(FOX.meshes, f0, FOX in cast)
    for n, objs in PROP_OBJS.items():
        key_visible(objs, f0, any(name.startswith(p) for p in PROPV.get(n, [])))
for o in bpy.data.objects:
    constant_interp(o)
for idb in (world.node_tree, sun, sun.data, porch.data, rope, rope_curve, rope_curve_data):
    all_constant(idb)
ad = ROO.root.animation_data
for fc in iter_fcurves(ad.action):
    if fc.data_path.startswith("constraints"):
        for k in fc.keyframe_points:
            k.interpolation = "CONSTANT"
sc.camera = bpy.data.objects["CAM_" + SHOTS[0][0]]
json.dump([{"name": n, "f0": a, "f1": b} for n, a, b, _ in SHOTS], open(os.path.join(HERE, "build", "shots.json"), "w"), indent=1)
print("SHOTS", len(SHOTS))
for img in bpy.data.images:
    fp = bpy.path.abspath(img.filepath)
    if "/mh/data/" in fp and not fp.startswith(ASSETS):
        img.filepath = os.path.join(ASSETS, "mh", "data", fp.split("/mh/data/", 1)[1])
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True, relative_remap=True)
