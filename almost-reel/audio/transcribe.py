"""Word timings for my_voiceover.mp3 with faster-whisper (free, local). Writes words.json."""
import json, os, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
HERE = os.path.dirname(os.path.abspath(__file__))
model = WhisperModel("small.en", device="cpu", compute_type="int8")
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "my_voiceover.mp3"), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
audio = np.frombuffer(raw, np.float32)
segs, info = model.transcribe(audio, word_timestamps=True, language="en", beam_size=5,
                              vad_filter=False, initial_prompt="You need to poop. But you're five minutes from home. You walk faster. Too fast. Danger. You start making deals with God. They're not there. Other pocket. Backpack. Under the doormat. Then... JINGLE. You open the door. CLICK. It's locked. Just five more minutes, sweetie!", suppress_tokens=[])
words = []
for s in segs:
    for w in s.words:
        words.append(dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 2)))
json.dump(words, open(os.path.join(HERE, "words.json"), "w"), indent=0)
print(" ".join(w["w"] for w in words))
for i, w in enumerate(words): print(i, w["s"], w["e"], w["w"], w["p"])
