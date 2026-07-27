#!/usr/bin/env python3
"""Synthesize the full audio bed: orchestral pad, sound design and narration.

Everything is generated from scratch with numpy (no samples, no licensing
questions) and mixed against the cue times in timeline.json, so the music
lands on the same frames as the animation.

Output: build/audio.wav  (48 kHz stereo)
"""

import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 48000

with open(os.path.join(HERE, "timeline.json")) as f:
    TL = json.load(f)
with open(os.path.join(BUILD, "narration.json")) as f:
    VO = json.load(f)

DUR = TL["duration"]
N = int(DUR * SR)

rng = np.random.default_rng(20260727)


# ----------------------------------------------------------------- utilities

def t_axis(n):
    return np.arange(n) / SR


def idx(t):
    return int(round(t * SR))


def add(buf, sig, t0):
    """Mix `sig` into `buf` starting at time t0 (seconds), clipped to length."""
    i = idx(t0)
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n]


def adsr(n, attack, decay, sustain, release):
    """Simple ADSR over n samples (times in seconds)."""
    a, d, r = int(attack * SR), int(decay * SR), int(release * SR)
    a, d, r = max(a, 1), max(d, 1), max(r, 1)
    s = max(n - a - d - r, 0)
    env = np.concatenate([
        np.linspace(0, 1, a) ** 1.6,
        sustain + (1 - sustain) * np.exp(-np.linspace(0, 4, d)),
        np.full(s, sustain),
        sustain * np.exp(-np.linspace(0, 5, r)),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))


NOTES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(name):
    """'C4' -> 261.63 Hz"""
    step = NOTES[name[0]]
    octave = int(name[1:])
    midi = 12 * (octave + 1) + step
    return 440.0 * 2 ** ((midi - 69) / 12)


CHORDS = {
    "Cmaj":  ["C3", "G3", "C4", "E4", "G4"],
    "Fadd9": ["F3", "C4", "F4", "G4", "A4"],
    "Csus2": ["C3", "G3", "C4", "D4", "G4"],
    "Amin":  ["A2", "E3", "A3", "C4", "E4"],
    "G7":    ["G2", "D3", "G3", "B3", "F4"],
}


# ------------------------------------------------------------------ voices

