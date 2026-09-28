"""Synthesize a short "Jingle Bells" Christmas jingle and save it as MP3.

Requires: pip install numpy lameenc
Run:      python3 audio/make_jingle.py
"""
import os
import numpy as np
import lameenc

SR = 44100
BPM = 132
BEAT = 60.0 / BPM

NOTES = {"C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00,
         "A4": 440.00, "B4": 493.88, "C5": 523.25, "D5": 587.33, "E5": 659.25,
         "F5": 698.46, "G5": 783.99}

# (note, beats) — chorus of "Jingle Bells", an octave up for a bright bell sound
MELODY = [
    ("E5", 1), ("E5", 1), ("E5", 2),
    ("E5", 1), ("E5", 1), ("E5", 2),
    ("E5", 1), ("G5", 1), ("C5", 1.5), ("D5", 0.5), ("E5", 4),
    ("F5", 1), ("F5", 1), ("F5", 1.5), ("F5", 0.5),
    ("F5", 1), ("E5", 1), ("E5", 1), ("E5", 0.5), ("E5", 0.5),
    ("E5", 1), ("D5", 1), ("D5", 1), ("E5", 1), ("D5", 2), ("G5", 2),
    ("E5", 1), ("E5", 1), ("E5", 2),
    ("E5", 1), ("E5", 1), ("E5", 2),
    ("E5", 1), ("G5", 1), ("C5", 1.5), ("D5", 0.5), ("E5", 4),
    ("F5", 1), ("F5", 1), ("F5", 1.5), ("F5", 0.5),
    ("F5", 1), ("E5", 1), ("E5", 1), ("E5", 0.5), ("E5", 0.5),
    ("G5", 1), ("G5", 1), ("F5", 1), ("D5", 1), ("C5", 4),
]

# Simple bass/chord roots per bar (4 beats each)
BASS = ["C4", "C4", "C4", "C4", "F4", "C4", "D4", "G4",
        "C4", "C4", "C4", "C4", "F4", "C4", "G4", "C4"]


def bell(freq, dur):
    """Bell tone: inharmonic partials with fast exponential decay."""
    t = np.arange(int(SR * dur)) / SR
    partials = [(1.0, 1.0, 3.0), (2.0, 0.5, 4.5), (2.76, 0.35, 6.0),
                (5.4, 0.2, 9.0), (8.93, 0.1, 12.0)]
    out = sum(a * np.exp(-d * t) * np.sin(2 * np.pi * freq * r * t)
              for r, a, d in partials)
    attack = np.minimum(1.0, t / 0.003)
    return out * attack


def soft_tone(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1.0, t / 0.02) * np.exp(-2.0 * t)
    return env * (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t))


def sleigh_shake(dur=0.12, rng=np.random.default_rng(7)):
    """Sleigh bells: high-passed noise burst with metallic ringing."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # crude high-pass
    ring = sum(np.sin(2 * np.pi * f * t) for f in (5200, 6300, 7700, 9100))
    env = np.exp(-30 * t)
    return (0.6 * noise + 0.4 * ring * rng.uniform(0.5, 1, n)) * env


def mix_in(buf, sig, start, gain):
    i = int(start * SR)
    end = min(len(buf), i + len(sig))
    buf[i:end] += gain * sig[: end - i]


def main():
    total_beats = sum(b for _, b in MELODY)
    length = total_beats * BEAT + 2.5
    buf = np.zeros(int(SR * length))

    # Melody bells
    pos = 0.0
    for note, beats in MELODY:
        mix_in(buf, bell(NOTES[note], 2.0), pos * BEAT, 0.35)
        pos += beats

    # Bass line
    for bar, root in enumerate(BASS):
        f = NOTES[root] / 2
        mix_in(buf, soft_tone(f, BEAT * 2), (bar * 4) * BEAT, 0.25)
        mix_in(buf, soft_tone(f * 1.5, BEAT * 2), (bar * 4 + 2) * BEAT, 0.18)

    # Sleigh bells on every eighth note, accented on beats
    for k in range(int(total_beats * 2)):
        gain = 0.18 if k % 2 == 0 else 0.10
        mix_in(buf, sleigh_shake(), k * BEAT / 2, gain)

    # Final shimmer
    mix_in(buf, bell(NOTES["C5"] * 2, 2.5), total_beats * BEAT, 0.2)

    # Fade out and normalize
    fade = int(SR * 1.5)
    buf[-fade:] *= np.linspace(1, 0, fade)
    buf = buf / np.max(np.abs(buf)) * 0.9
    pcm = (buf * 32767).astype(np.int16)

    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(pcm.tobytes()) + enc.flush()

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "christmas-jingle-bells.mp3")
    with open(out, "wb") as f:
        f.write(mp3)
    print(f"Wrote {out} ({len(mp3) / 1024:.0f} KB, {length:.1f}s)")


if __name__ == "__main__":
    main()
