"""Synthesize SFX + background music in numpy and mix with the voiceover.

python audio.py OUT.wav
"""
import sys, json, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
rng = np.random.default_rng(1)
EV = json.load(open('/home/user/work/events.json'))
DUR = max(s['t1'] for s in EV['shots'])


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.1, shape=1.0):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr) ** shape
    return e


def expdec(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band')
    return signal.lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = signal.butter(order, min(f / (SR / 2), 0.99), 'low')
    return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def sweep(f0, f1, d, kind='exp'):
    tt = t_(d)
    if kind == 'exp':
        f = f0 * (f1 / f0) ** (tt / d)
    else:
        f = f0 + (f1 - f0) * tt / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR), f


def saw_from_freq(f):
    ph = np.cumsum(f) / SR
    return 2 * (ph % 1.0) - 1


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


# ------------------------------------------------------------------ sfx
def sfx_tuba(**k):
    d = 0.75
    tt = t_(d)
    f = 72 * (1 - 0.18 * tt / d) * (1 + 0.02 * np.sin(2 * np.pi * 6 * tt))
    x = saw_from_freq(f) + 0.5 * saw_from_freq(f * 2.003)
    x = lp(x, 900) * env(len(tt), 0.04, 0.25)
    wah = 0.6 + 0.4 * np.sin(np.pi * tt / d)
    return norm(x * wah, 0.9)


def sfx_scratch(**k):
    d = 0.42
    tt = t_(d)
    n = rng.normal(size=len(tt))
    pos = np.sin(2 * np.pi * 3.2 * tt) * np.exp(-tt * 2)
    vel = np.gradient(pos) * SR
    fc = 600 + 2400 * np.abs(vel) / (np.abs(vel).max() + 1e-9)
    out = np.zeros_like(n)
    blk = 256
    for i in range(0, len(n), blk):
        c = fc[i]
        out[i:i + blk] = bp(n[max(0, i - 512):i + blk], max(c * 0.6, 100), c * 1.4)[-len(n[i:i + blk]):]
    saw = saw_from_freq(120 + 900 * np.abs(vel) / (np.abs(vel).max() + 1e-9))
    x = out * 0.7 + 0.35 * lp(saw, 2500)
    return norm(x * env(len(tt), 0.005, 0.08), 0.8)


def sfx_faint(**k):
    s, f = sweep(2200, 500, 0.45)
    x = s * (1 + 0.3 * np.sin(2 * np.pi * 12 * t_(0.45))) * env(len(s), 0.01, 0.15)
    return norm(x, 0.5)


def sfx_thud(**k):
    d = 0.4
    tt = t_(d)
    s, _ = sweep(110, 45, d)
    x = s * expdec(len(tt), 0.09) + 0.6 * lp(rng.normal(size=len(tt)), 400) * expdec(len(tt), 0.03)
    return norm(x, 0.95)


def sfx_ding(**k):
    d = 1.4
    tt = t_(d)
    f0 = 1567.98
    x = np.zeros_like(tt)
    for m, a, tau in [(1, 1.0, 0.6), (2.0, 0.35, 0.35), (2.76, 0.25, 0.25), (5.4, 0.12, 0.12), (8.9, 0.06, 0.07)]:
        x += a * np.sin(2 * np.pi * f0 * m * tt) * np.exp(-tt / tau)
    return norm(x * env(len(tt), 0.002, 0.05), 0.7)


def sfx_rustle(**k):
    d = 0.5
    n = rng.normal(size=int(d * SR))
    am = np.abs(lp(rng.normal(size=len(n)), 30)) * 6
    return norm(bp(n, 1500, 7000) * am * env(len(n), 0.02, 0.2), 0.5)


def sfx_crunch(**k):
    d = 0.14
    n = int(d * SR)
    x = np.zeros(n)
    for _ in range(14):
        i = rng.integers(0, n - 400)
        x[i:i + 400] += rng.normal(size=400) * np.exp(-np.arange(400) / 60) * rng.uniform(0.3, 1)
    x = bp(x, 1200, 6000) + 0.4 * lp(rng.normal(size=n), 500) * expdec(n, 0.03)
    return norm(x * env(n, 0.002, 0.05), 0.55)


