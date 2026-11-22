"""Shot definitions for Episode 10 "The Show" (short loop format like the user's reference: "If Dale is watching you take
a shit... That's a mistake. You see, he thinks it's a show. There are three steps..."). Same pipeline as episodes 1-9:
imports the newest episode (episode 9, which pulls in 8, 7, 6, 4, 3, 2, 1). New per-episode set: the bathroom, which
turns into a little theatre (proscenium, red curtain, spotlights, front-row chairs)."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (empty, mat_flat, mat_tex, mat_image, box, plane, decal, cylinder, model, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ep9shots", os.path.join(_HERE, "..", "ep9", "shots.py"))
ep9 = importlib.util.module_from_spec(_spec)
sys.modules["ep9shots"] = ep9
_spec.loader.exec_module(ep9)
ep8, ep7, ep6, ep4, ep3, ep2, ep1 = ep9.ep8, ep9.ep7, ep9.ep6, ep9.ep4, ep9.ep3, ep9.ep2, ep9.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, TADA, SERENE,
                      face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, sit, SIT)  # noqa: E402
RAGE = ep1.RAGE
BEG = ep8.BEG
load_char, closeup, face_light, spot = ep9.load_char, ep9.closeup, ep9.face_light, ep9.spot

D10 = os.path.join(lib.SCRATCH, "ep10", "decals")
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


YELL = dict(RAGE, eyeWideLeft=1.0, eyeWideRight=1.0)
THINK = {"browDownLeft": 0.5, "browInnerUp": 0.4, "mouthPressLeft": 0.5, "mouthPressRight": 0.5, "eyeSquintLeft": 0.3,
         "eyeSquintRight": 0.3, "mouthRollLower": 0.3}
CHEW = dict(CREEPY_ENJOY, jawOpen=0.25)
BOW = {"lowerback": {"rx": 32}, "upperback": {"rx": 22}, "thorax": {"rx": 12}, "lowerneck": {"rx": 14}}

SEAT_Z = 0.43                     # toilet seat height
TOILET = Vector((0.0, 1.4, 0.0))  # toilet root (front faces -Y); you sit with your hips over (0, 1.36)
DOOR_Y = -1.8                     # front wall / proscenium line


# ============================================================================ props
def toilet(loc=TOILET):
    """White toilet, seat down, lid up against the tank; flush lever on the tank's left. Returns (root, lever)."""
    root = empty("toilet", loc)
    por = mat_flat("porcelain", (0.95, 0.95, 0.96), rough=0.12)
    chrome = mat_flat("tchrome", (0.85, 0.86, 0.88), metal=1.0, rough=0.2)
    b = cylinder("t_base", 0.13, 0.36, (0, 0.05, 0.18), por, verts=32); b.scale = (1.0, 1.35, 1.0); b.parent = root
    bw = cylinder("t_bowl", 0.2, 0.14, (0, -0.02, 0.33), por, verts=40); bw.scale = (1.0, 1.28, 1.0); bw.parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.175, minor_radius=0.03, major_segments=40, minor_segments=10,
                                     location=(0, -0.02, 0.415))
    seat = bpy.context.object; seat.name = "t_seat"; seat.scale = (1.0, 1.25, 0.6)
    seat.data.materials.append(mat_flat("tseat", (0.97, 0.97, 0.97), rough=0.3)); bpy.ops.object.shade_smooth(); seat.parent = root
    box("t_tank", (0.44, 0.2, 0.42), (0, 0.27, 0.62), por, bevel=0.03).parent = root
    box("t_lid", (0.47, 0.23, 0.04), (0, 0.27, 0.84), por, bevel=0.015).parent = root
    box("t_seatlid", (0.36, 0.03, 0.42), (0, 0.155, 0.62), mat_flat("tseat", (0.97, 0.97, 0.97), rough=0.3), bevel=0.02).parent = root
    lever = empty("t_lever", (-0.2, 0.165, 0.76)); lever.parent = root
    box("t_handle", (0.1, 0.022, 0.024), (0.05, -0.01, 0), chrome, bevel=0.006).parent = lever
    root.location = Vector(loc)
    return root, lever


