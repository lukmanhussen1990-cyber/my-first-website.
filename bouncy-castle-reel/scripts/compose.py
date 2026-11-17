"""Composite rendered shots + captions + binocular mask + watermark, mux with audio.

python compose.py SRC_MODE OUT.mp4 AUDIO.wav [--preview]
SRC_MODE: final | preview | wb   (falls back to the nearest available frame of a shot)
"""
import os, sys, glob, subprocess, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
SHOTS = [
    ("S01a", 0, 28), ("S01b", 28, 63), ("S02", 63, 126), ("S03", 126, 190), ("S04a", 190, 213),
    ("S04b", 213, 257), ("S05", 257, 321), ("S06", 321, 342), ("S07a", 342, 369), ("S07b", 369, 395),
    ("S08a", 395, 439), ("S08b", 439, 452), ("S09", 452, 521), ("S10", 521, 549), ("S11", 549, 609),
    ("S12a", 609, 638), ("S12b", 638, 671), ("S13a", 671, 716), ("S13b", 716, 746),
]
BINOC = {"S01b", "S02", "S06", "S13b"}
TOTAL = SHOTS[-1][2]

# 1-3 word captions synced to the voiceover word timings (seconds)
CAPTIONS = [
    (0.00, 0.70, "You LOVE"), (0.70, 1.36, "your crush's"), (1.36, 2.18, "fat ass,"),
    (2.18, 2.78, "but you never"), (2.78, 3.30, "get to see"), (3.30, 4.30, "it bounce!"),
    (4.30, 4.84, "So you"), (4.84, 5.38, "blow up an"), (5.38, 6.46, "air mattress."),
    (6.46, 7.12, "Except it"), (7.12, 7.76, "pops under"), (7.76, 8.66, "her weight."),
    (8.66, 9.38, "So you add"), (9.38, 10.06, "a big air"), (10.06, 10.80, "pump."),
    (10.80, 11.50, "Clever!"),
    (11.50, 12.06, "But now she"), (12.06, 12.78, "bounces so"), (12.78, 13.18, "high,"),
    (13.18, 13.94, "she flies right"), (13.94, 14.30, "into the"), (14.30, 15.14, "fence."),
    (15.14, 15.80, "So you add"), (15.80, 16.50, "walls all"), (16.50, 17.48, "around."),
    (17.48, 18.46, "Genius!"),
    (18.46, 19.10, "Except she"), (19.10, 19.74, "still won't"), (19.74, 20.44, "jump."),
    (20.44, 20.86, "So you"), (20.86, 21.30, "hide her"), (21.30, 21.76, "phone in"), (21.76, 22.46, "the middle."),
    (22.46, 23.06, "You've invented"), (23.06, 24.90, "the bouncy castle!"),
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


_x = np.arange(256, dtype=np.float32) / 255.0
GRADE_LUT = np.clip(((_x ** 1.18) - 0.5) * 1.06 + 0.5, 0, 1)


def grade(im, sat=0.95):
    """mild grade to match the reference: darker mids, a touch more contrast, slightly calmer saturation"""
    a = GRADE_LUT[np.asarray(im)]
    l = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[..., None]
    a = l + (a - l) * sat
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def frame_path(modes, shot, local):
    for mode in modes.split(","):
        r = _frame_path(mode, shot, local)
        if r:
            return r
    return None


def _frame_path(mode, shot, local):
    d = f"/opt/work/bc/renders/{mode}/{shot}"
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
                im = grade(im)
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
