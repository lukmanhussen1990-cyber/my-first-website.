"""Shot definitions for Episode 13 "Head of Laughing" - a stand-alone short in the "If you..., that's a mistake"
format (the boss-dad humour): the bald guy laughs way too hard at his boss's joke, and commits. Same pipeline as
episodes 1-12 (imports the newest episode, 12 -> 11 -> ...). The bald guy is the office "you" model (shirt and tie)
with its hair hidden in the scene; the boss is Dale's model in his casual suit; the colleague is the HR model.
Smoothness rules learnt on episode 12: no finger close-ups, seated heads levelled (sit_level), laughs are whole-body
rocks about a pivot (no per-bone overrides), every hand target is either world-fixed or parented to the rock pivot."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
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


ep12 = _load("ep12shots", "ep12")         # newest episode (its chain: 11, 10, 9, ... 1)
ep11, ep10, ep9, ep6, ep3, ep2, ep1 = ep12.ep11, ep12.ep10, ep12.ep9, ep12.ep6, ep12.ep3, ep12.ep2, ep12.ep1
from ep2shots import (SMILE, SMUG, CREEPY, UNEASY, DETERMINED, SHOCK, DEADPAN, face, blink, look_at, hand_ik,
                      src, pose, settle, on_bone)  # noqa: E402
STERN = ep1.STERN
GRIN = ep6.GRIN
load_char, closeup = ep9.load_char, ep9.closeup
look_keys, sit_level = ep12.look_keys, ep12.sit_level

D13 = os.path.join(lib.SCRATCH, "ep13", "decals")
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


LAUGH = {"jawOpen": 0.5, "mouthSmileLeft": 1.0, "mouthSmileRight": 1.0, "eyeSquintLeft": 0.85, "eyeSquintRight": 0.85,
         "cheekSquintLeft": 0.8, "cheekSquintRight": 0.8, "browInnerUp": 0.3}
GIGGLE = {"jawOpen": 0.2, "mouthSmileLeft": 0.85, "mouthSmileRight": 0.85, "eyeSquintLeft": 0.55,
          "eyeSquintRight": 0.55, "cheekSquintLeft": 0.5, "cheekSquintRight": 0.5}
AWK = {"mouthPressLeft": 0.8, "mouthPressRight": 0.8, "browInnerUp": 0.6, "eyeWideLeft": 0.3, "eyeWideRight": 0.3}


# ============================================================================ characters & motion helpers
def bald(loc=(0, 0, 0), rot_z=0.0, sd=True, tag="guy"):
    """The bald guy: the office 'you' model with the hair card hidden in the scene (character file untouched)."""
    ch = load_char("you", loc, rot_z=rot_z, subdiv=sd, tag=tag)
    for o in ch.meshes:
        if "short02" in o.name.lower():
            o.hide_render = True; o.hide_viewport = True
    return ch


def boss_char(loc=(0, 0, 0), rot_z=0.0, sd=True):
    return load_char("dale", loc, rot_z=rot_z, subdiv=sd, tag="boss")


def seat(ch, x, y, facing=0.0, high_back=False, seat_h=0.5):
    """Office chair at (x, y) for someone facing `facing` degrees (0 = -Y); sit with a level head.
    Returns the chair pivot (empty)."""
    piv, sz = ep2.chair((x, y, 0), rot_z=facing, seat_h=seat_h, high_back=high_back)
    back = Vector((0, 0.02, 0))                                   # hips a touch toward the backrest
    back.rotate(__import__("mathutils").Euler((0, 0, math.radians(facing))))
    ch.rig.location = (x + back.x, y + back.y, 0); ch.rig.rotation_euler = (0, 0, math.radians(facing))
    sit_level(ch, sz)
    return piv


def rocker(ch, at="hips", parent=None):
    """Parent the rig to a pivot so the whole body can rock about its own left-right axis: at the hips (seated),
    the knees (kneeling) or the floor under the hips (standing). Returns the pivot: rotation_euler.x > 0 leans the
    body forward, < 0 back."""
    sc = bpy.context.scene
    sc.frame_set(1); bpy.context.view_layer.update()
    p = ch.world("Hips", frame=1)
    if at == "knees":
        p = (ch.world("LeftLeg", frame=1) + ch.world("RightLeg", frame=1)) / 2
    elif at == "floor":
        p = Vector((p.x, p.y, 0.0))
    yaw = empty(f"yaw_{ch.name}", p)
    yaw.rotation_euler = (0, 0, ch.rig.matrix_world.to_euler().z)
    if parent is not None:
        bpy.context.view_layer.update()
        mw = yaw.matrix_world.copy(); yaw.parent = parent; yaw.matrix_world = mw
    piv = empty(f"rock_{ch.name}", (0, 0, 0)); piv.parent = yaw
    bpy.context.view_layer.update()
    mw = ch.rig.matrix_world.copy()
    ch.rig.parent = piv
    ch.rig.matrix_world = mw
    piv.rotation_mode = "XYZ"
    return piv


def glue(obj, piv):
    """Parent a helper (hand target, prop) to a rock pivot, keeping its world placement."""
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy(); obj.parent = piv; obj.matrix_world = mw
    return obj


def rock(piv, keys):
    """Keyframe the rock angle: keys = [(frame, degrees)]."""
    for f, a in keys:
        piv.rotation_euler = (math.radians(a), 0, 0); piv.keyframe_insert("rotation_euler", frame=max(1, f))


def laugh(ch, piv, f0, f1, amp=7.0, period=8, lean=2.0, ramp=5, jaw=True, expr=LAUGH):
    """Belly laugh between f0 and f1: the body rocks about the pivot (sine, ramped in and out), the jaw pumps."""
    face(ch, f0, expr)
    ks = []
    for f in range(f0, f1 + 1):
        w = max(0.0, min(1.0, (f - f0) / max(1, ramp), (f1 - f) / max(1, ramp))) if ramp else 1.0
        ks.append((f, lean * w + amp * w * math.sin(2 * math.pi * (f - f0) / period)))
    rock(piv, ks)
    if jaw:
        for k, f in enumerate(range(f0, f1 + 1, 3)):
            ch.expr(f, {"jawOpen": (0.68 if expr is LAUGH else 0.35) if k % 2 == 0 else 0.22})


def talk(ch, f0, f1, every=3):
    for k, f in enumerate(range(f0, f1 + 1, every)):
        ch.expr(f, {"jawOpen": 0.3 if k % 2 == 0 else 0.04, "mouthFunnel": 0.15 if k % 3 == 1 else 0.0})
    ch.expr(f1 + 2, {"jawOpen": 0.04, "mouthFunnel": 0.0})


def slapper(ch, piv, side, base, f0, f1, every=4, lift=0.09):
    """Hand slapping a table top: an IK target bouncing on the surface (world-fixed: the table does not rock)."""
    t = empty(f"slap_{ch.name}_{side}", base)
    key_loc(t, 1, base)
    for k, f in enumerate(range(f0, f1 + 1, every)):
        key_loc(t, f, (base[0], base[1], base[2] + (lift if k % 2 else 0.0)))
    hand_ik(ch, side, t)
    return t


def hold(ch, side, p, piv=None, name=None):
    t = empty(name or f"hold_{ch.name}_{side}", p)
    if piv is not None:
        glue(t, piv)
    hand_ik(ch, side, t)
    return t


def head(ch, f=1):
    return ch.world("Head", frame=f)


# ============================================================================ sets
def office():
    ep2.newcorp_set()
    sg = bpy.data.objects.get("newcorp")
    if sg:
        sg.hide_render = True; sg.hide_viewport = True


def desk(loc=(0, 0, 0), w=1.6, d=0.75, h=0.75, name="desk", panel=True):
    """Wooden desk from primitives (top, sides, modesty panel on the -Y side). Returns the top height."""
    x, y, _ = loc
    wood = mat_flat(f"{name}_wood", (0.24, 0.14, 0.07), rough=0.35)
    box(f"{name}_top", (w, d, 0.05), (x, y, h - 0.025), wood, bevel=0.01)
    for dx in (-w / 2 + 0.03, w / 2 - 0.03):
        box(f"{name}_side{dx:+.2f}", (0.04, d - 0.06, h - 0.05), (x + dx, y, (h - 0.05) / 2), wood)
    if panel:
        box(f"{name}_panel", (w - 0.08, 0.03, h - 0.2), (x, y - d / 2 + 0.05, (h - 0.2) / 2 + 0.12), wood)
    return h


def nameplate(img, loc, width=0.5, name="plate"):
    x, y, z = loc
    box(f"{name}_base", (width + 0.04, 0.07, 0.03), (x, y + 0.02, z + 0.015), mat_flat(f"{name}_b", (0.15, 0.1, 0.06), rough=0.3))
    return decal(name, img, width, (x, y, z + 0.09), rot=(78, 0, 0))


def monitor(loc, name="mon"):
    x, y, z = loc
    frame = mat_flat(f"{name}_bezel", (0.03, 0.03, 0.03), rough=0.3)
    box(f"{name}_scr", (0.55, 0.03, 0.34), (x, y, z + 0.3), frame, bevel=0.006)
    box(f"{name}_glow", (0.51, 0.005, 0.3), (x, y - 0.016, z + 0.3), mat_flat(f"{name}_g", (0.1, 0.2, 0.35), emit=(0.35, 0.6, 1.0), emit_strength=0.8))
    box(f"{name}_neck", (0.05, 0.05, 0.13), (x, y + 0.02, z + 0.07), frame)
    box(f"{name}_foot", (0.22, 0.16, 0.015), (x, y + 0.02, z + 0.008), frame)


def meeting_set():
    office()
    wood = mat_flat("mtable", (0.28, 0.16, 0.08), rough=0.35)
    box("mt_top", (2.6, 1.1, 0.05), (0.2, 2.15, 0.74), wood, bevel=0.01)
    for dx in (-1.1, 1.1):
        box(f"mt_leg{dx}", (0.08, 0.8, 0.7), (0.2 + dx, 2.15, 0.36), mat_flat("mleg", (0.1, 0.1, 0.1), metal=0.5))
    box("screen_frame", (2.3, 0.05, 1.35), (0.2, 3.86, 1.75), mat_flat("scrf", (0.03, 0.03, 0.03)))
    decal("slide", f"{D13}/slide_q4.png", 2.2, (0.2, 3.83, 1.75), rot=(90, 0, 0), emit=0.6)
    for k, x in enumerate((-0.6, 0.95, 1.2)):
        box(f"cup{k}", (0.08, 0.08, 0.1), (x, 1.95, 0.82), mat_flat(f"cup{k}m", (0.95, 0.95, 0.95)))


def meeting(n):
    """The bald guy and the HR colleague at the table; the boss standing at the head of it, by the screen."""
    meeting_set()
    guy = bald()
    seat(guy, -0.1, 2.95)
    hr = load_char("hr", (0, 0, 0), subdiv=True, tag="hr")
    seat(hr, 0.55, 2.95)
    boss = boss_char((1.95, 2.55, 0), rot_z=-90)
    boss.clip("137_41", **src(n, 1000))
    for side, x in (("Right", 0.4), ("Left", 0.7)):
        hold(hr, side, (x, 2.55, 0.79), name=f"tbl_hr_{side}")
    return guy, hr, boss


def toilet_wall():
    """A door in the office's back wall, TOILET sign on it (the set's big plant moved out of the doorway)."""
    pp = bpy.data.objects.get("potted_plant_02")
    if pp:
        pp.location = (1.3, 3.4, 0)
    trim = mat_flat("dtrim", (0.96, 0.96, 0.95), rough=0.3)
    box("door", (0.92, 0.05, 2.05), (2.6, 3.875, 1.025), mat_flat("doorm", (0.55, 0.38, 0.22), rough=0.45), bevel=0.01)
    for nm, sz, lc in (("jl", (0.06, 0.1, 2.12), (2.11, 3.88, 1.06)), ("jr", (0.06, 0.1, 2.12), (3.09, 3.88, 1.06)),
                       ("jt", (1.04, 0.1, 0.06), (2.6, 3.88, 2.12))):
        box(f"door_{nm}", sz, lc, trim)
    cylinder("knob", 0.03, 0.06, (2.95, 3.83, 1.0), mat_flat("knobm", (0.85, 0.75, 0.4), metal=1.0, rough=0.25), rot=(90, 0, 0))
    decal("sign_toilet", f"{D13}/sign_toilet.png", 0.5, (2.6, 3.845, 1.65), rot=(90, 0, 0))


# ============================================================================ SHOTS: the meeting
@shot
def sh01():
    """If you laugh way too hard at your boss's joke, - the boss lands his joke; the bald guy explodes; HR doesn't."""
    n = frames_of("sh01")
    closeup()
    guy, hr, boss = meeting(n)
    piv = rocker(guy)
    slapper(guy, piv, "Left", (0.12, 2.5, 0.79), 12, n - 4)
    hold(guy, "Right", (-0.3, 2.55, 0.79), name="tbl_guy_R")
    laugh(guy, piv, 9, n, amp=8, period=8, lean=4)
    face(guy, 1, SMILE)
    look_keys(guy, boss, [(1, 0.55)])
    look_keys(hr, guy, [(1, 0.0), (12, 0.0), (22, 0.7)])
    look_keys(boss, guy, [(1, 0.3), (20, 0.6)])
    talk(boss, 1, 14); face(boss, 1, SMUG); face(boss, 20, DEADPAN)
    face(hr, 1, DEADPAN); blink(hr, [40])
    cam = Cam(lens=30, loc=(0.45, -0.25, 1.5), target=(0.6, 2.6, 1.15))
    cam.key(1, loc=(0.45, -0.25, 1.5)); cam.key(n, loc=(0.45, 0.25, 1.48))
    return n


@shot
def sh02():
    """most people stop and clear their throat. - he stops dead, straightens up, ahem."""
    n = frames_of("sh02")
    closeup()
    guy, hr, boss = meeting(n)
    piv = rocker(guy)
    hold(guy, "Left", (0.1, 2.55, 0.79), name="tbl_guy_L"); hold(guy, "Right", (-0.3, 2.55, 0.79), name="tbl_guy_R")
    laugh(guy, piv, 1, 12, amp=8, period=8, lean=4, ramp=0)
    rock(piv, [(13, 1.0), (18, -1.5), (30, -1.5), (33, 3.0), (36, -1.0), (40, 2.0), (43, -1.0), (n, -1.0)])
    face(guy, 14, AWK); face(guy, 34, dict(AWK, jawOpen=0.12)); face(guy, 40, AWK)
    look_keys(guy, boss, [(1, 0.55), (14, 0.55), (22, 0.0), (40, 0.0), (48, 0.4)])
    look_keys(hr, guy, [(1, 0.7)])
    face(hr, 1, DEADPAN); face(boss, 1, DEADPAN)
    hg = head(guy)
    cam = Cam(lens=40, loc=hg + Vector((0.5, -1.55, 0.05)), target=hg + Vector((0.25, 0, -0.12)))
    cam.key(1, loc=hg + Vector((0.5, -1.55, 0.05))); cam.key(n, loc=hg + Vector((0.42, -1.3, 0.05)))
    return n


@shot
def sh03():
    """That's a mistake. - the boss, dead into the lens."""
    n = frames_of("sh03")
    closeup()
    guy, hr, boss = meeting(n)
    look_keys(boss, guy, [(1, 0.85)])
    face(boss, 1, DEADPAN)
    hb, hg = head(boss), head(guy)
    d = (hg - hb).normalized()
    cam = Cam(lens=45, loc=hb + d * 0.85 + Vector((0, 0, 0.03)), target=hb + Vector((0, 0, 0.04)))
    cam.key(1, loc=hb + d * 0.85 + Vector((0, 0, 0.03))); cam.key(n, loc=hb + d * 0.68 + Vector((0, 0, 0.03)))
    return n


