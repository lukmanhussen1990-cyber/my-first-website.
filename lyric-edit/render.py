#!/usr/bin/env python3
"""Lyric edit renderer.

Puts the four illustrations in images/ into a 1:1 lyric video whose subtitles copy
the reference clip: the same lyrics, the same letter-by-letter typewriter timing
(measured frame by frame from the reference), the same heavy wide black type and
the same "text in the white space beside the character" layout.

The illustrations themselves are never edited: each one is only scaled and placed
(the three white-background pictures sit on a canvas of their own 254-white, the
sunset picture fills the frame).

Usage:
    python3 render.py preview                 # last full frame of every scene -> output/preview/
    python3 render.py stills                  # 2160x2160 PNG of every scene's finished subtitles
    python3 render.py video --audio REF.mp4   # 1080x1080 MP4 with the song from the reference clip
    python3 render.py video                   # same video without sound
"""

import argparse
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
IMAGES = HERE / "images"
FONT_FILE = HERE / "fonts" / "Archivo[wdth,wght].ttf"
OUT = HERE / "output"

# All layout numbers below are in 1080x1080 units; other sizes are scaled from them.
BASE = 1080
FPS = 30
TOTAL_FRAMES = 868        # 28.93 s, the length of the reference clip
BG = 254.0                # the illustrations' own background white
FONT_SIZE = 70            # cap height 48 px at 1080 (reference: 32 px at 720)
FONT_WEIGHT = 850         # Archivo variable axes: a wide, heavy grotesque like the reference
FONT_WIDTH = 114
FADE_IN = 10              # frames: each scene fades up from white (reference: ~0.3 s)
FADE_OUT = 4              # frames: soft dip to white just before each cut
GLYPH_FADE = 3            # frames: each typed letter fades in instead of popping
END_FADE = 28             # frames: final fade to white, so the loop restarts cleanly


@dataclass
class Line:
    text: str
    align: str            # "left", "right" or "center" -- which ink edge `x` refers to
    x: float
    baseline: float
    frames: list          # reveal frame of each non-space character, from the reference


@dataclass
class Scene:
    name: str
    image: str
    start: int            # first frame (a cut from white)
    place: tuple = None   # (x, y, size) of the square picture; None = fill the frame
    lines: list = field(default_factory=list)


# Reveal frames were measured from the reference clip at 30 fps (frame of first appearance
# of every letter), so the typing stays locked to the song.
SCENES = [
    Scene("01_girl", "girl.png", 0, (20, 250, 600), [
        Line("She’s a", "left", 625, 455, [5, 10, 13, 21, 23, 28]),
        Line("She’s a", "right", 1017, 532, [33, 39, 43, 53, 55, 62]),
        Line("Lady", "right", 1017, 609, [75, 79, 80, 86]),
    ]),
    Scene("02_boy", "boy.png", 111, (25, 240, 680), [
        Line("And", "left", 700, 450, [115, 120, 123]),
        Line("I am", "left", 700, 527, [134, 139, 149]),
        Line("Just a", "left", 700, 604, [153, 154, 159, 161, 164]),
        Line("Boy", "left", 700, 681, [173, 181, 183]),
    ]),
    Scene("03_girl", "girl.png", 237, (20, 250, 600), [
        Line("She’s a", "left", 625, 455, [239, 241, 243, 254, 255, 258]),
        Line("She’s a", "left", 695, 532, [267, 273, 276, 285, 287, 292]),
        Line("Lady", "left", 776, 609, [299, 309, 314, 330]),
    ]),
    Scene("04_boy", "boy.png", 340, (15, 300, 640), [
        Line("And I am", "left", 90, 135, [342, 345, 347, 362, 365, 376]),
        Line("Just a Line", "left", 91, 212, [379, 380, 383, 384, 386, 392, 404, 406, 409]),
        Line("Without", "center", 800, 527, [424, 426, 428, 438, 439, 441, 442]),
        Line("hook", "center", 800, 604, [451, 453, 453, 456]),
    ]),
    Scene("05_hug", "hug.png", 463, (15, 255, 580), [
        Line("Oh baby", "left", 55, 134, [465, 468, 482, 484, 486, 487]),
        Line("I am a wreck", "left", 57, 212, [498, 501, 504, 505, 511, 512, 524, 526, 528]),
        Line("When i am", "right", 1025, 488, [543, 545, 547, 556, 560, 569, 570]),
        Line("Without", "right", 1025, 565, [572, 574, 575, 575, 577, 580, 581]),
        Line("You", "right", 1025, 642, [592, 594, 595]),
    ]),
    Scene("06_sunset", "sunset.png", 623, None, [
        Line("I need you", "left", 80, 112, [624, 629, 640, 642, 644, 654, 656, 657]),
        Line("Here to", "right", 1012, 183, [665, 668, 670, 682, 686, 687]),
        Line("Stay", "right", 1012, 260, [698, 700, 701, 704]),
    ]),
]


