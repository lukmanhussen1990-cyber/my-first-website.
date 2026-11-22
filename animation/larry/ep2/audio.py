"""Episode 2 "Larry & Dale": synthesise SFX (numpy) and mix them under the voiceover to a stereo WAV.
Recipes from episode 1 are copied unchanged; new ones are below them. The voiceover needs no edit.
Usage: python3 -I audio.py <vo.mp3> <out.wav> [voice-only]
voice-only (the user's choice for the final episode 2): just the voiceover, no SFX, choir or harp."""
import os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cuts import TOTAL

SR = 48000
VO, OUT = sys.argv[1], sys.argv[2]
VOICE_ONLY = len(sys.argv) > 3 and sys.argv[3] == "voice-only"
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


# ------------------------------------------------------------------ episode 2 recipes
def hiss(dur=0.7):
    """bus air brakes / doors: bright noise burst with a fast attack and a falling filter"""
    n = t2s(dur); t = np.arange(n) / SR
    x = bp_fast(noise(n), 2500, 11000) * env(n, 0.005, dur * 0.6, 3)
    return norm(x * (1 - 0.5 * t / dur), 0.7)


def horn(dur=0.42, f=(311, 392)):
    """two-tone vehicle horn (squarish, slightly detuned)"""
    n = t2s(dur); t = np.arange(n) / SR
    y = sum(np.sign(np.sin(2 * np.pi * ff * t + k)) for k, ff in enumerate(f))
    y = lp_fast(y.astype(np.float32), 2600) * np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.04)
    return norm(y, 0.8)


def engine(dur=2.0):
    """idling diesel: low pulse + rumble"""
    n = t2s(dur); t = np.arange(n) / SR
    pulse = (2 * ((t * 26) % 1.0) - 1) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t))
    y = lp_fast(pulse.astype(np.float32), 220) + lp_fast(noise(n), 120) * 2
    fade = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.3)
    return norm(y * fade, 0.6)


def keyboard(dur=1.4, rate=14):
    """fast mechanical-keyboard clatter"""
    n = t2s(dur); y = np.zeros(n, np.float32)
    t = 0.0
    while t < dur:
        i = t2s(t); m = min(n - i, t2s(0.03))
        if m > 0:
            y[i:i + m] += bp_fast(noise(m), 1800, 7000) * env(m, 0.0003, 0.012, 6) * rng.uniform(0.5, 1.0)
        t += rng.exponential(1.0 / rate) + 0.02
    return norm(y, 0.6)


def beep(dur=0.12, f=1300):
    n = t2s(dur); t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.01), 0.5)


def squeak(dur=0.5):
    """office-chair swivel squeak"""
    n = t2s(dur); t = np.arange(n) / SR
    f = 1500 + 600 * np.sin(2 * np.pi * 2.2 * t) + 200 * np.sin(2 * np.pi * 31 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 2
    return norm(y + 0.2 * bp_fast(noise(n), 1500, 4000) * np.sin(np.pi * t / dur), 0.4)


def sniff(dur=0.16):
    n = t2s(dur); t = np.arange(n) / SR
    return norm(bp_fast(noise(n), 1200, 6000) * np.sin(np.pi * t / dur) ** 0.7, 0.5)


def woof(dur=0.32):
    """cartoon dog bark: pitched growl burst with a formant-ish band"""
    n = t2s(dur); t = np.arange(n) / SR
    f = 260 * np.exp(-t * 4) + 140
    saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
    y = bp_fast(saw.astype(np.float32), 300, 2200) + 0.4 * bp_fast(noise(n), 500, 2500)
    return norm(np.tanh(y * 3) * env(n, 0.01, 0.12, 3), 0.8)


def bell(dur=1.2, f=880):
    """boxing-ring bell: inharmonic partials, long ring"""
    n = t2s(dur); t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in
            ((1.0, 1.0, 2.5), (2.76, 0.5, 4), (5.4, 0.3, 7), (8.9, 0.15, 10)))
    return norm(y * np.minimum(1, t / 0.002), 0.7)


def monitor(dur, period=0.85, f=1000):
    """hospital heart monitor beeps"""
    n = t2s(dur); y = np.zeros(n, np.float32); k = 0
    while k * period < dur:
        b = beep(0.11, f); i = t2s(k * period); m = min(n - i, len(b))
        y[i:i + m] += b[:m]; k += 1
    return y


def flatline(dur=1.5, f=1000):
    n = t2s(dur); t = np.arange(n) / SR
    return norm(np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.005) * np.minimum(1, (dur - t) / 0.4), 0.5)


def choir(dur=3.4, chord=(261.6, 329.6, 392.0, 523.3)):
    """heavenly 'aah' pad: detuned saws through a vowel-ish band, slow swell"""
    n = t2s(dur); t = np.arange(n) / SR; y = np.zeros(n)
    for f in chord:
        for det in (-0.006, 0.0, 0.007):
            vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + rng.random() * 6)
            y += 2 * ((np.cumsum(np.full(n, f * (1 + det)) * vib) / SR + rng.random()) % 1.0) - 1
    y = bp_fast(y.astype(np.float32), 500, 1400) + 0.3 * bp_fast(y.astype(np.float32), 2200, 3200)
    sw = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 0.05)
    return norm(y * sw, 0.6)


