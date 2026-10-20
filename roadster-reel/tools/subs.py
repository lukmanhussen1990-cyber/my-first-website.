#!/usr/bin/env python3
"""Word-by-word burned-in subtitles (rendered with Pillow).

Style: big bold rounded font (Fredoka Bold), white with a thick black rounded outline and a
soft drop shadow; each word pops in with a tiny spring bounce. John's line is yellow and a
little bigger. Placed a little above the middle of the frame, clear of Instagram's bottom
20% and right-edge buttons. Words are shown exactly as written in script.json."""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'assets', 'fonts', 'Fredoka-Bold.ttf')
W, H = 1080, 1920
BAND_Y0, BAND_H = 560, 440          # overlay band in the full frame
CENTER = (520, 780)                 # text centre (slightly left of middle, ~40.6% from top)
MAX_W = 800
STYLE = {
    'narrator': {'size': 124, 'fill': (255, 255, 255, 255)},
    'john': {'size': 146, 'fill': (255, 216, 64, 255)},
}


def load_words(placement_path=None):
    p = json.load(open(placement_path or os.path.join(ROOT, 'build', 'placement.json')))
    items = []
    for ln in p['lines']:
        ws = ln['words']
        for i, w in enumerate(ws):
            nxt = ws[i + 1]['start'] if i + 1 < len(ws) else None
            if nxt is not None and nxt - w['end'] < 0.6:
                end = nxt
            else:
                end = w['end'] + 0.35 if nxt is None else min(nxt, w['end'] + 0.35)
            items.append({'text': w['word'], 'start': w['start'], 'end': end, 'speaker': ln['speaker'], 'last': i == len(ws) - 1})
    return items


_font_cache = {}


def font(size):
    size = int(round(size))
    if size not in _font_cache:
        _font_cache[size] = ImageFont.truetype(FONT, size)
    return _font_cache[size]


def spring(a):
    if a <= 0:
        return 0.0
    return 1 - math.exp(-a / 0.045) * math.cos(2 * math.pi * a / 0.16) * 0.45


_cache = {}


def render_word(text, speaker, scale, alpha, yoff):
    key = (text, speaker, round(scale, 3), round(alpha, 2), int(round(yoff)))
    if key in _cache:
        return _cache[key]
    st = STYLE[speaker]
    base = st['size']
    f0 = font(base)
    stroke0 = max(6, int(base * 0.13))
    bw = f0.getbbox(text, stroke_width=stroke0)
    width = bw[2] - bw[0]
    fit = min(1.0, MAX_W / max(1, width))
    size = base * fit * scale
    f = font(max(8, size))
    stroke = max(3, int(round(size * 0.13)))
    img = Image.new('RGBA', (W, BAND_H), (0, 0, 0, 0))
    cx, cy = CENTER[0], CENTER[1] - BAND_Y0 + yoff
    # soft shadow
    sh = Image.new('RGBA', (W, BAND_H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((cx, cy + max(4, size * 0.07)), text, font=f, fill=(0, 0, 0, 255), anchor='mm', stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, size * 0.08)))
    a = sh.getchannel('A').point(lambda v: int(v * 0.55))
    sh.putalpha(a)
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img)
    d.text((cx, cy), text, font=f, fill=st['fill'], anchor='mm', stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    if alpha < 1:
        img.putalpha(img.getchannel('A').point(lambda v: int(v * alpha)))
    out = img.tobytes()
    _cache[key] = out
    return out


EMPTY = None


def frame_overlay(items, t):
    """RGBA bytes for the subtitle band at time t (seconds)"""
    global EMPTY
    for it in items:
        if it['start'] <= t < it['end']:
            a = t - it['start']
            s = spring(a)
            alpha = min(1.0, a / 0.04)
            if it['last']:
                out = it['end'] - t
                if out < 0.12:
                    k = out / 0.12; alpha *= k; s *= 0.85 + 0.15 * k
            yoff = 16 * (1 - min(1.0, s))
            return render_word(it['text'], it['speaker'], round(s, 3), alpha, yoff)
    if EMPTY is None:
        EMPTY = bytes(W * BAND_H * 4)
    return EMPTY


if __name__ == '__main__':
    # preview: composite subtitles on top of rendered stills  ->  build/subs_preview/
    import glob, sys
    items = load_words()
    os.makedirs(os.path.join(ROOT, 'build', 'subs_preview'), exist_ok=True)
    for path in sys.argv[1:]:
        t = float(os.path.basename(path).split('_')[1])
        bg = Image.open(path).convert('RGBA').resize((W, H))
        ov = Image.frombytes('RGBA', (W, BAND_H), frame_overlay(items, t))
        bg.alpha_composite(ov, (0, BAND_Y0))
        out = os.path.join(ROOT, 'build', 'subs_preview', os.path.basename(path))
        bg.convert('RGB').save(out); print(out)
