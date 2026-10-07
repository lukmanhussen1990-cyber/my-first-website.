"""
fp_preview.py - first-person preview that reproduces Blockbench's Bedrock
"attachable_first" preview (js/formats/bedrock/attachable_preview.js), the
view creators use to pose held items so they match the game:

  * a bound root is placed at (-20, 21, 0) and rotated Euler ZYX (-95, 45, 115)
    (Blockbench space), i.e. the vanilla first-person right-arm transform;
  * the camera sits at (0, 19, -40) looking at (0, 16, 0), focal length 18 mm
    (35 mm film, 16:9) -> ~57 deg vertical field of view.

Bedrock animation values are converted like Blockbench does on import:
position x and rotation x/y are negated.
"""

import math

import numpy as np
from PIL import Image

import gunsmith


def _M(pivot, pos=(0, 0, 0), rot=(0, 0, 0)):
    p = np.array(pivot, float)
    R = gunsmith._rot_matrix(rot)
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = p + np.array(pos, float) - R @ p
    return M


def _file_anim_to_bb(pos, rot):
    return (-pos[0], pos[1], pos[2]), (-rot[0], -rot[1], rot[2])


def render_fp(geo, tex_rgba, glow_mask, root_pos, root_rot, body_pos=(0, 0, 0), hide=(),
              size=(960, 540), bg=(120, 165, 225, 255), crosshair=True):
    """root_pos/root_rot/body_pos are the numbers written in the .animation.json."""
    rp, rr = _file_anim_to_bb(root_pos, root_rot)
    bp, _ = _file_anim_to_bb(body_pos, (0, 0, 0))
    place = _M((0, 0, 0), (-20, 21, 0), (-95, 45, 115))
    root = _M((0, 0, 0), rp, rr)
    body = _M((0, 0, 0), bp)
    M = place @ root @ body
    quads = []
    for q, uv, n in gunsmith.bedrock_to_quads(geo, hide=hide):
        Q = q @ M[:3, :3].T + M[:3, 3]
        quads.append((Q, uv, M[:3, :3] @ n))
    # camera basis: eye (0,19,-40) -> target (0,16,0)
    eye = np.array([0.0, 19.0, -40.0])
    fwd = np.array([0.0, 16.0, 0.0]) - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    W, H = size
    film_h = 35.0 / (W / H)
    f = (H / 2) / (0.5 * film_h / 18.0)
    tex = np.asarray(tex_rgba).astype(float) / 255.0
    TH, TW = tex.shape[:2]
    gm = np.asarray(glow_mask, float)
    img = np.zeros((H, W, 4))
    img[:] = np.array(bg, float) / 255
    zbuf = np.full((H, W), -1e9)
    L = np.array([0.3, 0.9, -0.4])
    L /= np.linalg.norm(L)
    for Q, (u, v, w, h), n in quads:
        rel = Q - eye
        cx, cy, cz = rel @ right, rel @ up, rel @ fwd
        if (cz < 0.5).any():
            continue
        if n @ (eye - Q.mean(0)) <= 0:
            continue
        sx = W / 2 + f * cx / cz
        sy = H / 2 - f * cy / cz
        uvc = np.array([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], float)
        shade = 0.5 + 0.5 * max(0.0, float(n @ L))
        for tri in ((0, 1, 2), (0, 2, 3)):
            t = list(tri)
            gunsmith._raster_tri_rect(img, zbuf, sx[t], sy[t], -cz[t], uvc[t], tex, gm, TW, TH, shade)
    out = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    if crosshair:
        from PIL import ImageDraw
        d = ImageDraw.Draw(out)
        d.line([(W / 2 - 8, H / 2), (W / 2 + 8, H / 2)], fill=(255, 255, 255, 255), width=2)
        d.line([(W / 2, H / 2 - 8), (W / 2, H / 2 + 8)], fill=(255, 255, 255, 255), width=2)
    return out, M


def screen_of(M, point, size=(960, 540)):
    """Screen position + depth of a model-space (Blockbench) point."""
    eye = np.array([0.0, 19.0, -40.0])
    fwd = np.array([0.0, 16.0, 0.0]) - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    W, H = size
    f = (H / 2) / (0.5 * (35.0 / (W / H)) / 18.0)
    P = M[:3, :3] @ np.array(point, float) + M[:3, 3] - eye
    cx, cy, cz = P @ right, P @ up, P @ fwd
    return (W / 2 + f * cx / cz, H / 2 - f * cy / cz, cz)
