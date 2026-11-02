"""Composite rendered frames + captions + screen effects, then encode final.mp4 (1080x1920, 30 fps).
usage: python compose.py [out.mp4] [start_s end_s]
"""
import json, os, subprocess, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "shots.json")))
FPS, Wd, Ht = 30, 1080, 1920
FR = os.path.join(HERE, "out", "frames")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "final.mp4")
t_from = float(sys.argv[2]) if len(sys.argv) > 3 else 0.0
t_to = float(sys.argv[3]) if len(sys.argv) > 3 else D["duration"]
NF = int(round(D["duration"] * FPS))

# ---------- captions (same pixel font as the old reels: Pixelify Sans Bold) ----------
font = ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), 80)
font.set_variation_by_name("Bold")
FEAT = ["-liga", "-clig", "-dlig", "-calt"]  # no ligatures ("fi" was turning into "A" in the old reels)
cap_cache = {}
def caption_img(text):
    if text in cap_cache: return cap_cache[text]
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if font.getlength(test, features=FEAT) > 960 and cur: lines.append(cur); cur = w
        else: cur = test
    lines.append(cur)
    lh = 96
    img = Image.new("RGBA", (Wd, lh * len(lines) + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        w = font.getlength(ln, features=FEAT)
        d.text(((Wd - w) / 2, 14 + i * lh), ln, font=font, fill=(255, 255, 255, 255), stroke_width=6, stroke_fill=(0, 0, 0, 255), features=FEAT)
    cap_cache[text] = img
    return img
CAP_Y = 1100  # caption centre (matches the reference reels)

def shot_at(t):
    for s in D["shots"]:
        if s["t0"] <= t < s["t1"]: return s
    return D["shots"][-1]
W_ = D["words"]

def zoom_shift(im, z, cx, cy, dx=0, dy=0):
    if abs(z - 1) < 1e-3 and dx == 0 and dy == 0: return im
    w, h = Wd / z, Ht / z
    x0 = min(max(cx - w / 2 + dx, 0), Wd - w); y0 = min(max(cy - h / 2 + dy, 0), Ht - h)
    return im.transform((Wd, Ht), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)

rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:Ht, 0:Wd]
VIG = 1 - 0.55 * np.clip(((xx - Wd / 2) / (Wd * 0.62)) ** 2 + ((yy - Ht / 2) / (Ht * 0.62)) ** 2, 0, 1)
VIG = VIG[..., None].astype(np.float32)
def sepia(im, t):
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sep = np.stack([0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b], -1)
    keep = np.clip((r - np.maximum(g, b) - 60) / 60, 0, 1)[..., None]  # keep the glowing red vein + heart
    o = sep * (1 - keep) + a * keep
    o = o * VIG * (0.97 + 0.03 * math.sin(t * 37))
    o += rng.normal(0, 7, (Ht // 4, Wd // 4, 1)).repeat(4, 0).repeat(4, 1)
    return Image.fromarray(np.clip(o, 0, 255).astype(np.uint8))

def effects(im, s, u, t):
    sid = s["id"]
    if sid == "04b":  # punch-in + shake on "pooped"
        z = 1 + 0.24 * (1 - (1 - min(u / 0.09, 1)) ** 3)
        if u > 0.09: z = 1.13 + 0.11 * math.exp(-(u - 0.09) * 5)
        a = 26 * math.exp(-u * 5)
        im = zoom_shift(im, z, Wd * 0.42, Ht * 0.45, rng.uniform(-a, a), rng.uniform(-a, a))
    elif sid == "07":  # shaking voice
        im = zoom_shift(im, 1.03, Wd / 2, Ht / 2, rng.uniform(-7, 7), rng.uniform(-7, 7))
    elif sid == "14":  # camera clicks: flash + small punch
        flash, punch = 0.0, 0.0
        for i in (46, 47, 48):
            c = W_[i]["s"] - 0.03 - s["t0"]
            if u >= c:
                flash = max(flash, 0.97 * math.exp(-(u - c) / 0.075))
                punch = max(punch, 0.06 * math.exp(-(u - c) / 0.12))
        im = zoom_shift(im, 1 + punch, Wd / 2, Ht * 0.45)
        if flash > 0.01: im = Image.blend(im, Image.new("RGB", (Wd, Ht), (255, 255, 255)), flash)
    elif sid == "19":  # freeze moment: tiny jolt
        if u < 0.12: im = zoom_shift(im, 1.05 - 0.4 * u, Wd / 2, Ht * 0.45)
    elif sid in ("24", "25"):
        im = sepia(im, t)
    elif sid == "31":  # reveal: quick zoom-out settle
        z = 1 + 0.08 * math.exp(-u * 4)
        im = zoom_shift(im, z, Wd / 2, Ht * 0.45)
    return im

# static loudness gain to about -14 LUFS (no pumping in the long silent pause) + peak limiter
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(HERE, "audio", "mix.wav"), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float([ln for ln in meas.splitlines() if ln.strip().startswith("I:")][-1].split()[1])
GAIN = -14.0 - I
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{Wd}x{Ht}", "-r", str(FPS), "-i", "-",
       "-ss", str(t_from), "-t", str(t_to - t_from), "-i", os.path.join(HERE, "audio", "mix.wav"),
       "-af", f"volume={GAIN:.2f}dB,alimiter=limit=0.85:level=false", "-ar", "48000",
       "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for f in range(int(t_from * FPS), min(NF, int(round(t_to * FPS)))):
    t = f / FPS
    s = shot_at(t)
    path = os.path.join(FR, f"{f:05d}.jpg")
    if not os.path.exists(path):
        print("missing frame", f); im = Image.new("RGB", (Wd, Ht))
    else:
        im = Image.open(path).convert("RGB")
    im = effects(im, s, t - s["t0"], t)
    for c in D["captions"]:
        if c["t0"] <= t < c["t1"]:
            ci = caption_img(c["text"])
            im.paste(ci, (0, CAP_Y - ci.height // 2), ci)
            break
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
print("wrote", out)
