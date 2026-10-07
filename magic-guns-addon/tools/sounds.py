"""
sounds.py - synthesises every Magic Guns sound effect from scratch (numpy)
and encodes it to mono 44.1 kHz Ogg Vorbis with ffmpeg.

    python3 sounds.py <resource_pack_dir>

Every gunshot is built the same way a real one is mixed:

    transient   blast pulse (Friedlander wave) + sub-ms noise crack
    action      modal "click" of the mechanism (hammer, bolt, cylinder)
    body        three noise bands (crack 2-10 kHz / body 200-2k / low 40-400)
                that decay at different speeds, so the shot darkens naturally
    thump       pitch-dropping sine kick, saturated so phones still hear it
    tail        early reflections + frequency-dependent reverb (+ echoes)

then the magic layer of each weapon is laid on top, slightly after the
transient, and the whole thing goes through a punchy bus compressor, a
look-ahead peak limiter and loudness normalisation (EBU R128 / LUFS) so all
fire sounds sit at the same perceived level.

VARIANTS lists how many files each sound has (<name>.ogg, <name>_2.ogg ...);
the game picks one at random per shot.  Output is fully deterministic.
"""

import os
import subprocess
import sys
import tempfile
import wave
import zlib

import numpy as np

SR = 44100
rng = np.random.default_rng(1234)  # re-seeded per sound / variant in render()

VARIANTS = {
    "arcane_fire": 3, "inferno_fire": 3, "frost_fire": 3, "storm_fire": 3,
    "soul_fire": 3, "void_fire": 3, "holy_fire": 3,
    "arcane_hit": 2, "inferno_hit": 2, "frost_hit": 2, "storm_hit": 2,
    "soul_hit": 2, "void_hit": 2, "holy_hit": 2,
}

# small per-variant pitch offsets (the script adds its own +-8 % on top)
PITCH = (1.0, 0.972, 1.03)

LOUD_FIRE = -14.0   # integrated loudness targets (LUFS)
LOUD_HIT = -18.0


# ------------------------------------------------------------------ basics

def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def tail(n, ms=25):
    """Fade the last few ms to zero so components never end with a click."""
    f = np.ones(n)
    k = min(n, int(SR * ms / 1000))
    if k > 1:
        f[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return f


def env(dur, attack=0.002, decay=0.3, curve=1.0, hold=0.0, fade_ms=25):
    """Linear attack, optional hold, exponential decay, click-free end."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    d = np.exp(-np.maximum(t - attack - hold, 0) / max(decay, 1e-6)) ** curve
    return a * d * tail(len(t), fade_ms)


def env2(dur, attack, fast, slow, ratio=0.3, fade_ms=25):
    """Two-stage decay: a fast initial drop followed by a slower tail."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    u = np.maximum(t - attack, 0)
    return a * ((1 - ratio) * np.exp(-u / fast) + ratio * np.exp(-u / slow)) * tail(len(t), fade_ms)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def at(x, t0):
    """Delay a layer by t0 seconds."""
    return np.concatenate([np.zeros(int(SR * t0)), x])


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def pad(x, dur):
    n = int(SR * dur)
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n] if len(x) < n else x


def _fast_len(n):
    return 1 << int(np.ceil(np.log2(max(n, 2))))


def fftconv(a, b):
    n = len(a) + len(b) - 1
    N = _fast_len(n)
    return np.fft.irfft(np.fft.rfft(a, N) * np.fft.rfft(b, N), N)[:n]


# ------------------------------------------------------------------ filters

def bandpass(x, lo, hi, slope=4):
    """Zero-phase FFT band-pass (use on noise *before* enveloping it)."""
    n = len(x)
    N = _fast_len(n + 4096)
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    lo_w = 1 / (1 + (lo / np.maximum(f, 1)) ** slope) if lo > 0 else 1
    hi_w = 1 / (1 + (f / hi) ** slope) if hi else 1
    return np.fft.irfft(X * lo_w * hi_w, N)[:n]


def _rbj(kind, f0, q=0.7071, gain_db=0.0):
    w0 = 2 * np.pi * f0 / SR
    c, s = np.cos(w0), np.sin(w0)
    al = s / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b, a = [(1 - c) / 2, 1 - c, (1 - c) / 2], [1 + al, -2 * c, 1 - al]
    elif kind == "hp":
        b, a = [(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]
    elif kind == "bp":
        b, a = [al, 0, -al], [1 + al, -2 * c, 1 - al]
    elif kind == "peak":
        b, a = [1 + al * A, -2 * c, 1 - al * A], [1 + al / A, -2 * c, 1 - al / A]
    elif kind == "hs":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    else:
        raise ValueError(kind)
    return np.array(b), np.array(a)


def iir(x, *stages, extra=16384):
    """Causal (minimum-phase) biquad cascade, evaluated exactly in the
    frequency domain.  stages: (kind, f0[, q[, gain_db]]) tuples."""
    n = len(x)
    N = _fast_len(n + extra)
    X = np.fft.rfft(x, N)
    z1 = np.exp(-2j * np.pi * np.fft.rfftfreq(N))
    for st in stages:
        b, a = _rbj(*st)
        X = X * (b[0] + b[1] * z1 + b[2] * z1 ** 2) / (a[0] + a[1] * z1 + a[2] * z1 ** 2)
    return np.fft.irfft(X, N)[:n]


def stft_shape(x, mask, n=1024, hop=256):
    """Time-varying spectral shaping: mask(t, f) -> gain, t = frame centre (s)."""
    L = len(x)
    xp = np.concatenate([np.zeros(n), x, np.zeros(n)])
    nfr = (len(xp) - n) // hop + 1
    win = np.hanning(n + 1)[:-1]
    idx = np.arange(n)[None, :] + hop * np.arange(nfr)[:, None]
    F = np.fft.rfft(xp[idx] * win, axis=1)
    tc = (hop * np.arange(nfr) + n / 2 - n) / SR
    f = np.fft.rfftfreq(n, 1 / SR)
    F *= mask(tc[:, None], f[None, :])
    fr = np.fft.irfft(F, n, axis=1) * win
    out = np.zeros(len(xp))
    for i in range(nfr):
        out[i * hop:i * hop + n] += fr[i]
    out /= (win ** 2).sum() / hop
    return out[n:n + L]


def sweep_noise(dur, f0, f1, bw=1.2, curve=1.0):
    """Noise through a band (Gaussian in octaves, width bw) gliding f0 -> f1."""
    def m(t, f):
        u = np.clip(t / dur, 0, 1) ** curve
        fc = f0 * (f1 / f0) ** u
        return np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / (bw / 2)) ** 2)
    return norm(stft_shape(noise(dur), m))


