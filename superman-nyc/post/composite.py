"""Post-production: phone-camera look, CCTV look, captions and the final encode.

Reads the multilayer EXRs written by blender/render_shots.py (scene-linear Combined + Depth) and
turns them into a vertical 1080x1920 30 fps smartphone clip:

  phone   auto-exposure with a phone's lag, aerial/dust haze from depth, bloom, AgX tone mapping,
          a punchy phone grade, local "HDR" tone mapping, chromatic aberration, rolling-shutter skew
          from the measured camera motion, autofocus hunts, ISP sharpening, upscale, sensor noise,
          and a glitchy phone drop / impact at the end.
  cctv    15 fps, desaturated, barrel-distorted, blocky and noisy, with the camera's own overlay,
          letterboxed over a blurred copy of itself.
  text    the opening title reveal and the captions from timeline.CAPTIONS.

  python3 composite.py FRAMES_DIR --mp4 OUT.mp4 --audio SOUNDTRACK.wav [--workers N]
  python3 composite.py FRAMES_DIR --png DIR --frames 0,150,300-320:5
"""
import argparse
import bisect
import json
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import timeline as TL  # noqa: E402

W, H = 1080, 1920
FPS = TL.FPS
CCTV_SHOT = TL.SHOTS[3]
FONT_DIR = "/usr/share/fonts/opentype/inter/"
FONT_TITLE = FONT_DIR + "Inter-Black.otf"
FONT_CAPTION = FONT_DIR + "Inter-ExtraBold.otf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

# AgX (Blender's default view transform), the widely used polynomial approximation
AGX_IN = np.array([[0.842479062253094, 0.0784335999999992, 0.0792237451477643],
                   [0.0423282422610123, 0.878468636469772, 0.0791661274605434],
                   [0.0423756549057051, 0.0784336, 0.879142973793104]], np.float32)
AGX_OUT = np.linalg.inv(AGX_IN).astype(np.float32)
AGX_MIN_EV, AGX_MAX_EV = -12.47393, 4.026069

# phone exposure bias by time (EV): darker scenes 5/6 are lifted the way a phone's night mode would
EV_BIAS = [(0.0, 0.0), (12.0, 0.0), (20.0, 0.15), (28.8, 0.35), (30.0, 0.6), (35.0, 0.6), (36.7, 0.8), (40.0, 0.8)]
AE_KEY = 0.15          # target log-average luminance
AE_STRENGTH = 0.65     # how much of the needed correction the AE applies
AE_TAU_DARKER, AE_TAU_BRIGHTER = 0.25, 0.55
# autofocus hunts: (centre time, duration, peak blur in output pixels)
AF_HUNTS = [(8.35, 0.55, 3.5), (12.3, 0.35, 2.0), (17.5, 0.75, 5.0), (23.62, 0.45, 3.5), (31.6, 0.8, 4.0),
            (33.45, 0.6, 3.5), (35.55, 0.3, 4.0), (35.95, 0.55, 5.0)]


def smoothstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0.0, 1.0)
    return u * u * (3 - 2 * u)


def interp_curve(points, t):
    p = np.array(points, np.float64)
    return float(np.interp(t, p[:, 0], p[:, 1]))


def shot_of(f):
    for i, (_, a, b, _) in enumerate(TL.SHOTS):
        if a <= f <= b:
            return i
    return None


def is_cctv(f):
    return CCTV_SHOT[1] <= f <= CCTV_SHOT[2]


# ============================================================================= frames on disk
def read_exr(path):
    import OpenEXR
    ch = OpenEXR.File(path).parts[0].channels
    rgba = ch["ViewLayer.Combined"].pixels.astype(np.float32)
    z = ch["ViewLayer.Depth.Z"].pixels.astype(np.float32)
    rgb = np.nan_to_num(rgba[..., :3], nan=0.0, posinf=60.0, neginf=0.0)
    return np.clip(rgb, 0.0, 60.0), z


def available(frames_dir):
    out = []
    for n in os.listdir(frames_dir):
        if n.startswith("f") and n.endswith(".exr"):
            p = os.path.join(frames_dir, n)
            if os.path.getsize(p) > 0:
                out.append(int(n[1:-4]))
    return sorted(out)


