"""Finishing pass: rendered shot frames -> graded, titled 1920x1080 H.264 with the soundtrack.

python3 post/composite.py [--out PATH] [--range a-b] [--only NN] [--preview] [--stills 100,500,...]

--stills writes PNGs of the given global frames to $SCRATCH/tests/post/ instead of encoding.
Missing frames fall back to the nearest rendered frame of that shot, then to a placeholder.
"""
import argparse
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(ROOT, "assets", "fonts")
SCRATCH = os.environ.get(
    "COKE_SCRATCH",
    "/tmp/claude-0/-home-user-my-first-website-/0735c37f-ff6b-57d4-b08a-d20fb3844685/scratchpad")
RENDERS = os.path.join(SCRATCH, "renders")
W, H, FPS, TOTAL = 1920, 1080, 24, 960

# (shot id, first global frame, frame count)
SHOTS = [("01", 0, 96), ("02", 96, 96), ("03", 192, 96), ("04", 288, 168), ("05", 456, 120),
         ("06", 576, 120), ("07", 696, 144), ("08", 840, 120)]
GRADE = {  # exposure (stops), contrast, saturation, warmth, lift
    "01": dict(exp=0.10, con=1.06, sat=1.04, warm=0.00, lift=0.000),
    "02": dict(exp=0.05, con=1.05, sat=1.08, warm=0.01, lift=0.000),
    "03": dict(exp=0.00, con=1.05, sat=1.05, warm=0.00, lift=0.000),
    "04": dict(exp=0.05, con=1.06, sat=1.06, warm=0.01, lift=0.000),
    "05": dict(exp=0.05, con=1.06, sat=1.06, warm=0.015, lift=0.000),
    "06": dict(exp=0.00, con=1.06, sat=1.06, warm=0.01, lift=0.000),
    "07": dict(exp=0.05, con=1.06, sat=1.05, warm=0.00, lift=0.000),
    "08": dict(exp=0.00, con=1.03, sat=1.04, warm=0.00, lift=0.000),
}


def smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ease_out(t, p=3.0):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** p


# ------------------------------------------------------------------ frame sources
def shot_of(g):
    for sid, start, n in SHOTS:
        if start <= g < start + n:
            return sid, g - start + 1, n
    raise ValueError(g)