def formant(x, peaks):
    """Static vowel filter: peaks = [(freq, bandwidth, gain), ...]."""
    N = _fast_len(len(x) + 4096)
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    H = sum(g / (1 + ((f - fc) / (bw / 2)) ** 2) for fc, bw, g in peaks)
    return np.fft.irfft(X * H, N)[:len(x)]


# ------------------------------------------------------------------ sources

def chirp(dur, f0, f1, shape="exp", harmonics=(1.0,)):
    t = t_axis(dur)
    if shape == "exp":
        f = f0 * (f1 / f0) ** (t / dur)
    else:
        f = f0 + (f1 - f0) * (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros_like(t)
    for i, a in enumerate(harmonics):
        out += a * np.sin(phase * (i + 1))
    return out


def tone(dur, freq, decay, vibrato=0.0, vib_rate=5.5, harmonics=(1.0,), attack=0.003):
    t = t_axis(dur)
    ph = 2 * np.pi * freq * t + vibrato * np.sin(2 * np.pi * vib_rate * t)
    out = np.zeros_like(t)
    for i, a in enumerate(harmonics):
        out += a * np.sin(ph * (i + 1))
    return out * env(dur, attack, decay)


def thump(dur, f0, f1, ptau, decay, drive=1.5, attack=0.0006):
    """Kick-drum style pitch-dropping sine; tanh adds harmonics for small speakers."""
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t / ptau)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    if drive > 1:
        s = np.tanh(s * drive) / np.tanh(drive)
    return s * env(dur, attack, decay)


def blast(ms=1.2, dur=0.03):
    """Friedlander pressure pulse: instant rise, exp decay, negative phase."""
    T = ms / 1000
    t = t_axis(dur)
    p = (1 - t / T) * np.exp(-1.3 * t / T)
    p[:2] *= (0.35, 0.8)
    return norm(p * tail(len(t), 8))


def nwave(ms=0.35):
    """Supersonic bullet N-wave: a razor-sharp broadband crack."""
    n = max(4, int(SR * ms / 1000))
    w = np.linspace(1, -1, n)
    return np.concatenate([[0.5], w, [-0.5, 0.0]])