@shot
def sh04():
    """You see, he loved it. - the stare cracks into a huge grin; he nods, slowly, then faster."""
    n = frames_of("sh04")
    closeup()
    guy, hr, boss = meeting(n)
    hg = head(guy)
    nod = empty("nod", hg + Vector((0, 0, 0.08)))
    for k, f in enumerate(range(16, n + 1, 5)):
        key_loc(nod, f, hg + Vector((0, 0, 0.08 + (0.22 if k % 2 else -0.05))))
    key_loc(nod, 1, hg + Vector((0, 0, 0.08)))
    look_keys(boss, nod, [(1, 0.85)])
    face(boss, 1, DEADPAN); face(boss, 10, DEADPAN); face(boss, 20, GRIN); face(boss, n, dict(GRIN, jawOpen=0.25))
    hb = head(boss)
    d = (hg - hb).normalized()
    cam = Cam(lens=40, loc=hb + d * 0.95 + Vector((0, 0, 0.03)), target=hb + Vector((0, 0, 0.0)))
    cam.key(1, loc=hb + d * 0.95 + Vector((0, 0, 0.03))); cam.key(n, loc=hb + d * 0.8 + Vector((0, 0, 0.03)))
    return n


@shot
def sh05():
    """There are three steps. - the bald guy: eyes narrow."""
    n = frames_of("sh05")
    closeup()
    guy, hr, boss = meeting(n)
    hold(guy, "Left", (0.1, 2.55, 0.79), name="tbl_guy_L"); hold(guy, "Right", (-0.3, 2.55, 0.79), name="tbl_guy_R")
    look_keys(guy, boss, [(1, 0.5)])
    face(guy, 1, AWK); face(guy, 14, DETERMINED); face(guy, n, STERN)
    hg, hb = head(guy), head(boss)
    d = (hb - hg).normalized()
    cam = Cam(lens=45, loc=hg + d * 0.95 + Vector((0, -0.25, 0.04)), target=hg + Vector((0, 0, 0.04)))
    cam.key(1, loc=hg + d * 0.95 + Vector((0, -0.25, 0.04))); cam.key(n, loc=hg + d * 0.75 + Vector((0, -0.2, 0.04)))
    return n


