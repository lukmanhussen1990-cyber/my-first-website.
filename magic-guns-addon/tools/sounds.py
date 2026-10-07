"""
sounds.py - synthesises every Magic Guns sound effect from scratch (numpy)
and encodes it to mono 44.1 kHz Ogg Vorbis with ffmpeg.

    python3 sounds.py <resource_pack_dir>

Every gunshot is built the way a real one is layered (see gunshot()):

    transient   Friedlander blast pulse + sub-ms noise crack (+ N-wave for
                the supersonic sniper) - attack well under 1 ms
    body        noise bands (crack 2-10 kHz / body 200-2.5k / low 40-400 Hz)
                with crest-reduced carriers, decaying at different speeds so
                the shot darkens naturally
    thump       pitch-dropping sine kick, carrier saturated so the harmonics
                still read on phone speakers
    action      modal metal clicks (cylinder, bolt-action, SMG bolt)
    tail        early reflections + frequency-dependent reverb (+ slap-back
                echoes for the outdoor guns)

The weapon's magic layer sits on top, a few ms after the transient so it
never masks the shot.  finish() is the master bus: sub-sonic high-pass, an
encoder-friendly low-pass, then the gain that reaches the EBU R128 loudness
target (LUFS) *through* a fast look-ahead limiter that only shaves the first
spike.  All fire sounds land at ~-19 LUFS, hits ~3-4 LU lower, and
write_sound() re-renders with a lower ceiling if the Vorbis encoder overshoots,
so every decoded file peaks at or below -1 dBTP.

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

LOUD_FIRE = -19.0   # integrated loudness targets (LUFS)
LOUD_HIT = -22.5


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


def crackle(dur, rate=120, decay=0.4, bright=6000, lo=900, start=0.0, fall=None):
    """Sparse fire/spark pops whose density (time constant `decay`) and
    loudness (time constant `fall`) thin out over time."""
    fall = fall or decay * 1.5
    n = int(SR * dur)
    out = np.zeros(n)
    count = int(rate * dur)
    for _ in range(count):
        p = int(SR * (start + rng.exponential(decay)))
        if p >= n - 400:
            continue
        L = int(rng.integers(20, 220))
        g = rng.uniform(0.15, 1) ** 2 * np.exp(-(p / SR - start) / fall)
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
    buzz = iir(np.tanh(norm(buzz) * 2.5), ("peak", 4300, 0.8, -4.0))  # tame the 3-6 kHz bite
    return norm(buzz) * env(dur, 0.002, decay)


def flange(x, d0_ms, d1_ms, mix_=0.7, curve=1.0):
    """Time-varying comb (flanger) - delay glides d0 -> d1 over the sound."""
    n = len(x)
    u = (np.arange(n) / max(n - 1, 1)) ** curve
    d = (d0_ms + (d1_ms - d0_ms) * u) * SR / 1000
    src = np.arange(n) - d
    return x + mix_ * np.interp(src, np.arange(n), x, left=0.0)


# ------------------------------------------------------------------ space

def reverb(x, size=0.9, mix=0.3, damp=5000, lo=180, pre=0.004, er=(), er_amt=0.35):
    """Convolution reverb.  size = decay time (T60, s) of the low-mids; highs
    above `damp` die faster, lows below `lo` are thinned out.  er = early
    reflection times in ms."""
    L = int(SR * min(size * 1.1, 3.0))

    def m(t, f):
        tau = size / 6.9 * (0.3 + 0.7 / (1 + (f / damp) ** 1.4))
        return np.exp(-np.maximum(t, 0) / tau) / (1 + (lo / np.maximum(f, 1)) ** 3)

    ir = stft_shape(rng.standard_normal(L), m)
    ir *= np.clip(np.arange(L) / (SR * 0.006), 0, 1) * tail(L, 60)
    ir /= np.sqrt(np.sum(ir ** 2))
    if er:
        e = np.zeros(L)
        for i, ms in enumerate(er):
            e[int(SR * ms / 1000)] += (0.85 ** i) * (1 if rng.random() < 0.6 else -1)
        e = iir(e, ("lp", 6000), ("hp", 150))
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


DEBUG = bool(os.environ.get("SOUNDS_DEBUG"))
_CEIL = -1.3   # limiter ceiling (dBFS); main() lowers it per file if Vorbis overshoots


def finish(x, loud=LOUD_FIRE, ceiling=None, max_dur=3.0, fade=0.04, hp=25):
    """Master bus: sub-sonic high-pass + encoder-friendly low-pass, then the
    gain that hits the loudness target *after* a fast look-ahead limiter
    (0.5 ms attack, 12 ms release) that only shaves the transient spikes;
    finally silent-tail trim (-60 dBFS) and click-free fades."""
    if ceiling is None:
        ceiling = _CEIL
    x = iir(x, ("hp", hp), ("lp", 15500, 0.6), ("lp", 15500, 0.6))
    x = norm(x - np.mean(x))
    G = loud - lufs(x)
    for _ in range(8):
        y = limit(x * 10 ** (G / 20), ceiling, attack_ms=0.5, release_ms=12)
        err = loud - lufs(y)
        G += err
        if abs(err) < 0.03:
            break
    gr = np.max(_db(x * 10 ** (G / 20)) - _db(y))
    x = y
    thr = np.where(np.abs(x) > 10 ** (-60 / 20))[0]
    end = (thr[-1] + int(SR * 0.01)) if len(thr) else len(x)
    if end > SR * max_dur:          # still ringing: taper the tail instead of chopping it
        end = int(SR * max_dur)
        fade = max(fade, 0.25)
    x = x[:min(end, len(x))].copy()
    x -= np.mean(x)
    f = min(len(x), int(SR * fade))
    x[-f:] *= np.cos(np.linspace(0, np.pi / 2, f)) ** 2
    k = int(SR * 0.00015)
    x[:k] *= np.linspace(0, 1, k)
    if DEBUG:
        print("   limiter GR %.1f dB  LUFS %.1f  len %.2fs" % (gr, lufs(x), len(x) / SR))
    return x


# ------------------------------------------------------------------ gunshot core

def gunshot(dur=1.0, blast_ms=1.2, blast_amt=1.0, crack=0.6, crack_band=(2500, 11000), crack_ms=1.0,
            hi=(2200, 9000, 0.010, 0.5), mid=(250, 2600, 0.035, 1.0), low=(60, 420, 0.08, 0.8),
            kick=(150, 50, 0.03, 0.05, 1.0), drive=2.5, lows=0.55, grit=1.2, double=None, hold=0.003, p=1.0):
    """The dry shot.  Two groups so the transient stays on top:
      transient group  blast pulse + crack + crack band + body band
      low group        low band + pitch-dropping thump (its carrier saturated
                       by `drive` for harmonics), mixed in at `lows`.
    The sum is high-passed *before* normalising (a decaying kick carries net
    DC that would otherwise swing up later and steal the transient's peak),
    then gently soft-clipped (`grit`).
    Bands: (lo, hi, decay, gain); kick: (f0, f1, pitch_tau, decay, gain)."""
    def band(spec, hold=0.0):
        lo_f, hi_f, dec, g = spec
        d = min(dur, dec * 9 + 0.02 + hold)
        nb = bandpass(noise(d), lo_f * p, hi_f * p)
        # clip the noise *carrier* (not the envelope): ~4 dB lower crest
        # factor = a denser, louder body at the same peak level
        nb = bandpass(np.tanh(nb / (np.std(nb) * 1.1)), lo_f * p * 0.7, hi_f * p * 1.4)
        e = env2(d, 0.0003, dec, dec * 3, 0.15)
        if hold:
            e = np.concatenate([np.clip(t_axis(hold) / 0.0003, 0, 1), e[int(SR * 0.0003):]])[:len(nb)]
            e *= tail(len(e))
        return norm(nb * e) * g

    cr = bandpass(noise(0.02), *crack_band) * env(0.02, 0.00005, crack_ms / 1000, fade_ms=4)
    tr = mix(iir(blast(blast_ms / p), ("hp", 70)) * blast_amt, norm(cr) * crack, band(hi), band(mid, hold))
    f0, f1, ptau, dec, g = kick
    lo = mix(band(low, hold), thump(min(dur, dec * 7 + 0.03), f0 * p, f1 * p, ptau, dec, drive=drive) * g)
    x = mix(norm(tr), norm(lo) * lows)
    if double:  # double barrel: a second, slightly later and duller blast
        off, g2 = double
        x = mix(x, at(iir(x, ("lp", 3500)), off) * g2)
    x = norm(iir(x, ("hp", 35), ("hp", 35)))
    return np.tanh(x * grit) / np.tanh(grit)


def chime(dur, f, decay, amp=1.0, ratios=(1.0, 2.76, 5.40), pamps=(1.0, 0.22, 0.06), beat=2.0):
    """Amethyst-like crystal chime: inharmonic bar partials with a slow beat.
    Partials landing in the ear's most sensitive 2.8-6.5 kHz zone are turned
    down and shortened so the chime sparkles instead of whistling."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    for r, a in zip(ratios, pamps):
        d = decay / (r ** 0.9)
        if 2800 < f * r < 6500:
            a, d = a * 0.3, d * 0.5
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
            for k in range(1, int(3600 / f) + 1):
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
    shot = gunshot(1.0, blast_ms=0.8, blast_amt=0.6, crack=0.75, crack_band=(2600, 11000), crack_ms=1.2,
                   hi=(2200, 9000, 0.011, 0.65), mid=(320, 2700, 0.045, 1.0), low=(70, 450, 0.07, 0.7),
                   kick=(165, 58, 0.022, 0.04, 1.0), drive=2.5, lows=0.55, grit=1.3, hold=0.008, p=p)
    cyl = click((1850, 3100, 4700, 6900), (0.012, 0.008, 0.005, 0.003), (1, 0.6, 0.3, 0.15)) * 0.08
    notes = [(1046.5, 1318.5, 1568.0), (987.8, 1318.5, 1661.2), (1174.7, 1480.0, 1760.0)][v]
    mag = mix(*[at(chime(0.8, f * p, 0.38, a), t0) for f, a, t0 in zip(notes, (1.0, 0.8, 0.7), (0.006, 0.03, 0.055))])
    pew = chirp(0.22, 1900 * p, 280 * p, harmonics=(1, 0.3, 0.1)) * env(0.22, 0.002, 0.05)
    glit = sparkles(0.7, 18, 2400, 7500, spread=0.18)
    magic = mix(norm(mag) * 0.3, pew * 0.22, norm(glit) * 0.06)
    dry = mix(shot, at(cyl, 0.12 + 0.01 * v), at(magic, 0.004))
    wet = reverb(dry, size=0.9, mix=0.3, damp=4800, er=(6.5, 11, 17.5, 26, 37))
    return finish(wet, LOUD_FIRE, max_dur=1.1)


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
    wet = reverb(dry, size=0.8, mix=0.3, damp=6000, er=(5, 9, 14))
    return finish(wet, LOUD_HIT, max_dur=1.0)


def inferno_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.2, blast_ms=2.6, crack=0.35, crack_band=(1800, 7000), crack_ms=1.4,
                   hi=(1800, 7000, 0.012, 0.3), mid=(180, 1800, 0.055, 0.95), low=(40, 360, 0.13, 1.0),
                   kick=(112, 34, 0.04, 0.10, 1.2), drive=3.0, lows=0.75, grit=1.4, p=p)
    brass = modal(0.5, (420 * p, 1130 * p, 2050 * p), (0.16, 0.07, 0.035), (1, 0.45, 0.2))
    whoosh = sweep_noise(0.9, 320 * p, 1300 * p, bw=1.8, curve=0.6) * env(0.9, 0.03, 0.26)
    roar = bandpass(noise(0.9), 70, 520) * env(0.9, 0.04, 0.3)
    cr = crackle(1.1, rate=80, decay=0.3, bright=7000, lo=1200, start=0.04)
    dry = mix(shot, norm(brass) * 0.05, at(whoosh * 0.85, 0.006), at(norm(roar) * 0.3, 0.004), cr * 0.28)
    wet = reverb(dry, size=1.1, mix=0.28, damp=3500, er=(8, 15, 23, 36))
    return finish(wet, LOUD_FIRE, max_dur=1.4)


