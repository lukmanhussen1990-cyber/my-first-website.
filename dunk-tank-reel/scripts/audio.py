"""Procedural SFX + light funny background music, mixed under the user's voiceover.

python audio.py OUT_DIR VO.mp3
Writes sfx.wav, music.wav and mix.wav (48 kHz stereo).
"""
import sys, os, math, json, subprocess
import numpy as np
from scipy import signal

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else "/opt/work/audio"
VO = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
DUR = 29.5
rng = np.random.default_rng(42)

SHOT_START = {"S01a": 0, "S01b": 29, "S02": 60, "S03": 114, "S04a": 170, "S04b": 203, "S05": 222, "S06": 279,
              "S07a": 305, "S07b": 341, "S07c": 369, "S08": 393, "S09": 476, "S10": 509, "S11a": 560,
              "S11b": 594, "S11c": 620, "S12": 639, "S13a": 702, "S13b": 737, "S14": 776}


def T(shot, local_frame):
    """global time (s) of a local (1-based) frame in a shot"""
    return (SHOT_START[shot] + local_frame - 1) / 30.0


def t_arr(d):
    return np.arange(int(d * SR)) / SR


def env_exp(d, tau, attack=0.002):
    t = t_arr(d)
    e = np.exp(-t / tau)
    a = np.clip(t / attack, 0, 1)
    return e * a


def bandnoise(d, lo, hi, order=2):
    n = rng.standard_normal(int(d * SR))
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, n)


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


# ------------------------------------------------------------------ SFX
def sfx_splash(size=1.0):
    d = 0.9 + 0.9 * size
    body = bandnoise(d, 300, 7000) * env_exp(d, 0.12 + 0.18 * size, 0.004)
    hiss = bandnoise(d, 2500, 12000) * env_exp(d, 0.25 + 0.3 * size, 0.01) * 0.5
    t = t_arr(d)
    thump = np.sin(2 * np.pi * (70 + 40 * np.exp(-t * 30)) * t) * env_exp(d, 0.08 + 0.05 * size) * 0.9 * size
    out = body + hiss + thump
    # droplets
    for i in range(int(25 * size + 10)):
        st = rng.uniform(0.05, d * 0.85)
        f0 = rng.uniform(700, 2200)
        dd = 0.05
        tt = t_arr(dd)
        blip = np.sin(2 * np.pi * (f0 + f0 * 1.5 * tt / dd) * tt) * np.exp(-tt / 0.012)
        k = int(st * SR)
        out[k:k + len(blip)] += blip * rng.uniform(0.08, 0.3) * np.exp(-st / (0.5 * d))
    return norm(out, 1.0)


def sfx_pop():
    d = 0.09
    t = t_arr(d)
    f = 1300 * np.exp(-t * 35) + 280
    ph = 2 * np.pi * np.cumsum(f) / SR
    return norm(np.sin(ph) * env_exp(d, 0.03, 0.001), 1.0)


def sfx_click(d=0.015):
    return norm(highpass(rng.standard_normal(int(d * SR)), 2000) * env_exp(d, 0.003, 0.0005), 1.0)


def sfx_balloon_splat():
    a = sfx_click(0.02)
    b = sfx_splash(0.55)
    out = np.zeros(len(b) + 200)
    out[:len(a)] += a * 0.9
    out[100:100 + len(b)] += b
    return norm(out)


def sfx_whoosh(d=0.4, f0=300, f1=2500, slow=False):
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        frac = i / n
        fc = f0 * (f1 / f0) ** frac
        sos = signal.butter(2, [max(40, fc * 0.6), min(20000, fc * 1.6)], btype='band', fs=SR, output='sos')
        out[i:i + blk] = signal.sosfilt(sos, x[i:i + blk])
    t = t_arr(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    out = out * e
    if slow:
        out = lowpass(out, 900) * 1.5
    return norm(out)


def sfx_clang():
    d = 1.6
    t = t_arr(d)
    parts = [(523, 0.9, 0.35), (1312, 0.6, 0.25), (2154, 0.45, 0.18), (3380, 0.3, 0.12), (4705, 0.2, 0.08)]
    out = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / tau) for f, a, tau in parts)
    out += bandnoise(d, 1500, 9000) * env_exp(d, 0.02) * 0.6
    return norm(out)


