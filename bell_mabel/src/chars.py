"""Paper-puppet characters: jointed limbs, brass rivets, expressions.

Local coordinates: origin between the feet, y negative upward. Adult man is
~730 units tall at scale 1. All characters share the same face/rig code so
they stay consistent from scene to scene.
"""
import math

import skia

from engine import (C, PAL, OUTLINE, paper, flat, stroke, rivet, xf, svg, blob, oval, circle, rrect,
                    rect, poly, clamp, lerp, wave, noise1, blink_amount, hash01, with_shadow,
                    shade, mix, SHADOW, _blur, glow, eio, seg, line)

# ---------------------------------------------------------------- looks
LOOKS = {
    'bell': dict(kind='man', skin=0xF2C9A6, hair=0x5B3A22, hair_hl=0x8E6342, hair_style='curly',
                 face='handsome', iris=0x6E8F5C, brows=0x3B2618, coat=0x263A63, coat_dk=0x1B2A4A, vest=0xD9A23C,
                 vest_dk=0xB78526, shirt=0xF7F3EA, tie=0x1E1B22, trousers=0xBDB39C, trousers_dk=0xA0957E,
                 shoes=0x2A1D15, seed=1),
    'bell_old': dict(kind='man', skin=0xF0C49E, hair=0xEDEAE3, hair_hl=0xFFFFFF, hair_style='old_curly',
                     face='handsome', iris=0x6E8F5C, beard='big', brows=0xDAD5CC, coat=0x263A63, coat_dk=0x1B2A4A,
                     vest=0xD9A23C, vest_dk=0xB78526, shirt=0xF7F3EA, tie=0x1E1B22, trousers=0xBDB39C,
                     trousers_dk=0xA0957E, shoes=0x2A1D15, seed=2),
    'mabel': dict(kind='woman', skin=0xF6D0AF, hair=0x6B4733, hair_hl=0x8A6148, hair_style='bun',
                  brows=0x5A3B2A, dress=0x8E9FD6, dress_dk=0x6F7FB8, dress_lt=0xB7C2EA, collar=0xF7F3EA,
                  lips=0xD9776F, seed=3),
    'mabel_bride': dict(kind='woman', skin=0xF6D0AF, hair=0x6B4733, hair_hl=0x8A6148, hair_style='bun',
                        brows=0x5A3B2A, dress=0xF5EFE4, dress_dk=0xDDD3C2, dress_lt=0xFFFFFF, collar=0xFFFFFF,
                        lips=0xD9776F, seed=3, veil=True),
    'operator1': dict(kind='woman', skin=0xF3C9A4, hair=0x2E2420, hair_hl=0x4A3A30, hair_style='bun', ribbon=False,
                      brows=0x2E2420, dress=0xF4F0E6, dress_dk=0xDDD5C4, dress_lt=0xFFFFFF, collar=0x2A2D36,
                      lips=0xC9706A, seed=21),
    'operator2': dict(kind='woman', skin=0xE9B48C, hair=0x8A5A36, hair_hl=0xA87448, hair_style='bun', ribbon=False,
                      brows=0x6A4024, dress=0xE8E2D4, dress_dk=0xD0C8B6, dress_lt=0xFFFFFF, collar=0x5A3A4A,
                      lips=0xC9706A, seed=22),
    'mabel_child': dict(kind='girl', skin=0xF6D0AF, hair=0x7A5238, hair_hl=0x9A6E50, hair_style='childbow',
                        brows=0x5A3B2A, dress=0xE7A9A0, dress_dk=0xC98A82, collar=0xF7F3EA,
                        lips=0xD9776F, seed=4, pinafore=0xF7F3EA),
    'father': dict(kind='man', skin=0xEFC29C, hair=0xD8D3CA, hair_hl=0xF2EFEA, hair_style='bald',
                   whiskers='chops', glasses=True, brows=0x9C978E, coat=0x2B2D36, coat_dk=0x1D1F26,
                   vest=0x6B6F7A, vest_dk=0x555963, shirt=0xF7F3EA, tie=0x7A2A2A, trousers=0x4A4A55,
                   trousers_dk=0x393944, shoes=0x1E1A18, seed=5),
    'watson': dict(kind='man', skin=0xF2C6A0, hair=0xA65A2E, hair_hl=0xC27447, hair_style='short',
                   mustache=True, brows=0x8A4A26, coat=None, vest=0x7A5232, vest_dk=0x5E3E25,
                   shirt=0xF2EEE4, tie=0x2E4A6E, trousers=0x4A4038, trousers_dk=0x3A322C,
                   shoes=0x2A1D15, sleeves=0xF2EEE4, seed=6),
    'mother': dict(kind='woman', skin=0xEFC6A4, hair=0xC9C4BC, hair_hl=0xE4E0DA, hair_style='grandma',
                   brows=0x9C978E, dress=0x5D4A6E, dress_dk=0x47385A, dress_lt=0x7A6690, collar=0xF4EFE6,
                   lips=0xC77A70, glasses=False, seed=7),
    'kid1': dict(kind='boy', skin=0xF3C9A4, hair=0xD9B35C, hair_hl=0xEBCB7D, hair_style='bowl', brows=0xB08A3E,
                 coat=0x3E6E8E, coat_dk=0x2F566F, shirt=0xF7F3EA, trousers=0x6B5A48, shoes=0x2A1D15,
                 tie=0xC0392B, seed=11),
    'kid2': dict(kind='girl', skin=0xE9B48C, hair=0x3A2A21, hair_hl=0x5A4232, hair_style='pigtails',
                 brows=0x2D1F17, dress=0xC0614A, dress_dk=0x9E4C38, collar=0xF7F3EA, lips=0xD9776F,
                 pinafore=0xF3E7CF, seed=12),
    'kid3': dict(kind='boy', skin=0xF6D0AF, hair=0xB4532A, hair_hl=0xCF7044, hair_style='messy',
                 brows=0x8A3A1A, coat=0x6E8B4A, coat_dk=0x56703A, shirt=0xF7F3EA, trousers=0x4A4038,
                 shoes=0x2A1D15, tie=0x263A63, seed=13),
    'kid4': dict(kind='girl', skin=0xF3C9A4, hair=0x8A5A36, hair_hl=0xA87448, hair_style='bob',
                 brows=0x6A4024, dress=0x5E8FB0, dress_dk=0x4A7290, collar=0xF7F3EA, lips=0xD9776F,
                 pinafore=0xF3E7CF, seed=14),
}

DEFAULT_POSE = dict(armL=(10, 12), armR=(10, 12), head=0.0, lean=0.0, legL=0.0, legR=0.0,
                    handL='open', handR='open', holdL=None, holdR=None, bob=0.0)

# ---------------------------------------------------------------- expressions
EXPR = {
    'neutral': dict(eyes='dot', brow_y=0, brow_a=0, mouth='line', mw=16),
    'smile': dict(eyes='dot', brow_y=-3, brow_a=0, mouth='smile', mw=22),
    'happy': dict(eyes='happy', brow_y=-8, brow_a=4, mouth='open_smile', mw=28, cheek=0.62),
    'joy': dict(eyes='dot', brow_y=-8, brow_a=2, mouth='open_smile', mw=28, cheek=0.6),
    'shock': dict(eyes='wide', brow_y=-15, brow_a=-4, mouth='o', mw=14),
    'shock_happy': dict(eyes='wide', brow_y=-15, brow_a=-2, mouth='open_smile', mw=26, cheek=0.55),
    'sad': dict(eyes='sad', brow_y=-2, brow_a=18, mouth='frown', mw=18),
    'cry': dict(eyes='squeeze', brow_y=-2, brow_a=22, mouth='wobble', mw=20, tears=True),
    'tearful': dict(eyes='sad', brow_y=-2, brow_a=20, mouth='frown', mw=16, tears=True),
    'proud': dict(eyes='happy', brow_y=-5, brow_a=0, mouth='smile_big', mw=26, cheek=0.5),
    'nervous': dict(eyes='dot', brow_y=-4, brow_a=16, mouth='wavy', mw=18, sweat=True),
    'stern': dict(eyes='dot', brow_y=5, brow_a=-20, mouth='flat_down', mw=20),
    'love': dict(eyes='soft', brow_y=-4, brow_a=4, mouth='smile', mw=22, cheek=0.75),
    'calm': dict(eyes='soft', brow_y=0, brow_a=3, mouth='smile_small', mw=16),
    'focus': dict(eyes='dot', brow_y=2, brow_a=-6, mouth='line', mw=14),
    'tired': dict(eyes='tired', brow_y=0, brow_a=10, mouth='line', mw=14),
    'sick': dict(eyes='tired', brow_y=0, brow_a=14, mouth='frown', mw=14, cheek=0.9),
    'peace': dict(eyes='closed', brow_y=0, brow_a=4, mouth='smile_small', mw=14),
}


