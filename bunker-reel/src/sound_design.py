"""Procedural sound design for the reel: ambient suspense music bed and the
per-scene sound effects, all synthesized with numpy and placed on the same
event timeline the animation uses. Writes audio/music.wav and audio/sfx.wav
(48 kHz stereo float)."""
import sys, os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline import load_T

S = sys.argv[1]
SR = 48000
DUR = 60.0
N = int(SR * DUR)
T = load_T()
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def t_axis(d):
    return np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def brown(d):
    x = np.cumsum(rng.standard_normal(int(d * SR)))
    x = hp(x, 20)
    return x / (np.abs(x).max() + 1e-9)


def expdec(d, tau, attack=0.002):
    t = t_axis(d)
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 1:
        e[:a] *= np.linspace(0, 1, a)
    return e


def modal(freqs, decays, amps, d, detune=0.0):
    t = t_axis(d)
    out = np.zeros_like(t)
    for f, tau, a in zip(freqs, decays, amps):
        f = f * (1 + detune * rng.uniform(-1, 1))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    a = int(0.001 * SR)
    out[:a] *= np.linspace(0, 1, a)
    return out


def mixin(out, sig, i, g=1.0):
    n = min(len(sig), len(out) - i)
    if n > 0:
        out[i:i + n] += g * sig[:n]


def norm(x, peak=1.0):
    return x / (np.abs(x).max() + 1e-9) * peak


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N), np.float32)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i0 = int(round(t * SR))
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[-i0:]
            i0 = 0
        sig = sig[:N - i0]
        l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        self.x[0, i0:i0 + len(sig)] += gain * l * sig
        self.x[1, i0:i0 + len(sig)] += gain * r * sig

    def add_stereo(self, sig2, t, gain=1.0):
        i0 = int(round(t * SR))
        n = min(sig2.shape[1], N - i0)
        self.x[:, i0:i0 + n] += gain * sig2[:, :n]


def reverb_ir(decay, d, bright=6000, predelay=0.012):
    n = int(d * SR)
    ir = np.zeros((2, n))
    for ch in range(2):
        nz = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / decay)
        ir[ch] = lp(nz, bright)
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((2, pd)), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def apply_reverb(bus, ir, wet):
    out = bus.x.copy()
    for ch in range(2):
        out[ch] += wet * fftconvolve(bus.x[ch], ir[ch])[:N]
    return out


# ------------------------------------------------------------------ SFX designs
def tick(tock=False):
    d = 0.08
    f = 2500 if tock else 3300
    s = 0.6 * bp(noise(d), 1500, 7000) * expdec(d, 0.004, 0.0005)
    s += 0.5 * modal([f, f * 1.7], [0.012, 0.008], [1, 0.5], d)
    s += 0.35 * modal([900], [0.02], [1], d)
    return s


def rustle(d, rate=22, lo=900, hi=5500):
    x = bp(noise(d), lo, hi)
    g = np.repeat(rng.uniform(0.2, 1.0, int(d * rate) + 2), int(SR / rate))[:len(x)]
    g = lp(g, 30)
    env = np.minimum(1, t_axis(d) / 0.15) * np.minimum(1, (d - t_axis(d)) / 0.25)
    return x * g * env


def saw_cut(d):
    t = t_axis(d)
    spin = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.5)
    f0 = 165 + 35 * np.minimum(1, t / 0.35) + 3 * np.sin(2 * np.pi * 5 * t)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    whine = sum(np.sin(k * ph) / k ** 0.9 for k in range(1, 14))
    bite = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 9.5 * t + 0.8 * np.sin(2 * np.pi * 1.3 * t)))
    grit = bp(noise(d), 1800, 8000) * bite
    chips = bp(noise(d), 400, 1500) * bite
    return (0.35 * whine * spin + 0.9 * grit * spin + 0.4 * chips * spin)


def wood_clack(f=None):
    f = f or rng.uniform(320, 620)
    d = 0.25
    s = modal([f, f * 2.32, f * 3.87, f * 5.4], [0.05, 0.035, 0.02, 0.012], [1, 0.6, 0.35, 0.2], d, 0.04)
    s += 0.5 * bp(noise(d), 800, 5000) * expdec(d, 0.006, 0.0005)
    return s


