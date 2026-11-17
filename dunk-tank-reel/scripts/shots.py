"""Per-shot animation setups (local frames start at 1)."""
import bpy, math, random
from mathutils import Vector, Matrix, Euler
import rigtools, poses as P, shotlib as L, fx
from rigtools import apply_pose, blend_pose
from shotlib import Cam, pose_keys, place_keys, show, key_loc, key_rot, key_scale, look_at_yaw

BUSH = Vector((-3.3, -3.6, 0))
SPOT_A = Vector((-4.4, 2.6, 0))
TANK = Vector((0.9, 3.0, 0))
TANK_YAW = -31.0
YOU_BUSH = Vector((-3.13, -4.62, 0))       # YOU crouches here, behind the bush
EYE = {"YOU": Vector((0.0, -0.124, 1.599)), "FRIEND": Vector((0.0, -0.13, 1.635))}


def rotz(v, deg):
    return Matrix.Rotation(math.radians(deg), 3, 'Z') @ Vector(v)


def local_to_world(base, yaw, local):
    return Vector(base) + rotz(local, yaw)


def tank_local(local):
    return local_to_world(TANK, TANK_YAW, local)


def binoculars_to_eyes(rig, f_on=None, f_off=None):
    b = bpy.data.objects["Binoculars"]
    show(b, True)
    e = EYE[rig.obj.name]
    con, off = L.attach_rest(b, rig, "head", (e.x, e.y - 0.035, e.z - 0.005), (0, 0, 0), f_on=f_on, f_off=f_off)
    return b, con, off


def eye_world(rig, frame):
    return L.head_point(rig, EYE[rig.obj.name], frame)


def breathing(rig, f0, f1, a, b, period=16, interp=None):
    """alternate two poses for subtle life"""
    f = f0
    i = 0
    while f <= f1:
        apply_pose(rig, a if i % 2 == 0 else b)
        rig.key(f, interp=interp)
        f += period // 2
        i += 1


def friend_at_A(fr, yaw_to=None):
    yaw = look_at_yaw(SPOT_A, yaw_to if yaw_to is not None else YOU_BUSH)
    fr.place(1, loc=tuple(SPOT_A), yaw=yaw)
    return yaw


def you_in_bush(you, look_at=SPOT_A):
    yaw = look_at_yaw(YOU_BUSH, look_at)
    you.place(1, loc=tuple(YOU_BUSH), yaw=yaw)
    return yaw


def scratch_loop(fr, f0, f1, period=6):
    f = f0
    i = 0
    while f <= f1:
        apply_pose(fr, P.F_SCRATCH_A if i % 2 == 0 else P.F_SCRATCH_B)
        fr.key(f)
        f += period // 2
        i += 1


# =========================================================================== S01a
def S01a(sc, you, fr, n):
    """'You LOVE seeing' - YOU in the bush with binoculars, seen from behind-left."""
    yaw = you_in_bush(you)
    friend_at_A(fr)
    pose_keys(fr, [(1, P.F_IDLE)])
    breathing(you, 1, n + 2, P.CROUCH_BINOC, P.CROUCH_BINOC_B, period=20)
    binoculars_to_eyes(you)
    cam = Cam(lens=26)
    head = L.head_point(you, EYE["YOU"], 1)
    c0 = local_to_world(head, yaw, (0.40, 0.85, 0.16))
    t0 = local_to_world(head, yaw, (-0.25, -2.5, -0.28))
    cam.key(1, c0, t0)
    cam.key(n, local_to_world(head, yaw, (0.36, 0.76, 0.15)), t0)


# =========================================================================== S01b
def S01b(sc, you, fr, n):
    """'your friend wet,' - over-the-shoulder from behind YOU's head; friend by the shed, dry."""
    yaw = you_in_bush(you)
    friend_at_A(fr)
    breathing(you, 1, n + 2, P.CROUCH_BINOC_B, P.CROUCH_BINOC, period=22)
    binoculars_to_eyes(you)
    pose_keys(fr, [(1, P.F_IDLE), (14, P.F_SCRATCH_A), (18, P.F_SCRATCH_B), (22, P.F_SCRATCH_A),
                   (26, P.F_SCRATCH_B), (31, P.F_SCRATCH_A)])
    cam = Cam(lens=38)
    head = L.head_point(you, EYE["YOU"], 1)
    c0 = local_to_world(head, yaw, (-0.30, 0.80, 0.22))
    tgt = local_to_world(SPOT_A + Vector((0, 0, 0.6)), yaw, (1.2, 0, 0))
    cam.key(1, c0, tgt)
    cam.key(n, local_to_world(head, yaw, (-0.26, 0.55, 0.10)), tgt)


# =========================================================================== S02
def S02(sc, you, fr, n):
    """'but he's always dry!' - binocular POV: friend scratching his belly."""
    yaw = you_in_bush(you)
    friend_at_A(fr)
    L.hide_char(you)
    scratch_loop(fr, 1, n + 2, period=7)
    apply_pose(fr, P.F_IDLE)
    cam = Cam(lens=105)
    eye = YOU_BUSH + Vector((0.05, 0.55, 1.52))
    tgt = SPOT_A + Vector((0, 0, 1.12))
    cam.key(1, eye, tgt)
    cam.key(n, eye, tgt + Vector((0, 0, 0.05)))
    cam.handheld(1, n + 2)


