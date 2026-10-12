"""Small software renderer for Minecraft skins (preview images and pack icon).

It mimics how Bedrock draws a player with the Dark Vibe Glow FX pack:

1. vanilla pass: every pixel with alpha >= 0.5 is drawn, lit normally;
2. glow pass (outer layers only): pixels with 0 < alpha < 1 are drawn with
   the emissive formula rgb * mix(1, light, alpha), i.e. almost unlit.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# bone, origin, size, uv, inflate, outer layer
CUBES = [
    ("head", (-4, 24, -4), (8, 8, 8), (0, 0), 0.0, False),
    ("head", (-4, 24, -4), (8, 8, 8), (32, 0), 0.5, True),
    ("body", (-4, 12, -2), (8, 12, 4), (16, 16), 0.0, False),
    ("body", (-4, 12, -2), (8, 12, 4), (16, 32), 0.25, True),
    ("rightArm", (-8, 12, -2), (4, 12, 4), (40, 16), 0.0, False),
    ("rightArm", (-8, 12, -2), (4, 12, 4), (40, 32), 0.25, True),
    ("leftArm", (4, 12, -2), (4, 12, 4), (32, 48), 0.0, False),
    ("leftArm", (4, 12, -2), (4, 12, 4), (48, 48), 0.25, True),
    ("rightLeg", (-3.9, 0, -2), (4, 12, 4), (0, 16), 0.0, False),
    ("rightLeg", (-3.9, 0, -2), (4, 12, 4), (0, 32), 0.25, True),
    ("leftLeg", (-0.1, 0, -2), (4, 12, 4), (16, 48), 0.0, False),
    ("leftLeg", (-0.1, 0, -2), (4, 12, 4), (0, 48), 0.25, True),
]
PIVOTS = {
    "head": (0, 24, 0), "body": (0, 24, 0),
    "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0),
    "rightLeg": (-1.9, 12, 0), "leftLeg": (1.9, 12, 0),
}
POSE_IDLE = {
    "head": (0, 12, 0),
    "rightArm": (-12, 0, -5), "leftArm": (10, 0, 5),
    "rightLeg": (8, 0, 0), "leftLeg": (-8, 0, 0),
}

GLOW_EPS = 1.0 / 255.0


def rot(rx, ry, rz):
    rx, ry, rz = (math.radians(a) for a in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = (math.cos(rx), math.sin(rx), math.cos(ry),
                              math.sin(ry), math.cos(rz), math.sin(rz))
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def faces_of(origin, size, uv, inflate):
    """Yield (face, P0, edge_a, edge_b, (tx, ty, tw, th)) in model space.
    The character faces +Z, its right side is -X."""
    (ox, oy, oz), (w, h, d), (u, v) = origin, size, uv
    x0, y0, z0 = ox - inflate, oy - inflate, oz - inflate
    x1, y1, z1 = ox + w + inflate, oy + h + inflate, oz + d + inflate
    W, H, D = x1 - x0, y1 - y0, z1 - z0
    yield "top", (x0, y1, z0), (W, 0, 0), (0, 0, D), (u + d, v, w, d)
    yield "bottom", (x0, y0, z0), (W, 0, 0), (0, 0, D), (u + d + w, v, w, d)
    yield "right", (x0, y1, z0), (0, 0, D), (0, -H, 0), (u, v + d, d, h)
    yield "front", (x0, y1, z1), (W, 0, 0), (0, -H, 0), (u + d, v + d, w, h)
    yield "left", (x1, y1, z1), (0, 0, -D), (0, -H, 0), (u + d + w, v + d, d, h)
    yield "back", (x1, y1, z0), (-W, 0, 0), (0, -H, 0), (u + 2 * d + w, v + d, w, h)


NORMALS = {"top": (0, 1, 0), "bottom": (0, -1, 0), "right": (-1, 0, 0),
           "left": (1, 0, 0), "front": (0, 0, 1), "back": (0, 0, -1)}


def render(skin, yaw=25.0, pitch=8.0, scale=14, pose=None, night=False,
           glow_fx=True, ss=3, bloom=False):
    """Render the skin. Returns an RGBA image (transparent background)."""
    pose = POSE_IDLE if pose is None else pose
    tex = np.asarray(skin.convert("RGBA"), dtype=np.float32) / 255.0
    s = scale * ss
    size_w, size_h = int(34 * s), int(42 * s)
    cx, cy = size_w / 2, size_h - 3.5 * s
    color = np.zeros((size_h, size_w, 3), np.float32)
    alpha = np.zeros((size_h, size_w), np.float32)
    zbuf = np.full((size_h, size_w), -1e9, np.float32)
    emissive = np.zeros((size_h, size_w), np.float32)

    view = rot(pitch, 0, 0) @ rot(0, yaw, 0)
    light_dir = np.array([-0.45, 0.65, 0.62])
    light_dir /= np.linalg.norm(light_dir)

    def shade(n):
        lam = max(0.0, float(n @ light_dir))
        if night:
            return np.array([0.07, 0.09, 0.16]) + lam * np.array([0.10, 0.13, 0.24])
        return np.full(3, 0.50 + 0.52 * lam)

    passes = [("vanilla", False)] + ([("glow", True)] if glow_fx else [])
    for pass_name, outer_only in passes:
        for bone, origin, size, uv, inflate, outer in CUBES:
            if outer_only and not outer:
                continue
            r_bone = rot(*pose.get(bone, (0, 0, 0)))
            pivot = np.array(PIVOTS[bone], dtype=float)
            for face, p0, ea, eb, (tx, ty, tw, th) in faces_of(origin, size, uv, inflate):
                def xf(p):
                    p = r_bone @ (np.array(p, float) - pivot) + pivot
                    p = view @ (p - np.array([0, 16, 0])) + np.array([0, 16, 0])
                    return p
                P0 = xf(p0)
                Pa = xf(np.add(p0, ea)) - P0
                Pb = xf(np.add(p0, eb)) - P0
                n = view @ r_bone @ np.array(NORMALS[face], float)
                light = shade(n)
                # screen space (x right, y down)
                S0 = np.array([cx + P0[0] * s, cy - P0[1] * s])
                Sa = np.array([Pa[0] * s, -Pa[1] * s])
                Sb = np.array([Pb[0] * s, -Pb[1] * s])
                det = Sa[0] * Sb[1] - Sa[1] * Sb[0]
                if abs(det) < 1e-6:
                    continue
                corners = np.array([S0, S0 + Sa, S0 + Sb, S0 + Sa + Sb])
                xmin = max(int(math.floor(corners[:, 0].min())), 0)
                xmax = min(int(math.ceil(corners[:, 0].max())), size_w - 1)
                ymin = max(int(math.floor(corners[:, 1].min())), 0)
                ymax = min(int(math.ceil(corners[:, 1].max())), size_h - 1)
                if xmin > xmax or ymin > ymax:
                    continue
                ys, xs = np.mgrid[ymin:ymax + 1, xmin:xmax + 1]
                dx = xs + 0.5 - S0[0]
                dy = ys + 0.5 - S0[1]
                a = (dx * Sb[1] - dy * Sb[0]) / det
                b = (Sa[0] * dy - Sa[1] * dx) / det
                inside = (a >= 0) & (a < 1) & (b >= 0) & (b < 1)
                if not inside.any():
                    continue
                txi = np.clip((tx + np.floor(a * tw)).astype(int), 0, 63)
                tyi = np.clip((ty + np.floor(b * th)).astype(int), 0, 63)
                texel = tex[tyi, txi]
                ta = texel[..., 3]
                if pass_name == "vanilla":
                    keep = inside & (ta >= 0.5)
                    out_rgb = texel[..., :3] * light
                else:
                    keep = inside & (ta > GLOW_EPS) & (ta < 1 - GLOW_EPS)
                    mix = 1.0 + (light[None, None, :] - 1.0) * ta[..., None]
                    out_rgb = texel[..., :3] * mix
                depth = P0[2] + a * Pa[2] + b * Pb[2]
                region_z = zbuf[ymin:ymax + 1, xmin:xmax + 1]
                keep &= depth >= region_z - 1e-4
                if not keep.any():
                    continue
                region_z[keep] = depth[keep]
                color[ymin:ymax + 1, xmin:xmax + 1][keep] = out_rgb[keep]
                alpha[ymin:ymax + 1, xmin:xmax + 1][keep] = 1.0
                em = emissive[ymin:ymax + 1, xmin:xmax + 1]
                em[keep] = 1.0 if pass_name == "glow" else 0.0

    rgb = np.clip(color, 0, 1)
    if night and glow_fx and bloom:
        glow_img = Image.fromarray((rgb * emissive[..., None] * 255).astype(np.uint8))
        halo = np.zeros_like(rgb)
        for radius, weight in ((2.0, 0.55), (6.0, 0.55), (14.0, 0.45)):
            blurred = glow_img.filter(ImageFilter.GaussianBlur(radius * ss))
            halo += np.asarray(blurred, np.float32) / 255.0 * weight
        rgb = 1 - (1 - rgb) * (1 - np.clip(halo, 0, 1))
        halo_a = np.clip(halo.max(axis=2) * 1.6, 0, 1)
        alpha = np.maximum(alpha, halo_a)
        rgb = np.where(alpha[..., None] > 0, rgb, 0)
    out = np.dstack([rgb, alpha])
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA")
    if ss > 1:
        img = img.resize((size_w // ss, size_h // ss), Image.LANCZOS)
    return img


def vertical_gradient(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    arr = np.array(top)[None, None, :] * (1 - t) + np.array(bottom)[None, None, :] * t
    return Image.fromarray(np.repeat(arr, w, axis=1).astype(np.uint8), "RGB")


def font(size, bold=True):
    names = ["/usr/share/fonts/opentype/inter/Inter-Bold.otf" if bold else
             "/usr/share/fonts/opentype/inter/Inter-Regular.otf",
             "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit(img, max_w, max_h):
    """Crop a render to its visible pixels and scale it to fit a box."""
    img = img.crop(img.getchannel("A").getbbox())
    k = min(max_w / img.width, max_h / img.height)
    return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)


def preview_sheet(skin, out_path):
    W, H = 1600, 1000
    sheet = vertical_gradient(W, H, (14, 20, 44), (4, 6, 14)).convert("RGBA")
    draw = ImageDraw.Draw(sheet)

    draw.text((60, 40), "DARK VIBE GLOW", font=font(64), fill=(235, 242, 255))
    draw.text((64, 116), "Minecraft Bedrock skin  +  glow FX resource pack", font=font(24, False),
              fill=(120, 170, 255))

    panels = [
        ("FRONT", dict(yaw=22, night=False)),
        ("BACK", dict(yaw=200, night=False)),
        ("NIGHT", dict(yaw=22, night=True)),
        ("NIGHT · BACK", dict(yaw=200, night=True)),
    ]
    for i, (label, kw) in enumerate(panels):
        x, y, pw, ph = 60 + i * 250, 180, 230, 450
        bg_col = (6, 8, 16, 255) if kw["night"] else (28, 36, 64, 255)
        draw.rounded_rectangle((x, y, x + pw, y + ph), 18, fill=bg_col, outline=(52, 82, 160), width=2)
        fig = fit(render(skin, scale=12, **kw), pw - 40, ph - 60)
        sheet.alpha_composite(fig, (x + (pw - fig.width) // 2, y + ph - 22 - fig.height))
        tw = draw.textlength(label, font=font(20))
        draw.text((x + pw / 2 - tw / 2, y + ph + 14), label, font=font(20), fill=(170, 200, 255))

    # hero: big night render
    hero = fit(render(skin, yaw=-28, pitch=10, scale=20, night=True), 520, 900)
    sheet.alpha_composite(hero, (1060 + (520 - hero.width) // 2, 960 - hero.height))

    # flat texture on a checkerboard (glow pixels drawn solid so they show)
    tile = 16
    checker = Image.new("RGBA", (256, 256), (30, 36, 56, 255))
    cd = ImageDraw.Draw(checker)
    for yy in range(0, 256, tile):
        for xx in range(0, 256, tile):
            if (xx // tile + yy // tile) % 2:
                cd.rectangle((xx, yy, xx + tile - 1, yy + tile - 1), fill=(38, 46, 70, 255))
    flat = skin.copy()
    px = flat.load()
    for yy in range(64):
        for xx in range(64):
            r, g, b, a = px[xx, yy]
            if 0 < a < 255:
                px[xx, yy] = (r, g, b, 255)
    checker.alpha_composite(flat.resize((256, 256), Image.NEAREST))
    sheet.alpha_composite(checker, (60, 700))
    draw.text((330, 930), "skin texture (64 x 64)", font=font(16, False), fill=(140, 160, 210))

    notes = [
        "Glows in the dark: eyes, sleeve flames,",
        "cuffs, back emblem, hood flame, sneakers.",
        "",
        "Without the FX pack it is the same skin,",
        "just without the glow.",
    ]
    for i, line in enumerate(notes):
        draw.text((340, 712 + i * 34), line, font=font(22, False), fill=(190, 205, 235))
    sheet.convert("RGB").save(out_path)


def pack_icon(skin, out_path, size=256):
    fig = render(skin, yaw=-25, pitch=4, scale=24, night=True, pose={}, bloom=True)
    fig = fig.crop(fig.getchannel("A").getbbox())
    side = int(fig.width * 0.78)
    left = (fig.width - side) // 2
    crop = fig.crop((left, 0, left + side, side))
    bg = vertical_gradient(side, side, (18, 28, 64), (4, 6, 14)).convert("RGBA")
    bg.alpha_composite(crop)
    bg.resize((size, size), Image.LANCZOS).convert("RGB").save(out_path)


if __name__ == "__main__":
    import sys
    preview_sheet(Image.open(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "preview.png")
