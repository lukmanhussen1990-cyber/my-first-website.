"""Composite rendered shots + captions + binocular mask + watermark, mux with audio.

python compose.py SRC_MODE OUT.mp4 AUDIO.wav [--preview]
SRC_MODE: final | preview | wb   (falls back to the nearest available frame of a shot)
"""
import os, sys, glob, subprocess, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
SHOTS = [
    ("S01a", 0, 29), ("S01b", 29, 60), ("S02", 60, 114), ("S03", 114, 170), ("S04a", 170, 203),
    ("S04b", 203, 222), ("S05", 222, 279), ("S06", 279, 305), ("S07a", 305, 341), ("S07b", 341, 369),
    ("S07c", 369, 393), ("S08", 393, 476), ("S09", 476, 509), ("S10", 509, 560), ("S11a", 560, 594),
    ("S11b", 594, 620), ("S11c", 620, 639), ("S12", 639, 702), ("S13a", 702, 737), ("S13b", 737, 776),
    ("S14", 776, 885),
]
BINOC = {"S02", "S06", "S11c"}
TOTAL = SHOTS[-1][2]

# 1-3 word captions synced to the voiceover word timings (seconds)
CAPTIONS = [
    (0.00, 0.66, "You LOVE"), (0.66, 1.22, "seeing your"), (1.22, 2.00, "friend wet,"),
    (2.00, 2.54, "but he's"), (2.54, 3.92, "always dry!"),
    (3.92, 4.50, "So you"), (4.50, 4.80, "throw a"), (4.80, 5.82, "water balloon."),
    (5.82, 6.50, "Except he"), (6.50, 7.48, "dodges it."),
    (7.48, 7.92, "So you hang"), (7.92, 8.30, "a bucket"), (8.30, 9.50, "over his head."),
    (9.50, 10.24, "Clever!"),
    (10.24, 10.54, "But he"), (10.54, 11.40, "steps away,"), (11.40, 11.94, "and YOU"),
    (11.94, 13.18, "get soaked."),
    (13.18, 13.76, "So you strap"), (13.76, 14.18, "him to a"), (14.18, 14.70, "seat over"),
    (14.70, 15.02, "a tank"), (15.02, 16.08, "of water."),
    (16.08, 17.14, "Genius!"),
    (17.14, 17.76, "Except he"), (17.76, 18.72, "won't fall in,"),
    (18.72, 19.28, "so you add"), (19.28, 19.62, "a lever"), (19.62, 20.12, "that drops"),
    (20.12, 21.16, "the seat."),
    (21.16, 21.56, "But walking"), (21.56, 21.98, "over there"), (21.98, 22.48, "every time"),
    (22.48, 23.52, "is tiring,"),
    (23.52, 24.36, "so you add"), (24.36, 24.82, "a target"), (24.82, 25.94, "and a ball."),
    (25.94, 26.54, "You've invented"), (26.54, 29.50, "the dunk tank!"),
]
FONT = "/opt/fonts/Montserrat-ExtraBold.ttf"
FONT_WM = "/opt/fonts/Montserrat-Bold.ttf"
WATERMARK = "@theoddtilt2.0"


def caption_img(text, size=64):
    font = ImageFont.truetype(FONT, size)
    pad = 40
    bbox = font.getbbox(text, stroke_width=6)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    im = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    # soft drop shadow
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((pad - bbox[0] + 2, pad - bbox[1] + 5), text, font=font, fill=(0, 0, 0, 200),
                            stroke_width=7, stroke_fill=(0, 0, 0, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(5))
    im = Image.alpha_composite(im, sh)
    d = ImageDraw.Draw(im)
    d.text((pad - bbox[0], pad - bbox[1]), text, font=font, fill=(255, 255, 255, 255), stroke_width=6,
           stroke_fill=(10, 10, 12, 255))
    return im


def binocular_mask():
    """black overlay with two overlapping round lenses (like the reference)"""
    scale = 2
    mw, mh = W * scale, H * scale
    m = Image.new("L", (mw, mh), 0)
    d = ImageDraw.Draw(m)
    R = 650 * scale
    for cx in (270 * scale, 810 * scale):
        cy = 960 * scale
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    m = m.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3))
    hole = np.asarray(m, dtype=np.float32) / 255.0
    # inner vignette near the lens rim
    v = np.asarray(m.filter(ImageFilter.GaussianBlur(40)), dtype=np.float32) / 255.0
    shade = 0.55 + 0.45 * np.clip((v - 0.35) / 0.65, 0, 1)
    return (hole * shade)[..., None]


def watermark_img():
    font = ImageFont.truetype(FONT_WM, 40)
    bbox = font.getbbox(WATERMARK, stroke_width=2)
    im = Image.new("RGBA", (bbox[2] - bbox[0] + 20, bbox[3] - bbox[1] + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((10 - bbox[0], 10 - bbox[1]), WATERMARK, font=font, fill=(255, 255, 255, 120), stroke_width=2,
           stroke_fill=(0, 0, 0, 70))
    return im


def frame_path(modes, shot, local):
    for mode in modes.split(","):
        r = _frame_path(mode, shot, local)
        if r:
            return r
    return None


def _frame_path(mode, shot, local):
    d = f"/opt/work/renders/{mode}/{shot}"
    p = f"{d}/{local:04d}.png"
    if os.path.exists(p):
        return p
    files = sorted(glob.glob(f"{d}/*.png"))
    if not files:
        return None
    nums = [int(os.path.basename(f)[:4]) for f in files]
    best = min(range(len(nums)), key=lambda i: (abs(nums[i] - local), nums[i] > local))
    return files[best]


def main():
    mode = sys.argv[1]
    out = sys.argv[2]
    audio = sys.argv[3]
    caps = {}
    for t0, t1, txt in CAPTIONS:
        caps[txt] = caption_img(txt)
    mask = binocular_mask()
    wm = watermark_img()
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-shortest",
           "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    last_img = None
    for shot, a, b in SHOTS:
        for g in range(a, b):
            local = g - a + 1
            fp = frame_path(mode, shot, local)
            if fp is None:
                im = Image.new("RGB", (W, H), (40, 40, 40))
            else:
                im = Image.open(fp).convert("RGB")
                if im.size != (W, H):
                    im = im.resize((W, H), Image.LANCZOS)
            if shot in BINOC:
                arr = np.asarray(im, dtype=np.float32) * mask
                im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
            im = im.convert("RGBA")
            t = g / FPS
            for t0, t1, txt in CAPTIONS:
                if t0 <= t < t1:
                    c = caps[txt]
                    im.alpha_composite(c, (W // 2 - c.width // 2, int(H * 0.60) - c.height // 2))
                    break
            im.alpha_composite(wm, (W // 2 - wm.width // 2, int(H * 0.30) - wm.height // 2))
            p.stdin.write(im.convert("RGB").tobytes())
    p.stdin.close()
    p.wait()
    print("COMPOSED", out, TOTAL, "frames")


if __name__ == "__main__":
    main()
