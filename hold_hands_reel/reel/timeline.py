"""The 30-second story: which picture is on screen when, how the zooms blend, and all the text."""
from math import cos, pi, sin

import cv2
import numpy as np

from . import atoms, micro, post
from . import hands as hd
from . import handscene as hs
from . import overlay as ov

W, H, FPS, DUR = 1080, 1920, 30, 30.0
NFRAMES = int(FPS * DUR)
FX, FY = 540.0, 900.0  # centre of the measured gap = where every zoom is aimed
LZ = 3.0  # each zoom transition covers 2^3 = 8x
T_IN, T_OUT = 0.5, 0.3  # a zoom starts 0.5 s before its mark and lands 0.3 s after

# (start second, times halved, top label, bottom label)
STAGES = [
    (0.0, 0, "their hand", "your hand"),
    (3.0, 2, "their fingertip", "your palm"),
    (6.0, 5, "palm lines", "palm lines"),
    (9.0, 10, "skin cells", "skin cells"),
    (12.0, 14, "surface of a cell", "surface of a cell"),
    (15.0, 18, "cell membrane", "cell membrane"),
    (18.0, 22, "molecules", "molecules"),
    (21.0, 26, "their atoms", "your atoms"),
]
KINDS = ["hands", "hands", "m2", "m3", "m4", "m5", "m6", "atoms", "hold"]
MARKS = [3.0, 6.0, 9.0, 12.0, 15.0, 18.0, 21.0, 25.0]
OUT0, OUT1 = 24.55, 25.75  # the zoom back out to the hands

HOOK = ["You have never really held", "anyone's hand."]
END_LINES = ["You never touched.", "But you still felt it."]

# voice-over script: (start second, text). Subtitles follow the same timing.
SCRIPT = [
    (0.0, "You have never really held anyone's hand."),
    (3.0, "Even the people you love the most…"),
    (6.0, "Let's zoom in. Closer."),
    (9.0, "Even their skin cells… never touch yours."),
    (14.0, "Closer still."),
    (18.0, "Down to the molecules. Still a gap."),
    (21.0, "At the atoms, electrons push each other away. They never truly meet."),
    (25.0, "But here's the beautiful part… you still feel them."),
    (28.0, "Because closeness was never about touching."),
]
# on-screen subtitle cues: (start, end, text)
CUES = [
    (0.0, 2.6, "You have never really held anyone's hand."),
    (3.0, 5.7, "Even the people you love the most…"),
    (6.0, 8.3, "Let's zoom in. Closer."),
    (9.0, 12.4, "Even their skin cells… never touch yours."),
    (14.0, 15.6, "Closer still."),
    (18.0, 20.8, "Down to the molecules. Still a gap."),
    (21.0, 23.2, "At the atoms, electrons push each other away."),
    (23.2, 24.9, "They never truly meet."),
    (25.0, 27.9, "But here's the beautiful part… you still feel them."),
    (28.0, 30.0, "Because closeness was never about touching."),
]


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = clamp(x)
    return x * x * x * (x * (x * 6 - 15) + 10)


def lerp(a, b, t):
    return a + (b - a) * t


def fmt_len(n):
    """2 cm halved n times, as a short label."""
    if n >= 26:
        return "0.3 nm"
    cm = 2.0 / (2**n)
    if cm >= 1.0:
        v, u = cm, "cm"
    elif cm >= 0.1:
        v, u = cm * 10, "mm"
    elif cm >= 1e-4:
        v, u = cm * 1e4, "µm"
    else:
        v, u = cm * 1e7, "nm"
    s = "%.0f" % v if v >= 100 else "%.1f" % v if v >= 10 else "%.2f" % v
    return s + " " + u


# ----------------------------------------------------------------------------------------------
# picture layers
# ----------------------------------------------------------------------------------------------
def hands_open(RW, RH, t, zmul=1.0):
    """Shots 1+2: the hands 2 cm apart, then the move down to the fingertip 5 mm above the palm."""
    e = smoother((t - 2.45) / 0.9)
    t0 = clamp(t / 2.45)
    t1 = clamp((t - 3.35) / 2.95)
    gap = 2.0 * (0.25**e)
    dist = (40.0 - 3.0 * t0) * ((8.5 / 37.0) ** e) * (1.0 - 0.05 * t1)
    az = -18.0 - 3.0 * t0 - 15.0 * e - 3.0 * t1
    el = lerp(12.0, 10.5, e)
    focal = 4.2 * ((7.0 / 4.2) ** e) * zmul
    A, B, top, bot = hs.place_hands(gap, 0.0, 0.0, life=t)
    cam = hd.make_camera((top + bot) / 2, dist, az, el, focal, 0.0, (960.0 - FY) / 960.0)
    LP = hs.lights(key_az=lerp(-35.0, -140.0, e), key_el=lerp(50.0, 24.0, e))
    img = hs.render(RW, RH, A, B, cam, LP, top, lerp(34.0, 46.0, e), lerp(26.0, 34.0, e), lerp(0.76, 0.78, e))
    p0 = hd.project(cam, top, W, H)
    p1 = hd.project(cam, bot, W, H)
    return img, (p0[1], p1[1]), gap


