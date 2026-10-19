"""On-screen text and HUD graphics, plus the final compositor.

Captions follow timeline.TEXT_CUES; gauges follow timeline.GAUGES and never
show numbers (no fabricated readings). The compositor decodes the rendered
shots, draws the overlays on every frame and muxes the soundtrack:

  python3 overlays.py --compose            # build/*.mkv + output/soundtrack.wav -> output/*.mp4
  python3 overlays.py --still in.png 3.0   # preview overlays on a rendered still
"""
import argparse
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import timeline as TL

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = "/usr/share/fonts/opentype/inter"
F_BLACK = os.path.join(FONT_DIR, "InterDisplay-Black.otf")
F_XBOLD = os.path.join(FONT_DIR, "InterDisplay-ExtraBold.otf")
F_BOLD = os.path.join(FONT_DIR, "Inter-Bold.otf")
F_SEMI = os.path.join(FONT_DIR, "Inter-SemiBold.otf")

W, H = TL.OUT_W, TL.OUT_H
WHITE = (255, 255, 255)
ORANGE = (255, 146, 44)
RED = (255, 62, 46)
SAFE_W = 900            # max text width (Instagram safe area)
TEXT_Y = 470            # vertical centre of the caption block

STYLES = {
    "title":    dict(font=F_BLACK, size=128, lead=0.98, accent=ORANGE),
    "headline": dict(font=F_BLACK, size=100, lead=1.0, accent=ORANGE),
    "warning":  dict(font=F_BLACK, size=112, lead=1.0, accent=RED),
    "sub":      dict(font=F_BOLD, size=62, lead=1.18, accent=ORANGE),
}


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ----------------------------------------------------------------------------
# captions
# ----------------------------------------------------------------------------
def _runs(line, phrases):
    """Split a line into (text, highlighted) runs."""
    mask = [False] * len(line)
    for ph in phrases:
        start = 0
        while True:
            i = line.find(ph, start)
            if i < 0:
                break
            for k in range(i, i + len(ph)):
                mask[k] = True
            start = i + len(ph)
    runs = []
    for ch, m in zip(line, mask):
        if runs and runs[-1][1] == m:
            runs[-1][0] += ch
        else:
            runs.append([ch, m])
    return runs


def render_caption(cue):
    """Render one caption block to an RGBA image (cached by the caller)."""
    st = STYLES[cue["style"]]
    accent = RED if cue.get("accent") == "red" else st["accent"]
    lines = cue["text"].split("\n")
    size = st["size"]
    while True:
        font = ImageFont.truetype(st["font"], size)
        widest = max(font.getlength(l) for l in lines)
        if widest <= SAFE_W or size < 30:
            break
        size -= 2
    asc, desc = font.getmetrics()
    lh = int(size * st["lead"])
    pad = 60
    bw = int(widest) + pad * 2
    bh = lh * (len(lines) - 1) + asc + desc + pad * 2
    text = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    mask_hi = Image.new("L", (bw, bh), 0)
    d = ImageDraw.Draw(text)
    dm = ImageDraw.Draw(mask_hi)
    for i, line in enumerate(lines):
        y = pad + i * lh
        x = (bw - font.getlength(line)) / 2
        for chunk, hi in _runs(line, cue.get("hl", [])):
            col = accent if hi else WHITE
            d.text((x, y), chunk, font=font, fill=col + (255,))
            if hi:
                dm.text((x, y), chunk, font=font, fill=255)
            x += font.getlength(chunk)
    alpha = text.split()[3]

    out = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    if cue["style"] == "sub":
        # translucent dark card behind smaller text
        bbox = alpha.getbbox()
        card = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        dc = ImageDraw.Draw(card)
        x0, y0, x1, y1 = bbox
        dc.rounded_rectangle([x0 - 34, y0 - 24, x1 + 34, y1 + 26], radius=30, fill=(8, 6, 10, 125))
        card = card.filter(ImageFilter.GaussianBlur(1.2))
        out = Image.alpha_composite(out, card)
    # soft wide shadow + tight shadow for contrast over bright clouds
    for blur, op, dy in ((26, 0.45, 8), (9, 0.75, 5)):
        sh = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        a = alpha.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * op))
        sh.putalpha(a)
        sh = sh.transform(sh.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy))
        out = Image.alpha_composite(out, sh)
    # accent glow behind highlighted words
    if mask_hi.getbbox():
        glow = Image.new("RGBA", (bw, bh), accent + (0,))
        glow.putalpha(mask_hi.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.55)))
        out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, text)
    return out


