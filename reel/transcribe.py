import json, sys
from faster_whisper import WhisperModel
model = WhisperModel(sys.argv[2] if len(sys.argv)>2 else "small.en", device="cpu", compute_type="int8")
import numpy as np
audio=np.fromfile(sys.argv[1],dtype=np.float32)
segs, info = model.transcribe(audio, word_timestamps=True, beam_size=5, vad_filter=False)
words=[]
for s in segs:
    print(f"[{s.start:.2f}-{s.end:.2f}] {s.text}")
    for w in s.words:
        words.append({"w":w.word.strip(),"s":round(w.start,3),"e":round(w.end,3),"p":round(w.probability,3)})
json.dump(words, open("whisper_words.json","w"), indent=1)
for w in words: print(f"{w['s']:6.2f} {w['e']:6.2f} {w['w']}")
