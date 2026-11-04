#!/usr/bin/env python3
"""Draw the cast as flat vector SVGs -> characters/<name>.svg

Every character shares one body (red blazer, white shirt, navy tie, green
trousers or skirt) and gets its own hair, eye colour and extras from the
"cast" block in plan.json. Faces contain every expression as hidden groups;
CSS in style.css picks one with data-eyes / data-mouth / data-brows on the
wrapper, so one SVG can smile, talk, blink or look cold.

viewBox is 0 0 200 560: feet at y~540, eyes at y=106, mouth at (100, 141).
"""
import re

from story import ROOT, load_plan

OL = "#2a1e2b"          # outline
BLAZER, BLAZER_SH = "#c62a30", "#9e1d26"
GOLD = "#e9b949"
SHIRT = "#f6f4f1"
TIE = "#1f2b5e"
GREEN, GREEN_SH = "#2f6a46", "#22513a"
SHOE, SOCK = "#3a2622", "#1f2547"
MOUTH = "#7a2a33"
SKIN = "#f6d5bf"

EYE_L, EYE_R, EYE_Y = 76, 124, 106
MOUTH_POS = (100, 141)
HIDDEN = ' opacity="0"'


def shade(hex_color, f):
    """Darken (f<0) or lighten (f>0) a #rrggbb colour."""
    c = [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]
    c = [round(v + (255 - v) * f) if f > 0 else round(v * (1 + f)) for v in c]
    return "#" + "".join(f"{max(0, min(255, v)):02x}" for v in c)


def ol(w=2.4):
    return f'stroke="{OL}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"'


def skin_fill():
    return 'style="fill:var(--skin,%s)"' % SKIN


def hair_fill(c):
    return 'style="fill:var(--hair,%s)"' % c


def hair_hi(c):
    return 'style="fill:var(--hair-hi,%s)"' % shade(c, 0.28)


def move_path(d, fx):
    """Apply fx(x, y) -> (x, y) to every point of an absolute M/L/C/Q/Z path."""
    toks = re.findall(r"[MLCQZ]|-?\d*\.?\d+", d)
    out, nums = [], []
    for t in toks + ["Z"]:
        if t.isalpha():
            for k in range(0, len(nums) - 1, 2):
                x, y = fx(nums[k], nums[k + 1])
                out.append(f"{x:g},{y:g}")
            nums = []
            out.append(t)
        else:
            nums.append(float(t))
    return " ".join(out[:-1])


def mirror(d, cx=100):
    """Mirror a path around the vertical line x=cx."""
    return move_path(d, lambda x, y: (2 * cx - x, y))