def modal(dur, freqs, decays, amps, attack=0.00008):
    """Damped resonant modes - metal clicks, bells, glass."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 0.6)) * np.exp(-t / d)
    return out * np.clip(t / attack, 0, 1) * tail(len(t), 6)


def click(freqs, decays, amps, ping=0.6, dur=0.08):
    """Mechanical action click: metal modes + a tiny noise tick."""
    f = np.array(freqs) * rng.uniform(0.97, 1.03, len(freqs))
    m = modal(dur, f, decays, amps)
    tick = bandpass(noise(dur), 1500, 9000) * env(dur, 0.00005, 0.0006, fade_ms=4)
    return norm(norm(m) + ping * norm(tick))


def crackle(dur, rate=120, decay=0.4, bright=6000, lo=900, start=0.0):
    """Sparse fire/spark pops whose density thins out over time."""
    n = int(SR * dur)
    out = np.zeros(n)
    count = int(rate * dur)
    for _ in range(count):
        p = int(SR * (start + rng.exponential(decay)))
        if p >= n - 400:
            continue
        L = int(rng.integers(20, 220))
        g = rng.uniform(0.15, 1) ** 2
        out[p:p + L] += rng.uniform(-1, 1, L) * np.exp(-np.arange(L) / (L / 5)) * g
    out = bandpass(out, lo, bright)
    return norm(out) * tail(n, 30)


def sparkles(dur, count, lo, hi, spread=0.3, glen=(0.008, 0.03)):
    """Tiny sine grains - the glitter on top of magic sounds."""
    n = int(SR * dur)
    out = np.zeros(n)
    for _ in range(count):
        p = int(SR * min(rng.exponential(spread), dur - 0.05))
        L = min(int(SR * rng.uniform(*glen)), n - p)
        f = np.exp(rng.uniform(np.log(lo), np.log(hi)))
        g = np.hanning(L) * rng.uniform(0.3, 1) * np.exp(-p / (SR * spread * 2))
        out[p:p + L] += np.sin(2 * np.pi * f * np.arange(L) / SR) * g
    return out * tail(n, 30)


def arc(dur, rate=120, decay=0.2, jitter=0.35, lo=500, hi=7000):
    """Electric arc: a jittery train of discharge snaps (the buzz is the rate)."""
    n = int(SR * dur)
    imp = np.zeros(n)
    tpos = 0.0
    gate = 1.0
    while True:
        tpos += (1 / rate) * (1 + jitter * rng.standard_normal())
        if tpos < 0:
            continue
        p = int(SR * tpos)
        if p >= n:
            break
        if rng.random() < 0.06:
            gate = rng.uniform(0.1, 1.0)  # the arc wanders / re-strikes
        imp[p] += rng.uniform(0.4, 1.0) * gate * (1 if rng.random() < 0.5 else -1)
    k = bandpass(noise(0.004), 800, 9000) * np.exp(-np.arange(int(SR * 0.004)) / (SR * 0.0006))
    buzz = fftconv(imp, k)[:n]
    buzz = bandpass(buzz, lo, hi)
    return norm(np.tanh(norm(buzz) * 2.5)) * env(dur, 0.002, decay)


def flange(x, d0_ms, d1_ms, mix_=0.7, curve=1.0):
    """Time-varying comb (flanger) - delay glides d0 -> d1 over the sound."""
    n = len(x)
    u = (np.arange(n) / max(n - 1, 1)) ** curve
    d = (d0_ms + (d1_ms - d0_ms) * u) * SR / 1000
    src = np.arange(n) - d
    return x + mix_ * np.interp(src, np.arange(n), x, left=0.0)


# ------------------------------------------------------------------ space

def reverb(x, size=0.35, mix=0.3, damp=5000, lo=150, pre=0.004, er=(), er_amt=0.35):
    """Convolution reverb with frequency-dependent decay (highs die first)
    and optional early reflections er = (ms, ms, ...)."""
    L = int(SR * min(size * 5, 3.0))

    def m(t, f):
        tau = size * (0.3 + 0.7 / (1 + (f / damp) ** 1.4))
        return np.exp(-np.maximum(t, 0) / tau) / (1 + (lo / np.maximum(f, 1)) ** 2)

    ir = stft_shape(rng.standard_normal(L), m)
    ir *= np.clip(np.arange(L) / (SR * 0.006), 0, 1) * tail(L, 60)
    ir /= np.sqrt(np.sum(ir ** 2))
    if er:
        e = np.zeros(L)
        for i, ms in enumerate(er):
            e[int(SR * ms / 1000)] += (0.85 ** i) * (1 if rng.random() < 0.6 else -1)
        e = iir(e, ("lp", 6000), ("hp", 120))
        e /= np.sqrt(np.sum(e ** 2))
        ir = ir * np.sqrt(1 - er_amt) + e * np.sqrt(er_amt)
    ir = at(ir, pre)
    wet = fftconv(x, ir)
    return mix_parts(x, wet * mix)


def mix_parts(dry, wet):
    out = np.zeros(max(len(dry), len(wet)))
    out[:len(dry)] += dry
    out[:len(wet)] += wet
    return out


def echoes(x, taps):
    """Distant slap-back echoes: taps = [(delay_s, gain, lowpass_hz), ...]."""
    parts = [x]
    for d, g, fc in taps:
        parts.append(at(iir(x, ("lp", fc), ("hp", 90)) * g, d))
    return mix(*parts)


# ------------------------------------------------------------------ dynamics

def _db(x):
    return 20 * np.log10(np.abs(x) + 1e-9)


def compress(x, thr=-16.0, ratio=3.0, attack_ms=2.5, release_ms=80, knee=6.0):
    """Punchy bus compressor (peak detector, instant attack + linear-dB
    release, then the gain reduction is smoothed over attack_ms so the first
    milliseconds of the transient slip through)."""
    x = norm(x)
    n = np.arange(len(x))
    k = 20.0 / (release_ms * SR / 1000)  # dB per sample
    e = np.maximum.accumulate(_db(x) + n * k) - n * k
    over = e - thr
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee)))
    a = max(1, int(SR * attack_ms / 1000))
    gr = np.convolve(gr, np.ones(a) / a)[:len(x)]
    return x * 10 ** (-gr / 20)


def limit(x, ceiling=-1.6, attack_ms=1.0, release_ms=50):
    """Look-ahead brick-wall limiter with linear-dB attack/release ramps."""
    need = np.minimum(0.0, ceiling - _db(x))
    ka = 12.0 / (attack_ms * SR / 1000)
    kr = 20.0 / (release_ms * SR / 1000)
    r = need[::-1]
    m = np.arange(len(r))
    y = (np.minimum.accumulate(r - m * ka) + m * ka)[::-1]
    n = np.arange(len(y))
    g = np.minimum(np.minimum.accumulate(y - n * kr) + n * kr, 0.0)
    out = x * 10 ** (g / 20)
    c = 10 ** (ceiling / 20)
    return np.clip(out, -c, c)


_KW = {}


def lufs(x):
    """EBU R128 integrated loudness (K-weighting, 400 ms blocks, gating),
    measured like ffmpeg's ebur128 on the file padded with 0.6 s silence."""
    if "b" not in _KW:  # libebur128 coefficients for any sample rate
        f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
        K = np.tan(np.pi * f0 / SR)
        Vh, Vb = 10 ** (G / 20), (10 ** (G / 20)) ** 0.4996667741545416
        a0 = 1 + K / Q + K * K
        _KW["b"] = (np.array([(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]),
                    np.array([1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]))
        f0, Q = 38.13547087602444, 0.5003270373238773
        K = np.tan(np.pi * f0 / SR)
        d = 1 + K / Q + K * K
        _KW["h"] = (np.array([1.0, -2.0, 1.0]), np.array([1, 2 * (K * K - 1) / d, (1 - K / Q + K * K) / d]))
    xp = np.concatenate([x, np.zeros(int(SR * 0.6))])
    N = _fast_len(len(xp) + 8192)
    X = np.fft.rfft(xp, N)
    z1 = np.exp(-2j * np.pi * np.fft.rfftfreq(N))
    for key in ("b", "h"):
        b, a = _KW[key]
        X = X * (b[0] + b[1] * z1 + b[2] * z1 ** 2) / (a[0] + a[1] * z1 + a[2] * z1 ** 2)
    y = np.fft.irfft(X, N)[:len(xp)]
    blk, hop = int(SR * 0.4), int(SR * 0.1)
    c = np.concatenate([[0], np.cumsum(y * y)])
    starts = np.arange(0, len(y) - blk + 1, hop)
    z = (c[starts + blk] - c[starts]) / blk
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    z = z[lk > -70]
    if not len(z):
        return -70.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return -0.691 + 10 * np.log10(z.mean())


def finish(x, loud=LOUD_FIRE, ceiling=-1.6, comp=(-16.0, 3.0, 2.5, 80), max_dur=3.0, fade=0.04, hp=30):
    """Master bus: sub-sonic high-pass, compression, loudness normalisation,
    look-ahead limiting, silent-tail trim and a click-free fade."""
    x = iir(x, ("hp", hp), ("hp", hp))
    x = x - np.mean(x)
    if comp:
        x = compress(x, *comp)
    x = norm(x)
    for _ in range(5):
        x = limit(x * 10 ** ((loud - lufs(x)) / 20), ceiling)
    x = x - np.mean(x)
    thr = np.where(np.abs(x) > 10 ** (-58 / 20))[0]
    end = min(len(x), (thr[-1] + int(SR * 0.01)) if len(thr) else len(x), int(SR * max_dur))
    x = x[:end].copy()
    f = min(len(x), int(SR * fade))
    x[-f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    k = int(SR * 0.00015)
    x[:k] *= np.linspace(0, 1, k)
    return x


# ------------------------------------------------------------------ gunshot core

def gunshot(dur=1.0, blast_ms=1.2, blast_amt=1.0, crack=0.6, crack_band=(2500, 11000), crack_ms=1.0,
            hi=(2200, 9000, 0.010, 0.5), mid=(250, 2600, 0.035, 1.0), low=(60, 420, 0.08, 0.8),
            kick=(150, 50, 0.03, 0.05, 1.0), drive=2.5, double=None, p=1.0):
    """The dry shot: transient + three body bands + thump, saturated together.
    Bands: (lo, hi, decay, gain); kick: (f0, f1, pitch_tau, decay, gain)."""
    parts = []
    b = iir(blast(blast_ms / p), ("hp", 70)) * blast_amt
    parts.append(b)
    cr = bandpass(noise(0.02), *crack_band) * env(0.02, 0.00005, crack_ms / 1000, fade_ms=4)
    parts.append(norm(cr) * crack)
    for lo_f, hi_f, dec, g in (hi, mid, low):
        d = min(dur, dec * 9 + 0.02)
        layer = bandpass(noise(d), lo_f * p, hi_f * p) * env2(d, 0.0003, dec, dec * 3.5, 0.25)
        parts.append(norm(layer) * g)
    f0, f1, ptau, dec, g = kick
    parts.append(thump(min(dur, dec * 7 + 0.03), f0 * p, f1 * p, ptau, dec) * g)
    x = mix(*parts)
    if double:  # double barrel: a second, slightly later and duller blast
        off, g2 = double
        x = mix(x, at(iir(x, ("lp", 3500)), off) * g2)
    x = norm(x)
    return np.tanh(x * drive) / np.tanh(drive)


def chime(dur, f, decay, amp=1.0, ratios=(1.0, 2.76, 5.40), pamps=(1.0, 0.22, 0.06), beat=2.0):
    """Amethyst-like crystal chime: inharmonic bar partials with a slow beat."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for r, a in zip(ratios, pamps):
        d = decay / (r ** 0.9)
        for det in (-beat / 2, beat / 2):
            out += a * np.sin(2 * np.pi * (f * r + det) * t) * np.exp(-t / d)
    return out * amp * np.clip(t / 0.0015, 0, 1) * tail(len(t), 30)


def choir(dur, notes, attack=0.15, decay=0.9, hold=0.25, vowel="ah"):
    """Formant-filtered detuned saw voices with vibrato - an 'aah' choir."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for i, f in enumerate(notes):
        for det in (-0.006, 0.0, 0.0065):
            rate = rng.uniform(4.8, 6.2)
            vib = 1 + 0.007 * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6.28)) * np.clip(t / 0.4, 0, 1)
            ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR + rng.uniform(0, 6.28)
            for k in range(1, int(5000 / f) + 1):
                out += np.sin(ph * k) / k ** 1.1
    breath = noise(dur) * 0.6
    peaks = {"ah": [(750, 110, 1.0), (1180, 130, 0.55), (2850, 200, 0.22), (3500, 250, 0.08)],
             "oo": [(360, 90, 1.0), (820, 120, 0.4), (2400, 200, 0.06)]}[vowel]
    v = formant(out, peaks) + formant(breath, peaks) * 0.04 * np.sqrt(len(notes) * 3)
    e = np.clip(t / attack, 0, 1) ** 1.5 * np.exp(-np.maximum(t - attack - hold, 0) / decay)
    return norm(v) * e * tail(len(t), 80)


