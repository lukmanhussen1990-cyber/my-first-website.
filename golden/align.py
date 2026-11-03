#!/usr/bin/env python3
"""Word timings for every caption, from the voiceover itself (all local, free).

1. transcribe.py (faster-whisper, run once) -> audio/whisper_words.json
2. this script matches the script's words to whisper's words (whisper's invented
   extras such as a stray "Yes." or end-of-file noise are dropped by the match),
3. then snaps the words onto the speech segments found in the audio energy, so a
   caption never appears during silence and starts on the real syllable.
-> audio/words.json
"""
import difflib, json, os, re, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000


def norm(w):
    w = w.lower().replace("okay", "ok")
    return re.sub(r"[^a-z0-9]", "", w)


def energy_segments(x, hop=0.02, min_sil=0.12):
    h = int(hop * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + h] ** 2)) for i in range(0, len(x) - h, h)])
    on = e >= 0.02 * e.max()
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]: j += 1
            segs.append([i * hop, j * hop]); i = j
        else:
            i += 1
    out = []
    for s in segs:
        if out and s[0] - out[-1][1] < min_sil: out[-1][1] = s[1]
        else: out.append(s)
    return [s for s in out if s[1] - s[0] >= 0.06]


def main():
    script = json.load(open(os.path.join(HERE, "script.json")))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, script["voiceover"]), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    dur = len(x) / SR
    words = [(ln["id"], w) for ln in script["lines"] for w in ln["text"].split()]
    wh = json.load(open(os.path.join(HERE, "audio", "whisper_words.json")))
    a = [norm(w) for _, w in words]
    b = [norm(w[0]) for w in wh]
    t = [None] * len(words)
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            t[blk.a + k] = [wh[blk.b + k][1], wh[blk.b + k][2]]
    missing = [words[i][1] for i in range(len(words)) if t[i] is None]
    # interpolate anything whisper did not give us
    for i in range(len(t)):
        if t[i] is None:
            j = i
            while j < len(t) and t[j] is None: j += 1
            t0 = t[i - 1][1] if i else 0.0
            t1 = t[j][0] if j < len(t) else dur
            for k in range(i, j):
                u0, u1 = (k - i) / (j - i), (k - i + 1) / (j - i)
                t[k] = [t0 + (t1 - t0) * u0, t0 + (t1 - t0) * u1]
    # snap onto real speech segments
    segs = energy_segments(x)
    seg_of = []
    for s, e in t:
        mid = (s + e) / 2
        best = min(range(len(segs)), key=lambda q: 0 if segs[q][0] - 0.12 <= mid <= segs[q][1] + 0.12 else min(abs(mid - segs[q][0]), abs(mid - segs[q][1])))
        seg_of.append(best)
    snapped = [list(v) for v in t]
    for q, (sa, sb) in enumerate(segs):
        idx = [i for i in range(len(t)) if seg_of[i] == q]
        if not idx: continue
        w0, w1 = t[idx[0]][0], t[idx[-1]][1]
        for i in idx:
            if w1 - w0 > 0.05:
                snapped[i] = [sa + (t[i][0] - w0) / (w1 - w0) * (sb - sa), sa + (t[i][1] - w0) / (w1 - w0) * (sb - sa)]
            else:
                snapped[i] = [sa, sb]
    for i in range(1, len(snapped)):          # keep monotonic
        snapped[i][0] = max(snapped[i][0], snapped[i - 1][0] + 0.02)
    out = [{"line": lid, "w": w, "s": round(s, 3), "e": round(max(e, s + 0.05), 3)} for (lid, w), (s, e) in zip(words, snapped)]
    json.dump({"duration": round(dur, 4), "segments": segs, "words": out}, open(os.path.join(HERE, "audio", "words.json"), "w"), indent=1)
    print(f"{len(out)} words, {len(segs)} speech segments, voiceover {dur:.3f}s; whisper missed: {missing or 'none'}")


if __name__ == "__main__":
    main()
