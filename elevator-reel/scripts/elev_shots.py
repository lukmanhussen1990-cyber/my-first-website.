"""Elevator episode animation. Reads /opt/work/elev/words.json (estimated or Whisper), writes elev_anim.blend."""
import bpy, sys, math, random, json, time, bmesh
sys.path.insert(0, "/opt/work/scripts")
from mathutils import Vector, Matrix, Euler
import lib, anim_lib as al, build_fx as fx, polish, mh_common as mc
from anim_lib import Actor, make_cam, cam_move, shake, key_obj, key_node_value

t0 = time.time()
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_master.blend")
sc = bpy.context.scene
LY = sc["layout"]
WHEEL = Vector(LY["wheel"]); WR = LY["wheel_r"]; LOAD_X = LY["load_x"]; CNT_X = LY["cnt_x"]; RY = LY["rope_y"]
ROOF_Z = LY["bld_h"] + 0.51
ST = LY["stair"]; SX, RISE, RUN = ST["x"], ST["rise"], ST["run"]
SLOPE = math.atan2(RISE, RUN)
_wj = json.load(open("/opt/work/elev/words.json"))
words = _wj["words"]
VO_DUR = _wj["duration"] if not _wj.get("estimated", True) else words[-1]["end"]     # real VO: file length; estimate: last word
FPS = 30
TOTAL = int(math.ceil((VO_DUR + 0.5) * FPS))
sc.frame_start, sc.frame_end = 1, TOTAL
R = random.Random(7)
C_cam = lib.coll("CAMERAS")
C_fx = bpy.data.collections["FX"]
C_props = bpy.data.collections["PROPS"]


def F(t):
    return int(round(t * FPS)) + 1


def ws(i):
    return words[i]["start"]


SHOTS = [("01a", 0.0), ("01b", ws(6) - 0.1), ("02", ws(9) - 0.05), ("03", ws(16) - 0.05), ("04a", ws(23) - 0.05),
         ("04b", ws(30) - 0.05), ("05a", ws(37) - 0.05), ("05b", ws(39) - 0.05), ("06", ws(46) - 0.05), ("07", ws(53) - 0.08),
         ("08a", ws(54) - 0.05), ("08b", ws(61) - 0.05), ("09", ws(66) - 0.05), ("10", ws(76) - 0.05), ("11", ws(83) - 0.05), ("11b", ws(87) - 0.05),
         ("12", ws(92) - 0.05), ("13", ws(99) - 0.05), ("14", ws(107) - 0.05), ("15", ws(114) - 0.05), ("16", ws(119) - 0.05),
         ("17a", ws(125) - 0.05), ("17b", ws(131) - 0.05), ("18", ws(137) - 0.05), ("18b", ws(138) - 0.05), ("19", ws(143) - 0.05)]
S = {}
for i, (n, t) in enumerate(SHOTS):
    f0 = F(max(0.0, t))
    f1 = F(SHOTS[i + 1][1]) if i + 1 < len(SHOTS) else TOTAL + 1
    S[n] = (f0, f1)
print("TOTAL", TOTAL, S)

rig = bpy.data.objects["You"]
A = Actor(rig)
O = bpy.data.objects
piano = O["Piano"]; pianoH = O["PianoHall"]; cabin = O["Cabin"]; rock = O["Rock"]; motor = O["MotorRig"]
wroot = O["WheelRig"]; wspin = O["WheelSpin"]; modern = O["ModernRig"]; hammer = O["Hammer"]
stages = sorted([o for o in O if o.name.startswith("Shaft_s")], key=lambda o: o.name)


def W(*a):
    return Vector(a if len(a) == 3 else a[0])


# ------------------------------------------------------------------ visibility helper
def vis(objs, ranges, children=True):
    """objs visible only within list of (f0, f1) ranges."""
    if not isinstance(objs, (list, tuple)):
        objs = [objs]
    allobjs = []
    for o in objs:
        allobjs.append(o)
        if children:
            allobjs += list(o.children_recursive)
    for o in allobjs:
        lib.hide_key(o, 0, True)
        for (a, b) in ranges:
            lib.hide_key(o, a, False)
            lib.hide_key(o, b, True)


# ------------------------------------------------------------------ rope rigs (Stretch To)
def rope_y_mesh(name, radius, mat_name="M_Rope"):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=radius, radius2=radius, depth=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x, v.co.z + 0.5, -v.co.y))   # along +Y from 0..1
    o = lib.mesh_from_bmesh(name, bm, C_props)
    o.data.materials.append(bpy.data.materials[mat_name])
    return o


def empty(name, parent=None, loc=(0, 0, 0), bone=None):
    e = bpy.data.objects.new(name, None); C_props.objects.link(e)
    e.empty_display_size = 0.05
    if parent is not None:
        e.parent = parent
        if bone:
            e.parent_type = 'BONE'; e.parent_bone = bone
    e.location = loc
    return e


def stretch(obj, target, name, subtarget=None):
    c = obj.constraints.new('STRETCH_TO')
    c.target = target
    if subtarget:
        c.subtarget = subtarget
    c.rest_length = 1.0
    c.volume = 'NO_VOLUME'
    c.name = name
    c.influence = 0.0
    return c


# hands midpoint (for ropes held with both hands)
hmid = empty("HandsMid")
c = hmid.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_r"
c = hmid.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_l"; c.influence = 0.5
hand_r = empty("HandR"); c = hand_r.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_r"
hand_l = empty("HandL"); c = hand_l.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_l"
# anchors
p_top = empty("PianoTop", piano, (0, 0.05, 1.28))                # harness knot
ph_top = empty("PianoHallTop", pianoH, (0, 0.05, 1.28))         # harness knot
cab_top = empty("CabinTop", cabin, (0, 0, 2.48))
rock_top = empty("RockTop", rock, (0, 0, 0))
hang_pt = empty("RopeHangPt", None, (CNT_X, RY, 0.22))
# strap (stairwell): from piano top to hands
strap = rope_y_mesh("Strap", 0.022, "M_Rope"); strap.parent = ph_top
stretch(strap, hmid, "toHands")
strap.constraints["toHands"].influence = 1.0
# roof rope: from piano top to hands
rope_h = rope_y_mesh("RopeHands", 0.026); rope_h.parent = p_top
stretch(rope_h, hmid, "toHands"); rope_h.constraints["toHands"].influence = 1.0
stretch(rope_h, hand_l, "toHandL"); stretch(rope_h, hand_r, "toHandR")
# wheel strands
rope_l = rope_y_mesh("RopeLoad", 0.026); rope_l.location = (LOAD_X, RY, WHEEL.z)
c1 = stretch(rope_l, p_top, "toPiano"); c2 = stretch(rope_l, cab_top, "toCabin")
rope_c = rope_y_mesh("RopeCnt", 0.026); rope_c.location = (CNT_X, RY, WHEEL.z)
c3 = stretch(rope_c, hmid, "toHands"); c4 = stretch(rope_c, rock_top, "toRock"); c5 = stretch(rope_c, hand_r, "toHandR")
c6 = stretch(rope_c, hang_pt, "toHang")
c7 = stretch(rope_c, hand_l, "toHandL")
belt = rope_y_mesh("Belt", 0.018, "M_Iron")
belt.location = motor.location + Vector((0, -0.26, 0.42))
stretch(belt, wroot, "toWheel"); belt.constraints["toWheel"].influence = 1.0


def infl(obj, cname, f, v):
    al.key_infl(obj, cname, f, v)


def wheel_turn(f, load_z):
    key_obj(wspin, f, rot=(0, math.degrees(load_z / WR), 0))


# ================================================================== SHOTS 01-03: stairwell
a0, a1 = S["01a"]; b0, b1 = S["01b"]; c0_, c1_ = S["02"]; d0, d1 = S["03"]


def step_pos(k):
    """feet location (centre) on step k."""
    return Vector((SX, k * RUN + RUN * 0.5, (k + 1) * RISE))


def piano_on_slope(yb):
    """Piano tilted along stairs: base centre on nosing line."""
    z = RISE + yb * math.tan(SLOPE) + 0.015
    return Vector((SX, yb, z))


pianoH.rotation_euler = (SLOPE, 0, math.pi)       # keyboard faces downhill (-Y) after 180 flip; leans along slope
# he walks backwards up the stairs facing downhill: armature faces -Y  (rz = 0)
K0 = 8
jerk = 13                                          # frames per pull
f = a0
k = K0
yb = step_pos(K0).y - 1.45
A.feet(1)
A.fingers(1, "l", 75, thumb=35); A.fingers(1, "r", 75, thumb=35)
pulls = []
while f < d0:
    pulls.append(f)
    f += jerk
for i, f in enumerate(pulls):
    # body: lean forward (grab) then back (yank); the mouth+chest opening keeps the head steadier (arms pump below frame)
    op_ = f < c0_
    A.spine(f, 12 if op_ else 24, 0, 0); A.head(f, -4 if op_ else 6, 0, 0)
    A.hands(f, l=(0.11, -0.42, 0.86), r=(-0.11, -0.42, 0.86), el=(0.4, 0.15, 1.0), er=(-0.4, 0.15, 1.0))
    A.spine(f + 6, 5 if op_ else 8, 0, 0); A.head(f + 6, -6 if op_ else -10, 0, 0)
    A.hands(f + 6, l=(0.11, -0.22, 1.02), r=(-0.11, -0.22, 1.02))
    A.pelvis(f, (0, 0.04, -0.06)); A.pelvis(f + 6, (0, 0.08, -0.02))