# ---------------------------------------------------------------- body ----
def body(spec):
    girl = spec["sex"] == "f"
    p = []
    if girl:
        p.append(f'<path d="M68,398 L94,398 L92,520 L70,520 Z" {skin_fill()} {ol()}/>')
        p.append(f'<path d="M106,398 L132,398 L130,520 L108,520 Z" {skin_fill()} {ol()}/>')
        p.append(f'<path d="M69,462 L93,462 L92,521 L70,521 Z" fill="{SOCK}" {ol(2)}/>')
        p.append(f'<path d="M107,462 L131,462 L130,521 L108,521 Z" fill="{SOCK}" {ol(2)}/>')
        p.append(f'<path d="M68,516 L95,516 C97,528 93,538 84,538 L62,538 C55,538 56,526 68,516 Z" fill="{SHOE}" {ol()}/>')
        p.append(f'<path d="M132,516 L105,516 C103,528 107,538 116,538 L138,538 C145,538 144,526 132,516 Z" fill="{SHOE}" {ol()}/>')
        p.append(f'<path d="M44,322 L156,322 L172,402 L28,402 Z" fill="{GREEN}" {ol()}/>')
        for k in range(1, 8):
            xt, xb = 44 + k * 14, 28 + k * 18
            p.append(f'<path d="M{xt},326 L{xb},400" stroke="{GREEN_SH}" stroke-width="1.8"/>')
        p.append(f'<path d="M30,394 L170,394" stroke="{GREEN_SH}" stroke-width="3"/>')
    else:
        p.append(f'<path d="M48,328 L152,328 L150,522 L106,522 L101,372 L99,372 L94,522 L50,522 Z" fill="{GREEN}" {ol()}/>')
        p.append(f'<path d="M74,382 L73,514 M126,382 L127,514" stroke="{GREEN_SH}" stroke-width="1.8"/>')
        p.append(f'<path d="M50,518 L95,518 C97,530 93,540 82,540 L45,540 C38,540 39,528 50,518 Z" fill="{SHOE}" {ol()}/>')
        p.append(f'<path d="M150,518 L105,518 C103,530 107,540 118,540 L155,540 C162,540 161,528 150,518 Z" fill="{SHOE}" {ol()}/>')
    # neck
    p.append(f'<path d="M88,138 L112,138 L113,182 L87,182 Z" {skin_fill()} {ol()}/>')
    p.append('<path d="M88,150 C95,161 105,161 112,150 L112,168 C104,174 96,174 88,168 Z" fill="#000" opacity=".13"/>')
    # shirt + tie
    p.append(f'<path d="M82,166 L118,166 L118,262 L82,262 Z" fill="{SHIRT}"/>')
    p.append(f'<path d="M95,185 L105,185 L103,196 L97,196 Z" fill="{TIE}" {ol(1.6)}/>')
    p.append(f'<path d="M97,196 L103,196 L107,238 L100,250 L93,238 Z" fill="{TIE}" {ol(1.6)}/>')
    # blazer panels (V opening)
    left = "M100,258 L84,170 C70,172 46,178 38,190 L34,262 L40,338 L100,338 Z"
    p.append(f'<path d="{left}" fill="{BLAZER}" {ol()}/>')
    p.append(f'<path d="{mirror(left)}" fill="{BLAZER}" {ol()}/>')
    p.append(f'<path d="M38,190 C44,184 50,181 56,180 L58,338 L40,338 L34,262 Z" fill="{BLAZER_SH}" opacity=".85"/>')
    p.append(f'<path d="{mirror("M38,190 C44,184 50,181 56,180 L58,338 L40,338 L34,262 Z")}" fill="{BLAZER_SH}" opacity=".85"/>')
    p.append(f'<path d="M86,178 L72,206 M114,178 L128,206" stroke="{BLAZER_SH}" stroke-width="2.4"/>')
    p.append(f'<path d="M84,170 L100,258 L116,170" fill="none" stroke="{GOLD}" stroke-width="3.2" stroke-linejoin="round"/>')
    p.append(f'<path d="M100,260 L100,336" stroke="{OL}" stroke-width="1.6"/>')
    p.append(f'<path d="M41,332 L159,332" stroke="{GOLD}" stroke-width="2.6"/>')
    for y in (280, 306):
        p.append(f'<circle cx="100" cy="{y}" r="3.3" fill="{GOLD}" {ol(1.2)}/>')
    # collar points
    collar = "M84,166 L100,187 L92,198 L78,174 Z"
    p.append(f'<path d="{collar}" fill="{SHIRT}" {ol(1.8)}/>')
    p.append(f'<path d="{mirror(collar)}" fill="{SHIRT}" {ol(1.8)}/>')
    if spec.get("badge"):
        p.append('<path d="M124,212 L140,212 L140,223 C140,229 136,233 132,235 C128,233 124,229 124,223 Z" '
                 'fill="#f2c14e" stroke="#7a5512" stroke-width="1.4"/>')
        p.append('<path d="M132,217 L133.6,221.4 L138,221.6 L134.6,224.4 L135.8,228.8 L132,226.2 '
                 'L128.2,228.8 L129.4,224.4 L126,221.6 L130.4,221.4 Z" fill="#fff"/>')
    # arms
    arm = "M40,186 C30,188 24,200 24,214 L22,326 C22,331 46,331 46,326 L48,214 C48,204 46,194 40,186 Z"
    for d in (arm, mirror(arm)):
        p.append(f'<path d="{d}" fill="{BLAZER}" {ol()}/>')
    p.append(f'<path d="M36,200 C44,206 46,214 46,226 L45,325 L37,325 Z" fill="{BLAZER_SH}" opacity=".55"/>')
    p.append(f'<path d="{mirror("M36,200 C44,206 46,214 46,226 L45,325 L37,325 Z")}" fill="{BLAZER_SH}" opacity=".55"/>')
    p.append(f'<path d="M25,264 Q35,268 47,264 M175,264 Q165,268 153,264" fill="none" stroke="{BLAZER_SH}" stroke-width="1.8"/>')
    p.append(f'<path d="M22.5,318 L46.5,318 M153.5,318 L177.5,318" stroke="{GOLD}" stroke-width="2.6"/>')
    for cx in (34, 166):
        p.append(f'<circle cx="{cx}" cy="340" r="12.5" {skin_fill()} {ol()}/>')
    return "\n".join(p)


