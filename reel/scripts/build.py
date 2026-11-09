"""Builds the whole reel scene in Blender and renders it.

Run through make_reel.py (it starts Blender for you), or directly:
    blender -b -P scripts/build.py -- --mode preview|render|blend [--frames A-B] [--scale 50]

Everything here is assembled from ready-made assets:
  characters  : MPFB2 / MakeHuman (body presets, skins, hair, clothes, default rig, BVH poses, face units)
  room/props  : Poly Haven models + textures + HDRI (CC0)
Only the poop, the wall sign, the diaper and the 2D effect glyphs (hearts / sparkles) are made here.
"""
import bpy
import math
import os
import sys
import time
from mathutils import Vector, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import mh  # noqa: E402

A = os.path.join(ROOT, "assets")
PH = os.path.join(A, "polyhaven")
FONTS = os.path.join(A, "fonts")
FPS = 30
END_TIME = 54.10          # last rendered moment; the freeze-frame tail is added by ffmpeg
D = math.radians


def F(t):
    """seconds -> frame number (frame 1 == 0.0 s)"""
    return 1 + int(round(t * FPS))


# ---------------------------------------------------------------------------
# arguments
# ---------------------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = "blend"
FRAMES = None
SCALE = 100
SAMPLES = None
OUT = os.path.join(ROOT, "render")
for i, a in enumerate(argv):
    if a == "--mode":
        MODE = argv[i + 1]
    elif a == "--frames":
        lo, hi = argv[i + 1].split("-")
        FRAMES = (int(lo), int(hi))
    elif a == "--scale":
        SCALE = int(argv[i + 1])
    elif a == "--samples":
        SAMPLES = int(argv[i + 1])
    elif a == "--out":
        OUT = argv[i + 1]

T0 = time.time()


def log(*a):
    print(f"[build {time.time() - T0:6.1f}s]", *a, flush=True)


# ---------------------------------------------------------------------------
# keyframe helpers (fast fcurve writes)
# ---------------------------------------------------------------------------
def _fc(id_data, path, index):
    ad = id_data.animation_data or id_data.animation_data_create()
    if ad.action is None:
        ad.action = bpy.data.actions.new(id_data.name + "_act")
    act = ad.action
    fc = act.fcurves.find(path, index=index)
    if fc is None:
        fc = act.fcurves.new(path, index=index)
    # Blender 4.4+ "slotted actions": the action only animates the ID once a slot is assigned
    if hasattr(ad, "action_slot") and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    return fc


def key(id_data, path, index, frame, value, interp="LINEAR"):
    fc = _fc(id_data, path, index)
    kp = fc.keyframe_points.insert(frame, value, options={"FAST"})
    kp.interpolation = interp
    return kp


def key_vec(id_data, path, frame, vec, interp="LINEAR"):
    for i, v in enumerate(vec):
        key(id_data, path, i, frame, v, interp)


def finalize_fcurves():
    for act in bpy.data.actions:
        for fc in act.fcurves:
            fc.update()


# ---------------------------------------------------------------------------
# scene reset + render settings
# ---------------------------------------------------------------------------
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start = 1
    sc.frame_end = F(END_TIME)
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.render.resolution_percentage = SCALE
    sc.eevee.taa_render_samples = SAMPLES or 12
    sc.eevee.use_shadows = True
    sc.eevee.shadow_pool_size = "256"
    sc.eevee.shadow_ray_count = 1
    sc.eevee.shadow_step_count = 4
    sc.eevee.use_raytracing = False
    sc.eevee.fast_gi_method = "GLOBAL_ILLUMINATION"
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.35
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.compression = 15
    sc.render.use_motion_blur = False
    return sc


# ---------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------
def pbr_material(name, tex_dir, tint=None, uv_scale=1.0, rough_mul=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    base = os.path.basename(tex_dir)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (uv_scale, uv_scale, uv_scale)
    nt.links.new(tc.outputs["UV"], mp.inputs[0])

    def img(suffix, non_color=False):
        p = os.path.join(tex_dir, f"{base}_{suffix}_2k.jpg")
        if not os.path.exists(p):
            return None
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(p, check_existing=True)
        if non_color:
            n.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], n.inputs[0])
        return n

    d = img("diff")
    if d:
        if tint:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            nt.links.new(d.outputs[0], mix.inputs[6])
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            nt.links.new(d.outputs[0], bsdf.inputs["Base Color"])
    r = img("rough", True)
    if r:
        mr = nt.nodes.new("ShaderNodeMath")
        mr.operation = "MULTIPLY"
        mr.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs[0], mr.inputs[0])
        nt.links.new(mr.outputs[0], bsdf.inputs["Roughness"])
    n = img("nor_gl", True)
    if n:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.6
        nt.links.new(n.outputs[0], nm.inputs[1])
        nt.links.new(nm.outputs[0], bsdf.inputs["Normal"])
    return m


