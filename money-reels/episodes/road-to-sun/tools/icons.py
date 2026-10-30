"""Round face icons for the distance tracker, cut from the close-up sprites."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
# sprite, face centre (x, y) and radius in the sprite's own pixels
FACES = {
    "icon_you": ("13_you_point", (515, 470), 300),
    "icon_ronaldo": ("10_ronaldo_closeup", (575, 450), 270),
    "icon_mrbeast": ("07_mrbeast_closeup", (512, 560), 300),
    "icon_elon": ("04_elon_closeup", (420, 420), 310),
}
FALLBACK = {"icon_mrbeast": ("05_mrbeast_moneygun", (375, 330), 125)}
S = 160


def main():
    for name, (sprite, (cx, cy), r) in FACES.items():
        src = ROOT / f"public/img/{sprite}.png"
        if not src.exists():
            sprite, (cx, cy), r = FALLBACK[name]
            src = ROOT / f"public/img/{sprite}.png"
        im = Image.open(src).convert("RGBA").crop((cx - r, cy - r, cx + r, cy + r)).resize((S, S), Image.LANCZOS)
        bg = Image.new("RGBA", (S, S), (255, 214, 64, 255))
        bg.alpha_composite(im)
        mask = Image.new("L", (S * 4, S * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, S * 4 - 1, S * 4 - 1), fill=255)
        bg.putalpha(mask.resize((S, S), Image.LANCZOS))
        bg.save(ROOT / f"public/img/{name}.png")
        print(name, "from", sprite)


if __name__ == "__main__":
    main()
