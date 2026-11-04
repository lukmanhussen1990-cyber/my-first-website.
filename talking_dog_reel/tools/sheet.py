import sys, glob
from PIL import Image, ImageDraw
files = sys.argv[2:]
ims = [Image.open(f) for f in files]
w, h = 270, 480
cols = min(7, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), 'black')
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h)), (x, y))
    d.text((x + 4, y + 4), f.split('_')[-1].replace('.jpg', ''), fill='yellow')
sheet.save(sys.argv[1])
