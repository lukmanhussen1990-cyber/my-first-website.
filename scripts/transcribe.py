"""Transcribe the voiceover with Whisper (faster-whisper, 'small' model) using
word-level timestamps, and write words.json.

Usage: python3 scripts/transcribe.py <model_dir> assets/voiceover.mp3 words.json
"""
import json
import sys

import subprocess

import numpy as np
from faster_whisper import WhisperModel

model_dir, audio, out = sys.argv[1], sys.argv[2], sys.argv[3]
# Decode with ffmpeg to 16 kHz mono float32 (read-only: the voiceover file is not changed).
pcm = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", audio, "-f", "s16le",
                      "-ac", "1", "-ar", "16000", "-"], check=True, capture_output=True).stdout
samples = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
model = WhisperModel(model_dir, device="cpu", compute_type="int8")
segments, info = model.transcribe(
    samples,
    language="en",
    word_timestamps=True,
    beam_size=5,
    vad_filter=False,
    condition_on_previous_text=True,
)
words = []
segs = []
for seg in segments:
    segs.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text.strip()})
    for w in seg.words:
        words.append({
            "word": w.word.strip(),
            "start": round(w.start, 3),
            "end": round(w.end, 3),
            "probability": round(w.probability, 3),
        })
with open(out, "w") as f:
    json.dump({"duration": round(info.duration, 3), "text": " ".join(s["text"] for s in segs),
               "segments": segs, "words": words}, f, indent=1)
for s in segs:
    print(f"[{s['start']:7.2f} - {s['end']:7.2f}] {s['text']}")
print("words:", len(words), "duration:", info.duration)
