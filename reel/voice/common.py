"""Shared helpers for the reel voice / subtitle / export pipeline.

Pure numpy/scipy/soundfile (+ ffmpeg on PATH for rubberband / resampling).
Deterministic: no randomness anywhere.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import lfilter, resample_poly

REEL = Path(__file__).resolve().parent.parent
SCRIPT_JSON = REEL / "script.json"
TIMELINE_JSON = REEL / "timeline.json"
VOICES_DIR = REEL / "voices"
BUILD = REEL / "build"

SR = 48000                 # all voice files: 48 kHz mono
LINE_TARGET_LUFS = -20.0   # per-line loudness of stored voice files
LINE_PEAK_CEIL_DB = -1.0   # sample-peak ceiling of stored voice files
TRIM_PAD_S = 0.030         # silence kept before/after speech when trimming
TRIM_THRESH_DB = -42.0     # relative to the line's loudest 10 ms frame

ENGINES = ("elevenlabs", "local")


# ----------------------------------------------------------------- script ---
def load_script() -> dict:
    with open(SCRIPT_JSON, encoding="utf-8") as f:
        return json.load(f)


def load_timeline() -> dict:
    with open(TIMELINE_JSON, encoding="utf-8") as f:
        return json.load(f)


def script_words(text: str) -> list[str]:
    """The canonical subtitle tokens: split on whitespace, punctuation kept."""
    return text.split()


def line_ids() -> list[str]:
    return [ln["id"] for ln in load_script()["lines"]]


def python_exe() -> str:
    venv = REEL / ".venv" / "bin" / "python"
    return str(venv) if venv.exists() else (sys.executable or "python3")


def ffmpeg_exe() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def ffprobe_exe() -> str:
    return shutil.which("ffprobe") or "ffprobe"


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


# ------------------------------------------------------------------ audio ---
def to_mono(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def resample(x: np.ndarray, sr_in: int, sr_out: int = SR) -> np.ndarray:
    if sr_in == sr_out:
        return np.asarray(x, dtype=np.float64)
    g = np.gcd(int(sr_in), int(sr_out))
    return resample_poly(x, sr_out // g, sr_in // g, axis=0).astype(np.float64)


def read_audio(path, sr: int = SR, mono: bool = True) -> np.ndarray:
    x, fs = sf.read(str(path), dtype="float64", always_2d=False)
    if mono:
        x = to_mono(x)
    return resample(x, fs, sr)


def write_wav(path, x: np.ndarray, sr: int = SR, subtype: str = "PCM_24") -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.asarray(x, dtype=np.float64), sr, subtype=subtype)


def trim_silence(x: np.ndarray, sr: int = SR, pad: float = TRIM_PAD_S,
                 thresh_db: float = TRIM_THRESH_DB) -> tuple[np.ndarray, float]:
    """Trim leading/trailing silence. Returns (trimmed, seconds removed at start)."""
    hop = int(sr * 0.010)
    n = len(x) // hop
    if n < 3:
        return x, 0.0
    frames = x[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-20)
    db = 20 * np.log10(rms)
    thr = db.max() + thresh_db
    idx = np.where(db > thr)[0]
    if len(idx) == 0:
        return x, 0.0
    a = max(0, idx[0] * hop - int(pad * sr))
    b = min(len(x), (idx[-1] + 1) * hop + int(pad * sr))
    y = x[a:b].copy()
    # 5 ms fades so the cut is click-free
    f = min(int(0.005 * sr), len(y) // 2)
    if f > 0:
        ramp = np.linspace(0.0, 1.0, f)
        y[:f] *= ramp
        y[-f:] *= ramp[::-1]
    return y, a / sr


def speech_onset(x: np.ndarray, sr: int = SR, thresh_db: float = -30.0) -> float:
    """First time the 10 ms RMS exceeds (max + thresh_db)."""
    hop = int(sr * 0.010)
    n = len(x) // hop
    if n == 0:
        return 0.0
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-20)
    db = 20 * np.log10(rms)
    idx = np.where(db > db.max() + thresh_db)[0]
    return float(idx[0] * hop / sr) if len(idx) else 0.0


# BS.1770-4 K-weighting + gated integrated loudness (same maths as pyloudnorm)
def _biquad_shelf(fs, G=3.99984385397, Q=0.7071752369554193, fc=1681.9744509555319):
    A = 10 ** (G / 40.0)
    w0 = 2 * np.pi * fc / fs
    alpha = np.sin(w0) / (2 * Q)
    c = np.cos(w0)
    b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * alpha),
         -2 * A * ((A - 1) + (A + 1) * c),
         A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * alpha)]
    a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * alpha,
         2 * ((A - 1) - (A + 1) * c),
         (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * alpha]
    return np.array(b) / a[0], np.array(a) / a[0]


def _biquad_hp(fs, Q=0.5003270373253953, fc=38.13547087613982):
    w0 = 2 * np.pi * fc / fs
    alpha = np.sin(w0) / (2 * Q)
    c = np.cos(w0)
    b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    a = [1 + alpha, -2 * c, 1 - alpha]
    return np.array(b) / a[0], np.array(a) / a[0]


def integrated_lufs(x: np.ndarray, sr: int = SR) -> float:
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    b1, a1 = _biquad_shelf(sr)
    b2, a2 = _biquad_hp(sr)
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    T = int(0.4 * sr)
    step = int(0.1 * sr)
    if len(y) < T:
        z = np.mean(y ** 2, axis=0)[None, :]
    else:
        starts = np.arange(0, len(y) - T + 1, step)
        cs = np.vstack([np.zeros((1, y.shape[1])), np.cumsum(y ** 2, axis=0)])
        z = (cs[starts + T] - cs[starts]) / T
    lk = -0.691 + 10 * np.log10(z.sum(axis=1) + 1e-20)
    g = lk > -70
    if not g.any():
        return -70.0
    rel = -0.691 + 10 * np.log10(z[g].sum(axis=1).mean() + 1e-20) - 10
    g2 = g & (lk > rel)
    if not g2.any():
        return -70.0
    return float(-0.691 + 10 * np.log10(z[g2].sum(axis=1).mean() + 1e-20))


def normalize_line(x: np.ndarray, sr: int = SR, target: float = LINE_TARGET_LUFS,
                   peak_db: float = LINE_PEAK_CEIL_DB) -> np.ndarray:
    lufs = integrated_lufs(x, sr)
    y = x * 10 ** ((target - lufs) / 20)
    pk = np.max(np.abs(y)) + 1e-12
    ceil = 10 ** (peak_db / 20)
    if pk > ceil:
        # gentle soft-knee peak control instead of a hard gain drop
        y = soft_limit(y, ceil)
    return y


def soft_limit(x: np.ndarray, ceil: float) -> np.ndarray:
    """Smooth tanh-style limiter above 70% of ceil (transparent below)."""
    knee = 0.7 * ceil
    y = x.copy()
    ax = np.abs(y)
    m = ax > knee
    over = (ax[m] - knee) / (ceil - knee)
    y[m] = np.sign(y[m]) * (knee + (ceil - knee) * np.tanh(over))
    return y


def finish_line(x: np.ndarray, sr: int = SR) -> tuple[np.ndarray, float]:
    """Trim (30 ms pad) + normalize. Returns (audio, seconds trimmed at start)."""
    y, off = trim_silence(x, sr)
    return normalize_line(y, sr), off


def ffmpeg_filter_wav(src, dst, afilter: str, sr: int = SR) -> None:
    """Run an ffmpeg audio filter chain on a wav, output 48k mono float wav."""
    run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", afilter, "-ac", "1", "-ar", str(sr), "-c:a", "pcm_f32le", str(dst)])


def ffmpeg_filter_array(x: np.ndarray, afilter: str, sr: int = SR) -> np.ndarray:
    with tempfile.TemporaryDirectory() as td:
        a = os.path.join(td, "in.wav")
        b = os.path.join(td, "out.wav")
        sf.write(a, x, sr, subtype="FLOAT")
        ffmpeg_filter_wav(a, b, afilter, sr)
        y, fs = sf.read(b, dtype="float64")
    return to_mono(y)


def has_rubberband() -> bool:
    try:
        out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-filters"],
                             capture_output=True, text=True).stdout
        return " rubberband " in out
    except Exception:
        return False


def time_stretch(x: np.ndarray, tempo: float, sr: int = SR) -> tuple[np.ndarray, str]:
    """Speed speech up by `tempo` (>1 = faster) without changing pitch."""
    if abs(tempo - 1.0) < 1e-4:
        return x, "none"
    if has_rubberband():
        f = (f"rubberband=tempo={tempo:.5f}:pitch=1:transients=smooth:"
             f"detector=soft:phase=independent:window=standard:smoothing=on:"
             f"formant=preserved:pitchq=quality:channels=together")
        return ffmpeg_filter_array(x, f, sr), "rubberband"
    return ffmpeg_filter_array(x, f"atempo={tempo:.5f}", sr), "atempo"


# ------------------------------------------------------------------ words ---
def words_path(engine: str, lid: str) -> Path:
    return VOICES_DIR / engine / f"{lid}.words.json"


def wav_path(engine: str, lid: str) -> Path:
    return VOICES_DIR / engine / f"{lid}.wav"


def engine_complete(engine: str) -> bool:
    return all(wav_path(engine, i).exists() and words_path(engine, i).exists()
               for i in line_ids())


def validate_words(words: list[dict], text: str, dur: float, onset: float | None = None,
                   tol_onset: float = 0.25) -> list[str]:
    """Return a list of problems (empty = OK)."""
    probs = []
    toks = script_words(text)
    if [w["word"] for w in words] != toks:
        probs.append("words differ from script tokens")
    prev = -1e9
    for w in words:
        if w["start"] < prev - 1e-6:
            probs.append(f"non-monotonic start at {w['word']!r}")
        if w["end"] < w["start"] - 1e-6:
            probs.append(f"end<start at {w['word']!r}")
        if w["start"] < -1e-6 or w["end"] > dur + 1e-3:
            probs.append(f"{w['word']!r} outside wav (dur {dur:.3f})")
        prev = w["start"]
    if onset is not None and words and abs(words[0]["start"] - onset) > tol_onset:
        probs.append(f"first word start {words[0]['start']:.3f} far from onset {onset:.3f}")
    return probs
