#!/usr/bin/env python3
"""Captions: white Nunito Black (the words exactly as said, nothing censored) with a soft black outline and shadow, centred in the
lower middle (y = 72% of the frame), 2-4 words at a time, exactly the words that are said. Each chunk appears on its
first word (a small pop) and stays until the next chunk starts (or a moment after its last word).
Reads shots.json (plan.py) -> writes audio/captions.ass (burned in by make_reel.sh with fontsdir=fonts)."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(HERE, "shots.json")))
END = plan["duration"]
chunks = sorted((c for s in plan["shots"] for c in s["captions"]), key=lambda c: c["t"])


def ts(t):
    t = max(0.0, t)
    h, m = int(t // 3600), int(t % 3600 // 60)
    return f"{h}:{m:02d}:{t % 60:05.2f}"


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Nunito Black,102,&H00FFFFFF,&H00FFFFFF,&H00141414,&H78000000,0,0,0,0,100,100,0,0,1,6.5,3.5,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
out = [head]
for i, c in enumerate(chunks):
    nxt = chunks[i + 1]["t"] if i + 1 < len(chunks) else END
    end = min(nxt, max(c["end"] + 0.45, c["t"] + 0.5)) if nxt - c["end"] > 0.9 else nxt
    end = min(end, END)
    txt = c["text"].replace("…", "...")
    out.append(f"Dialogue: 0,{ts(c['t'])},{ts(end)},Cap,,0,0,0,,{{\\an5\\pos(540,1385)\\blur1.5\\fscx86\\fscy86\\t(0,90,\\fscx100\\fscy100)}}{txt}\n")
open(os.path.join(HERE, "audio", "captions.ass"), "w").write("".join(out))
print(f"captions: {len(chunks)} chunks -> audio/captions.ass")
