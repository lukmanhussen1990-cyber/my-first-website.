"""Code-made sound effects for the Larry & John reels.

Every effect is a recipe (a small function) that returns a stereo float array at 48 kHz.
`make(name)` builds one; unknown names fall back to a soft generic whoosh so a typo never
silences a cue (the mixer reports them). Nothing here is sampled or downloaded.
"""
import numpy as np
from .dsp import (SR, TAU, n_of, t_axis, rng, curve, env_ad, env_ar, fade, seq, mix_at, db, normalize, saturate,
                  sine, saw, square, triangle, harmonic, noise, crackle, lowpass, highpass, bandpass, biquad,
                  sweep_filter, eq, modal, resonate, karplus, glide_tone, reverb, echo, to_stereo, pan, pan_sweep)
from .voice import syllable, phrase, breath_noise

RECIPES = {}


def sfx(*names):
    def deco(fn):
        for n in names:
            RECIPES[n] = fn
        return fn
    return deco


def make(name, seed=0):
    fn = RECIPES.get(name)
    x = fn(name, seed) if fn else whoosh(0.4, 600, 2400, 900, seed=seed + 5) * 0.4
    x = to_stereo(np.nan_to_num(np.asarray(x, float)))
    x = np.stack([fade(x[:, c], 0.001, 0.01) for c in range(2)], 1)
    peak = np.max(np.abs(x)) + 1e-12
    return x * (db(-3) / peak)


# ---------------------------------------------------------------- generic builders
def whoosh(dur, f0, fpeak, f1, q=1.2, seed=1, color='pink', flutter=0.0):
    n = n_of(dur)
    t = np.arange(n) / SR
    x = noise(dur, seed, color)
    fc = np.where(t < dur * 0.45, f0 * (fpeak / f0) ** (t / (dur * 0.45)), fpeak * (f1 / fpeak) ** ((t - dur * 0.45) / (dur * 0.55)))
    y = sweep_filter(x, 'bp', fc, q)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    if flutter:
        e *= 1 - flutter * (0.5 + 0.5 * np.sin(TAU * 24 * t))
    return y * e


def thud(dur=0.25, f=70, fdrop=2.0, decay=0.09, noise_amt=0.35, nlp=900, seed=1):
    t = t_axis(dur)
    fr = f * (1 + (fdrop - 1) * np.exp(-t / 0.02))
    body = sine(fr) * np.exp(-t / decay)
    nz = lowpass(noise(dur, seed), nlp) * np.exp(-t / (decay * 0.4)) * noise_amt * 4
    return body + nz


def knock(dur=0.18, modes=((220, 0.05, 1.0), (470, 0.035, 0.6), (1100, 0.02, 0.35)), click=0.25, seed=1):
    t = t_axis(dur)
    x = modal(dur, modes, seed)
    x += click * highpass(noise(dur, seed + 3), 1500) * np.exp(-t / 0.004)
    return x


def metal(dur=1.0, f=520, ratios=(1, 2.47, 4.25, 6.1, 8.2), decay=0.6, seed=1, click=0.3):
    modes = [(f * r, decay / (1 + 0.35 * i), 1 / (1 + 0.6 * i)) for i, r in enumerate(ratios)]
    x = modal(dur, modes, seed)
    t = t_axis(dur)
    return x + click * highpass(noise(dur, seed + 1), 2000) * np.exp(-t / 0.003)


def crunch_burst(dur=0.12, rate=900, lo=900, hi=6500, seed=1, decay=0.0007):
    t = t_axis(dur)
    x = bandpass(crackle(dur, rate, seed, decay), lo, hi)
    x += 0.4 * bandpass(noise(dur, seed + 1), 800, 3000) * np.exp(-t / 0.03)
    return x * np.exp(-t / (dur * 0.45))


def creak(dur=0.8, rate=(60, 140, 90), body=((320, 6, 1.0), (820, 8, 0.6), (1600, 10, 0.3)), seed=1, roughness=0.3):
    """Friction creak: stick-slip pulses at a wandering rate through resonant bodies."""
    n = n_of(dur)
    r = rng(seed)
    t = np.arange(n) / SR
    rate_c = curve([(0, rate[0]), (dur * 0.5, rate[1]), (dur, rate[2])], dur, 'exp')
    rate_c = rate_c * (1 + 0.15 * lowpass(r.standard_normal(n), 8, 1) / 0.05)
    ph = np.cumsum(rate_c) / SR
    pulses = np.diff(np.floor(ph), prepend=0)
    pulses *= r.uniform(1 - roughness, 1, n)
    x = resonate(pulses, body) * 3
    return x * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6


def chirp_seq(times, f0, f1, dur, amp=1.0, total=None):
    total = total or (max(times) + dur + 0.05)
    out = np.zeros(n_of(total))
    for tt in times:
        c = glide_tone(f0, f1, dur) * env_ar(dur, 0.005, dur * 0.5)
        mix_at(out, c, tt, amp)
    return out


def steps(times, kind='soft', seed=1, total=None):
    total = total or max(times) + 0.3
    out = np.zeros(n_of(total))
    r = rng(seed)
    for i, tt in enumerate(times):
        if kind == 'soft':
            s = thud(0.12, 90 + r.uniform(-10, 10), 1.6, 0.03, 0.6, 1200, seed + i) * 0.7
            s[:n_of(0.12)] += 0.25 * bandpass(noise(0.12, seed + 50 + i), 1500, 5000) * np.exp(-t_axis(0.12) / 0.03)
        elif kind == 'run':
            s = knock(0.08, ((380 + r.uniform(-40, 40), 0.02, 1), (900, 0.012, 0.4)), 0.4, seed + i)
        elif kind == 'scrape':
            s = bandpass(noise(0.35, seed + i, 'pink'), 300, 2500) * np.sin(np.pi * np.linspace(0, 1, n_of(0.35))) ** 0.8 * 0.6
        else:
            s = knock(0.1, seed=seed + i)
        mix_at(out, s, tt, 1.0)
    return out


def organ(notes, dur, vib=5.5, leslie=0.0, seed=1):
    """Spooky drawbar organ chord: notes in Hz."""
    t = t_axis(dur)
    out = np.zeros(len(t))
    for f in notes:
        fv = f * (1 + 0.003 * np.sin(TAU * vib * t))
        out += harmonic(fv, amps=(1.0, 0.7, 0.45, 0.35, 0, 0.25, 0, 0.18))
    if leslie:
        out *= 1 - leslie * (0.5 + 0.5 * np.sin(TAU * 6.3 * t))
    return lowpass(out, 5000) / max(1, len(notes))


