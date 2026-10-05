#!/usr/bin/env python3
"""
Makes the Shadow Guardian art:
  - ShadowGuardian_RP/textures/entity/shadow_guardian/shadow_guardian.png   (64 x 64 texture)
  - ShadowGuardian_RP/models/entity/shadow_guardian.geo.json                (the 3D model)
  - pack_icon.png for both packs

The model and the texture are made together, so every face always lands on the
right pixels.  Needs:  pip install pillow
Run:  python3 tools/generate_assets.py
"""
import json
import os
import random
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RP = os.path.join(ROOT, "ShadowGuardian_RP")
BP = os.path.join(ROOT, "ShadowGuardian_BP")

# ---------------------------------------------------------------- colours ----
BLACK = (10, 8, 20)
SHADOW = (22, 17, 44)
VIOLET = (40, 31, 82)
VIOLET_HI = (66, 50, 126)
BONE = (170, 160, 200)
BONE_DARK = (110, 100, 140)
CYAN = (25, 230, 255)
CYAN_HI = (210, 255, 255)
PURPLE_GLOW = (160, 110, 255)
CUTOUT = (24, 19, 48)    # colour stored under see-through pixels (never visible)

# Alpha tells the game how to draw a pixel (material "entity_emissive_alpha"):
SOLID = 255      # normal pixel
GLOW = 3         # fully glowing (like the Enderman's eyes)
SOFT_GLOW = 90   # softly glowing
CLEAR = 0        # see-through (cut out)

FLOAT_LIFT = 6   # the whole model floats 6 pixels (0.4 block) above its feet

# --------------------------------------------------------------- the cubes ---
# size = (width, height, depth) in pixels.  Every cube type gets its own spot on the texture.
SIZES = {
    "torso": (10, 13, 6), "head": (8, 8, 8), "mantle": (12, 3, 7),
    "tail1": (8, 6, 5), "tail2": (6, 6, 4), "tail3": (4, 6, 3),
    "arm": (4, 14, 4), "horn": (2, 5, 2), "wing": (14, 16, 1),
    "halo_a": (10, 1, 1), "halo_b": (1, 1, 8),
}


def box_w(s):
    return 2 * (s[2] + s[0])


def box_h(s):
    return s[2] + s[1]


def pack():
    """Put all cube 'unfoldings' on the 64x64 texture, row by row (no overlaps)."""
    order = ["torso", "arm", "horn", "wing", "head", "tail1", "mantle", "tail2", "tail3", "halo_b", "halo_a"]
    placed, x, y, row_h = {}, 0, 0, 0
    for name in order:
        w, h = box_w(SIZES[name]), box_h(SIZES[name])
        if x + w > 64:
            x, y, row_h = 0, y + row_h, 0
        placed[name] = (x, y)
        x += w
        row_h = max(row_h, h)
    assert y + row_h <= 64, "texture is full"
    return placed


UV = pack()


