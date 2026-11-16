"""Scenes 1-7: hook, Boston, classroom, mother, Mabel, flashback, love, father."""
import math

import skia

from engine import (C, W, H, PAL, paper, flat, stroke, line, glow, xf, svg, blob, oval, circle, rrect, rect, poly,
                    clamp, lerp, seg, eio, eout, ein, eback, sm, smo, wave, noise1, hash01, shade, mix, font,
                    text_path, draw_text, _blur, with_shadow, grad_rect, layer, Cam, cam_move, alpha_layer, rivet,
                    torn_rect)
import chars as CH
import props as PR


# ---------------------------------------------------------------- shared sets
def room(c, cam, wallc=PAL['teal'], stripe=PAL['teal_dk'], floor_y=1380, floorc=PAL['wood'], par=0.85,
         wainscot=PAL['wood_lt'], damask=False, seed=0):
    with layer(c, cam, par):
        PR.wall(c, -400, -400, W + 800, floor_y + 400, wallc, stripe=stripe, seed=seed, damask=damask)
        if wainscot is not None:
            paper(c, rect(-400, floor_y - 300, W + 800, 300), wainscot, ol=0, seed=seed + 1)
            for k in range(-4, 16):
                stroke(c, rect(k * 160 + 20, floor_y - 270, 120, 220), shade(wainscot, 0.85), 3, 0.6)
            paper(c, rect(-400, floor_y - 312, W + 800, 18), shade(wainscot, 0.8), ol=2, seed=seed + 2)
        PR.floor_wood(c, -400, floor_y, W + 800, H - floor_y + 500, floorc, seed=seed + 3)


def light_rays(c, x, y, ang=25, alpha=0.18, n=4, length=1800, t=0.0):
    for k in range(n):
        a = math.radians(ang + k * 7)
        w0 = 40 + k * 25
        x2, y2 = x + math.sin(a) * length, y + math.cos(a) * length
        p = poly([(x - w0, y), (x + w0, y), (x2 + w0 * 3, y2), (x2 - w0 * 3, y2)])
        aa = alpha * (0.6 + 0.4 * math.sin(t * 0.7 + k))
        c.drawPath(p, skia.Paint(AntiAlias=True, Color=C(0xFFF0C8, aa), MaskFilter=_blur(28),
                                 BlendMode=skia.BlendMode.kScreen))


def walk_pose(t, speed=2.2, amp=14, arms=True):
    ph = math.sin(t * speed * math.pi)
    p = dict(legL=ph * amp, legR=-ph * amp, bob=-abs(math.cos(t * speed * math.pi)) * 6)
    if arms:
        p['armL'] = (10 - ph * 10, 14)
        p['armR'] = (10 + ph * 10, 14)
    return p


def mouth_diagram(c, x, y, kind, s=1.0):
    with xf(c, x, y, 0, s):
        lip = 0xF2EFE6
        if kind == 'A':
            CHALK(c, svg("M -60 0 C -40 -40 40 -40 60 0 C 40 60 -40 60 -60 0 Z"))
            CHALK(c, svg("M -40 4 C -20 30 20 30 40 4"), 3, 0.7)
        elif kind == 'O':
            CHALK(c, oval(0, 0, 38, 46))
            CHALK(c, oval(0, 0, 18, 24), 3, 0.7)
        else:
            CHALK(c, svg("M -70 0 C -40 -22 40 -22 70 0 C 40 18 -40 18 -70 0 Z"))
            CHALK(c, svg("M -50 0 L 50 0"), 3, 0.7)


def CHALK(c, p, w=4.5, a=0.92):
    stroke(c, p, 0xF2EFE6, w, a)


# ---------------------------------------------------------------- S1 hook
def table_topdown(c, t, seed=0):
    paper(c, rect(-400, -400, W + 800, H + 800), 0xA4703F, ol=0, seed=seed)
    for k in range(-3, 10):
        x = k * 170 + 40
        line(c, x, -400, x, H + 400, 0x7A4E28, 3, 0.55)
        for j in range(5):
            yy = -200 + j * 520 + (k * 97) % 300
            stroke(c, svg(f"M {x + 30} {yy} C {x + 70} {yy + 60} {x + 40} {yy + 130} {x + 90} {yy + 200}"),
                   0x8A5A30, 2.2, 0.35)
            flat(c, oval(x + 90 + (k * 37) % 50, yy + 260, 9, 5), 0x6E4422, 0.35)


def coffee_cup_top(c, x, y, s=1.0, t=0.0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, circle(0, 0, 130), 0xF3ECDC, seed=31)
            paper(c, rrect(70, -24, 80, 48, 22), 0xF6F1E6, seed=32)
            paper(c, circle(0, 0, 92), 0xFBF7EE, seed=33)
            flat(c, circle(0, 0, 74), 0x6B3E22)
            flat(c, oval(-18, -20, 30, 16), 0xA9714A, 0.6)
            p = svg("M 0 -40 C 20 -50 30 -30 16 -18 C 4 -8 -18 -14 -14 -30")
            stroke(c, p, 0xD9B48A, 3, 0.7)
    with_shadow(c, draw, 8 * s, 14 * s, 12 * s, 0.32)


