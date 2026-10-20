"""Local neural TTS fallback (Kokoro-82M) with word timestamps.

Reads a JSON job list on argv[1]:
  [{"id", "text", "voice", "lang", "speed", "wav", "json", "key"}]
and writes one 24 kHz mono WAV plus a timestamp JSON per line, in the same
normalized format the ElevenLabs "with-timestamps" path produces:
  {"engine", "key", "text", "duration", "words": [{"text", "start", "end"}]}
"""
import json
import sys

import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline

SR = 24000


def load_voice(pipeline, spec):
    # "am_michael:0.6,am_onyx:0.4" -> weighted blend of voice style tensors
    parts = []
    for item in spec.split(','):
        name, _, weight = item.partition(':')
        parts.append((name.strip(), float(weight) if weight else 1.0))
    total = sum(w for _, w in parts)
    return sum(pipeline.load_voice(name) * (w / total) for name, w in parts)


def speech_bounds(audio, thresh_db=-42.0, pre=0.03, post=0.09):
    """Sample range holding the speech, with small margins around it."""
    env = np.convolve(np.abs(audio), np.ones(240) / 240, mode='same')
    loud = np.nonzero(env > 10 ** (thresh_db / 20))[0]
    if not len(loud):
        return 0, len(audio)
    return max(0, loud[0] - int(pre * SR)), min(len(audio), loud[-1] + int(post * SR))


def main():
    jobs = json.load(open(sys.argv[1]))
    pipelines = {}
    for job in jobs:
        lang = job.get('lang', 'a')
        if lang not in pipelines:
            pipelines[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')
        pipe = pipelines[lang]
        voice = load_voice(pipe, job['voice'])
        # Newlines in the text split it into separately spoken chunks with a fixed dramatic pause between.
        # Inner chunk edges are trimmed to the speech so the pause is the real gap.
        audio_parts, words, offset = [], [], 0.0
        pause = np.zeros(int(SR * job.get('pause', 0.0)), dtype=np.float32)
        results = list(pipe(job['say'], voice=voice, speed=job.get('speed', 1.0), split_pattern=r'\n+'))
        for i, result in enumerate(results):
            if i and len(pause):
                audio_parts.append(pause)
                offset += len(pause) / SR
            audio = result.audio.numpy() if isinstance(result.audio, torch.Tensor) else np.asarray(result.audio)
            head, tail = speech_bounds(audio)
            head = 0 if i == 0 else head
            tail = len(audio) if i == len(results) - 1 else tail
            audio = audio[head:tail]
            for tok in result.tokens or []:
                if tok.start_ts is None or tok.end_ts is None or not tok.text.strip():
                    continue
                start = max(0.0, tok.start_ts - head / SR)
                end = min(len(audio) / SR, tok.end_ts - head / SR)
                words.append({'text': tok.text, 'start': round(offset + start, 3), 'end': round(offset + end, 3)})
            print(f"  {job['id']}: phonemes = {result.phonemes}", file=sys.stderr)
            audio_parts.append(audio)
            offset += len(audio) / SR
        audio = np.concatenate(audio_parts)
        sf.write(job['wav'], audio, SR, subtype='PCM_16')
        json.dump({'engine': 'kokoro', 'key': job['key'], 'text': job['text'], 'voice': job['voice'],
                   'duration': round(len(audio) / SR, 3), 'words': words},
                  open(job['json'], 'w'), indent=1)
        print(f"  {job['id']}: {len(audio) / SR:.2f}s, {len(words)} tokens", file=sys.stderr)


if __name__ == '__main__':
    main()