def faces(name):
    """Pixel rectangles (x, y, w, h) of the six faces of a cube on the texture."""
    u, v = UV[name]
    w, h, d = SIZES[name]
    return {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


# ----------------------------------------------------------- the model JSON ---
def cube(name, origin, mirror=False):
    c = {"origin": [origin[0], origin[1] + FLOAT_LIFT, origin[2]], "size": list(SIZES[name]), "uv": list(UV[name])}
    if mirror:
        c["mirror"] = True
    return c


def bone(name, parent, pivot, cubes=None, rotation=None):
    lift = 0 if name == "root" else FLOAT_LIFT       # the root stays on the ground, the rest floats
    b = {"name": name}
    if parent:
        b["parent"] = parent
    b["pivot"] = [pivot[0], pivot[1] + lift, pivot[2]]
    if rotation:
        b["rotation"] = rotation
    if cubes:
        b["cubes"] = cubes
    return b


def build_model():
    bones = [
        bone("root", None, (0, 0, 0)),
        bone("tail1", "root", (0, 16, 0), [cube("tail1", (-4, 10, -2.5))]),
        bone("tail2", "tail1", (0, 11, 0), [cube("tail2", (-3, 5, -2))]),
        bone("tail3", "tail2", (0, 6, 0), [cube("tail3", (-2, 0, -1.5))]),
        bone("body", "root", (0, 15, 0), [cube("torso", (-5, 15, -3)), cube("mantle", (-6, 25, -3.5))]),
        bone("head", "body", (0, 28, 0), [cube("head", (-4, 27.5, -4))]),
        bone("horn_l", "head", (3, 35, 0), [cube("horn", (2, 35, -1))], rotation=[0, 0, -20]),
        bone("horn_r", "head", (-3, 35, 0), [cube("horn", (-4, 35, -1), mirror=True)], rotation=[0, 0, 20]),
        bone("halo", "head", (0, 41.5, 0), [
            cube("halo_a", (-5, 41, -5)), cube("halo_a", (-5, 41, 4)),
            cube("halo_b", (4, 41, -4)), cube("halo_b", (-5, 41, -4)),
        ]),
        bone("arm_l", "body", (7, 26, 0), [cube("arm", (5, 13.5, -2))]),
        bone("arm_r", "body", (-7, 26, 0), [cube("arm", (-9, 13.5, -2), mirror=True)]),
        bone("spike_l", "body", (6, 27, 0), [cube("horn", (5.5, 27.5, -1))], rotation=[0, 0, -25]),
        bone("spike_r", "body", (-6, 27, 0), [cube("horn", (-7.5, 27.5, -1), mirror=True)], rotation=[0, 0, 25]),
        bone("wing_l", "body", (3, 22, 3.5), [cube("wing", (3, 14, 3.5))], rotation=[0, -20, 10]),
        bone("wing_r", "body", (-3, 22, 3.5), [cube("wing", (-17, 14, 3.5), mirror=True)], rotation=[0, 20, -10]),
    ]
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry.shadow_guardian",
                "texture_width": 64, "texture_height": 64,
                "visible_bounds_width": 4, "visible_bounds_height": 4,
                "visible_bounds_offset": [0, 1.4, 0],
            },
            "bones": bones,
        }],
    }


def format_model(model):
    """Write the model as readable JSON: one bone per block, one cube per line."""
    geometry = model["minecraft:geometry"][0]
    out = ["{", '  "format_version": %s,' % json.dumps(model["format_version"]),
           '  "minecraft:geometry": [', "    {",
           '      "description": %s,' % json.dumps(geometry["description"]), '      "bones": [']
    bones = geometry["bones"]
    for n, b in enumerate(bones):
        head = {k: v for k, v in b.items() if k != "cubes"}
        text = "        " + json.dumps(head)[:-1]                      # bone without its closing brace
        cubes = b.get("cubes", [])
        if cubes:
            out.append(text + ',')
            out.append('          "cubes": [')
            out += ["            " + json.dumps(c) + ("," if i < len(cubes) - 1 else "") for i, c in enumerate(cubes)]
            out.append("          ]")
            out.append("        }" + ("," if n < len(bones) - 1 else ""))
        else:
            out.append(text + "}" + ("," if n < len(bones) - 1 else ""))
    out += ["      ]", "    }", "  ]", "}"]
    return "\n".join(out) + "\n"


# ------------------------------------------------------------ the painting ---
rng = random.Random(7)
img = Image.new("RGBA", (64, 64), (0, 0, 0, CLEAR))
px = img.load()


def put(x, y, rgb, a=SOLID):
    if 0 <= x < 64 and 0 <= y < 64:
        px[x, y] = (rgb[0], rgb[1], rgb[2], a)


def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)


def fill(rect, base, top_light=1.15, bottom_dark=0.8, noise=0.10):
    """Fill a face with a base colour, a soft top-to-bottom shade and a little noise."""
    x0, y0, w, h = rect
    for j in range(h):
        k = top_light + (bottom_dark - top_light) * (j / max(1, h - 1))
        for i in range(w):
            put(x0 + i, y0 + j, shade(base, k * (1 + rng.uniform(-noise, noise))))