def glasses_top(c, x, y, s=1.0, rot=0.0):
    def draw():
        with xf(c, x, y, rot, s):
            for sd in (-1, 1):
                stroke(c, circle(sd * 58, 0, 46), 0x2A1E16, 8)
                flat(c, circle(sd * 58, 0, 42), 0xDDEEF2, 0.25)
            stroke(c, svg("M -14 -6 Q 0 -18 14 -6"), 0x2A1E16, 7)
            line(c, -104, -6, -170, -40, 0x2A1E16, 7)
            line(c, 104, -6, 170, -40, 0x2A1E16, 7)
    with_shadow(c, draw, 5 * s, 9 * s, 7 * s, 0.3)


def notebook_top(c, x, y, s=1.0, rot=0.0):
    def draw():
        with xf(c, x, y, rot, s):
            paper(c, rect(-160, -210, 320, 420), PAL['brick'], seed=41)
            paper(c, rect(-146, -200, 300, 400), 0xF6EEDC, seed=42)
            for k in range(12):
                line(c, -126, -160 + k * 30, 136, -160 + k * 30, 0x9FC3CF, 2, 0.6)
            line(c, -100, -200, -100, 200, 0xE08A8A, 2, 0.6)
            paper(c, rrect(150, -180, 22, 300, 8), PAL['mustard'], ol=2, seed=43)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)


def leaves_top(c, x, y, s=1.0, rot=0.0):
    with xf(c, x, y, rot, s):
        for k in range(5):
            with xf(c, 0, 0, k * 34 - 60):
                paper(c, blob([(0, 0), (40, -60), (20, -170), (0, -200), (-20, -170), (-40, -60)], k=0.8),
                      [PAL['green'], PAL['green_dk']][k % 2], seed=50 + k, sh=(5, 9, 8, 0.3))
                line(c, 0, -10, 0, -180, shade(PAL['green_dk'], 0.8), 2.5, 0.6)


def s01a_phone(c, x):
    t, T = x.t, x.T
    th = x.w(5)  # "HELLO"
    cam = cam_move(t, T, 1.0, 1.1, 540, 960, 540, 930, rot0=-1.5, rot1=0.5)
    with layer(c, cam, 0.92):
        table_topdown(c, t)
    with layer(c, cam, 1.0):
        notebook_top(c, 210, 300, 1.0, -12)
        coffee_cup_top(c, 880, 330, 1.05, t)
        glasses_top(c, 860, 1560, 0.9, 18)
        leaves_top(c, 120, 1750, 1.1, 30)
        ring = 1.0 - sm(t, th - 0.12, th + 0.05)
        PR.smartphone(c, 540, 960, 1.18, t, ring=ring, screen='call' if t < th else 'talk', rot=-6,
                      glow_a=0.12 * (1 - ring))
        if t >= th - 0.05:
            PR.sound_rings(c, 520, 600, t - th + 0.3, n=4, period=1.0, rmax=520, width=11, alpha=sm(t, th - 0.05, th + 0.2))
        if t < th:
            # vibration buzz marks
            for sd in (-1, 1):
                for k in range(3):
                    a = 0.5 + 0.5 * math.sin(t * 30 + k)
                    xx = 540 + sd * (215 + k * 22)
                    stroke(c, svg(f"M {xx} 820 Q {xx + sd * 14} 880 {xx} 940"), 0xF6EEDC, 5, a * ring)
    glow(c, 140, 120, 900, 0xFFE2A8, 0.22)
    PR.dust_motes(c, 0, 0, W, 1100, t, n=18, seed=3, alpha=0.45)


def s01b_heart(c, x):
    t, T = x.t, x.T
    tp = x.w(9)  # "PYAAR"
    cam = cam_move(t, T, 1.28, 1.5, 540, 780, 540, 720)
    with layer(c, cam, 0.92):
        table_topdown(c, t + 3)
    with layer(c, cam, 1.0):
        coffee_cup_top(c, 880, 330, 1.05, t)
        PR.smartphone(c, 540, 960, 1.18, t + 3, ring=0, screen='talk', rot=-6, glow_a=0.15)
        PR.sound_rings(c, 520, 600, t + 1.5, n=4, period=1.0, rmax=420, width=10,
                       alpha=1 - sm(t, tp - 0.1, tp + 0.4) * 0.7)
        u = seg(t, tp - 0.05, tp + 0.45)
        if u > 0:
            beat = 1 + 0.06 * max(0, math.sin((t - tp) * 7.5)) * seg(t, tp + 0.4, tp + 0.6)
            PR.heart(c, 540, 470 - 30 * eout(u), 2.4 * eback(u) * beat, col=0xE0606E, seed=3)
            glow(c, 540, 470, 380 * eout(u), 0xFF9AA2, 0.3 * eout(u))
        PR.floating_hearts(c, 540, 560, t, tp + 0.1, n=6, spread=420, seed=4, rise=420)