class Captions:
    def __init__(self):
        self.cache = {}

    def draw(self, frame, t):
        for i, cue in enumerate(TL.TEXT_CUES):
            t0, t1 = cue["t0"], cue["t1"]
            if not (t0 <= t <= t1):
                continue
            if i not in self.cache:
                self.cache[i] = render_caption(cue)
            img = self.cache[i]
            fin = 0.24 if cue["style"] != "title" else 0.3
            fout = 0.22
            a = smooth((t - t0) / fin) * smooth((t1 - t) / fout)
            k = ease_out((t - t0) / fin)
            if cue["style"] == "title":
                scale = 1.18 - 0.18 * k
            elif cue["style"] == "warning":
                scale = 1.08 - 0.08 * k
            else:
                scale = 0.96 + 0.04 * k
            dy = (1 - k) * 18
            if cue["style"] == "warning":
                # alarm flicker on entry, then a slow pulse
                x = t - t0
                if x < 0.32:
                    a *= 1.0 if int(x * 38) % 3 else 0.25
            if t1 - t < fout:
                dy -= (1 - (t1 - t) / fout) * 10
            y_center = TEXT_Y
            if t0 >= 42.0:
                y_center = 820
            self._paste(frame, img, scale, (W / 2, y_center + dy), a)

    @staticmethod
    def _paste(frame, img, scale, center, alpha):
        if alpha <= 0.003:
            return
        if abs(scale - 1.0) > 1e-3:
            img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BICUBIC)
        if alpha < 0.999:
            a = img.split()[3].point(lambda v: int(v * alpha))
            img = img.copy()
            img.putalpha(a)
        x = int(round(center[0] - img.width / 2))
        y = int(round(center[1] - img.height / 2))
        frame.alpha_composite(img, (max(x, 0), max(y, 0)),
                              (max(-x, 0), max(-y, 0)))


# ----------------------------------------------------------------------------
# HUD gauges (supersampled vector drawing)
# ----------------------------------------------------------------------------
SS = 3


def _font(path, size):
    return ImageFont.truetype(path, int(size * SS))


def gauge_level(kind, t):
    """Needle / fill position 0..1 with nervous jitter (no units, no numbers)."""
    g = [x for x in TL.GAUGES if x["kind"] == kind][0]
    u = (t - g["t0"]) / (g["t1"] - g["t0"])
    if kind == "pressure":
        base = 0.12 + 0.82 * (u ** 1.35)
    else:
        base = 0.22 + 0.76 * (u ** 1.2)
    jit = 0.018 * math.sin(t * 23.0) + 0.012 * math.sin(t * 41.0 + 1.3) + 0.01 * math.sin(t * 7.3)
    return min(max(base + jit, 0.0), 1.0)


