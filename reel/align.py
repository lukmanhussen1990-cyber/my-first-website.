"""Word timings for the voiceover, via a local Parakeet-TDT ASR model (sherpa-onnx).

Only needed when the voiceover changes; the result is committed as data/words_asr.json.

    python3 align.py /path/to/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8

Model: github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/
       sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2
"""
import json
import os
import subprocess
import sys

import numpy as np
import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
# Split points that fall inside pauses, so each chunk stays well under 30 s
CUTS = [16.26, 32.3]


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def main(model_dir):
    p = lambda f: os.path.join(model_dir, f)
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=p("encoder.int8.onnx"), decoder=p("decoder.int8.onnx"),
        joiner=p("joiner.int8.onnx"), tokens=p("tokens.txt"), model_type="nemo_transducer")
    audio = load(os.path.join(HERE, "assets", "voiceover.mp3"))
    bounds = [0.0, *CUTS, len(audio) / SR]
    words = []
    for s, e in zip(bounds, bounds[1:]):
        st = rec.create_stream()
        st.accept_waveform(SR, audio[int(s * SR):int(e * SR)])
        rec.decode_stream(st)
        cur = None
        for tok, t in zip(st.result.tokens, st.result.timestamps):
            if tok.startswith(" ") or cur is None:
                if cur:
                    words.append(cur)
                cur = [tok.strip(), round(s + t, 3)]
            else:
                cur[0] += tok
        if cur:
            words.append(cur)
    with open(os.path.join(HERE, "data", "words_asr.json"), "w") as f:
        json.dump(words, f)
    print(" ".join(w for w, _ in words))


if __name__ == "__main__":
    main(sys.argv[1])
