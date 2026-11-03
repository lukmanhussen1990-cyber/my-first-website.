"""Build + animate the 'Why Your Cat Sits On Your Laptop' reel and save cat_laptop.blend.

    blender -b --python build_reel.py -- [out.blend]

Timeline (30 fps, frame 1 = 0.0 s) is locked to the voiceover word timings.
Also writes assets/generated/events.json (sound-effect cue frames for the audio mix).
"""
import bpy
import json
import math
import os
import random
import sys
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catlib as C  # noqa: E402
from catlib import N, hexcol, setin, sock_out  # noqa: E402
import build_set as BS  # noqa: E402
import owner as OW  # noqa: E402
import laptop as LP  # noqa: E402
from scenelib import solid, emissive  # noqa: E402

ROOT = BS.ROOT
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(ROOT, 'cat_laptop.blend')
FPS, F_END = 30, 750
FREEZE = 721            # last rendered frame of the hiss; post holds it to the end

# ----------------------------------------------------------------------------
# shots: (name, first frame, last frame)
# ----------------------------------------------------------------------------
SHOTS = [
    ('S1_walk_in', 1, 77), ('S2_owner_annoyed', 78, 134), ('S3_spiral_eyes', 135, 218),
    ('S4a_thermal_wide', 219, 296), ('S4b_thermal_laptop', 297, 339),
    ('S5a_flashback_stare', 340, 441), ('S5b_flashback_meow', 442, 495),
    ('S6a_tint_cat', 496, 540), ('S6b_tint_laptop', 541, 594),
    ('S7a_jump', 595, 630), ('S7b_screen_ffff', 631, 645), ('S7c_happy_blink', 646, 673),
    ('S8a_hand_reach', 674, 694), ('S8b_owner_worried', 695, 707), ('S8c_hiss', 708, F_END),
]
FX = {'thermal': (219, 339), 'bw': (340, 495), 'tint': (496, 594)}


def shot_of(f):
    for nm, a, b in SHOTS:
        if a <= f <= b:
            return nm, a, b
    return SHOTS[-1]


EVENTS = {'paw': [], 'key': [], 'meow': [], 'boing': [], 'hiss': [], 'pop': [], 'whoosh': [],
          'land': [], 'jump': [], 'sparkle': [], 'beep': [], 'tick_fast': [], 'flash': [], 'freeze': [],
          'shake': []}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.name = 'CatLaptopReel'
screen_movie = os.path.join(ROOT, 'assets', 'generated', 'screen.mp4')
S = BS.build(sc, screen_movie, F_END)
BS.render_settings(sc, 100, 5)
sc.eevee.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'
sc.eevee.shadow_step_count = 3
S['fill'].data.use_shadow = False
for ob in bpy.data.objects:
    if ob.type == 'MESH' and any(k in ob.name for k in ('potted_plant_01', 'potted_plant_02', 'encyclopedia')):
        dm = ob.modifiers.new('Decimate', 'DECIMATE')
        dm.ratio = 0.2
        if 'plant' in ob.name:
            ob.visible_shadow = False
sc.frame_start, sc.frame_end = 1, F_END
sc.render.fps = FPS

cat = S['cat']
own = S['owner']
ctrl = S['ctrl']
laptop = S['laptop']
lid = S['lid']
rnd = random.Random(11)

# laptop world placement (on the owner's lap) for the cat to land on
bpy.context.view_layer.update()
LAP_TOP = laptop.matrix_world @ Vector((0, 0.025, LP.T + 0.0026))   # keyboard surface, cat sits here
SCREEN_C = lid.matrix_world @ Vector((0, LP.D / 2, 0))


def yaw_to(dx, dy):
    """rig yaw so that the cat (which faces local -Y) faces world direction (dx, dy)."""
    return math.atan2(dx, -dy)


# ----------------------------------------------------------------------------
# CAT animation
# ----------------------------------------------------------------------------
RUG_Z = 0.006
P_WALK0 = Vector((-1.22, -0.02, RUG_Z))
P_WALK1 = Vector((-0.86, 0.31, RUG_Z))
WALK_DIR = (P_WALK1 - P_WALK0).normalized()
WALK_FR = (1, 77)
P_FLOOR_A = Vector((-0.86, 0.31, RUG_Z))    # S2-S3 (sitting, facing camera)
P_FLOOR_B = Vector((-0.6, 1.0, RUG_Z))      # S4-S7 (near the owner)
P_FLOOR_C = Vector((-0.82, 0.98, RUG_Z))    # S5
LAND = LAP_TOP.copy()
LAND.y += 0.012
J0, J1, J2 = 600, 612, 626                  # take-off, landing, sat down


