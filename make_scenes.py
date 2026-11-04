#!/usr/bin/env python3
"""Write scenes/sceneNN.html from plan.json + script.txt + audio/timings.json.

A scene in plan.json is a list of layers, e.g. {"type": "classroom"} or
{"type": "actor", "char": "president", "x": 250, "y": 1190, "h": 880}.
Each layer type is one small function below (L_<type>), so a new story is just
a new script.txt + plan.json. Times are seconds or refer to subtitle pages:
"p2" = the moment page 2 starts speaking, "p2+0.3", "end-1".

Also writes scenes/timeline.json (scene starts + sound cues) for sound.py.
"""
import copy
import html
import json
import math
import random
import re

from characters import EYE_Y, MOUTH_POS
from story import AUDIO, ROOT, load_plan

W, H = 720, 1280
FEET, KID_FEET = 540, 436          # where the feet are in the 200x560 character box
FACE_C = (100, 108)               # face centre in the character box
SCREEN_TYPES = {"stat", "profile", "ab", "vignette", "redflash"}   # not moved by the camera

FACES = {  # expression -> (eyes, mouth, brows); eyes None = the character's default
    "neutral": (None, "neutral", "neutral"),
    "smile": (None, "smile", "neutral"),
    "smirk": (None, "smirk", "neutral"),
    "grin": ("happy", "grin", "neutral"),
    "happy": ("happy", "smile", "neutral"),
    "shock": ("wide", "o", "raised"),
    "knowing": ("narrow", "smirk", "knowing"),
    "cold": ("narrow", "neutral", "frown"),
}


def A(name, dur, at=0.0, ease="cubic-bezier(.2,.8,.2,1)", fill="both", count="1"):
    """CSS animation shorthand."""
    return f"{name} {dur:.3f}s {ease} {at:.3f}s {count} normal {fill}"


class Scene:
    def __init__(self, n, spec, timing, plan, svgs):
        self.n, self.spec, self.plan, self.svgs = n, spec, plan, svgs
        self.dur = timing["duration"]
        self.pages = timing["pages"]
        self.cues, self.css = [], []
        self.static = False             # True while drawing a frozen copy of an earlier scene
        self.rng = random.Random(1000 + n)
        self._id = 0

    def t(self, v, default=0.0):
        """Resolve a time: 1.2 | "p2" | "p2+0.3" | "end-1"."""
        if self.static:
            return -30.0
        if v is None:
            v = default
        if isinstance(v, (int, float)):
            return float(v)
        m = re.fullmatch(r"\s*(?:p(\d+)|(end))?\s*([+-]\s*\d*\.?\d+)?\s*", str(v))
        if not m:
            raise ValueError(f"bad time {v!r} in scene {self.n}")
        base = self.pages[int(m.group(1)) - 1]["start"] if m.group(1) else (self.dur if m.group(2) else 0.0)
        return base + (float(m.group(3).replace(" ", "")) if m.group(3) else 0.0)

    def uid(self, p="u"):
        self._id += 1
        return f"{p}{self.n}x{self._id}"

    def cue(self, sfx, t):
        if not self.static and 0 <= t < self.dur:
            self.cues.append({"t": round(t, 3), "sfx": sfx})


def gold(text):
    """'*word*' -> <span class="gold">word</span> (HTML-escaped)."""
    return re.sub(r"\*([^*]+)\*", r'<span class="gold">\1</span>', html.escape(text, quote=False))


# ------------------------------------------------------------- characters --
def char_svg(sc, name, kid=False):
    svg = sc.svgs[name]
    u = sc.uid("c")
    svg = re.sub(r'id="([^"]+)"', lambda m: f'id="{u}-{m.group(1)}"', svg)
    svg = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{u}-{m.group(1)})", svg)
    if kid:  # big head, short body
        svg = svg.replace('<g class="body">',
                          '<g class="body" transform="translate(100 170) scale(0.9 0.72) translate(-100 -170)">', 1)
    return svg


def place(a):
    """Return (left, top, scale) of a character box from feet (x, y, h) or face_at + scale."""
    if "face_at" in a:
        s = a["scale"]
        return a["face_at"][0] - FACE_C[0] * s, a["face_at"][1] - FACE_C[1] * s, s
    s = a["h"] / 560
    feet = KID_FEET if a.get("kid") else FEET
    return a["x"] - 100 * s, a["y"] - feet * s, s


def lie_line(sc, x0, y0, at, to=None, thick=False, k=1.0):
    """A glowing red line that grows out of a mouth (or any point)."""
    t = sc.t(at)
    if to is None:
        to = (x0 + sc.rng.uniform(-70, 70), -60)
    x1, y1 = to
    if thick or k > 1.5:  # big face on screen: leave the mouth sideways, then rise (don't cross the eyes)
        sgn = 1 if x1 >= x0 else -1
        c1 = (x0 + sgn * min(abs(x1 - x0) * .55, 170), y0 + 6)
        c2 = (x1 - sgn * 40, y1 + (y0 - y1) * .45)
    else:
        c1 = (x0 + (x1 - x0) * 0.05, y0 - (y0 - y1) * 0.38)
        c2 = (x1 - (x1 - x0) * 0.3, y1 + (y0 - y1) * 0.3)
    d = f"M{x0:.1f},{y0:.1f} C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {x1:.1f},{y1:.1f}"
    w = (6.5 if thick else 2.8) * k
    draw = A("draw", 1.0 if thick else 0.6, t, "cubic-bezier(.35,.6,.25,1)")
    paths = "".join(
        f'<path class="draw" pathLength="1" d="{d}" stroke="{c}" stroke-width="{w * m:.2f}" '
        f'opacity="{o}" style="animation:{draw}"/>'
        for c, m, o in (("#ff1f3d", 5.0, .12), ("#ff1f3d", 2.6, .25), ("#ff4d5e", 1.0, 1), ("#ffd0d4", .35, .9)))
    dot = (f'<circle cx="{x0:.1f}" cy="{y0:.1f}" r="{w * (.7 if thick else 1.25):.1f}" fill="#ff5a66" opacity=".85" '
           f'style="transform-origin:{x0:.1f}px {y0:.1f}px;animation:{A("popDot", .4, t)}"/>')
    sc.cue("zap", t)
    pulse = A("pulse", 1.7, t + 1.0, "ease-in-out", "both", "infinite")
    return f'<svg class="full lie" viewBox="0 0 {W} {H}"><g style="animation:{pulse}">{paths}{dot}</g></svg>'


