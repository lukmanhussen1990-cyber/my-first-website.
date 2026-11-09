"""Transcribe the voiceover with word timestamps -> audio/voiceover_words.json"""
import json, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
src = sys.argv[1]; out = sys.argv[2]
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small.en", device="cpu", compute_type="int8")
pcm = subprocess.run(["ffmpeg","-v","error","-i",src,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True,check=True).stdout
audio = np.frombuffer(pcm, np.float32)
segs, info = model.transcribe(audio, word_timestamps=True, beam_size=5, vad_filter=False)
words = []
for s in segs:
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text}")
    for w in s.words:
        words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
json.dump(words, open(out, "w"), indent=1)
print("WORDS", len(words))
