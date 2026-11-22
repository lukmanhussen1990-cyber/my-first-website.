"""Shot definitions for 'Larry'. Each shot builds its full scene; render_shot.py renders it.
Timing (seconds) comes from the edited voiceover; frames are derived at 24 fps."""
import bpy, math, random
from mathutils import Vector
import lib
from lib import (load_char, empty, mat_flat, mat_tex, mat_image, box, plane, decal, cylinder, model,
                 append_blend, world_hdri, world_color, sun, area, point, Cam, key_loc, key_rot, key_scale, DECALS,
                 fit, drop_to, bbox)

from cuts import CUTS


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * lib.FPS) - round(t * lib.FPS)
    raise KeyError(name)


def at(name, t):
    """Frame (1-based, inside shot `name`) for absolute timeline time t (seconds)."""
    t0 = dict(CUTS)[name]
    return max(1, round((t - t0) * lib.FPS) + 1)


SHOTS = {}


def shot(fn):
    SHOTS[fn.__name__] = fn
    return fn


def src(n, start, speed=1.0, pad=12, in_place=True):
    """Source frame range for n output frames."""
    return dict(start=start, end=start + int(n * lib.STEP * speed) + pad, speed=speed, in_place=in_place)


# ============================================================================ expressions
SMILE = {"mouthSmileLeft": 0.75, "mouthSmileRight": 0.75, "cheekSquintLeft": 0.35, "cheekSquintRight": 0.35,
         "eyeSquintLeft": 0.15, "eyeSquintRight": 0.15}
SMUG = {"mouthSmileLeft": 0.9, "mouthSmileRight": 0.5, "browOuterUpLeft": 0.6, "eyeSquintLeft": 0.3,
        "eyeSquintRight": 0.3, "cheekSquintLeft": 0.35}
CREEPY = {"mouthSmileLeft": 0.9, "mouthSmileRight": 0.9, "mouthStretchLeft": 0.25, "mouthStretchRight": 0.25,
          "browInnerUp": 0.45, "browOuterUpLeft": 0.55, "browOuterUpRight": 0.55, "eyeWideLeft": 0.35,
          "eyeWideRight": 0.35, "cheekSquintLeft": 0.3, "cheekSquintRight": 0.3}
CREEPY_ENJOY = {"mouthSmileLeft": 0.8, "mouthSmileRight": 0.8, "eyeSquintLeft": 0.6, "eyeSquintRight": 0.6,
                "eyeBlinkLeft": 0.35, "eyeBlinkRight": 0.35, "browInnerUp": 0.5, "cheekSquintLeft": 0.5,
                "cheekSquintRight": 0.5}
UNEASY = {"eyeWideLeft": 0.7, "eyeWideRight": 0.7, "mouthPressLeft": 0.6, "mouthPressRight": 0.6,
          "mouthFrownLeft": 0.45, "mouthFrownRight": 0.45, "browInnerUp": 0.8, "mouthRollLower": 0.2}
DETERMINED = {"browDownLeft": 0.6, "browDownRight": 0.6, "mouthPressLeft": 0.5, "mouthPressRight": 0.5,
              "eyeSquintLeft": 0.3, "eyeSquintRight": 0.3}
STERN = {"browDownLeft": 0.8, "browDownRight": 0.8, "mouthPressLeft": 0.6, "mouthPressRight": 0.6,
         "mouthFrownLeft": 0.3, "mouthFrownRight": 0.3, "jawForward": 0.3}
SHOCK = {"eyeWideLeft": 1.0, "eyeWideRight": 1.0, "jawOpen": 0.35, "browInnerUp": 1.0, "browOuterUpLeft": 0.8,
         "browOuterUpRight": 0.8, "mouthFunnel": 0.2}
DEADPAN = {"eyeWideLeft": 0.45, "eyeWideRight": 0.45, "mouthPressLeft": 0.7, "mouthPressRight": 0.7,
           "mouthRollLower": 0.3, "browDownLeft": 0.2, "browDownRight": 0.2}
RAGE = {"jawOpen": 1.0, "mouthStretchLeft": 0.9, "mouthStretchRight": 0.9, "mouthUpperUpLeft": 0.8,
        "mouthUpperUpRight": 0.8, "browDownLeft": 1.0, "browDownRight": 1.0, "noseSneerLeft": 0.9,
        "noseSneerRight": 0.9, "eyeWideLeft": 0.8, "eyeWideRight": 0.8, "mouthLowerDownLeft": 0.7,
        "mouthLowerDownRight": 0.7}
SLEEP = {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0, "mouthSmileLeft": 0.25, "mouthSmileRight": 0.25}
WINK = {"eyeBlinkLeft": 1.0, "cheekSquintLeft": 0.6, "mouthSmileLeft": 1.0, "mouthSmileRight": 0.75,
        "browDownLeft": 0.4}
TADA = {"jawOpen": 0.45, "mouthSmileLeft": 1.0, "mouthSmileRight": 1.0, "eyeWideLeft": 0.6, "eyeWideRight": 0.6,
        "browOuterUpLeft": 0.9, "browOuterUpRight": 0.9, "browInnerUp": 0.6}
OOF = {"jawOpen": 0.55, "eyeWideLeft": 0.9, "eyeWideRight": 0.9, "mouthFunnel": 0.4, "browInnerUp": 1.0,
       "cheekPuff": 0.3}
_ALL = (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, STERN, SHOCK, DEADPAN, RAGE, SLEEP, WINK, TADA, OOF)
NEUTRAL = {k: 0.0 for d in _ALL for k in d}


def face(ch, frame, values):
    """Set an expression (zeroing everything else) at a frame."""
    v = dict(NEUTRAL)
    v.update(values)
    ch.expr(frame, v)


def blink(ch, frames, base=0.0):
    for f in frames:
        ch.expr(max(1, f - 2), {"eyeBlinkLeft": base, "eyeBlinkRight": base})
        ch.expr(f, {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0})
        ch.expr(f + 3, {"eyeBlinkLeft": base, "eyeBlinkRight": base})


def look_at(ch, target, influence=0.85):
    """Aim the head (bone +Z is face-forward on the cmu_mb rig) at an object/point."""
    if not hasattr(target, "location"):
        target = empty("look", target)
    pb = ch.rig.pose.bones["Head"]
    c = pb.constraints.new("DAMPED_TRACK")
    c.target = target
    c.track_axis = "TRACK_Z"
    c.influence = influence
    return c


def hand_ik(ch, side, target, chain=2):
    return ch.ik(f"{side}ForeArm", target, chain=chain)


# ============================================================================ generic set pieces
def ground(tex, size=200, scale=0.5, tint=None, name="ground"):
    return plane(name, (size, size), (0, 0, 0), mat_tex(name + "_m", tex, scale=1.0, tint=tint), uv_scale=scale)


_TREE_MATS = {}


def blob_tree(loc, height=5.0, seed=0):
    """Stylised low-poly tree (like the reference): trunk + lumpy canopy blobs."""
    rnd = random.Random(seed)
    if not _TREE_MATS:
        _TREE_MATS["trunk"] = mat_flat("trunk", (0.25, 0.16, 0.09), rough=0.9)
        _TREE_MATS["leaf"] = [mat_flat(f"leaf{i}", c, rough=0.8) for i, c in
                              enumerate(((0.12, 0.32, 0.08), (0.16, 0.38, 0.1), (0.1, 0.28, 0.07)))]
        tex = bpy.data.textures.new("leafnoise", "CLOUDS"); tex.noise_scale = 0.6
        _TREE_MATS["tex"] = tex
    x, y, z = loc
    th = height * 0.42
    cylinder("trunk", 0.12 * height / 5, th, (x, y, z + th / 2), _TREE_MATS["trunk"], verts=10)
    for i in range(4):
        r = height * rnd.uniform(0.2, 0.28)
        cx = x + rnd.uniform(-0.25, 0.25) * height * 0.4
        cy = y + rnd.uniform(-0.25, 0.25) * height * 0.4
        cz = z + th + r * 0.8 + rnd.uniform(0, 0.25) * height * 0.3
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(cx, cy, cz))
        b = bpy.context.object
        d = b.modifiers.new("d", "DISPLACE"); d.texture = _TREE_MATS["tex"]; d.strength = r * 0.35
        bpy.ops.object.shade_smooth()
        b.data.materials.append(_TREE_MATS["leaf"][i % 3])


def tree(asset, loc, rot=0, height=None):
    blob_tree(loc, height or 5.0, seed=int(abs(loc[0] * 13 + loc[1] * 7)))


def wall_openings(name, x0, x1, y, h, thick, openings, mat):
    """Wall along X from x0..x1 at depth y with rectangular openings [(xc, w, z0, z1)]."""
    edges = sorted(openings, key=lambda o: o[0])
    x = x0
    for (xc, w, z0, z1) in edges:
        a, b = xc - w / 2, xc + w / 2
        if a > x:
            box(f"{name}_s{x:.1f}", (a - x, thick, h), ((x + a) / 2, y, h / 2), mat)
        if z0 > 0:
            box(f"{name}_b{xc:.1f}", (w, thick, z0), (xc, y, z0 / 2), mat)
        box(f"{name}_t{xc:.1f}", (w, thick, h - z1), (xc, y, (z1 + h) / 2), mat)
        x = b
    if x < x1:
        box(f"{name}_e", (x1 - x, thick, h), ((x + x1) / 2, y, h / 2), mat)


