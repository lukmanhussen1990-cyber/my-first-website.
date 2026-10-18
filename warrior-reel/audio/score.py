"""Original score for "The Warrior Who Couldn't Forgive" — composed in code.

Key: D minor -> F major (relative major).  ~66 bpm, free timing: every harmonic
change is pinned to a timeline beat or a gap in the dialogue.

Motif (piano / high strings), 5 notes:  A3 D4 E4 F4 E4  (5-1-2-3-2 in D minor:
a rising fourth that climbs and falls back, unresolved).  In F major it becomes
C4 F4 G4 A4 G4, and the very last statement finally resolves: C F G A G F.

Structure (seconds from timeline.json beats):
  HOOK        0 .. establishStart     D pedal drone (contrabass D1, cello D2+A2), single
                                      piano notes D4 .. A3 .. Bb3 (b6 sigh, unresolved)
  ESTABLISH   establishStart ..       slow strings open on Dm, harp roll, piano motif
  ARRIVAL     jesusArrive ..          only the bass moves: Dm -> Bbmaj7 -> Gm7 (warm
                                      common-tone voice-leading), Asus4 -> A on the question
  BETRAYAL    L04 .. L05              lament bass D-C#-C-B-Bb-A under a static Dm pad
                                      (Dm, Dm/C#, Dm7/C, Bm7b5, Bbmaj7, A7) = uneasy
  TEACHING    L06 .. L07              deceptive cadence A7 -> Bb, first glimpse of F major
                                      on "True strength", ends on Gm (still open)
  SWELL       swordLookStart ..       ii - IV - V11 - V7 in F, crescendo; the high strings
                                      sing the motif D5 G5 A5 Bb5 ...
  RESOLUTION  swordTipDown            ... A5 = the major third, landing exactly on F major
                                      (harp sweep, low piano octave, light choir)
  AFTERMATH   L08 .. L11              F, Dm7 (doubt), Bb, F/A, Gm7, C, F, Dm, Bb, C, Am7,
                                      Bb -> Bbm6 (minor plagal) ...
  GOLDEN      goldenStart             ... -> F major, fuller (contrabass, harp arpeggios,
                                      high strings), piano motif in major
  END CARD    endCardStart .. end     final F major (choir, harp sweep), motif resolves to F;
                                      clean 1.5 s fade-out
"""
import os
import subprocess

import numpy as np
import pretty_midi
import soundfile as sf
from scipy import signal

from common import (SR, BUILD, SF2, n_total, timeline, curve, undb, hpf, lpf, eq,
                    balance, fade, ensure_dirs)

NN = pretty_midi.note_name_to_number
BPM = 66.0
BEAT = 60.0 / BPM

LAYERS = {            # name: (GM program, pan, reverb send)
    "bass":  (43, 0.25, 0.18),   # Contrabass
    "cello": (42, 0.18, 0.30),   # Cello
    "pad":   (49, -0.05, 0.42),  # String Ensemble 2 (slow strings)
    "high":  (48, -0.22, 0.50),  # String Ensemble 1 (violins, swell / golden / end)
    "piano": (0, 0.05, 0.34),    # Acoustic Grand Piano
    "harp":  (46, -0.35, 0.40),  # Orchestral Harp
    "choir": (52, 0.0, 0.60),    # Choir Aahs (resolution only)
}
LAYER_GAIN_DB = {"bass": -3.0, "cello": -1.0, "pad": -2.0, "high": -5.0,
                 "piano": 0.0, "harp": -4.0, "choir": -9.0}


class Score:
    def __init__(self):
        self.notes = {k: [] for k in LAYERS}

    def n(self, layer, pitch, t0, t1, vel):
        p = NN(pitch) if isinstance(pitch, str) else int(pitch)
        self.notes[layer].append((p, float(t0), float(t1), int(vel)))

    def roll(self, layer, pitches, t0, t1, vel, step=0.09, dv=0):
        for i, p in enumerate(pitches):
            self.n(layer, p, t0 + i * step, t1, vel + i * dv)

    def line(self, layer, events, end, vel, overlap=0.06):
        """events: [(t, pitch|None), ...] -> legato line; repeated pitches are tied."""
        ev = [(t, (NN(p) if isinstance(p, str) else p)) for t, p in events]
        merged = []
        for t, p in ev:
            if merged and merged[-1][1] == p:
                continue
            merged.append((t, p))
        for i, (t, p) in enumerate(merged):
            if p is None:
                continue
            t1 = merged[i + 1][0] + overlap if i + 1 < len(merged) else end
            v = vel(t) if callable(vel) else vel
            self.n(layer, p, t, t1, v)


