"""Procedural gun sound synthesis (numpy) + OGG Vorbis encoding via ffmpeg.

Every gunshot is built from layered components:
  * supersonic crack  - very short broadband transient
  * muzzle blast      - band-limited noise burst with a fast decay
  * body thump        - pitch-dropping sine for low-end punch
  * mechanism         - small high-frequency clicks of the action cycling
  * tail / echo       - long filtered noise decay (+ discrete echo for snipers)
Parameters per gun come from specs.py ("sound").
"""
import subprocess
import numpy as np

SR = 44100


def _lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def _lowpass_fast(x, fc, passes=2):
    # cascaded one-pole low-pass implemented with a cumulative filter in blocks
    for _ in range(passes):
        x = _lowpass(x, fc)
    return x


def _highpass(x, fc):
    return x - _lowpass(x, fc)


def _env(n, attack, decay, sustain_pow=1.0):
    t = np.arange(n) / SR
    e = np.where(t < attack, t / max(attack, 1e-6), np.exp(-(t - attack) / decay))
    return e ** sustain_pow


def _noise(rng, n):
    return rng.normal(0, 1, n)


def gunshot(p):
    rng = np.random.default_rng(p.get("seed", 1))
    kind = p.get("type", "rifle")
    tail_s = {"pistol": 0.55, "magnum": 0.85, "smg": 0.45, "rifle": 0.7, "lmg": 0.6,
              "sniper": 1.6, "heavy": 2.0, "shotgun": 1.1}[kind] * (0.6 + 0.4 * p.get("tail", 1.0))
    n = int(SR * tail_s)
    t = np.arange(n) / SR
    out = np.zeros(n)
    pitch = p.get("pitch", 1.0)

    # crack: very short broadband impulse
    crack_n = int(SR * 0.004)
    crack = _noise(rng, crack_n) * np.exp(-np.arange(crack_n) / (SR * 0.0012))
    out[:crack_n] += crack * 1.4 * p.get("crack", 1.0)

    # blast: noise burst, low-passed, fast decay
    blast_dec = {"pistol": 0.045, "magnum": 0.07, "smg": 0.035, "rifle": 0.06, "lmg": 0.05,
                 "sniper": 0.09, "heavy": 0.13, "shotgun": 0.1}[kind]
    blast = _noise(rng, n) * _env(n, 0.0008, blast_dec)
    blast = _lowpass_fast(blast, 2600 * pitch, 2) * 2.4 + _highpass(blast, 3500) * 0.35
    out += blast * 1.15

    # body: pitch-dropping sine thump
    f0 = {"pistol": 140, "magnum": 95, "smg": 150, "rifle": 105, "lmg": 100, "sniper": 70,
          "heavy": 52, "shotgun": 65}[kind] * pitch
    freq = f0 * (0.45 + 0.55 * np.exp(-t / 0.05))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * _env(n, 0.001, {"heavy": 0.22, "sniper": 0.16, "shotgun": 0.17}.get(kind, 0.09))
    out += body * 0.9 * p.get("body", 1.0)

    # mechanism clicks (bolt carrier / slide)
    if kind not in ("sniper", "shotgun"):
        for dt, amp in ((0.028, 0.2), (0.055, 0.14)):
            i0 = int(dt * SR / max(pitch, 0.5))
            m = int(SR * 0.006)
            if i0 + m < n:
                click = _highpass(_noise(rng, m), 3000) * np.exp(-np.arange(m) / (SR * 0.0015))
                out[i0:i0 + m] += click * amp

    # tail: reverberant decay
    tail = _noise(rng, n) * _env(n, 0.01, tail_s * 0.28)
    tail = _lowpass_fast(tail, 900 * pitch, 2)
    out += tail * 0.55 * p.get("tail", 1.0)
    if kind in ("sniper", "heavy", "magnum", "shotgun"):
        # distant echo
        d = int(SR * (0.26 if kind != "heavy" else 0.33))
        echo = np.zeros(n)
        echo[d:] = _lowpass_fast(out[:n - d], 700, 1) * 0.28
        out += echo

    # saturation for punch, then normalise and fade
    out = np.tanh(out * 1.6)
    out /= np.max(np.abs(out)) + 1e-9
    fade = int(SR * 0.03)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out * 0.97


def click(kind, seed=5):
    """Mechanical foley: mag out/in, charging handle, dry fire, bolt, pump."""
    rng = np.random.default_rng(seed)
    if kind == "dry":
        parts = [(0.0, 0.006, 4200, 0.7), (0.012, 0.004, 2600, 0.35)]
        dur = 0.12
    elif kind == "mag_out":
        parts = [(0.0, 0.008, 2200, 0.6), (0.05, 0.03, 900, 0.35), (0.16, 0.01, 1800, 0.3)]
        dur = 0.32
    elif kind == "mag_in":
        parts = [(0.0, 0.03, 900, 0.3), (0.06, 0.012, 2600, 0.9), (0.075, 0.006, 4200, 0.5)]
        dur = 0.25
    elif kind == "charge":
        parts = [(0.0, 0.03, 1500, 0.35), (0.09, 0.01, 2800, 0.8), (0.14, 0.03, 1200, 0.4),
                 (0.22, 0.012, 3200, 0.9)]
        dur = 0.4
    elif kind == "bolt":
        parts = [(0.0, 0.012, 3000, 0.6), (0.12, 0.05, 1100, 0.4), (0.3, 0.05, 1200, 0.4),
                 (0.48, 0.014, 3200, 0.8)]
        dur = 0.62
    elif kind == "pump":
        parts = [(0.0, 0.05, 900, 0.55), (0.06, 0.012, 2400, 0.7), (0.18, 0.05, 900, 0.55),
                 (0.24, 0.014, 2600, 0.9)]
        dur = 0.4
    elif kind == "shell_in":
        parts = [(0.0, 0.02, 1300, 0.45), (0.035, 0.01, 3000, 0.7)]
        dur = 0.15
    elif kind == "hitmarker":
        n = int(SR * 0.08)
        t = np.arange(n) / SR
        s = np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.012) + np.sin(2 * np.pi * 3600 * t) * np.exp(-t / 0.008) * 0.5
        return s / np.max(np.abs(s)) * 0.8
    else:
        raise ValueError(kind)
    n = int(SR * dur)
    out = np.zeros(n)
    for t0, length, fc, amp in parts:
        i0 = int(t0 * SR)
        m = int(length * SR)
        seg = _noise(rng, m) * np.exp(-np.arange(m) / (SR * length * 0.35))
        seg = _lowpass_fast(seg, fc * 1.6, 1) - _lowpass_fast(seg, fc * 0.4, 1)
        # metallic ring
        tt = np.arange(m) / SR
        seg += np.sin(2 * np.pi * fc * 1.3 * tt) * np.exp(-tt / (length * 0.25)) * 0.35
        out[i0:i0 + m] += seg[: max(0, min(m, n - i0))] * amp
    out /= np.max(np.abs(out)) + 1e-9
    return out * 0.9


def write_ogg(samples, path, quality=4):
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1",
           "-i", "pipe:0", "-c:a", "libvorbis", "-q:a", str(quality), path]
    subprocess.run(cmd, input=pcm, check=True)
