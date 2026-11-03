"""Shared helpers for the Cute Cat reels (Blender 4.5, bpy).

Contains:
  * colour + node-building helpers (used by every build script)
  * the CuteCat geometry constants
  * the pose/animation API for the CuteCat rig (walk, sit, look, tail, blink, hiss, jump)

The same pose functions create the reusable actions saved in cute_cat.blend and
bake the per-shot animation of every reel, so the cat always moves the same way.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

# ----------------------------------------------------------------------------
# colour helpers
# ----------------------------------------------------------------------------

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, a=1.0):
    """'#RRGGBB' (sRGB) -> linear RGBA tuple for Blender colour sockets."""
    h = h.lstrip('#')
    return (_lin(int(h[0:2], 16) / 255), _lin(int(h[2:4], 16) / 255),
            _lin(int(h[4:6], 16) / 255), a)


# ----------------------------------------------------------------------------
# node helpers (work for shader and compositor trees)
# ----------------------------------------------------------------------------

def N(nt, typ, x=0, y=0, **props):
    n = nt.nodes.new(typ)
    n.location = (x, y)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def sock_in(node, key):
    """Find an input socket by identifier first, then by name/index."""
    if isinstance(key, int):
        return node.inputs[key]
    for s in node.inputs:
        if s.identifier == key:
            return s
    for s in node.inputs:
        if s.name == key and s.enabled:
            return s
    return node.inputs[key]


def sock_out(node, key=0):
    if isinstance(key, int):
        return node.outputs[key]
    for s in node.outputs:
        if s.identifier == key:
            return s
    for s in node.outputs:
        if s.name == key and s.enabled:
            return s
    return node.outputs[key]


def setin(nt, node, key, v):
    s = sock_in(node, key)
    if isinstance(v, bpy.types.NodeSocket):
        nt.links.new(v, s)
    else:
        s.default_value = v
    return s


def M(nt, op, a, b=None, c=None, clamp=False):
    """Scalar math node; a/b/c may be floats or sockets. Returns output socket."""
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    for i, x in enumerate((a, b, c)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            nt.links.new(x, n.inputs[i])
    return n.outputs[0]


def VM(nt, op, a, b=None, scale=None):
    n = nt.nodes.new('ShaderNodeVectorMath')
    n.operation = op
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (tuple, list, Vector)):
            n.inputs[i].default_value = tuple(x)
        else:
            nt.links.new(x, n.inputs[i])
    if scale is not None:
        setin(nt, n, 'Scale', scale)
    if op in ('LENGTH', 'DOT_PRODUCT', 'DISTANCE'):
        return n.outputs['Value']
    return n.outputs['Vector']


def SEP(nt, vec):
    n = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(vec, n.inputs[0])
    return n.outputs[0], n.outputs[1], n.outputs[2]


def COMB(nt, x, y, z):
    n = nt.nodes.new('ShaderNodeCombineXYZ')
    for i, v in enumerate((x, y, z)):
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def SMOOTH(nt, x, e0, e1):
    """smoothstep(e0, e1, x) via Map Range (clamped)."""
    n = nt.nodes.new('ShaderNodeMapRange')
    n.data_type = 'FLOAT'
    n.interpolation_type = 'SMOOTHSTEP'
    n.clamp = True
    setin(nt, n, 'Value', x)
    setin(nt, n, 'From Min', e0)
    setin(nt, n, 'From Max', e1)
    setin(nt, n, 'To Min', 0.0)
    setin(nt, n, 'To Max', 1.0)
    return n.outputs['Result']


def MIXC(nt, fac, a, b, blend='MIX'):
    """Colour mix (ShaderNodeMix RGBA). a/b colours or sockets."""
    n = nt.nodes.new('ShaderNodeMix')
    n.data_type = 'RGBA'
    n.blend_type = blend
    n.clamp_result = False
    setin(nt, n, 'Factor_Float', fac)
    setin(nt, n, 'A_Color', a)
    setin(nt, n, 'B_Color', b)
    return sock_out(n, 'Result_Color')


def RGB(nt, col):
    n = nt.nodes.new('ShaderNodeRGB')
    n.outputs[0].default_value = col
    return n.outputs[0]


def VALUE(nt, v, name=None):
    n = nt.nodes.new('ShaderNodeValue')
    n.outputs[0].default_value = v
    if name:
        n.name = name
        n.label = name
    return n


def ELLIPSE_MASK(nt, p, center, radii, soft=0.35):
    """1 inside ellipsoid(center, radii) with a soft edge, 0 outside."""
    d = VM(nt, 'LENGTH', VM(nt, 'DIVIDE', VM(nt, 'SUBTRACT', p, center), radii))
    return M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, d, 1.0 - soft, 1.0))


def new_material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return mat, nt


def principled(nt, color, rough=0.5, x=0, y=0, **kw):
    b = N(nt, 'ShaderNodeBsdfPrincipled', x, y)
    setin(nt, b, 'Base Color', color)
    setin(nt, b, 'Roughness', rough)
    for k, v in kw.items():
        setin(nt, b, k, v)
    return b


def output(nt, shader_socket, x=600, y=0):
    o = N(nt, 'ShaderNodeOutputMaterial', x, y)
    o.target = 'ALL'
    nt.links.new(shader_socket, o.inputs['Surface'])
    return o


# ----------------------------------------------------------------------------
# mesh helpers
# ----------------------------------------------------------------------------

def quad_sphere(cuts=5):
    """Unit quad-sphere (cube projected to sphere) – subdivides beautifully."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co = v.co.normalized()
    return bm


