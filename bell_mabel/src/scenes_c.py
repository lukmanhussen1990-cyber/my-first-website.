"""Scenes 13-17: the bell she never heard, the silence, Mabel gone, the reveal, the ending."""
import math

import skia

from engine import (C, W, H, PAL, paper, flat, stroke, line, glow, xf, svg, blob, oval, circle, rrect, rect, poly,
                    clamp, lerp, seg, eio, eout, ein, eback, sm, smo, wave, noise1, hash01, shade, mix, font,
                    text_path, draw_text, _blur, with_shadow, grad_rect, layer, Cam, cam_move, alpha_layer, rivet,
                    torn_rect, grade_filter, GRADES)
import chars as CH
import props as PR
from scenes_a import room, light_rays, walk_pose
from scenes_b import star


# ---------------------------------------------------------------- S13 the bell she never heard
def cozy_house(c, x, y, s, t, lit=1.0, mabel=True):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rect(-260, -420, 520, 420), 0xEDE3CC, seed=700)
            for k in range(14):
                line(c, -260, -400 + k * 30, 260, -400 + k * 30, 0xD9CDB2, 2, 0.6)
            paper(c, poly([(-300, -410), (300, -410), (0, -640)]), 0x4A4A5A, seed=701)
            paper(c, rect(140, -640, 50, 140), PAL['brick'], seed=702)
            paper(c, rrect(-70, -150, 110, 150, 40), PAL['navy'], seed=703)
            paper(c, rect(70, -330, 150, 170), 0xF6D27A, seed=704)
            line(c, 145, -330, 145, -160, 0xF6EEDC, 6)
            line(c, 70, -245, 220, -245, 0xF6EEDC, 6)
            paper(c, rect(-220, -330, 120, 140), 0xF6D27A if lit > 0.5 else 0x9CC8D6, seed=705)
            line(c, -160, -330, -160, -190, 0xF6EEDC, 6)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)
    glow(c, x + 145 * s, y - 245 * s, 260 * s, 0xFFD27A, 0.45 * lit)
    if mabel:
        c.save()
        c.clipRect(skia.Rect.MakeXYWH(x + 70 * s, y - 330 * s, 150 * s, 170 * s), skia.ClipOp.kIntersect, True)
        CH.draw_bust(c, 'mabel', x + 150 * s, y - 230 * s, 0.42 * s, t=t, expr='calm', lx=-0.3, shadow=None)
        c.restore()
    PR.smoke_wisps(c, x + 165 * s, y - 650 * s, t, 0.8, seed=7)


def s13a_window(c, x):
    t, T = x.t, x.T
    td = x.w(177)  # DOOR (TAK PAHUNCHAYA)
    cam = cam_move(t, T, 1.0, 1.22, 540, 960, 720, 900)
    with layer(c, cam, 0.3):
        grad_rect(c, -600, -600, W + 1200, 1800, 0x5E6A9A, 0xE9A07A)
        PR.stars(c, -200, -200, W + 400, 500, t, n=20, seed=8)
        PR.moon(c, 220, 260, 44)
    with layer(c, cam, 0.55):
        for k in range(9):
            hx = -300 + k * 190
            paper(c, rect(hx, 1050 - (k % 3) * 90, 170, 800), 0x3E4466, ol=2, seed=710 + k)
            for j in range(3):
                flat(c, rect(hx + 40, 1100 - (k % 3) * 90 + j * 110, 30, 44), 0xF6D27A,
                     0.8 if hash01(k, j) > 0.4 else 0.15)
    with layer(c, cam, 0.85):
        paper(c, rect(-400, 1250, W + 800, 900), 0x4E6A4A, ol=0, seed=720)
        cozy_house(c, 760, 1300, 1.0, t, lit=1.0)
        pts = [(-120, 820), (120, 860), (330, 900), (520, 940), (700, 990), (840, 1090)]
        for (px, py) in pts[1:-1]:
            PR.telegraph_pole(c, px, py + 340, 0.9, seed=int(px), col=0x3A2A20)
        wp = [(px, py + 70) for (px, py) in pts]
        PR.wire(c, wp, col=0x2A2020, w=4)
        u = seg(t, td - 0.9, td + 0.8)
        if 0 < u < 1:
            PR.glow_pulse_along(c, wp, u, r=36)
    glow(c, 900, 1050, 500, 0xFFD27A, 0.12)


