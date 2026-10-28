"""Composite captions, 2D cartoon effects and the watermark onto rendered frames.

usage: python3 overlay.py <frames_dir> <out_dir> <words.json> [W H] [frame_step]
Reads f_XXXXX.png + f_XXXXX.json (overlay anchors) and writes o_XXXXX.png at W x H.
"""
import os
import sys
import json
import math
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(os.path.dirname(HERE), 'assets', 'fonts', 'Poppins-ExtraBold.ttf')

SCRIPT = ("Your neighbor caught you pooping behind a bush... AGAIN! "
          "But you're a genius old man, so you dig a hole far away from everyone. "
          "But now it stinks so bad, even the flies are crying, "
          "so you cover it with leaves. Clever! "
          "Except the wind blows them away, and you almost fall in, "
          "so you build a wooden seat over the hole. Much better! "
          "But the smell still comes back, so you pour water to wash it all away. "
          "But carrying water from the river breaks your old back, "
          "so you build a tank above the seat, with a rope that dumps the water down. "
          "But the tank keeps running empty, "
          "so you connect it to a giant waterfall. WHOOSH! "
          "Congratulations, genius old man! You invented the toilet. "
          "Now go wash your hands.").split()
BIG = {'AGAIN!', 'WHOOSH!'}
SOLO = {'AGAIN!', 'WHOOSH!', 'Clever!'}


def build_chunks(words):
    """group words into 1-3 word captions following the voice."""
    assert len(words) == len(SCRIPT), (len(words), len(SCRIPT))
    toks = [dict(text=SCRIPT[i], s=w['s'], e=w['e']) for i, w in enumerate(words)]
    chunks = []
    cur = []
    for i, tk in enumerate(toks):
        if tk['text'] in SOLO:
            if cur:
                chunks.append(cur); cur = []
            chunks.append([tk])
            continue
        cur.append(tk)
        end_punct = tk['text'][-1] in ',.!?' or tk['text'].endswith('...')
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        gap = (nxt['s'] - tk['e']) if nxt else 1.0
        if len(cur) >= 3 or end_punct or gap > 0.25 or (len(cur) == 2 and nxt and len(nxt['text']) > 9):
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)
    out = []
    for k, c in enumerate(chunks):
        s = c[0]['s']
        nxt_s = chunks[k + 1][0]['s'] if k + 1 < len(chunks) else c[-1]['e'] + 0.8
        e = min(nxt_s, c[-1]['e'] + 0.45)
        out.append(dict(text=' '.join(x['text'] for x in c), s=s, e=e, big=any(x['text'] in BIG for x in c)))
    return out


_font_cache = {}


def font(px):
    px = int(px)
    if px not in _font_cache:
        _font_cache[px] = ImageFont.truetype(FONT, px)
    return _font_cache[px]


def draw_caption(img, text, cx, cy, size, scale=1.0):
    """white bold text, thin dark outline, soft black shadow; centred at (cx, cy)."""
    W, H = img.size
    px = max(8, int(size * scale))
    f = font(px)
    stroke = max(1, int(round(px * 0.06)))
    tmp = Image.new('L', (1, 1))
    bbox = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=f, stroke_width=stroke)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = int(px * 0.6)
    layer = Image.new('RGBA', (tw + 2 * pad, th + 2 * pad), (0, 0, 0, 0))
    # shadow
    sh = Image.new('L', layer.size, 0)
    ImageDraw.Draw(sh).text((pad - bbox[0] + px * 0.04, pad - bbox[1] + px * 0.07), text, font=f, fill=200,
                            stroke_width=stroke)
    sh = sh.filter(ImageFilter.GaussianBlur(px * 0.08))
    shadow_rgba = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    shadow_rgba.putalpha(sh)
    layer = Image.alpha_composite(layer, shadow_rgba)
    d = ImageDraw.Draw(layer)
    d.text((pad - bbox[0], pad - bbox[1]), text, font=f, fill=(255, 255, 255, 255), stroke_width=stroke,
           stroke_fill=(25, 25, 30, 255))
    x0 = int(cx - layer.size[0] / 2)
    y0 = int(cy - layer.size[1] / 2)
    img.alpha_composite(layer, (max(-layer.size[0], x0), max(-layer.size[1], y0)))
    return (x0 + pad, y0 + pad, x0 + pad + tw, y0 + pad + th)