# ---------------------------------------------------------------- eyes ----
WHITE = "M-13,2 C-12,-6 6,-10 14,-4 C13,4 6,9 0,9 C-7,9 -12,6 -13,2 Z"


def _pt(d, cx, cy, flip):
    """Place an eye-local path at (cx, cy); flip mirrors it for the left eye."""
    return move_path(d, lambda x, y: (cx + (-x if flip else x), cy + y))


def eye_set(name, iris, state, visible=False):
    """Both eyes in one state: open | half | narrow | wide | closed | happy."""
    iris_lo = shade(iris, 0.35)
    g = []
    for i, (cx, flip) in enumerate(((EYE_L, True), (EYE_R, False))):
        P = lambda d: _pt(d, cx, EYE_Y, flip)
        if state in ("closed", "happy"):
            g.append(f'<path d="{P("M-16,3 C-14,-10 8,-14 18,-5 C17,6 8,12 0,12 C-9,12 -15,8 -16,3 Z")}" {skin_fill()}/>')
            lash = "M-14,3 C-6,7 7,6 15,-1" if state == "closed" else "M-12,5 C-6,-4 6,-4 13,3"
            g.append(f'<path d="{P(lash)}" fill="none" {ol(3.4)}/>')
            continue
        clip = f"{name}-eye{i}-{state}"
        g.append(f'<clipPath id="{clip}"><path d="{P(WHITE)}"/></clipPath>')
        g.append(f'<path d="{P(WHITE)}" fill="#fff"/>')
        r = (6.2, 7.2) if state == "wide" else (8, 9.5)
        ix = cx + (-1 if flip else 1) * 0.5
        inner = [f'<ellipse cx="{ix}" cy="{EYE_Y + 1}" rx="{r[0]}" ry="{r[1]}" style="fill:var(--iris,{iris})"/>',
                 f'<ellipse cx="{ix}" cy="{EYE_Y + 5.5}" rx="{r[0] * 0.7}" ry="{r[1] * 0.34}" fill="{iris_lo}" opacity=".6"/>',
                 f'<ellipse cx="{ix}" cy="{EYE_Y + 2}" rx="{r[0] * 0.47}" ry="{r[1] * 0.52}" fill="#1b1430"/>',
                 f'<circle cx="{ix - 3}" cy="{EYE_Y - 3}" r="2.6" fill="#fff"/>',
                 f'<circle cx="{ix + 3.5}" cy="{EYE_Y + 4.5}" r="1.2" fill="#fff"/>']
        lash = "M-14,2.5 C-12,-8 6,-12 15,-4.5"
        if state == "half":
            inner.append(f'<path d="{P("M-18,-16 L20,-16 L20,-3.5 C8,-5 -6,-4 -18,1.5 Z")}" {skin_fill()}/>')
            lash = "M-14,1.5 C-6,-3.5 7,-5 15,-3.5"
        if state == "narrow":
            inner.append(f'<path d="{P("M-18,-16 L20,-16 L20,-1.5 C8,-1 -6,0 -18,2.5 Z")}" {skin_fill()}/>')
            inner.append(f'<path d="{P("M-18,14 L20,14 L20,3 C8,6.5 -6,7.5 -18,5 Z")}" {skin_fill()}/>')
            lash = "M-14,2.4 C-6,0.5 7,-0.6 15,-2"
        g.append(f'<g clip-path="url(#{clip})">{"".join(inner)}</g>')
        g.append(f'<path d="{P(lash)}" fill="none" {ol(3.8)}/>')
        flick = {"half": "M15,-3.5 L19,-6", "narrow": "M15,-2 L19.5,-4"}.get(state, "M15,-4.5 L19,-7.5")
        g.append(f'<path d="{P(flick)}" fill="none" {ol(2.6)}/>')
        lower = "M-5,7.6 Q1,9 7,6.4" if state == "narrow" else "M-6,10 Q1,11.5 8,8.5"
        g.append(f'<path d="{P(lower)}" fill="none" {ol(1.2)} opacity=".55"/>')
    hide = "" if visible else ' opacity="0"'
    return f'<g class="e-{state}"{hide}>{"".join(g)}</g>'


