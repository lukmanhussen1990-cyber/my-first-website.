"""Build SFX timeline under the unchanged VO, master to -14 LUFS."""
import sys, json, subprocess, numpy as np
sys.path.insert(0, "/opt/work/post")
import sfx
from sfx import SR
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal

TOTAL_FRAMES = 1658
DUR = TOTAL_FRAMES / 30.0

def F(t):
    return int(round(t * 30)) + 1

SHOTS = [("1a", 0.00), ("1b", 1.70), ("1c", 3.18), ("2a", 5.50), ("3a", 7.95), ("3b", 9.55), ("4a", 10.90),
         ("4b", 11.80), ("4c", 13.70), ("5a", 14.90), ("5b", 16.30), ("6a", 17.90), ("6b", 19.30), ("7a", 20.60),
         ("7b", 22.00), ("7c", 23.90), ("8a", 24.80), ("8a2", 26.30), ("8b", 27.60), ("9a", 29.10), ("9b", 31.05),
         ("9c", 32.45), ("10a", 34.15), ("10b", 35.55), ("11a", 37.05), ("11b", 38.75), ("11c", 40.55),
         ("11d", 41.95), ("12a", 44.35), ("12b", 46.35), ("12c", 47.95), ("12d", 49.75), ("13a", 51.70),
         ("13b", 52.85)]
S = {}
for i, (n, t) in enumerate(SHOTS):
    f0 = F(t)
    f1 = F(SHOTS[i + 1][1]) if i + 1 < len(SHOTS) else TOTAL_FRAMES + 1
    S[n] = (f0, f1)

def sec(frame):
    return (frame - 1) / 30.0