# ============================================================================ OFFICE
def office_set():
    world_hdri("kloofendal_overcast_puresky", strength=0.55)
    carpet = mat_tex("carpet", "dirty_carpet", scale=1.0, tint=(0.62, 0.68, 0.8), rough_mult=1.2)
    plane("floor", (24, 24), (0, 0, 0), carpet, uv_scale=0.5)
    wall = mat_tex("wall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.94, 0.9))
    box("wall_back", (24, 0.2, 3.2), (0, 6.5, 1.6), wall, uv_scale=0.4)
    box("wall_left", (0.2, 24, 3.2), (-7, 0, 1.6), wall, uv_scale=0.4)
    box("wall_right", (0.2, 24, 3.2), (7, 0, 1.6), wall, uv_scale=0.4)
    plane("ceiling", (24, 24), (0, 0, 3.0), mat_flat("ceil", (0.86, 0.86, 0.84), rough=0.9), rot=(180, 0, 0))
    grid = mat_flat("grid", (0.7, 0.7, 0.7), rough=0.6)
    for i in range(-8, 9):
        box(f"cg_x{i}", (24, 0.025, 0.01), (0, i * 0.6, 2.99), grid)
        box(f"cg_y{i}", (0.025, 24, 0.01), (i * 0.6, 0, 2.99), grid)
    panel = mat_flat("panel", (1, 1, 1), emit=(1.0, 0.98, 0.95), emit_strength=5)
    for x in (-4.5, -1.5, 1.5, 4.5):
        for y in (-4, -1, 2, 5):
            plane(f"lp_{x}_{y}", (1.2, 0.6), (x, y, 2.98), panel, rot=(180, 0, 0))
    win = mat_flat("window", (0.9, 0.95, 1), emit=(0.85, 0.92, 1.0), emit_strength=3.0)
    for x in (-5, -2.5, 0, 2.5, 5):
        plane(f"win_{x}", (2.0, 1.7), (x, 6.39, 1.65), win, rot=(90, 0, 0))
    fab = mat_tex("fabric", "denim_fabric", scale=1.0, tint=(0.62, 0.66, 0.72), normal_strength=0.4)
    trim = mat_flat("trim", (0.75, 0.76, 0.78), rough=0.3, metal=0.8)

    def partition(name, size, loc):
        box(name, size, loc, fab, uv_scale=2.0)
        box(name + "_trim", (size[0] + 0.02, size[1] + 0.02, 0.03), (loc[0], loc[1], loc[2] + size[2] / 2 + 0.015), trim)
    H = 1.42
    partition("p_back", (3.0, 0.06, H), (0, 1.05, H / 2))
    partition("p_left", (0.06, 1.8, H), (-1.5, 0.15, H / 2))
    partition("p_right", (0.06, 1.8, H), (1.5, 0.15, H / 2))
    partition("p_back2", (3.0, 0.06, H), (3.0, 1.05, H / 2))
    partition("p_right2", (0.06, 1.8, H), (4.5, 0.15, H / 2))
    for i, x in enumerate((-4.5, -1.5, 1.5, 4.5)):
        partition(f"far_{i}", (3.0, 0.06, H), (x, 4.2, H / 2))
        partition(f"farL_{i}", (0.06, 1.6, H), (x - 1.5, 3.4, H / 2))
    model("metal_office_desk", (0, 0.62, 0), rot_z=180)
    model("metal_office_desk", (3.0, 0.62, 0), rot_z=180)
    model("classic_laptop", (0.35, 0.6, 0.76), rot_z=170)
    model("potted_plant_01", (-1.15, 0.75, 0), rot_z=30, scale=0.9)
    model("potted_plant_02", (6.0, 5.6, 0), scale=1.4)
    model("CoffeeCart_01", (-5.6, 3.0, 0), rot_z=90)
    model("wall_clock", (-2.2, 6.38, 2.35), scale=1.2)
    model("stationery_supplies", (-0.4, 0.6, 0.76), rot_z=20)
    decal("banner", f"{DECALS}/banner_welcome.png", 2.3, (0, 1.0, 1.96), rot=(90, 0, 0), alpha=True)
    strs = mat_flat("str", (0.9, 0.9, 0.9))
    for x in (-1.05, 1.05):
        cylinder(f"bstr{x}", 0.003, 0.85, (x, 1.0, 2.55), strs)
    for i, (x, z, c) in enumerate(((-1.38, 1.95, (0.85, 0.08, 0.1)), (-1.2, 2.15, (0.95, 0.75, 0.05)),
                                   (-1.52, 2.25, (0.1, 0.45, 0.85)))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(x, 0.92, z))
        b = bpy.context.object; b.scale = (1, 1, 1.18); bpy.ops.object.shade_smooth()
        b.data.materials.append(mat_flat(f"balloon{i}", c, rough=0.15))
        cylinder(f"string{i}", 0.0025, z - 1.42, (x, 0.92, 1.42 + (z - 1.42) / 2 - 0.18), strs)
    decal("nameplate", f"{DECALS}/nameplate_larry.png", 0.55, (1.465, 0.25, 1.12), rot=(90, 0, -90))
    sun(energy=3.0, rot=(55, 0, 160), color=(1.0, 0.95, 0.88))
    area("fill_front", (0, -5, 2.6), (0, 0.5, 1.2), energy=700, size=4, color=(1.0, 0.97, 0.93))
    area("fill_top", (0, 0, 2.9), (0, 0, 0), energy=450, size=6, color=(0.95, 0.97, 1.0))


@shot
def sh01():
    """You just start your new job — proud hands-on-hips in front of the welcome banner."""
    n = frames_of("sh01")
    office_set()
    you = load_char("you", (0, -0.15, 0))
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMILE)
    blink(you, [22])
    look_at(you, (0.6, -3.5, 1.55), 0.6)
    cam = Cam(lens=30, loc=(0.75, -3.6, 1.25), target=(0.0, 0.2, 1.25))
    cam.key(1, loc=(0.75, -3.6, 1.25), target=(0.0, 0.2, 1.25))
    cam.key(n, loc=(0.45, -2.85, 1.35), target=(0.0, 0.2, 1.3))
    return n


@shot
def sh02():
    """but Larry from accounting — Larry's head slowly rises over the cubicle wall, staring at you."""
    n = frames_of("sh02")
    office_set()
    larry = load_char("larry", (1.95, 0.25, 0), rot_z=-90, subdiv=True)
    larry.clip("137_41", **src(n, 200))
    key_loc(larry.rig, 1, (1.95, 0.25, -0.75))
    key_loc(larry.rig, int(n * 0.6), (1.95, 0.25, 0.02))
    key_loc(larry.rig, n, (1.95, 0.25, 0.1))
    look_at(larry, (0.15, -0.35, 1.45), 0.9)
    face(larry, 1, CREEPY)
    cam = Cam(lens=38, loc=(0.0, -0.55, 1.42), target=(1.5, 0.25, 1.36))
    cam.key(1, loc=(0.0, -0.55, 1.42))
    cam.key(n, loc=(0.25, -0.4, 1.45))
    return n


def office_touch(n, you_clip_start, larry_clip_start, phone=False):
    office_set()
    you = load_char("you", (0, -0.15, 0), subdiv=True)
    if phone:
        you.clip("79_36", **src(n, 262, speed=0.5))
    else:
        you.clip("137_41", **src(n, you_clip_start))
    larry = load_char("larry", (0.25, 0.22, 0), rot_z=-15, subdiv=True)
    larry.clip("137_41", **src(n, larry_clip_start))
    tgt = empty("rub", (0, 0, 0))
    you.bake_follow(tgt, "LeftArm", n, offset=(-0.01, 0.11, 0.1),
                    extra=lambda f: (0.018 * math.cos(f * 0.35), 0.0, 0.008 * math.sin(f * 0.35)))
    pole = empty("elbow_pole", (0, 0, 0))
    larry.bake_follow(pole, "RightArm", n, offset=(-0.45, 0.25, -0.05))
    c = larry.ik("RightForeArm", tgt, chain=2, pole=pole)
    c.pole_angle = math.radians(-90)
    drape = empty("drape", (0, 0, 0))
    you.bake_follow(drape, "LeftArm", n, offset=(0.0, -0.14, -0.06))
    hc = larry.rig.pose.bones["RightHand"].constraints.new("DAMPED_TRACK")
    hc.target = drape; hc.track_axis = "TRACK_Y"; hc.influence = 0.9
    look_at(larry, (0.0, -0.2, 1.5), 0.75)
    return you, larry


@shot
def sh03():
    """keeps touching you inappropriately — Larry's hand on your shoulder, creepy rub."""
    n = frames_of("sh03")
    you, larry = office_touch(n, 600, 800)
    face(you, 1, NEUTRAL)
    face(you, 8, UNEASY)
    blink(you, [34])
    face(larry, 1, CREEPY_ENJOY)
    look_at(you, (0.8, -2.5, 1.5), 0.5)
    cam = Cam(lens=45, loc=(0.7, -2.4, 1.5), target=(0.12, 0.0, 1.42))
    cam.key(1, loc=(0.7, -2.4, 1.5), target=(0.12, 0.0, 1.42))
    cam.key(n, loc=(0.5, -1.75, 1.52), target=(0.12, 0.0, 1.45))
    return n


