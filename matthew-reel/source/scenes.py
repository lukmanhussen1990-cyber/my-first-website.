"""Scenes 1 (hook), 10 (doctor), 11 (Oscar Wilde quote) and 12 (Bible twist)."""
import math, random
import cairo
from gfx import *
from T import w0, w1, s0, s1, TOTAL

RW, RH = W, GROUND

def bg_vignette(ctx, centre, edge, cx=540, cy=520, r0=120, r1=1000):
    g = cairo.RadialGradient(cx, cy, r0, cx, cy, r1)
    g.add_color_stop_rgb(0, *centre)
    g.add_color_stop_rgb(0.65, *mix(centre, edge, 0.5))
    g.add_color_stop_rgb(1, *edge)
    ctx.set_source(g)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()

def cloud(ctx, x, y, s=1.0, a=1.0):
    """outlined puffy cloud like the reference"""
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.new_path()
    ctx.move_to(-90, 20)
    ctx.curve_to(-110, 20, -112, -12, -84, -14)
    ctx.curve_to(-80, -44, -40, -50, -26, -28)
    ctx.curve_to(-14, -62, 40, -62, 44, -26)
    ctx.curve_to(70, -36, 96, -18, 88, 4)
    ctx.curve_to(108, 6, 108, 20, 90, 20)
    ctx.close_path()
    set_c(ctx, (0.985, 0.975, 0.955), a)
    ctx.fill_preserve()
    stroke_style(ctx, 3.2, hexrgb('#D2CEC4'), a)
    ctx.stroke()
    ctx.restore()

def scene_cam(ctx, k, cx, cy, clamp_x=True):
    """camera: scale k around view centre (cx,cy); never shows anything below the ground line"""
    hw, hh = 540 / k, 595 / k
    if clamp_x:
        cx = min(max(cx, hw), RW - hw)
    cy = min(max(cy, hh), RH - hh)
    ctx.translate(540, 595)
    ctx.scale(k, k)
    ctx.translate(-cx, -cy)


# ============================================================== scene 1: hook
T_GOOD = w0('s01', 'good')
T_LOOKUP = w0('s01', 'people')

def draw_hook(ctx, t):
    k = 1.0 + 0.04 * ease_sine(prog(t, 0, 2.6))
    ctx.save()
    scene_cam(ctx, k, 540, 640)
    bg_vignette(ctx, hexrgb('#F6F1E3'), hexrgb('#E7DFCB'), 520, 420, 100, 1050)
    cloud(ctx, 175 + t * 6, 560, 0.9, 0.95)
    cloud(ctx, 905 - t * 4, 455, 0.75, 0.9)
    bright = ease_out(prog(t, T_GOOD - 0.05, T_GOOD + 0.35))
    # light cone from the sun onto the two figures
    ctx.move_to(490, 410)
    ctx.line_to(590, 410)
    ctx.line_to(660, RH)
    ctx.line_to(150, RH)
    ctx.close_path()
    lg = cairo.LinearGradient(0, 410, 0, RH)
    lg.add_color_stop_rgba(0, 1, 0.96, 0.82, 0.55 + 0.2 * bright)
    lg.add_color_stop_rgba(1, 1, 0.96, 0.82, 0.22 + 0.15 * bright)
    ctx.set_source(lg)
    ctx.fill()
    sun(ctx, 540, 320, 86, t, bright)
    glow_ellipse(ctx, 405, RH - 4, 300, 34, (1, 0.9, 0.65), 0.55 + 0.25 * bright)
    # the two good people with halos
    for i, x in enumerate((330, 482)):
        info = person(ctx, x, RH, 1.0, fill=C['blue'],
                      pose=Pose(breath=breathe(t, 3.0, i * 0.4), head_dy=-2, la=0.2, ra=0.2))
        hx, hy = info['head']
        halo(ctx, hx, hy - 64, 40, 1.0, bright, t)
    # shade on the right (outside the light)
    lg = cairo.LinearGradient(640, 0, 900, 0)
    lg.add_color_stop_rgba(0, 0.55, 0.53, 0.58, 0.0)
    lg.add_color_stop_rgba(1, 0.55, 0.53, 0.58, 0.18)
    ctx.set_source(lg)
    ctx.rectangle(640, 0, 520, RH)
    ctx.fill()
    # grey man at a small table counting coins, head down -> slowly looks up
    look = ease_io(prog(t, T_LOOKUP, T_LOOKUP + 0.9))
    x = 868
    hip = 1112
    for dx in (-17, 17):
        ctx.move_to(x + dx, hip + 4)
        ctx.line_to(x + dx * 1.15, RH)
    stroke_style(ctx, 4.8, C['out'])
    ctx.stroke()
    top_tbl = 1048
    cnt = math.sin(t * 2 * math.pi / 0.85) * 4 * (1 - look)
    person(ctx, x, hip, 1.0, fill=C['grey'],
           pose=Pose(seated=True, arms_front=True, lhand_abs=(x - 30 + cnt, top_tbl - 10), rhand_abs=(x + 44 - cnt * 0.5, top_tbl - 10),
                     head_dx=lerp(5, -8, look), head_dy=lerp(15, -1, look), breath=breathe(t, 3.3)))
    for lx in (782, 958):
        ctx.rectangle(lx - 9, top_tbl + 10, 18, RH - top_tbl - 10)
        fill_stroke(ctx, C['wood_dk'], C['out'], 4.5)
    rrect(ctx, 760, top_tbl - 8, 222, 22, 7)
    fill_stroke(ctx, C['wood_lt'], C['out'], 4.5)
    coin_stack(ctx, 905, top_tbl - 2, 4, 13)
    coin(ctx, 842, top_tbl, 13)
    coin(ctx, 870, top_tbl + 2, 13)
    ctx.restore()


