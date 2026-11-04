#!/usr/bin/env python3
"""Synthesise the soft background SFX (coin clink, siren, net swoosh) and mix
them under the untouched voiceover.

Usage: python3 tools/sfx.py assets/voiceover.mp3 OUT.wav

The voiceover is only resampled to 48 kHz and centred in stereo; it is not
edited, re-timed or processed. All effects sit well below it.
"""
import subprocess, sys, tempfile, os, wave
import numpy as np

SR = 48000
DUR = 30.0


def load_vo(path):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-ar", str(SR), "-ac", "1",
                    "-c:a", "pcm_s16le", tmp], check=True)
    w = wave.open(tmp, "rb")
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    w.close(); os.unlink(tmp)
    return x


def db(v):
    return 10 ** (v / 20)


def one_pole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s
        y[i] = s
    return y


def svf_bandpass(x, fc_curve, q=2.0):
    """State-variable band-pass with a per-sample centre frequency."""
    y = np.empty_like(x); lp = bp = 0.0
    for i, v in enumerate(x):
        f = 2 * np.sin(np.pi * min(fc_curve[i], SR / 6) / SR)
        hp = v - lp - bp / q
        bp += f * hp
        lp += f * bp
        y[i] = bp
    return y


def small_reverb(x, mix=0.25):
    out = x.copy()
    for d, g in [(0.023, 0.5), (0.041, 0.4), (0.067, 0.3), (0.093, 0.22), (0.131, 0.15)]:
        n = int(d * SR)
        out[n:] += x[:-n] * g * mix * 2
    return out


# ---- effects -----------------------------------------------------------------
def coin_clink(f0=2600, seed=0, bounce=True, dur=0.7):
    rng = np.random.default_rng(seed)
    t = np.arange(int(SR * dur)) / SR
    y = np.zeros_like(t)
    for r, a, d in [(1.0, 1.0, 0.32), (1.51, 0.62, 0.24), (2.22, 0.48, 0.17), (2.94, 0.3, 0.12), (3.71, 0.2, 0.08), (4.6, 0.12, 0.05)]:
        y += a * np.sin(2 * np.pi * f0 * r * (1 + rng.uniform(-0.012, 0.012)) * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    y += rng.standard_normal(len(t)) * np.exp(-t / 0.0015) * 0.6
    if bounce:
        n = int(SR * rng.uniform(0.05, 0.075))
        b = coin_clink(f0 * 1.04, seed + 101, bounce=False, dur=dur) * 0.35
        y[n:] += b[: len(y) - n]
    y *= np.minimum(1, t / 0.0008)
    return y / np.max(np.abs(y))


def jingle(n=5, seed=0, spread=0.18, f0=2500):
    rng = np.random.default_rng(seed)
    out = np.zeros(int(SR * (spread + 0.8)))
    for k in range(n):
        c = coin_clink(f0 * rng.uniform(0.85, 1.25), seed + k * 7, bounce=rng.random() < 0.5) * rng.uniform(0.45, 1.0)
        o = int(SR * rng.uniform(0, spread))
        out[o:o + len(c)] += c[: len(out) - o]
    return out / np.max(np.abs(out))


def siren(dur, hi=960, lo=770, period=0.72, seed=0):
    t = np.arange(int(SR * dur)) / SR
    target = np.where((t % period) < period / 2, hi, lo).astype(np.float64)
    f = one_pole_lp(target, 18.0)  # ~20 ms glide between tones
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.32 * np.sin(3 * ph) + 0.14 * np.sin(5 * ph) + 0.07 * np.sin(7 * ph)
    y = one_pole_lp(y, 2200.0)            # distant / muffled
    y = small_reverb(y, 0.35)
    return y / np.max(np.abs(y))


def net_swoosh(seed=0):
    rng = np.random.default_rng(seed)
    dur = 0.55
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    fc = 3200 * np.exp(-t / 0.12) + 450
    w = svf_bandpass(noise, fc, q=1.4)
    env = np.minimum(1, t / 0.06) * np.exp(-np.maximum(0, t - 0.16) / 0.07)
    w *= env
    # soft landing thump + rope rustle at the landing point (0.16 s)
    k = int(SR * 0.16)
    tt = t[: n - k]
    thump = np.sin(2 * np.pi * (95 * tt - 120 * tt ** 2)) * np.exp(-tt / 0.06)
    rustle = svf_bandpass(rng.standard_normal(n - k), np.full(n - k, 1800.0), q=1.0) * np.exp(-tt / 0.08)
    w[k:] += 0.9 * thump + 0.6 * rustle
    return w / np.max(np.abs(w))


# ---- cue sheet (seconds), matched to the picture --------------------------------
def build(vo):
    total = int(SR * DUR)
    L = np.zeros(total); Rr = np.zeros(total)

    def place(sig, at, gain_db, pan=0.0, fade_out_at=None):
        g = db(gain_db)
        s = sig * g
        if fade_out_at is not None:
            n = int(SR * max(0.0, fade_out_at - at))
            if n < len(s):
                fl = min(len(s) - n, int(SR * 0.08))
                s = s.copy(); s[n:n + fl] *= np.linspace(1, 0, fl); s[n + fl:] = 0
        i = int(SR * at)
        s = s[: total - i]
        L[i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan))
        Rr[i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan))

    # coin clinks
    place(coin_clink(2650, 1), 4.27, -21, -0.15)           # coin found under the pillow ("money")
    place(coin_clink(2900, 2, bounce=False), 9.98, -28, 0.1)  # coin glints for the officer
    place(jingle(3, 3, 0.08, 2300), 15.3, -27, 0.25)        # tooth drops into the fairy's coin bag
    place(coin_clink(2400, 4, bounce=False), 23.72, -29, -0.3)  # imaginary coins appear
    place(coin_clink(3100, 5, bounce=False), 23.98, -30, 0.3)
    place(jingle(3, 6, 0.06, 2800), 24.31, -23, 0.0)        # "money": pupils turn to coins
    place(jingle(6, 7, 0.32, 3300), 25.96, -26, 0.15)       # teeth tumble into the sack
    place(jingle(7, 8, 0.25, 2500), 26.8, -21, -0.1)        # "rich": raised fistful of coins
    # sirens
    place(siren(1.0, seed=1) * np.linspace(0.0, 1, int(SR * 1.0)) ** 0.5 * np.linspace(1, 0.0, int(SR * 1.0)) ** 1.5, 8.82, -27, 0.4)
    place(siren(1.2, seed=2), 19.42, -24, 0.3, fade_out_at=20.42)
    # net swoosh: fall starts 0.16 s before it lands at 19.27
    place(net_swoosh(3), 19.11, -19, -0.1)

    vo = vo[:total]
    L[: len(vo)] += vo
    Rr[: len(vo)] += vo
    mix = np.stack([L, Rr], axis=1)
    peak = np.max(np.abs(mix))
    if peak > db(-1.0):
        mix *= db(-1.0) / peak
    return mix


def main(src, dst):
    vo = load_vo(src)
    mix = build(vo)
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    w = wave.open(dst, "wb")
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
    w.close()
    print(f"wrote {dst}: {len(pcm) / SR:.2f}s stereo {SR} Hz, peak {20 * np.log10(np.max(np.abs(mix)) + 1e-9):.1f} dBFS")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
