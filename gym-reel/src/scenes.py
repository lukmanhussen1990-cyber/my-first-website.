"""All 10 scenes, timed to the voiceover's word timestamps."""
import math

import numpy as np
import skia

from engine import *
from rig import *
from rig import limb, fk, BODY, bone_dir, body_parts, draw_hand, draw_drop, hand_parts
from props import *
from timing import CAPTIONS, Envelope, speaker_at, word_time as wt, DURATION
from cues import *

ENV = None


def env(t):
    global ENV
    if ENV is None:
        ENV = Envelope()
    return ENV(t)


def mouth(t, who, gain=1.0):
    if speaker_at(t) == who:
        return clamp(env(t) * 1.15 * gain, 0, 1)
    return 0.0


# ----------------------------------------------------------------------------
# lights
# ----------------------------------------------------------------------------
STEAMY = Light(direction=(0.45, -0.6, 0.66), ambient=0.55, diffuse=0.68, tint=(1.0, 0.5, 0.46),
               amb_tint=(0.42, 0.2, 0.36), rim=(-0.9, -0.3), rim_color=(1.0, 0.3, 0.5), rim_amt=0.55,
               spec_color=(1, 0.7, 0.72))
GYM = Light(direction=(-0.3, -0.85, 0.62), ambient=0.62, diffuse=0.48, tint=(1.0, 0.96, 0.9), rim=(0.8, -0.5),
            rim_color=(1.0, 0.85, 0.6), rim_amt=0.22)
NIGHT = Light(direction=(0.2, -0.6, 0.75), ambient=0.5, diffuse=0.55, tint=(0.9, 0.9, 1.08), rim=(-0.6, -0.6),
              rim_color=(0.55, 1.0, 0.4), rim_amt=0.55)
STAGE = Light(direction=(-0.2, -0.8, 0.7), ambient=0.6, diffuse=0.55, tint=(1.0, 0.97, 0.92), rim=(0.0, -1.0),
              rim_color=(0.8, 1.0, 0.75), rim_amt=0.28)


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def cam(ctx, cx, cy, zoom=1.0, rot=0.0, sh=(0.0, 0.0)):
    ctx.translate(W / 2 + sh[0], H / 2 + sh[1])
    if rot:
        ctx.rotate(rot)
    ctx.scale(zoom)
    ctx.translate(-cx, -cy)


def shake(t, amp, seed=0, freq=22.0):
    if amp <= 0.01:
        return (0.0, 0.0)
    return (fbm(t * freq, seed) * amp, fbm(t * freq, seed + 9) * amp)


def impact(t, t0, amp, decay=5.0):
    u = t - t0
    if u < 0:
        return 0.0
    return amp * math.exp(-decay * u)


def drift(t, seed, amp=8.0, sp=0.35):
    return (noise1(t * sp, seed) * amp, noise1(t * sp, seed + 3) * amp)


def comic(c, text, x, y, size, t, t0, dur=0.9, col=None, rot=-8.0, col2=None):
    u = t - t0
    if u < 0 or u > dur:
        return
    col = col or hexc("ffd60a")
    sc = pop(u / 0.22) * (1.0 + 0.04 * math.sin(u * 40) * math.exp(-u * 6))
    a = 1.0 - clamp((u - dur + 0.15) / 0.15)
    jx = noise1(t * 30, 5) * 6 * math.exp(-u * 4)
    draw_words(c, [(text, col)], x + jx, y, size, scale=sc * 1.25 if u < 0.05 else sc, rot=rot, outline=0.14,
               gradient=True, alpha=a, max_w=1000)


def ik_arm(who, s, tx, ty, elbow_out=1.0):
    B = BODY[who]
    S = np.array([s * B["sh_x"], B["sh_y"] + 18.0])
    L1, L2 = B["ua"], B["fa"]
    d = np.array([tx, ty]) - S
    dist = clamp(float(np.hypot(*d)), abs(L1 - L2) + 1, L1 + L2 - 1)
    a_t = math.degrees(math.atan2(s * d[0], d[1]))
    al = math.degrees(math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1)))
    a = a_t + elbow_out * al
    E = S + bone_dir(a, s) * L1
    d2 = np.array([tx, ty]) - E
    a2 = math.degrees(math.atan2(s * d2[0], d2[1]))
    return a, a2 - a


def wrist_pos(who, s, a, b):
    B = BODY[who]
    S = np.array([s * B["sh_x"], B["sh_y"] + 18.0])
    E = S + bone_dir(a, s) * B["ua"]
    return E + bone_dir(a + b, s) * B["fa"]


LOOK_YOU = dict(kind="you", skin="e2a477", shirt="8f959d", shorts="1c1c22")
LOOK_BRO = dict(kind="bro", skin="c07f55", shirt="d52828", shorts="1c1c22")

EXTRAS = [
    dict(kind="extra", skin="8d5a3b", shirt="2bb3a6", shorts="2a2a40", hair="afro", hair_color="1a1410", sleeve=True),
    dict(kind="extra", skin="f0c09a", shirt="f2c230", shorts="303048", hair="ponytail", hair_color="8a5a2b", sleeve=True),
    dict(kind="extra", skin="c99067", shirt="6a4cc9", shorts="1f1f28", hair="short", hair_color="2a1f18", sleeve=True),
    dict(kind="extra", skin="e8b48e", shirt="2f80ed", shorts="22222c", hair="cap", hair_color="c0392b", sleeve=True),
    dict(kind="extra", skin="a8714a", shirt="f2f2f2", shorts="2a2a33", hair="bun", hair_color="1c140f", sleeve=True),
    dict(kind="extra", skin="f2c6a0", shirt="ff7a3d", shorts="2a2a33", hair="short", hair_color="d9b36c", sleeve=True),
]


def steamy_bg(ctx, t, pulse=0.0, hue=0.0):
    c = ctx.c
    k = 1.0 + 0.25 * pulse
    radial_fill(c, 540, 860, 1350, [(mul(hexc("50101a"), k), 1), (hexc("230509"), 1), (hexc("090103"), 1)],
                [0, 0.5, 1], rect=(0, 0, W, H))
    bokeh(c, t, seed=3, n=14, color=(1, 0.22 + hue, 0.32), alpha=0.2)
    light_cone(c, (980, -120), 118, 2400, 26, (1, 0.35, 0.45), 0.1, blur=60)
    light_cone(c, (60, -200), 70, 2400, 18, (1, 0.25, 0.4), 0.06, blur=60)


def gym_soft_bg(ctx, t, green=0.0):
    c = ctx.c
    radial_fill(c, 540, 700, 1500, [(hexc("4a4038"), 1), (hexc("24221f"), 1), (hexc("121114"), 1)], [0, 0.5, 1],
                rect=(0, 0, W, H))
    for i, (x, y, r) in enumerate(((180, 160, 140), (540, 120, 170), (900, 170, 140), (80, 700, 90), (1000, 640, 110))):
        glow_circle(c, x + noise1(t * 0.3, i) * 10, y, r * 1.6, WARM, 0.35)
    for i in range(8):
        glow_circle(c, rnd(i, 7) * W, 900 + rnd(i, 8) * 600, 80 + 60 * rnd(i, 9), hexc("c9252a"), 0.12)
    if green > 0:
        radial_fill(c, 300, 1500, 1200, [(GREEN, 0.35 * green), (GREEN_D, 0.15 * green), (GREEN_D, 0)], [0, 0.5, 1],
                    rect=(0, 0, W, H), blend=skia.BlendMode.kScreen)


def frame_overlays(c, t, frame, vig=0.55):
    vignette(c, vig)
    grain(c, frame)


# ----------------------------------------------------------------------------
# SCENE 1-3 : the misdirect (steamy close-ups)
# ----------------------------------------------------------------------------

def you_steamy_face(t, speaking=True, intense=1.0):
    r = rock(t)
    breath = 0.5 + 0.5 * (-r)
    m = mouth(t, "you") if speaking else 0.0
    return face(open=clamp(0.22 + 0.32 * breath + 0.55 * m), squeeze=1.0, brow_in=0.75 * intense, sweat=1.0,
                blush=0.45, sweat_t=t, smile=-0.05, wrinkle=0.35 + 0.35 * breath)


def bro_steamy_face(t, look=(0.05, 0.75), eyes=0.62, drip=None):
    m = mouth(t, "bro")
    blink = 1.0
    ph = (t * 0.37) % 1.0
    if ph < 0.035:
        blink = 0.05
    return face(open=clamp(0.06 + 0.85 * m), eyes=eyes * blink, look=look, brow_in=-0.55, sweat=0.85, drip=drip,
                blush=0.2)


