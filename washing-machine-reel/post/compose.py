"""Overlay captions on rendered frames and encode final MP4 with the mastered mix.
usage: compose.py [--preview f1,f2,...]"""
import sys, json, math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FPS = 30
TOTAL = 1658
FRAMES = "/opt/work/render/frames"
FONT = "/usr/share/fonts/opentype/montserrat/Montserrat-ExtraBold.otf"
BASE_SIZE = 70
STROKE = 7
CY = 1110  # caption centre y (just below middle)

GROUPS = """You shit your|pants,|but you're a|genius,|so you rinse|your underwear|in water.|But all this|does is make|it wet and|smelly,|so you add|detergent|and scrub it|by hand.|That works,|but washing|all your clothes|yourself|will take forever,|so you bring|in 100|people|to do it|for you.|But they want|to be paid,|so you get|rid of them|and instead|put everything|inside a metal|drum|and turn it.|Clever!|But your arm|is still tired|from earlier|activities,|so you add|a motor.|Now the drum|turns itself,|occasionally|changing direction|so the clothes|don't get tangled.|But now they're|marinating|in their own|dirty water,|so you put|holes in the|drum and a|tub around it|to catch the|water,|then pump|it away.|Clean water|comes in to|rinse out|the soap.|Your underwear|is finally clean,|but it's still|dripping,|so you spin|the drum faster|to throw the|water out|through the holes.|Congratulations!|You've invented|the washing|machine!""".split("|")
BOUNCE = {"Clever!", "Congratulations!", "You've invented", "the washing", "machine!"}

words = json.load(open("/opt/work/audio/transcript.json"))["words"]


def norm(w):
    return w.lower().strip(".,!?")


chunks = []
wi = 0
for g in GROUPS:
    toks = g.split()
    ws = words[wi:wi + len(toks)]
    assert [norm(w["word"]) for w in ws] == [norm(t) for t in toks], (g, [w["word"] for w in ws])
    chunks.append(dict(text=g, start=ws[0]["start"], end=ws[-1]["end"], bounce=g in BOUNCE))
    wi += len(toks)
assert wi == len(words), (wi, len(words))


def fr(t):
    return int(round(t * FPS)) + 1


for i, c in enumerate(chunks):
    c["f0"] = max(1, fr(c["start"] - 0.03))
    if i + 1 < len(chunks):
        nxt = chunks[i + 1]["start"]
        c["f1"] = fr(nxt - 0.03) if nxt - c["end"] < 0.6 else fr(c["end"] + 0.3)
    else:
        c["f1"] = TOTAL + 1
json.dump(chunks, open("/opt/work/post/chunks.json", "w"), indent=1)

_cache = {}


def text_layer(txt, scale):
    key = (txt, round(scale, 3))
    if key in _cache:
        return _cache[key]
    size = max(8, int(BASE_SIZE * scale))
    sw = max(1, int(round(STROKE * scale)))
    font = ImageFont.truetype(FONT, size)
    tmp = ImageDraw.Draw(Image.new("L", (10, 10)))
    bb = tmp.textbbox((0, 0), txt, font=font, stroke_width=sw)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad = 30
    lw, lh = tw + 2 * pad, th + 2 * pad
    ox, oy = pad - bb[0], pad - bb[1]
    # soft shadow
    sh = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(sh).text((ox, oy + int(6 * scale)), txt, font=font, fill=255, stroke_width=sw, stroke_fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(8 * scale))
    layer = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    shadow_rgba = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    shadow_rgba.putalpha(sh.point(lambda v: int(v * 0.6)))
    layer = Image.alpha_composite(layer, shadow_rgba)
    d = ImageDraw.Draw(layer)
    d.text((ox, oy), txt, font=font, fill=(255, 255, 255, 255), stroke_width=sw, stroke_fill=(0, 0, 0, 255))
    _cache[key] = layer
    return layer


def bounce_scale(k):
    """k frames since start -> scale (ease-out-back from 0.3)."""
    T = 8.0
    x = min(1.0, k / T)
    c1, c3 = 1.9, 2.9
    e = 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
    return 0.3 + 0.7 * e


def caption_for(f):
    for c in chunks:
        if c["f0"] <= f < c["f1"]:
            return c
    return None


_vig = None


def vignette_mask(w, h, strength=0.2):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    return (1.0 - strength * np.clip(r, 0, 1) ** 2.4)[..., None]


def compose_frame(f):
    global _vig
    base = Image.open(os.path.join(FRAMES, f"{f:04d}.png")).convert("RGB")
    if _vig is None or _vig.shape[0] != base.height:
        _vig = vignette_mask(base.width, base.height)
    arr = (np.asarray(base, dtype=np.float32) * _vig).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(arr).convert("RGBA")
    c = caption_for(f)
    if c:
        s = bounce_scale(f - c["f0"]) if c["bounce"] else 1.0
        L = text_layer(c["text"], s)
        x = (W - L.width) // 2
        y = CY - L.height // 2
        img.alpha_composite(L, (x, y))
    return img.convert("RGB")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        for f in map(int, sys.argv[2].split(",")):
            compose_frame(f).save(f"/opt/work/post/cap_{f:04d}.jpg", quality=90)
        print("preview ok")
        sys.exit(0)
    out = sys.argv[1] if len(sys.argv) > 1 else "/opt/work/post/final.mp4"
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", "/opt/work/post/mix.wav",
           "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-profile:v", "high",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-shortest", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(1, TOTAL + 1):
        p.stdin.write(compose_frame(f).tobytes())
        if f % 200 == 0:
            print("composed", f, flush=True)
    p.stdin.close()
    p.wait()
    print("ENCODED", out, p.returncode)