# ---------------------------------------------------------------- VO (unchanged)
vo_raw = "/opt/work/vo.mp3"
dec = subprocess.run(["ffmpeg", "-v", "error", "-i", vo_raw, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(dec, dtype=np.float32).astype(np.float64)
N = int(round(DUR * SR))
VO = np.zeros(N); VO[:min(N, len(vo))] = vo[:N]
print("VO samples", len(vo), "dur", len(vo) / SR, "timeline", DUR)

FX = np.zeros(N)

def place(x, t, db=0.0):
    i = int(round(t * SR))
    if i >= N:
        return
    seg = x[:N - i] * (10 ** (db / 20))
    FX[i:i + len(seg)] += seg

# ---------------------------------------------------------------- events
SPLASH_F = S["1c"][0] + 31
place(sfx.splash(), sec(SPLASH_F) - 0.02, -9)
for k in range(4):
    place(sfx.splash() * 0.5, sec(SPLASH_F + 13 + 7 * k), -19)          # rinsing swishes
g0 = S["2a"][0]
place(sfx.squelch(), sec(g0 + 6), -10)
place(sfx.squelch(), sec(g0 + 30), -14)
for k in range(6):
    place(sfx.plip(), sec(g0 + 20 + 5 * k), -20)
POUR0 = S["3a"][0] + 22
place(sfx.glug(6), sec(POUR0), -10)
place(sfx.scrub(sec(S["3b"][1]) - sec(S["3b"][0]) + 0.1), sec(S["3b"][0]), -15)
place(sfx.sparkle(), sec(S["4a"][0] + 4), -18)
LAND = S["4b"][0] + 14
for k in range(7):
    place(sfx.thud(f=60 + 15 * k, softness=1.2), sec(LAND + k * 2), -9 - k)
place(sfx.whoosh(0.5, 2500, 400, rise=False), sec(LAND - 7), -16)
place(sfx.crowd_scrub(sec(S["6a"][0] + 4) - sec(S["5a"][0])), sec(S["5a"][0]), -16)
DROP0 = S["6b"][0] + 9
place(sfx.clunk(), sec(DROP0), -6)
place(sfx.clunk() * 0.8, sec(DROP0 + 3), -9)
place(sfx.fire(sec(S["7a"][0]) - sec(DROP0 + 3) + 0.05), sec(DROP0 + 3), -12)
place(sfx.whoosh(0.7, 3000, 300, rise=False), sec(DROP0 + 2), -12)
for k in range(5):
    place(sfx.fall_whistle(0.7), sec(DROP0 + 3 + k * 2), -20)
throws = [S["7a"][0] + 3 + 6 * i for i in range(6)]
for f in throws:
    place(sfx.whoosh(0.18, 600, 2400), sec(f), -18)
    place(sfx.thud(f=110, d=0.25, softness=1.5), sec(f + 8), -15)
    place(sfx.metal_clank(0.35, base=0.6) * 0.4, sec(f + 8), -22)
CR0 = S["7b"][0] + 6; CR1 = S["7b"][1] - 2
for k in range(5):
    tsq = sec(CR0) + k * (sec(CR1) - sec(CR0)) / 4.5
    place(sfx.crank_squeak(), tsq, -15)
place(sfx.rumble(sec(CR1) - sec(CR0) + 0.3, rot_hz=1.0, level=0.8), sec(CR0), -17)
place(sfx.sparkle(), sec(S["7c"][0] + 3), -16)
MOTOR_LAND = S["8b"][0] + 9
place(sfx.whoosh(0.3, 500, 1800), sec(S["8b"][0]), -16)
place(sfx.metal_clank(0.9, base=0.8), sec(MOTOR_LAND), -8)
for i in range(4):
    place(sfx.clink(), sec(MOTOR_LAND + 4 + i * 2 + 4), -14)
m1 = S["8b"][1]
hum_end = S["10a"][0] + 10
place(sfx.motor_hum(sec(hum_end) - sec(m1 - 12), f0=95), sec(m1 - 12), -18)
place(sfx.rumble(sec(S["10a"][0]) - sec(S["9a"][0] + 6), rot_hz=0.75, level=0.9), sec(S["9a"][0] + 6), -16)
for f in (S["9a"][0] + 8, S["9b"][0] + 15, S["9c"][0] + 26):
    place(sfx.whoosh(0.35, 800, 2000), sec(f), -18)                         # arrow pop
for f in (S["10a"][0] + 3, S["10a"][0] + 20, S["10b"][0] + 5):
    place(sfx.bubbles(0.6, 6, 200, 500, rise=True) * 0.6, sec(f), -14)      # murky bubbles
h0, h1 = S["11a"]
rngp = np.random.default_rng(3)
for k in range(22):
    place(sfx.pop(), sec(h0 + 6) + rngp.uniform(0, sec(h1 - 6) - sec(h0 + 6)), -16)
u0 = S["11b"][0]
place(sfx.metal_clank(1.0, base=0.55), sec(u0 + 10), -7)
place(sfx.whoosh(0.3, 400, 1500), sec(u0 + 6), -17)
pmp0 = S["11c"][0]
place(sfx.motor_hum(sec(S["11d"][0] + 8) - sec(pmp0), f0=160, start_ramp=0.1) * 0.6, sec(pmp0), -21)
place(sfx.drain(sec(S["11d"][0] + 8) - sec(pmp0 + 3) + 0.2), sec(pmp0 + 3), -12)
q0d, q1d = S["11d"]
place(sfx.pour(sec(q1d) - sec(q0d + 4)), sec(q0d + 4), -14)
e0 = S["12a"][0]
place(sfx.sparkle(), sec(e0 + 8), -15)
for k in range(14):
    place(sfx.plip(), sec(e0 + 30) + k * 0.1 + rngp.uniform(0, 0.05), -17)
z0 = S["12c"][0]
TOSS = z0 + 9
place(sfx.whoosh(0.3, 700, 2500), sec(TOSS), -16)
place(sfx.squelch() * 0.6, sec(TOSS + 9), -16)
SPIN_FAST = z0 + 20
place(sfx.whoosh(1.2, 200, 3500, rise=True), sec(SPIN_FAST - 6), -10)
spin_end = S["13a"][0] + 8
place(sfx.spin_whoosh(sec(spin_end) - sec(SPIN_FAST), rate=2.6), sec(SPIN_FAST), -15)
place(sfx.motor_hum(sec(spin_end) - sec(SPIN_FAST - 10), f0=170, start_ramp=0.6), sec(SPIN_FAST - 10), -17)
place(sfx.rumble(sec(spin_end) - sec(SPIN_FAST), rot_hz=2.6, level=1.0), sec(SPIN_FAST), -14)
for k in range(30):
    place(sfx.plip(), sec(S["12d"][0]) + rngp.uniform(0, sec(S["12d"][1]) - sec(S["12d"][0])), -19)
c13 = S["13a"][0]
place(sfx.poof(), sec(c13 + 3), -6)
place(sfx.metal_clank(0.6, base=1.2) * 0.5, sec(c13 + 9), -14)
place(sfx.sparkle(), sec(c13 + 6), -12)
place(sfx.sparkle(), sec(S["13b"][0] + 3), -12)

# ---------------------------------------------------------------- ducking + mix
win = int(0.05 * SR)
env = np.sqrt(np.convolve(VO ** 2, np.ones(win) / win, mode='same'))
env = signal.sosfiltfilt(signal.butter(2, 4, fs=SR, output='sos'), env)
envn = np.clip(env / (np.percentile(env, 95) + 1e-9), 0, 1)
duck = 1.0 - 0.45 * envn
FX_GAIN = 10 ** (-7.0 / 20)
mix = VO + FX * duck * FX_GAIN
# ---------------------------------------------------------------- master to -14 LUFS, TP <= -1 dBTP
meter = pyln.Meter(SR)

def true_peak(x):
    up = signal.resample_poly(x, 4, 1)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)

def limiter(x, ceiling_db=-1.2, look=0.004, rel=0.08):
    c = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1))
    pk = up.reshape(-1, 4).max(axis=1) if len(up) % 4 == 0 else np.pad(up, (0, 4 - len(up) % 4)).reshape(-1, 4).max(axis=1)
    pk = pk[:len(x)]
    need = np.minimum(1.0, c / (pk + 1e-12))
    la = int(look * SR)
    # look-ahead: min over window
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, origin=0)
    # release smoothing (attack instant)
    a = np.exp(-1.0 / (rel * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    return x * out

L0 = meter.integrated_loudness(np.stack([mix, mix], axis=1))
print("pre-master loudness", L0, "TP", true_peak(mix), "VO alone", meter.integrated_loudness(VO))
y = mix * 10 ** ((-14.0 - L0) / 20)
target = -14.0
for it in range(8):
    y = limiter(y)
    L = meter.integrated_loudness(np.stack([y, y], axis=1))
    if abs(L - target) < 0.03:
        break
    y = y * 10 ** ((target - L) / 20)
print("final loudness (stereo)", meter.integrated_loudness(np.stack([y, y], axis=1)), "TP", true_peak(y))
st = np.stack([y, y], axis=1).astype(np.float32)
sf.write("/opt/work/post/mix.wav", st, SR, subtype='FLOAT')
sf.write("/opt/work/post/fx_only.wav", (FX * duck * FX_GAIN).astype(np.float32), SR, subtype='FLOAT')
json.dump({k: list(v) for k, v in S.items()}, open("/opt/work/post/shots.json", "w"))
print("wrote mix.wav", len(y) / SR)
