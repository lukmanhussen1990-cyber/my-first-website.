#!/usr/bin/env python3
"""Use the user's own recording (audio/raw/my_voiceover.mp3) as it is: no speed or pitch change, nothing cut, no
silence added, no AI voice. The video is exactly as long as the recording.

Word timing: stt_parts.py (faster-whisper, local + free) -> audio/raw/my_voiceover.parts.json. The heard words are
matched to the script words (script.py) with a sequence alignment (numbers like "40" = "forty", "11-story" =
"eleven-story"), so every script word gets the time it is said. Anything said differently from the script is printed
(the captions must show the words exactly as said: CHUNKS in plan.py are then changed to match).
Writes audio/voiceover.wav (48 kHz), audio/vo_lines.json, audio/voiceover.words.json, script.json.
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

from script import TEXT

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SR = 48000
SRC = sys.argv[1] if len(sys.argv) > 1 else P("audio", "raw", "my_voiceover.mp3")
HEARD = json.load(open(SRC.rsplit(".", 1)[0] + ".parts.json"))["words"]

NUM = {"0": "zero", "1": "one", "2": "two", "5": "five", "10": "ten", "11": "eleven", "15": "fifteen", "20": "twenty",
       "30": "thirty", "40": "forty", "41": "fortyone", "60": "sixty", "87": "eightyseven", "120": "onehundredtwenty"}


def atoms(word):
    """'eleven-story' -> ['eleven', 'story']; '11-story' -> ['eleven', 'story']; '40%' -> ['forty', 'percent']."""
    w = word.lower().replace("’", "'").replace("%", " percent").replace("…", " ")
    out = []
    for p in re.split(r"[\s\-]+", w):
        p = re.sub(r"[^a-z0-9']", "", p).strip("'")
        if not p:
            continue
        if p in NUM:
            out += [NUM[p]]
        elif p in ("eighty", "seven") and out and out[-1] == "eighty":
            out[-1] = "eighty" + p
        else:
            out.append(p)
    # 'eighty seven' and 'eighty-seven' both -> 'eightyseven'
    merged = []
    for a in out:
        if merged and merged[-1] == "eighty" and a == "seven":
            merged[-1] = "eightyseven"
        else:
            merged.append(a)
    return merged


# script atoms (with the token they belong to)
s_atoms, s_owner = [], []
tokens = [(li, w) for li, line in enumerate(TEXT) for w in line.split()]
for ti, (li, w) in enumerate(tokens):
    for a in atoms(w):
        s_atoms.append(a); s_owner.append(ti)
# heard atoms (with their times)
h_atoms, h_time = [], []
for h in HEARD:
    at = atoms(h["w"])
    for k, a in enumerate(at):
        d = (h["e"] - h["s"]) / max(1, len(at))
        h_atoms.append(a); h_time.append((h["s"] + k * d, h["s"] + (k + 1) * d))

sm = difflib.SequenceMatcher(a=s_atoms, b=h_atoms, autojunk=False)
times = [None] * len(s_atoms)
diffs = []
for op, a0, a1, b0, b1 in sm.get_opcodes():
    if op == "equal":
        for k in range(a1 - a0):
            times[a0 + k] = h_time[b0 + k]
    else:
        diffs.append((op, " ".join(s_atoms[a0:a1]), " ".join(h_atoms[b0:b1])))
        if op == "replace" and a1 - a0 == b1 - b0:
            for k in range(a1 - a0):
                times[a0 + k] = h_time[b0 + k]
# interpolate any script atom the voice did not match
known = [i for i, t in enumerate(times) if t]
for i, t in enumerate(times):
    if t is None:
        prev = max([k for k in known if k < i], default=None)
        nxt = min([k for k in known if k > i], default=None)
        a = times[prev][1] if prev is not None else 0.0
        b = times[nxt][0] if nxt is not None else a + 0.3
        n = (nxt if nxt is not None else len(times)) - (prev if prev is not None else -1)
        j = i - (prev if prev is not None else -1)
        s0 = a + (b - a) * (j - 1) / n
        times[i] = (s0, s0 + max(0.06, (b - a) / n))

words = []
for ti, (li, w) in enumerate(tokens):
    ks = [k for k, o in enumerate(s_owner) if o == ti]
    s0, e0 = times[ks[0]][0], times[ks[-1]][1]
    words.append({"w": w, "s": round(s0, 3), "e": round(max(e0, s0 + 0.05), 3), "line": li + 1})

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
dur = len(x) / SR
sf.write(P("audio", "voiceover.wav"), x, SR, subtype="PCM_24")
lines = []
for li, text in enumerate(TEXT):
    ws = [w for w in words if w["line"] == li + 1]
    lines.append({"i": li + 1, "who": "N", "text": text, "start": ws[0]["s"], "end": ws[-1]["e"]})
json.dump({"takes": {"N": os.path.basename(SRC)}, "duration": round(dur, 3), "lines": lines}, open(P("audio", "vo_lines.json"), "w"), indent=1, ensure_ascii=False)
json.dump(words, open(P("audio", "voiceover.words.json"), "w"), indent=0, ensure_ascii=False)
json.dump({"source": f"audio/raw/{os.path.basename(SRC)} (the user's own recording, unchanged)",
           "lines": [{"i": l["i"], "who": l["who"], "text": l["text"]} for l in lines]}, open(P("script.json"), "w"), indent=1, ensure_ascii=False)
for l in lines:
    print(f"{l['i']:2d} {l['start']:6.2f}-{l['end']:6.2f}  {l['text']}")
print(f"voiceover: {dur:.3f} s (the recording, unchanged), {len(lines)} lines, {len(words)} words")
if diffs:
    print("SAID DIFFERENTLY FROM THE SCRIPT (fix the captions to match):")
    for d in diffs:
        print("  ", d)
