"""Synthesize the 40 s soundtrack (music + sound design) -> $SCRATCH/build/audio.wav

Everything is generated with numpy/scipy. Timeline (see BRIEF.md): 120 BPM, bar downbeats on odd seconds so the
cap pop (9.0 s), the ice plunk (25.0 s), the hero shot (29.0 s) and the end card (35.0 s) all land on a downbeat.
"""
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d

SR = 48000
DUR = 40.0
N = int(SR * DUR)
BEAT = 0.5
SCRATCH = os.environ.get(
    "COKE_SCRATCH",
    "/tmp/claude-0/-home-user-my-first-website-/0735c37f-ff6b-57d4-b08a-d20fb3844685/scratchpad")
OUT = os.path.join(SCRATCH, "build", "audio.wav")
rng = np.random.default_rng(2024)


# ---------------------------------------------------------------- helpers
def track():
    return np.zeros((2, N))


def place(buf, x, t, gain=1.0, pan=0.0):
    """Add mono or stereo signal x into stereo buf at time t (s), equal-power pan in [-1, 1]."""
    i = int(round(t * SR))
    if i >= N:
        return
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.vstack([x * np.cos(a), x * np.sin(a)]) * np.sqrt(2)
    j0 = max(i, 0)
    x = x[:, j0 - i:]
    n = min(x.shape[1], N - j0)
    buf[:, j0:j0 + n] += gain * x[:, :n]


def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, sustain_len=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n) if sustain_len is None else int(sustain_len * SR)
    e = np.concatenate([np.linspace(0, 1, max(a_n, 1)) ** 1.5, np.linspace(1, s, max(d_n, 1)),
                        np.full(s_n, s), np.linspace(s, 0, max(r_n, 1)) ** 1.3])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def exp_env(n, tau, a=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    an = max(int(a * SR), 1)
    e[:an] *= np.linspace(0, 1, an)
    return e


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def polyblep_saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    # PolyBLEP correction around the discontinuity
    m1 = ph < dt
    t1 = ph[m1] / dt[m1]
    y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt
    t2 = (ph[m2] - 1) / dt[m2]
    y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=-1)


