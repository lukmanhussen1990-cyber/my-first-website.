"""Code-made soundtrack for the cat reel: soft cute music loop + synthesized SFX,
mixed under the voiceover (with ducking). Everything is generated from scratch (no samples).

    python make_audio.py <voiceover.mp3> <events.json> <out.wav>
"""
import json
import subprocess
import sys
import numpy as np
from scipy import signal

SR = 48000
VO_PATH, EV_PATH, OUT = sys.argv[1:4]
ev = json.load(open(EV_PATH))
FPS = ev['fps']
DUR = ev['end'] / FPS                      # 25.0 s
FREEZE_T = (ev['freeze'] - 1) / FPS        # 24.0 s
N = int(DUR * SR) + 1
rng = np.random.default_rng(42)


def t_of(frame):
    return (frame - 1) / FPS


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(buf, x, t0, gain=1.0, pan=0.0):
    """add mono x into stereo buf at time t0 with equal-power pan (-1..1)."""
    i0 = int(t0 * SR)
    if i0 >= buf.shape[0]:
        return
    x = x[: buf.shape[0] - i0]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[i0:i0 + len(x), 0] += x * gain * l
    buf[i0:i0 + len(x), 1] += x * gain * r


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def env_adsr(n, a, d, s, r, sus_level=0.7):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, sus_level, max(d, 1)),
                        np.full(s_n, sus_level), np.linspace(sus_level, 0, max(r, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ----------------------------------------------------------------------------
# MUSIC  (100 bpm, C major, I-V-vi-IV, kalimba lead + soft pad + bass + shaker)
# ----------------------------------------------------------------------------
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
music = np.zeros((N, 2))


def kalimba(f, dur=1.2, bright=1.0):
    t = tt(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
         + 0.32 * bright * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.18)
         + 0.18 * bright * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.05))
    x[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return x


def pad_voice(f, dur):
    t = tt(dur)
    x = np.zeros_like(t)
    for det in (-0.12, 0.0, 0.11):
        ff = f * 2 ** (det / 12)
        x += signal.sawtooth(2 * np.pi * ff * t + rng.uniform(0, 6))
    x = lp(x / 3, 1400)
    return x * env_adsr(len(t), 0.35, 0.3, 0, 0.6, 0.75)


chords = [[48, 52, 55, 60], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]    # C G Am F
bass_roots = [36, 43, 45, 41]
melody = [  # (beat offset within the 4-bar phrase, midi, length in beats)
    (0, 76, .5), (.5, 79, .5), (1, 81, .5), (1.5, 79, .5), (2, 76, 1), (3, 72, 1),
    (4, 74, .5), (4.5, 79, .5), (5, 83, .5), (5.5, 81, .5), (6, 79, 1), (7, 74, 1),
    (8, 72, .5), (8.5, 76, .5), (9, 81, .5), (9.5, 79, .5), (10, 76, 1), (11, 69, 1),
    (12, 77, .5), (12.5, 81, .5), (13, 84, .5), (13.5, 81, .5), (14, 79, 1.5), (15.5, 76, .5)]
t0_music = 0.0
bars = int(np.ceil(DUR / BAR)) + 1
for b in range(bars):
    tb = t0_music + b * BAR
    ch = chords[b % 4]
    for m in ch:
        place(music, pad_voice(midi(m), BAR + 0.5), tb, 0.05, pan=rng.uniform(-0.4, 0.4))
    for beat in (0, 2):
        f = midi(bass_roots[b % 4])
        t = tt(BEAT * 1.6)
        x = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t / 0.45)
        x[:200] *= np.linspace(0, 1, 200)
        place(music, x, tb + beat * BEAT, 0.16)
    # shaker on 8ths
    for k in range(8):
        n = hp(rng.standard_normal(int(0.05 * SR)), 6000) * np.exp(-tt(0.05) / 0.012)
        place(music, n, tb + k * BEAT / 2, 0.018 if k % 2 else 0.01, pan=0.3)
