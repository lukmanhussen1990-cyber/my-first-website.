"""Build the mouse version of the plates (plates_mice/).

- "But I'm here", "Just sitting in a cloud" and "right now with you": the cats
  are cut out and replaced by the mice from assets/mice/*.png (band crops of
  the mouse version of the clip). Each crop is placed by lining up its lyric
  text with ours, so the mice sit exactly where that version had them.
- "Sixth dimension": the floating cat is replaced by the original witch mouse
  drawn in mouse.py.

Usage: python3 characters.py   (then: python3 render.py --plates plates_mice)
"""
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage

from mouse import witch_mouse

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "plates")
DST = os.path.join(HERE, "plates_mice")
W, BH = 720, 528
NAMES = ["white", "black", "orange", "mauve", "pink", "hotpink"]
BLACK, PINK, HOTPINK = 1, 4, 5

# Crop -> band transform (scale, x offset, y offset) found by aligning each
# crop's lyric text to our plates; rows above `cut` hold text and are ignored.
MICE = {
    "but":     dict(s=0.8418, ox=-11.5, oy=-9.5, cut=150),
    # raised 16 px: that version frames this shot taller, so the mice would
    # otherwise be clipped by the band's bottom edge
    "withyou": dict(s=0.9886, ox=-73.8, oy=-20.2, cut=285),
    "just":    dict(s=0.8579, ox=-0.1, oy=2.5, cut=160),
}


def load(scene):
    z = np.load(os.path.join(SRC, f"{scene}.npz"))
    return z["owner"].copy(), z["prob"].astype(np.float32) / 255.0


def save(scene, owner, prob):
    np.savez_compressed(os.path.join(DST, f"{scene}.npz"), owner=owner,
                        prob=(np.clip(prob, 0, 1) * 255 + 0.5).astype(np.uint8),
                        classes=np.array(NAMES))


def mouse_from_crop(name):
    """Ink and pink maps of the mouse in a crop, mapped into band space."""
    m = MICE[name]
    a = np.asarray(Image.open(os.path.join(HERE, "assets", "mice", f"{name}.png"))
                   .convert("RGB"), np.float32)
    r, g = a[..., 0], a[..., 1]
    pink = np.clip(((r - g) - 35) / 40, 0, 1) * np.clip((r - 150) / 50, 0, 1)
    ink = np.clip((185 - a.mean(-1)) / 110, 0, 1) * (1 - pink)

    def warp(x):
        im = Image.fromarray(x.astype(np.float32), "F")
        s = m["s"]
        return np.array(im.transform((W, BH), Image.AFFINE,
                                       (1 / s, 0, -m["ox"] / s, 0, 1 / s, -m["oy"] / s),
                                       resample=Image.BILINEAR))

    ink, pink = warp(ink), warp(pink)
    ink[:m["cut"]] = 0
    pink[:m["cut"]] = 0
    # Soften the single captured frame so the crayon boil can wobble it.
    ink = ndimage.gaussian_filter(ink, 0.8)
    pink = ndimage.gaussian_filter(pink, 0.6)
    return ink, np.minimum(pink, 1 - ink)


def erase(owner, prob, mask):
    prob[mask] = 0.0
    prob[mask, 0] = 1.0
    owner[mask] = 255


def insert(owner, prob, ink, pink, state, pink_class=PINK):
    prob[..., BLACK] = np.maximum(prob[..., BLACK], ink)
    prob[..., pink_class] = np.maximum(prob[..., pink_class], np.minimum(pink, 1 - ink))
    prob[..., 0] = np.clip(1.0 - prob[..., 1:].sum(-1), 0, 1)
    new = (np.maximum(ink, pink) > 0.02) & (owner == 255)
    owner[new] = state


def rows_from(y0):
    m = np.zeros((BH, W), bool)
    m[y0:] = True
    return m


def silhouette(ink):
    """Solid body of a line drawing (closed outline + everything inside)."""
    lines = ndimage.binary_dilation(ink > 0.4, iterations=3)
    return ndimage.binary_erosion(ndimage.binary_fill_holes(lines), iterations=2)


def main():
    os.makedirs(DST, exist_ok=True)
    for fn in os.listdir(SRC):
        shutil.copy(os.path.join(SRC, fn), os.path.join(DST, fn))

    # But I'm here: the cat arrives with "But" (state 0).
    owner, prob = load("but")
    erase(owner, prob, (owner == 0) & rows_from(150))
    insert(owner, prob, *mouse_from_crop("but"), state=0)
    save("but", owner, prob)

    # right now with you: two mice from behind.
    owner, prob = load("withyou")
    erase(owner, prob, rows_from(285))
    insert(owner, prob, *mouse_from_crop("withyou"), state=0)
    save("withyou", owner, prob)

    # Just sitting: the cat arrives with "sitting" (state 1).
    owner, prob = load("just")
    cat_lines = (prob[..., BLACK] > 0.1) & (owner == 1) & rows_from(160)
    erase(owner, prob, (owner == 1) & rows_from(160))
    ink, pink = mouse_from_crop("just")
    insert(owner, prob, ink, pink, state=1)
    save("just", owner, prob)

    # ...in a cloud: same spot, now drawn in front of the cloud.
    owner, prob = load("cloud")
    erase(owner, prob, ndimage.binary_dilation(cat_lines, iterations=3))
    # A small tick under the cat only belonged to the cat-on-cloud drawing.
    lab, _ = ndimage.label(prob[..., BLACK] > 0.1)
    for i in np.unique(lab[400:432, 262:300]):
        if i and (lab == i).sum() < 400:
            erase(owner, prob, ndimage.binary_dilation(lab == i, iterations=2))
    erase(owner, prob, silhouette(ink))
    insert(owner, prob, ink, pink, state=0)
    save("cloud", owner, prob)

    # Sixth dimension: the original witch mouse replaces the floating cat.
    owner, prob = load("sixth")
    erase(owner, prob, (owner == 0) & rows_from(100))
    ink, pink = witch_mouse()
    insert(owner, prob, ink, pink, state=0, pink_class=HOTPINK)
    save("sixth", owner, prob)
    print("wrote", DST)


if __name__ == "__main__":
    main()