def flat_material(name, rgb, rough=0.5, emit=0.0, metallic=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Specular IOR Level"].default_value = spec
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


# ---------------------------------------------------------------------------
# room
# ---------------------------------------------------------------------------
ROOM = dict(x0=-3.2, x1=3.2, y0=-3.0, y1=2.6, h=2.8)
DOOR = dict(x=3.2, y0=0.25, y1=1.2, h=2.12)
POOP = Vector((0.25, 0.0, 0.0))
BABY_SPOT = Vector((-0.75, 1.0, 0.0))
SIGN_POS = Vector((-1.75, ROOM["y1"] - 0.015, 1.45))


def plane(name, size_x, size_y, loc, rot, mat, uv=None):
    me = bpy.data.meshes.new(name)
    hx, hy = size_x / 2, size_y / 2
    me.from_pydata([(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0)], [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new()
    uvs = uv or [(0, 0), (size_x, 0), (size_x, size_y), (0, size_y)]
    for i, l in enumerate(me.loops):
        uvl.data[i].uv = uvs[l.vertex_index]
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def build_room():
    floor_m = pbr_material("Floor", os.path.join(PH, "textures", "wood_floor"), uv_scale=0.5)
    wall_m = pbr_material("Wall", os.path.join(PH, "textures", "painted_plaster_wall"),
                          tint=(0.80, 0.90, 1.0), uv_scale=0.35)
    # walls face inward and are culled from behind, so a camera outside a wall sees into the room
    wall_m.use_backface_culling = True
    R = ROOM
    W, L, H = R["x1"] - R["x0"], R["y1"] - R["y0"], R["h"]
    cx, cy = (R["x0"] + R["x1"]) / 2, (R["y0"] + R["y1"]) / 2
    plane("Floor", W + 0.2, L + 0.2, (cx, cy, 0), (0, 0, 0), floor_m)
    plane("WallBack", W, H, (cx, R["y1"], H / 2), (D(90), 0, 0), wall_m)
    plane("WallFront", W, H, (cx, R["y0"], H / 2), (D(90), 0, D(180)), wall_m)
    plane("WallLeft", L, H, (R["x0"], cy, H / 2), (D(90), 0, D(90)), wall_m)
    # right wall with a door opening (three pieces)
    yA, yB, dh = DOOR["y0"], DOOR["y1"], DOOR["h"]
    plane("WallRightA", yA - R["y0"], H, (R["x1"], (R["y0"] + yA) / 2, H / 2), (D(90), 0, D(-90)), wall_m)
    plane("WallRightB", R["y1"] - yB, H, (R["x1"], (yB + R["y1"]) / 2, H / 2), (D(90), 0, D(-90)), wall_m)
    plane("WallRightTop", yB - yA, H - dh, (R["x1"], (yA + yB) / 2, dh + (H - dh) / 2), (D(90), 0, D(-90)), wall_m)
    # ceiling (camera-only: casts no shadow, so the sky still lights the room)
    ceil_m = flat_material("Ceiling", (0.85, 0.86, 0.88), rough=0.9)
    ceil_m.use_backface_culling = True
    ceil = plane("Ceiling", W + 0.2, L + 0.2, (cx, cy, H), (D(180), 0, 0), ceil_m)
    ceil.visible_shadow = False
    # skirting boards (simple white strips) and door frame
    trim = flat_material("Trim", (0.92, 0.92, 0.9), rough=0.4)
    trim.use_backface_culling = True
    for nm, sx, loc, rz in [("SkirtBack", W, (cx, R["y1"] - 0.006, 0.05), 0), ("SkirtLeft", L, (R["x0"] + 0.006, cy, 0.05), 90),
                            ("SkirtFront", W, (cx, R["y0"] + 0.006, 0.05), 180)]:
        plane(nm, sx, 0.1, loc, (D(90), 0, D(rz)), trim)
    # outdoor ground + porch seen through the door
    porch = flat_material("Porch", (0.55, 0.62, 0.38), rough=0.9)
    plane("Outside", 12, 14, (R["x1"] + 6.01, cy, -0.01), (0, 0, 0), porch)
    # door: Poly Haven rough_pine_door texture on a hinged panel
    door_m = pbr_material("Door", os.path.join(PH, "textures", "rough_pine_door"))
    dw = yB - yA
    me = bpy.data.meshes.new("Door")
    t = 0.045
    verts = [(0, 0, 0), (0, dw, 0), (0, dw, dh), (0, 0, dh)]
    verts += [(x + t, y, z) for x, y, z in verts]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (v.y / dw * 0.45, v.z / dh)
    door = bpy.data.objects.new("Door", me)
    bpy.context.scene.collection.objects.link(door)
    door.location = (R["x1"] - 0.02, yA, 0)
    door.data.materials.append(door_m)
    knob = bpy.data.objects.new("DoorKnob", bpy.data.meshes.new("DoorKnob"))
    bpy.context.scene.collection.objects.link(knob)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.035)
    bm.to_mesh(knob.data)
    bm.free()
    knob.parent = door
    knob.location = (-0.04, dw - 0.09, 1.0)
    knob.data.materials.append(flat_material("Brass", (0.8, 0.6, 0.25), rough=0.25, metallic=1.0))
    for p in knob.data.polygons:
        p.use_smooth = True
    return door


def append_ph(model, loc, rz=0.0, scale=1.0, name=None):
    path = os.path.join(PH, "models", model, f"{model}_1k.blend")
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    root = bpy.data.objects.new(name or model, None)
    bpy.context.scene.collection.objects.link(root)
    objs = [o for o in dst.objects if o is not None]
    for o in objs:
        bpy.context.scene.collection.objects.link(o)
    # bake constraint-driven parts (e.g. sliding cabinet doors on paths) into plain transforms
    bpy.context.view_layer.update()
    baked = {o: o.matrix_world.copy() for o in objs}
    for o in objs:
        if o.constraints or (o.animation_data and o.animation_data.action):
            for c in list(o.constraints):
                o.constraints.remove(c)
            o.animation_data_clear()
            o.matrix_world = baked[o]
    for o in objs:
        if o.type == "CURVE" and not o.data.materials:  # helper paths
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, D(rz))
    root.scale = (scale,) * 3
    return root


def build_furniture():
    R = ROOM
    append_ph("sofa_02", (0.3, R["y1"] - 0.52, 0))
    append_ph("throw_pillows_01", (-0.25, R["y1"] - 0.42, 0.62), rz=8)
    append_ph("modern_coffee_table_01", (0.3, 1.45, 0))
    append_ph("hanging_picture_frame_01", (0.3, R["y1"] - 0.005, 1.62), rz=0)
    append_ph("hanging_picture_frame_02", (1.6, R["y1"] - 0.005, 1.55), rz=0)
    append_ph("modern_wooden_cabinet", (R["x0"] + 0.36, 0.35, 0), rz=90)
    append_ph("television_02", (R["x0"] + 0.3, 0.35, 0.68), rz=90, scale=1.6)
    append_ph("wall_clock", (R["x0"] + 0.03, -1.6, 1.9), rz=90)
    append_ph("potted_plant_01", (R["x0"] + 0.45, R["y1"] - 0.45, 0))
    append_ph("wooden_bookshelf_worn", (2.35, R["y1"] - 0.3, 0))
    append_ph("side_table_01", (1.65, R["y1"] - 0.42, 0))
    append_ph("potted_plant_02", (1.65, R["y1"] - 0.42, 0.62), scale=0.6)
    append_ph("ArmChair_01", (-2.25, -2.05, 0), rz=135)
    append_ph("potted_plant_01", (2.75, -2.55, 0), name="plant_front")
    append_ph("rubber_duck_toy", BABY_SPOT + Vector((0.45, -0.35, 0)), rz=-30, scale=0.6)
    # pebbles / soil inside the plant pots: ~170k triangles nobody can see -> big render-time saving
    for o in list(bpy.data.objects):
        if o.type == "MESH" and ("pebbles" in o.name or o.name.endswith("_dirt")):
            bpy.data.objects.remove(o, do_unlink=True)


def build_lights():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(PH, "hdri", "kloofendal_48d_partly_cloudy_puresky_2k.hdr"))
    nt.links.new(env.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 1.1
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 4.2
    sun.angle = D(4)
    sun.color = (1.0, 0.97, 0.92)
    so = bpy.data.objects.new("Sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (D(38), D(0), D(-35))
    # soft fill so faces read like the reference (bright, low contrast daylight)
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 900
    fill.size = 5
    fill.color = (0.92, 0.96, 1.0)
    fill.use_shadow = False  # soft fill only; saves a whole shadow pass per sample
    fo = bpy.data.objects.new("Fill", fill)
    sc.collection.objects.link(fo)
    fo.location = (0.0, -2.6, 2.75)
    fo.rotation_euler = (D(35), 0, 0)


# ---------------------------------------------------------------------------
# my own tiny props: poop, wall sign, diaper, glyph effects
# ---------------------------------------------------------------------------
def build_poop():
    import bmesh
    me = bpy.data.meshes.new("Poop")
    bm = bmesh.new()
    # a cartoon swirl: three stacked, shrinking rings and a curled tip
    for i, (r, z) in enumerate([(0.075, 0.03), (0.058, 0.075), (0.04, 0.113)]):
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r, radius2=r * 0.92, depth=0.055)
        bmesh.ops.translate(bm, verts=ret["verts"], vec=(0.006 * i, 0, z))
    ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.026, radius2=0.002, depth=0.05)
    bmesh.ops.rotate(bm, verts=ret["verts"], cent=(0, 0, 0), matrix=Euler((0, D(-25), 0)).to_matrix())
    bmesh.ops.translate(bm, verts=ret["verts"], vec=(0.018, 0, 0.152))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Poop", me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    o.data.materials.append(flat_material("PoopMat", (0.20, 0.09, 0.03), rough=0.25, spec=0.8))
    o.location = POOP
    o.scale = (1.15, 1.15, 1.0)
    return o


