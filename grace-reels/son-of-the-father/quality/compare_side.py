# usage: python3 quality/compare_side.py ref.png ours.jpg out.png "left label" "right label"
import sys
from PIL import Image, ImageDraw, ImageFont
ref, ours, out = sys.argv[1:4]
la = sys.argv[4] if len(sys.argv) > 4 else 'reference'
lb = sys.argv[5] if len(sys.argv) > 5 else 'ours'
W, H = 720, 1280
A = Image.open(ref).convert('RGB').resize((W, H), Image.LANCZOS)
B = Image.open(ours).convert('RGB').resize((W, H), Image.LANCZOS)
img = Image.new('RGB', (W * 2 + 20, H + 50), (18, 14, 12))
img.paste(A, (0, 50)); img.paste(B, (W + 20, 50))
d = ImageDraw.Draw(img)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: f = ImageFont.load_default()
d.text((12, 10), la, fill=(235, 220, 190), font=f); d.text((W + 32, 10), lb, fill=(235, 220, 190), font=f)
img.save(out)
print(out, img.size)
