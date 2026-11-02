"""Build the timed voiceover from the ElevenLabs takes (same method as bear_reel / thanksgiving_reel).

Two takes, both the same Nassim voice (eleven_v4):
  N  narrator, ONE take of every narrator line with "[calm] [deadpan]" so the tone stays the same throughout
  Y  YOU yelling from the toilet, one take of both yells with "[shouting]"
Each take is cut into its script lines at the real silences in the audio (never inside a word or a breath),
then all lines are joined in script order with the pause before every line:
  - natural gap from the take, kept between 0.27 and 0.33 s
  - "pause_before" from script.json where set (longer pause before "What you don't know:", the dramatic
    pause before "He throws scissors.", the pause before the last line, the drum beats of rock-paper-scissors)
A line with "stretch_last" gets its last word slowed down (rubberband, same pitch): the long "DOOONE!".

Usage:  python3 make_voiceover.py
Reads   script.json, audio/raw/<take>.mp3 + <take>.words.json (word times from stt_words.py)
Writes  audio/voiceover.wav, audio/voiceover.mp3, audio/vo_lines.json, audio/voiceover.words.json
"""
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "audio", "raw")
OUT = os.path.join(HERE, "audio")
SR = 48000

SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
LINES = SCRIPT["lines"]

LEAD_IN = 0.25        # silence before the first word
TAIL = 1.60           # silence after the last word (the last wide shot holds here)
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
    return re.sub(r"o{3,}", "ooo", re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'")))


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
            # run-on words with no real silence (the take says "paper, scissors" in one breath):
            # cut at the deepest level dip between the end of the one word and the start of the next
            # (not inside a word: a stop consonant's closure, like the middle "p" of "paper", is deeper)
            d, hop, win = level_db(a)
            i0, i1 = int(we["e"] / hop), int((nx["s"] + 0.05) / hop)
            m = (i0 + int(np.argmin(d[i0:i1]))) * hop + win / 2
            print(f"  note: no silence between '{texts[i]}' and '{texts[i + 1]}': cut at the dip "
                  f"{m:.3f}s ({d[i0:i1].min():.0f} dB)")
            if d[i0:i1].min() > -35:
                sys.exit("  dip not deep enough for a clean cut")
            bounds.append((m, m))
            continue
        bounds.append(min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - guess)))
    s0, e0 = speech_edges(a)
    hard = [b[0] == b[1] for b in bounds]          # hard cut (no silence) -> no padding on that side
    return [(s0 if i == 0 else bounds[i - 1][1], e0 if i == len(texts) - 1 else bounds[i][0],
             i > 0 and hard[i - 1], i < len(texts) - 1 and hard[i])
            for i in range(len(texts))]


def stretch(x, factor):
    """Time-stretch x by `factor` (>1 = longer) keeping the pitch (ffmpeg rubberband)."""
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af",
                        f"rubberband=tempo={1 / factor:.4f}:transients=smooth:formant=preserved", b], check=True)
        y, _ = sf.read(b, dtype="float32")
    return y


def cut_voice(who):
    """Cut the take of voice `who` into its lines -> list of clip dicts in script order of that voice."""
    take = SCRIPT["takes"][who]
    a = load(os.path.join(RAW, take + ".mp3")) * 10 ** (SCRIPT["gain_db"].get(who, 0) / 20)
    words = json.load(open(os.path.join(RAW, take + ".words.json")))
    lines = [l for l in LINES if l["who"] == who]
    texts = [l["text"] for l in lines]
    spans = split_lines(a, words, texts)
    counts = [len(t.split()) for t in texts]
    first = np.cumsum([0] + counts[:-1])
    clips = []
    for li, (l, (st, en, hard0, hard1)) in enumerate(zip(lines, spans)):
        pre, post = (0.0 if hard0 else PRE), (0.0 if hard1 else POST)
        i0, i1 = int(max(0, st - pre) * SR), int(min(len(a) / SR, en + post) * SR)
        c = a[i0:i1].copy()
        lw = [dict(w) for w in words[first[li]:first[li] + counts[li]]]
        sp0, sp1 = st - i0 / SR, en - i0 / SR          # speech start/end inside the clip
        f = l.get("stretch_last")
        if f:                                          # slow down the last word, keep everything before it
            k0 = max(lw[-1]["s"] - 0.02 - i0 / SR, 0)  # clip time where the last word starts
            k = int(k0 * SR)
            c = np.concatenate([c[:k], stretch(c[k:], f)]).astype(np.float32)
            sp1 = k0 + (sp1 - k0) * f
            lw[-1]["e"] = lw[-1]["s"] + (lw[-1]["e"] - lw[-1]["s"]) * f
        fi, fo = int((0.006 if hard0 else 0.004) * SR), int((0.012 if hard1 else 0.03) * SR)
        c[:fi] *= np.linspace(0, 1, fi)
        c[-fo:] *= np.linspace(1, 0, fo)
        clips.append({"line": l, "audio": c, "speech": (sp0, sp1), "nat": (st, en), "cut0": i0 / SR,
                      "words": lw, "take": take})
    return clips


def main():
    per_voice = {who: iter(cut_voice(who)) for who in SCRIPT["takes"]}
    clips = [next(per_voice[l["who"]]) for l in LINES]

    out = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    meta, all_words = [], []
    for i, c in enumerate(clips):
        if i > 0:
            prev = clips[i - 1]
            want = c["line"].get("pause_before")
            if want is None:
                assert prev["line"]["who"] == c["line"]["who"], f"set pause_before for line {i + 1}"
                nat = c["nat"][0] - prev["nat"][1]
                want = float(np.clip(nat, *DEFAULT_GAP))
            pad = want - (len(prev["audio"]) / SR - prev["speech"][1]) - c["speech"][0]
            n = max(0, int(round(pad * SR)))
            out.append(np.zeros(n, np.float32))
            t += n / SR
        s, e = t + c["speech"][0], t + c["speech"][1]
        meta.append({"i": i + 1, "who": c["line"]["who"], "text": c["line"]["text"],
                     "start": round(s, 3), "end": round(e, 3)})
        for w in c["words"]:   # STT word times moved onto the new timeline (clamped inside the line)
            ws = min(max(t + (w["s"] - c["cut0"]), s), e)
            we = min(max(t + (w["e"] - c["cut0"]), ws + 0.05), e)
            all_words.append({"w": w["w"], "s": round(ws, 3), "e": round(we, 3), "line": i + 1})
        out.append(c["audio"].astype(np.float32))
        t += len(c["audio"]) / SR
    out.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(out)
    y *= 10 ** (-1.0 / 20) / max(1e-6, np.abs(y).max())   # peak -1 dBFS (loudness is set in the mix)

    wav = os.path.join(OUT, "voiceover.wav")
    sf.write(wav, y, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "192k",
                    os.path.join(OUT, "voiceover.mp3")], check=True)
    json.dump({"takes": SCRIPT["takes"], "duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(OUT, "vo_lines.json"), "w"), indent=1)
    json.dump(all_words, open(os.path.join(OUT, "voiceover.words.json"), "w"), indent=0)
    for m in meta:
        print(f"{m['i']:2d} {m['who']} {m['start']:6.2f}-{m['end']:6.2f}  {m['text']}")
    print(f"total {len(y) / SR:.2f}s")


if __name__ == "__main__":
    main()