def sfx_chew(**k):
    d = 0.16
    n = int(d * SR)
    x = lp(rng.normal(size=n), 900) * np.sin(np.pi * np.arange(n) / n) ** 2
    s, _ = sweep(260, 180, d)
    return norm(x + 0.25 * s * np.sin(np.pi * np.arange(n) / n), 0.35)


def sfx_drip(**k):
    s, _ = sweep(700, 1700, 0.06)
    x = np.concatenate([s * expdec(len(s), 0.025), np.zeros(int(0.05 * SR))])
    return norm(x, 0.5)


def sfx_squish(**k):
    d = 0.35
    n = int(d * SR)
    tt = t_(d)
    x = lp(rng.normal(size=n), 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * tt))
    s, _ = sweep(300, 120, d)
    x = x + 0.5 * s
    return norm(x * env(n, 0.01, 0.15), 0.6)


def sfx_scrape(**k):
    d = 0.24
    n = int(d * SR)
    tt = t_(d)
    x = bp(rng.normal(size=n), 900, 4200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 60 * tt)))
    return norm(x * env(n, 0.01, 0.06), 0.55)


def sfx_stretch(dur=0.5, **k):
    tt = t_(dur)
    f = 180 * (3.2) ** (tt / dur) * (1 + 0.05 * np.sin(2 * np.pi * 18 * tt))
    x = lp(saw_from_freq(f), 1800) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR)
    return norm(x * env(len(tt), 0.03, 0.08), 0.45)


def sfx_squeak(pitch=1.0, **k):
    d = 0.2
    tt = t_(d)
    f = (900 + 500 * np.sin(np.pi * tt / d)) * pitch * (1 + 0.04 * np.sin(2 * np.pi * 30 * tt))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.2 * saw_from_freq(f)
    return norm(lp(x, 4000) * env(len(tt), 0.01, 0.05), 0.45)


def sfx_sadboing(**k):
    d = 0.9
    tt = t_(d)
    f = 420 * (0.4) ** (tt / d) * (1 + 0.12 * np.sin(2 * np.pi * 9 * tt) * np.exp(-tt * 2))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * saw_from_freq(f)
    return norm(lp(x, 2500) * env(len(tt), 0.01, 0.3), 0.6)


def sfx_poof(**k):
    d = 0.8
    n = int(d * SR)
    x = lp(rng.normal(size=n), 2500) * expdec(n, 0.18) * env(n, 0.01, 0.2)
    s, _ = sweep(160, 50, 0.3)
    x[:len(s)] += 0.6 * s * expdec(len(s), 0.08)
    return norm(x, 0.85)


def sfx_bubbling(dur=4.0, **k):
    n = int(dur * SR)
    x = np.zeros(n)
    t = 0.0
    while t < dur - 0.1:
        f0 = rng.uniform(250, 700)
        s, _ = sweep(f0, f0 * 1.8, 0.05)
        i = int(t * SR)
        x[i:i + len(s)] += s * expdec(len(s), 0.02) * rng.uniform(0.3, 1)
        t += rng.exponential(0.07)
    x += 0.15 * lp(rng.normal(size=n), 300)
    return norm(x * env(n, 0.2, 0.4), 0.35)


def sfx_plop(**k):
    s, _ = sweep(250, 650, 0.09)
    return norm(np.concatenate([s * expdec(len(s), 0.04), np.zeros(2000)]), 0.6)


def sfx_breath(**k):
    d = 0.6
    n = int(d * SR)
    x = bp(rng.normal(size=n), 2500, 9000) * np.sin(np.pi * np.arange(n) / n) ** 1.5
    tt = t_(d)
    sh = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.3) for f in (2637, 3136, 3951)) * 0.2
    return norm(x + sh, 0.5)


