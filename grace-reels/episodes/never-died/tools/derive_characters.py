"""Derive the characters GPT Image did not make (Moses, Jesus, Peter/James/John) from the approved art.

Recolor model: every pixel is treated as a mix between a material color C and the ink outline K
(p = a*C + (1-a)*K in linear light). Projecting onto that line recovers both the drawn shading and the
anti-aliased outline edges, so swapping C for a new color keeps the art's shading and leaves no pale fringe.

  moses/side.png       Enoch's side view: red-brown robe, white hair and long beard, shepherd's staff
  jesus/front.png      Enoch's three-quarter view: white robe, gold girdle, dark hair, shining featureless face
  disciples/*.png      Elisha's cry/kneel/pickup poses with three different hair shapes (shown as backlit silhouettes)
Run: python tools/derive_characters.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'
INK = np.array([48, 26, 12])


def to_lin(c):
    c = np.asarray(c, np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return (np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255 + 0.5).astype(np.uint8)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)])


def recolor(rgba, mapping, regions=None, max_residual=0.08):
    """mapping: {material_rgb: new_rgb}; regions: {material_rgb: bool mask} limiting where a material applies."""
    rgb = to_lin(rgba[..., :3])
    K = to_lin(INK)
    mats = list(mapping.items())
    res_maps, alpha_maps = [], []
    for src, _ in mats:
        C = to_lin(np.array(src))
        d = C - K
        a = np.clip(((rgb - K) @ d) / (d @ d), 0, 1.15)
        res = np.linalg.norm(rgb - (K + a[..., None] * d), axis=-1)
        if regions and src in regions:
            res = np.where(regions[src], res, np.inf)
        res_maps.append(res)
        alpha_maps.append(a)
    stack = np.stack(res_maps)
    # smoothed class choice so textured areas don't flip between materials (no speckle)
    smooth = np.stack([ndimage.gaussian_filter(np.where(np.isinf(r), 1.0, r), 1.6) for r in res_maps])
    smooth = np.where(np.isinf(stack), np.inf, smooth)
    idx = np.argmin(smooth, axis=0)
    best = np.take_along_axis(stack, idx[None], 0)[0]
    alpha = np.take_along_axis(np.stack(alpha_maps), idx[None], 0)[0]
    out = rgb.copy()
    for i, (_, dst) in enumerate(mats):
        m = (idx == i) & (best < max_residual) & (rgba[..., 3] > 0)
        T = to_lin(np.array(dst))
        out[m] = K + alpha[m][:, None] * (T - K)
    res = rgba.copy()
    res[..., :3] = to_srgb(out)
    return res


def material_box(rgba, color, pad=16, min_alpha=0.5):
    """Bounding box (as a mask) of pixels that are clearly `color` (used to keep the sash recolor off sandals)."""
    rgb = to_lin(rgba[..., :3])
    K, C = to_lin(INK), to_lin(np.array(color))
    d = C - K
    a = ((rgb - K) @ d) / (d @ d)
    res = np.linalg.norm(rgb - (K + np.clip(a, 0, 1.2)[..., None] * d), axis=-1)
    m = (res < 0.04) & (a > min_alpha) & (rgba[..., 3] > 200)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.nonzero(sizes > 400)[0])
    ys, xs = np.nonzero(keep)
    box = np.zeros(m.shape, bool)
    box[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad] = True
    return box


def recolor_by_lum(rgba, box, target, orig=None):
    """Recolor every sash-brown pixel inside `box` by brightness ratio (keeps its texture, any shade).
    The mask is computed on `orig` (the untouched art), so already-recolored pixels are never caught."""
    import cv2
    ref = rgba if orig is None else orig
    hsv = cv2.cvtColor(np.ascontiguousarray(ref[..., :3]), cv2.COLOR_RGB2HSV).astype(int)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = box & (H >= 2) & (H <= 26) & (S > 55) & (V < 165) & (V > 14) & (rgba[..., 3] > 0)
    m = ndimage.binary_closing(m, iterations=1) & box
    lin = to_lin(rgba[..., :3])
    lum = to_lin(ref[..., :3]) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    base = np.median(lum[m])
    T = to_lin(np.array(target))
    out = lin.copy()
    out[m] = np.clip(T[None] * (lum[m] / base)[:, None], 0, 1)
    res = rgba.copy()
    res[..., :3] = to_srgb(out)
    return res


def fix_leftovers(orig, out, colors, tol=62):
    """Pixels that still look like an old material (edge pixels the line model missed) take the color of
    the nearest pixel of the SAME original material that was recolored; alpha is untouched."""
    o = orig[..., :3].astype(int)
    same = np.zeros(orig.shape[:2], bool)
    for c in colors:
        same |= np.abs(o - np.array(c)).sum(-1) < tol
    same &= orig[..., 3] > 0
    changed = np.abs(out[..., :3].astype(int) - o).sum(-1) >= 12
    left = same & ~changed
    good = same & changed
    if not good.any() or not left.any():
        return out
    _, (iy, ix) = ndimage.distance_transform_edt(~good, return_indices=True)
    res = out.copy()
    res[left, :3] = out[iy[left], ix[left], :3]
    return res


def supersampled(size, draw_fn, ss=4):
    im = Image.new('RGBA', (size[0] * ss, size[1] * ss), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im), ss)
    return im.resize(size, Image.LANCZOS)


def load(p):
    return np.asarray(Image.open(SP / f'{p}.png').convert('RGBA')).copy()


def save(p, a):
    (SP / p).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(SP / f'{p}.png', optimize=True)


CREAM, CREAM_SH, GREY, SKIN, SASH = (235, 219, 187), (207, 183, 144), (137, 124, 116), (177, 111, 67), (116, 72, 41)


def moses():
    src = load('enoch/side')  # 255 x 1009, faces right
    H, W = src.shape[:2]
    yy = np.mgrid[0:H, 0:W][0]
    sash = material_box(src, SASH)
    a = recolor(src, {CREAM: (158, 72, 52), CREAM_SH: (118, 50, 38), GREY: (241, 236, 226), SKIN: SKIN},
                regions={GREY: yy < 240})
    a = recolor_by_lum(a, sash, (217, 196, 150), orig=src)
    a = fix_leftovers(src, a, [CREAM, CREAM_SH])
    ink = tuple(int(v) for v in INK) + (255,)
    wood = (107, 74, 46, 255)
    X = 150  # the staff passes through the fist

    def staff(d, s):
        d.line([(X * s, 236 * s), (X * s, (H - 4) * s)], fill=ink, width=20 * s)
        d.line([(X * s, 240 * s), (X * s, (H - 8) * s)], fill=wood, width=10 * s)
        d.ellipse([((X - 13) * s, 226 * s), ((X + 13) * s, 252 * s)], fill=wood, outline=ink, width=5 * s)

    def beard(d, s):
        pts = [(150, 214), (232, 210), (238, 244), (232, 300), (218, 350), (204, 398), (190, 352), (176, 300), (160, 252)]
        P = [(x * s, y * s) for x, y in pts]
        d.polygon(P, fill=(241, 236, 226, 255))
        shade = [(154, 222), (176, 226), (182, 300), (196, 360), (200, 384), (186, 352), (172, 300), (160, 254)]
        d.polygon([(x * s, y * s) for x, y in shade], fill=(214, 206, 194, 255))
        for k in range(4):
            x0 = 186 + k * 11
            d.line([(x0 * s, 236 * s), ((x0 - 6) * s, (318 - k * 10) * s)], fill=(206, 198, 186, 255), width=3 * s)
        side = P[1:] + [P[0]]  # outline everything except the top edge (it melts into the jaw beard)
        d.line(side, fill=ink, width=6 * s, joint='curve')

    base = Image.fromarray(a)
    base.alpha_composite(supersampled((W, H), staff))
    hand = np.zeros((H, W), bool)
    hand[528:646, 84:166] = True
    hand &= (a[..., 3] > 0)
    base.alpha_composite(Image.fromarray(np.where(hand[..., None], a, 0).astype(np.uint8)))
    beard_im = np.asarray(supersampled((W, H), beard)).copy()
    fade = np.clip((yy - 214) / 12.0, 0, 1)  # top edge melts into the jaw beard
    beard_im[..., 3] = (beard_im[..., 3] * fade).astype(np.uint8)
    base.alpha_composite(Image.fromarray(beard_im))
    save('moses/side', np.asarray(base))


def jesus():
    src = load('enoch/threequarter')  # 415 x 1015
    H, W = src.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    sash = material_box(src, SASH)
    a = recolor(src, {CREAM: (255, 252, 242), CREAM_SH: (238, 226, 198), GREY: (66, 46, 33), SKIN: SKIN},
                regions={GREY: yy < 240})
    a = recolor_by_lum(a, sash, (236, 210, 146), orig=src)
    a = fix_leftovers(src, a, [CREAM, CREAM_SH, SASH])
    # Shining face: every skin pixel of the head (plus the eye/brow/nose drawn inside it) becomes flat pale gold.
    rgb = src[..., :3].astype(int)
    skin = (rgb[..., 0] > rgb[..., 1] + 40) & (rgb[..., 1] > rgb[..., 2] + 20) & (src[..., 3] > 200) & (yy < 232)
    face = ndimage.binary_fill_holes(ndimage.binary_closing(skin, iterations=3))
    face = ndimage.binary_erosion(face, iterations=1)
    gold = np.array([255, 231, 168])
    a[face, :3] = gold
    # soft inner light toward the center of the face
    cy, cx = np.mean(np.nonzero(face), axis=1)
    r = np.hypot(xx - cx, yy - cy)
    glow = np.clip(1 - r / 70, 0, 1)[..., None]
    a[..., :3] = np.where(face[..., None], (a[..., :3] * (1 - glow * 0.5) + np.array([255, 248, 222]) * glow * 0.5), a[..., :3]).astype(np.uint8)
    # Hands and feet a touch brighter (He is in the light).
    rest = skin_all = (rgb[..., 0] > rgb[..., 1] + 40) & (rgb[..., 1] > rgb[..., 2] + 20) & (src[..., 3] > 200) & (yy >= 232)
    a[rest, :3] = np.clip(a[rest, :3].astype(int) * 1.12 + 10, 0, 255).astype(np.uint8)
    save('jesus/front', a)


def head_circle(rgba):
    """Center/radius of the topmost round head (bald) in a pose sprite."""
    rgb = rgba[..., :3].astype(int)
    skin = (rgb[..., 0] > rgb[..., 1] + 40) & (rgb[..., 1] > rgb[..., 2] + 20) & (rgba[..., 3] > 200)
    ys, xs = np.nonzero(skin)
    top = ys.min()
    band = skin & (np.arange(rgba.shape[0])[:, None] < top + 130)
    lab, n = ndimage.label(band)
    sizes = ndimage.sum(band, lab, range(1, n + 1))
    k = 1 + int(np.argmax(sizes))
    ys, xs = np.nonzero(lab == k)
    return float(xs.mean()), float(ys.mean()), float((xs.max() - xs.min()) / 2)


def disciples():
    specs = {
        'peter': ('pose_cry', 'curly', (63, 58, 54)),
        'james': ('pose_kneel', 'long', (58, 40, 28)),
        'john': ('pose_pickup', 'short', (31, 26, 23)),
    }
    for name, (pose, style, col) in specs.items():
        src = load(f'elisha/{pose}')
        H, W = src.shape[:2]
        cx, cy, r = head_circle(src)
        ink = tuple(int(v) for v in INK) + (255,)
        fill = tuple(int(v) for v in col) + (255,)

        def hair(d, s, cx=cx, cy=cy, r=r, style=style):
            if style == 'curly':
                d.chord([((cx - r * 1.05) * s, (cy - r * 1.1) * s), ((cx + r * 0.95) * s, (cy + r * 0.75) * s)], 160, 360, fill=fill)
                for k in range(13):
                    ang = np.pi * (0.92 + k * 0.095)
                    bx, by = cx + np.cos(ang) * r * 0.95, cy + np.sin(ang) * r * 0.95 - r * 0.08
                    rr = r * 0.34
                    d.ellipse([((bx - rr) * s, (by - rr) * s), ((bx + rr) * s, (by + rr) * s)], fill=fill, outline=ink, width=4 * s)
            elif style == 'long':
                d.chord([((cx - r * 1.08) * s, (cy - r * 1.12) * s), ((cx + r * 1.0) * s, (cy + r * 0.9) * s)], 150, 360, fill=fill, outline=ink, width=5 * s)
                d.polygon([((cx - r * 1.05) * s, (cy - r * 0.2) * s), ((cx - r * 0.35) * s, (cy - r * 0.3) * s),
                           ((cx - r * 0.45) * s, (cy + r * 1.05) * s), ((cx - r * 1.0) * s, (cy + r * 0.95) * s)], fill=fill, outline=ink, width=5 * s)
            else:
                d.chord([((cx - r * 1.04) * s, (cy - r * 1.1) * s), ((cx + r * 0.98) * s, (cy + r * 0.7) * s)], 165, 355, fill=fill, outline=ink, width=5 * s)

        layer = supersampled((W, H), hair)
        base = Image.fromarray(src)
        base.alpha_composite(layer)
        save(f'disciples/{name}', np.asarray(base))


if __name__ == '__main__':
    moses()
    jesus()
    disciples()
    print('derived: moses/side, jesus/front, disciples/peter|james|john')