def bell(f=196.0, dur=4.0, seed=1):
    """Church/clock bell: hum, prime, tierce, quint, nominal and upper partials with long decays."""
    partials = [(0.5, 4.0, 0.6), (1.0, 3.0, 0.9), (1.19, 2.4, 0.55), (1.5, 2.0, 0.45), (2.0, 1.8, 0.7), (2.5, 1.2, 0.3),
                (2.66, 1.0, 0.3), (3.0, 0.8, 0.22), (4.07, 0.5, 0.15), (5.4, 0.3, 0.1)]
    x = modal(dur, [(f * r, d, a) for r, d, a in partials], seed, strike=0.001)
    t = t_axis(dur)
    x += 0.4 * bandpass(noise(dur, seed + 2), 1500, 7000) * np.exp(-t / 0.01)
    return x


def laugh(n=5, f0=320, rate=6.5, vowel='a', scale=1.3, seed=1, fall=0.75, breath=0.15, jitter=0.01):
    r = rng(seed)
    sylls = []
    for i in range(n):
        f = f0 * (1 + 0.12 * r.uniform(-1, 1)) * (1 - 0.04 * i)
        d = 1 / rate * r.uniform(0.75, 1.0)
        sylls.append(dict(dur=d * 0.75, f0=[(0, f), (d * 0.75, f * fall)], vowel=vowel, scale=scale, breath=breath, onset='h',
                          onset_dur=0.035, jitter=jitter, seed=seed + i, gap=d * 0.25 if i else 0.0, release=0.03))
    return phrase(sylls)


def babble(dur, voices=10, f_range=(110, 220), scale=1.0, seed=1, rate=5.0, amp_var=0.6):
    """Crowd chatter: many overlapping random syllables."""
    r = rng(seed)
    out = np.zeros(n_of(dur) + n_of(0.5))
    vowels = ['a', 'e', 'i', 'o', 'u', 'uh', 'ae', 'er']
    for v in range(voices):
        tt = r.uniform(0, 0.4)
        f = r.uniform(*f_range)
        p = r.uniform(-0.8, 0.8)
        while tt < dur:
            d = r.uniform(0.09, 0.22)
            s = syllable(d, [(0, f * r.uniform(0.9, 1.15)), (d, f * r.uniform(0.85, 1.1))], r.choice(vowels), r.choice(vowels),
                         scale=scale * r.uniform(0.95, 1.08), breath=0.12, onset=r.choice([None, 'h', 'b', 'k', 's', 't']), seed=int(r.integers(1e6)))
            mix_at(out, s * r.uniform(1 - amp_var, 1), tt, 1.0)
            tt += d + r.exponential(1 / rate)
    return lowpass(out, 4500)


# ---------------------------------------------------------------- impacts
@sfx('bonk')
def _bonk(name, s):
    t = t_axis(0.5)
    f = 170 + 420 * np.exp(-t / 0.025)
    x = sine(f) * np.exp(-t / 0.16) + 0.5 * sine(f * 2.7) * np.exp(-t / 0.05)
    x += knock(0.5, ((260, 0.08, 0.8), (610, 0.05, 0.5)), 0.5, s + 1)
    return reverb(x, 0.12, 0.6)


@sfx('body_thud')
def _body_thud(name, s):
    return thud(0.4, 62, 2.4, 0.12, 0.5, 700, s + 2) + 0.3 * bandpass(noise(0.4, s + 3), 400, 2500) * env_ad(0.4, 0.002, 0.05)


@sfx('catch_thump')
def _catch_thump(name, s):
    return thud(0.3, 85, 1.8, 0.08, 0.6, 1000, s + 4) * 0.8 + 0.4 * whoosh(0.3, 500, 1500, 700, seed=s + 5)


@sfx('bump_wood', 'wood_tap')
def _bump_wood(name, s):
    if name == 'wood_tap':
        return knock(0.15, ((520, 0.03, 1.0), (1180, 0.02, 0.5), (2500, 0.01, 0.2)), 0.3, s + 6)
    return knock(0.3, ((180, 0.08, 1.0), (430, 0.05, 0.7), (980, 0.03, 0.4)), 0.4, s + 7) + 0.4 * thud(0.3, 80, 1.5, 0.06, 0.2, 600, s + 8)


@sfx('crate_bang')
def _crate_bang(name, s):
    x = knock(0.5, ((140, 0.12, 1.0), (330, 0.08, 0.8), (760, 0.05, 0.5), (1500, 0.03, 0.3)), 0.6, s + 9)
    x += 0.5 * thud(0.5, 60, 2, 0.1, 0.4, 800, s + 10)
    x[n_of(0.07):] += 0.35 * knock(0.5 - 0.07, ((300, 0.05, 1), (700, 0.03, 0.5)), 0.3, s + 11)
    return reverb(x, 0.15, 0.7)


@sfx('door_bang')
def _door_bang(name, s):
    x = thud(0.7, 55, 2.2, 0.18, 0.7, 900, s + 12) + 0.6 * knock(0.7, ((120, 0.15, 1), (260, 0.1, 0.6), (610, 0.05, 0.3)), 0.5, s + 13)
    return reverb(x, 0.2, 1.0)


@sfx('door_close')
def _door_close(name, s):
    x = thud(0.45, 70, 1.8, 0.1, 0.5, 900, s + 14) * 0.8
    x[n_of(0.05):] += 0.5 * metal(0.4, 2400, (1, 1.7, 2.9), 0.04, s + 15, 0.4)[:len(x) - n_of(0.05)]
    return reverb(x, 0.15, 0.8)


@sfx('iron_clank')
def _iron_clank(name, s):
    return reverb(metal(1.4, 330, (1, 2.32, 3.9, 5.6, 7.3), 0.7, s + 16, 0.5), 0.2, 1.2)


@sfx('bucket_clang')
def _bucket(name, s):
    return reverb(metal(1.0, 410, (1, 2.4, 4.4, 6.3), 0.4, s + 17), 0.15, 0.8)


@sfx('trapdoor_snap')
def _trapdoor_snap(name, s):
    x = knock(0.5, ((160, 0.1, 1), (420, 0.06, 0.8), (1200, 0.03, 0.4)), 0.8, s + 18) + 0.5 * thud(0.5, 75, 2, 0.08, 0.5, 900, s + 19)
    x[n_of(0.02):] += 0.4 * metal(0.48, 1800, (1, 2.1, 3.3), 0.05, s + 20, 0.6)
    return reverb(x, 0.2, 0.9)


