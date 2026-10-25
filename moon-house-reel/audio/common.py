"""Shared helpers for the voice / subtitle / mix pipeline."""
import json
import os
import re
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_JSON = os.path.join(ROOT, "script", "script.json")
TIMELINE_JSON = os.path.join(ROOT, "scene", "timeline.json")
VOICE_DIR = os.path.join(ROOT, "voice")
TIMINGS_JSON = os.path.join(VOICE_DIR, "timings.json")
SR = 48000


def load_script():
    with open(SCRIPT_JSON) as f:
        return json.load(f)


def load_timeline():
    with open(TIMELINE_JSON) as f:
        return json.load(f)


def display_words(text):
    """Split a script line into the words shown on screen.

    Spelling and capitalisation are kept exactly as written; only the
    sentence punctuation that trails a word (, . ; :) is dropped.
    """
    out = []
    for tok in text.split():
        w = re.sub(r"[,.;:]+$", "", tok)
        if w:
            out.append(w)
    return out


def norm(word):
    return re.sub(r"[^a-z0-9']", "", word.lower().replace("’", "'"))


def read_wav(path):
    """Read a mono/stereo 16-bit wav (or anything ffmpeg can read) as float32 mono at SR."""
    import subprocess
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def write_wav(path, audio, sr=SR):
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 1:
        audio = audio[:, None]
    pcm = np.clip(audio, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def save_timings(source, lines, extra=None):
    data = {"source": source, "lines": lines}
    if extra:
        data.update(extra)
    with open(TIMINGS_JSON, "w") as f:
        json.dump(data, f, indent=2)
    print(f"wrote {TIMINGS_JSON}")


def load_timings():
    with open(TIMINGS_JSON) as f:
        return json.load(f)
