import sys, json, subprocess
import numpy as np
from faster_whisper import WhisperModel

def load(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

model_name, out, files = sys.argv[1], sys.argv[2], sys.argv[3:]
model = WhisperModel(model_name, device="cpu", compute_type="int8")
res = {}
for f in files:
    audio = load(f)
    segs, info = model.transcribe(audio, word_timestamps=True, language="en", vad_filter=False)
    words, text = [], []
    for s in segs:
        text.append(s.text)
        for w in s.words:
            words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)})
    res[f] = {"text": "".join(text).strip(), "words": words, "duration": round(len(audio) / 16000, 3)}
    print(f, "->", res[f]["text"], flush=True)
json.dump(res, open(out, "w"), indent=1)