def actor_html(sc, a, wrap_style=""):
    left, top, s = place(a)
    eyes, mouth, brows = FACES[a.get("face", "neutral")]
    eyes = eyes or sc.plan["cast"][a["char"]].get("eyes", "open")
    aid = sc.uid("a")
    style = [f"left:{left:.1f}px", f"top:{top:.1f}px", f"width:{200 * s:.1f}px", f"height:{560 * s:.1f}px",
             f"--blink:{sc.rng.uniform(4.2, 5.8):.2f}s", f"--blink-delay:{-sc.rng.uniform(0, 4):.2f}s"]
    style += [f"{k}:{v}" for k, v in (a.get("tint") or {}).items()]
    if "opacity" in a:
        style.append(f"opacity:{a['opacity']}")
    enter = a.get("enter")
    if enter:
        name = {"left": "enterLeft", "right": "enterRight", "rise": "rise", "fade": "fadeIn"}[enter]
        style.append(f"animation:{A(name, .8, sc.t(a.get('at', 0)))}")
    if a.get("talk") and not sc.static:  # flap the mouth while this voice speaks
        talks = []
        for p in sc.pages:
            if p["speaker"] == a["talk"]:
                talks.append(A("talk", .19, p["start"] + 0.03, "linear", "none", str(max(1, round((p["end"] - p["start"] - 0.1) / .19)))))
        if talks:
            sc.css.append(f"#{aid} .mouth .m-talk{{animation:{','.join(talks)}}}")
    cls = "actor" + (" noblink" if a.get("blink") is False else "")
    out = (f'<div id="{aid}" class="{cls}" data-eyes="{eyes}" data-mouth="{mouth}" data-brows="{brows}" '
           f'style="{";".join(style)};{wrap_style}">{char_svg(sc, a["char"], a.get("kid"))}</div>')
    if a.get("lie") is not None:
        lie = a["lie"] if isinstance(a["lie"], dict) else {"at": a["lie"]}
        mx, my = left + MOUTH_POS[0] * s, top + MOUTH_POS[1] * s
        out += lie_line(sc, mx, my, lie.get("at", 0), lie.get("to"), lie.get("thick", False), lie.get("k", max(1.0, s)))
    return out


# ------------------------------------------------------------- layers -------
def L_actor(sc, L):
    return actor_html(sc, L)


def L_desks(sc, L):
    """A row of seated students behind desks."""
    sts, y, h = L["students"], L["y"], L["h"]
    s = h / 560
    xs = L.get("xs") or [W * (i + .5) / len(sts) for i in range(len(sts))]
    out = []
    for x, st in zip(xs, sts):
        top = y + 16 * s - 332 * s
        out.append(actor_html(sc, dict(st, x=x, h=h, y=top + FEET * s)))
    for x in xs:
        dw, ph = 196 * s, 130 * s
        out.append(
            f'<svg class="abs" style="left:{x - dw / 2 - 4:.1f}px;top:{y - 10 * s:.1f}px" width="{dw + 8:.1f}" height="{ph + 110 * s:.1f}">'
            f'<rect x="{4 + 14 * s:.1f}" y="{ph:.1f}" width="{8 * s:.1f}" height="{100 * s:.1f}" fill="#3a4145"/>'
            f'<rect x="{dw - 14 * s - 4:.1f}" y="{ph:.1f}" width="{8 * s:.1f}" height="{100 * s:.1f}" fill="#3a4145"/>'
            f'<rect x="{4 + 8 * s:.1f}" y="{16 * s:.1f}" width="{dw - 16 * s:.1f}" height="{ph - 14 * s:.1f}" fill="#4d565b" stroke="#232a2e" stroke-width="2"/>'
            f'<rect x="{4 + 8 * s:.1f}" y="{ph - 22 * s:.1f}" width="{dw - 16 * s:.1f}" height="{8 * s:.1f}" fill="#3c4448"/>'
            f'<rect x="4" y="2" width="{dw:.1f}" height="{18 * s:.1f}" rx="3" fill="#737d82" stroke="#232a2e" stroke-width="2"/>'
            f'<rect x="6" y="3" width="{dw - 4:.1f}" height="{5 * s:.1f}" fill="#8e989c"/></svg>')
    return "".join(out)


def concrete_wall(u):
    return (f'<defs><linearGradient id="{u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4dcdf"/>'
            f'<stop offset="1" stop-color="#9eabb0"/></linearGradient>'
            f'<pattern id="{u}d" width="72" height="72" patternUnits="userSpaceOnUse">'
            f'<circle cx="36" cy="36" r="3" fill="#8a969a"/><circle cx="36" cy="36" r="1.3" fill="#6b777b"/>'
            f'<path d="M0,0.5 H72" stroke="#b9c3c6" stroke-width="1"/></pattern></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#{u}w)"/><rect width="{W}" height="{H}" fill="url(#{u}d)" opacity=".75"/>')