def draw_pressure(t, alpha):
    w, h = 360, 250
    im = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = SS
    d.rounded_rectangle([0, 0, w * s - 1, h * s - 1], radius=26 * s, fill=(10, 8, 12, 150),
                        outline=(255, 120, 60, 120), width=2 * s)
    cx, cy, r = w * s / 2, 178 * s, 118 * s
    a0, a1 = 200.0, 340.0
    # coloured arc: cool -> warning red
    segs = 60
    for i in range(segs):
        u0, u1 = i / segs, (i + 1) / segs
        col = _ramp(u0)
        d.arc([cx - r, cy - r, cx + r, cy + r], a0 + (a1 - a0) * u0, a0 + (a1 - a0) * u1 + 0.6,
              fill=col + (255,), width=16 * s)
    for i in range(21):
        u = i / 20
        ang = math.radians(a0 + (a1 - a0) * u)
        r0 = r - (34 if i % 5 == 0 else 26) * s
        r1 = r - 18 * s
        d.line([(cx + math.cos(ang) * r0, cy + math.sin(ang) * r0), (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1)],
               fill=(255, 255, 255, 220 if i % 5 == 0 else 140), width=(4 if i % 5 == 0 else 2) * s)
    lv = gauge_level("pressure", t)
    ang = math.radians(a0 + (a1 - a0) * lv)
    tip = (cx + math.cos(ang) * (r - 22 * s), cy + math.sin(ang) * (r - 22 * s))
    base_l = (cx + math.cos(ang + 1.57) * 9 * s, cy + math.sin(ang + 1.57) * 9 * s)
    base_r = (cx + math.cos(ang - 1.57) * 9 * s, cy + math.sin(ang - 1.57) * 9 * s)
    d.polygon([tip, base_l, base_r], fill=(255, 255, 255, 255))
    d.ellipse([cx - 15 * s, cy - 15 * s, cx + 15 * s, cy + 15 * s], fill=(255, 70, 50, 255))
    fl = _font(F_BOLD, 30)
    fs = _font(F_SEMI, 19)
    title = "PRESSURE"
    tw = d.textlength(title, font=fl)
    d.text(((w * s - tw) / 2 - 14 * s, 18 * s), title, font=fl, fill=(255, 255, 255, 255))
    # blinking up-arrow
    if int(t * 3.0) % 2 == 0 or lv > 0.85:
        ax, ay = (w * s + tw) / 2 + 6 * s, 26 * s
        d.polygon([(ax, ay + 20 * s), (ax + 22 * s, ay + 20 * s), (ax + 11 * s, ay)], fill=RED + (255,))
    d.text((cx - r - 6 * s, cy + 18 * s), "LOW", font=fs, fill=(200, 220, 255, 200))
    d.text((cx + r - 40 * s, cy + 18 * s), "HIGH", font=fs, fill=(255, 120, 100, 230))
    im = im.resize((w, h), Image.LANCZOS)
    if alpha < 1:
        im.putalpha(im.split()[3].point(lambda v: int(v * alpha)))
    return im


def _ramp(u):
    stops = [(0.0, (90, 200, 255)), (0.4, (255, 220, 70)), (0.7, (255, 140, 40)), (1.0, (255, 45, 35))]
    for (u0, c0), (u1, c1) in zip(stops, stops[1:]):
        if u <= u1:
            k = (u - u0) / (u1 - u0)
            return tuple(int(c0[i] + (c1[i] - c0[i]) * k) for i in range(3))
    return stops[-1][1]