def hands_hold(RW, RH, t):
    """Last shot: pull back from between the palms to the two hands holding, in warm light."""
    e = smoother((t - OUT0) / (OUT1 - OUT0))
    tau = clamp((t - OUT1) / (DUR - OUT1))
    zm = 2.0 ** (LZ * (1.0 - e))
    sq = 0.9 * smooth((t - 27.0) / 1.0) - 0.3 * smooth((t - 28.4) / 1.4)
    A, B, top, bot = hs.place_hands(0.02, 1.0, sq, life=t)
    target = np.array([0.4, 0.7, -0.4])
    az = -6.0 + 10.0 * clamp((t - OUT0) / (DUR - OUT0))
    cy = lerp((960.0 - FY) / 960.0, HOLD_CY, e)
    cam = hd.make_camera(target, 74.0 + 8.0 * tau, az, 50.0 - 3.0 * tau, 4.0 * zm, 0.0, cy)
    g = smooth((t - 25.1) / 2.2)
    LP = hs.lights(golden=lerp(0.4, 0.85, g), glow=0.15 * g, glow_xy=(0.0, cy + 0.10), key_az=-35.0, key_el=50.0, glow_r=0.5)
    img = hs.render(RW, RH, A, B, cam, LP, target, 16.0, 16.0, 0.64)
    return img


HOLD_CY = -0.19  # where the held hands sit on screen (below centre, leaving room for the end text)


def drift(t):
    return np.array([0.020 * t, 0.030 * t, -0.016 * t + 0.4, 0.022 * t])


def layer(kind, RW, RH, t, fi, zoom, gblur):
    """Render one stage at a given zoom (1 = its normal framing) and transition blur."""
    s = RH / 1920.0
    if kind == "hands":
        img, _, _ = hands_open(RW, RH, t, zmul=zoom)
        if gblur > 0.2:
            img = post.gblur(img, gblur * s)
        return img
    if kind == "hold":
        img = hands_hold(RW, RH, t)
        if gblur > 0.2:
            img = post.gblur(img, gblur * s)
        return img
    if kind == "atoms":
        img = atoms.render(RW, RH, t - 21.0, fi, zoom, gblur, 0.9)
        if gblur > 0.2:
            img = post.gblur(img, gblur * s * 0.6)
        return img
    st = int(kind[1])
    img = micro.render(RW, RH, st, t, zoom, gblur * s, drift(t), 1.0)
    if gblur > 0.2:
        img = post.gblur(img, gblur * s * 0.7)
    return img


def life_zoom(i, t):
    """Slow push-in while stage i is on screen (so the camera never stops moving)."""
    a = (MARKS[i - 1] - T_IN) if i > 0 else 0.0
    b = MARKS[i] + T_OUT if i < len(MARKS) else DUR
    return 1.0 + 0.07 * clamp((t - a) / (b - a))


