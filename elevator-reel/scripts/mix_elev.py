"""SFX timeline for the elevator episode (+ VO if given). usage: mix_elev.py out.wav [vo_file]"""
import sys, json, subprocess, numpy as np
sys.path.insert(0, "/opt/work/post")
import sfx
from sfx import SR
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d

out = sys.argv[1]
vo_path = sys.argv[2] if len(sys.argv) > 2 else None
S = json.load(open("/opt/work/elev/shots.json"))
words = json.load(open("/opt/work/elev/words.json"))["words"]
TOTAL = max(v[1] for v in S.values()) - 1
DUR = TOTAL / 30.0
N = int(round(DUR * SR))
FX = np.zeros(N)
sec = lambda fr: (fr - 1) / 30.0


def place(x, t, db=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    seg = x[:N - i] * (10 ** (db / 20))
    FX[i:i + len(seg)] += seg


rng = np.random.default_rng(5)
a0, a1 = S["01a"]; d0 = S["03"][0]
# pulls every 13 frames: huff out on yank, inhale between, piano bump on stairs
for f in range(a0, d0, 13):
    place(sfx.breath(0.32, False), sec(f + 5), -14)
    place(sfx.breath(0.28, True, 0.6), sec(f + 9), -22)
    place(sfx.knock(110), sec(f + 6), -20)
    place(sfx.rope_creak(0.25, 380), sec(f + 4), -24)
TON = int(round(words[15]["start"] * 30)) + 1
place(sfx.knock(90), sec(TON - 2), -10); place(sfx.knock(80), sec(TON + 3), -11)
place(sfx.piano_clang(1.8, 98), sec(TON - 1), -12)
place(sfx.crack(), sec(d0 + 3), -10)
e0 = S["04a"][0]; g0 = S["04b"][0]; i0 = S["05b"][0]
for k in range(4):
    place(sfx.rope_creak(0.2, 300), sec(e0 + 4 + k * 6), -24)
for f in range(g0, i0, 8):
    place(sfx.rope_creak(0.3, 460), sec(f), -18)
place(sfx.sizzle(0.6), sec(i0 + 2), -14)
place(sfx.whoosh(0.5, 2000, 300, rise=False), sec(i0 + 2), -18)
place(sfx.piano_clang(1.5, 87), sec(i0 + 9), -14); place(sfx.thud(60, 0.5, 1.2), sec(i0 + 9), -12)
j0 = S["06"][0]
place(sfx.whoosh(0.3, 400, 1600), sec(j0), -18); place(sfx.metal_clank(0.6, 0.5), sec(j0 + 5), -12)
place(sfx.sparkle(), sec(S["07"][0] + 2), -14)
for f in (S["07"][0] + 4, S["07"][0] + 12, S["07"][0] + 20):          # temple taps
    place(sfx.knock(950), sec(f), -24)
for f in range(S["08a"][0], S["08a"][1], 7):
    place(sfx.rope_creak(0.3, 520), sec(f), -18)
m0 = S["08b"][0]
place(sfx.whoosh(1.4, 300, 2500, rise=True), sec(m0 + 1), -14)
n0 = S["09"][0]; LAND = n0 + 8
place(sfx.fall_whistle_down(0.3), sec(n0), -14); place(sfx.thud(45, 0.7, 1.5), sec(LAND), -6); place(sfx.poof(), sec(LAND), -12)
for f in (LAND + 14, LAND + 22):                                       # dusting off his hands
    place(sfx.scrub(0.22, 18.0, (2500, 7000)), sec(f), -24)
for f in range(S["10"][0], S["10"][1], 12):
    place(sfx.rope_creak(0.4, 600), sec(f), -22)
p0 = S["11"][0]; pb0, pb1 = S["11b"]
hit1 = p0 + 8; hit2 = p0 + int((pb0 - p0) * 0.78); near = pb0 + int((pb1 - pb0) * 0.6)
for h in (hit1, hit2):
    place(sfx.glass_shatter(1.2), sec(h), -8); place(sfx.piano_clang(1.2, 104), sec(h), -16)
place(sfx.whoosh(0.4, 600, 2400), sec(near - 5), -14); place(sfx.glass_shatter(0.8), sec(near), -14)
q0 = S["12"][0]
for k in range(6):
    place(sfx.knock(150 + 25 * k), sec(q0 + 3 + k * 4), -12); place(sfx.poof() * 0.4, sec(q0 + 5 + k * 4), -22)
r0, r1 = S["13"]
for f in range(r0, r1, 8):
    place(sfx.knock(320), sec(f + 5), -10); place(sfx.clink(), sec(f + 5), -18)
s0, s1 = S["14"]
place(sfx.rope_creak(0.8, 380), sec(s0 + 2), -16); place(sfx.whoosh(1.4, 300, 1200), sec(s0), -18)
t0_ = S["15"][0]                                                        # noodle arms: strain... FLOP
place(sfx.fall_whistle_down(0.35), sec(t0_ + 16), -18); place(sfx.thud(140, 0.18, 2.0), sec(t0_ + 18), -18)
u0 = S["16"][0]
place(sfx.fall_whistle_down(0.25), sec(u0), -16); place(sfx.metal_clank(0.9, 0.7), sec(u0 + 7), -8)
place(sfx.motor_hum(sec(S["19"][0]) - sec(u0 + 14), f0=120, start_ramp=0.3), sec(u0 + 14), -18)
v0 = S["17a"][0]
place(sfx.click(), sec(v0 + 11), -8)
x0, x1 = S["17b"]
for k, f in enumerate((x0, x0 + 8, x0 + 15, x0 + 22, x0 + 29)):
    place(sfx.whoosh(0.3, 300 if k % 2 == 0 else 2500, 2500 if k % 2 == 0 else 300, rise=(k % 2 == 0)), sec(f), -12)
y0 = S["18"][0]
place(sfx.bell_ding(), sec(y0 + 1), -8); place(sfx.sparkle(), sec(y0 + 4), -14)
if "18b" in S:                                                        # callback close-up: long relieved exhale
    place(sfx.breath(0.9, False, 0.9), sec(S["18b"][0] + 3), -15)
z0 = S["19"][0]
place(sfx.poof(), sec(z0 + 1), -6); place(sfx.bell_ding(), sec(z0 + 9), -10); place(sfx.whoosh(0.6, 1500, 600, rise=False), sec(z0 + 10), -16)
for k in range(10):
    place(sfx.pop(), sec(z0 + 8) + rng.uniform(0, 1.0), -20)
# ---------------------------------------------------------------- mix
meter = pyln.Meter(SR)
if vo_path:
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", vo_path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    vo = np.frombuffer(dec, dtype=np.float32).astype(np.float64)
    VO = np.zeros(N); VO[:min(N, len(vo))] = vo[:N]
    win = int(0.05 * SR)
    env = np.sqrt(np.convolve(VO ** 2, np.ones(win) / win, mode='same'))
    env = signal.sosfiltfilt(signal.butter(2, 4, fs=SR, output='sos'), env)
    duck = 1.0 - 0.45 * np.clip(env / (np.percentile(env, 95) + 1e-9), 0, 1)
    mix = VO + FX * duck * 10 ** (-7.0 / 20)
else:
    mix = FX * 10 ** (-7.0 / 20)


def limiter(x, ceiling_db=-1.2, look=0.004, rel=0.08):
    c = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1))
    up = np.pad(up, (0, (-len(up)) % 4))
    pk = up.reshape(-1, 4).max(axis=1)[:len(x)]
    need = np.minimum(1.0, c / (pk + 1e-12))
    g = minimum_filter1d(need, size=2 * int(look * SR) + 1)
    a = np.exp(-1.0 / (rel * SR)); o = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        o[i] = cur
    return x * o


target = -14.0 if vo_path else -18.0
y = mix * 10 ** ((target - meter.integrated_loudness(np.stack([mix, mix], 1))) / 20)
for it in range(8):
    y = limiter(y)
    L = meter.integrated_loudness(np.stack([y, y], 1))
    if abs(L - target) < 0.03:
        break
    y *= 10 ** ((target - L) / 20)
sf.write(out, np.stack([y, y], 1).astype(np.float32), SR, subtype='FLOAT')
print("MIX", out, "LUFS", round(meter.integrated_loudness(np.stack([y, y], 1)), 2), "dur", len(y) / SR)
