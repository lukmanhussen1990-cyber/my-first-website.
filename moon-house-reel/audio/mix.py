"""Place the narrator lines on the timeline and mix voice + music + SFX.

    python audio/mix.py            # uses voice/timings.json (+ voice/line_XX.wav)

Placement: each line starts at its scene's "vo" time. Lines with two sentences
("But ... . So ... .") are split in the pause between them and the second
sentence is anchored to the scene's "cue" time, where the animation shows the
fix. So any voice (Piper, ElevenLabs, ...) lines up with the fixed 3D render.

Writes:
    build/voice_layout.json   absolute word times (used for the subtitles)
    build/voice_track.wav     the placed narration (mono)
    build/mix.wav             final stereo mix, -14 LUFS integrated, <= -1 dBTP
"""
import json
import os
import re
import sys

import numpy as np
import pyloudnorm as pyln
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, SR, load_script, load_timeline, load_timings, read_wav, write_wav  # noqa: E402

BUILD = os.path.join(ROOT, "build")
MIN_GAP = 0.18          # shortest pause allowed before the anchored 2nd sentence
TARGET_LUFS = -14.0     # Instagram-friendly master loudness
VOICE_LUFS = -15.5      # narration level before the master normalisation
MUSIC_LUFS = -26.5      # quiet music bed (ducked further under the voice)
SFX_LUFS = -24.5


def sentence_split(text, nwords):
    """Index of the first word of the 2nd sentence (or None)."""
    sents = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]
    if len(sents) < 2:
        return None
    k = len(sents[0].split())
    return k if 0 < k < nwords else None


def layout(timings, tl):
    scenes = {s["id"]: s for s in tl["scenes"]}
    segs, words_abs, report = [], [], []
    for ln in timings["lines"]:
        sc = scenes[ln["scene"]]
        w = ln["words"]
        audio_len = ln["duration"]
        k = sentence_split(ln["text"], len(w))
        offset = sc["vo"] - w[0]["start"]                       # line start on the timeline
        if k is None or sc.get("cue") is None:
            segs.append({"id": ln["id"], "src": [0.0, audio_len], "dst": offset})
            words_abs += [{"text": x["text"], "start": x["start"] + offset, "end": x["end"] + offset, "line": ln["id"]} for x in w]
            end = offset + audio_len
        else:
            cut = (w[k - 1]["end"] + w[k]["start"]) / 2          # middle of the pause
            first_end = w[k - 1]["end"] + offset
            want = max(sc["cue"], first_end + MIN_GAP)           # 2nd sentence starts on the cue
            off2 = want - w[k]["start"]
            segs.append({"id": ln["id"], "src": [0.0, cut], "dst": offset})
            segs.append({"id": ln["id"], "src": [cut, audio_len], "dst": off2 + cut})
            words_abs += [{"text": x["text"], "start": x["start"] + offset, "end": x["end"] + offset, "line": ln["id"]} for x in w[:k]]
            words_abs += [{"text": x["text"], "start": x["start"] + off2, "end": x["end"] + off2, "line": ln["id"]} for x in w[k:]]
            end = off2 + w[-1]["end"]
        over = end - sc["end"]
        report.append(f"{ln['id']}: {sc['vo']:.2f}-{end:.2f}s (scene ends {sc['end']:.2f})" + (f"  !! runs {over:.2f}s past the scene" if over > 0.25 else ""))
    for a, b in zip(words_abs, words_abs[1:]):                 # never overlap
        a["end"] = min(a["end"], b["start"])
    return segs, words_abs, report


def env_follow(x, attack, release):
    """Smooth envelope (one-pole attack/release) of |x|, vectorised in blocks."""
    a = np.abs(x)
    blk = 240                                                   # 5 ms blocks
    n = len(a) // blk + 1
    pad = np.zeros(n * blk); pad[:len(a)] = a
    peak = pad.reshape(n, blk).max(axis=1)
    out = np.zeros(n)
    ka, kr = np.exp(-blk / (attack * SR)), np.exp(-blk / (release * SR))
    v = 0.0
    for i, p in enumerate(peak):
        k = ka if p > v else kr
        v = k * v + (1 - k) * p
        out[i] = v
    return np.repeat(out, blk)[:len(a)]


