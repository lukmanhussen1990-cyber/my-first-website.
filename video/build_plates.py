"""Learn the clean artwork ("plates") for every scene of the reference clip.

The reference redraws its crayon texture 10 times a second, so any single
frame is noisy. Averaging every frame in which an element is visible gives a
clean per-colour probability map for that element; render.py then draws
fresh crayon grain on top of those maps.

Usage: python3 build_plates.py <reference.mp4>
Writes plates/<scene>.npz and timeline.json next to this script.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 720, 1280
BAND_TOP, BAND_BOT = 376, 904          # band rows [376, 904)
BH = BAND_BOT - BAND_TOP
NFRAMES = 673

# Paint colours sampled from the reference (median of each class).
CLASSES = {
    "white":   (253, 253, 253),
    "black":   (0, 0, 0),
    "orange":  (235, 109, 29),
    "mauve":   (182, 103, 133),
    "pink":    (232, 132, 151),
    "hotpink": (252, 127, 173),
}
NAMES = list(CLASSES)
PALETTE = np.array([CLASSES[n] for n in NAMES], dtype=np.float32)

# Scenes: each state lists the (1-based, inclusive) frame ranges where it is
# on screen. States inside a scene are cumulative (words get added).
SCENES = [
    ("whoa",     [[(1, 15), (30, 36)], [(16, 29), (37, 53)]]),
    ("wait",     [[(54, 61)], [(62, 66)], [(67, 119)]]),
    ("think",    [[(120, 128)], [(129, 139)], [(140, 150)], [(151, 157)],
                  [(158, 170)], [(171, 189)]]),
    ("inthe",    [[(190, 207)]]),
    ("sixth",    [[(208, 227)], [(228, 330)]]),
    ("but",      [[(331, 338)], [(339, 348)], [(349, 359)]]),
    ("rightnow", [[(360, 386)], [(387, 421)]]),
    # The cat hops onto the cloud at frame 446, so that state is its own scene.
    ("just",     [[(422, 430)], [(431, 442)], [(443, 445)]]),
    ("cloud",    [[(446, 466)]]),
    ("ohwow1",   [[(467, 479)]]),
    ("imhere",   [[(480, 521)]]),
    ("withyou",  [[(522, 565)]]),
    ("ohwow2",   [[(566, 586)], [(587, 673)]]),
]
FADE_START = 587          # first frame of the closing fade to black
LEARN_LAST = 618          # fade frames past this are too dark to learn from


def read_frames(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo",
           "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    assert len(frames) == NFRAMES, len(frames)
    return frames[:, BAND_TOP:BAND_BOT]


def boil_schedule(band):
    """Frames where the drawing changes (crayon re-boil or new content)."""
    g = band.mean(axis=3)
    changes = [1]
    for i in range(1, len(g)):
        if (np.abs(g[i] - g[i - 1]) > 40).sum() > 200:
            changes.append(i + 1)
    return changes


def fade_levels(band):
    """Brightness multiplier per frame (1.0 until the fade starts).

    Measured on the empty top strip of the band, which is pure background.
    """
    levels = np.ones(NFRAMES)
    for i in range(FADE_START - 1, NFRAMES):
        levels[i] = np.median(band[i, 2:60, 20:700].mean(axis=2)) / 253.0
    return levels


def classify(img):
    """One-hot nearest-palette class per pixel -> (BH, W, n_classes).

    Grey (unsaturated) pixels are antialiasing between ink and paper, so they
    are split by brightness only; otherwise mid-greys would land on mauve and
    leave coloured fringes around every black line.
    """
    img = img.astype(np.float32)
    d = ((img[:, :, None, :] - PALETTE) ** 2).sum(-1)
    idx = d.argmin(-1)
    grey = (img.max(-1) - img.min(-1)) < 35
    idx[grey] = np.where(img[grey].mean(-1) < 128, NAMES.index("black"),
                         NAMES.index("white"))
    return np.eye(len(NAMES), dtype=np.float32)[idx]


def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def main(ref):
    band = read_frames(ref)
    changes = boil_schedule(band)
    levels = fade_levels(band)
    os.makedirs(os.path.join(HERE, "plates"), exist_ok=True)

    timeline = []
    for name, states in SCENES:
        sums, counts = [], []
        for k, ranges in enumerate(states):
            s = np.zeros((BH, W, len(NAMES)), np.float32)
            n = 0
            for a, b in ranges:
                for f in range(a, b + 1):
                    timeline.append({"frame": f, "scene": name, "state": k})
                    if f > LEARN_LAST:
                        continue
                    img = band[f - 1].astype(np.float32)
                    if levels[f - 1] < 0.999:
                        img = np.clip(img / levels[f - 1], 0, 255)
                    s += classify(img)
                    n += 1
            sums.append(s)
            counts.append(n)

        # Owner = first state in which a pixel carries ink.
        owner = np.full((BH, W), 255, np.uint8)
        for k in range(len(states)):
            avg = sums[k] / max(counts[k], 1)
            ink = dilate((1.0 - avg[..., 0]) > 0.3, 3)
            owner[(owner == 255) & ink] = k

        # Probability maps: average over every frame where the owner element
        # is visible (its own state and all later ones).
        prob = np.zeros((BH, W, len(NAMES)), np.float32)
        prob[..., 0] = 1.0
        for k in range(len(states)):
            tot = sum(sums[k:])
            cnt = max(sum(counts[k:]), 1)
            sel = owner == k
            prob[sel] = tot[sel] / cnt

        np.savez_compressed(
            os.path.join(HERE, "plates", f"{name}.npz"),
            owner=owner,
            prob=(prob * 255 + 0.5).astype(np.uint8),
            classes=np.array(NAMES),
        )
        print(f"{name}: {len(states)} states, owner px "
              f"{[(owner == k).sum() for k in range(len(states))]}")

    timeline.sort(key=lambda e: e["frame"])
    with open(os.path.join(HERE, "timeline.json"), "w") as fh:
        json.dump({
            "frames": NFRAMES, "fps": 30, "width": W, "height": H,
            "band": [BAND_TOP, BAND_BOT],
            "colors": CLASSES,
            "boil_changes": changes,
            "fade": [round(float(x), 4) for x in levels],
            "timeline": timeline,
        }, fh, indent=1)
    print("boil changes:", len(changes))


if __name__ == "__main__":
    main(sys.argv[1])
