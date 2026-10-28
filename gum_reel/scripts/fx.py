"""2D cartoon FX, captions and watermark composited over the rendered frames.

python fx.py --frames DIR --out OUT.mp4 --audio mix.wav --size 1080x1920 [--step 1] [--sheet frames]
"""
import sys, os, json, math, argparse, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FPS = 30
FONT_XB = '/home/user/work/assets/fonts/Poppins-ExtraBold.ttf'
FONT_B = '/home/user/work/assets/fonts/Poppins-Bold.ttf'
FONT_BL = '/home/user/work/assets/fonts/Poppins-Black.ttf'
EV = json.load(open('/home/user/work/events.json'))
WORDS = json.load(open('/home/user/work/words.json'))
SHOTS = sorted(EV['shots'], key=lambda s: s['t0'])


def shot_at(t):
    for s in SHOTS:
        if s['t0'] <= t < s['t1'] + 1e-9:
            return s['name']
    return SHOTS[-1]['name']


def ease_back(u):
    u = min(max(u, 0.0), 1.0)
    c1 = 1.9; c3 = c1 + 1
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


@functools.lru_cache(maxsize=256)
def soft_disc(r, hard=0.55):
    """RGBA white disc with soft edge, radius r px."""
    r = max(int(r), 2)
    n = 2 * r + 1
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.sqrt(x * x + y * y) / r
    a = np.clip((1 - d) / (1 - hard), 0, 1) ** 1.5
    img = np.zeros((n, n, 4), np.uint8)
    img[..., :3] = 255
    img[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(img, 'RGBA')


def paste_tinted(layer, sprite, cx, cy, color, alpha):
    if alpha <= 0.003:
        return
    s = sprite.copy()
    arr = np.array(s)
    arr[..., 0] = color[0]; arr[..., 1] = color[1]; arr[..., 2] = color[2]
    arr[..., 3] = (arr[..., 3].astype(np.float32) * alpha).astype(np.uint8)
    s = Image.fromarray(arr, 'RGBA')
    layer.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2))) if (0 <= int(cx - s.width / 2) and 0 <= int(cy - s.height / 2)) else _paste_clip(layer, s, int(cx - s.width / 2), int(cy - s.height / 2))


def _paste_clip(layer, s, x, y):
    W, H = layer.size
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + s.width, W), min(y + s.height, H)
    if x1 <= x0 or y1 <= y0:
        return
    crop = s.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    layer.alpha_composite(crop, (x0, y0))


def star_poly(cx, cy, r, rot=0.0, pts=4, inner=0.28):
    P = []
    for i in range(pts * 2):
        a = rot + i * math.pi / pts
        rr = r if i % 2 == 0 else r * inner
        P.append((cx + rr * math.sin(a), cy - rr * math.cos(a)))
    return P


