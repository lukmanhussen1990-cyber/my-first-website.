"""Playful-spooky music made with code: pizzicato walking bass, plucky string stabs, a wobbly
"ooo" theremin-like lead, a breathy spooky organ, finger snaps and a shaker.

`spooky_groove(...)` returns the stereo track for a whole reel. It follows a fixed tempo grid from
the first frame, stops dead at `stop_at` (midnight), plays a funny sting at `sting_at` and comes back
at the last bars so that the track ends exactly on a bar line (the reel loops cleanly).
"""
import numpy as np
from .dsp import (SR, TAU, n_of, t_axis, rng, curve, env_ad, env_ar, fade, mix_at, db, saturate, sine, saw, harmonic,
                  noise, lowpass, highpass, bandpass, biquad, karplus, reverb, pan, to_stereo, glide_tone, modal)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
        'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    """'D2' -> 73.42 Hz (A4 = 440)."""
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


# ---------------------------------------------------------------- instruments
def pizz_bass(f, dur=0.55, vel=1.0, seed=1):
    x = karplus(f, dur, decay=0.993, bright=0.35, seed=seed, pluck_pos=0.22)
    body = 0.6 * sine(f, dur) * env_ad(dur, 0.004, 0.18)        # round low end
    x = lowpass(x + body, 1800)
    return vel * x * env_ar(dur, 0.002, 0.08)


def pluck(f, dur=0.32, vel=1.0, seed=1):
    x = karplus(f, dur, decay=0.985, bright=0.55, seed=seed, pluck_pos=0.15)
    return vel * highpass(x, 120) * env_ar(dur, 0.001, 0.06)


def organ_pad(freqs, dur, vel=1.0, seed=1):
    t = t_axis(dur)
    out = np.zeros(len(t))
    for i, f in enumerate(freqs):
        fv = f * (1 + 0.004 * np.sin(TAU * (5.6 + 0.2 * i) * t + i))
        out += harmonic(fv, amps=(1.0, 0.65, 0.4, 0.3, 0, 0.18, 0, 0.12))
    out *= 1 - 0.18 * (0.5 + 0.5 * np.sin(TAU * 6.1 * t))          # slow leslie-ish wobble
    out = lowpass(out, 3200) / max(1, len(freqs))
    return vel * out * env_ar(dur, 0.12, min(0.5, dur * 0.4))


def ooo_lead(notes, seed=1):
    """Theremin-like 'ooo': notes = [(start, dur, hz), ...] played legato with portamento and delayed vibrato."""
    end = max(s + d for s, d, f in notes) + 0.4
    n = n_of(end)
    t = np.arange(n) / SR
    f = np.full(n, notes[0][2])
    amp = np.zeros(n)
    for s, d, fr in notes:
        i0, i1 = n_of(s), min(n, n_of(s + d))
        f[i0:] = fr
        a = np.zeros(n)
        tt = t[i0:i1] - s
        a[i0:i1] = np.clip(tt / 0.07, 0, 1) * np.clip((d - tt) / 0.12, 0, 1)
        amp = np.maximum(amp, a)
    # portamento: smooth the pitch steps; vibrato grows into each long note
    k = n_of(0.06)
    f = np.convolve(np.pad(f, (k, k), mode='edge'), np.ones(k) / k, mode='same')[k:-k]
    vib = 1 + 0.011 * np.sin(TAU * 5.4 * t) * np.clip(amp, 0, 1)
    ph = TAU * np.cumsum(f * vib) / SR
    x = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    x2 = np.sin(ph * 1.004 + 0.7)          # gentle chorus
    amp = np.convolve(amp, np.ones(n_of(0.02)) / n_of(0.02), mode='same')
    return lowpass((x + 0.4 * x2) * amp, 3500)


def snap(seed=1):
    d = 0.18
    t = t_axis(d)
    x = bandpass(noise(d, seed), 1400, 7000) * np.exp(-t / 0.012)
    x += 0.5 * modal(d, [(1150, 0.025, 1.0), (2300, 0.015, 0.4)], seed)
    return x


def shaker(seed=1, accent=1.0):
    d = 0.09
    t = t_axis(d)
    return accent * highpass(noise(d, seed), 6000) * np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.025)