def inferno_hit(v=0):
    p = PITCH[v]
    whoomph = sweep_noise(0.7, 1700 * p, 380 * p, bw=2.0, curve=0.5) * env(0.7, 0.006, 0.14)
    puff = thump(0.2, 130 * p, 48 * p, 0.02, 0.05)
    cr = crackle(0.8, rate=150, decay=0.22, bright=7500, lo=1200, start=0.01, fall=0.13)
    sizzle = bandpass(noise(0.6), 5500, 11000) * env(0.6, 0.02, 0.18)
    pop = norm(bandpass(noise(0.03), 300, 4000) * env(0.03, 0.00005, 0.004))
    dry = mix(whoomph, pop * 0.4, puff * 0.5, cr * 0.32, norm(sizzle) * 0.04)
    wet = reverb(dry, size=0.7, mix=0.22, damp=4000, er=(6, 11, 19))
    return finish(wet, LOUD_HIT - 1.0, max_dur=0.9)


def frost_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.0, blast_ms=1.6, blast_amt=0.6, crack=0.85, crack_band=(3000, 14000), crack_ms=1.5,
                   hi=(2500, 11000, 0.014, 0.75), mid=(250, 2500, 0.055, 1.0), low=(45, 380, 0.11, 1.0),
                   kick=(135, 40, 0.03, 0.065, 1.1), drive=2.8, lows=0.6, grit=1.3, hold=0.008, p=p)
    shot = mix(shot, nwave(0.33) * 0.35)
    bolt_t = 0.6 + 0.025 * v
    lift = click((1450, 2900, 4300), (0.010, 0.006, 0.004), (1, 0.5, 0.25)) * 0.035
    slide = bandpass(noise(0.05), 1200, 5000) * env(0.05, 0.01, 0.015) * 0.012
    back = click((1100, 2400, 3700, 5200), (0.016, 0.009, 0.006, 0.004), (1, 0.55, 0.3, 0.15)) * 0.06
    fwd = click((1000, 2250, 3500, 5000), (0.018, 0.01, 0.006, 0.004), (1, 0.6, 0.3, 0.15)) * 0.065
    lock = click((1600, 3100, 4500), (0.01, 0.006, 0.004), (1, 0.4, 0.2)) * 0.04
    bolt = mix(lift, at(slide, 0.03), at(back, 0.075), at(fwd, 0.17), at(lock, 0.225))
    ring = mix(chime(1.3, 988 * p, 0.85, 1.0, ratios=(1, 2.32, 4.25), pamps=(1, 0.28, 0.06), beat=1.6),
               chime(1.3, 1175 * p, 0.6, 0.7, ratios=(1, 2.32, 4.25), pamps=(1, 0.2, 0.04), beat=2.3))
    frost = bandpass(noise(0.6), 6000, 13000) * env(0.6, 0.015, 0.16)
    tail_ = echoes(shot, [(0.19 + 0.02 * v, 0.28, 2600), (0.43 + 0.03 * v, 0.16, 1800), (0.8, 0.08, 1200)])
    dry = mix(tail_, at(norm(ring) * 0.22, 0.008), norm(frost) * 0.05)
    wet = reverb(dry, size=1.8, mix=0.28, damp=2800, lo=90, er=(9, 17, 29, 44, 61))
    wet = mix(wet, at(bolt, bolt_t))
    return finish(wet, LOUD_FIRE, max_dur=2.2)


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
        w = 0.35 if 2800 < f < 6500 else 1.0   # keep the 3-6 kHz whistle down
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
    wet = reverb(dry, size=0.7, mix=0.26, damp=7000, er=(5, 9, 15))
    return finish(wet, LOUD_HIT, max_dur=1.0)


