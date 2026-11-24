"""Shot definitions for Episode 18 "He's Just Shy" - Dale's point of view: YOU are Dale, you love your baby so much,
and your baby hates you. Love letter (burned), written on his car, in his cereal, in the sky; his reply LEAVE ME ALONE
(he wrote back!); a serenade under his window (a shoe in the face: a gift!); a candlelit dinner (he climbs out of the
bathroom window, you're waiting in the getaway car with dessert); new locks (so you move in, under his bed); he moves
abroad (honeymoon!); he buries you in his garden (he wants you close, forever); one night he hugs you back in his
sleep; he wakes up screaming your name. He's just shy.
Same pipeline as episodes 1-17 (imports the newest episode, 17 -> 16 -> ...). Cast from the existing character files
only: Dale, and you (you_casual by day, you_night / you_pj at night). Props and sets are scene objects; character files
untouched. Smoothness rules from episodes 12-17: no finger close-ups, forward-facing idle range, seated heads levelled,
whole-body motion through pivots, hand targets world-fixed or riding the moving thing, look-ats at fixed empties."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector, Euler
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep17 = _load("ep17shots", "ep17")         # newest episode (its chain: 16, 15, 14, ... 1)
ep16, ep15, ep14, ep13, ep12, ep11, ep9 = ep17.ep16, ep17.ep15, ep17.ep14, ep17.ep13, ep17.ep12, ep17.ep11, ep17.ep9
ep7, ep6, ep4, ep3, ep2, ep1 = ep17.ep7, ep17.ep6, ep17.ep4, ep17.ep3, ep17.ep2, ep17.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, SERENE, TADA, face,
                      blink, look_at, hand_ik, src, pose, settle, on_bone)  # noqa: E402
STERN, RAGE, SLEEP = ep1.STERN, ep1.RAGE, ep1.SLEEP
GRIN, SAD, SCREAM, GROSSED = ep6.GRIN, ep7.SAD, ep9.SCREAM, ep12.GROSSED
load_char, closeup, face_light = ep9.load_char, ep9.closeup, ep9.face_light
look_keys, sit_level = ep12.look_keys, ep12.sit_level
rocker, glue, rock, hold, head = ep13.rocker, ep13.glue, ep13.rock, ep13.hold, ep13.head
you_char, dale_char, idle = ep15.you_char, ep15.dale_char, ep15.idle
LOVE, BEAM, SNUG, WIDE, WINK, DAZED = ep17.LOVE, ep17.BEAM, ep17.SNUG, ep17.WIDE, ep17.WINK, ep17.DAZED
TOP_Z = ep17.TOP_Z
HX, HY = ep16.HX, ep16.HY
D18 = os.path.join(lib.SCRATCH, "ep18", "decals")

SHOTS = {}


def shot(fn):
    SHOTS[fn.__name__] = fn
    return fn


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * lib.FPS) - round(t * lib.FPS)
    raise KeyError(name)


def at(name, t):
    t0 = dict(CUTS)[name]
    return max(1, round((t - t0) * lib.FPS) + 1)


LOVE = {"eyeBlinkLeft": 0.3, "eyeBlinkRight": 0.3, "eyeSquintLeft": 0.35, "eyeSquintRight": 0.35,
        "mouthSmileLeft": 0.9, "mouthSmileRight": 0.9, "cheekSquintLeft": 0.55, "cheekSquintRight": 0.55,
        "browInnerUp": 0.45}
SING = dict(LOVE, eyeBlinkLeft=0.85, eyeBlinkRight=0.85, jawOpen=0.6, mouthFunnel=0.25)
DREAMY = dict(LOVE, eyeBlinkLeft=0.0, eyeBlinkRight=0.0, eyeWideLeft=0.3, eyeWideRight=0.3)
SLEEP_SMILE = dict(SNUG, eyeBlinkLeft=1.0, eyeBlinkRight=1.0)
FROZEN = dict(BEAM, eyeWideLeft=1.0, eyeWideRight=1.0, eyeSquintLeft=0.0, eyeSquintRight=0.0,
              cheekSquintLeft=0.2, cheekSquintRight=0.2)
NIGHT = (0.75, 0.82, 1.0)
WARM = (1.0, 0.82, 0.6)


# ============================================================================ little helpers
def face_cam(obj, cam_obj):
    c = obj.constraints.new("TRACK_TO")
    c.target = cam_obj; c.track_axis = "TRACK_Z"; c.up_axis = "UP_Y"


def floaters(cam, img, center, n, count=6, spread=(0.35, 0.3), size=0.11, rise=0.01, life=26, seed=1, emit=0.35,
             f0=1, name="flt"):
    """Cartoon cards (hearts, music notes, Zzz) popping up round `center`, drifting up and shrinking away, always
    turned to the camera."""
    r = random.Random(seed)
    span = max(1, n - f0 - 4)
    for k in range(count):
        st = f0 + int(k * span / count)
        p0 = Vector(center) + Vector((r.uniform(-spread[0], spread[0]), r.uniform(-0.08, 0.08), r.uniform(-0.05, spread[1])))
        o = decal(f"{name}{k}", img, size, p0, rot=(90, 0, 0), emit=emit, alpha=True)
        face_cam(o, cam.cam)
        s = r.uniform(0.8, 1.2)
        key_scale(o, 1, 0.0, interp="CONSTANT")
        if st > 2:
            key_scale(o, st - 1, 0.0, interp="CONSTANT")
        key_scale(o, st + 3, 1.2 * s); key_scale(o, st + 6, s)
        end = st + life
        key_scale(o, end - 5, s); key_scale(o, end, 0.0)
        key_loc(o, st, p0); key_loc(o, end, p0 + Vector((r.uniform(-0.06, 0.06), 0.0, rise * life)))


def hearts(cam, center, n, count=6, f0=1, seed=1, size=0.13, spread=(0.35, 0.3), emit=0.15, pink=False):
    floaters(cam, f"{D18}/heart_{'pink' if pink else 'red'}.png", center, n, count=count, spread=spread, size=size,
             seed=seed, emit=emit, f0=f0, name=f"hrt{seed}_")


def notes(cam, center, n, count=6, f0=1, seed=1, size=0.12):
    r = random.Random(seed)
    floaters(cam, f"{D18}/note_music.png", center, n, count=(count + 1) // 2, size=size, seed=seed, emit=0.5, f0=f0,
             spread=(0.45, 0.35), name=f"nta{seed}_")
    floaters(cam, f"{D18}/note_music2.png", center, n, count=count // 2, size=size, seed=seed + 50, emit=0.5,
             f0=f0 + 3, spread=(0.45, 0.35), name=f"ntb{seed}_")


def reik(ch, side, target):
    """Replace a hand's IK target (episode 17's eating() does the same)."""
    pb = ch.rig.pose.bones[f"{side}ForeArm"]
    for c in list(pb.constraints):
        if c.type == "IK":
            pb.constraints.remove(c)
    hand_ik(ch, side, target)


def hide(*names):
    for nm in names:
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True


# ============================================================================ props
def shoe_prop(name="shoe", color=(0.85, 0.1, 0.12)):
    """Sneaker, toe toward +Y, origin under the middle of the sole."""
    root = empty(name)
    white = mat_flat("sole18", (0.95, 0.95, 0.95), rough=0.6)
    up = mat_flat(f"{name}_up", color, rough=0.55)
    box(f"{name}_sole", (0.1, 0.29, 0.03), (0, 0, 0.015), white, bevel=0.012).parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0, location=(0, -0.01, 0.055))
    u = bpy.context.object; u.name = f"{name}_upper"; u.scale = (0.05, 0.135, 0.055)
    u.data.materials.append(up); bpy.ops.object.shade_smooth(); u.parent = root
    cylinder(f"{name}_collar", 0.04, 0.03, (0, -0.075, 0.1), mat_flat("collar18", (0.1, 0.1, 0.1)), verts=16).parent = root
    for k in range(3):
        box(f"{name}_lace{k}", (0.06, 0.008, 0.006), (0, 0.015 + k * 0.025, 0.104 - k * 0.012), white).parent = root
    return root


def pen_prop(name="pen"):
    """Fluffy pink pen along +Y (bone axis when glued to a hand)."""
    root = empty(name)
    cylinder(f"{name}_body", 0.006, 0.15, (0, 0.05, 0), mat_flat("pen18", (0.95, 0.3, 0.55), rough=0.3),
             rot=(-90, 0, 0), verts=12).parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.016, location=(0, 0.13, 0))
    b = bpy.context.object; b.data.materials.append(mat_flat("penball", (1.0, 0.2, 0.45), rough=0.9)); b.parent = root
    return root


def spray_can(name="can"):
    root = empty(name)
    cylinder(f"{name}_body", 0.032, 0.17, (0, 0, 0.0), mat_flat("can18", (1.0, 0.25, 0.6), metal=0.5, rough=0.3),
             verts=16).parent = root
    cylinder(f"{name}_cap", 0.02, 0.03, (0, 0, 0.1), mat_flat("cap18", (0.95, 0.95, 0.95)), verts=12).parent = root
    return root


def trash_bin(loc):
    root = empty("bin", loc)
    m = mat_flat("bin18", (0.55, 0.57, 0.6), metal=0.8, rough=0.35)
    cylinder("bin_body", 0.24, 0.7, (0, 0, 0.35), m, verts=28).parent = root
    cylinder("bin_inside", 0.225, 0.02, (0, 0, 0.62), mat_flat("bindark", (0.03, 0.03, 0.03), rough=1.0), verts=28).parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.245, minor_radius=0.015, location=(0, 0, 0.7))
    t = bpy.context.object; t.data.materials.append(m); t.parent = root
    return root


def fire(loc, f0, n, scale=1.0, seed=2, light=110):
    """Flickering flames (emissive cones) that burst up at f0, with a warm flickering light."""
    hot = mat_flat("fire18", (0.9, 0.12, 0.0), emit=(1.0, 0.18, 0.0), emit_strength=1.6)
    core = mat_flat("fire18c", (1.0, 0.42, 0.0), emit=(1.0, 0.4, 0.0), emit_strength=1.9)
    r = random.Random(seed)
    root = empty("fire", loc)
    for k in range(6):
        off = Vector((r.uniform(-0.09, 0.09), r.uniform(-0.09, 0.09), 0)) * scale
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.08 * scale, depth=0.36 * scale,
                                        location=off + Vector((0, 0, 0.12 * scale)))
        c = bpy.context.object; c.name = f"flame{k}"
        c.data.materials.append(core if k == 0 else hot); c.visible_shadow = False; c.parent = root
        key_scale(c, 1, 0.0, interp="CONSTANT")
        if f0 > 2:
            key_scale(c, f0 - 1, 0.0, interp="CONSTANT")
        key_scale(c, f0 + 1, 0.5)
        for f in range(f0 + 4, n + 3, 3):
            key_scale(c, f, (1.0, 1.0, r.uniform(0.75, 1.4)))
    lt = point("firelight", Vector(loc) + Vector((0, -0.35, 0.55)), energy=0, color=(1.0, 0.55, 0.2), radius=0.2)
    for f in range(1, n + 2, 2):
        lt.data.energy = 0 if f < f0 else light * r.uniform(0.7, 1.2)
        lt.data.keyframe_insert("energy", frame=f)
    return root


def mailbox(loc):
    root = empty("mailbox", loc)
    wood = mat_flat("mbpost", (0.45, 0.3, 0.18), rough=0.8)
    box("mb_post", (0.08, 0.08, 1.05), (0, 0, 0.525), wood).parent = root
    m = mat_flat("mbbox", (0.15, 0.25, 0.6), metal=0.4, rough=0.4)
    box("mb_box", (0.2, 0.45, 0.16), (0, 0, 1.13), m, bevel=0.02).parent = root
    cylinder("mb_top", 0.1, 0.45, (0, 0, 1.21), m, rot=(90, 0, 0), verts=24).parent = root
    box("mb_flag", (0.02, 0.12, 0.08), (0.12, 0.08, 1.28), mat_flat("mbflag", (0.9, 0.1, 0.1))).parent = root
    return root


def envelope(name="env"):
    root = empty(name)
    box(f"{name}_body", (0.22, 0.006, 0.12), (0, 0, 0), mat_flat("envm", (0.97, 0.96, 0.92), rough=0.8)).parent = root
    box(f"{name}_flapline", (0.2, 0.002, 0.004), (0, -0.004, 0.03), mat_flat("envflap", (0.75, 0.74, 0.7), rough=0.8)).parent = root
    return root


def roses(loc):
    root = empty("roses", loc)
    cylinder("vase", 0.045, 0.2, (0, 0, 0.1), mat_flat("vase18", (0.8, 0.9, 1.0), rough=0.05, alpha=0.45), verts=20).parent = root
    red = mat_flat("rose18", (0.75, 0.02, 0.08), rough=0.5)
    green = mat_flat("stem18", (0.1, 0.4, 0.1))
    r = random.Random(7)
    for k in range(5):
        a = k * 1.2566
        dx, dy = 0.045 * math.cos(a), 0.045 * math.sin(a)
        cylinder(f"stem{k}", 0.004, 0.22, (dx * 0.5, dy * 0.5, 0.26), green, verts=6).parent = root
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.036, location=(dx, dy, 0.38 + r.uniform(-0.02, 0.03)))
        o = bpy.context.object; o.data.materials.append(red); bpy.ops.object.shade_smooth(); o.parent = root
    return root


def door_locks(h):
    """Six shiny new locks and a padlock down the opening edge of the front door (children of its hinge)."""
    brass = mat_flat("brass18", (0.85, 0.65, 0.25), metal=1.0, rough=0.25)
    steel = mat_flat("steel18", (0.75, 0.76, 0.78), metal=1.0, rough=0.3)
    slot = mat_flat("slot18", (0.04, 0.04, 0.04))
    for k, z in enumerate((0.55, 0.78, 1.22, 1.42, 1.62, 1.84)):
        m = brass if k % 2 == 0 else steel
        cylinder(f"lock{k}", 0.042, 0.03, (0.84, -0.04, z), m, rot=(90, 0, 0), verts=20).parent = h
        box(f"lockslot{k}", (0.01, 0.006, 0.034), (0.84, -0.056, z), slot).parent = h
    box("chainplate", (0.05, 0.02, 0.12), (0.93, -0.035, 1.32), steel).parent = h
    for k in range(5):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.014, minor_radius=0.004, location=(0.9 - k * 0.025, -0.05, 1.3 - k * 0.012))
        t = bpy.context.object; t.rotation_euler = (math.radians(90), 0, math.radians(90 * (k % 2))); t.data.materials.append(steel); t.parent = h
    box("padlock", (0.07, 0.03, 0.06), (0.72, -0.06, 1.05), brass, bevel=0.008).parent = h
    bpy.ops.mesh.primitive_torus_add(major_radius=0.025, minor_radius=0.006, location=(0.72, -0.06, 1.1))
    t = bpy.context.object; t.rotation_euler = (math.radians(90), 0, 0); t.data.materials.append(steel); t.parent = h


def lei(ch):
    """Hawaiian flower necklace round the neck."""
    root = empty(f"lei_{ch.name}")
    cols = [mat_flat("leipink", (1.0, 0.35, 0.6), rough=0.7), mat_flat("leiyel", (1.0, 0.85, 0.2), rough=0.7),
            mat_flat("leiwht", (0.97, 0.97, 0.95), rough=0.7)]
    for k in range(18):
        a = k / 18.0 * 2 * math.pi
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.028,
                                              location=(0.135 * math.cos(a), 0.11 * math.sin(a), 0.0))
        o = bpy.context.object; o.data.materials.append(cols[k % 3]); o.parent = root
    bone = "Neck" if "Neck" in ch.rig.pose.bones else "Spine1"
    on_bone(ch, root, bone, (0.0, 0.0 if bone == "Neck" else 0.27, 0.03), rot=(-110, 0, 0))
    return root


def stone18(loc=(0, HY + 0.12, 0), name="stone"):
    """Episode 16's little headstone with Dale's correction: FINALLY crossed out, FOREVER <3."""
    root = empty(name, loc)
    m = mat_flat("stonem", (0.45, 0.45, 0.47), rough=0.85)
    box(f"{name}_slab", (0.46, 0.1, 0.42), (0, 0, 0.21), m, bevel=0.015).parent = root
    cylinder(f"{name}_top", 0.23, 0.1, (0, 0, 0.42), m, rot=(90, 0, 0), verts=32).parent = root
    decal(f"{name}_face", f"{D18}/stone_forever.png", 0.36, (0, -0.052, 0.37), rot=(90, 0, 0)).parent = root
    return root


# ============================================================================ sets
def window_room(x, w=1.4, h=1.3, z0=1.0, depth=2.0, energy=140, name="wroom"):
    """Cut a real window into episode 4's house front (y = 3.5) with a small lit room behind it: someone can stand
    in it (floor at ground level, sill at z0) and lean out. The painted window and its trim at that x are hidden."""
    house = bpy.data.objects["house"]
    hide(f"win{x}", f"wintrim{x}")
    cut1 = box(f"{name}_cut1", (w, 0.6, h), (x, 3.5, z0 + h / 2))
    cut2 = box(f"{name}_cut2", (w + 1.2, depth, 2.7), (x, 3.72 + depth / 2, 1.25))
    for c in (cut1, cut2):
        md = house.modifiers.new(c.name, "BOOLEAN"); md.object = c; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    ep6.bake_mods(house)
    for c in (cut1, cut2):
        bpy.data.objects.remove(c, do_unlink=True)
    lib._cube_uv(house, 0.4)
    trim = mat_flat("wframe18", (0.95, 0.95, 0.95))
    for nm, sz, lc in ((f"{name}_l", (0.07, 0.12, h + 0.1), (x - w / 2 - 0.03, 3.47, z0 + h / 2)),
                       (f"{name}_r", (0.07, 0.12, h + 0.1), (x + w / 2 + 0.03, 3.47, z0 + h / 2)),
                       (f"{name}_t", (w + 0.14, 0.12, 0.07), (x, 3.47, z0 + h + 0.03)),
                       (f"{name}_s", (w + 0.2, 0.18, 0.06), (x, 3.45, z0 - 0.03))):
        box(nm, sz, lc, trim)
    box(f"{name}_back", (w + 1.2, 0.05, 2.6), (x, 3.72 + depth - 0.02, 1.3),
        mat_tex(f"{name}_wall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.8, 0.7)), uv_scale=0.5)
    point(f"{name}_glow", (x, 3.72 + depth * 0.55, 2.2), energy=energy, color=(1.0, 0.8, 0.55), radius=0.3, shadow=True)


def bush(loc, seed=1, s=1.0):
    r = random.Random(seed)
    leaf = mat_flat("bush18", (0.08, 0.28, 0.08), rough=0.9)
    tx = bpy.data.textures.get("bush18") or bpy.data.textures.new("bush18", "CLOUDS"); tx.noise_scale = 0.2
    for k in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.38 * s,
                                              location=Vector(loc) + Vector((r.uniform(-0.4, 0.4), r.uniform(-0.1, 0.1), 0.25 * s)))
        o = bpy.context.object; o.scale = (1.2, 0.8, 0.9)
        md = o.modifiers.new("d", "DISPLACE"); md.texture = tx; md.strength = 0.12
        o.data.materials.append(leaf); bpy.ops.object.shade_smooth()


def table_day(tt=0.76):
    """A kitchen table in the morning light (close-up inserts)."""
    world_color((0.85, 0.88, 0.92), 0.45)
    sun(energy=1.8, rot=(40, 0, 25), color=(1.0, 0.95, 0.88))
    plane("kfloor", (8, 8), (0, 0, 0), mat_flat("kfloorm", (0.35, 0.3, 0.27)))
    box("ktable", (1.6, 1.0, 0.04), (0, 0.1, tt - 0.02), mat_flat("ktablem", (0.42, 0.26, 0.13), rough=0.45), bevel=0.01)
    plane("placemat", (0.44, 0.32), (0, 0.0, tt + 0.002), mat_flat("placematm", (0.12, 0.3, 0.55), rough=0.9))
    area("kwin", (-1.2, -1.0, 1.8), (0, 0, tt), energy=35, size=1.5, color=(1.0, 0.97, 0.92))
    return tt


def beach():
    """Another country: white sand, the turquoise sea behind (-X), two striped beach towels side by side, an umbrella."""
    world_color((0.5, 0.72, 1.0), 1.0)
    sun(energy=3.6, rot=(50, 0, 70), color=(1.0, 0.95, 0.85))
    plane("sand", (40, 60), (17.0, 0, 0), mat_tex("sand18", "coast_sand_01", scale=1.0, tint=(1.0, 0.9, 0.72)), uv_scale=0.3)
    plane("sea", (400, 600), (-203.0, 0, -0.03), ep6.water_mat())
    plane("foam", (0.45, 60), (-3.0, 0, 0.004), mat_flat("foam18", (0.95, 0.97, 1.0), rough=0.5))
    for k, (x, cols) in enumerate(((-0.45, ((0.95, 0.3, 0.45), (0.98, 0.95, 0.9))),
                                   (0.45, ((0.15, 0.5, 0.9), (0.98, 0.95, 0.9))))):
        for st in range(5):
            plane(f"towel{k}_{st}", (0.8, 0.38), (x, 0.14 + st * 0.38, 0.006 + 0.001 * k),
                  mat_flat(f"towel{k}{st % 2}", cols[st % 2], rough=0.95))
    ux, uy = -1.35, 1.5
    cylinder("umb_pole", 0.022, 2.3, (ux, uy, 1.15), mat_flat("umbpole", (0.9, 0.9, 0.9), metal=0.4), verts=12)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=1.15, depth=0.42, location=(ux, uy, 2.2))
    c = bpy.context.object; c.data.materials.append(mat_flat("umbcloth", (1.0, 0.35, 0.3), rough=0.7))
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=1.17, depth=0.12, location=(ux, uy, 2.03))
    c = bpy.context.object; c.data.materials.append(mat_flat("umbrim", (0.98, 0.98, 0.95), rough=0.7))


def on_lounger(ch, x):
    """Lying back on episode 11's sun lounger at (x, 0.5) (episode 11's sh09 numbers)."""
    ch.hold("137_41", 2800)
    ch.rig.rotation_euler = (math.radians(-58), 0, 0)
    ch.rig.location = (x, -0.45, 0.45)


def bed_on_legs(lift=0.2):
    """Episode 1's bed lifted onto tall legs (the solid base hidden) so there is room underneath."""
    o = bpy.data.objects.get("bed_frame")
    wood = o.data.materials[0] if (o and o.data.materials) else mat_flat("bedwood18", (0.35, 0.22, 0.12))
    hide("bed_frame")
    for nm in ("mattress", "pillow", "headboard"):
        p = bpy.data.objects.get(nm)
        if p:
            p.location.z += lift
    box("bed_slab", (1.7, 2.35, 0.06), (0, 0.98, 0.345 + lift), wood)
    for dx in (-0.8, 0.8):
        for dy in (-0.15, 2.1):
            box(f"bedleg{dx}{dy}", (0.07, 0.07, 0.32 + lift), (dx, dy, (0.32 + lift) / 2), wood)