def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def load_font(px):
    font = ImageFont.truetype(str(FONT_FILE), px)
    wanted = {"Weight": FONT_WEIGHT, "Width": FONT_WIDTH}
    axes = []
    for axis in font.get_variation_axes():
        name = axis["name"].decode() if isinstance(axis["name"], bytes) else axis["name"]
        axes.append(wanted[name])
    font.set_variation_by_axes(axes)
    return font


class Glyphs:
    """Per-letter alpha masks of one subtitle line, so letters can be revealed one by one."""

    def __init__(self, line, font, scale):
        chars = [i for i, c in enumerate(line.text) if not c.isspace()]
        assert len(chars) == len(line.frames), (line.text, len(chars), len(line.frames))
        left, top, right, bottom = font.getbbox(line.text, anchor="ls")
        x = line.x * scale
        if line.align == "left":
            origin = x - left
        elif line.align == "right":
            origin = x - right
        else:
            origin = x - (left + right) / 2
        base = line.baseline * scale
        pad = int(6 * scale)
        self.x0 = int(np.floor(origin + left)) - pad
        self.y0 = int(np.floor(base + top)) - pad
        w = int(np.ceil(right - left)) + 2 * pad
        h = int(np.ceil(bottom - top)) + 2 * pad
        ox, oy = origin - self.x0, base - self.y0
        # A prefix of the line keeps the exact glyph positions of the full line, so the
        # difference between consecutive prefixes isolates each newly typed letter.
        prev = np.zeros((h, w), np.float32)
        self.masks = []
        for i in chars:
            im = Image.new("L", (w, h), 0)
            ImageDraw.Draw(im).text((ox, oy), line.text[: i + 1], font=font, fill=255, anchor="ls")
            cur = np.asarray(im, np.float32) / 255.0
            self.masks.append(np.clip(cur - prev, 0.0, 1.0))
            prev = cur
        self.frames = list(line.frames)
        self.shape = (h, w)

    def alpha(self, frame):
        out = np.zeros(self.shape, np.float32)
        for mask, f0 in zip(self.masks, self.frames):
            a = (frame - f0 + 1) / GLYPH_FADE
            if a > 0:
                out += mask * min(a, 1.0)
        return np.clip(out, 0.0, 1.0)


class Renderer:
    def __init__(self, size=BASE):
        self.size = size
        self.scale = size / BASE
        font = load_font(round(FONT_SIZE * self.scale))
        self.layers = []
        self.glyphs = []
        for scene in SCENES:
            self.layers.append(self._picture_layer(scene))
            self.glyphs.append([Glyphs(line, font, self.scale) for line in scene.lines])

    def _picture_layer(self, scene):
        img = Image.open(IMAGES / scene.image).convert("RGB")
        if scene.place is None:
            return np.asarray(img.resize((self.size, self.size), Image.LANCZOS), np.float32)
        x, y, s = (round(v * self.scale) for v in scene.place)
        canvas = Image.new("RGB", (self.size, self.size), (int(BG),) * 3)
        canvas.paste(img.resize((s, s), Image.LANCZOS), (x, y))
        return np.asarray(canvas, np.float32)

    def scene_index(self, frame):
        idx = 0
        for i, scene in enumerate(SCENES):
            if frame >= scene.start:
                idx = i
        return idx

    def frame(self, frame):
        i = self.scene_index(frame)
        scene = SCENES[i]
        end = SCENES[i + 1].start if i + 1 < len(SCENES) else TOTAL_FRAMES
        fade_out = END_FADE if i + 1 == len(SCENES) else FADE_OUT

        # Picture fades up from white at the cut, like the reference.
        a = smoothstep((frame - scene.start) / FADE_IN)
        out = BG + (self.layers[i] - BG) * a

        # Typed letters in solid black.
        for g in self.glyphs[i]:
            ta = g.alpha(frame)
            h, w = g.shape
            y0, x0 = max(g.y0, 0), max(g.x0, 0)
            y1, x1 = min(g.y0 + h, self.size), min(g.x0 + w, self.size)
            ta = ta[y0 - g.y0 : y1 - g.y0, x0 - g.x0 : x1 - g.x0]
            out[y0:y1, x0:x1] *= 1.0 - ta[..., None]

        # Soft dip to white right before the next cut (or the end of the clip).
        left = end - frame
        if left <= fade_out:
            out = BG + (out - BG) * smoothstep(left / (fade_out + 1))
        return np.clip(out + 0.5, 0, 255).astype(np.uint8)

    def finished_frame(self, i):
        """Last frame of scene i before its fade-out: every lyric line fully typed."""
        end = SCENES[i + 1].start if i + 1 < len(SCENES) else TOTAL_FRAMES
        fade_out = END_FADE if i + 1 == len(SCENES) else FADE_OUT
        frame = end - fade_out - 1
        last = max(f for line in SCENES[i].lines for f in line.frames)
        assert frame >= last + GLYPH_FADE - 1, (SCENES[i].name, frame, last)
        return frame