def _eye(c, kind, x, y, r, col, blink, side, L):
    ink = 0x1E1A1C
    if blink > 0.5 and kind not in ('happy', 'squeeze', 'closed'):
        p = skia.Path()
        p.moveTo(x - r * 1.2, y)
        p.quadTo(x, y + r * 0.6, x + r * 1.2, y)
        stroke(c, p, ink, r * 0.55)
        return
    if kind in ('dot', 'sad', 'soft', 'tired'):
        flat(c, circle(x, y, r), ink)
        flat(c, circle(x - r * 0.32, y - r * 0.36, r * 0.32), 0xFFFFFF, 0.9)
        if kind in ('soft', 'tired'):
            # heavy lid: skin covers the top part, dark lid line
            lid = skia.Path()
            cover = 0.15 if kind == 'soft' else 0.35
            lid.addRect(skia.Rect.MakeLTRB(x - r * 1.5, y - r * 1.6, x + r * 1.5, y - r * cover))
            flat(c, lid, L['skin'])
            p = skia.Path()
            p.moveTo(x - r * 1.25, y - r * cover + 1)
            p.quadTo(x, y - r * cover - r * 0.45, x + r * 1.25, y - r * cover + 1)
            stroke(c, p, ink, r * 0.42)
        if kind == 'sad':
            p = skia.Path()
            if side < 0:
                p.moveTo(x - r * 1.3, y - r * 0.9)
                p.lineTo(x + r * 1.1, y - r * 1.6)
            else:
                p.moveTo(x + r * 1.3, y - r * 0.9)
                p.lineTo(x - r * 1.1, y - r * 1.6)
            stroke(c, p, ink, r * 0.35)
    elif kind == 'wide':
        flat(c, circle(x, y, r * 1.75), 0x1E1A1C)
        flat(c, circle(x, y, r * 1.55), 0xFFFFFF)
        flat(c, circle(x, y + r * 0.1, r * 0.75), ink)
        flat(c, circle(x - r * 0.25, y - r * 0.2, r * 0.25), 0xFFFFFF)
    elif kind in ('happy', 'closed'):
        p = skia.Path()
        if kind == 'happy':
            p.moveTo(x - r * 1.3, y + r * 0.5)
            p.quadTo(x, y - r * 1.5, x + r * 1.3, y + r * 0.5)
        else:
            p.moveTo(x - r * 1.3, y - r * 0.1)
            p.quadTo(x, y + r * 0.9, x + r * 1.3, y - r * 0.1)
        stroke(c, p, ink, r * 0.6)
    elif kind == 'squeeze':
        p = skia.Path()
        s = -side
        p.moveTo(x - r * 1.2 * s, y - r * 0.9)
        p.lineTo(x + r * 0.9 * s, y)
        p.lineTo(x - r * 1.2 * s, y + r * 0.9)
        stroke(c, p, ink, r * 0.55)
    if L.get('kind') in ('woman', 'girl') and kind in ('dot', 'sad', 'wide') and blink <= 0.5:
        # lashes
        for k in range(2):
            a = (-30 - k * 26) if side < 0 else (210 + k * 26)
            a = math.radians(a)
            rr = r * (1.75 if kind == 'wide' else 1.05)
            x0, y0 = x + side * r * 0.55 + math.cos(a) * rr * 0.2, y - r * 0.55
            line(c, x0 + side * k * r * 0.25, y0 - k * 1.5, x0 + side * (r * 0.7 + k * r * 0.25),
                 y0 - r * 0.55 - k * 1.5, ink, max(1.6, r * 0.24))


def _mouth(c, kind, x, y, w, talk, L, t):
    ink = 0x3A1E1E
    red = 0x9E3B36
    if talk > 0.02 and kind not in ('o',):
        hgt = 3 + talk * w * 0.75
        p = skia.Path()
        p.moveTo(x - w * 0.55, y - 1)
        p.quadTo(x, y - 4, x + w * 0.55, y - 1)
        p.quadTo(x + w * 0.4, y + hgt, x, y + hgt)
        p.quadTo(x - w * 0.4, y + hgt, x - w * 0.55, y - 1)
        p.close()
        flat(c, p, red)
        flat(c, oval(x, y + hgt * 0.72, w * 0.28, hgt * 0.28), 0xE58A86)
        return
    p = skia.Path()
    if kind == 'line':
        p.moveTo(x - w / 2, y)
        p.lineTo(x + w / 2, y)
        stroke(c, p, ink, 3.6)
    elif kind in ('smile', 'smile_small', 'smile_big'):
        k = {'smile': 0.42, 'smile_small': 0.3, 'smile_big': 0.55}[kind]
        p.moveTo(x - w / 2, y - 2)
        p.quadTo(x, y + w * k, x + w / 2, y - 2)
        stroke(c, p, ink, 3.8)
    elif kind == 'open_smile':
        p.moveTo(x - w * 0.6, y - 4)
        p.quadTo(x, y - 1, x + w * 0.6, y - 4)
        p.quadTo(x + w * 0.5, y + w * 0.75, x, y + w * 0.78)
        p.quadTo(x - w * 0.5, y + w * 0.75, x - w * 0.6, y - 4)
        p.close()
        flat(c, p, red)
        flat(c, oval(x, y + w * 0.52, w * 0.3, w * 0.2), 0xE58A86)
        q = skia.Path()
        q.addRect(skia.Rect.MakeLTRB(x - w * 0.45, y - 4, x + w * 0.45, y + w * 0.12))
        c.save()
        c.clipPath(p, skia.ClipOp.kIntersect, True)
        flat(c, q, 0xFFFFFF)
        c.restore()
    elif kind == 'o':
        o = 0.75 + 0.25 * talk
        flat(c, oval(x, y + 6, w * 0.45, w * 0.62 * o), red)
        flat(c, oval(x, y + 6 + w * 0.25, w * 0.25, w * 0.18), 0xE58A86)
    elif kind == 'frown':
        p.moveTo(x - w / 2, y + 6)
        p.quadTo(x, y - w * 0.35, x + w / 2, y + 6)
        stroke(c, p, ink, 3.6)
    elif kind == 'wobble':
        p.moveTo(x - w / 2, y + 6)
        p.cubicTo(x - w / 4, y - 6, x - w / 8, y + 4, x, y - 2)
        p.cubicTo(x + w / 8, y + 4, x + w / 4, y - 6, x + w / 2, y + 6)
        stroke(c, p, ink, 3.6)
    elif kind == 'wavy':
        p.moveTo(x - w / 2, y + 2)
        p.cubicTo(x - w / 4, y - 5, x - w / 8, y + 6, x, y + 1)
        p.cubicTo(x + w / 8, y - 4, x + w / 4, y + 6, x + w / 2, y)
        stroke(c, p, ink, 3.4)
    elif kind == 'flat_down':
        p.moveTo(x - w / 2, y + 5)
        p.lineTo(x - w / 2 + 5, y)
        p.lineTo(x + w / 2 - 5, y)
        p.lineTo(x + w / 2, y + 5)
        stroke(c, p, ink, 3.8)


def tear_path(x, y, s=1.0):
    p = skia.Path()
    p.moveTo(x, y - 14 * s)
    p.cubicTo(x + 4 * s, y - 6 * s, x + 9 * s, y, x + 9 * s, y + 5 * s)
    p.cubicTo(x + 9 * s, y + 11 * s, x + 4 * s, y + 14 * s, x, y + 14 * s)
    p.cubicTo(x - 4 * s, y + 14 * s, x - 9 * s, y + 11 * s, x - 9 * s, y + 5 * s)
    p.cubicTo(x - 9 * s, y, x - 4 * s, y - 6 * s, x, y - 14 * s)
    p.close()
    return p


