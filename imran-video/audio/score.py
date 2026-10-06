#!/usr/bin/env python3
"""Soundtrack for "Imran, I got you!" - music bed "Warm Spark" + every SFX cue, synthesised in numpy.

Usage (build.sh):  python3 -I audio/score.py <out.wav> <duration_seconds>

One cue table drives everything (SPEC.md §4). Every time is derived from the shared constants in
timeline.json (T_IMPACT, T_PAYOFF, ...): cues that have a constant use it directly, the others are
written as offsets from the nearest preceding constant, so moving a constant moves its whole beat.

Signal flow
  4 buses: bed_pre / sfx_pre (everything that starts before the impact) and bed_post / sfx_post.
  Each bus = dry + Schroeder reverb (4 combs + 2 allpasses, RT 1.2 s) fed by per-cue sends.
  The bed buses carry their gain automation (ignition swell, fade under the riser, -40 dB hole,
  final fade). The *_pre buses are hard-cut at T_IMPACT - 0.02 s (spec: riser hard cut, 20 ms of
  silence), so 8.88-8.90 is digital silence and nothing from before the impact rings through it.
  Master: sum -> one static gain that puts the impact's peak at exactly -6 dBFS (spec §4.1) ->
  linked look-ahead soft limiter at -1 dBFS (a safety net; it never engages) -> 16-bit WAV, 48 kHz stereo.

Levels: a cue's level is its peak in dBFS (each channel, at centre pan). Panning is constant-power,
normalised so centre = unity; pan = clamp((x - 960)/960 * 0.6, +-0.6) from the source's screen x
unless the spec's cue table gives an explicit pan.
"""
import json
import os
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
from scipy import signal  # noqa: E402

import sfx  # noqa: E402
from sfx import SR, db, ns  # noqa: E402

ROOT = os.path.dirname(HERE)
BPM = 96.0
BEAT = 60.0 / BPM          # 0.625 s
RT60_COMB = 1.35         # comb design RT; with the in-loop damping the measured broadband T30 is 1.2 s
CUT_GAP = 0.02             # riser hard cut -> impact: 20 ms of digital silence

# Bed levels. Spec §4.2 says pad base -24 dBFS RMS (music about -22). Measured that way the bed was
# louder than the SFX (bed ~-20 LUFS momentary vs SFX median ~-24) and the ignitions / word wave
# matched the impact in loudness, so the whole bed sits BED_TRIM lower; relative moves are as spec.
BED_TRIM = -4.0
PAD_RMS = -24.0 + BED_TRIM          # pad RMS on the steady chords
PULSE_DB = -26.0 + BED_TRIM         # thinking-pulse pluck bass peak
ROOT_DB = -28.0 + BED_TRIM          # (addition) post-impact root plucks
SUB_DB = -30.0 + BED_TRIM / 2       # SUB F1 peak (trimmed less: it carries the post-impact weight)
HOLE_DB = -40.0                     # bed level in the 8.70-8.90 hole (absolute dBFS RMS)
IMPACT_PEAK_DB = -6.0               # master anchor: the finished mix peaks here at the impact


# ------------------------------------------------------------------ helpers

def load_timeline(path=None):
    with open(path or os.path.join(ROOT, 'timeline.json')) as f:
        return json.load(f)


_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def hz(name):
    """'Bb2', 'F#3', 'C6' -> Hz (A4 = 440)."""
    pc = _PC[name[0]]
    rest = name[1:]
    if rest[0] in 'b#':
        pc += -1 if rest[0] == 'b' else 1
        rest = rest[1:]
    midi = 12 * (int(rest) + 1) + pc
    return 440.0 * 2 ** ((midi - 69) / 12)


def pan_x(x):
    return float(np.clip((x - 960.0) / 960.0 * 0.6, -0.6, 0.6))


def seed_of(*parts):
    return zlib.crc32('|'.join(str(p) for p in parts).encode()) & 0x7FFFFFFF


def ease_io_cubic(u):
    u = np.clip(u, 0, 1)
    return np.where(u < 0.5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)


def ease_out_cubic(u):
    u = np.clip(u, 0, 1)
    return 1 - (1 - u) ** 3