def text_obj(name, body, size, mat, font="Poppins-ExtraBold.ttf", align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font), check_existing=True)
    cu.extrude = 0.002
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def build_sign():
    root = bpy.data.objects.new("Sign", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = SIGN_POS
    root.rotation_euler = (D(90), 0, 0)  # face -Y (into the room)
    white = flat_material("SignWhite", (0.8, 0.8, 0.78), rough=0.7, spec=0.2)
    border = flat_material("SignBorder", (0.32, 0.0, 0.0), rough=0.6, spec=0.2)
    ink = flat_material("SignInk", (0.004, 0.004, 0.006), rough=0.7, spec=0.2)
    red = flat_material("SignRed", (0.38, 0.0, 0.0), rough=0.6, spec=0.2)
    b = plane("SignBorder", 0.86, 0.62, (0, 0, -0.004), (0, 0, 0), border)
    b.parent = root
    p = plane("SignBoard", 0.8, 0.56, (0, 0, 0), (0, 0, 0), white)
    p.parent = root
    for i, line in enumerate(["DAYS SINCE YOU", "POOPED ON", "THE FLOOR:"]):
        t = text_obj(f"SignTxt{i}", line, 0.072, ink)
        t.parent = root
        t.location = (0, 0.2 - i * 0.085, 0.003)
    nums = {}
    for n in ("3", "0"):
        t = text_obj(f"SignNum{n}", n, 0.2, red)
        t.parent = root
        t.location = (0, -0.14, 0.004)
        nums[n] = t
    return root, nums


def build_diaper():
    import bmesh
    me = bpy.data.meshes.new("DiaperHeld")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.30, 0.20, 0.06), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("DiaperHeld", me)
    bpy.context.scene.collection.objects.link(o)
    bev = o.modifiers.new("bev", "BEVEL")
    bev.width = 0.025
    bev.segments = 3
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    bend = o.modifiers.new("bend", "SIMPLE_DEFORM")
    bend.deform_method = "BEND"
    bend.angle = D(70)
    bend.deform_axis = "Y"
    for p in me.polygons:
        p.use_smooth = True
    o.data.materials.append(flat_material("DiaperWhite", (0.97, 0.97, 0.99), rough=0.7))
    # two blue tabs so it reads as a diaper
    tabm = flat_material("DiaperTab", (0.2, 0.55, 0.95), rough=0.5)
    for s in (-1, 1):
        tab = bpy.data.objects.new(f"DiaperTab{s}", bpy.data.meshes.new(f"DiaperTab{s}"))
        bpy.context.scene.collection.objects.link(tab)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(0.07, 0.045, 0.012), verts=bm.verts)
        bm.to_mesh(tab.data)
        bm.free()
        tab.parent = o
        tab.location = (s * 0.17, 0.07, 0.0)
        tab.data.materials.append(tabm)
    return o


