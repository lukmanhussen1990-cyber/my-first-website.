"""Render a 5-second logo intro (1920x1080, 30fps MP4) from gemini-logo.jpg.

The star and the wordmark are lifted out of the source image as separate
layers (so the artwork itself is never redrawn) and animated:

  0.0 - 1.4s  star fades in at frame centre, scaling up and rotating, with a soft glow
  1.0 - 2.0s  star glides to its place in the lockup
  1.3 - 2.5s  "Gemini" fades in and slides left-to-right out from behind the star
  2.6 - 3.4s  one subtle light sweep across the full logo
  3.5 - 5.0s  final logo, completely still (the frames are the source image)

Usage:  python3 animate_logo.py [output.mp4]
Needs:  pillow, numpy, ffmpeg on PATH
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "gemini-logo.jpg"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "gemini-logo-intro.mp4"

W, H, FPS, DURATION = 1920, 1080, 30, 5.0
HOLD_FROM = 3.5  # final 1.5s is perfectly still


# ---------------------------------------------------------------- easing
def clamp01(x):
    return min(1.0, max(0.0, x))


def progress(t, start, end):
    return clamp01((t - start) / (end - start))


def ease_out_cubic(x):
    return 1 - (1 - x) ** 3


def ease_out_quart(x):
    return 1 - (1 - x) ** 4


def ease_in_out_cubic(x):
    return 4 * x**3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_in_out_sine(x):
    return -(np.cos(np.pi * x) - 1) / 2


# ---------------------------------------------------------------- layers
def load_base():
    img = Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(img).astype(np.float32)


def dilate_colors(rgb, known, iterations):
    """Spread known pixel colours outward so edge pixels have a solid colour."""
    rgb = rgb * known[..., None]
    weight = known.astype(np.float32)
    for _ in range(iterations):
        acc_c = np.zeros_like(rgb)
        acc_w = np.zeros_like(weight)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                acc_c += np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc_w += np.roll(np.roll(weight, dy, 0), dx, 1)
        fill = (weight == 0) & (acc_w > 0)
        rgb[fill] = acc_c[fill] / acc_w[fill][:, None]
        weight = np.where(fill, 1.0, weight)
    return rgb


def extract_star(base, x0, x1):
    """Straight-alpha RGBA of the gradient star from the region [x0, x1)."""
    region = base[:, x0:x1]
    ink = 255 - region.min(axis=2)
    interior = ink >= 110
    solid = dilate_colors(region.copy(), interior, 12)
    # Least-squares alpha against the nearest solid colour: p = a*c + (1-a)*255
    num = ((255 - region) * (255 - solid)).sum(axis=2)
    den = ((255 - solid) ** 2).sum(axis=2) + 1e-6
    alpha = np.clip(num / den, 0, 1)
    alpha[interior] = 1.0
    alpha[ink < 8] = 0.0  # JPEG noise in the white background
    rgb = np.where(interior[..., None], region, solid)
    return rgb, alpha


def extract_text(base, x0):
    region = base[:, x0:]
    lum = region.mean(axis=2)
    dark = lum < 45
    color = np.median(region[dark], axis=0)
    alpha = np.clip((255 - lum) / (255 - color.mean()), 0, 1)
    alpha[lum > 250] = 0.0
    rgb = np.broadcast_to(color, region.shape).copy()
    return rgb, alpha


def bbox(alpha):
    ys, xs = np.where(alpha > 0.02)
    return xs.min(), xs.max(), ys.min(), ys.max()


def to_rgba_image(rgb, alpha):
    arr = np.dstack([rgb, alpha[..., None] * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def affine_render(sprite, cx_sprite, cy_sprite, cx, cy, scale, angle_deg):
    """Place `sprite` so its point (cx_sprite, cy_sprite) lands on (cx, cy) in
    the frame, scaled and rotated about that point. Returns premultiplied
    float arrays (rgb_premult, alpha)."""
    th = np.radians(angle_deg)
    cos, sin = np.cos(th) / scale, np.sin(th) / scale
    # Inverse map: frame (x, y) -> sprite (u, v)
    a, b = cos, sin
    d, e = -sin, cos
    c = cx_sprite - a * cx - b * cy
    f = cy_sprite - d * cx - e * cy
    out = sprite.transform((W, H), Image.AFFINE, (a, b, c, d, e, f),
                           resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    arr = np.asarray(out).astype(np.float32)
    alpha = arr[..., 3] / 255.0
    return arr[..., :3] * alpha[..., None], alpha


def gaussian_matrix(n, sigma):
    idx = np.arange(n, dtype=np.float32)
    k = np.exp(-((idx[:, None] - idx[None, :]) / sigma) ** 2 / 2)
    return k / k.sum(axis=1, keepdims=True)


BLUR_DOWN = 4
BLUR_KY = gaussian_matrix(H // BLUR_DOWN, 9.0)
BLUR_KX = gaussian_matrix(W // BLUR_DOWN, 9.0)


def soft_blur(rgb_p, alpha):
    """Wide Gaussian blur of a premultiplied layer (done at quarter size)."""
    out = []
    for ch in [rgb_p[..., 0], rgb_p[..., 1], rgb_p[..., 2], alpha]:
        small = Image.fromarray(ch.astype(np.float32)).resize(
            (W // BLUR_DOWN, H // BLUR_DOWN), Image.BOX)
        blurred = BLUR_KY @ np.asarray(small) @ BLUR_KX.T
        big = Image.fromarray(blurred.astype(np.float32)).resize((W, H), Image.BICUBIC)
        out.append(np.asarray(big))
    return np.dstack(out[:3]).clip(0, None), out[3].clip(0, 1)


def over(dst, src_rgb_p, src_a):
    return src_rgb_p + dst * (1 - src_a[..., None])


def sweep_band(t):
    """Soft diagonal highlight band moving left to right across the logo."""
    p = progress(t, 2.6, 3.4)
    if p <= 0 or p >= 1:
        return None
    x_lo, x_hi = LOGO_X0 - 260, LOGO_X1 + 260
    centre = x_lo + (x_hi - x_lo) * ease_in_out_sine(p)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    skew = (ys - H / 2) * np.tan(np.radians(22))
    dist = xs + skew - centre
    band = np.exp(-(dist / 38.0) ** 2)
    envelope = np.sin(np.pi * p)  # fade the sheen in and out
    return band * envelope * 0.32


def lighten(rgb_p, alpha, band):
    if band is None:
        return rgb_p
    return rgb_p + band[..., None] * (alpha[..., None] * 255 - rgb_p)


# ---------------------------------------------------------------- setup
base = load_base()
ink = 255 - base.min(axis=2)
cols = np.where((ink > 30).any(axis=0))[0]
gaps = np.where(np.diff(cols) > 20)[0]
split = int((cols[gaps[0]] + cols[gaps[0] + 1]) / 2)  # between star and "G"

star_rgb, star_a = extract_star(base, 0, split)
text_rgb, text_a = extract_text(base, split)

sx0, sx1, sy0, sy1 = bbox(star_a)
star_cx, star_cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2  # final star centre
tx0, tx1, ty0, ty1 = bbox(text_a)
tx0, tx1 = tx0 + split, tx1 + split
LOGO_X0, LOGO_X1 = sx0, tx1

star_sprite = to_rgba_image(star_rgb, star_a)
text_full_rgb = np.zeros((H, W, 3), np.float32)
text_full_a = np.zeros((H, W), np.float32)
text_full_rgb[:, split:] = text_rgb
text_full_a[:, split:] = text_a
text_sprite = to_rgba_image(text_full_rgb, text_full_a)

xs_grid = np.arange(W, dtype=np.float32)[None, :]


def render_layers(t):
    frame = np.full((H, W, 3), 255.0, np.float32)
    band = sweep_band(t)

    # ---- star: appear at frame centre, then glide into the lockup
    opacity = ease_out_cubic(progress(t, 0.0, 0.7))
    scale = 0.35 + 0.65 * ease_out_quart(progress(t, 0.0, 1.2))
    angle = -135 * (1 - ease_out_cubic(progress(t, 0.0, 1.4)))
    glide = ease_in_out_cubic(progress(t, 1.0, 2.0))
    cx = W / 2 + (star_cx - W / 2) * glide
    cy = H / 2 + (star_cy - H / 2) * glide
    s_rgb, s_a = affine_render(star_sprite, star_cx, star_cy, cx, cy, scale, angle)
    s_rgb, s_a = s_rgb * opacity, s_a * opacity

    # ---- glow: soft coloured bloom behind the star, rising then settling away
    glow = 0.0
    if 0.15 < t < 2.6:
        rise = ease_out_cubic(progress(t, 0.15, 0.85))
        fall = 1 - ease_in_out_cubic(progress(t, 0.85, 2.6))
        glow = 0.42 * rise * fall
    if glow > 0.002:
        g_rgb, g_a = soft_blur(s_rgb, s_a)
        frame = over(frame, g_rgb * glow, g_a * glow)

    # ---- text: fade + slide left-to-right with a soft left-to-right wipe
    tp = progress(t, 1.3, 2.5)
    if tp > 0:
        te = ease_out_cubic(tp)
        offset = -80 * (1 - te)
        t_rgb, t_a = affine_render(text_sprite, W / 2, H / 2,
                                   W / 2 + offset, H / 2, 1.0, 0.0)
        soft = 140.0
        edge = (tx0 + offset - soft) + (tx1 - tx0 + 2 * soft) * ease_in_out_sine(clamp01(tp / 0.9))
        wipe = np.clip((edge - xs_grid) / soft, 0, 1)
        mask = wipe * te
        t_rgb = lighten(t_rgb * mask[..., None], t_a * mask, band)
        t_a = t_a * mask
        frame = over(frame, t_rgb, t_a)

    s_rgb = lighten(s_rgb, s_a, band)
    frame = over(frame, s_rgb, s_a)
    return frame


# Re-extracted layers differ from the JPEG by a few levels at some edge pixels;
# once everything is at rest, blend that residual in so the hold is seamless.
RESIDUAL = base - render_layers(HOLD_FROM - 0.01)


def render(t):
    if t >= HOLD_FROM:
        return base
    return render_layers(t) + RESIDUAL * ease_in_out_sine(progress(t, 2.45, 2.6))


def main():
    n = int(round(DURATION * FPS))
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-vf", "scale=out_color_matrix=bt709:out_range=tv",
        "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-movflags", "+faststart", str(OUT),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        frame = render(i / FPS)
        proc.stdin.write(np.round(frame).clip(0, 255).astype(np.uint8).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"wrote {OUT} ({n} frames)")


if __name__ == "__main__":
    main()