@sfx('ceiling_crash', 'roof_crash')
def _crash(name, s):
    big = name == 'roof_crash'
    dur = 1.6 if big else 1.2
    t = t_axis(dur)
    x = bandpass(crackle(dur, 1800, s + 21, 0.001), 400, 7000) * np.exp(-t / 0.25)
    x += 0.8 * thud(dur, 55 if big else 70, 2.5, 0.2, 0.8, 1200, s + 22)
    x += 0.5 * bandpass(noise(dur, s + 23, 'pink'), 200, 4000) * np.exp(-t / 0.15)
    for i, tt in enumerate(np.sort(rng(s + 24).uniform(0.12, dur - 0.3, 14))):     # bits landing
        mix_at(x, knock(0.12, ((rng(s + i).uniform(500, 1600), 0.02, 1),), 0.4, s + 30 + i), tt, 0.25 * np.exp(-tt * 1.5))
    return reverb(x, 0.22, 1.3 if big else 0.9)


@sfx('debris')
def _debris(name, s):
    out = np.zeros(n_of(1.1))
    r = rng(s + 40)
    for i, tt in enumerate(np.sort(r.uniform(0.0, 0.9, 18))):
        mix_at(out, knock(0.1, ((r.uniform(600, 2400), 0.015, 1),), 0.5, s + 41 + i), tt, np.exp(-tt * 2) * r.uniform(0.4, 1))
    return out


@sfx('sandal_tap')
def _sandal(name, s):
    t = t_axis(0.12)
    return bandpass(noise(0.12, s + 60), 700, 5000) * np.exp(-t / 0.012) + 0.4 * thud(0.12, 140, 1.4, 0.02, 0.2, 800, s + 61)


@sfx('facepalm_slap')
def _facepalm(name, s):
    t = t_axis(0.35)
    x = bandpass(noise(0.35, s + 62), 900, 6000) * np.exp(-t / 0.018) + 0.6 * thud(0.35, 150, 1.5, 0.03, 0.3, 900, s + 63)
    # a tired little exhale after it
    x[n_of(0.12):] += 0.25 * breath_noise(0.23, 'uh', 1.0, seed=s + 64)
    return reverb(x, 0.1, 0.5)


@sfx('coin_clink')
def _coin(name, s):
    a = metal(0.6, 2900, (1, 1.42, 1.93, 2.6), 0.35, s + 65, 0.6)
    b = metal(0.4, 3150, (1, 1.42, 1.93), 0.2, s + 66, 0.4)
    return seq([(0, a, 1.0), (0.09, b, 0.45), (0.16, b, 0.2)])


@sfx('coin_rattle')
def _coin_rattle(name, s):
    out = np.zeros(n_of(0.9))
    r = rng(s + 67)
    for i, tt in enumerate(np.sort(r.uniform(0, 0.7, 12))):
        mix_at(out, metal(0.2, r.uniform(2600, 4200), (1, 1.42, 1.93), 0.08, s + 68 + i, 0.5), tt, r.uniform(0.3, 1))
    return out


@sfx('hammer')
def _hammer(name, s):
    return knock(0.35, ((700, 0.05, 1), (1650, 0.03, 0.6), (3100, 0.015, 0.3)), 0.7, s + 70) + 0.5 * thud(0.35, 110, 1.6, 0.05, 0.3, 900, s + 71)


# ---------------------------------------------------------------- whooshes & cartoon moves
@sfx('sheet_whoosh')
def _sheet_whoosh(name, s):
    return pan_sweep(whoosh(0.6, 500, 2200, 900, 1.0, s + 80, flutter=0.35), -0.5, 0.4)


@sfx('cloth_whoosh', 'broom_whoosh')
def _cloth_whoosh(name, s):
    return pan_sweep(whoosh(0.4, 700, 2600, 1100, 1.1, s + 81, flutter=0.2 if name == 'cloth_whoosh' else 0.0), -0.4, 0.4)


@sfx('cape_swoosh', 'cape_flap')
def _cape(name, s):
    x = whoosh(0.5, 400, 1800, 700, 0.9, s + 82, flutter=0.6)
    return pan_sweep(x, 0.4, -0.4)


@sfx('fall_whoosh')
def _fall(name, s):
    d = 1.1
    whistle = glide_tone(1700, 280, d) * env_ar(d, 0.02, 0.15) * 0.6
    return whistle + 0.6 * whoosh(d, 300, 1200, 400, 0.8, s + 83)


@sfx('drone_whoosh')
def _drone(name, s):
    return pan_sweep(whoosh(1.5, 250, 1400, 500, 0.7, s + 84), -0.6, 0.6)


@sfx('ghost_whoosh', 'ghost_float')
def _ghost_whoosh(name, s):
    d = 1.3 if name == 'ghost_whoosh' else 1.0
    t = t_axis(d)
    ooo = sine(520 * (1 + 0.02 * np.sin(TAU * 5 * t))) * env_ar(d, 0.3, 0.4) * 0.25
    return pan_sweep(whoosh(d, 300, 1100, 500, 0.8, s + 85) + ooo, -0.5, 0.5)


@sfx('phone_swoosh')
def _phone_swoosh(name, s):
    return whoosh(0.25, 1500, 5000, 2500, 1.4, s + 86, 'white') * 0.6


@sfx('zoom_up')
def _zoom_up(name, s):
    d = 0.5
    return glide_tone(260, 2600, d, 'tri') * env_ar(d, 0.01, 0.12) * 0.6 + 0.5 * whoosh(d, 800, 4000, 3000, 1.0, s + 87)


@sfx('cartoon_zip', 'string_zip')
def _zip(name, s):
    d = 0.3 if name == 'cartoon_zip' else 0.4
    f0, f1 = (500, 2200) if name == 'cartoon_zip' else (1800, 500)
    t = t_axis(d)
    teeth = bandpass(crackle(d, 600, s + 88, 0.0004), 2000, 8000)
    return glide_tone(f0, f1, d, 'saw') * env_ar(d, 0.01, 0.08) * 0.15 + 0.6 * teeth * env_ar(d, 0.01, 0.1)


@sfx('wing_flap')
def _wing_flap(name, s):
    out = np.zeros(n_of(0.6))
    for i, tt in enumerate([0, 0.11, 0.22, 0.33]):
        mix_at(out, lowpass(noise(0.09, s + 90 + i, 'pink'), 1800) * env_ad(0.09, 0.005, 0.03), tt, 1 - i * 0.15)
    return out


@sfx('pop')
def _pop(name, s):
    d = 0.12
    t = t_axis(d)
    f = 320 + 900 * np.exp(-t / 0.012)
    return sine(f) * np.exp(-t / 0.035) + 0.3 * highpass(noise(d, s + 91), 2000) * np.exp(-t / 0.004)