def s1(ctx, t):
    c = ctx.c
    steamy_bg(ctx, t)
    ctx.light = STEAMY
    r = rock(t)
    if t < CUTS["s1b"]:
        u = seg(t, 0, CUTS["s1b"])
        dx, dy = drift(t, 1, 10)
        ctx.push()
        cam(ctx, 540 + dx, 960 + dy, lerp(1.0, 1.1, ease_io(u)), rot=-2 + u * 2)
        with ctx.at(540, 830 + r * 22, rot=-8 + r * 1.2, sx=1.72):
            draw_head(ctx, "you", you_steamy_face(t), bust=True, t=t, bust_breath=-r)
        ctx.pop()
    elif t < CUTS["s1c"]:
        u = seg(t, CUTS["s1b"], CUTS["s1c"])
        dx, dy = drift(t, 2, 10)
        ctx.push()
        cam(ctx, 540 + dx, 960 + dy, lerp(1.04, 1.14, ease_io(u)), rot=3 - u * 2)
        drip = seg(t, CUTS["s1b"] + 0.1, CUTS["s1c"] - 0.05)
        with ctx.at(540, 800 + r * 20, rot=5 + r, sx=1.6):
            draw_head(ctx, "bro", bro_steamy_face(t, drip=drip), bust=True, t=t, bust_breath=-r)
        ctx.pop()
    else:
        u = seg(t, CUTS["s1c"], CUTS["s2"])
        dx, dy = drift(t, 3, 12)
        ctx.push()
        cam(ctx, 560 + dx, 990 + dy, lerp(1.0, 1.08, ease_io(u)), rot=-1 + u * 2)
        with ctx.at(780, 560 + r * 20, rot=16 + r, sx=0.95):
            draw_head(ctx, "bro", bro_steamy_face(t, look=(-0.7, 0.85), drip=seg(t, 4.0, 4.85)), bust=True, t=t,
                      bust_breath=-r)
        with ctx.at(420, 1050 + r * 24, rot=-14 + r, sx=1.12):
            f = you_steamy_face(t)
            draw_head(ctx, "you", f, bust=True, t=t, bust_breath=-r)
            # bro's sweat drop lands on YOU's forehead
            if 4.85 < t < 5.3:
                k = (t - 4.85) / 0.45
                draw_drop(c, 30, -110 + k * 160, 10, 1.3, 1 - k * 0.3)
        ctx.pop()


def s2(ctx, t):
    c = ctx.c
    steamy_bg(ctx, t)
    ctx.light = STEAMY
    r = rock(t)
    if t < CUTS["s2b"]:
        u = seg(t, CUTS["s2"], CUTS["s2b"])
        tr = (noise1(t * 26, 4) * 5, noise1(t * 26, 8) * 5)
        dx, dy = drift(t, 5, 8)
        ctx.push()
        cam(ctx, 540 + dx + tr[0], 960 + dy + tr[1], lerp(1.0, 1.12, ease_io(u)), rot=-4 + 3 * u)
        # the gripped object: dark, cropped, ambiguous
        ctx.light = STEAMY.copy(ambient=0.22)
        with layer(ctx, blur=3.0):
            strip_facets(ctx, [(-200, 740 + r * 6), (1280, 690 + r * 6)], 120, hexc("24161b"), seed=9, spec=0.35,
                         shine=8)
        ctx.light = STEAMY
        P = body_parts(("you", "e2a477", "8f959d", "1c1c22", "f4f4f4", False))
        sk = skin_of("you", face(red=0.15))
        for s, (wx, wy), ang in ((-1, (320, 760), 16), (1, (770, 730), -12)):
            wx += r * 4 * s
            wy += r * 8
            jx = noise1(t * 30 + s, 11) * (3 + 3 * u)
            with ctx.at(wx + jx, wy, rot=ang, sx=2.3):
                limb(ctx, P["fa"], (0, 70), (s * -50, 620), 270, color=sk)
                draw_veins(c, [[(0, 160), (-s * 10, 300), (s * 6, 480)]], 0.5 + 0.5 * math.sin(t * 14), lit_col(ctx, sk),
                           0.6 + 0.4 * u)
            with ctx.at(wx + jx, wy + 10, rot=180 + ang, sx=3.7):
                draw_hand(ctx, "you", "fist", 0.1, knuckle_white=0.3 + 0.7 * u)
        sweat_drops(c, t, 77, 1.0, (250, 820, 820, 1700), n=6, speed=0.8)
        ctx.pop()
    else:
        u = seg(t, CUTS["s2b"], CUTS["s3"])
        dx, dy = drift(t, 6, 8)
        ctx.push()
        cam(ctx, 540 + dx, 1000 + dy, lerp(1.0, 1.16, ease_io(u)), rot=2 - 3 * u)
        f = bro_steamy_face(t, look=(0.0, 0.05), eyes=0.55)
        f["brow_in"] = -0.8
        with ctx.at(540, 820 + r * 10, rot=-3 + r * 0.6, sx=2.0):
            draw_head(ctx, "bro", f, bust=True, t=t)
        breath_fog(c, t, 560, 1180, 0.9, 0.22 * (0.3 + mouth(t, "bro")), dir_=(0.15, 1.0), size=1.6)
        ctx.pop()


def s3(ctx, t):
    c = ctx.c
    ctx.light = STEAMY
    r = rock(t)
    hb = 0.0
    for b in HEARTBEATS:
        hb = max(hb, impact(t, b, 1.0, 9.0))
    steamy_bg(ctx, t, pulse=hb)
    orbit = (t - CUTS["s3"]) * 3.0  # slow circling camera (degrees)
    if t < CUTS["s3b"]:
        u = seg(t, CUTS["s3"], CUTS["s3b"])
        ctx.push()
        cam(ctx, 540, 1000, 1.0 + 0.04 * hb + 0.05 * u, rot=orbit - 4)
        f = bro_steamy_face(t, look=(0, 0.2), eyes=0.85)
        f["brow_in"] = -0.9
        with ctx.at(540, 830 + r * 26, rot=4 + r * 1.5, sx=1.85):
            draw_head(ctx, "bro", f, bust=True, t=t)
        ctx.pop()
    elif t < CUTS["s3c"]:
        u = seg(t, CUTS["s3b"], CUTS["s3c"])
        ctx.push()
        cam(ctx, 540, 980, 1.0 + 0.04 * hb + 0.05 * u, rot=orbit - 6)
        f = you_steamy_face(t, speaking=False)
        f["open"] = clamp(0.35 + 0.35 * (-r))
        with ctx.at(540, 830 + r * 26, rot=-6 + r * 1.5, sx=1.85):
            draw_head(ctx, "you", f, bust=True, t=t)
        breath_fog(c, t, 540, 1000, 0.4, 0.28, dir_=(0.1, -1.0), size=1.4, seed=2)
        ctx.pop()
    elif t < CUTS["s3d"]:
        # water bottle on the floor shaking with every beat
        u = seg(t, CUTS["s3c"], CUTS["s3d"])
        ctx.push()
        cam(ctx, 540, 1000, 1.0 + 0.06 * u, rot=orbit * 0.5)
        lin_grad_rect(c, (-400, 1250, 1500, 2600), (0, 1250), (0, 2000), [(hexc("3a0c12"), 1), (hexc("0d0204"), 1)])
        for k in range(-6, 8):
            c.drawLine(540 + k * 90, 1250, 540 + k * 260, 2600, paint(hexc("140306"), 0.8, "stroke", 4))
        for yy in (1330, 1480, 1700, 2000):
            c.drawLine(-400, yy, 1500, yy, paint(hexc("140306"), 0.8, "stroke", 4))
        glow_circle(c, 640, 1000, 600, (1, 0.3, 0.35), 0.25)
        beat = 0.0
        for b in BEATS3:
            beat = max(beat, impact(t, b, 1.0, 10.0))
        with layer(ctx, alpha=0.25):
            with ctx.at(0, 2 * 1440, sy=-1):
                draw_bottle(ctx, 560, 1440, 1.45, t, shake=0.25 + beat)
        draw_bottle(ctx, 560, 1430 - beat * 14, 1.45, t, shake=0.25 + beat)
        c.save()
        c.translate(560, 1440)
        c.scale(1, 0.2)
        c.drawCircle(0, 0, 200, paint((0, 0, 0), 0.5, blur=30))
        c.restore()
        for k in range(2):
            rr = 150 + (t * 600 + k * 120) % 300
            shock_ring(c, 560, 1440, rr, 0.25 * beat, sy=0.18, width=6, color=(1, 0.5, 0.5))
        ctx.pop()
    elif t < CUTS["s3e"]:
        u = seg(t, CUTS["s3d"], CUTS["s3e"])
        ctx.push()
        cam(ctx, 540, 990, 1.0 + 0.04 * hb + 0.06 * u, rot=orbit - 8)
        f = you_steamy_face(t)
        if t > wt("HEAVY") - 0.05:
            k = seg(t, wt("HEAVY") - 0.05, wt("HEAVY") + 0.15)
            f["squeeze"] = 1 - k
            f["eyes"] = lerp(0.0, 0.55, k)
            f["look"] = (0.1, -0.9)
            f["brow_in"] = 1.0
        with ctx.at(540, 840 + r * 22, rot=-8 + r * 1.5, sx=1.9):
            draw_head(ctx, "you", f, bust=True, t=t)
        breath_fog(c, t, 540, 1030, 0.45, 0.25, dir_=(0.1, -1.0), size=1.4, seed=3)
        ctx.pop()
    elif t < CUTS["s3f"]:
        ctx.push()
        cam(ctx, 540, 1000, 1.0 + 0.04 * hb, rot=orbit - 3)
        f = bro_steamy_face(t, look=(0, 0.5), eyes=0.75, drip=seg(t, CUTS["s3e"], CUTS["s3f"] + 0.3))
        f["brow_in"] = -1.0
        with ctx.at(560, 800 + r * 18, rot=10 + r, sx=1.75):
            draw_head(ctx, "bro", f, bust=True, t=t)
        breath_fog(c, t, 560, 1100, 0.5, 0.22, dir_=(0.0, 1.0), size=1.3, seed=4)
        ctx.pop()
    else:
        u = seg(t, CUTS["s3f"], CUTS["s4"])
        ctx.push()
        cam(ctx, 540 + math.sin(u * 3) * 20, 960, lerp(1.0, 1.15, ease_in(u)) + 0.05 * hb, rot=orbit - 10 + u * 6)
        f = you_steamy_face(t)
        f["brow_in"] = 1.0
        f["veins"] = 0.6 * u
        with ctx.at(540, 860 + r * 18, rot=-10 + r, sx=2.25):
            draw_head(ctx, "you", f, bust=True, t=t)
        ctx.pop()


