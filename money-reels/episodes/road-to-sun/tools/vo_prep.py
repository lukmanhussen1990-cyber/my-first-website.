"""Tighten the pauses in the voiceover and build word-timed captions.

Input:  audio/src/voiceover_original.mp3, audio/src/voiceover_alignment.json
Output: audio/vo.wav (48 kHz mono), src/data/captions.json

The voice is never sped up or pitch-shifted; only silences between phrases are shortened.
Word times come from one forced pass of a sherpa-onnx zipformer model over the tightened audio
(set ASR_MODEL_DIR to sherpa-onnx-zipformer-en-2023-06-26 from the k2-fsa GitHub releases).
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
DEFAULT_GAP = 0.20      # extra silence between phrases (each phrase already keeps 50 ms margins)
GAP_OVERRIDE = {0: 0.45, 15: 0.40, 21: 0.45}  # hook pause, before Elon, after "Sun"
TAIL = 1.6              # end card hold after the last word

# Caption text per phrase: (display word, number of spoken words it covers, green?)
G = True
CAPTIONS = [
    [("This",1,0),("road",1,0),("is",1,0),("made",1,0),("of",1,0),("Elon",1,G),("Musk's",1,G),("money...",1,G)],
    [("and",1,0),("it",1,0),("ends",1,0),("at",1,0),("the",1,0),("Sun.",1,G)],
    [("Let's",1,0),("lay",1,0),("out",1,0),("famous",1,0),("people's",1,0),("money",1,G),("in",1,0),
     ("one-dollar",2,G),("bills,",1,G),("end",1,0),("to",1,0),("end.",1,0)],
    [("First,",1,0)],
    [("you.",1,G)],
    [("$10,000.",3,G)],
    [("Your",1,0),("road",1,0),("is",1,0),("1.5",4,G),("kilometers.",1,G)],
    [("A",1,0),("20-minute",2,G),("walk.",1,G)],
    [("Cristiano",1,G),("Ronaldo.",1,G)],
    [("1.2",3,G),("billion",1,G),("dollars.",1,G)],
    [("His",1,0),("road",1,0),("shoots",1,0),("into",1,0),("space...",1,G)],
    [("almost",1,0),("halfway",2,G),("to",1,0),("the",1,0),("Moon!",1,G)],
    [("MrBeast.",2,G)],
    [("2.6",3,G),("billion.",1,G)],
    [("His",1,0),("road",1,0),("reaches",1,0),("the",1,0),("Moon...",1,G)],
    [("and",1,0),("keeps",1,G),("going!",1,G)],
    [("And",1,0),("Elon",1,G),("Musk.",1,G)],
    [("About",1,0),("1",1,G),("trillion",1,G),("dollars.",1,G)],
    [("His",1,0),("road",1,0),("blasts",1,G),("past",1,0),("the",1,0),("Moon...",1,G)],
    [("keeps",1,0),("going...",1,G)],
    [("and",1,0),("going...",1,G)],
    [("all",1,0),("the",1,0),("way",1,0),("to",1,0),("the",1,0),("Sun!",1,G)],
    [("That's",1,0),("156",4,G),("million",1,G),("kilometers",1,G),("of",1,0),("money.",1,0)],
    [("Driving",1,0),("it",1,0),("at",1,0),("100",2,G),("km/h",3,G),("would",1,0),("take",1,0),
     ("178",4,G),("years.",1,G)],
    [("So",1,0),("how",1,0),("far",1,0),("would",1,0),("YOUR",1,G),("money",1,0),("road",1,0),("go?",1,0)],
    [("Tell",1,0),("me",1,0),("in",1,0),("the",1,0),("comments!",1,G)],
]


def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def align(y):
    """Return [(WORD, start_s)] for the whole tightened voiceover."""
    import sherpa_onnx
    from scipy.signal import resample_poly
    m = os.environ["ASR_MODEL_DIR"]
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{m}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{m}/decoder-epoch-99-avg-1.onnx",
        joiner=f"{m}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{m}/tokens.txt", num_threads=4)
    st = rec.create_stream()
    st.accept_waveform(16000, resample_poly(y, 1, 3).astype(np.float32))
    rec.decode_stream(st)
    words = []
    for tok, t in zip(st.result.tokens, st.result.timestamps):
        if tok.startswith(" ") or not words:
            words.append([tok.strip(), t])
        else:
            words[-1][0] += tok
    return words


def main():
    x = load_audio(ROOT / "audio/src/voiceover_original.mp3")
    segs = [s for s in json.load(open(ROOT / "audio/src/voiceover_alignment.json")) if s["text"]]
    assert len(segs) == len(CAPTIONS), (len(segs), len(CAPTIONS))

    out, phrases, t_new = [], [], 0.0
    fade = int(0.008 * SR)
    for i, (s, cap) in enumerate(zip(segs, CAPTIONS)):
        a, b = s["start"], s["end"]
        chunk = x[int(a * SR):int(b * SR)].copy()
        chunk[:fade] *= np.linspace(0, 1, fade)
        chunk[-fade:] *= np.linspace(1, 0, fade)
        out.append(chunk)
        shift = t_new - a
        phrases.append({"i": i, "start": round(a + shift + 0.05, 3), "end": round(b + shift - 0.05, 3),
                        "orig_start": a, "cap": cap})

        t_new += b - a
        if i < len(segs) - 1:
            orig_gap = segs[i + 1]["start"] - b
            gap = min(orig_gap, GAP_OVERRIDE.get(i, DEFAULT_GAP))
            out.append(np.zeros(int(round(gap * SR)), np.float32))
            t_new += gap

    out.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(out)
    sf.write(ROOT / "audio/vo.wav", y, SR, subtype="FLOAT")
    dur = len(y) / SR

    spoken = align(y)
    for p in phrases:
        ws = [w for w in spoken if p["start"] - 0.35 <= w[1] <= p["end"]]
        cap = p.pop("cap")
        assert sum(n for _, n, _ in cap) == len(ws), ([d for d, _, _ in cap], ws)
        words, k = [], 0
        for disp, n, green in cap:
            words.append({"text": disp, "start": round(ws[k][1], 3), "green": bool(green)})
            k += n
        for j, w in enumerate(words):
            w["end"] = words[j + 1]["start"] if j + 1 < len(words) else p["end"]
        p["start"] = min(p["start"], words[0]["start"])
        p["words"] = words
    json.dump({"duration": round(dur, 3), "phrases": phrases}, open(ROOT / "src/data/captions.json", "w"), indent=1)
    print(f"original {len(x)/SR:.2f}s -> tightened {dur:.2f}s (incl. {TAIL}s end hold)")
    for p in phrases:
        print(f"{p['start']:6.2f}-{p['end']:6.2f}  " + " ".join(w["text"] for w in p["words"]))


if __name__ == "__main__":
    sys.exit(main())