def popcorn_bucket(name="popcorn"):
    """Striped popcorn bucket (origin at its base), heaped with popcorn."""
    root = empty(name)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.085, radius2=0.12, depth=0.24, location=(0, 0, 0.12),
                                    end_fill_type="NOTHING")
    c = bpy.context.object; c.name = f"{name}_cup"; c.data.materials.append(mat_image("popcornm", f"{D10}/popcorn.png", rough=0.5))
    c.modifiers.new("t", "SOLIDIFY").thickness = 0.004
    c.parent = root
    rnd = random.Random(1)
    corn = mat_flat("corn", (1.0, 0.93, 0.7), rough=0.8)
    for k in range(34):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0, 0.1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.018, 0.026),
                                              location=(math.cos(a) * r, math.sin(a) * r, 0.24 + rnd.uniform(0, 0.05) * (1 - r / 0.1)))
        o = bpy.context.object; o.data.materials.append(corn); o.parent = root
    return root


def ticket(name="ticket", width=0.14):
    d = decal(name, f"{D10}/ticket.png", width, (0, 0, 0), rot=(0, 0, 0))
    return d


def held_ticket(ch, n, bone, cam_loc, width=0.2, offset=(0, 0, 0), name="ticketh"):
    """A ticket that rides with a hand but always faces the camera (readable)."""
    d = ticket(name, width)
    p = ch.world(bone, frame=1)
    d.rotation_euler = (Vector(cam_loc) - p).normalized().to_track_quat("Z", "Y").to_euler()
    ch.bake_follow(d, bone, n, offset=offset)
    return d