def star_points(cx, cy, r_out, r_in, n, rot=0.0):
    pts = []
    for i in range(2 * n):
        r = r_out if i % 2 == 0 else r_in
        a = rot + math.pi * i / n
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    return pts


def draw_sparkle(img, x, y, size_px, age, dur):
    u = age / dur
    if u < 0 or u > 1:
        return
    grow = min(1.0, u / 0.18)
    grow = 1 - (1 - grow) ** 3
    fade = 1.0 if u < 0.6 else max(0.0, 1 - (u - 0.6) / 0.4)
    s = size_px * (0.3 + 0.7 * grow) * (1.0 + 0.15 * math.sin(u * 12))
    if s < 2:
        return
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    rot = u * 0.6
    gd.polygon(star_points(x, y, s * 1.15, s * 0.22, 4, rot), fill=(255, 255, 255, int(150 * fade)))
    glow = glow.filter(ImageFilter.GaussianBlur(max(1, s * 0.12)))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.polygon(star_points(x, y, s, s * 0.16, 4, rot), fill=(255, 255, 255, int(255 * fade)))


def draw_pain(img, x, y, size_px, age, dur):
    u = age / dur
    if u < 0 or u > 1:
        return
    pop = min(1.0, u / 0.12)
    pop = 1 + 0.25 * math.sin(pop * math.pi) if pop < 1 else 1.0
    fade = 1.0 if u < 0.7 else max(0.0, 1 - (u - 0.7) / 0.3)
    s = size_px * min(1.0, u / 0.08) * pop
    if s < 3:
        return
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    a = int(255 * fade)
    d.polygon(star_points(x, y, s * 1.08, s * 0.58, 9, 0.2), fill=(255, 255, 255, a))
    d.polygon(star_points(x, y, s, s * 0.52, 9, 0.2), fill=(235, 40, 30, a))
    d.polygon(star_points(x, y, s * 0.55, s * 0.30, 9, 0.5), fill=(255, 210, 40, a))
    for k in range(6):
        ang = k * math.pi / 3 + 0.3
        r0, r1 = s * 1.25, s * 1.6
        d.line([(x + r0 * math.cos(ang), y + r0 * math.sin(ang)), (x + r1 * math.cos(ang), y + r1 * math.sin(ang))],
               fill=(255, 255, 255, a), width=max(2, int(s * 0.08)))
    img.alpha_composite(lay)


def draw_wind(img, yfrac, age, dur, seed):
    W, H = img.size
    u = age / dur
    if u < 0 or u > 1:
        return
    rng = np.random.RandomState(seed)
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    y0 = yfrac * H
    L = W * rng.uniform(0.35, 0.55)
    head = -L + (W + 2 * L) * u
    pts = []
    for k in range(24):
        xx = head - L * k / 23
        yy = y0 + math.sin(xx / W * 9 + seed) * H * 0.012
        pts.append((xx, yy))
    alpha = int(170 * math.sin(math.pi * u))
    for k in range(len(pts) - 1):
        a = int(alpha * (1 - k / 23))
        d.line([pts[k], pts[k + 1]], fill=(255, 255, 255, a), width=max(2, int(W * 0.006 * (1 - k / 30))))
    # small curl at the head
    r = W * 0.018
    d.arc([head - r, y0 - 2 * r, head + r, y0], 200, 520, fill=(255, 255, 255, alpha), width=max(2, int(W * 0.005)))
    img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(0.6)))


