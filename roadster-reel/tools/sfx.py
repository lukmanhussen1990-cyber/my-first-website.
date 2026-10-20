#!/usr/bin/env python3
"""All sound effects synthesized in code and placed on the shared timeline -> audio/sfx.wav.
Thruster loudness follows the exact same thrust curves that drive the 3D jets (render/anim.js)."""
import json, os, sys
import numpy as np
import soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *  # noqa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'timeline.json')))
EV = TL['events']
DUR = TL['duration']
N = int(DUR * SR)
T = np.arange(N) / SR


def ss(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


# ---- slow-motion time warp (same as anim.js) ----
_rate = 1 - 0.65 * ss(39.8, 40.2, T) * (1 - ss(44.4, 44.8, T))
TAU = np.cumsum(_rate) / SR


def tau(t):
    return float(np.interp(t, T, TAU))


TT = np.where(T < 39.0, T, TAU)


def thrust_curves():
    t, tt = T, TT
    rear = ((0.55 * ss(3.75, 3.95, t) + 0.6 * ss(4.62, 4.78, t)) * (1 - ss(5.0, 5.35, t)) +
            (0.5 * ss(13.2, 13.35, t) + 0.6 * ss(13.5, 13.62, t)) * (1 - ss(14.0, 14.35, t)) +
            0.95 * ss(22.5, 22.65, t) * (1 - ss(23.6, 24.0, t)) +
            1.0 * ss(tau(39.33), tau(39.45), tt) * (1 - ss(tau(40.1), tau(40.9), tt)))
    under = (1.3 * ss(33.9, 34.12, t) * (1 - ss(36.0, 37.2, t)) +
             (0.42 + 0.06 * np.sin(t * 11)) * ss(36.0, 37.2, t) * (1 - ss(39.3, 39.4, t)) +
             1.0 * ss(tau(39.33), tau(39.45), tt) * (1 - ss(tau(40.0), tau(40.6), tt)) +
             0.75 * ss(45.2, 45.3, t) * (1 - ss(45.92, 46.05, t)))
    sideR = np.zeros(N); sideL = np.zeros(N)
    for i, tp in enumerate(EV['side_puffs']):
        v = np.exp(-((t - tp) / 0.06) ** 2)
        if i % 2 == 0: sideR += v
        else: sideL += v
    return rear, under, sideR, sideL


def env_smooth(e, ms=15):
    k = max(1, int(ms / 1000 * SR)); return np.convolve(e, np.ones(k) / k, mode='same')


# ---------------------------------------------------------------- sounds
def horn(f1, f2, dur, bright=1.0, beeps=1):
    n = int(dur * SR); t = np.arange(n) / SR
    x = 0.5 * square(f1, n, 0.45) + 0.5 * square(f2 * 1.003, n, 0.45)
    x = bp(x, 280, 2600 * bright, 2)
    e = env_adsr(n, 0.012, 0.05, 0.85, 0.04)
    if beeps > 1:
        seg = n // beeps
        e = e * (np.sin(np.pi * ((np.arange(n) % seg) / seg)) > 0.15)
        e = env_smooth(e, 6)
    return soft_clip(x * e * 1.4, 1.5) * 0.6


def sigh(dur=0.8):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5 * np.exp(-t / 0.9)
    breath = filt(filt(noise(n), 'bp', 700, 2.0), 'peak', 1200, 1.5, 6) * 0.6 + filt(noise(n), 'bp', 2400, 1.5) * 0.25
    f0 = 150 - 40 * t / dur
    voiced = sine(f0, n) * 0.15 * ss(0.1, 0.25, t) * (1 - ss(0.45, dur, t))
    voiced = filt(voiced + 0.3 * saw(f0, n) * 0.1, 'lp', 900)
    return (breath + voiced) * e * 0.7


def click_beep():
    n = int(0.12 * SR); t = np.arange(n) / SR
    x = hp(noise(n), 3000) * np.exp(-t / 0.003) * 0.6
    x += np.sin(2 * np.pi * 1320 * t) * np.exp(-t / 0.05) * 0.3 * (t > 0.01)
    return x


def motor(t0, t1, f0, f1, gain=0.3, wob=0.0):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    u = t / max(1e-3, t1 - t0)
    f = f0 + (f1 - f0) * u ** 1.3
    f = f * (1 + wob * 0.02 * np.sin(2 * np.pi * 6 * t))
    x = sine(f, n) * 0.6 + sine(f * 2, n) * 0.25 + sine(f * 3, n) * 0.12 + filt(noise(n), 'bp', 2500, 1.0) * 0.05
    e = ss(0, 0.15, t) * (1 - ss(t1 - t0 - 0.2, t1 - t0, t))
    return x * e * gain


def jet_layer(env, kind='rear', seed=1):
    r = np.random.default_rng(seed)
    e = env_smooth(np.clip(env, 0, 1.5), 10)
    hiss = hp(r.standard_normal(N), 1800, 2) * 0.55 + bp(r.standard_normal(N), 500, 1800, 2) * 0.5
    roar = lp(r.standard_normal(N), 260 if kind != 'under' else 180, 2) * 2.2
    x = hiss * e + roar * e ** 1.4
    if kind == 'under':
        imp = (r.random(N) < 0.0025 * np.clip(e, 0, 1.3)).astype(float) * (r.random(N) - 0.5) * 6
        x += hp(imp, 600) * e
    # ignition whoosh on rising edges
    de = np.clip(np.diff(e, prepend=0) * SR / 8, 0, 1.5)
    x += lp(r.standard_normal(N), 900) * env_smooth(de, 60) * 1.2
    return x


def bonk():
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = 155 * np.exp(-t / 0.12) + 85
    x = sine(f, n) * np.exp(-t / 0.13) * 0.9 + sine(f * 2.7, n) * np.exp(-t / 0.05) * 0.3
    x += bp(noise(n), 500, 2200) * np.exp(-t / 0.02) * 0.6
    for fr, tau_ in ((740, 0.25), (1130, 0.18), (1680, 0.1)):
        x += np.sin(2 * np.pi * fr * t) * np.exp(-t / tau_) * 0.12
    return soft_clip(x * 1.3, 1.4)


def boing(dur=1.3, f=210):
    n = int(dur * SR); t = np.arange(n) / SR
    fv = f * (1 + 0.28 * np.exp(-t / 0.5) * np.sin(2 * np.pi * 7.5 * t))
    x = sine(fv, n) * 0.6 + sine(fv * 2, n) * 0.15
    return x * np.exp(-t / 0.45) * ss(0, 0.01, t) * 0.5


def chirp(f0=2200, f1=3200, d=0.09):
    n = int(d * SR); t = np.arange(n) / SR
    return sine(f0 + (f1 - f0) * t / d, n) * np.sin(np.pi * t / d) * 0.25


def shimmer(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, base in enumerate((2093, 2637, 3136, 3951)):
        f = base * (1 + 0.5 * t / dur)
        x += sine(f, n) * (0.5 + 0.5 * np.sin(2 * np.pi * (5 + k) * t)) * 0.12
    x += hp(noise(n), 6000) * 0.05
    return x * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7


def bell(f=1318.5, dur=1.8, gain=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for ratio, amp, tau_ in ((1, 1, 0.9), (2.0, 0.45, 0.5), (3.01, 0.25, 0.35), (4.2, 0.15, 0.25), (5.4, 0.1, 0.18)):
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau_)
    x[:200] *= np.linspace(0, 1, 200)
    return x * gain * 0.35


def servo(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 160 + 60 * np.sin(np.pi * t / dur)
    x = lp(saw(f, n), 1200) * 0.4 + sine(f * 4, n) * 0.08
    return x * ss(0, 0.04, t) * (1 - ss(dur - 0.06, dur, t)) * 0.5


def thud(f0=75, dur=0.35, gain=0.8):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sine(f0 * np.exp(-t / 0.1) + 35, n) * np.exp(-t / 0.12)
    x += lp(noise(n), 500) * np.exp(-t / 0.03) * 0.5
    return x * gain


def skid(dur=1.1):
    n = int(dur * SR); t = np.arange(n) / SR
    x = bp(noise(n), 1500, 4500) * 0.4
    f = 2350 * (1 + 0.02 * np.sin(2 * np.pi * 23 * t)) * (1 - 0.15 * t / dur)
    x += sine(f, n) * 0.18 + sine(f * 1.5, n) * 0.05
    return x * np.exp(-t / 0.45) * ss(0, 0.03, t) * 0.55


def whoosh(dur, f0=300, f1=3000, gain=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    u = t / dur
    x = sweep_filter(noise(n), 'bp', f0 * (f1 / f0) ** u, 1.4)
    return x * np.sin(np.pi * u) ** 1.2 * gain


def turbine(t0, t1, gain=0.18):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    f = 700 + 1900 * (1 - np.exp(-t / 0.35))
    x = sine(f, n) * 0.5 + sine(f * 1.51, n) * 0.2 + bp(noise(n), 800, 4000) * 0.3
    return x * ss(0, 0.2, t) * (1 - ss((t1 - t0) - 0.35, t1 - t0, t)) * gain


def squeak(dur=0.32, f=1900):
    n = int(dur * SR); t = np.arange(n) / SR
    ff = f * (1 + 0.25 * t / dur) * (1 + 0.03 * np.sin(2 * np.pi * 40 * t))
    x = sine(ff, n) * 0.5 + bp(noise(n), 1500, 3500) * 0.2
    return x * np.sin(np.pi * t / dur) * 0.45


def puff():
    n = int(0.16 * SR); t = np.arange(n) / SR
    return (hp(noise(n), 900) * 0.8 + lp(noise(n), 400) * 0.6) * np.exp(-t / 0.04) * ss(0, 0.004, t) * 0.7


def fall_whistle(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 2300 * (600 / 2300) ** (t / dur) * (1 + 0.006 * np.sin(2 * np.pi * 6 * t))
    return sine(f, n) * ss(0, 0.15, t) * (1 - ss(dur - 0.1, dur, t)) * 0.22


def wind(t0, t1, level, lo=300, hi=2500, seed=3, lfo=0.4):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    x = bp(r.standard_normal(n), lo, hi, 2)
    m = 0.6 + 0.4 * np.sin(2 * np.pi * lfo * t + 1.3) * np.sin(2 * np.pi * lfo * 0.37 * t)
    return x * m * level(t) if callable(level) else x * m * level


def brushes(t0, t1):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    rot = 2.4
    swish = np.abs(np.sin(np.pi * rot * 2 * t)) ** 3
    x = bp(noise(n), 500, 3000) * (0.35 + 0.65 * swish) * 0.6 + bp(noise(n), 2500, 8000) * 0.15
    return x * ss(0, 0.4, t) * (1 - ss(t1 - t0 - 0.4, t1 - t0, t))


def spray(t0, t1, gain=0.5, lo=1500):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    r = np.random.default_rng(int(t0 * 10))
    x = hp(r.standard_normal(n), lo, 2) * 0.6
    drops = (r.random(n) < 0.004).astype(float) * r.random(n)
    x += bp(drops, 1500, 6000) * 2.0
    return x * ss(0, 0.15, t) * (1 - ss(t1 - t0 - 0.3, t1 - t0, t)) * gain


def bubbles(t0, t1, rate=12, seed=5):
    r = np.random.default_rng(seed)
    out = np.zeros(int((t1 - t0) * SR))
    k = int((t1 - t0) * rate)
    for _ in range(k):
        st = int(r.random() * (len(out) - 4000)); d = 0.03 + r.random() * 0.05; n = int(d * SR); t = np.arange(n) / SR
        f = (300 + r.random() * 700) * (1 + 1.5 * t / d)
        out[st:st + n] += sine(f, n) * np.exp(-t / (d / 3)) * 0.2
    return out


def build():
    L = np.zeros((N, 2))
    add = lambda x, t0, g=1.0, p=0.0: place(L, pan(x, p) if x.ndim == 1 else x, t0, g)
    # ---- ambience: city traffic bed (fades as the car goes up), car-wash room tone at the end
    amb = lp(noise(N), 220) * 0.6 + bp(noise(N), 300, 1200) * 0.08
    amb_lvl = 0.22 * (1 - ss(19.5, 22.5, T)) + 0.12 * ss(45.0, 46.5, T)
    add(amb * amb_lvl, 0.0, 1.0, 0.0)
    # ---- horns
    for (tt, f1, f2, d, p, g, bt) in ((0.5, 392, 494, 0.5, -0.5, 0.32, 0.7), (1.15, 330, 415, 0.42, 0.45, 0.28, 0.8), (1.75, 440, 554, 0.65, -0.15, 0.24, 0.6)):
        add(horn(f1, f2, d, bt, beeps=2 if tt == 1.15 else 1), tt, g, p)
    for tt in EV['john_honks']:
        add(horn(587, 740, 0.17, 1.2), tt, 0.5, 0.05)
    add(sigh(0.85), EV['john_sigh'], 0.55, 0.0)
    add(click_beep(), EV['button_press'], 0.5, 0.0)
    # ---- electric motor whines
    add(motor(3.4, 4.9, 380, 1700, 0.22, wob=1), 3.4)
    add(motor(18.3, 19.5, 500, 1900, 0.2), 18.3)
    add(motor(19.6, 21.8, 1900, 2300, 0.18, wob=1), 19.6)
    add(motor(22.05, 23.05, 1300, 2500, 0.2), 22.05)
    add(motor(46.6, 51.3, 220, 260, 0.08, wob=1), 46.6)
    # ---- thrusters (follow the exact 3D thrust curves)
    rear, under, sideR, sideL = thrust_curves()
    add(np.stack([jet_layer(rear, 'rear', 1)] * 2, axis=1) * 0.30, 0.0)
    add(np.stack([jet_layer(under, 'under', 2)] * 2, axis=1) * 0.36, 0.0)
    for tp_i, tp in enumerate(EV['side_puffs']):
        add(puff(), tp - 0.03, 0.55, 0.65 if tp_i % 2 == 0 else -0.65)
    # ---- bonk on the bus + cartoon boing + dizzy chirps
    add(bonk(), EV['bus_bonk'], 0.95, 0.0)
    add(boing(1.4, 200), EV['bus_bonk'] + 0.04, 0.55, 0.1)
    for i, tt in enumerate(np.arange(7.35, 9.2, 0.32)):
        add(chirp(2400 + 300 * (i % 3), 3300 + 200 * (i % 2), 0.08), tt, 0.35, 0.4 * np.sin(i * 1.7))
    # ---- glowing dotted arc + target ring
    a0, a1 = EV['arc_draw']
    add(shimmer(a1 - a0 + 0.3), a0, 0.8, 0.0)
    add(bell(2093, 0.9, 0.5), 10.6, 1.0, 0.3)
    # ---- nozzles tilt to 45 degrees: servo + lock click + ding
    n0, n1 = EV['nozzle_tilt']
    add(servo(n1 - n0 - 0.2), n0, 0.6, -0.2)
    add(thud(240, 0.12, 0.35), n1 - 0.15, 1.0, -0.2)
    add(bell(1760, 1.2, 0.45), n1, 1.0, 0.0)
    # ---- plaza landing, tire skid
    add(thud(70, 0.35, 0.9), EV['plaza_land'])
    add(skid(1.15), EV['plaza_land'] + 0.03, 0.8, 0.0)
    # ---- suction fan: whoosh on + turbine hum while climbing
    add(whoosh(0.7, 250, 3500, 0.7), EV['fan_on'], 1.0, 0.0)
    add(turbine(EV['fan_on'], 22.3), EV['fan_on'])
    add(thud(110, 0.25, 0.6) + np.pad(whoosh(0.18, 900, 250, 0.4), (0, int(0.07 * SR))), EV['wall_contact'])
    add(wind(19.8, 22.2, lambda t: 0.25 * ss(0, 0.8, t), 400, 1500, 4), 19.8)
    add(thud(90, 0.3, 0.5), EV['roof_crest'])
    add(whoosh(0.9, 200, 2500, 0.55), EV['roof_launch'] - 0.1)
    # ---- tumble: rhythmic whooshes as the car spins, then wind
    s0, s1 = EV['spin']
    n = int((s1 - s0) * SR); t = np.arange(n) / SR
    roll = 3 * 2 * np.pi * np.where(t / (s1 - s0) < 0.5, 2 * (t / (s1 - s0)) ** 2, 1 - (-2 * t / (s1 - s0) + 2) ** 2 / 2)
    sw = np.abs(np.sin(roll)) ** 2
    tumble = bp(noise(n), 350, 2600, 2) * (0.25 + 0.75 * sw) * ss(0, 0.3, t) * (1 - ss((s1 - s0) - 0.6, s1 - s0, t))
    add(np.stack([tumble * (0.75 + 0.25 * np.sin(roll)), tumble * (0.75 - 0.25 * np.sin(roll))], axis=1) * 0.5, s0)
    add(squeak(0.34, 1850), EV['face_squish'][0] + 0.08, 0.7, 0.3)
    add(squeak(0.18, 2600), EV['face_squish'][1] - 0.12, 0.45, 0.3)
    add(wind(28.8, 31.6, 0.12, 300, 1800, 6, 0.25), 28.8)
    # ---- drop: rising wind + falling whistle
    d0, d1 = EV['drop']
    add(wind(d0, d1 + 0.3, lambda t: 0.08 + 0.42 * ss(0, d1 - d0, t), 500, 4000, 7, 0.8), d0)
    add(fall_whistle(d1 - d0 - 0.15), d0 + 0.1, 1.0, 0.0)
    # landing burn extras: smoke-ring whoomp
    add(whoosh(0.8, 120, 500, 0.9), EV['smoke_ring'], 1.0, 0.0)
    # ---- flip: kick whoosh, slow-motion deep swell, descent wind
    add(whoosh(1.2, 150, 1200, 0.6), EV['flip_kick'], 1.0, 0.0)
    sl0, sl1 = EV['slowmo']
    n = int((sl1 - sl0) * SR); t = np.arange(n) / SR
    swell = lp(noise(n), 300) * np.sin(np.pi * t / (sl1 - sl0)) ** 2 * 0.5 + bell(523, sl1 - sl0, 0.25)[:n] * 0.3
    add(swell, sl0, 0.8)
    add(wind(44.6, 46.0, lambda t: 0.1 + 0.35 * ss(0, 1.4, t), 400, 3000, 8, 1.0), 44.6)
    # ---- car wash
    add(thud(62, 0.45, 1.0), EV['carwash_land'])
    add(squeak(0.15, 1100), EV['carwash_land'] + 0.12, 0.35, -0.2)
    w0, w1 = EV['wash']
    add(pan(brushes(w0, w1), -0.15), w0, 0.85)
    add(pan(spray(46.6, 48.4, 0.35, 900), -0.3), 46.6, 1.0)      # foam arch
    add(pan(bubbles(46.8, 50.6, 14, 5), 0.2), 46.8, 1.0)
    add(pan(spray(48.9, 50.6, 0.5, 1500), 0.25), 48.9, 1.0)      # rinse
    add(np.stack([bubbles(50.6, 54.8, 3, 9) * 0.5] * 2, axis=1), 50.6)  # drips after
    # ---- clean ding (shine) and a sparkle
    add(bell(1318.5, 2.0, 0.85), EV['ding'], 1.0, 0.0)
    add(shimmer(0.7), EV['ding'] + 0.05, 0.45, 0.2)
    return L


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    L = build()
    L = L / max(1e-6, np.abs(L).max()) * 0.9
    sf.write(os.path.join(ROOT, 'audio', 'sfx.wav'), L.astype(np.float32), SR, subtype='FLOAT')
    print('sfx.wav', len(L) / SR, 's')
