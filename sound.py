#!/usr/bin/env python3
"""Music and sound effects, synthesised from scratch with numpy (no samples needed).

  audio/music.wav   soft dark piano + string pad + low heartbeat, exactly as long as the reel;
                    after the big lie (the "boom" cue) the pulse speeds up and a tense high
                    note creeps in.
  audio/sfx/*.wav   whoosh, whoosh2, ding, zap, boom
  audio/sfx.wav     every cue from scenes/timeline.json placed on the timeline
                    (a whoosh on each cut, a ding on each stat card, ...)

build.sh mixes these under the narration (music at plan.audio.music_db, e.g. -18 dB).
To use a royalty-free track instead, drop it in assets/music.mp3 - it is used as-is.
"""
import json
import subprocess
import wave

import numpy as np

from story import AUDIO, ROOT

SR = 44100
rng = np.random.default_rng(11)
SFX_DIR = AUDIO / "sfx"


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def filt(x, lo=None, hi=None, order=2):
    """Zero-phase Butterworth-shaped band filter done in the frequency domain."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi:
        g /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * g, len(x))


def reverb(x, seconds=2.6, mix=.35, seed=0):
    r = np.random.default_rng(seed)
    t = tt(seconds)
    ir = r.standard_normal(len(t)) * np.exp(-t / (seconds / 6.5))
    ir = filt(ir, hi=5000)
    ir[0] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    n = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]
    return x * (1 - mix) + wet * mix * 3


def write_wav(x, path):
    x = np.atleast_2d(x)
    if x.shape[0] < x.shape[1]:
        x = x.T
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def norm(x, peak_db=-1.0):
    return x * (10 ** (peak_db / 20) / (np.max(np.abs(x)) + 1e-9))


# ------------------------------------------------------------------ music --
def piano(f, dur=3.5, vel=1.0):
    t = tt(dur)
    out = np.zeros_like(t)
    for k, amp in enumerate([1, .45, .25, .14, .08, .05, .03], 1):
        fk = f * k * (1 + .00035 * k * k)
        out += amp * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * np.exp(-t / (2.4 / (1 + .7 * (k - 1))))
    out *= np.minimum(1, t / .005)
    out += rng.standard_normal(len(t)) * np.exp(-t / .01) * .015
    return out * vel


def pad(notes, dur, attack=1.4):
    t = tt(dur)
    out = np.zeros_like(t)
    for n in notes:
        for det in (-.09, 0, .1):
            fr = midi(n) * 2 ** (det / 12)
            lfo = 1 + .002 * np.sin(2 * np.pi * rng.uniform(.1, .3) * t)
            for k in range(1, 6):
                out += (.8 ** k / k) * np.sin(2 * np.pi * fr * k * t * lfo + rng.uniform(0, 6.28))
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / attack)
    return out * env


def thump(dur=.5):
    t = tt(dur)
    f = 58 * np.exp(-t / .25) + 38
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12)


def add(buf, x, at):
    i = int(at * SR)
    if i < 0:
        x, i = x[-i:], 0
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n]


def music(total, lie_t):
    n = int(total * SR) + SR
    pads, keys, low = np.zeros(n), np.zeros(n), np.zeros(n)
    chords = [  # A minor: Am  Fmaj7  Dm  E(sus)
        ([45, 52, 57, 60, 64], [69, 72, 76, 72, 81]),
        ([41, 48, 57, 60, 64], [69, 72, 76, 77, 72]),
        ([38, 50, 57, 62, 65], [69, 74, 77, 74, 81]),
        ([40, 52, 56, 59, 64], [68, 71, 76, 71, 74]),
    ]
    step = 4.0
    rhythm = [0, 1.0, 1.5, 2.5, 3.0]
    i, t = 0, 0.0
    while t < total:
        notes, arp = chords[i % 4]
        add(pads, pad(notes, step + 1.6), t - .3)
        add(keys, piano(midi(notes[0] - 12), 4.5, .9), t)
        for r, m in zip(rhythm, arp):
            add(keys, piano(midi(m), 3.2, rng.uniform(.35, .6)), t + r + rng.uniform(-.01, .01))
        i, t = i + 1, t + step
    beat = 1.6
    t = .4
    while t < total:
        fast = t > lie_t
        add(low, thump() * (1.0 if fast else .7), t)
        add(low, thump() * (.55 if fast else .35), t + .28)
        t += .95 if fast else beat
    tense = np.zeros(n)
    if lie_t < total:
        d = total - lie_t + 1
        tt_ = tt(d)
        tone = sum(np.sin(2 * np.pi * midi(m) * tt_ * (1 + .003 * np.sin(2 * np.pi * 5 * tt_))) for m in (81, 82))
        add(tense, tone * np.minimum(1, tt_ / 3) * .12, lie_t)
    pads = filt(pads, lo=60, hi=1300) * .07
    keys = filt(keys, hi=6000) * .22
    low = filt(low, hi=180) * .55
    mixL = reverb(pads + keys * 1.0 + tense, mix=.45, seed=1) + low
    mixR = reverb(pads + keys * .9 + tense, mix=.45, seed=2) + low
    out = np.stack([mixL, mixR])[:, :int(total * SR)]
    fade_in, fade_out = int(1.5 * SR), int(2.5 * SR)
    out[:, :fade_in] *= np.linspace(0, 1, fade_in)
    out[:, -fade_out:] *= np.linspace(1, 0, fade_out)
    rms = np.sqrt(np.mean(out ** 2))
    out *= 10 ** (-16 / 20) / rms                      # full-level bed (~-16 dBFS RMS)
    return np.clip(out, -.98, .98)


# -------------------------------------------------------------------- sfx --
def svf_bandpass(x, fc, q=2.5):
    """State-variable band-pass with a moving centre frequency fc[i] (short sounds only)."""
    low = band = 0.0
    out = np.empty_like(x)
    damp = 1 / q
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        out[i] = band
    return out


def whoosh(dur=.75, f0=350, f1=2600, f2=650, peak=.42):
    t = tt(dur)
    k = t / dur
    fc = np.where(k < peak, f0 * (f1 / f0) ** (k / peak), f1 * (f2 / f1) ** ((k - peak) / (1 - peak)))
    noise = rng.standard_normal(len(t))
    x = svf_bandpass(noise, fc, 1.8) + .35 * svf_bandpass(noise, fc * 1.9, 3)
    env = np.where(k < peak, (k / peak) ** 2.2, np.exp(-(k - peak) / .14))
    x *= env
    pan = np.clip(k * 1.4 - .2, 0, 1)
    return norm(np.stack([x * np.cos(pan * np.pi / 2), x * np.sin(pan * np.pi / 2)]), -3)


def ding():
    t = tt(1.6)
    x = sum(a * np.sin(2 * np.pi * 1318.5 * r * t) * np.exp(-t / d)
            for r, a, d in ((1, 1, .9), (2.0, .3, .45), (2.76, .25, .3), (5.4, .08, .15)))
    x = x * np.minimum(1, t / .003)
    x = reverb(x, 1.2, .25, 5)
    return norm(np.stack([x, x]), -3)


def zap():
    t = tt(.32)
    f = 1900 * np.exp(-t / .07) + 260
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .09)
    x += filt(rng.standard_normal(len(t)), lo=2000) * np.exp(-t / .015) * .4
    return norm(np.stack([x, x * .9]), -6)


def boom():
    t = tt(2.6)
    f = 70 * np.exp(-t / .5) + 32
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .7)
    x += filt(rng.standard_normal(len(t)), hi=400) * np.exp(-t / .06) * .9
    x = np.tanh(x * 2.2) / 2.2
    x = reverb(x, 2.4, .3, 9)
    return norm(np.stack([x, x]), -1)


SFX = {"whoosh": (lambda: whoosh(), -5, .31),
       "whoosh2": (lambda: whoosh(.55, 500, 3200, 900, .5), -9, .27),
       "whoosh_text": (lambda: whoosh(.45, 1200, 5200, 2200, .35), -14, .16),
       "ding": (ding, -5, 0),
       "zap": (zap, -17, 0),
       "boom": (boom, -1, 0)}


def main():
    timeline = json.loads((ROOT / "scenes" / "timeline.json").read_text())
    total = timeline["total"]
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    sounds = {}
    for name, (make, gain_db, lead) in SFX.items():
        sounds[name] = make()
        write_wav(sounds[name], SFX_DIR / f"{name}.wav")

    track = np.zeros((2, int(total * SR) + SR))
    for c in timeline["cues"]:
        make, gain_db, lead = SFX[c["sfx"]]
        x = sounds[c["sfx"]] * 10 ** (gain_db / 20)
        i = max(0, int((c["t"] - lead) * SR))   # lead: line the loudest point up with the cue
        n = min(x.shape[1], track.shape[1] - i)
        track[:, i:i + n] += x[:, :n]
    write_wav(np.clip(track[:, :int(total * SR)], -1, 1), AUDIO / "sfx.wav")

    own = ROOT / "assets" / "music.mp3"
    if own.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", str(own), "-t", str(total),
                        "-ar", str(SR), "-ac", "2", str(AUDIO / "music.wav")], check=True)
        print("music: assets/music.mp3")
    else:
        lie = next((c["t"] for c in timeline["cues"] if c["sfx"] == "boom"), total)
        write_wav(music(total, lie), AUDIO / "music.wav")
        print("music: synthesised dark piano bed")
    print(f"audio/music.wav, audio/sfx.wav ({len(timeline['cues'])} cues), audio/sfx/*.wav")


if __name__ == "__main__":
    main()
