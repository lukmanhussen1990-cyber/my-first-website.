#!/usr/bin/env python3
"""Mix the soundtrack and export the final reel (no 3D re-render needed).

Inputs (all in work/ unless given):
  master/master.mp4   silent 3D master (render/render_film.mjs)
  voice_track.wav     placed voice lines      (tools/layout_voice.py)
  voice_layout.json   word timings            (tools/layout_voice.py)
  subs.ass            word-by-word subtitles  (tools/make_subs.py)
  music.wav, sfx.wav  synthesized stems       (tools/make_audio.py)
Output: out/cheetah_race_reel.mp4  (H.264 + AAC, 1080x1920, 30 fps, -14 LUFS)

The music is ducked under the voice using the exact word timings, the effects
a little; then the mix is loudness-normalized (two-pass loudnorm, true peak
-1.5 dBTP) and muxed with the master while the subtitles are burned in.
usage: finalize.py [--master PATH] [--out PATH] [--preview]
"""
import argparse, json, os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = lambda *p: os.path.join(ROOT, 'work', *p)
SR = 48000
GAIN = {'voice': 0.0, 'music': -8.0, 'sfx': -1.0}   # dB, before loudness normalization
DUCK = {'music': -6.5, 'sfx': -3.0}                  # extra dB while someone is talking


def read(path, stereo=True):
    sr, x = wavfile.read(path)
    assert sr == SR, f'{path}: {sr} Hz'
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1) if stereo else x
    return x


def speech_mask(layout, n):
    """1 while someone talks, with a quick duck (60 ms) and a slow release (350 ms)."""
    CR = 1000  # control rate
    m = np.zeros(n * CR // SR + 1)
    for line in layout['lines']:
        for w in line['words']:
            m[max(0, int((w['start'] - 0.1) * CR)):int((w['end'] + 0.25) * CR)] = 1.0
    a, r = np.exp(-1 / (0.06 * CR)), np.exp(-1 / (0.35 * CR))
    env, y = np.zeros_like(m), 0.0
    for i, v in enumerate(m):
        c = a if v > y else r
        y = c * y + (1 - c) * v
        env[i] = y
    return np.interp(np.arange(n) / SR, np.arange(len(env)) / CR, env)


def db(x):
    return 10 ** (x / 20)


def measure(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    summ = err[err.rindex('Summary:'):]
    i_val = float(summ.split('I:')[1].split('LUFS')[0])
    tp = float(summ.split('Peak:')[1].split('dBFS')[0])
    return i_val, tp


def loudnorm(src, dst, target=-14.0, ceiling_db=-1.5):
    """Static gain to the target loudness + a fast peak limiter (keeps the dynamics)."""
    i_in, tp_in = measure(src)
    gain = target - i_in
    for _ in range(3):
        lim = 10 ** ((ceiling_db - 0.4) / 20)
        af = f'volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=2:release=60:level=disabled,aresample=48000'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-c:a', 'pcm_s16le', dst], check=True)
        i_out, tp_out = measure(dst)
        if abs(i_out - target) < 0.25:
            break
        gain += target - i_out
    return {'input_i': i_in, 'input_tp': tp_in, 'output_i': i_out, 'output_tp': tp_out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--master', default=W('master', 'master.mp4'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'out', 'cheetah_race_reel.mp4'))
    ap.add_argument('--bitrate', default='10M', help='video bitrate (two-pass); the reel stays under ~75 MB')
    ap.add_argument('--voice', default=W('voice_track.wav'))
    ap.add_argument('--layout', default=W('voice_layout.json'))
    ap.add_argument('--subs', default=W('subs.ass'))
    ap.add_argument('--music', default=W('music.wav'))
    ap.add_argument('--sfx', default=W('sfx.wav'))
    a = ap.parse_args()
    layout = json.load(open(a.layout))
    voice, music, sfx = read(a.voice), read(a.music), read(a.sfx)
    n = min(len(voice), len(music), len(sfx))
    voice, music, sfx = voice[:n], music[:n], sfx[:n]
    mask = speech_mask(layout, n)[:, None]
    mix = (voice * db(GAIN['voice'])
           + music * db(GAIN['music']) * db(DUCK['music'] * mask)
           + sfx * db(GAIN['sfx']) * db(DUCK['sfx'] * mask))
    peak = np.max(np.abs(mix))
    if peak > 0.99:
        mix *= 0.99 / peak
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        raw, normed = os.path.join(td, 'mix.wav'), os.path.splitext(a.out)[0] + '.mix.wav'
        wavfile.write(raw, SR, (mix * 32767).astype(np.int16))
        js = loudnorm(raw, normed)
        print(f"mix: {js['input_i']:.1f} LUFS -> {js['output_i']:.1f} LUFS, true peak {js['output_tp']:.1f} dBTP")
    subs = a.subs.replace('\\', '/').replace(':', '\\:')
    fonts = os.path.join(ROOT, 'fonts').replace(':', '\\:')
    vf = f"subtitles='{subs}':fontsdir='{fonts}',format=yuv420p"
    br = a.bitrate
    maxr = f'{float(br.rstrip("Mk")) * 1.5:g}{br[-1]}' if br[-1] in 'Mk' else br
    venc = ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'film', '-b:v', br, '-maxrate', maxr,
            '-bufsize', maxr, '-r', '30', '-g', '60', '-pix_fmt', 'yuv420p']
    with tempfile.TemporaryDirectory() as td:
        log = os.path.join(td, 'x264')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.master, '-vf', vf, '-an', *venc, '-pass', '1', '-passlogfile', log, '-f', 'null', '-'], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.master, '-i', normed, '-vf', vf, '-map', '0:v:0', '-map', '1:a:0', *venc,
                        '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest',
                        '-movflags', '+faststart', a.out], check=True)
    os.remove(normed)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