# ------------------------------------------------------------------ recipes

def arcane_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.0, blast_ms=0.8, crack=0.75, crack_band=(2600, 11000), crack_ms=0.8,
                   hi=(2200, 9000, 0.008, 0.5), mid=(320, 2700, 0.028, 1.0), low=(70, 450, 0.055, 0.65),
                   kick=(165, 58, 0.022, 0.045, 0.85), drive=3.0, p=p)
    cyl = click((1850, 3100, 4700, 6900), (0.012, 0.008, 0.005, 0.003), (1, 0.6, 0.3, 0.15)) * 0.05
    notes = [(1046.5, 1318.5, 1568.0), (987.8, 1318.5, 1661.2), (1108.7, 1396.9, 1760.0)][v]
    mag = mix(*[at(chime(0.8, f * p, 0.38, a), t0) for f, a, t0 in zip(notes, (1.0, 0.8, 0.7), (0.006, 0.03, 0.055))])
    pew = chirp(0.22, 1900 * p, 280 * p, harmonics=(1, 0.3, 0.1)) * env(0.22, 0.002, 0.05)
    glit = sparkles(0.7, 18, 2400, 7500, spread=0.18)
    magic = mix(norm(mag) * 0.22, pew * 0.18, norm(glit) * 0.05)
    dry = mix(shot, at(cyl, 0.105 + 0.01 * v), at(magic, 0.004))
    wet = reverb(dry, size=0.32, mix=0.32, damp=4800, er=(6.5, 11, 17.5, 26, 37))
    return finish(wet, LOUD_FIRE, comp=(-15, 3.0, 2.5, 70), max_dur=1.1)