# Screen x of sound sources on the chat page. Measured from the project fonts with PIL
# (Shantell Sans 700 / Fraunces 500 at 96 px): tw = 874 -> L 357, R 1563, text x 569 (BUILD_NOTES agrees).
X = {
    'avatar': 462.0,
    'words': [740.0, 971.0, 1117.0, 1339.0],          # centres of "Imran," "I" "got" "you!"
    'glyphs': [588.0, 618.0, 655.0, 706.0, 741.0, 779.0, 835.0, 881.0, 910.0, 935.0, 968.0],  # "I’ve got it"
    'bang': 1006.0,
    'gLeft': 746.0,
    'ul_end': 1020.0,
    'chip': 1463.0,                                    # LAYOUT.chip.x = R - 100
}
PUSH_Z = 1.18                                          # end push-in zoom about x 960
BUBBLE_PAN = {'TL': -0.35, 'TR': 0.35, 'BL': -0.35, 'BR': 0.35}   # spec cue table (puff chains)
BUBBLE_XY = {'TL': (585, 325), 'TR': (1335, 325), 'BL': (585, 785), 'BR': (1335, 785)}
SMALL_PUFF_X = {'TL': 888, 'TR': 1032, 'BL': 888, 'BR': 1032}


class Cue:
    __slots__ = ('t', 'name', 'make', 'level', 'pan', 'send', 'era', 'kind', 'onset', 'seed')

    def __init__(self, t, name, make, level, pan=0.0, send=0.15, kind='hit', onset=0.0):
        self.t, self.name, self.make, self.level = float(t), name, make, float(level)
        self.pan, self.send, self.kind, self.onset = pan, send, kind, onset
        self.seed = seed_of(name)          # names are unique; textures stay put if a constant moves
        self.era = None


# ------------------------------------------------------------------ the cue table (SPEC §4.4)

