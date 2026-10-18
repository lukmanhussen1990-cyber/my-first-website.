#!/usr/bin/env python3
"""Re-render the "TESLA" car-stunt logo animation with a bigger jump and a clean A.

The source clip is a 13 s, 1920x1080, 60 fps white-on-black motion graphic that
plays a 390-frame loop twice: the word "TESL" slides in, a car drives up, pops out
of springs, flips through the air and lands as the "A", then drives off.

This script keeps the original footage for the intro and the outro, and replaces
the middle of each loop with a procedural re-render:

  * launch   - the car crouches on its springs and fires off them
  * flight   - ~3x higher parabolic arc, three forward flips plus a full 360 deg
               twist at the apex, sub-frame motion blur, dotted wheel trails,
               a ground glow that fades with altitude, and a camera that pulls
               back and tracks the car so it never leaves the frame
  * landing  - the car folds into the A on the way down, lands with a
               squash-and-settle and a small camera shake
  * hold     - clean TESLA wordmark
  * drive-off- the A unfolds back into the car, which accelerates into the
               original drive-off footage

The A is rebuilt from the wordmark's own E blades so it is symmetric and matches
the rest of the lettering (same blade bar, same stem width as the L).

Usage: python3 render_tesla_stunt.py INPUT.mp4 OUTPUT.mp4
Requires ffmpeg, numpy and Pillow.
"""
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

W, H = 1920, 1080
FPS = 60
LOOP = 390                 # frames in one loop of the source clip

# Original-footage frame numbers (1-based, as written by ffmpeg)
INTRO_END = 92             # keep 1..92: text slides in, car arrives, springs extend
LAUNCH_REF = 93            # car sitting on fully extended springs
STATIC_REF = 229           # wordmark at rest
DRIVE_REF = 298            # car driving off, clear of the A
OUTRO_START = DRIVE_REF    # keep 298..390: drive-off and text exit

# Wordmark geometry (pixels in the source frame)
BASE_TOP, BASE_BOT = 484, 595
A_X0, A_W = 1263, 129
E_X0 = 723
STEM_W = 22                # stem width of the L
TEXT_CUT = 1240            # everything left of this is "TESL"

# New-section timing (frames)
CROUCH = 8
AIR = 150
HOLD = 60
MORPH_OUT = 22
ACCEL = 15
SUB = 8                    # motion-blur sub-samples
SHUTTER = 0.5              # fraction of a frame the shutter is open

FLIGHT_HEIGHT = 1200       # apex height above the launch point (original ~450)
FLIPS = 3
CAR_CROUCH = 28


def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def load(path):
    return np.asarray(Image.open(path).convert("L")).astype(np.float32) / 255.0


# --------------------------------------------------------------------------- assets

def build_assets(frames):
    f = lambda n: load(os.path.join(frames, f"{n:04d}.png"))
    static = f(STATIC_REF)
    launch = f(LAUNCH_REF)
    drive = f(DRIVE_REF)

    text = static.copy()
    text[:, TEXT_CUT:] = 0

    # Clean A: the E's top blade, then the E's middle blade joined to two stems.
    e = static[BASE_TOP:BASE_BOT + 1, E_X0:E_X0 + A_W]
    e = 0.5 * (e + e[:, ::-1])
    glyph = np.zeros_like(e)
    split = 529 - BASE_TOP
    glyph[:split] = e[:split]
    mid_end = 562 - BASE_TOP          # stop before the E's bottom blade
    glyph[split:mid_end] = e[split:mid_end]
    glyph[split:, :STEM_W] = 1
    glyph[split:, A_W - STEM_W:] = 1

    # Flight car: body/spoiler above the springs plus the two wheel rims.
    yy, xx = np.mgrid[0:H, 0:W]
    car_mask = (yy >= 440) & (yy <= 541) & (xx < 520)
    car_mask |= (yy >= 542) & (yy <= 566) & (((xx >= 118) & (xx <= 205)) | ((xx >= 372) & (xx <= 455)))
    car = np.where(car_mask, launch, 0)
    springs = np.where((~car_mask) & (yy >= 536) & (yy <= 600) & (xx < 520), launch, 0)

    # Drive-off car (from the frame the outro resumes on) and its dotted trail.
    drive_mask = (yy >= 478) & (yy <= 600) & (xx >= 1350)
    drive_mask &= ~((yy >= 546) & (yy <= 566) & (xx < 1366))
    dcar = np.where(drive_mask, drive, 0)
    trail = np.where((yy >= 546) & (yy <= 566) & (xx >= TEXT_CUT - 5) & (xx < 1366), drive, 0)

    return dict(text=text, glyph=glyph, car=crop(car), springs=springs,
                dcar=crop(dcar), trail=trail)


