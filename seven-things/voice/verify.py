#!/usr/bin/env python3
"""QC: transcribe a wav with faster-whisper and compare to timeline.json (sync + intelligibility).
usage: python3 voice/verify.py [voice/voice.wav]"""
import json, re, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
path = sys.argv[1] if len(sys.argv) > 1 else "voice/voice.wav"
T = json.load(open("timeline.json"))
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs, _ = m.transcribe(np.frombuffer(pcm, dtype=np.float32), word_timestamps=True, initial_prompt="doth deviseth speaketh soweth brethren commendeth unrighteousness")
heard = [(w.start, re.sub(r"[^a-z0-9']", "", w.word.lower())) for s in segs for w in s.words]
num = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven"}
exp = [(w["start"], re.sub(r"[^a-z0-9']", "", w["spoken"].lower())) for w in T["words"]]
diffs, miss, hi = [], [], 0
for es, ew in exp:
    hit = None
    for j in range(max(0, hi - 3), min(len(heard), hi + 6)):
        hw = heard[j][1]; hw = num.get(hw, hw)
        if hw == ew or (len(ew) > 3 and hw[:4] == ew[:4]):
            hit = j; break
    if hit is None: miss.append((round(es, 2), ew)); continue
    diffs.append(heard[hit][0] - es); hi = hit + 1
d = np.array(diffs)
print(f"{path}: matched {len(d)}/{len(exp)} words; onset diff median {np.median(d)*1000:.0f} ms, p90 |diff| {np.percentile(np.abs(d),90)*1000:.0f} ms")
print("not matched:", miss)
print("heard:", " ".join(h[1] for h in heard))
