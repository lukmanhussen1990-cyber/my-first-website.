"""Build final.mp4 from the user's images/clips: Ken Burns moves, punch-ins, shake, overlays, captions.
usage: python3 compose.py [out.mp4] [start_s end_s]
Images: images/<name>.(png|jpg|jpeg|webp)   Clips (optional): clips/<name>.mp4  (name = shots.json "image")
"""
import json, os, sys, math, subprocess, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "shots.json")))
W_ = D["words"]
FPS, OW, OH = 30, 1080, 1920
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "final.mp4")
t_from = float(sys.argv[2]) if len(sys.argv) > 3 else 0.0
t_to = float(sys.argv[3]) if len(sys.argv) > 3 else D["duration"]
SHOTS = D["shots"]
def ws(i): return W_[i]["s"]
def we(i): return W_[i]["e"]
ease = lambda u: (lambda v: v * v * (3 - 2 * v))(min(1, max(0, u)))
eout = lambda u: 1 - (1 - min(1, max(0, u))) ** 3

# ---------- per-shot camera moves: (z0, z1, (cx0, cy0), (cx1, cy1)) in source-relative coords ----------
C = (0.5, 0.5)
MOVE = {
    "01": (1.0, 1.08, C, C), "02": (1.14, 1.14, (0.42, 0.5), (0.58, 0.5)), "03a": (1.0, 1.04, C, C),
    "03b": (1.04, 1.04, C, C), "04": (1.12, 1.0, C, C), "05": (1.0, 1.08, C, C),
    "06": (1.12, 1.12, (0.57, 0.5), (0.43, 0.5)), "07": (1.0, 1.06, C, C), "08": (1.0, 1.07, C, C),
    "09": (1.0, 1.1, C, C), "10": (1.0, 1.08, C, C), "11": (1.06, 1.06, C, C), "12": (1.0, 1.15, C, C),
    "13": (1.0, 1.06, C, C), "14": (1.0, 1.05, C, C), "15": (1.02, 1.02, C, C), "16": (1.0, 1.25, C, C),
    "17": (1.0, 1.08, C, C), "18": (1.0, 1.06, C, C), "19": (1.0, 1.06, C, C), "20": (1.0, 1.06, C, C),
    "21": (1.0, 1.12, C, C), "22": (1.0, 1.1, C, C), "23": (1.0, 1.08, C, C), "24": (1.0, 1.08, C, C),
    "25": (1.12, 1.12, (0.44, 0.5), (0.56, 0.5)), "26": (1.0, 1.06, C, C), "27": (1.12, 1.0, C, C),
    "28": (1.0, 1.0, C, C), "29": (1.0, 1.07, C, C), "30": (1.0, 1.0, C, C), "31": (1.0, 1.1, C, C),
    "32": (1.0, 1.0, C, C), "33": (1.04, 1.04, C, C), "34": (1.04, 1.04, C, C), "35": (1.0, 1.08, C, C),
    "36": (1.02, 1.02, C, C), "37": (1.08, 1.08, (0.45, 0.5), (0.55, 0.5)), "38": (1.0, 1.08, C, C),
    "39": (1.25, 1.0, C, C),
}
# overlay anchors (fractions of the output frame); tuned once the real images arrive
CAL_PAGE = (0.5, 0.48, 0.62, 0.42)    # calendar page centre x, y, width, height
UNDERLINE = ((0.28, 0.56), (0.74, 0.55))
PAGE_TEXT = (0.5, 0.45)
SEPIA = {"23", "24", "25", "26", "27"}

# ---------- sources ----------
src_cache = {}
def src_image(name):
    if name in src_cache: return src_cache[name]
    fs = [f for e in ("png", "jpg", "jpeg", "webp") for f in glob.glob(os.path.join(HERE, "images", f"{name}.{e}"))]
    if fs:
        im = Image.open(fs[0]).convert("RGB")
    else:  # placeholder so the timing can be checked before the images exist
        im = Image.new("RGB", (1024, 1536), (60, 70, 80)); d = ImageDraw.Draw(im)
        d.text((60, 700), name, fill=(255, 255, 0), font=ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), 120))
    src_cache[name] = im
    return im