def source_map(frames_dir):
    """Output frame -> rendered frame to show (holds the previous render inside the same shot)."""
    have = available(frames_dir)
    m = {}
    for f in range(TL.N_FRAMES):
        if f >= TL.BLACK_FROM:
            m[f] = None
            continue
        s = shot_of(f)
        a = TL.SHOTS[s][1]
        i = bisect.bisect_right(have, f) - 1
        if i >= 0 and have[i] >= a:
            m[f] = have[i]
        else:
            j = bisect.bisect_left(have, f)
            m[f] = have[j] if j < len(have) and shot_of(have[j]) == s else None
    return m


# ============================================================================= analysis pass
def lum(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def small_lum(rgb, k=4):
    h, w = rgb.shape[0] // k * k, rgb.shape[1] // k * k
    y = lum(rgb[:h, :w]).reshape(h // k, k, w // k, k).mean(axis=(1, 3))
    return y


def phase_shift(a, b):
    """Global translation of image b relative to a (pixels), by phase correlation."""
    win = np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1]))
    A = np.fft.fft2(np.log1p(a * 8) * win)
    B = np.fft.fft2(np.log1p(b * 8) * win)
    R = A * np.conj(B)
    r = np.fft.ifft2(R / (np.abs(R) + 1e-9)).real
    i, j = np.unravel_index(np.argmax(r), r.shape)

    def sub(c, n, v):
        y0, y1, y2 = v
        d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) + 1e-12)
        c = c + float(np.clip(d, -0.5, 0.5))
        return c - n if c > n / 2 else c

    dy = sub(i, r.shape[0], (r[i - 1, j], r[i, j], r[(i + 1) % r.shape[0], j]))
    dx = sub(j, r.shape[1], (r[i, j - 1], r[i, j], r[i, (j + 1) % r.shape[1]]))
    return -dx, -dy, float(r.max())


def analyse_one(args):
    path, prev_path = args
    rgb, _ = read_exr(path)
    y = small_lum(rgb)
    hh, ww = y.shape
    gy, gx = np.mgrid[0:hh, 0:ww]
    w = np.exp(-(((gx - ww / 2) / (0.45 * ww)) ** 2 + ((gy - hh / 2) / (0.45 * hh)) ** 2))
    logavg = float(np.exp(np.sum(w * np.log(y + 1e-4)) / np.sum(w)))
    out = {"logavg": logavg, "p98": float(np.percentile(y, 98)), "shape": list(rgb.shape[:2]),
           "dx": 0.0, "dy": 0.0}
    if prev_path:
        yp = small_lum(read_exr(prev_path)[0])
        dx, dy, conf = phase_shift(yp, y)
        k = 4 * W / rgb.shape[1]             # to output pixels
        out.update(dx=dx * k, dy=dy * k, conf=conf)
    return out


def analyse(frames_dir, workers):
    cache = os.path.join(frames_dir, "analysis.json")
    data = {}
    if os.path.exists(cache):
        data = json.load(open(cache))
    have = available(frames_dir)
    todo = []
    for i, f in enumerate(have):
        key = str(f)
        mt = os.path.getmtime(os.path.join(frames_dir, f"f{f:04d}.exr"))
        if key in data and data[key].get("mtime") == mt:
            continue
        prev = have[i - 1] if i > 0 and shot_of(have[i - 1]) == shot_of(f) else None
        todo.append((f, mt, prev))
    if todo:
        jobs = [(os.path.join(frames_dir, f"f{f:04d}.exr"), os.path.join(frames_dir, f"f{p:04d}.exr") if p is not None
                 else None) for f, _, p in todo]
        with Pool(workers) as pool:
            res = pool.map(analyse_one, jobs, chunksize=4)
        for (f, mt, p), r in zip(todo, res):
            r["mtime"] = mt
            r["gap"] = (f - p) if p is not None else 0
            data[str(f)] = r
        json.dump(data, open(cache, "w"))
    return {int(k): v for k, v in data.items()}


