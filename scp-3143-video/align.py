"""Word-level timestamps for each narration clip (faster-whisper).

Writes build/words.json: {"<scene>_<i>": [{"w": "word", "s": start, "e": end}, ...]}.
The renderer uses these to fire animations on specific spoken words, falling
back to a character-proportional estimate when a word isn't recognised.
"""
import json
import os

from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def main():
    with open(os.path.join(BUILD, "voice.json")) as f:
        voice = json.load(f)
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    out = {}
    for key, info in voice.items():
        segs, _ = model.transcribe(os.path.join(BUILD, info["file"]),
                                   beam_size=5, word_timestamps=True)
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)}
                 for s in segs for w in s.words]
        out[key] = words
        print(key, " ".join(w["w"] for w in words))
    with open(os.path.join(BUILD, "words.json"), "w") as f:
        json.dump(out, f, indent=0)


if __name__ == "__main__":
    main()