@shot
def sh06():
    """First, commit. - slow push-in; the stare turns into a big, unhinged grin."""
    n = frames_of("sh06")
    closeup()
    guy, hr, boss = meeting(n)
    hold(guy, "Left", (0.1, 2.55, 0.79), name="tbl_guy_L"); hold(guy, "Right", (-0.3, 2.55, 0.79), name="tbl_guy_R")
    look_keys(guy, boss, [(1, 0.5)])
    face(guy, 1, STERN); face(guy, 16, STERN); face(guy, 28, CREEPY)
    hg, hb = head(guy), head(boss)
    d = (hb - hg).normalized()
    cam = Cam(lens=50, loc=hg + d * 0.9 + Vector((0, -0.2, 0.04)), target=hg + Vector((0, 0, 0.04)))
    cam.key(1, loc=hg + d * 0.9 + Vector((0, -0.2, 0.04))); cam.key(n, loc=hg + d * 0.6 + Vector((0, -0.14, 0.04)))
    return n


# ============================================================================ step one: everything he says
def desk_scene(n):
    """His desk in the open office: the bald guy seated behind it (facing -Y), the boss standing at its right."""
    office()
    top = desk((0, 0.5, 0))
    monitor((-0.35, 0.72, top))
    box("kbd", (0.42, 0.14, 0.02), (-0.3, 0.42, top + 0.01), mat_flat("kbd", (0.08, 0.08, 0.09)))
    model("potted_plant_01", (0.65, 0.75, top), scale=0.35)
    guy = bald()
    seat(guy, 0.0, 1.25)
    boss = boss_char((1.15, 0.85, 0), rot_z=-115)
    boss.clip("137_41", **src(n, 1000))
    return top, guy, boss


