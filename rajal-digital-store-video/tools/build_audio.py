#!/usr/bin/env python3
"""Build the soundtrack: Bengali voice-over + synthesized music bed + sound effects.

Everything except the voice is synthesized here with numpy/scipy (no samples, no licences).
Cues come from build/timeline.json (voice-over) and build/sfx_events.json (animation hits,
exported by tools/render_frames.cjs). Output: build/mix.wav (48 kHz stereo, 16-bit).

    python tools/build_audio.py
"""
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
TL = json.loads((ROOT / "build/timeline.json").read_text(encoding="utf-8"))
EV = json.loads((ROOT / "build/sfx_events.json").read_text(encoding="utf-8"))
DUR = TL["duration"]
N = int(round(DUR * SR))
BEAT = TL["beat"]
rng = np.random.default_rng(20261008)


# ----------------------------------------------------------------------------- basics
def _sos(kind, fc, order):
    return signal.butter(order, fc, btype=kind, fs=SR, output="sos")


def lp(x, fc, order=2):
    return signal.sosfilt(_sos("low", fc, order), x, axis=-1)


def hp(x, fc, order=2):
    return signal.sosfilt(_sos("high", fc, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR / 2 - 200)], btype="band", fs=SR, output="sos"), x, axis=-1)


def tt(n):
    return np.arange(n) / SR


def edb(db):
    return 10 ** (db / 20)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def atk(n, a):
    e = np.ones(n)
    k = min(n, max(1, int(a * SR)))
    e[:k] = np.linspace(0, 1, k)
    return e


def rel(n, r):
    e = np.ones(n)
    k = min(n, max(1, int(r * SR)))
    e[-k:] = np.linspace(1, 0, k)
    return e


def pan_gains(p):
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


class Bus:
    """Stereo accumulation buffer."""

    def __init__(self):
        self.b = np.zeros((2, N))

    def add(self, x, t0, g=1.0, pan=0.0):
        i0 = int(round(t0 * SR))
        if x.ndim == 1:
            l, r = pan_gains(pan)
            x = np.stack([x * l, x * r])
        a, b = max(0, i0), min(N, i0 + x.shape[1])
        if b > a:
            self.b[:, a:b] += g * x[:, a - i0:b - i0]


def make_ir(rt60=1.6, pre=0.014, lo=220, hi=6500, seed=1):
    r = np.random.default_rng(seed)
    n = int(rt60 * 1.15 * SR)
    t = tt(n)
    ir = np.stack([r.standard_normal(n) for _ in range(2)]) * np.exp(-t / (rt60 / 6.9))
    ir = hp(lp(ir, hi, 2), lo, 1)
    ir = np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)
    return ir / (np.sqrt((ir ** 2).sum(axis=1, keepdims=True)) + 1e-9)


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)])


def rms_db(x):
    return 20 * math.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


# ----------------------------------------------------------------------------- sound effects
PENTA = [0, 2, 4, 7, 9]


def penta_midi(n, base=72):
    n = int(n) % 10
    return base + 12 * (n // 5) + PENTA[n % 5]


def marimba(f, dur=.55, tau=.17, bright=1.0):
    n = int(dur * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    x += .38 * bright * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / .05)
    x += .10 * bright * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / .014)
    x += .16 * bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t / .004)
    return x * atk(n, .0015)


def bell(f, dur=1.8, tau=1.5):
    n = int(dur * SR)
    t = tt(n)
    x = sum(a * np.sin(2 * np.pi * f * r * t + ph) * np.exp(-t / (tau * d))
            for r, a, d, ph in [(1, 1, 1, 0), (2.01, .45, .55, .3), (2.76, .32, .45, 1.1), (4.07, .2, .3, 2.0), (5.43, .14, .22, .7)])
    return x * atk(n, .001)


