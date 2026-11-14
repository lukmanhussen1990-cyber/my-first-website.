import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(os.path.join(d, '*.png')))
w, h = 270, 480
rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cols * w, rows * (h + 22)), 'white'); dr = ImageDraw.Draw(sh)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sh.paste(im, (x, y + 22)); dr.text((x + 4, y + 4), os.path.basename(f) + f"  {int(os.path.basename(f)[1:5])/30:.2f}s", fill='black')
sh.save(out, quality=88)