@sfx('pop_big', 'pop_huge')
def _pop_big(name, s):
    huge = name == 'pop_huge'
    d = 0.7 if huge else 0.35
    t = t_axis(d)
    f = (140 if huge else 210) + (800 if huge else 700) * np.exp(-t / 0.02)
    x = sine(f) * np.exp(-t / (0.12 if huge else 0.07)) + 0.4 * highpass(noise(d, s + 92), 1500) * np.exp(-t / 0.006)
    x += 0.6 * thud(d, 50 if huge else 70, 2.0, 0.15 if huge else 0.08, 0.3, 600, s + 93)
    if huge:   # a magical sparkle as the mansion appears
        sp = chirp_seq([0.05, 0.1, 0.16, 0.22], 1800, 2600, 0.12, 0.12, d)
        x[:len(sp)] += sp[:len(x)]
    return reverb(x, 0.2, 1.0 if huge else 0.6)


@sfx('boing', 'boing_small', 'spring_boing', 'spider_boing_soft')
def _boing(name, s):
    d = {'boing': 0.7, 'boing_small': 0.45, 'spring_boing': 0.6, 'spider_boing_soft': 0.6}[name]
    base = {'boing': 150, 'boing_small': 260, 'spring_boing': 190, 'spider_boing_soft': 300}[name]
    t = t_axis(d)
    f = base * (1 + 0.6 * t / d) * (1 + 0.25 * np.sin(TAU * 13 * t) * np.exp(-t / 0.3))
    x = triangle(f) * np.exp(-t / (d * 0.45)) + 0.4 * sine(f * 2) * np.exp(-t / (d * 0.3))
    return x * (0.6 if name == 'spider_boing_soft' else 1.0)


@sfx('squeak_toy')
def _squeak(name, s):
    out = np.zeros(n_of(0.4))
    for tt in (0, 0.17):
        d = 0.13
        f = curve([(0, 1100), (0.04, 1700), (d, 1350)], d, 'exp')
        x = bandpass(saw(f), 900, 4000) * env_ar(d, 0.005, 0.03)
        mix_at(out, x, tt)
    return out


@sfx('heart_pop')
def _heart(name, s):
    d = 0.9
    x = _pop('pop', s) * 0.7
    sp = chirp_seq([0.05, 0.13, 0.21], 1400, 1900, 0.18, 0.5, d)
    sp += 0.5 * chirp_seq([0.05, 0.13, 0.21], 2100, 2800, 0.15, 0.4, d)
    sp[:len(x)] += x
    return reverb(sp, 0.25, 0.9)


@sfx('confetti', 'party_popper')
def _confetti(name, s):
    d = 1.2
    t = t_axis(d)
    x = bandpass(crackle(d, 500, s + 95, 0.0003), 3000, 10000) * np.exp(-t / 0.5) * 0.6
    if name == 'party_popper':
        x += 1.2 * (bandpass(noise(d, s + 96), 300, 5000) * np.exp(-t / 0.02))
        x += 0.5 * thud(d, 90, 2, 0.05, 0.2, 800, s + 97)
    return reverb(x, 0.15, 0.6)


@sfx('cha_ching')
def _cha_ching(name, s):
    clack = knock(0.12, ((900, 0.02, 1), (2300, 0.01, 0.5)), 0.6, s + 98)
    ring = metal(1.4, 2093, (1, 1.5, 2.0, 2.76, 3.4), 0.6, s + 99, 0.4)
    return reverb(seq([(0, clack, 1.0), (0.12, ring, 0.9)]), 0.18, 1.0)


@sfx('organ_sting', 'organ_sting_small', 'creepy_organ_hit')
def _organ_sting(name, s):
    if name == 'organ_sting':
        notes, d = [73.42, 146.83, 174.61, 207.65, 293.66], 1.6     # D, D, F, G#, D: spooky diminished colour
    elif name == 'organ_sting_small':
        notes, d = [110, 155.56, 220, 261.63], 0.8
    else:
        notes, d = [55, 82.4, 116.54], 1.2
    x = organ(notes, d, leslie=0.25, seed=s + 100) * env_ar(d, 0.02, d * 0.6)
    return reverb(x, 0.3, 1.6)


@sfx('bong')
def _bong(name, s):
    return reverb(bell(146.83, 5.0, s + 101), 0.35, 3.0, 3500)


@sfx('clock_tick')
def _tick(name, s):
    out = np.zeros(n_of(2.1))
    for i in range(4):
        tick = knock(0.06, ((3200 if i % 2 == 0 else 2400, 0.012, 1), (5100, 0.006, 0.4)), 0.4, s + 102 + i)
        mix_at(out, tick, i * 0.5)
    return reverb(out, 0.15, 0.8)


@sfx('clock_spin')
def _clock_spin(name, s):
    d = 1.4
    times, tt, gap = [], 0.0, 0.11
    while tt < d - 0.05:
        times.append(tt); tt += gap; gap = max(0.022, gap * 0.9)
    out = np.zeros(n_of(d + 0.1))
    for i, tt in enumerate(times):
        mix_at(out, knock(0.03, ((3000, 0.006, 1), (5200, 0.004, 0.4)), 0.3, s + 110 + i), tt, 0.6)
    out[:n_of(d)] += 0.5 * whoosh(d, 400, 2000, 3000, 1.0, s + 111)
    return out


@sfx('phone_beep')
def _beep(name, s):
    b1 = sine(1320, 0.07) * env_ar(0.07, 0.005, 0.02)
    b2 = sine(1760, 0.09) * env_ar(0.09, 0.005, 0.03)
    return seq([(0, b1, 0.7), (0.11, b2, 0.7)])


@sfx('camera_click')
def _shutter(name, s):
    a = bandpass(noise(0.03, s + 112), 2000, 9000) * env_ad(0.03, 0.001, 0.006)
    b = bandpass(noise(0.03, s + 113), 1500, 7000) * env_ad(0.03, 0.001, 0.008)
    return seq([(0, a, 1.0), (0.055, b, 0.8)])


@sfx('camera_flash')
def _flash(name, s):
    d = 0.6
    whine = glide_tone(2200, 7000, d) * env_ar(d, 0.05, 0.1) * 0.15
    pff = bandpass(noise(0.2, s + 114), 800, 6000) * env_ad(0.2, 0.002, 0.04)
    return seq([(0, whine, 1.0), (0.02, pff, 0.6)])


@sfx('switch_click', 'spot_click')
def _switch(name, s):
    if name == 'switch_click':
        return knock(0.08, ((2100, 0.01, 1), (4300, 0.006, 0.5)), 0.8, s + 115)
    clunk = knock(0.25, ((420, 0.04, 1), (1100, 0.02, 0.6), (2600, 0.01, 0.3)), 0.8, s + 116)
    t = t_axis(0.25)
    hum = (sine(120, 0.25) + 0.4 * sine(240, 0.25)) * np.clip(t / 0.05, 0, 1) * np.exp(-t / 0.2) * 0.25
    return reverb(clunk + hum, 0.15, 0.6)