def you_in_bed18():
    """Episode 1's sleeper (you_pj) under episode 4's duvet, pulled down to the chest, the left hand resting on top
    of the chest so it can move later. Returns (you, left hand target)."""
    you = ep1.you_in_bed()
    hide("blanket")
    t = empty("youhand", you.world("Spine1", frame=1) + Vector((0.14, 0.04, 0.12)))
    hand_ik(you, "Left", t)
    ep4.blanket_over(you, (-0.9, 0.9), (-0.16, 1.36), 0.59, fold_y=1.22, color=(0.14, 0.2, 0.5), half_w=0.815,
                     foot_y=-0.07)
    face(you, 1, SLEEP)
    return you, t


def dale_on_covers(sd=True, x=0.6):
    """Dale lying on top of the covers beside you (episode 16's in_bed_trio numbers), hands resting."""
    dale = dale_char(sd=sd)
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-86), 0, 0)
    dale.rig.location = (x, 0.08, 0.86)
    sp = dale.world("Spine1", frame=1)
    hold(dale, "Right", Vector((x - 0.32, sp.y - 0.3, 0.9)), name="dale_rhand")      # lying face up: right is -X
    hold(dale, "Left", sp + Vector((0.05, -0.36, 0.11)), name="dale_lhand")
    return dale