# =========================================================================== S03
def S03(sc, you, fr, n):
    """'So you throw a water balloon.' - YOU springs up from the bush and throws."""
    yaw = you_in_bush(you)
    friend_at_A(fr)
    pose_keys(fr, [(1, P.F_IDLE)])
    pose_keys(you, [
        (1, P.CROUCH_HOLD), (8, blend_pose(P.CROUCH_HOLD, P.CROUCH_BINOC, 0.1)),
        (12, blend_pose(P.CROUCH_HOLD, P.SPRING_UP, 0.35)),
        (17, P.SPRING_UP), (21, blend_pose(P.SPRING_UP, P.THROW_REL, 0.5)),
        (24, P.THROW_REL), (30, P.THROW_FOLLOW), (n + 2, P.THROW_FOLLOW),
    ])
    bal = bpy.data.objects["BalloonRed"]
    show(bal, True)
    con, off = L.attach_rest(bal, you, "wrist.R", (-0.545, -0.27, 0.955), (0, 0, 0), f_off=25)
    L.release(bal, off, 25, SPOT_A + Vector((0.05, 0.4, 1.75)), 25 + 26, apex=0.9, spin=(260, 0, 140))
    cam = Cam(lens=30)
    c0 = Vector((-1.15, -5.15, 1.15))
    tgt = Vector((-3.2, -4.15, 1.05))
    cam.key(1, c0, tgt)
    cam.key(16, c0 + Vector((0.0, 0, 0.05)), tgt + Vector((0, 0.05, 0.22)))
    cam.key(n, c0 + Vector((-0.1, 0.05, 0.08)), tgt + Vector((0, 0.15, 0.25)))


