"""Refine whisper word timings with the audio energy envelope.

Whisper's DTW word times are good inside continuous speech but drift around
pauses. Where a real silence sits next to a word boundary we snap the next
word's start to the end of that silence. A few boundaries were checked by hand
(energy + high-frequency profile) and are pinned in OVERRIDES.

usage: refine_words.py take.wav take.words.json out.json
"""
import json
import sys

import numpy as np
import soundfile as sf

wav, words_path, out_path = sys.argv[1:4]
x, sr = sf.read(wav)
if x.ndim > 1:
    x = x.mean(axis=1)
hop, win = 0.005, 0.02
n = int(len(x) / sr / hop)
db = np.empty(n)
for i in range(n):
    c = i * hop
    seg = x[max(0, int((c - win / 2) * sr)):int((c + win / 2) * sr)]
    db[i] = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
ref = np.percentile(db, 90)
sil = db < ref - 30
runs = []
i = 0
while i < n:
    if sil[i]:
        j = i
        while j < n and sil[j]:
            j += 1
        if (j - i) * hop >= 0.06:
            runs.append((i * hop, j * hop))
        i = j
    else:
        i += 1

words = json.load(open(words_path))
# checked by hand (see energy/HF profile notes in the commit)
OVERRIDES = {
    # whisper collapsed this word to zero length; speech runs 36.80-37.92
    ("Congratulations!", 37.36): (36.80, 37.92),
}
for k in range(1, len(words)):
    w, p = words[k], words[k - 1]
    key = (w["w"], round(w["s"], 2))
    if key in OVERRIDES:
        w["s"], w["e"] = OVERRIDES[key]
        p["e"] = min(p["e"], w["s"] - 0.04)
        continue
    gap = w["s"] - p["e"]
    best = None
    for a, b in runs:
        # silence must sit on the boundary region and not swallow the previous word
        if b < w["s"] - 0.45 or b > w["s"] + 0.1 or a < p["s"] + 0.08:
            continue
        if gap < 0.1 and (b - a) < 0.1:
            continue
        if best is None or abs(b - w["s"]) < abs(best[1] - w["s"]):
            best = (a, b)
    if best:
        a, b = best
        w["s"] = round(b, 3)
        p["e"] = round(min(p["e"], a), 3)
    if p["e"] > w["s"]:
        p["e"] = w["s"]

json.dump(words, open(out_path, "w"), indent=1)
for w in words:
    print(f'{w["s"]:6.2f} {w["e"]:6.2f} {w["w"]}')