def brows(color):
    sets = {
        "neutral": ("M62,86 Q75,81 89,86", "M111,86 Q125,81 138,86"),
        "raised": ("M62,79 Q75,71 89,78", "M111,78 Q125,71 138,79"),
        "frown": ("M62,84 Q76,83 89,90", "M111,90 Q124,83 138,84"),
        "knowing": ("M62,86 Q75,82 89,87", "M111,84 Q125,76 138,81"),
    }
    out = []
    for k, (l, r) in sets.items():
        hide = "" if k == "neutral" else ' opacity="0"'
        out.append(f'<g class="b-{k}"{hide}><path d="{l} M{r[1:]}" fill="none" stroke="{color}" '
                   f'stroke-width="3.4" stroke-linecap="round"/></g>')
    return "".join(out)


def mouths():
    m = {
        "neutral": f'<path d="M93,140 Q100,141.5 107,140" fill="none" stroke="#5b2328" stroke-width="2.3" stroke-linecap="round"/>',
        "smile": f'<path d="M90.5,136.5 Q100,146.5 109.5,136.5" fill="none" stroke="#5b2328" stroke-width="2.4" stroke-linecap="round"/>',
        "smirk": f'<path d="M93,141 Q102,142.4 109.5,135.5" fill="none" stroke="#5b2328" stroke-width="2.4" stroke-linecap="round"/>',
        "grin": f'<path d="M89,135.5 Q100,137 111,135.5 Q108,150 100,150 Q92,150 89,135.5 Z" fill="{MOUTH}" {ol(1.6)}/>'
                f'<path d="M91.5,137.2 Q100,138.6 108.5,137.2 L107.5,140.4 Q100,141.6 92.5,140.4 Z" fill="#fff"/>',
        "o": f'<ellipse cx="100" cy="142" rx="4.4" ry="5.6" fill="{MOUTH}" {ol(1.6)}/>',
    }
    out = [f'<g class="m-{k}"{"" if k == "neutral" else HIDDEN}>{v}</g>' for k, v in m.items()]
    out.append(f'<g class="m-talk" opacity="0"><path d="M92.5,136.5 Q100,135.5 107.5,136.5 Q105.5,147 100,147 Q94.5,147 92.5,136.5 Z" '
               f'fill="{MOUTH}" {ol(1.6)}/><ellipse cx="100" cy="143.4" rx="3.6" ry="1.8" fill="#d86c78"/></g>')
    return "".join(out)