# ============================================================== scene 10: the doctor
D_IN = s0('s16') - 0.4
D_BED = w0('s16', 'sick') - 0.1
D_TOUCH = w0('s16', 'sick')
D_GO = s0('s17') + 0.05
D_RIGHT = w0('s17', 'righteous') - 0.1
D_SIN = w0('s17', 'sinners')
D_SIN2 = D_SIN + 0.5
D_OUT = s0('s18') - 0.3
D_CAM = [(D_IN, 380), (D_BED, 520), (D_RIGHT + 0.25, 600), (D_SIN - 0.05, 920), (D_OUT + 0.6, 1010)]
D_K = 1.3
BED = (560, 870)

def d_cam(t):
    keys = D_CAM
    if t <= keys[0][0]:
        return keys[0][1]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            return lerp(a[1], b[1], ease_io(prog(t, a[0], b[0])))
    return keys[-1][1]

def jesus_doctor_x(t):
    if t < D_BED:
        u = prog(t, D_IN, D_BED)
        x = lerp(-170, 502, ease_out(u) * 0.25 + u * 0.75)
        return x, (abs(x + 170) / 66 * math.pi if 0 < u < 1 else None)
    if t < D_GO:
        return 502, None
    if t < D_SIN - 0.2:
        u = prog(t, D_GO, D_SIN - 0.2)
        x = lerp(502, 1000, ease_io(u))
        return x, (abs(x - 502) / 66 * math.pi if 0 < u < 1 else None)
    u = prog(t, D_SIN + 0.12, D_SIN2 - 0.05)
    x = lerp(1000, 1168, ease_io(u))
    return x, (abs(x - 1000) / 66 * math.pi if 0 < u < 1 else None)

def proud(ctx, x, t, i, halo_t):
    info = person(ctx, x, RH, 1.0, fill=C['blue'],
                  pose=Pose(lhand_abs=(x - 44, RH - 170), rhand_abs=(x + 44, RH - 170), lbulge=34, rbulge=34,
                            head_dy=-6, head_dx=(4 if i else -3), chest_out=1.0, lean=(-0.03 if i else 0.03),
                            breath=breathe(t, 3.2, i * 0.5)))
    if t >= halo_t:
        k = pop(t, halo_t, 0.4)
        hx, hy = info['head']
        ctx.save()
        ctx.translate(hx, hy - 64)
        ctx.scale(k, k)
        halo(ctx, 0, 0, 40, 1.0, 0.5 + 0.5 * math.sin(math.pi * prog(t, halo_t, halo_t + 0.8)), t)
        ctx.restore()

