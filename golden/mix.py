#!/usr/bin/env python3
"""Your voiceover, untouched, as the main sound + quiet code-made SFX underneath.
The voice is only gain-staged (no pitch/tempo/EQ change). -> build/mix.wav"""
import json, os, subprocess, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")


def read_wav(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768


def main():
    tl = json.load(open(os.path.join(B, "timeline.json")))
    script = json.load(open(os.path.join(HERE, "script.json")))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, script["voiceover"]), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    voice = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    n = len(voice)
    sp = voice[np.abs(voice) > 0.01]
    g = 10 ** ((-17.0 - 20 * np.log10(np.sqrt(np.mean(sp ** 2)) + 1e-12)) / 20)
    voice = voice * g
    peak = np.max(np.abs(voice))
    if peak > 0.97: voice *= 0.97 / peak                    # never clip the voice
    sfx = np.zeros(n)
    for ev in tl["sfx"]:
        x = read_wav(os.path.join(B, "sfx", ev["name"] + ".wav")) * 10 ** (ev["gain_db"] / 20)
        if ev.get("dur"):
            m = int(ev["dur"] * SR)
            if len(x) > m: x = x[:m].copy(); f = min(m, int(0.2 * SR)); x[-f:] *= np.linspace(1, 0, f)
        p = int(round(ev["t"] * SR)); x = x[: max(0, n - p)]; sfx[p:p + len(x)] += x
    envv = np.convolve(np.abs(voice), np.ones(4800) / 4800, mode="same")
    sfx *= 1 - 0.5 * np.clip(envv / 0.04, 0, 1)            # duck under the voice
    mix = voice + sfx
    mix = mix / max(1.0, np.max(np.abs(mix)) / 0.97)
    with wave.open(os.path.join(B, "mix.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"mix -> build/mix.wav ({n / SR:.3f}s, same length as the voiceover)")


if __name__ == "__main__":
    main()
