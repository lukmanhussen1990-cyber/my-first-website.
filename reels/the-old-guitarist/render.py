"""Render 'The Old Guitarist' Instagram Reel (1080x1920, 30 fps).

Usage: python3 render.py [preview|full]
  preview -> writes a contact sheet of key frames only
  full    -> renders audio mixes and both MP4s
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = "/tmp/claude-0/-home-user-my-first-website-/c1530225-b9ea-55ac-b6c2-fcec14e79978/scratchpad"
W, H, FPS = 1080, 1920, 30
PAINTING = "/root/.claude/uploads/c1530225-b9ea-55ac-b6c2-fcec14e79978/bfdd92ce-image.jpg"
VOICE = f"{S}/vo/take3.mp3"
MUSIC = f"{S}/ref/ref.wav"
OUT = f"{S}/out"
FONT_B = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
FONT_XB = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FONT_SB = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FONT_M = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"

WHITE = (255, 255, 255)
AMBER = (217, 163, 90)          # muted amber, close to the guitar's tone
FOLLOW_YELLOW = (237, 184, 74)
SR = 48000

# ---------------------------------------------------------------- voice edit
# Pauses trimmed from the narration take (seconds, take time). Both sit inside
# silence: the long beat after the hook and the long pause before the last line.
CUTS = [(2.50, 3.40), (39.30, 40.30)]
# Take 3 says "her child" too softly; take 1's reading of that sentence is clear
# and the same length, so it is dropped in between the surrounding silences.
SPLICE = (f"{S}/vo/take1.mp3", 31.50, 31.00, 2.60)   # source, src start, take-3 start, length


def to_new(t):
    """Map a time in the original take to the edited timeline."""
    shift = 0.0
    for a, b in CUTS:
        if t >= b:
            shift += b - a
        elif t > a:
            shift += t - a
    return t - shift


# Cue starts are the first aligned word of each sentence in take 3.
CUES_TAKE = [
    ("hook", 0.08, [[("This old man", WHITE)], [("is hiding something.", WHITE)]]),
    ("c2a", 3.92, [[("Barcelona, 1903.", WHITE)]]),
    ("c2b", 6.64, [[("Picasso is twenty-two,", WHITE)], [("and he has known poverty.", WHITE)]]),
    ("c3", 11.12, [[("In 1901,", WHITE)], [("his close friend died.", WHITE)]]),
    ("c4", 14.24, [[("Then Picasso’s world", WHITE)], [("turned blue.", WHITE)]]),
    ("c5", 17.12, [[("He painted people", WHITE)], [("the world ignored.", WHITE)]]),
    ("c6", 19.92, [[("Like this blind", WHITE)], [("street musician.", WHITE)]]),
    ("c7", 22.88, [[("The guitar is", WHITE)], [("the only warm color.", WHITE)]]),
    ("c8", 25.60, [[("Some see it as", WHITE)], [("a sign of hope.", WHITE)]]),
    ("c9", 28.48, [[("But X-rays found", WHITE)], [("another painting", WHITE)], [("underneath.", WHITE)]]),
    ("c10", 31.36, [[("A mother…", WHITE)], [("and her child.", WHITE)]]),
    ("c11", 34.08, [[("He covered them", WHITE)], [("with this lonely old man.", WHITE)]]),
    ("c12", 37.44, [[("No one knows why.", WHITE)]]),
    ("final", 40.92, [[("Under all that blue…", WHITE)], [("love", AMBER), (" was there first.", WHITE)]]),
]
VOICE_END_TAKE = 44.32
CUES = [(k, to_new(t), lines) for k, t, lines in CUES_TAKE]
VOICE_END = to_new(VOICE_END_TAKE)
LEAD = 0.10                                   # cut / caption slightly ahead of the voice
T_END_CARD = round(VOICE_END + 1.0, 2)        # hold the last line ~1 s after the voice
END_CARD_LEN = 3.6
XFADE = 0.35
TOTAL = round(T_END_CARD + END_CARD_LEN, 2)

cue_t = {k: t for k, t, _ in CUES}


def cut_at(key):
    return round(cue_t[key] - LEAD, 3)


# ---------------------------------------------------------------- camera plan
# Window = (cx, cy, w) in painting pixels (painting is 1079 x 1565).
# 'full' fills the 9:16 frame; 'box' shows the painting under a black band.
PW, PH = 1079, 1565
FULL = (PW / 2, PH / 2, 880)
BAND_H = 420
BOX_W, BOX_H = 1034, 1500
BOX_X, BOX_Y = (W - BOX_W) // 2, H - BOX_H

SHOTS = [
    # mode, start, end, keyframes [(fraction, (cx, cy, w)), ...]
    ("box", 0.0, cut_at("c2a"), [(0, (PW / 2, PH / 2, PW)), (1, (470, 680, 930))]),
    ("full", cut_at("c2a"), cut_at("c2b"), [(0, (600, 622, 700)), (1, (560, 760, 760))]),
    ("full", cut_at("c2b"), cut_at("c3"), [(0, (320, 1040, 600)), (1, (300, 1075, 540))]),
    ("full", cut_at("c3"), cut_at("c4"), [(0, (450, 560, 620)), (1, (430, 500, 560))]),
    ("full", cut_at("c4"), cut_at("c5"), [(0, (320, 640, 560)), (1, FULL)]),
    ("full", cut_at("c5"), cut_at("c6"), [(0, (400, 520, 540)), (1, (360, 440, 420))]),
    ("full", cut_at("c6"), cut_at("c7"), [(0, (850, 420, 460)), (1, (840, 470, 430))]),
    ("full", cut_at("c7"), cut_at("c9"), [(0, (760, 700, 600)), (0.48, (640, 880, 580)), (1, (630, 900, 470))]),
    ("full", cut_at("c9"), cut_at("c10"), [(0, (520, 700, 520)), (1, FULL)]),
    ("full", cut_at("c10"), cut_at("c11"), [(0, (560, 520, 700)), (1, (540, 500, 640))]),
    ("full", cut_at("c11"), cut_at("c12"), [(0, FULL), (0.18, FULL), (1, (470, 640, 680))]),
    ("full", cut_at("c12"), cut_at("final"), [(0, (370, 450, 440)), (1, (368, 446, 425))]),
    ("box", cut_at("final"), T_END_CARD + XFADE, [(0, (430, 600, 620)), (0.8, (PW / 2, PH / 2, PW)), (1, (PW / 2, PH / 2, PW))]),
]


def ease(p):
    p = min(max(p, 0.0), 1.0)
    return 0.35 * p + 0.65 * (0.5 - 0.5 * math.cos(math.pi * p))


def window_at(shot, t):
    mode, t0, t1, keys = shot
    p = (t - t0) / max(t1 - t0, 1e-6)
    p = min(max(p, 0.0), 1.0)
    for (fa, a), (fb, b) in zip(keys, keys[1:]):
        if p <= fb or (fb == keys[-1][0]):
            q = ease((p - fa) / max(fb - fa, 1e-6))
            cx = a[0] + (b[0] - a[0]) * q
            cy = a[1] + (b[1] - a[1]) * q
            w = a[2] * (b[2] / a[2]) ** q
            break
    aspect = (H / W) if mode == "full" else (BOX_H / BOX_W)
    w = min(w, PW if mode == "box" else PH / aspect)
    h = w * aspect
    cx = min(max(cx, w / 2), PW - w / 2)
    cy = min(max(cy, h / 2), PH - h / 2)
    return cx, cy, w, h


# ---------------------------------------------------------------- text
def font(path, size):
    return ImageFont.truetype(path, size)


def text_block(lines, size, path=FONT_B, stroke=4, shadow=True, max_w=840, line_gap=1.18, tracking=0):
    """Render centered lines of colored spans to an RGBA image of width W."""
    while True:
        f = font(path, size)
        widths = [sum(f.getlength(s) for s, _ in ln) + tracking * sum(len(s) for s, _ in ln) for ln in lines]
        if max(widths) <= max_w or size <= 40:
            break
        size -= 2
    asc, desc = f.getmetrics()
    lh = int(size * line_gap)
    pad = 30
    hgt = lh * (len(lines) - 1) + asc + desc + 2 * pad
    txt = Image.new("RGBA", (W, hgt), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    sh = Image.new("L", (W, hgt), 0)
    ds = ImageDraw.Draw(sh)
    for i, ln in enumerate(lines):
        x = (W - widths[i]) / 2
        y = pad + i * lh
        for s, col in ln:
            if tracking:
                for ch in s:
                    d.text((x, y), ch, font=f, fill=col + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 235))
                    ds.text((x, y + 4), ch, font=f, fill=150, stroke_width=stroke)
                    x += f.getlength(ch) + tracking
            else:
                d.text((x, y), s, font=f, fill=col + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 235))
                ds.text((x, y + 4), s, font=f, fill=150, stroke_width=stroke)
                x += f.getlength(s)
    if shadow:
        sh = sh.filter(ImageFilter.GaussianBlur(7))
        out = Image.new("RGBA", (W, hgt), (0, 0, 0, 0))
        out.putalpha(sh)
        out.alpha_composite(txt)
        return out
    return txt


SUB_Y = 1180          # caption block center, inside Reels safe area
BAND_Y = 250          # band text center (hook + final line)

CAPTIONS = []         # (t0, t1, image, center_y, fade_in)
for i, (k, t, lines) in enumerate(CUES):
    t0 = 0.0 if k == "hook" else round(t - LEAD + 0.02, 3)
    if k == "hook":
        t1 = cut_at("c2a")
    elif k == "final":
        t1 = T_END_CARD + XFADE
    else:
        t1 = round(CUES[i + 1][1] - LEAD, 3) if CUES[i + 1][0] != "final" else cut_at("final")
    if k in ("hook", "final"):
        img = text_block(lines, 70, FONT_B, stroke=0, shadow=False, max_w=960)
        CAPTIONS.append((t0, t1, img, BAND_Y, k != "hook"))
    else:
        img = text_block(lines, 62, FONT_B, stroke=4, shadow=True, max_w=840)
        CAPTIONS.append((t0, t1, img, SUB_Y, True))


# ---------------------------------------------------------------- end card
def rounded(d, box, r, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def end_card(pulse=0.0):
    bg = Image.new("RGBA", (W, H), (10, 12, 17, 255))
    # faint vertical vignette so the card isn't flat
    grad = np.linspace(0, 1, H)[:, None]
    glow = (np.exp(-((grad - 0.42) ** 2) / 0.06) * 14).astype(np.uint8)
    arr = np.array(bg)
    arr[..., 2] = np.clip(arr[..., 2].astype(int) + glow, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1].astype(int) + glow // 2, 0, 255)
    bg = Image.fromarray(arr)
    t1 = text_block([[("THE OLD GUITARIST", WHITE)]], 76, FONT_XB, stroke=0, shadow=False, max_w=960, tracking=3)
    bg.alpha_composite(t1, (0, 520 - t1.height // 2))
    t2 = text_block([[("PABLO PICASSO · 1903–04", (178, 188, 202))]], 38, FONT_SB, stroke=0, shadow=False, max_w=960, tracking=5)
    bg.alpha_composite(t2, (0, 612 - t2.height // 2))
    d = ImageDraw.Draw(bg)
    d.rectangle((W // 2 - 60, 690, W // 2 + 60, 693), fill=AMBER + (255,))
    t3 = text_block([[("FOLLOW FOR MORE STORIES", FOLLOW_YELLOW)], [("BEHIND GREAT ART", FOLLOW_YELLOW)]], 52, FONT_XB, stroke=0, shadow=False, max_w=940)
    bg.alpha_composite(t3, (0, 830 - t3.height // 2))
    # profile row: handle + name + Follow button (user's account, from their screenshot)
    card = (110, 1000, 970, 1170)
    rounded(d, card, 28, (22, 26, 34, 255), outline=(44, 50, 62, 255), width=2)
    fh = font(FONT_B, 40)
    fn = font(FONT_M, 30)
    d.text((150, 1030), "paint_explore_si", font=fh, fill=WHITE + (255,))
    d.text((150, 1088), "imran da painter", font=fn, fill=(154, 164, 178, 255))
    s = 1.0 + 0.05 * pulse
    bw, bh = 210 * s, 76 * s
    bx, by = 835, 1085
    rounded(d, (bx - bw / 2, by - bh / 2, bx + bw / 2, by + bh / 2), 16 * s, (74, 93, 249, 255))
    fb = font(FONT_SB, int(34 * s))
    tw = fb.getlength("Follow")
    d.text((bx - tw / 2, by - 21 * s), "Follow", font=fb, fill=WHITE + (255,))
    return bg.convert("RGB")


# ---------------------------------------------------------------- frames
SRC = Image.open(PAINTING).convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.0, percent=45, threshold=2))
assert SRC.size == (PW, PH), SRC.size


def render_painting(mode, win):
    cx, cy, w, h = win
    if mode == "full":
        k = w / W
        return SRC.transform((W, H), Image.AFFINE, (k, 0, cx - w / 2, 0, k, cy - h / 2), resample=Image.BICUBIC)
    k = w / BOX_W
    inner = SRC.transform((BOX_W, BOX_H), Image.AFFINE, (k, 0, cx - w / 2, 0, k, cy - h / 2), resample=Image.BICUBIC)
    frame = Image.new("RGB", (W, H), (0, 0, 0))
    frame.paste(inner, (BOX_X, BOX_Y))
    return frame


def shot_for(t):
    for s in SHOTS:
        if s[1] <= t < s[2]:
            return s
    return SHOTS[-1]


END_CACHE = {}


def frame_at(t):
    if t >= T_END_CARD + XFADE:
        pulse = 0.5 - 0.5 * math.cos(2 * math.pi * max(0.0, t - T_END_CARD - 1.2) / 1.2) if t > T_END_CARD + 1.2 else 0.0
        key = round(pulse, 2)
        if key not in END_CACHE:
            END_CACHE[key] = end_card(key)
        return END_CACHE[key]
    s = shot_for(t)
    img = render_painting(s[0], window_at(s, t)).convert("RGBA")
    for t0, t1, cap, cy, fade in CAPTIONS:
        if t0 <= t < t1:
            a = 1.0
            if fade:
                a = min(a, (t - t0) / 0.08)
            a = max(0.0, min(1.0, a))
            if a < 1.0:
                c = cap.copy()
                c.putalpha(c.getchannel("A").point(lambda v: int(v * a)))
            else:
                c = cap
            img.alpha_composite(c, (0, int(cy - c.height / 2)))
    img = img.convert("RGB")
    if t >= T_END_CARD:
        a = (t - T_END_CARD) / XFADE
        if 0.0 not in END_CACHE:
            END_CACHE[0.0] = end_card(0.0)
        img = Image.blend(img, END_CACHE[0.0], min(a, 1.0))
    return img


# ---------------------------------------------------------------- audio
def decode(path, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def write_wav(path, x):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", str(x.shape[1]), "-ar", str(SR), "-i", "-",
                    "-c:a", "pcm_s24le", path], input=x.astype(np.float32).tobytes(), check=True)


def lufs(path):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    js = r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1]
    return json.loads(js)


def build_audio():
    v = decode(VOICE, 1)[:, 0]
    src, s0, d0, ln = SPLICE
    alt = decode(src, 1)[:, 0][int(s0 * SR):int((s0 + ln) * SR)]
    a, b = int(d0 * SR), int(d0 * SR) + len(alt)
    xf = int(0.02 * SR)
    ramp = np.linspace(0, 1, xf, dtype=np.float32)
    alt[:xf] = v[a:a + xf] * (1 - ramp) + alt[:xf] * ramp
    alt[-xf:] = alt[-xf:] * (1 - ramp) + v[b - xf:b] * ramp
    v[a:b] = alt
    keep, last = [], 0
    for a, b in CUTS:
        keep.append(v[int(last * SR):int(a * SR)])
        last = b
    keep.append(v[int(last * SR):])
    xf = int(0.02 * SR)
    voice = keep[0]
    for seg in keep[1:]:
        ramp = np.linspace(0, 1, xf, dtype=np.float32)
        voice = np.concatenate([voice[:-xf], voice[-xf:] * (1 - ramp) + seg[:xf] * ramp, seg[xf:]])
    n = int(TOTAL * SR)
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    write_wav(f"{OUT}/voice_raw.wav", voice[:, None])
    g = 10 ** ((-16.0 - float(lufs(f"{OUT}/voice_raw.wav")["input_i"])) / 20)
    voice = voice * g

    m = decode(MUSIC, 2)[:n]
    m = np.pad(m, ((0, max(0, n - len(m))), (0, 0)))
    t = np.arange(n) / SR
    pts = [(0, -14), (cue_t["c12"] - 1.2, -14), (cue_t["c12"] - 0.6, -18), (cut_at("final") - 0.1, -18),
           (cut_at("final") + 0.4, -14), (VOICE_END + 0.1, -14), (T_END_CARD + 0.6, -7), (TOTAL - 1.6, -7), (TOTAL, -60)]
    env = 10 ** (np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) / 20)
    m = m * env[:, None]

    mix = m + voice[:, None]
    write_wav(f"{OUT}/mix_pre.wav", mix)
    write_wav(f"{OUT}/voice_only_pre.wav", np.repeat(voice[:, None], 2, axis=1))
    for name in ("mix", "voice_only"):
        meas = lufs(f"{OUT}/{name}_pre.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/{name}_pre.wav", "-af",
                        f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:"
                        f"measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}:linear=true,"
                        f"aresample={SR}", "-c:a", "pcm_s24le", f"{OUT}/{name}.wav"], check=True)


# ---------------------------------------------------------------- main
def encode(audio, out):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", audio, "-map", "0:v", "-map", "1:a",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-level", "4.2",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-c:a", "aac", "-b:a", "256k", "-ar", str(SR), "-shortest", "-movflags", "+faststart", out]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    print(f"total {TOTAL:.2f}s, voice end {VOICE_END:.2f}s, end card at {T_END_CARD:.2f}s")
    for k, t, _ in CUES:
        print(f"  {k:6s} {t:6.2f}")
    if mode == "preview":
        times = [0.05, 2.0] + [((s[1] + s[2]) / 2) for s in SHOTS[1:]] + [cut_at("final") + 3.0, T_END_CARD + 0.2, TOTAL - 0.5]
        thumbs = [frame_at(t).resize((270, 480), Image.LANCZOS) for t in times]
        cols = 6
        rows = math.ceil(len(thumbs) / cols)
        sheet = Image.new("RGB", (cols * 274, rows * 484), (40, 40, 40))
        for i, th in enumerate(thumbs):
            sheet.paste(th, ((i % cols) * 274 + 2, (i // cols) * 484 + 2))
        sheet.save(f"{OUT}/preview_sheet.png")
        for t in (0.05, 17.6, cut_at("final") + 3.0, TOTAL - 0.5):
            frame_at(t).save(f"{OUT}/frame_{t:05.2f}.png")
        sys.exit(0)

    build_audio()
    if mode == "audio":
        for name, vid in (("mix", "the_old_guitarist_reel"), ("voice_only", "the_old_guitarist_reel_voice_only")):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/{vid}.mp4", "-i", f"{OUT}/{name}.wav",
                            "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
                            "-shortest", "-movflags", "+faststart", f"{OUT}/{vid}.tmp.mp4"], check=True)
            os.replace(f"{OUT}/{vid}.tmp.mp4", f"{OUT}/{vid}.mp4")
        sys.exit(0)
    nframes = int(round(TOTAL * FPS))
    procs = [encode(f"{OUT}/mix.wav", f"{OUT}/the_old_guitarist_reel.mp4")]
    for i in range(nframes):
        buf = frame_at(i / FPS).tobytes()
        for p in procs:
            p.stdin.write(buf)
        if i % 150 == 0:
            print(f"frame {i}/{nframes}", flush=True)
    for p in procs:
        p.stdin.close()
        p.wait()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/the_old_guitarist_reel.mp4", "-i", f"{OUT}/voice_only.wav",
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
                    "-shortest", "-movflags", "+faststart", f"{OUT}/the_old_guitarist_reel_voice_only.mp4"], check=True)
    print("done")
