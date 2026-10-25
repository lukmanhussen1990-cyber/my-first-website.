"""Procedural sound library (48 kHz, float32, stereo). No samples, no licences.

sound(name, variant) -> np.ndarray (n, 2)
drone(duration, swell_at=None) -> np.ndarray (n, 2)  dark ambient bed
"""
import numpy as np
from scipy import signal

SR = 48000


def _t(d):
    return np.arange(int(d * SR)) / SR


def _rng(seed):
    return np.random.default_rng(seed)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype="band", output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), btype="low", output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f / (SR / 2), btype="high", output="sos"), x)


def env_exp(n, decay, attack=0.0005):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    return a * np.exp(-t / decay)


def damped(freq, decay, d, phase=0.0):
    t = _t(d)
    return np.sin(2 * np.pi * freq * t + phase) * np.exp(-t / decay)


def chirp(f0, f1, d, decay=None):
    t = _t(d)
    ph = 2 * np.pi * (f0 * t + (f1 - f0) * t * t / (2 * d))
    y = np.sin(ph)
    return y * (np.exp(-t / decay) if decay else 1)


def pad_to(x, n):
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


def stereo(x, pan=0.0, width=0.0, seed=0):
    """pan -1..1; width adds a tiny decorrelated delay for space."""
    l = x * np.sqrt(0.5 * (1 - pan))
    r = x * np.sqrt(0.5 * (1 + pan))
    if width > 0:
        d = int(width * 0.0006 * SR)
        r = np.concatenate([np.zeros(d), r[:-d]]) if d else r
    return np.stack([l, r], 1)


# ------------------------------------------------------------------ sounds
def s_type(v):
    r = _rng(100 + v)
    d = 0.09
    n = int(d * SR)
    click = hp(r.standard_normal(n), 2500) * env_exp(n, 0.0012)
    k = 1 + (r.random() - 0.5) * 0.16
    body = 0.5 * damped(1750 * k, 0.012, d) + 0.35 * damped(3300 * k, 0.008, d) + 0.6 * damped(190 * k, 0.02, d)
    clack = np.zeros(n); off = int((0.018 + r.random() * 0.01) * SR)
    clack[off:] = 0.35 * hp(r.standard_normal(n - off), 1500) * env_exp(n - off, 0.003)
    return stereo(norm(click * 0.9 + body * 0.5 + clack, 0.8), pan=(r.random() - 0.5) * 0.3)


def s_pop(v):
    d = 0.16
    t = _t(d)
    f = 210 * np.exp(-t / 0.03) + 95
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 0.06, 0.002)
    tick = hp(_rng(7 + v).standard_normal(len(t)), 3000) * env_exp(len(t), 0.0015) * 0.4
    return stereo(norm(thump + tick, 0.8))


def s_slide(v):
    r = _rng(200 + v)
    d = 0.42
    n = int(d * SR)
    x = r.standard_normal(n)
    x = bp(x, 700, 4200)
    rough = np.abs(lp(r.standard_normal(n), 35)) * 6 + 0.5
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    y = x * rough * e
    return stereo(norm(y, 0.7), pan=0.25 * np.sign(r.random() - 0.5), width=1)


def s_whoosh(v):
    r = _rng(300 + v)
    d = 0.55
    n = int(d * SR)
    x = r.standard_normal(n)
    # time-varying band-pass via short-block filtering
    out = np.zeros(n); blk = 480
    for i in range(0, n, blk):
        u = i / n
        fc = 350 + 2600 * np.sin(np.pi * min(1, u * 1.15)) ** 2
        seg = x[max(0, i - 2048):i + blk]
        y = bp(seg, fc * 0.6, fc * 1.6)
        out[i:i + blk] = y[-min(blk, n - i):]
    e = np.sin(np.linspace(0, np.pi, n)) ** 2.2
    y = out * e
    st = stereo(y)
    pan = np.linspace(-0.7, 0.7, n)
    st[:, 0] *= np.sqrt(0.5 * (1 - pan)) * 1.41; st[:, 1] *= np.sqrt(0.5 * (1 + pan)) * 1.41
    return norm(st, 0.75)


def s_stamp(v):
    r = _rng(400 + v)
    d = 0.6
    n = int(d * SR)
    t = _t(d)
    f = 95 * np.exp(-t / 0.05) + 52
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.12, 0.002)
    slap = bp(r.standard_normal(n), 250, 2600) * env_exp(n, 0.035)
    knock = 0.6 * damped(230, 0.05, d) + 0.4 * damped(510, 0.035, d)
    crinkle = hp(r.standard_normal(n), 3500) * env_exp(n, 0.09) * 0.25
    y = thump * 1.0 + slap * 0.55 + knock * 0.5 + crinkle
    return stereo(norm(y, 0.95))


