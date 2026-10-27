"""Cartoon vocal sounds made with code: a glottal source through moving vowel formants.

A phrase is a list of syllables; each syllable has a duration, a pitch contour, a vowel (or a glide
between vowels), loudness, breathiness and optional consonant noise at the start. Good enough for
laughs, screams, groans, cackles, "meh", yawns, gasps, chicken squawks and ghostly "ooo"s.
"""
import numpy as np
from scipy import signal
from .dsp import SR, TAU, n_of, rng, curve, lowpass, highpass, bandpass, harmonic, noise, _rbj, fade

# formant frequencies (Hz) and bandwidths for an adult male voice; children/ghosts scale them up
VOWELS = {
    'a': (730, 1090, 2440, 3400), 'ae': (660, 1720, 2410, 3400), 'e': (530, 1840, 2480, 3400),
    'i': (300, 2290, 3010, 3600), 'o': (570, 840, 2410, 3300), 'u': (320, 870, 2240, 3300),
    'uh': (640, 1190, 2390, 3300), 'er': (490, 1350, 1690, 3300), 'm': (260, 1100, 2300, 3300),
    'oo': (360, 760, 2300, 3300), 'aw': (650, 980, 2500, 3300),
}
BW = (80, 100, 140, 180)
GAINS = (1.0, 0.55, 0.32, 0.18)


def _formant_filter(src, f_tracks, bws, gains, block=96):
    """Parallel resonators with time-varying centre frequencies (updated per block)."""
    y = np.zeros_like(src)
    for k in range(len(f_tracks)):
        zi = np.zeros(2)
        out = np.zeros_like(src)
        for i in range(0, len(src), block):
            j = min(len(src), i + block)
            f = float(f_tracks[k][(i + j) // 2])
            q = max(0.5, f / bws[k])
            b, a = _rbj('bp', f, q)
            out[i:j], zi = signal.lfilter(b, a, src[i:j], zi=zi)
        y += gains[k] * out
    return y


def syllable(dur, f0, vowel='a', vowel_end=None, scale=1.0, breath=0.08, onset=None, onset_dur=0.04,
             vib=(0.0, 5.5), jitter=0.0, creak=0.0, tilt=-9.0, attack=0.015, release=0.05, amp=1.0, seed=1,
             nasal=0.0, env=None):
    """One voiced syllable.
    f0: number or [(t, hz), ...] contour; vowel/vowel_end: formant targets (glide between them);
    scale: formant scale (1 adult male, ~1.2 woman, ~1.3 child); onset: 'h' (breath), 's', 'b', 'k', 'g' consonant noise."""
    n = n_of(dur)
    r = rng(seed)
    t = np.arange(n) / SR
    f = curve(f0, dur, 'exp') if isinstance(f0, (list, tuple)) else np.full(n, float(f0))
    depth, rate = vib
    if depth:
        f = f * 2 ** (depth / 1200 * np.sin(TAU * rate * t + r.uniform(0, TAU)))
    if jitter:
        jn = lowpass(r.standard_normal(n), 30, 1)
        f = f * (1 + jitter * jn / (np.std(jn) + 1e-9))
    src = harmonic(f, tilt=tilt, nmax=48)
    if creak:   # vocal fry: amplitude pulses at a low rate + a subharmonic
        fry = 0.5 + 0.5 * np.sign(np.sin(TAU * phase_cum(f * 0.5)))
        src = src * (1 - creak + creak * fry) + creak * 0.3 * np.sin(TAU * phase_cum(f * 0.5))
    src = src / (np.std(src) + 1e-9)
    asp = highpass(r.standard_normal(n), 600) * breath * 2.2
    v0 = np.array(VOWELS[vowel]) * scale
    v1 = np.array(VOWELS[vowel_end or vowel]) * scale
    k = np.clip(t / max(dur * 0.85, 1e-3), 0, 1)
    k = k * k * (3 - 2 * k)
    tracks = [v0[i] + (v1[i] - v0[i]) * k for i in range(4)]
    voiced = _formant_filter(src + asp, tracks, [b * (1.25 if scale > 1.15 else 1) for b in BW], GAINS)
    if nasal:
        voiced = (1 - nasal) * voiced + nasal * lowpass(_formant_filter(src, [np.full(n, 250 * scale)], [60], [1.0]), 1200)
    if env is None:
        e = np.clip(t / attack, 0, 1) * np.clip((dur - t) / release, 0, 1)
    else:
        e = curve(env, dur)
    out = voiced * e
    if onset:
        out = add_consonant(out, onset, onset_dur, scale, seed + 17, tracks)
    return amp * out / (np.max(np.abs(out)) + 1e-9)


def phase_cum(f):
    return np.cumsum(f) / SR


def add_consonant(x, kind, dur, scale, seed, tracks=None):
    r = rng(seed)
    n = n_of(dur)
    nz = r.standard_normal(n)
    if kind == 'h':      # breath through the coming vowel
        c = _formant_filter(nz, [tr[:n] if len(tr) >= n else np.full(n, tr[0]) for tr in tracks], (200, 220, 260, 300), GAINS) * 0.9
        c *= np.sin(np.linspace(0, np.pi, n)) ** 0.7
        y = np.concatenate([c, np.zeros(len(x))])
        y[n // 2:n // 2 + len(x)] += x
        return y
    if kind in ('s', 'sh'):
        c = bandpass(nz, 4200 if kind == 's' else 2200, 9000 if kind == 's' else 6000) * np.sin(np.linspace(0, np.pi, n)) * 0.6
        return np.concatenate([c, x])
    if kind in ('b', 'g', 'k', 'p', 't'):   # short silence + burst
        lo = {'b': 300, 'p': 500, 'g': 900, 'k': 1500, 't': 3000}[kind]
        b = bandpass(nz[:n_of(0.012)], lo, lo * 4) * np.exp(-np.linspace(0, 6, n_of(0.012))) * (0.7 if kind in 'ptk' else 0.4)
        return np.concatenate([np.zeros(n_of(0.01)), b, x])
    return x


def phrase(sylls, gap=0.0):
    """Concatenate syllables (each a dict of syllable() kwargs plus optional 'gap' before it)."""
    parts = []
    for s in sylls:
        s = dict(s)
        g = s.pop('gap', gap)
        if g > 0:
            parts.append(np.zeros(n_of(g)))
        elif g < 0 and parts:   # overlap (legato)
            y = syllable(**s)
            ov = min(n_of(-g), len(parts[-1]), len(y))
            tail = parts[-1]
            tail[-ov:] = tail[-ov:] + y[:ov]
            parts.append(y[ov:])
            continue
        parts.append(syllable(**s))
    return np.concatenate(parts) if parts else np.zeros(1)


def breath_noise(dur, vowel='a', scale=1.0, inhale=False, seed=3, env=None):
    """Breath only (gasps, sighs, whispers)."""
    n = n_of(dur)
    nz = rng(seed).standard_normal(n)
    v = np.array(VOWELS[vowel]) * scale
    y = _formant_filter(nz, [np.full(n, f) for f in v], (180, 220, 280, 340), GAINS)
    y += 0.3 * highpass(nz, 3000)
    e = curve(env, dur) if env else (np.linspace(0, 1, n) ** 0.5 if inhale else np.linspace(1, 0, n) ** 1.5)
    y = fade(y * e, 0.01, 0.03)
    return y / (np.max(np.abs(y)) + 1e-9)
