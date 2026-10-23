"""Render the reel: fixed title, fast-cut image shots, karaoke captions.

Layout and timing follow the analysed reference reel (720x1280, 720x720
picture at y=280, bold-italic captions just under the picture, active word
in yellow with a quick pop, a new shot roughly every 1-1.5 s).

usage: python3 make_video.py [--voice pratham] [--static] [--out sone_ki_qaid.mp4]
"""
import argparse
import bisect
import json
import math
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont

from script_data import FOCUS, IMAGE_SPLIT_WORD, IMPACT

W, H, FPS = 720, 1280, 30
IMG_Y, IMG_S = 280, 720
YELLOW, WHITE, BLACK = (255, 212, 0), (255, 255, 255), (0, 0, 0)

TITLE_FONT = "fonts/Poppins-Bold.ttf"
CAP_FONT = "fonts/Poppins-BoldItalic.ttf"
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
TITLE_SIZE = 46
TITLE_BASELINES = (199, 253)
CAP_SIZE = 34
CAP_STROKE = 3
CAP_Y = 1031
CAP_MAX_W = 660
CAP_GAP = 6            # extra pixels between words so the popped word stays clear
POP_SCALE, POP_TIME = 0.25, 0.20
WATERMARK = "@deepsochotv"
WM_SIZE = 24
WM_Y = 961             # centre line of the watermark, near the picture's bottom edge

FADE_IN = 0.65        # picture fades in from black, as in the reference
END_HOLD = 1.5        # hold the last picture after the voice ends
SHOT_LEN = 1.5        # target seconds per shot
MIN_SHOT = 0.6
CUT_LEAD = 0.05       # cut slightly before the word that starts a new picture
SNAP = 0.3            # snap in-image cuts to a word onset within this window
MUSIC_VOLUME = 0.12


# ---------------------------------------------------------------- text

_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def render_emoji(ch, height):
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 10), ch, font=font(EMOJI_FONT, 109), embedded_color=True)
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def render_title(canvas):
    d = ImageDraw.Draw(canvas)
    f = font(TITLE_FONT, TITLE_SIZE)
    d.text((W / 2, TITLE_BASELINES[0]), "Kanjoos ka", font=f, fill=WHITE, anchor="ms")
    parts = [("khatarnaak", YELLOW), (" anjaam", WHITE)]
    skull = render_emoji("\U0001F480", round(TITLE_SIZE * 0.95))
    gap = round(TITLE_SIZE * 0.35)
    x = (W - sum(f.getlength(t) for t, _ in parts) - gap - skull.width) / 2
    y = TITLE_BASELINES[1]
    for text, colour in parts:
        d.text((x, y), text, font=f, fill=colour, anchor="ls")
        x += f.getlength(text)
    # The reference's skull sits low on the line: bottom ~17px under the baseline.
    canvas.paste(skull, (round(x + gap), round(y - TITLE_SIZE * 0.13 - skull.height / 2)), skull)