@sfx('power_down')
def _power_down(name, s):
    d = 0.8
    f = curve([(0, 520), (d, 45)], d, 'exp')
    x = (saw(f) * 0.3 + sine(f) * 0.7) * env_ar(d, 0.005, 0.2)
    return lowpass(x, 2500)


@sfx('light_buzz')
def _buzz(name, s):
    d = 1.4
    t = t_axis(d)
    r = rng(s + 117)
    gate = (lowpass(r.standard_normal(len(t)), 18, 1) > -0.02).astype(float)
    gate = lowpass(gate, 200, 1)
    hum = saw(120, d) * 0.4 + square(240, d) * 0.15
    return bandpass(hum, 100, 4000) * gate * env_ar(d, 0.02, 0.1)


@sfx('eyes_shift')
def _eyes(name, s):
    d = 0.35
    x = glide_tone(700, 1250, d, 'sine') * env_ar(d, 0.01, 0.15)
    x += 0.4 * glide_tone(1050, 1880, d) * env_ar(d, 0.01, 0.15)
    return reverb(x, 0.3, 1.2)


@sfx('wheels_roll')
def _wheels(name, s):
    d = 1.2
    t = t_axis(d)
    x = lowpass(noise(d, s + 118, 'brown'), 400) * 2 * env_ar(d, 0.1, 0.3)
    for i, tt in enumerate(np.arange(0.05, d - 0.1, 0.17)):
        mix_at(x, knock(0.05, ((260, 0.02, 1),), 0.2, s + 119 + i), tt, 0.3)
    return x


@sfx('blueprint_unroll')
def _paper(name, s):
    d = 0.6
    return bandpass(crackle(d, 700, s + 120, 0.0008), 1500, 8000) * env_ar(d, 0.02, 0.2) + 0.2 * whoosh(d, 1000, 3000, 2000, 1, s + 121)


@sfx('tweet_birds')
def _tweet(name, s):
    d = 1.4
    out = np.zeros(n_of(d))
    r = rng(s + 122)
    for i, tt in enumerate(np.arange(0, d - 0.15, 0.16)):
        f0 = r.uniform(2600, 3600)
        c = glide_tone(f0, f0 * r.uniform(1.2, 1.5), 0.07) * env_ar(0.07, 0.005, 0.03)
        mix_at(out, c, tt, 0.6)
        mix_at(out, glide_tone(f0 * 1.3, f0, 0.05) * env_ar(0.05, 0.005, 0.02), tt + 0.075, 0.5)
    return pan_sweep(out, -0.6, 0.6)


@sfx('spider_dangle')
def _dangle(name, s):
    return _boing('spider_boing_soft', s) * 0.6 + 0.4 * creak(0.6, (300, 500, 380), ((1500, 12, 1), (3200, 14, 0.5)), s + 123)


# ---------------------------------------------------------------- foley
@sfx('sheet_flop')
def _sheet_flop(name, s):
    d = 0.4
    t = t_axis(d)
    return lowpass(noise(d, s + 130, 'pink'), 1400) * env_ad(d, 0.01, 0.08) * 1.3 + 0.5 * thud(d, 90, 1.4, 0.05, 0.2, 700, s + 131)


@sfx('cloth_snag')
def _snag(name, s):
    d = 0.5
    tchk = knock(0.06, ((1800, 0.01, 1),), 0.6, s + 132)
    stretch = creak(0.45, (90, 240, 160), ((900, 4, 1), (2100, 6, 0.6)), s + 133, 0.5) * 0.7
    return seq([(0, tchk, 1.0), (0.04, stretch, 0.8)])


@sfx('cloth_rip')
def _rip(name, s):
    d = 0.55
    t = t_axis(d)
    rate = 400 + 1600 * np.sin(np.pi * t / d)
    x = np.zeros(len(t))
    r = rng(s + 134)
    i = 0
    while i < len(t):
        x[i] = r.uniform(0.4, 1.0) * r.choice([-1, 1])
        i += max(1, int(SR / rate[i] * r.uniform(0.5, 1.5)))
    x = bandpass(signal_decay(x, 0.0004), 900, 7000) + 0.35 * bandpass(noise(d, s + 135), 1200, 5000)
    return x * env_ar(d, 0.01, 0.12)


def signal_decay(imp, decay):
    ir = np.exp(-np.arange(n_of(decay * 8)) / (decay * SR))
    from scipy.signal import fftconvolve
    return fftconvolve(imp, ir)[:len(imp)]


@sfx('chips_rustle', 'bag_crinkle')
def _rustle(name, s):
    d = 0.6 if name == 'chips_rustle' else 0.45
    rate = 350 if name == 'chips_rustle' else 900
    x = bandpass(crackle(d, rate, s + 136, 0.0006), 1800, 11000) * env_ar(d, 0.03, 0.15)
    return x + 0.25 * bandpass(noise(d, s + 137), 2500, 8000) * env_ar(d, 0.05, 0.2)


@sfx('crunch', 'crunch_small')
def _crunch(name, s):
    if name == 'crunch_small':
        return crunch_burst(0.1, 800, seed=s + 138)
    return seq([(0, crunch_burst(0.14, 1300, seed=s + 139), 1.0), (0.17, crunch_burst(0.1, 900, seed=s + 140), 0.55),
                (0.31, crunch_burst(0.08, 700, seed=s + 141), 0.35)])


@sfx('footsteps_soft')
def _footsteps(name, s):
    return steps([0, 0.36, 0.72, 1.08], 'soft', s + 142)


@sfx('running_feet')
def _running(name, s):
    return steps(list(np.arange(0, 1.2, 0.12)), 'run', s + 143)


@sfx('shuffle_feet')
def _shuffle(name, s):
    return steps([0, 0.45, 0.9], 'scrape', s + 144)


@sfx('knees_knock')
def _knees(name, s):
    return steps(list(np.arange(0, 0.9, 0.07)), 'knock', s + 145) * 0.6


@sfx('teeth_chatter')
def _teeth(name, s):
    out = np.zeros(n_of(1.0))
    for i, tt in enumerate(np.arange(0, 0.9, 0.05)):
        mix_at(out, knock(0.03, ((2800, 0.005, 1), (4600, 0.003, 0.5)), 0.4, s + 146 + i), tt, 0.5 + 0.5 * (i % 2))
    return out


@sfx('shrug')
def _shrug(name, s):
    rustle = lowpass(noise(0.35, s + 150, 'pink'), 2500) * env_ar(0.35, 0.05, 0.15) * 0.6
    hm = syllable(0.22, [(0, 180), (0.22, 230)], 'm', 'uh', 1.0, 0.1, seed=s + 151)
    return seq([(0, rustle, 1.0), (0.05, hm, 0.6)])