def cat_pose(f):
    """returns (location, yaw, CatState, spiral)"""
    st = C.stand_state()
    spiral = 0.0
    shot, a, b = shot_of(f)
    loc, yaw = P_FLOOR_B.copy(), yaw_to(0.5, 0.35)
    if f <= 77:                                                   # S1 walk in
        dist = (f - 1) * C.WALK_SPEED
        loc = P_WALK0 + WALK_DIR * dist
        yaw = yaw_to(WALK_DIR.x, WALK_DIR.y)
        C.walk_state(st, dist / (2 * C.STRIDE))
        st.blink = C.blink_value(f, 44)
        st.head_yaw = 0.25 * C.ease((f - 30) / 30.0)             # glance towards camera
    elif f <= 218:                                               # S2 sit down, S3 spiral
        loc = P_FLOOR_A.copy()
        yaw0 = yaw_to(WALK_DIR.x, WALK_DIR.y)
        yaw1 = yaw_to(-0.25, -1.0) + 0.0                         # face the S3 camera
        k = C.ease((f - 80) / 22.0)
        yaw = C.lerp(yaw0, yaw1, k)
        C.sit_state(st, C.ease((f - 82) / 16.0))
        C.tail_state(st, f / 55.0, amp=0.12 * (1 - k) + 0.06)
        if f > 100:
            C.sit_state(st, 1.0)
            st.tail = [(c, s + 0.08 * math.sin(f / 9.0 - i)) for i, (c, s) in enumerate(C.sit_state(C.stand_state()).tail)]
        st.head_pitch = -0.2
        st.head_roll = 0.1 * math.sin(f / 20.0)
        st.blink = C.blink_value(f, 120)
        if f >= 148:                                             # hypno spirals
            spiral = 1.0
            st.eye_scale = 1.0 + 0.32 * math.sin(math.pi * min(1.0, (f - 146) / 8.0)) if f < 154 else 1.0
            st.head_roll = 0.16 * math.sin((f - 148) / 6.0)
            st.head_yaw = 0.08 * math.sin((f - 148) / 9.0)
            st.ears_back = 0.15
        elif f >= 144:
            st.eye_scale = 1.0 - 0.15 * C.ease((f - 144) / 4.0)
    elif f <= 339:                                               # S4 thermal: sitting, looking at laptop
        loc = Vector((-0.6, 1.0, RUG_Z)) if f <= 296 else Vector((-0.5, 1.06, RUG_Z))
        yaw = yaw_to(LAP_TOP.x - loc.x, LAP_TOP.y - loc.y)
        C.sit_state(st, 1.0)
        st.head_pitch = -0.55
        st.head_roll = 0.12
        st.blink = C.blink_value(f, 262) + C.blink_value(f, 318, 9)
        C.tail_state(st, f / 40.0, amp=0.1)
        st.tail = [(c - 0.4, s + 0.5) for c, s in st.tail]
    elif f <= 495:                                               # S5 flashback: ignored cat
        loc = P_FLOOR_C.copy()
        yaw = yaw_to(own.location.x - loc.x, own.location.y - loc.y) - 0.15
        C.sit_state(st, 1.0)
        st.head_pitch = -0.62
        st.head_roll = 0.1 * math.sin(f / 23.0)
        sw = C.sit_state(C.stand_state()).tail
        st.tail = [(c, s + 0.25 * math.sin(f / 7.0 - 0.6 * i)) for i, (c, s) in enumerate(sw)]
        st.blink = C.blink_value(f, 395)
        if f >= 444:                                             # meow
            m = math.sin(math.pi * min(1.0, max(0.0, (f - 446) / 13.0)))
            st.mouth_open = 0.55 * m
            st.head_pitch = -0.75 - 0.12 * m
            st.ears_back = -0.12 * m
    elif f <= 594:                                               # S6 enemy: hunting stance
        loc = Vector((-0.6, 1.0, RUG_Z))
        yaw = yaw_to(LAP_TOP.x - loc.x, LAP_TOP.y - loc.y)
        crouch = C.ease((f - 496) / 10.0)
        st.root = Vector((0, 0, -0.016 * crouch))
        st.body_pitch = 0.08 * crouch
        st.head_pitch = -0.35
        st.ears_back = -0.1
        st.slit = 0.0
        C.tail_state(st, f / 18.0, amp=0.22)
        st.tail = [(c - 0.15, s) for c, s in st.tail]
        st.blink = 0.0
        # wiggle the bum before pouncing (cute!)
        st.body_roll = 0.05 * math.sin(f / 2.2) * C.ease((f - 560) / 10.0)
    else:                                                        # S7-S8 jump, sit on laptop, hiss
        start = Vector((-0.6, 1.0, RUG_Z))
        yaw0 = yaw_to(LAP_TOP.x - start.x, LAP_TOP.y - start.y)
        if f < J0:                                               # crouch
            k = C.ease((f - 595) / 5.0)
            loc, yaw = start, yaw0
            st.root = Vector((0, 0, -0.03 * k))
            st.body_pitch = 0.1 * k
            st.head_pitch = -0.3
            C.tail_state(st, f / 10.0, amp=0.1)
        elif f < J1:                                             # flight (parabola)
            t = (f - J0) / (J1 - J0)
            loc = start.lerp(LAND, t)
            loc.z = start.z + (LAND.z - start.z) * t + 0.34 * math.sin(math.pi * t)
            yaw = C.lerp(yaw0, 0.0, C.ease(t))
            st.body_pitch = -0.35 * (1 - t) + 0.25 * t
            st.head_pitch = 0.2 * t - 0.2
            for leg in C.LEG_PIVOTS:
                p = C.default_paw(leg)
                fw = -0.05 if '_f' in leg else 0.06
                st.paws[leg] = Vector((p.x, p.y + fw, p.z + 0.01))
            st.tail = [(-0.3, 0.0), (-0.2, 0.0), (-0.1, 0.0), (0.0, 0.0)]
        else:                                                    # landed: squash, sit, pride, hiss
            loc, yaw = LAND.copy(), 0.0
            if f <= J1 + 6:
                loc.z -= 0.006 * math.sin(math.pi * (f - J1) / 6.0)
            sq = math.sin(math.pi * min(1.0, (f - J1) / 5.0)) if f < J1 + 5 else 0.0
            st.root = Vector((0, 0, -0.012 * sq))
            st.body_scale = Vector((1 + 0.05 * sq, 1, 1 - 0.07 * sq))
            C.sit_state(st, C.ease((f - J1 - 2) / (J2 - J1 - 2)))
            sw = C.sit_state(C.stand_state()).tail
            st.tail = [(c * 0.6, -s * 0.5 + 0.2 * math.sin(f / 8.0 - i)) for i, (c, s) in enumerate(sw)]
            st.head_pitch = -0.08
            if 646 <= f <= 673:                                  # proud slow happy blink
                st.head_pitch = -0.16
                st.head_roll = 0.07 * math.sin((f - 646) / 10.0)
                bl = C.ease((f - 648) / 8.0) - C.ease((f - 664) / 8.0)
                st.blink = bl
            if 674 <= f <= 707:                                  # hand approaches: ears twitch
                st.ear_twitch = (-0.25 * C.ease((f - 680) / 6.0), -0.2 * C.ease((f - 682) / 6.0))
                st.angry = 0.3 * C.ease((f - 684) / 8.0)
                st.head_yaw = 0.18 * C.ease((f - 680) / 10.0)
            if f >= 708:                                         # HISS
                h = C.ease((f - 708) / 6.0)
                C.hiss_state(st, h)
                st.head_yaw = 0.0
                st.head_offset = st.head_offset + Vector((0, -0.01 * h, 0))
                st.tail = [(c - 0.4 * h, s * (1 - h)) for c, s in st.tail]
    return loc, yaw, st, spiral


