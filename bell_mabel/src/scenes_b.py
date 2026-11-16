"""Scenes 8-12: workshop montage, wire across the map, 1876, first call, world, wedding, shares."""
import math

import skia

from engine import (C, W, H, PAL, paper, flat, stroke, line, glow, xf, svg, blob, oval, circle, rrect, rect, poly,
                    clamp, lerp, seg, eio, eout, ein, eback, sm, smo, wave, noise1, hash01, shade, mix, font,
                    text_path, draw_text, _blur, with_shadow, grad_rect, layer, Cam, cam_move, alpha_layer, rivet,
                    torn_rect)
import chars as CH
import props as PR
from scenes_a import room, light_rays, walk_pose, desk_front, table_topdown

MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']


def workshop_wall(c, cam, t, par=0.82, seed=0):
    with layer(c, cam, par):
        paper(c, rect(-400, -400, W + 800, 1900), 0x5B3F2C, ol=0, seed=seed)
        for k in range(-3, 14):
            line(c, k * 110 + 20, -400, k * 110 + 20, 1500, 0x4A3222, 4, 0.7)
            for j in range(3):
                flat(c, circle(k * 110 + 40, 200 + j * 420 + (k * 53) % 200, 4), 0x3A2618, 0.7)
        PR.floor_wood(c, -400, 1500, W + 800, 900, PAL['wood_dk'], seed=seed + 1)


def sky_cycle(t, period=1.4):
    v = 0.5 + 0.5 * math.cos(2 * math.pi * t / period)
    return mix(0x1D2A4E, 0x9CCAD8, v), v


def pinned_sketch(c, x, y, rot, seed, kind=0):
    with xf(c, x, y, rot):
        paper(c, rect(-70, -80, 140, 160), 0xF2E8D2, ol=2, seed=seed, sh=(3, 6, 6, 0.3))
        if kind == 0:
            stroke(c, svg("M -40 -30 Q -20 -60 0 -30 T 40 -30"), 0x2A3A5A, 3)
            stroke(c, svg("M -40 20 L 40 20 M -40 40 L 20 40"), 0x2A3A5A, 2.4, 0.7)
        elif kind == 1:
            stroke(c, circle(0, -10, 34), 0x2A3A5A, 3)
            stroke(c, svg("M -34 -10 L 34 -10 M 0 -44 L 0 24"), 0x2A3A5A, 2, 0.6)
        else:
            stroke(c, svg("M -50 30 L -20 -30 L 10 20 L 40 -40"), 0x2A3A5A, 3)
        rivet(c, 0, -70, 5)


def hand_sleeve(c, x, y, rot, s=1.0, seed=0):
    with xf(c, x, y, rot, s):
        paper(c, rrect(-40, 0, 80, 520, 36), PAL['navy'], seed=seed)
        paper(c, rrect(-42, 0, 84, 40, 12), 0xF7F3EA, ol=2)
        paper(c, blob([(-30, -10), (-34, -60), (-10, -90), (20, -80), (34, -40), (30, 0)], k=0.8),
              CH.LOOKS['bell']['skin'], ol=2.5)


def star(c, x, y, s, rot=0.0, col=PAL['mustard']):
    with xf(c, x, y, rot, s):
        paper(c, poly([(0, -30), (8, -8), (30, 0), (8, 8), (0, 30), (-8, 8), (-30, 0), (-8, -8)]), col, ol=2.5,
              tex=False)


