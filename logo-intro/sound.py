"""Synthesised soundtrack for the logo intro (48 kHz stereo).

Everything is generated from scratch with numpy so the intro has no external
audio dependencies.  Cue times are passed in from the animation timeline so
picture and sound stay locked together.
"""
import wave

import numpy as np

SR = 48000


TARGET_LUFS = -14.0


def _lufs(x):
    """Integrated loudness (ITU-R BS.1770, K-weighting approximated in the FFT domain)."""
    f = np.fft.rfftfreq(x.shape[1], 1 / SR) + 1e-3
    shelf = 1 + (10 ** (4 / 20) - 1) * f ** 2 / (f ** 2 + 1500.0 ** 2)
    rlb = f ** 2 / np.sqrt(f ** 4 + 38.0 ** 4)
    k = np.fft.irfft(np.fft.rfft(x, axis=1) * shelf * rlb, x.shape[1], axis=1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([(k[:, i:i + blk] ** 2).mean(1).sum()
                   for i in range(0, k.shape[1] - blk + 1, hop)])
    ms = ms[-0.691 + 10 * np.log10(ms + 1e-12) > -70]
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    ms = ms[-0.691 + 10 * np.log10(ms) > rel]
    return -0.691 + 10 * np.log10(ms.mean())


def _t(n):
    return np.arange(n) / SR


def _env_exp(n, tau, attack=0.003):
    t = _t(n)
    return (1 - np.exp(-t / attack)) * np.exp(-t / tau)


def _fft_filter(x, lo=None, hi=None, slope=1.0):
    """Zero-phase band-pass with soft Butterworth-like skirts."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-3
    g = np.ones_like(f)
    if lo:
        g /= np.sqrt(1 + (lo / f) ** (4 * slope))
    if hi:
        g /= np.sqrt(1 + (f / hi) ** (4 * slope))
    return np.fft.irfft(X * g, len(x))


def _stft_band(x, centers, width_oct=0.9, nfft=2048):
    """Time-varying band-pass: `centers` gives the centre frequency per hop."""
    hop = nfft // 4
    win = np.hanning(nfft)
    n = len(x)
    pad = np.pad(x, (nfft, nfft + hop))
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(nfft, 1 / SR) + 1e-3
    frames = (len(pad) - nfft) // hop
    for i in range(frames):
        s = i * hop
        ti = min(max(s - nfft, 0), n - 1)
        fc = centers[ti]
        g = np.exp(-0.5 * (np.log2(f / fc) / (width_oct / 2)) ** 2)
        seg = np.fft.irfft(np.fft.rfft(pad[s:s + nfft] * win) * g, nfft) * win
        out[s:s + nfft] += seg
        norm[s:s + nfft] += win ** 2
    return (out / np.maximum(norm, 1e-6))[nfft:nfft + n]


def _pan(mono, p):
    """Equal-power pan, p in [-1, 1] (scalar or per-sample)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


def _place(bus, sig, at):
    i = int(round(at * SR))
    if i >= bus.shape[1]:
        return
    j = min(bus.shape[1], i + sig.shape[1])
    seg = sig[:, :j - i].copy()
    tail = min(seg.shape[1], int(0.03 * SR))      # de-click the cut-off end
    seg[:, -tail:] *= np.cos(np.linspace(0, np.pi / 2, tail)) ** 2
    bus[:, i:j] += seg


def _bell(freq, dur, tau, partials=((1, 1, 1), (2.76, .35, .45), (5.40, .18, .25),
                                    (8.93, .08, .12))):
    n = int(dur * SR)
    t = _t(n)
    s = np.zeros(n)
    for ratio, amp, tr in partials:
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * _env_exp(n, tau * tr, 0.001)
    return s


def _reverb(n_ir, rng, rt=2.2, predelay=0.022):
    """Stereo impulse response: decaying noise that darkens as it fades."""
    t = _t(n_ir)
    ir = []
    for _ in range(2):
        nz = rng.standard_normal(n_ir)
        low = _fft_filter(nz, hi=3000)
        high = nz - low
        tail = low * np.exp(-6.9 * t / rt) + 0.6 * high * np.exp(-6.9 * t / (rt * 0.45))
        tail *= 1 - np.exp(-t / 0.004)
        d = int(predelay * SR)
        ir.append(np.r_[np.zeros(d), tail[:-d]])
    ir = np.array(ir)
    return ir / np.sqrt((ir ** 2).sum(1, keepdims=True))


def _convolve(x, ir):
    n = x.shape[1] + ir.shape[1] - 1
    nf = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, nf)
    return np.fft.irfft(X * np.fft.rfft(ir, nf), nf)[:, :x.shape[1]]


