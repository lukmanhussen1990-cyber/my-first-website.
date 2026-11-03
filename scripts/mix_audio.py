"""Mix the final soundtrack: voiceover + sound effects at the cue times from src/SFX.tsx.
Cue frames are computed from words.json exactly like src/timing.ts (frame = round(start * 30)).
usage: python3 scripts/mix_audio.py out/tmp/audio.m4a
"""
import json, math, re, subprocess, sys

FPS = 30
words = json.load(open('words.json'))
wf = lambda i: round(words[i]['start'] * FPS)
TOTAL_FRAMES = math.ceil((123.01 + 1) * FPS)

# parse the cue list from src/SFX.tsx so there is only one source of truth
src = open('src/SFX.tsx').read()
cues = []
for m in re.finditer(r"\{file: '(\w+)', at: wf\((\d+)\)\s*([+-]\s*\d+)?, volume: ([\d.]+)(, fadeOutAt: TOTAL_FRAMES - (\d+))?\}", src):
    file, wi, off, vol, _, fade = m.groups()
    at = wf(int(wi)) + (int(off.replace(' ', '')) if off else 0)
    cues.append({'file': file, 'at': at, 'volume': float(vol), 'fadeOutAt': (TOTAL_FRAMES - int(fade)) if fade else None})
assert len(cues) >= 15, f'parsed only {len(cues)} cues'

out = sys.argv[1] if len(sys.argv) > 1 else 'out/tmp/audio.m4a'
dur = TOTAL_FRAMES / FPS
inputs = ['-i', 'voiceover.mp3']
filters = ['[0:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=%.3f[v]' % dur]
labels = ['[v]']
for k, c in enumerate(cues):
    inputs += ['-i', f"public/sfx/{c['file']}.mp3"]
    delay = int(round(c['at'] / FPS * 1000))
    chain = f"[{k + 1}:a]aresample=48000,aformat=channel_layouts=stereo,volume={c['volume']}"
    if c['fadeOutAt'] is not None:
        st = c['fadeOutAt'] / FPS - c['at'] / FPS
        chain += f",afade=t=out:st={st:.3f}:d=0.4"
    chain += f",adelay={delay}|{delay}[s{k}]"
    filters.append(chain)
    labels.append(f'[s{k}]')
filters.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0:dropout_transition=0,atrim=0:{dur:.3f}[out]')
cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', out]
subprocess.run(cmd, check=True)
print(f'{len(cues)} cues mixed -> {out} ({dur:.2f}s)')
for c in cues:
    print(f"  {c['file']:6s} at {c['at'] / FPS:7.2f}s vol {c['volume']}")
