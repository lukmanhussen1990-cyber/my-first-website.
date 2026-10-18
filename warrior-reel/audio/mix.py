"""Final mix + mastering + stems + lip-sync + loudness report.

Signal flow (all 48 kHz float, pre-master domain where every dialogue line is
normalised to dialogue.LINE_LUFS):

  dialogue_JESUS, dialogue_KNIGHT  ------------------------------+
  music (score.py) --- x MUSIC gain --- duck (-DUCK_DB under speech) ---+--> sum --> master gain --> TP limiter --> mix.wav
  river + birds (ambience.py) --- levels/automation --- duck (-AMB_DUCK_DB) --+
  foley (foley.py) -----------------------------------------------+

Stems in out/audio/stems/ are the post-fader, post-duck signals times the
master gain (they sum to mix.wav before the limiter).  out/audio/music.wav is
the score alone, un-ducked, at the same scale.
"""
import json
import os

import numpy as np
from scipy.ndimage import maximum_filter1d

from common import (SR, OUT, STEMS, BUILD, n_total, timeline, write, stereo, lufs, true_peak_db,
                    sample_peak_db, tp_limiter, frame_rms, ar_smooth, control_to_audio, undb, curve,
                    fade, short_term_lufs, ensure_dirs, HOP)
import dialogue
import score
import ambience
import foley

TARGET_LUFS = -14.0
CEILING_DBTP = -1.5          # limiter ceiling (spec: <= -1 dBTP; margin for the AAC encode)
DUCK_DB = 9.0                # music under speech
AMB_DUCK_DB = 3.0            # ambience under speech
MUSIC_LUFS = dialogue.LINE_LUFS - 7.0     # un-ducked score, integrated (pre-master)
RIVER_LUFS = dialogue.LINE_LUFS - 15.0    # un-ducked river bed (=> ~-30 LUFS under dialogue after master)
BIRDS_LUFS = dialogue.LINE_LUFS - 22.0
SB_MIN = 15.5               # dialogue-protection: min dialogue/background ratio per line (LU)