prev_ph = None
cat.animation_data_create()
cat.animation_data.action = bpy.data.actions.new('Reel_Cat')
for f in range(1, F_END + 1):
    if f > FREEZE:
        break
    loc, yaw, st, spiral = cat_pose(f)
    cat.location = loc
    cat.rotation_euler = (0, 0, yaw)
    cat['spiral_eyes'] = spiral
    C.apply_state(cat, st)
    cat.keyframe_insert('location', frame=f, group='Object')
    cat.keyframe_insert('rotation_euler', frame=f, group='Object')
    cat.keyframe_insert('["spiral_eyes"]', frame=f, group='Object')
    C.key_state(cat, f)
    if f <= 77:          # paw contacts for SFX
        ph = ((f - 1) * C.WALK_SPEED / (2 * C.STRIDE)) % 1.0
        if prev_ph is not None:
            for off in (0.0, 0.5):
                c = (1.0 - off) % 1.0
                if (prev_ph < c <= ph) or (prev_ph > ph and (c > prev_ph or c <= ph)):
                    EVENTS['paw'].append(f)
        prev_ph = ph
EVENTS['pop'].append(148)
EVENTS['meow'].append(447)
EVENTS['jump'].append(J0)
EVENTS['land'].append(J1)
EVENTS['sparkle'].append(652)
EVENTS['hiss'].append(709)
EVENTS['freeze'].append(FREEZE)

# ----------------------------------------------------------------------------
# OWNER animation
# ----------------------------------------------------------------------------
own.animation_data_create()
own.animation_data.action = bpy.data.actions.new('Reel_Owner')
ow_inv = own.matrix_world.inverted()
KEY_L = Vector((0.075, -0.272, 0.222))
KEY_R = Vector((-0.075, -0.272, 0.222))
screen_local = ow_inv @ SCREEN_C
key_t = {'L': [], 'R': []}
for side in ('L', 'R'):
    t = 1
    while t < F_END:
        t += rnd.randint(3, 6)
        key_t[side].append(t)


def press(side, f):
    for t in key_t[side]:
        if 0 <= f - t < 2:
            return 1.0
    return 0.0