def scene(t, fi, RW, RH):
    """The picture at time t (render size RW x RH) plus what the overlay needs to know."""
    info = dict(zblur=0.0, zc=(FX, FY), line=None, line_a=1.0, e=None, b=None)
    # ---- the final zoom out
    if t >= OUT0:
        p = (t - OUT0) / (OUT1 - OUT0)
        if p < 1.0:
            e = smoother(p)
            w = smooth((e - 0.30) / 0.30)
            gb = 46.0 * sin(pi * clamp(e)) ** 1.2
            img = None
            if w < 1.0:
                z = (2.0 ** (-LZ * e)) * life_zoom(7, t)
                img = layer("atoms", RW, RH, t, fi, z, gb)
            if w > 0.0:
                inc = layer("hold", RW, RH, t, fi, 1.0, gb * 0.8)
                img = inc if img is None else img * (1 - w) + inc * w
            info["zblur"] = 0.42 * sin(pi * p) ** 1.5
            info["zc"] = (FX, lerp(FY, 960.0 - HOLD_CY * 960.0, e))
            info["line_a"] = 1.0 - smooth(p / 0.2)
            info["line"] = (FY + micro.VT * 960.0, FY + micro.VB * 960.0)
            info["e"] = e
            info["b"] = 7
            return img, info
        info["line_a"] = 0.0
        return layer("hold", RW, RH, t, fi, 1.0, 0.0), info

    # ---- which stage / transition are we in?
    i = 0
    while i < len(MARKS) - 1 and t >= MARKS[i] + T_OUT:
        i += 1
    T = MARKS[i]
    in_tr = (t >= T - T_IN) and i < 7
    if i == 0:
        # shots 1 -> 2 are one continuous camera move in 3D
        img, (y0, y1), gap = hands_open(RW, RH, t)
        info["line"] = (y0, y1)
        p = (t - 2.45) / 0.9
        if 0.0 < p < 1.0:
            info["zblur"] = 0.20 * sin(pi * p) ** 1.5
        info["gap"] = gap
        return img, info
    if not in_tr:
        k = KINDS[i]
        z = life_zoom(i, t)
        if k == "hands":
            img, (y0, y1), gap = hands_open(RW, RH, t)
            info["line"] = (y0, y1)
        else:
            img = layer(k, RW, RH, t, fi, z, 0.0)
            info["line"] = (FY + micro.VT * 960.0 * z, FY + micro.VB * 960.0 * z)
        return img, info

    # ---- zoom-in transition from stage i to stage i+1
    p = (t - (T - T_IN)) / (T_IN + T_OUT)
    e = smoother(p)
    w = smooth((e - 0.36) / 0.28)
    gb_out = 50.0 * smooth(e / 0.5)
    gb_in = 50.0 * (1.0 - smooth((e - 0.5) / 0.5))
    img = None
    if w < 1.0:
        img = layer(KINDS[i], RW, RH, t, fi, (2.0 ** (LZ * e)) * life_zoom(i, t), gb_out)
    if w > 0.0:
        zi = (2.0 ** (LZ * (e - 1.0))) * life_zoom(i + 1, t)
        inc = layer(KINDS[i + 1], RW, RH, t, fi, zi, gb_in)
        img = inc if img is None else img * (1 - w) + inc * w
    info["zblur"] = 0.5 * sin(pi * p) ** 1.5
    info["line_a"] = max(1.0 - smooth(e / 0.2), smooth((e - 0.8) / 0.2))
    zl = life_zoom(i + 1, t) if e > 0.5 else 1.0
    info["line"] = (FY + micro.VT * 960.0 * zl, FY + micro.VB * 960.0 * zl)
    if KINDS[i] == "hands" and e < 0.5:
        info["line"] = hands_line(t)
    info["e"] = e
    info["b"] = i
    return img, info


def hands_line(t):
    """Screen position of the measuring line during the hand shots (without rendering)."""
    e = smoother((t - 2.45) / 0.9)
    t0 = clamp(t / 2.45)
    t1 = clamp((t - 3.35) / 2.95)
    gap = 2.0 * (0.25**e)
    dist = (40.0 - 3.0 * t0) * ((8.5 / 37.0) ** e) * (1.0 - 0.05 * t1)
    focal = 4.2 * ((7.0 / 4.2) ** e)
    half = 0.5 * gap * focal / dist * 960.0
    return FY - half, FY + half