def s01c_silhouette(c, x):
    t, T = x.t, x.T
    ts = x.w(15)  # "SUN"
    cam = cam_move(t, T, 1.0, 1.08, 540, 880, 540, 860)
    with layer(c, cam, 0.7):
        grad_rect(c, -300, -300, W + 600, H + 600, 0x1F3550, 0x13202F)
        for k in range(26):
            px = (hash01(k, 1) * W)
            py = (hash01(k, 2) * H)
            flat(c, circle(px, py, 2 + 2 * hash01(k, 3)), 0xF6EEDC, 0.12 + 0.1 * math.sin(t + k))
    with layer(c, cam, 1.0):
        def inner(c2, cx, cy, w, h):
            grad_rect(c2, cx - w / 2, cy - h / 2, w, h, 0xF4EAD2, 0xE6D3AE)
            a = sm(t, 0.15, 0.9)
            PR.silhouette_profile(c2, cx - 10, cy + 150 + 40 * (1 - eout(a)), 1.25, alpha=a)
        PR.frame_portrait(c, 540, 820, 560, 720, inner, oval_shape=True, col=0xB8913E, seed=5, pin=False)
        # sound rings around her head: present, then shrink & vanish into silence
        fade = 1 - sm(t, ts - 0.2, ts + 1.1)
        if fade > 0.01:
            PR.sound_rings(c, 610, 680, t, n=4, period=0.9, rmax=300, width=8, alpha=0.85 * fade, shrink=1.0)
        # musical notes drifting toward her, turning grey and falling
        for k in range(5):
            st = 0.1 + k * 0.28
            u = clamp((t - st) / 1.8)
            if u <= 0 or u >= 1:
                continue
            nx = 1000 - u * 330 + math.sin(u * 7 + k) * 20
            ny = 380 + k * 90 + (seg(u, 0.55, 1.0) ** 2) * 260
            col = mix(PAL['mustard'], 0x8A8F98, seg(u, 0.45, 0.8))
            with xf(c, nx, ny, -12 + 40 * seg(u, 0.55, 1.0)):
                with alpha_layer(c, 1 - seg(u, 0.75, 1.0)):
                    paper(c, oval(0, 0, 18, 13), col, ol=2.5, tex=False)
                    paper(c, rect(12, -70, 7, 70), col, ol=2, tex=False)
                    paper(c, svg("M 18 -70 Q 44 -60 40 -34 Q 34 -50 18 -52 Z"), col, ol=2, tex=False)


# ---------------------------------------------------------------- S2 Boston + classroom
def s02a_boston(c, x):
    t, T = x.t, x.T
    tt = x.w(23)  # TEACHER
    cam = cam_move(t, T, 1.06, 1.0, 620, 980, 470, 960)
    with layer(c, cam, 0.25):
        grad_rect(c, -600, -600, W + 1200, 1700, 0x7FB2C2, 0xCFE3DD)
        PR.sun(c, 860, 300, 70, t)
    with layer(c, cam, 0.35):
        for k in range(4):
            PR.cloud(c, ((k * 380 + t * 18) % 1700) - 300, 200 + 120 * (k % 2), 0.8 + 0.2 * (k % 3), seed=k)
    with layer(c, cam, 0.6):
        cols = [0xC9A27A, 0x9DB0A8, 0xB98E7A, 0xD2B48C, 0x8FA7A3]
        for k in range(8):
            PR.brick_house(c, -300 + k * 210, 1180, 200, 560 + 80 * (k % 3), col=shade(cols[k % 5], 0.95),
                           roof=0x5A4A4A, seed=20 + k, t=t, smoke=(k % 3 == 0))
    with layer(c, cam, 0.85):
        PR.brick_house(c, -120, 1380, 330, 860, col=PAL['brick'], seed=41, t=t)
        PR.brick_house(c, 230, 1380, 300, 760, col=0xD9A86A, roof=0x4A3A3A, seed=42, t=t, smoke=False)
        PR.brick_house(c, 550, 1380, 320, 900, col=0x5E8F8C, roof=0x3A3434, seed=43, t=t)
        PR.brick_house(c, 890, 1380, 320, 800, col=0xB4513A, roof=0x4A3A3A, seed=44, t=t, smoke=False)
        PR.bunting(c, -100, 640, 560, 600, sag=90, n=11, t=t, seed=1)
        PR.bunting(c, 560, 600, 1200, 660, sag=80, n=11, t=t, seed=4)
    with layer(c, cam, 1.0):
        paper(c, rect(-400, 1380, W + 800, 90), 0xC9BCA6, ol=0, seed=60)
        paper(c, rect(-400, 1460, W + 800, 700), 0x8C8378, ol=0, seed=61)
        for j in range(8):
            for i in range(-4, 16):
                xx = i * 90 + (45 if j % 2 else 0)
                flat(c, rrect(xx, 1480 + j * 60, 80, 48, 16), shade(0x8C8378, 1.08 if (i + j) % 3 else 0.92), 0.6)
        PR.lamp_post(c, 140, 1460, 1.0, seed=70)
        PR.lamp_post(c, 940, 1460, 1.0, seed=71)
        # passers-by in the distance
        CH.draw_char(c, 'father', 760 - t * 30, 1430, 0.42, t=t, expr='smile', pose=walk_pose(t + 0.5))
        CH.draw_char(c, 'kid3', 830 - t * 30, 1430, 0.42, t=t, expr='joy', pose=walk_pose(t + 0.3))
        # Bell walks in
        u = sm(t, 0.0, max(0.6, tt + 0.5))
        bx = lerp(-160, 470, u)
        walking = u < 0.999
        pose = walk_pose(t) if walking else {}
        pose = dict(pose)
        pose['armR'] = (14, 70)
        pose['holdR'] = lambda cc: (paper(cc, rect(-36, -10, 72, 26), PAL['brick'], ol=2),
                                    paper(cc, rect(-32, -34, 64, 24), PAL['navy_lt'], ol=2))
        expr = 'smile' if t < tt else 'joy'
        CH.draw_char(c, 'bell', bx, 1560, 0.98, t=t, expr=expr, pose=pose, lx=0.25 if walking else 0.0)
    PR.tag(c, 300, 360, 'BOSTON', rot=-5, s=1.45, t=t, appear=seg(t, 0.15, 0.55), seed=3)