@shot
def sh07():
    """Laugh at everything he says. - the boss reads out a memo; the bald guy howls and slaps the desk."""
    n = frames_of("sh07")
    closeup()
    top, guy, boss = desk_scene(n)
    piv = rocker(guy)
    slapper(guy, piv, "Left", (0.2, 0.45, top + 0.02), 6, n - 3, every=4)
    hold(guy, "Right", (-0.22, 0.45, top + 0.02), name="desk_guy_R")
    laugh(guy, piv, 5, n, amp=9, period=7, lean=5)
    look_keys(guy, boss, [(1, 0.6)])
    memo = decal("memo", f"{D13}/memo.png", 0.22, (0, 0, 0), rot=(70, 0, 0))
    hb = head(boss)
    fwd = Vector((math.sin(math.radians(-115)), -math.cos(math.radians(-115)), 0)).normalized()   # boss facing
    mp = hb + fwd * 0.27 + Vector((0, 0, -0.42))
    memo.location = mp
    memo.rotation_euler = (math.radians(70), 0, math.radians(-115))
    side = fwd.cross(Vector((0, 0, 1))).normalized()
    hold(boss, "Right", mp + side * 0.09 + Vector((0, 0, -0.05)), name="memo_R")
    hold(boss, "Left", mp - side * 0.09 + Vector((0, 0, -0.05)), name="memo_L")
    talk(boss, 1, n - 6)
    face(boss, 1, DEADPAN)
    blink(boss, [20])
    cam = Cam(lens=32, loc=(0.45, -2.1, 1.45), target=(0.45, 0.9, 1.1))
    cam.key(1, loc=(0.45, -2.1, 1.45)); cam.key(n, loc=(0.42, -1.75, 1.42))
    return n


