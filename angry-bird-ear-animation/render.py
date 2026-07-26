"""Animate the cupped-ear bird: music notes stream into the ear, others drift back out."""
import math
import sys
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FPS = 25
T = 6.0                      # seamless loop length (s)
NFRAMES = int(FPS * T)
SS = 3                       # glyph supersampling

# ---------- base plate ----------
CROP2 = (8, 7, 586, 396)     # trim the screenshot's dark frame
plate = Image.open('clean.png').convert('RGB').crop(CROP2)
W, H = plate.size[0] * 2, plate.size[1] * 2          # 1156 x 778
W -= W % 2
H -= H % 2
MARG = 1.06                                          # headroom for the slow zoom
BIG = plate.resize((int(W * MARG), int(H * MARG)), Image.LANCZOS)
BW, BH = BIG.size

EAR = (392.0, 272.0)         # ear opening, output coords

CREAM = (247, 233, 191)
GLOWC = (255, 205, 120)


# ---------- note glyphs ----------
def glyph(kind):
    c = Image.new('L', (100 * SS, 100 * SS), 0)
    d = ImageDraw.Draw(c)
    s = SS

    def bx(x0, y0, x1, y1):
        return [x0 * s, y0 * s, x1 * s, y1 * s]

    if kind == 'eighth':
        d.ellipse(bx(8, 58, 52, 93), fill=255)
        d.rounded_rectangle(bx(45, 14, 53, 78), radius=3 * s, fill=255)
        d.polygon([(53 * s, 16 * s), (78 * s, 38 * s), (82 * s, 64 * s),
                   (72 * s, 46 * s), (53 * s, 40 * s)], fill=255)
    elif kind == 'quarter':
        d.ellipse(bx(8, 58, 52, 93), fill=255)
        d.rounded_rectangle(bx(45, 12, 53, 78), radius=3 * s, fill=255)
    else:  # beamed pair
        d.ellipse(bx(2, 62, 42, 95), fill=255)
        d.ellipse(bx(54, 62, 94, 95), fill=255)
        d.rounded_rectangle(bx(35, 16, 42, 80), radius=3 * s, fill=255)
        d.rounded_rectangle(bx(87, 12, 94, 80), radius=3 * s, fill=255)
        d.polygon([(35 * s, 18 * s), (94 * s, 10 * s), (94 * s, 28 * s),
                   (35 * s, 36 * s)], fill=255)
    return c.resize((100 * 4, 100 * 4), Image.LANCZOS)


GLYPHS = {k: glyph(k) for k in ('eighth', 'quarter', 'beamed')}


def stamp(layer, kind, cx, cy, size, rot, alpha):
    """Paste one note (cream, given alpha) centred on cx, cy."""
    if alpha <= 0.004 or size < 4:
        return
    g = GLYPHS[kind].resize((int(size), int(size)), Image.LANCZOS)
    g = g.rotate(rot, resample=Image.BICUBIC, expand=True)
    a = g.point(lambda v: int(v * alpha))
    tile = Image.new('RGBA', g.size, CREAM + (0,))
    tile.putalpha(a)
    layer.alpha_composite(tile, (int(cx - g.size[0] / 2), int(cy - g.size[1] / 2)))


def bez(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ctrl(p0, p1, bow):
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy) or 1
    return (mx - dy / n * bow, my + dx / n * bow)


# ---------- note population ----------
# notes travelling INTO the ear
IN_SPEC = [
    ((-90, 250), 120, 'eighth', 0.00, 96),
    ((-110, 430), -100, 'beamed', 0.28, 108),
    ((-80, 620), -150, 'eighth', 0.55, 90),
    ((40, 780), -120, 'quarter', 0.80, 84),
    ((-130, 90), 110, 'beamed', 0.14, 100),
    ((-100, 540), -70, 'eighth', 0.42, 86),
    ((-60, -110), 90, 'eighth', 0.68, 92),
    ((-140, 340), 45, 'quarter', 0.92, 94),
]
# notes drifting back OUT of the ear
OUT_SPEC = [
    ((-110, 120), -110, 'eighth', 0.10, 96),
    ((-90, 560), 120, 'beamed', 0.45, 104),
    ((90, -120), -70, 'eighth', 0.72, 88),
    ((-140, 330), 70, 'quarter', 0.30, 90),
    ((10, 830), 100, 'eighth', 0.88, 92),
]
IN_DUR = 3.0
OUT_DUR = 2.0

SPARKS = [(276, 618), (166, 700), (95, 330), (963, 588)]


