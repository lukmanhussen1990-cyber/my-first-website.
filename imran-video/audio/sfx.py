"""Warm Spark synth library: every sound in the video is generated here from numpy (no samples).

Conventions
- Mono generators return a float64 array normalised to peak 1.0 (times any seeded gain variation the
  recipe asks for), already faded in/out so they start and end at exactly 0 (no clicks).
- Stereo generators return an array of shape (2, n), normalised over both channels.
- Everything is deterministic: noise comes from numpy PCG64 generators seeded with explicit integers.
- Recipes follow SPEC.md §4.3; comments note where a recipe was interpreted or softened.
"""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
TAU = 2 * np.pi


# ------------------------------------------------------------------ basics

def ns(d):
    """Seconds -> samples (at least 1)."""
    return max(1, int(round(d * SR)))


def tax(n):
    return np.arange(n) / SR


def db(x):
    return 10.0 ** (x / 20.0)


def to_db(x):
    return 20.0 * np.log10(max(float(x), 1e-12))


def gen(seed):
    return np.random.Generator(np.random.PCG64(int(seed) & 0xFFFFFFFF))


def white(n, seed):
    return gen(seed).standard_normal(n)


def pink(n, seed):
    """Pink (1/f power) noise by FFT shaping, unit RMS."""
    w = white(n, seed)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    W /= np.sqrt(np.maximum(f, 20.0))
    p = np.fft.irfft(W, n)
    return p / (np.std(p) + 1e-12)


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade(x, fin=0.002, fout=0.008):
    """Raised-cosine fade in/out; the first and last samples become exactly 0."""
    x = np.array(x, dtype=float, copy=True)
    n = x.shape[-1]
    a = min(ns(fin), n // 2) if fin > 0 else 0
    b = min(ns(fout), n // 2) if fout > 0 else 0
    if a > 0:
        x[..., :a] *= np.sin(0.5 * np.pi * np.arange(a) / a) ** 2
    if b > 0:
        x[..., n - b:] *= np.cos(0.5 * np.pi * (np.arange(b) + 1) / b) ** 2
    return x


def finish(x, fin=0.0015, fout=0.010):
    return norm(fade(x, fin, fout))


def pad_to(x, n):
    if x.shape[-1] >= n:
        return x[..., :n]
    w = [(0, 0)] * (x.ndim - 1) + [(0, n - x.shape[-1])]
    return np.pad(x, w)


def phase(freq):
    """Instantaneous frequency array (Hz) -> phase (rad), starting at 0."""
    return TAU * np.concatenate(([0.0], np.cumsum(freq[:-1]))) / SR


def glide(f0, f1, n, glide_s, curve=None):
    """Exponential glide f0 -> f1 over glide_s seconds, then hold f1. Optional shaping curve on 0..1."""
    u = np.clip(tax(n) / max(glide_s, 1e-6), 0, 1)
    if curve is not None:
        u = curve(u)
    return f0 * (f1 / f0) ** u


def rolloff(f, fc=7000.0, order=2):
    """Gentle amplitude roll-off used to keep high partials sweet instead of harsh."""
    return 1.0 / np.sqrt(1.0 + (np.asarray(f) / fc) ** (2 * order))


# ------------------------------------------------------------------ envelopes

def env_perc(n, tau, attack=0.002):
    t = tax(n)
    e = np.exp(-np.maximum(t - attack, 0) / tau)
    a = min(ns(attack), n)
    e[:a] *= np.sin(0.5 * np.pi * np.arange(a) / a) ** 2
    return e


def env_hann(n):
    return np.sin(np.pi * (np.arange(n) + 0.5) / n) ** 2


def env_swell(n, peak=0.4, p_in=1.0, p_out=1.0):
    """Swell: sin^2 rise to `peak` (fraction of n), cos^2 fall to 0. Exponents shape each side."""
    u = (np.arange(n) + 0.5) / n
    e = np.empty(n)
    up = u < peak
    e[up] = np.sin(0.5 * np.pi * (u[up] / peak)) ** 2
    e[~up] = np.cos(0.5 * np.pi * ((u[~up] - peak) / (1 - peak))) ** 2
    e[up] **= p_in
    e[~up] **= p_out
    return e


def env_ar(n, attack, release):
    """Raised-cosine attack, flat, raised-cosine release ending at n."""
    e = np.ones(n)
    a = min(ns(attack), n) if attack > 0 else 0
    r = min(ns(release), n - a) if release > 0 else 0
    if a > 0:
        e[:a] = np.sin(0.5 * np.pi * np.arange(a) / a) ** 2
    if r > 0:
        e[n - r:] = np.cos(0.5 * np.pi * (np.arange(r) + 1) / r) ** 2
    return e


# ------------------------------------------------------------------ filters

def sos_filter(x, kind, f, order=2):
    if kind == 'band':
        wn = [f[0] / (SR / 2), min(f[1], SR * 0.45) / (SR / 2)]
    else:
        wn = min(f, SR * 0.45) / (SR / 2)
    sos = signal.butter(order, wn, kind, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, fc, order=2):
    return sos_filter(x, 'low', fc, order)


def highpass(x, fc, order=2):
    return sos_filter(x, 'high', fc, order)


def bandpass(x, lo, hi, order=2):
    return sos_filter(x, 'band', (lo, hi), order)


def peak_bp(x, fc, q):
    """Resonant band-pass (unity gain at fc)."""
    b, a = signal.iirpeak(min(fc, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x)


def resp_bp(f, fc, q):
    f = np.maximum(f, 1e-3)
    return 1.0 / np.sqrt(1.0 + (q * (f / fc - fc / f)) ** 2)


def resp_lp(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))


def resp_hp(f, fc, order=2):
    f = np.maximum(f, 1e-3)
    return 1.0 / np.sqrt(1.0 + (fc / f) ** (2 * order))


def tv_filter(x, resp, nperseg=512):
    """Time-varying (zero-phase) magnitude filter via STFT; resp(freqs[F,1], times[1,K]) -> gains.
    Used on stationary noise *before* the amplitude envelope, so there is no pre-echo."""
    hop = nperseg // 4
    n = len(x)
    f, tt, Z = signal.stft(x, fs=SR, window='hann', nperseg=nperseg, noverlap=nperseg - hop,
                           boundary='zeros', padded=True)
    G = resp(f[:, None], tt[None, :])
    _, y = signal.istft(Z * G, fs=SR, window='hann', nperseg=nperseg, noverlap=nperseg - hop,
                        boundary=True)
    return pad_to(y, n)


def sweep_curve(f0, f1, dur, curve=None):
    """fc(t) for an exponential sweep f0 -> f1 across dur seconds (t clipped)."""
    def fc(t):
        u = np.clip(t / dur, 0, 1)
        if curve is not None:
            u = curve(u)
        return f0 * (f1 / f0) ** u
    return fc


def pan_gains(p):
    """Constant-power pan, normalised so that centre = unity in each channel (p in -1..1)."""
    p = np.clip(p, -1, 1)
    ang = (p + 1) * np.pi / 4
    return np.sqrt(2) * np.cos(ang), np.sqrt(2) * np.sin(ang)


def to_stereo(x, p):
    gl, gr = pan_gains(p)
    return np.stack([x * gl, x * gr])


# ------------------------------------------------------------------ tonal instruments

def pop(f0, tau=0.08, click_db=-10.0, seed=0, body=0.07):
    """POP(f0): sine whose pitch drops 1.6*f0 -> f0 over ~30 ms, 2 ms attack, exp decay tau,
    plus a 3 ms white-noise click HP 2.5 kHz at click_db relative. A touch of 2nd harmonic for body."""
    dur = min(0.03 + 7 * tau, 0.9)
    n = ns(dur)
    t = tax(n)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.009))
    ph = phase(f)
    x = (np.sin(ph) + body * rolloff(2 * f0) * np.sin(2 * ph)) * env_perc(n, tau, 0.002)
    x = norm(x)
    nc = ns(0.003)
    c = highpass(white(nc + 64, seed), 2500, 4)[64:]
    c = norm(c * fade(np.exp(-np.arange(nc) / (0.0009 * SR)), 0.0003, 0.0008))
    x[:nc] += c * db(click_db)
    return finish(x, 0.0005, 0.012)