def draw_temperature(t, alpha):
    w, h = 360, 190
    s = SS
    im = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * s - 1, h * s - 1], radius=26 * s, fill=(10, 8, 12, 150),
                        outline=(255, 120, 60, 120), width=2 * s)
    fl = _font(F_BOLD, 30)
    fs = _font(F_SEMI, 19)
    title = "TEMPERATURE"
    tw = d.textlength(title, font=fl)
    d.text(((w * s - tw) / 2 - 14 * s, 18 * s), title, font=fl, fill=(255, 255, 255, 255))
    if int(t * 3.0) % 2 == 0:
        ax, ay = (w * s + tw) / 2 + 6 * s, 26 * s
        d.polygon([(ax, ay + 20 * s), (ax + 22 * s, ay + 20 * s), (ax + 11 * s, ay)], fill=RED + (255,))
    # segmented bar
    x0, y0, x1, y1 = 30 * s, 82 * s, (w - 30) * s, 122 * s
    d.rounded_rectangle([x0, y0, x1, y1], radius=10 * s, outline=(255, 255, 255, 160), width=2 * s)
    lv = gauge_level("temperature", t)
    nseg = 18
    gap = 5 * s
    sw = (x1 - x0 - 12 * s - gap * (nseg - 1)) / nseg
    for i in range(nseg):
        u = (i + 0.5) / nseg
        if u > lv:
            break
        col = _ramp(0.35 + 0.65 * u)
        sx = x0 + 6 * s + i * (sw + gap)
        d.rounded_rectangle([sx, y0 + 7 * s, sx + sw, y1 - 7 * s], radius=4 * s, fill=col + (255,))
    d.text((x0, y1 + 12 * s), "COOLER", font=fs, fill=(200, 220, 255, 200))
    tw2 = d.textlength("HOTTER", font=fs)
    d.text((x1 - tw2, y1 + 12 * s), "HOTTER", font=fs, fill=(255, 120, 100, 230))
    im = im.resize((w, h), Image.LANCZOS)
    if alpha < 1:
        im.putalpha(im.split()[3].point(lambda v: int(v * alpha)))
    return im


def draw_gauges(frame, t):
    for g in TL.GAUGES:
        if not (g["t0"] <= t <= g["t1"]):
            continue
        a = smooth((t - g["t0"]) / 0.3) * smooth((g["t1"] - t) / 0.25)
        im = draw_pressure(t, a) if g["kind"] == "pressure" else draw_temperature(t, a)
        slide = (1 - ease_out((t - g["t0"]) / 0.35)) * -40
        frame.alpha_composite(im, (int(70 + slide), 1250))


# ----------------------------------------------------------------------------
# cutaway labels (shot 6B)
# ----------------------------------------------------------------------------
def draw_cutaway_labels(frame, t, geom):
    c = TL.CUTAWAY_LABELS
    if not (c["t0"] <= t <= c["t1"]) or geom is None:
        return
    a = smooth((t - c["t0"]) / 0.3) * smooth((c["t1"] - t) / 0.25)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # tag
    ft = ImageFont.truetype(F_BOLD, 34)
    tag = "ILLUSTRATIVE CUTAWAY"
    tw = d.textlength(tag, font=ft)
    tx, ty = (W - tw) / 2, geom["tag_y"]
    d.rounded_rectangle([tx - 26, ty - 14, tx + tw + 26, ty + 52], radius=30, fill=(10, 8, 12, 150),
                        outline=ORANGE + (230,), width=3)
    d.text((tx, ty), tag, font=ft, fill=WHITE + (255,))
    # arrow from the cloud tops toward the centre
    (x0, y0), (x1, y1) = geom["arrow"]
    k = ease_out((t - c["t0"] - 0.15) / 0.6)
    xe, ye = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
    d.line([(x0, y0), (xe, ye)], fill=WHITE + (255,), width=7)
    ang = math.atan2(ye - y0, xe - x0)
    hl = 30
    d.polygon([(xe + math.cos(ang) * 8, ye + math.sin(ang) * 8),
               (xe - math.cos(ang - 0.5) * hl, ye - math.sin(ang - 0.5) * hl),
               (xe - math.cos(ang + 0.5) * hl, ye - math.sin(ang + 0.5) * hl)], fill=WHITE + (255,))
    fl = ImageFont.truetype(F_BLACK, 54)
    lx, ly = geom["label"]
    for i, (line, col) in enumerate((("DENSER & HOTTER", ORANGE), ("WITH DEPTH", WHITE))):
        lw = d.textlength(line, font=fl)
        d.text((lx - lw / 2, ly + i * 60), line, font=fl, fill=col + (255,))
    sh = layer.copy()
    sh_a = sh.split()[3].filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.7))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow.putalpha(sh_a)
    out = Image.alpha_composite(shadow, layer)
    if a < 1:
        out.putalpha(out.split()[3].point(lambda v: int(v * a)))
    frame.alpha_composite(out)