def frame(i):
    t = i / FPS
    ph = t / T

    # slow breathing zoom / drift
    z = 1.0 + 0.012 * math.sin(2 * math.pi * ph)
    vw, vh = W / (MARG * z) * MARG / MARG, H  # placeholder, computed below
    cw, ch = W / z, H / z
    ox = (BW - cw) / 2 + 6 * math.sin(2 * math.pi * ph)
    oy = (BH - ch) / 2 + 4 * math.cos(2 * math.pi * ph)
    base = BIG.crop((int(ox), int(oy), int(ox + cw), int(oy + ch))).resize((W, H), Image.BILINEAR)

    notes = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    for start, bow, kind, off, sz in IN_SPEC:
        p = ((t / IN_DUR) + off) % 1.0
        e = smooth(p)
        c = ctrl(start, EAR, bow)
        x, y = bez(start, c, EAR, e)
        wob = 10 * math.sin(2 * math.pi * (t / 1.5) + off * 7)
        y += wob * (1 - e)
        scale = sz * (1.0 - 0.72 * e ** 1.6)
        a = smooth(p / 0.10) * (1 - smooth((p - 0.72) / 0.28))
        rot = 14 * math.sin(2 * math.pi * (t / 2.4) + off * 6) - 8
        stamp(notes, kind, x, y, scale, rot, a * 0.95)

    for end, bow, kind, off, sz in OUT_SPEC:
        p = ((t / OUT_DUR) + off) % 1.0
        e = smooth(p)
        c = ctrl(EAR, end, bow)
        x, y = bez(EAR, c, end, e)
        y += 12 * math.sin(2 * math.pi * (t / 1.8) + off * 5) * e
        scale = sz * (0.28 + 0.72 * e ** 0.8)
        a = smooth(p / 0.18) * (1 - smooth((p - 0.6) / 0.4))
        rot = 16 * math.sin(2 * math.pi * (t / 2.0) + off * 4) + 6
        stamp(notes, kind, x, y, scale, rot, a * 0.9)

    # ---- glow pass ----
    na = np.asarray(notes).astype(np.float32)
    alpha = na[..., 3:4] / 255.0
    glow_src = np.concatenate([np.ones_like(alpha) * GLOWC[0],
                               np.ones_like(alpha) * GLOWC[1],
                               np.ones_like(alpha) * GLOWC[2]], 2) * alpha
    g_img = Image.fromarray(np.clip(glow_src, 0, 255).astype(np.uint8))
    glow = np.asarray(g_img.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) * 1.15

    # ear halo, pulsing with the flow
    halo = Image.new('L', (W, H), 0)
    hd = ImageDraw.Draw(halo)
    r = 78 + 10 * math.sin(2 * math.pi * (t / 1.5))
    hd.ellipse([EAR[0] - r, EAR[1] - r * 1.25, EAR[0] + r, EAR[1] + r * 1.25], fill=110)
    halo = np.asarray(halo.filter(ImageFilter.GaussianBlur(45))).astype(np.float32)[..., None] / 255.0
    glow += halo * np.array(GLOWC, np.float32) * 0.5

    # sparkles
    sp = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(sp)
    for k, (sx, sy) in enumerate(SPARKS):
        tw = 0.5 + 0.5 * math.sin(2 * math.pi * (t / T) * (2 + k % 3) + k * 1.7)
        L = 8 + 18 * tw
        v = int(150 * tw)
        sd.polygon([(sx, sy - L), (sx + L * 0.22, sy), (sx, sy + L), (sx - L * 0.22, sy)], fill=v)
        sd.polygon([(sx - L, sy), (sx, sy - L * 0.22), (sx + L, sy), (sx, sy + L * 0.22)], fill=v)
    spa = np.asarray(sp.filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)[..., None] / 255.0
    glow += spa * np.array((255, 240, 200), np.float32) * 0.9

    b = np.asarray(base).astype(np.float32)
    out = 255.0 - (255.0 - b) * (255.0 - np.clip(glow, 0, 255)) / 255.0

    # sharp note bodies on top
    rgb = na[..., :3]
    out = out * (1 - alpha) + rgb * alpha
    return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        for i in (0, 18, 40, 75, 110):
            Image.fromarray(frame(i)).save(f'test_{i:03d}.png')
        print('test frames done', W, H)
    else:
        p = subprocess.Popen(
            ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
             '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow',
             '-crf', '18', '-pix_fmt', 'yuv420p', 'loop.mp4'], stdin=subprocess.PIPE)
        for i in range(NFRAMES):
            p.stdin.write(frame(i).tobytes())
            if i % 25 == 0:
                print('frame', i, flush=True)
        p.stdin.close()
        p.wait()
        print('loop.mp4 written')
