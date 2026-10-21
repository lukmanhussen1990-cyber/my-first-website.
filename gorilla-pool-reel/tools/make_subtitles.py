#!/usr/bin/env python3
"""Word-by-word pop-in subtitles (ASS, burned in with ffmpeg/libass).

Reads output/word_times.json (absolute word times written by build_audio.py).
Words are spelled exactly like the script; only trailing punctuation is dropped.
Placement: centred, a little above the middle (40% of the height), clear of the
bottom 20% and the right-hand edge where Instagram draws its buttons.
"""
import json
from pathlib import Path
from PIL import ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "fonts" / "FredokaReel-Bold.ttf"
W, H = 1080, 1920
CX, CY = 530, int(H * 0.40)       # nudged a little left of centre, away from the IG buttons
SIZE = 138
MAX_W = 760                         # keeps words inside x = 150..910


def ts(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def clean(word):
    return word.rstrip(".,!?;:")


def main():
    words = json.loads((ROOT / "output" / "word_times.json").read_text())
    font = ImageFont.truetype(str(FONT), SIZE)
    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 2",
        "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Word,Fredoka Reel,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,11,0,5,0,0,0,1",
        f"Style: Shadow,Fredoka Reel,{SIZE},&H50000000,&H50000000,&H50000000,&H00000000,-1,0,0,0,100,100,1,0,1,16,0,5,0,0,0,1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for i, w in enumerate(words):
        text = clean(w["text"])
        start = w["start"] - 0.04
        nxt = words[i + 1] if i + 1 < len(words) else None
        if nxt and nxt["line"] == w["line"] and nxt["start"] - w["end"] < 0.6:
            end = nxt["start"] - 0.04
        else:
            end = w["end"] + 0.3
        end = max(end, start + 0.14)
        width = font.getlength(text)
        fs = SIZE if width <= MAX_W else int(SIZE * MAX_W / width)
        anim = r"\fscx45\fscy45\t(0,90,\fscx114\fscy114)\t(90,170,\fscx96\fscy96)\t(170,230,\fscx100\fscy100)"
        lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Shadow,,0,0,0,,{{\\pos({CX},{CY + 9})\\fs{fs}\\blur12{anim}}}{text}")
        lines.append(f"Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{{\\pos({CX},{CY})\\fs{fs}\\blur0.8{anim}}}{text}")
    out = ROOT / "output" / "subtitles.ass"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", out, f"({len(words)} words)")


if __name__ == "__main__":
    main()