def thud(f0=70, f1=40, d=0.9, tau=0.25, noise_amt=0.6, noise_lp=350):
    t = t_axis(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.08)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)
    s += noise_amt * lp(noise(d), noise_lp) * expdec(d, 0.05, 0.001)
    return s


def jackhammer(d, rate=21):
    out = np.zeros(int(d * SR) + SR)
    t = 0.0
    while t < d:
        hit = 0.8 * bp(noise(0.06), 250, 4500) * expdec(0.06, 0.008, 0.0005)
        hit += 0.6 * modal([1850, 3120, 4400], [0.018, 0.012, 0.008], [1, 0.6, 0.3], 0.06, 0.05)
        hit += 0.7 * thud(110, 60, 0.06, 0.02, 0.2)
        i = int(t * SR)
        g = min(1, t / 0.12) * min(1, (d - t) / 0.2) * rng.uniform(0.75, 1.0)
        mixin(out, hit, i, g)
        t += 1 / rate * rng.uniform(0.92, 1.08)
    rumble = lp(noise(len(out) / SR), 180) * 0.35
    env = np.zeros(len(out))
    env[:int(d * SR)] = 1
    env = lp(env, 8)
    return out + rumble * env


def crack(big=False):
    d = 0.9 if big else 0.5
    s = 0.9 * hp(noise(d), 1200) * expdec(d, 0.004, 0.0002)
    t = 0.0
    while t < d * 0.7:
        i = int(t * SR)
        g = np.exp(-t / (0.2 if big else 0.1))
        mixin(s, bp(noise(0.005), 900, 7000), i, g * rng.uniform(0.2, 0.8))
        t += rng.exponential(0.012)
    s += (0.9 if big else 0.4) * thud(90, 45, d, 0.18, 0.8, 500)
    return s


def rubble(n=6, d=0.6):
    out = np.zeros(int(d * SR) + int(0.2 * SR))
    for _ in range(n):
        c = wood_clack(rng.uniform(700, 1400)) * 0.5 + 0.4 * bp(noise(0.25), 300, 3000) * expdec(0.25, 0.02)
        i = int(rng.uniform(0, d) * SR)
        mixin(out, c, i, rng.uniform(0.3, 1.0))
    return out


def shovel():
    d = 0.6
    scrape = bp(noise(0.25), 700, 4000) * np.sin(np.linspace(0, np.pi, int(0.25 * SR))) ** 2
    s = np.zeros(int(d * SR))
    s[:len(scrape)] += 0.7 * scrape
    s += 0.6 * thud(120, 70, d, 0.05, 0.6, 900)
    # dirt landing: grainy burst
    g = np.zeros(int(d * SR))
    for _ in range(140):
        i = int(rng.uniform(0.18, 0.55) * SR)
        mixin(g, rng.uniform(-1, 1, 60), i, rng.uniform(0.2, 1))
    s += 0.5 * lp(g, 3500)
    return s


def dirt_stream(d):
    g = np.zeros(int(d * SR))
    dens = int(d * 600)
    for _ in range(dens):
        i = int(rng.uniform(0, d) * SR)
        mixin(g, rng.uniform(-1, 1, 40), i, rng.uniform(0.1, 1))
    env = np.minimum(1, t_axis(d) / 0.3) * np.minimum(1, (d - t_axis(d)) / 0.4)
    return (lp(g, 2500) * 0.6 + 0.3 * lp(noise(d), 300)) * env


def metal_clank(low=False):
    if low:
        fr = [142, 331, 607, 977, 1490, 2140]
        dc = [1.6, 1.2, 0.9, 0.6, 0.4, 0.25]
    else:
        fr = [523, 1307, 2245, 3561, 4980]
        dc = [1.1, 0.75, 0.5, 0.32, 0.2]
    am = [1, 0.7, 0.55, 0.4, 0.3, 0.2]
    d = 2.5
    s = modal(fr, dc, am, d, 0.01)
    s += 0.8 * hp(noise(d), 1500) * expdec(d, 0.004, 0.0003)
    if low:
        s += 1.4 * thud(80, 38, d, 0.35, 0.9, 400)
    return s


