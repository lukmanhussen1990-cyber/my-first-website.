"""Dump FX + SFX events and shot table from shots.py (no rendering)."""
import sys, json
sys.path.insert(0, '/home/user/work/scripts')
import bpy
bpy.ops.wm.open_mainfile(filepath='/home/user/work/assets/world.blend')
import shots as SH
S = SH.build_all(None)
fx, sfx, table = [], [], []
for n, s in S.items():
    fx += [dict(e, shot=n) for e in s.fx]
    sfx += [dict(e, shot=n) for e in s.sfx]
    table.append(dict(name=n, t0=s.t0, t1=s.t1))
json.dump(dict(fx=fx, sfx=sfx, shots=table), open('/home/user/work/events.json', 'w'), indent=1)
print(len(S), 'shots', len(fx), 'fx', len(sfx), 'sfx')
tt = sorted(table, key=lambda d: d['t0'])
for a, b in zip(tt, tt[1:]):
    if abs(a['t1'] - b['t0']) > 1e-6:
        print('GAP/OVERLAP', a, b)
print('end', tt[-1]['t1'])
