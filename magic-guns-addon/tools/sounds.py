"""
sounds.py - synthesises every Magic Guns sound effect from scratch (numpy)
and encodes it to mono 44.1 kHz Ogg Vorbis with ffmpeg.

    python3 sounds.py <resource_pack_dir>
"""

import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(1234)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env(dur, attack=0.002, decay=0.3, curve=1.0):
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    d = np.exp(-np.maximum(t - attack, 0) / max(decay, 1e-6)) ** curve
    return a * d * tail(len(t))


def tail(n, ms=25):
    """Fade the last few ms to zero so components never end with a click."""
    f = np.ones(n)
    k = min(n, int(SR * ms / 1000))
    if k > 1:
        f[-k:] = np.linspace(1, 0, k) ** 2
    return f


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    lo_w = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) if lo > 0 else 1
    hi_w = 1 / (1 + (f / hi) ** 4) if hi else 1
    return np.fft.irfft(X * lo_w * hi_w, len(x))


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


def crackle(dur, rate=120, decay=0.4, bright=6000):
    n = int(SR * dur)
    out = np.zeros(n)
    count = int(rate * dur)
    for _ in range(count):
        p = rng.integers(0, max(1, n - 400))
        L = rng.integers(30, 300)
        out[p:p + L] += rng.uniform(-1, 1, L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1)
    out = bandpass(out, 800, bright)
    return out * env(dur, 0.001, decay)


def reverb(x, size=0.35, mix=0.3):
    L = int(SR * size * 3)
    ir = rng.normal(0, 1, L) * np.exp(-np.arange(L) / (SR * size))
    ir = bandpass(ir, 200, 7000)
    ir /= np.abs(ir).sum() ** 0.5 * 4
    wet = np.convolve(x, ir)
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry * (1 - mix) + wet * mix


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def pad(x, dur):
    n = int(SR * dur)
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n] if len(x) < n else x


def finish(x, peak=0.89, drive=1.0, fade=0.02):
    if drive != 1.0:
        x = np.tanh(x * drive)
    x = x - np.mean(x)
    m = np.max(np.abs(x)) or 1
    x = x / m * peak
    # trim the silent tail, then fade out
    thr = np.where(np.abs(x) > 0.002)[0]
    if len(thr):
        x = x[: thr[-1] + 1]
    f = int(SR * fade)
    if len(x) > f:
        x[-f:] *= np.linspace(1, 0, f)
    return x


# ------------------------------------------------------------------ recipes

def arcane_fire():
    d = 0.9
    crack = bandpass(noise(0.03), 2500, 12000) * env(0.03, 0.0005, 0.008)
    zap = chirp(0.28, 2200, 260, harmonics=(1, 0.4, 0.2)) * env(0.28, 0.001, 0.09)
    bells = sum(tone(d, f, dd, harmonics=(1, 0.3)) * a for f, dd, a in
                ((2637, 0.35, 0.35), (3520, 0.25, 0.25), (4186, 0.18, 0.2), (1760, 0.5, 0.25)))
    thump = tone(0.2, 95, 0.05) * 0.8
    return finish(reverb(mix(crack * 0.7, zap, bells * 0.6, thump), 0.3, 0.3))


def arcane_hit():
    bells = sum(tone(0.7, f, dd) * a for f, dd, a in ((1975, 0.25, 0.5), (2960, 0.18, 0.35), (3950, 0.12, 0.25)))
    pop = bandpass(noise(0.06), 600, 5000) * env(0.06, 0.001, 0.015)
    return finish(reverb(mix(pop, bells), 0.25, 0.3))


def inferno_fire():
    boom = bandpass(noise(0.6), 20, 900) * env(0.6, 0.002, 0.14)
    thump = chirp(0.4, 70, 32) * env(0.4, 0.002, 0.12) * 1.4
    whoosh = bandpass(noise(0.7), 300, 2500) * env(0.7, 0.05, 0.25) * 0.5
    cr = crackle(0.9, 90, 0.35, 5000) * 0.6
    return finish(reverb(mix(boom, thump, whoosh, cr), 0.35, 0.25), drive=1.8)


def inferno_hit():
    whoosh = bandpass(noise(0.6), 150, 3000) * env(0.6, 0.01, 0.15)
    cr = crackle(0.8, 140, 0.3, 7000)
    return finish(mix(whoosh, cr * 0.7), drive=1.5)


def frost_fire():
    crack = bandpass(noise(0.02), 3000, 16000) * env(0.02, 0.0002, 0.004) * 1.4
    burst = bandpass(noise(0.12), 1500, 14000) * env(0.12, 0.001, 0.03)
    pew = chirp(0.22, 3200, 900, harmonics=(1, 0.3)) * env(0.22, 0.001, 0.06) * 0.6
    ring = sum(tone(1.2, f, dd) * a for f, dd, a in
               ((1870, 0.45, 0.3), (2960, 0.3, 0.25), (4410, 0.22, 0.2), (5550, 0.15, 0.15)))
    thump = tone(0.25, 80, 0.05) * 0.9
    return finish(reverb(mix(crack, burst, pew, ring * 0.7, thump), 0.5, 0.35))


def frost_hit():
    shards = np.zeros(int(SR * 0.6))
    for _ in range(26):
        p = rng.integers(0, int(SR * 0.25))
        f = rng.uniform(2500, 7500)
        L = int(SR * rng.uniform(0.03, 0.12))
        seg = np.sin(2 * np.pi * f * np.arange(L) / SR) * np.exp(-np.arange(L) / (L / 5)) * tail(L, 5)
        shards[p:p + L] += seg[: len(shards) - p] * rng.uniform(0.2, 0.8)
    hit = bandpass(noise(0.05), 1000, 12000) * env(0.05, 0.0005, 0.01)
    return finish(reverb(mix(hit, shards), 0.3, 0.25))