def arcane_hit(v=0):
    p = PITCH[v]
    pop = bandpass(noise(0.08), 400, 5000) * env2(0.08, 0.0003, 0.006, 0.025, 0.2)
    thud = thump(0.12, 230 * p, 90 * p, 0.015, 0.025)
    notes = [(1318.5, 1568.0, 2093.0, 2637.0), (1396.9, 1760.0, 2093.0, 2793.8)][v]
    arp = mix(*[at(chime(0.6, f * p, 0.22, a, pamps=(1, 0.15, 0.04)), 0.004 + i * 0.022)
                for i, (f, a) in enumerate(zip(notes, (1.0, 0.85, 0.75, 0.6)))])
    glit = sparkles(0.6, 28, 2200, 8000, spread=0.12)
    air = bandpass(noise(0.2), 2500, 10000) * env(0.2, 0.002, 0.04)
    dry = mix(norm(pop) * 0.6, thud * 0.55, at(norm(arp) * 0.55, 0.0), norm(glit) * 0.12, norm(air) * 0.12)
    wet = reverb(dry, size=0.28, mix=0.3, damp=6000, er=(5, 9, 14))
    return finish(wet, LOUD_HIT, comp=(-14, 2.5, 2, 60), max_dur=1.0)


def inferno_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.2, blast_ms=2.6, crack=0.35, crack_band=(1800, 7000), crack_ms=1.4,
                   hi=(1800, 7000, 0.012, 0.3), mid=(180, 1800, 0.055, 0.95), low=(40, 360, 0.13, 1.0),
                   kick=(112, 34, 0.04, 0.12, 1.4), drive=3.6, p=p)
    brass = modal(0.5, (420 * p, 1130 * p, 2050 * p), (0.16, 0.07, 0.035), (1, 0.45, 0.2))
    whoosh = sweep_noise(0.9, 320 * p, 1300 * p, bw=1.8, curve=0.6) * env(0.9, 0.03, 0.26)
    roar = bandpass(noise(0.9), 70, 520) * env(0.9, 0.04, 0.3)
    cr = crackle(1.1, rate=80, decay=0.3, bright=7000, lo=1200, start=0.04)
    dry = mix(shot, norm(brass) * 0.05, at(whoosh * 0.42, 0.006), at(norm(roar) * 0.3, 0.004), cr * 0.2)
    wet = reverb(dry, size=0.42, mix=0.26, damp=3500, er=(8, 15, 23, 36))
    return finish(wet, LOUD_FIRE, comp=(-15, 3.0, 3, 90), max_dur=1.4)


def inferno_hit(v=0):
    p = PITCH[v]
    whoomph = sweep_noise(0.7, 1700 * p, 380 * p, bw=2.0, curve=0.5) * env(0.7, 0.006, 0.14)
    puff = thump(0.2, 130 * p, 48 * p, 0.02, 0.05)
    cr = crackle(0.8, rate=150, decay=0.22, bright=7500, lo=1200, start=0.01)
    sizzle = bandpass(noise(0.6), 5500, 11000) * env(0.6, 0.02, 0.18)
    dry = mix(whoomph, puff * 0.5, cr * 0.32, norm(sizzle) * 0.04)
    wet = reverb(dry, size=0.3, mix=0.2, damp=4000, er=(6, 11, 19))
    return finish(wet, LOUD_HIT - 1.0, comp=(-14, 2.5, 3, 70), max_dur=0.9)


