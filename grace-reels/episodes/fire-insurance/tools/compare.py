"""Side-by-side: reference frame (upscaled to 1080x1920) | our frame."""
import sys
from PIL import Image, ImageDraw, ImageFont
ref, ours, out = sys.argv[1], sys.argv[2], sys.argv[3]
a = Image.open(ref).convert('RGB').resize((1080, 1920), Image.LANCZOS)
b = Image.open(ours).convert('RGB').resize((1080, 1920), Image.LANCZOS)
c = Image.new('RGB', (2160 + 24, 1920 + 70), (30, 28, 34))
c.paste(a, (0, 70)); c.paste(b, (1080 + 24, 70))
d = ImageDraw.Draw(c)
try:
    f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 38)
except Exception:
    f = None
d.text((24, 14), 'REFERENCE (flat_style.mp4)', fill=(240, 236, 228), font=f)
d.text((1080 + 48, 14), 'OURS (100% code)', fill=(240, 236, 228), font=f)
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
c = c.resize((int(c.width * scale), int(c.height * scale)), Image.LANCZOS)
c.save(out)
