"""Captions + encode for the elevator episode. usage:
  compose_elev.py quick out.mp4            (15 fps preview from /opt/work/elev/quick, optional audio)
  compose_elev.py final out.mp4 audio.wav  (30 fps full-res from /opt/work/elev/frames)"""
import sys, os, re, json, subprocess
sys.path.insert(0, "/opt/work/post")
import numpy as np
from PIL import Image
import compose as C  # reuse text_layer / bounce_scale / vignette

_wvo = "/opt/work/elev/words_vo.json"                       # captions = what is actually spoken (once the VO exists)
words = json.load(open(_wvo if os.path.exists(_wvo) else "/opt/work/elev/words.json"))["words"]
shots = json.load(open("/opt/work/elev/shots.json"))
TOTAL = max(v[1] for v in shots.values()) - 1
FPS = 30


def chunk(words):
    out, cur = [], []
    for w in words:
        if cur:
            prev = cur[-1]
            gap = w["start"] - prev["end"]
            nchar = sum(len(x["word"]) for x in cur) + len(w["word"])
            if len(cur) >= 3 or re.search(r"[,.!?]$", prev["word"]) or gap > 0.25 or (len(cur) == 2 and nchar > 15):
                out.append(cur); cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


groups = chunk(words)
chunks = []
last_line_start = None
for i, g in enumerate(groups):
    txt = " ".join(x["word"] for x in g)
    chunks.append(dict(text=txt, start=g[0]["start"], end=g[-1]["end"]))
# bounce: "Clever!" and the final line (from "Congratulations!" on)
final_idx = max(i for i, c in enumerate(chunks) if c["text"].lower().startswith("congratulations")) if any(
    c["text"].lower().startswith("congratulations") for c in chunks) else len(chunks) - 3
for i, c in enumerate(chunks):
    c["bounce"] = c["text"].strip(".,!").lower() == "clever" or i >= final_idx


def fr(t):
    return int(round(t * FPS)) + 1


for i, c in enumerate(chunks):
    c["f0"] = max(1, fr(c["start"] - 0.03))
    if i + 1 < len(chunks):
        nxt = chunks[i + 1]["start"]
        c["f1"] = fr(nxt - 0.03) if nxt - c["end"] < 0.6 else fr(c["end"] + 0.3)
    else:
        c["f1"] = TOTAL + 1
json.dump(chunks, open("/opt/work/elev/chunks.json", "w"), indent=1)


def cap_for(f):
    for c in chunks:
        if c["f0"] <= f < c["f1"]:
            return c
    return None


def overlay(img_rgba, f, scale):
    c = cap_for(f)
    if c:
        s = C.bounce_scale(f - c["f0"]) if c["bounce"] else 1.0
        L = C.text_layer(c["text"], s * scale)
        W, H = img_rgba.size
        img_rgba.alpha_composite(L, ((W - L.width) // 2, int(C.CY * scale) - L.height // 2))
    return img_rgba


_X = np.arange(256, dtype=np.float32) / 255.0
_S = _X + 0.16 * (_X * _X * (3 - 2 * _X) - _X)                      # gentle S-curve contrast
_LUT = [np.clip((_S * g) * 255.0, 0, 255).astype(np.float32) for g in (1.025, 1.0, 0.965)]   # slight warm grade


def grade(arr):
    """arr float32 HxWx3 0..255 -> graded (contrast S-curve, warm balance, +14% saturation)."""
    a8 = arr.clip(0, 255).astype(np.uint8)
    out = np.stack([_LUT[c][a8[..., c]] for c in range(3)], axis=-1)
    lum = (out @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[..., None]
    return lum + (out - lum) * 1.14


mode, out = sys.argv[1], sys.argv[2]
audio = sys.argv[3] if len(sys.argv) > 3 else None
if mode == "quick":
    W, H, fps, step, src = 540, 960, 15, 2, "/opt/work/elev/quick"
elif mode == "quick30":
    W, H, fps, step, src = 540, 960, 30, 1, os.environ.get("SRC", "/opt/work/elev/quick")
else:
    W, H, fps, step, src = 1080, 1920, 30, 1, "/opt/work/elev/frames"
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-"]
if audio:
    cmd += ["-i", audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k" if not mode.startswith("quick") else "96k", "-shortest"]
cmd += ["-c:v", "libx264", "-preset", os.environ.get("PRESET") or ("veryfast" if mode.startswith("quick") else "slow"), "-crf", "28" if mode.startswith("quick") else "16",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
vig = None
last = None
for f in range(1, int(os.environ.get("END", TOTAL)) + 1, step):
    path = os.path.join(src, f"{f:04d}.jpg" if mode.startswith("quick") else f"{f:04d}.png")
    if os.path.exists(path):
        im = Image.open(path).convert("RGB")
        if im.size != (W, H):
            im = im.resize((W, H), Image.BILINEAR)
        if vig is None:
            vig = C.vignette_mask(W, H)
        arr = grade(np.asarray(im, dtype=np.float32) * vig).clip(0, 255).astype(np.uint8)
        last = Image.fromarray(arr)
    img = last.convert("RGBA")
    overlay(img, f, W / 1080)
    p.stdin.write(img.convert("RGB").tobytes())
p.stdin.close(); p.wait()
print("ENCODED", out, p.returncode, "chunks", len(chunks))
