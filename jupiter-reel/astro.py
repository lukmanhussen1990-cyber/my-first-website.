"""Astronaut rig: forward kinematics and body-language poses.

The shader (shaders/astronaut.glsl) draws the suit as signed-distance shapes
between joint positions; this module turns pose angles into those joints so
the character keeps identical proportions in every shot.
Body space: +y up, +z is the direction the visor faces, +x the astronaut's left.
"""
import numpy as np
from scipy.spatial.transform import Rotation, Slerp


def rx(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def axis_angle(axis, a):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s, C = np.cos(a), np.sin(a), 1 - np.cos(a)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


SHOULDER = np.array([0.245, 0.15, 0.0])
HIP = np.array([0.095, -0.29, 0.0])
NECK = np.array([0.0, 0.27, 0.0])
L_UA, L_FA = 0.21, 0.20
L_TH, L_SH = 0.24, 0.23

# Angles in degrees.
# arm: (swing forward, raise sideways, twist, elbow bend)
# leg: (swing forward, spread, knee bend)
# head: (yaw left, pitch up, roll)
POSES = {
    "flail":    dict(armL=(20, 125, 0, 55), armR=(-15, 135, 0, 40), legL=(35, 25, 55), legR=(-10, 20, 30), head=(0, 12, 0)),
    "reach_up": dict(armL=(30, 160, 0, 18), armR=(25, 165, 0, 22), legL=(15, 12, 30), legR=(0, 10, 18), head=(0, 30, 0)),
    "brace":    dict(armL=(100, 28, 0, 120), armR=(95, 30, 0, 118), legL=(80, 10, 105), legR=(70, 12, 98), head=(0, -18, 0)),
    "spread":   dict(armL=(10, 88, 0, 32), armR=(5, 92, 0, 28), legL=(8, 28, 32), legR=(4, 30, 28), head=(0, 0, 0)),
    "limp":     dict(armL=(40, 62, 0, 48), armR=(32, 55, 0, 55), legL=(22, 10, 38), legR=(12, 12, 26), head=(0, -12, 0)),
    "look":     dict(armL=(45, 70, 0, 65), armR=(-20, 145, 0, 30), legL=(28, 20, 45), legR=(5, 15, 22), head=(38, 8, 0)),
    "cower":    dict(armL=(120, 40, 0, 135), armR=(115, 42, 0, 130), legL=(55, 18, 80), legR=(48, 20, 70), head=(-10, -25, 5)),
}
KEYS = ("armL", "armR", "legL", "legR", "head")


def blend(weights):
    """weights: {pose_name: w}. Returns a pose dict of numpy angle arrays (deg)."""
    tot = sum(weights.values())
    out = {k: np.zeros(4 if k.startswith("arm") else 3) for k in KEYS}
    for name, w in weights.items():
        for k in KEYS:
            out[k] = out[k] + np.array(POSES[name][k], float) * (w / tot)
    return out


def jitter(pose, t, amp=1.0, speed=1.0, seed=0.0):
    """Add flailing motion: layered sines, independent per joint."""
    out = {k: v.copy() for k, v in pose.items()}
    rng = np.random.RandomState(int(seed * 1000) % 2**31)
    for k in KEYS:
        n = len(out[k])
        ph = rng.uniform(0, 2 * np.pi, (n, 3))
        fr = rng.uniform(0.6, 1.6, (n, 3)) * speed
        base = 22.0 if k.startswith("arm") else (14.0 if k.startswith("leg") else 9.0)
        for i in range(n):
            if k.startswith("arm") and i == 2:
                continue
            s = (np.sin(t * fr[i, 0] * 2.1 + ph[i, 0]) * 0.6 + np.sin(t * fr[i, 1] * 3.7 + ph[i, 1]) * 0.3
                 + np.sin(t * fr[i, 2] * 6.3 + ph[i, 2]) * 0.1)
            out[k][i] += s * base * amp
    return out


def solve(pose):
    """Forward kinematics -> dict of shader uniforms (all in body space)."""
    J = np.zeros((12, 3))
    hand_c, hand_r, foot_c, foot_r = [], [], [], []
    for side, sgn, ja, jl in (("L", 1.0, 0, 6), ("R", -1.0, 3, 9)):
        sw, ab, tw, el = np.radians(pose["arm" + side])
        el = max(el, 0.0)
        sh = SHOULDER * np.array([sgn, 1, 1])
        R1 = rz(sgn * ab) @ rx(-sw) @ ry(sgn * tw)
        elbow = sh + R1 @ np.array([0, -L_UA, 0])
        R2 = R1 @ rx(-el)
        wrist = elbow + R2 @ np.array([0, -L_FA, 0])
        J[ja], J[ja + 1], J[ja + 2] = sh, elbow, wrist
        hand_c.append(wrist + R2 @ np.array([0, -0.05, 0.0]))
        hand_r.append(R2.T)

        sw, ab, kn = np.radians(pose["leg" + side])
        kn = max(kn, 0.0)
        hip = HIP * np.array([sgn, 1, 1])
        R1 = rz(sgn * ab) @ rx(-sw)
        knee = hip + R1 @ np.array([0, -L_TH, 0])
        R2 = R1 @ rx(kn)
        ankle = knee + R2 @ np.array([0, -L_SH, 0])
        J[jl], J[jl + 1], J[jl + 2] = hip, knee, ankle
        R3 = R2 @ rx(np.radians(-10))
        foot_c.append(ankle + R3 @ np.array([0, -0.035, 0.03]))
        foot_r.append(R3.T)

    yaw, pitch, roll = np.radians(pose["head"])
    Rh = ry(yaw) @ rx(-pitch) @ rz(roll)
    head_c = NECK + Rh @ np.array([0, 0.225, 0.02])
    return dict(J=J, hand_c=np.array(hand_c), hand_r=hand_r, foot_c=np.array(foot_c),
                foot_r=foot_r, head_c=head_c, head_r=Rh.T, head_rot=Rh)


def tumble(t, spins, wobble=0.0, seed=0.0):
    """Body->world rotation from constant spins [(axis, rad/s, phase)] plus wobble."""
    R = np.eye(3)
    for axis, rate, ph in spins:
        R = R @ axis_angle(axis, rate * t + ph)
    if wobble > 0:
        rng = np.random.RandomState(int(seed * 7919) % 2**31)
        for k in range(3):
            ax = rng.normal(size=3)
            f1, f2 = rng.uniform(0.5, 1.4, 2)
            p1, p2 = rng.uniform(0, 6.28, 2)
            a = wobble * (0.65 * np.sin(t * f1 * 2.2 + p1) + 0.35 * np.sin(t * f2 * 4.1 + p2))
            R = R @ axis_angle(ax, a)
    return R


def look_rot(forward, up):
    """Body->world rotation that points the visor (+z) along `forward` with +y near `up`."""
    f = np.asarray(forward, float)
    f = f / np.linalg.norm(f)
    r = np.cross(np.asarray(up, float), f)
    if np.linalg.norm(r) < 1e-6:
        r = np.cross(np.array([1.0, 0, 0]), f)
    r = r / np.linalg.norm(r)
    u = np.cross(f, r)
    return np.stack([r, u, f], axis=1)


def slerp(R0, R1, k):
    """Spherical blend between two rotation matrices (0 -> R0, 1 -> R1)."""
    key = Rotation.from_matrix(np.stack([R0, R1]))
    return Slerp([0.0, 1.0], key)([float(np.clip(k, 0.0, 1.0))]).as_matrix()[0]