def crop(img, pad=4):
    ys, xs = np.nonzero(img > 0.02)
    y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad + 1, xs.min() - pad, xs.max() + pad + 1
    sprite = img[y0:y1, x0:x1]
    centre = ((x0 + x1 - 1) / 2.0, (y0 + y1 - 1) / 2.0)
    return dict(img=Image.fromarray((sprite * 255).astype(np.uint8)), arr=sprite,
                centre=centre, w=x1 - x0 - 2 * pad, h=y1 - y0 - 2 * pad)


def glyph_sprite(glyph):
    g = np.pad(glyph, 4)
    return dict(img=Image.fromarray((g * 255).astype(np.uint8)), arr=g,
                centre=(A_X0 + (A_W - 1) / 2.0, (BASE_TOP + BASE_BOT) / 2.0),
                w=A_W, h=BASE_BOT - BASE_TOP + 1)


# --------------------------------------------------------------------------- drawing

class Camera:
    def __init__(self, s=1.0, cx=W / 2, cy=H / 2):
        self.s, self.cx, self.cy = s, cx, cy

    def to_screen(self, x, y):
        return ((x - self.cx) * self.s + W / 2, (y - self.cy) * self.s + H / 2)


def draw_layer(canvas, layer_img, cam):
    """Full-frame layer drawn in world space (text, springs, trails)."""
    if cam.s == 1 and cam.cx == W / 2 and cam.cy == H / 2:
        np.maximum(canvas, layer_img, out=canvas)
        return
    inv = 1.0 / cam.s
    coeffs = (inv, 0, cam.cx - W / 2 * inv, 0, inv, cam.cy - H / 2 * inv)
    im = Image.fromarray((layer_img * 255).astype(np.uint8))
    out = im.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC)
    np.maximum(canvas, np.asarray(out, np.float32) / 255.0, out=canvas)


def draw_sprite(acc, sprite, pos, angle_deg, sx, sy, cam, alpha=1.0, anchor=None):
    """Draw a sprite into acc (additive) at world pos with rotation/scale.

    The sprite's local origin is its centre unless anchor (world point measured
    in the sprite's rest pose) is given, in which case scaling happens about it.
    """
    if alpha <= 0.001:
        return
    sx = math.copysign(max(abs(sx), 0.02), sx)
    img = sprite["img"]
    sw, sh = img.size
    q0 = ((sw - 1) / 2.0, (sh - 1) / 2.0)
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    # world = pos + R * D * (q - q0); screen = (world - c) * s + half
    m00, m01 = ca * sx, -sa * sy
    m10, m11 = sa * sx, ca * sy
    corners = []
    for qx, qy in ((0, 0), (sw, 0), (0, sh), (sw, sh)):
        lx, ly = qx - q0[0], qy - q0[1]
        wx = pos[0] + m00 * lx + m01 * ly
        wy = pos[1] + m10 * lx + m11 * ly
        corners.append(cam.to_screen(wx, wy))
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    bx0, by0 = max(int(math.floor(min(xs))) - 2, 0), max(int(math.floor(min(ys))) - 2, 0)
    bx1, by1 = min(int(math.ceil(max(xs))) + 2, W), min(int(math.ceil(max(ys))) + 2, H)
    if bx1 <= bx0 or by1 <= by0:
        return
    # inverse: q = q0 + M^-1 * ((screen - half)/s + c - pos)
    det = m00 * m11 - m01 * m10
    i00, i01, i10, i11 = m11 / det, -m01 / det, -m10 / det, m00 / det
    k = 1.0 / cam.s
    ox = (bx0 - W / 2) * k + cam.cx - pos[0]
    oy = (by0 - H / 2) * k + cam.cy - pos[1]
    coeffs = (i00 * k, i01 * k, q0[0] + i00 * ox + i01 * oy,
              i10 * k, i11 * k, q0[1] + i10 * ox + i11 * oy)
    out = img.transform((bx1 - bx0, by1 - by0), Image.AFFINE, coeffs, resample=Image.BICUBIC)
    acc[by0:by1, bx0:bx1] += alpha * np.asarray(out, np.float32) / 255.0


_DOT = None


