"""Step 4b (optional): quiet CC0 sound effects under the voiceover -> build/sfx.wav

    python scripts/make_sfx.py build/timing.json <assets_dir>/sfx voiceover.mp3 build/sfx.wav

Every effect sits 18 dB under the voice (mean level of the effect vs. mean level of the voice)
and is placed with the same line fractions build_scene.py uses for the matching action, so it
stays in sync when the voiceover changes. Sounds: SFXMint CC0 + wyzowl sfx-kit CC0 (Hugging Face).
"""
import json, os, re, subprocess, sys

timing, sfxdir, voice, out = sys.argv[1:5]
T = json.load(open(timing))
LINES = {l["i"]: l for l in T["lines"]}
DUR = T["duration"]
UNDER_DB = 18.0


def mean_db(path, start=0.0, dur=None):
    cmd = ["ffmpeg", "-hide_banner", "-ss", str(start)] + (["-t", str(dur)] if dur else []) + ["-i", path, "-af", "volumedetect", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    return float(re.search(r"mean_volume: (-?[\d.]+) dB", err).group(1))


def at(line, a, b, frac):
    """time of `frac` inside the sub-shot spanning fractions a..b of narration line `line`"""
    s, e = LINES[line]["start"], LINES[line]["end"]
    t0, t1 = s + (e - s) * a, s + (e - s) * b
    return t0 + (t1 - t0) * frac


g = next((w["s"] for w in LINES[6]["words"] if w["w"].lower().startswith("genius")), None)
cut6 = (g - 0.08 - LINES[6]["start"]) / (LINES[6]["end"] - LINES[6]["start"]) if g else 0.735

# name: (file, trim start, trim length, fade in, fade out, extra dB)
SOUNDS = {
    "sniff":  ("reverse-whoosh-short-soft.wav", 0.23, 0.28, 0.06, 0.02, 0),
    "spray":  ("air-hiss-01.mp3", 0.40, 0.32, 0.02, 0.08, 0),
    "gas":    ("air-hiss-01.mp3", 0.60, 0.90, 0.10, 0.30, -3),
    "whoosh": ("whoosh-fast-soft.wav", 0.0, 0.25, 0.0, 0.05, 0),
    "thud":   ("impact-light-soft.wav", 0.0, 0.17, 0.0, 0.03, 0),
    "sit":    ("impact-medium-soft.wav", 0.0, 0.21, 0.0, 0.03, 0),
    "drag":   ("foley-wood-slide.wav", 0.0, 0.58, 0.02, 0.1, 0),
    "wheels": ("skateboard-roll-and-landing-01.mp3", 0.15, 1.0, 0.15, 0.3, 0),
    "plop":   ("water-plop-01.mp3", 0.0, 0.7, 0.0, 0.1, 0),
    "creak":  ("door-creak-01.mp3", 0.0, 1.04, 0.02, 0.2, 0),
    "crash":  ("impact-crate-break-08.mp3", 0.0, 2.0, 0.0, 0.4, 0),
    "fall":   ("body-fall-01.mp3", 0.0, 1.3, 0.0, 0.3, 0),
}
E = []  # (time, sound)
def ev(t, s):
    E.append((t, s))
def double_sniff(t):
    ev(t, "sniff"); ev(t + 0.24, "sniff")

double_sniff(at(1, 0.48, 1.0, 0.80))
double_sniff(at(2, 0.0, 0.46, 0.12))
ev(at(2, 0.46, 1.0, 0.06), "whoosh")
ev(at(3, 0.0, 0.49, 0.22), "spray"); ev(at(3, 0.0, 0.49, 0.52), "spray")
double_sniff(at(3, 0.49, 1.0, 0.55))
double_sniff(at(4, 0.0, 0.47, 0.15))
ev(at(4, 0.47, 1.0, 0.04), "whoosh")
for k in range(3):
    ev(at(6, cut6 * k / 3, cut6 * (k + 1) / 3, 0.5), "thud")
ev(at(7, 0.0, 0.32, 0.72), "sit")
double_sniff(at(7, 0.75, 1.0, 0.2))
for k in range(3):
    ev(at(8, 0.22 * k, 0.22 * (k + 1), 0.6), "sit")
double_sniff(at(8, 0.66, 1.0, 0.18)); ev(at(8, 0.66, 1.0, 0.52), "whoosh")
ev(at(9, 0.0, 0.44, 0.22), "drag"); ev(at(9, 0.0, 0.44, 0.6), "drag")
ev(at(9, 0.44, 1.0, 0.02), "wheels")
double_sniff(at(10, 0.0, 0.4, 0.62))
ev(at(11, 0.0, 1.0, 0.6), "plop")
ev(at(12, 0.0, 0.41, 0.74), "creak")
ev(at(12, 0.41, 0.70, 0.12), "crash"); ev(at(12, 0.41, 0.70, 0.5), "fall")
ev(at(13, 0.0, 0.49, 0.15), "gas")
ev(at(14, 0.0, 1.0, 0.2), "wheels")
double_sniff(at(14, 0.0, 1.0, 0.6))

voice_db = mean_db(voice)
import numpy as np
SR = 48000
buf = np.zeros((int(DUR * SR) + SR, 2), dtype=np.float32)


def load(path, ss, ln):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(ln), "-i", path, "-ac", "2", "-ar", str(SR),
                          "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


for t, name in sorted(E):
    f, ss, ln, fi, fo, extra = SOUNDS[name]
    p = os.path.join(sfxdir, f)
    x = load(p, ss, ln)
    n = len(x)
    fin, fout = int(fi * SR), int(fo * SR)
    if fin:
        x[:fin] *= np.linspace(0, 1, fin, dtype=np.float32)[:, None]
    if fout:
        x[n - fout:] *= np.linspace(1, 0, fout, dtype=np.float32)[:, None]
    gain = (voice_db - UNDER_DB) - mean_db(p, ss, ln) + extra
    x *= 10 ** (gain / 20)
    i0 = int(round(t * SR))
    m = min(n, len(buf) - i0)
    buf[i0:i0 + m] += x[:m]
buf = buf[:int(round(DUR * SR))]
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s16le", out],
               input=np.clip(buf, -1, 1).tobytes(), check=True)
print(f"{len(E)} effects, voice mean {voice_db} dB -> effects at ~{voice_db - UNDER_DB:.1f} dB")
for t, n in sorted(E):
    print(f"  {t:6.2f}s {n}")
