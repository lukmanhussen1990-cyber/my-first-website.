#!/usr/bin/env python3
"""Validate bedrock_render.py against vanilla Bedrock models.

Usage (from the add-on root):
    python3 tools/preview/validate_vanilla.py [--samples DIR] [--textures DIR] [--out PNG]

--samples   Mojang bedrock-samples checkout (resource_pack/models/entity is used)
--textures  optional folder with real vanilla textures (cow_cow.png, ...); when a
            texture is missing a face-coded debug texture is generated instead.

Debug texture legend (per face region of every cube):
    north=red  south=blue  east=green  west=yellow  up=white  down=magenta
    brightness falls off from the region's top image row (v min) to its bottom;
    a cyan stripe marks the region's left image column (u min).
Expected on a correct render: the cow body lies on top of its legs, spider legs
reach down to the ground (front pair forward, hind pair backward), piglin and
hoglin ears hang outwards/downwards, snow golem stick arms point down-outwards.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bedrock_render as br  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DEFAULT_SAMPLES = os.environ.get("BEDROCK_SAMPLES", "")

FACE_COL = {
    "north": (230, 40, 40), "south": (40, 80, 230), "east": (40, 200, 60),
    "west": (230, 210, 40), "up": (245, 245, 245), "down": (200, 40, 200),
}


def debug_texture(geo, scale=4):
    tw, th = int(geo["texture_width"]), int(geo["texture_height"])
    img = np.zeros((th * scale, tw * scale, 4), dtype=np.float32)
    for b in geo["bones"]:
        for c in b["cubes"]:
            for fname, (u, v, su, sv) in c["faces"].items():
                ua, ub = sorted((u, u + su))
                va, vb = sorted((v, v + sv))
                x0, x1 = int(round(ua * scale)), int(round(ub * scale))
                y0, y1 = int(round(va * scale)), int(round(vb * scale))
                if x1 <= x0 or y1 <= y0:
                    continue
                col = np.array(FACE_COL[fname], dtype=np.float32) / 255.0
                rows = np.linspace(1.0, 0.35, y1 - y0)[:, None, None]
                img[y0:y1, x0:x1, :3] = col[None, None, :] * rows
                img[y0:y1, x0:x1, 3] = 1.0
                img[y0:y1, x0:min(x1, x0 + scale), :3] = (0.0, 0.9, 0.9)
                # 1-texel dark grid so individual pixels are visible
                img[y0:y1:scale, x0:x1, :3] *= 0.6
                img[y0:y1, x0:x1:scale, :3] *= 0.6
    return img


def find_geo(models_dir, fname, ident):
    return br.load_geometry(os.path.join(models_dir, fname), ident)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", default=DEFAULT_SAMPLES)
    ap.add_argument("--textures", default="")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs", "preview", "renderer_validation.png"))
    args = ap.parse_args()
    if not args.samples:
        sys.exit("pass --samples <bedrock-samples dir> (or set BEDROCK_SAMPLES)")
    models = os.path.join(args.samples, "resource_pack", "models", "entity")
    anims = os.path.join(args.samples, "resource_pack", "animations")

    cases = [
        # (label, geo file, identifier, texture file, pose builder, camera target, size)
        ("cow v1.0 (+setup.v1.0)", "cow_v1.0.geo.json", "geometry.cow", "cow_cow.png",
         lambda: {"body": {"rot": [90, 0, 0]}}, (0, 12, 0), 44),
        ("cow v1.8 (bind_pose)", "cow.geo.json", "geometry.cow.v1.8", "cow_cow.png",
         lambda: None, (0, 12, 0), 44),
        ("spider + default_leg_pose", "spider.geo.json", "geometry.spider.v1.8", "spider_spider.png",
         lambda: br.pose_from_animations(os.path.join(anims, "spider.animation.json"),
                                         ["animation.spider.default_leg_pose"], 0.0, {}),
         (0, 6, 0), 52),
        ("piglin (Z-rot ears)", "piglin.geo.json", "geometry.piglin", "piglin_piglin.png",
         lambda: None, (0, 18, 0), 44),
        ("hoglin (X head, Z ears)", "hoglin.geo.json", "geometry.hoglin", "hoglin_hoglin.png",
         lambda: None, (0, 16, 0), 60),
        ("snow golem (Y+Z arms)", "snow_golem.geo.json", "geometry.snowgolem.v1.8", "snow_golem.png",
         lambda: None, (0, 14, 0), 44),
    ]
    views = [("front", 0, 0), ("3/4", 35, 20), ("side", 90, 0)]
    tile = 220
    rows = []
    for label, gfile, ident, tfile, posef, target, size in cases:
        geo = find_geo(models, gfile, ident)
        tex_path = os.path.join(args.textures, tfile) if args.textures else ""
        variants = [("debug", debug_texture(geo))]
        if tex_path and os.path.exists(tex_path):
            variants.append(("vanilla tex", br.load_texture(tex_path)))
        for vname, tex in variants:
            row = Image.new("RGB", (tile * len(views), tile + 18), (24, 26, 34))
            d = ImageDraw.Draw(row)
            for vi, (vlabel, yaw, pitch) in enumerate(views):
                cam = br.Camera(target=target, yaw=yaw, pitch=pitch, dist=200, ortho_scale=size)
                bg = np.zeros((tile, tile, 3), dtype=np.float32) + np.array([0.45, 0.55, 0.65], dtype=np.float32)
                img = br.render(geo, tex, cam, tile, tile, ss=2, pose=posef(), background=bg)
                row.paste(img.convert("RGB"), (vi * tile, 18))
                d.text((vi * tile + 4, 3), "%s | %s | %s" % (label, vname, vlabel), fill=(255, 255, 255))
            rows.append(row)
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)), (0, 0, 0))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    sheet.save(args.out)
    print("wrote", args.out, sheet.size)


if __name__ == "__main__":
    main()