def face(c, L, expr, t, blink, talk, lx, ly, scale=1.0):
    """draw facial features in head-local coords (head centre 0,0; face ~ 88x96)"""
    if SHADOW[0]:
        return
    if L.get('face') == 'handsome':
        face_h(c, L, expr, t, blink, talk, lx, ly)
        return
    E = EXPR.get(expr, EXPR['smile'])
    fem = L['kind'] in ('woman', 'girl')
    ex = 34
    ey = 6 + ly * 6
    r = 8.0 if not fem else 7.6
    cx = lx * 14
    # cheeks
    ca = E.get('cheek', 0.42)
    for sd in (-1, 1):
        c.drawCircle(sd * 55 + cx * 0.7, 40 + ly * 4, 15,
                     skia.Paint(AntiAlias=True, Color=C(0xEC8F7C, ca * 0.75), MaskFilter=_blur(5)))
    # eyes
    for sd in (-1, 1):
        _eye(c, E['eyes'], sd * ex + cx, ey, r, None, blink, sd, L)
    # brows
    by = -22 + E['brow_y'] + ly * 4
    ba = E['brow_a']
    bw = 30 if not fem else 26
    bt = 7 if not fem else 4.6
    if L.get('hair_style') == 'old' or L.get('hair_style') == 'bald':
        bt = 8.5
    for sd in (-1, 1):
        with xf(c, sd * 36 + cx * 0.9, by, sd * ba):
            p = rrect(-bw / 2, -bt / 2, bw, bt, bt / 2)
            flat(c, p, L['brows'])
    # glasses
    if L.get('glasses'):
        for sd in (-1, 1):
            stroke(c, circle(sd * ex + cx, ey, 17), 0x3A2E26, 3.2)
            c.drawCircle(sd * ex + cx, ey, 16, skia.Paint(AntiAlias=True, Color=C(0xFFFFFF, 0.12)))
        line(c, -ex + 17 + cx, ey, ex - 17 + cx, ey, 0x3A2E26, 3)
    # nose
    p = skia.Path()
    nx = lx * 18
    p.moveTo(nx - 2, 22)
    p.quadTo(nx + 7, 33, nx - 1, 38)
    stroke(c, p, shade(L['skin'], 0.78), 3.2)
    # mouth (beard hides most of it for bell_old)
    mx = lx * 15
    my = 62 + ly * 3
    if L.get('beard') == 'big':
        my = 66
    _mouth(c, E['mouth'], mx, my, E['mw'] * (0.9 if fem else 1.0), talk, L, t)
    if fem and E['mouth'] in ('smile', 'smile_small', 'line', 'smile_big'):
        # soft lip tint
        c.drawCircle(mx, my + 3, 6, skia.Paint(AntiAlias=True, Color=C(L.get('lips', 0xD9776F), 0.35),
                                              MaskFilter=_blur(2)))
    # tears
    if E.get('tears'):
        for sd in (-1, 1):
            for k in range(2):
                ph = ((t * 0.55 + k * 0.5 + (0.25 if sd > 0 else 0)) % 1.0)
                yy = ey + 14 + ph * 70
                a = 1.0 - seg(ph, 0.75, 1.0)
                c.save()
                p = tear_path(sd * (ex + 4) + cx, yy, 0.8 + 0.25 * seg(ph, 0, 0.3))
                if a > 0.02:
                    paper(c, p, 0x9FD3EA, ol=2.2, alpha=a, tex=False)
                    flat(c, circle(sd * (ex + 4) + cx - 2, yy + 2, 2.2), 0xFFFFFF, 0.8 * a)
                c.restore()
    if E.get('sweat'):
        ph = (t * 0.5) % 1.0
        p = tear_path(80, -30 + ph * 40, 1.0)
        paper(c, p, 0xA8D8EE, ol=2.2, alpha=1 - seg(ph, 0.7, 1), tex=False)


# ---------------------------------------------------------------- ribbon bow
RIBBON = 0xE57F93      # rose-pink ribbon (Mabel's motif, child and adult)
RIBBON_DK = 0xC25D73


def ribbon_bow(c, x, y, rot=0.0, s=1.0, col=RIBBON, dk=RIBBON_DK, t=0.0):
    """cute paper ribbon bow: two loops, knot, two tails (with a gentle flutter)"""
    fl = math.sin(t * 2.1) * 3.0
    with xf(c, x, y, rot, s):
        # tails
        paper(c, poly([(-4, 4), (-22, 46 + fl), (-12, 42 + fl), (-6, 52 + fl), (4, 6)]), dk, ol=2.2, seed=91)
        paper(c, poly([(4, 4), (20, 44 - fl), (11, 41 - fl), (8, 50 - fl), (-3, 6)]), dk, ol=2.2, seed=92)
        # loops
        lp = blob([(0, 0), (-18, -20), (-40, -22), (-46, -4), (-40, 14), (-18, 14)], k=0.9)
        rp = blob([(0, 0), (18, -20), (40, -22), (46, -4), (40, 14), (18, 14)], k=0.9)
        paper(c, lp, col, ol=2.4, seed=93)
        paper(c, rp, col, ol=2.4, seed=94)
        # inner fold shading
        stroke(c, svg("M -8 -2 Q -24 -8 -34 -4"), dk, 2.4, 0.7)
        stroke(c, svg("M 8 -2 Q 24 -8 34 -4"), dk, 2.4, 0.7)
        flat(c, circle(-30, -10, 4), 0xFFFFFF, 0.35)
        flat(c, circle(30, -10, 4), 0xFFFFFF, 0.35)
        # knot
        paper(c, rrect(-9, -10, 18, 20, 7), shade(col, 0.92), ol=2.2, seed=95)
        stroke(c, svg("M -4 -6 L -4 6"), dk, 1.6, 0.6)



# ---------------------------------------------------------------- handsome face (young/old Bell)
import functools


@functools.lru_cache(maxsize=64)
def union_circles(key):
    """single path = union of circles ((x,y,r),...) -> one cut-paper piece"""
    b = skia.OpBuilder()
    for e in key:
        q = skia.Path()
        if len(e) == 3:
            q.addCircle(e[0], e[1], e[2])
        else:
            q.addOval(skia.Rect.MakeLTRB(e[0] - e[2], e[1] - e[3], e[0] + e[2], e[1] + e[3]))
        b.add(q, skia.PathOp.kUnion_PathOp)
    return b.resolve()


def _almond(x, y, rw, rh):
    p = skia.Path()
    p.moveTo(x - rw, y + 1)
    p.quadTo(x, y - rh * 1.75, x + rw, y - 1)
    p.quadTo(x, y + rh * 1.3, x - rw, y + 1)
    p.close()
    return p


def _eye_h(c, kind, x, y, blink, side, L, lx, ly):
    ink = 0x2A1C16
    sk = L['skin']
    if blink > 0.5 and kind not in ('happy', 'squeeze', 'closed'):
        p = skia.Path()
        p.moveTo(x - 15, y)
        p.quadTo(x, y + 6, x + 15, y - 1)
        stroke(c, p, ink, 3.6)
        return
    if kind in ('happy', 'closed'):
        p = skia.Path()
        if kind == 'happy':
            p.moveTo(x - 14, y + 4)
            p.quadTo(x, y - 10, x + 14, y + 4)
        else:
            p.moveTo(x - 14, y)
            p.quadTo(x, y + 7, x + 14, y - 1)
        stroke(c, p, ink, 4.2)
        return
    if kind == 'squeeze':
        p = skia.Path()
        s_ = -side
        p.moveTo(x - 10 * s_, y - 8)
        p.lineTo(x + 8 * s_, y)
        p.lineTo(x - 10 * s_, y + 8)
        stroke(c, p, ink, 4.2)
        return
    k = 1.32 if kind == 'wide' else 1.0
    rw, rh = 15.5 * k, 7.6 * k
    alm = _almond(x, y, rw, rh)
    flat(c, alm, 0xFBF7F0)
    c.save()
    c.clipPath(alm, skia.ClipOp.kIntersect, True)
    ix, iy = x + lx * 4 + side * 0.5, y + ly * 2 + 0.5
    ir = 7.2 if kind != 'wide' else 6.6
    flat(c, circle(ix, iy, ir), L.get('iris', 0x6E8F5C))
    flat(c, circle(ix, iy, ir * 0.62), shade(L.get('iris', 0x6E8F5C), 0.7), 0.6)
    flat(c, circle(ix, iy, 3.3), 0x15100E)
    flat(c, circle(ix - 2.2, iy - 2.6, 1.9), 0xFFFFFF, 0.95)
    if kind in ('soft', 'tired'):
        cover = 0.25 if kind == 'soft' else 0.0
        flat(c, rect(x - 30, y - 30, 60, 30 - rh * cover), sk)
    c.restore()
    if kind in ('soft', 'tired'):
        cover = 0.25 if kind == 'soft' else 0.0
        p = skia.Path()
        p.moveTo(x - rw - 1, y + 1)
        p.quadTo(x, y - rh * cover * 1.6 - 2, x + rw + 1, y - 1)
        stroke(c, p, ink, 3.4)
    else:
        p = skia.Path()
        p.moveTo(x - rw - 1, y + 1)
        p.quadTo(x, y - rh * 1.75, x + rw + 1.5, y - 1.5)
        stroke(c, p, ink, 3.4)
        line(c, x + side * rw, y - 1, x + side * (rw + 5), y - 4.5, ink, 2.6)
    # crease + lower lid hint (depth)
    p = skia.Path()
    p.moveTo(x - rw * 0.8, y - rh * 1.35)
    p.quadTo(x, y - rh * 2.5, x + rw * 0.85, y - rh * 1.45)
    stroke(c, p, shade(sk, 0.8), 1.8, 0.65)
    p = skia.Path()
    p.moveTo(x - rw * 0.6, y + rh * 0.95)
    p.quadTo(x, y + rh * 1.4, x + rw * 0.6, y + rh * 0.95)
    stroke(c, p, shade(sk, 0.82), 1.6, 0.45)