def bed_pair(sd=True):
    ep16.bedroom()
    you, ht = you_in_bed18()
    dale = dale_on_covers(sd=sd)
    look_keys(dale, empty("look_you", head(you) + Vector((0, 0, 0.05))), [(1, 0.8)])
    return you, ht, dale


def hug_target(dale):
    return dale.world("Spine1", frame=1) + Vector((-0.06, 0.06, 0.14))


def morning(f0=1, f1=1, level=1.0):
    """Dawn through the bedroom window: a warm low light that ramps up between f0 and f1 (f1 == 1: already morning)."""
    lt = area("dawn", (2.3, 0.5, 1.6), (0.2, 1.6, 0.8), energy=0, size=2.0, color=(1.0, 0.72, 0.45), shadow=False)
    full = 650 * level
    keys = [(1, full)] if f1 <= 1 else [(1, 0), (f0, 0), (f1, full)]
    for f, e in keys:
        lt.data.energy = e; lt.data.keyframe_insert("energy", frame=max(1, f))
    sky = bpy.data.objects.get("win_sky")
    if sky and sky.data.materials:
        nd = sky.data.materials[0].node_tree.nodes.get("Principled BSDF")
        if nd:
            ks = [(1, (1.0, 0.7, 0.4, 1), 2.0)] if f1 <= 1 else [(1, (0.3, 0.4, 0.9, 1), 0.7),
                                                                  (f0, (0.3, 0.4, 0.9, 1), 0.7),
                                                                  (f1, (1.0, 0.7, 0.4, 1), 2.0)]
            for f, c, s in ks:
                nd.inputs["Emission Color"].default_value = c
                nd.inputs["Emission Color"].keyframe_insert("default_value", frame=max(1, f))
                nd.inputs["Emission Strength"].default_value = s
                nd.inputs["Emission Strength"].keyframe_insert("default_value", frame=max(1, f))
    if f1 <= 1:
        hide("moon")
    return lt


def clear_table(keep=()):
    """Hide episode 17's family-dinner clutter (plates, glasses, peas, the roast, the mash) except at the seats in keep."""
    keep_pts = []
    for nm in keep:
        x, y, f = ep17.SEATS[nm]
        d = Vector((math.sin(math.radians(f)), -math.cos(math.radians(f)), 0))
        p = Vector((x, y, 0)) + d * 0.42
        keep_pts.append(Vector((max(-0.95, min(0.95, p.x)), max(0.57, min(1.33, p.y)))))
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            continue
        mats = [m.name for m in o.data.materials if m]
        clutter = o.name.startswith(("plate_", "glass_", "platter", "mash_bowl")) or \
            any(m.startswith(("peas", "roast", "mash")) for m in mats)
        if not clutter:
            continue
        if any((Vector((o.location.x, o.location.y)) - k).length < 0.2 for k in keep_pts):
            continue
        o.hide_render = True; o.hide_viewport = True


def dim_dinner(top=90, fill=50, candle=30, room=1.0):
    for nm, e in (("dinner_top", top), ("dinner_fill", fill), ("candlelight", candle), ("fill", 90 * room),
                  ("bedkey", 40 * room)):
        o = bpy.data.objects.get(nm)
        if o:
            o.data.energy = e


def roller_case(loc, color=(0.45, 0.12, 0.35), name="roller"):
    """Big wheeled suitcase standing on the floor, telescopic handle up at hand height (origin on the floor)."""
    root = empty(name, loc)
    m = mat_flat(f"{name}_m", color, rough=0.45)
    box(f"{name}_body", (0.42, 0.24, 0.62), (0, 0, 0.37), m, bevel=0.03).parent = root
    dark = mat_flat("rollerdark", (0.06, 0.06, 0.06), rough=0.5)
    rod = mat_flat("rollerrod", (0.7, 0.7, 0.72), metal=0.8, rough=0.3)
    for k, dx in enumerate((-0.15, 0.15)):
        cylinder(f"{name}_wheel{k}", 0.03, 0.03, (dx, 0.08, 0.03), dark, rot=(0, 90, 0), verts=12).parent = root
        box(f"{name}_rod{k}", (0.015, 0.015, 0.32), (dx * 0.5, 0.1, 0.83), rod).parent = root
    box(f"{name}_grip", (0.17, 0.025, 0.025), (0, 0.1, 0.99), dark).parent = root
    return root


def over(n, center, height=1.75, back=0.45, lens=35, drift=0.08):
    """Overhead camera on people lying down (image up = toward their heads, so faces read upright)."""
    c = Vector(center)
    a = c + Vector((0, -back, height))
    b = c + Vector((0, -back + drift * 0.5, height - drift))
    cam = Cam(lens=lens, loc=tuple(a), target=tuple(c))
    cam.key(1, loc=tuple(a)); cam.key(n, loc=tuple(b))
    return cam