def clink():
    k = rng.uniform(0.85, 1.25)
    d = 0.5
    return modal([2150 * k, 3430 * k, 5210 * k, 6900 * k], [0.22, 0.14, 0.09, 0.05], [1, 0.7, 0.45, 0.25], d, 0.02) \
        + 0.4 * hp(noise(d), 3000) * expdec(d, 0.002, 0.0002)


def pour(d):
    t = t_axis(d)
    body = lp(brown(d), 700) * (0.6 + 0.4 * lp(np.repeat(rng.uniform(0, 1, int(d * 6) + 2), SR // 6)[:len(t)], 4))
    slosh = bp(noise(d), 300, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.1 * t + 2 * np.sin(2 * np.pi * 0.7 * t))) ** 2
    out = 0.9 * body + 0.5 * slosh
    for _ in range(int(d * 14)):
        f = rng.uniform(140, 420)
        b = 0.4 * np.sin(2 * np.pi * np.cumsum(np.linspace(f, f * 1.8, int(0.05 * SR))) / SR) * expdec(0.05, 0.015)
        i = int(rng.uniform(0, d - 0.06) * SR)
        mixin(out, b, i)
    env = np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.5)
    return out * env


def whoosh(d, f0=400, f1=2500):
    x = noise(d)
    out = np.zeros_like(x)
    nb = 24
    seg = len(x) // nb
    for b in range(nb):
        f = f0 + (f1 - f0) * b / nb
        y = bp(x[b * seg:(b + 1) * seg + 2048], f * 0.6, f * 1.6)
        out[b * seg:b * seg + len(y)][:len(y)] += y[:len(out) - b * seg] * np.hanning(len(y))[:len(out) - b * seg]
    env = np.sin(np.linspace(0, np.pi, len(x))) ** 1.5
    return out * env


def switch_click():
    d = 0.12
    return 0.9 * hp(noise(d), 2000) * expdec(d, 0.0015, 0.0001) + 0.5 * modal([3900, 5600], [0.01, 0.006], [1, 0.5], d)


def hum(d):
    t = t_axis(d)
    s = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((100, 1), (200, 0.5), (300, 0.25), (120, 0.4)))
    s += 0.2 * bp(noise(d), 2000, 6000)
    return s * np.minimum(1, t / 0.4)


def pop(p=1.0):
    d = 0.14
    t = t_axis(d)
    f = (260 + 700 * np.exp(-t / 0.012)) * p
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(d, 0.035, 0.0015)
    s += 0.25 * hp(noise(d), 3000) * expdec(d, 0.002, 0.0002)
    return s


def creak(d):
    t = 0.0
    out = np.zeros(int(d * SR) + 4000)
    while t < d:
        rate = 70 + 120 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t))
        i = int(t * SR)
        out[i] += rng.uniform(0.5, 1.0)
        t += 1 / rate
    s = bp(out, 700, 1100) * 3 + bp(out, 1500, 2100) * 1.5
    return s[:int(d * SR)] * np.sin(np.linspace(0, np.pi, int(d * SR)))


def slide(d, lo=350, hi=2200):
    t = t_axis(d)
    x = bp(noise(d), lo, hi) * (0.7 + 0.3 * lp(rng.uniform(-1, 1, len(t)), 40) * 4)
    return x * np.sin(np.linspace(0, np.pi, len(t))) ** 0.8


# ------------------------------------------------------------------ SFX placement
sfx = Bus()
# scene 1 — soft room tone + ticking clock (the clock keeps ticking quietly)
room = lp(noise(DUR), 380) * 0.05 + lp(brown(DUR), 120) * 0.04
sfx.add(room, 0, 1.0)
for k in range(60):
    t = 0.15 + k * 1.0
    g = 0.30 if t < 6.2 else (0.07 if t < 52 else 0.16 * max(0, 1 - (t - 56) / 4))
    sfx.add(tick(k % 2 == 1), t, g, pan=0.35)
