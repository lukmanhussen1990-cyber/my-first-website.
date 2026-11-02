"""Build the final voiceover: take 1 + longer designed pauses.

Outputs vo_final.wav (48 kHz mono) and timeline.json (word times in the new audio).
Run with the scratch venv python (needs numpy, soundfile, librosa).
"""
import json, sys, os
import numpy as np
import librosa, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
y, _ = librosa.load(os.path.join(HERE, "vo_take2.mp3"), sr=SR, mono=True)
W = json.load(open(os.path.join(HERE, "vo_take2_words.json")))

# boundary (index of the word that starts after the pause) -> wanted silence (s)
PAUSES = {
    59: 0.6,   # beat before "That makes it worse"
    92: 1.9,   # longer pause before "What you don't know"
    120: 0.6,  # "Week one." / short pause
    126: 0.8,  # short pause before "Week two"
    128: 0.5,
    134: 0.8,  # short pause before "Week three"
    136: 0.5,
    160: 1.5,  # pause before the last line
}

hop = SR // 100
rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop, center=True)[0]
db = 20 * np.log10(rms + 1e-9)
silent = db < db.max() - 38

inserts = []  # (sample position, n samples)
for b, target in sorted(PAUSES.items()):
    a = b - 1
    lo = int((W[a]["e"] - 0.2) * 100)
    hi = int((W[b]["s"] + 0.2) * 100)
    # longest silent run in [lo, hi]
    best, cur, start = (0, lo, lo), 0, lo
    for f in range(lo, hi):
        if silent[f]:
            if cur == 0:
                start = f
            cur += 1
            if cur > best[0]:
                best = (cur, start, f)
        else:
            cur = 0
    run_len, s0, s1 = best
    gap_now = run_len / 100
    cut = int((s0 + s1) / 2 * hop)
    add = max(0.0, target - gap_now)
    inserts.append((cut, int(add * SR), b))
    print(f"before word {b} '{W[b]['w']}': gap {gap_now:.2f}s -> {target:.2f}s (+{add:.2f}s)")

out, prev = [], 0
for cut, n, _ in inserts:
    out.append(y[prev:cut])
    out.append(np.zeros(n, dtype=y.dtype))
    prev = cut
out.append(y[prev:])
vo = np.concatenate(out)

# shift word times
words = []
for i, w in enumerate(W):
    shift = sum(n for cut, n, b in inserts if i >= b) / SR
    words.append(dict(i=i, w=w["w"], s=round(w["s"] + shift, 3), e=round(w["e"] + shift, 3)))

# fix the end of the last word with the energy envelope (whisper cuts it short)
rms2 = librosa.feature.rms(y=vo, frame_length=hop * 2, hop_length=hop)[0]
db2 = 20 * np.log10(rms2 + 1e-9)
loud = np.where(db2 > db2.max() - 40)[0]
words[-1]["e"] = round(loud[-1] / 100 + 0.02, 3)

sf.write(os.path.join(HERE, "vo_final.wav"), vo, SR, subtype="PCM_16")
json.dump(dict(duration=round(len(vo) / SR, 3), words=words), open(os.path.join(HERE, "timeline.json"), "w"), indent=1)
print("final VO length %.2fs, last word ends %.2fs" % (len(vo) / SR, words[-1]["e"]))
