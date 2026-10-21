"""Synthesized background music: playful, adventurous cartoon groove (C major, 116 BPM).

Sections follow the 7 story beats; the music cuts dead at --stop (comedy timing before
Grandpa's line). Writes build/audio/music.wav (48 kHz stereo float).

    python audio/make_music.py [--stop 46.95] [--duration 50.5]
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dsp import SR, n_of, t_of, lp, hp, bp, modal, pan_st, add_at, synth_ir, convolve_st, limiter, lufs, db, midi_hz  # noqa: E402

REEL = Path(__file__).resolve().parent.parent
OUT = REEL / "build" / "audio" / "music.wav"
BPM = 116
BEAT = 60 / BPM
BAR = BEAT * 4

# chord = (root midi, [chord tones midi])
C, F, G, Am, Dm, E7, Em = (48, [60, 64, 67]), (53, [60, 65, 69]), (55, [62, 67, 71]), (57, [60, 64, 69]), (50, [62, 65, 69]), (52, [62, 64, 68]), (52, [59, 64, 67])
PROG = {
    "A": [C, F, G, C], "B": [Am, F, C, G], "D": [Am, E7, Am, Dm], "F": [F, C, Dm, G], "G": [C, F, G, C],
}
SECTIONS = [(0.0, "A"), (7.5, "B"), (14.5, "A"), (21.5, "D"), (29.0, "B"), (36.0, "F"), (41.5, "G")]


def section_at(t):
    s = SECTIONS[0][1]
    for t0, name in SECTIONS:
        if t >= t0 - 1e-6: s = name
    return s


def pluck(f, dur, bright=1.0, decay=0.35):
    n = n_of(dur); t = t_of(n); x = np.zeros(n)
    for k in range(1, 9):
        if f * k > 9000: break
        x += (1 / k ** (1.3 / bright)) * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (decay / (1 + 0.35 * k)))
    return x * (1 - np.exp(-t / 0.002))


def marimba(f, dur=0.6):
    n = n_of(dur)
    return modal(n, [(f, 0.42, 1.0), (f * 3.93, 0.07, 0.22), (f * 9.2, 0.02, 0.06)], att=0.0008)


def pizz(f, dur=0.16):
    n = n_of(dur); t = t_of(n); x = np.zeros(n)
    for k, a in [(1, 1.0), (2, 0.5), (3, 0.3), (4, 0.15), (5, 0.08)]:
        x += a * np.sin(2 * np.pi * f * k * t)
    return x * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.003))


def pad(freqs, dur, cutoff=1400):
    n = n_of(dur); t = t_of(n); x = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.004):
            for k in range(1, 12):
                if f * k > 6000: break
                x += np.sin(2 * np.pi * f * (1 + det) * k * t + k) / k
    x = lp(x, cutoff, 2)
    env = np.clip(t / 0.5, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return x * env


def kick(dur=0.35):
    n = n_of(dur); t = t_of(n)
    f = 48 + 90 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


def shaker(rng, dur=0.06, acc=1.0):
    n = n_of(dur); t = t_of(n)
    return hp(rng.standard_normal(n), 6500) * np.exp(-t / 0.018) * (1 - np.exp(-t / 0.004)) * acc


def woodblock(f=880):
    n = n_of(0.15)
    return modal(n, [(f, 0.03, 1.0), (f * 1.62, 0.02, 0.4)], att=0.0003)


def clap(rng):
    n = n_of(0.2); t = t_of(n)
    return bp(rng.standard_normal(n), 900, 4000) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.002))


MOTIFS = {  # 8th-note slots in a bar -> chord tone index (None = rest), playful patterns
    "A": [0, None, 1, 2, None, 1, 0, None],
    "B": [2, None, 2, 1, 0, None, 1, None],
    "D": [None, 0, None, None, 1, None, None, None],
    "F": [2, None, None, None, 1, None, None, None],
    "G": [0, 1, 2, None, 2, 1, 0, None],
}


def build(duration, stop):
    rng = np.random.default_rng(11)
    N = n_of(duration)
    L = n_of(min(duration, stop) + 2.0)
    mix = {k: np.zeros((L, 2)) for k in ("bass", "lead", "pizz", "pad", "drums", "glock")}
    nbars = int(np.ceil(stop / BAR)) + 1
    for b in range(nbars):
        bt = b * BAR
        if bt >= stop: break
        sec = section_at(bt + 0.01)
        prog = PROG[sec]
        root, tones = prog[b % 4]
        sneaky = sec == "D"; calm = sec == "F"
        # bass
        pattern = [(0, 0), (2, 7)] if not sneaky else [(0, 0), (1, 3), (2, 7), (3, 3)]
        for beat, iv in pattern:
            f = midi_hz(root - 12 + iv) if not sneaky else midi_hz(root - 12 + [0, 3, 7, 10][beat % 4] * 0 + iv)
            x = pluck(f, 0.5 if not sneaky else 0.22, bright=1.2, decay=0.4 if not sneaky else 0.12)
            add_at(mix["bass"], pan_st(x, 0.0) * (0.55 if calm else 1.0), n_of(bt + beat * BEAT))
        if not calm and not sneaky:  # pickup 8th
            add_at(mix["bass"], pan_st(pluck(midi_hz(root - 12 + 12), 0.3, decay=0.2) * 0.5, 0), n_of(bt + 3.5 * BEAT))
        # pizzicato chords on the off-beats
        if not calm:
            for beat in range(4):
                for k, m in enumerate(tones):
                    x = pizz(midi_hz(m), 0.18) * (0.32 if not sneaky else 0.4)
                    add_at(mix["pizz"], pan_st(x, -0.35 + 0.35 * k), n_of(bt + (beat + 0.5) * BEAT + 0.004 * k))
        # marimba lead motif (soft, mostly below the voice band)
        mot = MOTIFS[sec]
        for i, ti in enumerate(mot):
            if ti is None: continue
            if (b % 2 == 1) and i >= 6: continue  # variation
            m = tones[ti] + (12 if sec in ("B", "G") and b % 4 == 2 else 0)
            x = marimba(midi_hz(m), 0.7) * (0.55 if not calm else 0.45)
            add_at(mix["lead"], pan_st(x, 0.25), n_of(bt + i * BEAT / 2))
        # warm pad
        if calm or sec in ("B", "G", "A"):
            x = pad([midi_hz(m - 12) for m in tones], BAR + 0.4, 1200 if calm else 900) * (0.09 if calm else 0.035)
            add_at(mix["pad"], np.stack([x, np.roll(x, 211)], 1), n_of(bt))
        # glockenspiel sparkle in magical sections
        if sec == "B" and b % 2 == 0:
            for j, m in enumerate([tones[0] + 24, tones[1] + 24, tones[2] + 24]):
                add_at(mix["glock"], pan_st(marimba(midi_hz(m), 0.8) * 0.18, 0.5 - j * 0.4), n_of(bt + 3 * BEAT + j * BEAT / 4))
        # drums
        if not calm:
            for beat in range(4):
                if not sneaky and beat in (0, 2):
                    add_at(mix["drums"], pan_st(kick() * 0.9, 0), n_of(bt + beat * BEAT))
                if not sneaky and beat in (1, 3):
                    add_at(mix["drums"], pan_st(clap(rng) * 0.25, 0.1), n_of(bt + beat * BEAT))
                for s16 in range(4):
                    acc = 1.0 if s16 == 2 else 0.55
                    add_at(mix["drums"], pan_st(shaker(rng, acc=acc) * 0.22, 0.4), n_of(bt + (beat + s16 / 4) * BEAT))
            wbs = [(3.5, 880)] if not sneaky else [(0, 1200), (1, 900), (2, 1200), (3, 900)]
            for pos, f in wbs:
                add_at(mix["drums"], pan_st(woodblock(f) * (0.35 if sneaky else 0.3), -0.3), n_of(bt + pos * BEAT))
        else:
            add_at(mix["drums"], pan_st(shaker(rng, acc=0.6) * 0.12, 0.4), n_of(bt + 2.5 * BEAT))
    gains = {"bass": 1.0, "lead": 0.8, "pizz": 0.55, "pad": 1.0, "drums": 0.75, "glock": 0.7}
    out = sum(mix[k] * g for k, g in gains.items())
    # duck the 1-3 kHz voice band a little (music lives under the narration)
    out = out - 0.35 * bp(out, 1200, 3200)
    ir = synth_ir(rt60=0.9, predelay=0.015, lp_hz=5000, seed=5)
    out = out + 0.18 * convolve_st(out, ir)
    # loudness ~ -18 LUFS, limit
    g = 10 ** ((-18 - lufs(out[:n_of(stop)])) / 20)
    out = limiter(out * g, -1.5)
    # hard stop (5 ms de-click) and pad to duration
    s = n_of(stop); ramp = n_of(0.005)
    res = np.zeros((N, 2))
    m = min(s, N, len(out))
    res[:m] = out[:m]
    res[max(0, m - ramp):m] *= np.linspace(1, 0, min(ramp, m))[:, None]
    return res


def main():
    tl = json.loads((REEL / "timeline.json").read_text())
    ap = argparse.ArgumentParser()
    ap.add_argument("--stop", type=float, default=tl["music"]["stop"])
    ap.add_argument("--duration", type=float, default=tl["duration"])
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    x = build(a.duration, a.stop)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(a.out, x.astype(np.float32), SR, subtype="FLOAT")
    after = np.max(np.abs(x[n_of(a.stop):])) if n_of(a.stop) < len(x) else 0
    print(f"wrote {a.out}: {len(x) / SR:.2f}s, stop {a.stop:.2f}s, {lufs(x[:n_of(a.stop)]):.1f} LUFS, peak {db(np.max(np.abs(x))):.1f} dBFS, after-stop peak {after:.1e}")


if __name__ == "__main__":
    main()
