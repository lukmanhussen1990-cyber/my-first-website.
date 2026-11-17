"""Generate procedural image textures (leaves, hedge, grass, bullseye, baseball)."""
import os, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "/opt/work/tex"
os.makedirs(OUT, exist_ok=True)
rng = random.Random(7)


def leaf_shape(draw, cx, cy, length, width, angle, fill, vein=None):
    pts = []
    n = 24
    for i in range(n + 1):
        t = i / n
        y = -length / 2 + t * length
        w = width / 2 * math.sin(math.pi * t) ** 0.8 * (1 - 0.25 * t)
        pts.append((w, y))
    for i in range(n, -1, -1):
        t = i / n
        y = -length / 2 + t * length
        w = width / 2 * math.sin(math.pi * t) ** 0.8 * (1 - 0.25 * t)
        pts.append((-w, y))
    ca, sa = math.cos(angle), math.sin(angle)
    poly = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]
    draw.polygon(poly, fill=fill)
    if vein:
        p0 = (cx + (length / 2) * sa, cy - (length / 2) * ca)
        p1 = (cx - (length / 2) * sa, cy + (length / 2) * ca)
        draw.line([p0, p1], fill=vein, width=max(1, int(width / 14)))


# ---------------------------------------------------------------- leaf atlas
S = 1024
atlas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(atlas)
cols = [(52, 92, 30), (70, 112, 38), (88, 126, 46), (60, 100, 40)]
for k in range(4):
    ox, oy = (k % 2) * S // 2, (k // 2) * S // 2
    # a small twig with 5 leaves per cell
    for j in range(5):
        a = rng.uniform(-0.9, 0.9) + (j - 2) * 0.35
        L = rng.uniform(150, 210)
        cx = ox + S // 4 + math.sin(a) * L * 0.35
        cy = oy + S // 4 + 40 - math.cos(a) * L * 0.35
        c = cols[(k + j) % 4]
        shade = rng.uniform(0.8, 1.15)
        fill = tuple(min(255, int(v * shade)) for v in c) + (255,)
        leaf_shape(d, cx, cy, L, L * 0.42, a, fill, vein=tuple(min(255, int(v * 1.3)) for v in c) + (255,))
atlas = atlas.filter(ImageFilter.SMOOTH)
atlas.save(os.path.join(OUT, "leaf_atlas.png"))

# ---------------------------------------------------------- tileable hedge
T = 1024
base = Image.new("RGB", (T * 3, T * 3), (18, 34, 12))
d = ImageDraw.Draw(base)
hcol = [(46, 84, 26), (66, 110, 36), (90, 132, 50), (110, 150, 60), (38, 70, 22), (128, 160, 72)]
for i in range(9000):
    cx, cy = rng.uniform(T, 2 * T), rng.uniform(T, 2 * T)
    L = rng.uniform(40, 80)
    a = rng.uniform(0, math.pi * 2)
    c = rng.choice(hcol)
    depth = rng.uniform(0.55, 1.15)
    fill = tuple(min(255, int(v * depth)) for v in c)
    for dx in (-T, 0, T):
        for dy in (-T, 0, T):
            leaf_shape(d, cx + dx, cy + dy, L, L * 0.5, a, fill,
                       vein=tuple(min(255, int(v * depth * 1.25)) for v in c))
hedge = base.crop((T, T, 2 * T, 2 * T)).filter(ImageFilter.SMOOTH)
hedge.save(os.path.join(OUT, "hedge.png"))
lum = np.asarray(hedge.convert("L"), dtype=np.float32)
bump = Image.fromarray(np.clip((lum - lum.min()) / (np.ptp(lum) + 1e-6) * 255, 0, 255).astype(np.uint8))
bump.filter(ImageFilter.GaussianBlur(1.2)).save(os.path.join(OUT, "hedge_bump.png"))

# ------------------------------------------------------------------- grass
G = 1024
g = Image.new("RGB", (G * 3, G * 3), (52, 92, 28))
d = ImageDraw.Draw(g)
gcol = [(70, 120, 35), (95, 145, 45), (60, 105, 30), (120, 160, 60), (45, 85, 25)]
for i in range(26000):
    x, y = rng.uniform(G, 2 * G), rng.uniform(G, 2 * G)
    L = rng.uniform(18, 46)
    a = rng.uniform(-0.6, 0.6) - math.pi / 2
    c = rng.choice(gcol)
    for dx in (-G, 0, G):
        for dy in (-G, 0, G):
            d.line([(x + dx, y + dy), (x + dx + math.cos(a) * L, y + dy + math.sin(a) * L)], fill=c, width=3)
g.crop((G, G, 2 * G, 2 * G)).save(os.path.join(OUT, "grass.png"))

# ---------------------------------------------------------------- bullseye
B = 1024
im = Image.new("RGB", (B, B), (255, 255, 255))
d = ImageDraw.Draw(im)
rings = 5
for i in range(rings * 2):
    r = B / 2 * (1 - i / (rings * 2))
    col = (210, 20, 25) if i % 2 == 0 else (250, 250, 250)
    d.ellipse([B / 2 - r, B / 2 - r, B / 2 + r, B / 2 + r], fill=col)
im.save(os.path.join(OUT, "bullseye.png"))

# ---------------------------------------------------------------- baseball
W, H = 1024, 512
im = Image.new("RGB", (W, H), (238, 234, 222))
d = ImageDraw.Draw(im)
pts = []
for i in range(400):
    t = i / 400 * 2 * math.pi
    lon = t
    lat = 0.45 * math.sin(2 * t)
    pts.append(((lon / (2 * math.pi)) * W, (0.5 - lat / math.pi) * H))
for i in range(len(pts) - 1):
    d.line([pts[i], pts[i + 1]], fill=(170, 30, 30), width=5)
for i in range(0, len(pts) - 1, 6):
    x, y = pts[i]
    x2, y2 = pts[i + 1]
    ang = math.atan2(y2 - y, x2 - x) + math.pi / 2
    for s in (-1, 1):
        d.line([(x, y), (x + s * 9 * math.cos(ang + 0.5), y + s * 9 * math.sin(ang + 0.5))],
               fill=(190, 30, 30), width=3)
im.save(os.path.join(OUT, "baseball.png"))

# ------------------------------------------------------------ wet splat decal
P = 512
im = Image.new("L", (P, P), 0)
d = ImageDraw.Draw(im)
d.ellipse([P * 0.25, P * 0.25, P * 0.75, P * 0.75], fill=255)
for i in range(40):
    a = rng.uniform(0, 2 * math.pi)
    r0 = rng.uniform(0.18, 0.3) * P
    r1 = rng.uniform(0.3, 0.48) * P
    w = rng.uniform(6, 22)
    d.line([(P / 2 + math.cos(a) * r0, P / 2 + math.sin(a) * r0),
            (P / 2 + math.cos(a) * r1, P / 2 + math.sin(a) * r1)], fill=255, width=int(w))
    rr = w * 0.8
    cx, cy = P / 2 + math.cos(a) * r1, P / 2 + math.sin(a) * r1
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
im = im.filter(ImageFilter.GaussianBlur(3))
im.save(os.path.join(OUT, "splat.png"))
print("TEXTURES_OK", OUT)
