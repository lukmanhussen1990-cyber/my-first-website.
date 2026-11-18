"""Build all animation + cameras for the reel. Opens master.blend, saves anim.blend."""
import bpy, sys, math, random, time
sys.path.insert(0, "/opt/work/scripts")
from mathutils import Vector, Matrix, Euler
import lib, anim_lib as al, build_fx as fx, build_props as bp, mh_common as mc
from anim_lib import F, Actor, make_cam, cam_move, shake, key_obj, key_infl, key_node_value

t0 = time.time()
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/master.blend")
sc = bpy.context.scene
TOTAL = 1658
sc.frame_start, sc.frame_end = 1, TOTAL
sc.render.fps = 30
TOP = sc["table_top"]
C_cam = lib.coll("CAMERAS")
C_fx = bpy.data.collections["FX"]
C_props = bpy.data.collections["PROPS"]
R = random.Random(42)

# ------------------------------------------------------------------ shot table (seconds)
SHOTS = [("1a", 0.00), ("1b", 1.70), ("1c", 3.18), ("2a", 5.50), ("3a", 7.95), ("3b", 9.55), ("4a", 10.90),
         ("4b", 11.80), ("4c", 13.70), ("5a", 14.90), ("5b", 16.30), ("6a", 17.90), ("6b", 19.30), ("7a", 20.60),
         ("7b", 22.00), ("7c", 23.90), ("8a", 24.80), ("8a2", 26.30), ("8b", 27.60), ("9a", 29.10), ("9b", 31.05),
         ("9c", 32.45), ("10a", 34.15), ("10b", 35.55), ("11a", 37.05), ("11b", 38.75), ("11c", 40.55),
         ("11d", 41.95), ("12a", 44.35), ("12b", 46.35), ("12c", 47.95), ("12d", 49.75), ("13a", 51.70),
         ("13b", 52.85)]
S = {}
for i, (n, t) in enumerate(SHOTS):
    f0 = F(t)
    f1 = F(SHOTS[i + 1][1]) if i + 1 < len(SHOTS) else TOTAL + 1
    S[n] = (f0, f1)
print("shots", S)

# ------------------------------------------------------------------ objects
rig = bpy.data.objects["You"]
A = Actor(rig)
undies = bpy.data.objects["Undies"]
tub = bpy.data.objects["Tub"]
tub_water = bpy.data.objects["Tub_water"]
bottle = bpy.data.objects["Detergent"]
spout = bpy.data.objects["Detergent_spout"]
drum_root = bpy.data.objects["DrumRig"]
drum_spin = bpy.data.objects["DrumSpin"]
drum_water = bpy.data.objects["DrumWater"]
DR = drum_root.location.copy()          # (2.7,-0.35,0)
AX = bp.AXLE_Z
OPEN = DR + Vector((0, -0.25, AX))      # drum opening centre (world)
undies_mat = undies.data.materials[0]
tw_mat = tub_water.data.materials[0]
dw_mat = drum_water.data.materials[0]


def W(p):
    return Vector(p)


# ================================================================== CHARACTER PLACEMENT
PLACES = [
    ("1a", (0.0, 0.02, 0.0), 0), ("5b", (-12.8, -14.2, 0), 0), ("6a", (-8.6, -15.4, 0), 0),
    ("6b", (-9.0, -15.4, 0), -154), ("7a", (3.45, -1.25, 0), -131), ("7b", (2.85, 0.95, 0), 0),
    ("8a", (1.75, -0.15, 0), -20), ("8b", (0.5, 2.4, 0), 0), ("9a", (1.62, -0.5, 0), 55), ("12a", (1.6, -1.05, 0), -25),
    ("12c", (1.72, -1.32, 0), 124), ("13a", (1.55, -0.85, 0), -15),
]
for n, loc, rz in PLACES:
    A.place(S[n][0], loc, rz)


def place_at(f):
    """Return (loc, rz) of the character at frame f according to PLACES."""
    cur = PLACES[0]
    for p in PLACES:
        if S[p[0]][0] <= f:
            cur = p
    return Vector(cur[1]), cur[2]


def hw(f, p_world):
    """world point -> armature space for frame f."""
    loc, rz = place_at(f)
    return A.world_to_arm(p_world, loc, rz)


# defaults at frame 1
A.feet(1)
for side in ("l", "r"):
    A.fingers(1, side, 35)

# ---------------------------------------------------------------- holding socket for undies
U_S = 1.12
grip = bpy.data.objects.new("UndiesGrip", None); C_props.objects.link(grip)
c = grip.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_r"
c = grip.constraints.new('COPY_LOCATION'); c.target = rig; c.subtarget = "middle_01_l"; c.influence = 0.5
c = grip.constraints.new('COPY_ROTATION'); c.target = rig
c = grip.constraints.new('DAMPED_TRACK'); c.target = rig; c.subtarget = "middle_01_l"; c.track_axis = 'TRACK_X'
grip["held"] = 0.0
cl_ = undies.constraints.new('COPY_LOCATION'); cl_.target = grip; cl_.name = "HoldLoc"; cl_.influence = 0.0
cr_ = undies.constraints.new('COPY_ROTATION'); cr_.target = grip; cr_.name = "HoldRot"; cr_.influence = 0.0
undies.scale = (U_S, U_S, U_S)
_fc = undies.driver_add("scale", 0)
_drv = _fc.driver; _drv.type = 'SCRIPTED'
_v = _drv.variables.new(); _v.name = "d"; _v.type = 'LOC_DIFF'
_v.targets[0].id = rig; _v.targets[0].bone_target = "middle_01_l"
_v.targets[1].id = rig; _v.targets[1].bone_target = "middle_01_r"
_v2 = _drv.variables.new(); _v2.name = "k"; _v2.type = 'SINGLE_PROP'
_v2.targets[0].id = grip; _v2.targets[0].data_path = '["held"]'
_drv.expression = f"(1-k)*{U_S} + k*(d/0.38)"


def undies_hold(f, on):
    v = 1.0 if on else 0.0
    key_infl(undies, "HoldLoc", f, v)
    key_infl(undies, "HoldRot", f, v)
    grip["held"] = v
    grip.keyframe_insert('["held"]', frame=f)
    for fcv in lib.fcurves_of(grip):
        for kp in fcv.keyframe_points:
            kp.interpolation = 'CONSTANT'
    for side in ("l", "r"):
        if on:
            A.fingers(f, side, 78, thumb=35)
        else:
            A.fingers(f, side, 25)


def undies_free(f, loc, rot, interp=None):
    key_obj(undies, f, loc=loc, rot=rot, interp=interp)


# =================================================================== SHOT 1  (hold up, genius, dunk)
f0, f1 = S["1a"]
HOLD = dict(l=(0.27, -0.36, 1.42), r=(-0.27, -0.36, 1.42), el=(0.5, 0.15, 1.1), er=(-0.5, 0.15, 1.1))
A.hands(1, **HOLD)
A.spine(1, 0); A.head(1, 4, 0, 0)
A.face(1, "serious")
undies_hold(1, True)
key_node_value(undies_mat, "Stain", 1, 1.0)
key_node_value(undies_mat, "Wet", 1, 0.0)
# little shake of undies on "shit"
A.hands(8, l=(0.27, -0.37, 1.45), r=(-0.27, -0.37, 1.45))
A.face(14, "disgusted", 0.9)
A.head(14, -6, 8, 4)
A.hands(18, l=(0.28, -0.39, 1.42), r=(-0.26, -0.39, 1.42))
A.hands(28, l=(0.26, -0.38, 1.43), r=(-0.28, -0.38, 1.43))
A.hands(40, **HOLD)
A.head(40, -4, 10, 3)
A.face(46, "disgusted", 1.0)
# 1b genius (CU)
fb0, fb1 = S["1b"]
A.face(fb0 + 2, "disgusted", 0.6)
A.face(fb0 + 12, "smug", 1.0)
A.head(fb0 + 2, 0, 0, 0)
A.head(fb0 + 14, -12, -6, -6)   # chin up, proud tilt
A.spine(fb0 + 14, -5)
A.face(fb0 + 26, "proud", 1.0, extra={"browOuterUpLeft": 0.9, "browOuterUpRight": 0.9, "browInnerUp": 0.5})
A.head(fb0 + 30, -14, -4, -8)
A.blink(fb0 + 36)
A.hands(fb0 + 6, **HOLD)
A.hands(fb1 - 2, l=(0.27, -0.37, 1.41), r=(-0.27, -0.37, 1.41))
# 1c dunk + rinse
fc0, fc1 = S["1c"]
A.head(fc0, -6, -3, -4); A.spine(fc0, -3)
A.face(fc0 + 2, "serious")
TUBW = W((0, -0.52, TOP + 0.2))
dunk_l = hw(fc0, TUBW + W((0.24, 0.1, 0.2)))
dunk_r = hw(fc0, TUBW + W((-0.24, 0.1, 0.2)))
A.hands(fc0 + 10, l=(0.26, -0.42, 1.38), r=(-0.26, -0.42, 1.38))
A.spine(fc0 + 22, 18); A.head(fc0 + 22, 14, 0, 0)
A.hands(fc0 + 26, l=tuple(dunk_l + W((0, 0, 0.12))), r=tuple(dunk_r + W((0, 0, 0.12))))
SPLASH_F = fc0 + 31
A.hands(SPLASH_F, l=tuple(dunk_l), r=tuple(dunk_r), el=(0.45, 0.25, 1.15), er=(-0.45, 0.25, 1.15))
A.spine(SPLASH_F, 26); A.head(SPLASH_F, 20, 0, 0)
for k, f in enumerate(range(SPLASH_F + 6, fc1, 7)):
    s = 1 if k % 2 == 0 else -1
    A.hands(f, l=tuple(dunk_l + W((0.05 * s, -0.04, -0.01))), r=tuple(dunk_r + W((0.05 * s, -0.04, -0.01))))
