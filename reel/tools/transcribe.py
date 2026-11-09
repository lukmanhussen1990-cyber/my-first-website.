# Word-level timestamps for the voiceover with faster-whisper (runs locally).
import json, sys, subprocess
import numpy as np
from faster_whisper import WhisperModel
src, out = sys.argv[1], sys.argv[2]
model = WhisperModel("small.en", device="cpu", compute_type="int8")
prompt = ("You're rubbing up and down on it, you're moaning loud, and boom, her dad walks in. But it's just your back. "
          "It's itchy. Really itchy. So Grandma saves the day. She knits you a special scratch sweater, made of Velcro.")
pcm = subprocess.run(["ffmpeg","-v","error","-i",src,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True,check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
segs, info = model.transcribe(audio, word_timestamps=True, beam_size=5, language="en", vad_filter=False)
words = []
for s in segs:
    for w in s.words:
        words.append({"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump({"words": words}, open(out, "w"), indent=1)
print(len(words), "words")
print(" ".join(w["text"] for w in words))