def _brow_h(c, L, x, y, side, ang, thick=1.0):
    with xf(c, x, y, side * ang):
        # tapered brow: thick inner end, thin outer tip, gentle arch
        s_ = side
        p = blob([(-s_ * 18, -4.5 * thick), (s_ * 2, -7.5 * thick), (s_ * 20, -6), (s_ * 24, -3.5),
                  (s_ * 4, -1.5), (-s_ * 18, 3.5 * thick)], k=0.7)
        flat(c, p, L['brows'])


def _nose_h(c, L, nx):
    col = shade(L['skin'], 0.72)
    p = skia.Path()
    p.moveTo(nx - 1, -4)
    p.quadTo(nx + 2, 14, nx + 4, 28)
    p.quadTo(nx + 5, 36, nx - 3, 37)
    stroke(c, p, col, 3.0)
    p = skia.Path()
    p.moveTo(nx - 11, 33)
    p.quadTo(nx - 8, 38, nx - 3, 37)
    stroke(c, p, col, 2.6, 0.8)
    c.drawCircle(nx + 6, 22, 6, skia.Paint(AntiAlias=True, Color=C(0xFFFFFF, 0.18), MaskFilter=_blur(3)))


def _mouth_h(c, kind, x, y, w, talk, L, t):
    if talk > 0.02 or kind not in ('line', 'smile', 'smile_small', 'smile_big'):
        _mouth(c, kind, x, y, w, talk, L, t)
        return
    k = {'line': 0.08, 'smile': 0.32, 'smile_small': 0.22, 'smile_big': 0.45}[kind]
    hw = w * 0.62
    # fuller lower lip
    p = skia.Path()
    p.moveTo(x - hw * 0.8, y + 1 + hw * k * 0.6)
    p.quadTo(x, y + 13 + hw * k * 0.8, x + hw * 0.8, y + 1 + hw * k * 0.6)
    p.quadTo(x, y + 2 + hw * k, x - hw * 0.8, y + 1 + hw * k * 0.6)
    p.close()
    flat(c, p, 0xD48D84, 0.85)
    # upper lip (cupid's bow)
    p = skia.Path()
    p.moveTo(x - hw, y + hw * k * 0.2)
    p.quadTo(x - hw * 0.4, y - 6, x - 3, y - 3)
    p.lineTo(x, y - 1)
    p.lineTo(x + 3, y - 3)
    p.quadTo(x + hw * 0.4, y - 6, x + hw, y + hw * k * 0.2)
    p.quadTo(x, y + hw * k * 1.1, x - hw, y + hw * k * 0.2)
    p.close()
    flat(c, p, 0xB9706A, 0.8)
    # mouth line
    p = skia.Path()
    p.moveTo(x - hw, y + hw * k * 0.2)
    p.quadTo(x, y + hw * k * 1.15, x + hw, y + hw * k * 0.2)
    stroke(c, p, 0x5E302C, 3.0)


def face_h(c, L, expr, t, blink, talk, lx, ly):
    E = EXPR.get(expr, EXPR['smile'])
    sk = L['skin']
    ex, ey = 33, 6 + ly * 6
    cx = lx * 14
    ca = E.get('cheek', 0.42) * 0.3
    for sd in (-1, 1):
        c.drawCircle(sd * 56 + cx * 0.7, 44 + ly * 4, 15,
                     skia.Paint(AntiAlias=True, Color=C(0xE48A78, ca * 0.7), MaskFilter=_blur(6)))
        # cheekbone / jaw shading for structure
        q = skia.Path()
        q.moveTo(sd * 76, 26)
        q.quadTo(sd * 66, 66, sd * 34, 92)
        c.drawPath(q, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=10,
                                 Color=C(shade(sk, 0.78), 0.22), MaskFilter=_blur(5)))
    for sd in (-1, 1):
        _eye_h(c, E['eyes'], sd * ex + cx, ey, blink, sd, L, lx, ly)
    by = -20 + E['brow_y'] + ly * 4
    for sd in (-1, 1):
        _brow_h(c, L, sd * 35 + cx * 0.9, by, sd, E['brow_a'], 1.15 if L.get('hair_style') == 'old_curly' else 1.0)
    _nose_h(c, L, lx * 17)
    my = 64 + ly * 3 + (4 if L.get('beard') == 'big' else 0)
    _mouth_h(c, E['mouth'], lx * 15, my, E['mw'], talk, L, t)
    # chin dimple shadow
    c.drawCircle(lx * 12, 92, 9, skia.Paint(AntiAlias=True, Color=C(shade(sk, 0.8), 0.25), MaskFilter=_blur(4)))
    if E.get('tears'):
        for sd in (-1, 1):
            for kk in range(2):
                ph = ((t * 0.55 + kk * 0.5 + (0.25 if sd > 0 else 0)) % 1.0)
                yy = ey + 14 + ph * 70
                a = 1.0 - seg(ph, 0.75, 1.0)
                if a > 0.02:
                    paper(c, tear_path(sd * (ex + 4) + cx, yy, 0.8 + 0.25 * seg(ph, 0, 0.3)), 0x9FD3EA, ol=2.2,
                          alpha=a, tex=False)
    if E.get('sweat'):
        ph = (t * 0.5) % 1.0
        paper(c, tear_path(82, -30 + ph * 40, 1.0), 0xA8D8EE, ol=2.2, alpha=1 - seg(ph, 0.7, 1), tex=False)


def _jit(i, k, amp):
    return (hash01(i, k, 77) - 0.5) * 2 * amp


# young Bell: tousled curls hugging the skull (back layer adds volume, darker)
CURLY_BACK = tuple((round(math.cos(math.radians(a)) * 84 + _jit(i, 1, 5), 1),
                    round(math.sin(math.radians(a)) * 80 - 26 + _jit(i, 2, 5), 1),
                    round(25 + 5 * hash01(i, 3, 77), 1))
                   for i, a in enumerate(range(160, 385, 16))) + ((0, -46, 84, 76),)
CURLY_FRONT = ((0, -80, 86, 46),) + tuple(
    (round(math.cos(math.radians(a)) * 80 + _jit(i, 4, 4), 1),
     round(-80 + math.sin(math.radians(a)) * 30 + _jit(i, 5, 3), 1),
     round(20 + 5 * hash01(i, 6, 77), 1))
    for i, a in enumerate(range(196, 350, 22))) + (
    (-66, -56, 21), (-41, -60, 23), (-15, -55, 21), (12, -61, 23), (38, -57, 21), (62, -59, 20),
    (-25, -42, 11.5), (19, -44, 10.5), (46, -46, 9.5),
    (-82, -40, 19), (-88, -15, 16), (-86, 8, 13), (82, -42, 19), (88, -17, 16), (86, 6, 13))
OLD_BACK = tuple((round(math.cos(math.radians(a)) * 90 + _jit(i, 1, 4), 1),
                  round(math.sin(math.radians(a)) * 80 - 20 + _jit(i, 2, 4), 1),
                  round(22 + 5 * hash01(i, 3, 78), 1))
                 for i, a in enumerate(range(160, 385, 18)))
OLD_FRONT = ((-82, -38, 19), (-91, -12, 17), (-89, 12, 14), (-66, -62, 17), (82, -38, 19), (91, -12, 17),
             (89, 12, 14), (66, -62, 17), (-22, -90, 13), (4, -94, 11), (26, -88, 12))


