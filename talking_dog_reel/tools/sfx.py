#!/usr/bin/env python3
"""Synthesise the reel's small sound effects in code (no samples, no
ElevenLabs) and mix them *quietly* under the voiceover.

    python3 tools/sfx.py build/timeline.json build/sfx_events.json build/sfx.wav --voice voice/voiceover.wav

Sounds: collar click, collar beep, record scratch, phone REC beep, spoon
clink, high-five clap, rain. The effects bus is scaled relative to the
voice level so the voice always stays clear.
"""
import argparse
import json
import subprocess
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(11)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a, d):
    """attack/decay envelope (seconds)"""
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)


def biquad(x, fc, q, kind='bp'):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        w0 = 2 * np.pi * fc[i] / SR
        al = np.sin(w0) / (2 * q)
        c = np.cos(w0)
        if kind == 'bp':
            b0, b1, b2 = al, 0.0, -al
        elif kind == 'lp':
            b0, b1, b2 = (1 - c) / 2, 1 - c, (1 - c) / 2
        else:  # hp
            b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2
        a0, a1, a2 = 1 + al, -2 * c, 1 - al
        yi = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def norm(y):
    return y / (np.abs(y).max() + 1e-9)


def click():
    """plastic/metal clasp snapping shut: two tiny ticks"""
    out = np.zeros(int(0.12 * SR))
    for k, (dt, f, g) in enumerate([(0.0, 3200, 1.0), (0.035, 2400, 0.7)]):
        n = int(0.03 * SR)
        tt = t_(0.03)
        s = (np.sin(2 * np.pi * f * tt) + 0.5 * rng.standard_normal(n)) * np.exp(-tt / 0.004) * g
        i = int(dt * SR)
        out[i:i + n] += s
    return norm(out)


def beep():
    """gadget power-on: two clean sine blips, second one higher"""
    out = np.zeros(int(0.42 * SR))
    for dt, f in [(0.0, 1568.0), (0.16, 2093.0)]:
        tt = t_(0.13)
        s = np.sin(2 * np.pi * f * tt) * np.minimum(1, tt / 0.005) * np.minimum(1, (0.13 - tt) / 0.02)
        i = int(dt * SR)
        out[i:i + len(s)] += s
    return norm(out)


def scratch():
    """record scratch: noise + saw through a band-pass swept fast up and down"""
    d = 0.42
    n = int(d * SR)
    t = np.arange(n) / n
    sweep = np.where(t < 0.35, 300 + 2600 * (t / 0.35) ** 1.5, 2900 - 2500 * (np.clip(t - 0.35, 0, None) / 0.65) ** 0.7)
    saw = ((np.cumsum(sweep / 6) / SR) % 1.0) * 2 - 1
    y = biquad(0.6 * rng.standard_normal(n) + 0.8 * saw, sweep, 4.0)
    y *= np.minimum(1, t * 30) * (1 - t) ** 0.6
    return norm(y)


def recbeep():
    """phone 'start recording' tone: short soft double tone"""
    out = np.zeros(int(0.3 * SR))
    for dt, f in [(0.0, 880.0), (0.1, 1320.0)]:
        tt = t_(0.08)
        s = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / 0.08)
        i = int(dt * SR)
        out[i:i + len(s)] += s
    return norm(out)


def clink():
    """spoon on a ceramic plate: inharmonic ringing partials"""
    tt = t_(0.5)
    y = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) for f, a, d in [(2650, 1.0, 0.09), (4100, 0.6, 0.06), (5900, 0.35, 0.04), (1730, 0.4, 0.12)])
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return norm(y)


def clap():
    """high-five slap: short bright noise burst + a little body"""
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    noise = biquad(rng.standard_normal(n), 1700, 0.9)
    y = noise * np.exp(-tt / 0.03) + 0.4 * np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.02)
    return norm(y)


def rain(dur):
    """steady rain: filtered noise bed + random droplet ticks; fades in"""
    n = int(dur * SR)
    bed = biquad(rng.standard_normal(n), 3500, 0.5, 'lp')
    bed = biquad(bed, 400, 0.7, 'hp')
    ticks = np.zeros(n)
    k = rng.integers(0, n, int(dur * 70))
    ticks[k] = rng.uniform(0.3, 1.0, len(k)) * rng.choice([-1, 1], len(k))
    ticks = biquad(ticks, 5000, 2.0)
    y = norm(bed) * 0.7 + norm(ticks) * 0.5
    y *= np.minimum(1, np.arange(n) / (0.4 * SR))
    return norm(y)


SOUNDS = {
    'click': lambda e: click(),
    'beep': lambda e: beep(),
    'scratch': lambda e: scratch(),
    'recbeep': lambda e: recbeep(),
    'clink': lambda e: clink(),
    'clap': lambda e: clap(),
    'rain': lambda e: rain(e.get('dur') or 5.0),
}
# per-sound balance on the (already quiet) effects bus
BAL = {'click': 0.55, 'beep': 0.6, 'scratch': 0.9, 'recbeep': 0.5, 'clink': 0.45, 'clap': 1.0, 'rain': 0.42}


def voice_level(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
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
    ap.add_argument('--level', type=float, default=0.22, help='effects loudness relative to the voice')
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
        s = fn(e) * BAL.get(e['type'], 0.5)
        i = int(e['t'] * SR)
        bus[i:i + len(s)] += s[: max(0, len(bus) - i)]
        used[e['type']] = used.get(e['type'], 0) + 1
    bus = bus[:n]
    # follow the picture's fade-out at the end
    fade = int(1.5 * SR)
    bus[-fade:] *= np.linspace(1, 0, fade) ** 1.5
    peak = np.abs(bus).max() + 1e-9
    if a.voice:
        v_rms, v_peak = voice_level(a.voice)
        target = min(0.45 * v_peak, a.level * 4.0 * v_rms)
    else:
        target = 0.18
    bus *= target / peak
    pcm = (np.clip(np.stack([bus, bus], axis=1), -1, 1) * 32767).astype(np.int16)
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"sfx: {sum(used.values())} sounds {used}, peak {target:.3f} -> {a.out}")


if __name__ == '__main__':
    main()