@shot
def sh08():
    """Even "Good morning." - the boss, coffee in hand: "Good morning." The bald guy on his knees, crying laughing."""
    n = frames_of("sh08")
    closeup()
    office()
    top = desk((0, 1.6, 0))
    monitor((-0.35, 1.82, top))
    guy = bald((-0.45, 0.55, 0), rot_z=90)
    ep3.kneel(guy)
    piv = rocker(guy, at="knees")
    hp = guy.world("Hips", frame=1)
    for side, dy in (("Left", 0.09), ("Right", -0.09)):
        hold(guy, side, hp + Vector((0.2, dy, 0.12)), piv=piv, name=f"belly_{side}")
    laugh(guy, piv, 1, n, amp=10, period=8, lean=-6, ramp=3)
    boss = boss_char((0.75, 0.55, 0), rot_z=-90)
    boss.clip("137_41", **src(n, 1000))
    mug = ep2.mug((0.95, 0.95, 0.95))
    hb = head(boss)
    mp = hb + Vector((-0.28, 0.12, -0.38))
    mug.location = mp
    hold(boss, "Right", mp + Vector((0.03, 0.0, 0.03)), name="mug_hand")
    g0, g1 = at("sh08", 13.62), at("sh08", 14.32)
    talk(boss, g0, g1, every=3)
    face(boss, 1, SMILE)
    look_keys(boss, guy, [(1, 0.3), (g1 + 4, 0.6)])
    look_keys(guy, boss, [(1, 0.4)])
    cam = Cam(lens=30, loc=(0.2, -2.0, 1.15), target=(0.15, 0.55, 0.95))
    cam.key(1, loc=(0.2, -2.0, 1.15)); cam.key(n, loc=(0.18, -1.7, 1.12))
    return n