# =========================================================================== S04a
def S04a(sc, you, fr, n):
    """'Except he dodges' - slow-motion Matrix lean back, balloon sails over."""
    yaw = friend_at_A(fr)
    pose_keys(fr, [(1, P.F_IDLE), (5, blend_pose(P.F_IDLE, P.F_MATRIX, 0.25)), (16, P.F_MATRIX),
                   (n + 2, blend_pose(P.F_MATRIX, P.F_MATRIX, 0))])
    bal = bpy.data.objects["BalloonRed"]
    show(bal, True)
    start = local_to_world(SPOT_A, yaw, (0.05, -1.6, 1.62))
    end = local_to_world(SPOT_A, yaw, (0.0, 1.25, 1.55))
    L.ballistic(bal, 1, start, end, n, apex=0.05, spin=(60, 0, 25))
    cam = Cam(lens=40)
    # slow orbit around the friend (bullet-time feel)
    for f, a in ((1, 58), (n // 2, 38), (n, 20)):
        ang = math.radians(a)
        c = local_to_world(SPOT_A, yaw, (math.cos(ang) * 2.8, -math.sin(ang) * 2.8, 1.2))
        cam.key(f, c, SPOT_A + Vector((0, 0, 1.15)))


# =========================================================================== S04b
def S04b(sc, you, fr, n):
    """'it.' - balloon explodes on the shed wall."""
    L.hide_char(fr)
    hit = Vector((-4.95, 4.66, 1.5))
    bal = bpy.data.objects["BalloonRed"]
    show(bal, True)
    L.ballistic(bal, 1, hit + Vector((0.08, -1.2, 0.08)), hit + Vector((0, -0.08, 0)), 4, apex=0.02)
    key_scale(bal, 4, 1.0)
    key_scale(bal, 5, (1.6, 0.4, 1.4))
    key_scale(bal, 6, 0.001)
    show(bal, True, 1)
    show(bal, False, 6)
    fx.burst(hit + Vector((0, -0.12, 0)), 5, n=200, speed=(1.5, 4.5), up=(-0.3, 0.8), spread=1.5,
             size=(0.014, 0.034), life=(10, 22), seed=41, direction=(0, -1, 0.2))
    fx.burst(hit + Vector((0, -0.1, -0.05)), 6, n=60, speed=(0.5, 1.5), up=(-1.0, -0.3), spread=0.6,
             size=(0.015, 0.03), life=(10, 20), seed=42)
    sp = bpy.data.objects["WetSplat"]
    show(sp, True)
    sp.location = hit + Vector((0, -0.045, 0))
    sp.rotation_euler = (math.radians(90), 0, 0)
    sp.color = (1, 1, 1, 0)
    sp.keyframe_insert("color", index=3, frame=4)
    sp.color = (1, 1, 1, 0.9)
    sp.keyframe_insert("color", index=3, frame=6)
    key_scale(sp, 4, 0.2)
    key_scale(sp, 7, 0.9)
    cam = Cam(lens=30)
    c = Vector((-3.55, 3.05, 1.35))
    cam.key(1, c, hit + Vector((0, 0, -0.1)))
    cam.key(n, c + Vector((0.08, 0.1, 0)), hit + Vector((0, 0, -0.1)))
    cam.shake(5, dur=9, amp=0.025, rot_amp=1.2, seed=5)


# --------------------------------------------------------------------------- helpers 2
TANK_PARTS_ORDER = ["TankBase", "TankPost", "TankPost.001", "TankPost.002", "TankPost.003", "TankRailX",
                    "TankRailX.001", "TankRailY", "TankRailY.001", "AcrylicFront", "AcrylicL", "AcrylicR",
                    "TankBack", "TankWaterBody", "TankWaterSurface", "CagePost", "CagePost.001", "CageTop",
                    "Backrest", "DunkSign", "SeatBracket", "SeatBracket.001", "SeatPivot"]
LEVER_PARTS = ["LeverBase", "LeverPivot", "LeverRod"]
TARGET_PARTS = ["TargetArm", "TargetPost", "TargetFoot", "TargetPivot"]
SEAT_TOP = 1.585
FR_SIT_Z = SEAT_TOP + 0.10 - 0.49          # armature z so that the hips sit on the seat
WATER_Z = 1.10


def show_tank(lever=False, target=False, strap=True):
    tank = bpy.data.objects["DunkTank"]
    show(tank, True)
    if not lever:
        for n in LEVER_PARTS:
            show(n, False)
    if not target:
        for n in TARGET_PARTS:
            show(n, False)
    if not strap:
        show("SeatStrap", False)
    return tank


def friend_on_seat(fr, frame=1, pose=None):
    loc = tank_local((0, 0.20, 0))
    fr.place(frame, loc=(loc.x, loc.y, FR_SIT_Z), yaw=TANK_YAW)
    if pose is not None:
        apply_pose(fr, pose)
        fr.key(frame)


def friend_in_water(fr, frame, pose=None, z=0.12 - 0.20, dy=0.05):
    loc = tank_local((0, dy, 0))
    fr.place(frame, loc=(loc.x, loc.y, z), yaw=TANK_YAW)
    if pose is not None:
        apply_pose(fr, pose)
        fr.key(frame)


def seat_drop(f0, dur=3, angle=82):
    show("SeatStrap", True, f0 - 1)
    show("SeatStrap", False, f0 + 1)
    piv = bpy.data.objects["SeatPivot"]
    key_rot(piv, f0, (0, 0, 0))
    key_rot(piv, f0 + dur, (angle, 0, 0), 'BOUNCE')
    key_rot(piv, f0 + dur + 6, (angle - 6, 0, 0))
    return piv


def big_splash(f, seed=1, scale=1.0, cam=None):
    surf = tank_local((0, 0.05, WATER_Z + 0.02))
    fx.burst(surf, f, n=int(380 * scale), speed=(2.8 * scale, 6.2 * scale), up=(0.7, 1.0), spread=0.9,
             size=(0.02, 0.055), life=(22, 40), seed=seed, ground=0.0, stretch=1.2)
    fx.burst(surf, f + 1, n=int(160 * scale), speed=(3.5, 7.0), up=(0.85, 1.0), spread=0.35,
             size=(0.03, 0.07), life=(24, 40), seed=seed + 3, ground=0.0, stretch=1.4)
    fx.burst(surf + Vector((0, 0, 0.1)), f + 1, n=int(120 * scale), speed=(1.5, 3.5), up=(0.2, 0.6), spread=1.6,
             size=(0.015, 0.035), life=(18, 30), seed=seed + 7, ground=0.0)
    fx.crown(surf, f, radius=0.85 * scale, height=0.9 * scale, dur=14, seed=seed)
    fx.crown(surf, f + 3, radius=0.6 * scale, height=1.4 * scale, dur=12, seed=seed + 1, squash=1.3)
    ws = bpy.data.objects["TankWaterSurface"]
    fx.ripple(ws, f, height=0.07 * scale, speed=0.09, width=0.3, damp=50)
    if cam:
        cam.shake(f, dur=12, amp=0.05 * scale, rot_amp=2.2 * scale, seed=seed)


def lever_pop(f):
    for n in LEVER_PARTS:
        ob = bpy.data.objects[n]
        show(ob, True)
        L.pop_in(ob, f, dur=4)


def target_pop(f):
    for n in TARGET_PARTS:
        ob = bpy.data.objects[n]
        show(ob, True)
        L.pop_in(ob, f, dur=4)


def bullseye_world():
    bpy.context.view_layer.update()
    return bpy.data.objects["Bullseye"].matrix_world.translation.copy()


# =========================================================================== S05
def S05(sc, you, fr, n):
    """'So you hang a bucket over his head.' - fast build of the A-frame around the oblivious friend."""
    yaw = friend_at_A(fr)
    breathing(fr, 1, n + 2, P.F_IDLE, blend_pose(P.F_IDLE, P.F_SCRATCH_A, 0.25), period=24)
    rigb = bpy.data.objects["BucketRig"]
    show(rigb, True)
    legs = ["BucketLeg", "BucketLeg.001", "BucketLeg.002", "BucketLeg.003"]
    order = [(legs[0], 7), (legs[1], 10), ("BucketBrace", 13), (legs[2], 17), (legs[3], 20),
             ("BucketBrace.001", 23), ("BucketBar", 28)]
    for name, f in order:
        L.pop_in(bpy.data.objects[name], f, dur=4)
    piv = bpy.data.objects["BucketPivot"]
    L.drop_in(piv, 34, dur=5, height=0.9)
    # YOU zipping around the frame (stop-motion fast build)
    W = lambda lx, ly: tuple(local_to_world(SPOT_A, yaw, (lx, ly, 0)))
    face_in = yaw + 180
    spots = [(1, W(2.6, -1.6), yaw + 140, P.STAND), (5, W(1.3, -0.3), yaw - 90, P.KNEEL_WORK_A),
             (9, W(1.3, 0.3), yaw - 90, P.KNEEL_WORK_B), (13, W(1.25, 0.1), yaw - 90, P.STAND_WORK),
             (16, W(-1.3, -0.3), yaw + 90, P.KNEEL_WORK_A), (20, W(-1.3, 0.3), yaw + 90, P.KNEEL_WORK_B),
             (24, W(-1.25, 0.0), yaw + 90, P.STAND_WORK), (27, W(0.6, 0.55), face_in, P.STAND_REACH_UP),
             (32, W(0.35, 0.55), face_in, P.STAND_REACH_UP), (37, W(0.5, 0.6), face_in, P.STAND_WORK),
             (42, W(1.6, -0.8), yaw + 30, P.PROUD), (47, W(1.7, -0.9), yaw + 30, P.PROUD_B),
             (52, W(3.2, -2.6), yaw + 150, P.STAND), (n, W(4.5, -3.6), yaw + 150, P.STAND)]
    for f, loc, yy, pose in spots:
        you.place(f, loc=loc, yaw=yy, interp='LINEAR')
        apply_pose(you, pose)
        you.key(f)
    walk = blend_pose(P.WALK_A, P.WALK_A, 0)
    cam = Cam(lens=26)
    c = local_to_world(SPOT_A, yaw, (2.9, -4.6, 1.55))
    t = SPOT_A + Vector((0.2, 0, 1.25))
    cam.key(1, c, t)
    cam.key(n, local_to_world(SPOT_A, yaw, (2.6, -4.2, 1.6)), t)


# =========================================================================== S06
def S06(sc, you, fr, n):
    """'Clever!' - binocular POV: friend right under the bucket."""
    friend_at_A(fr)
    L.hide_char(you)
    show("BucketRig", True)
    breathing(fr, 1, n + 2, P.F_IDLE, blend_pose(P.F_IDLE, P.F_SCRATCH_A, 0.2), period=20)
    cam = Cam(lens=80)
    eye = YOU_BUSH + Vector((0.05, 0.55, 1.52))
    tgt = SPOT_A + Vector((0, 0, 1.62))
    cam.key(1, eye, tgt)
    cam.key(n, eye, tgt + Vector((0, 0, 0.04)))
    cam.handheld(1, n + 2, seed=6)


# =========================================================================== S07a
def S07a(sc, you, fr, n):
    """'But he steps away,' - friend casually walks out from under the bucket."""
    yaw = friend_at_A(fr)
    show("BucketRig", True)
    pose_keys(fr, [(1, P.F_IDLE), (5, P.F_IDLE)])
    end = local_to_world(SPOT_A, yaw, (-2.4, -0.4, 0))
    L.walk_cycle(fr, 6, 32, SPOT_A, end, stride_frames=10, base_pose=P.F_WALK_BASE, arm_swing=14, leg_swing=22)
    pose_keys(fr, [(36, blend_pose(P.F_WALK_BASE, P.F_IDLE, 1.0))])
    cam = Cam(lens=26)
    c = local_to_world(SPOT_A, yaw, (1.6, -4.8, 1.5))
    t = SPOT_A + Vector((-0.6, 0, 1.3))
    cam.key(1, c, t)
    cam.key(n, c + Vector((0, 0, 0.02)), local_to_world(SPOT_A, yaw, (-1.0, 0, 1.3)))


# =========================================================================== S07b
def S07b(sc, you, fr, n):
    """'and YOU get' - YOU checks under the bucket, tugs, gets dumped on."""
    L.hide_char(fr)
    yaw = look_at_yaw(SPOT_A, YOU_BUSH)
    you.place(1, loc=tuple(SPOT_A + rotz((0, 0.05, 0), yaw)), yaw=yaw)
    show("BucketRig", True)
    hit_face = blend_pose(P.SOAKED, P.SOAKED, 0)
    hit_face["face"] = dict(eyeBlinkLeft=1.0, eyeBlinkRight=1.0, mouthPressLeft=0.9, mouthPressRight=0.9,
                            browDownLeft=0.6, browDownRight=0.6)
    hit_face["armL"] = dict(side_deg=30, fwd=10, elbow=40, twist=0, wrist=(0, 0, 0), clav=(0, 0, 18))
    hit_face["armR"] = dict(side_deg=30, fwd=10, elbow=40, twist=0, wrist=(0, 0, 0), clav=(0, 0, 18))
    hit_face["head"] = dict(nod=8, turn=0, tilt=0)
    pull = blend_pose(P.LOOK_UP_PULL, P.LOOK_UP_PULL, 0)
    pull["armR"] = dict(side_deg=12, fwd=20, twist=10, elbow=40, wrist=(0, 0, 0), clav=(0, 0, 0))
    pose_keys(you, [(1, P.LOOK_UP_PULL), (6, P.LOOK_UP_PULL), (9, pull), (13, P.LOOK_UP_PULL),
                    (16, hit_face), (21, hit_face), (n + 2, blend_pose(hit_face, P.SOAKED, 0.6))])
    bucket = bpy.data.objects["Bucket"]
    piv = bpy.data.objects["BucketPivot"]
    key_rot(piv, 8, (0, 0, 0))
    key_rot(piv, 11, (14, 0, 0))
    key_rot(piv, 15, (-6, 0, 0))
    key_rot(piv, 22, (4, 0, 0))
    key_rot(bucket, 9, (0, 0, 0))
    key_rot(bucket, 13, (0, 150, 0), 'BACK')
    key_rot(bucket, 16, (0, 165, 0))
    bw = bpy.data.objects["BucketWater"]
    show(bw, True, 1)
    show(bw, False, 13)
    head_top = L.head_point(you, (0, -0.02, 1.76), 15)
    top = SPOT_A + Vector((0, 0, 2.15))
    fx.column(top, head_top + Vector((0, 0, 0.02)), 12, dur=5, n=70, radius=0.11, seed=71)
    fx.burst(head_top, 15, n=140, speed=(1.2, 3.2), up=(-0.2, 0.5), spread=1.5, size=(0.015, 0.035),
             life=(12, 24), seed=72)
    fx.burst(head_top + Vector((0, 0, -0.3)), 17, n=60, speed=(0.8, 2.0), up=(-0.6, 0.1), spread=1.0,
             size=(0.012, 0.028), life=(10, 20), seed=73)
    fx.crown(SPOT_A + Vector((0, 0, 0.01)), 19, radius=0.55, height=0.22, dur=10, seed=74)
    fx.puddle(0, SPOT_A, [(17, (0.05, 0.05)), (21, (0.7, 0.6)), (n, (0.95, 0.8))])
    you.wet(14, 0.0)
    you.wet(17, 1.0)
    fx.drips(you, 18, n + 1, every=1, seed=75)
    cam = Cam(lens=30)
    c = local_to_world(SPOT_A, yaw, (0.55, -2.5, 1.05))
    t = SPOT_A + Vector((0, 0, 1.75))
    cam.key(1, c, t)
    cam.key(n, local_to_world(SPOT_A, yaw, (0.5, -2.3, 1.05)), t)
    cam.shake(16, dur=8, amp=0.02, rot_amp=1.0, seed=7)


# =========================================================================== S07c
def S07c(sc, you, fr, n):
    """'soaked.' - YOU dripping, deadpan stare at camera."""
    L.hide_char(fr)
    yaw = look_at_yaw(SPOT_A, YOU_BUSH)
    you.place(1, loc=tuple(SPOT_A + rotz((0, 0.05, 0), yaw)), yaw=yaw)
    show("BucketRig", True)
    bucket = bpy.data.objects["Bucket"]
    bucket.rotation_euler = (0, math.radians(165), 0)
    show("BucketWater", False)
    blink = blend_pose(P.SOAKED, P.SOAKED, 0)
    blink["face"] = dict(P.F_DEADPAN, eyeBlinkLeft=1.0, eyeBlinkRight=1.0)
    pose_keys(you, [(1, P.SOAKED), (11, P.SOAKED), (13, blink), (15, P.SOAKED), (n + 2, P.SOAKED)])
    you.wet(1, 1.0)
    fx.drips(you, 1, n + 1, every=1, seed=81)
    fx.puddle(0, SPOT_A, [(1, (0.95, 0.8))])
    eye = L.head_point(you, EYE["YOU"], 1)
    cam = Cam(lens=50)
    c = local_to_world(eye, yaw, (0.0, -1.25, -0.05))
    cam.key(1, c, eye + Vector((0, 0, -0.12)))
    cam.key(n, local_to_world(eye, yaw, (0.0, -1.0, -0.04)), eye + Vector((0, 0, -0.1)))


# =========================================================================== S08
def S08(sc, you, fr, n):
    """'So you strap him to a seat over a tank of water.' - fast build of the dunk tank."""
    tank = show_tank(lever=False, target=False)
    f = 4
    for name in TANK_PARTS_ORDER:
        ob = bpy.data.objects[name]
        if name in ("TankWaterBody", "TankWaterSurface"):
            show(ob, False, 1)
            show(ob, True, 5)
        if name == "TankWaterBody":
            z1, h = ob.location.z, ob.dimensions.z
            key_scale(ob, f - 1, (1, 1, 0.001))
            key_loc(ob, f - 1, (ob.location.x, ob.location.y, 0.12))
            key_scale(ob, f + 7, (1, 1, 1))
            key_loc(ob, f + 7, (ob.location.x, ob.location.y, z1))
            f += 2
            continue
        if name == "TankWaterSurface":
            z1 = ob.location.z          # mesh vertices sit at the water level (origin at tank base)
            key_loc(ob, f - 3, (ob.location.x, ob.location.y, z1 - (WATER_Z - 0.13)))
            key_loc(ob, f + 5, (ob.location.x, ob.location.y, z1))
            f += 6
            continue
        L.pop_in(ob, f, dur=4)
        f += 2
    strap = bpy.data.objects["SeatStrap"]
    # friend dropped onto the seat, then strapped in
    friend_on_seat(fr, 1)
    loc = fr.obj.location.copy()
    fr.place(57, loc=(loc.x, loc.y, loc.z + 1.6))
    fr.place(62, loc=(loc.x, loc.y, loc.z), interp='BOUNCE')
    fr.place(64, loc=(loc.x, loc.y, loc.z))
    show(fr.obj, False, 1)
    show(fr.obj, True, 56)
    for c in fr.obj.children:
        show(c, False, 1)
        show(c, True, 56)
    surprised = blend_pose(P.F_SIT, P.F_SIT, 0)
    surprised["face"] = P.F_SHOCK
    surprised["jaw"] = 8
    look_strap = blend_pose(P.F_SIT, P.F_SIT, 0)
    look_strap["head"] = dict(nod=28, turn=0, tilt=0)
    look_strap["face"] = dict(browInnerUp=0.8, mouthFrownLeft=0.4, mouthFrownRight=0.4)
    pose_keys(fr, [(1, surprised), (62, surprised), (68, P.F_SIT), (72, look_strap), (n + 2, look_strap)])
    show(strap, False, 1)
    show(strap, True, 69)
    L.pop_in(strap, 70, dur=4)
    # YOU zipping around the tank
    T = lambda lx, ly: tuple(tank_local((lx, ly, 0)))
    yt = TANK_YAW
    spots = [(1, T(-2.6, -2.2), yt + 120, P.STAND), (4, T(-1.3, -1.1), yt - 45, P.KNEEL_WORK_A),
             (9, T(-1.25, -0.9), yt - 45, P.KNEEL_WORK_B), (14, T(1.35, -1.0), yt + 45, P.KNEEL_WORK_A),
             (19, T(1.3, -0.9), yt + 45, P.KNEEL_WORK_B), (25, T(0.2, -1.25), yt, P.STAND_WORK),
             (31, T(-0.3, -1.3), yt, P.STAND_WORK), (37, T(1.45, 0.3), yt + 90, P.STAND_WORK),
             (44, T(1.4, 0.9), yt + 120, P.STAND_REACH_UP), (50, T(-1.4, 0.9), yt - 120, P.STAND_REACH_UP),
             (56, T(-1.2, -0.95), yt - 30, P.STAND_REACH_UP), (66, T(-1.1, -0.95), yt - 30, P.STAND_WORK),
             (72, T(-1.5, -1.5), yt - 20, P.PROUD), (n, T(-1.55, -1.55), yt - 20, P.PROUD_B)]
    for f2, loc2, yy, pose in spots:
        you.place(f2, loc=loc2, yaw=yy, interp='LINEAR')
        apply_pose(you, pose)
        you.key(f2)
    cam = Cam(lens=24)
    c = tank_local((-2.2, -5.4, 1.75))
    t = tank_local((0, 0, 1.15))
    cam.key(1, c, t)
    cam.key(n, tank_local((-1.9, -4.9, 1.75)), t)


# =========================================================================== S09
def S09(sc, you, fr, n):
    """'Genius!' - low-angle hero shot of the dunk tank."""
    show_tank()
    L.hide_char(you)
    friend_on_seat(fr, 1)
    proud_sit = blend_pose(P.F_SIT, P.F_SIT, 0)
    proud_sit["face"] = dict(mouthSmileLeft=0.3, mouthSmileRight=0.3, browInnerUp=0.3)
    proud_sit["head"] = dict(nod=-6, turn=0, tilt=0)
    pose_keys(fr, [(1, proud_sit), (n + 2, blend_pose(proud_sit, P.F_SIT, 0.3))])
    ws = bpy.data.objects["TankWaterSurface"]
    fx.ripple(ws, -20, height=0.012, speed=0.04, width=0.5, damp=200)
    cam = Cam(lens=20)
    c0 = tank_local((-1.1, -3.7, 0.45))
    c1 = tank_local((-0.8, -3.3, 0.55))
    cam.key(1, c0, tank_local((0, 0.1, 1.85)))
    cam.key(n, c1, tank_local((0, 0.1, 1.95)))


# =========================================================================== S10
def S10(sc, you, fr, n):
    """'Except he won't fall in,' - smug friend, arms crossed, still dry."""
    show_tank()
    L.hide_char(you)
    friend_on_seat(fr, 1)
    pose_keys(fr, [(1, P.F_SIT_SMUG), (12, P.F_SIT_SMUG_B), (22, P.F_SIT_SMUG), (32, P.F_SIT_SMUG_B),
                   (42, P.F_SIT_SMUG), (n + 2, P.F_SIT_SMUG)])
    cam = Cam(lens=42)
    c = tank_local((0.55, -3.3, 1.95))
    t = tank_local((0, 0.2, 1.75))
    cam.key(1, c, t)
    cam.key(n, tank_local((0.45, -2.9, 1.95)), t)


# =========================================================================== S11a
def S11a(sc, you, fr, n):
    """'so you add a lever that' - lever pops in, YOU yanks it."""
    show_tank(lever=True)
    lever_pop(2)
    friend_on_seat(fr, 1)
    worried = blend_pose(P.F_SIT_SMUG, P.F_SIT, 0.6)
    worried["face"] = P.F_SHOCK
    worried["jaw"] = 7
    pose_keys(fr, [(1, P.F_SIT_SMUG), (18, P.F_SIT_SMUG), (24, worried), (n + 2, worried)])
    pos = tank_local((-1.08, -0.98, 0))
    lever = tank_local((-1.12, -0.40, 0))
    yaw = look_at_yaw(pos, lever) + 12
    you.place(1, loc=tuple(pos), yaw=yaw)
    pose_keys(you, [(1, blend_pose(P.STAND, P.LEVER_REACH, 0.4)), (7, P.LEVER_REACH), (12, P.LEVER_REACH),
                    (17, P.LEVER_PULL, 'BACK'), (n + 2, P.LEVER_PULL)])
    piv = bpy.data.objects["LeverPivot"]
    dt = piv.constraints.new('DAMPED_TRACK')
    dt.target = you.obj
    dt.subtarget = "wrist.R"
    dt.track_axis = 'TRACK_Z'
    dt.influence = 0.0
    dt.keyframe_insert("influence", frame=6)
    dt.influence = 1.0
    dt.keyframe_insert("influence", frame=9)
    cam = Cam(lens=30)
    c = tank_local((-3.0, -1.6, 1.35))
    t = tank_local((-0.9, -0.6, 1.1))
    cam.key(1, c, t)
    cam.key(n, tank_local((-2.75, -1.45, 1.35)), t)


# =========================================================================== S11b
def S11b(sc, you, fr, n):
    """'drops the seat.' - seat drops, BIG SPLASH."""
    show_tank(lever=True)
    pos = tank_local((-1.08, -0.98, 0))
    you.place(1, loc=tuple(pos), yaw=look_at_yaw(pos, tank_local((-1.12, -0.40, 0))) + 12)
    piv = bpy.data.objects["LeverPivot"]
    dt = piv.constraints.new('DAMPED_TRACK')
    dt.target = you.obj
    dt.subtarget = "wrist.R"
    dt.track_axis = 'TRACK_Z'
    pose_keys(you, [(1, P.LEVER_PULL)])
    seat_drop(2, dur=3)
    friend_on_seat(fr, 1, P.F_SIT)
    fall_loc = tank_local((0, 0.05, 0))
    fr.place(2, loc=fr.obj.location.copy())
    fr.place(6, loc=(fall_loc.x, fall_loc.y, 0.30))
    fr.place(9, loc=(fall_loc.x, fall_loc.y, -0.25))
    fr.place(14, loc=(fall_loc.x, fall_loc.y, -0.05))
    fr.place(n, loc=(fall_loc.x, fall_loc.y, 0.0))
    for fcu in fr.obj.animation_data.action.fcurves:
        if fcu.data_path == "location":
            for kp in fcu.keyframe_points:
                if 2 <= kp.co.x <= 6:
                    kp.interpolation = 'QUAD'
                    kp.easing = 'EASE_IN'
    pose_keys(fr, [(1, P.F_SIT), (3, P.F_FALL), (8, P.F_FALL), (12, P.F_IN_WATER), (n + 2, P.F_IN_WATER)])
    fr.wet(5, 0.0)
    fr.wet(7, 1.0)
    cam = Cam(lens=24)
    c = tank_local((-0.5, -4.5, 1.75))
    t = tank_local((0, 0, 1.4))
    cam.key(1, c, t)
    cam.key(n, tank_local((-1.3, -4.1, 1.7)), t)
    big_splash(6, seed=111, scale=1.0, cam=cam)
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(10, (0.05, 0.05)), (18, (0.6, 0.5)), (n, (0.8, 0.65))])