def build_cues(T):
    TI, TB, TT, TBG = T['T_IRIS'], T['T_BUBBLE'], T['T_TYPE0'], T['T_BANG']
    TD, TP1, TS, TRB = T['T_DOTHOP'], T['T_PAN1'], T['T_SEED'], T['T_RESOLVE_BR']
    TG0, TW, TSP, TU, TIM = T['T_IGNITE0'], T['T_WINDUP'], T['T_SPIRAL'], T['T_UNRAVEL'], T['T_IMPACT']
    TC1, TC2, TJ, TPO = T['T_C1'], T['T_C2'], T['T_JUMP'], T['T_PAYOFF']
    TF, TL, TPU, TWV, TWP = T['T_FLY'], T['T_LAND_CHIP'], T['T_PUSH'], T['T_WAVE'], T['T_WIPE']

    cues = []

    def C(t, name, make, level, pan=0.0, send=0.15, kind='hit', onset=0.0):
        c = Cue(t, name, make, level, pan, send, kind, onset)
        cues.append(c)
        return c

    # ---- intro
    C(0.0, 'TWINKLE 2400', lambda s: sfx.twinkle(2400, dur=0.7), -30, send=0.3)
    C(TI, 'AIR iris fwoom', lambda s: sfx.air(0.40, 200, 900, peak=0.62, seed=s), -22, send=0.1, kind='swell')
    C(TI + 0.28, 'PUFF dot out', lambda s: sfx.puff(s), -26)

    # ---- chat
    C(TB, 'POP 340 bubble', lambda s: sfx.pop(340, seed=s), -14, pan=-0.1)
    C(TB, 'SWISH bubble', lambda s: sfx.swish(0.30, seed=s), -24, pan=-0.1, kind='swell')
    C(TB + 0.10, 'POP 620 avatar', lambda s: sfx.pop(620, seed=s), -18, pan=-0.35)
    for k, (note, dt) in enumerate(zip(['F4', 'A4', 'C5', 'F5'], [0.26, 0.36, 0.46, 0.58])):
        C(TB + dt, f'MAR {note} word', (lambda f: lambda s: sfx.mar(f, s))(hz(note)), -16,
          pan=pan_x(X['words'][k]))
    C(TB + 0.70, 'PLIP nod', lambda s: sfx.plip(700, 900, 0.06), -28, pan=pan_x(X['avatar']))
    # typing "I’ve got it": glyph times relative to T_TYPE0 (spec §3.2 table)
    typing = [(0.00, 'KEY'), (0.06, 'KEY'), (0.12, 'KEY'), (0.18, 'KEY'), (0.36, 'SPACE'),
              (0.42, 'KEY'), (0.49, 'KEY'), (0.56, 'KEY'), (0.63, 'SPACE'), (0.70, 'KEY'), (0.77, 'KEY')]
    for g, (dt, kind) in enumerate(typing):
        if kind == 'KEY':
            C(TT + dt, f'KEY {g}', lambda s: sfx.key(s), -20, pan=pan_x(X['glyphs'][g]), send=0.08)
        else:
            C(TT + dt, f'SPACE {g}', lambda s: sfx.space_key(s), -22, pan=pan_x(X['glyphs'][g]), send=0.08)

    def bang_make(s):
        th = sfx.thock(s)
        m = sfx.mar(hz('C6'), s + 1)
        n = max(len(th), len(m))
        return sfx.norm(sfx.pad_to(th, n) * db(-2) + sfx.pad_to(m, n))
    C(TBG, 'THOCK+MAR C6 bang', bang_make, -16, pan=pan_x(X['bang']))

    def ul_pan(t):
        u = ease_out_cubic((t - (TBG + 0.12)) / 0.30)
        return np.clip(((X['gLeft'] + (X['ul_end'] - X['gLeft']) * u) - 960) / 960 * 0.6, -0.6, 0.6)
    C(TBG + 0.12, 'SWISH underline', lambda s: sfx.swish(0.30, seed=s), -24, pan=ul_pan, kind='swell')

    # ---- drop
    C(TD - 0.12, 'SQUISH tiny', lambda s: sfx.squish(s), -28, pan=pan_x(X['bang']))
    C(TD, 'PLIP dot pops', lambda s: sfx.plip(500, 900, 0.08), -16, pan=pan_x(X['bang']))
    C(TP1, 'WHOOSH fall', lambda s: sfx.whoosh(1800, 400, TS - TP1, peak=(0.35 / (TS - TP1)), seed=s),
      -18, kind='swell')
    C(TP1 + 0.15, 'SLIDE fall', lambda s: sfx.slide(900, 300, TS - (TP1 + 0.15), seed=s), -24, kind='swell')
    C(TS, 'PLIP seed lands', lambda s: sfx.plip(400, 220, 0.12), -14, send=0.2)

    # ---- thoughts: puff chains TL -> TR -> BL -> BR
    chains = [('TL', ['C5', 'F5', 'A5'], [-20, -20, -17]),
              ('TR', ['D5', 'G5', 'C6'], [-19, -19, -16]),
              ('BL', ['F5', 'A5', 'D6'], [-18, -18, -15]),
              ('BR', ['G5', 'C6', 'F6'], [-18, -18, -15])]
    for k, (b, notes, lv) in enumerate(chains):
        t0 = TS + 0.20 + 0.40 * k
        for j in range(3):
            C(t0 + 0.08 * j, f'POP {notes[j]} {b}', (lambda f: lambda s: sfx.pop(f, seed=s))(hz(notes[j])),
              lv[j], pan=BUBBLE_PAN[b])
        C(TS + 0.50 + 0.40 * k, f'SCRATCH {b}', lambda s: sfx.scratch(0.35, seed=s), -26,
          pan=BUBBLE_PAN[b], send=0.1, kind='swell')
    # focus glints (resolve windows TL 6.30, TR 6.46, BL 6.62 = T_RESOLVE_BR - .55/.39/.23)
    for b, dt, ratio in (('TL', -0.55, 1.00), ('TR', -0.39, 1.06), ('BL', -0.23, 1.12)):
        C(TRB + dt, f'GLINT {b}', (lambda r: lambda s: sfx.glint(r, seed=s))(ratio), -20,
          pan=BUBBLE_PAN[b], send=0.3, onset=0.10)
    C(TRB, 'BELL A5,C6 for Imran', lambda s: sfx.bell([hz('A5'), hz('C6')], ring=1.6, strum=0.06),
      -16, pan=BUBBLE_PAN['BR'], send=0.3)
    C(TRB + 0.20, 'BOING seed hop', lambda s: sfx.boing(300, 520, 0.15, seed=s), -20)
    C(TRB + 0.25, 'TSK joy 1', lambda s: sfx.tsk(s), -28, pan=-0.03)
    C(TRB + 0.28, 'TSK joy 2', lambda s: sfx.tsk(s, 1.0), -28, pan=0.03)
    # ignition chain BR -> BL -> TL -> TR
    for k, (b, note) in enumerate((('BR', 'F5'), ('BL', 'A5'), ('TL', 'C6'), ('TR', 'F6'))):
        Ti = TG0 + 0.17 * k
        C(Ti - 0.10, f'PUFF orange {b}', lambda s: sfx.puff(s), -24, pan=pan_x(SMALL_PUFF_X[b]))

        def ign(s, f=hz(note)):
            fw = sfx.fwip(s)
            m = sfx.mar(f, s + 1)
            n = max(len(fw), len(m))
            return sfx.norm(sfx.pad_to(fw, n) * db(-4) + sfx.pad_to(m, n))
        C(Ti, f'FWIP+MAR {note} {b}', ign, -15, pan=BUBBLE_PAN[b])
        for j, dt in enumerate((0.04, 0.07, 0.10)):
            C(Ti + dt, f'TICK {b} {j}', lambda s: sfx.tick(1900, s), -22, pan=BUBBLE_PAN[b] * 1.15, send=0.1)

    # ---- merge
    C(TW, 'SQUISH windup', lambda s: sfx.squish(s), -20)
    # spec: -20 -> -12 dBFS; ends 2 dB hotter (-10) so the build clearly tops the ignition bed before the cut
    C(TW, 'RISER', lambda s: sfx.riser(TIM - CUT_GAP - TW, seed=s, db_start=-10.0), -10, send=0.12, kind='swell')
    C(TW + 0.31, 'PLIP small puffs', lambda s: sfx.plip(900, 1300, 0.06), -20)
    C(TW + 0.43, 'PLIP big puffs', lambda s: sfx.plip(1130, 1640, 0.06), -20)
    C(TU, 'SWISH unravel', lambda s: sfx.swish(0.25, f0=1500, f1=4200, seed=s), -22,
      pan=lambda t: 0.3 * np.sin(2 * np.pi * 1.1 * (t - TU)), kind='swell')

    def impact(s):
        # spec balance -8/-14/-14/-18; the mid layers are lifted 2/1/1 dB and the thump driven harder so
        # the impact is also the loudest moment on small (phone) speakers, not only on the sub-bass peak
        parts = [(sfx.thump(seed=s, drive=3.2), -8), (sfx.pop(260, seed=s + 1), -12),
                 (sfx.norm(sum(sfx.mar(hz(n), s + 2 + i) for i, n in enumerate(['F5', 'A5', 'C6']))), -13),
                 (sfx.crack(s + 3), -17)]
        n = max(len(p) for p, _ in parts)
        x = sum(sfx.pad_to(p, n) * db(l) for p, l in parts)
        return sfx.norm(x)
    C(TIM, 'IMPACT', impact, -6.0, send=0.45)   # group peak -6 dBFS (the master gain then pins the mix at -6)
    r = sfx.gen(seed_of('paper shards'))
    pt = np.sort(TIM + r.uniform(0.03, 0.60, 6))
    for i in range(1, 6):
        pt[i] = max(pt[i], pt[i - 1] + 0.035)
    for i, tp in enumerate(pt):
        C(tp, f'PAPER {i}', lambda s: sfx.paper(s), -28, pan=float(r.uniform(-0.5, 0.5)), send=0.15)
    # gulps: absorb times BR 9.35, BL 9.42, TL 9.49, TR 9.56 (= T_IMPACT + 0.45 + 0.07k);
    # pan from where each comet enters the blob (spec §3.5 comet formulas)
    u = (TU - TSP) / (TIM - TSP)
    for k, b in enumerate(('BR', 'BL', 'TL', 'TR')):
        Ta = TIM + 0.45 + 0.07 * k
        bx, by = BUBBLE_XY[b]
        th0 = np.arctan2(by - 555, bx - 960) + np.radians(110) * u * u
        thh = th0 + 7.0 * (Ta - TU)
        C(Ta, f'GULP {b}', (lambda rt: lambda s: sfx.gulp(rt, s))((1.00, 1.06, 1.12, 1.19)[k]), -20,
          pan=pan_x(960 + 205 * np.cos(thh)))

    # ---- blob
    C(TC1 - 0.14, 'SQUISH C1 antic', lambda s: sfx.squish(s), -22)
    C(TC1, 'HUP C1', lambda s: sfx.hup(380, 620, 0.12, seed=s), -16)
    for j, dt in enumerate((0.12, 0.16, 0.20)):
        C(TC1 + dt, f'TSK C1 {j}', lambda s: sfx.tsk(s), -22, pan=0.25)
    C(TC1 + 0.38, 'SQUISH C1 close', lambda s: sfx.squish(s), -26)
    C(TC2 - 0.10, 'SQUISH C2 antic', lambda s: sfx.squish(s), -20)
    C(TC2, 'HUP C2', lambda s: sfx.hup(480, 820, 0.14, seed=s), -14)
    for j in range(5):
        C(TC2 + 0.12 + 0.04 * j, f'TSK C2 {j}', (lambda st: lambda s: sfx.tsk(s, st))(float(j)), -22, pan=0.3)
    C(TC2 + 0.43, 'SQUISH C2 close', lambda s: sfx.squish(s), -26)
    C(TJ - 0.20, 'CREAK', lambda s: sfx.creak(s), -22, kind='swell')
    C(TJ, 'BOING jump', lambda s: sfx.boing(300, 900, 0.25, seed=s), -16)
    C(TJ, 'WHOOSH spin', lambda s: sfx.whoosh(1500, 1500, 0.48, peak=0.5, q=1.5, trem_hz=12, seed=s),
      -20, kind='swell')

    # ---- payoff
    C(TPO, 'THUMP soft', lambda s: sfx.thump(tau=0.30, drive=1.6, seed=s, dur=1.6), -14, send=0.3)
    C(TPO, 'BELL payoff F5 A5 C6 F6',
      lambda s: sfx.bell([hz('F5'), hz('A5'), hz('C6'), hz('F6')], ring=1.4, strum=0.012), -10, send=0.3)
    C(TPO, 'PFFT confetti', lambda s: sfx.pfft(s), -18, send=0.2)
    C(TPO, 'SHIMMER 16', lambda s: sfx.shimmer(16, 0.5, seed=s), -22, send=0.3)
    for j, dt in enumerate((0.04, 0.09, 0.14)):
        C(TPO + dt, f'SCRATCH crease {j}', lambda s: sfx.scratch(0.05, seed=s), -28, pan=0.05, send=0.1,
          kind='swell')
    for j, (note, dt, x) in enumerate((('C7', 0.07, 1015), ('E7', 0.15, 1095), ('G7', 0.23, 905))):
        C(TPO + dt, f'CEL {note}', (lambda f: lambda s: sfx.cel(f))(hz(note)), -24, pan=pan_x(x), send=0.3)
    C(TPO + 0.12, 'TICK tock 600', lambda s: sfx.tick(600, s), -20)

    # ---- home
    C(TF - 0.15, 'PLIP dip', lambda s: sfx.plip(520, 440, 0.08), -24)

    def flight_pan(t):
        sp = ease_io_cubic((t - TF) / (TL - TF))
        x = ((1 - sp) ** 3 * 960 + 3 * (1 - sp) ** 2 * sp * 1180 + 3 * (1 - sp) * sp ** 2 * 1600
             + sp ** 3 * X['chip'])
        return np.clip((x - 960) / 960 * 0.6, -0.6, 0.6)
    C(TF, 'WHOOSH flight', lambda s: sfx.whoosh(400, 2000, TL - TF, peak=0.55, seed=s), -18,
      pan=flight_pan, kind='swell')
    C(TF, 'SLIDE flight', lambda s: sfx.slide(400, 1000, TL - TF, seed=s), -20, pan=flight_pan, kind='swell')
    chip = pan_x(X['chip'])
    C(TL - 0.08, 'POP 520 chip', lambda s: sfx.pop(520, seed=s), -16, pan=chip)

    def land(s):
        a = sfx.mar(hz('C6'), s)
        b = sfx.mar(hz('F6'), s + 1)
        p = sfx.pop(330, tau=0.06, seed=s + 2)
        n = ns(0.08) + len(b)
        x = sfx.pad_to(a, n) + np.concatenate([np.zeros(ns(0.08)), b]) + sfx.pad_to(p, n) * db(-6)
        return sfx.norm(x)
    C(TL, 'MAR C6,F6 + POP 330 land', land, -14, pan=chip, send=0.2)
    C(TL + 0.20, 'PLIP dot hops out', lambda s: sfx.plip(900, 1300, 0.05), -20, pan=pan_x(X['chip'] - 40))
    C(TL + 0.55, 'PLIP dot lands', lambda s: sfx.plip(1600, 1600, 0.04), -18, pan=pan_x(X['bang']))
    C(TL + 0.60, 'BELL G5,C6 heart', lambda s: sfx.bell([hz('G5'), hz('C6')], ring=1.2, strum=0.07, glassy=True),
      -16, pan=chip, send=0.3)
    for j, dt in enumerate((0.65, 0.85)):
        C(TL + dt, f'TICK avatar hop {j}', lambda s: sfx.tick(1200, s), -26, pan=pan_x(X['avatar']))
    C(TPU, 'AIR push-in', lambda s: sfx.air(0.60, 700, 700, peak=0.6, seed=s), -26, send=0.1, kind='swell')
    for k, note in enumerate(['F5', 'A5', 'C6', 'F6']):
        C(TWV + 0.10 * k, f'MAR {note} wave', (lambda f: lambda s: sfx.mar(f, s))(hz(note)), -15,
          pan=pan_x(960 + (X['words'][k] - 960) * PUSH_Z))
    C(TWV + 0.30, 'TICK chip pump', lambda s: sfx.tick(600, s), -24, pan=pan_x(960 + (X['chip'] - 960) * PUSH_Z))

    # ---- outro
    def wipe_pan(t):
        x = -400 + 2720 * ease_io_cubic((t - TWP) / 0.60)
        return np.clip((x - 960) / 960 * 0.6, -0.6, 0.6)
    C(TWP, 'WHOOSH wipe', lambda s: sfx.whoosh(900, 900, 0.60, peak=0.5, q=1.5, seed=s), -18,
      pan=wipe_pan, kind='swell')
    C(TWP + 0.62, 'TWINKLE 2800', lambda s: sfx.twinkle(2800, dur=0.4), -22, send=0.3)
    C(TWP + 0.72, 'SHIMMER 4', lambda s: sfx.shimmer(4, 0.2, seed=s), -26, send=0.3)

    cut = TIM - CUT_GAP
    for c in cues:
        c.era = 'pre' if c.t < cut else 'post'
    return cues