@shot
def sh04():
    """So you call the police — phone to the ear, Larry still rubbing."""
    n = frames_of("sh04")
    you, larry = office_touch(n, 0, 900, phone=True)
    face(you, 1, DETERMINED)
    face(larry, 1, CREEPY_ENJOY)
    ph = box("phone", (0.082, 0.165, 0.012), (0, 0, 0), mat_flat("phone", (0.02, 0.02, 0.025), rough=0.2, metal=0.3),
             bevel=0.006)
    scr = box("phone_screen", (0.074, 0.15, 0.002), (0, 0, 0.0065), mat_flat("scr", (0.1, 0.2, 0.4), emit=(0.3, 0.55, 1.0), emit_strength=2.5))
    scr.parent = ph
    you.attach(ph, "RightHand", keep_world=False)
    ph.location = (0.0, 0.08, 0.03)
    cam = Cam(lens=45, loc=(-1.05, -1.55, 1.6), target=(-0.05, -0.1, 1.52))
    cam.key(1, loc=(-1.05, -1.55, 1.6))
    cam.key(n, loc=(-0.85, -1.3, 1.6))
    return n


@shot
def sh05():
    """GENIUS! — low-angle hero close-up, smug smile."""
    n = frames_of("sh05")
    office_set()
    you = load_char("you", (0, -0.15, 0), subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, SMUG)
    look_at(you, (1.8, -6, 2.4), 0.8)
    cam = Cam(lens=40, loc=(0.35, -0.95, 1.05), target=(0.0, -0.1, 1.62))
    cam.key(1, loc=(0.35, -0.95, 1.05))
    cam.key(n, loc=(0.3, -0.82, 1.12))
    return n


# ============================================================================ POLICE DESK
def police_set():
    world_color((0.5, 0.52, 0.55), 0.4)
    plane("floor", (20, 20), (0, 0, 0), mat_tex("tiles", "floor_tiles_02", scale=1.0, tint=(0.75, 0.75, 0.72)), uv_scale=0.6)
    blk = mat_tex("block", "concrete_block_wall", scale=1.0, tint=(0.82, 0.86, 0.9))
    box("w_back", (12, 0.2, 3.2), (0, 2.0, 1.6), blk, uv_scale=0.6)
    box("w_left", (0.2, 10, 3.2), (-4, 0, 1.6), blk, uv_scale=0.6)
    plane("ceil", (20, 20), (0, 0, 3.0), mat_flat("c", (0.8, 0.8, 0.8)), rot=(180, 0, 0))
    wood = mat_tex("wood", "wood_floor", scale=1.0, tint=(0.55, 0.38, 0.25))
    navy = mat_flat("navy", (0.05, 0.08, 0.18), rough=0.5)
    box("counter_front", (3.2, 0.12, 1.05), (0, -0.3, 0.525), navy)
    box("counter_top", (3.3, 0.7, 0.06), (0, 0.0, 1.08), wood, uv_scale=1.0)
    box("counter_back", (3.2, 0.5, 0.9), (0, 0.15, 0.45), mat_flat("cb", (0.2, 0.2, 0.22)))
    decal("sign_police", f"{DECALS}/sign_police.png", 2.6, (0, 1.89, 2.4), rot=(90, 0, 0))
    decal("wanted", f"{DECALS}/poster_wanted.png", 0.6, (-1.7, 1.89, 1.75), rot=(90, 0, 0))
    decal("wanted2", f"{DECALS}/poster_wanted.png", 0.6, (1.9, 1.89, 1.7), rot=(90, 0, 3))
    box("w_front", (12, 0.2, 3.2), (0, -3.2, 1.6), blk, uv_scale=0.6)
    decal("sign_police_f", f"{DECALS}/sign_police.png", 2.4, (0.2, -3.09, 2.35), rot=(90, 0, 180))
    decal("wanted_f1", f"{DECALS}/poster_wanted.png", 0.55, (-0.9, -3.09, 1.55), rot=(90, 0, 180))
    decal("wanted_f2", f"{DECALS}/poster_wanted.png", 0.55, (1.25, -3.09, 1.5), rot=(90, 0, 183))
    model("wall_clock", (2.4, -3.08, 2.3), rot_z=180)
    model("CashRegister_01", (1.0, 0.05, 1.11), rot_z=200, scale=0.9)
    model("clipboard", (-0.8, 0.0, 1.115), rot_z=15)
    panel = mat_flat("panel", (1, 1, 1), emit=(0.92, 0.97, 1.0), emit_strength=5)
    for x in (-2, 0, 2):
        plane(f"lp{x}", (1.2, 0.3), (x, 0.5, 2.98), panel, rot=(180, 0, 0))
    sun(energy=2.0, rot=(60, 0, -30), color=(0.95, 0.97, 1.0))
    area("fill", (2.5, -3, 2.6), (0, 0, 1.3), energy=600, size=3, color=(0.95, 0.97, 1.0))
    area("top", (0, 0, 2.9), (0, 0, 0), energy=500, size=4, color=(0.9, 0.95, 1.0))


def wallet(name="wallet", open_=False):
    leather = mat_flat("leather", (0.07, 0.035, 0.018), rough=0.5)
    w = empty(name, (0, 0, 0))
    if open_:
        a = box(name + "_L", (0.1, 0.085, 0.008), (-0.051, 0, 0), leather, bevel=0.003)
        b = box(name + "_R", (0.1, 0.085, 0.008), (0.051, 0, 0), leather, bevel=0.003)
        a.parent = w; b.parent = w
        idc = decal(name + "_id", f"{DECALS}/id_card.png", 0.082, (-0.051, 0, 0.0055), rot=(0, 0, 0))
        idc.parent = w
        for i in range(3):
            c = decal(name + f"_cash{i}", f"{DECALS}/cash.png", 0.095, (0.05 + i * 0.002, 0.004 * i, 0.006 + i * 0.001), rot=(0, 0, 0))
            c.parent = w
    else:
        a = box(name + "_closed", (0.1, 0.085, 0.018), (0, 0, 0), leather, bevel=0.004)
        a.parent = w
    return w


@shot
def sh06():
    """But Larry pays his bail — Larry slaps a wallet on the police counter."""
    n = frames_of("sh06")
    police_set()
    cop = load_char("cop", (0.2, 0.62, 0), rot_z=0)
    cop.clip("137_41", **src(n, 1000))
    face(cop, 1, DEADPAN)
    larry = load_char("larry", (-0.2, -0.85, 0), rot_z=180, subdiv=True)
    larry.clip("137_41", **src(n, 600))
    face(larry, 1, SMUG)
    look_at(larry, (0.15, 0.6, 1.6), 0.8)
    look_at(cop, (-0.2, -0.85, 1.55), 0.7)
    hit = at("sh06", 8.96)
    tgt = empty("slap", (0, 0, 0))
    key_loc(tgt, 1, (-0.35, -0.75, 0.95))
    key_loc(tgt, max(2, hit - 6), (-0.15, -0.35, 1.35))
    key_loc(tgt, hit, (-0.1, -0.12, 1.14), interp="LINEAR")
    key_loc(tgt, n, (-0.1, -0.13, 1.14))
    hand_ik(larry, "Right", tgt)
    w = wallet("wallet_hand")
    larry.attach(w, "RightHand", keep_world=False)
    w.location = (0, 0.07, 0.02)
    lib.hide_after(w, hit)
    w2 = wallet("wallet_counter"); w2.location = (-0.1, -0.1, 1.12); w2.rotation_euler = (0, 0, 0.3)
    w2.hide_render = True; w2.keyframe_insert("hide_render", frame=hit - 1)
    w2.hide_render = False; w2.keyframe_insert("hide_render", frame=hit)
    for c in w2.children:
        c.hide_render = True; c.keyframe_insert("hide_render", frame=hit - 1)
        c.hide_render = False; c.keyframe_insert("hide_render", frame=hit)
    cam = Cam(lens=32, loc=(1.25, 1.3, 1.72), target=(-0.2, -0.82, 1.35))
    cam.key(1, loc=(1.25, 1.3, 1.72))
    cam.key(n, loc=(1.12, 1.08, 1.68))
    cam.shake(hit, hit + 6, amp=0.02, freq=0.6)
    return n


@shot
def sh07():
    """with your wallet. — insert: it's YOUR licence in the wallet."""
    n = frames_of("sh07")
    police_set()
    w = wallet("wallet_open", open_=True)
    w.location = (0.0, -0.05, 1.115)
    w.rotation_euler = (0, 0, math.radians(6))
    w.scale = (1.15, 1.15, 1.15)
    bpy.context.scene.view_settings.exposure = -0.9
    cam = Cam(lens=50, loc=(-0.1, -0.4, 1.45), target=(-0.03, -0.05, 1.115), dof=4.0)
    cam.key(1, loc=(-0.1, -0.4, 1.45))
    cam.key(n, loc=(-0.08, -0.33, 1.39))
    return n


