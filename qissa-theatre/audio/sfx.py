# Sound design, 100% synthesized (no samples, no instruments), mixed under the
# voiceover. Reads timeline/events.json, writes audio/mix.wav.
#   python3 audio/sfx.py audio/voiceover.mp3 audio/mix.wav
import json, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
HERE = __file__.rsplit("/", 1)[0]
EV = json.load(open(f"{HERE}/../timeline/events.json"))
E, END, OFFSET = EV["E"], EV["END"], EV["OFFSET"]
SC = {s["id"]: s for s in EV["scenes"]}
N = int(END * SR) + SR
R = np.random.default_rng(7)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(n):
    return R.standard_normal(n)


def env_ramp(n, a, b):
    """Linear fade-in over a samples, fade-out over b samples."""
    e = np.ones(n)
    a, b = min(a, n), min(b, n)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[n - b:] *= np.linspace(1, 0, b)
    return e


def place(bus, x, t, pan=0.0):
    """Add mono or stereo signal x at time t (s) into stereo bus."""
    i = int(t * SR)
    if i >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    j = min(N, i + len(x))
    if i < 0:
        x, i = x[-i:], 0
    bus[i:j] += x[: j - i]


def secs(t0, t1):
    return int(max(0, t1 - t0) * SR)


def slow_lfo(n, rate, seed):
    rr = np.random.default_rng(seed)
    k = max(4, int(n / SR * rate) + 4)
    pts = rr.random(k)
    return np.interp(np.arange(n) / SR * rate, np.arange(k), pts)


def reverb(x, length=1.6, decay=3.0, wet=0.35, seed=1):
    rr = np.random.default_rng(seed)
    n = int(length * SR)
    ir = rr.standard_normal(n) * np.exp(-decay * np.arange(n) / SR)
    ir = lp(ir, 3500)
    ir /= np.sqrt(np.sum(ir ** 2))
    y = fftconvolve(x, ir)[: len(x) + n]
    out = np.zeros(len(y))
    out[: len(x)] += x * (1 - wet)
    return out + y * wet


# ------------------------------------------------------------------ layers --
def wind():
    """Soft wind for the whole reel, louder outdoors and in the storm."""
    out = np.zeros((N, 2))
    level = np.full(N, 0.013)
    def setl(a, b, v):
        level[int(a * SR):int(b * SR)] = v
    setl(SC["storm"]["s"], SC["rock"]["e"], 0.03)
    setl(SC["moral"]["s"], END, 0.014)
    setl(SC["third"]["s"], SC["third"]["e"], 0.014)
    for k in ("hook", "inside", "dua1", "dua2"):
        setl(SC[k]["s"], SC[k]["e"], 0.012)
    level = lp(level, 1.5, 1)
    for ch, seed in ((0, 11), (1, 12)):
        n = lp(noise(N), 420, 2)
        gust = 0.45 + 0.55 * slow_lfo(N, 0.25, seed) + 0.2 * slow_lfo(N, 1.1, seed + 5)
        out[:, ch] = n * gust * level * 6
    return out


def rain():
    t0, t1 = SC["storm"]["s"], SC["rock"]["e"]
    n = secs(t0, t1)
    out = np.zeros((n, 2))
    for ch in range(2):
        hiss = bp(noise(n), 900, 7000) * 0.6 + lp(noise(n), 900) * 0.25
        drops = np.zeros(n)
        idx = R.integers(0, n, int((t1 - t0) * 900))
        drops[idx] = R.uniform(0.3, 1.0, len(idx)) * R.choice([-1, 1], len(idx))
        drops = bp(drops, 2000, 9000) * 0.9
        out[:, ch] = hiss + drops
    e = env_ramp(n, int(1.0 * SR), int(0.6 * SR))
    e *= 0.85 + 0.15 * slow_lfo(n, 0.7, 3)
    return out * e[:, None] * 0.03, t0


def thunder(close):
    n = int(3.6 * SR)
    t = np.arange(n) / SR
    body = lp(noise(n), 110 if not close else 160, 3)
    roll = 0.6 + 0.4 * np.abs(np.sin(t * 2.1 + R.random() * 3)) * np.exp(-t * 0.4)
    e = (1 - np.exp(-t * 18)) * np.exp(-t * 1.0)
    x = body * e * roll * 9
    if close:
        crack = bp(noise(n), 300, 2400) * np.exp(-t * 7) * (t < 0.6) * 1.2
        x += crack
    return x * (0.15 if close else 0.09)


