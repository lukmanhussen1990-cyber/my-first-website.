# Final audio mix: voice loudest, moans + SFX clear, music low and ducked under the voice. No clipping.
import json, subprocess, os, glob
import numpy as np
SR = 48000

def load(path, ch=1):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32).copy()
    return x if ch == 1 else x.reshape(-1, ch).T

def user_or(name, fallback):
    # an ElevenLabs file uploaded by the user (audio/user/<name>.*) wins over the synthesized stand-in
    hits = sorted(glob.glob(f'audio/user/{name}*.*'))
    return hits[0] if hits else fallback

cues = json.load(open('build/cues.json'))
dur = cues['duration']
N = int(dur * SR)
mix = np.zeros((2, N))
db = lambda d: 10 ** (d / 20)

def place(sig, t, gain_db, pan=0.0, length=None, fade_out=0.08):
    if length is not None:
        sig = sig[:int(length * SR)].copy()
        f = min(len(sig), int(fade_out * SR))
        sig[-f:] *= np.linspace(1, 0, f)
    i = int(max(0, t) * SR)
    if i >= N: return
    sig = sig[:N - i]
    g = db(gain_db)
    mix[0, i:i + len(sig)] += sig * g * np.sqrt(0.5 * (1 - pan)) * 1.414
    mix[1, i:i + len(sig)] += sig * g * np.sqrt(0.5 * (1 + pan)) * 1.414

# voice (centre)
vo = load('audio/vo_final.wav')
place(vo, 0.0, 0.0)
S = {k: load(user_or(k, f'audio/sfx/{k}.wav')) for k in ['moan_long', 'moan_short1', 'moan_short2', 'velcro', 'thud', 'fan', 'glass', 'boing1', 'boing2', 'boing3', 'ding', 'whoosh', 'click', 'pop', 'popfx', 'roof']}
short_i = 0; boing_i = 0
moan_track = np.zeros(N)
def place_moan(sig, t, gain_db, length, fade_out):
    sig = sig[:int(length * SR)].copy(); f = min(len(sig), int(fade_out * SR)); sig[-f:] *= np.linspace(1, 0, f)
    i = int(t * SR); n = min(len(sig), N - i)
    if n > 0: moan_track[i:i + n] += np.abs(sig[:n]) * db(gain_db)
for e in cues['events']:
    ty, t, g = e['type'], e['t'], 20 * np.log10(max(e.get('gain', 1), 1e-3))
    if ty == 'moan':
        if e.get('variant') == 'long':
            place(S['moan_long'], t, -5 + g, 0.0, length=e['dur'], fade_out=0.12); place_moan(S['moan_long'], t, 0, e['dur'], 0.12)
        else:
            k = 'moan_short1' if short_i % 2 == 0 else 'moan_short2'; short_i += 1
            place(S[k], t, -5 + g, 0.05, length=e['dur'] + 0.1, fade_out=0.2); place_moan(S[k], t, 0, e['dur'] + 0.1, 0.2)
    elif ty == 'boing':
        place(S[f'boing{min(3, boing_i + 1)}'], t, -7 + g, [-0.3, 0.3, 0][boing_i % 3]); boing_i += 1
    elif ty == 'fan': place(S['fan'], t, -9 + g, 0.15, length=e['dur'], fade_out=0.15)
    elif ty == 'thud': place(S['thud'], t, -4 + g, -0.25)
    elif ty == 'velcro': place(S['velcro'], t, -5 + g, -0.2)
    elif ty == 'glass': place(S['glass'], t, -5 + g, 0.2)
    elif ty == 'roof': place(S['roof'], t, -6 + g, 0.0)
    elif ty == 'ding': place(S['ding'], t, -8 + g, 0.0)
    elif ty == 'whoosh': place(S['whoosh'], t, -12 + g, 0.0)
    elif ty == 'click': place(S['click'], t, -10 + g, 0.3)
    elif ty == 'pop': place(S['pop'], t, -10 + g, 0.0)
    elif ty == 'popfx': place(S['popfx'], t, -14 + g, 0.0)

# music bed: quiet, ducked under the voice
mus = load('audio/sfx/music.wav', 2)[:, :N]
env = np.abs(np.pad(vo, (0, max(0, N - len(vo))))[:N])
k = int(0.06 * SR)
env = np.convolve(env, np.ones(k) / k, mode='same')
duck = 1 - 0.55 * np.clip(env / 0.05, 0, 1)
duck = np.convolve(duck, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode='same')
mix[:, :mus.shape[1]] += mus * db(-21) * duck[:mus.shape[1]]

# moan loudness at 30 fps -> timeline (drives the mouth while moaning)
fh = SR // 30
menv = np.array([moan_track[k * fh:(k + 1) * fh].mean() if k * fh < N else 0 for k in range(N // fh + 1)])
menv = np.clip(menv / (np.percentile(menv[menv > 1e-4], 90) + 1e-9), 0, 1) if (menv > 1e-4).any() else menv
tl = json.load(open('src/timeline.json')); tl['moanEnv'] = [round(float(v), 3) for v in np.convolve(menv, [0.25, 0.5, 0.25], mode='same')]
json.dump(tl, open('src/timeline.json', 'w'))
raw = 'build/mix_raw.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_f32le', raw], input=mix.T.astype(np.float32).tobytes(), check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.84:attack=3:release=60:level=disabled',
                '-ar', str(SR), '-c:a', 'pcm_s16le', 'build/mix_final.wav'], check=True)
out = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'build/mix_final.wav', '-af', 'volumedetect,ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
for line in out.splitlines():
    if any(s in line for s in ('max_volume', 'mean_volume', 'I:', 'Peak:')): print(line.strip())