def armchair(c, x, y, s=1.0, col=0x7E5A6E, seed=0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-190, -560, 380, 420, 120), col, seed=seed)
            paper(c, rrect(-230, -300, 90, 300, 40), shade(col, 0.9), seed=seed + 1)
            paper(c, rrect(140, -300, 90, 300, 40), shade(col, 0.9), seed=seed + 2)
            paper(c, rrect(-170, -220, 340, 120, 30), shade(col, 1.08), seed=seed + 3)
            paper(c, rect(-200, -110, 400, 90), shade(col, 0.85), seed=seed + 4)
            for sd in (-1, 1):
                paper(c, rect(sd * 170 - 14, -30, 28, 30), PAL['wood_dk'], ol=2)
            for k in range(5):
                rivet(c, -120 + k * 60, -500, 4.5)
    with_shadow(c, draw, 8 * s, 12 * s, 10 * s, 0.32)


def seated_mabel(c, x, y, s, t, expr='calm', book=True, lx=0.0):
    """Mabel sitting in an armchair (chair seat at y)."""
    L = CH.LOOKS['mabel']
    with xf(c, x, y, 0, s):
        paper(c, blob([(-120, -230), (120, -230), (150, -120), (170, 160), (60, 180), (-60, 180), (-170, 160),
                       (-150, -120)], k=0.6), L['dress'], seed=731)
        for k in range(4):
            stroke(c, svg(f"M {-70 + k * 46} -120 Q {-80 + k * 52} 40 {-90 + k * 60} 170"), L['dress_dk'], 2.4, 0.5)
        for sd in (-1, 1):
            paper(c, oval(sd * 50, 200, 40, 16), 0x3A2A22, ol=2)
    CH.draw_bust(c, 'mabel', x, y - 430 * s, 1.0 * s, t=t, expr=expr, lx=lx, ly=0.45, shadow=(5, 8, 8, 0.25))
    if book:
        with xf(c, x, y - 160 * s, 0, s):
            paper(c, poly([(-120, -10), (0, 10), (0, 90), (-120, 70)]), 0xF6EEDC, ol=2.5, seed=732)
            paper(c, poly([(120, -10), (0, 10), (0, 90), (120, 70)]), 0xF2E8D2, ol=2.5, seed=733)
            for k in range(4):
                line(c, -100, 8 + k * 16, -14, 22 + k * 16, 0x9A8A70, 2, 0.6)
                line(c, 14, 22 + k * 16, 100, 8 + k * 16, 0x9A8A70, 2, 0.6)
            for sd in (-1, 1):
                paper(c, oval(sd * 128, 40, 22, 26), L['skin'], ol=2.2)


def s13b_ring(c, x):
    t, T = x.t, x.T
    tg = x.w(185)  # GHANTI
    cam = cam_move(t, T, 1.0, 1.1, 540, 960, 600, 900)
    room(c, cam, wallc=0x6E8C8A, stripe=0x5E7C7A, floor_y=1480, wainscot=0x8A7A62, seed=740)
    with layer(c, cam, 0.88):
        PR.window(c, 110, 300, 330, 470, t, sky='grey', curtains=0x8E6A7A, rain=True, seed=741)
        PR.frame_portrait(c, 820, 330, 150, 190, lambda cc, a, b, w, h: grad_rect(cc, a - w / 2, b - h / 2, w, h,
                          0xC9D2C0, 0x9AAA8E), oval_shape=True, seed=742)
    ring = 1.0 if (t % 1.6) < 1.1 else 0.0
    with layer(c, cam, 1.0):
        PR.wall_phone(c, 860, 820, 1.25, t, ring=ring, seed=743)
        if ring:
            PR.sound_rings(c, 860, 700, t, n=4, period=0.55, rmax=420, width=9, arc=(110, 140), alpha=0.95)
        armchair(c, 420, 1560, 1.15, seed=744)
        seated_mabel(c, 420, 1310, 1.0, t, expr='calm', lx=-0.15)
        PR.table_top(c, 700, 1300, 180, 26, seed=745, leg_h=180)
        PR.flower_pot(c, 790, 1300, 0.7, seed=746)
    PR.dust_motes(c, 100, 300, 500, 900, t, n=14, seed=12, alpha=0.35)