def on_towel(ch, x):
    """Lying flat on your back on a beach towel, head toward +Y (the bed numbers, on the sand)."""
    ch.hold("137_41", 2800)
    ch.rig.rotation_euler = (math.radians(-86), 0, 0)
    ch.rig.location = (x, 0.08, 0.12)


# ============================================================================ SHOTS: you are Dale
@shot
def sh01():
    """You are DALE. - close on Dale in your living room, melting with love; hearts pop round his head."""
    n = frames_of("sh01")
    closeup()
    ep15.living_room()
    dale = dale_char((0.0, 0.9, 0), rot_z=0)
    idle(dale, n)
    face(dale, 1, LOVE); blink(dale, [22])
    hd = head(dale)
    cam = Cam(lens=50, loc=(0.14, -0.55, hd.z + 0.08), target=(0.0, 0.9, hd.z - 0.04))
    cam.key(1, loc=(0.14, -0.55, hd.z + 0.08)); cam.key(n, loc=(0.1, -0.3, hd.z + 0.06))
    face_light(cam, energy=18, size=1.0)
    hearts(cam, hd + Vector((0, -0.08, 0.2)), n, count=6, f0=3, seed=1, size=0.08, spread=(0.22, 0.12))
    return n


@shot
def sh02():
    """And you love your baby SO much. - your couch: Dale snuggled right up against you, gazing at you, hearts
    popping; you stare straight ahead, dead inside."""
    n = frames_of("sh02")
    closeup()
    ep15.living_room()
    you = you_char()
    ep15.couch_sit(you, -0.32)
    dale = dale_char()
    ep15.couch_sit(dale, 0.1)
    look_keys(dale, you, [(1, 0.9)])
    face(dale, 1, SNUG); face(you, 1, DEADPAN); blink(you, [34])
    cam = Cam(lens=35, loc=(-0.12, -0.2, 1.18), target=(-0.12, 2.1, 0.98))
    cam.key(1, loc=(-0.12, -0.2, 1.18)); cam.key(n, loc=(-0.12, 0.15, 1.15))
    face_light(cam, energy=16, size=1.2)
    hearts(cam, head(dale) + Vector((0.05, -0.05, 0.25)), n, count=8, f0=3, seed=2, size=0.1, spread=(0.3, 0.2))
    return n


@shot
def sh03():
    """But your baby HATES you. - Dale's point of view, right up against you on the couch: you turn your head and
    give him the dirtiest look of all time."""
    n = frames_of("sh03")
    closeup()
    ep15.living_room()
    you = you_char()
    ep15.couch_sit(you, -0.34)
    hy = head(you)
    eye = Vector((0.12, hy.y - 0.32, hy.z + 0.02))                            # where Dale's head is
    look_keys(you, empty("dalepov", eye), [(1, 0.0), (8, 0.0), (17, 0.95)])
    face(you, 1, DEADPAN); face(you, 13, GROSSED); blink(you, [36])
    end = eye + (hy - eye) * 0.15
    cam = Cam(lens=40, loc=tuple(eye), target=tuple(hy + Vector((0.0, 0.0, -0.03))))
    cam.key(1, loc=tuple(eye)); cam.key(n, loc=tuple(end))
    face_light(cam, energy=18, size=1.0)
    return n


# ============================================================================ SHOTS: the love letter
@shot
def sh04():
    """So you write him a love letter. - late at night by candlelight: Dale at the table, tongue out, scribbling."""
    n = frames_of("sh04")
    closeup()
    ep17.dining_room()
    clear_table()
    dim_dinner(top=60, fill=35, candle=15, room=0.6)
    dale = dale_char()
    ep17.seat(dale, "crush", hands_on_table=False)
    lx, ly = 0.38, 1.62 - 0.38
    decal("letter", f"{D18}/letter.png", 0.2, (lx, ly, TOP_Z + 0.009), rot=(0, 0, 0), rough=1.0)
    hold(dale, "Left", (lx + 0.16, ly + 0.03, TOP_Z + 0.03), name="letter_hold")  # facing -Y: left is +X
    w = empty("write")
    for k, f in enumerate(range(1, n + 3, 3)):
        key_loc(w, f, (lx - 0.05 + 0.03 * ((k % 4) / 3.0), ly - 0.03 - 0.004 * (k // 4) + (0.01 if k % 2 else 0.0),
                       TOP_Z + 0.04 + (0.012 if k % 2 else 0.0)))
    hand_ik(dale, "Right", w)
    on_bone(dale, pen_prop(), "RightHand", (0.0, 0.07, 0.02), rot=(0, 0, 0))
    face(dale, 1, dict(LOVE, tongueOut=0.45, jawOpen=0.12))
    look_at(dale, empty("look_letter", (lx, ly, TOP_Z)), 0.55)
    cam = Cam(lens=34, loc=(0.6, 0.1, 1.45), target=(0.38, 1.45, 1.08))
    cam.key(1, loc=(0.6, 0.1, 1.45)); cam.key(n, loc=(0.57, 0.28, 1.42))
    face_light(cam, energy=22, size=1.0, color=(1.0, 0.85, 0.7))
    hearts(cam, head(dale) + Vector((0, -0.05, 0.28)), n, count=5, f0=5, seed=4, size=0.09, emit=0.3)
    return n


@shot
def sh05():
    """ROMANTIC! - top-down on the letter by candlelight; a big lipstick kiss smacks onto it."""
    n = frames_of("sh05")
    ep17.dining_room()
    clear_table()
    dim_dinner(top=25, fill=15, candle=5, room=0.3)
    lx, ly = 0.3, 0.72
    decal("letter", f"{D18}/letter.png", 0.2, (lx, ly, TOP_Z + 0.009), rot=(0, 0, 0), rough=1.0)
    k = decal("kiss", f"{D18}/kiss.png", 0.06, (lx + 0.072, ly - 0.09, TOP_Z + 0.011), rot=(0, 0, 0), alpha=True, rough=1.0)
    key_scale(k, 1, 0.0, interp="CONSTANT"); key_scale(k, 5, 0.0, interp="CONSTANT")
    key_scale(k, 8, 1.3); key_scale(k, 11, 1.0)
    pen = pen_prop(); pen.location = (lx - 0.14, ly - 0.02, TOP_Z + 0.014); pen.rotation_euler = (0, 0, math.radians(-20))
    cam = Cam(lens=50, loc=(lx + 0.05, ly - 0.24, TOP_Z + 0.56), target=(lx, ly + 0.01, TOP_Z))
    cam.key(1, loc=(lx + 0.05, ly - 0.24, TOP_Z + 0.56)); cam.key(n, loc=(lx + 0.04, ly - 0.19, TOP_Z + 0.47))
    cam.shake(7, 12, amp=0.004, freq=0.6)
    area("letterkey", (lx - 0.3, ly - 0.4, TOP_Z + 0.8), (lx, ly, TOP_Z), energy=6, size=0.6, color=(1.0, 0.85, 0.7))
    return n


@shot
def sh06():
    """But he BURNS it. - on his front lawn, dead-eyed, he drops the letter into a flaming trash can."""
    n = frames_of("sh06")
    closeup()
    ep4.house_exterior(night=False, chimney=False)
    bx, by = 1.0, 1.35
    trash_bin((bx, by, 0))
    you = you_char((bx + 0.05, by + 0.45, 0), rot_z=0)
    idle(you, n)
    rel = 9
    t = empty("burnhand")
    for f, p in ((1, (bx - 0.04, by + 0.06, 1.1)), (rel, (bx - 0.04, by + 0.06, 1.1)),
                 (rel + 7, (bx - 0.22, by + 0.36, 0.86)), (n, (bx - 0.22, by + 0.38, 0.84))):
        key_loc(t, f, p)
    hand_ik(you, "Right", t)                                                  # facing -Y: right is -X
    lt = decal("letter", f"{D18}/letter.png", 0.15, (0, 0, 0), rot=(90, 0, 0))
    for f, p, r in ((1, (bx - 0.04, by + 0.03, 0.98), (90, 0, 0)), (rel, (bx - 0.04, by + 0.03, 0.98), (90, 0, 0)),
                    (rel + 7, (bx, by, 0.6), (30, 40, 60))):
        key_loc(lt, f, p); key_rot(lt, f, r)
    lib.hide_after(lt, rel + 8)
    fire((bx, by, 0.66), rel + 5, n, scale=1.6, seed=3)
    face(you, 1, DEADPAN); face(you, rel + 9, SMUG); blink(you, [20])
    cam = Cam(lens=32, loc=(bx - 0.45, by - 2.7, 1.6), target=(bx, by + 0.35, 1.05))
    cam.key(1, loc=(bx - 0.45, by - 2.7, 1.6)); cam.key(n, loc=(bx - 0.4, by - 2.45, 1.55))
    face_light(cam, energy=14, size=1.0)
    return n


@shot
def sh07():
    """So you write it on his car. - his car at the kerb, I <3 U BABY sprayed down the side in hot pink; Dale beside
    it with the can, so proud."""
    n = frames_of("sh07")
    closeup()
    ep11.day_street()
    car = ep6.Car("hiscar", "family", (0.08, 0.3, 0.72))
    car.root.location = (1.2, -4.6, 0)
    w2 = car.P["W"] / 2
    decal("carpaint", f"{D18}/car_paint.png", 2.3, (1.15, -4.6 + w2 + 0.025, 0.7), rot=(90, 0, 180), alpha=True)
    dx, dy = -0.6, -3.3
    dale = dale_char((dx, dy, 0), rot_z=213)
    idle(dale, n)
    t = empty("canhand")
    key_loc(t, 1, (dx + 0.36, dy + 0.2, 1.25)); key_loc(t, 10, (dx + 0.4, dy + 0.24, 1.42)); key_loc(t, n, (dx + 0.39, dy + 0.23, 1.4))
    hand_ik(dale, "Right", t)                                                 # facing the camera: right is +X-ish
    on_bone(dale, spray_can(), "RightHand", (0.0, 0.07, 0.03), rot=(0, 0, 90))
    face(dale, 1, BEAM); blink(dale, [24])
    cam = Cam(lens=26, loc=(-2.3, -0.7, 1.5), target=(0.7, -3.75, 0.95))
    cam.key(1, loc=(-2.3, -0.7, 1.5)); cam.key(n, loc=(-2.1, -0.9, 1.48))
    face_light(cam, energy=14, size=1.2)
    hearts(cam, head(dale) + Vector((0, 0.05, 0.28)), n, count=4, f0=6, seed=7, size=0.12)
    return n


@shot
def sh08():
    """In his cereal. - top-down into his breakfast bowl: the cereal O's spell I <3 U."""
    n = frames_of("sh08")
    tt = table_day()
    b = ep16.cereal_bowl("bowl")
    b.location = (0, 0, tt)
    for c in b.children:
        if c.data and c.data.materials and c.data.materials[0].name.startswith("flake"):
            c.hide_render = True; c.hide_viewport = True
    cylinder("milk18", 0.073, 0.002, (0, 0, tt + 0.066), mat_flat("milk18m", (0.97, 0.94, 0.86), rough=0.4), verts=32)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.078, minor_radius=0.006, location=(0, 0, tt + 0.066))
    rim = bpy.context.object; rim.data.materials.append(mat_flat("ceramic18", (0.95, 0.95, 0.96), rough=0.25))
    decal("cereal_txt", f"{D18}/cereal_text.png", 0.125, (0, 0, tt + 0.0675), rot=(0, 0, 0), alpha=True, rough=1.0)
    sp = ep16.spoon("spoon"); sp.location = (0.13, -0.02, tt + 0.006); sp.rotation_euler = (0, 0, math.radians(80))
    cam = Cam(lens=50, loc=(0.0, -0.14, tt + 0.56), target=(0.0, 0.0, tt + 0.06))
    cam.key(1, loc=(0.0, -0.14, tt + 0.56)); cam.key(n, loc=(0.0, -0.11, tt + 0.47))
    return n


