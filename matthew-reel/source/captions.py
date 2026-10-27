"""Karaoke captions in the bottom panel, the panel itself and the watermark."""
import math
import cairo
from gfx import *

CAP_SIZE = 62
CAP_MAXW = 840
LINE_GAP = 90
BLOCK_CY = 1404        # vertical centre of the caption block
LIGHT_LEAD = 0.03      # word starts turning dark this long before its timestamp
LIGHT_DUR = 0.09
WORD_SP = 1.3           # word spacing (x space width)
HL = {'g': C['gold'], 'r': C['red'], 'n': C['green'], None: C['cap_dark']}


class Page:
    def __init__(self, pg):
        self.words = [dict(w, w=w['w'].replace("'", "\u2019")) for w in pg['words']]
        self.show = pg['show']
        self.hide = pg['hide']
        self.scene = pg['scene']
        f = font('cap')
        lines = {}
        for w in self.words:
            lines.setdefault(w['line'], []).append(w)
        self.lines = [lines[k] for k in sorted(lines)]
        sp = f.width(' ', CAP_SIZE) * WORD_SP
        widest = max(sum(f.width(w['w'], CAP_SIZE) for w in ln) + sp * (len(ln) - 1) for ln in self.lines)
        self.size = CAP_SIZE if widest <= CAP_MAXW else CAP_SIZE * CAP_MAXW / widest
        sp = f.width(' ', self.size) * WORD_SP
        n = len(self.lines)
        self.layout = []
        for li, ln in enumerate(self.lines):
            ws = [f.width(w['w'], self.size) for w in ln]
            total = sum(ws) + sp * (len(ln) - 1)
            x = W / 2 - total / 2
            cy = BLOCK_CY + (li - (n - 1) / 2) * LINE_GAP
            base = cy + self.size * 0.36
            for w, wd in zip(ln, ws):
                self.layout.append((w, x, base, wd))
                x += wd + sp


def word_color(w, t):
    k = ease_sine(prog(t, w['t0'] - LIGHT_LEAD, w['t0'] - LIGHT_LEAD + LIGHT_DUR))
    return mix(C['cap_grey'], HL[w['c']], k), k


def draw_page(ctx, page, t, alpha=1.0):
    a_in = 1.0 if page.show <= 0.0 else ease_out(prog(t, page.show, page.show + 0.16))
    a_out = 1 - ease_sine(prog(t, page.hide - 0.12, page.hide))
    a = a_in * a_out * alpha
    if a <= 0.003:
        return
    rise = (1 - a_in) * 12
    f = font('cap')
    for w, x, base, wd in page.layout:
        col, k = word_color(w, t)
        sc = 1.0
        if w['c'] is not None:
            # tiny bump when a highlight word lights up
            u = prog(t, w['t0'] - LIGHT_LEAD, w['t0'] + 0.28)
            sc = 1 + 0.035 * math.sin(math.pi * u) if 0 < u < 1 else 1.0
        ctx.save()
        cx = x + wd / 2
        cy = base - page.size * 0.36 + rise
        ctx.translate(cx, cy)
        ctx.scale(sc, sc)
        draw_text(ctx, f, w['w'], page.size, -wd / 2, page.size * 0.36, col, a, anchor='left')
        ctx.restore()


class Captions:
    def __init__(self, tl):
        self.pages = [Page(p) for p in tl['pages']]

    def draw(self, ctx, t):
        for p in self.pages:
            if p.show - 0.01 <= t <= p.hide + 0.01:
                draw_page(ctx, p, t)

    def active_word(self, t):
        for p in self.pages:
            for w in p.words:
                if w['t0'] <= t < w['t1']:
                    return w
        return None


def make_panel(tint=None, k=0.0):
    """off-white caption panel with soft grey edges (radial vignette), pre-rendered"""
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H - GROUND)
    ctx = cairo.Context(s)
    centre = C['panel'] if tint is None else mix(C['panel'], tint, k)
    edge = C['panel_edge'] if tint is None else mix(C['panel_edge'], tint, k * 0.8)
    corner = mix(edge, (0.80, 0.80, 0.78), 0.35)
    g = cairo.RadialGradient(W / 2, 260, 60, W / 2, 330, 1000)
    g.add_color_stop_rgb(0.0, *centre)
    g.add_color_stop_rgb(0.42, *centre)
    g.add_color_stop_rgb(0.78, *edge)
    g.add_color_stop_rgb(1.0, *corner)
    ctx.set_source(g)
    ctx.paint()
    return s


def draw_watermark(ctx):
    """'Grace in Motion' – fixed position, every frame"""
    draw_text(ctx, font('capb'), 'Grace in Motion', 30, W / 2, WM_Y + 30 * 0.36, C['gold'], 0.6, tracking=2.0)


def draw_ground(ctx):
    ctx.move_to(0, GROUND)
    ctx.line_to(W, GROUND)
    stroke_style(ctx, 4.5, C['out'])
    ctx.set_line_cap(cairo.LINE_CAP_BUTT)
    ctx.stroke()
