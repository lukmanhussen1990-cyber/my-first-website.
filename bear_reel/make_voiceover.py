"""Build the timed voiceover from one ElevenLabs take (same method as thanksgiving_reel).

The narrator was generated as ONE take (eleven_v4, Nassim, "[calm] [deadpan]") so the tone stays the same
the whole way through. This script cuts that take into the script lines at the real silences in the audio
(never inside a word or a breath) and sets the pause before every line:
  - natural gap from the take, kept between 0.27 and 0.33 s
  - a longer pause where script.json says "pause_before" ("What you don't know:" and the last line)

Usage:  python3 make_voiceover.py
Reads   script.json, audio/raw/<take>.mp3 + <take>.words.json (word times from stt_words.py)
Writes  audio/voiceover.wav, audio/voiceover.mp3, audio/vo_lines.json, audio/voiceover.words.json
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "audio", "raw")
OUT = os.path.join(HERE, "audio")
SR = 48000

SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
LINES = SCRIPT["lines"]
TAKE = os.environ.get("TAKE", SCRIPT["takes"]["N"])

LEAD_IN = 0.25        # silence before the first word
TAIL = 1.50           # silence after the last word (the last wide shot holds here)
PRE = 0.035           # keep this much room tone before a line's first sound
POST = 0.09           # keep this much after a line's last sound (word decay)
DEFAULT_GAP = (0.27, 0.33)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def level_db(a, hop=0.005, win=0.015):
    h, w = int(hop * SR), int(win * SR)
    n = (len(a) - w) // h + 1
    idx = np.arange(n)[:, None] * h + np.arange(w)[None, :]
    return 20 * np.log10(np.sqrt((a[idx] ** 2).mean(1)) + 1e-9), hop, win


def silences(a, thr_db=-55.0, min_len=0.10):
    d, hop, win = level_db(a)
    out, st = [], None
    for i, v in enumerate(d):
        if v < thr_db:
            if st is None:
                st = i
        else:
            if st is not None and (i - st) * hop >= min_len:
                out.append((st * hop, i * hop + win))
            st = None
    if st is not None:
        out.append((st * hop, len(a) / SR))
    return out


def speech_edges(a, thr_db=-55.0):
    d, hop, win = level_db(a)
    idx = np.where(d >= thr_db)[0]
    return idx[0] * hop, idx[-1] * hop + win


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def split_lines(a, words, texts):
    """(start, end) speech time of every line, cut at the real silence between lines."""
    sil = silences(a)
    counts = [len(t.split()) for t in texts]
    assert sum(counts) == len(words), f"script has {sum(counts)} words, take has {len(words)}"
    for w, s in zip(words, " ".join(texts).split()):
        if norm(w["w"]) != norm(s):
            print(f"  note: STT heard '{w['w']}' for '{s}'")
    first = np.cumsum([0] + counts[:-1])
    last = np.cumsum(counts) - 1
    bounds = []
    for i in range(len(texts) - 1):
        we, nx = words[last[i]], words[first[i + 1]]
        guess = (we["e"] + nx["s"]) / 2
        lo, hi = we["s"], nx["e"]
        cand = [s for s in sil if s[1] > lo and s[0] < hi]
        if not cand:
            sys.exit(f"no silence between line {i + 1} and {i + 2}")
        bounds.append(min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - guess)))
    s0, e0 = speech_edges(a)
    return [(s0 if i == 0 else bounds[i - 1][1], e0 if i == len(texts) - 1 else bounds[i][0])
            for i in range(len(texts))]


def main():
    a = load(os.path.join(RAW, TAKE + ".mp3"))
    words = json.load(open(os.path.join(RAW, TAKE + ".words.json")))
    texts = [l["text"] for l in LINES]
    spans = split_lines(a, words, texts)

    # word times inside each line, relative to the line's cut start (for captions later)
    counts = [len(t.split()) for t in texts]
    first = np.cumsum([0] + counts[:-1])

    clips = []
    for li, (l, (st, en)) in enumerate(zip(LINES, spans)):
        i0, i1 = int(max(0, st - PRE) * SR), int(min(len(a) / SR, en + POST) * SR)
        c = a[i0:i1].copy()
        fi, fo = int(0.004 * SR), int(0.03 * SR)
        c[:fi] *= np.linspace(0, 1, fi)
        c[-fo:] *= np.linspace(1, 0, fo)
        lw = words[first[li]:first[li] + counts[li]]
        clips.append({"line": l, "audio": c, "speech": (PRE, PRE + (en - st)), "nat": (st, en),
                      "cut0": i0 / SR, "words": lw})

    out = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    meta, all_words = [], []
    for i, c in enumerate(clips):
        if i > 0:
            prev = clips[i - 1]
            want = c["line"].get("pause_before")
            if want is None:
                nat = c["nat"][0] - prev["nat"][1]
                want = float(np.clip(nat, *DEFAULT_GAP))
            pad = want - (len(prev["audio"]) / SR - prev["speech"][1]) - c["speech"][0]
            n = max(0, int(round(pad * SR)))
            out.append(np.zeros(n, np.float32))
            t += n / SR
        s, e = t + c["speech"][0], t + c["speech"][1]
        meta.append({"i": i + 1, "text": c["line"]["text"], "start": round(s, 3), "end": round(e, 3)})
        # STT word times moved onto the new timeline (clamped inside the line); the words are the SCRIPT's words
        for sw, w in zip(c["line"]["text"].split(), c["words"]):
            ws = min(max(t + (w["s"] - c["cut0"]), s), e)
            we = min(max(t + (w["e"] - c["cut0"]), ws + 0.05), e)
            all_words.append({"w": sw, "s": round(ws, 3), "e": round(we, 3), "line": i + 1})
        out.append(c["audio"].astype(np.float32))
        t += len(c["audio"]) / SR
    out.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(out)
    y *= 10 ** (-1.0 / 20) / max(1e-6, np.abs(y).max())   # peak -1 dBFS (loudness is set in the mix)

    import soundfile as sf
    wav = os.path.join(OUT, "voiceover.wav")
    sf.write(wav, y, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "192k",
                    os.path.join(OUT, "voiceover.mp3")], check=True)
    json.dump({"take": TAKE, "duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(OUT, "vo_lines.json"), "w"), indent=1)
    json.dump(all_words, open(os.path.join(OUT, "voiceover.words.json"), "w"), indent=0)
    for m in meta:
        print(f"{m['i']:2d} {m['start']:6.2f}-{m['end']:6.2f}  {m['text']}")
    print(f"take {TAKE}: total {len(y) / SR:.2f}s")


if __name__ == "__main__":
    main()