# ---------------------------------------------------------------- S8 workshop montage
def s08a_workshop(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.06, 540, 940, 540, 900)
    workshop_wall(c, cam, t, seed=100)
    skyc, day = sky_cycle(t, 1.25)
    with layer(c, cam, 0.85):
        def outside(cc, x0, y0, w, h):
            ang = (t / 1.25) * 2 * math.pi
            mx = x0 + w / 2 + math.sin(ang + math.pi) * w * 0.4
            my = y0 + h * 0.45 + math.cos(ang + math.pi) * h * 0.25
            if day > 0.5:
                PR.sun(cc, mx, my, 30, t)
            else:
                PR.moon(cc, mx, my, 30)
                PR.stars(cc, x0, y0, w, h, t, n=12, seed=3)
        PR.window(c, 620, 260, 320, 380, t, sky=skyc, curtains=None, frame=0xD9CDB4, seed=101, inner=outside)
        k = int(max(0.0, t) / 0.32)
        f = (max(0.0, t) / 0.32) % 1.0
        PR.calendar(c, 230, 470, 0.9, text=MONTHS[k % 12], next_text=MONTHS[(k + 1) % 12], flip=f, seed=102,
                    swing=math.sin(t * 9) * 2)
        PR.grandfather_clock(c, 960, 1480, 0.8, t * 25, seed=103)
        for i, (px, py, r) in enumerate(((420, 250, -6), (500, 330, 7))):
            pinned_sketch(c, px, py, r, 110 + i, i)
    with layer(c, cam, 1.0):
        work = math.sin(t * 9)
        CH.draw_char(c, 'bell', 470, 1620, 1.12, t=t, expr='focus', ly=0.35,
                     pose=dict(armR=(30 + 10 * work, 95 + 15 * work), armL=(28, 100 - 10 * work), head=4 + 3 * work))
    with layer(c, cam, 1.1):
        desk_front(c, 120, 1410, 840, 600, seed=104)
        n = int(3 + max(0.0, t) * 4)
        for i in range(n):
            paper(c, rect(160 + (i * 7) % 30, 1390 - i * 9, 180, 16), 0xF2E8D2, ol=1.6, seed=120 + i)
        PR.coil(c, 560, 1380, 0.9, seed=105)
        PR.candle(c, 820, 1396, 0.95, t, lit=1.0, height=1.0 - 0.3 * clamp(t / T), seed=106, glow_a=0.5)
    glow(c, 820, 1150, 700, 0xFFB24A, 0.18)


def s08b_tools(c, x):
    t, T = x.t, x.T
    tw = x.w(104)  # TAARON
    tm = x.w(105)  # CHUMBAKON
    cam = cam_move(t, T, 1.05, 1.0, 560, 960, 520, 980, rot0=1.0, rot1=-1.0)
    with layer(c, cam, 0.92):
        table_topdown(c, t)
        flat(c, rect(-400, -400, W + 800, H + 800), 0x2A1A10, 0.25)
    with layer(c, cam, 1.0):
        for i, (px, py, r) in enumerate(((260, 360, -8), (760, 300, 6), (520, 1500, 4))):
            PR.paper_sheet(c, px, py, 1.5, rot=r, seed=130 + i, lines=5,
                           sketch=lambda cc: stroke(cc, svg("M -50 30 Q -20 -40 0 0 T 50 -30"), 0x2A3A5A, 3))
        for i in range(3):
            PR.battery_jar(c, 160 + i * 100, 1100, 1.1, seed=140 + i)
        PR.tuning_fork(c, 880, 1180, 1.3, rot=-20, seed=150)
        PR.tuning_fork(c, 960, 1240, 1.1, rot=-35, seed=151)
        u = sm(t, tw - 0.2, tw + 0.6)
        if u > 0:
            pts = [(80, 760), (260, 700), (420, 820), (600, 720), (760, 860), (980, 780)]
            meas = skia.PathMeasure(PR.wire_path(pts), False)
            L = meas.getLength()
            p = skia.Path()
            meas.getSegment(0, L * u, p, True)
            stroke(c, p, 0xF6EEDC, 12)
            stroke(c, p, 0xB86A3A, 7)
            PR.coil(c, 540, 880, 1.4 * eback(seg(t, tw - 0.1, tw + 0.3)), seed=152)
        for i, (mx, my, r) in enumerate(((330, 980, -14), (720, 1020, 18))):
            v = seg(t, tm - 0.15 + i * 0.12, tm + 0.25 + i * 0.12)
            if v > 0:
                PR.magnet(c, mx, my - 200 * (1 - eout(v)), 1.4 * eback(v), rot=r, seed=160 + i)
        hand_sleeve(c, 600 + 60 * math.sin(t * 2.2), 1250 + 30 * math.cos(t * 3.1), -25, seed=170)
    glow(c, 900, 300, 800, 0xFFB24A, 0.2)


