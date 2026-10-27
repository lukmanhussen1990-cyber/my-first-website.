"""Caravaggio's 'The Calling of Saint Matthew' as a line-art room: scenes 2-9 (gallery, zoom, story) and 13 (ending)."""
import math, random
import cairo
from gfx import *
from T import w0, w1, s0, s1, TOTAL

RW, RH = W, GROUND                    # room space = scene area at identity camera
WIN = (300, 400, 340, 212)            # window opening
TX0, TX1 = 18, 640                    # table extent
TOP = 955                             # table top surface
SEAT_HIP = 1026
SS = 1.25                             # seated figure scale
SEATS = {'m1': 100, 'm2': 242, 'm3': 384, 'mt': 526}
JX, JS = 862, 1.35
PX, PS = 1018, 1.25
PILE = (588, TOP - 2)
SKIN = hexrgb('#EDCFB3')
SEPIA = hexrgb('#8C5A3C')
GREEN_GLOW = hexrgb('#BFE6C9')

# ---------------------------------------------------------------- key times (all keyed to the voice)
T_PAINT_IN = s0('s02') - 0.46
T_MAG0 = s0('s03') - 0.2
T_Q = w0('s03', 'secret') - 0.02
T_PAUSE0 = s1('s03') + 0.08
T_ZOOM0 = s1('s03') + 0.86
T_ZOOM1 = T_ZOOM0 + 1.05
T_LBL_C0, T_LBL_C1 = T_ZOOM1 + 0.05, s1('s04') - 0.2
G0 = s1('s04') + 0.05                         # room turns grey
TP0 = s0('s05') + 0.15                        # townspeople arrive
TP_POINT = w0('s05', 'tax')
T_THIEF = w0('s05', 'hated')
T_TRAITOR = T_THIEF + 0.45
T_BUB_OUT = s1('s06')
PM0 = s0('s06') - 0.25                        # poor man walks in
PM_COIN = [PM0 + 0.95 + i * 0.24 for i in range(3)]
T_LEAVE = w0('s07', 'nobody') + 0.1
E0, E1 = s0('s08') - 0.35, s1('s08') - 0.1    # Jesus walks in
FL0 = w0('s08', 'walked')                     # light spreads on the floor
WARM0 = FL0 + 0.2
MAG_A, MAG_B = s0('s09') - 0.05, s1('s09') - 0.05
RC0 = MAG_B + 0.08
RC1 = RC0 + 0.55
EXP0 = w0('s10', 'hand')
EXP1 = EXP0 + 0.6
ADAM0 = w0('s10', 'same') - 0.15
ADAM1 = ADAM0 + 0.75
ALIGN0 = w0('s10', "adam's") - 0.25
ALIGN1 = ALIGN0 + 0.55
T_LBL_M = w0('s10', "michelangelo's")
FLASH0 = w0('s10', 'famous')
FLASH1 = s0('s11') - 0.12
T_THIS_MAN = w0('s11', 'this')
GREEN0 = w0('s11', 'new')
RX0 = w0('s12a', 'window')
BEAM_UP = w0('s12b', 'with') - 0.15
PULSE0 = w0('s12b', 'with')
CAM8_0 = s0('s13a')
PT0 = w0('s13a', 'points')
T_ME = w0('s13b', 'me') - 0.03
OUT8 = s0('s14a') - 0.25
T_LBL_MT = s0('s14a') + 0.1
T_QI = w0('s14a', 'says') + 0.05
T_FM = w0('s14b', 'follow')
UP0 = w0('s15', 'got') - 0.08
UP1 = UP0 + 0.5
BLUE0, BLUE1 = UP0 + 0.3, UP0 + 1.1
WALK1 = s1('s15') - 0.15
WO0, WO1 = WALK1, WALK1 + 1.45
ROOM_END = s0('s16') + 0.15

# scene 13
E_IN = s0('s22') - 0.35
TURN0 = s0('s23')
TURN1 = TURN0 + 1.0
PCAM0 = w0('s24', 'and') - 0.5
PCAM1 = w0('s24', 'pointing') + 0.3
BLOOM0 = w0('s24', 'you') - 0.1
BLOOM1 = BLOOM0 + 0.9
EC0 = s1('s24') + 0.4


# ---------------------------------------------------------------- camera
def _cam_keys():
    k = [
        (0.0, 1.0, 540, 595), (T_ZOOM1, 1.0, 540, 595), (G0, 1.03, 470, 760), (G0 + 6.2, 1.04, 470, 720),
        (E0 + 0.1, 1.0, 540, 595), (FLASH1 - 0.001, 1.0, 540, 595), (FLASH1, 1.42, 540, 840),
        (s1('s11') + 0.1, 1.6, 540, 830), (s0('s12a') - 0.3, 1.6, 540, 830), (s0('s12a') + 0.5, 1.0, 540, 595),
        (CAM8_0, 1.0, 540, 595), (PT0 + 0.1, 1.45, 500, 800), (OUT8, 1.45, 500, 800),
        (s0('s14a') + 0.6, 1.0, 540, 595), (ROOM_END + 1, 1.0, 540, 595),
    ]
    return k
CAM_KEYS = _cam_keys()

def cam(t, keys=None):
    keys = keys or CAM_KEYS
    if t <= keys[0][0]:
        k, cx, cy = keys[0][1:]
    elif t >= keys[-1][0]:
        k, cx, cy = keys[-1][1:]
    else:
        for a, b in zip(keys, keys[1:]):
            if a[0] <= t <= b[0]:
                u = ease_io(prog(t, a[0], b[0]))
                k = math.exp(lerp(math.log(a[1]), math.log(b[1]), u))
                cx, cy = lerp(a[2], b[2], u), lerp(a[3], b[3], u)
                break
    hw, hh = 540 / k, 595 / k
    cx = min(max(cx, hw), RW - hw)
    cy = min(max(cy, hh), RH - hh)
    return k, cx, cy

def apply_cam(ctx, k, cx, cy):
    ctx.translate(540, 595)
    ctx.scale(k, k)
    ctx.translate(-cx, -cy)


# ---------------------------------------------------------------- state helpers
def mood_grey(t, mode):
    if mode != 'live':
        return 0.0
    return ease_sine(prog(t, G0, G0 + 0.7)) * (1 - ease_sine(prog(t, WARM0, WARM0 + 1.2)))

def walk_x(t, t0, t1, x0, x1, stride=68.0, ease=ease_io):
    """position + walk phase while moving between x0 and x1"""
    u = prog(t, t0, t1)
    x = lerp(x0, x1, ease(u))
    moving = 0.0 < u < 1.0
    ph = abs(x - x0) / stride * math.pi if moving else None
    return x, ph

def beam_level(t, mode):
    if mode == 'end':
        return 0.55 + 0.45 * ease_sine(prog(t, BLOOM0 - 0.6, BLOOM0 + 0.2))
    if mode == 'painting':
        return 0.55
    b = 0.55
    b = lerp(b, 0.06, ease_sine(prog(t, G0, G0 + 0.7)))
    b = lerp(b, 0.55, ease_sine(prog(t, WARM0 + 0.2, WARM0 + 1.3)))
    b = lerp(b, 0.95, ease_sine(prog(t, BEAM_UP, BEAM_UP + 0.6)))
    b = lerp(b, 0.62, ease_sine(prog(t, PULSE0 + 1.3, PULSE0 + 2.0)))
    return b