# ----------------------------------------------------------------------------- harmony
PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
      "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def voice_lead(chords, lo="F3", hi="D5"):
    """Choose pad voicings with minimal movement (common tones tied).

    chords: [(t, [pitch classes...], n_voices, required pcs)] -> [(t, [midi...])]
    """
    lo, hi = NN(lo), NN(hi)
    out = []
    prev = None
    from itertools import combinations
    for t, pcs, nv, req in chords:
        pcset = {PC[p] for p in pcs}
        reqset = {PC[p] for p in req}
        cand = [m for m in range(lo, hi + 1) if m % 12 in pcset]
        best, bc = None, 1e9
        for combo in combinations(cand, nv):
            pcs_c = {m % 12 for m in combo}
            if not reqset <= pcs_c:
                continue
            gaps = np.diff(combo)
            if (gaps < 2).any() or (gaps > 9).any():
                continue
            cost = 0.0
            if prev is not None:
                pv = sorted(prev)
                for m in combo:
                    cost += min(abs(m - q) for q in pv)
                for q in pv:
                    cost += 0.5 * min(abs(m - q) for m in combo)
            else:
                cost = abs(np.mean(combo) - 62)
            cost += 0.8 * (nv - len(pcs_c))          # prefer no doublings
            if cost < bc:
                best, bc = combo, cost
        if best is None:
            raise RuntimeError(f"no voicing for {pcs} at {t}")
        out.append((t, list(best)))
        prev = best
    return out


def pad_from_voicings(sc, voicings, end, vel, layer="pad"):
    """Turn successive voicings into tied legato voices (nearest-voice assignment)."""
    held = {}                 # pitch -> start time
    for i, (t, vs) in enumerate(voicings):
        for p in list(held):
            if p not in vs:
                sc.n(layer, p, held.pop(p), t + 0.08, vel)
        for p in vs:
            if p not in held:
                held[p] = t
    for p, t0 in held.items():
        sc.n(layer, p, t0, end, vel)