# ---------------------------------------------------------------- S14 death & silence
def s14a_funeral(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.08, 540, 960, 540, 920)
    with layer(c, cam, 0.3):
        grad_rect(c, -600, -600, W + 1200, 1800, 0x8E9AA0, 0xC4CBCB)
        for k in range(4):
            PR.cloud(c, ((k * 360 + t * 10) % 1600) - 300, 220 + 90 * (k % 2), 1.1, seed=20 + k, col=0xA9B2B4)
    with layer(c, cam, 0.55):
        paper(c, blob([(-500, 1100), (200, 1000), (700, 1060), (1600, 980), (1600, 1900), (-500, 1900)], k=0.6),
              0x7E8E7A, ol=3, seed=750)
        for k in range(3):
            tx = 100 + k * 420
            paper(c, rect(tx, 760, 24, 330), 0x4A4A44, ol=2, seed=751 + k)
            for j in range(4):
                stroke(c, svg(f"M {tx + 12} {800 + j * 60} L {tx + 12 + (60 if j % 2 else -60)} {760 + j * 60}"),
                       0x4A4A44, 8)
        for k in range(5):
            PR.gravestone(c, -60 + k * 270, 1180, 0.55, seed=760 + k, text='')
    with layer(c, cam, 1.0):
        paper(c, blob([(-500, 1350), (300, 1300), (900, 1340), (1600, 1300), (1600, 2100), (-500, 2100)], k=0.6),
              0x6E7E6A, ol=3, seed=770)

        def easel():
            line(c, 420, 1500, 540, 560, PAL['wood_dk'], 18)
            line(c, 660, 1500, 540, 560, PAL['wood_dk'], 18)
            line(c, 540, 600, 540, 1520, PAL['wood_dk'], 14)
        with_shadow(c, easel, 6, 10, 9, 0.3)

        def inner(cc, a, b, w, h):
            grad_rect(cc, a - w / 2, b - h / 2, w, h, 0xD9CDB4, 0xB9AD94)
            CH.draw_bust(cc, 'bell_old', a, b + 10, w / 330, t=t, expr='peace', shadow=None)
        PR.frame_portrait(c, 540, 860, 360, 440, inner, oval_shape=False, col=0x3A3530, seed=771, pin=False)
        paper(c, poly([(330, 650), (420, 650), (750, 1080), (750, 1170)]), 0x1A1A1E, ol=2, seed=772)
        for k in range(7):
            PR.flower_pot  # noqa
            paper(c, circle(380 + k * 55, 1160 + (k % 2) * 16, 26), [0xF6EEDC, 0xE8E2D4, 0xD9D2C0][k % 3], ol=2,
                  seed=780 + k)
            flat(c, circle(380 + k * 55, 1160 + (k % 2) * 16, 8), 0xC9B26E)
        PR.umbrella(c, 130, 1250, 1.3, rot=-8, seed=790)
        PR.umbrella(c, 960, 1290, 1.4, rot=10, seed=791, col=0x22252C)
        for (ux, uy, rr) in ((130, 1250, -8), (960, 1290, 10)):
            CH.draw_back_head(c, 'father' if ux < 500 else 'operator1', ux, uy + 150, 0.9, t=t)
    PR.rain(c, t, alpha=0.5, n=110, seed=5)


def s14b_switch(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.05, 540, 900, 540, 880)
    with layer(c, cam, 0.9):
        paper(c, rect(-400, -400, W + 800, H + 800), 0x4A4A50, ol=0, seed=800)
        PR.switchboard(c, 60, 220, 960, 1000, t=t, unplug=sm(t, 0.0, T * 0.95), seed=801)
        lights = 1 - sm(t, 0.0, T * 0.95)
        for k in range(8):
            lx = 120 + k * 120
            paper(c, circle(lx, 180, 18), mix(0x3A3A3A, 0xF2C14E, clamp(lights * 8 - k * 0.9)), ol=2, tex=False)
    with layer(c, cam, 1.08):
        for i, (who, hx) in enumerate((('operator1', 230), ('operator2', 850))):
            CH.draw_back_head(c, who, hx, 1460, 1.5, t=t)
            # headset band
            stroke(c, svg(f"M {hx - 140} 1460 Q {hx} 1240 {hx + 140} 1460"), 0x2A2724, 14)
            paper(c, circle(hx - 140, 1470, 30), 0x2A2724, ol=2.5)
            reach = 0.5 + 0.5 * math.sin(t * 4 + i * 2)
            sd = 1 if i == 0 else -1
            sl = CH.LOOKS[who]['collar']
            ang = 24 * sd
            bx, by = hx + 100 * sd, 1420
            dx, dy = math.sin(math.radians(ang)), -math.cos(math.radians(ang))
            with xf(c, bx + dx * 120 * reach, by + dy * 120 * reach, ang):
                paper(c, rrect(-28, -40, 56, 420, 26), sl, seed=810 + i)
                paper(c, rrect(-30, -40, 60, 26, 10), 0xF4F0E6, ol=2)
                paper(c, blob([(-24, -40), (-28, -84), (-8, -108), (16, -100), (28, -66), (24, -40)], k=0.8),
                      CH.LOOKS[who]['skin'], ol=2.5)


