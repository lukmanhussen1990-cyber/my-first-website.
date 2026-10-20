#!/usr/bin/env python3
"""Local fallback voices (no ElevenLabs): Kokoro-82M via kokoro-onnx.

Writes voices/<line id>.wav (24 kHz mono) plus voices/<line id>.words.json
(word timings from forced alignment) for every line in script/script.json.
"""
import json, os, re, sys
import numpy as np, soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from align_words import align

VOICES = {  # speaker -> (kokoro voice, speed, pause inserted at '...')
    'narrator': ('af_heart', 1.12, 0.40),
    'john': ('am_michael', 0.94, 0.42),
}


def segments(text):
    # Kokoro has no delivery tags: speak the plain script text, and make each
    # '...' a real beat by synthesizing the parts separately.
    parts = [p.strip() for p in text.split('... ')]
    return [p + '...' if i < len(parts) - 1 else p for i, p in enumerate(parts)]


def trim(audio, sr, pre=0.05, post=0.10):
    idx = np.flatnonzero(np.abs(audio) > 0.01)
    return audio[max(0, idx[0] - int(pre * sr)):min(len(audio), idx[-1] + int(post * sr))]


def main(only=None):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(ROOT, '.cache/kokoro/kokoro-v1.0.onnx'), os.path.join(ROOT, '.cache/kokoro/voices-v1.0.bin'))
    script = json.load(open(os.path.join(ROOT, 'script/script.json')))
    os.makedirs(os.path.join(ROOT, 'voices'), exist_ok=True)
    manifest = []
    for line in script['lines']:
        if only and line['id'] not in only:
            continue
        voice, speed, pause = VOICES[line['speaker']]
        parts = []
        for i, seg in enumerate(segments(line['text'])):
            a, sr = k.create(seg, voice=voice, speed=speed, lang='en-us')
            if i:
                parts.append(np.zeros(int(pause * sr), np.float32))
            parts.append(trim(np.asarray(a, dtype=np.float32), sr))
        audio = np.concatenate(parts)
        wav = os.path.join(ROOT, 'voices', line['id'] + '.wav')
        sf.write(wav, audio, sr, subtype='PCM_16')
        res = align(wav, line['text'])
        res['speaker'] = line['speaker']; res['engine'] = f'kokoro-onnx {voice} x{speed}'
        json.dump(res, open(wav.replace('.wav', '.words.json'), 'w'), indent=1)
        manifest.append({'id': line['id'], 'duration': res['duration'], 'words': len(res['words'])})
        print(f"{line['id']}: {res['duration']:.2f}s  " + ' '.join(f"{w['word']}@{w['start']:.2f}" for w in res['words']))
    return manifest


if __name__ == '__main__':
    main(set(sys.argv[1:]) or None)