def _curl_details(c, circles, hl, dk, skip_first=True):
    for i, e in enumerate(circles):
        if (skip_first and i == 0) or len(e) != 3:
            continue
        x, y, r = e
        if r < 9:
            p = skia.Path()
            p.addArc(skia.Rect.MakeLTRB(x - r * 0.55, y - r * 0.55, x + r * 0.55, y + r * 0.55), 120 + i * 40, 230)
            stroke(c, p, hl, 2.2, 0.7)
            continue
        st = hash01(i, 11, 5) * 360
        sw = 90 + hash01(i, 12, 5) * 90
        rr = r * (0.45 + 0.2 * hash01(i, 13, 5))
        p = skia.Path()
        p.addArc(skia.Rect.MakeLTRB(x - rr, y - rr, x + rr, y + rr), st, sw)
        stroke(c, p, hl, 2.6, 0.55)
        if i % 2 == 0:
            p = skia.Path()
            p.addArc(skia.Rect.MakeLTRB(x - r * 0.85, y - r * 0.85, x + r * 0.85, y + r * 0.85), 30 + hash01(i, 14, 5) * 60, 80)
            stroke(c, p, dk, 2.6, 0.45)


# ---------------------------------------------------------------- hair
def hair_back(c, L, seed):
    st = L['hair_style']
    hc = L['hair']
    if L.get('veil'):
        p = blob([(0, -130), (70, -110), (120, -20), (150, 140), (170, 300), (60, 280), (0, 120), (-60, 280),
                  (-170, 300), (-150, 140), (-120, -20), (-70, -110)], k=0.7)
        paper(c, p, 0xFFFFFF, ol=2.5, alpha=0.55, seed=seed + 99, tex=False)
    if st == 'curly':
        paper(c, union_circles(CURLY_BACK), shade(hc, 0.9), seed=seed + 1)
        _curl_details(c, CURLY_BACK, L['hair_hl'], shade(hc, 0.7), skip_first=False)
    elif st == 'old_curly':
        paper(c, union_circles(OLD_BACK), shade(hc, 0.93), seed=seed + 1)
        _curl_details(c, OLD_BACK, 0xFFFFFF, 0xCFCAC0, skip_first=False)
    elif st == 'bun':
        paper(c, circle(0, -100, 40), hc, seed=seed + 1)
        stroke(c, svg("M -24 -110 Q 0 -128 24 -110"), L['hair_hl'], 3, 0.7)
    elif st == 'grandma':
        paper(c, circle(0, -96, 36), hc, seed=seed + 1)
    elif st == 'pigtails':
        for sd in (-1, 1):
            with xf(c, sd * 92, -10, sd * -15):
                paper(c, blob([(0, 0), (sd * 22, 18), (sd * 26, 60), (sd * 8, 86), (sd * -8, 60), (sd * -6, 20)]),
                      hc, seed=seed + 2 + sd)
                paper(c, circle(0, 2, 9), 0xC0392B, ol=2)
    elif st == 'childbow':
        paper(c, blob([(-92, -20), (-104, 40), (-88, 96), (-60, 92), (60, 92), (88, 96), (104, 40), (92, -20), (0, -60)]),
              hc, seed=seed + 3)


def hair_front(c, L, seed, t):
    st = L['hair_style']
    hc = L['hair']
    hl = L['hair_hl']
    if st == 'curly':
        paper(c, union_circles(CURLY_FRONT), hc, seed=seed + 5)
        _curl_details(c, CURLY_FRONT, hl, shade(hc, 0.7))
        # a loose curl springing on the forehead (moves a little)
        bob = math.sin(t * 1.9) * 1.5
        p = skia.Path()
        p.addArc(skia.Rect.MakeLTRB(-14, -40 + bob, 4, -22 + bob), 300, 260)
        stroke(c, p, hc, 4.5)
    elif st == 'old_curly':
        paper(c, union_circles(OLD_FRONT), hc, seed=seed + 5)
        _curl_details(c, OLD_FRONT, 0xFFFFFF, 0xCFCAC0, skip_first=False)
    elif st == 'bell':
        p = svg("M -98 22 C -106 -40 -86 -96 -40 -114 C -6 -128 46 -124 76 -100 C 100 -80 108 -40 99 20 "
                "L 88 22 C 86 -6 80 -30 66 -44 C 40 -60 0 -52 -28 -60 C -46 -50 -64 -38 -76 -18 "
                "C -84 -4 -86 10 -88 22 Z")
        paper(c, p, hc, seed=seed + 5)
        # quiff and strands
        stroke(c, svg("M -28 -60 C -10 -92 34 -102 66 -84"), hl, 3.2, 0.9)
        stroke(c, svg("M -60 -40 C -50 -76 -20 -100 20 -108"), hl, 2.6, 0.7)
        stroke(c, svg("M 10 -56 C 30 -66 56 -66 74 -52"), hl, 2.4, 0.6)
    elif st == 'old':
        # receding white hair: sides + thin top tuft
        for sd in (-1, 1):
            p = blob([(sd * 70, -66), (sd * 98, -36), (sd * 104, 6), (sd * 92, 26), (sd * 82, 6), (sd * 80, -24),
                      (sd * 62, -50)])
            paper(c, p, hc, seed=seed + 6 + sd)
        p = svg("M -60 -70 C -40 -104 40 -106 62 -72 C 40 -84 -30 -86 -60 -70 Z")
        paper(c, p, hc, seed=seed + 9, ol=2.5)
        stroke(c, svg("M -40 -84 Q 0 -96 40 -84"), 0xCFCAC0, 2, 0.6)
    elif st == 'bun':
        p = svg("M -94 30 C -104 -30 -84 -90 -36 -106 C -12 -114 12 -114 36 -106 C 84 -90 104 -30 94 30 "
                "C 86 32 82 20 80 6 C 76 -24 60 -46 34 -54 C 18 -58 6 -60 0 -70 "
                "C -6 -60 -18 -58 -34 -54 C -60 -46 -76 -24 -80 6 C -82 20 -86 32 -94 30 Z")
        paper(c, p, hc, seed=seed + 5)
        stroke(c, svg("M 0 -70 C -10 -90 -40 -100 -64 -80"), hl, 2.6, 0.8)
        stroke(c, svg("M 0 -70 C 10 -90 40 -100 64 -80"), hl, 2.6, 0.8)
        stroke(c, svg("M -40 -60 C -60 -54 -74 -36 -80 -12"), hl, 2.2, 0.6)
        if L.get('ribbon', True):
            ribbon_bow(c, 46, -98, 18, 0.95, t=t)
    elif st == 'grandma':
        p = svg("M -92 24 C -100 -36 -76 -92 -30 -104 C 0 -110 30 -108 50 -100 C 86 -84 100 -36 92 24 "
                "C 84 20 80 0 76 -14 C 66 -40 40 -56 0 -58 C -40 -56 -66 -40 -76 -14 C -80 0 -84 20 -92 24 Z")
        paper(c, p, hc, seed=seed + 5)
        # lace cap
        p = svg("M -70 -78 C -40 -116 40 -116 70 -78 C 50 -92 -50 -92 -70 -78 Z")
        paper(c, p, 0xF6F1E8, ol=2.5, seed=seed + 8)
        for k in range(7):
            flat(c, circle(-54 + k * 18, -84 - 6 * math.sin(k / 6 * math.pi), 4), 0xFFFFFF, 0.9)
    elif st == 'bald':
        for sd in (-1, 1):
            p = blob([(sd * 74, -60), (sd * 98, -30), (sd * 102, 10), (sd * 90, 30), (sd * 82, 6), (sd * 80, -28)])
            paper(c, p, hc, seed=seed + 6 + sd)
        stroke(c, svg("M -30 -82 Q 0 -90 30 -82"), shade(L['skin'], 0.86), 2.4, 0.7)
    elif st == 'short':
        p = svg("M -94 10 C -102 -50 -76 -100 -24 -110 C 20 -118 70 -104 90 -70 C 102 -46 100 -16 94 10 "
                "L 84 8 C 82 -16 74 -36 56 -48 C 30 -60 -10 -54 -40 -60 C -62 -46 -78 -26 -84 8 Z")
        paper(c, p, hc, seed=seed + 5)
        stroke(c, svg("M -40 -60 C -20 -90 30 -100 70 -80"), hl, 2.6, 0.8)
    elif st == 'bowl':
        p = svg("M -96 10 C -100 -60 -60 -104 0 -106 C 60 -104 100 -60 96 10 C 90 6 86 -10 84 -22 "
                "C 40 -30 -40 -30 -84 -22 C -86 -10 -90 6 -96 10 Z")
        paper(c, p, hc, seed=seed + 5)
        for k in range(5):
            stroke(c, svg(f"M {-60 + k * 30} -26 L {-56 + k * 30} -40"), shade(hc, 0.85), 2.2, 0.7)
    elif st == 'messy':
        pts = []
        for k in range(15):
            a = math.pi + k / 14 * math.pi
            rr = 104 + (10 if k % 2 else -2)
            pts.append((math.cos(a) * rr, math.sin(a) * rr * 0.98 + 4))
        pts += [(96, 6), (80, -24), (40, -44), (0, -36), (-40, -46), (-80, -24), (-96, 6)]
        paper(c, poly(pts), hc, seed=seed + 5)
    elif st == 'pigtails' or st == 'bob' or st == 'childbow':
        p = svg("M -94 20 C -100 -50 -70 -100 0 -104 C 70 -100 100 -50 94 20 C 86 18 82 -6 78 -20 "
                "C 50 -40 20 -44 0 -64 C -20 -44 -50 -40 -78 -20 C -82 -6 -86 18 -94 20 Z")
        if st == 'bob':
            p = svg("M -100 50 C -106 -40 -74 -102 0 -104 C 74 -102 106 -40 100 50 C 90 54 84 40 82 20 "
                    "C 78 -10 60 -34 30 -40 C 10 -44 -10 -44 -30 -40 C -60 -34 -78 -10 -82 20 C -84 40 -90 54 -100 50 Z")
        paper(c, p, hc, seed=seed + 5)
        stroke(c, svg("M 0 -64 C -14 -84 -44 -92 -66 -72"), hl, 2.4, 0.8)
        if st == 'childbow':
            ribbon_bow(c, 50, -82, 20, 1.0, t=t)