def sick_in_bed(ctx, t):
    heal = ease_sine(prog(t, D_TOUCH + 0.15, D_TOUCH + 0.7))
    sit = ease_io(prog(t, D_TOUCH + 0.45, D_TOUCH + 1.1))
    x0, x1 = BED
    col = mix(C['grey'], C['blue'], heal)
    # headboard / footboard
    rrect(ctx, x0 - 14, 1000, 26, RH - 1000, 6)
    fill_stroke(ctx, C['wood'], C['out'], 4.5)
    rrect(ctx, x1 - 12, 1060, 24, RH - 1060, 6)
    fill_stroke(ctx, C['wood'], C['out'], 4.5)
    # mattress
    rrect(ctx, x0, 1090, x1 - x0, 46, 10)
    fill_stroke(ctx, C['bed'], C['out'], 4.5)
    ctx.rectangle(x0 + 20, 1136, 12, RH - 1136)
    ctx.rectangle(x1 - 32, 1136, 12, RH - 1136)
    fill_stroke(ctx, C['wood_dk'], C['out'], 4)
    # pillow
    rrect(ctx, x0 + 14, 1058, 82, 40, 16)
    fill_stroke(ctx, (0.99, 0.985, 0.975), C['out'], 4.5)
    # the man: torso pivots from lying to sitting up
    ang = lerp(-math.pi / 2 + 0.04, -0.18, sit)
    ctx.save()
    ctx.translate(x0 + 178, 1086)
    ctx.rotate(ang)
    person(ctx, 0, 0, 0.92, fill=col, pose=Pose(seated=True, la=0.15, ra=0.15, head_dy=-2, breath=breathe(t, 2.2) * 2))
    ctx.restore()
    # blanket over the legs/body
    bx0 = lerp(x0 + 90, x0 + 160, sit)
    ctx.move_to(bx0, 1092)
    ctx.curve_to(bx0 + 10, 1046, x1 - 60, 1040, x1 - 8, 1060)
    ctx.line_to(x1 - 8, 1112)
    ctx.line_to(bx0 - 6, 1112)
    ctx.close_path()
    fill_stroke(ctx, mix(hexrgb('#B8B6C0'), C['blanket'], heal), C['out'], 4.5)
    # sparkles on healing
    u = prog(t, D_TOUCH + 0.1, D_TOUCH + 1.0)
    if 0 < u < 1:
        for i in range(5):
            a = math.sin(math.pi * clamp01(u * 1.4 - i * 0.08))
            star4(ctx, x0 + 120 + i * 34, 1010 - (i % 2) * 30 - u * 40, 9, C['gold_line'], a)

def slumped(ctx, x, t, touch_t, i):
    heal = ease_sine(prog(t, touch_t + 0.05, touch_t + 0.6))
    lift = ease_io(prog(t, touch_t + 0.15, touch_t + 0.75))
    col = mix(C['grey'], C['blue'], heal)
    hip = RH - 6
    # knees-up legs
    for side in (-1, 1):
        ctx.move_to(x + side * 15, hip)
        ctx.line_to(x + side * 36, hip - 70)
        ctx.line_to(x + side * 44, RH)
    stroke_style(ctx, 4.8, C['out'])
    ctx.stroke()
    ctx.save()
    ctx.translate(x, hip)
    ctx.scale(1, lerp(0.86, 0.98, lift))
    person(ctx, 0, 0, 0.95, fill=col,
           pose=Pose(seated=True, arms_front=True, lhand_abs=(-30, -66), rhand_abs=(30, -66), lbulge=8, rbulge=8,
                     head_dy=lerp(22, 0, lift), head_dx=lerp(4 if i else -4, 0, lift), breath=breathe(t, 2.5, i * 0.3)))
    ctx.restore()