def bm_xform(bm, mat):
    bmesh.ops.transform(bm, matrix=mat, verts=bm.verts[:])


def make_obj(name, bm, coll, mats=(), smooth=True, subsurf=2, view_levels=None):
    me = bpy.data.meshes.new(name)
    for f in bm.faces:
        f.smooth = smooth
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    if subsurf:
        mod = ob.modifiers.new('Subsurf', 'SUBSURF')
        mod.levels = subsurf if view_levels is None else view_levels
        mod.render_levels = subsurf
        mod.quality = 3
    return ob


def frame_from_forward(fwd, up=(0, 0, 1)):
    """3x3 rotation whose local -Y points along fwd and local Z ~ up."""
    Y = -Vector(fwd).normalized()
    X = Y.cross(Vector(up)).normalized()
    Z = X.cross(Y).normalized()
    return Matrix((X, Y, Z)).transposed()


def frame_from_up(upv, fwd_hint=(0, -1, 0)):
    """3x3 rotation whose local Z points along upv and local -Y ~ fwd_hint."""
    Z = Vector(upv).normalized()
    Y = -Vector(fwd_hint)
    Y = (Y - Z * Y.dot(Z)).normalized()
    X = Y.cross(Z).normalized()
    return Matrix((X, Y, Z)).transposed()


# ----------------------------------------------------------------------------
# CuteCat rig constants (cat faces -Y, ground at z=0, metres)
# ----------------------------------------------------------------------------

LEG_LEN = 0.078           # leg pivot -> paw centre
PAW_H = 0.021             # paw centre height when planted
BODY_PIVOT = Vector((0.0, -0.065, 0.123))
LEG_PIVOTS = {
    'leg_f.L': Vector((0.043, -0.072, 0.099)),
    'leg_f.R': Vector((-0.043, -0.072, 0.099)),
    'leg_b.L': Vector((0.047, 0.074, 0.099)),
    'leg_b.R': Vector((-0.047, 0.074, 0.099)),
}
TAIL_BONES = ['tail.1', 'tail.2', 'tail.3', 'tail.4']
MOUTH_PUSH = 0.016        # how far the open mouth hides inside the head at rest
CONTROL_BONES = (['root', 'body', 'head', 'ear.L', 'ear.R', 'eye.L', 'eye.R', 'lid.L', 'lid.R',
                  'mouth', 'mouth_w'] + list(LEG_PIVOTS) +
                 ['paw_f.L', 'paw_f.R', 'paw_b.L', 'paw_b.R'] + TAIL_BONES)


def _rx(theta, v):
    """rotate (y,z) of a vector about X by theta."""
    c, s = math.cos(theta), math.sin(theta)
    return Vector((v.x, v.y * c - v.z * s, v.y * s + v.z * c))


class CatState:
    """All the animatable controls of the CuteCat rig in one place."""

    def __init__(self):
        self.root = Vector((0, 0, 0))     # root offset (cat space)
        self.body_pitch = 0.0              # + = chest down / hips up, - = hips down
        self.body_roll = 0.0
        self.body_yaw = 0.0
        self.head_yaw = 0.0                # + = look to cat's left
        self.head_pitch = 0.0              # + = nod down
        self.head_roll = 0.0
        self.head_offset = Vector((0, 0, 0))
        # paw targets in cat space (None -> planted under pivot)
        self.paws = {k: None for k in LEG_PIVOTS}
        self.paw_tilt = {k: 0.0 for k in LEG_PIVOTS}   # extra paw rotation
        self.tail = [(0.0, 0.0) for _ in TAIL_BONES]    # (curl_x, sway_z) per bone
        self.ears_back = 0.0               # 0..1
        self.ear_twitch = (0.0, 0.0)       # extra rot for L/R
        self.blink = 0.0                   # 0 open .. 1 closed
        self.blink_lr = None               # optional (l, r)
        self.eye_scale = 1.0               # uniform pop scale
        self.squint = 0.0                  # 0..1 (narrow eyes)
        self.angry = 0.0                   # 0..1 angry slanted upper lids
        self.slit = 0.0                    # 0..1 slit pupils
        self.mouth_open = 0.0              # 0..1 (1 = full hiss)
        self.body_scale = Vector((1, 1, 1))

    def copy(self):
        c = CatState()
        for k, v in self.__dict__.items():
            if isinstance(v, Vector):
                setattr(c, k, v.copy())
            elif isinstance(v, dict):
                setattr(c, k, {kk: (vv.copy() if isinstance(vv, Vector) else vv) for kk, vv in v.items()})
            elif isinstance(v, list):
                setattr(c, k, list(v))
            else:
                setattr(c, k, v)
        return c


