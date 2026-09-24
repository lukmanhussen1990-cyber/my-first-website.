"""Pull the logo parts out of the source image as resolution-independent layers.

Every part (cloud silhouette, each eye, each letter) is stored as a signed
distance field sampled on a grid SS times finer than the source pixels.  At
render time the field is thresholded for the current on-screen scale, so the
shapes stay crisp at any size and can be animated independently.  The two
sparkles inside the eyes are fitted to a parametric 4-point star instead.
"""
from dataclasses import dataclass, field

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SS = 4  # SDF samples per source pixel


@dataclass
class Layer:
    sdf: np.ndarray        # signed distance in SDF samples, >0 inside
    origin: np.ndarray     # source-pixel coords of sdf[0, 0]
    center: np.ndarray     # pivot in source-pixel coords
    extra: dict = field(default_factory=dict)


@dataclass
class Sparkle:
    center: np.ndarray
    radius: float
    power: float
    angle: float


@dataclass
class Logo:
    cloud: Layer
    eyes: list
    stars: list
    dots: list
    letters: list
    cloud_color: tuple     # (origin, direction, length) of the white->blue ramp
    eye_rgb: np.ndarray
    text_rgb: np.ndarray
    background: np.ndarray  # smooth background plate (90x160 RGB, 0..255)


def _soft_to_sdf(soft, pad=24):
    """Soft coverage mask (0..1, source px) -> signed distance field (SS grid)."""
    soft = np.pad(soft, pad)
    up = ndi.zoom(soft, SS, order=3, grid_mode=True, mode="grid-constant")
    up = ndi.gaussian_filter(up, SS * 0.55)
    inside = up > 0.5
    far = (ndi.distance_transform_edt(~inside) * -1.0 + 0.5) * ~inside \
        + (ndi.distance_transform_edt(inside) - 0.5) * inside
    gy, gx = np.gradient(up)
    g = np.hypot(gx, gy) + 1e-6
    near = (up - 0.5) / g
    sdf = np.where(np.abs(near) < 1.5, near, far)
    return sdf.astype(np.float32), pad


def _layer(soft, y0, x0, center):
    sdf, pad = _soft_to_sdf(soft)
    origin = np.array([x0 - pad, y0 - pad], float) - 0.5 + 0.5 / SS
    return Layer(sdf, origin, np.asarray(center, float))


def _star_render(shape, cx, cy, r, p, ang):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(float)
    x, y = xx - cx, yy - cy
    c, s = np.cos(ang), np.sin(ang)
    u, v = c * x + s * y, -s * x + c * y
    f = (np.abs(u) / r) ** p + (np.abs(v) / r) ** p
    return np.clip((1 - f) * r * 0.9 + 0.5, 0, 1)


def _fit_star(img_soft, comp):
    ys, xs = np.nonzero(comp)
    w = img_soft[ys, xs]
    cy, cx = (ys * w).sum() / w.sum(), (xs * w).sum() / w.sum()
    y0, y1, x0, x1 = ys.min() - 3, ys.max() + 4, xs.min() - 3, xs.max() + 4
    target = img_soft[y0:y1, x0:x1]
    best = None
    for p in np.linspace(0.55, 1.0, 10):
        for ang in np.radians(np.linspace(-40, 40, 33)):
            for r in np.linspace(6, 11, 21):
                pred = _star_render(target.shape, cx - x0, cy - y0, r, p, ang)
                err = ((pred - target) ** 2).sum()
                if best is None or err < best[0]:
                    best = (err, r, p, ang)
    _, r, p, ang = best
    return Sparkle(np.array([cx, cy]), r, p, ang)