# ============================================================================ the set
def bathroom(show=False):
    """Small bathroom (x -1.6..1.6, y -1.8..1.8): toilet against the back wall facing the doorway in the front wall;
    a hallway outside. show=True turns it into a theatre: no front wall, a proscenium with the LIVE TONIGHT marquee,
    red curtains (returned, to animate), a spotlight bar, footlights; the room lights go dim."""
    world_color((0.05, 0.05, 0.06), 0.4)
    tile = mat_tex("btile", "floor_tiles_02", scale=1.0, tint=(0.85, 0.88, 0.9))
    plane("b_floor", (3.2, 3.6), (0, 0, 0), tile, uv_scale=1.2)
    wall = mat_tex("bwall", "painted_plaster_wall", scale=1.0, tint=(0.78, 0.9, 0.95))
    box("b_back", (3.4, 0.2, 2.6), (0, 1.9, 1.3), wall, uv_scale=0.5)
    box("b_left", (0.2, 3.8, 2.6), (-1.7, 0, 1.3), wall, uv_scale=0.5)
    box("b_right", (0.2, 3.8, 2.6), (1.7, 0, 1.3), wall, uv_scale=0.5)
    plane("b_ceil", (3.4, 3.8), (0, 0, 2.6), mat_flat("bceil", (0.9, 0.9, 0.9)), rot=(180, 0, 0))
    wain = mat_flat("bwain", (0.96, 0.97, 0.98), rough=0.2)
    for nm, sz, lc in (("b_tile_back", (3.2, 0.03, 1.1), (0, 1.79, 0.55)), ("b_tile_l", (0.03, 3.6, 1.1), (-1.59, 0, 0.55)),
                       ("b_tile_r", (0.03, 3.6, 1.1), (1.59, 0, 0.55))):
        box(nm, sz, lc, wain)
    root, lever = toilet()
    # sink + mirror on the right wall, paper roll and towel on the left
    por = mat_flat("porcelain", (0.95, 0.95, 0.96), rough=0.12)
    box("sink", (0.42, 0.5, 0.16), (1.35, 0.35, 0.82), por, bevel=0.04)
    cylinder("sinkped", 0.08, 0.74, (1.4, 0.35, 0.37), por, verts=20)
    box("mirror", (0.03, 0.6, 0.8), (1.58, 0.35, 1.55), mat_flat("mirrorm", (0.8, 0.85, 0.9), metal=1.0, rough=0.03))
    cylinder("tproll", 0.055, 0.11, (-1.52, 1.2, 0.7), mat_flat("tp", (0.98, 0.98, 0.97), rough=0.9), rot=(0, 90, 0), verts=20)
    box("towel", (0.04, 0.45, 0.6), (-1.56, 0.1, 1.15), mat_flat("towelm", (0.25, 0.55, 0.85), rough=0.95), bevel=0.02)
    box("mat", (0.6, 0.4, 0.01), (0, 0.75, 0.005), mat_flat("bathmat", (0.25, 0.55, 0.85), rough=1.0), bevel=0.01)
    # hallway
    plane("h_floor", (6, 3.4), (0, -3.5, 0.0), mat_tex("hfloor", "wood_floor", scale=1.0, tint=(0.7, 0.55, 0.42)), uv_scale=0.6)
    hw = mat_tex("hwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.85, 0.72))
    box("h_back", (6, 0.2, 2.6), (0, -5.2, 1.3), hw, uv_scale=0.5)
    box("h_left", (0.2, 3.4, 2.6), (-3.0, -3.5, 1.3), hw, uv_scale=0.5)
    box("h_right", (0.2, 3.4, 2.6), (3.0, -3.5, 1.3), hw, uv_scale=0.5)
    plane("h_ceil", (6, 3.4), (0, -3.5, 2.6), mat_flat("hceil", (0.9, 0.88, 0.85)), rot=(180, 0, 0))
    out = {"toilet": root, "lever": lever}
    if not show:
        for nm, sz, lc in (("b_front_l", (1.25, 0.2, 2.6), (-1.075, DOOR_Y, 1.3)), ("b_front_r", (1.25, 0.2, 2.6), (1.075, DOOR_Y, 1.3)),
                           ("b_front_t", (0.9, 0.2, 0.5), (0, DOOR_Y, 2.35))):
            box(nm, sz, lc, wall, uv_scale=0.5)
        trim = mat_flat("btrim", (0.97, 0.97, 0.96), rough=0.3)
        for nm, sz, lc in (("b_jamb_l", (0.06, 0.24, 2.12), (-0.48, DOOR_Y, 1.06)), ("b_jamb_r", (0.06, 0.24, 2.12), (0.48, DOOR_Y, 1.06)),
                           ("b_jamb_t", (1.02, 0.24, 0.06), (0, DOOR_Y, 2.12))):
            box(nm, sz, lc, trim)
        area("b_ceiling", (0, 0.2, 2.5), (0, 0.4, 0), energy=320, size=1.2, color=(1.0, 0.98, 0.95))
        area("b_fill", (0.8, -1.2, 1.9), (0, 1.2, 0.9), energy=160, size=1.0, color=(0.95, 0.97, 1.0))
        area("h_light", (0, -3.5, 2.5), (0, -3.5, 0), energy=220, size=1.0, color=(1.0, 0.85, 0.65))
        return out
    # ---- theatre
    red = mat_flat("velvet", (0.55, 0.02, 0.04), rough=0.75)
    gold = mat_flat("gold", (0.85, 0.65, 0.2), metal=1.0, rough=0.3)
    box("pro_l", (0.35, 0.3, 2.6), (-1.48, DOOR_Y, 1.3), red)
    box("pro_r", (0.35, 0.3, 2.6), (1.48, DOOR_Y, 1.3), red)
    box("pro_t", (3.3, 0.3, 0.55), (0, DOOR_Y, 2.33), red)
    decal("marquee", f"{D10}/sign_show.png", 2.1, (0, DOOR_Y - 0.17, 2.33), rot=(90, 0, 0), emit=1.2)
    cylinder("rod", 0.02, 3.0, (0, DOOR_Y + 0.2, 2.05), gold, rot=(0, 90, 0), verts=12)
    halves = []
    for s in (-1, 1):
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=6, size=1, location=(0, 0, 0))
        c = bpy.context.object; c.name = f"curtain{s}"
        c.scale = (1.5, 2.05, 1); bpy.ops.object.transform_apply(scale=True)
        for v in c.data.vertices:                     # vertical folds
            v.co.z = 0.05 * math.sin(v.co.x * 26)
        c.rotation_euler = (math.radians(90), 0, 0)
        c.location = (s * 0.75, DOOR_Y + 0.22, 1.03)
        c.data.materials.append(red); bpy.ops.object.shade_smooth()
        halves.append(c)
    box("footlights", (2.6, 0.08, 0.06), (0, DOOR_Y - 0.08, 0.03), mat_flat("footglow", (1, 1, 1), emit=(1.0, 0.85, 0.55), emit_strength=6))
    bar = mat_flat("bar", (0.08, 0.08, 0.09), metal=0.8, rough=0.4)
    cylinder("lightbar", 0.025, 3.0, (0, DOOR_Y + 0.5, 2.45), bar, rot=(0, 90, 0), verts=10)
    spots = []
    for x in (-0.9, 0.9):
        cylinder(f"can{x}", 0.08, 0.2, (x, DOOR_Y + 0.5, 2.33), bar, rot=(35, 0, 0), verts=16)
        spots.append(spot(f"spot{x}", (x, DOOR_Y + 0.6, 2.3), (0, 1.3, 0.85), energy=1100, angle=24, blend=0.45,
                          color=(1.0, 0.92, 0.75), shadow=True))
    room = area("b_dim", (0, 0.2, 2.5), (0, 0.4, 0), energy=35, size=1.2, color=(0.9, 0.85, 1.0))
    area("h_dim", (0, -3.5, 2.5), (0, -3.5, 0), energy=40, size=1.0, color=(1.0, 0.8, 0.6))
    for x in (-0.55, 0.55):                            # the front row
        ep2.chair((x, -2.75, 0), rot_z=180, seat_h=0.46, color=(0.5, 0.05, 0.07))
    out.update(curtains=halves, spots=spots, room=room)
    return out