def window_band(sc, u, x, y, w, h, cols=4):
    sky = (f'<linearGradient id="{u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9fe0"/>'
           f'<stop offset="1" stop-color="#c8e8f8"/></linearGradient>')
    clouds = []
    for i in range(6):
        cx, cy, r = x + sc.rng.uniform(0, w), y + sc.rng.uniform(.12, .5) * h, sc.rng.uniform(26, 44)
        clouds.append(f'<g style="animation:drift {sc.rng.uniform(26, 40):.1f}s linear {-sc.rng.uniform(0, 20):.1f}s infinite;'
                      f'--dx:{sc.rng.choice([-1, 1]) * 60}px;--dy:0px" fill="#fff" opacity=".92">'
                      f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{r * 1.6:.0f}" ry="{r * .55:.0f}"/>'
                      f'<ellipse cx="{cx - r * .5:.0f}" cy="{cy - r * .3:.0f}" rx="{r * .7:.0f}" ry="{r * .5:.0f}"/>'
                      f'<ellipse cx="{cx + r * .4:.0f}" cy="{cy - r * .4:.0f}" rx="{r * .8:.0f}" ry="{r * .6:.0f}"/></g>')
    trees = []
    for i in range(16):
        cx = x + i * w / 15 + sc.rng.uniform(-14, 14)
        r = sc.rng.uniform(44, 70)
        col = sc.rng.choice(["#3f8a49", "#4c9a53", "#5aa85c", "#367c40"])
        trees.append(f'<circle cx="{cx:.0f}" cy="{y + h - r * .55:.0f}" r="{r:.0f}" fill="{col}" stroke="#2d6a35" stroke-width="2"/>')
    bars = "".join(f'<rect x="{x + w * k / cols - 5:.0f}" y="{y}" width="10" height="{h}" fill="#3d464b"/>' for k in range(1, cols))
    return (f'<defs>{sky}<clipPath id="{u}c"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath></defs>'
            f'<rect x="{x - 12}" y="{y - 12}" width="{w + 24}" height="{h + 24}" rx="4" fill="#3d464b"/>'
            f'<g clip-path="url(#{u}c)"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{u}s)"/>'
            f'{"".join(clouds)}{"".join(trees)}</g>{bars}'
            f'<rect x="{x}" y="{y + h * .5 - 4:.0f}" width="{w}" height="8" fill="#3d464b"/>'
            f'<rect x="{x - 18}" y="{y + h + 10}" width="{w + 36}" height="16" fill="#9aa5a9" stroke="#6f7a7e" stroke-width="2"/>')


def light_rays(sc, rays, color="255,255,255"):
    out = []
    for i, (x0, w0, x1, w1, op) in enumerate(rays):
        out.append(f'<polygon points="{x0},0 {x0 + w0},0 {x1 + w1},{H} {x1},{H}" fill="rgb({color})" '
                   f'style="--o1:{op * .55:.3f};--o2:{op:.3f};opacity:{op};animation:breathe {sc.rng.uniform(3.5, 6):.1f}s ease-in-out '
                   f'{-sc.rng.uniform(0, 3):.1f}s infinite"/>')
    return "".join(out)


def L_classroom(sc, L):
    u = sc.uid("cl")
    dim = L.get("dim", 0)
    return (f'<svg class="full" viewBox="0 0 {W} {H}">{concrete_wall(u)}{window_band(sc, u, 36, 46, 648, 282)}'
            f'<rect y="1056" width="{W}" height="8" fill="#6c777b"/><rect y="1064" width="{W}" height="216" fill="#87949a"/>'
            f'{light_rays(sc, [(60, 70, 220, 160, .13), (230, 50, 420, 120, .10), (420, 80, 640, 170, .12)])}'
            f'<rect width="{W}" height="{H}" fill="#000" opacity="{dim}"/></svg>')


def L_board(sc, L):
    u = sc.uid("bd")
    lines = L.get("text", "").split("\n")
    text = "".join(f'<text x="360" y="{372 + i * 84}" text-anchor="middle">{html.escape(t)}</text>' for i, t in enumerate(lines))
    return (f'<svg class="full" viewBox="0 0 {W} {H}">{concrete_wall(u)}'
            f'<defs><linearGradient id="{u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5a47"/>'
            f'<stop offset="1" stop-color="#173828"/></linearGradient></defs>'
            f'<rect x="44" y="236" width="632" height="500" rx="8" fill="#6b4a2f" stroke="#3b2717" stroke-width="3"/>'
            f'<rect x="62" y="254" width="596" height="458" fill="url(#{u}g)"/>'
            f'<ellipse cx="200" cy="330" rx="130" ry="40" fill="#fff" opacity=".05"/>'
            f'<ellipse cx="520" cy="640" rx="150" ry="36" fill="#fff" opacity=".045"/>'
            f'<g fill="#eef1e8" opacity=".93" style="font:italic 700 60px \'Playfair Display\';letter-spacing:1px">{text}</g>'
            f'<path d="M196,474 C300,466 420,470 528,464" stroke="#eef1e8" stroke-width="4" fill="none" opacity=".8" stroke-linecap="round"/>'
            f'<rect x="54" y="730" width="612" height="16" rx="3" fill="#5a3d27"/>'
            f'<rect x="120" y="723" width="34" height="8" rx="3" fill="#f2f2ea"/><rect x="170" y="724" width="22" height="7" rx="3" fill="#f7c9c9"/>'
            f'<rect y="1056" width="{W}" height="8" fill="#6c777b"/><rect y="1064" width="{W}" height="216" fill="#87949a"/>'
            f'{light_rays(sc, [(520, 90, 300, 200, .10), (640, 60, 520, 160, .08)])}</svg>')