# ============================================================================ RESTRAINING ORDER
@shot
def sh08():
    """So you get a restraining order. — rubber stamp slams APPROVED."""
    n = frames_of("sh08")
    world_color((0.4, 0.38, 0.35), 0.5)
    plane("desk", (3, 3), (0, 0, 0), mat_tex("desk", "wood_floor", scale=1.0, tint=(0.55, 0.38, 0.25)), uv_scale=1.0)
    doc = decal("doc", f"{DECALS}/doc_restraining.png", 0.21, (0, 0, 0.001), rot=(0, 0, -4))
    st = decal("stamp_ink", f"{DECALS}/stamp_approved.png", 0.16, (0.02, -0.06, 0.0015), rot=(0, 0, -4), alpha=True)
    hit = at("sh08", 12.36)
    st.hide_render = True; st.keyframe_insert("hide_render", frame=hit - 1)
    st.hide_render = False; st.keyframe_insert("hide_render", frame=hit)
    rubber = mat_flat("rubber", (0.12, 0.1, 0.1), rough=0.8)
    wood = mat_flat("handle", (0.45, 0.25, 0.12), rough=0.4)
    stamp = empty("stamp", (0.02, -0.06, 0.3))
    b1 = box("stamp_base", (0.09, 0.05, 0.02), (0, 0, 0.01), rubber); b1.parent = stamp
    b2 = box("stamp_block", (0.08, 0.045, 0.025), (0, 0, 0.032), wood); b2.parent = stamp
    b3 = cylinder("stamp_neck", 0.008, 0.06, (0, 0, 0.075), wood); b3.parent = stamp
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0, 0, 0.12)); kn = bpy.context.object
    kn.data.materials.append(wood); kn.parent = stamp; bpy.ops.object.shade_smooth()
    key_loc(stamp, 1, (0.02, -0.06, 0.32))
    key_loc(stamp, hit - 6, (0.02, -0.06, 0.24))
    key_loc(stamp, hit, (0.02, -0.06, 0.002), interp="LINEAR")
    key_loc(stamp, hit + 3, (0.02, -0.06, 0.002))
    key_loc(stamp, hit + 9, (0.06, -0.08, 0.3))
    key_loc(stamp, n, (0.12, -0.1, 0.45))
    sun(energy=2.3, rot=(35, 10, 40), color=(1, 0.95, 0.88))
    area("fill", (-0.4, -0.5, 0.8), (0, 0, 0), energy=25, size=1)
    cam = Cam(lens=45, loc=(0.0, -0.32, 0.42), target=(0.0, -0.02, 0.0))
    cam.key(1, loc=(0.0, -0.32, 0.42))
    cam.key(n, loc=(0.0, -0.27, 0.36))
    cam.shake(hit, hit + 8, amp=0.006, freq=0.7)
    return n


# ============================================================================ PARK (500 FT + STICK)
def park_set(larry_dist=42.0):
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.0, rot_z=40)
    ground("leafy_grass", size=400, scale=0.4)
    path = mat_tex("path", "rectangular_paving", scale=1.0, tint=(0.95, 0.93, 0.9))
    plane("path", (3.0, 120), (0, 50, 0.005), path, uv_scale=0.6)
    white = mat_flat("paint", (0.95, 0.95, 0.92), rough=0.7)
    box("line500", (3.0, 0.25, 0.01), (0, larry_dist - 1.5, 0.012), white)
    d = decal("paint500", f"{DECALS}/paint_500ft.png", 2.6, (0, larry_dist - 3.2, 0.013), rot=(0, 0, 180), alpha=True)
    # signpost
    post = mat_flat("post", (0.3, 0.3, 0.32), metal=0.6, rough=0.4)
    cylinder("signpost", 0.04, 2.6, (1.9, larry_dist - 1.5, 1.3), post)
    decal("sign500", f"{DECALS}/paint_500ft.png", 1.6, (1.9, larry_dist - 1.53, 2.4), rot=(90, 0, 180), alpha=True)
    sb = box("signboard", (1.7, 0.03, 0.62), (1.9, larry_dist - 1.5, 2.4), mat_flat("sb", (0.75, 0.1, 0.1)))
    for i, (x, y, a) in enumerate(((-4.5, 6, "tree_small_02"), (4.8, 12, "jacaranda_tree"), (-5.5, 22, "jacaranda_tree"),
                                   (5.5, 30, "tree_small_02"), (-6, 40, "tree_small_02"), (6.5, 52, "jacaranda_tree"),
                                   (-7, 60, "jacaranda_tree"))):
        tree(a, (x, y, 0), rot=i * 47, height=6.5 if a == "jacaranda_tree" else 4.5)
    for i, y in enumerate((3, 18, 33, 48)):
        model("street_lamp_01", (2.9, y, 0), rot_z=90)
    sun(energy=3.8, rot=(48, 0, 140), color=(1.0, 0.95, 0.87))


@shot
def sh09():
    """Larry has to stay 500 feet away. — you up front, tiny Larry far down the path behind the 500 FT line."""
    n = frames_of("sh09")
    D = 42.0
    park_set(D)
    you = load_char("you", (0.35, 0.0, 0), rot_z=0)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    larry = load_char("larry", (-0.2, D + 0.8, 0), rot_z=0)
    larry.clip("141_16", **src(n, 30, speed=0.8))
    face(larry, 1, CREEPY)
    cam = Cam(lens=40, loc=(-0.25, -3.2, 1.35), target=(0.1, 6.0, 1.3))
    cam.key(1, loc=(-0.25, -3.2, 1.35), target=(0.1, 6.0, 1.3))
    cam.key(n, loc=(-0.15, -2.7, 1.4), target=(0.05, 8.0, 1.25))
    return n


@shot
def sh10():
    """CLEVER! — smug low-angle close-up against the sky."""
    n = frames_of("sh10")
    park_set()
    you = load_char("you", (0.0, 0.0, 0), subdiv=True)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SMUG)
    face(you, n, dict(SMUG, browOuterUpRight=0.7))
    look_at(you, (-2.5, -6, 2.6), 0.8)
    cam = Cam(lens=35, loc=(-0.45, -0.85, 1.12), target=(0.0, 0.0, 1.62))
    cam.key(1, loc=(-0.45, -0.85, 1.12))
    cam.key(n, loc=(-0.38, -0.75, 1.18))
    return n


