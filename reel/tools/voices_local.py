#!/usr/bin/env python3
"""Make every voice line with a local text-to-speech model (Kokoro, offline).

This is the fallback used when ElevenLabs is not available. It reads
script.json and writes one WAV per line to voices/<id>.wav, plus
voices/manifest.json describing what made them.

Usage:  python3 tools/voices_local.py
Needs:  pip install kokoro-onnx soundfile onnx   (model files download on first run)

Word timings come straight from the model's own phoneme durations and are
saved next to each line as voices/<id>.timing.json.
"""
import json
import os
import sys
import urllib.request

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.environ.get("KOKORO_DIR", "/opt/tts")
TIMED_MODEL = "kokoro-v1.0-timed.onnx"  # same model + a "duration" output (made by add_duration_output)
MODEL_URLS = {
    "kokoro-v1.0.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices-v1.0.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}


def ensure_models():
    os.makedirs(MODEL_DIR, exist_ok=True)
    for name, url in MODEL_URLS.items():
        path = os.path.join(MODEL_DIR, name)
        if not os.path.exists(path):
            print(f"downloading {name} ...")
            urllib.request.urlretrieve(url, path)


def add_duration_output():
    """Expose Kokoro's predicted phoneme durations so we get exact word timings."""
    path = os.path.join(MODEL_DIR, TIMED_MODEL)
    if os.path.exists(path):
        return path
    import onnx
    from onnx import TensorProto, helper
    model = onnx.load(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"))
    model.graph.node.append(helper.make_node("Cast", ["/encoder/Round_output_0"], ["duration"],
                                             to=TensorProto.INT64, name="duration_cast"))
    model.graph.output.append(helper.make_tensor_value_info("duration", TensorProto.INT64, None))
    onnx.save(model, path)
    return path


STRESS = str.maketrans("", "", "ˈˌ.,!?;:…—-'\" ")


def word_timings(kokoro, text, spoken, offset=0.0):
    """Give every script word the time span of its phonemes.

    `spoken` is Kokoro's per-phoneme timing for the whole sentence. Each script
    word is phonemized on its own and matched against that stream, which also
    handles espeak merging short words (e.g. "of the" -> one phoneme word).
    """
    import difflib
    tokens = text.split()
    sent_chars, sent_times = [], []
    for t in spoken:
        ch = t.phoneme.translate(STRESS)
        if ch:
            sent_chars.append(ch)
            sent_times.append((t.start, t.end))
    word_chars, owner = [], []
    for i, tok in enumerate(tokens):
        ph = kokoro.tokenizer.phonemize(tok, "en-us").translate(STRESS)
        word_chars.extend(ph)
        owner.extend([i] * len(ph))
    sm = difflib.SequenceMatcher(None, "".join(word_chars), "".join(sent_chars), autojunk=False)
    starts, ends = [None] * len(tokens), [None] * len(tokens)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            w = owner[a + k]
            t0, t1 = sent_times[b + k]
            starts[w] = t0 if starts[w] is None else min(starts[w], t0)
            ends[w] = t1 if ends[w] is None else max(ends[w], t1)
    for i in range(len(tokens)):  # rare: a word with no matched phoneme
        if starts[i] is None:
            prev_end = ends[i - 1] if i else 0.0
            starts[i] = ends[i] = prev_end
    return [{"word": tok, "start": round(s + offset, 3), "end": round(e + offset, 3)}
            for tok, s, e in zip(tokens, starts, ends)]


def main():
    ensure_models()
    from kokoro_onnx import Kokoro

    script = json.load(open(os.path.join(ROOT, "script.json")))
    kokoro = Kokoro(add_duration_output(), os.path.join(MODEL_DIR, "voices-v1.0.bin"))
    out_dir = os.path.join(ROOT, "voices")
    os.makedirs(out_dir, exist_ok=True)
    manifest = {"engine": "kokoro-onnx v1.0 (local)", "lines": {}}

    for line in script["lines"]:
        voice = script["voices"][line["speaker"]]
        parts = line.get("local_parts") or [{"text": line["text"], "speed": voice["local_speed"]}]
        chunks, words, sr, pos = [], [], 24000, 0
        for part in parts:
            audio, sr, spoken = kokoro.create_timed(part["text"], voice=voice["local_voice"],
                                                    speed=part.get("speed", voice["local_speed"]),
                                                    lang="en-us")
            audio = np.asarray(audio, dtype=np.float32)
            words += word_timings(kokoro, part["text"], spoken, offset=pos / sr)
            chunks.append(audio)
            pos += len(audio)
            if part.get("pause_after"):
                chunks.append(np.zeros(int(sr * part["pause_after"]), dtype=np.float32))
                pos += int(sr * part["pause_after"])
        audio = np.concatenate(chunks)
        assert [w["word"] for w in words] == line["text"].split(), "parts must add up to the line text"
        json.dump({"source": "kokoro phoneme durations", "words": words},
                  open(os.path.join(out_dir, f"{line['id']}.timing.json"), "w"), indent=1)
        audio = audio / max(1e-6, np.max(np.abs(audio))) * 0.89  # peak -1 dBFS
        path = os.path.join(out_dir, f"{line['id']}.wav")
        sf.write(path, audio, sr, subtype="PCM_16")
        stale = os.path.join(out_dir, f"{line['id']}.alignment.json")  # old ElevenLabs timings
        if os.path.exists(stale):
            os.remove(stale)
        manifest["lines"][line["id"]] = {
            "file": f"voices/{line['id']}.wav", "speaker": line["speaker"],
            "voice": voice["local_voice"], "duration": round(len(audio) / sr, 3),
        }
        print(f"{line['id']}: {len(audio) / sr:.2f}s  ({voice['local_voice']})  "
              + " ".join(f"{w['word']}@{w['start']:.2f}" for w in words))

    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=2)


if __name__ == "__main__":
    sys.exit(main())
