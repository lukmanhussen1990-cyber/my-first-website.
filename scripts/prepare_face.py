"""Cut the dog's face out of the user's image and prepare it for the 3D head.

- Crops the flat front of the head (no background, no ears).
- Applies a soft rounded mask so the edges blend into the code-built head.
- Upscales (Lanczos) + light sharpening so it stays crisp in close-ups.
- Samples the fur colours so the code-built body matches the image.

Usage: python3 -I scripts/prepare_face.py assets/dog_source/dog_face_original.png public/dog_face.png src/dogFace.json
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

src, out_png, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB")

# Flat front of the head in the 1254x1254 source (found by inspecting a gridded crop).
BOX = (394, 176, 870, 566)
face = im.crop(BOX)
W = 1024
H = round(W * face.height / face.width)
face = face.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))

# Soft rounded-rectangle alpha mask.
SS = 4
mask = Image.new("L", (W * SS, H * SS), 0)
d = ImageDraw.Draw(mask)
inset = int(0.012 * W * SS)
d.rounded_rectangle([inset, inset, W * SS - inset, H * SS - inset], radius=int(0.10 * W * SS), fill=255)
mask = mask.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(W * 0.006))
face.putalpha(mask)
face.save(out_png)

def avg(region):
    crop = im.crop(region)
    px = list(crop.get_flattened_data() if hasattr(crop, "get_flattened_data") else crop.getdata())
    r = sum(p[0] for p in px) / len(px)
    g = sum(p[1] for p in px) / len(px)
    b = sum(p[2] for p in px) / len(px)
    return "#%02x%02x%02x" % (round(r), round(g), round(b))

colors = {
    "fur": avg((600, 180, 640, 200)),        # forehead orange
    "furDark": avg((270, 180, 320, 240)),    # ear orange (a bit darker)
    "cream": avg((560, 410, 600, 440)),      # muzzle cream
    "nose": avg((680, 345, 740, 380)),
}
# Where things are on the face (0..1 from the top-left of the cropped face), for code overlays.
fx = lambda x: round((x - BOX[0]) / (BOX[2] - BOX[0]), 3)
fy = lambda y: round((y - BOX[1]) / (BOX[3] - BOX[1]), 3)
layout = {
    "eyeL": [fx(590), fy(305)],
    "eyeR": [fx(785), fy(310)],
    "browL": [fx(560), fy(230)],
    "browR": [fx(800), fy(225)],
    "nose": [fx(720), fy(355)],
    "mouth": [fx(640), fy(450)],
    "cheekL": [fx(470), fy(420)],
    "cheekR": [fx(820), fy(425)],
}
json.dump({"image": "dog_face.png", "aspect": round(W / H, 4), "colors": colors, "layout": layout}, open(out_json, "w"), indent=1)
print(json.dumps(colors), W, H, layout)