def pivot_world(state, leg):
    """Leg pivot position (cat space) after root offset + body pitch."""
    p = LEG_PIVOTS[leg]
    return state.root + BODY_PIVOT + _rx(state.body_pitch, p - BODY_PIVOT)


def default_paw(leg):
    p = LEG_PIVOTS[leg]
    return Vector((p.x, p.y - 0.004, PAW_H))


def apply_state(rig, st):
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'XYZ'
    pb['root'].location = st.root
    pb['root'].rotation_euler = (0, 0, 0)
    pb['body'].rotation_euler = (st.body_pitch, st.body_yaw, st.body_roll)
    pb['body'].scale = st.body_scale
    # head: bone points up -> local Y = up (yaw), X = pitch, Z = roll
    # counter the body pitch so head pitch is in world terms
    pb['head'].rotation_euler = (st.head_pitch - st.body_pitch, st.head_yaw, st.head_roll)
    pb['head'].location = st.head_offset
    # legs (2D IK in the sagittal plane)
    for leg in LEG_PIVOTS:
        tgt = st.paws[leg] if st.paws[leg] is not None else default_paw(leg)
        P = pivot_world(st, leg)
        d = Vector(tgt) - P
        beta = math.atan2(d.y, -d.z)
        length = max(0.35 * LEG_LEN, math.hypot(d.y, d.z))
        b = pb[leg]
        b.rotation_euler = (beta - st.body_pitch, 0.0, 0.0)
        b.scale = (1.0, length / LEG_LEN, 1.0)
        paw = pb[leg.replace('leg', 'paw')]
        # paw bone does not inherit scale; keep the paw flat to the ground
        paw.rotation_euler = (-beta + st.paw_tilt[leg], 0.0, 0.0)
    # tail chain
    for name, (cx, sz) in zip(TAIL_BONES, st.tail):
        pb[name].rotation_euler = (cx, 0.0, sz)
    # ears: rot X negative = tip backwards, Z = roll outward
    for side, sgn, tw in (('L', 1, st.ear_twitch[0]), ('R', -1, st.ear_twitch[1])):
        e = pb['ear.' + side]
        e.rotation_euler = (-1.15 * st.ears_back + tw, 0.0, sgn * 0.55 * st.ears_back)
    # eyes: bone points up -> scale Y = vertical squash
    bl = st.blink_lr if st.blink_lr is not None else (st.blink, st.blink)
    for side, blv in (('L', bl[0]), ('R', bl[1])):
        e = pb['eye.' + side]
        vy = (1.0 - 0.32 * blv) * (1.0 - 0.12 * st.squint)
        e.scale = (st.eye_scale, vy * st.eye_scale, st.eye_scale)
        e.location = (0.0, 0.0, 0.0)
        # lid control bone drives the eye shader: loc.y = blink, loc.x = slit, rot.z = angry
        lid = pb['lid.' + side]
        lid.location = (st.slit, min(1.0, blv + 0.35 * st.squint), 0.0)
        lid.rotation_euler = (0.0, 0.0, st.angry)
        lid.scale = (1.0, 1.0, 1.0)
    # mouth: rest is hidden inside the head; local Z = forward (out of face)
    mo = st.mouth_open
    pb['mouth'].location = (0.0, 0.0, MOUTH_PUSH * min(1.0, mo * 4.0) + 0.0018 * mo)
    s = 0.45 + 0.55 * mo
    pb['mouth'].scale = (s, s, s)
    pb['mouth_w'].location = (0.0, 0.0, -0.006 * min(1.0, mo * 5.0))


def key_state(rig, frame):
    for name in CONTROL_BONES:
        b = rig.pose.bones[name]
        b.keyframe_insert('location', frame=frame, group=name)
        b.keyframe_insert('rotation_euler', frame=frame, group=name)
        b.keyframe_insert('scale', frame=frame, group=name)