def classroom_wall_items(c, t, portrait_cb=None):
    PR.chalkboard(c, 60, 230, 640, 440, seed=80, content=lambda cc, x0, y0, w, h: (
        mouth_diagram(cc, x0 + 120, y0 + 150, 'A'), mouth_diagram(cc, x0 + 320, y0 + 150, 'O'),
        mouth_diagram(cc, x0 + 520, y0 + 150, 'E'),
        CHALK(cc, text_path('A', font('Rye-Regular.ttf', 60), x0 + 120, y0 + 330, align='center')),
        CHALK(cc, text_path('O', font('Rye-Regular.ttf', 60), x0 + 320, y0 + 330, align='center')),
        CHALK(cc, text_path('EE', font('Rye-Regular.ttf', 60), x0 + 520, y0 + 330, align='center')),
        CHALK(cc, svg(f"M {x0 + 190} {y0 + 150} L {x0 + 245} {y0 + 150} M {x0 + 232} {y0 + 140} L {x0 + 247} {y0 + 150} L {x0 + 232} {y0 + 160}"), 4, 0.8),
        CHALK(cc, svg(f"M {x0 + 390} {y0 + 150} L {x0 + 440} {y0 + 150} M {x0 + 427} {y0 + 140} L {x0 + 442} {y0 + 150} L {x0 + 427} {y0 + 160}"), 4, 0.8),
    ))
    PR.frame_portrait(c, 880, 470, 220, 280, portrait_cb or mother_portrait_inner, oval_shape=True, seed=81)
    PR.grandfather_clock(c, 900, 1300, 0.9, t, seed=82)


def mother_portrait_inner(c, cx, cy, w, h, t=0.0, trumpet=True):
    grad_rect(c, cx - w / 2, cy - h / 2, w, h, 0xE9D8B4, 0xC9B48E)
    s = w / 300
    CH.draw_bust(c, 'mother', cx + 10 * s, cy + 10 * s, 0.95 * s, t=t, expr='calm', lx=0.15, shadow=None)
    if trumpet:
        with xf(c, cx - 80 * s, cy + 14 * s, -20, s * 1.25):
            paper(c, svg("M 0 -9 C -40 -14 -70 -30 -96 -64 C -112 -50 -118 30 -100 58 C -72 28 -40 14 0 9 Z"),
                  0xD1A946, ol=2.5, seed=7)
            flat(c, oval(-104, -3, 11, 58), 0x8A6A20)
            stroke(c, svg("M -20 -11 C -50 -20 -70 -36 -88 -58"), 0xF6E6A8, 3, 0.8)
            paper(c, oval(-6, 0, 12, 10), 0xB88E34, ol=2)
            paper(c, oval(-62, 30, 22, 17), CH.LOOKS['mother']['skin'], ol=2)


def s02b_class(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.07, 540, 940, 600, 880)
    room(c, cam, floor_y=1390, seed=10)
    with layer(c, cam, 0.88):
        classroom_wall_items(c, t, portrait_cb=lambda cc, a, b, w, h: mother_portrait_inner(cc, a, b, w, h, t))
    with layer(c, cam, 1.0):
        talk = CH.talk_amount(t, True, 8.0)
        pose = dict(armL=(140 + 6 * math.sin(t * 2.4), -15), handL='point', armR=(16, 30))
        CH.draw_char(c, 'bell', 300, 1420, 0.92, t=t, expr='smile', pose=pose, lx=0.35, talk=talk)
    with layer(c, cam, 1.18):
        # deaf children in the foreground, watching and copying the mouth shapes
        kt = [0.0, 0.4, 0.8]
        for i, (who, kx) in enumerate((('kid2', 230), ('kid1', 560), ('kid4', 880))):
            copying = 0.5 + 0.5 * math.sin(t * 3 + i)
            ex = 'smile' if copying < 0.6 else 'joy'
            CH.draw_char(c, who, kx, 2060, 1.25, t=t + kt[i], expr=ex, lx=-0.45, ly=-0.5,
                         talk=0.6 * copying, pose=dict(armL=(25, 95), armR=(25, 95)))
            PR.school_desk(c, kx, 2010, 1.3, seed=90 + i)
    light_rays(c, 1100, -100, 30, 0.12, t=t)
    PR.dust_motes(c, 500, 0, 600, 1300, t, n=16, seed=8, alpha=0.4)


