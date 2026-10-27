"""The reel's timeline: every part's camera moves, fills, stickers, titles
and sound cues, timed to the words of the voiceover."""
import math
import re

import numpy as np

import core
from anim import (CamTrack, clamp, ease_in, ease_in_out, ease_out, fade, pop, prog,
                  spread_words)
from core import COL, Cam, merc_y, WHITE3D, RED3D, GOLD3D

PARTS = [
    "Yeh hai India… yeh hai Pakistan… lekin 1947 se pehle, yeh ek hi desh tha.",
    "Aur inhe alag karne wali line… ek aise aadmi ne kheenchi, jo usse pehle kabhi India aaya hi nahi tha.",
    "Us waqt yahan Angrezon ka raj tha. June 1947 mein elaan hua — Angrez jaayenge, aur yeh zameen do deshon mein bategi.",
    "Line kheenchne ka kaam mila ek British vakeel ko — Cyril Radcliffe. 8 July 1947 ko woh pehli baar India aaya.",
    "Uske paas the sirf paanch hafte… aur faisla karna tha karodon logon ki kismat ka.",
    "Usne pashchim mein Punjab… aur poorab mein Bengal — dono ko beech se kaat diya.",
    "14 August ko Pakistan aazaad hua, 15 August ko India… lekin border bataya gaya 17 August ko — do din baad.",
    "Tab tak laakhon log yeh bhi nahi jaante the ki unka gaon kis desh mein hai.",
    "Pakistan ke do hisse bane — West aur East — aur dono ke beech tha India.",
    "Ek crore se zyada log apna ghar chhod kar, nayi border ke us paar gaye… aur laakhon kabhi pahunch hi nahi paaye.",
    "Aur Radcliffe? Usne apne saare kaagaz jala diye, apni fees lene se mana kar diya… aur phir kabhi India nahi lauta.",
    "Lekin kahani yahan khatam nahi hui… Pakistan ka East wala hissa, 1971 mein ban gaya — Bangladesh. Kaise? Part 2 mein.",
]

GAP = 0.12        # silence between parts (s)
WORDS_PER_SEC = 2.9


def split_words(text):
    """Caption words: dashes join the previous word so they never stand alone."""
    raw = text.split()
    out = []
    for w in raw:
        if w in ('—', '-') and out:
            out[-1] = out[-1] + ' —'
        else:
            out.append(w)
    return out


def estimate_duration(text):
    n = 0
    for w in split_words(text):
        n += 3 if re.sub(r'\D', '', w) and len(re.sub(r'\D', '', w)) == 4 else 1
    return round(n / WORDS_PER_SEC + 0.45, 2)


class Region:
    """Fill state of one map shape over time (fill-in, recolour, hide), each
    change flashing white first as in the reference."""

    def __init__(self):
        self.ev = []

    def show(self, t, color):
        self.ev.append((t, 'show', color))

    def recolor(self, t, color):
        self.ev.append((t, 'recolor', color))

    def hide(self, t, dur=0.3, flash=False):
        self.ev.append((t, 'hide', (dur, flash)))

    def state(self, T):
        color, alpha, flash = None, 0.0, 0.0
        for t, kind, arg in sorted(self.ev, key=lambda e: e[0]):
            if kind == 'show':
                if T < t:
                    break
                color = arg
                alpha = clamp((T - t) / 0.1)
                flash = 1.0 if T < t + 0.08 else 1 - ease_out((T - t - 0.08) / 0.55)
            elif kind == 'recolor':
                if T < t - 0.14:
                    break
                if T < t:
                    flash = max(flash, ease_in((T - t + 0.14) / 0.14))
                    break
                color = arg
                flash = 1 - ease_out((T - t) / 0.55)
            elif kind == 'hide':
                dur, fl = arg
                if T < t - (0.14 if fl else 0):
                    break
                if fl:
                    if T < t:
                        flash = max(flash, ease_in((T - t + 0.14) / 0.14))
                        break
                    alpha = 0.0
                    flash = 0.0
                    continue
                alpha *= 1 - clamp((T - t) / dur)
                if alpha <= 0:
                    alpha = 0.0
        return color, alpha, clamp(flash)


