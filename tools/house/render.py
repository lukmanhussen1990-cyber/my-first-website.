"""Preview renderer for the Luxury Base: top-down plans + isometric voxel views.

Pure PIL, no game assets.  Colours are hand-tuned approximations of the vanilla
textures (averaged once from the reference pack; only the RGB triples live here).
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import blocks as B

# --------------------------------------------------------------------- colours
COL = {
    "quartz_block": (236, 231, 224), "quartz_bricks": (232, 227, 219), "quartz_stairs": (236, 231, 224),
    "smooth_quartz_stairs": (240, 236, 229), "quartz_slab": (236, 231, 224), "stone_block_slab4": (240, 236, 229),
    "dark_oak_planks": (66, 43, 20), "dark_oak_log": (60, 46, 26), "stripped_dark_oak_log": (84, 62, 38),
    "stripped_dark_oak_wood": (84, 62, 38), "dark_oak_stairs": (72, 47, 22), "dark_oak_slab": (72, 47, 22),
    "dark_oak_fence": (66, 43, 20), "dark_oak_trapdoor": (88, 58, 28), "dark_oak_door": (78, 52, 25),
    "glass": (175, 213, 225), "glass_pane": (165, 205, 222), "sea_lantern": (190, 228, 220),
    "glowstone": (230, 190, 110), "bookshelf": (125, 92, 55), "crafting_table": (140, 108, 70),
    "smithing_table": (58, 40, 42), "enchanting_table": (150, 40, 60), "anvil": (70, 70, 72),
    "loom": (160, 125, 85), "stonecutter_block": (120, 110, 100), "furnace": (95, 95, 95),
    "smoker": (90, 78, 60), "blast_furnace": (110, 110, 115), "barrel": (120, 88, 52), "chest": (160, 115, 45),
    "cauldron": (70, 70, 74), "lantern": (255, 200, 90), "flower_pot": (140, 75, 55), "bed": (200, 200, 205),
    "light_gray_carpet": (155, 155, 150), "white_carpet": (235, 237, 237), "gray_carpet": (70, 76, 80),
    "black_carpet": (25, 25, 30), "azalea_leaves": (82, 112, 42), "azalea_leaves_flowered": (110, 112, 70),
    "moss_block": (89, 109, 45), "azalea": (95, 130, 50), "flowering_azalea": (120, 120, 80),
    "fern": (80, 125, 50), "white_tulip": (220, 230, 220), "lily_of_the_valley": (210, 225, 210),
    "torch": (255, 210, 80),
}
DYE_RGB = {0: (235, 237, 237), 7: (70, 76, 80), 8: (158, 158, 152), 15: (30, 30, 34)}
QUARTZ_KIND = {"smooth": (240, 236, 229), "default": (232, 226, 218), "lines": (226, 220, 210), "chiseled": (220, 214, 204)}

FULL = (0, 0, 0, 1, 1, 1)


def colour(block: B.Block, entity=None):
    s = block.short
    if s == "quartz_block":
        return QUARTZ_KIND[block.state("chisel_type")]
    if s == "bed" and entity is not None:
        return DYE_RGB.get(entity["color"].value, (200, 200, 200))
    return COL.get(s, (255, 0, 255))


def is_full(block):
    if block is None:
        return False
    s = block.short
    if s in ("air", "glass_pane", "dark_oak_fence", "lantern", "flower_pot", "bed", "chest", "enchanting_table",
             "anvil", "stonecutter_block", "cauldron", "dark_oak_door", "dark_oak_trapdoor", "torch",
             "azalea", "flowering_azalea", "fern", "white_tulip", "lily_of_the_valley") or s.endswith("carpet") \
            or s.endswith("stairs") or s.endswith("slab") or s == "stone_block_slab4":
        return False
    return True


def connects(block):
    return block is not None and (is_full(block) or block.short in ("glass_pane", "dark_oak_fence"))


def boxes(block: B.Block, nb):
    """List of (box, colour_override|None) in cell-local coordinates."""
    s = block.short
    st = block.as_dict()
    if s.endswith("carpet"):
        return [((0, 0, 0, 1, 1 / 16, 1), None)]
    if s in ("stone_block_slab4",) or s.endswith("slab"):
        top = st["minecraft:vertical_half"] == "top"
        return [((0, 0.5, 0, 1, 1, 1) if top else (0, 0, 0, 1, 0.5, 1), None)]
    if s.endswith("stairs"):
        inv = {v: k for k, v in B.WEIRDO_DIRECTION.items()}
        up = inv[st["weirdo_direction"]]
        ud = st["upside_down_bit"]
        half = (0, 0.5, 0, 1, 1, 1) if ud else (0, 0, 0, 1, 0.5, 1)
        y0, y1 = (0, 0.5) if ud else (0.5, 1)
        step = {"north": (0, y0, 0, 1, y1, 0.5), "south": (0, y0, 0.5, 1, y1, 1),
                "west": (0, y0, 0, 0.5, y1, 1), "east": (0.5, y0, 0, 1, y1, 1)}[up]
        return [(half, None), (step, None)]
    if s == "glass_pane" or s == "dark_oak_fence":
        t0, t1 = (7 / 16, 9 / 16) if s == "glass_pane" else (6 / 16, 10 / 16)
        out = [((t0, 0, t0, t1, 1, t1), None)]
        hi = 1 if s == "glass_pane" else 15 / 16
        lo = 0 if s == "glass_pane" else 6 / 16
        if connects(nb(-1, 0, 0)):
            out.append(((0, lo, t0, t0, hi, t1), None))
        if connects(nb(1, 0, 0)):
            out.append(((t1, lo, t0, 1, hi, t1), None))
        if connects(nb(0, 0, -1)):
            out.append(((t0, lo, 0, t1, hi, t0), None))
        if connects(nb(0, 0, 1)):
            out.append(((t0, lo, t1, t1, hi, 1), None))
        return out
    if s == "dark_oak_door":
        inv = {v: k for k, v in B.DOOR_DIRECTION.items()}
        facing = inv[st["direction"]]
        side = B.OPPOSITE[facing]
        return [(panel(side, 3 / 16), None)]
    if s == "dark_oak_trapdoor":
        inv = {v: k for k, v in B.TRAPDOOR_DIRECTION.items()}
        facing = inv[st["direction"]]
        if st["open_bit"]:
            return [(panel(B.OPPOSITE[facing], 3 / 16), None)]
        return [((0, 13 / 16, 0, 1, 1, 1) if st["upside_down_bit"] else (0, 0, 0, 1, 3 / 16, 1), None)]
    if s == "lantern":
        if st["hanging"]:
            return [((5 / 16, 1 / 16, 5 / 16, 11 / 16, 9 / 16, 11 / 16), None), ((7 / 16, 9 / 16, 7 / 16, 9 / 16, 1, 9 / 16), (60, 60, 60))]
        return [((5 / 16, 0, 5 / 16, 11 / 16, 9 / 16, 11 / 16), None)]
    if s == "flower_pot":
        return [((5 / 16, 0, 5 / 16, 11 / 16, 6 / 16, 11 / 16), None)]
    if s == "bed":
        return [((0, 0, 0, 1, 9 / 16, 1), None)]
    if s == "chest":
        return [((1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16), None)]
    if s == "enchanting_table":
        return [((0, 0, 0, 1, 12 / 16, 1), None)]
    if s == "stonecutter_block":
        return [((0, 0, 0, 1, 9 / 16, 1), None)]
    if s == "anvil":
        return [((2 / 16, 0, 2 / 16, 14 / 16, 4 / 16, 14 / 16), None), ((4 / 16, 4 / 16, 3 / 16, 12 / 16, 1, 13 / 16), None)]
    if s == "cauldron":
        return [((0, 0, 0, 1, 1, 1), None)]
    if s in ("azalea", "flowering_azalea"):
        return [((1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16), None)]
    if s in ("fern", "white_tulip", "lily_of_the_valley", "torch"):
        return [((5 / 16, 0, 5 / 16, 11 / 16, 12 / 16, 11 / 16), None)]
    return [(FULL, None)]


def panel(side, t):
    return {"north": (0, 0, 0, 1, 1, t), "south": (0, 0, 1 - t, 1, 1, 1),
            "west": (0, 0, 0, t, 1, 1), "east": (1 - t, 0, 0, 1, 1, 1)}[side]


# --------------------------------------------------------------------- iso view
def _shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def iso(canvas, X, Y, Z, out: Path, back=False, scale=30, title=""):
    cos30, sin30 = math.cos(math.pi / 6), 0.5

    def tr(x, z):  # rotate the model 180 degrees for the back view
        return (X - x, Z - z) if back else (x, z)

    W = int((X + Z) * cos30 * scale) + 80
    H = int(((X + Z) * sin30 + Y) * scale) + 120
    ox = Z * cos30 * scale + 40
    oy = Y * scale + 70

    def proj(px, py, pz):
        return (ox + (px - pz) * cos30 * scale, oy + (px + pz) * sin30 * scale - py * scale)

    img = Image.new("RGBA", (W, H), (226, 236, 244, 255))
    draw = ImageDraw.Draw(img)
    # ground plane
    g = [proj(-3, 0, -3), proj(X + 3, 0, -3), proj(X + 3, 0, Z + 3), proj(-3, 0, Z + 3)]
    draw.polygon(g, fill=(122, 160, 92, 255))

    items = []
    cells = canvas.cells
    for (x, y, z), blk in cells.items():
        if blk.short == "air":
            continue

        def nb(dx, dy, dz, x=x, y=y, z=z):
            return cells.get((x + dx, y + dy, z + dz))
        ent = canvas.entities.get((x, y, z))
        base = colour(blk, ent)
        for (bx0, by0, bz0, bx1, by1, bz1), override in boxes(blk, nb):
            col = override or base
            # transform the box into view space
            if back:
                vx0, vx1 = X - (x + bx1), X - (x + bx0)
                vz0, vz1 = Z - (z + bz1), Z - (z + bz0)
            else:
                vx0, vx1 = x + bx0, x + bx1
                vz0, vz1 = z + bz0, z + bz1
            vy0, vy1 = y + by0, y + by1
            # visible faces: top, +z, +x in view space. cull against full neighbours
            full = (bx0, by0, bz0, bx1, by1, bz1) == FULL
            sdx, sdz = (-1, -1) if back else (1, 1)
            faces = []
            if not (full and is_full(nb(0, 1, 0)) and by1 == 1):
                faces.append(("top", [(vx0, vy1, vz0), (vx1, vy1, vz0), (vx1, vy1, vz1), (vx0, vy1, vz1)]))
            if not (full and is_full(nb(0, 0, sdz))):
                faces.append(("front", [(vx0, vy0, vz1), (vx1, vy0, vz1), (vx1, vy1, vz1), (vx0, vy1, vz1)]))
            if not (full and is_full(nb(sdx, 0, 0))):
                faces.append(("side", [(vx1, vy0, vz0), (vx1, vy0, vz1), (vx1, vy1, vz1), (vx1, vy1, vz0)]))
            key = (vx0 + vz0 + vy0 + (vx1 + vz1 + vy1)) / 2
            items.append((key, vx0 + vz0, vy0, faces, col, blk.short))
    items.sort(key=lambda t: (t[0], t[2]))
    for key, _, _, faces, col, name in items:
        glass = name in ("glass", "glass_pane")
        glow = name in ("sea_lantern", "glowstone", "lantern")
        for kind, pts in faces:
            f = {"top": 1.0, "front": 0.82, "side": 0.66}[kind]
            if glow:
                f = min(1.0, f + 0.2)
            c = _shade(col, f)
            poly = [proj(*p) for p in pts]
            if glass:
                _blend_poly(img, poly, c + (120,))
                ImageDraw.Draw(img).line(poly + [poly[0]], fill=_shade(col, 0.6) + (160,), width=1)
            else:
                draw.polygon(poly, fill=c + (255,), outline=_shade(c, 0.85) + (255,))
    draw = ImageDraw.Draw(img)
    font = _font(18)
    draw.text((16, 12), title, fill=(30, 30, 40, 255), font=font)
    img.convert("RGB").save(out)


def _blend_poly(img, poly, rgba):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)) + 2, int(max(ys)) + 2
    if x1 <= x0 or y1 <= y0:
        return
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon([(px - x0, py - y0) for px, py in poly], fill=rgba)
    img.alpha_composite(layer, (x0, y0))


def _font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


# --------------------------------------------------------------------- plans
NICE = {"stone_block_slab4": "smooth quartz slab", "stonecutter_block": "stonecutter",
        "flowering_azalea": "azalea (flowering)"}

LABEL = {
    "bed": "Bd", "chest": "Ch", "barrel": "Ba", "crafting_table": "Cr", "furnace": "Fu", "blast_furnace": "BF",
    "smoker": "Sm", "stonecutter_block": "St", "anvil": "An", "loom": "Lo", "smithing_table": "Sw",
    "enchanting_table": "En", "bookshelf": "Bk", "cauldron": "Ca", "lantern": "L", "flower_pot": "P",
    "dark_oak_door": "D", "dark_oak_trapdoor": "T", "sea_lantern": "*", "glowstone": "*",
}


def plan(canvas, X, Y, Z, level, out: Path, title: str, roof=False, scale=34):
    legend: dict[str, tuple] = {}
    pad_l, pad_t = 40, 60
    W = pad_l + X * scale + 330
    H = pad_t + Z * scale + 60
    img = Image.new("RGB", (W, H), (250, 250, 247))
    draw = ImageDraw.Draw(img)
    font = _font(13)
    big = _font(20)
    draw.text((pad_l, 16), title, fill=(25, 25, 35), font=big)
    for x in range(X):
        for z in range(Z):
            px, pz = pad_l + x * scale, pad_t + z * scale
            blk, ent, under = None, None, None
            if roof:
                for y in range(Y - 1, -1, -1):
                    b = canvas.cells.get((x, y, z))
                    if b is not None and b.short != "air":
                        blk, ent = b, canvas.entities.get((x, y, z))
                        break
            else:
                for y in (level, level + 1):
                    b = canvas.cells.get((x, y, z))
                    if b is not None and b.short != "air":
                        blk, ent = b, canvas.entities.get((x, y, z))
                        break
                under = canvas.cells.get((x, level - 1, z))
                if blk is None and under is not None and under.short != "air":
                    blk, ent = under, canvas.entities.get((x, level - 1, z))
                    under = "floor"
            if blk is None:
                draw.rectangle([px, pz, px + scale - 1, pz + scale - 1], fill=(206, 222, 196) if not roof else (122, 160, 92))
                continue
            col = colour(blk, ent)
            full_wall = (not roof and under != "floor" and is_full(blk) and blk.short not in LABEL
                         and blk.short not in ("glass", "moss_block"))
            if under == "floor":
                col = tuple(int(v * 0.85 + 255 * 0.15) for v in col)
            draw.rectangle([px, pz, px + scale - 1, pz + scale - 1], fill=col, outline=(200, 200, 195))
            name = blk.short
            label = LABEL.get(name)
            nice = NICE.get(name, name.replace("_", " "))
            if name == "quartz_block":
                nice = "quartz block (" + blk.state("chisel_type") + ")"
            legend.setdefault(nice, col)
            if label and under != "floor":
                lum = sum(col) / 3
                draw.text((px + 4, pz + 9), label, fill=(0, 0, 0) if lum > 110 else (255, 255, 255), font=font)
            if full_wall:
                draw.rectangle([px + 1, pz + 1, px + scale - 2, pz + scale - 2], outline=(70, 70, 70), width=2)
            if name.endswith("stairs") and under != "floor" and not blk.state("upside_down_bit"):
                inv = {v: k for k, v in B.WEIRDO_DIRECTION.items()}
                up = inv[blk.state("weirdo_direction")]
                cx, cz = px + scale / 2, pz + scale / 2
                dx, dz = B.OFFSET[up]
                draw.line([cx - dx * scale * .3, cz - dz * scale * .3, cx + dx * scale * .3, cz + dz * scale * .3],
                          fill=(200, 30, 30), width=3)
                draw.ellipse([cx + dx * scale * .3 - 3, cz + dz * scale * .3 - 3, cx + dx * scale * .3 + 3, cz + dz * scale * .3 + 3], fill=(200, 30, 30))
    # ceiling lights (hanging lanterns / flush sea lanterns above the walking level)
    if not roof:
        for (x, y, z), b in canvas.cells.items():
            if level + 2 <= y <= level + 4 and b.short in ("lantern", "sea_lantern", "glowstone"):
                px, pz = pad_l + x * scale, pad_t + z * scale
                draw.ellipse([px + scale - 13, pz + 3, px + scale - 4, pz + 12], fill=(255, 205, 60),
                             outline=(120, 90, 0))
        draw.ellipse([pad_l, H - 38, pad_l + 9, H - 29], fill=(255, 205, 60), outline=(120, 90, 0))
        draw.text((pad_l + 14, H - 41), "= ceiling light above (hanging lantern / sea lantern)",
                  fill=(60, 60, 60), font=font)
    # room labels
    try:
        from blueprint import ROOMS
    except ImportError:
        ROOMS = []
    if not roof:
        lab = _font(12)
        for (label, ly_, x0, z0, x1, z1) in ROOMS:
            if ly_ != level:
                continue
            cx = pad_l + (x0 + x1 + 1) / 2 * scale
            cz = pad_t + (z0 + z1 + 1) / 2 * scale
            tw = draw.textlength(label, font=lab)
            draw.rectangle([cx - tw / 2 - 3, cz - 8, cx + tw / 2 + 3, cz + 8], fill=(255, 255, 255))
            draw.text((cx - tw / 2, cz - 7), label, fill=(20, 60, 140), font=lab)
    # axes + compass
    for x in range(X):
        draw.text((pad_l + x * scale + scale / 3, pad_t - 16), str(x), fill=(90, 90, 90), font=font)
    for z in range(Z):
        draw.text((8, pad_t + z * scale + scale / 3), str(z), fill=(90, 90, 90), font=font)
    draw.text((pad_l + X * scale - 140, H - 40), "N ↑   S ↓ (entrance)", fill=(60, 60, 60), font=font)
    # legend
    lx, ly = pad_l + X * scale + 20, pad_t
    draw.text((lx, ly - 22), "Legend", fill=(25, 25, 35), font=_font(15))
    for i, (name, col) in enumerate(sorted(legend.items())):
        yy = ly + i * 19
        if yy > H - 30:
            break
        draw.rectangle([lx, yy, lx + 14, yy + 14], fill=col, outline=(80, 80, 80))
        draw.text((lx + 20, yy), name, fill=(30, 30, 30), font=font)
    img.save(out)


def render_all(canvas, outdir: Path):
    from blueprint import X, Y, Z
    outdir.mkdir(parents=True, exist_ok=True)
    plan(canvas, X, Y, Z, 1, outdir / "house_floor1.png", "Luxury Base — ground floor (feet y=1)  red arrow = stairs up")
    plan(canvas, X, Y, Z, 6, outdir / "house_floor2.png", "Luxury Base — upper floor (feet y=6)")
    plan(canvas, X, Y, Z, 0, outdir / "house_roof.png", "Luxury Base — roof (top view)", roof=True)
    iso(canvas, X, Y, Z, outdir / "house_iso_front.png", back=False, title="Luxury Base — front (south-east)")
    iso(canvas, X, Y, Z, outdir / "house_iso_back.png", back=True, title="Luxury Base — back (north-west)")
    print(f"wrote previews to {outdir}")
