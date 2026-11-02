"""Compute a per-video-frame loudness envelope of the voiceover (drives lip-sync).

Usage: python tools/analyze_vo.py assets/voiceover.mp3 data/vo_env.json
"""
import json, subprocess, sys
import numpy as np

FPS = 30
SR = 16000

def main(src, dst):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = SR // FPS
    n = len(x) // hop + 1
    x = np.pad(x, (0, n * hop - len(x)))
    frames = x.reshape(n, hop)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    lo, hi = -45.0, np.percentile(db, 98)
    env = np.clip((db - lo) / (hi - lo), 0, 1)
    # light smoothing so mouths don't flicker
    k = np.array([0.25, 0.5, 0.25])
    env = np.convolve(env, k, mode="same")
    json.dump({"fps": FPS, "env": [round(float(v), 3) for v in env]}, open(dst, "w"))
    print(f"frames={n} duration={len(x)/SR:.2f}s")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
