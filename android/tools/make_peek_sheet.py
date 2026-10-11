# Packs the cut-out frames into one sprite sheet: assets/peek.webp (8 frames a row).
# usage: atlas.py <hood dir> <out.webp> <first> <count> <cell width> <quality>
import sys, glob
import numpy as np
from PIL import Image
D, OUT = sys.argv[1], sys.argv[2]
first, count, CW, Q = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
TOP = 8                                     # crop: from just above the rebuilt hood top ...
files = sorted(glob.glob(D + "/rgba/*.png"))[first:first + count]
im0 = Image.open(files[0]); W, H = im0.size  # ... to the bottom of the video
sc = CW / W; CH = round((H - TOP) * sc); COLS = 8; ROWS = -(-len(files) // COLS)
# soft edges where the video cut the shoulders (left, right, bottom): if a wing ever leaves one open, it fades instead of a hard line
ramp = lambda n, L: np.clip(np.arange(n) / L, 0, 1)
fx = np.minimum(ramp(CW, 14), ramp(CW, 14)[::-1])[None, :]
fy = ramp(CH, 20)[::-1][:, None]
fade = np.minimum(fx, fy)
sheet = Image.new("RGBA", (COLS * CW, ROWS * CH), (0, 0, 0, 0))
for i, f in enumerate(files):
    im = Image.open(f).crop((0, TOP, W, H)).resize((CW, CH), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a[..., 3] *= fade
    # colour under fully see-through pixels: black (WebP keeps it smaller; no bright fringes when scaled)
    a[..., :3] *= (a[..., 3:] > 0)
    sheet.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"), ((i % COLS) * CW, (i // COLS) * CH))
sheet.save(OUT, "WEBP", quality=Q, method=6, alpha_quality=90)
import os
print(f"{len(files)} frames, cell {CW}x{CH}, sheet {sheet.size[0]}x{sheet.size[1]}, {os.path.getsize(OUT)} bytes; eyes at {(170 + 545 - TOP) / (H - TOP):.4f}, face centre x {710 / W:.4f}, hood top {(170 - 150 - TOP) / (H - TOP):.4f}")
