"""Cartoon (cel-shaded) sphere renderer for Earth, Mars and the Moon.

Exact ray-sphere geometry (true angular sizes and true Sun direction), then a
flat toon look: posterized maps, a hard terminator, one mid-tone band,
a thin lit-limb highlight, a dark outline and a thin atmosphere halo.
"""
import math
import os

import cv2
import numpy as np

import geometry as geo

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
OUTLINE = np.array([0.043, 0.059, 0.141], np.float32)      # #0B0F24


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


class Pyramid:
    def __init__(self, arr):
        a = np.asarray(arr, np.float32)
        self.levels = [a]
        while self.levels[-1].shape[1] > 256:
            p = self.levels[-1]
            self.levels.append(cv2.resize(p, (p.shape[1] // 2, p.shape[0] // 2), interpolation=cv2.INTER_AREA))

    def sample(self, lat, lon, r_px):
        base_w = self.levels[0].shape[1]
        k = int(np.clip(math.floor(math.log2(max(base_w / (2 * math.pi) / max(r_px, 1e-3), 1.0))), 0,
                        len(self.levels) - 1))
        img = self.levels[k]
        h, w = img.shape[:2]
        u = ((lon + math.pi) / (2 * math.pi) * w - 0.5).astype(np.float32)
        v = np.clip((math.pi / 2 - lat) / math.pi * h - 0.5, 0, h - 1.001).astype(np.float32)
        return cv2.remap(img, u, v, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)


_CACHE = {}


def maps(name):
    if name not in _CACHE:
        if name == "mars":
            _CACHE[name] = dict(day=Pyramid(np.load(os.path.join(ASSETS, "mars_cartoon.npy"))))
        elif name == "moon":
            _CACHE[name] = dict(day=Pyramid(np.load(os.path.join(ASSETS, "moon_cartoon.npy"))))
        elif name == "earth":
            lights = np.load(os.path.join(ASSETS, "earth_lights.npy")).astype(np.float32)
            _CACHE[name] = dict(
                day=Pyramid(np.load(os.path.join(ASSETS, "earth_day_cartoon.npy"))),
                night=Pyramid(np.load(os.path.join(ASSETS, "earth_night_cartoon.npy"))),
                clouds=Pyramid(np.load(os.path.join(ASSETS, "earth_clouds.npy")).astype(np.float32)[..., None]),
                lights=Pyramid(lights))
    return _CACHE[name]


STYLE = {
    "mars": dict(shadow_mul=hexrgb("#4A3A6E") * 1.05, shadow_add=hexrgb("#120C26"), halo=hexrgb("#F6BE90"),
                 halo_strength=0.38, halo_width=0.022, rim=0.10),
    "moon": dict(shadow_mul=hexrgb("#545A86"), shadow_add=hexrgb("#0E1230"), halo=None, rim=0.08),
    "earth": dict(shadow_mul=None, shadow_add=None, halo=hexrgb("#8FD6FF"), halo_strength=0.70,
                  halo_width=0.030, rim=0.08),
}
RADIUS = {"mars": geo.R_M, "moon": geo.R_L, "earth": geo.R_E}


def body_axes_facing(view_dir, sub_lat, sub_lon, up_hint):
    """Body axes (columns x,y,z in world) so the point (sub_lat, sub_lon) faces the viewer
    and the body's north pole points as close to up_hint as possible."""
    n = -geo.unit(view_dir)                         # surface normal at the sub-viewer point
    up = geo.unit(up_hint - (up_hint @ n) * n)
    la, lo = math.radians(sub_lat), math.radians(sub_lon)
    # In body coords the sub-viewer normal is s; choose z (pole) as cos(la) up + ... :
    # pole = sin(la) n + cos(la) up  (pole lies in the plane of n and up)
    z = math.sin(la) * n + math.cos(la) * up
    # equatorial direction of the sub-viewer meridian
    e = geo.unit(n - (n @ z) * z)
    x = math.cos(lo) * e - math.sin(lo) * np.cross(z, e)
    y = np.cross(z, x)
    return np.stack([x, y, z], 1)


def earth_axes(t):
    """Physical Earth orientation: spin axis + observer at 20.7S, 40.3W at the hook."""
    zb = geo.SPIN_AXIS
    zen = geo.zenith_at(t)
    e_obs = geo.unit(zen - (zen @ zb) * zb)
    xb = geo.rot_axis(zb, math.radians(40.3)) @ e_obs
    yb = np.cross(zb, xb)
    return np.stack([xb, yb, zb], 1)


def moon_axes(moon_pos):
    xb = geo.unit(-moon_pos)                        # near side faces Earth
    zb = geo.unit(np.array([0, 0, 1.0]) - (np.array([0, 0, 1.0]) @ xb) * xb)
    yb = np.cross(zb, xb)
    return np.stack([xb, yb, zb], 1)


def over(canvas, x0, y0, rgb, a):
    """Alpha-composite rgb (h,w,3) with coverage a (h,w) onto canvas at (x0,y0)."""
    h, w = a.shape
    H, W = canvas.shape[:2]
    cx0, cy0 = max(x0, 0), max(y0, 0)
    cx1, cy1 = min(x0 + w, W), min(y0 + h, H)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    sl = (slice(cy0 - y0, cy1 - y0), slice(cx0 - x0, cx1 - x0))
    aa = a[sl][..., None]
    canvas[cy0:cy1, cx0:cx1] = canvas[cy0:cy1, cx0:cx1] * (1 - aa) + rgb[sl] * aa


def render(canvas, cam, kind, pos, axes, sun=geo.SUN, tint=None, halo=True, outline=True,
           brightness=1.0, extra=None):
    """Draw one body. Returns its screen info dict (centre, radius_px) or None if off-screen."""
    r = RADIUS[kind]
    oc = np.asarray(pos, float) - cam.pos
    dist = np.linalg.norm(oc)
    if dist <= r * 1.001:
        return None
    pc = cam.project(pos)
    alpha = math.asin(r / dist)
    if pc is None:
        if (oc / dist) @ cam.R[2] < -math.sin(alpha):   # entirely behind the camera
            return None
        pc = np.array([np.nan, np.nan, 0.0])
    r_px = cam.f * math.tan(alpha)
    st = STYLE[kind]
    ow = float(np.clip(r_px * 0.02, 1.1, 5.0)) if outline else 0.0
    hw = (st["halo_width"] * r_px + 3.0) if (halo and st.get("halo") is not None) else 0.0
    # exact screen bbox from the silhouette circle (plus outline/halo margin)
    H, W = canvas.shape[:2]
    u0 = oc / dist
    a_ = geo.unit(np.cross(u0, [0.0, 0.0, 1.0] if abs(u0[2]) < 0.9 else [1.0, 0.0, 0.0]))
    b_ = np.cross(u0, a_)
    rs = r * math.cos(alpha)
    cen = cam.pos + u0 * (dist - r * math.sin(alpha))
    ang = np.linspace(0, 2 * math.pi, 48, endpoint=False)
    sil = cen + rs * (np.cos(ang)[:, None] * a_ + np.sin(ang)[:, None] * b_)
    sp = cam.project_many(sil)
    if np.any(~np.isfinite(sp[:, 0])) or np.any(sp[:, 2] <= 0):
        x0, y0, x1, y1 = 0, 0, W, H
    else:
        m_ = ow + hw + 4
        x0, x1 = int(math.floor(sp[:, 0].min() - m_)), int(math.ceil(sp[:, 0].max() + m_))
        y0, y1 = int(math.floor(sp[:, 1].min() - m_)), int(math.ceil(sp[:, 1].max() + m_))
    if x1 < 0 or y1 < 0 or x0 >= W or y0 >= H:
        return None
    x0c, y0c, x1c, y1c = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    info = dict(x=float(pc[0]), y=float(pc[1]), r_px=float(r_px), dist=float(dist))
    if r_px < 0.9 and np.isfinite(pc[0]):  # sub-pixel: a soft dot
        col = (maps(kind)["day"].levels[-1].reshape(-1, 3).mean(0) if kind != "earth" else hexrgb("#5DA0E0"))
        if tint is not None:
            col = col * tint
        yy, xx = np.mgrid[y0c:y1c, x0c:x1c]
        d2 = (xx + 0.5 - pc[0]) ** 2 + (yy + 0.5 - pc[1]) ** 2
        a = np.exp(-d2 / (2 * 0.8 ** 2)) * min(1.0, 0.35 + r_px) * brightness
        over(canvas, x0c, y0c, np.broadcast_to(col, a.shape + (3,)).astype(np.float32), a.astype(np.float32))
        return info

    d = cam.ray_dirs(x0c, y0c, x1c, y1c)                  # (h,w,3) world
    b = d @ oc
    cos_t = np.clip(b / dist, -1, 1)
    theta = np.arccos(cos_t)
    xs = np.arange(x0c, x1c) + 0.5 - cam.cx
    ys = np.arange(y0c, y1c) + 0.5 - cam.cy
    rr2 = (xs[None, :] ** 2 + ys[:, None] ** 2) / cam.f ** 2
    px_per_rad = cam.f / (1.0 + rr2)                      # local angular -> pixel scale
    e_px = (alpha - theta) * px_per_rad                   # >0 inside the disk
    cov = np.clip(0.5 + e_px, 0, 1)
    disc = np.maximum(b * b - (dist * dist - r * r), 0.0)
    t = b - np.sqrt(disc)
    P = d * t[..., None] - oc                             # hit point relative to centre
    N = P / np.linalg.norm(P, axis=-1, keepdims=True)
    ndl = N @ sun
    mu = np.clip(-(N * d).sum(-1), 0, 1)
    nb = N @ axes                                         # body-fixed normal
    lat = np.arcsin(np.clip(nb[..., 2], -1, 1))
    lon = np.arctan2(nb[..., 1], nb[..., 0])
    m = maps(kind)
    base = m["day"].sample(lat, lon, r_px)[..., :3]

    wlit = max(1.6 / max(r_px, 1.0), 0.004)
    lit = smoothstep(-wlit, wlit, ndl)
    band = smoothstep(0.20 - wlit, 0.20 + wlit, ndl)
    day = base * (0.86 + 0.14 * band)[..., None]
    if kind == "earth":
        cl = m["clouds"].sample(lat, lon, r_px)
        cl = cl[..., 0] if cl.ndim == 3 else cl
        day = day * (1 - 0.92 * cl[..., None]) + 0.97 * 0.92 * cl[..., None]
        night = m["night"].sample(lat, lon, r_px)[..., :3]
        lg = m["lights"].sample(lat, lon, r_px)
        night = night * (1 - 0.55 * cl[..., None]) + hexrgb("#2E3767") * 0.55 * cl[..., None]
        city = np.clip(lg[..., 0] * 1.0 + lg[..., 1] * 0.6, 0, 1.2)[..., None] * (1 - 0.5 * cl[..., None])
        night = night + city * hexrgb("#FFD46E")
        haze = (1 - mu) ** 2.2 * 0.55 * lit
        day = day * (1 - haze[..., None]) + hexrgb("#A8DBFF") * haze[..., None]
        shadow = night
    else:
        shadow = base * st["shadow_mul"] + st["shadow_add"]
        if kind == "mars":
            haze = (1 - mu) ** 3.0 * 0.35 * lit
            day = day * (1 - haze[..., None]) + hexrgb("#F7C9A0") * haze[..., None]
    rim = smoothstep(0.80, 0.94, 1 - mu) * smoothstep(0.15, 0.45, ndl) * st["rim"]
    day = day + rim[..., None]
    col = shadow * (1 - lit[..., None]) + day * lit[..., None]
    if tint is not None:
        col = col * tint
    col = col * brightness
    if extra is not None:
        col = extra(col, dict(N=N, ndl=ndl, lat=lat, lon=lon, lit=lit, mu=mu, cov=cov))

    sub = canvas[y0c:y1c, x0c:x1c]
    if hw > 0:
        # halo just outside the outline, only where the limb is sunlit
        ring_d = -(e_px + ow)                               # px outside the outline
        g = np.exp(-np.maximum(ring_d, 0) / max(hw * 0.38, 0.8)) * (ring_d > -0.5)
        g = g * smoothstep(-0.05, 0.35, ndl) * st["halo_strength"]
        hc = st["halo"] if tint is None else st["halo"] * tint
        sub[:] = sub * (1 - g[..., None]) + hc * g[..., None]
    if ow > 0:
        oc_cov = np.clip(0.5 + e_px + ow, 0, 1)
        sub[:] = sub * (1 - oc_cov[..., None]) + OUTLINE * oc_cov[..., None]
    sub[:] = sub * (1 - cov[..., None]) + col * cov[..., None]
    return info
