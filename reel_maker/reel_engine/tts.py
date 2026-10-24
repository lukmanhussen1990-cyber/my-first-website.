"""Kokoro-82M voiceover, run locally through ONNX Runtime.

Same model weights as `pip install kokoro` (hexgrad/Kokoro-82M v1.0), exported to
ONNX by onnx-community. Running it through onnxruntime avoids PyTorch and works
on any Python version. Text -> phonemes uses misaki (Kokoro's own G2P) with an
espeak-ng fallback for unknown words.

Besides audio, every sentence returns exact per-word timings taken from the
model's own predicted phoneme durations (1 duration frame = 600 samples).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 24000
FRAME_SAMPLES = 600  # one Kokoro duration frame
DURATION_OUTPUT = "/encoder/Clip_output_0"
_VOCAB = json.loads((Path(__file__).with_name("kokoro_vocab.json")).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- G2P
class _HeuristicTagger:
    """Stand-in for spaCy's en_core_web_sm when it is not installed.

    misaki only needs POS tags for punctuation and a handful of function words
    (a/an/the/I/to/used); everything else is looked up in its gold dictionary.
    """

    PUNCT = {",": ",", ".": ".", "?": ".", "!": ".", ":": ":", ";": ":", "—": ":", "–": ":",
             "-": ":", '"': "''", "“": "``", "”": "''", "(": "-LRB-", ")": "-RRB-"}
    TAGS = {**{w: "DT" for w in ("a", "an", "the", "this", "that", "these", "those")},
            **{w: "PRP" for w in ("i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them")},
            **{w: "IN" for w in ("in", "on", "at", "by", "for", "with", "of", "from", "about", "into", "over")},
            "to": "TO", "and": "CC", "but": "CC", "or": "CC"}

    def __init__(self):
        import spacy
        self.nlp = spacy.blank("en")

    def __call__(self, text):
        doc = self.nlp(text)
        for tok in doc:
            tok.tag_ = self.PUNCT.get(tok.text) or self.TAGS.get(tok.text.lower(), "NN")
        return doc


class G2P:
    def __init__(self, british: bool = False, overrides: dict | None = None):
        from misaki import en, espeak
        self.overrides = {k.lower(): v for k, v in (overrides or {}).items()}
        fallback = espeak.EspeakFallback(british=british)
        try:
            import spacy
            spacy.load("en_core_web_sm")  # best quality when available
            self.g2p = en.G2P(trf=False, british=british, fallback=fallback)
            self.tagger = "en_core_web_sm"
        except Exception:
            g = en.G2P.__new__(en.G2P)
            g.british, g.nlp, g.lexicon, g.unk, g.fallback = british, _HeuristicTagger(), en.Lexicon(british), "❓", fallback
            self.g2p = g
            self.tagger = "heuristic (install en_core_web_sm for POS-aware homographs)"

    def __call__(self, text: str):
        # Pronunciation overrides use misaki's inline syntax: [word](/phonemes/)
        if self.overrides:
            def sub(m):
                ps = self.overrides.get(m.group(0).lower())
                return f"[{m.group(0)}](/{ps}/)" if ps else m.group(0)
            text = re.sub(r"[A-Za-z']+(?:-[A-Za-z']+)*", sub, text)
        phonemes, tokens = self.g2p(text)
        return phonemes, tokens


# ------------------------------------------------------------------------ Kokoro
@dataclass
class WordTiming:
    text: str
    start: float  # seconds, relative to the clip
    end: float


class Kokoro:
    def __init__(self, model_path: Path, voices_dir: Path, threads: int = 4):
        import onnxruntime as ort
        model_path = Path(model_path)
        dur_path = model_path.with_name(model_path.stem + "-dur.onnx")
        if not dur_path.exists():
            _add_duration_output(model_path, dur_path)
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(str(dur_path), so, providers=["CPUExecutionProvider"])
        self.voices_dir = Path(voices_dir)
        self._voices: dict[str, np.ndarray] = {}

    def voice(self, name: str) -> np.ndarray:
        if name not in self._voices:
            bin_file = self.voices_dir / f"{name}.bin"
            if bin_file.exists():  # onnx-community / kokoro-js layout: one raw float32 file per voice
                self._voices[name] = np.fromfile(bin_file, dtype=np.float32).reshape(-1, 1, 256)
            else:  # kokoro-onnx release layout: voices-v1.0.bin (npz with every voice)
                pack = np.load(self.voices_dir / "voices-v1.0.bin")
                self._voices[name] = pack[name].astype(np.float32).reshape(-1, 1, 256)
        return self._voices[name]

    def synth(self, phonemes: str, voice: str, speed: float):
        """Returns (audio float32 @24 kHz, per-character durations in samples)."""
        ids = [_VOCAB[c] for c in phonemes if c in _VOCAB]
        if len(ids) > 510:
            raise ValueError("sentence too long for one Kokoro pass (max ~510 phonemes); split it")
        style = self.voice(voice)[len(ids) - 1]
        wav, dur = self.sess.run(None, {
            "input_ids": np.array([[0, *ids, 0]], dtype=np.int64),
            "style": style.astype(np.float32),
            "speed": np.array([speed], dtype=np.float32),
        })
        return wav.reshape(-1).astype(np.float32), np.asarray(dur).reshape(-1).astype(np.int64) * FRAME_SAMPLES


def _add_duration_output(src: Path, dst: Path):
    """Expose Kokoro's predicted phoneme durations (pred_dur) as a second output."""
    import onnx
    from onnx import TensorProto, helper
    m = onnx.load(str(src))
    if not any(o.name == DURATION_OUTPUT for o in m.graph.output):
        m.graph.output.append(helper.make_tensor_value_info(DURATION_OUTPUT, TensorProto.FLOAT, None))
    onnx.save(m, str(dst))