# ---------------------------------------------------------------- hair ----
HAIR = {
    "spiky": {
        "back": "M44,112 C34,58 64,16 100,16 C136,16 166,58 156,112 C150,96 148,84 140,74 L60,74 C52,84 50,96 44,112 Z",
        "front": ["M46,100 C40,50 68,20 100,20 C134,20 162,50 154,100 L148,86 L142,98 L136,74 L127,93 L118,68 "
                  "L109,91 L100,66 L91,91 L82,68 L73,93 L64,74 L58,98 L52,86 Z",
                  "M97,22 C90,6 107,-1 113,9 C106,8 103,14 104,22 Z"],
        "hi": "M66,44 C80,32 120,32 134,44 C122,40 78,40 66,44 Z",
    },
    "long": {
        "back": "M42,104 C34,40 70,12 100,12 C130,12 166,40 158,104 L161,210 L167,332 L151,320 L137,336 L121,324 "
                "L100,332 L79,324 L63,336 L49,320 L33,332 L39,210 Z",
        "front": ["M48,104 C42,46 72,18 100,18 C128,18 158,46 152,104 C146,92 142,84 138,78 C134,90 128,96 122,98 "
                  "C124,86 122,76 118,68 C112,82 104,92 94,96 C98,84 98,74 96,66 C88,80 76,90 64,94 C68,86 70,80 "
                  "70,74 C62,84 56,94 48,104 Z",
                  "M50,92 C40,140 46,200 37,252 C46,246 52,238 57,228 C59,190 58,140 64,104 Z",
                  "M150,92 C160,140 154,200 163,252 C154,246 148,238 143,228 C141,190 142,140 136,104 Z"],
        "hi": "M60,50 C80,35 120,35 140,50 C128,45 112,43 100,43 C88,43 72,45 60,50 Z",
    },
    "messy": {
        "back": "M44,108 C36,56 66,18 100,18 C136,18 166,56 156,108 C150,92 146,82 140,74 L60,74 C54,82 50,92 44,108 Z",
        "front": ["M46,100 C40,52 66,22 100,22 C136,22 162,52 154,100 C150,90 146,84 140,80 C142,90 140,96 136,100 "
                  "C132,88 126,80 118,76 C120,86 116,94 110,98 C108,86 102,78 94,76 C96,86 92,92 86,96 C84,86 80,80 "
                  "72,78 C74,88 70,94 64,98 C62,90 58,86 52,84 C50,90 48,96 46,100 Z",
                  "M70,34 C64,22 66,12 74,6 C74,16 78,24 86,28 Z", "M108,26 C112,14 122,8 132,10 C124,14 121,21 122,30 Z"],
        "hi": "M64,46 C80,34 118,32 136,44 C120,40 82,40 64,46 Z",
    },
    "short": {
        "back": "M46,104 C38,56 68,20 100,20 C132,20 162,56 154,104 C150,92 146,84 140,78 L60,78 C54,84 50,92 46,104 Z",
        "front": ["M47,98 C42,50 70,24 100,24 C132,24 160,50 153,98 C150,86 146,78 140,72 C120,80 96,78 76,66 "
                  "C78,74 76,80 72,84 C64,80 58,76 54,72 C50,80 48,88 47,98 Z"],
        "hi": "M70,42 C84,32 118,32 132,42 C118,38 84,38 70,42 Z",
    },
    "bob": {
        "back": "M40,150 C32,60 64,16 100,16 C136,16 168,60 160,150 C150,158 140,160 132,156 L68,156 "
                "C60,160 50,158 40,150 Z",
        "front": ["M46,104 C40,50 70,20 100,20 C130,20 160,50 154,104 C152,96 150,90 148,86 L146,92 C138,86 134,84 "
                  "128,84 L124,90 C116,86 108,86 100,86 L96,90 C88,86 80,86 74,86 L70,92 C64,88 58,88 54,90 L52,86 "
                  "C50,92 48,98 46,104 Z",
                  "M48,94 C43,120 43,140 45,157 C54,161 62,159 68,152 C62,136 60,116 62,100 Z",
                  "M152,94 C157,120 157,140 155,157 C146,161 138,159 132,152 C138,136 140,116 138,100 Z"],
        "hi": "M62,46 C80,34 120,34 138,46 C122,41 78,41 62,46 Z",
    },
    "ponytail": {
        "back": "M44,108 C36,56 66,18 100,18 C134,18 164,56 156,108 L60,108 Z "
                "M138,38 C170,36 188,70 182,122 C179,152 170,172 158,188 C163,160 164,130 156,104 C152,80 146,60 138,38 Z",
        "front": ["M46,102 C40,50 70,20 100,20 C132,20 160,50 154,102 C150,90 144,80 136,74 C130,86 118,94 102,98 "
                  "C112,88 116,80 116,72 C100,84 80,92 60,96 C66,90 70,84 72,78 C62,84 54,92 46,102 Z"],
        "hi": "M64,46 C80,34 118,32 136,44 C120,40 82,40 64,46 Z",
        "extra": '<circle cx="144" cy="40" r="6" fill="#d23b48" stroke="#2a1e2b" stroke-width="2"/>',
    },
}