def puff(seed=0):
    """PUFF = POP(1500 Hz, tau 25 ms) + a little breathy air so it reads as a puff, not a beep."""
    x = pop(1500, tau=0.025, seed=seed)
    n = len(x)
    a = bandpass(pink(n, seed + 7), 1200, 4200, 2) * env_perc(n, 0.018, 0.003)
    return finish(x + 0.35 * norm(a))


def mar(freq, seed=0, dur=2.0):
    """MAR(n): f (1.0, tau .40) + 3.93f (.25, .08) + 10.5f (.08, .03), 2 ms attack, 2 ms LP-noise
    mallet click at -18 dB. High partials are rolled off (fc 7 kHz) so the top notes stay sweet."""
    n = ns(dur)
    t = tax(n)
    x = np.zeros(n)
    for r, a, tau in ((1.0, 1.0, 0.40), (3.93, 0.25, 0.08), (10.5, 0.08, 0.03)):
        fr = freq * r
        if fr > 16000:
            continue
        x += a * rolloff(fr) * np.sin(TAU * fr * t) * np.exp(-t / tau)
    x *= env_perc(n, 1e9, 0.002)
    x = norm(x)
    nc = ns(0.002)
    c = lowpass(white(nc + 128, seed + 11), 2500, 2)[128:]
    c = norm(c) * fade(np.ones(nc), 0.0002, 0.0008)
    x[:nc] += c * db(-18)
    return finish(x, 0.0005, 0.03)


