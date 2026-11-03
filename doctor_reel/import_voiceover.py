#!/usr/bin/env python3
"""Use the user's own recording (audio/raw/my_voiceover.mp3) exactly as it is: no new voice, no speed change, no
cuts, no added silence. It is only decoded to a 48 kHz WAV for the mix, so the video length = the voiceover length.
Word timing: faster-whisper (local, free) run on each of the 40 speech parts separately (the parts are found from the
pauses in the audio), which keeps every word time exact (audio/raw/my_voiceover.parts.json).
Writes audio/voiceover.wav, audio/vo_lines.json (one line per speech part), audio/voiceover.words.json, script.json."""
import json
import os
import subprocess

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
SR = 48000
PARTS = json.load(open(P("audio", "raw", "my_voiceover.parts.json")))
SPANS = [(0.07, 1.57), (1.98, 4.27), (4.60, 6.37), (6.81, 8.59), (9.08, 9.99), (10.48, 11.58), (11.99, 12.67), (13.04, 14.21),
         (14.66, 16.47), (16.79, 17.31), (17.68, 18.46), (18.88, 19.74), (20.27, 21.33), (21.90, 22.33), (22.87, 23.41),
         (23.90, 24.34), (24.92, 25.35), (25.77, 27.25), (27.59, 28.23), (28.71, 30.36), (30.83, 31.86), (32.27, 32.99),
         (33.28, 34.08), (34.41, 35.22), (35.50, 37.40), (37.79, 38.71), (39.07, 39.81), (40.22, 40.63), (40.95, 41.72),
         (42.03, 42.71), (42.97, 44.55), (45.09, 45.82), (46.26, 48.63), (48.98, 49.43), (49.75, 50.75), (51.17, 52.28),
         (52.74, 53.21), (53.44, 54.27), (54.64, 55.29), (55.57, 56.32)]
# the words as they should appear on screen (what the STT heard, with the script's punctuation; loud lines in CAPS)
TEXT = ["You're staying at your friend's house.", "And you haven't pooped in five days.", "Your stomach is a balloon.",
        "Your friend's mom thinks you're pregnant.", "You go to the doctor.", "He presses your stomach.", "Hmm.",
        "Very serious.", "He gives you the strongest medicine.", "Take one.", "ONLY ONE.", "You take three.",
        "You sit in the waiting room.", "Nothing.", "One minute.", "Nothing.", "Then…", "Your stomach starts talking.",
        "LOUD.", "Everyone in the waiting room looks at you.", "You run to the toilet.", "There's a line.", "Ten people.",
        "You can't wait!", "PLEASE! IT'S AN EMERGENCY!", "The door opens.", "It's the doctor.", "Then…", "It happens.",
        "Right there.", "On the doctor's new shoes.", "Silence.", "The waiting room is empty in three seconds.", "Well…",
        "The medicine works!", "Then he writes your bill.", "Treatment:", "$50.", "New shoes:", "$500."]
LOUD = {11, 19, 25}            # 1-based lines said loud (BIG CAPS + a small screen shake)

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", P("audio", "raw", "my_voiceover.mp3"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
sf.write(P("audio", "voiceover.wav"), x, SR, subtype="PCM_24")
dur = len(x) / SR

lines, words = [], []
for i, ((a, b), text) in enumerate(zip(SPANS, TEXT)):
    toks = text.split()
    heard = [w for w in PARTS if w["part"] == i]
    if len(heard) != len(toks):        # "$50" / "500" etc.: one heard word per shown word, spread over the part
        heard = [{"s": a + (b - a) * k / len(toks), "e": a + (b - a) * (k + 1) / len(toks)} for k in range(len(toks))]
    for t, h in zip(toks, heard):
        words.append({"w": t, "s": round(max(a, h["s"]), 3), "e": round(min(b, max(h["e"], h["s"] + 0.05)), 3), "line": i + 1})
    lines.append({"i": i + 1, "who": "Y" if i + 1 in LOUD else "N", "text": text, "start": a, "end": b})
json.dump({"takes": {"N": "my_voiceover"}, "duration": round(dur, 3), "lines": lines}, open(P("audio", "vo_lines.json"), "w"), indent=1, ensure_ascii=False)
json.dump(words, open(P("audio", "voiceover.words.json"), "w"), indent=0, ensure_ascii=False)
json.dump({"source": "audio/raw/my_voiceover.mp3 (the user's own recording, used unchanged)",
           "lines": [{"i": l["i"], "who": l["who"], "text": l["text"]} for l in lines]}, open(P("script.json"), "w"), indent=1, ensure_ascii=False)
print(f"voiceover: {dur:.3f} s (unchanged), {len(lines)} lines, {len(words)} words")
