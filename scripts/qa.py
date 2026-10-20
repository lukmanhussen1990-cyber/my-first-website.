#!/usr/bin/env python3
"""QA for the final reel: container/codec spec, faststart, loudness, scare sync, frames every 3 s.

  python3 scripts/qa.py [final/two_moms.mp4]
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)  # noqa: E731
SR = 48000


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def main():
    mp4 = sys.argv[1] if len(sys.argv) > 1 else P('final', 'two_moms.mp4')
    info = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', mp4]).stdout)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    a = next(s for s in info['streams'] if s['codec_type'] == 'audio')
    dur = float(info['format']['duration'])
    print('== spec')
    print(f"  video  {v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['pix_fmt']} {v['r_frame_rate']} fps, {int(v.get('bit_rate', 0)) / 1e6:.1f} Mbps")
    print(f"  audio  {a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch, {int(a.get('bit_rate', 0)) / 1e3:.0f} kbps")
    print(f"  length {dur:.2f} s   size {os.path.getsize(mp4) / 1e6:.1f} MB")
    with open(mp4, 'rb') as f:
        head = f.read(4 * 1024 * 1024)
    moov, mdat = head.find(b'moov'), head.find(b'mdat')
    print(f"  faststart: {'yes' if 0 <= moov < (mdat if mdat >= 0 else 1 << 60) else 'NO'}")
    loud = run(['ffmpeg', '-hide_banner', '-i', mp4, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
    tail = loud[loud.rfind('Summary:'):]
    li = [ln.strip() for ln in tail.splitlines() if ln.strip().startswith(('I:', 'LRA:', 'Peak:'))]
    print('  loudness ' + '  '.join(li))

    # scare sync: the bass hits must land on the scare frames.
    # Onsets measured in the full mix get pulled around by the voice and the bed, so find the hit's
    # onset in the stinger stem, then where that stem sits in the final track (cross-correlation).
    tl = json.load(open(P('build', 'timeline.json')))
    x = pcm(mp4)
    st = pcm(P('audio', 'mix', 'stingers.wav'))
    box = np.ones(240) / 240
    lo = np.convolve(np.convolve(st, box, mode='same'), box, mode='same')  # ~150 Hz low-pass: only the bass hits live here
    env = np.sqrt(np.convolve(lo ** 2, np.ones(480) / 480, mode='same'))  # 10 ms RMS
    print('== scares (bass hit in the final track vs. the scare frame)')
    for s in tl['events']['scares']:
        s = np.ceil(s * tl['fps'] - 1e-6) / tl['fps']  # the first frame that shows it
        a0 = int((s - 0.15) * SR)
        w = env[a0:a0 + int(0.45 * SR)]
        attack = (a0 + np.argmax(w > 0.1 * w.max())) / SR
        b0, n, best, lag = int((s - 0.05) * SR), int(0.25 * SR), -1.0, 0
        ref = st[b0:b0 + n]
        for d in range(-int(0.05 * SR), int(0.05 * SR)):
            seg = x[b0 + d:b0 + d + n]
            c = np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9)
            if c > best:
                best, lag = c, d
        delta = attack + lag / SR - s
        print(f"  scare frame {round(s * tl['fps'])} ({s:6.3f}s)  -> hit at {s + delta:6.3f}s  (delta {1000 * delta:+.1f} ms, match {best:.2f})")

    # frames every 3 s -> contact sheets
    out = P('frames', 'qa')
    os.makedirs(out, exist_ok=True)
    times = [round(t, 2) for t in np.arange(0, dur - 0.05, 3.0)]
    files = []
    for t in times:
        f = os.path.join(out, f'qa_{t:05.2f}.png')
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', mp4, '-frames:v', '1', f])
        files.append(f)
    for k in range(0, len(files), 9):
        sheet = P('frames', f'qa_sheet_{k // 9 + 1}.png')
        subprocess.run([P('scripts', 'contact.sh'), sheet, *files[k:k + 9]], check=True, cwd=ROOT)
        print(f'  sheet {sheet}')

    # caption / voice timing table (what should be on screen at each sampled time)
    print('== on-screen text at each sample')
    for t in times:
        sc = next((s for s in tl['scenes'] if s['start'] <= t < s['end']), tl['scenes'][-1])
        cap = sc['caption']['text'] if sc['caption'] and t >= sc['caption']['start'] else '-'
        bub = sc['bubble']['text'] if sc['bubble'] and sc['bubble']['start'] <= t < sc['bubble']['end'] else '-'
        vo = next((L['text'] for L in sc['lines'] if L['start'] <= t < L['end']), '-')
        print(f"  {t:5.1f}s  scene {sc['id']:2d}  caption: {cap:28s} bubble: {bub:32s} voice: {vo[:46]}")


if __name__ == '__main__':
    main()