def sfx_gulp(**k):
    d = 0.3
    tt = t_(d)
    s, _ = sweep(220, 70, d)
    x = s * np.sin(np.pi * tt / d) ** 0.5
    x = lp(x, 900) + 0.3 * lp(rng.normal(size=len(tt)), 600) * expdec(len(tt), 0.02)
    return norm(x, 0.9)


def sfx_slide_down(**k):
    d = 0.6
    tt = t_(d)
    f = 1500 * (0.2) ** (tt / d) * (1 + 0.02 * np.sin(2 * np.pi * 7 * tt))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.1 * bp(rng.normal(size=len(tt)), 800, 3000)
    return norm(x * env(len(tt), 0.02, 0.1), 0.55)


def sfx_cough(**k):
    d = 0.22
    n = int(d * SR)
    x = bp(rng.normal(size=n), 300, 2200) * expdec(n, 0.06) * env(n, 0.004, 0.05)
    s, _ = sweep(180, 120, d)
    return norm(x + 0.4 * s * expdec(n, 0.05), 0.8)


def sfx_pop(**k):
    d = 0.18
    n = int(d * SR)
    x = rng.normal(size=n) * expdec(n, 0.012)
    x = hp(x, 400) + 0.5 * lp(rng.normal(size=n), 800) * expdec(n, 0.03)
    x[:30] += np.linspace(1, -1, 30) * 2
    return norm(x, 0.95)


def sfx_swirl(dur=0.9, **k):
    n = int(dur * SR)
    tt = t_(dur)
    x = rng.normal(size=n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        c = 400 + 3000 * (i / n)
        out[i:i + blk] = bp(x[max(0, i - 2048):i + blk], c * 0.7, c * 1.3)[-len(x[i:i + blk]):]
    return norm(out * np.sin(np.pi * tt / dur) ** 1.2, 0.45)


def sfx_boing(**k):
    d = 0.55
    tt = t_(d)
    f = 260 * (1 + 0.35 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt * 5)) * (1 + 0.6 * tt)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return norm(x * expdec(len(tt), 0.2), 0.6)


def sfx_snap(**k):
    s, _ = sweep(2600, 300, 0.07)
    x = np.concatenate([s * expdec(len(s), 0.03), np.zeros(int(0.08 * SR))])
    x[:60] += rng.normal(size=60) * 1.5
    return norm(x, 0.9)


def sfx_crickets(dur=2.0, **k):
    n = int(dur * SR)
    tt = t_(dur)
    car = np.sin(2 * np.pi * 4600 * tt)
    am = np.zeros(n)
    t = 0.05
    while t < dur - 0.1:
        for j in range(3):
            i = int((t + j * 0.045) * SR)
            L = int(0.03 * SR)
            if i + L < n:
                am[i:i + L] += np.sin(np.pi * np.arange(L) / L)
        t += 0.42
    return norm(car * am * env(n, 0.1, 0.2), 0.25)


def sfx_inflate(dur=2.0, **k):
    tt = t_(dur)
    f = 140 * (4.0) ** (tt / dur) * (1 + 0.07 * np.sin(2 * np.pi * 11 * tt))
    x = lp(saw_from_freq(f), 1600) * 0.6 + 0.2 * bp(rng.normal(size=len(tt)), 400, 2000)
    am = 0.75 + 0.25 * np.sin(2 * np.pi * 5 * tt)
    return norm(x * am * env(len(tt), 0.08, 0.15), 0.5)


