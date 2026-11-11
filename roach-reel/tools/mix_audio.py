"""Sound design + mix: places SFX on word-timed cues (build/timeline.json), synthesises procedural SFX,
ducks everything under the voiceover and writes build/mix.wav (48 kHz stereo) matching the video length."""
import json, subprocess, sys
import numpy as np

SR = 48000
RNG = np.random.default_rng(7)
TL = json.load(open('build/timeline.json'))
DUR = TL['frames'] / 60.0
N = int(round(DUR * SR))

def load(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).reshape(-1, 2).copy()

def db(x): return 10 ** (x / 20)
def t_(d): return np.arange(int(d * SR)) / SR
def env_exp(d, k): return np.exp(-k * t_(d))
def stereo(m, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l * 1.414, m * r * 1.414], axis=1)
def noise(d): return RNG.standard_normal(int(d * SR))
def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def biquad_bp(x, f0, q):
    w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    b0, b1, b2 = al, 0, -al; a0, a1, a2 = 1 + al, -2 * np.cos(w), 1 - al
    from scipy.signal import lfilter
    return lfilter([b0 / a0, b1 / a0, b2 / a0], [1, a1 / a0, a2 / a0], x)
def hp(x, fc):
    from scipy.signal import butter, lfilter
    b, a = butter(2, fc / (SR / 2), 'high'); return lfilter(b, a, x)
def lp(x, fc):
    from scipy.signal import butter, lfilter
    b, a = butter(2, min(fc, SR / 2 - 100) / (SR / 2), 'low'); return lfilter(b, a, x)
def bp(x, lo, hi):
    from scipy.signal import butter, lfilter
    b, a = butter(2, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band'); return lfilter(b, a, x)
def sweep(f0, f1, d, curve='exp'):
    t = t_(d)
    f = f0 * (f1 / f0) ** (t / d) if curve == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9; return x / m * peak
def fade(x, a=0.005, b=0.02):
    n = len(x); ia = min(n, int(a * SR)); ib = min(n, int(b * SR))
    if ia: x[:ia] *= np.linspace(0, 1, ia)[:, None] if x.ndim == 2 else np.linspace(0, 1, ia)
    if ib: x[-ib:] *= np.linspace(1, 0, ib)[:, None] if x.ndim == 2 else np.linspace(1, 0, ib)
    return x

# ------------------------------------------------------------------ procedural SFX
def s_riser(dur=2.1):
    t = t_(dur); e = (t / dur) ** 2.2
    tone = sweep(70, 520, dur) * 0.5 + sweep(105, 780, dur) * 0.25
    n = bp(noise(dur), 400, 6000) * (t / dur) ** 3
    return stereo(norm(tone * e + n * 0.5) * 0.9)
def s_drone(dur=2.7):
    t = t_(dur)
    m = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.4 * t) + 0.3 * np.sin(2 * np.pi * 110.3 * t)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t))
    m += lp(noise(dur), 300) * 0.4
    return fade(stereo(norm(m) * np.minimum(1, t / 0.4)), 0.01, 0.3)
def s_boom():
    d = 1.4; t = t_(d)
    m = sweep(110, 32, 0.5) ; m = np.pad(m, (0, len(t) - len(m)))[:len(t)] * np.exp(-3.2 * t)
    m += lp(noise(d), 200) * np.exp(-14 * t) * 0.8
    m = np.tanh(m * 2.2)
    return stereo(norm(m))
def s_sting_hit():
    d = 1.0; t = t_(d)
    m = sum(((2 * ((f * t) % 1) - 1)) for f in (110, 116.5, 164.8, 220)) * np.exp(-3.5 * t)
    return stereo(norm(lp(m, 2200)))
