# Review helper: one tile per shot (chosen preview still), labelled, in a grid.
# Usage: python3 overview.py <preview_dir> <out.png> <which: first|mid|last> [shots...]
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
PD, OUT, WHICH = sys.argv[1], sys.argv[2], sys.argv[3]
shots = sys.argv[4:] or sorted({os.path.basename(f).split("_p")[0] for f in glob.glob(f"{PD}/sh*_p*.png")})
F = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 20)
TW, TH, COLS = 216, 384, 6
tiles = []
for sh in shots:
    fs = sorted(glob.glob(f"{PD}/{sh}_p*.png"))
    if not fs:
        continue
    f = {"first": fs[0], "mid": fs[len(fs) // 2], "last": fs[-1]}[WHICH]
    im = Image.open(f).convert("RGB").resize((TW, TH))
    ImageDraw.Draw(im).text((6, 4), os.path.basename(f)[:-4], fill=(255, 255, 0), font=F, stroke_width=2, stroke_fill=(0, 0, 0))
    tiles.append(im)
rows = (len(tiles) + COLS - 1) // COLS
s = Image.new("RGB", (TW * COLS, TH * rows), (20, 20, 20))
for i, t in enumerate(tiles):
    s.paste(t, ((i % COLS) * TW, (i // COLS) * TH))
s.save(OUT)
print(OUT, s.size, len(tiles), "tiles")