def frost_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.0, blast_ms=1.6, crack=0.85, crack_band=(3000, 14000), crack_ms=0.7,
                   hi=(2500, 11000, 0.009, 0.5), mid=(250, 2500, 0.042, 0.95), low=(45, 380, 0.1, 1.0),
                   kick=(135, 40, 0.03, 0.085, 1.25), drive=3.2, p=p)
    shot = mix(shot, nwave(0.33) * 0.9)
    bolt_t = 0.6 + 0.025 * v
    lift = click((1450, 2900, 4300), (0.010, 0.006, 0.004), (1, 0.5, 0.25)) * 0.035
    slide = bandpass(noise(0.05), 1200, 5000) * env(0.05, 0.01, 0.015) * 0.012
    back = click((1100, 2400, 3700, 5200), (0.016, 0.009, 0.006, 0.004), (1, 0.55, 0.3, 0.15)) * 0.06
    fwd = click((1000, 2250, 3500, 5000), (0.018, 0.01, 0.006, 0.004), (1, 0.6, 0.3, 0.15)) * 0.065
    lock = click((1600, 3100, 4500), (0.01, 0.006, 0.004), (1, 0.4, 0.2)) * 0.04
    bolt = mix(lift, at(slide, 0.03), at(back, 0.075), at(fwd, 0.17), at(lock, 0.225))
    ring = mix(chime(1.3, 988 * p, 0.85, 1.0, ratios=(1, 2.32, 4.25), pamps=(1, 0.28, 0.06), beat=1.6),
               chime(1.3, 1480 * p, 0.6, 0.7, ratios=(1, 2.32, 4.25), pamps=(1, 0.2, 0.04), beat=2.3))
    frost = bandpass(noise(0.6), 6000, 13000) * env(0.6, 0.015, 0.16)
    tail_ = echoes(shot, [(0.19 + 0.02 * v, 0.28, 2600), (0.43 + 0.03 * v, 0.16, 1800), (0.8, 0.08, 1200)])
    dry = mix(tail_, at(norm(ring) * 0.1, 0.008), norm(frost) * 0.035)
    wet = reverb(dry, size=0.65, mix=0.3, damp=2800, lo=70, er=(9, 17, 29, 44, 61))
    wet = mix(wet, at(bolt, bolt_t))
    return finish(wet, LOUD_FIRE, comp=(-16, 3.0, 2.5, 90), max_dur=2.2)


def frost_hit(v=0):
    p = PITCH[v]
    imp = mix(iir(blast(0.5), ("hp", 200)) * 0.6,
              norm(bandpass(noise(0.03), 1500, 12000) * env(0.03, 0.00005, 0.004)) * 0.9,
              thump(0.1, 210 * p, 85 * p, 0.012, 0.02) * 0.35)
    n = int(SR * 0.8)
    shards = np.zeros(n)
    for i in range(48):
        t0 = 0.002 + min(rng.exponential(0.05), 0.5)
        f = np.exp(rng.uniform(np.log(1400), np.log(8500))) * p
        w = 0.5 if 2800 < f < 6000 else 1.0   # keep the 3-6 kHz whistle down
        L = int(SR * rng.uniform(0.03, 0.12))
        tt = np.arange(L) / SR
        d = rng.uniform(0.012, 0.05)
        r2 = rng.uniform(2.2, 2.9)
        seg = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * r2 * tt)) * np.exp(-tt / d) * tail(L, 5)
        g = rng.uniform(0.25, 1) * w * np.exp(-t0 / 0.2)
        s = int(SR * t0)
        shards[s:s + L] += seg[: n - s] * g
    crunch = np.zeros(n)
    for _ in range(30):
        s = int(SR * min(rng.exponential(0.03), 0.3))
        L = int(SR * rng.uniform(0.001, 0.004))
        crunch[s:s + L] += rng.uniform(-1, 1, L) * rng.uniform(0.3, 1)
    crunch = bandpass(crunch, 900, 7000)
    dry = mix(imp, norm(shards) * 0.55, norm(crunch) * 0.35)
    wet = reverb(dry, size=0.26, mix=0.26, damp=7000, er=(5, 9, 15))
    return finish(wet, LOUD_HIT, comp=(-14, 2.5, 2, 60), max_dur=1.0)


def storm_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.2, blast_ms=2.0, crack=0.6, crack_band=(2000, 10000), crack_ms=1.2,
                   hi=(2000, 9000, 0.012, 0.45), mid=(180, 2400, 0.06, 1.0), low=(45, 400, 0.12, 1.0),
                   kick=(122, 38, 0.035, 0.105, 1.35), drive=3.6, double=(0.0026 + 0.0006 * v, 0.75), p=p)
    zap = np.tanh(4 * chirp(0.1, 3000 * p, 220 * p)) * env(0.1, 0.0005, 0.028)
    zap = bandpass(zap, 300, 6500)
    bolt = arc(0.6, rate=118 * p, decay=0.17, lo=400, hi=7000)
    sparks = crackle(0.75, rate=170, decay=0.18, bright=9000, lo=2000, start=0.01)
    t = t_axis(0.5)
    fw = 260 * p * (700 / 260) ** (t / 0.5)
    whine = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(fw) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t))
    whine = whine * np.clip(t / 0.25, 0, 1) ** 2 * tail(len(t), 120)
    dry = mix(shot, at(zap * 0.22, 0.001), at(bolt * 0.3, 0.015), sparks * 0.18, at(whine * 0.025, 0.62))
    wet = reverb(dry, size=0.38, mix=0.26, damp=4200, er=(7, 13, 21, 33))
    return finish(wet, LOUD_FIRE, comp=(-15, 3.0, 2.5, 80), max_dur=1.2)


