"""Soundtrack from the user's original video: one continuous excerpt, aligned so the original's
music drop (17.74 s) lands on our impact at T_IMPACT (8.90 s).  usage:
    python3 -I audio/original_cut.py <source_video> <out.wav> [duration]
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HERE, '..', 'timeline.json')))
SRC_DROP = 17.74                      # music/bass drop in the original audio
OFFSET = SRC_DROP - T['T_IMPACT']     # = 8.84 s: original time = our time + OFFSET
FADE_IN, FADE_OUT = 0.30, 0.80

src, out = sys.argv[1], sys.argv[2]
dur = float(sys.argv[3]) if len(sys.argv) > 3 else T['DURATION']
with tempfile.TemporaryDirectory() as d:
    tmp = os.path.join(d, 'a.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{OFFSET:.3f}', '-t', f'{dur:.3f}', '-i', src,
                    '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', tmp], check=True)
    sr, x = wavfile.read(tmp)
x = x.astype(np.float64) / 32768
n = int(round(dur * sr))
if len(x) < n: x = np.pad(x, ((0, n - len(x)), (0, 0)))
x = x[:n]
t = np.arange(n) / sr
g = np.ones(n)
g *= np.sin(0.5 * np.pi * np.clip(t / FADE_IN, 0, 1))                       # equal-power fade-in
g *= np.cos(0.5 * np.pi * np.clip((t - (dur - FADE_OUT)) / FADE_OUT, 0, 1))  # fade-out to silence
x *= g[:, None]
wavfile.write(out, sr, (np.clip(x, -1, 1) * 32767).astype(np.int16))
print(f'wrote {out}: original {OFFSET:.2f}–{OFFSET + dur:.2f} s -> ours 0–{dur:.2f} s')
