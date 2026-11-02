"""Composite the rendered 3D frames + captions + screen effects, then encode final.mp4 (1080x1920, 30 fps).
usage: python3 compose.py [out.mp4] [start_s end_s]
"""
import json, os, subprocess, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "shots.json")))
W_ = D["words"]
FPS, OW, OH = 30, 1080, 1920
FR = os.path.join(HERE, "out", "frames")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "final.mp4")
t_from = float(sys.argv[2]) if len(sys.argv) > 3 else 0.0
t_to = float(sys.argv[3]) if len(sys.argv) > 3 else D["duration"]
NF = int(round(D["duration"] * FPS))
SH = {s["id"]: s for s in D["shots"]}
eout = lambda u: 1 - (1 - min(1, max(0, u))) ** 3

# captions: same pixel font as the old reels, ligatures off
font = ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), 80)
font.set_variation_by_name("Bold")
FEAT = ["-liga", "-clig", "-dlig", "-calt"]
cap_cache = {}
def caption_img(text):
    if text in cap_cache: return cap_cache[text]
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if font.getlength(test, features=FEAT) > 960 and cur: lines.append(cur); cur = w
        else: cur = test
    lines.append(cur)
    img = Image.new("RGBA", (OW, 96 * len(lines) + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        w = font.getlength(ln, features=FEAT)
        d.text(((OW - w) / 2, 14 + i * 96), ln, font=font, fill="white", stroke_width=6, stroke_fill="black", features=FEAT)
    cap_cache[text] = img
    return img
CAP_Y = 1100

def zoom_shift(im, z, cx, cy, dx=0, dy=0):
    if abs(z - 1) < 1e-3 and dx == 0 and dy == 0: return im
    w, h = OW / z, OH / z
    x0 = min(max(cx - w / 2 + dx, 0), OW - w); y0 = min(max(cy - h / 2 + dy, 0), OH - h)
    return im.transform((OW, OH), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)
def shake(a, u, f=40):
    return a * math.sin(u * f) * math.cos(u * f * 0.71), a * math.sin(u * f * 1.13 + 1.3)

rng = np.random.default_rng(11)
yy, xx = np.mgrid[0:OH, 0:OW]
VIG = (1 - 0.6 * np.clip(((xx - OW / 2) / (OW * 0.6)) ** 2 + ((yy - OH / 2) / (OH * 0.6)) ** 2, 0, 1))[..., None].astype(np.float32)
def old_film(fr, t):
    a = np.asarray(fr).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    o = np.stack([0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b], -1)
    o = o * 0.9 * VIG * (0.93 + 0.07 * math.sin(t * 41) * math.sin(t * 13))
    o += rng.normal(0, 9, (OH // 3, OW // 3, 1)).repeat(3, 0).repeat(3, 1)
    im = Image.fromarray(np.clip(o, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im); rr = np.random.default_rng(int(t * FPS))
    for _ in range(rr.integers(0, 3)):
        x = int(rr.integers(0, OW)); d.line([(x, 0), (x + int(rr.integers(-20, 20)), OH)], fill=(235, 220, 190), width=int(rr.integers(1, 3)))
    for _ in range(rr.integers(2, 9)):
        x, y, s = int(rr.integers(0, OW)), int(rr.integers(0, OH)), int(rr.integers(2, 7)); d.ellipse([x, y, x + s, y + s], fill=(30, 22, 15))
    jit = int(rr.integers(-3, 4))
    return im.transform((OW, OH), Image.AFFINE, (1, 0, 0, 0, 1, jit), Image.BILINEAR) if jit else im

STING0 = W_[61]["s"] - 0.05
STING = [STING0 + h for h in (0.07, 0.39, 0.72)]
CLICK = W_[84]["e"] - 0.22
def effects(im, s, u, t):
    sid = s["id"]
    if sid == "03b":  # punch-in + shake on "pooped"
        z = 1 + 0.2 * eout(u / 0.1) - 0.06 * eout((u - 0.1) / 0.5)
        a = 24 * math.exp(-u * 5); dx, dy = shake(a, u, 61)
        im = zoom_shift(im, z, OW * 0.5, OH * 0.48, dx, dy)
    elif sid == "09":  # twitch jolts on each "fine"
        for i in (35, 37):
            k = t - W_[i]["s"]
            if 0 <= k < 0.25: dx, dy = shake(12 * (1 - k / 0.25), k, 90); im = zoom_shift(im, 1.03, OW / 2, OH / 2, dx, dy)
    elif sid == "11":
        dx, dy = shake(10, u, 47); im = zoom_shift(im, 1.04, OW / 2, OH / 2, dx, dy)
    elif sid == "16":  # dun dun DUN zoom hits
        z = 1.0
        for k, h in enumerate(STING):
            dt = t - h
            if dt >= 0: z += (0.03 + 0.02 * k) * math.exp(-dt * 7) + 0.02 * min(1, dt * 8)
        im = zoom_shift(im, z, OW / 2, OH * 0.45)
    elif sid == "19":
        dx, dy = shake(4, u, 70); im = zoom_shift(im, 1.02, OW / 2, OH / 2, dx, dy)
    elif sid == "21":
        k = t - CLICK
        if k >= 0: im = zoom_shift(im, 1 + 0.08 * math.exp(-k * 9), OW / 2, OH / 2)
    elif sid == "26":
        im = zoom_shift(im, 1.1 - 0.06 * eout(u / 0.3), OW / 2, OH / 2)
    elif sid == "34":  # BOOM
        z = 1.04 + 0.12 * math.exp(-u * 6); dx, dy = shake(28 * math.exp(-u * 5), u, 55)
        im = zoom_shift(im, z, OW / 2, OH * 0.5, dx, dy)
    if sid in ("23", "24", "25", "26", "27"):
        im = old_film(im, t)
    return im

def shot_at(t):
    for s in D["shots"]:
        if s["t0"] <= t < s["t1"]: return s
    return D["shots"][-1]

meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(HERE, "audio", "mix.wav"), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float([ln for ln in meas.splitlines() if ln.strip().startswith("I:")][-1].split()[1])
GAIN = -14.0 - I
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
       "-ss", str(t_from), "-t", str(t_to - t_from), "-i", os.path.join(HERE, "audio", "mix.wav"),
       "-af", f"volume={GAIN:.2f}dB,alimiter=limit=0.85:level=false", "-ar", "48000",
       "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
missing = 0
for f in range(int(t_from * FPS), min(NF, int(round(t_to * FPS)))):
    t = f / FPS; s = shot_at(t)
    path = os.path.join(FR, f"{f:05d}.jpg")
    if os.path.exists(path): im = Image.open(path).convert("RGB")
    else: missing += 1; im = Image.new("RGB", (OW, OH))
    im = effects(im, s, t - s["t0"], t)
    for c in D["captions"]:
        if c["t0"] <= t < c["t1"]:
            ci = caption_img(c["text"]); im.paste(ci, (0, CAP_Y - ci.height // 2), ci); break
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
print("wrote", out, "missing frames:", missing)