def s08c_fork(c, x):
    t, T = x.t, x.T
    ta = x.w(107)  # AAWAAZ
    cam = cam_move(t, T, 1.0, 1.07, 540, 900, 560, 880)
    workshop_wall(c, cam, t, seed=100)
    with layer(c, cam, 0.85):
        PR.window(c, 640, 200, 300, 360, t, sky='night', curtains=None, frame=0xD9CDB4, moon_pos=(760, 300), seed=101)
        PR.candle(c, 180, 1320, 1.2, t, lit=1.0, height=0.55, seed=180, glow_a=0.6)
    with layer(c, cam, 1.0):
        CH.draw_bust(c, 'bell', 590, 830, 1.9, t=t, expr='tired' if t < ta - 0.1 else 'focus', lx=-0.35, ly=0.1,
                     head=-6)
        strike = sm(t, ta - 0.4, ta - 0.15)
        vib = 1.0 if t > ta - 0.15 else 0.0
        PR.tuning_fork(c, 280, 860 + 30 * (1 - strike), 1.6, rot=-12 + 20 * (1 - strike), t=t, vib=vib, seed=181)
        if t > ta - 0.15:
            PR.sound_rings(c, 280, 650, t - ta, n=4, period=0.8, rmax=380, width=8, alpha=sm(t, ta - 0.15, ta + 0.1))
    glow(c, 180, 1100, 800, 0xFFB24A, 0.2)


# ---------------------------------------------------------------- S9 dream of sending a voice far
def s09a_idea(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.0, 1.06, 540, 960, 540, 920)
    workshop_wall(c, cam, t, seed=100)
    with layer(c, cam, 1.0):
        CH.draw_char(c, 'bell', 420, 1640, 1.1, t=t, expr='love', lx=0.3, ly=-0.6,
                     pose=dict(armL=(36, 120), armR=(14, 40), head=-6))
    with layer(c, cam, 1.1):
        desk_front(c, 80, 1420, 900, 560, seed=104)
        PR.candle(c, 860, 1406, 0.95, t, lit=1.0, height=0.5, seed=106, glow_a=0.5)
    a = sm(t, 0.15, 0.6)
    if a > 0:
        for i, (bx, by, br) in enumerate(((560, 690, 16), (610, 610, 26))):
            v = seg(t, 0.1 + i * 0.1, 0.35 + i * 0.1)
            if v > 0:
                paper(c, circle(bx, by, br * eback(v)), 0xF6EEDC, ol=3, sh=(3, 6, 6, 0.3))
        with xf(c, 640, 330, 0, eback(a)):
            PR.cloud(c, 0, 90, 3.0, seed=9, col=0xF6EEDC)
            for sd, who in ((-1, 'bell'), (1, 'mabel')):
                with xf(c, sd * 175, 40, 0, 0.3):
                    CH.draw_bust(c, who, 0, 0, 1.0, t=t, expr='smile', lx=-sd * 0.5, shadow=None, shoulders=True)
            stroke(c, svg("M -120 110 C -40 160 40 60 120 110"), 0x2A2420, 5)
            PR.glow_pulse_along(c, [(-120, 110), (-40, 140), (40, 90), (120, 110)], (t * 0.8) % 1.0, r=24)
    glow(c, 860, 1150, 700, 0xFFB24A, 0.18)


