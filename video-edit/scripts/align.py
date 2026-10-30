"""Force-align the provided transcript (per line, inside its time window) with pocketsphinx.
Produces work/words.json: [{text, start, end, words:[{w, s, e}]}] where w is the display token."""
import json, wave, numpy as np
from pocketsphinx import Decoder
spoken = {"5.1": "five point one", "40": "forty"}
audio = np.frombuffer(wave.open("work/audio16k.wav").readframes(10**9), dtype=np.int16)
SR = 16000
out = []
prev_end = 0.0
for line in open("work/transcript.txt"):
    a, b, text = line.strip().split("|")
    a, b = float(a), float(b)
    w0 = max(0.0, a - 0.30, prev_end + 0.02); w1 = min(len(audio) / SR, b + 0.40)
    seg = audio[int(w0 * SR):int(w1 * SR)].tobytes()
    toks = text.split()
    words = []          # (spoken word, token index)
    for i, t in enumerate(toks):
        core = t.strip(",.").lower()
        for w in spoken.get(core, core.replace("-", " ")).split():
            words.append((w, i))
    dec = Decoder(samprate=SR, bestpath=False, loglevel="ERROR")
    dec.set_align_text(" ".join(w for w, _ in words))
    dec.start_utt(); dec.process_raw(seg, full_utt=True); dec.end_utt()
    segs = [(s.word, s.start_frame / 100 + w0, (s.end_frame + 1) / 100 + w0) for s in dec.seg()]
    segs = [s for s in segs if s[0] not in ("<s>", "</s>", "<sil>", "[NOISE]")]
    names = [s[0].split("(")[0] for s in segs]
    assert names == [w for w, _ in words], (names, words)
    tw = []
    for i, t in enumerate(toks):
        ss = [s for s, (w, j) in zip(segs, words) if j == i]
        tw.append({"w": t, "s": round(ss[0][1], 3), "e": round(ss[-1][2], 3)})
    prev_end = tw[-1]["e"]
    out.append({"text": text, "start": tw[0]["s"], "end": tw[-1]["e"], "words": tw})
    print(f"{a:6.2f}->{tw[0]['s']:6.2f}  {b:6.2f}->{tw[-1]['e']:6.2f}  " + " ".join(f"{x['w']}@{x['s']:.2f}" for x in tw))
json.dump(out, open("work/words.json", "w"), indent=1)
