"""Episode 14 in-world graphics (Pillow). Usage: python3 make_decals.py <out_dir>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
LEAD = (25, 22, 20)
GLASS = [(200, 30, 40), (30, 70, 190), (240, 190, 40), (40, 150, 70), (130, 40, 160), (230, 110, 30), (60, 170, 200)]


def arch_mask(w, h):
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rectangle((0, w // 2, w - 1, h - 1), fill=255)
    d.pieslice((0, 0, w - 1, w - 1), 180, 360, fill=255)
    return m


def stained(name, w=520, h=1040, seed=1, broken=False):
    rnd = random.Random(seed)
    im = Image.new("RGB", (w, h), LEAD)
    d = ImageDraw.Draw(im)
    cell = 64
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            pts = [(x + rnd.randint(-10, 10), y + rnd.randint(-10, 10)), (x + cell + rnd.randint(-10, 10), y + rnd.randint(-10, 10)),
                   (x + cell + rnd.randint(-10, 10), y + cell + rnd.randint(-10, 10)), (x + rnd.randint(-10, 10), y + cell + rnd.randint(-10, 10))]
            d.polygon(pts, fill=rnd.choice(GLASS), outline=LEAD)
    for k in range(7):                                                      # lead lines
        d.line((0, k * h // 7, w, k * h // 7), fill=LEAD, width=6)
    d.line((w // 2, 0, w // 2, h), fill=LEAD, width=8)
    if broken:                                                              # smashed: sky through a jagged hole
        cx, cy = w // 2, int(h * 0.55)
        hole = [(cx + int(math.cos(a) * r), cy + int(math.sin(a) * r * 1.5))
                for a, r in ((i * 2 * math.pi / 14, rnd.randint(130, 230)) for i in range(14))]
        d.polygon(hole, fill=(150, 200, 245))
    mask = arch_mask(w, h)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    out.save(f"{OUT}/{name}.png")


stained("stained1", seed=1)
stained("stained2", seed=2)
stained("stained3", seed=3)
stained("stained_broken", seed=2, broken=True)

# Rose window above the altar
S = 900
im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.ellipse((0, 0, S - 1, S - 1), fill=LEAD)
c = S // 2
for ring, (r0, r1) in enumerate(((60, 160), (160, 300), (300, 440))):
    n = 8 * (ring + 1)
    for i in range(n):
        a0, a1 = i * 360 / n, (i + 1) * 360 / n
        col = GLASS[(i + ring * 3) % len(GLASS)]
        d.pieslice((c - r1, c - r1, c + r1, c + r1), a0 + 1, a1 - 1, fill=col)
    d.ellipse((c - r0, c - r0, c + r0, c + r0), fill=LEAD)
d.ellipse((c - 55, c - 55, c + 55, c + 55), fill=(250, 220, 90))
im.save(f"{OUT}/rose.png")
print("ep14 decals ->", OUT)