def voice_fx(v):
    """Gentle clean-up: high-pass, a touch of presence, light compression."""
    sos = signal.butter(2, 80, "highpass", fs=SR, output="sos")
    v = signal.sosfilt(sos, v)
    b, a = signal.iirpeak(3200, 1.2, fs=SR)                     # +presence (parallel)
    v = v + 0.18 * signal.lfilter(b, a, v)
    env = env_follow(v, 0.005, 0.12)
    thr = 0.25
    gain = np.where(env > thr, (thr / np.maximum(env, 1e-9)) ** (1 - 1 / 2.5), 1.0)
    return v * gain


def true_peak_limit(x, ceiling_db=-1.0):
    """Look-ahead limiter driven by 4x-oversampled (true) peaks."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    ceil = 10 ** (ceiling_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(axis=1)[:4 * len(x)].reshape(-1, 4).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    w = int(0.004 * SR)
    # min over +-w then a w-wide average: smooth, and never above what any sample needs
    g = uniform_filter1d(minimum_filter1d(need, size=2 * w + 1), size=w)
    return x * g[:, None]


def main():
    tl = load_timeline()
    timings = load_timings()
    script = {l["id"]: l["text"] for l in load_script()["lines"]}
    for ln in timings["lines"]:
        if ln["text"] != script[ln["id"]]:
            print(f"warning: {ln['id']} text differs from script/script.json")
    dur = tl["duration"]
    N = int(round(dur * SR))
    segs, words, report = layout(timings, tl)
    print("\n".join(report))

    # --- narration track
    voice = np.zeros(N)
    cache = {}
    for sg in segs:
        ln = next(l for l in timings["lines"] if l["id"] == sg["id"])
        if sg["id"] not in cache:
            cache[sg["id"]] = read_wav(os.path.join(ROOT, ln["file"]))
        a = cache[sg["id"]]
        s0, s1 = int(sg["src"][0] * SR), min(len(a), int(sg["src"][1] * SR))
        piece = a[s0:s1].astype(np.float64).copy()
        f = min(len(piece) // 2, int(0.006 * SR))              # tiny fades at the split points
        if f > 0:
            piece[:f] *= np.linspace(0, 1, f); piece[-f:] *= np.linspace(1, 0, f)
        d0 = int(round(sg["dst"] * SR))
        d1 = min(N, d0 + len(piece))
        if d0 < N:
            voice[max(0, d0):d1] += piece[max(0, -d0):d1 - d0]
    voice = voice_fx(voice)
    meter = pyln.Meter(SR)
    vl = meter.integrated_loudness(voice)
    voice *= 10 ** ((VOICE_LUFS - vl) / 20)
    write_wav(os.path.join(BUILD, "voice_track.wav"), voice.astype(np.float32))

    # --- music + sfx stems (synthesised by audio/synth.py)
    music = read_stereo(os.path.join(BUILD, "music.wav"), N)
    sfx = read_stereo(os.path.join(BUILD, "sfx.wav"), N)
    music *= 10 ** ((MUSIC_LUFS - meter.integrated_loudness(music)) / 20)
    sfx *= 10 ** ((SFX_LUFS - meter.integrated_loudness(sfx)) / 20)
    # duck the music under the voice (-6 dB), smooth attack/release
    venv = env_follow(voice, 0.05, 0.6)
    duck = 1.0 - 0.6 * np.clip(venv / (np.percentile(venv[venv > 1e-4], 60) if np.any(venv > 1e-4) else 1), 0, 1)
    music *= duck[:, None]
    mix = music + sfx + np.stack([voice, voice], axis=1)

    # --- master: loudness to target, then true-peak limit
    ml = meter.integrated_loudness(mix)
    mix *= 10 ** ((TARGET_LUFS - ml) / 20)
    mix = true_peak_limit(mix, -1.0)
    print(f"master: {meter.integrated_loudness(mix):.1f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
    write_wav(os.path.join(BUILD, "mix.wav"), mix.astype(np.float32))
    with open(os.path.join(BUILD, "voice_layout.json"), "w") as f:
        json.dump({"source": timings.get("source"), "segments": segs, "words": words}, f, indent=1)
    print("wrote build/mix.wav, build/voice_track.wav, build/voice_layout.json")


def read_stereo(path, N):
    import subprocess
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    out = np.zeros((N, 2)); out[:min(N, len(x))] = x[:N]
    return out


if __name__ == "__main__":
    main()
