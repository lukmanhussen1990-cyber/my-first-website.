"""Syllable envelope for the S6 reply waveform: "¡Muy bien! Pedí un café en español."

The reply is captioned, never voiced.  Its waveform follows the sentence's own eleven
syllables and stress pattern, keyed to the caption's word reveals (timeline event
reply_caption): each word's syllables share its reveal interval, stressed syllables are
louder and longer, the phrase declines slightly, and the final syllable is lengthened
and decays by f664.  (A recorded control line was planned; ElevenLabs refused that
request, see vo/VOICE.md.)
"""

from __future__ import annotations

import numpy as np

# (caption unit, [(syllable, stressed)]); stress: ¡Muy BIEN! Pe-DÍ un ca-FÉ en es-pa-ÑOL.
WORDS = [
    ("¡Muy bien!", [("muy", False), ("bien", True)]),
    ("Pedí", [("pe", False), ("dí", True)]),
    ("un", [("un", False)]),
    ("café", [("ca", False), ("fé", True)]),
    ("en", [("en", False)]),
    ("español.", [("es", False), ("pa", False), ("ñol", True)]),
]
REVEAL_F = [596, 602, 610, 616, 622, 630]   # caption reveals (brief S6)
WAVE_F = (594, 664)                          # the line is a waveform over these frames
SPEECH_END_F = 656                           # last syllable ends; the tail decays to WAVE_F[1]
STRESS_GAIN, UNSTRESSED_GAIN = 1.0, 0.62
STRESS_LEN, FINAL_LEN = 1.4, 1.6
DECLINATION = 0.18                           # overall level falls 18 % across the phrase


def syllables():
    """Every syllable with its frame span (fractional frames)."""
    out = []
    ends = REVEAL_F[1:] + [SPEECH_END_F]
    for (unit, syls), f0, f1 in zip(WORDS, REVEAL_F, ends):
        w = [STRESS_LEN if s else 1.0 for _, s in syls]
        if unit.endswith("."):
            w[-1] *= FINAL_LEN
        t = float(f0)
        for (syl, s), wi in zip(syls, w):
            d = (f1 - f0) * wi / sum(w)
            out.append({"unit": unit, "syllable": syl, "stressed": s, "f0": t, "f1": t + d})
            t += d
    return out


def amplitude(f):
    """Envelope in [0, 1] at frame(s) f (fractional frames allowed, for motion-blur samples)."""
    f = np.asarray(f, float)
    a = np.zeros_like(f)
    for s in syllables():
        d = s["f1"] - s["f0"]
        u = (f - s["f0"]) / d
        att = np.clip(u / 0.25, 0, 1)
        dec = np.clip((1.0 - u) / 0.75, 0, 1)
        bump = np.where((u >= 0) & (u <= 1), np.sin(0.5 * np.pi * att) * (0.35 + 0.65 * dec), 0.0)
        g = STRESS_GAIN if s["stressed"] else UNSTRESSED_GAIN
        a = np.maximum(a, g * bump)
    decl = 1.0 - DECLINATION * np.clip((f - REVEAL_F[0]) / (SPEECH_END_F - REVEAL_F[0]), 0, 1)
    tail = np.clip((WAVE_F[1] - f) / (WAVE_F[1] - SPEECH_END_F), 0, 1)
    a = a * decl
    last = syllables()[-1]
    hold = (f >= last["f1"]) & (f <= WAVE_F[1])
    a = np.where(hold, STRESS_GAIN * 0.35 * (1 - DECLINATION) * tail ** 2, a)
    return np.where((f >= WAVE_F[0]) & (f <= WAVE_F[1]), a, 0.0)