def timp(f=73.4, dur=1.2, seed=1):
    t = t_axis(dur)
    x = sine(f * (1 + 0.08 * np.exp(-t / 0.05)), dur) * np.exp(-t / 0.45)
    x += 0.4 * sine(f * 1.5, dur) * np.exp(-t / 0.25)
    x += 0.3 * lowpass(noise(dur, seed), 600) * np.exp(-t / 0.04)
    return x


def slide_whistle(f0, f1, dur, seed=1):
    t = t_axis(dur)
    f = curve([(0, f0), (dur, f1)], dur, 'exp') * (1 + 0.01 * np.sin(TAU * 6 * t))
    return (sine(f) + 0.15 * sine(2 * f)) * env_ar(dur, 0.03, 0.12) + 0.03 * bandpass(noise(dur, seed), 2000, 6000) * env_ar(dur, 0.03, 0.12)


# ---------------------------------------------------------------- the piece
CHORDS = {   # bass walk (4 quarter notes), pluck stab voicing, organ voicing
    'Dm': (['D2', 'A1', 'D2', 'F2'], ['D4', 'F4', 'A4'], ['D3', 'A3', 'F4']),
    'Dm2': (['D2', 'F2', 'A2', 'C#2'], ['D4', 'F4', 'A4'], ['D3', 'A3', 'F4']),
    'Gm': (['G1', 'D2', 'G2', 'D2'], ['D4', 'G4', 'Bb4'], ['G2', 'D3', 'Bb3']),
    'Bb': (['Bb1', 'F2', 'Bb1', 'F2'], ['D4', 'F4', 'Bb4'], ['Bb2', 'F3', 'D4']),
    'A7': (['A1', 'E2', 'C#2', 'E2'], ['C#4', 'E4', 'G4'], ['A2', 'E3', 'G3', 'C#4']),
    'A7b': (['A1', 'C#2', 'E2', 'C#2'], ['C#4', 'E4', 'G4'], ['A2', 'E3', 'G3', 'C#4']),
    'climb1': (['D2', 'D#2', 'E2', 'F2'], ['D4', 'F4', 'A4'], ['D3', 'A3', 'F4']),
    'climb2': (['F#2', 'G2', 'G#2', 'A2'], ['C#4', 'E4', 'A4'], ['A2', 'E3', 'C#4']),
}
PROG_A = ['Dm', 'Dm2', 'Gm', 'Gm', 'Bb', 'A7', 'Dm', 'A7b']
# spooky lead phrases (beats from the bar start, length in beats, note)
MOTIFS = [
    [(0, 1, 'A4'), (1, 0.5, 'Bb4'), (1.5, 0.5, 'A4'), (2, 1, 'G#4'), (3, 1, 'A4'), (4, 2, 'D5'), (6, 1, 'C5'), (7, 1, 'A4')],
    [(0, 1.5, 'F4'), (1.5, 0.5, 'E4'), (2, 1, 'F4'), (3, 1, 'A4'), (4, 3, 'G#4'), (7, 1, 'E4')],
    [(0, 1, 'D5'), (1, 1, 'C5'), (2, 1, 'Bb4'), (3, 1, 'A4'), (4, 1.5, 'G#4'), (5.5, 0.5, 'A4'), (6, 2, 'E4')],
]


