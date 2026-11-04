"""All Birthday sounds, synthesised in code with numpy (no samples, no downloads, no AI):
  - music.wav  : a soft music-box lullaby (original melody), waltz time, with a gentle bass and a warm pad
  - knock.wav  : three knocks on a wooden door
  - ding.wav   : oven timer ding
  - blow.wav   : soft whoosh (blowing out candles)
  - cheer.wav  : a happy crowd "yay" with applause
  - claps.wav  : a crowd clapping along
usage: python3 scripts/birthday_audio.py public/birthday/sfx
"""
import sys, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/birthday/sfx'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1234)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos')
    return sosfilt(sos, x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='highpass', fs=SR, output='sos'), x)


def write(name, x, peak=0.9):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) + 1e-9
    x = x / m * peak
    wavfile.write(os.path.join(OUT, name), SR, (x * 32767).astype(np.int16))
    print(f'{name}: {x.shape[0] / SR:.2f}s')


def reverb(x, rt60=2.2, wet=0.25, seed=7, tone=5200):
    """stereo reverb from a synthetic, exponentially decaying noise impulse response"""
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    env = np.exp(-6.9 * t / rt60)
    irs = []
    for k in range(2):
        ir = r.standard_normal(n) * env
        ir = lp(ir, tone)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))  # pre-delay softness
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    mono = x if x.ndim == 1 else x.mean(axis=1)
    wetL = fftconvolve(mono, irs[0])[: len(mono)]
    wetR = fftconvolve(mono, irs[1])[: len(mono)]
    dry = np.stack([mono, mono], axis=1) if x.ndim == 1 else x
    return dry * (1 - wet) + np.stack([wetL, wetR], axis=1) * wet * 1.0


# ===================================================================== music
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    n, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + NOTE[n]
    return 440.0 * 2 ** ((midi - 69) / 12)


def musicbox(f, dur=2.6, vel=1.0):
    """a struck music-box tine: bright attack, slightly inharmonic overtones that die fast"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [(1.0, 1.0, 1.6), (2.0, 0.28, 0.7), (3.01, 0.08, 0.35), (4.2, 0.07, 0.18), (5.43, 0.05, 0.1), (6.8, 0.02, 0.06)]
    y = np.zeros(n)
    for ratio, amp, tau in parts:
        fr = f * ratio
        if fr > SR / 2.2:
            continue
        y += amp * np.sin(2 * np.pi * fr * t + rng.uniform(0, 0.3)) * np.exp(-t / (tau * (440 / max(f, 220)) ** 0.25))
    # tiny metallic click at the start
    click = rng.standard_normal(int(0.004 * SR)) * np.linspace(1, 0, int(0.004 * SR)) * 0.08
    y[: len(click)] += hp(click, 3000)
    att = int(0.002 * SR)
    y[:att] *= np.linspace(0, 1, att)
    return y * vel


def softpiano(f, dur=3.0, vel=1.0):
    """soft felt-piano-like bass note"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.6) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.35))
    env = np.exp(-t / 1.6)
    a = int(0.012 * SR)
    env[:a] *= np.linspace(0, 1, a)
    return lp(y * env, 1800) * vel