def storm_hit(v=0):
    p = PITCH[v]
    crack = norm(bandpass(noise(0.03), 1500, 12000) * env(0.03, 0.00005, 0.002)) * 0.9
    zap = bandpass(np.tanh(4 * chirp(0.06, 2600 * p, 300 * p)) * env(0.06, 0.0005, 0.018), 300, 7000)
    bolt = arc(0.32, rate=150 * p, decay=0.08, lo=500, hi=8000)
    sparks = crackle(0.35, rate=260, decay=0.08, bright=10000, lo=2000)
    dry = mix(crack, iir(blast(0.5), ("hp", 150)) * 0.5, zap * 0.4, bolt * 0.6, sparks * 0.3)
    wet = reverb(dry, size=0.16, mix=0.18, damp=6000, er=(4, 8))
    return finish(wet, LOUD_HIT, comp=(-14, 2.5, 2, 50), max_dur=0.45)


def soul_fire(v=0):
    p = PITCH[v]
    shot = gunshot(0.3, blast_ms=1.8, blast_amt=0.6, crack=0.15, crack_band=(1500, 6000), crack_ms=0.6,
                   hi=(1500, 5000, 0.006, 0.2), mid=(180, 1600, 0.017, 1.0), low=(60, 350, 0.032, 0.8),
                   kick=(175, 78, 0.012, 0.026, 0.9), drive=2.5, p=p)
    shot = iir(shot, ("lp", 5200))
    bolt1 = click((1300, 2500, 3900), (0.010, 0.006, 0.004), (1, 0.5, 0.2)) * 0.1
    bolt2 = click((1150, 2300, 3500), (0.010, 0.006, 0.004), (1, 0.5, 0.2)) * 0.07
    whoo = formant(noise(0.3), [(380, 140, 1.0), (900, 220, 0.5), (2300, 300, 0.08)]) * env(0.3, 0.004, 0.05)
    t = t_axis(0.3)
    f = (690 - 140 * t / 0.3) * p * (1 + 0.02 * np.sin(2 * np.pi * 9 * t))
    ghost = (np.sin(2 * np.pi * np.cumsum(f) / SR) + np.sin(2 * np.pi * np.cumsum(f * 1.012) / SR)) * env(0.3, 0.006, 0.045)
    dry = mix(shot, bolt1, at(bolt2, 0.042), at(norm(whoo) * 0.32, 0.003), at(ghost * 0.06, 0.004))
    wet = reverb(dry, size=0.1, mix=0.16, damp=3500, er=(4, 7, 11))
    return finish(wet, LOUD_FIRE - 1.0, comp=(-14, 2.5, 2.5, 50), max_dur=0.33, fade=0.05)


def soul_hit(v=0):
    p = PITCH[v]
    whoosh = sweep_noise(0.55, 1400 * p, 330 * p, bw=1.6, curve=0.7) * env(0.55, 0.018, 0.13)
    t = t_axis(0.5)
    f = 470 * p * (250 / 470) ** (t / 0.5) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    moan = formant(np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph), [(400, 200, 1.0), (850, 250, 0.5)])
    moan = norm(moan) * env(0.5, 0.025, 0.13)
    thud = thump(0.12, 150 * p, 70 * p, 0.015, 0.03)
    dry = mix(whoosh, moan * 0.3, thud * 0.35)
    wet = reverb(dry, size=0.3, mix=0.3, damp=3000, er=(6, 12))
    return finish(wet, LOUD_HIT - 1.0, comp=(-14, 2.5, 3, 70), max_dur=1.0)


def void_fire(v=0):
    p = PITCH[v]
    punch = gunshot(0.4, blast_ms=1.2, blast_amt=0.7, crack=0.4, crack_band=(2500, 9000), crack_ms=0.8,
                    hi=(2500, 9000, 0.006, 0.25), mid=(300, 2500, 0.02, 0.5), low=(60, 400, 0.05, 0.5),
                    kick=(150, 45, 0.03, 0.07, 1.2), drive=2.5, p=p)
    d = 0.42
    t = t_axis(d)
    las = chirp(d, 2500 * p, 140 * p, harmonics=(1, 0.5, 0.33, 0.2))
    las = las * (0.65 + 0.35 * np.sin(2 * np.pi * 55 * t))           # ring-mod shimmer
    las = flange(las * env(d, 0.001, 0.12, hold=0.02), 0.4, 5.0, 0.8)  # warp
    las = iir(las, ("lp", 6000))
    warp = flange(bandpass(noise(0.5), 300, 7000), 9.0, 0.35, 0.95, curve=0.7) * env(0.5, 0.01, 0.16)
    sub = thump(0.5, 95 * p, 32 * p, 0.12, 0.18, drive=1.2)
    portal = sparkles(0.6, 10, 500, 1500, spread=0.15, glen=(0.03, 0.07))
    dry = mix(punch, at(norm(las) * 0.4, 0.002), norm(warp) * 0.22, sub * 0.45, at(norm(portal) * 0.06, 0.05))
    dry = echoes(dry, [(0.13, 0.22, 3500), (0.27, 0.11, 2500)])
    wet = reverb(dry, size=0.5, mix=0.32, damp=4000, er=(8, 15, 26))
    return finish(wet, LOUD_FIRE, comp=(-15, 3.0, 2.5, 80), max_dur=1.5)


