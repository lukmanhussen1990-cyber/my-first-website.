"""Sound: voice placement, code-made piano/pad score, synthesized SFX, mix -> mix.wav (48 kHz stereo float)."""
import math, subprocess, os, json
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from T import TL, TOTAL, w0, w1, s0, s1
import room, scenes

SR = 48000
N = int(round(TOTAL * SR))
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(11)


def db(x):
    return 10 ** (x / 20)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-af', 'aresample=resampler=soxr',
                          '-f', 'f32le', '-'], capture_output=True)
    if raw.returncode != 0:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                             capture_output=True, check=True)
    return np.frombuffer(raw.stdout, dtype=np.float32).astype(np.float64)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], 'band', fs=SR, output='sos'), x, axis=0)


def add(buf, sig, t, gain=1.0, pan=0.0):
    """add mono/stereo sig into stereo buf at time t (s)"""
    i = int(round(t * SR))
    if sig.ndim == 1:
        l = math.cos((pan + 1) * math.pi / 4)
        r = math.sin((pan + 1) * math.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n] * gain


def reverb_ir(rt60=2.6, pre=0.018, damp=5000, seed=3):
    r = np.random.default_rng(seed)
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60)
    ir = r.standard_normal((n, 2)) * env[:, None]
    ir = lp(ir, damp, 1)
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


def reverb(x, wet=0.35, **kw):
    ir = reverb_ir(**kw)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ============================================================== voice
def voice_track():
    v = np.zeros(N)
    for s in TL['segments']:
        a = load(os.path.join(HERE, 'vo', os.path.basename(s['clip'])))
        i = int(round(s['clip_start'] * SR))
        n = min(len(a), N - i)
        v[i:i + n] += a[:n]
    v = hp(v, 75, 2)
    return v


def voice_activity():
    """0..1 envelope: 1 while words are being spoken (for ducking the music)"""
    act = np.zeros(N)
    for s in TL['segments']:
        a, b = int(s['start'] * SR), int((s['end'] + 0.05) * SR)
        act[max(0, a):min(N, b)] = 1.0
    # smooth: fast attack, slow release
    k = int(0.25 * SR)
    win = np.exp(-np.arange(k) / (0.12 * SR))
    win /= win.sum()
    env = fftconvolve(act, win)[:N]
    env = np.maximum(env, np.concatenate([np.zeros(int(0.12 * SR)), act[: N - int(0.12 * SR)]]) * 0.0)
    return np.clip(env * 1.15, 0, 1)


# ============================================================== music
CHORDS = {
    'D': [38, 50, 57, 62, 66, 69], 'Bm': [35, 47, 54, 59, 62, 66], 'G': [31, 43, 50, 55, 59, 62],
    'A': [33, 45, 52, 57, 61, 64], 'Em': [28, 40, 52, 55, 59, 64], 'F#m': [30, 42, 49, 54, 57, 61],
    'D/F#': [30, 42, 50, 57, 62, 66], 'Asus': [33, 45, 52, 57, 62, 64],
}


def chord_plan():
    P = [
        (0.0, 'D'), (s0('s02') - 0.3, 'Bm'), (s0('s03') - 0.1, 'G'), (s1('s03') + 0.9, 'A'),
        (w0('s04', 'an') - 0.1, 'D'), (w0('s04', 'walking'), 'G'),
        (room.G0 - 0.2, 'Bm'), (s0('s06'), 'F#m'), (s1('s06') - 0.4, 'G'), (s0('s07'), 'Em'),
        (s1('s07') + 0.1, 'Asus'), (w0('s08', 'walked'), 'D'),
        (s0('s09'), 'G'), (w0('s10', 'same') - 0.2, 'Em'), (room.ALIGN1 - 0.1, 'A'), (room.FLASH0, 'D'),
        (room.FLASH1, 'Bm'), (w0('s11', 'giving'), 'G'), (room.GREEN0, 'D'),
        (s0('s12a'), 'Em'), (s0('s12b') - 0.1, 'A'), (w0('s12b', 'with'), 'D'),
        (s0('s13a'), 'Bm'), (room.T_ME - 0.05, 'G'),
        (s0('s14a'), 'D'),  # nearly silent section ('Follow me')
        (room.UP0, 'D'), (s1('s15') - 0.2, 'A'),
        (s0('s16') - 0.2, 'G'), (w0('s16', 'healthy'), 'D'), (w0('s16', 'sick') - 0.1, 'Em'), (s0('s17'), 'A'),
        (w0('s17', 'sinners'), 'D'),
        (s0('s18') - 0.2, 'Bm'), (s0('s19'), 'G'), (w0('s19', 'and'), 'D'), (w0('s19', 'future') + 0.3, 'A'),
        (s0('s20') - 0.2, 'Em'), (s0('s21a'), 'F#m'), (w0('s21a', 'testament'), 'G'), (w0('s21a', 'carries'), 'Asus'),
        (w0('s21b', 'matthew') - 0.03, 'D'),
        (s0('s22') - 0.2, 'G'), (s0('s23') - 0.1, 'Em'), (w0('s23', 'follow') - 0.1, 'A'),
        (w0('s24', 'you') - 0.05, 'D'),
    ]
    return P


