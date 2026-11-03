#!/usr/bin/env python3
"""Offline word timing for line files that came without ElevenLabs timestamps.

For every audio/lines/Lxx.mp3 that has no Lxx.json (the with-timestamps response),
writes Lxx_align.json in the same character-alignment shape: speech start/end from
the energy envelope, sentence breaks matched to pauses, words placed by length and
snapped to the nearest energy dip. No API calls.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voiceover import LINES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LD = ROOT / "audio" / "lines"
SR, HOP = 44100, 0.005


def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def env_db(x):
    n = int(HOP * SR); f = len(x) // n
    db = 20 * np.log10(np.sqrt(np.mean(x[:f * n].reshape(f, n) ** 2, axis=1) + 1e-12))
    return np.convolve(db, np.ones(5) / 5, mode="same")


def pauses(db, thr, s0, e0, min_len=0.1):
    q = db < thr; out = []; i = int(s0 / HOP)
    while i < int(e0 / HOP):
        if q[i]:
            j = i
            while j < len(q) and q[j]: j += 1
            if (j - i) * HOP >= min_len: out.append((i * HOP, j * HOP))
            i = j
        else: i += 1
    return out


def align(lid, text):
    x = decode(LD / f"{lid}.mp3"); db = env_db(x)
    thr = np.percentile(db, 98) - 32
    loud = np.where(db >= thr)[0]
    s0, e0 = loud[0] * HOP, (loud[-1] + 1) * HOP
    words = text.split()
    # sentence groups inside the line ("He stops. He sniffs. Once. Twice.")
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?…,]$", w): groups.append(cur); cur = []
    if cur: groups.append(cur)
    gaps = pauses(db, thr, s0 + 0.05, e0 - 0.05)
    spans = []
    if len(groups) > 1 and len(gaps) >= len(groups) - 1:
        # pick the longest pauses as group breaks, in time order
        br = sorted(sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)[:len(groups) - 1])
        cur_s = s0
        for (a, b) in br: spans.append((cur_s, a)); cur_s = b
        spans.append((cur_s, e0))
    else:
        tot = sum(len(re.sub(r"\W", "", w)) + 1 for w in words); acc = s0
        for g in groups:
            d = (e0 - s0) * sum(len(re.sub(r"\W", "", w)) + 1 for w in g) / tot; spans.append((acc, acc + d)); acc += d
    times = []
    for (a, b), g in zip(spans, groups):
        wts = np.array([0.6 + len(re.sub(r"\W", "", w)) for w in g]); bounds = [a]; acc = a
        for k in range(len(g) - 1):
            acc += (b - a) * wts[k] / wts.sum()
            i0, i1 = int((acc - 0.08) / HOP), int((acc + 0.08) / HOP)
            i0, i1 = max(i0, int(a / HOP) + 1), min(i1, int(b / HOP) - 1)
            snap = (i0 + int(np.argmin(db[i0:i1]))) * HOP if i1 > i0 else acc
            snap = max(snap, bounds[-1] + 0.05); bounds.append(snap); acc = snap
        bounds.append(b)
        times += [(bounds[k], bounds[k + 1]) for k in range(len(g))]
    chars = list(text); st = [0.0] * len(chars); en = [0.0] * len(chars); pos = 0
    for w, (ws, we) in zip(words, times):
        j = text.find(w, pos); idx = [k for k in range(j, j + len(w)) if text[k].isalnum() or text[k] == "'"]
        for m, k in enumerate(idx):
            st[k] = ws + (we - ws) * m / len(idx); en[k] = ws + (we - ws) * (m + 1) / len(idx)
        pos = j + len(w)
    last = 0.0
    for k, c in enumerate(chars):
        if c.isalnum() or c == "'": last = en[k]
        else: st[k] = en[k] = last
    (LD / f"{lid}_align.json").write_text(json.dumps({"text": text, "source": "local energy alignment",
        "alignment": {"characters": chars, "character_start_times_seconds": [round(v, 4) for v in st],
                      "character_end_times_seconds": [round(v, 4) for v in en]}}, indent=1))
    return s0, e0


if __name__ == "__main__":
    for lid, spk, text in LINES:
        if not (LD / f"{lid}.mp3").exists() or (LD / f"{lid}.json").exists():
            continue
        s0, e0 = align(lid, text)
        print(f"{lid} {s0:5.2f}-{e0:5.2f}s  {text}")