def speech_activity(tracks, N, lookahead=0.15, attack=0.05, release=0.45, bridge=0.35):
    """0..1 smoothed sidechain from the summed dialogue stems (sample rate)."""
    key = tracks["JESUS"] + tracks["KNIGHT"]
    lev = 20 * np.log10(frame_rms(key, 0.03) + 1e-10)
    on = lev > dialogue.LINE_LUFS - 24.0
    idx = np.flatnonzero(on)
    if len(idx):
        gaps = np.diff(idx)
        for k in np.flatnonzero((gaps > 1) & (gaps <= bridge * 1000)):
            on[idx[k]:idx[k + 1]] = True
    a = on.astype(float)
    la = int(lookahead * SR / HOP)
    a = maximum_filter1d(a, size=la + 1, origin=-(la // 2), mode="nearest")
    a = ar_smooth(a, attack=attack, release=release)
    return np.clip(control_to_audio(a, N), 0.0, 1.0)


def window(N, t0, t1, ramp):
    """0..1 raised-cosine window: 1 on [t0, t1], ramps of `ramp` s outside."""
    t = np.arange(N) / SR
    u = np.clip(np.minimum((t - (t0 - ramp)) / ramp, ((t1 + ramp) - t) / ramp), 0.0, 1.0)
    return 0.5 - 0.5 * np.cos(np.pi * u)


def main():
    ensure_dirs()
    tl = timeline()
    N = n_total(tl)
    B = tl["beats"]
    END = tl["duration"]
    print(f"[audio] duration {END} s -> {N} samples @ {SR} Hz")

    # ---------------------------------------------------------------- dialogue
    print("[audio] dialogue ...")
    tracks, lines = dialogue.build(tl)
    mouth = dialogue.mouth(tl, tracks)
    with open(os.path.join(OUT, "mouth.json"), "w") as f:
        json.dump(mouth, f, separators=(",", ":"))
    act = speech_activity(tracks, N)

    # ---------------------------------------------------------------- music
    print("[audio] score (pretty_midi -> fluidsynth) ...")
    music, layers = score.build(tl)
    m_l = lufs(music)
    music = music * undb(MUSIC_LUFS - m_l)
    duck = undb(-DUCK_DB * act)[:, None]
    music_d = music * duck

    # ---------------------------------------------------------------- ambience
    print("[audio] ambience ...")
    amb = ambience.build(tl)
    river = amb["river"] * undb(RIVER_LUFS - lufs(amb["river"]))
    birds = amb["birds"] * undb(BIRDS_LUFS - lufs(amb["birds"]))
    est, gold, card = B["establishStart"], B["goldenStart"], B["endCardStart"]
    river *= curve(N, [(0, 0.0), (est, 0.0), (gold, 0.0), (gold + 2.0, -1.0), (card, -1.5),
                       (END - 2.5, -2.0), (END, -2.0)])[:, None]
    birds *= curve(N, [(0, -60.0), (est - 0.6, -30.0), (est + 2.0, 0.0), (gold, 0.0), (gold + 2.0, 2.5),
                       (card, 2.0), (END, 2.0)])[:, None]
    amb_d = (river + birds) * undb(-AMB_DUCK_DB * act)[:, None]
    amb_d = fade(amb_d, 0.06, 2.5)

    # ---------------------------------------------------------------- foley
    print("[audio] foley ...")
    fol, events = foley.build(tl)

    # ---------------------------------------------------------------- dialogue protection
    # Any line whose dialogue/background ratio is below SB_MIN gets an extra, smoothly
    # ramped music dip over its speech span (max 6 dB).  Deterministic, iterated.
    dJ, dK = stereo(tracks["JESUS"]), stereo(tracks["KNIGHT"])
    dsum = dJ + dK
    extra_db = np.zeros(N)
    protect = []
    for c in tl["cues"]:
        a, b = int(c["speechStart"] * SR), int(c["speechEnd"] * SR)
        add = 0.0
        for _ in range(4):
            bg = music_d[a:b] * undb(extra_db[a:b])[:, None] + amb_d[a:b] + fol[a:b]
            sb = lufs(dsum[a:b]) - lufs(bg)
            if sb >= SB_MIN or add >= 6.0:
                break
            step = min(6.0 - add, SB_MIN - sb + 0.3)
            add += step
            w = window(N, c["speechStart"] - 0.2, c["speechEnd"] + 0.1, 0.25)
            extra_db = np.minimum(extra_db, -add * w)
        if add > 0:
            protect.append((c["id"], round(add, 1)))
    music_d = music_d * undb(extra_db)[:, None]

    # ---------------------------------------------------------------- master
    pre = music_d + amb_d + fol + dJ + dK
    g_db = TARGET_LUFS - lufs(pre)
    for it in range(4):
        mix, gr = tp_limiter(pre * undb(g_db), CEILING_DBTP)
        L = lufs(mix)
        if abs(L - TARGET_LUFS) < 0.03:
            break
        g_db += TARGET_LUFS - L
    G = undb(g_db)
    mix = mix[:N]
    assert len(mix) == N

    # ---------------------------------------------------------------- write
    print("[audio] writing ...")
    stems = {
        "dialogue_JESUS": dJ * G,
        "dialogue_KNIGHT": dK * G,
        "music": music_d * G,
        "ambience": amb_d * G,
        "foley": fol * G,
    }
    write(os.path.join(OUT, "mix.wav"), mix)
    write(os.path.join(OUT, "music.wav"), music * G)
    for k, v in stems.items():
        write(os.path.join(STEMS, f"{k}.wav"), v)

    # ---------------------------------------------------------------- report
    rep = {"duration_s": END, "samples": N, "sample_rate": SR, "format": "WAV PCM 24-bit stereo",
           "master_gain_db": round(g_db, 2), "limiter_max_gr_db": round(float(20 * np.log10(gr.min())), 2),
           "limiter_samples_active_pct": round(float((gr < 0.999).mean() * 100), 3),
           "files": {}}

    def meas(x):
        return {"lufs_i": round(lufs(x), 2), "true_peak_dbtp": round(true_peak_db(x), 2),
                "sample_peak_dbfs": round(sample_peak_db(x), 2)}

    rep["files"]["mix.wav"] = meas(mix)
    rep["files"]["music.wav (un-ducked score)"] = meas(music * G)
    for k, v in stems.items():
        rep["files"][f"stems/{k}.wav"] = meas(v)
    # per-line: dialogue loudness vs everything else during the line
    bg = (music_d + amb_d + fol) * G
    per_line = []
    for c in tl["cues"]:
        a, b = int(c["speechStart"] * SR), int(c["speechEnd"] * SR)
        d = (dJ + dK)[a:b] * G
        per_line.append({"id": c["id"], "speaker": c["speaker"], "src_lufs": None,
                         "dialogue_lufs": round(lufs(d), 2), "background_lufs": round(lufs(bg[a:b]), 2),
                         "snr_lu": round(lufs(d) - lufs(bg[a:b]), 1)})
    for pl, ln in zip(per_line, lines):
        pl["src_lufs"] = ln["src_lufs"]
        pl["comp_max_db"] = ln["max_comp_db"]
        pl["gap_expansion_median_db"] = ln["gap_reduction_db"]
    rep["dialogue_lines"] = per_line
    t, st = short_term_lufs(mix)
    m_t, m_st = short_term_lufs(music_d * G)
    rep["short_term_mix_lufs"] = {"max": round(float(st.max()), 1),
                                  "p10": round(float(np.percentile(st[st > -70], 10)), 1)}
    gated = st[st > -70]
    gated = gated[gated > np.percentile(gated, 0) - 0]
    rel = gated[gated > (10 * np.log10(np.mean(10 ** (gated / 10))) - 20)]
    rep["lra_lu"] = round(float(np.percentile(rel, 95) - np.percentile(rel, 10)), 1)
    beats_music = {}
    for name in ("hookStart", "establishStart", "swordLookStart", "swordTipDown", "goldenStart", "endCardStart"):
        i = int(np.argmin(np.abs(m_t - (B[name] + 1.5))))
        beats_music[name] = round(float(m_st[i]), 1)
    rep["music_short_term_lufs_at_beats(+1.5s)"] = beats_music
    rep["dialogue_protection_extra_music_dip_db"] = dict(protect)
    rep["foley_events"] = [{"event": e[0], "t": e[1], "level_db": e[2]} for e in events]
    with open(os.path.join(OUT, "report.json"), "w") as f:
        json.dump(rep, f, indent=1)
    write_text_report(rep)
    print_summary(rep)
    return rep


def write_text_report(rep):
    L = []
    L.append("Warrior Reel - audio loudness report (python3 audio/build_all.py)")
    L.append(f"duration {rep['duration_s']} s = {rep['samples']} samples @ {rep['sample_rate']} Hz, {rep['format']}")
    L.append(f"master gain {rep['master_gain_db']:+.2f} dB, limiter max GR {rep['limiter_max_gr_db']:.2f} dB "
             f"(active on {rep['limiter_samples_active_pct']} % of samples)")
    L.append("")
    L.append(f"{'file':34s} {'LUFS-I':>8s} {'dBTP':>7s} {'peak dBFS':>10s}")
    for k, v in rep["files"].items():
        L.append(f"{k:34s} {v['lufs_i']:8.2f} {v['true_peak_dbtp']:7.2f} {v['sample_peak_dbfs']:10.2f}")
    L.append(f"mix short-term max {rep['short_term_mix_lufs']['max']} LUFS, LRA ~{rep['lra_lu']} LU")
    L.append("")
    L.append("dialogue lines (speech span): dialogue LUFS vs. music+ambience+foley LUFS")
    for d in rep["dialogue_lines"]:
        L.append(f"  {d['id']} {d['speaker']:6s} src {d['src_lufs']:7.2f} -> {d['dialogue_lufs']:7.2f} LUFS | "
                 f"bg {d['background_lufs']:7.2f} | S/B {d['snr_lu']:5.1f} LU | comp {d['comp_max_db']} dB | "
                 f"gap exp {d['gap_expansion_median_db']} dB")
    L.append("")
    L.append("music short-term LUFS 1.5 s after beats: " +
             ", ".join(f"{k} {v}" for k, v in rep["music_short_term_lufs_at_beats(+1.5s)"].items()))
    L.append("extra music dip for dialogue protection: " + (", ".join(f"{k} {v} dB" for k, v in
             rep["dialogue_protection_extra_music_dip_db"].items()) or "none"))
    L.append("foley events: " + "; ".join(f"{e['event']} @{e['t']}s" for e in rep["foley_events"]))
    with open(os.path.join(OUT, "report.txt"), "w") as f:
        f.write("\n".join(L) + "\n")


def print_summary(rep):
    with open(os.path.join(OUT, "report.txt")) as f:
        print(f.read())


if __name__ == "__main__":
    main()
