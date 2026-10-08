"""Find the tempo (BPM) and the time of the first beat of each song, so the frame's glow can pulse on the beat.
Decodes with ffmpeg, builds an onset-strength envelope (spectral flux), picks the tempo by autocorrelation
(preferring 70-150 BPM), then the beat phase that lines up best with the onsets over the whole song.
usage: python3 android/tools/find_beats.py website/assets/*.mp3      (needs ffmpeg + numpy)
then copy each "bpm" and "beat" into that song's line in CONFIG.songs.
"""
import sys, json, subprocess
import numpy as np

SR, HOP, WIN = 11025, 128, 1024

def onset_env(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, np.float32)
    n = 1 + (len(x) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    frames = x[idx] * np.hanning(WIN)[None, :]
    mag = np.log1p(30 * np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.maximum(mag[1:] - mag[:-1], 0).sum(1)
    flux = np.concatenate([[0], flux])
    # remove slow trend, keep positive peaks
    k = int(SR / HOP * 0.5)
    trend = np.convolve(flux, np.ones(k) / k, mode="same")
    env = np.maximum(flux - trend, 0)
    return env / (env.std() + 1e-9), len(x) / SR

def tempo(env):
    fps = SR / HOP
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    bpms = np.arange(60.0, 190.0, 0.05)
    lags = fps * 60.0 / bpms
    score = np.interp(lags, np.arange(len(ac)), ac)
    # log-gaussian preference around 115 BPM, and add the half / double tempo evidence
    pref = np.exp(-0.5 * (np.log2(bpms / 115.0) / 0.7) ** 2)
    s2 = np.interp(lags * 2, np.arange(len(ac)), ac)
    total = (score + 0.5 * s2) * pref
    return float(bpms[np.argmax(total)])

def phase(env, bpm, dur):
    fps = SR / HOP
    best = None
    for b in np.arange(bpm - 1.2, bpm + 1.2, 0.01):          # fine tempo search over the whole song
        period = 60.0 / b
        offs = np.arange(0, period, 0.005)
        t = np.arange(0, dur, period)
        frames = (t[None, :] + offs[:, None]) * fps
        frames = frames[:, :].astype(int)
        frames = np.clip(frames, 0, len(env) - 1)
        sc = env[frames].sum(1)
        i = int(np.argmax(sc))
        if best is None or sc[i] > best[0]:
            best = (sc[i], b, offs[i])
    return best[1], best[2]

out = {}
for p in sys.argv[1:]:
    env, dur = onset_env(p)
    b0 = tempo(env)
    b, off = phase(env, b0, dur)
    # how well do the beats line up? (mean onset strength on beats vs everywhere)
    fps = SR / HOP
    t = np.arange(off, dur, 60.0 / b)
    on = env[np.clip((t * fps).astype(int), 0, len(env) - 1)].mean()
    out[p.split("/")[-1]] = {"bpm": round(float(b), 2), "beat": round(float(off), 3), "confidence": round(float(on / (env.mean() + 1e-9)), 2)}
    print(p.split("/")[-1], out[p.split("/")[-1]], flush=True)
