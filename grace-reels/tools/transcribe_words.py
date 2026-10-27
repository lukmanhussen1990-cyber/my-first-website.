"""Transcribe a video/audio file with word timestamps and print pacing stats.

usage: <venv with faster-whisper>/bin/python -I tools/transcribe_words.py <media> <out_json> [model]
"""
import sys, json, subprocess
import numpy as np
from faster_whisper import WhisperModel

media, out_json = sys.argv[1], sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "small.en"
# decode with ffmpeg ourselves (the bundled PyAV build rejects faster-whisper's open() args)
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", media, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, word_timestamps=True, vad_filter=False, beam_size=5)

words, segs = [], []
for s in segments:
    segs.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()})
    for w in s.words:
        words.append({"w": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2)})

gaps = [round(b["start"] - a["end"], 2) for a, b in zip(words, words[1:])]
speech = sum(w["end"] - w["start"] for w in words)
span = words[-1]["end"] - words[0]["start"] if words else 0
stats = {
    "duration": round(info.duration, 2),
    "words": len(words),
    "first_word_at": words[0]["start"] if words else None,
    "last_word_end": words[-1]["end"] if words else None,
    "wpm_over_span": round(len(words) / span * 60, 1) if span else None,
    "pauses_over_0.35s": sum(1 for g in gaps if g > 0.35),
    "longest_pauses": sorted(gaps, reverse=True)[:8],
}
json.dump({"stats": stats, "segments": segs, "words": words}, open(out_json, "w"), indent=1)
print(json.dumps(stats, indent=1))
for s in segs:
    print(f"[{s['start']:6.2f}-{s['end']:6.2f}] {s['text']}")
