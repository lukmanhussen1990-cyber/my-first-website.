"""One-word-at-a-time subtitles (ASS, burned in by tools/export.sh), synced to the voice.

Word times come from assets/vo/<id>.words.json (ElevenLabs alignment, or the
recogniser matched onto the script for local voices), shifted to each line's slot
and scaled by any speed-up the mix applied (build/vo_placement.json, written by
tools/audio.py). The spelling always comes from script.json itself. Each word sits
a little above the middle of the frame, clear of the bottom 20 % and the right edge
(Instagram's buttons), white with a thick black outline and a soft shadow, and pops
in with a tiny bounce. Mom's line is yellow and a little bigger.

usage: python tools/captions.py -> build/captions.ass (+ build/caption_words.json)
"""
import json
import os
import re

from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = lambda *p: os.path.join(ROOT, "build", *p)
FONT = os.path.join(ROOT, "assets", "Fredoka-Bold.ttf")
TL = json.load(open(B("timeline.json")))
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
PLACE = json.load(open(B("vo_placement.json"))) if os.path.exists(B("vo_placement.json")) else {}

UPPER = False  # True for ALL-CAPS captions; the script's own spelling and case otherwise
SIZE = 138  # px at 1080x1920
MOM_SIZE = 162
POS_X = 530  # a touch left of centre: away from the buttons on the right
POS_Y = 860  # a little above the middle (960)
MAX_W = 860  # widest word: keeps clear of the right edge
FPS = TL["FPS"]
LEAD = 1.0 / FPS  # show each word one frame before it is heard
MIN_ON = 4.02 / FPS  # at least 4 frames on screen
HOLD = 0.3  # a word stays up this long after it ends...
HOLD_FINAL = 0.55  # ...a sentence-final word a little longer
MOM_HOLD = 0.75  # Mom's last word lingers for the punchline
GAP_CLEAR = 0.5  # in continuous speech words hand over without a gap; longer pauses clear the screen


def letters(s):
    return re.sub(r"[^a-z0-9']", "", s.lower())


def ts(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def display(word):
    """script spelling, minus trailing commas, full stops and colons (keeps ? and ...)"""
    w = word if word.endswith("...") else re.sub(r"[.,:;!]+$", "", word)
    return w.upper() if UPPER else w


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
                       "line": slot["id"], "mom": line.get("subtitle") == "mom" or line["speaker"] == "mom", "final": re.search(r"[.?!]$", sw) is not None})

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
    end = ev["e"] + (MOM_HOLD if ev["mom"] and nxt is None else HOLD_FINAL if ev["final"] else HOLD)
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
    """x/y scale (%) that fits a word: long words are condensed a little before
    they are shrunk, so "Congratulations" stays big enough to read"""
    w = ImageFont.truetype(FONT, size).getlength(text) + 2 * len(text)
    kx = min(1.0, MAX_W / w)
    ky = min(1.0, kx + 0.15)
    return kx * 100, ky * 100


def pop(kx, ky, dur_ms, dx=0, dy=0, keys=((0, 0.76), (55, 1.12), (115, 0.95), (190, 1.0)), drift=12):
    """tiny bounce (overshoot, undershoot, settle) and a slight upward drift"""
    up = min(drift, 40 * dur_ms / 1000)
    tags = f"\\an5\\move({POS_X + dx},{POS_Y + dy + up / 2:.0f},{POS_X + dx},{POS_Y + dy - up / 2:.0f},0,{dur_ms})"
    tags += f"\\fscx{kx * keys[0][1]:.0f}\\fscy{ky * keys[0][1]:.0f}"
    for (t0, _), (t1, k) in zip(keys, keys[1:]):
        tags += f"\\t({t0},{t1},\\fscx{kx * k:.0f}\\fscy{ky * k:.0f})"
    return tags


SHADOW = "\\bord10\\shad0\\blur12\\1c&H000000&\\3c&H000000&"
MOM_KEYS = ((0, 0.6), (70, 1.2), (140, 0.93), (220, 1.03), (300, 1.0))

out = []
for ev, (start, end) in zip(events, spans):
    style, size = ("Mom", MOM_SIZE) if ev["mom"] else ("Word", SIZE)
    kx, ky = fit(ev["text"], size)
    sp = "\\fsp0" if kx < 100 else ""
    dur = round((end - start) * 1000)
    keys = MOM_KEYS if ev["mom"] else ((0, 0.76), (55, 1.12), (115, 0.95), (190, 1.0))
    # soft shadow: a blurred dark copy, offset down-right, under the outlined word
    out.append(f"Dialogue: 0,{ts(start)},{ts(end)},{style},,0,0,0,,{{{pop(kx, ky, dur, 5, 9, keys)}{SHADOW}{sp}\\alpha&HFF&\\t(0,60,\\alpha&H70&)}}{ev['text']}")
    out.append(f"Dialogue: 1,{ts(start)},{ts(end)},{style},,0,0,0,,{{{pop(kx, ky, dur, 0, 0, keys)}\\blur0.7{sp}\\alpha&H60&\\t(0,45,\\alpha&H00&)}}{ev['text']}")
    ev["show"] = [round(start, 3), round(end, 3)]

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka,{SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,11,0,5,40,40,0,1
Style: Mom,Fredoka,{MOM_SIZE},&H0026D8FF,&H0026D8FF,&H00000000,&H64000000,-1,0,0,0,100,100,2,0,1,12,0,5,40,40,0,1

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
