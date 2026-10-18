"""Foley: subtle, picture-synced body sounds built from the ElevenLabs SFX
(audio/sfx/*.mp3), with a synthesised blade ring added on the sword moment.

Every event is aligned on its detected transient/onset and levelled to a
target momentary loudness (dB, 400 ms RMS of the K-weighted-ish band) in the
same pre-master domain as the dialogue (lines at dialogue.LINE_LUFS).
"""
import os

import numpy as np
from scipy.signal import find_peaks

from common import SR, load, path, n_total, hpf, lpf, eq, fade, place, pan, frame_rms, timeline

SFX = "audio/sfx/"
FOOTSTEP_INTERVAL = 0.55      # brief: ~0.55 s apart, establishStart -> jesusArrive


def _mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def _seg(x, a, b, fin=0.008, fout=0.08):
    s = x[int(a * SR):int(b * SR)].copy()
    return fade(s, fin, fout)


def _env_db(x, win=0.005):
    return 20 * np.log10(frame_rms(_mono(x), win) + 1e-10)     # 1 ms grid


def _onset(x, rel=-20.0):
    """Time (s) where the envelope first rises to within `rel` dB of its peak."""
    e = _env_db(x)
    k = int(np.argmax(e))
    above = np.flatnonzero(e[:k + 1] < e[k] + rel)
    return (above[-1] + 1 if len(above) else 0) / 1000.0


def _peak_t(x):
    return int(np.argmax(_env_db(x))) / 1000.0


def _level(x):
    """Momentary level: max 400 ms RMS (dBFS) after a speech-ish weighting."""
    y = hpf(_mono(x), 120.0, 2)
    return float(20 * np.log10(frame_rms(y, 0.4).max() + 1e-12))


def _at(x, target):
    return x * 10 ** ((target - _level(x)) / 20.0)


def blade_ring(dur=2.2, f0=742.0, seed=5):
    """Modal ring of a long steel blade (free-free bar ratios), slightly detuned pairs."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    ratios = [1.0, 2.756, 5.404, 8.933]
    t60 = [1.7, 1.15, 0.7, 0.42]
    amps = [1.0, 0.55, 0.32, 0.16]
    y = np.zeros_like(t)
    for r, d, a in zip(ratios, t60, amps):
        for det in (-0.6, 0.7):
            ph = rng.uniform(0, 2 * np.pi)
            y += a * np.sin(2 * np.pi * (f0 * r + det * r) * t + ph) * np.exp(-6.9 * t / d)
    y *= 1 - np.exp(-t / 0.0015)
    return y / np.abs(y).max()


def build(tl=None):
    tl = tl or timeline()
    B = tl["beats"]
    cue = {c["id"]: c for c in tl["cues"]}
    N = n_total(tl)
    out = np.zeros((N, 2))
    ev = []

    def put(x, t, target, p=0.0, label=""):
        x = _at(x, target)
        place(out, pan(_mono(x), p) if p else (x if x.ndim == 2 else np.stack([x, x], 1)), t)
        ev.append((label, round(t, 3), target))

    # --- grip creak (hook): first creak peaks at ~0.2 s, a second, softer tightening on "find him"
    g = load(path(SFX + "grip_creak.mp3"), 2)
    c1 = _seg(g, 0.0, 0.62, 0.01, 0.12)
    c2 = _seg(g, 0.78, 1.45, 0.02, 0.15)
    put(c1, 0.20 - _peak_t(c1), -40.0, 0.0, "grip creak 1")
    put(c2, cue["L01"]["words"][2]["s"] - 0.10, -44.0, 0.0, "grip creak 2")

    # --- footsteps on grass: individual steps re-timed onto an even ~0.55 s grid
    fs = load(path(SFX + "footsteps_grass.mp3"), 2)
    e = _env_db(fs)
    pk, _ = find_peaks(e, distance=350, prominence=12)
    steps = []
    for k in pk:
        t = k / 1000.0
        if t - 0.06 < 0 or t + 0.38 > len(fs) / SR:
            continue
        steps.append(_seg(fs, t - 0.06, t + 0.38, 0.01, 0.14))
    t0, t1 = B["establishStart"], B["jesusArrive"]
    n_steps = int(round((t1 - t0) / FOOTSTEP_INTERVAL)) + 1
    dt = (t1 - t0) / (n_steps - 1)
    for i in range(n_steps):
        s = steps[(i * 3) % len(steps)]
        u = i / max(1, n_steps - 1)
        lvl = -45.0 + 7.0 * u - (1.5 if i == n_steps - 1 else 0.0)     # approaching; last step settles
        s = lpf(s, 5000.0 + 5000.0 * u, 2)                               # distant -> closer
        put(s, t0 + i * dt - 0.06, lvl, 0.10 * (1 if i % 2 else -1) * (1 - 0.5 * u), f"step {i + 1}")

    # --- robe rustle as Jesus sits
    r = load(path(SFX + "robe_rustle.mp3"), 2)
    rr = _seg(r, 0.0, 1.75, 0.01, 0.3)
    put(rr, B["jesusSitStart"] - _onset(rr), -38.0, 0.12, "robe rustle")

    # --- armour
    a = load(path(SFX + "armor_shift.mp3"), 2) * 0.89          # source peaks at +0.6 dBFS
    a_look = _seg(a, 0.12, 1.05, 0.01, 0.2)
    a_relax = _seg(a, 1.08, 1.85, 0.02, 0.25)
    a_soft = lpf(_seg(a, 0.12, 0.95, 0.02, 0.25), 6000.0, 2)
    put(a_look, B["swordLookStart"] - _onset(a_look), -35.0, -0.08, "armour: looks at sword")
    # relax: the settle clink lands as the hands come to rest on the hilt (swordSettleEnd)
    put(a_relax, B["swordSettleEnd"] - _peak_t(a_relax), -38.0, -0.08, "armour: relaxes")
    # the exhale on L11 (shoulders drop), very soft
    put(lpf(_seg(a, 1.08, 1.48, 0.03, 0.2), 4500.0, 2), cue["L11"]["fileStart"] + 0.25, -46.0, -0.08,
        "armour: exhale settle")
    put(a_soft, B["goldenStart"] - _onset(a_soft), -41.0, -0.05, "armour: golden shift")

    # --- sword tip into the ground: earthy thud (file) + soft metallic ring (synth)
    sg = load(path(SFX + "sword_ground.mp3"), 2)
    hit = _seg(sg, 1.38, 2.45, 0.004, 0.3)
    hit = eq(hit, ("lowshelf", 150.0, 2.0, 0.7))
    put(hit, B["swordTipDown"] - _onset(hit, -24.0), -30.0, -0.05, "sword thud")
    ring = blade_ring()
    ring = hpf(ring, 500.0, 2)
    put(ring, B["swordTipDown"] + 0.004, -41.0, -0.05, "blade ring")

    return out, ev
