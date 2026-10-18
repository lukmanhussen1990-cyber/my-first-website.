"""Dialogue: per-line cleanup, levelling and placement on per-character stems,
plus mouth-openness envelopes for lip sync.

Per line (cue.file placed at cue.fileStart):
  1. high-pass 75 Hz (3rd-order Butterworth, 18 dB/oct)
  2. downward expansion ONLY outside detected speech (gaps / tails); broadband
     smoothed gain, no spectral processing -> no musical-noise artefacts
  3. light RMS compression (2:1, soft knee, ~2-4 dB on the loudest syllables)
  4. gentle clarity EQ (-1.5 dB @ 250 Hz, +1.5 dB @ 3.2 kHz)
  5. integrated-loudness match: every line normalised to LINE_LUFS
No reverb / echo is added.
"""
import numpy as np
from scipy.ndimage import maximum_filter1d

from common import (SR, HOP, load, path, n_total, hpf, eq, frame_rms, ar_smooth,
                    control_to_audio, undb, lufs, fade, timeline, bpf)

LINE_LUFS = -20.0          # working level for every line (master gain is applied later)
SPEAKERS = ("JESUS", "KNIGHT")


def _db(v):
    return 20 * np.log10(np.maximum(v, 1e-10))


def speech_mask(lev_db, ref_db, on_rel=-17.0, hold=0.22, pre=0.05, post=0.14):
    """Boolean speech-activity mask on the 1 ms control grid.

    Speech = level above ref+on_rel; gaps shorter than `hold` are bridged; the
    mask is widened by `pre`/`post` so onsets and natural word tails are kept.
    """
    m = lev_db > ref_db + on_rel
    n = len(m)
    hop_s = HOP / SR
    # bridge short gaps
    idx = np.flatnonzero(m)
    if len(idx):
        gaps = np.diff(idx)
        for k in np.flatnonzero((gaps > 1) & (gaps * hop_s <= hold)):
            m[idx[k]:idx[k + 1]] = True
    # widen
    out = m.copy()
    a, b = int(pre / hop_s), int(post / hop_s)
    on = np.flatnonzero(np.diff(m.astype(int)) == 1) + 1
    off = np.flatnonzero(np.diff(m.astype(int)) == -1) + 1
    if m[0]:
        on = np.r_[0, on]
    if m[-1]:
        off = np.r_[off, n]
    for s, e in zip(on, off):
        out[max(0, s - a):min(n, e + b)] = True
    return out


