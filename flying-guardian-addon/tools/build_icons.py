"""Draws the Flying Guardian spawn egg (16x16 pixel art) and an enlarged preview.

    python3 tools/build_icons.py
"""

import os

from PIL import Image

ADDON = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RP = os.path.join(ADDON, "FlyingGuardian_RP")
PREVIEW_DIR = os.path.join(ADDON, "previews")

# A dark egg with curved horns, bat-wing hints, glowing eyes and fangs.
EGG = [
    "................",
    ".r............r.",
    ".hk..........kh.",
    "..hkO.OOOO.Okh..",
    "w..OOBBBBBBOO..w",
    "ww.OBHHBBBBBO.ww",
    ".wwOBHBBBBBBOww.",
    "..wOBEeBBeEBOw..",
    "..OBBBBBBBBBBO..",
    "..OBBMTMMTMBBO..",
    "..ObBBTBBTBBbO..",
    "...ObBBBSBBbO...",
    "...ObbBSBBbbO...",
    "....ObbbbbbO....",
    ".....OOOOOO.....",
    "................",
]

PALETTE = {
    ".": (0, 0, 0, 0),
    "O": (14, 9, 14, 255),
    "B": (44, 37, 46, 255),
    "b": (28, 23, 30, 255),
    "H": (78, 69, 80, 255),
    "h": (112, 98, 92, 255),
    "k": (62, 52, 52, 255),
    "r": (170, 34, 22, 255),
    "E": (255, 214, 92, 255),
    "e": (255, 70, 18, 255),
    "M": (120, 16, 10, 255),
    "T": (238, 228, 206, 255),
    "S": (190, 52, 20, 255),
    "w": (92, 26, 30, 255),
}


def main():
    assert len(EGG) == 16 and all(len(row) == 16 for row in EGG), "egg must be 16x16"
    img = Image.new("RGBA", (16, 16))
    for y, row in enumerate(EGG):
        for x, ch in enumerate(row):
            img.putpixel((x, y), PALETTE[ch])
    out = os.path.join(RP, "textures", "items", "flying_guardian_spawn_egg.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    big = Image.new("RGBA", (16 * 16, 16 * 16), (139, 139, 139, 255))
    big.alpha_composite(img.resize((256, 256), Image.NEAREST))
    big.save(os.path.join(PREVIEW_DIR, "spawn_egg_x16.png"))
    print("spawn egg written")


if __name__ == "__main__":
    main()
