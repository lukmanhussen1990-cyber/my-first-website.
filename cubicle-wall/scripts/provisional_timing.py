"""Placeholder word timings from script.txt (used only until the real voiceover is transcribed).
python scripts/provisional_timing.py script.txt build/words.json  -> prints the estimated duration"""
import json, re, sys
t, words = 0.15, []
for line in open(sys.argv[1], encoding="utf-8"):
    for w in line.split():
        d = 0.16 + 0.035 * len(re.sub(r"\W", "", w))
        words.append({"word": w, "start": round(t, 3), "end": round(t + d, 3), "p": 1.0})
        t += d + 0.02
        if w[-1] in ",": t += 0.12
        if w[-1] in ".!?": t += 0.45
json.dump(words, open(sys.argv[2], "w"), indent=1)
print(round(t + 0.3, 2))
