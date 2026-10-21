"""Place each voice line on the video timeline and write out/voice_placement.json.

    python3 tools/place_voices.py

A line starts at max(its cue, end of the previous line + 0.12 s). If it would run past its
latest_end it is sped up (ffmpeg atempo, at most 1.15x). John's line starts exactly on its cue.
Writes out/voices_placed/<id>.wav (the possibly sped-up audio) and absolute word times.
"""
import json
import os
import subprocess

import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'out')
GAP = 0.12
MAX_TEMPO = 1.15


def main():
    tl = json.load(open(os.path.join(ROOT, 'timeline.json')))
    timings = json.load(open(os.path.join(ROOT, 'voices', 'timings.json')))
    os.makedirs(os.path.join(OUT, 'voices_placed'), exist_ok=True)
    placed, prev_end = {}, 0.0
    for lid, win in tl['voice_windows'].items():
        if lid.startswith('_'):
            continue
        info = timings['lines'][lid]
        src = os.path.join(ROOT, info['file'])
        dur = sf.info(src).duration
        start = win['cue'] if lid.startswith('07') else max(win['cue'], prev_end + GAP)
        room = win['latest_end'] - start
        tempo = 1.0
        if dur > room:
            tempo = min(MAX_TEMPO, dur / room)
            print(f'[place] {lid}: {dur:.2f}s > {room:.2f}s window, speeding up x{tempo:.3f}')
        dst = os.path.join(OUT, 'voices_placed', f'{lid}.wav')
        if tempo != 1.0:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter:a', f'atempo={tempo:.4f}', dst], check=True)
        else:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, dst], check=True)
        new_dur = sf.info(dst).duration
        words = [{'text': w['text'], 'start': round(start + w['start'] / tempo, 3), 'end': round(start + w['end'] / tempo, 3)} for w in info['words']]
        placed[lid] = {'speaker': info['speaker'], 'file': os.path.relpath(dst, ROOT), 'start': round(start, 3), 'end': round(start + new_dur, 3),
                       'tempo': round(tempo, 4), 'engine': info['engine'], 'words': words}
        prev_end = start + new_dur
        print(f'[place] {lid}: {start:6.2f} -> {start + new_dur:6.2f}  (window ends {win["latest_end"]})')
    with open(os.path.join(OUT, 'voice_placement.json'), 'w') as f:
        json.dump(placed, f, indent=2)


if __name__ == '__main__':
    main()
