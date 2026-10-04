"""Renders the Flying Guardian in its animated poses (evaluating the same expressions that are
written to the animation files) and produces the pack icons.

    python3 tools/render_poses.py
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
import build_animations as A  # noqa: E402
from build_assets import ADDON, BP, PREVIEW_DIR, RP, build, gradient_bg, render  # noqa: E402


def env(phase=90.0, fly=0.0, t=1.0):
    return {"variable.flap_phase": phase, "variable.fly_amount": fly, "query.life_time": t}


def main():
    bones, uv, tex_h, rgba = build()
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    bg = gradient_bg(256, (62, 66, 92), (146, 124, 116))

    poses = {
        "hover_wings_up": A.evaluate(A.flight_channels(), env(phase=90)),
        "hover_wings_down": A.evaluate(A.flight_channels(), env(phase=270)),
        "fast_flight": A.evaluate(A.flight_channels(), env(phase=200, fly=1.0)),
        "stay": A.evaluate(A.sit_channels(), env()),
        "dive": A.evaluate(A.dive_channels(), env()),
        "attack_windup": A.combine(A.evaluate(A.flight_channels(), env(phase=150)),
                                   A.keyframe_pose(A.attack_animation(), 0.22)),
        "attack_strike": A.combine(A.evaluate(A.flight_channels(), env(phase=150)),
                                   A.keyframe_pose(A.attack_animation(), 0.5)),
        "tamed_roar": A.combine(A.evaluate(A.flight_channels(), env(phase=60)),
                                A.keyframe_pose(A.tame_animation(), 0.8)),
    }
    views = {
        "hover_wings_up": (25, 10), "hover_wings_down": (25, 10), "fast_flight": (60, 10), "stay": (25, 8),
        "dive": (70, 15), "attack_windup": (30, 8), "attack_strike": (30, 8), "tamed_roar": (20, 5),
    }
    tiles = []
    for name, pose in poses.items():
        yaw, pitch = views[name]
        img, _ = render(bones, uv, rgba, pose=pose, yaw=yaw, pitch=pitch, background=bg, size=400, dist=125)
        img.save(os.path.join(PREVIEW_DIR, f"pose_{name}.png"))
        d = ImageDraw.Draw(img)
        d.text((10, 10), name, fill=(255, 255, 255))
        tiles.append(img)
    sheet = Image.new("RGB", (400 * 4, 400 * 2))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % 4) * 400, (i // 4) * 400))
    sheet.save(os.path.join(PREVIEW_DIR, "pose_sheet.png"))

    # Pack icon: menacing three-quarter portrait on a hellish gradient.
    icon_bg = gradient_bg(256, (24, 6, 10), (150, 40, 14))
    pose = A.evaluate(A.flight_channels(), env(phase=100))
    img, _ = render(bones, uv, rgba, pose=pose, yaw=28, pitch=6, background=icon_bg, size=512, dist=105,
                    target=(0, 30, 0), supersample=2)
    vignette = Image.new("L", img.size, 0)
    ImageDraw.Draw(vignette).ellipse((-90, -60, 602, 600), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(60))
    dark = Image.new("RGB", img.size, (8, 2, 4))
    icon = Image.composite(img, dark, vignette).resize((256, 256), Image.LANCZOS)
    for path in (os.path.join(RP, "pack_icon.png"), os.path.join(BP, "pack_icon.png")):
        icon.save(path)
    print("pose previews + pack icons written")


if __name__ == "__main__":
    main()