# feet: he climbs backwards one step every 3 pulls (real stepping with foot IK)
A.place(1, step_pos(K0) + Vector((0, 0.05, 0)), 0, constant=False)
REST_L, REST_R = Vector((0.201, -0.017, 0.075)), Vector((-0.201, -0.017, 0.075))
kst = K0
for ci in range(3, len(pulls), 3):
    s_ = pulls[ci] - 7
    if s_ + 8 >= d0:
        break
    p_old = step_pos(kst) + Vector((0, 0.05, 0)); p_new = step_pos(kst + 1) + Vector((0, 0.05, 0)); D_ = p_new - p_old
    A.place(s_, p_old, 0, constant=False); A.place(s_ + 8, p_new, 0, constant=False)
    for tt_ in (0, 2, 4, 6, 8):
        P_ = D_ * (tt_ / 8)
        sl = min(1.0, tt_ / 4); sr = max(0.0, (tt_ - 4) / 4)
        Wl = D_ * sl + Vector((0, 0, 0.12 * math.sin(math.pi * sl)))
        Wr = D_ * sr + Vector((0, 0, 0.12 * math.sin(math.pi * sr)))
        A.ik(s_ + tt_, "IK_foot_l", tuple(REST_L + Wl - P_))
        A.ik(s_ + tt_, "IK_foot_r", tuple(REST_R + Wr - P_))
    kst += 1
