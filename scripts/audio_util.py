#!/usr/bin/env python3
"""Small audio helpers shared by the pipeline (numpy + ffmpeg only).

  python3 scripts/audio_util.py trim  <in.mp3> <out.wav>   -> trims silence, prints {"offset","duration"}
  python3 scripts/audio_util.py probe <file>               -> prints {"duration","peak_db","rms_db"}
"""
import json
import subprocess
import sys
import wave

import numpy as np

SR = 44100


def decode(path, sr=SR, channels=1):
    """Decode any audio file to float32 numpy (frames, channels) via ffmpeg."""
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le',
           '-ac', str(channels), '-ar', str(sr), '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    return a.reshape(-1, channels) if channels > 1 else a


def write_wav(path, data, sr=SR):
    """Write float audio (n,) or (n, ch) to 16-bit PCM WAV."""
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data = data[:, None]
    pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def rms_windows(a, sr=SR, win=0.01):
    n = int(sr * win)
    m = len(a) // n
    if m == 0:
        return np.zeros(1), n
    seg = a[: m * n].reshape(m, n)
    return np.sqrt((seg ** 2).mean(axis=1) + 1e-12), n


def speech_bounds(a, sr=SR):
    """Speech start/end using a threshold relative to the take's own noise floor."""
    r, n = rms_windows(a, sr)
    db = 20 * np.log10(r)
    noise, speech = np.percentile(db, 10), np.percentile(db, 90)
    thr = max(noise + 8.0, speech - 30.0)
    idx = np.where(db > thr)[0]
    if len(idx) == 0:
        return 0.0, len(a) / sr
    return idx[0] * n / sr, (idx[-1] + 1) * n / sr


def denoise(src):
    """Light FFT denoise (removes the take's room-tone hiss) and decode to float."""
    cmd = ['ffmpeg', '-v', 'error', '-i', src, '-af', 'afftdn=nr=10:nf=-46:tn=1',
           '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', str(SR), '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim(src, dst, pre=0.05, post=0.18):
    a = denoise(src)
    s, e = speech_bounds(a)
    s = max(0.0, s - pre)
    e = min(len(a) / SR, e + post)
    out = a[int(s * SR): int(e * SR)].astype(np.float64)
    fi, fo = int(0.004 * SR), int(0.03 * SR)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    write_wav(dst, out)
    return {'offset': round(s, 4), 'duration': round(len(out) / SR, 4)}


def probe(src):
    a = decode(src)
    peak = float(np.abs(a).max() + 1e-12)
    rms = float(np.sqrt((a ** 2).mean()) + 1e-12)
    return {'duration': round(len(a) / SR, 4), 'peak_db': round(20 * np.log10(peak), 2),
            'rms_db': round(20 * np.log10(rms), 2)}


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'trim':
        print(json.dumps(trim(sys.argv[2], sys.argv[3])))
    elif cmd == 'probe':
        print(json.dumps(probe(sys.argv[2])))
    else:
        sys.exit(f'unknown command {cmd}')
