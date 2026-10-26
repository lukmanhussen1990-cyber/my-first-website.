#!/usr/bin/env python3
"""Turn the ElevenLabs part files (audio/voice/raw/partNN.mp3) into one WAV per line.

* transcribes each part locally with faster-whisper (word timestamps, cached)
* aligns the transcript to the script lines (tools/script.json) to find line boundaries
* cuts + trims each line, 48 kHz mono; the rescuer gets a far-away echo down the crack
* writes audio/voice/lines/index.json  {key: {file, duration, words:[{w,s,e}] (line-relative)}}
"""
import json, os, re, subprocess, sys, difflib
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'audio', 'voice', 'raw')
OUT = os.path.join(ROOT, 'audio', 'voice', 'lines')
SR = 48000
SCRIPT = json.load(open(os.path.join(ROOT, 'tools', 'script.json')))

NUMS = {'40': ['forty'], '1950': ['nineteen', 'fifty'], '31': ['thirty', 'one'], '32': ['thirty', 'two']}


def norm(w):
    return re.sub(r"[^a-z0-9]", '', w.lower().replace('’', "'"))


def expand(tok):
    n = norm(tok)
    return NUMS.get(n, [n]) if n else []


def load_audio(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


_model = None


def transcribe(path):
    cache = path + '.words.json'
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(path):
        return json.load(open(cache))
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('small.en', device='cpu', compute_type='int8')
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a16 = np.frombuffer(pcm, dtype=np.float32).copy()
    segs, _ = _model.transcribe(a16, word_timestamps=True, language='en', beam_size=5, vad_filter=False)
    words = []
    for s in segs:
        for w in s.words:
            words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)})
    json.dump(words, open(cache, 'w'), indent=1)
    return words


def refine_edges(audio, s, e, prev_end, next_start):
    """Snap a line's start/end to where the energy actually starts/stops."""
    hop = int(0.005 * SR)
    env = np.sqrt(np.convolve(audio ** 2, np.ones(hop * 2) / (hop * 2), mode='same') + 1e-12)
    thr = max(env.max() * 0.02, 1e-4)
    i0 = int(max(prev_end, s - 0.25) * SR)
    i = int(s * SR)
    while i > i0 and env[i] > thr:
        i -= hop
    i1 = int(min(next_start, e + 0.45) * SR)
    j = int(e * SR)
    while j < i1 and j < len(env) - 1 and env[j] > thr:
        j += hop
    return i / SR, j / SR


def far_echo(x):
    """Rescuer shouting from far above, down an ice crack: band-limited, slap echoes + long tail."""
    from scipy.signal import butter, sosfilt, fftconvolve
    sos = butter(4, [260, 3600], btype='band', fs=SR, output='sos')
    dry = sosfilt(sos, x) * 0.9
    out = np.zeros(len(x) + int(3.2 * SR), dtype=np.float64)
    out[:len(x)] += dry * 0.55
    # flutter echoes between the ice walls + a long return from the crack
    for d, g in [(0.083, 0.42), (0.161, 0.33), (0.247, 0.26), (0.39, 0.32), (0.62, 0.24), (0.93, 0.17), (1.31, 0.11)]:
        k = int(d * SR)
        out[k:k + len(x)] += dry * g
    # diffuse tail: exponentially decaying noise impulse response
    rng = np.random.default_rng(7)
    n = int(2.6 * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.75 * SR))
    ir = sosfilt(butter(2, [300, 3000], btype='band', fs=SR, output='sos'), ir)
    ir /= np.sqrt(np.sum(ir ** 2))
    tail = fftconvolve(dry, ir)[:len(out)]
    out[:len(tail)] += tail * 0.5
    out /= max(np.abs(out).max(), 1e-6)
    return (out * 0.8).astype(np.float32)