def s14c_map(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.04, 1.0, 540, 900, 540, 920)
    with layer(c, cam, 0.9):
        paper(c, rect(-400, -400, W + 800, H + 800), 0x2E3A44, ol=0, seed=820)
        for k in range(14):
            stroke(c, svg(f"M -400 {k * 160} L 1500 {k * 160 + 40}"), 0x3A4652, 2, 0.6)
    with layer(c, cam, 1.0):
        with xf(c, 40, 560, 0, 1.0):
            with_shadow(c, lambda: paper(c, PR.usa_map_path(), 0xC9C2A8, ol=4, seed=821), 8, 14, 12, 0.4)
            stroke(c, svg("M 200 120 L 220 460 M 420 90 L 400 470 M 620 110 L 640 480"), 0xA9A288, 2, 0.6)
            pts = [(120, 180), (150, 300), (230, 230), (260, 380), (330, 160), (360, 300), (420, 420), (470, 220),
                   (520, 330), (560, 180), (600, 420), (640, 270), (700, 160), (720, 360), (780, 250), (800, 400),
                   (850, 160), (880, 260), (820, 470), (500, 470)]
            order = sorted(range(len(pts)), key=lambda k: -pts[k][0])
            for rank, k in enumerate(order):
                px, py = pts[k]
                off = seg(t, 0.15 + rank * (T * 0.75) / len(pts), 0.3 + rank * (T * 0.75) / len(pts))
                PR.phone_icon(c, px, py, 1.15, lit=1 - off, seed=830 + k)


def s14d_clock(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.08, 540, 860, 540, 840)
    with layer(c, cam, 0.85):
        PR.wall(c, -400, -400, W + 800, H + 800, 0x5E6A70, stripe=0x56626A, seed=840)
    with layer(c, cam, 1.0):
        u = seg(t, 0.1, T - 0.05)
        PR.clock_face(c, 540, 760, 360, minutes=10 + (1.0 if u >= 1 else 0.0), seconds=u * 60, seed=841)
        PR.candlestick_phone(c, 260, 1600, 1.2, seed=842)
        # crossed-out sound: rings that fade instantly
        a = 1 - sm(t, 0.0, 0.6)
        if a > 0:
            PR.sound_rings(c, 260, 1240, t, n=2, period=0.6, rmax=140, width=6, alpha=a)


# ---------------------------------------------------------------- S15 empty chair
def s15_empty(c, x):
    t, T = x.t, x.T
    tp = x.w(213)  # PAANCH
    tc = x.w(218)  # CHALI
    cam = cam_move(t, T, 1.0, 1.12, 540, 960, 600, 880)
    room(c, cam, wallc=0x5E726E, stripe=0x52645F, floor_y=1480, wainscot=0x7A6C58, seed=850)
    with layer(c, cam, 0.88):
        PR.window(c, 90, 300, 330, 470, t, sky='grey', curtains=0x6E5A66, rain=True, seed=851)

        def inner(cc, a, b, w, h):
            grad_rect(cc, a - w / 2, b - h / 2, w, h, 0xE6D9BA, 0xC9B994)
            CH.draw_bust(cc, 'mabel', a, b + 12, w / 300, t=t, expr='calm', shadow=None)
        PR.frame_portrait(c, 760, 470, 230, 290, inner, oval_shape=True, seed=852)
        months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN']
        k = int(clamp((t - tp + 0.2) / 0.16, 0, 5))
        f = ((t - tp + 0.2) / 0.16) % 1.0 if 0 <= (t - tp + 0.2) < 0.8 else 0.0
        PR.calendar(c, 930, 820, 0.55, text=months[k], next_text=months[min(5, k + 1)], flip=f, seed=853)
    with layer(c, cam, 1.0):
        armchair(c, 380, 1560, 1.15, seed=744)
        PR.table_top(c, 690, 1170, 260, 26, seed=855, leg_h=330)
        lit = 1 - sm(t, tc - 0.05, tc + 0.5)
        PR.candle(c, 820, 1170, 1.1, t, lit=lit, height=0.45, seed=856, glow_a=0.55)
        if lit < 0.95:
            PR.smoke_wisps(c, 820, 1170 - 0.45 * 99 - 14, t - tc, amount=1 - lit * 0.8, seed=3)
        CH.ribbon_bow(c, 380, 945, 12, 1.4, t=0)  # her ribbon left on the chair
    glow(c, 820, 1080, 460, 0xFFB24A, 0.28 * (1 - sm(t, tc, tc + 0.6)))


