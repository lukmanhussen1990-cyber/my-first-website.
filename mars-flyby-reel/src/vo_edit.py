"""Edit the ElevenLabs take onto the 45.0 s timeline.

Phrases are cut at real pauses, re-spaced with natural gaps, each line is
sped up slightly (WSOLA, pitch preserved) and placed in its scene window.
Writes vo_edit.wav (48 kHz mono, raw level) and vo_plan.json.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

SR = 48000
TOTAL = 45.0

# (phrase start, phrase end) in take-2 seconds, gap AFTER the phrase (s, pre-stretch)
LINES = [
    dict(start=0.06, tempo=1.10, phrases=[(0.17, 1.08, 0.12), (1.52, 3.13, 0.22), (3.75, 5.23, 0)]),
    dict(start=4.36, tempo=1.14, phrases=[(7.25, 7.82, 0.12), (9.08, 11.56, 0.20), (11.92, 12.74, 0.20),
                                          (13.01, 13.98, 0)]),
    dict(start=9.55, tempo=1.10, phrases=[(16.37, 16.98, 0.12), (17.18, 18.53, 0.24), (19.43, 23.42, 0)]),
    dict(start=16.25, tempo=1.10, phrases=[(24.95, 28.95, 0)]),
    dict(start=21.90, tempo=1.10, phrases=[(30.82, 33.47, 0.14), (33.88, 36.62, 0.26), (38.12, 40.26, 0)]),
    dict(start=29.58, tempo=1.10, phrases=[(42.12, 43.84, 0.24), (45.07, 47.28, 0.24), (48.31, 50.04, 0)]),
    dict(start=35.85, tempo=1.10, phrases=[(51.66, 52.30, 0.14), (52.61, 53.39, 0.26), (54.61, 55.41, 0.14),
                                           (56.02, 56.77, 0.10), (57.08, 57.56, 0.10), (57.92, 58.95, 0)]),
    dict(start=41.10, tempo=1.10, phrases=[(60.99, 62.02, 0.24), (63.52, 64.66, 0.12), (65.15, 66.08, 0)]),
]
PRE, POST = 0.03, 0.05     # keep soft onsets and natural decays around each phrase


def refine_bounds(x, a, b):
    """Snap phrase edges to where the RMS envelope crosses -48 dBFS (5 ms hop)."""
    hop = int(0.005 * SR)
    seg = x[max(0, int((a - 0.25) * SR)): int((b + 0.25) * SR)]
    n = len(seg) // hop
    rms = np.sqrt(np.mean(seg[: n * hop].reshape(n, hop) ** 2, 1) + 1e-12)
    db = 20 * np.log10(rms)
    on = np.nonzero(db > -48)[0]
    base = max(0, int((a - 0.25) * SR)) / SR
    if len(on) == 0:
        return a, b
    a2 = base + on[0] * 0.005
    b2 = base + (on[-1] + 1) * 0.005
    # never swallow a neighbouring phrase: stay within +/-0.2 s of the detected edges
    return max(a2, a - 0.2), min(b2, b + 0.2)


def stretch(y, tempo):
    with tempfile.TemporaryDirectory() as td:
        i, o = os.path.join(td, "i.wav"), os.path.join(td, "o.wav")
        sf.write(i, y, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", i,
                        "-af", f"atempo={tempo:.5f}", "-c:a", "pcm_f32le", o], check=True)
        z, _ = sf.read(o, dtype="float32")
    return z


def build(take_path, out_dir):
    x, sr = sf.read(take_path, dtype="float32")
    assert sr == SR
    out = np.zeros(int(TOTAL * SR), np.float32)
    plan = []
    for li, line in enumerate(LINES):
        parts, segmap, t = [], [], 0.0
        for (a, b, gap) in line["phrases"]:
            a, b = a - PRE, b + POST
            y = x[int(a * SR): int(b * SR)].copy()
            fi, fo = int(0.008 * SR), int(0.02 * SR)
            y[:fi] *= np.linspace(0, 1, fi)
            y[-fo:] *= np.linspace(1, 0, fo)
            parts.append(y)
            segmap.append((a, b, t))
            t += len(y) / SR
            if gap:
                parts.append(np.zeros(int(gap * SR), np.float32))
                t += gap
        line_audio = np.concatenate(parts)
        z = stretch(line_audio, line["tempo"])
        s0 = int(line["start"] * SR)
        out[s0: s0 + len(z)] += z[: len(out) - s0]
        end = line["start"] + len(z) / SR
        plan.append(dict(line=li, start=line["start"], end=round(end, 3), tempo=line["tempo"],
                         segments=[dict(src_a=a, src_b=b, line_t=lt) for a, b, lt in segmap]))
        print(f"line {li + 1}: {line['start']:6.2f} -> {end:6.2f}  ({len(z) / SR:.2f} s, tempo {line['tempo']})")
    sf.write(os.path.join(out_dir, "vo_edit.wav"), out, SR, subtype="FLOAT")
    json.dump(plan, open(os.path.join(out_dir, "vo_plan.json"), "w"), indent=1)
    return plan


def map_time(plan, t_src):
    """Map a time in the original take to the edited timeline."""
    best = None
    for p in plan:
        for seg in p["segments"]:
            d = max(seg["src_a"] - t_src, t_src - seg["src_b"], 0.0)
            if best is None or d < best[0]:
                tc = min(max(t_src, seg["src_a"]), seg["src_b"])
                best = (d, p["start"] + (seg["line_t"] + (tc - seg["src_a"])) / p["tempo"])
    return best[1]


if __name__ == "__main__":
    take, out_dir = sys.argv[1], sys.argv[2]
    plan = build(take, out_dir)
    if len(sys.argv) > 3:
        words = json.load(open(sys.argv[3]))
        mapped = []
        for w in words:
            s, e = map_time(plan, w["start"]), map_time(plan, w["end"])
            mapped.append(dict(word=w["word"], start=round(s, 3), end=round(e, 3)))
        json.dump(mapped, open(os.path.join(out_dir, "words_mapped.json"), "w"), indent=1)
        print("mapped", len(mapped), "words; last word ends", mapped[-1]["end"])
