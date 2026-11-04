#!/usr/bin/env python3
"""DEV ONLY (until the user's recording arrives): placeholder word timings at a natural pace, so the shots can be
built and checked. Writes the same files as import_voiceover.py (audio/vo_lines.json, audio/voiceover.words.json).
The real build always runs import_voiceover.py on the user's own recording, which overwrites these."""
import json
import os

from script import TEXT

HERE = os.path.dirname(os.path.abspath(__file__))
t, words, lines = 0.15, [], []
for i, line in enumerate(TEXT):
    toks = line.split()
    s0 = t
    for w in toks:
        d = 0.16 + 0.036 * len(w.strip(".,:?!…'"))
        words.append({"w": w, "s": round(t, 3), "e": round(t + d, 3), "line": i + 1})
        t += d + (0.14 if w.endswith((",", ":", ".")) and w is not toks[-1] else 0.0)
    lines.append({"i": i + 1, "who": "N", "text": line, "start": round(s0, 3), "end": round(t, 3)})
    t += 0.26
dur = round(t + 0.6, 3)
os.makedirs(os.path.join(HERE, "audio"), exist_ok=True)
json.dump({"takes": {"N": "PLACEHOLDER"}, "duration": dur, "lines": lines}, open(os.path.join(HERE, "audio", "vo_lines.json"), "w"), indent=1)
json.dump(words, open(os.path.join(HERE, "audio", "voiceover.words.json"), "w"), indent=0)
print(f"placeholder timing: {dur:.2f} s, {len(lines)} lines, {len(words)} words")