# ---------------------------------------------------------------- S3 mother portrait
def s03_mother(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.13, 540, 900, 540, 860)
    with layer(c, cam, 0.8):
        PR.wall(c, -400, -400, W + 800, H + 800, PAL['teal'], stripe=PAL['teal_dk'], seed=12)
    with layer(c, cam, 1.0):
        PR.frame_portrait(c, 540, 820, 600, 760, lambda cc, a, b, w, h: mother_portrait_inner(cc, a, b, w, h, t),
                          oval_shape=True, seed=13)
        # sound rings that never reach the trumpet
        for k in range(3):
            ph = ((t * 0.7) + k / 3) % 1.0
            r = 520 - ph * 300
            a = 0.8 * (1 - ph) * clamp(ph * 4) * (1 - seg(ph, 0.6, 0.85))
            if a > 0.01:
                p = skia.Path()
                p.addArc(skia.Rect.MakeLTRB(150 - r, 900 - r, 150 + r, 900 + r), -60, 120)
                stroke(c, p, 0xFFFFFF, 12, a * 0.7)
                stroke(c, p, 0xF6EEDC, 8, a)
    glow(c, 540, 700, 700, 0xFFE2A8, 0.14)


# ---------------------------------------------------------------- S4 Mabel arrives
def s04a_door(c, x):
    t, T = x.t, x.T
    ts = x.w(46)  # STUDENT
    cam = cam_move(t, T, 1.0, 1.05, 540, 960, 600, 930)
    room(c, cam, floor_y=1390, seed=10)
    op = sm(t, 0.05, 0.85)
    with layer(c, cam, 0.88):
        PR.frame_portrait(c, 300, 420, 200, 250, lambda cc, a, b, w, h: mother_portrait_inner(cc, a, b, w, h, t),
                          oval_shape=True, seed=81)
        PR.door(c, 680, 560, 270, 810, open_amt=op, seed=85, inside=0xF6DFA4)
        glow(c, 815, 1000, 520 * op, 0xFFE0A0, 0.45 * op)
    with layer(c, cam, 1.0):
        u = sm(t, 0.45, ts - 0.1 + 0.8)
        mx = lerp(815, 650, u)
        bob = -abs(math.sin(t * 2.6 * math.pi)) * 5 * (1 if 0 < u < 1 else 0)
        CH.draw_char(c, 'mabel', mx, 1500 + bob, 0.95, t=t, expr='smile', lx=-0.5 if u > 0.2 else -0.2,
                     alpha=sm(t, 0.35, 0.6), pose=dict(armL=(12, 40), armR=(12, 40)))
        bexpr = 'smile' if t < 1.0 else ('love' if t > ts + 0.6 else 'shock_happy')
        CH.draw_char(c, 'bell', 280, 1500, 0.95, t=t, expr=bexpr, lx=0.6, pose=dict(armL=(10, 20), armR=(14, 60)))
    light_rays(c, 815, 560, -8, 0.16 * op, n=3, t=t)
    PR.dust_motes(c, 650, 560, 330, 800, t, n=14, seed=9, alpha=0.5 * op)


def s04b_mabel(c, x):
    t, T = x.t, x.T
    tm = x.w(50)  # MABEL
    cam = cam_move(t, T, 1.0, 1.07, 540, 900, 540, 860)
    with layer(c, cam, 0.7):
        PR.wall(c, -400, -400, W + 800, H + 800, PAL['teal'], stripe=PAL['teal_dk'], seed=14)
        PR.window(c, 640, 180, 300, 420, t, sky='day', curtains=PAL['brick'], seed=15)
    glow(c, 820, 360, 600, 0xFFF0C8, 0.25)
    with layer(c, cam, 1.0):
        CH.draw_bust(c, 'mabel', 540, 860, 2.05, t=t, expr='smile' if t < tm else 'love', lx=-0.15,
                     head=-4 + 2 * math.sin(t * 1.2))
    PR.tag(c, 300, 380, 'MABEL', rot=-6, s=1.15, t=t, appear=seg(t, tm - 0.05, tm + 0.35), seed=7)
    PR.dust_motes(c, 400, 100, 680, 900, t, n=14, seed=10, alpha=0.4)