A.place(d0 - 1, step_pos(kst) + Vector((0, 0.05, 0)), 0, constant=False)
# piano follows a bit behind (slides up the stairs with each yank) - slips back on "ton"
TON = F(words[15]["start"])
for i, f in enumerate(pulls):
    kk = min(K0 + i // 3, kst)
    yb = step_pos(kk).y - 1.45 + (i % 3) * 0.06
    if f >= TON - 2:
        yb -= 0.56                                   # slips two steps back
    key_obj(pianoH, f, loc=piano_on_slope(yb))
    key_obj(pianoH, f + 6, loc=piano_on_slope(yb + 0.05))
# stumble forward on the slip
A.spine(TON + 2, 34, 0, 6); A.head(TON + 2, 14, 0, 0)
# faces: effort / panting
A.face(a0, "serious", 1.0, extra={"jawOpen": 0.25, "browDownLeft": 0.8, "browDownRight": 0.8, "eyeSquintLeft": 0.8, "eyeSquintRight": 0.8,
                                  "mouthStretchLeft": 0.5, "mouthStretchRight": 0.5})
for f in pulls:
    if f < d0:
        A.face(f + 6, "serious", 1.0, extra={"jawOpen": 0.35, "browDownLeft": 0.9, "browDownRight": 0.9, "eyeBlinkLeft": 0.6,
                                             "eyeBlinkRight": 0.6, "mouthStretchLeft": 0.7, "mouthStretchRight": 0.7, "cheekPuff": 0.2})
        A.face(f + 11, "serious", 1.0, extra={"jawOpen": 0.2, "browDownLeft": 0.7, "browDownRight": 0.7, "eyeSquintLeft": 0.9,
                                              "eyeSquintRight": 0.9, "mouthStretchLeft": 0.4, "mouthStretchRight": 0.4})
A.face(TON, "shocked", 1.0)
# 03: back pain
A.spine(d0, -10, 0, -4); A.head(d0, -6, 0, -4)
A.hands(d0, r=(-0.12, 0.16, 1.02), l=(0.13, -0.32, 0.92), er=(-0.38, 0.32, 1.15), el=(0.4, 0.15, 1.0))
A.face(d0, "tired", 1.0, extra={"eyeSquintLeft": 0.9, "eyeSquintRight": 0.9, "mouthStretchLeft": 0.8, "mouthStretchRight": 0.8,
                                "browInnerUp": 1.0, "jawOpen": 0.2})
A.spine(d1 - 1, -14, 0, -6); A.head(d1 - 1, -12, 0, -6)
A.pelvis(d0, (0, 0, 0))
# sweat drops from forehead in the tight shots
for i, f in enumerate(range(a0 + 8, c0_, 9)):
    p = Vector(rig.matrix_world.translation)
    fx.droplet(f"Sweat_{i}", C_fx, step_pos(K0 + i // 4) + Vector((R.uniform(-0.08, 0.08), -0.12, 1.62)),
               (R.uniform(-0.3, 0.3), -0.4, R.uniform(0.3, 0.8)), f, f + 14, size=0.0055)
vis(pianoH, [(1, d1 + 1)])
vis(strap, [(1, d1 + 1)])


def fx_star(name, loc, f, face_pt, size=0.12, mat=None):
    """Comic impact star (flat, emissive) popping in at frame f, facing face_pt."""
    bmS = bmesh.new()
    vs_ = []
    for k in range(16):
        r_ = size if k % 2 == 0 else size * 0.42
        a_ = math.pi * 2 * k / 16
        vs_.append(bmS.verts.new((r_ * math.cos(a_), r_ * math.sin(a_), 0)))
    bmS.faces.new(vs_)
    ob = lib.mesh_from_bmesh(name, bmS, C_fx, smooth=False)
    lib.assign(ob, mat or lib.mat("M_Star", "#FFE14D", emit="#FFD21F", emit_strength=3.0))
    ob.location = loc
    ob.rotation_euler = (Vector(face_pt) - Vector(loc)).to_track_quat('Z', 'Y').to_euler()
    ob.visible_shadow = False
    vis(ob, [(f, f + 9)])
    key_obj(ob, f, scale=0.0); key_obj(ob, f + 2, scale=1.3); key_obj(ob, f + 5, scale=1.0); key_obj(ob, f + 9, scale=0.0)
    return ob


# 03: "crack!" - comic impact star at his lower back, synced with the crack SFX (d0 + 3)
sc.frame_set(d0 + 3)
sp1_ = rig.matrix_world @ rig.pose.bones["spine_01"].head
H3_ = step_pos(K0 + 3)
fx_star("CrackStar", sp1_ + Vector((0.2, 0.12, 0.02)), d0 + 3, (SX + 1.2, H3_.y - 1.6, H3_.z + 1.3), 0.11)
fx_star("CrackStar2", sp1_ + Vector((0.24, 0.16, 0.14)), d0 + 5, (SX + 1.2, H3_.y - 1.6, H3_.z + 1.3), 0.06)

# ================================================================== SHOT 04-05: rope from the roof
e0, e1 = S["04a"]; g0, g1 = S["04b"]; h0, h1 = S["05a"]; i0, i1 = S["05b"]
# 04a: he ties a rope around the piano on the sidewalk
PIANO_WALL = Vector((LOAD_X, -0.48, 0.0))
key_obj(piano, 1, loc=PIANO_WALL, rot=(0, 0, 0))
A.place(e0, (LOAD_X + 0.95, -1.15, 0), 120)
A.spine(e0, 22); A.head(e0, 18, 0, 0)
for j, f in enumerate(range(e0, e1, 6)):
    sg = 1 if j % 2 == 0 else -1
    A.hands(f, l=(0.12 + 0.06 * sg, -0.48, 1.08), r=(-0.12 + 0.06 * sg, -0.5, 1.12), el=(0.45, 0.1, 1.05), er=(-0.45, 0.1, 1.05))
A.face(e0, "serious", 1.0)
A.fingers(e0, "l", 60); A.fingers(e0, "r", 60)
vis(rope_h, [(e0, i0)])
# 04b + 05a: on the roof, pulling hand over hand; piano rises along facade
A.place(g0, (LOAD_X, 0.55, ROOF_Z), 0)
A.spine(g0, 18); A.head(g0, 22, 0, 0)
A.face(g0, "serious", 1.0, extra={"jawOpen": 0.2, "mouthStretchLeft": 0.6, "mouthStretchRight": 0.6})
rise_top = 6.2
for j, f in enumerate(range(g0, i0, 8)):
    u = (f - g0) / max(1, (i0 - g0))
    z = rise_top * u
    key_obj(piano, f, loc=PIANO_WALL + Vector((0, 0, z)), rot=(0, 0, 3 * math.sin(j)))
    hi = j % 2
    A.hands(f, l=(0.1, -0.35, 1.45 if hi else 1.05), r=(-0.1, -0.35, 1.05 if hi else 1.45), el=(0.45, 0.2, 1.1), er=(-0.45, 0.2, 1.1))
    # rope comes up from the piano through the lower hand INTO the upper hand (switch as the hands cross)
    up_ = "toHandL" if hi else "toHandR"
    ff_ = g0 if j == 0 else f - 4
    infl(rope_h, "toHands", ff_, 0.0); infl(rope_h, up_, ff_, 1.0); infl(rope_h, "toHandR" if up_ == "toHandL" else "toHandL", ff_, 0.0)
    A.spine(f, 18 + 6 * hi)
A.face(h0, "proud", 0.9)
# 05b: rope burn close-up, piano drops (off screen)
# "look at my hands!": forearms up, palms to camera (wrist angles solved numerically, see solve_palms.py)
A.hands(i0, l=(0.13, -0.3, 1.34), r=(-0.13, -0.3, 1.34), el=(0.3, -0.02, 0.98), er=(-0.3, -0.02, 0.98))
A.wrist(i0, "l", -40, 130, 0); A.wrist(i0, "r", -40, -120, 0)
A.fingers(i0, "l", 14, thumb=-6); A.fingers(i0, "r", 14, thumb=-6)
A.spine(i0, 2); A.head(i0, 4, 0, 0)
A.face(i0, "disgusted", 0.7, extra={"eyeWideLeft": 0.7, "eyeWideRight": 0.7, "jawOpen": 0.4, "mouthFunnel": 0.5})
for j, f in enumerate(range(i0 + 6, i1, 4)):
    sg = 1 if j % 2 == 0 else -1
    A.hands(f, l=(0.13 + 0.01 * sg, -0.3, 1.34 + 0.015 * sg), r=(-0.13 - 0.01 * sg, -0.3, 1.34 - 0.015 * sg))
key_obj(piano, i0, loc=PIANO_WALL + Vector((0, 0, rise_top)))
key_obj(piano, i0 + 8, loc=PIANO_WALL + Vector((0, 0, 0)))
infl(rope_h, "toHands", i0, 1.0); infl(rope_h, "toHandL", i0, 0.0); infl(rope_h, "toHandR", i0, 0.0)
infl(rope_h, "toHandL", 1, 0.0); infl(rope_h, "toHandR", 1, 0.0); infl(rope_h, "toHands", 1, 1.0)
# burn marks on palms
burn_m = lib.mat("M_Burn", "#A8222A", rough=0.55, emit="#D02A33", emit_strength=0.15)
for side in ("l", "r"):
    for k2 in range(3):
        bm_ = lib.box(f"Burn_{side}{k2}", ((0.05, 0.043, 0.034)[k2], 0.008, 0.003), (0, 0, 0), C_fx); lib.assign(bm_, burn_m)
        bm_.parent = rig; bm_.parent_type = 'BONE'; bm_.parent_bone = f"hand_{side}"
        # hand bone is short (3.7 cm): the palm spans y -0.03..0.08 past its tail, palm surface at +z 0.032 (dbg_palm.py)
        bm_.location = ((0.012 if side == "l" else -0.012), 0.004 + 0.021 * k2, 0.0335)
        bm_.rotation_euler = (0, 0, math.radians((10, 17, 13)[k2] * (1 if side == "l" else -1)))
        vis(bm_, [(i0, i1)])

# ================================================================== SHOT 06-08: wheel, clever, pulling down
j0, j1 = S["06"]; k0, k1 = S["07"]; l0, l1 = S["08a"]; m0, m1 = S["08b"]
PIANO_LOAD = Vector((LOAD_X, RY, 0.0))
key_obj(piano, j0, loc=PIANO_LOAD, rot=(0, 0, 0))
vis(wroot, [(j0, TOTAL + 10)])
key_obj(wroot, j0, scale=0.0); key_obj(wroot, j0 + 5, scale=1.15); key_obj(wroot, j0 + 8, scale=1.0)
vis([rope_l], [(j0 + 4, S["19"][0] + 4)])
vis([rope_c], [(j0 + 4, S["19"][0] + 4)])
infl(rope_l, "toPiano", 1, 1.0); infl(rope_l, "toCabin", 1, 0.0)
infl(rope_c, "toHands", 1, 1.0); infl(rope_c, "toRock", 1, 0.0); infl(rope_c, "toHandR", 1, 0.0); infl(rope_c, "toHang", 1, 0.0)
infl(rope_c, "toHands", S["07"][0], 0.0); infl(rope_c, "toHang", S["07"][0], 1.0)          # "Clever!": let go, rope hangs beside him
infl(rope_c, "toHands", S["08a"][0], 0.0); infl(rope_c, "toHang", S["08a"][0], 0.0); infl(rope_c, "toHandL", 1, 0.0)
# 08a hand-over-hand: the rope runs down through the upper hand INTO the lower hand (switch when the hands cross)
for j_, f_ in enumerate(range(S["08a"][0], S["08a"][1], 7)):
    low_ = "toHandR" if j_ % 2 else "toHandL"
    ff_ = S["08a"][0] if j_ == 0 else f_ - 3
    infl(rope_c, low_, ff_, 1.0); infl(rope_c, "toHandL" if low_ == "toHandR" else "toHandR", ff_, 0.0)
infl(rope_c, "toHandL", S["08b"][0], 0.0); infl(rope_c, "toHandR", S["08b"][0], 0.0); infl(rope_c, "toHands", S["08b"][0], 1.0)
# 07 clever: on the street holding counter rope
STREET = (CNT_X + 0.02, RY + 0.36, 0.0)
SIDE = (CNT_X + 0.3, RY + 0.02, 0.0)
A.place(j0, SIDE, 0)
A.wrist(j0, "l", 0, 0, 0); A.wrist(j0, "r", 0, 0, 0)          # undo the palms-out wrists of 05b
A.hands(j0, r=(-0.3, -0.02, 1.48), l=(0.27, -0.05, 0.86), er=(-0.5, 0.25, 1.15), el=(0.35, 0.3, 1.1))
A.spine(j0, 0); A.head(j0, -15, 0, 0)
A.face(j0, "serious", 1.0)
A.fingers(j0, "l", 75, thumb=35); A.fingers(j0, "r", 75, thumb=35)
A.face(k0, "grin", 1.0, extra={"eyeBlinkLeft": 0.95, "browOuterUpRight": 0.9})
# solved with solve_clever.py: left index tip on the temple (tap-tap), right hand thumbs-up
TEMPLE = Vector((0.244, -0.052, 1.648))
A.hands(k0, r=(-0.201, -0.336, 1.281), l=tuple(TEMPLE + Vector((0.03, -0.02, -0.03))), el=(0.62, 0.15, 1.35), er=(-0.45, 0.05, 1.0))
A.wrist(k0, "l", -22.6, 7.0, 18.2); A.wrist(k0, "r", -30.4, -28.5, -58.8)
for kk2, ft in enumerate(range(k0 + 4, k1, 4)):
    off = 0.0 if kk2 % 2 == 0 else 1.0
    A.hands(ft, l=tuple(TEMPLE + Vector((0.02, -0.01, -0.012)) * off))
A.fingers(k0, "r", 88, thumb=-5)
A.fingers(k0 + 2, "l", 82, thumb=35)
for bn in ("index_01_l", "index_02_l", "index_03_l"):
    A.rot(k0 + 2, bn, 0, 0, 0)
A.head(k0 + 4, -4, 0, 7)
A.place(l0, STREET, 0)
A.wrist(l0, "l", 0, 0, 0); A.wrist(l0, "r", 0, 0, 0)          # undo the temple-tap / thumbs-up wrists
# 08a pulling down hand over hand; piano rises a bit
for j, f in enumerate(range(l0, l1, 7)):
    hi = j % 2
    A.hands(f, l=(0.05, -0.3, 2.0 if hi else 1.45), r=(-0.05, -0.3, 1.45 if hi else 2.0), el=(0.45, 0.25, 1.4), er=(-0.45, 0.25, 1.4))
    z = 0.5 * (f - l0) / max(1, l1 - l0)
    key_obj(piano, f, loc=PIANO_LOAD + Vector((0, 0, z)))
    wheel_turn(f, z)
A.fingers(l0, "r", 75, thumb=35); A.fingers(l0, "l", 75, thumb=35)        # both fists on the rope (left had the temple-tap index out)
A.head(l0, -12, 0, 0); A.spine(l0, -4)
A.face(l0, "serious", 1.0, extra={"jawOpen": 0.3, "mouthStretchLeft": 0.7, "mouthStretchRight": 0.7})
# 08b he gets lifted instead
key_obj(piano, m0, loc=PIANO_LOAD + Vector((0, 0, 0.5)))
key_obj(piano, m0 + 6, loc=PIANO_LOAD)
A.place(m0, STREET, 0, constant=True)
A.place(m0 + 1, STREET, 0, constant=False)
A.place(m1 - 2, (STREET[0], STREET[1], 1.9), 0, constant=False)
A.hands(m0, l=(0.05, -0.25, 2.05), r=(-0.05, -0.25, 1.95))
A.face(m0 + 3, "shocked", 1.0)
for j, f in enumerate(range(m0, m1, 6)):
    sg = 1 if j % 2 == 0 else -1
    A.ik(f, "IK_foot_l", (0.2, -0.017 + 0.18 * sg, 0.12 + 0.08 * (sg > 0)))
    A.ik(f, "IK_foot_r", (-0.2, -0.017 - 0.18 * sg, 0.12 + 0.08 * (sg < 0)))
A.feet(m1)

# ================================================================== SHOT 09-11: rock, half work, swinging
n0, n1 = S["09"]; o0, o1 = S["10"]; p0, p1 = S["11"]
A.place(n0, (CNT_X + 0.9, RY - 0.25, 0), 20)
A.feet(n0)
A.hands(n0, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86), el=(0.35, 0.3, 1.1), er=(-0.35, 0.3, 1.1))
A.face(n0, "shocked", 1.0)
A.head(n0, -20, -20, 0)
ROCK_GROUND = Vector((CNT_X, RY, 0.0))
LAND = n0 + 8
key_obj(rock, n0, loc=ROCK_GROUND + Vector((0, 0, 7.0)))
key_obj(rock, LAND, loc=ROCK_GROUND)
for fc in lib.fcurves_of(rock):
    for kp in fc.keyframe_points:
        if abs(kp.co.x - n0) < 0.1:
            kp.interpolation = 'QUAD'; kp.easing = 'EASE_IN'
key_obj(rock, LAND + 2, loc=ROCK_GROUND + Vector((0, 0, 0.12)))
key_obj(rock, LAND + 5, loc=ROCK_GROUND)
vis(rock, [(n0, S["19"][0] + 4)])
infl(rope_c, "toHands", n0, 0.0); infl(rope_c, "toRock", n0, 1.0)
for i in range(3):
    pf = fx.poof(f"Dust9_{i}", C_fx, ROCK_GROUND + Vector((R.uniform(-0.6, 0.6), R.uniform(-0.6, 0.3), 0.1)), LAND, size=0.45, dur=14)
A.face(LAND + 4, "grin", 1.0)
A.head(LAND + 4, 0, -10, 0)
# then: dusts off his hands (two brushes) and goes hands-on-hips, proud nod
A.hands(LAND + 10, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86))
for c_, fc_ in enumerate((LAND + 14, LAND + 22)):
    A.hands(fc_, l=(0.06, -0.3, 1.12), r=(-0.06, -0.3, 1.16), el=(0.35, 0.05, 1.0), er=(-0.35, 0.05, 1.0))
    A.hands(fc_ + 4, l=(-0.04, -0.3, 1.16), r=(0.04, -0.3, 1.12))
