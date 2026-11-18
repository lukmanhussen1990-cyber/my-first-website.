import json, sys, time
from faster_whisper import WhisperModel
t0=time.time()
model = WhisperModel("medium.en", device="cpu", compute_type="int8", download_root="/opt/work/hf", cpu_threads=4)
import numpy as np
audio = np.fromfile("/opt/work/audio/vo16k.f32", dtype=np.float32)
segments, info = model.transcribe(audio, language="en", word_timestamps=True, beam_size=5, vad_filter=False,
                                  initial_prompt="You poop your pants, but you're a genius, so you dunk your undies in water.")
words=[]
segs=[]
for s in segments:
    segs.append({"start":s.start,"end":s.end,"text":s.text})
    for w in s.words:
        words.append({"word":w.word.strip(),"start":round(w.start,3),"end":round(w.end,3),"prob":round(w.probability,3)})
json.dump({"segments":segs,"words":words,"duration":info.duration}, open("/opt/work/audio/transcript.json","w"), indent=1)
print("took", time.time()-t0)
for s in segs: print(f"{s['start']:6.2f}-{s['end']:6.2f} {s['text']}")
