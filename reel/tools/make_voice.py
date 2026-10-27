"""Generate the voiceover parts with Kokoro (local, free TTS) and insert gaps where sound effects go.
Usage: python make_voice.py <kokoro.onnx> <voices.bin> <outdir> [voice] [speed]
Writes part1.wav ... part10.wav (48 kHz mono)."""
import sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

model, voices, outdir = sys.argv[1:4]
voice = sys.argv[4] if len(sys.argv) > 4 else "am_michael"
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
SR_OUT = 48000

# Each part is a list of (text, gap_after_seconds). Gaps leave room for meow / hiss sound effects.
PARTS = {
    1: [("Adult cats almost never meow at each other.", 1.05), ("That sound? It's only for you.", 0)],
    2: [("It starts with kittens. They meow to call mom: I'm cold, I'm hungry, come here!", 0)],
    3: [("As they grow up, they mostly stop meowing at other cats. They use body language instead.", 0)],
    4: [("A flick of the tail. A sniff. A long stare.", 0.12), ("And if that fails,", 0.32), ("a hiss.", 0)],
    5: [("So why keep meowing at us? Scientists think it's simple: we answer.", 0.12), ("Meow,", 0.3), ("food.", 0)],
    6: [("That's probably why feral cats, with no humans around, meow way less than pet cats.", 0)],
    7: [("And every cat seems to build its own meows, just for its own human.", 0)],
    8: [("A long, loud one at the food bowl.", 1.0), ("A short, sweet one at the door.", 0.5), ("And you understand both.", 0)],
    9: [("In a small twenty fifteen study, owners did best with their own cat's meows.", 0.1), ("A stranger's cat? Just guessing.", 0)],
    10: [("So when your cat meows at you, it's not just noise.", 0.15), ("It's a language made just for you.", 0)],
}


def trim(a, sr, thresh=0.01, pad=0.03):
    env = np.abs(a)
    idx = np.where(env > thresh)[0]
    if not len(idx):
        return a
    s = max(0, idx[0] - int(pad * sr))
    e = min(len(a), idx[-1] + int(pad * 2 * sr))
    return a[s:e]


def resample(a, sr_in, sr_out):
    n = int(round(len(a) * sr_out / sr_in))
    return np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)


k = Kokoro(model, voices)
for pid, segs in PARTS.items():
    chunks = []
    for text, gap in segs:
        a, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
        a = trim(a.astype(np.float32), sr)
        a = resample(a, sr, SR_OUT)
        chunks.append(a)
        if gap:
            chunks.append(np.zeros(int(gap * SR_OUT), np.float32))
    out = np.concatenate([np.zeros(int(0.05 * SR_OUT), np.float32)] + chunks + [np.zeros(int(0.08 * SR_OUT), np.float32)])
    out *= 0.89 / max(1e-6, np.abs(out).max())
    sf.write(f"{outdir}/part{pid}.wav", out, SR_OUT, subtype="PCM_16")
    print(f"part{pid}: {len(out) / SR_OUT:.2f}s", flush=True)
