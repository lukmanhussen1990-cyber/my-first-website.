"""Shot definitions for Episode 14 "Husband and Husband": Dale (your stepdad since episode 11) kidnaps you in a
garbage truck and duct-tapes you to a chair at the altar; the priest is also Dale, in a fake moustache. Larry bursts
in wearing a wedding dress; cake, a thrown priest and a cartoon fight cloud (down the aisle, over the benches, out the
window, back in through the roof); the real priest wakes up and pronounces Larry and Dale husband and husband...
and they want to adopt you. Same pipeline as episodes 1-13 (imports the newest episode, 13 -> 12 -> ...).
Costumes are scene props only (skirt and veil, priest's collar and moustache, duct tape): character files untouched.
Smoothness rules from episodes 12-13: no finger close-ups, seated/kneeling heads levelled, whole-body motion through
pivots, hand targets world-fixed or parented to the moving pivot."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector, Euler
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_color,
                 sun, area, point, Cam, key_loc, key_rot)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep13 = _load("ep13shots", "ep13")         # newest episode (its chain: 12, 11, 10, ... 1)
ep12, ep11, ep9, ep6, ep3, ep2, ep1 = ep13.ep12, ep13.ep11, ep13.ep9, ep13.ep6, ep13.ep3, ep13.ep2, ep13.ep1
from ep2shots import (SMILE, SMUG, CREEPY, UNEASY, DETERMINED, SHOCK, DEADPAN, TADA, face, blink, look_at, hand_ik,
                      src, pose, settle, on_bone)  # noqa: E402
STERN, RAGE = ep1.STERN, ep1.RAGE
GRIN, SCREAM = ep6.GRIN, ep9.SCREAM
load_char, closeup, face_light = ep9.load_char, ep9.closeup, ep9.face_light
look_keys, sit_level = ep12.look_keys, ep12.sit_level
rocker, glue, rock, laugh, talk, hold, head = ep13.rocker, ep13.glue, ep13.rock, ep13.laugh, ep13.talk, ep13.hold, ep13.head

D14 = os.path.join(lib.SCRATCH, "ep14", "decals")
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


NECK = {"lowerneck": {"rx": 18}, "upperneck": {"rx": 16}}          # the base pose tips the head back ~34 deg
KNEEL_LEVEL = dict(ep3.KNEEL, **NECK)
DAZED = {"eyeBlinkLeft": 0.45, "eyeBlinkRight": 0.7, "jawOpen": 0.15, "browInnerUp": 0.5, "mouthFrownLeft": 0.3}
ANNOYED = dict(STERN, eyeSquintLeft=0.4, eyeSquintRight=0.4, mouthFrownLeft=0.6, mouthFrownRight=0.6)
GLASS = [(0.78, 0.12, 0.16), (0.12, 0.27, 0.75), (0.94, 0.75, 0.16), (0.16, 0.59, 0.27), (0.51, 0.16, 0.63)]


def rnd(seed):
    return random.Random(seed)


def vis(obj, f_on=None, f_off=None):
    """Keyframe hide_render: hidden before f_on, hidden from f_off."""
    for o in [obj] + list(obj.children_recursive):
        o.hide_render = f_on is not None; o.keyframe_insert("hide_render", frame=1)
        if f_on is not None:
            o.hide_render = True; o.keyframe_insert("hide_render", frame=max(1, f_on - 1))
            o.hide_render = False; o.keyframe_insert("hide_render", frame=f_on)
        if f_off is not None:
            o.hide_render = False; o.keyframe_insert("hide_render", frame=max(1, f_off - 1))
            o.hide_render = True; o.keyframe_insert("hide_render", frame=f_off)


# ============================================================================ characters & costumes
def you_char(loc=(0, 0, 0), rot_z=0.0, sd=True):
    return load_char("you_casual", loc, rot_z=rot_z, subdiv=sd, tag="you")


def dale_char(loc=(0, 0, 0), rot_z=0.0, sd=True, tag="dale"):
    return load_char("dale", loc, rot_z=rot_z, subdiv=sd, tag=tag)


def larry_char(loc=(0, 0, 0), rot_z=0.0, sd=True, dress=True):
    ch = load_char("larry", loc, rot_z=rot_z, subdiv=sd, tag="larry")
    if dress:
        wedding_dress(ch)
    return ch


def wedding_dress(ch):
    """Big white skirt from the waist down, a veil from the crown, a bouquet in the left hand."""
    satin = mat_flat("satin", (0.97, 0.96, 0.94), rough=0.35)
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.62, radius2=0.2, depth=1.0, location=(0, 0, 0))
    sk = bpy.context.object; sk.name = "skirt"; sk.data.materials.append(satin); bpy.ops.object.shade_smooth()
    on_bone(ch, sk, "Hips", (0.0, -0.42, 0.0), rot=(-90, 0, 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.045, location=(0, 0, 0))
    bt = bpy.context.object; bt.name = "skirt_band"; bt.data.materials.append(satin)
    on_bone(ch, bt, "Hips", (0.0, 0.08, 0.0), rot=(-90, 0, 0))
    veil_m = mat_flat("veil", (1.0, 1.0, 1.0), rough=0.6, alpha=0.55)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.34, radius2=0.09, depth=0.75, location=(0, 0, 0))
    v = bpy.context.object; v.name = "veil"; v.data.materials.append(veil_m); bpy.ops.object.shade_smooth()
    on_bone(ch, v, "Head", (0.0, -0.18, -0.12), rot=(-90, 0, 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.018, location=(0, 0, 0))
    tiara = bpy.context.object; tiara.name = "tiara"; tiara.data.materials.append(mat_flat("tiara", (0.95, 0.85, 0.5), metal=1.0, rough=0.2))
    on_bone(ch, tiara, "Head", (0.0, 0.13, -0.01), rot=(-90, 0, 0))
    bq = empty("bouquet")
    r = rnd(4)
    for k in range(9):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.045,
                                             location=(r.uniform(-0.06, 0.06), r.uniform(-0.06, 0.06), r.uniform(0.0, 0.07)))
        f = bpy.context.object; f.parent = bq
        f.data.materials.append(mat_flat(f"rose{k % 3}", [(0.95, 0.4, 0.55), (1.0, 1.0, 1.0), (0.9, 0.2, 0.3)][k % 3], rough=0.6))
    on_bone(ch, bq, "LeftHand", (0.0, 0.1, 0.03), rot=(-90, 0, 0))
    return sk


def priest_bits(ch):
    """Fake moustache and a white collar: the priest who is also Dale."""
    m = mat_flat("fakestache", (0.04, 0.03, 0.025), rough=0.8)
    st = empty("stache")
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=0.04, location=(s * 0.032, 0, 0))
        o = bpy.context.object; o.scale = (1.25, 0.32, 0.45); o.rotation_euler = (0, s * math.radians(14), 0)
        o.data.materials.append(m); o.parent = st
    on_bone(ch, st, "Head", (0.0, -0.035, 0.112), rot=(-90, 0, 0))
    col = box("collar", (0.05, 0.012, 0.035), (0, 0, 0), mat_flat("collarm", (1, 1, 1), rough=0.4))
    on_bone(ch, col, "Neck1", (0.0, 0.02, 0.065), rot=(-90, 0, 0))
    return st


def tape_mat():
    return mat_flat("ducttape", (0.55, 0.56, 0.58), rough=0.4, metal=0.3)


def mouth_tape(ch):
    t = box("mouthtape", (0.085, 0.004, 0.035), (0, 0, 0), tape_mat())
    on_bone(ch, t, "Head", (0.0, -0.05, 0.1), rot=(-90, 0, 0))
    return t


def tape_bands(ch, piv):
    """Grey duct-tape bands round his chest, belly and arms (arms down by his sides), riding with the pivot."""
    bpy.context.view_layer.update()
    for k, (bone, rx, ry, zoff) in enumerate((("Spine1", 0.3, 0.2, 0.0), ("Spine", 0.29, 0.19, -0.02), ("LowerBack", 0.28, 0.19, 0.05))):
        p = ch.world(bone, frame=1)
        c = cylinder(f"tape{k}", 1.0, 0.08, p + Vector((0, 0, zoff)), tape_mat(), verts=28)
        c.scale = (rx, ry, 1.0)
        c.rotation_euler = (0, 0, ch.rig.matrix_world.to_euler().z)
        glue(c, piv)


def splat_on(ch, f_on=None, n_head=5, n_body=4, seed=3):
    """White cake blobs on his face, head and shoulders (appear at f_on)."""
    cream = mat_flat("cream", (0.98, 0.95, 0.88), rough=0.25)
    r = rnd(seed)
    out = []
    for k in range(n_head + n_body):
        bone = "Head" if k < n_head else ("LeftShoulder" if k % 2 else "RightShoulder")
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=r.uniform(0.03, 0.055))
        b = bpy.context.object; b.name = f"cake_{ch.name}_{k}"; b.scale = (1.0, 1.0, 0.6)
        b.data.materials.append(cream); bpy.ops.object.shade_smooth()
        if bone == "Head":
            loc = (r.uniform(-0.07, 0.07), r.uniform(-0.02, 0.12), r.uniform(0.06, 0.1))
        else:
            loc = (r.uniform(-0.04, 0.04), r.uniform(0.0, 0.08), r.uniform(-0.02, 0.06))
        on_bone(ch, b, bone, loc, rot=(r.uniform(-30, 30), r.uniform(-30, 30), 0))
        if f_on:
            vis(b, f_on=f_on)
        out.append(b)
    return out


# ============================================================================ props
def wooden_chair(loc, facing=0.0, name="wchair"):
    """White wedding chair; facing = direction the sitter faces (0 = -Y). Returns (pivot, seat height)."""
    white = mat_flat(f"{name}_w", (0.95, 0.94, 0.9), rough=0.35)
    piv = empty(name, loc); piv.rotation_euler = (0, 0, math.radians(facing))
    parts = [box(f"{name}_seat", (0.46, 0.46, 0.05), (0, 0, 0.46), white, bevel=0.01)]
    for dx in (-0.2, 0.2):
        for dy in (-0.2, 0.2):
            parts.append(box(f"{name}_leg{dx}{dy}", (0.035, 0.035, 0.46), (dx, dy, 0.23), white))
        parts.append(box(f"{name}_post{dx}", (0.035, 0.035, 0.5), (dx, 0.21, 0.72), white))
    for z in (0.62, 0.78, 0.94):
        parts.append(box(f"{name}_rail{z}", (0.44, 0.03, 0.03), (0, 0.21, z), white))
    for p in parts:
        p.parent = piv
    return piv, 0.485


def seat_in(ch, chair_loc, facing, chair_fn=wooden_chair):
    piv, sz = chair_fn(chair_loc, facing)
    back = Vector((0, 0.02, 0)); back.rotate(Euler((0, 0, math.radians(facing))))
    ch.rig.location = (chair_loc[0] + back.x, chair_loc[1] + back.y, chair_loc[2] if len(chair_loc) > 2 else 0)
    ch.rig.rotation_euler = (0, 0, math.radians(facing))
    sit_level(ch, sz + (chair_loc[2] if len(chair_loc) > 2 else 0))
    return piv


def cake(loc=(0, 0, 0), name="cake"):
    root = empty(name, loc)
    icing = mat_flat("icing", (0.98, 0.96, 0.92), rough=0.3)
    pink = mat_flat("icingpink", (0.95, 0.55, 0.65), rough=0.4)
    for k, (r, h) in enumerate(((0.24, 0.16), (0.17, 0.14), (0.1, 0.12))):
        z = sum(hh for _, hh in ((0.24, 0.16), (0.17, 0.14), (0.1, 0.12))[:k])
        cylinder(f"{name}_t{k}", r, h, (0, 0, z + h / 2), icing, verts=32).parent = root
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.014, location=(0, 0, z + h))
        t = bpy.context.object; t.data.materials.append(pink); t.parent = root
    return root


def ring_box(name="ringbox"):
    root = empty(name)
    box(f"{name}_b", (0.07, 0.07, 0.04), (0, 0, 0.02), mat_flat("velvet14", (0.55, 0.05, 0.08), rough=0.8)).parent = root
    lid = box(f"{name}_lid", (0.07, 0.012, 0.06), (0, 0.035, 0.07), mat_flat("velvet14b", (0.5, 0.04, 0.07), rough=0.8))
    lid.rotation_euler = (math.radians(-20), 0, 0); lid.parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.015, minor_radius=0.004, location=(0, 0, 0.055), rotation=(math.radians(90), 0, 0))
    rg = bpy.context.object; rg.data.materials.append(mat_flat("gold14", (0.95, 0.75, 0.3), metal=1.0, rough=0.2)); rg.parent = root
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.008, location=(0, 0, 0.073))
    dm = bpy.context.object; dm.data.materials.append(mat_flat("diamond", (0.9, 0.95, 1.0), emit=(0.8, 0.9, 1.0), emit_strength=2)); dm.parent = root
    return root


def trash_bags(parent, center, n=6, seed=2):
    m = mat_flat("trashbag", (0.03, 0.03, 0.035), rough=0.2, metal=0.1)
    r = rnd(seed)
    for k in range(n):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=r.uniform(0.22, 0.32),
                                             location=(center[0] + r.uniform(-0.25, 0.25), center[1] + r.uniform(-0.9, 0.9), center[2] + r.uniform(0, 0.25)))
        b = bpy.context.object; b.scale = (1.0, 1.0, 0.8); b.data.materials.append(m); bpy.ops.object.shade_smooth()
        b.parent = parent


# ============================================================================ the church
DOOR_Y = -10.5
WIN_HIT = (4.84, -3.6, 2.9)          # the stained-glass window the fight goes out of (right wall)
ROOF_HIT = (0.0, -2.0)               # where it comes back in through the ceiling
CEIL_Z = 7.0
YOU_CH = (-0.55, 1.35)               # your chair at the altar (you face +Y)
DALE_AT = (0.6, 1.45)                # Dale the groom, beside you, facing +Y
PRIEST_AT = (0.0, 3.3, 0.3)          # Dale the priest behind the altar, on the platform, facing -Y


def church(doors_open=None, broken_window=None, roof_hole=None):
    """Stone church: red-carpet aisle down +Y to a raised altar, benches both sides, stained glass, rose window,
    double doors at the back (-Y). doors_open = (f0, f1) swings them open; broken_window = frame the right-hand
    window smashes; roof_hole = frame the ceiling tiles over the aisle go."""
    world_color((0.55, 0.5, 0.45), 0.35)
    stone = mat_tex("chstone", "floor_tiles_02", scale=1.0, tint=(0.82, 0.74, 0.64))
    plane("ch_floor", (10, 17), (0, -2.5, 0), stone, uv_scale=0.6)
    plane("aisle", (1.4, 12.4), (0, -4.2, 0.006), mat_flat("redcarpet", (0.55, 0.05, 0.07), rough=0.9))
    wall = mat_tex("chwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.92, 0.85))
    box("ch_back", (10, 0.3, CEIL_Z), (0, 5.15, CEIL_Z / 2), wall, uv_scale=0.4)
    box("ch_left", (0.3, 17, CEIL_Z), (-5.0, -2.5, CEIL_Z / 2), wall, uv_scale=0.4)
    box("ch_right", (0.3, 17, CEIL_Z), (5.0, -2.5, CEIL_Z / 2), wall, uv_scale=0.4)
    for nm, sz, lc in (("fl", (3.7, 0.3, CEIL_Z), (-3.15, DOOR_Y, CEIL_Z / 2)), ("fr", (3.7, 0.3, CEIL_Z), (3.15, DOOR_Y, CEIL_Z / 2)),
                       ("ft", (2.6, 0.3, CEIL_Z - 3.3), (0, DOOR_Y, 3.3 + (CEIL_Z - 3.3) / 2))):
        box(f"ch_front_{nm}", sz, lc, wall, uv_scale=0.4)
    # ceiling: big panels around a 2 x 2 m patch of tiles over the aisle (the roof hole)
    ceil = mat_flat("chceil", (0.62, 0.45, 0.3), rough=0.7)
    hx, hy = ROOF_HIT
    for nm, sz, lc in (("cl", (4.0, 17), (-3.0, -2.5)), ("cr", (4.0, 17), (3.0, -2.5)),
                       ("cf", (2.0, 5.5 + (hy - 1.0) + 5.0), (0, (DOOR_Y + hy - 1.0) / 2)), ("cb", (2.0, 5.0 - (hy + 1.0)), (0, (hy + 1.0 + 5.0) / 2))):
        plane(f"ch_ceil_{nm}", sz, (lc[0], lc[1], CEIL_Z), ceil, rot=(180, 0, 0))
    tiles = []
    for ix in (-0.5, 0.5):
        for iy in (-0.5, 0.5):
            t = plane(f"ch_tile{ix}{iy}", (1.0, 1.0), (hx + ix, hy + iy, CEIL_Z), ceil, rot=(180, 0, 0))
            tiles.append(t)
            if roof_hole:
                vis(t, f_off=roof_hole)
    for k in range(-9, 5, 2):                                              # beams
        box(f"beam{k}", (10, 0.25, 0.3), (0, k, CEIL_Z - 0.15), mat_flat("beam", (0.3, 0.18, 0.1), rough=0.6))
    # altar platform, altar table, arch of flowers, candles
    box("platform", (7.0, 2.9, 0.3), (0, 3.65, 0.15), mat_flat("platformm", (0.85, 0.82, 0.78), rough=0.6))
    box("altar", (1.4, 0.6, 0.95), (0, 2.75, 0.3 + 0.475), mat_flat("altarcloth", (0.97, 0.96, 0.93), rough=0.6))
    box("altar_runner", (0.35, 0.62, 0.96), (0, 2.75, 0.3 + 0.48), mat_flat("runner", (0.75, 0.6, 0.2), rough=0.5, metal=0.4))
    white = mat_flat("pillar", (0.96, 0.95, 0.92), rough=0.4)
    for s in (-1, 1):
        cylinder(f"archpost{s}", 0.07, 2.8, (s * 1.6, 2.35, 1.7), white, verts=16)
        for k in range(6):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.13, location=(s * 1.6, 2.35, 0.6 + k * 0.42))
            f = bpy.context.object; f.data.materials.append(mat_flat(f"archflower{k % 2}", [(0.98, 0.98, 0.98), (0.95, 0.5, 0.6)][k % 2], rough=0.6))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.6, minor_radius=0.07, location=(0, 2.35, 3.1), rotation=(math.radians(90), 0, 0))
    arch = bpy.context.object; arch.data.materials.append(white)
    flame = mat_flat("flame14", (1.0, 0.7, 0.3), emit=(1.0, 0.6, 0.2), emit_strength=6)
    for s in (-1, 1):
        cylinder(f"candle{s}", 0.03, 0.3, (s * 0.5, 2.6, 1.4), white, verts=12)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.02, location=(s * 0.5, 2.6, 1.58))
        fl = bpy.context.object; fl.scale = (1, 1, 1.8); fl.data.materials.append(flame)
    # benches both sides of the aisle
    wood = mat_flat("pew", (0.32, 0.18, 0.09), rough=0.45)
    pews = []
    for row in range(7):
        y = -8.6 + row * 1.15
        for side in (-1, 1):
            p = empty(f"pew{row}{side}", (side * 2.65, y, 0))
            box(f"pew_seat{row}{side}", (3.1, 0.42, 0.06), (0, 0, 0.45), wood).parent = p
            box(f"pew_back{row}{side}", (3.1, 0.06, 0.5), (0, 0.22, 0.78), wood).parent = p
            for e in (-1.55, 1.55):
                box(f"pew_end{row}{side}{e}", (0.06, 0.5, 0.95), (e, 0.02, 0.47), wood).parent = p
            pews.append(p)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.11, location=(side * 1.05, y, 1.0))
            bf = bpy.context.object; bf.data.materials.append(mat_flat("pewflower", (0.98, 0.97, 0.97), rough=0.6))
    # stained glass on both side walls, rose window over the altar
    wins = {}
    for side in (-1, 1):
        for k, y in enumerate((-7.0, -3.6, -0.2)):
            img = f"{D14}/stained{(k + (side > 0)) % 3 + 1}.png"
            d = decal(f"win{side}{k}", img, 1.3, (side * 4.84, y, 2.9), rot=(90, 0, -90 if side > 0 else 90), emit=2.2, alpha=True)
            wins[(side, k)] = d
    if broken_window:
        w = wins[(1, 1)]
        vis(w, f_off=broken_window)
        bw = decal("win_broken", f"{D14}/stained_broken.png", 1.3, WIN_HIT, rot=(90, 0, -90), emit=2.2, alpha=True)
        vis(bw, f_on=broken_window)
    decal("rose", f"{D14}/rose.png", 2.4, (0, 4.99, 4.6), rot=(90, 0, 0), emit=2.2, alpha=True)
    # doors and the bright day outside
    hinges = []
    door_m = mat_flat("chdoor", (0.35, 0.2, 0.1), rough=0.5)
    for s in (-1, 1):
        h = empty(f"hinge{s}", (s * 1.3, DOOR_Y, 0))
        dp = box(f"door{s}", (1.3, 0.1, 3.3), (-s * 0.65, 0, 1.65), door_m, bevel=0.02); dp.parent = h
        box(f"doorband{s}", (1.2, 0.12, 0.08), (-s * 0.65, 0, 2.6), mat_flat("doorband", (0.15, 0.15, 0.15), metal=0.6)).parent = h
        hinges.append(h)
        if doors_open:
            f0, f1 = doors_open
            for f, a in ((1, 0), (f0, 0), (f1, 108), (f1 + 4, 92), (f1 + 8, 99), (f1 + 12, 96)):
                h.rotation_euler = (0, 0, math.radians(-s * a)); h.keyframe_insert("rotation_euler", frame=f)
    plane("outside", (12, 8), (0, DOOR_Y - 3.5, 3.5), mat_flat("daylight", (1, 1, 1), emit=(1.0, 0.97, 0.9), emit_strength=3.0), rot=(90, 0, 0))
    plane("porch14", (6, 4), (0, DOOR_Y - 1.8, 0.002), stone, uv_scale=0.6)
    # light
    sun(energy=2.2, rot=(50, 0, -110), color=(1.0, 0.9, 0.75))
    area("altarlight", (0, 0.5, 5.5), (0, 2.0, 0.8), energy=900, size=4.0, color=(1.0, 0.92, 0.8), shadow=True)
    area("navelight", (0, -5.5, 6.0), (0, -5.0, 0), energy=900, size=6.0, color=(1.0, 0.9, 0.8))
    area("fill14", (0, -3.0, 2.5), (0, 2.0, 1.2), energy=350, size=3.0, color=(1.0, 0.95, 0.9))
    return {"hinges": hinges, "pews": pews, "tiles": tiles, "wins": wins}


def at_altar(n, you=True, groom=True, priest=True, taped=True, gag=False, sd=True):
    """You taped into a chair at the altar, Dale the groom beside you, Dale the priest behind the altar."""
    out = {}
    if you:
        y = you_char(sd=sd)
        seat_in(y, YOU_CH, 180.0)
        piv = rocker(y)
        for side, dx in (("Left", -0.21), ("Right", 0.21)):                 # facing +Y: left is -X
            hold(y, side, (YOU_CH[0] + dx, YOU_CH[1] + 0.32, 0.6), piv=piv, name=f"you_lap_{side}")
        if taped:
            tape_bands(y, piv)
        if gag:
            mouth_tape(y)
        out["you"], out["you_piv"] = y, piv
    if groom:
        d = dale_char(sd=sd)
        d.rig.location = (DALE_AT[0], DALE_AT[1], 0); d.rig.rotation_euler = (0, 0, math.radians(180))
        d.clip("137_28", **src(n, 2400))
        out["dale"] = d
    if priest:
        p = dale_char(PRIEST_AT, rot_z=0.0, sd=sd, tag="dpriest")
        p.clip("137_41", **src(n, 1500))
        priest_bits(p)
        book = box("bible", (0.2, 0.15, 0.04), (0, 2.88, 1.29), mat_flat("bible", (0.08, 0.06, 0.05), rough=0.5))
        book.rotation_euler = (math.radians(-30), 0, 0)
        for side, dx in (("Right", -0.09), ("Left", 0.09)):                 # facing -Y: right is -X
            hold(p, side, (dx, 2.9, 1.3), name=f"book_{side}")
        out["priest"] = p
    return out


# ============================================================================ the fight cloud & debris
def fight_cloud(name="cloud"):
    """Cartoon brawl: a churning dust ball with sleeves, a shoe and the veil popping out, stars circling."""
    root = empty(name)
    ball = empty(f"{name}_spin"); ball.parent = root
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.85)
    c = bpy.context.object; c.name = f"{name}_ball"
    tx = bpy.data.textures.get("puff14") or bpy.data.textures.new("puff14", "CLOUDS"); tx.noise_scale = 0.35
    dm = c.modifiers.new("puff", "DISPLACE"); dm.texture = tx; dm.strength = 0.5
    c.data.materials.append(mat_flat(f"{name}_dust", (0.88, 0.85, 0.8), rough=0.95))
    bpy.ops.object.shade_smooth(); c.parent = ball
    limbs = []
    mats = [mat_flat("sleeve_dale", (0.25, 0.3, 0.25), rough=0.7), mat_flat("sleeve_larry", (0.97, 0.96, 0.94), rough=0.4),
            mat_flat("skin14", (0.45, 0.3, 0.22), rough=0.6)]
    r = rnd(11)
    for k in range(7):
        d = Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-0.6, 1))).normalized()
        arm = empty(f"{name}_limb{k}"); arm.parent = ball
        arm.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cyl = cylinder(f"{name}_limbc{k}", 0.06, 0.6, (0, 0, 0.9), mats[k % 3], verts=12); cyl.parent = arm
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.08, location=(0, 0, 1.22))
        hnd = bpy.context.object; hnd.data.materials.append(mats[2]); hnd.parent = arm
        limbs.append(arm)
    star_m = mat_flat("star14", (1.0, 0.85, 0.1), emit=(1.0, 0.8, 0.1), emit_strength=2.5)
    orbit = empty(f"{name}_orbit"); orbit.parent = root
    for k in range(5):
        a = k * 2 * math.pi / 5
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.12, radius2=0.0, depth=0.05,
                                        location=(math.cos(a) * 1.25, math.sin(a) * 1.25, 0.7))
        s = bpy.context.object; s.data.materials.append(star_m); s.parent = orbit
    return root, ball, limbs, orbit


def animate_cloud(root, ball, limbs, orbit, n, path, spin=24.0, seed=5):
    """path = [(frame, (x, y, z))]: the cloud travels (smooth), churns, limbs pop in and out, stars orbit."""
    for f, p in path:
        key_loc(root, f, p)
    r = rnd(seed)
    for f in range(1, n + 1, 2):
        ball.rotation_euler = (math.radians(f * spin * 0.7), math.radians(f * spin), math.radians(f * spin * 0.4))
        ball.keyframe_insert("rotation_euler", frame=f)
        s = 1.0 + 0.08 * math.sin(f * 1.3)
        ball.scale = (s, 1.0 / s, s); ball.keyframe_insert("scale", frame=f)
        orbit.rotation_euler = (0, 0, math.radians(f * 30)); orbit.keyframe_insert("rotation_euler", frame=f)
    for k, arm in enumerate(limbs):
        for f in range(1 + k, n + 1, 5):
            v = 1.0 if (f // 5 + k) % 2 else 0.05
            arm.scale = (v, v, v); arm.keyframe_insert("scale", frame=f)


def shards(center, out_dir, f0, n, count=36, seed=7, colors=GLASS, size=0.09, speed=0.18, name="shard"):
    """Glass shards bursting from `center` along out_dir at frame f0 (gravity, tumbling)."""
    r = rnd(seed)
    mats = [mat_flat(f"{name}m{k}", c, emit=c, emit_strength=1.5, rough=0.1) for k, c in enumerate(colors)]
    for k in range(count):
        b = box(f"{name}{k}", (r.uniform(0.3, 1) * size, 0.01, r.uniform(0.3, 1) * size), center, mats[k % len(mats)])
        v = Vector(out_dir).normalized() * r.uniform(0.6, 1.0) * speed + Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-0.3, 1))) * speed * 0.6
        spinv = Vector((r.uniform(-30, 30), r.uniform(-30, 30), r.uniform(-30, 30)))
        for f in range(f0, n + 1, 2):
            t = f - f0
            p = Vector(center) + v * t + Vector((0, 0, -0.004 * t * t))
            b.location = p; b.keyframe_insert("location", frame=f)
            b.rotation_euler = [math.radians(a * t) for a in spinv]; b.keyframe_insert("rotation_euler", frame=f)
        vis(b, f_on=f0)


def confetti(n, area_xy=((-2.5, 2.5), (-1.0, 3.0)), count=140, seed=9, z0=6.5):
    r = rnd(seed)
    cols = [(0.95, 0.3, 0.45), (1.0, 0.85, 0.2), (0.3, 0.7, 1.0), (1.0, 1.0, 1.0), (0.5, 0.9, 0.4)]
    mats = [mat_flat(f"conf{k}", c, rough=0.5) for k, c in enumerate(cols)]
    for k in range(count):
        p0 = Vector((r.uniform(*area_xy[0]), r.uniform(*area_xy[1]), z0 + r.uniform(0, 3)))
        pc = plane(f"conf{k}", (0.05, 0.03), p0, mats[k % 5])
        fall = r.uniform(0.05, 0.08); dx, dy = r.uniform(-0.01, 0.01), r.uniform(-0.01, 0.01)
        sv = (r.uniform(-25, 25), r.uniform(-25, 25), r.uniform(-25, 25))
        for f in range(1, n + 1, 4):
            pc.location = p0 + Vector((dx * f + 0.05 * math.sin(f * 0.2 + k), dy * f, -fall * f))
            pc.keyframe_insert("location", frame=f)
            pc.rotation_euler = [math.radians(a * f) for a in sv]; pc.keyframe_insert("rotation_euler", frame=f)


# ============================================================================ SHOTS: the set-up
@shot
def sh01():
    """You are SO done with DALE. - you, fed up, hands on hips; Dale behind you on the pavement, waving."""
    n = frames_of("sh01")
    closeup()
    ep11.day_street()
    you = you_char((0.6, -1.2, 0), rot_z=0)
    you.clip("137_28", **src(n, 2400))
    hp = you.world("Hips", frame=1)
    for side, dx in (("Left", 0.2), ("Right", -0.2)):
        hold(you, side, hp + Vector((dx, -0.04, 0.05)), name=f"hips_{side}")
    face(you, 1, ANNOYED); blink(you, [30])
    dale = dale_char((-1.3, 2.6, 0), rot_z=-15, sd=False)
    dale.clip("113_27", **src(n, 80))
    face(dale, 1, GRIN)
    hy = head(you)
    cam = Cam(lens=40, loc=(hy.x + 0.25, hy.y - 1.9, hy.z + 0.05), target=(hy.x - 0.55, hy.y + 1.0, hy.z - 0.15))
    cam.key(1, loc=(hy.x + 0.25, hy.y - 1.9, hy.z + 0.05)); cam.key(n, loc=(hy.x + 0.2, hy.y - 1.6, hy.z + 0.04))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh02():
    """First he became your STEPDAD. - Dale in Mom's doorway: the apron, the spatula, waving it."""
    n = frames_of("sh02")
    closeup()
    h = ep11.moms_house()
    h.rotation_euler = (0, 0, math.radians(75))
    dale = ep11.stepdad((0.05, 3.9, 0))
    dale.hold("137_28", 2400)
    sp = empty("spatup", (-0.25, 3.62, 1.3))
    for k, f in enumerate(range(1, n + 1, 6)):
        key_loc(sp, f, (-0.25 - (0.12 if k % 2 else 0.0), 3.62, 1.3 + (0.12 if k % 2 else 0.0)))
    hand_ik(dale, "Right", sp)
    look_at(dale, empty("lookcam", (0.3, 1.5, 1.5)), 0.85)
    face(dale, 1, GRIN)
    cam = Cam(lens=32, loc=(0.3, 1.5, 1.5), target=(0.05, 3.7, 1.25))
    cam.key(1, loc=(0.3, 1.5, 1.5)); cam.key(n, loc=(0.25, 1.8, 1.5))
    face_light(cam, energy=90, size=0.9)
    return n


