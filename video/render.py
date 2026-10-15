"""Render the crayon lyric video from the learned plates and mux the music.

Every frame is drawn fresh: each "boil" (the 10 fps redraw rhythm measured
from the reference) gets a new noise field, which is thresholded against the
clean plates to give bumpy crayon edges and stippled grain.

Usage:
  python3 render.py                      # full video -> output/sixth_dimension.mp4
  python3 render.py --png 10 300 560     # preview single frames -> output/preview_*.png
  python3 render.py --plates plates_mice --out sixth_dimension_mice.mp4
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "timeline.json")))
W, H = CFG["width"], CFG["height"]
BAND_TOP, BAND_BOT = CFG["band"]
BH = BAND_BOT - BAND_TOP
NAMES = list(CFG["colors"])
COLORS = {k: np.array(v, np.float32) for k, v in CFG["colors"].items()}
BG = COLORS["white"]
FILLS = ["orange", "mauve", "pink", "hotpink"]   # painted under the black

# Crayon look. Black ink: a pixel is inked with exactly the probability the
# reference showed (noise is uniform in [-0.5, 0.5]), so grain density and
# stipple match while the paper stays clean. Fills: bumpy but solid.
BLACK_GAIN = 1.5      # firms up solid line cores without killing faint specks
FILL_AMP = 0.3
FILL_SOFT = 0.10      # colour fills get a slightly soft edge; black stays hard

# The reference's letterbox edge (rows just outside/inside the band) shows
# resampling ringing; reproduce it so the edge looks identical.
EDGE_OUTSIDE = {BAND_TOP - 3: 10, BAND_TOP - 2: 0, BAND_TOP - 1: 126,
                BAND_BOT: 125, BAND_BOT + 1: 0, BAND_BOT + 2: 9}
EDGE_INSIDE = {0: 255 / 253, 1: 242 / 253, BH - 2: 243 / 253, BH - 1: 255 / 253}


def boil_frames():
    """Frames that start a new drawing; keep the 10 fps rhythm to the end."""
    changes = list(CFG["boil_changes"])
    pattern = [4, 2, 3, 3, 3]
    k = 0
    while changes[-1] < CFG["frames"]:
        changes.append(changes[-1] + pattern[k % len(pattern)])
        k += 1
    return changes


def load_plates(plates_dir):
    plates = {}
    for fn in sorted(os.listdir(os.path.join(HERE, plates_dir))):
        z = np.load(os.path.join(HERE, plates_dir, fn))
        plates[fn[:-4]] = (z["owner"], z["prob"].astype(np.float32) / 255.0)
    return plates


def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


class StatePlate:
    """Probability maps for one (scene, state), plus where fills may extend."""

    def __init__(self, owner, prob, state):
        p = prob.copy()
        hidden = owner > state
        p[hidden] = 0.0
        p[hidden, 0] = 1.0
        idx = {n: i for i, n in enumerate(NAMES)}
        self.black = np.clip((p[..., idx["black"]] - 0.5) * BLACK_GAIN + 0.5, 0, 1)
        # One fill layer per scene, in the scene's dominant paint (every scene
        # of the reference uses a single fill colour; the fade-out frames
        # otherwise drift the pink towards mauve).
        fp = np.stack([p[..., idx[n]] for n in FILLS], -1)
        self.fill = fp.sum(-1)
        self.color = COLORS[FILLS[int(fp.sum(axis=(0, 1)).argmax())]]
        # Fills run underneath adjacent black outlines so no white gaps show.
        near = dilate(self.fill > 0.25, 5)
        self.under = self.fill + p[..., idx["black"]] * near
        self.has_fill = bool(self.fill.max() > 0.25)


def noise_field(seed, coarse_w, fine_w):
    """Crayon grain with a uniform [-0.5, 0.5] marginal.

    ~2 px blobs (coarse) mixed with per-pixel tooth (fine), then rank-mapped
    to uniform so that P(ink) == plate probability exactly.
    """
    rng = np.random.default_rng(seed)
    coarse = rng.standard_normal((BH // 2 + 1, W // 2 + 1)).astype(np.float32)
    coarse = np.asarray(Image.fromarray(coarse, "F").resize(
        (W + 2, BH + 2), Image.BILINEAR))[1:BH + 1, 1:W + 1]
    fine = rng.standard_normal((BH, W)).astype(np.float32)
    n = (coarse_w * coarse / coarse.std() + fine_w * fine).ravel()
    u = np.empty(n.size, np.float32)
    u[np.argsort(n)] = np.linspace(-0.5, 0.5, n.size, dtype=np.float32)
    return u.reshape(BH, W)


def render_band(plate, seed):
    img = np.empty((BH, W, 3), np.float32)
    img[:] = BG
    if plate.has_fill:
        uf = noise_field(seed * 2 + 2, 1.0, 0.25)
        a = np.clip((plate.under + FILL_AMP * uf - 0.5) / FILL_SOFT + 0.5, 0, 1)
        img += (plate.color - img) * a[..., None]
    uk = noise_field(seed * 2 + 1, 1.0, 0.3)
    img[(plate.black + uk) > 0.5] = 0.0
    return img


def compose(band, fade):
    frame = np.zeros((H, W, 3), np.float32)
    band = band.copy()
    for r, gain in EDGE_INSIDE.items():
        band[r] *= gain
    frame[BAND_TOP:BAND_BOT] = band
    for r, v in EDGE_OUTSIDE.items():
        frame[r] = v
    frame *= fade
    return np.clip(frame + 0.5, 0, 255).astype(np.uint8)


def frames(plates_dir):
    plates = load_plates(plates_dir)
    timeline = {e["frame"]: (e["scene"], e["state"]) for e in CFG["timeline"]}
    boils = boil_frames()
    cache, seed_cache = {}, {}
    bi = 0
    for f in range(1, CFG["frames"] + 1):
        while bi + 1 < len(boils) and boils[bi + 1] <= f:
            bi += 1
        key = timeline[f]
        if key not in cache:
            cache.clear()
            owner, prob = plates[key[0]]
            cache[key] = StatePlate(owner, prob, key[1])
        skey = (key, boils[bi])
        if skey not in seed_cache:
            seed_cache.clear()
            seed_cache[skey] = render_band(cache[key], boils[bi])
        yield f, compose(seed_cache[skey], CFG["fade"][f - 1])


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--plates", default="plates", help="plate folder to render")
    ap.add_argument("--out", default="sixth_dimension.mp4", help="file name in output/")
    ap.add_argument("--png", type=int, nargs="+", help="only write these preview frames")
    args = ap.parse_args(argv)
    out_dir = os.path.join(HERE, "output")
    os.makedirs(out_dir, exist_ok=True)
    if args.png:
        want = set(args.png)
        for f, img in frames(args.plates):
            if f in want:
                Image.fromarray(img).save(os.path.join(out_dir, f"preview_{f:04d}.png"))
            if f >= max(want):
                break
        return

    out = os.path.join(out_dir, args.out)
    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
        "-i", os.path.join(HERE, "assets", "music.m4a"),
        "-map", "0:v", "-map", "1:a",
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-color_range", "tv",
        "-c:a", "copy",            # the original music, bit-for-bit
        "-movflags", "+faststart", out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f, img in frames(args.plates):
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1:])
