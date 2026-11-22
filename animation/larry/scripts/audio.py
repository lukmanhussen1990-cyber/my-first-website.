"""Edit the voiceover (drop the read-aloud 'Final shot.'), synthesise SFX and mix to a stereo WAV.
Usage: python3 audio.py <vo.mp3> <out.wav>"""
import subprocess, sys, wave
import numpy as np

SR = 48000
VO, OUT = sys.argv[1], sys.argv[2]
CUT = (45.12, 45.72)        # 'Final shot.' in the original voiceover
TOTAL = 49.30
rng = np.random.default_rng(7)


def load_mono(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def t2s(t):
    return int(round(t * SR))


def env(n, a=0.005, d=0.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-4))
    return e


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y


def lp_fast(x, fc):
    """one-pole lowpass via FFT magnitude response (fast)"""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X * H, len(x)).astype(np.float32)


def hp_fast(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    H = (f / fc) ** 2 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X * H, len(x)).astype(np.float32)


def bp_fast(x, lo, hi):
    return hp_fast(lp_fast(x, hi), lo)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return (x / m * peak).astype(np.float32)


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


# ------------------------------------------------------------------ sound design
def whoosh(dur=0.45, lo=300, hi=3200):
    n = t2s(dur); t = np.arange(n) / SR
    x = noise(n)
    # sweep: blend lowpassed and highpassed versions over time
    a = lp_fast(x, lo * 2); b = bp_fast(x, lo, hi)
    mix = np.sin(np.pi * t / dur) ** 2
    y = (a * (1 - mix) + b * mix) * np.sin(np.pi * t / dur) ** 1.5
    return norm(y, 0.6)


def thud(dur=0.5, f0=70, f1=38, click=0.6):
    n = t2s(dur); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env(n, 0.002, dur * 0.5, 5)
    c = lp_fast(noise(n), 2500) * env(n, 0.0005, 0.03, 6) * click
    return norm(np.tanh((body + c) * 2.5), 0.95)


def slap(dur=0.25):
    n = t2s(dur)
    x = bp_fast(noise(n), 900, 7000) * env(n, 0.0005, 0.04, 7)
    return norm(x + 0.5 * thud(dur, 120, 80, 0.2)[:n], 0.9)


def boing(dur=0.38, f0=420, f1=180):
    n = t2s(dur); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 9) + 40 * np.sin(2 * np.pi * 18 * t) * np.exp(-t * 6)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, dur * 0.7, 3)
    return norm(y, 0.7)


def boop(dur=0.16):
    n = t2s(dur); t = np.arange(n) / SR
    f = 900 * np.exp(-t * 10) + 500
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.08, 4), 0.7)


def burst(dur=0.7):
    n = t2s(dur)
    rip = bp_fast(noise(n), 500, 6000) * (rng.random(n) > 0.7) * env(n, 0.002, 0.25, 4)
    pop = thud(dur, 160, 60, 0.8)[:n]
    # quick brassy "ta-da" (two saw chords)
    t = np.arange(n) / SR
    chord = np.zeros(n)
    for k, f in enumerate((392, 494, 587, 784)):
        s = 2 * ((t * f) % 1.0) - 1
        chord += s * (t > 0.08) * env(n, 0.01, 0.6, 2)
    chord = lp_fast(chord.astype(np.float32), 3000)
    return norm(rip * 0.8 + pop * 0.7 + chord * 0.35, 0.9)


def jets(dur=1.4):
    n = t2s(dur); t = np.arange(n) / SR
    x = noise(n)
    roar = lp_fast(x, 1800) * 1.0 + bp_fast(x, 2500, 9000) * 0.4
    # doppler: amplitude bell + falling whine
    bell = np.exp(-((t - dur * 0.42) / (dur * 0.22)) ** 2)
    whine = np.sin(2 * np.pi * np.cumsum(1400 - 700 * (t / dur)) / SR) * 0.15
    return norm(np.tanh((roar + whine) * bell * 2.2), 0.95)


def tank(dur=1.0):
    n = t2s(dur); t = np.arange(n) / SR
    rumble = lp_fast(noise(n), 140) * 3
    eng = (2 * ((t * 38) % 1.0) - 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    clank = np.zeros(n)
    for k in range(int(dur * 9)):
        i = t2s(k / 9 + rng.uniform(0, 0.03))
        if i < n:
            m = min(n - i, t2s(0.05))
            clank[i:i + m] += bp_fast(noise(m), 1500, 5000) * env(m, 0.0005, 0.02, 6)
    return norm(rumble + lp_fast(eng.astype(np.float32), 400) * 0.6 + clank * 0.35, 0.85)


def march(dur=2.6, bpm=120):
    n = t2s(dur); y = np.zeros(n, np.float32)
    step = 60 / bpm
    k = 0
    while k * step < dur:
        for v in range(4):
            i = t2s(k * step + rng.uniform(0, 0.025))
            th = thud(0.2, 140, 70, 0.9)
            m = min(n - i, len(th))
            if m > 0:
                y[i:i + m] += th[:m] * (0.5 if v else 0.7)
        k += 1
    return norm(y, 0.6)


def tiptoe(dur=1.15):
    """sneaky pizzicato: low-high plucks"""
    n = t2s(dur); y = np.zeros(n, np.float32)
    notes = [196, 233, 196, 262, 196, 233, 294, 262]
    for k, f in enumerate(notes):
        i = t2s(k * dur / len(notes))
        m = min(n - i, t2s(0.18))
        t = np.arange(m) / SR
        pl = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(m, 0.002, 0.06, 5)
        y[i:i + m] += pl
    return norm(y, 0.55)


def boom(dur=1.3, f=50):
    n = t2s(dur); t = np.arange(n) / SR
    ff = f * (1 + 1.5 * np.exp(-t * 25))
    y = np.sin(2 * np.pi * np.cumsum(ff) / SR) * env(n, 0.003, dur * 0.6, 3)
    y += lp_fast(noise(n), 300) * env(n, 0.001, 0.15, 5) * 0.5
    return norm(np.tanh(y * 2.0), 0.95)


def zipline(dur=1.4):
    n = t2s(dur); t = np.arange(n) / SR
    f = 900 - 500 * (t / dur)
    y = (2 * ((np.cumsum(f) / SR) % 1.0) - 1) * 0.3 + bp_fast(noise(n), 2000, 6000) * 0.3
    return norm(y * np.sin(np.pi * t / dur), 0.35)


def clank(dur=0.4):
    n = t2s(dur); t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((523, 9), (1430, 14), (2710, 20), (3900, 26)))
    return norm(y * env(n, 0.0005, 0.3, 3), 0.6)


