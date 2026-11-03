#!/usr/bin/env python3
"""Mix: voice lines (from the provided voiceover) + quiet code-made SFX + quiet lo-fi
music (ducked under the voice, cut by the record scratch) -> build/mix.wav (~ -15 LUFS)."""
import json, os, subprocess, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")


def read(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
        if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(1)
    return x


def db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def main():
    tl = json.load(open(os.path.join(B, "timeline.json")))
    n = int(round(tl["duration"] * SR))
    voice, sfx = np.zeros(n + SR), np.zeros(n + SR)
    for ln in tl["lines"]:
        x = read(os.path.join(HERE, ln["file"])); p = int(round(ln["at"] * SR))
        voice[p:p + len(x)] += x
    speech = voice[np.abs(voice) > 0.01]
    voice *= 10 ** ((-18.0 - db(speech)) / 20)            # one gain for the whole read (keeps its dynamics)
    for ev in tl["sfx"]:
        x = read(os.path.join(B, "sfx", ev["name"] + ".wav")) * 10 ** (ev["gain_db"] / 20)
        if ev.get("dur"):
            m = int(ev["dur"] * SR)
            if len(x) > m:
                x = x[:m].copy(); f = min(m, int(0.12 * SR)); x[-f:] *= np.linspace(1, 0, f)
        p = int(round(ev["t"] * SR)); sfx[p:p + len(x)] += x[: max(0, len(sfx) - p)]
    music = read(os.path.join(B, "music.wav"))[: n + SR]
    music = np.pad(music, (0, max(0, n + SR - len(music))))
    gate = np.zeros(n + SR)
    for seg in tl["music"]:
        a, b = int(seg["from"] * SR), int(seg["to"] * SR)
        gate[a:b] = 1
        fi = int(0.35 * SR)
        if seg["from"] > 0: gate[a:a + fi] = np.linspace(0, 1, fi)
    sm = int(0.008 * SR); gate = np.convolve(gate, np.ones(sm) / sm, mode="same")
    envv = np.convolve(np.abs(voice), np.ones(4800) / 4800, mode="same")
    duck = 1 - 0.55 * np.clip(envv / 0.04, 0, 1)
    music = music * gate * duck * 10 ** (-19 / 20)
    sfx = sfx * (1 - 0.4 * np.clip(envv / 0.04, 0, 1))
    mix = (voice + sfx + music)[:n]
    nf = int(1.2 * SR); mix[-nf:] *= np.linspace(1, 0, nf) ** 1.5
    tmp = os.path.join(B, "mix_raw.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix / max(1, np.max(np.abs(mix)) / 0.98), -1, 1) * 32767).astype("<i2").tobytes())
    meas = subprocess.run(["ffmpeg", "-v", "info", "-i", tmp, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    js = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
    lf = (f"loudnorm=I=-15:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", lf, "-ar", str(SR), "-ac", "2", os.path.join(B, "mix.wav")], check=True)
    print(f"mix -> build/mix.wav ({n / SR:.2f}s)  music {db(music[music != 0]):.1f} dB  voice {db(voice[np.abs(voice) > 0.01]):.1f} dB")


if __name__ == "__main__":
    main()
