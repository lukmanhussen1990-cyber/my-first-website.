"""Per-shot setups for 'You've Invented the Bouncy Castle!' (local frames start at 1)."""
import bpy, math, random
from mathutils import Vector, Matrix, Euler
import rigtools, poses as P, shotlib as L, fx
from rigtools import apply_pose, blend_pose
from shotlib import Cam, pose_keys, show, key_loc, key_rot, key_scale, look_at_yaw

BUSH = Vector((-3.3, -3.6, 0))
YOU_BUSH = Vector((-3.13, -4.62, 0))
C = Vector((0.6, 3.4, 0))              # castle / mattress centre
CY = -25.0                             # castle yaw (front faces the bush)
FENCE_SPOT = Vector((-0.8, 7.05, 0))   # crush scrolling her phone by the back fence
SMALL = (0.55, 0.33, 0.45)             # mattress scale when it is a small air mattress
FLOOR_Z = 0.5                          # top of the full-size mattress / castle floor
POV_EYE = YOU_BUSH + Vector((0.05, 0.55, 1.52))
WALLS = ["WallBack", "WallLeft", "WallRight", "WallFront-1", "WallFront1", "Tower0", "Tower1", "Tower2", "Tower3",
         "CastleArch"]


def rotz(v, deg):
    return Matrix.Rotation(math.radians(deg), 3, 'Z') @ Vector(v)


def local_to_world(base, yaw, local):
    return Vector(base) + rotz(local, yaw)


def cl(x, y, z=0.0):
    """castle-local -> world"""
    return local_to_world(C, CY, (x, y, z))


def eye_rest(rig):
    b = rig.obj.data.bones
    return (b["eye.L"].head_local + b["eye.R"].head_local) / 2


def palm_rest(rig, side="R", out=0.055, down=0.0):
    b = rig.obj.data.bones[f"wrist.{side}"]
    d = (b.tail_local - b.head_local).normalized()
    return b.tail_local + d * out + Vector((0, 0, down))


def binoculars_to_eyes(rig):
    b = bpy.data.objects["Binoculars"]
    show(b, True)
    e = eye_rest(rig)
    L.attach_rest(b, rig, "head", (e.x, e.y - 0.035, e.z - 0.005), (0, 0, 0))
    return b


def binoculars_in_hand(rig):
    b = bpy.data.objects["Binoculars"]
    show(b, True)
    p = palm_rest(rig, "R", out=0.03)
    L.attach_rest(b, rig, "wrist.R", (p.x + 0.04, p.y - 0.02, p.z), (0, 0, 90))
    return b


def phone_in_hand(rig, f_on=None, f_off=None):
    ph = bpy.data.objects["Phone"]
    show(ph, True)
    p = palm_rest(rig, "R", out=0.045)
    return L.attach_rest(ph, rig, "wrist.R", (p.x + 0.015, p.y - 0.03, p.z + 0.01), (-55, 0, -20), f_on=f_on, f_off=f_off)


def mattress():
    return bpy.data.objects["Mattress"]


def flat_mattress(f_show, f_hide=None, scale=1.0):
    """crumpled, deflated vinyl sheet lying on the ground (replaces the popped mattress)"""
    import bmesh
    me = bpy.data.meshes.new("MattressFlat")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=40, y_segments=24, size=0.5)
    rnd = random.Random(7)
    for v in bm.verts:
        x, y = v.co.x * 2.05 * scale, v.co.y * 1.08 * scale
        edge = max(abs(v.co.x) * 2, abs(v.co.y) * 2)
        z = 0.012 + 0.018 * math.sin(x * 9.0 + 1.3) * math.cos(y * 7.0) + 0.012 * math.sin(x * 23 + y * 17)
        z += rnd.uniform(-0.004, 0.004) - 0.01 * edge ** 4
        v.co = (x, y, max(0.002, z))
    bm.to_mesh(me)
    for poly in me.polygons:
        poly.use_smooth = True
    me.materials.append(bpy.data.materials["MattressBlue"])
    ob = bpy.data.objects.new("MattressFlat", me)
    bpy.data.collections["PROPS"].objects.link(ob)
    ob.location = cl(0.0, 0.0, 0.0)
    ob.rotation_euler = (0, 0, math.radians(CY))
    sol = ob.modifiers.new("thick", 'SOLIDIFY')
    sol.thickness = 0.01
    show(ob, False, 1)
    show(ob, True, f_show)
    if f_hide:
        show(ob, False, f_hide)
    return ob


def show_mattress(scale=SMALL):
    show("MattressRoot", True)
    show("MattressValve", False)       # tiny valve does not scale with the mattress -> hide it
    m = mattress()
    m.scale = scale
    return m


def show_castle():
    show("Castle", True)


def hide_castle():
    show("Castle", False)


def squash(ob, f, base, amount=0.12, wob=True):
    """inflatable squash on impact: z down, xy bulge, then springy wobble back"""
    bx, by, bz = base
    key_scale(ob, f - 1, (bx, by, bz))
    key_scale(ob, f + 1, (bx * (1 + amount * 0.4), by * (1 + amount * 0.4), bz * (1 - amount)))
    if wob:
        key_scale(ob, f + 4, (bx * (1 - amount * 0.15), by * (1 - amount * 0.15), bz * (1 + amount * 0.35)))
        key_scale(ob, f + 7, (bx * (1 + amount * 0.05), by * (1 + amount * 0.05), bz * (1 - amount * 0.1)))
    key_scale(ob, f + 10, (bx, by, bz))


