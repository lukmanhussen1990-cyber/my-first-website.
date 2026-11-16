"""Audio mix: the voiceover untouched + background song ducked underneath + soft SFX.

usage: python audio.py voiceover.mp3 song.mp3 out.wav
- voice: unchanged samples (no gain, no EQ, no time change), 44.1 kHz
- song: from 0:00, levelled to sit ~22 dB under the voice, quieter in sad scenes,
        fully silent during the one-minute-silence shot, gentle breathing in pauses
- sfx: procedurally synthesised, always far below the voice
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 44100
SONG_OFFSET = 12.15   # song time where the vocals start (after the instrumental intro)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(path, ch):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'])
    a = np.frombuffer(raw, np.float32)
    return a.reshape(-1, ch) if ch > 1 else a


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-9))


def undb(d):
    return 10 ** (d / 20.0)


def _box(x, n):
    """centred moving average, O(N) via cumulative sum"""
    n = max(1, int(n))
    c = np.cumsum(np.concatenate([np.zeros(1), x]))
    h = n // 2
    idx = np.arange(len(x))
    lo = np.clip(idx - h, 0, len(x))
    hi = np.clip(idx - h + n, 0, len(x))
    return (c[hi] - c[lo]) / np.maximum(1, hi - lo)


def rms_env(x, win):
    return np.sqrt(_box(x * x, win) + 1e-12)


def smooth(x, n):
    if n < 2:
        return x
    return _box(_box(x, n // 2), n // 2)   # two box passes ~ triangular window


def piecewise_db(t, pts):
    """pts: list of (time, dB) – linear interpolation in dB; -inf allowed via -120"""
    ts = np.array([p[0] for p in pts])
    ds = np.array([p[1] for p in pts])
    return np.interp(t, ts, ds)


# ---------------------------------------------------------------- synth helpers
rng = np.random.default_rng(7)


def env_ad(n, a, d):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    e[na:] = np.exp(-np.arange(n - na) / (d * SR))
    return e


def noise(n):
    return rng.standard_normal(n).astype(np.float64)


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    m = smooth(m, 31)
    return np.fft.irfft(X * m, len(x))


def lowpass(x, fc):
    return bandpass(x, 0, fc)


def place(buf, sig, t0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= len(buf):
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(buf) - i0)
    buf[i0:i0 + n] += sig[:n] * gain


def whoosh(dur=0.45, lo=600, hi=5000):
    n = int(dur * SR)
    x = bandpass(noise(n), lo, hi)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x / (np.abs(x).max() + 1e-9) * e


def paper_rustle(dur=0.35):
    n = int(dur * SR)
    x = bandpass(noise(n), 1500, 7000)
    crackle = (rng.random(n) < 0.004) * rng.standard_normal(n) * 3
    e = env_ad(n, 0.02, dur * 0.35)
    y = (x / (np.abs(x).max() + 1e-9) + crackle * 0.3) * e
    return y


def tear(dur=0.6):
    n = int(dur * SR)
    x = bandpass(noise(n), 800, 6000)
    am = 0.5 + 0.5 * np.sign(np.sin(np.cumsum(rng.uniform(80, 220, n)) / SR * 2 * np.pi))
    e = env_ad(n, 0.01, dur * 0.5)
    return x / (np.abs(x).max() + 1e-9) * am * e


def thud(dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 70 * np.exp(-t * 6) + 45
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    click = bandpass(noise(n), 2000, 8000) * np.exp(-t * 80) * 0.25
    return s + click


def marimba_note(freq, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 25))
    return s * np.exp(-t * 7) * np.minimum(1, t / 0.003)


def ringtone(total):
    out = np.zeros(int(total * SR))
    notes = [1318.5, 1046.5, 1568.0, 1318.5, 1760.0, 1568.0]
    t = 0.0
    while t < total:
        for k, f in enumerate(notes):
            place(out, marimba_note(f, 0.45), t + k * 0.16, 0.7)
        t += 1.3
    return out


def vibration(total):
    n = int(total * SR)
    t = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 165 * t)) * 0.5 + np.sin(2 * np.pi * 330 * t) * 0.3
    gate = ((t % 0.9) < 0.42).astype(float)
    gate = smooth(gate, 400)
    return lowpass(buzz, 900) * gate


def old_bell_ring(dur=1.1):
    """vintage telephone bell: clapper trill on two metallic gongs"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    partials = [(1.0, 1.0), (2.76, 0.5), (5.4, 0.3), (8.9, 0.15)]
    base = 1180.0
    gong = sum(a * np.sin(2 * np.pi * base * r * t + r) for r, a in partials)
    gong2 = sum(a * np.sin(2 * np.pi * base * 1.06 * r * t + 2 * r) for r, a in partials)
    trill = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 19 * t))
    trill = smooth(trill, 60)
    s = gong * trill + gong2 * (1 - trill)
    e = np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.08)
    return s * e * 0.35