BEAM_POLY = [(1110, 520), (1110, 840), (-20, 1100), (-20, 760)]

def beam_edges(x):
    u = (1110 - x) / 1130
    (ax, ay), (bx, by), (cx_, cy_), (dx, dy) = BEAM_POLY
    return lerp(ay, dy, u), lerp(by, cy_, u)

def _beam_shape(ctx, grow=0.0):
    (ax, ay), (bx, by), (cx_, cy_), (dx, dy) = BEAM_POLY
    ctx.move_to(ax, ay - grow)
    ctx.line_to(bx, by + grow)
    ctx.line_to(cx_, cy_ + grow)
    ctx.line_to(dx, dy - grow)
    ctx.close_path()

def draw_beam(ctx, level, t, over=False):
    if level <= 0.01:
        return
    # layered soft band: wide/faint -> narrow/bright, brighter near the source (right)
    for grow, a in ((60, 0.16), (30, 0.22), (0, 0.32)):
        _beam_shape(ctx, grow)
        g = cairo.LinearGradient(1100, 680, 0, 930)
        col = C['beam']
        k = level * (0.55 if over else 1.0)
        g.add_color_stop_rgba(0.0, *col, a * k * 1.25)
        g.add_color_stop_rgba(0.55, *col, a * k * 0.95)
        g.add_color_stop_rgba(1.0, *col, a * k * 0.55)
        ctx.set_source(g)
        ctx.fill()

def draw_dust(ctx, t, level):
    if level <= 0.05:
        return
    rnd = random.Random(7)
    for i in range(34):
        u0 = rnd.random()
        v = rnd.random()
        sp = 0.012 + 0.02 * rnd.random()
        u = (u0 + t * sp) % 1.0
        # position along the beam (from right/source to left)
        x = lerp(1080, 0, u)
        top, bot = beam_edges(x)
        y = lerp(top + 20, bot - 20, v) + 10 * math.sin(t * 0.7 + i)
        a = (0.35 + 0.35 * math.sin(t * 2.1 + i * 1.7)) * level
        r = 1.8 + 2.2 * rnd.random()
        circle(ctx, x, y, r)
        set_c(ctx, (1, 0.97, 0.86), max(0.0, a))
        ctx.fill()


# ---------------------------------------------------------------- room pieces
def wall_cols(g):
    base = mix(hexrgb('#CFC1AC'), hexrgb('#9D99A6'), g)
    top = mix(hexrgb('#B3A48E'), hexrgb('#85818E'), g)
    return base, top

def draw_wall(ctx, g):
    base, top = wall_cols(g)
    lg = cairo.LinearGradient(0, 0, 0, RH)
    lg.add_color_stop_rgb(0, *top)
    lg.add_color_stop_rgb(0.6, *base)
    lg.add_color_stop_rgb(1, *mix(base, (1, 1, 1), 0.05))
    ctx.set_source(lg)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()
    # faint plaster texture lines (very subtle, like the reference's stone lines)
    rnd = random.Random(3)
    for i in range(9):
        x = rnd.uniform(40, 1040)
        y = rnd.uniform(120, 760)
        L = rnd.uniform(60, 140)
        ctx.move_to(x, y)
        ctx.line_to(x + L, y)
    stroke_style(ctx, 2.0, mix(base, C['out'], 0.12), 0.55)
    ctx.stroke()

def draw_window(ctx, t, g, mode, x_red=0.0):
    x, y, w, h = WIN
    wood = mix(C['wood'], hexrgb('#7E7886'), g * 0.5)
    wood_dk = mix(C['wood_dk'], hexrgb('#6B6573'), g * 0.5)
    # open shutters (perspective panels)
    for side in (-1, 1):
        ex = x if side < 0 else x + w
        ox = ex + side * 96
        ctx.move_to(ex + side * 16, y - 14)
        ctx.line_to(ox + side * 16, y + 8)
        ctx.line_to(ox + side * 16, y + h - 8)
        ctx.line_to(ex + side * 16, y + h + 14)
        ctx.close_path()
        fill_stroke(ctx, wood, C['out'], 4.5)
        for k in (0.33, 0.66):
            px = lerp(ex + side * 16, ox + side * 16, k)
            ctx.move_to(px, lerp(y - 14, y + 8, k) + 6)
            ctx.line_to(px, lerp(y + h + 14, y + h - 8, k) - 6)
        stroke_style(ctx, 2.5, wood_dk)
        ctx.stroke()
    # frame
    rrect(ctx, x - 16, y - 16, w + 32, h + 32, 5)
    fill_stroke(ctx, wood_dk, C['out'], 4.5)
    # opening: pale daylight sky (dim, not the light source)
    ctx.rectangle(x, y, w, h)
    lg = cairo.LinearGradient(0, y, 0, y + h)
    lg.add_color_stop_rgb(0, *mix(hexrgb('#D9DCE6'), hexrgb('#B9B7C3'), g))
    lg.add_color_stop_rgb(1, *mix(hexrgb('#E6E3E0'), hexrgb('#C4C1C8'), g))
    ctx.set_source(lg)
    ctx.fill()
    # distant rooftops outside
    ctx.save()
    ctx.rectangle(x, y, w, h)
    ctx.clip()
    roof = mix(hexrgb('#CBC6C0'), hexrgb('#ADA9B3'), g)
    ctx.move_to(x, y + h)
    for px, py in ((x, y + 165), (x + 60, y + 150), (x + 60, y + 128), (x + 120, y + 100), (x + 180, y + 128),
                   (x + 180, y + 160), (x + 250, y + 160), (x + 250, y + 120), (x + 310, y + 120), (x + 330, y + 138),
                   (x + w, y + 138), (x + w, y + h)):
        ctx.line_to(px, py)
    ctx.close_path()
    fill_stroke(ctx, roof, mix(roof, C['out'], 0.25), 2.5)
    if mode == 'live':
        draw_townspeople(ctx, t)
    ctx.restore()
    # mullions
    ctx.rectangle(x + w / 2 - 7, y, 14, h)
    ctx.rectangle(x, y + h * 0.2 - 7, w, 14)
    fill_stroke(ctx, wood_dk, C['out'], 3.5)
    ctx.rectangle(x, y, w, h)
    stroke_style(ctx, 4.5, C['out'])
    ctx.stroke()
    # sill
    rrect(ctx, x - 30, y + h + 12, w + 60, 18, 4)
    fill_stroke(ctx, wood, C['out'], 4.5)
    if x_red > 0:
        red_x(ctx, x + w / 2, y + h / 2, 92, x_red, lw=11)

