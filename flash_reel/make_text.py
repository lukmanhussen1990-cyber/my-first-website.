#!/usr/bin/env python3
"""The only text on screen: "POV: your girlfriend texts she's home alone" at the top for the whole first part (until
"drink for me"), white pixel font (Pixelify Sans) with a black outline. (The phone message is drawn on the 3D phone.)"""
import json
B = json.load(open("audio/beats.json"))
def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f"{h}:{m:02d}:{s:05.2f}"
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: POV,Pixelify Sans,84,&H00FFFFFF,&H00FFFFFF,&H00100C0A,&H90000000,-1,0,0,0,100,100,2,0,1,8,4,8,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev = f"Dialogue: 1,{ts(0.0)},{ts(B['drop'] - 0.02)},POV,,0,0,0,,{{\\an8\\pos(540,170)\\fad(150,0)}}POV: your girlfriend\\Ntexts she's home alone\n"
open("audio/captions.ass", "w").write(head + ev)
print("text: POV until", B["drop"], "s -> audio/captions.ass")
