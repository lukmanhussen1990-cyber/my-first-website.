"""
fp_preview.py - first-person preview that replays Bedrock's own first-person
rig for a bound attachable, so what it shows is what the game shows.

Chain (vanilla player.animation.json, animation.player.first_person.empty_hand):
  rightarm  pivot (-5,22,0)  position (13.5,-10,12)  rotation (95,-45,115)
  rightitem pivot (-6,15,1)  position (0,0,-1)
  bound geometry origin = rightitem pivot - (0,24,0)   (Blockbench attaches bound
  groups the same way; the Bedrock Wiki's method-1/method-2 numbers differ by
  exactly that offset)
Camera: eye (0,27.41,0), looking +Z, screen-right = +X  (the spyglass "scoping"
pose puts its eyepiece at (-1,27,-3) in the 180-degree-turned head frame, and
the trident comes out upright at eye level on the right, as in the game).

Everything here is in Bedrock *file* space: rotation (x,y,z) -> Rz(-z)Ry(y)Rx(-x).
"""

import math

import numpy as np
from PIL import Image, ImageDraw

import gunsmith


def _rx(t):
    c, s = math.cos(math.radians(t)), math.sin(math.radians(t))
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def _ry(t):
    c, s = math.cos(math.radians(t)), math.sin(math.radians(t))
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def _rz(t):
    c, s = math.cos(math.radians(t)), math.sin(math.radians(t))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def rot_file(rot):
    x, y, z = rot
    return _rz(-z) @ _ry(y) @ _rx(-x)


def bone_matrix(pivot, position=(0, 0, 0), rotation=(0, 0, 0)):
    p = np.array(pivot, float)
    R = rot_file(rotation)
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = p + np.array(position, float) - R @ p
    return M


ARM = bone_matrix((-5, 22, 0), (13.5, -10, 12), (95, -45, 115))
ITEM_SHIFT = np.array([-6, 15, 1.0]) + np.array([0, 0, -1.0]) - np.array([0, 24, 0.0])
EYE = np.array([0.0, 27.41, 0.0])
VFOV = 70.0


def chain_matrix(root_pos, root_rot):
    """Model (file space) -> entity space for the first-person right hand."""
    root = bone_matrix((0, 0, 0), root_pos, root_rot)
    shift = np.eye(4)
    shift[:3, 3] = ITEM_SHIFT
    return ARM @ shift @ root


def render_fp(geo, tex_rgba, glow_mask, root_pos, root_rot, size=(960, 540), bg=(120, 165, 225, 255),
              hud=True, light=(0.3, 0.9, -0.4)):
    M = chain_matrix(root_pos, root_rot)
    W, H = size
    f = (H / 2) / math.tan(math.radians(VFOV) / 2)
    tex = np.asarray(tex_rgba).astype(float) / 255.0
    TH, TW = tex.shape[:2]
    gm = np.asarray(glow_mask, float)
    img = np.zeros((H, W, 4))
    img[:] = np.array(bg, float) / 255
    zbuf = np.full((H, W), -1e9)
    L = np.array(light, float)
    L /= np.linalg.norm(L)
    for q, (u, v, w, h), n in gunsmith.bedrock_to_quads(geo):
        Q = q.copy()
        Q[:, 0] *= -1  # Blockbench space -> file space
        P = Q @ M[:3, :3].T + M[:3, 3]
        nf = n.copy()
        nf[0] *= -1
        nf = M[:3, :3] @ nf
        C = P - EYE
        depth = C[:, 2]
        if (depth < 0.5).any():
            continue
        if nf @ (EYE - P.mean(0)) <= 0:
            continue
        sx = W / 2 + f * C[:, 0] / depth
        sy = H / 2 - f * C[:, 1] / depth
        uvc = np.array([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], float)
        shade = 0.5 + 0.5 * max(0.0, float(nf @ L))
        for tri in ((0, 1, 2), (0, 2, 3)):
            t = list(tri)
            gunsmith._raster_tri_rect(img, zbuf, sx[t], sy[t], -depth[t], uvc[t], tex, gm, TW, TH, shade)
    out = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(out, "RGBA")
    d.line([(W / 2 - 8, H / 2), (W / 2 + 8, H / 2)], fill=(255, 255, 255, 255), width=2)
    d.line([(W / 2, H / 2 - 8), (W / 2, H / 2 + 8)], fill=(255, 255, 255, 255), width=2)
    if hud:
        # where a phone's hotbar / Shoot button sit (see the player's screenshot)
        d.rectangle([W * 0.29, H * 0.89, W * 0.71, H], fill=(0, 0, 0, 90), outline=(255, 255, 255, 120))
        d.rectangle([W * 0.45, H * 0.80, W * 0.55, H * 0.88], fill=(0, 0, 0, 90), outline=(255, 255, 255, 120))
    return out


def camera_point(root_pos, root_rot, model_point):
    """Where a model-space (file) point lands: (right, up, forward) from the eye."""
    M = chain_matrix(root_pos, root_rot)
    return M[:3, :3] @ np.array(model_point, float) + M[:3, 3] - EYE