# ---------------------------------------------------------------- S16 stage + reveal
def s16a_stage(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.06, 540, 960, 540, 940)
    with layer(c, cam, 1.0):
        flat(c, rect(-200, -200, W + 400, H + 400), 0x120C10)
        paper(c, rect(-200, 1560, W + 400, 600), PAL['wood_dk'], ol=3, seed=860)
        PR.stage_curtains(c, 0.0, t)
    on = sm(t, 0.15, 0.35) * (0.85 + 0.15 * (1 if (t * 13) % 1 > 0.2 or t > 0.6 else 0))
    a = 0.94 - 0.5 * on
    PR.spotlight(c, 540, 1000, 330 + 40 * on, a=a + 0.05)
    if on > 0:
        p = poly([(500, -40), (580, -40), (840, 1500), (240, 1500)])
        c.drawPath(p, skia.Paint(AntiAlias=True, Color=C(0xFFF1C8, 0.10 * on), MaskFilter=_blur(30),
                                 BlendMode=skia.BlendMode.kScreen))
        PR.dust_motes(c, 260, 100, 560, 1300, t, n=26, seed=13, alpha=0.5 * on)


def poster_letters(c, text, cx, y, size, col, t, t_in, seed=0, spacing=6):
    f = font('Anton-Regular.ttf', size)
    gl = f.textToGlyphs(text)
    ws = f.getWidths(gl)
    total = sum(ws) + spacing * (len(ws) - 1)
    xx = cx - total / 2
    for k, (g, w) in enumerate(zip(gl, ws)):
        v = seg(t, t_in + k * 0.035, t_in + k * 0.035 + 0.28)
        if v <= 0:
            xx += w + spacing
            continue
        gp = f.getPath(g)
        rot = (hash01(seed, k) - 0.5) * 10
        by = (hash01(seed, k, 2) - 0.5) * 16
        with xf(c, xx + w / 2, y + by - size * 0.35, rot, eback(v)):
            if gp is not None:
                c.save()
                c.translate(-w / 2, size * 0.35)
                c.save()
                c.translate(6, 10)
                c.drawPath(gp, skia.Paint(AntiAlias=True, Color=C(0, 0.4), MaskFilter=_blur(6),
                                          Style=skia.Paint.kStrokeAndFill_Style, StrokeWidth=16,
                                          StrokeJoin=skia.Paint.kRound_Join))
                c.restore()
                c.drawPath(gp, skia.Paint(AntiAlias=True, Color=C(0xFBF6EA), Style=skia.Paint.kStrokeAndFill_Style,
                                          StrokeWidth=16, StrokeJoin=skia.Paint.kRound_Join))
                paper(c, gp, col, ol=0, seed=seed + k)
                c.restore()
        xx += w + spacing


