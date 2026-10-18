"""Phase 2 review sheets for the official artwork (written to git-ignored out/review/).

  duo_rig.png        - rig poses built only from existing parts of the official Duo
  wordmark.png       - official wordmark at both rest sizes with the clear-space zone
  lockup_16x9.png    - S1/S9 lock-up layout with the real assets at 1920x1080

usage: .venv/bin/python -I tools/brand_sheets.py
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import duo, svg  # noqa: E402

OUT = ROOT / "out/review"
STAGE = (6, 10, 12)
LOCKUP_SVG = ROOT / "assets/brand/duolingo_press_lockup.svg"  # restore with tools/fetch_brand.sh
WORDMARK_INDEX = 1  # shape #0 is the Duo silhouette mark, #1 is the "duolingo" wordmark
O_HEIGHT = 13.14    # height of the "o" in wordmark units = clear-space unit
FONT = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 22)
SMALL = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 17)


def over_stage(rgba):
    return Image.fromarray(svg.to_uint8(rgba, STAGE))


def paste_rgba(canvas: Image.Image, rgba: np.ndarray, x: float, y: float):
    im = Image.fromarray(svg.to_uint8(rgba), "RGBA")
    canvas.alpha_composite(im, (int(round(x)), int(round(y))))


def duo_rig_sheet():
    poses = [
        ("neutral", duo.Pose()),
        ("SLAM f11: squash 0.78, wings flung 55°", duo.Pose(squash=0.78, wing_l=55, wing_r=55)),
        ("rebound f15: stretch 1.12", duo.Pose(squash=1.12, wing_l=20, wing_r=20)),
        ("blink (eyes to 8%)", duo.Pose(blink=1.0)),
        ("talk: beak open", duo.Pose(beak=1.0)),
        ("happy flap: wings up 120°", duo.Pose(wing_l=120, wing_r=120, squash=1.04)),
        ("hop: stretch 1.15, wings 75°", duo.Pose(squash=1.15, wing_l=75, wing_r=75)),
        ("land f1009: squash 0.82", duo.Pose(squash=0.82, wing_l=35, wing_r=35)),
    ]
    cw, ch, body = 460, 560, 300
    sheet = Image.new("RGBA", (cw * 4, ch * 2 + 60), STAGE + (255,))
    d = ImageDraw.Draw(sheet)
    d.text((20, 18), "Duo rig on the official artwork: every pose transforms existing shapes only (no redraw, no recolor)", font=FONT, fill=(226, 232, 235))
    for i, (label, p) in enumerate(poses):
        x, y = (i % 4) * cw, 60 + (i // 4) * ch
        img, feet = duo.render(p, body, ss=4)
        base_y = y + ch - 90
        d.line([(x + 40, base_y), (x + cw - 40, base_y)], fill=(40, 52, 58), width=2)
        paste_rgba(sheet, img, x + cw / 2 - feet[0], base_y - feet[1])
        d.text((x + 24, y + ch - 70), label, font=SMALL, fill=(200, 210, 215))
    # pivots on the neutral pose (small markers)
    s = body / (duo.FEET[1] - duo.HEAD_TOP)
    img, feet = duo.render(duo.Pose(), body, ss=4)
    ox, oy = cw / 2 - feet[0], 60 + ch - 90 - feet[1]
    x0, y0, _, _ = duo.posed_bounds(duo.Pose())
    for name, pt in (("feet", duo.FEET), ("shoulder", duo.SHOULDER_L), ("shoulder", duo.SHOULDER_R), ("eye", duo.EYE_L), ("eye", duo.EYE_R)):
        px = ox + (pt[0] * s - (np.floor(x0 * s) - 4))
        py = oy + (pt[1] * s - (np.floor(y0 * s) - 4))
        d.ellipse([px - 4, py - 4, px + 4, py + 4], outline=(255, 70, 200), width=2)
    sheet.convert("RGB").save(OUT / "duo_rig.png")


def wordmark_raster(width_px: float, ss: int = 8):
    doc = svg.load(LOCKUP_SVG)
    wm = doc.shapes[WORDMARK_INDEX]
    x0, y0, x1, y1 = wm.bbox
    s = width_px / (x1 - x0)
    w, h = int(np.ceil((x1 - x0) * s)), int(np.ceil((y1 - y0) * s))
    M = np.array([[s, 0, -x0 * s], [0, s, -y0 * s], [0, 0, 1.0]])
    return svg.render([wm], M, (h, w), ss=ss), s


def wordmark_sheet():
    W, H = 1920, 1080
    sheet = Image.new("RGBA", (W, H), STAGE + (255,))
    d = ImageDraw.Draw(sheet)
    d.text((40, 30), "Official wordmark (press lock-up shape #1, untouched) on the stage, Feather Green #58CC02", font=FONT, fill=(226, 232, 235))
    y = 140
    for label, width in (("16:9 rest size: 700 px wide", 700), ("9:16 rest size: 720 px wide", 720)):
        img, s = wordmark_raster(width)
        h, w = img.shape[:2]
        cs = O_HEIGHT * s
        x = (W - w) // 2
        d.rectangle([x - cs, y - cs, x + w + cs, y + h + cs], outline=(255, 70, 200), width=2)
        d.rectangle([x, y, x + w, y + h], outline=(55, 70, 79), width=1)
        paste_rgba(sheet, img, x, y)
        core = img[..., 3] > 0.999
        rgb = svg.to_uint8(img)[..., :3][core]
        uniq = {tuple(int(c) for c in v) for v in rgb}
        d.text((x - cs, y + h + cs + 12), f"{label} -> {w}x{h} px, clear space = 1 'o' height = {cs:.1f} px; opaque pixels are exactly {sorted(uniq)}", font=SMALL, fill=(200, 210, 215))
        y += int(h + 2 * cs + 90)
    sheet.convert("RGB").save(OUT / "wordmark.png")


def lockup_preview():
    """S1/S9 lock-up with the real assets: Duo above, wordmark, line underneath."""
    W, H = 1920, 1080
    canvas = Image.new("RGBA", (W, H), STAGE + (255,))
    d = ImageDraw.Draw(canvas)
    wm, s = wordmark_raster(700)
    wh, ww = wm.shape[:2]
    cs = O_HEIGHT * s
    duo_h = 300
    gap = round(cs)  # Duo's feet sit one clear-space unit above the wordmark
    total = duo_h + gap + wh + round(cs) + 6
    top = (H - total) // 2
    duo_img, feet = duo.render(duo.Pose(), duo_h, ss=4)
    paste_rgba(canvas, duo_img, W / 2 - feet[0], top + duo_h - feet[1])
    wy = top + duo_h + gap
    wx = (W - ww) // 2
    paste_rgba(canvas, wm, wx, wy)
    ly = wy + wh + round(cs)
    d.line([(wx - 40, ly), (wx + ww + 40, ly)], fill=(88, 204, 2), width=6)
    d.rectangle([wx - cs, wy - cs, wx + ww + cs, wy + wh + cs], outline=(255, 70, 200), width=1)
    d.text((40, 30), f"Lock-up check (16:9): Duo {duo_h} px, wordmark {ww}x{wh} px, clear space {cs:.0f} px (magenta), line = placeholder stroke", font=SMALL, fill=(200, 210, 215))
    canvas.convert("RGB").save(OUT / "lockup_16x9.png")
    return {"duo_top": top, "wordmark_xywh": (wx, wy, ww, wh), "line_y": ly, "clear_space_px": cs}


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    duo_rig_sheet()
    wordmark_sheet()
    print(lockup_preview())
