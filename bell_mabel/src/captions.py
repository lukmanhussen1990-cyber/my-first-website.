"""Torn-paper, word-by-word captions.

Text comes ONLY from the exact script (words.json produced by align.py);
whisper supplied the timing. Each phrase is laid out in its final position on
a torn cream strip and every word pops in (0.6 -> 1.05 -> 1.0, ~120 ms) at the
moment it is spoken.
"""
import json
import math

import skia

from engine import (C, W, H, torn_rect, paper, font, hash01, clamp, seg, eout, eio, lerp, xf, _blur,
                    noise1)

NAVY = 0x1F2A44
RED = 0xC0392B
FONT = 'Anton-Regular.ttf'
FSIZE = 72
LINE_H = 84
MAX_LINE_W = 600
PAD_X, PAD_Y = 46, 30
POP = 0.12

# phrase segmentation (inclusive word index ranges) – 2..6 words, natural breaks
PHRASES = [
    (0, 3), (4, 5), (6, 10), (11, 12), (13, 16), (17, 19),
    (20, 24), (25, 28), (29, 31), (32, 35), (36, 39),
    (40, 43), (44, 47), (48, 50), (51, 56), (57, 59), (60, 63), (64, 66),
    (67, 72), (73, 77),
    (78, 80), (81, 84),
    (85, 89), (90, 92), (93, 96),
    (97, 101), (102, 104), (105, 107), (108, 111),
    (112, 115), (116, 119), (120, 123),
    (124, 127), (128, 132), (133, 136), (137, 139),
    (140, 145),
    (146, 148), (149, 153), (154, 158), (159, 161), (162, 164), (165, 169),
    (170, 173), (174, 176), (177, 179), (180, 182), (183, 185), (186, 188),
    (189, 190), (191, 194), (195, 198), (199, 202), (203, 206), (207, 210),
    (211, 215), (216, 219),
    (220, 224), (225, 227),
    (228, 231), (232, 233), (234, 237), (238, 239), (240, 242), (243, 246),
]

KEY_SINGLE = {'HELLO', 'PYAAR', 'SUN', 'MABEL', 'BEEMARI', 'TAAKAT', 'DIN-RAAT', 'AAWAAZ', 'DOOR', '1876',
              'SHAADI', 'SHARES', 'GHANTI', 'KHAMOSH'}
KEY_MULTI = [('PYAAR', 'HO', 'GAYA'), ('PEHLA', 'PHONE', 'CALL'), ('EK', 'MINUTE'), ('PAANCH', 'MAHINE'),
             ('ALEXANDER', 'GRAHAM', 'BELL')]


def _core(t):
    return ''.join(ch for ch in t.upper() if ch.isalnum() or ch == '-').strip('-')


def mark_keys(words):
    cores = [_core(w['text']) for w in words]
    red = [c in KEY_SINGLE for c in cores]
    for seq in KEY_MULTI:
        n = len(seq)
        for i in range(len(cores) - n + 1):
            if tuple(cores[i:i + n]) == seq:
                for k in range(n):
                    red[i + k] = True
    return red


