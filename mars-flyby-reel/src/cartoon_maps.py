"""Turn real NASA / SSS planet maps into flat 'cartoon' maps.

The shapes come from the real data (posterized albedo, land/ocean masks,
cloud and city-light maps), so features sit where they really are; the
palette and outlines make them read as a cartoon.
Maps are equirectangular, lon -180..180 left->right, lat +90 at the top.
"""
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "..", "tex")
ASSETS = os.path.join(HERE, "..", "assets")
W, H = 4096, 2048


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def load(name, size=(W, H)):
    im = Image.open(os.path.join(TEX, name)).convert("RGB")
    im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def smooth_labels(labels, k, sigma):
    """Majority-smooth a label map so regions become clean cartoon blobs."""
    acc = np.zeros(labels.shape + (k,), np.float32)
    for i in range(k):
        acc[..., i] = cv2.GaussianBlur((labels == i).astype(np.float32), (0, 0), sigma,
                                       borderType=cv2.BORDER_WRAP if hasattr(cv2, "BORDER_WRAP") else cv2.BORDER_REFLECT)
    return np.argmax(acc, axis=-1)


def wrap_blur(img, sigma):
    pad = int(3 * sigma) + 2
    ext = np.concatenate([img[:, -pad:], img, img[:, :pad]], axis=1)
    ext = cv2.GaussianBlur(ext, (0, 0), sigma)
    return ext[:, pad:-pad]


def smooth_labels_wrap(labels, k, sigma):
    acc = np.stack([wrap_blur((labels == i).astype(np.float32), sigma) for i in range(k)], -1)
    return np.argmax(acc, axis=-1)


def quantize(values, edges):
    out = np.zeros(values.shape, np.int32)
    for e in edges:
        out += (values > e).astype(np.int32)
    return out


def ll_to_xy(lon, lat, w=W, h=H):
    return (lon + 180.0) / 360.0 * w, (90.0 - lat) / 180.0 * h


