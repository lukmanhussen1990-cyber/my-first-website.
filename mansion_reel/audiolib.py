"""Shared audio helpers for the wedding reel (copied from thanksgiving_reel/make_sfx.py: filters, synthetic
reverb, BS.1770 loudness, save-with-normalisation) plus the orchestral 'DUN' from that reel.
Level convention: every effect file is normalised so its loudest 400 ms (momentary loudness) is REF_LUFS = -20
LUFS, the same level the narrator is mixed at; a cue's gain_db is then "how loud vs the narrator"."""
import os

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SFX_DIR = os.path.join(HERE, "audio", "sfx")
SR = 48000
REF_LUFS = -20.0
PEAK_CAP_DB = -1.0


# ----------------------------------------------------------------------------------------------- basics
def n_(d):
    return int(round(d * SR))


def tt(d):
    return np.arange(n_(d)) / SR


def rng(seed):
    return np.random.default_rng(seed)


def _butter(x, kind, f, order):
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def lp(x, f, order=2):
    return _butter(x, "lowpass", f, order)


def hp(x, f, order=2):
    return _butter(x, "highpass", f, order)


def bp(x, lo, hi, order=2):
    return _butter(x, "bandpass", [lo, hi], order)


def lpnoise(r, n, fc, order=2):
    """Smooth random control signal, ~unit std, bandwidth fc (Hz)."""
    warm = int(min(2 * SR, 4 * SR / fc))
    x = lp(r.standard_normal(n + warm), fc, order)[warm:]
    return x / (x.std() + 1e-12)


def reson(x, f, bw):
    """Klatt two-pole resonator (unity gain at DC)."""
    rr = np.exp(-np.pi * bw / SR)
    b1 = 2 * rr * np.cos(2 * np.pi * f / SR)
    b2 = -rr * rr
    return signal.lfilter([1 - b1 - b2], [1, -b1, -b2], x)


def svf(x, fc, q=0.707, mode="bp"):
    """Time-varying TPT state-variable filter. fc may be an array (Hz per sample). bp has unity peak gain."""
    x = np.asarray(x, float)
    fc = np.clip(np.broadcast_to(np.asarray(fc, float), x.shape), 10.0, 0.45 * SR)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xs, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    ic1 = ic2 = 0.0
    out = [0.0] * len(xs)
    lowp = mode == "lp"
    for i in range(len(xs)):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        out[i] = v2 if lowp else v1
    y = np.array(out)
    return y if lowp else y * k


def harmonics(f0, fmax=7000.0, tilt=1.0):
    """Band-limited additive pulse source: sum_k sin(k*phase)/k^tilt (tilt 1 = sawtooth)."""
    f0 = np.asarray(f0, float)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros_like(f0)
    kmax = int(fmax / max(f0.min(), 20.0)) + 1
    for k in range(1, kmax + 1):
        m = np.clip((fmax - k * f0) / (0.2 * fmax), 0.0, 1.0)
        if m.max() <= 0:
            break
        out += m * np.sin(k * ph) / k ** tilt
    return out


def saw(f, phase0=0.0):
    """PolyBLEP band-limited sawtooth for an f (Hz) array."""
    dt = np.asarray(f, float) / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    y[m] -= t * t + t + t + 1
    return y


def add_at(buf, x, t0):
    i = n_(t0)
    if i >= len(buf) or i + len(x) <= 0:
        return
    s = max(0, -i)
    j = min(len(buf), i + len(x))
    buf[max(i, 0):j] += x[s:s + j - max(i, 0)]


def cosramp(n):
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(1, n))


def att(t, a):
    """Smooth 0->1 attack of length a seconds (raised cosine)."""
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1))


def bubble(f0, tau, rise=0.5, amp=1.0, harm=0.0):
    """Liquid bubble: damped sine whose pitch rises (Minnaert-like chirp)."""
    t = tt(tau * 7 + 0.004)
    f = f0 * (1 + rise * np.minimum(t / (3 * tau), 1.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + harm * np.sin(2 * ph)) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0012))
    return amp * y


def modal(partials, dur, seed=0, strike=0.15, strike_tau=0.0012, strike_hp=2500.0, beat=0.0018, detune=1.0, twin=0.35):
    """Struck object = sum of exponentially decaying partials (f, amp, tau) + a short strike noise.
    Each partial has a slightly detuned twin (real plates/glasses have split mode pairs -> gentle beating).
    The buffer is at least 6.5 x the longest decay (-56 dB) and ends with a fade, so nothing is cut off."""
    r = rng(seed)
    dur = max(dur, 6.5 * max(p[2] for p in partials))
    t = tt(dur)
    y = np.zeros_like(t)
    for f, a, tau in partials:
        f = f * detune
        y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t)
        f2 = f * (1 + beat * r.uniform(0.5, 1.5))
        y += twin * a * np.exp(-t / (tau * 0.8)) * np.sin(2 * np.pi * f2 * t)
    y *= 1 - np.exp(-t / 0.00025)
    nz = hp(r.standard_normal(len(t)), strike_hp) * np.exp(-t / strike_tau) * strike
    y = y + nz
    y *= 1 - att(t - 0.88 * dur, 0.12 * dur)
    return y


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-20))