def pad(chord, dur, gain, seed):
    """Warm sustained string/pad voice: detuned additive partials with drift."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = t_axis(n)
    left = np.zeros(n)
    right = np.zeros(n)

    for k, note in enumerate(chord):
        f0 = freq(note)
        # each note is 3 slightly detuned layers -> chorused, orchestral width
        for det, pan in ((-0.13, -1.0), (0.0, 0.0), (0.15, 1.0)):
            f = f0 * (1 + det / 100.0)
            vib = 1 + 0.0016 * np.sin(2 * np.pi * (4.1 + 0.7 * r.random()) * t + r.random() * 6.3)
            phase = 2 * np.pi * f * t * vib + r.random() * 6.3
            # partial mix: fundamental plus soft, quickly-thinning harmonics
            v = (np.sin(phase)
                 + 0.34 * np.sin(2 * phase + 0.4)
                 + 0.15 * np.sin(3 * phase + 1.1)
                 + 0.06 * np.sin(4 * phase + 2.0))
            # gentle amplitude breathing so it never sounds static
            v *= 1 + 0.09 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + r.random() * 6.3)
            # upper voices sit lower in the mix
            w = 1.0 / (1.0 + 0.55 * k)
            lg = np.sqrt(max(0.0, (1 - pan) / 2 + 0.5 * (pan == 0)))
            rg = np.sqrt(max(0.0, (1 + pan) / 2 + 0.5 * (pan == 0)))
            left += v * w * lg
            right += v * w * rg

    env = adsr(n, attack=1.1, decay=0.9, sustain=0.82, release=1.6)
    scale = gain / (len(chord) * 3)
    return np.stack([left * env * scale, right * env * scale], axis=1)


def bell(f0, dur, gain, pan=0.0, bright=1.0):
    """Struck bell / celesta tone from inharmonic partials."""
    n = int(dur * SR)
    t = t_axis(n)
    partials = [(1.0, 1.0, 1.0), (2.01, 0.42, 1.7), (2.76, 0.30, 2.2),
                (4.07, 0.16 * bright, 3.0), (5.43, 0.10 * bright, 3.8),
                (8.21, 0.05 * bright, 5.0)]
    sig = np.zeros(n)
    for ratio, amp, decay in partials:
        sig += amp * np.sin(2 * np.pi * f0 * ratio * t) * np.exp(-decay * t / (dur * 0.42))
    # soft mallet transient
    click = rng.standard_normal(n) * np.exp(-t * 420) * 0.05
    sig = (sig + click) * np.minimum(1.0, t * SR / 90)  # de-click the attack
    sig *= gain
    lg, rg = np.sqrt((1 - pan) / 2 + 0.5), np.sqrt((1 + pan) / 2 + 0.5)
    return np.stack([sig * lg / 1.2, sig * rg / 1.2], axis=1)


def block_bandpass(sig, centers, q=1.4):
    """Filter `sig` with a bandpass whose centre frequency sweeps over time.

    Implemented block-wise in the frequency domain: cheap, smooth, and good
    enough for whooshes and swells.
    """
    block = 2048
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(len(sig) + block)
    fbins = np.fft.rfftfreq(block, 1 / SR)
    nblocks = max(1, (len(sig) - 1) // hop + 1)
    for b in range(nblocks):
        i = b * hop
        chunk = np.zeros(block)
        piece = sig[i:i + block]
        chunk[:len(piece)] = piece
        fc = centers[min(int((i + hop) / max(1, len(sig)) * (len(centers) - 1)),
                         len(centers) - 1)]
        width = fc / q
        mask = np.exp(-0.5 * ((fbins - fc) / max(width, 30.0)) ** 2)
        out[i:i + block] += np.fft.irfft(np.fft.rfft(chunk * win) * mask, block)
    return out[:len(sig)]


def whoosh(dur, gain, rise=True):
    """Air movement for transitions."""
    n = int(dur * SR)
    t = t_axis(n)
    noise = rng.standard_normal(n)
    lo, hi = (400, 5200) if rise else (5200, 500)
    centers = np.linspace(lo, hi, 64) ** 1.0
    filtered = block_bandpass(noise, centers, q=1.1)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.7
    sig = filtered * env * gain
    # slight stereo decorrelation
    delay = int(0.006 * SR)
    right = np.concatenate([np.zeros(delay), sig[:-delay]])
    return np.stack([sig, right * 0.95], axis=1)


def pluck(f0, dur, gain, pan=0.0):
    """Soft harp-like pluck for the number-line jumps."""
    n = int(dur * SR)
    t = t_axis(n)
    sig = (np.sin(2 * np.pi * f0 * t)
           + 0.5 * np.sin(4 * np.pi * f0 * t)
           + 0.22 * np.sin(6 * np.pi * f0 * t))
    sig *= np.exp(-t * 6.5) * np.minimum(1.0, t * SR / 60)
    sig *= gain
    lg, rg = np.sqrt((1 - pan) / 2 + 0.5), np.sqrt((1 + pan) / 2 + 0.5)
    return np.stack([sig * lg / 1.2, sig * rg / 1.2], axis=1)


def swell(dur, gain):
    """Rising golden-energy swell: filtered noise plus an octave-up shimmer."""
    n = int(dur * SR)
    t = t_axis(n)
    noise = rng.standard_normal(n)
    centers = np.linspace(300, 4200, 64)
    air = block_bandpass(noise, centers, q=0.9)
    tone = np.sin(2 * np.pi * np.cumsum(np.linspace(180, 360, n)) / SR) * 0.35
    tone += np.sin(2 * np.pi * np.cumsum(np.linspace(360, 720, n)) / SR) * 0.18
    env = (np.clip(t / dur, 0, 1) ** 2.2)
    sig = (air * 0.8 + tone) * env * gain
    right = np.concatenate([np.zeros(int(0.004 * SR)), sig[:-int(0.004 * SR)]])
    return np.stack([sig, right], axis=1)


def impact(gain):
    """Warm low thump for the final resolution."""
    dur = 2.4
    n = int(dur * SR)
    t = t_axis(n)
    sweep = np.sin(2 * np.pi * np.cumsum(np.geomspace(105, 44, n)) / SR)
    body = sweep * np.exp(-t * 3.0)
    sub = np.sin(2 * np.pi * 41 * t) * np.exp(-t * 2.1) * 0.5
    air = rng.standard_normal(n) * np.exp(-t * 26) * 0.12
    sig = (body + sub + air) * gain
    return np.stack([sig, sig], axis=1)


def sparkle_cloud(dur, gain, count=26):
    """Scattered high bell dust for the finale sparkles."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    scale = [freq(x) for x in ("C6", "D6", "E6", "G6", "A6", "C7", "E7")]
    for _ in range(count):
        f = scale[rng.integers(0, len(scale))]
        t0 = rng.random() * (dur * 0.62)
        pan = rng.random() * 2 - 1
        b = bell(f, min(1.6, dur - t0), gain * (0.35 + 0.65 * rng.random()),
                 pan=pan, bright=1.3)
        i = idx(t0)
        m = min(len(b), n - i)
        if m > 0:
            out[i:i + m] += b[:m]
    return out