def bell(freqs, ring=2.4, strum=0.0, glassy=False, seed=0):
    """BELL(n...): per note partials f, 2.76f, 5.40f, 8.93f (amp 1 .4 .15 .06, tau 1.3 .6 .3 .15), 1 ms attack.
    `ring` = sounding length before a soft release. A faint +0.7 Hz twin on the fundamental adds shimmer.
    glassy: brighter, shorter, with an extra 4.07f partial (heart chime)."""
    parts = [(1.0, 1.0, 1.3), (2.76, 0.4, 0.6), (5.40, 0.15, 0.3), (8.93, 0.06, 0.15)]
    if glassy:
        parts = [(1.0, 1.0, 0.9), (2.76, 0.5, 0.45), (4.07, 0.22, 0.3), (5.40, 0.2, 0.22), (8.93, 0.08, 0.12)]
    rel = 0.45
    n = ns(ring + rel + strum * len(freqs))
    t = tax(n)
    x = np.zeros(n)
    for k, f in enumerate(freqs):
        i0 = ns(strum * k) if (strum > 0 and k > 0) else 0
        tt = t[: n - i0]
        y = np.zeros(n - i0)
        for r, a, tau in parts:
            fr = f * r
            if fr > 15000:
                continue
            y += a * rolloff(fr, 8000) * np.sin(TAU * fr * tt) * np.exp(-tt / tau)
        y += 0.12 * np.sin(TAU * (f + 0.7) * tt + 1.0) * np.exp(-tt / parts[0][2])
        y *= env_perc(len(y), 1e9, 0.001)
        x[i0:] += y
    rel_env = np.ones(n)
    i_r = ns(ring)
    if i_r < n:
        rr = n - i_r
        rel_env[i_r:] = np.cos(0.5 * np.pi * np.arange(rr) / rr) ** 2
    return finish(x * rel_env, 0.0005, 0.02)


def cel(freq, tau=0.9, dur=None, trem=0.03):
    """CEL(n): sine + 2f (-8 dB) + 3f (-18 dB), exp decay tau, 5 Hz tremolo at 3%."""
    dur = dur if dur is not None else min(6 * tau + 0.02, 3.0)
    n = ns(dur)
    t = tax(n)
    x = np.zeros(n)
    for r, a in ((1, 1.0), (2, db(-8)), (3, db(-18))):
        fr = freq * r
        if fr > 15000:
            continue
        x += a * rolloff(fr, 9000) * np.sin(TAU * fr * t)
    x *= env_perc(n, tau, 0.0015) * (1 + trem * np.sin(TAU * 5 * t))
    return finish(x, 0.0005, min(0.02, dur / 4))


def twinkle(f, dur=0.6, tau=0.3):
    """TWINKLE(f): sine f + 1.5f, tau 0.3 s, with a light 9 Hz shimmer."""
    n = ns(dur)
    t = tax(n)
    x = (np.sin(TAU * f * t) + 0.55 * rolloff(1.5 * f, 9000) * np.sin(TAU * 1.5 * f * t + 0.5))
    x *= env_perc(n, tau, 0.003) * (1 + 0.08 * np.sin(TAU * 9 * t))
    return finish(x, 0.001, 0.05)


def plip(f0, f1, d, tail=2.2):
    """PLIP(f0 -> f1, d): exponential sine chirp with exponential decay (tau = 0.45 d)."""
    n = ns(max(d * tail, 0.05))
    f = glide(f0, f1, n, d)
    x = np.sin(phase(f)) * env_perc(n, 0.45 * d, 0.0015)
    return finish(x, 0.0005, 0.008)


