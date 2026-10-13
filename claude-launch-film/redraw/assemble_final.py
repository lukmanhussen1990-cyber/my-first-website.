#!/usr/bin/env python3
"""Collect every scene's rendered frames into one 1..N sequence and report gaps.
usage: assemble_final.py OUTDIR [--fallback DIR] [--skip SCENE,SCENE]
Scenes in --skip (or frames a scene has not rendered) take the frame from --fallback when given."""
import sys, os, json, argparse, cv2
RD = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--fallback', default='')
ap.add_argument('--skip', default=''); a = ap.parse_args()
scenes = json.load(open(f'{RD}/scenes.json'))
skip = set(x for x in a.skip.split(',') if x)
os.makedirs(a.out, exist_ok=True)
owner = {f: name for name, (s, e) in scenes.items() for f in range(s, e + 1)}
last = max(owner)
missing, bad, used = [], [], {}
for f in range(1, last + 1):
    name = owner.get(f)
    src = f'{RD}/out/{name}/f{f:04d}.png' if name and name not in skip else None
    if not src or not os.path.exists(src):
        fb = f'{a.fallback}/f{f:04d}.png' if a.fallback else None
        if fb and os.path.exists(fb): src = fb; name = 'fallback'
        else: missing.append((f, name)); continue
    dst = f'{a.out}/f{f:04d}.png'
    if os.path.lexists(dst): os.remove(dst)
    im = cv2.imread(src)
    if im is None or im.shape[:2] != (1080, 1920):
        bad.append((f, name)); continue
    os.symlink(os.path.abspath(src), dst)
    used[name] = used.get(name, 0) + 1
print('frames', last, 'sources', used)
print('missing', len(missing), missing[:20])
print('bad', len(bad), bad[:20])
