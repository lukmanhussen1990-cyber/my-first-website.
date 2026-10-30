"""Everything timed to the voiceover: words, captions, scenes, lip-sync, bounce, blinks."""
import json
import math
import os
import re
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VO_PATH = os.path.join(HERE, "assets", "voiceover.mp3")
FPS = 30
SR = 44100

# Scene cuts sit in the pauses between the VO lines.
SCENES = [
    ("hook", 0.00),    # What if you stop gooning for just one day?
    ("hour1", 3.25),   # Hour one. You make a deal with yourself. Just one day.
    ("hour3", 7.55),   # Hour three. The urge shows up ... they fade.
    ("hour6", 16.30),  # Hour six. You get your time back ...
    ("night", 23.42),  # Night. No late-night session ...
    ("testo", 28.32),  # Your testosterone? ... So no superpowers.
    ("crown", 37.55),  # The real win? ... You do.
    ("outro", 42.25),  # Doing it sometimes is normal and healthy ... Follow for more.
]

# Caption chunks, 2-4 words each. *word* = highlighted in yellow.
CAPTIONS = """
What if *you*
*stop* gooning
for just *one day?*
*Hour one.*
You make a *deal*
with *yourself.*
Just *one day.*
*Hour three.*
The *urge* shows up,
mostly from *boredom*
or *habit.*
But *urges* are
like *waves.*
They *rise*
and then they *fade.*
*Hour six.*
You get your
*time* back.
Hours you'd *lose*
are now *free*
for the *gym,*
*study,* or *friends.*
*Night.*
No late-night *session.*
You might sleep *earlier*
and wake up *fresher.*
Your *testosterone?*
In *one day,*
almost *no change.*
One small *study*
saw a short *spike*
around *day seven.*
So no *superpowers.*
The *real win?*
You *prove* the habit
doesn't *control* you.
*You do.*
Doing it *sometimes*
is *normal* and *healthy.*
But if it feels
out of *control,*
talk to a *doctor*
or *counselor.*
Try *one day.*
*Follow* for more.
"""


def load_vo(sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VO_PATH, "-ac", "1", "-ar", str(sr),
                          "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def _rms_db(a, sr, hop):
    n = len(a) // hop
    fr = a[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-6)


def silences(a, sr=SR, thresh=-36.0, min_len=0.2):
    hop = sr // 100
    quiet = _rms_db(a, sr, hop) < thresh
    out, start = [], None
    for i, q in enumerate(np.r_[quiet, False]):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) / 100 >= min_len:
                out.append((start / 100, i / 100))
            start = None
    return out


def _norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


class Timeline:
    def __init__(self):
        self.vo = load_vo()
        self.sil = silences(self.vo)
        loud = np.nonzero(np.abs(self.vo) > 0.02)[0]
        self.vo_end = loud[-1] / SR
        self.duration = math.ceil((self.vo_end + 0.85) * FPS) / FPS
        self.n_frames = int(round(self.duration * FPS))
        self.words = self._words()
        self.captions = self._captions()
        self._lipsync()
        self._blinks()

    # -- words
    def _words(self):
        with open(os.path.join(HERE, "data", "words_asr.json")) as f:
            raw = json.load(f)
        words = []
        for w, s in raw:
            # snap onsets to the end of a pause when the ASR stamp lands near one
            for s0, s1 in self.sil:
                if s - 0.25 <= s1 <= s + 0.15:
                    s = s1
            words.append([w, s, None])
        for i, w in enumerate(words):
            nxt = words[i + 1][1] if i + 1 < len(words) else self.vo_end + 0.05
            end = nxt
            for s0, s1 in self.sil:
                if w[1] < s0 < nxt:
                    end = s0
                    break
            w[2] = min(end, nxt)
        return words

    # -- captions
    def _captions(self):
        out, wi = [], 0
        for line in CAPTIONS.strip().splitlines():
            runs = []  # (display word, highlighted)
            n_asr = 0
            for tok in line.split():
                disp = tok.replace("*", "")
                runs.append((disp, "*" in tok))
                n_asr += len([p for p in re.split(r"[-\s]", disp) if _norm(p)])
            span = self.words[wi: wi + n_asr]
            got = [_norm(w[0]) for w in span]
            want = [_norm(p) for d, _ in runs for p in re.split(r"[-\s]", d) if _norm(p)]
            assert got == want, f"caption/VO mismatch: {want} vs {got}"
            out.append({"runs": runs, "start": span[0][1], "words_end": span[-1][2]})
            wi += n_asr
        assert wi == len(self.words), "captions do not cover every spoken word"
        for c in out:
            c["start"] = max(0.0, c["start"] - 0.06)
        for i, c in enumerate(out):
            nxt = out[i + 1]["start"] if i + 1 < len(out) else self.duration
            c["end"] = nxt if nxt - c["words_end"] < 0.7 else c["words_end"] + 0.35
        return out

    def caption_at(self, t):
        for c in self.captions:
            if c["start"] <= t < c["end"]:
                return c
        return None

    # -- lip sync, talking bounce
    def _lipsync(self):
        n = self.n_frames
        win = int(0.045 * SR)
        mouth = np.zeros(n)
        for i in range(n):
            c = int(i / FPS * SR)
            seg = self.vo[max(0, c - win // 2): c + win // 2]
            if len(seg):
                db = 20 * math.log10(math.sqrt(float((seg ** 2).mean())) + 1e-6)
                mouth[i] = min(1.0, max(0.0, (db + 38) / 22))
        mouth[1:] = 0.6 * mouth[1:] + 0.4 * mouth[:-1]
        speaking = np.zeros(n)
        for _, s, e in self.words:
            speaking[int(s * FPS): int(math.ceil(e * FPS))] = 1
        inten = np.zeros(n)
        v = 0.0
        for i in range(n):
            k = 0.35 if speaking[i] > v else 0.12
            v += (speaking[i] - v) * k
            inten[i] = v
        phase = np.cumsum(2 * math.pi * 2.3 / FPS * inten)
        self.mouth = mouth
        self.talk = inten
        self.bounce = -16 * inten * np.abs(np.sin(phase))
        self.squash = 0.035 * inten * (2 * np.abs(np.sin(phase)) - 1)

    def _blinks(self):
        rng = np.random.default_rng(7)
        t, times = 0.9, []
        while t < self.duration:
            times.append(t)
            t += rng.uniform(2.0, 4.2)
        self.blink_times = times

    def blink(self, t):
        for b in self.blink_times:
            d = t - b
            if 0 <= d < 0.07:
                return d / 0.07
            if 0.07 <= d < 0.17:
                return 1 - (d - 0.07) / 0.1
        return 0.0

    def frame(self, t):
        return min(self.n_frames - 1, max(0, int(round(t * FPS))))

    def scene_at(self, t):
        cur = 0
        for i, (_, s) in enumerate(SCENES):
            if t >= s:
                cur = i
        return cur


if __name__ == "__main__":
    tl = Timeline()
    print(f"VO end {tl.vo_end:.2f}s, video {tl.duration:.2f}s ({tl.n_frames} frames)")
    for c in tl.captions:
        txt = " ".join(("[" + w + "]") if k else w for w, k in c["runs"])
        print(f"{c['start']:6.2f} - {c['end']:6.2f}  {txt}")
