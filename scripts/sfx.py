#!/usr/bin/env python3
"""Synthesize every sound effect in code (numpy only) -> audio/sfx/*.wav.

Used when the ElevenLabs Sound Effects API is not available. Deterministic (fixed seeds).
  python3 scripts/sfx.py           build missing files
  python3 scripts/sfx.py --force   rebuild everything
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_util import SR, write_wav  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'sfx')


# ----------------------------------------------------------------------------- DSP helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def fft_filter(x, lo=None, hi=None, order=2):
    """Zero-phase Butterworth-shaped high/low pass in the frequency domain."""
    n = len(x)
    N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    H = np.ones_like(f)
    if hi is not None:
        H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, N)[:n]


def conv(x, h):
    n = len(x) + len(h) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(h, N), N)[:n]


def reverb_ir(rt60=0.6, seed=1, damp=4000.0, predelay=0.012):
    """Synthetic room impulse response: decaying noise, high frequencies die faster."""
    rng = np.random.default_rng(seed)
    n = int(rt60 * 1.3 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    dark = fft_filter(noise, hi=damp * 0.35)
    bright = fft_filter(noise, hi=damp)
    k = np.exp(-6.9 * t / rt60)
    mixk = np.exp(-t / (rt60 * 0.25))
    ir = (bright * mixk + dark * (1 - mixk)) * k
    ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))


def add_reverb(x, wet=0.25, **kw):
    y = conv(x, reverb_ir(**kw))[: len(x) + int(kw.get('rt60', 0.6) * SR)]
    out = np.zeros(len(y))
    out[: len(x)] += x * (1 - wet * 0.5)
    return out + y * wet


def norm(x, peak_db=-1.0):
    p = np.max(np.abs(x)) + 1e-12
    return x * (10 ** (peak_db / 20) / p)


def env_adsr(n, a, d, s, r, sustain_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = max(0, int(sustain_len * SR))
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sl, s), np.linspace(s, 0, max(r, 1))])
    out = np.zeros(n)
    out[: min(n, len(e))] = e[:n]
    return out


def save(name, x, peak_db=-1.0, tail=0.25):
    os.makedirs(OUT, exist_ok=True)
    x = np.array(x, dtype=np.float64)
    k = min(len(x) // 4, int(tail * SR))
    x[-k:] *= np.linspace(1, 0, k) ** 2  # never end on a click
    write_wav(os.path.join(OUT, name), norm(x, peak_db))
    print(f'  sfx {name:18s} {len(x) / SR:6.2f}s')


# ----------------------------------------------------------------------------- formant (FOF) voice
VOWELS = {
    'a': [(760, 90, 0), (1220, 110, -5), (2550, 160, -18), (3500, 250, -28)],
    'e': [(560, 80, 0), (1850, 120, -8), (2600, 160, -16), (3500, 250, -28)],
    'o': [(500, 80, 0), (860, 100, -4), (2500, 170, -22), (3400, 250, -32)],
    'm': [(260, 60, 0), (1050, 170, -24), (2300, 220, -34), (3300, 300, -42)],  # nasal hum
}


def grain(vowel, scale=1.0, dur=0.03):
    t = np.arange(int(dur * SR)) / SR
    g = np.zeros(len(t))
    for F, B, dB in VOWELS[vowel]:
        F *= scale
        g += 10 ** (dB / 20) * np.exp(-np.pi * B * t) * np.sin(2 * np.pi * F * t)
    att = int(0.0012 * SR)
    g[:att] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, att))
    return g


def pulse_train(f0_curve, amp_curve, rng, jitter=0.01):
    """Impulses at glottal closure instants for a time-varying f0 (Hz per sample)."""
    phase = np.cumsum(f0_curve / SR)
    idx = np.nonzero(np.diff(np.floor(phase)) > 0)[0]
    out = np.zeros(len(f0_curve))
    if len(idx):
        jit = (rng.standard_normal(len(idx)) * jitter * SR / np.maximum(f0_curve[idx], 50)).astype(int)
        j = np.clip(idx + jit, 0, len(out) - 1)
        out[j] = amp_curve[idx] * (1 + rng.standard_normal(len(idx)) * 0.08)
    return out


# ----------------------------------------------------------------------------- canned laughter
def laugher(dur, rng, female):
    n = int(dur * SR)
    f0 = rng.uniform(235, 380) if female else rng.uniform(135, 215)
    vowel = rng.choice(['a', 'a', 'e', 'o'])
    scale = 1.16 if female else 1.0
    rate = rng.uniform(4.3, 5.8)
    start = rng.uniform(0.0, 0.35)
    length = rng.uniform(1.1, dur - start - 0.1)
    nsyl = max(2, int(length * rate))
    f0c = np.zeros(n)
    amp = np.zeros(n)
    asp = np.zeros(n)
    for k in range(nsyl):
        st = start + (k / rate) * (1 + rng.normal(0, 0.05))
        ln = (1 / rate) * rng.uniform(0.5, 0.72)
        a, b = int(st * SR), int((st + ln) * SR)
        if b >= n:
            break
        u = np.linspace(0, 1, b - a)
        level = np.exp(-k / (nsyl * 0.9)) * rng.uniform(0.6, 1.0) * (1.25 if k == 0 else 1)
        shape = np.sin(np.pi * np.clip(u * 1.15, 0, 1)) ** 0.6
        voiced = np.clip((u - 0.22) / 0.15, 0, 1)
        amp[a:b] = np.maximum(amp[a:b], shape * voiced * level)
        asp[a:b] = np.maximum(asp[a:b], shape * (1 - voiced * 0.75) * level)
        f0c[a:b] = f0 * (1 - 0.1 * k / nsyl) * (1.04 - 0.08 * u) * (1 + rng.normal(0, 0.03))
    f0c[f0c == 0] = f0
    g = grain(vowel, scale)
    voiced_sig = conv(pulse_train(f0c, amp, rng), g)[:n]
    breath = conv(rng.standard_normal(n) * asp * 0.05, g)[:n]
    return voiced_sig + breath


def laugh_burst(dur, seed, crowd=16):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    for i in range(crowd):
        v = laugher(dur, rng, female=rng.random() < 0.55)
        x += v / (np.max(np.abs(v)) + 1e-9) * (rng.uniform(0.75, 1.0) if i < 4 else rng.uniform(0.2, 0.55))
    # crowd murmur / far laughers: band-limited noise with 5 Hz flutter
    tt = t_axis(dur)
    flutter = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (4.6 + rng.random()) * tt + rng.random() * 6))
    murmur = fft_filter(rng.standard_normal(n), lo=350, hi=2600) * flutter
    shape = np.minimum(1, tt / 0.12) * np.exp(-np.maximum(0, tt - 0.4) / (dur * 0.45))
    x = x / np.max(np.abs(x)) + murmur / np.max(np.abs(murmur)) * 0.1
    x *= shape
    x = np.tanh(x * 1.4)
    x = fft_filter(x, lo=170, hi=5200)  # little TV speaker
    return add_reverb(x, wet=0.3, rt60=0.9, seed=seed, damp=5000)


# ----------------------------------------------------------------------------- cartoon soundtrack
def marimba(f, dur=0.5):
    t = t_axis(dur)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t * 30) + 0.08 * np.sin(2 * np.pi * 9.8 * f * t) * np.exp(-t * 60)) * np.exp(-t * 7.5) * np.minimum(1, t / 0.002)


def pluck(f, dur=0.35):
    t = t_axis(dur)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 11) * np.minimum(1, t / 0.003)


def cartoon_bed(dur, seed=5):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    beat = 60 / 136
    scale = [0, 2, 4, 7, 9, 12, 14, 16]
    chords = [0, 5, 7, 0]  # C F G C
    note = 4
    k = 0
    tt = 0.0
    while tt < dur - 1:
        bar = int(tt / (beat * 4)) % 4
        root = 48 + chords[bar]
        # melody: eighth notes, random walk on the pentatonic, some rests
        if rng.random() > 0.18:
            note = int(np.clip(note + rng.choice([-2, -1, 1, 1, 2]), 0, len(scale) - 1))
            midi = 72 + scale[note]
            s = marimba(440 * 2 ** ((midi - 69) / 12)) * 0.5
            a = int(tt * SR)
            x[a: a + len(s)] += s[: max(0, n - a)]
        if k % 2 == 0:  # bass on beats
            s = pluck(440 * 2 ** ((root - 12 - 69) / 12)) * 0.55
            a = int(tt * SR)
            x[a: a + len(s)] += s[: max(0, n - a)]
        if k % 2 == 1:  # woodblock on off-beats
            s = fft_filter(rng.standard_normal(int(0.03 * SR)), lo=900, hi=2200) * np.exp(-np.arange(int(0.03 * SR)) / (0.006 * SR)) * 0.6
            a = int(tt * SR)
            x[a: a + len(s)] += s[: max(0, n - a)]
        tt += beat / 2
        k += 1
    x = fft_filter(np.tanh(x * 1.2), lo=160, hi=6500)
    return add_reverb(x, wet=0.22, rt60=0.7, seed=seed)


def gag_fx(seed):
    """Slide whistle down + bonk + boing (synced to the anvil gag in the cartoon)."""
    rng = np.random.default_rng(seed)
    dur = 1.4
    t = t_axis(dur)
    x = np.zeros(len(t))
    # slide whistle 0..0.3 s
    m = t < 0.3
    f = 1500 - 900 * (t[m] / 0.3)
    x[m] += np.sin(2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 9 * t[m]))) / SR) * 0.35
    # bonk at 0.32
    a = int(0.32 * SR)
    tb = t[: int(0.3 * SR)]
    bonk = np.sin(2 * np.pi * np.cumsum(300 * np.exp(-tb * 7) + 90) / SR) * np.exp(-tb * 14)
    bonk += fft_filter(rng.standard_normal(len(tb)), lo=1500, hi=6000) * np.exp(-tb * 120) * 0.4
    x[a: a + len(bonk)] += bonk * 0.9
    # boing 0.5..1.3
    a = int(0.5 * SR)
    tq = t[: int(0.8 * SR)]
    boing = np.sin(2 * np.pi * np.cumsum(230 - 50 * tq + 25 * np.sin(2 * np.pi * 13 * tq) * np.exp(-tq * 3)) / SR) * np.exp(-tq * 4.5)
    x[a: a + len(boing)] += boing * 0.5
    return add_reverb(fft_filter(x, lo=160, hi=6500), wet=0.2, rt60=0.6, seed=seed)


# ----------------------------------------------------------------------------- humming
def humming(dur, seed=8):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    # gentle original lullaby (MIDI, beats); 76 BPM
    phrase = [(60, 1), (64, 1), (67, 1.5), (65, 0.5), (64, 1), (62, 1), (60, 2), (None, 1),
              (62, 1), (65, 1), (69, 1.5), (67, 0.5), (65, 1), (64, 1), (62, 2), (None, 1),
              (60, 1), (64, 1), (67, 1), (72, 1), (71, 1.5), (69, 0.5), (67, 2), (None, 0.5),
              (65, 1), (64, 1), (62, 1), (64, 1), (60, 3), (None, 1.5)]
    beat = 60 / 76
    f0 = np.zeros(n)
    amp = np.zeros(n)
    tt = 0.0
    i = 0
    prev = None
    while tt < dur:
        midi, b = phrase[i % len(phrase)]
        ln = b * beat
        a0, a1 = int(tt * SR), min(n, int((tt + ln) * SR))
        if midi is not None and a1 > a0:
            f = 440 * 2 ** ((midi - 12 - 69) / 12) * 2  # around C4..C5
            u = np.arange(a1 - a0) / SR
            start_f = prev if prev else f
            glide = start_f + (f - start_f) * np.minimum(1, u / 0.08)
            vib = 1 + 0.012 * np.sin(2 * np.pi * 5.3 * u + i) * np.minimum(1, u / 0.35)
            f0[a0:a1] = glide * vib
            e = np.minimum(1, u / 0.07) * np.minimum(1, (ln - u) / 0.12)
            amp[a0:a1] = np.clip(e, 0, 1) * (0.8 + 0.2 * rng.random())
            prev = f
        else:
            f0[a0:a1] = prev or 262
            prev = None
        tt += ln
        i += 1
    f0[f0 == 0] = 262
    amp = fft_filter(amp, hi=12)  # smooth phrasing
    x = conv(pulse_train(f0, np.clip(amp, 0, None), rng, jitter=0.004), grain('m', 1.0, 0.04))[:n]
    x += fft_filter(rng.standard_normal(n), lo=200, hi=1200) * np.clip(amp, 0, None) * 0.01
    x = fft_filter(x, lo=120, hi=3800)
    return add_reverb(x, wet=0.35, rt60=0.7, seed=seed, damp=3500)


# ----------------------------------------------------------------------------- kitchen
def stir_cycle(period=1.2, seed=9):
    """One stirring circle: spoon dragging through thick soup + a light tap on the pot wall."""
    rng = np.random.default_rng(seed)
    t = t_axis(period)
    n = len(t)
    th = 2 * np.pi * t / period
    drag = (0.55 + 0.45 * np.sin(th) ** 2)
    scrape = fft_filter(rng.standard_normal(n), lo=700, hi=2600) * drag * 0.25
    slosh = fft_filter(rng.standard_normal(n), lo=120, hi=520) * (0.5 + 0.5 * np.abs(np.sin(th * 2 + 0.5))) * 0.9
    x = scrape + slosh * 0.6
    a = int(0.62 * period * SR)
    tp = t[: int(0.12 * SR)]
    tap = (np.sin(2 * np.pi * 1560 * tp) + 0.6 * np.sin(2 * np.pi * 2620 * tp) + 0.4 * np.sin(2 * np.pi * 4100 * tp)) * np.exp(-tp * 55)
    x[a: a + len(tap)] += tap * 0.18
    x[:200] *= np.linspace(0, 1, 200)
    x[-200:] *= np.linspace(1, 0, 200)
    return x


def sizzle(dur=20, seed=10):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = np.zeros(n)
    cnt = int(dur * 75)
    pos = rng.integers(0, n - 200, cnt)
    for p in pos:
        L = int(rng.uniform(0.0006, 0.003) * SR)
        x[p: p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L * 0.3)) * np.exp(rng.normal(0, 0.9))
    x = fft_filter(x, lo=2200, hi=12000)
    hiss = fft_filter(rng.standard_normal(n), lo=4000, hi=11000) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.27 * t_axis(dur)))
    return x / np.max(np.abs(x)) + hiss / np.max(np.abs(hiss)) * 0.35


def fridge(dur=20, seed=11):
    rng = np.random.default_rng(seed)
    t = t_axis(dur)
    x = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) for f, a in [(60, 1), (120, 0.55), (180, 0.25), (240, 0.12)])
    x *= 1 + 0.08 * np.sin(2 * np.pi * 0.31 * t)
    x += fft_filter(rng.standard_normal(len(t)), lo=40, hi=300) * 0.2
    return x


# ----------------------------------------------------------------------------- living room
def tick(pitch=1.0, seed=12):
    rng = np.random.default_rng(seed)
    t = t_axis(0.09)
    x = np.zeros(len(t))
    for f, a, d in [(2300 * pitch, 1.0, 140), (3500 * pitch, 0.6, 220), (850 * pitch, 0.5, 90)]:
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
    x += fft_filter(rng.standard_normal(len(t)), lo=2000, hi=8000) * np.exp(-t * 400) * 0.6
    return add_reverb(x, wet=0.2, rt60=0.5, seed=seed)


def phone_buzz(seed=13):
    """Two vibration pulses (0.42 s on, 0.2 s off) muffled by the sofa cushion."""
    rng = np.random.default_rng(seed)
    t = t_axis(1.2)
    f = 172 + 3 * np.sin(2 * np.pi * 7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sign(np.sin(ph)) * 0.6 + np.sin(ph) * 0.4
    gate = ((t < 0.42) | ((t >= 0.62) & (t < 1.04))).astype(float)
    gate = fft_filter(gate, hi=60)
    x = x * gate + fft_filter(rng.standard_normal(len(t)), lo=900, hi=3000) * gate * 0.08
    return fft_filter(x, lo=90, hi=1600)


def popcorn_crunch(seed=14):
    rng = np.random.default_rng(seed)
    n = int(1.1 * SR)
    x = np.zeros(n)
    for c in [0.0, 0.24, 0.47, 0.71]:
        base = int((c + rng.uniform(0, 0.03)) * SR)
        for _ in range(rng.integers(10, 22)):
            p = base + int(rng.uniform(0, 0.07) * SR)
            L = int(rng.uniform(0.001, 0.005) * SR)
            if p + L < n:
                x[p: p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L * 0.35)) * rng.uniform(0.3, 1)
        L = int(0.06 * SR)
        x[base: base + L] += fft_filter(rng.standard_normal(L), hi=260) * np.exp(-np.arange(L) / (0.015 * SR)) * 2.5
    return fft_filter(x, lo=80, hi=7000)


# ----------------------------------------------------------------------------- horror
def drone(dur=70, seed=15):
    rng = np.random.default_rng(seed)
    t = t_axis(dur)
    x = 0.9 * np.sin(2 * np.pi * 41.2 * t) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.05 * t))
    x += 0.3 * np.sin(2 * np.pi * 82.4 * t + 1)
    for f, a in [(82.4, 0.35), (87.3, 0.3), (123.5, 0.15)]:
        saw = sum(np.sin(2 * np.pi * f * h * t + rng.random() * 6) / h for h in range(1, 9))
        x += a * fft_filter(saw, hi=520) * (0.7 + 0.3 * np.sin(2 * np.pi * (0.07 + 0.03 * rng.random()) * t + rng.random() * 6))
    air = fft_filter(rng.standard_normal(len(t)), lo=240, hi=900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t)) * 0.35
    eerie = (np.sin(2 * np.pi * 1318.5 * t) + np.sin(2 * np.pi * 1321.0 * t)) * 0.025 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t))
    return add_reverb(x + air + eerie, wet=0.3, rt60=2.2, seed=seed, damp=1500)[: len(t)]


def doorbell(seed=16):
    t = t_axis(4.6)
    x = np.zeros(len(t))
    for st, f in [(0.0, 659.25), (0.6, 523.25)]:
        a = int(st * SR)
        tt = t[: len(t) - a]
        tone = np.zeros(len(tt))
        for ratio, amp, dec in [(1, 1, 1.8), (2.76, 0.45, 0.7), (5.40, 0.2, 0.3), (8.93, 0.08, 0.15)]:
            for det in (-0.0009, 0.0009):
                tone += amp * np.sin(2 * np.pi * f * ratio * (1 + det) * tt) * np.exp(-tt / dec)
        click = np.random.default_rng(seed).standard_normal(len(tt)) * np.exp(-tt * 900) * 0.6
        x[a:] += (tone + fft_filter(click, lo=2000, hi=7000)) * np.minimum(1, tt / 0.002)
    return add_reverb(x, wet=0.3, rt60=1.0, seed=seed)


def bass_hit(seed=17):
    rng = np.random.default_rng(seed)
    t = t_axis(3.8)
    f = 30 + 40 * np.exp(-t * 3.2)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.1) * np.minimum(1, t / 0.004)
    thump = fft_filter(rng.standard_normal(len(t)), hi=280) * np.exp(-t * 30) * 2.5
    hitn = fft_filter(rng.standard_normal(len(t)), lo=600, hi=5000) * np.exp(-t * 60) * 0.5
    x = np.tanh((sub + thump) * 1.8) + hitn
    return add_reverb(x, wet=0.35, rt60=2.6, seed=seed, damp=1200)[: len(t)]


def riser(seed=18):
    rng = np.random.default_rng(seed)
    t = t_axis(1.1)
    sw = (t / t[-1]) ** 3
    x = fft_filter(rng.standard_normal(len(t)), lo=2500, hi=11000) * sw
    x += np.sin(2 * np.pi * np.cumsum(220 + 500 * sw) / SR) * sw * 0.25
    x[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return x


def knocks(seed=21):
    """Three knuckle knocks on a wooden front door, heard from inside."""
    rng = np.random.default_rng(seed)
    t = t_axis(1.2)
    x = np.zeros(len(t))
    for k, st in enumerate([0.0, 0.2, 0.4]):
        a = int(st * SR)
        tt = t[: len(t) - a]
        body = sum(amp * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, amp, d in [(110, 1.0, 28), (190, 0.6, 35), (420, 0.35, 60), (880, 0.15, 90)])
        snap = fft_filter(rng.standard_normal(len(tt)), lo=600, hi=3500) * np.exp(-tt * 260) * 0.5
        x[a:] += (body + snap) * (1.0 - 0.08 * k)
    return add_reverb(fft_filter(x, hi=2500), wet=0.25, rt60=0.8, seed=seed)


BUILDERS = {
    'knock.wav': knocks,
    'tv_cartoon.wav': lambda: cartoon_bed(72),
    'hum.wav': lambda: humming(32),
    'stir_cycle.wav': lambda: stir_cycle(),
    'sizzle.wav': lambda: sizzle(),
    'fridge.wav': lambda: fridge(),
    'tick.wav': lambda: tick(1.0, 12),
    'tock.wav': lambda: tick(0.86, 19),
    'phone_buzz.wav': phone_buzz,
    'popcorn.wav': popcorn_crunch,
    'drone.wav': lambda: drone(72),
    'doorbell.wav': doorbell,
    'bass_hit.wav': bass_hit,
    'riser.wav': riser,
}
for i in range(6):
    BUILDERS[f'laugh_{i}.wav'] = (lambda i=i: laugh_burst(3.0, 100 + i))
for i in range(3):
    BUILDERS[f'gag_{i}.wav'] = (lambda i=i: gag_fx(200 + i))

if __name__ == '__main__':
    force = '--force' in sys.argv
    for name, fn in BUILDERS.items():
        if force or not os.path.exists(os.path.join(OUT, name)):
            save(name, fn())
        else:
            print(f'  sfx {name:18s} cached')
