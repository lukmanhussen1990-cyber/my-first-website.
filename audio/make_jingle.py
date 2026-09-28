"""Synthesize an extended "Jingle Bells" Christmas jingle and save it as MP3.

Structure: sleigh-bell intro -> verse -> chorus -> verse -> chorus (with
harmony) -> key change chorus -> outro. About 2.5 minutes, stereo.

Requires: pip install numpy lameenc
Run:      python3 audio/make_jingle.py
"""
import os
import numpy as np
import lameenc

SR = 44100
BPM = 132
BEAT = 60.0 / BPM
BAR = 4

SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SCALE = [n + o for o in "345" for n in "CDEFGAB"]  # C major, for harmony


def freq(name, transpose=0):
    midi = 12 * (int(name[1]) + 1) + SEMITONES[name[0]] + transpose
    return 440.0 * 2 ** ((midi - 69) / 12)


def third_below(name):
    return SCALE[SCALE.index(name) - 2]


# (note, beats)
VERSE = [
    ("G4", 1), ("E5", 1), ("D5", 1), ("C5", 1), ("G4", 3), ("G4", 0.5), ("G4", 0.5),
    ("G4", 1), ("E5", 1), ("D5", 1), ("C5", 1), ("A4", 4),
    ("A4", 1), ("F5", 1), ("E5", 1), ("D5", 1), ("B4", 4),
    ("G5", 1), ("G5", 1), ("F5", 1), ("D5", 1), ("E5", 4),
    ("G4", 1), ("E5", 1), ("D5", 1), ("C5", 1), ("G4", 4),
    ("G4", 1), ("E5", 1), ("D5", 1), ("C5", 1), ("A4", 3), ("A4", 1),
    ("A4", 1), ("F5", 1), ("E5", 1), ("D5", 1), ("G5", 1), ("G5", 1), ("G5", 1), ("G5", 1),
    ("A5", 1), ("G5", 1), ("F5", 1), ("D5", 1), ("C5", 2), ("G5", 2),
]
VERSE_BASS = ["C4", "C4", "C4", "F4", "F4", "G4", "G4", "C4",
              "C4", "C4", "C4", "F4", "F4", "G4", "G4", "C4"]

CHORUS = [
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
CHORUS_BASS = ["C4", "C4", "C4", "C4", "F4", "C4", "D4", "G4",
               "C4", "C4", "C4", "C4", "F4", "C4", "G4", "C4"]

# (melody, bass, harmony?, transpose in semitones)
SONG = [
    (VERSE, VERSE_BASS, False, 0),
    (CHORUS, CHORUS_BASS, False, 0),
    (VERSE, VERSE_BASS, True, 0),
    (CHORUS, CHORUS_BASS, True, 0),
    (CHORUS, CHORUS_BASS, True, 2),  # key change up to D
]
INTRO_BARS = 2
OUTRO_BARS = 3


def bell(f, dur):
    """Bell tone: inharmonic partials with fast exponential decay."""
    t = np.arange(int(SR * dur)) / SR
    partials = [(1.0, 1.0, 3.0), (2.0, 0.5, 4.5), (2.76, 0.35, 6.0),
                (5.4, 0.2, 9.0), (8.93, 0.1, 12.0)]
    out = sum(a * np.exp(-d * t) * np.sin(2 * np.pi * f * r * t)
              for r, a, d in partials)
    return out * np.minimum(1.0, t / 0.003)


def soft_tone(f, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1.0, t / 0.02) * np.exp(-2.0 * t)
    return env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t))


RNG = np.random.default_rng(7)


def sleigh_shake(dur=0.12):
    """Sleigh bells: high-passed noise burst with metallic ringing."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = np.diff(RNG.standard_normal(n), prepend=0)  # crude high-pass
    ring = sum(np.sin(2 * np.pi * f * t) for f in (5200, 6300, 7700, 9100))
    return (0.6 * noise + 0.4 * ring * RNG.uniform(0.5, 1, n)) * np.exp(-30 * t)


def mix_in(buf, sig, start, gain, pan=0.0):
    """Add a mono signal into the stereo buffer; pan -1 (left) .. 1 (right)."""
    i = int(start * SR)
    end = min(len(buf), i + len(sig))
    s = sig[: end - i] * gain
    buf[i:end, 0] += s * np.sqrt((1 - pan) / 2)
    buf[i:end, 1] += s * np.sqrt((1 + pan) / 2)


def main():
    song_beats = sum(len(bass) * BAR for _, bass, _, _ in SONG)
    total_beats = (INTRO_BARS + OUTRO_BARS) * BAR + song_beats
    length = total_beats * BEAT + 3.0
    buf = np.zeros((int(SR * length), 2))

    # Sleigh bells on every eighth note from intro through the last chorus
    shake_end = (INTRO_BARS * BAR + song_beats) * 2
    for k in range(shake_end):
        gain = 0.18 if k % 2 == 0 else 0.10
        mix_in(buf, sleigh_shake(), k * BEAT / 2, gain, pan=-0.3 if k % 2 else 0.3)

    # Intro: rising bell arpeggio
    for i, n in enumerate(["C5", "E5", "G5", "C5"]):
        f = freq(n) * (2 if i == 3 else 1)
        mix_in(buf, bell(f, 2.0), (i * 2 + 0.5) * BEAT, 0.25)

    beat = INTRO_BARS * BAR
    for melody, bass, harmony, tr in SONG:
        pos = beat
        for note, beats in melody:
            mix_in(buf, bell(freq(note, tr), 2.0), pos * BEAT, 0.35)
            if harmony:
                mix_in(buf, bell(freq(third_below(note), tr), 2.0), pos * BEAT, 0.16, pan=0.4)
            pos += beats
        for bar, root in enumerate(bass):
            f = freq(root, tr) / 2
            start = beat + bar * BAR
            mix_in(buf, soft_tone(f, BEAT * 2), start * BEAT, 0.25, pan=-0.2)
            mix_in(buf, soft_tone(f * 1.5, BEAT * 2), (start + 2) * BEAT, 0.18, pan=-0.2)
        beat += len(bass) * BAR

    # Outro: slowing sleigh shakes and a descending bell cascade in D
    t = beat * BEAT
    for k in range(10):
        mix_in(buf, sleigh_shake(), t, 0.16 * (1 - k / 12), pan=0.3 if k % 2 else -0.3)
        t += BEAT / 2 * (1 + k * 0.15)
    for i, n in enumerate(["G5", "E5", "D5", "C5"]):
        mix_in(buf, bell(freq(n, 2), 2.5), (beat + i) * BEAT, 0.3, pan=0.2 * (i - 1.5))
    mix_in(buf, bell(freq("C5", 2) * 2, 3.0), (beat + 5) * BEAT, 0.25)
    mix_in(buf, soft_tone(freq("C4", 2) / 2, 4.0), (beat + 5) * BEAT, 0.25)

    # Fade out and normalize
    fade = int(SR * 2.5)
    buf[-fade:] *= np.linspace(1, 0, fade)[:, None]
    buf = buf / np.max(np.abs(buf)) * 0.9
    pcm = (buf * 32767).astype(np.int16)

    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    mp3 = enc.encode(pcm.tobytes()) + enc.flush()

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "christmas-jingle-bells.mp3")
    with open(out, "wb") as f:
        f.write(mp3)
    print(f"Wrote {out} ({len(mp3) / 1024:.0f} KB, {length:.1f}s)")


if __name__ == "__main__":
    main()