def L_crowd(sc, L):
    y, n = L.get("y", H), L.get("count", 5)
    heads = []
    for i in range(n):
        cx = W * (i + .5) / n + sc.rng.uniform(-30, 30)
        r = sc.rng.uniform(70, 86)
        heads.append(f'<ellipse cx="{cx:.0f}" cy="{y + 40}" rx="{r * 1.75:.0f}" ry="{r:.0f}"/>'
                     f'<circle cx="{cx:.0f}" cy="{y - r * .95:.0f}" r="{r * .82:.0f}"/>')
    return f'<svg class="full" viewBox="0 0 {W} {H}"><g fill="#0a0c13" opacity=".93">{"".join(heads)}</g></svg>'


def L_hallway(sc, L):
    u = sc.uid("hw")
    vx, top_y, bot_y, lx, rx = 360, 430, 702, 282, 438
    lockers = []
    xs = [0, 64, 118, 160, 194, 220, 240, 256, 268, 277, 282]
    for i in range(len(xs) - 1):
        xa, xb = xs[i], xs[i + 1]
        ta, tb = top_y * xa / lx, top_y * xb / lx
        ba, bb = H - (H - bot_y) * xa / lx, H - (H - bot_y) * xb / lx
        ya, yb = ta + (ba - ta) * .12, tb + (bb - tb) * .12
        za, zb = ta + (ba - ta) * .86, tb + (bb - tb) * .86
        k = i / (len(xs) - 2)
        col = f"url(#{u}L{1 if k > .55 else 0})"
        lockers.append(f'<polygon points="{xa},{ya:.1f} {xb},{yb:.1f} {xb},{zb:.1f} {xa},{za:.1f}" fill="{col}" '
                       f'stroke="#2a0f14" stroke-width="{max(.8, 3 * (1 - k)):.1f}"/>')
        vy = ya + (za - ya) * .1
        lockers.append(f'<path d="M{xa + (xb - xa) * .25:.1f},{vy:.1f} L{xa + (xb - xa) * .75:.1f},{vy + (yb - ya) * .5:.1f}" '
                       f'stroke="#3a1218" stroke-width="{max(.6, 4 * (1 - k)):.1f}" opacity=".6"/>')
    doors = []
    for xa, xb in ((470, 520), (560, 640)):
        ta, tb = top_y + (0 - top_y) * (xa - rx) / (W - rx), top_y + (0 - top_y) * (xb - rx) / (W - rx)
        ba, bb = bot_y + (H - bot_y) * (xa - rx) / (W - rx), bot_y + (H - bot_y) * (xb - rx) / (W - rx)
        doors.append(f'<polygon points="{xa},{ta + (ba - ta) * .2:.0f} {xb},{tb + (bb - tb) * .2:.0f} {xb},{bb:.0f} {xa},{ba:.0f}" '
                     f'fill="#0b0f1c" stroke="#26304a" stroke-width="3"/>')
    tiles = "".join(f'<path d="M{lx - (lx) * f:.0f},{bot_y + (H - bot_y) * f:.0f} L{rx + (W - rx) * f:.0f},{bot_y + (H - bot_y) * f:.0f}" '
                    f'stroke="#2a3148" stroke-width="{1 + 2 * f:.1f}" opacity=".7"/>'
                    for f in [(i / 9) ** 1.9 for i in range(1, 10)])
    return f'''<svg class="full" viewBox="0 0 {W} {H}">
<defs>
 <linearGradient id="{u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070d"/><stop offset="1" stop-color="#1a2133"/></linearGradient>
 <linearGradient id="{u}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0b0f19"/><stop offset=".75" stop-color="#2b2b3d"/><stop offset="1" stop-color="#6b5050"/></linearGradient>
 <linearGradient id="{u}r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0c1120"/><stop offset="1" stop-color="#1d2740"/></linearGradient>
 <linearGradient id="{u}L0" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5c1d22"/><stop offset="1" stop-color="#b8443a"/></linearGradient>
 <linearGradient id="{u}L1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9644a"/><stop offset="1" stop-color="#ffb07a"/></linearGradient>
 <linearGradient id="{u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e2"/><stop offset="1" stop-color="#ffc98f"/></linearGradient>
 <radialGradient id="{u}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd7a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffd7a8" stop-opacity="0"/></radialGradient>
 <linearGradient id="{u}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf9a" stop-opacity=".5"/><stop offset="1" stop-color="#ffcf9a" stop-opacity="0"/></linearGradient>
</defs>
<polygon points="0,0 {W},0 {rx},{top_y} {lx},{top_y}" fill="url(#{u}c)"/>
<polygon points="0,{H} {W},{H} {rx},{bot_y} {lx},{bot_y}" fill="url(#{u}f)"/>
{tiles}
<polygon points="300,{bot_y} 420,{bot_y} 560,{H} 160,{H}" fill="url(#{u}p)"/>
<polygon points="0,0 {lx},{top_y} {lx},{bot_y} 0,{H}" fill="#140b10"/>
{"".join(lockers)}
<polygon points="{W},0 {rx},{top_y} {rx},{bot_y} {W},{H}" fill="url(#{u}r)"/>
{"".join(doors)}
<rect x="{lx}" y="{top_y}" width="{rx - lx}" height="{bot_y - top_y}" fill="#121624"/>
<g style="animation:flicker 4.2s linear -1s infinite">
 <ellipse cx="{vx}" cy="585" rx="260" ry="250" fill="url(#{u}g)"/>
 <rect x="300" y="468" width="120" height="{bot_y - 468}" fill="url(#{u}d)"/>
 <polygon points="{vx - 6},0 {vx + 6},0 {vx + 1.5},{top_y} {vx - 1.5},{top_y}" fill="#c9d8ff" opacity=".35"/>
</g>
</svg>'''