def pad(freqs, dur, vel=1.0):
    """warm, slow pad (detuned sines, soft attack/release)"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for d in (-0.15, 0.0, 0.17):
            y += np.sin(2 * np.pi * f * (1 + d / 100) * t + rng.uniform(0, 6.28)) * (0.6 if d else 1.0)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.4)
    return lp(y * np.clip(env, 0, 1), 1400) * vel / len(freqs)


# chords (root-position triads, voiced around octave 3-4)
CH = {
    'D': ['D3', 'F#3', 'A3'], 'Bm': ['B2', 'D3', 'F#3'], 'G': ['G2', 'B2', 'D3'], 'A': ['A2', 'C#3', 'E3'],
    'F#m': ['F#2', 'A2', 'C#3'], 'Em': ['E2', 'G2', 'B2'], 'A7': ['A2', 'C#3', 'G3'],
}
# 16-bar original lullaby in D major (3/4). per bar: (chord, [(beat, note, beats_held), ...])
THEME_A = [
    ('D', [(0, 'A4', 1), (2, 'D5', 1)]),
    ('Bm', [(0, 'F#5', 2), (2, 'E5', 1)]),
    ('G', [(0, 'D5', 1), (2, 'B4', 1)]),
    ('A', [(0, 'C#5', 3)]),
    ('D', [(0, 'A4', 1), (2, 'D5', 1)]),
    ('F#m', [(0, 'F#5', 2), (2, 'A5', 1)]),
    ('G', [(0, 'G5', 1), (1, 'F#5', 1), (2, 'E5', 1)]),
    ('D', [(0, 'D5', 3)]),
]
THEME_B = [
    ('G', [(0, 'B5', 2), (2, 'A5', 1)]),
    ('D', [(0, 'F#5', 2), (2, 'D5', 1)]),
    ('Em', [(0, 'E5', 1), (1, 'F#5', 1), (2, 'G5', 1)]),
    ('A', [(0, 'A5', 3)]),
    ('G', [(0, 'B5', 2), (2, 'A5', 1)]),
    ('D', [(0, 'F#5', 2), (2, 'D5', 1)]),
    ('Em', [(0, 'E5', 2), (2, 'C#5', 1)]),
    ('D', [(0, 'D5', 3)]),
]
BPM = 76
BEAT = 60 / BPM
BAR = 3 * BEAT


def render_bars(bars, start, total_len, mel=1.0, arp=0.0, bass=0.6, octave_double=0.0, pad_vel=0.0):
    """place bars starting at time `start`; returns (mono, last time)"""
    y = np.zeros(total_len)

    def put(sig, at):
        i = int(at * SR)
        if i >= total_len:
            return
        j = min(total_len, i + len(sig))
        y[i:j] += sig[: j - i]

    t = start
    for chord, notes in bars:
        tones = [hz(n) for n in CH[chord]]
        if bass > 0:
            put(softpiano(tones[0] / 1.0, 3.2, bass), t)
        if arp > 0:
            # broken chord on beats 2 and 3 (music box, middle register)
            put(musicbox(tones[1] * 2, 1.8, arp * 0.55), t + BEAT)
            put(musicbox(tones[2] * 2, 1.8, arp * 0.5), t + 2 * BEAT)
        if pad_vel > 0:
            put(pad([f * 2 for f in tones], BAR + 1.4, pad_vel), t)
        for beat, note, held in notes:
            f = hz(note)
            put(musicbox(f, 2.4 + held * 0.4, mel * (1.0 if beat == 0 else 0.86)), t + beat * BEAT + rng.uniform(-0.004, 0.006))
            if octave_double > 0:
                put(musicbox(f * 2, 1.4, mel * octave_double), t + beat * BEAT + 0.008)
        t += BAR
    return y, t


def music(total_s):
    n = int(total_s * SR)
    y = np.zeros(n)
    # ---- part 1: 0.3 s -> fades out before the made-up song (80.3 s)
    t0 = 0.3
    sec = [
        (THEME_A, dict(mel=0.8, arp=0.0, bass=0.35)),  # quiet town, tender and sparse
        (THEME_B, dict(mel=0.85, arp=0.55, bass=0.45)),  # the attic, the photo, asking around
        (THEME_A, dict(mel=0.9, arp=0.7, bass=0.5)),  # the bakery, the book
        (THEME_B[:4], dict(mel=1.0, arp=0.8, bass=0.5, octave_double=0.25)),  # baking -> it was perfect
        ([('Bm', [(0, 'D5', 3)]), ('A', [(0, 'C#5', 3)])], dict(mel=0.6, arp=0.35, bass=0.4)),  # the plan, the night
        (THEME_A[:4], dict(mel=1.0, arp=0.8, bass=0.55, octave_double=0.3, pad_vel=0.5)),  # the lights come on
    ]
    t = t0
    for bars, kw in sec:
        part, t = render_bars(bars, t, n, **kw)
        y += part
    end1 = 80.3
    fade = np.ones(n)
    i0, i1 = int((end1 - 2.2) * SR), int(end1 * SR)
    fade[i0:i1] = np.linspace(1, 0, i1 - i0)
    fade[i1:] = 0
    y *= fade
    # ---- part 2: after the song. tender single notes, then warm and full for the hug, resolve at the end
    t2 = 87.1
    part, t = render_bars(THEME_A[:4], t2, n, mel=0.65, arp=0.0, bass=0.3)
    y += part
    part, t = render_bars(THEME_A[4:], t, n, mel=0.95, arp=0.75, bass=0.5, octave_double=0.25, pad_vel=0.55)
    y += part
    # final D chord, rolled
    for k, nn in enumerate(['D4', 'F#4', 'A4', 'D5']):
        i = int((t + k * 0.09) * SR)
        sig = musicbox(hz(nn), 3.5, 0.75)
        j = min(n, i + len(sig))
        if i < n:
            y[i:j] += sig[: j - i]
    i = int(t * SR)
    sig = softpiano(hz('D2'), 3.6, 0.5)
    j = min(n, i + len(sig))
    if i < n:
        y[i:j] += sig[: j - i]
    # fade the last second to silence
    e0 = int((total_s - 1.6) * SR)
    y[e0:] *= np.linspace(1, 0, n - e0)
    st = reverb(y, rt60=2.4, wet=0.3)
    print(f'music: part 1 ends {end1}s, part 2 {t2}s -> {t:.1f}s (+ final chord)')
    return st


# ===================================================================== sound effects
def knock():
    n = int(1.0 * SR)
    y = np.zeros(n)
    t = np.arange(int(0.25 * SR)) / SR
    for k, at in enumerate([0.0, 0.2, 0.4]):
        body = (np.sin(2 * np.pi * 168 * t) * 1.0 + np.sin(2 * np.pi * 342 * t) * 0.5 + np.sin(2 * np.pi * 611 * t) * 0.25) * np.exp(-t / 0.035)
        tick = bp(rng.standard_normal(len(t)), 700, 3200) * np.exp(-t / 0.006) * 0.9
        s = (body + tick) * (1.0 - 0.08 * k)
        i = int(at * SR)
        y[i:i + len(s)] += s
    return reverb(lp(y, 5000), rt60=0.5, wet=0.12, seed=3)


def ding():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    f0 = 1567.98  # G6
    y = np.zeros(n)
    for ratio, amp, tau in [(1.0, 1.0, 0.9), (2.0, 0.35, 0.5), (2.76, 0.25, 0.35), (4.07, 0.12, 0.22), (5.4, 0.06, 0.12)]:
        y += amp * np.sin(2 * np.pi * f0 * ratio * t) * np.exp(-t / tau)
    a = int(0.003 * SR)
    y[:a] *= np.linspace(0, 1, a)
    return reverb(y, rt60=0.9, wet=0.18, seed=5)


def blow(length=0.75):
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # band of breath noise that slides down a little, soft attack, smooth tail
    lo = bp(noise, 250, 1400, 2)
    hi = bp(noise, 1400, 4200, 2) * 0.35
    env = np.minimum(1, t / 0.07) * np.exp(-np.maximum(0, t - 0.12) / 0.22)
    y = (lo + hi) * env
    return reverb(lp(y, 3500), rt60=0.7, wet=0.15, seed=9)


def clap_one(bright=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    c = rng.uniform(1100, 2300) * bright
    s = bp(rng.standard_normal(n), c * 0.55, min(c * 1.9, 9000), 2)
    env = np.exp(-t / rng.uniform(0.008, 0.016))
    # a clap is 2-3 tiny bursts very close together
    out = s * env
    for k in range(rng.integers(1, 3)):
        d = int(rng.uniform(0.003, 0.009) * SR)
        out[d:] += s[: n - d] * env[: n - d] * 0.6
    return out


def claps(length=7.0, people=26, rate=3.6, start_ramp=0.6, end_ramp=1.2):
    n = int(length * SR)
    y = np.zeros(n)
    for p in range(people):
        r = rate * rng.uniform(0.85, 1.15)
        t = rng.uniform(0, 0.4)
        vol = rng.uniform(0.4, 1.0)
        while t < length - 0.1:
            s = clap_one() * vol * rng.uniform(0.75, 1.0)
            i = int(t * SR)
            j = min(n, i + len(s))
            y[i:j] += s[: j - i]
            t += 1 / r + rng.normal(0, 0.012)
    tt = np.arange(n) / SR
    y *= np.minimum(1, tt / start_ramp) * np.minimum(1, (length - tt) / end_ramp)
    return reverb(y, rt60=1.1, wet=0.22, seed=11)


def voice_yay(f0, dur, vowel):
    """one happy 'yaaay' voice: a glottal-ish harmonic source through two formants, pitch rising then falling"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    contour = f0 * (1 + 0.18 * np.sin(np.pi * np.minimum(1, t / dur) * 0.9)) * (1 + 0.012 * np.sin(2 * np.pi * rng.uniform(4.5, 6.5) * t))
    phase = 2 * np.pi * np.cumsum(contour) / SR
    src = np.zeros(n)
    for h in range(1, 18):
        src += np.sin(h * phase) / h ** 1.1
    f1, f2 = vowel
    y = bp(src, f1 * 0.8, f1 * 1.25, 2) * 1.0 + bp(src, f2 * 0.85, f2 * 1.18, 2) * 0.6
    env = np.minimum(1, t / rng.uniform(0.08, 0.2)) * np.exp(-np.maximum(0, t - dur * 0.45) / (dur * 0.3))
    return y * env