def harp(dur=1.3, root=261.6):
    """ascending harp glissando"""
    n = t2s(dur); y = np.zeros(n, np.float32)
    steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28]
    for k, s in enumerate(steps):
        f = root * 2 ** (s / 12); i = t2s(k * 0.055); m = min(n - i, t2s(0.9))
        tt = np.arange(m) / SR
        y[i:i + m] += (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 4.5)
    return norm(y, 0.55)


def twinkle(dur=0.6):
    n = t2s(dur); y = np.zeros(n, np.float32)
    for k, f in enumerate((1568, 2093, 2637, 3136)):
        i = t2s(k * 0.07); m = min(n - i, t2s(0.3)); tt = np.arange(m) / SR
        y[i:i + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 12)
    return norm(y, 0.4)


def birds(dur):
    """light morning birdsong (chirp sweeps)"""
    n = t2s(dur); y = np.zeros(n, np.float32); t = 0.1
    while t < dur - 0.2:
        m = t2s(rng.uniform(0.05, 0.12)); i = t2s(t)
        if i + m < n:
            tt = np.arange(m) / SR; f0 = rng.uniform(2800, 4200)
            f = f0 + rng.choice([-1, 1]) * 1400 * tt / (m / SR)
            y[i:i + m] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / (m / SR))
        t += rng.uniform(0.08, 0.5)
    return norm(y, 0.25)


# ------------------------------------------------------------------ mix
vo = load_mono(VO)
N = t2s(TOTAL)
mix = np.zeros(N, np.float32)
mix[:min(N, len(vo))] += vo[:N] * 1.0


def put(sig, t, gain=1.0):
    if VOICE_ONLY:
        return
    i = t2s(t)
    if i >= N:
        return
    m = min(N - i, len(sig))
    mix[i:i + m] += sig[:m] * gain


put(birds(2.5), 0.0, 0.35)                     # normal life
# scene-change whooshes
for t in (2.55, 7.25, 15.35, 22.85, 31.38, 38.80, 41.55):
    put(whoosh(), t - 0.18, 0.16)
# interjections: low boom (as in episode 1)
for t in (9.30, 16.81, 24.71, 33.23):
    put(boom(0.9, 55), t, 0.14)
# reveals: a short low hit right after each name
for t in (12.30, 15.00, 19.65, 22.52, 28.28, 31.02):
    put(boom(0.6, 48), t, 0.12)
put(keyboard(1.5), 5.30, 0.08)                 # Dale from IT
put(hiss(0.7), 7.35, 0.12)                     # bus doors
put(engine(5.2), 10.25, 0.06)                  # bus idling (driver + lap shots)
put(horn(), 12.35, 0.17)                       # after "...is LARRY." -> honk
put(boing(), 15.02, 0.22)                      # Dale on your lap
put(thud(0.5, 90, 45), 15.42, 0.15)             # box of desk stuff slammed down
put(squeak(0.6), 18.30, 0.12)                  # boss chair creaks...
put(whoosh(0.35, 500, 4000), 18.80, 0.22)      # ...and spins
put(beep(), 20.55, 0.1); put(beep(), 20.75, 0.1)  # vending buttons
put(clank(), 21.80, 0.22)                      # machine thunk
put(jets(1.4), 22.95, 0.06)                    # plane overhead (another country)
put(thud(0.35, 120, 70, 0.4), 26.25, 0.18)     # passport stamps
put(thud(0.35, 120, 70, 0.4), 26.72, 0.18)
put(bell(0.9, 1320), 28.30, 0.16)              # after "...is LARRY." -> ding
for k in range(6):                             # sniff sniff
    put(sniff(), 28.75 + k * 0.24, 0.1)
put(woof(), 31.05, 0.32)                       # after "DALE." -> woof
put(bell(1.4, 880), 31.45, 0.15); put(bell(1.4, 880), 31.75, 0.14)  # ding ding: fight!
put(slap(), 34.98, 0.32)                       # high five ("team up")
put(twinkle(), 35.85, 0.3)                     # matching T-shirts reveal
put(twinkle(), 37.30, 0.25)                    # your face
put(monitor(2.0), 38.85, 0.07)                 # hospital monitor...
put(flatline(1.6), 40.95, 0.09)                # ...after "die." flatline
put(harp(1.3), 41.55, 0.18)                     # heaven
put(choir(3.45), 41.60, 0.16)                  # choir swells, then cuts dead at the gate reveal
put(boom(0.8, 45), 45.72, 0.2)                 # after "LARRY." (angel)
put(boom(0.8, 42), 47.95, 0.22)                # after "DALE." (angel)
put(sting(1.6), 49.55, 0.62)                   # after "...waiting for you." -> jump-scare sting
# soft limiter
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
stereo = np.stack([mix, mix], axis=1)
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, len(mix) / SR, "s")
