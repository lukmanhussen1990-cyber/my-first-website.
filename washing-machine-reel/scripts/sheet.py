import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; cols = int(sys.argv[2]); out = sys.argv[3]
start = int(sys.argv[4]) if len(sys.argv) > 4 else 0
count = int(sys.argv[5]) if len(sys.argv) > 5 else 9999
fs = sorted(glob.glob(os.path.join(d, "*.png")))[start:start + count]
ims = [Image.open(f).convert("RGB") for f in fs]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
s = Image.new("RGB", (cols * w, rows * h), "black")
dr = ImageDraw.Draw(s)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    s.paste(im, (x, y))
    dr.rectangle([x, y, x + 70, y + 14], fill="black")
    dr.text((x + 2, y + 1), os.path.basename(f)[:-4], fill="yellow")
s.save(out, quality=88)
print(out, s.size)
