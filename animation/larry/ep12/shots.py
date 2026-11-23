"""Shot definitions for Episode 12 "Nose" - a stand-alone short in the "If you..., that's a mistake" format: the bald
guy gets caught picking his nose at a red light, and commits. Same pipeline as episodes 1-11 (imports the newest
episode, 11 -> 10 -> 9 -> ...). The bald guy is the casual "you" model with its hair hidden in the scene; the guy in
the next car is Dale's model in his usual casual suit."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector, Matrix
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep11 = _load("ep11shots", "ep11")         # newest episode (its chain: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1)
ep10, ep9, ep8, ep7, ep6, ep5 = ep11.ep10, ep11.ep9, ep11.ep8, ep11.ep7, ep11.ep6, ep11.ep5
ep4, ep3, ep2, ep1 = ep11.ep4, ep11.ep3, ep11.ep2, ep11.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, TADA, SERENE,
                      face, blink, look_at, hand_ik, src, pose, settle, on_bone, sit)  # noqa: E402
STERN = ep1.STERN
load_char, closeup, face_light = ep9.load_char, ep9.closeup, ep9.face_light

D12 = os.path.join(lib.SCRATCH, "ep12", "decals")
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


INNOCENT = {"mouthPucker": 0.8, "mouthFunnel": 0.25, "browInnerUp": 0.7, "browOuterUpLeft": 0.5,
            "browOuterUpRight": 0.5}
GROSSED = {"mouthUpperUpLeft": 0.7, "mouthUpperUpRight": 0.7, "noseSneerLeft": 0.8, "noseSneerRight": 0.8,
           "browDownLeft": 0.6, "browDownRight": 0.6, "eyeSquintLeft": 0.4, "eyeSquintRight": 0.4}
LOCKED = {"browDownLeft": 0.5, "browDownRight": 0.5, "eyeWideLeft": 0.35, "eyeWideRight": 0.35,
          "mouthPressLeft": 0.5, "mouthPressRight": 0.5}


# ============================================================================ characters
def bald_guy(loc=(0, 0, 0), rot_z=0.0, sd=True, tag="guy"):
    """This short's guy: the casual model, head shaved (the hair card hidden in the scene; the character file is
    untouched)."""
    ch = load_char("you_casual", loc, rot_z=rot_z, subdiv=sd, tag=tag)
    for o in ch.meshes:
        nm = o.name.lower()
        if "short02" in nm or "hair" in nm:
            o.hide_render = True; o.hide_viewport = True
    print("bald_guy meshes:", [o.name for o in ch.meshes])
    return ch


def head_pos(ch, f=1):
    return ch.world("Head", frame=f)


# Head-bone space offsets (x = his left, y = up the head, z = face-forward) for the wrist IK target
PICK_L = (0.03, -0.09, 0.12)       # left wrist in front of the chin: fist, thumb up the nostril (Head base ~ nose level)
PICK_R = (-0.03, -0.09, 0.12)
SCRATCH_L = (0.09, -0.06, 0.07)     # left wrist beside the cheek: fingers on the side of the nose


def follow_head(ch, n, keys, name):
    """Empty that rides with the head: keys = [(frame, (x, y, z))] Head-bone-space offsets, smoothstepped, baked."""
    t = empty(name)
    ks = sorted(keys, key=lambda k: k[0])
    sc = bpy.context.scene

    def off(f):
        if f <= ks[0][0]:
            return Vector(ks[0][1])
        for (f0, a), (f1, b) in zip(ks, ks[1:]):
            if f0 <= f <= f1:
                u = (f - f0) / max(1, f1 - f0)
                u = u * u * (3 - 2 * u)
                return Vector(a).lerp(Vector(b), u)
        return Vector(ks[-1][1])
    for f in range(1, n + 1):
        sc.frame_set(f)
        pb = ch.rig.pose.bones["Head"]
        t.location = (ch.rig.matrix_world @ pb.matrix) @ off(f)
        t.keyframe_insert("location", frame=f)
    sc.frame_set(1)
    return t


def dig(base, f0, f1, amp=0.008, every=3):
    """Little up/down digging wiggle around a Head-space offset."""
    out = []
    for k, f in enumerate(range(f0, f1 + 1, every)):
        b = Vector(base)
        out.append((f, tuple(b + Vector((0, amp if k % 2 else -amp, 0.004 if k % 2 else 0)))))
    return out


def fingers(ch, side, keys):
    """keys = [(frame, curl_deg, thumb_deg)]: curl of the four fingers (one bone pair on this rig) and the thumb
    (0 = thumb up, 40 = tucked)."""
    act = ch.rig.animation_data.action if ch.rig.animation_data else None
    names = (f"{side}FingerBase", f"{side}HandFinger1", f"{side[0]}Thumb")
    if act:
        for fc in list(act.fcurves):
            if any(f'"{nm}"' in fc.data_path for nm in names):
                act.fcurves.remove(fc)
    for f, curl, th in keys:
        for nm in names[:2]:
            pb = ch.rig.pose.bones[nm]; pb.rotation_mode = "XYZ"; pb.rotation_euler = (math.radians(curl), 0, 0)
            pb.keyframe_insert("rotation_euler", frame=f)
        tb = ch.rig.pose.bones[names[2]]; tb.rotation_mode = "XYZ"; tb.rotation_euler = (math.radians(th), 0, 0)
        tb.keyframe_insert("rotation_euler", frame=f)


def aim_hand(ch, side, target):
    """Point an existing hand IK (seat_char's wheel grip) at a new target, or add one."""
    return ep6.retarget_hand(ch, side, target)


def look_keys(ch, other, keys, lift=0.08):
    """Head look-at with keyed influence: keys = [(frame, influence)]. Aims at a fixed point at the other's eye
    level (taken at frame 1), not at his head bone: two heads tracking each other would be a dependency cycle."""
    if hasattr(other, "rig"):
        p = other.rig.matrix_world @ other.rig.pose.bones["Head"].head
        bpy.context.view_layer.update()
        p = other.world("Head", frame=1) + Vector((0, 0, lift))
        tgt = empty(f"look_{ch.name}_{other.name}", p)
    else:
        tgt = other
    c = look_at(ch, tgt, 0.0)
    for f, v in keys:
        c.influence = v; c.keyframe_insert("influence", frame=max(1, f))
    return c


# ============================================================================ the red light
SEATED = dict(ep6.DRIVE, lowerneck={"rx": 18}, upperneck={"rx": 16})   # DRIVE tips the head back ~34 deg


GX, GY = 0.0, -7.9        # the bald guy's red hatchback, right lane
WX, WY = -0.28, -5.1      # the guy in the next car: silver sedan, left lane (heads level with each other)


def traffic_light(x=5.6, y=-3.35):
    metal = mat_flat("tl_metal", (0.12, 0.13, 0.12), rough=0.5, metal=0.4)
    cylinder("tl_pole", 0.07, 3.6, (x, y, 1.8), metal)
    box("tl_arm", (0.1, 2.5, 0.1), (x, y - 1.25, 3.45), metal)
    box("tl_box", (0.3, 0.34, 0.95), (x, y - 2.35, 3.0), mat_flat("tl_boxm", (0.04, 0.04, 0.04), rough=0.4), bevel=0.03)
    for k, (c, on) in enumerate((((1.0, 0.02, 0.0), True), ((1.0, 0.55, 0.0), False), ((0.05, 1.0, 0.2), False))):
        m = mat_flat(f"tl_l{k}", tuple(v * 0.12 for v in c), emit=c if on else None, emit_strength=3.0 if on else 1.0)
        cylinder(f"tl_lamp{k}", 0.1, 0.05, (x - 0.16, y - 2.35, 3.3 - k * 0.3), m, rot=(0, 90, 0))


def red_light(sd=True):
    """Both cars stopped side by side at the light, windows down. Returns (guy car, his car, guy, him)."""
    ep11.day_street()
    traffic_light()
    gcar = ep6.Car("guycar", "family", (0.62, 0.07, 0.05), windows_down=True)
    wcar = ep6.Car("witcar", "sedan", (0.6, 0.62, 0.66), windows_down=True)
    guy = bald_guy(sd=sd)
    gcar.seat_char(guy, 0, pose_over=SEATED)
    wit = load_char("dale", (0, 0, 0), subdiv=sd, tag="wit")
    wcar.seat_char(wit, 0, pose_over=SEATED)
    gcar.root.location = (GX, GY, 0)
    wcar.root.location = (WX, WY, 0)
    bpy.context.view_layer.update()
    return gcar, wcar, guy, wit


def pick_pose(guy, n, keys, side="Left"):
    """Bake a wrist target that rides with the head (keys in Head space) and point the hand at it; fist, thumb up."""
    t = follow_head(guy, n, keys, f"pick_{guy.name}_{side}")
    aim_hand(guy, side, t)
    return t


def raise_to_nose(guy, n, side, rest, f0, f1, keys=None):
    """Hand IK target that travels from a rest point (world point or object, e.g. the wheel grip or the lap) to the
    head-riding pick target between frames f0 and f1."""
    pk = PICK_L if side == "Left" else PICK_R
    t = follow_head(guy, n, keys or [(1, pk)], f"pick_{guy.name}_{side}")
    mix = empty(f"pickmix_{guy.name}_{side}")
    sc = bpy.context.scene
    for f in range(1, n + 1):
        sc.frame_set(f)
        u = min(1.0, max(0.0, (f - f0) / max(1, f1 - f0))); u = u * u * (3 - 2 * u)
        r = rest.matrix_world.translation.copy() if hasattr(rest, "matrix_world") else Vector(rest)
        mix.location = r.lerp(t.matrix_world.translation, u)
        mix.keyframe_insert("location", frame=f)
    sc.frame_set(1)
    aim_hand(guy, side, mix)
    return mix


def eye(ch, f=1):
    """World point between the eyes (Head-bone base is at about nose level)."""
    bpy.context.scene.frame_set(f)
    pb = ch.rig.pose.bones["Head"]
    return (ch.rig.matrix_world @ pb.matrix) @ Vector((0, 0.035, 0.09))


# ============================================================================ SHOTS
@shot
def sh01():
    """If the guy in the next car - from his seat: the bald guy in the next car, thumb up his nose, blissful."""
    n = frames_of("sh01")
    closeup()
    gcar, wcar, guy, wit = red_light()
    pick_pose(guy, n, dig(PICK_L, 1, n, amp=0.009))
    fingers(guy, "Left", [(1, 80, 0)])
    face(guy, 1, SERENE)
    hw, hg = head_pos(wit), head_pos(guy)
    cam = Cam(lens=62, loc=hw + Vector((0.1, -0.3, 0.02)), target=hg + Vector((0.04, 0.0, -0.03)))
    cam.key(1, loc=hw + Vector((0.1, -0.3, 0.02))); cam.key(n, loc=hw + Vector((0.1, -0.45, 0.02)))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh02():
    """sees you picking your nose, - he turns his head and sees it."""
    n = frames_of("sh02")
    closeup()
    gcar, wcar, guy, wit = red_light()
    pick_pose(guy, n, dig(PICK_L, 1, n))
    fingers(guy, "Left", [(1, 80, 0)])
    look_keys(wit, guy, [(1, 0.0), (5, 0.0), (13, 0.85)])
    face(wit, 1, DEADPAN); face(wit, 13, DEADPAN); face(wit, 20, GROSSED)
    blink(wit, [24])
    hw = head_pos(wit)
    cam = Cam(lens=50, loc=Vector((hw.x + 0.3, -6.4, hw.z + 0.04)), target=hw + Vector((0.0, 0.0, 0.0)))
    cam.key(1, loc=Vector((hw.x + 0.3, -6.4, hw.z + 0.04))); cam.key(n, loc=Vector((hw.x + 0.25, -6.0, hw.z + 0.04)))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh03():
    """most people pretend to scratch. - he clocks him, turns the pick into a scratch and whistles at the light."""
    n = frames_of("sh03")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(guy, wit, [(1, 0.0), (6, 0.8), (14, 0.8), (22, 0.0)])
    keys = dig(PICK_L, 1, 9) + [(16, SCRATCH_L)]
    sc = Vector(SCRATCH_L)
    for k, f in enumerate(range(19, n + 1, 3)):
        keys.append((f, tuple(sc + Vector((0, 0.012 if k % 2 else -0.012, 0)))))
    pick_pose(guy, n, keys)
    fingers(guy, "Left", [(1, 110, 0), (10, 110, 0), (16, 40, 40)])
    look_keys(wit, guy, [(1, 0.85)])
    face(guy, 1, SERENE); face(guy, 5, SHOCK); face(guy, 12, SHOCK); face(guy, 20, INNOCENT)
    blink(guy, [30])
    hg = head_pos(guy)
    cam = Cam(lens=38, loc=hg + Vector((0.72, 0.8, 0.04)), target=hg + Vector((0.05, 0.0, -0.05)))
    cam.key(1, loc=hg + Vector((0.72, 0.8, 0.04))); cam.key(n, loc=hg + Vector((0.62, 0.7, 0.04)))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh04():
    """That's a mistake. - the guy in the next car, still staring, dead into the lens."""
    n = frames_of("sh04")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(wit, guy, [(1, 0.9)])
    face(wit, 1, DEADPAN)
    hw, hg = head_pos(wit), head_pos(guy)
    d = (hg - hw).normalized()
    cam = Cam(lens=40, loc=hw + d * 0.75 + Vector((0, 0, 0.0)), target=hw + Vector((0, 0, -0.02)))
    cam.key(1, loc=hw + d * 0.75); cam.key(n, loc=hw + d * 0.6)
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh05():
    """You see, he's still watching. - over the bald guy's head: the next car, the guy still staring."""
    n = frames_of("sh05")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(wit, guy, [(1, 0.9)])
    look_keys(guy, wit, [(1, 0.0), (26, 0.0), (36, 0.55)])
    face(wit, 1, DEADPAN)
    face(guy, 1, INNOCENT); face(guy, 30, UNEASY)
    hw, hg = head_pos(wit), head_pos(guy)
    d = (hw - hg).normalized()
    c0 = hg - d * 0.6 + Vector((-0.22, 0, 0.07))
    cam = Cam(lens=40, loc=c0, target=hw + Vector((0, 0, 0.02)))
    cam.key(1, loc=c0); cam.key(n, loc=c0 + d * 0.15)
    face_light(cam, energy=20, size=1.0)
    return n


@shot
def sh06():
    """There are three steps. - the bald guy stares ahead; his eyes narrow."""
    n = frames_of("sh06")
    closeup()
    gcar, wcar, guy, wit = red_light()
    face(guy, 1, UNEASY); face(guy, 14, DETERMINED); face(guy, n, STERN)
    hg = head_pos(guy)
    cam = Cam(lens=42, loc=hg + Vector((0.75, 0.45, 0.04)), target=hg + Vector((0.03, 0, 0.0)))
    cam.key(1, loc=hg + Vector((0.75, 0.45, 0.04))); cam.key(n, loc=hg + Vector((0.55, 0.33, 0.04)))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh07():
    """First, commit. - from his seat again: the bald guy turns to face him and slowly puts it back in."""
    n = frames_of("sh07")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(guy, wit, [(1, 0.0), (4, 0.0), (14, 0.9)])
    grip = bpy.data.objects[f"grip{guy.name}Left"]
    raise_to_nose(guy, n, "Left", grip, 10, 24, keys=[(1, PICK_L)] + dig(PICK_L, 24, n, amp=0.006, every=4))
    fingers(guy, "Left", [(1, 30, 30), (12, 30, 30), (20, 110, 0)])
    face(guy, 1, STERN); face(guy, 14, DETERMINED)
    look_keys(wit, guy, [(1, 0.9)])
    hw, hg = head_pos(wit), head_pos(guy)
    cam = Cam(lens=58, loc=hw + Vector((0.1, -0.3, 0.02)), target=hg + Vector((0.04, 0.0, -0.03)))
    cam.key(1, loc=hw + Vector((0.1, -0.3, 0.02))); cam.key(n, loc=hw + Vector((0.1, -0.5, 0.02)))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh08():
    """Hold eye contact. - dead into the lens, thumb in, not blinking."""
    n = frames_of("sh08")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(guy, wit, [(1, 0.9)])
    pick_pose(guy, n, dig(PICK_L, 1, n, amp=0.005, every=5))
    fingers(guy, "Left", [(1, 80, 0)])
    face(guy, 1, LOCKED)
    hw, hg = head_pos(wit), head_pos(guy)
    d = (hw - hg).normalized()
    cam = Cam(lens=45, loc=hg + d * 0.8 + Vector((0, 0, 0.01)), target=hg + Vector((0, 0, -0.04)))
    cam.key(1, loc=hg + d * 0.8); cam.key(n, loc=hg + d * 0.62)
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh09():
    """Go deeper. - the thumb goes in further; he tips his head back a little; still locked on."""
    n = frames_of("sh09")
    closeup()
    gcar, wcar, guy, wit = red_light()
    look_keys(guy, wit, [(1, 0.9)])
    deep = (PICK_L[0] - 0.005, PICK_L[1] + 0.03, PICK_L[2] - 0.01)
    pick_pose(guy, n, [(1, PICK_L), (12, deep)] + dig(deep, 14, n, amp=0.004, every=3))
    fingers(guy, "Left", [(1, 80, 0)])
    guy.bone_rot("Neck", 1, (0, 0, 0)); guy.bone_rot("Neck", 12, (-8, 0, 0))
    face(guy, 1, LOCKED); face(guy, 12, CREEPY_ENJOY)
    look_keys(wit, guy, [(1, 0.9)])
    hw, hg = head_pos(wit), head_pos(guy)
    cam = Cam(lens=70, loc=hw + Vector((0.1, -0.3, 0.02)), target=hg + Vector((0.04, 0.0, -0.03)))
    cam.key(1, loc=hw + Vector((0.1, -0.3, 0.02))); cam.key(n, loc=hw + Vector((0.1, -0.55, 0.02)), lens=85)
    face_light(cam, energy=25, size=1.0)
    return n


V12 = 0.22        # metres per frame (~19 km/h, city traffic)


@shot
def sh10():
    """Second, follow him to work. - down the street: the silver car, the red hatch glued to its bumper."""
    n = frames_of("sh10")
    ep11.day_street()
    wcar = ep6.Car("witcar", "sedan", (0.6, 0.62, 0.66))
    gcar = ep6.Car("guycar", "family", (0.62, 0.07, 0.05))
    wit = load_char("dale", (0, 0, 0), subdiv=False, tag="wit"); wcar.seat_char(wit, 0, pose_over=SEATED)
    guy = bald_guy(sd=False); gcar.seat_char(guy, 0, pose_over=SEATED)
    guy.bone_rot("Spine1", 1, (12, 0, 0))                     # hunched over the wheel, staring
    face(guy, 1, STERN); face(wit, 1, UNEASY)
    y = -5.0
    gap = wcar.P["L"] / 2 + gcar.P["L"] / 2 + 0.3
    x0 = -6.0
    wcar.drive([(1, (x0, y), 0), (n, (x0 + V12 * n, y), 0)])
    gcar.drive([(1, (x0 - gap, y + 0.55), 0), (n, (x0 - gap + V12 * n, y + 0.55), 0)])
    ep6.cabin_light(gcar, 40)
    tr = ep6.tracker("trk", [(1, (x0, 0)), (n, (x0 + V12 * n, 0))])
    cam = ep6.follow(tr, Cam(lens=75, loc=(17.0, -3.3, 1.35), target=(-3.2, -4.75, 1.05), clip_end=800))
    cam.key(1, loc=(17.0, -3.3, 1.35)); cam.key(n, loc=(15.5, -3.35, 1.3))
    ep6.cabin_light(wcar, 40)
    return n


# ---------------------------------------------------------------------------- the meeting
def meeting_room(n):
    """Bright open-plan office: meeting table, Q3 slide on the wall, the presenter by the screen."""
    ep2.newcorp_set()
    sg = bpy.data.objects.get("newcorp")
    if sg:
        sg.hide_render = True; sg.hide_viewport = True
    wood = mat_flat("mtable", (0.28, 0.16, 0.08), rough=0.35)
    box("mt_top", (2.6, 1.1, 0.05), (0.2, 2.15, 0.74), wood, bevel=0.01)
    for dx in (-1.1, 1.1):
        box(f"mt_leg{dx}", (0.08, 0.8, 0.7), (0.2 + dx, 2.15, 0.36), mat_flat("mleg", (0.1, 0.1, 0.1), metal=0.5))
    box("screen_frame", (2.3, 0.05, 1.35), (0.2, 3.86, 1.75), mat_flat("scrf", (0.03, 0.03, 0.03)))
    decal("slide", f"{D12}/slide_q3.png", 2.2, (0.2, 3.83, 1.75), rot=(90, 0, 0), emit=0.6)
    for k, x in enumerate((-0.95, 1.35)):
        box(f"cup{k}", (0.08, 0.08, 0.1), (x, 1.95, 0.82), mat_flat(f"cup{k}m", (0.95, 0.95, 0.95)))
    hr = load_char("hr", (1.85, 2.95, 0), rot_z=-55, subdiv=True, tag="hr")
    hr.clip("137_41", **src(n, 1000))
    ptr = empty("hr_point", (1.35, 3.35, 1.55))
    hand_ik(hr, "Right", ptr)
    return hr


def seat_at_table(ch, x, y=2.95, chair_color=(0.08, 0.08, 0.09)):
    piv, sz = ep2.chair((x, y, 0), rot_z=0, seat_h=0.5, color=chair_color)
    ch.rig.location = (x, y - 0.02, 0); ch.rig.rotation_euler = (0, 0, 0)
    sit(ch, sz)
    return piv


def meeting(n):
    hr = meeting_room(n)
    wit = load_char("dale", (0, 0, 0), subdiv=True, tag="wit")
    seat_at_table(wit, 0.25)
    guy = bald_guy()
    seat_at_table(guy, -0.27)                                 # chair jammed right against his
    for ch, xs in ((wit, (0.1, 0.45)), ):
        for side, x in zip(("Right", "Left"), xs):
            g = empty(f"tbl{ch.name}{side}", (x, 2.55, 0.79)); hand_ik(ch, side, g)
    g = empty("tblguyLeft", (-0.12, 2.55, 0.79)); hand_ik(guy, "Left", g)
    look_keys(guy, wit, [(1, 0.95)])
    return hr, wit, guy


@shot
def sh11():
    """Sit in his meeting. - Q3 results; the bald guy's chair jammed against his, staring at him from 20 cm."""
    n = frames_of("sh11")
    closeup()
    hr, wit, guy = meeting(n)
    look_keys(wit, hr, [(1, 0.35)])
    look_keys(hr, guy, [(1, 0.0), (14, 0.0), (24, 0.8)])
    face(wit, 1, UNEASY); face(guy, 1, LOCKED); face(hr, 1, SMILE); face(hr, 24, SHOCK)
    blink(wit, [10, 28])
    cam = Cam(lens=30, loc=(0.0, -0.9, 1.5), target=(0.15, 2.8, 1.15))
    cam.key(1, loc=(0.0, -0.9, 1.5)); cam.key(n, loc=(0.0, -0.3, 1.45))
    return n


@shot
def sh12():
    """Do it slower. - two-shot: the thumb goes in, slowly, while he side-eyes in horror."""
    n = frames_of("sh12")
    closeup()
    hr, wit, guy = meeting(n)
    hg = head_pos(guy)
    raise_to_nose(guy, n, "Right", (-0.42, 2.55, 0.79), 2, 24)
    fingers(guy, "Right", [(1, 80, 0)])
    look_keys(wit, guy, [(1, 0.15), (10, 0.35)])
    face(wit, 1, UNEASY); face(wit, 14, GROSSED); face(guy, 1, LOCKED)
    cam = Cam(lens=42, loc=(0.0, 0.85, 1.3), target=(0.0, 2.9, 1.15))
    cam.key(1, loc=(0.0, 0.85, 1.3)); cam.key(n, loc=(0.0, 1.15, 1.28))
    return n


# ---------------------------------------------------------------------------- the windscreen
PX, PY = 0.0, -4.1         # his car, parked at the kerb


def ws_point(car, u, y):
    """World point on the sedan's windscreen (u 0 = bottom edge, 1 = top) and its outward normal."""
    P = car.P
    x = P["x_ws"] - P["rake"] * u
    z = P["belt"] + (P["roof"] - P["belt"]) * u
    nrm = Vector((P["roof"] - P["belt"], 0, P["rake"])).normalized()
    return car.root.matrix_world @ Vector((x, y, z)), nrm


def on_glass(obj, nrm):
    """Orient a flat card (normal +Z, image up +Y) on the windscreen: image up = up the glass, normal outward."""
    up = Vector((-nrm.z, 0, nrm.x))
    right = up.cross(nrm)
    M = Matrix((right, up, nrm)).transposed()
    obj.rotation_euler = M.to_euler()


def parked(n, note_frame=None, bogey_frame=None):
    ep11.day_street()
    car = ep6.Car("witcar", "sedan", (0.6, 0.62, 0.66))
    car.root.location = (PX, PY, 0)
    bpy.context.view_layer.update()
    p, nrm = ws_point(car, 0.42, 0.55)
    note = decal("note_ws", f"{D12}/note.png", 0.15, (0, 0, 0), rot=(0, 0, 0))
    note.location = p + nrm * 0.006
    on_glass(note, nrm)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.022)
    bg = bpy.context.object; bg.name = "bogey"; bg.scale = (1.0, 0.8, 0.45)
    bg.data.materials.append(mat_flat("bogeym", (0.32, 0.5, 0.08), rough=0.15))
    bpy.ops.object.shade_smooth()
    q, _ = ws_point(car, 0.25, 0.42)
    bg.location = q + nrm * 0.008
    on_glass(bg, nrm)
    for o, f in ((note, note_frame), (bg, bogey_frame)):
        if f:
            o.hide_render = True; o.keyframe_insert("hide_render", frame=1)
            o.hide_render = True; o.keyframe_insert("hide_render", frame=f - 1)
            o.hide_render = False; o.keyframe_insert("hide_render", frame=f)
    return car, note, bg