def s_rip(v):
    r = _rng(500 + v)
    d = 0.55
    n = int(d * SR)
    y = np.zeros(n)
    t = 0.0
    while t < d - 0.02:
        i = int(t * SR)
        L = int(0.004 * SR)
        y[i:i + L] += r.standard_normal(min(L, n - i)) * env_exp(min(L, n - i), 0.0012) * (0.4 + r.random())
        t += 0.002 + r.random() * 0.012 * (1 - t / d)
    y = bp(y, 900, 7000) + 0.25 * bp(r.standard_normal(n), 300, 1200) * env_exp(n, 0.2)
    e = np.minimum(1, np.linspace(0, 6, n)) * np.linspace(1, 0.3, n)
    return stereo(norm(y * e, 0.8), width=1)


def s_pen(v):
    r = _rng(600 + v)
    d = 0.32 + 0.1 * r.random()
    n = int(d * SR)
    x = bp(r.standard_normal(n), 1800, 7500)
    am = np.clip(lp(r.standard_normal(n), 70) * 8, 0, None) + 0.3
    felt = lp(r.standard_normal(n), 900) * 0.4
    e = np.minimum(1, np.linspace(0, 12, n)) * np.minimum(1, np.linspace(6, 0, n))
    return stereo(norm((x * am + felt) * e, 0.6), pan=(r.random() - 0.5) * 0.4)


def s_tick(v):
    d = 0.08
    n = int(d * SR)
    click = hp(_rng(700 + v).standard_normal(n), 4000) * env_exp(n, 0.0008)
    ping = damped(3200, 0.012, d) * 0.5 + damped(1150, 0.02, d) * 0.35
    return stereo(norm(click + ping, 0.6))


def s_flip(v):
    d = 0.16
    n = int(d * SR)
    y = np.zeros(n)
    for k, off in enumerate((0.0, 0.045)):
        i = int(off * SR); m = n - i
        y[i:] += (hp(_rng(800 + v + k).standard_normal(m), 2500) * env_exp(m, 0.0015)
                  + 0.5 * damped(900, 0.02, m / SR) + 0.3 * damped(1750, 0.012, m / SR)) * (1.0 if k == 0 else 0.7)
    return stereo(norm(y, 0.65))


def s_heartbeat(v):
    d = 0.6
    n = int(d * SR)
    t = _t(d)
    def thump(f0, dec):
        f = f0 * (1 + 0.6 * np.exp(-t / 0.02))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, dec, 0.008)
    lub = thump(50, 0.07) + 0.3 * lp(_rng(900 + v).standard_normal(n), 120) * env_exp(n, 0.05)
    dub = np.zeros(n); i = int(0.21 * SR)
    dub[i:] = (thump(60, 0.055) * 0.75)[: n - i]
    y = lp(lub + dub, 180)
    return stereo(norm(y, 0.9))


def s_wings(v):
    r = _rng(1000 + v)
    d = 0.75
    n = int(d * SR)
    y = np.zeros(n)
    flaps = 7
    for k in range(flaps):
        i = int((0.02 + k * 0.085 + r.random() * 0.01) * SR)
        L = int(0.07 * SR)
        if i + L > n:
            break
        burst = lp(r.standard_normal(L), 1100) * np.sin(np.linspace(0, np.pi, L)) ** 2
        y[i:i + L] += burst * (0.6 + 0.4 * np.sin(np.pi * k / flaps))
    y += 0.12 * bp(r.standard_normal(n), 2500, 7000) * np.sin(np.linspace(0, np.pi, n))
    return stereo(norm(y, 0.8), width=1)


def s_peck(v):
    r = _rng(1100 + v)
    d = 0.3
    n = int(d * SR)
    click = hp(r.standard_normal(n), 3000) * env_exp(n, 0.0009) * 1.2
    knock = damped(1400, 0.018, d) * 0.7 + damped(620, 0.03, d) * 0.6
    t = _t(d)
    f = 320 * np.exp(-t / 0.05) + 140
    squelch = np.sin(2 * np.pi * np.cumsum(f) / SR) * lp(r.standard_normal(n), 1500) * env_exp(n, 0.06) * 0.6
    return stereo(norm(click + knock + squelch, 0.95))


def s_crack(v):
    r = _rng(1200 + v)
    d = 0.35
    n = int(d * SR)
    y = np.zeros(n)
    for k in range(6):
        i = int((k * 0.012 + r.random() * 0.01) * SR)
        L = int(0.006 * SR)
        y[i:i + L] += r.standard_normal(L) * env_exp(L, 0.0015) * (1 - k / 7)
    y = hp(y, 1200) + 0.5 * damped(95, 0.06, d) + 0.3 * bp(r.standard_normal(n), 400, 2500) * env_exp(n, 0.05)
    return stereo(norm(y, 0.85), width=1)


