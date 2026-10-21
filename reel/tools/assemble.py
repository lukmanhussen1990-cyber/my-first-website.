#!/usr/bin/env python3
"""Mix voice + sound effects, build word-by-word subtitles, and export the final MP4.

Does NOT re-render the 3D: it uses render/frames/*.png if they are all there,
otherwise the clean (no subtitles, no audio) video output/scene_clean.mp4.

  python3 tools/assemble.py            -> output/shopping_cart_race_car.mp4
"""
import json, subprocess, sys, shutil
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
W, H = 1080, 1920
cfg = json.loads((ROOT / "script.json").read_text())
FPS = cfg["fps"]; DUR = cfg["duration"]
NFR = int(round(DUR * FPS))
OUT = ROOT / "output"; OUT.mkdir(exist_ok=True)
AUD = ROOT / "audio"
FONT = ROOT / "fonts/Fredoka-Bold.ttf"

def run(cmd):
    print("+", " ".join(str(c) for c in cmd)[:240])
    subprocess.run([str(c) for c in cmd], check=True)

def load_mono(path):
    x, sr = sf.read(str(path), dtype="float64")
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = resample_poly(x, SR, sr)
    return x

# ------------------------------------------------------------------ 1. place the voice
tim = json.loads((ROOT / "voice/timings.json").read_text())
lines = {l["id"]: l for l in tim["lines"]}
N = int(SR * DUR)
voice = np.zeros(N)
words_abs = []
placed = []
for li, line in enumerate(cfg["lines"]):
    T = lines[line["id"]]
    audio = load_mono(ROOT / T["file"])
    ws = T["words"]
    parts = line["parts"]
    prev_end = -1.0
    for pi, part in enumerate(parts):
        w0 = part["from_word"]; w1 = parts[pi + 1]["from_word"] if pi + 1 < len(parts) else len(ws)
        # cut points: middle of the pause around the part (keep a little air)
        a = 0.0 if w0 == 0 else max(ws[w0 - 1]["end"], ws[w0]["start"] - 0.06)
        b = len(audio) / SR if w1 >= len(ws) else min(ws[w1]["start"] - 0.02, ws[w1 - 1]["end"] + 0.12)
        seg = audio[int(a * SR):int(b * SR)].copy()
        f = int(0.008 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        lead = ws[w0]["start"] - a          # silence before the first word in this segment
        start = part["at"] - lead
        if prev_end > 0:
            start = max(start, prev_end + 0.18)   # never overlap the previous part of the same line
        i = int(start * SR)
        n = min(len(seg), N - i)
        voice[i:i + n] += seg[:n]
        prev_end = start + len(seg) / SR
        for w in ws[w0:w1]:
            words_abs.append({"text": w["text"], "start": round(start + w["start"] - a, 3), "end": round(start + w["end"] - a, 3), "line": line["id"]})
    placed.append((line["id"], words_abs[-1]["end"]))
# sanity: lines must not run into the next line
starts = {l["id"]: l["parts"][0]["at"] for l in cfg["lines"]}
for lid, end in placed:
    nxt = starts.get(lid + 1)
    if nxt is not None and end > nxt - 0.1:
        print(f"WARNING: line {lid} ends at {end:.2f}s, close to line {lid + 1} at {nxt:.2f}s")
    print(f"line {lid}: ends {end:.2f}s")
(AUD / "words.json").write_text(json.dumps(words_abs, indent=1))

# ------------------------------------------------------------------ 2. mix with ducking + loudness
sfx_path = AUD / "sfx.flac" if (AUD / "sfx.flac").exists() else AUD / "sfx.wav"
sfx, sr = sf.read(str(sfx_path), dtype="float64")
if sr != SR: sfx = resample_poly(sfx, SR, sr, axis=0)
sfx = sfx[:N] if len(sfx) >= N else np.pad(sfx, ((0, N - len(sfx)), (0, 0)))
voice = voice / (np.abs(voice).max() + 1e-9) * 0.7
env = sosfilt(butter(2, 12, fs=SR, output="sos"), np.abs(voice))
env = np.clip(env / 0.04, 0, 1)
# attack/release smoothing
duck = np.zeros_like(env); g = 0.0; att = np.exp(-1 / (0.03 * SR)); rel = np.exp(-1 / (0.35 * SR))
for i in range(0, N, 48):           # 1 ms steps
    target = env[i]; c = att if target > g else rel
    g = target + (g - target) * c ** 48; duck[i:i + 48] = g
gain = 1 - 0.5 * duck
mix = sfx * 1.25 * gain[:, None] + voice[:, None] * 1.0
pre = AUD / "mix_pre.wav"
sf.write(str(pre), mix.astype(np.float32), SR, subtype="FLOAT")
# two-pass loudnorm (Instagram-friendly ~ -14 LUFS, -1 dBTP)
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(pre), "-af", "alimiter=limit=0.89:attack=2:release=60,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
js = r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1]
m = json.loads(js)
af = (f"alimiter=limit=0.89:attack=2:release=60,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
      f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", pre, "-af", af, "-ar", "48000", "-c:a", "pcm_s16le", AUD / "mix.wav"])
pre.unlink()

# ------------------------------------------------------------------ 3. subtitles (ASS), word by word with a pop
from PIL import ImageFont
BASE = 118; MAXW = 800
pil = ImageFont.truetype(str(FONT), BASE)
def ts(t):
    t = max(0, t); h = int(t // 3600); mnt = int(t % 3600 // 60); s = t % 60
    return f"{h}:{mnt:02d}:{s:05.2f}"
X, Y = 512, int(H * 0.40)
ass = [
    "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    f"Style: Word,Fredoka,{BASE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,9,0,5,0,0,0,1",
    "Style: Shadow,Fredoka,118,&H90000000,&H90000000,&H90000000,&H00000000,-1,0,0,0,100,100,1,0,1,9,0,5,0,0,0,1",
    "Style: Mark,Fredoka,46,&H40FFFFFF,&H40FFFFFF,&H90000000,&HA0000000,-1,0,0,0,100,100,1,0,1,2.5,1.5,7,0,0,0,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
]
for i, w in enumerate(words_abs):
    nxt = words_abs[i + 1]["start"] if i + 1 < len(words_abs) else DUR
    end = min(nxt, w["end"] + 0.55)
    if end - w["start"] < 0.08: end = w["start"] + 0.08
    width = pil.getlength(w["text"])
    fs = BASE if width <= MAXW else int(BASE * MAXW / width)
    pop = r"\fscx72\fscy72\t(0,80,\fscx113\fscy113)\t(80,170,\fscx100\fscy100)"
    text = w["text"].replace("{", "(").replace("}", ")")
    ass.append(f"Dialogue: 0,{ts(w['start'])},{ts(end)},Shadow,,0,0,0,,{{\\pos({X + 5},{Y + 9})\\fs{fs}\\blur9{pop}}}{text}")
    ass.append(f"Dialogue: 1,{ts(w['start'])},{ts(end)},Word,,0,0,0,,{{\\pos({X},{Y})\\fs{fs}{pop}}}{text}")
ass.append(f"Dialogue: 2,{ts(0)},{ts(DUR)},Mark,,0,0,0,,{{\\pos(56,205)}}garden_reels")
(OUT / "subtitles.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ 4. video
frames = sorted((ROOT / "render/frames").glob("f_*.png")) if (ROOT / "render/frames").exists() else []
clean = OUT / "scene_clean.mp4"
if len(frames) >= NFR and (not clean.exists() or clean.stat().st_mtime < max(f.stat().st_mtime for f in frames)):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", FPS, "-i", ROOT / "render/frames/f_%05d.png",
         "-frames:v", NFR, "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-tune", "animation", "-movflags", "+faststart", clean])
if not clean.exists():
    sys.exit("No rendered frames and no output/scene_clean.mp4 - render the 3D first (node tools/render.mjs frames).")
final = OUT / "shopping_cart_race_car.mp4"
vf = f"ass={OUT / 'subtitles.ass'}:fontsdir={ROOT / 'fonts'}"
run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", clean, "-i", AUD / "mix.wav", "-map", "0:v", "-map", "1:a",
     "-vf", vf, "-r", FPS, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", final])
print("done:", final)
