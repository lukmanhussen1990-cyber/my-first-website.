#!/usr/bin/env python3
"""Synthesises the soundtrack for the Claude promo.

    python3 music.py cues.json soundtrack.wav

Everything is generated from scratch with numpy (no samples), and every hit is
placed at a cue time exported from ad.html, so sound and picture stay locked.
120 BPM, D major: ignition -> four word hits -> groove under the product demo ->
riser -> impact on the logo.
"""
import json
import re
import subprocess
import sys
import wave

import numpy as np

SR = 48000
TAU = 2 * np.pi


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def times(dur):
    return np.arange(int(dur * SR)) / SR


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def spectral(x, gain_fn):
    """Zero-phase filter: multiply the spectrum by gain_fn(freqs)."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(spec * gain_fn(f), len(x))


def lowpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def highpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, fc, octaves):
    return spectral(x, lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / octaves) ** 2))


def swept_noise(dur, f0, f1, width=0.6, seed=0):
    """Noise through a band-pass whose centre glides exponentially f0 -> f1 (STFT overlap-add)."""
    n, win, hop = int(dur * SR), 2048, 256
    x = noise(n + win, seed)
    w = np.hanning(win)
    freqs = np.maximum(np.fft.rfftfreq(win, 1 / SR), 1)
    out = np.zeros(n + win)
    for s in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (s / n)
        g = np.exp(-0.5 * (np.log2(freqs / fc) / width) ** 2)
        out[s:s + win] += np.fft.irfft(np.fft.rfft(x[s:s + win] * w) * g, win) * w
    return out[:n] / (np.sum(w ** 2) / hop)


# ------------------------------------------------------------------ instruments
def pad(midis, dur, attack=0.5, release=1.0, cutoff=(900, 2400), detune=9, seed=0):
    """Warm detuned additive pad with a filter that opens over the note. Returns stereo."""
    t = times(dur + release)
    n = len(t)
    rng = np.random.default_rng(seed)
    fc = np.geomspace(cutoff[0], cutoff[1], n)
    out = np.zeros((2, n))
    for m in midis:
        for v, (cents, pan) in enumerate(((-detune, -.55), (0, 0), (detune, .55))):
            f = hz(m) * 2 ** (cents / 1200)
            vib = 1 + 0.0015 * np.sin(TAU * (0.35 + 0.1 * v) * t + rng.uniform(0, TAU))
            phase = TAU * np.cumsum(f * vib) / SR
            sig = np.zeros(n)
            for k in range(1, int(5000 // f) + 1):
                sig += (1 / k) / np.sqrt(1 + (k * f / fc) ** 4) * np.sin(k * phase + rng.uniform(0, TAU))
            out[0] += sig * np.cos((pan + 1) * np.pi / 4)
            out[1] += sig * np.sin((pan + 1) * np.pi / 4)
    env = np.where(t < attack, 0.5 - 0.5 * np.cos(np.pi * t / attack), 1.0)
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 4)))
    return out * env / (len(midis) * 3)


def pluck(midi, dur=1.6, tau=0.4, index=1.3, ratio=2.0):
    """Soft FM pluck (electric-piano / marimba family)."""
    t = times(dur)
    f = hz(midi)
    mod = index * np.exp(-t / 0.12) * np.sin(TAU * f * ratio * t)
    return np.sin(TAU * f * t + mod) * np.minimum(1, t / 0.002) * np.exp(-t / tau)


def bell(midi, dur=2.8, tau=0.9):
    t = times(dur)
    f = hz(midi)
    parts = ((1.0, 1.0, 1.0), (2.0, .45, .6), (3.01, .22, .42), (4.17, .1, .3), (5.43, .06, .2))
    sig = sum(a * np.sin(TAU * f * r * t) * np.exp(-t / (tau * d)) for r, a, d in parts)
    return sig * np.minimum(1, t / 0.0015) / 1.8


def bass(midi, dur, seed=0):
    t = times(dur + 0.08)
    f = hz(midi)
    sig = np.sin(TAU * f * t) + .45 * np.sin(TAU * 2 * f * t + .3) + .18 * np.sin(TAU * 3 * f * t + .7)
    env = np.minimum(1, t / 0.006) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.02))
    return np.tanh(1.4 * sig) * env * .8


def kick(seed=0):
    t = times(0.6)
    ph = TAU * np.cumsum(52 + 120 * np.exp(-t / 0.028)) / SR
    body = np.sin(ph) * np.exp(-t / 0.15)
    click = lowpass(noise(len(t), seed), 4500) * np.exp(-t / 0.0018) * .25
    return body + click


def hat(seed=0, decay=0.032):
    t = times(0.15)
    return highpass(noise(len(t), seed), 7500, 3) * np.exp(-t / decay) * .35


def clap(seed=0):
    t = times(0.45)
    x = bandpass(noise(len(t), seed), 1400, .7)
    env = sum(np.where(t >= d, np.exp(-(t - d) / 0.007), 0) for d in (0, .009, .019)) * .55
    env += np.where(t >= .028, np.exp(-(t - .028) / 0.11), 0)
    return x * env * .5


def boom(dur=2.4):
    t = times(dur)
    ph = TAU * np.cumsum(31 + 34 * np.exp(-t / 0.22)) / SR
    return np.sin(ph) * np.exp(-t / 0.85) * np.minimum(1, t / 0.004)


def crash(seed=0, dur=2.2):
    t = times(dur)
    x = highpass(noise(len(t), seed), 3000, 1)
    x = lowpass(x, 9000)
    return x * np.exp(-t / 0.55) * np.minimum(1, t / 0.003) * .3


def key_click(seed):
    rng = np.random.default_rng(seed)
    t = times(0.03)
    x = bandpass(noise(len(t), seed), rng.uniform(2600, 4200), .8) * np.exp(-t / 0.0035)
    thump = np.sin(TAU * rng.uniform(150, 210) * t) * np.exp(-t / 0.008) * .35
    return (x + thump) * rng.uniform(.75, 1.0)


def pop():
    t = times(0.16)
    ph = TAU * np.cumsum(480 + 720 * np.exp(-t / 0.018)) / SR
    return np.sin(ph) * np.exp(-t / 0.045) * np.minimum(1, t / 0.001)


def whoosh(dur, f0, f1, seed=0, peak=0.6, width=0.7):
    t = times(dur)
    x = swept_noise(dur, f0, f1, width, seed)
    pk = peak * dur
    env = np.where(t < pk, np.sin(np.pi / 2 * t / pk) ** 2, np.cos(np.pi / 2 * (t - pk) / (dur - pk)) ** 2)
    return x * env


def reverb_ir(seed=5):
    """Stereo decaying-noise IR: warm low band (RT60 2.1 s), faster bright band (0.9 s)."""
    t = times(2.8)
    out = []
    for ch in range(2):
        lo = lowpass(noise(len(t), seed + ch), 2500) * np.exp(-6.91 * t / 2.1)
        hi = highpass(noise(len(t), seed + 10 + ch), 2500) * np.exp(-6.91 * t / 0.9)
        ir = lo + .6 * hi
        pre = int(0.022 * SR)
        ir[:pre] = 0
        ir[pre:pre + 240] *= np.linspace(0, 1, 240)
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.array(out)


# ------------------------------------------------------------------ mixing
class Mix:
    def __init__(self, dur):
        self.n = int(round(dur * SR))
        self.buses = {}

    def add(self, bus, t0, sig, gain=1.0, pan=0.0, send=0.0):
        b = self.buses.setdefault(bus, {'dry': np.zeros((2, self.n + 4 * SR)), 'send': send})
        if sig.ndim == 1:
            sig = np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)])
        i = int(round(t0 * SR))
        if i < 0:
            sig, i = sig[:, -i:], 0
        j = min(i + sig.shape[1], b['dry'].shape[1])
        b['dry'][:, i:j] += sig[:, :j - i] * gain


def loudness(path):
    out = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def limiter(x, ceiling_db=-1.5, look=0.004, release=0.09):
    ceil = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceil / np.maximum(np.max(np.abs(x), axis=0), 1e-9))
    L = int(look * SR)
    padded = np.concatenate([need, np.ones(2 * L)])
    g = np.min(np.lib.stride_tricks.sliding_window_view(padded, 2 * L + 1), axis=1)[:len(need)]
    g = np.convolve(np.concatenate([np.ones(L), g]), np.ones(L + 1) / (L + 1), 'valid')[:len(need)]
    a = np.exp(-1 / (release * SR))
    sm = np.empty_like(g)
    cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else a * cur + (1 - a) * v
        sm[i] = cur
    return np.clip(x * sm, -ceil, ceil)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).round().astype('<i2').T.copy()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ------------------------------------------------------------------ the score
def score(c):
    m = Mix(c['duration'])
    D3, Fs3, A3, B3, Cs4, D4, E4, Fs4, G4, A4, B4, Cs5, D5, E5, Fs5, G5, A5, B5, Cs6, D6, E6, Fs6, A6 = \
        50, 54, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86, 88, 90, 93

    # --- 0.0 - 1.0 ignition
    m.add('pad', 0.0, pad([D3, A3, Cs4, E4, Fs4], 1.0, attack=.8, release=.5, cutoff=(350, 1400), seed=1), .55, send=.35)
    m.add('fx', c['ignite'], bell(A5, tau=.7), .2, pan=0, send=.6)
    m.add('fx', c['ignite'], boom(1.2), .16)
    for i, note in enumerate((D6, Fs6, A6, D6 + 12)):
        m.add('fx', c['burst'] + i * .035, bell(note, dur=1.6, tau=.45), .09, pan=-.5 + i * .33, send=.7)
    w0, w1 = c['wipeIn']
    m.add('fx', w0 - .25, whoosh(w1 - w0 + .3, 250, 7000, seed=2, peak=.92, width=.8), .3, send=.25)

    # --- 1.0 - 3.0 four word hits: D, Bm, G, A
    chords = [(D4, Fs4, A4), (B3, D4, Fs4), (G4 - 12, B3, D4), (A3, Cs4, E4)]
    roots = [38, 47, 43, 45]
    for k, b in enumerate(c['beats']):
        m.add('drums', b, kick(k), .9 if k == 0 else .7)
        m.add('fx', b, boom(.9), .14 if k == 0 else .05)
        if k % 2:
            m.add('drums', b, clap(k), .55, send=.18)
        for j, note in enumerate(chords[k]):
            m.add('keys', b + j * .008, pluck(note + 12, tau=.32, index=1.6), .27, pan=(j - 1) * .35, send=.4)
        m.add('pad', b, pad(list(chords[k]), .42, attack=.02, release=.45, cutoff=(2800, 1800), seed=10 + k), .55, send=.3)
        m.add('bass', b, bass(roots[k], .4), .4)
        if k:
            m.add('fx', b - .17, whoosh(.24, 900, 5000, seed=20 + k, peak=.7), .12, pan=(-1) ** k * .3)
    p0, p1 = c['panelWhoosh']
    m.add('fx', p0 - .05, whoosh(p1 - p0 + .2, 600, 4500, seed=30, peak=.55), .2, send=.2)

    # --- 3.0 - 7.0 groove under the product demo
    groove = [(3.0, 1.0, [43, 50, 54, 59, 62], 43, (G4, B4, D5, Fs5)),     # Gmaj7
              (4.0, 1.0, [45, 52, 57, 61, 64], 45, (A4, Cs5, E5, A5)),     # A
              (5.0, 1.0, [47, 54, 57, 62, 66], 47, (B4, D5, Fs5, A5)),     # Bm7
              (6.0, .5, [43, 50, 55, 59, 62], 43, (G4, B4, D5, G5)),       # G
              (6.5, .5, [45, 52, 57, 61, 64], 45, (A4, Cs5, E5, A5))]      # A
    for t0, dur, voicing, root, arp in groove:
        m.add('pad', t0, pad(voicing, dur, attack=.08, release=.6, cutoff=(1200, 2600), seed=int(t0 * 10)), .5, send=.35)
        for e in range(int(dur / .25)):
            m.add('bass', t0 + e * .25, bass(root, .2), .33)
            note = arp[e % 4]
            m.add('keys', t0 + e * .25, pluck(note, tau=.22, index=1.5), .16, pan=.35 if e % 2 else -.35, send=.45)
    beat = 3.0
    while beat < 6.99:
        m.add('drums', beat, kick(int(beat * 4)), .55)
        m.add('drums', beat + .25, hat(int(beat * 4)), .2, pan=.25)
        if abs((beat - 3.0) % 1.0 - .5) < 1e-6:
            m.add('drums', beat, clap(int(beat * 4)), .3, send=.15)
        beat += .5

    m.add('fx', c['composer'], whoosh(.35, 300, 1800, seed=40, peak=.5), .1)
    for i, at in enumerate(c['typing']):
        m.add('ui', at, key_click(100 + i), .11, pan=.1)
    m.add('ui', c['send'], pop(), .3, send=.25)
    m.add('fx', c['convo'], whoosh(.45, 700, 3500, seed=41, peak=.4), .14, pan=.2, send=.2)
    for i in range(5):
        m.add('fx', c['think'] + i * .06, bell((A5, Cs6, E6, Fs6, A6)[i], dur=1.2, tau=.25), .05, pan=-.4 + i * .2, send=.7)
    for i, at in enumerate(c['cards']):
        m.add('keys', at, pluck((D5, Fs5, A5)[i], tau=.5, index=1.8), .3, pan=(i - 1) * .4, send=.4)
        m.add('ui', at, pop(), .06)
    for i, at in enumerate(c['checks']):
        m.add('fx', at, bell((B5, D6, E6)[i], dur=1.5, tau=.35), .1, pan=(i - 1) * .4, send=.55)

    # --- 7.0 - 8.0 riser into the logo
    out, impact = c['outro'], c['impact']
    rdur = impact - out
    m.add('pad', out, pad([45, 52, 55, 62, 64], rdur, attack=.15, release=.05, cutoff=(500, 4200), seed=77), .5, send=.35)
    rt = times(rdur)
    rise = swept_noise(rdur, 350, 9000, .9, seed=50) * (rt / rdur) ** 2.2
    rise[-240:] *= np.linspace(1, 0, 240)
    m.add('fx', out, rise, .42, send=.25)
    glide = np.sin(TAU * np.cumsum(220 * 4 ** (rt / rdur) ** 1.6) / SR) * (rt / rdur) ** 2 * .5
    glide[-240:] *= np.linspace(1, 0, 240)
    m.add('fx', out, glide, .08, send=.3)
    roll, step = 7.5, .125
    while roll < impact - .02:
        m.add('drums', roll, clap(int(roll * 100)), .06 + .18 * (roll - 7.5) / .5, send=.12)
        roll += step
        step = max(.042, step * .82)

    # --- 8.0 impact + lockup
    m.add('fx', impact, boom(2.6), .45)
    m.add('drums', impact, kick(9), .9)
    m.add('fx', impact, crash(3), .5, send=.35)
    m.add('pad', impact, pad([38, 50, 57, 61, 64, 66], 2.0, attack=.03, release=1.2, cutoff=(3600, 2200), seed=88), .7, send=.45)
    m.add('bass', impact, bass(38, 1.8), .45)
    for j, note in enumerate((D4, Fs4, A4, D5, E5)):
        m.add('keys', impact + j * .018, pluck(note, dur=2.5, tau=.9, index=1.5), .22, pan=(j - 2) * .25, send=.5)
    for i, note in enumerate((D6, E6, Fs6, A6, D6 + 12)):
        m.add('fx', c['wordmark'] + i * .045, bell(note, dur=2.0, tau=.6), .08, pan=-.5 + i * .25, send=.75)
    m.add('fx', c['cta'], bell(D6, tau=1.0), .13, pan=-.15, send=.6)
    m.add('fx', c['cta'] + .09, bell(A6, tau=1.0), .09, pan=.15, send=.6)
    return m


def render(m, out_path, target_lufs=-14.0):
    n = m.n
    # kick-driven ducking on pads and bass through the groove
    duck = np.ones(n + 4 * SR)
    t = np.arange(len(duck)) / SR
    for b in np.arange(3.0, 7.0, .5):
        duck -= .32 * np.where(t >= b, np.exp(-(t - b) / .13), 0)
    send = np.zeros((2, n + 4 * SR))
    dry = np.zeros_like(send)
    for name, b in m.buses.items():
        sig = b['dry'] * duck if name in ('pad', 'bass') else b['dry']
        if name == 'pad':
            sig = np.array([highpass(ch, 150, 2) for ch in sig])
        dry += sig
        send += sig * b['send']
    ir = reverb_ir()
    nfft = 1 << int(np.ceil(np.log2(send.shape[1] + ir.shape[1])))
    wet = np.array([np.fft.irfft(np.fft.rfft(send[ch], nfft) * np.fft.rfft(ir[ch], nfft), nfft)[:send.shape[1]] for ch in range(2)])
    mix = (dry + .55 * wet)[:, :n]
    def master_eq(f):
        lf = np.log2(np.maximum(f, 1))
        sub = 10 ** (-2.5 / 20 * np.clip((np.log2(110) - lf) / 1.2, 0, 1))      # -2.5 dB below ~50 Hz
        air = 10 ** (4.0 / 20 * np.clip((lf - np.log2(700)) / 1.9, 0, 1))      # +4 dB from ~2.6 kHz up
        return sub * air / np.sqrt(1 + (28 / np.maximum(f, 1e-3)) ** 4)
    mix = np.array([spectral(ch, master_eq) for ch in mix])
    fade = int(.6 * SR)
    mix[:, -fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    mix[:, :48] *= np.linspace(0, 1, 48)
    mix /= np.max(np.abs(mix))
    # bring to the target loudness, then catch peaks
    gain = 1.0
    for _ in range(3):
        write_wav(out_path, limiter(mix * gain))
        lufs = loudness(out_path)
        if abs(lufs - target_lufs) < .3:
            break
        gain *= 10 ** ((target_lufs - lufs) / 20)
    print(f'{out_path}: {lufs:.1f} LUFS integrated')


if __name__ == '__main__':
    cues = json.load(open(sys.argv[1]))
    render(score(cues), sys.argv[2])