# ----------------------------------------------------------------------------
# bench set (scenes 4 + 5): front view from the foot of the bench
# ----------------------------------------------------------------------------
BRO_X, BRO_GROUND, BRO_S = 540.0, 1265.0, 0.45
BAR_Y = 860.0
LIFT_K = 0.42


def draw_bro_spotter(ctx, t, fc, two_finger=True, blown=0.0):
    c = ctx.c
    tgt = []
    for s in (-1, 1):
        hx, hy = BRO_X + s * 52, 968.0
        lx, ly = (hx - BRO_X) / BRO_S, (hy - BRO_GROUND) / BRO_S
        a, b = ik_arm("bro", s, lx, ly, elbow_out=1.0)
        tgt.append((a, b, "none"))
    ps = pose(arms=tuple(tgt), breath=math.sin(t * 2.2), head_rot=-blown * 6)
    with ctx.at(BRO_X, BRO_GROUND, sx=BRO_S):
        draw_body_front(ctx, LOOK_BRO, ps, fc, t)


def draw_bro_hands(ctx, t, lift=0.0):
    for s in (-1, 1):
        hx, hy = BRO_X + s * 52, 968.0 - lift
        with ctx.at(hx, hy, rot=180 + s * 8, sx=0.62):
            draw_hand(ctx, "bro", "two")


def draw_lifter(ctx, t, fc, bend, bar_y, red=0.0, tremble=0.0, legs=True):
    c = ctx.c
    k = LIFT_K
    P = body_parts(("you", "e2a477", "8f959d", "1c1c22", "f4f4f4", False))
    sk = skin_of("you", face(red=red))
    tr = tremble * math.sin(t * 2 * math.pi * 11) * 3
    # torso (foreshortened, toward camera)
    torso = [(540 - 128, 1068), (540 + 128, 1068), (540 + 150, 1240), (540 + 158, 1392), (540 - 158, 1392),
             (540 - 150, 1240)]
    poly_mesh(tuple(torso), "e2a477", seed=40, n=10, dome=0.5).draw(ctx, color=sk)
    tank = [(540 - 70, 1078), (540 - 38, 1150), (540, 1168), (540 + 38, 1150), (540 + 70, 1078), (540 + 112, 1090),
            (540 + 132, 1240), (540 + 152, 1395), (540 - 152, 1395), (540 - 132, 1240), (540 - 112, 1090)]
    poly_mesh(tuple(tank), "8f959d", seed=41, n=14, dome=0.55).draw(ctx)
    # arms to the bar
    for s in (-1, 1):
        S = (540 + s * 126, 1082)
        T = (540 + s * 232, bar_y + 14 + tr)
        L1, L2 = 300 * k, 270 * k
        d = np.array(T) - np.array(S)
        dist = clamp(float(np.hypot(*d)), 10, L1 + L2 - 0.5)
        base = math.atan2(d[1], d[0])
        al = math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1))
        ang = base - s * al * (-1)
        E = (S[0] + math.cos(ang) * L1, S[1] + math.sin(ang) * L1)
        with ctx.at(0, 0):
            for (p0, p1, mesh, L0) in ((S, E, P["ua"], 300), (E, T, P["fa"], 270)):
                dd = np.array(p1) - np.array(p0)
                LL = float(np.hypot(*dd))
                a_ = math.degrees(math.atan2(-dd[0], dd[1]))
                with ctx.at(p0[0], p0[1], rot=a_, sx=k, sy=k * (LL / (L0 * k))):
                    mesh.draw(ctx, color=sk)
        with ctx.at(S[0], S[1] - 4, sx=k):
            P["delt"].draw(ctx, color=sk)
    # head (face up, chin toward camera)
    with ctx.at(540, 1012 + tr * 0.3, sx=0.34, sy=0.33):
        draw_head(ctx, "you", fc, bust=False, t=t)
    if legs:
        draw_lifter_legs(ctx, t, sk)


def draw_lifter_legs(ctx, t, sk):
    c = ctx.c
    P = body_parts(("you", "e2a477", "8f959d", "1c1c22", "f4f4f4", False))
    shorts = [(540 - 160, 1372), (540 + 160, 1372), (540 + 196, 1470), (540 + 120, 1500), (540, 1478),
              (540 - 120, 1500), (540 - 196, 1470)]
    for s in (-1, 1):
        hip = (540 + s * 100, 1450)
        knee = (540 + s * 205, 1585)
        ankle = (540 + s * 262, 1790)
        for (p0, p1, mesh, L0, kk) in ((hip, knee, P["thigh"], 358, 0.62), (knee, ankle, P["shin"], 358, 0.6)):
            dd = np.array(p1) - np.array(p0)
            LL = float(np.hypot(*dd))
            a_ = math.degrees(math.atan2(-dd[0], dd[1]))
            with ctx.at(p0[0], p0[1], rot=a_, sx=kk, sy=LL / L0):
                mesh.draw(ctx, color=sk)
        c.drawRect(skia.Rect.MakeLTRB(ankle[0] - 24, ankle[1] - 26, ankle[0] + 24, ankle[1] + 4), paint(hexc("f2f2f2")))
        with ctx.at(ankle[0] + s * 6, ankle[1] + 22, sx=s * 0.72, sy=0.72):
            P["shoe"].draw(ctx)
            c.drawRect(skia.Rect.MakeLTRB(-66, 30, 66, 44), paint(hexc("9a9aa2")))
    poly_mesh(tuple(shorts), "1c1c22", seed=42, n=8, dome=0.5).draw(ctx)


def bystander_front(ctx, t, look, x, y, s, react, turn_to, seed=0, holding=None):
    """react: 0..1 horror amount; turn_to: final head turn."""
    k = smooth(react)
    fc = face(turn=lerp(-turn_to * 0.6, turn_to, k), eyes=lerp(1.0, 1.28, k), pupil=lerp(1.0, 0.55, k),
              brow_up=lerp(0.0, 1.0, k), open=lerp(0.05, 0.75, k) + 0.05 * math.sin(t * 20) * k, smile=-0.25 * k)
    blink = (t * 0.41 + seed * 0.3) % 1.0
    if blink < 0.03 and k < 0.5:
        fc["eyes"] = 0.05
    if holding == "curl":
        cu = 0.5 + 0.5 * math.sin(t * 4 + seed)
        arms = ((10, 20 + 100 * cu * (1 - k), "fist"), (10, 20 + 100 * (1 - cu) * (1 - k), "fist"))
    else:
        arms = ((8 + 10 * k, 12 + 120 * k, "fist"), (8 + 10 * k, 12 + 120 * k, "fist"))
    ps = pose(arms=arms, breath=math.sin(t * 2 + seed), bob=-k * 20)
    with ctx.at(x, y, sx=s):
        draw_body_front(ctx, look, ps, fc, t)


def bench_set(ctx, t, lights=1.0, bend=0.7, you_face=None, bro_face=None, react=(0, 0, 0), red=0.0, tremble=0.3,
              shock=None, fog=0.0, bar_y=BAR_Y, people_turn=1.0, blown=0.0, bro_lift=0.0):
    c = ctx.c
    draw_gym_back(ctx, t, fog=fog, shock=shock, lights_on=lights)
    draw_lamps(ctx, t, on=lights)
    draw_floor(ctx, t, lights_on=lights)
    # bystanders behind
    bystander_front(ctx, t, EXTRAS[2], 330, 905, 0.21, react[2], 0.6, seed=3, holding="curl")
    bystander_front(ctx, t, EXTRAS[0], 150, 935, 0.27, react[0], 0.7, seed=1)
    bystander_front(ctx, t, EXTRAS[1], 935, 940, 0.27, react[1], -0.7, seed=2)
    draw_bench_back(ctx)
    draw_bro_spotter(ctx, t, bro_face or face(smile=0.35, eyes=0.8, brow_up=0.25, look=(0, 0.7)), blown=blown)
    draw_lifter(ctx, t, you_face or face(teeth=0.6, smile=-0.25, brow_in=0.6, squeeze=0.5, sweat=0.8), bend, bar_y,
                red=red, tremble=tremble, legs=False)
    draw_bro_hands(ctx, t, bro_lift)
    draw_barbell(ctx, t, bend=bend, y=bar_y, tremble=tremble)
    # fists on top of the bar
    for s in (-1, 1):
        with ctx.at(540 + s * 232, bar_y + 26 + tremble * math.sin(t * 2 * math.pi * 11) * 3, rot=180, sx=LIFT_K * 1.1):
            draw_hand(ctx, "you", "fist", red, knuckle_white=0.5)
    draw_bench_front(ctx)
    draw_lifter_legs(ctx, t, skin_of("you", face(red=red)))