def paint_cube(name, base, **kw):
    for rect in faces(name).values():
        fill(rect, base, **kw)


def edge(rect, rgb, sides="tblr"):
    x0, y0, w, h = rect
    for i in range(w):
        if "t" in sides:
            put(x0 + i, y0, rgb)
        if "b" in sides:
            put(x0 + i, y0 + h - 1, rgb)
    for j in range(h):
        if "l" in sides:
            put(x0, y0 + j, rgb)
        if "r" in sides:
            put(x0 + w - 1, y0 + j, rgb)


# -- head: a dark helmet with a glowing visor
paint_cube("head", VIOLET, top_light=1.1, bottom_dark=0.7)
for name in ("east", "west", "south"):
    edge(faces("head")[name], BLACK, "tb")
hx, hy, hw, hh = faces("head")["north"]
for j in range(hh):
    for i in range(hw):
        put(hx + i, hy + j, shade(SHADOW, 0.9 + 0.1 * (j / hh)))
for i in range(hw):
    put(hx + i, hy, VIOLET_HI)                       # helmet brim
for j in range(2, 6):                                # the visor slit
    for i in range(1, 7):
        put(hx + i, hy + j, BLACK)
for (ex, ey) in ((1, 3), (5, 3)):                    # two glowing eyes (2 x 2 pixels each)
    for dx in (0, 1):
        for dy in (0, 1):
            put(hx + ex + dx, hy + ey + dy, CYAN, GLOW)
    put(hx + ex, hy + ey, CYAN_HI, GLOW)             # bright spark in each eye
put(hx + 3, hy + 3, PURPLE_GLOW, SOFT_GLOW)          # a soft glow between the eyes
put(hx + 3, hy + 4, PURPLE_GLOW, SOFT_GLOW)
for i in range(2, 6):                                # stitched mouth
    put(hx + i, hy + 7, BONE_DARK if i % 2 == 0 else BLACK)

# -- body, robe and mantle
paint_cube("torso", SHADOW)
paint_cube("mantle", VIOLET)
for name, c in (("tail1", SHADOW), ("tail2", VIOLET), ("tail3", SHADOW)):
    paint_cube(name, c, top_light=1.1, bottom_dark=0.55)
tx, ty, tw, th = faces("torso")["north"]                # glowing chest rune: a diamond
for (dx, dy) in ((4, 3), (5, 3), (3, 4), (6, 4), (3, 5), (6, 5), (4, 6), (5, 6)):
    put(tx + dx, ty + dy, PURPLE_GLOW, SOFT_GLOW)
for (dx, dy) in ((4, 4), (5, 4), (4, 5), (5, 5)):
    put(tx + dx, ty + dy, CYAN, GLOW)
for j in range(th):                                     # belt of lighter cloth
    if j in (9, 10):
        for i in range(tw):
            put(tx + i, ty + j, VIOLET_HI)
for name in ("tail1", "tail2", "tail3"):                # ragged glowing hem on the front
    x0, y0, w, h = faces(name)["north"]
    for i in range(w):
        put(x0 + i, y0 + h - 1, PURPLE_GLOW if i % 2 == 0 else BLACK, SOFT_GLOW if i % 2 == 0 else SOLID)

# -- arms: dark sleeves with a pale cuff
paint_cube("arm", VIOLET)
for name, rect in faces("arm").items():
    if name in ("east", "north", "west", "south"):
        x0, y0, w, h = rect
        for j in (h - 3, h - 2):
            for i in range(w):
                put(x0 + i, y0 + j, BONE_DARK if j == h - 3 else BONE)
        for i in range(w):
            put(x0 + i, y0 + h - 1, BLACK)

