#!/usr/bin/env python3
"""Find "drink for me" in the song with faster-whisper (free, local), word timestamps.
Usage: python3 find_drop.py audio/raw/my_song.mp3 [model]  -> audio/raw/my_song.words.json + the matches"""
import json, re, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

path, name = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "small.en")
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, np.float32).copy()
m = WhisperModel(name, device="cpu", compute_type="int8")
segs, _ = m.transcribe(x, language="en", word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)} for s in segs for w in (s.words or [])]
json.dump(words, open(path.rsplit(".", 1)[0] + f".words.{name}.json", "w"), indent=0)
norm = lambda w: re.sub(r"[^a-z]", "", w.lower())
for i in range(len(words) - 2):
    if norm(words[i]["w"]) == "drink" and norm(words[i + 1]["w"]) == "for" and norm(words[i + 2]["w"]).startswith("me"):
        print(f"drink for me at {words[i]['s']:.3f}-{words[i + 2]['e']:.3f} s (p {words[i]['p']:.2f})")
print(len(words), "words")