def L_silhouette(sc, L):
    x, y, h = L["x"], L["y"], L["h"]
    s = h / 100
    body = ("M-10,-77 C-15,-76 -18,-71 -18,-65 L-18,-40 L-13.5,-40 L-12.5,-60 L-11,-36 L-9,0 L-1.5,0 L0,-30 L1.5,0 L9,0 "
            "L11,-36 L12.5,-60 L13.5,-40 L18,-40 L18,-65 C18,-71 15,-76 10,-77 Z")
    return (f'<svg class="full" viewBox="0 0 {W} {H}"><g transform="translate({x} {y}) scale({s})" fill="#06060b">'
            f'<circle cx="0" cy="-88" r="8.5"/><path d="{body}"/><rect x="-3" y="-81" width="6" height="6"/></g></svg>')


def L_lasers(sc, L):
    x0, y0 = L["from"]
    t0, st = sc.t(L.get("at", 0)), L.get("stagger", .3)
    out = []
    for i, (x1, y1) in enumerate(L["to"]):
        t = t0 + i * st
        d = f"M{x0},{y0} L{x1},{y1}"
        draw = A("draw", .7, t, "cubic-bezier(.4,.6,.3,1)")
        out.append("".join(f'<path class="draw" pathLength="1" d="{d}" stroke="{c}" stroke-width="{w}" opacity="{o}" '
                           f'style="animation:{draw}"/>'
                           for c, w, o in (("#ff1f3d", 12, .1), ("#ff2d4a", 5, .3), ("#ff6b78", 1.8, .95))))
        if i % 3 == 0:
            sc.cue("zap", t)
    pulse = A("pulse", 2.2, t0 + 1, "ease-in-out", "both", "infinite")
    return (f'<svg class="full lie" viewBox="0 0 {W} {H}" style="mix-blend-mode:screen">'
            f'<g style="animation:{pulse}" stroke-linecap="round">{"".join(out)}</g></svg>')


def L_dust(sc, L):
    color = L.get("color", "255,226,196")
    dots = []
    for _ in range(L.get("count", 30)):
        x, y, r = sc.rng.uniform(0, W), sc.rng.uniform(80, H - 80), sc.rng.uniform(1.2, 3.2)
        dur = sc.rng.uniform(5, 10)
        dots.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="rgba({color},{sc.rng.uniform(.25, .7):.2f})" '
                    f'style="--dx:{sc.rng.uniform(-30, 30):.0f}px;--dy:{-sc.rng.uniform(40, 120):.0f}px;'
                    f'animation:drift {dur:.1f}s linear {-sc.rng.uniform(0, dur):.1f}s infinite alternate"/>')
    return f'<svg class="full" viewBox="0 0 {W} {H}">{"".join(dots)}</svg>'


def L_vignette(sc, L):
    k = L.get("strength", .6)
    return (f'<div class="fill" style="background:radial-gradient(ellipse 75% 65% at 50% 46%, rgba(0,0,0,0) 45%, '
            f'rgba(0,0,0,{k}) 100%)"></div>')


def L_memory(sc, L):
    """Flashback: framed memory picture with a curtain and a hanging sign."""
    fx, fy, fw, fh = 84, 300, 552, 640
    t0 = sc.t(L.get("at", 0))
    u = sc.uid("m")
    kids = "".join(render_layer(sc, c) for c in L.get("layers", []))
    park = f'''<svg class="abs" style="left:0;top:0" width="{fw}" height="{fh}" viewBox="0 0 {fw} {fh}">
 <defs><linearGradient id="{u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc0ea"/><stop offset="1" stop-color="#d9eef6"/></linearGradient>
 <radialGradient id="{u}sun"><stop offset="0" stop-color="#fff3b0"/><stop offset=".4" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient></defs>
 <rect width="{fw}" height="{fh}" fill="url(#{u}s)"/>
 <circle cx="430" cy="120" r="110" fill="url(#{u}sun)"/><circle cx="430" cy="120" r="34" fill="#ffe78a" stroke="#e8b84a" stroke-width="3"/>
 <g fill="#ffffff" opacity=".9"><ellipse cx="120" cy="110" rx="70" ry="22"/><ellipse cx="100" cy="96" rx="34" ry="22"/><ellipse cx="150" cy="94" rx="40" ry="26"/>
 <ellipse cx="300" cy="190" rx="54" ry="16"/><ellipse cx="320" cy="178" rx="30" ry="18"/></g>
 <g stroke="#2d6a35" stroke-width="2">{"".join(f'<circle cx="{x}" cy="{378 + (x * 7) % 23}" r="{46 + (x * 13) % 22}" fill="{c}"/>' for x, c in zip(range(-10, 600, 52), ["#4c9a53", "#3f8a49", "#5aa85c"] * 5))}</g>
 <rect y="420" width="{fw}" height="{fh - 420}" fill="#76bd62"/><rect y="420" width="{fw}" height="10" fill="#5ea24e"/>
 <g stroke="#7a4a2a" stroke-width="7" stroke-linecap="round" fill="none"><path d="M402,560 L440,300 L478,560 M470,560 L508,300 L546,560 M440,300 L508,300"/></g>
 <g stroke="#555" stroke-width="2"><path d="M458,302 L458,470 M486,302 L486,470"/></g><rect x="448" y="468" width="48" height="9" rx="3" fill="#c0392b" stroke="#2a1e2b" stroke-width="2"/>
 <g stroke="#2a1e2b" stroke-width="3" stroke-linejoin="round"><path d="M10,560 L10,430 L40,430 L40,470 L130,560 Z" fill="#f2b33d"/><path d="M40,470 L130,560 L112,560 L32,480 Z" fill="#e0952a"/></g>
</svg>'''
    sign = (f'<div class="abs" style="left:{W / 2 - 115}px;top:262px;width:230px;height:110px;transform-origin:50% 0;'
            f'animation:swing 3.2s ease-in-out -0.8s infinite">'
            f'<svg class="abs" style="left:0;top:0" width="230" height="40"><path d="M40,0 L60,40 M190,0 L170,40" stroke="#c9a45c" stroke-width="2.5"/></svg>'
            f'<div class="abs" style="left:28px;top:38px;width:174px;height:62px;border-radius:8px;background:linear-gradient(#3a3a46,#24242d);'
            f'border:2px solid #c9a45c;box-shadow:0 10px 24px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;'
            f'font:italic 800 34px/1 \'Playfair Display\';color:#f6e3b4;letter-spacing:1px">{html.escape(L.get("label", ""))}</div></div>')
    scallops = "".join(f'<path d="M{x},0 L{x},44 Q{x + 31},70 {x + 62},44 L{x + 62},0 Z" fill="#a31c25" stroke="#5e0d14" stroke-width="2"/>'
                       f'<path d="M{x + 18},0 L{x + 18},52 M{x + 44},0 L{x + 44},52" stroke="#7d121b" stroke-width="4" opacity=".7"/>'
                       for x in range(0, 620, 62))
    curtain = (f'<svg class="abs" style="left:50px;top:226px" width="620" height="80" viewBox="0 0 620 80">'
               f'<rect width="620" height="12" fill="#c9a45c"/>{scallops}</svg>')
    return (f'<div class="fill" style="background:radial-gradient(ellipse at 50% 46%, #43291c 0%, #170e0a 62%, #090605 100%)"></div>'
            f'<div class="abs" style="left:{fx - 16}px;top:{fy - 16}px;width:{fw + 32}px;height:{fh + 32}px;animation:{A("cardIn", .8, t0)}">'
            f'<div class="fill" style="background:linear-gradient(#5a3a24,#2c1b11);border-radius:8px;'
            f'box-shadow:0 30px 70px rgba(0,0,0,.7), inset 0 0 0 3px #c9a45c"></div>'
            f'<div class="abs" style="left:16px;top:16px;width:{fw}px;height:{fh}px;overflow:hidden;border-radius:3px">'
            f'{park}'
            f'<div class="fill" style="background:linear-gradient(rgba(255,214,150,.22),rgba(140,80,30,.34));mix-blend-mode:multiply"></div>'
            f'{kids}'
            f'<div class="fill" style="box-shadow:inset 0 0 110px rgba(50,25,5,.7)"></div></div></div>'
            f'{curtain}{sign}')


