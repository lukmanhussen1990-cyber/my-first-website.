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


def ding():
    """Phone notification: two soft bell tones."""
    n = int(0.7 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for start, f in ((0.0, 1318.5), (0.11, 1760.0)):
        s = int(start * SR); tt = t[: n - s]
        y[s:] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.18)
    return y / (np.abs(y).max() + 1e-9)


def stamp():
    """Rubber-stamp slam: low thud + papery slap."""
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 110 * np.exp(-t / 0.05) + 55
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    nz = rng.standard_normal(n) * np.exp(-t / 0.012)
    y += 0.7 * biquad_bp(nz, 1800.0, 0.8)
    return y / (np.abs(y).max() + 1e-9)


def whoosh(dur=1.1):
    """Plane whoosh: noise through a band-pass sweeping up then down."""
    n = int(dur * SR); u = np.arange(n) / n
    fc = 300 + 1700 * np.sin(np.pi * u) ** 1.5
    y = biquad_bp(rng.standard_normal(n), fc, 1.2) * np.sin(np.pi * u) ** 1.2
    return y / (np.abs(y).max() + 1e-9)


def gasp():
    """Crowd gasp: several breathy 'huh!' voices (formant-filtered noise)."""
    n = int(0.6 * SR); y = np.zeros(n)
    for k in range(7):
        d = int((0.25 + 0.15 * rng.random()) * SR); s = int(rng.random() * 0.08 * SR)
        nz = rng.standard_normal(d)
        v = biquad_bp(nz, 650 + 200 * rng.random(), 6.0) + 0.7 * biquad_bp(nz, 1150 + 400 * rng.random(), 7.0)
        tt = np.arange(d) / d
        v *= np.minimum(1, tt * 25) * (1 - tt) ** 1.5
        m = max(0, min(d, n - s)); y[s:s + m] += v[:m]
    return y / (np.abs(y).max() + 1e-9)


def splash():
    """Coffee splash: wet noise burst + droplet blips."""
    n = int(0.6 * SR); t = np.arange(n) / SR
    y = biquad_bp(rng.standard_normal(n), 900.0, 0.9) * np.exp(-t / 0.08)
    for _ in range(9):
        s = int(rng.random() * 0.35 * SR); m = int(0.05 * SR); f = 900 + 1600 * rng.random()
        tt = np.arange(m) / SR
        y[s:s + m] += 0.5 * np.sin(2 * np.pi * (f + 3000 * tt) * tt) * np.exp(-tt / 0.012)
    return y / (np.abs(y).max() + 1e-9)


def plop():
    """Cartoon plop: a sine 'bloop' with a falling pitch."""
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 420 * np.exp(-t / 0.05) + 140
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08) * np.minimum(1, t * 400)
    return y / (np.abs(y).max() + 1e-9)


def news_jingle():
    """News jingle: four quick bright synth notes."""
    n = int(1.2 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for start, f in [(0.0, 523.25), (0.14, 659.25), (0.28, 783.99), (0.42, 1046.5)]:
        s = int(start * SR); tt = t[: n - s]
        dec = 0.6 if f > 1000 else 0.18
        tone = np.sign(np.sin(2 * np.pi * f * tt)) * 0.25 + np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt)
        y[s:] += tone * np.exp(-tt / dec) * np.minimum(1, tt * 300)
    return y / (np.abs(y).max() + 1e-9)


def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    y = rng.standard_normal(n) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.02)
    return y / (np.abs(y).max() + 1e-9)


def sparkle_snd():
    n = int(0.6 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for k, f in enumerate([2093, 2637, 3136, 4186]):
        s = int(k * 0.06 * SR); tt = t[: n - s]
        y[s:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.15)
    return y / (np.abs(y).max() + 1e-9)


SOUNDS = {
    'ding': lambda e: ding(),
    'stamp': lambda e: stamp(),
    'whoosh': lambda e: whoosh(e.get('dur') or 1.1),
    'gasp': lambda e: gasp(),
    'splash': lambda e: splash(),
    'plop': lambda e: plop(),
    'jingle': lambda e: news_jingle(),
    'thud': lambda e: thump(),
    'pop': lambda e: pop(),
    'sparkle': lambda e: sparkle_snd(),
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