@shot
def sh09():
    """In the SKY! - out on his lawn he looks up: I <3 U BABY written across the sky in smoke, the little plane
    still writing."""
    n = frames_of("sh09")
    closeup()
    ep11.day_street()
    you = you_char((0.7, -1.4, 0), rot_z=180)
    idle(you, n)
    look_at(you, empty("skylook", (0.0, 60.0, 40.0)), 0.8)
    decal("skytext", f"{D18}/sky_text.png", 62.0, (-4.0, 72.0, 31.0), rot=(90, 0, 0), emit=1.2, alpha=True)
    pl = empty("plane18")
    grey = mat_flat("plane18m", (0.85, 0.86, 0.9), metal=0.4, rough=0.3)
    cylinder("fuselage", 0.45, 4.0, (0, 0, 0), grey, rot=(0, 90, 0), verts=16).parent = pl
    box("wings", (1.1, 6.0, 0.1), (0.1, 0, 0), grey).parent = pl
    box("tail", (0.7, 0.08, 1.1), (-1.8, 0, 0.5), grey).parent = pl
    key_loc(pl, 1, (28.0, 72.0, 33.0)); key_loc(pl, n, (33.0, 72.0, 34.0))
    cam = Cam(lens=24, loc=(1.15, -3.3, 0.95), target=(0.6, 8.0, 5.0), clip_end=3000)
    cam.key(1, target=(0.6, 8.0, 5.0)); cam.key(18, target=(-1.0, 60.0, 26.0)); cam.key(n, target=(-1.0, 60.0, 27.0))
    return n


@shot
def sh10():
    """He finally writes back. - Dale at his mailbox, an envelope in both hands, bouncing on his toes."""
    n = frames_of("sh10")
    closeup()
    ep4.house_exterior(night=False, chimney=False)
    mailbox((2.0, 1.0, 0))
    dale = dale_char((1.35, 1.15, 0), rot_z=0)
    idle(dale, n)
    piv = rocker(dale, at="floor")
    yaw = piv.parent
    y0 = yaw.location.copy()
    c = dale.world("Spine1", frame=1)
    base = Vector((1.35, 1.15 - 0.3, c.z - 0.02))
    env = envelope(); env.location = base
    glue(env, piv)
    for side, dx in (("Left", 0.1), ("Right", -0.1)):                         # facing -Y: left is +X
        hold(dale, side, base + Vector((dx, 0.02, 0.0)), piv=piv, name=f"env_{side}")
    for k, f in enumerate(range(1, n + 2, 6)):
        key_loc(yaw, f, y0 + Vector((0, 0, 0.05 if k % 2 else 0.0)))
    face(dale, 1, BEAM); blink(dale, [30])
    cam = Cam(lens=34, loc=(1.05, -1.3, 1.45), target=(1.4, 1.1, 1.3))
    cam.key(1, loc=(1.05, -1.3, 1.45)); cam.key(n, loc=(1.1, -1.05, 1.42))
    face_light(cam, energy=14, size=1.0)
    hearts(cam, head(dale) + Vector((0, -0.05, 0.28)), n, count=6, f0=4, seed=10, size=0.1)
    return n


@shot
def sh11():
    """"LEAVE ME ALONE." - the reply itself: angry black marker on a page torn out of a notebook."""
    n = frames_of("sh11")
    tt = table_day()
    decal("note", f"{D18}/note_leave.png", 0.21, (0, 0.02, tt + 0.003), rot=(0, 0, 2))
    cam = Cam(lens=50, loc=(0.0, -0.2, tt + 0.62), target=(0, 0.03, tt))
    cam.key(1, loc=(0.0, -0.2, tt + 0.62)); cam.key(n, loc=(0.0, -0.15, tt + 0.52))
    cam.shake(12, 20, amp=0.003, freq=0.7)
    return n


@shot
def sh12():
    """He wrote BACK! - Dale clutches the note to his chest and sways, eyes shut, in heaven; hearts everywhere."""
    n = frames_of("sh12")
    closeup()
    ep4.house_exterior(night=False, chimney=False)
    dale = dale_char((1.35, 1.15, 0), rot_z=0)
    idle(dale, n)
    piv = rocker(dale, at="floor")
    c = dale.world("Spine1", frame=1)
    note = decal("note", f"{D18}/note_leave.png", 0.19, c + Vector((0, -0.25, -0.03)), rot=(90, 0, 0))
    glue(note, piv)
    for side, dx in (("Left", 0.09), ("Right", -0.09)):
        hold(dale, side, c + Vector((dx, -0.26, 0.0)), piv=piv, name=f"hug_{side}")
    yaw = piv.parent
    z0 = yaw.rotation_euler.z
    for k, f in enumerate(range(1, n + 2, 8)):
        yaw.rotation_euler = (0, 0, z0 + math.radians(16 if k % 2 else -16)); yaw.keyframe_insert("rotation_euler", frame=f)
    face(dale, 1, dict(SNUG, mouthSmileLeft=1.0, mouthSmileRight=1.0))
    cam = Cam(lens=40, loc=(1.15, -0.9, 1.5), target=(1.35, 1.15, 1.4))
    cam.key(1, loc=(1.15, -0.9, 1.5)); cam.key(n, loc=(1.17, -0.7, 1.48))
    face_light(cam, energy=14, size=1.0)
    hearts(cam, head(dale) + Vector((0, -0.05, 0.2)), n, count=8, f0=1, seed=12, size=0.1, spread=(0.45, 0.4))
    return n


