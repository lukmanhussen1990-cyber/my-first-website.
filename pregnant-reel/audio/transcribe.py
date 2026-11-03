"""Word timings for my_voiceover.mp3 with faster-whisper (free, local). Writes words.json."""
import json, os, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
model = WhisperModel("small.en", device="cpu", compute_type="int8")
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "my_voiceover.mp3"), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
audio = np.frombuffer(raw, np.float32)
segs, info = model.transcribe(audio, word_timestamps=True, language="en", beam_size=5,
                              vad_filter=False, initial_prompt="You're a homeless man. You live in a cardboard box behind a pizza shop. Life is simple. Your belly is huge. You're pregnant. Nine months pregnant. Sir... are you lost? No. I'm having a baby. WAAAH! So... where's my room? All eleven doctors faint.", suppress_tokens=[])
words = []
for s in segs:
    for w in s.words:
        words.append(dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 2)))
json.dump(words, open(os.path.join(HERE, "words.json"), "w"), indent=0)
print(" ".join(w["w"] for w in words))
for i, w in enumerate(words): print(i, w["s"], w["e"], w["w"], w["p"])
