"""On-screen text: labels, science tags, callouts and word-highlight subtitles.

Every text element is drawn through `place`, which logs its bounding box so the
Instagram safe zones can be verified for every frame.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_DIR = "/usr/share/fonts/opentype/inter"
F_XB = os.path.join(FONT_DIR, "Inter-ExtraBold.otf")
F_B = os.path.join(FONT_DIR, "Inter-Bold.otf")
F_SB = os.path.join(FONT_DIR, "Inter-SemiBold.otf")

WHITE = (255, 255, 255)
ORANGE = (255, 159, 67)        # current-word highlight (warm orange)
AMBER = (255, 190, 92)         # key numbers
DARK = (11, 15, 36)
SUB_BLUE = (205, 226, 255)
TAG = {
    "ESTABLISHED": ((46, 196, 182), DARK),
    "ASSUMPTION": ((164, 140, 255), DARK),
    "UNCERTAIN": ((255, 184, 48), DARK),
    "EXAGGERATED": ((255, 92, 138), DARK),
    "POSSIBLE": ((255, 184, 48), DARK),
    "HYPOTHETICAL": ((164, 140, 255), DARK),
    "CERTAIN": ((46, 196, 182), DARK),
    "WHAT IF…?": ((255, 159, 67), DARK),
}

# Instagram-safe zone (1080x1920)
SAFE = dict(top=270, bottom=1920 - 420, left=64, right=1080 - 64, right_lower=1080 - 140)

_fonts = {}
_cache = {}
LOG = []          # (frame, name, x0, y0, x1, y1)
CURRENT_FRAME = [0]


def font(path, size):
    k = (path, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, size)
    return _fonts[k]


def _styled(draw_fn, w, h, outline, shadow, pad):
    """Render text via draw_fn(draw, ox, oy, fill_mode) with outline + soft shadow."""
    W, H = w + 2 * pad, h + 2 * pad
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(sh), pad, pad + shadow, "shadow")
        sh = sh.filter(ImageFilter.GaussianBlur(shadow * 0.9))
        base = Image.alpha_composite(base, sh)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lay), pad, pad, "main")
    return Image.alpha_composite(base, lay)


def text_img(runs_lines, size, path=F_XB, outline=5, shadow=6, line_gap=1.12, align="center"):
    """runs_lines: list of lines; each line is a list of (text, rgb). Returns RGBA PIL image."""
    key = ("t", json.dumps(runs_lines), size, path, outline, shadow, line_gap, align)
    if key in _cache:
        return _cache[key]
    f = font(path, size)
    asc, desc = f.getmetrics()
    lh = int(size * line_gap)
    widths = [sum(f.getlength(t) for t, _ in line) for line in runs_lines]
    w = int(max(widths) + 2 * outline + 2)
    h = int(lh * (len(runs_lines) - 1) + asc + desc + 2 * outline)
    pad = outline + (shadow * 2 if shadow else 0) + 2

    def draw(dr, ox, oy, mode):
        for li, line in enumerate(runs_lines):
            lw = widths[li]
            x = ox + outline + (0 if align == "left" else (w - 2 * outline - lw) / (2 if align == "center" else 1))
            y = oy + outline + li * lh
            for t, col in line:
                if mode == "shadow":
                    dr.text((x, y), t, font=f, fill=(0, 0, 0, 150), stroke_width=outline, stroke_fill=(0, 0, 0, 150))
                else:
                    dr.text((x, y), t, font=f, fill=tuple(col) + (255,), stroke_width=outline,
                            stroke_fill=DARK + (255,))
                x += f.getlength(t)

    im = _styled(draw, w, h, outline, shadow, pad)
    im.info["pad"] = pad
    _cache[key] = im
    return im


def tag_img(label, size=30):
    key = ("tag", label, size)
    if key in _cache:
        return _cache[key]
    bg, fg = TAG.get(label, ((255, 255, 255), DARK))
    f = font(F_XB, size)
    tw = f.getlength(label)
    asc, desc = f.getmetrics()
    padx, pady = int(size * 0.62), int(size * 0.32)
    w, h = int(tw + 2 * padx + size * 0.7), int(asc + desc * 0.4 + 2 * pady)
    im = Image.new("RGBA", (w + 8, h + 12), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([4, 8, 4 + w, 8 + h], radius=h // 2, fill=(0, 0, 0, 120))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(3)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, 4 + w, 4 + h], radius=h // 2, fill=bg + (255,), outline=DARK + (255,), width=3)
    r = size * 0.2
    cx, cy = 4 + padx + r * 0.6, 4 + h / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DARK + (255,))
    d.text((4 + padx + size * 0.7, 4 + pady - desc * 0.1), label, font=f, fill=fg + (255,))
    im.info["pad"] = 4
    _cache[key] = im
    return im


def ease_out_back(t, s=1.70158):
    t = min(max(t, 0.0), 1.0) - 1
    return t * t * ((s + 1) * t + s) + 1


def pop(t, t0, dur=0.32, t_out=None, out_dur=0.22):
    """(scale, alpha) for a cartoon pop-in / fade-out."""
    if t < t0:
        return 0.0, 0.0
    k = (t - t0) / dur
    s = 0.55 + 0.45 * ease_out_back(k)
    a = min(1.0, k * 2.5)
    if t_out is not None and t > t_out:
        k2 = min(1.0, (t - t_out) / out_dur)
        a *= 1 - k2
        s *= 1 - 0.08 * k2
    return s, a


def place(canvas, im, cx, cy, scale=1.0, alpha=1.0, name="text", anchor="center", log=True):
    """Composite a PIL RGBA image onto the float canvas, centred (or left-anchored) at (cx, cy)."""
    if alpha <= 0.003 or scale <= 0.01:
        return None
    if abs(scale - 1.0) > 1e-3:
        q = round(scale, 2)
        key = ("s", id(im), q)
        if key not in _cache:
            _cache[key] = im.resize((max(1, int(im.width * q)), max(1, int(im.height * q))), Image.BICUBIC)
            _cache[key].info["pad"] = im.info.get("pad", 0) * q
        im = _cache[key]
    w, h = im.size
    x0 = int(round(cx - (w / 2 if anchor == "center" else im.info.get("pad", 0))))
    y0 = int(round(cy - h / 2))
    arr = np.asarray(im).astype(np.float32) / 255.0
    H, W = canvas.shape[:2]
    xa, ya = max(x0, 0), max(y0, 0)
    xb, yb = min(x0 + w, W), min(y0 + h, H)
    if xb <= xa or yb <= ya:
        return None
    sub = arr[ya - y0:yb - y0, xa - x0:xb - x0]
    a = sub[..., 3:4] * alpha
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + sub[..., :3] * a
    if log and alpha > 0.05:
        # bounding box of visible (non-shadow) pixels
        m = sub[..., 3] > 0.35
        if m.any():
            ys, xs = np.nonzero(m)
            LOG.append((CURRENT_FRAME[0], name, int(xa + xs.min()), int(ya + ys.min()),
                        int(xa + xs.max()), int(ya + ys.max())))
    return (x0, y0, x0 + w, y0 + h)


# ------------------------------------------------------------ subtitles
KEY_NUMBERS = {"twice", "one", "million", "three-quarters", "several", "nine"}

PAGES = [
    ["This is Mars,"],
    ["rising beside our Moon."],
    ["It looks twice as wide."],
    ["The rule: a fast flyby"],
    ["at the Moon's distance."],
    ["No crash. Only physics."],
    ["Today, Mars is", "a tiny dot."],
    ["At one million", "kilometers,"],
    ["it looks three-quarters"],
    ["as wide as the Moon."],
    ["At Moon distance,", "it can outshine"],
    ["a full Moon", "several times over."],
    ["Mars has nearly", "nine times"],
    ["the Moon's mass,"],
    ["so its tides pull"],
    ["nearly nine", "times harder."],
    ["Oceans may rise", "several meters."],
    ["Gravity bends", "both paths."],
    ["Mars turns just over", "one degree."],
    ["Earth's year", "barely changes."],
    ["Certain: the gravity."],
    ["Uncertain:", "flood heights, quakes,"],
    ["and the Moon's fate."],
    ["Then Mars leaves."],
    ["Would you stay", "and watch,"],
    ["or move inland?"],
]
SUB_SIZE = 66
SUB_Y = 1350          # fixed vertical centre for every subtitle page
SUB_LEAD = 0.04       # show/highlight a word this much before its aligned onset


def build_pages(words):
    """Attach aligned word timings to PAGES. words: list of {word,start,end} in order."""
    pages, wi = [], 0
    for lines in PAGES:
        toks = [ln.split(" ") for ln in lines]
        n = sum(len(t) for t in toks)
        ws = words[wi:wi + n]
        assert [w["word"] for w in ws] == [x for t in toks for x in t], (lines, [w["word"] for w in ws])
        pages.append(dict(lines=toks, words=ws))
        wi += n
    assert wi == len(words), (wi, len(words))
    for i, p in enumerate(pages):
        p["t0"] = p["words"][0]["start"] - SUB_LEAD
        nxt = pages[i + 1]["words"][0]["start"] - SUB_LEAD if i + 1 < len(pages) else 99.0
        last_end = p["words"][-1]["end"]
        p["t1"] = nxt if nxt - last_end < 0.75 else last_end + 0.45
    pages[-1]["t1"] = 99.0          # final question stays up through the static last-frame hold
    return pages


def page_img(page, hi):
    runs_lines, k = [], 0
    for line in page["lines"]:
        runs = []
        for j, tok in enumerate(line):
            bare = tok.strip(",.:?").lower()
            col = ORANGE if k == hi else (AMBER if bare in KEY_NUMBERS else WHITE)
            runs.append((tok + (" " if j < len(line) - 1 else ""), col))
            k += 1
        runs_lines.append(runs)
    return text_img(runs_lines, SUB_SIZE, path=F_B, outline=5, shadow=7, line_gap=1.13)


def draw_subtitles(canvas, pages, t):
    for p in pages:
        if p["t0"] <= t < p["t1"]:
            hi = 0
            for j, w in enumerate(p["words"]):
                if t >= w["start"] - SUB_LEAD:
                    hi = j
            im = page_img(p, hi)
            a = min(1.0, (t - p["t0"]) / 0.08)
            place(canvas, im, 540, SUB_Y, 1.0, a, name="subtitle")
            return hi, p
    return None


def check_log(log=None):
    """Return a list of safe-zone violations from the bounding-box log."""
    bad = []
    for fr, name, x0, y0, x1, y1 in (log or LOG):
        right = SAFE["right_lower"] if y1 > 960 else SAFE["right"]
        if y0 < SAFE["top"] or y1 > SAFE["bottom"] or x0 < SAFE["left"] or x1 > right:
            bad.append((fr, name, x0, y0, x1, y1))
    return bad
