"""Synthesizes every sound effect / ambience stem from src/timeline.json.

The ElevenLabs Sound Effects API is the first choice in the brief; this
account has no credits/key in this environment, so everything is built in
code with numpy (deterministic: same timeline -> same audio).

Writes 48 kHz stereo WAV stems to audio/sfx/:
  bed.wav      train rumble + clack-clack (rail joints match the camera bounce) + fan hum + rattles
  drone.wav    low horror drone with an intensity curve following the story
  heart.wav    heartbeat from scene 6, tempo rising toward scene 10
  events.wav   one-shots: phone buzz, distant horn, bangles, bass hits, bone cracks (twist)
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(1234)


def load():
    return json.loads((ROOT / "src/timeline.json").read_text())


def write(path, x):
    x = np.asarray(x, np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x / peak * 0.98
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def t_axis(n):
    return np.arange(n) / SR


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    from scipy.signal import lfilter
    return lfilter([1 - a], [1, -a], x, axis=0)


def bandpass(x, lo, hi, order=2):
    from scipy.signal import butter, sosfilt
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def lowpass(x, fc, order=2):
    from scipy.signal import butter, sosfilt
    sos = butter(order, fc, btype="low", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def highpass(x, fc, order=2):
    from scipy.signal import butter, sosfilt
    sos = butter(order, fc, btype="high", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def reverb(x, seconds=2.0, mix=0.3, damp=3000, seed=0):
    from scipy.signal import fftconvolve
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = t_axis(n)
    ir = r.standard_normal((n, 2)) * np.exp(-tt * 6.9 / seconds)[:, None]
    ir = lowpass(ir, damp)
    ir /= np.sqrt((ir ** 2).sum(0))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix


def pan(x, p):
    """p in [-1, 1]; equal-power."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def place(buf, clip, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    if clip.ndim == 1:
        clip = np.stack([clip, clip], 1)
    i1 = min(len(buf), i0 + len(clip))
    if i1 > i0 >= 0:
        buf[i0:i1] += clip[: i1 - i0] * gain


def env_curve(times, values, n):
    """Piecewise-linear automation over n samples."""
    return np.interp(t_axis(n), times, values)


# ---------------------------------------------------------------- one-shots

def clack(strength=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(0.45 * SR)
    tt = t_axis(n)
    f = 68 * (1 + 0.25 * np.exp(-tt / 0.02))
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.07)
    click = bandpass(r.standard_normal(n), 1200, 4200) * np.exp(-tt / 0.012) * 0.6
    ring = sum(np.sin(2 * np.pi * fr * tt + r.uniform(0, 6)) * a for fr, a in [(830, 0.12), (1320, 0.08), (2240, 0.05)]) * np.exp(-tt / 0.11)
    return (thump * 0.9 + click + ring) * strength