def stick_scene(n, D=42.0, cheek=False):
    park_set(D)
    you = load_char("you", (0.35, 0.0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    larry = load_char("larry", (-0.15, D + 0.8, 0), rot_z=0)
    larry.clip("137_41", **src(n, 300))
    face(larry, 1, CREEPY)
    # the stick: from Larry's hands to your left shoulder (or cheek)
    if cheek:
        tip = you.world("Head", frame=1) + Vector((0.075, -0.07, 0.07))
    else:
        tip = you.world("LeftArm", frame=1) + Vector((0.05, -0.02, 0.06))
    grip = Vector((-0.2, D + 0.35, 1.05))
    d = tip - grip
    L = d.length
    stick = cylinder("stick", 0.035, L, ((grip + tip) / 2), mat_tex("stickwood", "wood_floor", scale=1.0, tint=(0.95, 0.7, 0.42)), verts=12)
    stick.rotation_mode = "QUATERNION"
    stick.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for side in ("Right", "Left"):
        t = empty(f"grip{side}", grip + Vector((0.1 if side == "Left" else -0.1, 0.0, 0.0)))
        hand_ik(larry, side, t)
    return you, larry, stick, d.normalized(), (grip + tip) / 2


@shot
def sh11():
    """Except Larry buys a 501-foot stick — the stick stretches all the way from tiny Larry to your shoulder."""
    n = frames_of("sh11")
    you, larry, stick, axis, mid = stick_scene(n)
    face(you, 1, DEADPAN)
    for f, o in ((1, -0.6), (int(n * 0.45), 0.0), (int(n * 0.55), -0.12), (int(n * 0.7), 0.0), (n, 0.0)):
        key_loc(stick, f, mid + axis * o)
    cam = Cam(lens=28, loc=(1.1, -4.2, 5.2), target=(0.1, 14.0, 0.6))
    cam.key(1, loc=(1.1, -4.2, 5.2), target=(0.1, 14.0, 0.6))
    cam.key(n, loc=(0.9, -3.4, 4.4), target=(0.1, 16.0, 0.6))
    return n


@shot
def sh12():
    """(stick) poke-poke on the cheek, you deadpan."""
    n = frames_of("sh12")
    you, larry, stick, axis, mid = stick_scene(n, cheek=True)
    face(you, 1, DEADPAN)
    for f, o in ((1, 0.0), (6, -0.12), (10, 0.0), (16, -0.12), (20, 0.0), (n, 0.0)):
        key_loc(stick, f, mid + axis * o)
    face(you, 10, dict(DEADPAN, eyeLookOutLeft=0.6, eyeLookInRight=0.6))
    blink(you, [26])
    cam = Cam(lens=60, loc=(0.75, -1.15, 1.62), target=(0.3, 0.0, 1.55), dof=2.8)
    cam.key(1, loc=(0.75, -1.15, 1.62))
    cam.key(n, loc=(0.7, -1.0, 1.62))
    return n


# ============================================================================ EGYPT
def egypt_set(house=True, pyramids=True, sky_rot=0):
    world_hdri("kloofendal_43d_clear_puresky", strength=1.1, rot_z=sky_rot)
    ground("coast_sand_01", size=3000, scale=0.35, tint=(1.0, 0.9, 0.75))
    stone = mat_tex("pyr", "large_sandstone_blocks", scale=1.0, tint=(1.0, 0.88, 0.7))
    if pyramids:
        for i, (x, y, r, h) in enumerate(((-130, 470, 175, 170), (95, 640, 150, 145), (250, 500, 75, 75))):
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=r * 1.414, radius2=0, depth=h, location=(x, y, h / 2),
                                            rotation=(0, 0, math.radians(45)))
            p = bpy.context.object; p.name = f"pyramid{i}"
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            lib._cube_uv(p, 0.12)
            p.data.materials.append(stone)
    if house:
        egypt_house()
    sun(energy=4.2, rot=(48, 0, 28), color=(1.0, 0.93, 0.8))


def egypt_house(oy=6.0):
    plaster = mat_tex("plaster", "painted_plaster_wall", scale=1.0, tint=(1.0, 0.96, 0.88))
    blue = mat_flat("blue", (0.05, 0.25, 0.55), rough=0.5)
    W, D, Hh = 7.0, 5.0, 3.2
    y0 = oy - D / 2
    wall_openings("front", -W / 2, W / 2, y0, Hh, 0.25, [(-2.2, 1.2, 1.1, 2.2), (0.0, 1.1, 0.0, 2.2), (2.2, 1.2, 1.1, 2.2)], plaster)
    box("back", (W, 0.25, Hh), (0, oy + D / 2, Hh / 2), plaster, uv_scale=0.5)
    box("left", (0.25, D, Hh), (-W / 2, oy, Hh / 2), plaster, uv_scale=0.5)
    box("right", (0.25, D, Hh), (W / 2, oy, Hh / 2), plaster, uv_scale=0.5)
    box("roof", (W + 0.3, D + 0.3, 0.25), (0, oy, Hh + 0.12), plaster, uv_scale=0.5)
    box("parapet_f", (W + 0.3, 0.15, 0.35), (0, y0 - 0.07, Hh + 0.42), plaster, uv_scale=0.5)
    box("floor_in", (W, D, 0.05), (0, oy, 0.02), mat_flat("inside", (0.25, 0.2, 0.15)))
    box("door", (1.05, 0.06, 2.15), (0.0, y0 + 0.12, 1.08), blue, bevel=0.01)
    box("step", (1.6, 0.6, 0.12), (0.0, y0 - 0.35, 0.06), plaster)
    for x in (-2.2, 2.2):
        box(f"shutL{x}", (0.35, 0.05, 1.15), (x - 0.8, y0 - 0.15, 1.65), blue)
        box(f"shutR{x}", (0.35, 0.05, 1.15), (x + 0.8, y0 - 0.15, 1.65), blue)
        box(f"sill{x}", (1.4, 0.2, 0.06), (x, y0 - 0.1, 1.08), plaster)
    point("inside_light", (0, oy, 2.4), energy=120, color=(1.0, 0.85, 0.65), radius=0.3)
    model("potted_plant_02", (1.0, y0 - 0.5, 0.0), scale=1.0)
    return y0


@shot
def sh13():
    """So you move to another country. — walking with a suitcase toward your new house, pyramids behind."""
    n = frames_of("sh13")
    egypt_set()
    you = load_char("you_sun", (0.3, -6.0, 0), rot_z=180)
    you.clip("70_01", **src(n, 120, in_place=False))
    s = model("vintage_suitcase", (0, 0, 0), rot_z=90)
    fit(s, height=0.5, ground=False)
    kids = list(s.children)
    for k in kids[1:]:
        k.hide_render = True          # the asset has two cases; carry one
    mn, mx = bbox(s)
    you.bake_follow(s, "RightHand", n, offset=(0.0, 0.0, -(mx.z - mn.z) * 0.95))
    cam = Cam(lens=28, loc=(2.4, -10.5, 1.6), target=(0.3, -3.0, 2.2))
    cam.key(1, loc=(2.4, -10.5, 1.6))
    cam.key(n, loc=(2.0, -9.6, 1.7))
    return n


@shot
def sh14():
    """PERFECT! — sunglasses, big grin, pyramids behind."""
    n = frames_of("sh14")
    egypt_set(house=False, sky_rot=40)
    you = load_char("you_sun", (0, 0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, dict(SMILE, jawOpen=0.15, mouthSmileLeft=1.0, mouthSmileRight=1.0))
    look_at(you, (0.6, -2.5, 1.5), 0.6)
    cam = Cam(lens=40, loc=(0.55, -1.35, 1.35), target=(0.0, 0.0, 1.55))
    cam.key(1, loc=(0.55, -1.35, 1.35))
    cam.key(n, loc=(0.45, -1.15, 1.42))
    return n


def cardboard_mat():
    m = bpy.data.materials.get("cardboard")
    if m:
        return m
    m = bpy.data.materials.new("cardboard"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 40; nz.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.42, 0.28, 0.14, 1); ramp.color_ramp.elements[1].color = (0.6, 0.43, 0.24, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def big_box(loc, open_top=False, W=1.0, D=0.8, H=1.15):
    """Cardboard shipping box (closed, or open-topped for Larry to burst out of)."""
    cb = cardboard_mat()
    tape = mat_flat("tape", (0.75, 0.62, 0.42), rough=0.35)
    root = empty("box", loc)
    t = 0.012
    parts = [((W, t, H), (0, -D / 2, H / 2)), ((W, t, H), (0, D / 2, H / 2)), ((t, D, H), (-W / 2, 0, H / 2)),
             ((t, D, H), (W / 2, 0, H / 2)), ((W, D, t), (0, 0, t / 2))]
    if not open_top:
        parts.append(((W, D, t), (0, 0, H - t / 2)))
        parts.append(((0.12, D + 0.004, 0.004), (0, 0, H + 0.002)))
    for i, (sz, p) in enumerate(parts):
        o = box(f"box_{i}", sz, p, tape if i == 6 else cb, bevel=0.004)
        o.parent = root
    tp = box("box_tape_front", (0.12, 0.004, 0.25), (0, -D / 2 - 0.006, H - 0.125), tape); tp.parent = root
    bpy.context.view_layer.update()
    mn, mx = bbox(root)
    return root, mn, mx


@shot
def sh15():
    """But Larry mails himself — giant box on your doorstep: FROM LARRY. It wobbles."""
    n = frames_of("sh15")
    egypt_set(pyramids=True, sky_rot=0)
    y0 = 6.0 - 2.5
    b, mn, mx = big_box((0.0, y0 - 1.15, 0))
    cx = (mn.x + mx.x) / 2; fy = mn.y - 0.004
    decal("label", f"{DECALS}/label_ship.png", 0.62, (cx - 0.05, fy, 0.62), rot=(90, 0, 0))
    decal("fragile", f"{DECALS}/label_fragile.png", 0.55, (cx, fy - 0.001, 0.98), rot=(90, 0, 0))
    for f, r in ((1, 0), (int(n * 0.45), 0), (int(n * 0.5), 4), (int(n * 0.55), -4), (int(n * 0.6), 3),
                 (int(n * 0.65), -2), (int(n * 0.7), 0), (n, 0)):
        key_rot(b, f, (0, r, 0))
    cam = Cam(lens=35, loc=(0.9, y0 - 4.4, 1.3), target=(0.0, y0 - 1.1, 0.8))
    cam.key(1, loc=(0.9, y0 - 4.4, 1.3))
    cam.key(n, loc=(0.65, y0 - 3.7, 1.2))
    return n


@shot
def sh16():
    """to your new house. — Larry bursts out of the box, arms up, ta-da."""
    n = frames_of("sh16")
    egypt_set(pyramids=True)
    y0 = 6.0 - 2.5
    b, mn, mx = big_box((0.0, y0 - 1.15, 0), open_top=True)
    cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    fy = mn.y - 0.004
    decal("label", f"{DECALS}/label_ship.png", 0.62, (cx - 0.05, fy, 0.62), rot=(90, 0, 0))
    decal("fragile", f"{DECALS}/label_fragile.png", 0.55, (cx, fy - 0.001, 0.98), rot=(90, 0, 0))
    larry = load_char("larry", (cx, cy, -1.3), rot_z=0, subdiv=True)
    larry.clip("13_10", **src(n, 150, speed=0.6))
    key_loc(larry.rig, 1, (cx, cy, -1.3))
    key_loc(larry.rig, 3, (cx, cy, -1.3))
    key_loc(larry.rig, 8, (cx, cy, 0.32))
    key_loc(larry.rig, 11, (cx, cy, 0.22))
    key_loc(larry.rig, n, (cx, cy, 0.24))
    face(larry, 1, TADA)
    look_at(larry, (0.6, y0 - 4.0, 1.6), 0.7)
    cmat = cardboard_mat()
    flaps = []
    for i, sx in enumerate((-1, 1)):
        f = box(f"flap{i}", (0.5, 0.75, 0.01), (cx + sx * 0.25, cy, mx.z), cmat)
        key_loc(f, 3, (cx + sx * 0.25, cy, mx.z)); key_rot(f, 3, (0, 0, 0))
        key_loc(f, 12, (cx + sx * 1.6, cy - 0.4, mx.z + 1.4)); key_rot(f, 12, (0, sx * 140, 30 * sx))
        key_loc(f, n, (cx + sx * 2.6, cy - 0.6, 0.05)); key_rot(f, n, (0, sx * 200, 50 * sx))
        flaps.append(f)
    key_scale(b, 3, 1.0)
    key_scale(b, 6, (1.08, 1.08, 0.9))
    key_scale(b, 10, 1.0)
    cam = Cam(lens=30, loc=(0.8, y0 - 4.4, 1.25), target=(0.0, y0 - 1.1, 1.45))
    cam.key(1, loc=(0.8, y0 - 4.4, 1.25))
    cam.key(n, loc=(0.7, y0 - 4.0, 1.25))
    cam.shake(4, 12, amp=0.03, freq=0.6)
    return n


# ============================================================================ INTERIOR (BODYGUARD)
def interior_set():
    world_color((0.7, 0.66, 0.6), 0.5)
    plane("floor", (12, 12), (0, 0, 0), mat_tex("wf", "wood_floor", scale=1.0), uv_scale=0.6)
    wall = mat_tex("iw", "beige_wall_001", scale=1.0, tint=(1.0, 0.97, 0.92))
    box("w_back", (12, 0.2, 3.2), (0, 3.0, 1.6), wall, uv_scale=0.5)
    box("w_left", (0.2, 12, 3.2), (-3.5, 0, 1.6), wall, uv_scale=0.5)
    box("w_right", (0.2, 12, 3.2), (3.5, 0, 1.6), wall, uv_scale=0.5)
    plane("ceil", (12, 12), (0, 0, 3.2), mat_flat("ceil", (0.9, 0.88, 0.85), rough=0.9), rot=(180, 0, 0))
    # ceiling vent (where Larry drops in)
    box("vent_hole", (0.7, 0.7, 0.04), (-0.55, 0.9, 3.19), mat_flat("dark", (0.01, 0.01, 0.01), rough=1))
    win = mat_flat("win", (1, 1, 1), emit=(1.0, 0.95, 0.85), emit_strength=4)
    plane("window", (1.6, 1.6), (2.0, 2.89, 1.7), win, rot=(90, 0, 0))
    model("hanging_picture_frame_01", (-1.8, 2.88, 1.75), rot_z=0)
    model("potted_plant_01", (2.9, 2.4, 0), scale=1.1)
    sun(energy=2.6, rot=(55, 0, 170), color=(1.0, 0.93, 0.82))
    area("fill", (0, -4, 2.6), (0, 0.5, 1.3), energy=600, size=4, color=(1.0, 0.95, 0.9))
    area("top", (0, 0, 3.1), (0, 0, 0), energy=300, size=5)


def vent_grate(open_from=1):
    g = box("grate", (0.68, 0.68, 0.02), (-0.55, 0.9, 3.17), mat_flat("grate", (0.85, 0.85, 0.85), metal=0.7, rough=0.35))
    hinge = empty("hinge", (-0.89, 0.9, 3.18))
    g.parent = hinge
    g.location = (0.34, 0.0, -0.01)
    key_rot(hinge, open_from, (0, 0, 0))
    key_rot(hinge, open_from + 6, (0, -100, 0))
    key_rot(hinge, open_from + 10, (0, -85, 0))
    return hinge


@shot
def sh17():
    """So you hire the biggest bodyguard — tilt up from his shoes to his sunglasses."""
    n = frames_of("sh17")
    interior_set()
    bg = load_char("bodyguard", (0.4, 0.4, 0), rot_z=0, scale=1.32, subdiv=True)
    bg.clip("137_41", **src(n, 4200))
    face(bg, 1, STERN)
    look_at(bg, (0.2, -4.0, 1.5), 0.7)
    cam = Cam(lens=24, loc=(0.0, -1.2, 0.18), target=(0.4, 0.4, 0.35))
    cam.key(1, loc=(0.0, -1.2, 0.18), target=(0.4, 0.4, 0.35))
    cam.key(int(n * 0.85), loc=(0.05, -1.55, 0.35), target=(0.42, 0.4, 2.12))
    cam.key(n, loc=(0.05, -1.6, 0.36), target=(0.42, 0.4, 2.15))
    return n


@shot
def sh18():
    """on earth. — wide: you are chest-high to him."""
    n = frames_of("sh18")
    interior_set()
    bg = load_char("bodyguard", (0.55, 0.4, 0), rot_z=0, scale=1.32)
    bg.clip("137_41", **src(n, 4250))
    face(bg, 1, STERN)
    you = load_char("you_sun", (-0.45, 0.2, 0), rot_z=0)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMUG)
    cam = Cam(lens=28, loc=(0.2, -4.2, 1.35), target=(0.1, 0.3, 1.45))
    cam.key(1, loc=(0.2, -4.2, 1.35))
    cam.key(n, loc=(0.15, -3.7, 1.35))
    return n


@shot
def sh19():
    """MUCH BETTER! — you, smug, hands on hips next to the giant."""
    n = frames_of("sh19")
    interior_set()
    bg = load_char("bodyguard", (0.55, 0.4, 0), rot_z=0, scale=1.32)
    bg.clip("137_41", **src(n, 4300))
    face(bg, 1, STERN)
    you = load_char("you_sun", (-0.45, 0.2, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4180))
    face(you, 1, dict(SMUG, mouthSmileRight=0.9))
    look_at(you, (-0.2, -3, 1.6), 0.6)
    cam = Cam(lens=38, loc=(-0.6, -1.65, 1.42), target=(-0.3, 0.2, 1.55))
    cam.key(1, loc=(-0.6, -1.65, 1.42))
    cam.key(n, loc=(-0.55, -1.4, 1.45))
    return n


def larry_hanging(hips, n, start_z, end_z, drop_frames=12, head="+X"):
    """Mission-Impossible Larry: horizontal, face down, arms out; hips placed at `hips` (x, y)."""
    sgn = 1 if head == "+X" else -1
    ox = hips[0] - sgn * 0.95
    larry = load_char("larry", (ox, hips[1], start_z), rot_z=0, subdiv=True)
    larry.tpose()
    larry.rig.rotation_euler = (math.radians(90), 0, math.radians(90 * sgn))
    key_loc(larry.rig, 1, (ox, hips[1], start_z))
    key_loc(larry.rig, max(2, drop_frames), (ox, hips[1], end_z))
    key_loc(larry.rig, n, (ox, hips[1], end_z - 0.03))
    return larry


@shot
def sh20():
    """Except Larry somehow still manages to — Larry descends Mission-Impossible style behind the bodyguard."""
    n = frames_of("sh20")
    interior_set()
    vent_grate(1)
    bg = load_char("bodyguard", (0.6, 0.0, 0), rot_z=0, scale=1.32)
    bg.clip("137_41", **src(n, 4300))
    face(bg, 1, STERN)
    you = load_char("you_sun", (-0.45, 0.25, 0), rot_z=0)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMUG)
    # Larry: horizontal, face down, arms out, lowered on a rope from the vent
    lx, ly = -0.55, 0.9
    larry = larry_hanging((lx, ly), n, 3.4, 2.05, drop_frames=int(n * 0.55))
    face(larry, 1, CREEPY)
    rope = cylinder("rope", 0.012, 2.0, (lx, ly, 3.2), mat_flat("rope", (0.75, 0.65, 0.45), rough=0.9), verts=8)
    rope.location = (lx, ly, 3.2)
    for f, z in ((1, 3.4), (int(n * 0.55), 2.05), (n, 2.02)):
        rope.scale = (1, 1, max(0.05, (3.2 - z) / 2.0) * 1.0)
        rope.location = (lx, ly, 3.2 - (3.2 - z) / 2)
        rope.keyframe_insert("scale", frame=f); rope.keyframe_insert("location", frame=f)
    cam = Cam(lens=24, loc=(1.3, -3.4, 1.0), target=(-0.2, 0.6, 1.95))
    cam.key(1, loc=(1.3, -3.4, 1.0))
    cam.key(n, loc=(1.2, -3.0, 1.05))
    return n


@shot
def sh21():
    """F***ING — rage close-up: red face, grey hair, screaming."""
    n = frames_of("sh21")
    interior_set()
    you = load_char("you_sun", (0, 0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    you.hide("sunglass")
    you.tint_skin((0.75, 0.05, 0.03), factor=0.72)
    you.set_color("short02", (0.42, 0.42, 0.44))
    face(you, 1, RAGE)
    look_at(you, (0.0, -2.0, 1.62), 0.9)
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.name.startswith(("fill", "top")):
            o.data.energy *= 0.35
    area("red_rim", (0.8, 0.8, 1.9), (0, 0, 1.6), energy=220, size=0.6, color=(1.0, 0.12, 0.08))
    area("red_rim2", (-0.8, 0.6, 1.8), (0, 0, 1.6), energy=160, size=0.6, color=(1.0, 0.1, 0.05))
    cam = Cam(lens=22, loc=(0.02, -0.42, 1.6), target=(0.0, 0.0, 1.62))
    cam.key(1, loc=(0.02, -0.42, 1.6))
    cam.key(n, loc=(0.02, -0.34, 1.6))
    cam.shake(1, n, amp=0.012, freq=0.9)
    return n


@shot
def sh22():
    """TOUCH YOU! — hanging Larry boops your cheek with one finger."""
    n = frames_of("sh22")
    interior_set()
    you = load_char("you_sun", (0, 0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, DEADPAN)
    larry = larry_hanging((1.05, -0.05), n, 1.62, 1.62, drop_frames=2, head="-X")
    face(larry, 1, CREEPY_ENJOY)
    look_at(larry, (0.0, -0.05, 1.65), 0.9)
    cheek = empty("cheek", (0, 0, 0))
    you.bake_follow(cheek, "Head", n, offset=(0.075, -0.06, 0.06),
                    extra=lambda f: (0.0, -0.04 * max(0.0, math.sin(f * 0.7)), 0.0))
    hand_ik(larry, "Right", cheek)
    rope = cylinder("rope", 0.012, 1.6, (1.05, -0.05, 2.45), mat_flat("rope", (0.75, 0.65, 0.45), rough=0.9), verts=8)
    cam = Cam(lens=34, loc=(0.42, -1.35, 1.72), target=(0.36, 0.0, 1.66))
    cam.key(1, loc=(0.42, -1.35, 1.72))
    cam.key(n, loc=(0.42, -1.2, 1.72))
    return n


# ============================================================================ ARMY
def soldier_source(char, clip, start, n, speed=1.0, name=None):
    ch = load_char(char, (0, 0, 0), tag=name or f"src_{char}_{clip}")
    ch.clip(clip, **src(n, start, speed=speed))
    coll = bpy.data.collections[ch.name]
    lib.scene().collection.children.unlink(coll)
    return coll, ch


def instance(coll, loc, rot_z=0.0, scale=1.0):
    e = bpy.data.objects.new("inst", None)
    e.instance_type = "COLLECTION"
    e.instance_collection = coll
    e.location = Vector(loc)
    e.rotation_euler = (0, 0, math.radians(rot_z))
    e.scale = (scale, scale, scale)
    lib.scene().collection.objects.link(e)
    return e


def army_dressing(y0):
    bag = model("cement_bag", (0, y0 - 4.2, 0.0), rot_z=90)
    fit(bag, length=0.7)
    for i in range(-7, 8):
        for (dx, z) in ((0.0, 0.0), (0.3, 0.27)):
            if i == 0 and dx == 0.0:
                continue
            c = lib.model_copy(bag, (i * 0.62 + dx, y0 - 4.2, bag.location.z + z), rot_z=90 + random.uniform(-6, 6))
    model("wooden_military_crate", (-4.6, y0 - 2.6, 0), rot_z=20, scale=1.2)
    model("old_military_crate", (-4.0, y0 - 2.0, 0), rot_z=-10, scale=1.2)
    model("old_military_crate", (4.4, y0 - 2.4, 0), rot_z=35, scale=1.2)
    model("portable_searchlight", (3.6, y0 - 3.4, 0.3), rot_z=200, scale=2.0)
    decal("nolarrys", f"{DECALS}/sign_nolarrys.png", 1.2, (-2.4, y0 - 4.55, 1.35), rot=(90, 0, 0))
    cylinder("nl_post", 0.04, 1.4, (-2.4, y0 - 4.5, 0.7), mat_flat("p", (0.35, 0.3, 0.25)))


def tank(loc, rot_z=0.0, length=7.0):
    t = append_blend("/opt/props/oga/cimpletoon/cimpletoon/armor.blend", loc, (0, 0, rot_z), 1.0, "tank",
                     filt=lambda nm: nm != "Cube.003")
    fit(t, length=length)
    drop_to(t, 0.0)
    olive = mat_flat("olive", (0.2, 0.22, 0.12), rough=0.75)
    dark = mat_flat("track", (0.05, 0.05, 0.05), rough=0.9)
    for o in lib.mesh_children(t):
        nm = o.name.lower()
        o.data.materials.clear()
        o.data.materials.append(dark if ("track" in nm or "wheel" in nm) else olive)
    return t


@shot
def sh23():
    """So you hire the entire army. — drone shot: soldiers, sandbags, tank, searchlights around your Egypt house."""
    n = frames_of("sh23")
    egypt_set(pyramids=True)
    y0 = 6.0 - 2.5
    army_dressing(y0)
    coll_a, _ = soldier_source("soldier", "138_01", 100, n, name="marchA")
    coll_b, _ = soldier_source("soldier2", "138_01", 140, n, name="marchB")
    k = 0
    for row in range(3):
        for col in range(-3, 4):
            c = coll_a if (row + col) % 2 == 0 else coll_b
            e = instance(c, (col * 1.3, y0 - 7.0 - row * 1.4, 0), rot_z=0)
            key_loc(e, 1, (col * 1.3, y0 - 7.0 - row * 1.4, 0))
            key_loc(e, n, (col * 1.3, y0 - 7.0 - row * 1.4 - 2.2, 0), interp="LINEAR")
            k += 1
    for (x, y, rz) in ((-5.5, y0 - 1.0, -90), (5.5, y0 - 1.0, 90), (-5.5, y0 + 3.0, -90), (5.5, y0 + 3.0, 90)):
        instance(coll_a, (x, y, 0), rot_z=rz)
    tank((-9.0, y0 - 6.0, 0), rot_z=60)
    cam = Cam(lens=24, loc=(10, y0 - 21, 8), target=(0, y0 - 5, 0.8), clip_end=4000)
    cam.key(1, loc=(10, y0 - 21, 8))
    cam.key(n, loc=(4, y0 - 24, 11), target=(0, y0 - 4, 0.8))
    return n


@shot
def sh24():
    """Tanks. — a tank rolls at the lens, turret swinging."""
    n = frames_of("sh24")
    egypt_set(house=False, pyramids=True, sky_rot=30)
    t = tank((0, 6, 0), rot_z=180)
    key_loc(t, 1, (0, 9, t.location.z))
    key_loc(t, n, (0, 6.0, t.location.z), interp="LINEAR")
    cam = Cam(lens=20, loc=(1.8, -3.0, 0.6), target=(0, 6.5, 1.4))
    cam.key(1, loc=(1.8, -3.0, 0.6))
    cam.key(n, loc=(1.5, -2.6, 0.55))
    cam.shake(1, n, amp=0.03, freq=0.8)
    return n


@shot
def sh25():
    """Jets. — two fighters scream overhead."""
    n = frames_of("sh25")
    egypt_set(house=False, pyramids=True, sky_rot=200)
    path = "/opt/props/oga/basic_replacements.blend/basic_replacements.blend"
    jets = []
    for i, (dx, dz) in enumerate(((-6, 0), (7, 3))):
        j = append_blend(path, (0, 0, 0), (0, 0, 0), 1.0, f"jet{i}", filt=lambda nm: nm == "rafale_B")
        for o in j.children:
            o.location = (0, 0, 0)
        fit(j, length=15.0, ground=False)
        key_loc(j, 1, (dx, -120, 22 + dz), interp="LINEAR")
        key_loc(j, n, (dx, 140, 26 + dz), interp="LINEAR")
        jets.append(j)
    cam = Cam(lens=24, loc=(0, 0, 1.6), target=(0, 30, 40))
    cam.key(1, loc=(0, 0, 1.6), target=(0, 5, 30))
    cam.key(n, loc=(0, 0, 1.6), target=(0, 45, 26))
    cam.shake(1, n, amp=0.6, freq=0.9)
    return n


@shot
def sh26():
    """A soldier at every window. — truck across the house front, a helmet in every window."""
    n = frames_of("sh26")
    egypt_set(pyramids=False, sky_rot=200)
    y0 = 6.0 - 2.5
    coll, _ = soldier_source("soldier", "137_41", 1000, n, name="winA")
    coll2, _ = soldier_source("soldier2", "137_41", 1500, n, name="winB")
    for i, x in enumerate((-2.2, 2.2)):
        instance(coll if i == 0 else coll2, (x, y0 + 0.45, 0.0), rot_z=0)
    instance(coll2, (0.0, y0 - 0.05, 0.0), rot_z=0)
    bpy.data.objects["door"].hide_render = True
    for x in (-2.4, 0.2, 2.6):
        instance(coll, (x, y0 + 0.9, 3.45), rot_z=0)
    cam = Cam(lens=30, loc=(-3.0, y0 - 5.5, 1.7), target=(-1.2, y0, 1.9))
    cam.key(1, loc=(-3.0, y0 - 5.5, 1.7), target=(-1.2, y0, 1.9))
    cam.key(n, loc=(3.0, y0 - 5.3, 1.8), target=(1.2, y0, 2.0))
    return n


@shot
def sh27():
    """Larry gets tackled — Larry tiptoes in, cartoon-sneaky."""
    n = frames_of("sh27")
    egypt_set(pyramids=True, sky_rot=120)
    larry = load_char("larry", (-1.2, -2.0, 0), rot_z=90)
    larry.clip("120_08", **src(n, 150, in_place=False))
    face(larry, 1, CREEPY)
    look_at(larry, (3.0, -5.0, 1.4), 0.5)
    cam = Cam(lens=30, loc=(-1.5, -6.2, 0.75), target=(-1.0, -2.0, 1.0))
    trk = cam.tgt
    larry.bake_follow(trk, "Hips", n, offset=(0.0, 0.0, 0.0))
    for f in range(1, n + 1, 3):
        bpy.context.scene.frame_set(f)
        hp = larry.world("Hips")
        key_loc(cam.cam, f, (hp.x - 0.6, -6.2, 0.75))
    return n


@shot
def sh28():
    """in two seconds. — dog-pile: three soldiers flatten Larry, dust everywhere."""
    n = frames_of("sh28")
    egypt_set(pyramids=True, sky_rot=120)
    larry = load_char("larry", (0, 0, 0), rot_z=90, subdiv=True)
    larry.hold("90_16", 600, face=False)
    face(larry, 1, OOF)
    soldiers = []
    for i, (ch, dx, dy, rz, z) in enumerate((("soldier", 0.2, 0.15, 60, 0.25), ("soldier2", -0.3, -0.2, 120, 0.42),
                                             ("soldier", 0.5, -0.1, 20, 0.6))):
        s = load_char(ch, (dx, dy, z), rot_z=rz, tag=f"pile{i}")
        s.hold("90_16", 600 + i * 30, face=False)
        face(s, 1, STERN)
        land = 2 + i * 3
        key_loc(s.rig, 1, (dx - 1.2, dy + 0.4, z + 1.6))
        key_loc(s.rig, land, (dx, dy, z), interp="LINEAR")
        key_loc(s.rig, n, (dx, dy, z))
        soldiers.append(s)
    dust = mat_flat("dust", (0.85, 0.75, 0.6), rough=1.0, alpha=0.22)
    if hasattr(dust, "surface_render_method"):
        dust.surface_render_method = "BLENDED"
    rnd = random.Random(3)
    for i in range(10):
        a = rnd.uniform(0, 6.28); r = rnd.uniform(0.5, 1.0)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.22, location=(math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12))
        d = bpy.context.object; d.data.materials.append(dust); bpy.ops.object.shade_smooth()
        t0 = 4 + i % 4
        key_scale(d, 1, 0.01)
        key_scale(d, t0, 0.01)
        key_loc(d, t0, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12))
        key_scale(d, n, rnd.uniform(0.9, 1.5))
        key_loc(d, n, (math.cos(a) * r, math.sin(a) * r, rnd.uniform(0.15, 0.45)))
    cam = Cam(lens=26, loc=(1.6, -2.2, 0.9), target=(0.0, 0.0, 0.35))
    cam.key(1, loc=(1.6, -2.2, 0.9))
    cam.key(n, loc=(1.3, -1.8, 0.8))
    cam.shake(5, 14, amp=0.04, freq=0.8)
    return n


# ============================================================================ BEDROOM (NIGHT)
def bedroom_set():
    world_color((0.04, 0.06, 0.15), 0.7)
    plane("floor", (10, 10), (0, 0, 0), mat_tex("bf", "wood_floor", scale=1.0, tint=(0.6, 0.6, 0.7)), uv_scale=0.6)
    wall = mat_tex("bw", "painted_plaster_wall", scale=1.0, tint=(0.5, 0.6, 0.85))
    box("w_back", (10, 0.2, 3.0), (0, 2.75, 1.5), wall, uv_scale=0.5)
    box("w_left", (0.2, 10, 3.0), (-2.6, 0, 1.5), wall, uv_scale=0.5)
    # right wall (x=2.6) with a window opening around y=0.6
    for nm, sz, loc in (("wr_a", (0.2, 4.4, 3.0), (2.6, -2.8, 1.5)), ("wr_b", (0.2, 3.4, 3.0), (2.6, 3.0, 1.5)),
                        ("wr_c", (0.2, 1.4, 0.9), (2.6, 0.6, 0.45)), ("wr_d", (0.2, 1.4, 0.7), (2.6, 0.6, 2.65))):
        box(nm, sz, loc, wall, uv_scale=0.5)
    plane("ceil", (10, 10), (0, 0, 3.0), mat_flat("c", (0.45, 0.5, 0.65)), rot=(180, 0, 0))
    wood = mat_flat("bedwood", (0.22, 0.13, 0.08), rough=0.5)
    box("bed_frame", (1.7, 2.35, 0.35), (0, 0.98, 0.2), wood)
    box("headboard", (1.8, 0.08, 1.15), (0, 2.18, 0.58), wood)
    box("mattress", (1.6, 2.2, 0.22), (0, 1.0, 0.48), mat_flat("sheet", (0.85, 0.87, 0.92), rough=0.9), bevel=0.05)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, 1.88, 0.66)); p = bpy.context.object
    p.scale = (1.15, 0.5, 0.3); p.name = "pillow"; bpy.ops.object.shade_smooth()
    p.data.materials.append(mat_flat("pillowm", (0.9, 0.9, 0.95), rough=0.9))
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=40, size=1, location=(0, 0.5, 0.9))
    bl = bpy.context.object; bl.name = "blanket"; bl.scale = (1.75, 1.66, 1)
    bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new("bln", "CLOUDS"); tex.noise_scale = 0.25
    dsp = bl.modifiers.new("d", "DISPLACE"); dsp.texture = tex; dsp.strength = 0.04
    bl.modifiers.new("s", "SOLIDIFY").thickness = 0.02
    bpy.ops.object.shade_smooth()
    bl.data.materials.append(mat_tex("blm", "denim_fabric", scale=1.0, tint=(0.4, 0.5, 0.95), normal_strength=0.3))
    lib._cube_uv(bl, 1.5)
    model("painted_wooden_nightstand", (-1.25, 1.9, 0), rot_z=180)
    model("desk_lamp_arm_01", (-1.25, 1.9, 0.62), rot_z=200, scale=0.8)
    win = mat_flat("night", (0.05, 0.1, 0.25), emit=(0.25, 0.4, 0.8), emit_strength=2.0)
    plane("win_sky", (6, 4), (7.0, 0.6, 1.6), win, rot=(90, 0, 90))
    area("moon", (5.0, 0.6, 2.6), (0, 1.0, 0.7), energy=2600, size=0.6, color=(0.55, 0.7, 1.0), shadow=True)
    area("fill", (-1.6, -1.8, 2.2), (0, 1.0, 0.8), energy=170, size=2.5, color=(0.45, 0.58, 1.0))
    area("bedkey", (-0.6, 1.3, 2.2), (0, 1.75, 0.8), energy=110, size=1.0, color=(0.6, 0.72, 1.0))
    point("lampglow", (-1.25, 1.95, 1.0), energy=6, color=(1.0, 0.7, 0.4), radius=0.1)
    return bl