def piano_note(m, dur, vel=0.5):
    f = mtof(m)
    n = int((dur + 2.5) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    B = 0.00035
    for k in range(1, 13):
        fk = k * f * math.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        amp = (1.0 / k ** 1.15) * (0.55 + 0.45 * vel) * (1.0 if k < 6 else 0.7)
        dec = 0.45 + 0.30 * k + f / 1400
        y += amp * np.sin(2 * math.pi * fk * t + k * 0.7) * np.exp(-dec * t)
    att = int(0.004 * SR)
    y[:att] *= np.linspace(0, 1, att)
    # release after dur
    r0 = int(dur * SR)
    if r0 < n:
        y[r0:] *= np.exp(-np.arange(n - r0) / (0.35 * SR))
    hammer = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR)) * 0.05
    y[: len(hammer)] += hammer
    return lp(y * vel, 7500, 1)


def pad_note(m, dur, att=1.4, rel=1.6):
    f = mtof(m)
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c, det in ((0, -0.0025), (1, 0.0028)):
        ff = f * (1 + det)
        vib = 1 + 0.0018 * np.sin(2 * math.pi * 4.8 * t + c)
        ph = 2 * math.pi * np.cumsum(ff * vib) / SR
        y = np.sin(ph) + 0.28 * np.sin(2 * ph + 0.3) + 0.11 * np.sin(3 * ph + 1.1) + 0.05 * np.sin(4 * ph)
        out[:, c] = y
    env = np.ones(n)
    a = int(att * SR)
    env[:a] = (1 - np.cos(np.linspace(0, math.pi, a))) / 2
    r0 = int(dur * SR)
    env[r0:] *= (1 + np.cos(np.linspace(0, math.pi, n - r0))) / 2
    return out * env[:, None]


def music_track():
    plan = chord_plan()
    plan.append((TOTAL + 1.0, None))
    pad = np.zeros((N + SR * 3, 2))
    pno = np.zeros((N + SR * 3, 2))
    bass = np.zeros((N + SR * 3, 2))
    quiet0, quiet1 = s0('s14a') - 0.15, room.UP0 - 0.1
    for (t0, ch), (t1, _) in zip(plan, plan[1:]):
        if ch is None:
            continue
        notes = CHORDS[ch]
        dur = t1 - t0 + 0.6
        in_quiet = quiet0 <= t0 < quiet1
        # pad: upper chord tones
        for m in notes[3:]:
            add(pad, pad_note(m, dur, att=1.0 if dur > 2 else 0.6), t0 - 0.35, 0.06 if not in_quiet else 0.02)
        add(pad, pad_note(notes[3] + 12, dur), t0 - 0.35, 0.035 if not in_quiet else 0.012)
        # bass
        if not in_quiet:
            add(bass, pad_note(notes[0] + 12, dur, att=0.5, rel=1.0), t0 - 0.1, 0.07)
        # piano: soft arpeggio over the chord
        if in_quiet:
            add(pno, piano_note(notes[-1] + 12, 2.2, 0.22), t0 + 0.4, 0.16, 0.2)
            continue
        step = 0.75
        arp = [notes[2], notes[3] + 12, notes[4] + 12, notes[5] + 12, notes[4] + 12, notes[3] + 12, notes[5]]
        k = 0
        tt = t0
        # a low root to anchor each chord
        add(pno, piano_note(notes[1], 2.0, 0.4), t0 + 0.004, 0.22, -0.2)
        while tt < t1 - 0.2 and k < 12:
            m = arp[k % len(arp)]
            vel = 0.5 if k == 0 else 0.34 + 0.07 * math.sin(k * 1.7)
            add(pno, piano_note(m, 1.0, vel), tt + 0.008 * rng.standard_normal(), 0.42, -0.3 + 0.6 * ((m % 12) / 12))
            tt += step
            k += 1
    pad_f = hp(pad[:N], 220, 2)
    mixd = pad_f * 1.0 + pno[:N] * 1.0 + lp(bass[:N], 300, 2) * 1.0
    mixd = reverb(mixd, wet=0.40, rt60=3.0)
    # leave a pocket for the voice (gentle cut around 250-500 Hz)
    mixd = peq(mixd, 350, -4.0, 0.9)
    return mixd