def parchment_map(c, t, seed=0):
    paper(c, rect(-400, -400, W + 800, H + 800), 0x4E8A92, ol=0, seed=seed)
    for k in range(10):
        stroke(c, svg(f"M -400 {k * 260 + 100} Q 300 {k * 260 + 60 + 30 * math.sin(t + k)} 1500 {k * 260 + 110}"),
               0x6FA3AA, 3, 0.5)
    land = blob([(-300, 200), (300, 120), (700, 260), (1000, 180), (1400, 300), (1350, 900), (1100, 1100),
                 (1250, 1500), (1000, 1800), (500, 1700), (200, 1850), (-300, 1700)], k=0.6)
    paper(c, land, 0xEAD9B0, ol=4, seed=seed + 1, sh=(8, 12, 12, 0.3))
    for k in range(9):
        mx, my = 120 + (k * 211) % 900, 380 + (k * 337) % 1200
        paper(c, poly([(mx - 40, my + 30), (mx, my - 40), (mx + 40, my + 30)]), 0xC9A97A, ol=2.5, seed=seed + 10 + k)
        flat(c, poly([(mx - 12, my - 18), (mx, my - 40), (mx + 12, my - 18)]), 0xF6EEDC)
    for k in range(14):
        tx, ty = 80 + (k * 173) % 950, 300 + (k * 263) % 1450
        paper(c, circle(tx, ty, 16), PAL['green'], ol=2, seed=seed + 30 + k)
    stroke(c, svg("M 200 300 C 300 600 150 900 350 1200 S 500 1600 420 1800"), 0x6FA3AA, 6, 0.8)


def s09b_map(c, x):
    t, T = x.t, x.T
    td = x.w(120)  # DOOR
    cam = cam_move(t, T, 1.12, 1.0, 380, 1100, 640, 860)
    pts = [(180, 1500), (330, 1300), (480, 1150), (640, 980), (800, 800), (930, 620)]
    with layer(c, cam, 1.0):
        parchment_map(c, t, seed=200)
        for (px, py) in pts:
            PR.telegraph_pole(c, px, py + 120, 0.45, seed=int(px))
        wp = [(px, py - 10) for (px, py) in pts]
        PR.wire(c, wp, w=5)
        CH.draw_char(c, 'bell', 120, 1640, 0.5, t=t, expr='joy', lx=0.5, talk=CH.talk_amount(t, True, 8),
                     pose=dict(armR=(40, 110)))
        CH.draw_char(c, 'mabel', 990, 780, 0.42, t=t, expr='shock_happy' if t > td + 0.5 else 'smile', lx=-0.5)
        u = seg(t, td - 0.6, td + 0.9)
        if 0 < u < 1:
            PR.glow_pulse_along(c, wp, u, r=40)
        if u >= 1:
            PR.sound_rings(c, 990, 540, t - td, n=3, period=0.8, rmax=160, width=6)


# ---------------------------------------------------------------- S10 1876
def s10a_1876(c, x):
    t, T = x.t, x.T
    ty = x.w(126)  # 1876
    shake = math.exp(-(t - ty) * 7) * 14 if t > ty else 0.0
    cam = cam_move(t, T, 1.0, 1.08, 540, 940, 540, 900)
    cam.cx += math.sin(t * 60) * shake
    cam.cy += math.cos(t * 53) * shake
    workshop_wall(c, cam, t, seed=100)
    with layer(c, cam, 0.9):
        pinned_sketch(c, 200, 300, -8, 300, 0)
        pinned_sketch(c, 880, 330, 6, 301, 2)
        PR.candle(c, 900, 1480, 1.0, t, lit=1.0, seed=302)
    with layer(c, cam, 1.0):
        years = [1870, 1871, 1872, 1873, 1874, 1875]
        if t < ty - 0.18:
            per = max(0.1, (ty - 0.18) / 6)
            k = min(int(max(0.0, t) / per), 5)
            f = (max(0.0, t) / per) % 1.0
            nxt = str(years[k + 1]) if k + 1 < 6 else '1876'
            PR.calendar(c, 540, 860, 2.2, text=str(years[k]), next_text=nxt, flip=f, seed=303)
        else:
            drop = 1 - eout(seg(t, ty - 0.18, ty))
            PR.calendar(c, 540, 860 - drop * 500, 2.2 + 0.25 * drop, text='1876', seed=303)
            if t > ty:
                v = seg(t, ty, ty + 0.6)
                for k in range(12):
                    ang = k / 12 * 2 * math.pi
                    r0, r1 = 520 + v * 120, 600 + v * 200
                    line(c, 540 + math.cos(ang) * r0, 860 + math.sin(ang) * r0, 540 + math.cos(ang) * r1,
                         860 + math.sin(ang) * r1, 0xF6E6A8, 10, (1 - v))
                for k in range(10):
                    ang = k / 10 * math.pi + math.pi
                    d = v * 260
                    c.drawCircle(540 + math.cos(ang) * (300 + d), 1180 + 40 * v + math.sin(ang) * 30 * v, 30 + 50 * v,
                                 skia.Paint(AntiAlias=True, Color=C(0xD9CDB4, 0.5 * (1 - v)), MaskFilter=_blur(10)))
    glow(c, 540, 860, 900, 0xFFD27A, 0.15 + (0.25 * math.exp(-(t - ty) * 4) if t > ty else 0))


