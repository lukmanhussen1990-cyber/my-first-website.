"""Join the ElevenLabs takes into one voiceover with controlled pauses.

The narrator was generated as ONE take (eleven_v4, Nassim) so the tone stays the same
the whole way through. This script cuts that take into the 24 narrator lines at the
real silences in the audio (never inside a word or a breath), drops in Uncle's and
Grandma's lines, and sets the pause before every line.

Usage: python make_voiceover.py
Reads  audio/raw/<take>.mp3 + <take>.words.json (word times from speech-to-text)
Writes audio/voiceover.wav, audio/voiceover.mp3, audio/vo_lines.json
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
LINES = SCRIPT["lines"]            # [{"who": "N"|"U"|"G", "text": ..., "pause_before": optional}]
TAKES = SCRIPT["takes"]            # {"N": "narr_B", "U": "uncle_B", "G": "grandma_A"}
GAIN_DB = SCRIPT.get("gain_db", {})  # per speaker loudness trim

LEAD_IN = 0.25        # silence before the first word
TAIL = 0.60           # silence after the last word
PRE = 0.035           # keep this much room tone before a line's first sound
POST = 0.09           # keep this much after a line's last sound (word decay)
DEFAULT_GAP = (0.27, 0.33)  # natural gap between lines, clamped into this range


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def level_db(a, hop=0.005, win=0.015):
    h, w = int(hop * SR), int(win * SR)
    n = (len(a) - w) // h + 1
    d = np.array([20 * np.log10(np.sqrt(np.mean(a[i * h:i * h + w] ** 2)) + 1e-9) for i in range(n)])
    return d, hop, win


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
    """First and last sample that is louder than the silence threshold."""
    d, hop, win = level_db(a)
    idx = np.where(d >= thr_db)[0]
    return idx[0] * hop, idx[-1] * hop + win


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def split_narrator(a, words, texts):
    """Return (start, end) speech times for each narrator line, cut at real silences."""
    sil = silences(a)
    counts = [len(t.split()) for t in texts]
    assert sum(counts) == len(words), f"script has {sum(counts)} words, take has {len(words)}"
    for w, s in zip(words, " ".join(texts).split()):
        if norm(w["w"]) != norm(s) and not (norm(s) == "gastrocolic"):
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
        best = min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - guess))
        bounds.append(best)
    s0, e0 = speech_edges(a)
    spans = []
    for i in range(len(texts)):
        st = s0 if i == 0 else bounds[i - 1][1]
        en = e0 if i == len(texts) - 1 else bounds[i][0]
        spans.append((st, en))
    return spans


def active_rms_db(a):
    x = a[np.abs(a) > 0.01]
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def main():
    takes = {k: load(os.path.join(RAW, v + ".mp3")) for k, v in TAKES.items()}
    words = {k: json.load(open(os.path.join(RAW, v + ".words.json"))) for k, v in TAKES.items()}
    ref = active_rms_db(takes["N"])

    narr_lines = [l["text"] for l in LINES if l["who"] == "N"]
    nspans = iter(split_narrator(takes["N"], words["N"], narr_lines))

    clips = []
    for l in LINES:
        a = takes[l["who"]]
        if l["who"] == "N":
            st, en = next(nspans)
        else:
            st, en = speech_edges(a)
        g = 10 ** ((ref - active_rms_db(a) + GAIN_DB.get(l["who"], 0.0)) / 20)
        i0, i1 = int(max(0, st - PRE) * SR), int(min(len(a) / SR, en + POST) * SR)
        c = a[i0:i1].copy() * g
        fi, fo = int(0.004 * SR), int(0.03 * SR)
        c[:fi] *= np.linspace(0, 1, fi)
        c[-fo:] *= np.linspace(1, 0, fo)
        clips.append({"line": l, "audio": c, "speech": (PRE, PRE + (en - st)), "nat": (st, en)})

    # gaps: natural gap from the take (clamped), or the fixed pause from script.json
    out = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    meta = []
    for i, c in enumerate(clips):
        if i > 0:
            prev = clips[i - 1]
            want = c["line"].get("pause_before")
            if want is None:
                if prev["line"]["who"] == "N" and c["line"]["who"] == "N":
                    nat = c["nat"][0] - prev["nat"][1]
                    want = float(np.clip(nat, *DEFAULT_GAP)) if nat > 0.2 else nat
                else:
                    want = DEFAULT_GAP[1]
            # silence between last sound of prev and first sound of this one
            pad = want - (len(prev["audio"]) / SR - prev["speech"][1]) - c["speech"][0]
            out.append(np.zeros(max(0, int(pad * SR)), np.float32))
            t += max(0, int(pad * SR)) / SR
        s = t + c["speech"][0]
        e = t + c["speech"][1]
        meta.append({"i": i + 1, "who": c["line"]["who"], "text": c["line"]["text"],
                     "start": round(s, 3), "end": round(e, 3)})
        out.append(c["audio"].astype(np.float32))
        t += len(c["audio"]) / SR
    out.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(out)
    y *= 10 ** (-1.0 / 20) / max(1e-6, np.abs(y).max())  # peak -1 dBFS (final loudness is set in the mix)

    import soundfile as sf
    wav = os.path.join(OUT, "voiceover.wav")
    sf.write(wav, y, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "192k",
                    os.path.join(OUT, "voiceover.mp3")], check=True)
    json.dump({"duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(OUT, "vo_lines.json"), "w"), indent=1)
    for m in meta:
        print(f"{m['i']:2d} {m['who']} {m['start']:6.2f}-{m['end']:6.2f}  {m['text']}")
    print(f"total {len(y) / SR:.2f}s")


if __name__ == "__main__":
    main()