def draw_townspeople(ctx, t):
    if t < TP0 or t > T_LEAVE + 1.2:
        return
    a_in = ease_out(prog(t, TP0, TP0 + 0.6))
    out_u = prog(t, T_LEAVE, T_LEAVE + 1.0)
    pt = ease_out(prog(t, TP_POINT, TP_POINT + 0.3)) * (1 - ease_io(prog(t, T_LEAVE - 0.05, T_LEAVE + 0.2)))
    gy = 772
    s = 0.85
    for i, (xin, xstart, xout) in enumerate(((418, 262, 200), (568, 700, 770))):
        x = lerp(xstart, xin, a_in)
        ph = None
        if 0 < a_in < 1:
            ph = abs(x - xstart) / 55 * math.pi
        face = -1
        if out_u > 0:
            x = lerp(xin, xout, ease_in(out_u) * 0.6 + out_u * 0.4)
            ph = out_u * 9
            face = -1 if i == 0 else 1
        # arm pointing down-left into the room
        sh = (x - 35, gy - 140 * s - 150 * s + 16 * s)
        tgt = (lerp(x - 40, x - 88, pt), lerp(sh[1] + 75, sh[1] + 40, pt))
        pose = Pose(walk=ph, lhand_abs=tgt, lbulge=4 if pt > 0.5 else 14, head_dx=6 * face, arms_front=pt > 0.3,
                    breath=breathe(t, 2.9, i * 0.3))
        info = person(ctx, x, gy, s, fill=C['grey'], pose=pose)
        if pt > 0.6:
            hx, hy = info['lhand']
            d = (tgt[0] - sh[0], tgt[1] - sh[1])
            ang = math.atan2(-d[1], -d[0])
            hand(ctx, hx, hy, 0.42, ang, 'point', fill=C['grey'], line=C['out'], lw=3.4)

LEGS_X = (52, 606)

def draw_table(ctx, g):
    wood = mix(C['wood'], hexrgb('#85808A'), g * 0.4)
    wood_dk = mix(C['wood_dk'], hexrgb('#6A6570'), g * 0.4)
    wood_lt = mix(C['wood_lt'], hexrgb('#A7A2AC'), g * 0.4)
    for lx in LEGS_X:
        ctx.rectangle(lx - 12, TOP + 50, 24, RH - TOP - 50)
        fill_stroke(ctx, wood_dk, C['out'], 4.5)
    rrect(ctx, TX0 + 14, TOP + 8, TX1 - TX0 - 28, 66, 5)
    fill_stroke(ctx, wood, C['out'], 4.5)
    ctx.move_to(TX0 + 30, TOP + 42)
    ctx.line_to(TX1 - 30, TOP + 42)
    stroke_style(ctx, 2.2, wood_dk, 0.8)
    ctx.stroke()
    rrect(ctx, TX0, TOP - 9, TX1 - TX0, 21, 7)
    fill_stroke(ctx, wood_lt, C['out'], 4.5)

def seated_legs(ctx, x, s=SS, col=None):
    for dx in (-17, 17):
        ctx.move_to(x + dx * s, SEAT_HIP + 4)
        ctx.line_to(x + dx * s * 1.15, RH)
    stroke_style(ctx, 4.8 * s, col or C['out'])
    ctx.stroke()

LOOSE = ((70, TOP - 1, 14), (148, TOP + 1, 14), (205, TOP - 1, 14), (300, TOP, 14), (452, TOP + 1, 14))
STACK = (322, TOP - 1, 3)

def draw_coins_table(ctx, t, mode, pile_n, loose=True):
    if loose:
        for (x, y, r) in LOOSE:
            coin(ctx, x, y, r)
        coin_stack(ctx, STACK[0], STACK[1], STACK[2], 14)
    if pile_n > 0:
        coin_stack(ctx, PILE[0], PILE[1], pile_n, 15)
        if pile_n >= 3:
            coin(ctx, PILE[0] + 32, PILE[1] + 2, 14)

def coin_glint(ctx, t, t0):
    u = prog(t, t0, t0 + 0.9)
    if 0 < u < 1:
        for i, (x, y) in enumerate(((STACK[0], TOP - 30), (PILE[0] + 6, PILE[1] - 34), (148, TOP - 16))):
            uu = clamp01(u * 1.6 - i * 0.25)
            a = math.sin(math.pi * uu)
            star4(ctx, x, y, 10 + 7 * a, (1, 0.93, 0.6), a)

STAND_X = 704
STAND_HIP = RH - 140 * SS

def matthew_state(t, mode):
    """position / posture of Matthew (the bearded tax collector)"""
    st = dict(x=SEATS['mt'], seated=True, hip=SEAT_HIP, walk=None, blue=0.0, point=0.0, green=0.0, alpha=1.0)
    if mode != 'live':
        return st
    st['green'] = ease_sine(prog(t, GREEN0, GREEN0 + 0.6)) * (1 - ease_sine(prog(t, s0('s12a') + 0.2, s0('s12a') + 1.0)))
    st['point'] = ease_back(prog(t, PT0, PT0 + 0.35), 1.2) * (1 - ease_io(prog(t, OUT8 + 0.1, OUT8 + 0.5)))
    if t >= UP0:
        u = ease_io(prog(t, UP0, UP1))
        st['x'] = lerp(SEATS['mt'], STAND_X - 12, u)
        st['hip'] = lerp(SEAT_HIP, STAND_HIP, u)
        st['seated'] = u < 0.45
        st['walk'] = (u * 2.4) * math.pi if 0.45 <= u < 1 else None
        st['blue'] = ease_sine(prog(t, BLUE0, BLUE1))
        if t >= UP1:
            x, ph = walk_x(t, UP1, WALK1, STAND_X - 12, STAND_X, 40)
            st['x'], st['walk'] = x, ph
        if t >= WO0:
            x, ph = walk_x(t, WO0 + 0.1, WO1, STAND_X, 1330, ease=ease_sine)
            st['x'], st['walk'] = x, ph
        st['green'] = 0.35 * math.sin(math.pi * prog(t, UP0, WO1))
    return st

def draw_matthew(ctx, t, mode, it):
    st = matthew_state(t, mode)
    x = st['x']
    s = SS
    body = mix(C['grey'], C['blue'], st['blue'])
    if st['green'] > 0.01:
        glow(ctx, x, 850 - (0 if st['seated'] else 30), 240, GREEN_GLOW, 1.0 * st['green'] * (1 + 0.08 * math.sin(it * 3)))
        glow(ctx, x, 850 - (0 if st['seated'] else 30), 130, hexrgb('#A9DDB8'), 0.55 * st['green'])
    hat = dict(col=hexrgb('#3E3A44'), tilt=-0.12)
    br = breathe(it, 3.1, 0.2)
    if st['seated']:
        seated_legs(ctx, x)
        top = st['hip'] - 150 * s
        if st['point'] > 0.01:
            k = st['point']
            lh = (lerp(x - 34, x - 40, k), lerp(TOP - 10, top + 62, k))
            pose = Pose(seated=True, arms_front=True, lhand_abs=lh, lbulge=lerp(10, 26, k), rhand_abs=(x + 34, TOP - 10), head_dx=lerp(5, 1, k),
                        head_dy=lerp(0, -5, k), breath=br)
        else:
            pose = Pose(seated=True, arms_front=True, lhand_abs=(x - 34, TOP - 10), rhand_abs=(x + 34, TOP - 10), head_dx=5, breath=br)
        info = person(ctx, x, st['hip'], s, fill=body, pose=pose, hat=hat, beard=True)
        if st['point'] > 0.3:
            hx, hy = info['lhand']
            hand(ctx, hx - 4, hy, 0.62 * min(1, st['point'] * 1.3), 0.08, 'point', fill=body, line=C['out'], lw=3.8, flip=True)
    else:
        pose = Pose(walk=st['walk'], head_dx=6, breath=br, stride=0.9)
        person(ctx, x, st['hip'] + 140 * s, s, fill=body, pose=pose, hat=hat, beard=True)
    return st