def load_frame(sid, local, renders=RENDERS):
    d = os.path.join(renders, f"shot{sid}")
    p = os.path.join(d, f"{local:04d}.png")
    if not os.path.exists(p) and os.path.isdir(d):
        have = sorted(int(f[:4]) for f in os.listdir(d) if f[:4].isdigit() and f.endswith(".png") and "tmp" not in f)
        if have:
            near = min(have, key=lambda v: abs(v - local))
            p = os.path.join(d, f"{near:04d}.png")
    if os.path.exists(p):
        img = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        img = img[..., ::-1].astype(np.float32) / (65535.0 if img.dtype == np.uint16 else 255.0)
        return img
    ph = np.full((H // 2, W // 2, 3), 0.08, np.float32)
    cv2.putText(ph, f"shot {sid} / {local}", (40, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0.6, 0.6, 0.6), 3)
    return ph


def to_hd(img, zoom=1.0, center=(0.5, 0.5)):
    h, w = img.shape[:2]
    s = W / w * zoom
    cx, cy = center[0] * w, center[1] * h
    M = np.array([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]], np.float32)
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
    if s > 1.05:  # recover a little crispness after upscaling
        out = out + 0.32 * (out - cv2.GaussianBlur(out, (0, 0), 1.1 * s / 1.5))
    return out


# ------------------------------------------------------------------ look
def grade(img, p):
    img = img * (2.0 ** p["exp"])
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    img = lum[..., None] + (img - lum[..., None]) * p["sat"]
    img = img * np.array([1 + p["warm"], 1.0, 1 - p["warm"]], np.float32)
    x = np.clip(img, 0, None)
    # gentle filmic S-curve around mid grey
    c = p["con"]
    img = np.where(x < 0.5, 0.5 * (2 * x) ** c, 1 - 0.5 * (2 * np.clip(1 - x, 0, None)) ** c)
    return img + p["lift"] * (1 - img)


def bloom(img, strength=1.0):
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    k = np.clip((lum - 0.68) / 0.32, 0, 1) ** 2
    hi = img * k[..., None]
    small = cv2.resize(hi, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    b1 = cv2.resize(cv2.GaussianBlur(small, (0, 0), 1.5), (W, H))
    b2 = cv2.resize(cv2.GaussianBlur(small, (0, 0), 5.0), (W, H))
    b3 = cv2.resize(cv2.GaussianBlur(small, (0, 0), 14.0), (W, H))
    halation = np.array([1.0, 0.42, 0.30], np.float32)
    return img + strength * (0.10 * b1 + 0.08 * b2 + 0.07 * b3 * halation)


_VIG = None


def vignette(img, amount=0.2):
    global _VIG
    if _VIG is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) / math.sqrt(2)
        _VIG = (1 - amount * r ** 2.3).astype(np.float32)
    return img * _VIG[..., None]


def chroma_ab(img, amt=0.0007):
    out = img.copy()
    for c, s in ((0, 1 + amt), (2, 1 - amt)):
        M = np.array([[s, 0, W / 2 * (1 - s)], [0, s, H / 2 * (1 - s)]], np.float32)
        out[..., c] = cv2.warpAffine(img[..., c], M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out


def grain(img, g, amount=1.0):
    rng = np.random.default_rng(1000 + g)
    n = rng.standard_normal((H, W)).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), 0.65)
    lum = np.clip(img @ np.array([0.2126, 0.7152, 0.0722], np.float32), 0, 1)
    amp = (0.030 * np.sqrt(np.maximum(lum, 0.015) * (1 - lum)) + 0.0035) * amount
    chroma = rng.standard_normal((H // 2, W // 2, 3)).astype(np.float32)
    chroma = cv2.resize(cv2.GaussianBlur(chroma, (0, 0), 0.8), (W, H)) * 0.25
    return img + (n[..., None] + chroma) * amp[..., None]


# ------------------------------------------------------------------ typography
def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), int(size))