# scene 2 — rug rolls up, saw along the glowing outline, boards clatter off
sfx.add(rustle(T['rug_off_end'] - T['rug_off'] + 0.4), T['rug_off'], 0.22, -0.2)
sfx.add(thud(90, 60, 0.4, 0.08, 0.5, 600), T['rug_off_end'] + 0.45, 0.25, -0.4)
sd = T['planks'] - T['outline'] + 0.1
sfx.add(saw_cut(sd), T['outline'] - 0.05, 0.30)
NPL = 20
for k in range(NPL):
    t = T['planks'] + k * (T['planks_end'] - T['planks'] - 0.8) / NPL
    sfx.add(wood_clack(), t + 0.02, rng.uniform(0.35, 0.6), rng.uniform(-0.5, 0.5))
    if k % 3 == 0:
        sfx.add(wood_clack(rng.uniform(250, 380)), t + 0.25 + rng.uniform(0, 0.15), 0.3, rng.uniform(-0.6, 0.6))
for k in range(2):
    sfx.add(thud(150, 90, 0.5, 0.07, 0.8, 1200), T['ply'] + k * 0.25, 0.45, (-0.4, 0.4)[k])
    sfx.add(wood_clack(220), T['ply'] + k * 0.25 + 0.01, 0.4, (-0.4, 0.4)[k])
# scene 3 — jackhammer, cracking, chunks lifting away
sfx.add(jackhammer(T['crack_end'] - T['crack'] + 0.2), T['crack'], 0.42)
for t, big in ((T['crack'] + 0.5, False), (T['crack'] + 1.05, False), (T['crack'] + 1.6, True), (T['chunks'] - 0.15, True)):
    sfx.add(crack(big), t, 0.5 if big else 0.4, rng.uniform(-0.3, 0.3))
for k in range(30):
    t = T['chunks'] + k * (T['chunks_end'] - T['chunks'] - 0.9) / 30
    if k % 2 == 0:
        sfx.add(thud(120, 70, 0.3, 0.05, 0.9, 1500), t, 0.22, rng.uniform(-0.6, 0.6))
    if k % 5 == 0:
        sfx.add(rubble(4, 0.4), t + 0.05, 0.18, rng.uniform(-0.6, 0.6))
for k in range(3):
    sfx.add(pop(0.7), T['arrows'] + k * 4 / 30, 0.12, (-0.5, 0, 0.5)[k])
# scene 4 — digging, dirt falling, clank on the pipe, pipe rerouted
for a, b in ((T['gravel'], T['clank']), (T['dig2'], T['dig_end'])):
    t = a + 0.05
    while t < b - 0.2:
        sfx.add(shovel(), t, rng.uniform(0.35, 0.5), rng.uniform(-0.4, 0.4))
        t += rng.uniform(0.38, 0.55)
    sfx.add(dirt_stream(b - a), a, 0.22)
sfx.add(metal_clank(), T['clank'], 0.55, 0.1)
sfx.add(slide(T['reroute_end'] - T['reroute'], 1500, 4500), T['reroute'], 0.06, 0.0)
sfx.add(creak(T['reroute_end'] - T['reroute']), T['reroute'], 0.05)
sfx.add(metal_clank(), T['reroute_end'] - 0.05, 0.12, -0.2)
# scene 5 — rebar clinking, concrete pouring, heavy thud, vent pipe
rb_n = 73
for k in range(rb_n):
    t = T['rebar'] + k * (T['rebar_end'] - T['rebar'] - 8 / 30) / rb_n
    if k % 2 == 0 or rng.random() < 0.3:
        sfx.add(clink(), t + 0.05, rng.uniform(0.12, 0.3), rng.uniform(-0.7, 0.7))