def stacked_room(c, y0, h, wallc, t, seed):
    paper(c, rect(-60, y0, W + 120, h), wallc, ol=0, seed=seed)
    for k in range(10):
        flat(c, rect(k * 120 + 30, y0, 16, h), shade(wallc, 0.9), 0.5)
    PR.floor_wood(c, -60, y0 + h - 120, W + 120, 120, PAL['wood'], seed=seed + 1, plank=40)


def s10b_wire(c, x):
    t, T = x.t, x.T
    tp = x.w(133)  # PEHLI
    cam = cam_move(t, T, 1.0, 1.04, 540, 960, 540, 980)
    with layer(c, cam, 1.0):
        flat(c, rect(-200, -200, W + 400, H + 400), 0x3A2A20)
        stacked_room(c, 80, 820, PAL['teal'], t, 400)
        stacked_room(c, 980, 820, 0x8A6A4A, t, 410)
        paper(c, rect(-60, 890, W + 120, 90), PAL['wood_dk'], ol=3, seed=420)
        PR.window(c, 760, 220, 200, 260, t, sky='day', curtains=PAL['brick'], seed=421)
        PR.frame_portrait(c, 210, 1220, 150, 190, lambda cc, a, b, w, h: grad_rect(cc, a - w / 2, b - h / 2, w, h,
                          0x9CC8D6, 0x6E9B5A), oval_shape=True, seed=422)
        PR.table_top(c, 330, 700, 360, 30, seed=423, leg_h=150)
        PR.bell_transmitter(c, 470, 700, 0.95, seed=424, t=t, active=sm(t, 0.0, 0.3))
        CH.draw_char(c, 'bell', 700, 860, 0.62, t=t, expr='focus' if t < tp else 'joy', lx=-0.7,
                     talk=CH.talk_amount(t, True, 8.5), pose=dict(armL=(40, 80), armR=(12, 30), lean=-6))
        PR.table_top(c, 520, 1600, 360, 30, seed=425, leg_h=150)
        PR.receiver_box(c, 640, 1600, 0.95, seed=426)
        heard = t > tp + 0.2
        CH.draw_char(c, 'watson', 340, 1760, 0.62, t=t, expr='shock_happy' if heard else 'focus', lx=0.7,
                     pose=dict(armR=(60 if heard else 20, 60 if heard else 40), armL=(12, 30)))
        wp = [(590, 520), (980, 520), (1010, 700), (1010, 1300), (980, 1420), (700, 1470)]
        PR.wire(c, wp, w=5)
        u = seg(t, 0.15, tp + 0.3)
        if 0 < u < 1:
            PR.glow_pulse_along(c, wp, u, r=40)
        if heard:
            PR.sound_rings(c, 640, 1490, t - tp, n=3, period=0.7, rmax=200, width=6, arc=(170, 120))