A.blink(fc0 + 50)
# splash droplets + water turning dirty
for i in range(14):
    a = R.uniform(0, 2 * math.pi)
    v = W((math.cos(a) * R.uniform(0.3, 0.9), math.sin(a) * R.uniform(0.3, 0.9), R.uniform(1.6, 2.6)))
    d = fx.droplet(f"Splash1_{i}", C_fx, TUBW + W((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.02)), v, SPLASH_F, SPLASH_F + 24,
                   size=R.uniform(0.008, 0.014), floor_z=TUBW.z - 0.01)
import polish
polish.ripple_rings(C_fx, TUBW, SPLASH_F, n=3)
key_node_value(tw_mat, "Dirt", 1, 0.0)
key_node_value(tw_mat, "Dirt", SPLASH_F, 0.0)
key_node_value(tw_mat, "Dirt", SPLASH_F + 30, 0.7)
key_node_value(tw_mat, "Foam", 1, 0.0)
key_node_value(tw_mat, "Ripple", 1, 0.0)
key_node_value(tw_mat, "Ripple", TOTAL, 40.0)
for fc in lib.fcurves_of(tw_mat.node_tree):
    if "Ripple" in fc.data_path or fc.data_path.startswith('nodes["Ripple"]'):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
key_node_value(undies_mat, "Wet", SPLASH_F, 0.0)
key_node_value(undies_mat, "Wet", SPLASH_F + 6, 1.0)

# =================================================================== SHOT 2 (wet + smelly)
g0, g1 = S["2a"]
A.spine(g0, 24); A.head(g0, 18, 0, 0)
A.hands(g0, l=tuple(dunk_l), r=tuple(dunk_r))
A.spine(g0 + 16, 2); A.head(g0 + 16, 0, 0, 0)
LIFT = dict(l=(0.25, -0.52, 1.5), r=(-0.25, -0.52, 1.5), el=(0.5, 0.1, 1.2), er=(-0.5, 0.1, 1.2))
A.hands(g0 + 16, **LIFT)
A.face(g0 + 4, "serious")
A.face(g0 + 30, "disgusted", 1.0, extra={"jawOpen": 0.2})
A.head(g0 + 34, -10, 25, 8)
A.spine(g0 + 34, -8, 10, 0)
A.hands(g0 + 40, l=(0.28, -0.58, 1.47), r=(-0.2, -0.58, 1.47))
A.hands(g1 - 1, l=(0.29, -0.6, 1.45), r=(-0.19, -0.6, 1.45))
A.head(g1 - 1, -12, 30, 10)
# drips
for i, f in enumerate(range(g0 + 18, g1, 5)):
    loc, rz = place_at(f)
    p = A.arm_to_world(W((0.03 * math.sin(i), -0.62, 1.15)), loc, rz)
    fx.droplet(f"Drip2_{i}", C_fx, p, (0, 0, -0.2), f, f + 16, size=0.009)
# stink lines
fx.stink_cluster("Stink2", C_fx, W((0.04, -0.62, 1.32)), n=3, spread=0.1, height=0.5, f_in=g0 + 24, f_out=g1 + 2,
                 rng=R, radius=0.012)

# =================================================================== SHOT 3a detergent
d0, d1 = S["3a"]
# undies now lying in tub
undies_hold(d0, False)
undies_free(d0, (0.0, -0.38, TOP + 0.207), (-88, 0, 8))
A.spine(d0, 10); A.head(d0, 12, 0, 0)
# bottle animation (left hand)
bz = [v.co.z for v in bottle.data.vertices]
b_h = (max(bz) - min(bz)) * bottle.scale.z
b_rest = bottle.location.copy()
grip_local = W((0, 0, min(bz) + 0.55 * (max(bz) - min(bz))))


def bottle_key(f, loc, rot_deg):
    key_obj(bottle, f, loc=loc, rot=rot_deg)
    e = Euler([math.radians(a) for a in rot_deg])
    g = W(loc) + (e.to_matrix() @ Vector((grip_local.x * bottle.scale.x, grip_local.y * bottle.scale.y, grip_local.z * bottle.scale.z)))
    A.hands(f, l=tuple(hw(f, g) + W((0.03, 0.02, -0.02))))


key_obj(bottle, 1, loc=b_rest, rot=(0, 0, 0))
key_obj(bottle, d0, loc=b_rest, rot=(0, 0, 0))
A.hands(d0, l=tuple(hw(d0, b_rest + W((0.05, 0.05, 0.2)))), r=tuple(hw(d0, TUBW + W((-0.18, 0.12, 0.05)))),
        el=(0.45, 0.25, 1.15), er=(-0.45, 0.25, 1.15))
bottle_key(d0 + 6, b_rest, (0, 0, 0))
bottle_key(d0 + 16, b_rest + W((-0.08, -0.03, 0.3)), (0, -30, 0))
POUR0 = d0 + 22
bottle_key(POUR0, W((0.42, -0.47, TOP + 0.43)), (0, -100, 0))
bottle_key(d1 - 2, W((0.43, -0.47, TOP + 0.44)), (0, -104, 0))
A.face(d0 + 6, "serious", 1.0, extra={"mouthPucker": 0.4})
A.fingers(d0 + 4, "l", 25)
A.fingers(d0 + 8, "l", 70, thumb=30)
A.fingers(S["3b"][0], "l", 30)
# stream from spout
spout_world_pour = None
stream = fx.stream("DetergentStream", C_fx, (0.07, -0.5, TOP + 0.36), (0.02, -0.5, TOP + 0.205), radius=0.011,
                   color="#2E7FD0", emit=0.4)
stream.scale = (1, 1, 0.0); stream.keyframe_insert("scale", frame=POUR0 + 1)
stream.scale = (1, 1, (W((0.07, -0.5, TOP + 0.36)) - W((0.02, -0.5, TOP + 0.205))).length)
stream.keyframe_insert("scale", frame=POUR0 + 4)
lib.visible_between(stream, POUR0 + 1, d1)
foam = fx.foam_cluster("TubFoam", C_fx, radius=0.22, n=34, seed=5)
foam.location = TUBW + W((0, 0, 0.005))
key_obj(foam, 1, scale=0.0)
key_obj(foam, POUR0 + 4, scale=0.0)
key_obj(foam, d1 + 10, scale=1.0)
lib.visible_between(foam, POUR0 + 3, S["4b"][1])
key_node_value(tw_mat, "Foam", POUR0 + 4, 0.0)
key_node_value(tw_mat, "Foam", d1 + 12, 0.85)

# =================================================================== SHOT 3b scrub
s0, s1 = S["3b"]
bottle_key(s0, b_rest, (0, 0, 0))   # back on table (cut hides the move)
SCR_L = hw(s0, TUBW + W((0.09, 0.0, 0.0)))
SCR_R = hw(s0, TUBW + W((-0.09, 0.0, 0.0)))
A.spine(s0, 24); A.head(s0, 22, 0, 0)
A.face(s0, "serious", 1.0, extra={"mouthPressLeft": 0.6, "mouthPressRight": 0.6, "browDownLeft": 0.6, "browDownRight": 0.6})
for k, f in enumerate(range(s0, s1, 4)):
    sgn = 1 if k % 2 == 0 else -1
    A.hands(f, l=tuple(SCR_L + W((0, 0.06 * sgn, 0.01))), r=tuple(SCR_R + W((0, -0.06 * sgn, 0.01))),
            el=(0.45, 0.3, 1.15), er=(-0.45, 0.3, 1.15))
    undies_free(f, (0.012 * sgn, -0.38 + 0.02 * sgn, TOP + 0.207), (-88, 0, 8 + 6 * sgn))
key_node_value(undies_mat, "Stain", s0 + 20, 1.0)
key_node_value(undies_mat, "Stain", s1, 0.0)
# little foam flecks flying
for i in range(8):
    f = s0 + 4 + i * 4
    fx.droplet(f"FoamFleck_{i}", C_fx, TUBW + W((R.uniform(-0.1, 0.1), R.uniform(-0.05, 0.05), 0.03)),
               (R.uniform(-0.4, 0.4), R.uniform(-0.5, -0.1), R.uniform(1.0, 1.6)), f, f + 14, size=0.012,
               floor_z=TUBW.z)

# =================================================================== SHOT 4a "That works" (proud)
w0, w1 = S["4a"]
undies_hold(w0, True)
key_node_value(undies_mat, "Wet", w0, 0.45)
A.spine(w0, -4); A.head(w0, -10, 0, 0)
A.hands(w0, l=(0.27, -0.36, 1.5), r=(-0.27, -0.36, 1.5), el=(0.5, 0.15, 1.15), er=(-0.5, 0.15, 1.15))
A.hands(w1 - 1, l=(0.27, -0.36, 1.54), r=(-0.27, -0.36, 1.54))
A.face(w0, "proud", 1.0)
A.face(w0 + 10, "grin", 0.9)
A.head(w0 + 14, -14, -4, -4)

