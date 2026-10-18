"""Phase 3: edit the chosen take at its own pauses, process the VO stem, measure it and
lock the timeline to it.

  1. Every segment's first word lands on its anchor frame (sound starts at frame * 800).
  2. Pauses change only where audio/voplan.py says so.  An edited pause keeps the
     previous word's tail and the next word's lead-in and replaces the middle with the
     take's own room tone (10 ms equal-power crossfades at zero crossings).  Speech is
     never cut, stretched or pitch-shifted.
  3. VO chain: notches on the take's 60 / 120 Hz hum, 90 Hz high-pass, gentle
     compression, pause expander, -16 LUFS, true-peak ceiling -1.5 dBTP.
  4. The finished stem is measured again (every word onset, anchor frames, end
     limits, loudness) and brief/timeline.json is locked to it: events tied to a word,
     the cues and text that follow them, and the measured VO segments.

Writes out/vo/vo_stem.wav (git-ignored), vo/edit.json, vo/words.json, brief/timeline.json.

usage: .venv/bin/python -I tools/vo_edit.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from audio import dynamics, loudness, synth, voice, voplan  # noqa: E402

SR = voice.SR
XF = 480          # 10 ms crossfade
H = XF // 2
FPS = voplan.FPS
TL_PATH = ROOT / "brief/timeline.json"
TL = json.loads(TL_PATH.read_text(encoding="utf-8"))
TAKES = json.loads((ROOT / "vo/takes.json").read_text(encoding="utf-8"))
N_OUT = TL["total_frames"] * TL["samples_per_frame"]
TARGET_LUFS = -16.0
CEILING_DBTP = -1.5
CHAIN = {
    "hum_notch_hz": [60.0, 120.0],
    "highpass": {"hz": 90, "order": 4},
    "compressor": {"threshold_db": -14.0, "ratio": 2.5, "knee_db": 6.0, "attack_ms": 5.0, "release_ms": 80.0, "rms_ms": 10.0},
    "expander": {"above_floor_db": 10.0, "ratio": 3.0, "range_db": 10.0, "open_ms": 1.0, "hold_ms": 60.0, "close_ms": 120.0, "lookahead_ms": 5.0},
    "loudness_lufs": TARGET_LUFS,
    "true_peak_ceiling_dbtp": CEILING_DBTP,
}


def ep_ramps(n):
    u = (np.arange(n) + 0.5) / n
    return np.sin(0.5 * np.pi * u), np.cos(0.5 * np.pi * u)


FADE_IN, FADE_OUT = ep_ramps(XF)


class RoomTone:
    """The take's own room tone: every clean stretch of its pauses (no clicks or
    breaths, within 3 dB of the floor) joined with equal-power crossfades and repeated
    to length.  Fills are read consecutively, each starting at a zero crossing."""

    def __init__(self, x, env, pauses, seconds=12.0):
        pieces, self.sources = [], []
        for p in pauses:
            a, b = p.safe0 + 0.01, p.safe1 - 0.01
            if b - a < 0.1 or any(e[0] in ("click", "breath/noise") and e[1] < b and e[2] > a for e in p.events):
                continue
            seg = x[int(a * SR):int(b * SR)]
            if 10 * np.log10(np.mean(seg ** 2) + 1e-14) > env.floor + 3.0:
                continue
            pieces.append(seg)
            self.sources.append([round(a, 3), round(b, 3)])
        pool = pieces[0]
        while len(pool) < seconds * SR:
            for seg in pieces[1:] + pieces[:1]:
                pool = np.concatenate([pool[:-XF], pool[-XF:] * FADE_OUT + seg[:XF] * FADE_IN, seg[XF:]])
        self.pool, self.pos, self.unique_s = pool, 0, sum(len(p) for p in pieces) / SR

    def take(self, n):
        start = voice.splice_point(self.pool, self.pos / SR) if self.pos else 0
        assert start + n <= len(self.pool), "room tone pool exhausted"
        self.pos = start + n + SR // 10  # skip 100 ms so neighbouring fills never repeat material
        return self.pool[start:start + n]


def build(x, words, pz, plan, room):
    """Spans in output samples: ('take', d0, d1, src0) or ('fill', d0, d1).  Adjacent
    spans meet at a join and crossfade over join +/- 5 ms."""
    by_word = {p.index: p for p in pz}
    gidx = {id(w): i for i, w in enumerate(words)}
    spans, edits = [], []
    cursor_d, cursor_src = 0, None   # output position reached; source sample of the open take span

    def cut(p, off_left, off_right, why):
        nonlocal cursor_d, cursor_src
        L = voice.splice_point(x, p.safe0)
        R = voice.splice_point(x, p.safe1)
        d_join1, d_join2 = off_left + L, off_right + R
        assert d_join2 - d_join1 >= XF, f"pause after '{p.after}' too short for a room-tone fill"
        spans.append(("take", cursor_d, d_join1, cursor_src))
        spans.append(("fill", d_join1, d_join2))
        edits.append({"after": p.after, "before": p.before, "why": why,
                      "natural_s": round(p.length, 4),
                      "new_s": round((off_right + round(p.t1 * SR) - off_left - round(p.t0 * SR)) / SR, 4),
                      "kept_tail_s": round(L / SR - p.t0, 4), "kept_lead_in_s": round(p.t1 - R / SR, 4),
                      "room_tone_s": round((d_join2 - d_join1) / SR, 4),
                      "removed": [e for e in p.events if e[0] in ("click", "breath/noise")]})
        cursor_d, cursor_src = d_join2, R

    first = plan[0]
    off = first["frame"] * TL["samples_per_frame"] - round(first["words"][0].onset * SR)
    spans.append(("fill", 0, off + H))   # lead-in: room tone, then the take's own first 58 ms
    cursor_d, cursor_src = off + H, H
    placed = {}
    for k, seg in enumerate(plan):
        ws = seg["words"]
        if k:
            new_off = seg["frame"] * TL["samples_per_frame"] - round(ws[0].onset * SR)
            cut(by_word[gidx[id(ws[0])]], off, new_off, f"segment {seg['n']} on its anchor (f{seg['frame']})")
            off = new_off
        for j, w in enumerate(ws):
            if j and j in seg["new_pauses"]:
                new_off = off + round((seg["new_pauses"][j] - w.pause_before) * SR)
                cut(by_word[gidx[id(w)]], off, new_off, f"segment {seg['n']} inner pause")
                off = new_off
            placed[gidx[id(w)]] = off
    end_src = len(x) - H
    spans.append(("take", cursor_d, off + end_src, cursor_src))
    tail_d = off + end_src
    spans.append(("fill", tail_d, tail_d + int(0.30 * SR)))
    return spans, edits, placed


def render(x, spans, room):
    y = np.zeros(N_OUT + SR)
    log = []
    for i, s in enumerate(spans):
        kind, d0, d1 = s[0], s[1], s[2]
        pre = 0 if i == 0 else H
        post = H
        n = d1 - d0 + pre + post
        if kind == "take":
            src0 = s[3]
            clip = x[src0 - pre:src0 - pre + n].copy()
            log.append({"kind": "take", "src_t0": round(src0 / SR, 4), "src_t1": round((src0 + d1 - d0) / SR, 4),
                        "dst_t0": round(d0 / SR, 4), "dst_t1": round(d1 / SR, 4)})
        else:
            clip = room.take(n).copy()
            log.append({"kind": "room tone", "dst_t0": round(d0 / SR, 4), "dst_t1": round(d1 / SR, 4)})
        if i == 0:
            clip[:XF] *= np.linspace(0, 1, XF)          # fade up from digital silence at frame 0
        else:
            clip[:XF] *= FADE_IN
        if i == len(spans) - 1:
            m = int(0.25 * SR)
            clip[-m:] *= np.cos(0.5 * np.pi * np.linspace(0, 1, m)) ** 2   # room tone fades out after the last word
        else:
            clip[-XF:] *= FADE_OUT
        y[d0 - pre:d0 - pre + n] += clip
    return y[:N_OUT], log


def chain(y, floor_db):
    out = {}
    y = synth.notches(y, CHAIN["hum_notch_hz"])
    y = synth.highpass(y, CHAIN["highpass"]["hz"], order=CHAIN["highpass"]["order"])
    g0 = TARGET_LUFS - loudness.integrated(y)
    y = y * 10 ** (g0 / 20)
    y, gc = dynamics.compressor(y, **CHAIN["compressor"])
    e = CHAIN["expander"]
    thr = floor_db + g0 + e["above_floor_db"]
    y, ge = dynamics.expander(y, threshold_db=thr, ratio=e["ratio"], range_db=e["range_db"], open_ms=e["open_ms"],
                              hold_ms=e["hold_ms"], close_ms=e["close_ms"], lookahead_ms=e["lookahead_ms"])
    g1 = TARGET_LUFS - loudness.integrated(y)
    y = y * 10 ** (g1 / 20)
    y, gl = dynamics.tp_limiter(y, ceiling_dbtp=CEILING_DBTP)
    for _ in range(3):   # the limiter can shave a few hundredths of a LU; trim back and re-limit
        d = TARGET_LUFS - loudness.integrated(y)
        if abs(d) < 0.02:
            break
        y, gl2 = dynamics.tp_limiter(y * 10 ** (d / 20), ceiling_dbtp=CEILING_DBTP)
        gl = np.minimum(gl, gl2)
    out.update({
        "static_gain_db": round(g0 + g1, 2), "expander_threshold_dbfs": round(thr, 1),
        "compressor_max_gr_db": round(float(-gc.min()), 2),
        "compressor_time_over_1db_pct": round(float(np.mean(gc < -1.0) * 100), 1),
        "expander_max_gr_db": round(float(-ge.min()), 2),
        "limiter_max_gr_db": round(float(-gl.min()), 2),
    })
    return y, out


def measure(stem, plan, floor_equiv):
    """Re-align the finished stem: Scribe-style search windows from the plan, the same
    detector as the take analysis with the take's floor carried through the gain."""
    env = voice.envelope(stem)
    env.floor = floor_equiv
    pseudo = []
    for seg in plan:
        for w, t in zip(seg["words"], seg["onsets"]):
            pseudo.append({"text": w.text, "start": t, "end": t + (w.end - w.onset)})
    return voice.align(stem, pseudo, env)