def void_hit(v=0):
    p = PITCH[v]
    ds = 0.16
    t = t_axis(ds)
    rise = (0.2 + 0.8 * (t / ds) ** 2.2) * tail(len(t), 4)
    suck = sweep_noise(ds, 300 * p, 3600 * p, bw=1.5) * rise
    up = chirp(ds, 180 * p, 950 * p, harmonics=(1, 0.4, 0.2)) * rise
    pop = mix(iir(blast(1.5), ("hp", 60)) * 0.8,
              norm(bandpass(noise(0.03), 1000, 8000) * env(0.03, 0.00005, 0.003)) * 0.6,
              thump(0.4, 170 * p, 40 * p, 0.025, 0.09) * 1.0)
    dry = mix(norm(suck) * 0.45 + up * 0.18, at(pop, ds))
    wet = reverb(dry, size=0.34, mix=0.3, damp=2500, er=(7, 13))
    return finish(wet, LOUD_HIT, comp=(-14, 2.5, 3, 70), max_dur=1.1)


def holy_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.6, blast_ms=3.5, crack=0.45, crack_band=(2000, 9000), crack_ms=1.6,
                   hi=(1800, 8000, 0.014, 0.35), mid=(120, 1800, 0.085, 1.0), low=(35, 320, 0.2, 1.0),
                   kick=(96, 28, 0.06, 0.19, 1.6), drive=4.0, p=p)
    chords = [(329.63, 440.0, 554.37, 659.26), (293.66, 440.0, 554.37, 739.99), (329.63, 415.3, 554.37, 659.26)]
    voices = choir(2.6, [f * p for f in chords[v]], attack=0.2, hold=0.3, decay=0.75)
    bells = mix(*[chime(1.8, f * p, 0.7, a, ratios=(1, 2.0, 3.0), pamps=(1, 0.2, 0.05), beat=1.2)
                  for f, a in ((1318.5, 1.0), (1760.0, 0.7), (2217.5, 0.45))])
    glit = sparkles(1.6, 26, 2500, 8000, spread=0.5, glen=(0.02, 0.06))
    boom = echoes(shot, [(0.23 + 0.02 * v, 0.24, 1500), (0.52, 0.13, 1000)])
    dry = mix(boom, at(voices * 0.22, 0.03), at(norm(bells) * 0.05, 0.05), at(norm(glit) * 0.03, 0.08))
    wet = reverb(dry, size=0.8, mix=0.34, damp=2600, lo=50, er=(11, 21, 34, 52, 71))
    return finish(wet, LOUD_FIRE + 0.5, comp=(-17, 3.5, 3.5, 110), max_dur=2.8, fade=0.15)


def holy_hit(v=0):
    p = PITCH[v]
    base = (523.25, 587.33)[v] * p
    ratios = (0.5, 1.0, 1.2, 1.5, 2.0, 2.5, 2.67, 3.0, 4.0)
    decs = (1.4, 1.0, 0.8, 0.6, 0.5, 0.3, 0.25, 0.2, 0.12)
    amps = (0.5, 0.8, 0.55, 0.35, 1.0, 0.3, 0.2, 0.18, 0.08)
    bell = modal(2.2, [base * r for r in ratios], decs, amps)
    bell2 = modal(2.2, [base * 1.5 * r for r in ratios], [d * 0.8 for d in decs], amps)
    strike = norm(bandpass(noise(0.03), 1000, 7000) * env(0.03, 0.00005, 0.003))
    radiance = bandpass(noise(0.6), 1800, 10000) * env(0.6, 0.006, 0.12)
    thud = thump(0.3, 115 * p, 45 * p, 0.02, 0.07)
    dry = mix(norm(bell) * 0.55, norm(bell2) * 0.3, strike * 0.5, norm(radiance) * 0.16, thud * 0.45)
    wet = reverb(dry, size=0.6, mix=0.32, damp=4500, er=(8, 15, 25))
    return finish(wet, LOUD_HIT + 0.5, comp=(-15, 2.5, 3, 90), max_dur=2.3, fade=0.12)


SOUNDS = {
    "arcane_fire": arcane_fire, "arcane_hit": arcane_hit,
    "inferno_fire": inferno_fire, "inferno_hit": inferno_hit,
    "frost_fire": frost_fire, "frost_hit": frost_hit,
    "storm_fire": storm_fire, "storm_hit": storm_hit,
    "soul_fire": soul_fire, "soul_hit": soul_hit,
    "void_fire": void_fire, "void_hit": void_hit,
    "holy_fire": holy_fire, "holy_hit": holy_hit,
}


def render(name, v=0):
    """Deterministic render of one variant (v = 0 is the base file)."""
    global rng
    rng = np.random.default_rng(zlib.crc32(f"{name}:{v}".encode()))
    return SOUNDS[name](v)


def write_ogg(x, path):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-ac", "1", "-ar", str(SR),
                        "-c:a", "libvorbis", "-q:a", "4", "-map_metadata", "-1", "-fflags", "+bitexact",
                        "-flags:a", "+bitexact", path], check=True)
    finally:
        os.unlink(wav_path)


def main(rp_dir):
    out_dir = os.path.join(rp_dir, "sounds", "magic_guns")
    os.makedirs(out_dir, exist_ok=True)
    for name in SOUNDS:
        for v in range(VARIANTS.get(name, 1)):
            x = render(name, v)
            fname = name + ("" if v == 0 else f"_{v + 1}")
            write_ogg(x, os.path.join(out_dir, fname + ".ogg"))
            print("sound", fname, "%.2fs" % (len(x) / SR))


if __name__ == "__main__":
    main(sys.argv[1])