# ------------------------------------------------------------------ the music bed (SPEC §4.2)

def pad_events(T):
    """Pad notes as (note, on, off, attack). Common tones are tied across chord changes (voice leading).
    Chord map: Fmaj7 swell 0.10 -> Fmaj7 -> Dm9 (4.20) -> Bbmaj7 (7.25) -> Csus4 (8.21) -> hole (8.70)
    -> Fadd9 (8.90) -> F bright +C5 F5 (11.70) -> Bbmaj7 (13.12) -> F (14.30) -> fade 15.70-16.30."""
    TI, TS, TG0, TW, TIM = T['T_IRIS'], T['T_SEED'], T['T_IGNITE0'], T['T_WINDUP'], T['T_IMPACT']
    TPO, TL, TPU, TE = T['T_PAYOFF'], T['T_LAND_CHIP'], T['T_PUSH'], T['T_END']
    t0 = TI + 0.02            # 0.10 swell from silence
    tBb = TG0 - 0.10          # 7.25 Bbmaj7 (+4 dB swell under the ignitions)
    tHole = TIM - 0.20        # 8.70 bed out
    tF = TPU + 0.25           # 14.30 plagal F
    pre = [
        ('F3', t0, tHole, 0.6), ('A3', t0, TW, 0.6), ('C4', t0, tBb, 0.6), ('E4', t0, tBb, 0.6),
        ('D3', TS, TW, 0.8), ('Bb2', tBb, TW, 0.8),
        ('C3', TW, tHole, 0.12), ('G3', TW, tHole, 0.12), ('C4', TW, tHole, 0.12),
    ]
    post = [
        ('F2', TIM, TL, 0.8), ('C3', TIM, TL, 0.8), ('G3', TIM, TL, 0.8), ('A3', TIM, TE, 0.8),
        ('C5', TPO, TL, 0.45), ('F5', TPO, TE, 0.45),
        ('Bb2', TL, tF, 0.8), ('D3', TL, tF, 0.8), ('F3', TL, TE, 0.8),
        ('F2', tF, TE, 0.8), ('C3', tF, TE, 0.8), ('C4', tF, TE, 0.8),
    ]
    return pre, post