def boing(f0, f1, d, seed=0):
    """BOING(f0 -> f1, d): sine sweep with 8 Hz vibrato +-3%, Hann-ish envelope; soft 2nd/3rd harmonics."""
    n = ns(d + 0.06)
    t = tax(n)
    f = glide(f0, f1, n, d, curve=lambda u: 1 - (1 - u) ** 2) * (1 + 0.03 * np.sin(TAU * 8 * t))
    ph = phase(f)
    x = np.sin(ph) + db(-12) * np.sin(2 * ph) + db(-22) * np.sin(3 * ph)
    e = env_swell(n, min(0.5, 0.012 / (d + 0.06)), 1.0, 1.3)   # ~12 ms attack so it lands on the beat
    return finish(x * e, 0.001, 0.01)


def slide(f0, f1, d, seed=0):
    """SLIDE(f0 -> f1, d): slide-whistle glide with 6 Hz vibrato; soft 2nd harmonic and a little breath."""
    n = ns(d)
    t = tax(n)
    ease = lambda u: u * u * (3 - 2 * u)
    f = glide(f0, f1, n, d, curve=ease) * (1 + 0.015 * np.sin(TAU * 6 * t))
    ph = phase(f)
    x = np.sin(ph) + db(-16) * np.sin(2 * ph)
    br = tv_filter(white(n, seed), lambda F, T: resp_bp(F, np.interp(T, t, f) * 2.0, 2.0), 512)
    x = x + db(-20) * norm(br)
    return finish(x * env_ar(n, 0.03, 0.06), 0.001, 0.01)


def hup(f0, f1, d, seed=0):
    """HUP(f0 -> f1, d): a cartoon 'hup!' - sine sweep (with soft voice-like 2nd/3rd harmonics) plus
    breath (noise BP 1.2 kHz at -12 dB relative)."""
    n = ns(d + 0.03)
    t = tax(n)
    f = glide(f0, f1, n, d * 0.7, curve=lambda u: 1 - (1 - u) ** 3) * (1 + 0.01 * np.sin(TAU * 6 * t))
    ph = phase(f)
    x = np.sin(ph) + db(-9) * np.sin(2 * ph) + db(-17) * np.sin(3 * ph)
    x = norm(x)
    br = norm(peak_bp(white(n, seed), 1200, 1.4))
    x = x + db(-12) * br
    e = env_swell(n, 0.010 / (d + 0.03), 1.0, 1.6)   # 10 ms attack: a snappy hup
    return finish(x * e, 0.001, 0.01)


def gulp(ratio=1.0, seed=0):
    """GULP: a harmonic source gliding 420 -> 180 Hz over 70 ms through a BP formant at 800 Hz
    (a pure sine has nothing for a formant to shape, so the source carries a few harmonics)."""
    n = ns(0.16)
    t = tax(n)
    f = glide(420 * ratio, 180 * ratio, n, 0.07)
    ph = phase(f)
    src = sum((1.0 / k ** 1.3) * np.sin(k * ph) for k in range(1, 9))
    form = peak_bp(src, 800 * ratio ** 0.5, 2.5)
    x = 0.55 * np.sin(ph) + norm(form)
    e = env_perc(n, 0.035, 0.004) * np.clip(1.6 - t / 0.1, 0, 1) ** 0.5
    return finish(x * e, 0.001, 0.01)


def squish(seed=0):
    """SQUISH: 80 ms of noise BP 400 Hz + a sine 180 -> 260 Hz over 90 ms."""
    n = ns(0.10)
    nz = norm(peak_bp(white(n, seed), 400, 2.2)) * pad_to(env_swell(ns(0.08), 0.08, 1.0, 1.4), n)
    f = glide(180, 260, n, 0.09)
    s = np.sin(phase(f)) * env_swell(n, 0.10, 1.0, 1.3)
    return finish(0.8 * nz + s, 0.001, 0.008)


def creak(seed=0):
    """CREAK: sine 240 -> 160 Hz with FM (37 Hz modulator, index 2), 0.2 s; light tanh drive and a
    37 Hz stick-slip pulse so it reads as a creak."""
    n = ns(0.2)
    t = tax(n)
    f = glide(240, 160, n, 0.2)
    ph = phase(f) + 2.0 * np.sin(TAU * 37 * t)
    x = np.tanh(1.8 * np.sin(ph)) * (0.6 + 0.4 * np.abs(np.sin(np.pi * 37 * t)))
    x = lowpass(x, 3000, 2)
    return finish(x * env_ar(n, 0.025, 0.06), 0.001, 0.01)


