"""Shared paths and small audio helpers for the haunted-house reel tools."""
import json, os, subprocess, urllib.request
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
REEL = os.path.dirname(HERE)                      # larry-john/haunted-house
LJ = os.path.dirname(REEL)                        # larry-john
CACHE = os.path.join(LJ, ".cache")
AUDIO = os.path.join(REEL, "audio")
BUILD = os.path.join(REEL, "build")
OUT = os.path.join(REEL, "out")
SCRIPT = os.path.join(REEL, "script", "script.json")
SR = 48000                                         # all mixing happens at 48 kHz

def load_script():
    with open(SCRIPT) as f:
        return json.load(f)

def read_mono(path, sr=SR):
    """Read any audio file as mono float32 at `sr` (resampled with ffmpeg when needed)."""
    info = sf.info(path) if path.lower().endswith((".wav", ".flac", ".ogg")) else None
    if info is None or info.samplerate != sr:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                             check=True, capture_output=True).stdout
        return np.frombuffer(raw, dtype=np.float32).copy()
    x, _ = sf.read(path, dtype="float32", always_2d=True)
    return x.mean(axis=1)

def write_wav(path, x, sr=SR):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, np.asarray(x, dtype=np.float32), sr, subtype="PCM_24")

def resample(x, factor):
    """Play `x` `factor` times faster (raises pitch by 12*log2(factor) semitones)."""
    n = int(len(x) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(x)), x).astype(np.float32)

def trim_silence(x, thresh=0.01, pad=0.02, sr=SR):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]

def fetch(url, dest):
    """Download a file once into the local cache."""
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print("downloading", url)
        urllib.request.urlretrieve(url, dest + ".part")
        os.replace(dest + ".part", dest)
    return dest
