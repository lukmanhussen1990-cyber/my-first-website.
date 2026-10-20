#!/usr/bin/env python3
"""Word timings for a known transcript, from the audio itself.

CTC forced alignment with wav2vec2-base-960h (ONNX). Used when the TTS engine
does not return timestamps (ElevenLabs' /with-timestamps endpoint does, and
remake_voices_elevenlabs.py uses that instead).

usage: align_words.py AUDIO "exact transcript" OUT.json [--model DIR]
"""
import argparse, json, os, re, subprocess, sys
import numpy as np

DEFAULT_MODEL = os.environ.get('W2V_MODEL_DIR', os.path.join(os.path.dirname(__file__), '..', '.cache', 'w2v'))
SR = 16000
FRAME = 320 / SR  # wav2vec2 output stride (20 ms)


def load_audio(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()


def display_words(text):
    # words exactly as written in the script (punctuation kept for display)
    return text.split()


def norm_word(w):
    return re.sub(r"[^A-Z']", '', w.upper().replace('’', "'"))


def forced_align(logp, tokens, blank=0):
    """Viterbi CTC alignment. logp: [T, V] log-probs. tokens: label ids (no blanks).
    Returns per-token (start_frame, end_frame)."""
    T, S = logp.shape[0], len(tokens)
    ext = [blank]
    for t in tokens:
        ext += [t, blank]
    L = len(ext)
    NEG = -1e30
    dp = np.full((T, L), NEG, dtype=np.float64)
    bp = np.zeros((T, L), dtype=np.int8)
    dp[0, 0] = logp[0, ext[0]]
    dp[0, 1] = logp[0, ext[1]]
    ext_arr = np.array(ext)
    can_skip = np.zeros(L, dtype=bool)
    for s in range(2, L):
        can_skip[s] = ext[s] != blank and ext[s] != ext[s - 2]
    for t in range(1, T):
        prev = dp[t - 1]
        stay = prev
        step = np.concatenate([[NEG], prev[:-1]])
        skip = np.where(can_skip, np.concatenate([[NEG, NEG], prev[:-2]]), NEG)
        best = np.maximum(np.maximum(stay, step), skip)
        bp[t] = np.where(best == stay, 0, np.where(best == step, 1, 2))
        dp[t] = best + logp[t, ext_arr]
    s = L - 1 if dp[T - 1, L - 1] >= dp[T - 1, L - 2] else L - 2
    path = []
    for t in range(T - 1, -1, -1):
        path.append((t, s))
        s -= int(bp[t, s])
    path.reverse()
    spans = [[None, None] for _ in range(S)]
    for t, s in path:
        if s % 2 == 1:
            k = s // 2
            if spans[k][0] is None:
                spans[k][0] = t
            spans[k][1] = t
    return spans


def align(audio_path, text, model_dir=DEFAULT_MODEL):
    import onnxruntime as ort
    vocab = json.load(open(os.path.join(model_dir, 'vocab.json')))
    sess = ort.InferenceSession(os.path.join(model_dir, 'model.onnx'), providers=['CPUExecutionProvider'])
    wav = load_audio(audio_path)
    x = (wav - wav.mean()) / (wav.std() + 1e-7)
    logits = sess.run(None, {'input_values': x[None, :].astype(np.float32)})[0][0]
    logits = logits - logits.max(axis=1, keepdims=True)
    logp = logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))
    words = display_words(text)
    sep = vocab['|']
    tokens, owner = [], []
    for wi, w in enumerate(words):
        nw = norm_word(w)
        if not nw:
            continue
        if tokens:
            tokens.append(sep); owner.append(-1)
        for ch in nw:
            tokens.append(vocab[ch]); owner.append(wi)
    spans = forced_align(logp, tokens, blank=vocab['<pad>'])
    out = []
    for wi, w in enumerate(words):
        fr = [spans[k] for k in range(len(tokens)) if owner[k] == wi and spans[k][0] is not None]
        if not fr:
            continue
        start = fr[0][0] * FRAME
        end = (fr[-1][1] + 1) * FRAME
        out.append({'word': w, 'start': round(start, 3), 'end': round(end, 3)})
    # speech onset/offset in the file (for trimming / placement)
    dur = len(wav) / SR
    return {'audio': os.path.basename(audio_path), 'duration': round(dur, 3), 'text': text, 'words': out}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('audio'); ap.add_argument('text'); ap.add_argument('out')
    ap.add_argument('--model', default=DEFAULT_MODEL)
    a = ap.parse_args()
    res = align(a.audio, a.text, a.model)
    json.dump(res, open(a.out, 'w'), indent=1)
    print(' '.join(f"{w['word']}@{w['start']:.2f}" for w in res['words']))