def open_curtains(halves, f0, f1):
    for c, s in zip(halves, (-1, 1)):
        key_loc(c, 1, (s * 0.75, DOOR_Y + 0.22, 1.03)); key_loc(c, f0, (s * 0.75, DOOR_Y + 0.22, 1.03))
        key_loc(c, f1, (s * 1.32, DOOR_Y + 0.22, 1.03))
        key_scale(c, 1, (1, 1, 1)); key_scale(c, f0, (1, 1, 1)); key_scale(c, f1, (0.25, 1, 1))


def open_now(halves):
    for c, s in zip(halves, (-1, 1)):
        c.location = (s * 1.32, DOOR_Y + 0.22, 1.03); c.scale = (0.25, 1, 1)


def on_throne(name="you_casual", sd=True):
    """You on the toilet, facing the doorway."""
    you = load_char(name, (TOILET.x, TOILET.y - 0.04, 0), rot_z=0, subdiv=sd)
    sit(you, SEAT_Z)
    return you


def in_doorway(sd=True):
    dale = load_char("dale", (0.0, -2.05, 0), rot_z=180, subdiv=sd)
    return dale


def seated(name, x, sd=False, tag=None):
    ch = load_char(name, (x, -2.72, 0), rot_z=180, subdiv=sd, tag=tag)
    sit(ch, 0.46)
    return ch


