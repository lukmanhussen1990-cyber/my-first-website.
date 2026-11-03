"""Refine faster-whisper word times with free local forced alignment (torchaudio MMS_FA). Writes words_aligned.json."""
import json, os, re, subprocess
import numpy as np, torch, torchaudio
HERE = os.path.dirname(os.path.abspath(__file__))
W = json.load(open(os.path.join(HERE, "words.json")))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "my_voiceover.mp3"), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
wav = torch.from_numpy(np.frombuffer(raw, np.float32).copy()).unsqueeze(0)
bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=False).eval()
tok = bundle.get_tokenizer(); aligner = bundle.get_aligner()
def norm(w):
    w = w.lower().replace("’", "'")
    w = re.sub(r"[^a-z']", "", w)
    return w.replace("'", "") or "a"
words = [norm(w["w"]) for w in W]
with torch.inference_mode():
    em, _ = model(wav)
    spans = aligner(em[0], tok(words))
ratio = wav.shape[1] / em.shape[1] / 16000
out = []
for w, sp in zip(W, spans):
    s, e = sp[0].start * ratio, sp[-1].end * ratio
    out.append(dict(w=w["w"], s=round(s, 3), e=round(e, 3), ws=w["s"], we=w["e"]))
json.dump(out, open(os.path.join(HERE, "words_aligned.json"), "w"), indent=0)
big = [(i, o["w"], o["s"], o["ws"]) for i, o in enumerate(out) if abs(o["s"] - o["ws"]) > 0.15]
print("aligned", len(out), "words; differ from whisper by >0.15s:", len(big))
for b in big: print("  ", b)