A.fingers(LAND + 12, "l", 8, thumb=0); A.fingers(LAND + 12, "r", 8, thumb=0)
A.hands(LAND + 34, l=(0.21, 0.02, 1.0), r=(-0.21, 0.02, 1.0), el=(0.5, 0.1, 1.15), er=(-0.5, 0.1, 1.15))
A.fingers(LAND + 34, "l", 30, thumb=10); A.fingers(LAND + 34, "r", 30, thumb=10)
A.face(LAND + 34, "proud", 1.0)
A.head(LAND + 34, -6, -4, 0); A.head(LAND + 42, 8, -4, 0); A.head(LAND + 50, -4, -4, 0)
A.spine(LAND + 34, -6)
# 10: rock comes down, piano goes up, one-finger smugness
A.place(o0, (CNT_X + 0.75, RY - 0.55, 0), 15)
A.hands(o0, r=(-0.18, -0.38, 1.45), l=(0.2, 0.02, 1.0), er=(-0.45, 0.2, 1.2), el=(0.5, 0.1, 1.15))
A.fingers(o0, "r", 80, thumb=40)
for bn in ("index_01_r", "index_02_r", "index_03_r"):
    A.rot(o0, bn, 0, 0, 0)
A.face(o0, "smug", 1.0)
A.head(o0, -8, 0, 5)
for f in range(o0, o1 + 1, 3):
    u = (f - o0) / max(1, o1 - o0)
    zp = 0.4 + 1.6 * u
    key_obj(piano, f, loc=PIANO_LOAD + Vector((0, 0, zp)))
    key_obj(rock, f, loc=ROCK_GROUND + Vector((0, 0, 4.8 - 2.5 * u)))
    wheel_turn(f, zp)
# 11: swinging into the neighbour's windows (pivot = wheel load tangent point)
PIV = Vector((LOAD_X, RY, WHEEL.z))
pb0, pb1 = S["11b"]
hit1 = p0 + 8
hit2 = p0 + int((pb0 - p0) * 0.78)
near = pb0 + int((pb1 - pb0) * 0.6)
shards_m = bpy.data.materials.get("M_Shard") or lib.mat("M_Shard", "#DDEFF7", rough=0.05, emit="#EAF7FF", emit_strength=0.5, spec=1.0)


def piano_swing(f, top_z, theta_deg):
    L = PIV.z - top_z
    th = math.radians(theta_deg)
    x = PIV.x - L * math.sin(th)
    z = PIV.z - L * math.cos(th) - 1.21
    key_obj(piano, f, loc=(x, RY, z), rot=(0, theta_deg, 0))


swing = [(p0, 2.55, 0), (hit1 - 4, 2.55, 6.5), (hit1, 2.55, 8.3), (hit1 + 3, 2.6, 4.0), (hit1 + 10, 3.4, -5.0),
         (hit1 + 18, 4.6, 3.0), (hit2 - 4, 5.6, 9.0), (hit2, 5.85, 12.5), (hit2 + 4, 5.9, 6.0), (pb0, 6.0, -3.0),
         (pb0 + 10, 6.0, 4.0), (near - 4, 6.0, 9.5), (near, 6.0, 11.8), (near + 5, 6.0, 4.0), (pb1, 6.2, -2.0)]
for f, tz, th in swing:
    piano_swing(f, tz, th)
    wheel_turn(f, tz)
    key_obj(rock, f, loc=ROCK_GROUND + Vector((0, 0, max(0.3, 4.8 - 2.5 - (tz - 2.0)))))
for k3, (hf, pane) in enumerate(((hit1, "BreakPane_0"), (hit2, "BreakPane_1"))):
    pn = O[pane]
    vis(pn, [(1, hf)])
    c_ = pn.location
    for s_ in range(26):
        sh = lib.box(f"Shard_{k3}_{s_}", (0.01, R.uniform(0.06, 0.16), R.uniform(0.08, 0.2)), c_, C_fx)
        lib.assign(sh, shards_m); sh.visible_shadow = False
        p_start = c_ + Vector((0.02, R.uniform(-0.5, 0.5), R.uniform(-0.8, 0.8)))
        v = Vector((R.uniform(0.4, 1.8), R.uniform(-1.6, 0.4), R.uniform(0.2, 2.0)))
        for kk in range(0, 22, 2):
            tt = kk / 30
            pos = p_start + v * tt + Vector((0, 0, -4.9 * tt * tt))
            if pos.z < 0.02:
                pos.z = 0.02
            key_obj(sh, hf + kk, loc=pos, rot=(kk * 37 + s_ * 13, kk * 23, s_ * 41))
        vis(sh, [(hf, hf + 40)])
A.place(p0, (CNT_X + 1.0, RY - 0.9, 0), 25)
A.face(p0, "shocked", 1.0)
A.hands(p0, l=(0.2, -0.3, 1.5), r=(-0.2, -0.3, 1.5), el=(0.5, 0.2, 1.2), er=(-0.5, 0.2, 1.2))
A.fingers(p0, "l", 10); A.fingers(p0, "r", 10)
A.face(hit2 + 2, "disgusted", 0.8, extra={"eyeWideLeft": 0.8, "eyeWideRight": 0.8})
for s_ in range(14):
    sh = lib.box(f"ShardNear_{s_}", (0.01, R.uniform(0.05, 0.12), R.uniform(0.06, 0.15)), (-4.98, RY, 5.25), C_fx)
    lib.assign(sh, shards_m); sh.visible_shadow = False
    p_start = Vector((-4.95, RY + R.uniform(-0.6, 0.6), 5.25 + R.uniform(-0.8, 0.8)))
    v = Vector((R.uniform(0.3, 1.2), R.uniform(-1.2, 0.3), R.uniform(0.0, 1.4)))
    for kk in range(0, 18, 2):
        tt = kk / 30
        key_obj(sh, near + kk, loc=p_start + v * tt + Vector((0, 0, -4.9 * tt * tt)), rot=(kk * 37, kk * 23, s_ * 41))
    vis(sh, [(near, near + 20)])

# ================================================================== SHOT 12-15: shaft, box, ride, dead arms
q0, q1 = S["12"]; r0, r1 = S["13"]; s0, s1 = S["14"]; t0_, t1_ = S["15"]
piano_swing(q0, 4.0, 0)
key_obj(piano, q0, loc=(LOAD_X, RY, 2.0), rot=(0, 0, 0))
for k4, st in enumerate(stages):
    fs = q0 + 3 + k4 * 4
    vis(st, [(fs, S["19"][0] + 4)])
    key_obj(st, fs, scale=(1, 1, 0.0)); key_obj(st, fs + 4, scale=(1, 1, 1.08)); key_obj(st, fs + 6, scale=(1, 1, 1.0))
    fx.poof(f"Dust12_{k4}", C_fx, Vector((LOAD_X + R.uniform(-1, 1), RY + R.uniform(-1, 1), st.location.z + 0.1)), fs + 2, size=0.35, dur=10)