def clap(ch, n, cx, cy, cz, every=4, phase=0):
    """Both hands meet and part in front of the chest."""
    tl, tr = empty(f"clapL{ch.name}"), empty(f"clapR{ch.name}")
    for f in range(1, n + 1, every // 2):
        k = ((f + phase) // (every // 2)) % 2
        gap = 0.02 if k == 0 else 0.13
        key_loc(tl, f, (cx + gap, cy, cz)); key_loc(tr, f, (cx - gap, cy, cz))
    hand_ik(ch, "Left", tl); hand_ik(ch, "Right", tr)


# ============================================================================ SHOTS
@shot
def sh01():
    """If DALE is watching you TAKE A SHIT, - over Dale's shoulder in the doorway: you on the toilet, frozen."""
    n = frames_of("sh01")
    closeup()
    bathroom()
    you = on_throne()
    face(you, 1, UNEASY); blink(you, [30])
    dale = in_doorway(sd=False)
    dale.clip("137_28", **src(n, 2400))
    look_at(dale, you.body, 0.6)
    cam = Cam(lens=30, loc=(0.62, -3.45, 1.85), target=(0.0, 1.2, 0.9))
    cam.key(1, loc=(0.62, -3.45, 1.85)); cam.key(n, loc=(0.58, -3.3, 1.82))
    return n


@shot
def sh02():
    """most people yell at him to get out. - you point at the door and yell."""
    n = frames_of("sh02")
    closeup()
    bathroom()
    you = on_throne()
    tg = empty("pointout", (-0.15, 0.55, 1.2))
    key_loc(tg, 1, (-0.2, 1.0, 0.85)); key_loc(tg, 6, (-0.15, 0.55, 1.22))
    hand_ik(you, "Right", tg)
    for f in range(1, n + 1, 5):
        face(you, f, dict(YELL, jawOpen=1.0 if (f // 5) % 2 == 0 else 0.75))
    cam = Cam(lens=32, loc=(0.45, -0.9, 1.2), target=(0.0, 1.3, 0.95))
    cam.key(1, loc=(0.45, -0.9, 1.2)); cam.key(n, loc=(0.4, -0.55, 1.15))
    cam.shake(1, 12, amp=0.025, freq=1.5)
    return n


@shot
def sh03():
    """That's a MISTAKE. - Dale in the doorway: a long, blank stare straight down the lens."""
    n = frames_of("sh03")
    closeup()
    bathroom()
    dale = in_doorway()
    dale.hold("137_41", 4200)
    head = dale.world("Head", frame=1)
    camloc = Vector((head.x + 0.08, head.y + 1.35, head.z + 0.06))
    look_at(dale, empty("lookcam3", camloc), 0.9)
    face(dale, 1, DEADPAN); blink(dale, [16])
    cam = Cam(lens=50, loc=camloc, target=(head.x, head.y, head.z + 0.07))
    cam.key(1, loc=camloc); cam.key(n, loc=camloc + Vector((0, -0.25, 0)))
    face_light(cam, energy=120, size=0.8)
    return n


@shot
def sh04():
    """You see, he thinks it's A SHOW. - Dale pulls up a chair in the doorway and claps, delighted."""
    n = frames_of("sh04")
    closeup()
    bathroom()
    dale = load_char("dale", (0.0, -2.2, 0), rot_z=180, subdiv=True)
    sit(dale, 0.46)
    ep2.chair((0.0, -2.2, 0), rot_z=180, seat_h=0.46, color=(0.5, 0.05, 0.07))
    hz = dale.world("Spine1", frame=1).z + 0.05
    clap(dale, n, 0.0, -1.98, hz)
    face(dale, 1, SMILE); face(dale, 10, TADA)
    cam = Cam(lens=34, loc=(0.2, -0.4, 1.35), target=(0.0, -2.2, 1.05))
    cam.key(1, loc=(0.2, -0.4, 1.35)); cam.key(n, loc=(0.15, -0.8, 1.3))
    face_light(cam, energy=120, size=0.8)
    return n


@shot
def sh05():
    """There are THREE STEPS. - you on the toilet, chin in hand, thinking it through."""
    n = frames_of("sh05")
    closeup()
    bathroom()
    you = on_throne()
    head = you.world("Head", frame=1)
    hand_ik(you, "Right", empty("chin", (head.x - 0.02, head.y - 0.16, head.z - 0.05)))
    look_at(you, empty("ponder", (0.6, 0.0, 2.2)), 0.6)
    face(you, 1, THINK); blink(you, [22])
    cam = Cam(lens=36, loc=(-0.55, -0.6, 1.25), target=(0.0, 1.3, 1.0))
    cam.key(1, loc=(-0.55, -0.6, 1.25)); cam.key(n, loc=(-0.45, -0.3, 1.22))
    return n


@shot
def sh06():
    """FIRST, give the people what they want. - close-up: you nod, decided."""
    n = frames_of("sh06")
    closeup()
    bathroom()
    you = on_throne()
    look = empty("nod", (0.0, -1.0, 1.4))
    for f, z in ((1, 1.4), (12, 1.4), (17, 1.05), (22, 1.45), (27, 1.1), (32, 1.4)):
        key_loc(look, f, (0.0, -1.0, z))
    look_at(you, look, 0.7)
    face(you, 1, THINK); face(you, 12, DETERMINED); face(you, 34, dict(SMUG, eyeSquintLeft=0.4))
    head = you.world("Head", frame=1)
    cam = Cam(lens=50, loc=(0.25, head.y - 1.35, head.z + 0.1), target=(head.x, head.y, head.z + 0.05))
    cam.key(1, loc=(0.25, head.y - 1.35, head.z + 0.1)); cam.key(n, loc=(0.2, head.y - 1.1, head.z + 0.08))
    return n


@shot
def sh07():
    """SELL TICKETS. - your hand holds out a ticket: ADMIT ONE, THE TOILET SHOW."""
    n = frames_of("sh07")
    closeup()
    bathroom()
    you = on_throne()
    tg = empty("tickethand", (0.12, 0.5, 1.05))
    key_loc(tg, 1, (0.15, 0.95, 0.9)); key_loc(tg, 8, (0.12, 0.5, 1.05))
    hand_ik(you, "Right", tg)
    face(you, 1, SMUG)
    held_ticket(you, n, "RightHand", (0.3, -0.45, 1.15), width=0.24, offset=(0.0, -0.06, 0.04), name="ticket7")
    cam = Cam(lens=40, loc=(0.3, -0.45, 1.15), target=(0.08, 0.5, 1.02))
    cam.key(1, loc=(0.3, -0.45, 1.15)); cam.key(n, loc=(0.22, -0.2, 1.1))
    return n


@shot
def sh08():
    """Front row, $10. - Dale, front-row seat in the hallway, waves his ticket, thrilled."""
    n = frames_of("sh08")
    closeup()
    bathroom()
    dale = load_char("dale", (0.0, -2.2, 0), rot_z=180, subdiv=True)
    sit(dale, 0.46)
    ep2.chair((0.0, -2.2, 0), rot_z=180, seat_h=0.46, color=(0.5, 0.05, 0.07))
    tg = empty("ticketup", (-0.25, -2.0, 1.4))
    for f in range(1, n + 1, 6):
        key_loc(tg, f, (-0.22 + (0.06 if (f // 6) % 2 else 0.0), -1.98, 1.45))
    hand_ik(dale, "Left", tg)
    held_ticket(dale, n, "LeftHand", (0.25, -0.5, 1.4), width=0.24, offset=(0.0, 0.06, 0.08), name="ticket8")
    face(dale, 1, TADA)
    cam = Cam(lens=36, loc=(0.25, -0.5, 1.4), target=(0.0, -2.2, 1.15))
    cam.key(1, loc=(0.25, -0.5, 1.4)); cam.key(n, loc=(0.2, -0.85, 1.35))
    face_light(cam, energy=120, size=0.8)
    return n


@shot
def sh09():
    """SECOND, upgrade the bathroom. - the theatre: marquee, red curtain; the house lights drop, spotlights snap on."""
    n = frames_of("sh09")
    S = bathroom(show=True)
    you = on_throne(sd=False)
    face(you, 1, SMUG)
    f_on = at("sh09", 15.66)
    for sp in S["spots"]:
        sp.data.energy = 0; sp.data.keyframe_insert("energy", frame=1); sp.data.keyframe_insert("energy", frame=f_on - 1)
        sp.data.energy = 1100; sp.data.keyframe_insert("energy", frame=f_on)
    cam = Cam(lens=26, loc=(0.0, -4.7, 1.55), target=(0.0, -1.0, 1.3))
    cam.key(1, loc=(0.0, -4.7, 1.55)); cam.key(n, loc=(0.0, -4.2, 1.5))
    return n


@shot
def sh10():
    """SPOTLIGHTS, a red curtain, - the curtains part: you on the throne in the spotlight, arms wide."""
    n = frames_of("sh10")
    closeup()
    S = bathroom(show=True)
    open_curtains(S["curtains"], 2, 22)
    you = on_throne()
    for side, dx in (("Left", 0.55), ("Right", -0.55)):
        tg = empty(f"ta{side}", (dx, 1.1, 1.45))
        key_loc(tg, 1, (dx * 0.4, 1.15, 0.95)); key_loc(tg, 20, (dx * 0.4, 1.15, 0.95)); key_loc(tg, 30, (dx, 1.05, 1.45))
        hand_ik(you, side, tg)
    face(you, 1, SMUG); face(you, 24, TADA)
    cam = Cam(lens=28, loc=(0.0, -4.1, 1.45), target=(0.0, 0.6, 1.05))
    cam.key(1, loc=(0.0, -4.1, 1.45)); cam.key(n, loc=(0.0, -3.4, 1.35))
    return n


@shot
def sh11():
    """popcorn for LARRY. - the front row: Larry munching popcorn beside Dale, eyes on the stage."""
    n = frames_of("sh11")
    closeup()
    S = bathroom(show=True)
    open_now(S["curtains"])
    larry = seated("larry", 0.55, sd=True)
    dale = seated("dale", -0.55, sd=True)
    bucket = popcorn_bucket()
    lap = larry.world("Hips", frame=1)
    bucket.location = (0.55, lap.y + 0.28, lap.z + 0.08)
    mouth = larry.world("Head", frame=1) + Vector((0, 0.12, 0.02))
    tg = empty("munch", mouth)
    for f in range(1, n + 1, 8):
        key_loc(tg, f, (0.56, lap.y + 0.28, lap.z + 0.3)); key_loc(tg, f + 4, (mouth.x + 0.02, mouth.y + 0.06, mouth.z - 0.02))
    hand_ik(larry, "Right", tg)
    hand_ik(larry, "Left", empty("holdbucket", (0.62, lap.y + 0.28, lap.z + 0.2)))
    for f in range(1, n + 1, 4):
        face(larry, f, CHEW if (f // 4) % 2 else CREEPY_ENJOY)
    face(dale, 1, SMILE)
    point("stagespill", (0.0, -1.5, 1.4), energy=80, color=(1.0, 0.9, 0.7), radius=0.4)
    cam = Cam(lens=34, loc=(0.25, -1.15, 1.25), target=(0.3, -2.72, 1.0))
    cam.key(1, loc=(0.25, -1.15, 1.25)); cam.key(n, loc=(0.35, -1.45, 1.2))
    return n


@shot
def sh12():
    """THIRD, when you flush, - close on the tank: your hand presses the lever down."""
    n = frames_of("sh12")
    closeup()
    S = bathroom(show=True)
    open_now(S["curtains"])
    you = on_throne()
    lv = S["lever"]
    lw = lv.matrix_world.translation.copy() if False else (TOILET + Vector((-0.2, 0.165, 0.76)))
    tg = empty("flushhand", lw + Vector((0.07, -0.05, 0.03)))
    key_loc(tg, 1, lw + Vector((0.1, -0.2, 0.05))); key_loc(tg, 12, lw + Vector((0.07, -0.04, 0.03)))
    key_loc(tg, 20, lw + Vector((0.07, -0.04, -0.04)))
    hand_ik(you, "Right", tg)
    key_rot(lv, 1, (0, 0, 0)); key_rot(lv, 14, (0, 0, 0)); key_rot(lv, 20, (0, -32, 0))
    face(you, 1, DETERMINED)
    cam = Cam(lens=34, loc=(-0.55, 1.72, 1.42), target=(lw.x + 0.03, lw.y - 0.06, lw.z - 0.02))
    cam.key(1, loc=(-0.55, 1.72, 1.42)); cam.key(n, loc=(-0.48, 1.7, 1.32))
    return n


@shot
def sh13():
    """stand up and TAKE A BOW. - in the spotlight you rise from the throne and bow low; the front row watches."""
    n = frames_of("sh13")
    S = bathroom(show=True)
    open_now(S["curtains"])
    you = load_char("you_casual", (TOILET.x, TOILET.y - 0.04, 0), rot_z=0)
    ep4.pose_seq(you, [(1, ep2.SIT), (10, {}), (16, {}), (26, BOW), (n, BOW)], n)
    bpy.context.scene.frame_set(1)
    dz = settle(you, "Hips", SEAT_Z + 0.1, frame=1)
    key_loc(you.rig, 1, (TOILET.x, TOILET.y - 0.04, dz)); key_loc(you.rig, 10, (TOILET.x, TOILET.y - 0.2, 0.0))
    face(you, 1, SMUG); face(you, 18, dict(SMILE, eyeBlinkLeft=0.6, eyeBlinkRight=0.6))
    seated("dale", -0.55)
    seated("larry", 0.55)
    cam = Cam(lens=28, loc=(1.15, -1.45, 1.35), target=(0.0, 1.1, 1.0))
    cam.key(1, loc=(1.15, -1.45, 1.35)); cam.key(n, loc=(1.05, -1.2, 1.3))
    return n


@shot
def sh14():
    """Dale will BEG for an encore, because... - Dale drops to his knees in front of the stage, hands clasped."""
    n = frames_of("sh14")
    closeup()
    S = bathroom(show=True)
    open_now(S["curtains"])
    dale = load_char("dale", (0.0, -2.15, 0), rot_z=180, subdiv=True)
    ep3.kneel(dale)
    chest = dale.world("Spine1", frame=1)
    for side, dx in (("Left", 0.03), ("Right", -0.03)):
        tg = empty(f"beg{side}", (chest.x + dx, chest.y + 0.32, chest.z - 0.04))
        for f in range(1, n + 1, 6):
            key_loc(tg, f, (chest.x + dx, chest.y + 0.32, chest.z + (-0.04 if (f // 6) % 2 == 0 else 0.03)))
        hand_ik(dale, side, tg)
    look_at(dale, empty("stage", (0.0, 1.2, 1.3)), 0.7)
    face(dale, 1, BEG)
    larry = load_char("larry", (0.55, -2.75, 0), rot_z=180)
    larry.clip("137_28", **src(n, 2400))
    clap(larry, n, 0.55, -2.5, 1.2, phase=2)
    face(larry, 1, CREEPY_ENJOY)
    cam = Cam(lens=32, loc=(0.3, -0.55, 1.35), target=(0.05, -2.2, 1.0))
    cam.key(1, loc=(0.3, -0.55, 1.35)); cam.key(n, loc=(0.25, -0.85, 1.3))
    face_light(cam, energy=150, size=0.9)
    return n