def sfx_whoosh(**k):
    d = 0.9
    n = int(d * SR)
    x = rng.normal(size=n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        u = i / n
        c = 300 + 2800 * np.sin(np.pi * min(u * 1.3, 1)) ** 2
        out[i:i + blk] = bp(x[max(0, i - 2048):i + blk], c * 0.6, c * 1.5)[-len(x[i:i + blk]):]
    e = np.sin(np.pi * np.clip(np.arange(n) / n * 1.2, 0, 1)) ** 1.5
    return norm(out * e, 0.95)


def sfx_birds(**k):
    d = 0.9
    n = int(d * SR)
    x = np.zeros(n)
    for j in range(6):
        f0 = rng.uniform(2500, 4000)
        s, _ = sweep(f0, f0 * rng.uniform(1.2, 1.6), 0.06)
        i = int(rng.uniform(0, d - 0.1) * SR)
        x[i:i + len(s)] += s * np.sin(np.pi * np.arange(len(s)) / len(s))
    return norm(x, 0.35)


def sfx_fallwhistle(dur=0.95, **k):
    tt = t_(dur)
    f = 1900 * (0.22) ** (tt / dur)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.05, 0.05)
    return norm(x, 0.5)


def sfx_partyhorn(**k):
    d = 0.7
    tt = t_(d)
    f = 380 * (1 + 0.25 * np.clip(tt / 0.15, 0, 1)) * (1 + 0.03 * np.sin(2 * np.pi * 9 * tt))
    x = lp(saw_from_freq(f) + 0.5 * saw_from_freq(f * 1.5), 3500) + 0.3 * bp(rng.normal(size=len(tt)), 1000, 5000)
    return norm(x * env(len(tt), 0.02, 0.15), 0.6)


def brass(f, d):
    tt = t_(d)
    v = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * tt)
    x = sum(np.sin(2 * np.pi * f * m * v * tt) / m ** 1.1 for m in range(1, 8))
    bright = np.clip(tt / 0.05, 0, 1)
    return lp(x, 2500) * env(len(tt), 0.03, 0.08) * (0.7 + 0.3 * bright)


def sfx_fanfare(**k):
    notes = [(523.25, 0.0, 0.14), (659.25, 0.15, 0.14), (783.99, 0.3, 0.14), (1046.5, 0.45, 0.9)]
    n = int(1.5 * SR)
    x = np.zeros(n)
    for f, st, d in notes:
        b = brass(f, d)
        i = int(st * SR)
        x[i:i + len(b)] += b
    for f in (523.25, 659.25, 783.99):
        b = brass(f, 0.9) * 0.5
        i = int(0.45 * SR)
        x[i:i + len(b)] += b
    return norm(x, 0.7)


# ------------------------------------------------------------------ music
def music(dur):
    bpm = 132
    beat = 60 / bpm
    n = int(dur * SR)
    out = np.zeros(n + SR)
    chords = [(48, [0, 4, 7]), (53, [0, 4, 9]), (55, [0, 5, 7]), (48, [0, 4, 7])]   # C F G C (midi roots)

    def mtof(m):
        return 440 * 2 ** ((m - 69) / 12)

    def pluck(f, d=0.22, bright=1.0):
        tt = t_(d)
        x = np.sin(2 * np.pi * f * tt) + 0.4 * bright * np.sin(2 * np.pi * 2 * f * tt) + 0.15 * np.sin(2 * np.pi * 3 * f * tt)
        return x * np.exp(-tt / (d * 0.35)) * env(len(tt), 0.003, 0.03)

    def marimba(f, d=0.3):
        tt = t_(d)
        x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.12) + 0.3 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt / 0.03)
        return x * env(len(tt), 0.002, 0.02)

    def add(x, t, g):
        i = int(t * SR)
        if i >= len(out):
            return
        m = min(len(x), len(out) - i)
        out[i:i + m] += x[:m] * g

    mel_pat = [0, None, 7, 4, None, 7, 9, 7, 12, None, 9, 7, 4, None, 2, 4]
    t = 0.0
    bar = 0
    while t < dur:
        root, ch = chords[bar % 4]
        for b in range(4):                       # bass: root / fifth, bouncy
            f = mtof(root - 12 + (0 if b % 2 == 0 else 7))
            add(pluck(f, 0.28, 0.6), t + b * beat, 0.55)
            add(lp(rng.normal(size=int(0.03 * SR)), 3000) * expdec(int(0.03 * SR), 0.006), t + b * beat + beat / 2, 0.12)   # tick
        for b in range(8):                       # off-beat chord stabs
            if b % 2 == 1:
                for iv in ch:
                    add(pluck(mtof(root + 12 + iv), 0.12, 0.3), t + b * beat / 2, 0.08)
        for s in range(16):                      # marimba melody in 16ths (sparse)
            iv = mel_pat[(s + bar * 3) % 16]
            if iv is None or (s % 2 == 1 and rng.random() < 0.5):
                continue
            add(marimba(mtof(root + 24 + iv)), t + s * beat / 4, 0.16)
        t += 4 * beat
        bar += 1
    return out[:n]


