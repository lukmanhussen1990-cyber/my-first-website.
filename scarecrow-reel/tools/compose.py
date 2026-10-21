#!/usr/bin/env python3
"""Final export: voices + music + sound effects + burned-in subtitles -> MP4.

Does NOT re-render the 3D. It takes the clean rendered video
(build/video_clean.mp4, or out/master_no_subs.mp4 when the build folder is
gone), the voice files in voices/ and the synthesized stems, and writes
out/scarecrow_reel.mp4 (H.264 + AAC, 1080x1920, 30 fps).

Subtitle timing always comes from the current voice files' word timestamps,
so new voices automatically get new subtitle timing.
"""
import argparse
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BUILD, OUT, VOICES = ROOT / "build", ROOT / "out", ROOT / "voices"
SR, FPS, W, H = 48000, 30, 1080, 1920
FONT = ROOT / "assets" / "fonts" / "Fredoka-Bold.ttf"

# subtitle layout: centred a little above the middle, clear of the bottom 20% and the right-hand buttons
SUB_CX, SUB_CY = 505, 815
SUB_MAX_W = 840
STYLE = {
    "narrator": {"size": 116, "fill": (255, 255, 255), "stroke": 11},
    "kid": {"size": 136, "fill": (255, 216, 58), "stroke": 12},
}