@shot
def sh03():
    """Now he wants to be your HUSBAND? - Dale on his knees on the pavement, ring box up; you recoil."""
    n = frames_of("sh03")
    closeup()
    ep11.day_street()
    you = you_char((0.55, -1.0, 0), rot_z=-90)                              # facing -X, toward Dale
    you.clip("137_28", **src(n, 2400))
    ypiv = rocker(you, at="floor")
    rock(ypiv, [(1, 0.0), (10, 0.0), (18, -7.0), (n, -6.0)])
    dale = dale_char((-0.45, -1.0, 0), rot_z=90)                             # facing +X, toward you
    pose(dale, KNEEL_LEVEL)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: dale.world(b).z)
    settle(dale, knee, 0.06)
    rb = ring_box()
    hd = head(dale)
    rb.location = hd + Vector((0.32, 0, -0.22))
    for side, dy in (("Left", 0.045), ("Right", -0.045)):                    # Dale faces +X: left is +Y
        hold(dale, side, rb.location + Vector((-0.03, dy, -0.02)), name=f"ring_{side}")
    look_keys(dale, you, [(1, 0.8)])
    look_keys(you, dale, [(1, 0.6)])
    face(dale, 1, GRIN)
    face(you, 1, UNEASY); face(you, 12, SHOCK)
    cam = Cam(lens=30, loc=(0.1, -3.4, 1.25), target=(0.05, -1.0, 1.0))
    cam.key(1, loc=(0.1, -3.4, 1.25)); cam.key(n, loc=(0.1, -3.0, 1.2))
    face_light(cam, energy=30, size=1.2)
    return n