def main(outfn):
    vo, sr = sf.read('/home/user/work/input/voiceover.mp3') if False else (None, None)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', '/home/user/work/input/voiceover.mp3', '-ac', '1', '-ar', str(SR),
                    '/home/user/work/test/vo48.wav'], check=True)
    vo, _ = sf.read('/home/user/work/test/vo48.wav')
    n = int(DUR * SR) + SR // 2
    VO = np.zeros(n); VO[:len(vo)] = vo[:n]
    SFX = np.zeros(n)
    gains = dict(tuba=0.55, scratch=0.5, faint=0.35, thud=0.6, ding=0.38, rustle=0.35, crunch=0.4, drip=0.35, squish=0.45,
                 scrape=0.4, chew=0.35, stretch=0.4, squeak=0.4, sadboing=0.5, poof=0.55, bubbling=0.3, plop=0.4, breath=0.4,
                 gulp=0.6, slide_down=0.45, cough=0.5, pop=0.6, swirl=0.35, boing=0.4, snap=0.55, crickets=0.28, inflate=0.4,
                 whoosh=0.7, birds=0.35, fallwhistle=0.4, partyhorn=0.5, fanfare=0.45)
    for e in EV['sfx']:
        fn = globals()['sfx_' + e['name']]
        kw = {k: v for k, v in e.items() if k in ('dur', 'pitch')}
        x = fn(**kw) * gains[e['name']] * e.get('vol', 1.0)
        i = int(e['t'] * SR)
        m = min(len(x), n - i)
        SFX[i:i + m] += x[:m]
    MUS = music(DUR + 0.5)[:n]
    MUS = np.pad(MUS, (0, max(0, n - len(MUS))))
    # duck music under the voice
    vo_env = lp(np.abs(VO), 6)
    vo_env = vo_env / (vo_env.max() + 1e-9)
    duck = 1 - 0.55 * np.clip(vo_env * 4, 0, 1)
    fade = np.ones(n); fl = int(0.6 * SR); fade[-fl:] = np.linspace(1, 0, fl)
    mix = VO * 1.0 + SFX * 0.55 + MUS * 0.11 * duck * fade
    # stereo: tiny width on music only
    st = np.stack([mix, mix], 1)
    sf.write('/home/user/work/test/mix_raw.wav', st.astype(np.float32), SR, subtype='FLOAT')
    sf.write('/home/user/work/test/stem_vo.wav', VO.astype(np.float32), SR, subtype='FLOAT')
    sf.write('/home/user/work/test/stem_sfx.wav', (SFX * 0.55).astype(np.float32), SR, subtype='FLOAT')
    sf.write('/home/user/work/test/stem_mus.wav', (MUS * 0.11 * duck * fade).astype(np.float32), SR, subtype='FLOAT')
    # loudness normalize to -14 LUFS (two-pass loudnorm), true peak -1.5
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', '/home/user/work/test/mix_raw.wav', '-af',
                        'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    js = r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1]
    m = json.loads(js)
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true:print_format=summary")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', '/home/user/work/test/mix_raw.wav', '-af', af, '-ar', str(SR), outfn], check=True)
    print('measured input', m['input_i'], 'LUFS')


if __name__ == '__main__':
    main(sys.argv[1])
