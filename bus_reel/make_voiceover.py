"""The voiceover = the user's recording exactly as recorded (no cuts, no re-timing, no other voice).

1. audio/voiceover_src.mp3 -> audio/voiceover.wav (48 kHz mono; same length, same timing)
2. word times: faster-whisper (local, free) via stt_words.py -> audio/raw/user_take.words.json
3. script words <- heard words (in order) -> audio/voiceover.words.json + audio/vo_lines.json (line = first..last word)
Run: python3 make_voiceover.py
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def main():
    src = os.path.join(HERE, "audio", "voiceover_src.mp3")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).copy()
    take = os.path.join(HERE, SCRIPT["take"])
    os.makedirs(os.path.dirname(take), exist_ok=True)
    sf.write(take, y, SR, subtype="PCM_24")
    sf.write(os.path.join(HERE, "audio", "voiceover.wav"), y, SR, subtype="PCM_24")
    wj = os.path.splitext(take)[0] + ".words.json"
    if not os.path.exists(wj) or os.environ.get("RESTT"):
        subprocess.run([sys.executable, "-I", os.path.join(HERE, "stt_words.py"), take], check=False,
                       env=dict(os.environ, WHISPER_MODEL="small.en", HINT="1"))
    heard = json.load(open(wj))
    lines = SCRIPT["lines"]
    script = [(i + 1, w) for i, l in enumerate(lines) for w in l["text"].split()]
    if [norm(w) for _, w in script] != [norm(h["w"]) for h in heard]:
        import difflib
        for op, a0, a1, b0, b1 in difflib.SequenceMatcher(a=[norm(w) for _, w in script], b=[norm(h["w"]) for h in heard]).get_opcodes():
            if op != "equal":
                print(op, [w for _, w in script[a0:a1]], [h["w"] for h in heard[b0:b1]])
        sys.exit("heard words differ from the script")
    words = [{"w": w, "s": h["s"], "e": h["e"], "line": li} for (li, w), h in zip(script, heard)]
    meta = []
    for i, l in enumerate(lines, 1):
        ws = [w for w in words if w["line"] == i]
        meta.append({"i": i, "who": "N", "text": l["text"], "start": ws[0]["s"], "end": ws[-1]["e"]})
    json.dump({"source": "user recording, unedited", "duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(HERE, "audio", "vo_lines.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(HERE, "audio", "voiceover.words.json"), "w"), indent=0)
    for m in meta:
        print(f"{m['i']:2d} {m['start']:6.2f}-{m['end']:6.2f}  {m['text']}")
    print(f"voiceover: {len(y) / SR:.3f} s (unchanged)")


if __name__ == "__main__":
    main()