# ============================================================================ step two: the toilet
@shot
def sh09():
    """Second, follow him to the toilet. - the boss walks to the toilet door; the bald guy right behind, in step."""
    n = frames_of("sh09")
    office()
    toilet_wall()
    boss = boss_char((2.6, 0.45, 0), rot_z=180, sd=False)
    boss.clip("07_01", **src(n, 60, speed=0.9, in_place=False))
    guy = bald((2.6, -0.4, 0), rot_z=180, sd=False)
    guy.clip("07_01", **src(n, 60, speed=0.9, in_place=False))
    face(guy, 1, CREEPY); face(boss, 1, UNEASY)
    cam = Cam(lens=32, loc=(3.05, -2.9, 1.55), target=(2.6, 2.6, 1.3))
    cam.key(1, loc=(3.05, -2.9, 1.55)); cam.key(n, loc=(3.0, -1.9, 1.5))
    return n


@shot
def sh10():
    """Laugh outside the door. - door shut; the bald guy leaning on it with one hand, folded over laughing."""
    n = frames_of("sh10")
    closeup()
    office()
    toilet_wall()
    guy = bald((2.45, 3.32, 0), rot_z=180)
    guy.clip("137_28", **src(n, 2400))
    piv = rocker(guy, at="floor")
    hold(guy, "Right", (2.78, 3.8, 1.45), name="door_hand")
    hold(guy, "Left", (2.35, 3.48, 1.0), piv=piv, name="belly_L")
    laugh(guy, piv, 1, n, amp=5, period=8, lean=7, ramp=3)
    cam = Cam(lens=32, loc=(4.1, 2.2, 1.45), target=(2.6, 3.45, 1.3))
    cam.key(1, loc=(4.1, 2.2, 1.45)); cam.key(n, loc=(3.85, 2.45, 1.42))
    return n


# ============================================================================ step three: the review
GUY_Y = -1.0          # the bald guy's chair, facing the boss across the desk (+Y)


def review(n):
    office()
    top = desk((0, 0, 0))
    nameplate(f"{D13}/plate_boss.png", (0.35, -0.3, top), width=0.42, name="plate_boss")
    fold = decal("folder", f"{D13}/folder_review.png", 0.24, (-0.05, 0.08, top + 0.003), rot=(0, 0, 0))
    boss = boss_char()
    seat(boss, 0.0, 0.75, facing=0.0, high_back=True)
    guy = bald()
    chair = seat(guy, 0.0, GUY_Y, facing=180.0)
    for side, x in (("Right", -0.2), ("Left", 0.2)):
        hold(boss, side, (x, 0.28, top + 0.02), name=f"desk_boss_{side}")
    return top, boss, guy, chair, fold


