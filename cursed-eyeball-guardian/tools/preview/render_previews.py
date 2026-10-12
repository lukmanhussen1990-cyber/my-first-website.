#!/usr/bin/env python3
"""Render review previews + pack icons for the eyeball guardian.

    python3 tools/preview/render_previews.py           (after tools/gen_model.py)

Outputs:
  docs/preview/eyeball_skins.png      every skin + rage: front / 3/4 / side / back
  docs/preview/eyeball_hero.png       large 3/4 night render (crimson)
  docs/preview/eyeball_rage.png       large 3/4 night render (crimson, rage, lvl 5)
  docs/preview/eyeball_levels.png     level 1..5 (scale + extra spikes at >= 3)
  docs/preview/eyeball_textures.png   the 12 entity textures, enlarged
  packs/*/pack_icon.png               256x256 icons

The renderer is an approximation of the in-game look: lit base layer (two
light Minecraft entity shading x night light) + emissive overlay alpha-blended
at full brightness (ignore_lighting), like the warden bioluminescent layer.
Only the pack icons get an artistic bloom halo.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bedrock_render as br  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_RP")
BP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_BP")
GEO = os.path.join(RP, "models", "entity", "eyeball_guardian.geo.json")
ANIM = os.path.join(RP, "animations", "eyeball_guardian.animation.json")
TEXD = os.path.join(RP, "textures", "entity", "ceg")
OUT = os.path.join(ROOT, "docs", "preview")
SKINS = ["crimson", "void", "frost", "toxic"]


def night_bg(w, h, seed=7):
    y = np.linspace(0, 1, h)[:, None, None]
    top = np.array([0.03, 0.04, 0.10])
    bot = np.array([0.07, 0.09, 0.12])
    img = top + (bot - top) * y
    img = np.broadcast_to(img, (h, w, 3)).copy()
    rng = np.random.default_rng(seed)
    for _ in range(int(w * h / 2500)):
        sx, sy = rng.integers(0, w), rng.integers(0, int(h * 0.7))
        img[sy, sx] = 0.4 + 0.5 * rng.random()
    return img.astype(np.float32)


def pose_for(level, rage, t=0.35, spin=8.0):
    ctx = {"variable.t": t, "variable.rage_blend": 1.0 if rage else 0.0, "variable.spin": spin,
           "query.life_time": 5.0, "__props__": {"ceg:rage": 1.0 if rage else 0.0, "ceg:level": level}}
    anims = ["animation.ceg.eyeball_guardian.spikes", "animation.ceg.eyeball_guardian.spin",
             "animation.ceg.eyeball_guardian.iris"]
    return br.pose_from_animations(ANIM, anims, t, ctx)


def render_eye(geo, skin, rage, cam, size, level=1, light=0.55, bg=None, ss=3, t=0.35):
    base = br.load_texture(os.path.join(TEXD, "eyeball_guardian_%s.png" % skin))
    glow = br.load_texture(os.path.join(TEXD, "eyeball_guardian_%s_%s.png" % (skin, "rage" if rage else "glow")))
    hidden = [] if level >= 3 else ["spikes_extra"]
    scale = 0.85 + 0.05 * level
    glow_alpha = 1.0 if rage else 0.9
    return br.render(geo, base, cam, size, size, ss=ss, pose=pose_for(level, rage, t), hidden=hidden,
                     glow=glow, glow_alpha=glow_alpha, light=light, background=bg, root_scale=scale)


def label(img, text):
    d = ImageDraw.Draw(img)
    d.text((6, 4), text, fill=(235, 235, 235))
    return img


def skins_sheet(geo):
    views = [("front", 0, 0), ("3/4", 38, 18), ("side", 90, 0), ("back 3/4", 150, 15)]
    rows = [(s, False) for s in SKINS] + [("crimson", True), ("void", True)]
    T = 240
    sheet = Image.new("RGB", (T * len(views), T * len(rows)))
    for ri, (skin, rage) in enumerate(rows):
        for vi, (vn, yaw, pitch) in enumerate(views):
            cam = br.Camera(target=(0, 8, 0), yaw=yaw, pitch=pitch, dist=300, ortho_scale=38)
            img = render_eye(geo, skin, rage, cam, T, level=3, bg=night_bg(T, T, ri * 10 + vi))
            label(img, "%s%s | %s | lvl 3" % (skin, " RAGE" if rage else "", vn))
            sheet.paste(img.convert("RGB"), (vi * T, ri * T))
    sheet.save(os.path.join(OUT, "eyeball_skins.png"))


def hero(geo, name, skin, rage, level, yaw=-35, pitch=12):
    S = 640
    cam = br.Camera(target=(0, 8, 0), yaw=yaw, pitch=pitch, dist=110, fov=22)
    img = render_eye(geo, skin, rage, cam, S, level=level, bg=night_bg(S, S, 3), ss=2)
    label(img, "%s%s | level %d | approx. in-game night lighting" % (skin, " RAGE" if rage else "", level))
    img.convert("RGB").save(os.path.join(OUT, name))


def levels_sheet(geo):
    T = 220
    sheet = Image.new("RGB", (T * 5, T))
    for lv in range(1, 6):
        cam = br.Camera(target=(0, 8, 0), yaw=-30, pitch=12, dist=300, ortho_scale=40)
        img = render_eye(geo, "crimson", False, cam, T, level=lv, bg=night_bg(T, T, lv))
        label(img, "level %d (scale %.2f)" % (lv, 0.85 + 0.05 * lv))
        sheet.paste(img.convert("RGB"), ((lv - 1) * T, 0))
    sheet.save(os.path.join(OUT, "eyeball_levels.png"))


def texture_sheet():
    T = 256
    sheet = Image.new("RGB", (T * 3 + 40, T * 4 + 20 * 4), (30, 30, 36))
    d = ImageDraw.Draw(sheet)
    checker = np.indices((T, T)).sum(0) // 16 % 2
    chk = Image.fromarray(((0.18 + 0.08 * checker) * 255).astype(np.uint8)).convert("RGB")
    for ri, skin in enumerate(SKINS):
        for ci, suf in enumerate(["", "_glow", "_rage"]):
            im = Image.open(os.path.join(TEXD, "eyeball_guardian_%s%s.png" % (skin, suf))).convert("RGBA")
            im = im.resize((T, T), Image.NEAREST)
            tile = chk.copy()
            tile.paste(im, (0, 0), im)
            x, y = 10 + ci * (T + 10), ri * (T + 20) + 18
            sheet.paste(tile, (x, y))
            d.text((x, y - 14), "eyeball_guardian_%s%s.png" % (skin, suf), fill=(230, 230, 230))
    sheet.save(os.path.join(OUT, "eyeball_textures.png"))


def icon(geo, path, rage):
    S = 256
    # dramatic dark red radial background + vignette
    yy, xx = np.mgrid[0:S, 0:S]
    r = np.hypot(xx - S * 0.5, yy - S * 0.47) / (S * 0.72)
    inner = np.array([0.55, 0.03, 0.05])
    outer = np.array([0.05, 0.0, 0.01])
    t = np.clip(r, 0, 1)[..., None] ** 0.8
    bg = inner * (1 - t) + outer * t
    cam = br.Camera(target=(0, 8, 0), yaw=-32, pitch=14, dist=95, fov=24)
    eye = render_eye(geo, "crimson", rage, cam, S, level=5, light=0.8, bg=None, ss=4, t=0.6)
    eye_np = np.asarray(eye, dtype=np.float32) / 255.0
    a = eye_np[..., 3:4]
    # glow halo from the bright pixels of the render (icon art only)
    bright = np.clip(eye_np[..., :3] * a - 0.35, 0, 1)
    bright[..., 1:] *= 0.35
    halo = Image.fromarray((np.clip(bright, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    halo = np.asarray(halo, dtype=np.float32) / 255.0
    sil = Image.fromarray((a[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
    sil = np.asarray(sil, dtype=np.float32)[..., None] / 255.0
    base = bg * (1 - 0.55 * sil) + np.array([0.9, 0.05, 0.05]) * 0.35 * sil
    base = base + halo * 1.6
    out = base * (1 - a) + eye_np[..., :3] * a
    out = np.clip(out + halo * 0.35 * (1 - a), 0, 1)
    img = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGB")
    img.save(path, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    geo = br.load_geometry(GEO)
    skins_sheet(geo)
    hero(geo, "eyeball_hero.png", "crimson", False, 3)
    hero(geo, "eyeball_rage.png", "crimson", True, 5, yaw=30)
    levels_sheet(geo)
    texture_sheet()
    os.makedirs(RP, exist_ok=True)
    os.makedirs(BP, exist_ok=True)
    icon(geo, os.path.join(RP, "pack_icon.png"), rage=False)
    icon(geo, os.path.join(BP, "pack_icon.png"), rage=True)
    print("previews ->", OUT)


if __name__ == "__main__":
    main()