def s10c_watson(c, x):
    t, T = x.t, x.T
    ti = x.w(136)  # INSAAN
    cam = cam_move(t, T, 1.0, 1.07, 540, 900, 540, 860)
    with layer(c, cam, 0.7):
        PR.wall(c, -400, -400, W + 800, H + 800, 0x8A6A4A, stripe=0x7A5A3E, seed=430)
    with layer(c, cam, 1.0):
        ex = 'focus' if t < ti - 0.3 else ('shock' if t < ti + 0.25 else 'shock_happy')
        CH.draw_bust(c, 'watson', 640, 820, 2.05, t=t, expr=ex, lx=-0.35, head=-6)
        PR.receiver_box(c, 230, 1000, 1.5, seed=431)
        PR.sound_rings(c, 230, 860, t, n=4, period=0.7, rmax=330, width=8, arc=(-70, 140))
        v = seg(t, ti - 0.1, ti + 0.5)
        if v > 0:
            for k in range(6):
                ang = k / 6 * 2 * math.pi + t
                r = 260 + 80 * v
                star(c, 640 + math.cos(ang) * r, 700 + math.sin(ang) * r * 0.6, 0.7 * eback(v), t * 90 + k * 30)


# ---------------------------------------------------------------- S11 the world hears
def s11_world(c, x):
    t, T = x.t, x.T
    cam = cam_move(t, T, 1.06, 1.0, 540, 940, 540, 960)
    with layer(c, cam, 0.9):
        paper(c, rect(-400, -400, W + 800, H + 800), 0x3E7C86, ol=0, seed=500)
        for k in range(12):
            stroke(c, svg(f"M -400 {k * 180} Q 540 {k * 180 + 40 * math.sin(t + k)} 1500 {k * 180}"), 0x5E9AA1, 3, 0.4)
        conts = [
            [(80, 300), (380, 240), (460, 420), (360, 600), (420, 760), (300, 880), (200, 700), (60, 520)],
            [(330, 960), (460, 940), (520, 1120), (460, 1380), (380, 1500), (340, 1260)],
            [(560, 260), (760, 220), (980, 300), (1040, 520), (900, 640), (720, 560), (600, 460)],
            [(600, 700), (780, 680), (840, 900), (760, 1180), (640, 1100), (590, 880)],
            [(840, 1260), (1000, 1240), (1040, 1380), (900, 1430)],
        ]
        for i, cp in enumerate(conts):
            paper(c, blob(cp, k=0.7), [0xEAD9B0, 0xD9C27A, 0xC9D29A][i % 3], ol=3.5, seed=510 + i,
                  sh=(6, 10, 9, 0.3))
    spots = [(260, 520, 0.0), (840, 420, 0.25), (420, 1180, 0.5), (720, 900, 0.75), (930, 1330, 1.0),
             (170, 820, 1.2)]
    looks = ['bell', 'mabel', 'watson', 'father', 'kid3', 'mabel']
    with layer(c, cam, 1.0):
        for i, (px, py, st) in enumerate(spots):
            v = seg(t, 0.1 + st, 0.45 + st)
            if v <= 0:
                continue
            if i > 0:
                qx, qy, _ = spots[i - 1]
                p = skia.Path()
                p.moveTo(qx, qy - 80)
                p.quadTo((px + qx) / 2, min(py, qy) - 200, px, py - 80)
                meas = skia.PathMeasure(p, False)
                seg_p = skia.Path()
                meas.getSegment(0, meas.getLength() * eout(v), seg_p, True)
                c.drawPath(seg_p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=5,
                                             Color=C(0xF6EEDC, 0.9),
                                             PathEffect=skia.DashPathEffect.Make([16, 12], -t * 40)))
            with xf(c, px, py, 0, eback(v)):
                CH.draw_char(c, looks[i], 0, 60, 0.36, t=t + i, expr='joy',
                             pose=dict(armR=(40, 120), holdR=lambda cc, i=i: PR.candlestick_phone(cc, 0, 30, 0.5, seed=i)))
                PR.sound_rings(c, 40, -160, t + i * 0.3, n=2, period=0.9, rmax=90, width=5)
    glow(c, 540, 300, 900, 0xFFF0C8, 0.15)