# ---------------------------------------------------------------- S5 flashback (sepia)
def old_photo_border(c, t, seed=0):
    p = skia.Path()
    p.setFillType(skia.PathFillType.kEvenOdd)
    p.addRect(skia.Rect.MakeXYWH(-50, -50, W + 100, H + 100))
    inner = torn_rect(46, 70, W - 92, H - 150, seed=seed, rough=7, step=10)
    p.addPath(inner)
    paper(c, p, 0xEFE3C6, ol=0, seed=seed + 1, sh=None)
    c.save()
    c.clipPath(inner, skia.ClipOp.kIntersect, True)
    stroke(c, inner, 0x5A4630, 30, 0.12)
    c.restore()
    for (cx, cy, r) in ((46, 70, 0), (W - 46, 70, 90), (W - 46, H - 80, 180), (46, H - 80, 270)):
        with xf(c, cx, cy, r):
            paper(c, poly([(-10, -10), (90, -10), (-10, 90)]), 0x3A2E24, ol=2, seed=seed + 5)


def s05a_flash_happy(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.06, 540, 960, 520, 940)
    with layer(c, cam, 0.3):
        grad_rect(c, -400, -400, W + 800, 1700, 0x9CC8D6, 0xE9E2C8)
        PR.sun(c, 820, 330, 64, t)
        PR.cloud(c, 260 + t * 15, 300, 0.8, seed=2)
    with layer(c, cam, 0.6):
        paper(c, blob([(-400, 1150), (100, 1000), (500, 1080), (900, 960), (1500, 1100), (1500, 1800), (-400, 1800)],
                      k=0.7), PAL['green'], ol=3, seed=21)
    with layer(c, cam, 0.85):
        paper(c, blob([(-400, 1300), (300, 1220), (800, 1290), (1500, 1220), (1500, 2100), (-400, 2100)], k=0.7),
              PAL['green_dk'], ol=3, seed=22)
        # tree with singing bird
        paper(c, rect(800, 700, 50, 620), PAL['wood_dk'], seed=23, sh=(6, 10, 9, 0.3))
        for (bx, by, br) in ((825, 640, 170), (700, 720, 120), (950, 720, 120), (825, 520, 120)):
            paper(c, circle(bx, by, br), PAL['green'], seed=24 + bx % 7, sh=(5, 9, 9, 0.25))
        hop = abs(math.sin(t * 6)) * 6
        with xf(c, 700, 820 - hop):
            paper(c, oval(0, 0, 34, 24), 0xD9A23C, ol=2.5, seed=27)
            paper(c, circle(26, -16, 16), 0xD9A23C, ol=2.5, seed=28)
            paper(c, poly([(40, -18), (56, -12), (40, -8)]), 0xC0392B, ol=1.5)
            flat(c, circle(30, -20, 3.5), 0x1E1A1C)
            paper(c, poly([(-30, -4), (-62, -18), (-56, 10)]), 0xB98426, ol=2)
        PR.sound_rings(c, 650, 800, t, n=3, period=0.9, rmax=320, width=7, arc=(140, 90), alpha=0.9)
        for k in range(4):
            u = ((t * 0.5) + k / 4) % 1.0
            nx = 640 - u * 260
            ny = 760 - u * 160 + math.sin(u * 9 + k) * 20
            with xf(c, nx, ny, -10):
                with alpha_layer(c, (1 - u) * clamp(u * 5)):
                    paper(c, oval(0, 0, 14, 10), 0x2A2420, ol=2, tex=False)
                    paper(c, rect(9, -52, 5, 52), 0x2A2420, ol=1.5, tex=False)
        for k in range(10):
            fx = 80 + k * 95
            PR.flower_pot  # (keep api referenced)
            paper(c, circle(fx, 1330 + (k % 3) * 30, 14), [0xF2C14E, 0xE0606E, 0xF6EEDC][k % 3], ol=2, seed=k)
    with layer(c, cam, 1.0):
        CH.draw_char(c, 'mabel_child', 360, 1560, 1.25, t=t, expr='joy', lx=0.6, ly=-0.2,
                     pose=dict(armL=(30, 100), armR=(30, 100), head=6))
    old_photo_border(c, t, seed=4)