# ============================================================================ SHOTS: the serenade
def singer(n, loc=(2.6, 1.9, 0), arms=True):
    """Dale on the lawn under the window, facing the house, singing (eyes shut, jaw going), arms flung wide."""
    dale = dale_char(loc, rot_z=180)
    idle(dale, n)
    piv = rocker(dale, at="floor")
    if arms:
        for side, dx in (("Left", -0.62), ("Right", 0.62)):                   # facing +Y: left is -X
            hold(dale, side, (loc[0] + dx, loc[1] + 0.2, 1.55), piv=piv, name=f"sing_{side}")
    face(dale, 1, SING)
    for f in range(1, n + 1, 4):
        dale.expr(f, {"jawOpen": 0.75 if (f // 4) % 2 == 0 else 0.35})
    look_at(dale, empty("winlook", (2.8, 3.6, 2.2)), 0.7)
    return dale, piv


def night_house(window=True):
    ep4.house_exterior(night=True, chimney=False)
    if window:
        window_room(2.8)


@shot
def sh13():
    """So you sing under his window. - night: Dale on the lawn under the lit window, arms flung wide, serenading."""
    n = frames_of("sh13")
    closeup()
    night_house()
    dale, piv = singer(n)
    cam = Cam(lens=26, loc=(4.8, 1.0, 1.15), target=(2.5, 2.55, 1.62))
    cam.key(1, loc=(4.8, 1.0, 1.15)); cam.key(n, loc=(4.7, 1.08, 1.17))
    face_light(cam, energy=30, size=1.2, color=NIGHT)
    notes(cam, head(dale) + Vector((0, 0.1, 0.25)), n, count=6, seed=13)
    return n


@shot
def sh14():
    """ADORABLE! - close on Dale belting it out to the window, eyes shut, music notes floating up."""
    n = frames_of("sh14")
    closeup()
    night_house()
    dale, piv = singer(n)
    hd = head(dale)
    cam = Cam(lens=40, loc=tuple(hd + Vector((0.2, 0.95, 0.25))), target=tuple(hd + Vector((0, 0, -0.05))))
    cam.key(1, loc=tuple(hd + Vector((0.2, 0.95, 0.25)))); cam.key(n, loc=tuple(hd + Vector((0.18, 0.8, 0.22))))
    face_light(cam, energy=30, size=1.0, color=NIGHT)
    notes(cam, hd + Vector((0, 0.1, 0.22)), n, count=6, seed=14, size=0.1)
    return n


@shot
def sh15():
    """But he throws his SHOE at you. - up at the lit window: he leans out, furious, and hurls a sneaker at Dale,
    whose head pops into the corner of the frame - and takes the hit."""
    n = frames_of("sh15")
    closeup()
    night_house()
    dale, dpiv = singer(n, arms=False)
    you = load_char("you_night", (2.8, 3.95, 0), rot_z=0, subdiv=True, tag="you")
    idle(you, n)
    piv = rocker(you, at="hips")
    rock(piv, [(1, 8.0), (10, 5.0), (17, 20.0), (n, 16.0)])
    hold(you, "Left", (2.8 + 0.32, 3.45, 1.06), piv=piv, name="sill_L")       # facing -Y: left is +X
    rel, hit = 16, 26
    keys = [(1, Vector((2.6, 3.95, 1.8))), (10, Vector((2.58, 4.08, 1.98))), (rel, Vector((2.64, 3.35, 1.74)))]
    t = empty("throw")
    for f, p in keys + [(rel + 4, Vector((2.66, 3.25, 1.48))), (n, Vector((2.64, 3.3, 1.38)))]:
        key_loc(t, f, p, interp="LINEAR")
    hand_ik(you, "Right", t)
    face(you, 1, RAGE)
    shoe = shoe_prop()
    off = Vector((0, 0, -0.05))
    for f, p in keys:
        key_loc(shoe, f, p + off, interp="LINEAR")
    tgt = head(dale) + Vector((0.0, 0.06, 0.04))
    p_rel = keys[-1][1] + off
    mid = (p_rel + tgt) / 2 + Vector((0, 0, 0.18))
    key_loc(shoe, (rel + hit) // 2, mid, interp="LINEAR"); key_loc(shoe, hit, tgt, interp="LINEAR")
    key_loc(shoe, hit + 6, tgt + Vector((0.25, -0.25, 0.35))); key_loc(shoe, n, Vector((3.0, 1.4, 0.06)))
    key_rot(shoe, 1, (0, 0, 0)); key_rot(shoe, rel, (0, 0, 0)); key_rot(shoe, hit, (540, 0, 120)); key_rot(shoe, n, (900, 30, 200))
    rock(dpiv, [(1, 0.0), (hit, 0.0), (hit + 3, -14.0), (hit + 10, -5.0), (n, -4.0)])
    face(dale, hit, dict(DAZED, eyeBlinkLeft=1.0, eyeBlinkRight=0.9, jawOpen=0.3))
    cam = Cam(lens=20, loc=(3.6, 0.7, 1.0), target=(2.75, 3.3, 1.75))
    cam.key(1, loc=(3.6, 0.7, 1.0)); cam.key(n, loc=(3.55, 0.85, 1.02))
    cam.shake(hit, hit + 6, amp=0.03, freq=0.6)
    face_light(cam, energy=30, size=1.2, color=NIGHT)
    return n


@shot
def sh16():
    """A GIFT! - Dale holds the sneaker up to the moon like a trophy, overjoyed."""
    n = frames_of("sh16")
    closeup()
    night_house()
    dale = dale_char((2.6, 1.9, 0), rot_z=12)
    idle(dale, n)
    hd = head(dale)
    t = empty("trophy")
    key_loc(t, 1, hd + Vector((-0.22, -0.05, 0.12))); key_loc(t, 6, hd + Vector((-0.24, -0.1, 0.42)))
    key_loc(t, n, hd + Vector((-0.24, -0.1, 0.45)))
    hand_ik(dale, "Right", t)                                                 # facing ~-Y: right is -X
    shoe = shoe_prop(); shoe.parent = t; shoe.location = (0, 0, 0.05); shoe.rotation_euler = (math.radians(-25), 0, math.radians(80))
    face(dale, 1, BEAM)
    look_at(dale, empty("shoelook", hd + Vector((-0.3, -0.3, 0.9))), 0.55)
    cam = Cam(lens=28, loc=(2.95, 0.3, 1.35), target=(2.6, 1.9, 1.75))
    cam.key(1, loc=(2.95, 0.3, 1.35)); cam.key(n, loc=(2.92, 0.45, 1.36))
    face_light(cam, energy=34, size=1.2, color=NIGHT)
    hearts(cam, hd + Vector((-0.2, -0.1, 0.55)), n, count=5, f0=4, seed=16, size=0.09, emit=0.3)
    return n


@shot
def sh17():
    """Now you sleep with it. - Dale tucked up in bed, cuddling the sneaker like a teddy bear, smiling in his sleep."""
    n = frames_of("sh17")
    closeup()
    ep16.bedroom()
    hide("blanket")
    dale = dale_char()
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-86), 0, 0)
    dale.rig.location = (0.0, 0.08, 0.7)
    chest = dale.world("Spine1", frame=1) + Vector((0, -0.16, 0.16))
    shoe = shoe_prop(); shoe.location = chest; shoe.rotation_euler = (0, math.radians(-12), 0)
    for side, dx in (("Left", 0.1), ("Right", -0.1)):                         # lying face up, head +Y: left is +X
        hold(dale, side, chest + Vector((dx, 0.0, 0.05)), name=f"cuddle_{side}")
    ep4.blanket_over(dale, (-0.9, 0.9), (-0.16, 1.2), 0.59, fold_y=1.08, color=(0.14, 0.2, 0.5), half_w=0.815,
                     foot_y=-0.07)
    face(dale, 1, SLEEP_SMILE)
    hd = head(dale)
    cam = over(n, hd + Vector((0.0, -0.3, 0.0)), height=1.15, back=0.35, lens=35)
    face_light(cam, energy=36, size=1.4, color=NIGHT)
    floaters(cam, f"{D18}/zzz.png", hd + Vector((0.18, 0.05, 0.25)), n, count=3, size=0.12, seed=17, emit=0.4,
             spread=(0.12, 0.08), name="zzz")
    return n


# ============================================================================ SHOTS: dinner and the getaway car
@shot
def sh18():
    """So you cook him dinner. - candlelit table, roses; Dale in a KISS THE COOK apron presents it like a game-show
    host."""
    n = frames_of("sh18")
    closeup()
    ep17.dining_room()
    clear_table(keep=("you", "crush"))
    dim_dinner(top=110, fill=60)
    roses((-0.6, 0.95, TOP_Z))
    dale = dale_char((0.25, 1.78, 0), rot_z=0)
    idle(dale, n)
    ep2.chest_print(dale, f"{D18}/apron_kiss.png", width=0.48, y=-0.04, z=0.31, name="apron")
    for side, dx in (("Left", 0.55), ("Right", -0.55)):
        t = empty(f"tada_{side}")
        key_loc(t, 1, (0.25 + dx * 0.35, 1.58, 1.0)); key_loc(t, 7, (0.25 + dx, 1.58, 1.18)); key_loc(t, n, (0.25 + dx, 1.58, 1.2))
        hand_ik(dale, side, t)
    face(dale, 1, BEAM); face(dale, 7, dict(TADA, mouthSmileLeft=1.0, mouthSmileRight=1.0))
    cam = Cam(lens=35, loc=(0.3, -0.55, 1.5), target=(0.2, 1.4, 1.2))
    cam.key(1, loc=(0.3, -0.55, 1.5)); cam.key(n, loc=(0.28, -0.35, 1.48))
    face_light(cam, energy=18, size=1.2, color=WARM)
    hearts(cam, head(dale) + Vector((0, -0.05, 0.3)), n, count=5, f0=6, seed=18, size=0.1, emit=0.3)
    return n


@shot
def sh19():
    """SO SWEET! - close on his plate: a ketchup heart, the candles glowing behind it, roses."""
    n = frames_of("sh19")
    ep17.dining_room()
    clear_table(keep=("boy",))
    dim_dinner(top=25, fill=15, candle=12, room=0.3)
    roses((-0.3, 0.95, TOP_Z))
    px, py = 0.42, 0.70                                                        # the near-side plate (the kid's seat)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and (o.location - Vector((px + 0.02, py, TOP_Z + 0.028))).length < 0.03:
            o.hide_render = True; o.hide_viewport = True                       # the peas
    decal("ketchup", f"{D18}/heart_red.png", 0.12, (px, py, TOP_Z + 0.024), rot=(0, 0, 0), alpha=True, rough=1.0)
    cam = Cam(lens=40, loc=(px + 0.16, py - 0.48, TOP_Z + 0.32), target=(0.3, 0.8, TOP_Z + 0.06))
    cam.key(1, loc=(px + 0.16, py - 0.48, TOP_Z + 0.32)); cam.key(n, loc=(px + 0.14, py - 0.4, TOP_Z + 0.28))
    area("platekey", (px + 0.3, py - 0.5, TOP_Z + 0.7), (px, py, TOP_Z), energy=3, size=0.6, color=WARM)
    return n


@shot
def sh20():
    """But he climbs out the bathroom WINDOW. - outside at night: he squeezes head-first out of the little bathroom
    window, wriggles, and drops into the bush."""
    n = frames_of("sh20")
    closeup()
    ep4.house_exterior(night=True, chimney=False)
    window_room(-2.8, w=0.9, h=0.8, z0=1.3, energy=90, name="bathwin")
    bush((-2.8, 3.05, 0), seed=3, s=0.9)
    you = you_char((-2.8, 4.0, 0.35), rot_z=0)
    you.hold("137_28", 3700)
    piv = rocker(you, at="hips")
    hd = head(you)
    for side, dx in (("Left", 0.16), ("Right", -0.16)):                       # arms up over the head -> reaching out
        hold(you, side, hd + Vector((dx, -0.05, 0.38)), piv=piv, name=f"reach_{side}")
    yaw = piv.parent
    y0 = yaw.location.copy()
    rock(piv, [(1, 86.0), (10, 93.0), (18, 85.0), (26, 94.0), (34, 88.0), (40, 98.0), (46, 140.0), (n, 160.0)])
    for f, d in ((1, (0, 0, 0)), (34, (0, -0.42, 0)), (42, (0, -0.6, -0.05)), (n, (0, -0.85, -0.75))):
        key_loc(yaw, f, y0 + Vector(d))
    face(you, 1, DETERMINED); face(you, 41, SHOCK)
    cam = Cam(lens=34, loc=(-1.6, 0.9, 1.05), target=(-2.75, 3.4, 1.2))
    cam.key(1, loc=(-1.6, 0.9, 1.05)); cam.key(n, loc=(-1.68, 1.05, 1.0))
    face_light(cam, energy=30, size=1.2, color=NIGHT)
    return n


def getaway(n, hands="wheel"):
    """Dale's pink getaway sedan parked in the street at night, engine running, Dale behind the wheel in shades."""
    ep4.house_exterior(night=True, chimney=False)
    car = ep6.Car("getaway", "sedan", (0.85, 0.12, 0.4), windows_down=True)
    dale = dale_char(sd=True)
    car.seat_char(dale, 0, hands=hands)
    ep6.wear_shades(dale)
    base = Vector((-1.6, -4.4, 0))
    for f in range(1, n + 2, 2):
        key_loc(car.root, f, base + Vector((0, 0, 0.004 if (f // 2) % 2 else 0.0)))
    point("streetglow", (-0.4, -3.0, 3.4), energy=420, color=(1.0, 0.8, 0.5), radius=0.3, shadow=True)
    return car, dale


@shot
def sh21():
    """So you wait in the getaway car. - parked outside at night, engine running: Dale behind the wheel in shades,
    grinning out of the open window."""
    n = frames_of("sh21")
    closeup()
    car, dale = getaway(n)
    hd = head(dale)
    camp = hd + Vector((0.75, 1.75, 0.1))
    look_keys(dale, empty("look_cam21", camp), [(1, 0.65)])
    face(dale, 1, GRIN)
    cam = Cam(lens=32, loc=tuple(camp), target=tuple(hd + Vector((0.05, 0.0, -0.18))))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.1, -0.2, 0.0))))
    face_light(cam, energy=30, size=1.2, color=NIGHT)
    return n


@shot
def sh22():
    """With DESSERT. - through the open window: Dale proudly holds up a little cake."""
    n = frames_of("sh22")
    closeup()
    car, dale = getaway(n, hands="lap")
    hd = head(dale)
    ck = Vector((hd.x + 0.22, hd.y + 0.33, hd.z - 0.3))
    cake = ep14.cake(ck, name="cake18")
    cake.scale = (0.5, 0.5, 0.5)
    key_loc(cake, 1, ck); key_loc(cake, 6, ck + Vector((0, 0.03, 0.06))); key_loc(cake, n, ck + Vector((0, 0.03, 0.07)))
    for side, dx in (("Left", 0.09), ("Right", -0.09)):                       # facing +X: left is +Y
        t = empty(f"cake_{side}")
        t.parent = cake; t.location = (0.0, dx * 1.3 / 0.5, 0.05 / 0.5)
        reik(dale, side, t)
    camp = hd + Vector((0.6, 2.0, 0.0))
    look_keys(dale, empty("look_cam22", camp), [(1, 0.7)])
    face(dale, 1, BEAM)
    cam = Cam(lens=35, loc=tuple(camp), target=tuple(hd + Vector((0.08, 0.15, -0.15))))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.03, -0.15, -0.01))))
    face_light(cam, energy=30, size=1.0, color=NIGHT)
    hearts(cam, ck + Vector((0, 0, 0.32)), n, count=4, f0=4, seed=22, size=0.08, emit=0.3)
    return n