def s_clock_ticks(dur=1.1):
    out = np.zeros(int(dur * SR))
    for i, st in enumerate(np.arange(0.02, dur, 0.5)):
        f = 2600 if i % 2 == 0 else 2100
        c = np.sin(2 * np.pi * f * t_(0.04)) * np.exp(-120 * t_(0.04)) + bp(noise(0.04), 1500, 6000) * np.exp(-200 * t_(0.04)) * 0.6
        s = int(st * SR); out[s:s + len(c)] += c[:len(out) - s]
    return stereo(norm(out) * 0.8, 0.2)
def s_whoosh_short(d=0.38):
    t = t_(d); e = np.sin(np.pi * t / d) ** 2
    n = noise(d); f = 300 + 2700 * np.sin(np.pi * t / d)
    y = np.zeros_like(n)
    for k in range(0, len(n), 480):
        fc = f[k]; y[k:k + 480] = bp(n[max(0, k - 2000):k + 480], fc * 0.6, fc * 1.6)[-len(n[k:k + 480]):]
    m = norm(y * e)
    pan = np.linspace(-0.7, 0.7, len(m))
    return np.stack([m * np.cos((pan + 1) * np.pi / 4), m * np.sin((pan + 1) * np.pi / 4)], axis=1) * 1.3
def s_footsteps(dur=1.0):
    out = np.zeros(int(dur * SR))
    for st in (0.02, 0.36, 0.7):
        d = 0.09; c = lp(noise(d), 380) * np.exp(-40 * t_(d)) + np.sin(2 * np.pi * 90 * t_(d)) * np.exp(-50 * t_(d)) * 0.5
        s = int(st * SR); out[s:s + len(c)] += c[:len(out) - s]
    return stereo(norm(out) * 0.8, -0.3)
def s_boing():
    d = 0.6; t = t_(d)
    f = 260 + 220 * t / d + 120 * np.sin(2 * np.pi * 11 * t) * np.exp(-5 * t)
    m = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-5 * t)
    return stereo(norm(m) * 0.9)
def s_snap():
    d = 0.15; t = t_(d)
    m = bp(noise(d), 800, 5000) * np.exp(-90 * t) + np.sin(2 * np.pi * 190 * t) * np.exp(-35 * t)
    return stereo(norm(m))
def s_sparkle(dur=1.3):
    out = np.zeros((int(dur * SR), 2))
    for i in range(int(dur * 12)):
        st = RNG.uniform(0, dur - 0.3); f = RNG.uniform(2400, 6500); d = 0.3
        c = np.sin(2 * np.pi * f * t_(d)) * np.exp(-14 * t_(d))
        s = int(st * SR); out[s:s + len(c)] += stereo(c, RNG.uniform(-0.8, 0.8))[:len(out) - s] * RNG.uniform(0.3, 1)
    return norm(out) * 0.7
def s_zing():
    d = 0.32; t = t_(d)
    f = 600 * (4 ** (t / d)) * (1 + 0.03 * np.sin(2 * np.pi * 30 * t))
    return stereo(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-6 * t)))
def s_stamp():
    d = 0.35; t = t_(d)
    m = np.sin(2 * np.pi * 85 * t) * np.exp(-22 * t) + bp(noise(d), 900, 3500) * np.exp(-70 * t) * 0.8
    return stereo(norm(np.tanh(m * 1.6)))
def s_iris():
    d = 0.5; t = t_(d)
    m = sweep(220, 55, d) * np.exp(-4 * t) + lp(noise(d), 1200) * np.sin(np.pi * t / d) * 0.6
    return stereo(norm(m))
def s_latch():
    out = np.zeros(int(0.25 * SR))
    for st in (0.0, 0.06):
        d = 0.08; c = bp(noise(d), 2500, 9000) * np.exp(-150 * t_(d)) + np.sin(2 * np.pi * 3200 * t_(d)) * np.exp(-60 * t_(d)) * 0.4
        s = int(st * SR); out[s:s + len(c)] += c
    return stereo(norm(out))