def tick(f=1900.0, seed=0):
    """TICK: sines at f and 1.395f (1900 + 2650 Hz) tau 25 ms + a 2 ms click."""
    n = ns(0.14)
    t = tax(n)
    x = np.sin(TAU * f * t) + 0.8 * np.sin(TAU * f * (2650 / 1900) * t)
    x = norm(x * env_perc(n, 0.025, 0.0006))
    nc = ns(0.002)
    c = norm(highpass(white(nc + 64, seed), 2500, 2)[64:]) * fade(np.ones(nc), 0.0002, 0.0008)
    x[:nc] += 0.5 * c
    return finish(x, 0.0003, 0.008)


def tsk(seed=0, semis=0.0):
    """TSK: 15 ms of noise HP 4 kHz; a resonance at 5 kHz * 2^(semis/12) lets a run step up in pitch."""
    n = ns(0.015)
    w = white(n + 256, seed)
    x = highpass(w, 4000, 4)[256:]
    res = peak_bp(w, 5000 * 2 ** (semis / 12), 5.0)[256:]
    x = norm(x) + 1.2 * norm(res)
    return finish(x * env_perc(n, 0.005, 0.0005), 0.0003, 0.003)


def key(seed=0, thock_f=180.0, bp_f=3500.0, noise_dur=0.010, vary=True):
    """KEY: 10 ms noise BP 3.5 kHz (Q 2) + 180 Hz sine 'thock' (tau 15 ms); seeded +-6% pitch, +-2 dB gain."""
    r = gen(seed)
    p = 1 + r.uniform(-0.06, 0.06) if vary else 1.0
    g = db(r.uniform(-2, 2)) if vary else 1.0
    n = ns(0.09)
    t = tax(n)
    th = np.sin(phase(thock_f * p * (1 + 0.25 * np.exp(-t / 0.004)))) * env_perc(n, 0.015, 0.001)
    nn = ns(noise_dur)
    nz = peak_bp(white(nn + 256, seed + 1), bp_f * p, 2.0)[256:]
    nz = norm(nz) * fade(np.exp(-np.arange(nn) / (0.003 * SR)), 0.0004, 0.002)
    x = norm(th)
    x[:nn] += 0.75 * nz
    return finish(x, 0.0003, 0.01) * g


def space_key(seed=0):
    """SPACE: KEY with a 120 Hz thock and the noise BP at 1.8 kHz, 14 ms."""
    return key(seed, thock_f=120.0, bp_f=1800.0, noise_dur=0.014)


def thock(seed=0):
    """THOCK: 140 Hz sine (tau 40 ms) + KEY."""
    n = ns(0.25)
    t = tax(n)
    s = np.sin(phase(140 * (1 + 0.2 * np.exp(-t / 0.006)))) * env_perc(n, 0.040, 0.0015)
    k = key(seed, vary=False)
    x = norm(s) + 0.8 * pad_to(k, n)
    return finish(x, 0.0003, 0.02)


# ------------------------------------------------------------------ noise instruments

def scratch(d, seed=0):
    """SCRATCH(d): pink noise BP ~3.2 kHz (2.5-4 kHz, Q 0.8), AM by seeded 14-22 Hz pen-stroke grains,
    Hann envelope over d."""
    n = ns(d)
    r = gen(seed)
    x = tv_filter(pink(n, seed), lambda F, T: resp_bp(F, 3160, 0.8), 512)
    x = highpass(x, 1200, 2)
    am = np.zeros(n)
    tpos = r.uniform(0, 0.02)
    while tpos < d:
        L = r.uniform(1 / 22, 1 / 14)
        i0, m = ns(tpos), ns(L)
        a = r.uniform(0.45, 1.0)
        seg = a * env_swell(m, r.uniform(0.25, 0.6))
        e = min(n, i0 + m)
        if e > i0:
            am[i0:e] += seg[: e - i0]
        tpos += L
    x = x * (0.25 + am) * env_hann(n)
    return finish(x, 0.001, 0.005)


def swish(d, f0=1200.0, f1=4500.0, q=1.2, seed=0):
    """SWISH(d): noise BP whose centre sweeps 1.2 -> 4.5 kHz, Hann envelope."""
    n = ns(d)
    fc = sweep_curve(f0, f1, d)
    x = tv_filter(pink(n, seed), lambda F, T: resp_bp(F, fc(T), q), 512)
    return finish(x * env_swell(n, 0.45, 1.0, 1.2), 0.001, 0.005)


