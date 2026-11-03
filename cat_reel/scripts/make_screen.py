"""Generate the laptop screen movie (992x640, 30 fps, 750 frames) with PIL + ffmpeg.

A cosy document editor; the owner types for most of the reel, and from the moment the
cat lands on the keyboard (F_LAND) the page fills with 'ffffffff...'.
    python3 make_screen.py <out.mp4>
"""
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
W, H = 992, 640
FPS, FRAMES = 30, 750
F_LAND = 612
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SANS_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f_text = ImageFont.truetype(SANS, 25)
f_title = ImageFont.truetype(SANS_B, 22)
f_ui = ImageFont.truetype(SANS, 17)
f_mono = ImageFont.truetype(MONO, 40)

DOC = ("Weekly Plan\n"
       "Monday: finish the garden report and send it before lunch. "
       "Water the tomatoes, check the new seedlings and order more soil. "
       "Tuesday: call the nursery about the rose bushes. "
       "Wednesday: write the blog post about spring flowers and "
       "take photos of the lavender while the light is soft.")


def wrap(draw, text, font, width):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            t = (cur + ' ' + word).strip()
            if draw.textlength(t, font=font) > width and cur:
                lines.append(cur)
                cur = word
            else:
                cur = t
        lines.append(cur)
    return lines


def frame(f):
    im = Image.new('RGB', (W, H), (236, 239, 244))
    d = ImageDraw.Draw(im)
    # window chrome
    d.rectangle((0, 0, W, 46), fill=(52, 58, 70))
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse((18 + i * 28, 15, 34 + i * 28, 31), fill=c)
    d.text((W // 2, 23), 'Weekly Plan.doc', font=f_ui, fill=(225, 230, 238), anchor='mm')
    d.rectangle((0, 46, W, 92), fill=(246, 247, 250))
    for i, lab in enumerate(['File', 'Edit', 'View', 'Insert', 'Format']):
        d.text((24 + i * 92, 69), lab, font=f_ui, fill=(70, 78, 92), anchor='lm')
    # page
    d.rectangle((70, 108, W - 70, H + 20), fill=(255, 255, 255), outline=(214, 219, 228))
    x0, y0, width = 110, 140, W - 220
    if f < F_LAND:
        n = min(len(DOC), 150 + int(f * 1.15))          # typing progress
        lines = wrap(d, DOC[:n], f_text, width)
        y = y0
        for i, ln in enumerate(lines):
            font = f_title if i == 0 else f_text
            d.text((x0, y), ln, font=font, fill=(34, 40, 52))
            y += 40 if i == 0 else 36
        if (f // 15) % 2 == 0:                        # blinking caret
            lx = x0 + d.textlength(lines[-1], font=f_text if len(lines) > 1 else f_title)
            d.rectangle((lx + 3, y - 34, lx + 5, y - 6), fill=(40, 90, 220))
    else:
        k = f - F_LAND
        n_chars = int(30 * k + 0.9 * k * k)            # accelerating cat-typing
        lines = wrap(d, DOC[:min(len(DOC), 150 + int(F_LAND * 1.15))], f_text, width)
        y = y0
        for i, ln in enumerate(lines[:2]):
            d.text((x0, y), ln, font=f_title if i == 0 else f_text, fill=(34, 40, 52))
            y += 40 if i == 0 else 36
        per = int(width / d.textlength('f', font=f_mono))
        s = ''
        for i in range(n_chars):
            s += 'f' if (i // 41) % 7 != 4 else 'j'
        rows = [s[i:i + per] for i in range(0, len(s), per)]
        for r in rows[-9:]:
            d.text((x0, y), r, font=f_mono, fill=(20, 24, 32))
            y += 50
    return im


p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                      '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16',
                      '-g', '1', OUT], stdin=subprocess.PIPE)
for f in range(1, FRAMES + 1):
    p.stdin.write(frame(f).tobytes())
p.stdin.close()
p.wait()
print('screen movie written', OUT)