def truck_with_you(n, sd=True):
    """The garbage truck; you sitting on the back lip among the bin bags, facing backwards; Dale at the wheel."""
    ep11.day_street()
    root, wheels = ep9.garbage_truck()
    trash_bags(root, (-3.35, 0.0, 1.2), n=6)
    you = you_char(sd=sd)
    you.rig.location = (-3.55, 0.25, 0); you.rig.rotation_euler = (0, 0, math.radians(-90))
    sit_level(you, 1.12)
    bpy.context.view_layer.update()
    mw = you.rig.matrix_world.copy(); you.rig.parent = root; you.rig.matrix_world = mw
    up = []
    for side, dy in (("Left", -0.25), ("Right", 0.25)):                      # facing -X: left is -Y
        t = empty(f"wave_{side}", (-3.75, 0.25 + dy, 2.2)); t.parent = root
        up.append(t)
        hand_ik(you, side, t)
    for k, f in enumerate(range(1, n + 1, 4)):
        for j, t in enumerate(up):
            key_loc(t, f, (-3.78, 0.25 + (-0.32 if j == 0 else 0.32), 2.15 + (0.12 if (k + j) % 2 else 0.0)))
    dale = dale_char(sd=False)
    dale.rig.location = (2.75, 0.6, 0.62); dale.rig.rotation_euler = (0, 0, math.radians(90))
    pose(dale, dict(ep6.DRIVE, **NECK)); settle(dale, "Hips", 1.55)
    bpy.context.view_layer.update()
    mw = dale.rig.matrix_world.copy(); dale.rig.parent = root; dale.rig.matrix_world = mw
    face(you, 1, SCREAM); face(dale, 1, GRIN)
    return root, wheels, you, dale