def peq(x, f0, gain_db, q):
    """RBJ peaking EQ"""
    A = 10 ** (gain_db / 40)
    w0 = 2 * math.pi * f0 / SR
    al = math.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * math.cos(w0), 1 - al * A])
    aa = np.array([1 + al / A, -2 * math.cos(w0), 1 - al / A])
    sos = np.concatenate([b / aa[0], aa / aa[0]])[None, :]
    return sosfilt(sos, x, axis=0)


def music_gain(act):
    """time-varying gain (dB) for the music bed"""
    t = np.arange(N) / SR
    g = np.full(N, -1.5)
    # ducking under the voice
    g -= 6.5 * act
    # swells at reveals
    def bump(tc, amp=4.5, width=0.9):
        return amp * np.exp(-((t - tc) / width) ** 2)
    for tc, amp in ((w0('s08', 'walked') + 0.4, 4.5), (room.ALIGN1, 4.0), (room.FLASH0 + 0.5, 5.0),
                    (w0('s12b', 'with') + 0.4, 4.5), (room.T_ME + 0.2, 4.0), (w0('s21b', 'matthew') + 0.3, 6.0),
                    (w0('s17', 'sinners') + 0.3, 3.5), (w0('s19', 'future') + 0.3, 3.5)):
        g += bump(tc, amp)
    # almost silent at "Follow me."
    q0, q1 = s0('s14a') - 0.1, room.UP0 - 0.15
    k = np.clip((t - q0) / 0.6, 0, 1) * np.clip((q1 + 0.6 - t) / 0.6, 0, 1)
    g -= 14 * k
    # warm swell at the end, then settle for the loop
    g += 6.0 * np.exp(-((t - (room.BLOOM0 + 0.7)) / 1.1) ** 2)
    end = room.EC0
    g -= 5.0 * np.clip((t - end - 0.6) / 1.4, 0, 1)
    # start: fade in from the same level the loop ends on
    g -= 5.0 * np.clip(1 - t / 0.9, 0, 1)
    return db(g)


# ============================================================== SFX
def env_ar(n, a, r):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na) ** 1.5
    e[na:] = np.exp(-np.arange(n - na) / max(1, r * SR))
    return e


def whoosh(dur=0.7, f0=300, f1=2400, gain=1.0, peak=0.55):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    # time-varying band-pass via short overlapping FFT blocks
    out = np.zeros(n)
    blk = 1024
    hop = 512
    win = np.hanning(blk)
    for i in range(0, n - blk, hop):
        u = i / max(1, n - blk)
        fc = f0 * (f1 / f0) ** u
        spec = np.fft.rfft(noise[i:i + blk] * win)
        fr = np.fft.rfftfreq(blk, 1 / SR)
        h = np.exp(-0.5 * (np.log(np.maximum(fr, 1) / fc) / 0.55) ** 2)
        out[i:i + blk] += np.fft.irfft(spec * h) * win
    t = np.arange(n) / n
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.6)
    y = out * e
    y = y / (np.abs(y).max() + 1e-9)
    pans = np.linspace(-0.5, 0.5, n)
    st = np.stack([y * np.cos((pans + 1) * math.pi / 4), y * np.sin((pans + 1) * math.pi / 4)], axis=1) * 1.414
    return st * gain


