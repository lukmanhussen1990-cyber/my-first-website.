"""Quick word-by-word subtitles (.ass) for fast previews, burned in with ffmpeg/libass.

Usage: python3 quick_subs.py out.ass [--until SECONDS] [--width 1080 --height 1920]
The final reel draws its own subtitles and labels (scene/overlay); this is only for quick previews.
"""
import argparse, json, os
from common import BUILD


def ts(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--until", type=float, default=1e9)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    a = ap.parse_args()
    timing = json.load(open(os.path.join(BUILD, "timing.json")))
    W, H = a.width, a.height
    fs = round(H * 0.048)
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka Light,{fs},&H00FFFFFF,&H00FFFFFF,&H00201814,&H96000000,1,0,0,0,100,100,0,0,1,{round(fs*0.09)},{round(fs*0.05)},5,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    words = timing["words"]
    lines = []
    for i, w in enumerate(words):
        if w["s"] >= a.until:
            break
        nxt = words[i + 1]["s"] if i + 1 < len(words) else w["e"] + 0.4
        end = min(nxt, w["e"] + 0.45) if nxt - w["e"] > 0.6 else nxt
        text = w["text"]
        if not text.isupper():
            text = text[0].upper() + text[1:]
        col = r"{\c&H3AE0FF&}" if w["key"] else ""
        pop = r"{\fscx78\fscy78\t(0,70,\fscx110\fscy110)\t(70,150,\fscx100\fscy100)}"
        pos = r"{\an5\pos(%d,%d)}" % (W * 0.47, H * 0.42)
        lines.append(f"Dialogue: 0,{ts(w['s'])},{ts(end)},Word,,0,0,0,,{pos}{pop}{col}{text}")
    with open(a.out, "w") as f:
        f.write(head + "\n".join(lines) + "\n")
    print("wrote", a.out, len(lines), "words")


if __name__ == "__main__":
    main()
