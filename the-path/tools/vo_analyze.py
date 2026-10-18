"""Phase 3: measure both VO takes and choose one.

For each take: decode the delivered MP3 (gapless trim honoured), snap Scribe's word
times to the waveform, map the pauses, scan for clicks and spectral glitches,
measure loudness and pitch, check the two words the brief flags (Duolingo, chess)
and test whether every segment fits its window with pause-only edits.

Writes vo/analysis.json (committed) and out/review/vo_takes.png.

usage: .venv/bin/python -I tools/vo_analyze.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from audio import loudness, voice, voplan  # noqa: E402

TAKES = json.loads((ROOT / "vo/takes.json").read_text(encoding="utf-8"))
TL = json.loads((ROOT / "brief/timeline.json").read_text(encoding="utf-8"))
OUT = ROOT / "out/review"
FONT = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 15)
BOLD = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 18)

def chess_check(x, w, sr=voice.SR):
    """/tS/ + short /E/ + /s/: report the high-band share at the onset and the coda, and
    the voiced (vowel) duration."""
    seg = x[int(w.onset * sr): int(w.end * sr)]
    hi = voice.envelope(voice.band(seg, 4000, 11000)).db
    lo = voice.envelope(voice.band(seg, 250, 2500)).db
    n = len(hi)
    onset_ratio = float(np.mean(hi[: n // 6]) - np.mean(lo[: n // 6]))
    coda_ratio = float(np.mean(hi[-n // 4:]) - np.mean(lo[-n // 4:]))
    voiced = lo > lo.max() - 12
    return {"onset_high_minus_low_db": round(onset_ratio, 1), "coda_high_minus_low_db": round(coda_ratio, 1),
            "vowel_s": round(float(voiced.sum() * voice.HOP / sr), 3)}


def analyze(take):
    x = voice.decode(ROOT / take["file"])
    env = voice.envelope(x)
    scribe = json.loads((ROOT / take["scribe"]).read_text(encoding="utf-8"))["words"]
    words = voice.align(x, scribe, env)
    segs = voplan.segment_words(words, TL)
    pz = voice.pauses(x, words, env)
    times, f0 = voice.f0_track(x)
    clean = [(p.t0, p.t1) for p in pz if not p.events and p.length > 0.2]
    rt = voice.room_tone(x, clean)
    clicks = voice.clicks(x, env)
    # sounds in pauses that are not a word's tail or lead-in (decays, releases, inhales)
    stray = [(p.after, p.before, ev) for p in pz for ev in p.events if ev[0] in ("click", "breath/noise")]
    # AR-residual clicks outside every word and outside its tail
    stray_clicks = [c for c in clicks if not any(w.onset - 0.03 <= c[0] <= w.end + 0.08 for w in words)]
    disc = voice.discontinuities(x, env)
    fits = [voplan.fit(ws, TL, i + 1) for i, ws in enumerate(segs)]
    cw = voplan.course_word_solve(segs[5], TL)[1]
    duo = next(w for w in words if w.text.startswith("Duolingo"))
    chess = next(w for w in words if w.text.startswith("chess"))
    voiced = f0[~np.isnan(f0)]
    seg_f0 = []
    for ws in segs:
        m = (times >= ws[0].onset) & (times <= ws[-1].end) & ~np.isnan(f0)
        seg_f0.append(round(float(np.median(f0[m])), 1) if m.any() else None)
    speech = sum(w.end - w.onset for w in words)
    res = {
        "take": take["id"], "file": take["file"], "duration_s": round(len(x) / voice.SR, 3),
        "transcript_exact": " ".join(w["text"] for w in scribe) == TL["vo"]["script"],
        "integrated_lufs": round(loudness.integrated(x), 2),
        "true_peak_dbtp": round(loudness.true_peak(x), 2),
        "sample_peak_dbfs": round(loudness.sample_peak(x), 2),
        "noise_floor_dbfs": round(env.floor, 1),
        "room_tone": None if rt is None else {"t0": round(float(rt[0]), 3), "t1": round(float(rt[1]), 3), "rms_dbfs": round(float(rt[2]), 1), "spread_db": round(float(rt[3]), 1)},
        "f0_median_hz": round(float(np.median(voiced)), 1),
        "f0_range_st": round(float(np.percentile(voice.semitones(voiced), 95) - np.percentile(voice.semitones(voiced), 5)), 1),
        "segment_f0_median_hz": seg_f0,
        "words_per_s_of_speech": round(len(words) / speech, 2),
        "clicks_all": len(clicks), "clicks_stray": stray_clicks, "stray_sounds_in_pauses": stray,
        "spectral_jumps": disc,
        "pauses": [{"after": p.after, "before": p.before, "t0": round(p.t0, 3), "t1": round(p.t1, 3),
                    "len_s": round(p.length, 3), "safe": [round(p.safe0, 3), round(p.safe1, 3)], "events": p.events} for p in pz],
        "segments": fits,
        "course_words": cw,
        "duolingo": {"onset": round(duo.onset, 3), "end": round(duo.end, 3), "length_s": round(duo.end - duo.onset, 3)},
        "chess": {"onset": round(chess.onset, 3), "end": round(chess.end, 3), **chess_check(x, chess)},
        "scribe_vs_waveform_ms": {
            "onset_median": round(float(np.median([abs(w.onset - w.scribe_start) for w in words])) * 1000),
            "onset_max": round(float(np.max([abs(w.onset - w.scribe_start) for w in words])) * 1000),
        },
        "words": [w.as_dict() for w in words],
    }
    return res, x, env, words


# --------------------------------------------------------------- review art

def review_image(results):
    pxs = 150
    rows = []
    for res, x, env, words in results:
        S = voice.stft_db(x, 1024, 240)
        S = S[:, : int(10000 / (voice.SR / 1024))].T[::-1]
        img = np.clip((S - (S.max() - 90)) / 90, 0, 1)
        W = int(len(x) / voice.SR * pxs)
        spec = cv2.resize(cv2.applyColorMap((img * 255).astype(np.uint8), cv2.COLORMAP_MAGMA), (W, 220), interpolation=cv2.INTER_AREA)
        lvl = np.full((120, W, 3), 12, np.uint8)
        for d in (-60, -50, -40, -30, -20):
            y = int((-d - 10) / 60 * 119)
            cv2.line(lvl, (0, y), (W, y), (45, 45, 45), 1)
        xs = (env.t(np.arange(len(env.db))) * pxs).astype(int)
        ys = ((-env.db - 10) / 60 * 119).clip(0, 119).astype(int)
        cv2.polylines(lvl, [np.stack([xs, ys], 1).reshape(-1, 1, 2)], False, (90, 220, 120), 1)
        band = np.vstack([np.full((44, W, 3), 6, np.uint8), spec, lvl, np.full((54, W, 3), 6, np.uint8)])
        im = Image.fromarray(band[..., ::-1])
        d = ImageDraw.Draw(im)
        for p in res["pauses"]:
            d.rectangle([p["t0"] * pxs, 264, p["t1"] * pxs, 384], outline=(80, 120, 160))
            d.text((p["t0"] * pxs + 2, 266), f"{p['len_s']:.2f}", font=FONT, fill=(120, 170, 220))
            for kind, a, b, lv in p["events"]:
                d.rectangle([a * pxs, 300, max(b * pxs, a * pxs + 2), 384], fill=(200, 60, 60))
        for t, _ in res["clicks_stray"]:
            d.line([(t * pxs, 44), (t * pxs, 384)], fill=(255, 60, 60), width=2)
        for t, _ in res["spectral_jumps"]:
            d.polygon([(t * pxs - 5, 44), (t * pxs + 5, 44), (t * pxs, 54)], fill=(255, 220, 0))
        for w in words:
            d.line([(w.onset * pxs, 44), (w.onset * pxs, 384)], fill=(0, 200, 255), width=1)
            d.text((w.onset * pxs + 2, 388), w.text, font=FONT, fill=(230, 230, 230))
        segs = voplan.segment_words(words, TL)
        for ws, ft in zip(segs, res["segments"]):
            col = {"natural": (88, 204, 2), "pause trims": (255, 200, 0), "NO": (255, 75, 75)}[ft["fits"]]
            d.rectangle([ws[0].onset * pxs, 26, ws[-1].end * pxs, 40], fill=col)
            d.text((ws[0].onset * pxs + 3, 4), f"{ft['n']}: {ft['natural_s']:.2f}s / {ft['window_s']:.2f}s {ft['fits']}", font=FONT, fill=col)
        for s in range(int(len(x) / voice.SR) + 1):
            d.text((s * pxs + 2, 368), f"{s}s", font=FONT, fill=(140, 140, 140))
        rows.append((res, im))
    W = max(im.width for _, im in rows) + 20
    sheet = Image.new("RGB", (W, sum(im.height + 40 for _, im in rows) + 20), (6, 10, 12))
    d = ImageDraw.Draw(sheet)
    y = 10
    for res, im in rows:
        d.text((10, y), f"Take {res['take']}  ({res['duration_s']:.2f} s, {res['integrated_lufs']:.1f} LUFS, floor {res['noise_floor_dbfs']:.0f} dBFS)  "
               f"segment bars: green fits, amber fits with pause trims, red does not fit; red lines = stray clicks; yellow = spectral jumps",
               font=BOLD, fill=(226, 232, 235))
        sheet.paste(im, (10, y + 30))
        y += im.height + 40
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / "vo_takes.png")


def main():
    results = [analyze(t) for t in TAKES["takes"]]
    summary = {"script": TL["vo"]["script"], "takes": [r[0] for r in results]}
    (ROOT / "vo/analysis.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    review_image(results)
    for res, *_ in results:
        print(f"== take {res['take']}  {res['duration_s']} s  exact={res['transcript_exact']}  {res['integrated_lufs']} LUFS  "
              f"TP {res['true_peak_dbtp']} dBTP  floor {res['noise_floor_dbfs']} dBFS  f0 {res['f0_median_hz']} Hz / {res['f0_range_st']} st  "
              f"{res['words_per_s_of_speech']} w/s")
        print(f"   AR clicks: {res['clicks_all']} total, outside words {res['clicks_stray']}   spectral jumps: {res['spectral_jumps']}")
        print(f"   stray sounds in pauses: {res['stray_sounds_in_pauses']}")
        print(f"   room tone {res['room_tone']}   scribe-vs-waveform onset ms {res['scribe_vs_waveform_ms']}")
        for s in res["segments"]:
            print(f"   seg {s['n']}: natural {s['natural_s']:.3f}  window {s['window_s']:.3f}  over {s['over_s']:.3f}  -> {s['fits']}"
                  f"  k={s['pause_factor']}  pauses {[(p['after'], p['len_s']) for p in s['inner_pauses']]}")
        cw = res["course_words"]
        print(f"   course words natural {cw['natural_onsets']}  best {cw['best_onsets']}  err ms {cw['best_error_ms']}  changes {cw['pause_changes_s']}")
        print(f"   Duolingo {res['duolingo']}   chess {res['chess']}")
        print("   pauses:", [(p['after'], p['len_s'], p['safe'], [e[0] for e in p['events']]) for p in res['pauses']])


if __name__ == "__main__":
    main()