def draw_whoosh(img, age, dur):
    W, H = img.size
    u = age / dur
    if u < 0 or u > 1:
        return
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    rng = np.random.RandomState(3)
    a = int(200 * math.sin(math.pi * u))
    for k in range(14):
        y = H * rng.uniform(0.1, 0.9)
        x0 = W * rng.uniform(-0.2, 0.6) + W * 0.6 * u
        L = W * rng.uniform(0.2, 0.45)
        d.line([(x0, y), (x0 + L, y)], fill=(255, 255, 255, a), width=max(2, int(W * rng.uniform(0.004, 0.009))))
    img.alpha_composite(lay)


def watermark(img):
    W, H = img.size
    px = max(8, int(W * 0.030))
    f = font(px)
    text = '@garden_reels1o'
    bbox = ImageDraw.Draw(img).textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((W - tw - W * 0.04 - bbox[0], H - th - H * 0.03 - bbox[1]), text, font=f,
                             fill=(255, 255, 255, 128))
    img.alpha_composite(lay)


def composite(frame_png, meta, chunks, out_png, size=None, t_override=None):
    img = Image.open(frame_png).convert('RGBA')
    if size and img.size != tuple(size):
        img = img.resize(tuple(size), Image.LANCZOS)
    W, H = img.size
    sx = W / meta['res'][0]
    t = meta['t'] if t_override is None else t_override
    face = None
    for o in meta['overlays']:
        typ = o.get('type')
        if typ == 'face':
            face = (o['x'] * sx, o['y'] * sx, o.get('r', 0) * sx)
        elif typ == 'sparkle' and not o.get('behind'):
            if 'fpx' in o:
                spx = o['size'] * o['fpx'] / max(0.05, o['depth']) * sx
            else:
                spx = W * 0.075 * o['size'] / 0.1
            draw_sparkle(img, o['x'] * sx, o['y'] * sx, spx, o['age'], o['dur'])
        elif typ == 'pain' and not o.get('behind'):
            spx = (o['size'] * o['fpx'] / max(0.05, o['depth']) * sx) if 'fpx' in o else W * 0.14
            draw_pain(img, o['x'] * sx, o['y'] * sx, min(spx, W * 0.16), o['age'], o['dur'])
        elif typ == 'wind':
            draw_wind(img, o['y'], o['age'], o['dur'], o.get('seed', 0))
        elif typ == 'whoosh':
            draw_whoosh(img, o['age'], o['dur'])
    # captions
    for c in chunks:
        if c['s'] <= t < c['e']:
            age = t - c['s']
            sc = 0.8 + 0.2 * min(1.0, age / 0.1)
            size = W * (64 / 1080) * (1.3 if c['big'] else 1.0)
            cy = H * 0.58
            if face is not None:
                fx, fy, fr = face
                # keep the caption box off the face (try lower, then higher)
                if abs(cy - fy) < fr + size * 0.9:
                    cands = [fy + fr + size * 1.1, fy - fr - size * 1.1]
                    cands = [y for y in cands if H * 0.30 < y < H * 0.86]
                    if cands:
                        cy = min(cands, key=lambda y: abs(y - H * 0.58))
            draw_caption(img, c['text'], W / 2, cy, size, sc)
    watermark(img)
    img.convert('RGB').save(out_png, compress_level=1)


def main():
    fdir, odir, wjson = sys.argv[1], sys.argv[2], sys.argv[3]
    size = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else None
    os.makedirs(odir, exist_ok=True)
    words = json.load(open(wjson))
    chunks = build_chunks(words)
    with open(os.path.join(odir, 'chunks.json'), 'w') as fh:
        json.dump(chunks, fh, indent=1)
    files = sorted(glob.glob(os.path.join(fdir, 'f_*.png')))
    for fp in files:
        meta = json.load(open(fp[:-4] + '.json'))
        out = os.path.join(odir, 'o_' + os.path.basename(fp)[2:])
        composite(fp, meta, chunks, out, size)
    print('composited', len(files))


if __name__ == '__main__':
    main()