def svf_lowpass_sweep(x, fc, q=0.9):
    """Time-varying state-variable low-pass (fc array per sample)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    ic1 = ic2 = 0.0
    y = np.empty_like(x)
    for i in range(len(x)):
        gi = g[i]
        a1 = 1 / (1 + gi * (gi + k))
        v3 = x[i] - ic2
        v1 = a1 * ic1 + gi * a1 * v3
        v2 = ic2 + gi * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v2
    return y


def reverb_ir(rt60=1.8, length=2.6, predelay=0.012, bright=6500, seed=1):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.91 * t / rt60)
    ir = np.zeros((2, n + int(predelay * SR)))
    for c in range(2):
        noise = r.normal(0, 1, n) * decay
        noise = lp(noise, bright)
        # early reflections
        for k in range(8):
            d = int(r.uniform(0.003, 0.045) * SR)
            noise[d] += r.uniform(0.3, 0.8) * (1 if r.uniform() > 0.5 else -1)
        ir[c, int(predelay * SR):] = noise
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


def convolve_st(x, ir):
    out = np.zeros((2, x.shape[1] + ir.shape[1] - 1))
    for c in range(2):
        out[c] = signal.fftconvolve(x[c], ir[c])
    return out[:, :N]


def saturate(x, drive=1.5):
    return np.tanh(drive * x) / np.tanh(drive)


# ---------------------------------------------------------------- instruments
def pad_note(f, dur, detune=0.14, voices=7, bright=1.0):
    n = int((dur + 1.2) * SR)
    y = np.zeros(n)
    for v in range(voices):
        cents = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune * 100
        y += polyblep_saw(f * 2 ** (cents / 1200), n, rng.uniform())
    y /= voices
    e = env_adsr(n, a=0.35, d=0.4, s=0.8, r=1.1, sustain_len=max(0.0, dur - 0.75))
    y = lp(y * e, 900 + 1800 * bright, order=2)
    return y


def pluck(f, dur=0.6, bright=1.0):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 2.0 * t) * 1.3 * np.exp(-t / 0.05) * bright
    y = np.sin(2 * np.pi * f * t + mod) * 0.8 + 0.2 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08)
    y *= exp_env(n, 0.28, a=0.002)
    # felt/hammer thump
    y += 0.15 * np.sin(2 * np.pi * f * 0.5 * t) * exp_env(n, 0.04)
    return y


def lead(f, dur):
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.3, 0, 1)
    y = 0.6 * polyblep_saw(f * vib, n) + 0.4 * np.sin(2 * np.pi * f * t)
    y = lp(y, 3200)
    return y * env_adsr(n, a=0.012, d=0.15, s=0.6, r=0.25, sustain_len=max(0.0, dur - 0.16))


def bass_note(f, dur):
    n = int((dur + 0.1) * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    y = saturate(y * env_adsr(n, a=0.006, d=0.12, s=0.75, r=0.08, sustain_len=max(0.0, dur - 0.13)), 1.8)
    return y


def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 44 + 120 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(n, 0.22, a=0.0008)
    click = hp(rng.normal(0, 1, n), 3000) * exp_env(n, 0.003) * 0.35
    return saturate(y + click, 1.4)


def clap():
    n = int(0.45 * SR)
    y = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022, 0.034)):
        i = int(d * SR)
        m = n - i
        y[i:] += bp(rng.normal(0, 1, m), 900, 5200) * exp_env(m, 0.012 if k < 3 else 0.14) * (0.7 if k < 3 else 1)
    return y


def hat(open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    y = hp(rng.normal(0, 1, n), 7000, order=4) * exp_env(n, 0.09 if open_ else 0.018, a=0.0005)
    return y


def riser(dur, f0=200, f1=2400):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.normal(0, 1, n)
    y = svf_lowpass_sweep(noise, f0 + (f1 * 3 - f0) * t ** 2.2, q=1.4) * t ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** t) / SR) * t ** 3 * 0.25
    return y * 0.6 + tone


def boom(f0=60, tau=1.2):
    n = int(3 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.8 * np.exp(-t / 0.08))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_env(n, tau, a=0.003)


# ---------------------------------------------------------------- sound design
def bubble_pop(f, tau, rise=0.15):
    n = int(tau * 6 * SR)
    t = np.arange(n) / SR
    ff = f * (1 + rise * t / (tau * 6))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * exp_env(n, tau, a=0.0003)


def fizz(buf, t0, t1, rate_fn, gain=1.0, fmin=2200, fmax=9000):
    """Poisson field of tiny Minnaert bubble pops."""
    t = t0
    while t < t1:
        r = max(rate_fn(t), 1.0)
        t += rng.exponential(1.0 / r)
        f = np.exp(rng.uniform(np.log(fmin), np.log(fmax)))
        x = bubble_pop(f, rng.uniform(0.0015, 0.006), rise=rng.uniform(0.05, 0.3))
        place(buf, x, t, gain * rng.uniform(0.2, 1.0) * 0.06, pan=rng.uniform(-0.8, 0.8))


def ice_clink(f0=None):
    f0 = f0 or rng.uniform(1800, 3600)
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 0.07), (2.32, 0.6, 0.045), (3.87, 0.4, 0.03), (5.1, 0.25, 0.02),
                            (7.3, 0.15, 0.012)):
        y += amp * np.sin(2 * np.pi * f0 * ratio * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    y += hp(rng.normal(0, 1, n), 4000) * exp_env(n, 0.002) * 0.5
    return y * exp_env(n, 1.0, a=0.0004)


def glass_ting():
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    f0 = 2637.0  # E7
    y = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 1.4), (2.76, 0.45, 0.7), (5.40, 0.25, 0.35), (8.93, 0.12, 0.18),
                            (0.5, 0.08, 0.9)):
        beat = 1 + 0.0009 * np.sin(2 * np.pi * 3.1 * t)
        y += amp * np.sin(2 * np.pi * f0 * ratio * beat * t) * np.exp(-t / tau)
    y += hp(rng.normal(0, 1, n), 5000) * exp_env(n, 0.0015) * 0.4
    return y * exp_env(n, 5.0, a=0.0005)


def cap_pop():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(95 + 140 * np.exp(-t / 0.01)) / SR) * exp_env(n, 0.05, a=0.0005)
    crack = bp(rng.normal(0, 1, n), 1500, 9000) * exp_env(n, 0.006, a=0.0002) * 1.6
    # pressurised CO2 release: bright hiss swelling fast and decaying, with turbulence
    turb = 1 + 0.35 * lp(rng.normal(0, 1, n), 30) * 8
    hiss = bp(rng.normal(0, 1, n), 2500, 11000, order=3) * turb
    henv = np.clip(t / 0.012, 0, 1) * (0.75 * np.exp(-t / 0.18) + 0.25 * np.exp(-t / 0.7))
    tick = np.zeros(n)
    for f in (4100, 5600, 7300):
        tick += np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) * 0.2
    return thump * 0.9 + crack + hiss * henv * 0.55 + tick


def pour(dur=7.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = lp(rng.normal(0, 1, n), 1600, order=3)
    body = bp(body, 180, 1600)
    gurgle = 1 + 0.6 * lp(rng.normal(0, 1, n), 9) * 12
    stream = bp(rng.normal(0, 1, n), 2500, 7000) * 0.12
    fill = t / dur  # the resonance rises as the glass fills
    res = np.zeros(n)
    tt = 0.0
    while tt < dur:
        tt += rng.exponential(1 / 22.0)
        f = rng.uniform(260, 700) * (1 + 1.2 * min(tt / dur, 1))
        x = bubble_pop(f, rng.uniform(0.006, 0.02), rise=0.4)
        i = int(tt * SR)
        m = min(len(x), n - i)
        if m > 0:
            res[i:i + m] += x[:m] * rng.uniform(0.2, 0.7)
    e = np.clip(t / 0.25, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    y = (body * gurgle * 0.5 + stream + res * 0.35) * e
    return y * (0.8 + 0.2 * fill)


def plunk():
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    bloop = np.sin(2 * np.pi * np.cumsum(210 + 380 * (1 - np.exp(-t / 0.05))) / SR) * exp_env(n, 0.09, a=0.001)
    thump = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t / 0.02)) / SR) * exp_env(n, 0.12, a=0.001)
    splash = bp(rng.normal(0, 1, n), 700, 7000) * (np.clip(t / 0.004, 0, 1) * np.exp(-t / 0.22))
    y = bloop * 0.9 + thump * 0.8 + splash * 0.6
    # droplets pattering back down
    for k in range(40):
        d = rng.uniform(0.15, 1.1)
        x = bubble_pop(rng.uniform(900, 3500), rng.uniform(0.002, 0.007), 0.2) * rng.uniform(0.05, 0.25)
        i = int(d * SR)
        y[i:i + len(x)] += x[:n - i]
    return y


def whoosh(dur, lo=300, hi=3000):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = svf_lowpass_sweep(rng.normal(0, 1, n), lo + (hi - lo) * np.sin(np.pi * t) ** 2, q=0.8)
    return x * np.sin(np.pi * t) ** 2


# ---------------------------------------------------------------- arrangement
PROG = [  # (bass midi, pad voicing midi, arp notes)
    (38, (62, 66, 69), (69, 74, 78, 81)),  # D
    (33, (61, 64, 69), (69, 73, 76, 81)),  # A
    (35, (62, 66, 71), (71, 74, 78, 83)),  # Bm
    (31, (62, 67, 71), (67, 71, 74, 79)),  # G
]


def bar_chord(bar_start):
    """Chord index for a bar starting at time bar_start (bars start on odd seconds from 1)."""
    k = int(round((bar_start - 1) / 2)) % 4
    return PROG[k]


def build():
    music = {k: track() for k in ("pad", "pluck", "bass", "kick", "clap", "hat", "lead", "fx")}
    sfx = track()

    # ---- 0-4 s: dark ambient swell, a light-sweep whoosh
    drone = sum(pad_note(midi(m), 7.5, detune=0.08, bright=0.1) * 0.5 for m in (38, 45, 50))
    fade = np.clip(np.arange(len(drone)) / SR / 3.5, 0, 1) ** 2 * np.clip((8.6 - np.arange(len(drone)) / SR) / 1.0, 0, 1)
    place(music["pad"], drone * fade, 0.0, 0.5)
    air = lp(rng.normal(0, 1, int(5 * SR)), 900) * np.sin(np.linspace(0, np.pi, int(5 * SR))) ** 2
    place(music["fx"], air, 0.0, 0.08)
    place(sfx, whoosh(2.8, 400, 5000), 0.3, 0.12, pan=-0.5)
    place(sfx, whoosh(2.4, 500, 6000), 1.3, 0.1, pan=0.5)
    fizz(sfx, 0.8, 4.0, lambda t: 25 * (t / 4.0), gain=0.7)

    # ---- 4-8.5 s: intro, filtered plucks, soft hats from 7 s, riser
    for bar in (3.0, 5.0, 7.0):
        bass, voic, arp = bar_chord(bar)
        for i in range(8):
            tt = bar + i * 0.25
            if tt < 4.0 or tt >= 8.5:
                continue
            f = midi(arp[[0, 1, 2, 3, 2, 1, 3, 2][i]])
            b = 0.35 + 0.65 * (tt - 4.0) / 4.5
            place(music["pluck"], lp(pluck(f, 0.5, bright=b), 900 + 2600 * b), tt, 0.33, pan=0.25 * np.sin(i))
        if bar >= 5.0:
            for m in voic:
                place(music["pad"], pad_note(midi(m), 1.9, bright=0.35), max(bar, 4.0), 0.07)
    for i in range(6):
        place(music["hat"], hat(), 7.0 + i * 0.25, 0.06 + 0.02 * i, pan=0.3)
    place(music["fx"], riser(1.5, 180, 3000), 7.0, 0.35)

    # ---- the pop at 9.0: SFX + music drop
    place(sfx, cap_pop(), 9.0, 0.9)
    place(music["fx"], boom(50, 1.4), 9.0, 0.55)
    fizz(sfx, 9.15, 12.2, lambda t: 260 * np.exp(-(t - 9.15) / 1.4) + 40, gain=0.9)

    def groove(t0, t1, drums=1.0, kick_on=True, hats=1.0, pluck_g=1.0, pad_g=1.0, bass_g=1.0):
        bar = t0
        while bar < t1 - 1e-6:
            bass, voic, arp = bar_chord(bar)
            for m in voic:
                place(music["pad"], pad_note(midi(m), 1.95, bright=0.55), bar, 0.075 * pad_g)
            place(music["pad"], pad_note(midi(voic[0] + 12), 1.95, bright=0.7), bar, 0.035 * pad_g)
            # bass: root on 1, octave pickup, syncopation
            for (off, d, oc) in ((0.0, 0.45, 0), (0.75, 0.2, 12), (1.0, 0.45, 0), (1.5, 0.2, 0), (1.75, 0.2, 7)):
                place(music["bass"], bass_note(midi(bass + oc), d), bar + off, 0.42 * bass_g)
            pat = [0, 1, 2, 3, 2, 1, 3, 2]
            for i in range(8):
                f = midi(arp[pat[i]])
                place(music["pluck"], pluck(f, 0.45), bar + i * 0.25, 0.26 * pluck_g, pan=0.35 * np.sin(1.7 * i))
            for b in range(4):
                tb = bar + b * BEAT
                if kick_on:
                    place(music["kick"], kick(), tb, 0.8 * drums)
                if b in (1, 3):
                    place(music["clap"], clap(), tb, 0.38 * drums, pan=0.05)
                for h in range(2):
                    place(music["hat"], hat(open_=(h == 1 and b == 3)), tb + h * 0.25, (0.1 if h else 0.07) * hats,
                          pan=0.35)
            bar += 2.0

    groove(9.0, 19.0)
    # ---- 12-19 s: the pour
    place(sfx, pour(7.2), 11.95, 0.45)
    for tt in (12.25, 12.6, 13.3, 14.1, 15.2, 16.4, 17.5):
        place(sfx, ice_clink(), tt + rng.uniform(-0.05, 0.05), rng.uniform(0.18, 0.32), pan=rng.uniform(-0.4, 0.4))
    fizz(sfx, 12.0, 19.2, lambda t: 300 + 100 * np.sin(t), gain=0.85)

    # ---- 19-24 s: lighter section so the fizz can breathe
    groove(19.0, 25.0, drums=0.55, kick_on=False, hats=0.8, pluck_g=0.85, pad_g=1.1, bass_g=0.6)
    fizz(sfx, 19.0, 24.9, lambda t: 650 + 200 * np.sin(2 * t), gain=1.25, fmin=2600, fmax=11000)
    for tt in (20.2, 21.7, 23.1):
        place(sfx, ice_clink(rng.uniform(2200, 3200)), tt, 0.12, pan=rng.uniform(-0.5, 0.5))
    place(music["fx"], riser(1.0, 250, 3500), 24.0, 0.3)

    # ---- 25.0 plunk + back to the groove
    place(sfx, plunk(), 25.0, 0.85)
    place(sfx, ice_clink(2400), 25.03, 0.3, pan=-0.2)
    place(sfx, ice_clink(3100), 25.11, 0.2, pan=0.3)
    place(music["fx"], boom(46, 1.0), 25.0, 0.4)
    fizz(sfx, 25.1, 29.2, lambda t: 300 * np.exp(-(t - 25.1) / 1.2) + 80, gain=0.8)
    groove(25.0, 29.0)

    # ---- 29-35 s: chorus with the lead hook
    groove(29.0, 35.0, drums=1.1, pad_g=1.25)
    hook = [(0.0, 78, 0.5), (0.5, 76, 0.25), (0.75, 74, 0.5), (1.25, 76, 0.75),
            (2.0, 78, 0.5), (2.5, 81, 0.5), (3.0, 78, 0.25), (3.25, 76, 0.75),
            (4.0, 74, 0.5), (4.5, 76, 0.25), (4.75, 78, 0.5), (5.25, 81, 0.25), (5.5, 83, 0.5)]
    for off, m, d in hook:
        place(music["lead"], lead(midi(m), d), 29.0 + off, 0.13, pan=-0.1)
        place(music["lead"], lead(midi(m - 12), d), 29.0 + off, 0.05, pan=0.2)
    fizz(sfx, 29.0, 35.0, lambda t: 90, gain=0.6)
    place(music["fx"], riser(0.9, 300, 4000), 34.1, 0.22)

    # ---- 35 s: end card hit, glass ting, resolve and tail
    place(sfx, glass_ting(), 35.0, 0.5)
    place(music["fx"], boom(49, 1.8), 35.0, 0.5)
    place(music["kick"], kick(), 35.0, 0.9)
    for m in (50, 57, 62, 66, 69, 74):
        place(music["pad"], pad_note(midi(m), 3.6, bright=0.8), 35.0, 0.06)
    for i, m in enumerate((69, 74, 78, 81, 86)):
        place(music["pluck"], pluck(midi(m), 1.2), 35.0 + i * 0.125, 0.22, pan=-0.5 + 0.25 * i)
    for i, m in enumerate((81, 78, 74)):
        place(music["pluck"], pluck(midi(m), 1.0, bright=0.6), 37.0 + i * 0.5, 0.12, pan=0.3 - 0.3 * i)
    place(music["bass"], bass_note(midi(38), 3.0), 35.0, 0.4)
    fizz(sfx, 35.0, 39.8, lambda t: 70 * np.exp(-(t - 35) / 2.0) + 10, gain=0.5)
    return music, sfx


def sidechain(n_kicks_times, depth=0.45, release=0.18):
    g = np.ones(N)
    t = np.arange(N) / SR
    for tk in n_kicks_times:
        i = int(tk * SR)
        m = min(int(0.5 * SR), N - i)
        if m <= 0:
            continue
        seg = 1 - depth * np.exp(-t[:m] / release)
        g[i:i + m] = np.minimum(g[i:i + m], seg)
    return g


def k_weight(x):
    # ITU-R BS.1770 K-weighting for 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = []
    for i in range(0, x.shape[1] - blk, hop):
        ms.append((y[:, i:i + blk] ** 2).mean(axis=1).sum())
    ms = np.array(ms)
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    ms = ms[l > -70]
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    ms2 = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return -0.691 + 10 * np.log10(ms2.mean())


def limiter(x, ceiling_db=-1.2, look=0.004, release=0.08):
    ceil = 10 ** (ceiling_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=-1)
    peak = np.abs(up).max(axis=0).reshape(-1, 4).max(axis=1)[:x.shape[1]]
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(look * SR)
    # minimum over the look-ahead window so gain reduction starts before each peak
    need = minimum_filter1d(need, size=2 * la + 1, origin=0)
    a = np.exp(-1 / (release * SR))
    g = signal.lfilter([1 - a], [1, -a], need)
    g = np.minimum(g, need)
    return x * g[None, :]


def main():
    music, sfx = build()
    kicks = [t for t in np.arange(9.0, 19.0, 0.5)] + [t for t in np.arange(25.0, 35.0, 0.5)] + [35.0]
    sc = sidechain(kicks)
    ir = reverb_ir(1.9, 2.8, bright=7000)
    ir_s = reverb_ir(0.9, 1.4, predelay=0.006, bright=9000, seed=7)
    mix = track()
    sends = track()
    levels = {"pad": 1.0, "pluck": 1.0, "bass": 0.9, "kick": 0.9, "clap": 0.8, "hat": 0.55, "lead": 1.0, "fx": 1.0}
    rev = {"pad": 0.5, "pluck": 0.35, "bass": 0.0, "kick": 0.03, "clap": 0.35, "hat": 0.15, "lead": 0.35, "fx": 0.4}
    for k, x in music.items():
        x = x * levels[k]
        if k in ("pad", "bass", "pluck", "lead"):
            x = x * sc[None, :] if k != "lead" else x * (0.5 + 0.5 * sc[None, :])
        if k == "bass":
            x = lp(x, 900)
        if k == "hat":
            x = hp(x, 6000)
        mix += x
        sends += x * rev[k]
    mix += convolve_st(sends, ir) * 0.35
    sfx_wet = convolve_st(sfx, ir_s) * 0.18
    mix = mix * 0.8 + sfx + sfx_wet
    # gentle master EQ: low cut, a touch of air
    mix = hp(mix, 28)
    mix = mix + 0.12 * hp(mix, 9000)
    # fade out 39.0 -> 40.0 and a tiny fade-in
    t = np.arange(N) / SR
    mix *= np.clip((40.0 - t) / 1.0, 0, 1) ** 1.5 * np.clip(t / 0.02, 0, 1)
    mix -= mix.mean(axis=1, keepdims=True)
    # loudness normalise then limit
    for _ in range(3):
        L = lufs(mix)
        mix *= 10 ** ((-14.0 - L) / 20)
        mix = limiter(mix, -1.2)
    print(f"integrated loudness {lufs(mix):.2f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.2f} dBFS")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    wavfile.write(OUT, SR, (np.clip(mix.T, -1, 1) * 32767).astype(np.int16))
    print("wrote", OUT, mix.shape[1], "samples")


if __name__ == "__main__":
    main()
