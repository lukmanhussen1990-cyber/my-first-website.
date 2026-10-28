"""Sound design, 100% synthesised (noise + sine, no musical instruments), mixed
under the re-timed voiceover.  Reads timeline.json + vo_edit.wav, writes mix.wav."""
import json
import subprocess
import numpy as np
from scipy import signal

SR = 48000
TL = json.load(open("timeline.json"))
T = TL["T"]
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(7)


def tt(n):
    return np.arange(n) / SR


def noise(n):
    return rng.standard_normal(n).astype(np.float64)


def pink(n):
    # Voss-ish pink noise via spectral shaping
    w = np.fft.rfft(noise(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), n)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def sweep_bp(x, f0, f1, q=1.2, block=512, curve=1.0):
    """band-pass with a centre frequency that moves from f0 to f1 (block-wise SVF)."""
    out = np.zeros_like(x)
    n = len(x)
    low = band = 0.0
    for s in range(0, n, block):
        k = (s / max(1, n - 1)) ** curve
        fc = f0 * (f1 / f0) ** k
        F = 2 * np.sin(np.pi * min(fc, SR / 6) / SR)
        Q = 1 / q
        seg = x[s:s + block]
        o = np.empty_like(seg)
        for i, v in enumerate(seg):
            low += F * band
            high = v - low - Q * band
            band += F * high
            o[i] = band
        out[s:s + block] = o
    return out


def env_adsr(n, a, r, shape=2.0):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** shape
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** shape
    return e


def place(bus, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    x = x[:N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + len(x)] += x * gain * l * np.sqrt(2)
    bus[1, i:i + len(x)] += x * gain * r * np.sqrt(2)


def smoothstep(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1)
    return k * k * (3 - 2 * k)


def reverb(x, secs=2.2, wet=0.3):
    n = int(secs * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir = lp(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    out = signal.fftconvolve(x, ir)[:len(x)]
    return x * (1 - wet) + out * wet


time = tt(N)
sfx = np.zeros((2, N))

# --- 1. night wind: two band-passed pink-noise layers, slowly breathing ---------------
for ch, seed_shift in ((0, 0.0), (1, 1.7)):
    w = pink(N)
    a = bp(w, 180, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * time + seed_shift))
    b = bp(pink(N), 600, 2600) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * time + 2 + seed_shift)) * 0.35
    sfx[ch] += (a + b)
wind_level = (0.3 * smoothstep(0.0, 2.5, time)
              + 0.25 * smoothstep(T["dropExit"], T["dropExit"] + 1.5, time) * (1 - smoothstep(T["dropLand"] - 0.3, T["dropLand"] + 0.5, time))
              + 0.15 * smoothstep(T["rise"], T["rise"] + 0.6, time) * (1 - smoothstep(T["vesselBack"], T["vesselBack"] + 1.0, time)))
wind_level *= 1 - 0.55 * smoothstep(T["fill"], T["bright"], time) * (1 - smoothstep(T["settle"], T["rahma"], time))
sfx *= wind_level / np.max(np.abs(sfx)) * 0.5

# --- 2. whoosh as the drop falls -------------------------------------------------------
d = T["dropLand"] - T["dropExit"]
n = int(d * SR)
wh = sweep_bp(noise(n), 220, 1400, q=1.6, curve=2.0)
e = (np.linspace(0, 1, n) ** 2.2) * env_adsr(n, 0.3, 0.06, 1.0)
wh = wh / np.max(np.abs(wh)) * e
place(sfx, wh, T["dropExit"], 0.22, -0.1)
place(sfx, sweep_bp(noise(n), 260, 1600, q=1.8, curve=2.0) / 40 * e, T["dropExit"], 0.12, 0.2)

# --- 3. landing: water-drop plip + soft deep boom --------------------------------------
def plip(freq0=650, freq1=1500, dur=0.16):
    n = int(dur * SR)
    t = tt(n)
    f = freq0 * (freq1 / freq0) ** np.clip(t / 0.035, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 28) * env_adsr(n, 0.002, 0.02, 1)