@shot
def sh04():
    """So he KIDNAPS you. - on the back of the bin lorry, you scream; the street pulls away behind you."""
    n = frames_of("sh04")
    closeup()
    root, wheels, you, dale = truck_with_you(n)
    ep9.drive_truck(root, wheels, [(1, (0.0, -5.0), 0), (n, (5.5, -5.0), 0)], n)
    cam = Cam(lens=30, loc=(-6.0, -5.6, 2.2), target=(-3.6, -4.75, 1.85))
    cam.cam.parent = root; cam.tgt.parent = root
    cam.cam.location = (-6.0, -0.6, 2.2); cam.tgt.location = (-3.6, 0.25, 1.85)
    cam.cam.keyframe_insert("location", frame=1); cam.cam.location = (-5.6, -0.5, 2.15); cam.cam.keyframe_insert("location", frame=n)
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh05():
    """In a garbage truck. - the lorry rolls down the street, Dale grinning at the wheel, you waving on the back."""
    n = frames_of("sh05")
    root, wheels, you, dale = truck_with_you(n, sd=False)
    ep9.drive_truck(root, wheels, [(1, (-7.0, -5.0), 0), (n, (2.0, -5.0), 0)], n)
    cam = Cam(lens=26, loc=(-1.0, 3.0, 2.4), target=(-2.0, -5.0, 1.8))
    cam.key(1, loc=(-1.0, 3.0, 2.4), target=(-4.5, -5.0, 1.8)); cam.key(n, loc=(-0.6, 3.0, 2.4), target=(-0.5, -5.0, 1.8))
    return n


