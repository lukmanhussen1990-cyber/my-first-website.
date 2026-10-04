"""Builds the Flying Guardian geometry + texture, and renders preview images.

    python3 tools/build_assets.py            # writes geometry, texture, icons and previews

Outputs (relative to the add-on folder):
    FlyingGuardian_RP/models/entity/flying_guardian.geo.json
    FlyingGuardian_RP/textures/entity/flying_guardian.tga   (vanilla-style uncompressed TGA)
    FlyingGuardian_RP/textures/items/flying_guardian_spawn_egg.png
    FlyingGuardian_RP/pack_icon.png, FlyingGuardian_BP/pack_icon.png
    previews/*.png

Texture alpha conventions (material "entity_emissive_alpha"):
    255      -> normal lit pixel
    64..254  -> emissive (lower alpha = stronger glow), like vanilla enderman/spider eyes
    nothing on the model uses alpha 0, so the look does not depend on alpha-test thresholds.
"""

import json
import math
import os
import random
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from model_def import build_model  # noqa: E402

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RP = os.path.join(ADDON, "FlyingGuardian_RP")
BP = os.path.join(ADDON, "FlyingGuardian_BP")
PREVIEW_DIR = os.path.join(ADDON, "previews")

GEO_ID = "geometry.fguard.flying_guardian"
ATLAS_W = 128

# ---------------------------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------------------------
SKIN = (38, 33, 40)
SKIN_DARK = (22, 19, 25)
PLATE = (58, 51, 60)
PLATE_HI = (88, 79, 90)
HORN = (74, 64, 62)
HORN_DARK = (40, 33, 34)
HORN_TIP = (30, 22, 24)
CLAW = (24, 21, 26)
CLAW_HI = (78, 70, 80)
CLAW_TIP = (122, 24, 18)
WINGBONE = (50, 43, 50)
MEMBRANE = (36, 15, 19)
MEMBRANE_DARK = (17, 8, 11)
MEMBRANE_VEIN = (64, 22, 26)
TOOTH = (228, 218, 196)
TOOTH_SHADE = (176, 164, 142)
MOUTH = (96, 12, 8)
EMBER = (255, 110, 24)
EMBER_HOT = (255, 186, 70)
EYE_HOT = (255, 214, 92)
EYE = (255, 72, 16)
EYE_DEEP = (214, 22, 8)

FACE_SHADE = {"north": 1.0, "south": 0.82, "east": 0.9, "west": 0.9, "up": 1.12, "down": 0.68}


def clamp8(v):
    return int(max(0, min(255, round(v))))


def shade(color, f):
    return tuple(clamp8(c * f) for c in color)


