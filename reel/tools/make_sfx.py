"""Synthesize every sound effect for the reel (no samples): meows, kitten mews, chirp, hiss, purr, kibble,
door latch, pops, whooshes, ding, sparkle, low hit. Usage: python make_sfx.py <outdir>

Meows are additive harmonic synthesis shaped by moving formants; the pitch/formant targets were calibrated
against the acoustic measurements of a real meow (F0 ~800->1100 Hz rise, energy peak ~3-4.5 kHz)."""
import sys, os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, lfilter

SR = 48000
RNG = np.random.default_rng(7)


def interp(u, pts):
    xs, ys = zip(*pts)
    return np.interp(u, xs, ys)


def smooth_noise(n, rate, seed):
    r = np.random.default_rng(seed)
    k = max(2, int(n / SR * rate) + 2)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), r.standard_normal(k))


def env_adsr(n, a, r, curve=2.0):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na) ** 0.7
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** curve
    return e


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def lor(f, F, B):
    return 1.0 / (1.0 + ((f - F) / (B / 2.0)) ** 2)


def meow(dur, f0_pts, open_pts, f2_pts, seed=0, trill=None, breath=0.035, jitter=0.01, tilt=0.85, bright=1.0, f1=1100):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f0 = interp(u, f0_pts) * (1 + jitter * smooth_noise(n, 35, seed)) * (1 + 0.006 * np.sin(2 * np.pi * 6.0 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    mouth = interp(u, open_pts)                       # 0 = closed ("m"), 1 = wide open ("aa")
    F2 = interp(u, f2_pts)
    F1 = f1 * (0.75 + 0.35 * mouth)
    cutoff = 1400 + 6500 * mouth * bright
    out = np.zeros(n)
    rp = np.random.default_rng(seed + 1).uniform(0, 2 * np.pi, 40)
    for k in range(1, 40):
        fk = k * f0
        alive = fk < 0.45 * SR
        if not alive.any():
            break
        H = 0.12 + 0.9 * lor(fk, F1, 700) + 1.25 * lor(fk, F2, 1300) + 0.45 * lor(fk, F2 * 1.45, 1600)
        lp = 1.0 / (1.0 + (fk / cutoff) ** 4)
        out += (k ** -tilt) * H * lp * alive * np.sin(k * ph + rp[k])
    amp = interp(u, [(0, 0), (0.06, 0.55), (0.18, 0.9), (0.55, 1.0), (0.82, 0.7), (1.0, 0)]) * (1 + 0.05 * smooth_noise(n, 20, seed + 2))
    if trill:  # rolled "rrr": amplitude modulation over a span of the call
        rate, u0, u1, depth = trill
        w = np.clip((u - u0) / 0.04, 0, 1) * np.clip((u1 - u) / 0.04, 0, 1)
        amp *= 1 - depth * w * (0.5 + 0.5 * np.cos(2 * np.pi * rate * t))
    out *= amp
    nz = highpass(RNG.standard_normal(n), 1800) * breath * interp(u, [(0, 1.0), (0.15, 0.35), (0.85, 0.35), (1, 0.8)]) * amp
    out = out / max(1e-9, np.abs(out).max()) + nz
    return out


def kitten_mews():
    parts = []
    for i, (d, a, b, c) in enumerate([(0.32, 1050, 1420, 1250), (0.28, 1150, 1500, 1300), (0.4, 1000, 1450, 1150)]):
        m = meow(d, [(0, a), (0.3, b), (1, c)], [(0, 0.2), (0.25, 1), (0.8, 0.8), (1, 0.3)], [(0, 3000), (0.3, 4600), (1, 3600)],
                 seed=20 + i, breath=0.05, tilt=1.0, f1=1400)
        parts += [m * (0.8 if i != 1 else 0.7), np.zeros(int(SR * (0.17 if i == 0 else 0.2)))]
    return np.concatenate(parts)


def hiss(dur=1.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = RNG.standard_normal(n)
    body = bandpass(x, 2200, 9000, 2) + 0.6 * bandpass(x, 4200, 5600, 2)
    e = np.interp(t, [0, 0.02, 0.12, dur * 0.65, dur], [0, 1, 0.82, 0.7, 0]) * (1 + 0.15 * smooth_noise(n, 9, 3))
    spit = np.zeros(n)
    k = int(0.012 * SR)
    spit[:k] = RNG.standard_normal(k) * np.linspace(1, 0, k) * 1.4
    return body * e + highpass(spit, 1500)


def purr(dur=4.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # alternating exhale / inhale phases, ~25 Hz laryngeal pulses
    cyc = 1.25
    phase = (t % cyc) / cyc
    exhale = phase < 0.58
    rate = np.where(exhale, 26.0, 22.5)
    pp = np.cumsum(rate) / SR
    pulse = np.exp(-((pp % 1.0) / 0.16) ** 2 * 4) + np.exp(-(((pp % 1.0) - 1) / 0.16) ** 2 * 4)
    noise = RNG.standard_normal(n)
    body = lowpass(noise, 900, 2) * pulse
    body = body + 0.5 * bandpass(noise, 120, 420, 2) * pulse
    breath = np.where(exhale, np.sin(np.pi * phase / 0.58), 0.75 * np.sin(np.pi * (phase - 0.58) / 0.42)) ** 0.6
    e = np.interp(t, [0, 0.25, dur - 0.5, dur], [0, 1, 1, 0])
    return body * breath * e


def kibble(dur=2.2):
    n = int(dur * SR)
    out = np.zeros(n)
    t = np.arange(n) / SR
    density = np.interp(t, [0, 0.15, 0.5, 1.5, 2.0, dur], [0, 60, 110, 90, 15, 0])  # pieces per second
    r = np.random.default_rng(11)
    pos = 0.0
    while pos < dur:
        d = density[min(n - 1, int(pos * SR))]
        pos += r.exponential(1.0 / max(d, 2.0))
        if pos >= dur:
            break
        i = int(pos * SR)
        L = int(r.uniform(0.004, 0.018) * SR)
        f = r.uniform(1800, 6000)
        tt = np.arange(L) / SR
        click = np.sin(2 * np.pi * f * tt + r.uniform(0, 6)) * np.exp(-tt / r.uniform(0.0015, 0.005))
        click += 0.5 * r.standard_normal(L) * np.exp(-tt / 0.0012)
        g = r.uniform(0.25, 1.0)
        out[i:i + L] += g * click[: max(0, min(L, n - i))]
    # ceramic bowl ring + low thud of the pile
    ring = bandpass(out, 1100, 2600, 2) * 0.6
    return highpass(out, 900) + ring


def door(dur=1.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for at, g in [(0.0, 1.0), (0.05, 0.6)]:  # latch click
        i = int(at * SR)
        L = int(0.02 * SR)
        tt = np.arange(L) / SR
        out[i:i + L] += g * (np.sin(2 * np.pi * 2600 * tt) + 0.7 * RNG.standard_normal(L)) * np.exp(-tt / 0.003)
    # soft creak: jittery low saw through a resonance
    f = 230 * (1 + 0.15 * smooth_noise(n, 6, 5)) + 60 * t
    saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
    creak = bandpass(saw, 400, 1800, 2) * np.interp(t, [0, 0.15, 0.3, 0.9, dur], [0, 0, 0.35, 0.25, 0])
    air = lowpass(RNG.standard_normal(n), 700) * np.interp(t, [0, 0.2, 0.6, dur], [0, 0.5, 0.3, 0]) * 0.5
    return out + creak + air


def pop(f0=820, f1=260, dur=0.11):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.018)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    click = RNG.standard_normal(n) * np.exp(-t / 0.002) * 0.3
    return s + highpass(click, 2000)


def whoosh(dur=0.45, up=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = RNG.standard_normal(n)
    out = np.zeros(n)
    centers = np.interp(t / dur, [0, 0.6, 1], [400, 3200, 900] if up else [2500, 700, 300])
    blk = 512
    for i in range(0, n, blk):  # piecewise band-pass sweep
        c = centers[i]
        seg = bandpass(x[max(0, i - 2048):i + blk], c * 0.6, min(c * 1.6, SR * 0.45), 2)
        out[i:i + blk] = seg[-min(blk, n - i):]
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    return out * e


def bell(freq, dur, partials=((1, 1), (2.76, 0.45), (5.4, 0.25), (8.9, 0.1)), decay=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (decay / r ** 0.5)) for r, a in partials)
    return out * np.minimum(1, t / 0.002)


def ding():
    a = bell(1568, 1.0)
    b = np.concatenate([np.zeros(int(0.09 * SR)), bell(2093, 0.91)])
    return a + 0.9 * b[: len(a)]


def sparkle():
    out = np.zeros(int(1.0 * SR))
    for i, f in enumerate([2093, 2637, 3136, 4186]):
        b = bell(f, 0.6, decay=0.18) * (0.8 - 0.12 * i)
        s = int(i * 0.07 * SR)
        out[s:s + len(b)] += b[: len(out) - s]
    return out


def hit(dur=0.7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 40 + 90 * np.exp(-t / 0.06)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    nz = lowpass(RNG.standard_normal(n), 2500) * np.exp(-t / 0.05) * 0.4
    return s + nz


def finish(x, peak=0.9, fade=0.01):
    x = np.asarray(x, dtype=np.float64)
    x = x - np.mean(x)
    nf = int(fade * SR)
    if nf and len(x) > 2 * nf:
        x[:nf] *= np.linspace(0, 1, nf)
        x[-nf:] *= np.linspace(1, 0, nf)
    return (x * peak / max(1e-9, np.abs(x).max())).astype(np.float32)


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    S = {
        # friendly hook meow: quick "m" onset, pitch jumps up like the reference, "ee-ow" formant glide
        "meow_hook": meow(0.78, [(0, 760), (0.12, 1000), (0.45, 1080), (0.8, 960), (1, 820)],
                          [(0, 0.05), (0.14, 0.9), (0.55, 1.0), (0.85, 0.55), (1, 0.15)],
                          [(0, 2600), (0.2, 4000), (0.55, 4300), (0.85, 3000), (1, 2300)], seed=1),
        "meow_soft": meow(0.6, [(0, 700), (0.2, 900), (0.6, 940), (1, 760)],
                          [(0, 0.05), (0.2, 0.7), (0.6, 0.75), (1, 0.15)],
                          [(0, 2500), (0.3, 3600), (0.7, 3500), (1, 2400)], seed=2, bright=0.8),
        # long demanding "mrrrRAOOOW"
        "meow_long": meow(1.55, [(0, 620), (0.14, 700), (0.3, 980), (0.55, 1060), (0.8, 900), (1, 640)],
                          [(0, 0.05), (0.16, 0.3), (0.32, 1.0), (0.7, 1.0), (0.9, 0.5), (1, 0.15)],
                          [(0, 2200), (0.16, 2600), (0.35, 4200), (0.65, 4400), (0.88, 2800), (1, 2200)],
                          seed=3, trill=(27, 0.0, 0.2, 0.75), jitter=0.016, tilt=0.75),
        # short rising trill "mrrp?"
        "meow_chirp": meow(0.36, [(0, 720), (0.6, 900), (1, 1180)], [(0, 0.1), (0.4, 0.45), (1, 0.6)],
                           [(0, 2200), (1, 3400)], seed=4, trill=(30, 0.0, 0.7, 0.85)),
        "kitten_mew": kitten_mews(),
        "hiss": hiss(),
        "purr": purr(),
        "kibble": kibble(),
        "door": door(),
        "pop": pop(),
        "pop_hi": pop(1200, 420, 0.09),
        "pop_lo": pop(600, 180, 0.13),
        "whoosh": whoosh(0.42, True),
        "whoosh_down": whoosh(0.5, False),
        "ding": ding(),
        "sparkle": sparkle(),
        "hit": hit(),
    }
    peaks = {"purr": 0.8, "hiss": 0.85, "kibble": 0.8, "whoosh": 0.7, "whoosh_down": 0.7, "hit": 0.9}
    for name, x in S.items():
        sf.write(os.path.join(out, f"{name}.wav"), finish(x, peaks.get(name, 0.9)), SR, subtype="PCM_16")
        print(f"{name}: {len(x) / SR:.2f}s")


if __name__ == "__main__":
    main()