def build_glyphs(prefix, glyph, n, rgb, size, emit=2.0):
    m = flat_material(prefix + "Mat", rgb, rough=0.4, emit=emit)
    objs = []
    for i in range(n):
        t = text_obj(f"{prefix}{i}", glyph, size, m, font="DejaVuSans-Bold.ttf")
        t.data.extrude = 0.004
        objs.append(t)
    return objs


# ---------------------------------------------------------------------------
# characters
# ---------------------------------------------------------------------------
FACE_UNITS = ["mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "eyeWideLeft",
              "eyeWideRight", "browInnerUp", "browDownLeft", "browDownRight", "mouthFrownLeft", "mouthFrownRight",
              "cheekSquintLeft", "cheekSquintRight", "eyeSquintLeft", "eyeSquintRight", "mouthFunnel",
              "eyeLookUpLeft", "eyeLookUpRight", "mouthPucker", "browOuterUpLeft", "browOuterUpRight", "tongueOut"]

CHAR_SPECS = {
    "You": dict(gender=1.0, age=25, weight=0.64, muscle=0.45, height=0.52, skin="young_caucasian_male.mhmat",
                hair="short02.mhclo", clothes=["male_casualsuit06.mhclo", "shoes02.mhclo"]),
    "Mom": dict(gender=0.0, age=44, weight=0.55, muscle=0.4, height=0.45, proportions=0.9,
                skin="toigo_light_skin_with_natural_makeup.mhmat",           # pretty: natural make-up skin
                hair="elvs_island_princess_hair.mhclo",                      # long black hair with a pink bow
                eyebrows="eyebrow010.mhclo", eyelashes="eyelashes03.mhclo",
                targets={"l-eye-scale-incr": 0.35, "r-eye-scale-incr": 0.35, "mouth-upperlip-volume-incr": 0.4,
                         "mouth-lowerlip-volume-incr": 0.35, "nose-scale-horiz-decr": 0.3, "nose-scale-vert-decr": 0.15},
                clothes=["female_casualsuit02.mhclo", "shoes01.mhclo"]),  # modern tee + denim shorts
    "Baby": dict(gender=1.0, age=1, weight=0.85, skin="young_caucasian_male.mhmat", hair="",
                 eyebrows="eyebrow010.mhclo", clothes=["elvs_crude_bootyshorts.mhclo"]),
    "Cop1": dict(gender=1.0, age=31, weight=0.6, muscle=0.7, height=0.55, race=("african",),
                 skin="young_african_male.mhmat", hair="short04.mhclo",
                 clothes=["elvs_male_shirt_tie_tucked1.mhclo", "elvs_male_trouser.mhclo",
                          "mindfront_patrol_cap.mhclo", "shoes06.mhclo"]),
    "Cop2": dict(gender=1.0, age=46, weight=0.74, muscle=0.6, height=0.5, race=("african",),
                 skin="middleage_african_male.mhmat", hair="short02.mhclo",
                 clothes=["elvs_male_shirt_tie_tucked1.mhclo", "elvs_male_trouser.mhclo",
                          "mindfront_patrol_cap.mhclo", "shoes06.mhclo"]),
}