def mix(a, b, t):
    return tuple(clamp8(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------------------------------------------------------------------------------------------
# UV layout
# ---------------------------------------------------------------------------------------------
FACE_ORDER = ("north", "south", "east", "west", "up", "down")


def face_dims(cube, face):
    sx, sy, sz = cube.size
    if face in ("north", "south"):
        w, h = sx, sy
    elif face in ("east", "west"):
        w, h = sz, sy
    else:
        w, h = sx, sz
    return max(1, int(round(w))), max(1, int(round(h)))


class Atlas:
    def __init__(self, width):
        self.width = width
        self.x = 0
        self.y = 0
        self.row_h = 0
        self.rects = []  # (cube, face, u, v, w, h)

    def place(self, cube, face, w, h):
        if self.x + w > self.width:
            self.x = 0
            self.y += self.row_h
            self.row_h = 0
        rect = (cube, face, self.x, self.y, w, h)
        self.rects.append(rect)
        self.x += w
        self.row_h = max(self.row_h, h)
        return rect

    @property
    def height(self):
        return self.y + self.row_h


def layout(bones):
    faces = []
    for bone in bones:
        for cube in bone.cubes:
            for face in cube.faces:
                w, h = face_dims(cube, face)
                faces.append((cube, face, w, h))
    # Tall faces first gives a tighter shelf packing.
    faces.sort(key=lambda f: (-f[3], -f[2]))
    atlas = Atlas(ATLAS_W)
    uv = {}
    for cube, face, w, h in faces:
        _, _, u, v, w, h = atlas.place(cube, face, w, h)
        uv[(id(cube), face)] = (u, v, w, h)
    height = 1
    while height < atlas.height:
        height *= 2
    return uv, height


# ---------------------------------------------------------------------------------------------
# Painting
# ---------------------------------------------------------------------------------------------
class Painter:
    def __init__(self, width, height, seed=1337):
        self.rgb = np.zeros((height, width, 3), dtype=np.float32)
        self.alpha = np.full((height, width), 255, dtype=np.float32)
        # Unused atlas space is opaque dark skin, so mip-mapping never blends in transparency.
        self.rgb[:, :] = SKIN_DARK
        self.rng = random.Random(seed)

    def px(self, u, v, color, alpha=255):
        self.rgb[v, u] = color
        self.alpha[v, u] = alpha

    def get(self, u, v):
        return tuple(int(c) for c in self.rgb[v, u])


def noise_color(rng, base, amount):
    n = rng.uniform(-amount, amount)
    return tuple(clamp8(c + n) for c in base)


def paint_generic(p, rect, base, face, rng, noise=7, edge_dark=0.82, speckle=None):
    u0, v0, w, h = rect
    f = FACE_SHADE[face]
    for j in range(h):
        for i in range(w):
            c = noise_color(rng, base, noise)
            edge = (i == 0 or j == 0 or i == w - 1 or j == h - 1) and w > 2 and h > 2
            if edge:
                c = shade(c, edge_dark)
            if speckle and rng.random() < speckle[0]:
                c = shade(c, speckle[1])
            p.px(u0 + i, v0 + j, shade(c, f))


def paint_cracks(p, rect, rng, count, length, alpha=165, hot_chance=0.25):
    """Glowing ember veins (emissive)."""
    u0, v0, w, h = rect
    if w < 3 or h < 3:
        return
    for _ in range(count):
        x = rng.randrange(1, w - 1)
        y = rng.randrange(1, h - 1)
        for _ in range(length):
            hot = rng.random() < hot_chance
            p.px(u0 + x, v0 + y, EMBER_HOT if hot else EMBER, alpha - (20 if hot else 0))
            x = max(1, min(w - 2, x + rng.choice((-1, 0, 1))))
            y = max(1, min(h - 2, y + rng.choice((-1, 0, 1, 1))))


def mirror_rect_h(p, src, dst):
    su, sv, w, h = src
    du, dv, dw, dh = dst
    assert (w, h) == (dw, dh)
    p.rgb[dv:dv + h, du:du + w] = p.rgb[sv:sv + h, su:su + w][:, ::-1]
    p.alpha[dv:dv + h, du:du + w] = p.alpha[sv:sv + h, su:su + w][:, ::-1]


def symmetrize(p, rect):
    """Make a face left/right symmetric by mirroring its left half onto the right half."""
    u0, v0, w, h = rect
    for i in range(w // 2):
        p.rgb[v0:v0 + h, u0 + w - 1 - i] = p.rgb[v0:v0 + h, u0 + i]
        p.alpha[v0:v0 + h, u0 + w - 1 - i] = p.alpha[v0:v0 + h, u0 + i]


def paint_face(p, cube, face, rect, rng):
    mat, tag = cube.mat, cube.tag
    u0, v0, w, h = rect

    if mat == "skin":
        paint_generic(p, rect, SKIN, face, rng, noise=6, speckle=(0.12, 0.82))
        if tag in ("chest", "forearm", "limb") and face in ("north", "east", "west", "south"):
            area = w * h
            if area >= 30 and rng.random() < 0.75:
                paint_cracks(p, rect, rng, count=1, length=2 + area // 40, hot_chance=0.1)
        if tag == "skull" and face == "north":
            paint_skull_front(p, rect)
        if tag == "skull" and face == "up":
            for i in range(w):
                for j in range(h):
                    if (i + j) % 3 == 0:
                        p.px(u0 + i, v0 + j, shade(p.get(u0 + i, v0 + j), 0.85))
            symmetrize(p, rect)
        if tag == "muzzle" and face == "north":
            paint_muzzle_front(p, rect)
        if tag == "muzzle" and face == "down":
            for i in range(w):
                p.px(u0 + i, v0, TOOTH if i % 2 == 0 else TOOTH_SHADE)
        if tag == "jaw" and face == "north":
            for i in range(w):
                p.px(u0 + i, v0, TOOTH if i % 2 == 1 else TOOTH_SHADE)
        if tag == "jaw" and face == "up":
            # Up faces map their last texture row to the front (north) edge, like box UV.
            for j in range(h):
                for i in range(w):
                    glow = 150 if (1 <= i <= w - 2 and j <= h - 2) else 255
                    p.px(u0 + i, v0 + j, mix(MOUTH, EMBER, 0.15 * (1 - j / max(1, h - 1))), glow)
            for i in range(w):
                p.px(u0 + i, v0 + h - 1, TOOTH if i % 2 == 0 else TOOTH_SHADE)
        if tag == "abdomen" and face == "north":
            paint_abs(p, rect)
        if tag == "chest" and face == "north":
            symmetrize(p, rect)
        if tag in ("hand", "foot") and face == "down":
            for i in range(w):
                for j in range(h):
                    p.px(u0 + i, v0 + j, shade(SKIN_DARK, 0.8))
        return

    if mat == "plate":
        paint_generic(p, rect, PLATE, face, rng, noise=5, edge_dark=0.7)
        if face in ("north", "east", "west", "south") and h >= 2:
            for i in range(w):
                p.px(u0 + i, v0, shade(PLATE_HI, FACE_SHADE[face]))
        if tag == "chest_plate" and face == "north":
            paint_chest_plate(p, rect)
        if tag == "brow" and face == "north":
            for i in range(w):
                p.px(u0 + i, v0, shade(PLATE_HI, 1.0))
        return

    if mat == "horn":
        f = FACE_SHADE[face]
        for j in range(h):
            for i in range(w):
                # dark base -> darker tip, with ridge bands
                t = j / max(1, h - 1)
                c = mix(HORN_DARK, HORN, t)
                if tag == "horn_tip":
                    c = mix(HORN_TIP, HORN_DARK, t)
                    if j == 0:
                        c = mix(c, CLAW_TIP, 0.55)
                if j % 2 == 0 and tag == "horn":
                    c = shade(c, 0.85)
                if i == 0 and w > 1:
                    c = shade(c, 1.15)
                c = noise_color(rng, c, 4)
                p.px(u0 + i, v0 + j, shade(c, f))
        return

    if mat == "claw":
        f = FACE_SHADE[face]
        for j in range(h):
            for i in range(w):
                c = noise_color(rng, CLAW, 3)
                if i == 0 and face in ("north", "east", "west", "south"):
                    c = CLAW_HI
                if j >= h - 2 and face in ("north", "east", "west", "south") and h >= 3:
                    c = mix(c, CLAW_TIP, 0.75 if j == h - 1 else 0.4)
                p.px(u0 + i, v0 + j, shade(c, f))
        return

    if mat == "tooth":
        f = FACE_SHADE[face]
        for j in range(h):
            for i in range(w):
                c = TOOTH if j < h - 1 else TOOTH_SHADE
                p.px(u0 + i, v0 + j, shade(noise_color(rng, c, 5), f))
        return

    if mat == "wingbone":
        paint_generic(p, rect, WINGBONE, face, rng, noise=5, edge_dark=0.85)
        if tag == "wingbone" and face in ("north", "south", "up"):
            for i in range(0, w, 6):
                for j in range(h):
                    p.px(u0 + i, v0 + j, shade(PLATE_HI, FACE_SHADE[face]))
        return

    if mat == "membrane":
        paint_membrane(p, cube, rect, rng)
        return

    if mat == "spade":
        f = FACE_SHADE[face]
        for j in range(h):
            for i in range(w):
                edge = i == 0 or i == w - 1 or j == 0 or j == h - 1
                if edge and face in ("up", "down"):
                    p.px(u0 + i, v0 + j, EMBER, 150)
                else:
                    p.px(u0 + i, v0 + j, shade(noise_color(rng, HORN_TIP, 4), f))
        return

    raise ValueError(f"unknown material {mat}")


def paint_skull_front(p, rect):
    """Skull north face. Row 0 is the top (y=39). Muzzle hides rows 4-5, brow hides rows 1-2."""
    u0, v0, w, h = rect
    # Glowing eyes: rows 2-3 (y 35..37), two pixels wide each, symmetric.
    eye_cols = (1, 2)
    for c in eye_cols:
        outer = c == 1
        p.px(u0 + c, v0 + 2, EYE_HOT if outer else EYE, 70 if outer else 80)
        p.px(u0 + c, v0 + 3, EYE if outer else EYE_DEEP, 85 if outer else 95)
    # dark sockets around the eyes
    p.px(u0 + 0, v0 + 2, shade(SKIN_DARK, 0.7))
    p.px(u0 + 3, v0 + 3, shade(SKIN_DARK, 0.7))
    # glowing mouth interior behind the fangs (bottom row)
    for i in range(1, w - 1):
        p.px(u0 + i, v0 + h - 1, mix(MOUTH, EMBER, 0.3), 140)
    symmetrize(p, rect)


def paint_muzzle_front(p, rect):
    u0, v0, w, h = rect
    # nostrils on the upper row, close to the centre
    p.px(u0 + 2, v0, shade(SKIN_DARK, 0.5))
    # gum line with upper teeth on the bottom row
    for i in range(w):
        p.px(u0 + i, v0 + h - 1, TOOTH if i % 2 == 0 else (120, 26, 20))
    symmetrize(p, rect)


def paint_abs(p, rect):
    u0, v0, w, h = rect
    for j in range(h):
        for i in range(w):
            if i == w // 2 or i == w // 2 - 1 and w % 2 == 0:
                continue
            if j % 2 == 1:
                p.px(u0 + i, v0 + j, shade(p.get(u0 + i, v0 + j), 0.72))
    mid = w // 2
    for j in range(h):
        p.px(u0 + mid, v0 + j, shade(SKIN_DARK, 0.75))
        if w % 2 == 0:
            p.px(u0 + mid - 1, v0 + j, shade(SKIN_DARK, 0.75))
    symmetrize(p, rect)


def paint_chest_plate(p, rect):
    """Pectoral plates with a glowing infernal core in the middle."""
    u0, v0, w, h = rect
    cx = w // 2  # w is odd (11): centre column
    for j in range(h):
        p.px(u0 + cx, v0 + j, shade(SKIN_DARK, 0.8))
    for i in range(w):
        p.px(u0 + i, v0 + h - 1, shade(PLATE, 0.62))
    # diamond-shaped glowing sigil
    core = [(0, 1), (-1, 2), (0, 2), (1, 2), (0, 3), (-1, 3), (1, 3), (0, 4)]
    for dx, dy in core:
        hot = dx == 0 and dy in (2, 3)
        p.px(u0 + cx + dx, v0 + dy, EMBER_HOT if hot else EMBER, 85 if hot else 120)
    # thin cracks radiating from the core toward the shoulders
    for side in (-1, 1):
        p.px(u0 + cx + 2 * side, v0 + 1, EMBER, 185)
        p.px(u0 + cx + 3 * side, v0 + 0, (196, 70, 18), 205)
    symmetrize(p, rect)


def paint_membrane(p, cube, rect, rng):
    u0, v0, w, h = rect
    for j in range(h):
        t = j / max(1, h - 1)  # 0 at the wing bone, 1 at the trailing edge
        for i in range(w):
            c = mix(MEMBRANE, MEMBRANE_DARK, t * 0.85)
            c = noise_color(rng, c, 4)
            if j == h - 1:
                c = shade(MEMBRANE_DARK, 0.8)
            p.px(u0 + i, v0 + j, c)
    # occasional thin veins, a few of them faintly glowing near the wing bone
    if w >= 2 and rng.random() < 0.45:
        x = rng.randrange(0, w)
        glowing = rng.random() < 0.35
        for j in range(1, h - 2):
            if rng.random() < 0.8:
                if glowing and j < h // 3:
                    p.px(u0 + x, v0 + j, (132, 30, 22), 215)
                else:
                    p.px(u0 + x, v0 + j, MEMBRANE_VEIN)
            if rng.random() < 0.25:
                x = max(0, min(w - 1, x + rng.choice((-1, 1))))


# ---------------------------------------------------------------------------------------------
# Geometry export
# ---------------------------------------------------------------------------------------------
def r4(v):
    v = round(float(v), 4)
    return int(v) if v == int(v) else v


def export_geometry(bones, uv, tex_h):
    out_bones = []
    for b in bones:
        jb = {"name": b.name, "pivot": [r4(c) for c in b.pivot]}
        if b.parent:
            jb["parent"] = b.parent
        if b.rotation and any(b.rotation):
            jb["rotation"] = [r4(c) for c in b.rotation]
        cubes = []
        for c in b.cubes:
            jc = {"origin": [r4(v) for v in c.lo], "size": [r4(v) for v in c.size]}
            if c.rotation and any(c.rotation):
                jc["pivot"] = [r4(v) for v in c.pivot]
                jc["rotation"] = [r4(v) for v in c.rotation]
            faces = {}
            for face in c.faces:
                u, v, w, h = uv[(id(c), face)]
                faces[face] = {"uv": [u, v], "uv_size": [w, h]}
            jc["uv"] = faces
            cubes.append(jc)
        if cubes:
            jb["cubes"] = cubes
        if b.locators:
            jb["locators"] = {k: [r4(x) for x in v] for k, v in b.locators.items()}
        out_bones.append(jb)
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": GEO_ID,
                    "texture_width": ATLAS_W,
                    "texture_height": tex_h,
                    "visible_bounds_width": 7,
                    "visible_bounds_height": 4,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": out_bones,
            }
        ],
    }


def write_tga(path, rgba):
    """Uncompressed 32-bit TGA, bottom-left origin (same layout as vanilla emissive textures)."""
    h, w, _ = rgba.shape
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, w, h, 32, 8)
    bgra = rgba[::-1, :, [2, 1, 0, 3]].astype(np.uint8)
    with open(path, "wb") as f:
        f.write(header)
        f.write(bgra.tobytes())