def fwip(seed=0, d=0.08):
    """FWIP: noise BP sweeping 700 -> 2600 Hz over 80 ms."""
    n = ns(d + 0.03)
    fc = sweep_curve(700, 2600, d, curve=lambda u: np.sqrt(u))
    x = tv_filter(white(n, seed), lambda F, T: resp_bp(F, fc(T), 2.0), 256)
    e = env_swell(n, 0.35, 0.8, 1.6)
    return finish(x * e, 0.001, 0.005)


def whoosh(f0, f1, d, peak=0.4, q=1.5, trem_hz=0.0, trem_depth=0.55, seed=0):
    """WHOOSH(f0 -> f1, d): pink noise BP (Q 1.5) whose centre sweeps f0 -> f1; swell peaking at `peak`."""
    n = ns(d)
    t = tax(n)
    fc = sweep_curve(f0, f1, d, curve=lambda u: u * u * (3 - 2 * u))
    x = tv_filter(pink(n, seed), lambda F, T: resp_bp(F, fc(T), q), 1024)
    e = env_swell(n, peak, 1.2, 1.4)
    if trem_hz > 0:
        e = e * (1 - trem_depth * 0.5 * (1 - np.cos(TAU * trem_hz * t)))
    return finish(x * e, 0.002, 0.01)


def air(d, lp0, lp1, peak=0.55, seed=0):
    """AIR: pink noise LP (sweeping lp0 -> lp1), slow swell."""
    n = ns(d)
    fc = sweep_curve(lp0, lp1, d)
    x = tv_filter(pink(n, seed), lambda F, T: resp_lp(F, fc(T), 2) * resp_hp(F, 60, 2), 2048)
    return finish(x * env_swell(n, peak, 1.3, 1.3), 0.002, 0.01)


def crack(seed=0):
    """CRACK: noise HP 3 kHz, 30 ms (with a little 5 kHz snap)."""
    n = ns(0.03)
    w = white(n + 256, seed)
    x = norm(highpass(w, 3000, 4)[256:]) + 0.6 * norm(peak_bp(w, 5200, 2.0)[256:])
    return finish(x * env_perc(n, 0.007, 0.0004), 0.0003, 0.004)


def paper(seed=0):
    """PAPER: 8 ms click of noise BP 2.5-4.5 kHz."""
    n = ns(0.008)
    x = bandpass(white(n + 256, seed), 2500, 4500, 2)[256:]
    return finish(x * env_perc(n, 0.0022, 0.0003), 0.0002, 0.002)


def pfft(seed=0, d=0.25):
    """Confetti 'pfft': noise HP 2 kHz, 0.25 s, fast attack and airy decay."""
    n = ns(d)
    w = pink(n + 512, seed)
    x = norm(highpass(w, 2000, 2)[512:]) + 0.5 * norm(peak_bp(w, 4200, 1.5)[512:])
    e = env_perc(n, 0.055, 0.004) * env_ar(n, 0.0, 0.08)
    return finish(x * e, 0.0008, 0.01)


def glint(ratio=1.0, seed=0, swell=0.1):
    """Focus glint: a 0.1 s reversed noise swell into a 2 kHz + 3 kHz sine pair (tau 0.25 s), pitch x ratio.
    The sine pair (the audible 'glint' onset) starts at +swell seconds."""
    ns_sw = ns(swell)
    n = ns_sw + ns(1.2)
    t = tax(n)
    nz = peak_bp(white(n, seed), 3200 * ratio, 1.2)[:ns_sw]
    u = np.arange(ns_sw) / ns_sw
    nz = norm(nz) * (np.exp(4.5 * (u - 1)) - np.exp(-4.5)) * fade(np.ones(ns_sw), 0.002, 0.002)
    tt = t[: n - ns_sw]
    tone = (np.sin(TAU * 2000 * ratio * tt) + 0.8 * np.sin(TAU * 3000 * ratio * tt + 0.7))
    tone = norm(tone * env_perc(len(tt), 0.25, 0.001))
    x = np.zeros(n)
    x[:ns_sw] += 0.5 * nz
    x[ns_sw:] += tone
    return finish(x, 0.001, 0.02)