def check_layout(renderer, i):
    """Report how close the lyrics come to the artwork (or how light the sky behind them is)."""
    scene = SCENES[i]
    size = renderer.size
    text = Image.new("L", (size, size), 0)
    for g in renderer.glyphs[i]:
        m = (np.clip(sum(g.masks), 0, 1) * 255).astype(np.uint8)
        text.paste(Image.fromarray(m), (g.x0, g.y0), Image.fromarray(m))
    layer = renderer.layers[i]
    lum = layer @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    # On white canvases anything not background-white is artwork; on the full-frame
    # picture only the dark parts (hair, hoodie) would swallow black letters.
    ink = layer.min(axis=2) < 236 if scene.place is not None else lum < 120
    report = []
    for gap in (8, 16, 24, 32):
        grown = np.asarray(text.filter(ImageFilter.MaxFilter(2 * gap + 1))) > 0
        report.append(f"{gap}px:{int((grown & ink).sum())}")
    msg = "artwork pixels within " + " ".join(report)
    if scene.place is None:
        grown = np.asarray(text.filter(ImageFilter.MaxFilter(17))) > 0
        msg += f" | luminance behind text: min {lum[grown].min():.0f}"
    return msg


def cmd_preview(_args):
    r = Renderer(BASE)
    out = OUT / "preview"
    out.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for i, scene in enumerate(SCENES):
        img = r.frame(r.finished_frame(i))
        Image.fromarray(img).save(out / f"{scene.name}.png")
        print(f"{scene.name}: {check_layout(r, i)}")
        thumbs.append(Image.fromarray(img).resize((540, 540), Image.LANCZOS))
    sheet = Image.new("RGB", (540 * 3 + 20, 540 * 2 + 10), (200, 0, 0))
    for k, t in enumerate(thumbs):
        sheet.paste(t, ((k % 3) * 550, (k // 3) * 550))
    sheet.save(out / "contact_sheet.png")


def cmd_stills(_args):
    r = Renderer(2160)
    out = OUT / "stills"
    out.mkdir(parents=True, exist_ok=True)
    for i, scene in enumerate(SCENES):
        Image.fromarray(r.frame(r.finished_frame(i))).save(out / f"{scene.name}.png", optimize=True)
        print("wrote", out / f"{scene.name}.png")


def cmd_video(args):
    r = Renderer(BASE)
    OUT.mkdir(parents=True, exist_ok=True)
    dest = Path(args.out) if args.out else OUT / ("lyric_edit.mp4" if args.audio else "lyric_edit_no_audio.mp4")
    duration = TOTAL_FRAMES / FPS
    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{BASE}x{BASE}", "-r", str(FPS), "-i", "-"]
    if args.audio:
        cmd += ["-i", args.audio, "-map", "0:v", "-map", "1:a",
                "-af", f"afade=t=out:st={duration - 1.3:.3f}:d=1.3",
                "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-r", str(FPS), "-t", f"{duration:.3f}", "-movflags", "+faststart", str(dest)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(TOTAL_FRAMES):
        proc.stdin.write(r.frame(f).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print("wrote", dest)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("preview").set_defaults(func=cmd_preview)
    sub.add_parser("stills").set_defaults(func=cmd_stills)
    v = sub.add_parser("video")
    v.add_argument("--audio", help="clip whose sound track is used (the reference video)")
    v.add_argument("--out", help="output path")
    v.set_defaults(func=cmd_video)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