def s05b_flash_sick(c, x):
    t, T = x.t, x.T
    tch = x.w(64)  # CHHEEN
    tb = x.w(58)   # BEEMARI
    cam = cam_move(t, T, 1.0, 1.08, 540, 980, 540, 940)
    room(c, cam, wallc=0x7E8C7E, stripe=0x6E7C6E, floor_y=1450, seed=30, wainscot=0x9A8A6E)
    with layer(c, cam, 0.88):
        PR.window(c, 640, 300, 280, 380, t, sky='night', curtains=0x6E5A7E, moon_pos=(760, 380), seed=31)
    with layer(c, cam, 1.0):
        PR.bed(c, 470, 1460, 1.15, seed=33)
        # sitting up in bed, poorly
        CH.draw_char(c, 'mabel_child', 420, 1290, 1.25, t=t, expr='sick', lx=0.1,
                     pose=dict(armL=(20, 60), armR=(20, 60), head=-6 + 2 * math.sin(t)), shadow=None)
        PR.blanket(c, 470, 1460, 1.15, col=0xC9B26E, seed=34, t=t)
        # cold compress on forehead
        with xf(c, 420, 1290 - 1.25 * 370 - 40, -4):
            paper(c, rrect(-60, -16, 120, 32, 8), 0xF4F2EC, ol=2, seed=35)
        # nightstand + candle
        PR.table_top(c, 840, 1240, 200, 30, seed=36, leg_h=220)
        PR.candle(c, 900, 1240, 0.9, t, lit=1.0, seed=37, glow_a=0.4)
        paper(c, rrect(960, 1170, 40, 70, 8), 0x7FB3B0, ol=2, seed=38)
        # hearing rings shrinking & vanishing
        hx, hy = 420, 1290 - 1.25 * 370
        fade = 1 - sm(t, tch - 0.25, tch + 0.6)
        grey = sm(t, tb, tch)
        if fade > 0.01:
            for k in range(4):
                ph = ((t * 0.8) + k / 4) % 1.0
                r = 40 + (1 - ph) * 240 * fade
                a = fade * (1 - ph * 0.6)
                col = mix(0xF6EEDC, 0x9AA0A0, grey)
                stroke(c, circle(hx, hy, r), 0xFFFFFF, 10, a * 0.6)
                stroke(c, circle(hx, hy, r), col, 6, a)
    old_photo_border(c, t, seed=6)


# ---------------------------------------------------------------- S6 lips / eyes / love
def s06a_lips(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.06, 540, 880, 560, 840)
    with layer(c, cam, 0.7):
        PR.wall(c, -400, -400, W + 800, H + 800, PAL['teal'], stripe=PAL['teal_dk'], seed=16)
        PR.window(c, 60, 240, 260, 380, t, sky='day', curtains=PAL['brick'], seed=17)
    glow(c, 190, 420, 600, 0xFFF0C8, 0.22)
    with layer(c, cam, 1.0):
        talk = CH.talk_amount(t, True, 8.5, seed=2)
        CH.draw_bust(c, 'bell', 600, 760, 2.0, t=t, expr='smile', lx=-0.25, talk=talk)
        # focus ring on his lips
        mx, my = 600 - 0.25 * 15 * 2.0, 760 + 64 * 2.0 + 8
        pulse = 1 + 0.05 * math.sin(t * 4)
        a = sm(t, 0.2, 0.6)
        for k in range(16):
            ang = k / 16 * 2 * math.pi + t * 0.6
            px, py = mx + math.cos(ang) * 92 * pulse, my + math.sin(ang) * 62 * pulse
            flat(c, circle(px, py, 6), 0xF6EEDC, a)
        glow(c, mx, my, 160, 0xFFF4C8, 0.25 * a)
    with layer(c, cam, 1.25):
        CH.draw_back_head(c, 'mabel', 200, 1530, 2.3, t=t)


def s06b_eyes(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.08, 540, 860, 540, 840)
    with layer(c, cam, 0.7):
        grad_rect(c, -300, -300, W + 600, H + 600, 0x3E7C86, 0x2D5E68)
    glow(c, 300, 400, 800, 0xFFE2A8, 0.18)
    with layer(c, cam, 1.0):
        lxv = -0.55 + 0.1 * math.sin(t * 0.8)
        ex = 'smile' if t < T * 0.45 else 'love'
        CH.draw_bust(c, 'bell', 560, 770, 3.5, t=t, expr=ex, lx=lxv, ly=-0.1)
    # her reflection of warmth: tiny floating heart sparkle near his eye
    a = sm(t, T * 0.5, T * 0.8)
    if a > 0:
        PR.heart(c, 250, 560, 0.5 * a, col=0xE0606E, alpha=a, seed=8)


def s06c_love(c, x):
    t, T = x.t, x.T
    tp = x.w(82)  # PYAAR (HO GAYA)
    cam = cam_move(t, T, 1.0, 1.07, 540, 960, 540, 920)
    room(c, cam, floor_y=1430, seed=18)
    with layer(c, cam, 0.88):
        PR.window(c, 330, 230, 420, 560, t, sky='dawn', curtains=PAL['brick'], seed=19)
        PR.bookshelf(c, -60, 560, 260, 760, seed=20)
        PR.flower_pot(c, 880, 1110, 1.0, seed=21)
        PR.table_top(c, 780, 1110, 260, 26, seed=22, leg_h=300)
    light_rays(c, 540, 240, 8, 0.2, n=4, t=t)
    with layer(c, cam, 1.0):
        lv = t > tp - 0.3
        CH.draw_char(c, 'bell', 360, 1540, 1.0, t=t, expr='love' if lv else 'smile', lx=0.55,
                     pose=dict(armR=(22, 40 + 10 * sm(t, tp - 0.3, tp + 0.4)), armL=(10, 16), lean=2))
        CH.draw_char(c, 'mabel', 700, 1540, 1.0, t=t, expr='love' if lv else 'smile', lx=-0.55,
                     pose=dict(armL=(22, 40), armR=(12, 50), lean=-2))
        PR.floating_hearts(c, 530, 820, t, tp - 0.05, n=9, spread=300, seed=5, rise=560)
    PR.dust_motes(c, 300, 200, 500, 1200, t, n=24, seed=11, alpha=0.55)


