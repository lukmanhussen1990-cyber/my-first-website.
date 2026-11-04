#!/usr/bin/env python3
"""Use the user's own recording (audio/raw/my_voiceover.mp3) exactly as it is: no new voice, no speed change, no
cuts, no added silence. It is only decoded to a 48 kHz WAV for the mix, so the video length = the voiceover length.

Word timing: stt_parts.py (faster-whisper, local + free) transcribed each of the 52 speech parts on its own.
The captions show every word exactly as it is said (no censoring): TEXT below is what whisper heard, written with
the script's punctuation; numbers are written the way they are spoken ("Day 365" -> "Day three hundred
sixty-five"), and a number's time is shared by its words. Checked again with medium.en + small.en:
  part 5: "Fuck." (both models hear it) -> shown as said.
  part 12: the leaf-blower noise the user makes: whisper can only spell it as a long vowel ("HAAAAA" / "AHHHHH");
           it is shown with the user's own spelling from the script: "VRRRRR!".
Writes audio/voiceover.wav, audio/vo_lines.json (one line per speech part), audio/voiceover.words.json, script.json.
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
TEXT = ["You've been jerking off the salt for two minutes.", "And nothing's coming out.", "So you slap its ass.", "Nothing.",
        "Then all of it at once.", "Fuck.", "So next time, you poke every hole with a needle.", "One hole at a time.",
        "Forty minutes.", "Your fries are fucking cold!", "So you hook the shaker up to a leaf blower.",
        "You turn it all the way up.", "VRRRRR!", "BOOM!", "All over you.", "You're a fucking genius!"]
NUM = {"40": ["forty"], "haaaaa": ["vrrrrr"]}
norm = lambda w: re.sub(r"[^a-z0-9'\-]", "", w.lower().replace("’", "'").replace("é", "e"))
assert len(TEXT) == len(PARTS), (len(TEXT), len(PARTS))

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", P("audio", "raw", "my_voiceover.mp3"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
sf.write(P("audio", "voiceover.wav"), x, SR, subtype="PCM_24")
dur = len(x) / SR

lines, words, warn = [], [], 0
for i, ((a, b), text) in enumerate(zip(PARTS, TEXT)):
    toks = text.split()
    units = []                                          # (word, s, e) with numbers split into their spoken words
    for h in [w for w in HEARD if w["part"] == i]:
        key = norm(h["w"]).strip("-")
        parts = NUM.get(key, [key])
        n = len(parts)
        for k, p in enumerate(parts):
            units.append((p, h["s"] + (h["e"] - h["s"]) * k / n, h["s"] + (h["e"] - h["s"]) * (k + 1) / n))
    if [u[0] for u in units] != [norm(t) for t in toks]:
        print(f"  part {i}: heard {[u[0] for u in units]} vs shown {[norm(t) for t in toks]}")
    if len(units) != len(toks):
        warn += 1
        units = [(t, a + (b - a) * k / len(toks), a + (b - a) * (k + 1) / len(toks)) for k, t in enumerate(toks)]
    for k, (t, (_, s, e)) in enumerate(zip(toks, units)):
        s = a if k == 0 else max(a, s)                  # the first word starts where the sound starts
        words.append({"w": t, "s": round(s, 3), "e": round(min(b, max(e, s + 0.05)), 3), "line": i + 1})
    lines.append({"i": i + 1, "who": "N", "text": text, "start": a, "end": b})
json.dump({"takes": {"N": "my_voiceover"}, "duration": round(dur, 3), "lines": lines}, open(P("audio", "vo_lines.json"), "w"), indent=1, ensure_ascii=False)
json.dump(words, open(P("audio", "voiceover.words.json"), "w"), indent=0, ensure_ascii=False)
json.dump({"source": "audio/raw/my_voiceover.mp3 (the user's own recording, used unchanged)",
           "lines": [{"i": l["i"], "who": l["who"], "text": l["text"]} for l in lines]}, open(P("script.json"), "w"), indent=1, ensure_ascii=False)
print(f"voiceover: {dur:.3f} s (unchanged), {len(lines)} lines, {len(words)} words, {warn} parts spread evenly")