# =========================================================================== S11c
def S11c(sc, you, fr, n):
    """binocular POV of the soaked friend in the tank (payoff)."""
    show_tank(lever=True, strap=False)
    bpy.data.objects["SeatPivot"].rotation_euler = (math.radians(76), 0, 0)
    L.hide_char(you)
    friend_in_water(fr, 1, P.F_IN_WATER, z=0.02)
    sad2 = blend_pose(P.F_IN_WATER, P.F_IN_WATER, 0)
    sad2["head"] = dict(nod=8, turn=-4, tilt=4)
    pose_keys(fr, [(1, P.F_IN_WATER), (10, sad2), (n + 2, sad2)])
    fr.wet(1, 1.0)
    ws = bpy.data.objects["TankWaterSurface"]
    fx.ripple(ws, -12, height=0.03, speed=0.08, width=0.3, damp=60)
    fx.drips(fr, 1, n + 1, every=1, seed=121, meshes=[m for m in fr.meshes if "short02" in m.name or "body" in m.name],
             ground=WATER_Z)
    eye = YOU_BUSH + Vector((0.05, 0.55, 1.52))
    head = L.head_point(fr, EYE["FRIEND"], 1)
    cam = Cam(lens=95)
    cam.key(1, eye, head + Vector((0, 0, -0.18)))
    cam.key(n, eye, head + Vector((0, 0, -0.16)))
    cam.handheld(1, n + 2, seed=12)
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(1, (0.8, 0.65))])