def storm_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.2, blast_ms=2.0, crack=0.6, crack_band=(2000, 10000), crack_ms=1.2,
                   hi=(2000, 9000, 0.012, 0.45), mid=(180, 2400, 0.06, 1.0), low=(45, 400, 0.12, 1.0),
                   kick=(122, 38, 0.035, 0.075, 1.2), drive=3.0, lows=0.65, grit=1.4, double=(0.0026 + 0.0006 * v, 0.75), p=p)
    zap = np.tanh(4 * chirp(0.1, 3000 * p, 220 * p)) * env(0.1, 0.0005, 0.028)
    zap = bandpass(zap, 300, 6500)
    bolt = arc(0.6, rate=118 * p, decay=0.22, lo=400, hi=7000)
    sparks = crackle(0.75, rate=170, decay=0.18, bright=9000, lo=2000, start=0.01)
    t = t_axis(0.5)
    fw = 260 * p * (700 / 260) ** (t / 0.5)
    whine = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(fw) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t))
    whine = whine * np.clip(t / 0.25, 0, 1) ** 2 * tail(len(t), 120)
    dry = mix(shot, at(zap * 0.3, 0.001), at(bolt * 0.8, 0.015), sparks * 0.4, at(whine * 0.012, 0.62))
    wet = reverb(dry, size=1.0, mix=0.26, damp=4200, er=(7, 13, 21, 33))
    return finish(wet, LOUD_FIRE, max_dur=1.2)