@sfx('gulp')
def _gulp(name, s):
    d = 0.22
    t = t_axis(d)
    f = curve([(0, 650), (0.08, 220), (d, 180)], d, 'exp')
    return sine(f) * env_ar(d, 0.005, 0.08) + 0.3 * bandpass(noise(d, s + 152), 300, 1200) * env_ad(d, 0.005, 0.03)


@sfx('door_creak', 'door_creak_short', 'door_open_creak', 'wood_creak')
def _door_creak(name, s):
    d = {'door_creak': 1.2, 'door_creak_short': 0.5, 'door_open_creak': 0.9, 'wood_creak': 0.8}[name]
    return reverb(creak(d, (55, 150, 80), ((300, 6, 1.0), (760, 9, 0.6), (1450, 11, 0.35)), s + 153), 0.2, 0.8)


@sfx('gate_squeak', 'wire_creak')
def _gate(name, s):
    d = 1.3 if name == 'gate_squeak' else 0.7
    body = ((900, 14, 1.0), (2300, 18, 0.6), (4100, 20, 0.3)) if name == 'gate_squeak' else ((1400, 16, 1), (3100, 18, 0.5))
    return reverb(creak(d, (140, 420, 220), body, s + 154, 0.2), 0.25, 1.2)


@sfx('trapdoor_rattle')
def _rattle(name, s):
    out = np.zeros(n_of(0.7))
    r = rng(s + 155)
    for i, tt in enumerate(np.arange(0, 0.6, 0.065)):
        mix_at(out, knock(0.07, ((r.uniform(300, 450), 0.025, 1), (r.uniform(900, 1300), 0.015, 0.5)), 0.3, s + 156 + i), tt, np.exp(-tt * 3))
    return out


@sfx('bone_rattle')
def _bones(name, s):
    out = np.zeros(n_of(0.9))
    r = rng(s + 160)
    for i, tt in enumerate(np.sort(r.uniform(0, 0.7, 26))):
        mix_at(out, knock(0.05, ((r.uniform(900, 2600), 0.012, 1), (r.uniform(2800, 4500), 0.006, 0.4)), 0.2, s + 161 + i), tt, r.uniform(0.4, 1))
    return out


@sfx('bookshelf_spin', 'stone_rumble')
def _rumble(name, s):
    d = 1.1 if name == 'bookshelf_spin' else 1.4
    t = t_axis(d)
    x = lowpass(noise(d, s + 170, 'brown'), 260) * 6 * env_ar(d, 0.1, 0.3)
    x += 0.3 * bandpass(crackle(d, 250, s + 171, 0.002), 300, 2000) * env_ar(d, 0.1, 0.3)
    if name == 'bookshelf_spin':
        x += 0.5 * creak(d, (40, 80, 50), ((200, 5, 1), (520, 7, 0.6)), s + 172)
        x[-n_of(0.3):] += 0.5 * knock(0.3, ((150, 0.08, 1), (380, 0.05, 0.5)), 0.4, s + 173)
    return reverb(x, 0.2, 1.0)


@sfx('fog_hiss', 'fog_hiss_soft', 'fog_puff')
def _fog(name, s):
    d = {'fog_hiss': 1.8, 'fog_hiss_soft': 1.6, 'fog_puff': 0.4}[name]
    t = t_axis(d)
    x = bandpass(noise(d, s + 175), 2500, 9000) * env_ar(d, 0.03, d * 0.5)
    x += 0.6 * lowpass(noise(d, s + 176, 'pink'), 1200) * env_ad(d, 0.01, 0.08)
    return x * (0.6 if name == 'fog_hiss_soft' else 1.0)


@sfx('smoke_puff', 'smoke_puff_big')
def _puff(name, s):
    big = name == 'smoke_puff_big'
    d = 0.8 if big else 0.4
    t = t_axis(d)
    x = lowpass(noise(d, s + 177, 'pink'), 1800 if big else 2600) * env_ad(d, 0.015, d * 0.25) * 1.4
    x += 0.5 * thud(d, 60 if big else 90, 1.8, 0.08, 0.2, 500, s + 178)
    return reverb(x, 0.15, 0.7)


@sfx('crickets')
def _crickets(name, s):
    d = 4.0
    out = np.zeros(n_of(d))
    r = rng(s + 180)
    chans = []
    for c in range(3):
        f = r.uniform(4200, 5200)
        x = np.zeros(n_of(d))
        tt = r.uniform(0, 0.4)
        while tt < d - 0.2:
            for k in range(3):
                mix_at(x, sine(f, 0.03) * env_ar(0.03, 0.004, 0.01), tt + k * 0.045, 1.0)
            tt += r.uniform(0.45, 0.7)
        chans.append(pan(x, r.uniform(-0.8, 0.8)) * r.uniform(0.4, 1.0))
    return sum(chans) * 0.5


@sfx('wind_spooky')
def _wind(name, s):
    d = 3.5
    t = t_axis(d)
    fc = 500 + 250 * np.sin(TAU * 0.35 * t) + 120 * np.sin(TAU * 0.9 * t + 1)
    x = sweep_filter(noise(d, s + 181, 'pink'), 'bp', fc, 3.0) * 2
    howl = sine(fc * 0.9) * 0.08
    return pan_sweep((x + howl) * env_ar(d, 0.8, 1.0), -0.5, 0.5)


@sfx('owl_hoot')
def _owl(name, s):
    h1 = syllable(0.28, [(0, 420), (0.28, 380)], 'oo', scale=1.0, breath=0.15, onset='h', seed=s + 182, tilt=-18)
    h2 = syllable(0.45, [(0, 410), (0.45, 360)], 'oo', scale=1.0, breath=0.15, onset='h', seed=s + 183, tilt=-18)
    return reverb(seq([(0, h1, 0.8), (0.42, h2, 1.0)]), 0.35, 1.8)


@sfx('wolf_howl_cartoon')
def _wolf(name, s):
    d = 1.8
    x = syllable(d, [(0, 330), (0.4, 620), (1.2, 560), (d, 360)], 'a', 'oo', scale=1.1, breath=0.12, vib=(25, 5.5), seed=s + 184, tilt=-12)
    return reverb(x, 0.4, 2.2)


@sfx('thunder', 'thunder_far', 'thunder_soft')
def _thunder(name, s):
    d = {'thunder': 3.5, 'thunder_far': 3.0, 'thunder_soft': 2.6}[name]
    t = t_axis(d)
    r = rng(s + 185)
    crack = bandpass(crackle(d, 2500, s + 186, 0.002), 300, 6000) * np.exp(-t / 0.18) * (1.2 if name == 'thunder' else 0.2)
    rumble = lowpass(noise(d, s + 187, 'brown'), 180) * 10
    mod = 0.6 + 0.4 * lowpass(r.standard_normal(len(t)), 3, 1) / 0.02
    rumble *= np.clip(mod, 0.2, 1.6) * np.clip(t / 0.08, 0, 1) * np.exp(-t / (d * 0.35))
    x = crack + rumble
    if name != 'thunder':
        x = lowpass(x, 900)
    return reverb(x, 0.3, 2.0, 2500)