def buzz_clip():
    n = int(1.2 * SR)
    tt = t_axis(n)
    gate = ((tt < 0.38) | ((tt > 0.55) & (tt < 0.93))).astype(float)
    gate = lowpass(gate, 60)
    f = 172 + 3 * np.sin(2 * np.pi * 9 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.tanh(2.5 * np.sin(ph)) * 0.6 + 0.25 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    rattle = bandpass(rng.standard_normal(n), 900, 3000) * (0.5 + 0.5 * np.sign(np.sin(ph))) * 0.25
    body = lowpass(tone, 1800) + rattle
    surface = lowpass(np.sin(2 * np.pi * 118 * tt), 300) * 0.35
    return (body + surface) * gate


def horn_clip():
    """Distant Indian loco horn: two blasts, detuned chord, far + reverberant."""
    n = int(6.0 * SR)
    tt = t_axis(n)
    out = np.zeros(n)
    for start, dur in [(0.0, 1.35), (1.6, 0.75)]:
        e = np.clip((tt - start) / 0.12, 0, 1) * np.clip((start + dur - tt) / 0.25, 0, 1)
        for f0, a in [(311, 1.0), (392, 0.7)]:
            f = f0 * (1 + 0.004 * np.sin(2 * np.pi * 5 * tt))
            ph = 2 * np.pi * np.cumsum(f) / SR
            out += a * e * sum(np.sin(k * ph) / k ** 0.9 for k in range(1, 9))
    out = lowpass(out, 1400)
    out = highpass(out, 180)
    st = reverb(out * 0.5, seconds=3.2, mix=0.65, damp=1800, seed=3)
    return st


def bangles_clip(seed=0, count=6, spread=0.55):
    r = np.random.default_rng(seed)
    n = int(1.4 * SR)
    tt = t_axis(n)
    out = np.zeros((n, 2))
    times = np.sort(r.uniform(0, spread, count))
    for k, t0 in enumerate(times):
        f0 = r.uniform(2300, 3400)
        clip = np.zeros(n)
        for m, ratio in enumerate([1, 2.32, 4.25, 6.63]):
            dec = r.uniform(0.06, 0.22) / (1 + m * 0.6)
            clip += np.sin(2 * np.pi * f0 * ratio * tt + r.uniform(0, 6)) * np.exp(-tt / dec) * (0.9 / (1 + m))
        clip *= r.uniform(0.4, 1.0)
        i0 = int(t0 * SR)
        out[i0:] += pan(clip[: n - i0], r.uniform(-0.35, 0.35))
    rustle = bandpass(r.standard_normal(n), 2500, 7000) * np.exp(-((tt - spread / 2) ** 2) / 0.05) * 0.05
    out += np.stack([rustle, rustle], 1)
    return reverb(out * 0.5, seconds=0.9, mix=0.2, damp=6000, seed=seed + 9)


def hit_clip(strength=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(3.2 * SR)
    tt = t_axis(n)
    f = 32 + 90 * np.exp(-tt / 0.18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.1)
    punch = np.tanh(3 * np.sin(2 * np.pi * 72 * tt) * np.exp(-tt / 0.12)) * 0.5
    impact = lowpass(r.standard_normal(n), 900) * np.exp(-tt / 0.06) * 0.8
    air = bandpass(r.standard_normal(n), 300, 2500) * np.exp(-tt / 0.6) * 0.12
    x = sub * 1.0 + punch + impact + air
    st = reverb(x * strength, seconds=2.5, mix=0.25, damp=2500, seed=seed + 4)
    # short noise swell into the hit (reverse-style riser), placed by caller at -0.45s
    return st


def riser_clip(seconds=0.5, seed=0):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = t_axis(n)
    x = bandpass(r.standard_normal(n), 400, 5000) * (tt / seconds) ** 3
    return np.stack([x, x], 1) * 0.35


def crack_clip(seed=0):
    r = np.random.default_rng(seed)
    n = int(0.5 * SR)
    tt = t_axis(n)
    out = np.zeros(n)
    for k in range(r.integers(4, 9)):
        t0 = r.uniform(0, 0.25)
        i0 = int(t0 * SR)
        m = n - i0
        out[i0:] += bandpass(r.standard_normal(m), 900, 5000) * np.exp(-tt[:m] / r.uniform(0.003, 0.012)) * r.uniform(0.3, 1.0)
    creak = bandpass(r.standard_normal(n), 120, 600) * np.exp(-((tt - 0.2) ** 2) / 0.01) * 0.4
    return out + creak


def heartbeat(n_total, t_start, t_end, bpm0, bpm1, cuts):
    out = np.zeros(n_total)
    beat_n = int(0.5 * SR)
    bt = t_axis(beat_n)

    def thump(f0, dec, amp):
        f = f0 * (1 + 0.6 * np.exp(-bt / 0.015))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-bt / dec) * amp * (1 - np.exp(-bt / 0.004))

    t = t_start
    while t < t_end:
        u = (t - t_start) / max(1e-6, t_end - t_start)
        bpm = bpm0 + (bpm1 - bpm0) * u ** 1.3
        amp = 0.45 + 0.55 * u
        if not any(a <= t < b for a, b in cuts):
            for dt, f0, dec, a in [(0.0, 52, 0.11, 1.0), (0.27 * 60 / max(bpm, 60), 61, 0.09, 0.7)]:
                i0 = int((t + dt) * SR)
                clip = thump(f0, dec, a * amp)
                i1 = min(n_total, i0 + beat_n)
                if i0 < n_total:
                    out[i0:i1] += clip[: i1 - i0]
        t += 60.0 / bpm
    return lowpass(out, 220)


# ---------------------------------------------------------------- beds

def train_bed(n, rail):
    tt = t_axis(n)
    white = rng.standard_normal(n)
    brown = np.cumsum(white)
    brown = highpass(brown, 15) / 400
    rumble = lowpass(brown, 160) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.31 * tt))
    hum = 0.12 * np.sin(2 * np.pi * 37 * tt) + 0.05 * np.sin(2 * np.pi * 74 * tt + 1)
    wind = bandpass(rng.standard_normal(n), 300, 1100) * (0.06 + 0.03 * np.sin(2 * np.pi * 0.13 * tt))
    fan = (0.03 * np.sin(2 * np.pi * 100 * tt) + 0.015 * np.sin(2 * np.pi * 200 * tt)) * (0.7 + 0.3 * np.sin(7.4 * 3 * tt))
    fan += bandpass(rng.standard_normal(n), 500, 2500) * 0.012 * (0.6 + 0.4 * np.sin(7.4 * 3 * tt))
    bed = rumble * 1.4 + hum + wind + fan
    stereo = np.stack([bed, np.roll(bed, 480)], 1)
    # wheel impacts on rail joints (same schedule as the camera bounce)
    k = 0
    period, phase, hits = rail["period"], rail["phase"], rail["hits"]
    while True:
        t0 = phase + k * period
        if t0 > n / SR:
            break
        for j, off in enumerate(hits):
            s = 1.0 if j == 0 else 0.78
            c = clack(s * (0.9 + 0.1 * np.sin(k)), seed=k * 7 + j)
            place(stereo, pan(c, -0.15 if j == 0 else 0.15), t0 + off, 0.55)
            # far bogie echo
            place(stereo, pan(lowpass(c, 900), 0.3), t0 + off + 0.52, 0.18)
        k += 1
    # loose-fitting rattles
    for t0 in np.sort(rng.uniform(0, n / SR, int(n / SR * 1.5))):
        c = bandpass(rng.standard_normal(2400), 2000, 6000) * np.exp(-t_axis(2400) / 0.006) * 0.12
        place(stereo, pan(c, rng.uniform(-0.8, 0.8)), t0)
    return stereo