POSES = {
    "stand": "callharvey3d_standingnatural",
    "stand2": "standing02",
    "shock": "elvs_what_have_i_done",
    "point": "culturalibre_gun",
    "akimbo": "drednicolson_arms_akimbo",
    "armup": "standing05",
    "embarrassed": "sohh_sohh_embarrassed",
    "lean": "jjones_leaning_on_counter_hands_folded",
    "phone": "callharvey3d_salute",
    "behind": "callharvey3d_standingatease",
    "run": "run01",
    "grab": "culturalibre_neck_grab",
    "shoulder": "punkduck_hand_on_shoulder_01",
    "clasp": "anrico_standing11",
    "wave": "gpedroso_peace_and_love",
    "sit": "callharvey3d_sittingfloor2",
    "curious": "callharvey3d_curious",
    "attention": "callharvey3d_standingatattention",
}
CHAR_POSES = {
    "You": ["stand", "embarrassed", "point", "lean", "armup", "phone", "behind", "shock", "stand2"],
    "Mom": ["stand", "shock", "akimbo", "armup", "clasp", "wave", "shoulder", "stand2"],
    "Baby": ["sit"],
    "Cop1": ["stand", "run", "akimbo", "grab", "shoulder", "attention"],
    "Cop2": ["stand", "run", "akimbo", "grab", "shoulder", "attention"],
}
LOWER = ("root", "pelvis", "upperleg", "lowerleg", "foot", "toe")