# ------------------------------------------------------------------ audio io
def read_wav(path):
    with wave.open(str(path)) as w:
        n, ch, sr, sw = w.getnframes(), w.getnchannels(), w.getframerate(), w.getsampwidth()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768
    x = x.reshape(-1, ch).T
    if sr != SR:
        from scipy.signal import resample_poly
        g = math.gcd(sr, SR); x = np.stack([resample_poly(c, SR // g, sr // g) for c in x])
    return x


def write_wav(path, st):
    st = np.clip(st, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st.T * 32767).astype("<i2").tobytes())


def tempo(path, factor):
    """Speed up a voice file with ffmpeg atempo (pitch preserved)."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-filter:a", f"atempo={factor:.4f}", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32)[None, :]


def envelope(x, attack=0.03, release=0.35):
    a = np.abs(x).astype(np.float64)
    from scipy.signal import lfilter
    hop = 240; frames = a[: len(a) // hop * hop].reshape(-1, hop).max(axis=1)
    out = np.zeros_like(frames); ga, gr = math.exp(-hop / (attack * SR)), math.exp(-hop / (release * SR)); v = 0
    for i, f in enumerate(frames):
        v = ga * v + (1 - ga) * f if f > v else gr * v + (1 - gr) * f; out[i] = v
    e = np.repeat(out, hop); return np.pad(e, (0, len(x) - len(e)))


# ------------------------------------------------------------------ voices + timing
def place_voices(script, dur_s):
    n = int(dur_s * SR); track = np.zeros(n, dtype=np.float32); words = []
    for line in script["lines"]:
        name = f"{line['id']}_{line['speaker']}"
        wav, meta = VOICES / f"{name}.wav", json.loads((VOICES / f"{name}.words.json").read_text())
        x = read_wav(wav).mean(axis=0)[None, :]
        slot = line["end_by"] - line["start"]; dur = x.shape[1] / SR; factor = 1.0
        if dur > slot:
            factor = min(1.25, dur / slot)
            x = tempo(wav, factor)
            if dur / factor > slot: print(f"  ! {line['id']} still {dur / factor - slot:.2f}s longer than its slot; it will overlap a little")
        i = int(line["start"] * SR); m = min(x.shape[1], n - i)
        track[i:i + m] += x[0, :m]
        for k, w in enumerate(meta["words"]):
            words.append({"text": w["text"], "t0": line["start"] + w["start"] / factor, "t1": line["start"] + w["end"] / factor,
                          "speaker": line["speaker"], "line": line["id"], "last": k == len(meta["words"]) - 1})
        print(f"  {line['id']}: {dur:.2f}s at {line['start']:.2f}s" + (f" (sped up x{factor:.2f})" if factor > 1 else ""))
    return track, words


def mix(script, cues, dur_s):
    print("mixing audio ...")
    voice, words = place_voices(script, dur_s)
    n = len(voice)
    stem = lambda k: (lambda x: np.pad(x, ((0, 0), (0, max(0, n - x.shape[1]))))[:, :n])(read_wav(BUILD / f"{k}.wav"))
    music, dance, sfx, amb = stem("music"), stem("dance"), stem("sfx"), stem("amb")
    venv = envelope(voice); venv = venv / (venv.max() + 1e-9)
    duck = 1 - 0.55 * np.clip(venv * 2.5, 0, 1)
    vpk = np.max(np.abs(voice)) + 1e-9; voice = voice / vpk * 0.9
    db = lambda d: 10 ** (d / 20)
    out = np.stack([voice, voice]) * db(-1)
    out += music * db(-15.5) * duck
    out += dance * db(-3.0) * (1 - 0.55 * np.clip(venv * 2.5, 0, 1))
    out += sfx * db(-5.5) * (1 - 0.3 * np.clip(venv * 2.5, 0, 1))
    out += amb * db(-12)
    fade = int(0.6 * SR); out[:, -fade:] *= np.linspace(1, 0, fade)
    out[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    out = np.tanh(out * 1.1) / np.tanh(1.1)  # gentle limiter
    BUILD.mkdir(exist_ok=True); write_wav(BUILD / "mix.wav", out * 0.95)
    return words


# ------------------------------------------------------------------ subtitles
def word_sprite(text, style, max_w=SUB_MAX_W):
    size = style["size"]
    while True:
        font = ImageFont.truetype(str(FONT), size)
        bbox = font.getbbox(text, stroke_width=style["stroke"])
        if bbox[2] - bbox[0] <= max_w or size < 60: break
        size -= 4
    sw = style["stroke"]; pad = 40
    w, h = bbox[2] - bbox[0] + pad * 2, bbox[3] - bbox[1] + pad * 2
    ox, oy = pad - bbox[0], pad - bbox[1]
    shadow = Image.new("L", (w, h), 0); ImageDraw.Draw(shadow).text((ox, oy + 7), text, font=font, fill=255, stroke_width=sw + 3, stroke_fill=255)
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    img.paste((0, 0, 0, 0), (0, 0, w, h))
    sh_rgba = Image.new("RGBA", (w, h), (10, 6, 16, 0)); sh_rgba.putalpha(shadow.point(lambda v: int(v * 0.62)))
    img = Image.alpha_composite(img, sh_rgba)
    txt = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(txt).text((ox, oy), text, font=font, fill=style["fill"] + (255,), stroke_width=sw, stroke_fill=(12, 10, 16, 255))
    img = Image.alpha_composite(img, txt)
    # baseline-centred anchor: centre of the cap height
    cap = font.getbbox("H")
    anchor = (ox + (bbox[0] + bbox[2]) / 2 - bbox[0], oy + (cap[1] + cap[3]) / 2)
    return img, anchor


def bounce(age):
    """Pop-in scale: quick overshoot then settle (tiny bounce)."""
    if age <= 0: return 0.0
    x = age / 0.22
    if x >= 1.6: return 1.0
    return max(0.0, 1 - math.exp(-6 * x) * math.cos(x * 8.5) * 0.45 - 0.55 * math.exp(-14 * x))


def schedule(words):
    """Each word shows from its start until the next word starts (or a short hold)."""
    out = []
    for k, w in enumerate(words):
        nxt = words[k + 1] if k + 1 < len(words) else None
        same = nxt is not None and nxt["line"] == w["line"]
        end = nxt["t0"] if same else w["t1"] + 0.45
        out.append({**w, "show": w["t0"] - 0.02, "hide": max(end, w["t0"] + 0.14)})
    return out


def compose_video(words, src, dst, crf):
    print("compositing subtitles + encoding ...")
    sched = schedule(words)
    sprites = [word_sprite(w["text"], STYLE[w["speaker"]]) for w in sched]
    probe = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", str(src)], capture_output=True, text=True)
    nframes = int(probe.stdout.strip())
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", str(BUILD / "mix.wav"),
                            "-filter:a", "loudnorm=I=-14:TP=-1.5:LRA=11",
                            "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
                            "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", str(dst)], stdin=subprocess.PIPE)
    fsize = W * H * 3
    for f in range(nframes):
        buf = dec.stdout.read(fsize)
        if len(buf) < fsize: break
        t = f / FPS
        active = [k for k, w in enumerate(sched) if w["show"] <= t < w["hide"]]
        if active:
            frame = Image.frombuffer("RGB", (W, H), buf, "raw", "RGB", 0, 1).convert("RGBA")
            k = active[-1]; img, (ax, ay) = sprites[k]; s = bounce(t - sched[k]["show"])
            if s > 0.01:
                sw, sh = max(1, int(img.width * s)), max(1, int(img.height * s))
                im = img.resize((sw, sh), Image.BICUBIC)
                x = int(round(SUB_CX - ax * s)); y = int(round(SUB_CY - ay * s))
                frame.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
            buf = frame.convert("RGB").tobytes()
        enc.stdin.write(buf)
        if f % 150 == 0: print(f"  frame {f}/{nframes}")
    enc.stdin.close(); enc.wait(); dec.wait()
    print("wrote", dst)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", help="clean rendered video (default: build/video_clean.mp4 or out/master_no_subs.mp4)")
    ap.add_argument("--out", default=str(OUT / "scarecrow_reel.mp4"))
    ap.add_argument("--crf", type=int, default=18)
    args = ap.parse_args()
    script = json.loads((ROOT / "script" / "voiceover.json").read_text())
    cues = json.loads((ROOT / "audio" / "cues.json").read_text())
    if not all((BUILD / f"{k}.wav").exists() for k in ("music", "dance", "sfx", "amb")):
        subprocess.run([sys.executable, str(ROOT / "audio" / "synth.py")], check=True)
    src = Path(args.video) if args.video else next((p for p in (BUILD / "video_clean.mp4", OUT / "master_no_subs.mp4") if p.exists()), None)
    if src is None: sys.exit("No rendered video found. Run the 3D render first (see README).")
    words = mix(script, cues, cues["duration"])
    (BUILD / "subtitles.json").write_text(json.dumps(schedule(words), indent=1))
    OUT.mkdir(exist_ok=True)
    compose_video(words, src, Path(args.out), args.crf)


if __name__ == "__main__":
    main()
