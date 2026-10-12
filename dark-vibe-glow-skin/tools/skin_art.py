"""Pixel art for the "Dark Vibe Glow" Minecraft skin (64x64, classic wide arms).

Every face is drawn as seen from outside the model, standing upright. On the
front of the body the left column is the character's right side. On a side
face the front of the character is the edge next to the front face.

Letters map to colours in PALETTE / NOISE. Digits are glow colours:

* On an outer layer (hat, jacket, sleeves, pants) a digit is written almost
  fully transparent (alpha from GLOW). Vanilla Minecraft hides these pixels,
  and the Dark Vibe Glow FX resource pack draws them at full brightness. This
  is the same trick Minecraft uses for spider and enderman eyes.
* On the base layer the same digit is written opaque, so the skin still looks
  right without the resource pack (and for other players).
"""
from PIL import Image

SIZE = 64

PALETTE = {
    "d": (31, 32, 42),      # fabric fold highlight
    "g": (44, 46, 58),      # dark grey (seams, rib knit)
    "G": (72, 75, 90),      # mid grey
    "s": (140, 146, 165),   # silver (eyelets, aglets, buckles)
    "S": (196, 200, 214),   # light silver
    "W": (236, 238, 246),   # white
    "w": (196, 200, 214),   # white, shaded
    "h": (30, 33, 48),      # hair highlight
    "j": (36, 49, 92),      # hair blue sheen
    "P": (240, 211, 196),   # skin
    "p": (214, 178, 162),   # skin, shaded
    "o": (30, 31, 41),      # hood rim
    "m": (28, 29, 38),      # mask top edge
    "N": (10, 18, 60),      # navy (eye lashes)
}

# Characters filled with a subtle fabric / hair texture (main, darker, lighter).
NOISE = {
    "k": [(18, 18, 25), (13, 13, 19), (24, 24, 33)],   # hoodie / pants fabric
    "H": [(15, 15, 22), (10, 10, 15), (24, 26, 38)],   # hair
    "O": [(21, 22, 30), (16, 16, 23), (28, 29, 39)],   # hood
    "M": [(16, 16, 22), (12, 12, 17), (21, 21, 29)],   # face mask
}

# digit -> (rgb, alpha used on outer layers). Lower alpha = stronger glow.
# Every value stays below 128 so vanilla rendering hides it (alpha test 0.5).
GLOW = {
    "1": ((22, 46, 150), 12),     # deep blue
    "2": ((33, 92, 232), 12),     # blue
    "3": ((62, 140, 255), 12),    # bright blue
    "4": ((128, 198, 255), 12),   # light blue
    "5": ((200, 236, 255), 12),   # ice white
    "6": ((240, 250, 255), 12),   # white-hot core
    "7": ((236, 238, 246), 96),   # soft white glow (arm X glyphs)
}


def _noise_pick(ch, x, y):
    h = (x * 73856093) ^ (y * 19349663) ^ (ord(ch) * 83492791)
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    r = (h >> 8) % 100
    shades = NOISE[ch]
    if r < 16:
        return shades[1]
    if r > 85:
        return shades[2]
    return shades[0]


def color_of(ch, x, y, outer):
    """RGBA for one art character at texture pixel (x, y)."""
    if ch == ".":
        return (0, 0, 0, 0)
    if ch in GLOW:
        rgb, alpha = GLOW[ch]
        return rgb + ((alpha if outer else 255),)
    if ch in NOISE:
        return _noise_pick(ch, x, y) + (255,)
    return PALETTE[ch] + (255,)


# ---------------------------------------------------------------- layout --

def box_regions(u, v, w, h, d):
    """Texture rectangles (x, y, width, height) of a Minecraft box UV."""
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h),
        "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h),
        "back": (u + d + w + d, v + d, w, h),
    }


PARTS = {
    # name: (u, v, w, h, d, is_outer_layer)
    "head": (0, 0, 8, 8, 8, False),
    "hat": (32, 0, 8, 8, 8, True),
    "body": (16, 16, 8, 12, 4, False),
    "jacket": (16, 32, 8, 12, 4, True),
    "right_arm": (40, 16, 4, 12, 4, False),
    "right_sleeve": (40, 32, 4, 12, 4, True),
    "left_arm": (32, 48, 4, 12, 4, False),
    "left_sleeve": (48, 48, 4, 12, 4, True),
    "right_leg": (0, 16, 4, 12, 4, False),
    "right_pants": (0, 32, 4, 12, 4, True),
    "left_leg": (16, 48, 4, 12, 4, False),
    "left_pants": (0, 48, 4, 12, 4, True),
}


