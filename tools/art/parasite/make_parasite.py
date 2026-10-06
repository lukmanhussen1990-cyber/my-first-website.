#!/usr/bin/env python3
"""Generate the pas:parasite client visuals (original art, no Mojang pixels).

Writes
  addon/resource_pack/models/entity/pas_parasite.geo.json
  addon/resource_pack/textures/entity/pas/parasite.png          (128x128, 2 px per texture unit)
  addon/resource_pack/animations/pas_parasite.animation.json
  addon/resource_pack/animation_controllers/pas_parasite.animation_controllers.json
  addon/resource_pack/render_controllers/pas_parasite.render_controllers.json
  addon/resource_pack/entity/pas_parasite.entity.json

Usage: python3 tools/art/parasite/make_parasite.py [--seed N]

The palette was built by sampling the reference screenshot (k-means clusters
of the head, face, mouth, body, legs and claws) and dividing out the night
lighting (~0.55); no pixel of the reference is copied.  The eye texels use
alpha 3, the same emissive mask value as vanilla spider.tga, because the
model renders with the vanilla "spider" material (see docs/PARASITE_ART.md).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import model  # noqa: E402
import anims  # noqa: E402

ROOT = HERE.parent.parent.parent
RP = ROOT / "addon" / "resource_pack"
TEX_REL = "textures/entity/pas/parasite"

S = model.TEX_SCALE
EMISSIVE_ALPHA = 3          # vanilla spider.tga eye texels use alpha 3

# ---------------------------------------------------------------------------
# palette (RGB).  Reference samples (night-lit) / 0.55, then hand-balanced.
# ---------------------------------------------------------------------------
P = {
    # pale head skin
    "skin_hi": (228, 182, 160),
    "skin": (208, 154, 132),
    "skin_mid": (186, 128, 108),
    "skin_lo": (156, 100, 84),
    "blotch_lt": (150, 74, 60),
    "blotch": (116, 34, 26),
    "blotch_dk": (76, 16, 12),
    # crimson / brown flesh (body, legs)
    "flesh_pale": (178, 118, 100),
    "flesh_lt": (146, 60, 46),
    "flesh": (118, 24, 18),
    "flesh_dk": (82, 14, 10),
    "flesh_brown": (96, 46, 32),
    "flesh_deep": (50, 9, 6),
    "joint": (44, 12, 9),
    # mouth / blood
    "mouth_black": (20, 3, 3),
    "mouth_deep": (46, 6, 5),
    "mouth_red": (96, 10, 8),
    "gum": (148, 28, 22),
    "blood": (132, 10, 8),
    "blood_hi": (176, 24, 18),
    "tongue": (122, 30, 30),
    "tooth": (176, 118, 98),
    "tooth_mid": (146, 66, 52),
    "tooth_stain": (112, 24, 18),
    # eyes (emissive)
    "eye": (255, 252, 246),
    "eye_rim": (255, 196, 188),
    "eye_glow": (232, 92, 84),
    "socket": (92, 12, 10),
    # claws
    "claw": (40, 22, 17),
    "claw_dk": (18, 10, 8),
    "claw_lt": (66, 36, 28),
}


def C(name, a=255):
    r, g, b = P[name]
    return np.array([r, g, b, a], dtype=np.uint8)


class Painter:
    def __init__(self, seed: int):
        self.img = np.zeros((model.UV_H * S, model.UV_W * S, 4), dtype=np.uint8)
        self.img[:] = C("flesh_deep")
        self.rng = np.random.default_rng(seed)

    # -- helpers --------------------------------------------------------------
    def rect_px(self, rect):
        u0, v0, u1, v1 = rect
        return int(round(u0 * S)), int(round(v0 * S)), int(round(u1 * S)), int(round(v1 * S))

    def noise(self, h, w, cell=2):
        """Blocky value noise in [0,1): random cells of `cell` px plus per-pixel jitter."""
        ch, cw = -(-h // cell) + 1, -(-w // cell) + 1
        coarse = self.rng.random((ch, cw))
        big = np.kron(coarse, np.ones((cell, cell)))[:h, :w]
        return np.clip(0.65 * big + 0.35 * self.rng.random((h, w)), 0, 0.9999)

    def blotches(self, h, w, count, rmin=1, rmax=3):
        """Mask of irregular blotches (pixel clusters)."""
        m = np.zeros((h, w), dtype=float)
        for _ in range(count):
            cy, cx = self.rng.integers(0, h), self.rng.integers(0, w)
            r = self.rng.integers(rmin, rmax + 1)
            for _ in range(int(r * r * 1.6) + 1):
                y = cy + self.rng.integers(-r, r + 1)
                x = cx + self.rng.integers(-r, r + 1)
                if 0 <= y < h and 0 <= x < w:
                    m[y, x] = max(m[y, x], 1.0 if abs(y - cy) + abs(x - cx) <= r else 0.6)
        return m

    def put(self, x0, y0, arr):
        h, w = arr.shape[:2]
        self.img[y0:y0 + h, x0:x0 + w] = arr

    @staticmethod
    def pick(levels, names, n):
        """Map noise n (h,w) through ascending thresholds to palette names."""
        out = np.zeros(n.shape + (4,), dtype=np.uint8)
        idx = np.searchsorted(np.array(levels), n, side="right")
        for i, nm in enumerate(names):
            out[idx == i] = C(nm)
        return out

    # -- materials ------------------------------------------------------------
    RED = ("blood_hi", "blood", "blood", "blotch", "blotch", "blotch_dk", "flesh_lt", "skin_lo")

    def red(self):
        """One texel of the crimson face/blood mottling."""
        return C(self.RED[int(self.rng.integers(0, len(self.RED)))])

    def red_field(self, h, w):
        """Clustered crimson mottling (blood-soaked skin): value noise mapped
        dark -> bright, with a few pale skin flecks."""
        n = self.noise(h, w, 2)
        a = self.pick([0.14, 0.34, 0.58, 0.8, 0.93],
                      ["blotch_dk", "blood", "blotch", "blood_hi", "flesh_lt", "skin_lo"], n)
        return a

    def soak(self, base, red, prob_rows, cell=2):
        """Replace base texels by red ones where clustered noise < per-row probability."""
        h, w = base.shape[:2]
        n = self.noise(h, w, cell)
        p = np.asarray(prob_rows, dtype=float).reshape(-1, 1) if np.ndim(prob_rows) == 1 else prob_rows
        m = n < p
        out = base.copy()
        out[m] = red[m]
        return out

    def splats(self, h, w, count):
        """Irregular blood splats: 2-5 px clusters (1 = core, 0.5 = soft edge)."""
        m = np.zeros((h, w), dtype=float)
        for _ in range(count):
            y, x = int(self.rng.integers(0, h)), int(self.rng.integers(0, w))
            for _ in range(int(self.rng.integers(2, 6))):
                if 0 <= y < h and 0 <= x < w:
                    m[y, x] = 1.0
                    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and m[yy, xx] == 0 and self.rng.random() < 0.3:
                            m[yy, xx] = 0.5
                d = int(self.rng.integers(0, 4))
                y += (0, 1, 0, -1)[d]
                x += (1, 0, -1, 0)[d]
        return m

    def skin(self, h, w, blotch_count=None, bloody=0.0):
        """Pale beige-pink skin with dark crimson splats (the reference head)."""
        n = self.noise(h, w, 2)
        a = self.pick([0.18, 0.62, 0.9], ["skin_mid", "skin", "skin_hi", "skin"], 1 - n)
        lo = self.rng.random((h, w)) < 0.06
        a[lo] = C("skin_lo")
        bc = blotch_count if blotch_count is not None else max(1, (h * w) // 40)
        m = self.splats(h, w, bc)
        core = m >= 1.0
        dark = self.rng.random((h, w)) < 0.4
        a[core] = C("blotch")
        a[core & dark] = C("blotch_dk")
        a[(m > 0) & (m < 1)] = C("blotch_lt")
        if bloody > 0:
            yy = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
            r = self.rng.random((h, w))
            soak = r < (yy ** 1.6) * bloody
            a[soak] = C("blood")
        return a

    def flesh(self, h, w, pale=0.12):
        """Mottled crimson / brown flesh with pale pink flecks (body and limbs)."""
        n = self.noise(h, w, 2)
        a = self.pick([0.16, 0.36, 0.6, 0.82], ["flesh_deep", "flesh_dk", "flesh", "flesh_brown", "flesh_lt"], n)
        m = self.splats(h, w, max(1, int(h * w * pale / 4)))
        a[m >= 1.0] = C("flesh_pale")
        a[(m >= 1.0) & (self.rng.random((h, w)) < 0.35)] = C("skin_mid")
        a[(m > 0) & (m < 1)] = C("flesh_lt")
        return a

    def shade_rows(self, a, top=0, bottom=0, color="joint", strength=0.75):
        """Darken the first `top` and last `bottom` pixel rows (joint ends)."""
        h = a.shape[0]
        c = C(color).astype(float)
        for i in range(top):
            t = strength * (1 - i / max(1, top))
            a[i] = (a[i] * (1 - t) + c * t).astype(np.uint8)
        for i in range(bottom):
            t = strength * (1 - i / max(1, bottom))
            a[h - 1 - i] = (a[h - 1 - i] * (1 - t) + c * t).astype(np.uint8)
        return a

    def shade_cols(self, a, left=0, right=0, color="joint", strength=0.5):
        b = np.transpose(a, (1, 0, 2)).copy()
        b = self.shade_rows(b, left, right, color, strength)
        return np.transpose(b, (1, 0, 2)).copy()


def mouth_hole_rows(pt, top, rows, centre, widths):
    """{row: (first col, last col)} of a jagged mouth hole; widths = half widths per row."""
    out = {}
    for i, hw in enumerate(widths):
        r = top + i
        if r >= rows:
            break
        jl = int(pt.rng.integers(-1, 2)) if hw > 1.5 else 0
        jr = int(pt.rng.integers(-1, 2)) if hw > 1.5 else 0
        out[r] = (int(round(centre - hw)) + jl, int(round(centre + hw - 1)) + jr)
    return out


def paint_hole(pt, a, hole):
    """Black hole with dark-red depth specks, ragged blood-red rim and strands
    of flesh hanging into it."""
    h, w = a.shape[:2]
    for r, (lo, hi) in hole.items():
        for c in range(max(0, lo), min(w, hi + 1)):
            a[r, c] = C("mouth_black") if pt.rng.random() < 0.9 else C("mouth_deep")
        for c in (lo - 1, hi + 1):      # rim
            if 0 <= c < w:
                a[r, c] = C("blood") if pt.rng.random() < 0.6 else C("blotch_dk")
    rows = sorted(hole)
    for r in rows:                      # ragged strands dangling from each row's top edge
        lo, hi = hole[r]
        for c in range(max(0, lo), min(w, hi + 1)):
            if (r - 1) not in hole or not (hole[r - 1][0] <= c <= hole[r - 1][1]):
                if pt.rng.random() < 0.4:
                    a[r, c] = C("blood")
                    if (r + 1) in hole and pt.rng.random() < 0.35:
                        a[r + 1, c] = C("mouth_red")


def paint(seed: int = 7) -> np.ndarray:
    bones = model.build_bones()
    regions, swatches = model.pack_layout(bones)
    pt = Painter(seed)

    def faces(name):
        u, v, w, h, d = regions[name]
        return {f: pt.rect_px(r) for f, r in model.box_face_rects(u, v, w, h, d).items()}

    def fill(rect, arr):
        x0, y0, x1, y1 = rect
        pt.put(x0, y0, arr[: y1 - y0, : x1 - x0])

    def dims(rect):
        x0, y0, x1, y1 = rect
        return y1 - y0, x1 - x0

    # ---------------- skull ----------------------------------------------------
    # The reference head: pale blotched cap, a face that turns crimson below the
    # brow, two white eyes, and a black gaping hole of a mouth with ragged red
    # edges that runs from between the eyes down through the jaw.
    f = faces("skull")
    h, w = dims(f["up"])
    fill(f["up"], pt.skin(h, w, blotch_count=(h * w) // 24))
    for side in ("east", "west"):      # east: right edge = front; west: left edge = front
        h, w = dims(f[side])
        a = pt.skin(h, w, blotch_count=(h * w) // 34)
        rr = np.linspace(0, 1, h).reshape(-1, 1)
        cc = np.linspace(0, 1, w).reshape(1, -1)
        if side == "west":
            cc = cc[:, ::-1]
        prob = np.clip(rr ** 1.2 * 1.05 + cc ** 3 * 0.5 - 0.22, 0, 1)
        a = pt.soak(a, pt.red_field(h, w), prob)
        fill(f[side], pt.shade_rows(a, 0, 1, "blotch_dk", 0.4))
    h, w = dims(f["south"])
    back = pt.soak(pt.skin(h, w), pt.flesh(h, w), np.linspace(0.0, 1.1, h))
    fill(f["south"], back)
    # palate (seen when the jaw opens): black-red throat, ragged red gum at the front (bottom rows)
    h, w = dims(f["down"])
    pal = pt.pick([0.55, 0.9], ["mouth_black", "mouth_deep", "mouth_red"], pt.noise(h, w))
    for c in range(w):
        for i in range(int(pt.rng.integers(1, 4))):
            pal[h - 1 - i, c] = C("blood") if i == 0 else C("mouth_red")
    fill(f["down"], pal)
    # face (north): 20 x 12 px, col 0 = entity's right (x = -5), row 0 = y 16
    h, w = dims(f["north"])
    face = pt.skin(h, w, blotch_count=5)
    face = pt.soak(face, pt.red_field(h, w), [0.0, 0.08, 0.3, 0.55, 0.75, 0.9, 0.95, 1, 1, 1, 1, 1][:h])
    for c0, c1 in ((2, 6), (14, 18)):  # eye cubes x -4..-2 / 2..4 -> cols 2..5 / 14..17, rows 5..8
        for r in range(4, 10):
            for c in range(c0 - 1, c1 + 1):
                if pt.rng.random() < 0.8:
                    face[r, c] = C("blood_hi") if pt.rng.random() < 0.6 else C("blood")
        face[5:9, c0:c1] = C("eye")
    hole = mouth_hole_rows(pt, top=4, rows=h, centre=9.5, widths=[1.0, 2.0, 2.5, 3.0, 3.0, 4.5, 5.5, 6.0])
    paint_hole(pt, face, hole)
    fill(f["north"], face)

    # ---------------- jaw -----------------------------------------------------
    f = faces("jaw")
    h, w = dims(f["north"])            # 8 x 20 px; row 0 = y 10, col 0 = x -5
    jf = pt.red_field(h, w)
    hole = mouth_hole_rows(pt, top=0, rows=h, centre=9.5, widths=[6.0, 6.0, 5.5, 5.0, 4.5, 3.5, 2.5])
    paint_hole(pt, jf, hole)
    for c in range(w):                 # drool streaks down the chin
        if pt.rng.random() < 0.3:
            r0 = max([r for r, (lo, hi) in hole.items() if lo <= c <= hi] or [2]) + 1
            for r in range(r0, h):
                jf[r, c] = C("blood") if r < h - 1 else C("blotch_dk")
    fill(f["north"], jf)
    for side in ("east", "west"):
        h, w = dims(f[side])
        a = pt.soak(pt.red_field(h, w), pt.skin(h, w, blotch_count=2), np.full(h, 0.12))
        a[0, :] = C("mouth_deep")       # lip line
        fill(f[side], a)
    h, w = dims(f["up"])               # tongue / gums: top row = back, bottom rows = front
    tg = pt.pick([0.45, 0.85], ["mouth_black", "mouth_deep", "mouth_red"], pt.noise(h, w))
    tg[4:h - 5, w // 2 - 3:w // 2 + 3] = C("tongue")
    tg[5:h - 7, w // 2 - 1:w // 2 + 1] = C("mouth_red")
    for c in range(w):
        for i in range(int(pt.rng.integers(1, 3))):
            tg[h - 1 - i, c] = C("blood")
    fill(f["up"], tg)
    h, w = dims(f["down"])
    fill(f["down"], pt.soak(pt.red_field(h, w), pt.skin(h, w, blotch_count=4), np.full(h, 0.2)))
    h, w = dims(f["south"])
    fill(f["south"], pt.pick([0.5], ["flesh_deep", "flesh_dk"], pt.noise(h, w)))

    # ---------------- eyes (emissive) ----------------------------------------
    f = faces("eye")
    for fname, rect in f.items():
        h, w = dims(rect)
        a = np.zeros((h, w, 4), dtype=np.uint8)
        if fname == "north":            # 4x4 px: white square, faint warm corners
            a[:] = C("eye", EMISSIVE_ALPHA)
            for (yy, xx) in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
                a[yy, xx] = C("eye_rim", EMISSIVE_ALPHA)
        else:                           # the 0.3-unit protrusion glows pink-red
            a[:] = C("eye_glow", EMISSIVE_ALPHA)
        fill(rect, a)

    # ---------------- body ----------------------------------------------------
    for reg in ("chest", "abdomen"):
        f = faces(reg)
        for fname, rect in f.items():
            h, w = dims(rect)
            a = pt.flesh(h, w, pale=0.24 if fname in ("up", "east", "west") else 0.14)
            if fname in ("east", "west", "south", "north"):
                # rib-like darker bands
                for r in range(3, h - 1, 4):
                    m = pt.rng.random(w) < 0.6
                    a[r, m] = C("flesh_deep")
                a = pt.shade_rows(a, 0, 3, "flesh_deep", 0.6)
            fill(rect, a)

    # ---------------- legs ----------------------------------------------------
    for reg, joint_top, joint_bottom in (("leg_upper_front", 3, 5), ("leg_upper_back", 3, 5),
                                         ("leg_lower_front", 4, 3), ("leg_lower_back", 4, 3)):
        f = faces(reg)
        for fname, rect in f.items():
            h, w = dims(rect)
            if fname in ("up", "down"):
                fill(rect, pt.pick([0.5], ["joint", "flesh_deep"], pt.noise(h, w, 1)))
                continue
            a = pt.flesh(h, w, pale=0.3)
            a = pt.shade_rows(a, joint_top, joint_bottom, "joint", 0.85)
            fill(rect, a)
    for reg in ("elbow",):
        f = faces(reg)
        for fname, rect in f.items():
            h, w = dims(rect)
            a = pt.flesh(h, w, pale=0.1)
            a = pt.shade_rows(pt.shade_cols(a, 1, 1, "joint", 0.6), 1, 1, "joint", 0.6)
            fill(rect, a)
    f = faces("knuckle")
    for fname, rect in f.items():
        h, w = dims(rect)
        fill(rect, pt.pick([0.4, 0.8], ["claw_dk", "joint", "flesh_deep"], pt.noise(h, w, 1)))

    # ---------------- swatches (per-face, every face of the small parts) -------
    def swatch(name):
        u, v, w, h = swatches[name]
        return pt.rect_px((u, v, u + w, v + h))

    def gradient(rect, stops):
        x0, y0, x1, y1 = rect
        h = y1 - y0
        for r in range(h):
            t = r / max(1, h - 1)
            for i in range(len(stops) - 1):
                if stops[i][0] <= t <= stops[i + 1][0]:
                    k = (t - stops[i][0]) / max(1e-6, stops[i + 1][0] - stops[i][0])
                    c = (1 - k) * C(stops[i][1]).astype(float) + k * C(stops[i + 1][1]).astype(float)
                    break
            pt.img[y0 + r, x0:x1] = c.astype(np.uint8)

    x0, y0, x1, y1 = swatch("throat")
    pt.img[y0:y1, x0:x1] = pt.pick([0.45, 0.85], ["mouth_black", "mouth_deep", "mouth_red"],
                                   pt.noise(y1 - y0, x1 - x0, 2))
    gradient(swatch("tooth"), [(0, "blood"), (0.3, "tooth_stain"), (0.7, "tooth_mid"), (1, "tooth")])
    gradient(swatch("tooth_low"), [(0, "blood"), (0.3, "tooth_stain"), (0.65, "tooth_mid"), (1, "tooth")])
    gradient(swatch("drip"), [(0, "mouth_deep"), (0.35, "blood"), (0.75, "blood_hi"), (1, "blotch_dk")])
    gradient(swatch("claw"), [(0, "claw_lt"), (0.35, "claw"), (1, "claw_dk")])
    return pt.img


# ---------------------------------------------------------------------------
# JSON writers
# ---------------------------------------------------------------------------

def dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


def client_entity():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": "pas:parasite",
                "materials": {"default": "spider", "invisible": "spider_invisible"},
                "textures": {"default": TEX_REL},
                "geometry": {"default": model.GEO_ID},
                "scripts": {
                    "pre_animation": anims.PRE_ANIMATION,
                    "animate": ["move_controller", "attack_controller", "life_controller"],
                },
                "animations": anims.ENTITY_ANIMATIONS,
                "render_controllers": ["controller.render.pas_parasite"],
                "enable_attachables": False,
                "spawn_egg": {"base_color": "#6e1610", "overlay_color": "#d6a08a"},
            }
        },
    }


def render_controllers():
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.pas_parasite": {
                "arrays": {"materials": {"Array.materials": ["Material.default", "Material.invisible"]}},
                "geometry": "Geometry.default",
                "materials": [{"*": "Array.materials[query.is_invisible]"}],
                "textures": ["Texture.default"],
            }
        },
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)
    dump(RP / "models" / "entity" / "pas_parasite.geo.json", model.geometry_json())
    img = paint(a.seed)
    out = RP / (TEX_REL + ".png")
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img, "RGBA").save(out, optimize=True)
    print("wrote", out.relative_to(ROOT), img.shape[1], "x", img.shape[0])
    dump(RP / "animations" / "pas_parasite.animation.json", anims.animation_file())
    dump(RP / "animation_controllers" / "pas_parasite.animation_controllers.json", anims.controller_file())
    dump(RP / "render_controllers" / "pas_parasite.render_controllers.json", render_controllers())
    dump(RP / "entity" / "pas_parasite.entity.json", client_entity())


if __name__ == "__main__":
    main()
