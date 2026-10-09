"""The Loe mascot: a softly lit chat bubble with a face and a gold sparkle.

Everything is drawn in "mascot space", with the bubble body centred at (50, 46)."""
from vg import *

BCX, BCY = 50, 46
EYE_Y, EYE_DX, ERX, ERY = 41.5, 10.5, 5.2, 7.2
MOUTH = dict(cx=50, cy=48.6, R=8.6, t=4.5, a1=36, a2=144)
SPARK = (80, 17.6, 8.6, 10.8)      # centre x, centre y, half width, half height
SPARK2 = (92.2, 30.5, 3.6, 4.4)
TAIL = "M44,66 C40.4,75.6 32.6,82.6 21.6,84.6 Q18.2,85.2 19.7,82.4 C23.3,76.6 24,70 22,58 Z"  # clockwise

def body_path(): return superellipse(BCX, BCY, 36, 26.5, n=3.2)
def silhouette(): return body_path() + " " + TAIL
def eyes(rev=False): return ellipse(BCX - EYE_DX, EYE_Y, ERX, ERY, rev) + " " + ellipse(BCX + EYE_DX, EYE_Y, ERX, ERY, rev)
def mouth(rev=False):
    m = MOUTH
    return band(m['cx'], m['cy'], m['R'], m['t'], m['a1'], m['a2'], rev)
def sparks(rev=False, grow=0.0):
    (x, y, w, h), (x2, y2, w2, h2) = SPARK, SPARK2
    return (sparkle(x, y, w + grow, h + grow, k=0.2 + grow / 40, reverse=rev) + " " +
            sparkle(x2, y2, w2 + grow, h2 + grow, k=0.22 + grow / 20, reverse=rev))

def soft_ellipse(cx, cy, r, sy, color, a):
    """A blurred-looking ellipse: a radial gradient squashed vertically."""
    return G([P(circle(cx, cy, r), Rad(cx, cy, r, [(0, color, a), (1, color, 0)]))], sy=sy, px=cx, py=cy)

def sparkle_nodes(glow=True):
    gold = lambda x, y, w, h: Lin(x - w, y - h, x + w, y + h, [(0, '#FFF9DB', 1), (0.45, '#FFD859', 1), (1, '#FFA92E', 1)])
    x, y, w, h = SPARK
    out = []
    if glow:
        out.append(P(circle(x, y, 15), Rad(x, y, 15, [(0, '#FFE58F', 0.55), (0.55, '#FFE58F', 0.18), (1, '#FFE58F', 0)])))
    out.append(P(sparkle(*SPARK, k=0.2), gold(*SPARK)))
    out.append(P(sparkle(*SPARK2, k=0.22), gold(*SPARK2)))
    return out

def face_nodes(eye_fill, mouth_fill, catchlights, cheeks):
    out = []
    color, alpha = cheeks
    for cx in (31.2, 68.8):
        out.append(soft_ellipse(cx, 51.8, 6.2, 0.62, color, alpha))
    for cx in (BCX - EYE_DX, BCX + EYE_DX):
        out.append(P(ellipse(cx, EYE_Y, ERX, ERY), eye_fill(cx)))
        if catchlights:
            out.append(P(circle(cx + 1.75, EYE_Y - 2.7, 1.85), '#FFFFFF'))
            out.append(P(circle(cx - 1.45, EYE_Y + 3.0, 0.85), '#FFFFFF', alpha=0.75))
    out.append(P(mouth(), mouth_fill))
    return out

def mascot_white(shadow='#22108A'):
    """White mascot with an indigo face, for the violet app icon."""
    out = [
        G([P(circle(48, 54, 42), Rad(48, 54, 42, [(0, shadow, 0.5), (0.6, shadow, 0.36), (0.84, shadow, 0.12), (1, shadow, 0)]))],
          sy=0.74, px=48, py=54),
        P(translate_path(silhouette(), 0, 1.6), (shadow, 0.16)),
        P(silhouette(), Rad(36, 27, 74, [(0, '#FFFFFF', 1), (0.48, '#F7F4FF', 1), (0.8, '#E2DBFF', 1), (1, '#CEC4FF', 1)])),
        G([P(rrect(0, 52, 100, 45, 0), Lin(0, 58, 0, 90, [(0, '#5B45E0', 0), (1, '#5B45E0', 0.30)]))], clip=silhouette()),
    ]
    out += face_nodes(lambda cx: Rad(cx - 1.6, EYE_Y - 3, 9.6, [(0, '#5444E0', 1), (1, '#1C1065', 1)]),
                      Lin(42, 50, 58, 60, [(0, '#3D2EBE', 1), (1, '#1C1065', 1)]),
                      catchlights=True, cheeks=('#FF7EC2', 0.55))
    return out + sparkle_nodes()

def mascot_color():
    """Gradient mascot with a white face, for the app header on light or dark screens."""
    out = [
        P(silhouette(), Lin(16, 18, 86, 84, [(0, '#F58BFF', 1), (0.45, '#9B5CFF', 1), (1, '#4B6BFF', 1)])),
        G([
            P(superellipse(49, 29.5, 29, 10.5, n=2.6), Lin(0, 19, 0, 40, [(0, '#FFFFFF', 0.45), (1, '#FFFFFF', 0)])),
            P(rrect(0, 52, 100, 45, 0), Lin(0, 58, 0, 92, [(0, '#2A1A9E', 0), (1, '#2A1A9E', 0.38)])),
        ], clip=silhouette()),
    ]
    out += face_nodes(lambda cx: Lin(cx, EYE_Y - ERY, cx, EYE_Y + ERY, [(0, '#FFFFFF', 1), (1, '#EFEAFF', 1)]),
                      '#FFFFFF', catchlights=False, cheeks=('#FFB8EC', 0.55))
    return out + sparkle_nodes(glow=False)

def mascot_mono(color='#FFFFFF'):
    """One-colour mascot: face cut out of the bubble, with a gap around the sparkle."""
    knockout = rrect(-20, -20, 140, 140, 0) + " " + sparks(rev=True, grow=2.2)
    return [
        G([P(silhouette() + " " + eyes(rev=True) + " " + mouth(rev=True), color)], clip=knockout),
        P(sparks(), color),
    ]

def bg_violet():
    full = rrect(0, 0, 108, 108, 0)
    return [
        P(full, Lin(22, 12, 86, 98, [(0, '#A08EFF', 1), (0.5, '#6C58F5', 1), (1, '#432CCB', 1)])),
        P(full, Rad(22, 96, 50, [(0, '#FF77D6', 0.55), (1, '#FF77D6', 0)])),
        P(full, Rad(94, 14, 42, [(0, '#73D9FF', 0.38), (1, '#73D9FF', 0)])),
        P(full, Rad(54, 52, 34, [(0, '#FFFFFF', 0.16), (1, '#FFFFFF', 0)])),
    ]

def on_icon(nodes):
    """Place mascot space on the 108-unit adaptive icon canvas."""
    s = 0.65
    return G(nodes, tx=54.5 - BCX, ty=55 - BCY, sx=s, px=BCX, py=BCY)