# ------------------------------------------------------------------- reverb

def make_ir(dur=2.6, decay=0.52, seed=7):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = t_axis(n)
    ir = r.standard_normal(n) * np.exp(-t / decay)
    # darken the tail so the hall sounds warm rather than fizzy
    k = 24
    ir = np.convolve(ir, np.hanning(k) / np.hanning(k).sum(), mode="same")
    pre = int(0.018 * SR)
    ir[:pre] *= np.linspace(0, 1, pre)
    return ir / np.abs(ir).sum() * 1.9


def reverb(stereo, wet=0.3):
    irL, irR = make_ir(seed=7), make_ir(seed=8)
    n = len(stereo) + len(irL)
    size = 1 << (n - 1).bit_length()
    out = np.zeros_like(stereo)
    for ch, ir in ((0, irL), (1, irR)):
        y = np.fft.irfft(np.fft.rfft(stereo[:, ch], size) * np.fft.rfft(ir, size), size)
        out[:, ch] = y[:len(stereo)]
    return stereo * (1 - wet) + out * wet


# --------------------------------------------------------------------- build

def load_vo(clip_id):
    """Read a narration clip and resample 22.05k mono -> 48k stereo."""
    path = VO[clip_id]["file"]
    with wave.open(path, "rb") as w:
        sr0 = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    n_out = int(len(data) * SR / sr0)
    x = np.linspace(0, len(data) - 1, n_out)
    mono = np.interp(x, np.arange(len(data)), data)
    # de-ess-ish gentle top rolloff + light compression so the read sits forward
    k = 3
    mono = np.convolve(mono, np.ones(k) / k, mode="same")
    mono = np.tanh(mono * 1.9) / 1.9
    return np.stack([mono, mono], axis=1)


