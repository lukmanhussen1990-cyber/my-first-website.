"""Staging for the two hands: poses, placement, lights, camera -> a rendered frame."""
from math import cos, radians, sin

import numpy as np

from . import hands as hd
from . import post

# Person A = "their hand" (top, warm peach).  Person B = "your hand" (bottom, cooler rose).
ALB_A = (0.93, 0.58, 0.38)
ALB_B = (0.86, 0.49, 0.47)

# --- poses (degrees): mcp, pip, dip, splay (index..pinky), thumb -------------
T_OPEN = ((0.62, -0.25, 0.74), (0.72, -0.30, 0.62), (0.80, -0.30, 0.52))
B_OPEN = hd.make_pose([8, 10, 13, 16], [14, 16, 18, 22], [8, 8, 10, 10], [7, 1, -4, -10], T_OPEN)
B_HOLD = hd.make_pose(
    [78, 80, 80, 76], [92, 95, 96, 94], [38, 40, 40, 40], [2, 0, -1, -3],
    ((0.50, -0.55, 0.67), (0.25, -0.35, -0.90), (0.15, 0.25, -0.96)),
)
A_REACH = hd.make_pose(
    [14, -6, -8, -6], [18, 10, 12, 16], [8, 6, 8, 10], [3, 1, -4, -10],
    ((0.62, -0.30, 0.72), (0.74, -0.36, 0.57), (0.82, -0.38, 0.43)),
)
A_HOLD = hd.make_pose(
    [3, 4, 5, 7], [7, 8, 9, 11], [5, 5, 6, 8], [3, 0, -2, -5],
    ((0.60, -0.45, 0.66), (0.72, -0.55, 0.42), (0.75, -0.62, 0.22)),
)
SQUEEZE_B = hd.make_pose(3, 4, 3, 0, ((0, 0, 0.001), (0, 0.06, 0), (0, 0.08, 0))) * np.r_[np.ones(16), np.zeros(9)]
SQUEEZE_A = hd.make_pose(2, 4, 3, 0, ((0, 0, 0.001), (0, 0, 0.001), (0, 0, 0.001))) * np.r_[np.ones(16), np.zeros(9)]

_LIFE = np.r_[np.full(12, radians(1.0)), np.zeros(13)]
_LIFE_PH = np.arange(25.0)
MEASURE_CAP = 10  # index finger, last segment of hand A
AZ_B = 38.0  # direction of B's fingers (degrees, from screen-right towards "away")
REACH_ANGLE = 106.0  # angle between the two hands while reaching ...
HOLD_ANGLE = 100.0  # ... and when holding
HOLD_PITCH = 3.0
REACH_TX, REACH_TZ = 4.9, 0.2  # where A's fingertip hovers over B's palm
HOLD_TX, HOLD_TZ = 3.6, 2.0  # where it rests when holding


def lerp(a, b, t):
    return a + (b - a) * t


def _finger_clearance(A, B):
    """Smallest distance between A's fingers and B's surface (negative = overlapping)."""
    CA = A[0]
    best = 1e9
    for i in list(range(8, 20)) + [2, 3, 4, 5]:
        for h in (0.0, 0.25, 0.5, 0.75, 1.0):
            p = CA[i, 0:3] + (CA[i, 3:6] - CA[i, 0:3]) * h
            r = CA[i, 6] + (CA[i, 7] - CA[i, 6]) * h
            d = hd.sdf_hand(p[0], p[1], p[2], B[0], B[2], B[3]) - r
            if d < best:
                best = d
    return best