# =================================================================== SHOT 4b/4c pile drop, take forever
p0, p1 = S["4b"]
q0, q1 = S["4c"]
undies_hold(p0, False)
undies_free(p0, (0.55, -0.75, TOP + 0.012), (-90, 0, 25))
A.hands(p0, l=(0.27, -0.12, 0.95), r=(-0.27, -0.12, 0.95), el=(0.35, 0.3, 1.1), er=(-0.35, 0.3, 1.1))
A.spine(p0, 0); A.head(p0, -6, 0, 0)
A.face(p0, "proud", 0.8)
meshes = [m for m in bpy.data.meshes if m.name.startswith("BlobMesh_")]
mats = [m for m in bpy.data.materials if m.name.startswith("M_Cloth_")]
PILE_C = W((-1.45, -0.2, 0.0))
LAND = p0 + 14
pile = []
rows = [(0.0, 14, 0.85), (0.3, 12, 0.72), (0.6, 10, 0.58), (0.9, 8, 0.45), (1.18, 6, 0.32), (1.45, 4, 0.2), (1.7, 2, 0.08), (1.92, 1, 0.0)]
k = 0
for z, n, rad in rows:
    for j in range(n):
        a = 2 * math.pi * j / max(1, n) + R.uniform(-0.2, 0.2)
        pos = PILE_C + W((math.cos(a) * rad * R.uniform(0.8, 1.1), math.sin(a) * rad * 0.8, z + 0.12))
        b = bp.make_blob(f"Pile_{k}", meshes, mats, C_props, size=R.uniform(0.25, 0.31), rng=R)
        b.rotation_euler = (R.uniform(-0.4, 0.4), R.uniform(-0.4, 0.4), R.uniform(0, 6.28))
        fl = LAND + int(z * 5) + R.randint(-2, 2)
        key_obj(b, fl - 7, loc=pos + W((R.uniform(-0.2, 0.2), 0, 3.2)), scale=b.scale.copy())
        key_obj(b, fl, loc=pos, scale=(b.scale.x * 1.15, b.scale.y * 1.15, b.scale.z * 0.75))
        key_obj(b, fl + 3, loc=pos + W((0, 0, 0.02)), scale=(b.scale.x / 1.15, b.scale.y / 1.15, b.scale.z / 0.75))
        for fcv in lib.fcurves_of(b):
            for kp in fcv.keyframe_points:
                if abs(kp.co.x - (fl - 7)) < 0.1:
                    kp.interpolation = 'QUAD'
                    kp.easing = 'EASE_IN'
        lib.visible_between(b, p0, q1)
        pile.append(b)
        k += 1
A.head(LAND - 6, -4, 35, 0)       # turn to look at pile
A.face(LAND + 2, "shocked", 1.0)
A.spine(LAND + 2, -6, 12, 0)
A.blink(LAND + 22)
# 4c take forever: tired slump
A.face(q0, "tired", 1.0)
A.head(q0, -14, 32, -4)
A.spine(q0, 12, 8, 0)
A.hands(q0, l=(0.24, -0.1, 0.88), r=(-0.24, -0.1, 0.88))
A.head(q1 - 1, 12, 26, -8)
A.spine(q1, 15, 8, 0)

# =================================================================== SHOT 5/6 crowd
with bpy.data.libraries.load("/opt/work/blend/workers.blend", link=False) as (src, dst):
    dst.collections = [c for c in src.collections if c.startswith("WorkerVar_")]
SRC = lib.coll("WORKER_SRC")
variants = []
for cl in dst.collections:
    SRC.children.link(cl)
    variants.append(cl)
vl = bpy.context.view_layer
vl.layer_collection.children["WORKER_SRC"].exclude = True
CROWD = lib.coll("CROWD")
X0, Y0, DX, DY = -19.6, -12.5, 1.36, 1.45
inst = []
for iy in range(10):
    for ix in range(10):
        v = R.randrange(len(variants))
        e = bpy.data.objects.new(f"Worker_{iy}_{ix}", None)
        CROWD.objects.link(e)
        e.instance_type = 'COLLECTION'
        e.instance_collection = variants[v]
        e.location = (X0 + ix * DX + R.uniform(-0.08, 0.08), Y0 + iy * DY + R.uniform(-0.08, 0.08), 0)
        e.rotation_euler = (0, 0, math.radians(R.uniform(-6, 6)))
        lib.visible_between(e, S["5a"][0], S["7a"][0])
        inst.append(e)
# worker animation (re-key with armature-space IK)
c0 = S["5a"][0] - 10
PAY = S["6a"][0] + 2
POOF0 = S["6b"][0] + 9
for vi, cl in enumerate(variants):
    wr = [o for o in cl.objects if o.type == 'ARMATURE'][0]
    if wr.animation_data:
        wr.animation_data_clear()
    WA = Actor(wr)
    WA.feet(1)
    tub_w = [o for o in cl.objects if o.name.startswith("WTub_") and "water" not in o.name and "handle" not in o.name][0]
    tw = tub_w.location + W((0, 0.02, 0.15))
    ph = R.randint(0, 6)
    WA.spine(1, 16); WA.head(1, 20, 0, 0)
    WA.fingers(1, "l", 30); WA.fingers(1, "r", 30)
    for k2, f in enumerate(range(c0 + ph, PAY, 5)):
        sg = 1 if k2 % 2 == 0 else -1
        WA.hands(f, l=tuple(tw + W((0.08, 0.07 * sg, 0.0))), r=tuple(tw + W((-0.08, -0.07 * sg, 0.01))),
                 el=(0.42, 0.25, 1.1), er=(-0.42, 0.25, 1.1))
    WA.spine(PAY - 1, 16); WA.head(PAY - 1, 20, 0, 0)
    # demand pay: right hand out, palm up
    WA.hands(PAY + 6, r=(-0.12, -0.5, 1.12), l=(0.24, -0.12, 0.95), er=(-0.35, 0.2, 1.0), el=(0.35, 0.3, 1.1))
    WA.wrist(PAY + 6, "r", 0, -80, 0)
    WA.spine(PAY + 6, -2); WA.head(PAY + 6, -12, 0, 0)
    WA.fingers(PAY + 6, "r", 8)
    WA.hands(PAY + 14, r=(-0.12, -0.52, 1.15))
    # $ sign above head (part of instanced collection)
    ms = fx.money_sign(f"Money_{vi}", C_fx, (0, -0.05, 2.15), size=0.34)
    lib.link(ms, cl)
    key_obj(ms, PAY + 3, scale=0.0)
    key_obj(ms, PAY + 8, scale=1.25)
    key_obj(ms, PAY + 11, scale=1.0)
    ms.rotation_euler = (math.radians(90), 0, 0)
    ms.keyframe_insert("rotation_euler", frame=PAY + 8)
    ms.rotation_euler = (math.radians(90), 0, math.radians(20))
    ms.keyframe_insert("rotation_euler", frame=POOF0 + 2 * vi)
    lib.visible_between(ms, PAY + 3, S['7a'][0])
    # flail arms while falling
    WA.hands(POOF0 + 6, r=(-0.45, -0.2, 1.85), l=(0.45, -0.2, 1.85), er=(-0.6, 0.2, 1.4), el=(0.6, 0.2, 1.4))
    WA.hands(POOF0 + 10, r=(-0.5, -0.1, 1.95), l=(0.4, -0.25, 1.8))
    WA.hands(POOF0 + 14, r=(-0.4, -0.25, 1.8), l=(0.5, -0.1, 1.95))
    WA.hands(POOF0 + 18, r=(-0.5, -0.1, 1.95), l=(0.4, -0.25, 1.8))
    WA.head(POOF0 + 6, -20, 0, 0)
# ---- trapdoors open, workers drop into the fire pit
import build_pit
PX0, PX1 = build_pit.PIT["x0"], build_pit.PIT["x1"]
XC = (PX0 + PX1) / 2
DROP0 = POOF0
for hn, sgn in (("Hinge_L", 1), ("Hinge_R", -1)):
    h = bpy.data.objects[hn]
    key_obj(h, 1, rot=(0, 0, 0)); key_obj(h, DROP0, rot=(0, 0, 0))
    key_obj(h, DROP0 + 5, rot=(0, sgn * 62, 0)); key_obj(h, DROP0 + 8, rot=(0, sgn * 94, 0))
    key_obj(h, DROP0 + 11, rot=(0, sgn * 84, 0)); key_obj(h, DROP0 + 14, rot=(0, sgn * 89, 0))
    key_obj(h, S["7a"][0], rot=(0, sgn * 89, 0))
    key_obj(h, S["7a"][0] + 1, rot=(0, 0, 0), interp='CONSTANT')
for e in inst:
    x = e.location.x
    dist = abs(x - XC) / ((PX1 - PX0) / 2)
    fs = DROP0 + 1 + int((1.0 - dist) * 2) + int(dist * 4) + R.randint(0, 1)
    p0 = e.location.copy()
    rzd = math.degrees(e.rotation_euler.z)
    tdir = 1 if x < XC else -1
    key_obj(e, 1, loc=p0, rot=(0, 0, rzd))
    key_obj(e, fs, loc=p0, rot=(0, 0, rzd))
    for k5 in range(2, 34, 2):
        tt = k5 / 30.0
        key_obj(e, fs + k5, loc=(p0.x + tdir * 0.9 * tt, p0.y, p0.z - 0.5 * 9.8 * tt * tt),
                rot=(R.uniform(-8, 8), tdir * min(80, 140 * tt), rzd))