pd = T['thud'] - T['pour_floor'] + 0.3
sfx.add(pour(pd), T['pour_floor'], 0.5)
sfx.add(metal_clank(True), T['thud'], 0.75)
sfx.add(rubble(5, 0.5), T['thud'] + 0.1, 0.25)
sfx.add(whoosh(T['vent_end'] - T['vent'], 300, 1800), T['vent'], 0.12, 0.4)
sfx.add(slide(T['vent_end'] - T['vent'], 2000, 6000), T['vent'], 0.04, 0.4)
sfx.add(pop(0.9), T['vent_end'] - 0.1, 0.22, 0.6)
sfx.add(pop(1.1), T['vent'], 0.12, 0.3)
# scene 6 — LEDs click on (with flicker), everything pops into place
for k in range(2):
    sfx.add(pop(1.0 + 0.15 * k), T['lights'] - 0.35 + k * 0.1, 0.18, (-0.3, 0.3)[k])
for df in (0, 3, 5, 7, 9):
    sfx.add(switch_click(), T['lights'] + df / 30, 0.35 if df == 0 else 0.15)
sfx.add(hum(DUR - T['lights']) * np.exp(-np.maximum(0, t_axis(DUR - T['lights']) - 2) / 4) * 0.5 + 0.5 * hum(DUR - T['lights']) * 0.3,
        T['lights'], 0.02)
events = [(T['beds'], 0.8, 0.45), (T['beds'] + 0.35, 0.95, 0.35), (T['lights2'], 1.15, 0.3),
          (T['table'], 0.9, 0.35), (T['table'] + 0.2, 1.1, 0.28), (T['radio'], 1.25, 0.3),
          (T['firstaid'], 1.05, 0.32), (T['hatch_appear'] - 0.25, 0.85, 0.3), (T['hatch_appear'], 0.75, 0.4)]
for k in range(30):
    if k % 2 == 0:
        events.append((T['food'] + k * 0.9 / 30, rng.uniform(1.1, 1.5), 0.22))
for k in range(13):
    events.append((T['water'] + k * 0.75 / 13, rng.uniform(0.95, 1.3), 0.2))
for t, p, g in events:
    sfx.add(pop(p), t, g, rng.uniform(-0.5, 0.5))
sfx.add(switch_click(), T['lights2'] + 0.1, 0.18)
sfx.add(slide(0.5, 1200, 5000), T['ladder'], 0.12)
sfx.add(clink(), T['ladder'] + 0.47, 0.3)
# scene 7 — hatch swings shut and slams, boards slide back, rug thump
sfx.add(creak(T['hatch_slam'] - T['hatch_close']), T['hatch_close'], 0.14, 0.3)
sfx.add(metal_clank(True), T['hatch_slam'], 0.9, 0.2)
for k in range(2):
    sfx.add(slide(0.55, 250, 1800), T['floor_back'] + k * 0.2, 0.3, (-0.5, 0.5)[k])
    sfx.add(thud(140, 90, 0.4, 0.06, 0.8, 1000), T['floor_back'] + k * 0.2 + 0.55, 0.3)
pl0 = T['floor_back'] + 0.75
for k in range(NPL):
    t = pl0 + k * (T['floor_back_end'] - pl0 - 0.55) / NPL
    sfx.add(slide(0.5, 400, 2600), t, 0.14, -0.5 + k / NPL)
    sfx.add(wood_clack(rng.uniform(380, 520)), t + 0.5, 0.25, -0.5 + k / NPL)
sfx.add(rustle(T['rug_back_end'] - T['rug_back'], 18, 700, 4500), T['rug_back'], 0.2, -0.1)
sfx.add(thud(80, 50, 0.6, 0.12, 0.7, 380), T['rug_back_end'], 0.5)

ir_small = reverb_ir(0.45, 1.6, 5000)
sfx_out = apply_reverb(sfx, ir_small, 0.18)

# ------------------------------------------------------------------ music bed
def osc_saw(freq, d, detune_c=7, voices=3):
    t = t_axis(d)
    out = np.zeros_like(t)
    for v in range(voices):
        f = freq * 2 ** ((v - (voices - 1) / 2) * detune_c / 1200)
        ph = rng.uniform(0, 6.28)
        for h in range(1, 16):
            if f * h > 5000:
                break
            out += np.sin(2 * np.pi * f * h * t + ph * h) / h
    return out / voices