def s_squish(v):
    r = _rng(1300 + v)
    d = 0.32
    n = int(d * SR)
    t = _t(d)
    base = lp(r.standard_normal(n), 900)
    f = 260 * np.exp(-t / 0.12) + 110
    res = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = base * (0.6 + 0.4 * res) * env_exp(n, 0.1, 0.01)
    for k in range(3):
        i = int((0.04 + k * 0.06 + r.random() * 0.03) * SR)
        b = chirp(280 + 200 * r.random(), 900, 0.03, 0.01) * 0.4
        y[i:i + len(b)] += b[: n - i]
    return stereo(norm(y, 0.7))


def s_splat(v):
    r = _rng(1400 + v)
    d = 0.3
    n = int(d * SR)
    y = lp(r.standard_normal(n), 2200) * env_exp(n, 0.05, 0.001) + 0.6 * damped(140, 0.05, d)
    y += 0.3 * bp(r.standard_normal(n), 2000, 6000) * env_exp(n, 0.02)
    return stereo(norm(y, 0.8))


def s_inflate(v):
    d = 0.75
    t = _t(d)
    f = 110 + 170 * (t / d) ** 0.7 + 6 * np.sin(2 * np.pi * 9 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    rub = lp(_rng(1500 + v).standard_normal(len(t)), 700)
    e = np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.15)
    y = (0.6 * tone + 0.5 * rub * (0.5 + 0.5 * tone)) * e
    return stereo(norm(lp(y, 2500), 0.6))


def s_scan(v):
    d = 0.55
    t = _t(d)
    buzz = signal.sawtooth(2 * np.pi * 58 * t) * 0.4
    sweep = chirp(300, 3200, d) * 0.25
    noise = bp(_rng(1600 + v).standard_normal(len(t)), 1500, 6000) * 0.25
    e = np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.35) / 0.08)
    zap = np.zeros(len(t)); i = int(0.38 * SR)
    zap[i:] = hp(_rng(1601).standard_normal(len(t) - i), 2000) * env_exp(len(t) - i, 0.03) * 0.5
    y = lp(buzz, 1500) * e + sweep * e + noise * e + zap
    return stereo(norm(y, 0.7), width=1)


def s_hum(v):
    d = 1.4
    t = _t(d)
    y = (np.sin(2 * np.pi * 60 * t) + 0.5 * np.sin(2 * np.pi * 120 * t) + 0.25 * np.sin(2 * np.pi * 180 * t + 1))
    y *= 0.75 + 0.25 * np.sin(2 * np.pi * 5.5 * t)
    y += 0.15 * bp(_rng(1700 + v).standard_normal(len(t)), 800, 3000)
    e = np.sin(np.linspace(0, np.pi, len(t))) ** 1.2
    return stereo(norm(y * e, 0.55))


def s_beep(v):
    d = 0.16
    t = _t(d)
    y = np.sin(2 * np.pi * 1000 * t) * np.minimum(1, t / 0.005) * np.minimum(1, (d - t) / 0.04)
    return stereo(norm(lp(y, 3000), 0.4))


def s_switch(v):
    d = 0.12
    n = int(d * SR)
    y = np.zeros(n)
    for k, off in enumerate((0, 0.028)):
        i = int(off * SR); m = n - i
        y[i:] += (hp(_rng(1800 + k).standard_normal(m), 2000) * env_exp(m, 0.001) + 0.5 * damped(2100, 0.008, m / SR) + 0.4 * damped(300, 0.02, m / SR)) * (1 if k == 0 else 0.6)
    return stereo(norm(y, 0.7))


def s_thud(v):
    d = 0.35
    n = int(d * SR)
    t = _t(d)
    f = 110 * np.exp(-t / 0.04) + 60
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.09, 0.002) + 0.3 * lp(_rng(1900 + v).standard_normal(n), 400) * env_exp(n, 0.05)
    return stereo(norm(y, 0.8))


SOUNDS = {
    "type": s_type, "pop": s_pop, "slide": s_slide, "whoosh": s_whoosh, "stamp": s_stamp, "rip": s_rip,
    "pen": s_pen, "tick": s_tick, "flip": s_flip, "heartbeat": s_heartbeat, "wings": s_wings, "peck": s_peck,
    "crack": s_crack, "squish": s_squish, "splat": s_splat, "inflate": s_inflate, "scan": s_scan, "hum": s_hum,
    "beep": s_beep, "switch": s_switch, "thud": s_thud,
}
# loudness of each sound relative to the others (applied on top of the cue gain)
LEVEL = {
    "type": 0.32, "pop": 0.42, "slide": 0.38, "whoosh": 0.42, "stamp": 0.95, "rip": 0.55, "pen": 0.32, "tick": 0.3,
    "flip": 0.42, "heartbeat": 0.85, "wings": 0.6, "peck": 0.8, "crack": 0.55, "squish": 0.5, "splat": 0.55,
    "inflate": 0.45, "scan": 0.45, "hum": 0.35, "beep": 0.25, "switch": 0.5, "thud": 0.55,
}

