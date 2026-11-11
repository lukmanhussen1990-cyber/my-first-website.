"""Transcribe the voiceover with faster-whisper and dump word-level timestamps to JSON."""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

src = sys.argv[1] if len(sys.argv) > 1 else "assets/voiceover.mp3"
out = sys.argv[2] if len(sys.argv) > 2 else "build/words.json"
model_name = sys.argv[3] if len(sys.argv) > 3 else "large-v3"

model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=4)
pcm = subprocess.run(["ffmpeg","-v","error","-i",src,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True,check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
segments, info = model.transcribe(audio, language="en", word_timestamps=True, beam_size=5,
                                  vad_filter=False, condition_on_previous_text=False)
words = []
for seg in segments:
    print(f"[{seg.start:6.2f} -> {seg.end:6.2f}] {seg.text}")
    for w in seg.words:
        words.append({"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump({"duration": info.duration, "words": words}, open(out, "w"), indent=1)
for w in words:
    print(f"{w['start']:6.2f} {w['end']:6.2f}  {w['word']}")
