"""2 composited frames per scene + reference frames -> one review sheet."""
import sys, os, glob
sys.path.insert(0, '/home/user/work/scripts')
from PIL import Image, ImageDraw, ImageFont
import fx

frames_dir, out = sys.argv[1], sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 1
SC = [0, 2.32, 5.88, 8.45, 11.41, 14.61, 19.52, 22.60, 25.59, 27.43, 32.50, 36.49, 38.97]
W, H = 540, 960
ANC = fx.load_anchors(frames_dir)
F = fx.FX(W, H)
tw, th = 180, 320
font = ImageFont.truetype(fx.FONT_B, 18)
thumbs = []
for i in range(12):
    a, b = SC[i], SC[i + 1]
    for u in (0.3, 0.78):
        f = int(round((a + (b - a) * u) * 30))
        im = fx.compose(frames_dir, f, W, H, ANC, F, step).resize((tw, th), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.text((5, 3), f'S{i + 1} {f / 30:.1f}s', font=font, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        thumbs.append(im)
refs = sorted(glob.glob('/home/user/work/ref/f_*.jpg'))
pick = [refs[k] for k in (2, 9, 20, 27, 31, 42, 50, 56, 64, 70, 76, 81) if k < len(refs)]
rthumbs = []
for p in pick:
    im = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
    ImageDraw.Draw(im).text((5, 3), 'REF', font=font, fill=(0, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    rthumbs.append(im)
cols = 12
rows = 2 + 1
S = Image.new('RGB', (cols * tw, rows * th + 40), (20, 20, 20))
d = ImageDraw.Draw(S)
for k, im in enumerate(thumbs):
    S.paste(im, ((k % cols) * tw, (k // cols) * th))
for k, im in enumerate(rthumbs):
    S.paste(im, (k * tw, 2 * th + 40))
d.text((8, 2 * th + 8), 'Reference reel (ref1.mp4) frames for comparison', font=font, fill=(0, 255, 255))
S.save(out, quality=90)
print(out, S.size)