# =========================================================================== S12
def S12(sc, you, fr, n):
    """'But walking over there every time is tiring,' - YOU trudging back and forth, sweating."""
    show_tank(lever=True)
    friend_on_seat(fr, 1, P.F_SIT_SMUG)
    fr.wet(1, 1.0)
    a = YOU_BUSH + Vector((0.6, 1.4, 0))
    lever_front = tank_local((-1.12, -1.02, 0))
    b = a.lerp(lever_front, 0.62)
    L.walk_cycle(you, 1, 27, a, b, stride_frames=9, base_pose=P.TIRED_BASE, arm_swing=10, leg_swing=20, bob=0.04)
    turn = blend_pose(P.TIRED_BASE, P.TIRED_BASE, 0)
    you.place(31, loc=tuple(b), yaw=look_at_yaw(b, a))
    apply_pose(you, turn)
    you.key(31)
    L.walk_cycle(you, 33, n, b, a.lerp(b, 0.15), stride_frames=9, base_pose=P.TIRED_BASE, arm_swing=10,
                 leg_swing=20, bob=0.04)
    fx.sweat(you, 2, n, every=6, seed=12)
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(1, (0.8, 0.65))])
    d = (b - a).normalized()
    perp = Vector((d.y, -d.x, 0))
    cam = Cam(lens=30)
    c = a - d * 2.2 + perp * 1.1 + Vector((0, 0, 1.5))
    for f in (1, 10, 20, 27, 33, 45, 55, n):
        sc.frame_set(f)
        p = you.obj.matrix_world.translation
        cam.key(f, c, Vector((p.x, p.y, 1.15)).lerp(TANK + Vector((0, 0, 1.3)), 0.35))