# ----------------------------------------------------------------------------
# procedural motions -> CatState
# ----------------------------------------------------------------------------

STRIDE = 0.06      # paw sweep per stance (m)
CYCLE = 20         # frames per full walk cycle
WALK_SPEED = 2 * STRIDE / CYCLE   # m / frame (keeps paws planted)


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def walk_state(st, phase, amount=1.0):
    """Trot-like walk. phase in cycles (0..1 repeating). amount blends to stand."""
    offsets = {'leg_f.L': 0.0, 'leg_b.R': 0.0, 'leg_f.R': 0.5, 'leg_b.L': 0.5}
    duty = 0.55
    for leg, off in offsets.items():
        ph = (phase + off) % 1.0
        base = default_paw(leg)
        if ph < duty:                       # stance: paw slides back linearly
            u = -1.0 + 2.0 * ph / duty
            lift = 0.0
        else:                               # swing: paw lifts and moves forward
            s = (ph - duty) / (1.0 - duty)
            u = 1.0 - 2.0 * ease(s)
            lift = 0.022 * math.sin(math.pi * s)
        tgt = Vector((base.x, base.y + u * STRIDE * 0.5 * amount, PAW_H + lift * amount))
        st.paws[leg] = tgt
        st.paw_tilt[leg] = 0.35 * math.sin(math.pi * max(0.0, (ph - duty) / (1.0 - duty))) * amount if ph >= duty else 0.0
    bob = 0.0035 * math.cos(4 * math.pi * phase) * amount
    st.root = st.root + Vector((0, 0, bob))
    st.body_roll += 0.03 * math.sin(2 * math.pi * phase) * amount
    st.head_pitch += 0.03 * math.cos(4 * math.pi * phase + 0.6) * amount
    st.head_roll += 0.025 * math.sin(2 * math.pi * phase + 0.4) * amount
    tail_state(st, phase * 0.5, amp=0.16 * amount + 0.04, base_curl=0.0)
    return st


def tail_state(st, phase, amp=0.25, base_curl=0.0, curl=None):
    """Side-to-side swish travelling down the tail. phase in cycles."""
    out = []
    for i in range(len(TAIL_BONES)):
        w = 0.55 + 0.25 * i
        sway = amp * w * math.sin(2 * math.pi * phase - 0.7 * i)
        cx = (curl[i] if curl else 0.0) + (base_curl if i == 0 else 0.0)
        cx += 0.08 * amp * math.cos(2 * math.pi * phase - 0.7 * i)
        out.append((cx, sway))
    st.tail = out
    return st


# sit pose parameters (found by solving for ground contact in build_cat.py)
SIT_PITCH = -0.62
SIT_ROOT_Z = -0.0
SIT_FRONT_FWD = -0.012


def sit_state(st, amount=1.0):
    """Blend from standing to sitting (amount 0..1)."""
    a = ease(amount)
    st.body_pitch += SIT_PITCH * a
    st.root = st.root + Vector((0, 0, SIT_ROOT_Z * a))
    for leg in ('leg_f.L', 'leg_f.R'):
        b = default_paw(leg)
        st.paws[leg] = Vector((b.x * (1.0 - 0.22 * a), b.y + SIT_FRONT_FWD * a, PAW_H))
    for leg in ('leg_b.L', 'leg_b.R'):
        b = default_paw(leg)
        P = pivot_world(st, leg)
        sit_tgt = Vector((b.x * 1.18, P.y - 0.072, PAW_H))
        st.paws[leg] = b.lerp(sit_tgt, a)
        st.paw_tilt[leg] = 0.0
    # tail wraps around to the side on the floor
    curl = [lerp(0, v, a) for v in (-0.55, -0.62, -0.35, -0.1)]
    sway = [lerp(0, v, a) for v in (0.55, 0.75, 0.7, 0.55)]
    st.tail = [(c, s) for c, s in zip(curl, sway)]
    return st


def blink_value(frame, start, dur=7):
    """0->1->0 blink starting at frame `start`."""
    t = (frame - start) / dur
    if t < 0 or t > 1:
        return 0.0
    return math.sin(math.pi * t) ** 0.7


def hiss_state(st, amount=1.0):
    a = ease(amount)
    st.ears_back = a
    st.mouth_open = a
    st.angry = a
    st.slit = 0.85 * a
    st.head_pitch += -0.12 * a
    st.head_offset = st.head_offset + Vector((0, -0.006 * a, 0.004 * a))
    st.body_pitch += 0.05 * a
    return st


def stand_state():
    st = CatState()
    tail_state(st, 0.0, amp=0.0)
    return st
