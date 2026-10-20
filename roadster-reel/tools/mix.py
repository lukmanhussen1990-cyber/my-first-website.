#!/usr/bin/env python3
"""Mix voices + music + SFX -> build/mix.wav, and write build/placement.json
(absolute word times used by the subtitle renderer).

Each voice line starts at its slot in timeline.json. If a (re-generated) line is too
long for its slot it is time-compressed (pitch kept) just enough to fit (max 1.3x).
Music and SFX are ducked under the voice; the master is limited to -1 dBTP and
normalized to -14 LUFS (Instagram)."""
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import SR, hp, lp, filt, limiter, db, pan  # noqa

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def stretch(x, factor):
    """time-compress mono x by `factor` (>1 = faster) keeping pitch (ffmpeg rubberband, fallback atempo)"""
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
        sf.write(a, x, SR)
        for flt in (f'rubberband=tempo={factor:.5f}:pitchq=quality', f'atempo={factor:.5f}'):
            r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', a, '-af', flt, b])
            if r.returncode == 0:
                y, _ = sf.read(b, dtype='float32'); return y
    return x


def compressor(x, thr_db=-18, ratio=3.0, att=0.005, rel=0.15):
    mono = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    from scipy.signal import lfilter
    # cheap envelope: peak-hold smoothed with release filter
    env = lfilter([1 - a_r], [1, -a_r], mono)
    env = np.maximum(env, lfilter([1 - a_a], [1, -a_a], mono))
    thr = db(thr_db)
    g = np.where(env > thr, (np.maximum(env, 1e-9) / thr) ** (1 / ratio - 1), 1.0)
    return x * (g[:, None] if x.ndim == 2 else g)


def main():
    tl = json.load(open(os.path.join(ROOT, 'timeline.json')))
    tim = json.load(open(os.path.join(ROOT, 'voices', 'timings.json')))
    dur = tl['duration']; N = int(dur * SR)
    music, _ = sf.read(os.path.join(ROOT, 'audio', 'music.wav'), dtype='float64')
    sfx, _ = sf.read(os.path.join(ROOT, 'audio', 'sfx.wav'), dtype='float64')
    music = music[:N]; sfx = sfx[:N]
    voice = np.zeros(N)
    placement = {'engine': tim.get('engine'), 'lines': []}
    slots = {s['line']: s for s in tl['voice_slots']}
    for ln in tim['lines']:
        x, sr = sf.read(os.path.join(ROOT, 'voices', ln['file']), dtype='float32')
        assert sr == SR
        slot = slots[ln['id']]
        avail = slot['latest_end'] - slot['start']
        factor = 1.0
        if len(x) / SR > avail:
            factor = min(1.3, (len(x) / SR) / avail)
            x = stretch(x, factor)
            print(f"[mix] line {ln['id']}: {ln['duration']:.2f}s > slot {avail:.2f}s -> tempo x{factor:.3f}")
        i0 = int(slot['start'] * SR)
        n = min(len(x), N - i0)
        voice[i0:i0 + n] += x[:n]
        placement['lines'].append({
            'id': ln['id'], 'speaker': ln['speaker'], 'start': slot['start'], 'tempo': round(factor, 4),
            'words': [{'word': w['word'], 'start': round(slot['start'] + w['start'] / factor, 4), 'end': round(slot['start'] + w['end'] / factor, 4)} for w in ln['words']],
        })
    # voice bus: clean up + presence
    voice = hp(voice, 85, 2)
    voice = filt(voice, 'peak', 3200, 1.0, 2.5)
    voice = filt(voice, 'lowshelf', 180, 0.7, -1.5)
    voice = compressor(voice[:, None], -20, 2.5, 0.004, 0.12)[:, 0]
    # ducking envelope from voice activity
    act = np.abs(voice)
    from scipy.signal import lfilter
    a = np.exp(-1 / (0.03 * SR)); r = np.exp(-1 / (0.35 * SR))
    env = lfilter([1 - r], [1, -r], (act > 0.02).astype(float))
    env = np.maximum(env, lfilter([1 - a], [1, -a], (act > 0.02).astype(float)))
    duck = np.clip(env * 1.6, 0, 1)
    music_gain = db(-15.5) * (1 - duck * (1 - db(-8.0)))
    sfx_bus = compressor(sfx, -14, 3.0, 0.004, 0.2)
    sfx_gain = db(-6.5) * (1 - duck * (1 - db(-5.0)))
    mix = music * music_gain[:, None] + sfx_bus * sfx_gain[:, None] + pan(voice, 0.0) * db(1.5)
    # master: gentle glue, limiter, loudness normalize
    try:
        import pyloudnorm as pyln
        meter = pyln.Meter(SR)
        for _ in range(3):
            lufs = meter.integrated_loudness(mix)
            mix *= db(-14.0 - lufs)
            mix = limiter(mix, -1.0)
        lufs = meter.integrated_loudness(mix)
    except Exception:
        lufs = float('nan'); mix = limiter(mix / np.abs(mix).max() * 0.9, -1.0)
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    sf.write(os.path.join(ROOT, 'build', 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
    json.dump(placement, open(os.path.join(ROOT, 'build', 'placement.json'), 'w'), indent=1)
    print(f'[mix] build/mix.wav  {len(mix) / SR:.2f}s  integrated {lufs:.1f} LUFS  peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS')


if __name__ == '__main__':
    main()