def storm_hit(v=0):
    p = PITCH[v]
    crack = norm(bandpass(noise(0.03), 1500, 12000) * env(0.03, 0.00005, 0.002)) * 0.9
    zap = bandpass(np.tanh(4 * chirp(0.06, 2600 * p, 300 * p)) * env(0.06, 0.0005, 0.018), 300, 7000)
    bolt = arc(0.32, rate=150 * p, decay=0.08, lo=500, hi=8000)
    sparks = crackle(0.35, rate=260, decay=0.08, bright=10000, lo=2000)
    dry = mix(crack, iir(blast(0.5), ("hp", 150)) * 0.5, zap * 0.4, bolt * 0.6, sparks * 0.3)
    wet = reverb(dry, size=0.4, mix=0.18, damp=6000, er=(4, 8))
    return finish(wet, LOUD_HIT, max_dur=0.45)


def soul_fire(v=0):
    p = PITCH[v]
    shot = gunshot(0.3, blast_ms=1.8, blast_amt=0.6, crack=0.15, crack_band=(1500, 6000), crack_ms=0.6,
                   hi=(1500, 5000, 0.006, 0.2), mid=(180, 1600, 0.017, 1.0), low=(60, 350, 0.032, 0.8),
                   kick=(175, 78, 0.012, 0.022, 0.9), drive=2.0, lows=0.6, grit=1.1, p=p)
    shot = iir(shot, ("lp", 5200))
    bolt1 = click((1300, 2500, 3900), (0.010, 0.006, 0.004), (1, 0.5, 0.2)) * 0.1
    bolt2 = click((1150, 2300, 3500), (0.010, 0.006, 0.004), (1, 0.5, 0.2)) * 0.07
    whoo = formant(noise(0.3), [(380, 140, 1.0), (900, 220, 0.5), (2300, 300, 0.08)]) * env(0.3, 0.004, 0.05)
    t = t_axis(0.3)
    f = (690 - 140 * t / 0.3) * p * (1 + 0.02 * np.sin(2 * np.pi * 9 * t))
    ghost = (np.sin(2 * np.pi * np.cumsum(f) / SR) + np.sin(2 * np.pi * np.cumsum(f * 1.012) / SR)) * env(0.3, 0.006, 0.045)
    dry = mix(shot, bolt1, at(bolt2, 0.042), at(norm(whoo) * 0.32, 0.003), at(ghost * 0.06, 0.004))
    wet = reverb(dry, size=0.25, mix=0.16, damp=3500, er=(4, 7, 11))
    return finish(wet, LOUD_FIRE - 1.0, max_dur=0.33, fade=0.05)


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
    wet = reverb(dry, size=0.8, mix=0.3, damp=3000, er=(6, 12))
    return finish(wet, LOUD_HIT - 1.0, max_dur=1.0)


