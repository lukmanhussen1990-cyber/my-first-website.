"""Sound: your voice-over + a soft ambient score and zoom whooshes, all synthesised in code."""
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

from .timeline import DUR, MARKS, SCRIPT

SR = 44100
N = int(SR * DUR)


def hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def env_ar(start, end, attack, release):
    """Slow swell: rises after `start`, falls away after `end`."""
    t = np.arange(N) / SR
    a = np.clip((t - start) / attack, 0, 1)
    r = np.clip(1.0 - (t - end) / release, 0, 1)
    e = (a * a * (3 - 2 * a)) * (r * r * (3 - 2 * r))
    return e.astype(np.float32)


# chords: (start, end, bass note, pad notes) - D major, slow and warm
CHORDS = [
    (0.0, 3.0, 38, [50, 57, 64, 66]),  # Dadd9
    (3.0, 6.0, 35, [47, 54, 57, 62]),  # Bm7
    (6.0, 9.0, 31, [55, 59, 62, 66]),  # Gmaj7
    (9.0, 12.0, 33, [57, 62, 64]),  # Asus4
    (12.0, 15.0, 35, [59, 62, 64, 69]),  # Bm11
    (15.0, 18.0, 31, [55, 59, 62, 69]),  # Gadd9
    (18.0, 21.0, 28, [52, 55, 59, 62, 66]),  # Em9
    (21.0, 25.0, 33, [57, 62, 64, 67]),  # A7sus4 (holds the tension over the atoms)
    (25.0, 30.5, 26, [50, 57, 62, 66, 69, 74]),  # D - home, wide and warm
]
# piano-like notes: (time, midi note, loudness)
MELODY = [
    (0.05, 78, 0.8), (1.5, 76, 0.6), (3.0, 74, 0.7), (4.5, 78, 0.55), (6.0, 74, 0.7), (7.5, 78, 0.6),
    (9.0, 76, 0.7), (10.5, 74, 0.55), (11.3, 73, 0.5), (12.0, 74, 0.7), (13.5, 76, 0.6), (15.0, 71, 0.7),
    (16.5, 69, 0.55), (18.0, 67, 0.7), (19.5, 71, 0.6), (21.0, 69, 0.65), (22.0, 74, 0.6), (23.0, 76, 0.65),
    (24.0, 79, 0.7), (25.0, 78, 1.0), (25.0, 74, 0.8), (25.0, 81, 0.8), (26.5, 81, 0.7), (27.25, 78, 0.65),
    (28.0, 74, 0.75), (28.0, 86, 0.5), (29.0, 78, 0.6), (29.5, 81, 0.5),
]


def pad_and_bass():
    t = np.arange(N, dtype=np.float64) / SR
    out = np.zeros((N, 2), np.float32)
    rng = np.random.default_rng(5)
    for (a, b, bass, notes) in CHORDS:
        e = env_ar(a - 0.35, b - 0.4, 1.5, 2.6)
        warm = 1.0 if a < 25 else 1.25
        for m in notes:
            f = hz(m)
            for ch, det in ((0, 0.9985), (1, 1.0017)):
                ph = rng.random() * 6.28
                x = np.zeros(N)
                for h, amp in ((1, 1.0), (2, 0.42), (3, 0.2), (4, 0.09), (5, 0.04)):
                    x += amp * np.sin(2 * np.pi * f * det * h * t + ph * h)
                lfo = 1.0 + 0.12 * np.sin(2 * np.pi * (0.13 + 0.05 * rng.random()) * t + ph)
                out[:, ch] += (x * lfo * e * 0.05 * warm).astype(np.float32)
        fb = hz(bass)
        eb = env_ar(a - 0.1, b - 0.3, 0.9, 2.0)
        bs = (np.sin(2 * np.pi * fb * t) + 0.25 * np.sin(2 * np.pi * 2 * fb * t)) * eb * 0.16
        out[:, 0] += bs.astype(np.float32)
        out[:, 1] += bs.astype(np.float32)
    return out