def compose(tl):
    B = tl["beats"]
    cue = {c["id"]: c for c in tl["cues"]}
    END = tl["duration"]
    est, arr, sit = B["establishStart"], B["jesusArrive"], B["jesusSitStart"]
    look, lower, tip, settle = B["swordLookStart"], B["swordLowerStart"], B["swordTipDown"], B["swordSettleEnd"]
    gold, touch, card = B["goldenStart"], B["shoulderTouch"], B["endCardStart"]
    S = Score()

    # ------------------------------------------------------------------ chord map
    # (time, pcs, n pad voices, required pcs)  -- bass line written separately below
    L04, L05, L06, L07 = cue["L04"], cue["L05"], cue["L06"], cue["L07"]
    L08, L09, L10, L11, L12 = cue["L08"], cue["L09"], cue["L10"], cue["L11"], cue["L12"]
    t_q_sus = cue["L03"]["speechStart"] + 1.05          # "carry so much"
    t_q_dom = cue["L03"]["speechEnd"] - 0.30            # "anger?"
    lam = [L04["speechStart"], L04["speechStart"] + 1.47, L04["words"][6]["e"] + 0.04,
           L04["words"][9]["s"] + 0.1, L05["fileStart"] - 0.2, L05["words"][3]["s"] + 0.4]
    # lament change times: D (13.43) C# (14.9) C (16.45) B (17.95) Bb (19.46) A (21.2)
    t_dec = L05["speechEnd"] + 0.47                     # deceptive cadence (between lines)
    chords = [
        (est, ["D", "F", "A"], 3, ["D", "F", "A"]),
        (arr, ["Bb", "D", "F", "A"], 3, ["D", "F", "A"]),                 # Bbmaj7 (bass moves only)
        (sit - 0.09, ["G", "Bb", "D", "F"], 3, ["Bb", "D", "F"]),          # Gm7
        (t_q_sus, ["A", "D", "E"], 3, ["A", "D", "E"]),                   # Asus4
        (t_q_dom, ["A", "C#", "E"], 3, ["A", "C#", "E"]),                 # A
        (lam[0], ["D", "F", "A"], 3, ["D", "F", "A"]),                    # Dm   (lament bass D)
        (lam[5], ["G", "C#", "E", "A"], 3, ["G", "C#", "E"]),             # A7   (lament bass A)
        (t_dec, ["Bb", "D", "F", "C"], 3, ["D", "F", "C"]),               # Bb(add9) deceptive
        (L06["words"][4]["s"], ["G", "Bb", "D", "F"], 3, ["Bb", "D", "F"]),   # Gm7  "his enemy"
        (L06["speechEnd"] + 0.15, ["F", "A", "C"], 3, ["F", "A", "C"]),      # F/A  "True strength"
        (L07["words"][3]["s"], ["D", "F", "A"], 3, ["D", "F", "A"]),         # Dm   "ruling the anger"
        (L07["words"][6]["s"], ["Bb", "D", "F"], 3, ["Bb", "D", "F"]),       # Bb   "inside you"
        (L07["words"][8]["s"], ["G", "Bb", "D"], 3, ["G", "Bb", "D"]),       # Gm   "and choosing..."
        (look, ["G", "Bb", "D", "F"], 4, ["G", "Bb", "D"]),               # Gm7 / swell begins (ii)
        (lower, ["Bb", "D", "F"], 4, ["Bb", "D", "F"]),                   # Bb  (IV)
        (lower + 1.0, ["C", "F", "G", "Bb"], 4, ["F", "G", "Bb"]),        # C11 (V sus)
        (tip - 0.72, ["C", "E", "G", "Bb"], 4, ["E", "G", "Bb"]),         # C7  (V7)
        (tip, ["F", "A", "C"], 4, ["F", "A", "C"]),                       # F   RESOLUTION
        (L08["words"][4]["s"] - 0.05, ["D", "F", "A", "C"], 3, ["F", "A", "C"]),  # Dm7 doubt ("pretend")
        (L08["speechEnd"] + 0.12, ["Bb", "D", "F", "C"], 3, ["D", "F", "C"]),     # Bb(add9) "No."
        (L09["words"][1]["s"], ["F", "A", "C"], 3, ["F", "A", "C"]),       # F/A  "Forgiveness"
        (L09["words"][4]["s"], ["G", "Bb", "D", "F"], 3, ["Bb", "D", "F"]),   # Gm7 "the wrong"
        (L09["words"][7]["s"], ["C", "F", "G"], 3, ["C", "F", "G"]),       # Csus4 "happened"
        (L09["speechEnd"] + 0.05, ["C", "E", "G"], 3, ["C", "E", "G"]),    # C
        (L10["fileStart"] + 0.05, ["F", "A", "C"], 3, ["F", "A", "C"]),    # F    "It means"
        (L10["words"][5]["s"], ["D", "F", "A"], 3, ["D", "F", "A"]),       # Dm   "let hatred"
        (L10["words"][7]["s"], ["Bb", "D", "F"], 3, ["Bb", "D", "F"]),     # Bb   "rule"
        (L10["words"][8]["s"], ["C", "E", "G"], 3, ["C", "E", "G"]),       # C    "the rest of your life"
        (L11["speechStart"] - 0.25, ["A", "C", "E", "G"], 3, ["C", "E", "G"]),  # Am7 "I've let him"
        (L11["words"][5]["s"], ["Bb", "D", "F"], 3, ["Bb", "D", "F"]),     # Bb   "long enough"
        (L11["speechEnd"] - 0.05, ["Bb", "Db", "F", "G"], 3, ["Db", "F", "G"]),  # Bbm6 (minor plagal)
        (gold, ["F", "A", "C"], 4, ["F", "A", "C"]),                       # F    GOLDEN
        (L12["words"][1]["s"] - 0.1, ["D", "F", "A", "C"], 4, ["D", "F", "A", "C"]),  # Dm7 "today"
        (L12["words"][2]["s"], ["Bb", "D", "F", "A"], 4, ["Bb", "D", "F", "A"]),      # Bbmaj7 "you've won"
        (L12["words"][5]["s"] + 0.05, ["C", "F", "G", "Bb"], 4, ["F", "G", "Bb"]),    # C11 "greatest battle"
        (L12["words"][7]["s"], ["C", "E", "G", "Bb"], 4, ["E", "G", "Bb"]),           # C7  "of all"
        (card, ["F", "A", "C"], 4, ["F", "A", "C"]),                       # F    END CARD
    ]
    voicings = voice_lead(chords)
    # pad: dynamics come from layer automation; velocity gives the sample colour
    def pad_vel(t):
        if t < arr:
            return 58
        if look <= t < settle:
            return 74
        if t >= gold:
            return 70
        return 60
    held = {}
    for i, (t, vs) in enumerate(voicings):
        for p in list(held):
            if p not in vs:
                t0 = held.pop(p)
                S.n("pad", p, t0, t + 0.10, pad_vel(t0))
        for p in vs:
            if p not in held:
                held[p] = t
    for p, t0 in held.items():
        S.n("pad", p, t0, END + 0.5, pad_vel(t0))
    # hook: a faint D3/A3 open fifth in the pad, growing into the establishing chord
    S.n("pad", "D3", 1.1, est + 0.6, 50)
    S.n("pad", "A3", 1.6, est + 0.1, 48)

    # ------------------------------------------------------------------ cello (bass line)
    cel = [
        (0.0, "D2"), (est, "D3"), (arr, "Bb2"), (sit - 0.09, "G2"), (t_q_sus, "A2"),
        (lam[0], "D3"), (lam[1], "C#3"), (lam[2], "C3"), (lam[3], "B2"), (lam[4], "Bb2"), (lam[5], "A2"),
        (t_dec, "Bb2"), (chords[8][0], "G2"), (chords[9][0], "A2"), (chords[10][0], "D3"),
        (chords[11][0], "Bb2"), (chords[12][0], "G2"),
        (lower, "Bb2"), (lower + 1.0, "C3"), (tip, "F2"),
        (chords[18][0], "D3"), (chords[19][0], "Bb2"), (chords[20][0], "A2"), (chords[21][0], "G2"),
        (chords[22][0], "C3"), (chords[24][0], "F2"), (chords[25][0], "D3"), (chords[26][0], "Bb2"),
        (chords[27][0], "C3"), (chords[28][0], "A2"), (chords[29][0], "Bb2"), (chords[30][0], "Bb2"),
        (gold, "F2"), (chords[32][0], "D3"), (chords[33][0], "Bb2"), (chords[34][0], "C3"),
        (card, "F2"),
    ]
    S.line("cello", cel, END + 0.5, vel=lambda t: 70 if look <= t < settle else 62)
    S.n("cello", "A2", 0.6, est + 0.15, 52)                       # open-fifth drone in the hook
    # warm tenor line in the golden section (second cello desk): F3 .. E3 (C7) .. A3 (F)
    S.line("cello", [(gold + 0.9, "F3"), (chords[35][0], "E3"), (card, "A3")], END + 0.5, vel=50)

    # ------------------------------------------------------------------ contrabass
    S.n("bass", "D1", 0.0, est + 2.4, 60)                            # hook drone
    S.n("bass", "G1", look, lower + 0.05, 62)                        # swell
    S.n("bass", "Bb1", lower, lower + 1.05, 66)
    S.n("bass", "C2", lower + 1.0, tip + 0.05, 72)
    S.n("bass", "F1", tip, settle + 2.5, 72)                         # resolution
    S.n("bass", "F1", gold, chords[33][0] + 0.05, 62)                # golden pedal
    S.n("bass", "Bb1", chords[33][0], chords[34][0] + 0.05, 60)
    S.n("bass", "C2", chords[34][0], card + 0.05, 62)
    S.n("bass", "F1", card, END + 0.5, 64)

    # ------------------------------------------------------------------ high strings
    # swell: the motif, augmented, transposed: D5 G5 A5 Bb5 -> A5 (major third of F on the tip)
    S.line("high", [(look, "D5"), (lower, "G5"), (lower + 1.0, "A5"), (tip - 0.72, "Bb5"), (tip, "A5")],
           settle + 2.6, vel=lambda t: 70 if t < lower else (76 if t < tip - 0.8 else 84))
    S.line("high", [(look + 0.3, "Bb4"), (lower, "D5"), (lower + 1.0, "F5"), (tip - 0.72, "E5"), (tip, "F5")],
           settle + 2.6, vel=lambda t: 62 if t < tip - 0.8 else 72)
    # golden + end card: a soft sustained two-voice line (+ a high F on the end card)
    S.line("high", [(gold, "A4"), (chords[34][0], "G4"), (card, "A4")], END + 0.5, vel=58)
    S.line("high", [(gold + 0.25, "C5"), (chords[32][0], "D5"), (chords[34][0], "C5"),
                    (chords[35][0], "Bb4"), (card, "C5")], END + 0.5, vel=58)
    S.n("high", "F5", card + 0.3, END + 0.5, 60)

    # ------------------------------------------------------------------ piano
    # hook: single notes, ending on the unresolved b6 (Bb over the D drone)
    S.n("piano", "D4", 0.10, 1.9, 44)
    S.n("piano", "A3", cue["L01"]["words"][3]["e"] + 0.12, 3.2, 40)       # in the "him, ... he" gap
    S.n("piano", "Bb3", cue["L01"]["speechEnd"] + 0.04, est + 0.05, 46)
    S.n("piano", "D2", 0.10, 3.0, 34)
    # establishing: the motif  A3 D4 E4 F4 E4  (rhythm 3/4, 1/2, 1/2, 3/4, 3/2 beats)
    t = est
    for p, d, v in [("A3", 0.75, 50), ("D4", 0.5, 52), ("E4", 0.5, 48), ("F4", 0.75, 54), ("E4", 1.5, 46)]:
        S.n("piano", p, t, t + d * BEAT + 0.35, v)
        t += d * BEAT
    S.n("piano", "D3", est, est + 3.0, 38)
    S.n("piano", "A2", est, est + 3.0, 34)
    # Jesus sits: an answering descent F E D in the gap
    g0 = cue["L02"]["speechEnd"] + 0.18
    for i, (p, v) in enumerate([("F4", 40), ("E4", 36), ("D4", 36)]):
        S.n("piano", p, g0 + i * 0.5, g0 + i * 0.5 + 0.9, v)
    # betrayal: the hook's sigh (b6 -> 5) in the "me. ... He" gap, b9 -> 8 over A7
    gap = L04["words"][6]["e"] + 0.06
    S.n("piano", "Bb3", gap, gap + 0.5, 40)
    S.n("piano", "A3", gap + 0.42, gap + 1.2, 36)
    g2 = L05["words"][2]["e"] + 0.12
    S.n("piano", "Bb4", g2, g2 + 0.5, 38)
    S.n("piano", "A4", g2 + 0.42, g2 + 1.3, 34)
    # "True strength": a single F4 (first major colour)
    S.n("piano", "F4", L06["speechEnd"] + 0.17, L06["speechEnd"] + 1.6, 38)
    # resolution: low octave F under the bloom
    S.n("piano", "F1", tip, tip + 3.5, 56)
    S.n("piano", "F2", tip, tip + 3.5, 52)
    S.n("piano", "C4", tip + 0.02, tip + 2.5, 44)
    S.n("piano", "A4", tip + 0.05, tip + 2.5, 46)
    # "No." -> descending answer in the gap
    gn = L09["words"][0]["e"] + 0.08
    S.n("piano", "D4", gn, gn + 0.6, 38)
    S.n("piano", "C4", gn + 0.4, gn + 1.0, 36)
    # minor plagal: Db -> C, then the motif in F major at goldenStart
    S.n("piano", "Db4", L11["speechEnd"] - 0.02, gold + 0.05, 42)
    t = gold
    for p, d, v in [("C4", 0.75, 50), ("F4", 0.5, 52), ("G4", 0.5, 50), ("A4", 0.75, 54), ("G4", 1.5, 46)]:
        S.n("piano", p, t, t + d * BEAT + 0.4, v)
        t += d * BEAT
    S.n("piano", "F2", gold, gold + 2.5, 40)
    S.n("piano", "C3", gold, gold + 2.5, 36)
    # end card: the motif finally resolves  C F G A G F
    t = card
    for p, d, v in [("C4", 0.75, 50), ("F4", 0.5, 52), ("G4", 0.5, 50), ("A4", 0.75, 54), ("G4", 0.5, 46),
                    ("F4", 4.0, 48)]:
        S.n("piano", p, t, min(END, t + d * BEAT + 0.5), v)
        t += d * BEAT
    S.n("piano", "F2", card, END, 42)
    S.n("piano", "C3", card, END, 38)
    S.n("piano", "A5", t - 4.0 * BEAT + 0.02, END, 30)               # soft bell over the final F

    # ------------------------------------------------------------------ harp
    S.roll("harp", ["D3", "A3", "D4", "F4", "A4"], est, est + 4.0, 50, step=0.11)
    S.roll("harp", ["G2", "D3", "Bb3", "F4"], sit - 0.05, sit + 3.5, 44, step=0.12)
    S.roll("harp", ["Bb2", "F3", "C4", "D4"], t_dec + 0.02, t_dec + 3.0, 44, step=0.12)
    S.roll("harp", ["A2", "C3", "F3", "A3", "C4"], chords[9][0] + 0.02, chords[9][0] + 3.0, 42, step=0.10)
    # swell: rising arpeggios, accelerating into the tip
    S.roll("harp", ["G2", "D3", "G3", "Bb3", "D4", "G4"], look, lower + 0.5, 46, step=0.16)
    S.roll("harp", ["Bb2", "F3", "Bb3", "D4", "F4", "Bb4"], lower, lower + 1.3, 50, step=0.13)
    S.roll("harp", ["C3", "G3", "Bb3", "C4", "F4", "G4", "Bb4"], lower + 1.0, tip, 54, step=0.09)
    # resolution sweep (F major, 2+ octaves in 0.5 s)
    S.roll("harp", ["F2", "C3", "F3", "A3", "C4", "F4", "A4", "C5", "F5", "A5"], tip, tip + 4.0, 62,
           step=0.055, dv=-1)
    S.roll("harp", ["Bb2", "F3", "Bb3", "D4"], chords[19][0] + 0.02, chords[19][0] + 2.5, 40, step=0.12)
    S.roll("harp", ["F2", "C3", "F3", "A3"], chords[24][0], chords[24][0] + 2.5, 40, step=0.12)
    # golden: gentle arpeggiated eighths following the chords
    pat = {
        gold: ["F2", "C3", "F3", "A3", "C4", "F4", "A4", "C4"],
        chords[32][0]: ["D3", "A3", "C4", "F4", "A4", "F4"],
        chords[33][0]: ["Bb2", "F3", "A3", "D4"],
        chords[34][0]: ["C3", "G3", "Bb3", "F4"],
        chords[35][0]: ["C3", "G3", "Bb3", "E4"],
    }
    keys = sorted(pat)
    for i, k in enumerate(keys):
        nxt = keys[i + 1] if i + 1 < len(keys) else card
        step = BEAT / 2
        for j, p in enumerate(pat[k]):
            tt = k + j * step
            if tt >= nxt - 0.05:
                break
            S.n("harp", p, tt, tt + 2.0, 46 - (j % 2) * 4)
    S.roll("harp", ["F2", "C3", "F3", "A3", "C4", "F4", "A4", "C5", "F5"], card, END, 54, step=0.11, dv=-1)

    # ------------------------------------------------------------------ choir (resolution only)
    for p in ["F3", "A3", "C4", "F4"]:
        S.n("choir", p, tip, settle + 2.8, 60)
    for p in ["F3", "A3", "C4", "F4"]:
        S.n("choir", p, card, END + 0.5, 56)
    return S