def render_watermark():
    """Semi-transparent dark text with a thin light outline, as in the reference."""
    s = 2  # draw at 2x and scale down for a 1.5 px outline
    f = font(TITLE_FONT, WM_SIZE * s)
    x0, y0, x1, y1 = f.getbbox(WATERMARK, stroke_width=3 * s // 2)
    im = Image.new("RGBA", (x1 - x0 + 4, y1 - y0 + 4), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((2 - x0, 2 - y0), WATERMARK, font=f, fill=(0, 0, 0, 95),
                            stroke_width=3 * s // 2, stroke_fill=(255, 255, 255, 120))
    return im.resize((im.width // s, im.height // s), Image.LANCZOS)


def ends_phrase(word):
    return word.rstrip("\"'").endswith((",", ".", "!", "?", "…"))


def chunk_line(words):
    """Split a line's words into caption chunks of 2-4 words at natural breaks."""
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if ends_phrase(w["w"]):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    merged, i = [], 0
    while i < len(phrases):
        # A lone word joins the next phrase ("Bachao! Koi hai?"); a lone last
        # word stays alone for impact ("dhadaam!").
        if len(phrases[i]) == 1 and i + 1 < len(phrases) and len(phrases[i + 1]) <= 3:
            merged.append(phrases[i] + phrases[i + 1])
            i += 2
        else:
            merged.append(phrases[i])
            i += 1
    chunks = []
    for p in merged:
        n = max(1, round(len(p) / 3))
        while len(p) / n > 4:
            n += 1
        base, extra = divmod(len(p), n)
        k = 0
        for size in [base + 1] * extra + [base] * (n - extra):
            chunks.append(p[k:k + size])
            k += size
    return chunks


def plan_captions(lines, video_end):
    chunks = [c for L in lines for c in chunk_line(L["words"])]
    out = []
    for i, c in enumerate(chunks):
        start = max(0.0, c[0]["start"] - 0.05)
        if i + 1 < len(chunks):
            nxt = chunks[i + 1][0]["start"] - 0.05
            end = nxt if nxt - c[-1]["end"] < 1.5 else c[-1]["end"] + 0.6
        else:
            end = video_end
        out.append({"start": start, "end": end, "words": c})
    return out


def draw_caption(draw, cap, t):
    words = cap["words"]
    size = CAP_SIZE
    f = font(CAP_FONT, size)
    widths = [f.getlength(w["w"]) for w in words]
    space = f.getlength(" ") + CAP_GAP
    total = sum(widths) + space * (len(words) - 1)
    if total > CAP_MAX_W:
        size = int(size * CAP_MAX_W / total)
        f = font(CAP_FONT, size)
        widths = [f.getlength(w["w"]) for w in words]
        space = f.getlength(" ") + CAP_GAP
        total = sum(widths) + space * (len(words) - 1)
    centres, x = [], (W - total) / 2
    for wd in widths:
        centres.append(x + wd / 2)
        x += wd + space
    active = None
    for i, w in enumerate(words):
        if w["start"] <= t:
            active = i
    for i, w in enumerate(words):
        if i != active:
            draw.text((centres[i], CAP_Y), w["w"], font=f, fill=WHITE, anchor="mm",
                      stroke_width=CAP_STROKE, stroke_fill=BLACK)
    if active is not None:
        u = min(1.0, (t - words[active]["start"]) / POP_TIME)
        fa = font(CAP_FONT, round(size * (1 + POP_SCALE * (1 - u) ** 2)))
        draw.text((centres[active], CAP_Y), words[active]["w"], font=fa, fill=YELLOW,
                  anchor="mm", stroke_width=CAP_STROKE, stroke_fill=BLACK)


# ---------------------------------------------------------------- shots

def image_spans(lines, video_end):
    """Which picture is on screen when: [(image, t0, t1), ...]."""
    spans = []
    for li, L in enumerate(lines):
        t0 = 0.0 if li == 0 else L["words"][0]["start"] - CUT_LEAD
        t1 = video_end if li == len(lines) - 1 else lines[li + 1]["words"][0]["start"] - CUT_LEAD
        imgs, ws = L["images"], L["words"]
        if L["line"] in IMAGE_SPLIT_WORD:
            idx = [IMAGE_SPLIT_WORD[L["line"]]]
        else:
            idx = [min(range(1, len(ws)), key=lambda j: abs(ws[j]["start"] - (t0 + (t1 - t0) * k / len(imgs))))
                   for k in range(1, len(imgs))]
        bounds = [t0] + [ws[j]["start"] - CUT_LEAD for j in idx] + [t1]
        for k, img in enumerate(imgs):
            spans.append((img, bounds[k], bounds[k + 1]))
    return spans


def framing_sequence(n):
    """Shot types for n shots of one picture: Wide, Close on A/B, Medium pan on A/B."""
    return {1: ["W"], 2: ["W", "CA"], 3: ["W", "MB", "CA"], 4: ["W", "CA", "MB", "CB"]}.get(
        n, ["W", "CA", "MB", "CB", "MA"] + ["CA", "MB"] * n)[:n]


def shot_motion(kind, focus, dur, static):
    """Start/end zoom and centre for a shot. Zoom 1 = the whole (square) picture."""
    (ax, ay), (bx, by) = focus
    r = 0.0 if static else min(0.15, 0.10 * dur)
    pan = 0.0 if static else 0.05
    if kind == "W":     # wide, slow push in towards the main subject
        return dict(z=(1.0, 1.0 + r), c=((ax, ay), (ax, ay)))
    if kind == "WI":    # impact: nearly full frame, leaves room for the shake
        return dict(z=(1.12, 1.12 / (1 + 0.5 * r)), c=((ax, ay), (ax, ay)))
    if kind == "CA":    # close-up on the main subject, slow pull out
        return dict(z=(1.95, 1.95 / (1 + 0.8 * r)), c=((ax, ay), (ax, ay)))
    if kind == "CB":    # close-up on the detail, slow push in
        return dict(z=(1.7, 1.7 * (1 + r)), c=((bx, by), (bx, by)))
    if kind == "MB":    # medium on the detail with a sideways pan
        d = pan if bx < 0.5 else -pan
        return dict(z=(1.4, 1.4 * (1 + 0.4 * r)), c=((bx - d, by), (bx + d, by)))
    # MA: medium on the main subject with a vertical drift
    return dict(z=(1.35, 1.35 * (1 + 0.4 * r)), c=((ax, ay + pan), (ax, ay - pan)))


def split_span(t0, t1, n, onsets):
    """n shots over [t0, t1], inner cuts snapped to word onsets when close."""
    cuts = []
    for k in range(1, n):
        target = t0 + (t1 - t0) * k / n
        i = bisect.bisect_left(onsets, target)
        near = [o for o in onsets[max(0, i - 1):i + 1] if abs(o - target) <= SNAP]
        cut = min(near, key=lambda o: abs(o - target)) - CUT_LEAD if near else target
        prev = cuts[-1] if cuts else t0
        if cut - prev >= MIN_SHOT and t1 - cut >= MIN_SHOT:
            cuts.append(cut)
    return list(zip([t0] + cuts, cuts + [t1]))


def plan_shots(lines, video_end, static):
    onsets = sorted(w["start"] for L in lines for w in L["words"])
    impact_line, impact_word = IMPACT
    impact_t = next(L["words"][impact_word]["start"] for L in lines if L["line"] == impact_line) - 1 / FPS
    shots = []
    for img, t0, t1 in image_spans(lines, video_end):
        parts = [(t0, impact_t), (impact_t, t1)] if t0 < impact_t < t1 else [(t0, t1)]
        pieces = []
        for a, b in parts:
            n = max(1, round((b - a) / SHOT_LEN))
            pieces += split_span(a, b, n, onsets)
        kinds = framing_sequence(len(pieces))
        if len(parts) == 2:  # build up in close, then slam to the full frame on the impact
            kinds = ["CA", "MA", "CB"][:len(pieces) - 1] + ["WI"]
        for (a, b), kind in zip(pieces, kinds):
            m = shot_motion(kind, FOCUS[img], b - a, static)
            shots.append(dict(img=img, t0=a, t1=b, kind=kind, impact=abs(a - impact_t) < 1e-6, **m))
    return shots, impact_t


def crop_box(iw, ih, cx, cy, z):
    side = min(iw, ih) / z
    x = min(max(cx * iw - side / 2, 0), iw - side)
    y = min(max(cy * ih - side / 2, 0), ih - side)
    return (x, y, x + side, y + side)


def render_picture(src, shot, t, impact_t, watermark):
    u = (t - shot["t0"]) / (shot["t1"] - shot["t0"])
    z = shot["z"][0] + (shot["z"][1] - shot["z"][0]) * u
    (cx0, cy0), (cx1, cy1) = shot["c"]
    cx, cy = cx0 + (cx1 - cx0) * u, cy0 + (cy1 - cy0) * u
    iw, ih = src.size
    dx = dy = 0.0
    if shot["impact"] and t - impact_t < 0.45:
        k = (1 - (t - impact_t) / 0.45) ** 2
        z *= 1 + 0.08 * k                         # punch in
        amp = 16 * k * (min(iw, ih) / z) / IMG_S   # shake, in source pixels
        dx = amp * math.sin(t * 2 * math.pi * 23)
        dy = amp * math.cos(t * 2 * math.pi * 17)
    x0, y0, x1, y1 = crop_box(iw, ih, cx, cy, z)
    side = x1 - x0
    x0 = min(max(x0 + dx, 0), iw - side)
    y0 = min(max(y0 + dy, 0), ih - side)
    tile = src.resize((IMG_S, IMG_S), Image.BICUBIC, box=(x0, y0, x0 + side, y0 + side))
    # Part of the picture (fades and flashes with it) but fixed in place while it zooms.
    tile.paste(watermark, ((IMG_S - watermark.width) // 2, WM_Y - IMG_Y - watermark.height // 2), watermark)
    if t < FADE_IN:
        tile = Image.blend(Image.new("RGB", tile.size), tile, t / FADE_IN)
    if 0 <= t - impact_t < 0.3:
        tile = Image.blend(tile, Image.new("RGB", tile.size, WHITE), 0.9 * (1 - (t - impact_t) / 0.3) ** 2)
    return tile


# ---------------------------------------------------------------- audio

def build_audio(voice_wav, video_end, out_wav):
    pad = f"apad=whole_dur={video_end:.3f},atrim=0:{video_end:.3f}"
    chain = f"{pad},aresample=44100,pan=stereo|c0=c0|c1=c0"
    music = "background.mp3"
    if os.path.exists(music):
        fade_out = max(0.0, video_end - 2.5)
        graph = (f"[0:a]{chain}[v];[1:a]aresample=44100,aformat=channel_layouts=stereo,"
                 f"aloop=loop=-1:size=2e9,atrim=0:{video_end:.3f},volume={MUSIC_VOLUME},"
                 f"afade=t=in:d=1.5,afade=t=out:st={fade_out:.3f}:d=2.5[m];"
                 f"[v][m]amix=inputs=2:normalize=0:duration=first")
        inputs = ["-i", voice_wav, "-i", music]
    else:
        graph = f"[0:a]{chain}"
        inputs = ["-i", voice_wav]
    # Two-pass loudness normalisation to -14 LUFS (Instagram's playback level).
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *inputs, "-filter_complex",
                            graph + ",loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True, check=True).stderr
    m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
    norm = (f"loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:"
            f"measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
            f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex",
                    graph + "," + norm + ",aresample=44100", "-c:a", "pcm_s16le", out_wav], check=True)
    return os.path.exists(music)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="pratham")
    ap.add_argument("--static", action="store_true", help="no zoom/pan inside shots (exact reference look)")
    ap.add_argument("--out", default="sone_ki_qaid.mp4")
    args = ap.parse_args()

    meta = json.load(open(f"build/timings_{args.voice}.json"))
    lines = meta["lines"]
    video_end = lines[-1]["words"][-1]["end"] + END_HOLD
    nframes = round(video_end * FPS)

    shots, impact_t = plan_shots(lines, video_end, args.static)
    captions = plan_captions(lines, video_end)
    with open("build/edit_plan.json", "w") as f:
        json.dump({"shots": shots, "captions": [{"start": c["start"], "end": c["end"],
                   "text": " ".join(w["w"] for w in c["words"])} for c in captions]},
                  f, ensure_ascii=False, indent=1)
    print(f"duration {video_end:.2f}s, {len(shots)} shots ({len(shots) - 1} cuts), "
          f"{len(captions)} caption chunks, impact at {impact_t:.2f}s")

    has_music = build_audio(f"build/voice_{args.voice}.wav", video_end, "build/audio_final.wav")
    print("background music:", "mixed at 12%" if has_music else "none found, skipped")

    sources = {}
    for s in shots:
        if s["img"] not in sources:
            sources[s["img"]] = Image.open(f"images/{s['img']:02d}.png").convert("RGB")
    base = Image.new("RGB", (W, H), BLACK)
    render_title(base)
    watermark = render_watermark()

    enc = subprocess.Popen([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", "build/audio_final.wav", "-map", "0:v", "-map", "1:a",
        "-vf", "scale=out_color_matrix=bt709:out_range=tv",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart", "-shortest", args.out], stdin=subprocess.PIPE)

    starts = [s["t0"] for s in shots]
    cap_starts = [c["start"] for c in captions]
    for fi in range(nframes):
        t = fi / FPS
        shot = shots[max(0, bisect.bisect_right(starts, t) - 1)]
        frame = base.copy()
        frame.paste(render_picture(sources[shot["img"]], shot, t, impact_t, watermark), (0, IMG_Y))
        ci = bisect.bisect_right(cap_starts, t) - 1
        if ci >= 0 and t < captions[ci]["end"]:
            draw_caption(ImageDraw.Draw(frame), captions[ci], t)
        enc.stdin.write(frame.tobytes())
        if fi % 300 == 0:
            print(f"  frame {fi}/{nframes}", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print("wrote", args.out)


if __name__ == "__main__":
    main()
