"""Clean up the voiceover parts: tighten long pauses, nudge the pace, gentle
EQ/compression and even loudness per part.

Usage: python3 voice.py <in-dir with part1..partN> <out-dir> [--tempo 1.05]
"""
import argparse
import glob
import json
import os
import subprocess

import numpy as np

SR = 48000


def decode(path):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def ffmpeg_filter(x, af):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', af,
                        '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], input=x.astype(np.float32).tobytes(),
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).copy()


def loudness(x):
    p = subprocess.run(['ffmpeg', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'ebur128',
                        '-f', 'null', '-'], input=x.astype(np.float32).tobytes(), capture_output=True)
    txt = p.stderr.decode()
    i = txt.rfind('I:')
    return float(txt[i + 2:].split('LUFS')[0])


def silences(x, thresh_db=-40.0, min_len=0.12, hop=0.01):
    n = int(hop * SR)
    frames = len(x) // n
    rms = np.sqrt(np.mean(x[:frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    quiet = db < thresh_db
    out = []
    i = 0
    while i < frames:
        if quiet[i]:
            j = i
            while j < frames and quiet[j]:
                j += 1
            if (j - i) * hop >= min_len or i == 0 or j == frames:
                out.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    return out


def tighten(x, sil, lead=0.03, tail=0.10):
    """Shorten pauses: internal pause p -> 0.12 + 0.2 * (p - 0.12)."""
    pieces = []
    pos = 0.0
    dur = len(x) / SR
    fade = int(0.008 * SR)
    for s, e in sil:
        if s <= 0.001:
            pos = max(0.0, e - lead)
            continue
        if e >= dur - 0.011:
            pieces.append(x[int(pos * SR):int(min(dur, s + tail) * SR)])
            pos = dur
            break
        p = e - s
        q = 0.12 + 0.2 * max(0.0, p - 0.12)
        keep_a = s + q / 2
        keep_b = e - q / 2
        pieces.append(x[int(pos * SR):int(keep_a * SR)])
        pos = keep_b
    if pos < dur:
        pieces.append(x[int(pos * SR):])
    out = pieces[0]
    for pc in pieces[1:]:
        if len(out) > fade and len(pc) > fade:
            r = np.linspace(0, 1, fade, dtype=np.float32)
            mid = out[-fade:] * (1 - r) + pc[:fade] * r
            out = np.concatenate([out[:-fade], mid, pc[fade:]])
        else:
            out = np.concatenate([out, pc])
    return out


def write_wav(path, x):
    import wave
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--tempo', type=float, default=1.05)
    ap.add_argument('--target', type=float, default=-16.0)
    args = ap.parse_args()
    os.makedirs(args.dst, exist_ok=True)
    files = sorted(glob.glob(os.path.join(args.src, 'part*')), key=lambda p: int(''.join(ch for ch in os.path.basename(p) if ch.isdigit())))
    report = []
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        x = decode(f)
        raw = len(x) / SR
        x = tighten(x, silences(x))
        af = 'highpass=f=70,acompressor=threshold=-22dB:ratio=2.2:attack=6:release=90:makeup=1'
        if abs(args.tempo - 1.0) > 1e-3:
            af = 'atempo=%.4f,' % args.tempo + af
        x = ffmpeg_filter(x, af)
        g = 10 ** ((args.target - loudness(x)) / 20)
        x = x * g
        peak = np.max(np.abs(x))
        if peak > 0.95:
            x *= 0.95 / peak
        write_wav(os.path.join(args.dst, name + '.wav'), x)
        report.append((name, round(raw, 2), round(len(x) / SR, 2)))
        print('%-7s raw %.2fs -> %.2fs' % report[-1])
    print('total raw %.1fs -> %.1fs' % (sum(r[1] for r in report), sum(r[2] for r in report)))
    json.dump({'parts': report, 'tempo': args.tempo}, open(os.path.join(args.dst, 'voice.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