# =========================================================================== S13a
def S13a(sc, you, fr, n):
    """'so you add a target' - target pops in; YOU throws a baseball from the bush."""
    show_tank(lever=True, target=True)
    target_pop(2)
    friend_on_seat(fr, 1, P.F_SIT_SMUG)
    fr.wet(1, 1.0)
    yaw = you_in_bush(you, look_at=TANK + Vector((1.2, -0.6, 0)))
    pose_keys(you, [(1, P.CROUCH_HOLD), (7, P.CROUCH_HOLD), (12, P.SPRING_UP), (16, P.SPRING_UP),
                    (19, P.THROW_REL), (25, P.THROW_FOLLOW), (n + 2, P.THROW_FOLLOW)])
    ball = bpy.data.objects["Baseball0"]
    show(ball, True)
    con, off = L.attach_rest(ball, you, "wrist.R", (-0.54, -0.27, 0.975), (0, 0, 0), f_off=19)
    tgt = bullseye_world()
    L.release(ball, off, 19, tgt + Vector((0, -0.4, 0.05)) * 1.0, n + 4, apex=0.45, spin=(900, 0, 300))
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(1, (0.8, 0.65))])
    cam = Cam(lens=36)
    head = YOU_BUSH + Vector((0, 0, 1.3))
    c = local_to_world(head, yaw, (-0.55, 1.15, 0.25))
    t = TANK + Vector((0.6, -0.3, 1.2))
    cam.key(1, c, t)
    cam.key(n, local_to_world(head, yaw, (-0.5, 1.0, 0.3)), t)