def sfx_knock():
    d = 0.18
    t = t_arr(d)
    f = rng.uniform(180, 320)
    out = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) + bandnoise(d, 800, 5000) * env_exp(d, 0.008) * 0.6
    return norm(out)


def sfx_clunk():
    d = 0.5
    t = t_arr(d)
    out = np.sin(2 * np.pi * (110 + 60 * np.exp(-t * 40)) * t) * np.exp(-t / 0.09)
    out += bandnoise(d, 1200, 6000) * env_exp(d, 0.015) * 0.8
    for k in (0.03, 0.06, 0.085):
        c = sfx_click(0.01) * 0.5
        i = int(k * SR)
        out[i:i + len(c)] += c
    return norm(out)


def sfx_ding():
    d = 2.2
    t = t_arr(d)
    f0 = 1046.5
    parts = [(1.0, 1.0, 0.9), (2.0, 0.35, 0.6), (2.76, 0.4, 0.45), (5.4, 0.18, 0.25), (8.93, 0.08, 0.12)]
    out = sum(a * np.sin(2 * np.pi * f0 * m * t) * np.exp(-t / tau) for m, a, tau in parts)
    out[:int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return norm(out)


def sfx_thud():
    d = 0.35
    t = t_arr(d)
    out = np.sin(2 * np.pi * (60 + 50 * np.exp(-t * 30)) * t) * np.exp(-t / 0.08)
    out += lowpass(rng.standard_normal(len(t)), 600) * env_exp(d, 0.04) * 0.5
    return norm(out)


def sfx_step(soft=1.0):
    d = 0.12
    out = lowpass(rng.standard_normal(int(d * SR)), 900) * env_exp(d, 0.025, 0.003)
    return norm(out, soft)


def sfx_drip():
    d = 0.08
    t = t_arr(d)
    f = 900 + 1400 * (t / d)
    out = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.015)
    return norm(out)


def sfx_rustle(d=0.6):
    x = bandnoise(d, 1500, 9000)
    am = np.abs(lowpass(rng.standard_normal(len(x)), 25))
    am = am / am.max()
    t = t_arr(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1))
    return norm(x * am * e)


def sfx_snap():
    d = 0.12
    out = highpass(rng.standard_normal(int(d * SR)), 1500) * env_exp(d, 0.012, 0.0005)
    return norm(out)


def sfx_sparkle(d=0.8):
    out = np.zeros(int(d * SR))
    for i in range(14):
        st = rng.uniform(0, d * 0.7)
        f = rng.uniform(2500, 6000)
        dd = 0.25
        tt = t_arr(dd)
        b = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.06)
        k = int(st * SR)
        out[k:k + len(b)] += b[:len(out) - k] * rng.uniform(0.3, 1.0)
    return norm(out)


def sfx_fill(d=0.5):
    """water filling / pouring"""
    x = bandnoise(d, 400, 5000)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 9 * t_arr(d))
    t = t_arr(d)
    e = np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.15)
    return norm(x * am * e)


# ------------------------------------------------------------------ event list
EV = []


def ev(t, snd, gain_db=0.0, pan=0.0):
    EV.append((t, snd, gain_db, pan))


# S01-S02: sneaky rustle
ev(0.05, sfx_rustle(0.5), -22)
ev(T("S02", 1) - 0.02, sfx_whoosh(0.25, 2000, 6000), -24)        # binocular zoom-in
# S03 throw
ev(T("S03", 10), sfx_rustle(0.7), -14)
ev(T("S03", 22), sfx_whoosh(0.45, 400, 3000), -10)
# S04a slow-mo whoosh
ev(T("S04a", 1), sfx_whoosh(1.1, 120, 600, slow=True), -9)
# S04b splat
ev(T("S04b", 5), sfx_balloon_splat(), -4)
# S05 fast build knocks + bucket clank
for f in (7, 10, 13, 17, 20, 23, 28):
    ev(T("S05", f), sfx_knock(), -10, pan=rng.uniform(-0.4, 0.4))
    ev(T("S05", f) + 0.07, sfx_knock(), -14)