def flip(rows):
    return [r[::-1] for r in rows]


def limb_faces(strip, top, bottom, left_side):
    """Split a 16-wide wrap strip (outer|front|inner|back, drawn for the
    character's right limb) into box faces. Left limbs are mirrored."""
    faces = {
        "outer": [r[0:4] for r in strip],
        "front": [r[4:8] for r in strip],
        "inner": [r[8:12] for r in strip],
        "back": [r[12:16] for r in strip],
        "top": top,
        "bottom": bottom,
    }
    if left_side:
        faces = {k: flip(v) for k, v in faces.items()}
    outer_region, inner_region = ("left", "right") if left_side else ("right", "left")
    return {
        outer_region: faces["outer"],
        inner_region: faces["inner"],
        "front": faces["front"],
        "back": faces["back"],
        "top": faces["top"],
        "bottom": faces["bottom"],
    }


def blank(w, h):
    return ["." * w for _ in range(h)]


def fill(ch, w, h):
    return [ch * w for _ in range(h)]


def glow_only(rows):
    """Keep the glow digits of an art block, make everything else clear."""
    return ["".join(c if c in GLOW else "." for c in r) for r in rows]


def with_glow(base, outer):
    """Copy the glow digits of an outer-layer face onto the base face below
    it, so the design is still there (unlit) without the resource pack."""
    return ["".join(o if o in GLOW else b for b, o in zip(br, orow))
            for br, orow in zip(base, outer)]


# ------------------------------------------------------------------ head --

HEAD_FRONT = [
    "HHHjHHHH",
    "HhHHHHjH",
    "HjHHhjHH",
    "HHhHHHhH",
    "HN2PH2NH",   # eyes: navy lash + blue
    "p35Pp53p",   # eyes: bright blue + ice glint
    "mmmmmmmm",   # face mask
    "MMMMMMMM",
]
HEAD_SIDE = [     # left column = back of head, right column = face side
    "HHHHHHHH",
    "HHHHhHHH",
    "HjHHHHHH",
    "HHHHHHhH",
    "HHhHHHHH",
    "HHHHHHHp",
    "HHHHmmmm",
    "HHHHMMMM",
]
HEAD_BACK = [
    "HHHHHHHH",
    "HHhHHHHH",
    "HHHHHjHH",
    "HHHHHHHH",
    "HjHHHHhH",
    "HHHHHHHH",
    "HHHhHHHH",
    "HHHHHHHH",
]
HEAD_TOP = [      # top row = back of head, bottom row = forehead
    "HHHHHHHH",
    "HHhHHHHH",
    "HHHHHHjH",
    "HHHHHHHH",
    "HHHjHHHH",
    "HhHHHHHH",
    "HHHHHhHH",
    "HHHHHHHH",
]

HAT_FRONT = [     # hood opening, 3D fringe, glowing eyes, 3D mask
    "oooooooo",
    "oHj.HHjo",
    "o.H..h.o",
    "o......o",
    "o.2..2.o",
    "o35..53o",
    "mmmmmmmm",
    "MMMMMMMM",
]
HAT_RIGHT = [     # hood side with a glowing blue flame mark
    "OOOOOOOo",
    "OOOO2OOo",
    "OOO23OOo",
    "OO2342Oo",
    "O23453Oo",
    "O24542Oo",
    "OO2332MM",
    "OOO22MMM",
]
HAT_LEFT = [      # plain hood side (front edge on the left)
    "oOOOOOOO",
    "oOOOOOOO",
    "oOOdOOOO",
    "oOOOOOOO",
    "oOOOOdOO",
    "oOOOOOOO",
    "MMOOOOOO",
    "MMMOOOOO",
]
HAT_BACK = [
    "OOOOOOOO",
    "OOOdOOOO",
    "OOOOOOOO",
    "OOOOdOOO",
    "OOOOOOOO",
    "OOdOOOOO",
    "OOOOOOdO",
    "OOOOOOOO",
]
HAT_TOP = [       # top row = back, bottom row = front rim
    "OOOdOOOO",
    "OOOdOOOO",
    "OOOOdOOO",
    "OOOdOOOO",
    "OOOdOOOO",
    "OOOOdOOO",
    "OOOOOOOO",
    "oooooooo",
]

