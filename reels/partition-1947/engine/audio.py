"""All sound made in code: a soft music bed, whoosh/pop/boom effects, voice
cleanup and the final mix.

Usage (from render tooling):
  python3 audio.py --out mix.wav [--timing timing.json] [--voice-dir DIR]
                   [--t0 S] [--t1 S]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import scipy.signal as sg

SR = 48000
rng = np.random.default_rng(11)


# ------------------------------------------------------------------- io

def write_wav(path, x):
    x = np.asarray(x, np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_audio(path):
    """Any format ffmpeg can read -> float32 mono at SR."""
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


# ------------------------------------------------------------- helpers

def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_ad(n, a, d):
    """Attack-decay envelope (seconds)."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))
    return e


def band_noise(dur, f_curve, q=1.2, seed=None):
    """Noise whose spectrum is a moving band centred on f_curve(t)."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    x = r.standard_normal(n + 2048)
    f, tt, Z = sg.stft(x, SR, nperseg=1024, noverlap=768)
    centers = f_curve(np.clip(tt / dur, 0, 1))
    F = f[:, None]
    bw = centers[None, :] / q
    mask = np.exp(-0.5 * ((F - centers[None, :]) / bw) ** 2)
    _, y = sg.istft(Z * mask, SR, nperseg=1024, noverlap=768)
    y = y[:n]
    return y / (np.max(np.abs(y)) + 1e-9)


def pan(x, p):
    """p in [-1, 1] (scalar or array) -> stereo."""
    p = np.asarray(p)
    l = np.cos((p + 1) * np.pi / 4)
    r = np.sin((p + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1)


def reverb_ir(dur=2.2, decay=0.55, seed=5):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t / decay)[:, None]
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    b, a = sg.butter(1, 5500 / (SR / 2))
    ir = sg.lfilter(b, a, ir, axis=0)
    return ir / np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))


IR = None


def reverb(x, wet=0.25):
    global IR
    if IR is None:
        IR = reverb_ir()
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([sg.fftconvolve(x[:, i], IR[:, i])[:len(x)] for i in range(2)], 1)
    return x * (1 - wet) + y * wet


# ------------------------------------------------------------------ SFX

def sfx_whoosh(dur=0.55, lo=250, hi=3200, gain=1.0, seed=None):
    peak = 0.55
    y = band_noise(dur, lambda u: lo + (hi - lo) * np.sin(np.pi * np.clip(u / (2 * peak), 0, 1)) ** 2 * (1 - 0.6 * u), q=1.6,
                   seed=seed)
    t = np.linspace(0, 1, len(y))
    e = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / 0.16))
    return pan(y * e * gain, np.linspace(-0.6, 0.6, len(y)))


def sfx_whoosh_long():
    a = sfx_whoosh(1.4, 120, 1800, 1.0, seed=3)
    rum = band_noise(1.4, lambda u: 60 + 90 * u, q=1.0, seed=4)
    e = np.sin(np.pi * np.linspace(0, 1, len(rum))) ** 1.5
    return a + pan(rum * e * 0.7, 0.0)


def sfx_swoosh_up():
    return sfx_whoosh(0.35, 500, 2600, 0.8, seed=8)


def sfx_pop(pitch=1.0):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = (260 + 620 * (1 - np.exp(-t / 0.018))) * pitch
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * env_ad(n, 0.003, 0.055)
    y += 0.25 * np.sin(2 * ph) * env_ad(n, 0.002, 0.03)
    click = rng.standard_normal(n) * env_ad(n, 0.0005, 0.004) * 0.25
    return pan((y + click) * 0.9, 0.0)


def sfx_fill():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, g in ((659.3, 0.5), (987.8, 0.35), (1318.5, 0.2)):
        y += g * np.sin(2 * np.pi * f * t) * env_ad(n, 0.01, 0.35)
    air = band_noise(0.9, lambda u: 2500 + 3000 * u, q=1.2, seed=12) * env_ad(n, 0.05, 0.2) * 0.35
    return reverb(pan((y + air) * 0.6, 0.0), 0.35)


def sfx_shimmer():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, f in enumerate((587.3, 698.5, 880.0, 1174.7, 1396.9)):
        d = int(k * 0.06 * SR)
        e = np.zeros(n)
        e[d:] = env_ad(n - d, 0.005, 0.6)
        y += 0.35 * np.sin(2 * np.pi * f * t) * e
    sw = band_noise(1.8, lambda u: 1200 + 5000 * u, q=1.5, seed=13) * env_ad(n, 0.25, 0.5) * 0.3
    return reverb(pan(y + sw, 0.0), 0.45)


def sfx_boom():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f = 38 + 55 * np.exp(-t / 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.004, 0.42)
    nz = band_noise(1.4, lambda u: 180 + 300 * (1 - u), q=0.8, seed=14) * env_ad(n, 0.002, 0.12) * 0.6
    return reverb(pan((y + nz) * 0.9, 0.0), 0.3)


def sfx_thud():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 55 + 70 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.002, 0.14)
    nz = band_noise(0.5, lambda u: 400 + 0 * u, q=0.7, seed=15) * env_ad(n, 0.001, 0.03) * 0.5
    return pan((y + nz), 0.0)


def sfx_scribble(dur=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = band_noise(dur, lambda u: 3200 + 600 * np.sin(u * 40), q=2.0, seed=16)
    strokes = 0.5 + 0.5 * np.sin(2 * np.pi * 7.5 * t + 2 * np.sin(2 * np.pi * 1.3 * t))
    e = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.12)
    return pan(y * strokes ** 2 * e * 0.55, 0.15)


def sfx_flip():
    n = int(0.25 * SR)
    y = band_noise(0.25, lambda u: 2500 + 2000 * u, q=1.2, seed=17)
    e = env_ad(n, 0.01, 0.05)
    e2 = np.roll(env_ad(n, 0.005, 0.04), int(0.07 * SR))
    return pan(y * (e + 0.7 * e2) * 0.7, 0.2)


def sfx_tick():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2400 * t) * env_ad(n, 0.0005, 0.008)
    return pan(y * 0.6, 0.0)


def sfx_crackle(dur=2.0):
    n = int(dur * SR)
    y = np.zeros(n)
    r = np.random.default_rng(18)
    for _ in range(int(dur * 45)):
        i = r.integers(0, n - 2000)
        L = r.integers(80, 900)
        y[i:i + L] += r.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * r.uniform(0.2, 1)
    b, a = sg.butter(2, [1500 / (SR / 2), 9000 / (SR / 2)], 'band')
    y = sg.lfilter(b, a, y)
    roar = band_noise(dur, lambda u: 500 + 0 * u, q=0.7, seed=19) * 0.25
    e = np.minimum(1, np.arange(n) / SR / 0.2) * np.minimum(1, (dur - np.arange(n) / SR) / 0.4)
    return pan((y / (np.abs(y).max() + 1e-9) * 0.6 + roar) * e * 0.6, 0.0)


def sfx_train(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = band_noise(dur, lambda u: 700 + 0 * u, q=0.8, seed=20)
    beat = (np.sin(2 * np.pi * 3.2 * t) > 0.55).astype(float)
    beat = sg.lfilter([1 - 0.995], [1, -0.995], beat) * 30
    e = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8)
    return pan(y * np.clip(beat, 0, 1) * e * 0.5, np.linspace(0.5, -0.5, n))


def sfx_stamp():
    a = sfx_thud() * 1.1
    b = sfx_pop(0.6) * 0.5
    a[:len(b)] += b
    return a


def sfx_riser(dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = band_noise(dur, lambda u: 300 + 5000 * u ** 2, q=1.5, seed=21)
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / dur) ** 2) / SR) * 0.25
    e = (t / dur) ** 2
    return reverb(pan((y * 0.7 + tone) * e, 0.0), 0.3)


def sfx_ding():
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    y = sum(g * np.sin(2 * np.pi * f * t) for f, g in ((1174.7, 0.5), (1760, 0.25), (2349.3, 0.12))) * env_ad(n, 0.002, 0.6)
    return reverb(pan(y * 0.6, 0.0), 0.4)


SFX = {
    'whoosh': lambda kw: sfx_whoosh(seed=kw.get('seed')),
    'whoosh_long': lambda kw: sfx_whoosh_long(),
    'swoosh_up': lambda kw: sfx_swoosh_up(),
    'pop': lambda kw: sfx_pop(kw.get('pitch', 1.0)),
    'fill': lambda kw: sfx_fill(),
    'shimmer': lambda kw: sfx_shimmer(),
    'boom': lambda kw: sfx_boom(),
    'thud': lambda kw: sfx_thud(),
    'scribble': lambda kw: sfx_scribble(kw.get('dur', 1.4)),
    'flip': lambda kw: sfx_flip(),
    'tick': lambda kw: sfx_tick(),
    'crackle': lambda kw: sfx_crackle(kw.get('dur', 2.0)),
    'train': lambda kw: sfx_train(kw.get('dur', 3.0)),
    'stamp': lambda kw: sfx_stamp(),
    'riser': lambda kw: sfx_riser(kw.get('dur', 1.6)),
    'ding': lambda kw: sfx_ding(),
}


# ---------------------------------------------------------------- music

def ks_pluck(freq, dur, bright=0.6, seed=0):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    r = np.random.default_rng(seed)
    buf = r.uniform(-1, 1, p)
    out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % p
        buf[idx] = 0.5 * (buf[idx] + buf[nxt]) * (0.996 + 0.003 * bright)
        idx = nxt
    return out


_pluck_cache = {}


def pluck(freq, dur=2.5, bright=0.6):
    key = (round(freq, 2), dur, bright)
    if key not in _pluck_cache:
        _pluck_cache[key] = ks_pluck(freq, dur, bright, seed=int(freq))
    return _pluck_cache[key]


def note(n):
    """MIDI note -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


