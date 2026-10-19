"""Word-level forced alignment of a known script (wav2vec2 CTC + Viterbi).

Usage: python align.py audio.wav script.txt out.json
Times are seconds in the input file. Frame resolution is 20 ms.
"""
import json
import re
import sys

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL = "facebook/wav2vec2-base-960h"
FRAME = 320 / 16000.0


def script_words(text):
    """Split the display script into words; also return the CTC spelling of each."""
    words = []
    for raw in text.replace("\n", " ").split():
        disp = raw.strip()
        if not re.search(r"[A-Za-z0-9]", disp):
            continue
        spoken = re.sub(r"[^A-Za-z' -]", "", disp.replace("-", " ")).upper().strip()
        words.append((disp, spoken))
    return words


def emissions(wav, sr):
    if wav.ndim > 1:
        wav = wav.mean(1)
    wav16 = resample_poly(wav, 16000, sr).astype(np.float32)
    proc = Wav2Vec2Processor.from_pretrained(MODEL)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL).eval()
    with torch.inference_mode():
        x = proc(wav16, sampling_rate=16000, return_tensors="pt").input_values
        logits = model(x).logits[0]
    return torch.log_softmax(logits, -1).numpy(), proc.tokenizer.get_vocab()


def viterbi(logp, tokens, blank):
    T = logp.shape[0]
    S = 2 * len(tokens) + 1
    lab = np.full(S, blank)
    lab[1::2] = tokens
    NEG = -1e30
    dp = np.full(S, NEG)
    dp[0] = logp[0, blank]
    dp[1] = logp[0, lab[1]]
    back = np.zeros((T, S), np.int8)
    skip_ok = np.zeros(S, bool)
    skip_ok[3::2] = lab[3::2] != lab[1:-2:2]
    for t in range(1, T):
        stay = dp
        step = np.concatenate([[NEG], dp[:-1]])
        skip = np.where(skip_ok, np.concatenate([[NEG, NEG], dp[:-2]]), NEG)
        cand = np.stack([stay, step, skip])
        arg = np.argmax(cand, 0)
        dp = cand[arg, np.arange(S)] + logp[t, lab]
        back[t] = arg
    s = S - 1 if dp[S - 1] > dp[S - 2] else S - 2
    path = np.empty(T, np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    return path


def align(wav_path, text):
    wav, sr = sf.read(wav_path)
    logp, vocab = emissions(wav, sr)
    blank = vocab["<pad>"]
    words = script_words(text)
    tokens, owner = [], []
    for wi, (_, spoken) in enumerate(words):
        for ci, part in enumerate(spoken.split()):
            if ci:
                tokens.append(vocab["|"]); owner.append(-1)
            for ch in part:
                tokens.append(vocab[ch]); owner.append(wi)
        tokens.append(vocab["|"]); owner.append(-1)
    tokens = tokens[:-1]; owner = owner[:-1]
    path = viterbi(logp, np.array(tokens), blank)
    first = {}; last = {}
    for t, s in enumerate(path):
        if s % 2 == 1:
            wi = owner[s // 2]
            if wi >= 0:
                first.setdefault(wi, t)
                last[wi] = t
    out = []
    for wi, (disp, spoken) in enumerate(words):
        out.append({"word": disp, "start": round(first[wi] * FRAME, 3),
                    "end": round((last[wi] + 1) * FRAME, 3)})
    return out


if __name__ == "__main__":
    wav_path, script_path, out_path = sys.argv[1:4]
    res = align(wav_path, open(script_path).read())
    json.dump(res, open(out_path, "w"), indent=1)
    for w in res:
        print(f"{w['start']:7.3f} {w['end']:7.3f}  {w['word']}")
