"""Cut the user's avatar out of its dark background (rembg / U2-Net) for use as "me".

- me_reference.png (high-res, upper body)  -> public/me/me_closeup.png
- me_fullbody.gif (12-frame 360° turnaround) -> public/me/turn_00..11.png (upscaled 3x)

Usage: python3 -I scripts/prepare_me.py assets/me_source public/me
"""
import os
import sys

from PIL import Image, ImageFilter
from rembg import new_session, remove

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
session = new_session("u2net")


def cut(img):
    res = remove(img, session=session, post_process_mask=True)
    # Trim to content with a small margin.
    bbox = res.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
    return res, bbox


close = Image.open(os.path.join(src, "me_reference.png")).convert("RGB")
res, bbox = cut(close)
res.save(os.path.join(out, "me_closeup.png"))
print("closeup", res.size, bbox, flush=True)

gif = Image.open(os.path.join(src, "me_fullbody.gif"))
boxes = []
frames = []
for i in range(gif.n_frames):
    gif.seek(i)
    f = gif.convert("RGB")
    f = f.resize((f.width * 3, f.height * 3), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 50, 2))
    r, b = cut(f)
    frames.append(r)
    boxes.append(b)
    print("frame", i, b, flush=True)
# Same crop for every frame so the feet stay on the ground line.
x0 = min(b[0] for b in boxes) - 6
y0 = min(b[1] for b in boxes) - 6
x1 = max(b[2] for b in boxes) + 6
y1 = max(b[3] for b in boxes) + 2
for i, r in enumerate(frames):
    r.crop((x0, y0, x1, y1)).save(os.path.join(out, f"turn_{i:02d}.png"))
print("turn crop", (x0, y0, x1, y1), (x1 - x0, y1 - y0))