def cutaway_geometry():
    """Screen positions for the cutaway labels, from the render camera."""
    try:
        import render
        return render.cutaway_label_geometry()
    except Exception as e:  # labels are optional decoration
        print("cutaway geometry unavailable:", e)
        return None


# ----------------------------------------------------------------------------
class Overlay:
    def __init__(self):
        self.captions = Captions()
        self.geom = cutaway_geometry()

    def apply(self, rgb, t):
        frame = Image.fromarray(rgb).convert("RGBA")
        draw_gauges(frame, t)
        draw_cutaway_labels(frame, t, self.geom)
        self.captions.draw(frame, t)
        return np.asarray(frame.convert("RGB"))


def compose(build_dir, out_path, wav, bitrate="7500k"):
    """Overlay every rendered shot into a lossless composite, then two-pass H.264 + AAC."""
    shots = [s[0] for s in TL.SHOTS]
    srcs = [os.path.join(build_dir, s + ".mkv") for s in shots]
    for s in srcs:
        if not os.path.exists(s):
            raise SystemExit("missing " + s)
    inter = os.path.join(build_dir, "composite.mkv")
    ov = Overlay()
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", "%dx%d" % (W, H), "-r", str(TL.FPS), "-i", "-",
                            "-c:v", "libx264rgb", "-qp", "0", "-preset", "ultrafast", inter], stdin=subprocess.PIPE)
    n = 0
    fsz = W * H * 3
    for src in srcs:
        dec = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                               stdout=subprocess.PIPE)
        while True:
            buf = dec.stdout.read(fsz)
            if len(buf) < fsz:
                break
            rgb = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            enc.stdin.write(ov.apply(rgb, n / TL.FPS).tobytes())
            n += 1
            if n % 90 == 0:
                print("composited %d/%d" % (n, TL.N_FRAMES), flush=True)
        dec.wait()
    enc.stdin.close()
    enc.wait()
    if n != TL.N_FRAMES:
        raise SystemExit("expected %d frames, got %d" % (TL.N_FRAMES, n))

    log = os.path.join(build_dir, "x264pass")
    video = ["-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
             "-c:v", "libx264", "-preset", "slow", "-b:v", bitrate, "-maxrate", "12M", "-bufsize", "18M",
             "-profile:v", "high", "-level", "4.2", "-g", "60", "-bf", "2", "-passlogfile", log,
             "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", inter] + video + ["-pass", "1", "-an", "-f", "null", "-"])
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", inter, "-i", wav, "-map", "0:v", "-map", "1:a"]
                          + video + ["-pass", "2", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                                     "-t", "%.3f" % TL.DURATION, "-movflags", "+faststart", out_path])
    print("frames:", n, "->", out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--compose", action="store_true")
    ap.add_argument("--build", default=os.path.join(HERE, "build"))
    ap.add_argument("--out", default=os.path.join(HERE, "output", "what-if-you-fell-into-jupiter.mp4"))
    ap.add_argument("--wav", default=os.path.join(HERE, "output", "soundtrack.wav"))
    ap.add_argument("--bitrate", default="7500k")
    ap.add_argument("--still", nargs=2, metavar=("PNG", "TIME"))
    ap.add_argument("--still-out", default="")
    args = ap.parse_args()
    if args.still:
        png, t = args.still[0], float(args.still[1])
        rgb = np.asarray(Image.open(png).convert("RGB").resize((W, H)))
        out = Overlay().apply(rgb, t)
        fn = args.still_out or png.replace(".png", "_text.png")
        Image.fromarray(out).save(fn)
        print(fn)
    elif args.compose:
        compose(args.build, args.out, args.wav, args.bitrate)


if __name__ == "__main__":
    main()
