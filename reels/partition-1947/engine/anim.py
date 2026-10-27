"""Easing curves, pop-in helpers and the camera track."""
import math

import numpy as np


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def prog(T, t0, dur):
    return clamp((T - t0) / dur) if dur > 0 else float(T >= t0)


def ease_in_out(t):
    t = clamp(t)
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t * t * t


def ease_out_back(t, k=1.9):
    t = clamp(t) - 1
    return 1 + (k + 1) * t ** 3 + k * t ** 2


def ease_in_back(t, k=1.5):
    t = clamp(t)
    return (k + 1) * t ** 3 - k * t ** 2


def ease_out_bounce(t):
    t = clamp(t)
    n, d = 7.5625, 2.75
    if t < 1 / d:
        return n * t * t
    if t < 2 / d:
        t -= 1.5 / d
        return n * t * t + 0.75
    if t < 2.5 / d:
        t -= 2.25 / d
        return n * t * t + 0.9375
    t -= 2.625 / d
    return n * t * t + 0.984375


def pop(T, t_in, t_out=None, din=0.34, dout=0.24, k=2.1):
    """Scale for a sticker that pops in with overshoot and pops out."""
    if T < t_in:
        return 0.0
    s = ease_out_back((T - t_in) / din, k)
    if t_out is not None and T > t_out:
        s *= 1 - ease_in_back((T - t_out) / dout, 1.6)
    return max(0.0, s)


def squash(T, t_in, din=0.34):
    """(sx, sy) wobble that settles after a pop."""
    u = (T - t_in) / din
    if u < 0 or u > 2.2:
        return 1.0, 1.0
    a = 0.16 * math.exp(-2.2 * u) * math.sin(u * 9.0)
    return 1 + a, 1 - a


def fade(T, t_in, t_out=None, din=0.2, dout=0.25):
    a = prog(T, t_in, din)
    if t_out is not None:
        a *= 1 - prog(T, t_out, dout)
    return a


class CamTrack:
    """Camera keyframes. Between moves the camera keeps a slow push-in so
    the map never sits still (as in the reference)."""

    def __init__(self, cx, cy, s, rot=0.0, drift=0.018):
        self.init = (cx, cy, s, rot)
        self.moves = []
        self.drift = drift

    def move(self, t0, dur, cx=None, cy=None, s=None, rot=None, ease=ease_in_out, drift=None):
        self.moves.append((t0, t0 + max(dur, 1e-3), (cx, cy, s, rot), ease, drift))
        self.moves.sort(key=lambda m: m[0])
        return t0 + dur

    def at(self, T):
        cx, cy, s, rot = self.init
        t_state = 0.0
        rate = self.drift
        for t0, t1, (tx, ty, ts, tr), ease, drift in self.moves:
            upto = min(T, t0)
            if upto > t_state:
                s *= math.exp(rate * (upto - t_state))
                t_state = upto
            if T < t0:
                return cx, cy, s, rot
            tx = cx if tx is None else tx
            ty = cy if ty is None else ty
            ts = s if ts is None else ts
            tr = rot if tr is None else tr
            if T < t1:
                e = ease((T - t0) / (t1 - t0))
                return (lerp(cx, tx, e), lerp(cy, ty, e),
                        math.exp(lerp(math.log(s), math.log(ts), e)), lerp(rot, tr, e))
            cx, cy, s, rot = tx, ty, ts, tr
            t_state = t1
            if drift is not None:
                rate = drift
        if T > t_state:
            s *= math.exp(rate * (T - t_state))
        return cx, cy, s, rot


def word_weights(words):
    """Rough spoken length of each word (syllables + pauses at punctuation)."""
    out = []
    for w in words:
        core = ''.join(ch for ch in w.lower() if ch.isalnum())
        if core.isdigit():
            syl = {4: 6}.get(len(core), 2 + len(core) // 2)  # "unnees sau saintaalees"
        else:
            groups, prev = 0, False
            for ch in core:
                v = ch in 'aeiou'
                if v and not prev:
                    groups += 1
                prev = v
            syl = max(1, groups)
        pause = 0.0
        if w.endswith(('…', '...')):
            pause = 1.6
        elif w.endswith(('.', '?', '!')):
            pause = 1.3
        elif w.endswith((',', '—', ':', ';')) or w == '—':
            pause = 0.8
        out.append((syl + 0.6, pause))
    return out


def spread_words(words, t0, t1):
    """Evenly spread words over [t0, t1] weighted by spoken length.
    Returns a list of (start, end) per word."""
    wts = word_weights(words)
    total = sum(a + b for a, b in wts)
    scale = (t1 - t0) / total if total else 0
    t = t0
    out = []
    for a, b in wts:
        out.append((t, t + a * scale))
        t += (a + b) * scale
    return out