def draw_doctor(ctx, t):
    cx = d_cam(t)
    g = cairo.LinearGradient(0, 0, 0, RH)
    g.add_color_stop_rgb(0, *hexrgb('#F4E9D2'))
    g.add_color_stop_rgb(1, *hexrgb('#EFE2C8'))
    ctx.set_source(g)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()
    glow(ctx, 640, 300, 700, (1, 0.97, 0.88), 0.7)
    # far sky (slow parallax): sun + clouds
    sun(ctx, 905, 168, 46, t, 0.0, 16, 0.75)
    par = (cx - 380) * 0.25
    for x0 in (-200, 420, 1040, 1660):
        cloud(ctx, x0 + 150 - par, 520, 0.8, 0.9)
    ctx.save()
    scene_cam(ctx, D_K, cx, RH, clamp_x=False)
    proud(ctx, 238, t, 0, D_RIGHT)
    proud(ctx, 384, t, 1, D_RIGHT + 0.12)
    sick_in_bed(ctx, t)
    slumped(ctx, 1096, t, D_SIN, 0)
    slumped(ctx, 1262, t, D_SIN2, 1)
    # Jesus with a doctor's bag
    jx, ph = jesus_doctor_x(t)
    reach = 0.0
    tgt = None
    for tt, (hx, hy) in ((D_TOUCH, (BED[0] + 72, 1050)), (D_SIN, (1096, 1100)), (D_SIN2, (1262, 1100))):
        r = ease_io(prog(t, tt - 0.3, tt)) * (1 - ease_io(prog(t, tt + 0.35, tt + 0.6)))
        if r > reach:
            reach, tgt = r, (hx, hy)
    pose = Pose(walk=ph, head_dx=6, breath=breathe(t, 3.4), stride=0.9)
    if tgt is not None and reach > 0:
        top_y = RH - 46 - 250
        sh = (jx + 40, top_y + 18)
        rest = (sh[0] + 27, sh[1] + 123)
        pose.rhand_abs = (lerp(rest[0], tgt[0] - 8, reach), lerp(rest[1], tgt[1] - 10, reach))
        pose.rbulge = 10
    jesus(ctx, jx, RH, 1.0, pose=pose, t=t, bag=1.0, bag_side='left')
    # touch glow
    for tt, (hx, hy) in ((D_TOUCH, (BED[0] + 72, 1050)), (D_SIN, (1096, 1100)), (D_SIN2, (1262, 1100))):
        u = prog(t, tt - 0.05, tt + 0.6)
        if 0 < u < 1:
            glow(ctx, hx, hy - 20, 170, (1, 0.93, 0.7), 0.8 * math.sin(math.pi * u))
    ctx.restore()

def labels_doctor(ctx, t):
    a = ease_sine(prog(t, D_IN + 0.35, D_IN + 0.75)) * (1 - ease_sine(prog(t, D_OUT - 0.2, D_OUT + 0.3)))
    label(ctx, 'MARK 2:17', 292, a)


# ============================================================== scene 11: Oscar Wilde
Q_IN = s0('s18') - 0.3
Q_TITLE = s0('s18') + 0.08
Q_SAINT = w0('s19', 'saint')
Q_PAST = w0('s19', 'past')
Q_FUT = w0('s19', 'future')
Q_WALK0 = w0('s19', 'and') + 0.1
Q_OUT = s0('s20') - 0.35

def path_pt(u):
    """centre line of the path, u=0 near (bottom left) .. 1 far (horizon)"""
    x = lerp(250, 790, u) + math.sin(u * math.pi * 1.2) * 90
    y = lerp(RH + 10, 742, ease_out(u) * 0.35 + u * 0.65)
    w = lerp(300, 26, u)
    return x, y, w

