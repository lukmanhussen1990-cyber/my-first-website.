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
# which script words a take must contain: narr_* -> narrator lines, yell_* -> YOU's yells
WHO = {"user": "N"}
words_for = lambda path: " ".join(l["text"] for l in SCRIPT["lines"]
                                  if l["who"] == WHO[os.path.basename(path).split("_")[0]]).split()
norm = lambda w: re.sub(r"o{3,}", "ooo", re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'")))

NUM = {"30": ["thirty"], "20": ["twenty"], "1000": ["a", "thousand"], "1,000": ["a", "thousand"]}


def fix_tokens(words):
    """Whisper writes numbers as digits and splits "I'm" into "I" + "'m": map back to the script's words."""
    out = []
    for w in words:
        core = re.sub(r"[^0-9a-zA-Z']", "", w["w"])
        if core.startswith("'") and out:                  # "'m" -> glue onto the previous word
            out[-1] = dict(out[-1], w=out[-1]["w"] + w["w"], e=w["e"])
            continue
        if out and re.sub(r"[^a-z]", "", out[-1]["w"].lower()).startswith("gardy") and core.lower() in ("loo", "lou", "lue"):
            out[-1] = dict(out[-1], w=out[-1]["w"] + w["w"], e=w["e"])
            continue
        if core in NUM:
            parts, tail = NUM[core], w["w"][len(w["w"].rstrip(".,!?:;")):]
            d = (w["e"] - w["s"]) / len(parts)
            for k, p in enumerate(parts):
                out.append(dict(w, w=p + (tail if k == len(parts) - 1 else ""),
                                s=round(w["s"] + k * d, 3), e=round(w["s"] + (k + 1) * d, 3)))
            continue
        out.append(w)
    return out


model = WhisperModel(os.environ.get("WHISPER_MODEL", "medium.en"), device="cpu", compute_type="int8")
for path in sys.argv[1:]:
    WORDS = words_for(path)
    segs, _ = model.transcribe(load16k(path), language="en", word_timestamps=True, beam_size=5,
                               # no script hint by default, so a misread word cannot hide (HINT=1 adds it)
                               initial_prompt=" ".join(WORDS) if os.environ.get("HINT") else None,
                               condition_on_previous_text=False,
                               vad_filter=False)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)}
             for s in segs for w in s.words]
    words = fix_tokens(words)
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
