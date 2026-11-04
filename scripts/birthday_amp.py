"""Per-frame (30 fps) loudness of the birthday voiceover, used only to open and close the mouths
while someone talks. Reads the voiceover, never changes it.
usage: python3 scripts/birthday_amp.py birthday/voiceover.mp3 src/birthday/amp.json
"""
import json, subprocess, sys
import numpy as np

FPS = 30
src, dst = sys.argv[1], sys.argv[2]
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
a = np.frombuffer(pcm, dtype=np.float32)
hop = 160  # 10 ms
n = len(a) // hop
rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1))
db = 20 * np.log10(rms + 1e-6)
total = int(np.ceil(len(a) / 16000 * FPS)) + FPS
env = []
for f in range(total):
    c = int(f / FPS * 100)
    seg = db[max(c - 2, 0):c + 3]
    v = float(np.max(seg)) if len(seg) else -90.0
    env.append(round(float(np.clip((v + 50) / 35, 0, 1)), 3))
json.dump(env, open(dst, 'w'))
print(f'{len(env)} frames -> {dst}; peak dB {db.max():.1f}')