# ---------------------------------------------------------------- S12 wedding + gift + shares
def flower_arch(c, cx, top, w, t, seed=0):
    def draw():
        p = skia.Path()
        p.moveTo(cx - w / 2, top + 800)
        p.lineTo(cx - w / 2, top + 260)
        p.cubicTo(cx - w / 2, top - 60, cx + w / 2, top - 60, cx + w / 2, top + 260)
        p.lineTo(cx + w / 2, top + 800)
        stroke(c, p, 0xF6EEDC, 34)
        stroke(c, p, PAL['green_dk'], 24)
    with_shadow(c, draw, 6, 10, 9, 0.3)
    for k in range(26):
        u = k / 25
        if u < 0.3:
            px, py = cx - w / 2, top + 800 - u / 0.3 * 540
        elif u > 0.7:
            px, py = cx + w / 2, top + 260 + (u - 0.7) / 0.3 * 540
        else:
            a = math.pi + (u - 0.3) / 0.4 * math.pi
            px, py = cx + math.cos(a) * w / 2, top + 260 + math.sin(a) * 300
        col = [0xF2B8C0, 0xF6EEDC, 0xE0606E, 0xF2C14E][k % 4]
        paper(c, circle(px, py, 26 + 6 * math.sin(k)), col, ol=2.2, seed=seed + k)
        flat(c, circle(px, py, 8), 0xD9A23C)
        paper(c, oval(px + 24, py + 10, 16, 8), PAL['green'], ol=1.5)


def bouquet(cc):
    for k in range(5):
        with xf(cc, (k - 2) * 12, -30 - (k % 2) * 14):
            paper(cc, circle(0, 0, 16), [0xF2B8C0, 0xF6EEDC, 0xE0606E][k % 3], ol=2)
            flat(cc, circle(0, 0, 5), 0xD9A23C)
    paper(cc, poly([(-20, -10), (20, -10), (6, 50), (-6, 50)]), PAL['green_dk'], ol=2)
    paper(cc, circle(0, -6, 10), 0xE57F93, ol=1.5)


def s12a_wedding(c, x):
    t, T = x.t, x.T
    ts = x.w(152)  # SHAADI
    cam = cam_move(t, T, 1.0, 1.06, 540, 960, 540, 920)
    room(c, cam, wallc=0xE8DCC4, stripe=0xD9CBB0, floor_y=1450, wainscot=0xC9B48E, seed=600)
    with layer(c, cam, 0.85):
        cxw, cyw = 540, 470
        paper(c, circle(cxw, cyw, 230), 0xC9B48E, seed=601, sh=(5, 9, 9, 0.25))
        cols = [0x5E9AA1, 0xE0B04A, 0xC0614A, 0x8E9FD6]
        for k in range(8):
            p = skia.Path()
            p.moveTo(cxw, cyw)
            p.arcTo(skia.Rect.MakeLTRB(cxw - 200, cyw - 200, cxw + 200, cyw + 200), k * 45, 45, False)
            p.close()
            paper(c, p, cols[k % 4], ol=3, seed=602 + k)
        paper(c, circle(cxw, cyw, 60), 0xF6E6A8, ol=3, seed=610)
        glow(c, cxw, cyw, 420, 0xFFF0C8, 0.3)
        PR.bunting(c, -100, 180, 1180, 180, sag=120, n=14, t=t, seed=2,
                   cols=[0xF2B8C0, 0xF6EEDC, PAL['mustard'], 0xE0606E])
        flower_arch(c, 540, 380, 820, t, seed=620)
    PR.calendar(c, 215, 400, 0.62, text='1877', seed=630, swing=math.sin(t * 2) * 2)
    with layer(c, cam, 1.0):
        happy = t > ts - 0.2
        CH.draw_char(c, 'bell', 390, 1560, 1.02, t=t, expr='happy' if happy else 'joy', lx=0.45,
                     pose=dict(armR=(26, 30), armL=(10, 16)))
        CH.draw_char(c, 'mabel_bride', 680, 1560, 1.02, t=t, expr='happy' if happy else 'love', lx=-0.45,
                     pose=dict(armL=(26, 36), armR=(30, 110), holdR=bouquet))
    PR.petals(c, t, n=26, seed=3)
    light_rays(c, 540, 300, 0, 0.12, n=3, t=t)