A.place(q0, (CNT_X + 1.3, RY - 1.6, 0), 30)
A.hands(q0, **dict(l=(-0.1, -0.21, 1.22), r=(0.11, -0.23, 1.18), el=(0.35, -0.15, 1.05), er=(-0.35, -0.15, 1.05)))
A.face(q0, "proud", 1.0)
A.head(q0, -18, -18, 0)
# 13: box arrives, he nails rope to box roof
key_obj(piano, r0, loc=(LOAD_X - 0.2, RY + 0.25, 0.12), rot=(0, 0, 90))
vis(cabin, [(r0, S["19"][0] + 4)])
key_obj(cabin, 1, loc=(LOAD_X, RY, 0.0))
key_obj(cabin, r0, loc=(LOAD_X, RY, 0.0))
infl(rope_l, "toPiano", r0, 0.0); infl(rope_l, "toCabin", r0, 1.0)
A.place(r0, (LOAD_X + 0.42, RY - 0.25, 2.36), 0)
A.spine(r0, 30); A.head(r0, 25, 0, 0)
nail_pt = Vector((0.0, -0.42 + 0.25, 0.25))
hammer.parent = rig; hammer.parent_type = 'BONE'; hammer.parent_bone = "hand_r"
hammer.location = (0.0, 0.02, 0.0); hammer.rotation_euler = (math.radians(90), 0, math.radians(90)); hammer.scale = (1.3, 1.3, 1.3)
vis(hammer, [(r0, r1)])
for j, f in enumerate(range(r0, r1, 8)):
    A.hands(f, r=(-0.18, -0.3, 1.25), l=(0.08, -0.45, 0.72), er=(-0.5, 0.25, 1.1), el=(0.4, 0.1, 0.9))
    A.hands(f + 5, r=(-0.1, -0.5, 0.9))
    A.wrist(f, "r", 0, 0, 0); A.wrist(f + 5, "r", 40, 0, 0)
A.fingers(r0, "r", 80, thumb=40)
A.face(r0, "serious", 1.0, extra={"mouthPressLeft": 0.8, "mouthPressRight": 0.8})
# 14: ride up inside the box (with piano), rock goes down
A.place(s0, (LOAD_X + 0.42, RY + 0.1, 0.12), 0)
A.wrist(s0, "r", 0, 0, 0)                                      # end of hammering
A.spine(s0, -2); A.head(s0, -6, 0, 0)
A.hands(s0, l=(0.42, -0.14, 2.0), r=(-0.27, -0.05, 0.86), el=(0.6, 0.2, 1.5), er=(-0.35, 0.3, 1.1))
A.face(s0, "grin", 1.0)
for j, f in enumerate(range(s0, s1 + 1, 2)):
    u = (f - s0) / max(1, s1 - s0)
    zc = 4.2 * (u * u * (3 - 2 * u))
    key_obj(cabin, f, loc=(LOAD_X, RY, zc))
    key_obj(piano, f, loc=(LOAD_X - 0.2, RY + 0.25, 0.12 + zc), rot=(0, 0, 90))
    A.place(f, (LOAD_X + 0.42, RY + 0.1, 0.12 + zc), 0, constant=False)
    key_obj(rock, f, loc=ROCK_GROUND + Vector((0, 0, max(0.4, 6.0 - zc))))
    wheel_turn(f, zc + 4)
    A.hands(f, l=(0.42 + 0.05 * math.sin(f * 0.6), -0.14, 2.0))
# 15: arms are dead (box stuck mid-way)
ZC = 4.2
A.place(t0_, (LOAD_X + 0.42, RY + 0.1, 0.12 + ZC), 0)
A.hands(t0_, l=(0.25, -0.02, 0.8), r=(-0.25, -0.02, 0.8), el=(0.3, 0.3, 1.1), er=(-0.3, 0.3, 1.1))
A.clav(t0_, "l", up=-6); A.clav(t0_, "r", up=-6)
A.spine(t0_, 14); A.head(t0_, 22, 0, 6)
A.face(t0_, "tired", 1.0, extra={"eyeBlinkLeft": 0.6, "eyeBlinkRight": 0.6, "jawOpen": 0.25})
# noodle arms: weak attempt to lift them... FLOP, bounce, limp pendulum sway
A.hands(t0_ + 6, l=(0.22, -0.18, 0.98), r=(-0.22, -0.18, 0.98))
A.hands(t0_ + 13, l=(0.2, -0.27, 1.1), r=(-0.2, -0.27, 1.1))
A.face(t0_ + 8, "tired", 1.0, extra={"browInnerUp": 0.9, "jawOpen": 0.1, "mouthStretchLeft": 0.6, "mouthStretchRight": 0.6})
A.hands(t0_ + 15, l=(0.205, -0.26, 1.09), r=(-0.195, -0.28, 1.11))               # tremble
A.hands(t0_ + 18, l=(0.27, 0.03, 0.73), r=(-0.27, 0.03, 0.73), el=(0.32, 0.32, 1.06), er=(-0.32, 0.32, 1.06))   # FLOP
A.clav(t0_ + 18, "l", up=-11); A.clav(t0_ + 18, "r", up=-11)
A.head(t0_ + 18, 34, 0, 6); A.spine(t0_ + 18, 20)
A.face(t0_ + 18, "tired", 1.0, extra={"eyeBlinkLeft": 0.75, "eyeBlinkRight": 0.75, "jawOpen": 0.35})
A.hands(t0_ + 21, l=(0.27, -0.04, 0.8), r=(-0.27, -0.04, 0.8))
for k6, f in enumerate(range(t0_ + 24, t1_, 6)):
    amp = 0.06 * (0.7 ** k6); sg = 1 if k6 % 2 == 0 else -1
    A.hands(f, l=(0.27, -0.01 + amp * sg, 0.76), r=(-0.27, -0.01 - amp * sg, 0.76))
A.head(t0_ + 30, 26, 0, 6)

# ================================================================== SHOT 16-19: motor, button, arrive, modern
u0, u1 = S["16"]; v0, v1 = S["17a"]; x0, x1 = S["17b"]; y0, y1 = S["18"]; z0, z1 = S["19"]
mloc = motor.location.copy()
vis(motor, [(u0, z0 + 4)])
vis(belt, [(u0 + 10, z0 + 4)])
key_obj(motor, u0, loc=mloc + Vector((0, 0, 3.0)))
key_obj(motor, u0 + 7, loc=mloc)
for fc in lib.fcurves_of(motor):
    for kp in fc.keyframe_points:
        if abs(kp.co.x - u0) < 0.1:
            kp.interpolation = 'QUAD'; kp.easing = 'EASE_IN'
key_obj(motor, u0 + 9, loc=mloc + Vector((0, 0, 0.06)))
key_obj(motor, u0 + 11, loc=mloc)
for f in range(u0 + 14, z0, 2):
    key_obj(motor, f, loc=mloc + Vector((R.uniform(-0.004, 0.004), R.uniform(-0.004, 0.004), 0)))
# 17a: press the button (inside the cabin, right panel) - button + panel only exist once the motor is hooked up
btn = O["Cabin_button"]
vis([btn, O["Cabin_panel"]], [(u0, TOTAL + 10)], children=False)
for o_ in (btn, O["Cabin_panel"]):
    lib.hide_key(o_, r0, True)                                   # override the cabin's own "visible from r0" key
A.place(v0, (LOAD_X + 0.1, RY + 0.15, 0.12 + ZC), 0)
A.spine(v0, 4); A.head(v0, 10, -25, 0)
A.face(v0, "smug", 1.0)
bpos_local = Vector((1.7 / 2 - 0.2, -1.7 / 2 + 0.3, 1.2))
press = W(bpos_local.x - 0.1 - 0.1, bpos_local.y - (RY + 0.15 - RY), bpos_local.z)
A.hands(v0, l=(0.3, -0.3, 1.15), r=(-0.27, -0.05, 0.86), el=(0.55, 0.1, 1.0))
A.hands(v0 + 8, l=(0.42, -0.52, 1.1))
A.hands(v0 + 11, l=(0.46, -0.56, 1.09))
A.hands(v0 + 18, l=(0.44, -0.54, 1.1))
A.fingers(v0, "l", 80, thumb=40)
for bn in ("index_01_l", "index_02_l", "index_03_l"):
    A.rot(v0, bn, 0, 0, 0)
key_obj(btn, v0 + 10, loc=btn.location.copy())
key_obj(btn, v0 + 11, loc=btn.location + Vector((-0.02, 0, 0)))
key_obj(btn, v0 + 16, loc=btn.location.copy())
# 17b: box zooms up and down, arrows
zz = [(x0, ZC), (x0 + 8, 7.4), (x0 + 15, 1.0), (x0 + 22, 7.4), (x0 + 29, 2.0), (x1 - 1, 7.2)]
for f, zc in zz:
    key_obj(cabin, f, loc=(LOAD_X, RY, zc))
    key_obj(piano, f, loc=(LOAD_X - 0.2, RY + 0.25, 0.12 + zc), rot=(0, 0, 90))
    A.place(f, (LOAD_X + 0.1, RY + 0.15, 0.12 + zc), 0, constant=False)
    key_obj(rock, f, loc=ROCK_GROUND + Vector((0, 0, max(0.4, 8.2 - zc))))
    wheel_turn(f, zc + 4)