p = plip()
p = reverb(np.concatenate([p, np.zeros(int(2.0 * SR))]), 1.8, 0.45)
place(sfx, p, T["splash"] - 0.01, 0.30)
place(sfx, reverb(np.concatenate([plip(900, 1900, 0.1), np.zeros(SR)]), 1.4, 0.5), T["splash"] + 0.21, 0.12, 0.3)
n = int(3.2 * SR)
t = tt(n)
boom = np.sin(2 * np.pi * np.cumsum(48 * np.exp(-t * 0.6) + 30) / SR) * np.exp(-t * 1.6)
boom += lp(noise(n), 120) * np.exp(-t * 4) * 2.5
boom *= env_adsr(n, 0.015, 0.4, 1.0)
place(sfx, boom / np.max(np.abs(boom)), T["splash"], 0.42)
# the light spreading: a long airy swell after the impact
n = int(5.5 * SR)
sw = bp(pink(n), 300, 3000)
sw = sw / np.max(np.abs(sw)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
place(sfx, sw, T["splash"] + 0.2, 0.08, 0.0)

# --- 4. slow heartbeat through the love scenes and the horse ---------------------------
def beat(strength=1.0):
    n = int(0.6 * SR)
    t = tt(n)
    def thump(t0, f, a):
        tt_ = np.clip(t - t0, 0, None)
        on = (t >= t0)
        return on * a * np.sin(2 * np.pi * f * tt_ * (1 - 0.25 * np.clip(tt_ / 0.12, 0, 1))) * np.exp(-tt_ * 22) * (1 - np.exp(-tt_ * 400))
    x = thump(0.0, 58, 1.0) + thump(0.27, 52, 0.7)
    return lp(x, 160) * strength


hb_start, hb_end = T["mother"] - 0.4, T["pullBack"] + 0.6
period = 60 / 60.0
tb = hb_start
while tb < hb_end:
    k = min(1, (tb - hb_start) / 3) * min(1, (hb_end - tb) / 1.5)
    k *= 1.0 + 0.35 * ((tb > T["horse"]) and (tb < T["pullBack"]))
    place(sfx, beat(), tb, 0.3 * k)
    tb += period

# --- 5. birdsong when the bird appears -------------------------------------------------
def chirp(f0, f1, dur, vib=0.0):
    n = int(dur * SR)
    t = tt(n)
    f = f0 + (f1 - f0) * (t / dur) + vib * np.sin(2 * np.pi * 38 * t) * f0 * 0.04
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return x * np.sin(np.pi * t / dur) ** 1.5


r = np.random.default_rng(3)
tb = T["bird"] + 0.3
while tb < T["bird"] + 4.6:
    # mother: short descending/rising phrases
    kind = r.random()
    if kind < 0.45:
        for j in range(r.integers(2, 5)):
            f0 = r.uniform(2600, 3600)
            place(sfx, chirp(f0, f0 * r.uniform(1.15, 1.45), r.uniform(0.05, 0.09), 1), tb + j * 0.085, 0.05, 0.25)
        tb += r.uniform(0.6, 1.1)
    else:
        # chicks: fast high peeps
        for j in range(r.integers(3, 7)):
            f0 = r.uniform(4200, 5200)
            place(sfx, chirp(f0, f0 * 0.9, 0.04), tb + j * 0.07, 0.035, 0.35)
        tb += r.uniform(0.4, 0.8)

# --- 6. the gathering: a soft inward rush into the one drop ----------------------------
n = int((T["oneDrop"] - T["gather"] + 0.3) * SR)
g = sweep_bp(noise(n), 2400, 300, q=1.4, curve=0.6)
g = g / np.max(np.abs(g)) * np.linspace(0, 1, n) ** 1.6 * env_adsr(n, 0.2, 0.25, 1)
place(sfx, g, T["gather"], 0.2)

# --- 7. warm rising whoosh as the 99 drops swirl and fill the screen --------------------
n = int((T["bright"] + 0.6 - T["swirl"]) * SR)
rw = sweep_bp(pink(n), 160, 2200, q=1.0, curve=1.4)
rw = rw / np.max(np.abs(rw))
rw *= (np.linspace(0, 1, n) ** 1.8) * env_adsr(n, 0.5, 0.5, 1)
bed = lp(pink(n), 400)
bed = bed / np.max(np.abs(bed)) * np.linspace(0, 1, n) ** 2
x = rw * 0.9 + bed * 0.5
place(sfx, x, T["swirl"], 0.36, -0.15)
place(sfx, sweep_bp(pink(n), 180, 2500, q=1.0, curve=1.4) / 120 * (np.linspace(0, 1, n) ** 1.8) * env_adsr(n, 0.5, 0.5, 1), T["swirl"], 0.15, 0.25)
# long airy tail of the light settling
n = int(5 * SR)
tail = bp(pink(n), 250, 2500)
tail = tail / np.max(np.abs(tail)) * np.exp(-np.linspace(0, 5, n) * 0.9) * env_adsr(n, 0.05, 1.0, 1)
place(sfx, tail, T["bright"] + 0.5, 0.25)

# --- voice + mix ------------------------------------------------------------------------
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "vo_edit.wav", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, dtype=np.float32).astype(np.float64)[:N]
vo = np.pad(vo, (0, N - len(vo)))
vo = hp(vo, 70)
vo = vo / np.max(np.abs(vo)) * 0.8

# duck the effects a little under the voice
venv = lp(np.abs(vo), 6, 1)
venv = venv / (np.max(venv) + 1e-9)
duck = 1 - 0.55 * np.clip(venv * 4, 0, 1)
sfx *= duck
# effects bus: gentle reverb glue
sfx[0] = reverb(sfx[0], 1.6, 0.2)
sfx[1] = reverb(sfx[1], 1.6, 0.2)

mix = sfx + vo[None, :]
# fade in / out
fade = smoothstep(0, 0.4, time) * (1 - smoothstep(T["fadeOut"], DUR - 0.05, time))
mix *= fade
mix /= max(1.0, np.max(np.abs(mix)) / 0.95)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", "mix.wav"],
               input=pcm, check=True)
print("sfx peak", np.max(np.abs(sfx)), "vo peak", np.max(np.abs(vo)))

if __name__ == "__main__":
    import sys
    if "--stats" in sys.argv:
        g = 1 / max(1.0, np.max(np.abs(sfx + vo[None, :])) / 0.95)
        db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
        print("2s windows: voice dB / effects dB")
        print(" ".join(f"{a}:{db(vo[a*SR:(a+2)*SR]*g):.0f}/{db(sfx[:, a*SR:(a+2)*SR].mean(0)*g):.0f}" for a in range(0, 68, 2)))