def s4(ctx, t):
    c = ctx.c
    t0 = CUTS["s4"]
    pull = ease_io(seg(t, t0 + 0.15, t0 + 0.85), 3.2)
    zoom = lerp(3.6, 1.0, pull)
    cy = lerp(990, 975, pull)
    # push to the two fingers on "spotting", back out on "bench press"
    p2 = ease_io(seg(t, PUSH_IN_FINGERS - 0.1, PUSH_IN_FINGERS + 0.3)) * (1 - ease_io(seg(t, wt("BENCH") - 0.05, wt("BENCH") + 0.45)))
    zoom = zoom * (1 + 0.85 * p2)
    cy = lerp(cy, 900, p2)
    dx, dy = drift(t, 21, 8 * pull)
    ctx.light = GYM
    ctx.push()
    cam(ctx, 540 + dx, cy + dy, zoom, sh=shake(t, impact(t, t0, 10, 8)))
    surprise = seg(t, t0 + 0.02, t0 + 0.12)
    yf = face(eyes=lerp(0.0, 1.3, surprise), squeeze=1 - surprise, pupil=0.6, brow_up=surprise * 0.9,
              open=0.45 + 0.1 * math.sin(t * 9), sweat=1.0, smile=-0.2, red=0.2)
    if t > t0 + 0.9:
        k = seg(t, t0 + 0.9, t0 + 1.2)
        yf = face(teeth=0.7 * k, smile=-0.25, brow_in=0.7 * k, eyes=lerp(1.2, 0.5, k), pupil=0.8, sweat=1,
                  red=0.2 + 0.1 * k, open=0.45 * (1 - k) + 0.3 * k, look=(0, -0.6))
    bf = face(smile=0.45, eyes=0.82, brow_up=0.3, look=(0, 0.9), open=0.05)
    if t0 + 0.5 < t < t0 + 1.4:
        bf["smile"] = 0.6
    react = tuple(seg(t, t0 + 0.55 + 0.2 * i, t0 + 1.0 + 0.2 * i) for i in range(3))
    bench_set(ctx, t, lights=1.0, bend=0.75 + 0.06 * math.sin(t * 3), you_face=yf, bro_face=bf, react=react,
              red=0.2, tremble=0.45)
    # sparkle on the two fingers
    if PUSH_IN_FINGERS + 0.15 < t < PUSH_IN_FINGERS + 0.75:
        u = seg(t, PUSH_IN_FINGERS + 0.15, PUSH_IN_FINGERS + 0.75)
        for sx_ in (-1, 1):
            x, y = 540 + sx_ * 48, 868
            a = math.sin(u * math.pi)
            c.drawPath(poly_path([(x, y - 34 * a), (x + 6, y - 6), (x + 34 * a, y), (x + 6, y + 6), (x, y + 34 * a),
                                  (x - 6, y + 6), (x - 34 * a, y), (x - 6, y - 6)]), paint((1, 1, 0.85), a))
            glow_circle(c, x, y, 50, (1, 1, 0.7), 0.6 * a)
    ctx.pop()
    flash(c, 0.85 * (1 - ease_out(seg(t, t0, t0 + 0.3))))
    comic(c, "CLACK!", 540, 420, 150, t, t0, 0.6, col=hexc("ffffff"), rot=-6)


def s5(ctx, t):
    c = ctx.c
    ctx.light = GYM
    if t < CUTS["s5c"]:
        if t < CUTS["s5b"]:
            u = seg(t, CUTS["s5"], CUTS["s5b"])
            zoom = lerp(2.5, 3.05, ease_io(u))
            red = lerp(0.3, 0.7, u)
            tr = 0.6
            cy = 960
            yf = face(teeth=1.0, smile=-0.35, brow_in=0.9, squeeze=0.75, sweat=1, red=red, veins=lerp(0.5, 1.0, u),
                      open=0.25)
            bend = lerp(0.8, 1.05, u)
        else:
            u = seg(t, CUTS["s5b"], CUTS["s5c"])
            zoom = lerp(4.4, 5.0, ease_io(u))
            red = 1.0
            tr = 1.0
            cy = 995
            ant = seg(t, CUTS["s5c"] - 0.22, CUTS["s5c"] - 0.02)
            yf = face(teeth=1.0 - ant * 0.5, smile=-0.4, brow_in=1.0, eyes=lerp(1.35, 0.0, ant), squeeze=ant,
                      pupil=0.45, sweat=1, red=1.0, veins=1.0, open=0.32 + ant * 0.2, cheek=1)
            bend = 1.05 + 0.1 * u
        sh = shake(t, 3 + 6 * tr, seed=31, freq=14)
        ctx.push()
        cam(ctx, 540, cy, zoom, sh=sh)
        bf = face(smile=0.35, eyes=0.8, brow_up=0.35, look=(0, 0.9))
        bench_set(ctx, t * 0.35 + 10, lights=1.0, bend=bend, you_face=yf, bro_face=bf, react=(1, 1, 1), red=red,
                  tremble=tr)
        ctx.pop()
        # slow-mo heat haze tint
        radial_fill(c, 540, 960, 1200, [(hexc("ff3b1f"), 0.0), (hexc("ff3b1f"), 0.12 * red)], [0.5, 1],
                    rect=(0, 0, W, H))
        return
    # BLAST
    tb = BLAST
    u = t - tb
    sh = shake(t, impact(t, tb, 46, 3.2) + 4, seed=41, freq=20)
    ctx.push()
    cam(ctx, 540, 990, 1.0 + 0.05 * ease_out(seg(t, tb, tb + 1.0)) - 0.04 * impact(t, tb, 1, 8), sh=sh)
    yf = face(eyes=1.0, smile=0.6, open=0.25, brow_up=0.5, red=lerp(1.0, 0.3, seg(t, tb, tb + 0.8)), sweat=1)
    bf = face(eyes=1.3, pupil=0.5, brow_up=1.0, open=0.8, smile=-0.3, look=(0, 0.6))
    bench_set(ctx, t, lights=1.0, bend=lerp(1.1, 0.4, ease_out(seg(t, tb, tb + 0.4))), you_face=yf, bro_face=bf,
              react=(1, 1, 1), red=0.4, tremble=0.2, shock=(tb, 540), fog=seg(t, tb + 0.25, tb + 1.0) * 0.8,
              bar_y=BAR_Y - 40 * ease_out(seg(t, tb, tb + 0.3)), blown=1.0)
    for i in range(3):
        rr = (u - i * 0.12) * 2300
        if rr > 0:
            shock_ring(c, 540, 1440, rr, clamp(1 - rr / 2300) * 0.9, sy=0.3, width=20)
    puffs = blast_puffs(t, tb, (540, 1440), n=40, spread=1.0, seed=10, floor_y=1900)
    draw_puffs(ctx, puffs, alpha=1.0)
    stink_lines(c, 540, 1300, 260, t, alpha=clamp(u * 3), n=4)
    ctx.pop()
    flash(c, 0.75 * (1 - ease_out(seg(t, tb, tb + 0.25))), color=(0.85, 1, 0.75))
    comic(c, "PFFFRRRRT!!", 540, 430, 150, t, tb + 0.02, 1.0, col=GREEN, rot=-7)


# ----------------------------------------------------------------------------
# SCENE 6: fly-through
# ----------------------------------------------------------------------------
STATIONS = [(700, "tread", EXTRAS[3]), (1600, "selfie", EXTRAS[5]), (2500, "curl", EXTRAS[1]),
            (3350, "squat", EXTRAS[0])]
PAN_Y = 1500


def pan_x(t):
    u = seg(t, CUTS["s6"], CUTS["s7"])
    return lerp(380, 3450, u * 0.86 + 0.14 * ease_io(u))


def draw_pano_bg(ctx, t, front):
    c = ctx.c
    with ctx.at(-600, -500):
        rect_mesh(4800, 2000, "2c2e35", seed=51, n=60, dome=0.12, jitter=0.1).draw(ctx)
    with ctx.at(-600, 360):
        rect_mesh(4800, 60, "b81f24", seed=52, n=40, dome=0.2, jitter=0.1).draw(ctx)
    for x in range(-600, 4200, 300):
        c.drawRect(skia.Rect.MakeXYWH(x, -500, 30, 700), paint(hexc("1d1e22")))
    # mirrors
    for k, mx in enumerate(range(1200, 2050, 290)):
        fog = clamp((front - mx) / 380)
        c.drawRect(skia.Rect.MakeLTRB(mx - 10, 480, mx + 280, 1320), paint(hexc("15161a")))
        lin_grad_rect(c, (mx, 490, mx + 270, 1310), (mx, 490), (mx + 270, 1310),
                      [(hexc("4a5562"), 1), (hexc("2a313a"), 1), (hexc("3c4652"), 1)], [0, 0.55, 1])
        c.drawPath(poly_path([(mx + 160, 490), (mx + 220, 490), (mx + 60, 1310), (mx, 1310)]), paint((1, 1, 1), 0.06))
        if fog > 0:
            lin_grad_rect(c, (mx, 490, mx + 270, 1310), (0, 1310), (0, 490), [(GREEN, 0.8 * fog), (GREEN_D, 0.5 * fog)])
    # windows
    for wx in (2850, 3150, 3700):
        c.drawRect(skia.Rect.MakeLTRB(wx, 520, wx + 220, 1000), paint(hexc("15161a")))
        lin_grad_rect(c, (wx + 12, 532, wx + 208, 988), (0, 532), (0, 988), [(hexc("9fd2ff"), 1), (hexc("ffe3b0"), 1)])
    for lx in range(200, 4000, 500):
        draw_lamps(ctx, t, on=1.0, xs=(lx,), y=40, cone=True)
    lin_grad_rect(c, (-600, PAN_Y, 4400, 2600), (0, PAN_Y), (0, 2400), [(hexc("2e2f35"), 1), (hexc("17181c"), 1)])
    for x in range(-600, 4400, 160):
        c.drawLine(x, PAN_Y, x - 200, 2600, paint(hexc("15161a"), 0.6, "stroke", 3))


