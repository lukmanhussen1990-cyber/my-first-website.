"""Background bed + sound effects, synthesised in code, and the final mix.

Music: slow warm pad (detuned additive voices, C - Am - F - G at ~70 BPM)
with sparse soft piano notes and a convolution reverb, mixed `level_db`
below the narration (LUFS to LUFS). SFX: tiny pops/whooshes/ticks placed at
the events the scene plan produced.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000


def _midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def _env(n, a, r):
    e = np.ones(n)
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def _reverb(x, seconds=2.4, wet=0.32, seed=3):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / seconds)[:, None]
    ir[:, 0] = np.convolve(ir[:, 0], np.ones(8) / 8, mode="same")  # darken
    ir[:, 1] = np.convolve(ir[:, 1], np.ones(8) / 8, mode="same")
    ir /= np.sqrt((ir ** 2).sum(0))
    from scipy.signal import fftconvolve
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return (1 - wet) * x + wet * y


def music(duration, seed=11):
    n = int(duration * SR) + SR
    out = np.zeros((n, 2))
    t_all = np.arange(n) / SR
    bar = 60 / 70 * 4  # seconds per bar
    chords = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]]  # Cmaj7 Am7 Fmaj7 G6
    rng = np.random.default_rng(seed)
    k = 0
    t = 0.0
    while t < duration:
        ch = chords[k % 4]
        a, b = int(t * SR), min(n, int((t + bar + 1.6) * SR))
        seg = t_all[a:b] - t
        env = _env(b - a, 1.1, 1.6)
        for m in ch:
            f = _midi(m)
            for det, pan in ((-0.0016, 0.25), (0.0016, 0.75)):
                ph = rng.uniform(0, 6.28)
                wave = (np.sin(2 * math.pi * f * (1 + det) * seg + ph) + 0.28 * np.sin(4 * math.pi * f * (1 + det) * seg)
                        + 0.10 * np.sin(6 * math.pi * f * (1 + det) * seg))
                amp = 0.05 * (0.75 if m < 50 else 1.0)
                out[a:b, 0] += wave * env * amp * (1 - pan)
                out[a:b, 1] += wave * env * amp * pan
        # soft piano: a few chord tones an octave up, on beats 1 and 3 (+ an occasional pick-up)
        for beat in (0, 2) + ((3.5,) if k % 2 else ()):
            m = ch[rng.integers(1, 4)] + 12
            st = t + beat * bar / 4 + rng.uniform(0, 0.03)
            a2 = int(st * SR)
            ln = int(2.2 * SR)
            if a2 >= n:
                continue
            b2 = min(n, a2 + ln)
            tt = np.arange(b2 - a2) / SR
            f = _midi(m)
            note = (np.sin(2 * math.pi * f * tt) * np.exp(-tt / 0.9) + 0.35 * np.sin(4 * math.pi * f * tt) * np.exp(-tt / 0.35)
                    + 0.12 * np.sin(6 * math.pi * f * tt) * np.exp(-tt / 0.2))
            note *= np.minimum(1, tt / 0.004) * rng.uniform(0.6, 1.0) * 0.07
            pan = rng.uniform(0.35, 0.65)
            out[a2:b2, 0] += note * (1 - pan)
            out[a2:b2, 1] += note * pan
        t += bar
        k += 1
    out = _reverb(out[: int(duration * SR)])
    # gentle swell in, fade out over the final hold
    out *= _env(len(out), 0.8, 1.2)[:, None]
    return out


# ------------------------------------------------------------------ sfx
def _noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def _bandpass(x, lo, hi):
    from scipy.signal import butter, sosfilt
    sos = butter(2, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def sfx_sample(name, seed=0):
    if name in ("pop", "soft"):
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        f = 820 * np.exp(-t / 0.05) + 380
        y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.028)
        y += 0.15 * _bandpass(_noise(n, seed), 2000, 6000) * np.exp(-t / 0.006)
        return y * (0.45 if name == "soft" else 1.0)
    if name == "whoosh":
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        x = _noise(n, seed)
        y = 0.6 * _bandpass(x, 500, 1500) + 0.4 * _bandpass(x, 1500, 4000) * (t / t[-1])
        return y * np.sin(math.pi * t / t[-1]) ** 2
    if name == "thud":
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        return (np.sin(2 * math.pi * 105 * t) * np.exp(-t / 0.06)
                + 0.3 * _bandpass(_noise(n, seed), 120, 900) * np.exp(-t / 0.03))
    if name in ("tick", "click"):
        n = int(0.04 * SR)
        t = np.arange(n) / SR
        y = _bandpass(_noise(n, seed), 1800 if name == "tick" else 900, 7000) * np.exp(-t / 0.004)
        return y * (0.6 if name == "tick" else 1.0)
    if name == "flip":
        n = int(0.09 * SR)
        t = np.arange(n) / SR
        return _bandpass(_noise(n, seed), 1200, 6000) * np.sin(math.pi * t / t[-1]) * 0.8
    if name == "ding":
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        return (np.sin(2 * math.pi * 1318.5 * t) * np.exp(-t / 0.45) + 0.4 * np.sin(2 * math.pi * 2637 * t)
                * np.exp(-t / 0.2)) * np.minimum(1, t / 0.003)
    raise ValueError(f"unknown sfx {name!r}")


def sfx_track(events, duration, sfx_db=-30.0):
    n = int(duration * SR)
    out = np.zeros(n)
    for i, e in enumerate(events):
        y = sfx_sample(e["name"], seed=i)
        y = y / (np.abs(y).max() + 1e-9) * 10 ** ((sfx_db + e.get("gain_db", 0.0)) / 20)
        a = int(max(0.0, e["t"]) * SR)
        if a >= n:
            continue
        b = min(n, a + len(y))
        out[a:b] += y[: b - a]
    return np.stack([out, out], 1)


def stage_audio(cfg, plan, build: Path):
    import pyloudnorm as pyln
    voice, sr = sf.read(build / "voice.wav", dtype="float32")
    assert sr == SR
    dur = plan.duration
    n = int(dur * SR)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    meter = pyln.Meter(SR)
    v_lufs = meter.integrated_loudness(voice)
    bed = music(dur)
    bed_lufs = meter.integrated_loudness(bed)
    level = cfg.MUSIC.get("level_db", -24.0)
    bed *= 10 ** ((v_lufs + level - bed_lufs) / 20)
    events = list(plan.sfx)
    for p in plan.props:  # the boredom clock ticks audibly, once per second
        if p.kind == "clock":
            k = 0
            while p.t_in + k < min(p.t_out, dur):
                events.append({"t": p.t_in + k, "name": "tick", "gain_db": -4})
                k += 1
    fx = sfx_track(events, dur, cfg.MUSIC.get("sfx_db", -30.0))
    mix = np.stack([voice, voice], 1) + bed + fx
    lufs = meter.integrated_loudness(mix)
    mix *= 10 ** ((cfg.VOICE.get("lufs", -16.0) - lufs) / 20)
    peak = np.abs(mix).max()
    if peak > 0.89:  # keep true peak under ~-1 dBFS
        mix = np.tanh(mix / 0.89) * 0.89
    sf.write(build / "mix.wav", mix.astype(np.float32), SR, subtype="PCM_16")
    sf.write(build / "music.wav", bed.astype(np.float32), SR, subtype="PCM_16")
    print(f"audio: voice {v_lufs:.1f} LUFS, music bed {v_lufs + level:.1f} LUFS ({level:+.0f} dB), "
          f"{len(events)} sfx, final mix {meter.integrated_loudness(mix):.1f} LUFS, peak "
          f"{20 * np.log10(np.abs(mix).max()):.1f} dBFS -> {build / 'mix.wav'}")