def chord_track(chords, d_each, total):
    out = np.zeros(int(total * SR))
    xf = int(1.5 * SR)
    for i, notes in enumerate(chords):
        seg_d = d_each + 1.5
        s = sum(osc_saw(f, seg_d) for f in notes) / len(notes)
        env = np.ones(len(s))
        env[:xf] = np.linspace(0, 1, xf)
        env[-xf:] = np.linspace(1, 0, xf)
        i0 = int(i * d_each * SR)
        n = min(len(s), len(out) - i0)
        if n <= 0:
            break
        out[i0:i0 + n] += (s * env)[:n]
    return out


def varlp(x, cut):
    """block-wise time-varying lowpass"""
    out = np.zeros_like(x)
    blk = 4096
    zi = None
    for i in range(0, len(x), blk):
        c = float(np.clip(cut[min(i, len(cut) - 1)], 60, 12000))
        sos = butter(2, c, 'lowpass', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + blk], zi = sosfilt(sos, x[i:i + blk], zi=zi)
    return out


hz = lambda n: 440 * 2 ** ((n - 69) / 12)
D2, F2, A2, Bb1, G2, C3, D3, E3, F3, A3, Bb2, G3, Cs3 = [hz(n) for n in (38, 41, 45, 34, 43, 48, 50, 52, 53, 57, 46, 55, 49)]
prog = [(D2, A2, F3), (Bb1, F2, D3), (G2, D3, Bb2 * 2), (A2, E3, Cs3 * 2)] * 3 + [(D2, A2, F3)]
pad = chord_track(prog, 5.0, DUR)
tt = t_axis(DUR)
cut = 300 + 250 * (0.5 + 0.5 * np.sin(2 * np.pi * tt / 9.0))
sw = np.clip((tt - 51.5) / 5.0, 0, 1)
cut = cut + 2200 * sw ** 2
pad = varlp(pad, cut)
# swell: open the top octave, then fade out
top = chord_track([(hz(62), hz(65), hz(69))] * 3, 4.0, 12.0)
top_full = np.zeros(N)
top_full[int(50 * SR):int(50 * SR) + len(top)] = top[:N - int(50 * SR)]
top_full = varlp(top_full, 600 + 3000 * sw)
sub = np.sin(2 * np.pi * hz(26) * tt) * 0.5 * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 7))
beat = np.zeros(N)
for k in np.arange(13.0, 50.0, 1.6):
    b = thud(55, 38, 0.7, 0.18, 0.0)
    i = int(k * SR)
    mixin(beat, b, i, 0.5 if k < 28 else 0.7 if k < 36 else 0.35)
air = bp(noise(DUR), 3000, 9000) * 0.03 * (0.5 + 0.5 * np.sin(2 * np.pi * tt / 13))
pings = np.zeros(N)
for k, t0 in enumerate((0.2, 6.0, 13.0, 20.0, 28.0, 36.0, 44.0)):
    p = modal([hz(74 + (0, 3, 7, 5, 0, 3, 7)[k]), hz(86)], [2.5, 1.2], [1, 0.25], 4.0)
    i = int(t0 * SR)
    mixin(pings, p, i)
gain = np.clip(tt / 2.0, 0, 1) * (1 + 1.2 * sw) * np.clip((DUR - tt) / 3.2, 0, 1)
mus_m = (0.55 * pad + 0.35 * top_full + 0.22 * sub + 0.6 * beat) * gain + air + 0.10 * pings * np.clip((DUR - tt) / 3, 0, 1)
music = Bus()
music.x[0] = mus_m
music.x[1] = np.roll(mus_m, int(0.011 * SR))
ir_big = reverb_ir(2.6, 4.0, 4000, 0.03)
music_out = apply_reverb(music, ir_big, 0.45)

os.makedirs(f'{S}/audio', exist_ok=True)
sf.write(f'{S}/audio/sfx.wav', (norm(sfx_out, 0.9)).T.astype(np.float32), SR)
sf.write(f'{S}/audio/music.wav', (norm(music_out, 0.9)).T.astype(np.float32), SR)
print('wrote sfx/music')