def draw_seated_others(ctx, t, mode, it, g):
    s = SS
    # far left: young man counting coins, head down
    cnt = math.sin(it * 2 * math.pi / 0.9) * 5 if mode != 'painting' else 0
    x = SEATS['m1']
    seated_legs(ctx, x)
    person(ctx, x, SEAT_HIP, s, fill=C['grey'],
           pose=Pose(seated=True, arms_front=True, lhand_abs=(x - 26 + cnt, TOP - 10), rhand_abs=(x + 30 - cnt * 0.5, TOP - 10), lbulge=10,
                     head_dx=6, head_dy=15, breath=breathe(it, 3.3, 0.5)),
           hat=dict(col=C['hat_red'], tilt=0.25))
    # old man with glasses
    x = SEATS['m2']
    seated_legs(ctx, x)
    person(ctx, x, SEAT_HIP, s, fill=C['grey'],
           pose=Pose(seated=True, arms_front=True, lhand_abs=(x - 32, TOP - 10), rhand_abs=(x + 34, TOP - 12), head_dx=-4, head_dy=8,
                     breath=breathe(it, 3.6, 0.1)),
           glasses=True, hair=hexrgb('#EEEDEA'), hat=dict(col=C['hat_dk'], tilt=-0.08, feather=False))
    # youth in a feathered hat, looking at Jesus
    x = SEATS['m3']
    seated_legs(ctx, x)
    person(ctx, x, SEAT_HIP, s, fill=C['grey'],
           pose=Pose(seated=True, arms_front=True, lhand_abs=(x - 34, TOP - 10), rhand_abs=(x + 32, TOP - 10), head_dx=6, head_dy=-2,
                     breath=breathe(it, 2.9, 0.7)),
           hat=dict(col=C['hat_ochre'], tilt=-0.22))

def jesus_pose(t, mode, it):
    """returns x, walk phase, alpha, pointing amount, turn and point-at-camera for Jesus"""
    x, ph = JX, None
    alpha = 1.0
    point = 1.0
    turn = 0.0
    pcam = 0.0
    if mode == 'live':
        alpha = 1 - ease_sine(prog(t, G0, G0 + 0.5))
        if t >= E0:
            alpha = 1.0
            x, ph = walk_x(t, E0, E1, 1290, JX, ease=ease_out)
            point = ease_io(prog(t, E1 - 0.1, E1 + 0.5))
        if t >= WO0 - 0.6:
            point = 1 - ease_io(prog(t, WO0 - 0.6, WO0 - 0.1))
        if t >= WO0:
            x, ph = walk_x(t, WO0, WO1, JX, 1420, ease=ease_sine)
    elif mode == 'end':
        point = 1 - ease_io(prog(t, TURN0, TURN0 + 0.6))
        turn = prog(t, TURN0, TURN1)
        pcam = ease_io(prog(t, PCAM0, PCAM1))
    return x, ph, alpha, point, turn, pcam

POINT_DX, POINT_DY = -150, 8
HAND_S = 0.6

def jesus_hand_pos():
    """wrist position of Jesus' pointing hand in room space (pose at rest, breath 0)"""
    top_y = RH - 46 * JS - 250 * JS
    sh = (JX - 40 * JS, top_y + 18 * JS)
    return sh[0] + POINT_DX, sh[1] + POINT_DY

HAND_W = jesus_hand_pos()
HAND_C = (HAND_W[0] - 26, HAND_W[1] + 4)

def draw_jesus(ctx, t, mode, it, hand_alpha=1.0):
    x, ph, alpha, point, turn, pcam = jesus_pose(t, mode, it)
    if alpha <= 0.01:
        return None
    br = breathe(it, 3.4, 0.0)
    top_y = RH - 46 * JS - 250 * JS * (1 + 0.010 * br)
    sh = (x - 40 * JS, top_y + 18 * JS)
    rest = (sh[0] - 33, sh[1] + 147)
    tgt = (lerp(rest[0], sh[0] + POINT_DX, point), lerp(rest[1], sh[1] + POINT_DY, point))
    pose = Pose(walk=ph, lhand_abs=tgt, lbulge=lerp(14, 9, point), head_dx=-6 * (1 - ease_io(turn)), breath=br, stride=0.9)
    sq = 1 - 0.1 * math.sin(math.pi * turn)
    ctx.save()
    ctx.translate(x, 0)
    ctx.scale(sq, 1)
    ctx.translate(-x, 0)
    info = jesus(ctx, x, RH, JS, pose=pose, alpha=alpha, t=it, point_cam=pcam)
    ctx.restore()
    if point > 0.6 and hand_alpha > 0:
        hx, hy = info['lhand']
        hand(ctx, hx + 2, hy, HAND_S, 0.06, 'limp', lw=4.0, alpha=alpha * clamp01((point - 0.6) / 0.3) * hand_alpha)
    return info

def peter_state(t, mode):
    x, ph = PX, None
    alpha = 1.0
    if mode == 'live':
        alpha = 1 - ease_sine(prog(t, G0, G0 + 0.5))
        if t >= E0 + 0.25:
            alpha = 1.0
            x, ph = walk_x(t, E0 + 0.25, E1 + 0.35, 1470, PX, ease=ease_out)
        elif t >= E0 - 0.4:
            alpha = 0.0
        if t >= WO0 - 0.1:
            x, ph = walk_x(t, WO0 - 0.1, WO1 - 0.1, PX, 1580, ease=ease_sine)
    return x, ph, alpha

def draw_peter(ctx, t, mode, it):
    x, ph, alpha = peter_state(t, mode)
    if alpha <= 0.01:
        return
    person(ctx, x, RH, PS, fill=C['blue'], pose=Pose(walk=ph, head_dx=-5, breath=breathe(it, 3.0, 0.4), ra=0.12, la=0.3),
           alpha=alpha, beard=True, hair=hexrgb('#E9E7E3'))

PM_S = 1.2
PM_X = 772

def poor_man(ctx, t, it):
    if t < PM0 or t > T_LEAVE + 1.3:
        return
    x, ph = walk_x(t, PM0, PM0 + 0.75, 1190, PM_X, ease=ease_out)
    reach = ease_io(prog(t, PM0 + 0.72, PM0 + 0.95)) * (1 - ease_io(prog(t, T_BUB_OUT - 0.3, T_BUB_OUT + 0.1)))
    face = -1
    if t >= T_LEAVE - 0.05:
        x, ph = walk_x(t, T_LEAVE - 0.05, T_LEAVE + 1.15, PM_X, 1220, ease=ease_in)
        face = 1
    top = RH - 140 * PM_S - 150 * PM_S
    tgt = (lerp(x - 60, 652, reach), lerp(top + 140, TOP - 34, reach))
    person(ctx, x, RH, PM_S, fill=C['blue'],
           pose=Pose(walk=ph, lhand_abs=tgt, lbulge=10, head_dx=6 * face, head_dy=10, lean=-0.04 * face,
                     breath=breathe(it, 2.6)), patch=True)

def coins_from_poor(ctx, t):
    """coins sliding from the poor man's hand onto the pile; returns number landed"""
    landed = 0
    for i, c0 in enumerate(PM_COIN):
        u = prog(t, c0, c0 + 0.45)
        if u <= 0:
            continue
        if u >= 1:
            landed += 1
            continue
        e = ease_io(u)
        x = lerp(648, PILE[0] + 4, e)
        y = lerp(TOP - 36, PILE[1] - 7 * (3 + i), e) - math.sin(math.pi * e) * 30
        coin(ctx, x, y, 15, flat=0.7, rot=0.3 * (1 - e))
    return landed

