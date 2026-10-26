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
segs, _ = m.transcribe(np.frombuffer(pcm, dtype=np.float32), word_timestamps=True, initial_prompt="Methuselah, Enoch, Lamech, Noah, Genesis, longsuffering, repentance.")
heard = [(w.start, re.sub(r"[^a-z0-9']", "", w.word.lower())) for s in segs for w in s.words]
# numbers compare as numbers: "five" == "5", "one hundred eighty-seven" == "187"
ONES = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
TENS = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()) if w != "_"}
def as_num(text):
    toks = re.findall(r"[a-z0-9]+", text.lower())
    if not toks: return ""
    if all(t.isdigit() for t in toks): return "".join(toks)
    total, cur = 0, 0
    for t in toks:
        if t in ONES: cur += ONES[t]
        elif t in TENS: cur += TENS[t]
        elif t == "hundred": cur = max(cur, 1) * 100
        elif t == "thousand": total += max(cur, 1) * 1000; cur = 0
        elif t == "and": continue
        else: return re.sub(r"[^a-z0-9']", "", text.lower())
    return str(total + cur)
heard = [(s, as_num(w)) for s, w in heard]
exp = [(w["start"], as_num(w["spoken"])) for w in T["words"]]
diffs, miss, hi = [], [], 0
for es, ew in exp:
    hit = None
    for j in range(max(0, hi - 3), min(len(heard), hi + 6)):
        hw = heard[j][1]
        if hw == ew or (len(ew) > 3 and hw[:4] == ew[:4]):
            hit = j; break
    if hit is None: miss.append((round(es, 2), ew)); continue
    diffs.append(heard[hit][0] - es); hi = hit + 1
d = np.array(diffs)
print(f"{path}: matched {len(d)}/{len(exp)} words; onset diff median {np.median(d)*1000:.0f} ms, p90 |diff| {np.percentile(np.abs(d),90)*1000:.0f} ms")
print("not matched:", miss)
print("heard:", " ".join(h[1] for h in heard))
