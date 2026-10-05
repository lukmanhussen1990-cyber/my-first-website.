"""Hand kinematics for the Bedrock player skeleton -> weapon root-bone transforms.

Lets animations be choreographed in *view space* ("blade tip points up/left at 30 deg, hand is
2 px right of rest") and converts every frame into the exact `root` bone position/rotation that
produces it, compensating the vanilla arm motion. Verified against the preview rig (which was
calibrated on vanilla items) -- see tools/README.md.

File-space conventions (see gen/anim.py): rotation angles (x, y, z) map to the matrix
    Rz(-z) * Ry(+y) * Rx(-x)      (angles in degrees)
First-person view frame is (x=right, y=up, z=forward); the player's third-person frame is mirrored
(right = -X, forward = -Z), handled by `to_file_space`.
"""
import math

# ---------------------------------------------------------------- tiny 4x4 matrix kit (row-major lists)


def ident():
    return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def trans(x, y, z):
    m = ident()
    m[0][3], m[1][3], m[2][3] = x, y, z
    return m


def rot_x(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]]


def rot_y(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]


def rot_z(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def rot_bedrock(rx, ry, rz):
    """Bedrock Euler angles (degrees) -> rotation matrix."""
    return mul(rot_z(-rz), mul(rot_y(ry), rot_x(-rx)))


def inv_rigid(m):
    """Inverse of a rotation+translation matrix."""
    r = [[m[j][i] for j in range(3)] for i in range(3)]
    t = [m[0][3], m[1][3], m[2][3]]
    out = ident()
    for i in range(3):
        for j in range(3):
            out[i][j] = r[i][j]
        out[i][3] = -sum(r[i][k] * t[k] for k in range(3))
    return out


def apply(m, p):
    return [sum(m[i][k] * p[k] for k in range(3)) + m[i][3] for i in range(3)]


def bone_matrix(pivot, pos=(0, 0, 0), rot=(0, 0, 0)):
    """Transform of a bone about its pivot: T(P+pos) * R * T(-P)."""
    return mul(trans(pivot[0] + pos[0], pivot[1] + pos[1], pivot[2] + pos[2]),
               mul(rot_bedrock(*rot), trans(-pivot[0], -pivot[1], -pivot[2])))


def basis(x, y, z):
    m = ident()
    for i in range(3):
        m[i][0], m[i][1], m[i][2] = x[i], y[i], z[i]
    return m


def norm(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return [c / n for c in v]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def sub_proj(v, onto):
    d = dot(v, onto)
    return [v[i] - d * onto[i] for i in range(3)]


def euler_candidates(R):
    """Both ZYX decompositions of R (as Bedrock angles). Returns list of (rx, ry, rz)."""
    sb = -R[2][0]
    sb = max(-1.0, min(1.0, sb))
    b = math.asin(sb)
    out = []
    if abs(math.cos(b)) > 1e-6:
        for bb in (b, math.pi - b):
            cb = math.cos(bb)
            a = math.atan2(R[2][1] / cb, R[2][2] / cb)
            c = math.atan2(R[1][0] / cb, R[0][0] / cb)
            out.append((-math.degrees(a), math.degrees(bb), -math.degrees(c)))
    else:  # gimbal lock
        a = math.atan2(-R[1][2], R[1][1])
        out.append((-math.degrees(a), math.degrees(b), 0.0))
    return out


def unwrap(prev, cand):
    best = None
    for c in cand:
        adj = []
        for i in range(3):
            v = c[i]
            while v - prev[i] > 180:
                v -= 360
            while v - prev[i] < -180:
                v += 360
            adj.append(v)
        d = sum(abs(adj[i] - prev[i]) for i in range(3))
        if best is None or d < best[0]:
            best = (d, tuple(adj))
    return best[1]


# ---------------------------------------------------------------- player skeleton constants (geometry.humanoid.custom)
P_ARM = (-5.0, 22.0, 0.0)
P_ITEM = (-6.0, 15.0, 1.0)
PIVOT = (0.0, 24.0, 0.0)          # weapon grip pivot in the attachable model
ATTACH = trans(P_ITEM[0], P_ITEM[1] - 24.0, P_ITEM[2])


def _sin(d):
    return math.sin(math.radians(d))


def hand_first_person(u):
    """Hand-frame matrix (rightItem world transform) in first person for swing progress u."""
    arm_pos = [13.5, -10.0, 12.0]
    arm_rot = [95.0, -45.0, 115.0]
    item_pos = [0.0, 22.0 - 15.0 - 7.0, -1.0]
    if u > 0:
        f = _sin((1 - u) * 180.0)
        a = f * u * 112.0
        arm_pos[0] += max(-15.5 * _sin(a), -7.0) * _sin(a)
        arm_pos[1] += _sin(f * (1 - u) * (1 - u) * 200.0) * 7.5 - f * u * 15.0
        arm_pos[2] += _sin(f * u * 120.0) * 1.75
        w = _sin(f * (1 - u) * (1 - u) * 280.0)
        arm_rot[0] += w * -60.0
        arm_rot[1] += w * 40.0
        arm_rot[2] += w * 20.0
    arm = bone_matrix(P_ARM, arm_pos, arm_rot)
    item = bone_matrix(P_ITEM, item_pos, (0, 0, 0))
    return mul(arm, item)


def hand_third_person_idle():
    arm = bone_matrix(P_ARM, (0, 0, 0), (-18.0, 0, 0))
    item = bone_matrix(P_ITEM)
    return mul(arm, item)


# ---------------------------------------------------------------- view-space poses
class Pose:
    """A weapon pose in view space.

    pitch: tip tilt forward (deg from straight up)   lean: tip tilt to the right (deg)
    roll : twist about the blade axis (deg)           off : grip offset from the rest hand (right, up, forward) px
    """
    def __init__(self, t, pitch=0.0, lean=0.0, roll=0.0, off=(0, 0, 0), ease='smooth'):
        self.t = t
        self.v = [pitch, lean, roll, off[0], off[1], off[2]]
        self.ease = ease


def _ease(kind, t):
    from .anim import _ease as e
    return e(kind, t)


def pose_at(poses, t):
    if t <= poses[0].t:
        return list(poses[0].v)
    if t >= poses[-1].t:
        return list(poses[-1].v)
    for a, b in zip(poses, poses[1:]):
        if a.t <= t <= b.t:
            u = _ease(a.ease, (t - a.t) / (b.t - a.t))
            return [a.v[i] + (b.v[i] - a.v[i]) * u for i in range(6)]
    return list(poses[-1].v)


def _dirs(pitch, lean, roll):
    """Tip / edge directions (view frame: x right, y up, z forward).

    lean tilts the vertical blade sideways (to the right, +); pitch then tilts it forward (+) -- valid
    all the way to 180 deg (blade pointing straight down). roll twists about the blade axis.
    """
    sl, cl = math.sin(math.radians(lean)), math.cos(math.radians(lean))
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    tip = [sl, cl * cp, cl * sp]
    e = [0.0, -sp, cp]                      # forward edge, carried through the same pitch rotation
    c, s = math.cos(math.radians(roll)), math.sin(math.radians(roll))
    kxe = cross(tip, e)
    kde = dot(tip, e)
    er = [e[i] * c + kxe[i] * s + tip[i] * kde * (1 - c) for i in range(3)]
    return norm(tip), norm(er)


def solve_root(view, v, hand, hand_rest):
    """Root bone (pos, rot) so the weapon matches pose params v = [pitch, lean, roll, dx, dy, dz].

    hand      : hand-frame matrix at the moment being solved (arm motion is compensated)
    hand_rest : hand-frame matrix defining where 'offset 0' is
    """
    pitch, lean, roll, dx, dy, dz = v
    flip = (view == 'third')
    tip, edge = _dirs(pitch, lean, roll)

    def tof(vec):
        return [-vec[0], vec[1], -vec[2]] if flip else list(vec)

    Y = norm(tof(tip))
    E = norm(sub_proj(tof(edge), Y))
    Z = [-c for c in E]
    X = norm(cross(Y, Z))
    R = basis(X, Y, Z)
    hp = apply(hand_rest, P_ITEM)
    off = tof([dx, dy, dz])
    anchor = [hp[i] + off[i] for i in range(3)]
    W = mul(trans(*anchor), mul(R, trans(-PIVOT[0], -PIVOT[1], -PIVOT[2])))
    L = mul(inv_rigid(ATTACH), mul(inv_rigid(hand), W))
    R3 = [[L[i][j] for j in range(3)] + [0] for i in range(3)] + [[0, 0, 0, 1]]
    t = [L[0][3], L[1][3], L[2][3]]
    RP = apply(R3, PIVOT)
    pos = [t[i] - PIVOT[i] + RP[i] for i in range(3)]
    return pos, euler_candidates(R3)


def solve_track(view, poses, length, arm_fn=None, fps=48):
    """Dense (t, pos, rot) samples for a pose track. arm_fn(t)->hand matrix (None = static rest hand)."""
    rest = hand_first_person(0.0) if view == 'first' else hand_third_person_idle()
    n = max(2, int(math.ceil(length * fps)))
    prev = None
    frames = []
    for i in range(n + 1):
        t = min(length, i * length / n)
        hand = arm_fn(t) if arm_fn else rest
        pos, cands = solve_root(view, pose_at(poses, t), hand, rest)
        rot = unwrap(prev, cands) if prev else cands[0]
        prev = rot
        frames.append((t, pos, rot))
    return frames