# ------------------------------------------------------------------ body --

BODY_FRONT = [
    "kdskksdk",   # collar with drawstring eyelets
    "kkWkkWkk",
    "kkWkkWkk",
    "kkwkkwkk",
    "kkWkkwkk",
    "kkWkkWkk",
    "kkskkskk",   # aglets
    "kgggggGk",   # kangaroo pocket
    "kgkkkkgk",
    "kgkkkkgk",
    "gggggggg",   # ribbed hem
    "gGgGgGgG",
]
BODY_BACK = [     # big blue flame emblem
    "kkkkkkkk",
    "kkkk2kkk",
    "k2kk32kk",
    "k3k243kk",
    "k32453k2",
    "k2456423",
    "kk356532",
    "k246542k",
    "kk3443kk",
    "kkk22kkk",
    "gggggggg",
    "gGgGgGgG",
]
BODY_SIDE = [
    "kkkk",
    "kkkk",
    "kdkk",
    "kkkk",
    "kkkk",
    "kkdk",
    "kkkk",
    "kkkk",
    "kkkk",
    "kkkk",
    "gggg",
    "gGgG",
]

JACKET_FRONT = [  # 3D drawstrings and hem
    "........",
    "..W..W..",
    "..W..W..",
    "..w..w..",
    "..W..w..",
    "..W..W..",
    "..s..s..",
    "........",
    "........",
    "........",
    "gggggggg",
    "gGgGgGgG",
]
JACKET_SIDE = ["...."] * 10 + ["gggg", "gGgG"]


# ------------------------------------------------------------------ arms --

# Flame heights per column, wrapping outer|front|inner|back (right arm).
ARM_FLAME_HEIGHTS = [2, 3, 4, 2, 3, 4, 2, 3, 1, 2, 3, 1, 2, 4, 3, 2]
FLAME_RAMP = {     # bottom -> tip
    1: "3",
    2: "42",
    3: "531",
    4: "5421",
}
ARM_BAND = "4334" "3443" "4334" "3443"


def arm_strips():
    base = [
        "kkkk" "kkkk" "kkkk" "kkkk",
        "WkkW" "kkkk" "kkkk" "kkkk",   # X glyph on the outer side
        "kWWk" "kkdk" "kkkk" "kdkk",
        "kWWk" "kkkk" "kdkk" "kkkk",
        "WkkW" "kkkk" "kkkk" "kkkk",
        "kkkk" "kkkk" "kkkk" "kkkk",
        "kkkk" "kkkk" "kkkk" "kkkk",
        "kkkk" "kkkk" "kkkk" "kkkk",
        "kkkk" "kkkk" "kkkk" "kkkk",
        "WWWW" "WWWW" "WWWW" "WWWW",   # white cuff
        ARM_BAND,                      # glowing blue cuff
        "PPPP" "PPPP" "pppp" "pppp",   # hand
    ]
    outer = [
        "...." "...." "...." "....",
        "7..7" "...." "...." "....",
        ".77." "...." "...." "....",
        ".77." "...." "...." "....",
        "7..7" "...." "...." "....",
        "...." "...." "...." "....",
        "...." "...." "...." "....",
        "...." "...." "...." "....",
        "...." "...." "...." "....",
        "WWWW" "WWWW" "WWWW" "WWWW",
        ARM_BAND,
        "...." "...." "...." "....",
    ]
    base = [list(r) for r in base]
    outer = [list(r) for r in outer]
    for col, height in enumerate(ARM_FLAME_HEIGHTS):
        for i, ch in enumerate(FLAME_RAMP[height]):
            row = 8 - i
            base[row][col] = ch
            outer[row][col] = ch
    return ["".join(r) for r in base], ["".join(r) for r in outer]


ARM_TOP = fill("k", 4, 4)
HAND_BOTTOM = ["PPPP", "PpPP", "PPpP", "PPPP"]

# ------------------------------------------------------------------ legs --