def exposure_track(stats, smap):
    """Phone AE: partial correction towards a key value, lagging like a real camera."""
    ev = np.zeros(TL.N_FRAMES)
    cur = None
    for f in range(TL.N_FRAMES):
        t = f / FPS
        s = smap[f]
        if s is None or is_cctv(f) or s not in stats:
            ev[f] = cur if cur is not None else 0.0
            continue
        target = AE_STRENGTH * math.log2(AE_KEY / max(stats[s]["logavg"], 1e-4))
        target = float(np.clip(target, -3.0, 3.5)) + interp_curve(EV_BIAS, t)
        if cur is None:
            cur = target
        tau = AE_TAU_DARKER if target < cur else AE_TAU_BRIGHTER
        cur += (target - cur) * (1 - math.exp(-1.0 / (FPS * tau)))
        ev[f] = cur
    return ev


ZOOM = np.ones(TL.N_FRAMES)


def motion_track(stats, smap, camera_json=None):
    """Image motion of the phone camera in output px/frame (x right, y down), for rolling-shutter skew.
    Exact from the exported camera track when available, else measured by phase correlation."""
    dx = np.zeros(TL.N_FRAMES)
    dy = np.zeros(TL.N_FRAMES)
    if camera_json and os.path.exists(camera_json):
        track = json.load(open(camera_json))
        for f in range(1, min(len(track), TL.N_FRAMES)):
            w0, x0, y0, z0 = track[f - 1]["q"]
            w1, x1, y1, z1 = track[f]["q"]
            # r = q0^-1 * q1 : rotation from the previous frame, in the camera's own axes
            rw = w0 * w1 + x0 * x1 + y0 * y1 + z0 * z1
            rx = w0 * x1 - x0 * w1 - y0 * z1 + z0 * y1
            ry = w0 * y1 + x0 * z1 - y0 * w1 - z0 * x1
            if rw < 0:
                rw, rx, ry = -rw, -rx, -ry
            ang = 2 * math.acos(min(1.0, rw))
            sn = math.sqrt(max(1e-12, 1 - rw * rw))
            fpx = track[f]["lens"] / 36.0 * H
            dx[f] = ry / sn * ang * fpx       # yaw left -> content moves right
            dy[f] = rx / sn * ang * fpx       # pitch up -> content moves down
        lim = 160.0
        ZOOM[:len(track)] = [d["lens"] / 28.8 for d in track[:TL.N_FRAMES]]
        return np.clip(dx, -lim, lim), np.clip(dy, -lim, lim)
    for f in range(TL.N_FRAMES):
        s = smap[f]
        if s is not None and s in stats and stats[s].get("gap") and stats[s].get("conf", 0) > 0.15:
            g = max(1, stats[s]["gap"])
            dx[f] = stats[s]["dx"] / g
            dy[f] = stats[s]["dy"] / g
    lim = 60.0
    return ndimage.uniform_filter1d(np.clip(dx, -lim, lim), 3), ndimage.uniform_filter1d(np.clip(dy, -lim, lim), 3)


def cctv_exposure(stats, smap):
    vals = [stats[smap[f]]["logavg"] for f in range(CCTV_SHOT[1], CCTV_SHOT[2] + 1)
            if smap[f] is not None and smap[f] in stats]
    if not vals:
        return 0.0
    return 0.8 * math.log2(0.16 / float(np.exp(np.mean(np.log(vals))))) - 0.3


# ============================================================================= image operations
def agx(x):
    x = np.maximum(x, 1e-10) @ AGX_IN.T
    x = (np.clip(np.log2(np.maximum(x, 1e-10)), AGX_MIN_EV, AGX_MAX_EV) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV)
    x2 = x * x
    x4 = x2 * x2
    x = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232
    x = np.maximum(x, 0) @ AGX_OUT.T                  # still display-encoded (2.2), which is what we show
    return np.clip(x, 0, 1)


def blur(img, sigma):
    if sigma <= 0.05:
        return img
    if img.ndim == 3:
        return ndimage.gaussian_filter(img, (sigma, sigma, 0), mode="nearest")
    return ndimage.gaussian_filter(img, sigma, mode="nearest")


