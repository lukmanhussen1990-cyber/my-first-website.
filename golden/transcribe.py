#!/usr/bin/env python3
"""Run once: local faster-whisper word timestamps -> audio/whisper_words.json (no API, no cost).
   python -m venv fw && fw/bin/pip install faster-whisper && fw/bin/python transcribe.py"""
import json, os, subprocess
import numpy as np
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "audio", "my_voiceover.mp3"), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype="<f4").copy()
segs, _ = WhisperModel("base.en", device="cpu", compute_type="int8").transcribe(
    x, language="en", word_timestamps=True, vad_filter=True, condition_on_previous_text=False, beam_size=5)
words = [(w.word.strip(), round(w.start, 3), round(w.end, 3)) for s in segs for w in s.words]
json.dump(words, open(os.path.join(HERE, "audio", "whisper_words.json"), "w"))
print(len(words), "words")
