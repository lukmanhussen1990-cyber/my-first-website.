#!/usr/bin/env python3
"""Generates the six Mycelium-X entity skins AND their matching geometry files.

Both outputs are derived from ONE table (`ENTITIES` below): every bone/cube is
declared once, a deterministic shelf packer assigns each cube a UV origin, and
that same UV origin is used to (a) write `uv` into the .geo.json and (b) decide
which pixels of the PNG to paint.  The UVs therefore cannot drift apart -- if you
resize a cube, the texture regions move with it automatically.

Bedrock box-UV layout for a cube of size (w, h, d) at uv origin (u, v):

        (u+d, v)            (u+d+w, v)
            +---- top ----+---- bottom ----+          height d
    (u,v+d) +---- east ---+---- north -----+---- west ----+---- south ----+
            |     d       |       w        |      d       |       w       | height h

Run: python3 tools/gen_entity_art.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pngwrite import Canvas  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "src" / "resource_pack"
TEX_DIR = RP / "textures" / "entity" / "myc"
GEO_DIR = RP / "models" / "entity" / "myc"

GEO_FORMAT_VERSION = "1.12.0"  # per CONVENTIONS.md


# --------------------------------------------------------------- palettes ---
# Each style maps to (base, light, dark, speck, glow).
def pal(base, light, dark, speck, glow):
    return {"base": base, "light": light, "dark": dark, "speck": speck, "glow": glow}


PALETTES = {
    # rotted, grey-green human flesh under purple mycelium
    "infected_walker": {
        "flesh": pal((104, 118, 92, 255), (134, 148, 116, 255), (66, 78, 58, 255),
                     (84, 96, 74, 255), (162, 118, 210, 255)),
        "cloth": pal((72, 66, 80, 255), (96, 90, 104, 255), (44, 40, 50, 255),
                     (58, 54, 66, 255), (152, 88, 198, 255)),
        "fungal": pal((146, 90, 186, 255), (188, 140, 226, 255), (88, 48, 122, 255),
                      (120, 70, 158, 255), (214, 176, 246, 255)),
    },
    # bleached, sinew-red, stretched skin
    "infected_runner": {
        "flesh": pal((150, 132, 112, 255), (184, 166, 142, 255), (98, 84, 70, 255),
                     (168, 108, 100, 255), (232, 96, 84, 255)),
        "cloth": pal((92, 60, 58, 255), (120, 84, 78, 255), (56, 34, 34, 255),
                     (74, 46, 46, 255), (232, 96, 84, 255)),
        "fungal": pal((196, 84, 128, 255), (232, 132, 168, 255), (124, 44, 78, 255),
                      (166, 62, 104, 255), (250, 186, 208, 255)),
    },
    # bark-dark bulk with orange shelf fungus
    "fungal_brute": {
        "flesh": pal((70, 78, 60, 255), (98, 108, 84, 255), (40, 46, 34, 255),
                     (56, 64, 48, 255), (226, 140, 52, 255)),
        "cloth": pal((54, 46, 40, 255), (78, 68, 58, 255), (32, 26, 22, 255),
                     (44, 38, 32, 255), (226, 140, 52, 255)),
        "fungal": pal((198, 122, 46, 255), (238, 172, 80, 255), (124, 70, 22, 255),
                      (164, 96, 34, 255), (252, 214, 138, 255)),
    },
    # chitin shell, acid-green spore sac
    "spore_crawler": {
        "flesh": pal((48, 44, 54, 255), (76, 70, 84, 255), (26, 24, 30, 255),
                     (38, 34, 42, 255), (128, 232, 118, 255)),
        "cloth": pal((40, 36, 44, 255), (64, 58, 70, 255), (22, 20, 26, 255),
                     (32, 28, 36, 255), (128, 232, 118, 255)),
        "fungal": pal((92, 190, 96, 255), (150, 236, 140, 255), (44, 116, 54, 255),
                      (66, 150, 72, 255), (198, 252, 176, 255)),
    },
    # near-black ambusher with cold bioluminescence
    "mycelium_stalker": {
        "flesh": pal((32, 34, 40, 255), (54, 58, 68, 255), (16, 17, 21, 255),
                     (24, 26, 32, 255), (74, 214, 206, 255)),
        "cloth": pal((26, 28, 34, 255), (44, 48, 56, 255), (12, 13, 17, 255),
                     (20, 21, 26, 255), (74, 214, 206, 255)),
        "fungal": pal((44, 122, 128, 255), (86, 190, 190, 255), (22, 66, 72, 255),
                      (32, 92, 98, 255), (168, 244, 240, 255)),
    },
    # a pulsing pod: violet flesh, magenta vents
    "nest_core": {
        "flesh": pal((86, 54, 112, 255), (118, 78, 150, 255), (50, 30, 68, 255),
                     (68, 42, 90, 255), (224, 134, 206, 255)),
        "cloth": pal((58, 40, 74, 255), (84, 58, 104, 255), (34, 22, 44, 255),
                     (46, 32, 58, 255), (224, 134, 206, 255)),
        "fungal": pal((160, 74, 176, 255), (206, 122, 220, 255), (98, 40, 112, 255),
                      (128, 54, 142, 255), (250, 194, 244, 255)),
    },
}


# ------------------------------------------------------------ model table ---
def cube(origin, size, style, detail=None):
    return {"origin": list(origin), "size": list(size), "style": style, "detail": detail}


def bone(name, pivot, cubes, parent=None):
    b = {"name": name, "pivot": list(pivot), "cubes": cubes}
    if parent:
        b["parent"] = parent
    return b


ENTITIES: dict[str, dict] = {
    # ---- baseline shambler: hunched, one swollen arm, mushroom cap skull ----
    "infected_walker": {
        "tex": (64, 64),
        "bounds": (1.4, 2.4, [0, 1.2, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("body", [0, 24, 0], [cube([-4, 12, -2], [8, 12, 4], "cloth")], "root"),
            bone("head", [0, 24, 0], [cube([-4, 24, -4], [8, 8, 8], "flesh", "eyes")], "body"),
            bone("cap", [0, 31, 0], [cube([-5, 30, -5], [10, 3, 10], "fungal", "gills")], "head"),
            bone("growth", [-5, 22, 0],
                 [cube([-7, 19, -3], [3, 6, 3], "fungal", "spots")], "body"),
            bone("rightArm", [-4, 22, 0], [cube([-8, 12, -2], [4, 10, 4], "flesh")], "body"),
            bone("leftArm", [4, 22, 0], [cube([4, 12, -2], [4, 10, 4], "flesh")], "body"),
            bone("rightLeg", [-2, 12, 0], [cube([-4, 0, -2], [4, 12, 4], "cloth")], "root"),
            bone("leftLeg", [2, 12, 0], [cube([0, 0, -2], [4, 12, 4], "cloth")], "root"),
        ],
    },
    # ---- sprinter: narrow chest, snouted skull with crest, very long legs ----
    "infected_runner": {
        "tex": (64, 64),
        "bounds": (1.2, 2.3, [0, 1.15, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("body", [0, 24, 0], [cube([-3, 14, -2], [6, 10, 4], "flesh", "ribs")], "root"),
            bone("head", [0, 24, 0], [cube([-3, 24, -5], [6, 6, 7], "flesh", "eyes")], "body"),
            bone("crest", [0, 30, 0], [cube([-1, 29, -4], [2, 4, 6], "fungal", "spots")], "head"),
            bone("rightArm", [-3, 23, 0], [cube([-6, 11, -2], [3, 12, 3], "flesh")], "body"),
            bone("leftArm", [3, 23, 0], [cube([3, 11, -2], [3, 12, 3], "flesh")], "body"),
            bone("rightLeg", [-2, 14, 0], [cube([-4, 0, -2], [3, 14, 3], "cloth")], "root"),
            bone("leftLeg", [2, 14, 0], [cube([1, 0, -2], [3, 14, 3], "cloth")], "root"),
        ],
    },
    # ---- brute: slab torso, sunken head, shelf fungus growing off the back ----
    "fungal_brute": {
        "tex": (128, 128),
        "bounds": (2.6, 3.6, [0, 1.8, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("body", [0, 28, 0], [cube([-8, 14, -5], [16, 16, 10], "flesh", "ribs")], "root"),
            bone("head", [0, 28, 0], [cube([-5, 27, -6], [10, 7, 9], "flesh", "eyes")], "body"),
            bone("capUpper", [-1, 27, 5],
                 [cube([-10, 25, 4], [9, 3, 7], "fungal", "gills")], "body"),
            bone("capLower", [1, 21, 5],
                 [cube([1, 19, 4], [9, 3, 7], "fungal", "gills")], "body"),
            bone("rightArm", [-8, 28, 0], [cube([-15, 9, -4], [7, 19, 8], "flesh")], "body"),
            bone("leftArm", [8, 28, 0], [cube([8, 9, -4], [7, 19, 8], "flesh")], "body"),
            bone("rightLeg", [-4, 14, 0], [cube([-8, 0, -4], [7, 14, 8], "cloth")], "root"),
            bone("leftLeg", [4, 14, 0], [cube([1, 0, -4], [7, 14, 8], "cloth")], "root"),
        ],
    },
    # ---- crawler: low chitin body, bulging spore sac, four splayed legs ----
    "spore_crawler": {
        "tex": (32, 32),
        "bounds": (0.9, 0.9, [0, 0.45, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("body", [0, 4, 0], [cube([-3, 2, -4], [6, 4, 8], "flesh", "ribs")], "root"),
            bone("sac", [0, 6, 2], [cube([-2, 6, 0], [4, 4, 4], "fungal", "spots")], "body"),
            bone("head", [0, 4, -4], [cube([-2, 2, -7], [4, 3, 3], "flesh", "eyes")], "body"),
            bone("legFrontRight", [-3, 2, -3], [cube([-5, 0, -4], [1, 3, 1], "cloth")], "body"),
            bone("legFrontLeft", [3, 2, -3], [cube([4, 0, -4], [1, 3, 1], "cloth")], "body"),
            bone("legBackRight", [-3, 2, 3], [cube([-5, 0, 3], [1, 3, 1], "cloth")], "body"),
            bone("legBackLeft", [3, 2, 3], [cube([4, 0, 3], [1, 3, 1], "cloth")], "body"),
        ],
    },
    # ---- stalker: tall, faceless, spindly, tipped with a glowing spore bulb ----
    "mycelium_stalker": {
        "tex": (64, 64),
        "bounds": (1.4, 3.2, [0, 1.6, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("body", [0, 30, 0], [cube([-3, 16, -2], [6, 14, 4], "flesh", "ribs")], "root"),
            bone("head", [0, 30, 0], [cube([-3, 30, -3], [6, 6, 6], "flesh", "blank")], "body"),
            bone("antenna", [0, 36, 0], [
                cube([-1, 36, -1], [2, 8, 2], "fungal"),
                cube([-2, 43, -2], [4, 4, 4], "fungal", "spots"),
            ], "head"),
            bone("rightArm", [-3, 29, 0], [cube([-5, 11, -2], [3, 18, 3], "flesh")], "body"),
            bone("leftArm", [3, 29, 0], [cube([2, 11, -2], [3, 18, 3], "flesh")], "body"),
            bone("rightLeg", [-2, 16, 0], [cube([-4, 0, -2], [3, 16, 3], "cloth")], "root"),
            bone("leftLeg", [2, 16, 0], [cube([1, 0, -2], [3, 16, 3], "cloth")], "root"),
        ],
    },
    # ---- nest core: a squat pod on a mycelial base, vented crown on top ----
    "nest_core": {
        "tex": (32, 32),
        "bounds": (1.2, 1.4, [0, 0.7, 0]),
        "bones": [
            bone("root", [0, 0, 0], []),
            bone("base", [0, 0, 0], [cube([-4, 0, -4], [8, 3, 8], "cloth", "spots")], "root"),
            bone("pod", [0, 3, 0], [cube([-3, 3, -3], [6, 8, 6], "flesh", "ribs")], "base"),
            bone("crown", [0, 11, 0], [cube([-2, 11, -2], [4, 3, 4], "fungal", "gills")], "pod"),
            bone("vent", [0, 14, 0], [cube([-1, 14, -1], [2, 4, 2], "fungal", "spots")], "crown"),
        ],
    },
}


# ------------------------------------------------------------- UV packing ---
def box_uv_extent(size):
    """Pixel footprint (w, h) that a box of (w, h, d) occupies in the atlas."""
    w, h, d = size
    return 2 * (d + w), d + h


def pack_uvs(ent_name: str, ent: dict) -> None:
    """Assign a `uv` to every cube with a deterministic shelf packer."""
    tex_w, tex_h = ent["tex"]
    boxes = []
    for bi, b in enumerate(ent["bones"]):
        for ci, cb in enumerate(b["cubes"]):
            bw, bh = box_uv_extent(cb["size"])
            if bw > tex_w:
                raise ValueError(
                    f"{ent_name}/{b['name']}: cube {cb['size']} needs {bw}px of atlas "
                    f"width but the texture is only {tex_w}px wide"
                )
            boxes.append((bi, ci, bw, bh))

    # Tallest-first shelf packing. The sort key ends in the declaration index so
    # the result is fully deterministic for a given table.
    order = sorted(range(len(boxes)), key=lambda i: (-boxes[i][3], -boxes[i][2], i))

    shelf_y = 0
    shelf_h = 0
    pen_x = 0
    for i in order:
        bi, ci, bw, bh = boxes[i]
        if pen_x + bw > tex_w:
            shelf_y += shelf_h
            shelf_h = 0
            pen_x = 0
        if shelf_h == 0:
            shelf_h = bh
        if shelf_y + bh > tex_h:
            raise ValueError(f"{ent_name}: cubes do not fit in a {tex_w}x{tex_h} texture")
        ENTITIES[ent_name]["bones"][bi]["cubes"][ci]["uv"] = [pen_x, shelf_y]
        pen_x += bw


# --------------------------------------------------------------- painting ---
def faces(uv, size):
    """Return {face: (x, y, w, h)} for a cube -- the single source of truth."""
    u, v = uv
    w, h, d = size
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + d + w + d, v + d, w, h),
    }


def paint_face(c: Canvas, rect, p, seed: int, top: bool) -> None:
    x, y, w, h = rect
    if w <= 0 or h <= 0:
        return
    base, light, dark, speck = p["base"], p["light"], p["dark"], p["speck"]
    # Weighted speckle: mostly base, occasional lighter/darker grain.
    c.noise(x, y, w, h, [base, base, base, base, base, speck, light, dark], seed)
    if w >= 2 and h >= 2:
        c.shade_edges(x, y, w, h, light if not top else p["light"], dark)


def detail_eyes(c: Canvas, rect, p) -> None:
    x, y, w, h = rect
    if w < 3 or h < 3:
        return
    ey = y + max(1, h // 3)
    lx, rx = x + max(1, w // 4), x + w - 1 - max(1, w // 4)
    for px in (lx, rx):
        c.set(px, ey, p["glow"])
        if h >= 5:
            c.set(px, ey + 1, p["dark"])
    # slack jaw
    if h >= 6:
        c.line(x + 1, y + h - 2, x + w - 2, y + h - 2, p["dark"])


def detail_blank(c: Canvas, rect, p) -> None:
    """No eyes -- a smooth fungal mask with a single seam."""
    x, y, w, h = rect
    if w < 3 or h < 3:
        return
    c.line(x + w // 2, y + 1, x + w // 2, y + h - 2, p["dark"])
    c.set(x + w // 2, y + h // 2, p["glow"])


def detail_gills(c: Canvas, rect, p) -> None:
    """Radial gill lines, used on the underside of caps."""
    x, y, w, h = rect
    cx, cy = x + w // 2, y + h // 2
    for i in range(w):
        if i % 2 == 0:
            c.line(cx, cy, x + i, y, p["dark"])
            c.line(cx, cy, x + i, y + h - 1, p["dark"])
    for i in range(h):
        if i % 2 == 0:
            c.line(cx, cy, x, y + i, p["dark"])
            c.line(cx, cy, x + w - 1, y + i, p["dark"])
    c.set(cx, cy, p["glow"])


def detail_spots(c: Canvas, rect, p) -> None:
    """Glowing pustules on a 3-pixel lattice."""
    x, y, w, h = rect
    for yy in range(y + 1, y + h - 1, 3):
        for xx in range(x + 1, x + w - 1, 3):
            c.set(xx, yy, p["glow"])
            c.set(xx + 1, yy, p["light"])


def detail_ribs(c: Canvas, rect, p) -> None:
    """Horizontal rib banding down a torso."""
    x, y, w, h = rect
    for i, yy in enumerate(range(y + 1, y + h - 1, 3)):
        c.line(x + 1, yy, x + w - 2, yy, p["dark"])
        if i % 2 == 0 and w >= 4:
            c.set(x + w // 2, yy, p["glow"])


DETAILS = {
    "eyes": detail_eyes,
    "blank": detail_blank,
    "gills": detail_gills,
    "spots": detail_spots,
    "ribs": detail_ribs,
}

# Which face each detail is stamped on.
DETAIL_FACE = {
    "eyes": "north",
    "blank": "north",
    "gills": "down",
    "spots": "up",
    "ribs": "north",
}


def paint_entity(name: str, ent: dict) -> Canvas:
    tex_w, tex_h = ent["tex"]
    c = Canvas(tex_w, tex_h)
    palette = PALETTES[name]
    seed = sum(ord(ch) for ch in name) * 7919
    for b in ent["bones"]:
        for cb in b["cubes"]:
            p = palette[cb["style"]]
            fs = faces(cb["uv"], cb["size"])
            for fname, rect in fs.items():
                seed = (seed * 1103515245 + 12345) & 0xFFFFFFFF
                paint_face(c, rect, p, seed, fname == "up")
            det = cb.get("detail")
            if det:
                DETAILS[det](c, fs[DETAIL_FACE[det]], p)
    return c


# ------------------------------------------------------------- geo output ---
def geometry_json(name: str, ent: dict) -> dict:
    tex_w, tex_h = ent["tex"]
    bw, bh, boff = ent["bounds"]
    bones = []
    for b in ent["bones"]:
        entry = {"name": b["name"], "pivot": b["pivot"]}
        if "parent" in b:
            entry["parent"] = b["parent"]
        if b["cubes"]:
            entry["cubes"] = [
                {"origin": cb["origin"], "size": cb["size"], "uv": cb["uv"]}
                for cb in b["cubes"]
            ]
        bones.append(entry)
    return {
        "format_version": GEO_FORMAT_VERSION,
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": f"geometry.myc.{name}",
                    "texture_width": tex_w,
                    "texture_height": tex_h,
                    "visible_bounds_width": bw,
                    "visible_bounds_height": bh,
                    "visible_bounds_offset": boff,
                },
                "bones": bones,
            }
        ],
    }


def main() -> None:
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    GEO_DIR.mkdir(parents=True, exist_ok=True)
    for name, ent in ENTITIES.items():
        pack_uvs(name, ent)
        paint_entity(name, ent).save(TEX_DIR / f"{name}.png")
        (GEO_DIR / f"{name}.geo.json").write_text(
            json.dumps(geometry_json(name, ent), indent=2) + "\n"
        )
        used = sum(
            box_uv_extent(cb["size"])[0] * box_uv_extent(cb["size"])[1]
            for b in ent["bones"]
            for cb in b["cubes"]
        )
        tw, th = ent["tex"]
        print(f"  {name:18s} {tw}x{th}  {len(ent['bones'])} bones  "
              f"atlas {100 * used // (tw * th)}% used")
    print(f"wrote {len(ENTITIES)} skins -> {TEX_DIR}")
    print(f"wrote {len(ENTITIES)} models -> {GEO_DIR}")


if __name__ == "__main__":
    main()