def sweep_noise(dur, f0, f1, shape="bell", K=12, width=.2, pan0=0.0, pan1=0.0):
    n = int(dur * SR)
    t = tt(n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    for k, c in enumerate(np.geomspace(f0, f1, K)):
        g = np.exp(-((t - dur * k / (K - 1)) / (dur * width)) ** 2)
        out += g * bp(noise, c / 1.35, c * 1.35, 2)
    u = np.clip(t / dur, 0, 1)
    env = np.sin(np.pi * u) ** 1.3 if shape == "bell" else (u ** 2.2 if shape == "rise" else 1 - u)
    out *= env
    out /= np.max(np.abs(out)) + 1e-9
    a = (pan0 + (pan1 - pan0) * u + 1) * np.pi / 4
    return np.stack([out * np.cos(a), out * np.sin(a)])


def thumps(times, amps, f=190, tau=.09):
    n = int((max(times) + .5) * SR)
    x = np.zeros(n)
    for tm, a in zip(times, amps):
        i = int(tm * SR)
        m = n - i
        t = tt(m)
        x[i:] += a * np.sin(2 * np.pi * (f + 110 * np.exp(-t / .02)) * t) * np.exp(-t / tau)
    return x


def sfx(ev):
    ty, n, dur = ev["type"], ev.get("n", 0), ev.get("dur", .8)
    pan = float(rng.uniform(-.25, .25))
    if ty == "pop":
        return marimba(midi(penta_midi(n, 72)), .55, .17), pan, -14
    if ty == "tick":
        return marimba(midi(penta_midi(n, 79)), .32, .09), pan, -19
    if ty == "ding":
        x = bell(midi(88))
        x[:int(.09 * SR) * 0] += 0
        y = np.zeros(int(2.0 * SR))
        y[:len(x)] += x
        b2 = bell(midi(95), 1.6, 1.2) * .6
        y[int(.09 * SR):int(.09 * SR) + len(b2)] += b2
        return y, 0.0, -17
    if ty == "chime":
        y = np.zeros(int(2.2 * SR))
        for i, m in enumerate([84, 88, 91, 96]):
            b = bell(midi(m), 1.6, 1.0) * (1 - i * .1)
            o = int(i * .11 * SR)
            y[o:o + len(b)] += b
        return y, 0.0, -16
    if ty == "sparkle":
        y = np.zeros((2, int(1.0 * SR)))
        for _ in range(12):
            b = bell(midi(penta_midi(int(rng.integers(5, 10)), 84)), .5, .35) * rng.uniform(.4, 1)
            o = int(rng.uniform(0, .45) * SR)
            p = rng.uniform(-.8, .8)
            l, r = pan_gains(p)
            y[0, o:o + len(b)] += b * l
            y[1, o:o + len(b)] += b * r
        return y, 0.0, -24
    if ty == "whoosh":
        x = sweep_noise(dur, 120 if ev.get("lo") else 200, 3000 if ev.get("lo") else 5200, "bell", pan0=-.7, pan1=.7)
        return x, 0.0, -15
    if ty == "swish":
        return sweep_noise(dur, 1500, 8000, "bell", pan0=-.5, pan1=.5), 0.0, -26
    if ty == "flip":
        x = sweep_noise(dur, 500, 4000, "bell", pan0=-.3, pan1=.3)
        return x, 0.0, -20
    if ty == "riser":
        return sweep_noise(dur, 300, 9000, "rise", pan0=-.3, pan1=.3), 0.0, -19
    if ty == "plane":
        x = sweep_noise(dur, 250, 2600, "bell", K=16, width=.16, pan0=-.8, pan1=.8)
        t = tt(x.shape[1])
        hum = (np.sin(2 * np.pi * 92 * t) + .5 * np.sin(2 * np.pi * 184 * t)) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2 * .35
        return x + hum, 0.0, -16
    if ty == "impact":
        m = int(1.8 * SR)
        t = tt(m)
        boom = np.sin(2 * np.pi * (46 + 70 * np.exp(-t / .07)) * t) * np.exp(-t / .5)
        body = lp(rng.standard_normal(m), 1400) * np.exp(-t / .13)
        crack = hp(rng.standard_normal(m), 3500) * np.exp(-t / .03) * .35
        return boom + .45 * body + crack, 0.0, -9
    if ty == "stamp":
        m = int(.6 * SR)
        t = tt(m)
        thud = np.sin(2 * np.pi * (68 + 140 * np.exp(-t / .03)) * t) * np.exp(-t / .15)
        slap = bp(rng.standard_normal(m), 800, 3600) * np.exp(-t / .022)
        return thud + .8 * slap, 0.0, -8
    if ty == "click":
        m = int(.08 * SR)
        t = tt(m)
        x = bp(rng.standard_normal(m), 2000, 7000) * np.exp(-t / .004) + .5 * np.sin(2 * np.pi * 1500 * t) * np.exp(-t / .012)
        return x, 0.0, -17
    if ty == "drop":
        return thumps([0, .17, .29, .37], [1, .55, .3, .15]), 0.0, -12
    if ty == "neon":
        m = int(.55 * SR)
        t = tt(m)
        flick = np.interp(t, [0, .06, .12, .18, .24, .36, .55], [.9, .15, 1, .3, .95, 1, .6])
        buzz = (np.sign(np.sin(2 * np.pi * 120 * t)) * .4 + np.sin(2 * np.pi * 240 * t) * .3) * flick
        buzz = lp(buzz + .1 * rng.standard_normal(m), 2500)
        ping = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / .12) * (t > .24) * .6
        return buzz * np.exp(-t / .4) + ping, 0.0, -20
    return np.zeros(10), 0.0, -60