def word_timings(tokens, phonemes: str, dur_samples: np.ndarray) -> list[WordTiming]:
    """Map misaki tokens onto the model's per-phoneme durations."""
    # misaki builds the string as ''.join(t.phonemes + t.whitespace); walk it the same way.
    # starts[k] = first sample of input id k (k=0 is the BOS pad, so phoneme char c is id c+1)
    starts = np.concatenate([[0], np.cumsum(dur_samples)])
    out, ci = [], 0
    for t in tokens:
        n = sum(c in _VOCAB for c in (t.phonemes or ""))
        if n and any(ch.isalnum() for ch in t.text):
            out.append(WordTiming(t.text, float(starts[1 + ci] / SAMPLE_RATE), float(starts[1 + ci + n] / SAMPLE_RATE)))
        ci += n + sum(c in _VOCAB for c in (t.whitespace or ""))
    assert ci == sum(c in _VOCAB for c in phonemes), "token/phoneme walk out of sync"
    return out


# ----------------------------------------------------------------- voiceover
def _trim(audio: np.ndarray, sr: int, thresh_db: float = -48.0, pad_start: float = 0.03, pad_end: float = 0.09):
    env = np.abs(audio)
    win = int(0.01 * sr)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    level = 20 * np.log10(env + 1e-9) - 20 * np.log10(env.max() + 1e-9)
    idx = np.where(level > thresh_db)[0]
    a = max(0, idx[0] - int(pad_start * sr))
    b = min(len(audio), idx[-1] + int(pad_end * sr))
    return a, b


def build_voiceover(sentences, voice, speed, pauses, g2p: G2P, kokoro: Kokoro, lead_in=0.25, tail=0.4):
    """Synthesise sentence by sentence and join with explicit pauses.

    `pauses[i]` = silence inserted after sentence i. Returns (audio @24 kHz,
    list of sentence dicts with offsets and model-derived word timings).
    """
    sr = SAMPLE_RATE
    pieces = [np.zeros(int(lead_in * sr), np.float32)]
    t = lead_in
    info = []
    for i, text in enumerate(sentences):
        phonemes, tokens = g2p(text)
        audio, dur = kokoro.synth(phonemes, voice, speed)
        a, b = _trim(audio, sr)
        clip = audio[a:b].copy()
        fade = int(0.008 * sr)
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
        words = [WordTiming(w.text, t + w.start - a / sr, t + w.end - a / sr) for w in word_timings(tokens, phonemes, dur)]
        info.append({"index": i, "text": text, "phonemes": phonemes, "start": t, "end": t + len(clip) / sr,
                     "words": [w.__dict__ for w in words]})
        pieces.append(clip)
        t += len(clip) / sr
        gap = pauses[i] if i < len(sentences) - 1 else tail
        pieces.append(np.zeros(int(round(gap * sr)), np.float32))
        t += int(round(gap * sr)) / sr
    return np.concatenate(pieces), info


def loudness_normalize(audio: np.ndarray, sr: int, target_lufs: float = -16.0, peak_db: float = -1.0):
    import pyloudnorm as pyln
    meter = pyln.Meter(sr)
    gain = 10 ** ((target_lufs - meter.integrated_loudness(audio)) / 20)
    out = audio * gain
    peak = np.abs(out).max()
    limit = 10 ** (peak_db / 20)
    if peak > limit:  # soft-knee limiter on the few loudest peaks
        out = np.tanh(out / limit) * limit
    return out.astype(np.float32)
