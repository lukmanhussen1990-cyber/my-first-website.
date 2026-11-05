"""Make a jobs.json for render-stills.mjs: one still per shot (at a chosen point in the shot).
Usage: python3 scripts/shot-jobs.py <outdir> <jobs.json> [frac=0.6] [filter-substring]"""
import glob
import json
import re
import sys

out_dir, jobs_file = sys.argv[1], sys.argv[2]
frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
filt = sys.argv[4] if len(sys.argv) > 4 else ''
shots = []
for f in sorted(glob.glob('src/shots/act*.tsx')):
    for m in re.finditer(r"\{id: '([^']+)', start: ([\d.]+), end: ([\d.]+)", open(f).read()):
        shots.append((m.group(1), float(m.group(2)), float(m.group(3))))
shots.sort(key=lambda s: s[1])
jobs = []
for sid, a, b in shots:
    if filt and filt not in sid:
        continue
    fr = int(round((a + (b - a) * frac) * 30))
    jobs.append({'comp': 'DogMayor', 'props': {'captions': True, 'audio': False}, 'frame': fr, 'out': f'{out_dir}/{sid}.png', 'label': f'{sid} {a:.2f}s'})
json.dump(jobs, open(jobs_file, 'w'), indent=0)
print(len(jobs), 'jobs')
