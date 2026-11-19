"""Storyboard animatic: one 720x1280 card per shot (shot number, timing, the shot's description from shots.py),
written as frame 1 of each shot folder so assemble.sh can cut it to the real mix with burned-in captions.
Usage: python3 animatic.py <frames_dir>   then   FRAMES=<frames_dir> ep2/assemble.sh <out.mp4> draft captions"""
import ast, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cuts import CUTS, SHOT_NAMES, frames_of

OUT = sys.argv[1]
FB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FR = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
docs = {n.name: ast.get_docstring(n) for n in ast.parse(open(os.path.join(HERE, "shots.py")).read()).body
        if isinstance(n, ast.FunctionDef) and n.name in SHOT_NAMES}
SET = {}
for k, sets in ((range(1, 5), "OFFICE"), (range(5, 9), "HR"), (range(9, 13), "VEGAN CAFE"), (range(13, 19), "MONASTERY"),
                (range(19, 24), "BUTCHER"), (range(24, 32), "FUNERAL")):
    for i in k:
        SET[f"sh{i:02d}"] = sets
COL = {"OFFICE": (200, 160, 60), "HR": (120, 150, 230), "VEGAN CAFE": (80, 190, 100), "MONASTERY": (230, 150, 70),
       "BUTCHER": (220, 60, 60), "FUNERAL": (170, 150, 200)}
t0s = dict(CUTS)
for i, sh in enumerate(SHOT_NAMES):
    im = Image.new("RGB", (720, 1280), (22, 24, 30))
    d = ImageDraw.Draw(im)
    c = COL[SET[sh]]
    for y in range(1280):
        k = y / 1280
        d.line((0, y, 720, y), fill=(int(22 + c[0] * 0.10 * (1 - k)), int(24 + c[1] * 0.10 * (1 - k)), int(30 + c[2] * 0.10 * (1 - k))))
    d.rectangle((0, 0, 720, 12), fill=c)
    d.text((48, 70), "LARRY · EP 3 · ANIMATIC", font=ImageFont.truetype(FB, 26), fill=(150, 155, 170))
    d.text((48, 120), f"SHOT {sh[2:]}", font=ImageFont.truetype(FB, 96), fill=(255, 255, 255))
    t0 = t0s[sh]; t1 = CUTS[i + 1][1]
    d.text((52, 235), f"{t0:05.2f}s – {t1:05.2f}s · {frames_of(sh)} frames", font=ImageFont.truetype(FR, 30), fill=(170, 175, 190))
    d.rounded_rectangle((48, 300, 48 + 22 + d.textlength(SET[sh], font=ImageFont.truetype(FB, 30)) + 22, 352), 26, fill=c)
    d.text((70, 307), SET[sh], font=ImageFont.truetype(FB, 30), fill=(20, 20, 24))
    doc = (docs.get(sh) or "").replace("\n", " ")
    beat, _, action = doc.partition(" - ")
    y = 400
    for line in textwrap.wrap(action or doc, 30):
        d.text((48, y), line, font=ImageFont.truetype(FR, 38), fill=(225, 228, 235)); y += 50
    d.text((48, 1215), "storyboard card · real 3D render replaces it", font=ImageFont.truetype(FR, 24), fill=(110, 115, 130))
    os.makedirs(os.path.join(OUT, sh), exist_ok=True)
    im.save(os.path.join(OUT, sh, "f_0001.png"))
print(len(SHOT_NAMES), "cards ->", OUT)