def splat(canvas, x, y, radius, value):
    global _DOT
    if _DOT is None:
        g = np.mgrid[-8:9, -8:9]
        _DOT = g
    r = max(radius, 0.8)
    xi, yi = int(round(x)), int(round(y))
    if xi < -10 or yi < -10 or xi > W + 10 or yi > H + 10:
        return
    gy, gx = _DOT
    d = np.sqrt((gx + xi - x) ** 2 + (gy + yi - y) ** 2)
    k = np.clip(r + 0.5 - d, 0, 1) * value
    y0, x0 = yi - 8, xi - 8
    sy0, sx0 = max(0, -y0), max(0, -x0)
    y1, x1 = min(H, y0 + 17), min(W, x0 + 17)
    if y1 <= max(y0, 0) or x1 <= max(x0, 0):
        return
    region = canvas[max(y0, 0):y1, max(x0, 0):x1]
    np.maximum(region, k[sy0:sy0 + region.shape[0], sx0:sx0 + region.shape[1]], out=region)


def ground_glow(canvas, x_world, height, cam, strength=0.16):
    """Soft pool of light on the baseline under the car, fading with altitude."""
    a = strength * math.exp(-max(height, 0) / 380.0)
    if a < 0.004:
        return
    w = (220 + 0.35 * max(height, 0)) * cam.s
    h = 16 * cam.s
    cx, cy = cam.to_screen(x_world, BASE_BOT + 9)
    x0, x1 = int(cx - 2 * w), int(cx + 2 * w)
    y0, y1 = int(cy - 6 * h), int(cy + 6 * h)
    x0c, x1c, y0c, y1c = max(x0, 0), min(x1, W), max(y0, 0), min(y1, H)
    if x1c <= x0c or y1c <= y0c:
        return
    yy, xx = np.mgrid[y0c:y1c, x0c:x1c]
    g = a * np.exp(-(((xx - cx) / (0.55 * w)) ** 2 + ((yy - cy) / h) ** 2))
    region = canvas[y0c:y1c, x0c:x1c]
    np.maximum(region, g.astype(np.float32), out=region)


# --------------------------------------------------------------------------- motion

class Flight:
    def __init__(self, assets):
        car = assets["car"]
        self.car = car
        self.start = (car["centre"][0], car["centre"][1] + CAR_CROUCH)
        self.end = glyph_sprite(assets["glyph"])["centre"]
        # wheel hubs in sprite-relative coordinates (rest pose)
        self.wheels = [(157 - car["centre"][0], 556 - car["centre"][1]),
                       (412 - car["centre"][0], 556 - car["centre"][1])]
        self.car_w = car["w"]

    def state(self, t):
        """t in frames since launch (0..AIR). Returns pos, angle, sx, sy, morph."""
        u = min(max(t / AIR, 0.0), 1.0)
        x = self.start[0] + (self.end[0] - self.start[0]) * u
        y = self.start[1] + (self.end[1] - self.start[1]) * u - 4 * FLIGHT_HEIGHT * u * (1 - u)
        ease = u - math.sin(2 * math.pi * u) / (2 * math.pi)
        angle = -360.0 * FLIPS * ease                    # clockwise = forward flip
        twist = smoothstep((u - 0.36) / 0.28)
        sx = math.cos(2 * math.pi * twist)               # full 360 deg spin at the apex
        # take-off stretch, then settle
        stretch = 0.10 * math.exp(-t / 6.0)
        sy = 1 + stretch
        sx *= 1 - 0.5 * stretch
        morph = smoothstep((u - 0.80) / 0.17)
        return (x, y), angle, sx, sy, morph

    def height(self, t):
        (x, y), *_ = self.state(t)
        return self.end[1] - y


def camera_track(flight, n_air):
    """Camera that pulls back to keep both the wordmark and the car in frame."""
    margin = 70
    half_diag = 0.5 * math.hypot(flight.car["w"], flight.car["h"])
    raw = []
    pad = 40
    for i in range(-pad, n_air + pad):
        if i < 0 or i > n_air:
            raw.append((1.0, W / 2, H / 2))
            continue
        (x, y), *_ = flight.state(i)
        bx0, bx1 = min(500, x - half_diag), max(1420, x + half_diag)
        by0, by1 = min(BASE_TOP - 20, y - half_diag), max(BASE_BOT + 40, y + half_diag)
        s = min(1.0, (W - 2 * margin) / (bx1 - bx0), (H - 2 * margin) / (by1 - by0))
        cx, cy = W / 2, H / 2
        hw, hh = (W / 2 - margin) / s, (H / 2 - margin) / s
        cx = min(max(cx, bx1 - hw), bx0 + hw)
        cy = min(max(cy, by1 - hh), by0 + hh)
        raw.append((s, cx, cy))
    raw = np.array(raw)
    sigma = 9.0
    k = np.exp(-0.5 * (np.arange(-30, 31) / sigma) ** 2)
    k /= k.sum()
    out = np.empty_like(raw)
    for c in range(3):
        padded = np.pad(raw[:, c], 30, mode="edge")
        out[:, c] = np.convolve(padded, k, mode="valid")
    # never zoom in tighter than the raw fit around each frame allows,
    # so smoothing cannot push the car out of frame
    out[:, 0] = np.minimum(out[:, 0], [raw[max(0, j - 12):j + 13, 0].min() for j in range(len(raw))])
    return [Camera(*row) for row in out[pad:pad + n_air + 1]]


