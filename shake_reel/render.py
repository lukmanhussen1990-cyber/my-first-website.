"""Render the reel's picture from the images / Kling clips: camera moves + cartoon effects, one shot at a time.

Usage:
  python3 render.py                 render every shot -> build/seg_XX.mp4 (parallel, JOBS=4)
  python3 render.py 5 6 7           only these shots
  python3 render.py --stills DIR    one still per shot (beginning / middle / end) for checking
  python3 render.py --preview 0.5   half-size render (faster checks)
Reads  shots.json (times), audio/word_onsets.json (word times for punch-ins / shakes), fx.py (per-shot camera
       and effects), images/shot_XX.png, clips/shot_XX.mp4 (used instead of the image when present).
Every frame is a pure function of (shot, time): shots can render in any order and in parallel.

Camera: the source is fitted to cover the 1080x1920 frame, then zoomed (push / punch), moved (pan focus point),
rotated and shaken with one affine warp from the original pixels (no double resampling). Effects are drawn in
screen space; effects anchored to something in the picture (stink lines over a door, sweat on a forehead) give
their anchor in source coordinates (u, v in 0..1) so they move with the camera.
"""
import json
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
W, H, FPS = 1080, 1920, 30
PLAN = json.load(open(P("shots.json")))
SHOTS = {s["id"]: s for s in PLAN["shots"]}
WORDS = json.load(open(P("audio", "word_onsets.json"))) if os.path.exists(P("audio", "word_onsets.json")) else []
import overlays


def word(line, idx=0):
    """Onset (s) of word idx (0-based, negative from the end) of voice line `line` (1-based)."""
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["s"]


def word_end(line, idx=-1):
    ws = [w for w in WORDS if w["line"] == line]
    return ws[idx]["e"]


# ----------------------------------------------------------------------------------------------- helpers
def hash1(*a):
    """Deterministic pseudo-random 0..1 from numbers."""
    x = math.sin(sum((i + 1) * 12.9898 * v for i, v in enumerate(a)) + 78.233) * 43758.5453
    return x - math.floor(x)


def noise1(t, seed=0.0):
    """Smooth value noise, -1..1."""
    i = math.floor(t)
    f = t - i
    a, b = hash1(i, seed) * 2 - 1, hash1(i + 1, seed) * 2 - 1
    u = f * f * (3 - 2 * f)
    return a + (b - a) * u


def ease(x, kind="inout"):
    x = min(1.0, max(0.0, x))
    if kind == "in":
        return x * x
    if kind == "out":
        return 1 - (1 - x) * (1 - x)
    if kind == "lin":
        return x
    return 0.5 - 0.5 * math.cos(math.pi * x)


def lerp(a, b, x):
    return a + (b - a) * x


def smoothstep(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------------------------- sources
class ImageSource:
    def __init__(self, path):
        im = cv2.imread(path, cv2.IMREAD_COLOR)
        if im is None:
            raise SystemExit(f"cannot read {path}")
        self.img = im
        self.h, self.w = im.shape[:2]

    def frame(self, lt):
        return self.img


class ClipSource:
    """Kling clip, decoded on demand: frame at shot-local time lt = clip time start + lt * speed."""

    def __init__(self, path, start=0.0, speed=1.0, hold_end=True):
        self.path, self.start, self.speed = path, start, speed
        info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                               "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
                              capture_output=True, text=True, check=True).stdout
        j = json.loads(info)
        st = j["streams"][0]
        self.w, self.h = int(st["width"]), int(st["height"])
        num, den = st["r_frame_rate"].split("/")
        self.fps = float(num) / float(den)
        self.dur = float(j["format"]["duration"])
        self.cache = {}
        self._load()

    def _load(self):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", self.path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                             capture_output=True, check=True).stdout
        n = len(raw) // (self.w * self.h * 3)
        self.frames = np.frombuffer(raw, np.uint8)[:n * self.w * self.h * 3].reshape(n, self.h, self.w, 3)
        self.n = n

    def index(self, lt):
        ct = self.start + lt * self.speed
        k = int(round(ct * self.fps))
        return min(max(k, 0), self.n - 1)

    def frame(self, lt):
        return self.frames[self.index(lt)]


class BlackSource:
    """Shot with no picture (the black screen for "Splat." / "And a scream.")."""
    w, h = W, H

    def frame(self, lt):
        return np.zeros((H, W, 3), np.uint8)


IMAGES = os.environ.get("IMAGES_DIR", P("images"))     # override for tests with placeholder pictures
CLIPS = os.environ.get("CLIPS_DIR", P("clips"))


def source_for(sid, fx):
    if SHOTS[sid].get("black"):
        return BlackSource(), "black"
    clip, img = os.path.join(CLIPS, f"shot_{sid:02d}.mp4"), os.path.join(IMAGES, f"shot_{sid:02d}.png")
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        cand = os.path.join(IMAGES, f"shot_{sid:02d}{ext}")
        if os.path.exists(cand):
            img = cand
            break
    if os.path.exists(clip) and not os.environ.get("NO_CLIPS"):
        c = fx.get("clip", {})
        src = ClipSource(clip, c.get("start", 0.0), c.get("speed", 1.0))
        if "span" in c:                       # play clip seconds a..b over the whole shot (fast or slow motion)
            a, b = c["span"]
            b = min(b, src.dur - 1.0 / src.fps)
            src.start, src.speed = a, (b - a) / (SHOTS[sid]["t1"] - SHOTS[sid]["t0"])
        return src, "clip"
    return ImageSource(img), "image"