clip_cache = {}
def clip_frames(name):
    if name in clip_cache: return clip_cache[name]
    path = os.path.join(HERE, "clips", f"{name}.mp4")
    if not os.path.exists(path): clip_cache[name] = None; return None
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={FPS},scale={OW}:{OH}:force_original_aspect_ratio=increase,crop={OW}:{OH}",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, OH, OW, 3)
    clip_cache[name] = fr
    return fr
CLIP_OPTS = {"21": dict(speed=0.6)}  # slow motion wristband

def view(im, z, cx, cy, dx=0, dy=0, rot=0):
    """crop the source (cover-fit to 9:16) at zoom z around (cx, cy) and return a 1080x1920 frame"""
    sw, sh = im.size
    base_h = min(sh, sw * OH / OW); base_w = base_h * OW / OH
    w, h = base_w / z, base_h / z
    x0 = min(max(cx * sw - w / 2 + dx * w / OW, 0), sw - w); y0 = min(max(cy * sh - h / 2 + dy * h / OH, 0), sh - h)
    fr = im.transform((OW, OH), Image.EXTENT, (x0, y0, x0 + w, y0 + h), Image.BICUBIC)
    if rot:  # wobble: rotate, then zoom a little so no black corners show
        m = 1 + abs(math.radians(rot)) * 1.2
        fr = fr.rotate(rot, Image.BICUBIC, center=(OW / 2, OH * 0.85))
        cw, ch = OW / m, OH / m
        fr = fr.transform((OW, OH), Image.EXTENT, ((OW - cw) / 2, (OH - ch) * 0.85, (OW + cw) / 2, (OH - ch) * 0.85 + ch), Image.BICUBIC)
    return fr