# ----------------------------------------------------------------------------- automation (dB)
def automation(tl):
    B = tl["beats"]
    cue = {c["id"]: c for c in tl["cues"]}
    est, look, lower, tip, settle = (B["establishStart"], B["swordLookStart"], B["swordLowerStart"],
                                     B["swordTipDown"], B["swordSettleEnd"])
    gold, card, END = B["goldenStart"], B["endCardStart"], tl["duration"]
    off = -80.0
    return {
        "bass": [(0, off), (0.05, -30), (1.2, -4), (est, -5), (est + 2.0, -12), (est + 2.4, off),
                 (look - 0.01, off), (look, -24), (tip - 0.25, -1), (tip - 0.02, -4), (tip, -1),
                 (settle + 1.2, -10), (settle + 2.4, off),
                 (gold - 0.01, off), (gold, -14), (gold + 1.5, -7), (card, -5), (END, -5)],
        "cello": [(0, -40), (0.9, -6), (3.3, -4), (est, -4), (est + 2.5, -6), (13.0, -6),
                  (cue["L04"]["speechStart"], -4), (cue["L05"]["speechEnd"], -4), (look - 0.3, -6),
                  (look, -8), (tip - 0.25, 0), (tip - 0.02, -2), (tip, 0), (settle + 1.5, -7),
                  (gold, -6), (gold + 1.2, -2), (card, -1), (END, -1)],
        "pad": [(0, off), (1.0, -30), (est - 0.1, -12), (est + 1.2, -4), (cue["L02"]["speechStart"], -6),
                (13.2, -7), (look - 0.3, -8), (look, -10), (tip - 0.3, 1), (tip - 0.04, -1.5), (tip, 1),
                (tip + 0.8, 0), (settle + 1.6, -6), (gold - 0.3, -6), (gold + 1.0, -1), (card, 0), (END, 0)],
        "high": [(0, off), (look - 0.01, off), (look, -26), (lower, -14), (tip - 0.3, -1), (tip - 0.04, -3),
                 (tip, 0), (tip + 0.8, -2), (settle + 1.6, -12), (settle + 2.5, off),
                 (gold - 0.01, off), (gold, -20), (gold + 1.2, -9), (card, -5), (END, -5)],
        "piano": [(0, 0), (END, 0)],
        "harp": [(0, 0), (END, 0)],
        "choir": [(0, off), (tip - 0.01, off), (tip, -10), (tip + 1.0, -6), (settle + 1.0, -9),
                  (settle + 2.6, off), (card - 0.01, off), (card, -14), (card + 1.5, -7), (END, -7)],
    }