def place_hands(gap, hold=0.0, squeeze=0.0, life=None):
    """Build both hands.

    gap     vertical distance (cm) between A's fingertip and B's palm (used while reaching)
    hold    0 = reaching, 1 = hands closed around each other
    squeeze small extra curl for the final gentle squeeze
    Returns A, B, top point, bottom point of the measured gap.
    """
    # ---- B ("you"): left hand, palm up, coming in from the lower left, thumb on the far side
    azB = radians(AZ_B)
    exB = np.array([cos(azB), 0.0, -sin(azB)])
    eyB = np.array([0.0, -1.0, 0.0])
    ezB = np.cross(exB, eyB)
    oB = -(5.2 * exB - 1.2 * eyB)
    PB = lerp(B_OPEN, B_HOLD, hold) + squeeze * SQUEEZE_B
    if life is not None:  # tiny living movement in the fingers
        PB = PB + _LIFE * np.sin(life * 1.1 + _LIFE_PH * 1.7) * (1.0 - 0.6 * hold)
    B = hd.build_hand(oB, exB, eyB, ezB, PB)

    # ---- A ("them"): right hand, palm down, coming in from the lower right
    angA = azB + radians(lerp(REACH_ANGLE, HOLD_ANGLE, hold))
    pitch = radians(lerp(27.0, HOLD_PITCH, hold))
    exA = np.array([cos(angA) * cos(pitch), -sin(pitch), -sin(angA) * cos(pitch)])
    exA, eyA, ezA = hd.frame_from(exA, np.array([0.0, 1.0, 0.0]), thumb_sign=-1.0)
    PA = lerp(A_REACH, A_HOLD, hold) + squeeze * SQUEEZE_A
    if life is not None:
        PA = PA + 1.2 * _LIFE * np.sin(life * 1.3 + _LIFE_PH * 0.9) * (1.0 - 0.7 * hold)
    A0 = hd.build_hand(np.zeros(3), exA, eyA, ezA, PA)
    tipr = A0[0][MEASURE_CAP, 7]
    low0 = A0[0][MEASURE_CAP, 3:6] - np.array([0.0, tipr, 0.0])
    # where the fingertip goes, in B's palm coordinates (x along B's fingers, z towards B's thumb)
    tx = lerp(REACH_TX, HOLD_TX, hold)
    tz = lerp(REACH_TZ, HOLD_TZ, hold)
    anchor = oB + tx * exB + tz * ezB
    anchor[1] = 0.0
    base = anchor - low0

    # height while reaching: put the fingertip exactly `gap` above the palm
    y_reach = 5.0
    A = hd.build_hand(base + np.array([0.0, y_reach, 0.0]), exA, eyA, ezA, PA)
    for _ in range(3):
        low = A[0][MEASURE_CAP, 3:6] - np.array([0.0, tipr, 0.0])
        g = hd.drop_gap(low, B[0], B[2], B[3])
        y_reach += gap - g
        A = hd.build_hand(base + np.array([0.0, y_reach, 0.0]), exA, eyA, ezA, PA)
    y = y_reach
    if hold > 0.0:
        # height while holding: rest A's fingers on B's open palm (skin presses in a little)
        Bo = hd.build_hand(oB, exB, eyB, ezB, B_OPEN)
        y_rest = 5.0
        for _ in range(5):
            Ar = hd.build_hand(base + np.array([0.0, y_rest, 0.0]), exA, eyA, ezA, PA)
            y_rest += -0.07 - _finger_clearance(Ar, Bo)
        y = lerp(y_reach, y_rest, hold)
        A = hd.build_hand(base + np.array([0.0, y, 0.0]), exA, eyA, ezA, PA)
    top = A[0][MEASURE_CAP, 3:6] - np.array([0.0, tipr, 0.0])
    bot = top - np.array([0.0, hd.drop_gap(top, B[0], B[2], B[3]), 0.0])
    return A, B, top, bot


def lights(golden=0.0, glow=0.0, glow_xy=(0.0, 0.0), ridge=0.0035, key_az=-35.0, key_el=50.0, glow_r=0.5):
    LP = np.zeros(40)
    ka = radians(key_az)
    ke = radians(key_el)
    LP[0:3] = np.array([sin(ka) * cos(ke), sin(ke), cos(ka) * cos(ke)])
    LP[3:6] = lerp(np.array([1.02, 0.86, 0.70]), np.array([1.00, 0.80, 0.56]), golden)
    r = np.array([0.50, 0.42, -0.76])
    LP[6:9] = r / np.linalg.norm(r)
    LP[9:12] = lerp(np.array([0.85, 0.54, 0.32]), np.array([1.55, 0.86, 0.34]), golden)
    LP[12:15] = lerp(np.array([0.034, 0.036, 0.054]), np.array([0.060, 0.042, 0.030]), golden)
    LP[15:18] = lerp(np.array([0.026, 0.015, 0.014]), np.array([0.050, 0.026, 0.014]), golden)
    LP[18:21] = ALB_A
    LP[21:24] = ALB_B
    LP[24] = glow
    LP[25:27] = glow_xy
    LP[27] = glow_r
    LP[28:31] = (1.0, 0.52, 0.17)
    LP[31] = ridge
    LP[32] = 1.0 + 0.6 * golden
    LP[33] = 0.20
    LP[34:37] = lerp(np.array([0.006, 0.005, 0.008]), np.array([0.010, 0.006, 0.005]), golden)
    LP[37:40] = lerp(np.array([0.013, 0.009, 0.010]), np.array([0.016, 0.009, 0.007]), golden)
    return LP


def render(W, H, A, B, cam, LP, focus_point, dof_strength, dof_max, exposure=1.0):
    """Returns display-referred float32 RGB at W x H."""
    out = np.zeros((H, W, 3), np.float32)
    depth = np.zeros((H, W), np.float32)
    hd.render_hands(W, H, cam, A[0], A[1], A[2], A[3], A[4], B[0], B[1], B[2], B[3], B[4], LP, out, depth)
    fz = float(np.dot(np.asarray(focus_point, float) - cam[0:3], cam[9:12]))
    s = H / 1920.0
    bg = background(W, H, LP)
    out = post.depth_of_field(out, depth, fz, dof_strength * s, dof_max * s, bg)
    return post.tonemap(out, exposure)


def background(W, H, LP):
    """Same backdrop the renderer draws behind the hands (dark gradient + optional warm glow)."""
    sy = ((H * 0.5 - (np.arange(H) + 0.5)) / (H * 0.5))[:, None].astype(np.float32)
    sx = ((np.arange(W) + 0.5 - W * 0.5) / (H * 0.5))[None, :].astype(np.float32)
    g = (0.5 + 0.5 * sy)[..., None]
    col = LP[37:40][None, None, :] + (LP[34:37] - LP[37:40])[None, None, :] * g
    r2 = ((sx - LP[25]) ** 2 + (sy - LP[26]) ** 2) / (LP[27] ** 2)
    col = col + LP[24] * np.exp(-r2)[..., None] * LP[28:31][None, None, :]
    return col.astype(np.float32)