@shot
def sh13():
    """Third, leave one on his windscreen with a note. - the parked silver car; he sticks the note on, wipes it."""
    n = frames_of("sh13")
    closeup()
    car, note, bg = parked(n, note_frame=30, bogey_frame=50)
    guy = bald_guy((PX + 0.95, -2.62, 0), rot_z=-20)
    guy.clip("137_41", **src(n, 1000))
    held = decal("note_hand", f"{D12}/note.png", 0.15, (0, 0, 0), rot=(0, 0, 0))
    on_bone(guy, held, "LeftHand", (0.0, 0.09, 0.03), rot=(-90, 0, 0))
    held.hide_render = False; held.keyframe_insert("hide_render", frame=1)
    held.hide_render = False; held.keyframe_insert("hide_render", frame=29)
    held.hide_render = True; held.keyframe_insert("hide_render", frame=30)
    rest = Vector((PX + 1.05, -2.85, 0.95))
    tgt = empty("reach", rest)
    key_loc(tgt, 1, rest)
    key_loc(tgt, 22, note.location + Vector((0.04, 0.12, 0.08)))
    key_loc(tgt, 30, note.location + Vector((0.02, 0.1, 0.05)))
    key_loc(tgt, 40, note.location + Vector((0.02, 0.1, 0.05)))
    key_loc(tgt, 48, bg.location + Vector((0.03, 0.11, 0.06)))
    key_loc(tgt, 54, bg.location + Vector((0.0, 0.11, 0.03)))
    key_loc(tgt, 64, rest)
    hand_ik(guy, "Left", tgt)
    fingers(guy, "Left", [(1, 60, 30), (40, 60, 30), (44, 110, 0), (56, 110, 0), (62, 50, 30)])
    look_at(guy, note, 0.6)
    face(guy, 1, STERN); face(guy, 56, SMUG)
    cam = Cam(lens=30, loc=(PX + 3.6, -4.9, 1.55), target=(PX + 0.65, -3.25, 1.2))
    cam.key(1, loc=(PX + 3.6, -4.9, 1.55)); cam.key(n, loc=(PX + 3.2, -4.6, 1.5))
    return n


