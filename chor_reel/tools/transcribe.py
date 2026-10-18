import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)
m = WhisperModel(sys.argv[2], device="cpu", compute_type="int8", download_root=sys.argv[3])
segs, info = m.transcribe(audio, language=sys.argv[4] if len(sys.argv) > 4 else None, word_timestamps=True, vad_filter=False, beam_size=5)
print("lang", info.language, info.language_probability)
for s in segs:
    print(f"[{s.start:6.2f} -> {s.end:6.2f}] {s.text}")
    print("    words:", " ".join(f"{w.word.strip()}@{w.start:.2f}" for w in (s.words or [])))
