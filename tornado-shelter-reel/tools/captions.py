"""One-word-at-a-time subtitles (ASS, burned in by tools/export.sh), synced to the voice.

Word times come from assets/vo/<id>.words.json (ElevenLabs alignment, or the
recogniser matched onto the script for a recording or a local voice), shifted to each
line's slot and scaled by any speed-up the mix applied (build/vo_placement.json,
written by tools/audio.py). The spelling always comes from script.json itself. Each
word sits in the middle of the frame a little above centre, clear of the bottom 20 %
and the right edge (Instagram's buttons) and clear of the yellow number labels: bold
white, a thin black outline, a soft shadow, and a tiny pop as it appears.

usage: python tools/captions.py -> build/captions.ass (+ build/caption_words.json)
"""
import json
import os
import re

from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
FONT_FILE = os.path.join(ROOT, "assets", "fonts", "Inter-ExtraBold.otf")
FONT_NAME = "Inter ExtraBold"
TL = json.load(open(B("timeline.json")))
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
PLACE = json.load(open(B("vo_placement.json"))) if os.path.exists(B("vo_placement.json")) else {}

SIZE = 112  # px at 1080x1920
OUTLINE = 5  # thin black outline
POS_X = 520  # a touch left of centre: away from the buttons on the right
POS_Y = 835  # a little above the middle (960); the yellow labels stay above 700 or below 1000
MAX_W = 820  # widest word: keeps clear of both edges
FPS = TL["FPS"]
LEAD = 1.0 / FPS  # show each word one frame before it is heard
MIN_ON = 4.02 / FPS  # at least 4 frames on screen
HOLD = 0.3  # a word stays up this long after it ends...
HOLD_FINAL = 0.55  # ...a sentence-final word a little longer
GAP_CLEAR = 0.5  # in continuous speech words hand over without a gap; longer pauses clear the screen


def letters(s):
    return re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))


def ts(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def display(word):
    """the script's spelling, minus trailing commas, full stops and colons"""
    return re.sub(r"[.,:;!]+$", "", word)


lines = {l["id"]: l for l in SCRIPT["lines"]}
events = []
for slot in TL["VO"]:
    line = lines[slot["id"]]
    words = json.load(open(os.path.join(ROOT, "assets", "vo", f"{slot['id']}.words.json")))
    script_words = line["text"].split()
    assert len(words) == len(script_words), (slot["id"], len(words), len(script_words))
    p = PLACE.get(slot["id"], {"at": slot["at"], "tempo": 1.0})
    for w, sw in zip(words, script_words):
        assert letters(w["w"]) == letters(sw), (w, sw)
        events.append({"text": display(sw), "s": p["at"] + w["s"] / p["tempo"], "e": p["at"] + w["e"] / p["tempo"],
                       "line": slot["id"], "final": re.search(r"[.?!]$", sw) is not None})

# nudge words that start in silence (leading pause, stop-consonant closure) to
# their audible onset in the assembled voice track (at most 0.12 s)
try:
    import numpy as np
    import soundfile as sf

    vo, sr = sf.read(B("audio", "vo.wav"))
    vo = vo[:, 0] if vo.ndim > 1 else vo

    def level(t, win=0.01):
        seg = vo[max(0, int(t * sr)) : int((t + win) * sr)]
        return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) else -120

    for ev in events:
        lv = [level(ev["s"] + k * 0.01) for k in range(13)]
        peak = max(level(ev["s"] + k * 0.01) for k in range(int((ev["e"] - ev["s"]) / 0.01) + 1))
        m = int(np.argmin(lv[:9]))
        if lv[m] < peak - 32:
            for k in range(m + 1, 13):
                if lv[k] > max(lv[m] + 10, peak - 30):
                    ev["s"] = min(ev["s"] + (k - 1) * 0.01, ev["e"] - 0.06)
                    break
except FileNotFoundError:
    pass

spans = []
for i, ev in enumerate(events):
    start = ev["s"] - LEAD
    nxt = events[i + 1]["s"] - LEAD if i + 1 < len(events) else None
    end = ev["e"] + (HOLD_FINAL if ev["final"] else HOLD)
    if nxt is not None and (nxt - ev["e"] < (0.0 if ev["final"] else GAP_CLEAR) or end >= nxt):
        end = nxt  # hand over exactly at the next word (never overlap, never flicker)
    spans.append([start, end])
# borrow a little time from the following word so quick words stay readable...
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


def fit(text, size):
    """x/y scale (%) that fits a long word: condensed a little before it is shrunk"""
    w = ImageFont.truetype(FONT_FILE, size).getlength(text) + 2 * OUTLINE
    kx = min(1.0, MAX_W / w)
    ky = min(1.0, kx + 0.15)
    return kx * 100, ky * 100


KEYS = ((0, 0.8), (60, 1.08), (120, 0.97), (180, 1.0))


def pop(kx, ky, dur_ms, dx=0, dy=0, drift=10):
    """tiny bounce (overshoot, undershoot, settle) and a slight upward drift"""
    up = min(drift, 40 * dur_ms / 1000)
    tags = f"\\an5\\move({POS_X + dx},{POS_Y + dy + up / 2:.0f},{POS_X + dx},{POS_Y + dy - up / 2:.0f},0,{dur_ms})"
    tags += f"\\fscx{kx * KEYS[0][1]:.0f}\\fscy{ky * KEYS[0][1]:.0f}"
    for (t0, _), (t1, k) in zip(KEYS, KEYS[1:]):
        tags += f"\\t({t0},{t1},\\fscx{kx * k:.0f}\\fscy{ky * k:.0f})"
    return tags


SHADOW = "\\bord8\\shad0\\blur10\\1c&H000000&\\3c&H000000&"

out = []
for ev, (start, end) in zip(events, spans):
    kx, ky = fit(ev["text"], SIZE)
    sp = "\\fsp0" if kx < 100 else ""
    dur = round((end - start) * 1000)
    # soft shadow: a blurred dark copy, offset down-right, under the outlined word
    out.append(f"Dialogue: 0,{ts(start)},{ts(end)},Word,,0,0,0,,{{{pop(kx, ky, dur, 4, 7)}{SHADOW}{sp}\\alpha&HFF&\\t(0,60,\\alpha&H78&)}}{ev['text']}")
    out.append(f"Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{{{pop(kx, ky, dur, 0, 0)}\\blur0.6{sp}\\alpha&H60&\\t(0,45,\\alpha&H00&)}}{ev['text']}")
    ev["show"] = [round(start, 3), round(end, 3)]

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,{FONT_NAME},{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,{OUTLINE},0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(B("captions.ass"), "w").write(header + "\n".join(out) + "\n")
json.dump(events, open(B("caption_words.json"), "w"), indent=1)
# sanity: one word on screen at a time, every word readable
shows = [e["show"] for e in events]
assert all(a[1] <= b[0] + 1e-6 for a, b in zip(shows, shows[1:])), "overlapping words"
short = [e["text"] for e in events if e["show"][1] - e["show"][0] < MIN_ON - 0.011]
print(f"wrote {B('captions.ass')} ({len(events)} words{', short: ' + ' '.join(short) if short else ''})")