polish.embers(C_fx, (PX0 + 0.5, PX1 - 0.5, build_pit.PIT['y0'] + 0.5, build_pit.PIT['y1'] - 0.5, -5.5), DROP0 + 2, S['7a'][0], n=110)
pit_objs = [o for o in bpy.data.collections["PIT"].objects if not o.name.startswith(("Trapdoor", "Hinge"))]
for o in pit_objs:
    lib.visible_between(o, DROP0 - 1, S["7a"][0])
for o in pit_objs:
    if o.type == 'LIGHT':
        o.data.energy = 0.0; o.data.keyframe_insert("energy", frame=DROP0 - 1)
        for ff in range(DROP0 + 3, S["7a"][0], 3):
            o.data.energy = 2200 * (0.8 + 0.3 * R.random()); o.data.keyframe_insert("energy", frame=ff)

# You in crowd shots
b0, b1 = S["5b"]
A.feet(b0)
ARMS_X = dict(l=(-0.1, -0.21, 1.22), r=(0.11, -0.23, 1.18), el=(0.35, -0.15, 1.05), er=(-0.35, -0.15, 1.05))
A.hands(b0, **ARMS_X)
A.spine(b0, -4, 0, 0); A.head(b0, -8, 0, 4)
A.face(b0, "smug", 1.0)
A.head(b0 + 16, 6, 0, 2)     # nod
A.head(b0 + 26, -8, -4, 4)
A.blink(b0 + 34)
x0, x1 = S["6b"]
A.hands(x0, **ARMS_X)
A.face(x0, "smug", 1.0)
POINT = dict(r=(-0.22, -0.66, 1.46), l=(0.27, -0.06, 0.88), er=(-0.45, 0.25, 1.25), el=(0.35, 0.3, 1.1))
A.hands(x0 + 7, **POINT)
A.fingers(x0, "r", 35)
A.fingers(x0 + 7, "r", 75, thumb=40)
A.rot(x0 + 7, "index_01_r", 0, 0, 0); A.rot(x0 + 7, "index_02_r", 0, 0, 0); A.rot(x0 + 7, "index_03_r", 0, 0, 0)
A.head(x0 + 7, -6, 0, 0)
A.face(POOF0 + 6, "grin", 1.0)

# =================================================================== SHOT 7 drum: throw, crank, clever
for o in [drum_root] + drum_root.children_recursive:
    if o.name.startswith(("Motor", "Belt", "OuterTub", "Pump", "Hose", "Drain", "Cab", "Arrow", "DrumWater")):
        continue
    lib.visible_between(o, S["7a"][0], TOTAL + 10)