def note_weight_db(f):
    if f < 100:
        return -2.0
    if f > 500:
        return -5.0
    return 0.0


def render_pad(events, n, seed, release=1.2):
    out = np.zeros((2, n))
    for idx, (name, on, off, att) in enumerate(events):
        f = hz(name)
        i0 = ns(on)
        i_off = ns(off)
        rr = ns(release)
        i1 = min(n, i_off + rr)
        if i1 <= i0:
            continue
        m = i1 - i0
        env = np.ones(m)
        a = min(ns(att), m)
        env[:a] = np.sin(0.5 * np.pi * np.arange(a) / a) ** 2
        k_off = i_off - i0
        if k_off < m:
            k = np.arange(m - k_off)
            env[k_off:] *= np.cos(0.5 * np.pi * np.minimum(k / rr, 1.0)) ** 2
        r = sfx.gen(seed_of(seed, name, idx))
        t = np.arange(m) / SR
        lfo = 1 + 0.06 * np.sin(2 * np.pi * r.uniform(0.12, 0.25) * t + r.uniform(0, 6.28))
        w = db(note_weight_db(f)) * 0.5
        flip = 1 if idx % 2 == 0 else -1
        # unequal voice levels keep the +-4 cent beating gentle when the mix is summed to mono
        for cents, p, g in ((-4.0, -0.3 * flip, 1.0 if flip > 0 else 0.65),
                            (4.0, 0.3 * flip, 0.65 if flip > 0 else 1.0)):
            x = sfx.tri_tone(f * 2 ** (cents / 1200), m, ph0=r.uniform(0, 2 * np.pi))
            out[:, i0:i1] += sfx.to_stereo(x * env * lfo * w * g * 1.2, p)
    return out


