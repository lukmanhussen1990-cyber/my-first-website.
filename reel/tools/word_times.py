"""Word timestamps for each voice part (faster-whisper). Usage: python word_times.py <voice_dir> -> words.json"""
import sys, json, glob, os, re, subprocess
import numpy as np
from faster_whisper import WhisperModel

vdir = sys.argv[1]
model = WhisperModel("small.en", device="cpu", compute_type="int8")
out = {}
for f in sorted(glob.glob(os.path.join(vdir, "part*.*")), key=lambda p: int(re.findall(r"part(\d+)", p)[0])):
    pid = int(re.findall(r"part(\d+)", f)[0])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0
    segs, _ = model.transcribe(audio, word_timestamps=True, language="en", vad_filter=False)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    out[pid] = {"file": os.path.basename(f), "dur": round(len(audio) / 16000, 3), "words": words}
    print(pid, " ".join(w["w"] for w in words), flush=True)
json.dump(out, open(os.path.join(vdir, "words.json"), "w"), indent=1)