def owner_pose(f):
    pb = own.pose.bones
    expr, blink = 'neutral', 0.0
    lean = 0.14
    look_tgt = screen_local.copy()
    look_inf = 1.0
    hand_L = KEY_L.copy()
    hand_R = KEY_R.copy()
    typing = True
    if 78 <= f <= 134:                       # annoyed glance at the cat
        expr = 'annoyed'
        k = C.ease((f - 80) / 10.0)
        cat_local = ow_inv @ Vector((-0.86, 0.31, 0.25))
        look_tgt = screen_local.lerp(cat_local, k)
    if 340 <= f <= 495:                      # flashback: zombie stare at the screen
        expr = 'stare'
        lean = 0.2
    if f >= 600:                             # cat jumps in
        typing = False
        k = C.ease((f - 600) / 7.0)
        expr = 'surprised' if f < 650 else 'annoyed'
        lean = 0.14 - 0.22 * k
        kd = C.ease((f - 614) / 10.0)          # surprise: hands fly up, then settle on the thighs
        hand_L = KEY_L.lerp(Vector((0.24, -0.2, 0.42)), k).lerp(Vector((0.215, -0.3, 0.245)), kd)
        hand_R = KEY_R.lerp(Vector((-0.24, -0.2, 0.42)), k).lerp(Vector((-0.215, -0.3, 0.245)), kd)
        cat_head = ow_inv @ (LAND + Vector((0, 0, 0.3)))
        look_tgt = screen_local.lerp(cat_head, k)
        if f >= 674:                         # reach to move the cat
            r = C.ease((f - 676) / 16.0)
            expr = 'neutral' if f < 695 else 'worried'
            tgt = ow_inv @ (LAND + Vector((0.11, -0.03, 0.27)))
            hand_L = Vector((0.215, -0.3, 0.245)).lerp(tgt, r)
            lean = -0.08 + 0.12 * r
        if f >= 708:                         # pull back after the hiss
            k2 = C.ease((f - 709) / 6.0)
            hand_L = hand_L.lerp(Vector((0.26, -0.12, 0.5)), k2)
            lean = lean - 0.1 * k2
    if typing:
        pl, pr = press('L', f), press('R', f)
        hand_L = hand_L + Vector((0.01 * math.sin(f / 7.0), 0.006 * math.sin(f / 11.0), -0.012 * pl))
        hand_R = hand_R + Vector((0.01 * math.sin(f / 6.0 + 1), 0.006 * math.sin(f / 9.0), -0.012 * pr))
    # occasional blinks (not while staring)
    if expr != 'stare':
        for bt in (60, 170, 255, 318, 560, 640, 690):
            blink = max(blink, C.blink_value(f, bt, 6))
    pb['spine'].rotation_euler = (lean, 0, 0)
    pb['neck'].rotation_euler = (0.0, 0, 0)
    pb['head'].rotation_euler = (0.0, 0, 0)
    ctrl['look'].location = look_tgt
    ctrl['head_con'].influence = look_inf
    ctrl['ik.L'].location = hand_L
    ctrl['ik.R'].location = hand_R
    for side in ('L', 'R'):
        pb['hand.' + side].rotation_euler = (-0.25, 0, 0)
    OW.set_face(own, expr, blink)
    return typing


for f in range(1, FREEZE + 1):
    typing = owner_pose(f)
    OW.key_owner(own, ctrl, f)
    if typing and (press('L', f) and press('L', f - 1) == 0 or press('R', f) and press('R', f - 1) == 0):
        EVENTS['key'].append(f)

# ----------------------------------------------------------------------------
# laptop shake (S6b) + dip when the cat lands
# ----------------------------------------------------------------------------
base_loc = laptop.location.copy()
base_rot = laptop.rotation_euler.copy()
for f in range(1, FREEZE + 1):
    off = Vector((0, 0, 0))
    rot = Vector((0, 0, 0))
    if 541 <= f <= 594:
        a = 0.0045 * C.ease((f - 541) / 6.0)
        off = Vector((a * math.sin(f * 2.7), a * 0.6 * math.sin(f * 3.9 + 1), a * 0.5 * math.sin(f * 5.3)))
        rot = Vector((0.03 * a / 0.0045 * math.sin(f * 3.1), 0.0, 0.05 * a / 0.0045 * math.sin(f * 2.3)))
        if f % 3 == 0:
            EVENTS['shake'].append(f)
    if J1 <= f <= J1 + 6:
        off.z -= 0.006 * math.sin(math.pi * (f - J1) / 6.0)
    laptop.location = base_loc + off
    laptop.rotation_euler = (base_rot.x + rot.x, base_rot.y + rot.y, base_rot.z + rot.z)
    laptop.keyframe_insert('location', frame=f)
    laptop.keyframe_insert('rotation_euler', frame=f)

# ----------------------------------------------------------------------------
# wall clock: hands spin during the flashback ("all day")
# ----------------------------------------------------------------------------
clock_root, clock_objs = S['clock']
bpy.context.view_layer.update()
body = [o for o in clock_objs if o.type == 'MESH' and 'hand' not in o.name.lower()][0]
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
clock_c = sum(bb, Vector()) / 8
for o in clock_objs:
    nm = o.name.lower()
    if 'hand' not in nm:
        continue
    rev = 0.5 if 'hour' in nm else (6.0 if 'minute' in nm else 40.0)
    o.rotation_mode = 'QUATERNION'
    M0 = o.matrix_world.copy()
    for f in [1, 339] + list(range(340, 442)) + [FREEZE]:
        k = min(1.0, max(0.0, (f - 340) / 101.0))
        R = Matrix.Translation(clock_c) @ Matrix.Rotation(2 * math.pi * rev * k, 4, 'Y') @ Matrix.Translation(-clock_c)
        o.matrix_world = R @ M0
        o.keyframe_insert('location', frame=f)
        o.keyframe_insert('rotation_quaternion', frame=f)
EVENTS['tick_fast'].append(342)