# ----------------------------------------------------------------------------------------------- camera
def camera(fx, t, t0, t1, src_w, src_h):
    """Affine 2x3 matrix (source px -> output px) for absolute time t."""
    hold = fx.get("hold_fps")                         # old film: the camera moves in 12 fps steps
    if hold:
        t = t0 + math.floor((t - t0) * hold) / hold
    lt, dur = t - t0, t1 - t0
    u = lt / dur
    z0, z1 = fx.get("push", (1.0, 1.06))
    z = lerp(z0, z1, ease(u, fx.get("push_ease", "inout")))
    for (tp, k, *rest) in fx.get("punch", []):        # stepped zoom on a beat (3-frame ease)
        ramp = rest[0] if rest else 0.07
        z *= lerp(1.0, k, smoothstep(tp - 0.02, tp - 0.02 + ramp, t))
    for (tp, k, pd) in fx.get("pulse", []):           # zoom in and back out (snore, sniff, drum)
        if tp <= t < tp + pd:
            z *= 1 + (k - 1) * math.sin(math.pi * (t - tp) / pd)
    (fx0, fy0), (fx1, fy1) = fx.get("pan", ((0.5, 0.5), (0.5, 0.5)))
    if "pan_t" in fx:                                 # pan only between two absolute times (whip down)
        ta, tb = fx["pan_t"]
        e = ease((t - ta) / max(1e-6, tb - ta), fx.get("pan_ease", "inout"))
    else:
        e = ease(u, fx.get("pan_ease", "inout"))
    fxp, fyp = lerp(fx0, fx1, e), lerp(fy0, fy1, e)
    if "path" in fx:                                  # focus keyframes [(t, (u, v)), ...] (eyes darting)
        kf = fx["path"]
        fxp, fyp = kf[0][1]
        for (ta, pa), (tb, pb) in zip(kf, kf[1:]):
            if t >= ta:
                k = smoothstep(ta, tb, t)
                fxp, fyp = lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)
    # shake (decaying, deterministic), with extra zoom so the frame edge never shows
    sx = sy = rot = 0.0
    margin = 1.0
    for (ts, amp, sdur, *rest) in fx.get("shake", []):
        freq = rest[0] if rest else 18.0
        if ts <= t < ts + sdur:
            k = (1 - (t - ts) / sdur) ** 1.5
            sx += amp * k * noise1((t - ts) * freq, ts * 7.1)
            sy += amp * k * noise1((t - ts) * freq, ts * 3.3 + 50)
            rot += 0.06 * amp / 40 * k * noise1((t - ts) * freq * 0.7, ts + 99)
        margin = max(margin, 1.0 + 2.2 * amp / W)
    if fx.get("weave"):                              # old projector gate weave (jumpy, per held frame)
        wv = fx["weave"]
        fr = math.floor(t * (hold or 12))
        sx += wv * (hash1(fr, 1.1) * 2 - 1)
        sy += wv * 1.4 * (hash1(fr, 2.3) * 2 - 1)
        margin = max(margin, 1.0 + 3.0 * wv / W)
    hh = fx.get("handheld", 0.0)                     # gentle drift (px)
    if hh:
        sx += hh * noise1(t * 0.6, 11.0)
        sy += hh * noise1(t * 0.5, 23.0)
    rot += math.radians(fx.get("roll", 0.0))
    if fx.get("sway"):                               # rocking camera (swinging chandelier), degrees / Hz
        amp, fq = fx["sway"]
        rot += math.radians(amp) * math.sin(2 * math.pi * fq * lt) * (1 - 0.4 * u)
        margin = max(margin, 1.0 + abs(math.sin(math.radians(amp))) * 1.2)
    z *= margin
    cover = max(W / src_w, H / src_h)
    s = cover * z
    # keep the picture covering the frame: clamp the focus point
    hw, hh_ = W / 2 / s, H / 2 / s
    cx = min(max(fxp * src_w, hw), src_w - hw) if src_w > 2 * hw else src_w / 2
    cy = min(max(fyp * src_h, hh_), src_h - hh_) if src_h > 2 * hh_ else src_h / 2
    c, sn = math.cos(rot), math.sin(rot)
    M = np.array([[s * c, -s * sn, 0.0], [s * sn, s * c, 0.0]])
    M[:, 2] = np.array([W / 2 + sx, H / 2 + sy]) - M[:, :2] @ np.array([cx, cy])
    return M


def to_screen(M, uv, src_w, src_h):
    p = M[:, :2] @ np.array([uv[0] * src_w, uv[1] * src_h]) + M[:, 2]
    return float(p[0]), float(p[1]), float(math.hypot(M[0, 0], M[1, 0]))


# ----------------------------------------------------------------------------------------------- effects
def blend(img, layer, alpha):
    """img uint8 BGR; layer float BGR 0..255; alpha float HxW 0..1."""
    a = alpha[..., None]
    out = img.astype(np.float32) * (1 - a) + layer * a
    return np.clip(out, 0, 255).astype(np.uint8)


def draw_wavy(canvas, alpha, x0, y0, height, amp, wl, phase, thick, color, a_max, sway=0.0):
    """One stink line: a wavy vertical stroke rising from (x0, y0), faded at both ends (anti-aliased)."""
    n = 40
    pts = []
    for i in range(n + 1):
        f = i / n
        y = y0 - f * height
        x = x0 + amp * math.sin(2 * math.pi * (f * height / wl) + phase) * (0.4 + 0.6 * f) + sway * f * f
        pts.append((x, y, f))
    for i in range(n):
        xa, ya, fa = pts[i]
        xb, yb, fb = pts[i + 1]
        fm = (fa + fb) / 2
        a = a_max * smoothstep(0.0, 0.18, fm) * (1 - smoothstep(0.65, 1.0, fm))
        if a <= 0.01:
            continue
        p1, p2 = (int(xa * 4), int(ya * 4)), (int(xb * 4), int(yb * 4))
        cv2.line(canvas, p1, p2, color, int(thick), cv2.LINE_AA, shift=2)
        cv2.line(alpha, p1, p2, float(a), int(thick), cv2.LINE_AA, shift=2)


