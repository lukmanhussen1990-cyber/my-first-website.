#!/usr/bin/env python3
"""QC: transcribe build/voice.wav with faster-whisper and compare to timings.json (sync + accuracy)."""
import json, re, subprocess, sys, numpy as np
from faster_whisper import WhisperModel
T = json.load(open("build/timings.json"))
pcm = subprocess.run(["ffmpeg","-v","error","-i","build/voice.wav","-ac","1","-ar","16000","-f","f32le","-"],capture_output=True,check=True).stdout
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs,_ = m.transcribe(np.frombuffer(pcm,dtype=np.float32), word_timestamps=True)
heard = [(w.start, w.end, re.sub(r"[^a-z0-9']","",w.word.lower())) for s in segs for w in s.words]
expected = [(w["start"], w["end"], re.sub(r"[^a-z0-9']","",w["w"].lower())) for l in T["lines"] for w in l["words"]]
# greedy match by text near expected time
diffs=[]; miss=[]
hi=0
for es,ee,ew in expected:
    best=None
    for j in range(max(0,hi-3), min(len(heard),hi+6)):
        if heard[j][2]==ew or (len(ew)>3 and heard[j][2][:4]==ew[:4]):
            best=j; break
    if best is None: miss.append((round(es,2),ew)); continue
    diffs.append(heard[best][0]-es); hi=best+1
d=np.array(diffs)
print(f"matched {len(d)}/{len(expected)} words; onset diff vs whisper: median {np.median(d)*1000:.0f} ms, p90 |diff| {np.percentile(np.abs(d),90)*1000:.0f} ms, max {np.abs(d).max()*1000:.0f} ms")
print("not matched:", miss)
print("whisper text:", " ".join(h[2] for h in heard))
