#!/usr/bin/env python3
"""Generate the reusable flat-vector school characters (characters/*.svg).

Every character shares one body/face rig (viewBox 0 0 200 520) so scenes can
animate the same named parts on anybody:

  .figure       whole body (bob / walk / sit)
  .arm-l/.arm-r sleeves + hands      .leg-l/.leg-r legs + shoes
  .eye .iris .iris-fill .lid         eyes, blink lids, recolourable iris
  .mouth-neutral/-smile/-laugh       expressions (picked with data-expr=...)
  .eyes-open / .eyes-happy           happy (^ ^) eyes for laughing
  .eye-glow                          optional glow layer (hidden by default)

Run:  python3 characters/make_characters.py
Add a new character by adding an entry to CHARACTERS below.
"""
import re
from pathlib import Path

OL = "#1b1722"          # outline colour
BLAZER = "#c3262e"
BLAZER_DARK = "#9c1d25"
GOLD = "#e7b93e"
SHIRT = "#f4f4f7"
TIE = "#1f2a4a"
GREEN = "#2f6b3c"
GREEN_DARK = "#235530"
SHOE = "#1d1b22"
TIGHTS = "#2a2633"


def path(d, fill="none", sw=3.0, cls="", extra=""):
    c = f' class="{cls}"' if cls else ""
    return (f'<path{c} d="{d}" fill="{fill}" stroke="{OL}" stroke-width="{sw}" '
            f'stroke-linejoin="round" stroke-linecap="round"{extra}/>')