def sting(dur=2.2):
    """horror jump-scare: dissonant string cluster stab + screech + sub boom"""
    n = t2s(dur); t = np.arange(n) / SR
    y = np.zeros(n)
    for f in (65.4, 69.3, 92.5, 98.0, 130.8, 138.6, 185.0, 196.0, 277.2, 293.7, 554.4, 587.3, 1108.7, 1174.7):
        det = f * (1 + rng.uniform(-0.004, 0.004))
        saw = 2 * ((t * det + rng.random()) % 1.0) - 1
        y += saw * (1 + 0.5 * np.sin(2 * np.pi * rng.uniform(9, 14) * t))
    y = lp_fast(y.astype(np.float32), 5000) / 6
    scr = np.sin(2 * np.pi * np.cumsum(1500 + 1800 * t / dur) / SR) * 0.25
    y = (y + scr) * env(n, 0.004, dur * 0.8, 2.2)
    y += boom(dur, 40) * 0.9
    return norm(np.tanh(y * 2.5), 0.98)


def crickets(dur):
    n = t2s(dur); t = np.arange(n) / SR
    y = np.zeros(n)
    for k, (f, r) in enumerate(((4200, 3.1), (4700, 2.3), (3900, 1.7))):
        chirp = (np.sin(2 * np.pi * 30 * t + k) > 0.6) * (np.sin(2 * np.pi * r * t + k) > 0.2)
        y += np.sin(2 * np.pi * f * t) * chirp
    return norm(lp_fast(y.astype(np.float32), 6000), 0.12)


# ------------------------------------------------------------------ mix
vo = load_mono(VO)
a, b = t2s(CUT[0]), t2s(CUT[1])
fade = t2s(0.01)
head = vo[:a].copy(); tail = vo[b:].copy()
head[-fade:] *= np.linspace(1, 0, fade); tail[:fade] *= np.linspace(0, 1, fade)
vo = np.concatenate([head, tail])
N = t2s(TOTAL)
mix = np.zeros(N, np.float32)
mix[:min(N, len(vo))] += vo[:N] * 1.0


def put(sig, t, gain=1.0):
    i = t2s(t)
    if i >= N:
        return
    m = min(N - i, len(sig))
    mix[i:i + m] += sig[:m] * gain


# scene-change whooshes
for t in (7.80, 11.05, 13.00, 19.75, 25.40, 33.70, 42.20):
    put(whoosh(), t - 0.18, 0.16)
# reaction words: low boom
for t in (6.90, 15.65, 21.82, 28.74):
    put(boom(0.9, 55), t, 0.14)
put(slap(), 8.96, 0.3)                    # wallet slap
put(thud(0.6, 90, 40), 12.36, 0.38)        # stamp
for t in (17.21, 17.62, 18.41, 18.82):     # stick pokes
    put(boing(), t, 0.25)
put(thud(0.3, 110, 70, 0.3), 23.28, 0.22)   # box wobbles
put(thud(0.3, 110, 70, 0.3), 23.45, 0.2)
put(burst(), 24.08, 0.34)                   # Larry bursts out
put(boom(1.2, 45), 26.85, 0.24)            # bodyguard reveal
put(clank(), 29.95, 0.25)                   # vent grate
put(zipline(), 30.15, 0.3)                 # rope descent
put(boom(1.0, 42), 32.30, 0.34)             # rage
put(boop(), 33.00, 0.35)                   # finger boop
put(march(2.6), 33.75, 0.2)                # army
put(tank(0.9), 36.40, 0.3)
put(jets(1.3), 37.10, 0.36)
put(tiptoe(1.15), 39.85, 0.3)              # sneaky Larry
for k, t in enumerate((41.04, 41.17, 41.29)):  # dog-pile
    put(thud(0.45, 100, 45, 0.7), t, 0.32)
put(crickets(4.5), 42.25, 0.6)             # peaceful night
put(sting(1.6), 48.02, 0.62)                # after "...is LARRY." -> jump-scare sting
# soft limiter
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
stereo = np.stack([mix, mix], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, len(mix) / SR, "s")