def bell(f, dur=1.2, gain=1.0, partials=((1, 1.0, 1.0), (2.76, 0.45, 1.8), (5.40, 0.22, 2.8), (8.93, 0.1, 4.0))):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, dk in partials:
        if f * ratio > 16000:
            continue
        y += amp * np.sin(2 * math.pi * f * ratio * t) * np.exp(-dk * 3.0 * t / dur)
    a = int(0.003 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return y * gain / 1.6


def ting(gain=1.0):
    y = bell(2349, 1.1, gain)
    b = bell(3520, 0.9, 0.35 * gain)
    y[:len(b)] += b
    return y


def chime(gain=1.0):
    y = np.zeros(int(2.4 * SR))
    for i, (f, d) in enumerate(((1174.7, 0.0), (1760.0, 0.09), (1480.0, 0.18), (2349.3, 0.27))):
        b = bell(f, 2.0, 0.6 if i else 0.8, partials=((1, 1.0, 0.8), (2.0, 0.25, 1.4), (3.0, 0.08, 2.0)))
        i0 = int(d * SR)
        y[i0:i0 + len(b)] += b[: len(y) - i0]
    return y * gain


def clink(gain=1.0, f0=None):
    f0 = f0 or rng.uniform(3000, 4200)
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, dk in ((1, 1.0, 22), (1.47, 0.6, 30), (2.13, 0.45, 38), (2.98, 0.3, 46), (0.52, 0.3, 26)):
        y += amp * np.sin(2 * math.pi * f0 * ratio * t + rng.uniform(0, 6)) * np.exp(-dk * t)
    click = rng.standard_normal(int(0.003 * SR)) * 0.6
    y[: len(click)] += click
    thud = np.sin(2 * math.pi * 180 * t) * np.exp(-60 * t) * 0.35
    return (y + thud) * gain * 0.5


def footstep(gain=1.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    nz = lp(rng.standard_normal(n), 520, 2) * np.exp(-t / 0.03)
    body = np.sin(2 * math.pi * rng.uniform(80, 100) * t) * np.exp(-t / 0.05)
    scuff = bp(rng.standard_normal(n), 1500, 4000, 2) * np.exp(-t / 0.02) * 0.15
    y = nz * 2.2 + body * 0.6 + scuff
    return y / (np.abs(y).max() + 1e-9) * gain


def pop(gain=1.0):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 950 * np.exp(-t / 0.035) + 260
    ph = 2 * math.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.045)
    y[: int(0.002 * SR)] += 0.4
    return lp(y, 5000, 1) * gain


def sparkle(gain=1.0, n_notes=5, spread=0.35):
    notes = [2349.3, 2793.8, 3136.0, 3520.0, 4186.0, 4698.6]
    y = np.zeros(int((spread + 1.2) * SR))
    for i in range(n_notes):
        f = notes[int(rng.integers(0, len(notes)))]
        b = bell(f, 0.9, 0.5)
        i0 = int(rng.uniform(0, spread) * SR)
        y[i0:i0 + len(b)] += b[: len(y) - i0]
    return y * gain


def scribble(gain=1.0):
    n = int(0.13 * SR)
    t = np.arange(n) / n
    y = bp(rng.standard_normal(n), 2500, 6500, 2) * np.sin(math.pi * t) ** 1.5
    return y * gain


def slide(dur=0.45, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = bp(rng.standard_normal(n), 1800, 5000, 2) * (0.6 + 0.4 * np.sin(2 * math.pi * 38 * t) ** 2)
    e = np.sin(math.pi * np.arange(n) / n) ** 0.8
    return y * e * gain


def thump(gain=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t / 0.08) + 55
    y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    return y * gain


def riser(dur=1.4, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / n
    y = whoosh(dur, 400, 5000, 1.0, peak=0.92)
    sh = np.zeros(n)
    for f in (1174.7, 1760.0, 2349.3):
        sh += np.sin(2 * math.pi * f * np.arange(n) / SR) * 0.25
    sh *= t ** 2
    y[:, 0] += sh
    y[:, 1] += sh
    return y * gain


def sfx_track():
    fx = np.zeros((N + SR * 3, 2))
    E = []   # (time, signal, gain, pan)
    # scene 1: halos shine on "good"
    E.append((scenes.T_GOOD - 0.02, sparkle(1.0, 6, 0.3), 0.10, -0.3))
    # transitions (soft whooshes)
    for tt, d, f0, f1, g in ((room.T_PAINT_IN - 0.15, 0.7, 250, 2000, 0.12), (room.ROOM_END - 0.55, 0.8, 250, 1800, 0.12),
                             (scenes.Q_IN - 0.1, 0.7, 300, 2000, 0.11), (scenes.B_IN - 0.1, 0.7, 300, 2000, 0.11),
                             (room.E_IN - 0.1, 0.8, 250, 1800, 0.11), (room.G0 - 0.1, 0.9, 160, 900, 0.09)):
        E.append((tt, whoosh(d, f0, f1), g, 0))
    # zoom into the painting: longer airy whoosh
    E.append((room.T_ZOOM0 - 0.05, whoosh(1.2, 180, 2600, peak=0.7), 0.13, 0))
    # magnifier glides + tings
    E.append((room.T_MAG0 - 0.05, whoosh(0.75, 900, 3200, peak=0.45), 0.10, 0.3))
    E.append((room.T_Q, ting(0.9), 0.06, 0.4))
    E.append((room.T_PAUSE0 + 0.02, thump(0.5), 0.05, 0))
    E.append((room.MAG_A, whoosh(0.85, 900, 3200, peak=0.45), 0.10, 0.4))
    E.append((room.RC1 - 0.02, ting(1.0), 0.08, 0.2))
    E.append((room.EXP0 - 0.05, whoosh(0.65, 300, 2500, peak=0.6), 0.10, 0))
    # hands line up / creation flash
    E.append((room.ALIGN1 - 0.05, sparkle(1.0, 5, 0.25), 0.09, 0))
    E.append((room.FLASH0 - 0.12, whoosh(0.35, 800, 6000, peak=0.8), 0.11, 0))
    E.append((room.FLASH0 + 0.02, chime(0.8), 0.06, 0))
    E.append((room.FLASH1 - 0.15, whoosh(0.45, 4000, 600, peak=0.3), 0.08, 0))
    # coin glint on "tax collectors"
    E.append((w0('s04', 'tax'), sparkle(0.8, 3, 0.4), 0.05, -0.4))
    # scene 4: bubbles + coins into the pile
    E.append((room.T_THIEF, pop(), 0.13, -0.4))
    E.append((room.T_TRAITOR, pop(), 0.13, 0.4))
    for c0 in room.PM_COIN:
        E.append((c0 + 0.43, clink(), 0.14, 0.1))
    E.append((room.PM_COIN[0] - 0.05, slide(0.5), 0.02, 0.2))
    # footsteps, placed exactly on the heel strikes of each walk cycle (max leg spread: |dx| = (k + 1/2) * stride)
    def steps(xfn, t0, t1, stride, gain, pan_fn):
        ts = np.arange(t0, t1, 0.001)
        xs = np.array([xfn(tt) for tt in ts])
        d = np.abs(xs - xs[0]) / stride - 0.5
        k = np.floor(d)
        for i in np.where(np.diff(k) > 0)[0]:
            tt = ts[i + 1]
            E.append((tt, footstep(), gain, pan_fn(xs[i + 1])))
    scr = lambda x: float(np.clip((x - 540) / 540, -1, 1)) * 0.6
    steps(lambda tt: room.walk_x(tt, room.PM0, room.PM0 + 0.75, 1190, room.PM_X, ease=room.ease_out)[0],
          room.PM0, room.PM0 + 0.75, 68.0, 0.08, scr)
    steps(lambda tt: room.walk_x(tt, room.T_LEAVE - 0.05, room.T_LEAVE + 1.15, room.PM_X, 1220, ease=room.ease_in)[0],
          room.T_LEAVE - 0.05, room.T_LEAVE + 1.15, 68.0, 0.07, scr)
    steps(lambda tt: room.walk_x(tt, room.E0, room.E1, 1290, room.JX, ease=room.ease_out)[0],
          room.E0, room.E1, 68.0, 0.13, scr)
    steps(lambda tt: room.walk_x(tt, room.WO0, room.WO1, room.JX, 1420, ease=room.ease_sine)[0],
          room.WO0, room.WO1, 68.0, 0.07, scr)
    steps(lambda tt: room.walk_x(tt, room.WO0 + 0.1, room.WO1, room.STAND_X, 1330, ease=room.ease_sine)[0],
          room.WO0 + 0.1, room.WO1, 68.0, 0.06, scr)
    dcam = lambda x: 0.0
    steps(lambda tt: scenes.jesus_doctor_x(tt)[0], scenes.D_IN, scenes.D_BED, 66.0, 0.06, dcam)
    steps(lambda tt: scenes.jesus_doctor_x(tt)[0], scenes.D_GO, scenes.D_SIN - 0.2, 66.0, 0.06, dcam)
    steps(lambda tt: scenes.jesus_doctor_x(tt)[0], scenes.D_SIN + 0.12, scenes.D_SIN2, 66.0, 0.05, dcam)
    # light spreads on the floor
    E.append((room.FL0 - 0.1, riser(1.3), 0.07, 0))
    # green glow
    E.append((room.GREEN0, sparkle(0.8, 4, 0.4), 0.07, -0.1))
    # red X on the window
    E.append((room.RX0, scribble(), 0.08, -0.1))
    E.append((room.RX0 + 0.21, scribble(), 0.08, 0.1))
    # beam brighter
    E.append((room.BEAM_UP, riser(1.0), 0.07, 0.3))
    # ME? bubble
    E.append((room.T_ME, pop(), 0.15, -0.2))
    # Bible labels: chimes
    E.append((room.T_LBL_MT, chime(), 0.07, 0))
    E.append((room.T_QI, pop(0.7), 0.07, 0.3))
    E.append((scenes.D_IN + 0.35, chime(), 0.06, 0))
    E.append((scenes.B_ICON, chime(0.8), 0.06, 0))
    E.append((scenes.B_NAME, chime(1.0), 0.09, 0))
    E.append((scenes.B_NAME + 0.02, sparkle(1.0, 6, 0.5), 0.07, 0))
    # Matthew gets up: coins slide off and clink on the floor
    E.append((room.UP0 + 0.1, slide(0.5), 0.03, 0.2))
    for i, tt in enumerate(room.coin_landing_times()):
        E.append((tt, clink(0.8 if i < 6 else 0.4), 0.13 if i < 6 else 0.06, 0.2 + 0.05 * i))
    # healing touches
    for tt in (scenes.D_TOUCH, scenes.D_SIN, scenes.D_SIN2):
        E.append((tt, sparkle(0.8, 4, 0.3), 0.07, 0.2))
    # Oscar Wilde title
    E.append((scenes.Q_TITLE, thump(), 0.10, 0))
    E.append((scenes.Q_FUT, sparkle(0.9, 5, 0.4), 0.06, 0.3))
    # the single coin falling away
    for tt in scenes.coin_drop_times():
        E.append((tt, clink(0.8), 0.09, -0.4))
    # ending: warm swell toward the viewer
    E.append((room.BLOOM0 - 0.9, riser(1.2), 0.11, 0))
    E.append((room.BLOOM0 + 0.1, chime(0.9), 0.08, 0))
    for tt, sig, g, pan in E:
        add(fx, sig, tt, g, pan)
    fx = fx[:N]
    return reverb(fx, wet=0.22, rt60=1.6)


def main(outdir=HERE):
    v = voice_track()
    act = voice_activity()
    mus = music_track()
    mus *= music_gain(act)[:, None]
    fx = sfx_track()
    # levels: voice clearly on top, music very quiet, sfx subtle
    v_n = v / (np.sqrt(np.mean(v[v != 0] ** 2)) + 1e-9) * 0.12
    mus_rms = np.sqrt(np.mean(mus ** 2))
    mus_n = mus / (mus_rms + 1e-9) * 0.12 * db(-15)
    mix = np.stack([v_n, v_n], axis=1) + mus_n + fx * 1.0
    peak = np.abs(mix).max()
    if peak > 0.98:
        mix *= 0.98 / peak
    out = os.path.join(outdir, 'mix_raw.wav')
    import wave
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # stems for checking
    for name, sig in (('stem_voice.wav', np.stack([v_n, v_n], 1)), ('stem_music.wav', mus_n), ('stem_fx.wav', fx)):
        pcm = (np.clip(sig, -1, 1) * 32767).astype(np.int16)
        with wave.open(os.path.join(outdir, name), 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
    print('wrote', out, 'dur', len(mix) / SR, 'peak', np.abs(mix).max())


if __name__ == '__main__':
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else HERE)