def tracked_text(text, fnt, tracking_px, fill=255, stroke=0, pad=40, ss=2):
    """Render letter-spaced text into an 'L' sprite (supersampled). Returns (PIL image at 1x, width, height)."""
    f = fnt
    widths = []
    for ch in text:
        bb = f.getbbox(ch, stroke_width=stroke)
        adv = f.getlength(ch)
        widths.append(adv)
    total = sum(widths) + tracking_px * ss * (len(text) - 1)
    asc, desc = f.getmetrics()
    img = Image.new("L", (int(total + 2 * pad * ss), int(asc + desc + 2 * pad * ss)), 0)
    d = ImageDraw.Draw(img)
    x = pad * ss
    for ch, wch in zip(text, widths):
        d.text((x, pad * ss), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=fill)
        x += wch + tracking_px * ss
    img = img.resize((img.width // ss, img.height // ss), Image.LANCZOS)
    return img


_SPRITES = {}


def super_layer(text, t, t_in, t_out, y_frac=0.80, size=58, track0=0.20, track1=0.34, x_frac=0.5, align="center"):
    """Lower-third super with fade, drift and tracking animation. Returns (alpha HxW float, shadow alpha)."""
    if t < t_in - 0.01 or t > t_out + 0.01:
        return None
    a_in = ease_out((t - t_in) / 0.55)
    a_out = 1 - smooth(t_out - 0.45, t_out, t)
    alpha = a_in * a_out
    prog = (t - t_in) / (t_out - t_in)
    track = size * (track0 + (track1 - track0) * ease_out(prog, 2.0))
    ss = 2
    spr = tracked_text(text, font("montserrat-600-normal.ttf", size * ss), track, ss=ss)
    arr = np.asarray(spr, np.float32) / 255.0
    if align == "right":
        x0 = int(W * x_frac - spr.width + 40)  # sprite carries 40 px of padding
    else:
        x0 = int(W * x_frac - spr.width / 2)
    lay = paste(np.zeros((H, W), np.float32), arr, x0, int(H * y_frac - spr.height / 2 + 14 * (1 - a_in)))
    shadow = cv2.GaussianBlur(np.roll(lay, 3, axis=0), (0, 0), 7) * 0.55
    return lay * alpha, shadow * alpha


def paste(lay, a, x0, y0):
    """Add sprite a into layer lay at top-left (x0, y0), clipping at the frame edges."""
    hh, ww = a.shape
    ys, xs = max(0, y0), max(0, x0)
    ye, xe = min(H, y0 + hh), min(W, x0 + ww)
    if ye > ys and xe > xs:
        lay[ys:ye, xs:xe] = np.maximum(lay[ys:ye, xs:xe], a[ys - y0:ye - y0, xs - x0:xe - x0])
    return lay


def endcard_layers(t):
    """Wordmark wipe-on + tagline + disclaimer. Returns list of (alpha, color, glow?)."""
    layers = []
    if t < 35.2:
        return layers
    key = "wordmark"
    if key not in _SPRITES:
        size = 205
        f = font("great-vibes-400-normal.ttf", size * 2)
        img = Image.new("L", (1400 * 2, 520 * 2), 0)
        d = ImageDraw.Draw(img)
        bb = d.textbbox((0, 0), "Coca-Cola", font=f, stroke_width=5)
        d.text(((img.width - (bb[2] - bb[0])) / 2 - bb[0], (img.height - (bb[3] - bb[1])) / 2 - bb[1]), "Coca-Cola",
               font=f, fill=255, stroke_width=5, stroke_fill=255)
        img = img.resize((1400, 520), Image.LANCZOS)
        arr = np.asarray(img, np.float32) / 255.0
        ys, xs = np.where(arr > 0.01)
        arr = arr[max(0, ys.min() - 40):ys.max() + 40, max(0, xs.min() - 40):xs.max() + 40]
        _SPRITES[key] = arr
        tag = tracked_text("FEEL THE FIZZ.", font("montserrat-600-normal.ttf", 42 * 2), 42 * 0.24, ss=2)
        _SPRITES["tag"] = np.asarray(tag, np.float32) / 255.0
        disc = tracked_text("Fan-made spec ad. Not affiliated with or endorsed by The Coca-Cola Company.",
                            font("montserrat-400-normal.ttf", 19 * 2), 19 * 0.04, ss=2)
        _SPRITES["disc"] = np.asarray(disc, np.float32) / 255.0
    wm = _SPRITES["wordmark"]
    cx, cy = int(W * 0.315), int(H * 0.43)
    # writing wipe: soft edge sweeping left -> right
    p = ease_out((t - 35.3) / 1.05, 2.2)
    hh, ww = wm.shape
    xs = np.arange(ww, dtype=np.float32)
    edge = p * (ww + 160) - 80
    wipe = np.clip((edge - xs) / 80.0, 0, 1)[None, :]
    scale = 0.965 + 0.035 * ease_out((t - 35.3) / 2.5)
    a = wm * wipe
    a = cv2.resize(a, (int(ww * scale), int(hh * scale)), interpolation=cv2.INTER_LINEAR)
    lay = paste(np.zeros((H, W), np.float32), a, cx - a.shape[1] // 2, cy - a.shape[0] // 2)
    glow = cv2.GaussianBlur(lay, (0, 0), 14) * 0.5 * (0.6 + 0.4 * math.exp(-max(0, t - 36.4) / 0.6))
    layers.append((lay, (1.0, 1.0, 1.0), glow))
    # tagline
    ta = ease_out((t - 36.2) / 0.7)
    if ta > 0:
        tg = _SPRITES["tag"]
        lay = paste(np.zeros((H, W), np.float32), tg * ta, int(cx - tg.shape[1] / 2),
                    int(H * 0.585 - tg.shape[0] / 2 + 12 * (1 - ta)))
        layers.append((lay, (1.0, 1.0, 1.0), None))
    da = ease_out((t - 36.6) / 0.8)
    if da > 0:
        dg = _SPRITES["disc"]
        lay = paste(np.zeros((H, W), np.float32), dg * da * 0.62, int(W / 2 - dg.shape[1] / 2),
                    int(H - 56 - dg.shape[0] / 2))
        layers.append((lay, (1.0, 1.0, 1.0), None))
    return layers


# ------------------------------------------------------------------ per frame
def process(g, renders=RENDERS, preview=False):
    sid, local, n = shot_of(g)
    t = g / FPS
    if sid == "08":
        src = load_frame("08", 1, renders)
        k = (local - 1) / (n - 1)
        img = to_hd(src, zoom=1.0 + 0.055 * (k * 0.5 + 0.5 * (1 - (1 - k) ** 2)), center=(0.56, 0.5))
    else:
        img = to_hd(load_frame(sid, local, renders))
    img = grade(img, GRADE[sid])
    img = bloom(img, 1.0 if sid != "08" else 0.6)
    img = chroma_ab(img)
    img = vignette(img, 0.22 if sid != "08" else 0.30)
    # supers
    for text, a, b, kw in (("ICE COLD.", 19.5, 23.6, {}),
                           ("THE TASTE YOU KNOW.", 29.8, 34.6,
                            dict(y_frac=0.15, size=46, x_frac=0.93, align="right"))):
        s = super_layer(text, t, a, b, **kw)
        if s is not None:
            lay, shadow = s
            img = img * (1 - shadow[..., None]) + 0 * shadow[..., None]
            img = img * (1 - lay[..., None]) + lay[..., None] * 0.97
    for lay, col, glow in endcard_layers(t):
        if glow is not None:
            img = img + glow[..., None] * np.array([1.0, 0.85, 0.85], np.float32) * 0.35
        img = img * (1 - lay[..., None]) + lay[..., None] * np.array(col, np.float32)
    # transitions: fade in, soft flash into the end card, fade out
    if g < 12:
        img = img * ((g + 1) / 12.0) ** 1.6
    if 840 <= g < 843:
        w_ = (0.55, 0.28, 0.1)[g - 840]
        img = img + w_ * (1 - img)
    if g >= TOTAL - 12:
        img = img * max(0.0, (TOTAL - 1 - g) / 12.0) ** 1.4
    img = grain(img, g, 0.7 if preview else 1.0)
    img = np.clip(img, 0, 1)
    rng = np.random.default_rng(g)
    out = np.clip(img * 255 + rng.uniform(-0.5, 0.5, img.shape), 0, 255).astype(np.uint8)
    if preview:
        out = cv2.resize(out, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    return out


def _work(args):
    g, renders, preview = args
    return g, process(g, renders, preview).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(SCRATCH, "build", "coke_ad_final.mp4"))
    ap.add_argument("--range")
    ap.add_argument("--only")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--stills")
    ap.add_argument("--renders-dir", default=RENDERS)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    if a.stills:
        os.makedirs(os.path.join(SCRATCH, "tests", "post"), exist_ok=True)
        for g in (int(v) for v in a.stills.split(",")):
            out = process(g, a.renders_dir)
            p = os.path.join(SCRATCH, "tests", "post", f"g{g:04d}.png")
            cv2.imwrite(p, out[..., ::-1])
            print("wrote", p)
        return
    frames = list(range(TOTAL))
    if a.range:
        lo, hi = (int(v) for v in a.range.split("-"))
        frames = list(range(lo, hi + 1))
    if a.only:
        sid = f"{int(a.only):02d}"
        frames = [g for g in frames if shot_of(g)[0] == sid]
    ow, oh = (W // 2, H // 2) if a.preview else (W, H)
    audio = os.path.join(SCRATCH, "build", "audio.wav")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}",
           "-r", str(FPS), "-i", "-"]
    if os.path.exists(audio):
        cmd += ["-ss", f"{frames[0] / FPS:.4f}", "-i", audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac",
                "-b:a", "256k", "-ar", "48000", "-shortest"]
    cmd += ["-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264",
            "-preset", "medium" if a.preview else "slow", "-crf", "23" if a.preview else "18",
            "-maxrate", "11M", "-bufsize", "22M", "-profile:v", "high", "-tune", "film",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
            "-movflags", "+faststart", a.out]
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(a.workers) as pool:
        for i, (g, buf) in enumerate(pool.imap(_work, [(g, a.renders_dir, a.preview) for g in frames], chunksize=2)):
            ff.stdin.write(buf)
            if i % 48 == 0:
                print(f"frame {g}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", a.out)


if __name__ == "__main__":
    main()
