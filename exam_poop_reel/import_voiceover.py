#!/usr/bin/env python3
"""Use the user's own recording (audio/raw/my_voiceover.mp3). The voice itself is not changed (no speed or pitch
change, nothing cut, no AI voice). As the brief asks, only pure silence is added inside existing pauses:
  - a longer pause before "What you don't know" (+0.60 s),
  - slower pauses between the last five lines (+0.35 s before each),
  - a 2.6 s tail after the last word for the ending shot (the school at sunset, slow zoom out).
Silence is inserted at the quietest 10 ms of each pause, with 15 ms fades, so nothing of the voice is touched.

Word timing: stt_parts.py (faster-whisper, local + free) transcribed each of the 29 speech parts on its own.
Writes audio/voiceover.wav (48 kHz mono 24-bit), audio/vo_lines.json (one line per speech part),
audio/voiceover.words.json, script.json.
"""
import json
import os
import re
import subprocess

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SR = 48000
D = json.load(open(P("audio", "raw", "my_voiceover.parts.json")))
PARTS, HEARD = D["parts"], D["words"]
TEXT = ["It's your final exam.", "You can't hold it anymore.", "And the teacher said no toilet breaks.", "So you poop.",
        "Right there.", "At your desk.", "Into toilet paper.", "Nobody saw.", "You think.", "You wrap it up.", "Tight.",
        "Like a little present.", "You hide it in your pencil box.", "Perfect.", "Then the teacher stands up.",
        "Everyone, open your pencil boxes.", "I'm checking for cheat chits.", "She walks down the row.", "Box by box.",
        "Getting closer.", "What you don't know:",
        "The first pencils were made in England in the 1500s, after people found a giant lump of graphite in the ground.",
        "Your pencil box has a giant lump too.", "She reaches your desk.", "She opens it.", "She stares.", "She closes it.",
        "She walks away.", "She never checks pencil boxes again."]
TEACHER = {16, 17}                       # 1-based lines the teacher says (quotes in the script)
EXTRA = {21: 0.60, 25: 0.35, 26: 0.35, 27: 0.35, 28: 0.35, 29: 0.35}   # 1-based line -> silence added before it
TAIL = 2.6
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))
assert len(TEXT) == len(PARTS), (len(TEXT), len(PARTS))

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", P("audio", "raw", "my_voiceover.mp3"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)

# words per line (times in the original recording)
words = []
for i, ((a, b), text) in enumerate(zip(PARTS, TEXT)):
    toks = text.split()
    heard = [w for w in HEARD if w["part"] == i]
    if [norm(h["w"]) for h in heard] != [norm(t) for t in toks]:
        print(f"  part {i}: heard {[h['w'] for h in heard]}")
    if len(heard) != len(toks):
        heard = [{"s": a + (b - a) * k / len(toks), "e": a + (b - a) * (k + 1) / len(toks)} for k in range(len(toks))]
    for k, (t, h) in enumerate(zip(toks, heard)):
        s = a if k == 0 else max(a, h["s"])
        words.append({"w": t, "s": s, "e": min(b, max(h["e"], s + 0.05)), "line": i + 1})

# insert the silences in the middle of the existing pauses (at the quietest 10 ms)
pieces, cur, shifts = [], 0, []
for li, add in sorted(EXTRA.items()):
    prev_end, nxt = PARTS[li - 2][1], PARTS[li - 1][0]
    g0, g1 = int((prev_end - 0.02) * SR), int((nxt + 0.02) * SR)
    win = int(0.01 * SR)
    rms = [np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(g0, max(g0 + 1, g1 - win), win // 2)]
    cut = g0 + int(np.argmin(rms)) * (win // 2) + win // 2
    f = int(0.015 * SR)
    x = x.copy(); x[cut - f:cut] *= np.linspace(1, 0, f); x[cut:cut + f] *= np.linspace(0, 1, f)
    print(f"pause before line {li} ({TEXT[li - 1][:22]}...): {nxt - prev_end:.2f} s -> {nxt - prev_end + add:.2f} s "
          f"(cut at {cut / SR:.2f} s, {20 * np.log10(min(rms) + 1e-9):.0f} dBFS)")
    pieces += [x[cur:cut], np.zeros(int(round(add * SR)))]
    cur = cut
    shifts.append((cut / SR, add))
pieces.append(x[cur:])
y = np.concatenate(pieces)
moved = lambda t: t + sum(a for (c, a) in shifts if t >= c)
for w in words:
    w["s"], w["e"] = round(moved(w["s"]), 3), round(moved(w["e"]), 3)
lines = [{"i": i + 1, "who": "T" if i + 1 in TEACHER else "N", "text": t, "start": round(moved(a), 3), "end": round(moved(b), 3)}
         for i, ((a, b), t) in enumerate(zip(PARTS, TEXT))]
end_speech = lines[-1]["end"]
keep = int(round((end_speech + 0.25) * SR))
y = y[:keep]
fo = int(0.04 * SR); y[-fo:] *= np.linspace(1, 0, fo)
y = np.concatenate([y, np.zeros(int(round((TAIL - 0.25) * SR)))])
dur = len(y) / SR
sf.write(P("audio", "voiceover.wav"), y.astype(np.float32), SR, subtype="PCM_24")
json.dump({"takes": {"N": "my_voiceover"}, "duration": round(dur, 3), "lines": lines}, open(P("audio", "vo_lines.json"), "w"), indent=1, ensure_ascii=False)
json.dump(words, open(P("audio", "voiceover.words.json"), "w"), indent=0, ensure_ascii=False)
json.dump({"source": "audio/raw/my_voiceover.mp3 (the user's own recording; only silence added in pauses + a tail)",
           "lines": [{"i": l["i"], "who": l["who"], "text": l["text"]} for l in lines]}, open(P("script.json"), "w"), indent=1, ensure_ascii=False)
print(f"voiceover: {dur:.3f} s ({len(x) / SR:.3f} s recording + {sum(EXTRA.values()):.2f} s pauses + tail), {len(lines)} lines, {len(words)} words")
