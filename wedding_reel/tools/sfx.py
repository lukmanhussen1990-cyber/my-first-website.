#!/usr/bin/env python3
"""Synthesise the small sound effects (all made in code, no samples) and mix
them *quietly* under the voiceover.

    python3 tools/sfx.py build/timeline.json build/sfx_events.json build/sfx.wav [--voice my_voiceover.mp3]

The voice itself is never processed: the effects bus is scaled relative to
the voice level so the voice always stays the main sound.
"""
import argparse
import json
import subprocess
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def resonator_bank(x, freqs, decay):
    """Excite a bank of decaying sinusoids (cheap modal synthesis) with x."""
    n = int(decay * 6 * SR)
    t = np.arange(n) / SR
    ir = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / decay) / (1 + i * 0.6) for i, f in enumerate(freqs))
    return np.convolve(x, ir)[: len(x) + n]


def biquad_bp(x, fc, q):
    """Time-varying band-pass (fc may be an array)."""
    fc = np.broadcast_to(fc, x.shape)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w0 = 2 * np.pi * fc[i] / SR
        alpha = np.sin(w0) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * np.cos(w0), 1 - alpha
        yi = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1 = x1, x[i]
        y2, y1 = y1, yi
        y[i] = yi
    return y


def creak(dur):
    """Door creak: stick-slip clicks driving wooden resonances."""
    n = int(dur * SR)
    x = np.zeros(n)
    t = 0.0
    while t < dur:
        u = t / dur
        rate = 35 + 55 * np.sin(np.pi * u) + 15 * np.sin(2 * np.pi * 3.1 * u)
        i = int(t * SR)
        if i < n:
            x[i] = (0.6 + 0.4 * rng.random()) * np.sin(np.pi * u) ** 0.5
        t += (1 + 0.25 * (rng.random() - 0.5)) / rate
    y = resonator_bank(x, [510, 760, 1130, 1720], 0.012)[:n]
    return y / (np.abs(y).max() + 1e-9)


def scratch():
    """Record scratch: noise through a band-pass swept fast up and down."""
    d = 0.42
    n = int(d * SR)
    t = np.arange(n) / n
    sweep = np.where(t < 0.35, 300 + 2600 * (t / 0.35) ** 1.5, 2900 - 2500 * (np.clip(t - 0.35, 0, None) / 0.65) ** 0.7)
    noise = rng.standard_normal(n)
    saw = ((np.cumsum(sweep / 6) / SR) % 1.0) * 2 - 1
    y = biquad_bp(0.6 * noise + 0.8 * saw, sweep, 4.0)
    y *= np.minimum(1, t * 30) * (1 - t) ** 0.6
    return y / (np.abs(y).max() + 1e-9)


def key_click():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    f = 2200 + 900 * rng.random()
    y = 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004)
    y += 0.5 * np.sin(2 * np.pi * (180 + 60 * rng.random()) * t) * np.exp(-t / 0.012)
    y += 0.4 * rng.standard_normal(n) * np.exp(-t / 0.002)
    return y / (np.abs(y).max() + 1e-9)


def thump():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 75 * np.exp(-t / 0.12) + 38
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    nz = rng.standard_normal(n) * np.exp(-t / 0.01)
    nz = np.convolve(nz, np.ones(40) / 40, mode='same')
    y += 0.9 * nz
    return y / (np.abs(y).max() + 1e-9)


def jingle():
    n = int(0.6 * SR)
    y = np.zeros(n)
    for _ in range(14):
        s = int(rng.random() * 0.45 * SR)
        m = n - s
        t = np.arange(m) / SR
        fs = [3100, 4520, 6070, 7330]
        k = sum(np.sin(2 * np.pi * f * (1 + 0.04 * rng.standard_normal()) * t) * np.exp(-t / (0.03 + 0.03 * rng.random())) for f in fs)
        y[s:] += k * (0.4 + 0.6 * rng.random())
    return y / (np.abs(y).max() + 1e-9)


def clank():
    n = int(1.2 * SR)
    y = np.zeros(n)
    for start, amp in ((0.0, 1.0), (0.13, 0.45)):
        s = int(start * SR)
        m = n - s
        t = np.arange(m) / SR
        parts = [(212, 0.5), (523, 0.35), (811, 0.28), (1247, 0.2), (1963, 0.12), (2870, 0.07)]
        k = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / (0.5 / (1 + i * 0.5))) for i, (f, a) in enumerate(parts))
        k += 0.8 * rng.standard_normal(m) * np.exp(-t / 0.006)
        y[s:] += amp * k
    return y / (np.abs(y).max() + 1e-9)


