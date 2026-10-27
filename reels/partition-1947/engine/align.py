"""Word timings for the captions: force-align each part's Hinglish script
words to the recorded voice (MMS CTC aligner), then write timing.json.

Usage: python3 align.py <voice-dir with partN.wav> <timing.json> [--spoken overrides.json]
"""
import argparse
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from story import PARTS, GAP, split_words  # noqa: E402

NUMBERS = {
    '1947': 'unnees sau saintaalees', '1971': 'unnees sau ikhattar', '14': 'chaudah', '15': 'pandrah',
    '17': 'satrah', '8': 'aath', '2': 'do', '5': 'paanch',
}


def spoken_tokens(word, overrides):
    core = re.sub(r"[^0-9A-Za-z']", '', word)
    if core in overrides:
        return overrides[core].split()
    if core in NUMBERS:
        return NUMBERS[core].split()
    return [core.lower()] if core else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('voice_dir')
    ap.add_argument('out')
    ap.add_argument('--spoken', default=None, help='json {"1947": "nineteen forty seven", ...}')
    args = ap.parse_args()
    overrides = json.load(open(args.spoken)) if args.spoken else {}

    from ctc_forced_aligner import (AlignmentSingleton, load_audio, generate_emissions, preprocess_text,
                                    get_alignments, get_spans, postprocess_results)
    al = AlignmentSingleton()
    model, tokenizer = al.alignment_model, al.alignment_tokenizer
    durations, word_times, report = [], [], []
    for i, text in enumerate(PARTS):
        path = os.path.join(args.voice_dir, 'part%d.wav' % (i + 1))
        wav = load_audio(path)
        dur = wav.shape[-1] / 16000.0
        words = split_words(text)
        toks, owner = [], []
        for k, w in enumerate(words):
            for t in spoken_tokens(w, overrides):
                toks.append(t)
                owner.append(k)
        emissions, stride = generate_emissions(model, wav, batch_size=4)
        # The script is already in Latin letters (Hinglish), so no romanisation step.
        tokens_starred, text_starred = preprocess_text(' '.join(toks), romanize=False, language='eng')
        segments, scores, blank = get_alignments(emissions, tokens_starred, tokenizer)
        spans = get_spans(tokens_starred, segments, blank)
        res = postprocess_results(text_starred, spans, stride, scores)
        if len(res) != len(toks):
            raise SystemExit('part%d: %d aligned tokens vs %d expected' % (i + 1, len(res), len(toks)))
        wt = []
        for k in range(len(words)):
            idx = [j for j, o in enumerate(owner) if o == k]
            if idx:
                wt.append((float(res[idx[0]]['start']), float(res[idx[-1]]['end'])))
            else:
                wt.append(None)
        for k in range(len(wt)):
            if wt[k] is None:
                prev = wt[k - 1][1] if k else 0.0
                wt[k] = (prev, prev)
        durations.append(round(dur, 3))
        word_times.append([(round(a, 3), round(b, 3)) for a, b in wt])
        sc = [float(r.get('score', 0)) for r in res]
        report.append((i + 1, round(dur, 2), round(float(np.mean(sc)), 3) if sc else None))
        print('part%-2d %.2fs  words=%d  mean score=%s' % (i + 1, dur, len(words), report[-1][2]))
        print('   ', ' '.join('%s@%.2f' % (w, t[0]) for w, t in zip(words, wt)))
    json.dump({'durations': durations, 'word_times': word_times, 'gap': GAP}, open(args.out, 'w'), indent=1)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