def whiskers(c, L, seed):
    w = L.get('whiskers')
    hc = L['hair']
    if w == 'side':
        for sd in (-1, 1):
            p = poly([(sd * 72, -18), (sd * 89, -18), (sd * 90, 46), (sd * 80, 58), (sd * 70, 50)])
            paper(c, blob([(sd * 72, -18), (sd * 90, -18), (sd * 91, 44), (sd * 78, 58), (sd * 70, 46)], k=0.5),
                  hc, seed=seed + 20 + sd, ol=2.5)
    elif w == 'chops':
        for sd in (-1, 1):
            paper(c, blob([(sd * 74, -10), (sd * 92, -12), (sd * 96, 50), (sd * 70, 96), (sd * 50, 92), (sd * 62, 50)],
                          k=0.7), hc, seed=seed + 20 + sd, ol=2.5)
        stroke(c, svg("M -26 50 Q 0 44 26 50"), shade(hc, 0.85), 4, 0.9)


def beard(c, L, seed, t):
    if L.get('beard') != 'big':
        return
    hc = L['hair']
    p = svg("M -90 0 C -92 40 -84 90 -60 130 C -40 162 -16 186 0 196 C 16 186 40 162 60 130 C 84 90 92 40 90 0 "
            "C 80 30 70 50 50 60 C 30 50 12 46 0 50 C -12 46 -30 50 -50 60 C -70 50 -80 30 -90 0 Z")
    paper(c, p, hc, seed=seed + 30)
    for k in range(6):
        x0 = -50 + k * 20
        stroke(c, svg(f"M {x0} {70 + abs(k - 2.5) * 6} Q {x0 + 4} {120} {x0 * 0.5} {150 + (3 - abs(k - 2.5)) * 8}"),
               0xCFCAC0, 2, 0.7)
    # moustache
    p = svg("M 0 50 C -14 42 -36 44 -52 58 C -40 64 -20 64 0 58 C 20 64 40 64 52 58 C 36 44 14 42 0 50 Z")
    paper(c, p, 0xF4F1EB, ol=2, seed=seed + 31)


def mustache(c, L, seed):
    if not L.get('mustache'):
        return
    p = svg("M 0 48 C -10 42 -28 42 -40 52 C -30 58 -14 58 0 54 C 14 58 30 58 40 52 C 28 42 10 42 0 48 Z")
    paper(c, p, L['hair'], ol=2, seed=seed + 31)


# ---------------------------------------------------------------- head
def draw_head(c, L, expr='smile', t=0.0, blink=0.0, talk=0.0, lx=0.0, ly=0.0, seed=0):
    sk = L['skin']
    hair_back(c, L, seed)
    # ears
    ear_x = 81 if L.get('face') == 'handsome' else 86
    for sd in (-1, 1):
        ex = sd * (ear_x - lx * sd * 6)
        paper(c, oval(ex, 14, 16, 22), sk, seed=seed + 40 + sd, ol=2.5)
        stroke(c, svg(f"M {ex - sd * 5} 4 Q {ex + sd * 4} 14 {ex - sd * 4} 24"), shade(sk, 0.8), 2.2, 0.8)
    # face
    if L.get('face') == 'handsome':
        p = blob([(0, -98), (50, -92), (79, -58), (82, -4), (76, 38), (58, 74), (30, 100), (0, 107), (-30, 100),
                  (-58, 74), (-76, 38), (-82, -4), (-79, -58), (-50, -92)], k=0.85)
    else:
        p = blob([(0, -96), (52, -88), (86, -48), (90, 10), (80, 58), (50, 90), (0, 100), (-50, 90), (-80, 58),
                  (-90, 10), (-86, -48), (-52, -88)])
    paper(c, p, sk, seed=seed + 42)
    whiskers(c, L, seed)
    beard(c, L, seed, t)
    face(c, L, expr, t, blink, talk, lx, ly)
    mustache(c, L, seed)
    hair_front(c, L, seed, t)


# ---------------------------------------------------------------- hands / limbs
def hand(c, L, kind='open', side=1):
    sk = L['skin']
    if kind == 'point':
        paper(c, rrect(-7, -6, 14, 46, 7), sk, ol=2.5)
        paper(c, circle(0, 0, 18), sk, ol=2.5)
    elif kind == 'fist':
        paper(c, circle(0, 0, 18), sk, ol=2.5)
        stroke(c, svg("M -8 -4 L 8 -4 M -8 4 L 8 4"), shade(sk, 0.82), 2, 0.8)
    elif kind == 'wave':
        paper(c, blob([(-16, -6), (-14, 18), (0, 24), (14, 18), (16, -6), (0, -14)]), sk, ol=2.5)
        for k in range(4):
            paper(c, rrect(-14 + k * 8, 10, 7, 20, 3.5), sk, ol=1.8)
    else:
        paper(c, blob([(-15, -10), (-17, 10), (-6, 22), (8, 22), (17, 10), (15, -10), (0, -16)]), sk, ol=2.5)
        paper(c, blob([(side * 12, -4), (side * 24, 4), (side * 22, 12), (side * 12, 10)]), sk, ol=2)


def arm(c, L, side, sh, el, hand_kind, hold, sleeve, sleeve_dk, cuff, kind, s_len=110, f_len=100, w=44):
    """draw an arm in the shoulder frame. side=-1 screen-left, +1 screen-right."""
    rot_sh = sh if side < 0 else -sh
    with xf(c, 0, 0, rot_sh):
        # upper arm
        if kind == 'woman':
            paper(c, blob([(-26, -18), (0, -30), (26, -18), (24, 24), (0, 30), (-24, 24)]), L.get('dress_lt', sleeve),
                  seed=hash01(side, 3) * 99)
        paper(c, rrect(-w / 2, -14, w, s_len + 14, w / 2), sleeve, seed=int(30 + side))
        stroke(c, svg(f"M {-w / 2 + 6} {s_len * 0.4} Q 0 {s_len * 0.45} {w / 2 - 6} {s_len * 0.4}"), sleeve_dk, 2, 0.5)
        with xf(c, 0, s_len, (-el if side < 0 else el)):
            fw = w * 0.88
            paper(c, rrect(-fw / 2, -fw / 2, fw, f_len + fw / 2, fw / 2), sleeve, seed=int(40 + side))
            if cuff is not None:
                paper(c, rrect(-fw / 2 - 1, f_len - 12, fw + 2, 16, 6), cuff, ol=2)
            with xf(c, 0, f_len + 14):
                hand(c, L, hand_kind, side)
                if hold is not None:
                    hold(c)
            rivet(c, 0, 0, 4.6)
    rivet(c, 0, 0, 5.2)


