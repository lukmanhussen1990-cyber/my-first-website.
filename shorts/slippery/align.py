# Forced alignment of the known script to voice/voice16.wav (pocketsphinx, offline) -> voice/words.json
# words.json: [{"w": "Slippery", "s": 0.41, "e": 0.83}, ...] with the caption spelling (punctuation kept on the word).
import json, sys, re, wave
from pocketsphinx import Decoder

SCRIPT = open(sys.argv[1], encoding="utf-8").read().split()
OUT = sys.argv[2]
norm = lambda w: re.sub(r"[^a-z']", "", w.lower().replace("’", "'"))
toks = [norm(w) for w in SCRIPT]
w = wave.open("voice/voice16.wav", "rb"); data = w.readframes(w.getnframes())
d = Decoder(samprate=16000, bestpath=False)
d.set_align_text(" ".join(toks))
d.start_utt(); d.process_raw(data, full_utt=True); d.end_utt()
segs = [x for x in d.seg() if x.word not in ("<sil>", "<s>", "</s>", "[NOISE]", "(NULL)")]
print("score", d.hyp().score if d.hyp() else None, "aligned", len(segs), "of", len(toks))
out = []
for cap, s in zip(SCRIPT, segs):
    out.append({"w": cap, "s": round(s.start_frame / 100, 3), "e": round((s.end_frame + 1) / 100, 3), "tok": s.word})
json.dump(out, open(OUT, "w"), indent=0)
for o in out[:12]: print(o)
print("...")
for o in out[-6:]: print(o)