def piano():
    out = np.zeros((N, 2), np.float32)
    rng = np.random.default_rng(9)
    for (st, m, vel) in MELODY:
        i0 = int(st * SR)
        L = min(N - i0, int(5.0 * SR))
        if L <= 0:
            continue
        t = np.arange(L) / SR
        f = hz(m)
        x = np.zeros(L)
        for n in range(1, 8):
            fn = n * f * np.sqrt(1 + 0.0003 * n * n)
            x += (1.0 / n**1.35) * np.sin(2 * np.pi * fn * t + rng.random() * 6.28) * np.exp(-t * (n**0.85) / 2.0)
        x *= np.clip(t / 0.006, 0, 1) * vel * 0.11
        pan = 0.5 + 0.3 * (rng.random() - 0.5)
        out[i0 : i0 + L, 0] += (x * (1 - pan) * 1.4).astype(np.float32)
        out[i0 : i0 + L, 1] += (x * pan * 1.4).astype(np.float32)
    return out


def reverb(x, seconds=3.2, decay=0.85, wet=0.35, seed=1):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = x.copy()
    k = np.ones(5) / 5.0
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / decay)
        ir[: int(0.012 * SR)] = 0
        ir = np.convolve(ir, k, mode="same")
        ir /= np.sqrt((ir**2).sum())
        w = signal.fftconvolve(x[:, ch], ir)[:N]
        out[:, ch] = x[:, ch] + wet * w
    return out.astype(np.float32)


def whoosh(T, rising=True, pre=0.55, post=0.4, level=0.11, seed=0):
    """Soft air-rush centred on time T. Rising = zooming in, falling = pulling back out."""
    rng = np.random.default_rng(100 + seed)
    out = np.zeros((N, 2), np.float32)
    i0 = int((T - pre) * SR)
    L = int((pre + post) * SR)
    if i0 < 0:
        L += i0
        i0 = 0
    L = min(L, N - i0)
    noise = rng.standard_normal(L)
    lo = signal.sosfilt(signal.butter(2, [220, 800], "bandpass", fs=SR, output="sos"), noise)
    mid = signal.sosfilt(signal.butter(2, [700, 2200], "bandpass", fs=SR, output="sos"), noise)
    hi = signal.sosfilt(signal.butter(2, [1800, 6000], "bandpass", fs=SR, output="sos"), noise) * 0.6
    u = np.arange(L) / L
    if not rising:
        u = 1.0 - u
    x = lo * np.clip(1 - 2 * u, 0, 1) + mid * (1 - np.abs(2 * u - 1)) + hi * np.clip(2 * u - 1, 0, 1)
    tt = np.arange(L) / SR
    pk = pre if i0 > 0 else pre + (T - pre)
    env = np.where(tt < pk, np.clip(tt / pk, 0, 1) ** 2.4, np.clip(1 - (tt - pk) / post, 0, 1) ** 1.8)
    x = x * env * level
    pan = 0.5 + 0.35 * np.sin(np.pi * (tt / (pre + post)) - np.pi / 2) * (1 if seed % 2 else -1)
    out[i0 : i0 + L, 0] = (x * (1 - pan) * 1.4).astype(np.float32)
    out[i0 : i0 + L, 1] = (x * pan * 1.4).astype(np.float32)
    # a gentle low thump as the zoom lands
    j0 = int(T * SR)
    Lt = min(N - j0, int(0.5 * SR))
    if Lt > 0 and rising:
        t2 = np.arange(Lt) / SR
        th = np.sin(2 * np.pi * (62 - 22 * t2) * t2) * np.exp(-t2 / 0.12) * level * 0.9
        out[j0 : j0 + Lt, 0] += th.astype(np.float32)
        out[j0 : j0 + Lt, 1] += th.astype(np.float32)
    return out