# coins knocked off the table when Matthew stands
FALL = [dict(dx=0, x1=662, delay=0.0), dict(dx=-8, x1=702, delay=0.07), dict(dx=4, x1=745, delay=0.15),
        dict(dx=-2, x1=790, delay=0.22), dict(dx=6, x1=828, delay=0.31), dict(dx=-4, x1=684, delay=0.4)]

def falling_coins(ctx, t):
    """returns the number of pile coins already gone"""
    gone = 0
    t0 = UP0 + 0.12
    for i, f in enumerate(FALL):
        a = t0 + f['delay']
        if t < a:
            continue
        gone += 1
        slide = prog(t, a, a + 0.22)
        fall = prog(t, a + 0.22, a + 0.62)
        bounce = prog(t, a + 0.62, a + 0.9)
        if fall <= 0:
            x = lerp(PILE[0] + f['dx'], TX1 + 6, ease_in(slide))
            y = PILE[1] - 7 * min(i, 4)
            coin(ctx, x, y, 14, flat=1.0)
        elif bounce <= 0:
            x = lerp(TX1 + 6, f['x1'], fall)
            y = lerp(TOP, RH - 8, fall * fall)
            coin(ctx, x, y, 14, flat=0.35 + 0.3 * math.cos(fall * 9), rot=fall * 5)
        else:
            x = f['x1'] + 10 * bounce
            y = RH - 8 - math.sin(math.pi * bounce) * 16 * (1 - bounce)
            coin(ctx, x, y, 14, flat=0.35 + 0.65 * bounce, rot=(1 - bounce) * 0.8)
    return gone

def coin_landing_times():
    """for the sound design"""
    t0 = UP0 + 0.12
    return [t0 + f['delay'] + 0.62 for f in FALL] + [t0 + f['delay'] + 0.9 for f in FALL[::2]]

def draw_floor_light(ctx, t, mode, it):
    if mode == 'painting':
        lvl, spread = 0.35, 1.0
    elif mode == 'end':
        lvl, spread = 0.45, 1.0
    else:
        spread = ease_out(prog(t, FL0, FL0 + 1.3))
        if t < FL0:
            lvl = 0.35 * (1 - ease_sine(prog(t, G0, G0 + 0.5)))
        else:
            lvl = 0.95 * spread * (1 - 0.5 * ease_sine(prog(t, FL0 + 1.5, FL0 + 3.2)))
    if lvl <= 0.01:
        return
    x_left = lerp(1080, -120, spread)
    w = 1200 - x_left
    # a warm pool of light along the floor, spreading from the right (where Jesus came in)
    for hh, a in ((150, 0.45), (75, 0.75)):
        g = cairo.LinearGradient(1200, 0, x_left, 0)
        g.add_color_stop_rgba(0, 1, 0.9, 0.62, a * lvl)
        g.add_color_stop_rgba(0.7, 1, 0.9, 0.62, a * 0.65 * lvl)
        g.add_color_stop_rgba(1, 1, 0.9, 0.62, 0.0)
        v = cairo.LinearGradient(0, RH - hh, 0, RH)
        ctx.save()
        ctx.rectangle(x_left, RH - hh, w, hh)
        ctx.clip()
        ctx.set_source(g)
        ctx.mask(v_mask(RH - hh, RH))
        ctx.restore()
    if mode == 'live' and FL0 - 0.2 < t < FL0 + 2.0:
        u = prog(t, FL0 - 0.2, FL0 + 2.0)
        glow_ellipse(ctx, lerp(900, 700, u), RH - 10, 380, 70, (1, 0.9, 0.6), 0.6 * math.sin(math.pi * u))

def v_mask(y0, y1):
    m = cairo.LinearGradient(0, y0, 0, y1)
    m.add_color_stop_rgba(0, 0, 0, 0, 0.0)
    m.add_color_stop_rgba(1, 0, 0, 0, 1.0)
    return m

def draw_right_light(ctx, t):
    """the light outside the room on the right (they walk out into it)"""
    lvl = ease_sine(prog(t, WO0 - 0.2, WO0 + 1.0))
    if lvl <= 0:
        return
    glow_ellipse(ctx, 1120, 900, 420 + 200 * lvl, 520 + 200 * lvl, (1, 0.96, 0.84), 0.9 * lvl)
    glow_ellipse(ctx, 1100, 900, 180 + 80 * lvl, 420, (1, 1, 0.95), 0.9 * lvl)


# ---------------------------------------------------------------- the room
def draw_room(ctx, t, mode='live', hand_alpha=1.0):
    """mode: 'painting' (static artwork), 'live' (scenes 3-9), 'end' (scene 13)"""
    it = T_ZOOM0 if mode == 'painting' else t
    g = mood_grey(t, mode)
    draw_wall(ctx, g)
    xr = 0.0
    if mode == 'live':
        xr = ease_io(prog(t, RX0, RX0 + 0.42)) * (1 - ease_sine(prog(t, s0('s13a') - 0.1, s0('s13a') + 0.25)))
    draw_window(ctx, t, g, mode, xr)
    bl = beam_level(t, mode)
    draw_beam(ctx, bl, it)
    # pulse travelling along the beam from behind Jesus to the table
    if mode == 'live':
        u = prog(t, PULSE0, PULSE0 + 1.05)
        if 0 < u < 1:
            px, py = lerp(1000, 300, ease_io(u)), lerp(704, 859, ease_io(u))
            glow(ctx, px, py, 210, (1, 0.95, 0.78), 0.85 * math.sin(math.pi * u))
    draw_dust(ctx, it, bl)
    draw_peter(ctx, t, mode, it)
    draw_jesus(ctx, t, mode, it, hand_alpha)
    # table group
    pile_n = 3
    if mode == 'live':
        pile_n = 3 + (3 if t >= PM_COIN[-1] + 0.45 else 0)
        if t < PM0:
            pile_n = 3
    draw_seated_others(ctx, t, mode, it, g)
    draw_matthew(ctx, t, mode, it)
    draw_table(ctx, g)
    gone = 0
    landed = 0
    if mode == 'live':
        if PM0 <= t < PM_COIN[-1] + 0.45:
            landed = coins_from_poor(ctx, t)
            pile_n = 3 + landed
        gone = falling_coins(ctx, t) if t >= UP0 else 0
    draw_coins_table(ctx, t, mode, max(0, pile_n - gone))
    if mode == 'live' and t >= UP0 + 0.5:
        # the coins that stay behind on the floor
        for i, f in enumerate(FALL):
            if t >= UP0 + 0.12 + f['delay'] + 0.9:
                coin(ctx, f['x1'] + 10, RH - 8, 13, flat=1.0)
    if mode == 'live':
        poor_man(ctx, t, it)
        coin_glint(ctx, t, w0('s04', 'tax'))
    # light over everything (soft, like the reference's glow)
    draw_beam(ctx, bl * 0.35, it, over=True)
    draw_floor_light(ctx, t, mode, it)
    if mode == 'live':
        draw_right_light(ctx, t)
        # speech bubbles in room space
        a_out = 1 - ease_sine(prog(t, T_BUB_OUT, T_BUB_OUT + 0.3))
        if t >= T_THIEF:
            bubble(ctx, 196, 330, 'THIEF.', 44, C['red'], scale=pop(t, T_THIEF), alpha=a_out, tail='br')
        if t >= T_TRAITOR:
            bubble(ctx, 790, 320, 'TRAITOR.', 44, C['red'], scale=pop(t, T_TRAITOR), alpha=a_out, tail='bl')
        if t >= T_ME:
            a = 1 - ease_sine(prog(t, OUT8, OUT8 + 0.3))
            bubble(ctx, 424, 604, 'ME?', 58, C['red'], scale=pop(t, T_ME, 0.42), alpha=a, tail='br')
        # quote icon near Jesus (Scene 9)
        if t >= T_QI:
            a = 1 - ease_sine(prog(t, UP0 - 0.25, UP0 + 0.1))
            pul = 1 + 0.07 * math.sin(math.pi * prog(t, T_FM - 0.05, T_FM + 0.5))
            quote_icon(ctx, 728, 548, 70, scale=pop(t, T_QI) * pul, alpha=a, t=t)