def draw_station(ctx, t, x, kind, look, react):
    c = ctx.c
    k = smooth(react)
    s = 0.44
    gy = PAN_Y + 60
    fc = face(turn=lerp(0.55, -0.55, k), eyes=lerp(1.0, 1.32, k), pupil=lerp(1.0, 0.5, k), brow_up=k,
              open=lerp(0.05, 0.85, k), smile=-0.3 * k, look=(lerp(0.5, -0.4, k), 0))
    if kind == "tread":
        bob = abs(math.sin(t * 9)) * 18 * (1 - k)
        sw = math.sin(t * 9) * 35 * (1 - k)
        arms = ((20 + sw, 90 - 20 * k, "fist"), (20 - sw, 90 - 20 * k, "fist"))
        if k > 0.5:
            arms = ((25, 150, "open", dict(spread=1.0)), (25, 150, "open", dict(spread=1.0)))
        with ctx.at(x, gy - 40 - bob, sx=s):
            draw_body_front(ctx, look, pose(arms=arms, breath=math.sin(t * 6)), fc, t)
        # treadmill console in front
        c.drawRect(skia.Rect.MakeLTRB(x - 230, gy - 470, x - 210, gy + 20), paint(hexc("1a1a1e")))
        c.drawRect(skia.Rect.MakeLTRB(x + 210, gy - 470, x + 230, gy + 20), paint(hexc("1a1a1e")))
        poly_mesh(((-250, 0), (250, 0), (270, 260), (-270, 260)), "22232a", seed=61, n=8, dome=0.3).draw(ctx) if False else None
        with ctx.at(x, gy - 330):
            poly_mesh(((-250, 0), (250, 0), (280, 330), (-280, 330)), "22232a", seed=61, n=8, dome=0.35).draw(ctx)
            c.drawRect(skia.Rect.MakeLTRB(-120, 40, 120, 120), paint(hexc("0c2a3a")))
            draw_words(c, [("6.2", hexc("4fe3ff"))], 0, 80, 46, outline=0.0, shadow=False)
    elif kind == "selfie":
        with ctx.at(x, gy, sx=s):
            ph = (1 - k)
            arms = ((95, 115, "fist"), (35 + 10 * k, 125 - 40 * k, "fist"))
            draw_body_front(ctx, look, pose(arms=arms, bulge=0.8 * ph, vein=0.5 * ph, breath=math.sin(t * 2)), fc, t)
            wp = wrist_pos("you", 1, arms[1][0], arms[1][1])
        # phone (falls when horrified)
        px, py = x + wp[0] * s, gy + wp[1] * s
        if k > 0.3:
            fall = (k - 0.3) / 0.7
            py += fall * fall * 700
        with ctx.at(px, py, rot=-10 + 200 * clamp(k - 0.3)):
            c.drawRoundRect(skia.Rect.MakeLTRB(-26, -48, 26, 48), 8, 8, paint(hexc("15151a")))
            c.drawRoundRect(skia.Rect.MakeLTRB(-21, -42, 21, 40), 5, 5, paint(hexc("3fa9ff"), 0.85))
    elif kind == "curl":
        with ctx.at(x, gy, sx=s):
            cu = 0.5 + 0.5 * math.sin(t * 5)
            if k < 0.4:
                arms = ((10, 25 + 105 * cu, "fist"), (10, 25 + 105 * (1 - cu), "fist"))
            else:
                arms = ((25, 155, "open", dict(spread=0.8)), (25, 155, "open", dict(spread=0.8)))
            draw_body_front(ctx, look, pose(arms=arms, breath=math.sin(t * 2)), fc, t)
            wps = [wrist_pos("you", sd, arms[i][0], arms[i][1]) for i, sd in ((0, -1), (1, 1))]
        for i, wp in enumerate(wps):
            dxp, dyp = x + wp[0] * s, gy + wp[1] * s
            if k >= 0.4:
                base_w = wrist_pos("you", -1 if i == 0 else 1, 10, 25)
                dxp, dyp = x + base_w[0] * s, gy + base_w[1] * s
                fall = clamp((k - 0.4) / 0.4)
                dyp = min(gy + 30, dyp + fall * fall * 600)
            draw_dumbbell(ctx, dxp, dyp + 20, 26, RED, rot=90 if k < 0.4 else 90 + 60 * k, seed=i)
    elif kind == "squat":
        arms = ((105, 115, "fist"), (105, 115, "fist"))
        wob = math.sin(t * 25) * 6 * k
        with ctx.at(x, gy, sx=s):
            draw_body_front(ctx, look, pose(arms=arms, squash=1 - 0.04 * math.sin(t * 3), vein=k), fc, t)
        by = gy - 1290 * s + wob
        strip_facets(ctx, [(x - 420, by), (x + 420, by)], 18, CHROME, seed=3, spec=0.8)
        for sd in (-1, 1):
            for j in range(3):
                with ctx.at(x + sd * (300 + j * 32), by):
                    plate_side_mesh(28, 150 - j * 20, "c62428" if j % 2 == 0 else "1b1b20").draw(ctx)


def s6(ctx, t):
    c = ctx.c
    ctx.light = GYM
    cx = pan_x(t)
    front = cx - 140 + 260 * seg(t, CUTS["s6"], CUTS["s6"] + 0.3)
    bank = math.sin((t - CUTS["s6"]) * 2.6) * 2.5
    sh = shake(t, 4 + impact(t, CUTS["s6"], 14, 4), seed=51)
    ctx.push()
    cam(ctx, cx, 1000, 1.0, rot=bank, sh=sh)
    draw_pano_bg(ctx, t, front)
    # rolling cloud bank (behind the people)
    puffs, low = [], []
    for i in range(52):
        bx = front - 2500 + i * 50 + noise1(t * 0.8 + i, 3) * 30
        if bx > front + 40:
            continue
        grow = smooth(clamp((front - bx) / 260))
        y = PAN_Y - 80 - (rnd(i, 9) ** 1.2) * 1000 - 120 * grow + math.sin(t * 2 + i) * 20
        r = (80 + 110 * rnd(i, 8)) * (0.35 + 0.65 * grow)
        puffs.append((bx, y, r, i + 500))
        low.append((bx + 25, PAN_Y + 40 + 60 * rnd(i, 4), r * (0.55 + 0.3 * rnd(i, 6)), i + 600))
    draw_puffs(ctx, puffs, alpha=1.0)
    for x, kind, look in STATIONS:
        react = seg(front, x - 420, x - 80)
        draw_station(ctx, t, x, kind, look, react)
    draw_puffs(ctx, low, alpha=0.95, glow=0.6)
    stink_lines(c, front - 100, PAN_Y - 600, 300, t, 0.8, n=3)
    # echo rings
    for i, te in enumerate(ECHOES):
        u = t - te
        if 0 < u < 1.2:
            rr = 120 + u * 1100
            a = (1 - u / 1.2) * 0.9
            c.drawCircle(front, 1050, rr, paint(GREEN_L, a * 0.5, "stroke", 26, blur=10))
            c.drawCircle(front, 1050, rr, paint((1, 1, 1), a, "stroke", 6))
    ctx.pop()
    # echo words (screen space)
    for i, (te, txt, sz) in enumerate(zip(ECHOES, ("FRRRT...", "frrt...", "rrt..."), (120, 95, 75))):
        comic(c, txt, 540 + (i - 1) * 140, 380 + i * 70, sz, t, te - 0.02, 0.9, col=GREEN_L, rot=-6 + i * 5)
    comic(c, "PFFFRRRRT!!", 540, 430, 150, t, CUTS["s6"] - 0.95, 1.0, col=GREEN, rot=-7)


# ----------------------------------------------------------------------------
# SCENE 7: twelve people leave, trainer quits
# ----------------------------------------------------------------------------
DOOR = (640, 640, 320, 860)  # x0, y0, w, h
RUNNERS = [
    dict(skin="e2a477", shirt="3b7dd8", hair="short", hair_color="2a1f18"),
    dict(skin="8d5a3b", shirt="2bb3a6", hair="bald"),
    dict(skin="f0c09a", shirt="f2c230", hair="ponytail", hair_color="8a5a2b"),
    dict(skin="c99067", shirt="6a4cc9", hair="short", hair_color="1c140f"),
    dict(skin="a8714a", shirt="ff7a3d", hair="short", hair_color="1a1410"),
    dict(skin="f2c6a0", shirt="e84393", hair="ponytail", hair_color="d9b36c"),
    dict(skin="e8b48e", shirt="27ae60", hair="short", hair_color="5a3a22"),
    dict(skin="7a4a2e", shirt="f2f2f2", hair="bald"),
    dict(skin="d9a47c", shirt="c0392b", hair="short", hair_color="111111"),
    dict(skin="f0c09a", shirt="16a085", hair="ponytail", hair_color="2a1f18"),
    dict(skin="b07850", shirt="8e44ad", hair="short", hair_color="2a1f18"),
    dict(skin="e2a477", shirt="2c3e50", hair="short", hair_color="7a5230"),
]