# ----------------------------------------------------------------------------- voice-over
def load_mono(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def process_vo(x):
    x = hp(x, 90, 2)
    x = x + .22 * bp(x, 2500, 5500, 2)                                  # a touch of presence
    env = np.sqrt(np.convolve(x ** 2, np.ones(480) / 480, "same"))
    speech = x[env > .3 * np.sqrt(np.mean(x ** 2))]
    x = x * edb(-19) / (np.sqrt(np.mean(speech ** 2)) + 1e-9)
    return np.tanh(x * 1.15) / 1.15


def build_vo():
    bus = Bus()
    for c in TL["clips"]:
        bus.add(process_vo(load_mono(ROOT / c["file"])), c["start"], 1.0, 0.0)
    return bus.b


def duck_curve(vo, depth_db=-8.0):
    """Control signal (1 = full music, <1 = ducked) following where the voice is speaking."""
    mono = np.abs(vo).mean(axis=0)
    hop = SR // 200
    env = np.sqrt(np.convolve(mono ** 2, np.ones(hop * 4) / (hop * 4), "same"))[::hop]
    active = (env > edb(-46)).astype(float)
    sm = np.zeros_like(active)
    cur = 0.0
    for i, a in enumerate(active):
        k = 1 - math.exp(-1 / (200 * (.05 if a > cur else .38)))
        cur += (a - cur) * k
        sm[i] = cur
    ctl = 1 - (1 - edb(depth_db)) * sm
    return np.interp(np.arange(N) / SR, np.arange(len(ctl)) / 200, ctl)


# ----------------------------------------------------------------------------- music
CH = {  # name: (pad notes, arpeggio notes, bass midi)
    "Am": ([57, 60, 64], [69, 72, 76, 81], 45),
    "F": ([53, 57, 60], [65, 69, 72, 77], 41),
    "C": ([60, 64, 67], [72, 76, 79, 84], 48),
    "G": ([55, 59, 62], [67, 71, 74, 79], 43),
}
LEAD = {  # chord -> [(start beat, midi, length)] — pentatonic phrase
    "Am": [(0, 76, 1.0), (1, 74, .5), (1.5, 72, .5), (2, 69, 1.0), (3, 72, 1.0)],
    "F": [(0, 72, 1.5), (1.5, 74, .5), (2, 76, 1.0), (3, 74, 1.0)],
    "C": [(0, 79, 1.0), (1, 76, .5), (1.5, 79, .5), (2, 81, 1.5), (3.5, 79, .5)],
    "G": [(0, 76, 1.5), (1.5, 74, .5), (2, 72, 1.0), (3, 74, 1.0)],
}


def saw(f, n, ph=0.0):
    return 2 * (((f * tt(n)) + ph) % 1.0) - 1


def pad_note(m, dur, cutoff, detune=.004):
    n = int(dur * SR)
    f = midi(m)
    l = saw(f * (1 + detune), n) + saw(f * (1 - detune * .6), n, .3)
    r = saw(f * (1 - detune), n, .5) + saw(f * (1 + detune * .6), n, .8)
    x = lp(np.stack([l, r]), cutoff, 2) * .5
    return x * atk(n, .35) * rel(n, .5)


def pluck(m, dur=.55):
    n = int(dur * SR)
    t = tt(n)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * 2 * f * t) + .18 * np.sin(2 * np.pi * 3 * f * t) + .08 * np.sin(2 * np.pi * 5 * f * t))
    x *= np.exp(-t / .16) * atk(n, .002)
    return lp(x, 4200, 2)


