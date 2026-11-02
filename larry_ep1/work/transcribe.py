import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[3] if len(sys.argv)>3 else "small.en", device="cpu", compute_type="int8")
segs, info = m.transcribe(__import__("numpy").fromfile(sys.argv[1],dtype="float32"), word_timestamps=True, beam_size=5, vad_filter=False)
out=[]
for s in segs:
    out.append({"start":s.start,"end":s.end,"text":s.text,"words":[{"w":w.word,"s":w.start,"e":w.end,"p":w.probability} for w in s.words]})
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text}", flush=True)
json.dump(out, open(sys.argv[2],"w"), indent=1)