def s12b_gift(c, x):
    t, T = x.t, x.T
    tt = x.w(157)  # TOHFE
    tc = x.w(160)  # COMPANY
    cam = cam_move(t, T, 1.0, 1.06, 540, 920, 540, 880)
    with layer(c, cam, 0.7):
        PR.wall(c, -400, -400, W + 800, H + 800, 0xE8DCC4, stripe=0xD9CBB0, seed=640)
        PR.bunting(c, -100, 150, 1180, 150, sag=100, n=12, t=t, seed=5, cols=[0xF2B8C0, 0xF6EEDC, PAL['mustard']])
    with layer(c, cam, 1.0):
        CH.draw_bust(c, 'bell', 280, 900, 1.45, t=t, expr='smile' if t < tt else 'happy', lx=0.5)
        CH.draw_bust(c, 'mabel_bride', 810, 900, 1.45, t=t, expr='smile' if t < tt + 0.3 else 'shock_happy', lx=-0.5)
        lid = sm(t, tt - 0.1, tt + 0.5)
        bx = lerp(420, 560, sm(t, 0.0, 0.8))
        PR.gift_box(c, bx, 1260, 1.5, seed=650, lid=lid)
        v = seg(t, tc - 0.25, tc + 0.35)
        if v > 0:
            with xf(c, bx, 1080 - 160 * eout(v), 0, eback(v) * 1.1):
                paper(c, rect(-120, -150, 240, 150), 0xD9C9A8, ol=3, seed=660)
                paper(c, poly([(-140, -150), (140, -150), (0, -230)]), PAL['brick'], ol=3, seed=661)
                for k in range(3):
                    paper(c, rect(-96 + k * 70, -120, 42, 56), 0x9CC8D6, ol=2)
                paper(c, rect(-110, -40, 220, 34), PAL['navy'], ol=2)
                draw_text(c, 'BELL TELEPHONE CO.', 0, -14, font('BebasNeue-Regular.ttf', 26), 0xF6EEDC, align='center')
            glow(c, bx, 1000, 360 * v, 0xFFE8A0, 0.35 * v)


def s12c_shares(c, x):
    t, T = x.t, x.T
    tsh = x.w(164)  # SHARES
    cam = cam_move(t, T, 1.0, 1.06, 540, 960, 540, 920)
    with layer(c, cam, 0.7):
        PR.wall(c, -400, -400, W + 800, H + 800, 0xE8DCC4, stripe=0xD9CBB0, seed=640)
    with layer(c, cam, 0.9):
        CH.draw_bust(c, 'mabel_bride', 760, 640, 1.55,
                     t=t, expr='love' if t < tsh - 0.2 else 'shock_happy', lx=-0.4, ly=0.4)
    with layer(c, cam, 1.0):
        paper(c, rect(-300, 1000, W + 600, 1200), PAL['wood'], ol=3, seed=670, sh=(0, -10, 14, 0.3))
        for k in range(6):
            line(c, -300, 1060 + k * 140, W + 300, 1060 + k * 140, shade(PAL['wood'], 0.85), 2.5, 0.5)
        u = sm(t, 0.15, tsh + 0.3)
        sx = lerp(260, 700, u)
        fan = sm(t, tsh - 0.1, tsh + 0.6)
        for k in range(6):
            ang = -18 + k * 7 * fan + math.sin(t * 2 + k) * 0.6
            PR.certificate(c, sx + k * 10 * fan, 1240 - k * 14, 1.25, rot=ang, seed=680 + k)
        hand_sleeve(c, sx - 230, 1280, 80, seed=690)
        if t > tsh:
            for k in range(5):
                ang = k / 5 * 2 * math.pi + t * 2
                star(c, 700 + math.cos(ang) * 300, 1150 + math.sin(ang) * 120, 0.6, t * 120)