def void_fire(v=0):
    p = PITCH[v]
    punch = gunshot(0.4, blast_ms=1.2, blast_amt=0.7, crack=0.4, crack_band=(2500, 9000), crack_ms=0.8,
                    hi=(2500, 9000, 0.006, 0.25), mid=(300, 2500, 0.02, 0.5), low=(60, 400, 0.05, 0.5),
                    kick=(150, 45, 0.03, 0.06, 1.2), drive=2.0, lows=0.6, grit=1.1, p=p)
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
    wet = reverb(dry, size=1.3, mix=0.3, damp=4000, er=(8, 15, 26))
    return finish(wet, LOUD_FIRE, max_dur=1.5)


def void_hit(v=0):
    p = PITCH[v]
    ds = 0.13
    t = t_axis(ds)
    rise = (0.35 + 0.65 * (t / ds) ** 2) * np.clip(t / 0.002, 0, 1) * tail(len(t), 4)
    suck = sweep_noise(ds, 300 * p, 3600 * p, bw=1.5) * rise
    up = chirp(ds, 180 * p, 950 * p, harmonics=(1, 0.4, 0.2)) * rise
    pop = mix(iir(blast(1.5), ("hp", 60)) * 0.8,
              norm(bandpass(noise(0.03), 1000, 8000) * env(0.03, 0.00005, 0.003)) * 0.6,
              thump(0.4, 170 * p, 40 * p, 0.025, 0.09) * 1.0)
    tick = norm(bandpass(noise(0.02), 1500, 8000) * env(0.02, 0.00005, 0.002))  # contact
    dry = mix(tick * 0.3, norm(suck) * 0.45 + up * 0.18, at(pop, ds))
    wet = reverb(dry, size=0.9, mix=0.3, damp=2500, er=(7, 13))
    return finish(wet, LOUD_HIT, max_dur=1.1)