def lock_timeline(tl, words_out, seg_out):
    """Move every word-tied event, cue and text window to the measured stem."""
    by_seg = {}
    for w in words_out:
        by_seg.setdefault(w["segment"], []).append(w)
    ev = {e["id"]: e for e in tl["events"]}
    moved = []
    for e in tl["events"]:
        lock = e.get("vo_lock")
        if lock:
            w = by_seg[lock["segment"]][lock["index"]]
            f = w["onset_f"] + lock.get("offset_f", 0)
            if e.get("f") != f:
                moved.append((e["id"], e.get("f", round(e.get("given_t", e.get("t", 0)) * FPS)), f))
            e["f"] = f
            e.pop("t", None)
    for e in tl["events"]:
        fol = e.get("follows")
        if fol:
            f = ev[fol["event"]]["f"] + fol["offset_f"]
            if e.get("f") != f:
                moved.append((e["id"], e.get("f"), f))
            e["f"] = f
    for c in tl["sfx"]:
        fol = c.get("follows")
        if fol:
            src = ev[fol["event"]]
            f = (src["f"] if "f" in src else round(src["t"] * FPS)) + fol["offset_f"]
            if c["f"] != f:
                moved.append((f"sfx {c['n']} {c['name']}", c["f"], f))
            c["f"] = f
    for r in tl["text_on_screen"]:
        fol = r.get("follows")
        if fol:
            f = ev[fol["event"]]["f"] + fol["offset_f"]
            if r["readable_f"][0] != f:
                moved.append((f"text '{r['text']}'", r["readable_f"][0], f))
            r["readable_f"][0] = f
    for seg, m in zip(tl["vo"]["segments"], seg_out):
        seg["measured"] = m
    tl["vo"]["take"] = {"id": TAKES["chosen"], "edit": "vo/edit.json", "words": "vo/words.json"}
    tl["version"] = "phase3-voice-locked"
    return moved


