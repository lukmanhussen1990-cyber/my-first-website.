#!/usr/bin/env python3
"""Captions in the reference's style: chunky uppercase Lilita One, white with a thick black outline, the words turn
yellow as they are said (karaoke), 2-4 words at a time, centred in the lower middle. Exactly the words that are said
(nothing censored). Reads shots.json + audio/voiceover.words.json -> audio/captions.ass."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(HERE, "shots.json")))
WORDS = json.load(open(os.path.join(HERE, "audio", "voiceover.words.json")))
END = plan["duration"]
chunks = sorted((c for s in plan["shots"] for c in s["captions"]), key=lambda c: c["t"])
# the user's start sound (audio/raw/intro.mp3, before the voiceover) says "Oh fuck. Oh fuck." (heard with faster-whisper,
# word edges from its loudness curve); every word that is said gets a caption
if os.path.exists(os.path.join(HERE, "audio", "raw", "intro.mp3")):
    IW = [("Oh", 0.08, 0.62), ("fuck.", 0.62, 1.45), ("Oh", 1.78, 2.35), ("fuck.", 2.35, 3.3)]
    WORDS = [{"w": w, "s": a, "e": b, "line": 0} for w, a, b in IW] + WORDS
    chunks = [{"t": 0.08, "end": 1.45, "text": "Oh fuck.", "line": 0}, {"t": 1.78, "end": 3.3, "text": "Oh fuck.", "line": 0}] + chunks


def ts(t):
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Lilita One,98,&H002AD8FF,&H00FFFFFF,&H00101010,&H90000000,0,0,0,0,100,100,1,0,1,7.5,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
out = [head]
for i, c in enumerate(chunks):
    nxt = chunks[i + 1]["t"] if i + 1 < len(chunks) else END
    end = min(nxt, max(c["end"] + 0.45, c["t"] + 0.5)) if nxt - c["end"] > 0.9 else nxt
    end = min(end, END)
    ws = [w for w in WORDS if w["line"] == c["line"]]
    k0 = next(j for j, w in enumerate(ws) if abs(w["s"] - c["t"]) < 1e-6 or (j == 0 and abs(c["t"] - ws[0]["s"]) < 0.5))
    words = c["text"].split()
    parts, t = [], c["t"]
    for j, w in enumerate(words):
        nxt_t = ws[k0 + j + 1]["s"] if (j + 1 < len(words) and k0 + j + 1 < len(ws)) else ws[min(k0 + j, len(ws) - 1)]["e"]
        cs = max(1, int(round((nxt_t - t) * 100)))
        parts.append(f"{{\\k{cs}}}{w.upper()}")
        t = nxt_t
    out.append(f"Dialogue: 0,{ts(c['t'])},{ts(end)},Cap,,0,0,0,,{{\\an5\\pos(540,1290)\\fscx86\\fscy86\\t(0,90,\\fscx100\\fscy100)}}{' '.join(parts)}\n")
open(os.path.join(HERE, "audio", "captions.ass"), "w").write("".join(out))
print(f"captions: {len(chunks)} chunks -> audio/captions.ass")
