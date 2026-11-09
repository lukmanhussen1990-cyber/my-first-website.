# Word timings for a voice with no speech-to-text model (e.g. Hindi): speech/pause segmentation by energy, the known
# script's phrase boundaries snapped to the nearest pauses, words spread inside each stretch by their length.
# usage: python -I shorts/align_pauses.py <voice.wav> <script.txt> <out words.json>
import json, re, subprocess, sys

wav, script, out = sys.argv[1:4]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], capture_output=True, text=True).stdout)
log = subprocess.run(["ffmpeg", "-i", wav, "-af", "silencedetect=n=-38dB:d=0.16", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
sil = [(a, b) for a, b in zip(st, en)]
lead = 0.0
if sil and sil[0][0] < 0.05: lead = sil[0][1]; sil = sil[1:]
tail = dur
if sil and sil[-1][1] > dur - 0.05: tail = sil[-1][0]; sil = sil[:-1]
words = open(script, encoding="utf-8").read().split()
weight = lambda w: len(re.sub(r"[^ऀ-ॿa-zA-Z]", "", w)) + 1.5
strong = lambda w: bool(re.search(r"(।|\?|\.\.\.|…)$", w))
weak = lambda w: w.endswith(",")
# speech time axis (pauses removed)
speech = []
t = lead
for a, b in sil:
    if a > t: speech.append((t, a))
    t = b
speech.append((t, tail))
total_speech = sum(b - a for a, b in speech)
def at_speech(x):  # speech-time -> clock time
    for a, b in speech:
        if x <= b - a: return a + x
        x -= b - a
    return tail
W = [weight(w) for w in words]; tot = sum(W)
cum = [0.0]
for w in W: cum.append(cum[-1] + w)
est_end = [at_speech(total_speech * cum[i + 1] / tot) for i in range(len(words))]
# snap boundaries to pauses (strong first, then weak), each pause used once, nearest within 1.6 s
anchors = {}  # word index i -> (end of word i, start of word i+1)
used = set()
for pri in (strong, weak):
    for i, w in enumerate(words[:-1]):
        if not pri(w) or i in anchors: continue
        best, bd = None, 1.6
        for k, (a, b) in enumerate(sil):
            if k in used: continue
            d = abs((a + b) / 2 - est_end[i])
            if d < bd: best, bd = k, d
        if best is not None:
            # keep order: a pause cannot sit between two pauses of earlier/later anchors out of order
            ok = all((j < i) == (sil[k2][0] < sil[best][0]) for j, k2 in [(j, used_k) for j, used_k in anchors.items()] for _ in [0] if False) or True
            anchors[i] = best; used.add(best)
# enforce monotonic anchors (drop crossings)
items = sorted(anchors.items())
mono, last = [], -1
for i, k in items:
    if sil[k][0] > last: mono.append((i, k)); last = sil[k][1]
# fill words between anchors
res = [None] * len(words)
bounds = [(-1, None)] + mono + [(len(words) - 1, None)]
for (i0, k0), (i1, k1) in zip(bounds[:-1], bounds[1:]):
    s = lead if k0 is None else sil[k0][1]
    e = tail if k1 is None else sil[k1][0]
    idx = list(range(i0 + 1, i1 + 1))
    if not idx: continue
    # inner pauses inside this stretch are kept: map by speech time within [s, e]
    inner = [(a, b) for a, b in sil if a > s and b < e]
    segs, t = [], s
    for a, b in inner:
        segs.append((t, a)); t = b
    segs.append((t, e))
    L = sum(b - a for a, b in segs)
    def clock(x):
        for a, b in segs:
            if x <= b - a + 1e-9: return a + x
            x -= b - a
        return e
    ws = sum(W[j] for j in idx); acc = 0.0
    for j in idx:
        a = clock(L * acc / ws); acc += W[j]; b = clock(L * acc / ws)
        res[j] = {"w": words[j], "s": round(a, 3), "e": round(b, 3)}
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"{len(words)} words, {len(sil)} pauses, {len(mono)} anchored boundaries, speech {lead:.2f}-{tail:.2f} s")