ev(T("S05", 38), sfx_clang(), -13)
ev(T("S06", 1) - 0.02, sfx_whoosh(0.25, 2000, 6000), -24)
ev(T("S06", 6), sfx_sparkle(0.7), -20)
# S07a footsteps
for f in (8, 13, 18, 23, 28):
    ev(T("S07a", f), sfx_step(0.8), -16)
# S07b tug, clang, dump splash
ev(T("S07b", 9), sfx_snap(), -16)
ev(T("S07b", 12), sfx_clang(), -9)
ev(T("S07b", 13), sfx_fill(0.35), -12)
ev(T("S07b", 15), sfx_splash(0.8), -4)
# S07c drips
for f in (3, 9, 14, 19, 23):
    ev(T("S07c", f), sfx_drip(), -18, pan=rng.uniform(-0.3, 0.3))
# S08 fast tank build
for f in range(4, 54, 2):
    if f not in (34, 36, 38):
        ev(T("S08", f), sfx_knock(), -13, pan=rng.uniform(-0.5, 0.5))
ev(T("S08", 31), sfx_fill(0.6), -11)
ev(T("S08", 62), sfx_thud(), -7)
ev(T("S08", 70), sfx_snap(), -9)
ev(T("S08", 71), sfx_pop(), -14)
# S09 genius sparkle
ev(T("S09", 3), sfx_sparkle(1.0), -15)
# S11 lever
ev(T("S11a", 2), sfx_pop(), -11)
ev(T("S11a", 16), sfx_clunk(), -5)
ev(T("S11b", 2), sfx_clunk(), -9)
ev(T("S11b", 6), sfx_splash(1.4), -1)
ev(T("S11c", 1) - 0.02, sfx_whoosh(0.25, 2000, 6000), -24)
for f in (4, 10, 16):
    ev(T("S11c", f), sfx_drip(), -18)
# S12 tired footsteps
for f in range(2, 63, 5):
    ev(T("S12", f), sfx_step(0.9), -15, pan=-0.2)
# S13 target + throw + ding + huge splash
ev(T("S13a", 2), sfx_pop(), -11)
ev(T("S13a", 9), sfx_rustle(0.5), -15)
ev(T("S13a", 18), sfx_whoosh(0.5, 500, 3500), -9)
ev(T("S13b", 4), sfx_ding(), -3)
ev(T("S13b", 6), sfx_clunk(), -10)
ev(T("S13b", 10), sfx_splash(1.8), 0)
# S14 drips + final flourish handled by music
for f in range(5, 105, 9):
    ev(T("S14", f), sfx_drip(), -21, pan=rng.uniform(-0.5, 0.5))


def render_sfx():
    out = np.zeros((int(DUR * SR) + SR * 3, 2))
    for t, snd, gdb, pan in EV:
        i = int(t * SR)
        g = 10 ** (gdb / 20)
        l = math.cos((pan + 1) * math.pi / 4)
        r = math.sin((pan + 1) * math.pi / 4)
        n = min(len(snd), len(out) - i)
        out[i:i + n, 0] += snd[:n] * g * l * 1.414
        out[i:i + n, 1] += snd[:n] * g * r * 1.414
    return out[:int(DUR * SR)]


# ------------------------------------------------------------------ music
BPM = 120
BEAT = 60 / BPM


def ks_pluck(freq, d, bright=0.5, decay=0.996):
    n = int(d * SR)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    buf = lowpass(np.concatenate([buf, buf]), 2000 + 8000 * bright)[:p]
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = decay * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone_bass(freq, d):
    t = t_arr(d)
    x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)
    return x * np.exp(-t / 0.25) * np.minimum(1, t / 0.005)