# -- horns / spikes: pale bone
paint_cube("horn", BONE, top_light=1.1, bottom_dark=0.75)

# -- wings: a dark membrane cut into a bat-wing shape, with glowing veins
def wing_has_pixel(i, j, w, h):
    """i = distance from the body (0 = at the body), j = row. True where the wing is solid."""
    top = int(i * 0.35)
    bottom = h - 1 - int(i * 0.55) - (2 if i % 4 == 3 else 0)      # scalloped, shorter near the tip
    return top <= j <= bottom


wing = faces("wing")
for face_name in ("north", "south"):
    fx0, fy0, ww, wh = wing[face_name]
    for j in range(wh):
        for i in range(ww):
            # seen from the front (north) the body side is on the right, from the back (south) on the left
            dist = (ww - 1 - i) if face_name == "north" else i
            if wing_has_pixel(dist, j, ww, wh):
                put(fx0 + i, fy0 + j, shade(VIOLET, 0.8 + 0.3 * (j / wh)))
            else:
                put(fx0 + i, fy0 + j, CUTOUT, CLEAR)
    for dist in range(1, ww):                                       # glowing veins
        i = (ww - 1 - dist) if face_name == "north" else dist
        for j in (int(wh * 0.55 - dist * 0.3), int(wh * 0.35 + dist * 0.25)):
            if wing_has_pixel(dist, j, ww, wh):
                put(fx0 + i, fy0 + j, PURPLE_GLOW, SOFT_GLOW)
    for j in range(wh):                                             # dark edge next to the body
        body_i = ww - 1 if face_name == "north" else 0
        put(fx0 + body_i, fy0 + j, BLACK)
for face_name in ("up", "down", "east", "west"):                    # the paper-thin edges stay see-through
    x0, y0, w, h = wing[face_name]
    for j in range(h):
        for i in range(w):
            put(x0 + i, y0 + j, CUTOUT, CLEAR)

# -- halo: pure glowing cyan
for name in ("halo_a", "halo_b"):
    for rect in faces(name).values():
        x0, y0, w, h = rect
        for j in range(h):
            for i in range(w):
                put(x0 + i, y0 + j, CYAN if (i + j) % 2 == 0 else CYAN_HI, GLOW)


# ------------------------------------------------------------------ writing ---
def make_icon(size):
    """Pack icon: dark background with the guardian's face and glowing eyes."""
    icon = Image.new("RGBA", (size, size), SHADOW + (255,))
    ip = icon.load()
    for y in range(size):
        for x in range(size):
            glow = max(0.0, 1 - ((x - size / 2) ** 2 + (y - size / 2) ** 2) ** 0.5 / (size * 0.75))
            ip[x, y] = tuple(int(c + glow * 40) for c in VIOLET) + (255,)
    hx, hy, hw, hh = faces("head")["north"]
    face = img.crop((hx, hy, hx + hw, hy + hh)).convert("RGBA")
    big = size * 3 // 4
    face = face.resize((big, big), Image.NEAREST)
    fp = face.load()
    for y in range(big):
        for x in range(big):
            r, g, b, a = fp[x, y]
            fp[x, y] = (r, g, b, 255)                 # show glowing pixels at full strength in the icon
    off = (size - big) // 2
    icon.paste(face, (off, off))
    return icon


def main():
    os.makedirs(os.path.join(RP, "textures", "entity", "shadow_guardian"), exist_ok=True)
    os.makedirs(os.path.join(RP, "models", "entity"), exist_ok=True)
    img.save(os.path.join(RP, "textures", "entity", "shadow_guardian", "shadow_guardian.png"))
    with open(os.path.join(RP, "models", "entity", "shadow_guardian.geo.json"), "w") as f:
        f.write(format_model(build_model()))
    icon = make_icon(128)
    icon.save(os.path.join(RP, "pack_icon.png"))
    icon.save(os.path.join(BP, "pack_icon.png"))
    print("texture 64x64, model and icons written")


if __name__ == "__main__":
    main()
