#!/usr/bin/env python3
"""Synthesises music + all sound effects in numpy and mixes them under the voiceover."""
import json, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
HERE = __file__.rsplit('/', 1)[0]
TL = json.load(open(HERE + '/build/timeline.json')); S, E, D = TL['S'], TL['E'], TL['duration']
N = int(D * SR)
rng = np.random.default_rng(7)
TAU = 2 * np.pi

def filt(x, kind, f): return sosfilt(butter(2, f, kind, fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def tt(d): return np.arange(int(d * SR)) / SR
def fade(x, a=0.005, r=0.02):
    n = len(x); e = np.ones(n); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return x * e
def sweep(f0, f1, d, curve=1.0):
    t = tt(d); f = f0 * (f1 / f0) ** ((t / d) ** curve); return np.sin(TAU * np.cumsum(f) / SR), t

class Bus:
    def __init__(self): self.b = np.zeros((2, N))
    def add(self, x, t, g=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N or i + len(x) <= 0: return
        if i < 0: x = x[-i:]; i = 0
        x = x[: N - i]; a = (pan + 1) * np.pi / 4
        self.b[0, i:i + len(x)] += x * g * np.cos(a) * 1.414; self.b[1, i:i + len(x)] += x * g * np.sin(a) * 1.414

# ---------------- sound effects ----------------
def s_pop(f0=380, f1=980, d=0.1): x, t = sweep(f0, f1, d); return fade(x * np.exp(-t / (d * 0.5)), 0.002, 0.01)
def s_plop(f0=520, f1=170, d=0.13): x, t = sweep(f0, f1, d); return fade(x * np.exp(-t / (d * 0.45)) + 0.25 * filt(nz(len(t)), 'low', 900) * np.exp(-t / 0.02), 0.002, 0.01)
def s_thud(f=62, d=0.32, click=0.5):
    x, t = sweep(f * 2.1, f, d, 0.4); return fade(x * np.exp(-t / (d * 0.33)) + click * filt(nz(len(t)), 'low', 500) * np.exp(-t / 0.03), 0.002, 0.03)
def s_crunch(d=0.26):
    n = int(d * SR); g = np.repeat(rng.random(n // 220 + 1) ** 2, 220)[:n]
    x = filt(filt(nz(n), 'high', 450), 'low', 3800) * g; t = tt(d)[:n]; return fade(x * np.exp(-t / (d * 0.55)), 0.004, 0.03)
def s_clack(f=2100): t = tt(0.07); return fade((np.sin(TAU * f * t) + 0.6 * np.sin(TAU * f * 1.53 * t)) * np.exp(-t / 0.012) + 0.5 * filt(nz(len(t)), 'high', 3000) * np.exp(-t / 0.004), 0.001, 0.01)
def s_ding(f=1320, d=0.7): t = tt(d); return fade((np.sin(TAU * f * t) + 0.5 * np.sin(TAU * f * 2.76 * t) * np.exp(-t / 0.12) + 0.25 * np.sin(TAU * f * 5.4 * t) * np.exp(-t / 0.05)) * np.exp(-t / (d * 0.3)), 0.002, 0.05)
def s_whoosh(d=0.35, lo=500, hi=4000):
    n = int(d * SR); x = nz(n); a = filt(x, 'low', lo * 2); b = filt(filt(x, 'high', lo * 2), 'low', hi); k = np.linspace(0, 1, n)
    return (a * (1 - k) + b * k) * np.hanning(n)
def s_hiss(d): n = int(d * SR); return filt(nz(n), 'high', 4500)
def s_rumble(d):
    n = int(d * SR); t = np.arange(n) / SR; am = 0.6 + 0.4 * np.interp(t, np.linspace(0, d, int(d * 9) + 2), rng.random(int(d * 9) + 2))
    return (filt(nz(n), 'low', 95) * 2.2 + 0.5 * np.sin(TAU * 37 * t) + 0.35 * np.sin(TAU * 51 * t + 1)) * am
def s_hum(d, f=58):
    t = tt(d); x = sum(np.sin(TAU * f * k * t + k) / k for k in (1, 2, 3, 4, 6)); return x * (0.75 + 0.25 * np.sin(TAU * 11 * t))
def s_engine(d): t = tt(d); x = np.sign(np.sin(TAU * 46 * t)) * 0.5 + np.sin(TAU * 92 * t) * 0.4; return filt(x, 'low', 420) * (0.6 + 0.4 * np.clip(np.sin(TAU * 13 * t), 0, 1))
def s_scrape(d): n = int(d * SR); t = np.arange(n) / SR; return filt(filt(nz(n), 'high', 1400), 'low', 5200) * (0.6 + 0.4 * np.sin(TAU * 23 * t)) + 0.12 * np.sin(TAU * 2350 * t)
def s_boom():
    d = 3.6; x, t = sweep(105, 30, d, 0.35); sub = x * np.exp(-t / 0.9)
    crack = filt(nz(len(t)), 'low', 1400) * np.exp(-t / 0.09) * 1.2 + filt(nz(len(t)), 'low', 240) * np.exp(-t / 0.8) * 1.6
    return fade(sub * 1.4 + crack, 0.001, 0.4)
def s_splat(big=False):
    d = 0.42 if big else 0.2; n = int(d * SR); t = np.arange(n) / SR; x = nz(n); k = np.minimum(1, t / (d * 0.35))
    body = filt(x, 'low', 3200) * (1 - k) + filt(x, 'low', 520) * k
    sq = filt(x, 'low', 1100) * (0.5 + 0.5 * np.sin(TAU * (34 if big else 48) * t)) * np.exp(-t / (d * 0.5))
    low = np.sin(TAU * (70 if big else 110) * t) * np.exp(-t / 0.06) * (1.5 if big else 0.6)
    return fade(body * np.exp(-t / (d * 0.3)) + 0.7 * sq + low, 0.001, 0.03)
def s_yelp():
    d = 0.16; t = tt(d); f = 850 + 900 * np.sin(np.pi * t / d) ** 0.7; ph = TAU * np.cumsum(f) / SR
    x = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph) + 0.15 * np.sin(4 * ph); return fade(x * np.sin(np.pi * t / d) ** 0.5, 0.004, 0.02)
def s_click(): t = tt(0.05); return (np.sin(TAU * 2600 * t) * np.exp(-t / 0.006) + 0.6 * np.sin(TAU * 1200 * t) * np.exp(-t / 0.012) + 0.4 * nz(len(t)) * np.exp(-t / 0.002))
def s_bwoop(): x, t = sweep(140, 620, 0.35, 1.6); return fade(x * 0.8 + 0.3 * np.sign(x), 0.005, 0.05) * np.hanning(len(t)) ** 0.5

fx = Bus()
pans = lambda x: float(np.clip(x / 12.0, -0.8, 0.8))
# scene 1: dog + poops
for i, t in enumerate(E['poop_pops']): fx.add(s_plop(560 - i * 30, 190), t, 0.42, [-0.2, -0.5, -0.3, -0.6][i]); fx.add(s_pop(300 + i * 60, 760 + i * 90, 0.08), t + 0.05, 0.22, -0.3)
for k in range(6): fx.add(s_clack(900 + 80 * (k % 2)) * 0.4, 0.15 + k * 0.13, 0.1, 0.4 - k * 0.15)   # paws
# rings
for t in (E['ring1'], E['ring2'], E['tunnel_ring']): fx.add(s_ding(1175), t, 0.16, -0.2); fx.add(s_ding(1760, 0.5), t + 0.07, 0.1, -0.2); fx.add(s_whoosh(0.3, 800, 6000), t - 0.05, 0.08)
# scene cuts
for i in range(2, 17): fx.add(s_whoosh(0.26, 400, 3000), S[i] - 0.1, 0.06)
# excavator + digging
fx.add(fade(s_engine(S[5] - S[3]), 0.5, 0.4), S[3], 0.075, -0.4)
for t in E['scoops']:
    fx.add(s_crunch(0.3), t - 0.05, 0.3, -0.3); fx.add(s_thud(70, 0.22, 0.8), t + 0.02, 0.2, -0.3)
    for k in range(3): fx.add(s_thud(95 + rng.random() * 50, 0.14, 0.6), t + 0.55 + rng.random() * 0.4, 0.11, rng.uniform(-0.8, 0.1))
fx.add(s_whoosh(0.5, 200, 1500), E['deeper'] - 0.05, 0.16, -0.3); fx.add(s_thud(48, 0.5, 0.4), E['deeper'] + 0.35, 0.3, -0.3)
for i, t in enumerate(E['cone_stages']): fx.add(s_thud(58 - i * 3, 0.36, 0.9), t, 0.34, -0.3); fx.add(s_crunch(0.3), t - 0.04, 0.2, -0.3); fx.add(s_pop(240 + i * 50, 600 + i * 80), t, 0.13, -0.3)
for t in E['pats']: fx.add(s_thud(84, 0.2, 1.0), t, 0.3, -0.35); fx.add(s_clack(700), t, 0.07, -0.35)
# tunnel
tun = s_crunch(E['tunnel_end'] - E['tunnel_start'] + 0.2); n = len(tun); g = np.repeat(rng.random(n // 2600 + 1), 2600)[:n]
fx.add(fade(filt(nz(n), 'low', 2600) * (0.35 + 0.65 * g) * 0.5 + filt(nz(n), 'low', 160) * 1.2, 0.05, 0.15), E['tunnel_start'], 0.2, 0.0)
fx.add(s_thud(60, 0.3, 0.8), E['tunnel_end'], 0.26, 0.4); fx.add(s_ding(1480, 0.5), E['tank_arrow'], 0.14, 0.5)
# pipe
fx.add(fade(s_scrape(E['pipe_end'] - E['pipe_start']), 0.08, 0.05), E['pipe_start'], 0.085, 0.1)
fx.add(s_thud(90, 0.25, 1.0), E['pipe_end'], 0.3, -0.2); fx.add(s_clack(620) + 0, E['pipe_end'], 0.25, -0.2); fx.add(s_ding(830, 0.5), E['pipe_end'], 0.1, -0.2)
# stones
for k, t in enumerate(E['stone_rings']):
    for j in range(3): fx.add(s_clack(1500 + rng.random() * 1400 + k * 30), t + j * 0.04 + rng.random() * 0.02, 0.2, rng.uniform(-0.6, 0.0))
# pump
fx.add(s_whoosh(0.32, 300, 2500), E['pump_land'] - 0.33, 0.14, 0.2); fx.add(s_thud(55, 0.4, 1.0), E['pump_land'], 0.42, 0.2); fx.add(s_clack(520), E['pump_land'], 0.2, 0.2)
fx.add(fade(s_hum(S[9] - E['pump_land'] - 0.1), 0.15, 0.25), E['pump_land'] + 0.08, 0.07, 0.2)
fx.add(s_pop(160, 520, 0.16), E['pump_big'], 0.3, 0.2); fx.add(s_thud(50, 0.3, 0.5), E['pump_big'] + 0.05, 0.25, 0.2)
# wheelbarrow dumps + fuel
for d in (E['dump1'], E['dump2']):
    fx.add(s_clack(480), d - 0.05, 0.14, -0.4)
    for k in range(6): fx.add(s_plop(480 + rng.random() * 160, 170), d + 0.12 + k * 0.045, 0.2, -0.4)
for i, t in enumerate(E['poop_drops']): fx.add(s_plop(430 + (i % 5) * 45, 150, 0.12), t, 0.26, rng.uniform(-0.5, -0.1)); fx.add(s_splat() * 0.5, t, 0.1, -0.3); fx.add(s_pop(300, 520, 0.05), t + 0.16, 0.07, -0.3)
fx.add(s_ding(1480, 0.5), E['fuel_arrow'], 0.14, -0.3)
# garden pops
for i, t in enumerate(E['palms']): fx.add(s_pop(260 + i * 70, 820 + i * 120, 0.14), t, 0.26, -0.4); fx.add(s_whoosh(0.3, 600, 5000), t, 0.07, -0.4)
for i, t in enumerate(E['rocks']): fx.add(s_clack(900 + i * 110), t, 0.2, -0.4); fx.add(s_pop(300, 640, 0.06), t, 0.12, -0.4)
for i, t in enumerate(E['bushes']): fx.add(s_pop(420 + i * 45, 980 + i * 70, 0.07), t, 0.17, -0.4)
# party
for i, t in enumerate(E['party_items']): fx.add(s_pop(300 + i * 90, 760 + i * 130, 0.1), t, 0.24, 0.5)
for i, t in enumerate(E['people']): fx.add(s_pop(520 + i * 60, 1100 + i * 90, 0.07), t + 0.05, 0.16, 0.5)
n = int((E['boom'] - S[11]) * SR); crowd = filt(filt(nz(n), 'high', 300), 'low', 1700) * (0.5 + 0.5 * np.interp(np.arange(n) / SR, np.linspace(0, n / SR, n // 3000 + 2), rng.random(n // 3000 + 2)))
fx.add(fade(crowd, 0.4, 0.05), S[11], 0.022, 0.6)
# button
fx.add(s_click(), E['button_press'], 0.5, -0.5); fx.add(s_thud(120, 0.12, 1.0), E['button_press'], 0.3, -0.5); fx.add(s_bwoop(), E['button_press'] + 0.08, 0.16, -0.3)
# rumble / steam / pump strain
d = E['boom'] - E['shake_start']; r = s_rumble(d) * np.linspace(0.25, 1.0, int(d * SR)) ** 1.3; fx.add(fade(r, 0.3, 0.02), E['shake_start'], 0.3, -0.2)
d = E['boom'] - E['steam_start']; h = s_hiss(d) * np.linspace(0.3, 1.0, int(d * SR)) ** 1.5; fx.add(fade(h, 0.25, 0.03), E['steam_start'], 0.075, -0.3)
d = E['boom'] - E['dial_cut']; t = tt(d); f = 58 * (1 + 0.9 * (t / d) ** 2); ph = TAU * np.cumsum(f) / SR
fx.add(fade((np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.33 * np.sin(3 * ph) + 0.2 * np.sin(5 * ph)) * (0.7 + 0.3 * np.sin(TAU * 13 * t)), 0.1, 0.02), E['dial_cut'], 0.11, 0.1)
for k in range(int(d / 0.16)): fx.add(s_clack(3000) * 0.6, E['dial_cut'] + k * 0.16 * (1 - 0.3 * k * 0.16 / d), 0.07, 0.1)
# eruption
fx.add(s_boom(), E['boom'], 0.62, -0.15)
d = E['cut14b'] - E['boom'] + 1.2; n = int(d * SR); roar = filt(nz(n), 'low', 900) * np.exp(-np.arange(n) / SR / 1.3) + 0.4 * filt(nz(n), 'high', 2000) * np.exp(-np.arange(n) / SR / 0.5)
fx.add(fade(roar, 0.01, 0.4), E['boom'], 0.2, -0.2)
fx.add(s_whoosh(1.0, 300, 3500)[::-1].copy(), E['cut14b'] - 0.2, 0.12, 0.2)
for t in E['splats']: fx.add(s_splat(), t, rng.uniform(0.2, 0.34), rng.uniform(0.1, 0.8))
fx.add(s_splat(True), E['grill_hit'], 0.6, 0.45); fx.add(s_clack(420), E['grill_hit'], 0.25, 0.45); fx.add(s_splat(True), E['table_hit'], 0.5, 0.6)
for k in range(5): fx.add(s_splat(), E['table_hit'] + 0.25 + k * 0.17, 0.22, rng.uniform(0.2, 0.8))
# dog
fx.add(s_pop(500, 900, 0.06), E['dog_peek'] + 0.05, 0.14, 0.0)
fx.add(s_yelp(), E['dog_run'], 0.4, 0.1); fx.add(s_yelp() * 0.9, E['dog_run'] + 0.2, 0.34, 0.25); fx.add(s_yelp()[::1] * 0.7, E['dog_run'] + 0.42, 0.24, 0.45)
for k in range(8): fx.add(s_clack(800) * 0.4, E['dog_run'] + 0.15 + k * 0.07, 0.09, 0.1 + k * 0.08)
# follow
fx.add(s_pop(520, 1250, 0.1), E['follow_pop'], 0.26); fx.add(s_click(), E['follow_tap'], 0.45); fx.add(s_ding(1568, 0.6), E['follow_tap'] + 0.03, 0.2); fx.add(s_ding(2093, 0.6), E['follow_tap'] + 0.13, 0.16)

# ---------------- music ----------------
BPM = 116; beat = 60 / BPM; bar = beat * 4
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def marimba(f, d=0.5): t = tt(d); return fade((np.sin(TAU * f * t) * np.exp(-t / 0.16) + 0.35 * np.sin(TAU * f * 4 * t) * np.exp(-t / 0.035) + 0.12 * np.sin(TAU * f * 9.2 * t) * np.exp(-t / 0.012)), 0.002, 0.03)
def uke(f, d=0.6): t = tt(d); return fade(sum(np.sin(TAU * f * k * t + k * 0.7) / k ** 1.3 * np.exp(-t * (3.2 + k * 2.2)) for k in range(1, 7)), 0.002, 0.03)
def bass(f, d=0.42): t = tt(d); return fade((np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 2 * f * t)) * np.exp(-t / 0.2), 0.004, 0.04)
def shaker(g=1.0): t = tt(0.06); return filt(nz(len(t)), 'high', 6000) * np.exp(-t / 0.014) * g
CH = [(48, [60, 64, 67, 72]), (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69]), (43, [59, 62, 67, 71])]
PAT = [[0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 3, 1, 0], [3, 2, 1, 2, 0, 2, 3, 1], [0, 2, 3, 2, 1, 3, 2, 3]]
mu = Bus(); nb = int(D / bar) + 1; sw = 0.58
for b in range(nb):
    t0 = b * bar; root, tones = CH[b % 4]; pat = PAT[(b // 4) % 4]
    for i in range(8):
        tn = t0 + (i // 2) * beat + (sw * beat if i % 2 else 0)
        if not (b % 4 == 3 and i == 7): mu.add(marimba(midi(tones[pat[i]] + 12)), tn, 0.5 if i % 2 == 0 else 0.36, 0.25)
        mu.add(shaker(1.0 if i % 2 else 0.55), tn, 0.1, -0.1)
    for bt, up in ((1, False), (1 + sw, True), (3, False), (3 + sw, True)):
        order = tones[::-1] if up else tones
        for k, m in enumerate(order[:3] if up else order): mu.add(uke(midi(m)), t0 + bt * beat + k * 0.012, 0.2 if not up else 0.13, -0.3)
    mu.add(bass(midi(root)), t0, 0.75, 0.0); mu.add(bass(midi(root + 7)), t0 + 2 * beat, 0.55, 0.0); mu.add(bass(midi(root)), t0 + 3 * beat + sw * beat, 0.35, 0.0)
music = mu.b
# gain automation: quiet under voice, 1 s drop-out before the eruption, louder afterwards
tgrid = np.arange(N) / SR; g = np.ones(N)
g *= np.interp(tgrid, [0, 0.3], [0, 1])
bm = E['boom']
g *= np.interp(tgrid, [bm - 1.25, bm - 1.0, bm - 0.02, bm + 0.05], [1, 0, 0, 1.9])
g *= np.interp(tgrid, [S[13], bm - 1.25], [1.0, 0.75])
g *= np.interp(tgrid, [D - 1.2, D - 0.05], [1, 0])
music = music * g

# ---------------- mix ----------------
sr, vo = wavfile.read(HERE + '/build/vo.wav'); vo = vo.astype(np.float64) / 32768; vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
act = np.abs(vo) > 0.02; vrms = np.sqrt(np.mean(vo[act] ** 2)); mrms = np.sqrt(np.mean(music[:, : int((bm - 2) * SR)] ** 2))
music *= (vrms * 10 ** (-20 / 20)) / mrms
sfx = np.tanh(fx.b / 0.5) * 0.5
# gentle ducking of sfx/music while the narrator speaks
env = np.convolve(np.abs(vo), np.ones(int(0.12 * SR)) / int(0.12 * SR), mode='same'); duck = 1 - 0.35 * np.clip(env / 0.08, 0, 1)
mix = np.stack([vo, vo]) * 1.0 + music * (0.85 + 0.15 * duck) + sfx * duck
peak = np.abs(mix).max(); mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.97 if peak > 0.95 else mix
print('voice rms dB', 20 * np.log10(vrms), 'music rms dB', 20 * np.log10(np.sqrt(np.mean(music[:, : int((bm - 2) * SR)] ** 2))), 'sfx peak', np.abs(sfx).max(), 'mix peak', np.abs(mix).max())
wavfile.write(HERE + '/build/mix.wav', SR, (mix.T * 32767).astype(np.int16))
wavfile.write(HERE + '/build/music.wav', SR, (np.clip(music.T * 4, -1, 1) * 32767).astype(np.int16))