def downsample(img, k):
    h, w = img.shape[0] // k * k, img.shape[1] // k * k
    return img[:h, :w].reshape(h // k, k, w // k, k, -1).mean(axis=(1, 3))


def upsample_to(img, shape):
    zy, zx = shape[0] / img.shape[0], shape[1] / img.shape[1]
    out = ndimage.zoom(img, (zy, zx, 1), order=1, mode="nearest")
    return out[:shape[0], :shape[1]]


def bloom(x, strength):
    """Lens glare around bright sources: multi-scale blur of what clips."""
    hi = np.maximum(x - 0.9, 0)
    hi = hi / (1 + hi * 0.15)
    out = np.zeros_like(x)
    k = max(1, round(x.shape[1] / 360))
    small = downsample(hi, 2 * k)
    for s, w in ((1.5, 0.5), (5.0, 0.32), (14.0, 0.18)):
        out += upsample_to(blur(small, s), x.shape) * w
    return x + out * strength


def depth_haze(x, z, t, sky):
    zz = np.minimum(z, 5000.0)[..., None]
    a = (1 - np.exp(-zz / 1400.0)) * 0.35
    x = x * (1 - a) + sky * a
    d = interp_curve([(0, 0), (17.5, 0), (21, 0.1), (24.5, 0.22), (29.0, 0.22), (30.5, 0.1), (35.0, 0.1),
                      (36.8, 0.15), (37.4, 0.55), (39.5, 0.65)], t)
    if d > 0:
        dust = np.array([0.56, 0.5, 0.42], np.float32) * float(np.median(lum(x)) * 1.6 + 0.02)
        a = (1 - np.exp(-zz / 55.0)) * d
        x = x * (1 - a) + dust * a
    return x


def local_tonemap(x, amount=0.28):
    """Smartphone 'HDR': compress the large-scale luminance, keep the detail."""
    y = lum(x)
    ly = np.log2(y + 1e-4)
    k = max(1, round(x.shape[1] / 180))
    base = upsample_to(blur(downsample(ly[..., None], k), 6.0), ly.shape + (1,))[..., 0]
    mean = float(np.mean(base))
    ny = ly - (base - mean) * amount
    return x * (2 ** (ny - ly))[..., None]


def grade(x):
    y = lum(x)[..., None]
    x = y + (x - y) * 1.1                                 # a bit of phone saturation
    x = (x - 0.5) * 1.05 + 0.5 + 0.005
    x = x * np.array([1.02, 1.0, 0.97], np.float32)       # slightly warm
    return np.clip(x, 0, 1)


def remap(x, t, mdx, mdy, ca=0.0012, rs=0.45):
    """Chromatic aberration (radial) + rolling-shutter skew from the frame's horizontal motion."""
    h, w = x.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cy, cx = (h - 1) / 2, (w - 1) / 2
    # rows are read top to bottom: later rows see the camera further along its motion
    k = w / W
    shift_x = mdx * k * rs * (yy / h - 0.5)
    shift_y = mdy * k * rs * (yy / h - 0.5) * 0.3
    out = np.empty_like(x)
    for c, s in enumerate((1 + ca, 1.0, 1 - ca)):
        sx = cx + (xx - cx) / s - shift_x
        sy = cy + (yy - cy) / s - shift_y
        out[..., c] = ndimage.map_coordinates(x[..., c], [sy, sx], order=1, mode="nearest")
    return out


def af_blur(t):
    s = 0.0
    for tc, dur, peak in AF_HUNTS:
        u = (t - (tc - dur / 2)) / dur
        if 0 <= u <= 1:
            # hunt: defocus, overshoot back, settle
            s = max(s, peak * (math.sin(math.pi * u) ** 2) * (1.0 + 0.35 * math.sin(3 * math.pi * u)))
    return s


def sharpen(x, amount=0.35, sigma=1.0):
    return np.clip(x + (x - blur(x, sigma)) * amount, 0, 1)


def resize(x, size):
    """Lanczos resize of a float image (0..1) to (w, h)."""
    out = [np.asarray(Image.fromarray(np.ascontiguousarray(x[..., c], dtype=np.float32), "F").resize(size, Image.LANCZOS))
           for c in range(x.shape[2])]
    return np.stack(out, -1)


def sensor_noise(x, rng, iso):
    """Luma + a little chroma noise, soft-grained the way a phone's denoiser leaves it."""
    y = lum(x)[..., None]
    sig = (0.006 + 0.022 * (1 - y) ** 3) * iso
    h, w = x.shape[0] // 2, x.shape[1] // 2
    n = rng.standard_normal((h, w, 4)).astype(np.float32)
    n = ndimage.zoom(n, (x.shape[0] / h, x.shape[1] / w, 1), order=1)[:x.shape[0], :x.shape[1]] * 1.35
    return np.clip(x + (n[..., :1] + n[..., 1:] * 0.35) * sig, 0, 1)


def glitch(img, rng, amount):
    """Codec corruption: displaced blocks and smeared rows (img uint8 HxWx3)."""
    out = img.copy()
    h, w = img.shape[:2]
    for _ in range(int(40 * amount)):
        bh, bw = rng.integers(8, 64) // 8 * 8 + 8, rng.integers(16, 240) // 16 * 16 + 16
        y0, x0 = rng.integers(0, h - bh), rng.integers(0, w - bw)
        dy, dx = rng.integers(-24, 25), rng.integers(-120, 121)
        ys, xs = np.clip(y0 + dy, 0, h - bh), np.clip(x0 + dx, 0, w - bw)
        out[y0:y0 + bh, x0:x0 + bw] = img[ys:ys + bh, xs:xs + bw]
    for _ in range(int(6 * amount)):
        y0 = rng.integers(0, h - 40)
        out[y0:y0 + rng.integers(4, 40)] = out[y0:y0 + 1]
    sh = int(6 * amount)
    if sh:
        out[..., 0] = np.roll(out[..., 0], sh, axis=1)
        out[..., 2] = np.roll(out[..., 2], -sh, axis=1)
    return out


# ============================================================================= text
def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(text, fnt, max_w, draw):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    lines.append(cur)
    return lines


def text_block(lines, fnt, fill=(255, 255, 255), stroke=6, shadow=10, spacing=1.12, align_center=True):
    """RGBA image of centred lines with outline and a soft shadow."""
    tmp = ImageDraw.Draw(Image.new("L", (8, 8)))
    asc, desc = fnt.getmetrics()
    lh = int((asc + desc) * spacing)
    widths = [tmp.textlength(ln, font=fnt) for ln in lines]
    pad = stroke + shadow * 3
    bw, bh = int(max(widths)) + 2 * pad, lh * len(lines) + 2 * pad
    shadow_img = Image.new("L", (bw, bh), 0)
    sd = ImageDraw.Draw(shadow_img)
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        x = pad + (max(widths) - widths[i]) / 2 if align_center else pad
        y = pad + i * lh
        sd.text((x, y + shadow * 0.4), ln, font=fnt, fill=200, stroke_width=stroke + 2)
        d.text((x, y), ln, font=fnt, fill=fill + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(shadow))
    base = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    base.putalpha(shadow_img.point(lambda v: int(v * 0.75)))
    return Image.alpha_composite(base, img)


class Captions:
    def __init__(self):
        self.items = []
        tmp = ImageDraw.Draw(Image.new("L", (8, 8)))
        for (t0, t1, text, style) in TL.CAPTIONS:
            if style == "title":
                words = text.split()            # WHAT IF / SUPERMAN / ATTACKED / NEW YORK?
                lines = [" ".join(words[0:2]), words[2], words[3], " ".join(words[4:])]
                imgs = []
                for i, ln in enumerate(lines):
                    size = 168 if ln == "SUPERMAN" else 132
                    imgs.append(text_block([ln], font(FONT_TITLE, size), stroke=7, shadow=14))
                self.items.append((t0, t1, style, imgs))
            elif style == "final":
                fnt = font(FONT_TITLE, 118)
                self.items.append((t0, t1, style, [text_block(["WOULD YOU", "SURVIVE THIS?"], fnt, stroke=7,
                                                              shadow=14)]))
            else:
                fnt = font(FONT_CAPTION, 64)
                lines = wrap(text, fnt, 930, tmp)
                self.items.append((t0, t1, style, [text_block(lines, fnt, stroke=6, shadow=10)]))

    @staticmethod
    def paste(frame, img, cx, cy, alpha=1.0, scale=1.0, blur_px=0.0):
        if alpha <= 0.003:
            return
        if abs(scale - 1.0) > 1e-3:
            img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BICUBIC)
        if blur_px > 0.3:
            img = img.filter(ImageFilter.GaussianBlur(blur_px))
        a = np.asarray(img, np.float32) / 255.0
        x0, y0 = int(round(cx - img.width / 2)), int(round(cy - img.height / 2))
        xa, ya = max(0, x0), max(0, y0)
        xb, yb = min(frame.shape[1], x0 + img.width), min(frame.shape[0], y0 + img.height)
        if xb <= xa or yb <= ya:
            return
        sub = a[ya - y0:yb - y0, xa - x0:xb - x0]
        al = sub[..., 3:4] * alpha
        frame[ya:yb, xa:xb] = frame[ya:yb, xa:xb] * (1 - al) + sub[..., :3] * al

    def draw(self, frame, t):
        """frame: float32 HxWx3 in 0..1 (modified in place)."""
        for (t0, t1, style, imgs) in self.items:
            if not (t0 - 0.01 <= t <= t1 + 0.01):
                continue
            if style == "title":
                # darken the footage behind the title, lines slam in one after another, hit at 0.45 s
                fade_out = 1 - smoothstep(t1 - 0.3, t1, t)
                yy = np.linspace(0, 1, frame.shape[0])[:, None, None]
                shade = 0.55 * np.exp(-((yy - 0.45) / 0.28) ** 2) * fade_out
                frame *= (1 - shade)
                heights = [im.height * 0.78 for im in imgs]
                total = sum(heights)
                y = 0.45 * H - total / 2
                for i, im in enumerate(imgs):
                    ts = 0.05 + 0.09 * i
                    u = float(np.clip((t - ts) / 0.22, 0, 1))
                    e = 1 - (1 - u) ** 3
                    scale = (1.35 - 0.35 * e) * (1 + 0.04 * smoothstep(t1 - 0.3, t1, t))
                    shake = 6 * math.exp(-max(0.0, t - 0.45) / 0.08) * math.sin(t * 160 + i) if t > 0.45 else 0
                    self.paste(frame, im, W / 2 + shake, y + heights[i] / 2, alpha=e * fade_out, scale=scale,
                               blur_px=(1 - e) * 10)
                    y += heights[i]
            elif style == "final":
                u = float(np.clip((t - t0) / 0.2, 0, 1))
                e = 1 - (1 - u) ** 3
                self.paste(frame, imgs[0], W / 2, H * 0.47, alpha=e, scale=1.18 - 0.18 * e)
            else:
                a = smoothstep(t0, t0 + 0.18, t) * (1 - smoothstep(t1 - 0.22, t1, t))
                rise = 14 * (1 - smoothstep(t0, t0 + 0.25, t))
                self.paste(frame, imgs[0], W / 2, H * 0.705 + rise, alpha=a)