t7, t71 = S["7a"]
A.feet(t7)
A.spine(t7, 8); A.head(t7, 6, 0, 0)
A.face(t7, "serious", 1.0)
# small pile at his feet
small = []
for i in range(8):
    p = W((3.85 + R.uniform(-0.2, 0.2), -1.55 + R.uniform(-0.15, 0.15), 0.1 + (i // 4) * 0.12))
    b = bp.make_blob(f"Pile2_{i}", meshes, mats, C_props, size=R.uniform(0.11, 0.14), rng=R)
    b.location = p
    small.append(b)
throws = [t7 + 3 + 6 * i for i in range(6)]
inside = lib.coll("IN_DRUM", C_props)
in_root = bpy.data.objects.new("ClothesInDrum", None); inside.objects.link(in_root)
in_root.parent = drum_root; in_root.location = (0, 0, AX)
in_blobs = []
for i in range(13):
    a = math.radians(-90 + R.uniform(-65, 65))
    rr = R.uniform(0.06, 0.22)
    b = bp.make_blob(f"InDrum_{i}", meshes, mats, inside, size=R.uniform(0.09, 0.12), rng=R)
    b.parent = in_root
    b.location = (rr * math.cos(a), R.uniform(-0.17, 0.17), rr * math.sin(a))
    b.rotation_euler = (R.uniform(0, 6), R.uniform(0, 6), R.uniform(0, 6))
    in_blobs.append(b)
for i, b in enumerate(in_blobs):
    fa = throws[min(i, len(throws) - 1)] + 8
    s0b = (b.scale.x, b.scale.y, b.scale.z)
    key_obj(b, fa - 1, scale=0.0)
    key_obj(b, fa, scale=s0b)
    lib.visible_between(b, fa, TOTAL + 10)
for i, b in enumerate(small):
    lib.visible_between(b, t7, throws[min(i, 5)] if i < 6 else t71)
for i, f in enumerate(throws):
    # arms: scoop down then fling forward
    side_hand = dict(l=(0.15, -0.3, 0.75), r=(-0.15, -0.3, 0.75))
    A.hands(f - 3, **side_hand)
    A.hands(f + 1, l=(0.12, -0.55, 1.3), r=(-0.12, -0.55, 1.3), el=(0.4, 0.2, 1.1), er=(-0.4, 0.2, 1.1))
    A.spine(f - 3, 22); A.spine(f + 1, 4)
    loc, rz = place_at(f)
    start = A.arm_to_world(W((0, -0.55, 1.3)), loc, rz)
    fb = bp.make_blob(f"Fly_{i}", meshes, mats, C_fx, size=0.12, rng=R)
    for j in range(0, 9):
        tt = j / 8
        pos = start.lerp(OPEN + W((0, 0.15, 0)), tt) + W((0, 0, 0.35 * math.sin(math.pi * tt)))
        key_obj(fb, f + j, loc=pos, rot=(j * 30, j * 20, 0))
    lib.visible_between(fb, f, f + 9)
# crank
k0, k1 = S["7b"]
grip_local = W((0, 0.72, 0.22))
CR0 = k0 + 6
CR1 = k1 - 2
REV = 2.0
key_obj(drum_spin, 1, rot=(0, 0, 0))
key_obj(drum_spin, CR0, rot=(0, 0, 0))
A.feet(k0)
A.face(k0, "serious", 1.0, extra={"jawOpen": 0.0, "mouthPressLeft": 0.7, "mouthPressRight": 0.7})
A.spine(k0, 12); A.head(k0, -4, 0, 0)
A.hands(k0, l=(0.24, -0.15, 0.95), el=(0.35, 0.3, 1.1), er=(-0.45, 0.1, 1.0))
for f in range(CR0, CR1 + 1, 2):
    u = (f - CR0) / (CR1 - CR0)
    ang = -REV * 2 * math.pi * (u * u * (3 - 2 * u))
    key_obj(drum_spin, f, rot=(0, math.degrees(ang), 0), interp='LINEAR')
    gx = grip_local.z * math.sin(ang)
    gz = grip_local.z * math.cos(ang)
    gw = DR + W((gx, grip_local.y, AX + gz))
    A.hands(f, r=tuple(hw(f, gw) + W((0.0, 0.05, 0.0))))
    A.spine(f, 12 + 4 * math.sin(ang), 4 * math.cos(ang), 0)
# hand to grip before crank
gw0 = DR + W((0, grip_local.y, AX + grip_local.z))
A.hands(k0 + 2, r=tuple(hw(k0 + 2, gw0) + W((0.0, 0.05, 0.0))))
END_CRANK = -REV * 2 * math.pi
# 7c clever
v0, v1 = S["7c"]
A.face(v0, "grin", 1.0, extra={"browOuterUpLeft": 0.8, "browOuterUpRight": 0.8})
A.head(v0, -6, 0, 0)
A.head(v0 + 7, 10, 0, 0)
A.head(v0 + 13, -8, 0, 4)
A.head(v0 + 19, 6, 0, 2)
A.spine(v0, 2)
A.face(v0 + 5, "grin", 1.0, extra={"eyeBlinkRight": 0.95, "browOuterUpLeft": 0.9, "cheekSquintRight": 1.0})
A.hands(v0, r=(-0.24, -0.12, 1.45), er=(-0.62, 0.15, 1.35))
for kk, ft in enumerate(range(v0 + 4, v1, 4)):
    off = 0.0 if kk % 2 == 0 else 0.018
    A.hands(ft, r=(-0.2 - off, -0.08 - off * 0.5, 1.58 - off), er=(-0.62, 0.15, 1.35))
A.fingers(v0 + 3, "r", 82, thumb=35)
for bn in ("index_01_r", "index_02_r", "index_03_r"):
    A.rot(v0 + 3, bn, 0, 0, 0)
A.head(v0 + 4, -4, 0, -7)

# =================================================================== SHOT 8 sore arm + motor
a0, a1 = S["8a"]
a20, a21 = S["8a2"]
A.feet(a0)
A.spine(a0, 6, 0, -4); A.head(a0, 8, -8, -6)
A.face(a0, "tired", 1.0)
A.face(a0 + 12, "tired", 1.0, extra={"eyeSquintRight": 0.8, "mouthStretchRight": 0.6, "browDownRight": 0.5})
A.fingers(a0, "l", 30)
A.fingers(a0, "r", 20)
for k3, f in enumerate(range(a0, a21 + 1, 6)):
    sg = k3 % 2
    A.hands(f, l=(-0.2 - 0.02 * sg, -0.11, 1.33 - 0.07 * sg), r=(-0.3, -0.02, 0.88), el=(0.3, -0.12, 1.08),
            er=(-0.4, 0.3, 1.1))
A.clav(a0 + 10, "r", up=8)
A.clav(a0 + 22, "r", up=-4)
A.clav(a0 + 34, "r", up=6)
A.blink(a0 + 30)
# 8a2 knowing look
A.face(a20, "smug", 1.0, extra={"eyeLookOutLeft": 0.7, "eyeLookInRight": 0.7, "browOuterUpRight": 0.9})
A.head(a20, -2, 12, 6)
A.face(a20 + 18, "smug", 1.0, extra={"eyeLookOutLeft": 0.7, "eyeLookInRight": 0.7, "browOuterUpRight": 0.3,
                                      "browOuterUpLeft": 0.9})
A.face(a20 + 26, "smug", 1.0, extra={"eyeLookOutLeft": 0.7, "eyeLookInRight": 0.7, "browOuterUpRight": 1.0})
A.head(a21 - 1, 0, 14, 8)
# motor slides in
m0, m1 = S["8b"]
motor = bpy.data.objects["MotorRig"]
belt = bpy.data.objects["Belt"]
mloc = motor.location.copy()
for o in [motor] + motor.children_recursive:
    lib.visible_between(o, m0, TOTAL + 10)
key_obj(motor, m0, loc=mloc + W((0.9, 0, 0.45)))
key_obj(motor, m0 + 9, loc=mloc + W((0.0, 0, 0.0)))
key_obj(motor, m0 + 12, loc=mloc + W((0.0, 0, 0.03)))
key_obj(motor, m0 + 15, loc=mloc)
MOTOR_LAND = m0 + 9
for bi, bo in enumerate(bpy.data.objects["MotorRig"].children):
    pass
bolts = [o for o in motor.children if o.name.startswith("Motor_bolt")]
for bi, bo in enumerate(bolts):
    bl = bo.location.copy()
    fb0 = MOTOR_LAND + 4 + bi * 2
    key_obj(bo, m0, loc=bl + W((0, 0, 0.08)), rot=(0, 0, 0))
    key_obj(bo, fb0, loc=bl + W((0, 0, 0.08)), rot=(0, 0, 0))
    key_obj(bo, fb0 + 5, loc=bl, rot=(0, 0, 720))
lib.visible_between(belt, MOTOR_LAND + 12, TOTAL + 10)
key_obj(belt, MOTOR_LAND + 12, scale=(1, 1, 1))
# motor shudder when it starts
mb = bpy.data.objects["Motor_body"]
for f in range(m1 - 12, m1 + 60, 2):
    key_obj(mb, f, loc=(0.003 * R.uniform(-1, 1), 0.06, 0.24 + 0.003 * R.uniform(-1, 1)))
A.face(m0, "proud", 1.0)

# =================================================================== SHOT 9 motor turns drum, arrows
n0, n1 = S["9a"]
o0, o1 = S["9b"]
r0, r1 = S["9c"]
A.feet(n0)
A.hands(n0, **ARMS_X)
A.spine(n0, -3); A.head(n0, 0, 22, 0)
A.face(n0, "shocked", 0.8)
A.face(n0 + 20, "proud", 1.0)
A.head(n0 + 26, 4, 28, 3)
A.blink(n0 + 40)
A.face(o0, "proud", 1.0)
A.head(o0 + 10, 8, 26, -4)
A.face(o0 + 14, "shocked", 0.6)
A.face(r0, "proud", 1.0)


def drum_speed_profile():
    """(frame, rev_per_sec) control points; integrated to angle (negative = CW from front)."""
    pts = [(1, 0), (CR0, 0), (CR1, 0), (n0 + 6, 0.0), (n0 + 18, -0.75), (o0 + 8, -0.75), (o0 + 16, 0.0),
           (o0 + 22, 0.75), (r0 + 18, 0.75), (r0 + 24, 0.0), (r0 + 30, -0.6), (r1, -0.6), (r1 + 12, -0.15),
           (S["10b"][1], -0.1), (S["11c"][0], 0.0), (S["11d"][0] + 6, 0.0), (S["11d"][0] + 18, 0.3),
           (S["11d"][1], 0.3), (S["12a"][0], 0.0), (S["12c"][0] + 14, 0.0), (S["12c"][0] + 30, -2.6),
           (S["13a"][0], -2.6), (S["13a"][0] + 10, -1.4), (TOTAL + 2, -1.4)]
    return pts


prof = drum_speed_profile()


def speed_at(f):
    for (fa, va), (fb, vb) in zip(prof, prof[1:]):
        if fa <= f <= fb:
            u = (f - fa) / max(1, fb - fa)
            return va + (vb - va) * u
    return 0.0


ang = END_CRANK
angles = {}
for f in range(CR1 + 1, TOTAL + 2):
    ang += speed_at(f) * 2 * math.pi / 30.0
    angles[f] = ang
for f in range(CR1 + 2, TOTAL + 2, 1 if True else 2):
    key_obj(drum_spin, f, rot=(0, math.degrees(angles[f]), 0), interp='LINEAR')
# clothes tumble: partial follow + wobble
for f in range(t7, TOTAL + 2, 2):
    da = angles.get(f, 0.0 if f < CR0 else (END_CRANK if f > CR1 else 0.0))
    if f < CR0:
        da = 0.0
    elif f <= CR1:
        u = (f - CR0) / (CR1 - CR0)
        da = -REV * 2 * math.pi * (u * u * (3 - 2 * u))
    fast = f >= S["12c"][0] + 20
    factor = 1.0 if fast else 0.32
    wob = 0.18 * math.sin(f * 0.37) if not fast else 0.0
    key_obj(in_root, f, rot=(0, math.degrees(da * factor + wob), 0), interp='LINEAR')
# fast spin: blobs fling to wall
SPIN_FAST = S["12c"][0] + 20
for b in in_blobs:
    p = b.location.copy()
    key_obj(b, SPIN_FAST - 1, loc=p)
    a = math.atan2(p.z, p.x) + R.uniform(-0.9, 0.9) + (math.pi if R.random() < 0.4 else 0)
    key_obj(b, SPIN_FAST + 8, loc=(0.26 * math.cos(a), p.y, 0.26 * math.sin(a)))
# arrows (pivot empties at drum axis so they pop from the centre)
acw = bpy.data.objects["Arrow_CW"]; accw = bpy.data.objects["Arrow_CCW"]
arrow_ranges = {acw: [(n0 + 8, o0 + 15), (r0 + 26, r1)], accw: [(o0 + 15, r0 + 26)]}
for o, ranges in arrow_ranges.items():
    piv = bpy.data.objects.new(o.name + "_piv", None); bpy.data.collections["DRUM"].objects.link(piv)
    piv.parent = drum_root; piv.location = (0, -0.33, AX)
    o.parent = piv; o.matrix_parent_inverse = Matrix.Identity(4); o.location = (0, 0.33, -AX)
    for ob in [o] + list(o.children):
        lib.hide_key(ob, 1, True)
        for fa, fb in ranges:
            lib.hide_key(ob, fa, False); lib.hide_key(ob, fb, True)
    key_obj(piv, 1, scale=1.0)
    for fa, fb in ranges:
        key_obj(piv, fa, scale=0.3); key_obj(piv, fa + 4, scale=1.08); key_obj(piv, fa + 7, scale=1.0)
# DrumWater appearance
for o in (drum_water,):
    lib.visible_between(o, r0, S["13a"][0] + 12)
dws = drum_water.scale
key_obj(drum_water, 1, scale=(1, 1, 1))
key_node_value(dw_mat, "Dirt", 1, 0.45)
key_node_value(dw_mat, "Dirt", r0, 0.45)
key_node_value(dw_mat, "Dirt", S["10a"][0], 1.0)
key_node_value(dw_mat, "Ripple", 1, 0.0)
key_node_value(dw_mat, "Ripple", TOTAL, 60.0)

# =================================================================== SHOT 10 marinating
m10, m10b = S["10a"][0], S["10b"][0]
fx.stink_cluster("Stink10", C_fx, OPEN + W((0, 0.18, -0.06)), n=4, spread=0.08, height=0.55, f_in=m10 + 4,
                 f_out=S["10b"][1] + 2, rng=R, radius=0.013, amp=0.04)
# bubbles in dirty water
for i in range(10):
    f = m10 + 3 + i * 8
    p = DR + W((R.uniform(-0.12, 0.12), R.uniform(-0.15, 0.1), AX - 0.17))
    fx.droplet(f"Bubble10_{i}", C_fx, p, (0, 0, 0.25), f, f + 10, size=0.018, g=0.0)

# =================================================================== SHOT 11 holes, tub, pump, rinse
h0, h1 = S["11a"]
drum_m = bpy.data.materials["M_DrumSteel"]
# perforation pattern driven by value node "Holes"
nt = drum_m.node_tree
p = nt.nodes["Principled BSDF"]
hv = nt.nodes.new("ShaderNodeValue"); hv.name = "Holes"; hv.outputs[0].default_value = 0.0
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
# cylindrical coords around lathe Z axis (object space of Drum shell)
atn = nt.nodes.new("ShaderNodeMath"); atn.operation = 'ARCTAN2'
nt.links.new(sep.outputs[1], atn.inputs[0]); nt.links.new(sep.outputs[0], atn.inputs[1])
uu = nt.nodes.new("ShaderNodeMath"); uu.operation = 'MULTIPLY'; uu.inputs[1].default_value = 0.34 * 1.0
nt.links.new(atn.outputs[0], uu.inputs[0])
cmb = nt.nodes.new("ShaderNodeCombineXYZ")
nt.links.new(uu.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[2], cmb.inputs[1])
vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = 'F1'; vor.inputs["Scale"].default_value = 28.0
vor.inputs["Randomness"].default_value = 0.0
nt.links.new(cmb.outputs[0], vor.inputs["Vector"])
dot = nt.nodes.new("ShaderNodeMath"); dot.operation = 'LESS_THAN'; dot.inputs[1].default_value = 0.22
nt.links.new(vor.outputs["Distance"], dot.inputs[0])
# reveal: random per cell vs Holes
rv = nt.nodes.new("ShaderNodeMath"); rv.operation = 'LESS_THAN'
nt.links.new(vor.outputs["Color"], rv.inputs[0]) if False else None
cellr = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(vor.outputs["Color"], cellr.inputs[0])
nt.links.new(cellr.outputs[0], rv.inputs[0]); nt.links.new(hv.outputs[0], rv.inputs[1])
# only on cylinder wall: radius > 0.3
rad = nt.nodes.new("ShaderNodeVectorMath"); rad.operation = 'LENGTH'
cxy = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(sep.outputs[0], cxy.inputs[0]); nt.links.new(sep.outputs[1], cxy.inputs[1])
nt.links.new(cxy.outputs[0], rad.inputs[0])
wall = nt.nodes.new("ShaderNodeMath"); wall.operation = 'GREATER_THAN'; wall.inputs[1].default_value = 0.31
nt.links.new(rad.outputs["Value"], wall.inputs[0])
zin = nt.nodes.new("ShaderNodeMath"); zin.operation = 'LESS_THAN'; zin.inputs[1].default_value = 0.42
nt.links.new(sep.outputs[2], zin.inputs[0])
zin2 = nt.nodes.new("ShaderNodeMath"); zin2.operation = 'GREATER_THAN'; zin2.inputs[1].default_value = 0.05
nt.links.new(sep.outputs[2], zin2.inputs[0])
m_a = nt.nodes.new("ShaderNodeMath"); m_a.operation = 'MULTIPLY'; nt.links.new(dot.outputs[0], m_a.inputs[0]); nt.links.new(rv.outputs[0], m_a.inputs[1])
m_b = nt.nodes.new("ShaderNodeMath"); m_b.operation = 'MULTIPLY'; nt.links.new(m_a.outputs[0], m_b.inputs[0]); nt.links.new(wall.outputs[0], m_b.inputs[1])
m_c = nt.nodes.new("ShaderNodeMath"); m_c.operation = 'MULTIPLY'; nt.links.new(m_b.outputs[0], m_c.inputs[0]); nt.links.new(zin.outputs[0], m_c.inputs[1])
m_d = nt.nodes.new("ShaderNodeMath"); m_d.operation = 'MULTIPLY'; nt.links.new(m_c.outputs[0], m_d.inputs[0]); nt.links.new(zin2.outputs[0], m_d.inputs[1])
hole_col = nt.nodes.new("ShaderNodeMix"); hole_col.data_type = 'RGBA'
hole_col.inputs["A"].default_value = lib.srgb("#8D9095"); hole_col.inputs["B"].default_value = (0.01, 0.01, 0.012, 1)
nt.links.new(m_d.outputs[0], hole_col.inputs["Factor"])
nt.links.new(hole_col.outputs[2], p.inputs["Base Color"])
hm = nt.nodes.new("ShaderNodeMath"); hm.operation = 'SUBTRACT'; hm.inputs[0].default_value = 0.85
nt.links.new(m_d.outputs[0], hm.inputs[1])
nt.links.new(hm.outputs[0], p.inputs["Metallic"])
key_node_value(drum_m, "Holes", 1, 0.0)
key_node_value(drum_m, "Holes", h0 + 6, 0.0)
key_node_value(drum_m, "Holes", h1 - 6, 1.01)
# 11b outer tub (trough) pops
u0, u1 = S["11b"]
outer = bpy.data.objects["OuterTubRig"]
for o in [outer] + outer.children_recursive:
    lib.visible_between(o, u0 + 6, TOTAL + 10)
key_obj(outer, u0 + 6, scale=0.0)
key_obj(outer, u0 + 11, scale=1.08)
key_obj(outer, u0 + 15, scale=1.0)
# 11c pump
pmp0, pmp1 = S["11c"]
pump_objs = [bpy.data.objects[n] for n in ("PumpRig", "Hose_drain", "Hose_out", "Drain_grate")]
for o in pump_objs:
    for oo in [o] + o.children_recursive:
        lib.visible_between(oo, u0 + 18, S["13a"][0] + 5)
fan = bpy.data.objects["Pump_fan"]; fan2 = bpy.data.objects["Pump_fan2"]
for fo in (fan, fan2):
    key_obj(fo, pmp0, rot=(0, 0, 0), interp='LINEAR')
    key_obj(fo, S["11d"][1], rot=(1440 * 3, 0, 0), interp='LINEAR')
out_end = DR + W((1.3, -1.05, 0.03))
brown = fx.stream("DrainStream", C_fx, out_end + W((0.0, 0.0, 0.03)), DR + W((1.36, -1.16, 0.0)), radius=0.034,
                  color="#6E4E2A", emit=0.15)
puddle = lib.cylinder("BrownPuddle", 0.3, 0.004, DR + W((1.36, -1.16, 0.003)), (0, 0, 0), 40, C_fx)
lib.assign(puddle, lib.mat("M_BrownPuddle", "#4F3216", rough=0.08, spec=0.8))
puddle.visible_shadow = False
key_obj(puddle, pmp0 + 2, scale=(0.05, 0.05, 1)); key_obj(puddle, pmp0 + 22, scale=(1.0, 0.8, 1))
lib.visible_between(puddle, pmp0 + 2, S["11d"][0])
lib.visible_between(brown, pmp0 + 3, S["11d"][0] + 8)
for i in range(24):
    f = pmp0 + 3 + int(i * 1.5)
    dd = fx.droplet(f"DrainSplash_{i}", C_fx, DR + W((1.36, -1.16, 0.01)), (R.uniform(-0.5, 0.5), R.uniform(-0.5, 0.5), R.uniform(0.8, 1.4)),
               f, f + 10, size=0.016, floor_z=0.0)
    dd.material_slots[0].link = 'OBJECT'
    dd.material_slots[0].material = bpy.data.materials["M_BrownPuddle"]
key_obj(drum_water, pmp0, scale=(1, 1, 1))
key_obj(drum_water, pmp1, scale=(1, 1, 0.05))
# 11d rinse
q0d, q1d = S["11d"]
inlet = [bpy.data.objects["Hose_in"], bpy.data.objects["Hose_nozzle"]]
for o in inlet:
    lib.visible_between(o, q0d, S["13a"][0] + 5)
noz = DR + W((0.0, -0.5, 1.16))
clean = fx.stream("CleanStream", C_fx, noz, OPEN + W((0, 0.15, -0.12)), radius=0.022, color="#BFE6FA", emit=0.6)
lib.visible_between(clean, q0d + 4, q1d)
key_obj(drum_water, q0d + 4, scale=(1, 1, 0.05))
key_obj(drum_water, q0d + 40, scale=(1, 1, 1.0))
key_node_value(dw_mat, "Dirt", q0d + 4, 1.0)
key_node_value(dw_mat, "Dirt", q0d + 6, 0.15)
key_node_value(dw_mat, "Dirt", q1d, 0.0)
key_node_value(dw_mat, "Foam", 1, 0.0)
key_node_value(dw_mat, "Foam", q0d + 5, 0.0)
key_node_value(dw_mat, "Foam", q0d + 6, 0.7)
key_node_value(dw_mat, "Foam", q1d, 0.0)
for i in range(10):
    f = q0d + 6 + i * 5
    fx.droplet(f"RinseSplash_{i}", C_fx, OPEN + W((R.uniform(-0.05, 0.05), 0.15, -0.12)),
               (R.uniform(-0.4, 0.4), R.uniform(-0.6, -0.2), R.uniform(0.7, 1.3)), f, f + 10, size=0.011,
               floor_z=OPEN.z - 0.25)

# =================================================================== SHOT 12 clean, dripping, spin, fling
e0, e1 = S["12a"]
A.feet(e0)
undies_hold(e0, True)
key_node_value(undies_mat, "Stain", e0, 0.0)
key_node_value(undies_mat, "Wet", e0, 0.75)
A.hands(e0, l=(0.27, -0.38, 1.42), r=(-0.27, -0.38, 1.42), el=(0.5, 0.15, 1.1), er=(-0.5, 0.15, 1.1))
A.hands(e0 + 20, l=(0.27, -0.38, 1.47), r=(-0.27, -0.38, 1.47))
A.hands(e1, l=(0.27, -0.38, 1.45), r=(-0.27, -0.38, 1.45))
A.spine(e0, -5); A.head(e0, -10, 0, 0)
A.face(e0, "proud", 1.0)
A.face(e0 + 12, "grin", 1.0)
A.head(e0 + 18, -14, -5, -5)
# sparkles
star_m = lib.mat("M_Sparkle", "#FFFFFF", emit="#FFFFFF", emit_strength=6.0)
for i in range(4):
    fsp = e0 + 8 + i * 9
    bm_star = __import__("bmesh").new()
    import bmesh
    verts = []
    for kk in range(8):
        aa = math.pi * kk / 4
        rr = 1.0 if kk % 2 == 0 else 0.25
        verts.append(bm_star.verts.new((rr * math.cos(aa), 0, rr * math.sin(aa))))
    bm_star.faces.new(verts)
    st = lib.mesh_from_bmesh(f"Sparkle_{i}", bm_star, C_fx, smooth=False)
    lib.assign(st, star_m)
    st.visible_shadow = False
    loc, rz = place_at(fsp)
    st.location = A.arm_to_world(W((R.uniform(-0.2, 0.2), -0.48, R.uniform(1.05, 1.4))), loc, rz)
    st.rotation_euler = (0, 0, math.radians(rz))
    key_obj(st, fsp, scale=0.0); key_obj(st, fsp + 4, scale=0.05); key_obj(st, fsp + 9, scale=0.0)
    lib.visible_between(st, fsp, fsp + 10)
# 12b dripping
y0, y1 = S["12b"]
A.face(y0, "serious", 1.0)
A.face(y0 + 20, "tired", 0.8)
A.hands(y0, l=(0.27, -0.38, 1.42), r=(-0.27, -0.38, 1.42))
A.hands(y1, l=(0.27, -0.38, 1.41), r=(-0.27, -0.38, 1.41))
A.head(y0, 4, 0, 0)
for i, f in enumerate(range(e0 + 30, y1, 3)):
    loc, rz = place_at(f)
    xo = [-0.05, 0.0, 0.05, -0.02, 0.03][i % 5]
    p = A.arm_to_world(W((xo, -0.44, 1.13)), loc, rz)
    fx.droplet(f"Drip12_{i}", C_fx, p, (0, 0, -0.1), f, f + 20, size=0.0095, floor_z=0.0)
# 12c toss + spin fast
z0, z1 = S["12c"]
A.feet(z0)
A.face(z0, "smug", 1.0)
A.hands(z0, l=(0.26, -0.4, 1.4), r=(-0.26, -0.4, 1.4))
A.hands(z0 + 4, l=(0.26, -0.25, 1.2), r=(-0.26, -0.25, 1.2))
A.hands(z0 + 9, l=(0.22, -0.6, 1.45), r=(-0.22, -0.6, 1.45))
A.spine(z0 + 4, 14); A.spine(z0 + 9, 0)
TOSS = z0 + 9
undies_hold(TOSS, False)
loc, rz = place_at(TOSS)
st0 = A.arm_to_world(W((0, -0.64, 1.4)), loc, rz)
for j in range(0, 9):
    tt = j / 8
    pos = st0.lerp(OPEN + W((0, 0.18, -0.05)), tt) + W((0, 0, 0.3 * math.sin(math.pi * tt)))
    key_obj(undies, TOSS + j, loc=pos, rot=(-90 + 40 * j, 20 * j, rz))
lib.hide_key(undies, 1, False)
lib.hide_key(undies, S['5a'][0], True)
lib.hide_key(undies, S['12a'][0], False)
lib.hide_key(undies, TOSS + 9, True)
A.hands(z0 + 16, r=(-0.25, -0.62, 1.42), l=(0.27, -0.06, 0.88), er=(-0.45, 0.25, 1.25), el=(0.35, 0.3, 1.1))
A.fingers(z0 + 16, "r", 75, thumb=40)
A.rot(z0 + 16, "index_01_r", 0, 0, 0); A.rot(z0 + 16, "index_02_r", 0, 0, 0); A.rot(z0 + 16, "index_03_r", 0, 0, 0)
A.face(z0 + 22, "grin", 1.0)
# spin lines
spl = fx.spin_lines("SpinLines", C_fx, DR + W((0, 0, AX)), radius=0.47, n=5, y=-0.3)
lib.visible_between(spl, SPIN_FAST, S["13a"][0] + 6)
for ch in spl.children:
    lib.visible_between(ch, SPIN_FAST, S["13a"][0] + 6)
for f in range(SPIN_FAST, S["13a"][0] + 8, 1):
    key_obj(spl, f, rot=(0, -(f - SPIN_FAST) * 41.0, 0), interp='LINEAR')
# machine vibration
for f in range(SPIN_FAST, S["13a"][0] + 2, 2):
    key_obj(drum_root, f, loc=DR + W((0.004 * R.uniform(-1, 1), 0.004 * R.uniform(-1, 1), 0.0)))
key_obj(drum_root, S["13a"][0] + 3, loc=DR)
key_obj(drum_water, SPIN_FAST, scale=(1, 1, 1.0))
key_obj(drum_water, SPIN_FAST + 30, scale=(1, 1, 0.02))
# 12d fling droplets radially
fl0, fl1 = S["12d"]
for i in range(380):
    f = R.randint(SPIN_FAST + 4, fl1 - 4)
    a = R.uniform(0, 2 * math.pi)
    yy = R.uniform(-0.22, 0.22)
    p0w = DR + W((0.36 * math.cos(a), yy, AX + 0.36 * math.sin(a)))
    tang = W((-math.sin(a), 0, math.cos(a)))  # direction of drum surface motion
    radv = W((math.cos(a), 0, math.sin(a)))
    v = radv * R.uniform(1.2, 2.2) + tang * R.uniform(1.5, 2.8) + W((0, R.uniform(-0.3, 0.3), 0))
    fx.droplet(f"Fling_{i}", C_fx, p0w, v, f, f + 16, size=R.uniform(0.012, 0.02), floor_z=0.0)

# =================================================================== SHOT 13 congratulations
c13, c131 = S["13a"]
d13, d131 = S["13b"]
cab = bpy.data.objects["CabinetRig"]
bpy.data.objects.remove(bpy.data.objects["Cab_doorGlass"], do_unlink=True)
for o in [cab] + cab.children_recursive:
    lib.visible_between(o, c13 + 4, TOTAL + 10)
key_obj(cab, c13 + 4, scale=0.0)
key_obj(cab, c13 + 9, scale=1.06)
key_obj(cab, c13 + 13, scale=1.0)
for o in (bpy.data.objects["OuterTubRig"],):
    pass
big = fx.poof("BigPoof", C_fx, DR + W((0, -0.2, 0.75)), c13 + 3, size=1.5, dur=14)
A.feet(c13)
A.hands(c13, l=(0.27, -0.05, 0.86), r=(-0.27, -0.05, 0.86), el=(0.35, 0.3, 1.1), er=(-0.35, 0.3, 1.1))
A.face(c13, "shocked", 0.9)
A.spine(c13, -2); A.head(c13, -4, 20, 0)
A.fingers(c13, "l", 30); A.fingers(c13, "r", 30)
RAISE = dict(l=(0.42, -0.14, 2.0), r=(-0.42, -0.14, 2.0), el=(0.6, 0.2, 1.5), er=(-0.6, 0.2, 1.5))
A.hands(d13 + 3, **RAISE)
A.hands(d13 + 1, l=(0.3, -0.15, 1.2), r=(-0.3, -0.15, 1.2))
A.face(d13 + 2, "grin", 1.0, extra={"jawOpen": 0.3})
A.head(d13 + 4, -12, 0, 0)
A.spine(d13 + 4, -8)
A.fingers(d13 + 3, "l", 10); A.fingers(d13 + 3, "r", 10)
for k4, f in enumerate(range(d13 + 10, TOTAL + 1, 9)):
    sg = 1 if k4 % 2 == 0 else -1
    A.hands(f, l=(0.42, -0.14, 2.0 + 0.04 * sg), r=(-0.42, -0.14, 2.0 - 0.04 * sg))
A.pelvis(d13 + 30, (0, 0, -0.03)); A.pelvis(d13 + 36, (0, 0, 0)); A.pelvis(d13 + 42, (0, 0, -0.02)); A.pelvis(d13 + 48, (0, 0, 0))
A.pelvis(1, (0, 0, 0))
# confetti
conf_cols = ["#E63946", "#F4D35E", "#3A86FF", "#2BA84A", "#FF7F11", "#9B5DE5", "#F15BB5"]
cmats = [lib.mat(f"M_Conf{i}", c, rough=0.5, emit=c, emit_strength=0.4) for i, c in enumerate(conf_cols)]
import bmesh
for i in range(70):
    bmc = bmesh.new()
    bmesh.ops.create_grid(bmc, x_segments=1, y_segments=1, size=1.0)
    co = lib.mesh_from_bmesh(f"Confetti_{i}", bmc, C_fx, smooth=False)
    co.data.materials.append(cmats[i % len(cmats)])
    co.scale = (0.018, 0.03, 1)
    co.visible_shadow = False
    fst = c13 + 4 + R.randint(0, 20)
    x = R.uniform(1.0, 3.6); y = R.uniform(-1.9, 0.2)
    z0c = R.uniform(2.4, 3.4)
    vz = -R.uniform(0.6, 1.0)
    for f in range(fst, TOTAL + 2, 3):
        tt = (f - fst) / 30
        zz = z0c + vz * tt
        if zz < 0.01:
            zz = 0.01
        key_obj(co, f, loc=(x + 0.08 * math.sin(tt * 5 + i), y + 0.05 * math.cos(tt * 4 + i), zz),
                rot=(tt * 400 + i * 20, tt * 260, i * 37))
    lib.visible_between(co, fst, TOTAL + 10)
# blinks sprinkled
for f in (S["4a"][0] + 20, S["9b"][0] + 8, S["12b"][0] + 12):
    A.blink(f)

# =================================================================== CAMERAS
def CAM(n, loc, tgt, lens, loc2=None, tgt2=None, lens2=None):
    f0c, f1c = S[n]
    cam = make_cam("CAM_" + n, loc, tgt, lens, f0c, sc, C_cam)
    if loc2 is not None:
        cam_move(cam, f0c, f1c - 1, loc, tgt, loc2, tgt2 or tgt, lens, lens2 or lens)
    return cam


cams = {}
cams["1a"] = CAM("1a", (0.02, -2.05, 1.38), (0, -0.1, 1.35), 38, (0.02, -1.92, 1.39), (0, -0.1, 1.36))
cams["1b"] = CAM("1b", (0.3, -1.2, 1.5), (0.0, -0.05, 1.6), 46, (0.28, -1.12, 1.52), (0.0, -0.05, 1.61))
cams["1c"] = CAM("1c", (0.05, -1.48, 1.95), (0, -0.42, 1.05), 30, (0.04, -1.42, 1.9), (0, -0.44, 1.03))
cams["2a"] = CAM("2a", (-0.42, -2.1, 1.47), (0, -0.2, 1.4), 36, (-0.38, -2.0, 1.48), (0, -0.2, 1.4))
cams["3a"] = CAM("3a", (0.95, -1.5, 1.38), (0.12, -0.5, 1.07), 34, (0.9, -1.45, 1.36), (0.12, -0.5, 1.07))
cams["3b"] = CAM("3b", (0.05, -1.05, 1.78), (0, -0.48, 1.07), 30, (0.04, -1.02, 1.74), (0, -0.48, 1.07))
cams["4a"] = CAM("4a", (0.1, -2.0, 1.4), (0, -0.1, 1.45), 38, (0.08, -1.9, 1.4), (0, -0.1, 1.46))
cams["4b"] = CAM("4b", (1.5, -3.7, 1.55), (-0.55, -0.2, 1.0), 26, (1.45, -3.6, 1.56), (-0.55, -0.2, 1.0))
cams["4c"] = CAM("4c", (1.0, -2.75, 0.62), (-0.85, -0.15, 1.25), 24, (0.95, -2.62, 0.63), (-0.85, -0.15, 1.27))
cams["5a"] = CAM("5a", (-5.8, -17.2, 6.9), (-13.6, -5.4, 0.4), 22, (-6.6, -17.2, 6.8), (-14.2, -5.4, 0.4))
cams["5b"] = CAM("5b", (-12.35, -17.0, 1.55), (-12.8, -13.4, 1.3), 31, (-12.35, -16.8, 1.55), (-12.8, -13.4, 1.3))
cams["6a"] = CAM("6a", (-14.75, -15.95, 1.5), (-14.75, -12.4, 1.3), 34, (-14.75, -15.8, 1.5), (-14.75, -12.4, 1.32))
cams["6b"] = CAM("6b", (-6.7, -17.3, 5.7), (-12.8, -7.6, -1.5), 20, (-6.9, -17.2, 5.9), (-12.9, -7.4, -1.7))
cams["7a"] = CAM("7a", (1.2, -3.05, 1.3), (2.65, -0.65, 0.9), 27, (1.25, -2.95, 1.3), (2.65, -0.65, 0.9))
cams["7b"] = CAM("7b", (2.5, -2.05, 1.12), (2.78, 0.1, 1.12), 28, (2.52, -1.95, 1.12), (2.78, 0.1, 1.12))
cams["7c"] = CAM("7c", (2.68, -0.9, 1.63), (2.85, 0.95, 1.6), 45, (2.68, -0.82, 1.63), (2.85, 0.95, 1.6))
cams["8a"] = CAM("8a", (1.52, -1.62, 1.45), (1.74, -0.15, 1.36), 38, (1.53, -1.54, 1.45), (1.74, -0.15, 1.36))
cams["8a2"] = CAM("8a2", (1.42, -0.98, 1.62), (1.73, -0.15, 1.64), 50, (1.43, -0.94, 1.62), (1.73, -0.15, 1.64))
cams["8b"] = CAM("8b", (3.75, 1.2, 0.62), (2.72, 0.28, 0.32), 28, (3.7, 1.14, 0.61), (2.72, 0.28, 0.32))
cams["9a"] = CAM("9a", (1.55, -3.05, 1.3), (2.45, -0.4, 0.95), 27, (1.6, -2.95, 1.3), (2.45, -0.4, 0.95))
cams["9b"] = CAM("9b", (2.15, -2.3, 1.15), (2.7, -0.45, 0.92), 32, (2.17, -2.2, 1.15), (2.7, -0.45, 0.92))
cams["9c"] = CAM("9c", (2.72, -1.6, 0.98), (2.7, -0.4, 0.86), 40, (2.72, -1.5, 0.97), (2.7, -0.4, 0.86))
cams["10a"] = CAM("10a", (2.7, -0.98, 1.0), (2.7, -0.1, 0.72), 30, (2.7, -0.93, 0.99), (2.7, -0.1, 0.72))
cams["10b"] = CAM("10b", (2.5, -1.5, 1.08), (2.7, -0.5, 1.08), 34, (2.52, -1.42, 1.08), (2.7, -0.5, 1.1))
cams["11a"] = CAM("11a", (3.8, -1.65, 1.22), (2.75, -0.3, 0.86), 32, (3.75, -1.58, 1.2), (2.75, -0.3, 0.86))
cams["11b"] = CAM("11b", (1.55, -2.75, 1.35), (2.7, -0.3, 0.8), 28, (1.6, -2.65, 1.33), (2.7, -0.3, 0.8))
cams["11c"] = CAM("11c", (3.35, -2.2, 0.45), (3.85, -1.25, 0.08), 28, (3.37, -2.12, 0.44), (3.85, -1.25, 0.08))
cams["11d"] = CAM("11d", (2.6, -1.8, 1.32), (2.7, -0.55, 1.0), 35, (2.62, -1.72, 1.3), (2.7, -0.55, 1.0))
cams["12a"] = CAM("12a", (1.2, -2.85, 1.36), (1.6, -1.05, 1.38), 34, (1.22, -2.75, 1.36), (1.6, -1.05, 1.38))
cams["12b"] = CAM("12b", (1.32, -2.4, 1.42), (1.62, -1.4, 1.32), 36, (1.33, -2.33, 1.42), (1.62, -1.4, 1.32))
cams["12c"] = CAM("12c", (1.3, -3.0, 1.32), (2.35, -0.6, 0.95), 27, (1.32, -2.9, 1.32), (2.35, -0.6, 0.95))
cams["12d"] = CAM("12d", (3.9, -1.8, 1.25), (2.75, -0.35, 0.86), 30, (3.85, -1.72, 1.23), (2.75, -0.35, 0.86))
cams["13a"] = CAM("13a", (2.2, -2.7, 0.55), (2.7, -0.3, 1.0), 26, (2.22, -2.6, 0.56), (2.7, -0.3, 1.02))
cams["13b"] = CAM("13b", (1.25, -3.45, 0.68), (2.2, -0.4, 1.15), 26, (1.4, -3.05, 0.74), (2.2, -0.4, 1.18))
# shakes
shake(cams["4b"], LAND - 1, LAND + 12, 1.1, seed=1)
shake(cams["6b"], DROP0 + 4, DROP0 + 22, 0.9, seed=2)
shake(cams["11b"], u0 + 10, u0 + 20, 0.8, seed=3)
shake(cams["12d"], fl0, fl1 - 1, 0.45, seed=4, decay=False, step=2)
shake(cams["12c"], SPIN_FAST, z1 - 1, 0.35, seed=5, decay=False, step=2)
shake(cams["13a"], c13 + 3, c13 + 15, 0.9, seed=6)
shake(cams["8b"], MOTOR_LAND, MOTOR_LAND + 8, 0.8, seed=7)
sc.camera = cams["1a"]

# =================================================================== visibility optimisations
# main table stuff not needed in drum shots? keep (cheap). Pile hidden outside its shots (done).
for o in bpy.data.objects:
    if o.type == 'CAMERA':
        continue
# ---------------------------------------------------------------- polish pass
polish.life_noise(rig, k=1.0, seed=11)
for vi, cl in enumerate(variants):
    wr = [o for o in cl.objects if o.type == 'ARMATURE'][0]
    polish.life_noise(wr, k=0.7, seed=20 + vi)
polish.auto_blinks(rig, first=20, last=TOTAL - 10, gap=(70, 105), seed=5)
polish.camera_drift(list(cams.values()), deg=0.3, scale=42)
for n, l0, l1 in (("1b", 46, 54), ("7c", 45, 53), ("8a2", 50, 58), ("12b", 36, 42), ("13b", 26, 29)):
    polish.lens_punch(cams[n], S[n][0], S[n][1] - 1, l0, l1)
img = bpy.data.images.load("/opt/work/assets/polyhaven/abandoned_hall_01/abandoned_hall_01_2k.exr", check_existing=True)
px = img.pixels[:]
idx = range(0, len(px) - 4, 4 * 97)
lum = sum(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] for i in idx) / len(idx)
hdri_strength = max(0.3, min(3.0, 0.62 / max(lum, 1e-3)))
print("HDRI mean lum", lum, "strength", hdri_strength)
polish.hdri_world(sc, img.filepath, strength=hdri_strength, rot_deg=40)
polish.better_metals()
sc["shots"] = {k: list(v) for k, v in S.items()}
sc.world.use_sun_shadow = False
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/anim.blend")
print("ANIM saved", time.time() - t0)