class FX:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.S = H / 1920.0

    def px(self, a):
        return a[0] * self.W, a[1] * self.H

    # ------------------------------------------------------------------
    def stink(self, L, t, e, A, rng_seed=1):
        a = A.get(e['anchor'])
        if a is None or a[2] <= 0:
            return
        mx, my = self.px(a)
        fb = A.get('face_box')
        scale = (fb[3] - fb[1]) * self.H / 0.55 if fb else 400 * self.S
        scale = float(np.clip(scale, 260 * self.S, 1300 * self.S))
        if fb:
            fx0, fy0, fx1, fy1 = fb[0] * self.W, fb[1] * self.H, fb[2] * self.W, fb[3] * self.H
            cxf, cyf = (fx0 + fx1) / 2, (fy0 + fy1) / 2
            hw, hh = (fx1 - fx0) / 2 * 0.8, (fy1 - fy0) / 2 * 0.8
        rng = np.random.default_rng(rng_seed)
        n = 170
        births = np.sort(rng.uniform(e['t0'], e['t1'] - 0.2, n))
        life = rng.uniform(1.0, 1.9, n)
        side = np.where(rng.uniform(size=n) < 0.5, -1.0, 1.0)
        ang = -np.pi / 2 + side * rng.uniform(0.35, 1.25, n)     # up and out to both sides
        spd = rng.uniform(0.55, 1.15, n)
        cmix = rng.uniform(0, 1, n)
        fade_all = 1 - smooth((t - (e['t1'] - 0.25)) / 0.25)
        for i in range(n):
            age = t - births[i]
            if age < 0 or age > life[i]:
                continue
            u = age / life[i]
            d = spd[i] * scale * (0.1 + 0.95 * (1 - (1 - u) ** 2))
            x = mx + math.cos(ang[i]) * d + 0.06 * scale * math.sin(age * 3 + i)
            y = my + math.sin(ang[i]) * d * 0.9 - 0.2 * scale * u
            r = scale * (0.045 + 0.2 * u ** 0.6)
            al = 0.78 * min(u / 0.08, 1) * (1 - u) ** 1.1 * fade_all
            if fb and abs(x - cxf) < hw and abs(y - cyf) < hh and u > 0.08:
                al *= 0.3
            col = (int(88 + 45 * cmix[i]), int(118 - 30 * cmix[i]), int(28 + 12 * cmix[i]))
            paste_tinted(L, soft_disc(int(r), 0.45), x, y, col, al)
        # dense pour right at the lips
        if e['t0'] + 0.05 < t < e['t1'] - 0.3:
            for k in range(6):
                ph = (t * 3 + k / 6) % 1.0
                x = mx + (k - 2.5) * 0.03 * scale * ph
                y = my - 0.12 * scale * ph
                paste_tinted(L, soft_disc(int(scale * (0.05 + 0.06 * ph)), 0.5), x, y, (100, 110, 35), 0.55 * (1 - ph) * fade_all)
        dr = ImageDraw.Draw(L)
        for k in range(4):
            ph = (t * 1.2 + k / 4) % 1.0
            x0 = mx + (k - 1.5) * 0.3 * scale
            y0 = my - 0.35 * scale - ph * 0.6 * scale
            al = int(230 * math.sin(ph * math.pi) * fade_all * min((t - e['t0']) / 0.3, 1))
            pts = [(x0 + 0.05 * scale * math.sin(j * 0.9 + t * 8 + k), y0 - j * 0.035 * scale) for j in range(9)]
            dr.line(pts, fill=(105, 175, 35, al), width=max(4, int(0.024 * scale)), joint='curve')

    def lump(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None or a[2] <= 0:
            return
        cx, cy = self.px(a)
        R = 70 * self.S
        al = int(230 * min((t - e['t0']) / 0.08, 1) * (1 - smooth((t - e['t1'] + 0.12) / 0.12)))
        d = ImageDraw.Draw(L)
        for sx in (-1, 1):
            d.arc((cx - R * 1.25, cy - R, cx + R * 1.25, cy + R), 300 if sx > 0 else 120, 360 if sx > 0 else 180,
                  fill=(255, 255, 255, al), width=max(3, int(7 * self.S)))
        for k in range(3):
            yy = cy - R * (1.4 + 0.35 * k)
            d.line([(cx - R * 0.5, yy), (cx + R * 0.5, yy)], fill=(255, 255, 255, int(al * (0.8 - 0.2 * k))), width=max(2, int(5 * self.S)))

    def stinklines(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        mx, my = self.px(a)
        dr = ImageDraw.Draw(L)
        s = 260 * self.S * e.get('strength', 1.0) * 2
        for k in range(3):
            ph = (t * 1.1 + k / 3) % 1.0
            x0 = mx + (k - 1) * 0.35 * s
            y0 = my - ph * 0.9 * s
            al = int(220 * math.sin(ph * math.pi) * min((t - e['t0']) / 0.2, 1))
            pts = [(x0 + 0.08 * s * math.sin(j * 0.9 + t * 8 + k), y0 - j * 0.05 * s) for j in range(9)]
            dr.line(pts, fill=(110, 190, 40, al), width=max(4, int(10 * self.S)), joint='curve')

    def poop(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px((a[0] + e.get('dx', 0), a[1] + e.get('dy', 0)))
        u = (t - e['t0']) / 0.28
        sc = ease_back(u) * (1 + 0.04 * math.sin(t * 9))
        if sc <= 0.01:
            return
        R = 120 * self.S * sc
        img = Image.new('RGBA', (int(R * 3), int(R * 3.2)), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        ox, oy = img.width / 2, img.height * 0.62
        brown, dark, light = (125, 72, 32, 255), (60, 32, 12, 255), (170, 105, 55, 255)
        ow = max(2, int(R * 0.06))
        tiers = [(0.0, 0.42, 1.05, 0.42), (-0.48, 0.32, 0.82, 0.34), (-0.88, 0.24, 0.56, 0.28)]
        for (dy, _, w, h) in tiers:
            box = (ox - w * R, oy + dy * R - h * R, ox + w * R, oy + dy * R + h * R)
            d.ellipse(box, fill=brown, outline=dark, width=ow)
        d.polygon([(ox - 0.25 * R, oy - 1.02 * R), (ox + 0.25 * R, oy - 1.02 * R), (ox + 0.12 * R, oy - 1.45 * R)], fill=brown)
        d.ellipse((ox - 0.3 * R, oy - 1.22 * R, ox + 0.3 * R, oy - 0.92 * R), fill=brown)
        for (dy, _, w, h) in tiers:
            d.arc((ox - w * R * 0.7, oy + dy * R - h * R * 0.75, ox + w * R * 0.2, oy + dy * R + h * R * 0.3), 200, 260, fill=light, width=max(2, int(R * 0.07)))
        # cute face
        for sx in (-1, 1):
            ex, ey = ox + sx * 0.32 * R, oy - 0.05 * R
            d.ellipse((ex - 0.17 * R, ey - 0.2 * R, ex + 0.17 * R, ey + 0.2 * R), fill=(255, 255, 255, 255), outline=dark, width=max(1, ow // 2))
            d.ellipse((ex - 0.08 * R + sx * 0.02 * R, ey - 0.06 * R, ex + 0.08 * R + sx * 0.02 * R, ey + 0.12 * R), fill=(20, 10, 5, 255))
        d.arc((ox - 0.35 * R, oy + 0.02 * R, ox + 0.35 * R, oy + 0.42 * R), 20, 160, fill=dark, width=max(2, int(R * 0.07)))
        img = img.rotate(8 * math.sin(t * 7), resample=Image.BICUBIC, expand=False)
        sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
        sh.putalpha(img.getchannel('A').point(lambda v: int(v * 0.45)))
        sh = sh.filter(ImageFilter.GaussianBlur(R * 0.08))
        _paste_clip(L, sh, int(cx - img.width / 2 + R * 0.05), int(cy - img.height / 2 + R * 0.08))
        _paste_clip(L, img, int(cx - img.width / 2), int(cy - img.height / 2))
        # stink lines around the poop
        dr = ImageDraw.Draw(L)
        for k in range(3):
            ph = (t * 1.3 + k / 3) % 1.0
            x0 = cx + (k - 1) * 0.6 * R
            y0 = cy - 1.3 * R - ph * 0.9 * R
            al = int(220 * math.sin(ph * math.pi))
            pts = [(x0 + 0.12 * R * math.sin(j * 1.1 + t * 9 + k), y0 - j * 0.09 * R) for j in range(8)]
            dr.line(pts, fill=(120, 185, 40, al), width=max(3, int(R * 0.07)), joint='curve')

    def sparkle(self, L, t, e, A, color=(255, 255, 255)):
        a = A.get(e.get('anchor', ''))
        if a is None:
            cx, cy = self.px((e.get('x', 0.5), e.get('y', 0.5)))
        else:
            cx, cy = self.px((a[0] + e.get('dx', 0), a[1] + e.get('dy', 0)))
        n = e.get('count', 3)
        rng = np.random.default_rng(int(e['t0'] * 100))
        size = e.get('size', 1.0) * 60 * self.S
        for i in range(n):
            delay = i * 0.07
            u = (t - e['t0'] - delay) / max(e['t1'] - e['t0'] - delay, 0.1)
            if u < 0 or u > 1:
                continue
            ox = rng.uniform(-1, 1) * size * (1.3 if i else 0)
            oy = rng.uniform(-1, 1) * size * (1.1 if i else 0)
            s_ = size * (1.0 if i == 0 else rng.uniform(0.45, 0.8)) * ease_back(u * 4) * (1 - smooth((u - 0.65) / 0.35))
            s_ *= 1 + 0.15 * math.sin(t * 25 + i)
            if s_ < 1:
                continue
            x, y = cx + ox, cy + oy
            glow = soft_disc(int(s_ * 1.1), 0.0)
            paste_tinted(L, glow, x, y, color, 0.55)
            d = ImageDraw.Draw(L)
            d.polygon(star_poly(x, y, s_, rot=0.3 * math.sin(t * 3 + i)), fill=(*color, 255))

    def dizzy(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None or a[2] <= 0:
            return
        cx, cy = self.px(a)
        R = 45 * self.S
        d = ImageDraw.Draw(L)
        for k in range(3):
            ang = t * 7 + k * 2 * math.pi / 3
            x, y = cx + R * 1.3 * math.cos(ang), cy - R * 0.9 + R * 0.45 * math.sin(ang)
            d.polygon(star_poly(x, y, R * 0.42, rot=t * 3, pts=5, inner=0.45), fill=(255, 220, 40, 255), outline=(120, 80, 0, 255))

    def sweat(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px((a[0] + e.get('dx', 0), a[1] + e.get('dy', 0)))
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        cy += u * 60 * self.S
        R = 26 * self.S * ease_back(min(u * 5, 1))
        if R < 1:
            return
        d = ImageDraw.Draw(L)
        d.polygon([(cx, cy - 2.2 * R), (cx - R * 0.95, cy - 0.2 * R), (cx + R * 0.95, cy - 0.2 * R)], fill=(120, 200, 255, 235))
        d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(120, 200, 255, 235))
        d.ellipse((cx - R * 0.45, cy - R * 0.5, cx - R * 0.05, cy - R * 0.05), fill=(255, 255, 255, 230))

    def poof(self, L, t, e, A):
        cx, cy = self.px((e.get('x', 0.5), e.get('y', 0.5)))
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        size = e.get('size', 1.0) * 620 * self.S
        rng = np.random.default_rng(7)
        n = 26
        grow = ease_back(min(u * 2.2, 1))
        fade = 1 - smooth((u - 0.45) / 0.55)
        for i in range(n):
            ang = rng.uniform(0, 2 * math.pi)
            dist = rng.uniform(0.0, 0.75) * size * (0.4 + 0.8 * grow)
            r = size * rng.uniform(0.22, 0.38) * grow * (1 - 0.5 * smooth((u - 0.5) / 0.5))
            if r < 2:
                continue
            x, y = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * 0.85
            paste_tinted(L, soft_disc(int(r * 1.05), 0.82), x + r * 0.08, y + r * 0.1, (190, 200, 215), 0.9 * fade)
            paste_tinted(L, soft_disc(int(r), 0.85), x, y, (255, 255, 255), 0.97 * fade)

    def breath(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        mx, my = self.px(a)
        rng = np.random.default_rng(3)
        n = 40
        births = np.sort(rng.uniform(e['t0'], e['t1'] - 0.1, n))
        d = ImageDraw.Draw(L)
        for i in range(n):
            age = t - births[i]
            if age < 0 or age > 0.7:
                continue
            u = age / 0.7
            x = mx + (180 + 520 * u) * self.S * (0.6 + 0.4 * math.cos(i)) * 0.9
            y = my - 60 * self.S * u + 70 * self.S * math.sin(i * 1.7) * u + 25 * self.S * math.sin(age * 10 + i)
            x -= 120 * self.S
            if i % 3 == 0:
                s_ = 22 * self.S * (1 - u) * (1 + 0.3 * math.sin(age * 20))
                paste_tinted(L, soft_disc(int(s_ * 1.3), 0.0), x, y, (190, 235, 255), 0.6 * (1 - u))
                d.polygon(star_poly(x, y, s_, rot=age * 4), fill=(255, 255, 255, int(255 * (1 - u))))
            else:
                r = 14 * self.S * (0.5 + u)
                paste_tinted(L, soft_disc(int(r), 0.5), x, y, (170, 225, 255), 0.55 * (1 - u))

    def cough(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        mx, my = self.px(a)
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        for k in range(5):
            ang = -0.4 + 0.25 * k
            d = (40 + 180 * u) * self.S * (0.8 + 0.1 * k)
            r = (20 + 50 * u) * self.S
            paste_tinted(L, soft_disc(int(r), 0.6), mx + math.cos(ang) * d * 0.6 - 30 * self.S, my + math.sin(ang) * d * 0.4 + 30 * self.S,
                         (235, 235, 230), 0.75 * (1 - u))

    def check(self, L, t, e, A):
        cx, cy = self.px((e['x'], e['y']))
        sc = ease_back((t - e['t0']) / 0.15)
        R = 70 * self.S * sc
        if R < 2:
            return
        d = ImageDraw.Draw(L)
        d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=(60, 200, 90, 255), outline=(255, 255, 255, 255), width=max(2, int(R * 0.12)))
        d.line([(cx - R * 0.45, cy + R * 0.02), (cx - R * 0.1, cy + R * 0.38), (cx + R * 0.5, cy - R * 0.38)], fill=(255, 255, 255, 255),
               width=max(3, int(R * 0.2)), joint='curve')

    def zzz(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px((a[0] + e.get('dx', 0), a[1] + e.get('dy', 0)))
        for k in range(3):
            u = ((t - e['t0']) * 0.9 - k * 0.3)
            if u < 0 or u > 1:
                continue
            sz = int((30 + 40 * u) * self.S)
            f = ImageFont.truetype(FONT_XB, max(sz, 8))
            x = cx + 60 * self.S * u + 15 * self.S * math.sin(u * 6)
            y = cy - 150 * self.S * u
            d = ImageDraw.Draw(L)
            d.text((x, y), 'z', font=f, fill=(255, 255, 255, int(255 * math.sin(u * math.pi))), stroke_width=max(2, sz // 10),
                   stroke_fill=(40, 40, 60, int(220 * math.sin(u * math.pi))), anchor='mm')

    def sigh(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px(a)
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        d = ImageDraw.Draw(L)
        f = ImageFont.truetype(FONT_XB, int(46 * self.S))
        al = int(255 * min(u * 4, 1) * (1 - smooth((u - 0.7) / 0.3)))
        d.text((cx + 40 * self.S, cy - 90 * self.S - 30 * self.S * u), '...', font=f, fill=(255, 255, 255, al), stroke_width=3,
               stroke_fill=(30, 30, 30, al), anchor='mm')

    def speedlines(self, L, t, e, A):
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        rng = np.random.default_rng(5)
        d = ImageDraw.Draw(L)
        for i in range(26):
            x = rng.uniform(0.05, 0.95) * self.W
            ph = (u * 2.5 + rng.uniform(0, 1)) % 1.0
            y1 = self.H * (1.1 - ph * 1.4)
            ln = rng.uniform(0.15, 0.35) * self.H
            al = int(200 * math.sin(min(u, 1) * math.pi))
            d.line([(x, y1), (x, y1 + ln)], fill=(255, 255, 255, al), width=max(2, int(rng.uniform(3, 7) * self.S)))

    def question(self, L, t, e, A):
        f = ImageFont.truetype(FONT_XB, int(80 * self.S))
        d = ImageDraw.Draw(L)
        for k, n in enumerate(e['anchors']):
            a = A.get(n)
            if a is None or a[2] <= 0:
                continue
            cx, cy = self.px(a)
            sc = ease_back((t - e['t0'] - 0.08 * k) / 0.2)
            if sc <= 0.05:
                continue
            fs = ImageFont.truetype(FONT_XB, max(8, int(80 * self.S * sc)))
            d.text((cx, cy - 70 * self.S + 6 * self.S * math.sin(t * 8 + k)), '?', font=fs, fill=(255, 255, 255, 255), stroke_width=max(2, int(5 * self.S)),
                   stroke_fill=(30, 30, 50, 255), anchor='mm')

    def pop(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px(a)
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        d = ImageDraw.Draw(L)
        R = 520 * self.S * (0.4 + 0.8 * smooth(u * 1.5))
        al = int(255 * (1 - smooth((u - 0.3) / 0.7)))
        for k in range(14):
            ang = k * 2 * math.pi / 14 + 0.2
            r0, r1 = R * 0.55, R * (0.85 + 0.15 * (k % 2))
            d.line([(cx + r0 * math.cos(ang), cy + r0 * math.sin(ang)), (cx + r1 * math.cos(ang), cy + r1 * math.sin(ang))],
                   fill=(255, 255, 255, al), width=max(3, int(12 * self.S)))
        rng = np.random.default_rng(9)
        for k in range(24):
            ang = rng.uniform(0, 2 * math.pi); sp = rng.uniform(0.4, 1.0)
            dist = R * sp * (0.3 + 1.2 * u)
            x, y = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist + 300 * self.S * u * u
            r = rng.uniform(10, 26) * self.S * (1 - 0.6 * u)
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 110, 175, al))

    def dust(self, L, t, e, A):
        a = A.get(e['anchor'])
        if a is None:
            return
        cx, cy = self.px(a)
        cy += 90 * self.S
        u = (t - e['t0']) / (e['t1'] - e['t0'])
        for k in range(10):
            sx = -1 if k % 2 else 1
            d = (60 + 380 * smooth(u)) * self.S * (0.5 + 0.12 * k)
            r = (40 + 70 * u) * self.S * (0.8 + 0.05 * k)
            paste_tinted(L, soft_disc(int(r), 0.5), cx + sx * d, cy - 30 * self.S * u * (k % 3), (190, 165, 125), 0.7 * (1 - u))

    def confetti(self, L, t, e, A):
        rng = np.random.default_rng(12)
        n = 170
        cols = [(255, 80, 120), (255, 205, 50), (70, 200, 255), (120, 230, 90), (190, 110, 255), (255, 140, 40), (255, 255, 255)]
        d = ImageDraw.Draw(L)
        for i in range(n):
            mode = i % 2
            tb = e['t0'] + (rng.uniform(0, 0.12) if mode == 0 else rng.uniform(0.0, 1.6))
            age = t - tb
            if age < 0:
                rng.uniform(size=8)
                continue
            if mode == 0:     # burst from bottom centre
                vx = rng.uniform(-1.0, 1.0) * self.W * 0.9
                vy = -rng.uniform(1.1, 1.9) * self.H
                x = self.W * 0.5 + vx * age
                y = self.H * 0.78 + vy * age + 0.5 * 2.6 * self.H * age * age
                y = min(y, y)
                vy_now = vy + 2.6 * self.H * age
                if vy_now > 0.25 * self.H:   # drag: flutter down
                    tt = (vy_now - 0.25 * self.H) / (2.6 * self.H)
                    y -= 0.5 * 2.6 * self.H * tt * tt
            else:
                x = rng.uniform(0, 1) * self.W + 40 * self.S * math.sin(age * 3 + i)
                y = -40 * self.S + age * rng.uniform(0.18, 0.3) * self.H
            rot = age * rng.uniform(3, 9) + i
            w = rng.uniform(14, 26) * self.S
            h = rng.uniform(7, 12) * self.S * abs(math.cos(age * rng.uniform(4, 10) + i))
            c = cols[int(rng.integers(0, len(cols)))]
            rest = rng.uniform(size=2)
            if y > self.H + 40 or x < -40 or x > self.W + 40:
                continue
            ca, sa = math.cos(rot), math.sin(rot)
            pts = [(x + ca * dx - sa * dy, y + sa * dx + ca * dy) for dx, dy in ((-w, -h), (w, -h), (w, h), (-w, h))]
            d.polygon(pts, fill=(*c, 255))

    def draw(self, L, t, A):
        for e in EV['fx']:
            if e['t0'] <= t < e['t1']:
                k = e['kind']
                if k == 'sparkle':
                    self.sparkle(L, t, e, A)
                else:
                    getattr(self, k)(L, t, e, A)


# ---------------------------------------------------------------------- captions
CHUNK_SIZES = [2, 2, 1, 3, 2, 3, 3, 3, 2, 2, 2, 3, 2, 1, 1, 2, 2, 3, 1, 3, 3, 2, 3, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2,
               2, 2, 2, 3, 3, 3, 2, 3, 1, 1, 2, 2, 2, 2, 2, 3]


def build_chunks():
    words = []
    for w in WORDS:
        txt = w['text']
        if txt.upper().startswith('SHIT'):
            txt = 'SH*T!'
        words.append(dict(text=txt, start=w['start'], end=w['end']))
    for w in words:                      # audible onset of WHOOSH (silence ends at 31.46)
        if w['text'].startswith('WHOOSH'):
            w['start'] = 31.46
    assert sum(CHUNK_SIZES) == len(words), (sum(CHUNK_SIZES), len(words))
    chunks, i = [], 0
    for n in CHUNK_SIZES:
        chunks.append(words[i:i + n]); i += n
    out = []
    for i, c in enumerate(chunks):
        t0 = c[0]['start'] - 0.03
        t1 = chunks[i + 1][0]['start'] - 0.03 if i + 1 < len(chunks) else c[-1]['end'] + 0.8
        t1 = min(t1, c[-1]['end'] + 0.6)
        out.append(dict(text=' '.join(w['text'] for w in c), t0=max(t0, 0), t1=t1, big=c[0]['text'] in ('SH*T!', 'WHOOSH!')))
    return out


CHUNKS = build_chunks()


@functools.lru_cache(maxsize=64)
def caption_sprite(text, size, big):
    f = ImageFont.truetype(FONT_XB, size)
    pad = int(size * 0.6)
    bb = f.getbbox(text, stroke_width=max(2, size // 20))
    w, h = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pos = (pad - bb[0], pad - bb[1])
    # soft shadow
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.text((pos[0] + size * 0.04, pos[1] + size * 0.07), text, font=f, fill=(0, 0, 0, 200), stroke_width=max(2, size // 14), stroke_fill=(0, 0, 0, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(size * 0.09))
    img.alpha_composite(sh)
    d.text(pos, text, font=f, fill=(255, 255, 255, 255), stroke_width=max(2, size // 22), stroke_fill=(25, 25, 30, 255))
    return img


def draw_caption(frame, t, A, W, H):
    S = H / 1920.0
    for c in CHUNKS:
        if c['t0'] <= t < c['t1']:
            size = int((96 if c['big'] else 66) * S)
            spr = caption_sprite(c['text'], size, c['big'])
            u = (t - c['t0']) / 0.1
            sc = 0.8 + 0.2 * smooth(u)
            if c['big']:
                sc *= 1 + 0.08 * math.sin(min(u, 3) * math.pi)
            sp = spr.resize((max(1, int(spr.width * sc)), max(1, int(spr.height * sc))), Image.BICUBIC) if sc != 1 else spr
            cy = 0.58 * H
            fb = A.get('face_box') if A else None
            h2 = sp.height * 0.32
            if fb:
                fy0, fy1 = fb[1] * H, fb[3] * H
                fx0, fx1 = fb[0] * W, fb[2] * W
                overlaps = (cy + h2 > fy0) and (cy - h2 < fy1) and not (fx1 < W * 0.5 - sp.width / 2 or fx0 > W * 0.5 + sp.width / 2)
                if overlaps:
                    below = fy1 + h2 + 20 * S
                    above = fy0 - h2 - 20 * S
                    if below < 0.82 * H:
                        cy = max(below, 0.58 * H)
                    elif above > 0.12 * H:
                        cy = above
                    else:
                        cy = 0.82 * H
            frame.alpha_composite(sp, (int(W / 2 - sp.width / 2), int(cy - sp.height / 2)))
            return


@functools.lru_cache(maxsize=4)
def watermark(W, H):
    S = H / 1920.0
    f = ImageFont.truetype(FONT_B, int(34 * S))
    text = '@garden_reels1o'
    bb = f.getbbox(text)
    img = Image.new('RGBA', (bb[2] + 8, bb[3] + 8), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4 - bb[0], 4), text, font=f, fill=(255, 255, 255, 128))
    return img


# ---------------------------------------------------------------------- main
def load_anchors(d):
    A = {}
    ad = os.path.join(d, 'anchors')
    if os.path.isdir(ad):
        for fn in os.listdir(ad):
            for k, v in json.load(open(os.path.join(ad, fn))).items():
                A[int(k)] = v
    return A


def nearest_frame(fr, f, step):
    if os.path.exists(f'{fr}/f_{f:05d}.png'):
        return f
    for d in range(1, step + 3):
        for g in (f - d, f + d):
            if os.path.exists(f'{fr}/f_{g:05d}.png'):
                return g
    return None


def compose(fr, f, W, H, ANC, fx, step=1):
    g = nearest_frame(fr, f, step)
    if g is None:
        img = Image.new('RGB', (W, H), (0, 0, 0))
    else:
        img = Image.open(f'{fr}/f_{g:05d}.png').convert('RGB')
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
            img = img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=45, threshold=2))
    t = f / FPS
    A = ANC.get(f) or ANC.get(g) or {}
    frame = img.convert('RGBA')
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fx.draw(L, t, A)
    frame.alpha_composite(L)
    draw_caption(frame, t, A, W, H)
    wm = watermark(W, H)
    frame.alpha_composite(wm, (int(W - wm.width - 28 * H / 1920), int(H - wm.height - 40 * H / 1920)))
    return frame.convert('RGB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--audio', default='')
    ap.add_argument('--size', default='1080x1920')
    ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--only', default='')
    ap.add_argument('--png_dir', default='')
    args = ap.parse_args()
    W, H = map(int, args.size.split('x'))
    ANC = load_anchors(args.frames)
    fx = FX(W, H)
    NF = int(round(SHOTS[-1]['t1'] * FPS))
    if args.only:
        os.makedirs(args.png_dir, exist_ok=True)
        for f in [int(x) for x in args.only.split(',')]:
            compose(args.frames, f, W, H, ANC, fx, args.step).save(f'{args.png_dir}/c_{f:05d}.png')
        sys.exit(0)
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
    if args.audio:
        cmd += ['-i', args.audio, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000']
    cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', args.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(NF):
        fr = compose(args.frames, f, W, H, ANC, fx, args.step)
        p.stdin.write(fr.tobytes())
        if f % 60 == 0:
            print('frame', f, flush=True)
    p.stdin.close()
    p.wait()
    print('wrote', args.out)