def exit_room(ctx, t, green=0.4):
    c = ctx.c
    x0, y0, w, h = DOOR
    with ctx.at(-500, -400):
        rect_mesh(2200, 2000, "2c2e35", seed=71, n=40, dome=0.12, jitter=0.1).draw(ctx)
    with ctx.at(-500, 380):
        rect_mesh(2200, 56, "b81f24", seed=72, n=24, dome=0.2, jitter=0.1).draw(ctx)
    draw_lamps(ctx, t, on=1.0, xs=(160, 480), y=60, cone=True)
    lin_grad_rect(c, (-500, y0 + h, 1600, 2600), (0, y0 + h), (0, 2300), [(hexc("2e2f35"), 1), (hexc("17181c"), 1)])
    draw_door(ctx, t, 1.0, x0, y0, w, h)
    if green > 0:
        radial_fill(c, -100, 1300, 1100, [(GREEN, 0.45 * green), (GREEN_D, 0.0)], [0, 1], rect=(-500, -400, 1600, 2600),
                    blend=skia.BlendMode.kScreen)


def exit_front(ctx, t, door_open):
    x0, y0, w, h = DOOR
    c = ctx.c
    # wall right of the door covers runners passing through
    with ctx.at(x0 + w, -400):
        rect_mesh(900, y0 + h + 400, "2c2e35", seed=73, n=10, dome=0.12, jitter=0.1).draw(ctx)
    with ctx.at(x0 + w, 380):
        rect_mesh(900, 56, "b81f24", seed=74, n=6, dome=0.2, jitter=0.1).draw(ctx)
    draw_wall_frame(ctx, x0, y0, w, h)
    draw_door_panel(ctx, door_open, x0, y0, w, h)


def counter_badge(c, t, n, t_last):
    if n <= 0:
        return
    u = t - t_last
    sc = pop(u / 0.16) * (1.25 if n == 12 else 1.0)
    c.save()
    c.translate(540, 330)
    c.scale(sc, sc)
    c.drawCircle(0, 0, 135, paint((0, 0, 0), 0.5, blur=14))
    c.drawCircle(0, 0, 125, paint(hexc("c9252a")))
    c.drawCircle(0, 0, 125, paint((1, 1, 1), 1, "stroke", 10))
    draw_words(c, [(str(n), (1, 1, 1))], 0, -4, 150, outline=0.1, shadow=False)
    c.restore()
    draw_words(c, [("PEOPLE OUT", hexc("ffd60a"))], 540, 505, 54, outline=0.16)


def s7(ctx, t):
    c = ctx.c
    ctx.light = GYM
    if t < CUTS["s7b"]:
        ctx.push()
        dx, dy = drift(t, 71, 10)
        cam(ctx, 560 + dx, 1000 + dy, 1.02 + 0.04 * seg(t, CUTS["s7"], CUTS["s7b"]), sh=shake(t, 5, 72))
        exit_room(ctx, t)
        x0, y0, w, h = DOOR
        order = []
        for k, te in enumerate(EXITS):
            depth = rnd(k, 5)
            gy = y0 + h + 40 + depth * 260
            s = 0.33 + 0.12 * depth
            speed = 2600
            x = 800 + (t - te) * speed
            if x < -400 or x > x0 + w + 250:
                continue
            order.append((gy, k, x, s))
        for gy, k, x, s in sorted(order):
            with ctx.at(x, gy, sx=s):
                draw_runner(ctx, RUNNERS[k], t * 22 + k * 1.7, t, horror=1.0, hold_nose=(k % 3 != 1))
        exit_front(ctx, t, 1.0)
        # green wisps chasing
        puffs = [(-150 + i * 90 + noise1(t + i, 2) * 30, 1450 - rnd(i, 3) * 500, 80 + 60 * rnd(i, 4), 700 + i)
                 for i in range(5)]
        draw_puffs(ctx, puffs, alpha=0.9)
        ctx.pop()
        n = sum(1 for te in EXITS if t >= te)
        t_last = max([te for te in EXITS if t >= te], default=0)
        counter_badge(c, t, n, t_last)
        return
    if t < CUTS["s7c"]:
        # trainer throws whistle + clipboard
        u = seg(t, CUTS["s7b"], CUTS["s7c"])
        ctx.push()
        cam(ctx, 540, 960, 1.0, sh=shake(t, impact(t, TRAINER_THROW + 0.12, 26, 6), 73))
        gym_soft_bg(ctx, t, green=0.8)
        look = dict(kind="extra", skin="b07850", shirt="1f3a6b", shorts="2a2a33", hair="cap", hair_color="1b2a4a",
                    sleeve=True)
        raise_k = ease_out(seg(t, CUTS["s7b"], TRAINER_THROW - 0.05))
        throw_k = ease_in(seg(t, TRAINER_THROW - 0.05, TRAINER_THROW + 0.08))
        a_r = lerp(lerp(40, 150, raise_k), 25, throw_k)
        b_r = lerp(lerp(90, 30, raise_k), 5, throw_k)
        arms = ((lerp(30, 120, raise_k) * (1 - throw_k) + 30 * throw_k, lerp(100, 40, raise_k), "fist"),
                (a_r, b_r, "fist"))
        fc = face(brow_in=-1.0, open=0.35 + 0.5 * mouth(t, "x") + 0.3 * throw_k, smile=-0.5, eyes=1.0, red=0.35)
        S = 0.95
        GX, GY = 540, 2280
        with ctx.at(GX, GY, sx=S):
            draw_body_front(ctx, look, pose(arms=arms, vein=0.5), fc, t)
            # lanyard + whistle
            c.drawPath(poly_path([(-50, -1330), (0, -1180), (50, -1330)], close=False),
                       paint(hexc("ffd60a"), 1, "stroke", 9))
        released = t >= TRAINER_THROW
        wp = wrist_pos("you", 1, a_r, b_r)
        hx, hy = GX + wp[0] * S, GY + wp[1] * S
        if not released:
            with ctx.at(hx, hy, rot=-a_r + 20):
                c.drawRoundRect(skia.Rect.MakeLTRB(-90, -130, 90, 130), 10, 10, paint(hexc("8a5a2b")))
                c.drawRect(skia.Rect.MakeLTRB(-75, -105, 75, 118), paint(hexc("f5f2ea")))
                for k in range(6):
                    c.drawLine(-60, -70 + k * 30, 60, -70 + k * 30, paint(hexc("99aaaa"), 0.8, "stroke", 3))
                c.drawRect(skia.Rect.MakeLTRB(-40, -140, 40, -110), paint(hexc("c9ced6")))
            wx, wy = GX + 0, GY - 1180 * S
        else:
            v = t - TRAINER_THROW
            y = min(1900, hy + 2600 * v + 4000 * v * v)
            with ctx.at(hx + 200 * v, y, rot=-a_r + 20 + 500 * v):
                c.drawRoundRect(skia.Rect.MakeLTRB(-90, -130, 90, 130), 10, 10, paint(hexc("8a5a2b")))
                c.drawRect(skia.Rect.MakeLTRB(-75, -105, 75, 118), paint(hexc("f5f2ea")))
            wx, wy = GX - 80 - 600 * v, min(1880, GY - 1180 * S + 2200 * v + 5000 * v * v)
        c.drawOval(skia.Rect.MakeXYWH(wx - 26, wy - 16, 52, 32), paint(CHROME))
        c.drawCircle(wx + 22, wy, 12, paint(hexc("9aa0a8")))
        ctx.pop()
        comic(c, "CLATTER!", 540, 430, 120, t, TRAINER_THROW + 0.12, 0.5, col=hexc("ffffff"), rot=6)
        return
    # trainer walks out, door slams
    ctx.push()
    cam(ctx, 560, 1000, 1.03, sh=shake(t, impact(t, DOOR_SLAM, 40, 5), 74))
    exit_room(ctx, t, green=0.5)
    x0, y0, w, h = DOOR
    tw = seg(t, CUTS["s7c"], DOOR_SLAM - 0.06)
    if tw < 1:
        with ctx.at(lerp(250, 900, tw), y0 + h + 80, sx=0.44):
            draw_runner(ctx, dict(skin="b07850", shirt="1f3a6b", hair="short", hair_color="1b2a4a"), t * 12, t,
                        horror=0.2, hold_nose=False, lean=6)
    slam = seg(t, DOOR_SLAM - 0.06, DOOR_SLAM)
    door_open = 1 - ease_in(slam)
    if t > DOOR_SLAM:
        door_open = abs(math.sin((t - DOOR_SLAM) * 30)) * 0.08 * math.exp(-(t - DOOR_SLAM) * 8)
    exit_front(ctx, t, door_open)
    if t > DOOR_SLAM:
        for i in range(8):
            u = t - DOOR_SLAM
            px = x0 + w * rnd(i, 3)
            c.drawCircle(px + (rnd(i, 4) - 0.5) * 300 * u, y0 + h - 300 * u * rnd(i, 5), 30 + 60 * u,
                         paint(hexc("b9b2a5"), 0.5 * (1 - clamp(u * 3)), blur=12))
    ctx.pop()
    comic(c, "SLAM!", 560, 430, 170, t, DOOR_SLAM, 0.5, col=hexc("ff3b3b"), rot=-8)


# ----------------------------------------------------------------------------
# SCENE 8: the sniff + slow-mo high five
# ----------------------------------------------------------------------------