# ---------------------------------------------------------------------------------------------
# Software renderer (previews + icons)
# ---------------------------------------------------------------------------------------------
def rot_matrix(r):
    rx, ry, rz = (math.radians(a) for a in r)
    # Bedrock: X and Y rotations are left-handed in file space, Z is right-handed.
    ax, ay, az = -rx, -ry, rz
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def affine(R, pivot):
    M = np.eye(4)
    M[:3, :3] = R
    p = np.array(pivot, dtype=float)
    M[:3, 3] = p - R @ p
    return M


def bone_matrices(bones, pose=None):
    pose = pose or {}
    by_name = {b.name: b for b in bones}
    cache = {}

    def world(name):
        if name in cache:
            return cache[name]
        b = by_name[name]
        r = np.array(b.rotation or (0, 0, 0), dtype=float)
        delta = pose.get(b.name, {})
        r = r + np.array(delta.get("rotation", (0, 0, 0)), dtype=float)
        M = affine(rot_matrix(r), b.pivot)
        if "position" in delta:
            T = np.eye(4)
            T[:3, 3] = delta["position"]
            M = T @ M
        if b.parent:
            M = world(b.parent) @ M
        cache[name] = M
        return M

    return {b.name: world(b.name) for b in bones}


def face_corners(cube, face):
    """Corners ordered (top-left, top-right, bottom-right, bottom-left) as seen from outside,
    matching the painter's (u right, v down) convention."""
    (x0, y0, z0), (x1, y1, z1) = cube.lo, cube.hi
    if face == "north":
        return [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)]
    if face == "south":
        return [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)]
    if face == "east":
        return [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)]
    if face == "west":
        return [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)]
    if face == "up":
        return [(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)]
    if face == "down":
        return [(x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1)]
    raise ValueError(face)