def draw_room_cam(ctx, t, mode='live', keys=None, hand_alpha=1.0):
    k, cx, cy = cam(t, keys)
    ctx.save()
    apply_cam(ctx, k, cx, cy)
    draw_room(ctx, t, mode, hand_alpha)
    ctx.restore()


# ---------------------------------------------------------------- gallery + frame (scene 2)
INNER = (230, 210, 620, 683.2)        # painting area inside the frame (aspect = room)
K0 = INNER[2] / RW
ZFIX = (INNER[0] / (1 - K0), INNER[1] / (1 - K0))   # fixed point of the zoom

def draw_gallery_wall(ctx, t):
    g = cairo.RadialGradient(540, 420, 80, 540, 600, 900)
    g.add_color_stop_rgb(0, *hexrgb('#F1ECE1'))
    g.add_color_stop_rgb(0.6, *hexrgb('#E8E3D7'))
    g.add_color_stop_rgb(1, *hexrgb('#DCD7CB'))
    ctx.set_source(g)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()
    # spotlight beam from the top
    ctx.move_to(452, 0)
    ctx.line_to(628, 0)
    ctx.line_to(880, 175)
    ctx.line_to(200, 175)
    ctx.close_path()
    lg = cairo.LinearGradient(0, 0, 0, 175)
    lg.add_color_stop_rgba(0, 1, 0.98, 0.9, 0.85)
    lg.add_color_stop_rgba(1, 1, 0.98, 0.9, 0.25)
    ctx.set_source(lg)
    ctx.fill()
    glow_ellipse(ctx, 540, 540, 520, 600, (1, 0.98, 0.9), 0.5)
    # floor line shadow of the frame
    glow_ellipse(ctx, 540, RH - 4, 380, 26, (0.55, 0.5, 0.42), 0.22)

def draw_frame(ctx):
    x, y, w, h = INNER
    gold = C['gold_line']
    ox, oy, ow, oh = x - 48, y - 48, w + 96, h + 96
    # outer body
    ctx.rectangle(ox, oy, ow, oh)
    ctx.rectangle(x, y, w, h)
    ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
    set_c(ctx, hexrgb('#F3E7C6'))
    ctx.fill()
    ctx.set_fill_rule(cairo.FILL_RULE_WINDING)
    ctx.rectangle(ox, oy, ow, oh)
    stroke_style(ctx, 6, gold)
    ctx.stroke()
    ctx.rectangle(ox + 14, oy + 14, ow - 28, oh - 28)
    stroke_style(ctx, 3, gold)
    ctx.stroke()
    ctx.rectangle(x - 22, y - 22, w + 44, h + 44)
    stroke_style(ctx, 12, gold)
    ctx.stroke()
    ctx.rectangle(x - 8, y - 8, w + 16, h + 16)
    stroke_style(ctx, 9, C['out'])
    ctx.stroke()
    ctx.rectangle(x - 2.5, y - 2.5, w + 5, h + 5)
    stroke_style(ctx, 3, gold)
    ctx.stroke()
    # corner roundels
    for cx, cy in ((ox, oy), (ox + ow, oy), (ox, oy + oh), (ox + ow, oy + oh)):
        circle(ctx, cx, cy, 22)
        fill_stroke(ctx, hexrgb('#F6ECCF'), gold, 6)
        circle(ctx, cx, cy, 8)
        set_c(ctx, gold)
        ctx.fill()
    # almond ornaments
    def almond(cx, cy, horiz=True, L=34, Wd=10):
        ctx.save()
        ctx.translate(cx, cy)
        if not horiz:
            ctx.rotate(math.pi / 2)
        ctx.move_to(-L, 0)
        ctx.curve_to(-L * 0.4, -Wd, L * 0.4, -Wd, L, 0)
        ctx.curve_to(L * 0.4, Wd, -L * 0.4, Wd, -L, 0)
        ctx.close_path()
        set_c(ctx, gold)
        ctx.fill()
        ctx.restore()
    almond(540, oy + 7, True)
    almond(540, oy + oh - 7, True)
    almond(ox + 7, oy + oh / 2, False)
    almond(ox + ow - 7, oy + oh / 2, False)

def draw_plate(ctx):
    x, y, w, h = INNER
    py = y + h + 48 + 52
    f = font('label')
    tw = f.width('CARAVAGGIO · 1600', 30, 4)
    pw = tw + 64
    rrect(ctx, 540 - pw / 2, py - 30, pw, 60, 4)
    fill_stroke(ctx, hexrgb('#F5EDD8'), C['gold_line'], 4)
    rrect(ctx, 540 - pw / 2 + 7, py - 23, pw - 14, 46, 2)
    stroke_style(ctx, 1.8, C['gold_line'])
    ctx.stroke()
    draw_text(ctx, f, 'CARAVAGGIO · 1600', 30, 540, py + 11, C['cap_dark'], tracking=4)

def draw_painting_in_frame(ctx, t, varnish=1.0, live=False):
    x, y, w, h = INNER
    ctx.save()
    ctx.rectangle(x, y, w, h)
    ctx.clip()
    ctx.translate(x, y)
    ctx.scale(K0, K0)
    draw_room(ctx, t, 'live' if live else 'painting')
    if varnish > 0:
        g = cairo.RadialGradient(540, 560, 200, 540, 595, 900)
        g.add_color_stop_rgba(0, 0.25, 0.17, 0.08, 0.0)
        g.add_color_stop_rgba(1, 0.25, 0.17, 0.08, 0.42 * varnish)
        ctx.set_source(g)
        ctx.rectangle(0, 0, RW, RH)
        ctx.fill()
    ctx.restore()

def draw_gallery(ctx, t, varnish=1.0):
    draw_gallery_wall(ctx, t)
    draw_frame(ctx)
    draw_plate(ctx)
    draw_painting_in_frame(ctx, t, varnish)

def zoom_k(t):
    e = ease_io(prog(t, T_ZOOM0, T_ZOOM1))
    return math.exp(e * math.log(1 / K0)), e