# ============================================================================= CCTV
def cctv_overlay(t):
    img = Image.new("RGBA", (W, 608), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(FONT_MONO, 27)
    clock = 14 * 3600 + 37 * 60 + 5 + int(t)
    hh, mm, ss = clock // 3600, clock // 60 % 60, clock % 60
    items = [((22, 18), "CAM 07  6 AV / W 41 ST"), ((W - 22, 18), f"10-19-2026  {hh:02d}:{mm:02d}:{ss:02d}")]
    for (x, y), s in items:
        anchor = "ra" if x > W / 2 else "la"
        d.text((x, y), s, font=f, fill=(235, 235, 235, 255), anchor=anchor, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    if int(t * 2) % 2 == 0:
        d.ellipse((24, 608 - 52, 46, 608 - 30), fill=(230, 30, 30, 255))
    d.text((56, 608 - 56), "REC", font=f, fill=(235, 235, 235, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    d.text((W - 22, 608 - 56), "CH-07  1080P", font=f, fill=(235, 235, 235, 255), anchor="ra", stroke_width=2,
           stroke_fill=(0, 0, 0, 255))
    return img


def barrel(x, k1=0.16, k2=0.05):
    h, w = x.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (xx - w / 2) / (w / 2), (yy - h / 2) / (w / 2)
    r2 = nx * nx + ny * ny
    f = (1 + k1 * r2 + k2 * r2 * r2) / (1 + k1 + k2 * 1.0) * 1.02
    sx, sy = w / 2 + nx * f * (w / 2), h / 2 + ny * f * (w / 2)
    return np.stack([ndimage.map_coordinates(x[..., c], [sy, sx], order=1, mode="constant", cval=0.0)
                     for c in range(3)], -1)


def cctv_frame(rgb, t, ev, rng, first):
    x = agx(rgb * (2 ** ev))
    y = lum(x)[..., None]
    x = y + (x - y) * 0.45
    x = np.clip((x - 0.5) * 1.18 + 0.5 + 0.015, 0, 1) * np.array([0.95, 1.03, 0.97], np.float32)
    x = barrel(x)
    hh, ww = x.shape[:2]
    gy, gx = np.mgrid[0:hh, 0:ww]
    vig = 1 - 0.35 * (((gx - ww / 2) / (ww / 2)) ** 2 + ((gy - hh / 2) / (hh / 2)) ** 2) * 0.5
    x = np.clip(x * vig[..., None] + rng.standard_normal(x.shape[:2] + (1,)) * 0.025, 0, 1)
    # recorder: low resolution, heavy compression
    im = Image.fromarray((x * 255).astype(np.uint8)).resize((640, 360), Image.BILINEAR)
    import io
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=28)
    im = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
    fg = im.resize((W, 608), Image.BICUBIC)
    # vertical frame: the landscape picture over a blurred, darkened copy of itself
    bgw = int(H * 640 / 360)
    bg = im.resize((bgw // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(9)).resize((bgw, H),
                                                                                                    Image.BILINEAR)
    bg = bg.crop(((bgw - W) // 2, 0, (bgw - W) // 2 + W, H))
    out = np.asarray(bg, np.float32) / 255.0 * 0.38
    fg = np.asarray(fg, np.float32) / 255.0
    top = (H - 608) // 2
    out[top:top + 608] = fg
    ov = np.asarray(cctv_overlay(t), np.float32) / 255.0
    a = ov[..., 3:4]
    out[top:top + 608] = out[top:top + 608] * (1 - a) + ov[..., :3] * a
    out[top - 3:top] = 0.0
    out[top + 608:top + 611] = 0.0
    if first:
        out = glitch((out * 255).astype(np.uint8), rng, 1.5).astype(np.float32) / 255.0
    return out


# ============================================================================= per frame
class Ctx:
    pass


CTX = Ctx()


def init_worker(frames_dir, smap, ev, mdx, mdy, ev_cctv, zoom):
    CTX.frames_dir, CTX.smap, CTX.ev, CTX.mdx, CTX.mdy, CTX.ev_cctv = frames_dir, smap, ev, mdx, mdy, ev_cctv
    CTX.zoom = zoom
    CTX.captions = Captions()


def phone_frame(rgb, z, f, t, rng):
    ev = CTX.ev[f]
    # the impact: a white flash and the sensor clipping
    flash = 3.0 * math.exp(-max(0.0, t - (TL.T_IMPACT + 0.03)) / 0.12) if t >= TL.T_IMPACT + 0.03 else 0.0
    x = rgb * (2 ** (ev + flash))
    sky_mask = z > 1e8
    sky = np.median(x[sky_mask], axis=0) if sky_mask.mean() > 0.01 else np.array([0.5, 0.55, 0.62], np.float32) * 0.5
    x = depth_haze(x, z, t, sky.astype(np.float32))
    x = local_tonemap(x)
    x = bloom(x, 0.6)
    x = grade(agx(x))
    x = remap(x, t, CTX.mdx[f], CTX.mdy[f])
    # digital zoom: softer, over-sharpened and noisier, like a phone cropping its sensor
    dz = max(0.0, CTX.zoom[f] - 2.2)
    s = (af_blur(t) + 0.45 * dz) * x.shape[1] / W
    if s > 0.05:
        x = blur(x, s)
    x = sharpen(x, 0.35 + 0.12 * dz, 0.9 * x.shape[1] / 720)
    x = resize(x, (W, H))
    # after the impact the phone on the ground keeps shaking in the shockwave
    if t > TL.T_IMPACT:
        a = 18 * math.exp(-(t - TL.T_IMPACT) / 0.45)
        if a > 0.5:
            x = ndimage.shift(x, (rng.normal(0, a), rng.normal(0, a), 0), order=1, mode="nearest")
    iso = 1.0 + 1.6 * smoothstep(28.5, 30.5, t) + 0.6 * (t > TL.T_IMPACT) + 0.25 * dz
    return sensor_noise(x, rng, iso)


def render_frame(f):
    t = f / FPS
    rng = np.random.default_rng(f * 7919 + 13)
    src = CTX.smap[f]
    if src is None:
        out = np.zeros((H, W, 3), np.float32)
    else:
        rgb, z = read_exr(os.path.join(CTX.frames_dir, f"f{src:04d}.exr"))
        if is_cctv(f):
            out = cctv_frame(rgb, t, CTX.ev_cctv, rng, f in (CCTV_SHOT[1], CCTV_SHOT[1] + 1))
        else:
            out = phone_frame(rgb, z, f, t, rng)
    # cut back from the CCTV: one frame of corruption
    g = 0.0
    if f == CCTV_SHOT[2] + 1:
        g = 1.0
    if TL.T_PHONE_LAND <= t < TL.T_PHONE_LAND + 0.1:
        g = 1.4
    if TL.T_IMPACT + 0.03 <= t < TL.T_IMPACT + 0.17:
        g = 2.0
    CTX.captions.draw(out, t)
    img = (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
    if g:
        img = glitch(img, rng, g)
    return img


def parse_frames(spec):
    out = []
    for part in spec.split(","):
        step = 1
        if ":" in part:
            part, step = part.split(":")
            step = int(step)
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1, step))
        else:
            out.append(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir")
    ap.add_argument("--mp4")
    ap.add_argument("--audio")
    ap.add_argument("--png")
    ap.add_argument("--frames", default=None)
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--maxrate", default="8M")
    ap.add_argument("--camera", default="/opt/work/cache/camera_track.json")
    a = ap.parse_args()

    smap = source_map(a.frames_dir)
    stats = analyse(a.frames_dir, a.workers)
    ev = exposure_track(stats, smap)
    mdx, mdy = motion_track(stats, smap, a.camera)
    ev_cctv = cctv_exposure(stats, smap)
    # the phone tumbles / lies on the ground: freeze a few frames like a stalled encoder
    for f0, n in ((int(35.45 * FPS), 2), (int(35.82 * FPS), 2), (int((TL.T_IMPACT + 0.2) * FPS), 3)):
        for k in range(1, n):
            smap[f0 + k] = smap[f0]
    frames = parse_frames(a.frames) if a.frames else list(range(TL.N_FRAMES))
    args = (a.frames_dir, smap, ev, mdx, mdy, ev_cctv, ZOOM.copy())
    if a.png:
        os.makedirs(a.png, exist_ok=True)
        with Pool(a.workers, init_worker, args) as pool:
            for f, img in zip(frames, pool.imap(render_frame, frames)):
                Image.fromarray(img).save(os.path.join(a.png, f"p{f:04d}.png"))
        print("png done", len(frames))
    if a.mp4:
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
               "-r", str(FPS), "-i", "-"]
        if a.audio:
            cmd += ["-i", a.audio, "-c:a", "aac", "-b:a", "256k", "-ar", "48000"]
        cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-maxrate", a.maxrate,
                "-bufsize", str(2 * int(a.maxrate.rstrip("M"))) + "M", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-level", "4.2", "-g", "60", "-movflags", "+faststart",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                "-frames:v", str(TL.N_FRAMES), "-t", f"{TL.DURATION:.3f}", a.mp4]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        with Pool(a.workers, init_worker, args) as pool:
            for i, img in enumerate(pool.imap(render_frame, range(TL.N_FRAMES), chunksize=2)):
                proc.stdin.write(img.tobytes())
                if i % 100 == 0:
                    print("encoded", i, flush=True)
        proc.stdin.close()
        proc.wait()
        print("mp4 done", a.mp4, "exit", proc.returncode)


if __name__ == "__main__":
    main()