def line(d, color=OL, sw=3.0, cls="", extra=""):
    c = f' class="{cls}"' if cls else ""
    return (f'<path{c} d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def mirror(d):
    """Mirror an absolute M/L/Q/C/Z path around x=100."""
    toks = re.findall(r"[A-Za-z]|-?\d*\.?\d+", d)
    out, i = [], 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            out.append(t)
            i += 1
            continue
        x, y = float(toks[i]), float(toks[i + 1])
        out += [f"{200 - x:g}", f"{y:g}"]
        i += 2
    return " ".join(out)


# --------------------------------------------------------------------- parts
def legs(c):
    if c["lower"] == "trousers":
        l = path("M50 352 L101 352 L97 490 L57 490 Z", GREEN)
        ls = path("M50 498 Q48 482 60 480 L96 480 Q104 488 99 498 Z", SHOE)
        r = path(mirror("M50 352 L101 352 L97 490 L57 490 Z"), GREEN)
        rs = path(mirror("M50 498 Q48 482 60 480 L96 480 Q104 488 99 498 Z"), SHOE)
        crease = (line("M76 372 L77 470", GREEN_DARK, 2) +
                  line(mirror("M76 372 L77 470"), GREEN_DARK, 2))
        return (f'<g class="leg-l">{l}{ls}</g><g class="leg-r">{r}{rs}</g>'
                f'<g class="crease">{crease}</g>')
    l = path("M64 408 L89 408 L87 488 L67 488 Z", TIGHTS)
    ls = path("M60 497 Q58 482 68 480 L88 480 Q96 488 91 497 Z", SHOE)
    r = path(mirror("M64 408 L89 408 L87 488 L67 488 Z"), TIGHTS)
    rs = path(mirror("M60 497 Q58 482 68 480 L88 480 Q96 488 91 497 Z"), SHOE)
    return f'<g class="leg-l">{l}{ls}</g><g class="leg-r">{r}{rs}</g>'


def skirt(c):
    if c["lower"] != "skirt":
        return ""
    s = path("M40 346 L160 346 L176 428 Q100 442 24 428 Z", GREEN)
    pleats = "".join(line(f"M{x0} 352 L{x1} 432", GREEN_DARK, 2)
                     for x0, x1 in [(58, 46), (79, 72), (100, 100), (121, 128), (142, 154)])
    hem = line("M28 418 Q100 431 172 418", GOLD, 2.2, extra=' opacity=".8"')
    return f'<g class="skirt">{s}{pleats}{hem}</g>'


def torso(c):
    shirt = path("M76 174 L100 242 L124 174 Z", SHIRT, 2.5)
    collar = (path("M76 174 L86 198 L99 184 Z", SHIRT, 2.5) +
              path(mirror("M76 174 L86 198 L99 184 Z"), SHIRT, 2.5))
    tie = (path("M94 185 L106 185 L104 197 L96 197 Z", TIE, 2.5) +
           path("M96 196 L104 196 L109 250 L100 260 L91 250 Z", TIE, 2.5))
    if c.get("ribbon"):  # girls may wear a bow instead of a tie
        tie = (path("M100 192 L84 182 L84 204 Z", c["ribbon"], 2.5) +
               path("M100 192 L116 182 L116 204 Z", c["ribbon"], 2.5) +
               path("M96 188 L104 188 L104 197 L96 197 Z", c["ribbon"], 2.5) +
               path("M97 196 L92 226 L100 220 L108 226 L103 196 Z", c["ribbon"], 2.5))
    blazer = path("M38 214 Q40 186 76 174 L100 242 L124 174 Q160 186 162 214 "
                  "L166 356 Q100 370 34 356 Z", BLAZER)
    lapel_l = path("M76 174 L100 242 L90 250 L66 196 Z", BLAZER_DARK, 2.5)
    lapel_r = path(mirror("M76 174 L100 242 L90 250 L66 196 Z"), BLAZER_DARK, 2.5)
    piping = line("M76 175 L100 241 L124 175", GOLD, 2.4)
    front = line("M100 244 L100 362", OL, 2)
    buttons = "".join(f'<circle cx="107" cy="{y}" r="3.6" fill="{GOLD}" stroke="{OL}" stroke-width="1.5"/>'
                      for y in (276, 312))
    pocket = line("M120 238 L146 236", BLAZER_DARK, 2.5)
    badge = ""
    if c.get("badge"):
        badge = (path("M125 222 L145 222 L145 236 Q135 248 125 236 Z", GOLD, 2) +
                 '<path d="M135 226 L137.4 231 L142.6 231.4 L138.6 234.6 L140 239.6 '
                 'L135 236.8 L130 239.6 L131.4 234.6 L127.4 231.4 L132.6 231 Z" fill="#c3262e"/>')
    return (f'<g class="torso">{shirt}{tie}{blazer}{lapel_l}{lapel_r}{piping}{collar}'
            f'{front}{buttons}{pocket}{badge}</g>')


def arms(c):
    sleeve = "M52 188 Q30 192 26 232 L20 342 Q34 350 49 344 L58 240 Q61 208 52 188 Z"
    cuff = "M21 331 Q35 337 49 332"
    hand_l = f'<ellipse cx="34" cy="357" rx="11" ry="13" fill="{c["skin"]}" stroke="{OL}" stroke-width="3"/>'
    hand_r = f'<ellipse cx="166" cy="357" rx="11" ry="13" fill="{c["skin"]}" stroke="{OL}" stroke-width="3"/>'
    band = ""
    if c.get("armband"):
        band = path("M143 236 L179 232 L180 252 L145 257 Z", GOLD, 2.5) + \
               line("M144 247 L179 242", "#8a1a20", 2.5)
    left = f'<g class="arm-l">{hand_l}{path(sleeve, BLAZER)}{line(cuff, GOLD, 2.4)}</g>'
    right = (f'<g class="arm-r">{hand_r}{path(mirror(sleeve), BLAZER)}'
             f'{line(mirror(cuff), GOLD, 2.4)}{band}</g>')
    return left + right


def head(c):
    skin, shade = c["skin"], c["skin_shade"]
    neck = (path("M87 148 L113 148 L114 188 L86 188 Z", skin, 2.5) +
            f'<path d="M87 154 Q100 166 113 154 L113 170 Q100 177 87 170 Z" fill="{shade}"/>')
    ears = (f'<ellipse cx="45" cy="106" rx="8" ry="12" fill="{skin}" stroke="{OL}" stroke-width="3"/>'
            f'<ellipse cx="155" cy="106" rx="8" ry="12" fill="{skin}" stroke="{OL}" stroke-width="3"/>')
    face = path("M44 86 C44 46 70 30 100 30 C130 30 156 46 156 86 L155 108 "
                "C152 138 128 157 100 163 C72 157 48 138 45 108 Z", skin)
    return neck + ears + face


def eye(cx, side, c):
    """One open eye. side=-1 for the viewer-left eye, +1 for viewer-right."""
    s = side
    def X(x):  # x offset from eye centre, mirrored for the right eye
        return cx + x * (-1 if s > 0 else 1)
    sclera = (f'M{X(-15)} 105 Q{X(-13)} 92 {cx} 92 Q{X(13)} 92 {X(14)} 105 '
              f'Q{X(13)} 117 {cx} 118 Q{X(-13)} 117 {X(-15)} 105 Z')
    iris = c["iris"]
    flick = line(f"M{X(-16)} 101 L{X(-21)} 96", OL, 3) if c.get("lashes") else ""
    lash_w = 5.5 if c.get("lashes") else 4.5
    lid_d = f"M{X(-19)} 88 L{X(18)} 88 L{X(18)} 120 L{X(-19)} 120 Z"
    return f'''<g class="eye">
  <path d="{sclera}" fill="#fff"/>
  <g class="iris">
    <ellipse class="iris-fill" cx="{cx}" cy="106" rx="8.6" ry="10.6" fill="{iris}"/>
    <ellipse cx="{cx}" cy="101" rx="8.6" ry="5" fill="{OL}" opacity=".28"/>
    <ellipse cx="{cx}" cy="107" rx="4" ry="5" fill="{OL}"/>
    <circle cx="{cx - 3}" cy="101.5" r="2.7" fill="#fff"/>
    <circle cx="{cx + 3}" cy="111" r="1.3" fill="#fff" opacity=".85"/>
  </g>
  {line(f"M{X(-17)} 101 Q{X(-11)} 89 {X(1)} 89 Q{X(12)} 90 {X(16)} 99", OL, lash_w)}
  {flick}
  {line(f"M{X(-10)} 115 Q{cx} 121 {X(10)} 115", OL, 1.6, extra=' opacity=".55"')}
  <g class="lid" transform="scale(1 0)"><path d="{lid_d}" fill="{c["skin"]}"/>{line(f"M{X(-16)} 110 Q{cx} 117 {X(15)} 110", OL, 4)}</g>
</g>'''


def face_features(c):
    eyes_open = f'<g class="eyes-open">{eye(77, -1, c)}{eye(123, 1, c)}</g>'
    eyes_happy = (f'<g class="eyes-happy" display="none">{line("M62 108 Q77 93 92 108", OL, 4.5)}'
                  f'{line("M108 108 Q123 93 138 108", OL, 4.5)}</g>')
    brow_col = c.get("brow", OL)
    brows = (f'<g class="brows">{line("M62 84 Q74 78 90 82", brow_col, 3.6)}'
             f'{line("M138 84 Q126 78 110 82", brow_col, 3.6)}</g>')
    nose = line("M100 117 Q103 124 99 127", c["skin_line"], 2)
    blush = (f'<g class="blush"><ellipse cx="65" cy="126" rx="9" ry="4.5" fill="#ff7d8f" opacity=".32"/>'
             f'<ellipse cx="135" cy="126" rx="9" ry="4.5" fill="#ff7d8f" opacity=".32"/></g>')
    lip = c.get("lip", OL)
    mouths = (f'<g class="mouth mouth-neutral">{line("M92 140 Q100 143 108 140", lip, 2.6)}</g>'
              f'<g class="mouth mouth-smile" display="none">{line("M89 136 Q100 147 111 136", lip, 2.6)}</g>'
              f'<g class="mouth mouth-laugh" display="none">{path("M86 133 Q100 158 114 133 Z", "#6b1f2a", 2.6)}'
              f'<path d="M93 147 Q100 141 107 147 Q100 153 93 147 Z" fill="#e46b7b"/></g>')
    glow = ""
    if c.get("glow"):
        glow = (f'<g class="eye-glow" opacity="0"><circle cx="77" cy="106" r="22" fill="url(#{c["id"]}-glow)"/>'
                f'<circle cx="123" cy="106" r="22" fill="url(#{c["id"]}-glow)"/></g>')
    return eyes_open + eyes_happy + nose + blush + mouths + glow, brows


def accessories(c):
    out = ""
    if c.get("glasses"):
        out += (f'<g class="glasses"><circle cx="77" cy="105" r="17.5" fill="#cfe8ff" fill-opacity=".14" '
                f'stroke="#26242c" stroke-width="3.2"/><circle cx="123" cy="105" r="17.5" fill="#cfe8ff" '
                f'fill-opacity=".14" stroke="#26242c" stroke-width="3.2"/>'
                f'{line("M94.5 103 Q100 99 105.5 103", "#26242c", 3)}'
                f'{line("M59.5 102 L47 98", "#26242c", 3)}{line("M140.5 102 L153 98", "#26242c", 3)}</g>')
    if c.get("headband"):
        out += (path("M43 80 Q100 60 157 80 L157 93 Q100 74 43 93 Z", c["headband"], 2.5) +
                line("M44 86.5 Q100 67 156 86.5", "#ffffff", 2))
    if c.get("clip"):
        out += (f'<rect x="124" y="46" width="20" height="6" rx="3" fill="{GOLD}" stroke="{OL}" '
                f'stroke-width="2" transform="rotate(-22 134 49)"/>')
    return out


# ------------------------------------------------------------- hair styles
def hair_narrator(c):
    h, hl = c["hair"], c["hair_hi"]
    back = path("M38 104 C30 42 60 16 100 16 C140 16 170 42 162 104 L160 128 L40 128 Z", h)
    front = path("M40 100 C34 44 64 20 100 20 C136 20 166 44 160 100 L151 78 L145 104 L133 72 "
                 "L119 100 L106 68 L96 98 L84 70 L72 102 L62 74 L52 100 Z", h)
    tufts = path("M45 96 L47 124 L54 108 Z", h, 2.5) + path(mirror("M45 96 L47 124 L54 108 Z"), h, 2.5)
    ahoge = path("M97 22 Q90 4 112 2 Q101 10 106 22 Z", h, 2.5)
    shine = line("M66 42 Q84 32 102 38", hl, 3.5) + line("M118 36 Q132 40 140 50", hl, 3)
    return back, front + tufts + ahoge + shine


def hair_president(c):
    h, hl = c["hair"], c["hair_hi"]
    back = path("M34 102 C26 36 62 14 100 14 C138 14 174 36 166 102 L178 300 Q170 338 140 330 "
                "L148 200 L52 200 L60 330 Q30 338 22 300 Z", h)
    bangs = path("M42 102 C36 40 66 18 100 18 C134 18 164 40 158 102 Q150 70 130 58 Q134 84 113 98 "
                 "Q114 70 99 56 Q92 82 68 96 Q74 74 72 62 Q56 80 52 102 Z", h)
    lock = "M45 92 Q30 150 38 226 Q46 244 58 232 Q50 170 58 110 Z"
    locks = path(lock, h) + path(mirror(lock), h)
    shine = line("M62 40 Q82 28 104 34", hl, 3.5) + line("M41 150 Q40 186 46 214", hl, 2.5) + \
        line(mirror("M41 150 Q40 186 46 214"), hl, 2.5)
    return back, bangs + locks + shine


def hair_glasses(c):
    h, hl = c["hair"], c["hair_hi"]
    back = path("M38 104 C30 44 60 18 100 18 C140 18 170 44 162 104 L160 124 L40 124 Z", h)
    front = path("M40 102 C34 46 64 22 100 22 C136 22 166 46 160 102 Q156 78 140 70 Q122 62 100 70 "
                 "Q82 76 68 92 L62 84 Q54 92 52 102 Z", h)
    shine = line("M70 40 Q88 32 106 36", hl, 3.5)
    side = path("M42 98 L40 126 L50 116 Z", h) + path(mirror("M42 98 L40 126 L50 116 Z"), h)
    return back, front + side + shine


def hair_ponytail(c):
    h, hl = c["hair"], c["hair_hi"]
    tail = path("M146 40 C192 48 200 124 178 214 C170 172 158 132 146 102 Z", h)
    scrunchie = f'<ellipse cx="152" cy="44" rx="9" ry="12" fill="#3f7fd8" stroke="{OL}" stroke-width="2.5"/>'
    back = tail + path("M36 104 C28 40 64 16 100 16 C136 16 172 40 164 104 L168 150 L32 150 Z", h) + scrunchie
    front = path("M40 102 C34 42 66 20 100 20 C134 20 166 42 160 102 L153 82 L141 98 L129 74 L115 96 "
                 "L100 72 L86 96 L72 74 L60 98 L48 82 Z", h)
    shine = line("M66 40 Q84 30 104 34", hl, 3.5) + line("M176 130 Q182 160 178 190", hl, 3)
    side = path("M42 98 Q34 130 42 150 L52 146 Q46 126 50 104 Z", h) + \
        path(mirror("M42 98 Q34 130 42 150 L52 146 Q46 126 50 104 Z"), h)
    return back, front + side + shine


def hair_short(c):
    h, hl = c["hair"], c["hair_hi"]
    back = path("M40 96 C36 40 66 18 100 18 C134 18 164 40 160 96 L156 104 L44 104 Z", h)
    front = path("M42 94 C40 44 66 22 100 22 C134 22 160 44 158 94 Q130 72 100 74 Q70 72 42 94 Z", h)
    curls = "".join(f'<circle cx="{x}" cy="{y}" r="7" fill="{h}" stroke="{OL}" stroke-width="2.5"/>'
                    for x, y in [(64, 34), (84, 24), (104, 21), (124, 25), (142, 35)])
    shine = line("M80 34 Q96 28 112 32", hl, 3)
    return back, front + curls + shine


def hair_bob(c):
    h, hl = c["hair"], c["hair_hi"]
    back = path("M34 102 C26 38 62 14 100 14 C138 14 174 38 166 102 L169 168 Q152 178 140 168 "
                "L60 168 Q48 178 31 168 Z", h)
    bangs = path("M40 104 C34 40 66 18 100 18 C134 18 166 40 160 104 L156 92 Q130 84 100 86 "
                 "Q70 84 44 92 Z", h)
    side = "M41 96 Q34 140 42 168 L57 166 Q50 130 52 100 Z"
    sides = path(side, h) + path(mirror(side), h)
    shine = line("M64 38 Q84 28 106 32", hl, 3.5) + line("M150 60 Q156 70 158 84", hl, 3)
    return back, bangs + sides + shine


# ------------------------------------------------------------ characters
CHARACTERS = [
    dict(id="narrator", name="Narrator (me)", lower="trousers", skin="#f6d3b5", skin_shade="#e2b496",
         skin_line="#b47e64", iris="#4f93c0", hair="#20243a", hair_hi="#3b4366", hair_fn=hair_narrator,
         brow="#20243a", glow=True),
    dict(id="president", name="Class president", lower="skirt", skin="#f8dac4", skin_shade="#e8bca0",
         skin_line="#c08a70", iris="#6f4fc4", hair="#1b1a2e", hair_hi="#3a3664", hair_fn=hair_president,
         lashes=True, lip="#b43a4e", badge=True, armband=True, clip=True, ribbon="#1f2a4a"),
    dict(id="classmate1", name="Classmate – glasses", lower="trousers", skin="#f3cba8", skin_shade="#dcae8a",
         skin_line="#b07a5c", iris="#6b4a2e", hair="#6b4226", hair_hi="#8f603a", hair_fn=hair_glasses,
         brow="#5a3720", glasses=True),
    dict(id="classmate2", name="Classmate – ponytail", lower="skirt", skin="#f9dcc4", skin_shade="#eabfa2",
         skin_line="#c48c72", iris="#3f8fd8", hair="#f1c55c", hair_hi="#ffe08f", hair_fn=hair_ponytail,
         brow="#c18f35", lashes=True, lip="#c0505e", ribbon="#1f2a4a"),
    dict(id="classmate3", name="Classmate – headband", lower="trousers", skin="#a86a42", skin_shade="#8c5434",
         skin_line="#6e3f25", iris="#4a3020", hair="#1a1717", hair_hi="#3a3434", hair_fn=hair_short,
         headband="#d23a3a"),
    dict(id="classmate4", name="Classmate – bob", lower="skirt", skin="#f2c6a0", skin_shade="#dca984",
         skin_line="#b27c5c", iris="#3c9a6a", hair="#9e3f27", hair_hi="#c9643f", hair_fn=hair_bob,
         brow="#7d2f1c", lashes=True, lip="#b8434f", ribbon="#1f2a4a"),
]


def build(c):
    back_hair, front_hair = c["hair_fn"](c)
    defs = ""
    if c.get("glow"):
        defs = (f'<defs><radialGradient id="{c["id"]}-glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity="1"/>'
                f'<stop offset=".35" stop-color="#F2C14E" stop-opacity=".85"/>'
                f'<stop offset="1" stop-color="#F2C14E" stop-opacity="0"/></radialGradient></defs>')
    features, brows = face_features(c)
    body = (f'<g class="figure">'
            f'<g class="hair-back">{back_hair}</g>'
            f'{legs(c)}{skirt(c)}{torso(c)}{arms(c)}'
            f'<g class="head">{head(c)}{features}<g class="hair-front">{front_hair}</g>'
            f'{brows}{accessories(c)}</g>'
            f'</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 520" class="char-svg" '
            f'data-id="{c["id"]}">\n<title>{c["name"]}</title>\n{defs}\n{body}\n</svg>\n')


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    for c in CHARACTERS:
        (here / f'{c["id"]}.svg').write_text(build(c), encoding="utf-8")
        print("wrote", f'characters/{c["id"]}.svg')