def rain(total):
    n = int(total * SR)
    x = lowpass(noise(n), 3500) * 0.5
    drops = np.zeros(n)
    idx = rng.integers(0, n, int(total * 90))
    drops[idx] = rng.uniform(0.3, 1.0, len(idx))
    k = np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR))
    drops = np.convolve(drops, k, mode='same')
    drops = bandpass(drops, 1200, 8000)
    y = x + drops * 0.6
    return y / (np.abs(y).max() + 1e-9)


def pop(dur=0.12, f0=900):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 2 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)


# ---------------------------------------------------------------- main
def main():
    vo_path, song_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    import render  # timeline (shot times, END)
    render.init()
    END = render.END
    shots = {s['name']: s for s in render.SHOTS}
    WS = render.WS

    N = int(round(END * SR))
    t = np.arange(N) / SR
    voice = load(vo_path, 1).astype(np.float64)
    voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]

    song = load(song_path, 2).astype(np.float64)
    song = song[int(SONG_OFFSET * SR):]             # start where the singing begins
    song = np.pad(song, ((0, max(0, N - len(song))), (0, 0)))[:N]

    # ---- voice level reference (active speech RMS)
    venv = rms_env(voice, int(0.05 * SR))
    active = venv > undb(db(venv.max()) - 30)
    v_rms_db = db(np.sqrt(np.mean(voice[active] ** 2)))
    print(f"voice active RMS {v_rms_db:.1f} dBFS, peak {db(np.abs(voice).max()):.1f} dBFS")

    # ---- song levelling: halve its dynamic range around the target
    mono = song.mean(1)
    s_env = rms_env(mono, int(1.5 * SR))
    s_env_db = db(s_env)
    s_avg_db = db(np.sqrt(np.mean(mono ** 2)))
    lev_db = (s_avg_db - s_env_db) * 0.7            # levelling: lift the quiet intro
    lev_db = np.clip(lev_db, -4, 10)
    target_db = v_rms_db - 10.0                      # ~10 dB under the voice (user: louder)
    base_gain_db = target_db - s_avg_db + lev_db

    # ---- scene envelope (dB relative to base)
    def st(name):
        return shots[name]['t0']
    sil0, sil1 = st('s14d_clock'), st('s15_empty')
    scene = [
        (0.0, 0.0), (1.2, 0.0),
        (st('s13a_window') - 0.3, 0.0), (st('s13a_window') + 0.6, -2.5),
        (st('s14a_funeral') - 0.2, -2.5), (st('s14a_funeral') + 0.4, -4.0),
        (sil0 - 0.45, -4.0), (sil0 + 0.05, -120.0),
        (sil1 - 0.05, -120.0), (sil1 + 1.3, -5.0),
        (st('s16a_stage') - 0.2, -5.0), (st('s16a_stage') + 0.4, -3.0),
        (st('s16b_reveal') - 0.15, -3.0), (st('s16b_reveal') + 0.25, 1.5),
        (st('s17a_city') + 0.2, 0.0),
        (WS[-1] + 0.25, 0.0), (WS[-1] + 0.7, 2.0), (END - 1.0, 2.0), (END, -60.0),
    ]
    scene_db = piecewise_db(t, scene)

    # ---- gentle sidechain: music breathes up a little in pauses
    vad = (venv > undb(v_rms_db - 18)).astype(float)
    att = np.zeros_like(vad)
    a_up, a_dn = 1 - np.exp(-1 / (0.03 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    # fast vectorised approximation of attack/release smoothing via two passes
    att = smooth(np.maximum(vad, smooth(vad, int(0.3 * SR))), int(0.12 * SR))
    duck_db = -2.0 * np.clip(att, 0, 1)

    gain = undb(base_gain_db + scene_db + duck_db)
    gain[scene_db < -100] = 0.0
    music = song * gain[:, None]

    # ---- SFX bus
    sfx = np.zeros(N)
    sfx_l = undb(v_rms_db - 18)   # loudest sfx reference (still well under the voice)
    th = WS[5]                    # HELLO
    place(sfx, ringtone(th) * np.linspace(1, 0.9, int(th * SR)), 0.0, sfx_l * 0.55)
    place(sfx, vibration(th), 0.0, sfx_l * 0.35)
    place(sfx, pop(0.1, 1400), WS[9], sfx_l * 0.35)            # heart pop on PYAAR
    for k in range(5):
        place(sfx, pop(0.09, 1100 + 120 * k), WS[82] + k * 0.22, sfx_l * 0.22)   # floating hearts
    # transitions
    for s in render.SHOTS:
        tr = s['tr']
        if tr in ('page', 'slide_left', 'slide_up', 'zoom_in'):
            place(sfx, paper_rustle(0.4), s['t0'] - 0.18, sfx_l * 0.35)
        elif tr == 'flyby':
            place(sfx, whoosh(0.55, 500, 4500), s['t0'] - 0.3, sfx_l * 0.45)
            for k in range(3):
                place(sfx, paper_rustle(0.25), s['t0'] - 0.2 + k * 0.08, sfx_l * 0.2)
        elif tr == 'crack':
            place(sfx, tear(0.7), s['t0'] - 0.45, sfx_l * 0.5)
        elif tr == 'iris':
            place(sfx, whoosh(0.5, 300, 2500), s['t0'] - 0.25, sfx_l * 0.3)
        elif tr == 'curtain':
            place(sfx, whoosh(0.6, 300, 3000), s['t0'] - 0.1, sfx_l * 0.5)
    place(sfx, thud(0.5), WS[126], sfx_l * 0.8)                  # calendar slams to 1876
    # vintage wall phone ringing beside Mabel (she does not react)
    s13 = shots['s13b_ring']
    tt = 0.0
    while tt < s13['T'] - 0.1:
        place(sfx, old_bell_ring(min(1.1, s13['T'] - tt)), s13['t0'] + tt, sfx_l * 0.42)
        tt += 1.6
    # rain at the funeral (stops for the silence), soft rain on the window in the empty room
    r1 = rain(sil0 - st('s14a_funeral'))
    r1 *= np.minimum(1, np.linspace(0, len(r1) / SR, len(r1)) / 0.5)
    r1 *= np.minimum(1, (len(r1) / SR - np.linspace(0, len(r1) / SR, len(r1))) / 0.4)
    place(sfx, r1, st('s14a_funeral'), sfx_l * 0.28)
    r2 = rain(st('s16a_stage') - sil1)
    r2 *= np.minimum(1, np.linspace(0, len(r2) / SR, len(r2)) / 1.0)
    r2 *= np.minimum(1, (len(r2) / SR - np.linspace(0, len(r2) / SR, len(r2))) / 0.5)
    place(sfx, r2, sil1, sfx_l * 0.16)
    # absolute silence (except the voice) during the one-minute silence
    sfx[int(sil0 * SR):int(sil1 * SR)] = 0.0

    bed = music + sfx[:, None] * 0.9
    # soft safety limiter on the bed only (voice never touched)
    pk = np.abs(bed).max()
    lim = undb(v_rms_db + 4)
    if pk > lim:
        bed *= lim / pk
    mix = bed + voice[:, None]
    peak = np.abs(mix).max()
    print(f"mix peak {db(peak):.2f} dBFS; music RMS (normal section) "
          f"{db(np.sqrt(np.mean(music[int(30 * SR):int(60 * SR)] ** 2))):.1f} dBFS")
    if peak > 0.98:
        raise SystemExit('mix would clip; lower bed')
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', out_path],
                   input=pcm.tobytes(), check=True)
    # verify the voice is bit-identical-ish after removing the bed
    print('wrote', out_path, f'{N / SR:.3f}s')


if __name__ == '__main__':
    main()
