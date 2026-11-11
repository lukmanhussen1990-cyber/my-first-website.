"""Per-frame (60 fps) loudness envelope of the voiceover, normalised 0..1, for mouth sync."""
import json, subprocess, sys
import numpy as np
src = sys.argv[1] if len(sys.argv) > 1 else 'assets/voiceover.mp3'
sr = 48000
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
a = np.frombuffer(pcm, dtype=np.float32)
hop = sr // 60
n = int(np.ceil(len(a) / hop))
rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
db = 20 * np.log10(rms + 1e-9)
lo, hi = np.percentile(db, 20), np.percentile(db, 98)
env = np.clip((db - lo) / (hi - lo), 0, 1)
# light smoothing: fast attack, slower release
out = np.zeros_like(env); v = 0
for i, x in enumerate(env):
    v = x if x > v else v * 0.72 + x * 0.28
    out[i] = v
json.dump([round(float(x), 3) for x in out], open('build/envelope.json', 'w'))
print('frames', n)
