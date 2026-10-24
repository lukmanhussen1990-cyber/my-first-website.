"""Place each narration line on the timeline so key words land on their visual
events; writes audio/vo_track.wav (48 kHz mono) and audio/captions.json."""
import sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
S = sys.argv[1]
A = json.load(open(f'{S}/audio/vo/align.json'))
SR_IN, SR = 24000, 48000
# line -> list of (anchor word index, target time, chunk starts at word index)
PLAN = {
    's1':  [(0, 0.45, 0)],
    's2a': [(2, 6.70, 0)],
    's2b': [(2, 8.75, 0)],
    's3a': [(0, 13.35, 0)],
    's3b': [(0, 16.45, 0)],
    's4a': [(0, 20.35, 0)],
    's4b': [(1, 23.05, 0)],
    's5a': [(0, 28.15, 0)],
    's5b': [(2, 33.85, 0)],
    's6':  [(0, 36.0, 0), (3, 37.05, 3), (4, 37.65, 4), (5, 38.25, 5), (6, 38.95, 6), (9, 41.0, 7)],
    's7':  [(2, 44.55, 0), (5, 45.95, 4), (10, 48.45, 8)],
    's8a': [(0, 52.35, 0)],
    's8b': [(0, 54.15, 0)],
    's8c': [(0, 57.15, 0)],
}
ORDER = ['s1', 's2a', 's2b', 's3a', 's3b', 's4a', 's4b', 's5a', 's5b', 's6', 's7', 's8a', 's8b', 's8c']
track = np.zeros(int(60 * SR), np.float32)
caps = []
prev_end = 0.0
for lid in ORDER:
    a, sr = sf.read(f'{S}/audio/vo/{lid}.wav', dtype='float32')
    a = resample_poly(a, 2, 1).astype(np.float32)
    words = A[lid]['words']
    plan = PLAN[lid]
    # chunk boundaries (seconds, in the line's own audio)
    cuts = []
    for wi, tgt, ci in plan:
        c = 0.0 if ci == 0 else max(words[ci - 1]['t1'], words[ci]['t0'] - 0.03)
        cuts.append((c, wi, tgt))
    bounds = [c for c, _, _ in cuts] + [len(a) / SR]
    for k, (c, wi, tgt) in enumerate(cuts):
        c1 = bounds[k + 1]
        start = tgt - (words[wi]['t0'] - c)
        min_gap = 0.25 if k == 0 else 0.05
        start = max(start, prev_end + min_gap)
        seg = a[int(c * SR):int(c1 * SR)].copy()
        fade = int(0.012 * SR)
        if k > 0: seg[:fade] *= np.linspace(0, 1, fade)
        if k < len(cuts) - 1: seg[-fade:] *= np.linspace(1, 0, fade)
        i0 = int(start * SR)
        track[i0:i0 + len(seg)] += seg[:len(track) - i0]
        for w in words:
            if c - 1e-6 <= w['t0'] < c1 - 1e-6:
                caps.append(dict(w=w['w'], t0=round(start + w['t0'] - c, 3), t1=round(start + w['t1'] - c, 3), line=lid))
        prev_end = start + (c1 - c)
        print(f'{lid} chunk{k} start={start:6.2f} end={prev_end:6.2f} anchor={words[wi]["w"]}@{start + words[wi]["t0"] - c:.2f} (target {tgt})')
sf.write(f'{S}/audio/vo_track.wav', track, SR)
json.dump(caps, open(f'{S}/audio/captions.json', 'w'), indent=1)
print('words', len(caps), 'last end', caps[-1]['t1'])