def pause_icon(ctx, t):
    u = prog(t, T_PAUSE0, T_PAUSE0 + 0.8)
    if u <= 0 or u >= 1:
        return
    a = ease_out(prog(u, 0, 0.18)) * (1 - ease_sine(prog(u, 0.7, 1.0)))
    sc = ease_back(prog(u, 0, 0.3))
    cx, cy = 540, INNER[1] + INNER[3] / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(sc, sc)
    glow(ctx, 0, 0, 170, (1, 0.98, 0.92), 0.6 * a)
    circle(ctx, 0, 0, 82)
    set_c(ctx, (0.985, 0.975, 0.95), 0.92 * a)
    ctx.fill_preserve()
    stroke_style(ctx, 5, C['out'], a)
    ctx.stroke()
    for dx in (-20, 20):
        rrect(ctx, dx - 9, -34, 18, 68, 7)
    set_c(ctx, C['out'], a)
    ctx.fill()
    ctx.restore()

def mag_path_scene2(t):
    """magnifier glide over the painting (screen space)"""
    keys = [(T_MAG0, 900, 1060), (T_MAG0 + 0.55, 640, 600), (T_Q + 0.1, 540, 520), (T_PAUSE0 + 0.05, 600, 560)]
    if t <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if t <= b[0]:
            u = ease_io(prog(t, a[0], b[0]))
            return lerp(a[1], b[1], u), lerp(a[2], b[2], u)
    return keys[-1][1:]

def draw_scene_painting(ctx, t):
    """scenes 2-9 (t from ~2.0 to ROOM_END)"""
    if t < T_ZOOM0:
        draw_gallery(ctx, t)
        # magnifier over the painting with a red ?
        if t >= T_MAG0 - 0.01:
            a = ease_out(prog(t, T_MAG0, T_MAG0 + 0.3)) * (1 - ease_sine(prog(t, T_PAUSE0 - 0.05, T_PAUSE0 + 0.25)))
            if a > 0.01:
                mx, my = mag_path_scene2(t)
                magnifier(ctx, mx, my, 105, lambda c: draw_gallery(c, t), alpha=a, focus=(mx, my))
                if t >= T_Q:
                    s = pop(t, T_Q, 0.4)
                    ctx.save()
                    ctx.translate(mx + 118, my - 120)
                    ctx.scale(s, s)
                    f = font('serifk')
                    for lw, al in ((14, 0.35), (8, 0.6)):
                        text_path(ctx, f, '?', 110, 0, 38)
                        stroke_style(ctx, lw, (0.99, 0.97, 0.92), al * a)
                        ctx.stroke()
                    draw_text(ctx, f, '?', 110, 0, 38, C['red'], a)
                    ctx.restore()
        pause_icon(ctx, t)
        return
    k, e = zoom_k(t)
    if e < 1:
        ctx.save()
        ctx.translate(*ZFIX)
        ctx.scale(k, k)
        ctx.translate(-ZFIX[0], -ZFIX[1])
        draw_gallery_wall(ctx, t)
        draw_frame(ctx)
        draw_plate(ctx)
        draw_painting_in_frame(ctx, t, varnish=1 - e, live=True)
        ctx.restore()
        return
    draw_room_cam(ctx, t, 'live')
    draw_scene6_overlays(ctx, t)


# ---------------------------------------------------------------- scene 6: magnifier, hand detail, Creation of Adam
DETAIL_C = (540, 690)
DETAIL_R = 360

def mag_scene6(t):
    hx, hy = HAND_C
    sx, sy = 1010, 1150
    u = ease_io(prog(t, MAG_A, MAG_B))
    # gentle arc
    x = lerp(sx, hx, u)
    y = lerp(sy, hy, u) - math.sin(math.pi * u) * 70
    return x, y

def draw_hand_detail(ctx, t, R, cx, cy, content_a):
    """large view of Jesus' hand; Adam's hand slides in and lines up"""
    ctx.save()
    circle(ctx, cx, cy, R)
    ctx.clip()
    base, top = wall_cols(0)
    set_c(ctx, mix(base, (1, 0.97, 0.9), 0.25))
    ctx.paint()
    # beam light across the detail
    ctx.move_to(cx + R, cy - R * 0.5)
    ctx.line_to(cx + R, cy + R * 0.2)
    ctx.line_to(cx - R, cy + R * 0.75)
    ctx.line_to(cx - R, cy - R * 0.05)
    ctx.close_path()
    set_c(ctx, C['beam'], 0.45)
    ctx.fill()
    S = 3.1
    wx, wy = cx + 150, cy - 8
    # Jesus' sleeve and hand
    ctx.move_to(wx - 10, wy - 40)
    ctx.line_to(cx + R + 40, wy - 95)
    ctx.line_to(cx + R + 40, wy + 60)
    ctx.line_to(wx - 10, wy + 40)
    ctx.close_path()
    fill_stroke(ctx, C['jesus_fill'], C['jesus_line'], 6)
    al = ease_io(prog(t, ALIGN0, ALIGN1))
    hand(ctx, wx, wy, S, 0.06, 'limp', fill=C['jesus_fill'], line=C['jesus_line'], lw=6.5, forearm=0)
    # red dashed circle carried over from the lens
    rc_a = 1 - ease_sine(prog(t, ADAM0 - 0.1, ADAM0 + 0.3))
    if rc_a > 0:
        red_circle(ctx, wx - 140, wy + 22, 205, 150, 1.0, lw=10, dashed=True, a=rc_a)
    # Adam's hand (Michelangelo): sepia line drawing, slides in beside, then lines up perfectly
    if t >= ADAM0:
        u_in = ease_out(prog(t, ADAM0, ADAM1))
        ax = lerp(wx - 640, wx - 40, u_in)
        ay = wy + 205
        ax = lerp(ax, wx, al)
        ay = lerp(ay, wy, al)
        aa = 1.0 - 0.55 * ease_sine(prog(t, ALIGN1 + 0.25, ALIGN1 + 0.9))
        hand(ctx, ax, ay, S, 0.06, 'limp', fill=SKIN, line=SEPIA, lw=6.5, forearm=260, sleeve=SKIN,
             alpha=aa * (0.92 if al > 0 else 1))
        # perfect match flash
        fl = prog(t, ALIGN1 - 0.05, ALIGN1 + 0.55)
        if 0 < fl < 1:
            glow(ctx, wx - 150, wy + 20, 420, (1, 0.95, 0.75), 0.75 * math.sin(math.pi * fl))
    ctx.restore()
    # rim of the detail view (magnifier rim)
    circle(ctx, cx, cy, R)
    stroke_style(ctx, R * 0.05 + 8, C['out'])
    ctx.stroke()
    circle(ctx, cx, cy, R)
    stroke_style(ctx, R * 0.05, C['gold_line'])
    ctx.stroke()

