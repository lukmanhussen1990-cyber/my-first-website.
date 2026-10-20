"""16x16 inventory icons (guns, magazines, ammo) and pack icons."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .preview import model_from_geo
from .render import Renderer, collect_quads
from .rig import look_at_camera, rx


def _render_side(geo, tex, size, tilt_deg, pad=0.06):
    """Orthographic right-side render, muzzle to the right, tilted upwards."""
    m = model_from_geo(geo)
    mats = m.world_matrices({}, bound=np.eye(4))
    q = collect_quads(m, mats, texture=tex.astype(float) / 255.0)
    # rotate the whole gun about the view axis (x) so the muzzle points up-right
    R = np.eye(4)
    R[:3, :3] = rx(tilt_deg)
    q = [((v @ R[:3, :3].T), uv, R[:3, :3] @ n, t, c) for v, uv, n, t, c in q]
    pts = np.vstack([v for v, *_ in q])
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    c = (lo + hi) / 2
    span_y = hi[1] - lo[1]
    span_z = hi[2] - lo[2]
    r = Renderer(size, size, bg=(0, 0, 0, 0), ss=1)
    r.light = np.array([0.25, 0.85, 0.45])
    r.light /= np.linalg.norm(r.light)
    scale = size * (1 - 2 * pad) / max(span_y, span_z)
    r.set_ortho(scale)
    cam = look_at_camera(c + np.array([200.0, 0, 0]), c)
    r.draw(q, cam)
    return r.image()


def _downsample_icon(img, out=16, alpha_thresh=0.42):
    # thicken thin parts (barrels, scopes) so they survive the reduction
    alpha = img.split()[3].filter(ImageFilter.MaxFilter(11))
    rgb = img.convert("RGB")
    grown = Image.merge("RGBA", (*rgb.split(), alpha))
    # fill the newly grown pixels with neighbouring colours
    filled = img.filter(ImageFilter.MaxFilter(11))
    base = Image.alpha_composite(Image.merge("RGBA", (*filled.convert("RGB").split(), alpha)), img)
    img = base
    a = np.asarray(img).astype(float) / 255.0
    H = a.shape[0]
    k = H // out
    a = a[:k * out, :k * out].reshape(out, k, out, k, 4)
    alpha = a[..., 3].mean(axis=(1, 3))
    w = a[..., 3:4]
    rgb = (a[..., :3] * w).sum(axis=(1, 3)) / np.maximum(w.sum(axis=(1, 3)), 1e-6)
    mask = alpha >= alpha_thresh
    # make thin parts survive: a pixel with lower coverage but strong
    # neighbours along a line is kept
    weak = (alpha >= 0.22) & ~mask
    for y, x in zip(*np.nonzero(weak)):
        n = 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < out and 0 <= xx < out and mask[yy, xx]:
                n += 1
        if n >= 1:
            mask[y, x] = True
    # brighten + boost contrast (the 3D textures are tuned for in-world lighting)
    rgb = np.clip(rgb * 1.45, 0, 1) ** 0.85
    rgb = np.clip((rgb - 0.5) * 1.15 + 0.5, 0, 1)
    res = np.zeros((out, out, 4))
    res[..., :3] = rgb
    res[..., 3] = mask
    # dark outline on the silhouette border (inside), Minecraft style
    border = np.zeros_like(mask)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.zeros_like(mask)
        ys = slice(max(dy, 0), out + min(dy, 0))
        yd = slice(max(-dy, 0), out + min(-dy, 0))
        xs = slice(max(dx, 0), out + min(dx, 0))
        xd = slice(max(-dx, 0), out + min(-dx, 0))
        sh[yd, xd] = mask[ys, xs]
        border |= mask & ~sh
    res[border, :3] *= 0.62
    return Image.fromarray((res * 255).astype(np.uint8), "RGBA")


def gun_icon(geo, tex, tilt=36.0):
    big = _render_side(geo, tex, 512, tilt, pad=0.015)
    return _downsample_icon(big)


def gun_render(geo, tex, size, tilt=20.0, pad=0.08):
    return _render_side(geo, tex, size * 2, tilt, pad).resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Hand-drawn style pixel icons for magazines and ammo
# ---------------------------------------------------------------------------
def _shade(c, f):
    return tuple(int(max(0, min(255, v * f))) for v in c[:3]) + (255,)


def magazine_icon(kind, color=(64, 66, 72), curved=0.0, wide=False, box=False):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    if box:
        # ammo box (M249) with belt
        for y in range(5, 14):
            for x in range(2, 13):
                edge = y in (5, 13) or x in (2, 12)
                px[x, y] = _shade(color, 0.62 if edge else (1.1 if y < 7 else 1.0))
        for x in range(3, 12, 2):
            px[x, 8] = _shade(color, 0.8)
        for i, x in enumerate(range(9, 15)):
            y = 4 - i // 2
            px[x, max(0, y)] = (212, 172, 80, 255)
            px[x, max(0, y) + 1] = (150, 112, 50, 255)
        return img
    w = 4 if not wide else 5
    top = 2
    for row in range(12):
        y = top + row
        off = int(round(curved * (row / 11.0) ** 1.6 * 4))
        x0 = 6 + off - (w // 2)
        for x in range(x0, x0 + w):
            edge = x in (x0, x0 + w - 1) or row in (0, 11)
            f = 0.6 if edge else (1.15 if x == x0 + 1 else 1.0)
            if row % 3 == 1 and not edge:
                f *= 0.85
            px[x, y] = _shade(color, f)
    # cartridges peeking out of the top
    for x in range(6 - w // 2 + 1, 6 - w // 2 + w - 1):
        px[x, 1] = (214, 174, 82, 255)
        px[x, 0] = (180, 112, 58, 255) if x % 2 else (0, 0, 0, 0)
    return img


def ammo_icon(case_col, tip_col, shell=False):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = img.load()
    rounds = [(3, 3), (7, 2), (11, 3)]
    for bx, by in rounds:
        if shell:
            for y in range(by, by + 10):
                for x in range(bx - 1, bx + 2):
                    col = case_col if y < by + 8 else tip_col
                    f = 1.2 if x == bx - 1 else (0.7 if x == bx + 1 else 1.0)
                    d[x, y] = _shade(col, f)
            continue
        for y in range(by, by + 11):
            for x in range(bx - 1, bx + 2):
                if y < by + 3:
                    if y == by and x != bx:
                        continue
                    col = tip_col
                else:
                    col = case_col
                f = 1.25 if x == bx - 1 else (0.7 if x == bx + 1 else 1.0)
                d[x, y] = _shade(col, f)
        for x in range(bx - 1, bx + 2):
            d[x, by + 10] = _shade(case_col, 0.6)
    return img


def pack_icon(gun_images, subtitle="", title_color=(236, 206, 128)):
    from PIL import ImageFont
    W = 256
    yy, xx = np.mgrid[0:W, 0:W]
    r = np.hypot(xx - W * 0.5, yy - W * 0.42) / (W * 0.72)
    base = np.clip(1.0 - r, 0, 1)
    g = np.zeros((W, W, 4), dtype=np.uint8)
    g[..., 0] = (20 + 54 * base).astype(np.uint8)
    g[..., 1] = (24 + 50 * base).astype(np.uint8)
    g[..., 2] = (28 + 44 * base).astype(np.uint8)
    g[..., 3] = 255
    bg = Image.fromarray(g, "RGBA")
    for img, (x, y) in gun_images:
        shadow = img.split()[3].filter(ImageFilter.GaussianBlur(6))
        sh = Image.new("RGBA", img.size, (0, 0, 0, 160))
        sh.putalpha(shadow.point(lambda v: int(v * 0.7)))
        bg.alpha_composite(sh, (x + 6, y + 8))
        bg.alpha_composite(img, (x, y))
    d = ImageDraw.Draw(bg)
    title = ImageFont.load_default(size=30)
    small = ImageFont.load_default(size=15)
    for text, font, y, col in (("REALISTIC GUNS", title, 196, title_color),
                               (subtitle, small, 230, (180, 184, 190))):
        if not text:
            continue
        tw = d.textlength(text, font=font)
        x = (W - tw) / 2
        d.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 200))
        d.text((x, y), text, font=font, fill=col + (255,))
    d.rectangle((0, 0, W - 1, W - 1), outline=(96, 84, 58, 255), width=4)
    return bg
