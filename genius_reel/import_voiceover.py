#!/usr/bin/env python3
"""Use ElevenLabs take narr_A as it is, with one short extra pause the brief asks for: before "One billion views.". Silence is inserted in the middle of the existing pause (real silence, nothing of the voice is cut).
A short tail of silence is added after the last word for the ending shot (house + stink lines + slow zoom out).

Reads:  audio/raw/user_voiceover.mp3, audio/raw/user_voiceover.words.json (stt_words.py), script.json
Writes: audio/voiceover.wav (48 kHz mono 24-bit) + .mp3, audio/vo_lines.json, audio/voiceover.words.json
Line start/end are refined on the audio: the first / last 5 ms frame above the silence level near the STT time.
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
SRC = P("audio", "raw", "narr_A.mp3")
SCRIPT = json.load(open(P("script.json")))["lines"]
STT = json.load(open(P("audio", "raw", "narr_A.words.json")))
EXTRA = {24: 0.35}               # line -> extra silence (s) inserted in the pause before it ("One billion views.")
TAIL = 1.7                        # silence after the last word (fanfare on the ending shot)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


x = decode(SRC)
# words -> script lines (the STT heard exactly the script's 138 words, in order)
words, k = [], 0
for L in SCRIPT:
    toks = L["text"].split()
    seg = STT[k:k + len(toks)]
    k += len(toks)
    for t, s in zip(toks, seg):
        words.append({"w": t, "s": s["s"], "e": s["e"], "line": L["i"]})
assert k == len(STT), (k, len(STT))

# insert the extra silences (in the middle of the existing pause) and shift the times after them
pieces, cur, shift = [], 0, 0.0
shifts = []                                        # (time in the original, added seconds)
for li, add in sorted(EXTRA.items()):
    prev_end = max(w["e"] for w in words if w["line"] == li - 1)
    nxt = min(w["s"] for w in words if w["line"] == li)
    # cut at the quietest 10 ms of the pause, with 15 ms fades on both sides of the inserted silence
    g0, g1 = int((prev_end + 0.06) * SR), int((nxt - 0.06) * SR)
    win = int(0.01 * SR)
    rms = [np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(g0, g1 - win, win // 2)]
    cut = g0 + int(np.argmin(rms)) * (win // 2) + win // 2
    f = int(0.015 * SR)
    x = x.copy()
    x[cut - f:cut] *= np.linspace(1, 0, f)
    x[cut:cut + f] *= np.linspace(0, 1, f)
    print(f"pause before line {li}: {nxt - prev_end:.2f} s -> {nxt - prev_end + add:.2f} s "
          f"(cut at {cut / SR:.2f} s, level there {20 * np.log10(min(rms) + 1e-9):.0f} dBFS)")
    pieces += [x[cur:cut], np.zeros(int(round(add * SR)))]
    cur = cut
    shifts.append((cut / SR, add))
pieces.append(x[cur:])
y = np.concatenate(pieces)


def moved(t):
    return t + sum(a for (c, a) in shifts if t >= c)


for w in words:
    w["s"], w["e"] = round(moved(w["s"]), 3), round(moved(w["e"]), 3)
end_speech = max(w["e"] for w in words)
y = np.concatenate([y[:int(round((end_speech + 0.3) * SR))], np.zeros(int(round((TAIL - 0.3) * SR)))])
fo = int(0.05 * SR)
y[int(round((end_speech + 0.3) * SR)) - fo:int(round((end_speech + 0.3) * SR))] *= np.linspace(1, 0, fo)
# quicker and punchier, like the semi-genius references: 8 % faster, same pitch (rubberband)
SPEED = 1.08
import tempfile
with tempfile.TemporaryDirectory() as td:
    sf.write(os.path.join(td, "a.wav"), y.astype(np.float32), SR, subtype="FLOAT")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(td, "a.wav"), "-af",
                    f"rubberband=tempo={SPEED}:pitchq=quality:transients=crisp", os.path.join(td, "b.wav")], check=True)
    y, _ = sf.read(os.path.join(td, "b.wav"), dtype="float64")
for w in words:
    w["s"], w["e"] = round(w["s"] / SPEED, 3), round(w["e"] / SPEED, 3)
dur = len(y) / SR

# refine line starts / ends on the audio envelope (5 ms frames)
hop = int(0.005 * SR)
nf = len(y) // hop
db = 20 * np.log10(np.sqrt(np.mean(y[:nf * hop].reshape(nf, hop) ** 2, axis=1)) + 1e-9)
db = np.convolve(db, np.ones(3) / 3, mode="same")
thr = np.percentile(db, 97) - 38
lines = []
for L in SCRIPT:
    ws = [w for w in words if w["line"] == L["i"]]
    s, e = ws[0]["s"], ws[-1]["e"]
    a, b = max(0, int((s - 0.2) / 0.005)), int((s + 0.12) / 0.005)
    quiet = [i for i in range(a, b) if db[i] < thr]
    if quiet:
        s2 = (quiet[-1] + 1) * 0.005
        if abs(s2 - s) < 0.2:
            s = s2
    a, b = int((e - 0.12) / 0.005), min(nf - 1, int((e + 0.25) / 0.005))
    quiet = [i for i in range(a, b) if db[i] < thr]
    if quiet:
        e2 = quiet[0] * 0.005
        if abs(e2 - e) < 0.25 and e2 > s + 0.1:
            e = e2
    ws[0]["s"] = round(min(ws[0]["s"], s), 3)
    lines.append({"i": L["i"], "who": "N", "text": L["text"], "start": round(s, 3), "end": round(e, 3)})
for a, b in zip(lines, lines[1:]):                  # lines that run together share the boundary
    if b["start"] < a["end"]:
        b["start"] = a["end"] = round((a["end"] + b["start"]) / 2, 3)

os.makedirs(P("audio"), exist_ok=True)
sf.write(P("audio", "voiceover.wav"), y.astype(np.float32), SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", P("audio", "voiceover.wav"), "-c:a", "libmp3lame", "-b:a", "160k",
                P("audio", "voiceover.mp3")], check=True)
json.dump({"takes": {"N": "narr_A"}, "duration": round(dur, 2), "lines": lines},
          open(P("audio", "vo_lines.json"), "w"), indent=1, ensure_ascii=False)
json.dump([{"w": w["w"], "s": w["s"], "e": w["e"], "line": w["line"]} for w in words],
          open(P("audio", "voiceover.words.json"), "w"), indent=0, ensure_ascii=False)
for L in lines:
    print(f"{L['i']:2d} {L['start']:6.2f}-{L['end']:6.2f}  {L['text']}")
print(f"voiceover: {dur:.2f} s -> audio/voiceover.wav")