def process_line(x):
    """Return (processed mono line, info dict)."""
    x = hpf(x, 75.0, order=3)
    x = fade(x, 0.004, 0.03)
    n = len(x)

    # ---- analysis on the 1 ms grid
    lev = _db(frame_rms(x, 0.010))
    active = lev[lev > lev.max() - 45]
    ref = float(np.percentile(active, 90))            # loud-speech reference
    floor = float(np.percentile(lev, 8))               # gap / noise floor estimate

    # ---- 2. downward expansion outside speech only
    mask = speech_mask(lev, ref)
    T = ref - 19.0                                     # expansion threshold
    ratio = 2.5
    rng = 14.0
    g_exp = np.clip((lev - T) * (ratio - 1.0), -rng, 0.0)
    g_exp[mask] = 0.0
    # look-ahead 15 ms for opening, 3 ms open / 140 ms close smoothing (in dB)
    la = int(0.015 * SR / HOP) + 1
    g_la = maximum_filter1d(g_exp, size=la, origin=-(la // 2), mode="nearest")
    g_exp_s = ar_smooth(g_la, attack=0.003, release=0.140)       # "up" = opening
    gain_exp = undb(control_to_audio(g_exp_s, n))
    y = x * gain_exp

    # ---- 3. light compression (RMS 5 ms detector)
    lev2 = _db(frame_rms(y, 0.005))
    thr, cr, knee = ref - 4.0, 2.0, 6.0
    over = lev2 - thr
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 / cr - 1),
                           (1 / cr - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    # gr is <= 0; attack 8 ms (gr falling), release 120 ms
    gr_s = ar_smooth(gr, attack=0.120, release=0.008)   # rising gr == releasing
    y = y * undb(control_to_audio(gr_s, n))

    # ---- 4. clarity EQ
    y = eq(y, ("peak", 250.0, -1.5, 0.9), ("peak", 3200.0, 1.5, 0.8))

    # ---- 5. loudness match
    L = lufs(y)
    y = y * undb(LINE_LUFS - L)
    info = dict(ref_db=round(ref, 1), floor_db=round(floor, 1), src_lufs=None,
                pre_norm_lufs=round(L, 2), max_comp_db=round(float(gr_s.min()), 1),
                exp_db_min=round(float(g_exp_s.min()), 1),
                gap_reduction_db=round(float(np.median(g_exp_s[~mask])) if (~mask).any() else 0.0, 1))
    return y, info


def build(tl=None):
    """Process all cues. Returns dict(speaker -> mono full-length track), per-line info."""
    tl = tl or timeline()
    N = n_total(tl)
    tracks = {s: np.zeros(N) for s in SPEAKERS}
    lines = []
    for cue in tl["cues"]:
        raw = load(path(cue["file"]))
        y, info = process_line(raw)
        info.update(id=cue["id"], speaker=cue["speaker"], start=cue["fileStart"],
                    src_lufs=round(lufs(raw), 2), dur=round(len(raw) / SR, 3))
        i0 = int(round(cue["fileStart"] * SR))
        n = min(len(y), N - i0)
        tracks[cue["speaker"]][i0:i0 + n] += y[:n]
        lines.append(info)
    return tracks, lines


# ----------------------------------------------------------------------------- lip sync
def mouth(tl, tracks, gate_db=-30.0):
    """Per-frame mouth openness (0..1) per speaker.

    Envelope = 15 ms RMS of the speech band (150 Hz-4 kHz) of the processed
    dialogue, smoothed with attack 30 ms / release 80 ms, normalised per line to
    its 95th percentile, soft-gated `gate_db` below that, mildly compressed.
    """
    fps = tl["fps"]
    F = tl["frames"]
    out = {"fps": fps}
    hop_s = HOP / SR
    for spk in SPEAKERS:
        x = bpf(tracks[spk], 150.0, 4000.0, order=2)
        env = frame_rms(x, 0.015)
        env = ar_smooth(env, attack=0.030, release=0.080)
        t = np.arange(len(env)) * hop_s
        openv = np.zeros_like(env)
        for cue in tl["cues"]:
            if cue["speaker"] != spk:
                continue
            a = int(cue["fileStart"] / hop_s)
            b = min(len(env), int((cue["fileStart"] + cue["fileDur"] + 0.1) / hop_s))
            seg = env[a:b]
            if not len(seg) or seg.max() <= 0:
                continue
            p95 = np.percentile(seg[seg > seg.max() * 0.03], 95)
            rel_db = 20 * np.log10(np.maximum(seg / p95, 1e-6))
            lin = np.clip(seg / p95, 0.0, 1.0) ** 0.75
            # soft gate: 0 below gate_db, full above gate_db+8
            g = np.clip((rel_db - gate_db) / 8.0, 0.0, 1.0)
            v = lin * g
            # non-word sounds (e.g. the "[exhales]" before L11) only part the lips
            tt = t[a:b]
            words = (tt >= cue["speechStart"] - 0.12) & (tt <= cue["speechEnd"] + 0.30)
            v = np.where(words, v, np.minimum(v, 0.3))
            openv[a:b] = np.maximum(openv[a:b], v)
        frames = []
        for i in range(F):
            s = int(i / fps / hop_s)
            e = max(s + 1, int((i + 1) / fps / hop_s))
            v = float(openv[s:e].mean()) if s < len(openv) else 0.0
            frames.append(round(v if v >= 0.02 else 0.0, 3))
        out[spk] = frames
    return out