# ----------------------------------------------------------------------------------------------
# floating specks: they streak outwards during every zoom
# ----------------------------------------------------------------------------------------------
class Specks:
    def __init__(self, n=54, seed=3):
        r = np.random.default_rng(seed)
        self.ang = r.random(n) * 2 * pi
        self.ph = r.random(n) * 5.0
        self.br = 0.06 + 0.22 * r.random(n) ** 2
        self.sz = 0.7 + 0.8 * r.random(n)
        self.tw = r.random(n) * 6.28
        # golden bokeh for the ending
        m = 34
        self.gx = r.random(m) * W
        self.gy = r.random(m) * H
        self.gs = 5.0 + 20.0 * r.random(m) ** 2
        self.gb = 0.05 + 0.16 * r.random(m)
        self.gp = r.random(m) * 6.28
        self.gv = 14.0 + 30.0 * r.random(m)

    @staticmethod
    def logzoom(t):
        z = 0.10 * min(t, OUT0)
        z += LZ * smoother((t - 2.45) / 0.9) * 0.67
        for T in MARKS[1:7]:
            z += LZ * smoother((t - (T - T_IN)) / (T_IN + T_OUT))
        z -= 2.2 * LZ * smoother((t - OUT0) / (OUT1 - OUT0))
        return z

    @staticmethod
    def _dot(img, x, y, sig, r, g, b):
        rad = int(sig * 3) + 1
        x0, x1 = int(x) - rad, int(x) + rad + 1
        y0, y1 = int(y) - rad, int(y) + rad + 1
        if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
            return
        xa, xb = max(0, x0), min(W, x1)
        ya, yb = max(0, y0), min(H, y1)
        xs = np.arange(xa, xb, dtype=np.float32) + 0.5 - x
        ys = np.arange(ya, yb, dtype=np.float32) + 0.5 - y
        gk = np.exp(-(ys[:, None] ** 2 + xs[None, :] ** 2) / (2 * sig * sig))
        img[ya:yb, xa:xb, 0] += gk * r
        img[ya:yb, xa:xb, 1] += gk * g
        img[ya:yb, xa:xb, 2] += gk * b

    def draw(self, img, t, zc):
        Z = self.logzoom(t)
        fade = 1.0 - smooth((t - 25.2) / 1.0)
        if fade > 0.0:
            for k in range(len(self.ang)):
                lr = (Z + self.ph[k]) % 5.0
                rad = 34.0 * (2.0**lr)
                x = zc[0] + rad * cos(self.ang[k])
                y = zc[1] + rad * sin(self.ang[k]) * 1.2
                op = smooth(lr / 1.2) * (1.0 - smooth((lr - 4.2) / 0.8))
                br = self.br[k] * op * fade * (0.75 + 0.25 * sin(t * 2.0 + self.tw[k]))
                sig = self.sz[k] * (1.3 + 1.9 * lr)
                self._dot(img, x, y, sig, br, br * 0.90, br * 0.80)
        g = smooth((t - 25.4) / 1.8)
        if g > 0.0:
            for k in range(len(self.gx)):
                y = (self.gy[k] - self.gv[k] * (t - 25.0)) % H
                x = self.gx[k] + 26.0 * sin(t * 0.6 + self.gp[k])
                edge = smooth(y / 260.0) * smooth((H - y) / 260.0)
                br = self.gb[k] * g * edge * (0.7 + 0.3 * sin(t * 1.7 + self.gp[k] * 3.0))
                self._dot(img, x, y, self.gs[k], br, br * 0.70, br * 0.30)


# ----------------------------------------------------------------------------------------------
# text and measuring line
# ----------------------------------------------------------------------------------------------
def hud_state(t):
    """What the label block says at time t: (number text, halved n, top label, bottom label, label opacity)."""
    i = 0
    while i < len(STAGES) - 1 and t >= STAGES[i + 1][0] - T_IN:
        i += 1
    # inside the transition that leads into stage i?
    T = STAGES[i][0]
    n1 = STAGES[i][1]
    if i > 0 and t < T + T_OUT:
        n0 = STAGES[i - 1][1]
        if i == 1:
            e = smoother((t - 2.45) / 0.9)
        else:
            e = smoother((t - (T - T_IN)) / (T_IN + T_OUT))
        steps = n1 - n0
        n = n0 + min(steps, int(e * (steps + 1) * 0.999 + 0.0)) if e < 1 else n1
        n = min(n, n1)
        # labels swap half way through
        if e < 0.5:
            lab = STAGES[i - 1]
            la = 1.0 - smooth(e / 0.4)
        else:
            lab = STAGES[i]
            la = smooth((e - 0.6) / 0.4)
        return fmt_len(n), n, lab[2], lab[3], la
    return fmt_len(n1), n1, STAGES[i][2], STAGES[i][3], 1.0


