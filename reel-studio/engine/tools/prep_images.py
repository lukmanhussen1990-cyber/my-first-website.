#!/usr/bin/env python3
"""Prepare a project's images for the player.

For every image listed in project.json that exists in images/:
  * background removal when there is no real alpha (plain white/flat background)
  * edge clean-up and trim to the subject (+ small padding)
  * an X-ray "ghost" version (see-through grey silhouette with rim light)
Outputs build/assets/<name>.png, xray_<name>.png and manifest.json.
Pulse frames (eye-stalk swelling loop) are made by pulse_frames.py.

Per image in project.json: "mode": "plate" for vignette illustrations that fade
to white (white is keyed out, nothing is cut), "xray": false to skip the X-ray copy.

Usage: python3 prep_images.py PROJECT_DIR [--only name1,name2]
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load_rgba(path):
    im = Image.open(path).convert("RGBA")
    return np.asarray(im).astype(np.float32) / 255.0


def remove_flat_background(rgba, tol=0.10):
    """Alpha from a flat background colour, flood-filled from the border."""
    rgb = rgba[..., :3]
    h, w = rgb.shape[:2]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    cand = dist < tol
    lab, n = ndi.label(cand)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge_labels))
    # soft edge: distance-based ramp in a 2 px band
    alpha = (~bgmask).astype(np.float32)
    alpha = ndi.gaussian_filter(alpha, 0.8)
    soft = np.clip((dist - tol * 0.5) / (tol * 1.5), 0, 1)
    alpha = np.where(bgmask, np.minimum(alpha, soft), alpha)
    # decontaminate edge colours from the background
    a = np.clip(alpha, 1e-3, 1)[..., None]
    rgb2 = np.clip((rgb - bg * (1 - a)) / a, 0, 1)
    rgb = np.where(alpha[..., None] < 0.999, rgb2, rgb)
    return np.dstack([rgb, alpha]), bg


def ai_cutout(rgba, model=None):
    """Alpha from an AI segmentation model (rembg / BiRefNet). None if unavailable."""
    try:
        from rembg import new_session, remove
    except Exception:
        return None
    model = model or os.environ.get("REMBG_MODEL", "birefnet-general-lite")
    im = Image.fromarray((rgba[..., :3] * 255).astype(np.uint8), "RGB")
    out = remove(im, session=new_session(model), post_process_mask=True)
    a = np.asarray(out).astype(np.float32)[..., 3] / 255.0
    a = ndi.gaussian_filter(a, 0.6)  # soften the stair-steps a touch
    return np.dstack([rgba[..., :3], a])


def clean_alpha(rgba):
    a = rgba[..., 3]
    solid = a > 0.5
    lab, n = ndi.label(solid)
    if n > 1:
        sizes = ndi.sum(solid, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= max(400, sizes.max() * 0.004)
        mask = keep[lab]
        grown = ndi.binary_dilation(mask, iterations=3)
        a = np.where(grown, a, 0)
    rgba = rgba.copy(); rgba[..., 3] = a
    return rgba


def defringe(rgba, band=3):
    """Replace edge colours (often mixed with the old background) by the nearest
    solid interior colour, so no dark/bright halo shows on the paper."""
    a = rgba[..., 3]
    interior = ndi.binary_erosion(a > 0.97, iterations=band)
    if interior.sum() < 100:
        return rgba
    edge = (a > 0.002) & ~interior
    _, (iy, ix) = ndi.distance_transform_edt(~interior, return_indices=True)
    rgb = rgba[..., :3].copy()
    rgb[edge] = rgba[..., :3][iy[edge], ix[edge]]
    out = rgba.copy(); out[..., :3] = rgb
    # tighten the soft edge a little so the old halo cannot creep back in
    out[..., 3] = np.clip((a - 0.04) / 0.96, 0, 1)
    return out


def plate_alpha(rgba, edge_mask=True, feather_below=None):
    """Illustration on white: only white connected to the image border is keyed
    out (a white sun or flowers inside stay). In a fringe next to that background
    whitish pixels are un-blended from white, and the boundary is feathered, so a
    vignette melts into the paper (edge_mask) while a figure keeps a crisp edge.
    feather_below=[y_frac, px] softens only the part below y_frac (fading water)."""
    rgb = rgba[..., :3]
    mn, mx = rgb.min(-1), rgb.max(-1)
    whiteish = (mn > 0.86) & (mx - mn < 0.09)
    lab, n = ndi.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    hh = rgb.shape[0]
    F = np.full(rgb.shape[:2], 30.0 if edge_mask else 2.0)
    if feather_below:
        y0, fb = feather_below
        ramp = np.clip((np.arange(hh) / hh - y0) / 0.05, 0, 1)[:, None]
        F = F + (fb - F) * ramp
    dist = ndi.distance_transform_edt(~bg)
    z = 1 - np.clip(dist / F, 0, 1)
    z = z * z * (3 - 2 * z)                       # 1 at the background, 0 inside
    lo = 0.58
    w = np.clip((mn - lo) / (0.975 - lo), 0, 1)
    w = w * w * (3 - 2 * w)
    neutral = 1 - np.clip((mx - mn - 0.06) / 0.14, 0, 1)
    ca = 1 - w * neutral * z                       # whitish fringe -> transparent
    a3 = np.clip(ca, 1e-3, 1)[..., None]
    rgb = np.where(ca[..., None] < 0.999, np.clip((rgb - (1 - a3)) / a3, 0, 1), rgb)
    f = np.clip(dist / np.maximum(1.0, F * 0.45), 0, 1)
    a = ca * (f * f * (3 - 2 * f))
    return np.dstack([rgb, a])


def trim(rgba, pad=10, thr=0.03):
    a = rgba[..., 3]
    ys, xs = np.nonzero(a > thr)
    if len(xs) == 0:
        return rgba, [0, 0, rgba.shape[1], rgba.shape[0]]
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad + 1)
    return rgba[y0:y1, x0:x1], [int(x0), int(y0), int(x1), int(y1)]


def xray(rgba):
    """Ghost X-ray: light, see-through grey with bright rims and faint inner structure."""
    rgb, a = rgba[..., :3], rgba[..., 3]
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    inside = a > 0.05
    m = float(lum[inside].mean()) if inside.any() else 0.5
    lum = np.where(inside, lum, m)
    hp = ndi.gaussian_filter(lum, 1.2) - ndi.gaussian_filter(lum, 4)
    hp2 = lum - ndi.gaussian_filter(lum, 16)
    rim = np.clip(a - ndi.gaussian_filter(a, 5), 0, 1)
    rim2 = np.clip(a - ndi.gaussian_filter(a, 14), 0, 1)
    depth = ndi.gaussian_filter(a, 30)            # thicker parts read denser
    v = 0.56 + 0.20 * (m - lum) + 0.55 * hp + 0.22 * hp2 + 1.2 * rim + 0.35 * rim2 + 0.10 * (depth - 0.5)
    v = np.clip(v, 0, 1)
    tint = np.array([0.90, 0.92, 0.90], np.float32)
    out_rgb = np.clip(v[..., None] * tint + 0.05, 0, 1)
    alpha = a * np.clip(0.40 + 0.45 * v + 0.6 * rim, 0, 0.95)
    halo = ndi.gaussian_filter(a, 9) * 0.16
    alpha = np.maximum(alpha, halo)
    out_rgb = np.where((a < 0.05)[..., None], np.array([0.85, 0.88, 0.86]), out_rgb)
    return np.dstack([out_rgb, alpha])


def save(rgba, path):
    Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(path, optimize=False, compress_level=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    cfg = json.load(open(os.path.join(a.project, "project.json")))
    outdir = os.path.join(a.project, "build", "assets"); os.makedirs(outdir, exist_ok=True)
    mpath = os.path.join(outdir, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {"images": {}}
    only = set(filter(None, a.only.split(",")))
    # images in the same "group" share one crop box so swaps/crossfades line up exactly;
    # a group is always processed together
    groups = {}
    for im in cfg["images"]:
        if im.get("group"):
            groups.setdefault(im["group"], []).append(im["name"])
    todo = [im for im in cfg["images"] if not only or im["name"] in only or
            (im.get("group") and any(n in only for n in groups.get(im["group"], [])))]
    cut = {}
    for im in todo:
        name = im["name"]
        src = None
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            if os.path.exists(os.path.join(a.project, "images", name + ext)):
                src = os.path.join(a.project, "images", name + ext); break
        if not src:
            print(f"-- {name}: missing"); continue
        rgba = load_rgba(src)
        H0, W0 = rgba.shape[:2]
        alpha = rgba[..., 3]
        had_alpha = (alpha < 0.5).mean() > 0.02
        mode = im.get("mode", "cutout")
        if mode == "plate":
            rgba = plate_alpha(rgba, im.get("edgeMask", True), im.get("featherBelow"))
            _, box = trim(rgba, pad=4, thr=0.02)
            cut[name] = (rgba, box, "vignette plate (white keyed)", (W0, H0), im.get("group"), False)
            continue
        if had_alpha:
            # transparent PNGs from GPT Image often carry a faint coloured glow: drop it
            a0 = rgba[..., 3]
            rgba = rgba.copy(); rgba[..., 3] = np.clip((a0 - 0.12) / 0.88, 0, 1)
        if not had_alpha:
            c2 = ai_cutout(rgba)
            if c2 is not None:
                rgba, note = c2, "background removed (AI cutout)"
            else:
                rgba, bg = remove_flat_background(rgba)
                note = f"background removed (flat bg={np.round(bg * 255).astype(int).tolist()})"
        else:
            note = "native transparency"
        rgba = clean_alpha(rgba)
        if not had_alpha:
            rgba = defringe(rgba)
        _, box = trim(rgba)
        cut[name] = (rgba, box, note, (W0, H0), im.get("group"), im.get("xray", True))
    # union boxes per group
    gbox = {}
    for name, (_, box, _, _, g, _) in cut.items():
        if g:
            b = gbox.get(g, box)
            gbox[g] = [min(b[0], box[0]), min(b[1], box[1]), max(b[2], box[2]), max(b[3], box[3])]
    for name, (rgba, box, note, (W0, H0), g, want_xray) in cut.items():
        if g:
            box = gbox[g]
        x0, y0, x1, y1 = box
        out = rgba[y0:y1, x0:x1]
        save(out, os.path.join(outdir, name + ".png"))
        if want_xray:
            save(xray(out), os.path.join(outdir, "xray_" + name + ".png"))
        entry = manifest["images"].get(name, {})
        entry.update({"w": out.shape[1], "h": out.shape[0], "orig": [W0, H0], "trim": box, "xray": bool(want_xray)})
        manifest["images"][name] = entry
        print(f"ok {name}: {note}, crop {out.shape[1]}x{out.shape[0]} box {box}{' (group ' + g + ')' if g else ''}")
    json.dump(manifest, open(mpath, "w"), indent=1)


if __name__ == "__main__":
    main()