def s_pop():
    d = 0.16; t = t_(d)
    m = sweep(950, 230, 0.08); m = np.pad(m, (0, len(t) - len(m))) * np.exp(-28 * t) + bp(noise(d), 1000, 4000) * np.exp(-120 * t) * 0.3
    return stereo(norm(m))
def s_thump():
    d = 0.4; t = t_(d)
    return stereo(norm(np.sin(2 * np.pi * 70 * t) * np.exp(-14 * t) + lp(noise(d), 250) * np.exp(-30 * t) * 0.5))
def s_fridge_hum(dur=0.6):
    t = t_(dur)
    m = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((60, 1), (120, 0.6), (180, 0.35), (240, 0.2))) * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * t))
    return fade(stereo(norm(m) * 0.8, -0.4), 0.05, 0.1)
def s_paper_slide():
    d = 0.5; t = t_(d)
    m = bp(noise(d), 2000, 7000) * np.sin(np.pi * t / d) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t))
    return stereo(norm(m), -0.3)
def s_blip():
    a = np.sin(2 * np.pi * 520 * t_(0.12)) * np.exp(-8 * t_(0.12)); b = np.sin(2 * np.pi * 780 * t_(0.16)) * np.exp(-8 * t_(0.16))
    return stereo(norm(np.concatenate([a, b])) * 0.8)
def s_spray(dur=0.9):
    t = t_(dur)
    m = hp(noise(dur), 2500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t))) * np.sin(np.pi * t / dur)
    return stereo(norm(m) * 0.8, 0.3)
def s_shimmer():
    d = 0.6; t = t_(d)
    m = sum(np.sin(2 * np.pi * f * t) for f in (1320, 1650, 1980)) * np.sin(np.pi * t / d) ** 2
    return stereo(norm(m) * 0.6)
def s_march(dur=3.4):
    n = int(dur * SR); out = np.zeros((n, 2))
    for i in range(int(dur * 38)):
        st = RNG.uniform(0, dur - 0.05); d = 0.025
        c = bp(noise(d), 3000, 9000) * np.exp(-220 * t_(d))
        s = int(st * SR); out[s:s + len(c)] += stereo(c, RNG.uniform(-0.9, 0.9))[:n - s] * RNG.uniform(0.2, 0.7)
    # toy snare march at 120 bpm
    beat = 0.25
    for k, st in enumerate(np.arange(0.0, dur - 0.1, beat)):
        d = 0.08; acc = 1.0 if k % 4 == 0 else 0.55
        c = bp(noise(d), 1500, 7000) * np.exp(-45 * t_(d)) + np.sin(2 * np.pi * 330 * t_(d)) * np.exp(-60 * t_(d)) * 0.4
        s = int(st * SR); out[s:s + len(c)] += stereo(c * acc * 0.8)[:n - s]
    return norm(out) * 0.85
def s_party():
    d = 0.5; t = t_(d)
    f = 290 + 70 * np.minimum(1, t / 0.15)
    horn = lp(((2 * ((np.cumsum(f) / SR) % 1)) - 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)), 2500) * np.minimum(1, (d - t) / 0.05)
    pop = np.zeros(len(t)); p = s_pop()[:, 0]; pop[:len(p)] += p
    return stereo(norm(horn * 0.7 + pop))
def s_counter(dur=0.5):
    out = np.zeros(int(dur * SR))
    for i, st in enumerate(np.arange(0, dur - 0.02, 0.025)):
        f = 900 + i * 60; c = np.sin(2 * np.pi * f * t_(0.015)) * np.exp(-200 * t_(0.015))
        s = int(st * SR); out[s:s + len(c)] += c
    return stereo(norm(out) * 0.8)
def s_build(dur=1.3):
    out = np.zeros((int(dur * SR), 2))
    for i in range(6):
        st = 0.05 + i * 0.17; p = s_pop() * (0.8 + i * 0.05); th = s_thump() * 0.6
        s = int(st * SR); seg = p[:len(out) - s]; out[s:s + len(seg)] += seg
        seg = th[:len(out) - s]; out[s:s + len(seg)] += seg * 0.6
    return norm(out) * 0.9
