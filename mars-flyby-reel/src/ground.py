"""Cartoon coastal city at night: sky, stars, skyline, bay water, reflections.

The skyline is drawn once in angular coordinates (a = degrees right of the
reference azimuth, h = altitude in degrees) and sampled per frame through the
exact camera, so the city, Mars and the Moon always share one consistent sky.
"""
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

import geometry as geo
import planet
from planet import hexrgb, smoothstep

ASSETS = planet.ASSETS
A0, A1, H0, H1 = -9.0, 9.0, -0.5, 2.6       # skyline image extent (deg)
CAM_H_M = 6.0                                 # camera height above the bay (m)
SHORE_KM = 6.5


# ------------------------------------------------------------------ skyline
def _lerp(a, b, t):
    return a + (b - a) * t


def build_skyline(ppd, seed=11):
    """Return dict of uint8 layers: rgba (H,W,4), lights (H,W,3), rim (H,W)."""
    ss = 2
    Wd = int((A1 - A0) * ppd * ss)
    Hd = int((H1 - H0) * ppd * ss)
    img = Image.new("RGBA", (Wd, Hd), (0, 0, 0, 0))
    lights = Image.new("RGB", (Wd, Hd), (0, 0, 0))
    rim = Image.new("L", (Wd, Hd), 0)
    d = ImageDraw.Draw(img)
    dl = ImageDraw.Draw(lights)
    dr = ImageDraw.Draw(rim)
    rng = np.random.default_rng(seed)

    def X(a):
        return (a - A0) * ppd * ss

    def Y(h):
        return (H1 - h) * ppd * ss

    def deg(m, dist_km):
        return math.degrees(m / (dist_km * 1000.0))

    win_cols = [((255, 211, 122), 0.55), ((255, 233, 176), 0.2), ((207, 232, 255), 0.17), ((134, 240, 230), 0.08)]

    def pick_col():
        r = rng.random()
        acc = 0
        for c, p in win_cols:
            acc += p
            if r <= acc:
                return c
        return win_cols[0][0]

    def building(a, w_m, h_m, dist, body, side, style, lit_p, top=None):
        w = deg(w_m, dist)
        h = deg(h_m, dist)
        x0, x1 = X(a), X(a + w)
        yb, yt = Y(-0.02), Y(h)
        poly = [(x0, yb), (x0, yt), (x1, yt), (x1, yb)]
        roof_pts = []
        if top == "spire":
            sp = deg(h_m * 0.22, dist)
            roof_pts = [(x0 + (x1 - x0) * 0.2, yt), ((x0 + x1) / 2, Y(h + sp)), (x0 + (x1 - x0) * 0.8, yt)]
            d.polygon(roof_pts, fill=body)
            d.line([((x0 + x1) / 2, Y(h + sp)), ((x0 + x1) / 2, Y(h + sp * 1.5))], fill=body, width=max(2, int(ss * ppd * 0.004)))
        elif top == "step":
            for k, f in enumerate((0.78, 0.55)):
                cw = (x1 - x0) * f
                hh = deg(h_m * (0.06 + 0.05 * k), dist)
                cx = (x0 + x1) / 2
                ytop = Y(h + hh * (k + 1))
                d.rectangle([cx - cw / 2, ytop, cx + cw / 2, yt], fill=body)
                dr.line([(cx - cw / 2, ytop), (cx + cw / 2, ytop)], fill=255, width=max(2, int(ss * ppd * 0.006)))
        elif top == "dome":
            r = (x1 - x0) * 0.42
            cx = (x0 + x1) / 2
            d.pieslice([cx - r, yt - r, cx + r, yt + r], 180, 360, fill=body)
            dr.arc([cx - r, yt - r, cx + r, yt + r], 200, 340, fill=255, width=max(2, int(ss * ppd * 0.006)))
        elif top == "slant":
            dh = deg(h_m * 0.12, dist)
            poly = [(x0, yb), (x0, Y(h + dh)), (x1, yt), (x1, yb)]
        elif top == "mast":
            mh = deg(h_m * 0.3, dist)
            cx = (x0 + x1) / 2
            d.line([(cx, yt), (cx, Y(h + mh))], fill=body, width=max(2, int(ss * ppd * 0.005)))
            r = max(2.5, ss * ppd * 0.009)
            d.ellipse([cx - r, Y(h + mh) - r, cx + r, Y(h + mh) + r], fill=(255, 70, 60, 255))
            dl.ellipse([cx - r * 1.6, Y(h + mh) - r * 1.6, cx + r * 1.6, Y(h + mh) + r * 1.6], fill=(255, 60, 50))
        d.polygon(poly, fill=body)
        dr.polygon(poly, fill=0)                 # nearer building hides farther rim lines
        if top == "spire" and roof_pts:
            dr.polygon(roof_pts, fill=0)
        # side face (slightly darker) for a 2-tone cartoon look
        sw = (x1 - x0) * side
        d.polygon([(x1 - sw, yb), (x1 - sw, poly[2][1] if top != "slant" else yt), (x1, yt), (x1, yb)], fill=tuple(int(c * 0.82) for c in body[:3]) + (255,))
        dr.line([poly[1], poly[2]], fill=255, width=max(2, int(ss * ppd * 0.006)))
        if top in (None, "mast", "slant") and rng.random() < 0.5:
            bw = (x1 - x0) * rng.uniform(0.2, 0.35)
            bx = x0 + (x1 - x0) * rng.uniform(0.1, 0.6)
            bh = deg(rng.uniform(3, 6), dist) * ppd * ss
            d.rectangle([bx, yt - bh, bx + bw, yt], fill=body)
        # windows
        floor = deg(3.6, dist) * ppd * ss
        if floor < 3.0 or lit_p <= 0:
            return
        col_w = deg(rng.choice([3.0, 3.6, 4.2]), dist) * ppd * ss
        wh = floor * 0.56
        ww = col_w * 0.58
        n_f = int((yb - yt - floor * 1.2) // floor)
        n_c = int(((x1 - x0) - sw - col_w * 0.6) // col_w)
        if n_c < 1:
            return
        band_mode = rng.random() < 0.18
        p_floor = np.clip(rng.normal(lit_p, 0.25, n_f), 0, 1)
        for i in range(n_f):
            yy = yt + floor * (0.9 + i)
            if rng.random() > p_floor[i] * 1.2:
                continue
            col = pick_col()
            run = rng.random() < 0.35
            for j in range(n_c):
                if not run and rng.random() > 0.72:
                    continue
                xx = x0 + col_w * (0.45 + j)
                if band_mode:
                    continue
                d.rectangle([xx, yy, xx + ww, yy + wh], fill=col + (255,))
                dl.rectangle([xx, yy, xx + ww, yy + wh], fill=col)
            if band_mode:
                d.rectangle([x0 + col_w * 0.4, yy, x1 - sw - col_w * 0.3, yy + wh * 0.8], fill=col + (255,))
                dl.rectangle([x0 + col_w * 0.4, yy, x1 - sw - col_w * 0.3, yy + wh * 0.8], fill=col)

    FAR_HILL = (52, 58, 104, 255)
    FAR = (45, 52, 100, 255)
    MID = (32, 39, 84, 255)
    NEAR = (21, 27, 66, 255)
    # distant hills (20 km)
    xs = np.linspace(A0, A1, 400)
    hh = 0.10 + 0.07 * np.sin(xs * 0.9 + 1.0) + 0.05 * np.sin(xs * 2.3 + 0.3) + 0.03 * np.sin(xs * 5.1)
    pts = [(X(A0), Y(-0.02))] + [(X(a), Y(max(h, 0.02))) for a, h in zip(xs, hh)] + [(X(A1), Y(-0.02))]
    d.polygon(pts, fill=FAR_HILL)
    # far low-rise belt (14 km)
    a = A0
    while a < A1:
        w = rng.uniform(18, 60)
        h = rng.uniform(10, 45)
        building(a, w, h, 14.0, FAR, 0.2, None, 0.35)
        a += math.degrees(w / 14000.0) * rng.uniform(0.6, 1.0)
    # mid belt (10 km)
    a = A0
    while a < A1:
        w = rng.uniform(22, 55)
        h = rng.uniform(25, 110) * (1.3 if -1.0 < a < 5.0 else 1.0)
        building(a, w, h, 10.0, MID, 0.25, rng.choice([None, None, "slant", "mast"]), 0.45)
        a += math.degrees(w / 10000.0) * rng.uniform(0.55, 1.0)
    # downtown (6.5 km): taller towers to the right (under the Moon), medium under Mars
    a = -4.0
    while a < 6.0:
        w = rng.uniform(28, 55)
        center_boost = math.exp(-((a - 2.2) / 1.6) ** 2)
        h_m = rng.uniform(40, 90) + 120 * center_boost * rng.uniform(0.5, 1.0)
        if -0.9 < a < 0.7:                         # keep the sky clear below Mars in the hook
            h_m = min(h_m, rng.uniform(110, 150))
        style = rng.choice([None, "step", "spire", "dome", "mast", "slant"], p=[0.3, 0.2, 0.15, 0.1, 0.15, 0.1])
        building(a, w, h_m, SHORE_KM, NEAR, 0.28, style, 0.55)
        a += math.degrees(w / (SHORE_KM * 1000.0)) * rng.uniform(1.0, 1.7)
    # waterfront promenade + lamps
    d.rectangle([X(A0), Y(0.012), X(A1), Y(-0.02)], fill=(14, 18, 48, 255))
    n_l = int((A1 - A0) / 0.11)
    for i in range(n_l):
        aa = A0 + (i + rng.uniform(0.2, 0.8)) * 0.11
        r = max(2.0, ss * ppd * 0.0045)
        c = (255, 196, 110)
        d.ellipse([X(aa) - r, Y(0.017) - r, X(aa) + r, Y(0.017) + r], fill=c + (255,))
        dl.ellipse([X(aa) - r * 1.5, Y(0.017) - r * 1.5, X(aa) + r * 1.5, Y(0.017) + r * 1.5], fill=c)

    def down(im, mode):
        return np.asarray(im.resize((Wd // ss, Hd // ss), Image.LANCZOS if mode != "L" else Image.BILINEAR))

    rgba = down(img, "RGBA")
    li = down(lights, "RGB")
    rm = down(rim, "L")
    return dict(rgba=rgba, lights=li, rim=rm, ppd=ppd)


_SKY = {}


def skyline(ppd):
    if ppd not in _SKY:
        path = os.path.join(ASSETS, f"skyline_{ppd}.npz")
        if os.path.exists(path):
            z = np.load(path)
            _SKY[ppd] = dict(rgba=z["rgba"], lights=z["lights"], rim=z["rim"], ppd=ppd)
        else:
            s = build_skyline(ppd)
            np.savez_compressed(path, rgba=s["rgba"], lights=s["lights"], rim=s["rim"])
            _SKY[ppd] = s
        s = _SKY[ppd]
        # mirrored, vertically smeared lights for water reflections (in skyline coords)
        li = s["lights"].astype(np.float32) / 255.0
        refl = cv2.GaussianBlur(li, (0, 0), sigmaX=0.6 * ppd / 240, sigmaY=5.0 * ppd / 240)
        s["refl"] = np.clip(refl * 2.2, 0, 1)
    return _SKY[ppd]


# ------------------------------------------------------------------ stars
def make_stars(n=900, seed=5, a_range=(-12, 12), h_range=(-1, 14)):
    rng = np.random.default_rng(seed)
    a = rng.uniform(*a_range, n)
    h = rng.uniform(*h_range, n)
    mag = rng.power(2.6, n)                      # many faint, few bright
    phase = rng.uniform(0, 2 * np.pi, n)
    speed = rng.uniform(1.5, 4.0, n)
    return dict(a=a, h=h, b=mag, ph=phase, sp=speed)


STARS = make_stars()


# ------------------------------------------------------------------ view
class GroundView:
    """Camera fixed to the ground at the coastal observer.

    a_c, h_c: pointing (deg) relative to the hook reference azimuth; roll in deg.
    ts: scenario time (s from Mars closest approach) -> sky rotation + body motion.
    """

    def __init__(self, ts, a_c, h_c, fov, roll=0.0):
        self.ts = ts
        z = geo.zenith_at(ts)
        rot = geo.rot_axis(geo.SPIN_AXIS, geo.SIDEREAL_RATE * (ts - geo.T_HOOK))
        m0 = geo.mars_km(geo.T_HOOK) - geo.OBS_HOOK
        z0 = geo.ZENITH_HOOK
        ref0 = geo.unit(m0 - (m0 @ z0) * z0)
        self.up = z
        self.ref = rot @ ref0
        self.right = np.cross(self.ref, self.up)
        self.obs = geo.R_E * z
        ah, hh = math.radians(a_c), math.radians(h_c)
        fwd = math.cos(hh) * (math.cos(ah) * self.ref + math.sin(ah) * self.right) + math.sin(hh) * self.up
        self.cam = geo.Camera.look(self.obs, self.obs + fwd, self.up, fov, roll_deg=roll)

    def dir_of(self, a, h):
        a, h = np.radians(a), np.radians(h)
        return (np.cos(h)[..., None] * (np.cos(a)[..., None] * self.ref + np.sin(a)[..., None] * self.right)
                + np.sin(h)[..., None] * self.up)

    def ah_maps(self):
        d = self.cam.ray_dirs(0, 0, self.cam.w, self.cam.h)
        h = np.degrees(np.arcsin(np.clip(d @ self.up, -1, 1)))
        a = np.degrees(np.arctan2(d @ self.right, d @ self.ref))
        return a.astype(np.float32), h.astype(np.float32)

    def screen(self, a, h):
        p = self.cam.project(self.obs + 1e5 * self.dir_of(np.array(a), np.array(h)))
        return p


SKY_STOPS = [(-1.0, "#5E3F6C"), (0.0, "#6A4570"), (0.5, "#4A3768"), (1.5, "#2E2C62"), (3.5, "#1C2456"),
             (6.0, "#121A44"), (9.0, "#0C1130"), (30.0, "#0A0E28")]
SKY_STOPS_BRIGHT = [(-1.0, "#8A5A6E"), (0.0, "#94606E"), (0.5, "#6E4A70"), (1.5, "#4A3F78"), (3.5, "#2E3470"),
                    (6.0, "#222A5E"), (9.0, "#1A2150"), (30.0, "#141A44")]


def gradient(h, stops):
    xs = np.array([s[0] for s in stops], np.float32)
    cs = np.stack([hexrgb(s[1]) for s in stops])
    out = np.empty(h.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(h, xs, cs[:, c])
    return out


def ext_tint(alt):
    """Gentle warm extinction tint for bodies low in the sky."""
    k = float(np.clip((7.0 - alt) / 7.0, 0, 1))
    return np.array([1.0, 1.0 - 0.10 * k, 1.0 - 0.22 * k], np.float32)


def render(view, t_video, bright=0.0, bodies=("moon", "mars"), mars_pos=None, mars_scale=None,
           glitter_gain=1.0, water_level_px=0.0, rim_light=0.0, stars_on=1.0, moon_pos=None):
    """Render a ground frame (float32 RGB in [0,1]) and info about bodies on screen."""
    cam = view.cam
    a, h = view.ah_maps()
    img = gradient(h, SKY_STOPS)
    if bright > 0:
        img = img * (1 - bright) + gradient(h, SKY_STOPS_BRIGHT) * bright
    # city glow above the skyline
    glow = np.exp(-np.maximum(h, 0) / 0.9) * (0.55 + 0.45 * np.exp(-((a - 2.0) / 3.0) ** 2))
    img += (hexrgb("#D9855C") - img) * (glow * (0.32 + 0.12 * bright))[..., None] * (h > -0.2)[..., None]

    # stars (fade toward the horizon: haze + light pollution)
    if stars_on > 0:
        P = view.dir_of(STARS["a"], STARS["h"])
        sp = cam.project_many(view.obs + 1e6 * P)
        tw = 0.65 + 0.35 * np.sin(STARS["ph"] + t_video * STARS["sp"])
        for (x, y, z), b, hh, t in zip(sp, STARS["b"], STARS["h"], tw):
            if not (np.isfinite(x) and 2 <= x < cam.w - 2 and 2 <= y < cam.h - 2) or hh < 1.2:
                continue
            fade = float(np.clip((hh - 1.2) / 3.0, 0, 1)) * stars_on * (1 - 0.6 * bright)
            lum = (0.25 + 0.75 * b) * t * fade
            if lum < 0.05:
                continue
            xi, yi = int(x), int(y)
            rad = 1 if b < 0.85 else 2
            patch = img[yi - rad:yi + rad + 1, xi - rad:xi + rad + 1]
            yy, xx = np.mgrid[-rad:rad + 1, -rad:rad + 1]
            k = np.exp(-((xx + yi - y + 0.5) ** 2 + (yy + xi - x + 0.5) ** 2) / (0.5 + 0.35 * rad))
            patch += (np.array([0.95, 0.97, 1.0]) - patch) * np.clip(k * lum, 0, 1)[..., None]
            if b > 0.93:   # cartoon 4-point sparkle
                L = int(4 + 6 * lum)
                for dx, dy in ((1, 0), (0, 1)):
                    for s in range(-L, L + 1):
                        px, py = xi + dx * s, yi + dy * s
                        if 0 <= px < cam.w and 0 <= py < cam.h:
                            w_ = (1 - abs(s) / (L + 1)) * lum * 0.6
                            img[py, px] += (1 - img[py, px]) * w_

    info = {}
    # bodies with a soft aureole
    mars_p = geo.mars_km(view.ts) if mars_pos is None else mars_pos
    moon_p = geo.MOON_POS if moon_pos is None else moon_pos
    for kind in bodies:
        pos = mars_p if kind == "mars" else moon_p
        dvec = pos - view.obs
        alt = math.degrees(math.asin(geo.unit(dvec) @ view.up))
        pc = cam.project(pos)
        if pc is None:
            continue
        rpx = cam.f * math.tan(math.asin((geo.R_M if kind == "mars" else geo.R_L) / np.linalg.norm(dvec)))
        bri = 1.0 if kind == "moon" else 1.0
        # aureole (scattered light around a bright body)
        gr = rpx * (3.2 if kind == "mars" else 2.6) + 30
        x0, x1 = int(max(pc[0] - gr, 0)), int(min(pc[0] + gr, cam.w))
        y0, y1 = int(max(pc[1] - gr, 0)), int(min(pc[1] + gr, cam.h))
        if x1 > x0 and y1 > y0:
            yy, xx = np.mgrid[y0:y1, x0:x1]
            rr = np.sqrt((xx + 0.5 - pc[0]) ** 2 + (yy + 0.5 - pc[1]) ** 2)
            g = np.clip(1 - (rr - rpx) / (gr - rpx), 0, 1) ** 2.2 * (rr > rpx * 0.9)
            col = hexrgb("#FFB27A") if kind == "mars" else hexrgb("#FFF0D2")
            amp = (0.30 if kind == "mars" else 0.20) * (1 + 0.5 * bright)
            img[y0:y1, x0:x1] += (col - img[y0:y1, x0:x1]) * (g * amp)[..., None]
        if kind == "mars":
            ax = planet.body_axes_facing(dvec, 12, -75, view.up)
        else:
            ax = planet.moon_axes(pos)
        tint = ext_tint(alt)
        if kind == "mars" and mars_scale is not None:
            pass
        inf = planet.render(img, cam, kind, pos, ax, tint=tint, halo=True, brightness=bri)
        if inf:
            inf["alt"] = alt
            info[kind] = inf

    # skyline
    ppd = 480 if cam.px_per_deg() > 300 else 240
    sk = skyline(ppd)
    mx = ((a - A0) * ppd).astype(np.float32)
    my = ((H1 - h) * ppd).astype(np.float32)
    rgba = cv2.remap(sk["rgba"], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    al = rgba[..., 3:4].astype(np.float32) / 255.0
    bcol = rgba[..., :3].astype(np.float32) / 255.0
    if rim_light > 0:
        rm = cv2.remap(sk["rim"], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        rmf = (rm.astype(np.float32) / 255.0)[..., None] * rim_light
        bcol = bcol + (hexrgb("#FFB47C") - bcol) * rmf * 0.85
    img = img * (1 - al) + bcol * al

    # water below the shoreline
    shore = -math.degrees(CAM_H_M / (SHORE_KM * 1000.0))
    wmask = (h < shore + water_level_px * 0)
    dep = np.maximum(-h, 1e-3)
    wat = gradient(np.clip(dep * 3.0, 0, 30), [(0.0, "#26305F"), (0.6, "#1A2452"), (3.0, "#121A42"),
                                              (9.0, "#0B1233"), (30.0, "#0A1030")])
    if bright > 0:
        wat = wat * (1 + 0.45 * bright) + hexrgb("#2A1E30") * 0.15 * bright
    # reflections of city lights (mirrored, wobbling, broken into dashes)
    wob = 0.012 * np.sin(dep * 55.0 + t_video * 2.1) + 0.006 * np.sin(dep * 131.0 - t_video * 3.3)
    rx = ((a + wob - A0) * ppd).astype(np.float32)
    ry = ((H1 - (dep * 0.92)) * ppd).astype(np.float32)
    refl = cv2.remap(sk["refl"], rx, ry, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    ldep = np.log(dep + 0.02)
    zf = max(1.0, cam.px_per_deg() / 200.0)
    stripes = 0.5 + 0.5 * np.sin(ldep * 38.0 * zf + t_video * 1.6 + 0.4 * np.sin(a * 9.0 * zf))
    stripes = smoothstep(0.25, 0.75, stripes)
    fade_far = smoothstep(0.02, 0.12, dep)
    stripes = stripes * fade_far + (1 - fade_far) * 0.55
    wat = wat + refl * (0.55 * stripes)[..., None] * np.exp(-dep / 1.6)[..., None]
    # cartoon wave strokes
    wv = 0.5 + 0.5 * np.sin(ldep * 22.0 * zf - t_video * 0.8 + 1.7 * np.sin(a * 2.3 * zf + dep * 3.0 * zf + t_video * 0.4))
    strokes = smoothstep(0.93, 0.985, wv) * smoothstep(0.08, 0.6, dep) * 0.55
    wat = wat + (hexrgb("#3A4D8C") - wat) * strokes[..., None]
    img = np.where(wmask[..., None], wat, img)

    # glitter paths under bright bodies (even when the body itself is above the frame)
    for kind in bodies:
        gain = (1.0 if kind == "mars" else 0.45) * glitter_gain * (1 + 0.6 * bright)
        col = hexrgb("#FFB070") if kind == "mars" else hexrgb("#FFF2D6")
        _glitter(img, view, kind, info.get(kind, {}), t_video, gain, col, shore)
    return np.clip(img, 0, 1), info, (a, h)


_GL = {}


def _glitter(img, view, kind, inf, t, gain, col, shore):
    rng_key = kind
    if rng_key not in _GL:
        rng = np.random.default_rng(3 if kind == "mars" else 4)
        n = 2600
        dep = np.exp(rng.uniform(np.log(0.06), np.log(9.0), n))
        sig = 0.16 + 0.16 * dep
        da = rng.normal(0, 1, n) * sig
        ln = rng.uniform(0.05, 0.22, n) * (0.6 + 0.5 * np.sqrt(dep))
        b = (0.35 + 0.65 * np.exp(-0.5 * (da / sig) ** 2)) * rng.uniform(0.55, 1.0, n)
        ph = rng.uniform(0, 2 * np.pi, n)
        sp = rng.uniform(1.5, 5.0, n)
        _GL[rng_key] = (dep, da, ln, b, ph, sp)
    dep, da, ln, b, ph, sp = _GL[rng_key]
    cam = view.cam
    # body azimuth in the ground frame
    dvec = geo.unit((geo.mars_km(view.ts) if kind == "mars" else geo.MOON_POS) - view.obs)
    ab = math.degrees(math.atan2(dvec @ view.right, dvec @ view.ref))
    if "pos_override" in inf:
        pass
    tw = 0.25 + 0.75 * (0.5 + 0.5 * np.sin(ph + t * sp)) ** 2
    keep = (dep > -shore) & (b * tw * gain > 0.05)
    if not keep.any():
        return
    H, W = img.shape[:2]
    layer = np.zeros((H, W), np.uint8)
    for d_, a_, l_, bb in zip(dep[keep], da[keep], ln[keep], (b * tw)[keep]):
        p0 = view.screen(ab + a_ - l_ / 2, -d_)
        p1 = view.screen(ab + a_ + l_ / 2, -d_)
        if p0 is None or p1 is None:
            continue
        thick = int(np.clip(1 + d_ * 0.55, 1, 6))
        v = int(np.clip(bb * 255, 0, 255))
        cv2.line(layer, (int(p0[0] * 16), int(p0[1] * 16)), (int(p1[0] * 16), int(p1[1] * 16)), v, thick,
                 lineType=cv2.LINE_AA, shift=4)
    g = (layer.astype(np.float32) / 255.0) * gain
    img += (col - img) * np.clip(g, 0, 1)[..., None]