# --------------------------------------------------------------------------- sections

def render_launch_and_flight(assets):
    flight = Flight(assets)
    cams = camera_track(flight, AIR)
    car = assets["car"]
    glyph = glyph_sprite(assets["glyph"])
    frames = []
    trail_pts = []  # (world_x, world_y, birth_t)

    springs = assets["springs"]
    ground = 596

    def squash_springs(k, alpha):
        """Scale the spring layer vertically about the ground line."""
        if alpha <= 0.002:
            return None
        img = Image.fromarray((springs * 255).astype(np.uint8))
        top = 536
        new_top = ground - (ground - top) * k
        # y_in = ground + (y_out - ground) / k
        coeffs = (1, 0, 0, 0, 1 / k, ground - ground / k)
        out = img.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC)
        return np.asarray(out, np.float32) / 255.0 * alpha

    # Crouch on the springs.
    for i in range(CROUCH):
        c = smoothstep((i + 1) / CROUCH)
        canvas = np.zeros((H, W), np.float32)
        draw_layer(canvas, assets["text"], Camera())
        sp = squash_springs((60 - CAR_CROUCH * c) / 60, 1.0)
        np.maximum(canvas, sp, out=canvas)
        acc = np.zeros((H, W), np.float32)
        cx, cy = car["centre"]
        sy = 1 - 0.07 * c
        bottom = cy + car["h"] / 2
        pos = (cx, bottom + CAR_CROUCH * c - car["h"] / 2 * sy)
        draw_sprite(acc, car, pos, 0, 1 + 0.03 * c, sy, Camera())
        np.maximum(canvas, np.clip(acc, 0, 1), out=canvas)
        frames.append(canvas)

    # Flight.
    for i in range(AIR):
        cam = cams[i]
        canvas = np.zeros((H, W), np.float32)
        draw_layer(canvas, assets["text"], cam)

        # springs recoil then fall away
        rec = 1.0 + 0.18 * math.sin(min(i, 10) / 10 * math.pi) - 0.9 * smoothstep(i / 18)
        sp = squash_springs(max(rec, 0.08), 1 - smoothstep(i / 16))
        if sp is not None:
            draw_layer(canvas, sp, cam)

        h = flight.height(i)
        ground_glow(canvas, flight.state(i)[0][0], h - 60, cam)

        # dotted wheel trails (like the original's spring/speed dots)
        for j in range(0, SUB, SUB // 2):
            t = i + j / SUB
            (px, py), ang, sx, sy, morph = flight.state(t)
            a = math.radians(ang)
            for wx, wy in flight.wheels:
                lx, ly = wx * sx, wy * sy
                trail_pts.append((px + math.cos(a) * lx - math.sin(a) * ly,
                                  py + math.sin(a) * lx + math.cos(a) * ly, t, 1 - morph))
        trail_pts = [p for p in trail_pts if i - p[2] < 22]
        for k_, (wx, wy, born, strength) in enumerate(trail_pts):
            age = (i - born) / 22.0
            v = 0.85 * (1 - age) ** 1.5 * strength
            if v > 0.02:
                sx_, sy_ = cam.to_screen(wx, wy)
                splat(canvas, sx_, sy_, 3.0 * cam.s + 0.4, v)

        # car / A with motion blur
        acc = np.zeros((H, W), np.float32)
        for j in range(SUB):
            t = i + SHUTTER * (j / SUB - 0.5)
            pos, ang, sx, sy, morph = flight.state(max(t, 0))
            width = car["w"] * (1 - morph) + A_W * morph
            car_alpha = 1 - smoothstep((morph - 0.25) / 0.6)
            car_sx = sx * width / car["w"]
            glyph_sx = sx * width / A_W
            draw_sprite(acc, car, pos, ang, car_sx, sy, cam, car_alpha / SUB)
            draw_sprite(acc, glyph, pos, ang, glyph_sx, sy, cam, (1 - car_alpha) / SUB)
        np.maximum(canvas, np.clip(acc, 0, 1), out=canvas)
        frames.append(canvas)
    return frames


def render_landing_and_hold(assets):
    glyph = glyph_sprite(assets["glyph"])
    frames = []
    for i in range(HOLD):
        t = i + 1
        bounce = math.exp(-t / 5.0) * math.cos(t * 0.42)
        sy = 1 - 0.16 * bounce
        sx = 1 + 0.10 * bounce
        shake = 4.0 * math.exp(-t / 4.0) * math.sin(t * 1.9)
        cam = Camera(1.0, W / 2, H / 2 - shake)
        canvas = np.zeros((H, W), np.float32)
        draw_layer(canvas, assets["text"], cam)
        ground_glow(canvas, glyph["centre"][0], 0, cam, 0.16 * math.exp(-t / 10.0))
        acc = np.zeros((H, W), np.float32)
        cy = BASE_BOT + 0.5 - glyph["h"] / 2 * sy
        draw_sprite(acc, glyph, (glyph["centre"][0], cy), 0, sx, sy, cam)
        np.maximum(canvas, np.clip(acc, 0, 1), out=canvas)
        frames.append(canvas)
    return frames


def render_drive_off(assets):
    """A unfolds into the car, which accelerates to where the outro footage picks up."""
    glyph = glyph_sprite(assets["glyph"])
    dcar = assets["dcar"]
    end_cx, cy = dcar["centre"]
    end_left = end_cx - dcar["w"] / 2
    start_left = A_X0
    total = MORPH_OUT + ACCEL
    frames = []

    def state(t):
        m = smoothstep(t / MORPH_OUT)
        width = A_W * (1 - m) + dcar["w"] * m
        a = max(t - MORPH_OUT, 0) / ACCEL
        left = start_left + (end_left - start_left) * a * a
        sy = 1 - 0.08 * math.sin(math.pi * min(t / MORPH_OUT, 1))   # anticipation crouch
        return left, width, m, sy

    for i in range(total):
        canvas = np.zeros((H, W), np.float32)
        draw_layer(canvas, assets["text"], Camera())
        acc = np.zeros((H, W), np.float32)
        for j in range(SUB):
            t = i + 1 + SHUTTER * (j / SUB - 0.5)
            left, width, m, sy = state(t)
            car_alpha = smoothstep((m - 0.2) / 0.6)
            pos_x = left + width / 2
            pos_y = BASE_BOT + 0.5 - (BASE_BOT - BASE_TOP + 1) / 2 * sy
            draw_sprite(acc, glyph, (pos_x, pos_y), 0, width / A_W, sy, Camera(), (1 - car_alpha) / SUB)
            draw_sprite(acc, dcar, (pos_x, cy + (pos_y - (BASE_TOP + BASE_BOT) / 2)),
                        0, width / dcar["w"], sy, Camera(), car_alpha / SUB)
        np.maximum(canvas, np.clip(acc, 0, 1), out=canvas)
        # dotted exhaust trail grows behind the car once it moves
        left, *_ = state(i + 1)
        if left > TEXT_CUT:
            trail = assets["trail"].copy()
            trail[:, int(left) + 2:] = 0
            np.maximum(canvas, trail, out=canvas)
        frames.append(canvas)
    return frames


# --------------------------------------------------------------------------- main

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    with tempfile.TemporaryDirectory() as tmp:
        fdir = os.path.join(tmp, "src")
        odir = os.path.join(tmp, "out")
        os.makedirs(fdir)
        os.makedirs(odir)
        subprocess.run(["ffmpeg", "-v", "error", "-i", src, os.path.join(fdir, "%04d.png")], check=True)
        n_src = len(os.listdir(fdir))
        loops = max(1, round(n_src / LOOP))

        assets = build_assets(fdir)
        print("rendering flight...", flush=True)
        middle = render_launch_and_flight(assets)
        print("rendering landing...", flush=True)
        middle += render_landing_and_hold(assets)
        print("rendering drive-off...", flush=True)
        middle += render_drive_off(assets)
        middle_u8 = [Image.fromarray((np.clip(m, 0, 1) * 255 + 0.5).astype(np.uint8)) for m in middle]

        out_i = 0

        def emit(img):
            nonlocal out_i
            out_i += 1
            img.convert("RGB").save(os.path.join(odir, f"{out_i:05d}.png"), compress_level=1)

        for _ in range(loops):
            for n in range(1, INTRO_END + 1):
                emit(Image.open(os.path.join(fdir, f"{n:04d}.png")))
            for im in middle_u8:
                emit(im)
            for n in range(OUTRO_START, LOOP + 1):
                emit(Image.open(os.path.join(fdir, f"{n:04d}.png")))

        print(f"encoding {out_i} frames...", flush=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS),
                        "-i", os.path.join(odir, "%05d.png"),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst], check=True)
    print("wrote", dst)


if __name__ == "__main__":
    main()
