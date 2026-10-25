#!/usr/bin/env python3
"""QA helper: render frames at fractions of every scene and tile them into labelled sheets.
Usage: python3 scene_sheet.py PROJECT --vo vo_el [--fracs 0.35,0.9] [--cols 6] [--scenes S01,S05]"""
import argparse, json, os, subprocess
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("project"); ap.add_argument("--vo", default="vo_el")
ap.add_argument("--fracs", default="0.35,0.9"); ap.add_argument("--cols", type=int, default=6)
ap.add_argument("--scenes", default=""); ap.add_argument("--times", default="")
ap.add_argument("--out", default="build/sheets"); ap.add_argument("--scale", type=float, default=0.3)
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
proj = os.path.join(root, "projects", a.project)
tl = json.load(open(os.path.join(proj, "build", f"timeline_{a.vo}.json")))
want = set(filter(None, a.scenes.split(",")))
items = []
if a.times:
    items = [(f"t={float(t):.2f}", round(float(t), 2)) for t in a.times.split(",")]
else:
    for s in tl["scenes"]:
        if want and s["id"] not in want:
            continue
        for f in map(float, a.fracs.split(",")):
            items.append((f"{s['id']} {f:.2f}", round(s["start"] + s["dur"] * f, 2)))
outdir = os.path.join(proj, a.out); os.makedirs(outdir, exist_ok=True)
stills = os.path.join(proj, "build", "stills_qa")
subprocess.run(["node", os.path.join(root, "engine", "render.mjs"), "--project", a.project, "--vo", a.vo,
                "--stills", ",".join(f"{t:.2f}" for _, t in items), "--outdir", "build/stills_qa"], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
w, h = int(1080 * a.scale), int(1920 * a.scale)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
per = a.cols * 2
for k in range(0, len(items), per):
    chunk = items[k:k + per]
    rows = (len(chunk) + a.cols - 1) // a.cols
    S = Image.new("RGB", (a.cols * (w + 6), rows * (h + 24)), (30, 30, 30))
    d = ImageDraw.Draw(S)
    for i, (lab, t) in enumerate(chunk):
        f = os.path.join(stills, f"t{t:.2f}".replace("t", "t", 1))
        fn = os.path.join(stills, "t" + f"{t:.2f}".rjust(7, "0") + ".png")
        im = Image.open(fn).convert("RGB").resize((w, h), Image.LANCZOS)
        x, y = (i % a.cols) * (w + 6), (i // a.cols) * (h + 24)
        S.paste(im, (x, y + 22)); d.text((x + 4, y + 3), f"{lab}  ({t:.2f}s)", fill=(255, 220, 0), font=font)
    p = os.path.join(outdir, f"sheet_{k // per:02d}.jpg"); S.save(p, quality=85); print(p)
