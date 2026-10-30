"""Prepare the painted background for the renderer.

Writes into build/:
  bg_2x.png  - background upscaled 2x (Lanczos + light sharpening)
  fg_2x.png  - the same pixels, but only the foreground objects that must
               cover the passing train (near platform, bench, tree trunk,
               shelter post, bush). Everything else is transparent.

All polygon coordinates are in original background pixels (941 x 1672).
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets", "background.png")
OUT = os.path.join(HERE, "build")
UP = 2

FOREGROUND = [
    # near wooden platform, everything in front of its far edge
    [(0, 1030), (380, 1012), (470, 1030), (545, 1048), (720, 1089),
     (941, 1140), (941, 1672), (0, 1672)],
    # bench back rest + right iron frame and arm rest
    [(58, 890), (72, 884), (86, 886), (100, 896), (250, 899), (392, 901),
     (406, 903), (418, 913), (428, 950), (436, 984), (446, 995),
     (530, 998), (538, 1009), (541, 1062), (58, 1062)],
    # tree trunk on the left
    [(0, 560), (74, 560), (70, 700), (65, 800), (67, 900), (76, 1000),
     (82, 1100), (0, 1100)],
    # little wooden box/door next to the trunk
    [(61, 746), (119, 746), (119, 910), (61, 910)],
    # shelter post
    [(109, 280), (159, 280), (161, 910), (109, 910)],
    # yellow bush beside the post
    [(156, 800), (163, 782), (180, 771), (200, 776), (216, 789), (226, 810),
     (233, 840), (232, 872), (228, 910), (156, 910)],
]


def main():
    os.makedirs(OUT, exist_ok=True)
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    big = src.resize((w * UP, h * UP), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=2, percent=45, threshold=2))
    big.save(os.path.join(OUT, "bg_2x.png"))

    # mask drawn at 4x then reduced for smooth edges, then feathered slightly
    ss = 4
    mask = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(mask)
    for poly in FOREGROUND:
        d.polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    mask = mask.resize((w * UP, h * UP), Image.LANCZOS)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    fg = big.copy()
    fg.putalpha(mask)
    fg.save(os.path.join(OUT, "fg_2x.png"))
    print("wrote", os.listdir(OUT))


if __name__ == "__main__":
    main()