def head(name, spec):
    hc = spec["hairColor"]
    h = HAIR[spec["hair"]]
    girl = spec["sex"] == "f"
    p = []
    for cx in (53, 147):
        p.append(f'<ellipse cx="{cx}" cy="105" rx="7" ry="11" {skin_fill()} {ol()}/>')
    p.append(f'<path d="M48,94 C46,52 72,30 100,30 C128,30 154,52 152,94 C151,120 142,139 124,151 '
             f'C115,157 107,160 100,160 C93,160 85,157 76,151 C58,139 49,120 48,94 Z" {skin_fill()} {ol()}/>')
    if girl:
        p.append('<ellipse cx="70" cy="127" rx="8" ry="4" fill="#f07a7a" opacity=".32"/>'
                 '<ellipse cx="130" cy="127" rx="8" ry="4" fill="#f07a7a" opacity=".32"/>')
    p.append('<path d="M101,119 Q98.5,125.5 102,127.5" fill="none" stroke="#000" stroke-opacity=".28" '
             'stroke-width="1.7" stroke-linecap="round"/>')
    default = spec.get("eyes", "open")
    p.append('<g class="eyes">' + "".join(eye_set(name, spec["iris"], s, s == default)
                                          for s in ("open", "half", "narrow", "wide", "happy")) + "</g>")
    p.append(f'<g class="mouth">{mouths()}</g>')
    for d in h["front"]:
        p.append(f'<path d="{d}" {hair_fill(hc)} {ol()}/>')
    p.append(f'<path d="{h["hi"]}" {hair_hi(hc)} opacity=".85"/>')
    p.append(h.get("extra", ""))
    if spec.get("clip"):
        p.append(f'<g transform="rotate(-24 136 60)"><rect x="126" y="56" width="20" height="7" rx="3.5" '
                 f'fill="{GOLD}" {ol(1.6)}/><circle cx="146" cy="59.5" r="5.2" fill="#d23b48" {ol(1.6)}/></g>')
    p.append(f'<g class="brows">{brows(shade(hc, -0.3))}</g>')
    if spec.get("glasses"):
        p.append(f'<g fill="#ffffff" fill-opacity=".10" {ol(2.6)}>'
                 f'<rect x="60" y="93" width="32" height="25" rx="7"/><rect x="108" y="93" width="32" height="25" rx="7"/>'
                 f'<path d="M92,103 Q100,98.5 108,103 M60,101 L52,98 M140,101 L148,98" fill="none"/></g>')
    p.append('<g class="e-blink" opacity="0">' + eye_set(name, spec["iris"], "closed", True) + "</g>")
    return "\n".join(p)


def character_svg(name, spec):
    h = HAIR[spec["hair"]]
    back = f'<path d="{h["back"]}" {hair_fill(spec["hairColor"])} {ol()}/>'
    style = f' style="--skin:{spec["skin"]}"' if spec.get("skin") else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 560" class="char" '
            f'data-char="{name}" data-default-eyes="{spec.get("eyes", "open")}"{style}>\n'
            f'<g class="hair-back">{back}</g>\n'
            f'<g class="body">\n{body(spec)}\n</g>\n'
            f'<g class="head">\n{head(name, spec)}\n</g>\n</svg>\n')


def main():
    out = ROOT / "characters"
    out.mkdir(exist_ok=True)
    for name, spec in load_plan()["cast"].items():
        (out / f"{name}.svg").write_text(character_svg(name, spec), encoding="utf-8")
        print("characters/%s.svg" % name)


if __name__ == "__main__":
    main()