def fx_stink(img, t, e, M, sw, sh):
    """Green wavy stink lines rising from an anchor (like the reference reel)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    k = e.get("scale", 1.0) * (s / max(W / sw, H / sh)) ** 0.5
    amount = e.get("amount", 1.0)
    if "fade_in" in e:
        amount *= smoothstep(e["t0"], e["t0"] + e["fade_in"], t)
    n = e.get("n", 3)
    spread = e.get("spread", 70) * k
    canvas = np.zeros((H, W, 3), np.float32)
    alpha = np.zeros((H, W), np.float32)
    dark = np.zeros((H, W), np.float32)
    for i in range(n):
        off = (i - (n - 1) / 2) * spread
        cyc = (t * e.get("speed", 0.55) + hash1(i, 3.3)) % 1.0       # each line rises and fades in a loop
        rise = cyc * 70 * k
        a = amount * math.sin(math.pi * cyc) ** 0.7
        hgt = e.get("height", 260) * k * (0.85 + 0.3 * hash1(i, 9))
        ph = t * 4.2 + i * 2.1
        draw_wavy(dark, dark, x + off, y - rise, hgt, 16 * k, 120 * k, ph, 15 * k, 1.0, a * 0.55)
        draw_wavy(canvas, alpha, x + off, y - rise, hgt, 16 * k, 120 * k, ph, 9 * k,
                  (70, 215, 140), a)                                    # BGR lime green
    # dark soft edge first, then the bright green core
    img = blend(img, np.zeros((H, W, 3), np.float32) + np.array([20, 70, 30], np.float32), np.clip(dark, 0, 1) * 0.5)
    layer = canvas / np.maximum(alpha[..., None], 1e-3)
    return blend(img, np.clip(layer, 0, 255), np.clip(alpha, 0, 1))


def drop_shape(cx, cy, r):
    """Tear/sweat drop polygon: round bottom, pointed top."""
    pts = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        px, py = math.sin(a), -math.cos(a)
        if py < 0:                                            # upper half -> pinch to a point
            px *= (1 + py) ** 1.3
            py = py * 1.9
        pts.append((cx + r * px, cy + r * py))
    return np.array(pts, np.int32)


def fx_drops(img, t, e, M, sw, sh, kind="sweat"):
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    out = img
    for j, at in enumerate(e["at"] if isinstance(e["at"][0], (list, tuple)) else [e["at"]]):
        x, y, s = to_screen(M, at, sw, sh)
        k = e.get("scale", 1.0) * (s / max(W / sw, H / sh)) ** 0.5
        if kind == "sweat":
            lt = t - e["t0"]
            pop = smoothstep(0, 0.12, lt)
            slide = ease(min(1, max(0, (lt - 0.25) / e.get("slide", 1.2))), "in") * e.get("dist", 60) * k
            drops = [(x, y + slide, 22 * k * (0.6 + 0.4 * pop), pop)]
        else:                                                  # tears: stream of drops falling from the eye
            drops = []
            rate = e.get("rate", 6.0)
            side = -1 if j % 2 == 0 else 1
            for q in range(10):
                age = (t - e["t0"]) * rate - q
                if age < 0:
                    continue
                age = (age % 10) / rate
                if age > 0.9:
                    continue
                vx = side * e.get("fly", 0.0) * 260 * k
                dx = vx * age
                dy = 520 * k * age * age + 40 * k * age
                drops.append((x + dx, y + dy, e.get("size", 19) * k, 1 - smoothstep(0.6, 0.9, age)))
        layer = out.copy()
        for (dx, dy, r, a) in drops:
            if a <= 0:
                continue
            poly = drop_shape(dx, dy, r)
            cv2.fillPoly(layer, [poly], (60, 40, 25), cv2.LINE_AA)
            inner = drop_shape(dx, dy, r * 0.8)
            cv2.fillPoly(layer, [inner], (255, 200, 120), cv2.LINE_AA)      # light blue (BGR)
            cv2.circle(layer, (int(dx - r * 0.28), int(dy - r * 0.05)), max(1, int(r * 0.22)), (255, 255, 255), -1,
                       cv2.LINE_AA)
            out = cv2.addWeighted(layer, a, out, 1 - a, 0)
            layer = out.copy()
    return out


def fx_rings(img, t, e, M, sw, sh):
    """Sound-wave arcs bursting out of a mouth (the yell)."""
    if not (e["t0"] <= t < e["t1"]):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    layer = img.copy()
    for q in range(e.get("n", 4)):
        age = (t - e["t0"]) * e.get("rate", 3.2) - q * 0.35
        if age < 0:
            continue
        age %= 1.4
        r = 80 + age * e.get("size", 520)
        a = (1 - age / 1.4) * 0.8
        cv2.ellipse(layer, (int(x), int(y)), (int(r), int(r * 0.92)), 0, e.get("a0", 200), e.get("a1", 340),
                    (255, 255, 255), int(14 * (1 - age / 1.6)) + 2, cv2.LINE_AA)
        img = cv2.addWeighted(layer, a, img, 1 - a, 0)
        layer = img.copy()
    return img


def star(cx, cy, r):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return np.array(pts, np.int32)


def fx_sparkles(img, t, e, M, sw, sh):
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    rad = e.get("radius", 220)
    layer = img.copy()
    for i in range(e.get("n", 10)):
        ph = (t * e.get("rate", 1.6) + hash1(i, 1.7)) % 1.0
        a = math.sin(math.pi * ph)
        px = x + (hash1(i, 2.2) * 2 - 1) * rad
        py = y + (hash1(i, 4.4) * 2 - 1) * rad * 0.8
        r = (14 + 22 * hash1(i, 5.5)) * a
        if r < 2:
            continue
        cv2.fillPoly(layer, [star(px, py, r)], (200, 250, 255), cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.9, img, 0.1, 0)


HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."]


def pixel_heart(layer, cx, cy, size, fill, edge):
    """A 7x7 pixel heart centred at (cx, cy), `size` px wide (fill + darker edge + a white shine pixel)."""
    c = max(1.0, size / 7.0)
    x0, y0 = cx - 3.5 * c, cy - 3.5 * c
    for r, row in enumerate(HEART):
        for q, ch in enumerate(row):
            if ch != "X":
                continue
            nb = lambda rr, qq: 0 <= rr < 7 and 0 <= qq < 7 and HEART[rr][qq] == "X"
            col = edge if not (nb(r - 1, q) and nb(r + 1, q) and nb(r, q - 1) and nb(r, q + 1)) else fill
            cv2.rectangle(layer, (int(x0 + q * c), int(y0 + r * c)), (int(x0 + (q + 1) * c) - 1, int(y0 + (r + 1) * c) - 1), col, -1)
    cv2.rectangle(layer, (int(x0 + c), int(y0 + c)), (int(x0 + 2 * c) - 1, int(y0 + 2 * c) - 1), (235, 235, 255), -1)


def fx_hearts(img, t, e, M, sw, sh):
    """Small pink pixel hearts floating up around a point (a head), fading in and out."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    layer = img.copy()
    rad, rise, n = e.get("radius", 200), e.get("rise", 420), e.get("n", 8)
    for i in range(n):
        ph = (lt * e.get("rate", 0.9) + hash1(i, 3.1)) % 1.0
        if lt * e.get("rate", 0.9) + hash1(i, 3.1) < 1.0 and ph < hash1(i, 9.1) * 0.3:
            continue
        a = math.sin(math.pi * ph)
        px = x + (hash1(i, 1.3) * 2 - 1) * rad + 18 * math.sin(lt * 4 + i)
        py = y + 40 - ph * rise
        size = e.get("size", 46) * (0.6 + 0.6 * hash1(i, 7.7)) * (0.7 + 0.3 * a)
        pink = [(180, 110, 255), (150, 80, 250), (200, 150, 255)][i % 3]
        pixel_heart(layer, px, py, size, pink, (110, 40, 200))
    return cv2.addWeighted(layer, 0.92, img, 0.08, 0)


def fx_notes(img, t, e, M, sw, sh):
    """Colourful music notes (heads + stems + flags) popping out of a point and floating up, swaying."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    layer = img.copy()
    cols = [(255, 255, 255), (80, 220, 255), (255, 140, 250), (120, 255, 160), (255, 200, 90)]
    for i in range(e.get("n", 12)):
        ph = (lt * e.get("rate", 0.8) + hash1(i, 3.3)) % 1.0
        a = math.sin(math.pi * ph)
        px = x + (hash1(i, 1.7) * 2 - 1) * e.get("radius", 260) + 40 * math.sin(lt * 5 + i)
        py = y - ph * e.get("rise", 700)
        r = e.get("size", 26) * (0.7 + 0.5 * hash1(i, 6.1)) * (0.6 + 0.4 * a)
        if a < 0.08:
            continue
        col = cols[i % len(cols)]
        cv2.ellipse(layer, (int(px), int(py)), (int(r * 1.25), int(r)), -25, 0, 360, col, -1, cv2.LINE_AA)
        top = (int(px + r * 1.1), int(py - r * 3.6))
        cv2.line(layer, (int(px + r * 1.1), int(py)), top, col, max(2, int(r * 0.3)), cv2.LINE_AA)
        cv2.line(layer, top, (int(top[0] + r * 1.2), int(top[1] + r * 1.1)), col, max(2, int(r * 0.35)), cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.9 * min(1.0, lt / 0.15), img, 1 - 0.9 * min(1.0, lt / 0.15), 0)



def fx_bigheart(img, t, e, M, sw, sh):
    """A giant red pixel heart beating (BA-DUM: two quick pulses per beat)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    ph = (lt * e.get("hz", 1.3)) % 1.0
    beat = max(math.exp(-((ph - 0.05) / 0.06) ** 2), 0.7 * math.exp(-((ph - 0.25) / 0.06) ** 2))
    k = min(1.0, lt / 0.12)
    size = e.get("size", 520) * (0.4 + 0.6 * k) * (1 + 0.14 * beat)
    layer = img.copy()
    pixel_heart(layer, x, y, size, (60, 40, 235), (40, 20, 150))
    al = e.get("amount", 0.85)
    return cv2.addWeighted(layer, al, img, 1 - al, 0)