@shot
def sh14():
    """"You dropped this." - the note and its little green friend on the windscreen."""
    n = frames_of("sh14")
    car, note, bg = parked(n)
    p, nrm = note.location, ws_point(car, 0.4, 0.5)[1]
    mid = (note.location + bg.location) / 2
    cam = Cam(lens=40, loc=mid + nrm * 0.55 + Vector((0, -0.05, 0)), target=mid)
    cam.key(1, loc=mid + nrm * 0.6 + Vector((0, -0.05, 0))); cam.key(n, loc=mid + nrm * 0.45 + Vector((0, -0.04, 0)))
    return n


# ---------------------------------------------------------------------------- the bus
@shot
def sh15():
    """Now he takes the bus, because... - he finally relaxes on the bus; the bald guy is in the next seat."""
    n = frames_of("sh15")
    closeup()
    seats = ep2.bus_interior_set()
    row_y = -0.3
    wit = load_char("dale", (-0.85, row_y, 0), rot_z=0, subdiv=True, tag="wit")
    sit(wit, 0.53)
    guy = bald_guy((-0.38, row_y, 0), rot_z=0)
    sit(guy, 0.53)
    for side, x in (("Right", -1.0), ("Left", -0.72)):
        g = empty(f"lapwit{side}", (x, row_y - 0.3, 0.68)); hand_ik(wit, side, g)
    look_keys(guy, wit, [(1, 0.9)])
    look_keys(wit, guy, [(1, 0.0), (18, 0.0), (26, 0.8)])
    raise_to_nose(guy, n, "Left", (-0.28, row_y - 0.3, 0.68), 30, n - 3)
    fingers(guy, "Left", [(1, 80, 0)])
    g = empty("lapguyRight", (-0.48, row_y - 0.3, 0.68)); hand_ik(guy, "Right", g)
    face(wit, 1, SERENE); face(wit, 22, SERENE); face(wit, 28, SHOCK)
    face(guy, 1, LOCKED)
    cam = Cam(lens=32, loc=(-0.55, row_y - 1.35, 1.3), target=(-0.6, row_y, 1.05))
    cam.key(1, loc=(-0.55, row_y - 1.35, 1.3)); cam.key(n, loc=(-0.58, row_y - 1.05, 1.25))
    return n