def s8(ctx, t):
    c = ctx.c
    ctx.light = GYM
    if t < CUTS["s8b"]:
        u = seg(t, CUTS["s8"], CUTS["s8b"])
        gym_soft_bg(ctx, t, green=0.9)
        sn = seg(t, SNIFF - 0.04, SNIFF + 0.12)
        sn_back = 1 - seg(t, SNIFF + 0.35, SNIFF + 0.6)
        tear = seg(t, SNIFF + 0.15, SNIFF + 0.55)
        grin = ease_out(seg(t, GRIN, GRIN + 0.28))
        f = face(eyes=lerp(1.0, 0.35, sn * sn_back) * (1 - grin) + grin * 0.9, flare=sn * sn_back * 1.4,
                 wrinkle=sn * sn_back, brow_in=lerp(0, -0.45, sn) * (1 - tear) + 0.55 * tear * (1 - grin),
                 tears=0.85 * tear, look=(0, 0), smile=lerp(-0.1, 1.0, grin), open=0.04 + 0.32 * grin,
                 brow_up=0.55 * grin + 0.2 * tear * (1 - grin), sweat=0.5)
        if tear > 0.3 and grin < 0.2:
            f["open"] = 0.06 + 0.04 * math.sin(t * 40)
        zoom = 1.0 + 0.2 * ease_io(seg(t, SNIFF + 0.3, CUTS["s8b"]))
        ctx.push()
        cam(ctx, 540, lerp(1000, 920, ease_io(seg(t, SNIFF + 0.3, CUTS["s8b"]))), zoom)
        with ctx.at(540, 1060 - 14 * sn * sn_back, rot=-4 * sn * sn_back, sx=1.55):
            draw_head(ctx, "bro", f, bust=True, t=t)
        # green wisps flowing into his nose
        k = seg(t, CUTS["s8"], SNIFF + 0.1)
        for i in range(5):
            ph = (t * 0.9 + i * 0.2) % 1.0
            x = lerp(-80, 540, ph * k + (1 - k) * ph * 0.4)
            y = lerp(1500, 1120, ph * k) + math.sin(t * 5 + i) * 30
            c.drawCircle(x, y, 40 + 30 * rnd(i, 3), paint(GREEN, 0.45 * (1 - ph) * (1 - seg(t, SNIFF + 0.1, SNIFF + 0.4)),
                                                          blur=16))
        stink_lines(c, 300, 1420, 220, t, alpha=0.7 * (1 - seg(t, SNIFF, SNIFF + 0.3)), n=3)
        if tear > 0.6:
            for s in (-1, 1):
                gx = 540 + s * 124 * zoom
                glow_circle(c, gx, 940, 30, (1, 1, 1), 0.5 * math.sin(t * 12) ** 2)
        ctx.pop()
        comic(c, "*SNIFF*", 300, 560, 100, t, SNIFF + 0.02, 0.6, col=GREEN_L, rot=-10)
        return
    if t < CUTS["s8c"]:
        u = seg(t, CUTS["s8b"], CUTS["s8c"])
        slow = ease_io(u, 2.2)
        gym_soft_bg(ctx, t, green=0.5)
        ctx.push()
        cam(ctx, 545, lerp(900, 720, slow), lerp(0.95, 1.2, slow), rot=lerp(0, -9, slow))
        clap = (545.0, 300.0)
        # BRO on the right (behind), YOU on the left
        for who, look, x, s_ in (("bro", LOOK_BRO, 800, 0.62), ("you", LOOK_YOU, 300, 0.66)):
            sd = -1 if who == "bro" else 1
            gy = 1900
            B = BODY[who]
            tx_, ty_ = lerp(x + sd * 300, clap[0], slow), lerp(1100, clap[1] + (0 if who == "bro" else 20), slow)
            lx, ly = (tx_ - x) / s_, (ty_ - gy) / s_
            a, b = ik_arm(who, sd, lx, ly, elbow_out=1.0)
            other = (12, 18, "fist")
            arms = [other, other]
            arms[0 if sd < 0 else 1] = (a, b, "open", dict(spread=1.0))
            fc = face(turn=-0.5 * sd * -1, smile=1.0, open=0.3, eyes=0.9, brow_up=0.5, look=(sd * 0.6, -0.5),
                      tears=0.5 if who == "bro" else 0.0)
            with ctx.at(x, gy, sx=s_):
                draw_body_front(ctx, look, pose(arms=tuple(arms), hide_legs=True, breath=math.sin(t * 1.5)), fc, t)
        ctx.pop()
        speed_lines(c, 540, 700, t, 0.25 * slow, n=28, r0=520)
        return
    # the clap
    u = t - CLAP
    spin = lerp(0, 18, ease_io(seg(t, CUTS["s8c"], CLAP))) + (55 * ease_out(seg(t, CLAP, CLAP + 0.6), 3) if u > 0 else 0)
    zoom = 1.0 + 0.18 * impact(t, CLAP, 1, 6) + 0.05 * seg(t, CUTS["s8c"], CLAP)
    radial_fill(c, 540, 900, 1300, [(hexc("3b3326"), 1), (hexc("15130f"), 1), (hexc("060507"), 1)], [0, 0.5, 1],
                rect=(0, 0, W, H))
    for i in range(6):
        a = math.radians(i * 60 + t * 40)
        light_cone(c, (540, 900), math.degrees(a), 1500, 14, WARM, 0.12, blur=30)
    ctx.push()
    cam(ctx, 540, 860, zoom, rot=spin, sh=shake(t, impact(t, CLAP, 34, 4), 81))
    close = ease_in(seg(t, CUTS["s8c"], CLAP), 1.6)
    gap = lerp(330, 0, close)
    for who, sd in (("bro", 1), ("you", -1)):
        sk = SKIN[who]
        key = ("you", "e2a477", "8f959d", "1c1c22", "f4f4f4", False) if who == "you" else \
              ("bro", "c07f55", "d52828", "1c1c22", "f4f4f4", False)
        P = body_parts(key)
        hs = 2.5 if who == "you" else 2.25
        wrist = (540 + sd * (gap + 120), 1010)
        elbow = (wrist[0] + sd * 330, wrist[1] + 820)
        with ctx.at(0, 0):
            dd = np.array(elbow) - np.array(wrist)
            LL = float(np.hypot(*dd))
            a_ = math.degrees(math.atan2(-dd[0], dd[1]))
            L0 = BODY[who]["fa"]
            with ctx.at(wrist[0], wrist[1], rot=a_, sx=hs, sy=LL / L0):
                P["fa"].draw(ctx, color=sk)
        with ctx.at(wrist[0], wrist[1] + 10, rot=180 - sd * 14, sx=-sd * hs, sy=hs):
            draw_hand(ctx, who, "open", spread=0.85)
    ctx.pop()
    if u > 0:
        flash(c, 0.9 * (1 - ease_out(seg(t, CLAP, CLAP + 0.18))))
        ctx.push()
        cam(ctx, 540, 860, zoom, rot=spin)
        for i in range(7):
            ang = math.radians(i * 51 + 10)
            L = 900 + 300 * rnd(i, 4)
            fl = int(t * 30) % 3
            if (t - CLAP) < 0.45 or rnd(i + int(t * 20), 6) > 0.6:
                lightning(c, (540, 820), (540 + math.cos(ang) * L, 820 + math.sin(ang) * L), seed=i * 13 + fl,
                          width=9, alpha=clamp(1 - u / 0.55))
        sparks(c, t, CLAP, 540, 820, n=70, seed=7, speed=1.1)
        for i in range(2):
            rr = (u - i * 0.08) * 2400
            if rr > 0:
                shock_ring(c, 540, 820, rr, clamp(1 - rr / 2400), sy=1.0, width=22, color=(1, 0.95, 0.7))
        glow_circle(c, 540, 820, 420 * (1 - clamp(u * 2)) + 60, (1, 0.95, 0.75), 0.9)
        ctx.pop()
        comic(c, "CLAP!!", 540, 420, 200, t, CLAP + 0.01, 0.55, col=hexc("ffd60a"), rot=-8)


# ----------------------------------------------------------------------------
# SCENE 9: GAS'S GYM legends (exterior)
# ----------------------------------------------------------------------------
TILE_S = 0.68
SIGN_Y = 360


def row_xs(text, cx=540.0, unit=100.0):
    widths = [unit * 0.55 if ch == "'" else unit * 0.5 if ch == " " else unit for ch in text]
    x = cx - sum(widths) / 2
    out = []
    for wdt in widths:
        out.append(x + wdt / 2)
        x += wdt
    return out


SRC = "STAG'S GYM"
DST = "GAS'S GYM"
XS_SRC = row_xs(SRC)
XS_DST = row_xs(DST)
# source index -> destination index
REMAP = {3: 0, 2: 1, 0: 2, 4: 3, 5: 4, 7: 6, 8: 7, 9: 8}


