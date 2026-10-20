"""One-word-at-a-time captions (ASS) synced to the voiceover.

Word times come from the refined alignment of the narrator take; each word is
mapped through its sentence clip's placement in the reel (build/timeline.json).
Spelling comes from the script itself. The boy's closing line is shown whole,
in yellow and a little bigger. Captions sit a little above the middle of the frame.

usage: python tools/captions.py -> build/captions.ass
"""
import json
import os
import re

from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
FONT = os.path.join(ROOT, "assets", "Fredoka-Bold.ttf")
TL = json.load(open(B("timeline.json")))
WORDS = json.load(open(os.path.join(ROOT, "assets", "vo", "take1.refined.json")))

SIZE = 150  # px at 1080x1920
MAX_W = 940  # keep long words inside the frame
POS_Y = 870  # a little above the middle (960)
BOY_SIZE = 178
# the boy's line inside its clip (speech 0.08-1.40 s, see the energy envelope)
BOY_SPEECH = (0.08, 1.40)
font = ImageFont.truetype(FONT, SIZE)


def letters(s):
    return re.sub(r"[^a-z']", "", s.lower())


def ts(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


events = []
wi = 0
boy = None
for clip in TL["VO"]:
    if clip.get("voice") == "boy":
        boy = {"text": clip["text"], "s": clip["at"] + BOY_SPEECH[0], "e": clip["at"] + BOY_SPEECH[1]}
        continue
    a, b = clip["src"]
    script_words = clip["text"].split()
    for sw in script_words:
        w = WORDS[wi]
        assert letters(w["w"]) == letters(sw), (w, sw)
        assert a - 0.05 <= w["s"] <= b, (w, clip)
        start = clip["at"] + (w["s"] - a)
        end = clip["at"] + (w["e"] - a)
        events.append({"text": sw, "s": start, "e": end})
        wi += 1
assert wi == len(WORDS)

# nudge words that start in silence (leading pause, stop-consonant closure) to
# their audible onset in the assembled voice track (max 0.15 s)
try:
    import numpy as np
    import soundfile as sf

    vo, sr = sf.read(B("audio", "vo.wav"))
    vo = vo[:, 0] if vo.ndim > 1 else vo

    def level(t, win=0.02):
        seg = vo[max(0, int(t * sr)) : int((t + win) * sr)]
        return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) else -120

    for ev in events:
        if level(ev["s"], 0.06) < -45:
            for k in range(1, 16):
                if level(ev["s"] + k * 0.01) > -38:
                    ev["s"] += k * 0.01
                    break
except FileNotFoundError:
    pass

LEAD = 0.02  # show each word a hair before it is heard
MIN_ON = 0.125  # at least 3 frames on screen
spans = []
for i, ev in enumerate(events):
    start = ev["s"] - LEAD
    nxt = events[i + 1]["s"] - LEAD if i + 1 < len(events) else None
    end = ev["e"] + 0.3
    if nxt is not None and nxt - ev["e"] < 0.7:
        end = nxt  # continuous speech: hand over exactly at the next word (never overlap)
    elif nxt is not None:
        end = min(end, nxt)
    spans.append([start, end])
# borrow a little time from the following word so quick words stay readable
for i in range(len(spans) - 1):
    a, b = spans[i], spans[i + 1]
    short = MIN_ON - (a[1] - a[0])
    if short > 0 and abs(a[1] - b[0]) < 1e-9:
        shift = min(short, max(0.0, (b[1] - b[0]) - MIN_ON))
        a[1] += shift
        b[0] += shift
# ...or from the pause / word before them
for i in range(1, len(spans)):
    p, a = spans[i - 1], spans[i]
    short = MIN_ON - (a[1] - a[0])
    if short <= 0:
        continue
    gap = a[0] - p[1]
    if gap > 1e-9:
        a[0] -= min(short, gap, 0.08)
    else:
        shift = min(short, max(0.0, (p[1] - p[0]) - MIN_ON))
        p[1] -= shift
        a[0] -= shift
def pop_tags(k, extra=""):
    return (f"{{\\an5\\pos(540,{POS_Y}){extra}\\fscx{k * 0.82:.0f}\\fscy{k * 0.82:.0f}"
            f"\\t(0,70,\\fscx{k * 1.06:.0f}\\fscy{k * 1.06:.0f})\\t(70,140,\\fscx{k:.0f}\\fscy{k:.0f})}}")


def soft_shadow(k, extra=""):
    # blurred dark copy, offset down-right, under the outlined word
    return (f"{{\\an5\\pos(546,{POS_Y + 9}){extra}\\bord8\\shad0\\blur9\\1c&H000000&\\3c&H000000&\\alpha&H90&"
            f"\\fscx{k * 0.82:.0f}\\fscy{k * 0.82:.0f}\\t(0,70,\\fscx{k * 1.06:.0f}\\fscy{k * 1.06:.0f})\\t(70,140,\\fscx{k:.0f}\\fscy{k:.0f})}}")


lines = []
for ev, (start, end) in zip(events, spans):
    text = re.sub(r"[.,!?;:]+$", "", ev["text"]).upper()
    width = font.getlength(text)
    k = min(1.0, MAX_W / width) * 100
    lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Word,,0,0,0,,{soft_shadow(k)}{text}")
    lines.append(f"Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{pop_tags(k)}{text}")
if boy:
    text = boy["text"].upper()  # "HI, AUNTY..." - punctuation kept, it is the line
    big = ImageFont.truetype(FONT, BOY_SIZE)
    k = min(1.0, MAX_W / big.getlength(text)) * 100
    start, end = boy["s"] - LEAD, boy["e"] + 0.45
    lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Boy,,0,0,0,,{soft_shadow(k)}{text}")
    lines.append(f"Dialogue: 1,{ts(start)},{ts(end)},Boy,,0,0,0,,{pop_tags(k)}{text}")
    events.append(boy)

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,11,0,5,40,40,0,1
Style: Boy,Fredoka,{BOY_SIZE},&H0026D8FF,&H0026D8FF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,12,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(B("captions.ass"), "w").write(header + "\n".join(lines) + "\n")
json.dump(events, open(B("caption_words.json"), "w"), indent=1)
print(f"wrote {B('captions.ass')} ({len(lines)} words)")
