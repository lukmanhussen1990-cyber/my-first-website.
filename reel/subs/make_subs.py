"""Word-by-word burned-in subtitles (ASS) for the reel.

Input: build/mix_plan.json (written by export.py: absolute start/end of every word, per line).
Output: build/subs.ass. One word at a time, Fredoka Bold, white with a thick black outline and a soft
blurred shadow; each word pops in with a tiny bounce. Grandpa's line is yellow and a little bigger.

    python subs/make_subs.py
"""
import json
from pathlib import Path

from PIL import ImageFont

REEL = Path(__file__).resolve().parent.parent
FONT = REEL / "assets" / "fonts" / "Fredoka-Bold.ttf"
PLAN = REEL / "build" / "mix_plan.json"
OUT = REEL / "build" / "subs.ass"

# ---- layout (1080x1920): centred a little above the middle, clear of IG's right-hand buttons and bottom 20%
POS_X = 515          # slightly left of centre
POS_Y = 690          # ~36% from the top
MAX_W = 740          # widest a word may get (px)
SIZE_NARR = 108
SIZE_GRANDPA = 124
OUTLINE = 9
SHADOW_OFF = 8
COL_NARR = "&H00FFFFFF"
COL_GRANDPA = "&H0030D8FF"    # #FFD830 (ASS is BGR)
HOLD_GAP = 0.35      # if the next word is further away than this, hide after end + 0.25 s
TAIL = 0.35          # last word of a line lingers


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def word_scale(word, size):
    f = ImageFont.truetype(str(FONT), size)
    w = f.getlength(word) + 2 * OUTLINE
    return min(1.0, MAX_W / w)


def build(plan):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr,Fredoka,{SIZE_NARR},{COL_NARR},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,{OUTLINE},0,5,0,0,0,1
Style: Grandpa,Fredoka,{SIZE_GRANDPA},{COL_GRANDPA},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,{OUTLINE + 1},0,5,0,0,0,1
Style: Shadow,Fredoka,{SIZE_NARR},&H00000000,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,{OUTLINE + 2},0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    lines = plan["lines"]
    for li, line in enumerate(lines):
        words = line["words"]
        grandpa = line["speaker"] == "grandpa"
        style = "Grandpa" if grandpa else "Narr"
        size = SIZE_GRANDPA if grandpa else SIZE_NARR
        next_line_start = lines[li + 1]["start"] if li + 1 < len(lines) else 1e9
        for wi, w in enumerate(words):
            st = w["start"]
            if wi + 1 < len(words):
                nx = words[wi + 1]["start"]
                en = nx if nx - w["end"] <= HOLD_GAP else w["end"] + 0.25
            else:
                en = min(w["end"] + TAIL, next_line_start - 0.05)
            en = max(en, st + 0.12)
            k = word_scale(w["word"], size)
            s0, s1, s2 = int(62 * k), int(112 * k), int(100 * k)
            pop = f"\\fscx{s0}\\fscy{s0}\\t(0,90,\\fscx{s1}\\fscy{s1})\\t(90,170,\\fscx{s2}\\fscy{s2})"
            text = w["word"].replace("{", "(").replace("}", ")")
            shadow = f"{{\\an5\\pos({POS_X},{POS_Y + SHADOW_OFF})\\blur10\\fs{size}\\1a&H60&\\3a&H60&\\fad(40,0){pop}}}{text}"
            main = f"{{\\an5\\pos({POS_X},{POS_Y})\\fad(40,0){pop}}}{text}"
            ev.append(f"Dialogue: 0,{ts(st)},{ts(en)},Shadow,,0,0,0,,{shadow}")
            ev.append(f"Dialogue: 1,{ts(st)},{ts(en)},{style},,0,0,0,,{main}")
    return head + "\n".join(ev) + "\n"


def main():
    plan = json.loads(PLAN.read_text())
    OUT.write_text(build(plan), encoding="utf-8")
    n = sum(len(l["words"]) for l in plan["lines"])
    print(f"wrote {OUT} ({n} words)")


if __name__ == "__main__":
    main()