def main():
    take = next(t for t in TAKES["takes"] if t["id"] == TAKES["chosen"])
    src = ROOT / take["file"]
    sha = hashlib.sha256(src.read_bytes()).hexdigest()
    assert sha == take["sha256"], "take file does not match vo/takes.json"
    x = voice.decode(src)
    env = voice.envelope(x)
    scribe = json.loads((ROOT / take["scribe"]).read_text(encoding="utf-8"))["words"]
    words = voice.align(x, scribe, env)
    pz = voice.pauses(x, words, env)
    plan = voplan.plan(words, TL)
    room = RoomTone(x, env, pz)
    spans, edits, placed = build(x, words, pz, plan, room)
    raw, edl = render(x, spans, room)
    stem, chain_report = chain(raw, env.floor)

    out_dir = ROOT / "out/vo"
    out_dir.mkdir(parents=True, exist_ok=True)
    synth.write_wav(out_dir / "vo_stem.wav", stem, bits=24, mono=True)
    synth.write_wav(out_dir / "vo_edit_raw.wav", raw * 10 ** (chain_report["static_gain_db"] / 20), bits=24, mono=True)

    # ---- word times in film time: the take's measured times carried through the EDL
    # (sample-exact; the chain is gain-only and zero-phase), then checked on the stem
    floor_equiv = env.floor + chain_report["static_gain_db"]
    meas = measure(stem, plan, floor_equiv)
    words_out, seg_out, checks = [], [], []
    gi = 0
    for seg in plan:
        for j, w in enumerate(seg["words"]):
            off = placed[gi] / SR
            m = meas[gi]
            clear = j == 0 or w.pause_before >= voplan.MIN_PAUSE
            words_out.append({
                "segment": seg["n"], "index": j, "text": w.text,
                "onset_t": round(off + w.onset, 4), "onset_f": int(round((off + w.onset) * FPS)),
                "nucleus_t": round(off + w.nucleus, 4), "end_t": round(off + w.end, 4), "end_f": int(round((off + w.end) * FPS)),
                "take_onset_t": round(w.onset, 4),
                "stem_onset_t": round(m.onset, 4),
                "boundary": "after a pause" if clear else "joined to the previous word",
            })
            gi += 1
        ws_out = words_out[-len(seg["words"]):]
        first, last = ws_out[0], ws_out[-1]
        lim = voplan.end_limit(TL, seg["n"])
        seg_out.append({"onset_t": first["onset_t"], "onset_f": first["onset_f"], "end_t": last["end_t"], "end_f": last["end_f"],
                        "end_limit_t": round(lim, 3)})
        checks.append({
            "segment": seg["n"], "anchor_f": seg["frame"], "onset_f": first["onset_f"],
            "anchor_ok": first["onset_f"] == seg["frame"] and int(round(first["stem_onset_t"] * FPS)) == seg["frame"],
            "end_t": last["end_t"], "end_limit_t": round(lim, 3), "end_ok": last["end_t"] <= lim + 1e-3,
        })
    clear_dev = [abs(w["stem_onset_t"] - w["onset_t"]) for w in words_out if w["boundary"] == "after a pause"]

    lufs = loudness.integrated(stem)
    tp = loudness.true_peak(stem)
    speech_mask = np.zeros(len(stem), bool)
    for w in words_out:
        speech_mask[int(w["onset_t"] * SR):int(w["end_t"] * SR)] = True
    gaps = stem[(~speech_mask) & (np.arange(len(stem)) < int((words_out[-1]["end_t"]) * SR))]
    fills = np.concatenate([stem[int(e["dst_t0"] * SR) + 2400:int(e["dst_t1"] * SR) - 2400] for e in edl
                            if e["kind"] == "room tone" and e["dst_t1"] - e["dst_t0"] > 0.2 and e["dst_t0"] > 0.1])
    result = {
        "integrated_lufs": round(lufs, 2), "true_peak_dbtp": round(tp, 2), "sample_peak_dbfs": round(loudness.sample_peak(stem), 2),
        "loudness_range_note": "BS.1770-4 gated; NumPy meter (audio/loudness.py)",
        "between_words_rms_dbfs": round(float(10 * np.log10(np.mean(gaps ** 2) + 1e-14)), 1),
        "room_tone_fill_rms_dbfs": round(float(10 * np.log10(np.mean(fills ** 2) + 1e-14)), 1),
        "stem_recheck_max_deviation_ms": round(max(clear_dev) * 1000, 1),
        "stem_recheck_words": len(clear_dev),
        "anchors_on_frame": all(c["anchor_ok"] for c in checks), "segments_end_in_time": all(c["end_ok"] for c in checks),
    }

    seg_report = []
    for seg, c, m in zip(plan, checks, seg_out):
        ws = seg["words"]
        seg_report.append({
            "n": seg["n"], "text": TL["vo"]["segments"][seg["n"] - 1]["text"],
            "anchor_t": TL["vo"]["segments"][seg["n"] - 1]["anchor_t"], "frame": seg["frame"], "sample": seg["frame"] * TL["samples_per_frame"],
            "fit": seg["fit"]["fits"], "natural_s": seg["fit"]["natural_s"], "window_s": seg["fit"]["window_s"],
            "pause_changes": [{"after": ws[j - 1].text, "natural_s": round(ws[j].pause_before, 4), "new_s": round(v, 4)}
                              for j, v in sorted(seg["new_pauses"].items())],
            "course_words": seg["course_words"], **m, "anchor_ok": c["anchor_ok"], "end_ok": c["end_ok"],
        })
    edit = {
        "about": "Edit decision list for the VO stem. Rebuild with tools/vo_edit.py (deterministic).",
        "take": take["id"], "source": take["file"], "source_sha256": sha,
        "decode": "FFmpeg (gapless trim) + SoX resampler at 28-bit precision, 44.1 -> 48 kHz",
        "rules": {"shrink_min": voplan.SHRINK_MIN, "grow_max": voplan.GROW_MAX, "punctuation_min_s": voplan.PUNCT_MIN,
                  "sentence_gap_s": voplan.GAP_AFTER, "min_change_s": voplan.MIN_CHANGE, "crossfade_ms": 10},
        "segments": seg_report,
        "pause_edits": edits,
        "room_tone": {"sources_take_t": room.sources, "unique_s": round(room.unique_s, 3)},
        "edl": edl,
        "chain": {**CHAIN, **chain_report},
        "result": result,
    }
    (ROOT / "vo/edit.json").write_text(json.dumps(edit, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (ROOT / "vo/words.json").write_text(json.dumps({"about": ("Final word timings of the VO stem in film time (60 fps; frame = round(t * 60)): "
                                                              "the take's measured word times carried sample-exactly through the edit. stem_onset_t is an "
                                                              "independent re-measurement of out/vo/vo_stem.wav (reliable for words after a pause)."),
                                                    "words": words_out}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    moved = lock_timeline(TL, words_out, seg_out)
    TL_PATH.write_text(json.dumps(TL, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"take {take['id']}  stem {lufs:.2f} LUFS  TP {tp:.2f} dBTP  chain {chain_report}")
    print(f"room tone pool from {len(room.sources)} pauses ({room.unique_s:.2f} s unique); between words {result['between_words_rms_dbfs']} dBFS, "
          f"inside fills {result['room_tone_fill_rms_dbfs']} dBFS")
    for c in checks:
        print(f"  seg {c['segment']}: onset f{c['onset_f']} (anchor f{c['anchor_f']}) {'ok' if c['anchor_ok'] else 'OFF'}   end {c['end_t']:.3f} <= {c['end_limit_t']:.3f} {'ok' if c['end_ok'] else 'LATE'}")
    for e in edits:
        print(f"  pause after {e['after']!r:13} {e['natural_s']:.3f} -> {e['new_s']:.3f} s  ({e['why']}; tail {e['kept_tail_s']:.3f}, lead-in {e['kept_lead_in_s']:.3f}, room tone {e['room_tone_s']:.3f}) removed {e['removed']}")
    print(f"stem re-check: {len(clear_dev)} words after pauses, max deviation {result['stem_recheck_max_deviation_ms']} ms")
    for m in moved:
        print("  moved:", m)


if __name__ == "__main__":
    main()