# ============================================================================ SHOTS: the altar
@shot
def sh06():
    """Duct-tapes you to a chair. - at the altar: bound to the chair, you thrash; Dale smooths the last strip."""
    n = frames_of("sh06")
    closeup()
    church()
    a = at_altar(n, priest=False)
    you, piv, dale = a["you"], a["you_piv"], a["dale"]
    ks = [(f, 4.0 * math.sin(f * 1.1) + 2.5 * math.sin(f * 2.3)) for f in range(1, n + 1)]
    rock(piv, ks)
    face(you, 1, SCREAM); face(you, 20, dict(SCREAM, jawOpen=0.6))
    tp = empty("tapehand", (YOU_CH[0] + 0.35, YOU_CH[1] + 0.05, 1.05))
    for k, f in enumerate(range(1, n + 1, 8)):
        key_loc(tp, f, (YOU_CH[0] + 0.32, YOU_CH[1] + (0.12 if k % 2 else -0.05), 1.05 + (0.04 if k % 2 else 0)))
    hand_ik(dale, "Left", tp)
    look_keys(dale, you, [(1, 0.7)])
    face(dale, 1, SMILE)
    hy = head(you)
    cam = Cam(lens=34, loc=(hy.x + 0.55, hy.y + 2.2, hy.z + 0.05), target=(hy.x + 0.45, hy.y, hy.z - 0.2))
    cam.key(1, loc=(hy.x + 0.55, hy.y + 2.2, hy.z + 0.05)); cam.key(n, loc=(hy.x + 0.5, hy.y + 1.9, hy.z + 0.04))
    face_light(cam, energy=40, size=1.2)
    return n


@shot
def sh07():
    """At the ALTAR. - wide down the aisle: flowers, candles, stained glass... and you, taped to a chair."""
    n = frames_of("sh07")
    church()
    a = at_altar(n, sd=False)
    face(a["you"], 1, SCREAM); face(a["dale"], 1, SMILE)
    rock(a["you_piv"], [(f, 3.0 * math.sin(f * 1.2)) for f in range(1, n + 1)])
    cam = Cam(lens=26, loc=(0.0, -6.5, 2.2), target=(0.0, 2.0, 1.2))
    cam.key(1, loc=(0.0, -6.5, 2.2)); cam.key(n, loc=(0.0, -5.6, 2.1))
    return n


@shot
def sh08():
    """The priest? - behind the altar, head bowed over the book; he slowly looks up."""
    n = frames_of("sh08")
    closeup()
    church()
    a = at_altar(n, you=False, groom=False)
    p = a["priest"]
    book_pt = empty("lookbook", (0, 2.88, 1.25))
    look_keys(p, book_pt, [(1, 0.8), (8, 0.8), (18, 0.0)])
    face(p, 1, DEADPAN)
    hp = head(p)
    cam = Cam(lens=40, loc=(hp.x + 0.15, hp.y - 1.6, hp.z - 0.1), target=(hp.x, hp.y, hp.z - 0.05))
    cam.key(1, loc=(hp.x + 0.15, hp.y - 1.6, hp.z - 0.1)); cam.key(n, loc=(hp.x + 0.12, hp.y - 1.35, hp.z - 0.08))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh09():
    """Also DALE. In a fake moustache. - close: Dale, collar and stick-on moustache, wiggling his eyebrows."""
    n = frames_of("sh09")
    closeup()
    church()
    a = at_altar(n, you=False, groom=False)
    p = a["priest"]
    face(p, 1, SMUG)
    for k, f in enumerate(range(10, n + 1, 6)):
        p.expr(f, {"browOuterUpLeft": 0.9 if k % 2 == 0 else 0.1, "browOuterUpRight": 0.9 if k % 2 == 0 else 0.1,
                   "browInnerUp": 0.6 if k % 2 == 0 else 0.0})
    cam_pt = empty("lookcam9", (0.0, 1.9, 1.75))
    look_keys(p, cam_pt, [(1, 0.8)])
    hp = head(p)
    cam = Cam(lens=50, loc=(hp.x + 0.05, hp.y - 1.2, hp.z + 0.03), target=(hp.x, hp.y, hp.z))
    cam.key(1, loc=(hp.x + 0.05, hp.y - 1.2, hp.z + 0.03)); cam.key(n, loc=(hp.x + 0.04, hp.y - 0.85, hp.z + 0.02))
    face_light(cam, energy=45, size=0.9)
    return n


@shot
def sh10():
    """"Do you take Dale?" "MMMPH!" - you, tape over your mouth, shaking your head like mad."""
    n = frames_of("sh10")
    closeup()
    church()
    a = at_altar(n, groom=False, priest=False, gag=True)
    you, piv = a["you"], a["you_piv"]
    shake = empty("shake")
    hy = head(you)
    for k, f in enumerate(range(1, n + 1, 3)):
        key_loc(shake, f, hy + Vector((0.6 if k % 2 else -0.6, 1.5, 0.05)))
    look_keys(you, shake, [(1, 0.0), (8, 0.0), (12, 0.75)])
    rock(piv, [(f, 2.5 * math.sin(f * 1.5)) for f in range(1, n + 1)])
    face(you, 1, dict(SHOCK, jawOpen=0.0)); blink(you, [5])
    cam = Cam(lens=48, loc=(hy.x + 0.15, hy.y + 1.25, hy.z + 0.03), target=(hy.x, hy.y, hy.z))
    cam.key(1, loc=(hy.x + 0.15, hy.y + 1.25, hy.z + 0.03)); cam.key(n, loc=(hy.x + 0.12, hy.y + 1.0, hy.z + 0.03))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh11():
    """"He said YES!" - both Dales throw their arms in the air."""
    n = frames_of("sh11")
    church()
    a = at_altar(n, sd=False)
    d, p = a["dale"], a["priest"]
    hd, hp = head(d), head(p)
    for ch, h, nm in ((d, hd, "g"), (p, hp, "p")):
        for side, dx in (("Left", -0.3), ("Right", 0.3)):
            t = empty(f"cheer_{nm}_{side}", h + Vector((dx if ch is d else -dx, 0, 0.0)))
            key_loc(t, 1, h + Vector(((dx if ch is d else -dx) * 0.6, 0.15 if ch is d else -0.15, -0.55)))
            key_loc(t, 7, h + Vector((dx if ch is d else -dx, 0.05 if ch is d else -0.05, 0.42)))
            for k, f in enumerate(range(11, n + 1, 5)):
                key_loc(t, f, h + Vector((dx if ch is d else -dx, 0.05 if ch is d else -0.05, 0.42 + (0.06 if k % 2 else 0))))
            hand_ik(ch, side, t)
        face(ch, 1, TADA)
    face(a["you"], 1, dict(SHOCK, jawOpen=0.0)); mouth_tape(a["you"])
    cam = Cam(lens=28, loc=(2.6, 0.2, 1.6), target=(0.0, 2.2, 1.3))
    cam.key(1, loc=(2.6, 0.2, 1.6)); cam.key(n, loc=(2.4, 0.4, 1.6))
    return n


# ============================================================================ SHOTS: Larry
LARRY_IN = (0.0, -11.3)


@shot
def sh12():
    """Then the doors BURST open. - the church doors slam open; blinding daylight; a figure in white."""
    n = frames_of("sh12")
    church(doors_open=(8, 13))
    larry = larry_char((LARRY_IN[0], LARRY_IN[1], 0), rot_z=180, sd=False)
    larry.clip("137_28", **src(n, 2400))
    area("backlight", (0, DOOR_Y - 3.0, 2.5), (0, DOOR_Y, 1.5), energy=1500, size=3.0, color=(1.0, 0.97, 0.9))
    cam = Cam(lens=30, loc=(0.6, -4.0, 1.5), target=(0.0, DOOR_Y, 1.7))
    cam.key(1, loc=(0.6, -4.0, 1.5)); cam.key(n, loc=(0.55, -4.6, 1.5))
    return n