A.face(x0, "grin", 1.0, extra={"jawOpen": 0.5, "eyeWideLeft": 0.6, "eyeWideRight": 0.6})
A.hands(x0, l=(0.42, -0.14, 2.0), r=(-0.42, -0.14, 2.0), el=(0.6, 0.2, 1.5), er=(-0.6, 0.2, 1.5))
ym = lib.mat("M_ArrowY", "#F2D16B", rough=0.4, emit="#F2D16B", emit_strength=0.8)
for k5, (nm, rotz, dz) in enumerate((("ArrowUp", 0, 1), ("ArrowDown", 180, -1))):
    bmA = bmesh.new()
    pts = [(-0.18, 0, -0.3), (0.18, 0, -0.3), (0.18, 0, 0.05), (0.38, 0, 0.05), (0, 0, 0.45), (-0.38, 0, 0.05), (-0.18, 0, 0.05)]
    vv = [bmA.verts.new(p) for p in pts]
    bmA.faces.new(vv)
    ao = lib.mesh_from_bmesh(nm, bmA, C_fx, smooth=False)
    sol = ao.modifiers.new("S", 'SOLIDIFY'); sol.thickness = 0.08
    lib.assign(ao, ym); ao.visible_shadow = False
    ao.location = (LOAD_X + 1.55, RY - 1.2, 5.0 + 1.2 * dz)
    ao.rotation_euler = (0, math.radians(rotz), 0)
    vis(ao, [(x0 + (0 if dz > 0 else 8), x1)])
    key_obj(ao, x0, scale=0.0) if dz > 0 else None
    key_obj(ao, x0 + 4 + (0 if dz > 0 else 8), scale=1.0)
# 18: arrived at the top, ding
yb0, yb1 = S["18b"]
for f in (y0, y1, yb1 - 1):                       # yb1 == z0 (shot 19 re-places him on the street at that frame)
    key_obj(cabin, f, loc=(LOAD_X, RY, 7.2))
    key_obj(piano, f, loc=(LOAD_X - 0.2, RY + 0.25, 7.32), rot=(0, 0, 90))
    A.place(f, (LOAD_X + 0.1, RY + 0.15, 7.32), 0, constant=False)
A.face(y0, "grin", 1.0)
A.hands(y0, l=(0.27, -0.2, 1.05), r=(-0.3, -0.35, 1.55), el=(0.35, 0.3, 1.1), er=(-0.5, 0.0, 1.3))
A.fingers(y0, "r", 90, thumb=60)
A.hands(y0 + 8, r=(-0.25, -0.3, 1.8)); A.hands(y0 + 14, r=(-0.3, -0.35, 1.55)); A.hands(y0 + 20, r=(-0.25, -0.3, 1.8))
star_m = lib.mat("M_Sparkle", "#FFFFFF", emit="#FFFFFF", emit_strength=6.0)
for i in range(5):
    fsp = y0 + 3 + i * 5
    bm_star = bmesh.new()
    vs = []
    for kk in range(8):
        aa = math.pi * kk / 4
        rr = 1.0 if kk % 2 == 0 else 0.25
        vs.append(bm_star.verts.new((rr * math.cos(aa), 0, rr * math.sin(aa))))
    bm_star.faces.new(vs)
    stx = lib.mesh_from_bmesh(f"Sparkle_{i}", bm_star, C_fx, smooth=False)
    lib.assign(stx, star_m); stx.visible_shadow = False
    stx.location = (LOAD_X + R.uniform(-0.9, 0.9), RY - 1.0, 7.4 + R.uniform(0.2, 2.2))
    key_obj(stx, fsp, scale=0.0); key_obj(stx, fsp + 4, scale=0.12); key_obj(stx, fsp + 9, scale=0.0)
    vis(stx, [(fsp, fsp + 10)])
# 18b: callback to the opening - same mouth+chest framing ("You finally got it up."), now a relieved, proud exhale
A.hands(yb0, l=(0.21, 0.02, 1.0), r=(-0.21, 0.02, 1.0), el=(0.5, 0.1, 1.15), er=(-0.5, 0.1, 1.15))
A.fingers(yb0, "l", 30, thumb=10); A.fingers(yb0, "r", 30, thumb=10)
A.spine(yb0, -3); A.head(yb0, -4, 0, 0)
A.face(yb0, "neutral", 1.0, extra={"mouthPucker": 0.7, "cheekPuff": 0.6, "jawOpen": 0.08})            # "phewww"
A.clav(yb0 + 2, "l", up=7); A.clav(yb0 + 2, "r", up=7); A.spine(yb0 + 2, -7)                          # big breath in
A.face(yb0 + 9, "grin", 1.0, extra={"jawOpen": 0.05})
A.clav(yb0 + 14, "l", up=-2); A.clav(yb0 + 14, "r", up=-2); A.spine(yb0 + 14, -4)                       # ...and out
A.face(yb1 - 4, "grin", 1.0, extra={"jawOpen": 0.05, "mouthSmileLeft": 1.0, "mouthSmileRight": 1.0})
A.clav(yb1 - 1, "l", up=0); A.clav(yb1 - 1, "r", up=0)
# 19: poof -> modern elevator; doors open; him + piano inside; confetti
big = fx.poof("BigPoof19", C_fx, (LOAD_X, RY - 1.0, 2.5), z0 + 1, size=3.0, dur=12)
vis(modern, [(z0 + 3, TOTAL + 10)])
key_obj(modern, z0 + 3, scale=0.0); key_obj(modern, z0 + 7, scale=1.05); key_obj(modern, z0 + 10, scale=1.0)
dl = O["Mod_doorL"]; dr = O["Mod_doorR"]
key_obj(dl, z0 + 10, loc=dl.location.copy()); key_obj(dl, z0 + 22, loc=dl.location + Vector((-0.95, 0, 0)))
key_obj(dr, z0 + 10, loc=dr.location.copy()); key_obj(dr, z0 + 22, loc=dr.location + Vector((0.95, 0, 0)))
MOD = modern.location
A.place(z0, (MOD.x + 0.45, MOD.y + 0.95, 0.06), 0)
key_obj(piano, z0, loc=(MOD.x - 0.5, MOD.y + 1.25, 0.06), rot=(0, 0, 90))
A.feet(z0)
A.hands(z0, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86), el=(0.35, 0.3, 1.1), er=(-0.35, 0.3, 1.1))
A.hands(z0 + 18, l=(0.42, -0.14, 2.0), r=(-0.42, -0.14, 2.0), el=(0.6, 0.2, 1.5), er=(-0.6, 0.2, 1.5))
A.face(z0 + 16, "grin", 1.0, extra={"jawOpen": 0.3})
A.head(z0 + 18, -10, 0, 0); A.spine(z0 + 18, -6)
A.fingers(z0 + 18, "l", 10); A.fingers(z0 + 18, "r", 10)
for k6, f in enumerate(range(z0 + 26, TOTAL + 1, 9)):
    sg = 1 if k6 % 2 == 0 else -1
    A.hands(f, l=(0.42, -0.14, 2.0 + 0.04 * sg), r=(-0.42, -0.14, 2.0 - 0.04 * sg))
for o in [cabin] + stages:
    pass
conf_cols = ["#E63946", "#F4D35E", "#3A86FF", "#2BA84A", "#FF7F11", "#9B5DE5", "#F15BB5"]
cmats = [lib.mat(f"M_Conf{i}", c_, rough=0.5, emit=c_, emit_strength=0.4) for i, c_ in enumerate(conf_cols)]
for i in range(80):
    bmc = bmesh.new(); bmesh.ops.create_grid(bmc, x_segments=1, y_segments=1, size=1.0)
    co = lib.mesh_from_bmesh(f"Confetti_{i}", bmc, C_fx, smooth=False)
    co.data.materials.append(cmats[i % len(cmats)]); co.scale = (0.02, 0.035, 1); co.visible_shadow = False
    fst = z0 + 6 + R.randint(0, 16)
    x = MOD.x + R.uniform(-2.0, 2.0); y = MOD.y + R.uniform(-2.5, 0.3); z_ = R.uniform(3.0, 4.5)
    for f in range(fst, TOTAL + 2, 3):
        tt = (f - fst) / 30
        key_obj(co, f, loc=(x + 0.08 * math.sin(tt * 5 + i), y, max(0.02, z_ - 0.8 * tt)), rot=(tt * 400 + i * 20, tt * 260, i * 37))
    vis(co, [(fst, TOTAL + 10)])

# ================================================================== GRANDMA + NEIGHBOUR
G = Actor(O["Grandma"]); NB_ = Actor(O["Neighbour"])
G.feet(1); NB_.feet(1)
vis([O["Grandma"]], [(g0, i0), (y0, y1), (z0, TOTAL + 10)])
vis([O["Neighbour"]], [(pb0, pb1)])
# roof: impatient pointing down at the piano
G.place(g0, (LOAD_X + 0.85, 0.8, ROOF_Z), -10)
G.hands(g0, r=(-0.22, -0.6, 1.05), l=(0.2, 0.02, 1.0), er=(-0.45, 0.1, 1.2), el=(0.5, 0.1, 1.15))
G.fingers(g0, "r", 80, thumb=40)
for bn in ("index_01_r", "index_02_r", "index_03_r"):
    G.rot(g0, bn, 0, 0, 0)
G.fingers(g0, "l", 30)
G.spine(g0, 12); G.head(g0, 26, 0, 0)
G.face(g0, "serious", 1.0, extra={"browDownLeft": 0.9, "browDownRight": 0.9, "mouthPressLeft": 0.8, "mouthPressRight": 0.8})
for j_, f in enumerate(range(g0, i0, 9)):
    G.hands(f, r=(-0.22, -0.6, 1.05 + (0.08 if j_ % 2 else 0.0)))