# ============================================================================ SHOTS: moving in
@shot
def sh23():
    """He changes the LOCKS. - Dale at your front door with his key: six brand-new locks. He freezes, wounded."""
    n = frames_of("sh23")
    closeup()
    h = ep15.front_door()
    door_locks(h)
    dale = dale_char((-0.12, 2.95, 0), rot_z=180)
    idle(dale, n)
    k = empty("keyhand")
    for f, p in ((1, (0.2, 3.2, 1.05)), (8, (0.28, 3.4, 1.04)), (13, (0.3, 3.38, 1.06)), (18, (0.28, 3.41, 1.03)),
                 (n, (0.22, 3.2, 1.0))):
        key_loc(k, f, p)
    hand_ik(dale, "Right", k)                                                 # facing +Y: right is +X
    face(dale, 1, SMILE); face(dale, 16, SAD)
    camp = Vector((1.55, 1.95, 1.45))
    look_keys(dale, empty("lookcam23", camp), [(1, 0.0), (20, 0.0), (28, 0.85)])
    cam = Cam(lens=30, loc=tuple(camp), target=(0.1, 3.35, 1.25))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.1, 0.12, 0.0))))
    face_light(cam, energy=14, size=1.0)
    return n


@shot
def sh24():
    """So you move in. - your living room: Dale between two big wheeled suitcases, home at last; you frozen on the
    couch."""
    n = frames_of("sh24")
    closeup()
    ep15.living_room()
    you = you_char()
    ep15.couch_sit(you, -0.45)
    dx, dy = 0.75, 1.25
    dale = dale_char((dx, dy, 0), rot_z=0)
    idle(dale, n)
    for side, ox, col in (("Left", 0.42, (0.45, 0.12, 0.35)), ("Right", -0.42, (0.95, 0.4, 0.6))):   # facing -Y: left is +X
        roller_case((dx + ox, dy + 0.02, 0), color=col, name=f"roller{side}")
        hold(dale, side, (dx + ox, dy + 0.12, 0.99), name=f"grip_{side}")
    look_keys(you, empty("look_dale24", head(dale)), [(1, 0.8)])
    face(you, 1, WIDE); face(dale, 1, BEAM); blink(dale, [18])
    cam = Cam(lens=30, loc=(0.25, -1.6, 1.35), target=(0.2, 1.6, 1.0))
    cam.key(1, loc=(0.25, -1.6, 1.35)); cam.key(n, loc=(0.25, -1.35, 1.32))
    face_light(cam, energy=16, size=1.2)
    hearts(cam, head(dale) + Vector((0, -0.05, 0.28)), n, count=4, f0=4, seed=24, size=0.1)
    return n


@shot
def sh25():
    """Under his BED. - night, at floor level: under the bed, Dale lies on his side in the dark, wide awake, hugging
    the shoe, smiling at us."""
    n = frames_of("sh25")
    closeup()
    ep16.bedroom()
    bed_on_legs(lift=0.2)
    dale = ep7.side_lying("dale", 0.1, +1, tag="dale", z=0.15)
    camp = Vector((1.6, 1.25, 0.3))
    look_keys(dale, empty("look_cam25", camp), [(1, 0.7)])
    face(dale, 1, DREAMY); blink(dale, [24])
    hd = head(dale)
    cam = Cam(lens=30, loc=tuple(camp), target=tuple(hd + Vector((0.0, -0.3, -0.04))))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.2, 0.05, 0.0))))
    face_light(cam, energy=24, size=0.8, color=NIGHT)
    return n


# ============================================================================ SHOTS: honeymoon
@shot
def sh26():
    """He moves to another country. - a tropical beach: him alone on a beach towel, shades on, finally at peace."""
    n = frames_of("sh26")
    closeup()
    beach()
    you = you_char(sd=True)
    on_towel(you, -0.45)
    ep6.wear_shades(you)
    camp = Vector((2.3, 0.9, 1.6))
    look_keys(you, empty("look_cam26", camp), [(1, 0.45)])
    face(you, 1, dict(SERENE, mouthSmileLeft=0.7, mouthSmileRight=0.7))
    cam = Cam(lens=30, loc=tuple(camp), target=(-0.4, 1.75, 0.15))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.25, 0.1, -0.1))))
    face_light(cam, energy=10, size=1.2)
    return n


@shot
def sh27():
    """HONEYMOON! - Dale on the towel right next to him, shades and a flower necklace, grinning at us; he turns and
    sees him."""
    n = frames_of("sh27")
    closeup()
    beach()
    you = you_char(sd=True)
    on_towel(you, -0.45)
    ep6.wear_shades(you)
    dale = dale_char(sd=True)
    on_towel(dale, 0.45)
    ep6.wear_shades(dale)
    lei(dale)
    camp = Vector((1.55, 1.15, 1.45))
    look_keys(dale, empty("look_cam27", camp), [(1, 0.0), (5, 0.85)])
    look_keys(you, empty("look_dale27", head(dale)), [(1, 0.0), (8, 0.0), (14, 0.85)])
    face(dale, 1, GRIN); face(you, 1, dict(SERENE, mouthSmileLeft=0.7, mouthSmileRight=0.7)); face(you, 12, SHOCK)
    cam = Cam(lens=32, loc=tuple(camp), target=(0.0, 1.82, 0.15))
    cam.key(1, loc=tuple(camp)); cam.key(n, loc=tuple(camp + Vector((-0.15, 0.1, -0.05))))
    face_light(cam, energy=10, size=1.2)
    hearts(cam, head(dale) + Vector((0, 0, 0.3)), n, count=5, f0=3, seed=27, size=0.1)
    return n


