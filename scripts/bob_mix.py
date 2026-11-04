"""Mix the Bob soundtrack: the voiceover exactly as recorded (gain 1.0, untouched) + the code-made
music box and sound effects, kept far below the voice and pulled down further whenever the voice speaks.
usage: python3 scripts/bob_mix.py bob/out/tmp/audio.wav
"""
import json, subprocess, sys
import numpy as np
from scipy.io import wavfile

SR = 44100
FPS = 30
TOTAL_FRAMES = 3048
DUR = TOTAL_FRAMES / FPS
OUT = sys.argv[1] if len(sys.argv) > 1 else 'bob/out/tmp/audio.wav'
words = json.load(open('bob/words.json'))
wf = lambda i: round(words[i]['start'] * FPS)

# ---------------------------------------------------------------- the voice, untouched
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'bob/voiceover.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
voice = np.frombuffer(pcm, dtype=np.float32).astype(np.float64)
n = int(round(DUR * SR))
V = np.zeros(n)
V[: min(n, len(voice))] = voice[:n]

# loudness envelope of the voice (for ducking only; the voice itself is never changed)
win = int(0.05 * SR)
pad = np.concatenate([V ** 2, np.zeros(win)])
cs = np.cumsum(pad)
rms = np.sqrt(np.maximum(0, (cs[win:] - cs[:-win]) / win))[:n]
db = 20 * np.log10(rms + 1e-9)
speech = np.clip((db + 45) / 15, 0, 1)  # 0 = silence, 1 = clear speech
# smooth: fast attack, slow release
env = np.zeros(n)
a_att = 1 - np.exp(-1 / (0.03 * SR))
a_rel = 1 - np.exp(-1 / (0.35 * SR))
e = 0.0
step = 64
for i in range(0, n, step):
    target = speech[i]
    a = a_att if target > e else a_rel
    e += (target - e) * (1 - (1 - a) ** step)
    env[i:i + step] = e
voice_rms = np.sqrt(np.mean(V[speech > 0.8] ** 2))
print(f'voice speech RMS {20 * np.log10(voice_rms):.1f} dBFS, peak {20 * np.log10(np.max(np.abs(V))):.1f} dBFS')


def load(name):
    sr, x = wavfile.read(f'public/bob/sfx/{name}.wav')
    assert sr == SR
    x = x.astype(np.float64) / 32767
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    return x


def db2(g):
    return 10 ** (g / 20)


mix = np.zeros((n, 2))

# ---------------------------------------------------------------- music: ~16 dB under the speech, -7 dB more while talking
music = load('music')
m = min(n, len(music))
music_rms = np.sqrt(np.mean(music[:m] ** 2))
music_gain = voice_rms / music_rms * db2(-16)
duck_m = db2(-7 * env)
mix[:m] += music[:m] * music_gain * duck_m[:m, None]
print(f'music gain {20 * np.log10(music_gain):.1f} dB (rel. file), ducks -7 dB under the voice')

# ---------------------------------------------------------------- sound effects (time, file, level in dB relative to the speech RMS)
ten = [2324 + 8 + v * 3.4 for v in [0, 3, 6, 9, 2, 5, 8, 1, 4, 7]]
cues = [
	(wf(51) / FPS - 0.01, 'crunch', -8),  # everyone bites at once
	((wf(119) + 3) / FPS, 'boing', -11),  # my hair springs back up
	(wf(210) / FPS, 'pop', -13),  # the yellow scarf
] + [(fr / FPS, 'pop', -17) for fr in ten] + [  # ten people change
	(2372 / FPS, 'pops', -15),  # a hundred
	(2405 / FPS, 'pops', -15),  # the whole town
	(2455 / FPS, 'pop', -15),  # red shirts
	(2480 / FPS, 'pop', -15),  # blue hair
	(2503 / FPS, 'pop', -14),  # purple houses
	(wf(260) / FPS + 0.05, 'cheer', -19),  # the colourful town celebrates
]
for at, name, lvl in cues:
	x = load(name)
	i = int(round(at * SR))
	j = min(n, i + len(x))
	x_rms = np.sqrt(np.mean(x ** 2))
	peak_ref = np.sqrt(np.mean(x[np.abs(x).max(axis=1) > 0.05 * np.abs(x).max()] ** 2))
	g = voice_rms / peak_ref * db2(lvl)
	duck = db2(-4 * env[i:j])
	mix[i:j] += x[: j - i] * g * duck[:, None]
	print(f'  {name:6s} at {at:7.2f}s  {lvl:4d} dB')

# ---------------------------------------------------------------- voice on top, exactly as recorded
out = mix + np.stack([V, V], axis=1)
peak = np.max(np.abs(out))
print(f'mix peak {20 * np.log10(peak):.1f} dBFS')
assert peak < 1.0, 'mix would clip'
wavfile.write(OUT, SR, out.astype(np.float32))
# also keep a stem of everything except the voice (for checking)
wavfile.write(OUT.replace('.wav', '_bed.wav'), SR, mix.astype(np.float32))
print(f'-> {OUT} ({n / SR:.3f}s)')