def fx_saltfall(img, t, e, M, sw, sh):
    """A stream of white salt grains falling from a point (the shaker mouth) for t0..t1."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    layer = img.copy()
    for i in range(e.get("n", 160)):
        ph = (lt * e.get("rate", 2.4) + hash1(i, 1.1)) % 1.0
        if lt * e.get("rate", 2.4) + hash1(i, 1.1) < 1.0 and ph < 0.02:
            continue
        px = x + (hash1(i, 2.3) * 2 - 1) * e.get("spread", 40) * (0.3 + ph)
        py = y + ph * e.get("fall", 420)
        r = 2 + 4 * hash1(i, 3.3)
        cv2.circle(layer, (int(px), int(py)), int(r), (250, 250, 250), -1, cv2.LINE_AA)
        cv2.circle(layer, (int(px), int(py)), int(r), (200, 200, 205), 1, cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.95, img, 0.05, 0)


def fx_burst(img, t, e, M, sw, sh):
    """BOOM: white salt explodes out from a point, filling the frame, then hangs like fog."""
    if t < e.get("t0", 0):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e["t0"]
    layer = img.copy()
    R = 2600 * (1 - math.exp(-lt * 5.0))
    for i in range(e.get("n", 260)):
        a = hash1(i, 4.4) * math.pi * 2
        d = R * (0.15 + 0.85 * hash1(i, 5.5))
        px, py = x + math.cos(a) * d, y + math.sin(a) * d * 0.9 + lt * 120 * hash1(i, 6.6)
        r = (10 + 40 * hash1(i, 7.7)) * (1 + lt)
        cv2.circle(layer, (int(px), int(py)), int(r), (248, 248, 246), -1, cv2.LINE_AA)
    al = min(1.0, 0.95 * math.exp(-max(0.0, lt - 0.12) * 1.6) + 0.15)
    img = cv2.addWeighted(layer, al, img, 1 - al, 0)
    fog = np.full_like(img, 245)
    k = 0.75 * math.exp(-lt * 2.2)
    return cv2.addWeighted(fog, k, img, 1 - k, 0)


def fx_snow(img, t, e, M, sw, sh):
    """Salt flakes drifting down over the whole frame (after the BOOM)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    lt = t - e.get("t0", 0)
    layer = img.copy()
    for i in range(e.get("n", 90)):
        sp = e.get("speed", 160) * (0.5 + hash1(i, 8.1))
        py = ((hash1(i, 1.9) * (H + 100)) + lt * sp) % (H + 100) - 50
        px = hash1(i, 2.9) * W + 20 * math.sin(lt * 1.5 + i)
        r = 3 + 6 * hash1(i, 3.9)
        cv2.circle(layer, (int(px), int(py)), int(r), (252, 252, 252), -1, cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.9, img, 0.1, 0)


def fx_icecube(img, t, e, M, sw, sh):
    """A little cartoon ice cube icon (cold!) bobbing above a point."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    k = min(1.0, lt / 0.15)
    sz = e.get("size", 120) * (0.4 + 0.6 * k)
    y = y - 40 + 10 * math.sin(lt * 5)
    layer = img.copy()
    top = np.array([[x, y - sz * 0.55], [x + sz * 0.55, y - sz * 0.3], [x, y - sz * 0.05], [x - sz * 0.55, y - sz * 0.3]], np.int32)
    left = np.array([[x - sz * 0.55, y - sz * 0.3], [x, y - sz * 0.05], [x, y + sz * 0.55], [x - sz * 0.55, y + sz * 0.3]], np.int32)
    right = np.array([[x + sz * 0.55, y - sz * 0.3], [x, y - sz * 0.05], [x, y + sz * 0.55], [x + sz * 0.55, y + sz * 0.3]], np.int32)
    for poly, col in ((top, (255, 248, 230)), (left, (245, 220, 170)), (right, (235, 200, 140))):
        cv2.fillPoly(layer, [poly], col, cv2.LINE_AA)
        cv2.polylines(layer, [poly], True, (160, 110, 60), 5, cv2.LINE_AA)
    cv2.line(layer, (int(x - sz * 0.35), int(y - sz * 0.15)), (int(x - sz * 0.2), int(y + sz * 0.2)), (255, 255, 255), 6, cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.95, img, 0.05, 0)


def fx_rain(img, t, e, M, sw, sh):
    """Heavy rain over the whole frame: slanted streaks at three depths (screen space) + splashes near the bottom."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    layer = img.copy()
    amt, slant = e.get("amount", 1.0), e.get("slant", 0.18)
    n = int(520 * amt)
    for i in range(n):
        depth = hash1(i, 9.9)                             # 0 far .. 1 near
        L = 40 + 110 * depth
        sp = (1500 + 2200 * depth) * e.get("speed", 1.0)
        x = hash1(i, 1.1) * (W + 300) - 150
        y = ((hash1(i, 2.2) * (H + L)) + t * sp) % (H + L) - L
        x += y * slant
        c = int(150 + 90 * depth)
        cv2.line(layer, (int(x), int(y)), (int(x + slant * L), int(y + L)), (c + 15, c + 8, c), 1 + int(depth * 2.2), cv2.LINE_AA)
    k = int(t * 30)
    for i in range(int(40 * amt * e.get("splash", 1.0))):          # splashes on the wet ground
        x = hash1(i, k * 1.7) * W; y = H * (0.72 + 0.28 * hash1(i, k * 2.3)); r = 4 + 10 * hash1(i, k * 3.1)
        cv2.ellipse(layer, (int(x), int(y)), (int(r), int(r * 0.35)), 0, 180, 360, (210, 215, 225), 2, cv2.LINE_AA)
    a = e.get("alpha", 0.55)
    return cv2.addWeighted(layer, a, img, 1 - a, 0)