# ----------------------------------------------------------------------------- render
def _channelize(notes, max_ch=8):
    """Greedy channel assignment so that no two notes of the same pitch overlap on
    one MIDI channel (a note-off would otherwise cut the newer note)."""
    chans = [[] for _ in range(max_ch)]
    for pitch, t0, t1, v in sorted(notes, key=lambda n: (n[1], n[0])):
        for ch in chans:
            if all(not (q == pitch and a < t1 and t0 < b) for q, a, b, _ in ch):
                ch.append((pitch, t0, t1, v))
                break
        else:
            raise RuntimeError("too many overlapping unisons")
    return [c for c in chans if c]


def write_midi(S, layer, p):
    prog = LAYERS[layer][0]
    pm = pretty_midi.PrettyMIDI(initial_tempo=BPM, resolution=960)
    for k, ch_notes in enumerate(_channelize(S.notes[layer])):
        ins = pretty_midi.Instrument(program=prog, name=f"{layer}{k}")
        for cc, val in ((7, 110), (11, 127), (10, 64), (91, 0), (93, 0)):
            ins.control_changes.append(pretty_midi.ControlChange(cc, val, 0.0))
        for pitch, t0, t1, v in ch_notes:
            ins.notes.append(pretty_midi.Note(velocity=max(1, min(127, v)), pitch=pitch,
                                              start=max(0.0, t0), end=t1))
        ins.control_changes.append(pretty_midi.ControlChange(11, 127, 64.0))   # keep the file long enough
        pm.instruments.append(ins)
    pm.write(p)
    return pm