@shot
def sh13():
    """It's LARRY. - in the doorway: veil, tiara, bouquet, moustache, fury."""
    n = frames_of("sh13")
    closeup()
    church(doors_open=(0, 1))
    larry = larry_char((LARRY_IN[0], LARRY_IN[1] + 0.6, 0), rot_z=180)
    larry.clip("137_28", **src(n, 2400))
    face(larry, 1, RAGE)
    hl = head(larry)
    cam = Cam(lens=45, loc=(hl.x + 0.2, hl.y + 2.0, hl.z - 0.15), target=(hl.x, hl.y, hl.z - 0.3))
    cam.key(1, loc=(hl.x + 0.2, hl.y + 2.0, hl.z - 0.15)); cam.key(n, loc=(hl.x + 0.15, hl.y + 1.6, hl.z - 0.12))
    face_light(cam, energy=80, size=1.2)
    return n


@shot
def sh14():
    """In a wedding dress. - Larry storms down the aisle, skirt swishing, straight at us."""
    n = frames_of("sh14")
    closeup()
    church(doors_open=(0, 1))
    larry = larry_char((0.0, -9.6, 0), rot_z=180)
    larry.clip("07_01", **src(n, 60, speed=1.15, in_place=False))
    face(larry, 1, RAGE)
    cam = Cam(lens=32, loc=(0.35, -5.4, 1.35), target=(0.0, -9.0, 1.2))
    cam.key(1, loc=(0.35, -5.4, 1.35)); cam.key(n, loc=(0.35, -5.0, 1.35))
    face_light(cam, energy=60, size=1.2)
    return n


@shot
def sh15():
    """"Get away from my HUSBAND!" - close on Larry, roaring, finger out at Dale."""
    n = frames_of("sh15")
    closeup()
    church(doors_open=(0, 1))
    larry = larry_char((0.0, -1.8, 0), rot_z=180)
    larry.clip("137_28", **src(n, 2400))
    hl = head(larry)
    pt = empty("point_at", hl + Vector((0.35, 0.55, -0.08)))
    key_loc(pt, 1, hl + Vector((0.25, 0.1, -0.55))); key_loc(pt, 8, hl + Vector((0.35, 0.55, -0.08)))
    for k, f in enumerate(range(12, n + 1, 6)):
        key_loc(pt, f, hl + Vector((0.35, 0.55 + (0.05 if k % 2 else 0), -0.08)))
    hand_ik(larry, "Right", pt)                                             # facing +Y: right hand is +X
    talk(larry, 2, n - 4, every=3)
    face(larry, 1, RAGE)
    cam = Cam(lens=40, loc=(hl.x - 0.2, hl.y + 1.3, hl.z + 0.05), target=(hl.x, hl.y, hl.z - 0.1))
    cam.key(1, loc=(hl.x - 0.2, hl.y + 1.3, hl.z + 0.05)); cam.key(n, loc=(hl.x - 0.18, hl.y + 1.05, hl.z + 0.04))
    face_light(cam, energy=60, size=1.0)
    return n


@shot
def sh16():
    """Dale throws the CAKE. - wide: Dale hurls the wedding cake up the aisle; it lands square on Larry."""
    n = frames_of("sh16")
    church(doors_open=(0, 1))
    larry = larry_char((0.0, -1.8, 0), rot_z=180, sd=False)
    larry.clip("137_28", **src(n, 2400))
    dale = dale_char((DALE_AT[0], DALE_AT[1] - 0.2, 0), rot_z=0, sd=False)
    dale.clip("137_28", **src(n, 2400))
    hd, hl = head(dale), head(larry)
    ck = cake((0, 0, 0))
    f_go, f_hit = 10, 22
    start = hd + Vector((0.0, -0.35, -0.45))
    key_loc(ck, 1, start + Vector((0, 0.1, -0.1))); key_loc(ck, f_go, start + Vector((0, 0.05, 0.2)))
    for f in range(f_go + 1, f_hit + 1):
        u = (f - f_go) / (f_hit - f_go)
        p = start.lerp(hl + Vector((0, 0.05, -0.15)), u) + Vector((0, 0, 1.4 * u * (1 - u)))
        key_loc(ck, f, p, interp="LINEAR")
    ck.rotation_euler = (0, 0, 0); ck.keyframe_insert("rotation_euler", frame=f_go)
    ck.rotation_euler = (math.radians(200), 0, 0); ck.keyframe_insert("rotation_euler", frame=f_hit)
    vis(ck, f_off=f_hit + 1)
    for side, dx in (("Left", 0.18), ("Right", -0.18)):                      # Dale faces -Y: left is +X
        t = empty(f"cake_{side}", start + Vector((dx, 0.08, -0.05)))
        key_loc(t, 1, start + Vector((dx, 0.12, -0.12))); key_loc(t, f_go, start + Vector((dx, 0.08, 0.22)))
        key_loc(t, f_go + 4, start + Vector((dx * 0.8, -0.35, 0.3))); key_loc(t, n, start + Vector((dx, 0.0, -0.1)))
        hand_ik(dale, side, t)
    splat_on(larry, f_on=f_hit + 1)
    face(dale, 1, RAGE); face(larry, 1, RAGE); face(larry, f_hit + 1, SHOCK)
    cam = Cam(lens=26, loc=(3.4, -0.4, 1.7), target=(0.0, -0.3, 1.4))
    cam.key(1, loc=(3.4, -0.4, 1.7)); cam.key(n, loc=(3.2, -0.4, 1.65))
    return n


def flying_priest(n, f0, f1, p0, p1, height=2.0, spin=540.0, sd=False):
    """Dale the priest flung through the air in a starfish (T-pose), tumbling along an arc."""
    p = dale_char(sd=sd, tag="dpriest")
    p.tpose()
    st = priest_bits(p)
    root = empty("fling", p0)
    p.rig.parent = root; p.rig.location = (0, 0, -1.0); p.rig.rotation_euler = (math.radians(-80), 0, 0)
    for f in range(1, n + 1):
        u = min(1.0, max(0.0, (f - f0) / max(1, f1 - f0)))
        pos = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, height * 4 * u * (1 - u)))
        root.location = pos; root.keyframe_insert("location", frame=f)
        root.rotation_euler = (math.radians(spin * u * 0.3), math.radians(spin * u), 0); root.keyframe_insert("rotation_euler", frame=f)
    face(p, 1, SCREAM)
    return p, root, st


@shot
def sh17():
    """Larry throws the PRIEST... - Larry heaves; the priest goes flying over the benches."""
    n = frames_of("sh17")
    church(doors_open=(0, 1))
    larry = larry_char((-0.9, 1.9, 0), rot_z=-16, sd=False)
    larry.clip("137_28", **src(n, 2400))
    splat_on(larry)
    hl = head(larry)
    for side, dx in (("Left", 0.2), ("Right", -0.2)):                        # facing ~-Y: left is +X
        t = empty(f"heave_{side}", hl + Vector((dx, 0.2, 0.25)))
        key_loc(t, 1, hl + Vector((dx, 0.15, -0.35))); key_loc(t, 6, hl + Vector((dx, 0.15, 0.35)))
        key_loc(t, 11, hl + Vector((dx * 0.6, -0.45, 0.2))); key_loc(t, n, hl + Vector((dx, -0.2, -0.3)))
        hand_ik(larry, side, t)
    face(larry, 1, RAGE)
    flying_priest(n, 9, n + 6, (-1.0, 1.4, 1.6), (-3.0, -5.5, 1.0), height=2.4)
    cam = Cam(lens=24, loc=(2.8, -3.0, 2.0), target=(-1.2, -1.0, 1.8))
    cam.key(1, loc=(2.8, -3.0, 2.0)); cam.key(n, loc=(2.6, -3.3, 2.1))
    return n


@shot
def sh18():
    """Who is ALSO Dale. - the flying priest sails past the lens; the fake moustache peels off and flutters away."""
    n = frames_of("sh18")
    church(doors_open=(0, 1))
    p, root, st = flying_priest(n, 1, n, (-1.2, 0.5, 3.2), (-2.6, -4.5, 1.2), height=0.6, spin=260.0, sd=True)
    loose = empty("stache_free")
    bpy.context.view_layer.update()
    f_off = 10
    bpy.context.scene.frame_set(f_off); bpy.context.view_layer.update()
    pw = st.matrix_world.translation.copy()
    loc0, rot0 = st.location.copy(), st.rotation_euler.copy()
    for f in (1, f_off - 1):
        st.location = loc0; st.keyframe_insert("location", frame=f)
        st.rotation_euler = rot0; st.keyframe_insert("rotation_euler", frame=f)
    for c in st.constraints:
        c.influence = 1.0; c.keyframe_insert("influence", frame=f_off - 1)
        c.influence = 0.0; c.keyframe_insert("influence", frame=f_off)
    for f in range(f_off, n + 1):
        t = f - f_off
        st.location = pw + Vector((0.03 * t, 0.06 * t, 0.02 * t - 0.002 * t * t)); st.keyframe_insert("location", frame=f)
        st.rotation_euler = (math.radians(40 * t), 0, math.radians(25 * t)); st.keyframe_insert("rotation_euler", frame=f)
    bpy.context.scene.frame_set(1)
    cam = Cam(lens=30, loc=(-0.3, -1.6, 2.4), target=(-1.6, -1.0, 2.2))
    cam.key(1, loc=(-0.3, -1.6, 2.4), target=(-1.3, 0.2, 2.7)); cam.key(n, loc=(-0.4, -1.8, 2.3), target=(-2.4, -3.6, 1.4))
    return n