def render(bones, uv, tex_rgba, pose=None, yaw=30, pitch=12, size=640, dist=120, target=(0, 24, 0),
           fov=32, background=None, supersample=2, light=1.0):
    S = size * supersample
    mats = bone_matrices(bones, pose)
    cy_, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    # camera looks at the creature's front (-Z side) when yaw = 0
    fwd = np.array([-sy_ * cp, -sp, cy_ * cp])
    eye = np.array(target, dtype=float) - fwd * dist
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = 0.5 * S / math.tan(math.radians(fov) / 2)

    color = np.zeros((S, S, 3), dtype=np.float32)
    if background is not None:
        color[:] = np.array(Image.fromarray(background).resize((S, S)), dtype=np.float32)[:, :, :3]
    depth = np.full((S, S), np.inf, dtype=np.float32)
    coverage = np.zeros((S, S), dtype=bool)
    tex_h, tex_w, _ = tex_rgba.shape
    light_dir = np.array([0.35, 0.8, -0.5])
    light_dir /= np.linalg.norm(light_dir)

    for b in bones:
        M = mats[b.name]
        for c in b.cubes:
            C = M @ (affine(rot_matrix(c.rotation), c.pivot) if c.rotation else np.eye(4))
            for face in c.faces:
                u0, v0, w, h = uv[(id(c), face)]
                corners = np.array([list(pt) + [1.0] for pt in face_corners(c, face)])
                world = (C @ corners.T).T[:, :3]
                rel = world - eye
                zc = rel @ fwd
                if np.any(zc <= 1):
                    continue
                xs = (rel @ right) * f / zc + S / 2
                ys = -(rel @ up) * f / zc + S / 2
                n = np.cross(world[1] - world[0], world[3] - world[0])
                nl = np.linalg.norm(n)
                if nl < 1e-9:
                    continue
                n /= nl
                # double-sided materials: light the side facing the camera
                if n @ (eye - world[0]) < 0:
                    n = -n
                lit = 0.55 + 0.45 * max(0.0, float(n @ light_dir))
                lit *= light
                uvc = np.array([[u0, v0], [u0 + w, v0], [u0 + w, v0 + h], [u0, v0 + h]], dtype=float)
                for tri in ((0, 1, 2), (0, 2, 3)):
                    raster_tri(xs[list(tri)], ys[list(tri)], zc[list(tri)], uvc[list(tri)], tex_rgba,
                               tex_w, tex_h, lit, color, depth, coverage)
    img = Image.fromarray(np.clip(color, 0, 255).astype(np.uint8))
    alpha = Image.fromarray((coverage * 255).astype(np.uint8))
    if supersample > 1:
        img = img.resize((size, size), Image.LANCZOS)
        alpha = alpha.resize((size, size), Image.LANCZOS)
    return img, alpha


