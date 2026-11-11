import json, subprocess, numpy as np
SR = 44100
DUR = 28.6
N = int(DUR * SR)
D = "/tmp/claude-0/-home-user-my-first-website-/97a48f21-217f-5b7e-84cb-0605e7d6dafc/scratchpad/"
rng = np.random.default_rng(7)

def load(f):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def fade(x, fi=0.005, fo=0.02):
    x = x.copy(); a = int(fi * SR); b = int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x

vo_bus = np.zeros(N); sfx = np.zeros(N); music = np.zeros(N); amb = np.zeros(N)
def place(bus, x, t, gain=1.0):
    i = int(t * SR)
    if i >= N: return
    x = x[: N - i]
    bus[i:i + len(x)] += x * gain

def db(v): return 10 ** (v / 20)

# ---------- voice ----------
vo = load(D + "audio/vo.mp3")
lines = json.load(open(D + "lines.json"))
for l in lines:
    seg = vo[int(l["a"] * SR):int(l["b"] * SR)]
    place(vo_bus, fade(seg, 0.01, 0.04), l["start"], 1.0)

# ---------- sfx ----------
S = lambda n: load(D + "audio/sfx/" + n)
def cut(x, a, b=None): return fade(x[int(a * SR): int(b * SR) if b else None], 0.003, 0.05)
place(sfx, cut(S("slide.mp3"), 0), 0.25, db(-4))
place(sfx, cut(S("crash_1.mp3"), 0, 1.4), 1.0, db(-1))
place(sfx, cut(S("magnets.mp3"), 0.05, 1.0), 3.35, db(-3))
place(sfx, cut(S("heroic.mp3"), 0), 4.25, db(-6))
place(sfx, cut(S("toast.mp3"), 0.88, 2.4), 6.75, db(-1))
place(sfx, cut(S("laugh.mp3"), 0), 7.05, db(-7))
place(sfx, cut(S("bell.mp3"), 0), 12.42, db(-1))
place(sfx, cut(S("scratch.mp3"), 0), 12.93, db(0))
sp = S("sparkle.mp3")
place(sfx, fade(sp[: int(1.3 * SR)], 0.003, 0.4), 13.45, db(-6))
place(sfx, fade(sp[int(1.0 * SR): int(2.8 * SR)], 0.01, 0.5), 22.3, db(-7))
place(sfx, cut(S("trombone1.mp3"), 0, 1.9), 26.35, db(-1))

t_ = lambda n: np.arange(int(n * SR)) / SR
# slide-whistle down as dad sinks (24.2 -> 24.95), then thud
tt = t_(0.75); f = np.linspace(1400, 300, len(tt)); ph = 2 * np.pi * np.cumsum(f) / SR
place(sfx, fade(np.sin(ph) * 0.25 * (1 + 0.1 * np.sin(2 * np.pi * 6 * tt)), 0.02, 0.08), 24.2, 1)
tt = t_(0.35); place(sfx, np.sin(2 * np.pi * (90 - 50 * tt) * tt) * np.exp(-tt * 14) * 0.9, 24.95, 1)
tt = t_(0.25); place(sfx, np.sin(2 * np.pi * (120 - 60 * tt) * tt) * np.exp(-tt * 18) * 0.5, 24.68, 1)
# whoosh on spotlight swing + crowd turn
def noise_band(n, lo, hi):
    x = rng.standard_normal(int(n * SR)); X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    X[(fr < lo) | (fr > hi)] = 0; y = np.fft.irfft(X, len(x)); return y / (np.abs(y).max() + 1e-9)
w = noise_band(0.45, 400, 3000); tt = t_(0.45); place(sfx, w * np.sin(np.pi * tt / 0.45) ** 2 * 0.35, 14.98, 1)
# sunglasses "shing"
tt = t_(0.4); place(sfx, (np.sin(2 * np.pi * 3200 * tt) + 0.5 * np.sin(2 * np.pi * 4800 * tt)) * np.exp(-tt * 9) * 0.12, 24.08, 1)

# ---------- crowd ----------
pink = noise_band(DUR, 250, 3500)
c1, c2 = S("crowd1.mp3"), S("crowd2.mp3")
roar = np.zeros(N)
tt = 9.35
k = 0
while tt < 12.95:
    src = c1 if k % 2 == 0 else c2
    off = rng.uniform(0, 0.25)
    segm = src[int(off * SR): int((off + 0.7) * SR)]
    place(roar, fade(segm, 0.08, 0.25), tt, db(-4))
    tt += 0.45; k += 1
env = np.zeros(N)
tl = np.arange(N) / SR
env = np.clip((tl - 9.35) / 0.3, 0, 1) * (tl < 12.95)
roar += pink * 0.12 * env * (1 + 0.3 * np.sin(2 * np.pi * 0.7 * tl))
roar *= (tl < 12.95)
amb += roar
# hushed murmur after the record scratch
mur = noise_band(DUR, 200, 1200) * 0.035 * ((tl > 13.1) & (tl < 26.25)) * np.clip((tl - 13.1) / 1.5, 0, 1)
amb += mur
# kitchen room tone
amb += noise_band(DUR, 100, 800) * 0.006 * (tl < 9.4)

