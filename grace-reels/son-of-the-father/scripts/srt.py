#!/usr/bin/env python3
"""Subtitles from timeline.json (every spoken word, as shown on screen) -> out/subtitles.srt + out/subtitles.vtt.
Cues follow the sentences, split at commas/ellipses so a cue is at most 2 lines of ~38 characters.
usage: python3 scripts/srt.py [out_dir]"""
import json, os, re, sys

T = json.load(open("timeline.json"))
out = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(out, exist_ok=True)
MAXC, MAXLINE = 76, 38

def ts(t, sep):
    ms = int(round(max(0.0, t) * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"

def wrap(words):
    text = " ".join(words)
    if len(text) <= MAXLINE: return text
    best = min(range(1, len(words)), key=lambda i: abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))))
    return " ".join(words[:best]) + "\n" + " ".join(words[best:])

# group words: by sentence, then split long sentences at punctuation (or at the length limit)
cues, cur = [], []
W = T["words"]
for i, w in enumerate(W):
    cur.append(w)
    nxt = W[i + 1] if i + 1 < len(W) else None
    text = " ".join(x["w"] for x in cur)
    end_sentence = nxt is None or nxt["sentence"] != w["sentence"]
    soft = re.search(r"[,;:…]$|\.\.\.$", w["w"]) and len(text) > 24
    too_long = nxt is not None and len(text + " " + nxt["w"]) > MAXC
    if end_sentence or soft or too_long:
        cues.append(cur); cur = []
srt, vtt = [], ["WEBVTT", ""]
for k, c in enumerate(cues):
    t0 = c[0]["start"]
    nxt0 = cues[k + 1][0]["start"] if k + 1 < len(cues) else c[-1]["end"] + 1.2
    t1 = min(max(c[-1]["end"] + 0.35, t0 + 1.0), nxt0 - 0.04)
    text = wrap([x["w"] for x in c])
    srt += [str(k + 1), f"{ts(t0, ',')} --> {ts(t1, ',')}", text, ""]
    vtt += [f"{ts(t0, '.')} --> {ts(t1, '.')}", text, ""]
open(os.path.join(out, "subtitles.srt"), "w").write("\n".join(srt))
open(os.path.join(out, "subtitles.vtt"), "w").write("\n".join(vtt))
n = sum(len(c) for c in cues)
assert n == len(W), (n, len(W))
print(f"{len(cues)} cues, {n}/{len(W)} words -> {out}/subtitles.srt, {out}/subtitles.vtt")