@sfx('searchlight_hum', 'spooky_hum', 'dark_hum')
def _hum(name, s):
    d = 2.5
    t = t_axis(d)
    if name == 'searchlight_hum':
        x = (sine(60, d) + 0.5 * sine(120, d) + 0.2 * saw(180, d)) * 0.4
        x = lowpass(x, 800) * (1 + 0.3 * np.sin(TAU * 0.8 * t))
    elif name == 'spooky_hum':
        x = sum(sine(f * (1 + 0.004 * np.sin(TAU * 0.3 * t + i))) for i, f in enumerate([110, 110.6, 164.8, 220.9])) * 0.3
        x += 0.2 * bandpass(noise(d, s + 188), 300, 1500)
    else:
        x = lowpass(noise(d, s + 189, 'brown'), 200) * 4 + 0.3 * sine(55, d)
    return x * env_ar(d, 0.4, 0.6)


@sfx('bats_flap')
def _bats(name, s):
    d = 1.4
    out = np.zeros(n_of(d))
    r = rng(s + 190)
    for i in range(70):
        tt = r.uniform(0, d - 0.08)
        mix_at(out, lowpass(noise(0.05, s + 191 + i, 'pink'), r.uniform(1200, 2600)) * env_ad(0.05, 0.004, 0.015), tt, r.uniform(0.3, 1))
    sq = _bat_squeak('bat_squeak', s)
    out[:len(sq)] += 0.3 * sq[:len(out)]
    return pan_sweep(out * env_ar(d, 0.15, 0.4), -0.7, 0.7)


@sfx('bat_squeak')
def _bat_squeak(name, s):
    return chirp_seq([0, 0.09, 0.26], 6500, 8200, 0.04, 0.6)


# ---------------------------------------------------------------- voices
@sfx('kids_laugh', 'kids_laugh_small', 'kid_giggle')
def _kids_laugh(name, s):
    n_kids = {'kids_laugh': 3, 'kids_laugh_small': 2, 'kid_giggle': 1}[name]
    parts = []
    for k in range(n_kids):
        x = laugh(n=5 + k, f0=330 + 45 * k, rate=6.0 + k * 0.8, vowel=['a', 'e', 'i'][k % 3], scale=1.32, seed=s + 200 + k * 7)
        parts.append(pan(x, [-0.4, 0.4, 0.0][k % 3]))
    L = max(len(p) for p in parts) + n_of(0.3)
    mix = np.zeros((L, 2))
    for k, p in enumerate(parts):
        mix_at(mix, p, 0.07 * k)
    return reverb(mix, 0.15, 0.6)


@sfx('kids_cheer')
def _kids_cheer(name, s):
    parts = []
    for k in range(4):
        y = syllable(0.75, [(0, 360 + 30 * k), (0.25, 520 + 40 * k), (0.75, 470 + 30 * k)], 'e', 'ae', scale=1.32, breath=0.15, onset=None, seed=s + 210 + k, vib=(30, 6))
        parts.append(pan(y, -0.6 + 0.4 * k))
    mix = np.zeros((n_of(1.3), 2))
    for k, p in enumerate(parts):
        mix_at(mix, p, 0.04 * k, 0.7)
    claps = steps(list(np.arange(0.1, 1.2, 0.13)), 'run', s + 215) * 0.4
    mix += to_stereo(claps[:len(mix)] if len(claps) >= len(mix) else np.pad(claps, (0, len(mix) - len(claps))))
    return reverb(mix, 0.15, 0.7)


@sfx('crowd_kids')
def _crowd_kids(name, s):
    return pan_sweep(babble(2.6, 9, (300, 420), 1.3, s + 220), -0.3, 0.3)


@sfx('crowd_murmur')
def _crowd_murmur(name, s):
    return reverb(babble(3.0, 12, (110, 230), 1.05, s + 221, 4.0), 0.2, 1.0)


@sfx('crowd_cheer_far')
def _crowd_cheer(name, s):
    out = np.zeros(n_of(1.8))
    r = rng(s + 222)
    for k in range(10):
        f = r.uniform(150, 320)
        y = syllable(1.0, [(0, f), (0.3, f * 1.35), (1.0, f * 1.15)], 'e', 'a', scale=r.uniform(1.0, 1.3), breath=0.2, seed=s + 223 + k, vib=(20, 6))
        mix_at(out, y, r.uniform(0, 0.3), r.uniform(0.4, 1))
    return reverb(lowpass(out, 2500), 0.4, 1.6)


@sfx('crowd_gasp', 'gasp')
def _gasp(name, s):
    if name == 'gasp':
        return breath_noise(0.35, 'a', 1.1, inhale=True, seed=s + 230) * 0.9
    out = np.zeros(n_of(0.8))
    r = rng(s + 231)
    for k in range(8):
        mix_at(out, breath_noise(0.35, r.choice(['a', 'o', 'ae']), r.uniform(1.0, 1.3), inhale=True, seed=s + 232 + k), r.uniform(0, 0.15), r.uniform(0.5, 1))
    return reverb(out, 0.2, 0.9)


@sfx('scream_group')
def _scream_group(name, s):
    out = np.zeros(n_of(1.7))
    r = rng(s + 240)
    for k in range(5):
        f = r.uniform(420, 760)
        y = syllable(1.3, [(0, f), (0.2, f * 1.25), (1.3, f * 0.9)], r.choice(['a', 'ae']), 'a', scale=r.uniform(1.15, 1.35), breath=0.25,
                     vib=(60, r.uniform(6, 8)), jitter=0.02, seed=s + 241 + k, release=0.3)
        mix_at(out, saturate(y, 1.5), r.uniform(0, 0.2), r.uniform(0.5, 1))
    return reverb(out, 0.25, 1.2)


@sfx('larry_scream')
def _larry_scream(name, s):
    y = syllable(1.3, [(0, 380), (0.15, 560), (1.0, 520), (1.3, 430)], 'ae', 'a', scale=1.1, breath=0.12, vib=(70, 7.5), jitter=0.015, seed=s + 250, release=0.25)
    return reverb(saturate(y, 1.6), 0.2, 1.0)


