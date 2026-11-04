"""All Bob sounds, synthesised in code with numpy (no samples, no downloads, no AI):
  music.wav : playful xylophone / marimba tune (original). Stiff and mechanical while the town is grey,
              softer in the attic and the past, then bouncy and bright when the colours come back.
  crunch.wav: one giant synchronised sandwich CRUNCH
  boing.wav : my hair springing back up
  pop.wav   : a soft colour pop
  pops.wav  : a flurry of pops (100 people changing)
  cheer.wav : crowd cheer with applause (from the Birthday synth)
usage: python3 scripts/bob_audio.py public/bob/sfx 101.6
"""
import importlib.util, os, sys
import numpy as np
from scipy.signal import butter, sosfilt

spec = importlib.util.spec_from_file_location('bday', os.path.join(os.path.dirname(__file__), 'birthday_audio.py'))
bday = importlib.util.module_from_spec(spec)
sys.argv_backup = sys.argv
spec.loader.exec_module(bday)
SR = bday.SR
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/bob/sfx'
TOTAL = float(sys.argv[2]) if len(sys.argv) > 2 else 101.6
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(77)
bday.OUT = OUT


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='lowpass', fs=SR, output='sos'), x)


# ===================================================================== instruments
def xylo(f, dur=0.9, vel=1.0, soft=False):
    """wooden bar: strong fundamental + the bar's 4th and 10th partials, very fast decay of the overtones"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    tau = 0.35 if not soft else 0.55
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    y += 0.32 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / (tau * 0.22))
    y += 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / (tau * 0.08))
    click = bp(rng.standard_normal(int(0.003 * SR)), 2000, 7000) * 0.25
    y[: len(click)] += click
    a = int(0.0015 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return y * vel


def marimba(f, dur=1.2, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.6) + 0.18 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.08)
    a = int(0.004 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return lp(y, 3000) * vel


def pluck_bass(f, dur=0.5, vel=1.0):
    """pizzicato-ish bass (Karplus-Strong)"""
    n = int(dur * SR)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.5 * (buf[i % period] + buf[(i + 1) % period]) * 0.996
    env = np.exp(-np.arange(n) / SR / 0.35)
    return lp(out * env, 900) * vel


def tick(vel=1.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 3000, 9000) * np.exp(-t / 0.008) * vel


def shaker(vel=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 5000, 11000) * np.minimum(1, t / 0.015) * np.exp(-t / 0.03) * vel


NOTE = bday.NOTE
hz = bday.hz

# ===================================================================== the tune (C major, 112 bpm, 4/4)
BPM = 112
B = 60 / BPM
# a cheeky 2-bar motif (eighth notes), as (beat offset, note)
MOTIF_A = [(0, 'C5'), (0.5, 'E5'), (1, 'G5'), (1.5, 'E5'), (2, 'C5'), (2.5, 'E5'), (3, 'G5'), (3.5, 'G5'),
           (4, 'A5'), (4.5, 'G5'), (5, 'E5'), (5.5, 'C5'), (6, 'D5'), (6.5, 'D5'), (7, 'G4')]
MOTIF_B = [(0, 'F5'), (0.5, 'A5'), (1, 'C6'), (1.5, 'A5'), (2, 'G5'), (2.5, 'E5'), (3, 'C5'), (4, 'D5'), (4.5, 'E5'), (5, 'F5'), (5.5, 'D5'), (6, 'C5'), (7, 'G5')]
BASS = {0: 'C3', 2: 'G2', 4: 'A2', 6: 'G2'}
BASS_B = {0: 'F2', 2: 'C3', 4: 'G2', 6: 'C3'}
# the past (slower feel, minor colour): half-time arpeggios
PAST = [(0, 'A4'), (1, 'C5'), (2, 'E5'), (3, 'C5'), (4, 'F4'), (5, 'A4'), (6, 'C5'), (7, 'A4'), (8, 'G4'), (9, 'B4'), (10, 'D5'), (11, 'B4'), (12, 'E4'), (13, 'G4'), (14, 'B4'), (15, 'G#4')]


def music(total):
    n = int(total * SR)
    y = np.zeros(n)

    def put(sig, at, gain=1.0):
        i = int(at * SR)
        if i >= n or i < 0:
            return
        j = min(n, i + len(sig))
        y[i:j] += sig[: j - i] * gain

    def phrase(start, motif, bass, mech=False, bright=False, gain=1.0):
        for b, nn in motif:
            v = 0.85 if mech else (0.75 + 0.25 * rng.random())
            put(xylo(hz(nn), 0.6 if mech else 0.9, v, soft=not mech), start + b * B, gain)
            if bright:
                put(xylo(hz(nn) * 2, 0.4, 0.25), start + b * B + 0.01, gain)
        for b, nn in bass.items():
            put(pluck_bass(hz(nn), 0.5 if mech else 0.8, 0.9), start + b * B, gain * 0.9)
            if not mech:
                put(pluck_bass(hz(nn) * 1.5, 0.4, 0.35), start + (b + 1) * B, gain * 0.7)
        if mech:
            for k in range(8):
                put(tick(0.35), start + k * B, gain)
        if bright:
            for k in range(16):
                put(shaker(0.25 if k % 2 else 0.4), start + k * B / 2, gain)
        return start + 8 * B

    # 0 - 40 s: the grey town, perfectly regular and a little robotic
    t = 0.15
    while t < 39.5 - 8 * B:
        t = phrase(t, MOTIF_A if int(t / (8 * B)) % 2 == 0 else MOTIF_B, BASS if int(t / (8 * B)) % 2 == 0 else BASS_B, mech=True, gain=0.8)
    # 40 - 67.5 s: trying to fit in, the attic, the past: soft marimba arpeggios
    t = 40.0
    while t < 67.0:
        for b, nn in PAST:
            put(marimba(hz(nn), 1.4, 0.55), t + b * B * 0.9)
        t += 16 * B * 0.9
    # 67.8 - 77.5: the wild hat, the yellow scarf: hopeful, lighter
    t = 67.8
    while t < 77.0:
        t = phrase(t, MOTIF_A, BASS, gain=0.7)
    # 77.6 - end: colour everywhere, everyone their own way: bright and bouncy
    t = 77.6
    while t < total - 8 * B - 0.3:
        t = phrase(t, MOTIF_A if int((t - 77.6) / (8 * B)) % 2 == 0 else MOTIF_B, BASS if int((t - 77.6) / (8 * B)) % 2 == 0 else BASS_B, bright=True, gain=1.0)
    # final flourish
    for k, nn in enumerate(['C5', 'E5', 'G5', 'C6']):
        put(xylo(hz(nn), 1.4, 0.9, soft=True), t + k * 0.09)
    put(pluck_bass(hz('C2'), 1.2, 1.0), t)
    # fades between sections
    env = np.ones(n)
    for a, b in [(39.2, 40.0), (66.9, 67.8)]:
        i0, i1 = int(a * SR), int(b * SR)
        env[i0:i1] = np.linspace(1, 0.15, i1 - i0)
        env[i1:i1 + int(0.6 * SR)] = np.linspace(0.15, 1, int(0.6 * SR))
    e0 = int((total - 0.9) * SR)
    env[e0:] *= np.linspace(1, 0, n - e0)
    y *= env
    return bday.reverb(y, rt60=1.2, wet=0.18)


# ===================================================================== effects
def crunch():
    """lots of Bobs biting at once: crisp crackle grains + a soft low thump"""
    n = int(0.6 * SR)
    y = np.zeros(n)
    for b in range(24):  # many mouths, a few ms apart
        off = int(abs(rng.normal(0, 0.006)) * SR)
        for g in range(30):
            at = off + int(rng.uniform(0, 0.22) * SR)
            ln = int(rng.uniform(0.002, 0.008) * SR)
            if at + ln >= n:
                continue
            grain = rng.standard_normal(ln) * np.exp(-np.arange(ln) / (ln / 3))
            y[at:at + ln] += grain * rng.uniform(0.3, 1.0) * np.exp(-at / SR / 0.18)
    y = bp(y, 900, 7000)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.06) * 2.5
    out = y / (np.max(np.abs(y)) + 1e-9) + thump / 2.5 * 0.6
    return bday.reverb(out, rt60=0.6, wet=0.15, seed=4)


def boing():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 150 + 260 * np.exp(-t / 0.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3.1 * ph)) * np.exp(-t / 0.42)
    a = int(0.004 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return bday.reverb(y, rt60=0.5, wet=0.12, seed=6)


def pop():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    f = 260 + 900 * np.exp(-t / 0.02)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)
    y[: int(0.002 * SR)] += bp(rng.standard_normal(int(0.002 * SR)), 1500, 6000) * 0.4
    return bday.reverb(y, rt60=0.35, wet=0.12, seed=8)


def pops(length=1.4, count=40):
    n = int(length * SR)
    y = np.zeros(n)
    p = pop()[:, 0] if pop().ndim == 2 else pop()
    for k in range(count):
        at = int(rng.uniform(0, length - 0.2) * SR)
        pitch = rng.uniform(0.8, 1.6)
        idx = (np.arange(int(len(p) / pitch)) * pitch).astype(int)
        s = p[idx] * rng.uniform(0.3, 0.8)
        y[at:at + len(s)] += s[: n - at]
    return bday.reverb(y, rt60=0.5, wet=0.15, seed=9)


if __name__ == '__main__':
    bday.write('music.wav', music(TOTAL), peak=0.85)
    bday.write('crunch.wav', crunch())
    bday.write('boing.wav', boing())
    bday.write('pop.wav', pop())
    bday.write('pops.wav', pops())
    bday.write('cheer.wav', bday.cheer(4.0, 40))