def drone(n, curve_t, curve_v):
    tt = t_axis(n)
    lvl = env_curve(curve_t, curve_v, n)
    out = np.zeros((n, 2))
    for f, a, p in [(55.0, 1.0, -0.3), (55.4, 0.8, 0.3), (82.4, 0.5, 0.0), (58.3, 0.35, 0.2), (110.2, 0.25, -0.2)]:
        ph = 2 * np.pi * f * tt + 0.3 * np.sin(2 * np.pi * 0.07 * tt + f)
        saw = sum(np.sin(k * ph) / k for k in range(1, 7))
        out += pan(saw * a, p)
    cut = 250 + 500 * lvl
    # time-varying lowpass approximated by blending two filtered copies
    lo = lowpass(out, 250)
    hi = lowpass(out, 900)
    w = ((cut - 250) / 650)[:, None]
    out = lo * (1 - w) + hi * w
    glass = (np.sin(2 * np.pi * 1760 * tt) + np.sin(2 * np.pi * 1866 * tt)) * 0.02 * lvl ** 2
    breath = bandpass(rng.standard_normal(n), 200, 1200) * 0.05 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * tt)) * lvl
    out += np.stack([glass + breath, glass * 0.8 + breath], 1)
    return out * lvl[:, None] * 0.35


def main():
    tl = load()
    dur = tl["duration"] + 0.6
    n = int(dur * SR)
    sc = {s["id"]: s for s in tl["scenes"]}
    out_dir = ROOT / "audio/sfx"
    out_dir.mkdir(parents=True, exist_ok=True)

    silence = sc["s09"].get("silence")
    cuts = [(silence["start"], silence["end"])] if silence else []

    def gate(x):
        g = np.ones(len(x))
        for a, b in cuts:
            tt = t_axis(len(x))
            g *= 1 - np.clip((tt - a) / 0.03, 0, 1) * np.clip((b - tt) / 0.01, 0, 1)
        return x * g[:, None] if x.ndim == 2 else x * g

    # bed: louder on the wide shots, quieter with eyes closed
    bed = train_bed(n, tl["rail"])
    pts = [(0, 0.8), (sc["s03"]["start"], 1.0), (sc["s04"]["start"], 0.8), (sc["s06"]["start"], 0.65), (sc["s09"]["start"], 0.6), (sc["s11"]["start"], 0.8), (sc["s12"]["start"], 0.95), (dur, 0.9)]
    bed *= env_curve([p[0] for p in pts], [p[1] for p in pts], n)[:, None]
    write(out_dir / "bed.wav", gate(bed))

    dpts = [(0, 0.15), (sc["s02"]["start"], 0.3), (sc["s04"]["start"], 0.45), (sc["s05"]["start"] + 3, 0.75), (sc["s06"]["start"], 0.6), (sc["s07"]["start"], 0.75), (sc["s08"]["start"], 0.95), (sc["s09"]["start"], 0.7), (sc["s10"]["start"], 1.0), (sc["s11"]["start"], 0.75), (sc["s12"]["start"], 0.85), (sc["s13"]["start"], 1.0), (dur, 1.0)]
    write(out_dir / "drone.wav", gate(drone(n, [p[0] for p in dpts], [p[1] for p in dpts])))

    hs = next(e["time"] for e in tl["events"] if e["type"] == "heartbeat_start")
    heart = heartbeat(n, hs, sc["s12"]["end"] - 0.3, 62, 122, cuts)
    hfade = env_curve([0, sc["s12"]["start"], sc["s12"]["end"], dur], [1, 1, 0.4, 0.2], n)
    write(out_dir / "heart.wav", gate(pan(heart * hfade, 0.0)))

    ev = np.zeros((n, 2))
    for e in tl["events"]:
        t = e["time"]
        if e["type"] == "buzz":
            place(ev, pan(buzz_clip(), 0.2), t, 0.55)
        elif e["type"] == "horn":
            place(ev, horn_clip(), t, 0.5)
        elif e["type"] == "bangles":
            place(ev, bangles_clip(seed=int(t * 10)), t, 0.6)
        elif e["type"] == "hit":
            place(ev, hit_clip(1.0, seed=int(t)), t, 0.9)
            if e["scene"] != "s10":  # s10 comes out of dead silence: no riser
                place(ev, riser_clip(0.45, seed=int(t)), t - 0.45, 0.8)
        elif e["type"] == "hit_soft":
            place(ev, hit_clip(0.5, seed=int(t) + 1), t, 0.6)
    # twist: bone cracks as every passenger's feet turn
    s13 = sc["s13"]
    r = np.random.default_rng(13)
    for k in range(9):
        t = s13["start"] + 0.2 + k * 0.17 + r.uniform(0, 0.08)
        place(ev, pan(crack_clip(seed=k), r.uniform(-0.7, 0.7)), t, 0.32)
    write(out_dir / "events.wav", gate(ev))
    print(f"stems written to {out_dir.relative_to(ROOT)} ({dur:.2f}s @ {SR} Hz)")


if __name__ == "__main__":
    sys.exit(main())