@sfx('larry_groan', 'larry_whimper', 'tug_grunt', 'boo_weak')
def _larry_small(name, s):
    if name == 'larry_groan':
        return syllable(0.8, [(0, 150), (0.8, 105)], 'uh', 'u', scale=1.05, breath=0.12, creak=0.4, onset='h', seed=s + 251, release=0.2)
    if name == 'larry_whimper':
        return phrase([dict(dur=0.25, f0=[(0, 330), (0.25, 420)], vowel='m', vowel_end='u', scale=1.1, breath=0.1, nasal=0.6, seed=s + 252),
                       dict(dur=0.3, f0=[(0, 420), (0.3, 300)], vowel='u', scale=1.1, breath=0.15, nasal=0.4, seed=s + 253, gap=0.06)])
    if name == 'tug_grunt':
        return syllable(0.3, [(0, 150), (0.3, 130)], 'uh', scale=1.0, breath=0.2, creak=0.5, seed=s + 254, attack=0.01, release=0.05)
    return syllable(0.45, [(0, 170), (0.45, 140)], 'oo', scale=1.05, breath=0.18, onset='b', seed=s + 255, release=0.15) * 0.7


@sfx('witch_cackle')
def _cackle(name, s):
    x = laugh(n=7, f0=520, rate=8.0, vowel='e', scale=1.25, seed=s + 260, fall=0.85, breath=0.1)
    tail = syllable(0.45, [(0, 700), (0.45, 820)], 'i', scale=1.25, breath=0.1, vib=(40, 7), seed=s + 261, release=0.2)
    return reverb(np.concatenate([x, tail]), 0.25, 1.0)


@sfx('zombie_groan', 'zombie_groan_2')
def _zombie_groan(name, s):
    if name == 'zombie_groan':
        y = syllable(1.4, [(0, 95), (0.7, 110), (1.4, 85)], 'u', 'er', scale=0.95, breath=0.2, creak=0.6, jitter=0.03, onset='h', seed=s + 270, release=0.4)
    else:
        y = syllable(1.1, [(0, 105), (1.1, 90)], 'o', 'a', scale=0.95, breath=0.2, creak=0.55, jitter=0.03, seed=s + 271, release=0.3)
    return reverb(y, 0.2, 0.9)


@sfx('zombie_giggle')
def _zombie_giggle(name, s):
    return laugh(n=4, f0=150, rate=5.5, vowel='uh', scale=1.0, seed=s + 272, fall=0.8, breath=0.15, jitter=0.03)


@sfx('zombie_scream')
def _zombie_scream(name, s):
    y = syllable(1.0, [(0, 330), (0.15, 600), (1.0, 480)], 'a', scale=1.0, breath=0.3, creak=0.3, vib=(60, 7), jitter=0.02, seed=s + 273, release=0.25)
    return reverb(saturate(y, 1.8), 0.2, 1.0)


@sfx('vampire_bleh')
def _bleh(name, s):
    y = syllable(0.42, [(0, 220), (0.42, 165)], 'e', 'e', scale=1.0, breath=0.15, onset='b', creak=0.25, seed=s + 274, release=0.08)
    return reverb(y, 0.2, 0.9)


@sfx('vampire_scream')
def _vampire_scream(name, s):
    y = syllable(1.1, [(0, 560), (0.2, 820), (1.1, 700)], 'i', 'ae', scale=1.15, breath=0.2, vib=(90, 7.5), seed=s + 275, release=0.3)
    return reverb(saturate(y, 1.4), 0.25, 1.2)


@sfx('ghost_ooo')
def _ghost_ooo(name, s):
    d = 1.6
    y = syllable(d, [(0, 380), (0.5, 520), (1.1, 470), (d, 400)], 'oo', 'o', scale=1.2, breath=0.05, vib=(35, 4.5), tilt=-20, seed=s + 280,
                 attack=0.25, release=0.5)
    return reverb(y, 0.45, 2.0)


@sfx('ghost_scream', 'ghost_scream_far')
def _ghost_scream(name, s):
    d = 1.4
    y = syllable(d, [(0, 600), (0.12, 950), (0.9, 880), (d, 620)], 'a', 'ae', scale=1.35, breath=0.3, vib=(90, 9), jitter=0.02, seed=s + 281, release=0.35)
    y = saturate(y, 1.5) + 0.25 * glide_tone(1900, 1500, d) * env_ar(d, 0.05, 0.4)
    if name == 'ghost_scream_far':
        return reverb(lowpass(y, 2200) * 0.6, 0.55, 2.2)
    return reverb(y, 0.3, 1.5)


@sfx('ghost_whisper')
def _whisper(name, s):
    return reverb(breath_noise(1.0, 'e', 1.2, seed=s + 282, env=[(0, 0), (0.2, 1), (0.7, 0.8), (1.0, 0)]), 0.4, 1.6)


@sfx('meh')
def _meh(name, s):
    # the ghost's bored little "meh"
    return phrase([dict(dur=0.09, f0=250, vowel='m', scale=1.25, nasal=0.8, breath=0.05, seed=s + 283, release=0.01),
                   dict(dur=0.3, f0=[(0, 250), (0.3, 205)], vowel='e', scale=1.25, breath=0.08, seed=s + 284, gap=-0.02, release=0.12)])


@sfx('yawn')
def _yawn(name, s):
    return syllable(1.3, [(0, 210), (0.35, 290), (1.3, 150)], 'a', 'o', scale=1.05, breath=0.35, seed=s + 285, attack=0.15, release=0.4)


@sfx('relieved_sigh')
def _sigh(name, s):
    return breath_noise(0.8, 'uh', 1.1, seed=s + 286, env=[(0, 0), (0.08, 1), (0.8, 0)]) * 0.8


@sfx('chicken_bawk')
def _chicken(name, s):
    bawk = syllable(0.32, [(0, 620), (0.07, 980), (0.32, 700)], 'aw', 'a', scale=1.45, breath=0.25, onset='b', nasal=0.35, jitter=0.03, seed=s + 290, release=0.08)
    bok = syllable(0.1, [(0, 560), (0.1, 500)], 'o', scale=1.4, breath=0.2, onset='b', nasal=0.4, seed=s + 291, release=0.03)
    return seq([(0, bawk, 1.0), (0.4, bok, 0.6), (0.55, bok, 0.5)])


@sfx('broom_drop')
def _broom_drop(name, s):
    a = knock(0.3, ((240, 0.06, 1.0), (610, 0.04, 0.6), (1400, 0.02, 0.3)), 0.5, s + 300)
    b = knock(0.25, ((300, 0.05, 1.0), (750, 0.03, 0.5)), 0.4, s + 301)
    roll = bandpass(noise(0.4, s + 302, 'pink'), 300, 1500) * env_ar(0.4, 0.02, 0.2) * 0.3
    return seq([(0, a, 1.0), (0.14, b, 0.6), (0.22, roll, 1.0)])


@sfx('high_five')
def _high_five(name, s):
    return _facepalm('facepalm_slap', s)
