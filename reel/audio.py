"""Lo-fi background loop synthesized with numpy, and the final mix with ffmpeg."""
import json
import re
import subprocess

import numpy as np

SR = 44100
BPM = 78
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # Fmaj7, Em7, Dm7, Cmaj7 (MIDI notes) with bass roots
    ([53, 57, 60, 64], 41),
    ([52, 55, 59, 62], 40),
    ([50, 53, 57, 60], 38),
    ([48, 55, 59, 64], 36),
]
# Music level under the voice before the final loudness pass (dB, applied in the mix)
MUSIC_DB = -19.0


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def _fft_filter(x, lo=None, hi=None):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(np.fft.rfft(x) * g, len(x))


def keys(f, dur, vel, rng):
    t = _t(dur)
    ph = rng.uniform(0, 6.28, 4)
    tone = sum(a * np.sin(2 * np.pi * k * f * t * (1 + 0.0007 * k) + ph[k - 1])
               for k, a in ((1, 1.0), (2, 0.3), (3, 0.09), (4, 0.035)))
    tine = 0.22 * np.sin(2 * np.pi * f * 7.02 * t) * np.exp(-t / 0.04)
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 1.4)
    rel = np.clip((dur - t) / 0.12, 0, 1)
    trem = 1 + 0.07 * np.sin(2 * np.pi * 4.3 * t)
    return vel * env * rel * trem * (tone + tine)


def bass(f, dur):
    t = _t(dur)
    env = (1 - np.exp(-t / 0.01)) * np.exp(-t / 0.9) * np.clip((dur - t) / 0.08, 0, 1)
    return env * (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t))


def kick():
    t = _t(0.45)
    f = 47 + 75 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def snare(rng):
    t = _t(0.3)
    n = _fft_filter(rng.standard_normal(len(t)), lo=900, hi=5500)
    n /= np.abs(n).max()
    return 0.55 * n * np.exp(-t / 0.085) + 0.35 * np.sin(2 * np.pi * 186 * t) * np.exp(-t / 0.045)


def hat(rng):
    t = _t(0.08)
    n = _fft_filter(rng.standard_normal(len(t)), lo=6500)
    n /= np.abs(n).max()
    return n * np.exp(-t / 0.022)


def _add(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def make_music(duration, path):
    rng = np.random.default_rng(11)
    n = int(duration * SR) + SR
    k_l, k_r, low, drums, hats_l, hats_r = (np.zeros(n) for _ in range(6))
    kk, sn = kick(), snare(rng)
    bar = 0
    while bar * BAR < duration + BAR:
        t0 = bar * BAR
        notes, root = CHORDS[bar % len(CHORDS)]
        for strike, vel in ((0.0, 1.0), (2.5 * BEAT, 0.55)):
            for j, m in enumerate(notes):
                sig = keys(hz(m), BAR - strike + 0.25, vel * rng.uniform(0.85, 1.0), rng)
                at = t0 + strike + 0.018 * j + rng.uniform(0, 0.008)
                _add(k_l, sig * (1.0 if j % 2 else 0.8), at)
                _add(k_r, sig * (0.8 if j % 2 else 1.0), at + 0.004)
        _add(low, bass(hz(root), BEAT * 1.7), t0)
        _add(low, 0.8 * bass(hz(root + (7 if bar % 2 else 12)), BEAT * 1.2), t0 + 2 * BEAT)
        for e in range(8):
            swing = 0.09 * BEAT if e % 2 else 0.0
            at = t0 + e * BEAT / 2 + swing
            if e in (0, 4) or (e == 5 and bar % 2):
                _add(drums, kk * (1.0 if e != 5 else 0.6), at)
            if e in (2, 6):
                _add(drums, sn * 0.75, at + 0.01)
            h = hat(rng) * (0.22 if e % 2 else 0.32) * rng.uniform(0.7, 1.0)
            _add(hats_l if e % 4 < 2 else hats_r, h, at)
            _add(hats_r if e % 4 < 2 else hats_l, h * 0.5, at)
        bar += 1
    # vinyl crackle + hiss
    crack = np.zeros(n)
    for c in rng.uniform(0, n / SR, int(n / SR * 7)):
        i = int(c * SR)
        crack[i: i + 3] += rng.uniform(-1, 1) * rng.uniform(0.02, 0.08)
    crack = _fft_filter(crack, lo=800, hi=6000) + 0.0025 * _fft_filter(rng.standard_normal(n), hi=5000)

    keys_mix = 0.16
    left = keys_mix * k_l + 0.32 * low + 0.42 * drums + 0.5 * hats_l + crack
    right = keys_mix * k_r + 0.32 * low + 0.42 * drums + 0.5 * hats_r + crack
    out = np.stack([_fft_filter(left, lo=35, hi=4200), _fft_filter(right, lo=35, hi=4200)], 1)
    out = out[: int(duration * SR)]
    t = np.arange(len(out)) / SR
    out *= np.clip(t / 0.5, 0, 1)[:, None] * np.clip((duration - t) / 1.6, 0, 1)[:, None]
    out /= np.abs(out).max() / 0.89
    pcm = (out * 32767).astype("<i2")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    path], input=pcm.tobytes(), check=True)


def _graph(vo_path, music_path, duration, tail):
    return (
        f"[0:a]aresample=48000,highpass=f=70,"
        f"acompressor=threshold=0.125:ratio=2.5:attack=5:release=150:makeup=1.4,"
        f"pan=stereo|c0=c0|c1=c0,apad=whole_dur={duration},asplit=2[vo][sc];"
        f"[1:a]aresample=48000,volume={MUSIC_DB}dB[mu];"
        f"[mu][sc]sidechaincompress=threshold=0.02:ratio=4:attack=40:release=500[duck];"
        f"[vo][duck]amix=inputs=2:normalize=0:duration=first{tail}[out]"
    )


def mix(vo_path, music_path, duration, out_path):
    """Duck the music under the voice, then two-pass loudness-normalize to -14 LUFS."""
    base = ["ffmpeg", "-hide_banner", "-y", "-i", vo_path, "-i", music_path]
    first = subprocess.run(
        base + ["-filter_complex", _graph(vo_path, music_path, duration,
                                          ",loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json"),
                "-map", "[out]", "-f", "null", "-"], capture_output=True, text=True, check=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", first, re.S).group(0))
    tail = (f",loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
            f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
            f":offset={m['target_offset']}:linear=true,aresample=48000")
    subprocess.run(base + ["-filter_complex", _graph(vo_path, music_path, duration, tail),
                           "-map", "[out]", "-t", f"{duration:.3f}", "-c:a", "pcm_s16le", out_path],
                   capture_output=True, check=True)


def loudness(path, extra=""):
    """Integrated loudness (LUFS) and true peak (dBTP) of a file."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"{extra}ebur128=peak=true",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return i, tp
