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

LEAD = 0.042  # show each word one frame before it is heard
MIN_ON = 0.125  # at least 3 frames on screen
HOLD = 0.3  # a word stays up this long after it ends...
HOLD_FINAL = 0.55  # ...a sentence-final word a little longer
GAP_CLEAR = 0.5  # in continuous speech words hand over without a gap; longer pauses clear the screen
spans = []
for i, ev in enumerate(events):
    start = ev["s"] - LEAD
    nxt = events[i + 1]["s"] - LEAD if i + 1 < len(events) else None
    final = re.search(r"[.?!]$", ev["text"]) is not None
    end = ev["e"] + (HOLD_FINAL if final else HOLD)
    if nxt is not None:
        if nxt - ev["e"] < (0.0 if final else GAP_CLEAR) or end >= nxt:
            end = nxt  # hand over exactly at the next word (never overlap, never flicker)
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


def fit(text, size, max_w=980):
    """x/y scale (%) that fits a word: long words are condensed a little before
    they are shrunk, so CONGRATULATIONS stays big enough to read"""
    w = ImageFont.truetype(FONT, size).getlength(text) + 2 * len(text)
    kx = min(1.0, max_w / w)
    ky = min(1.0, kx + 0.15)
    return kx * 100, ky * 100


def pop(kx, ky, dur_ms, dx=0, dy=0, keys=((0, 0.76), (55, 1.13), (115, 0.95), (190, 1.0)), drift=14):
    """springy pop (overshoot, undershoot, settle) and a slight upward drift"""
    up = min(drift, 40 * dur_ms / 1000)
    tags = f"\\an5\\move({540 + dx},{POS_Y + dy + up / 2:.0f},{540 + dx},{POS_Y + dy - up / 2:.0f},0,{dur_ms})"
    tags += f"\\fscx{kx * keys[0][1]:.0f}\\fscy{ky * keys[0][1]:.0f}"
    for (t0, _), (t1, k) in zip(keys, keys[1:]):
        tags += f"\\t({t0},{t1},\\fscx{kx * k:.0f}\\fscy{ky * k:.0f})"
    return tags


SHADOW = "\\bord10\\shad0\\blur12\\1c&H000000&\\3c&H000000&"


lines = []
for ev, (start, end) in zip(events, spans):
    text = re.sub(r"[.,!?;:]+$", "", ev["text"]).upper()
    kx, ky = fit(text, SIZE)
    sp = "\\fsp0" if kx < 100 else ""
    dur = round((end - start) * 1000)
    # soft shadow: a blurred dark copy, offset down-right, under the outlined word
    lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Word,,0,0,0,,{{{pop(kx, ky, dur, 5, 10)}{SHADOW}{sp}\\alpha&HFF&\\t(0,60,\\alpha&H78&)}}{text}")
    lines.append(f"Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{{{pop(kx, ky, dur)}\\blur0.7{sp}\\alpha&H60&\\t(0,45,\\alpha&H00&)}}{text}")
if boy:
    # "HI, AUNTY..." - punctuation kept, it is the line: a bigger pop, a nervous
    # little shiver, then it sinks away with him
    text = boy["text"].upper()
    kx, ky = fit(text, BOY_SIZE)
    start = boy["s"] - LEAD
    sink, end = TL["T"]["sink"], TL["T"]["sink"] + 0.7
    dur, t_sink = round((end - start) * 1000), round((sink - start) * 1000)
    keys = ((0, 0.6), (80, 1.24), (160, 0.93), (240, 1.04), (320, 1.0))
    shiver = ""
    t, k = 340, 0
    while t < t_sink:
        shiver += f"\\t({t},{t + 45},\\frz{1.6 if k % 2 == 0 else -1.6})"
        t, k = t + 45, k + 1
    out = f"\\t({t_sink},{dur},0.6,\\frz0\\fscx{kx * 0.82:.0f}\\fscy{ky * 0.82:.0f})\\fad(0,300)"
    for layer, dx, dy, extra in ((0, 5, 10, SHADOW + "\\alpha&H78&"), (1, 0, 0, "\\blur0.7")):
        tags = pop(kx, ky, dur, dx, dy, keys, drift=0)
        tags = tags.replace(f"\\move({540 + dx},{POS_Y + dy},{540 + dx},{POS_Y + dy},0,{dur})", f"\\move({540 + dx},{POS_Y + dy},{540 + dx},{POS_Y + dy + 90},{t_sink},{dur})")
        lines.append(f"Dialogue: {layer},{ts(start)},{ts(end)},Boy,,0,0,0,,{{{tags}{extra}{shiver}{out}}}{text}")
    events.append(boy)

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,12,0,5,40,40,0,1
Style: Boy,Fredoka,{BOY_SIZE},&H0026D8FF,&H0026D8FF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,13,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(B("captions.ass"), "w").write(header + "\n".join(lines) + "\n")
json.dump(events, open(B("caption_words.json"), "w"), indent=1)
print(f"wrote {B('captions.ass')} ({len(lines)} words)")
