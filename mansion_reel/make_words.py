#!/usr/bin/env python3
"""Adds the reference-style overlays to audio/captions.ass (run after make_captions.py):
  - big comic sound words (KNOCK KNOCK!, MWAH!, BA-DUM!, PLOP! ...): yellow fill, thick red outline, a dark soft
    shadow, a little bounce (pop 30% -> 120% -> 100%) and a slight tilt;
  - timeline labels ("DAY 2", "DAY 365", "5 YEARS LATER", "EMERGENCY") in big white boxes, upper part of the frame.
Times come from events.py (the same moments as the sounds and camera hits)."""
import os
from events import T, shot, line

HERE = os.path.dirname(os.path.abspath(__file__))
ASS = os.path.join(HERE, "audio", "captions.ass")
FONT = "Inter Display Black"


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


STYLES = [
    "Style: Word,{f},120,&H0020D2FF,&H0020D2FF,&H002A20E8,&H90000000,-1,0,0,0,100,100,2,0,1,9,0,5,0,0,0,1",
    "Style: WordShadow,{f},120,&H70000000,&H70000000,&H70000000,&HFF000000,-1,0,0,0,100,100,2,0,1,14,0,5,0,0,0,1",
    "Style: Label,{f},92,&H00141414,&H00141414,&H00FFFFFF,&H50000000,-1,0,0,0,100,100,3,0,3,26,8,8,0,0,0,1",
]
# (text, start, end, x, y, tilt, scale, colour override)
WORDS = [
    ("RUMBLE!", T["rumble"], shot(2)[1], 700, 1500, -8, 0.9, None),
    ("KNOCK KNOCK!", T["knocks1"][0], shot(10)[1], 560, 560, 6, 0.95, None),
    ("SLAM!", T["slam"], shot(13)[1], 540, 640, -6, 1.3, None),
    ("KNOCK KNOCK!", T["knocks2"][0], shot(14)[1], 540, 520, -7, 1.25, None),
    ("MWAH!", T["kiss"], shot(24)[1], 560, 560, -8, 1.3, "&H00B060FF"),
    ("BA-DUM!", T["hearts1"], shot(25)[1], 540, 420, 6, 1.0, "&H003A30F0"),
    ("PLOP!", T["plop"], shot(28)[1], 540, 820, -6, 1.5, None),
    ("BA-DUM!", T["heart_stairs"] + 0.1, shot(32)[1], 560, 380, -6, 1.0, "&H003A30F0"),
    ("Zzz", T["zzz"] + 0.15, shot(41)[1], 700, 640, 10, 1.0, "&H00FFE8C8"),
    ("BA-DUM!", T["hearts_couch"] + 0.4, shot(45)[1], 540, 400, 7, 1.0, "&H003A30F0"),
    ("BA-DUM!", T["love2"], shot(52)[1], 540, 380, -6, 1.1, "&H003A30F0"),
    ("BLING!", T["diamond"] + 0.15, shot(59)[1], 720, 520, 8, 1.1, None),
    ("CLAP CLAP!", T["wedding"] + 0.05, shot(61)[1], 540, 470, -5, 0.9, None),
    ("BA-DUM!", T["love4"] + 0.1, shot(68)[1], 540, 400, 6, 1.0, "&H003A30F0"),
]
LABELS = [
    ("EMERGENCY", T["bad"] - 0.1, shot(3)[1], "&H002A20E8"),
    ("DAY 2", T["day2"], shot(33)[1], None), ("DAY 30", T["day30"], shot(36)[1], None),
    ("DAY 60", T["day60"], shot(39)[1], None), ("DAY 100", T["day100"], shot(46)[1], None),
    ("DAY 200", T["day200"], shot(48)[1], None), ("DAY 365", T["day365"], shot(54)[1], None),
    ("5 YEARS LATER", T["years5"], shot(62)[1], None),
]


def main():
    s = open(ASS, encoding="utf-8").read()
    assert "Style: Word," not in s, "run make_captions.py first (captions.ass already has the words)"
    s = s.replace("\n[Events]", "\n" + "\n".join(x.format(f=FONT) for x in STYLES) + "\n\n[Events]", 1)
    ev = []
    for text, a, b, x, y, tilt, k, col in WORDS:
        k100 = int(100 * k)
        bounce = (f"\\fscx{int(30 * k)}\\fscy{int(30 * k)}\\t(0,110,\\fscx{int(122 * k)}\\fscy{int(122 * k)})"
                  f"\\t(110,230,\\fscx{k100}\\fscy{k100})\\t(230,330,\\fscx{int(108 * k)}\\fscy{int(108 * k)})\\t(330,430,\\fscx{k100}\\fscy{k100})")
        if text == "BA-DUM!":       # a heartbeat: two quick pulses, again and again
            bounce += "".join(f"\\t({500 + i * 700},{580 + i * 700},\\fscx{int(118 * k)}\\fscy{int(118 * k)})\\t({580 + i * 700},{660 + i * 700},\\fscx{k100}\\fscy{k100})"
                              f"\\t({720 + i * 700},{790 + i * 700},\\fscx{int(112 * k)}\\fscy{int(112 * k)})\\t({790 + i * 700},{860 + i * 700},\\fscx{k100}\\fscy{k100})" for i in range(3))
        c = f"\\1c{col}" if col else ""
        ev.append(f"Dialogue: 2,{ts(a)},{ts(b)},WordShadow,,0,0,0,,{{\\an5\\pos({x + 8},{y + 10})\\frz{tilt}\\blur10{bounce}}}{text}")
        ev.append(f"Dialogue: 3,{ts(a)},{ts(b)},Word,,0,0,0,,{{\\an5\\pos({x},{y})\\frz{tilt}{c}{bounce}}}{text}")
    for text, a, b, col in LABELS:
        c = f"\\1c{col}" if col else ""
        ev.append(f"Dialogue: 4,{ts(a)},{ts(b)},Label,,0,0,0,,{{\\an8\\pos(540,250){c}\\fscx40\\fscy40\\t(0,120,\\fscx112\\fscy112)\\t(120,220,\\fscx100\\fscy100)}}{text}")
    open(ASS, "w", encoding="utf-8").write(s.rstrip("\n") + "\n" + "\n".join(ev) + "\n")
    print(f"words: {len(WORDS)} comic words + {len(LABELS)} labels -> audio/captions.ass")


if __name__ == "__main__":
    main()