def load(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    lum = rgb.mean(2)

    comps, n = ndi.label(lum > 90)
    objs = ndi.find_objects(comps)
    sizes = ndi.sum(np.ones_like(lum), comps, range(1, n + 1))
    order = np.argsort(sizes)[::-1]
    cloud_id = order[0] + 1
    big = [i + 1 for i in order[1:] if sizes[i] > 500]  # the four letters

    # ---- cloud silhouette ------------------------------------------------
    cloud_bin = ndi.binary_fill_holes(comps == cloud_id)
    near = ndi.binary_dilation(cloud_bin, iterations=3)
    soft = np.clip((lum - 18) / (190 - 18), 0, 1) * near
    soft[ndi.binary_erosion(cloud_bin, iterations=2)] = 1
    ys, xs = np.nonzero(near)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    cys, cxs = np.nonzero(cloud_bin)
    cloud = _layer(soft[y0:y1, x0:x1], y0, x0, (cxs.mean(), cys.mean()))

    # white -> light-blue ramp, fitted on the cloud body
    body = ndi.binary_erosion(cloud_bin, iterations=4) & \
        ~ndi.binary_dilation((lum < 150) & cloud_bin, iterations=3)
    by, bx = np.nonzero(body)
    red = rgb[by, bx, 0]
    ok = red < 250
    A = np.c_[np.ones(ok.sum()), bx[ok], by[ok]]
    coef, *_ = np.linalg.lstsq(A, red[ok], rcond=None)
    d = -coef[1:] / np.hypot(*coef[1:])            # direction of increasing blue
    t = bx * d[0] + by * d[1]
    lo = np.percentile(t, 0.5)
    hi = np.percentile(t, 99.5)
    tn = np.clip((t - lo) / (hi - lo), 0, 1)
    nb = 24
    idx = np.minimum((tn * nb).astype(int), nb - 1)
    lut = np.array([np.median(rgb[by[idx == b], bx[idx == b]], 0) for b in range(nb)])
    lut = np.stack([ndi.gaussian_filter1d(lut[:, c], 1.0, mode="nearest")
                    for c in range(3)], -1)
    lut = np.maximum.accumulate(lut[::-1], 0)[::-1]   # keep the ramp monotone
    cloud_ramp = (lo, d, hi - lo, lut)

    # ---- eyes + sparkles --------------------------------------------------
    interior = ndi.binary_erosion(cloud_bin, iterations=4)
    eye_soft = np.clip((200 - lum) / (200 - 35), 0, 1) * interior
    eye_bin = ndi.binary_fill_holes(eye_soft > 0.5)
    elab, ne = ndi.label(eye_bin)
    eyes = []
    shine = np.clip((lum - 40) / (230 - 40), 0, 1)
    stars, dots = [], []
    for i in range(1, ne + 1):
        e = elab == i
        if e.sum() < 200:
            continue
        s = eye_soft.copy()
        s[~ndi.binary_dilation(e, iterations=2)] = 0
        s[ndi.binary_erosion(e, iterations=2)] = 1
        ys, xs = np.nonzero(ndi.binary_dilation(e, iterations=3))
        ey0, ey1, ex0, ex1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pys, pxs = np.nonzero(e)
        cov = np.cov(np.c_[pxs, pys].T)
        w, v = np.linalg.eigh(cov)
        major = v[:, 1] if v[1, 1] > 0 else -v[:, 1]  # points "down"
        lay = _layer(s[ey0:ey1, ex0:ex1], ey0, ex0, (pxs.mean(), pys.mean()))
        lay.extra["major"] = major
        eyes.append(lay)

        # highlights inside this eye
        inner = ndi.binary_erosion(e, iterations=1) & (shine > 0.5)
        hl, nh = ndi.label(inner)
        parts = sorted((np.sum(hl == j), j) for j in range(1, nh + 1))
        if len(parts) >= 1:
            stars.append(_fit_star(shine, hl == parts[-1][1]))
        if len(parts) >= 2:
            m = hl == parts[-2][1]
            yy, xx = np.nonzero(ndi.binary_dilation(m, iterations=1))
            ww = shine[yy, xx]
            c = np.array([(xx * ww).sum() / ww.sum(), (yy * ww).sum() / ww.sum()])
            dots.append((c, np.sqrt(ww.sum() / np.pi)))
    eyes.sort(key=lambda l: l.center[0])
    stars.sort(key=lambda s: s.center[0])
    dots.sort(key=lambda d: d[0][0])

    eye_px = rgb[ndi.binary_erosion(eye_bin, iterations=3) & (shine < 0.05)]
    eye_rgb = np.median(eye_px, 0)

    # ---- letters -----------------------------------------------------------
    letters = []
    text_px = []
    for lid in big:
        m = comps == lid
        near = ndi.binary_dilation(m, iterations=2)
        soft = np.clip((lum - 18) / (225 - 18), 0, 1) * near
        soft[ndi.binary_erosion(m, iterations=1)] = 1
        ys, xs = np.nonzero(near)
        ly0, ly1, lx0, lx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        mys, mxs = np.nonzero(m)
        letters.append(_layer(soft[ly0:ly1, lx0:lx1], ly0, lx0,
                              (mxs.mean(), mys.mean())))
        text_px.append(rgb[ndi.binary_erosion(m, iterations=2)])
    letters.sort(key=lambda l: l.center[0])
    text_rgb = np.median(np.concatenate(text_px), 0)

    # ---- smooth background plate (logo and stars removed) -----------------
    # median of every 24px block that is clear of the logo, then a low-order
    # polynomial fit so the gradient carries on smoothly behind the logo
    logo = ndi.binary_dilation(lum > 60, iterations=8)
    k = 24
    h, w = lum.shape
    pts, vals = [], []
    for y0 in range(0, h - k + 1, k):
        for x0 in range(0, w - k + 1, k):
            msk = ~logo[y0:y0 + k, x0:x0 + k]
            if msk.mean() > 0.9:
                blk = rgb[y0:y0 + k, x0:x0 + k][msk]
                pts.append(((x0 + k / 2) / w - 0.5, (y0 + k / 2) / h - 0.5))
                vals.append(np.median(blk, 0))
    pts, vals = np.array(pts), np.array(vals)

    def basis(x, y):
        return np.stack([x ** i * y ** j for i in range(4) for j in range(4 - i)], -1)

    coef, *_ = np.linalg.lstsq(basis(pts[:, 0], pts[:, 1]), vals, rcond=None)
    gy, gx = np.mgrid[0:90, 0:160]
    plate = basis(gx / 159 - 0.5, gy / 89 - 0.5) @ coef
    plate = plate.astype(np.float32)

    return Logo(cloud, eyes, stars, dots, letters, cloud_ramp, eye_rgb,
                text_rgb, plate)


if __name__ == "__main__":
    import sys
    L = load(sys.argv[1] if len(sys.argv) > 1 else "sora-logo.jpg")
    print("cloud", L.cloud.sdf.shape, L.cloud.center)
    for e in L.eyes:
        print("eye", e.center, e.extra["major"])
    for s in L.stars:
        print("star", s.center, s.radius, s.power, np.degrees(s.angle))
    for d in L.dots:
        print("dot", d)
    for l in L.letters:
        print("letter", l.center, l.sdf.shape)
    print("ramp", L.cloud_color, "eye", L.eye_rgb, "text", L.text_rgb)
    print("bg", L.background.shape, L.background[0, 0], L.background[-1, 80],
          L.background[45, 80])