# ---------------------------------------------------------------- S7 father
def study_bg(c, cam, t, seed=0):
    room(c, cam, wallc=0x5E3A3A, stripe=0x4E3030, floor_y=1420, wainscot=PAL['wood_dk'], seed=seed, damask=False)
    with layer(c, cam, 0.85):
        PR.bookshelf(c, -40, 300, 330, 1000, seed=seed + 5)
        PR.bookshelf(c, 790, 300, 330, 1000, seed=seed + 6)
        PR.frame_portrait(c, 540, 420, 220, 160, lambda cc, a, b, w, h: (
            grad_rect(cc, a - w / 2, b - h / 2, w, h, 0x9CC8D6, 0x6E9B5A),
            paper(cc, blob([(a - w / 2, b + 30), (a - 40, b - 30), (a + 30, b + 10), (a + w / 2, b - 20),
                            (a + w / 2, b + h / 2), (a - w / 2, b + h / 2)]), PAL['green_dk'], ol=0)),
            oval_shape=False, seed=seed + 7)


def desk_front(c, x, y, w, h, seed=0):
    def draw():
        paper(c, rect(x, y, w, h), PAL['wood_dk'], seed=seed)
        paper(c, rect(x - 20, y - 26, w + 40, 30), PAL['wood'], seed=seed + 1)
        for k in range(2):
            stroke(c, rect(x + 30 + k * (w / 2), y + 40, w / 2 - 60, h - 80), shade(PAL['wood_dk'], 0.8), 3, 0.7)
            flat(c, circle(x + k * (w / 2) + w / 4, y + h / 2, 8), 0xC9A043)
    with_shadow(c, draw, 7, 12, 10, 0.32)


def globe(c, x, y, s=1.0, t=0.0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rect(-8, -40, 16, 40), PAL['wood_dk'], ol=2)
            paper(c, oval(0, 0, 50, 10), PAL['wood_dk'], ol=2)
            stroke(c, svg("M -70 -120 A 0 0 0 0 0 -70 -120"), 0, 1) if False else None
            paper(c, circle(0, -120, 70), 0x6FA3B8, seed=7)
            c.save()
            c.clipPath(circle(0, -120, 70), skia.ClipOp.kIntersect, True)
            off = (t * 30) % 140
            for k in range(-1, 3):
                paper(c, blob([(-40 + k * 140 - off, -160), (10 + k * 140 - off, -150), (20 + k * 140 - off, -100),
                               (-20 + k * 140 - off, -80), (-50 + k * 140 - off, -110)]), 0xD9C27A, ol=1.5)
            c.restore()
            stroke(c, svg("M -86 -120 Q -80 -40 0 -36"), 0xC9A043, 5)
    with_shadow(c, draw, 5 * s, 9 * s, 8 * s, 0.3)


def s07a_father(c, x):
    t, T = x.t, x.T
    tk = x.w(90)  # SAAF
    cam = cam_move(t, T, 1.0, 1.08, 540, 960, 540, 900)
    study_bg(c, cam, t, seed=40)
    with layer(c, cam, 1.0):
        talking = t > tk - 0.1
        point = sm(t, 0.1, 0.5)
        pose = dict(armR=(lerp(14, 152, point) + 4 * math.sin(t * 5) * point, lerp(20, -12, point)),
                    handR='point' if point > 0.5 else 'open', armL=(12, 60))
        CH.draw_char(c, 'father', 540, 1900, 1.32, t=t, expr='stern', pose=pose, talk=CH.talk_amount(t, talking, 7.5))
    with layer(c, cam, 1.12):
        desk_front(c, 120, 1420, 840, 520, seed=44)
        globe(c, 230, 1400, 0.9, t)
        PR.paper_sheet(c, 640, 1370, 0.6, rot=8, seed=45)
        PR.candle(c, 860, 1398, 0.7, t, lit=1.0, seed=46, glow_a=0.3)


def s07b_nervous(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.02, 1.0, 560, 940, 520, 960)
    study_bg(c, cam, t, seed=40)
    with layer(c, cam, 1.0):
        CH.draw_char(c, 'father', 780, 1560, 1.0, t=t, expr='stern',
                     pose=dict(armL=(82 + 3 * math.sin(t * 6), -10), handL='point', armR=(12, 70)), lx=-0.5,
                     talk=CH.talk_amount(t, True, 7.0, seed=3))
        CH.draw_char(c, 'bell', 290, 1560, 1.0, t=t, expr='nervous', lx=0.45,
                     pose=dict(armR=(150, 128 + 6 * math.sin(t * 7)), armL=(10, 20), lean=-3 + math.sin(t * 3)))