# =========================================================================== S13b
def S13b(sc, you, fr, n):
    """'and a ball.' - ball hits the bullseye, seat drops, HUGE splash."""
    show_tank(lever=True, target=True)
    L.hide_char(you)
    friend_on_seat(fr, 1, P.F_SIT_SMUG)
    fr.wet(1, 1.0)
    tgt = bullseye_world()
    ball = bpy.data.objects["Baseball0"]
    show(ball, True)
    yaw_dir = rotz((0, -1, 0), TANK_YAW)
    start = tgt + yaw_dir * 1.6 + Vector((-0.6, 0, 0.12))
    L.ballistic(ball, 1, start, tgt + yaw_dir * 0.03, 4, apex=0.02, spin=(300, 0, 100))
    L.ballistic(ball, 4, tgt + yaw_dir * 0.03, tgt + yaw_dir * 0.9 + Vector((0.3, 0, -1.3)), 16, apex=0.35)
    tp = bpy.data.objects["TargetPivot"]
    key_rot(tp, 4, (0, 0, 0))
    key_rot(tp, 6, (-55, 0, 0))
    key_rot(tp, 11, (25, 0, 0))
    key_rot(tp, 16, (-12, 0, 0))
    key_rot(tp, 22, (0, 0, 0))
    seat_drop(6, dur=3)
    fall_loc = tank_local((0, 0.05, 0))
    fr.place(6, loc=fr.obj.location.copy())
    fr.place(10, loc=(fall_loc.x, fall_loc.y, 0.30))
    fr.place(13, loc=(fall_loc.x, fall_loc.y, -0.25))
    fr.place(18, loc=(fall_loc.x, fall_loc.y, -0.05))
    fr.place(n, loc=(fall_loc.x, fall_loc.y, 0.0))
    shocked = blend_pose(P.F_SIT_SMUG, P.F_SIT, 0.5)
    shocked["face"] = P.F_SHOCK
    shocked["jaw"] = 12
    pose_keys(fr, [(1, P.F_SIT_SMUG), (4, P.F_SIT_SMUG), (6, shocked), (8, P.F_FALL), (12, P.F_FALL),
                   (16, P.F_IN_WATER), (n + 2, P.F_IN_WATER)])
    cam = Cam(lens=26)
    c = tank_local((1.9, -4.0, 1.65))
    t = tank_local((0.55, 0, 1.4))
    cam.key(1, c, t)
    cam.key(n, tank_local((1.75, -3.7, 1.6)), t)
    big_splash(10, seed=131, scale=1.25, cam=cam)
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2), (-1.2, 0.3))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(1, (0.8, 0.65) if i < 3 else (0.05, 0.05)), (16, (0.85, 0.7)),
                                                (n, (1.0, 0.85))])