def draw_quote(ctx, t):
    dark = ease_sine(prog(t, Q_PAST - 0.1, Q_PAST + 0.5))
    fut = ease_sine(prog(t, Q_FUT - 0.15, Q_FUT + 0.5))
    k = 1.0 + 0.05 * ease_sine(prog(t, Q_IN, Q_OUT + 0.4))
    ctx.save()
    scene_cam(ctx, k, 540, 700)
    # dusty lavender sky + land
    g = cairo.LinearGradient(0, 0, 0, RH)
    g.add_color_stop_rgb(0, *hexrgb('#8A8693'))
    g.add_color_stop_rgb(0.6, *hexrgb('#99959F'))
    g.add_color_stop_rgb(1, *hexrgb('#8E8A96'))
    ctx.set_source(g)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()
    # night sky over the past (moon, twinkling stars) ... dawn over the future
    moon(ctx, 190, 470, 44, 1.0 - 0.4 * fut)
    srnd = random.Random(5)
    for i in range(16):
        sx, sy = srnd.uniform(40, 1040), srnd.uniform(400, 700)
        if 600 < sx and sy > 560:
            continue
        tw = 0.45 + 0.55 * math.sin(t * (1.6 + srnd.random()) + i * 2.1) ** 2
        star4(ctx, sx, sy, 6 + 4 * srnd.random(), C['gold_line'], tw * (1 - 0.5 * fut))
    # dawn at the far end of the path
    glow(ctx, 800, 742, 520 + 120 * fut, (1, 0.9, 0.62), 0.55 + 0.35 * fut)
    glow(ctx, 800, 742, 180 + 60 * fut, (1, 0.97, 0.86), 0.8)
    # land below the horizon
    ctx.move_to(0, 760)
    ctx.curve_to(300, 735, 600, 748, 1080, 730)
    ctx.line_to(1080, RH)
    ctx.line_to(0, RH)
    ctx.close_path()
    set_c(ctx, hexrgb('#7F7B88'))
    ctx.fill()
    ctx.move_to(0, 760)
    ctx.curve_to(300, 735, 600, 748, 1080, 730)
    stroke_style(ctx, 3.0, mix(hexrgb('#7F7B88'), C['out'], 0.4))
    ctx.stroke()
    # the path: muddy behind, glowing ahead
    N = 60
    left = [path_pt(i / N) for i in range(N + 1)]
    split = 0.42
    def band(u0, u1):
        a = [(x - w / 2, y) for (x, y, w) in (path_pt(u0 + (u1 - u0) * i / 24) for i in range(25))]
        b = [(x + w / 2, y) for (x, y, w) in (path_pt(u1 - (u1 - u0) * i / 24) for i in range(25))]
        ctx.move_to(*a[0])
        for p in a[1:] + b:
            ctx.line_to(*p)
        ctx.close_path()
    band(0.0, split)
    set_c(ctx, mix(C['mud'], C['mud_dk'], dark))
    ctx.fill_preserve()
    stroke_style(ctx, 4.0, C['out'])
    ctx.stroke()
    # puddles + footprints in the mud
    for (u, dx, rx) in ((0.08, -60, 46), (0.2, 40, 34), (0.31, -20, 24)):
        x, y, w = path_pt(u)
        ellipse(ctx, x + dx, y, rx, rx * 0.28)
        set_c(ctx, mix(hexrgb('#5A5059'), hexrgb('#4A4148'), dark))
        ctx.fill()
    fp = ease_out(prog(t, Q_PAST - 0.2, Q_PAST + 0.6))
    for i in range(6):
        u = 0.05 + i * 0.06
        x, y, w = path_pt(u)
        side = -1 if i % 2 else 1
        ellipse(ctx, x + side * w * 0.12, y, 13 * (1 - u * 0.8), 6 * (1 - u * 0.8))
        set_c(ctx, hexrgb('#3E3631'), 0.6 * fp)
        ctx.fill()
    band(split, 1.0)
    g = cairo.LinearGradient(*path_pt(split)[:2], *path_pt(1.0)[:2])
    g.add_color_stop_rgb(0, *mix(hexrgb('#E8D7A8'), C['path_lt'], fut))
    g.add_color_stop_rgb(1, 1, 0.97, 0.86)
    ctx.set_source(g)
    ctx.fill_preserve()
    stroke_style(ctx, 3.5, mix(C['gold_line'], C['out'], 0.3))
    ctx.stroke()
    # soft glow along the bright path
    for i in range(7):
        u = split + 0.05 + i * 0.08
        x, y, w = path_pt(min(u, 0.99))
        glow(ctx, x, y, 90 + w * 0.6, (1, 0.93, 0.7), (0.30 + 0.35 * fut) * (1 - i * 0.06))
    # sparkles along the bright path
    for i in range(9):
        u = split + 0.06 + i * 0.06
        x, y, w = path_pt(min(u, 0.98))
        a = (0.35 + 0.65 * fut) * (0.5 + 0.5 * math.sin(t * 3 + i * 1.3))
        star4(ctx, x + (12 if i % 2 else -12), y - 18, 7 + 4 * fut, (1, 0.92, 0.55), a)
    # the walker
    wu = prog(t, Q_WALK0, Q_OUT + 0.4)
    u = lerp(split - 0.02, split + 0.17, ease_io(wu))
    x, y, w = path_pt(u)
    s = lerp(0.82, 0.62, (u - split + 0.02) / 0.19)
    blue = ease_sine(prog(t, Q_FUT - 0.1, Q_FUT + 0.7))
    ph = wu * 7 * math.pi if 0 < wu < 1 else None
    glow(ctx, x, y - 190 * s, 220 * s, (1, 0.93, 0.72), 0.45 * fut)
    info = person(ctx, x, y, s, fill=mix(C['grey'], C['blue'], blue), pose=Pose(walk=ph, head_dx=6, breath=breathe(t, 3.0)))
    if t >= Q_SAINT:
        hx, hy = info['head']
        ctx.save()
        kk = pop(t, Q_SAINT, 0.4)
        ctx.translate(hx, hy - 62 * s)
        ctx.scale(kk * s, kk * s)
        halo(ctx, 0, 0, 40, 1.0, 0.3, t)
        ctx.restore()
    ctx.restore()

