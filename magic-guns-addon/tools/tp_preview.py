"""
tp_preview.py - third-person preview: a Steve-shaped player in the aim pose
holding a gun through the same bone maths Bedrock uses for attachables
(bound geometry = root animation, + rightItem pivot, - 24 px, then the arm).

Rotation convention in file coordinates: R = Rz(-z) * Ry(y) * Rx(-x),
X applied first - identical to Blockbench's Bedrock import.
"""

import math

import numpy as np
from PIL import Image

import gunsmith


def _R(rot):
    x, y, z = [math.radians(a) for a in rot]
    rx = np.array([[1, 0, 0], [0, math.cos(-x), -math.sin(-x)], [0, math.sin(-x), math.cos(-x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(-z), -math.sin(-z), 0], [math.sin(-z), math.cos(-z), 0], [0, 0, 1]])
    return rz @ ry @ rx


def _M(pivot, pos=(0, 0, 0), rot=(0, 0, 0)):
    p = np.array(pivot, float)
    M = np.eye(4)
    M[:3, :3] = _R(rot)
    M[:3, 3] = p + np.array(pos, float) - _R(rot) @ p
    return M


def _apply(M, pts):
    return pts @ M[:3, :3].T + M[:3, 3]


# Steve-ish palette: (r, g, b)
SKIN, SHIRT, PANTS, HAIR, SHOE = (0.78, 0.58, 0.45), (0.0, 0.62, 0.65), (0.25, 0.22, 0.6), (0.2, 0.13, 0.07), (0.3, 0.3, 0.32)

PLAYER = {  # bone: (pivot, [(origin, size, colour)])
    "body": ((0, 24, 0), [((-4, 12, -2), (8, 12, 4), SHIRT)]),
    "head": ((0, 24, 0), [((-4, 24, -4), (8, 8, 8), SKIN), ((-4.2, 30, -4.2), (8.4, 2.4, 8.4), HAIR)]),
    "rightArm": ((-5, 22, 0), [((-8, 12, -2), (4, 12, 4), SKIN), ((-8.1, 18, -2.1), (4.2, 6.2, 4.2), SHIRT)]),
    "leftArm": ((5, 22, 0), [((4, 12, -2), (4, 12, 4), SKIN), ((3.9, 18, -2.1), (4.2, 6.2, 4.2), SHIRT)]),
    "rightLeg": ((-1.9, 12, 0), [((-3.9, 0, -2), (4, 12, 4), PANTS), ((-4, 0, -2.1), (4.2, 2, 4.2), SHOE)]),
    "leftLeg": ((1.9, 12, 0), [((-0.1, 0, -2), (4, 12, 4), PANTS), ((-0.2, 0, -2.1), (4.2, 2, 4.2), SHOE)]),
}

AIM = {
    "pistol": {"rightArm": (-93, 0, 0), "leftArm": (0, 0, 0)},
    "rifle": {"rightArm": (-93, 0, 0), "leftArm": (-93, 42, 0)},
}

_IDX = {"north": [1, 4, 6, 3], "east": [0, 1, 3, 2], "south": [5, 0, 2, 7],
        "west": [4, 5, 7, 6], "up": [4, 1, 0, 5], "down": [7, 2, 3, 6]}


def _box_quads_file(origin, size):
    """8 corners of a cube in file coordinates, ordered like bedrock_to_quads (BB order after mirroring)."""
    o = np.array(origin, float)
    s = np.array(size, float)
    # Blockbench-space corners, then mirror x back to file space
    X0, X1 = -(o[0] + s[0]), -o[0]
    Y0, Y1 = o[1], o[1] + s[1]
    Z0, Z1 = o[2], o[2] + s[2]
    V = np.array([[X1, Y1, Z1], [X1, Y1, Z0], [X1, Y0, Z1], [X1, Y0, Z0],
                  [X0, Y1, Z0], [X0, Y1, Z1], [X0, Y0, Z0], [X0, Y0, Z1]])
    V[:, 0] *= -1
    return V


def render_tp(geo, tex_rgba, glow_mask, kind, hold, size=640, yaw=-35, pitch=12, bg=(150, 190, 235, 255)):
    tex = np.asarray(tex_rgba).astype(float) / 255.0
    TH, TW = tex.shape[:2]
    # append colour swatches for the player below the gun atlas
    sw = np.zeros((4, TW, 4))
    colors = [SKIN, SHIRT, PANTS, HAIR, SHOE]
    for i, c in enumerate(colors):
        sw[:, i * 4:(i + 1) * 4, :3] = c
        sw[:, i * 4:(i + 1) * 4, 3] = 1
    tex2 = np.concatenate([tex, sw], axis=0)
    gm = np.concatenate([np.asarray(glow_mask, float), np.zeros((4, TW))], axis=0)

    quads = []  # (corners_file[4,3], uv(u,v,w,h))
    pose = AIM[kind]
    for bone, (pivot, cubes) in PLAYER.items():
        M = _M(pivot, rot=pose.get(bone, (0, 0, 0)))
        for origin, sz, col in cubes:
            V = _apply(M, _box_quads_file(origin, sz))
            ci = colors.index(col)
            for f, ids in _IDX.items():
                quads.append((V[ids], (ci * 4 + 1, TH + 1, 2, 2)))
    # the gun: bedrock_to_quads gives Blockbench space; mirror to file space
    # molang strings: evaluate the main-hand branch of "c.item_slot == 'main_hand' ? a : b"
    pos = [float(v.split("?")[1].split(":")[0]) if isinstance(v, str) else v for v in hold["position"]]
    root = _M((0, 0, 0), pos=pos, rot=hold["rotation"])
    arm = _M(PLAYER["rightArm"][0], rot=pose["rightArm"])
    for q, uv, _ in gunsmith.bedrock_to_quads(geo, hide=("fp_hands",)):
        qf = q.copy()
        qf[:, 0] *= -1
        p = _apply(root, qf) + np.array([-6, 15, 1]) - np.array([0, 24, 0])
        quads.append((_apply(arm, p), uv))

    # to Blockbench space (mirror x) and project like gunsmith.render
    R = gunsmith._rot_matrix([pitch, 0, 0]) @ gunsmith._rot_matrix([0, yaw, 0])
    # camera in front of the player (player faces -Z): screen x = -X(BB)... look from -Z
    base = np.array([[-1, 0, 0], [0, 1, 0], [0, 0, 1]], float)
    view = base @ R
    allp = []
    bbq = []
    for V, uv in quads:
        B = V.copy()
        B[:, 0] *= -1
        n = np.cross(B[1] - B[0], B[3] - B[0])
        nn = np.linalg.norm(n)
        if nn == 0:
            continue
        bbq.append((B, uv, n / nn))
        allp.append(B @ view.T)
    allp = np.concatenate(allp)
    mn, mx = allp[:, :2].min(0), allp[:, :2].max(0)
    span = (mx - mn).max() * 1.12
    center = (mn + mx) / 2
    scale = size / span
    img = np.zeros((size, size, 4))
    img[:] = np.array(bg, float) / 255
    zbuf = np.full((size, size), -1e9)
    L = np.array([0.3, 0.9, -0.5])
    L /= np.linalg.norm(L)
    for B, (u, v, w, h), n in bbq:
        P = B @ view.T
        if (n @ view.T)[2] >= 0:
            continue
        sx = (P[:, 0] - center[0]) * scale + size / 2
        sy = size / 2 - (P[:, 1] - center[1]) * scale
        depth = -P[:, 2]
        uvc = np.array([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], float)
        shade = 0.5 + 0.5 * max(0.0, float(n @ L))
        for tri in ((0, 1, 2), (0, 2, 3)):
            t = list(tri)
            gunsmith._raster_tri(img, zbuf, sx[t], sy[t], depth[t], uvc[t], tex2, gm, TW, TH + 4, shade)
    return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
