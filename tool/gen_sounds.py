#!/usr/bin/env python3
"""Synthesizes all game sound effects and the background music loop.

Everything is generated from scratch (no third-party samples), written as
WAV and converted to OGG Vorbis with ffmpeg into assets/sounds/.

Usage: python3 tool/gen_sounds.py
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, attack=0.005, decay=0.2, total=None):
    """Fast attack, exponential decay envelope of n samples."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = np.exp(-t / max(decay, 1e-4))
    return a * d


def note_freq(n):
    """MIDI note -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def bell(freq, dur, decay=0.25, partials=((1, 1.0), (2.0, 0.35), (3.01, 0.15), (4.2, 0.06))):
    t = t_axis(dur)
    s = np.zeros_like(t)
    for mult, amp in partials:
        s += amp * np.sin(2 * np.pi * freq * mult * t) * np.exp(-t / (decay / mult ** 0.5))
    return s * np.clip(t / 0.003, 0, 1)


def mix_at(buf, sig, start):
    i = int(start * SR)
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[: end - i]
    return buf


def normalize(sig, peak=0.85):
    m = np.max(np.abs(sig)) or 1.0
    return sig / m * peak


def lowpass(sig, cutoff):
    # simple one-pole low-pass
    rc = 1.0 / (2 * np.pi * cutoff)
    alpha = (1 / SR) / (rc + 1 / SR)
    out = np.zeros_like(sig)
    acc = 0.0
    for i, x in enumerate(sig):
        acc += alpha * (x - acc)
        out[i] = acc
    return out


def save(name, sig, quality=4):
    sig = np.clip(sig, -1, 1)
    pcm = (sig * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-c:a', 'libvorbis', '-q:a', str(quality), dst], check=True)
    os.remove(tmp)
    print('wrote', dst, os.path.getsize(dst), 'bytes')


def sfx_pickup():
    dur = 0.11
    t = t_axis(dur)
    f = 520 + 380 * (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(phase) + 0.25 * np.sin(2 * phase)
    return normalize(s * env(len(t), 0.004, 0.045), 0.55)


def sfx_drop():
    dur = 0.16
    t = t_axis(dur)
    f = 210 * np.exp(-t * 9) + 90
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * env(len(t), 0.002, 0.05)
    rng = np.random.default_rng(1)
    click = lowpass(rng.standard_normal(len(t)), 2500) * env(len(t), 0.0005, 0.012)
    tick = np.sin(2 * np.pi * 1250 * t) * env(len(t), 0.001, 0.015) * 0.35
    return normalize(body + click * 1.6 + tick, 0.8)


def sfx_clear():
    dur = 0.75
    buf = np.zeros(int(SR * dur))
    for i, n in enumerate([84, 88, 91, 96]):  # C6 E6 G6 C7
        mix_at(buf, bell(note_freq(n), 0.6, decay=0.28) * (0.9 - i * 0.1), i * 0.035)
    rng = np.random.default_rng(2)
    t = t_axis(dur)
    shimmer = rng.standard_normal(len(t))
    shimmer = shimmer - lowpass(shimmer, 5000)
    buf += shimmer * env(len(t), 0.01, 0.12) * 0.18
    return normalize(buf, 0.8)


def sfx_combo():
    dur = 1.0
    buf = np.zeros(int(SR * dur))
    for i, n in enumerate([84, 88, 91, 96, 100]):  # C6 E6 G6 C7 E7
        mix_at(buf, bell(note_freq(n), 0.55, decay=0.3) * 0.8, i * 0.06)
    mix_at(buf, bell(note_freq(103), 0.5, decay=0.35) * 0.5, 0.33)
    return normalize(buf, 0.85)


def sfx_game_over():
    dur = 1.5
    buf = np.zeros(int(SR * dur))
    for i, n in enumerate([67, 64, 60, 55]):  # G4 E4 C4 G3
        f = note_freq(n)
        t = t_axis(0.55)
        tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
        s = tri * env(len(t), 0.01, 0.22 if i < 3 else 0.45)
        mix_at(buf, s * (0.8 if i < 3 else 1.0), i * 0.2)
    return normalize(lowpass(buf, 3000), 0.75)


def sfx_invalid():
    dur = 0.16
    t = t_axis(dur)
    f = 180 - 60 * (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    s = np.sign(np.sin(phase)) * 0.4 + np.sin(phase)
    return normalize(lowpass(s * env(len(t), 0.003, 0.05), 1200), 0.45)


def sfx_click():
    dur = 0.05
    t = t_axis(dur)
    s = np.sin(2 * np.pi * 1400 * t) * env(len(t), 0.0008, 0.012)
    return normalize(s, 0.5)


def sfx_new_best():
    dur = 1.3
    buf = np.zeros(int(SR * dur))
    for i, n in enumerate([72, 76, 79, 84]):
        mix_at(buf, bell(note_freq(n), 0.7, decay=0.35) * 0.8, i * 0.09)
    for n in [72, 76, 79, 84]:
        mix_at(buf, bell(note_freq(n), 0.9, decay=0.5) * 0.35, 0.42)
    return normalize(buf, 0.8)


def music_loop():
    """Gentle 8-bar loop: C - Am - F - G - C - Em - F - G at 100 BPM."""
    bpm = 100
    beat = 60 / bpm
    bar = beat * 4
    chords = [
        (48, [60, 64, 67]),  # C
        (45, [57, 60, 64]),  # Am
        (41, [57, 60, 65]),  # F
        (43, [55, 59, 62]),  # G
        (48, [60, 64, 67]),  # C
        (40, [55, 59, 64]),  # Em
        (41, [57, 60, 65]),  # F
        (43, [55, 59, 62]),  # G
    ]
    total = bar * len(chords)
    n = int(SR * total)
    buf = np.zeros(n + SR * 2)
    rng = np.random.default_rng(5)
    arp_pattern = [0, 1, 2, 1, 2, 0, 1, 2]
    melody = [76, 74, 72, 74, 76, 79, 77, 74]
    for b, (root, tones) in enumerate(chords):
        start = b * bar
        # Soft pad (slow attack sines, slightly detuned).
        t = t_axis(bar + 0.6)
        pad_env = np.clip(t / 0.5, 0, 1) * np.exp(-np.maximum(t - bar, 0) / 0.25)
        pad = np.zeros_like(t)
        for tone in tones:
            f = note_freq(tone)
            pad += np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t)
        mix_at(buf, pad * pad_env * 0.05, start)
        # Bass on beats 1 and 3.
        for k in (0, 2):
            tb = t_axis(beat * 1.8)
            f = note_freq(root)
            bass = (np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(4 * np.pi * f * tb)) * env(len(tb), 0.01, 0.5)
            mix_at(buf, bass * 0.22, start + k * beat)
        # Plucked arpeggio in eighth notes.
        for k, idx in enumerate(arp_pattern):
            tone = tones[idx] + 12
            pl = bell(note_freq(tone), 0.6, decay=0.18, partials=((1, 1.0), (2, 0.3), (3, 0.1)))
            mix_at(buf, pl * (0.12 + 0.02 * rng.random()), start + k * beat / 2)
        # Simple melody: one long note per bar, half-bar answer.
        mel = bell(note_freq(melody[b]), 1.4, decay=0.6, partials=((1, 1.0), (2, 0.2), (4, 0.05)))
        mix_at(buf, mel * 0.16, start)
        mel2 = bell(note_freq(melody[(b + 3) % len(melody)] - 5), 0.8, decay=0.4, partials=((1, 1.0), (2, 0.2)))
        mix_at(buf, mel2 * 0.09, start + 2.5 * beat)
    # Light echo for space.
    d = int(SR * beat * 0.75)
    echo = np.zeros_like(buf)
    echo[d:] = buf[:-d] * 0.28
    buf = buf + echo
    # Wrap the tail into the start so the loop is seamless.
    loop = buf[:n].copy()
    tail = buf[n:]
    loop[: len(tail)] += tail
    return normalize(loop, 0.7)


if __name__ == '__main__':
    save('pickup', sfx_pickup())
    save('drop', sfx_drop())
    save('clear', sfx_clear())
    save('combo', sfx_combo())
    save('game_over', sfx_game_over())
    save('invalid', sfx_invalid())
    save('click', sfx_click())
    save('new_best', sfx_new_best())
    save('music', music_loop(), quality=3)