def rms_db(st, t0, t1):
    seg = st[:, ns(t0):ns(t1)]
    return 10 * np.log10(np.mean(seg ** 2) + 1e-20)


def automation(n, points):
    """Piecewise gain curve from (t, dB) points; cosine-interpolated in dB between points."""
    tt = np.arange(n) / SR
    ts = np.array([p[0] for p in points])
    ds = np.array([p[1] for p in points])
    out = np.interp(tt, ts, ds)
    # cosine smoothing within each segment
    for i in range(len(ts) - 1):
        a, b = ns(ts[i]), min(n, ns(ts[i + 1]))
        if b <= a or ds[i] == ds[i + 1]:
            continue
        u = (tt[a:b] - ts[i]) / (ts[i + 1] - ts[i])
        out[a:b] = ds[i] + (ds[i + 1] - ds[i]) * (0.5 - 0.5 * np.cos(np.pi * u))
    return db(out)


def build_bed(T, n):
    """Returns (bed_pre, bed_post) dry stereo arrays and their reverb sends, plus info for analysis."""
    TS, TW, TIM, TPO, TL, TPU, TE = (T['T_SEED'], T['T_WINDUP'], T['T_IMPACT'], T['T_PAYOFF'],
                                     T['T_LAND_CHIP'], T['T_PUSH'], T['T_END'])
    pre_ev, post_ev = pad_events(T)
    pad_pre = render_pad(pre_ev, n, 'pad-pre')
    pad_post = render_pad(post_ev, n, 'pad-post')
    # calibrate: pad RMS = PAD_RMS on the steady Fmaj7 (1.0-4.2) and Fadd9 (9.8-11.7) stretches
    if ns(TS) <= n:
        pad_pre *= db(PAD_RMS - rms_db(pad_pre, 1.0, TS))
    if ns(TPO) <= n:
        pad_post *= db(PAD_RMS - rms_db(pad_post, TIM + 0.9, TPO))

    def add_at(buf, x, t):
        i0 = ns(t)
        if i0 < n:
            m = min(len(x), n - i0)
            buf[:, i0:i0 + m] += x[:m]

    bass_pre = np.zeros((2, n))
    bass_post = np.zeros((2, n))
    pulse = ['D2', 'A2', 'D2', 'A2', 'D2', 'Bb1', 'F2']          # thinking pulse, one per beat from T_SEED
    for k, note in enumerate(pulse):
        t = TS + BEAT * k
        if t >= TW:
            break
        add_at(bass_pre, sfx.pluck_bass(hz(note)) * db(PULSE_DB), t)
    # (addition) soft root plucks on the post-impact chord changes, to ground the harmony
    for t, note in ((TPO, 'F2'), (TL, 'Bb1'), (TPU + 0.25, 'F2')):
        add_at(bass_post, sfx.pluck_bass(hz(note), dur=2.0) * db(ROOT_DB), t)
    # SUB on F1 from the impact to the payoff
    m = ns(TPO - TIM)
    add_at(bass_post, np.sin(2 * np.pi * hz('F1') * np.arange(m) / SR) * sfx.env_ar(m, 0.06, 0.30) * db(SUB_DB), TIM)

    # automation (dB, relative)
    tBb = T['T_IGNITE0'] - 0.10
    hole = TIM - 0.20
    cut = TIM - CUT_GAP
    # +4 dB swell under the ignitions; at the wind-up the Csus4 is heard briefly, then the bed sinks
    # under the riser (mostly during the wind-up, so the riser's build owns the spiral whip-in)
    a_pre = automation(n, [(0.0, 0.0), (tBb, 0.0), (tBb + 0.40, 4.0), (TW, 4.0), (TW + 0.10, 1.0),
                           (T['T_SPIRAL'], -7.0), (hole, HOLE_DB - PAD_RMS),
                           (cut, HOLE_DB - PAD_RMS), (TE + 1, HOLE_DB - PAD_RMS)])
    tt = np.arange(n) / SR
    a_post = np.cos(0.5 * np.pi * np.clip((tt - (TE - 0.60)) / 0.60, 0, 1)) ** 2   # fade out 15.70-16.30

    bed_pre = pad_pre + bass_pre
    bed_post = pad_post + bass_post
    send_pre = pad_pre * 0.30 + bass_pre * 0.08
    send_post = pad_post * 0.30 + bass_post * 0.08
    return dict(pre=(bed_pre, send_pre, a_pre), post=(bed_post, send_post, a_post),
                pad_pre=pad_pre, pad_post=pad_post)