def raster_tri(xs, ys, zs, uvs, tex, tw, th, lit, color, depth, coverage):
    S = color.shape[0]
    minx = max(int(math.floor(xs.min())), 0)
    maxx = min(int(math.ceil(xs.max())), S - 1)
    miny = max(int(math.floor(ys.min())), 0)
    maxy = min(int(math.ceil(ys.max())), S - 1)
    if minx > maxx or miny > maxy:
        return
    x0, x1, x2 = xs
    y0, y1, y2 = ys
    den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(den) < 1e-9:
        return
    gx, gy = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
    l0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / den
    l1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / den
    l2 = 1 - l0 - l1
    inside = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
    if not inside.any():
        return
    iz = l0 / zs[0] + l1 / zs[1] + l2 / zs[2]
    z = 1.0 / iz
    u = (l0 * uvs[0, 0] / zs[0] + l1 * uvs[1, 0] / zs[1] + l2 * uvs[2, 0] / zs[2]) * z
    v = (l0 * uvs[0, 1] / zs[0] + l1 * uvs[1, 1] / zs[1] + l2 * uvs[2, 1] / zs[2]) * z
    ui = np.clip(np.floor(u).astype(int), 0, tw - 1)
    vi = np.clip(np.floor(v).astype(int), 0, th - 1)
    sub_depth = depth[miny:maxy + 1, minx:maxx + 1]
    vis = inside & (z < sub_depth - 1e-4)
    texel = tex[vi, ui]
    a = texel[..., 3:4] / 255.0
    rgb = texel[..., :3]
    out = rgb * lit * a + rgb * (1 - a) * 1.0  # emissive pixels ignore lighting
    sub_color = color[miny:maxy + 1, minx:maxx + 1]
    sub_color[vis] = out[vis]
    sub_depth[vis] = z[vis]
    coverage[miny:maxy + 1, minx:maxx + 1] |= vis


