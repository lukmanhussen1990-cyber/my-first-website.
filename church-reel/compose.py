"""Join rendered frames + captions + effects + soundtrack into the reel.
usage: python3 compose.py            -> church_poop_reel.mp4 (1080x1920, full quality)
       python3 compose.py --preview  -> preview_low.mp4 (540x960, fast)
"""
import json, os, subprocess, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = "--preview" in sys.argv
K = 0.5 if PREVIEW else 1.0
OW, OH, FPS = int(1080 * K), int(1920 * K), 30
FR = os.path.join(HERE, "out", "frames_preview" if PREVIEW else "frames")
OUT = os.path.join(HERE, "preview_low.mp4" if PREVIEW else "church_poop_reel.mp4")
D = json.load(open(os.path.join(HERE, "shots.json")))
W = D["words"]; DUR = D["duration"]
NF = int(round(DUR * FPS))
eout = lambda u: 1 - (1 - min(1, max(0, u))) ** 3

font = ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), int(82 * K)); font.set_variation_by_name("Bold")
big = ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), int(122 * K)); big.set_variation_by_name("Bold")
FEAT = ["-liga", "-clig", "-dlig", "-calt"]
cache = {}
def caption(text, loud):
    key = (text, loud)
    if key in cache: return cache[key]
    f = big if loud else font; sw = int((9 if loud else 6) * K)
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if f.getlength(test, features=FEAT) > OW * 0.88 and cur: lines.append(cur); cur = w
        else: cur = test
    lines.append(cur)
    lh = int(f.size * 1.2)
    img = Image.new("RGBA", (OW, lh * len(lines) + int(40 * K)), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        w = f.getlength(ln, features=FEAT)
        d.text(((OW - w) / 2, int(14 * K) + i * lh), ln, font=f, fill="white", stroke_width=sw, stroke_fill="black", features=FEAT)
    cache[key] = img
    return img

def burrito_sprite():  # pixel-art burrito icon
    px = ["......aaaaaaaaaaaa......", "....aabbbbbbbbbbbbaa....", "...abbbbcbbbbbbcbbbba...", "..abbcbbbbbbcbbbbbbbrta.",
          ".abbbbbbbcbbbbbbbcbbgwa.", "abbbbcbbbbbbbbcbbbbbwrta", "abbbbbbbbcbbbbbbbbbbgwba", "abbcbbbbbbbbbcbbbbbbwrta",
          ".abbbbbcbbbbbbbbbcbbgwa.", "..abbbbbbbbcbbbbbbbbrta.", "...abbcbbbbbbbbcbbbba...", "....aabbbbbbbbbbbbaa....",
          "......aaaaaaaaaaaa......"]
    cols = {"a": (120, 76, 32), "b": (236, 196, 120), "c": (206, 160, 90), "r": (226, 64, 52), "t": (120, 70, 40), "g": (90, 180, 70), "w": (250, 248, 236)}
    s = 16; im = Image.new("RGBA", (len(px[0]) * s, len(px) * s), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y, row in enumerate(px):
        for x, ch in enumerate(row):
            if ch in cols: d.rectangle([x * s, y * s, x * s + s - 1, y * s + s - 1], fill=cols[ch] + (255,))
    out = Image.new("RGBA", (im.width + 24, im.height + 24), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 255)); sh.putalpha(im.split()[3])
    out.paste(sh, (12, 18), sh); out.paste(im, (12, 12), im)
    return out
BURRITO = burrito_sprite()
B_T = W[116]["s"] - 0.05

def zoom(im, z, cx, cy, dx=0, dy=0):
    if abs(z - 1) < 1e-3 and dx == 0 and dy == 0: return im
    w, h = OW / z, OH / z
    x0 = min(max(cx - w / 2 + dx * K, 0), OW - w); y0 = min(max(cy - h / 2 + dy * K, 0), OH - h)
    return im.transform((OW, OH), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)
def shake(a, u, f=45): return a * math.sin(u * f) * math.cos(u * f * 0.7), a * math.sin(u * f * 1.13 + 1)

def effects(im, sid, u, t):
    if sid == "02":   # freeze frame + quick zoom
        z = 1 + 0.22 * eout(u / 0.18); dx, dy = shake(14 * math.exp(-u * 6), u, 60)
        im = zoom(im, z, OW / 2, OH * 0.42, dx, dy)
    elif sid == "13":  # frozen like a statue
        a = np.asarray(im).astype(np.float32); g = a.mean(2, keepdims=True)
        a = a * 0.25 + g * np.array([0.78, 0.8, 0.85]) * 0.9
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    elif sid == "18":
        dx, dy = shake(5, u, 70); im = zoom(im, 1.02, OW / 2, OH / 2, dx, dy)
    elif sid == "20":   # EWWW
        dx, dy = shake(16 * math.exp(-u * 2.5), u, 55); im = zoom(im, 1.05, OW / 2, OH / 2, dx, dy)
    elif sid == "26":   # pointing: small shake on "did that"
        k = t - W[78]["s"]
        if 0 <= k < 0.5: dx, dy = shake(10 * (1 - k / 0.5), k, 60); im = zoom(im, 1.03, OW / 2, OH / 2, dx, dy)
    elif sid in ("35", "36"):  # mom says it out loud
        dx, dy = shake(12, u, 52); im = zoom(im, 1.05, OW / 2, OH / 2, dx, dy)
    elif sid == "37":
        dx, dy = shake(10 * math.exp(-u * 3), u, 50); im = zoom(im, 1.04, OW / 2, OH / 2, dx, dy)
    if t >= B_T and sid in ("37", "38"):   # burrito icon pops up
        k = t - B_T; s = (1.25 * eout(k / 0.14) if k < 0.14 else 1 + 0.25 * math.exp(-(k - 0.14) * 10) * math.cos((k - 0.14) * 30)) * K
        b = BURRITO.resize((max(1, int(BURRITO.width * s)), max(1, int(BURRITO.height * s))), Image.NEAREST)
        cx, cy = OW * 0.5, OH * 0.28 - 20 * K * math.sin(k * 6)
        im.paste(b, (int(cx - b.width / 2), int(cy - b.height / 2)), b)
    if t > DUR - 0.45:  # fade out
        a = (t - (DUR - 0.45)) / 0.45
        im = Image.blend(im, Image.new("RGB", (OW, OH)), min(1, a))
    return im

def shot_at(t):
    for s in D["shots"]:
        if s["t0"] <= t < s["t1"]: return s
    return D["shots"][-1]

cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
       "-i", os.path.join(HERE, "audio", "mix.wav"), "-t", f"{DUR:.3f}",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
cmd += (["-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-b:a", "96k"] if PREVIEW else
        ["-preset", "slow", "-crf", "20", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k"])
cmd += [OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
missing = 0
for f in range(NF):
    t = f / FPS; s = shot_at(t)
    path = os.path.join(FR, f"{f:05d}.jpg")
    if os.path.exists(path): im = Image.open(path).convert("RGB")
    else: missing += 1; im = Image.new("RGB", (OW, OH))
    if im.size != (OW, OH): im = im.resize((OW, OH), Image.BICUBIC)
    im = effects(im, s["id"], t - s["t0"], t)
    for c in D["captions"]:
        if c["t0"] <= t < c["t1"]:
            ci = caption(c["text"], c["loud"]); dx = dy = 0
            if c["loud"]: dx, dy = shake(7 * K, t, 60)
            im.paste(ci, (int(dx), int(OH / 2 - ci.height / 2 + dy)), ci); break
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
print("wrote", OUT, "frames", NF, "missing", missing)