# ---------------------------------------------------------------- bodies
def body_man(c, L, P, t, seed, expr, blink, talk, lx, ly, breath):
    coat = L.get('coat')
    vest = L['vest'] if 'vest' in L else None
    # legs
    for sd, ang in ((-1, P['legL']), (1, P['legR'])):
        with xf(c, sd * 30, -300, ang):
            paper(c, rrect(-25, -10, 50, 286, 14), L['trousers'], seed=seed + 50 + sd)
            stroke(c, svg("M 0 40 L 0 250"), L.get('trousers_dk', shade(L['trousers'], 0.85)), 2.2, 0.55)
            paper(c, blob([(-28, 262), (sd * 4 - 30 + 20, 254), (30 + sd * 14, 262), (38 + sd * 14, 282), (-30, 284)],
                          k=0.6), L['shoes'], seed=seed + 52 + sd, ol=2.5)
            rivet(c, 0, 130, 4.4)
    # upper body (lean about hip)
    with xf(c, 0, -300, P['lean']):
        with xf(c, 0, 0, 0, 1.0, 1.0 + breath):
            with xf(c, 0, 300):
                if coat:
                    # coat tails
                    paper(c, poly([(-74, -340), (-80, -228), (-30, -236), (0, -270), (30, -236), (80, -228), (74, -340)]),
                          L.get('coat_dk', coat), seed=seed + 60)
                    # torso
                    torso = blob([(-80, -470), (-50, -484), (50, -484), (80, -470), (86, -400), (74, -330), (68, -262),
                                  (0, -270), (-68, -262), (-74, -330), (-86, -400)], k=0.55)
                    paper(c, torso, coat, seed=seed + 61)
                    # shirt + vest V
                    paper(c, poly([(-34, -486), (34, -486), (0, -380)]), L['shirt'], ol=2, seed=seed + 62)
                    if vest is not None:
                        paper(c, poly([(-36, -470), (-14, -455), (0, -392), (14, -455), (36, -470), (34, -300),
                                       (0, -282), (-34, -300)]), vest, ol=2.5, seed=seed + 63)
                        for k in range(4):
                            flat(c, circle(0, -370 + k * 22, 3.6), L.get('vest_dk', shade(vest, 0.8)))
                    # lapels
                    paper(c, poly([(-36, -486), (-56, -470), (-40, -400), (-12, -440)]), L.get('coat_dk', coat), ol=2,
                          seed=seed + 64)
                    paper(c, poly([(36, -486), (56, -470), (40, -400), (12, -440)]), L.get('coat_dk', coat), ol=2,
                          seed=seed + 65)
                    for k in range(2):
                        rivet(c, -44, -360 + k * 34, 3.4)
                        rivet(c, 44, -360 + k * 34, 3.4)
                else:
                    # shirt sleeves + vest (workman)
                    torso = blob([(-78, -470), (-50, -484), (50, -484), (78, -470), (82, -400), (70, -300), (0, -290),
                                  (-70, -300), (-82, -400)], k=0.55)
                    paper(c, torso, L['shirt'], seed=seed + 61)
                    paper(c, blob([(-66, -462), (-30, -470), (0, -400), (30, -470), (66, -462), (70, -330), (60, -280),
                                   (0, -272), (-60, -280), (-70, -330)], k=0.5), vest, seed=seed + 63)
                    for k in range(4):
                        flat(c, circle(0, -380 + k * 24, 3.6), L.get('vest_dk', shade(vest, 0.8)))
                    paper(c, rect(-70, -306, 140, 16), shade(vest, 0.75), ol=2)
                # collar + bow tie
                paper(c, poly([(-30, -494), (0, -478), (30, -494), (26, -472), (0, -462), (-26, -472)]), L['shirt'],
                      ol=2, seed=seed + 66)
                bt = L['tie']
                paper(c, blob([(0, -472), (-24, -486), (-26, -460)], k=0.4), bt, ol=2, seed=seed + 67)
                paper(c, blob([(0, -472), (24, -486), (26, -460)], k=0.4), bt, ol=2, seed=seed + 68)
                paper(c, circle(0, -472, 7), shade(bt, 1.15), ol=1.5)
                # head
                with xf(c, 0, -488, P['head']):
                    with xf(c, 0, -100 + P.get('bob', 0.0)):
                        draw_head(c, L, expr, t, blink, talk, lx, ly, seed)
                # arms
                sl = coat if coat else L.get('sleeves', L['shirt'])
                sld = L.get('coat_dk', shade(sl, 0.85))
                cuff = L['shirt'] if coat else None
                with xf(c, -74, -456):
                    arm(c, L, -1, P['armL'][0], P['armL'][1], P['handL'], P['holdL'], sl, sld, cuff, 'man')
                with xf(c, 74, -456):
                    arm(c, L, 1, P['armR'][0], P['armR'][1], P['handR'], P['holdR'], sl, sld, cuff, 'man')


def body_woman(c, L, P, t, seed, expr, blink, talk, lx, ly, breath):
    d, dd, dl = L['dress'], L['dress_dk'], L.get('dress_lt', L['dress'])
    # shoes peeking
    for sd in (-1, 1):
        paper(c, oval(sd * 34, -10, 30, 14), 0x3A2A22, ol=2, seed=seed + 70 + sd)
    # skirt
    sway = math.sin(t * 1.3 + seed) * 3
    skirt = blob([(-50, -330), (50, -330), (88, -220), (128 + sway, -80), (150 + sway, -14), (0, -2), (-150 + sway, -14),
                  (-128 + sway, -80), (-88, -220)], k=0.6)
    paper(c, skirt, d, seed=seed + 71)
    for k in range(5):
        x0 = -80 + k * 40
        stroke(c, svg(f"M {x0 * 0.35} -300 Q {x0 * 0.8} -160 {x0 * 1.3 + sway} -16"), dd, 2.4, 0.5)
    paper(c, blob([(-150 + sway, -40), (150 + sway, -40), (152 + sway, -12), (0, 0), (-152 + sway, -12)], k=0.5),
          dd, ol=2, seed=seed + 72)
    with xf(c, 0, -330, P['lean']):
        with xf(c, 0, 0, 0, 1.0, 1.0 + breath):
            with xf(c, 0, 330):
                bod = blob([(-64, -456), (-30, -468), (30, -468), (64, -456), (66, -400), (52, -330), (0, -318),
                            (-52, -330), (-66, -400)], k=0.55)
                paper(c, bod, d, seed=seed + 73)
                # waist sash
                paper(c, blob([(-54, -346), (54, -346), (52, -322), (0, -314), (-52, -322)], k=0.4), dd, ol=2,
                      seed=seed + 74)
                # buttons + lace collar
                for k in range(4):
                    flat(c, circle(0, -440 + k * 22, 3.2), 0xF7F3EA, 0.9)
                paper(c, blob([(-36, -476), (0, -462), (36, -476), (30, -450), (0, -440), (-30, -450)], k=0.6),
                      L['collar'], ol=2, seed=seed + 75)
                flat(c, circle(0, -452, 6), 0xC9A043)
                with xf(c, 0, -474, P['head']):
                    with xf(c, 0, -96 + P.get('bob', 0.0), 0, 0.95):
                        draw_head(c, L, expr, t, blink, talk, lx, ly, seed)
                with xf(c, -60, -446):
                    arm(c, L, -1, P['armL'][0], P['armL'][1], P['handL'], P['holdL'], d, dd, L['collar'], 'woman',
                        s_len=100, f_len=92, w=38)
                with xf(c, 60, -446):
                    arm(c, L, 1, P['armR'][0], P['armR'][1], P['handR'], P['holdR'], d, dd, L['collar'], 'woman',
                        s_len=100, f_len=92, w=38)


def body_child(c, L, P, t, seed, expr, blink, talk, lx, ly, breath):
    girl = L['kind'] == 'girl'
    # legs
    for sd, ang in ((-1, P['legL']), (1, P['legR'])):
        with xf(c, sd * 20, -150, ang):
            col = 0xF3EEE4 if girl else L['trousers']
            paper(c, rrect(-15, -6, 30, 142, 10), col, seed=seed + 50 + sd)
            paper(c, oval(sd * 6, 136, 22, 12), L.get('shoes', 0x2A1D15), ol=2, seed=seed + 52 + sd)
    with xf(c, 0, -150, P['lean']):
        with xf(c, 0, 0, 0, 1.0, 1.0 + breath):
            with xf(c, 0, 150):
                if girl:
                    paper(c, blob([(-46, -290), (46, -290), (64, -200), (82, -120), (0, -112), (-82, -120), (-64, -200)],
                                  k=0.6), L['dress'], seed=seed + 61)
                    if L.get('pinafore'):
                        paper(c, blob([(-30, -270), (30, -270), (44, -190), (54, -128), (0, -122), (-54, -128),
                                       (-44, -190)], k=0.6), L['pinafore'], ol=2, seed=seed + 62)
                    paper(c, blob([(-30, -300), (0, -286), (30, -300), (24, -278), (0, -270), (-24, -278)]),
                          L['collar'], ol=2)
                else:
                    paper(c, blob([(-50, -292), (50, -292), (56, -200), (50, -140), (0, -134), (-50, -140), (-56, -200)],
                                  k=0.6), L['coat'], seed=seed + 61)
                    paper(c, poly([(-26, -298), (26, -298), (0, -230)]), L['shirt'], ol=2)
                    paper(c, blob([(0, -278), (-16, -288), (-16, -268)], k=0.4), L['tie'], ol=1.6)
                    paper(c, blob([(0, -278), (16, -288), (16, -268)], k=0.4), L['tie'], ol=1.6)
                    for k in range(3):
                        flat(c, circle(0, -240 + k * 26, 3), shade(L['coat'], 0.75))
                with xf(c, 0, -296, P['head']):
                    with xf(c, 0, -74 + P.get('bob', 0.0), 0, 0.78):
                        draw_head(c, L, expr, t, blink, talk, lx, ly, seed)
                sl = L['dress'] if girl else L['coat']
                for sd, key, hk, hold in ((-1, 'armL', 'handL', 'holdL'), (1, 'armR', 'handR', 'holdR')):
                    with xf(c, sd * 44, -280, 0, 0.62):
                        arm(c, L, sd, P[key][0], P[key][1], P[hk], P[hold], sl, shade(sl, 0.85), None, 'man',
                            s_len=96, f_len=88, w=46)