# ------------------------------------------------------------------ render

def place(dry, send, x, t, level_db, pan, send_amt):
    n = dry.shape[1]
    i0 = int(round(t * SR))
    if i0 >= n:
        return
    x = x * db(level_db)
    if x.ndim == 1:
        if callable(pan):
            p = pan(t + np.arange(len(x)) / SR)
        else:
            p = pan
        st = sfx.to_stereo(x, p)
    else:
        st = x
    m = min(st.shape[1], n - i0)
    dry[:, i0:i0 + m] += st[:, :m]
    send[:, i0:i0 + m] += st[:, :m] * send_amt


def reverb(send, ir_l, ir_r):
    n = send.shape[1]
    wl = signal.fftconvolve(send[0], ir_l)[:n]
    wr = signal.fftconvolve(send[1], ir_r)[:n]
    return np.stack([wl, wr])


def render(dur, T=None, stems=False):
    T = T or load_timeline()
    n = int(round(dur * SR))
    cues = build_cues(T)

    buses = {e: [np.zeros((2, n)), np.zeros((2, n))] for e in ('pre', 'post')}
    cue_buffers = []
    for c in cues:
        x = c.make(c.seed)
        cue_buffers.append((c, x))
        dry, snd = buses[c.era]
        place(dry, snd, x, c.t, c.level, c.pan, c.send)

    bed = build_bed(T, n)
    ir_l = sfx.schroeder_ir(RT60_COMB, spread=0)
    ir_r = sfx.schroeder_ir(RT60_COMB, spread=26)
    hp = signal.butter(2, 20 / (SR / 2), 'high', output='sos')

    cut = T['T_IMPACT'] - CUT_GAP
    tt = np.arange(n) / SR
    gate = np.clip((cut - tt) / 0.005, 0, 1)
    gate = np.sin(0.5 * np.pi * gate) ** 2                       # 5 ms cosine fade ending exactly at the cut

    out = {}
    for era in ('pre', 'post'):
        dry, snd = buses[era]
        sfx_bus = signal.sosfilt(hp, dry + reverb(snd, ir_l, ir_r), axis=1)
        bdry, bsnd, auto = bed[era]
        bed_bus = signal.sosfilt(hp, bdry + reverb(bsnd, ir_l, ir_r), axis=1) * auto[None, :]
        if era == 'pre':
            sfx_bus *= gate[None, :]
            bed_bus *= gate[None, :]
        out[era] = (sfx_bus, bed_bus)

    sfx_mix = out['pre'][0] + out['post'][0]
    bed_mix = out['pre'][1] + out['post'][1]
    mix = sfx_mix + bed_mix
    # master gain: anchor the impact (the loudest moment) at exactly IMPACT_PEAK_DB in the finished mix,
    # so reverb/bed build-up doesn't push it past the spec; everything else keeps its relative level
    TIM = T['T_IMPACT']
    win = mix[:, ns(TIM):min(n, ns(TIM + 0.5))]
    if win.size:
        g = db(IMPACT_PEAK_DB) / max(np.max(np.abs(win)), 1e-9)
        mix, sfx_mix, bed_mix = mix * g, sfx_mix * g, bed_mix * g
    mix, gmin = sfx.limit(mix, -1.0)
    # final tail fade (the pad is already at silence by T_END) and exact zero edges
    fl = ns(0.12)
    mix[:, n - fl:] *= np.cos(0.5 * np.pi * (np.arange(fl) + 1) / fl) ** 2
    mix[:, 0] = 0.0
    mix[:, ns(cut):ns(T['T_IMPACT'])] = 0.0
    if stems:
        return dict(mix=mix, sfx=sfx_mix, bed=bed_mix, cues=cues, cue_buffers=cue_buffers,
                    limiter_min_gain=gmin, pad_pre=bed['pad_pre'], pad_post=bed['pad_post'], T=T)
    return mix


def main(argv):
    if len(argv) < 2:
        print('usage: score.py <out.wav> [duration_seconds]', file=sys.stderr)
        return 2
    path = argv[1]
    T = load_timeline()
    dur = float(argv[2]) if len(argv) > 2 else float(T['DURATION'])
    mix = render(dur, T)
    if not np.all(np.isfinite(mix)):
        raise SystemExit('non-finite samples in mix')
    sfx.write_wav(path, mix)
    pk = np.max(np.abs(mix))
    print(f'score.py: wrote {path} ({dur:.3f} s, {mix.shape[1]} samples, peak {sfx.to_db(pk):.2f} dBFS)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
