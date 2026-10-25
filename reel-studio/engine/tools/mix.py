#!/usr/bin/env python3
"""Build the soundtrack from a rendered timeline.

Reads build/timeline_<vo>.json (written by render.mjs): voiceover placements and
every sound cue. Produces, normalised to -14 LUFS / -1 dBTP:
  build/audio/mix_full.wav      voice + SFX + music bed
  build/audio/mix_nomusic.wav   voice + SFX (for trending audio)

Usage: python3 mix.py PROJECT_DIR --vo vo_el [--music-db -27] [--sfx-db -9]
"""
import argparse, json, os, subprocess, sys
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx as SFX

SR = 48000


def db(x):
    return 10 ** (x / 20)


def voice_chain(path_in, path_out):
    """Clean, present, compressed narration (the reference voice is very compressed)."""
    af = ("highpass=f=72,"
          "equalizer=f=180:t=q:w=1.0:g=1.5,"
          "equalizer=f=380:t=q:w=1.2:g=-1.5,"
          "equalizer=f=3300:t=q:w=1.1:g=2.2,"
          "equalizer=f=7500:t=q:w=1.5:g=-1.0,"
          "acompressor=threshold=-24dB:ratio=3.2:attack=6:release=110:makeup=4:knee=4,"
          "acompressor=threshold=-12dB:ratio=6:attack=2:release=60:makeup=1")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path_in, "-af", af, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_f32le", path_out], check=True)


def envelope(x, win=0.08):
    n = int(win * SR)
    e = np.sqrt(np.maximum(signal.fftconvolve(x ** 2, np.ones(n) / n, mode="same"), 0))
    return e


def limiter(x, ceiling_db=-1.2, lookahead=0.004, release=0.06):
    """Simple look-ahead peak limiter on a stereo float array (4x oversampled peak detect)."""
    ceil = db(ceiling_db)
    up = signal.resample_poly(np.abs(x).max(1), 4, 1)
    peak = np.maximum.reduce([up[i::4] for i in range(4)])[: len(x)]
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(lookahead * SR)
    # look-ahead minimum
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1)
    # instant attack, smooth release: min(gain, one-pole smoothed gain)
    a = np.exp(-1 / (release * SR))
    sm = signal.lfilter([1 - a], [1, -a], g, zi=[g[0] * a])[0]
    out = np.minimum(g, sm)
    return x * out[:, None]


def normalize(x, target=-14.0, tp=-1.2):
    meter = pyln.Meter(SR)
    for _ in range(3):
        L = meter.integrated_loudness(x)
        x = x * db(target - L)
        x = limiter(x, tp)
    return x, meter.integrated_loudness(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--vo", default="vo_el")
    ap.add_argument("--music-db", type=float, default=-26.0, help="drone level relative to voice")
    ap.add_argument("--sfx-db", type=float, default=-6.0, help="SFX bus relative to voice")
    a = ap.parse_args()
    tl = json.load(open(os.path.join(a.project, "build", f"timeline_{a.vo}.json")))
    out_dir = os.path.join(a.project, "build", "audio"); os.makedirs(out_dir, exist_ok=True)
    N = int((tl["duration"] + 0.5) * SR)

    # ---- voice
    voice = np.zeros(N, np.float32)
    for v in tl["vo"]:
        src = os.path.join(a.project, "build", a.vo, v["id"] + ".wav")
        y, sr = sf.read(src, dtype="float32")
        if y.ndim > 1:
            y = y.mean(1)
        i = int(v["t"] * SR)
        voice[i:i + len(y)] += y[: max(0, N - i)]
    raw_path = os.path.join(out_dir, "voice_raw.wav"); sf.write(raw_path, voice, SR, subtype="FLOAT")
    proc_path = os.path.join(out_dir, "voice_proc.wav"); voice_chain(raw_path, proc_path)
    voice, _ = sf.read(proc_path, dtype="float32")
    voice = voice[:N] if len(voice) >= N else np.pad(voice, (0, N - len(voice)))
    # normalise voice to a working level (-20 LUFS) before balancing
    meter = pyln.Meter(SR)
    voice *= db(-20 - meter.integrated_loudness(voice))
    vst = np.stack([voice, voice], 1)

    # ---- SFX
    fx = np.zeros((N, 2), np.float32)
    for k, c in enumerate(tl["sounds"]):
        name = c["name"]
        if name not in SFX.SOUNDS:
            print("unknown sound", name); continue
        snd = SFX.sound(name, int(c.get("v", k)))
        g = c.get("gain", 1.0) * SFX.LEVEL.get(name, 0.5)
        i = int(c["t"] * SR)
        if i >= N:
            continue
        m = min(len(snd), N - i)
        fx[i:i + m] += snd[:m] * g
    fx *= db(a.sfx_db) * 0.9
    # duck SFX slightly under speech so words stay clear
    venv = envelope(voice, 0.12)
    duck = 1 - 0.35 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
    fx *= duck[:, None]

    # ---- music bed (dark drone; swell for the final scenes)
    last = tl["scenes"][-2]["start"] if len(tl["scenes"]) > 2 else tl["duration"] - 15
    music = SFX.drone(N / SR, swell_at=last, swell_len=N / SR - last)
    music = np.pad(music, ((0, max(0, N - len(music))), (0, 0)))[:N]
    music *= db(a.music_db) * 1.6
    mduck = 1 - 0.45 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0, 1)
    music *= mduck[:, None]

    m_ = pyln.Meter(SR)
    def L(x):
        try:
            return m_.integrated_loudness(x)
        except Exception:
            return float('nan')
    print(f"bus loudness (pre-master): voice {L(vst):.1f} LUFS | sfx {L(fx):.1f} | music {L(music):.1f}")
    full = vst + fx + music
    nomusic = vst + fx
    full, Lf = normalize(full)
    nomusic, Ln = normalize(nomusic)
    sf.write(os.path.join(out_dir, "mix_full.wav"), full, SR, subtype="PCM_24")
    sf.write(os.path.join(out_dir, "mix_nomusic.wav"), nomusic, SR, subtype="PCM_24")
    sf.write(os.path.join(out_dir, "stem_voice.wav"), vst * 0.5, SR, subtype="PCM_24")
    print(f"mix_full {Lf:.2f} LUFS, mix_nomusic {Ln:.2f} LUFS, {N / SR:.2f}s, {len(tl['sounds'])} sound cues")


if __name__ == "__main__":
    main()