# ----------------------------------------------------------------------------
# "?" pop-up (red, keeps its colour in the B&W flashback)
# ----------------------------------------------------------------------------
fx_c = BS.coll_new('FX', sc.collection)
qcu = bpy.data.curves.new('QMark', 'FONT')
qcu.body = '?'
qcu.font = bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', check_existing=True)
qcu.size = 0.17
qcu.extrude = 0.014
qcu.bevel_depth = 0.006
qcu.bevel_resolution = 3
qcu.align_x = 'CENTER'
qcu.align_y = 'CENTER'
qm = bpy.data.objects.new('QMark', qcu)
fx_c.objects.link(qm)
q_mat = solid('FX_QMark', '#FF2A2A', 0.3, emit='#FF1A1A', emit_str=1.6, coat=0.6)
qcu.materials.append(q_mat)
_dirq = Vector((own.location.x - P_FLOOR_C.x, own.location.y - P_FLOOR_C.y, 0)).normalized()
Q_POS = P_FLOOR_C + _dirq * 0.05 + Vector((0, 0, 0.535))
_camq = Vector((-0.24, 1.05, 0)) - Vector((Q_POS.x, Q_POS.y, 0))
Q_YAW = math.atan2(_camq.x, -_camq.y)
for f in range(1, FREEZE + 1):
    if f < 457 or f > 495:
        s = 0.0
    else:
        t = (f - 457) / 8.0
        s = 1.0 if t >= 1 else (1.0 + 0.45 * math.sin(t * math.pi) * (1 - t) + (t - 1) * (1 - t) * 0) * C.ease(t * 1.6)
    qm.scale = (s, s, s)
    qm.location = Q_POS + Vector((0, 0, 0.012 * math.sin(f / 5.0)))
    qm.rotation_euler = (math.radians(90), 0, Q_YAW + 0.12 * math.sin(f / 6.0))
    qm.keyframe_insert('scale', frame=f)
    qm.keyframe_insert('location', frame=f)
    qm.keyframe_insert('rotation_euler', frame=f)
EVENTS['boing'].append(457)

