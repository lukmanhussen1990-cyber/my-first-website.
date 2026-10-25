"""Word-by-word subtitles (burned in with libass).

    python subs/make_ass.py          # reads build/voice_layout.json -> build/subs.ass

One word at a time, timed to the voice. Big, bold, white rounded font (Fredoka)
with a thick black outline and a soft shadow; each word pops in with a tiny bounce.
Placed a little above the middle, away from the bottom 20% and the right edge
(Instagram's buttons). Long words shrink to fit.
"""
import json
import os

from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "fonts", "Fredoka-Bold.ttf")
W, H = 1080, 1920
CX, CY = 520, 700          # centre of the word: 36% from the top, nudged left of centre
MAX_W = 760                # widest a word may get (keeps clear of the right edge)
SIZE = 150                 # base font size (px)
LEAD = 0.04                # show each word a hair before it is spoken
HOLD = 0.35                # keep the last word of a phrase up this long after it ends


def ts(t):
    t = max(0.0, t)
    h, m = int(t // 3600), int(t % 3600 // 60)
    s = t - h * 3600 - m * 60
    return f"{h}:{m:02d}:{s:05.2f}"


def main():
    lay = json.load(open(os.path.join(ROOT, "build", "voice_layout.json")))
    words = lay["words"]
    font = ImageFont.truetype(FONT, SIZE)
    out = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Word,Fredoka,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,12,0,5,0,0,0,1",
        f"Style: Shadow,Fredoka,{SIZE},&H00000000,&H00000000,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,17,0,5,0,0,0,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for i, w in enumerate(words):
        start = w["start"] - LEAD
        nxt = words[i + 1]["start"] - LEAD if i + 1 < len(words) else None
        end = w["end"] + HOLD
        if nxt is not None:
            end = nxt if nxt - w["end"] < 0.6 else min(end, nxt)   # back-to-back within a phrase
        width = font.getlength(w["text"]) + 2 * 12
        fs = SIZE if width <= MAX_W else int(SIZE * MAX_W / width)
        pop = r"\fscx72\fscy72\t(0,90,\fscx112\fscy112)\t(90,180,\fscx100\fscy100)"
        fade = r"\alpha&HFF&\t(0,60,\alpha&H00&)"
        text = w["text"].replace("{", "(").replace("}", ")")
        # soft shadow layer (blurred, offset), then the crisp word on top
        out.append(f"Dialogue: 0,{ts(start)},{ts(end)},Shadow,,0,0,0,,{{\\pos({CX + 7},{CY + 10})\\fs{fs}\\blur9\\1a&H70&\\3a&H70&{pop}}}{text}")
        out.append(f"Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{{\\pos({CX},{CY})\\fs{fs}\\blur0.6{fade}{pop}}}{text}")
    path = os.path.join(ROOT, "build", "subs.ass")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {path}: {len(words)} words")


if __name__ == "__main__":
    main()