def you_in_bed(subdiv=True):
    you = load_char("you_pj", (0, 0, 0), subdiv=subdiv)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-86), 0, 0)
    you.rig.location = (0.0, 0.08, 0.7)
    face(you, 1, SLEEP)
    return you


@shot
def sh29():
    """Now you finally sleep in peace. — moonlit bedroom, slow push-in, guard silhouetted outside the window."""
    n = frames_of("sh29")
    bedroom_set()
    you = you_in_bed()
    g = load_char("soldier", (3.6, 0.6, 0), rot_z=90)
    g.clip("137_41", **src(n, 1000))
    cam = Cam(lens=26, loc=(-1.9, -0.4, 2.35), target=(0.25, 1.3, 0.8))
    cam.key(1, loc=(-1.9, -0.4, 2.35))
    cam.key(n, loc=(-1.25, 0.35, 2.05), target=(0.05, 1.6, 0.78))
    return n


def tuck_scene(n):
    bedroom_set()
    you = you_in_bed()
    ls = load_char("larry_soldier", (0.78, 1.35, 0), rot_z=-90, subdiv=True)
    ls.clip("15_06", **src(n, 440, speed=0.3))
    look_at(ls, (0.0, 1.75, 0.8), 0.85)
    for side, dy in (("Left", -0.12), ("Right", 0.18)):
        t = empty(f"tuck{side}", (0, 0, 0))
        for f in range(1, n + 1, 4):
            key_loc(t, f, (0.32 + 0.03 * math.sin(f * 0.4), 1.36 + dy, 0.98 + 0.012 * math.sin(f * 0.6)))
        hand_ik(ls, side, t)
    area("larry_face", (-0.7, 1.3, 1.1), (0.75, 1.45, 1.45), energy=90, size=0.5, color=(0.7, 0.8, 1.0))
    return you, ls