# --------------------------------------------------------------------------------------------- reverb
_IR = {}
IR_SPECS = {
    # rt60 (s), predelay (s), low/high decay multipliers, early reflections [(s, gain)], lowpass on IR, seed
    "room": dict(rt=0.55, pre=0.006, lo=1.15, hi=0.45, er=[(0.0041, 0.55), (0.0073, 0.42), (0.0117, 0.34), (0.0164, 0.26), (0.0229, 0.2)], lpf=9000, seed=11),
    "small": dict(rt=0.28, pre=0.002, lo=1.0, hi=0.5, er=[(0.0021, 0.5), (0.0039, 0.4), (0.0061, 0.3)], lpf=10000, seed=12),
    "hall": dict(rt=2.3, pre=0.024, lo=1.25, hi=0.4, er=[(0.011, 0.5), (0.019, 0.42), (0.029, 0.35), (0.041, 0.28), (0.057, 0.22)], lpf=8000, seed=13),
    "cave": dict(rt=0.45, pre=0.003, lo=1.1, hi=0.35, er=[(0.0027, 0.6), (0.0051, 0.5), (0.0083, 0.4)], lpf=2600, seed=14),
}


def ir(kind):
    """Synthetic stereo impulse response (unit energy per channel, decorrelated L/R)."""
    if kind in _IR:
        return _IR[kind]
    p = IR_SPECS[kind]
    r = rng(p["seed"])
    L = n_(p["rt"] * 1.5)
    t = np.arange(L) / SR
    chans = []
    for ch in range(2):
        nz = r.standard_normal(L)
        low = lp(nz, 500)
        high = hp(nz, 4000)
        mid = nz - low - high
        dec = lambda rt: np.exp(-6.91 * t / rt)
        tail = low * dec(p["rt"] * p["lo"]) + mid * dec(p["rt"]) + high * dec(p["rt"] * p["hi"])
        tail *= 1 - np.exp(-t / 0.012)
        tail /= np.sqrt(np.sum(tail ** 2))
        h = np.zeros(L + n_(p["pre"]) + n_(0.07))
        h[n_(p["pre"]):n_(p["pre"]) + L] += tail
        for k, (d, g) in enumerate(p["er"]):
            d2 = d * (1 + 0.13 * (ch * 2 - 1) * (1 if k % 2 else -1))
            h[n_(d2)] += g * 0.18 * (1 if (k + ch) % 2 else -1)
        h = lp(h, p["lpf"])
        h /= np.sqrt(np.sum(h ** 2))
        chans.append(h)
    _IR[kind] = np.stack(chans, 1)
    return _IR[kind]