def load_audio(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def voice_track(voice):
    """Place the voice-over on the timeline. Returns (mono track, list of what was placed)."""
    v = np.zeros(N, np.float32)
    used = []
    clips = []
    if voice and os.path.isfile(voice):
        clips.append((0.0, voice, "whole file"))
    elif voice and os.path.isdir(voice):
        for i, (st, text) in enumerate(SCRIPT, 1):
            for ext in ("mp3", "wav", "m4a", "ogg", "flac"):
                p = os.path.join(voice, "%d.%s" % (i, ext))
                if os.path.isfile(p):
                    clips.append((st, p, "line %d" % i))
                    break
    loaded = [(st, load_audio(p), name) for st, p, name in clips]
    peak = max([float(np.abs(x).max()) for _, x, _ in loaded] + [1e-6])
    for st, x, name in loaded:
        x = x * (0.80 / peak)  # same gain for every clip so the voice stays consistent
        i0 = int(st * SR)
        L = min(len(x), N - i0)
        v[i0 : i0 + L] += x[:L]
        used.append((name, st, len(x) / SR))
    return v, used


def build(voice, out_wav):
    v, used = voice_track(voice)
    music = reverb(pad_and_bass(), wet=0.22, seed=1) + reverb(piano(), wet=0.42, seed=2)
    fx = np.zeros((N, 2), np.float32)
    for k, T in enumerate(MARKS[:-1]):
        fx += whoosh(T, True, seed=k)
    fx += whoosh(25.0, False, pre=0.6, post=0.9, level=0.12, seed=9)
    fx = reverb(fx, seconds=1.6, decay=0.35, wet=0.25, seed=3)

    # the ending gets warmer and a little louder
    t = np.arange(N) / SR
    swell = 1.0 + 0.5 * np.clip((t - 24.8) / 1.2, 0, 1)
    fade = np.clip(t / 0.4, 0, 1) * np.clip((DUR - t) / 1.6, 0, 1) ** 1.3
    music *= (swell * fade)[:, None].astype(np.float32)

    # voice level, then sit the music about 18 dB under it while it speaks
    if used:
        act = np.abs(v) > 0.02
        v_rms = float(np.sqrt((v[act] ** 2).mean())) if act.any() else 0.15
    else:
        v_rms = 0.15
    m_rms = float(np.sqrt((music[int(3 * SR) : int(24 * SR)] ** 2).mean()))
    under_voice = v_rms * 10 ** (-18 / 20.0)
    between = v_rms * 10 ** (-9.5 / 20.0)  # the bed comes up between lines
    win = int(0.05 * SR)
    lvl = np.sqrt(signal.fftconvolve(v * v, np.ones(win) / win, mode="same").clip(0))
    talking = (lvl > 0.02).astype(np.float32)
    hold = int(0.45 * SR)
    talking = signal.fftconvolve(talking, np.ones(hold), mode="same").clip(0, 1)
    sm = int(0.30 * SR)
    talking = signal.fftconvolve(talking, np.hanning(sm) / np.hanning(sm).sum(), mode="same").clip(0, 1)
    gain = (between + (under_voice - between) * talking) / m_rms
    music *= gain[:, None].astype(np.float32)
    fx *= (v_rms / 0.15) * (1.0 - 0.45 * talking)[:, None].astype(np.float32)

    mix = music + fx
    mix[:, 0] += v
    mix[:, 1] += v
    mix = np.tanh(mix * 1.05) / np.tanh(1.05)  # soft safety limiter
    pk = float(np.abs(mix).max())
    if pk > 0.89:
        mix *= 0.89 / pk
    wavfile.write(out_wav, SR, (mix * 32767).astype(np.int16))
    for name, st, d in used:
        print("voice: %s at %.1fs (%.1fs long)" % (name, st, d))
    if len(used) < len(SCRIPT) and not (voice and os.path.isfile(voice)):
        print("voice: %d of %d script lines have a clip - the rest are music only" % (len(used), len(SCRIPT)))
    return used