@shot
def sh11():
    """Third, at your performance review, - across the desk: the boss opens the review; the bald guy giggling."""
    n = frames_of("sh11")
    closeup()
    top, boss, guy, chair, fold = review(n)
    piv = rocker(guy)
    for side, x in (("Left", -0.2), ("Right", 0.2)):
        hold(guy, side, (x, GUY_Y + 0.38, 0.62), piv=piv, name=f"lap_guy_{side}")
    laugh(guy, piv, 8, n, amp=3, period=6, lean=3, expr=GIGGLE)
    face(guy, 1, SMILE)
    look_keys(boss, fold, [(1, 0.7), (26, 0.7), (34, 0.0)])
    face(boss, 1, DEADPAN); face(boss, 30, UNEASY)
    look_keys(guy, boss, [(1, 0.5)])
    cam = Cam(lens=30, loc=(2.9, -0.15, 1.3), target=(0.0, -0.15, 1.0))
    cam.key(1, loc=(2.9, -0.15, 1.3)); cam.key(n, loc=(2.6, -0.15, 1.28))
    return n


@shot
def sh12():
    """laugh so hard you fall off your chair. - he howls, rocks, tips back - chair and all - legs in the air."""
    n = frames_of("sh12")
    closeup()
    top, boss, guy, chair, fold = review(n)
    fall = empty("fall", (0.0, GUY_Y - 0.3, 0.0))
    bpy.context.view_layer.update()
    mw = chair.matrix_world.copy(); chair.parent = fall; chair.matrix_world = mw
    piv = rocker(guy, parent=fall)
    for side, x in (("Left", -0.2), ("Right", 0.2)):
        hold(guy, side, (x, GUY_Y + 0.38, 0.62), piv=piv, name=f"lap_guy_{side}")
    f_tip, f_land = 27, 37
    laugh(guy, piv, 1, n, amp=9, period=7, lean=-2, ramp=3)
    fall.rotation_mode = "XYZ"
    for f, a in ((1, 0.0), (f_tip - 6, 0.0), (f_tip, 4.0), (f_land, 88.0), (f_land + 3, 80.0), (f_land + 6, 86.0), (n, 85.0)):
        fall.rotation_euler = (math.radians(a), 0, 0); fall.keyframe_insert("rotation_euler", frame=f)
    for fc in fall.animation_data.action.fcurves:                 # gravity: slow start, fast end of the tip
        for kp in fc.keyframe_points:
            if int(kp.co.x) == f_tip:
                kp.interpolation = "QUAD"; kp.easing = "EASE_IN"
    look_keys(boss, guy, [(1, 0.45), (f_land, 0.45)])
    face(boss, 1, UNEASY); face(boss, f_land, SHOCK); face(boss, f_land + 10, SMILE)
    cam = Cam(lens=26, loc=(3.3, -1.15, 1.2), target=(0.0, -1.25, 0.75))
    cam.key(1, loc=(3.3, -1.15, 1.2)); cam.key(n, loc=(3.0, -1.2, 1.1))
    return n


# ============================================================================ the promotion
@shot
def sh13():
    """He'll make you Head of Laughing, because... - the big chair, the new nameplate; the boss's hand on his
    shoulder; both of them laughing."""
    n = frames_of("sh13")
    closeup()
    office()
    top = desk((0, 0, 0))
    nameplate(f"{D13}/plate_hol.png", (0.0, -0.3, top), width=0.62, name="plate_hol")
    guy = bald()
    seat(guy, 0.0, 0.62, facing=0.0, high_back=True)
    piv = rocker(guy)
    for side, x in (("Left", 0.2), ("Right", -0.2)):
        hold(guy, side, (x, 0.25, top + 0.02), name=f"desk_guy_{side}")
    laugh(guy, piv, 6, n, amp=6, period=8, lean=3)
    boss = boss_char((0.72, 0.72, 0), rot_z=-20)
    boss.clip("137_41", **src(n, 1000))
    bpiv = rocker(boss, at="floor")
    sh = empty("guy_shoulder")
    guy.bake_follow(sh, "LeftArm", n, offset=(0.0, 0.0, 0.07))
    hand_ik(boss, "Right", sh)
    laugh(boss, bpiv, 10, n, amp=3, period=9, lean=1)
    look_keys(boss, guy, [(1, 0.45)])
    cam = Cam(lens=32, loc=(0.3, -2.5, 1.3), target=(0.3, 0.5, 1.05))
    cam.key(1, loc=(0.3, -2.5, 1.3)); cam.key(n, loc=(0.2, -1.9, 1.22))
    return n
