"""Step 4b (optional): quiet CC0 sound effects under the voiceover -> build/sfx.wav

    python scripts/make_sfx.py build/timing.json <assets_dir>/sfx voiceover.mp3 build/sfx.wav

Every effect sits 18 dB under the voice (mean level of the effect vs. mean level of the voice)
and is placed with the same line fractions build_scene.py uses for the matching action, so it
stays in sync when the voiceover changes. Sounds: SFXMint CC0 + wyzowl sfx-kit CC0 (Hugging Face). Cue list below is for Cock Coop.
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


def word(line, token, default):
    t = next((w["s"] for w in LINES[line]["words"] if w["w"].lower().startswith(token)), None)
    s, e = LINES[line]["start"], LINES[line]["end"]
    return (t - s) / (e - s) if t is not None else default


cutg = word(6, "genius", 0.83) - 0.1 / (LINES[6]["end"] - LINES[6]["start"])
fc8 = word(8, "collapses", 0.21)
fo = word(12, "opens", 0.48)
fl = word(13, "latch", 0.5)

# name: (file, trim start, trim length, fade in, fade out, extra dB)
SOUNDS = {
    "flap":   ("whoosh-fast-soft.wav", 0.0, 0.25, 0.0, 0.05, -2),
    "swish":  ("whoosh-fast-medium.wav", 0.0, 0.25, 0.0, 0.05, 0),
    "peck":   ("impact-light-hard.wav", 0.0, 0.0865, 0.0, 0.02, -2),
    "wood":   ("foley-wood-touch.wav", 0.0, 0.1275, 0.0, 0.03, 0),
    "slide":  ("foley-wood-slide.wav", 0.0, 0.5, 0.02, 0.1, -2),
    "patter": ("cartoon-run-01.mp3", 0.0, 1.7, 0.0, 0.2, -3),
    "crash":  ("impact-crate-break-08.mp3", 0.0, 2.0, 0.0, 0.4, 2),
    "thump":  ("impact-medium-soft.wav", 0.0, 0.21, 0.0, 0.03, 0),
    "hammer": ("hammer-01.mp3", 0.0, 0.3, 0.0, 0.08, 1),
    "gate":   ("iron-gate-01.mp3", 0.0, 1.3, 0.0, 0.3, -2),
    "latch":  ("mechanical-latch-light.wav", 0.0, 0.112, 0.0, 0.02, 3),
    "click":  ("click-snap-firm.wav", 0.0, 0.125, 0.0, 0.02, 2),
}
E = []  # (time, sound)
def ev(t, s):
    E.append((t, s))

ev(at(1, 0.0, 1.0, 0.4), "flap")                                   # hugged rooster flaps
ev(at(2, 0.0, 1.0, 0.02), "patter"); ev(at(2, 0.0, 1.0, 0.7), "slide")  # runs off, squeezes under the fence
for a in (0.2, 0.6):                                               # tugging at the rope, wings out
    ev(at(3, 0.48, 1.0, a), "flap")
for a in (0.125, 0.375, 0.625, 0.875):                             # pecks his face
    ev(at(4, 0.0, 0.56, a), "peck")
for a in (1 / 6, 3 / 6, 5 / 6):                                    # swats + flaps
    ev(at(4, 0.56, 1.0, a), "swish"); ev(at(4, 0.56, 1.0, a + 0.03), "flap")
ev(at(6, cutg * 0.52, cutg, 0.62), "wood")                         # rooster set down in the box
ev(at(6, cutg, 1.0, 0.25), "swish")                                # Genius! fist pump
ev(at(8, 0.0, 1.0, fc8 + 0.03) - 0.1, "crash")                     # the box collapses
ev(at(8, 0.0, 1.0, fc8 + 0.06), "thump")
for a in (0.125, 0.375, 0.625, 0.875):                             # hammering the coop
    ev(at(9, 0.0, 0.5, a), "hammer")
ev(at(10, 0.4, 0.68, 0.8), "wood")                                 # fox bursts through the doorway
ev(at(10, 0.68, 1.0, 0.0), "patter")                               # fox runs off, he chases
for a in (1 / 6, 0.5, 5 / 6):                                      # nailing the wire mesh
    ev(at(11, 0.0, 1.0, a), "hammer")
ev(at(12, 0.0, 0.56, fo / 0.56) - 0.15, "gate")                    # the cousin opens the mesh door
ev(at(12, 0.56, 1.0, 0.0), "patter")                               # rooster runs out
ev(at(13, 0.0, 1.0, fl) - 0.02, "latch"); ev(at(13, 0.0, 1.0, fl), "click")   # latch clicks shut

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
