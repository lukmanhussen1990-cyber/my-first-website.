#!/usr/bin/env python3
"""Mix voice clips + quiet SFX into build/mix.wav following build/timeline.json.

Voice clips are cut from each line's audio file exactly as the timeline says
(phrases, optional atempo), levelled per line, and the code-made SFX sit well
underneath. The result is loudness-normalised for social media (~ -15 LUFS).
"""
import json, os, subprocess, wave
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")


def decode(path, atempo=1.0):
    af = ["-af", f"atempo={atempo}"] if abs(atempo - 1) > 1e-6 else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def read_wav(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    return x


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def fade(x, ms=6):
    n = min(len(x) // 2, int(SR * ms / 1000))
    if n > 0:
        x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    return x


def main():
    tl = json.load(open(os.path.join(B, "timeline.json")))
    total = int(round(tl["duration"] * SR)) + SR
    voice = np.zeros(total)
    at = tl.get("atempo", 1.0)
    for ln in tl["lines"]:
        if not ln.get("file"):
            continue
        src = decode(os.path.join(HERE, ln["file"]), at)
        # speech level per line: aim every line at the same RMS so no voice jumps out
        line_gain = 10 ** ((-19.0 - rms_db(src[np.abs(src) > 0.01] if np.any(np.abs(src) > 0.01) else src)) / 20)
        for cl in ln["clips"]:
            a = int(round(cl["src_s"] / at * SR)); b = int(round(cl["src_e"] / at * SR))
            seg = fade(src[a:b].copy()) * line_gain
            p = int(round(cl["at"] * SR))
            if p < 0:
                seg = seg[-p:]; p = 0
            voice[p:p + len(seg)] += seg[: max(0, total - p)]
    sfx = np.zeros(total)
    for ev in tl["sfx"]:
        x = read_wav(os.path.join(B, "sfx", ev["name"] + ".wav")) * 10 ** (ev["gain_db"] / 20)
        p = int(round(ev["t"] * SR))
        sfx[p:p + len(x)] += x[: max(0, total - p)]
    # duck the SFX a little more wherever someone is talking
    env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode="same")
    duck = 1 - 0.5 * np.clip(env / 0.05, 0, 1)
    mix = voice + sfx * duck
    mix = mix[: int(round(tl["duration"] * SR))]
    # final fade-out with the picture
    nf = int(1.2 * SR)
    mix[-nf:] *= np.linspace(1, 0, nf) ** 1.5
    peak = np.max(np.abs(mix)) or 1
    if peak > 0.98:
        mix = mix / peak * 0.98
    tmp = os.path.join(B, "mix_raw.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    out = os.path.join(B, "mix.wav")
    if np.max(np.abs(voice)) > 0:
        # two-pass loudness normalisation to ~ -15 LUFS / -1.5 dBTP
        meas = subprocess.run(["ffmpeg", "-v", "info", "-i", tmp, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                              capture_output=True, text=True).stderr
        js = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
        lf = (f"loudnorm=I=-15:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
              f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", lf, "-ar", str(SR), "-ac", "2", out], check=True)
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ac", "2", out], check=True)
    print(f"mix -> {out}  ({len(mix) / SR:.2f}s, voice lines: {sum(1 for l in tl['lines'] if l.get('file'))})")


if __name__ == "__main__":
    main()