def s_neon(dur=0.6):
    t = t_(dur)
    buzz = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.4 + np.sin(2 * np.pi * 240 * t) * 0.3
    flick = np.ones_like(t); flick[(t > 0.04) & (t < 0.08)] = 0; flick[(t > 0.14) & (t < 0.17)] = 0
    crack = bp(noise(dur), 3000, 9000) * (RNG.random(len(t)) > 0.995) * 3
    return fade(stereo(norm(lp(buzz, 3000) * flick + crack) * 0.7, 0.4), 0.003, 0.08)
def s_chime():
    d = 1.6; out = np.zeros(int(d * SR))
    for i, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        st = i * 0.07; dd = d - st; t = t_(dd)
        c = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-6 * t) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-10 * t)) * np.exp(-3.2 * t)
        s = int(st * SR); out[s:s + len(c)] += c
    return stereo(norm(out) * 0.8)
def s_twitch():
    out = np.zeros(int(0.5 * SR))
    for st in (0.0, 0.12, 0.2, 0.33):
        d = 0.03; c = np.sin(2 * np.pi * 3500 * t_(d)) * np.exp(-180 * t_(d)); s = int(st * SR); out[s:s + len(c)] += c
    return stereo(norm(out) * 0.6, 0.2)

def s_crickets(dur):
    """procedural cricket chorus + soft night air"""
    n = int(dur * SR); out = np.zeros((n, 2)); t = np.arange(n) / SR
    for c in range(6):
        f = RNG.uniform(3900, 5200); rate = RNG.uniform(26, 34); period = RNG.uniform(0.45, 0.9); pulses = RNG.integers(3, 6)
        amp = RNG.uniform(0.25, 1.0) * (0.35 if c > 2 else 1.0); pan = RNG.uniform(-0.9, 0.9); ph = RNG.uniform(0, period)
        tt = (t + ph) % period
        gate = (tt < pulses / rate) * (np.sin(np.pi * ((tt * rate) % 1)) ** 2)
        m = np.sin(2 * np.pi * f * t) * gate * amp
        out += stereo(m, pan)
    air = lp(noise(dur), 900) * 0.08
    out += stereo(air)
    return fade(norm(out) * 0.7, 0.3, 0.3)

SYNTH = {k[2:]: v for k, v in globals().items() if k.startswith('s_')}

# ------------------------------------------------------------------ generated SFX picks (ElevenLabs takes)
def trim(x, start=0.0, end=None, thresh=0.01):
    a = x[int(start * SR): int(end * SR) if end else None]
    m = np.max(np.abs(a), axis=1)
    idx = np.where(m > thresh)[0]
    if len(idx): a = a[max(0, idx[0] - 100): idx[-1] + 2000]
    return fade(a.copy(), 0.003, 0.03)

RAW = 'assets/sfx_raw/'
PICKS = {
    'wheee': lambda: trim(load(RAW + 'wheee_4.mp3')),
    'hey': lambda: trim(load(RAW + 'hey_1.mp3'), 0, 0.5),
    'yawn': lambda: trim(load(RAW + 'yawn_2.mp3')),
    'crowd': lambda: None,
    'trickle': lambda: None,
    'splash': lambda: trim(load(RAW + 'splash_4.mp3')),
    'splash2': lambda: trim(load(RAW + 'splash_1.mp3')),
    'wave': lambda: trim(load(RAW + 'wave_1.mp3')),
    'surf': lambda: trim(load(RAW + 'surf_2.mp3')),
    'scratch': lambda: trim(load(RAW + 'scratch_1.mp3')),
    'bell': lambda: trim(load(RAW + 'bell_1.mp3')),
    'door': lambda: trim(load(RAW + 'door_2.mp3')),
    'tv': lambda: trim(load(RAW + 'tv_1.mp3')),
    'whoosh': lambda: trim(load(RAW + 'whoosh_1.mp3')),
    'sting': lambda: trim(load(RAW + 'sting_1.mp3')),
    'clink': lambda: None,
}