# ============================================================================ SHOTS: the fight
@shot
def sh19():
    """They fight down the aisle. - a cartoon brawl cloud rolls down the red carpet at us."""
    n = frames_of("sh19")
    church(doors_open=(0, 1))
    root, ball, limbs, orbit = fight_cloud()
    animate_cloud(root, ball, limbs, orbit, n, [(1, (0.0, 1.0, 1.0)), (n, (0.0, -3.4, 1.0))])
    cam = Cam(lens=26, loc=(0.7, -6.6, 0.7), target=(0.0, -1.0, 1.2))
    cam.key(1, loc=(0.7, -6.6, 0.7)); cam.key(n, loc=(0.75, -6.9, 0.7))
    return n


@shot
def sh20():
    """Over the benches. - the cloud bounces over the rows of benches; the benches jump."""
    n = frames_of("sh20")
    ch = church(doors_open=(0, 1))
    root, ball, limbs, orbit = fight_cloud()
    path = []
    for f in range(1, n + 1, 2):
        u = (f - 1) / (n - 1)
        x = 0.6 + 2.2 * u; y = -3.4 - 2.6 * u
        z = 1.3 + 0.9 * abs(math.sin(u * math.pi * 2.0))
        path.append((f, (x, y, z)))
    animate_cloud(root, ball, limbs, orbit, n, path)
    for p in ch["pews"]:
        if p.location.x > 0 and -6.5 < p.location.y < -3.0:
            hit = int(1 + (n - 1) * min(1.0, max(0.0, (-3.4 - p.location.y) / 2.6)))
            for f, a in ((1, 0), (max(1, hit - 1), 0), (hit + 2, 9), (hit + 5, -4), (hit + 8, 0)):
                p.rotation_euler = (math.radians(a), 0, 0); p.keyframe_insert("rotation_euler", frame=min(n, f))
    cam = Cam(lens=26, loc=(-1.6, -9.0, 2.0), target=(2.2, -4.6, 1.2))
    cam.key(1, loc=(-1.6, -9.0, 2.0)); cam.key(n, loc=(-1.5, -9.2, 2.0))
    return n


@shot
def sh21():
    """Out the WINDOW. - the cloud smashes out through the stained glass; shards burst into the daylight."""
    n = frames_of("sh21")
    f_hit = 8
    church(doors_open=(0, 1), broken_window=f_hit)
    root, ball, limbs, orbit = fight_cloud()
    animate_cloud(root, ball, limbs, orbit, n, [(1, (2.6, -4.2, 1.6)), (f_hit, (WIN_HIT[0] - 0.4, WIN_HIT[1], WIN_HIT[2])),
                                                (n, (WIN_HIT[0] + 2.2, WIN_HIT[1] + 0.3, WIN_HIT[2] + 0.6))])
    vis(root, f_off=f_hit + 4)
    shards(WIN_HIT, (1, 0, 0.3), f_hit, n, count=40)
    shards(WIN_HIT, (-1, 0, 0.2), f_hit, n, count=16, seed=8, speed=0.08, name="shardin")
    cam = Cam(lens=28, loc=(0.6, -1.2, 2.3), target=(WIN_HIT[0], WIN_HIT[1], WIN_HIT[2] - 0.2))
    cam.key(1, loc=(0.6, -1.2, 2.3)); cam.key(n, loc=(0.9, -1.4, 2.35))
    return n


@shot
def sh22():
    """And back in through the ROOF. - ceiling boards burst, the cloud drops into the aisle and bounces."""
    n = frames_of("sh22")
    f_hit = 7
    church(doors_open=(0, 1), roof_hole=f_hit)
    root, ball, limbs, orbit = fight_cloud()
    hx, hy = ROOF_HIT
    animate_cloud(root, ball, limbs, orbit, n, [(1, (hx, hy, CEIL_Z + 2.5)), (f_hit, (hx, hy, CEIL_Z)), (f_hit + 9, (hx, hy, 0.95)),
                                                (f_hit + 14, (hx, hy - 0.4, 1.7)), (f_hit + 19, (hx, hy - 0.8, 0.95)), (n, (hx, hy - 1.0, 1.0))])
    shards((hx, hy, CEIL_Z - 0.05), (0, 0, -1), f_hit, n, count=26, seed=12, colors=[(0.62, 0.45, 0.3), (0.3, 0.18, 0.1)],
           size=0.35, speed=0.12, name="board")
    cam = Cam(lens=24, loc=(1.7, -6.2, 0.9), target=(hx, hy, 3.4))
    cam.key(1, loc=(1.7, -6.2, 0.9), target=(hx, hy, 5.2)); cam.key(n, loc=(1.6, -6.4, 0.9), target=(hx, hy - 0.6, 1.3))
    return n


# ============================================================================ SHOTS: the vows
def caked_pair(n, larry_at=(-0.55, -0.6), dale_at=(0.55, -0.6), facing=180.0, sd=True):
    """Larry and Dale standing side by side, covered in cake, panting."""
    larry = larry_char((larry_at[0], larry_at[1], 0), rot_z=facing, sd=sd)
    larry.clip("137_28", **src(n, 2400))
    dale = dale_char((dale_at[0], dale_at[1], 0), rot_z=facing, sd=sd)
    dale.clip("137_28", **src(n, 2600))
    splat_on(larry, seed=3); splat_on(dale, seed=5)
    return larry, dale


@shot
def sh23():
    """Covered in cake. - Larry and Dale, wrecked, frosting everywhere, glaring and panting."""
    n = frames_of("sh23")
    closeup()
    church(doors_open=(0, 1))
    larry, dale = caked_pair(n, facing=0.0)
    lp, dp = rocker(larry, at="floor"), rocker(dale, at="floor")
    rock(lp, [(f, 2.0 + 1.5 * math.sin(f * 0.9)) for f in range(1, n + 1)])
    rock(dp, [(f, 2.0 + 1.5 * math.sin(f * 0.9 + 1.2)) for f in range(1, n + 1)])
    look_keys(larry, dale, [(1, 0.5)]); look_keys(dale, larry, [(1, 0.5)])
    face(larry, 1, RAGE); face(dale, 1, RAGE)
    hl, hd = head(larry), head(dale)
    mid = (hl + hd) / 2
    cam = Cam(lens=34, loc=(mid.x, mid.y - 2.3, mid.z - 0.05), target=(mid.x, mid.y, mid.z - 0.3))
    cam.key(1, loc=(mid.x, mid.y - 2.3, mid.z - 0.05)); cam.key(n, loc=(mid.x, mid.y - 2.0, mid.z - 0.05))
    face_light(cam, energy=50, size=1.4)
    return n


@shot
def sh24():
    """Both screaming, "I DO!" - over your shoulder: the two of them lean in and scream at you."""
    n = frames_of("sh24")
    closeup()
    church(doors_open=(0, 1))
    a = at_altar(n, groom=False, priest=False)
    you = a["you"]
    face(you, 1, SHOCK)
    larry, dale = caked_pair(n, larry_at=(YOU_CH[0] - 0.45, YOU_CH[1] + 1.15), dale_at=(YOU_CH[0] + 0.45, YOU_CH[1] + 1.15), facing=0.0)
    lp, dp = rocker(larry, at="floor"), rocker(dale, at="floor")
    f0 = at("sh24", 34.9)
    for p in (lp, dp):
        rock(p, [(1, 0.0), (f0 - 6, 0.0), (f0, 12.0), (n, 13.0)])
    face(larry, 1, RAGE); face(dale, 1, RAGE)
    face(larry, f0, SCREAM); face(dale, f0, SCREAM)
    look_keys(larry, you, [(1, 0.6)]); look_keys(dale, you, [(1, 0.6)])
    hy = head(you)
    cam = Cam(lens=30, loc=(hy.x + 0.25, hy.y - 0.75, hy.z + 0.15), target=(hy.x, hy.y + 1.2, hy.z + 0.1))
    cam.key(1, loc=(hy.x + 0.25, hy.y - 0.75, hy.z + 0.15)); cam.key(n, loc=(hy.x + 0.22, hy.y - 0.6, hy.z + 0.12))
    face_light(cam, energy=50, size=1.4, offset=(0.0, 0.4, 0.0))
    return n


REAL_PRIEST = (-2.2, 3.4, 0.3)