class Character:
    def __init__(self, name):
        self.name = name
        self.rig, self.body = mh.make_human(name, subdiv=0, **CHAR_SPECS[name])  # no subdivision: 2x less memory
        self.objs = mh.children(self.rig)
        self.poses = {}
        self.ground = {}
        self.shapes = []  # (id_data, keyblock name)
        self._style()
        self._load_poses()
        self._load_face()

    def _style(self):
        for o in self.objs:
            n = o.name.lower()
            if self.name.startswith("Cop"):
                if "shirt" in n:
                    mh.tint(o, (0.022, 0.04, 0.11), keep_detail=0.45)
                elif "trouser" in n:
                    mh.tint(o, (0.012, 0.016, 0.035), keep_detail=0.45)
                elif "cap" in n:
                    mh.tint(o, (0.015, 0.025, 0.07), keep_detail=0.3)
            if self.name == "Mom" and "island_princess" in n:
                mh.darken_grey_keep_colour(o)  # black hair, pink bow stays pink
            if self.name == "You" and "tongue" in n:
                mh.tint(o, (0.45, 0.04, 0.08), keep_detail=0.25, rough=0.35)  # pink tongue for the tongue-out gag
            if self.name == "Baby" and "short" in n:
                mh.tint(o, (0.97, 0.97, 0.97), keep_detail=0.12, rough=0.75)

    def _load_poses(self):
        for p in CHAR_POSES[self.name]:
            mh.apply_bvh_pose(self.rig, POSES[p])
            self.poses[p] = {b.name: b.rotation_euler.copy() for b in self.rig.pose.bones}
            # how far the lowest point of the mesh is from the floor in this pose
            bpy.context.view_layer.update()
            dg = bpy.context.evaluated_depsgraph_get()
            zmin = 1e9
            # body + clothes + shoes (MPFB hides the body under clothes, so the body alone is not enough)
            for o in [self.body] + self.objs:
                if o.type != "MESH":
                    continue
                ev = o.evaluated_get(dg)
                mw = ev.matrix_world
                if len(ev.data.vertices):
                    zmin = min(zmin, min((mw @ v.co).z for v in ev.data.vertices))
            self.ground[p] = zmin - self.rig.location.z
        for b in self.rig.pose.bones:
            b.rotation_euler = self.poses[CHAR_POSES[self.name][0]][b.name]

    def _load_face(self):
        FS = mh.svc()["FaceService"]
        FS.set_expression(self.body, {u: 0.001 for u in FACE_UNITS})
        try:
            FS.interpolate_targets(self.body)
        except Exception as e:  # eyelashes/eyebrows may not follow; face still works
            log("interpolate_targets failed", self.name, e)
        for o in [self.body] + self.objs:
            if o.type == "MESH" and o.data.shape_keys:
                for kb in o.data.shape_keys.key_blocks:
                    if kb.name.startswith("!ex-"):
                        kb.value = 0.0
                        self.shapes.append((o.data.shape_keys, kb.name))

    # -- keying ------------------------------------------------------------
    def pose_dict(self, spec, deltas=None):
        """spec: 'name' or {'base': name, 'upper': name, 'armL': name, 'armR': name}"""
        if isinstance(spec, str):
            spec = {"base": spec}
        out = dict(self.poses[spec["base"]])
        for part, src in spec.items():
            if part == "base":
                continue
            P = self.poses[src]
            for bn in out:
                is_lower = bn.startswith(LOWER)
                if part == "upper" and not is_lower:
                    out[bn] = P[bn]
                elif part == "armL" and bn.endswith(".L") and not is_lower and not bn.startswith("breast"):
                    out[bn] = P[bn]
                elif part == "armR" and bn.endswith(".R") and not is_lower and not bn.startswith("breast"):
                    out[bn] = P[bn]
        out = {k: v.copy() for k, v in out.items()}
        for bn, (dx, dy, dz) in (deltas or {}).items():
            e = out[bn]
            out[bn] = Euler((e.x + D(dx), e.y + D(dy), e.z + D(dz)))
        return out

    def key_pose(self, frame, spec, deltas=None, interp="LINEAR"):
        pd = self.pose_dict(spec, deltas)
        for bn, e in pd.items():
            pb = self.rig.pose.bones[bn]
            key_vec(self.rig, f'pose.bones["{bn}"].rotation_euler', frame, e, interp)

    def ground_z(self, spec):
        base = spec if isinstance(spec, str) else spec["base"]
        return -self.ground.get(base, 0.0)

    def key_place(self, frame, x, y, rz_deg, z=None, spec="stand", interp="LINEAR"):
        if z is None:
            z = self.ground_z(spec)
        key_vec(self.rig, "location", frame, (x, y, z), interp)
        key_vec(self.rig, "rotation_euler", frame, (0, 0, D(rz_deg)), interp)

    def key_face(self, frame, interp="LINEAR", **units):
        for sk, kb in self.shapes:
            unit = kb[4:]
            key(sk, f'key_blocks["{kb}"].value', 0, frame, units.get(unit, 0.0), interp)

    def key_visible(self, frame, visible):
        for o in [self.rig] + self.objs:
            key(o, "hide_render", 0, frame, 0.0 if visible else 1.0, "CONSTANT")