def s9(ctx, t):
    c = ctx.c
    ctx.light = NIGHT
    t0 = CUTS["s9"]
    zoom = lerp(0.95, 1.08, ease_io(seg(t, t0, CUTS["s10"])))
    cy = lerp(780, 960, ease_io(seg(t, t0 + 0.9, CUTS["s10"])))
    ctx.push()
    cam(ctx, 540, cy, zoom, sh=shake(t, impact(t, LETTER_LAND, 16, 6) + impact(t, T_DROP + 0.33, 12, 6), 91))
    draw_building(ctx, t)
    for i, (x, base) in enumerate(((60, -70), (1020, -110))):
        ang = base + math.sin(t * 1.3 + i * 2) * 18
        light_cone(c, (x, 1760), ang, 2600, 9, (0.85, 1, 0.75), 0.22, blur=20)
    draw_facade(ctx, t, green=0.35)
    # sign board
    c.drawRect(skia.Rect.MakeLTRB(-20, SIGN_Y - 95, 1100, SIGN_Y + 95), paint(hexc("121216")))
    c.drawRect(skia.Rect.MakeLTRB(-20, SIGN_Y - 95, 1100, SIGN_Y - 83), paint(hexc("5a5a62")))
    land_times = {0: LETTER_LAND - 0.84, 1: LETTER_LAND - 0.62, 2: LETTER_LAND - 0.42, 3: LETTER_LAND - 0.2,
                  4: LETTER_LAND}
    flash_all = impact(t, LETTER_LAND, 1, 5)
    for src, ch in enumerate(SRC):
        if ch == " ":
            continue
        fx = XS_SRC[src]
        fy = SIGN_Y
        if src == 1:  # the T falls off
            u = t - T_DROP
            if u < 0:
                x, y, rot = fx, fy, math.sin(t * 22) * 4 * seg(t, T_DROP - 0.3, T_DROP)
            else:
                ground = 1690
                g = 2200
                yy = fy + 140 * u + g * u * u
                tb = (-140 + math.sqrt(140 * 140 + 4 * g * (ground - fy))) / (2 * g)
                if u > tb:
                    uu = u - tb
                    v = (140 + 2 * g * tb) * 0.3
                    yy = ground - max(0.0, v * uu - g * uu * uu)
                x, y, rot = fx + 300 * min(u, tb + 0.5), yy, 200 * u
            draw_letter_tile(ctx, "T", x, y, rot, TILE_S, lit=0.15, seed=src)
            continue
        dst = REMAP[src]
        tx = XS_DST[dst]
        if dst <= 4:
            tl = land_times[dst]
            ts = tl - 0.55
            u = seg(t, ts, tl)
            e = ease_io(u, 2.4)
            x = lerp(fx, tx, e)
            y = fy - math.sin(u * math.pi) * 200
            rot = math.sin(u * math.pi) * (35 if dst % 2 else -35)
        else:  # GYM slides over once the T is gone
            tl = LETTER_LAND
            u = seg(t, LETTER_LAND - 0.5, LETTER_LAND)
            x = lerp(fx, tx, ease_io(u))
            y = fy
            rot = 0
        land = impact(t, tl, 1, 9)
        lit = clamp(0.55 + 0.45 * (t > tl) + 0.3 * flash_all)
        draw_letter_tile(ctx, ch, x, y, rot, TILE_S * (1 + 0.15 * land), lit=lit, seed=src)
        if 0 < t - tl < 0.3 and dst <= 4:
            sparks(c, t, tl, x, y + 50, n=14, seed=src * 7, speed=0.35)
    # trophy halo above the legends' heads
    puffs = []
    for i in range(30):
        a = i / 30 * 2 * math.pi + t * 1.7
        puffs.append((540 + math.cos(a) * 360, 700 + math.sin(a) * 92 + 10 * math.sin(a * 3 + t * 4),
                      58 + 22 * rnd(i, 4), 900 + i, math.sin(a)))
    glow_circle(c, 540, 1000, 760, GREEN, 0.22)
    draw_puffs(ctx, [p[:4] for p in puffs if p[4] < 0], alpha=0.9)
    breath = math.sin(t * 2.2)
    for who, look, x, s_ in (("bro", LOOK_BRO, 765, 0.56), ("you", LOOK_YOU, 300, 0.58)):
        flex = 0.9 + 0.1 * math.sin(t * 3 + (0 if who == "you" else 1))
        arms = ((95, 112, "fist"), (95, 112, "fist"))
        fc = face(smile=1.0, open=0.25, eyes=0.95, brow_up=0.6, look=(0, -0.1))
        with ctx.at(x, 1720, sx=s_):
            draw_body_front(ctx, look, pose(arms=arms, bulge=flex, vein=0.7, breath=breath), fc, t)
    draw_puffs(ctx, [p[:4] for p in puffs if p[4] >= 0], alpha=0.9)
    # crowd silhouettes cheering in the foreground (chant rhythm)
    for i in range(9):
        x = 40 + i * 125 + noise1(i, 2) * 20
        jump = abs(math.sin((t - 26.6) * math.pi * 2.0 + i * 0.7)) * 40
        y = 1930 - jump
        c.drawCircle(x, y - 110, 55, paint(hexc("0a0812")))
        c.drawRoundRect(skia.Rect.MakeLTRB(x - 85, y - 60, x + 85, y + 200), 60, 60, paint(hexc("0a0812")))
        arm_a = math.radians(-60 - 30 * math.sin((t - 26.6) * math.pi * 2 + i))
        c.drawLine(x + 50, y - 30, x + 50 + math.cos(arm_a) * 150, y - 30 + math.sin(arm_a) * 150,
                   paint(hexc("0a0812"), 1, "stroke", 34))
    ctx.pop()
    flash(c, 0.35 * flash_all, color=(1, 0.9, 0.8))
    comic(c, "CLUNK!", 760, 1150, 100, t, T_DROP + 0.34, 0.5, col=hexc("ffffff"), rot=10)


# ----------------------------------------------------------------------------
# SCENE 10: Genius.
# ----------------------------------------------------------------------------

def s10(ctx, t):
    c = ctx.c
    ctx.light = STAGE
    t0 = CUTS["s10"]
    jolt = impact(t, t0, 1, 10)
    radial_fill(c, 540, 820, 1300, [(hexc("3a2a5a"), 1), (hexc("1a1230"), 1), (hexc("07050c"), 1)], [0, 0.5, 1],
                rect=(0, 0, W, H))
    for i, x in enumerate((180, 900)):
        light_cone(c, (x, -150), 90 + (1 if i else -1) * 14, 2400, 26, (1, 0.95, 0.85), 0.22, blur=30)
    bokeh(c, t, seed=9, n=16, color=(0.7, 0.5, 1.0), alpha=0.25)
    ctx.push()
    cam(ctx, 540, 960, 1.0 + 0.04 * seg(t, t0, DURATION) + 0.06 * jolt, rot=-3 * jolt, sh=(jolt * 30, 0))
    puffs = []
    for i in range(30):
        a = i / 30 * 2 * math.pi + t * 1.2
        puffs.append((540 + math.cos(a) * 470, 520 + math.sin(a) * 120 + 12 * math.sin(a * 3 + t * 3),
                      78 + 26 * rnd(i, 3), 950 + i))
    glow_circle(c, 540, 600, 820, GREEN, 0.28)
    draw_puffs(ctx, puffs, alpha=0.85)
    breath = math.sin(t * 2.0)
    for who, look, x, s_, arms in (("bro", LOOK_BRO, 775, 0.9, ((14, 22, "fist"), (92, 118, "fist"))),
                                   ("you", LOOK_YOU, 300, 0.95, ((92, 118, "fist"), (14, 22, "fist")))):
        fc = face(smile=1.0, open=0.32, eyes=0.95, brow_up=0.7, look=(0, 0), turn=0.15 if who == "you" else -0.15)
        with ctx.at(x, 2300, sx=s_):
            draw_body_front(ctx, look, pose(arms=arms, bulge=1.0, vein=0.8, breath=breath, hide_legs=True), fc, t)
    ctx.pop()
    confetti(c, t, t0 - 0.05, n=110)
    if t > GENIUS:
        for i in range(10):
            u = t - GENIUS
            a = i / 10 * 2 * math.pi
            r = 180 + u * 900
            x, y = 540 + math.cos(a) * r, 1300 + math.sin(a) * r * 0.5
            al = clamp(1 - u * 1.5)
            c.drawPath(poly_path([(x, y - 30), (x + 8, y - 8), (x + 30, y), (x + 8, y + 8), (x, y + 30), (x - 8, y + 8),
                                  (x - 30, y), (x - 8, y - 8)]), paint((1, 0.95, 0.5), al))
    flash(c, 0.6 * (1 - ease_out(seg(t, t0, t0 + 0.12))))
    comic(c, "SCRRRATCH!", 540, 300, 120, t, SCRATCH + 0.02, 0.45, col=hexc("ff2d9a"), rot=-6)


SCENES = [("s1", s1), ("s2", s2), ("s3", s3), ("s4", s4), ("s5", s5), ("s6", s6), ("s7", s7), ("s8", s8), ("s9", s9),
          ("s10", s10)]


def scene_at(t):
    keys = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]
    cur = SCENES[0][1]
    for (k, fn) in SCENES:
        if t >= CUTS[k]:
            cur = fn
    return cur


# ----------------------------------------------------------------------------
# captions + watermark
# ----------------------------------------------------------------------------
CAP_Y = 1300


def draw_captions(c, t):
    for ch in CAPTIONS:
        if ch["start"] <= t < ch["show_end"]:
            u = (t - ch["start"]) / 0.2
            sc = pop(u)
            draw_words(c, ch["words"], 540, CAP_Y, 122, scale=sc, outline=0.17, max_w=960)


def draw_watermark(c):
    draw_words(c, [("@garden_reels", (1, 1, 1))], 540, 1432, 36, outline=0.0, shadow=True, alpha=0.55,
               spacing=0.1, face="Inter-Bold.otf")


def draw_frame(canvas, t, frame=0):
    canvas.clear(argb((0, 0, 0)))
    ctx = Ctx(canvas, GYM, t=t, frame=frame)
    fn = scene_at(t)
    ctx.push()
    fn(ctx, t)
    ctx.pop()
    vig = 0.75 if t < CUTS["s4"] else 0.5
    frame_overlays(canvas, t, frame, vig)
    draw_captions(canvas, t)
    draw_watermark(canvas)