class Canvas:
    """Supersampled drawing in map coordinates (handles the cos(lat) stretch)."""

    def __init__(self, base_rgb, ss=2):
        self.ss = ss
        self.img = Image.fromarray((np.clip(base_rgb, 0, 1) * 255).astype(np.uint8)).resize(
            (W * ss, H * ss), Image.NEAREST)
        self.d = ImageDraw.Draw(self.img, "RGBA")

    def _xy(self, lon, lat):
        x, y = ll_to_xy(lon, lat)
        return x * self.ss, y * self.ss

    def ellipse(self, lon, lat, r_deg, fill=None, outline=None, width=0):
        # Small-circle on the sphere drawn as an ellipse stretched by 1/cos(lat)
        cx, cy = self._xy(lon, lat)
        ry = r_deg / 180.0 * H * self.ss
        rx = ry / max(np.cos(np.radians(lat)), 0.2)
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline,
                       width=int(width * self.ss))

    def polyline(self, pts, fill, width):
        xy = [self._xy(lo, la) for lo, la in pts]
        self.d.line(xy, fill=fill, width=int(width * self.ss), joint="curve")
        r = width * self.ss / 2
        for x, y in xy:
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    def result(self):
        return np.asarray(self.img.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0


def rgba(h, a=255):
    c = (hexrgb(h) * 255).astype(int)
    return (int(c[0]), int(c[1]), int(c[2]), a)


# ---------------------------------------------------------------- MARS
MARS_PAL = ["#7A3522", "#A84A2B", "#CB6537", "#E08A4E", "#EFAA6C"]


def build_mars():
    src = load("sss_mars_8k.jpg")
    lum = 0.30 * src[..., 0] + 0.59 * src[..., 1] + 0.11 * src[..., 2]
    lum = wrap_blur(lum, 2.0)
    lat = np.linspace(90, -90, H)[:, None] * np.ones((1, W))
    q = np.quantile(lum[np.abs(lat) < 60], [0.07, 0.25, 0.55, 0.85])
    lab = quantize(lum, q)
    lab = smooth_labels_wrap(lab, 5, 7.0)
    pal = np.stack([hexrgb(h) for h in MARS_PAL])
    rgb = pal[lab]
    # Polar caps from the real map (bright + desaturated near the poles)
    sat = src.max(-1) - src.min(-1)
    cap = ((lum > 0.62) & (sat < 0.22) & (lat > 72)).astype(np.float32)
    cap = (wrap_blur(cap, 6.0) > 0.45).astype(np.float32)
    lon = np.linspace(-180, 180, W, endpoint=False)[None, :] * np.ones((H, 1))
    wob = 1.6 * np.sin(np.radians(lon) * 5 + 0.7) + 0.9 * np.sin(np.radians(lon) * 11 + 2.1)
    cap = np.maximum(cap, (lat > 79.0 + wob).astype(np.float32))          # north residual cap
    cap = np.maximum(cap, (lat < -84.5 + 0.6 * wob).astype(np.float32))   # smaller south cap
    cap_s = wrap_blur(cap, 1.2)[..., None]
    rgb = rgb * (1 - cap_s) + hexrgb("#F6F0E6") * cap_s

    cv = Canvas(rgb)
    # Tharsis volcanoes (real positions; cartoon shields with calderas)
    shield, rim, cald = rgba("#E9A46A"), rgba("#8E3E24", 255), rgba("#7A3522")
    cv.ellipse(-133.8, 18.65, 5.1, fill=rgba("#EDB07A"), outline=rim, width=5)   # Olympus Mons
    cv.ellipse(-133.8, 18.65, 3.2, fill=rgba("#F3BF8A"))
    cv.ellipse(-133.8, 18.4, 0.95, fill=cald, outline=rgba("#5E2818"), width=2)
    for lon, la, r in ((-120.1, -8.26, 3.0), (-113.4, 0.8, 2.6), (-104.5, 11.8, 2.8)):
        cv.ellipse(lon, la, r, fill=shield, outline=rim, width=4)
        cv.ellipse(lon, la, r * 0.32, fill=cald)
    # Valles Marineris: a jagged canyon system (Ius-Melas-Coprates + Candor/Ophir + Noctis)
    rng = np.random.default_rng(42)

    def canyon(center, widths, fill, rim=None):
        lo = np.array([p[0] for p in center], float)
        la = np.array([p[1] for p in center], float)
        fine = np.linspace(0, len(center) - 1, 60)
        lo_f = np.interp(fine, np.arange(len(center)), lo)
        la_f = np.interp(fine, np.arange(len(center)), la)
        w_f = np.interp(fine, np.linspace(0, len(center) - 1, len(widths)), widths)
        jit = rng.normal(0, 0.18, (2, len(fine)))
        top = [(x, y + w / 2 + j) for x, y, w, j in zip(lo_f, la_f, w_f, jit[0])]
        bot = [(x, y - w / 2 - j) for x, y, w, j in zip(lo_f, la_f, w_f, jit[1])]
        pts = [cv._xy(x, y) for x, y in top + bot[::-1]]
        if rim is not None:
            cv.d.line([cv._xy(x, y + 0.35) for x, y in top], fill=rim, width=int(5 * cv.ss), joint="curve")
        cv.d.polygon(pts, fill=fill, outline=rgba("#4A1F14"))

    main = [(-92, -7.6), (-86, -8.2), (-80, -9.4), (-74, -10.4), (-68, -11.8), (-62, -13.2),
            (-56, -13.4), (-50, -12.6), (-44, -11.0), (-39, -9.2)]
    canyon(main, [1.4, 2.0, 2.6, 3.2, 2.6, 2.2, 1.9, 1.7, 1.5], rgba("#5E2818"), rim=rgba("#F2B37C"))
    canyon([(-76, -4.6), (-70, -5.4), (-64, -6.4)], [1.4, 2.0, 1.2], rgba("#6A2D1B"), rim=rgba("#F2B37C"))
    canyon([(-60, -9.0), (-54, -8.6), (-48, -8.0)], [0.9, 1.1, 0.8], rgba("#6A2D1B"))
    for k in range(9):   # Noctis Labyrinthus: short criss-crossing troughs
        x0 = -104 + rng.uniform(0, 9)
        y0 = -9 + rng.uniform(-3, 3)
        ang = rng.uniform(0, np.pi)
        L = rng.uniform(1.5, 3.0)
        canyon([(x0, y0), (x0 + L * np.cos(ang), y0 + L * np.sin(ang))], [0.55, 0.55], rgba("#6A2D1B"))
    # A few big craters / basins on the visible face
    for lon, la, r in ((-81.4, -52.0, 2.1), (-30.9, -50.6, 1.95), (-17.0, 15.0, 1.6),
                       (-63.0, 32.0, 1.3), (-150.0, -15.0, 1.5), (-95.0, -38.0, 1.4)):
        cv.ellipse(lon, la, r, fill=rgba("#C25B32", 120), outline=rgba("#7A3522", 230), width=3)
    cv.ellipse(-43.4, -49.7, 7.5, fill=rgba("#F0B07A", 90), outline=rgba("#8E3E24", 160), width=3)  # Argyre
    out = cv.result()
    np.save(os.path.join(ASSETS, "mars_cartoon.npy"), out.astype(np.float16))
    Image.fromarray((out * 255).astype(np.uint8)).resize((1024, 512), Image.LANCZOS).save(
        os.path.join(ASSETS, "prev_mars_cartoon.png"))


# ---------------------------------------------------------------- MOON
def build_moon():
    src = load("lroc_color_2k.tif", (2048, 1024))
    lum = src.mean(-1)
    lum = cv2.GaussianBlur(lum, (0, 0), 1.5)
    q = np.quantile(lum, [0.16, 0.42])
    lab = quantize(lum, q)
    lab = smooth_labels_wrap(lab, 3, 3.0)
    pal = np.stack([hexrgb(h) for h in ("#9EA1AF", "#CFCABD", "#ECE7DA")])
    rgb = pal[lab]
    big = cv2.resize(rgb, (W, H), interpolation=cv2.INTER_NEAREST)
    cv = Canvas(big)
    for lon, la, r in ((-11.4, -43.3, 1.6), (-20.1, 9.6, 1.6), (-38.0, 8.1, 0.8), (-47.4, 23.7, 0.8),
                       (61.0, -8.9, 2.4), (60.4, -25.3, 3.0), (-9.4, 51.6, 1.8), (-68.6, -5.2, 3.0)):
        cv.ellipse(lon, la, r, fill=rgba("#F4F0E6", 140), outline=rgba("#8D8F9C", 220), width=3)
    out = cv.result()
    np.save(os.path.join(ASSETS, "moon_cartoon.npy"), out.astype(np.float16))
    Image.fromarray((out * 255).astype(np.uint8)).resize((1024, 512), Image.LANCZOS).save(
        os.path.join(ASSETS, "prev_moon_cartoon.png"))


# ---------------------------------------------------------------- EARTH
def build_earth():
    bm = load("bm_topo_5400.jpg")
    spec = load("sss_earth_spec_8k.tif").mean(-1)
    water = wrap_blur((spec > 0.5).astype(np.float32), 2.5) > 0.5
    land = ~water
    hsv = cv2.cvtColor((bm * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    v = hsv[..., 2] / 255.0
    s = hsv[..., 1] / 255.0
    r, g, b = bm[..., 0], bm[..., 1], bm[..., 2]
    # Land classes: 0 forest, 1 grass, 2 dry/savanna, 3 desert, 4 ice
    cls = np.full(land.shape, 1, np.int32)
    greenness = g - 0.5 * (r + b)
    cls[(greenness > 0.035) & (v < 0.42)] = 0
    cls[(r > g * 1.02) & (v > 0.38)] = 2
    cls[(r > g * 1.05) & (v > 0.55) & (s > 0.25)] = 3
    cls[(v > 0.72) & (s < 0.18)] = 4
    lat = np.linspace(90, -90, H)[:, None] * np.ones((1, W))
    cls[np.abs(lat) > 64] = np.where(v[np.abs(lat) > 64] > 0.55, 4, cls[np.abs(lat) > 64])
    cls = smooth_labels_wrap(cls, 5, 4.0)
    land_pal = np.stack([hexrgb(h) for h in ("#3F8C4E", "#6CB15A", "#B9B067", "#E0C27F", "#F1F5F7")])
    # Ocean: deep vs shallow from the bathymetry shading
    ocean_lab = smooth_labels_wrap((v > 0.30).astype(np.int32), 2, 4.0)
    ocean_pal = np.stack([hexrgb(h) for h in ("#2C63AE", "#3C86C6")])
    rgb = np.where(land[..., None], land_pal[cls], ocean_pal[ocean_lab])
    # Coastline: thin darker outline makes continents pop in cartoon style
    lm = wrap_blur(land.astype(np.float32), 1.0)
    edge = np.clip(1.0 - np.abs(lm - 0.5) * 6.0, 0, 1)[..., None] * 0.35
    rgb = rgb * (1 - edge) + hexrgb("#1E3E66") * edge
    np.save(os.path.join(ASSETS, "earth_day_cartoon.npy"), rgb.astype(np.float16))
    np.save(os.path.join(ASSETS, "earth_land_mask.npy"), lm.astype(np.float16))

    # Night side: flat navy with cartoon city-light dots from Black Marble
    night = np.where(land[..., None], hexrgb("#24305C"), hexrgb("#141C3D")).astype(np.float32)
    bmk = load("blackmarble_3600.jpg").mean(-1)
    # Remove the flat ice/desert background so only real city light remains
    bg = cv2.medianBlur((bmk * 255).astype(np.uint8), 31).astype(np.float32) / 255.0
    rng = np.random.default_rng(7)
    p = np.clip((bmk - bg - 0.05) / 0.5, 0, 1) ** 1.3
    p[~land] = 0
    p[np.abs(lat) > 72] = 0
    lights = np.zeros((H, W), np.float32)
    ys, xs = np.nonzero(rng.random(p.shape) < p * 0.05)
    for x, y in zip(xs, ys):
        rad = 2 if rng.random() < 0.8 else 3
        cv2.circle(lights, (int(x), int(y)), rad, 1.0, -1, lineType=cv2.LINE_AA)
    glow = wrap_blur(cv2.resize(p, (W, H)) * 1.0, 6.0) * 0.55
    np.save(os.path.join(ASSETS, "earth_night_cartoon.npy"), night.astype(np.float16))
    np.save(os.path.join(ASSETS, "earth_lights.npy"), np.clip(np.stack([lights, glow], -1), 0, 1).astype(np.float16))

    # Clouds: flat white cartoon blobs (soft 2-px edge)
    cl = load("sss_clouds_8k.jpg").mean(-1)
    cl = wrap_blur(cl, 5.0)
    alpha = np.clip((cl - 0.42) / 0.06, 0, 1)
    np.save(os.path.join(ASSETS, "earth_clouds.npy"), alpha.astype(np.float16))
    prev = rgb * (1 - alpha[..., None] * 0.9) + alpha[..., None] * 0.9
    Image.fromarray((np.clip(prev, 0, 1) * 255).astype(np.uint8)).resize((1024, 512), Image.LANCZOS).save(
        os.path.join(ASSETS, "prev_earth_cartoon.png"))
    pn = night + lights[..., None] * hexrgb("#FFD86E")
    Image.fromarray((np.clip(pn, 0, 1) * 255).astype(np.uint8)).resize((1024, 512), Image.LANCZOS).save(
        os.path.join(ASSETS, "prev_earth_night.png"))


if __name__ == "__main__":
    import sys
    which = sys.argv[1:] or ["mars", "moon", "earth"]
    for wname in which:
        globals()["build_" + wname]()
        print("built", wname)