def holy_fire(v=0):
    p = PITCH[v]
    shot = gunshot(1.6, blast_ms=3.5, crack=0.45, crack_band=(2000, 9000), crack_ms=1.6,
                   hi=(1800, 8000, 0.014, 0.35), mid=(120, 1800, 0.085, 1.0), low=(35, 320, 0.2, 1.0),
                   kick=(96, 28, 0.06, 0.16, 1.4), drive=3.5, lows=0.85, grit=1.5, p=p)
    chords = [(329.63, 440.0, 554.37, 659.26), (293.66, 440.0, 554.37, 739.99), (329.63, 415.3, 493.88, 659.26)]
    voices = choir(2.6, [f * p for f in chords[v]], attack=0.2, hold=0.3, decay=0.75)
    bells = mix(*[chime(1.8, f * p, 0.7, a, ratios=(1, 2.0, 3.0), pamps=(1, 0.2, 0.05), beat=1.2)
                  for f, a in ((1318.5, 1.0), (1760.0, 0.7), (2217.5, 0.45))])
    glit = sparkles(1.6, 26, 2500, 8000, spread=0.5, glen=(0.02, 0.06))
    boom = echoes(shot, [(0.23 + 0.02 * v, 0.2, 1500), (0.52, 0.11, 1000)])
    dry = mix(boom, at(voices * 0.6, 0.03), at(norm(bells) * 0.08, 0.05), at(norm(glit) * 0.04, 0.08))
    wet = reverb(dry, size=2.4, mix=0.25, damp=2600, lo=80, er=(11, 21, 34, 52, 71))
    return finish(wet, LOUD_FIRE + 0.5, max_dur=2.8, fade=0.15)


