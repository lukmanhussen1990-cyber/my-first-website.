"""Timeline date labels (DAY 1, MONTH 3, YEAR 1, 50 YEARS LATER) -> appended to audio/captions.ass.

A label pops in at the start of its shot (top-left corner, white Pixelify Sans on a dark rounded-looking box) and
stays until the next timeline moment begins (Paris replaces DAY 1, ...). Run after make_captions.py:
    python3 add_labels.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASS = os.path.join(HERE, "audio", "captions.ass")
SH = json.load(open(os.path.join(HERE, "shots.json")))
FPS = 30


def ts(t):
    k = int(round(t * 100))
    return f"{k // 360000}:{(k // 6000) % 60:02d}:{(k // 100) % 60:02d}.{k % 100:02d}"


def main():
    s = open(ASS).read()
    # drop labels from an earlier run
    s = "\n".join(l for l in s.splitlines() if ",Label," not in l and not l.startswith("Style: Label")) + "\n"
    style = ("Style: Label,Pixelify Sans,62,&H00FFFFFF,&H00FFFFFF,&H00101216,&H80101216,-1,0,0,0,100,100,2,0,3,14,0,7,40,40,0,1")
    s = s.replace("\n[Events]", style + "\n\n[Events]", 1) if "Style: Label" not in s else s
    shots = SH["shots"]
    lab = [(o["t0"], o["label"]) for o in shots if o.get("label")]
    # each label lasts until the next timeline moment (or until the shot after the 50-year label ends)
    ends = [lab[i + 1][0] for i in range(len(lab) - 1)] + [None]
    lines = []
    for (t0, text), t1 in zip(lab, ends):
        if t1 is None:  # last label: 3 shots
            i = next(k for k, o in enumerate(shots) if abs(o["t0"] - t0) < 1e-6)
            t1 = shots[min(i + 2, len(shots) - 1)]["t1"]
        # timeline labels stay only over their own moment: cut 1 frame before the next moment starts
        t1 = min(t1, t1)
        tag = "{\\an7\\pos(56,210)\\fscx70\\fscy70\\t(0,120,\\fscx100\\fscy100)}"
        lines.append(f"Dialogue: 2,{ts(t0 + 0.04)},{ts(t1 - 1 / FPS)},Label,,0,0,0,,{tag}{text}")
    s = s.rstrip("\n") + "\n" + "\n".join(lines) + "\n"
    open(ASS, "w").write(s)
    for l in lines:
        print(l)


if __name__ == "__main__":
    main()
