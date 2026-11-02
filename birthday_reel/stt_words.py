"""Speech-to-text word times for each ElevenLabs take (faster-whisper, word timestamps).

Usage:  python3 stt_words.py audio/raw/narr_A.mp3 [audio/raw/narr_B.mp3 ...]
Writes: <take>.words.json next to each take: [{"w": word, "s": start, "e": end, "p": probability}]
Prints how the heard words compare with the script in script.json (every script word must be heard).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load16k(path):
    """Decode with ffmpeg (avoids PyAV version issues): mono float32 at 16 kHz."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
WORDS = " ".join(l["text"].replace('"', "") for l in SCRIPT["lines"]).split()
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))

model = WhisperModel(os.environ.get("WHISPER_MODEL", "medium.en"), device="cpu", compute_type="int8")
for path in sys.argv[1:]:
    segs, _ = model.transcribe(load16k(path), language="en", word_timestamps=True, beam_size=5,
                               # no script hint by default, so a misread word cannot hide (HINT=1 adds it)
                               initial_prompt=" ".join(WORDS) if os.environ.get("HINT") else None,
                               condition_on_previous_text=False,
                               vad_filter=False)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)}
             for s in segs for w in s.words]
    out = os.path.splitext(path)[0] + ".words.json"
    json.dump(words, open(out, "w"), indent=0)
    heard = [norm(w["w"]) for w in words]
    want = [norm(w) for w in WORDS]
    ok = heard == want
    print(f"{path}: {len(words)} words heard, script has {len(want)} -> {'MATCH' if ok else 'DIFFERENT'}")
    if not ok:
        import difflib
        for op, a0, a1, b0, b1 in difflib.SequenceMatcher(a=want, b=heard).get_opcodes():
            if op != "equal":
                print(f"   {op}: script {want[a0:a1]} vs heard {heard[b0:b1]}")
    low = [w for w in words if w["p"] < 0.5]
    if low:
        print("   low-confidence words:", ", ".join(f"{w['w']}@{w['s']:.2f}({w['p']})" for w in low))
