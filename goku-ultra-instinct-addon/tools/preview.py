"""Tiny software renderer for Bedrock box-UV geometry.

Used to sanity-check the outfit/hair models and to produce the preview
pictures in the README.  It mirrors the conventions used by Bedrock:
-X is the model's right side, -Z its face side, and cube/bone rotations are
applied x-then-y-then-z with Bedrock's (clockwise) sign.
"""
import math

import numpy as np
from PIL import Image

from pixelkit import Atlas, Model, face_rects, rgba


def _rot(rx, ry, rz):
    ax, ay, az = (-math.radians(a) for a in (rx, ry, rz))
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    Rx = ((1, 0, 0), (0, cx, -sx), (0, sx, cx))
    Ry = ((cy, 0, sy), (0, 1, 0), (-sy, 0, cy))
    Rz = ((cz, -sz, 0), (sz, cz, 0), (0, 0, 1))
    return _mm(Rz, _mm(Ry, Rx))


def _mm(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def _mv(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def _about(p, pivot, m):
    d = (p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])
    r = _mv(m, d)
    return (r[0] + pivot[0], r[1] + pivot[1], r[2] + pivot[2])


FACE_NORMALS = {
    'front': (0, 0, -1), 'back': (0, 0, 1), 'right': (-1, 0, 0),
    'left': (1, 0, 0), 'up': (0, 1, 0), 'down': (0, -1, 0),
}


def _face_corners(face, x0, y0, z0, x1, y1, z1):
    """TL, TR, BL corners matching the texture orientation of each box-UV face."""
    if face == 'front':
        return (x0, y1, z0), (x1, y1, z0), (x0, y0, z0)
    if face == 'back':
        return (x1, y1, z1), (x0, y1, z1), (x1, y0, z1)
    if face == 'right':
        return (x0, y1, z1), (x0, y1, z0), (x0, y0, z1)
    if face == 'left':
        return (x1, y1, z0), (x1, y1, z1), (x1, y0, z0)
    if face == 'up':
        return (x0, y1, z1), (x1, y1, z1), (x0, y1, z0)
    return (x0, y0, z0), (x1, y0, z0), (x0, y0, z1)


def collect_quads(geo_json, texture, bone_pose=None):
    """Turns a geometry + texture into a list of (corners3d, color, normal)."""
    bone_pose = bone_pose or {}
    geo = geo_json['minecraft:geometry'][0]
    quads = []
    for bone in geo['bones']:
        bpivot = bone.get('pivot', [0, 0, 0])
        brot = bone_pose.get(bone['name'], (0, 0, 0))
        bm = _rot(*brot)
        for c in bone.get('cubes', []):
            ox, oy, oz = c['origin']
            w, h, d = c['size']
            inf = c.get('inflate', 0)
            x0, y0, z0 = ox - inf, oy - inf, oz - inf
            x1, y1, z1 = ox + w + inf, oy + h + inf, oz + d + inf
            cm = _rot(*c.get('rotation', (0, 0, 0)))
            cpivot = c.get('pivot', [0, 0, 0])
            rects = face_rects(c['uv'][0], c['uv'][1], (w, h, d))
            for face, (tx, ty, tw, th) in rects.items():
                tl, tr, bl = _face_corners(face, x0, y0, z0, x1, y1, z1)
                n = _mv(bm, _mv(cm, FACE_NORMALS[face]))
                du = [(tr[k] - tl[k]) / tw for k in range(3)]
                dv = [(bl[k] - tl[k]) / th for k in range(3)]
                for j in range(th):
                    for i in range(tw):
                        col = texture.getpixel((tx + i, ty + j))
                        if col[3] < 128:
                            continue
                        pts = []
                        for (a, b) in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                            p = tuple(tl[k] + du[k] * a + dv[k] * b for k in range(3))
                            p = _about(p, cpivot, cm)
                            p = _about(p, bpivot, bm)
                            pts.append(p)
                        quads.append((pts, col, n))
    return quads


def render(quads, yaw=0.0, pitch=0.0, scale=12, size=(360, 480), center=(0, 16, 0)):
    """Orthographic render; yaw rotates the model, pitch tilts the camera."""
    cy_, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    light = (-0.35, 0.55, -0.75)
    ll = math.sqrt(sum(v * v for v in light))
    light = tuple(v / ll for v in light)

    def turn(x, y, z):
        x, z = x * cy_ + z * sy_, -x * sy_ + z * cy_
        y, z = y * cp - z * sp, y * sp + z * cp
        return x, y, z

    def view(p):
        return turn(p[0] - center[0], p[1] - center[1], p[2] - center[2])

    # z-buffered rasterisation (painter's sorting breaks on touching cubes)
    w, h = size
    zbuf = np.full((h, w), np.inf)
    rgb = np.zeros((h, w, 4), dtype=np.uint8)
    for pts, col, n in quads:
        vn = turn(*n)
        if vn[2] > 0.01:  # back-face culling
            continue
        vp = [view(p) for p in pts]
        lum = 0.62 + 0.38 * max(0.0, vn[0] * light[0] + vn[1] * light[1] + vn[2] * light[2])
        lum = min(1.0, lum)
        c = np.array([int(col[0] * lum), int(col[1] * lum), int(col[2] * lum), 255], dtype=np.uint8)
        screen = [(w / 2 + p[0] * scale, h / 2 - p[1] * scale, p[2]) for p in vp]
        for tri in ((screen[0], screen[1], screen[2]), (screen[0], screen[2], screen[3])):
            _raster(tri, c, zbuf, rgb)
    img = Image.fromarray(rgb, 'RGBA')
    return img


def _raster(tri, color, zbuf, rgb):
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = tri
    h, w = zbuf.shape
    minx, maxx = max(0, int(np.floor(min(x0, x1, x2)))), min(w - 1, int(np.ceil(max(x0, x1, x2))))
    miny, maxy = max(0, int(np.floor(min(y0, y1, y2)))), min(h - 1, int(np.ceil(max(y0, y1, y2))))
    if minx > maxx or miny > maxy:
        return
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-9:
        return
    xs, ys = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
    w0 = ((x1 - xs) * (y2 - ys) - (x2 - xs) * (y1 - ys)) / area
    w1 = ((x2 - xs) * (y0 - ys) - (x0 - xs) * (y2 - ys)) / area
    w2 = 1 - w0 - w1
    eps = -1e-4
    inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
    depth = w0 * z0 + w1 * z1 + w2 * z2
    region = zbuf[miny:maxy + 1, minx:maxx + 1]
    closer = inside & (depth < region)
    region[closer] = depth[closer]
    rgb[miny:maxy + 1, minx:maxx + 1][closer] = color


def preview_player_skin():
    """A plain player model (peach skin, black eyes) to dress up in previews."""
    atlas = Atlas(64, 64)
    skin = rgba('#F0C08A')
    skin_d = rgba('#D9A26C')
    eye = rgba('#1A1A1A')
    white = rgba('#FFFFFF')

    def plain(color, face_details=False):
        def paint(img, rects, size):
            for face, (x, y, w, h) in rects.items():
                for j in range(h):
                    for i in range(w):
                        img.putpixel((x + i, y + j), color if face != 'down' else skin_d)
            if face_details:
                x, y, w, h = rects['front']
                for (i, j) in ((1, 4), (2, 4), (5, 4), (6, 4)):
                    img.putpixel((x + i, y + j), white)
                for (i, j) in ((2, 4), (5, 4)):
                    img.putpixel((x + i, y + j), eye)
                for i in range(3, 5):
                    img.putpixel((x + i, y + 6), skin_d)
        return paint

    m = Model('geometry.preview.player', atlas)
    m.bone('head', (0, 24, 0))
    m.bone('body', (0, 24, 0))
    m.bone('rightArm', (-5, 22, 0))
    m.bone('leftArm', (5, 22, 0))
    m.bone('rightLeg', (-1.9, 12, 0))
    m.bone('leftLeg', (1.9, 12, 0))
    m.cube('head', (-4, 24, -4), (8, 8, 8), plain(skin, True))
    m.cube('body', (-4, 12, -2), (8, 12, 4), plain(skin_d))
    m.cube('rightArm', (-8, 12, -2), (4, 12, 4), plain(skin))
    m.cube('leftArm', (4, 12, -2), (4, 12, 4), plain(skin))
    m.cube('rightLeg', (-3.9, 0, -2), (4, 12, 4), plain(skin_d))
    m.cube('leftLeg', (-0.1, 0, -2), (4, 12, 4), plain(skin_d))
    return m.to_json(), atlas.img