def L_spotlight(sc, L):
    x = L.get("x", 360)
    u = sc.uid("sp")
    return (f'<svg class="full" viewBox="0 0 {W} {H}" style="mix-blend-mode:screen"><defs>'
            f'<linearGradient id="{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d6" stop-opacity=".55"/>'
            f'<stop offset="1" stop-color="#fff2d6" stop-opacity=".05"/></linearGradient>'
            f'<radialGradient id="{u}e"><stop offset="0" stop-color="#fff2d6" stop-opacity=".45"/><stop offset="1" stop-color="#fff2d6" stop-opacity="0"/></radialGradient></defs>'
            f'<g style="animation:{A("fadeIn", .6, 0)}"><polygon points="{x - 50},-20 {x + 50},-20 {x + 250},{H} {x - 250},{H}" fill="url(#{u})"/>'
            f'<ellipse cx="{x}" cy="1185" rx="230" ry="46" fill="url(#{u}e)"/></g></svg>')


def L_hearts(sc, L):
    t0 = sc.t(L.get("at", 0))
    x0, x1 = L.get("x", [60, 660])
    out = []
    for i in range(L.get("count", 12)):
        x, y, s = sc.rng.uniform(x0, x1), sc.rng.uniform(820, 1150), sc.rng.uniform(.6, 1.3)
        t = t0 + i * .16 + sc.rng.uniform(0, .2)
        out.append(f'<div class="abs" style="left:{x:.0f}px;top:{y:.0f}px;animation:{A("floatUp", sc.rng.uniform(2.6, 3.6), t, "ease-out", "both", "1")}">'
                   f'<svg width="{28 * s:.0f}" height="{26 * s:.0f}" viewBox="0 0 28 26"><path d="M14,25 C4,17 0,12 0,7 C0,3 3,0 7,0 C10,0 12,2 14,5 '
                   f'C16,2 18,0 21,0 C25,0 28,3 28,7 C28,12 24,17 14,25 Z" fill="#ff7aa8" stroke="#8a1f45" stroke-width="2"/></svg></div>')
    return "".join(out)


def L_profile(sc, L):
    t = sc.t(L.get("at", 0))
    sc.cue("ding", t + .1)
    rows = "".join(f'<div class="row">{html.escape(k)}<b class="{"stars" if "★" in v else ""}">{html.escape(v)}</b></div>'
                   for k, v in L.get("rows", []))
    return (f'<div class="profile" style="left:{L["x"]}px;top:{L["y"]}px;animation:{A("cardIn", .7, t)}">'
            f'<div class="kicker">{html.escape(L.get("kicker", ""))}</div><div class="name">{html.escape(L.get("name", ""))}</div>'
            f'{rows}<div class="foot">{html.escape(L.get("footer", ""))}</div></div>')


def L_dreamy(sc, L):
    blobs = []
    for _ in range(18):
        x, y, r = sc.rng.uniform(-40, W + 40), sc.rng.uniform(-40, H - 200), sc.rng.uniform(40, 140)
        col = sc.rng.choice(["255,255,255", "255,170,214", "196,160,255", "255,214,236"])
        blobs.append(f'<div class="abs" style="left:{x - r:.0f}px;top:{y - r:.0f}px;width:{2 * r:.0f}px;height:{2 * r:.0f}px;border-radius:50%;'
                     f'background:radial-gradient(circle, rgba({col},{sc.rng.uniform(.18, .4):.2f}) 0%, rgba({col},0) 70%);'
                     f'--dx:{sc.rng.uniform(-40, 40):.0f}px;--dy:{sc.rng.uniform(-60, -10):.0f}px;'
                     f'animation:drift {sc.rng.uniform(6, 10):.1f}s ease-in-out {-sc.rng.uniform(0, 5):.1f}s infinite alternate"></div>')
    return (f'<div class="fill" style="background:radial-gradient(ellipse 90% 70% at 50% 30%, #f5b5d3 0%, #b27cd0 45%, #3a2a6e 80%, #1a1438 100%)"></div>'
            + "".join(blobs))