@shot
def sh30():
    """The soldier tucking you in — camo arms gently tuck the blanket under your chin."""
    n = frames_of("sh30")
    you, ls = tuck_scene(n)
    face(ls, 1, CREEPY_ENJOY)
    cam = Cam(lens=40, loc=(-0.9, 0.85, 1.55), target=(0.12, 1.62, 0.86))
    cam.key(1, loc=(-0.9, 0.85, 1.55))
    cam.key(n, loc=(-0.78, 1.0, 1.5))
    return n


@shot
def sh31():
    """is Larry. — tilt up from the blanket to the soldier's face: it's Larry. Wink. (sting)"""
    n = frames_of("sh31")
    you, ls = tuck_scene(n)
    rev = at("sh31", 46.95)
    face(ls, 1, CREEPY_ENJOY)
    face(ls, rev, CREEPY)
    face(ls, rev + 14, WINK)
    face(ls, n, WINK)
    cam = Cam(lens=40, loc=(-0.8, 1.0, 1.5), target=(0.15, 1.62, 0.88))
    cam.key(1, loc=(-0.8, 1.0, 1.5), target=(0.15, 1.62, 0.88), lens=40)
    cam.key(max(2, rev - 3), loc=(-0.78, 1.05, 1.5), target=(0.3, 1.55, 1.0))
    cam.key(rev + 8, loc=(-0.25, 1.45, 1.36), target=(0.5, 1.6, 1.5), lens=46)
    snap = at("sh31", 48.02)
    cam.key(snap - 1, loc=(-0.22, 1.47, 1.37), target=(0.5, 1.6, 1.51), lens=48, interp="CONSTANT")
    cam.key(snap, loc=(-0.22, 1.47, 1.37), target=(0.5, 1.6, 1.52), lens=66, interp="CONSTANT")
    cam.key(n, loc=(-0.2, 1.48, 1.38), target=(0.5, 1.6, 1.52), lens=70)
    cam.shake(snap, n, amp=0.008, freq=0.8)
    # Larry slowly turns his head and stares straight into the lens
    stare = look_at(ls, cam.cam, 0.0)
    stare.influence = 0.0; stare.keyframe_insert("influence", frame=max(1, rev - 1))
    stare.influence = 1.0; stare.keyframe_insert("influence", frame=rev + 8)
    return n