def draw_creation(ctx, t):
    """quick flash: the two famous almost-touching hands (Michelangelo, 1512)"""
    lg = cairo.LinearGradient(0, 0, 0, RH)
    lg.add_color_stop_rgb(0, *hexrgb('#D6DDE8'))
    lg.add_color_stop_rgb(1, *hexrgb('#F1E9DA'))
    ctx.set_source(lg)
    ctx.rectangle(0, 0, RW, RH)
    ctx.fill()
    u = prog(t, FLASH0, FLASH1)
    drift = ease_io(u) * 14
    # soft clouds
    for (x, y, r) in ((190, 420, 120), (330, 380, 90), (850, 840, 130), (980, 790, 100), (720, 880, 90)):
        glow(ctx, x, y, r * 1.6, (1, 1, 1), 0.75)
    glow(ctx, 538, 640, 190, (1, 0.94, 0.7), 0.55 + 0.25 * math.sin(t * 9))
    # Adam's hand from the left (limp), God's from the right (reaching): index fingertips almost touching
    ax, ay = 263 + drift * 0.3, 648      # Adam's wrist -> fingertip at ~(510, 650)
    gx, gy = 824 - drift * 0.7, 625      # God's wrist  -> fingertip at ~(565, 630)
    # God's sleeve (soft rose robe, like the fresco)
    ctx.move_to(gx + 170, gy - 58)
    ctx.curve_to(gx + 260, gy - 90, 1100, gy - 110, 1120, gy - 120)
    ctx.line_to(1120, gy + 120)
    ctx.curve_to(1100, gy + 100, gx + 260, gy + 80, gx + 170, gy + 52)
    ctx.close_path()
    fill_stroke(ctx, hexrgb('#E7CFD6'), SEPIA, 6)
    hand(ctx, gx, gy, 2.6, -0.12, 'reach', fill=SKIN, line=SEPIA, lw=6.0, forearm=72, sleeve=SKIN)
    hand(ctx, ax, ay, 2.6, -0.04, 'limp', fill=SKIN, line=SEPIA, lw=6.0, flip=True, forearm=420, sleeve=SKIN)
    # the famous gap
    star4(ctx, 538 - drift * 0.2, 640, 15 + 6 * math.sin(t * 12), (1, 0.9, 0.55), 0.9)

def draw_scene6_overlays(ctx, t):
    if MAG_A - 0.01 <= t < FLASH0 + 0.2:
        if t < EXP0:
            a = ease_out(prog(t, MAG_A, MAG_A + 0.25))
            mx, my = mag_scene6(t)
            magnifier(ctx, mx, my, 112, lambda c: draw_room_cam(c, t, 'live'), alpha=a, focus=(mx, my))
            if t >= RC0:
                ctx.save()
                circle(ctx, mx, my, 112)
                ctx.clip()
                red_circle(ctx, mx, my, 74, 58, ease_io(prog(t, RC0, RC1)), lw=8, dashed=True)
                ctx.restore()
        else:
            u = ease_io(prog(t, EXP0, EXP1))
            mx, my = HAND_C
            cx, cy = lerp(mx, DETAIL_C[0], u), lerp(my, DETAIL_C[1], u)
            R = lerp(112, DETAIL_R, u)
            # dim the room behind the detail view
            set_c(ctx, (0.12, 0.1, 0.08), 0.28 * u)
            ctx.rectangle(0, 0, RW, RH)
            ctx.fill()
            if u < 1:
                magnifier(ctx, cx, cy, R, lambda c: draw_room_cam(c, t, 'live'), alpha=1.0, handle=1 - u,
                          zoom=2.0 + u * 1.2, focus=HAND_C)
            ctx.save()
            push = ease_sine(prog(t, EXP0 + 0.15, EXP1))
            if push > 0:
                ctx.push_group()
                draw_hand_detail(ctx, t, R, cx, cy, push)
                ctx.pop_group_to_source()
                ctx.paint_with_alpha(push)
            ctx.restore()
    # Creation of Adam flash
    if FLASH0 - 0.1 <= t <= FLASH1 + 0.25:
        wi = ease_out(prog(t, FLASH0 - 0.1, FLASH0 + 0.02))
        if FLASH0 + 0.02 <= t <= FLASH1:
            draw_creation(ctx, t)
        w_out = 1 - ease_out(prog(t, FLASH0 + 0.02, FLASH0 + 0.22))
        w_back = ease_out(prog(t, FLASH1 - 0.12, FLASH1)) * (1 - ease_sine(prog(t, FLASH1, FLASH1 + 0.25)))
        wa = (wi * w_out if t < FLASH0 + 0.22 else 0) + w_back
        if wa > 0:
            set_c(ctx, (1, 0.99, 0.96), min(1, wa) * 0.92)
            ctx.rectangle(0, 0, RW, RH)
            ctx.fill()


def labels_scene_painting(ctx, t):
    """screen-space labels for scenes 3-9"""
    a = ease_sine(prog(t, T_LBL_C0, T_LBL_C0 + 0.45)) * (1 - ease_sine(prog(t, T_LBL_C1, T_LBL_C1 + 0.4)))
    label(ctx, 'CARAVAGGIO · 1600', 292, a)
    a = ease_sine(prog(t, T_LBL_M, T_LBL_M + 0.35)) * (1 - ease_sine(prog(t, FLASH1, FLASH1 + 0.3)))
    label(ctx, 'MICHELANGELO · 1512', 262, a)
    a = ease_sine(prog(t, T_LBL_MT, T_LBL_MT + 0.35)) * (1 - ease_sine(prog(t, WO0 + 0.3, WO0 + 0.8)))
    label(ctx, 'MATTHEW 9:9', 292, a)


# ---------------------------------------------------------------- scene 13: ending
END_KEYS = [(0.0, 1.0, 540, 595), (E_IN + 0.3, 1.0, 540, 595), (BLOOM0 + 0.3, 1.5, 760, 800), (TOTAL, 1.55, 760, 800)]

def draw_scene_end(ctx, t):
    draw_room_cam(ctx, t, 'end', END_KEYS)
    # light comes toward the viewer
    u = prog(t, BLOOM0, BLOOM1)
    k, cx, cy = cam(t, END_KEYS)
    jx = 540 + (JX - cx) * k
    jy = 595 + (850 - cy) * k
    if u > 0:
        r = lerp(120, 1900, ease_in(u))
        glow(ctx, jx, jy, r, (1, 0.96, 0.84), min(1.0, 0.4 + 0.9 * u))
    warm = ease_sine(prog(t, BLOOM0 + 0.35, BLOOM1 + 0.15))
    if warm > 0:
        set_c(ctx, C['warm'], warm)
        ctx.rectangle(0, 0, RW, RH)
        ctx.fill()
    # end card: question for the comments + small drawn arrow
    if t >= EC0:
        a = ease_out(prog(t, EC0, EC0 + 0.35))
        rise = (1 - a) * 18
        f = font('cap')
        draw_text(ctx, f, 'Experts still argue:', 64, 540, 520 + rise, C['cap_dark'], a)
        draw_text(ctx, f, 'which man is', 76, 540, 640 + rise, C['cap_dark'], a)
        draw_text(ctx, f, 'Matthew?', 92, 540, 760 + rise, C['gold'], a)
        b = ease_out(prog(t, EC0 + 0.3, EC0 + 0.6))
        draw_text(ctx, f, 'Comment below', 60, 500, 930 + rise, C['green'], b)
        p = ease_io(prog(t, EC0 + 0.55, EC0 + 1.05))
        arrow_drawn(ctx, [(760, 905), (850, 905), (900, 960), (900, 1080)], p, C['green'], lw=7, a=b, head=26)

def labels_scene_end(ctx, t):
    a = ease_sine(prog(t, E_IN + 0.3, E_IN + 0.7)) * (1 - ease_sine(prog(t, s1('s22') - 0.2, s1('s22') + 0.3)))
    label(ctx, 'CARAVAGGIO · 1600', 292, a)