def organ_tone(freqs, dur, decay=None):
    """Pipe-organ-ish chord: stacked harmonics with a slow attack."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for h, a in ((1, 1.0), (2, 0.5), (3, 0.25), (4, 0.15), (0.5, 0.3)):
            y += a * np.sin(2 * np.pi * f * h * t + 0.3 * np.sin(2 * np.pi * 5.2 * t) * 0.02)
    env = np.minimum(1, t / 0.12) * np.minimum(1, (dur - t) / 0.4)
    if decay: env *= np.exp(-t / decay)
    return y * env


def organ(dur=2.2):
    # a bright major chord (C major, then F/C) like a wedding fanfare
    a = organ_tone([261.6, 329.6, 392.0], dur * 0.5)
    b = organ_tone([261.6, 349.2, 440.0], dur * 0.5)
    y = np.concatenate([a, b])
    return y / (np.abs(y).max() + 1e-9)


def sad_organ(dur=4.5):
    # slow minor chords: A minor -> F -> D minor -> E
    chords = [[220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [146.8, 174.6, 220.0], [164.8, 207.7, 246.9]]
    seg = dur / len(chords)
    y = np.concatenate([organ_tone(c, seg) for c in chords])
    return y / (np.abs(y).max() + 1e-9)


def rumble(dur=1.3):
    """Stomach rumble: low gurgling filtered noise with a wobbling pitch."""
    n = int(dur * SR); t = np.arange(n) / SR
    fc = 90 + 60 * np.sin(2 * np.pi * 3.1 * t) + 40 * np.sin(2 * np.pi * 7.3 * t)
    y = biquad_bp(rng.standard_normal(n), fc, 3.0)
    y += 0.6 * np.sin(2 * np.pi * np.cumsum(fc * 0.8) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t))
    y *= np.sin(np.pi * t / dur) ** 0.7
    return y / (np.abs(y).max() + 1e-9)


def crack():
    """Knuckle crack: a very short bright click with a tiny pop."""
    n = int(0.08 * SR); t = np.arange(n) / SR
    y = rng.standard_normal(n) * np.exp(-t / 0.0025)
    y += 0.6 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.006)
    return y / (np.abs(y).max() + 1e-9)


SOUNDS = {
    'organ': lambda e: organ(e.get('dur') or 2.2),
    'sadorgan': lambda e: sad_organ(e.get('dur') or 4.5),
    'rumble': lambda e: rumble(e.get('dur') or 1.3),
    'scratch': lambda e: scratch(),
    'crack': lambda e: crack(),
}


def voice_level(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    # RMS over the loud (speech) parts only
    frames = a[: len(a) // 1024 * 1024].reshape(-1, 1024)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    speech = rms[rms > rms.max() * 0.1]
    return float(np.sqrt((speech ** 2).mean())) if len(speech) else 0.1, float(np.abs(a).max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('timeline')
    ap.add_argument('events')
    ap.add_argument('out')
    ap.add_argument('--voice')
    ap.add_argument('--level', type=float, default=0.38,
                    help='effects loudness relative to the voice (0.22 ~ -13 dB)')
    a = ap.parse_args()
    tl = json.load(open(a.timeline))
    ev = json.load(open(a.events))
    n = int(np.ceil(tl['duration'] * SR))
    bus = np.zeros(n + SR * 2)
    used = {}
    for e in ev:
        fn = SOUNDS.get(e['type'])
        if not fn:
            continue
        s = fn(e) * e.get('gain', 0.5)
        i = int(e['t'] * SR)
        bus[i:i + len(s)] += s[: max(0, len(bus) - i)]
        used[e['type']] = used.get(e['type'], 0) + 1
    bus = bus[:n]
    peak = np.abs(bus).max() + 1e-9
    if a.voice:
        v_rms, v_peak = voice_level(a.voice)
        # effects peaks sit well below the voice: effect RMS-ish ~ level * voice RMS
        target_peak = min(0.5 * v_peak, a.level * 4.0 * v_rms)
    else:
        target_peak = 0.18
    bus *= target_peak / peak
    stereo = np.stack([bus, bus], axis=1)
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"sfx: {sum(used.values())} sounds {used}, peak {target_peak:.3f} -> {a.out}")


if __name__ == '__main__':
    main()
