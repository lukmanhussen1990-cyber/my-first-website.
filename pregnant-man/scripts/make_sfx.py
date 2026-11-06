"""Step 4b (optional): quiet CC0 sound effects under the voiceover -> build/sfx.wav

    python scripts/make_sfx.py build/timing.json <assets_dir>/sfx voiceover.mp3 build/sfx.wav

Every effect sits 18 dB under the voice (mean level of the effect vs. mean level of the voice)
and is placed with the same line fractions build_scene.py uses for the matching action, so it
stays in sync when the voiceover changes. Sounds: SFXMint CC0 + wyzowl sfx-kit CC0 (Hugging Face). Cue list below is for Pregnant Man.
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


g = next((w["s"] for w in LINES[5]["words"] if w["w"].lower().startswith("genius")), None)
cut5 = (g - 0.1 - LINES[5]["start"]) / (LINES[5]["end"] - LINES[5]["start"]) if g else 0.75

# name: (file, trim start, trim length, fade in, fade out, extra dB)
SOUNDS = {
    "fwump":   ("impact-light-soft.wav", 0.0, 0.165, 0.0, 0.03, 0),
    "thump":   ("impact-medium-soft.wav", 0.0, 0.21, 0.0, 0.03, 0),
    "kick":    ("impact-heavy-soft.wav", 0.0, 0.32, 0.0, 0.05, 2),
    "laugh":   ("laugh-01.mp3", 0.0, 3.0, 0.05, 0.5, 0),
    "click":   ("click-snap-soft.wav", 0.0, 0.147, 0.0, 0.03, 0),
    "snap":    ("click-snap-firm.wav", 0.0, 0.125, 0.0, 0.02, 2),
    "swish":   ("whoosh-fast-medium.wav", 0.0, 0.25, 0.0, 0.05, 0),
    "whoosh":  ("whoosh-fast-soft.wav", 0.0, 0.25, 0.0, 0.05, 0),
    "splat":   ("cartoon-splat-01.mp3", 0.0, 1.2, 0.0, 0.3, 0),
    "plop":    ("water-plop-01.mp3", 0.0, 0.7, 0.0, 0.1, 0),
    "boing":   ("cartoon-boing-01.mp3", 0.0, 1.0, 0.0, 0.2, -3),
    "slide":   ("cartoon-slide-whistle-01.mp3", 0.0, 1.4, 0.02, 0.3, 0),
    "motor":   ("camera-focus-motor-01.mp3", 0.0, 1.5, 0.05, 0.3, -2),
    "fall":    ("body-fall-01.mp3", 0.0, 1.3, 0.0, 0.3, -2),
}
E = []  # (time, sound)
def ev(t, s):
    E.append((t, s))

ev(at(2, 0.0, 1.0, 0.46), "fwump")                     # pillow goes under the shirt
ev(at(3, 0.0, 1.0, 0.69), "fwump")                     # pillow hits the floor
ev(at(4, 0.0, 0.45, 0.06), "laugh")                    # the doctor laughs
ev(at(5, 0.0, cut5, 0.55), "click")                    # belt buckle
ev(at(5, cut5, 1.0, 0.2), "swish")                     # fist pump
for k in range(4):                                     # melon bouncing on the walk
    ev(at(6, 0.0, 0.55, 0.12 + 0.25 * k), "thump")
ev(at(7, 0.0, 0.5, 1.0), "splat"); ev(at(7, 0.0, 0.5, 1.0), "plop")
ev(at(8, 0.0, 1.0, 0.25), "click"); ev(at(8, 0.0, 1.0, 0.3), "boing")
ev(at(9, 0.0, 1.0, 0.25), "slide")
ev(at(10, 0.0, 1.0, 0.5), "snap"); ev(at(10, 0.0, 1.0, 0.58), "snap")
ev(at(11, 0.0, 1.0, 0.26), "plop"); ev(at(11, 0.0, 1.0, 0.26), "fwump")
ev(at(12, 0.0, 0.5, 0.72), "plop"); ev(at(12, 0.0, 0.5, 0.8), "motor")
ev(at(12, 0.5, 1.0, 0.2), "kick"); ev(at(12, 0.5, 1.0, 0.28), "whoosh"); ev(at(12, 0.5, 1.0, 0.62), "fall")
ev(at(13, 0.0, 1.0, 0.05), "motor")
for a in (0.15, 0.35, 0.55, 0.75, 0.92):
    ev(at(13, 0.0, 1.0, a), "kick")

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
