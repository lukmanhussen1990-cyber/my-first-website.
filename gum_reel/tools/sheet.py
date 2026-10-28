"""contact sheet: sheet.py out.jpg cols thumbw frames_dir frame1 frame2 ... (labels from events.json)"""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
out, cols, tw, d = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
frames = [int(x) for x in sys.argv[5:]]
ev = json.load(open('/home/user/work/events.json'))
def shot_of(f):
    t = f / 30
    for s in ev['shots']:
        if s['t0'] <= t < s['t1']:
            return s['name']
    return '?'
ims = []
for f in frames:
    p = f'{d}/f_{f:05d}.png'
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGB')
    im = im.resize((tw, int(im.height * tw / im.width)))
    dr = ImageDraw.Draw(im)
    font = ImageFont.truetype('/home/user/work/assets/fonts/Poppins-Bold.ttf', max(12, tw // 14))
    dr.text((4, 2), f'{shot_of(f)} f{f}', fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    ims.append(im)
th = ims[0].height
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * th), 'black')
for i, im in enumerate(ims):
    S.paste(im, ((i % cols) * tw, (i // cols) * th))
S.save(out, quality=88)
print(out, S.size)