def cheer(length=4.5, voices=34):
    n = int(length * SR)
    y = np.zeros(n)
    vowels = [(750, 1200), (600, 1700), (500, 1900), (700, 1100)]  # "ah", "ay", "eh", "aw"
    for v in range(voices):
        kid = rng.random() < 0.35
        f0 = rng.uniform(260, 420) if kid else rng.uniform(120, 260)
        d = rng.uniform(1.0, 2.2)
        s = voice_yay(f0, d, vowels[rng.integers(0, len(vowels))]) * rng.uniform(0.4, 1.0)
        at = rng.uniform(0.0, 0.5)
        i = int(at * SR)
        j = min(n, i + len(s))
        y[i:j] += s[: j - i]
    # airy crowd breath under it
    tt = np.arange(n) / SR
    air = bp(rng.standard_normal(n), 400, 3000) * np.minimum(1, tt / 0.3) * np.exp(-np.maximum(0, tt - 0.8) / 1.2) * 0.25
    y = y / (np.max(np.abs(y)) + 1e-9) + air
    ap = claps(length, people=30, rate=4.6, start_ramp=0.25, end_ramp=2.2)
    out = reverb(y, rt60=1.3, wet=0.25, seed=13)
    m = min(len(out), len(ap))
    return out[:m] * 0.8 + ap[:m] / (np.max(np.abs(ap)) + 1e-9) * 0.55


if __name__ == '__main__':
    total = float(sys.argv[2]) if len(sys.argv) > 2 else 109.833
    write('music.wav', music(total), peak=0.85)
    write('knock.wav', knock())
    write('ding.wav', ding())
    write('blow.wav', blow())
    write('claps.wav', claps())
    write('cheer.wav', cheer())