def s16b_reveal(c, x):
    t, T = x.t, x.T
    ta, tg, tb = x.w(225), x.w(226), x.w(227)
    op = sm(t, -0.05, 0.45)
    cam = cam_move(t, T, 1.04, 1.0, 540, 960, 540, 960)
    with layer(c, cam, 0.8):
        PR.sunburst(c, 540, 1080, t, cols=(0xE8B84A, 0x3E8A8E), n=18, rot_speed=5)
        flat(c, rect(-300, 1520, W + 600, 700), 0x7A2A2A)
        paper(c, rect(-300, 1500, W + 600, 30), 0xD8B04A, ol=2)
    with layer(c, cam, 1.0):
        poster_letters(c, 'ALEXANDER', 540, 420, 190, PAL['red'], t, ta - 0.05, seed=3)
        poster_letters(c, 'GRAHAM BELL', 540, 630, 148, PAL['navy'], t, tg - 0.05, seed=9, spacing=4)
        CH.draw_char(c, 'bell_old', 540, 1880, 1.12, t=t, expr='proud', lx=0.0,
                     pose=dict(armL=(30, 70), armR=(30, 70), head=-3 + 2 * math.sin(t * 1.5)))
    PR.confetti(c, t, max(0.0, ta - 0.1), n=80, seed=4)
    # frame border like a vintage poster
    p = skia.Path()
    p.setFillType(skia.PathFillType.kEvenOdd)
    p.addRect(skia.Rect.MakeXYWH(-10, -10, W + 20, H + 20))
    p.addRect(skia.Rect.MakeXYWH(34, 34, W - 68, H - 68))
    paper(c, p, 0x8E2A2A, ol=0, seed=870)
    stroke(c, rect(34, 34, W - 68, H - 68), 0xD8B04A, 6)
    if op < 1:
        PR.stage_curtains(c, op, t)


# ---------------------------------------------------------------- S17 ending
def modern_person(c, x, y, s, t, seed=0, look='kid1', jacket=0xC0614A, phone_side=1):
    L = CH.LOOKS[look]
    talk = CH.talk_amount(t, True, 7 + seed % 3, seed=seed)

    def draw():
        with xf(c, x, y, 0, s):
            for sd in (-1, 1):
                paper(c, rrect(sd * 28 - 22, -300, 44, 290, 18), 0x3E5A7E, seed=seed + 1 + sd)
                paper(c, oval(sd * 30, -8, 32, 14), 0xF6F2EA, ol=2)
            paper(c, rrect(-80, -560, 160, 290, 50), jacket, seed=seed + 4)
            paper(c, poly([(-26, -560), (26, -560), (0, -500)]), 0xF6F2EA, ol=2)
            with xf(c, 0, -580):
                with xf(c, 0, -90, 0, 0.9):
                    CH.draw_head(c, L, 'joy' if (seed % 2) else 'smile', t, 0.0, talk, -0.2 * phone_side, 0, L['seed'])
            # arm up holding phone to ear
            with xf(c, phone_side * 70, -540, -phone_side * 150):
                paper(c, rrect(-22, -10, 44, 150, 22), jacket, seed=seed + 5)
                with xf(c, 0, 150, phone_side * 140):
                    paper(c, rrect(-20, -10, 40, 110, 20), jacket, seed=seed + 6)
                    paper(c, circle(0, 110, 18), L['skin'], ol=2)
                    paper(c, rrect(-14, 84, 28, 50, 6), 0x23262E, ol=2)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)
    PR.sound_rings(c, x + phone_side * 120 * s, y - 760 * s, t + seed * 0.3, n=2, period=0.9, rmax=120 * s,
                   width=6 * s)


def city_scene(c, cam, t):
    with layer(c, cam, 0.3):
        grad_rect(c, -800, -800, W + 1600, 2000, 0x8FC1D4, 0xE9E0C8)
        PR.sun(c, 860, 260, 60, t)
        for k in range(4):
            PR.cloud(c, ((k * 400 + t * 20) % 1800) - 400, 200 + 100 * (k % 2), 0.9, seed=30 + k)
    with layer(c, cam, 0.6):
        cols = [0xE8B84A, 0x5E9AA1, 0xC0614A, 0xE9A07A, 0x8E9FD6, 0x6E9B5A]
        for k in range(12):
            bx = -500 + k * 180
            bh = 600 + (k * 137) % 400
            paper(c, rect(bx, 1250 - bh, 170, bh + 400), cols[k % 6], ol=3, seed=900 + k, sh=(5, 9, 9, 0.25))
            for j in range(int(bh / 90)):
                for i in range(3):
                    flat(c, rect(bx + 20 + i * 50, 1250 - bh + 30 + j * 90, 30, 46), 0xF6EEDC, 0.7)
    with layer(c, cam, 1.0):
        paper(c, rect(-800, 1250, W + 1600, 1200), 0x9A9A96, ol=0, seed=920)
        for k in range(-6, 14):
            flat(c, rect(k * 160, 1700, 90, 26), 0xF6F2EA, 0.8)
        people = [(-380, 1600, 0.62, 'kid1', 0xC0614A, 1), (-150, 1560, 0.55, 'kid2', 0x5E8FB0, -1),
                  (90, 1640, 0.66, 'kid4', 0xE8B84A, 1), (540, 1820, 0.95, 'kid4', 0x6E9B5A, 1),
                  (880, 1620, 0.64, 'kid3', 0x8E9FD6, -1), (1140, 1580, 0.58, 'watson', 0xE9A07A, 1),
                  (1380, 1620, 0.6, 'kid1', 0x3E7C86, -1), (300, 1500, 0.45, 'kid2', 0xC9A043, 1),
                  (760, 1480, 0.42, 'kid4', 0xB4513A, -1)]
        for i, (px, py, s, lk, jc, sd) in enumerate(sorted(people, key=lambda q: q[1])):
            modern_person(c, px, py, s, t + i * 0.7, seed=950 + i * 7, look=lk, jacket=jc, phone_side=sd)