# ---------- music (synth) ----------
BPM = 132; beat = 60 / BPM
def note_f(m): return 440 * 2 ** ((m - 69) / 12)
def pluck(freq, dur, bright=1.0):
    tt = t_(dur); env = np.exp(-tt * 7) * (1 - np.exp(-tt * 400))
    return (np.sin(2 * np.pi * freq * tt) + 0.35 * bright * np.sin(2 * np.pi * 2 * freq * tt) + 0.15 * bright * np.sin(2 * np.pi * 4 * freq * tt)) * env
def bassn(freq, dur):
    tt = t_(dur); env = np.exp(-tt * 5) * (1 - np.exp(-tt * 300))
    sq = np.sign(np.sin(2 * np.pi * freq * tt)) * 0.3 + np.sin(2 * np.pi * freq * tt)
    return sq * env
def kick():
    tt = t_(0.25); f = 120 * np.exp(-tt * 25) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 12)
KICK = kick(); SN = noise_band(0.18, 800, 7000) * np.exp(-t_(0.18) * 22) * 0.6 + np.sin(2 * np.pi * 190 * t_(0.18)) * np.exp(-t_(0.18) * 30) * 0.4
HAT = noise_band(0.05, 6000, 14000) * np.exp(-t_(0.05) * 80) * 0.35
prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])]  # C Am F G
mel = [72, None, 76, 79, 76, None, 74, 72, 69, None, 72, 74, 72, None, 71, 67]  # 16 eighths per 2 bars pattern
def music_section(t0, t1, drums=True, gain=1.0):
    bar = beat * 4; nb = int(np.ceil((t1 - t0) / bar))
    for b in range(nb):
        root, chord = prog[b % 4]
        bt = t0 + b * bar
        for q in range(4):  # oom-pah bass
            tq = bt + q * beat
            if tq >= t1: break
            fr = note_f(root - 12 + (7 if q % 2 else 0))
            place(music, bassn(fr, beat * 0.8) * 0.32 * gain, tq)
            if q % 2 == 1:
                for m in chord: place(music, pluck(note_f(m), beat * 0.4, 0.6) * 0.07 * gain, tq)
            if drums:
                place(music, KICK * 0.45 * gain, tq) if q % 2 == 0 else place(music, SN * 0.28 * gain, tq)
                place(music, HAT * gain, tq + beat / 2)
        for e in range(8):
            te = bt + e * beat / 2
            if te >= t1: break
            m = mel[(b % 2) * 8 + e]
            if m: place(music, pluck(note_f(m), beat * 0.45, 1.0) * 0.16 * gain, te)
music_section(0.0, 3.95, drums=True, gain=1.0)
music_section(6.85, 9.4, drums=False, gain=0.8)
music_section(9.4, 12.93, drums=True, gain=1.1)
music[int(12.95 * SR):] = 0
# heroic brass swell 4.0 - 6.75
def brass(freq, dur):
    tt = t_(dur); y = np.zeros_like(tt)
    for h in range(1, 9): y += np.sin(2 * np.pi * freq * h * tt * (1 + 0.002 * np.sin(2 * np.pi * 5 * tt))) / h ** 1.1
    return y
hdur = 2.8; tt = t_(hdur)
henv = np.clip(tt / 1.2, 0, 1) ** 1.5 * np.clip((hdur - tt) / 0.15, 0, 1)
her = sum(brass(note_f(m), hdur) for m in [48, 55, 60, 64, 67]) * henv * 0.05
h2 = sum(brass(note_f(m), hdur - 1.4) for m in [53, 57, 60, 65]); t2 = np.arange(len(h2)) / SR
h2 = h2 * 0.04 * np.clip((hdur - 1.4 - t2) / 0.15, 0, 1) * np.clip(t2 / 0.3, 0, 1)
i0 = int(1.4 * SR); L = min(len(h2), len(her) - i0); her[i0:i0 + L] += h2[:L]
place(music, her, 3.98, 1)
music[int(6.78 * SR):int(6.86 * SR)] *= np.linspace(1, 0, int(6.86 * SR) - int(6.78 * SR))

# ---------- duck music under voice ----------
v_env = np.abs(vo_bus)
win = int(0.15 * SR)
v_s = np.convolve(v_env, np.ones(win) / win, mode="same")
duck = 1 - 0.55 * np.clip(v_s / 0.03, 0, 1)
music *= duck
amb *= 1 - 0.45 * np.clip(v_s / 0.03, 0, 1)

mix = vo_bus * 1.0 + sfx * 0.8 + music * 0.55 + amb * 0.7
mix /= max(1.0, np.abs(mix).max() / 0.95)
stereo = np.stack([mix, mix], 1).astype(np.float32)
open(D + "mix_raw.f32", "wb").write(stereo.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", D + "mix_raw.f32",
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", D + "mix.wav"], check=True)
print("ok", np.abs(mix).max())
