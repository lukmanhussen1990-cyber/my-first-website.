"""Transcribe voiceover takes with word timestamps (faster-whisper) and save JSON."""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel


def load16k(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

model = WhisperModel("small.en", device="cpu", compute_type="int8")
for path in sys.argv[1:]:
    segs, info = model.transcribe(load16k(path), word_timestamps=True, beam_size=5, vad_filter=False,
                                  initial_prompt="Secret underground garage. Hydraulic lift. Vent pipe.")
    words = []
    for s in segs:
        for w in s.words:
            words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)})
    out = path.rsplit(".", 1)[0] + ".words.json"
    json.dump(words, open(out, "w"), indent=1)
    print("==", path, len(words), "words")
    print(" ".join(w["w"] for w in words))
