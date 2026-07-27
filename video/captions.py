#!/usr/bin/env python3
"""Emit a WebVTT/SRT caption sidecar from the same cue times the video uses.

Captions are not burned into the picture (the brief asks for no text on screen
beyond the numerals), so they ship alongside as an optional track.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "timeline.json")) as f:
    TL = json.load(f)
with open(os.path.join(HERE, "build", "narration.json")) as f:
    VO = json.load(f)

# clips that should be shown as a single caption
GROUPS = [
    (["l1"], None),
    (["l2"], None),
    (["c1", "c2", "c3", "c4"], "One... Two... Three... Four."),
    (["l3a"], None),
    (["l3b"], None),
    (["l4"], None),
    (["l5"], None),
]


def ts(seconds, sep=","):
    h = int(seconds // 3600)
    m = int(seconds % 3600 // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms == 1000:
        s, ms = s + 1, 0
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def main():
    cues = []
    for ids, override in GROUPS:
        start = TL["vo"][ids[0]]
        end = TL["vo"][ids[-1]] + VO[ids[-1]]["duration"]
        text = override or " ".join(VO[i]["text"] for i in ids)
        cues.append((start, min(end + 0.25, TL["duration"]), text))

    srt = []
    for i, (a, b, text) in enumerate(cues, 1):
        srt.append(f"{i}\n{ts(a)} --> {ts(b)}\n{text}\n")
    with open(os.path.join(HERE, "captions.srt"), "w") as f:
        f.write("\n".join(srt))

    vtt = ["WEBVTT", ""]
    for a, b, text in cues:
        vtt.append(f"{ts(a, '.')} --> {ts(b, '.')}\n{text}\n")
    with open(os.path.join(HERE, "captions.vtt"), "w") as f:
        f.write("\n".join(vtt))

    print(f"wrote captions.srt / captions.vtt ({len(cues)} cues)")


if __name__ == "__main__":
    main()
