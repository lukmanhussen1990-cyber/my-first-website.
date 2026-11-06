"""Step 1: word-level timestamps for the voiceover with faster-whisper (local, free).

Usage:  python scripts/transcribe.py voiceover.mp3 build/words.json [model]
Writes a JSON list of {"word", "start", "end"} in seconds.
"""
import json
import subprocess
import sys

import numpy as np

from faster_whisper import WhisperModel

audio = sys.argv[1]
out = sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "medium.en"

model = WhisperModel(model_name, device="cpu", compute_type="int8")
# decode with ffmpeg (avoids PyAV version issues) -> 16 kHz mono float32
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", "16000",
                      "-f", "f32le", "-"], check=True, capture_output=True).stdout
samples = np.frombuffer(pcm, dtype=np.float32)
segments, info = model.transcribe(samples, word_timestamps=True, beam_size=5,
                                  vad_filter=False, condition_on_previous_text=True)
words = []
for seg in segments:
    for w in seg.words:
        words.append({"word": w.word.strip(), "start": round(w.start, 3),
                      "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump(words, open(out, "w"), indent=1)
print(f"{len(words)} words, audio {info.duration:.2f}s")
print(" ".join(f"{w['word']}[{w['start']:.2f}]" for w in words))