def real_priest(n, f_up=None, sd=True):
    """The actual priest (the big guy in white), knocked out behind the altar; springs up stiff as a plank."""
    rp = load_char("butcher", (0, 0, 0), subdiv=sd, tag="rpriest")
    rp.clip("137_28", **src(n, 2400))
    feet = empty("rp_feet", REAL_PRIEST)
    feet.rotation_euler = (0, 0, math.radians(-90))
    bpy.context.view_layer.update()
    rp.rig.parent = feet; rp.rig.location = (0, 0, 0); rp.rig.rotation_euler = (0, 0, 0)
    flat = 88.0
    if f_up:
        for f, a in ((1, flat), (f_up, flat), (f_up + 7, -8.0), (f_up + 10, 4.0), (f_up + 13, 0.0)):
            feet.rotation_euler = (math.radians(-a), 0, math.radians(-90)); feet.keyframe_insert("rotation_euler", frame=f)
        fc = feet.animation_data.action.fcurves
        for c in fc:
            for kp in c.keyframe_points:
                if int(kp.co.x) == f_up:
                    kp.interpolation = "BACK"; kp.easing = "EASE_OUT"
    return rp, feet


@shot
def sh25():
    """Then the real priest wakes up and says, - out cold behind the altar... eyes open... BOING, upright."""
    n = frames_of("sh25")
    closeup()
    church(doors_open=(0, 1))
    f_up = 24
    rp, feet = real_priest(n, f_up=f_up)
    face(rp, 1, {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0}); face(rp, 14, DAZED); blink(rp, [18])
    cam = Cam(lens=28, loc=(REAL_PRIEST[0] + 2.4, REAL_PRIEST[1] - 2.0, 1.2), target=(REAL_PRIEST[0] + 0.4, REAL_PRIEST[1], 0.8))
    cam.key(1, loc=(REAL_PRIEST[0] + 2.4, REAL_PRIEST[1] - 2.0, 1.2), target=(REAL_PRIEST[0] + 0.6, REAL_PRIEST[1], 0.5))
    cam.key(f_up, target=(REAL_PRIEST[0] + 0.6, REAL_PRIEST[1], 0.55))
    cam.key(f_up + 10, target=(REAL_PRIEST[0], REAL_PRIEST[1], 1.5)); cam.key(n, loc=(REAL_PRIEST[0] + 2.2, REAL_PRIEST[1] - 1.8, 1.3))
    return n


@shot
def sh26():
    """"I now pronounce you HUSBAND and HUSBAND." - the dazed priest waves a hand at the two of them."""
    n = frames_of("sh26")
    closeup()
    church(doors_open=(0, 1))
    rp, feet = real_priest(n)
    feet.rotation_euler = (0, 0, 0); feet.location = (-0.9, 2.95, 0.3)
    larry, dale = caked_pair(n, larry_at=(-0.55, 1.95), dale_at=(0.35, 1.95), facing=180.0)
    hr = head(rp)
    t = empty("pronounce")
    for k, f in enumerate(range(1, n + 1, 12)):
        key_loc(t, f, hr + Vector((0.4 + (0.12 if k % 2 else 0.0), -0.45, -0.25)))
    hand_ik(rp, "Left", t)
    talk(rp, 1, n - 8, every=4)
    face(rp, 1, DAZED)
    face(larry, 1, SMUG); face(dale, 1, SMUG)
    cam = Cam(lens=28, loc=(2.6, 0.2, 1.7), target=(-0.3, 2.5, 1.4))
    cam.key(1, loc=(2.6, 0.2, 1.7)); cam.key(n, loc=(2.3, 0.45, 1.65))
    return n


@shot
def sh27():
    """Larry and Dale look at each other. - slowly, both heads turn."""
    n = frames_of("sh27")
    closeup()
    church(doors_open=(0, 1))
    larry, dale = caked_pair(n, larry_at=(-0.45, 1.95), dale_at=(0.45, 1.95), facing=180.0)
    look_keys(larry, dale, [(1, 0.0), (8, 0.0), (26, 0.85)]); look_keys(dale, larry, [(1, 0.0), (8, 0.0), (26, 0.85)])
    face(larry, 1, DEADPAN); face(dale, 1, DEADPAN); face(larry, 26, UNEASY); face(dale, 26, UNEASY)
    hl, hd = head(larry), head(dale)
    mid = (hl + hd) / 2
    cam = Cam(lens=38, loc=(mid.x, mid.y + 1.9, mid.z), target=(mid.x, mid.y, mid.z - 0.1))
    cam.key(1, loc=(mid.x, mid.y + 1.9, mid.z)); cam.key(n, loc=(mid.x, mid.y + 1.6, mid.z))
    face_light(cam, energy=50, size=1.4)
    return n


@shot
def sh28():
    """They just MARRIED each other. - wide from the aisle: confetti rains on the newlyweds."""
    n = frames_of("sh28")
    church(doors_open=(0, 1))
    larry, dale = caked_pair(n, larry_at=(-0.45, 1.95), dale_at=(0.45, 1.95), facing=180.0, sd=False)
    look_keys(larry, dale, [(1, 0.85)]); look_keys(dale, larry, [(1, 0.85)])
    face(larry, 1, UNEASY); face(dale, 1, UNEASY)
    confetti(n)
    cam = Cam(lens=28, loc=(0.0, -3.6, 1.8), target=(0.0, 2.0, 1.5))
    cam.key(1, loc=(0.0, -3.6, 1.8)); cam.key(n, loc=(0.0, -2.9, 1.75))
    return n


@shot
def sh29():
    """You're FREE! - you, still taped to the chair, beaming, bouncing."""
    n = frames_of("sh29")
    closeup()
    church(doors_open=(0, 1))
    a = at_altar(n, groom=False, priest=False)
    you, piv = a["you"], a["you_piv"]
    rock(piv, [(f, 5.0 * abs(math.sin(f * 0.6))) for f in range(1, n + 1)])
    face(you, 1, TADA)
    hy = head(you)
    cam = Cam(lens=40, loc=(hy.x + 0.1, hy.y + 1.5, hy.z + 0.02), target=(hy.x, hy.y, hy.z - 0.12))
    cam.key(1, loc=(hy.x + 0.1, hy.y + 1.5, hy.z + 0.02)); cam.key(n, loc=(hy.x + 0.1, hy.y + 1.25, hy.z + 0.02))
    face_light(cam, energy=45, size=1.2)
    return n


@shot
def sh30():
    """Then they turn around. - your view: their backs; slowly, in sync, they turn to face you."""
    n = frames_of("sh30")
    closeup()
    church(doors_open=(0, 1))
    larry, dale = caked_pair(n, larry_at=(-0.45, 2.45), dale_at=(0.45, 2.45), facing=180.0)
    for ch in (larry, dale):
        piv = rocker(ch, at="floor")
        yaw = piv.parent
        z0 = yaw.rotation_euler.z
        for f, a in ((1, 0.0), (6, 0.0), (28, 180.0)):
            yaw.rotation_euler = (0, 0, z0 + math.radians(a)); yaw.keyframe_insert("rotation_euler", frame=f)
        face(ch, 1, DEADPAN); face(ch, 22, DEADPAN); face(ch, 30, CREEPY)
    cam = Cam(lens=30, loc=(YOU_CH[0] + 0.25, YOU_CH[1] - 0.1, 1.2), target=(0.0, 2.45, 1.45))
    cam.key(1, loc=(YOU_CH[0] + 0.25, YOU_CH[1] - 0.1, 1.2)); cam.key(n, loc=(YOU_CH[0] + 0.25, YOU_CH[1] + 0.15, 1.2))
    face_light(cam, energy=50, size=1.4)
    return n


@shot
def sh31():
    """"Honey... let's ADOPT." - close: two frosted, grinning faces lean in at you."""
    n = frames_of("sh31")
    closeup()
    church(doors_open=(0, 1))
    larry, dale = caked_pair(n, larry_at=(-0.38, 2.2), dale_at=(0.38, 2.2), facing=0.0)
    lp, dp = rocker(larry, at="floor"), rocker(dale, at="floor")
    for p in (lp, dp):
        rock(p, [(1, 0.0), (20, 0.0), (36, 9.0), (n, 10.0)])
    f_h, f_a = at("sh31", 47.3), at("sh31", 48.1)
    talk(dale, f_h, f_h + 6, every=3)
    talk(larry, f_a, f_a + 10, every=3); talk(dale, f_a, f_a + 10, every=3)
    look_keys(dale, larry, [(1, 0.6), (f_a - 4, 0.6), (f_a + 2, 0.0)])
    look_keys(larry, empty("cam31", (0.0, 0.4, 1.6)), [(1, 0.7)])
    face(larry, 1, CREEPY); face(dale, 1, SMILE); face(dale, f_a, CREEPY)
    hl, hd = head(larry), head(dale)
    mid = (hl + hd) / 2
    cam = Cam(lens=34, loc=(mid.x, mid.y - 1.7, mid.z), target=(mid.x, mid.y, mid.z - 0.08))
    cam.key(1, loc=(mid.x, mid.y - 1.7, mid.z)); cam.key(n, loc=(mid.x, mid.y - 1.25, mid.z - 0.05))
    face_light(cam, energy=55, size=1.4)
    return n