def write_full_midi(S, p):
    pm = pretty_midi.PrettyMIDI(initial_tempo=BPM, resolution=960)
    for layer, (prog, _, _) in LAYERS.items():
        ins = pretty_midi.Instrument(program=prog, name=layer)
        for pitch, t0, t1, v in sorted(S.notes[layer], key=lambda n: (n[1], n[0])):
            ins.notes.append(pretty_midi.Note(velocity=v, pitch=pitch, start=max(0.0, t0), end=t1))
        pm.instruments.append(ins)
    pm.write(p)


def fluid_render(mid, wav):
    subprocess.run(["fluidsynth", "-ni", "-R", "0", "-C", "0", "-g", "0.6", "-r", str(SR),
                    "-F", wav, SF2, mid], check=True, capture_output=True)
    x, sr = sf.read(wav, always_2d=True)
    assert sr == SR
    return x.astype(np.float64)


def make_ir(rt60=2.9, length=4.5, predelay=0.024, seed=1607):
    """Synthetic stereo hall IR: decorrelated decaying noise, HF decays faster,
    a soft build-up and a handful of early reflections."""
    rng = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bands = [(None, 400.0, rt60 * 1.15), (400.0, 1800.0, rt60), (1800.0, 5000.0, rt60 * 0.72),
             (5000.0, None, rt60 * 0.42)]
    for ch in range(2):
        nz = rng.standard_normal(n)
        acc = np.zeros(n)
        for lo, hi, rt in bands:
            if lo is None:
                b = signal.sosfilt(signal.butter(2, hi, "lowpass", fs=SR, output="sos"), nz)
            elif hi is None:
                b = signal.sosfilt(signal.butter(2, lo, "highpass", fs=SR, output="sos"), nz)
            else:
                b = signal.sosfilt(signal.butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), nz)
            acc += b * np.exp(-6.9078 * t / rt)
        acc *= 1.0 - np.exp(-t / 0.018)                       # diffuse build-up
        er_t = [0.011, 0.017, 0.023, 0.031, 0.038, 0.047, 0.059, 0.071]
        er_g = rng.uniform(0.25, 0.6, len(er_t)) * np.exp(-np.array(er_t) / 0.06)
        for tt, g in zip(er_t, er_g):
            k = int((tt + 0.0031 * ch * (1 if tt > 0.03 else -1)) * SR)
            acc[k] += g * (1 if rng.uniform() > 0.5 else -1) * 3.0
        ir[:, ch] = acc
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(axis=0).mean())
    return ir