def storm_fire():
    blast = bandpass(noise(0.45), 30, 3500) * env(0.45, 0.001, 0.1)
    thump = chirp(0.3, 85, 40) * env(0.3, 0.001, 0.08) * 1.3
    t = t_axis(0.6)
    saw = 2 * ((t * 112) % 1) - 1
    jitter = np.repeat(rng.uniform(0.2, 1, int(len(t) / 400) + 1), 400)[: len(t)]
    buzz = bandpass(saw * jitter * tail(len(t), 40), 200, 4000) * env(0.6, 0.02, 0.2) * 0.45
    cr = crackle(0.6, 200, 0.2, 9000) * 0.6
    return finish(reverb(mix(blast, thump, buzz, cr), 0.3, 0.2), drive=2.0)


def storm_hit():
    t = t_axis(0.35)
    saw = 2 * ((t * 90) % 1) - 1
    jitter = np.repeat(rng.uniform(0, 1, int(len(t) / 300) + 1), 300)[: len(t)]
    buzz = bandpass(saw * jitter * tail(len(t), 30), 300, 6000) * env(0.35, 0.002, 0.1)
    cr = crackle(0.4, 260, 0.12, 10000)
    return finish(mix(buzz, cr * 0.8), drive=1.6)


def soul_fire():
    sweep = bandpass(noise(0.22), 500, 2600) * env(0.22, 0.004, 0.05)
    ghost = tone(0.3, 520, 0.08, vibrato=3.0, vib_rate=11, harmonics=(1, 0.5, 0.25)) * 0.5
    low = tone(0.15, 140, 0.04) * 0.6
    return finish(reverb(mix(sweep, ghost, low), 0.25, 0.25))


def soul_hit():
    airy = bandpass(noise(0.4), 300, 1800) * env(0.4, 0.02, 0.1)
    moan = chirp(0.4, 420, 240, harmonics=(1, 0.4)) * env(0.4, 0.01, 0.12) * 0.5
    return finish(reverb(mix(airy, moan), 0.3, 0.3))


def void_fire():
    d = 0.75
    t = t_axis(d)
    base = chirp(d, 950, 110, harmonics=(1, 0.5, 0.3, 0.2)) * env(d, 0.004, 0.22)
    lfo = (np.sin(2 * np.pi * 7 * t) + 1) * 0.0025 + 0.0005
    idx = np.clip(np.arange(len(t)) - (lfo * SR).astype(int), 0, len(t) - 1)
    phased = base + base[idx]
    swell = bandpass(noise(0.25), 400, 6000) * np.linspace(0, 1, int(SR * 0.25)) ** 2 * tail(int(SR * 0.25), 60) * 0.5
    return finish(reverb(mix(swell, np.concatenate([np.zeros(int(SR * 0.2)), phased])), 0.45, 0.35))


def void_hit():
    swell = bandpass(noise(0.3), 300, 8000) * np.linspace(0, 1, int(SR * 0.3)) ** 3 * tail(int(SR * 0.3), 30)
    thump = chirp(0.35, 120, 35) * env(0.35, 0.001, 0.1) * 1.2
    return finish(reverb(np.concatenate([swell, thump]), 0.4, 0.3), drive=1.3)


def holy_fire():
    boom = bandpass(noise(0.7), 20, 1100) * env(0.7, 0.002, 0.16)
    thump = chirp(0.5, 60, 30) * env(0.5, 0.002, 0.15) * 1.5
    choir = sum(tone(1.6, f, 0.55, vibrato=0.6, vib_rate=5 + i * 0.4, harmonics=(1, 0.45, 0.25, 0.12), attack=0.09)
                for i, f in enumerate((440.0, 554.37, 659.26, 880.0)))
    shimmer = sum(tone(1.4, f, 0.3) * 0.15 for f in (1760, 2217, 2637))
    return finish(reverb(mix(boom, thump, choir * 0.35, shimmer), 0.6, 0.35), drive=1.2)


def holy_hit():
    bells = sum(tone(1.6, f, 0.5, harmonics=(1, 0.3)) * a for f, a in ((880, 0.5), (1108.7, 0.4), (1318.5, 0.35), (1760, 0.3)))
    whoosh = bandpass(noise(0.8), 200, 4000) * env(0.8, 0.01, 0.2)
    thump = chirp(0.35, 90, 40) * env(0.35, 0.002, 0.1)
    return finish(reverb(mix(whoosh, thump, bells * 0.6), 0.6, 0.4))


SOUNDS = {
    "arcane_fire": arcane_fire, "arcane_hit": arcane_hit,
    "inferno_fire": inferno_fire, "inferno_hit": inferno_hit,
    "frost_fire": frost_fire, "frost_hit": frost_hit,
    "storm_fire": storm_fire, "storm_hit": storm_hit,
    "soul_fire": soul_fire, "soul_hit": soul_hit,
    "void_fire": void_fire, "void_hit": void_hit,
    "holy_fire": holy_fire, "holy_hit": holy_hit,
}


def write_ogg(x, path):
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


def main(rp_dir):
    out_dir = os.path.join(rp_dir, "sounds", "magic_guns")
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in SOUNDS.items():
        x = fn()
        write_ogg(x, os.path.join(out_dir, name + ".ogg"))
        print("sound", name, "%.2fs" % (len(x) / SR))


if __name__ == "__main__":
    main(sys.argv[1])