def face_angle(src, dst):
    """rotation (deg) that turns a MakeHuman character (front = -Y) at src to face dst"""
    d = Vector(tuple(dst)[:2]) - Vector(tuple(src)[:2])
    return math.degrees(math.atan2(d.x, -d.y))


# ---------------------------------------------------------------------------
# cameras
# ---------------------------------------------------------------------------
class Cam:
    def __init__(self, sc):
        self.cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
        sc.collection.objects.link(self.cam)
        sc.camera = self.cam
        self.cam.data.sensor_fit = "VERTICAL"
        self.cam.data.sensor_width = 36
        self.cam.data.clip_start = 0.02
        self.cam.data.dof.use_dof = False
        self.tgt = bpy.data.objects.new("CamTarget", None)
        sc.collection.objects.link(self.tgt)
        c = self.cam.constraints.new("TRACK_TO")
        c.target = self.tgt
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        self.roll = 0

    def shot(self, f0, f1, pos, tgt, lens=35, push=0.12, pos1=None, tgt1=None, lens1=None, ease=True):
        pos, tgt = Vector(pos), Vector(tgt)
        if pos1 is None:
            pos1 = pos + (tgt - pos) * push
        tgt1 = Vector(tgt1) if tgt1 is not None else tgt
        interp = "BEZIER" if ease else "LINEAR"
        key_vec(self.cam, "location", f0, pos, interp)
        key_vec(self.cam, "location", f1 - 1, Vector(pos1), "CONSTANT")
        key_vec(self.tgt, "location", f0, tgt, interp)
        key_vec(self.tgt, "location", f1 - 1, tgt1, "CONSTANT")
        key(self.cam.data, "lens", 0, f0, lens, interp)
        key(self.cam.data, "lens", 0, f1 - 1, lens1 or lens, "CONSTANT")


