"""Turn raw per-frame tracker picks into a clean camera trajectory.

The greeting's entrance is a very fast push-in (scale 0.35 -> 0.91 in four
frames), so a median-based outlier filter would throw away perfectly good
measurements. Instead we trust any confident pick, drop only those that
disagree with both neighbours, interpolate the remaining gaps, and smooth only
where the camera is actually moving slowly.
"""
import json
import numpy as np

ACCEPT_SCORE = 0.60      # a single template matching this well is trustworthy
ACCEPT_CONS  = 1.00      # ...or two templates agreeing

def build(path='global.json', lo=58, hi=178):
    raw = json.load(open(path))
    S = {}
    for i in range(lo, hi):
        r = raw.get(str(i))
        if not r or not r.get('pick'):
            continue
        p = r['pick']
        if p['score'] >= ACCEPT_SCORE or r['consensus'] >= ACCEPT_CONS:
            S[i] = [p['s'], p['tx'], p['ty']]

    keys = sorted(S)
    # drop a pick only when both neighbours contradict it
    good = {}
    for n, i in enumerate(keys):
        nb = [S[keys[m]] for m in (n - 1, n + 1) if 0 <= m < len(keys)]
        if len(nb) == 2:
            bad = all(abs(S[i][0] - v[0]) > 0.12 or abs(S[i][1] - v[1]) > 160
                      for v in nb)
            if bad:
                continue
        good[i] = S[i]
    keys = sorted(good)
    if not keys:
        return {}, set()

    # shot boundaries: a jump between adjacent frames too large for camera motion
    cuts = set()
    for a, b in zip(keys[:-1], keys[1:]):
        if b - a == 1 and (abs(good[b][0] - good[a][0]) > 0.10
                           or abs(good[b][1] - good[a][1]) > 180):
            cuts.add(b)

    def seg(i):
        return sum(1 for c in cuts if i >= c)

    # interpolate gaps, never across a cut
    out = dict(good)
    for i in range(keys[0], keys[-1] + 1):
        if i in out:
            continue
        prev = max([k for k in keys if k < i], default=None)
        nxt = min([k for k in keys if k > i], default=None)
        if prev is None or nxt is None or seg(prev) != seg(nxt):
            continue
        f = (i - prev) / (nxt - prev)
        out[i] = [good[prev][k] * (1 - f) + good[nxt][k] * f for k in range(3)]

    # smooth only where the camera is moving slowly
    ks = sorted(out)
    sm = {}
    for i in ks:
        win = [out[j] for j in ks
               if abs(j - i) <= 1 and seg(j) == seg(i)
               and abs(out[j][0] - out[i][0]) < 0.05]
        sm[i] = list(np.mean(np.array(win), axis=0))

    # Measured tail: the greeting stays faintly legible for a few frames after
    # the tracker loses confidence. Those frames are pinned from direct
    # measurement of where the text actually is, and are applied after
    # smoothing so they are not dragged toward their neighbours.
    try:
        for k, v in json.load(open('traj_extra.json')).items():
            sm[int(k)] = list(v)
    except FileNotFoundError:
        pass
    return sm, cuts

if __name__ == '__main__':
    sm, cuts = build()
    print("cuts:", sorted(cuts), " frames:", min(sm), "-", max(sm), f"({len(sm)})")
    for i in sorted(sm):
        s, tx, ty = sm[i]
        print(f"{i} s={s:.3f} tx={tx:8.1f} ty={ty:7.1f}  Elon_x={363*s+tx:7.1f}"
              f"  chip_x={246*s+tx:7.1f}")