def render_music():
    n = int(DUR * SR)
    mus = np.zeros((n, 2))
    # chord progression (C - Am - F - G), 1 bar each, roots in MIDI
    prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]
    melody = [72, None, 76, 74, 72, None, 67, None, 69, 72, None, 69, 67, None, None, None,
              65, None, 69, 72, 74, None, 72, None, 71, None, 74, 71, 67, None, None, None]
    bar = 4 * BEAT
    nbars = int(DUR / bar) + 1
    cache = {}

    def add(sig, t0, gain, pan=0.0):
        i = int(t0 * SR)
        if i >= n:
            return
        k = min(len(sig), n - i)
        l = math.cos((pan + 1) * math.pi / 4) * 1.414
        r = math.sin((pan + 1) * math.pi / 4) * 1.414
        mus[i:i + k, 0] += sig[:k] * gain * l
        mus[i:i + k, 1] += sig[:k] * gain * r

    def pl(m, d, bright=0.5, decay=0.996):
        key = (m, round(d, 2), bright, decay)
        if key not in cache:
            cache[key] = ks_pluck(note(m), d, bright, decay)
        return cache[key]

    end_t = 27.25          # final "ta-da" after the last word
    for b in range(nbars):
        t0 = b * bar
        if t0 >= end_t:
            break
        root, chord = prog[b % 4]
        # bass on beats 1, 3 (+ pickup)
        add(tone_bass(note(root), BEAT * 0.9), t0, 0.55)
        add(tone_bass(note(root + 7 if b % 2 else root + 12), BEAT * 0.9), t0 + 2 * BEAT, 0.45)
        add(tone_bass(note(root + 4), BEAT * 0.45), t0 + 3.5 * BEAT, 0.3)
        # ukulele-ish strums on the off-beats
        for beat in (1, 3):
            for j, m in enumerate(chord):
                add(pl(m, BEAT * 0.8, 0.6, 0.992), t0 + beat * BEAT + j * 0.012, 0.16, pan=-0.3 + 0.3 * j)
        for beat in (1.5, 3.5):
            for j, m in enumerate(chord):
                add(pl(m + 12, BEAT * 0.4, 0.7, 0.99), t0 + beat * BEAT + j * 0.008, 0.07, pan=0.4)
        # pizzicato melody (8th notes)
        for k in range(8):
            m = melody[(b % 4) * 8 + k]
            if m is not None:
                add(pl(m, BEAT * 0.45, 0.8, 0.993), t0 + k * BEAT / 2, 0.28, pan=0.15)
        # light percussion: shaker 8ths, soft clap on 2 & 4, soft kick on 1 & 3
        for k in range(8):
            sh = highpass(rng.standard_normal(int(0.05 * SR)), 6000) * env_exp(0.05, 0.012)
            add(sh, t0 + k * BEAT / 2, 0.05 if k % 2 else 0.08, pan=0.5)
        for beat in (1, 3):
            cl = bandnoise(0.12, 900, 4000) * env_exp(0.12, 0.03)
            add(norm(cl), t0 + beat * BEAT, 0.12, pan=-0.1)
        for beat in (0, 2):
            tt = t_arr(0.2)
            kick = np.sin(2 * np.pi * (50 + 80 * np.exp(-tt * 40)) * tt) * np.exp(-tt / 0.08)
            add(kick, t0 + beat * BEAT, 0.16)
    # final ta-da (C major, bright) + cymbal swell
    for j, m in enumerate([60, 64, 67, 72, 76]):
        add(pl(m, 2.2, 0.9, 0.9985), end_t + j * 0.02, 0.22, pan=-0.4 + 0.2 * j)
    add(tone_bass(note(36), 1.5), end_t, 0.6)
    cym = highpass(rng.standard_normal(int(2.0 * SR)), 5000) * env_exp(2.0, 0.6, 0.01)
    add(cym, end_t, 0.08)
    # fade out the tail
    fade_start = int(28.6 * SR)
    mus[fade_start:] *= np.linspace(1, 0, n - fade_start)[:, None]
    return mus


def write_wav(path, x):
    import scipy.io.wavfile as wf
    x = np.clip(x, -1, 1)
    wf.write(path, SR, (x * 32767).astype(np.int16))


if __name__ == "__main__":
    sfx = render_sfx()
    sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.85
    write_wav(os.path.join(OUT, "sfx.wav"), sfx)
    mus = render_music()
    mus = mus / (np.max(np.abs(mus)) + 1e-9) * 0.8
    write_wav(os.path.join(OUT, "music.wav"), mus)
    json.dump([(round(t, 3), g) for t, _, g, _ in EV], open(os.path.join(OUT, "sfx_events.json"), "w"))
    print("AUDIO_OK", len(EV), "events")