for rep in range(bars // 4 + 1):
    for (ob, m, ln) in melody:
        ts = t0_music + rep * 4 * BAR + ob * BEAT
        if ts < DUR:
            place(music, kalimba(midi(m), ln * BEAT + 0.9), ts, 0.13, pan=-0.15)
            place(music, kalimba(midi(m), ln * BEAT + 0.9) * 0.35, ts + 0.3, 0.13, pan=0.5)   # echo

# flashback: muffle the music (B&W shots), and stop it at the freeze frame
bw0, bw1 = t_of(340), t_of(496)
mfl = np.stack([lp(music[:, c], 900, 2) for c in range(2)], 1)
w = np.zeros(N)
i0, i1 = int(bw0 * SR), int(bw1 * SR)
ramp = int(0.25 * SR)
w[i0:i1] = 1.0
w[i0:i0 + ramp] = np.linspace(0, 1, ramp)
w[i1 - ramp:i1] = np.linspace(1, 0, ramp)
music = music * (1 - w[:, None]) + mfl * 0.8 * w[:, None]
fz = int(FREEZE_T * SR)
music[fz:] *= np.exp(-np.arange(N - fz) / (0.03 * SR))[:, None]

# ----------------------------------------------------------------------------
# SFX
# ----------------------------------------------------------------------------
sfx = np.zeros((N, 2))
E = ev['events']


def paw():
    n = rng.standard_normal(int(0.05 * SR))
    x = lp(n, 700) * np.exp(-tt(0.05) / 0.012)
    x += 0.6 * np.sin(2 * np.pi * 170 * tt(0.05)) * np.exp(-tt(0.05) / 0.015)
    return x


for f in E['paw']:
    place(sfx, paw(), t_of(f), 0.22 * rng.uniform(0.7, 1.0), pan=-0.3)


def key_click():
    d = 0.06
    t = tt(d)
    x = bp(rng.standard_normal(len(t)), 1800, 6500) * np.exp(-t / 0.004)
    x += 0.35 * np.sin(2 * np.pi * 1150 * t) * np.exp(-t / 0.006)
    up = bp(rng.standard_normal(len(t)), 2500, 7000) * np.exp(-np.maximum(t - 0.045, 0) / 0.003) * (t > 0.045)
    return x + 0.4 * up


def key_gain(f):
    for nm, a, b, g in (('S1', 1, 77, 0.9), ('S2', 78, 134, 0.45), ('S3', 135, 218, 0.08), ('S4', 219, 339, 0.35),
                        ('S5', 340, 495, 0.55), ('S6', 496, 594, 0.6), ('S7', 595, 750, 0.0)):
        if a <= f <= b:
            return g
    return 0.3


for f in E['key']:
    place(sfx, lp(key_click(), 7000), t_of(f) + rng.uniform(0, 0.02), 0.075 * key_gain(f) * rng.uniform(0.6, 1.0),
          pan=rng.uniform(-0.2, 0.3))
# the cat 'typing' when it lands on the keyboard (ffffff)
tl = t_of(E['land'][0])
for k in range(26):
    place(sfx, key_click(), tl + 0.02 + k * 0.045 * (1 + k / 30), 0.12 * (1 - k / 30), pan=rng.uniform(-0.3, 0.3))


def meow(dur=0.5, f_start=640, f_peak=960, f_end=540):
    """Additive source-filter kitten meow: harmonics shaped by moving vowel formants (m-i-a-u)."""
    t = tt(dur)
    u = t / dur
    f0 = np.where(u < 0.35, f_start + (f_peak - f_start) * np.sin(u / 0.35 * np.pi / 2),
                  f_end + (f_peak - f_end) * np.cos((u - 0.35) / 0.65 * np.pi / 2))
    f0 = f0 * (1 + 0.015 * np.sin(2 * np.pi * 6.0 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    # formant tracks (F1,F2,F3) over u: m -> i -> a -> u
    kf = np.array([0.0, 0.12, 0.4, 0.75, 1.0])
    F = np.array([[350, 1100, 2600], [420, 2300, 3200], [850, 1600, 2900], [700, 1200, 2700], [450, 900, 2500]])
    F1, F2, F3 = (np.interp(u, kf, F[:, i]) for i in range(3))
    x = np.zeros_like(t)
    for k in range(1, 30):
        fk = k * f0
        amp = (np.exp(-((fk - F1) / 260) ** 2) + 0.7 * np.exp(-((fk - F2) / 380) ** 2) +
               0.35 * np.exp(-((fk - F3) / 500) ** 2) + 0.02) / k ** 0.5
        amp *= fk < 9000
        x += amp * np.sin(k * ph)
    breath = bp(rng.standard_normal(len(t)), 1500, 5000) * 0.05
    e = env_adsr(len(t), 0.05, 0.08, 0, 0.22, 0.85) * (0.75 + 0.25 * np.sin(np.pi * u))
    x = (x / np.max(np.abs(x)) + breath) * e
    return x


place(sfx, meow(), t_of(E['meow'][0]) - 0.03, 0.3, pan=-0.1)


def boing(dur=0.75):
    t = tt(dur)
    f = 210 + 140 * (1 - np.exp(-t / 0.04)) + 60 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / 0.22)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * np.exp(-t / 0.3)
    x[:120] *= np.linspace(0, 1, 120)
    pop = np.sin(2 * np.pi * np.cumsum(np.linspace(400, 1400, int(0.03 * SR))) / SR) * np.exp(-tt(0.03) / 0.01)
    x[:len(pop)] += 0.6 * pop
    return x


place(sfx, boing(), t_of(E['boing'][0]), 0.3, pan=0.1)


def hiss(dur=0.95):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    x = bp(n, 2400, 9000, 3)
    flutter = 1 + 0.25 * lp(rng.standard_normal(len(t)), 25)
    e = np.minimum(1, t / 0.03) * np.where(t < dur - 0.3, 1.0, np.maximum(0, (dur - t) / 0.3))
    spit = bp(rng.standard_normal(int(0.05 * SR)), 800, 7000) * np.exp(-tt(0.05) / 0.015)
    x = x * flutter * e
    x[:len(spit)] += 2.2 * spit
    growl = lp(signal.sawtooth(2 * np.pi * 118 * t) * (1 + 0.5 * np.sin(2 * np.pi * 23 * t)), 600) * e * 0.08
    return (x + growl) / np.max(np.abs(x + growl))


place(sfx, hiss(), t_of(E['hiss'][0]), 0.3)


def bloop():
    t = tt(0.16)
    f = np.linspace(300, 1300, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)


place(sfx, bloop(), t_of(E['pop'][0]), 0.28)
# hypno wobble while the eyes spin
t = tt(t_of(218) - t_of(148))
wob = np.sin(2 * np.pi * np.cumsum(480 + 90 * np.sin(2 * np.pi * 5 * t)) / SR)
wob = lp(wob + 0.4 * np.sin(2 * np.pi * np.cumsum(720 + 120 * np.sin(2 * np.pi * 5 * t + 1)) / SR), 2500)
wob *= np.minimum(1, t / 0.3) * np.minimum(1, (t[-1] - t) / 0.3)
place(sfx, wob, t_of(148) + 0.05, 0.035)


def whoosh(dur=0.7, f0=300, f1=3500):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(n)
    hop = 512
    for i in range(0, len(n), hop):
        u = i / len(n)
        fc = f0 * (f1 / f0) ** np.sin(np.pi * u * 0.9)
        seg = n[max(0, i - 2048):i + hop]
        y = bp(seg, max(60, fc * 0.6), min(SR / 2 - 100, fc * 1.6))
        out[i:i + hop] = y[-len(out[i:i + hop]):]
    return out * np.sin(np.pi * t / dur) ** 1.5


for f in E['whoosh']:
    place(sfx, whoosh(), t_of(f) - 0.25, 0.16)


def harp_gliss(start=60, n=12, step=0.045):
    scale = [0, 2, 4, 7, 9]
    out = np.zeros(int((n * step + 1.5) * SR))
    for i in range(n):
        m = start + 12 * (i // 5) + scale[i % 5]
        x = kalimba(midi(m), 1.3, 0.5)
        i0 = int(i * step * SR)
        out[i0:i0 + len(x)] += x
    return out


place(sfx, harp_gliss(), t_of(340) - 0.1, 0.07, pan=0.2)      # dreamy flashback cue
# thermal camera: beeps + scanner hum
for k in range(2):
    t = tt(0.08)
    place(sfx, np.sin(2 * np.pi * 1760 * t) * np.minimum(1, (0.08 - t) / 0.01), t_of(E['beep'][0]) + k * 0.14, 0.08)
t = tt(t_of(339) - t_of(219))
hum = (np.sin(2 * np.pi * 60 * t) + 0.5 * np.sin(2 * np.pi * 120 * t) + 0.15 * signal.sawtooth(2 * np.pi * 240 * t))
hum = lp(hum, 800) * np.minimum(1, t / 0.2) * np.minimum(1, (t[-1] - t) / 0.2)
place(sfx, hum, t_of(219), 0.02)
sweep_t = tt(0.9)
place(sfx, np.sin(2 * np.pi * np.cumsum(np.linspace(900, 2200, len(sweep_t))) / SR) * np.sin(np.pi * sweep_t / 0.9) ** 2,
      t_of(219) + 0.3, 0.025)
# fast clock ticking during the flashback
tick_t = t_of(E['tick_fast'][0])
k = 0
while tick_t < t_of(441):
    t = tt(0.02)
    place(sfx, bp(rng.standard_normal(len(t)), 2500, 6000) * np.exp(-t / 0.003), tick_t, 0.06)
    tick_t += max(0.05, 0.16 - k * 0.004)
    k += 1
# laptop rattle (enemy shot)
for f in E['shake']:
    t = tt(0.07)
    place(sfx, lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.02), t_of(f), 0.08, pan=0.2)
t = tt(t_of(594) - t_of(541))
rum = lp(signal.sawtooth(2 * np.pi * 46 * t) * (1 + 0.6 * np.sin(2 * np.pi * 9 * t)), 300)
place(sfx, rum * np.minimum(1, t / 0.15) * np.minimum(1, (t[-1] - t) / 0.15), t_of(541), 0.05)
# tense "enemy" sting at the tint shot
t = tt(0.9)
sting = sum(np.sin(2 * np.pi * midi(m) * t) for m in (43, 44, 50)) * np.exp(-t / 0.35)
place(sfx, lp(sting, 1500), t_of(496), 0.06)
# jump + landing
place(sfx, whoosh(0.35, 600, 4000), t_of(E['jump'][0]) - 0.05, 0.12)
t = tt(0.18)
thump = np.sin(2 * np.pi * np.cumsum(np.linspace(140, 70, len(t))) / SR) * np.exp(-t / 0.05)
place(sfx, thump + 0.3 * lp(rng.standard_normal(len(t)), 1200) * np.exp(-t / 0.02), t_of(E['land'][0]), 0.3)


def sparkle():
    out = np.zeros(int(1.4 * SR))
    for i, m in enumerate((84, 88, 91, 96, 100)):
        t = tt(0.9)
        x = (np.sin(2 * np.pi * midi(m) * t) + 0.3 * np.sin(2 * np.pi * midi(m) * 2.7 * t)) * np.exp(-t / 0.25)
        i0 = int(i * 0.06 * SR)
        out[i0:i0 + len(x)] += x
    return out


place(sfx, sparkle(), t_of(E['sparkle'][0]), 0.06, pan=0.3)
# freeze frame: record scratch + impact
t = tt(0.32)
fm = 1200 + 900 * np.sin(2 * np.pi * 7 * t) * np.exp(-t / 0.2)
scr = np.zeros_like(t)
n = rng.standard_normal(len(t))
for i in range(0, len(t), 256):
    seg = n[max(0, i - 1024):i + 256]
    y = bp(seg, fm[i] * 0.5, min(SR / 2 - 100, fm[i] * 1.5))
    scr[i:i + 256] = y[-len(scr[i:i + 256]):]
scr *= np.exp(-t / 0.12)
place(sfx, scr, FREEZE_T - 0.02, 0.22)
t = tt(0.8)
hit = (np.sin(2 * np.pi * np.cumsum(np.linspace(90, 45, len(t))) / SR) * np.exp(-t / 0.25)
       + 0.25 * lp(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.05))
place(sfx, hit, FREEZE_T, 0.35)

# ----------------------------------------------------------------------------
# voiceover + ducking + mix
# ----------------------------------------------------------------------------
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', VO_PATH, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, np.float32).astype(np.float64)
vo = vo[:N] if len(vo) >= N else np.pad(vo, (0, N - len(vo)))
vo = vo / (np.max(np.abs(vo)) + 1e-9) * 0.85
# envelope follower for ducking
envv = np.sqrt(lp(vo ** 2, 6.0, 1))
duck = 1.0 - 0.55 * np.clip(envv / (np.percentile(envv, 95) + 1e-9), 0, 1)
duck = lp(duck, 4.0, 1)
mix = np.zeros((N, 2))
mix += vo[:, None] * 1.0
mix += music * 0.55 * duck[:, None]
mix += sfx * (0.7 + 0.3 * duck)[:, None]
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
import wave  # noqa: E402
with wave.open(OUT, 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
# stems for inspection
for nm, x in (('music', music), ('sfx', sfx)):
    p = OUT.replace('.wav', f'_{nm}.wav')
    y = (np.clip(x / (np.max(np.abs(x)) + 1e-9) * 0.9, -1, 1) * 32767).astype(np.int16)
    with wave.open(p, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(y.tobytes())
print('wrote', OUT, 'duration', N / SR, 'peak before norm', round(peak, 3))
