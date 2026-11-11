import sys, glob, os
from PIL import Image, ImageDraw
src, out, cols, rows, w = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
files = sorted(glob.glob(os.path.join(src, '*.jpg')) + glob.glob(os.path.join(src, '*.png')))
per = cols*rows
for si in range(0, len(files), per):
    chunk = files[si:si+per]
    im0 = Image.open(chunk[0]); h = int(im0.height * w / im0.width)
    sheet = Image.new('RGB', (cols*w, rows*h), (20,20,20))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        im = Image.open(f).convert('RGB').resize((w, h))
        x, y = (i % cols)*w, (i//cols)*h
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x+70, y+14], fill=(0,0,0))
        d.text((x+3, y+1), os.path.basename(f).rsplit('.',1)[0][-8:], fill=(255,255,0))
    sheet.save(f"{out}_{si//per:02d}.jpg", quality=85)
    print(f"{out}_{si//per:02d}.jpg")