def holy_hit(v=0):
    p = PITCH[v]
    base = (523.25, 587.33)[v] * p
    ratios = (0.5, 1.0, 1.2, 1.5, 2.0, 2.5, 2.67, 3.0, 4.0)
    decs = (0.55, 0.5, 0.42, 0.36, 0.34, 0.2, 0.16, 0.12, 0.08)
    amps = (0.35, 0.8, 0.55, 0.35, 1.0, 0.3, 0.2, 0.18, 0.08)

    def bell(f0, k):
        fr = [f0 * r * (1 + d) for r in ratios for d in (-0.0012, 0.0012)]  # doublets -> shimmer
        return modal(1.9, fr, [d * k for d in decs for _ in (0, 1)], [a for a in amps for _ in (0, 1)])

    strike = norm(bandpass(noise(0.03), 1000, 7000) * env(0.03, 0.00005, 0.003))
    radiance = sweep_noise(0.7, 1500, 6000, bw=2.2, curve=0.5) * env(0.7, 0.004, 0.14)
    thud = thump(0.3, 115 * p, 45 * p, 0.02, 0.07)
    glit = sparkles(1.0, 22, 2000, 7000, spread=0.25, glen=(0.015, 0.05))
    dry = mix(norm(bell(base, 1.0)) * 0.55, norm(bell(base * 1.5, 0.8)) * 0.3, strike * 0.5,
              radiance * 0.18, thud * 0.45, norm(glit) * 0.06)
    wet = reverb(dry, size=1.8, mix=0.3, damp=4500, er=(8, 15, 25))
    return finish(wet, LOUD_HIT + 0.5, max_dur=2.0, fade=0.12)


SOUNDS = {
    "arcane_fire": arcane_fire, "arcane_hit": arcane_hit,
    "inferno_fire": inferno_fire, "inferno_hit": inferno_hit,
    "frost_fire": frost_fire, "frost_hit": frost_hit,
    "storm_fire": storm_fire, "storm_hit": storm_hit,
    "soul_fire": soul_fire, "soul_hit": soul_hit,
    "void_fire": void_fire, "void_hit": void_hit,
    "holy_fire": holy_fire, "holy_hit": holy_hit,
}


def render(name, v=0, ceiling=-1.3):
    """Deterministic render of one variant (v = 0 is the base file)."""
    global rng, _CEIL
    rng = np.random.default_rng(zlib.crc32(f"{name}:{v}".encode()))
    _CEIL = ceiling
    return SOUNDS[name](v)


def _encode(x, path):
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


def _decoded_peak(path):
    """True peak (dBTP, 4x oversampled) of the decoded file."""
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-"],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, "<i2") / 32768.0
    Y = np.fft.rfft(y)
    up = np.fft.irfft(np.concatenate([Y, np.zeros(len(y) * 2)]), len(y) * 4) * 4
    return 20 * np.log10(max(np.max(np.abs(up)), np.max(np.abs(y))) + 1e-9)


def write_ogg(x, path, max_peak=-1.0):
    """Encode and return the decoded peak (dBFS); if the codec overshot
    max_peak the PCM is turned down by the overshoot and re-encoded."""
    for _ in range(4):
        _encode(x, path)
        pk = _decoded_peak(path)
        if pk <= max_peak:
            break
        x = x * 10 ** ((max_peak - 0.05 - pk) / 20)
    return pk


def write_sound(name, v, path, max_peak=-1.0):
    """Render + encode.  Lossy Vorbis can overshoot the limiter ceiling on
    dense transients, so the variant is re-rendered (deterministically) with
    the ceiling lowered by the overshoot: loudness stays on target and the
    decoded file peaks at or below max_peak."""
    ceil = -1.3
    for _ in range(5):
        x = render(name, v, ceil)
        _encode(x, path)
        pk = _decoded_peak(path)
        if pk <= max_peak:
            return x, pk
        ceil -= pk - max_peak + 0.1
    return x, write_ogg(x, path, max_peak)


def main(rp_dir):
    out_dir = os.path.join(rp_dir, "sounds", "magic_guns")
    os.makedirs(out_dir, exist_ok=True)
    for name in SOUNDS:
        for v in range(VARIANTS.get(name, 1)):
            fname = name + ("" if v == 0 else f"_{v + 1}")
            x, pk = write_sound(name, v, os.path.join(out_dir, fname + ".ogg"))
            print("sound", fname, "%.2fs  true peak %.1f dBTP" % (len(x) / SR, pk))


if __name__ == "__main__":
    main(sys.argv[1])
