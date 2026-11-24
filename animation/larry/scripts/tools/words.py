# Transcribe a voiceover with word timestamps (faster-whisper small.en). Needs HF_HUB_DISABLE_XET=1 on first download.
# Usage: ffmpeg -i vo.mp3 -ac 1 -ar 16000 -f s16le vo16k.pcm; python3 words.py vo16k.pcm words.json
import sys, json, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
a = np.fromfile(sys.argv[1], dtype=np.int16).astype(np.float32) / 32768.0
segs, _ = m.transcribe(a, language="en", word_timestamps=True, vad_filter=False)
words = []
for s in segs:
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}")
    for w in s.words:
        words.append({"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)})
json.dump(words, open(sys.argv[2], "w"), indent=0)
print("WORDS")
print(" ".join(f"{w['w']}@{w['s']:.2f}-{w['e']:.2f}" for w in words))