G.place(h0, (LOAD_X + 0.55, 1.45, ROOF_Z), -30)                 # 05a: behind him, visible from the side camera
# top: clapping as the box arrives
G.place(y0, (LOAD_X + 1.95, 0.15, ROOF_Z), 15)
G.spine(y0, 22); G.head(y0, 26, 0, 0)
G.face(y0, "grin", 1.0)
for j_, f in enumerate(range(y0, y1, 5)):
    w_ = 0.05 if j_ % 2 else 0.17
    G.hands(f, l=(w_, -0.38, 1.22), r=(-w_, -0.38, 1.22), el=(0.4, 0.1, 1.0), er=(-0.4, 0.1, 1.0))
G.fingers(y0, "l", 10); G.fingers(y0, "r", 10)
# finale: inside the elevator cheering
G.place(z0, (MOD.x - 0.25, MOD.y + 0.7, 0.06), 0)
G.spine(z0, -4); G.head(z0, -10, 0, 0)
G.face(z0 + 16, "grin", 1.0, extra={"jawOpen": 0.35})
G.hands(z0, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86))
G.hands(z0 + 20, l=(0.38, -0.12, 1.85), r=(-0.38, -0.12, 1.85), el=(0.55, 0.2, 1.4), er=(-0.55, 0.2, 1.4))
for k6, f in enumerate(range(z0 + 28, TOTAL + 1, 8)):
    sg = 1 if k6 % 2 == 0 else -1
    G.hands(f, l=(0.38, -0.12, 1.85 - 0.05 * sg), r=(-0.38, -0.12, 1.85 + 0.05 * sg))
# angry neighbour leaning out of the smashed window, shaking his fist
NWZ = 3.3 + 1.815 - 0.875 - 0.95
NB_.place(pb0, (-6.4, -2.12, NWZ), -12)
NB_.spine(pb0, 54, 0, 0); NB_.head(pb0, -38, 24, 0)
NB_.pelvis(pb0, (0, -0.06, 0), bend=8)
NB_.hands(pb0, l=(0.26, -0.5, 0.98), el=(0.5, -0.2, 1.2), er=(-0.5, -0.3, 1.6))
NB_.face(pb0, "disgusted", 1.0, extra={"jawOpen": 0.6, "mouthFunnel": 0.2})
NB_.fingers(pb0, "r", 85, thumb=40)
NB_.place(near - 3, (-6.4, -2.18, NWZ), -12, constant=False)
NB_.place(near + 2, (-6.4, -1.5, NWZ - 0.2), -12, constant=False)
NB_.spine(near - 3, 54, 0, 0); NB_.head(near - 3, -38, 24, 0)
NB_.face(near - 1, "shocked", 1.0)
NB_.spine(near + 2, -10)
for j_, f in enumerate(range(pb0, near - 3, 4)):
    up = j_ % 2
    NB_.hands(f, r=(-0.22, -0.72, 1.5 + 0.12 * up))
    NB_.face(f, "disgusted", 1.0, extra={"jawOpen": 0.35 + 0.3 * up, "browDownLeft": 1.0, "browDownRight": 1.0})
# ...ducks the near miss, then pops right back out, even angrier
NB_.place(near + 9, (-6.4, -1.5, NWZ - 0.2), -12, constant=False)
NB_.place(near + 14, (-6.4, -2.14, NWZ), -12, constant=False)
NB_.spine(near + 9, -10); NB_.spine(near + 14, 58, 0, 0); NB_.head(near + 14, -40, 20, 0)
for j_, f in enumerate(range(near + 14, pb1, 3)):
    up = j_ % 2
    NB_.hands(f, r=(-0.22, -0.74, 1.52 + 0.14 * up))
    NB_.face(f, "disgusted", 1.0, extra={"jawOpen": 0.4 + 0.35 * up, "browDownLeft": 1.0, "browDownRight": 1.0, "noseSneerLeft": 1.0})
polish.life_noise(O["Grandma"], k=0.8, seed=31)
polish.life_noise(O["Neighbour"], k=0.8, seed=32)

# ================================================================== CAMERAS
def CAM(n, loc, tgt, lens, loc2=None, tgt2=None):
    f0c, f1c = S[n]
    cam = make_cam("CAM_" + n, loc, tgt, lens, f0c, sc, C_cam)
    if loc2 is not None:
        cam_move(cam, f0c, f1c - 1, loc, tgt, loc2, tgt2 or tgt, lens, lens)
    return cam


H0 = step_pos(K0) + Vector((0, 0.05, 0))
cams = {}
H0b = step_pos(K0 + 1)
cams["01a"] = CAM("01a", (SX + 0.12, H0.y - 1.05, H0.z + 1.38), (SX, H0.y - 0.1, H0.z + 1.42), 40,
                  (SX + 0.1, H0b.y - 0.95, H0b.z + 1.4), (SX, H0b.y - 0.1, H0b.z + 1.44))
H1 = step_pos(K0 + 1)
cams["01b"] = CAM("01b", (SX - 0.3, H1.y - 0.85, H1.z + 1.45), (SX, H1.y - 0.1, H1.z + 1.5), 48,
                  (SX - 0.27, H1.y - 0.78, H1.z + 1.46), (SX, H1.y - 0.1, H1.z + 1.5))
H2 = step_pos(K0 + 2)
cams["02"] = CAM("02", (SX + 4.2, H2.y - 1.6, H2.z + 1.0), (SX, H2.y - 0.6, H2.z + 0.4), 24,
                 (SX + 4.0, H2.y - 1.4, H2.z + 1.0), (SX, H2.y - 0.5, H2.z + 0.4))
H3 = step_pos(K0 + 3)
cams["03"] = CAM("03", (SX + 1.2, H3.y - 1.6, H3.z + 1.3), (SX, H3.y + 0.05, H3.z + 1.1), 32,
                 (SX + 1.1, H3.y - 1.45, H3.z + 1.3), (SX, H3.y + 0.05, H3.z + 1.1))
cams["04a"] = CAM("04a", (LOAD_X + 2.3, -2.3, 1.45), (LOAD_X + 0.45, -0.8, 0.95), 26, (LOAD_X + 2.15, -2.15, 1.43), (LOAD_X + 0.45, -0.8, 0.95))   # his front + harnessed piano
cams["04b"] = CAM("04b", (LOAD_X + 2.2, -6.5, 1.2), (LOAD_X, -0.4, 6.0), 22, (LOAD_X + 2.0, -6.2, 1.2), (LOAD_X, -0.4, 6.4))
cams["05a"] = CAM("05a", (LOAD_X - 1.6, -0.5, ROOF_Z + 1.6), (LOAD_X + 0.4, 0.75, ROOF_Z + 1.08), 26,
                  (LOAD_X - 1.48, -0.42, ROOF_Z + 1.58), (LOAD_X + 0.4, 0.75, ROOF_Z + 1.08))
cams["05b"] = CAM("05b", (LOAD_X + 0.08, -0.5, ROOF_Z + 1.52), (LOAD_X, 0.45, ROOF_Z + 1.44), 38,
                  (LOAD_X + 0.08, -0.42, ROOF_Z + 1.52), (LOAD_X, 0.45, ROOF_Z + 1.44))
cams["06"] = CAM("06", (WHEEL.x + 1.3, -3.6, 8.9), (WHEEL.x, RY, WHEEL.z + 0.1), 30, (WHEEL.x + 1.2, -3.4, 8.95), (WHEEL.x, RY, WHEEL.z + 0.1))
cams["07"] = CAM("07", (CNT_X + 0.55, RY - 1.75, 1.62), (CNT_X + 0.3, RY + 0.02, 1.58), 42, (CNT_X + 0.53, RY - 1.65, 1.62), (CNT_X + 0.3, RY + 0.02, 1.58))
cams["08a"] = CAM("08a", (CNT_X + 1.4, RY - 3.0, 1.4), (CNT_X - 0.6, RY, 1.3), 26, (CNT_X + 1.3, RY - 2.85, 1.4), (CNT_X - 0.6, RY, 1.3))
cams["08b"] = CAM("08b", (CNT_X + 1.2, RY - 5.2, 0.9), (CNT_X - 0.7, RY, 2.2), 22, (CNT_X + 1.1, RY - 5.0, 0.95), (CNT_X - 0.7, RY, 2.4))
cams["09"] = CAM("09", (CNT_X + 2.4, RY - 4.2, 1.2), (CNT_X + 0.3, RY, 1.0), 24, (CNT_X + 2.3, RY - 4.0, 1.2), (CNT_X + 0.3, RY, 1.0))
cams["10"] = CAM("10", (CNT_X + 2.6, RY - 6.8, 1.1), (CNT_X - 0.9, RY, 3.4), 22, (CNT_X + 2.4, RY - 6.5, 1.15), (CNT_X - 0.9, RY, 3.6))
cams["11b"] = CAM("11b", (-4.6, -6.2, 3.6), (-5.7, -2.2, 5.3), 30, (-4.65, -5.95, 3.65), (-5.7, -2.2, 5.35))
cams["11"] = CAM("11", (LOAD_X + 3.4, RY - 6.2, 2.0), (LOAD_X - 0.9, RY, 4.0), 22, (LOAD_X + 3.2, RY - 5.9, 2.05), (LOAD_X - 0.9, RY, 4.2))
cams["12"] = CAM("12", (LOAD_X + 2.8, RY - 8.5, 0.8), (LOAD_X, RY, 5.0), 20, (LOAD_X + 2.6, RY - 8.0, 0.85), (LOAD_X, RY, 5.2))
cams["13"] = CAM("13", (LOAD_X + 0.9, RY - 2.7, 3.9), (LOAD_X + 0.35, RY - 0.1, 3.3), 30, (LOAD_X + 0.85, RY - 2.55, 3.9), (LOAD_X + 0.35, RY - 0.1, 3.3))
cams["14"] = CAM("14", (LOAD_X + 2.6, RY - 7.0, 1.0), (LOAD_X, RY, 3.5), 22, (LOAD_X + 2.5, RY - 6.6, 1.1), (LOAD_X, RY, 4.6))
cams["15"] = CAM("15", (LOAD_X + 0.55, RY - 1.75, ZC + 1.65), (LOAD_X + 0.42, RY + 0.1, ZC + 1.5), 36,
                 (LOAD_X + 0.55, RY - 1.65, ZC + 1.65), (LOAD_X + 0.42, RY + 0.1, ZC + 1.5))
