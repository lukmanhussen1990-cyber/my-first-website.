"""One-word-at-a-time captions (ASS) synced to the voiceover.

Word times come from the refined alignment of the voiceover take; each word is
mapped through its sentence clip's placement in the reel (build/timeline.json).
Spelling comes from the script itself.

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
for clip in TL["VO"]:
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

lines = []
for i, ev in enumerate(events):
    nxt = events[i + 1]["s"] if i + 1 < len(events) else None
    end = ev["e"] + 0.3
    if nxt is not None and nxt - ev["e"] < 0.7:
        end = nxt  # continuous speech: hand over to the next word
    elif nxt is not None:
        end = min(end, nxt)
    text = re.sub(r"[.,!?;:]+$", "", ev["text"]).upper()
    width = font.getlength(text)
    k = min(1.0, MAX_W / width) * 100
    pop = (f"{{\\an5\\pos(540,960)\\fscx{k * 0.82:.0f}\\fscy{k * 0.82:.0f}"
           f"\\t(0,70,\\fscx{k * 1.06:.0f}\\fscy{k * 1.06:.0f})\\t(70,140,\\fscx{k:.0f}\\fscy{k:.0f})}}")
    lines.append(f"Dialogue: 0,{ts(ev['s'] - 0.02)},{ts(end)},Word,,0,0,0,,{pop}{text}")

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,11,5,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(B("captions.ass"), "w").write(header + "\n".join(lines) + "\n")
json.dump(events, open(B("caption_words.json"), "w"), indent=1)
print(f"wrote {B('captions.ass')} ({len(lines)} words)")