# ============================================================================ SHOTS: the garden
@shot
def sh28():
    """He buries you in his GARDEN. - night, by torchlight: he shovels dirt into the grave... onto Dale, who lies
    there gazing up, in love."""
    n = frames_of("sh28")
    closeup()
    ep16.backyard(hole=1.7)
    dale = ep16.dale_dead()
    dale.rig.location.y = -1.0
    face(dale, 1, LOVE)
    fill_root = empty("fill_root", (0, 0, -1.7))
    fb = box("fill", (2 * HX, 2 * HY, 1.0), (0, 0, 0.5), ep16.dirt_mat(), uv_scale=0.6); fb.parent = fill_root
    key_scale(fill_root, 1, (1, 1, 0.02)); key_scale(fill_root, n, (1, 1, 0.1))
    you, sp = ep16.digger(n, 0.0, yaw=90, x=1.0, y=0.1, period=18, lean=10)
    face(you, 1, SMUG)
    cam = Cam(lens=24, loc=(1.45, -2.25, 2.2), target=(0.5, 0.2, -0.35))
    cam.key(1, loc=(1.45, -2.25, 2.2)); cam.key(n, loc=(1.4, -2.05, 2.12))
    face_light(cam, energy=34, size=1.2, color=NIGHT)
    return n


@shot
def sh29():
    """He wants you close. - straight down into the grave: Dale on his back, dirt landing on him, gazing up at us."""
    n = frames_of("sh29")
    closeup()
    ep16.backyard(hole=1.7)
    dale = ep16.dale_dead()
    dale.rig.location.y = -1.0
    fill_root = empty("fill_root", (0, 0, -1.7))
    fb = box("fill", (2 * HX, 2 * HY, 1.0), (0, 0, 0.5), ep16.dirt_mat(), uv_scale=0.6); fb.parent = fill_root
    key_scale(fill_root, 1, (1, 1, 0.1)); key_scale(fill_root, n, (1, 1, 0.13))
    hd = head(dale)
    face(dale, 1, DREAMY); blink(dale, [20])
    dm = ep16.dirt_mat()
    r = random.Random(29)
    for k in range(9):
        f0 = 2 + k * 3
        land = Vector((r.uniform(-0.22, 0.22), r.uniform(-0.8, hd.y - 0.35), -1.32))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r.uniform(0.035, 0.06), location=land)
        cl = bpy.context.object; cl.name = f"clod{k}"; cl.data.materials.append(dm)
        key_loc(cl, 1, land + Vector((0, 0, 2.2)), interp="CONSTANT"); key_loc(cl, f0, land + Vector((0, 0, 2.2)), interp="LINEAR")
        key_loc(cl, f0 + 7, land, interp="CONSTANT")
    cam = over(n, hd + Vector((0.0, -0.3, 0.0)), height=2.0, back=0.4, lens=34, drift=0.15)
    face_light(cam, energy=38, size=1.2, color=NIGHT)
    hearts(cam, hd + Vector((0, -0.05, 0.25)), n, count=4, f0=6, seed=29, size=0.08, emit=0.3)
    return n


@shot
def sh30():
    """FOREVER. - the little headstone in the moonlight... corrected by Dale: FINALLY crossed out, FOREVER <3."""
    n = frames_of("sh30")
    ep16.backyard(filled=True, stone=False)
    stone18((0, HY + 0.12, 0))
    sp = ep16.shovel(); sp.location = (0.75, HY + 0.3, 0.0); sp.rotation_euler = (math.radians(-8), 0, math.radians(20))
    cam = Cam(lens=40, loc=(0.1, HY - 1.05, 0.52), target=(0.0, HY + 0.12, 0.34))
    cam.key(1, loc=(0.1, HY - 1.05, 0.52)); cam.key(n, loc=(0.08, HY - 0.85, 0.5))
    area("stonekey", (0.6, HY - 1.2, 1.2), (0, HY + 0.12, 0.3), energy=22, size=1.0, color=NIGHT)
    hearts(cam, (0.0, HY - 0.05, 0.6), n, count=3, f0=5, seed=30, size=0.06, pink=True, spread=(0.2, 0.1), emit=0.3)
    return n


# ============================================================================ SHOTS: one night
@shot
def sh31():
    """One night, he finally hugs you back. - from above the bed: Dale lying beside him on the covers, gazing at
    him; in his sleep he rolls his arm over onto Dale. Dale's eyes pop."""
    n = frames_of("sh31")
    closeup()
    you, ht, dale = bed_pair()
    f0, f1 = 18, 36
    p0 = ht.location.copy()
    hug = hug_target(dale)
    key_loc(ht, 1, p0); key_loc(ht, f0, p0); key_loc(ht, (f0 + f1) // 2, (p0 + hug) / 2 + Vector((0, 0, 0.12)))
    key_loc(ht, f1, hug)
    look_keys(you, empty("look_dale31", head(dale)), [(1, 0.0), (f0, 0.0), (f1, 0.6)])
    face(dale, 1, LOVE); face(dale, f1 + 2, FROZEN)
    cam = over(n, (0.3, 1.45, 0.85), height=1.8, back=0.5, lens=30)
    face_light(cam, energy=38, size=1.4, color=NIGHT)
    hearts(cam, head(dale) + Vector((0.05, 0, 0.25)), n, count=4, f0=f1, seed=31, size=0.08, emit=0.3)
    return n


def hugged(you, ht, dale):
    """The hug already in place (shots after sh31)."""
    ht.location = hug_target(dale)
    look_keys(you, empty("look_dale_h", head(dale)), [(1, 0.6)])


@shot
def sh32():
    """He's ASLEEP. - close on him from above: eyes shut, mouth open, snoring, his arm across Dale."""
    n = frames_of("sh32")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    face(you, 1, SLEEP)
    for f in range(1, n + 1, 9):
        you.expr(f, {"jawOpen": 0.25}); you.expr(f + 5, {"jawOpen": 0.05})
    face(dale, 1, FROZEN)
    hy = head(you)
    cam = over(n, hy + Vector((0.02, 0.08, 0.05)), height=0.6, back=0.14, lens=40, drift=0.06)
    face_light(cam, energy=30, size=1.0, color=NIGHT)
    floaters(cam, f"{D18}/zzz.png", hy + Vector((-0.14, 0.02, 0.18)), n, count=3, size=0.08, seed=32, emit=0.4,
             spread=(0.06, 0.06), name="zzz")
    return n


@shot
def sh33():
    """You never move again. - from above: Dale frozen stiff, eyes wide, grinning at the ceiling, while night turns
    to dawn."""
    n = frames_of("sh33")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    morning(f0=4, f1=n - 2)
    face(dale, 1, FROZEN)
    hd = head(dale)
    look_keys(dale, empty("ceiling33", hd + Vector((0.0, 0.1, 1.5))), [(1, 1.0)])
    cam = over(n, hd + Vector((-0.08, 0.04, 0.05)), height=0.85, back=0.18, lens=38, drift=0.08)
    face_light(cam, energy=30, size=1.2, color=NIGHT)
    return n


@shot
def sh34():
    """Best night of your LIFE. - morning light on Dale's face: pure bliss, hearts floating up."""
    n = frames_of("sh34")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    morning()
    face(dale, 1, LOVE); blink(dale, [20])
    hd = head(dale)
    cam = over(n, hd + Vector((0.0, 0.08, 0.05)), height=0.6, back=0.14, lens=40, drift=0.06)
    face_light(cam, energy=16, size=1.0, color=WARM)
    hearts(cam, hd + Vector((0.2, 0.16, 0.06)), n, count=6, f0=2, seed=34, size=0.05, pink=True, spread=(0.05, 0.05))
    return n


@shot
def sh35():
    """He wakes up screaming your name. - morning, from above: his eyes open... he sees Dale... his face falls apart."""
    n = frames_of("sh35")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    morning()
    face(you, 1, SLEEP); face(you, 10, DAZED); face(you, 28, WIDE); face(you, 44, SCREAM)
    face(dale, 1, BEAM)
    cam = over(n, (0.3, 1.6, 0.85), height=1.4, back=0.45, lens=32, drift=0.2)
    face_light(cam, energy=18, size=1.4, color=WARM)
    return n


@shot
def sh36():
    """"DALE!" - right over his face: the scream."""
    n = frames_of("sh36")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    morning()
    face(you, 1, SCREAM)
    for f in range(1, n + 1, 3):
        you.expr(f, {"jawOpen": 1.0 if (f // 3) % 2 == 0 else 0.85})
    hy = head(you)
    cam = over(n, hy + Vector((0.0, 0.08, 0.05)), height=0.56, back=0.12, lens=40, drift=0.1)
    cam.shake(1, n, amp=0.015, freq=0.5)
    face_light(cam, energy=16, size=1.0, color=WARM)
    return n


@shot
def sh37():
    """He's just SHY. - from above, on Dale: he turns his eyes up to us and winks."""
    n = frames_of("sh37")
    closeup()
    you, ht, dale = bed_pair()
    hugged(you, ht, dale)
    morning()
    hd = head(dale)
    cam = over(n, hd + Vector((0.0, 0.08, 0.05)), height=0.6, back=0.14, lens=40, drift=0.08)
    look_keys(dale, empty("look_cam37", hd + Vector((0.0, -0.06, 0.65))), [(1, 0.0), (5, 0.0), (12, 0.9)])
    face(you, 1, SCREAM)
    face(dale, 1, BEAM); face(dale, 14, WINK); face(dale, 24, BEAM)
    face_light(cam, energy=16, size=1.0, color=WARM)
    hearts(cam, hd + Vector((0.2, 0.16, 0.06)), n, count=6, f0=12, seed=37, size=0.05, spread=(0.05, 0.05))
    return n


