"""Procedural SFX + music bed, mixed and ducked under the voiceover. 100% code, no samples.

usage: python audio.py out.wav
"""
import sys
import subprocess

import numpy as np
from scipy import signal

from engine import ROOT
from timing import DURATION, word_time as wt
import cues as Q

SR = 48000
N = int(round(DURATION * SR))
RNG = np.random.default_rng(1234)


# ----------------------------------------------------------------------------
# dsp helpers
# ----------------------------------------------------------------------------

def tt(dur):
    return np.arange(int(dur * SR)) / SR


def noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(sos("lowpass", f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(sos("highpass", f, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos("bandpass", [lo, hi], order), x)


def peak(x, f, q=8.0):
    b, a = signal.iirpeak(f, q, fs=SR)
    return signal.lfilter(b, a, x)


def adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, sustain_len=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    env = np.zeros(n)
    i = 0
    env[:min(a_n, n)] = np.linspace(0, 1, a_n)[:n]
    i = a_n
    if i < n:
        k = min(d_n, n - i)
        env[i:i + k] = np.linspace(1, s, d_n)[:k]
        i += k
    if i < n:
        sl = n - i - r_n if sustain_len is None else int(sustain_len * SR)
        sl = max(0, min(sl, n - i))
        env[i:i + sl] = s
        i += sl
    if i < n:
        k = n - i
        env[i:] = np.linspace(s, 0, max(k, 1))[:k]
    return env


def expdec(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def addm(*sigs):
    """Sum mono signals of different lengths (zero-padded)."""
    n = max(len(x) for x in sigs)
    out = np.zeros(n)
    for x in sigs:
        out[: len(x)] += x
    return out


def norm(x, peak_=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak_


def stereo_bus():
    return np.zeros((2, N))


def place(bus, sig, t0, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    s0 = 0
    if i0 < 0:
        s0 = -i0
        i0 = 0
    n = min(sig.shape[1] - s0, N - i0)
    if n > 0:
        bus[:, i0:i0 + n] += sig[:, s0:s0 + n] * gain


def reverb(x, secs=2.0, damp=3000.0, seed=5, predelay=0.02):
    n = int(secs * SR)
    ir = []
    for ch in range(2):
        nz = noise(n, seed + ch) * expdec(n, secs / 6.0)
        nz = lp(nz, damp)
        nz[: int(predelay * SR)] = 0
        ir.append(nz / np.sqrt(np.sum(nz ** 2)))
    if x.ndim == 1:
        x = np.stack([x, x])
    out = np.stack([signal.fftconvolve(x[c], ir[c])[: x.shape[1] + n] for c in range(2)])
    return out


def with_tail(sig, secs):
    return np.concatenate([sig, np.zeros(int(secs * SR))])


def wet(sig, secs=2.0, mix=0.4, damp=3000.0, seed=5):
    dry = np.stack([sig, sig]) if sig.ndim == 1 else sig
    rv = reverb(dry.mean(0), secs, damp, seed)
    out = np.zeros_like(rv)
    out[:, : dry.shape[1]] += dry * (1 - mix)
    out += rv * mix * 3.0
    return out


# ----------------------------------------------------------------------------
# instruments / sfx
# ----------------------------------------------------------------------------

def saw(f, t, phase=0.0):
    ph = np.cumsum(np.broadcast_to(f, t.shape)) / SR + phase
    return 2 * (ph % 1.0) - 1


def creak(dur=0.32, f0=170.0, f1=95.0, seed=0, bright=1.0):
    """Stick-slip metal creak: irregular impulse train exciting metal resonances."""
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    t = np.arange(n) / SR
    f = np.geomspace(f0, f1, n) * (1 + 0.25 * signal.sosfilt(sos("lowpass", 25), r.standard_normal(n)) * 4)
    ph = np.cumsum(f) / SR
    exc = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    exc[idx] = r.uniform(0.4, 1.0, len(idx))
    out = np.zeros(n)
    for fr, q, g in ((820, 18, 1.0), (1530, 22, 0.8), (2480, 25, 0.6 * bright), (3650, 30, 0.4 * bright)):
        out += peak(exc, fr * r.uniform(0.95, 1.05), q) * g
    out += bp(exc, 300, 900) * 0.6
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return norm(out * env)


def breath(dur=0.45, kind="out", seed=0, pitch=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = noise(n, seed)
    if kind == "out":
        env = adsr(n, 0.03, dur * 0.3, 0.55, dur * 0.5)
        sig = bp(nz, 500 * pitch, 2400 * pitch) + 0.5 * peak(nz, 1100 * pitch, 3)
    else:
        env = adsr(n, dur * 0.6, 0.05, 0.6, dur * 0.3)
        sig = bp(nz, 900 * pitch, 3800 * pitch)
    return norm(sig * env)


def grunt(dur=0.28, f=105.0, seed=0, vowel="u"):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    fv = f * (1 + 0.04 * np.sin(2 * np.pi * 6 * t)) * np.linspace(1.05, 0.92, n)
    src = saw(fv, t) + 0.3 * noise(n, seed)
    F = {"u": (320, 800, 2400), "a": (720, 1200, 2600), "o": (480, 900, 2500)}[vowel]
    out = sum(peak(src, fr, 6) * g for fr, g in zip(F, (1.0, 0.6, 0.25)))
    out += 0.4 * bp(noise(n, seed + 1), 400, 1600)
    env = adsr(n, 0.015, 0.08, 0.7, 0.1)
    return norm(lp(out, 3000) * env)


def clank(f=520.0, dur=1.2, seed=0, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    r = np.random.default_rng(seed)
    for ratio, g, tau in ((1.0, 1.0, 0.5), (2.32, 0.7, 0.35), (4.25, 0.5 * bright, 0.22), (6.63, 0.35 * bright, 0.15),
                          (9.1, 0.2 * bright, 0.1)):
        ff = f * ratio * r.uniform(0.98, 1.02)
        out += np.sin(2 * np.pi * ff * t + r.uniform(0, 6)) * g * expdec(n, tau)
    tr = bp(noise(n, seed), 2000, 9000) * expdec(n, 0.012)
    return norm(out + tr * 1.2)


def thud(dur=0.35, f=60.0, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 1.5 * np.exp(-t / 0.02))
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * expdec(n, dur / 4)
    click = lp(noise(n, seed), 1800) * expdec(n, 0.01)
    return norm(body + 0.5 * click)


def heartbeat(seed=0):
    a = thud(0.22, 52, seed)
    b = thud(0.22, 46, seed + 1) * 0.75
    out = np.zeros(int(0.5 * SR))
    out[: len(a)] += a
    k = int(0.17 * SR)
    out[k:k + len(b)] += b
    return lp(out, 160)


def fart(dur=1.45, seed=3):
    """Long, deep cartoon fart: jittery flap pulse train through a meaty resonant body."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    jit = signal.sosfilt(sos("lowpass", 12), r.standard_normal(n)) * 30
    f0 = 96 - 40 * (t / dur) ** 1.3 + 9 * np.sin(2 * np.pi * 2.7 * t) + jit * 10
    f0 = np.clip(f0, 38, 140)
    ph = np.cumsum(f0) / SR
    fr = ph % 1.0
    exc = (1 - fr) ** 7 - 0.12
    # sputter / flutter amplitude
    am = 0.65 + 0.35 * np.sin(2 * np.pi * (6 + 4 * t / dur) * t + 1.0)
    gate = signal.sosfilt(sos("lowpass", 20), (r.random(n) > 0.06).astype(float))
    am *= np.clip(gate, 0, 1)
    tail = t > dur * 0.8
    am[tail] *= (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14 * t[tail])))  # final sputters
    env = adsr(n, 0.02, 0.1, 0.9, 0.18)
    src = exc * am * env
    body = lp(src, 900, 2) + 0.9 * peak(src, 210, 4) + 0.5 * peak(src, 430, 5) + 0.2 * peak(src, 1150, 6)
    wetn = bp(noise(n, seed + 7), 120, 700) * am * env * 0.25
    return norm(lp(body + wetn, 750, 4))


def whoosh(dur=0.6, f_lo=300, f_hi=4000, seed=0, rise=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = noise(n, seed)
    # time-varying bandpass via short blocks
    out = np.zeros(n)
    blocks = 24
    for i in range(blocks):
        a, b = i * n // blocks, (i + 1) * n // blocks
        u = i / (blocks - 1)
        u = u if rise else 1 - u
        fc = f_lo * (f_hi / f_lo) ** u
        seg = bp(nz[max(0, a - 2000):b], fc * 0.6, min(fc * 1.6, SR / 2 - 100))
        out[a:b] = seg[-(b - a):]
    env = np.sin(np.pi * t / dur) ** 1.5
    return norm(out * env)


def boom(dur=1.6, f0=55.0, f1=28.0, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, dur / 3.5)
    s += lp(noise(n, seed), 220) * expdec(n, dur / 4) * 0.8
    return norm(s)


def thunder(dur=3.0, seed=11):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    crack = hp(noise(n, seed), 1500) * expdec(n, 0.05)
    rumble = lp(noise(n, seed + 1), 260, 4)
    crackle = np.zeros(n)
    for k in range(40):
        i = int(r.uniform(0, 0.8) * dur * SR * (r.random() ** 1.5))
        crackle[i:i + 400] += r.uniform(0.3, 1) * noise(400, k) * expdec(400, 0.003)
    am = 0.6 + 0.4 * np.abs(signal.sosfilt(sos("lowpass", 6), r.standard_normal(n))) * 3
    env = expdec(n, dur / 3.2) * (1 - np.exp(-t / 0.03))
    return norm(crack * 0.8 + rumble * am * env * 2.2 + lp(crackle, 3000) * env)


def clap_hit(seed=0):
    n = int(0.25 * SR)
    nz = noise(n, seed)
    s = np.zeros(n)
    for k, d in enumerate((0, 0.006, 0.013)):
        i = int(d * SR)
        s[i:] += bp(nz[: n - i], 900, 5500) * expdec(n - i, 0.012 if k < 2 else 0.05)
    return norm(s)


def tink(f=3200.0, seed=0):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * m * t) * g * expdec(n, 0.08 / m) for m, g in ((1, 1), (1.5, 0.5), (2.7, 0.3)))
    return norm(s + bp(noise(n, seed), 4000, 10000) * expdec(n, 0.004))


def footstep(seed=0, squeak=False):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    s = lp(noise(n, seed), 900) * expdec(n, 0.02) + 0.5 * np.sin(2 * np.pi * 90 * t) * expdec(n, 0.03)
    if squeak:
        f = 2200 + 600 * np.sin(np.pi * t / 0.12)
        s += 0.3 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12)
    return norm(s)


def sniff(dur=0.42, seed=0):
    n = int(dur * SR)
    out = np.zeros(n)
    for k, (a, b) in enumerate(((0.0, 0.12), (0.14, 0.42))):
        i, j = int(a * SR), int(b * SR)
        m = j - i
        nz = noise(m, seed + k)
        out[i:j] += bp(nz, 1800, 6000) * adsr(m, m / SR * 0.7, 0.02, 0.6, m / SR * 0.25)
    return norm(out)


def bell(f, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * m * t) * g * expdec(n, dur / (1.5 + m)) for m, g in
            ((1, 1), (2.0, 0.45), (2.76, 0.35), (5.4, 0.2), (8.93, 0.1)))
    return norm(s * (1 - np.exp(-t / 0.002)))


def scratch(dur=0.32, seed=0):
    """Vinyl scratch: a buzzy chord read back with a back-and-forth rate curve."""
    src_t = tt(1.5)
    src = sum(saw(f, src_t) for f in (220, 277, 330, 440)) + 0.5 * noise(len(src_t), seed)
    src = bp(src, 200, 5000)
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 2.8 * np.sin(2 * np.pi * (1 / dur) * 1.5 * t) + 0.3
    pos = 0.4 * SR + np.cumsum(rate)
    pos = np.clip(pos, 0, len(src) - 2)
    out = np.interp(pos, np.arange(len(src)), src) * (0.3 + 0.7 * np.abs(rate) / 3)
    out *= adsr(n, 0.005, 0.02, 1.0, 0.04)
    return norm(out)


def chant_hit(t0, bus, gain, seed, word="GAS"):
    """One crowd shout of 'GAS!' : many detuned voices with vowel formants + sibilant."""
    r = np.random.default_rng(seed)
    dur = 0.42
    n = int(dur * SR)
    t = np.arange(n) / SR
    mixv = np.zeros(n)
    for v in range(18):
        f = r.uniform(105, 240)
        d = int(r.uniform(0, 0.035) * SR)
        fv = f * (1 + 0.03 * np.sin(2 * np.pi * 5.5 * t + v)) * np.linspace(1.08, 0.95, n)
        s = saw(fv, t) * adsr(n, 0.02, 0.05, 0.85, 0.08, sustain_len=0.14)
        mixv[d:] += s[: n - d] * r.uniform(0.5, 1)
    vow = peak(mixv, 760, 5) + 0.7 * peak(mixv, 1250, 6) + 0.3 * peak(mixv, 2600, 7)
    g_burst = lp(noise(n, seed), 700) * expdec(n, 0.015) * 0.6
    sib = np.zeros(n)
    i = int(0.24 * SR)
    m = n - i
    sib[i:] = bp(noise(m, seed + 3), 4500, 10000) * adsr(m, 0.02, 0.04, 0.6, 0.1)
    out = norm(vow + g_burst) + 0.35 * norm(sib)
    place(bus, wet(out, 1.4, 0.35, 5000, seed), t0 - 0.02, gain)


# ----------------------------------------------------------------------------
# music beds
# ----------------------------------------------------------------------------

def note(f):
    return 440.0 * 2 ** ((f - 69) / 12.0)


def pad(chords, t0s, t_end, cutoff=1400, detune=0.006, seed=0):
    """Detuned saw pad, chords = list of midi note lists."""
    n = int((t_end - t0s[0]) * SR)
    out = np.zeros((2, n))
    for ci, (ch, ts) in enumerate(zip(chords, t0s)):
        te = t0s[ci + 1] if ci + 1 < len(t0s) else t_end
        m = int((te - ts) * SR) + int(0.4 * SR)
        t = np.arange(m) / SR
        s = np.zeros((2, m))
        for k, mi in enumerate(ch):
            f = note(mi)
            for c, dt in enumerate((-detune, detune)):
                s[c] += saw(f * (1 + dt), t, phase=k * 0.13 + c * 0.4) + 0.5 * saw(f * (1 - dt * 0.5), t, phase=0.7)
        env = adsr(m, 0.35, 0.3, 0.8, 0.4)
        lfo = 1 + 0.25 * np.sin(2 * np.pi * 0.35 * t)
        for c in range(2):
            s[c] = lp(s[c] * env, cutoff) * lfo
        i0 = int((ts - t0s[0]) * SR)
        k = min(m, n - i0)
        out[:, i0:i0 + k] += s[:, :k]
    return out / (np.max(np.abs(out)) + 1e-9)


def sub_pulse(times, freqs, dur=0.5):
    out = np.zeros(N)
    for t0, f in zip(times, freqs):
        n = int(dur * SR)
        t = np.arange(n) / SR
        s = np.sin(2 * np.pi * f * t) * expdec(n, 0.18) * (1 - np.exp(-t / 0.01))
        i = int(t0 * SR)
        k = min(n, N - i)
        if k > 0:
            out[i:i + k] += s[:k]
    return out


# ----------------------------------------------------------------------------
# build the mix
# ----------------------------------------------------------------------------

def voice_track():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "assets" / "audio" / "voiceover.mp3"), "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    v = np.frombuffer(raw, np.float32).astype(np.float64)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    # gentle clean-up: high-pass rumble, presence lift, light compression
    out = hp(out, 70)
    out = out + 0.25 * peak(out, 3000, 1.2)
    env = np.abs(signal.hilbert(lp(np.abs(out), 30)))
    rms_ref = np.percentile(env, 95)
    g = np.where(env > rms_ref * 0.5, (rms_ref * 0.5 / (env + 1e-9)) ** 0.35, 1.0)
    g = lp(g, 20)
    return out * g


def duck_curve(v):
    e = np.abs(v)
    e = lp(e, 12)
    e = e / (np.percentile(e, 98) + 1e-9)
    e = np.clip(e * 1.6, 0, 1)
    # attack fast / release slow
    out = np.zeros_like(e)
    a, r = np.exp(-1 / (0.012 * SR)), np.exp(-1 / (0.28 * SR))
    y = 0.0
    step = 48
    for i in range(0, len(e), step):
        x = e[i]
        y = a * y + (1 - a) * x if x > y else r * y + (1 - r) * x
        out[i:i + step] = y
    return out


LAST = None


def build():
    duck = stereo_bus()    # ducked hard (music, ambience, small sfx)
    hits = stereo_bus()    # ducked lightly (big hits)
    C = Q.CUTS

    # --- 0-12.47 steamy bed: sultry pad + sub pulses on the rocking beats
    chords = [[45, 57, 60, 64, 67, 71], [41, 53, 57, 60, 64, 69], [38, 50, 53, 57, 60, 64, 69], [40, 52, 56, 59, 62, 67]]
    ct = [0.0, 3.14, 6.16, 9.04]
    p = pad(chords * 1, ct, Q.CLACK + 0.05, cutoff=1100)
    p *= adsr(p.shape[1], 0.6, 0.1, 1.0, 0.012)
    place(duck, p, 0.0, 0.30)
    roots = {0: 45, 1: 41, 2: 38, 3: 40}

    def root_at(t):
        k = max(i for i, c in enumerate(ct) if c <= t)
        return note(roots[k] - 12)
    bt = [b for b in Q.BEATS if b < Q.CLACK - 0.05]
    place(duck, np.stack([sub_pulse(bt, [root_at(b) for b in bt])] * 2), 0.0, 0.45)

    # creaks + breathing + grunts on every rep
    for i, b in enumerate(bt):
        fast = b > C["s3"]
        place(duck, creak(0.28 if fast else 0.36, 175 + 30 * (i % 3), 95, seed=i), b - 0.06, 0.26 if fast else 0.22,
              pan=-0.3 + 0.6 * (i % 2))
        place(duck, breath(0.38 if fast else 0.5, "out", seed=100 + i, pitch=1.0), b - 0.02, 0.17)
        if not fast:
            place(duck, breath(0.32, "in", seed=200 + i, pitch=1.1), b + 0.32, 0.09)
        if fast and i % 2 == 0:
            place(duck, grunt(0.24, 100 + 10 * (i % 3), seed=i, vowel="u"), b, 0.10, pan=0.2)
    # bottle rattle (scene 3c)
    for b in Q.BEATS3:
        if C["s3c"] - 0.05 < b < C["s3d"] + 0.1:
            place(duck, bp(noise(int(0.08 * SR), int(b * 100)), 1500, 6000) * expdec(int(0.08 * SR), 0.02), b, 0.3)
    # heartbeat, getting louder
    for i, hb in enumerate(Q.HEARTBEATS):
        place(hits, heartbeat(i), hb, 0.35 + 0.5 * i / len(Q.HEARTBEATS))

    # --- 12.47 CLACK: lights on, music cuts
    clack = addm(clank(1900, 0.25, 7, 1.0) * 0.6, thud(0.12, 120, 8))
    place(hits, wet(norm(clack), 0.6, 0.15), Q.CLACK, 0.8)
    place(duck, whoosh(0.7, 250, 3500, 9), Q.CLACK + 0.12, 0.35)
    # gym room tone + fluorescent hum (12.47 -> 23.48)
    rt_len = C["s8b"] - Q.CLACK
    n = int(rt_len * SR)
    t = np.arange(n) / SR
    room = lp(noise(n, 21), 380) * 0.5 + 0.15 * sum(np.sin(2 * np.pi * 120 * k * t) / k for k in (1, 2, 3))
    room *= adsr(n, 0.05, 0.1, 1.0, 0.3)
    place(duck, room, Q.CLACK, 0.12)
    # bar clank during the reveal + plates rattling on the push
    place(duck, clank(480, 1.0, 3), Q.CLACK + 0.3, 0.30, pan=-0.4)
    place(duck, clank(610, 0.8, 4), Q.CLACK + 0.85, 0.22, pan=0.4)
    for k in range(5):
        place(duck, creak(0.3, 150, 90, seed=50 + k, bright=0.6), 13.4 + k * 0.45, 0.10, pan=0.5 - 0.25 * k)
    # sparkle "ding" on the two fingers
    place(duck, addm(bell(2637, 0.8) * 0.6, bell(3520, 0.6) * 0.4), Q.PUSH_IN_FINGERS + 0.15, 0.22)

    # --- scene 5: slow-mo strain -> riser -> FART
    sm_len = C["s5c"] - C["s5"]
    n = int(sm_len * SR)
    t = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * (48 + 6 * t / sm_len) * t) + 0.6 * np.sin(2 * np.pi * (72 + 9 * t / sm_len) * t))
    drone = drone * adsr(n, 0.3, 0.1, 1.0, 0.05) * (0.5 + 0.5 * t / sm_len)
    place(duck, drone, C["s5"], 0.28)
    for i, hb in enumerate((15.85, 16.5, 17.05, 17.45, 17.75)):
        place(hits, heartbeat(20 + i), hb, 0.55)
    for k in range(6):
        place(duck, creak(0.5, 120, 70, seed=70 + k, bright=0.5), C["s5"] + 0.2 + k * 0.38, 0.14, pan=(-1) ** k * 0.4)
    place(duck, whoosh(0.75, 200, 6000, 31, rise=True), C["s5c"] - 0.72, 0.3)
    # THE FART: long, deep, huge echo through the whole gym
    f = fart(1.5, seed=3)
    echoes = with_tail(f, 4.5)
    for k, (d, g, cut) in enumerate(((0.36, 0.55, 1800), (0.72, 0.4, 1300), (1.08, 0.3, 1000), (1.5, 0.22, 800),
                                     (1.95, 0.16, 650), (2.45, 0.11, 500))):
        i = int(d * SR)
        echoes[i:i + len(f)] += lp(f, cut) * g
    place(hits, wet(f, 1.2, 0.2, 2500, seed=43), Q.BLAST, 0.9)
    echoes[: len(f)] -= f  # dry part lives on the hits bus
    fx = wet(lp(echoes, 800, 4), 2.4, 0.35, 900, seed=44)
    place(duck, fx, Q.BLAST, 0.55)
    place(hits, boom(1.4, 60, 30, 5), Q.BLAST, 0.75)
    place(hits, lp(whoosh(0.9, 80, 1200, 6, rise=False), 300), Q.BLAST + 0.02, 0.5)
    # weights jumping off racks
    for k in range(9):
        place(duck, hp(clank(380 + 70 * k, 0.6, 80 + k, bright=0.8), 2500), Q.BLAST + 0.12 + 0.05 * k, 0.16, pan=-0.8 + 0.2 * k)

    # --- scene 6: fly-through whoosh + explicit echoes
    place(duck, hp(whoosh(1.0, 200, 6000, 61), 2800), C["s6"] - 0.1, 0.3)
    for k, te in enumerate(Q.ECHOES):
        seg_ = f[int(0.2 * SR): int(0.85 * SR)]
        e = lp(seg_, 700 - 120 * k, 4) * adsr(len(seg_), 0.05, 0.1, 1, 0.2)
        place(duck, wet(e, 1.6, 0.4, 900, 70 + k), te, 0.34 * (0.75 ** k), pan=(-0.6, 0.6, 0.0)[k])

    # --- scene 7: stampede + counter ticks, trainer quits, door slam
    r = np.random.default_rng(7)
    for k, te in enumerate(Q.EXITS):
        for s_ in range(6):
            ts = te - 0.35 + s_ * 0.075 + r.uniform(-0.01, 0.01)
            place(duck, footstep(400 + k * 10 + s_, squeak=(s_ == 2 and k % 3 == 0)), ts, 0.22, pan=r.uniform(-0.7, 0.7))
        place(duck, tink(1800 + 60 * k, k) * 0.5, te, 0.18)
    place(duck, whoosh(0.5, 400, 3000, 81), Q.TRAINER_THROW - 0.08, 0.25)
    # clipboard clatter + whistle dropped (bouncing tinks)
    clip = addm(bp(noise(int(0.25 * SR), 90), 700, 3500) * expdec(int(0.25 * SR), 0.05), thud(0.2, 140, 91) * 0.6)
    place(duck, norm(clip), Q.TRAINER_THROW + 0.14, 0.45)
    for k, (d, g) in enumerate(((0.18, 1.0), (0.32, 0.6), (0.42, 0.4), (0.49, 0.25))):
        place(duck, tink(3300 - 100 * k, 95 + k), Q.TRAINER_THROW + d, 0.32 * g, pan=0.3)
    for k in range(4):
        place(duck, footstep(500 + k), C["s7c"] + 0.02 + k * 0.08, 0.3)
    slam = addm(thud(0.5, 55, 99), 0.5 * clank(240, 0.6, 98, 0.4))
    place(hits, wet(norm(lp(slam, 900)), 0.9, 0.25), Q.DOOR_SLAM, 0.9)

    # --- scene 8: sniff, dramatic pause, slow-mo high five, thunder
    place(duck, sniff(0.45, 3), Q.SNIFF - 0.02, 0.6)
    for i, hb in enumerate(Q.HEARTBEATS_PAUSE):
        place(hits, heartbeat(40 + i), hb, 0.6)
    riser_len = Q.CLAP - C["s8b"]
    rz = whoosh(riser_len, 150, 5000, 101, rise=True)
    rz *= np.linspace(0.3, 1.0, len(rz))
    place(duck, rz, C["s8b"], 0.32)
    swell = pad([[50, 57, 62, 66, 69, 74]], [0.0], riser_len + 0.05, cutoff=2400)
    swell *= np.linspace(0.0, 1.0, swell.shape[1]) ** 2
    place(duck, swell, C["s8b"], 0.22)
    place(hits, wet(clap_hit(5), 1.1, 0.3, 6000), Q.CLAP, 0.75)
    place(hits, boom(1.8, 58, 26, 7), Q.CLAP, 0.85)
    place(hits, thunder(3.0, 11), Q.CLAP + 0.03, 0.7)
    place(hits, whoosh(0.8, 100, 3000, 102, rise=False), Q.CLAP + 0.02, 0.35)

    # --- scene 9: sign letters, crowd chant "GAS! GAS!", triumphant chord
    place(hits, clank(300, 0.9, 120, 0.7), Q.T_DROP, 0.3)
    place(hits, addm(thud(0.35, 80, 121), 0.4 * clank(260, 0.8, 122, 0.5)), Q.T_DROP + 0.33, 0.6)
    lands = [Q.LETTER_LAND - 0.84, Q.LETTER_LAND - 0.62, Q.LETTER_LAND - 0.42, Q.LETTER_LAND - 0.2, Q.LETTER_LAND]
    for k, tl in enumerate(lands):
        place(duck, whoosh(0.5, 400, 2400, 130 + k), tl - 0.5, 0.12, pan=-0.5 + 0.25 * k)
        place(duck, addm(thud(0.25, 110, 140 + k), 0.2 * clank(700 + 40 * k, 0.3, 150 + k, 0.4)), tl, 0.35)
    place(duck, wet(addm(bell(1046, 1.2), bell(1568, 1.0)), 1.5, 0.3), wt("GYM", 3) + 0.22, 0.2)
    for k in range(6):
        chant_hit(26.72 + k * 0.5, duck, 0.26, 900 + k)
    # crowd cheer bed
    n = int((C["end"] - C["s9"]) * SR)
    t = np.arange(n) / SR
    cheer = bp(noise(n, 77), 500, 3200) * (0.6 + 0.4 * np.abs(signal.sosfilt(sos("lowpass", 4), noise(n, 78))) * 3)
    cheer *= adsr(n, 0.4, 0.1, 1.0, 0.2)
    place(duck, cheer, C["s9"], 0.10)
    tri = pad([[48, 55, 60, 64, 67, 72], [53, 57, 60, 65, 69, 72], [55, 59, 62, 67, 71, 74]],
              [0.0, 1.2, 2.0], C["s10"] - C["s9"] + 0.02, cutoff=2600)
    tri *= adsr(tri.shape[1], 0.5, 0.2, 1.0, 0.03)
    place(duck, tri, C["s9"], 0.22)
    # night ambience
    place(duck, lp(noise(n, 81), 600) * 0.3, C["s9"], 0.08)

    # --- scene 10: record scratch -> GENIUS chime
    place(hits, scratch(0.32, 5), Q.SCRATCH - 0.04, 0.6)
    for k, fq in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        place(duck, wet(bell(fq, 1.4), 1.4, 0.3, 8000, 160 + k), Q.GENIUS + 0.14 + k * 0.065, 0.26)
    r = np.random.default_rng(9)
    for k in range(10):
        place(duck, bell(r.uniform(3000, 6000), 0.4) * 0.4, Q.GENIUS + 0.2 + k * 0.05, 0.08, pan=r.uniform(-0.8, 0.8))
    fin = pad([[48, 55, 60, 64, 67, 72, 76]], [0.0], C["end"] - C["s10"], cutoff=3000)
    fin *= adsr(fin.shape[1], 0.15, 0.2, 0.9, 0.2)
    place(duck, fin, C["s10"], 0.2)

    # --- mix
    v = voice_track()
    v = v / (np.max(np.abs(v)) + 1e-9) * 0.82
    dc = duck_curve(v)
    duck *= (1 - 0.62 * dc)[None, :]
    hits *= (1 - 0.32 * dc)[None, :]
    sfx = duck + hits
    sfx = signal.sosfilt(sos("highpass", 30), sfx, axis=1)
    global LAST
    LAST = (v, sfx * 0.55)
    mix = np.stack([v, v]) + sfx * 0.55
    # soft limiter, fade out last 15ms only (video length = voice length)
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.93
    k = int(0.015 * SR)
    mix[:, -k:] *= np.linspace(1, 0, k)[None, :]
    return mix


def write_wav(path, mix):
    from scipy.io import wavfile
    data = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
    wavfile.write(path, SR, data)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "out" / "mix.wav")
    m = build()
    write_wav(out, m)
    print("wrote", out, m.shape, m.shape[1] / SR)
