"""Watch-back QA for the final MP4.

- samples a frame every 3 s -> frames/qa/contact_*.png (contact sheets) + full-size PNGs
- prints, for every sample, what the narrator is saying and which caption should be on screen
- checks the scares: finds the bass-hit onsets in the final audio and compares them
  with the visual reveal cues from the timeline
- checks the container: resolution, fps, codecs, pixel format, duration, loudness
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
VIDEO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'final/night_shift.mp4')
T = json.load(open(os.path.join(ROOT, 'src/timeline.json')))
OUT = os.path.join(ROOT, 'frames/qa')
os.makedirs(OUT, exist_ok=True)


def sh(args):
    return subprocess.run(args, capture_output=True, text=True).stdout + subprocess.run(args, capture_output=True, text=True).stderr


# ---- container ----
probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', VIDEO], capture_output=True, text=True).stdout)
v = next(s for s in probe['streams'] if s['codec_type'] == 'video')
a = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
print(f"video: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} fps {v['pix_fmt']}, frames {v.get('nb_frames')}")
print(f"audio: {a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch {int(a.get('bit_rate', 0)) // 1000} kb/s")
print(f"duration: {float(probe['format']['duration']):.2f} s, size {int(probe['format']['size']) / 1e6:.1f} MB")
with open(VIDEO, 'rb') as f:
    head = f.read(64 * 1024)
print('faststart (moov before mdat):', head.find(b'moov') != -1 and (head.find(b'mdat') == -1 or head.find(b'moov') < head.find(b'mdat')))
loud = subprocess.run(['ffmpeg', '-hide_banner', '-i', VIDEO, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
summary = loud[loud.rfind('Summary:'):]
print('loudness:', ' '.join(summary.split()))

# ---- frames every 3 s ----
times = [round(t, 2) for t in np.arange(0.5, T['duration'], 3.0)]
words = []
for vo in T['vo']:
    for sc in T['scenes']:
        if vo['id'] in sc.get('lines', {}):
            for w in sc['lines'][vo['id']]['words']:
                words.append((w['start'], w['end'], w['text'], vo['voice']))
print('\n  time  scene  caption on screen                      | being said')
for t in times:
    sc = next((s for s in T['scenes'] if s['start'] <= t < s['end']), T['scenes'][-1])
    cap = next((c for c in T['captions'] if c['start'] <= t < c['end']), None)
    said = ' '.join(w[2] for w in words if w[0] - 0.6 <= t <= w[1] + 0.6)
    bub = T['bubble'] if T['bubble'] and T['bubble']['start'] <= t < T['bubble']['end'] else None
    label = (cap['text'] if cap else '-') + (' + bubble' if bub else '')
    print(f"{t:6.2f}  {sc['id']:>3}    {label[:38]:38} | {said}")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', VIDEO, '-frames:v', '1', os.path.join(OUT, f'qa_{t:05.2f}.png')])
pngs = sorted(f for f in os.listdir(OUT) if f.startswith('qa_'))
for k in range(0, len(pngs), 11):
    batch = pngs[k:k + 11]
    inputs = []
    for p in batch:
        inputs += ['-i', os.path.join(OUT, p)]
    filt = ''.join(f'[{i}]scale=270:480[s{i}];' for i in range(len(batch))) + ''.join(f'[s{i}]' for i in range(len(batch))) + f'hstack=inputs={len(batch)}'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', filt, os.path.join(OUT, f'contact_{k // 11 + 1}.png')])

# ---- scares: bass hits in the audio vs reveal cues ----
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', VIDEO, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(float) / 32768
from scipy.signal import butter, sosfilt  # noqa: E402
low = sosfilt(butter(4, 120, 'lowpass', fs=8000, output='sos'), x)
env = np.convolve(np.abs(low), np.ones(160) / 160, mode='same')
print('\nscare   cue (s)   bass-hit peak in audio (s)   delta (ms)')
for name in ['s4_reveal', 's6_reveal', 's10_reveal']:
    cue = T['cues'][name]
    a0, a1 = int((cue - 0.5) * 8000), int((cue + 0.5) * 8000)
    peak = a0 + int(np.argmax(env[a0:a1]))  # the hit is the loudest low-end event around the cue
    print(f"{name:10} {cue:8.3f}   {peak / 8000:10.3f}                  {1000 * (peak / 8000 - cue):+6.0f}")
c = T['cues']
sil = env[int(c['s10_silence'] * 8000) + 400:int((c['s10_whisper'] - 0.05) * 8000)]
print(f"silence before the whisper: {c['s10_silence']:.2f}-{c['s10_whisper']:.2f} s, level {20 * np.log10(np.sqrt(np.mean(sil ** 2)) + 1e-9):.1f} dBFS")
print(f"\ncontact sheets: {os.path.relpath(OUT, ROOT)}/contact_*.png")