def rumble(dur, intensity=1.0, bumps=0.0):
    """Deep rock rumble + grinding gravel for a moving boulder."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    low = lp(noise(n), 90, 3) * 5
    sub = np.sin(2 * np.pi * (38 + 6 * slow_lfo(n, 3, 21)) * t) * 0.5
    grind = bp(noise(n), 180, 1100) * (0.4 + 0.6 * slow_lfo(n, 14, 22))
    gravel = np.zeros(n)
    idx = R.integers(0, n, int(dur * 120))
    gravel[idx] = R.uniform(0.2, 1, len(idx))
    gravel = bp(gravel, 900, 4000) * 2.5
    x = low + sub + grind * 0.8 + gravel * 0.5
    if bumps:
        k = np.zeros(n)
        for tb in np.arange(0.1, dur, bumps):
            i = int(tb * SR)
            m = min(n - i, int(0.25 * SR))
            tt = np.arange(m) / SR
            k[i:i + m] += np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 18)
        x += k * 1.2
    e = env_ramp(n, int(0.25 * SR), int(0.35 * SR))
    return x * e * 0.075 * intensity


def thud():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    f = 30 + 45 * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t * 3.2)
    hit = lp(noise(n), 260, 2) * np.exp(-t * 16) * 3
    debris = np.zeros(n)
    idx = R.integers(int(0.05 * SR), int(1.4 * SR), 160)
    debris[idx] = R.uniform(0.2, 1, 160) * np.exp(-idx / SR * 2.5)
    debris = bp(debris, 700, 3500) * 2
    return (boom * 0.9 + hit * 0.5 + debris * 0.35) * 0.5


def drip():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f0 = R.uniform(900, 1300)
    f = f0 + f0 * 1.3 * (1 - np.exp(-t * 60))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 55)
    return x * 0.13


def crickets(t0, t1, level=1.0):
    n = secs(t0, t1)
    out = np.zeros((n, 2))
    t = np.arange(n) / SR
    for ch, (f, rate, seed) in enumerate(((4650, 0.72, 31), (4300, 0.9, 32))):
        rr = np.random.default_rng(seed)
        carrier = np.sin(2 * np.pi * f * t)
        am = np.zeros(n)
        tc = rr.uniform(0, 0.5)
        while tc < t1 - t0:
            for p in range(rr.integers(3, 5)):
                i = int((tc + p * 0.032) * SR)
                m = int(0.022 * SR)
                if i + m < n: am[i:i + m] += np.sin(np.pi * np.arange(m) / m) ** 2
            tc += rate * rr.uniform(0.8, 1.25)
        out[:, ch] = carrier * am
        out[:, 1 - ch] += carrier * am * 0.35
    e = env_ramp(n, int(0.8 * SR), int(0.8 * SR))
    return out * e[:, None] * 0.026 * level


def bird_call(seed):
    rr = np.random.default_rng(seed)
    parts = []
    for _ in range(rr.integers(2, 6)):
        d = rr.uniform(0.05, 0.14)
        m = int(d * SR)
        t = np.arange(m) / SR
        f0, f1 = rr.uniform(2600, 4200), rr.uniform(2400, 5200)
        f = f0 + (f1 - f0) * (t / d) + 300 * np.sin(2 * np.pi * rr.uniform(20, 45) * t)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 1.5
        parts.append(x)
        parts.append(np.zeros(int(rr.uniform(0.03, 0.09) * SR)))
    return np.concatenate(parts)


def birds(t0, t1, density=1.0, level=1.0):
    n = secs(t0, t1)
    out = np.zeros((n, 2))
    tc = 0.2
    k = 0
    while tc < (t1 - t0) - 0.6:
        x = bird_call(100 + k) * 0.05 * level
        pan = R.uniform(-0.8, 0.8)
        i = int(tc * SR)
        m = min(len(x), n - i)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        out[i:i + m, 0] += x[:m] * l
        out[i:i + m, 1] += x[:m] * r
        tc += R.uniform(0.35, 1.1) / density
        k += 1
    e = env_ramp(n, int(0.6 * SR), int(0.5 * SR))
    return out * e[:, None]


def whoosh(dur=1.4, lo=250, hi=1600, level=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n)
    y = np.zeros(n)
    # sweep a band through the noise in blocks
    blk = 1024
    for i in range(0, n, blk):
        u = i / n
        c = lo * (hi / lo) ** np.sin(np.pi * u * 0.5)
        y[i:i + blk] = bp(x[max(0, i - 4096):i + blk], c * 0.6, c * 1.6)[-min(blk, n - i):]
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return y * e * 0.09 * level


def clack():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 70) + np.sin(2 * np.pi * 1730 * t) * np.exp(-t * 110) * 0.5
    return x * 0.05


# --------------------------------------------------------------------- mix --
def main():
    voice_src, out_path = sys.argv[1], sys.argv[2]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", voice_src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    v = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    voice = np.zeros(N)
    i0 = int(OFFSET * SR)
    voice[i0:i0 + len(v)] = v[: N - i0]

    fx = np.zeros((N, 2))
    fx += wind()
    r, t0 = rain(); place(fx, r, t0)
    for k, f in enumerate(E["flashes"]):
        place(fx, thunder(close=k in (1, 3)), f + (0.35 if k in (1, 3) else 0.9), pan=R.uniform(-0.5, 0.5))
    # boulder: the roll down the slope, the seal, then the three openings
    place(fx, rumble(E["thud"] - E["rollStart"] + 0.2, 0.75, bumps=0.32), E["rollStart"], pan=0.3)
    place(fx, thud(), E["thud"] - 0.02)
    for (a, b), k in ((E["dua1Move"], 0.7), (E["dua2Move"], 0.85), (E["dua3Move"], 1.15)):
        place(fx, rumble(b - a + 0.3, k), a - 0.1)
    # cave: drips with a cave echo
    cave = np.zeros(N)
    for td in E["drips"]:
        x = drip(); i = int(td * SR); cave[i:i + len(x)] += x[: N - i]
    cave = reverb(cave, 1.8, 2.6, 0.55, 5)[:N]
    fx[:, 0] += cave * 0.9; fx[:, 1] += cave
    # night crickets, morning birds
    place(fx, crickets(SC["first"]["s"], E["sunRise"][0] + 1.2), SC["first"]["s"])
    place(fx, crickets(SC["second"]["s"], SC["second"]["e"], 0.8), SC["second"]["s"])
    place(fx, birds(E["sunRise"][1] - 1.0, SC["first"]["e"], 1.2, 0.8), E["sunRise"][1] - 1.0)
    place(fx, birds(SC["third"]["s"], SC["third"]["e"], 1.0, 1.0), SC["third"]["s"])
    place(fx, birds(E["dua3Move"][1] - 0.6, SC["dua3"]["e"], 1.6, 1.0), E["dua3Move"][1] - 0.6)
    place(fx, birds(SC["moral"]["s"], E["curtain"][1], 1.0, 1.0), SC["moral"]["s"])
    # wooden clacks when puppets land on the stage
    for d in E["drops"]:
        place(fx, clack(), d + 0.5, pan=R.uniform(-0.3, 0.3))
    for k in range(7):
        place(fx, clack() * 0.8, E["herd"][0] + (E["herd"][1] - 0.5 - E["herd"][0]) * k / 6 + 0.45, pan=R.uniform(-0.2, 0.6))
    # light-slit whooshes and the closing curtain
    place(fx, whoosh(1.2, 200, 900, 0.5), E["titleOpen"][0])
    place(fx, whoosh(0.9, 900, 250, 0.5), E["slitClose"][0])
    place(fx, whoosh(1.6, 220, 1500, 1.2), E["curtain"][0] - 0.05)

    # duck the effects under the voice
    venv = np.sqrt(lp(voice ** 2, 6, 1).clip(0))
    duck = 1 - 0.5 * np.clip(venv / 0.05, 0, 1)
    fx *= duck[:, None]

    if len(sys.argv) > 3:  # optional stems for level checks
        import soundfile as sf
        sf.write(sys.argv[3] + "_fx.wav", fx[: int(END * SR)].astype(np.float32), SR, subtype="FLOAT")
        sf.write(sys.argv[3] + "_vo.wav", voice[: int(END * SR)].astype(np.float32), SR, subtype="FLOAT")
    mix = fx + voice[:, None]
    # fade out at the very end
    fade = np.clip((END - np.arange(N) / SR) / 2.4, 0, 1)
    mix *= fade[:, None]
    mix = mix[: int(END * SR)]
    peak = np.max(np.abs(mix))
    mix *= 0.89 / peak
    import soundfile as sf
    sf.write(out_path, mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"wrote {out_path}: {len(mix) / SR:.2f}s, peak scale {0.89 / peak:.3f}")


if __name__ == "__main__":
    main()