def gradient_bg(size, top, bottom):
    t = np.linspace(0, 1, size)[:, None, None]
    img = np.array(top)[None, None, :] * (1 - t) + np.array(bottom)[None, None, :] * t
    return np.repeat(img, size, axis=1).astype(np.uint8)


# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------
def build():
    bones = build_model()
    uv, tex_h = layout(bones)
    painter = Painter(ATLAS_W, tex_h)
    rng = random.Random(20240515)

    mirrored = []
    for b in bones:
        for c in b.cubes:
            if getattr(c, "mirror_of", None) is not None:
                mirrored.append(c)
                continue
            for face in c.faces:
                paint_face(painter, c, face, uv[(id(c), face)][:4], rng)

    swap = {"east": "west", "west": "east"}
    for c in mirrored:
        src = c.mirror_of
        for face in c.faces:
            src_face = swap.get(face, face)
            mirror_rect_h(painter, uv[(id(src), src_face)], uv[(id(c), face)])

    rgba = np.dstack([painter.rgb, painter.alpha]).astype(np.uint8)
    return bones, uv, tex_h, rgba


def main():
    bones, uv, tex_h, rgba = build()
    geo = export_geometry(bones, uv, tex_h)
    os.makedirs(os.path.join(RP, "models", "entity"), exist_ok=True)
    with open(os.path.join(RP, "models", "entity", "flying_guardian.geo.json"), "w") as f:
        json.dump(geo, f, indent=2)
    os.makedirs(os.path.join(RP, "textures", "entity"), exist_ok=True)
    write_tga(os.path.join(RP, "textures", "entity", "flying_guardian.tga"), rgba)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    Image.fromarray(rgba).resize((ATLAS_W * 4, tex_h * 4), Image.NEAREST).save(
        os.path.join(PREVIEW_DIR, "texture_atlas_x4.png"))

    bg = gradient_bg(256, (70, 74, 96), (150, 128, 120))
    views = {"front": (0, 8), "three_quarter": (35, 12), "side": (90, 5), "back": (180, 10), "low_front": (20, -18)}
    for name, (yaw, pitch) in views.items():
        img, _ = render(bones, uv, rgba, yaw=yaw, pitch=pitch, background=bg)
        img.save(os.path.join(PREVIEW_DIR, f"model_{name}.png"))
    print("cubes:", sum(len(b.cubes) for b in bones), "bones:", len(bones), "texture:", ATLAS_W, "x", tex_h)


if __name__ == "__main__":
    main()