def main():
    os.makedirs(OUT, exist_ok=True)
    index = {}
    report = []
    for sc in SCRIPT['scenes']:
        if not sc.get('part'):
            continue
        narr = [ln for ln in sc['lines'] if not ln.get('part')]
        others = [ln for ln in sc['lines'] if ln.get('part')]
        groups = [(sc['part'], narr)] + [(ln['part'], [ln]) for ln in others]
        for part, lines in groups:
            path = os.path.join(RAW, part + '.mp3')
            if not os.path.exists(path):
                report.append(f'MISSING {part}')
                continue
            audio = load_audio(path)
            words = transcribe(path)
            # flatten expected tokens
            exp, owner = [], []
            for li, ln in enumerate(lines):
                for ti, tok in enumerate(ln['text'].split()):
                    for sub in expand(tok):
                        exp.append(sub)
                        owner.append((li, ti))
            got = [norm(w['w']) for w in words]
            # whisper may glue numbers ("1950") or split them; expand transcript numbers too
            got_exp, got_idx = [], []
            for gi, gw in enumerate(got):
                for sub in NUMS.get(gw, [gw]):
                    if sub:
                        got_exp.append(sub)
                        got_idx.append(gi)
            sm = difflib.SequenceMatcher(a=exp, b=got_exp, autojunk=False)
            match = {}
            for a, b, n in sm.get_matching_blocks():
                for k in range(n):
                    match[a + k] = got_idx[b + k]
            ratio = sm.ratio()
            transcript = ' '.join(w['w'] for w in words)
            report.append(f'{part}: match {ratio:.2f} | heard: "{transcript}"')
            extra = [got_exp[j] for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag in ('insert', 'replace') for j in range(j1, j2)]
            if extra:
                report.append(f'   extra/unmatched words heard: {extra}')
            # per-line boundaries
            spans = []
            for li, ln in enumerate(lines):
                ids = [match[i] for i in range(len(exp)) if owner[i][0] == li and i in match]
                if not ids:
                    report.append(f'   !! could not find line: {ln["text"]}')
                    spans.append(None)
                    continue
                spans.append((words[min(ids)]['s'], words[max(ids)]['e']))
            for li, ln in enumerate(lines):
                if spans[li] is None:
                    continue
                s, e = spans[li]
                prev_end = spans[li - 1][1] if li > 0 and spans[li - 1] else 0.0
                next_start = spans[li + 1][0] if li + 1 < len(lines) and spans[li + 1] else len(audio) / SR
                s2, e2 = refine_edges(audio, s, e, prev_end, next_start)
                s2 = max(prev_end, s2 - 0.03)
                e2 = min(next_start, e2 + 0.06)
                seg = audio[int(s2 * SR):int(e2 * SR)].copy()
                fi, fo = int(0.004 * SR), int(0.025 * SR)
                seg[:fi] *= np.linspace(0, 1, fi)
                seg[-fo:] *= np.linspace(1, 0, fo)
                key = part if len(lines) == 1 and ln.get('part') else f'{part}_{li + 1}'
                speaker = ln.get('speaker', 'narrator')
                if speaker == 'rescuer':
                    seg = far_echo(seg)
                fn = os.path.join(OUT, key + '.wav')
                sf.write(fn, seg, SR, subtype='FLOAT')
                # line-relative word timings, one entry per script token
                toks = ln['text'].split()
                wt = []
                flat = [i for i in range(len(exp)) if owner[i][0] == li]
                for ti, tok in enumerate(toks):
                    idxs = [match[i] for i in flat if owner[i][1] == ti and i in match]
                    if idxs:
                        wt.append({'w': tok, 's': round(words[min(idxs)]['s'] - s2, 3), 'e': round(words[max(idxs)]['e'] - s2, 3)})
                    else:
                        wt.append({'w': tok, 's': None, 'e': None})
                # fill gaps by interpolation
                for i, w in enumerate(wt):
                    if w['s'] is None:
                        prv = next((wt[j]['e'] for j in range(i - 1, -1, -1) if wt[j]['e'] is not None), 0.0)
                        nxt = next((wt[j]['s'] for j in range(i + 1, len(wt)) if wt[j]['s'] is not None), (e - s2))
                        w['s'], w['e'] = round(prv, 3), round(nxt, 3)
                dur = len(seg) / SR if speaker != 'rescuer' else (e2 - s2) + 0.9
                index[key] = {'file': os.path.relpath(fn, ROOT), 'duration': round(dur, 3), 'audioLen': round(len(seg) / SR, 3),
                              'speaker': speaker, 'words': wt, 'text': ln['text']}
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print('\n'.join(report))
    print(f'{len(index)} lines written to {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