def spooky_groove(duration, stop_at=None, sting_at=None, hits=(), bpm=120.0, seed=11, end_bars=2):
    beat = 60.0 / bpm
    bar = 4 * beat
    total = n_of(duration + 3.0)
    bus = {k: np.zeros((total, 2)) for k in ('bass', 'pluck', 'organ', 'lead', 'perc', 'fx')}
    r = rng(seed)

    # where the music plays: [0, stop_at) and [resume, duration) — the resume lands so the track ends on a bar line
    resume = None
    if stop_at is not None and sting_at is not None:
        nb = int(np.floor((duration - (sting_at + 1.3)) / bar))
        nb = max(1, min(end_bars, nb))
        resume = duration - nb * bar
    segments = [(0.0, stop_at if stop_at is not None else duration, 0)]
    if resume is not None:
        segments.append((resume, duration, 1))

    def play(seg_start, seg_end, part):
        nbars = int(np.ceil((seg_end - seg_start) / bar)) + 1
        for b in range(nbars):
            t0 = seg_start + b * bar
            if t0 >= seg_end:
                break
            gbar = int(round(t0 / bar)) if part == 0 else 100 + b       # global bar index (for the arrangement)
            big = part == 0 and t0 >= 34.0 or part == 1                    # fuller after the mansion appears
            build = part == 0 and 30.0 <= t0 < 34.0
            if build:
                name = 'climb1' if t0 < 32.0 else 'climb2'
            elif part == 1:
                name = ['Dm', 'A7b'][b % 2] if nbars > 1 else 'Dm'
            else:
                name = PROG_A[gbar % len(PROG_A)]
            walk, stab, pad = CHORDS[name]
            for q in range(4):
                tq = t0 + q * beat
                if tq >= seg_end:
                    break
                mix_at(bus['bass'], pan(pizz_bass(hz(walk[q]), 0.5, 1.0 if q == 0 else 0.8, seed + gbar * 4 + q), 0.0), tq)
                if q in (1, 3):
                    for i, nn in enumerate(stab):
                        mix_at(bus['pluck'], pan(pluck(hz(nn), 0.3, 0.55, seed + 1000 + gbar * 8 + q * 3 + i), -0.35 + 0.35 * i), tq + 0.006 * i)
                    mix_at(bus['perc'], pan(snap(seed + gbar * 2 + q), 0.15), tq, 0.5)
                if big:
                    for e in range(2):
                        ts = tq + e * beat / 2
                        if ts < seg_end:
                            mix_at(bus['perc'], pan(shaker(seed + gbar * 16 + q * 2 + e, 1.0 if e else 0.6), 0.4), ts, 0.22)
            if gbar >= 2 or part == 1:
                L = min(bar, seg_end - t0)
                if L > 0.2:
                    mix_at(bus['organ'], pan(organ_pad([hz(n) for n in pad], L + 0.3, 1.0 if big else 0.6, seed + gbar), 0.0), t0)
            # the wobbly lead: every 4 bars (more often in the big section), never in the build
            if not build and part == 0 and gbar >= 4 and gbar % (2 if big else 4) == 0:
                mot = MOTIFS[(gbar // 4) % len(MOTIFS)]
                notes = [(s * beat, d * beat * 0.95, hz(n)) for s, d, n in mot if t0 + s * beat < seg_end]
                if notes:
                    mix_at(bus['lead'], pan(ooo_lead(notes, seed + gbar), 0.25), t0)

    for s, e, p in segments:
        play(s, e, p)

    # cartoon hits (the shed bouncing, the mansion popping up)
    for k, (t, size) in enumerate(hits):
        x = timp(hz('D2') if size > 1 else hz('A2'), 1.4, seed + 50 + k) * (1.0 if size > 1 else 0.6)
        if size > 1:
            x = x + 0.5 * organ_pad([hz(n) for n in ['D2', 'A2', 'D3', 'F3', 'A3']], 1.4, 1.0, seed + 60)
        mix_at(bus['fx'], pan(x, 0.0), t)

    mixes = {'bass': 1.0, 'pluck': 0.55, 'organ': 0.32, 'lead': 0.42, 'perc': 0.5, 'fx': 0.8}
    out = np.zeros((total, 2))
    for k, g in mixes.items():
        out += g * bus[k]
    # a little room
    wet = reverb(out[:, 0] * 0.5 + out[:, 1] * 0.5, 1.0, 1.4, 4500, seed=3)[:total]
    out = out * 0.85 + 0.22 * wet

    # stop dead at midnight (tails cut with a 15 ms fade), silence, then the sting and the comeback
    if stop_at is not None:
        i = n_of(stop_at)
        k = n_of(0.015)
        out[i:i + k] *= np.linspace(1, 0, k)[:, None]
        j = n_of(resume) if resume is not None else len(out)
        out[i + k:j] = 0
    if sting_at is not None:
        sting = np.zeros(n_of(1.6))
        org = organ_pad([hz(n) for n in ['D3', 'F3', 'G#3', 'B3', 'D4']], 0.9, 1.0, seed + 70)
        mix_at(sting, org, 0.0, 1.0)
        mix_at(sting, timp(hz('D2'), 1.2, seed + 71), 0.0, 0.9)
        mix_at(sting, slide_whistle(2100, 380, 0.75, seed + 72), 0.18, 0.55)
        st = reverb(sting, 0.25, 1.4, 5000, seed=4)
        mix_at(out, st, sting_at, 1.0)
    out = out[:n_of(duration)]
    out = fade_end(out, 0.02)
    peak = np.max(np.abs(out)) + 1e-9
    return out / peak * db(-3), {'resume': resume, 'bar': bar}


def fade_end(x, sec):
    k = n_of(sec)
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)[:, None]
    return x