def place(x, pan=0.0, room=None, wet_db=-14.0, dry=1.0):
    """Mono -> stereo: constant-power pan (0 dB per channel at centre) + optional stereo reverb."""
    a = (pan + 1) * np.pi / 4
    gl, gr = np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)
    x = np.array(x, float)
    g10 = min(len(x) // 4, n_(0.01))
    if g10 > 1:
        x[-g10:] *= cosramp(g10)[::-1]                       # guard: the dry signal never stops abruptly
    h = ir(room) if room else None
    n = len(x) + (len(h) - 1 if h is not None else 0)
    out = np.zeros((n, 2))
    out[:len(x), 0] += dry * gl * x
    out[:len(x), 1] += dry * gr * x
    if h is not None:
        g = 10 ** (wet_db / 20)
        for c in range(2):
            out[:, c] += g * signal.fftconvolve(x, h[:, c])
    return out


# ------------------------------------------------------------------------------------ loudness (BS.1770)
_KB1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_KA1 = [1.0, -1.69065929318241, 0.73248077421585]
_KB2 = [1.0, -2.0, 1.0]
_KA2 = [1.0, -1.99004745483398, 0.99007225036621]


def _power(x):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = x[:, None]
    y = signal.lfilter(_KB2, _KA2, signal.lfilter(_KB1, _KA1, x, axis=0), axis=0)
    return np.sum(y * y, axis=1)


def momentary(x, hop=0.05, win=0.4):
    """Momentary loudness (LUFS) every hop seconds; returns (values, start times)."""
    p = _power(x)
    w = n_(win)
    if len(p) < w:
        p = np.concatenate([p, np.zeros(w - len(p))])
    cs = np.concatenate([[0.0], np.cumsum(p)])
    st = np.arange(0, len(p) - w + 1, n_(hop))
    ms = (cs[st + w] - cs[st]) / w
    return -0.691 + 10 * np.log10(ms + 1e-20), st / SR


def mmax(x):
    return float(momentary(x)[0].max())


def integrated(x):
    """BS.1770-4 gated integrated loudness (LUFS)."""
    lk, _ = momentary(x, hop=0.1, win=0.4)
    lk = lk[lk > -70]
    if len(lk) == 0:
        return -70.0
    zr = -0.691 + 10 * np.log10(np.mean(10 ** ((lk + 0.691) / 10))) - 10
    g = lk[lk > zr]
    return float(-0.691 + 10 * np.log10(np.mean(10 ** ((g + 0.691) / 10))))


# --------------------------------------------------------------------------------------------- output
INFO = {}


def save(name, x, level=REF_LUFS, by="mmax", fade_in=0.002, fade_out=0.03, trim_db=-60.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = place(x)
    x = hp(x, 18.0, 2)                                    # DC / sub-sonic removal
    env = np.abs(x).max(axis=1)
    above = np.nonzero(env > env.max() * 10 ** (trim_db / 20))[0]
    x = x[:min(len(x), above[-1] + n_(0.02))]
    fi, fo = max(1, n_(fade_in)), max(1, min(n_(fade_out), len(x) // 2))
    x[:fi] *= cosramp(fi)[:, None]
    x[-fo:] *= cosramp(fo)[::-1][:, None]
    cur = mmax(x) if by == "mmax" else integrated(x)
    g = 10 ** ((level - cur) / 20)
    pk = np.abs(x).max() * g
    if pk > 10 ** (PEAK_CAP_DB / 20):
        g *= 10 ** (PEAK_CAP_DB / 20) / pk
    x = x * g
    x -= x.mean(axis=0)                                   # exact zero mean (no DC offset)
    os.makedirs(SFX_DIR, exist_ok=True)
    sf.write(os.path.join(SFX_DIR, name + ".wav"), x.astype(np.float32), SR, subtype="PCM_24")
    INFO[name] = dict(dur=len(x) / SR, peak_db=20 * np.log10(np.abs(x).max() + 1e-12),
                      rms_db=20 * np.log10(rms(x) + 1e-12), mmax=mmax(x), lufs_i=integrated(x))
    return x



def make_dun():
    """Dramatic orchestral 'DUN': low brass section (C minor, scooped attack, bright blat that darkens),
    timpani, low piano octaves, a sub boom, into a 2.3 s hall."""
    r = rng(801)
    d = 3.2
    t = tt(d)
    n = len(t)
    brass = np.zeros(n)
    for f, a in [(65.41, 1.0), (98.0, 0.8), (130.81, 0.9), (155.56, 0.6), (196.0, 0.45)]:
        for c in (-7, 0, 6):
            fr = f * 2 ** (c / 1200) * (1 - 0.015 * np.exp(-t / 0.04))
            brass += a * saw(fr, phase0=r.random())
    cutoff = 450 + 2600 * np.exp(-t / 0.28) * att(t, 0.025) + 500 * np.exp(-t / 1.5)
    brass = svf(brass, cutoff, q=0.9, mode="lp")
    benv = att(t, 0.03) * (1 + 0.35 * np.exp(-t / 0.09)) * np.exp(-t / 1.3) * (1 - att(t - 1.6, 0.6))
    brass = brass * benv
    timp = np.zeros(n)
    f0 = 65.41 * (1 + 0.025 * np.exp(-t / 0.05))
    for ratio, a, tau in [(1.0, 1.0, 0.9), (1.504, 0.55, 0.6), (1.742, 0.25, 0.45), (2.0, 0.35, 0.5), (2.245, 0.15, 0.35), (2.494, 0.12, 0.3)]:
        timp += a * np.sin(2 * np.pi * np.cumsum(f0 * ratio) / SR) * np.exp(-t / tau)
    timp *= att(t, 0.003)
    timp += lp(r.standard_normal(n), 500) * np.exp(-t / 0.016) * 0.8
    piano = np.zeros(n)
    for f, a in [(32.70, 0.9), (65.41, 1.0), (98.0, 0.5), (130.81, 0.6)]:
        for k in range(1, 60):
            fk = k * f * np.sqrt(1 + 0.00025 * k * k)
            if fk > 5000:
                break
            piano += a * (k ** -0.75) * np.exp(-(fk / 2500) ** 2) * np.sin(2 * np.pi * fk * t) * np.exp(-t / (2.6 / (1 + fk / 450)))
    piano *= att(t, 0.002)
    piano += bp(r.standard_normal(n), 150, 2500) * np.exp(-t / 0.008) * 0.6
    fb = 42 + 30 * np.exp(-t / 0.05)
    boom = np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / 0.3) * att(t, 0.003)
    y = (0.75 * brass / rms(brass[:n_(0.8)]) + 0.55 * timp / rms(timp[:n_(0.8)]) +
         0.45 * piano / rms(piano[:n_(0.8)]) + 0.5 * boom / rms(boom[:n_(0.5)]))
    y *= 1 - att(t - (d - 0.5), 0.5)
    out = place(y, 0, "hall", -7)
    return out


