import json, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
src, out, size = sys.argv[1], sys.argv[2], sys.argv[3]
raw = subprocess.run(["ffmpeg","-v","error","-i",src,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True,check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32).copy()
m = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(audio, word_timestamps=True, language="en", beam_size=5, vad_filter=False, condition_on_previous_text=False)
words=[]; text=[]
for s in segs:
    text.append(s.text)
    for w in s.words:
        words.append({"w": w.word.strip(), "s": round(w.start,3), "e": round(w.end,3), "p": round(w.probability,3)})
json.dump({"text":"".join(text),"words":words,"duration":len(audio)/16000}, open(out,"w"), indent=1)
print("".join(text))
for w in words: print(f'{w["s"]:7.3f} {w["e"]:7.3f} {w["p"]:.2f} {w["w"]}')
