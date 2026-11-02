#!/usr/bin/env python3
"""Local (offline) alignment of the saved voiceover -- no API calls.

The voice files were generated via the ElevenLabs connector, which does not
return timestamps. This finds sentence boundaries from the pauses in the audio
(energy envelope), then places words inside each sentence proportionally to
their length, snapping each word boundary to the nearest energy dip.

Writes audio/{narrator,crush}_alignment.json in the same shape as the
ElevenLabs /with-timestamps response, so build_timeline.py works unchanged.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voiceover import NARRATOR_LINES, CRUSH_LINES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
SR = 44100
HOP = 0.005  # 5 ms envelope frames


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def envelope(x):
    n = int(HOP * SR)
    frames = len(x) // n
    e = np.sqrt(np.mean(x[:frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(e)
    k = np.ones(5) / 5
    return np.convolve(db, k, mode="same")


def silences(db, thr, min_len):
    quiet = db < thr
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * HOP >= min_len:
                out.append((i * HOP, j * HOP))
            i = j
        else:
            i += 1
    return out


def word_weights(words):
    w = []
    for word in words:
        letters = sum(c.isalnum() for c in word)
        w.append(0.6 + letters)  # small floor so short words keep some time
    return np.array(w, float)


def place_words(db, s, e, words):
    """Return [(ws, we)] for words inside [s, e], boundaries snapped to energy dips."""
    w = word_weights(words)
    # commas add a little pause after the word
    extra = np.array([1.5 if wd.endswith(",") else 0.0 for wd in words])
    tot = (w + extra).sum()
    bounds, acc = [s], s
    for i in range(len(words) - 1):
        acc += (e - s) * (w[i] + extra[i]) / tot
        # snap to the quietest frame within +-90 ms
        a, b = int((acc - 0.09) / HOP), int((acc + 0.09) / HOP)
        a, b = max(a, int(s / HOP) + 1), min(b, int(e / HOP) - 1)
        if b > a:
            acc_s = (a + int(np.argmin(db[a:b]))) * HOP
        else:
            acc_s = acc
        acc_s = max(acc_s, bounds[-1] + 0.06)
        bounds.append(acc_s)
        acc = acc_s
    bounds.append(e)
    out = []
    for i in range(len(words)):
        ws, we = bounds[i], bounds[i + 1]
        if extra[i] > 0:  # leave the comma pause silent
            we = ws + (we - ws) * w[i] / (w[i] + extra[i])
        out.append((ws, we))
    return out


def to_alignment(text, lines, word_times):
    """Character-level arrays like the ElevenLabs alignment payload."""
    chars = list(text)
    st, en = [0.0] * len(chars), [0.0] * len(chars)
    flat = [w for line in lines for w in line.split()]
    assert len(flat) == len(word_times)
    pos = 0
    spans = []
    for w, (ws, we) in zip(flat, word_times):
        j = text.find(w, pos)
        idx = [k for k in range(j, j + len(w)) if text[k].isalnum() or text[k] == "'"]
        n = len(idx)
        for m, k in enumerate(idx):
            st[k] = ws + (we - ws) * m / n
            en[k] = ws + (we - ws) * (m + 1) / n
        spans.append((j, j + len(w), idx))
        pos = j + len(w)
    # punctuation / spaces: fill from neighbours
    last = 0.0
    for k, c in enumerate(chars):
        if c.isalnum() or c == "'":
            last = en[k]
        else:
            st[k] = last
            en[k] = last
    return {"characters": chars, "character_start_times_seconds": [round(v, 4) for v in st],
            "character_end_times_seconds": [round(v, 4) for v in en]}


def speech_bounds(db, s, e, thr):
    a, b = int(s / HOP), int(e / HOP)
    loud = np.where(db[a:b] >= thr)[0]
    if len(loud) == 0:
        return s, e
    return a * HOP + loud[0] * HOP, a * HOP + (loud[-1] + 1) * HOP


def align_file(name, lines):
    x = decode(AUDIO / f"{name}.mp3")
    db = envelope(x)
    peak = np.percentile(db, 98)
    thr = peak - 32
    dur = len(x) / SR
    s0, e0 = speech_bounds(db, 0, dur, thr)
    n_breaks = len(lines) - 1
    gaps = [g for g in silences(db, thr, 0.09) if g[0] > s0 + 0.05 and g[1] < e0 - 0.35]
    # also allow breaks at energy dips (sentences the voice ran together without a pause)
    lo = int((s0 + 0.3) / HOP); hi = int((e0 - 0.3) / HOP)
    for i in range(lo, hi):
        w = db[max(0, i - 16):i + 17]
        if db[i] == w.min() and not any(a - 0.05 <= i * HOP <= b + 0.05 for a, b in gaps):
            gaps.append((i * HOP, i * HOP))
    gaps.sort()
    if len(gaps) < n_breaks:
        raise SystemExit(f"{name}: found only {len(gaps)} candidate breaks for {n_breaks} sentence breaks")
    # choose the breaks: DP that keeps the speaking rate even and prefers real pauses
    lens = np.array([len(l) for l in lines], float)
    long_sil = sum(b - a for a, b in gaps if b - a > 0.2)
    R = lens.sum() / max(1.0, (e0 - s0) - long_sil)          # chars per second while speaking
    exp_d = lambda k: 0.12 + lens[k] / R
    C = [(s0, s0)] + gaps + [(e0, e0)]                       # candidate boundaries (pause start, pause end)
    G = len(C)
    INF = 1e18
    cost = np.full((len(lines) + 1, G), INF); back = np.full((len(lines) + 1, G), -1, int)
    cost[0, 0] = 0.0
    for k in range(1, len(lines) + 1):
        for j in range(1, G):
            if k < len(lines) and j == G - 1:
                continue
            if k == len(lines) and j != G - 1:
                continue
            best, arg = INF, -1
            for i in range(0, j):
                if cost[k - 1, i] >= INF:
                    continue
                d = C[j][0] - C[i][1]
                if d < 0.15:
                    continue
                c = cost[k - 1, i] + 4.0 * np.log(d / exp_d(k - 1)) ** 2
                if c < best:
                    best, arg = c, i
            if arg >= 0:
                glen = C[j][1] - C[j][0]
                cost[k, j] = best - (0 if j == G - 1 else 3.0 * min(glen, 0.6) - (0.35 if glen == 0 else 0))
                back[k, j] = arg
    j = G - 1; chosen = []
    for k in range(len(lines), 0, -1):
        i = back[k, j]
        if k > 1:
            chosen.append(i)
        j = i
    chosen = sorted(chosen)
    gaps = C
    sents, cur = [], s0
    for gi in chosen:
        a, b = gaps[gi]
        sents.append(speech_bounds(db, cur, a, thr)); cur = b
    sents.append(speech_bounds(db, cur, e0, thr))
    word_times = []
    for (s, e), line in zip(sents, lines):
        word_times += place_words(db, s, e, line.split())
    text = " ".join(lines)
    al = to_alignment(text, lines, word_times)
    (AUDIO / f"{name}_alignment.json").write_text(json.dumps(
        {"text": text, "source": "local energy alignment (tools/align_local.py)", "alignment": al}, indent=1))
    print(f"{name}: {dur:.2f}s, {len(lines)} sentences")
    for (s, e), line in zip(sents, lines):
        rate = len(line) / max(0.01, e - s)
        print(f"   {s:6.2f}-{e:6.2f}  {rate:5.1f} ch/s  {'!!' if not 9 < rate < 30 else '  '} {line}")


if __name__ == "__main__":
    align_file("narrator", NARRATOR_LINES)
    align_file("crush", CRUSH_LINES)