def L_sparkles(sc, L):
    out = []
    for _ in range(L.get("count", 10)):
        x, y, s = sc.rng.uniform(60, W - 60), sc.rng.uniform(120, 800), sc.rng.uniform(.6, 1.4)
        dur = sc.rng.uniform(1.4, 2.4)
        out.append(f'<svg class="abs" style="left:{x:.0f}px;top:{y:.0f}px;animation:twinkle {dur:.1f}s ease-in-out {-sc.rng.uniform(0, dur):.1f}s infinite" '
                   f'width="{30 * s:.0f}" height="{30 * s:.0f}" viewBox="-15 -15 30 30"><path d="M0,-15 Q2,-2 15,0 Q2,2 0,15 Q-2,2 -15,0 Q-2,-2 0,-15 Z" fill="#fff8e1"/></svg>')
    return "".join(out)


def L_stat(sc, L):
    t = sc.t(L.get("at", 0))
    sc.cue("ding", t + .08)
    val = html.escape(str(L["value"]).replace("-", "−"))
    count = f' data-count="{val}" data-at="{t + .15:.3f}" data-dur=".7"' if L.get("count") else ""
    cls = "stat " + L.get("color", "red") + (" big" if L.get("big") else "")
    return (f'<div class="stat-wrap" style="top:{L.get("y", 400)}px"><div class="{cls}" style="animation:{A("popIn", .6, t, "ease-out")}">'
            f'<div class="label">{html.escape(L["label"])}</div><div class="value"{count}>{val}</div></div></div>')


def L_redflash(sc, L):
    t = sc.t(L.get("at", 0))
    sc.cue("boom", t)
    return (f'<div class="fill" style="background:rgba(255,20,50,.42);mix-blend-mode:screen;opacity:0;animation:{A("flash", .9, t, "ease-out", "none")}"></div>'
            f'<div class="fill" style="background:radial-gradient(ellipse 80% 70% at 50% 45%, rgba(120,0,20,0) 40%, rgba(150,0,25,.55) 100%);'
            f'animation:{A("fadeIn", 1.2, t)}"></div>')


def L_void(sc, L):
    return '<div class="fill" style="background:radial-gradient(ellipse at 50% 45%, #1b1426 0%, #07060b 70%)"></div>'


def L_eyeband(sc, L):
    y, h, t = L["y"], L["h"], sc.t(L.get("at", 0))
    s = L.get("scale", 7.4)
    frm = "-110%" if L.get("from", "left") == "left" else "110%"
    actor = actor_html(sc, {"char": L["char"], "face": L.get("face", "neutral"), "face_at": [360, h / 2 + (FACE_C[1] - EYE_Y) * s], "scale": s})
    sc.cue("whoosh2", t)
    return (f'<div class="abs" style="left:0;top:{y}px;width:{W}px;height:{h}px;overflow:hidden;--from:{frm};'
            f'animation:{A("bandIn", .9, t)};box-shadow:0 0 0 2px rgba(255,80,96,.55), 0 0 40px rgba(255,40,70,.35)">'
            f'<div class="fill" style="animation:{A("slowZoom", sc.dur, 0, "linear")}">{actor}</div>'
            f'<div class="fill" style="background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 70%,rgba(0,0,0,.4))"></div></div>')


def L_burst(sc, L):
    lines = []
    for _ in range(70):
        a = sc.rng.uniform(0, 2 * math.pi)
        r0, r1 = sc.rng.uniform(140, 260), sc.rng.uniform(700, 1100)
        lines.append(f'<path d="M{360 + r0 * math.cos(a):.0f},{560 + r0 * math.sin(a):.0f} L{360 + r1 * math.cos(a):.0f},{560 + r1 * math.sin(a):.0f}" '
                     f'stroke-width="{sc.rng.uniform(1, 3.5):.1f}" opacity="{sc.rng.uniform(.08, .3):.2f}"/>')
    return (f'<div class="fill" style="background:radial-gradient(ellipse at 50% 44%, #1a1d3a 0%, #07080f 70%)"></div>'
            f'<svg class="full" viewBox="0 0 {W} {H}"><g stroke="#cfd8ff" style="transform-origin:360px 560px;'
            f'animation:spin 90s linear 0s infinite">{"".join(lines)}</g></svg>')


def L_ab(sc, L):
    out = []
    for key, top, slide in (("a", 186, "slideL"), ("b", 560, "slideR")):
        p = L[key]
        t = sc.t(p.get("at", 0))
        sc.cue("whoosh2", t)
        out.append(f'<div class="panel {key}" style="top:{top}px;animation:{A(slide, .75, t)}, {A("glowPulse", 2.4, t + 1, "ease-in-out", "both", "infinite")}">'
                   f'<div class="letter">{key.upper()}</div><div class="title">{gold(p["title"])}</div>'
                   f'<div class="small">{html.escape(p.get("sub", ""))}</div></div>')
    t = sc.t(L["a"].get("at", 0)) + .5
    out.append(f'<svg class="full lie" viewBox="0 0 {W} {H}"><g stroke-linecap="round">'
               + "".join(f'<path class="draw" pathLength="1" d="M700,120 L30,960" stroke="{c}" stroke-width="{w}" opacity="{o}" '
                         f'style="animation:{A("draw", .8, t)}"/>' for c, w, o in (("#ff1f3d", 12, .12), ("#ff3b4e", 3, .9)))
               + '</g></svg>')
    return "".join(out)