def main():
    music = np.zeros((N, 2))
    fx = np.zeros((N, 2))
    voice = np.zeros((N, 2))

    a = TL["audio"]

    # --- harmonic bed -----------------------------------------------------
    chords = a["chords"]
    for i, (t0, name, gain) in enumerate(chords):
        t_end = chords[i + 1][0] + 1.8 if i + 1 < len(chords) else DUR + 1.0
        dur = min(t_end - t0, DUR - t0 + 2.0)
        if dur <= 0:
            continue
        add(music, pad(CHORDS[name], dur, gain * 0.155, seed=100 + i), t0)

    # a soft high shimmer pad joins for the finale
    add(music, pad(["C5", "E5", "G5"], DUR - 24.4, 0.055, seed=77), 24.4)

    # opening air, so the cold open breathes instead of sitting empty
    add(music, pad(["C4", "G4", "C5"], 7.0, 0.045, seed=55), 0.10)
    add(fx, swell(1.35, 0.055), 0.0)

    # each glowing numeral arrives on its own soft bell
    s = TL["scene"]
    add(fx, bell(freq("C5"), 2.6, 0.22, pan=-0.15), s["numberA"])
    add(fx, bell(freq("G5"), 2.6, 0.22, pan=0.30), s["numberB"])

    # the two groups sliding together
    for t0 in s["spheresA"] + s["spheresB"]:
        add(fx, bell(freq("E6"), 1.1, 0.055, pan=rng.random() * 1.4 - 0.7, bright=1.4), t0)

    # --- counting chimes: ascending C E G C ------------------------------
    for i, (t0, note) in enumerate(zip(a["chimes"], ["C5", "E5", "G5", "C6"])):
        pan = -0.5 + i * 0.33
        add(fx, bell(freq(note), 2.2, 0.30, pan=pan), t0)

    # --- equation glyph pings --------------------------------------------
    for i, (t0, note) in enumerate(zip(a["glyphPings"], ["G5", "A5", "C6", "D6", "E6"])):
        add(fx, bell(freq(note), 1.7, 0.15, pan=-0.35 + i * 0.18, bright=1.2), t0)

    # --- transitions ------------------------------------------------------
    for i, t0 in enumerate(a["whooshes"]):
        add(fx, whoosh(1.05, 0.16 if i else 0.13, rise=(i != 1)), t0 - 0.25)

    # --- number-line jumps ------------------------------------------------
    for t0, note in zip(a["jumps"], ["E5", "G5"]):
        add(fx, pluck(freq(note), 1.4, 0.26), t0)
    add(fx, bell(freq("C6"), 2.4, 0.26), TL["scene"]["landPulse"])

    # --- finale -----------------------------------------------------------
    add(fx, swell(2.0, 0.13), a["swell"])
    add(fx, impact(0.34), a["impact"])
    add(fx, sparkle_cloud(3.0, 0.085), a["impact"] - 0.1)

    # --- narration --------------------------------------------------------
    for clip_id, t0 in TL["vo"].items():
        add(voice, load_vo(clip_id) * 0.92, t0)

    # --- mix --------------------------------------------------------------
    music = reverb(music, wet=0.34)
    fx = reverb(fx, wet=0.30)
    voice_wet = reverb(voice, wet=0.07)

    # duck the bed under the narration so every word stays intelligible
    env = np.abs(voice).max(axis=1)
    k = int(0.09 * SR)
    env = np.convolve(env, np.hanning(k) / np.hanning(k).sum(), mode="same")
    env = env / max(env.max(), 1e-9)
    duck = 1.0 - 0.55 * np.clip(env * 2.6, 0, 1)
    duck = duck[:, None]

    mix = music * duck * 0.95 + fx * (0.35 + 0.65 * duck) + voice_wet * 1.0

    # global fade in / out
    fi = idx(0.6)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo0, fo1 = idx(TL["scene"]["fadeOut"][0] + 0.15), N
    mix[fo0:fo1] *= np.linspace(1, 0, fo1 - fo0)[:, None]

    # soft limiter + normalise to -1.0 dBFS
    mix = np.tanh(mix * 1.12) / 1.12
    peak = np.abs(mix).max()
    mix *= (10 ** (-1.0 / 20)) / max(peak, 1e-9)

    out = os.path.join(BUILD, "audio.wav")
    data = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"wrote {out}  ({len(data)/SR:.2f}s, peak {20*np.log10(peak):.1f} dBFS pre-norm)")


if __name__ == "__main__":
    main()
