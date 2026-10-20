#!/usr/bin/env python3
"""Offline word timing for a known script (used when ElevenLabs alignment is unavailable).

Splits the trimmed take into voiced segments, matches the biggest pauses to the script's
punctuation phrases, then spreads words inside each phrase by syllable weight.

  python3 scripts/align_local.py <take.wav> "<script text>"   -> JSON list of {word,start,end}
"""
import itertools
import json
import re
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from audio_util import SR, decode, rms_windows  # noqa: E402


def voiced_segments(a, min_gap=0.11):
    r, n = rms_windows(a, SR, 0.01)
    db = 20 * np.log10(r)
    noise, speech = np.percentile(db, 10), np.percentile(db, 90)
    thr = max(noise + 8.0, speech - 30.0)
    on = db > thr
    segs, start = [], None
    for i, v in enumerate(on):
        t = i * n / SR
        if v and start is None:
            start = t
        if not v and start is not None:
            segs.append([start, t])
            start = None
    if start is not None:
        segs.append([start, len(on) * n / SR])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] > 0.04]


def phrases(text):
    """Split at sentence-level punctuation only (commas are too unreliable as pauses)."""
    words = text.replace('...', '... ').split()
    out, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[.?!…]$', w):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def syllables(w):
    w = re.sub(r'[^a-z]', '', w.lower())
    groups = re.findall(r'[aeiouy]+', w)
    n = len(groups)
    if w.endswith('e') and n > 1 and not w.endswith(('le', 'ee')):
        n -= 1
    return max(1, n)


def voiced_time(segs, s, e):
    return sum(max(0.0, min(b, e) - max(a, s)) for a, b in segs)


def best_cuts(segs, syl, k):
    """Pick k-1 gaps as phrase boundaries: wide pauses, plausible (even) speaking rates."""
    gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
    total_v = voiced_time(segs, segs[0][0], segs[-1][1])
    rate = sum(syl) / max(total_v, 1e-6)
    best, best_score = None, -1e9
    for cut in itertools.combinations(range(len(gaps)), k - 1):
        bounds, s0 = [], 0
        for c in list(cut) + [len(segs) - 1]:
            bounds.append((segs[s0][0], segs[c][1]))
            s0 = c + 1
        pen = sum(np.log(max(voiced_time(segs, a, b), 0.05) * rate / n) ** 2 for (a, b), n in zip(bounds, syl))
        score = sum(np.log(gaps[c] + 0.02) for c in cut) - 2.5 * pen
        if score > best_score:
            best, best_score = bounds, score
    return best


def spread(words, segs, s, e):
    """Place words inside [s, e] proportionally to syllable weight over *voiced* time only."""
    inner = [(max(a, s), min(b, e)) for a, b in segs if b > s and a < e]
    tot_v = sum(b - a for a, b in inner) or (e - s)
    if not inner:
        inner = [(s, e)]

    def at(v):  # voiced offset -> absolute time
        for a, b in inner:
            if v <= b - a:
                return a + v
            v -= b - a
        return inner[-1][1]

    wts = [syllables(w) + 0.6 for w in words]
    tot, acc, out = sum(wts), 0.0, []
    for w, wgt in zip(words, wts):
        d = tot_v * wgt / tot
        out.append({'word': w, 'start': round(at(acc + 1e-4), 3), 'end': round(at(acc + d), 3)})
        acc += d
    return out


def align(wav, text):
    a = decode(wav)
    segs = voiced_segments(a)
    ph = phrases(text)
    syl = [sum(syllables(w) for w in p) for p in ph]
    k = len(ph)
    spans = best_cuts(segs, syl, k) if len(segs) >= k and k > 1 else None
    if spans is None:  # one phrase, or not enough pauses: spread over the whole take
        t0, t1 = segs[0][0], segs[-1][1]
        spans, acc = [], t0
        for n in syl:
            d = (t1 - t0) * n / sum(syl)
            spans.append((acc, acc + d))
            acc += d
    out = []
    for p, (s, e) in zip(ph, spans):
        out += spread(p, segs, s, e)
    return out


if __name__ == '__main__':
    print(json.dumps(align(sys.argv[1], sys.argv[2])))
