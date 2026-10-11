# Builds the cut-out frames: the character with an alpha channel, and the top of the hood (cut off by the video's top edge) drawn back in.
# usage: compose.py <hood dir>   → <hood dir>/rgba/NNN.png (1254 x 1254+PAD)
import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

D = sys.argv[1]; PAD = 170
os.makedirs(D + "/rgba", exist_ok=True)
HOOD = np.array([26, 25, 34], np.float32)      # the hood's colour near its top
LINE = (6, 5, 10)                              # the drawing's outline colour

def run_at(a, y):                              # the widest opaque run on a row
    xs = np.where(a[y] > 128)[0]
    if not len(xs): return None
    br = np.where(np.diff(xs) > 1)[0]
    starts = np.r_[xs[0], xs[br + 1]]; ends = np.r_[xs[br], xs[-1]]
    i = np.argmax(ends - starts); return int(starts[i]), int(ends[i])

def bez(p0, p1, p2, p3, n=200):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

FILES = [f for f in sorted(glob.glob(D + "/fr/*.png")) if os.path.exists(D + "/mk/" + os.path.basename(f))]
EDGE = []
for f in FILES:
    a0 = np.asarray(Image.open(D + "/mk/" + os.path.basename(f)).convert("L")).astype(np.float32)
    EDGE.append(run_at(a0, 0) + run_at(a0, 12))
EDGE = np.array(EDGE, np.float32)
DL = np.median(EDGE[:, 0] - EDGE[:, 2]); DR = np.median(EDGE[:, 1] - EDGE[:, 3])
k5 = np.ones(5) / 5
SM = np.stack([np.convolve(np.pad(EDGE[:, j], 2, mode="edge"), k5, "valid") for j in (0, 1)], 1)   # the two ends, smoothed over 5 frames
for fi, f in enumerate(FILES):
    name = os.path.basename(f)
    rgb = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
    a = np.asarray(Image.open(D + "/mk/" + name).convert("L")).astype(np.float32)
    # keep the character only: drop small specks (stars, noise) the model let through
    lab, n = ndimage.label(a > 24)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.where(sizes > 1500)[0])
        a = a * ndimage.binary_dilation(keep, iterations=3)
    # a thin bar of the background (a lamp post) touches the hood's top right: thin lines go, the hair tips stay
    tr = a[:140, 1000:].copy()
    a[:140, 1000:] = np.minimum(tr, ndimage.grey_opening(tr, size=(1, 9)))
    H, W = a.shape
    out = np.zeros((H + PAD, W, 4), np.float32)
    out[PAD:, :, :3] = rgb; out[PAD:, :, 3] = a
    # the hood's cut top: where it meets the top edge, and which way its two sides were heading
    xl, xr = float(SM[fi, 0]), float(SM[fi, 1])
    dl = np.array([DL, -12.0]); dl /= np.linalg.norm(dl)
    dr = np.array([DR, -12.0]); dr /= np.linalg.norm(dr)
    p0 = np.array([xl, PAD], float); p3 = np.array([xr, PAD], float)
    w = xr - xl
    p1 = p0 + dl * w * .50; p2 = p3 + dr * w * .36
    curve = bez(p0, p1, p2, p3)
    top = curve[:, 1].min()
    # fill: each column's colour at the cut fades into the plain hood colour going up (so the folds don't stop at a hard line)
    cap = Image.new("L", (W, H + PAD), 0)
    poly = [tuple(p) for p in curve] + [(xr, PAD + 2), (xl, PAD + 2)]
    ImageDraw.Draw(cap).polygon(poly, fill=255)
    capm = np.asarray(cap).astype(np.float32) / 255
    ys = np.arange(H + PAD)[:, None].astype(np.float32)
    k = np.clip((PAD - ys) / 46.0, 0, 1)[..., None] ** .8         # 0 at the cut → 1 near the top
    colrow = ndimage.gaussian_filter1d(rgb[2:8].mean(axis=0), 18, axis=0)[None, :, :]   # the colours just under the cut, softened sideways
    fill = colrow * (1 - k) + HOOD * k
    m = capm[..., None] * (ys[..., None] < PAD + 1)
    out[:, :, :3] = out[:, :, :3] * (1 - m) + fill * m
    out[:, :, 3] = np.maximum(out[:, :, 3], capm * 255 * (ys[:, 0] < PAD + 1)[:, None])
    # the outline round the new top, as thick as the drawing's own
    ol = Image.new("L", (W, H + PAD), 0)
    ImageDraw.Draw(ol).line([tuple(p) for p in curve], fill=255, width=9, joint="curve")
    olm = (np.asarray(ol.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255) * (ys < PAD + 3)
    out[:, :, :3] = out[:, :, :3] * (1 - olm[..., None]) + np.array(LINE, np.float32) * olm[..., None]
    out[:, :, 3] = np.maximum(out[:, :, 3], olm * 255)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA").save(D + "/rgba/" + name)
    print(name, "top of hood at", round(PAD - top), "px above the cut", flush=True)
