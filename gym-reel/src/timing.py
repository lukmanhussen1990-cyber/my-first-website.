"""Word-level timing (faster-whisper medium.en) -> captions + scene clock."""
import json
import re

import numpy as np

from engine import ROOT, hexc

WORDS = json.load(open(ROOT / "assets" / "audio" / "words.json"))
DURATION = 30.276  # exact voiceover length (s)

WHITE = (1, 1, 1)
YELLOW = hexc("ffd60a")
PINK = hexc("ff2d9a")

KEY = {"HARDER", "PUSH", "STOP", "BEHIND", "HEAVY", "LOSE", "RELAX", "GYM", "BRO", "SPOTTING", "BENCH", "PRESS",
       "HARD", "FART", "ECHOES", "TWELVE", "LEAVE", "TRAINER", "QUITS", "SMELLS", "HIGH", "FIVE", "LEGENDS",
       "GAS'S", "GENIUS", "NNGH!"}

# how many consecutive words per caption chunk (1-3), in order
GROUPS = [1, 1, 1, 2, 2, 2, 2,          # nngh nngh harder | come on | one more | push it | push it
          2, 1, 2, 2, 2,                # don't you | fucking | stop now | i'm right | behind you
          1, 1, 2, 2, 1, 2, 2,          # harder | harder | oh fuck | it's so | heavy | i'm gonna | lose it
          1, 2, 3, 2, 2, 2,             # relax | it's just | your gym bro | spotting you | on the | bench press
          2, 1, 1, 1, 2, 2, 1,          # you lift | so | fucking | hard | you rip | out a | fart
          2, 2, 1, 1, 1,                # it echoes | through the | whole | fucking | gym
          1, 2, 2, 1,                   # twelve | people leave | the trainer | quits
          3, 2, 1, 2, 2, 2,             # your gym bro | smells it | and | gives you | a fucking | high five
          2, 2, 1, 3,                   # now you're | the fucking | legends | of gas's gym
          1]                            # genius


def _clean(w):
    return re.sub(r"[.,!?]$", "", w.upper()) if w.upper() != "NNGH!" else "NNGH!"


def build_captions():
    words = list(WORDS)
    chunks = []
    i = 0
    groups = list(GROUPS)
    # fix: the "a | fucking | high five" region -> regroup to match word count
    while i < len(words):
        g = groups.pop(0) if groups else 1
        g = min(g, len(words) - i)
        part = words[i:i + g]
        items = []
        for w in part:
            txt = _clean(w["w"])
            if "FUCK" in txt:
                col = PINK
            elif txt in KEY:
                col = YELLOW
            else:
                col = WHITE
            items.append((txt, col))
        chunks.append(dict(s=part[0]["s"], e=part[-1]["e"], words=items))
        i += g
    # display windows: show until next chunk starts (or 0.45s after end in gaps)
    for ch in chunks:
        ch["start"] = ch["s"] - 0.03
    for k, ch in enumerate(chunks):
        nxt = chunks[k + 1]["start"] if k + 1 < len(chunks) else DURATION
        ch["show_end"] = min(nxt, ch["e"] + 0.5)
    return chunks


CAPTIONS = build_captions()


def word_time(text, nth=0):
    """Start time of the nth occurrence of a word (case-insensitive, punctuation stripped)."""
    k = 0
    for w in WORDS:
        if _clean(w["w"]) == text.upper():
            if k == nth:
                return w["s"]
            k += 1
    raise KeyError(text)


# speaking characters per word index ranges (for mouth sync)
SPEAKER_SPANS = [
    (0.0, 1.1, "you"),      # grunts
    (1.3, 8.0, "bro"),      # harder ... i'm right behind you
    (8.2, 9.6, "bro"),      # harder harder
    (9.7, 12.3, "you"),     # oh fuck it's so heavy, i'm gonna lose it
]


def speaker_at(t):
    for a, b, who in SPEAKER_SPANS:
        if a <= t <= b:
            return who
    return None


class Envelope:
    """Voice loudness envelope for mouth sync (computed from the actual voiceover)."""

    def __init__(self):
        import subprocess
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "assets" / "audio" / "voiceover.mp3"),
                              "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, np.float32)
        hop = 160  # 10ms
        n = len(a) // hop
        rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1))
        rms = rms / (np.percentile(rms, 98) + 1e-9)
        # attack/release smoothing
        out = np.zeros_like(rms)
        v = 0.0
        for i, x in enumerate(rms):
            k = 0.55 if x > v else 0.18
            v = v + (x - v) * k
            out[i] = v
        self.env = np.clip(out, 0, 1.2)

    def __call__(self, t):
        i = t * 100.0
        i0 = int(np.clip(np.floor(i), 0, len(self.env) - 2))
        f = i - i0
        return float(self.env[i0] * (1 - f) + self.env[i0 + 1] * f)
