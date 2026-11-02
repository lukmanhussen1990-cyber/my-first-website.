#!/usr/bin/env python3
"""Final mix: voiceover + SFX cues (ElevenLabs + code-made) -> stereo 48 kHz (video length), -14 LUFS integrated, true peak <= -1.5 dBTP.

Usage:   python3 mix.py [--stems DIR]        (--stems also writes voice/sfx stems there for analysis)
Reads:   audio/voiceover.wav, audio/vo_lines.json, audio/sfx_cues.json (+ the audio/sfx/*.wav it names),
         web/plan.js (only for the per-shot balance report)
Writes:  audio/mix.wav         pre-normalisation mix (24-bit; voice at -20 LUFS, peak <= -1 dBFS)
         audio/mix_final.wav   final master (24-bit, 48 kHz stereo)

Chain:
  voice (mono, centred) scaled to -20 LUFS integrated
  + SFX bus: every cue at its gain_db (effects are made at -20 LUFS momentary max, see make_sfx.py), optional
    offset/dur/fade_in/fade_out, ducked duck_db (default 6 dB) while the voice speaks (smooth 40 ms attack,
    250 ms release, starts 80 ms before each line). The rumbles use duck_db 1.5 and cap_db: their loudest 400 ms
    is held at least |cap_db| under the voice's speech level (and under the voice right where they play).
  -> final 0.3 s fade-out -> mix.wav
  -> gentle bus compressor (2:1) -> gain + true-peak look-ahead limiter (ceiling -2 dBTP), iterated to -14 LUFS
  -> ffmpeg loudnorm two-pass (linear mode: a tiny exact gain trim) -> mix_final.wav -> ffmpeg ebur128 check.
cue fields: t (s), file (project-relative), gain_db, note, [offset, dur, fade_in, fade_out, duck_db, cap_db]
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(HERE, "audio")
SR = 48000
DUR = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots.json")))["duration"]  # = video length
VOICE_LUFS = -20.0
TARGET_I = -14.0
TARGET_TP = -1.5
LIMIT_CEIL = -2.0          # internal true-peak ceiling (0.5 dB margin for loudnorm/AAC)
DEFAULT_DUCK = 6.0

_spec = importlib.util.spec_from_file_location("sfx_lib", os.path.join(HERE, "sfx_lib.py"))
mk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mk)
momentary, integrated, read_plan = mk.momentary, mk.integrated, mk.read_plan


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def cosramp(n):
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(1, n))


# ------------------------------------------------------------------------------------------- ducking
def voice_activity(lines, L, pre=0.08, post=0.10, att=0.04, rel=0.25):
    """0..1 envelope: 1 while a line is spoken (smooth attack/release), sample-rate."""
    cr = 1000
    m = np.zeros(int(DUR * cr) + 2)
    for l in lines:
        m[max(0, int((l["start"] - pre) * cr)):int((l["end"] + post) * cr)] = 1.0
    ca, cr_ = np.exp(-1 / (att * cr)), np.exp(-1 / (rel * cr))
    e = np.zeros_like(m)
    v = 0.0
    for i, x in enumerate(m):
        c = ca if x > v else cr_
        v = c * v + (1 - c) * x
        e[i] = v
    # smoothing is causal: shift the attack earlier by ~att so the duck is in place when the word starts
    e = np.concatenate([e[int(att * cr):], np.full(int(att * cr), e[-1])])
    return np.interp(np.arange(L) / SR, np.arange(len(e)) / cr, e)


# ------------------------------------------------------------------------------------------ dynamics
def compressor(x, thr_db, ratio=2.0, knee=6.0, att=0.006, rel=0.12, block=32):
    """Stereo-linked feed-forward RMS compressor (control at block rate). Returns (y, gain_db per sample)."""
    nb = len(x) // block + 1
    xp = np.concatenate([x, np.zeros((nb * block - len(x), x.shape[1]))])
    p = np.mean(xp.reshape(nb, block, -1) ** 2, axis=(1, 2))
    ca, cr = np.exp(-block / (att * SR)), np.exp(-block / (rel * SR))
    lv = np.zeros(nb)
    v = 1e-12
    for i, q in enumerate(p.tolist()):
        c = ca if q > v else cr
        v = c * v + (1 - c) * q
        lv[i] = v
    L = 10 * np.log10(lv + 1e-20) + 3.01            # mean-square of a stereo pair -> RMS-ish dB re full scale sine
    over = L - thr_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, (1 / ratio - 1) * over, (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    tb = (np.arange(nb) + 0.5) * block
    g = np.interp(np.arange(len(x)), tb, gr)
    return x * 10 ** (g / 20)[:, None], g


def true_peak_env(x, os_=4):
    """Per-sample true peak estimate (max over 4x oversampled neighbourhood, all channels)."""
    up = signal.resample_poly(x, os_, 1, axis=0)
    a = np.abs(up).max(axis=1)
    a = a[:len(x) * os_].reshape(len(x), os_).max(axis=1)
    return ndimage.maximum_filter1d(a, 3)


def limiter(x, ceil_db=LIMIT_CEIL, look=0.003, rel=0.08, block=16):
    """True-peak look-ahead limiter. Gain never exceeds what keeps the oversampled peak under the ceiling."""
    c = 10 ** (ceil_db / 20)
    pk = true_peak_env(x)
    greq = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    Lk = int(look * SR)
    gmin = ndimage.minimum_filter1d(greq, Lk, origin=-(Lk // 2))          # forward-looking min over [n, n+Lk)
    nb = len(x) // block + 1
    gp = np.concatenate([gmin, np.ones(nb * block - len(gmin))]).reshape(nb, block).min(axis=1)
    cr = np.exp(-block / (rel * SR))
    gr = np.empty(nb)
    v = 1.0
    for i, q in enumerate(gp.tolist()):
        v = q if q < v else (cr * v + (1 - cr) * q)
        gr[i] = v
    g = np.minimum(gmin, np.repeat(gr, block)[:len(x)])
    g = ndimage.uniform_filter1d(g, Lk, origin=(Lk - 1) // 2)              # backward average over [n-Lk+1, n]
    g = np.minimum(g, greq)                                                  # numerical safety
    return x * g[:, None], g


def tp_db(x):
    return float(db(true_peak_env(x).max()))


# ------------------------------------------------------------------------------------------- ffmpeg
UP192 = "aresample=192000:resampler=soxr:precision=28"     # loudnorm runs at 192 kHz; same resampler in both passes


def ff_loudnorm_measure(path, lra):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                          f"{UP192},loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={lra}:print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True, check=True).stderr
    return json.loads(out[out.rindex("{"):out.rindex("}") + 1])


def ff_ebur128(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True, check=True).stderr
    s = out[out.rindex("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", s).group(1))
    LRA = float(re.search(r"LRA:\s+(-?[\d.]+) LU", s).group(1))
    TP = float(re.search(r"True peak:\s+Peak:\s+(-?[\d.inf]+) dBFS", s).group(1))
    return I, TP, LRA


# --------------------------------------------------------------------------------------------- main
def load_cue_audio(c):
    x, sr = sf.read(os.path.join(HERE, c["file"]), always_2d=True)
    assert sr == SR, f"{c['file']}: {sr} Hz"
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    off = int(round(c.get("offset", 0.0) * SR))
    x = x[off:]
    if c.get("loop") and "dur" in c:      # bed shorter than its cue: repeat with 0.5 s equal-power crossfades
        need, xf = int(round(c["dur"] * SR)), int(0.5 * SR)
        w = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
        while len(x) < need:
            x = np.concatenate([x[:-xf], x[-xf:] * w[::-1] + x[:xf] * w, x[xf:]])
    if "dur" in c:
        x = x[:int(round(c["dur"] * SR))].copy()
    if "lp" in c:                           # distant sound: low-pass
        b_, a_ = signal.butter(2, c["lp"] / (SR / 2), "low")
        x = signal.lfilter(b_, a_, x, axis=0)
    fi, fo = int(c.get("fade_in", 0.0) * SR), int(c.get("fade_out", 0.0) * SR)
    if off > 0 and fi == 0:
        fi = int(0.005 * SR)
    if "dur" in c and fo == 0:
        fo = int(0.01 * SR)
    if fi:
        x[:fi] *= cosramp(fi)[:, None]
    if fo:
        x[-fo:] *= cosramp(fo)[::-1][:, None]
    return x


def main():
    stems_dir = None
    if "--stems" in sys.argv:
        stems_dir = sys.argv[sys.argv.index("--stems") + 1]
        os.makedirs(stems_dir, exist_ok=True)
    L = int(round(DUR * SR))
    vo, sr = sf.read(os.path.join(AUD, "voiceover.wav"), always_2d=True)
    assert sr == SR
    vo = vo.mean(axis=1)
    voice = np.zeros(L)
    voice[:min(L, len(vo))] = vo[:L]
    voice2 = np.repeat(voice[:, None], 2, axis=1)
    vg = VOICE_LUFS - integrated(voice2)
    voice2 *= 10 ** (vg / 20)
    lines = json.load(open(os.path.join(AUD, "vo_lines.json")))["lines"]
    act = voice_activity(lines, L)
    vm, vt = momentary(voice2)
    speaking = np.array([act[min(L - 1, int((t + 0.2) * SR))] > 0.5 for t in vt])
    v_ref = float(np.percentile(vm[speaking], 95))
    print(f"voice: gain {vg:+.2f} dB -> {VOICE_LUFS} LUFS integrated, speech level (95th pct momentary) {v_ref:.1f} LUFS")

    cues = json.load(open(os.path.join(AUD, "sfx_cues.json")))
    sfx = np.zeros((L, 2))
    report = []
    for c in cues:
        x = load_cue_audio(c)
        i0 = int(round(c["t"] * SR))
        if i0 >= L:
            continue
        x = x[:L - i0]
        i1 = i0 + len(x)
        duck = 10 ** (-c.get("duck_db", DEFAULT_DUCK) * act[i0:i1] / 20)
        y = x * duck[:, None] * 10 ** (c["gain_db"] / 20)
        lvl = float(momentary(y)[0].max())
        trim = 0.0
        if "cap_db" in c:
            # hold the effect under the voice: its loudest 400 ms <= speech level + cap_db, and <= the voice right there
            w0, w1 = c["t"] - 0.3, i1 / SR + 0.3
            near = vm[(vt + 0.2 >= w0) & (vt + 0.2 <= w1)]
            local = float(near.max()) if len(near) and near.max() > -60 else v_ref
            limit = min(v_ref + c["cap_db"], local - 0.5)
            if lvl > limit:
                trim = limit - lvl
                y *= 10 ** (trim / 20)
                lvl += trim
        sfx[i0:i1] += y
        report.append((c, lvl, trim))

    mix = voice2 + sfx
    fo = int(0.3 * SR)
    mix[-fo:] *= cosramp(fo)[::-1][:, None]
    mix[:int(0.005 * SR)] *= cosramp(int(0.005 * SR))[:, None]
    pk = np.abs(mix).max()
    s = min(1.0, 10 ** (-1 / 20) / pk)
    sf.write(os.path.join(AUD, "mix.wav"), (mix * s).astype(np.float32), SR, subtype="PCM_24")
    print(f"pre-norm mix: {integrated(mix):.1f} LUFS, sample peak {db(pk):.1f} dBFS (written x{s:.3f}) -> audio/mix.wav")

    # ---- master: compressor + iterated gain/limiter to -14 LUFS, then loudnorm (linear) for the exact trim
    comp, cg = compressor(mix, thr_db=-21.0, ratio=2.0)
    g = TARGET_I - integrated(comp)
    for it in range(8):
        y, lg = limiter(comp * 10 ** (g / 20))
        I = integrated(y)
        if abs(I - TARGET_I) < 0.03:
            break
        g += TARGET_I - I
    print(f"master: compressor GR max {-cg.min():.1f} dB (mean over speech {-cg[act > 0.5].mean():.1f} dB), "
          f"gain {g:+.2f} dB, limiter GR max {-db(lg.min()):.1f} dB, >1 dB GR {np.mean(lg < 10 ** (-1 / 20)) * 100:.1f}% of the time")
    print(f"master (python): {I:.2f} LUFS, true peak {tp_db(y):.2f} dBTP")
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "master.wav")
        sf.write(tmp, y.astype(np.float32), SR, subtype="FLOAT")
        m1 = ff_loudnorm_measure(tmp, 20)
        lra = min(50.0, max(11.0, float(m1["input_lra"]) + 1.0))
        out = os.path.join(AUD, "mix_final.wav")
        af = (f"{UP192},"
              f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={lra}:measured_I={m1['input_i']}:measured_TP={m1['input_tp']}:"
              f"measured_LRA={m1['input_lra']}:measured_thresh={m1['input_thresh']}:offset={m1['target_offset']}:"
              f"linear=true:print_format=json,aresample=48000:resampler=soxr:precision=28")
        r2 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", tmp, "-af", af, "-ar", str(SR), "-ac", "2",
                             "-c:a", "pcm_s24le", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-map_metadata", "-1", out],
                            capture_output=True, text=True, check=True).stderr
        m2 = json.loads(r2[r2.rindex("{"):r2.rindex("}") + 1])
    print(f"loudnorm pass 1: I {m1['input_i']} LUFS, TP {m1['input_tp']} dBTP, LRA {m1['input_lra']}  ->  "
          f"pass 2: {m2['normalization_type']}, output I {m2['output_i']} TP {m2['output_tp']}")
    I, TP, LRA = ff_ebur128(out)
    ok = abs(I - TARGET_I) <= 0.5 and TP <= TARGET_TP
    print(f"FINAL audio/mix_final.wav (ffmpeg ebur128): integrated {I:.1f} LUFS, true peak {TP:.1f} dBTP, LRA {LRA:.1f} LU"
          f"  [{'OK' if ok else 'OUT OF SPEC'}]")

    # ---- balance report (in the master's scale)
    gm = 10 ** (g / 20)
    vk = mk._power(voice2 * gm)
    sk = mk._power(sfx * gm)
    try:
        plan = read_plan()
    except Exception:
        plan = []
    print("\nper-shot balance (mean K-weighted power over the shot, LUFS-ish; diff = SFX - voice)")
    for s_ in plan:
        a, b = int(s_["t0"] * SR), int(s_["t1"] * SR)
        lv = -0.691 + 10 * np.log10(vk[a:b].mean() + 1e-20)
        ls = -0.691 + 10 * np.log10(sk[a:b].mean() + 1e-20)
        print(f"  {s_['id']} {s_['t0']:5.2f}-{s_['t1']:5.2f}  voice {lv:6.1f}  sfx {ls:6.1f}  diff {ls - lv:+6.1f} dB")
    print("\ncue levels (loudest 400 ms in the mix, relative to the voice speech level)")
    for c, lvl, trim in report:
        print(f"  {c['t']:6.2f}  {os.path.basename(c['file']):18s} gain {c['gain_db']:+5.1f}  "
              f"duck {c.get('duck_db', DEFAULT_DUCK):3.1f}  level {lvl - v_ref:+6.1f} dB{'  (capped %+.1f)' % trim if trim else ''}")
    if stems_dir:
        sf.write(os.path.join(stems_dir, "voice.wav"), (voice2 * gm).astype(np.float32), SR, subtype="FLOAT")
        sf.write(os.path.join(stems_dir, "sfx.wav"), (sfx * gm).astype(np.float32), SR, subtype="FLOAT")
        print("stems written to", stems_dir)
    if not ok:
        sys.exit("final loudness out of spec")


if __name__ == "__main__":
    main()