# heat waves above the laptop (only visible in the thermal shots)
hw_mat = solid('FX_HeatWave', '#FFB060', 0.5, emit='#FF8A30', emit_str=2.0)
waves = []
for i in range(3):
    cu = bpy.data.curves.new(f'HeatWave{i}', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.004
    sp = cu.splines.new('POLY')
    n = 24
    sp.points.add(n - 1)
    for j in range(n):
        z = j / (n - 1) * 0.22
        sp.points[j].co = (0.012 * math.sin(j * 0.9 + i * 2), 0.0, z, 1)
    ob = bpy.data.objects.new(f'HeatWave{i}', cu)
    fx_c.objects.link(ob)
    cu.materials.append(hw_mat)
    ob.parent = laptop
    ob.location = ((i - 1) * 0.08, 0.02, 0.05)
    for f in (1, 218, 219, 339, 340):
        ob.hide_render = not (219 <= f <= 339)
        ob.keyframe_insert('hide_render', frame=f)
    for f in range(219, 340, 2):
        ob.location.z = 0.04 + ((f * 0.004 + i * 0.07) % 0.1)
        ob.keyframe_insert('location', frame=f)
    waves.append(ob)

# ----------------------------------------------------------------------------
# AOVs for the compositor FX (temperature, team glow, keep-colour)
# ----------------------------------------------------------------------------
vl = sc.view_layers[0]
for nm, typ in (('temp', 'VALUE'), ('glow', 'COLOR'), ('keep', 'VALUE')):
    a = vl.aovs.add()
    a.name = nm
    a.type = typ


def temp_of(mname):
    n = mname.lower()
    table = [('laptop_keys', 0.98), ('laptop_alu', 0.93), ('laptop_screen', 0.9), ('laptop_bezel', 0.9),
             ('laptop_pawsticker', 0.86), ('laptop', 0.92), ('heatwave', 0.8), ('coffee', 0.74),
             ('ceramic_white', 0.6), ('cat_eye', 0.5), ('cat_nose', 0.62), ('cat_mouth', 0.62), ('cat_tongue', 0.62),
             ('cat_', 0.57), ('owner_skin', 0.62), ('owner_hair', 0.42), ('owner_sweater', 0.5),
             ('owner_jeans', 0.5), ('owner_sock', 0.45), ('owner_eye', 0.55), ('owner_', 0.55),
             ('lampshade', 0.5), ('glass', 0.5), ('globe', 0.5), ('sofa', 0.22), ('pillow', 0.2),
             ('rug', 0.15), ('floor', 0.1), ('wall', 0.12), ('trim', 0.1), ('ceiling', 0.12),
             ('curtain', 0.13), ('plant', 0.17), ('leaves', 0.17), ('book', 0.13), ('wood', 0.11),
             ('fx_qmark', 0.3)]
    for k, v in table:
        if k in n:
            return v
    return 0.12


def glow_of(mname):
    n = mname.lower()
    if n.startswith('laptop') or 'heatwave' in n:
        return (1.0, 0.0, 0.0, 1.0)
    if n.startswith('cat_'):
        return (0.0, 1.0, 0.0, 1.0)
    return (0.0, 0.0, 0.0, 1.0)


for mat in bpy.data.materials:
    if not mat.use_nodes or mat.node_tree is None:
        continue
    nt = mat.node_tree
    tv = temp_of(mat.name)
    o1 = nt.nodes.new('ShaderNodeOutputAOV')
    o1.aov_name = 'temp'
    if mat.name == 'Laptop_Alu':     # hot spot in the middle of the base
        tc = nt.nodes.new('ShaderNodeTexCoord')
        d = C.VM(nt, 'LENGTH', C.VM(nt, 'MULTIPLY', tc.outputs['Object'], (1.0, 1.0, 0.0)))
        val = C.M(nt, 'SUBTRACT', 1.0, C.M(nt, 'MULTIPLY', d, 0.9))
        nt.links.new(C.M(nt, 'MULTIPLY_ADD', val, 0.16, 0.82), o1.inputs['Value'])
    else:
        o1.inputs['Value'].default_value = tv
    o2 = nt.nodes.new('ShaderNodeOutputAOV')
    o2.aov_name = 'glow'
    o2.inputs['Color'].default_value = glow_of(mat.name)
    o3 = nt.nodes.new('ShaderNodeOutputAOV')
    o3.aov_name = 'keep'
    o3.inputs['Value'].default_value = 1.0 if mat.name == 'FX_QMark' else 0.0

# ----------------------------------------------------------------------------
# compositor: thermal / black & white flashback / enemy-friend tint, soft bloom
# ----------------------------------------------------------------------------
sc.use_nodes = True
ct = sc.node_tree
for n in list(ct.nodes):
    ct.nodes.remove(n)
L = ct.links.new
rl = N(ct, 'CompositorNodeRLayers', -1400, 0)
img = rl.outputs['Image']


def cval(name, x, y):
    n = N(ct, 'CompositorNodeValue', x, y)
    n.name = n.label = name
    n.outputs[0].default_value = 0.0
    return n


def mixc(fac, a, b, blend='MIX', x=0, y=0, clamp=False):
    n = N(ct, 'CompositorNodeMixRGB', x, y)
    n.blend_type = blend
    n.use_clamp = clamp
    if isinstance(fac, float):
        n.inputs[0].default_value = fac
    else:
        L(fac, n.inputs[0])
    for i, s in ((1, a), (2, b)):
        if isinstance(s, tuple):
            n.inputs[i].default_value = s
        else:
            L(s, n.inputs[i])
    return n.outputs[0]


def cmath(op, a, b=None, x=0, y=0, clamp=False):
    n = N(ct, 'CompositorNodeMath', x, y)
    n.operation = op
    n.use_clamp = clamp
    for i, s in ((0, a), (1, b)):
        if s is None:
            continue
        if isinstance(s, (int, float)):
            n.inputs[i].default_value = s
        else:
            L(s, n.inputs[i])
    return n.outputs[0]


fx_th = cval('FX_Thermal', -1400, -600)
fx_bw = cval('FX_BW', -1400, -700)
fx_tint = cval('FX_Tint', -1400, -800)
# soft overall bloom
bloom = N(ct, 'CompositorNodeGlare', -1150, 200)
bloom.glare_type = 'BLOOM'
bloom.quality = 'MEDIUM'
bloom.inputs['Highlights Threshold'].default_value = 1.1
bloom.inputs['Strength'].default_value = 0.16
bloom.inputs['Size'].default_value = 0.55
L(img, bloom.inputs['Image'])
base_img = bloom.outputs['Image']
# --- thermal
lum = N(ct, 'CompositorNodeRGBToBW', -1150, -150)
L(img, lum.inputs[0])
tv = cmath('ADD', cmath('MULTIPLY', rl.outputs['temp'], 0.84, -950, -100), cmath('MULTIPLY', lum.outputs[0], 0.2, -950, -200), -800, -150)
tblur = N(ct, 'CompositorNodeBlur', -650, -150)
tblur.filter_type = 'GAUSS'
tblur.inputs['Size'].default_value = (3, 3)
L(tv, tblur.inputs['Image'])
ramp = N(ct, 'CompositorNodeValToRGB', -450, -150)
cr = ramp.color_ramp
cr.interpolation = 'B_SPLINE'
stops = [(0.0, '#05062A'), (0.12, '#0B1F7A'), (0.25, '#1440B0'), (0.42, '#5A2DA0'), (0.55, '#B02A8C'),
         (0.68, '#E8344A'), (0.8, '#FF7A1E'), (0.9, '#FFC531'), (1.0, '#FFFBD8')]
cr.elements[0].position, cr.elements[0].color = stops[0][0], hexcol(stops[0][1])
cr.elements[1].position, cr.elements[1].color = stops[-1][0], hexcol(stops[-1][1])
for pos, col in stops[1:-1]:
    e = cr.elements.new(pos)
    e.color = hexcol(col)
L(tblur.outputs[0], ramp.inputs['Fac'])
tglow = N(ct, 'CompositorNodeGlare', -250, -150)
tglow.glare_type = 'FOG_GLOW'
tglow.quality = 'MEDIUM'
tglow.inputs['Highlights Threshold'].default_value = 0.7
tglow.inputs['Strength'].default_value = 0.55
tglow.inputs['Size'].default_value = 0.55
L(ramp.outputs['Image'], tglow.inputs['Image'])
thermal = tglow.outputs['Image']
# --- black & white flashback (keeps the red '?') + soft white vignette
bw = N(ct, 'CompositorNodeRGBToBW', -950, -400)
L(img, bw.inputs[0])
bwc = N(ct, 'CompositorNodeCurveRGB', -800, -400)
L(bw.outputs[0], bwc.inputs['Image'])
cm = bwc.mapping
cm.curves[3].points[0].location = (0.0, 0.04)
cm.curves[3].points[1].location = (1.0, 0.97)
cm.curves[3].points.new(0.3, 0.24)
cm.curves[3].points.new(0.7, 0.8)
cm.update()
bw_keep = mixc(rl.outputs['keep'], bwc.outputs[0], base_img, x=-600, y=-400)
ell = N(ct, 'CompositorNodeEllipseMask', -800, -550)
ell.mask_type = 'ADD'
ell.inputs['Size'].default_value = (0.92, 0.8)
ell.inputs['Position'].default_value = (0.5, 0.5)
eblur = N(ct, 'CompositorNodeBlur', -650, -550)
eblur.filter_type = 'FAST_GAUSS'
eblur.inputs['Size'].default_value = (260, 260)
L(ell.outputs['Mask'], eblur.inputs['Image'])
vign = cmath('SUBTRACT', 1.0, eblur.outputs[0], -500, -550, clamp=True)
bw_out = mixc(cmath('MULTIPLY', vign, 0.75, -400, -550), bw_keep, (1.0, 1.0, 1.0, 1.0), x=-300, y=-450)
# --- enemy (red) / friend (green) tint
glow = rl.outputs['glow']
gmask = N(ct, 'CompositorNodeRGBToBW', -950, -800)
L(glow, gmask.inputs[0])
gm = cmath('MULTIPLY', gmask.outputs[0], 3.0, -800, -800, clamp=True)
dim = mixc(0.62, base_img, (0.06, 0.05, 0.08, 1.0), x=-800, y=-700)
lum2 = N(ct, 'CompositorNodeRGBToBW', -800, -950)
L(img, lum2.inputs[0])
tinted = mixc(1.0, glow, lum2.outputs[0], 'MULTIPLY', x=-650, y=-900)
tinted = mixc(0.35, tinted, base_img, x=-500, y=-900)
tinted = mixc(1.0, tinted, (1.35, 1.35, 1.35, 1.0), 'MULTIPLY', x=-400, y=-900)
tcore = mixc(gm, dim, tinted, x=-300, y=-800)
gblur = N(ct, 'CompositorNodeBlur', -650, -1050)
gblur.filter_type = 'FAST_GAUSS'
gblur.inputs['Size'].default_value = (46, 46)
L(glow, gblur.inputs['Image'])
halo = mixc(1.0, gblur.outputs[0], (1.7, 1.7, 1.7, 1.0), 'MULTIPLY', x=-450, y=-1050)
tint_out = mixc(1.0, tcore, halo, 'ADD', x=-150, y=-850)
# --- final mix
f1 = mixc(fx_th.outputs[0], base_img, thermal, x=100, y=0)
f2 = mixc(fx_bw.outputs[0], f1, bw_out, x=250, y=0)
f3 = mixc(fx_tint.outputs[0], f2, tint_out, x=400, y=0)
comp = N(ct, 'CompositorNodeComposite', 600, 0)
L(f3, comp.inputs['Image'])
for node, (a, b) in ((fx_th, FX['thermal']), (fx_bw, FX['bw']), (fx_tint, FX['tint'])):
    for f, v in ((1, 0.0), (a - 1, 0.0), (a, 1.0), (b, 1.0), (b + 1, 0.0)):
        node.outputs[0].default_value = v
        node.outputs[0].keyframe_insert('default_value', frame=f)
EVENTS['beep'].append(219)
EVENTS['whoosh'] += [340, 496]
EVENTS['flash'] += [340, 496]

# ----------------------------------------------------------------------------
# cameras (one per shot, bound with timeline markers)
# ----------------------------------------------------------------------------
cam_c = BS.coll_new('Cameras', sc.collection)
CAMS = {
    # name: (loc0, tgt0, lens0, loc1, tgt1, lens1, dof_focus_obj/None, fstop, roll)
    'S1_walk_in': ((-1.55, -1.22, 0.78), (-0.55, 0.85, 0.52), 19, (-1.42, -0.98, 0.74), (-0.6, 0.9, 0.5), 21, None, 0, 0),
    'S2_owner_annoyed': ((-0.52, 0.93, 1.08), (-0.14, 1.56, 1.19), 46, (-0.49, 0.98, 1.09), (-0.14, 1.56, 1.19), 54, 'owner_head', 2.8, 0),
    'S3_spiral_eyes': ((-0.94, -0.26, 0.32), (-0.86, 0.29, 0.27), 42, (-0.925, -0.15, 0.31), (-0.86, 0.29, 0.27), 52, 'cat_head', 2.8, 0),
    'S4a_thermal_wide': ((1.15, -0.55, 1.15), (-0.3, 1.35, 0.62), 22, (0.95, -0.3, 1.1), (-0.3, 1.35, 0.62), 24, None, 0, 0),
    'S4b_thermal_laptop': ((-0.52, 0.72, 0.62), (-0.14, 1.32, 0.66), 32, (-0.47, 0.82, 0.63), (-0.14, 1.32, 0.66), 36, None, 0, 0),
    'S5a_flashback_stare': ((-1.5, 0.42, 0.66), (-0.3, 1.42, 0.78), 21, (-1.43, 0.48, 0.67), (-0.3, 1.42, 0.79), 22, None, 0, 0),
    'S5b_flashback_meow': ((-0.22, 1.06, 0.28), (-0.79, 1.0, 0.39), 26, (-0.25, 1.06, 0.28), (-0.79, 1.0, 0.4), 29, 'cat_head', 4.0, 0),
    'S6a_tint_cat': ((-1.02, 0.66, 0.36), (-0.14, 1.35, 0.6), 26, (-0.97, 0.7, 0.35), (-0.14, 1.35, 0.6), 28, None, 0, 0),
    'S6b_tint_laptop': ((-0.56, 0.7, 0.55), (-0.12, 1.37, 0.74), 26, (-0.52, 0.76, 0.56), (-0.12, 1.37, 0.74), 29, None, 0, math.radians(7)),
    'S7a_jump': ((-1.15, 0.38, 0.9), (-0.38, 1.25, 0.6), 24, (-1.1, 0.45, 0.92), (-0.38, 1.25, 0.62), 25, None, 0, 0),
    'S7b_screen_ffff': ((-0.56, 1.74, 1.04), (-0.17, 1.2, 0.76), 42, (-0.54, 1.72, 1.03), (-0.17, 1.2, 0.76), 47, None, 0, 0),
    'S7c_happy_blink': ((-0.08, 0.82, 1.03), (-0.12, 1.28, 0.93), 46, (-0.08, 0.86, 1.02), (-0.12, 1.28, 0.93), 52, 'cat_head', 3.2, 0),
    'S8a_hand_reach': ((0.36, 0.92, 0.98), (-0.1, 1.33, 0.82), 32, (0.33, 0.97, 0.98), (-0.1, 1.33, 0.82), 35, None, 0, 0),
    'S8b_owner_worried': ((-0.02, 1.04, 1.08), (-0.12, 1.56, 1.22), 44, (-0.02, 1.07, 1.09), (-0.12, 1.56, 1.22), 50, 'owner_head', 2.8, 0),
    'S8c_hiss': ((-0.1, 0.84, 0.97), (-0.12, 1.28, 0.91), 38, (-0.11, 0.88, 0.96), (-0.12, 1.28, 0.91), 62, 'cat_head', 4.0, 0),
}
focus = {}
fe = bpy.data.objects.new('Focus_CatHead', None)
cam_c.objects.link(fe)
fe.parent = cat
fe.parent_type = 'BONE'
fe.parent_bone = 'head'
fe.location = (0, -0.02, 0.09)      # bone space: y = up, z = forward (face)
focus['cat_head'] = fe
fo = bpy.data.objects.new('Focus_OwnerHead', None)
cam_c.objects.link(fo)
fo.parent = own
fo.parent_type = 'BONE'
fo.parent_bone = 'head'
fo.location = (0, -0.12, 0.11)
focus['owner_head'] = fo


def look_euler(loc, tgt, roll=0.0):
    q = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y')
    e = q.to_euler()
    if roll:
        e = (q @ Euler((0, 0, roll)).to_quaternion()).to_euler()
    return e


for nm, a, b in SHOTS:
    l0, t0, f0, l1, t1, f1_, foc, fstop, roll = CAMS[nm]
    cd = bpy.data.cameras.new('Cam_' + nm)
    cd.clip_start = 0.02
    cd.clip_end = 60
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = 36.0 * 1.0
    ob = bpy.data.objects.new('Cam_' + nm, cd)
    cam_c.objects.link(ob)
    if foc:
        cd.dof.use_dof = True
        cd.dof.focus_object = focus[foc]
        cd.dof.aperture_fstop = fstop
    end = min(b, FREEZE)
    for f, l, t, lens in ((a, l0, t0, f0), (end, l1, t1, f1_)):
        ob.location = l
        ob.rotation_euler = look_euler(l, t, roll)
        cd.lens = lens
        ob.keyframe_insert('location', frame=f)
        ob.keyframe_insert('rotation_euler', frame=f)
        cd.keyframe_insert('lens', frame=f)
    if nm == 'S8c_hiss':        # punchy zoom + shake
        for f in range(a, end + 1):
            k = C.ease((f - a) / 8.0)
            l = Vector(l0).lerp(Vector(l1), k)
            ob.location = l
            sh = 0.012 * C.ease((f - 710) / 3.0) * math.sin(f * 2.9)
            ob.rotation_euler = look_euler(l, t1, sh)
            cd.lens = C.lerp(f0, f1_, k)
            ob.keyframe_insert('location', frame=f)
            ob.keyframe_insert('rotation_euler', frame=f)
            cd.keyframe_insert('lens', frame=f)
    m = sc.timeline_markers.new(nm, frame=a)
    m.camera = ob
    if a == 1:
        sc.camera = ob

# ----------------------------------------------------------------------------
# save
# ----------------------------------------------------------------------------
ev_path = os.path.join(ROOT, 'assets', 'generated', 'events.json')
json.dump({'fps': FPS, 'freeze': FREEZE, 'end': F_END, 'events': EVENTS,
           'shots': [{'name': n, 'start': a, 'end': b} for n, a, b in SHOTS]}, open(ev_path, 'w'), indent=1)
sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT), compress=True)
try:
    bpy.ops.file.make_paths_relative()
except Exception as e:  # noqa
    print('make_paths_relative failed', e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT), compress=True)
print('SAVED', OUT, 'events:', {k: len(v) for k, v in EVENTS.items()})