def s17a_city(c, x):
    t, T = x.t, x.T
    u = eio(seg(t, 0.0, T * 0.85))
    z = lerp(3.4, 1.0, u)
    cam = Cam(z, lerp(560, 540, u), lerp(1100, 1000, u), 0)
    city_scene(c, cam, t)


def s17b_love(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.08, 540, 960, 540, 920)
    with layer(c, cam, 0.4):
        grad_rect(c, -400, -400, W + 800, 1900, 0x6B6FA8, 0xF0B07A)
        PR.sun(c, 540, 1100, 120, t, col=0xF6C25A)
    with layer(c, cam, 0.7):
        paper(c, blob([(-400, 1200), (300, 1120), (800, 1180), (1500, 1100), (1500, 2000), (-400, 2000)], k=0.7),
              0x8A6A7A, ol=3, seed=980)
    with layer(c, cam, 1.0):
        paper(c, blob([(-400, 1400), (400, 1360), (1500, 1420), (1500, 2200), (-400, 2200)], k=0.7), 0x5E4A5E,
              ol=3, seed=981)
        CH.draw_char(c, 'bell', 400, 1600, 1.05, t=t, expr='love', lx=0.55, pose=dict(armR=(28, 30), lean=2))
        CH.draw_char(c, 'mabel', 690, 1600, 1.05, t=t, expr='love', lx=-0.55, pose=dict(armL=(28, 30), lean=-2))
        PR.floating_hearts(c, 545, 900, t, 0.2, n=8, spread=320, seed=7, rise=520)
    glow(c, 540, 1100, 900, 0xFFD27A, 0.25)


def s17c_portrait(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.22, 540, 900, 540, 820)
    with layer(c, cam, 0.85):
        PR.wall(c, -400, -400, W + 800, H + 800, 0x4A3A3E, stripe=0x42343A, seed=990, damask=True)
    with layer(c, cam, 1.0):
        sep = grade_filter(**GRADES['sepia'])

        def inner(cc, a, b, w, h):
            cc.saveLayer(None, skia.Paint(ColorFilter=sep))
            grad_rect(cc, a - w / 2, b - h / 2, w, h, 0xE9D8B4, 0xC9B48E)
            CH.draw_bust(cc, 'bell', a - 130, b + 40, 1.05, t=t, expr='smile', lx=0.2, shadow=(4, 6, 6, 0.2))
            CH.draw_bust(cc, 'mabel', a + 135, b + 50, 1.0, t=t, expr='love', lx=-0.2, shadow=(4, 6, 6, 0.2))
            cc.restore()
            cc.drawRect(skia.Rect.MakeXYWH(a - w / 2, b - h / 2, w, h),
                        skia.Paint(Shader=skia.GradientShader.MakeRadial((a, b), w * 0.8,
                                   [C(0, 0), C(0x2A1A0A, 0.45)])))
        PR.frame_portrait(c, 540, 800, 600, 640, inner, oval_shape=False, col=0xC9A043, seed=991)
        PR.table_top(c, 300, 1330, 480, 28, seed=992, leg_h=500)
        PR.candle(c, 420, 1330, 1.1, t, lit=1.0, height=0.8, seed=993, glow_a=0.55)
        PR.candle(c, 660, 1330, 0.9, t + 1.3, lit=1.0, height=0.6, seed=994, glow_a=0.45)
        CH.ribbon_bow(c, 540, 1300, -8, 1.2, t=0)
    PR.dust_motes(c, 200, 300, 700, 1000, t, n=20, seed=14, alpha=0.4)
