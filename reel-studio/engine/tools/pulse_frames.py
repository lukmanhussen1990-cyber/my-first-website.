#!/usr/bin/env python3
"""Pulsing broodsac loop: swells and relaxes once per cycle while the bands
travel along the sac. Writes N full-size RGBA frames per image so the player can
swap them in (build/assets/pulse_<name>/NNN.png) and records them in manifest.json.

Sacs are described in geometry.json under "pulse": {
  "<image>": {"sacs": [{"axis": [[x,y], ...] (base -> tip, normalized), "halfw": 0.03 (of width)}],
              "amp": 0.13, "shift": 0.035}}
Usage: python3 pulse_frames.py PROJECT_DIR [--frames 30] [--only name]
"""
import argparse, json, os
import numpy as np
import cv2
from PIL import Image


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def beat(ph):
    """Heartbeat-like swell: quick rise (30% of the cycle), slower relax."""
    ph = ph % 1.0
    if ph < 0.3:
        return np.sin(np.pi / 2 * ph / 0.3) ** 2
    return np.cos(np.pi / 2 * (ph - 0.3) / 0.7) ** 2


def axis_frame(axis):
    a = np.array(axis, np.float64)
    seg = a[1:] - a[:-1]
    L = np.hypot(seg[:, 0], seg[:, 1])
    cum = np.concatenate([[0], np.cumsum(L)])
    return a, seg, L, cum


def project(px, py, a, seg, L, cum):
    """Nearest point on the polyline: returns u (0..1 along), v (signed dist), seg index."""
    best_d = np.full(px.shape, np.inf); u = np.zeros(px.shape); v = np.zeros(px.shape)
    for i in range(len(seg)):
        dx, dy = seg[i]
        t = ((px - a[i, 0]) * dx + (py - a[i, 1]) * dy) / (L[i] ** 2)
        tc = np.clip(t, 0, 1) if 0 < i < len(seg) - 1 else (np.clip(t, None, 1) if i == 0 else np.clip(t, 0, None))
        if len(seg) == 1:
            tc = t
        qx, qy = a[i, 0] + tc * dx, a[i, 1] + tc * dy
        d = np.hypot(px - qx, py - qy)
        sgn = np.sign(dx * (py - a[i, 1]) - dy * (px - a[i, 0]))
        m = d < best_d
        best_d = np.where(m, d, best_d)
        u = np.where(m, (cum[i] + tc * L[i]) / cum[-1], u)
        v = np.where(m, sgn * d, v)
    return u, v


def point_at(u, a, seg, L, cum):
    s = np.clip(u, -0.2, 1.2) * cum[-1]
    i = np.clip(np.searchsorted(cum, s) - 1, 0, len(seg) - 1)
    t = (s - cum[i]) / L[i]
    px = a[i, 0] + t * seg[i, 0]; py = a[i, 1] + t * seg[i, 1]
    nx, ny = -seg[i, 1] / L[i], seg[i, 0] / L[i]
    return px, py, nx, ny


def warp_sac(img, sac, ph, amp, shift):
    H, W = img.shape[:2]
    axis = [[x * W, y * H] for x, y in sac["axis"]]
    a, seg, L, cum = axis_frame(axis)
    hw = sac["halfw"] * W
    strip = hw * 1.45
    x0 = int(max(0, a[:, 0].min() - strip - 4)); x1 = int(min(W, a[:, 0].max() + strip + 4))
    y0 = int(max(0, a[:, 1].min() - strip - 4)); y1 = int(min(H, a[:, 1].max() + strip + 4))
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float64)
    u, v = project(xs, ys, a, seg, L, cum)
    inside = (u > -0.02) & (u < 1.10) & (np.abs(v) < strip)
    b = beat(ph)
    # swelling: a bulge travelling base -> tip on top of an overall swell
    wave = 0.65 + 0.35 * np.sin(2 * np.pi * (1.3 * u - ph))
    taper = smoothstep(0.0, 0.16, u) * (1 - 0.55 * smoothstep(0.82, 1.02, u))
    s = 1 + amp * b * wave * taper
    # band drift along the sac (rings appear to crawl up and back)
    du = shift * np.sin(np.pi * np.clip(u, 0, 1)) * (np.sin(2 * np.pi * (ph - 0.6 * u)) * 0.6 + b * 0.6)
    u_src = u - du
    av = np.abs(v)
    w1 = hw * s
    # inside the swollen half-width: compress v; beyond it blend linearly back to identity at the strip edge
    g_in = av * (1 - 1 / s)
    edge_g = w1 * (1 - 1 / s)
    g_out = edge_g * np.clip((strip - av) / np.maximum(strip - w1, 1e-6), 0, 1)
    g = np.where(av <= w1, g_in, g_out)
    v_src = np.sign(v) * (av - g)
    du_eff = np.where(av <= w1, du, du * np.clip((strip - av) / np.maximum(strip - w1, 1e-6), 0, 1))
    u_src = u - du_eff
    px, py, nx, ny = point_at(u_src, a, seg, L, cum)
    sx = px + nx * v_src * np.where(True, 1, 1)
    sy = py + ny * v_src
    # nx, ny is the left normal; v sign was computed with the same convention
    mapx = np.where(inside, sx, xs).astype(np.float32)
    mapy = np.where(inside, sy, ys).astype(np.float32)
    region = img[y0:y1, x0:x1]
    full_mapx = mapx - 0; full_mapy = mapy - 0
    out = img.copy()
    warped = cv2.remap(img, full_mapx, full_mapy, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # a little extra sheen on the swollen sac
    gain = 1 + 0.07 * b * taper * (av <= w1)
    warped = warped.astype(np.float32)
    warped[..., :3] = np.clip(warped[..., :3] * gain[..., None], 0, 255)
    out[y0:y1, x0:x1] = np.where(inside[..., None], warped, region)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--frames", type=int, default=30)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    geo = json.load(open(os.path.join(a.project, "geometry.json")))
    cfg = geo.get("pulse", {})
    adir = os.path.join(a.project, "build", "assets")
    mpath = os.path.join(adir, "manifest.json")
    manifest = json.load(open(mpath))
    for name, pc in cfg.items():
        if a.only and name != a.only:
            continue
        src = os.path.join(adir, name + ".png")
        if not os.path.exists(src):
            print("-- missing", name); continue
        img = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32)
        # premultiply so transparent edges warp cleanly
        rgb = img[..., :3] * (img[..., 3:] / 255.0)
        pm = np.dstack([rgb, img[..., 3]])
        out_dir = os.path.join(adir, f"pulse_{name}"); os.makedirs(out_dir, exist_ok=True)
        for i in range(a.frames):
            ph = i / a.frames
            fr = pm
            for sac in pc["sacs"]:
                fr = warp_sac(fr, sac, ph, pc.get("amp", 0.13), pc.get("shift", 0.035))
            al = np.clip(fr[..., 3:], 1e-3, 255)
            rgb = np.clip(fr[..., :3] / (al / 255.0), 0, 255)
            rgb = np.where(fr[..., 3:] < 1, 0, rgb)
            Image.fromarray(np.dstack([rgb, fr[..., 3]]).astype(np.uint8), "RGBA").save(os.path.join(out_dir, f"{i:03d}.png"), compress_level=4)
        manifest["images"].setdefault(name, {})["pulseFrames"] = a.frames
        print(f"ok pulse_{name}: {a.frames} frames")
    json.dump(manifest, open(mpath, "w"), indent=1)


if __name__ == "__main__":
    main()