cams["16"] = CAM("16", (WHEEL.x + 2.0, 1.75, ROOF_Z + 1.5), (WHEEL.x - 0.05, -0.5, ROOF_Z + 0.7), 25,
                 (WHEEL.x + 1.85, 1.6, ROOF_Z + 1.48), (WHEEL.x - 0.05, -0.5, ROOF_Z + 0.7))      # behind: wheel + belt + motor
cams["17a"] = CAM("17a", (LOAD_X - 0.15, RY - 1.45, ZC + 1.55), (LOAD_X + 0.45, RY - 0.4, ZC + 1.35), 30,
                  (LOAD_X - 0.12, RY - 1.38, ZC + 1.55), (LOAD_X + 0.45, RY - 0.4, ZC + 1.35))
cams["17b"] = CAM("17b", (LOAD_X + 3.0, RY - 9.0, 1.2), (LOAD_X, RY, 5.0), 20, (LOAD_X + 2.9, RY - 8.7, 1.25), (LOAD_X, RY, 5.1))
cams["18"] = CAM("18", (LOAD_X + 1.6, RY - 3.6, 7.9), (LOAD_X + 0.9, RY + 0.6, 9.5), 26, (LOAD_X + 1.55, RY - 3.4, 7.95), (LOAD_X + 0.9, RY + 0.6, 9.55))
cams["18b"] = CAM("18b", (LOAD_X + 0.2, RY - 0.7, 8.9), (LOAD_X + 0.1, RY + 0.1, 8.7), 60)
cams["19"] = CAM("19", (MOD.x + 1.0, MOD.y - 4.2, 0.55), (MOD.x, MOD.y + 0.6, 1.5), 24, (MOD.x + 0.9, MOD.y - 3.7, 0.6), (MOD.x, MOD.y + 0.6, 1.55))


def follow_cam(cam, f0, f1, off, top_dz, lens0, lens1, win=2, step=2):
    """Opening gag framing: camera at the nose line, pitched down by half the FOV so the frame top is a horizontal
    plane just under the eyes -> only mouth + chest visible (hands work below frame)."""
    bl = rig.data.bones["head"]
    L = Vector((0.0, 0.012 + top_dz, 0.10))                    # head-bone space: just under the eyes (nose)
    pts = {}
    for f in range(f0 - win, f1 + win + 1):
        sc.frame_set(f)
        pts[f] = (rig.matrix_world @ rig.pose.bones["head"].matrix @ L).copy()
    cam.animation_data_clear(); cam.data.animation_data_clear()
    d = Vector((off[0], off[1], 0)).length
    for f in list(range(f0, f1, step)) + [f1]:
        T = sum((pts[g] for g in range(f - win, f + win + 1)), Vector()) / (2 * win + 1)
        lens = lens0 + (lens1 - lens0) * (f - f0) / max(1, f1 - f0)
        loc = T + Vector((off[0], off[1], 0))
        tgt = T + Vector((0, 0, -d * 18.0 / lens))
        al.cam_key(cam, f, loc, tgt, lens)
    for fc in lib.fcurves_of(cam):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_distance = d


follow_cam(cams["01a"], a0, a1 - 1, (0.12, -0.8), 0.0, 60, 66)
follow_cam(cams["01b"], b0, b1 - 1, (-0.18, -0.7), 0.0, 64, 74)
follow_cam(cams["18b"], yb0, yb1 - 1, (0.12, -0.8), 0.0, 60, 64)
# ---- soft cuts: extra camera angles inside long shots (keep cuts every 1-2 s; no pose holds at these frames)
def CAMX(name, f0, f1, loc, tgt, lens, loc2=None, tgt2=None):
    cam = make_cam("CAM_" + name, loc, tgt, lens, f0, sc, C_cam)
    if loc2 is not None:
        cam_move(cam, f0, f1 - 1, loc, tgt, loc2, tgt2 or tgt, lens, lens)
    cams[name] = cam
    return cam


sc.frame_set(TON)
PZ_ = pianoH.matrix_world.translation.copy()
CAMX("02b", TON - 8, c1_, (SX + 1.9, PZ_.y - 0.55, PZ_.z + 0.95), (SX, PZ_.y + 0.35, PZ_.z + 0.55), 30,
     (SX + 1.8, PZ_.y - 0.45, PZ_.z + 0.95), (SX, PZ_.y + 0.35, PZ_.z + 0.55))                  # piano slips back
H3c = step_pos(K0 + 3)
CAMX("03b", d0 + 40, d1, (SX + 0.5, H3c.y - 0.95, H3c.z + 1.62), (SX, H3c.y + 0.05, H3c.z + 1.5), 45,
     (SX + 0.47, H3c.y - 0.88, H3c.z + 1.62), (SX, H3c.y + 0.05, H3c.z + 1.5))                   # pained face close-up
CAMX("09b", LAND + 30, n1, (CNT_X + 1.55, RY - 2.25, 1.35), (CNT_X + 0.85, RY - 0.25, 1.12), 35,
     (CNT_X + 1.5, RY - 2.1, 1.35), (CNT_X + 0.85, RY - 0.25, 1.12))                            # dusts off hands, proud
shake(cams["09"], LAND, LAND + 10, 1.2, seed=1)
shake(cams["11"], hit1, hit1 + 8, 0.9, seed=2)
shake(cams["11"], hit2, hit2 + 8, 0.9, seed=3)
shake(cams["11b"], near, near + 8, 1.0, seed=8)
shake(cams["16"], u0 + 7, u0 + 14, 0.8, seed=4)
shake(cams["19"], z0 + 1, z0 + 10, 1.0, seed=5)
for n_dof, fst in (("05b", 2.4), ("07", 2.4), ("15", 2.8), ("17a", 2.4), ("13", 3.2)):
    cm_ = cams[n_dof]
    cm_.data.dof.use_dof = True
    cm_.data.dof.aperture_fstop = fst
    sc.frame_set(S[n_dof][0] + 2)
    tgt_ = cm_.matrix_world @ Vector((0, 0, -1))
    # focus on the character's head
    hd = rig.matrix_world @ rig.pose.bones["head"].head
    cm_.data.dof.focus_distance = (hd - cm_.matrix_world.translation).length if n_dof not in ("17a", "13") else 1.2
    if n_dof == "05b":                                            # focus the burnt palms, not the face
        hl_ = rig.matrix_world @ rig.pose.bones["hand_l"].head
        cm_.data.dof.focus_distance = (hl_ - cm_.matrix_world.translation).length
sc.camera = cams["01a"]

# ================================================================== hold poses until each cut
CUTS = set(v[0] for v in S.values())


def hold_at_cuts(idblock):
    for fc in lib.fcurves_of(idblock):
        kps = fc.keyframe_points
        for a_, b_ in zip(kps, list(kps)[1:]):
            if int(round(b_.co.x)) in CUTS and b_.co.x - a_.co.x > 1.5:
                a_.interpolation = 'CONSTANT'


for ob in list(bpy.data.objects):
    if ob.animation_data and ob.type != 'CAMERA':
        hold_at_cuts(ob)
    if ob.type == 'MESH' and ob.data.shape_keys and ob.data.shape_keys.animation_data:
        hold_at_cuts(ob.data.shape_keys)
# ================================================================== polish
polish.life_noise(rig, k=0.9, seed=11)
polish.auto_blinks(rig, first=40, last=TOTAL - 10, gap=(70, 105), seed=5)
polish.camera_drift(list(cams.values()), deg=0.3, scale=42)
for n, l0_, l1_ in (("07", 42, 50), ("15", 36, 42), ("19", 24, 27)):
    polish.lens_punch(cams[n], S[n][0], S[n][1] - 1, l0_, l1_)
polish.better_metals()
sc.world.use_sun_shadow = False
sc["shots"] = {k: list(v) for k, v in S.items()}
sc["total"] = TOTAL
json.dump({k: list(v) for k, v in S.items()}, open("/opt/work/elev/shots.json", "w"))
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/elev_anim.blend")
print("ELEV ANIM saved", time.time() - t0)