TYPES = {k[2:]: v for k, v in globals().items() if k.startswith("L_")}


def render_layer(sc, L):
    if L["type"] not in TYPES:
        raise SystemExit(f"scene {sc.n}: unknown layer type {L['type']!r} (known: {', '.join(sorted(TYPES))})")
    return TYPES[L["type"]](sc, L)


# ------------------------------------------------------------- page --------
def whoosh_overlay(sc):
    sc.cue("whoosh_text", 0)
    lines = "".join(f'<path d="M{360 + 160 * math.cos(a):.0f},{560 + 160 * math.sin(a):.0f} '
                    f'L{360 + 700 * math.cos(a):.0f},{560 + 700 * math.sin(a):.0f}" stroke-width="{2 + k % 3}"/>'
                    for k, a in enumerate(i * math.pi / 12 for i in range(24)))
    return (f'<svg class="full" viewBox="0 0 {W} {H}" style="transform-origin:360px 560px;animation:{A("speedLines", .8, 0, "ease-out", "both")}">'
            f'<g stroke="#e6eeff" opacity=".55">{lines}</g></svg>'
            f'<div class="whoosh" style="animation:{A("whooshText", .9, .02, "ease-out")}">whoosh</div>')


def subtitles(sc):
    out = ['<div class="shade-bottom"></div>']
    voices = sc.plan["voices"]
    for i, p in enumerate(sc.pages):
        start = max(0.0, p["start"] - .06)
        anim = A("subIn", .38, start)
        if i + 1 < len(sc.pages):
            anim += ", " + A("subOut", .22, sc.pages[i + 1]["start"] - .26, "ease-in", "forwards")
        tag = voices.get(p["speaker"], {}).get("tag") if p["speaker"] != "narrator" else None
        tag_html = f'<span class="tag">{html.escape(tag)}</span>' if tag else ""
        out.append(f'<div class="sub" style="animation:{anim}">{tag_html}{gold(p["markup"])}</div>')
    return "".join(out)


def build_scene(sc):
    spec = sc.spec
    layers = []
    if "copy" in spec:  # frozen end-state of an earlier scene as background
        src = sc.plan["scenes"][spec["copy"] - 1]
        layers += [dict(L, _static=True) for L in copy.deepcopy(src["layers"])]
    layers += spec.get("layers", []) + spec.get("layers+", [])
    cam, screen = [], []
    for L in layers:
        sc.static = L.get("_static", False)
        (screen if L["type"] in SCREEN_TYPES else cam).append(render_layer(sc, L))
        sc.static = False
    z0, z1 = spec.get("zoom", [1.0, 1.08])
    filt = ""
    if spec.get("blur") or spec.get("dim"):
        filt = f"filter:blur({spec.get('blur', 0)}px) brightness({1 - spec.get('dim', 0):.2f});"
    cam_style = (f"--z0:{z0};--z1:{z1};transform-origin:{spec.get('origin', '50% 50%')};{filt}"
                 f"animation:{A('kenburns', sc.dur, 0, 'cubic-bezier(.33,.1,.67,.95)')}")
    extra = whoosh_overlay(sc) if spec.get("whoosh") else ""
    if sc.n == len(sc.plan["scenes"]):  # fade the very end to black
        extra += f'<div class="fill" style="background:#000;opacity:0;animation:{A("fadeIn", .6, sc.dur - .6, "ease-in")}"></div>'
    body = (f'<div id="stage"><div class="cam" style="{cam_style}">{"".join(cam)}</div>'
            f'{"".join(screen)}{subtitles(sc)}{extra}</div>')
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Scene {sc.n:02d} - {html.escape(spec.get("id", ""))}</title>
<meta name="viewport" content="width=720">
<link rel="stylesheet" href="../style.css">
<script src="../anim.js"></script>
<style>{"".join(sc.css)}</style>
</head>
<body>
<!-- generated by make_scenes.py from plan.json + script.txt; duration {sc.dur:.3f}s -->
{body}
</body>
</html>
'''


def main():
    plan = load_plan()
    timings = json.loads((AUDIO / "timings.json").read_text())
    svgs = {p.stem: p.read_text() for p in (ROOT / "characters").glob("*.svg")}
    (ROOT / "scenes").mkdir(exist_ok=True)
    timeline, t0 = {"fps": plan["fps"], "scenes": [], "cues": []}, 0.0
    for n, spec in enumerate(plan["scenes"], 1):
        timing = timings["scenes"][n - 1]
        sc = Scene(n, spec, timing, plan, svgs)
        (ROOT / "scenes" / f"scene{n:02d}.html").write_text(build_scene(sc), encoding="utf-8")
        timeline["scenes"].append({"n": n, "id": spec.get("id"), "start": round(t0, 3), "duration": sc.dur})
        timeline["cues"].append({"t": round(t0, 3), "sfx": "whoosh"})
        timeline["cues"] += [{"t": round(t0 + c["t"], 3), "sfx": c["sfx"]} for c in sc.cues]
        print(f"scenes/scene{n:02d}.html  {sc.dur:5.2f}s  {spec.get('id', '')}")
        t0 += sc.dur
    timeline["total"] = round(t0, 3)
    timeline["cues"].sort(key=lambda c: c["t"])
    (ROOT / "scenes" / "timeline.json").write_text(json.dumps(timeline, indent=1))
    print(f"total {t0:.2f}s, {len(timeline['cues'])} sound cues -> scenes/timeline.json")


if __name__ == "__main__":
    main()