# ---------------------------------------------------------------------------
# effects
# ---------------------------------------------------------------------------
def pop_glyphs(objs, f_start, center, radius, theta, stagger=3, life=40, rise=0.25, size=1.0, spin=False, seed=1):
    """little 2D effect glyphs (hearts / sparkles) that pop in around `center`, facing the camera.
    theta: rotation about Z so the glyph plane faces the camera."""
    import random
    rnd = random.Random(seed)
    right = Vector((math.cos(theta), math.sin(theta), 0))
    up = Vector((0, 0, 1))
    for i, o in enumerate(objs):
        a = (i / len(objs)) * math.tau + rnd.uniform(-0.35, 0.35)
        rx, rz = radius if isinstance(radius, (tuple, list)) else (radius, radius * 0.85)
        k = rnd.uniform(0.8, 1.1)
        p0 = Vector(center) + right * math.cos(a) * rx * k + up * math.sin(a) * rz * k
        fs = f_start + i * stagger
        rot0 = (D(90), 0, theta)
        key(o, "hide_render", 0, 1, 1.0, "CONSTANT")
        key(o, "hide_render", 0, fs, 0.0, "CONSTANT")
        sz = size * rnd.uniform(0.8, 1.25)
        key_vec(o, "scale", fs, (0, 0, 0))
        key_vec(o, "scale", fs + 4, (1.4 * sz,) * 3)
        key_vec(o, "scale", fs + 7, (sz,) * 3)
        key_vec(o, "location", fs, p0)
        key_vec(o, "rotation_euler", fs, rot0)
        end = fs + life
        key_vec(o, "location", end, p0 + up * rise)
        if spin:
            key_vec(o, "rotation_euler", end, (D(90), D(rnd.choice((-1, 1)) * 90), theta))
        key_vec(o, "scale", end - 5, (sz,) * 3)
        key_vec(o, "scale", end, (0, 0, 0))
        key(o, "hide_render", 0, end + 1, 1.0, "CONSTANT")


def key_obj_visible(o, frame, visible):
    objs = [o] + list(o.children_recursive)
    for x in objs:
        key(x, "hide_render", 0, frame, 0.0 if visible else 1.0, "CONSTANT")


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
def build():
    sc = reset_scene()
    log("room")
    door = build_room()
    build_furniture()
    build_lights()
    poop = build_poop()
    sign, nums = build_sign()
    diaper = build_diaper()
    hearts = build_glyphs("Heart", "♥", 9, (0.85, 0.02, 0.22), 0.17, emit=0.45)
    sparks = build_glyphs("Spark", "✦", 10, (1.0, 0.95, 0.6), 0.15, emit=6.0)
    log("characters")
    C = {}
    for n in ("You", "Mom", "Baby", "Cop1", "Cop2"):
        C[n] = Character(n)
        log("  made", n)
    cam = Cam(sc)
    import shots
    ctx = dict(sc=sc, C=C, cam=cam, door=door, poop=poop, sign=sign, nums=nums, diaper=diaper,
                    hearts=hearts, sparks=sparks, F=F, key=key, key_vec=key_vec, face_angle=face_angle,
                    pop_glyphs=pop_glyphs, key_obj_visible=key_obj_visible, POOP=POOP,
                    BABY_SPOT=BABY_SPOT, SIGN_POS=SIGN_POS, DOOR=DOOR, ROOM=ROOM, D=D)
    shots.make(ctx)
    import json
    sc["cast_json"] = json.dumps(ctx["cast_map"])
    finalize_fcurves()
    log("built; frames", sc.frame_start, "-", sc.frame_end)
    return sc


if __name__ == "__main__":
    sc = build()
    os.makedirs(OUT, exist_ok=True)
    if MODE == "blend":
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "reel.blend"))
    elif MODE == "preview":
        import shots
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "reel.blend"))
        for i, (name, t0, t1) in enumerate(shots.SHOTS):
            f = F((t0 + t1) / 2)
            sc.frame_set(f)
            sc.render.filepath = os.path.join(OUT, f"preview_{i + 1:02d}_{name}.png")
            bpy.ops.render.render(write_still=True)
            log("preview", i + 1, name, "frame", f)
    elif MODE == "render":
        lo, hi = FRAMES or (sc.frame_start, sc.frame_end)
        sc.frame_start, sc.frame_end = lo, hi
        sc.render.filepath = os.path.join(OUT, "frames", "f_####")
        sc.render.use_overwrite = False     # skip frames that already exist -> resumable
        sc.render.use_placeholder = True    # lets several Blender processes share one range

        def _done(scene, *_):
            log("frame", scene.frame_current)
        bpy.app.handlers.render_post.append(_done)
        bpy.ops.render.render(animation=True)
