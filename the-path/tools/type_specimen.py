"""Type specimen for the brief's type scale, set in the Nunito stand-in.

usage: .venv/bin/python -I tools/type_specimen.py   -> out/review/type_specimen.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / "assets/fonts/nunito/Nunito[wght].ttf"
OUT = ROOT / "out/review/type_specimen.png"
STAGE, WHITE, GREEN, ORANGE, GREY = (6, 10, 12), (255, 255, 255), (88, 204, 2), (255, 150, 0), (55, 70, 79)
LABEL = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 18)

# role, Nunito weight (stand-in for SF Pro Rounded), 16:9 size, sample, colour
ROLES = [
    ("Tagline · Heavy", 900, 150, "One path,", WHITE),
    ("", 900, 150, "every skill.", WHITE),
    ("Big numeral · Heavy, tabular", 900, 230, "365", ORANGE),
    ("Section label · Bold", 800, 56, "day streak   Languages   Math   Music   Chess", WHITE),
    ("UI header · Bold", 800, 46, "Translate this sentence   Diamond League", WHITE),
    ("UI body · Bold/Semibold", 700, 40, "Quiero un café, por favor.   ¡Hola! ¿Qué tal tu día?", WHITE),
    ("", 700, 40, "¡Muy bien! Pedí un café en español.   I want a coffee please", WHITE),
    ("UI small · Semibold", 700, 32, "2,415 XP   Duo · 02:14   M T W T F S S", (175, 190, 196)),
    ("START / CHECK · Heavy caps", 900, 38, "START   CHECK   Excellent!", GREEN),
    ("Signature · Semibold", 700, 56, "[YOUR SIGNATURE]", WHITE),
    ("Disclaimer · Regular 60%", 500, 22, "Spec ad. Not affiliated with, sponsored by, or endorsed by Duolingo.", (153, 155, 156)),
]


def main():
    img = Image.new("RGB", (1920, 1720), STAGE)
    d = ImageDraw.Draw(img)
    d.text((60, 30), "Type scale at 16:9 sizes · Nunito (SIL OFL) standing in for SF Pro Rounded · Raqm/HarfBuzz shaping",
           font=LABEL, fill=(160, 170, 175))
    y = 90
    for role, wght, size, text, col in ROLES:
        f = ImageFont.truetype(str(FONT), size, layout_engine=ImageFont.Layout.RAQM)
        f.set_variation_by_axes([wght])
        if role:
            d.text((60, y + 4), f"{role}  ·  wght {wght}  ·  {size} px", font=LABEL, fill=GREY)
            y += 30
        d.text((60, y), text, font=f, fill=col)
        x0, y0, x1, y1 = d.textbbox((60, y), text, font=f)
        y = y1 + (26 if size < 100 else 10)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.crop((0, 0, 1920, min(y + 40, 1720))).save(OUT)
    print("wrote", OUT, "height", y + 40)


if __name__ == "__main__":
    main()