LEG_BASE = [
    "kkkk" "kkkk" "kkkk" "kkkk",
    "kkkk" "kkkk" "kkkk" "kkkk",
    "WWWW" "WWWW" "WWWW" "WWWW",   # thigh strap
    "ksSk" "kkkk" "kkkk" "kkkk",   # buckle
    "kggk" "kkkk" "kkkk" "kkdk",   # cargo pocket
    "kgdk" "kkdk" "kkkk" "kkkk",
    "kggk" "kkkk" "kdkk" "kkkk",
    "kkkk" "kkkk" "kkkk" "kkkk",
    "wWwW" "wWwW" "wWwW" "wWwW",   # ankle band
    "kk23" "kWWk" "32kk" "kGGk",   # sneaker upper
    "2344" "2442" "4432" "2332",   # glowing sneaker panel
    "WWWW" "WWWW" "WWWW" "WWWW",   # sole
]
LEG_OUTER = [
    "...." "...." "...." "....",
    "...." "...." "...." "....",
    "WWWW" "WWWW" "WWWW" "WWWW",
    ".sS." "...." "...." "....",
    "...." "...." "...." "....",
    "...." "...." "...." "....",
    "...." "...." "...." "....",
    "...." "...." "...." "....",
    "...." "...." "...." "....",
    "kk23" "kWWk" "32kk" "kGGk",
    "2344" "2442" "4432" "2332",
    "WWWW" "WWWW" "WWWW" "WWWW",
]
LEG_TOP = fill("k", 4, 4)
SOLE_BOTTOM = ["GGGG", "GgGG", "GGgG", "GGGG"]


# ----------------------------------------------------------------- build --

def part_faces():
    arm_base, arm_outer = arm_strips()
    faces = {
        "head": {
            "front": HEAD_FRONT, "right": with_glow(HEAD_SIDE, HAT_RIGHT),
            "left": flip(HEAD_SIDE),
            "back": HEAD_BACK, "top": HEAD_TOP, "bottom": fill("M", 8, 8),
        },
        "hat": {
            "front": HAT_FRONT, "right": HAT_RIGHT, "left": HAT_LEFT,
            "back": HAT_BACK, "top": HAT_TOP, "bottom": blank(8, 8),
        },
        "body": {
            "front": BODY_FRONT, "back": BODY_BACK, "right": BODY_SIDE,
            "left": flip(BODY_SIDE), "top": fill("k", 8, 4), "bottom": fill("k", 8, 4),
        },
        "jacket": {
            "front": JACKET_FRONT, "back": glow_only(BODY_BACK[:10]) + BODY_BACK[10:],
            "right": JACKET_SIDE, "left": JACKET_SIDE,
            "top": blank(8, 4), "bottom": blank(8, 4),
        },
        "right_arm": limb_faces(arm_base, ARM_TOP, HAND_BOTTOM, left_side=False),
        "left_arm": limb_faces(arm_base, ARM_TOP, HAND_BOTTOM, left_side=True),
        "right_sleeve": limb_faces(arm_outer, blank(4, 4), blank(4, 4), left_side=False),
        "left_sleeve": limb_faces(arm_outer, blank(4, 4), blank(4, 4), left_side=True),
        "right_leg": limb_faces(LEG_BASE, LEG_TOP, SOLE_BOTTOM, left_side=False),
        "left_leg": limb_faces(LEG_BASE, LEG_TOP, SOLE_BOTTOM, left_side=True),
        "right_pants": limb_faces(LEG_OUTER, blank(4, 4), SOLE_BOTTOM, left_side=False),
        "left_pants": limb_faces(LEG_OUTER, blank(4, 4), SOLE_BOTTOM, left_side=True),
    }
    return faces


def build_skin():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    for name, faces in part_faces().items():
        u, v, w, h, d, outer = PARTS[name]
        regions = box_regions(u, v, w, h, d)
        for face, rows in faces.items():
            x0, y0, fw, fh = regions[face]
            if len(rows) != fh or any(len(r) != fw for r in rows):
                raise ValueError(f"{name}.{face}: expected {fw}x{fh} art")
            for dy, row in enumerate(rows):
                for dx, ch in enumerate(row):
                    x, y = x0 + dx, y0 + dy
                    rgba = color_of(ch, x, y, outer)
                    if not outer and rgba[3] != 255:
                        raise ValueError(f"{name}.{face}: base layer must be opaque")
                    px[x, y] = rgba
    return img


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "dark_vibe_glow.png"
    build_skin().save(out)
    print("wrote", out)