def draw_char(c, who, x, y, s=1.0, t=0.0, expr='smile', pose=None, lx=0.0, ly=0.0, talk=0.0, flip=False,
              shadow=(7, 12, 9, 0.32), breathe=True, blink=None, alpha=1.0):
    """draw a full puppet. (x,y) = feet position in current coords, s = scale."""
    L = LOOKS[who]
    P = dict(DEFAULT_POSE)
    if pose:
        P.update(pose)
    seed = L['seed']
    if blink is None:
        blink = blink_amount(t, seed * 7 + 1)
    br = 0.011 * math.sin(2 * math.pi * t / 3.4 + seed) if breathe else 0.0
    kind = L['kind']

    def draw():
        with xf(c, x, y, 0, s * (-1 if flip else 1), s):
            if kind == 'man':
                body_man(c, L, P, t, seed, expr, blink, talk, lx * (-1 if flip else 1), ly, br)
            elif kind == 'woman':
                body_woman(c, L, P, t, seed, expr, blink, talk, lx * (-1 if flip else 1), ly, br)
            else:
                body_child(c, L, P, t, seed, expr, blink, talk, lx * (-1 if flip else 1), ly, br)

    if alpha < 0.999:
        c.saveLayerAlpha(None, int(clamp(alpha) * 255))
    if shadow:
        with_shadow(c, draw, shadow[0] * s, shadow[1] * s, shadow[2] * s, shadow[3])
    else:
        draw()
    if alpha < 0.999:
        c.restore()


def draw_bust(c, who, x, y, s=1.0, t=0.0, expr='smile', lx=0.0, ly=0.0, talk=0.0, head=0.0, shadow=(6, 10, 9, 0.3),
              blink=None, shoulders=True, pose=None):
    """head + shoulders only (for close-ups / portraits). (x,y)=head centre"""
    L = LOOKS[who]
    seed = L['seed']
    if blink is None:
        blink = blink_amount(t, seed * 7 + 1)
    br = 0.01 * math.sin(2 * math.pi * t / 3.4 + seed)

    def draw():
        with xf(c, x, y, 0, s):
            if shoulders:
                with xf(c, 0, 100, 0, 1.0, 1.0 + br):
                    if L['kind'] == 'man':
                        coat = L.get('coat') or L.get('vest')
                        paper(c, blob([(-150, 260), (-140, 60), (-80, 8), (80, 8), (140, 60), (150, 260)], k=0.5),
                              coat, seed=seed + 81)
                        paper(c, poly([(-40, 0), (40, 0), (0, 120)]), L['shirt'], ol=2)
                        if L.get('vest') and L.get('coat'):
                            paper(c, poly([(-42, 30), (-16, 40), (0, 110), (16, 40), (42, 30), (40, 260), (-40, 260)]),
                                  L['vest'], ol=2.5)
                        paper(c, poly([(-42, 0), (-70, 20), (-46, 120), (-14, 46)]), L.get('coat_dk', coat), ol=2)
                        paper(c, poly([(42, 0), (70, 20), (46, 120), (14, 46)]), L.get('coat_dk', coat), ol=2)
                        paper(c, poly([(-34, -8), (0, 10), (34, -8), (30, 16), (0, 26), (-30, 16)]), L['shirt'], ol=2)
                        bt = L['tie']
                        paper(c, blob([(0, 18), (-26, 4), (-28, 32)], k=0.4), bt, ol=2)
                        paper(c, blob([(0, 18), (26, 4), (28, 32)], k=0.4), bt, ol=2)
                        paper(c, circle(0, 18, 7), shade(bt, 1.15), ol=1.5)
                    else:
                        d = L.get('dress', 0x8E9FD6)
                        dd = L.get('dress_dk', shade(d, 0.85))
                        dl = L.get('dress_lt', shade(d, 1.15))
                        for sd in (-1, 1):
                            paper(c, blob([(sd * 70, 30), (sd * 128, 40), (sd * 150, 110), (sd * 134, 280),
                                           (sd * 92, 280), (sd * 88, 120)], k=0.6), d, seed=seed + 85 + sd)
                            paper(c, circle(sd * 112, 72, 40), dl, ol=2.5, seed=seed + 87 + sd)
                            stroke(c, svg(f"M {sd * 96} 50 Q {sd * 112} 72 {sd * 98} 100"), dd, 2, 0.6)
                        paper(c, blob([(-96, 280), (-92, 80), (-62, 14), (62, 14), (92, 80), (96, 280)], k=0.5), d,
                              seed=seed + 81)
                        stroke(c, svg("M -60 280 Q -40 140 0 110 Q 40 140 60 280"), dd, 2.4, 0.55)
                        for k in range(4):
                            flat(c, circle(0, 60 + k * 26, 3.4), 0xF7F3EA, 0.9)
                        paper(c, blob([(-40, -4), (0, 14), (40, -4), (34, 26), (0, 38), (-34, 26)], k=0.6),
                              L.get('collar', 0xF7F3EA), ol=2)
                        flat(c, circle(0, 26, 6), 0xC9A043)
            with xf(c, 0, 0, head):
                draw_head(c, L, expr, t, blink, talk, lx, ly, seed)

    if shadow:
        with_shadow(c, draw, shadow[0] * s, shadow[1] * s, shadow[2] * s, shadow[3])
    else:
        draw()


def talk_amount(t, active=True, rate=7.5, seed=0):
    if not active:
        return 0.0
    v = 0.5 + 0.5 * math.sin(t * rate + seed) * (0.6 + 0.4 * noise1(t * 3.1, seed + 5))
    return clamp(v * 1.1 - 0.1)


def draw_back_head(c, who, x, y, s=1.0, t=0.0, shoulders=True):
    """back view (head from behind + shoulders) for over-the-shoulder shots. (x,y)=head centre"""
    L = LOOKS[who]
    seed = L['seed']

    def draw():
        with xf(c, x, y, 0, s):
            if shoulders:
                col = L.get('dress') or L.get('coat')
                paper(c, blob([(-160, 280), (-150, 80), (-80, 30), (80, 30), (150, 80), (160, 280)], k=0.5), col,
                      seed=seed + 81)
                paper(c, blob([(-34, 6), (34, 6), (30, 40), (-30, 40)], k=0.6), L.get('collar', L.get('shirt', 0xF7F3EA)),
                      ol=2)
            for sd in (-1, 1):
                paper(c, oval(sd * 86, 14, 15, 21), L['skin'], ol=2.5, seed=seed + 40 + sd)
            st = L['hair_style']
            if st in ('curly',):
                paper(c, union_circles(CURLY_BACK), L['hair'], seed=seed + 1)
                _curl_details(c, CURLY_BACK, L['hair_hl'], shade(L['hair'], 0.7), skip_first=False)
                paper(c, oval(0, 10, 70, 90), L['hair'], ol=0, seed=seed + 2)
            else:
                paper(c, blob([(0, -104), (66, -86), (96, -30), (94, 30), (70, 70), (0, 84), (-70, 70), (-94, 30),
                               (-96, -30), (-66, -86)], k=0.8), L['hair'], seed=seed + 2)
                for k in range(5):
                    xx = -60 + k * 30
                    stroke(c, svg(f"M {xx * 0.3} -96 Q {xx} -20 {xx * 0.8} 70"), L['hair_hl'], 2.4, 0.6)
                if st == 'bun':
                    paper(c, circle(0, -70, 44), L['hair'], seed=seed + 3)
                    stroke(c, svg("M -30 -80 Q 0 -100 30 -80"), L['hair_hl'], 2.6, 0.7)
                    if L.get('ribbon', True):
                        ribbon_bow(c, 0, -110, 0, 1.05, t=t)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)
