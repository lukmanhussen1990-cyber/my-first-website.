import json, numpy as np, sys
from scipy.signal import savgol_filter
S = sys.argv[1]
th = {r['i']: r for r in json.load(open(S + '/frames/track_house.json'))}
te = {r['i']: r for r in json.load(open(S + '/frames/track_ext.json'))}
ts = {int(k): v for k, v in json.load(open(S + '/frames/track_steps.json')).items()}
N0, N1 = 96, 357
s = np.full(N1, np.nan); ox = np.full(N1, np.nan); oy = np.full(N1, np.nan)
for n, (sc, sv, x, y) in ts.items():
    if 100 <= n < 132 and sc > 0.6:
        s[n], ox[n], oy[n] = 0.985, x, y
for n in range(132, 293):
    r = th[n]
    if r['score'] > 0.7:
        s[n], ox[n], oy[n] = r['s'], r['ox'], r['oy']
for n in range(293, 342):
    w = te[n]['win']
    if w and w[0] > 2:
        sw = w[3] / 114.0
        s[n], ox[n], oy[n] = sw, w[0] - sw * 68, w[1] - sw * 220
idx = np.arange(N1)
good = ~np.isnan(s)
lo, hi = idx[good].min(), idx[good].max()
s[lo:132] = 0.985
for arr, win in ((s, 15), (ox, 9), (oy, 21)):
    seg = arr[lo:hi + 1].copy()
    nanm = np.isnan(seg)
    seg[nanm] = np.interp(np.where(nanm)[0], np.where(~nanm)[0], seg[~nanm])
    arr[lo:hi + 1] = savgol_filter(seg, win, 2)
    v0 = (arr[lo + 4] - arr[lo]) / 4.0
    for n in range(lo - 1, N0 - 1, -1):
        arr[n] = arr[lo] + v0 * (n - lo) * 0.8
    v1 = (arr[hi] - arr[hi - 4]) / 4.0
    for n in range(hi + 1, N1):
        arr[n] = arr[hi] + v1 * (n - hi)
out = {int(n): dict(s=float(s[n]), ox=float(ox[n]), oy=float(oy[n])) for n in range(N0, N1)}
json.dump(out, open(S + '/assets/track/house_T.json', 'w'))
for n in list(range(N0, N1, 16)) + [N1 - 1]:
    print(n, {k: round(v, 2) for k, v in out[n].items()})
print('measured span', lo, hi)