def fx_swirl(img, t, e, M, sw, sh):
    """The rain swirls round him (a vortex of drops circling a point)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", 0)
    layer = img.copy()
    R0 = e.get("radius", 380)
    for i in range(e.get("n", 140)):
        r = R0 * (0.35 + 0.75 * hash1(i, 1.3)); hgt = (hash1(i, 2.7) - 0.5) * e.get("height", 1300)
        a0 = hash1(i, 3.9) * 6.283 + lt * (5.0 + 3.0 * hash1(i, 4.4)) * (1 if i % 5 else -1) * 0.8
        pts = []
        for k in range(5):
            a = a0 - k * 0.07
            pts.append((int(x + math.cos(a) * r), int(y + hgt + math.sin(a) * r * 0.28 - lt * 120 * hash1(i, 5.5))))
        front = math.sin(a0) > 0
        col = (235, 230, 225) if front else (170, 160, 160)
        cv2.polylines(layer, [np.array(pts, np.int32)], False, col, 2 if front else 1, cv2.LINE_AA)
    al = e.get("alpha", 0.75) * min(1.0, lt / 0.2)
    return cv2.addWeighted(layer, al, img, 1 - al, 0)


def jag(p0, p1, rnd, n=9, amp=0.12):
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / (L + 1e-6), (x1 - x0) / (L + 1e-6)
    pts = []
    for i in range(n + 1):
        k = i / n; off = 0 if i in (0, n) else (rnd(i) - 0.5) * 2 * amp * L
        pts.append((x0 + (x1 - x0) * k + nx * off, y0 + (y1 - y0) * k + ny * off))
    return pts


def fx_bolts(img, t, e, M, sw, sh):
    """BOOM: red lightning bolts crackling across the frame (glow + white-hot core), re-drawn every 2 frames."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    lt = t - e["t0"]
    x, y, s = to_screen(M, e["at"], sw, sh) if "at" in e else (W / 2, H / 2, 1)
    k = int(t * 15)
    glow = np.zeros_like(img); core = np.zeros_like(img)
    for b in range(e.get("n", 7)):
        rnd = lambda i, b=b: hash1(i * 3.1 + b * 7.7, k * 1.3)
        a = rnd(99) * 6.283; d = 900 + 600 * rnd(98)
        p0 = (x + math.cos(a) * d, y + math.sin(a) * d * 1.3)
        pts = np.array(jag(p0, (x + (rnd(97) - 0.5) * 120, y + (rnd(96) - 0.5) * 220), rnd, 10, 0.1), np.int32)
        cv2.polylines(glow, [pts], False, e.get("color", (40, 40, 255)), 26, cv2.LINE_AA)
        cv2.polylines(core, [pts], False, (235, 235, 255), 5, cv2.LINE_AA)
        mid = pts[len(pts) // 2]; br = np.array(jag(tuple(mid), (mid[0] + (rnd(95) - 0.5) * 500, mid[1] + (rnd(94) - 0.2) * 400), rnd, 5, 0.15), np.int32)
        cv2.polylines(glow, [br], False, e.get("color", (40, 40, 255)), 14, cv2.LINE_AA); cv2.polylines(core, [br], False, (235, 235, 255), 3, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 14)
    fade = max(0.0, 1.0 - lt / (e["t1"] - e["t0"])) ** 0.5
    out = cv2.add(img, (glow.astype(np.float32) * 1.6 * fade).clip(0, 255).astype(np.uint8))
    return cv2.add(out, (core.astype(np.float32) * fade).astype(np.uint8))


def fx_sparks(img, t, e, M, sw, sh):
    """A small fizzle of sparks (orange/white) popping out of a point and falling."""
    t0 = e.get("t0", 0)
    if t < t0 or t > t0 + e.get("life", 0.6):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - t0
    layer = img.copy()
    for i in range(e.get("n", 16)):
        a = hash1(i, 1.7) * 6.283; v = 260 + 420 * hash1(i, 2.9)
        px = x + math.cos(a) * v * lt; py = y + math.sin(a) * v * lt * 0.7 + 900 * lt * lt
        r = max(1, int(5 * (1 - lt / e.get("life", 0.6))))
        cv2.circle(layer, (int(px), int(py)), r + 2, (40, 140, 255), -1, cv2.LINE_AA)
        cv2.circle(layer, (int(px), int(py)), r, (210, 240, 255), -1, cv2.LINE_AA)
    return cv2.addWeighted(layer, 0.9, img, 0.1, 0)

def fx_particles(img, t, e, kind):
    """Confetti / rose petals / dust falling over the whole frame (screen space, deterministic)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    lt = t - e.get("t0", 0)
    layer = img.copy()
    cols = [(60, 60, 230), (60, 200, 255), (230, 160, 60), (120, 220, 90), (220, 120, 230), (255, 255, 255)]
    for i in range(e.get("n", 40)):
        sp = e.get("speed", 260) * (0.6 + 0.8 * hash1(i, 8))
        y = ((hash1(i, 1) * (H + 200)) + lt * sp) % (H + 200) - 100
        x = hash1(i, 2) * W + 40 * math.sin(lt * (1 + hash1(i, 3)) + i)
        ang = lt * 180 * (hash1(i, 4) - 0.5) + i * 37
        if kind == "confetti":
            box = cv2.boxPoints(((x, y), (22, 12), ang)).astype(np.int32)
            cv2.fillPoly(layer, [box], cols[i % len(cols)], cv2.LINE_AA)
        else:                                                   # rose petal
            cv2.ellipse(layer, (int(x), int(y)), (18, 10), ang, 0, 360, (40, 30, 190), -1, cv2.LINE_AA)
            cv2.ellipse(layer, (int(x - 3), int(y - 2)), (10, 5), ang, 0, 360, (70, 60, 225), -1, cv2.LINE_AA)
    return cv2.addWeighted(layer, e.get("alpha", 1.0), img, 1 - e.get("alpha", 1.0), 0)


def fx_zzz(img, t, e, M, sw, sh):
    """Floating "Z"s for the fake snore: thick white strokes with a dark outline, drifting up and growing."""
    if not (e["t0"] <= t < e["t1"]):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    out = img
    for i in range(3):
        ph = ((t - e["t0"]) * 0.7 + i / 3) % 1.0
        a = min(1.0, math.sin(math.pi * ph) * 1.6)
        if a < 0.08:
            continue
        r = e.get("size", 34) * (0.6 + 0.8 * ph)
        px, py = x + 170 * ph + 25 * math.sin(ph * 7), y - 320 * ph
        pts = np.array([(px - r, py - r), (px + r, py - r), (px - r, py + r), (px + r, py + r)]) * 4
        pts = pts.astype(np.int32).reshape(-1, 1, 2)
        layer = out.copy()
        th = max(4, int(r * 0.32))
        cv2.polylines(layer, [pts], False, (35, 25, 25), th + 8, cv2.LINE_AA, shift=2)
        cv2.polylines(layer, [pts], False, (255, 255, 255), th, cv2.LINE_AA, shift=2)
        out = cv2.addWeighted(layer, a, out, 1 - a, 0)
    return out


def fx_speedlines(img, t, e, M, sw, sh):
    """Anime speed lines: white streaks pointing at a centre (radial) or falling past (vertical), new every frame."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    fr = int(round(t * FPS))
    amount = e.get("amount", 0.8)
    if "fade" in e:
        amount *= 1 - smoothstep(e["t1"] - e["fade"], e["t1"], t)
    layer = img.copy()
    n = e.get("n", 46)
    if e.get("dir") == "vertical":
        for i in range(n):
            x = hash1(i, fr, 1.3) * W
            if abs(x - W / 2) < W * e.get("clear", 0.18):
                continue
            y0 = hash1(i, fr, 2.9) * H * 1.2 - 0.2 * H
            ln = (0.15 + 0.35 * hash1(i, fr, 4.1)) * H
            th = int(2 + 7 * hash1(i, fr, 5.7))
            cv2.line(layer, (int(x), int(y0)), (int(x), int(y0 + ln)), (255, 255, 255), th, cv2.LINE_AA)
    else:
        cx, cy = e.get("center", (W / 2, H / 2))
        r_in = e.get("inner", 0.42) * H
        for i in range(n):
            a = 2 * math.pi * (i + hash1(i, fr, 7.7)) / n
            r0 = r_in * (0.9 + 0.35 * hash1(i, fr, 3.1))
            r1 = 1.3 * H
            th = 2 + 10 * hash1(i, fr, 9.2)
            ca, sa = math.cos(a), math.sin(a)
            p0 = (cx + r0 * ca, cy + r0 * sa)
            pl = (cx + r1 * ca - th * sa, cy + r1 * sa + th * ca)
            pr = (cx + r1 * ca + th * sa, cy + r1 * sa - th * ca)
            cv2.fillPoly(layer, [np.array([p0, pl, pr], np.int32)], (255, 255, 255), cv2.LINE_AA)
    return cv2.addWeighted(layer, amount, img, 1 - amount, 0)


def fx_glow(img, t, e, M, sw, sh):
    """Holy glow: warm light blooming out of a point, pulsing, with slowly turning god-rays (screen add)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    amount = e.get("amount", 0.6) * (1 + e.get("pulse", 0.25) * math.sin(2 * math.pi * e.get("hz", 1.3) * t))
    if "rise" in e:
        amount *= smoothstep(e.get("t0", t), e.get("t0", t) + e["rise"], t)
    rad = e.get("radius", 520)
    yy, xx = np.ogrid[0:H, 0:W]
    d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2) / rad
    g = np.exp(-d * d * 1.6)
    n = e.get("rays", 10)
    if n:
        ang = np.arctan2(yy - y, xx - x) + 0.25 * t
        g = g + 0.55 * np.exp(-d * 0.9) * np.clip(np.cos(ang * n), 0, 1) ** 6
    col = np.array(e.get("color", (120, 215, 255)), np.float32)        # warm gold (BGR)
    out = img.astype(np.float32) + (g[..., None] * amount) * col
    return np.clip(out, 0, 255).astype(np.uint8)


def fx_fly(img, t, e, M, sw, sh):
    """A little cartoon fly buzzing around (loops round a point, wings flapping, dotted trail)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x0, y0, s = to_screen(M, e["at"], sw, sh)
    rx, ry = e.get("rx", 300), e.get("ry", 170)
    sp = e.get("speed", 1.0)

    def pos(tt_):
        q = (tt_ - e.get("t0", 0)) * sp
        return (x0 + rx * math.sin(2.1 * q * math.pi * 0.5) + 60 * math.sin(7.3 * q),
                y0 + ry * math.sin(3.2 * q * math.pi * 0.5 + 0.7) + 40 * math.cos(5.1 * q))
    layer = img.copy()
    for k in range(1, 9):                                               # dotted trail
        px, py = pos(t - k * 0.035)
        cv2.circle(layer, (int(px), int(py)), 4, (40, 40, 40), -1, cv2.LINE_AA)
    out = cv2.addWeighted(layer, 0.35, img, 0.65, 0)
    x, y = pos(t)
    r = e.get("size", 18)
    flap = math.sin(t * 2 * math.pi * 24)
    wing = out.copy()
    for side in (-1, 1):
        cv2.ellipse(wing, (int(x + side * r * 0.7), int(y - r * 0.9)), (int(r * 0.9), int(r * (0.45 + 0.25 * flap))),
                    side * 35, 0, 360, (255, 245, 235), -1, cv2.LINE_AA)
    out = cv2.addWeighted(wing, 0.7, out, 0.3, 0)
    cv2.ellipse(out, (int(x), int(y)), (int(r * 1.1), int(r * 0.8)), 0, 0, 360, (20, 20, 20), -1, cv2.LINE_AA)
    cv2.circle(out, (int(x + r * 0.9), int(y - r * 0.1)), int(r * 0.55), (30, 30, 30), -1, cv2.LINE_AA)
    cv2.circle(out, (int(x + r * 1.1), int(y - r * 0.25)), max(2, int(r * 0.22)), (40, 40, 200), -1, cv2.LINE_AA)
    return out


def old_film(img, t, e):
    """Old-film look: sepia, flicker, grain, dust specks, vertical scratches (new random pattern every frame)."""
    fr = int(round(t * FPS))
    hold = math.floor(t * 12)
    f = img.astype(np.float32)
    lum = f @ np.array([0.114, 0.587, 0.299], np.float32)
    sep = np.stack([lum * 0.62 + 18, lum * 0.86 + 10, lum * 1.05 + 14], -1)        # BGR sepia
    a = e.get("amount", 1.0)
    f = f * (1 - a) + sep * a
    f *= 1 + 0.07 * (hash1(hold, 4.2) * 2 - 1)                                       # flicker
    r = np.random.default_rng(fr * 7919 + 13)
    gr = r.normal(0, 1, (H // 3, W // 3)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)
    f += gr[..., None] * 9.0
    out = np.clip(f, 0, 255).astype(np.uint8)
    for k in range(int(r.integers(0, 3))):                                          # scratches
        x = int(r.uniform(0.05, 0.95) * W)
        c = (215, 230, 240) if r.random() < 0.6 else (30, 40, 50)
        cv2.line(out, (x, 0), (x + int(r.uniform(-20, 20)), H), c, int(r.integers(1, 3)), cv2.LINE_AA)
    for k in range(int(r.integers(2, 9))):                                          # dust
        p = (int(r.uniform(0, W)), int(r.uniform(0, H)))
        cv2.ellipse(out, p, (int(r.uniform(2, 7)), int(r.uniform(1, 4))), r.uniform(0, 180), 0, 360,
                    (25, 30, 35), -1, cv2.LINE_AA)
    if r.random() < 0.08:                                                           # rare white blotch
        cv2.circle(out, (int(r.uniform(0, W)), int(r.uniform(0, H))), int(r.uniform(10, 30)), (220, 235, 245), -1,
                   cv2.LINE_AA)
    return out


def pixelate(img, k):
    """PS1 look: draw the picture on a coarser pixel grid (k x k blocks)."""
    if k <= 1:
        return img
    small = cv2.resize(img, (W // k, H // k), interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (W, H), interpolation=cv2.INTER_NEAREST)


def letterbox(img, t, lb, t0, t1):
    """Cinema black bars (western stand-off). lb = px or (px_start, px_end) over the shot."""
    if isinstance(lb, (list, tuple)):
        px = lerp(lb[0], lb[1], ease((t - t0) / (t1 - t0) / 0.5))
    else:
        px = lb
    px = int(px)
    if px > 0:
        img[:px] = 0
        img[H - px:] = 0
    return img


def fade_black(img, t, fd):
    ta, d = fd
    a = smoothstep(ta, ta + d, t)
    if a <= 0:
        return img
    return (img.astype(np.float32) * (1 - a)).astype(np.uint8)


PIXEL = int(os.environ.get("PIXEL", "1"))      # mansion reel: smooth look (no pixelation)


def fx_censor(img, t, e, M, sw, sh):
    """The comically BIG pixel 'censored' mosaic over the toilet bowl: a grid of big square blocks in muted greys,
    beiges and browns that shuffle a little every 0.2 s. It is screen-aligned and sits on the bowl's anchor."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    k = s / max(W / sw, H / sh)                                   # grows with the camera zoom
    bw, bh = e.get("w", 600) * k, e.get("h", 480) * k
    b = max(18, int(e.get("block", 60) * k))
    nx, ny = max(2, int(round(bw / b))), max(2, int(round(bh / b)))
    x0, y0 = int(x - nx * b / 2), int(y - ny * b / 2 + e.get("dy", 0) * k)
    pal = [(196, 200, 204), (170, 176, 182), (150, 158, 166), (205, 214, 220), (140, 150, 164), (176, 168, 150),
           (150, 140, 120), (120, 112, 98), (186, 192, 176), (110, 120, 132)]           # BGR
    ph = int(t / 0.2)
    out = img.copy()
    for j in range(ny):
        for i in range(nx):
            c = pal[int(hash1(i, j, ph % 3, 7.7) * len(pal))]
            # corners rounded off a little so it reads as a blob of blocks, not a perfect square
            if (i in (0, nx - 1)) and (j in (0, ny - 1)) and nx > 3 and ny > 3:
                continue
            cv2.rectangle(out, (x0 + i * b, y0 + j * b), (x0 + (i + 1) * b - 1, y0 + (j + 1) * b - 1), c, -1)
    return out


def fx_veins(img, t, e, M, sw, sh):
    """Two throbbing cartoon veins on the forehead (purple zigzags)."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    k = (s / max(W / sw, H / sh)) * e.get("scale", 1.0) * (1 + 0.12 * math.sin(t * 2 * math.pi * 3.5))
    out = img.copy()
    for side in (-1, 1):
        pts = []
        for q in range(6):
            pts.append((x + side * (28 + 9 * q) * k, y + (-30 + 14 * q) * k + (8 * k if q % 2 else -8 * k)))
        p = np.array(pts, np.int32).reshape(-1, 1, 2)
        cv2.polylines(out, [p], False, (90, 40, 120), max(3, int(11 * k)), cv2.LINE_AA)
        cv2.polylines(out, [p], False, (150, 80, 190), max(2, int(6 * k)), cv2.LINE_AA)
    return cv2.addWeighted(out, 0.85, img, 0.15, 0)


def flicker(img, t, fl):
    """Light flicker: the frame drops to dark for a few frames at each (t, dur)."""
    for (tf, d) in fl:
        if tf <= t < tf + d:
            return (img.astype(np.float32) * 0.35).astype(np.uint8)
    return img


def fx_cloud(img, t, e, M, sw, sh):
    """The giant green smell cloud: puffy overlapping blobs (light green, darker outline) that burst out of a point
    and keep growing and wobbling."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    lt = t - e.get("t0", t)
    grow = e.get("size", 1.0) * (0.35 + 0.65 * (1 - math.exp(-lt * 5)) + 0.08 * lt)
    a = e.get("amount", 0.85) * min(1.0, lt * 8 + 0.2)
    out = img.copy()
    layer = img.copy()
    puffs = []
    for i in range(14):
        ang = hash1(i, 1.3) * 2 * math.pi
        d = (0.2 + 0.8 * hash1(i, 2.7)) * 300 * grow
        r = (70 + 90 * hash1(i, 3.1)) * grow * (1 + 0.06 * math.sin(lt * 7 + i))
        puffs.append((x + math.cos(ang) * d * 1.15, y + math.sin(ang) * d * 0.75 - 40 * grow, r))
    for (px, py, r) in puffs:
        cv2.circle(layer, (int(px), int(py)), int(r + 9), (40, 110, 50), -1, cv2.LINE_AA)
    for (px, py, r) in puffs:
        cv2.circle(layer, (int(px), int(py)), int(r), (110, 215, 140), -1, cv2.LINE_AA)
    for (px, py, r) in puffs[:8]:
        cv2.circle(layer, (int(px - r * 0.3), int(py - r * 0.3)), int(r * 0.35), (170, 240, 190), -1, cv2.LINE_AA)
    return cv2.addWeighted(layer, a, out, 1 - a, 0)


def fx_rumble(img, t, e, M, sw, sh):
    """Motion lines around a shaking thing (the rumbling belly): short curved strokes that flicker on both sides."""
    if not (e.get("t0", -1e9) <= t < e.get("t1", 1e9)):
        return img
    x, y, s = to_screen(M, e["at"], sw, sh)
    R = e.get("radius", 260) * (s / max(W / sw, H / sh)) ** 0.5
    fr = int(t * 30)
    layer = img.copy()
    for i in range(e.get("n", 6)):
        side = -1 if i % 2 else 1
        ang = (i // 2 - 1) * 0.42 + (hash1(i, fr // 2) - 0.5) * 0.2
        rr = R * (1.0 + 0.15 * hash1(i, fr // 2, 3))
        a0 = math.degrees(ang) + (180 if side < 0 else 0)
        cv2.ellipse(layer, (int(x), int(y)), (int(rr), int(rr * 0.95)), 0, a0 - 9, a0 + 9, (30, 26, 24), 12, cv2.LINE_AA)
        cv2.ellipse(layer, (int(x), int(y)), (int(rr), int(rr * 0.95)), 0, a0 - 8, a0 + 8, (255, 255, 255), 6, cv2.LINE_AA)
    return cv2.addWeighted(layer, e.get("amount", 0.9), img, 1 - e.get("amount", 0.9), 0)


def grade(img, t, g, t0, t1):
    """Colour grade: desaturate (drain), tint (multiply towards a colour), haze (green fog), dim."""
    u = (t - t0) / (t1 - t0)
    out = img.astype(np.float32)

    def val(v):
        if isinstance(v, (list, tuple)) and len(v) == 2 and not isinstance(v[0], (list, tuple)):
            return lerp(v[0], v[1], ease(u))
        return v
    if "desat" in g:
        d = val(g["desat"])
        grey = out.mean(axis=2, keepdims=True)
        out = out * (1 - d) + grey * d
    if "tint" in g:
        col, amt = g["tint"]
        amt = val(amt)
        out = out * (1 - amt) + out * (np.array(col, np.float32) / 255.0) * amt
    if "haze" in g:
        amt = val(g["haze"])
        hz = np.array([95, 190, 150], np.float32)                     # pale green (BGR)
        out = out * (1 - amt) + hz * amt
    if "dim" in g:
        out *= 1 - val(g["dim"])
    return np.clip(out, 0, 255).astype(np.uint8)


_vig = None


def vignette(img, k=0.35):
    global _vig
    if _vig is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        _vig = np.clip(1 - 0.55 * np.clip(r - 0.45, 0, None) ** 1.6, 0, 1)
    v = 1 - k * (1 - _vig)
    return (img.astype(np.float32) * v[..., None]).astype(np.uint8)


def flash(img, t, fl):
    a = 0.0
    for (tf, strength, *rest) in fl:
        d = rest[0] if rest else 0.18
        if tf <= t < tf + d:
            a = max(a, strength * (1 - (t - tf) / d))
    if a <= 0:
        return img
    return cv2.addWeighted(np.full_like(img, 255), a, img, 1 - a, 0)


# ----------------------------------------------------------------------------------------------- frame
_MOS = {}
_FA = {}


def frame_anchors(sid, k):
    """Named effect anchors (u, v) of clip frame k, measured by the 3D renderer (build/anchors/shot_XX_frames.json)."""
    if sid not in _FA:
        f = P("build", "anchors", f"shot_{sid:02d}_frames.json")
        _FA[sid] = json.load(open(f)) if os.path.exists(f) else []
    a = _FA[sid]
    return a[min(k, len(a) - 1)] if a else {}


def resolve_at(e, fa):
    """An effect whose "at" is a name (or a list of names) follows that anchor frame by frame."""
    at = e.get("at")
    if isinstance(at, str):
        if at not in fa:
            return None
        return dict(e, at=tuple(fa[at]) if not isinstance(fa[at][0], list) else [tuple(p) for p in fa[at]])
    if isinstance(at, list) and at and isinstance(at[0], str):
        pts = [tuple(fa[n]) for n in at if n in fa]
        return dict(e, at=pts) if pts else None
    return e


def mosaic_regions(sid, k):
    """Pixel-mosaic spots of clip frame k, measured by the 3D renderer (build/anchors/shot_XX_mosaic.json)."""
    if sid not in _MOS:
        f = P("build", "anchors", f"shot_{sid:02d}_mosaic.json")
        _MOS[sid] = json.load(open(f)) if os.path.exists(f) else []
    m = _MOS[sid]
    return m[min(k, len(m) - 1)] if m else []


def apply_mosaic(fr, regions, grow=1.2, blocks=7):
    """The censor blur of the reference reels: big square pixel blocks over each spot (in source pixels)."""
    if not regions:
        return fr
    out = fr.copy()
    h, w = fr.shape[:2]
    for (u, v, ru, rv) in regions:
        rx, ry = max(ru * w * grow, 16), max(rv * h * grow, 16)
        r = max(rx, ry)
        b = max(8, int(2 * r / blocks))
        x0, x1 = int(max(0, u * w - r)), int(min(w, u * w + r))
        y0, y1 = int(max(0, v * h - r)), int(min(h, v * h + r))
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        sub = out[y0:y1, x0:x1]
        small = cv2.resize(sub, (max(1, (x1 - x0) // b), max(1, (y1 - y0) // b)), interpolation=cv2.INTER_AREA)
        out[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
    return out


def render_frame(sid, src, fx, t):
    s = SHOTS[sid]
    t0, t1 = s["t0"], s["t1"]
    fr = src.frame(t - t0)
    fa = {}
    if isinstance(src, ClipSource):
        k = src.index(t - t0)
        fr = apply_mosaic(fr, mosaic_regions(sid, k))
        fa = frame_anchors(sid, k)
    sh, sw = fr.shape[:2]
    M = camera(fx, t, t0, t1, sw, sh)
    img = cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    img = pixelate(img, fx.get("pixel", PIXEL))
    if fx.get("grade"):
        img = grade(img, t, fx["grade"], t0, t1)
    if fx.get("oldfilm"):
        img = old_film(img, t, fx["oldfilm"])
    for e in fx.get("fx", []):
        e = resolve_at(e, fa)
        if e is None:
            continue
        k = e["type"]
        if k == "stink":
            img = fx_stink(img, t, e, M, sw, sh)
        elif k == "sweat":
            img = fx_drops(img, t, e, M, sw, sh, "sweat")
        elif k == "tears":
            img = fx_drops(img, t, e, M, sw, sh, "tears")
        elif k == "rings":
            img = fx_rings(img, t, e, M, sw, sh)
        elif k == "sparkles":
            img = fx_sparkles(img, t, e, M, sw, sh)
        elif k in ("confetti", "petals"):
            img = fx_particles(img, t, e, k)
        elif k == "zzz":
            img = fx_zzz(img, t, e, M, sw, sh)
        elif k == "speedlines":
            img = fx_speedlines(img, t, e, M, sw, sh)
        elif k == "glow":
            img = fx_glow(img, t, e, M, sw, sh)
        elif k == "fly":
            img = fx_fly(img, t, e, M, sw, sh)
        elif k == "hearts":
            img = fx_hearts(img, t, e, M, sw, sh)
        elif k == "bigheart":
            img = fx_bigheart(img, t, e, M, sw, sh)
        elif k == "saltfall":
            img = fx_saltfall(img, t, e, M, sw, sh)
        elif k == "burst":
            img = fx_burst(img, t, e, M, sw, sh)
        elif k == "snow":
            img = fx_snow(img, t, e, M, sw, sh)
        elif k == "icecube":
            img = fx_icecube(img, t, e, M, sw, sh)
        elif k == "rain":
            img = fx_rain(img, t, e, M, sw, sh)
        elif k == "swirl":
            img = fx_swirl(img, t, e, M, sw, sh)
        elif k == "bolts":
            img = fx_bolts(img, t, e, M, sw, sh)
        elif k == "sparks":
            img = fx_sparks(img, t, e, M, sw, sh)
        elif k == "cloud":
            img = fx_cloud(img, t, e, M, sw, sh)
        elif k == "rumble":
            img = fx_rumble(img, t, e, M, sw, sh)
        elif k == "censor":
            img = fx_censor(img, t, e, M, sw, sh)
        elif k == "veins":
            img = fx_veins(img, t, e, M, sw, sh)
        elif k == "notes":
            img = fx_notes(img, t, e, M, sw, sh)
        elif k == "label":
            axy = to_screen(M, e["at"], sw, sh)[:2] if e.get("at") else None
            img = overlays.draw_label(img, e, t, axy)
        elif k == "news":
            img = overlays.draw_news(img, t - t0, e)
        elif k == "word":
            axy = to_screen(M, e["at"], sw, sh)[:2] if e.get("at") else None
            img = overlays.draw_word(img, e, t, axy)
        elif k == "seismo":
            img = overlays.draw_seismo(img, t - t0, e)
    if fx.get("vignette", 0.25):
        img = vignette(img, fx.get("vignette", 0.25))
    if fx.get("flicker"):
        img = flicker(img, t, fx["flicker"])
    if fx.get("flash"):
        img = flash(img, t, fx["flash"])
    if fx.get("whiteout"):
        img = overlays.whiteout(img, t, *fx["whiteout"])
    if fx.get("letterbox"):
        img = letterbox(img, t, fx["letterbox"], t0, t1)
    if fx.get("fade_out"):
        img = fade_black(img, t, fx["fade_out"])
    return img


def shot_frames(sid):
    """Frame indices of shot sid (global frame k covers t = k / FPS)."""
    s = SHOTS[sid]
    k0, k1 = int(round(s["t0"] * FPS)), int(round(s["t1"] * FPS))
    return range(k0, k1)


def render_shot(sid, scale=1.0):
    import fx as FX
    fx = FX.shot_fx(sid)
    src, kind = source_for(sid, fx)
    os.makedirs(P("build"), exist_ok=True)
    out = P("build", f"seg_{sid:02d}.mp4")
    ow, oh = int(W * scale) // 2 * 2, int(H * scale) // 2 * 2
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-vf", f"scale={ow}:{oh}:flags=area", "-c:v", "libx264",
                          "-preset", "veryfast", "-crf", "10", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    n = 0
    for k in shot_frames(sid):
        img = render_frame(sid, src, fx, k / FPS)
        p.stdin.write(img.tobytes())
        n += 1
    p.stdin.close()
    p.wait()
    return sid, kind, n


def stills(outdir, ids):
    import fx as FX
    os.makedirs(outdir, exist_ok=True)
    for sid in ids:
        fx = FX.shot_fx(sid)
        src, kind = source_for(sid, fx)
        s = SHOTS[sid]
        for tag, u in (("a", 0.03), ("b", 0.5), ("c", 0.97)):
            t = s["t0"] + u * (s["t1"] - s["t0"])
            img = render_frame(sid, src, fx, t)
            cv2.imwrite(os.path.join(outdir, f"s{sid:02d}{tag}.jpg"), cv2.resize(img, (W // 2, H // 2),
                                                                                  interpolation=cv2.INTER_AREA))
    print("stills ->", outdir)


def main():
    args = [a for a in sys.argv[1:]]
    scale = 1.0
    if "--preview" in args:
        i = args.index("--preview")
        scale = float(args[i + 1])
        del args[i:i + 2]
    if "--stills" in args:
        i = args.index("--stills")
        outdir = args[i + 1]
        del args[i:i + 2]
        ids = [int(a) for a in args] or sorted(SHOTS)
        return stills(outdir, ids)
    ids = [int(a) for a in args] or sorted(SHOTS)
    jobs = int(os.environ.get("JOBS", "4"))
    # longest shots first so the pool finishes together
    ids.sort(key=lambda i: -(SHOTS[i]["t1"] - SHOTS[i]["t0"]))
    with Pool(jobs) as pool:
        for sid, kind, n in pool.starmap(render_shot, [(i, scale) for i in ids]):
            print(f"shot {sid:02d}: {n} frames from {kind}")


if __name__ == "__main__":
    main()