def reverb(x, ir, wet_hp=180.0, wet_lp=9000.0):
    w = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    w = hpf(w, wet_hp, 2)
    w = lpf(w, wet_lp, 2)
    return w


def build(tl=None, verbose=True):
    """Compose, render each layer with FluidSynth, mix with automation + reverb.
    Returns (stereo music, dict of per-layer dry renders)."""
    tl = tl or timeline()
    ensure_dirs()
    N = n_total(tl)
    S = compose(tl)
    write_full_midi(S, os.path.join(BUILD, "score_full.mid"))
    auto = automation(tl)
    dry_sum = np.zeros((N, 2))
    send_sum = np.zeros((N, 2))
    layers = {}
    for layer, (prog, pan_, send) in LAYERS.items():
        mid = os.path.join(BUILD, f"score_{layer}.mid")
        wav = os.path.join(BUILD, f"score_{layer}.wav")
        write_midi(S, layer, mid)
        x = fluid_render(mid, wav)
        y = np.zeros((N, 2))
        y[: min(N, len(x))] = x[:N]
        # per-layer tone shaping
        if layer == "bass":
            y = lpf(hpf(y, 30.0, 2), 900.0, 2)
        elif layer == "cello":
            y = eq(hpf(y, 45.0, 2), ("peak", 220.0, -1.5, 1.0))
        elif layer in ("pad", "high"):
            y = eq(hpf(y, 110.0, 2), ("peak", 2600.0, -2.0, 0.9), ("highshelf", 7000.0, -3.0, 0.7))
        elif layer == "piano":
            y = eq(hpf(y, 60.0, 2), ("peak", 3000.0, -1.0, 1.0), ("highshelf", 8000.0, -2.0, 0.7))
        elif layer == "harp":
            y = hpf(y, 80.0, 2)
        elif layer == "choir":
            y = eq(hpf(y, 150.0, 2), ("peak", 3000.0, -3.0, 0.8), ("highshelf", 6000.0, -4.0, 0.7))
        y = balance(y, pan_)
        y *= undb(LAYER_GAIN_DB[layer]) * curve(N, auto[layer])[:, None]
        layers[layer] = y
        dry_sum += y
        send_sum += y * send
        if verbose:
            pk = 20 * np.log10(np.abs(y).max() + 1e-12)
            print(f"  score layer {layer:6s} notes={len(S.notes[layer]):3d} peak={pk:6.1f} dBFS")
    ir = make_ir()
    wet = reverb(send_sum, ir)
    music = dry_sum + wet * undb(-4.0)
    # final fade-out: clean, over the last 1.5 s
    B = tl["beats"]
    fo = 1.5
    music = fade(music, 0.0, fo)
    return music, layers


if __name__ == "__main__":
    from common import write, OUT, lufs, true_peak_db
    tl = timeline()
    m, _ = build(tl)
    write(os.path.join(BUILD, "music_raw.wav"), m * 0.5)
    print("music raw LUFS", lufs(m), "TP", true_peak_db(m))
