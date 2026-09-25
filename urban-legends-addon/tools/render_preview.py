"""Renders a front + side preview of each mob straight from the geometry/texture files.

Bedrock angles are converted to right-handed math with X and Z inverted (Y unchanged),
which matches how vanilla models (zombie arms, spider legs) behave in game.
Usage: python3 tools/render_preview.py [output.png]
"""
import json
import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "UrbanLegends_RP")


def rot_matrix(rx, ry, rz):
    x, y, z = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    mx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    my = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    mz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    mul = lambda a, b: [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mul(mz, mul(my, mx))


def apply(m, p):
    return [sum(m[i][k] * p[k] for k in range(3)) for i in range(3)]


def around(pivot, rot, p):
    if not rot or not any(rot):
        return p
    local = apply(rot_matrix(*rot), [p[i] - pivot[i] for i in range(3)])
    return [local[i] + pivot[i] for i in range(3)]


def faces(c):
    (x0, y0, z0), (w, h, d), (u, v) = c["origin"], c["size"], c["uv"]
    x1, y1, z1 = x0 + w, y0 + h, z0 + d
    # name: (normal, (tex u0, v0, tw, th), fn(s, t) -> point) with s, t in [0, 1] across the texture rect
    return [
        ((0, 0, -1), (u + d, v + d, w, h), lambda s, t: (x0 + s * w, y1 - t * h, z0)),
        ((0, 0, 1), (u + 2 * d + w, v + d, w, h), lambda s, t: (x1 - s * w, y1 - t * h, z1)),
        ((-1, 0, 0), (u, v + d, d, h), lambda s, t: (x0, y1 - t * h, z1 - s * d)),
        ((1, 0, 0), (u + d + w, v + d, d, h), lambda s, t: (x1, y1 - t * h, z0 + s * d)),
        ((0, 1, 0), (u + d, v, w, d), lambda s, t: (x0 + s * w, y1, z1 - t * d)),
        ((0, -1, 0), (u + d + w, v, w, d), lambda s, t: (x0 + s * w, y0, z1 - t * d)),
    ]


def render(geo_file, tex_file, view, px_per_unit=7, size=(360, 420)):
    geo = json.load(open(os.path.join(RP, geo_file)))["minecraft:geometry"][0]
    desc = geo["description"]
    tex = Image.open(os.path.join(RP, tex_file)).convert("RGBA")
    kx, ky = tex.size[0] / desc["texture_width"], tex.size[1] / desc["texture_height"]
    bones = {b["name"]: b for b in geo["bones"]}

    def to_world(bone, p):
        while bone:
            p = around(bone["pivot"], bone.get("rotation"), p)
            bone = bones.get(bone.get("parent"))
        return p

    img = Image.new("RGBA", size, (58, 74, 58, 255))
    zbuf = {}
    W, H = size
    for bone in geo["bones"]:
        for c in bone.get("cubes", []):
            for normal, (tu, tv, tw, th), point in faces(c):
                tip = to_world(bone, around(c.get("pivot", [0, 0, 0]), c.get("rotation"), [a + b for a, b in zip(point(0.5, 0.5), normal)]))
                mid = to_world(bone, around(c.get("pivot", [0, 0, 0]), c.get("rotation"), list(point(0.5, 0.5))))
                n = [tip[i] - mid[i] for i in range(3)]
                facing = -n[2] if view == "front" else n[0]
                if facing <= 0.01 or tw == 0 or th == 0:
                    continue
                shade = 0.65 + 0.35 * facing + (0.1 if n[1] > 0.5 else 0)
                steps_s, steps_t = max(1, int(tw * kx * 2)), max(1, int(th * ky * 2))
                for j in range(steps_t):
                    for i in range(steps_s):
                        s, t = (i + 0.5) / steps_s, (j + 0.5) / steps_t
                        p = to_world(bone, around(c.get("pivot", [0, 0, 0]), c.get("rotation"), list(point(s, t))))
                        r, g, b, a = tex.getpixel((min(tex.size[0] - 1, int((tu + s * tw) * kx)), min(tex.size[1] - 1, int((tv + t * th) * ky))))
                        k = 1.25 if a < 255 else shade  # emissive pixels ignore shading
                        col = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), 255)
                        sx, depth = (p[0], p[2]) if view == "front" else (-p[2], -p[0])
                        X = int(W / 2 + sx * px_per_unit)
                        Y = int(H - 20 - p[1] * px_per_unit)
                        for dx in range(-(px_per_unit // 4) - 1, px_per_unit // 4 + 1):
                            for dy in range(-(px_per_unit // 4) - 1, px_per_unit // 4 + 1):
                                key = (X + dx, Y + dy)
                                if 0 <= key[0] < W and 0 <= key[1] < H and depth < zbuf.get(key, 1e9):
                                    zbuf[key] = depth
                                    img.putpixel(key, col)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "preview.png")
    shots = [
        render("models/entity/grinning_man.geo.json", "textures/entity/grinning_man.png", "front"),
        render("models/entity/grinning_man.geo.json", "textures/entity/grinning_man.png", "side"),
        render("models/entity/parasite.geo.json", "textures/entity/parasite.png", "front", 25, (360, 420)),
        render("models/entity/parasite.geo.json", "textures/entity/parasite.png", "side", 25, (360, 420)),
    ]
    sheet = Image.new("RGBA", (360 * len(shots), 420 + 140), (40, 52, 40, 255))
    for i, shot in enumerate(shots):
        sheet.paste(shot, (360 * i, 0))
    names = ["flashlight", "emf_reader", "holy_talisman", "soul_scythe", "haunted_mirror"]
    for i, name in enumerate(names):
        icon = Image.open(os.path.join(RP, "textures", "items", name + ".png")).convert("RGBA")
        sheet.alpha_composite(icon.resize((112, 112), Image.NEAREST), (150 + i * 240, 434))
    sheet.save(out)
    print("preview written to", out)
