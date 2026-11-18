"""Placeholder word timestamps (~3 words/s with punctuation pauses) until the real VO arrives."""
import json, re
txt = open("/opt/work/elev/vo_script.txt").read().split()
t = 0.0
words = []
for w in txt:
    core = re.sub(r"[^A-Za-z']", "", w)
    d = 0.11 + 0.052 * len(core)
    words.append({"word": w, "start": round(t, 3), "end": round(t + d, 3)})
    t += d
    if w.endswith((".", "!", "?")):
        t += 0.42
    elif w.endswith(","):
        t += 0.24
json.dump({"words": words, "duration": t, "estimated": True}, open("/opt/work/elev/words.json", "w"), indent=1)
print(len(words), "words, est duration", round(t, 2))