def shimmer(count, d, seed=0, ping_tau=0.035, pan_max=0.6):
    """SHIMMER(n, d): n short CEL pings at F-major-pentatonic pitches between 3 and 7 kHz, scattered
    over d, random pan +-0.6, decaying. Returns stereo."""
    r = gen(seed)
    pitches = [3136.0, 3520.0, 4186.0, 4698.6, 5587.7, 6271.9]  # G7 A7 C8 D8 F8 G8
    n = ns(d + 0.35)
    out = np.zeros((2, n))
    onsets = np.sort(np.concatenate(([0.0], r.uniform(0.0, d, count - 1))))
    last = None
    for o in onsets:
        choice = int(r.integers(0, len(pitches)))
        if last is not None and choice == last:
            choice = (choice + 2) % len(pitches)
        last = choice
        ping = cel(pitches[choice], tau=ping_tau * r.uniform(0.8, 1.3), dur=0.3, trem=0.0)
        amp = np.exp(-o / (0.6 * d + 1e-6)) * r.uniform(0.6, 1.0)
        st = to_stereo(ping * amp, r.uniform(-pan_max, pan_max))
        i0 = ns(o) if o > 0 else 0
        m = min(st.shape[1], n - i0)
        out[:, i0:i0 + m] += st[:, :m]
    out = lowpass(out, 10000, 2)
    return norm(fade(out, 0.0005, 0.02))


# ------------------------------------------------------------------ impacts

def thump(tau=0.45, drive=2.2, noise_db=-14.0, seed=0, dur=2.4):
    """THUMP: sine 110 -> 55 Hz over 60 ms, tau 0.45 s, + a 50 ms burst of noise LP 900 Hz at -14 dB
    relative, tanh soft-clip (gives small speakers some harmonics to hear)."""
    n = ns(dur)
    f = glide(110, 55, n, 0.06)
    s = np.sin(phase(f)) * env_perc(n, tau, 0.0015)
    nn = ns(0.05)
    nz = lowpass(white(nn + 256, seed), 900, 2)[256:]
    nz = norm(nz) * env_perc(nn, 0.015, 0.0008) * fade(np.ones(nn), 0, 0.01)
    x = s.copy()
    x[:nn] += db(noise_db) * nz
    x = np.tanh(drive * x) / np.tanh(drive)
    return finish(x, 0.0005, 0.05)


def riser(d, seed=0, db_start=-8.0, rate0=1.6, rate1=3.0, pan_max=0.6, hard_stop=0.005):
    """RISER(d): reversed-swell noise LP sweeping 300 -> 3000 Hz + a sine 200 -> 600 Hz at -8 dB relative.
    Level ramps db_start -> 0 dB relative (the cue maps this to -20 -> -12 dBFS), accelerating.
    Auto-pans in a clockwise circle (top -> right -> bottom -> left) at 1.6 -> 3 Hz; the 'back' of
    the circle is slightly quieter. Hard stop with a 5 ms fade. Returns stereo."""
    n = ns(d)
    t = tax(n)
    u = t / d
    fc = sweep_curve(300, 3000, d)
    nz = tv_filter(pink(n, seed), lambda F, T: resp_lp(F, fc(T), 2) * resp_hp(F, 120, 1), 1024)
    # level-normalise the opening filter (AGC over ~40 ms) and soft-clip, so the crescendo comes from
    # the gain ramp and the noise's crest factor is ~8 dB instead of ~12 (more body at the same peak)
    rms = np.sqrt(uniform_filter1d(nz ** 2, ns(0.04), mode='nearest')) + 1e-9
    nz = np.tanh(nz / rms / 1.8)
    f = glide(200, 600, n, d, curve=lambda v: v ** 1.3) * (1 + 0.006 * np.sin(TAU * 5.5 * t))
    ph = phase(f)
    tone = norm(np.sin(ph) + db(-14) * np.sin(2 * ph))
    x = nz + db(-8) * tone
    lvl = db(db_start * (1 - u ** 2))              # -8 dB -> 0 dB, accelerating like the spiral whip-in
    swell = 0.8 + 0.2 * np.exp(4.0 * (u - 1))     # a little extra push in the last ~100 ms
    x = x * lvl * swell / swell[-1]
    rate = rate0 * (rate1 / rate0) ** u
    phi = TAU * np.cumsum(rate) / SR
    p = pan_max * np.sin(phi)
    depth = 1 - 0.12 * 0.5 * (1 - np.cos(phi))
    st = to_stereo(x * depth, p)
    st = fade(st, 0.04, hard_stop)
    return st / np.max(np.abs(st))


# ------------------------------------------------------------------ music voices