_cache = {}


def sound(name, variant=0):
    key = (name, variant % 8)
    if key not in _cache:
        _cache[key] = SOUNDS[name](variant % 8).astype(np.float32)
    return _cache[key]


# ------------------------------------------------------------------ music bed
def drone(duration, seed=3, swell_at=None, swell_len=None):
    """Dark, low ambient drone in A with slow movement; optional warm swell at the end."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    r = _rng(seed)
    out = np.zeros((n, 2))
    # detuned low saws through a slowly moving low-pass
    for f, g, det in ((55.0, 0.55, 0.12), (82.41, 0.28, 0.09), (110.0, 0.18, 0.15)):
        for k, dt in enumerate((-det, det)):
            x = signal.sawtooth(2 * np.pi * (f + dt) * t + r.random() * 6)
            x = lp(x, 260 + 60 * np.sin(0.05 * t.mean()))
            out[:, k] += x * g
    # slow filter-like breathing
    breath = 0.75 + 0.25 * np.sin(2 * np.pi * 0.045 * t + 1.0)
    out *= breath[:, None]
    # minor colour: C (minor third) fading in and out
    c = np.sin(2 * np.pi * 130.81 * t) * (0.06 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.021 * t)))
    out += c[:, None]
    # high air
    air = bp(r.standard_normal(n), 1800, 4200) * (0.012 + 0.01 * np.sin(2 * np.pi * 0.07 * t) ** 2)
    out[:, 0] += air; out[:, 1] += np.roll(air, 900)
    # sub pulse (very soft) every 2 s for tension
    sub = np.zeros(n)
    beat = int(2.0 * SR)
    hb = s_heartbeat(0)[:, 0] * 0.12
    for i in range(int(1.0 * SR), n - len(hb), beat):
        sub[i:i + len(hb)] += hb
    out += sub[:, None]
    if swell_at is not None:
        L = swell_len or (duration - swell_at)
        out += warm_swell(duration, swell_at, L)
    fade = np.minimum(1, t / 1.5) * np.minimum(1, (duration - t) / 1.2)
    return (out * fade[:, None]).astype(np.float32)


def warm_swell(duration, start, length):
    """Soft pad + plucked arpeggio in A minor for the ending (like the reference's closing music)."""
    n = int(duration * SR)
    out = np.zeros((n, 2))
    chords = [(57, 60, 64, 71), (53, 57, 60, 64), (48, 55, 60, 64), (55, 59, 62, 67)]  # Am(add9) F C G
    midi = lambda m: 440 * 2 ** ((m - 69) / 12)
    seg = max(2.5, length / 4)
    i0 = int(start * SR)
    for ci, ch in enumerate(chords):
        a = i0 + int(ci * seg * SR)
        L = int((seg + 1.5) * SR)
        if a >= n:
            break
        L = min(L, n - a)
        tt = np.arange(L) / SR
        env = np.minimum(1, tt / 1.2) * np.minimum(1, (L / SR - tt) / 1.4)
        pad = np.zeros(L)
        for m in ch:
            f = midi(m)
            pad += signal.sawtooth(2 * np.pi * f * tt) * 0.5 + signal.sawtooth(2 * np.pi * f * 1.004 * tt) * 0.5
        pad = lp(pad, 900) * env * 0.05
        out[a:a + L, 0] += pad; out[a:a + L, 1] += np.roll(pad, 300)
        # arpeggio plucks
        for k in range(8):
            j = a + int(k * seg / 8 * SR)
            if j >= n:
                break
            f = midi(ch[k % 4] + 12)
            pl = np.sin(2 * np.pi * f * np.arange(int(1.2 * SR)) / SR) + 0.3 * np.sin(4 * np.pi * f * np.arange(int(1.2 * SR)) / SR)
            pl *= np.exp(-np.arange(len(pl)) / SR / 0.35) * 0.05
            m2 = min(len(pl), n - j)
            pan = 0.3 * (1 if k % 2 else -1)
            out[j:j + m2, 0] += pl[:m2] * np.sqrt(0.5 * (1 - pan)); out[j:j + m2, 1] += pl[:m2] * np.sqrt(0.5 * (1 + pan))
    # overall rise
    ramp = np.zeros(n)
    ramp[i0:] = np.minimum(1, np.arange(n - i0) / SR / 3.0)
    return out * ramp[:, None]
