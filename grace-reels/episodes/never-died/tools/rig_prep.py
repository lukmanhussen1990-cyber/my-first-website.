"""Prepare GPT parts for cut-out rigging (writes public/sprites/<char>/rig/<part>.png).

The parts sheets draw an outlined stub at both ends of every joint, which would show as seams when the
pieces overlap. Fixes:
  * head: cut the neck stub off below the jaw (soft edge) — the torso's neck stub becomes the neck;
  * torso: paint the top of the neck stub as plain skin, so a head tilt never reveals a cap or a hole;
  * limbs/torso: remove the lighter "joint caps" and the grey shoulder-disc rings that would stay visible.
Run: python tools/rig_prep.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'


def load(char, part):
    a = np.asarray(Image.open(SP / char / f'{part}.png').convert('RGBA')).copy()
    return a


def save(char, part, a):
    d = SP / char / 'rig'
    d.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(d / f'{part}.png', optimize=True)


def poly_mask(shape, pts):
    im = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.asarray(im) > 0


def cut(a, pts, feather=4.0):
    """Make the polygon transparent with a soft edge."""
    m = poly_mask(a.shape, pts).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), feather) if feather > 0 else m
    a[..., 3] = (a[..., 3] * (1 - np.clip(m * 1.6, 0, 1))).astype(np.uint8)


def fill(a, pts, sample_xy):
    """Paint the polygon with the color found at sample_xy (opaque)."""
    m = poly_mask(a.shape, pts)
    x, y = sample_xy
    col = np.median(a[y - 3:y + 4, x - 3:x + 4, :3].reshape(-1, 3), axis=0)
    a[m, :3] = col
    a[m, 3] = 255


def inpaint(a, mask, radius=7):
    """Repaint masked pixels with the nearest clean interior color (never pulls in the dark outline)."""
    L = lum(a)
    inner = interior(a, 8)
    base = np.median(L[inner & ~mask])
    source = inner & ~mask & (L > base - 45)
    _, (iy, ix) = ndimage.distance_transform_edt(~source, return_indices=True)
    filled = a[iy, ix, :3].astype(np.float32)
    soft = cv2.GaussianBlur(filled, (0, 0), radius * 0.5)
    m = mask[..., None]
    a[..., :3] = np.where(m, soft, a[..., :3]).astype(np.uint8)


def interior(a, inset=7):
    """Opaque pixels at least `inset` px from the silhouette edge (keeps the outer outline)."""
    solid = a[..., 3] > 128
    return ndimage.distance_transform_edt(solid) > inset


def lum(a):
    return a[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)


def remove_caps(a, ends=('top', 'bottom'), frac=0.24, delta=16):
    """Lighter elliptical joint caps near the ends of a limb -> limb color."""
    h = a.shape[0]
    ys, xs = np.nonzero(a[..., 3] > 128)
    top, bot = ys.min(), ys.max()
    inner = interior(a, 6)
    L = lum(a)
    mid = inner & (np.arange(h)[:, None] > top + (bot - top) * 0.35) & (np.arange(h)[:, None] < top + (bot - top) * 0.65)
    base = np.median(L[mid])
    mask = np.zeros(a.shape[:2], bool)
    rows = np.arange(h)[:, None]
    if 'top' in ends:
        mask |= inner & (rows < top + (bot - top) * frac) & (L > base + delta)
    if 'bottom' in ends:
        mask |= inner & (rows > bot - (bot - top) * frac) & (L > base + delta)
    mask = ndimage.binary_dilation(mask, iterations=3) & interior(a, 5)
    inpaint(a, mask)
    return int(mask.sum())


def remove_ring(a, center, radius, width=6, fill_disc=False):
    """Erase a drawn joint-disc ring (and optionally re-color the disc inside it)."""
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx - center[0], yy - center[1])
    ring = (np.abs(r - radius) <= width) if not fill_disc else (r <= radius + width)
    mask = ring & interior(a, 7)
    inpaint(a, mask, radius=9)
    return int(mask.sum())


def save_crop(char, part, a, pad=6):
    """Save the opaque bounding box of `a`; returns its top-left offset in the source."""
    ys, xs = np.nonzero(a[..., 3] > 0)
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(a.shape[1], xs.max() + pad + 1), min(a.shape[0], ys.max() + pad + 1)
    save(char, part, np.ascontiguousarray(a[y0:y1, x0:x1]))
    return int(x0), int(y0)


def elisha():
    """Elisha has no parts sheet: cut a walking rig out of his side view.

    body = side view without feet and without the near sleeve (robe + belt repainted underneath);
    arm  = sleeve + mitten hand (swings from the shoulder); foot = the near sandal (used for both feet).
    """
    src = load('elisha', 'side')  # 309 x 1024
    H, W = src.shape[:2]
    ink = np.array([43, 29, 18])
    robe = np.median(src[600:860, 150:230, :3].reshape(-1, 3), axis=0)
    robe_dark = np.median(src[600:860, 40:70, :3].reshape(-1, 3), axis=0)
    rope = np.median(src[432:450, 205:228, :3].reshape(-1, 3), axis=0)

    # Polygon runs along the OUTER side of the sleeve outline, so the whole outline travels with the arm.
    sleeve = poly_mask(src.shape, [(84, 262), (112, 234), (150, 226), (184, 233), (201, 262), (204, 286),
                                   (210, 420), (213, 466), (219, 548), (217, 557), (84, 561), (79, 520),
                                   (83, 420), (89, 330)])
    # The hand: skin + its outline inside the box under the cuff (robe pixels around it stay on the body).
    yy, xx = np.mgrid[0:H, 0:W]
    box = (xx >= 124) & (xx <= 218) & (yy >= 540) & (yy <= 646)
    r, g, b = [src[..., i].astype(int) for i in range(3)]
    skin = (r > g + 25) & (r > b + 45) & (r > 120)
    dark = (r + g + b) < 200
    hand = box & (skin | dark)
    hand = ndimage.binary_closing(hand, iterations=2)
    n, lab = cv2.connectedComponents(hand.astype(np.uint8))
    sizes = [(lab == i).sum() for i in range(1, n)]
    hand = lab == (1 + int(np.argmax(sizes)))
    hand = ndimage.binary_fill_holes(hand)
    belt_zone = (xx >= 202) & (yy > 414) & (yy < 466)          # rope + its outlines beside the sleeve
    below_cuff = (xx > 200) & (yy > 550) & ~hand               # robe peeking past the cuff corner
    arm_mask = (sleeve | hand) & (src[..., 3] > 0) & ~belt_zone & ~below_cuff

    arm = src.copy()
    arm[~arm_mask, 3] = 0
    top_fade = np.clip((yy - 226) / 20.0, 0, 1)  # the shoulder end melts into the same robe underneath
    arm[..., 3] = (arm[..., 3] * np.where(yy < 250, top_fade, 1)).astype(np.uint8)
    ax, ay = save_crop('elisha', 'arm', arm)

    body = src.copy()
    body[yy >= 899, 3] = 0  # feet off; the hem outline stays
    hole = (ndimage.binary_dilation(arm_mask, iterations=2) | (sleeve & belt_zone)) & (yy < 899)
    # Repaint the robe under the sleeve: back edge outline, shadow strip, main color, then the belt band.
    edge_x = lambda y: 84 - (y - 262) * (6 / 298)
    body[hole, 3] = 255
    for y in range(int(yy[hole].min()), int(yy[hole].max()) + 1):
        row = hole[y]
        if not row.any():
            continue
        ex = edge_x(min(max(y, 262), 560))
        for x in np.nonzero(row)[0]:
            if x < ex - 3:
                body[y, x, 3] = 0
            elif x < ex + 3:
                body[y, x, :3] = ink
            elif x < 122:
                body[y, x, :3] = robe_dark
            else:
                body[y, x, :3] = robe
    belt = hole & (yy >= 424) & (yy <= 457) & (xx > 0)
    for y in range(424, 458):
        for x in np.nonzero(belt[y])[0]:
            if x < edge_x(y) + 3:
                continue
            body[y, x, :3] = ink if (y < 429 or y > 452) else rope
    # The far hand edge may have kept a sliver of skin outside the arm mask: clean what the hand covered.
    save('elisha', 'body', body)

    foot = src.copy()
    near = (yy >= 899) & (xx >= 112)
    near &= ~((xx < 119) & (yy > 928))
    near &= ~(b > r)  # no robe-blue from the hem
    foot[~near, 3] = 0
    fx, fy = save_crop('elisha', 'foot', foot)
    offsets = {'arm': [ax, ay], 'foot': [fx, fy], 'body': [0, 0]}
    (SP / 'elisha' / 'rig' / 'offsets.json').write_text(json.dumps(offsets) + '\n')
    print(f'elisha arm offset ({ax},{ay}) foot offset ({fx},{fy}) robe {robe} dark {robe_dark} rope {rope}')


def main():
    elisha()
    # ---------- Elijah ----------
    head = load('elijah', 'head')
    cut(head, [(0, 213), (119, 213), (119, 272), (0, 272)], feather=2.5)
    save('elijah', 'head', head)
    torso = load('elijah', 'torso')
    fill(torso, [(148, 4), (208, 4), (208, 40), (148, 40)], (178, 48))
    save('elijah', 'torso', torso)
    for part in ['arm_upper_near', 'arm_upper_far']:
        a = load('elijah', part)
        n = remove_caps(a)
        save('elijah', part, a)
        print('elijah', part, 'cap px', n)
    for part in ['hair', 'beard', 'cloak', 'forearm_near', 'forearm_far', 'leg_near', 'leg_far']:
        save('elijah', part, load('elijah', part))

    # ---------- Enoch ----------
    head = load('enoch', 'head')
    cut(head, [(0, 263), (169, 263), (169, 354), (0, 354)], feather=2.5)
    save('enoch', 'head', head)
    torso = load('enoch', 'torso')
    fill(torso, [(163, 6), (240, 6), (240, 44), (163, 44)], (200, 52))
    print('enoch torso shoulder disc px', remove_ring(torso, (132, 135), 45, width=5, fill_disc=True))
    save('enoch', 'torso', torso)
    for part in ['arm_upper_near', 'arm_upper_far']:
        a = load('enoch', part)
        g = cv2.GaussianBlur(cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2GRAY), (5, 5), 1.5)
        circles = cv2.HoughCircles(g[:120], cv2.HOUGH_GRADIENT, dp=1, minDist=50, param1=60, param2=18, minRadius=22, maxRadius=48)
        cx, cy, r = circles[0][0] if circles is not None else (47, 47, 33)
        n = remove_ring(a, (cx, cy), r, width=5, fill_disc=True)
        save('enoch', part, a)
        print('enoch', part, f'ring at ({cx:.0f},{cy:.0f}) r={r:.0f}, px', n)
    for part in ['beard', 'sash', 'forearm_near', 'forearm_far', 'leg_near', 'leg_far']:
        save('enoch', part, load('enoch', part))


if __name__ == '__main__':
    main()