def wobble_walls(f, amount=0.03):
    for n in WALLS:
        ob = bpy.data.objects.get(n)
        if ob is None:
            continue
        key_scale(ob, f - 1, 1.0)
        key_scale(ob, f + 2, (1 + amount, 1 + amount, 1 - amount))
        key_scale(ob, f + 5, (1 - amount * 0.5, 1 - amount * 0.5, 1 + amount * 0.5))
        key_scale(ob, f + 9, 1.0)


def inflate_pop(ob, f, dur=7, overshoot=1.12):
    """inflatable rising out of the floor: flat -> overshoot -> wobble -> full"""
    if ob.name == "CastleArch":          # sideways torus: pop uniformly instead of flattening z
        key_scale(ob, f - 1, 0.001)
        key_scale(ob, f + dur // 2, overshoot)
        key_scale(ob, f + dur, 0.97)
        key_scale(ob, f + dur + 3, 1.0)
        return
    key_scale(ob, f - 1, (1, 1, 0.02))
    key_scale(ob, f + dur // 2, (0.96, 0.96, overshoot))
    key_scale(ob, f + dur, (1.03, 1.03, 0.95))
    key_scale(ob, f + dur + 3, (1, 1, 1))


def bounce_seq(rig, f0, f1, loc, yaw, period=16, height=1.1, floor=FLOOR_Z, mat_ob=None, cam=None, first_up=True,
               floor_base=(1, 1, 1)):
    """keyframes happy bouncing on the castle floor between f0 and f1"""
    f = f0
    up = first_up
    rig.place(f0, loc=(loc.x, loc.y, floor + (height if not first_up else 0.0)), yaw=yaw)
    while f <= f1:
        land = f
        apply_pose(rig, P.C_BOUNCE_LAND)
        rig.key(land)
        rig.place(land, loc=(loc.x, loc.y, floor - 0.05))
        rigtools.set_interp(rig.obj, land, 'QUAD')
        if mat_ob is not None:
            squash(mat_ob, land, floor_base, amount=0.10)
        apex = land + period // 2
        if apex <= f1 + period:
            apply_pose(rig, P.C_BOUNCE_UP)
            rig.key(apex)
            rig.place(apex, loc=(loc.x, loc.y, floor + height))
        f += period
    # ease: apex slow, landing sharp
    act = rig.obj.animation_data.action
    for fc in act.fcurves:
        if fc.data_path == "location" and fc.array_index == 2:
            for kp in fc.keyframe_points:
                if f0 <= kp.co.x <= f1 + period:
                    is_land = abs(kp.co.y - (floor - 0.05)) < 1e-3
                    kp.interpolation = 'BEZIER'
                    kp.handle_left_type = kp.handle_right_type = 'VECTOR' if is_land else 'AUTO_CLAMPED'
            fc.update()


def zip_around(you, spots, clear=2.95):
    """YOU zips smoothly between work spots along the outside of the castle (polar path, never through walls)."""
    pts = []
    for f, loc, yy, pose in spots:
        lw = rotz(Vector(loc) - C, -CY)          # world -> castle local
        pts.append((f, lw.x, lw.y, yy, pose))
    prev_xy = None
    for i, (f, x, y, yy, pose) in enumerate(pts):
        if i > 0:
            f0, x0, y0, yy0, pose0 = pts[i - 1]
            a0, a1 = math.atan2(y0, x0), math.atan2(y, x)
            da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            r0, r1 = math.hypot(x0, y0), math.hypot(x, y)
            last = None
            for k in range(1, f - f0):
                t = k / (f - f0)
                te = t * t * (3 - 2 * t)
                a = a0 + da * te
                r_lin = r0 + (r1 - r0) * te
                r = r_lin + max(0.0, clear - r_lin) * math.sin(math.pi * t)
                px, py = r * math.cos(a), r * math.sin(a)
                wloc = cl(px, py)
                if last is not None:
                    yaw = look_at_yaw(last, wloc)
                else:
                    nxt = cl((r + 0.01) * math.cos(a + 0.05 * math.copysign(1, da)),
                             (r + 0.01) * math.sin(a + 0.05 * math.copysign(1, da)))
                    yaw = look_at_yaw(wloc, nxt)
                you.place(f0 + k, loc=tuple(wloc), yaw=yaw, interp='LINEAR')
                apply_pose(you, P.WALK_A if (k % 2 == 0) else blend_pose(P.WALK_A, P.STAND, 0.6))
                you.key(f0 + k)
                last = wloc
        you.place(f, loc=tuple(cl(x, y)), yaw=yy, interp='LINEAR')
        apply_pose(you, pose)
        you.key(f)
    # unwrap yaw so rotations take the short way
    fc = next((c for c in you.obj.animation_data.action.fcurves
               if c.data_path == "rotation_euler" and c.array_index == 2), None)
    if fc:
        prev = None
        for kp in fc.keyframe_points:
            if prev is not None:
                while kp.co.y - prev > math.pi:
                    kp.co.y -= 2 * math.pi
                while kp.co.y - prev < -math.pi:
                    kp.co.y += 2 * math.pi
            prev = kp.co.y
        fc.update()


def phone_loop(rig, f0, f1, a=P.C_PHONE, b=P.C_PHONE_B, period=14):
    f = f0
    i = 0
    while f <= f1:
        apply_pose(rig, a if i % 2 == 0 else b)
        rig.key(f)
        f += period // 2
        i += 1


def crush_at_fence(cr):
    cr.place(1, loc=tuple(FENCE_SPOT), yaw=180.0)


def you_in_bush(you, look_at):
    yaw = look_at_yaw(YOU_BUSH, look_at)
    you.place(1, loc=tuple(YOU_BUSH), yaw=yaw)
    return yaw


def breathing(rig, f0, f1, a, b, period=16):
    f = f0
    i = 0
    while f <= f1:
        apply_pose(rig, a if i % 2 == 0 else b)
        rig.key(f)
        f += period // 2
        i += 1


# =========================================================================== shots
def S01a(sc, you, cr, n):
    """'You LOVE your crush's' - over-the-shoulder behind YOU in the bush, crush by the fence."""
    crush_at_fence(cr)
    phone_loop(cr, 1, n + 2)
    phone_in_hand(cr)
    yaw = you_in_bush(you, FENCE_SPOT)
    breathing(you, 1, n + 2, P.CROUCH_BINOC, P.CROUCH_BINOC_B, period=20)
    binoculars_to_eyes(you)
    head = L.head_point(you, eye_rest(you), 1)
    cam = Cam(lens=38)
    c0 = local_to_world(head, yaw, (-0.30, 0.80, 0.22))
    tgt = local_to_world(FENCE_SPOT + Vector((0, 0, 0.6)), yaw, (1.4, 0, 0))
    cam.key(1, c0, tgt)
    cam.key(n, local_to_world(head, yaw, (-0.27, 0.72, 0.21)), tgt)


def S01b(sc, you, cr, n):
    """'fat ass,' - binocular POV of her from behind by the fence (medium-wide)."""
    crush_at_fence(cr)
    phone_loop(cr, 1, n + 2)
    phone_in_hand(cr)
    L.hide_char(you)
    cam = Cam(lens=175)
    t = FENCE_SPOT + Vector((0, 0, 1.0))
    cam.key(1, POV_EYE, t)
    cam.key(n, POV_EYE, t + Vector((0, 0, -0.03)))
    cam.handheld(1, n + 2, seed=2)


def S02(sc, you, cr, n):
    """'but you never get to see it bounce!' - binocular POV: she stands perfectly still, scrolling."""
    crush_at_fence(cr)
    phone_loop(cr, 1, n + 2, period=12)
    phone_in_hand(cr)
    L.hide_char(you)
    cam = Cam(lens=230)
    t = FENCE_SPOT + Vector((0, 0, 1.12))
    cam.key(1, POV_EYE, t)
    cam.key(n // 2, POV_EYE, t + Vector((0.05, 0, -0.1)))
    cam.key(n, POV_EYE, t + Vector((0, 0, 0.02)))
    cam.handheld(1, n + 2, seed=3)


def S03(sc, you, cr, n):
    """'So you blow up an air mattress.' - YOU pumps the foot pump super fast, mattress inflates."""
    L.hide_char(cr)
    m = show_mattress((SMALL[0], SMALL[1], 0.02))
    key_scale(m, 1, (SMALL[0], SMALL[1], 0.02))
    for k, f in enumerate(range(6, 50, 4)):
        s = 0.02 + (SMALL[2] - 0.02) * min(1.0, (f - 4) / 44)
        key_scale(m, f, (SMALL[0] * (1 + 0.02 * (k % 2)), SMALL[1], s))
    key_scale(m, 52, (SMALL[0] * 1.03, SMALL[1] * 1.03, SMALL[2] * 1.08))
    key_scale(m, 56, (SMALL[0], SMALL[1], SMALL[2] * 0.96))
    key_scale(m, 60, SMALL)
    pos = cl(2.05, -0.75)
    yaw = look_at_yaw(pos, cl(0.0, -0.75)) + 8
    you.place(1, loc=tuple(pos), yaw=yaw)
    pump = bpy.data.objects["FootPump"]
    show(pump, True)
    ploc = local_to_world(pos, yaw, (-0.14, -0.32, 0))
    pump.location = ploc
    pump.rotation_euler = (0, 0, math.radians(yaw))
    bell = bpy.data.objects["PumpBellowsPivot"]
    # super fast pumping: one stroke every 2 frames
    for i, f in enumerate(range(1, n + 4, 3)):
        down = i % 2 == 0
        apply_pose(you, P.PUMP_DOWN if down else P.PUMP_UP)
        you.key(f)
        key_scale(bell, f, (1, 1, 0.55 if down else 1.0))
    valve = cl(SMALL[0] * 1.8 + 0.02, (-1.5 + 0.35) * SMALL[1], 0.12)
    hose = bpy.data.objects.get("PumpHoseShot")
    from propbuild import build_hose
    build_hose(bpy.data.collections["PROPS"], "PumpHoseShot",
               [ploc + rotz((0, 0.1, 0.12), yaw), (ploc + valve) / 2 + Vector((0, 0, 0.05)), valve], 0.012, "#222222")
    cam = Cam(lens=26)
    c = cl(0.75, -3.4, 1.75)
    t = cl(1.15, -0.55, 0.45)
    cam.key(1, c, t)
    cam.key(n, cl(0.8, -3.15, 1.7), t)


def S04a(sc, you, cr, n):
    """'Except it pops' - she steps onto the mattress and sits down on top of it, it squishes."""
    L.hide_char(you)
    m = show_mattress(SMALL)
    top = SMALL[2] * FLOOR_Z
    seat = cl(0.0, 0.30)              # near the back so her legs lie on top of the mattress
    cr.place(1, loc=(seat.x, seat.y, top), yaw=CY)
    cr.place(5, loc=(seat.x, seat.y, top))
    cr.place(13, loc=(seat.x, seat.y, top + 0.06))
    phone_in_hand(cr)
    pose_keys(cr, [(1, P.C_PHONE), (5, P.C_PHONE), (9, blend_pose(P.C_PHONE, P.C_SIT_PHONE, 0.6)),
                   (13, P.C_SIT_PHONE), (16, P.C_SIT_SQUISH), (n + 2, P.C_SIT_SQUISH)])
    squash(m, 13, SMALL, amount=0.18)
    # feet stay on the mattress top while she sits down
    L.ground_lock(cr, 1, 11, ground=top - 0.02)
    cam = Cam(lens=30)
    c = cl(-1.4, -3.2, 1.25)
    t = cl(0.0, 0.0, 0.55)
    cam.key(1, c, t)
    cam.key(n, cl(-1.3, -3.0, 1.2), t)


def S04b(sc, you, cr, n):
    """'under her weight.' - BANG! mattress pops flat, she lands on the ground, shocked."""
    L.hide_char(you)
    m = show_mattress(SMALL)
    top = SMALL[2] * FLOOR_Z
    seat = cl(0.0, 0.30)
    cr.place(1, loc=(seat.x, seat.y, top + 0.04), yaw=CY)
    cr.place(2, loc=(seat.x, seat.y, top + 0.04))
    cr.place(5, loc=(seat.x, seat.y, 0.06))
    rigtools.set_interp(cr.obj, 2, 'QUAD')
    phone_in_hand(cr)
    pose_keys(cr, [(1, P.C_SIT_SQUISH), (3, P.C_SIT_SQUISH), (6, P.C_SHOCK_GROUND), (n + 2, P.C_SHOCK_GROUND)])
    key_scale(m, 1, (SMALL[0], SMALL[1], SMALL[2] * 0.82))
    key_scale(m, 2, (SMALL[0] * 1.08, SMALL[1] * 1.08, SMALL[2] * 0.6))
    key_scale(m, 3, (SMALL[0] * 1.06, SMALL[1] * 1.04, 0.05))
    show(m, True, 1)
    show(m, False, 4)
    flat_mattress(4)
    fx.burst(cl(0.0, 0.3, 0.12), 2, n=14, speed=(1.0, 2.2), up=(0.2, 0.6), spread=1.4, size=(0.03, 0.07),
             life=(5, 9), seed=41, stretch=0.0)
    st = bpy.data.objects["ImpactStar"]
    show(st, True)
    st.location = cl(0.2, -0.75, 0.35)
    st.rotation_euler = (0, 0, math.radians(CY))
    key_scale(st, 1, 0.001)
    key_scale(st, 3, 0.45)
    key_scale(st, 6, 0.3)
    key_scale(st, 8, 0.001)
    cam = Cam(lens=28)
    c = cl(-1.5, -3.4, 1.05)
    t = cl(0.0, -0.3, 0.45)
    cam.key(1, c, t)
    cam.key(n, cl(-1.35, -3.1, 1.0), t)
    cam.shake(2, dur=10, amp=0.04, rot_amp=1.8, seed=5)


def S05(sc, you, cr, n):
    """'So you add a big air pump.' - YOU drags in the blower, the mattress inflates HUGE."""
    m = show_mattress((SMALL[0] * 1.04, SMALL[1] * 1.02, 0.05))
    flat_mattress(1, f_hide=35)
    show(m, False, 1)
    show(m, True, 35)
    seat = cl(0.0, 0.30)
    cr.place(1, loc=(seat.x, seat.y, 0.06), yaw=CY)
    phone_in_hand(cr)
    key_scale(m, 34, (SMALL[0] * 1.04, SMALL[1] * 1.02, 0.05))
    key_scale(m, 44, (0.75, 0.62, 0.55))
    key_scale(m, 52, (1.06, 1.05, 1.12))
    key_scale(m, 56, (0.98, 0.98, 0.95))
    key_scale(m, 60, (1, 1, 1))
    cr.place(33, loc=(seat.x, seat.y, 0.0))
    cr.place(44, loc=(seat.x, seat.y, 0.55 * FLOOR_Z + 0.06))
    cr.place(52, loc=(seat.x, seat.y, 1.12 * FLOOR_Z + 0.06))
    cr.place(56, loc=(seat.x, seat.y, 0.95 * FLOOR_Z + 0.06))
    cr.place(60, loc=(seat.x, seat.y, FLOOR_Z + 0.06))
    pose_keys(cr, [(1, P.C_SHOCK_GROUND), (34, P.C_SHOCK_GROUND), (42, P.C_RIDE_UP), (n + 2, P.C_RIDE_UP)])
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    byaw = CY + 180
    b_end = cl(2.85, -0.5)
    b_start = cl(5.6, -1.6)
    key_loc(bl, 1, b_start)
    key_loc(bl, 28, b_end)
    key_rot(bl, 1, (0, 0, byaw))
    key_rot(bl, 28, (0, 0, byaw))
    fan = bpy.data.objects["BlowerFan"]
    key_rot(fan, 31, (0, 0, 0))
    key_rot(fan, n, (360 * 10, 0, 0), 'LINEAR')
    for f in range(32, n + 1, 2):
        key_loc(bl, f, b_end + Vector((0, 0, 0.006 * (1 if f % 4 == 0 else -1))))
    # YOU walks backwards dragging it by the handle
    d = (b_end - b_start).normalized()
    y_start = b_start + d * 0.75
    y_end = b_end + d * 0.75
    L.walk_cycle(you, 1, 28, y_start, y_end, stride_frames=8, base_pose=P.DRAG_BASE, arm_swing=-4, leg_swing=-20)
    you.place(1, yaw=look_at_yaw(y_start, b_start))
    you.place(28, yaw=look_at_yaw(y_end, b_end))
    pose_keys(you, [(34, P.PROUD), (n + 2, P.PROUD_B)])
    you.place(34, loc=tuple(y_end + rotz((0.3, 0.3, 0), CY)), yaw=look_at_yaw(y_end, cl(0, 0)))
    # thick hose pops in once the blower is in place
    from propbuild import build_hose
    out = local_to_world(b_end, byaw, (0.45, 0, 0.42))
    inlet = cl(1.75, -0.3, 0.25)
    hose = build_hose(bpy.data.collections["PROPS"], "BlowerHoseShot",
                      [out, (out + inlet) / 2 + Vector((0, 0, -0.15)), inlet], 0.09, "#d8312c")
    show(hose, False, 1)
    show(hose, True, 30)
    cam = Cam(lens=26)
    c = cl(2.7, -5.7, 1.65)
    t = cl(1.35, -0.1, 0.65)
    cam.key(1, c, t)
    cam.key(n, cl(2.5, -5.3, 1.6), t)


def S06(sc, you, cr, n):
    """'Clever!' - binocular POV of her on the big mattress."""
    L.hide_char(you)
    show_mattress((1, 1, 1))
    seat = cl(0.0, 0.30)
    cr.place(1, loc=(seat.x, seat.y, FLOOR_Z + 0.06), yaw=CY)
    phone_in_hand(cr)
    phone_loop(cr, 1, n + 2, a=P.C_SIT_PHONE, b=blend_pose(P.C_SIT_PHONE, P.C_SIT_SQUISH, 0.3), period=12)
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    cam = Cam(lens=120)
    t = cl(0.0, 0.30, FLOOR_Z + 0.78)
    cam.key(1, POV_EYE, t)
    cam.key(n, POV_EYE, t + Vector((0, 0, 0.03)))
    cam.handheld(1, n + 2, seed=6)


def S07a(sc, you, cr, n):
    """'But now she bounces so high,' - two bounces then LAUNCH."""
    L.hide_char(you)
    m = show_mattress((1, 1, 1))
    seat = cl(0.0, 0.30)
    z0 = FLOOR_Z + 0.06
    phone_in_hand(cr)
    cr.place(1, loc=(seat.x, seat.y, z0), yaw=CY)
    keys = [(1, z0), (4, z0 + 0.35), (7, z0), (12, z0 + 0.8), (17, z0), (n, z0 + 4.5)]
    for f, z in keys:
        cr.place(f, loc=(seat.x, seat.y, z))
    pose_keys(cr, [(1, P.C_SIT_PHONE), (4, P.C_RIDE_UP), (7, P.C_SIT_SQUISH), (12, P.C_FLY_A), (17, P.C_RIDE_UP),
                   (21, P.C_FLY_A), (n + 2, P.C_FLY_B)])
    for f in (7, 17):
        squash(m, f, (1, 1, 1), amount=0.16)
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    cam = Cam(lens=22)
    c = cl(0.7, -4.3, 0.55)
    cam.key(1, c, cl(0.0, 0.0, 1.2))
    cam.key(17, c, cl(0.0, 0.0, 1.4))
    cam.key(n, c, cl(0.0, -0.1, 3.4))


def S07b(sc, you, cr, n):
    """'so high,' - flying shot: she tumbles across the sky (like the reference)."""
    L.hide_char(you)
    show_mattress((1, 1, 1))
    phone_in_hand(cr)
    p0 = cl(-0.2, 0.3, 4.2)
    p1 = cl(-1.2, 3.6, 7.0)
    cr.place(1, loc=tuple(p0), yaw=CY)
    cr.place(n, loc=tuple(p1), yaw=CY)
    rigtools.set_interp(cr.obj, 1, 'LINEAR')
    key_rot(cr.obj, 1, (0, 0, CY))
    key_rot(cr.obj, n, (300, 40, CY + 60), 'LINEAR')
    pose_keys(cr, [(1, P.C_FLY_A), (9, P.C_FLY_B), (17, P.C_FLY_A), (n + 2, P.C_FLY_B)])
    cam = Cam(lens=20)
    c = cl(0.6, -1.6, 0.9)
    cam.key(1, c, cl(-0.4, 1.4, 5.0))
    cam.key(n, c, cl(-0.9, 2.4, 6.0))


def S08a(sc, you, cr, n):
    """'she flies right into the fence.' - SMACK into the fence, shake, slide down."""
    L.hide_char(you)
    show_mattress((1, 1, 1))
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    phone_in_hand(cr)
    hit = Vector((0.35, 9.0, 0.32))
    start = cl(-0.6, 1.0, 6.5)
    imp = 35
    cr.place(1, loc=tuple(start), yaw=180)
    key_rot(cr.obj, 1, (-140, 30, 150))
    for i in range(1, imp + 1, 2):
        t = (i - 1) / (imp - 1)
        p = start.lerp(hit, t) + Vector((0, 0, 2.2 * 4 * t * (1 - t) * 0.6))
        cr.place(i, loc=tuple(p))
        rigtools.set_interp(cr.obj, i, 'LINEAR')
    cr.place(imp, loc=tuple(hit))
    key_rot(cr.obj, imp - 1, (-20, 10, 185))
    key_rot(cr.obj, imp, (0, 0, 180))
    # slide down the fence
    cr.place(imp + 3, loc=tuple(hit + Vector((0, -0.02, -0.08))))
    cr.place(n, loc=(hit.x, hit.y - 0.04, 0.0))
    pose_keys(cr, [(1, P.C_FLY_A), (10, P.C_FLY_B), (20, P.C_FLY_A), (30, P.C_FLY_B), (imp - 1, P.C_FLY_A),
                   (imp, P.C_SPLAT), (imp + 4, P.C_SPLAT), (n, P.C_SLIDE)])
    fb = bpy.data.objects.get("FenceBack_boards")
    if fb:
        r0 = fb.rotation_euler.copy()
        for f, a in ((imp - 1, 0), (imp + 1, 2.5), (imp + 3, -1.6), (imp + 5, 0.8), (imp + 8, 0)):
            fb.rotation_euler = (r0.x + math.radians(a), r0.y, r0.z)
            fb.keyframe_insert("rotation_euler", frame=f)
    st = bpy.data.objects["ImpactStar"]
    show(st, True)
    st.location = hit + Vector((0.25, -0.25, 0.55))
    key_scale(st, imp - 1, 0.001)
    key_scale(st, imp + 1, 0.6)
    key_scale(st, imp + 4, 0.45)
    key_scale(st, imp + 6, 0.001)
    cam = Cam(lens=22)
    c = Vector((2.4, 3.4, 1.5))
    # follow her flight in, end framed on the fence impact
    for f in (1, 8, 16, 24, 30):
        sc.frame_set(f)
        p = cr.obj.matrix_world.translation + Vector((0, 0, 0.9))
        cam.key(f, c, p.lerp(Vector((0.3, 8.9, 1.6)), 0.25))
    cam.key(imp, c, Vector((0.3, 8.9, 1.35)))
    cam.key(n, c, Vector((0.3, 8.9, 1.15)))
    cam.shake(imp, dur=12, amp=0.06, rot_amp=2.4, seed=8)


def S08b(sc, you, cr, n):
    """YOU wincing behind the bush."""
    L.hide_char(cr)
    yaw = you_in_bush(you, Vector((0.35, 9.0, 0)))
    pose_keys(you, [(1, P.WINCE), (n + 2, P.WINCE)])
    binoculars_in_hand(you)
    eye = L.head_point(you, eye_rest(you), 1)
    cam = Cam(lens=40)
    c = local_to_world(eye, yaw, (-0.80, -0.70, 0.22))
    cam.key(1, c, eye + Vector((0, 0, -0.10)))
    cam.key(n, local_to_world(eye, yaw, (-0.72, -0.62, 0.20)), eye + Vector((0, 0, -0.10)))


def S09(sc, you, cr, n):
    """'So you add walls all around.' - fast build: inflatable walls + towers pop up."""
    L.hide_char(cr)
    show_mattress((1, 1, 1))
    show_castle()
    order = [("WallBack", 6), ("WallLeft", 12), ("WallRight", 17), ("WallFront-1", 22), ("WallFront1", 26),
             ("Tower0", 31), ("Tower1", 35), ("Tower2", 39), ("Tower3", 43), ("CastleArch", 48)]
    for name, f in order:
        ob = bpy.data.objects.get(name)
        if ob:
            inflate_pop(ob, f, dur=7)
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    fan = bpy.data.objects["BlowerFan"]
    key_rot(fan, 1, (0, 0, 0))
    key_rot(fan, n, (360 * 12, 0, 0), 'LINEAR')
    W = lambda x, y: tuple(cl(x, y))
    spots = [(1, W(-2.6, -2.8), CY - 140, P.STAND), (5, W(0.4, 2.55), CY + 180, P.STAND_WORK),
             (11, W(-2.7, 0.3), CY + 90, P.STAND_WORK), (16, W(2.7, 0.4), CY - 90, P.STAND_WORK),
             (21, W(-1.1, -2.35), CY, P.KNEEL_WORK_A), (25, W(1.1, -2.35), CY, P.KNEEL_WORK_B),
             (30, W(-2.6, -2.4), CY + 45, P.STAND_REACH_UP), (34, W(2.6, -2.4), CY - 45, P.STAND_REACH_UP),
             (38, W(-2.6, 2.35), CY + 135, P.STAND_REACH_UP), (42, W(2.6, 2.35), CY - 135, P.STAND_REACH_UP),
             (47, W(0.0, -2.3), CY, P.STAND_WORK), (54, W(-1.4, -3.1), CY - 20, P.PROUD), (n, W(-1.5, -3.2), CY - 20,
                                                                                             P.PROUD_B)]
    zip_around(you, spots, clear=3.65)
    cam = Cam(lens=22)
    c = cl(-3.4, -7.6, 2.3)
    t = cl(0.0, 0.0, 1.0)
    cam.key(1, c, t)
    cam.key(n, cl(-3.0, -6.9, 2.2), t)


def S10(sc, you, cr, n):
    """'Genius!' - low-angle hero shot of the bouncy castle."""
    L.hide_char(cr)
    L.hide_char(you)
    show_mattress((1, 1, 1))
    show_castle()
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    cam = Cam(lens=18)
    cam.key(1, cl(-1.2, -4.9, 0.32), cl(0.0, 0.0, 1.7))
    cam.key(n, cl(-0.9, -4.4, 0.42), cl(0.0, 0.0, 1.85))


def S11(sc, you, cr, n):
    """'Except she still won't jump,' - she sits inside, arms crossed, on her phone."""
    L.hide_char(you)
    show_mattress((1, 1, 1))
    show_castle()
    seat = cl(0.0, 0.25)
    cr.place(1, loc=(seat.x, seat.y, FLOOR_Z + 0.06), yaw=CY)
    phone_in_hand(cr)
    pose_keys(cr, [(1, P.C_SIT_ARMS), (16, P.C_SIT_ARMS), (24, P.C_SIT_CROSS), (40, P.C_SIT_CROSS),
                   (48, P.C_SIT_ARMS), (n + 2, P.C_SIT_ARMS)])
    cam = Cam(lens=42)
    c = cl(0.25, -3.7, 1.35)
    t = cl(0.0, 0.2, 0.95)
    cam.key(1, c, t)
    cam.key(n, cl(0.2, -3.3, 1.3), t)


def S12a(sc, you, cr, n):
    """'so you hide her phone' - YOU sneaks in and snatches her phone."""
    show_mattress((1, 1, 1))
    show_castle()
    seat = cl(0.0, 0.25)
    cr.place(1, loc=(seat.x, seat.y, FLOOR_Z + 0.06), yaw=CY)
    pose_keys(cr, [(1, P.C_SIT_CROSS), (20, P.C_SIT_CROSS), (23, P.C_GRABBED), (n + 2, P.C_GRABBED)])
    con_c, off_c = phone_in_hand(cr, f_off=22)
    ph = bpy.data.objects["Phone"]
    # second attachment: YOU's right hand from frame 22
    p = palm_rest(you, "R", out=0.045)
    con_y = ph.constraints.new('CHILD_OF')
    con_y.target = you.obj
    con_y.subtarget = "wrist.R"
    con_y.inverse_matrix = Matrix.Identity(4)
    con_y.influence = 0.0
    con_y.keyframe_insert("influence", frame=21)
    con_y.influence = 1.0
    con_y.keyframe_insert("influence", frame=22)
    for fc in ph.animation_data.action.fcurves:
        if "influence" in fc.data_path:
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'
    # same local offset works for both hands (bone space) - key it for clarity
    ph.location = off_c[0]
    ph.rotation_euler = off_c[1]
    ph.keyframe_insert("location", frame=1)
    ph.keyframe_insert("rotation_euler", frame=1)
    p0 = cl(0.88, -1.0)
    p1 = cl(0.88, 0.14)
    yaw = look_at_yaw(p1, seat) + 10
    you.place(1, loc=(p0.x, p0.y, FLOOR_Z + 0.06), yaw=look_at_yaw(p0, seat))
    you.place(18, loc=(p1.x, p1.y, FLOOR_Z + 0.06), yaw=yaw)
    rigtools.set_interp(you.obj, 1, 'LINEAR')
    pose_keys(you, [(1, P.SNEAK_A), (5, P.SNEAK_B), (9, P.SNEAK_A), (13, P.SNEAK_B), (18, P.SNEAK_A),
                    (21, P.GRAB), (24, blend_pose(P.GRAB, P.SNEAK_B, 0.5)), (n + 2, blend_pose(P.GRAB, P.SNEAK_B, 0.6))])
    cam = Cam(lens=26)
    c = cl(0.15, -2.35, 1.5)
    t = cl(0.45, 0.15, 0.95)
    cam.key(1, c, t)
    cam.key(n, cl(0.15, -2.15, 1.48), t)


def S12b(sc, you, cr, n):
    """'in the middle.' - YOU tosses the phone into the middle; she leaps for it and starts bouncing."""
    m = show_mattress((1, 1, 1))
    show_castle()
    seat = cl(0.0, 0.25)
    p1 = cl(0.88, 0.14)
    you.place(1, loc=(p1.x, p1.y, FLOOR_Z + 0.06), yaw=look_at_yaw(p1, seat) + 10)
    pose_keys(you, [(1, blend_pose(P.GRAB, P.SNEAK_B, 0.6)), (3, P.SPRING_UP), (6, P.THROW_REL), (12, P.THROW_FOLLOW),
                    (n + 2, P.PROUD)])
    ph = bpy.data.objects["Phone"]
    show(ph, True)
    con, off = L.attach_rest(ph, you, "wrist.R", tuple(palm_rest(you, "R", out=0.045) + Vector((0.015, -0.03, 0.01))),
                             (-55, 0, -20), f_off=7)
    mid = cl(-0.42, -0.62, FLOOR_Z + 0.01)
    L.release(ph, off, 7, mid, 15, apex=0.9, spin=(720, 200, 0))
    for f, z in ((15, 0.0), (18, 0.12), (21, 0.0), (23, 0.04), (25, 0.0)):
        key_loc(ph, f, mid + Vector((0, 0, z)))
    key_rot(ph, 25, (90, 0, CY))
    # she dives for it, lands, and starts bouncing
    cr.place(1, loc=(seat.x, seat.y, FLOOR_Z + 0.06), yaw=CY)
    cr.place(8, loc=(seat.x, seat.y, FLOOR_Z + 0.06))
    land = cl(-0.42, -0.5)
    cr.place(13, loc=(land.x * 0.5 + seat.x * 0.5, land.y * 0.5 + seat.y * 0.5, FLOOR_Z + 0.55))
    cr.place(17, loc=(land.x, land.y, FLOOR_Z))
    pose_keys(cr, [(1, P.C_GRABBED), (8, P.C_GRABBED), (11, P.C_LEAP), (16, P.C_LEAP)])
    squash(m, 17, (1, 1, 1), amount=0.14)
    wobble_walls(17)
    bounce_seq(cr, 17, n + 4, land, CY, period=14, height=0.95, floor=FLOOR_Z, mat_ob=None)
    key_rot(cr.obj, 18, (0, 0, CY))
    key_rot(cr.obj, 30, (0, 0, CY + 180))
    cam = Cam(lens=24)
    c = cl(0.9, -4.3, 3.1)
    t = cl(0.0, -0.25, 0.9)
    cam.key(1, c, t)
    cam.key(n, cl(0.85, -4.0, 3.0), t)
    cam.shake(17, dur=6, amp=0.015, rot_amp=0.6, seed=9)


def S13a(sc, you, cr, n):
    """'You've invented the bouncy castle!' - wide finale: she bounces happily, YOU proudly watches."""
    m = show_mattress((1, 1, 1))
    show_castle()
    spot = cl(0.0, -0.2)
    away = look_at_yaw(spot, cl(-2.5, -3.9)) + 180.0
    bounce_seq(cr, 1, n + 4, spot, away, period=15, height=1.15, floor=FLOOR_Z, mat_ob=m, first_up=False)
    for f in range(1, n + 4, 15):
        wobble_walls(f, amount=0.02)
    ph = bpy.data.objects["Phone"]
    show(ph, True)
    phone_in_hand(cr)
    pos = cl(-2.5, -3.9)
    yaw = look_at_yaw(pos, cl(0, 0)) + 5
    you.place(1, loc=tuple(pos), yaw=yaw)
    breathing(you, 1, n + 2, P.WATCH_BINOC, P.WATCH_BINOC_B, period=20)
    binoculars_to_eyes(you)
    bl = bpy.data.objects["Blower"]
    show(bl, True)
    bl.location = cl(2.85, -0.5)
    bl.rotation_euler = (0, 0, math.radians(CY + 180))
    cam = Cam(lens=24)
    c = local_to_world(pos, yaw, (-1.2, 2.6, 1.6))
    t = cl(0.0, 0.0, 1.5)
    cam.key(1, c, t)
    cam.key(n, local_to_world(pos, yaw, (-1.1, 2.3, 1.6)), t)


def S13b(sc, you, cr, n):
    """'castle!' - binocular POV of her bouncing happily (end)."""
    L.hide_char(you)
    m = show_mattress((1, 1, 1))
    show_castle()
    spot = cl(0.0, -0.2)
    eye = cl(-2.2, -4.3, 1.75)
    away = look_at_yaw(spot, eye) + 180.0
    bounce_seq(cr, 1, n + 4, spot, away, period=15, height=1.15, floor=FLOOR_Z, mat_ob=m, first_up=False)
    phone_in_hand(cr)
    cam = Cam(lens=55)
    t = cl(0.0, -0.2, 2.15)
    cam.key(1, eye, t)
    cam.key(n, eye, t + Vector((0, 0, 0.05)))
    cam.handheld(1, n + 2, seed=13)


# =========================================================================== dispatcher
GROUND = {"S01a": ("CRUSH",), "S01b": ("CRUSH",), "S02": ("CRUSH",), "S03": ("YOU",), "S05": ("YOU",),
          "S09": ("YOU",), "S13a": ("YOU",)}


FLOOR_LOCK = {"S12a": ("YOU",), "S12b": ("YOU",)}
# frames where the crush sits on the mattress / castle floor -> rest her on the surface
SEAT_LOCK = {"S04a": (13, 23), "S04b": (1, 1), "S05": (35, 64), "S06": (1, 21), "S11": (1, 60), "S12a": (1, 29),
             "S12b": (1, 8)}


def setup(shot):
    sc, you, cr = L.prep(shot)
    n = L.length(shot)
    globals()[shot](sc, you, cr, n)
    for who in GROUND.get(shot, ()):
        rig = you if who == "YOU" else cr
        if not rig.obj.hide_render and rig.obj.location.z > -10:
            L.ground_lock(rig, 1, n)
    for who in FLOOR_LOCK.get(shot, ()):
        rig = you if who == "YOU" else cr
        L.ground_lock(rig, 1, n, ground=FLOOR_Z - 0.03)
    if shot in SEAT_LOCK and not cr.obj.hide_render:
        a, b = SEAT_LOCK[shot]
        L.seat_lock(cr, a, min(b, n), bpy.data.objects["Mattress"], sink=0.03)
    if shot == "S05":
        L.seat_lock(cr, 1, 34, bpy.data.objects["MattressFlat"], sink=0.0)
    if shot == "S12b":       # leap off the floor: never let her feet dip into the floor
        L.seat_lock(cr, 9, 18, bpy.data.objects["Mattress"], sink=0.03, only_up=True)
    sc.frame_set(1)
    return sc