def make_music(total, sad=(), pulse_off=(), riser_at=None, end_at=None):
    """Quiet, clean bed in D minor (no noise, nothing busy): a warm sine pad,
    a soft sub note and a few gentle bell notes. It stays far under the voice."""
    n = int(total * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    bpm = 80
    beat = 60 / bpm
    bar = 4 * beat
    chords = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]]  # Dm Bb Gm A

    def in_ranges(x, ranges):
        return any(a <= x < b for a, b in ranges)

    # Warm pad: sine + soft harmonics, slow swells, gentle chorus.
    seg = 2 * bar
    start, k = 0.0, 0
    pad = np.zeros((n, 2))
    while start < total:
        ch = chords[k % 4]
        i0, i1 = int(start * SR), min(n, int((start + seg + 2.0) * SR))
        tt = np.arange(i1 - i0) / SR
        env = np.minimum(1, tt / 1.8) * np.clip((seg + 2.0 - tt) / 2.0, 0, 1)
        for j, m in enumerate(ch):
            f = note(m)
            for side, det in ((0, -0.04), (1, 0.04)):
                ff = f * 2 ** (det / 12)
                sig = np.sin(2 * np.pi * ff * tt) + 0.18 * np.sin(4 * np.pi * ff * tt) + 0.06 * np.sin(6 * np.pi * ff * tt)
                pad[i0:i1, side] += sig * env * (0.10 if j else 0.13)
        start += seg
        k += 1
    b, a = sg.butter(2, 1400 / (SR / 2))
    out += sg.lfilter(b, a, pad, axis=0)

    # Soft sub note on the chord roots.
    start, k = 0.0, 0
    while start < total:
        f = note(chords[k % 4][0] - 12)
        i0, i1 = int(start * SR), min(n, int((start + seg + 1.0) * SR))
        tt = np.arange(i1 - i0) / SR
        env = np.minimum(1, tt / 1.2) * np.clip((seg + 1.0 - tt) / 1.0, 0, 1)
        out[i0:i1] += pan(np.sin(2 * np.pi * f * tt) * env * 0.16, 0.0)
        start += seg
        k += 1

    # A few gentle bell notes (chord tones, one every two beats, skipped often).
    r = np.random.default_rng(4)
    tt0 = bar
    while tt0 < total - 1.5:
        if not in_ranges(tt0, sad) and r.random() < 0.55:
            ch = chords[int(tt0 // seg) % 4]
            m = ch[r.integers(1, 4)] + 12
            f = note(m)
            L = int(1.8 * SR)
            x = np.arange(L) / SR
            bell = (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * f * 2.0 * x)) * np.exp(-x / 0.55)
            bell *= np.minimum(1, x / 0.004)
            i0 = int(tt0 * SR)
            i1 = min(n, i0 + L)
            out[i0:i1] += pan(bell[:i1 - i0] * 0.07, r.uniform(-0.4, 0.4))
        tt0 += 2 * beat

    # Sad sections: softer.
    g = np.ones(n)
    for a0, a1 in sad:
        m = ((t > a0) & (t < a1)).astype(float)
        m = sg.lfilter([1 - 0.9997], [1, -0.9997], m)
        g *= 1 - 0.4 * np.clip(m, 0, 1)
    out *= g[:, None]
    out = reverb(out, 0.3)
    fi = np.minimum(1, t / 1.5)
    fo = np.clip((total - t) / 1.5, 0, 1)
    if end_at is not None:
        fo = np.minimum(fo, np.clip(1 - (t - end_at) / 1.5, 0, 1))
    out *= (fi * fo)[:, None]
    return out / (np.max(np.abs(out)) + 1e-9) * 0.8


# ------------------------------------------------------------------- mix

def loudnorm(in_wav, out_wav, target=-14.0):
    """Two-pass EBU R128 loudness normalisation with ffmpeg."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', in_wav, '-af',
                        'loudnorm=I=%s:TP=-1.5:LRA=9:print_format=json' % target, '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1]
    m = json.loads(txt)
    af = ('loudnorm=I=%s:TP=-1.5:LRA=9:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:'
          'offset=%s:linear=true' % (target, m['input_i'], m['input_tp'], m['input_lra'], m['input_thresh'],
                                     m['target_offset']))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', in_wav, '-af', af, '-ar', str(SR), out_wav], check=True)


def build_mix(story, out_wav, voice=None, t0=0.0, t1=None):
    """voice: mono float32 array on the story timeline (or None)."""
    total = story.total
    sad = [(story.S(9) - 0.3, story.E(10))] if len(story.starts) > 10 else []
    pulse_off = sad
    music = make_music(total, sad=sad, pulse_off=pulse_off, end_at=story.E(len(story.starts) - 1) + 0.4)
    n = len(music)
    fx = np.zeros((n, 2))
    for t, kind, gain, kw in story.sfx:
        if kind not in SFX:
            continue
        s = SFX[kind](kw) * gain
        i0 = int(max(0, t) * SR)
        i1 = min(n, i0 + len(s))
        if i1 > i0:
            fx[i0:i1] += s[:i1 - i0]
    if voice is not None:
        v = np.zeros(n)
        L = min(n, len(voice))
        v[:L] = voice[:L]
        env = np.abs(v)
        env = sg.lfilter([1 - 0.9993], [1, -0.9993], env)
        env = env / (env.max() + 1e-9)
        duck = 1 - 0.5 * np.clip(env * 3, 0, 1)
        mixed = pan(v, 0.0) * 1.0 + music * duck[:, None] * 0.09 + fx * 0.30
    else:
        mixed = music * 0.22 + fx * 0.55
    if t1 is None:
        t1 = total
    mixed = mixed[int(t0 * SR):int(t1 * SR)]
    tmp = tempfile.mktemp(suffix='.wav', dir=os.path.dirname(os.path.abspath(out_wav)))
    write_wav(tmp, mixed / (np.max(np.abs(mixed)) + 1e-9) * 0.9)
    loudnorm(tmp, out_wav, -14.0)
    os.remove(tmp)
    return out_wav


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--timing', default=None)
    ap.add_argument('--voice', default=None, help='voice track wav already placed on the timeline')
    ap.add_argument('--voice-dir', default=None, help='folder with part1.wav..partN.wav (placed at the part starts)')
    ap.add_argument('--voice-out', default=None, help='also write the placed voice track here')
    ap.add_argument('--t0', type=float, default=0.0)
    ap.add_argument('--t1', type=float, default=None)
    args = ap.parse_args()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from story import Story
    import core
    dur, wt = None, None
    if args.timing and os.path.exists(args.timing):
        tm = json.load(open(args.timing))
        dur, wt = tm['durations'], tm.get('word_times')
    story = Story(dur, wt, core.Sprites(None))
    voice = read_audio(args.voice) if args.voice else None
    if args.voice_dir:
        voice = np.zeros(int((story.total + 1) * SR), np.float32)
        for i, t0 in enumerate(story.starts):
            x = read_audio(os.path.join(args.voice_dir, 'part%d.wav' % (i + 1)))
            a = int(t0 * SR)
            voice[a:a + len(x)] += x[:len(voice) - a]
        if args.voice_out:
            write_wav(args.voice_out, voice)
    build_mix(story, args.out, voice, args.t0, args.t1)
    print('wrote', args.out)
