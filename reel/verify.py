"""Checks on the finished MP4: captions vs. what is heard, loudness, and edges.

    python3 verify.py out/reel.mp4 /path/to/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8
"""
import json
import re
import subprocess
import sys

import numpy as np
import sherpa_onnx

import audio
from timeline import FPS, Timeline, _norm

SR = 16000


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:"
                          "format=duration", "-of", "json", path], capture_output=True, text=True).stdout
    return json.loads(out)


def heard_words(path, model_dir):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le",
                          "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32)
    p = lambda f: f"{model_dir}/{f}"
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=p("encoder.int8.onnx"), decoder=p("decoder.int8.onnx"), joiner=p("joiner.int8.onnx"),
        tokens=p("tokens.txt"), model_type="nemo_transducer")
    words, bounds = [], [0.0, 16.26, 32.3, len(a) / SR]
    for s, e in zip(bounds, bounds[1:]):
        st = rec.create_stream()
        st.accept_waveform(SR, a[int(s * SR):int(e * SR)])
        rec.decode_stream(st)
        for tok, t in zip(st.result.tokens, st.result.timestamps):
            if tok.startswith(" ") or not words:
                words.append([tok.strip(), s + t])
            else:
                words[-1][0] += tok
    return words


def main(path, model_dir):
    info = probe(path)
    print("streams:", info["streams"], "duration:", info["format"]["duration"])
    tl = Timeline()

    # 1. captions vs. heard words (ASR on the final mix, music included)
    heard = heard_words(path, model_dir)
    bad = 0
    for c in tl.captions:
        want = [_norm(p) for w, _ in c["runs"] for p in re.split(r"[-\s]", w) if _norm(p)]
        got = [_norm(w) for w, t in heard if c["start"] - 0.12 <= t < c["end"] + 0.05 and _norm(w)]
        ok = all(w in got for w in want)
        bad += not ok
        cap = " ".join(w for w, _ in c["runs"])
        print(f"{'OK ' if ok else 'BAD'} {c['start']:6.2f}-{c['end']:6.2f} caption: {cap:<28} heard: {' '.join(got)}")
    print(f"captions matching the voice: {len(tl.captions) - bad}/{len(tl.captions)}")

    # 2. loudness: whole mix, and the music bed in the pauses vs. the speech
    i, tp = audio.loudness(path)
    print(f"mix: {i:.1f} LUFS integrated, true peak {tp:.1f} dBTP")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le",
                          "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32)
    speech = np.zeros(len(a), bool)
    for _, s, e in tl.words:
        speech[int(s * 48000):int(e * 48000)] = True
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    gaps = ~speech
    gaps[: int(0.3 * 48000)] = False
    print(f"RMS during speech {db(a[speech]):.1f} dBFS, music-only pauses {db(a[gaps]):.1f} dBFS")

    # 3. edges: dark outline pixels touching the frame border, per scene sample
    n = tl.n_frames
    for k in range(0, n, FPS // 2):
        img = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{k / FPS:.3f}", "-i", path, "-frames:v", "1",
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        f = np.frombuffer(img, np.uint8).reshape(1920, 1080, 3).astype(int)
        ink = (np.abs(f - [42, 30, 60]).sum(2) < 40)
        border = np.zeros_like(ink)
        border[:12, :] = border[-12:, :] = border[:, :12] = border[:, -12:] = True
        hits = int((ink & border).sum())
        if hits > 40:
            print(f"edge contact at {k / FPS:5.2f}s: {hits} outline px on the border")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