def tri_partials(freq, lp=1800.0, max_f=5000.0, kmax=11):
    """Band-limited triangle (odd harmonics, 1/k^2) through a one-pole LP response."""
    out = []
    for k in range(1, kmax + 1, 2):
        fk = k * freq
        if fk > max_f:
            break
        a = (8 / np.pi ** 2) * ((-1) ** ((k - 1) // 2)) / k ** 2
        a *= 1.0 / np.sqrt(1.0 + (fk / lp) ** 2)
        out.append((k, a))
    return out


def tri_tone(freq, n, ph0=0.0, lp=1800.0):
    t = tax(n)
    x = np.zeros(n)
    for k, a in tri_partials(freq, lp):
        x += a * np.sin(k * (TAU * freq * t + ph0))
    return x


def pluck_bass(freq, dur=2.0, tau=0.4):
    """PLUCK BASS: triangle, 8 ms attack, tau 0.4 s; higher harmonics decay faster (a natural pluck),
    plus a faint fast-decaying octave so it still reads on small speakers."""
    n = ns(dur)
    t = tax(n)
    x = np.zeros(n)
    for k, a in tri_partials(freq, lp=2400.0, max_f=4000.0, kmax=15):
        x += a * np.sin(TAU * k * freq * t) * np.exp(-t / (tau / (1 + 0.5 * (k - 1))))
    x += 0.22 * np.sin(TAU * 2 * freq * t) * np.exp(-t / 0.15)
    x *= env_perc(n, 1e9, 0.008)
    return finish(x, 0.001, 0.05)


# ------------------------------------------------------------------ reverb

def _comb_ir(x, D, g, damp):
    N = len(x)
    y = np.zeros(N)
    z = np.zeros(N)
    zi = np.zeros(1)
    b, a = [1 - damp], [1, -damp]
    for s in range(0, N, D):
        e = min(s + D, N)
        fb = z[s - D:e - D] if s >= D else 0.0
        y[s:e] = x[s:e] + g * fb
        z[s:e], zi = signal.lfilter(b, a, y[s:e], zi=zi)
    # read the comb's output from the end of its delay line (no undelayed direct tap)
    return np.concatenate([np.zeros(D), y[:N - D]])


def _allpass(x, D, g):
    N = len(x)
    y = np.zeros(N)
    for s in range(0, N, D):
        e = min(s + D, N)
        if s >= D:
            y[s:e] = -g * x[s:e] + x[s - D:e - D] + g * y[s - D:e - D]
        else:
            y[s:e] = -g * x[s:e]
    return y


def schroeder_ir(rt=1.2, dur=2.6, spread=0, damp=0.22, predelay=0.014, ap_g=0.7):
    """Schroeder reverb impulse response: 4 parallel damped combs -> 2 series allpasses.
    Comb gains give RT60 = rt; `spread` offsets the delays for the right channel (decorrelation).
    Output is warm-filtered (LP 6.5 kHz, HP 180 Hz) and normalised to unit energy."""
    n = ns(dur)
    imp = np.zeros(n)
    imp[ns(predelay)] = 1.0
    combs = [1695, 1760, 1623, 1548]
    aps = [245, 605]
    y = np.zeros(n)
    for D in combs:
        D = D + spread
        g = 10 ** (-3.0 * D / (rt * SR))
        y += _comb_ir(imp, D, g, damp)
    y /= len(combs)
    for D in aps:
        y = _allpass(y, D + (spread // 3), ap_g)
    y = lowpass(y, 6500, 2)
    y = highpass(y, 180, 2)
    y *= fade(np.ones(n), 0.0, 0.3)
    return y / np.sqrt(np.sum(y ** 2))


# ------------------------------------------------------------------ master

def limit(st, ceiling_db=-1.0, window=0.010):
    """Linked-stereo soft look-ahead limiter: the gain curve is a moving average of a min-filtered
    required gain over the same window, so it never exceeds what each sample needs and moves smoothly.
    Signals below the ceiling are untouched. Returns (limited, min_gain)."""
    c = db(ceiling_db)
    pk = np.max(np.abs(st), axis=0)
    g_req = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    if g_req.min() >= 1.0:
        return st.copy(), 1.0
    W = ns(window) | 1
    gm = minimum_filter1d(g_req, size=W, mode='nearest')
    g = uniform_filter1d(gm, size=W, mode='nearest')
    g = np.minimum(g, g_req)
    return st * g[None, :], float(g.min())


def write_wav(path, st):
    """st: (2, n) float in [-1, 1] -> 16-bit PCM stereo WAV."""
    from scipy.io import wavfile
    pcm = np.round(np.clip(st, -1.0, 1.0) * 32767.0).astype(np.int16)
    wavfile.write(path, SR, pcm.T.copy())