class Story:
    def __init__(self, durations=None, word_times=None, sprites=None):
        self.durations = durations or [estimate_duration(p) for p in PARTS]
        self.starts = []
        t = 0.25
        for d in self.durations:
            self.starts.append(t)
            t += d + GAP
        self.total = t + 0.6
        self.words = [split_words(p) for p in PARTS]
        self.wt = []
        for i, ws in enumerate(self.words):
            if word_times and word_times[i]:
                self.wt.append([(self.starts[i] + a, self.starts[i] + b) for a, b in word_times[i]])
            else:
                s0 = self.starts[i]
                self.wt.append(spread_words(ws, s0 + 0.05, s0 + self.durations[i] - 0.1))
        self.sprites = sprites
        self.cam = CamTrack(82.0, merc_y(24.0), 17.0)
        self.regions = {}
        self.order = []
        self.map_items = []
        self.screen_items = []
        self.sfx = []
        self.mood_keys = [(0.0, 0.0)]
        self.blur_mul = []
        self.build()

    # ------------------------------------------------------------ helpers
    def S(self, p):
        return self.starts[p]

    def E(self, p):
        return self.starts[p] + self.durations[p]

    def w(self, p, key, which=0, end=False):
        """Time of a word in part p (index or text match)."""
        ws = self.words[p]
        if isinstance(key, int):
            k = key
        else:
            norm = lambda x: re.sub(r'[^0-9a-z]', '', x.lower())
            hits = [i for i, x in enumerate(ws) if norm(x) == norm(key)]
            if not hits:
                hits = [i for i, x in enumerate(ws) if key.lower() in x.lower()]
            k = hits[min(which, len(hits) - 1)] if hits else 0
        return self.wt[p][k][1 if end else 0]

    def region(self, key):
        if key not in self.regions:
            self.regions[key] = Region()
            self.order.append(key)
        return self.regions[key]

    def on_map(self, t0, t1, fn):
        self.map_items.append((t0, t1, fn))

    def on_screen(self, t0, t1, fn):
        self.screen_items.append((t0, t1, fn))

    def sound(self, t, kind, gain=1.0, **kw):
        self.sfx.append((t, kind, gain, kw))

    def mood(self, t, value, dur=0.6):
        self.mood_keys.append((t, None))
        self.mood_keys.append((t + dur, value))

    def mood_at(self, T):
        keys = sorted([k for k in self.mood_keys], key=lambda k: k[0])
        val = 0.0
        prev_t, prev_v = 0.0, 0.0
        for t, v in keys:
            if v is None:
                prev_t, prev_v = t, val
                continue
            if T < t:
                return prev_v + (v - prev_v) * ease_in_out((T - prev_t) / max(1e-3, t - prev_t)) if T > prev_t else prev_v
            val = v
            prev_t, prev_v = t, v
        return val

    def ll(self, lon, lat):
        return lon, merc_y(lat)

    # -------------------------------------------------------- reusable bits
    def pin_with_name(self, lon, lat, name, t_in, t_out, size=66, pin_scale=1.0):
        def fn(c, T, cam):
            x, y = cam.lonlat(lon, lat)
            core.pin_drop(c, x, y, T, t_in, t_out, pin_scale)
            core.pop_label(c, name, x, y - 122 * pin_scale, size, T, t_in + 0.12, t_out)
        self.on_map(t_in, (t_out or 1e9) + 0.6, fn)
        self.sound(t_in, 'pop', 0.9)

    def title3d(self, lines, t_in, t_out, y=330, size=150, from_side=False):
        self.on_screen(t_in, t_out + 0.8, lambda c, T, cam: core.title(c, lines, core.W / 2, y, size, T, t_in, t_out,
                                                                       from_side=from_side))
        self.sound(t_in, 'whoosh', 1.0)
        self.sound(t_in + 0.25, 'boom', 0.55)

    def sticker(self, name, x, y, height, t_in, t_out, flip=False, anim='pop', bob=0.0, layer='screen'):
        """GPT-image sticker: 'pop' (overshoot pop-in) or 'slide'/'slide_r'
        (slides in from the left/right edge with a bounce and back out)."""
        def fn(c, T, cam):
            xx = x
            if anim in ('slide', 'slide_r'):
                d = -1 if anim == 'slide' else 1
                yy = y
                xx = x + d * (1 - core.ease_out_back(prog(T, t_in, 0.5), 1.2)) * 800
                if t_out is not None and T > t_out:
                    xx += d * ease_in(prog(T, t_out, 0.35)) * 900
                sc = 1.0
                sx, sy = core.squash(T, t_in + 0.32, 0.4)
            else:
                sc = pop(T, t_in, t_out, din=0.4)
                yy = y
                sx, sy = core.squash(T, t_in, 0.4)
            yy += math.sin(T * 2.4) * bob
            c.save()
            c.translate(xx, yy)
            c.scale(sx, sy)
            core.sprite(c, self.sprites, name, 0, 0, height, scale=sc, flip=flip)
            c.restore()
        (self.on_screen if layer == 'screen' else self.on_map)(t_in, (t_out or 1e9) + 0.6, fn)
        self.sound(t_in, 'pop' if anim == 'pop' else 'swoosh_up', 1.0)
        if anim != 'pop' and t_out is not None:
            self.sound(t_out, 'swoosh_up', 0.6)

    def clouds(self, t0, t1):
        imgs = core.make_clouds(6)
        rng = np.random.default_rng(3)
        clouds = []
        for k in range(14):
            lon = 79 + rng.uniform(-22, 22)
            lat = 22 + rng.uniform(-18, 18)
            clouds.append((lon, merc_y(lat), imgs[k % len(imgs)], rng.uniform(380, 820), rng.uniform(1.5, 2.4)))

        def fn(c, T, cam):
            base_s = 17.0
            f = cam.s / base_s
            haze = 1 - prog(T, t0 + 0.15, 0.7)
            if haze > 0:
                c.drawRect(core.skia.Rect(0, 0, core.W, core.H),
                           core.skia.Paint(Color=core.rgba((230, 238, 245), 0.55 * haze)))
            for X, Y, img, size, par in clouds:
                k = f ** (par - 1)
                x, y = cam.to_screen(X, Y)
                x = core.W / 2 + (x - core.W / 2) * k
                y = core.H / 2 + (y - core.H / 2) * k
                sz = size * f ** (par * 0.8)
                a = clamp(1.25 - (f - 1) * 0.55) * (1 - prog(T, t1 - 0.3, 0.3))
                if a <= 0.01 or sz > 9000:
                    continue
                w = sz
                h = sz * img.height() / img.width()
                p = core.skia.Paint(AntiAlias=True)
                p.setAlphaf(a)
                c.drawImageRect(img, core.skia.Rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2),
                                core.skia.SamplingOptions(core.skia.FilterMode.kLinear), p)
        self.on_screen(t0, t1, fn)

    # ------------------------------------------------------------ the parts
    def build(self):
        for i in range(len(PARTS)):
            fn = getattr(self, 'part%d' % (i + 1), None)
            if fn:
                fn(i)

    def part1(self, p):
        S = self.S(p)
        t_india = self.w(p, 'India')
        t_yeh2 = self.w(p, 'yeh', 1)
        t_pak = self.w(p, 'Pakistan')
        t_lekin = self.w(p, 'lekin')
        t_1947 = self.w(p, '1947')
        t_ek = self.w(p, 'ek')
        # Zoom in from space through the clouds, landing on India.
        self.clouds(0.0, t_india + 0.4)
        self.cam.move(0.0, max(1.0, t_india + 0.12), 79.2, merc_y(22.2), 31.0, ease=lambda u: ease_in_out(u) ** 1.15)
        self.sound(0.0, 'whoosh_long', 1.0)
        self.region('IND_TODAY').show(t_india, COL['india'])
        self.sound(t_india, 'fill', 0.8)
        self.pin_with_name(78.9, 23.2, 'India', t_india + 0.05, t_yeh2 - 0.05, size=76, pin_scale=1.25)
        # Whip-pan west to Pakistan.
        self.cam.move(t_yeh2 - 0.18, 0.55, 70.6, merc_y(28.8), 42.0)
        self.sound(t_yeh2 - 0.2, 'whoosh', 0.8)
        self.region('PAK_TODAY').show(t_pak, COL['pakistan'])
        self.region('KASHMIR').show(t_pak + 0.2, COL['kashmir'])
        self.sound(t_pak, 'fill', 0.8)
        self.pin_with_name(69.6, 29.6, 'Pakistan', t_pak + 0.05, t_lekin, size=72, pin_scale=1.2)
        # Pull back to the whole land; "1947" flies in; borders melt into one.
        self.cam.move(t_lekin - 0.1, 0.65, 80.6, merc_y(23.4), 27.0)
        self.sound(t_lekin - 0.1, 'whoosh', 0.7)
        self.title3d([([('1947', *WHITE3D)], 200), ([('SE PEHLE', *GOLD3D)], 104)], t_1947 - 0.1, self.E(p) - 0.15,
                     y=360, size=200)
        for key in ('IND_TODAY', 'PAK_TODAY', 'KASHMIR'):
            self.region(key).hide(t_ek, flash=True)
        self.region('BRITISH_INDIA').show(t_ek, COL['gold'])
        self.sound(t_ek, 'shimmer', 0.9)

    def part2(self, p):
        S, E = self.S(p), self.E(p)
        t_line = self.w(p, 'line')
        t_aadmi = self.w(p, 'aadmi')
        t_kh = self.w(p, 'kheenchi')
        t_india = self.w(p, 'India')
        self.cam.move(S - 0.1, 1.0, 81.0, merc_y(25.2), 41.0, drift=0.02)
        # The red line scribbles itself across Punjab and Bengal.
        t0 = t_line - 0.1
        for key, lag in (('RADCLIFFE_PUNJAB', 0.0), ('RADCLIFFE_BENGAL', 0.35)):
            def fn(c, T, cam, key=key, lag=lag):
                fr = ease_in_out(prog(T, t0 + lag, 1.1))
                lp, tip = core.geo.line_path(key, cam, fr)
                core.draw_line(c, lp, width=10)
                if tip and fr < 1:
                    c.drawCircle(tip[0], tip[1], 15, core.skia.Paint(AntiAlias=True, Color=core.rgba((255, 255, 255), 0.95),
                                                                    MaskFilter=core.blur(7)))
            self.on_map(t0 + lag, E + 0.2, fn)
        self.sound(t0, 'scribble', 0.8, dur=1.5)
        # Radcliffe pops up with his giant pencil; a UK badge beside him.
        self.sticker('radcliffe_pen.png', 290, 1330, 520, t_aadmi - 0.1, E - 0.05, anim='slide', bob=4)
        self.on_screen(t_aadmi + 0.15, E, lambda c, T, cam: core.badge_pop(c, 'uk', 500, 960, 54, T, t_aadmi + 0.15, E - 0.12))
        self.sound(t_aadmi + 0.15, 'pop', 0.8)
        self.title3d([[('ONE MAN', *WHITE3D)], [('ONE LINE', *RED3D)]], t_kh - 0.05, E - 0.1, y=290, size=132)
        self.on_screen(t_india - 0.1, E, lambda c, T, cam: core.bubble(c, 420, 660, 'INDIA?', size=56, kind='thought',
                                                                     tail=(-0.5, 1), scale=pop(T, t_india - 0.1, E - 0.12)))
        self.sound(t_india - 0.1, 'pop', 0.7)

    # ------------------------------------------------- more reusable bits
    def ref_s(self, t):
        return self.cam.at(t)[2]

    def zf(self, cam, t_ref, k=0.7):
        return clamp((cam.s / self.ref_s(t_ref)) ** k, 0.45, 2.2)

    def map_sticker(self, name, lon, lat, height, t_in, t_out, flip=False, k=0.7, alpha_fn=None):
        def fn(c, T, cam):
            x, y = cam.lonlat(lon, lat)
            sc = pop(T, t_in, t_out, din=0.38)
            sx, sy = core.squash(T, t_in, 0.38)
            a = alpha_fn(T) if alpha_fn else 1.0
            c.save()
            c.translate(x, y)
            c.scale(sx, sy)
            core.sprite(c, self.sprites, name, 0, 0, height * self.zf(cam, t_in, k), scale=sc, flip=flip, alpha=a)
            c.restore()
        self.on_map(t_in, (t_out or 1e9) + 0.5, fn)

    def walker(self, name, path, t0, t1, height, flip=False, k=0.7, alpha_fn=None, t_out=None):
        """Sticker walking along a lon/lat path between t0 and t1."""
        P = np.array([(lo, merc_y(la)) for lo, la in path])

        def fn(c, T, cam):
            u = clamp((T - t0) / (t1 - t0))
            seg = np.hypot(*np.diff(P, axis=0).T)
            cum = np.concatenate([[0], np.cumsum(seg)])
            L = cum[-1] * u
            j = min(len(P) - 2, int(np.searchsorted(cum, L, side='right') - 1))
            f = (L - cum[j]) / max(seg[j], 1e-9)
            X, Y = P[j] + f * (P[j + 1] - P[j])
            x, y = cam.to_screen(X, Y)
            a = clamp((T - t0) / 0.3)
            if alpha_fn:
                a *= alpha_fn(T)
            if t_out is not None:
                a *= 1 - clamp((T - t_out) / 0.4)
            bob = abs(math.sin(T * 7.0)) * 5
            c.save()
            c.translate(x, y - bob)
            c.rotate(math.sin(T * 7.0) * 2.0)
            core.sprite(c, self.sprites, name, 0, 0, height * self.zf(cam, t0, k), flip=flip, alpha=a)
            c.restore()
        self.on_map(t0, (t_out or t1) + 0.5, fn)

    def tag_on_map(self, text, lon, lat, t_in, t_out, size=44, bg=COL['tag'], split_at=None, k=0.6, dy=0):
        def fn(c, T, cam):
            x, y = cam.lonlat(lon, lat)
            z = self.zf(cam, t_in, k)
            sp = ease_out(prog(T, split_at, 0.35)) if split_at else 0.0
            core.tag_pop(c, text, x, y + dy, T, t_in, t_out, size=size * z, bg=bg, split=sp)
        self.on_map(t_in, (t_out or 1e9) + 0.5, fn)
        self.sound(t_in, 'pop', 0.8, pitch=1.1)

    def tag_on_screen(self, text, x, y, t_in, t_out, size=44, bg=COL['tag'], rot=0.0):
        self.on_screen(t_in, (t_out or 1e9) + 0.5, lambda c, T, cam: core.tag_pop(c, text, x, y, T, t_in, t_out,
                                                                                   size=size, bg=bg, rot=rot))
        self.sound(t_in, 'pop', 0.8, pitch=1.1)

    def badge_on_map(self, kind, lon, lat, R, t_in, t_out, k=0.6, confetti=None):
        def fn(c, T, cam):
            x, y = cam.lonlat(lon, lat)
            if confetti:
                core.confetti(c, x, y, T, t_in + 0.05, confetti, seed=int(lon * 10))
            core.badge_pop(c, kind, x, y, R * self.zf(cam, t_in, k), T, t_in, t_out)
        self.on_map(t_in, (t_out or 1e9) + 0.5, fn)
        self.sound(t_in, 'pop', 1.0, pitch=0.9)

    def name_on_map(self, text, lon, lat, t_in, t_out, size=64, k=0.6):
        self.on_map(t_in, (t_out or 1e9) + 0.6, lambda c, T, cam: core.pop_label(
            c, text, *cam.lonlat(lon, lat), size, T, t_in, t_out, zoom=self.zf(cam, t_in, k)))

    def qmark(self, lon, lat, t_in, t_out, size=150):
        def fn(c, T, cam):
            x, y = cam.lonlat(lon, lat)
            wob = math.sin(T * 5 + lon) * 6
            core.title(c, [[('?', *RED3D)]], x, y + size * 0.35 + wob, size, T, t_in, t_out)
        self.on_map(t_in, t_out + 0.8, fn)
        self.sound(t_in, 'pop', 0.9, pitch=0.8)

    def pulse_region(self, key, t, dur=0.9, strength=0.45):
        def fn(c, T, cam):
            u = (T - t) / dur
            if not 0 <= u <= 1:
                return
            a = math.sin(math.pi * u) * strength
            path = core.geo.screen_path(key, cam)
            c.drawPath(path, core.skia.Paint(AntiAlias=True, Color=core.rgba((255, 255, 255), a)))
            g = core.skia.Paint(AntiAlias=True, Style=core.skia.Paint.kStroke_Style, StrokeWidth=14,
                                Color=core.rgba((255, 255, 255), a * 1.4), MaskFilter=core.blur(9))
            c.drawPath(path, g)
        self.on_map(t, t + dur, fn)

    def radcliffe_lines(self, t_draw, durs, alpha_fn):
        """Both Radcliffe lines: drawn at t_draw[key] over durs[key], then kept
        for the rest of the reel; alpha_fn(T) -> (alpha, dashed, glow)."""
        for key in ('RADCLIFFE_PUNJAB', 'RADCLIFFE_BENGAL'):
            t0, d = t_draw[key], durs[key]

            def fn(c, T, cam, key=key, t0=t0, d=d):
                fr = ease_in_out(prog(T, t0, d))
                a, dashed, glow = alpha_fn(T)
                lp, tip = core.geo.line_path(key, cam, fr)
                if glow > 0:
                    gp = core.skia.Paint(AntiAlias=True, Style=core.skia.Paint.kStroke_Style, StrokeWidth=34,
                                         Color=core.rgba((255, 255, 255), 0.6 * glow), MaskFilter=core.blur(16))
                    c.drawPath(lp, gp)
                core.draw_line(c, lp, width=10, alpha=a, dash=[22, 18] if dashed else None)
                if tip and 0 < fr < 1:
                    c.drawCircle(tip[0], tip[1], 18, core.skia.Paint(AntiAlias=True, Color=core.rgba((255, 255, 255), 0.95),
                                                                    MaskFilter=core.blur(8)))
            self.on_map(t0, self.total, fn)
            self.sound(t0, 'scribble', 0.9, dur=d + 0.1)

    def flow_arrows(self, pairs, t0, t1, period=1.7, color=(255, 255, 255)):
        def fn(c, T, cam):
            for i, ((lo0, la0), (lo1, la1)) in enumerate(pairs):
                ph = ((T - t0) / period + i * 0.37) % 1.0
                fade_all = clamp((T - t0) / 0.4) * (1 - clamp((T - t1) / 0.5))
                if fade_all <= 0:
                    continue
                p0 = cam.lonlat(lo0, la0)
                p1 = cam.lonlat(lo1, la1)
                pts = core.bezier(p0, p1, 0.12 * (1 if i % 2 else -1))
                a = (1 - clamp((ph - 0.65) / 0.35)) * fade_all
                core.arrow(c, pts, frac=ease_out(min(1.0, ph * 1.5)), color=color, width=11, alpha=a, head=36)
        self.on_map(t0, t1 + 0.6, fn)

    # -------------------------------------------------------------- parts
    def part3(self, p):
        S, E = self.S(p), self.E(p)
        t_raj, t_june = self.w(p, 'raj'), self.w(p, 'June')
        t_angrez, t_do, t_bat = self.w(p, 'Angrez'), self.w(p, 'do'), self.w(p, 'bategi')
        t_elaan = self.w(p, 'elaan')
        self.cam.move(S - 0.15, 0.8, 80.4, merc_y(24.6), 30.5)
        self.on_map(t_raj - 0.05, t_angrez + 1.0,
                    lambda c, T, cam: core.pole_flag_anim(c, 'uk', *cam.lonlat(77.21, 28.61), T, t_raj - 0.05, t_angrez + 0.1, h=200))
        self.sound(t_raj + 0.2, 'thud', 1.0)
        self.tag_on_map('British India', 79.4, 20.6, t_raj + 0.3, t_do - 0.15, size=50)
        self.title3d([[('JUNE ', *WHITE3D), ('1947', *RED3D)]], t_june - 0.08, E - 0.15, y=340, size=150)
        self.sticker('old_radio.png', 820, 1330, 300, t_elaan - 0.15, t_do - 0.1)
        self.on_screen(t_elaan, t_do, lambda c, T, cam: core.sound_waves(c, 820, 1110, T, t_elaan, t_do - 0.1))
        self.sound(t_angrez + 0.1, 'whoosh', 0.8)
        self.tag_on_map('INDIA ?', 79.6, 21.4, t_do, E - 0.1, size=50, bg=(205, 96, 18))
        self.tag_on_map('PAKISTAN ?', 70.9, 28.4, t_do + 0.18, E - 0.1, size=46, bg=(22, 118, 52))
        self.qmark(74.9, 31.0, t_bat, E - 0.1, size=150)

    def part4(self, p):
        S, E = self.S(p), self.E(p)
        p5 = p + 1
        t_brit, t_cyril = self.w(p, 'British'), self.w(p, 'Cyril')
        t_8, t_pehli = self.w(p, '8'), self.w(p, 'pehli')
        self.cam.move(S - 0.15, 0.7, 78.6, merc_y(26.2), 40.0)
        self.sticker('radcliffe_pen.png', 800, 1330, 520, t_brit - 0.1, self.w(p5, 'karodon') - 0.2, anim='slide_r', bob=4)
        t_kar = self.w(p5, 'karodon')
        self.tag_on_screen('Cyril Radcliffe', 790, 590, t_cyril, t_kar - 0.25, size=48)
        self.tag_on_screen('British lawyer', 790, 665, t_cyril + 0.25, t_8 + 0.3, size=32, bg=(40, 44, 52))

        def arr(c, T, cam):
            u = ease_out(prog(T, t_8 - 0.25, 0.65))
            if u <= 0:
                return
            a = 1 - prog(T, E + 0.2, 0.3)
            dx, dy = cam.lonlat(77.21, 28.61)
            pts = core.bezier((-60, 330), (dx - 6, dy - 22), -0.28)
            core.arrow(c, pts, frac=u, color=(255, 255, 255), width=12, alpha=a, head=40)
        self.on_map(t_8 - 0.25, E + 0.6, arr)
        self.sound(t_8 - 0.25, 'whoosh', 0.7)
        self.pin_with_name(77.21, 28.61, 'Delhi', t_8 + 0.35, E - 0.05, size=60, pin_scale=1.0)
        self.tag_on_map('PEHLI BAAR', 74.3, 27.6, t_pehli, E - 0.1, size=40, bg=(196, 140, 10))
        weeks = [('JULY', '8'), ('JULY', '15'), ('JULY', '22'), ('JULY', '29'), ('AUG', '5'), ('AUG', '12')]
        t_w = self.w(p5, 'paanch')
        pages = [(t_8, 'JULY', '8', '1947')] + [(t_w + 0.32 * (i + 1), m, d, '1947') for i, (m, d) in enumerate(weeks[1:])]
        self.on_screen(t_8 - 0.05, self.w(p5, 'karodon'), lambda c, T, cam: core.calendar_anim(
            c, 250, 1060, 230, pages, T, t_8 - 0.05, self.w(p5, 'karodon') - 0.25))
        self.sound(t_8, 'pop', 1.0)
        for t, *_ in pages[1:]:
            self.sound(t, 'flip', 0.9)

    def part5(self, p):
        S, E = self.S(p), self.E(p)
        t_sirf, t_paanch, t_kar = self.w(p, 'sirf'), self.w(p, 'paanch'), self.w(p, 'karodon')
        self.title3d([[('SIRF ', *WHITE3D), ('5 HAFTE', *RED3D)]], t_sirf - 0.05, t_kar - 0.1, y=330, size=140)

        def hg(c, T, cam):
            sc = pop(T, t_paanch - 0.2, t_kar - 0.25)
            rot = 180 * ease_in_out(prog(T, t_paanch + 0.35, 0.5))
            c.save()
            c.translate(520, 1180)
            c.rotate(rot)
            core.sprite(c, self.sprites, 'hourglass.png', 0, 0, 300, scale=sc, anchor='center')
            c.restore()
        self.on_screen(t_paanch - 0.2, t_kar + 0.5, hg)
        self.sound(t_paanch - 0.2, 'pop', 1.0)
        for i in range(8):
            self.sound(t_paanch + 0.2 + i * 0.18, 'tick', 0.7)
        self.cam.move(t_kar - 0.25, 0.7, 80.6, merc_y(23.6), 27.0)
        self.sound(t_kar - 0.25, 'whoosh', 0.7)
        spots = [(77.0, 28.6), (73.6, 31.0), (68.6, 26.2), (80.8, 25.4), (86.6, 23.4), (90.3, 24.1),
                 (75.4, 21.0), (79.6, 17.4), (77.6, 12.6), (71.6, 23.3), (84.0, 20.6), (93.0, 26.4)]
        for i, (lo, la) in enumerate(spots):
            t = t_kar + 0.05 + i * 0.09
            self.map_sticker('crowd_group.png', lo, la, 92, t, E - 0.08 + i * 0.01, k=0.8)
            self.sound(t, 'pop', 0.45, pitch=1.0 + 0.05 * (i % 4))

    def part6(self, p):
        S, E = self.S(p), self.E(p)
        t_pa, t_pun = self.w(p, 'pashchim'), self.w(p, 'Punjab')
        t_po, t_ben = self.w(p, 'poorab'), self.w(p, 'Bengal')
        t_dono, t_kaat = self.w(p, 'dono'), self.w(p, 'kaat')
        self.cam.move(t_pa - 0.3, 0.55, 74.7, merc_y(31.1), 112.0)
        self.sound(t_pa - 0.3, 'whoosh', 0.9)
        self.pulse_region('PUNJAB_REGION', t_pun - 0.05, 1.0)
        self.tag_on_map('PUNJAB', 74.62, 31.2, t_pun, E - 0.1, size=52, split_at=t_kaat, dy=-30)
        self.cam.move(t_po - 0.28, 0.55, 88.9, merc_y(24.3), 96.0)
        self.sound(t_po - 0.28, 'whoosh', 0.9)
        self.pulse_region('BENGAL_REGION', t_ben - 0.05, 1.0)
        self.tag_on_map('BENGAL', 88.55, 24.75, t_ben, E - 0.1, size=52, split_at=t_kaat, dy=-30)
        self.cam.move(t_dono - 0.2, 0.6, 81.6, merc_y(27.4), 44.0)
        self.sound(t_kaat, 'whoosh', 0.7, seed=5)
        self.sound(t_kaat + 0.05, 'stamp', 0.6)
        t_draw = {'RADCLIFFE_PUNJAB': t_pun + 0.1, 'RADCLIFFE_BENGAL': t_ben + 0.1}
        durs = {'RADCLIFFE_PUNJAB': max(0.8, t_po - t_pun - 0.45), 'RADCLIFFE_BENGAL': max(0.8, t_dono - t_ben - 0.2)}
        p7 = p + 1
        t_hide0, t_17 = self.S(p7) + 0.3, self.w(p7, '17')

        def line_alpha(T):
            if t_hide0 <= T < t_17:
                return 0.3 + 0.7 * (1 - prog(T, t_hide0, 0.4)), True, 0.0
            glow = max(0.0, 1 - abs(T - t_17 - 0.2) / 0.6) if T >= t_17 - 0.4 else 0.0
            return 1.0, False, glow
        self.radcliffe_lines(t_draw, durs, line_alpha)

    def part7(self, p):
        S, E = self.S(p), self.E(p)
        t_14, t_pak = self.w(p, '14'), self.w(p, 'Pakistan')
        t_15, t_ind = self.w(p, '15'), self.w(p, 'India')
        t_bor, t_17, t_do = self.w(p, 'border'), self.w(p, '17'), self.w(p, 'do')
        self.cam.move(S - 0.15, 0.65, 80.5, merc_y(24.6), 27.5)
        pages = [(t_14, 'AUG', '14', '1947'), (t_15, 'AUG', '15', '1947'), (t_17, 'AUG', '17', '1947')]
        self.on_screen(t_14 - 0.1, E, lambda c, T, cam: core.calendar_anim(c, 225, 1095, 220, pages, T, t_14 - 0.1, E - 0.1))
        self.sound(t_14 - 0.1, 'pop', 1.0)
        self.sound(t_15, 'flip', 1.0)
        self.sound(t_17, 'flip', 1.0)
        pk = [(1, 65, 28), (255, 255, 255), (60, 170, 90)]
        self.badge_on_map('pakistan', 68.3, 27.4, 46, t_pak + 0.05, t_17 + 1.4, confetti=pk)
        self.badge_on_map('pakistan', 90.35, 23.9, 34, t_pak + 0.2, t_17 + 1.4, confetti=pk)
        self.badge_on_map('india', 78.6, 22.2, 56, t_ind, t_17 + 1.4,
                          confetti=[(255, 153, 51), (255, 255, 255), (19, 136, 8)])
        self.qmark(74.75, 31.25, t_bor, t_17 - 0.05, size=130)
        self.qmark(88.75, 24.6, t_bor + 0.15, t_17 - 0.05, size=130)
        self.region('BRITISH_INDIA').hide(t_17 + 0.05, flash=True)
        self.region('IND_1947').show(t_17 + 0.05, COL['india'])
        self.region('PAK_W_1947').show(t_17 + 0.05, COL['pakistan'])
        self.region('PAK_E_1947').show(t_17 + 0.05, COL['pakistan'])
        self.region('KASHMIR').show(t_17 + 0.05, COL['kashmir'])
        self.sound(t_17, 'boom', 0.8)
        self.sound(t_17 + 0.05, 'shimmer', 0.8)
        self.tag_on_map('J&K: not decided yet', 76.4, 36.4, t_17 + 0.5, E + 0.2, size=34, bg=(66, 70, 78))
        self.tag_on_screen('2 DIN BAAD', 225, 1295, t_do, E - 0.1, size=40, bg=(196, 140, 10), rot=-4)

    def part8(self, p):
        S, E = self.S(p), self.E(p)
        t_la, t_gaon = self.w(p, 'laakhon'), self.w(p, 'gaon')
        self.cam.move(S - 0.2, 0.7, 75.25, merc_y(31.2), 200.0, drift=0.012)
        self.sound(S - 0.2, 'whoosh', 0.8)
        huts = [(74.1, 31.7), (75.05, 31.55), (74.05, 31.05), (74.95, 30.95), (75.55, 32.0), (74.55, 32.15),
                (73.6, 30.55), (74.5, 30.4)]
        for i, (lo, la) in enumerate(huts):
            t = t_la + i * 0.13
            self.map_sticker('village_hut.png', lo, la, 120, t, E - 0.05, k=0.6)
            self.sound(t, 'pop', 0.4, pitch=0.9 + 0.04 * i)

            def qb(c, T, cam, lo=lo, la=la, t=t):
                x, y = cam.lonlat(lo, la)
                core.bubble(c, x + 40, y - 150, '?', size=40, kind='speech', tail=(-0.3, 1),
                            scale=pop(T, t + 0.25, E - 0.1) * 0.9)
            self.on_map(t + 0.25, E + 0.5, qb)
        self.sticker('villager_confused.png', 860, 1330, 420, t_gaon - 0.35, E - 0.1, anim='slide_r', bob=3)
        self.on_screen(t_gaon, E, lambda c, T, cam: core.bubble(c, 790, 790, 'HUM KIS\nDESH MEIN?', size=42, kind='speech',
                                                              tail=(0.4, 1), scale=pop(T, t_gaon, E - 0.12)))
        self.sound(t_gaon, 'pop', 0.8)

    def part9(self, p):
        S, E = self.S(p), self.E(p)
        t_do, t_west, t_east = self.w(p, 'do'), self.w(p, 'West'), self.w(p, 'East')
        t_beech, t_ind = self.w(p, 'beech'), self.w(p, 'India')
        self.cam.move(S - 0.2, 0.7, 80.5, merc_y(24.8), 27.0)
        self.sound(S - 0.2, 'whoosh', 0.8)
        self.pulse_region('PAK_W_1947', t_do, 0.9)
        self.pulse_region('PAK_E_1947', t_do + 0.1, 0.9)
        self.tag_on_map('PAKISTAN (WEST)', 69.8, 33.0, t_west, E - 0.1, size=38, bg=(22, 118, 52))
        self.tag_on_map('PAKISTAN (EAST)', 90.0, 28.3, t_east, E - 0.1, size=38, bg=(22, 118, 52))

        def dist(c, T, cam):
            u = ease_out(prog(T, t_beech - 0.15, 0.6))
            if u <= 0:
                return
            p0 = cam.lonlat(74.25, 30.25)
            p1 = cam.lonlat(88.15, 24.7)
            a = 1 - prog(T, E - 0.1, 0.3)
            core.dashed_double_arrow(c, p0, p1, frac=u, alpha=a)
            if u > 0.6:
                mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
                core.tag_pop(c, '~1,600 KM', mx, my + 70, T, t_beech + 0.25, E - 0.1, size=40, bg=(40, 44, 52))
        self.on_map(t_beech - 0.15, E + 0.5, dist)
        self.sound(t_beech - 0.15, 'whoosh', 0.6)
        self.sound(t_beech + 0.25, 'pop', 0.8)
        self.name_on_map('India', 78.6, 19.6, t_ind, E - 0.1, size=66)

    def part10(self, p):
        S, E = self.S(p), self.E(p)
        t_crore, t_paar = self.w(p, 'crore'), self.w(p, 'paar')
        t_aur, t_la = self.w(p, 'aur'), self.w(p, 'laakhon')
        self.mood(S - 0.3, 0.78, 0.8)
        self.cam.move(S - 0.2, 0.7, 75.0, merc_y(30.95), 92.0, drift=0.01)
        self.sound(S - 0.2, 'whoosh', 0.7)
        self.title3d([[('1 CRORE', *WHITE3D), ('+', *GOLD3D)]], t_crore - 0.1, t_aur - 0.05, y=330, size=170)
        fade_out = lambda T: 1 - 0.85 * ease_in_out(prog(T, t_la, 1.4))
        pairs = [((73.25, 31.95), (76.15, 31.7)), ((76.3, 31.2), (73.45, 31.45)),
                 ((72.95, 30.85), (75.85, 30.45)), ((75.85, 29.95), (73.2, 30.35))]
        self.flow_arrows(pairs, S + 0.2, t_la + 0.3)
        self.walker('refugee_train.png', [(73.4, 31.62), (75.9, 31.7)], S + 0.3, E + 0.3, 120, flip=True,
                    alpha_fn=fade_out)
        self.walker('refugee_train.png', [(76.0, 30.78), (73.4, 30.92)], S + 0.8, E + 0.3, 120, flip=False,
                    alpha_fn=fade_out)
        self.walker('refugee_family.png', [(75.75, 30.32), (73.95, 30.5)], S + 0.5, E + 0.3, 92, flip=False,
                    alpha_fn=fade_out)
        self.walker('bullock_cart.png', [(73.55, 31.22), (75.4, 31.05)], S + 0.7, E + 0.3, 88, flip=True,
                    alpha_fn=fade_out)
        self.sound(S + 0.3, 'train', 0.55, dur=min(5.0, self.durations[p]))
        self.cam.move(t_aur - 0.1, 1.6, 79.5, merc_y(26.8), 40.0, drift=0.006)
        self.mood(t_aur, 0.95, 1.2)
        self.on_screen(S, E + 0.4, lambda c, T, cam: core.dust(c, T, alpha=0.5 * fade(T, S, E + 0.1, 0.6, 0.4)))

    def part11(self, p):
        S, E = self.S(p), self.E(p)
        t_rad, t_kaag = self.w(p, 'Radcliffe'), self.w(p, 'kaagaz')
        t_fees, t_mana = self.w(p, 'fees'), self.w(p, 'mana')
        t_phir, t_kabhi = self.w(p, 'phir'), self.w(p, 'kabhi')
        self.mood(S - 0.2, 0.3, 0.6)
        self.cam.move(S - 0.2, 0.8, 80.5, merc_y(24.2), 29.0)
        self.sticker('radcliffe_thinking.png', 280, 1330, 520, t_rad - 0.2, t_phir - 0.02, anim='slide', bob=4)

        def fire(c, T, cam):
            sc = pop(T, t_kaag - 0.1, E - 0.12)
            if sc <= 0.01:
                return
            fl = 1 + 0.03 * math.sin(T * 23) + 0.02 * math.sin(T * 37)
            c.save()
            c.translate(820, 1330)
            c.scale(fl, 2 - fl)
            core.sprite(c, self.sprites, 'burning_papers.png', 0, 0, 300, scale=sc)
            c.restore()
            core.embers(c, 820, 1080, T, t_kaag, E - 0.1, w=180)
        self.on_screen(t_kaag - 0.1, E + 0.5, fire)
        self.sound(t_kaag - 0.1, 'pop', 0.9)
        self.sound(t_kaag, 'crackle', 0.8, dur=max(1.0, E - t_kaag))
        self.sticker('money_bag.png', 820, 900, 230, t_fees - 0.1, E - 0.12)
        self.tag_on_screen('₹40,000', 820, 965, t_fees + 0.1, E - 0.12, size=40, bg=(196, 140, 10))
        self.on_screen(t_mana, E + 0.4, lambda c, T, cam: core.stamp_x(c, 820, 800, T, t_mana, 170)
                       if T < E - 0.1 else None)
        self.sound(t_mana, 'stamp', 1.0)
        self.walker_screen('radcliffe_walking.png', (280, 1330), (-320, 1330), t_phir - 0.02, E + 0.2, 520)
        self.title3d([([('KABHI ', *WHITE3D), ('NAHI', *RED3D)], 140), ([('LAUTA', *WHITE3D)], 140)],
                     t_kabhi - 0.08, E - 0.12, y=320, size=140)

    def walker_screen(self, name, p0, p1, t0, t1, height, flip=False):
        def fn(c, T, cam):
            u = clamp((T - t0) / (t1 - t0))
            x = p0[0] + (p1[0] - p0[0]) * u
            y = p0[1] + (p1[1] - p0[1]) * u
            bob = abs(math.sin(T * 8.0)) * 9
            c.save()
            c.translate(x, y - bob)
            c.rotate(math.sin(T * 8.0) * 2.5)
            core.sprite(c, self.sprites, name, 0, 0, height, flip=flip)
            c.restore()
        self.on_screen(t0, t1, fn)

    def part12(self, p):
        S, E = self.S(p), self.E(p)
        t_pak, t_east = self.w(p, 'Pakistan'), self.w(p, 'East')
        t_1971, t_bd = self.w(p, '1971'), self.w(p, 'Bangladesh')
        t_kaise, t_part = self.w(p, 'Kaise'), self.w(p, 'Part')
        self.mood(S - 0.2, 0.0, 0.6)
        self.cam.move(S - 0.2, 1.2, 81.0, merc_y(25.0), 33.0)
        self.cam.move(t_pak - 0.3, 0.7, 90.15, merc_y(23.9), 102.0, drift=0.015)
        self.sound(t_pak - 0.3, 'whoosh', 0.9)
        self.pulse_region('PAK_E_1947', t_east - 0.05, 1.0)
        self.tag_on_map('EAST PAKISTAN', 90.3, 26.05, t_east, t_bd - 0.05, size=48, bg=(22, 118, 52))
        self.sound(t_1971 - 1.3, 'riser', 0.7, dur=1.3)
        self.title3d([[('1971', *RED3D)]], t_1971 - 0.05, t_part - 0.3, y=380, size=210)
        self.region('PAK_E_1947').hide(t_bd, flash=True)
        self.region('BGD').show(t_bd, COL['bangladesh'])
        self.badge_on_map('bangladesh', 90.25, 23.75, 70, t_bd + 0.1, E + 0.6, k=0.4)
        self.name_on_map('Bangladesh', 89.9, 25.3, t_bd + 0.2, E + 0.5, size=72, k=0.4)
        self.sound(t_bd, 'ding', 0.9)
        self.qmark(88.2, 22.4, t_kaise - 0.05, E + 0.5, size=170)

        def endcard(c, T, cam):
            if T < t_part - 0.05:
                return
            core.title(c, [[('PART 2', *WHITE3D)]], core.W / 2 - 50, 400, 170, T, t_part - 0.05, None)
            u = ease_out(prog(T, t_part + 0.35, 0.4))
            if u > 0:
                bx = core.W / 2 + 330 + math.sin(T * 6) * 10
                core.arrow(c, [(bx - 70 * u, 340), (bx + 40 * u, 340)], frac=1.0, color=(246, 190, 40), width=22, head=60)
        self.on_screen(t_part - 0.05, self.total, endcard)
        self.sound(t_part, 'boom', 0.7)
        # Channel mascot points at the viewer on the end card.
        self.sticker('chibi_boy.png', 885, 1335, 500, t_part - 0.25, None, anim='slide_r', bob=5)

    # ------------------------------------------------------------ captions
    def caption_chunks(self):
        """Group words into 1-3 word chunks (reference style); break at punctuation."""
        chunks = []
        for p, ws in enumerate(self.words):
            cur = []
            for k, wd in enumerate(ws):
                cur.append(k)
                text = ' '.join(ws[j] for j in cur)
                brk = wd.endswith(('…', '.', ',', '?', '!', '—', ':')) or len(cur) >= 3 or len(text) >= 16
                if brk:
                    chunks.append((p, cur))
                    cur = []
            if cur:
                chunks.append((p, cur))
        out = []
        for i, (p, idx) in enumerate(chunks):
            start = self.wt[p][idx[0]][0]
            if i + 1 < len(chunks):
                np_, nidx = chunks[i + 1]
                end = self.wt[np_][nidx[0]][0]
                if np_ != p:
                    end = min(end, self.wt[p][idx[-1]][1] + 0.35)
            else:
                end = self.wt[p][idx[-1]][1] + 0.5
            words = [(self.words[p][j], self.wt[p][j][0]) for j in idx]
            out.append((start, end, words))
        return out