def looped(x, dur, xf=0.25):
    n = int(dur * SR); xfn = int(xf * SR)
    out = np.zeros((n + len(x), 2)); pos = 0
    ramp = np.linspace(0, 1, xfn)[:, None]
    while pos < n:
        seg = x.copy()
        if pos > 0: seg[:xfn] *= ramp
        seg[-xfn:] *= ramp[::-1]
        out[pos:pos + len(seg)] += seg
        pos += len(seg) - xfn
    return out[:n]

_cache = {}
def get(name, opts):
    dur = opts.get('dur')
    if name.startswith('synth:'):
        k = name[6:]
        fn = SYNTH[k]
        import inspect
        return fn(dur) if dur and 'dur' in inspect.signature(fn).parameters else fn()
    if name == 'crickets':
        return s_crickets(dur) * 0.9 + looped(trim(load(RAW + 'crickets_2.mp3'), thresh=0.002), dur) * 0.5
    if name == 'trickle':
        return looped(trim(load(RAW + 'trickle_1.mp3'), thresh=0.004), dur, 0.4)
    if name == 'crowd':
        a = trim(load(RAW + 'crowd_2.mp3'), thresh=0.004); b = trim(load(RAW + 'crowd_4.mp3'), thresh=0.004)
        return looped(a, dur, 0.4) * 0.8 + looped(b, dur, 0.4) * 0.7
    if name == 'clink':
        if 'clink' not in _cache:
            c = load(RAW + 'clink_2.mp3'); m = np.max(np.abs(c), axis=1)
            on = np.where(m > 0.25)[0]
            s0 = on[0] if len(on) else 0
            _cache['clink'] = fade(c[max(0, s0 - 50): s0 + int(0.45 * SR)].copy(), 0.002, 0.08)
        return _cache['clink']
    if name not in _cache: _cache[name] = PICKS[name]()
    x = _cache[name]
    if dur: x = x[:int(dur * SR)]
    return x

# ------------------------------------------------------------------ mix
vo = load('assets/voiceover.mp3')
vo = np.pad(vo, ((0, max(0, N - len(vo))), (0, 0)))[:N]
sfx = np.zeros((N, 2))
for name, at, gain, *rest in TL['sfx']:
    opts = rest[0] if rest else {}
    x = get(name, opts)
    if x is None or len(x) == 0: continue
    x = np.asarray(x, dtype=np.float64)
    # normalise each element to a consistent peak, then apply cue gain
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.8 * db(gain)
    if opts.get('fade'): x = fade(x, opts['fade'], opts['fade'])
    s = int(round(at * SR))
    if s < 0: x = x[-s:]; s = 0
    e = min(N, s + len(x))
    sfx[s:e] += x[:e - s]

# sidechain ducking from the VO envelope (attack 10 ms, release 220 ms)
mono = np.abs(vo).mean(axis=1)
win = int(0.02 * SR)
rms = np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode='same'))
lvl = np.clip((20 * np.log10(rms + 1e-6) + 42) / 22, 0, 1)
a_att, a_rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.22 * SR))
g = np.zeros(N); s_ = 0.0
for i in range(N):
    x = lvl[i]
    s_ = (a_att if x > s_ else a_rel) * s_ + (1 - (a_att if x > s_ else a_rel)) * x
    g[i] = s_
duck = 1 - 0.5 * g  # up to ~-6 dB under speech
mix = vo * 1.0 + sfx * duck[:, None]
# gentle master limiter
peak = np.max(np.abs(mix))
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / (np.max(np.abs(mix)) + 1e-9)
import wave
pcm16 = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open('build/mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm16.tobytes())
print('wrote build/mix.wav', N / SR, 's; sfx cues:', len(TL['sfx']), 'pre-limit peak', round(float(peak), 3))