def render(duration, cues, path, seed=3):
    rng = np.random.default_rng(seed)
    n = int(duration * SR)
    t = _t(n)
    dry = np.zeros((2, n))
    wet = np.zeros((2, n))   # sent to the reverb

    impact = cues["impact"]

    # -- air bed ------------------------------------------------------------
    air = _fft_filter(rng.standard_normal(n), lo=80, hi=900) * 0.018
    air *= np.clip(t / 1.0, 0, 1)
    dry += np.stack([air, np.roll(air, 911)])

    # -- riser into the impact ------------------------------------------------
    r0 = cues["riser"]
    rn = int((impact - r0) * SR)
    rt = _t(rn) / (impact - r0)
    centers = 250 * (7000 / 250) ** (rt ** 1.6)
    noise = _stft_band(rng.standard_normal(rn), centers, width_oct=1.4)
    swell = rt ** 2.4 * (1 - np.exp(-(1 - rt) * 60))
    riser = noise * swell * 0.55
    phase = 2 * np.pi * np.cumsum(110 * 4 ** (rt ** 1.3)) / SR
    tone = (np.sin(phase) + 0.5 * np.sin(1.5 * phase) + 0.25 * np.sin(2 * phase))
    riser += tone * swell * 0.06
    rs = np.stack([riser, _fft_filter(riser, hi=9000)])
    _place(dry, rs, r0)
    _place(wet, rs * 0.6, r0)

    # -- impact: sub drop, punch, cloud "pop" --------------------------------
    m = int(2.6 * SR)
    tm = _t(m)
    fsub = 36 + 95 * np.exp(-tm / 0.05)
    sub = np.sin(2 * np.pi * np.cumsum(fsub) / SR) * _env_exp(m, 0.75, 0.002)
    sub = np.tanh(sub * 1.6) * 0.55
    _place(dry, np.stack([sub, sub]), impact)

    punch = _fft_filter(rng.standard_normal(m), lo=60, hi=2500) * _env_exp(m, 0.09, 0.001)
    _place(dry, _pan(punch * 0.5, 0), impact)
    _place(wet, _pan(punch * 0.8, 0), impact)

    pn = int(0.35 * SR)
    tp = _t(pn)
    fpop = 380 + 700 * (1 - np.exp(-tp / 0.035))
    pop = np.sin(2 * np.pi * np.cumsum(fpop) / SR) * _env_exp(pn, 0.07, 0.002)
    pop += 0.3 * np.sin(2 * np.pi * np.cumsum(2 * fpop) / SR) * _env_exp(pn, 0.04, 0.002)
    _place(dry, _pan(pop * 0.32, 0), impact + 0.01)
    _place(wet, _pan(pop * 0.35, 0), impact + 0.01)

    shimmer = np.zeros(m)
    for k, f in enumerate([1174.66, 1479.98, 1760.0, 2349.32, 2959.96]):
        shimmer += _bell(f, 2.6, 1.1 - 0.12 * k)[:m] * (0.5 ** k)
    _place(wet, np.stack([shimmer, np.roll(shimmer, 480)]) * 0.10, impact + 0.02)

    # -- warm pad (D major add9) ---------------------------------------------
    notes = [73.42, 146.83, 220.0, 293.66, 369.99, 440.0, 659.26]
    levels = [0.55, 0.9, 0.7, 0.6, 0.5, 0.35, 0.22]
    p0 = impact
    pn = n - int(p0 * SR)
    tp = _t(pn)
    pad = np.zeros((2, pn))
    for f, lv in zip(notes, levels):
        for ch, det in enumerate((-0.0023, 0.0023)):
            ph = rng.uniform(0, 2 * np.pi)
            v = np.sin(2 * np.pi * f * (1 + det) * tp + ph)
            v += 0.25 * np.sin(2 * np.pi * 2 * f * (1 - det) * tp + ph)
            v += 0.08 * np.sin(2 * np.pi * 3 * f * tp + ph)
            pad[ch] += lv * v
    swell = 1 - np.exp(-tp / 0.9)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.23 * tp)
    pad *= swell * trem * 0.045
    _place(dry, pad, p0)
    _place(wet, pad * 0.5, p0)

    # -- eye sparkles ----------------------------------------------------------
    for at, f, p in zip(cues["sparkles"], (1760.0, 2217.46), (-0.35, 0.35)):
        b = _bell(f, 1.6, 0.55)
        _place(dry, _pan(b * 0.11, p), at)
        _place(wet, _pan(b * 0.20, p), at)

    # -- cloud glide whoosh ---------------------------------------------------
    g0, g1 = cues["glide"]
    gn = int((g1 - g0 + 0.3) * SR)
    gt = _t(gn) / (g1 - g0 + 0.3)
    wc = 500 + 1600 * np.sin(np.pi * np.clip(gt * 1.1, 0, 1)) ** 1.5
    wh = _stft_band(rng.standard_normal(gn), wc, width_oct=1.1)
    wh *= np.sin(np.pi * gt) ** 2 * 0.22
    _place(dry, _pan(wh, 0.5 - gt), g0)
    _place(wet, _pan(wh * 0.5, 0.5 - gt), g0)

    # -- letter plucks ---------------------------------------------------------
    for i, at in enumerate(cues["letters"]):
        f = [587.33, 739.99, 880.0, 1174.66][i % 4]
        pl = _bell(f, 1.2, 0.32, partials=((1, 1, 1), (2.0, .25, .5), (3.9, .12, .15)))
        p = -0.1 + 0.2 * i
        _place(dry, _pan(pl * 0.12, p), at)
        _place(wet, _pan(pl * 0.22, p), at)

    # -- light sweep shimmer --------------------------------------------------
    s0, s1 = cues["sweep"]
    sn = int((s1 - s0) * SR)
    st = _t(sn) / (s1 - s0)
    hiss = _fft_filter(rng.standard_normal(sn), lo=5000, hi=14000)
    hiss *= np.sin(np.pi * st) ** 2 * 0.045
    glass = sum(np.sin(2 * np.pi * f * _t(sn)) * a for f, a in
                ((2637.02, 1.0), (3520.0, 0.6), (4434.92, 0.35)))
    glass *= np.sin(np.pi * st) ** 3 * (1 + 0.5 * np.sin(2 * np.pi * 11 * _t(sn))) * 0.012
    sw = hiss + glass
    _place(dry, _pan(sw, -0.8 + 1.6 * st), s0)
    _place(wet, _pan(sw * 0.9, -0.8 + 1.6 * st), s0)

    # -- glint ting ------------------------------------------------------------
    b = _bell(2637.02, 1.5, 0.5) + 0.5 * _bell(3951.07, 1.5, 0.3)
    _place(dry, _pan(b * 0.08, 0.3), cues["glint"])
    _place(wet, _pan(b * 0.18, 0.3), cues["glint"])

    # -- blink boop ------------------------------------------------------------
    for at in cues["blinks"]:
        bn = int(0.12 * SR)
        tb = _t(bn)
        fb = 700 - 200 * tb / 0.12
        bl = np.sin(2 * np.pi * np.cumsum(fb) / SR) * _env_exp(bn, 0.03, 0.002)
        _place(dry, _pan(bl * 0.06, -0.2), at)
        _place(wet, _pan(bl * 0.06, -0.2), at)

    # -- mix -------------------------------------------------------------------
    ir = _reverb(int(2.8 * SR), rng)
    mix = dry + _convolve(wet, ir) * 0.9
    mix = np.stack([_fft_filter(c, lo=24) for c in mix])

    f0, f1 = cues["fade"]
    fade = np.clip((f1 - t) / (f1 - f0), 0, 1) ** 1.5
    mix *= fade
    mix = np.tanh(mix * 1.3) / 1.3
    mix *= 10 ** ((TARGET_LUFS - _lufs(mix)) / 20)
    peak = np.abs(mix).max()
    if peak > 0.89:                      # keep peaks under about -1 dBFS
        mix *= 0.89 / peak

    pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