# ---------- fonts / overlays ----------
cap_font = ImageFont.truetype(os.path.join(HERE, "fonts", "PixelifySans.ttf"), 80); cap_font.set_variation_by_name("Bold")
FEAT = ["-liga", "-clig", "-dlig", "-calt"]
hand_font = ImageFont.truetype(os.path.join(HERE, "fonts", "Caveat.ttf"), 124)
try: hand_font.set_variation_by_name("Bold")
except Exception: pass
marker = ImageFont.truetype(os.path.join(HERE, "fonts", "PermanentMarker.ttf"), 150)
cap_cache = {}
def caption_img(text):
    if text in cap_cache: return cap_cache[text]
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if cap_font.getlength(test, features=FEAT) > 960 and cur: lines.append(cur); cur = w
        else: cur = test
    lines.append(cur)
    img = Image.new("RGBA", (OW, 96 * len(lines) + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        w = cap_font.getlength(ln, features=FEAT)
        d.text(((OW - w) / 2, 14 + i * 96), ln, font=cap_font, fill="white", stroke_width=6, stroke_fill="black", features=FEAT)
    cap_cache[text] = img
    return img
CAP_Y = 1100

rng = np.random.default_rng(11)
yy, xx = np.mgrid[0:OH, 0:OW]
VIG = (1 - 0.6 * np.clip(((xx - OW / 2) / (OW * 0.6)) ** 2 + ((yy - OH / 2) / (OH * 0.6)) ** 2, 0, 1))[..., None].astype(np.float32)
def old_film(fr, t):
    a = np.asarray(fr).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    o = np.stack([0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b], -1)
    o = o * 0.92 * VIG * (0.93 + 0.07 * math.sin(t * 41) * math.sin(t * 13))
    o += rng.normal(0, 9, (OH // 3, OW // 3, 1)).repeat(3, 0).repeat(3, 1)
    im = Image.fromarray(np.clip(o, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im); fr_n = int(t * FPS)
    rr = np.random.default_rng(fr_n)
    for _ in range(rr.integers(0, 3)):  # scratches
        x = rr.integers(0, OW); d.line([(x, 0), (x + rr.integers(-20, 20), OH)], fill=(235, 220, 190), width=int(rr.integers(1, 3)))
    for _ in range(rr.integers(2, 9)):  # dust
        x, y, s = rr.integers(0, OW), rr.integers(0, OH), rr.integers(2, 7)
        d.ellipse([x, y, x + s, y + s], fill=(30, 22, 15))
    jit = int(rr.integers(-3, 4))
    return im.transform((OW, OH), Image.AFFINE, (1, 0, 0, 0, 1, jit), Image.BILINEAR) if jit else im

def draw_calendar(fr, u, t, week):
    cx, cy, pw, ph = CAL_PAGE
    px, py, w, h = int((cx - pw / 2) * OW), int((cy - ph / 2) * OH), int(pw * OW), int(ph * OH)
    page = fr.crop((px, py, px + w, py + h))
    base = fr.copy(); d = ImageDraw.Draw(base)
    txt = f"WEEK {week}"
    tw = marker.getlength(txt)
    d.text((cx * OW - tw / 2, cy * OH - 105), txt, font=marker, fill=(200, 40, 40))
    # earlier pages fly off at the start of the shot (blank pages = time passing)
    n_fly = 3 if week > 1 else 2
    for k in range(n_fly):
        a = (t - k * 0.09) / 0.32
        if a >= 1: continue
        pg = page.copy(); pd = ImageDraw.Draw(pg)
        if k == 0 and week > 1:
            pt = f"WEEK {week - 1}"; pd.text((w / 2 - marker.getlength(pt) / 2, h / 2 - 105), pt, font=marker, fill=(200, 40, 40))
        a = max(0.0, a)
        rot = (25 + 15 * k) * eout(a) * (1 if k % 2 == 0 else -1)
        pg = pg.convert("RGBA").rotate(rot, Image.BICUBIC, expand=True)
        ox = px + (w - pg.width) / 2 + (OW * 0.9 * (1 if k % 2 == 0 else -1)) * eout(a)
        oy = py + (h - pg.height) / 2 - OH * 0.55 * eout(a)
        base.paste(pg, (int(ox), int(oy)), pg)
    return base

page_cache = {}
def page_with_text(fr, k):
    key = k
    if key in page_cache: return page_cache[key]
    im = fr.copy(); lay = Image.new("RGBA", (OW, OH), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    lines = ["Patient talks", "about poop", "a lot."]
    x0, y0 = PAGE_TEXT[0] * OW - 360, PAGE_TEXT[1] * OH - 260
    for i, ln in enumerate(lines):
        d.text((x0 + (k * 7 % 13) + i * 6, y0 + i * 140), ln, font=hand_font, fill=(25, 45, 120, 235))
    if k % 2 == 0: d.line([(x0, y0 + 2 * 140 + 120), (x0 + 420, y0 + 2 * 140 + 112)], fill=(25, 45, 120, 220), width=6)
    lay = lay.rotate(-4 + k * 1.7, Image.BICUBIC, center=(OW / 2, OH / 2))
    im.paste(lay, (0, 0), lay); page_cache[key] = im
    return im

# ---------- the frame function ----------
def shake(amp, t, f=37):
    return amp * math.sin(t * f) * math.cos(t * f * 0.73), amp * math.sin(t * f * 1.17 + 1)

def frame_for(s, u, t):
    sid, dur = s["id"], s["dur"]
    z0, z1, c0, c1 = MOVE[sid]
    p = ease(u / dur)
    z = z0 + (z1 - z0) * p; cx = c0[0] + (c1[0] - c0[0]) * p; cy = c0[1] + (c1[1] - c0[1]) * p
    dx = dy = 0; rot = 0
    tg = s["t0"] + u
    if sid == "03b":
        z = 1.04 + 0.18 * eout(u / 0.12) - 0.05 * eout((u - 0.12) / 0.4)
        a = 24 * math.exp(-u * 5); dx, dy = shake(a, u, 61)
    elif sid == "09":
        for i in (35, 37):
            k = tg - ws(i)
            if 0 <= k < 0.25: dx, dy = shake(14 * (1 - k / 0.25), k, 90)
    elif sid == "11":
        dx, dy = shake(9, u, 47)
    elif sid == "16":
        z = 1.0 + 0.25 * (ease(u / dur) ** 1.6)
        for hit in (0.0, 0.35, 0.75):
            k = tg - (ws(61) - 0.05 + hit)
            if 0 <= k < 0.18: z += 0.04 * (1 - k / 0.18)
    elif sid == "19":
        dx, dy = shake(4, u, 70)
    elif sid == "21":
        k = tg - (we(84) - 0.2)
        if k >= 0: z += 0.08 * math.exp(-k * 9)
    elif sid == "26":
        z = 1.12 - 0.06 * eout(u / 0.3)
    elif sid == "33":
        rot = 2.2 * math.sin(u * 7)
    elif sid == "34":
        z = 1.04 + 0.12 * math.exp(-u * 6); dx, dy = shake(30 * math.exp(-u * 5), u, 55)
    name = s["image"]
    cf = clip_frames(name)
    if cf is not None and len(cf):
        sp = CLIP_OPTS.get(sid, {}).get("speed", 1.0)
        fi = min(len(cf) - 1, int(u * sp * FPS))
        im = Image.fromarray(cf[fi])
    else:
        im = src_image(name)
    fr = view(im, z, cx, cy, dx, dy, rot)
    if sid in ("28", "30", "32"):
        fr = draw_calendar(fr, u, u, {"28": 1, "30": 2, "32": 3}[sid])
    if sid == "14":
        k = (tg - (ws(53) + 0.05)) / 0.35
        if k > 0:
            (ax, ay), (bx, by) = UNDERLINE
            ex = ax + (bx - ax) * min(1, k); ey = ay + (by - ay) * min(1, k)
            d = ImageDraw.Draw(fr)
            d.line([(ax * OW, ay * OH), (ex * OW, ey * OH)], fill=(25, 45, 120), width=12)
            if k > 1.3:
                k2 = min(1, (k - 1.3) / 1.0)
                d.line([(ax * OW, ay * OH + 26), ((ax + (bx - ax) * k2) * OW, (ay + (by - ay) * k2) * OH + 26)], fill=(25, 45, 120), width=10)
    if sid == "36":
        flip = 0.42; k = int(u / flip); a = (u - k * flip) / 0.12
        cur = page_with_text(fr, k)
        if k > 0 and a < 1:  # new page slides in over the previous one
            prev = page_with_text(fr, k - 1)
            off = int(OW * (1 - eout(a)))
            prev.paste(cur.crop((0, 0, OW - off, OH)), (off, 0))
            cur = prev
        fr = cur
    if sid in SEPIA:
        fr = old_film(fr, tg)
    return fr

def shot_at(t):
    for s in SHOTS:
        if s["t0"] <= t < s["t1"]: return s
    return SHOTS[-1]

meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(HERE, "audio", "mix.wav"), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float([ln for ln in meas.splitlines() if ln.strip().startswith("I:")][-1].split()[1])
GAIN = -14.0 - I
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
       "-ss", str(t_from), "-t", str(t_to - t_from), "-i", os.path.join(HERE, "audio", "mix.wav"),
       "-af", f"volume={GAIN:.2f}dB,alimiter=limit=0.85:level=false", "-ar", "48000",
       "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
pp = subprocess.Popen(cmd, stdin=subprocess.PIPE)
NF = int(round(D["duration"] * FPS))
for f in range(int(t_from * FPS), min(NF, int(round(t_to * FPS)))):
    t = f / FPS; s = shot_at(t)
    fr = frame_for(s, t - s["t0"], t).convert("RGB")
    for c in D["captions"]:
        if c["t0"] <= t < c["t1"]:
            ci = caption_img(c["text"]); fr.paste(ci, (0, CAP_Y - ci.height // 2), ci); break
    pp.stdin.write(fr.tobytes())
pp.stdin.close(); pp.wait()
print("wrote", out)
