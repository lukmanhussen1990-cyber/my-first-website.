"""Shared cue sheet: every visual beat and SFX hit derives from the word timings."""
import numpy as np

from timing import word_time as wt, DURATION

# rocking rhythm (bench reps disguised as the steamy rhythm) - locked to the spoken words
BEATS1 = [0.08, 0.58, 1.42, 2.38, 3.14, 3.98, 4.78, 5.50, 6.16, 6.96, 7.62]
BEATS3 = [8.28, 8.66, 9.04, 9.40, 9.74, 9.94, 10.36, 10.70, 11.02, 11.38, 11.66, 11.90, 12.12, 12.32]
BEATS = BEATS1 + [7.98] + BEATS3

HEARTBEATS = [8.2, 8.95, 9.65, 10.3, 10.85, 11.3, 11.7, 12.05, 12.36]
HEARTBEATS_PAUSE = [24.32, 24.72]

# scene cut list
CUTS = dict(
    s1=0.0, s1b=2.30, s1c=3.90,
    s2=5.45, s2b=6.90,
    s3=8.15, s3b=8.85, s3c=9.50, s3d=9.88, s3e=10.98, s3f=11.40,
    s4=12.47,
    s5=15.62, s5b=17.05, s5c=17.95,
    s6=18.97,
    s7=21.22, s7b=22.30, s7c=22.92,
    s8=23.48, s8b=24.98, s8c=25.70,
    s9=26.52,
    s10=29.33,
    end=DURATION,
)

CLACK = CUTS["s4"]
BLAST = CUTS["s5c"] + 0.02          # "rip"
PUSH_IN_FINGERS = wt("SPOTTING")
CLAP = wt("FIVE")                    # 25.98
SNIFF = wt("SMELLS")                 # 24.06
GRIN = wt("GIVES") - 0.25
SCRATCH = CUTS["s10"] - 0.02
GENIUS = wt("GENIUS")
LETTER_LAND = wt("GAS'S")            # last sign letter lands exactly on "Gas's"
T_DROP = CUTS["s9"] + 0.38
DOOR_SLAM = 23.22
TRAINER_THROW = 22.58
ECHOES = [19.55, 20.15, 20.75]
# 12 people leaving (counter ticks)
EXITS = [21.30 + k * 0.075 for k in range(12)]


def rock_phase(t):
    b = np.array(BEATS)
    idx = np.arange(len(b), dtype=float)
    if t < b[0]:
        return (t - b[0]) / 0.6
    if t > b[-1]:
        return idx[-1] + (t - b[-1]) / 0.22
    return float(np.interp(t, b, idx))


def rock(t):
    """Smooth push wave in [-1, 1]; -1 at each beat (the push)."""
    s = 0.0
    for d in (-0.05, 0.0, 0.05):
        s += -np.cos(2 * np.pi * rock_phase(t + d))
    return s / 3.0
