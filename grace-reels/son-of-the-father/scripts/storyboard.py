#!/usr/bin/env python3
"""Storyboard from the rendered reel: one frame per shot (mid-shot), labelled with shot id + time.
usage: python3 scripts/storyboard.py out/final_reel.mp4 out/storyboard.jpg"""
import json, subprocess, sys, os, tempfile
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
shots = json.loads(subprocess.check_output(['node', '-e', '''
import("./src/plan.js").then(({buildPlan}) => { const T = JSON.parse(require("fs").readFileSync("timeline.json")); const P = buildPlan(T);
  console.log(JSON.stringify(P.shots.filter(s => s.id !== "LOOP").map(s => ({id: s.id, t: (s.t0 + Math.min(s.t1, P.dur)) / 2, t0: s.t0, t1: s.t1}))));});''']))
tmp = tempfile.mkdtemp()
W, H, cols = 240, 427, 7
rows = (len(shots) + cols - 1) // cols
S = Image.new('RGB', (cols * (W + 8) + 8, rows * (H + 40) + 70), (22, 16, 12))
d = ImageDraw.Draw(S)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18); big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: font = big = ImageFont.load_default()
d.text((12, 18), 'GRACE IN MOTION · Q.01 SEVEN THINGS · storyboard', fill=(240, 191, 90), font=big)
for k, s in enumerate(shots):
    f = os.path.join(tmp, f'{k}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{s['t']:.3f}", '-i', src, '-frames:v', '1', '-vf', f'scale={W}:{H}', f], check=True)
    x, y = 8 + (k % cols) * (W + 8), 70 + (k // cols) * (H + 40)
    S.paste(Image.open(f), (x, y + 32))
    d.text((x + 2, y + 6), f"{s['id']}  {s['t0']:.1f}–{s['t1']:.1f}s", fill=(244, 226, 191), font=font)
S.save(out, quality=88); print(out, S.size)