def flute(m, dur, vib=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = midi(m) * (1 + .0045 * vib * np.sin(2 * np.pi * 5.4 * t) * np.clip(t / .25, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + .22 * np.sin(2 * ph) + .06 * np.sin(3 * ph)
    breath = bp(rng.standard_normal(n), 3000, 7000) * .05
    return (x + breath) * atk(n, .045) * rel(n, .16)


def kick():
    n = int(.4 * SR)
    t = tt(n)
    x = np.sin(2 * np.pi * (46 + 90 * np.exp(-t / .035)) * t) * np.exp(-t / .16)
    x += .25 * bp(rng.standard_normal(n), 1800, 6000) * np.exp(-t / .004)
    return x


def clap():
    n = int(.3 * SR)
    t = tt(n)
    x = np.zeros(n)
    for o in (0, .011, .023):
        i = int(o * SR)
        x[i:] += bp(rng.standard_normal(n - i), 900, 3800) * np.exp(-t[:n - i] / .012)
    x += bp(rng.standard_normal(n), 900, 3800) * np.exp(-t / .09) * .55
    return x * .8


def hat(open_=False):
    n = int((.16 if open_ else .05) * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 7000) * np.exp(-t / (.07 if open_ else .014))


def chord_segments(t_final):
    cyc = ["Am", "F", "C", "G"]
    segs, b = [], 0
    final_b = t_final / BEAT
    while b * BEAT < t_final - 1e-6:
        name = cyc[(b // 4) % 4]
        end = b + 4
        if b >= 44:
            name, end = "G", final_b            # dominant held until the closing chord
        segs.append((b, min(end, final_b), name))
        b = end if end == int(end) else int(end) + 1
        if b >= final_b:
            break
    return segs


def scene_start(sid):
    return next(s["start"] for s in TL["scenes"] if s["id"] == sid)


def render_music(t_final):
    dry, wet = Bus(), Bus()                      # wet = goes to the reverb send
    pan_t = scene_start("pan")
    flight_t, cta_t, outro_t = scene_start("flight"), scene_start("cta"), scene_start("outro")
    segs = chord_segments(t_final)

    def lvl(t, pts):
        return float(np.interp(t, [p[0] for p in pts], [p[1] for p in pts]))

    # pads + arps + bass + lead, per chord segment
    for (b0, b1, name) in segs:
        t0, t1 = b0 * BEAT, b1 * BEAT
        pad_notes, arp_notes, bass_m = CH[name]
        cutoff = lvl(t0, [(0, 700), (pan_t, 1100), (flight_t, 1500), (cta_t, 2000), (outro_t, 1700)])
        for m in pad_notes + [pad_notes[0] - 12]:
            wet.add(pad_note(m, t1 - t0 + .5, cutoff), t0, .22 * (1.0 if m >= 50 else .8))
        # 8th-note pluck arpeggio
        pat = [0, 2, 1, 2, 3, 2, 1, 2]
        for k in range(int((b1 - b0) * 2)):
            tn = t0 + k * BEAT / 2
            if tn < 1.0 or tn >= t_final:
                continue
            g = lvl(tn, [(1.0, .35), (pan_t, .55), (flight_t, .75), (cta_t, .9)]) * (1.0 if k % 2 == 0 else .72)
            m = arp_notes[pat[(k + int(b0 * 2)) % 8]]
            x = pluck(m)
            p = -.35 if (k % 2 == 0) else .35
            dry.add(x, tn, .2 * g, p)
            for d, a in ((.75, .5), (1.5, .26), (2.25, .13)):          # dotted-eighth echo
                wet.add(x, tn + d * BEAT, .2 * g * a, -p)
        # bass (from the first groove bar)
        if t0 >= pan_t - .01:
            for bs, ln in ((0, 1.2), (1.5, 1.1), (3.0, .9)):
                tb = t0 + bs * BEAT
                if tb >= t_final - .05 or tb >= t1:
                    continue
                n = int(min(ln * BEAT, t1 - tb + .1) * SR)
                t = tt(n)
                f = midi(bass_m)
                x = (np.sin(2 * np.pi * f * t) + .28 * np.sin(2 * np.pi * 2 * f * t) + .18 * np.sin(2 * np.pi * .5 * f * t)) * atk(n, .008) * rel(n, .06)
                dry.add(x, tb, .42)
    # drums: from the PAN scene until the closing chord
    b = int(math.ceil(pan_t / BEAT - 1e-6))
    while b * BEAT < t_final - BEAT * .9:
        tb = b * BEAT
        dry.add(kick(), tb, .55)
        if b % 4 in (1, 3):
            dry.add(clap(), tb, .28, .05)
        h = hat()
        dry.add(h, tb + BEAT / 2, .085, .3)
        if b % 4 == 3:
            dry.add(hat(True), tb + BEAT / 2, .06, -.3)
        if cta_t - .01 <= tb < outro_t:                                   # 16th shaker in the peak section
            for q in (.25, .75):
                dry.add(hat() * .6, tb + q * BEAT, .05, -.4)
        b += 1
    # lead flute
    for (b0, b1, name) in segs:
        t0 = b0 * BEAT
        if t0 < flight_t - .01 or t0 + BEAT * 4 > t_final + BEAT:
            continue
        g = lvl(t0, [(flight_t, .5), (cta_t, .8), (outro_t, .7)])
        for (st, m, ln) in LEAD[name]:
            tn = t0 + st * BEAT
            if tn + ln * BEAT * .5 > t_final:
                continue
            x = flute(m, ln * BEAT * 1.05)
            dry.add(x, tn, .17 * g, .1)
            wet.add(x, tn, .17 * g * .5, .1)
    # closing stinger: tonic chord + bell arpeggio + long pad
    for m in CH["C"][0] + [48 - 12 + 12]:
        wet.add(pad_note(m, DUR - t_final + .3, 1900), t_final, .3)
    for i, m in enumerate([72, 76, 79, 84, 88]):
        wet.add(bell(midi(m), 2.6, 2.0), t_final + i * .07, .16)
    k = kick()
    dry.add(k, t_final, .5)
    t = tt(int(1.2 * SR))
    dry.add(np.sin(2 * np.pi * midi(36) * t) * np.exp(-t / .6), t_final, .45)

    ir = make_ir(1.9, seed=3)
    music = dry.b + .55 * reverb(wet.b, ir) + .35 * wet.b
    return music


# ----------------------------------------------------------------------------- mix
def main():
    vo = build_vo()
    duck = duck_curve(vo)
    dings = [e["t"] for e in EV if e["type"] == "ding"]
    t_final = max(dings) + .0                                     # closing chord lands with the last "ding"

    music = render_music(t_final)
    music *= edb(-26) / (math.sqrt(np.mean(music ** 2)) + 1e-9)    # music bed ~ -26 dBFS RMS
    music *= duck

    sfx_bus = Bus()
    sfx_ir = make_ir(1.1, seed=7)
    send = Bus()
    for ev in EV:
        x, pan, level = sfx(ev)
        peak = np.max(np.abs(x)) + 1e-9
        g = edb(level) * ev.get("g", 1.0) / peak
        sfx_bus.add(x, ev["t"], g, pan)
        if ev["type"] in ("pop", "tick", "ding", "chime", "sparkle", "stamp", "impact"):
            send.add(x, ev["t"], g * .5, pan)
    sfx_mix = sfx_bus.b + .35 * reverb(send.b, sfx_ir)

    vo_ir = make_ir(.7, pre=.01, lo=300, hi=5500, seed=11)
    vo_wet = .12 * reverb(vo, vo_ir)

    mix = vo + vo_wet + music + sfx_mix
    mix = hp(mix, 32, 2)
    fade_out = np.clip((DUR - np.arange(N) / SR) / .7, 0, 1)
    fade_in = np.clip(np.arange(N) / SR / .04, 0, 1)
    mix *= fade_out * fade_in
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix * .9 / peak * 1.1) / np.tanh(1.1) * .9 if peak > .9 else mix
    out = ROOT / "build/mix.wav"
    wavfile.write(out, SR, (np.clip(mix.T, -1, 1) * 32767).astype(np.int16))
    print(f"mix.wav  {DUR:.2f}s  peak {20 * math.log10(np.max(np.abs(mix)) + 1e-9):.1f} dBFS  rms {rms_db(mix):.1f} dBFS")
    print(f"  stems rms: vo {rms_db(vo):.1f}  music {rms_db(music):.1f}  sfx {rms_db(sfx_mix):.1f}   closing chord at {t_final:.2f}s")
    np.save(ROOT / "build/_stems.npy", np.stack([vo, music, sfx_mix]).astype(np.float32))


if __name__ == "__main__":
    main()