def draw_overlay(frame, t, info):
    # ---------------- measuring line + label block
    a_all = 1.0 - smooth((t - OUT0) / 0.3)
    if a_all > 0.0 and info.get("line") is not None:
        frame *= 1.0 - 0.30 * a_all * _scrim("hud")  # soft dark patch so the labels always read
        y0, y1 = info["line"]
        ov.measure_line(frame, FX, y0, y1, opacity=a_all * info.get("line_a", 1.0))
        num, n, top, bot, la = hud_state(t)
        x = FX + 34
        yc = FY
        still = smooth((t - 22.7) / 0.35)
        blk = a_all * (1.0 - still)
        if blk > 0.0:
            lab = dict(shadow=(0, 3, 7, 1.7), stroke=2, stroke_fill=(28, 14, 12))
            ov.put_text(frame, num, ov.F_XBOLD, 86, x, yc - 118, opacity=blk)
            ov.put_text(frame, "halved %d times" % n if n != 1 else "halved 1 time", ov.F_SEMI, 41, x + 2, yc - 14, opacity=blk)
            ov.put_text(frame, top, ov.F_BOLD, 41, x, yc + 42, opacity=blk * la, fill=ov.PEACH, tri="up", **lab)
            ov.put_text(frame, bot, ov.F_BOLD, 41, x, yc + 96, opacity=blk * la, fill=ov.PINKBLUE, tri="down", **lab)
        if still > 0.0:
            ov.put_text(frame, "still 0.3 nm apart", ov.F_XBOLD, 60, x, yc - 38, opacity=a_all * still)
    # ---------------- hook
    if t < 3.0:
        a = 1.0 - smooth((t - 2.6) / 0.4)
        frame *= 1.0 - 0.34 * a * _scrim("hook")
        for k, ln in enumerate(HOOK):
            ov.put_text(frame, ln, ov.F_XBOLD, 64, W / 2, 300 + k * 84, anchor="c", opacity=a, shadow=(0, 5, 12, 0.9))
    # ---------------- end card
    if t > 26.4:
        frame *= 1.0 - 0.30 * smooth((t - 26.4) / 0.8) * _scrim("end")
        for k, ln in enumerate(END_LINES):
            ts = 26.5 + 0.85 * k
            a = smooth((t - ts) / 0.6)
            if a <= 0.0:
                continue
            dy = 16.0 * (1.0 - a)
            y = END_Y + k * 96 + dy
            if k == 0:
                ov.put_text(frame, ln, ov.F_XBOLD, 68, W / 2, y, anchor="c", opacity=a, shadow=(0, 5, 14, 0.9))
            else:
                f = ov.font(ov.F_XBOLD, 68)
                tw = f.getlength(ln)
                hs_ = 62
                total = tw + 18 + hs_
                x0 = W / 2 - total / 2
                ov.put_text(frame, ln, ov.F_XBOLD, 68, x0, y, anchor="l", opacity=a, shadow=(0, 5, 14, 0.9))
                beat = 1.0 + 0.07 * max(0.0, sin((t - 27.4) * 2 * pi * 1.05)) ** 3
                size = int(round(hs_ * beat))
                hl, pad = ov.heart_layer(size)
                ov.blit(frame, hl, x0 + tw + 18 + hs_ / 2 - hl.shape[1] / 2, y + 46 - hl.shape[0] / 2, a)
    # ---------------- subtitles
    for (a0, a1, text) in CUES:
        if a0 <= t < a1:
            a = min(1.0 if a0 == 0.0 else smooth((t - a0) / 0.12 + 0.35), smooth((a1 - t) / 0.12 + 0.2))
            ov.subtitle(frame, text, opacity=a)
            break


END_Y = 610
_scrims = {}


def _scrim(name):
    """Soft-edged dark patches that sit behind text (kept subtle: they only steady the contrast)."""
    if name not in _scrims:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        if name == "hud":
            m = np.exp(-(((xx - (FX + 215)) / 300.0) ** 2 + ((yy - FY) / 185.0) ** 2))
        elif name == "hook":
            m = np.exp(-(((yy - 385.0) / 190.0) ** 2)) * (0.75 + 0.25 * np.exp(-(((xx - W / 2) / 520.0) ** 2)))
        else:  # end card
            m = np.exp(-(((xx - W / 2) / 520.0) ** 2 + ((yy - (END_Y + 100)) / 200.0) ** 2))
        _scrims[name] = m[..., None].astype(np.float32)
    return _scrims[name]


class Renderer:
    """Turns a time into a finished 1080x1920 frame."""

    def __init__(self, scale=2.0 / 3.0):
        self.RW = int(round(W * scale / 2)) * 2
        self.RH = int(round(H * scale / 2)) * 2
        self.fin = post.Finisher(W, H)
        self.specks = Specks()

    def frame(self, fi, overlay=True):
        t = fi / FPS
        img, info = scene(t, fi, self.RW, self.RH)
        if (self.RW, self.RH) != (W, H):
            img = cv2.resize(img, (W, H), interpolation=cv2.INTER_CUBIC)
        img = np.ascontiguousarray(img, dtype=np.float32)
        self.specks.draw(img, t, info["zc"])
        if info["zblur"] > 0.004:
            img = post.zoom_blur(img, info["zblur"], info["zc"][0], info["zc"][1])
        g = smooth((t - 25.2) / 2.0)
        img = self.fin(img, bloom=0.22 + 0.10 * g, grain=0.042, warmth=0.8 * g, edge_blur=7.0)
        if overlay:
            draw_overlay(img, t, info)
        return (np.clip(img, 0, 1) * 255.0 + 0.5).astype(np.uint8)
