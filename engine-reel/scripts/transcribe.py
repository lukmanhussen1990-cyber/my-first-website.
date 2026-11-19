import json, sys
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
prompt = "Every time you turn her on, she goes through four moves—suck, squeeze, bang, and blow—over three thousand times a minute."
import numpy as np
audio = np.fromfile(sys.argv[1], dtype=np.float32)
segs, info = m.transcribe(audio, word_timestamps=True, initial_prompt=prompt, beam_size=5, vad_filter=False)
words = []
for s in segs:
    for w in s.words:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
json.dump(words, open(sys.argv[2], "w"), indent=0)
for w in words: print(f'{w["s"]:7.2f} {w["e"]:7.2f} {w["w"]}')