def labels_quote(ctx, t):
    a = 1 - ease_sine(prog(t, Q_OUT - 0.1, Q_OUT + 0.35))
    if t >= Q_TITLE:
        title_emboss(ctx, 'OSCAR WILDE', 540, 326, 104, a, pop(t, Q_TITLE, 0.45))


# ============================================================== scene 12: the twist (Bible)
B_IN = s0('s20') - 0.35
B_FIG = s0('s20') - 0.2
B_ICON = s0('s20') + 0.15
B_BOOK = w0('s21a', 'first')
B_NAME = w0('s21b', 'matthew') - 0.04
B_OUT = s0('s22') - 0.35

def draw_bible(ctx, t):
    warm = ease_sine(prog(t, B_NAME, B_NAME + 0.8))
    k = 1.0 + 0.05 * ease_io(prog(t, B_BOOK, B_NAME + 0.5))
    ctx.save()
    scene_cam(ctx, k, 560, 700)
    bg_vignette(ctx, mix(hexrgb('#9B97A3'), hexrgb('#F6EBD3'), warm), mix(hexrgb('#85818D'), hexrgb('#E9DCC0'), warm),
                600, 640, 80, 1000)
    srnd = random.Random(9)
    for i in range(12):
        sx, sy = srnd.uniform(40, 1040), srnd.uniform(130, 1000)
        if math.hypot(sx - 620, sy - 610) < 420:
            continue
        tw = 0.4 + 0.6 * math.sin(t * (1.4 + srnd.random()) + i * 1.7) ** 2
        star4(ctx, sx, sy, 6 + 4 * srnd.random(), C['gold_line'], tw * (1 - warm) * 0.9)
    title_a = ease_out(prog(t, B_NAME, B_NAME + 0.3))
    glowk = 0.5 * ease_sine(prog(t, B_BOOK, B_BOOK + 0.6)) + 0.5 * title_a
    bible_icon(ctx, 620, 610, 290, scale=pop(t, B_ICON, 0.45), t=t, title='MATTHEW', title_a=title_a,
               disc=mix(hexrgb('#C9BCAB'), hexrgb('#F1E2C2'), warm), rays=0.85 + 0.15 * glowk)
    if title_a > 0:
        u = prog(t, B_NAME, B_NAME + 1.2)
        for i in range(8):
            a = math.sin(math.pi * clamp01(u * 1.3 - i * 0.05))
            ang = i / 8 * 2 * math.pi
            star4(ctx, 620 + math.cos(ang) * (340 + 40 * u), 610 + math.sin(ang) * (340 + 40 * u), 11, C['gold_line'], a)
    # the tax collector (Matthew) beside the book; a single coin falls away
    fx = lerp(-90, 150, ease_out(prog(t, B_FIG, B_FIG + 0.8)))
    ph = (abs(fx + 80) / 60 * math.pi) if t < B_FIG + 0.8 else None
    blue = ease_sine(prog(t, B_NAME + 0.1, B_NAME + 0.8))
    top = RH - 140 * 1.12 - 150 * 1.12
    hold = (fx + 74, top + 130)
    pose = Pose(walk=ph, head_dx=6, head_dy=lerp(4, -2, blue), breath=breathe(t, 3.1), rhand_abs=hold, rbulge=12)
    person(ctx, fx, RH, 1.12, fill=mix(C['grey'], C['blue'], blue), pose=pose,
           hat=dict(col=hexrgb('#3E3A44'), tilt=-0.12), beard=True)
    cu = prog(t, B_NAME + 0.05, B_NAME + 0.65)
    if cu <= 0:
        coin(ctx, hold[0] + 6, hold[1] + 8, 13, flat=0.2, rot=0.2)
    elif cu < 1:
        coin(ctx, hold[0] + 6 + 40 * cu, lerp(hold[1] + 8, RH - 8, cu * cu), 13, flat=0.3 + 0.2 * math.cos(cu * 12), rot=cu * 6)
    else:
        b = prog(t, B_NAME + 0.65, B_NAME + 1.6)
        coin(ctx, hold[0] + 46 + 90 * ease_out(b), RH - 8 - math.sin(math.pi * min(1, b * 2)) * 14 * (1 - b), 13,
             flat=0.4 + 0.6 * ease_out(b), rot=(1 - b) * 3)
    ctx.restore()

def coin_drop_times():
    return [B_NAME + 0.65, B_NAME + 0.65 + 0.5]
