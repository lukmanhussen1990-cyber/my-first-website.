"""Turn the GPT Image PNGs into clean transparent sprites.

assets/gpt/NAME.png  ->  public/img/NAME.png   (+ src/data/sprites.json with size and bounding box)

Three kinds of input are handled automatically:
- real alpha: alpha is normalised and the faint glow halo is dropped
- flat magenta background (#FF00FF): chroma key with despill
- painted grey/white checkerboard: flood fill from the borders, stopped by the bold outline

Usage: python3 tools/cutout.py [NAME ...]
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
SRC, DST = ROOT / "assets/gpt", ROOT / "public/img"
META = ROOT / "src/data/sprites.json"
OUTLINE = np.array([30, 30, 36], np.float32)
# backgrounds and other non-sprite images keep their pixels as they are
OPAQUE = set()
# images holding several objects, cut into separate sprites from left to right
SPLIT = {"22_venus_mercury": ["22_venus", "22_mercury"]}


def from_alpha(rgba):
    a = rgba[..., 3].astype(np.float32)
    a = np.clip((a - 10) / (250 - 10), 0, 1)
    return rgba[..., :3].astype(np.float32), a


def from_magenta(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    # magenta-ness: red and blue high, green low
    m = np.clip((np.minimum(r, b) - g - 40) / 120, 0, 1)
    bg = ndi.binary_opening(m > 0.9, iterations=1)
    lab, _ = ndi.label(m > 0.25)
    keep = np.isin(lab, np.unique(lab[bg]))
    a = 1 - np.where(keep, m, 0)
    out = rgb.astype(np.float32)
    spill = np.minimum(out[..., 0], out[..., 2]) - out[..., 1]
    fix = (spill > 0) & (a < 1)
    out[..., 0][fix] -= spill[fix] * 0.6
    out[..., 2][fix] -= spill[fix] * 0.6
    return np.clip(out, 0, 255), a


def from_checker(rgb):
    f = rgb.astype(np.float32)
    lum = f.mean(axis=2)
    sat = f.max(axis=2) - f.min(axis=2)
    # the checker's grey range, measured on the image border (light-grey or mid-grey variants)
    edge = np.concatenate([lum[:6].ravel(), lum[-6:].ravel(), lum[:, :6].ravel(), lum[:, -6:].ravel()])
    lo = min(160.0, np.percentile(edge[edge > 90], 2) - 12)
    # dark outline pixels, slightly thickened, act as a wall the fill cannot cross
    wall = ndi.binary_dilation(lum < min(110.0, lo - 8), iterations=1)
    cand = (sat < 22) & (lum > lo) & ~wall
    lab, _ = ndi.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    # enclosed pockets of checkerboard (e.g. between an arm and the body) must show the checker's
    # own two grey levels; white clothing has smooth shading instead
    hist = np.bincount(lum[bg].astype(np.int32), minlength=256)
    p1 = int(hist.argmax())
    h2 = hist.copy(); h2[max(p1 - 12, 0):p1 + 13] = 0
    p2 = int(h2.argmax())
    lab2, n2 = ndi.label(cand & ~bg)
    for i in range(1, n2 + 1):
        reg = lab2 == i
        if reg.sum() > 1500:
            v = lum[reg]
            near1, near2 = (np.abs(v - p1) < 5).mean(), (np.abs(v - p2) < 5).mean()
            if near1 + near2 > 0.9 and min(near1, near2) > 0.2:
                bg |= reg
        else:
            # small grey specks trapped between coloured shapes (e.g. between flame tongues)
            sl = ndi.find_objects(reg.astype(np.int32))[0]
            sl = tuple(slice(max(a.start - 4, 0), a.stop + 4) for a in sl)
            r = reg[sl]
            around = ndi.binary_dilation(r, iterations=3) & ~r
            if sat[sl][around].mean() > 60:
                bg[sl] |= r
    bg = ndi.binary_closing(bg, iterations=1) & cand | bg
    fg = ~bg
    # soft edge on the ring just inside the cut: dark outline pixels are un-mixed from the grey,
    # coloured edges without an outline (flames, glows) fade by how far they are from grey
    ring = fg & ndi.binary_dilation(bg, iterations=2)
    a = fg.astype(np.float32)
    lb = float(np.median(lum[bg]))
    dark = ring & (lum < lb - 25)
    a[dark] = np.clip((lb - lum[dark]) / (lb - OUTLINE.mean()), 0, 1)
    col = ring & ~dark
    a[col] = np.clip(sat[col] / 70, 0, 1)
    out = f.copy()
    out[dark] = OUTLINE
    a = np.minimum(a, ndi.uniform_filter(fg.astype(np.float32), 3) * 1.5)
    return out, a


def process(name):
    src = SRC / f"{name}.png"
    im = Image.open(src)
    rgba = np.array(im.convert("RGBA"))
    if name in OPAQUE:
        rgb, a = rgba[..., :3].astype(np.float32), np.ones(rgba.shape[:2], np.float32)
        mode = "opaque"
    elif (rgba[..., 3] < 8).mean() > 0.05:
        rgb, a = from_alpha(rgba)
        mode = "alpha"
    else:
        rgb = rgba[..., :3]
        c = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3)])
        mag = ((c[:, 0] > 200) & (c[:, 2] > 200) & (c[:, 1] < 80)).mean() > 0.5
        rgb, a = from_magenta(rgb) if mag else from_checker(rgb)
        mode = "magenta" if mag else "checker"
    # drop specks that are not connected to the main figure
    lab, n = ndi.label(a > 0.5)
    if n > 1:
        sizes = ndi.sum(np.ones_like(a), lab, range(1, n + 1))
        tiny = np.isin(lab, np.where(sizes < 400)[0] + 1)
        a[tiny] = 0
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8)
    DST.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGBA").save(DST / f"{name}.png", optimize=True)
    if name in SPLIT:
        lab, n = ndi.label(a > 0.05)
        sizes = ndi.sum(np.ones_like(a), lab, range(1, n + 1))
        big = sorted(np.argsort(sizes)[::-1][:len(SPLIT[name])] + 1,
                     key=lambda k: np.where(lab == k)[1].mean())
        metas = {}
        for part, k in zip(SPLIT[name], big):
            ys, xs = np.where(lab == k)
            x0, y0, x1, y1 = xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5
            piece = out[y0:y1, x0:x1].copy()
            piece[..., 3] = (piece[..., 3] * (lab[y0:y1, x0:x1] == k)).astype(np.uint8)
            Image.fromarray(piece, "RGBA").save(DST / f"{part}.png", optimize=True)
            metas[part] = {"w": int(x1 - x0), "h": int(y1 - y0), "bbox": [0, 0, int(x1 - x0), int(y1 - y0)]}
        return mode, metas
    ys, xs = np.where(a > 0.5)
    return mode, {name: {"w": im.width, "h": im.height,
                         "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}}


def main(names):
    meta = json.load(open(META)) if META.exists() else {}
    names = names or sorted(p.stem for p in SRC.glob("*.png"))
    for n in names:
        mode, ms = process(n)
        meta.update(ms)
        for k, m in ms.items():
            print(f"{k:24s} {mode:8s} {m['w']}x{m['h']} bbox={m['bbox']}")
    json.dump(dict(sorted(meta.items())), open(META, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