# =========================================================================== S14
def S14(sc, you, fr, n):
    """'You've invented the dunk tank!' - wide finale: soaked friend climbs back, YOU proud with baseballs."""
    show_tank(lever=True, target=True, strap=False)
    fr.wet(1, 1.0)
    you.wet(1, 0.35)
    friend_in_water(fr, 1, P.F_IN_WATER, z=0.0)
    pose_keys(fr, [(1, P.F_IN_WATER), (22, P.F_IN_WATER), (34, P.F_CLIMB), (48, P.F_CLIMB_B), (64, P.F_SIT),
                   (n + 2, blend_pose(P.F_SIT, P.F_SIT, 0))])
    w = tank_local((0, 0.05, 0))
    s_loc = tank_local((0, 0.20, 0))
    fr.place(22, loc=(w.x, w.y, 0.0))
    fr.place(34, loc=(w.x, w.y, 0.55))
    fr.place(48, loc=(s_loc.x, s_loc.y, 1.0))
    fr.place(64, loc=(s_loc.x, s_loc.y, FR_SIT_Z))
    sad_sit = blend_pose(P.F_SIT, P.F_SIT, 0)
    sad_sit["face"] = P.F_SAD
    pose_keys(fr, [(70, sad_sit), (n + 2, sad_sit)])
    fx.drips(fr, 1, n + 1, every=1, seed=141)
    ws = bpy.data.objects["TankWaterSurface"]
    fx.ripple(ws, -6, height=0.04, speed=0.07, width=0.3, damp=80)
    # YOU proud in the foreground with baseballs, tossing one
    pos = tank_local((-1.9, -2.2, 0))
    yaw = look_at_yaw(pos, tank_local((-1.9, -6.0, 0))) + 25
    you.place(1, loc=tuple(pos), yaw=yaw)
    pose_keys(you, [(1, P.PROUD), (30, P.PROUD_B), (60, P.PROUD), (90, P.PROUD_B), (n + 2, P.PROUD)])
    b1 = bpy.data.objects["Baseball1"]
    b2 = bpy.data.objects["Baseball2"]
    show(b1, True)
    show(b2, True)
    L.attach_rest(b1, you, "wrist.R", (-0.54, -0.27, 0.975))
    con, off = L.attach_rest(b2, you, "wrist.L", (0.54, -0.27, 0.975), f_off=40)
    sc.frame_set(39)
    p0 = b2.matrix_world.translation.copy()
    L.release(b2, off, 40, p0 + Vector((0, 0, 0.0)), 58, apex=0.55, spin=(500, 0, 200))
    con.influence = 1.0
    con.keyframe_insert("influence", frame=58)
    b2.location = off[0]
    b2.rotation_euler = off[1]
    b2.keyframe_insert("location", frame=58)
    b2.keyframe_insert("rotation_euler", frame=58)
    rigtools.set_interp(b2, 57, 'CONSTANT')
    for fcu in b2.animation_data.action.fcurves:
        if "influence" in fcu.data_path:
            for kp in fcu.keyframe_points:
                kp.interpolation = 'CONSTANT'
    for i, (lx, ly) in enumerate(((-0.4, -1.3), (0.7, -1.2), (1.4, 0.2), (-1.2, 0.3))):
        fx.puddle(i, tank_local((lx, ly, 0)), [(1, (1.0, 0.85))])
    cam = Cam(lens=24)
    c0 = tank_local((-3.4, -5.6, 1.6))
    c1 = tank_local((-3.0, -5.0, 1.55))
    t = tank_local((-0.4, -0.3, 1.2))
    cam.key(1, c0, t)
    cam.key(n, c1, t)


# =========================================================================== dispatcher
def tweak_materials():
    """runtime look tweaks (so the master file does not need rebuilding)"""
    m = bpy.data.materials.get("WaterFX")
    if m:
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.80, 0.93, 1.0, 1)
        b.inputs["Emission Color"].default_value = (0.75, 0.9, 1.0, 1)
        b.inputs["Emission Strength"].default_value = 0.55
        b.inputs["Transmission Weight"].default_value = 0.15
        for n in m.node_tree.nodes:
            if n.type == 'MATH' and n.operation == 'ADD':
                n.inputs[1].default_value = 0.72


GROUND = {  # characters standing/walking on the asphalt per shot (for the automatic ground lock)
    "S01a": ("YOU", "FRIEND"), "S01b": ("YOU", "FRIEND"), "S02": ("FRIEND",), "S03": ("YOU", "FRIEND"),
    "S04a": ("FRIEND",), "S05": ("YOU", "FRIEND"), "S06": ("FRIEND",), "S07a": ("FRIEND",),
    "S07b": ("YOU",), "S07c": ("YOU",), "S08": ("YOU",), "S11a": ("YOU",), "S11b": ("YOU",), "S12": ("YOU",),
    "S13a": ("YOU",), "S14": ("YOU",),
}


def setup(shot):
    sc, you, fr = L.prep(shot)
    tweak_materials()
    n = L.length(shot)
    globals()[shot](sc, you, fr, n)
    for who in GROUND.get(shot, ()):
        rig = you if who == "YOU" else fr
        if not rig.obj.hide_render and rig.obj.location.z > -10:
            L.ground_lock(rig, 1, n)
    sc.frame_set(1)
    return sc