class Captions:
    def __init__(self, words_json, end_time):
        self.words = json.load(open(words_json))
        self.red = mark_keys(self.words)
        self.f = font(FONT, FSIZE)
        self.end_time = end_time
        n = len(self.words)
        covered = [i for a, b in PHRASES for i in range(a, b + 1)]
        assert covered == list(range(n)), "phrases must cover all words in order"
        self.phrases = []
        for pi, (a, b) in enumerate(PHRASES):
            self.phrases.append(self._layout(pi, a, b))
        for ph in self.phrases:
            ph['t_in'] = max(0.0, self.words[ph['a']]['s'] - 0.10)
        for pi, ph in enumerate(self.phrases):
            ph['t_out'] = (self.phrases[pi + 1]['t_in'] if pi + 1 < len(self.phrases) else end_time + 10)
        self.overrides = []  # list of (t0, t1, dy, dx) caption position overrides from the scene plan

    # ------------------------------------------------------------ layout
    def _glyphs(self, text):
        f = self.f
        gl = f.textToGlyphs(text)
        ws = f.getWidths(gl)
        return gl, ws

    def _layout(self, pi, a, b):
        f = self.f
        items = []
        for i in range(a, b + 1):
            txt = self.words[i]['text'].upper()
            gl, ws = self._glyphs(txt)
            items.append(dict(i=i, text=txt, gl=gl, ws=ws, w=sum(ws) + 1.5 * (len(ws) - 1)))
        sp = f.measureText(' ') * 1.05
        total = sum(it['w'] for it in items) + sp * (len(items) - 1)
        lines = [items]
        if total > MAX_LINE_W and len(items) > 1:
            best = None
            for k in range(1, len(items)):
                l1 = sum(it['w'] for it in items[:k]) + sp * (k - 1)
                l2 = sum(it['w'] for it in items[k:]) + sp * (len(items) - k - 1)
                score = max(l1, l2) + (0 if l1 >= l2 else 25)  # prefer longer first line
                if best is None or score < best[0]:
                    best = (score, k)
            k = best[1]
            lines = [items[:k], items[k:]]
        lw = [sum(it['w'] for it in ln) + sp * (len(ln) - 1) for ln in lines]
        maxw = max(lw)
        sw = max(380, maxw + 2 * PAD_X)
        sh = len(lines) * LINE_H + 2 * PAD_Y - 6
        # word positions relative to strip centre
        y0 = -sh / 2 + PAD_Y + FSIZE * 0.86
        for li, ln in enumerate(lines):
            x = -lw[li] / 2
            for it in ln:
                it['x'] = x
                it['y'] = y0 + li * LINE_H
                it['cx'] = x + it['w'] / 2
                x += it['w'] + sp
        rot = (hash01(pi, 5) - 0.5) * 4.6
        dx = (hash01(pi, 6) - 0.5) * 36
        return dict(a=a, b=b, lines=lines, items=items, w=sw, h=sh, rot=rot, dx=dx, seed=pi * 13 + 3)

    # ------------------------------------------------------------ draw
    def phrase_at(self, t):
        for ph in self.phrases:
            if ph['t_in'] <= t < ph['t_out']:
                return ph
        return None

    def offset_at(self, t):
        dy, dx = 0.0, 0.0
        for (t0, t1, oy, ox) in self.overrides:
            if t0 <= t < t1:
                dy, dx = oy, ox
        return dy, dx

    def draw(self, c, t):
        for ph in self.phrases:
            # visible window incl. short exit
            if ph['t_in'] <= t < ph['t_out'] + 0.12:
                self._draw_phrase(c, ph, t)

    def _draw_phrase(self, c, ph, t):
        dy, dx = self.offset_at(ph['t_in'] + 0.01)
        cx = W / 2 + ph['dx'] + dx
        cy = H * 0.715 + dy
        # strip enter / exit
        u_in = seg(t, ph['t_in'], ph['t_in'] + 0.16)
        u_out = seg(t, ph['t_out'], ph['t_out'] + 0.12)
        if u_out >= 1:
            return
        sc = lerp(0.86, 1.0, eout(u_in)) * lerp(1.0, 0.92, u_out)
        a = clamp(u_in * 1.6) * (1 - u_out)
        rot = ph['rot'] + (1 - eout(u_in)) * 4 * (1 if ph['seed'] % 2 else -1)
        ybump = (1 - eout(u_in)) * 14 + u_out * 20
        if a <= 0.01:
            return
        c.saveLayerAlpha(None, int(a * 255)) if a < 0.999 else c.save()
        with xf(c, cx, cy + ybump, rot, sc):
            self._strip(c, ph)
            for it in ph['items']:
                ws = self.words[it['i']]['s']
                if t < ws:
                    continue
                self._word(c, it, t - ws, self.red[it['i']], ph['seed'])
        c.restore()

    def _strip(self, c, ph):
        w, h = ph['w'], ph['h']
        sd = ph['seed']
        outer = torn_rect(-w / 2, -h / 2, w, h, seed=sd, rough=5.5, step=8)
        inner = torn_rect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, seed=sd + 7, rough=3.5, step=7)
        paper(c, outer, 0xFBF6EA, ol=0, sh=(3, 9, 10, 0.45), seed=sd, tex=True)
        paper(c, inner, 0xF4E8CF, ol=0, seed=sd + 1, tex=True)

    def _word(self, c, it, dt, red, seed):
        u = dt / POP
        if u < 0.7:
            s = lerp(0.6, 1.05, eout(u / 0.7))
        elif u < 1.0:
            s = lerp(1.05, 1.0, eio((u - 0.7) / 0.3))
        else:
            s = 1.0
        a = clamp(dt / 0.05)
        col = RED if red else NAVY
        f = self.f
        with xf(c, it['cx'], it['y'] - FSIZE * 0.36, 0, s):
            x = it['x'] - it['cx']
            # shadow pass then letter pass
            for pas in (0, 1):
                xx = x
                for k, (g, gw) in enumerate(zip(it['gl'], it['ws'])):
                    hseed = it['i'] * 31 + k
                    rot = (hash01(hseed, 1) - 0.5) * 9.0
                    by = (hash01(hseed, 2) - 0.5) * 7.0
                    ls = 1.0 + (hash01(hseed, 3) - 0.5) * 0.08
                    gp = f.getPath(g)
                    if gp is None:
                        xx += gw + 1.5
                        continue
                    with xf(c, xx + gw / 2, by + FSIZE * 0.36, rot, ls):
                        if pas == 0:
                            c.save()
                            c.translate(-gw / 2 + 2.2, 3.4)
                            c.drawPath(gp, skia.Paint(AntiAlias=True, Color=C(0x0D0A08, 0.55 * a),
                                                      MaskFilter=_blur(2.2)))
                            c.restore()
                        else:
                            c.save()
                            c.translate(-gw / 2, 0)
                            c.drawPath(gp, skia.Paint(AntiAlias=True, Color=C(col, a), PathEffect=_rough(hseed)))
                            c.restore()
                    xx += gw + 1.5


_rough_cache = {}


def _rough(seed):
    k = seed % 23
    pe = _rough_cache.get(k)
    if pe is None:
        pe = skia.DiscretePathEffect.Make(5.0, 0.9, k)
        _rough_cache[k] = pe
    return pe
