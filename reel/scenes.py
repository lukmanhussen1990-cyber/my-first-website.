"""The eight scenes, the transitions between them, and the caption/watermark overlay."""
import math
from contextlib import contextmanager
from dataclasses import replace

import numpy as np
from PIL import Image, ImageDraw

import character as ch
import props as pr
from gfx import (INK, Canvas, back, clamp, ease_io, ease_out, fade, gradient, lerp, pop, prog,
                 shake, text_width, wobble)
from timeline import SCENES

WHITE, YELLOW = "#FFFFFF", "#FFD93B"
TRANSITION = 0.32
GROUND_Y = 1110
SHIFT = 45


# ---------------------------------------------------------------- helpers

@contextmanager
def camera(cv, lt, dur, z0=1.0, z1=1.04, cx=540, cy=900):
    """Slow push-in over the scene; content sits SHIFT px lower than its design coords."""
    z = lerp(z0, z1, ease_io(clamp(lt / dur)))
    with cv.group(cx, cy + SHIFT, s=z):
        cv.translate(-cx, -cy)
        yield


def pose(tl, t, talk=True, **kw):
    f = tl.frame(t)
    d = dict(blink=tl.blink(t),
             mouth=tl.mouth[f] if talk else 0.0,
             bounce=tl.bounce[f] if talk else 0.0,
             squash=(tl.squash[f] if talk else 0.0) + 0.012 * math.sin(2 * math.pi * 0.55 * t))
    d.update(kw)
    return ch.Pose(**d)


def _target(a, side, t):
    if callable(a):
        a = a(t)
    if isinstance(a, str):
        x, y = ch.ARM_PRESETS[a]
        return (x * side, y)
    return a


def arms(t, seq, dur=0.3):
    """seq: [(time, left, right), ...]; eases between hand targets."""
    out = []
    for side, idx in ((-1, 1), (1, 2)):
        cur = seq[0][idx]
        prev, t0 = cur, -1e9
        for k in seq:
            if t >= k[0]:
                prev, cur, t0 = cur, k[idx], k[0]
        p = ease_io(prog(t, t0, dur))
        a, b = _target(prev, side, t), _target(cur, side, t)
        out.append((lerp(a[0], b[0], p), lerp(a[1], b[1], p)))
    return tuple(out)


def wave_hand(t):
    return (184 + 26 * math.sin(2 * math.pi * 2.4 * t), -352 + 8 * math.cos(2 * math.pi * 4.8 * t))


def fit(lines, size, maxw, name="black"):
    w = max(text_width(" ".join(txt for txt, _ in ln), size, name) for ln in lines)
    return size * min(1.0, maxw / w)


def title_runs(*lines):
    """'WORD *KEY*' strings -> rich-text runs with yellow keys."""
    return tuple(tuple((w.strip("*"), YELLOW if w.startswith("*") else WHITE) for w in ln.split())
                 for ln in lines)


def char_pop(cv, x, y, t, t0, dur=0.5):
    """Group that pops a character in around its feet."""
    return cv.group(x, y, s=pop(t, t0, dur))


# ---------------------------------------------------------------- scenes

def s_hook(cv, tl, t, lt, dur):
    pr.rays(cv, 540, 900, t * 9, n=16, alpha=0.13)
    pr.floaters(cv, t, 1, alpha=0.14)
    with camera(cv, lt, dur, 1.0, 1.05):
        pr.ground(cv, GROUND_Y, "#E8456F", 0.45)
        # title: pop + shake
        lines = title_runs("WHAT IF YOU", "STOP GOONING", "FOR *1* *DAY?*")
        size = fit(lines, 122, 900)
        rot = shake(t, 0.3, 0.75, 6, 24, 1) + shake(t, 2.1, 0.55, 4, 24, 2) + wobble(t, 1.2, 0.6)
        dx = shake(t, 0.3, 0.75, 16, 30, 3) + shake(t, 2.1, 0.55, 10, 30, 4)
        cv.text(lines, 540 + dx, 425, size, stroke=11, stroke_fill="#000000", scale=pop(t, 0.05, 0.5),
                rot=rot, shadow=9)
        # the habit: a phone with a no sign
        ph_s = pop(t, 0.95, 0.45)
        pr.phone(cv, 880, 900, 150, 268, screen_on=1.0, no=pop(t, 1.35, 0.4), rot=8 + wobble(t, 5, 0.9),
                 scale=ph_s)
        # shocked bean
        f = tl.frame(t)
        jitter = 2.5 * math.sin(t * 70) * (t > 0.6)
        with char_pop(cv, 520 + jitter, GROUND_Y, t, 0.12):
            p = pose(tl, t, expr="shock", arms=arms(t, [(0, "rest", "rest"), (0.45, "cheeks", "cheeks")]),
                     sweat=prog(t, 0.8, 0.3), mouth=0.3 + 0.7 * tl.mouth[f], look=(0, -0.2))
            ch.draw(cv, 0, 0, 400, p)
        for i, (x, y, r) in enumerate(((340, 790, -16), (705, 770, 14))):
            s = pop(t, 0.6 + i * 0.12, 0.4)
            pr.exclaim(cv, x, y + 6 * math.sin(t * 9 + i), s, rot=r + wobble(t, 6, 2.5, i))


def s_hour1(cv, tl, t, lt, dur):
    pr.floaters(cv, t, 2, alpha=0.2)
    with camera(cv, lt, dur):
        pr.ground(cv, GROUND_Y, "#3CB3B4", 0.5)
        # clock: an hour ticks by
        spin = ease_io(prog(t, 3.45, 1.1))
        with cv.group(270, 440, s=pop(t, 3.28, 0.45), rot=wobble(t, 3, 0.8)):
            pr.clock(cv, 0, 0, 125, 360 * spin + 6 * max(0, t - 4.55), 300 + 30 * spin)
        pr.badge(cv, "HOUR 1", 705, 440, pop(t, 3.4, 0.45), wobble(t, 2.5, 0.6, 1), icon="clock", size=76)

        # mirror with the reflection inside
        mx = lerp(1350, 780, ease_out(prog(t, 3.3, 0.55)))
        my, mw, mh = 845, 330, 545
        cx = lerp(-240, 380, ease_out(prog(t, 3.35, 0.6)))
        rx = mx + 15
        shake_y = 14 * math.sin(2 * math.pi * 3.2 * t) * (4.95 < t < 6.05)
        reach = [(0, "rest", "rest"), (4.4, "rest", (lambda tt: ((600 - cx) / 0.976, (884 - GROUND_Y + shake_y) / 0.976))),
                 (6.1, "rest", "thumb")]
        reach_r = [(0, "rest", "rest"), (4.4, "rest", (lambda tt: ((rx - 630) / 0.927, (884 - 1084 + shake_y) / 0.927))),
                   (6.1, "rest", "thumb")]
        p_main = pose(tl, t, expr="happy", arms=arms(t, reach, 0.38))
        p_refl = pose(tl, t, expr="happy", arms=arms(t, reach_r, 0.38), flip=True, look=(0.0, 0.0))
        glass = pr.mirror(cv, mx, my, mw, mh)
        with cv.clip(glass) as sub:
            if sub is not None:
                ch.draw(sub, rx, 1084, 380, replace(p_refl, skip_arm="r"))
                sub.poly(glass, fill=fade("#BFE6FF", 0.28))
        pr.mirror_shine(cv, mx, my, mw, mh, t)
        # the reflection reaches out of the glass to shake hands
        ch.draw(cv, rx, 1084, 380, replace(p_refl, only_arm="r"), shadow=False)
        ch.draw(cv, cx, GROUND_Y, 400, p_main)
        pr.burst(cv, 615, 884, t, 4.9, n=8, r0=30, r1=150)
        s = pop(t, 5.0, 0.45) * (1 - ease_io(prog(t, 6.6, 0.3)))
        pr.starburst(cv, 612, 690, 105, "DEAL!", s, -8 + wobble(t, 5, 1.3), size=46)


def s_hour3(cv, tl, t, lt, dur):
    pr.floaters(cv, t, 3, alpha=0.22)
    with camera(cv, lt, dur):
        # the urge wave rises behind him, then fades
        h = 660 * (0.55 * ease_out(prog(t, 8.9, 2.2)) + 0.45 * ease_io(prog(t, 12.4, 2.2)))
        h *= 1 - ease_io(prog(t, 15.0, 1.0))
        a = 1 - prog(t, 15.35, 0.6)
        pr.wave(cv, GROUND_Y + 30, h, t, a)
        if h > 60:
            lab_y = GROUND_Y - h * 0.55
            cv.text("URGE", 205, lab_y + 8 * math.sin(t * 3), 64, stroke=8, stroke_fill="#0B2F7A",
                    scale=pop(t, 9.0, 0.4), alpha=a, rot=-6)
        pr.ground(cv, GROUND_Y, "#5CC6CF", 1.0)
        pr.badge(cv, "HOUR 3", 540, 300, pop(t, 7.7, 0.45), wobble(t, 2, 0.6), icon="clock", size=76)
        # calm rings
        if t > 9.3:
            for k in range(3):
                ph = ((t - 9.3) / 2.4 + k / 3) % 1
                cv.circle(540, 880, 160 + 300 * ph, line=fade(WHITE, 0.5 * (1 - ph) * a), lw=6)
        for i, (word, x, y, t0) in enumerate((("BOREDOM", 215, 640, 10.7), ("HABIT", 868, 600, 11.5))):
            s = pop(t, t0, 0.4) * (1 - ease_io(prog(t, 12.3, 0.3)))
            pr.pill(cv, word, x, y + 8 * math.sin(t * 2.5 + i), 46, s, (-7 if i == 0 else 6) + wobble(t, 3, 0.7, i))
        calm = t > 9.3
        p = pose(tl, t, expr="calm" if calm else "happy",
                 arms=arms(t, [(0, "rest", "rest"), (9.3, "zen", "zen")], 0.5))
        with char_pop(cv, 540, GROUND_Y, t, 7.62):
            ch.draw(cv, 0, 0, 420, p)
        pr.burst(cv, 540, 760, t, 15.6, n=10, r0=120, r1=330, dur=0.8, color=WHITE, size=26)


def s_hour6(cv, tl, t, lt, dur):
    pr.floaters(cv, t, 4, alpha=0.25)
    with camera(cv, lt, dur):
        pr.ground(cv, GROUND_Y, "#F5A74A", 0.6)
        pr.badge(cv, "HOUR 6", 540, 300, pop(t, 16.45, 0.45), wobble(t, 2, 0.6), icon="clock", size=76)
        # hourglass flips: your time comes back
        fp = prog(t, 17.55, 0.75)
        if fp < 1:
            rot, top, bot, flow = 180 * back(fp, 1.4) if fp > 0 else 0, 0.04, 0.96, False
        else:
            top = 0.96 - 0.55 * prog(t, 18.3, 5.0)
            rot, bot, flow = 0, 1.0 - top, True
        pr.hourglass(cv, 770, 610, 420, rot + wobble(t, 2, 0.5), top, bot, flow, t, pop(t, 16.4, 0.5))
        pr.starburst(cv, 445, 500, 92, "FREE!", pop(t, 20.6, 0.45), -10 + wobble(t, 5, 1.1), size=40)
        # gym / study / friends pop out of the hourglass one by one
        for i, (kind, t0) in enumerate((("dumbbell", 21.33), ("book", 21.97), ("friends", 22.69))):
            p = prog(t, t0, 0.5)
            if p <= 0:
                continue
            tx, ty = 520 + i * 200, 965
            x = lerp(770, tx, ease_out(p))
            y = lerp(610, ty, ease_out(p)) - 160 * math.sin(math.pi * p) + 7 * math.sin(t * 3 + i)
            pr.icon_bubble(cv, x, y, 80, kind, 0.3 + 0.7 * back(p), wobble(t, 4, 0.7, i))
        joy = t > 22.7
        p = pose(tl, t, expr="happy",
                 arms=arms(t, [(0, "rest", "rest"), (17.5, "rest", "point"), (18.8, "rest", "rest"),
                               (22.7, "up", "up")]))
        with char_pop(cv, 240, GROUND_Y, t, 16.36):
            ch.draw(cv, 0, 0, 380, p)
        if joy:
            pr.burst(cv, 240, 760, t, 22.75, n=8, r0=80, r1=220)


def s_night(cv, tl, t, lt, dur):
    rng = np.random.default_rng(5)
    for i in range(46):
        x, y = rng.uniform(30, 1050), rng.uniform(120, 1050)
        tw = 0.45 + 0.55 * math.sin(t * rng.uniform(1.5, 4) + i) ** 2
        pr.sparkle(cv, x, y, rng.uniform(5, 13) * (0.7 + 0.3 * tw), alpha=tw, color="#FFF6C8")
    # shooting star
    sp = prog(t, 23.9, 0.7)
    if 0 < sp < 1:
        hx, hy = lerp(80, 700, sp), lerp(160, 420, sp)
        cv.stroke([(hx - 160, hy - 67), (hx, hy)], 6, fade("#FFFFFF", 0.7 * (1 - sp)))
        pr.sparkle(cv, hx, hy, 16, 1 - sp)
    with camera(cv, lt, dur, 1.0, 1.035):
        cv.glow(850, 480, 210, "#FFF3B0", alpha=0.3)
        with cv.group(850, 480, s=pop(t, 23.5, 0.5), rot=wobble(t, 4, 0.4)):
            pr.crescent(cv, 0, 0, 92, "#FFE38A", lw=5)
        pr.ground(cv, GROUND_Y, "#151A55", 1.0)
        pr.badge(cv, "NIGHT", 520, 300, pop(t, 23.55, 0.45), wobble(t, 2, 0.6), fill="#FFFFFF", icon="moon",
                 size=76)
        # bed + sleeping bean
        mattress = pr.bed(cv, 110, 905, 770, GROUND_Y)
        breathe = 5 * math.sin(2 * math.pi * 0.3 * t)
        cv.ellipse(330, mattress + 4, 120, 44, fill="#FFFFFF", line=INK, lw=5)
        asleep = t > 26.0
        p = pose(tl, t, talk=False, expr="sleep" if asleep else "happy", hide_limbs=True,
                 squash=0.0, blink=0.0 if asleep else max(0.45, tl.blink(t)))
        if asleep:
            p.mouth = 0.3 + 0.3 * math.sin(2 * math.pi * 0.3 * t)
        with cv.group(650, mattress + 38 - breathe * 0.4, rot=-90):
            ch.draw(cv, 0, 0, 330, p, shadow=False)
        top = mattress - 12 - breathe
        blanket = np.vstack([[[490, top + 30]],
                             np.c_[np.linspace(505, 760, 20), top + 6 * np.sin(np.linspace(0, 9, 20))],
                             [[775, mattress + 110], [485, mattress + 110]]])
        cv.poly(blanket, fill="#5B7CFA", line=INK, lw=5)
        cv.rrect(478, top + 4, 528, mattress + 106, 20, fill="#EEF2FF", line=INK, lw=5)
        for i in range(4):
            cv.circle(570 + i * 52, top + 50 + (i % 2) * 22, 7, fill=fade("#FFFFFF", 0.5))
        # phone goes dark and locks
        stand_top = pr.nightstand(cv, 910, GROUND_Y)
        on = 1 - prog(t, 24.5, 0.35)
        pr.phone(cv, 910, stand_top - 108, 122, 214, screen_on=on, lock=pop(t, 24.7, 0.45),
                 rot=wobble(t, 1.5, 0.5))
        # Zzz
        bs = pop(t, 26.25, 0.45)
        pr.cloud_bubble(cv, 300, 650, 250, 150, tail=(0.4, 1.0), scale=bs)
        if bs > 0.3:
            for i, ch_ in enumerate("Zzz"):
                cv.text(ch_, 236 + i * 58, 650 + 6 * math.sin(t * 3 + i) - i * 8, 70 - i * 10,
                        color="#3B4A9E", scale=bs)
        if asleep:
            for k in range(3):
                ph = ((t - 26.0) / 2.2 + k / 3) % 1
                cv.text("z", 400 + 50 * ph, 830 - 140 * ph, 40 + 20 * ph, color="#FFFFFF",
                        alpha=math.sin(math.pi * ph), stroke=4, stroke_fill="#3B4A9E")


def s_testo(cv, tl, t, lt, dur):
    pr.floaters(cv, t, 6, alpha=0.25)
    with camera(cv, lt, dur):
        pr.ground(cv, GROUND_Y, "#8FA6F5", 0.7)
        # meter panel
        ps = pop(t, 28.36, 0.5)
        with cv.group(540, 545, s=ps):
            cv.rrect(-370 + 10, -215 + 16, 370 + 10, 215 + 16, 44, fill=fade("#000000", 0.16))
            cv.rrect(-370, -215, 370, 215, 44, fill="#FFFFFF", line=INK, lw=6)
            spike = (ease_out(prog(t, 34.25, 0.35)) * (1 - ease_io(prog(t, 35.5, 0.8))))
            val = 0.5 + 0.012 * math.sin(t * 6.3) + 0.006 * math.sin(t * 17) + 0.2 * spike
            pr.gauge(cv, 0, 110, 262, val)
            cv.text("TESTOSTERONE", 0, 172, 50, color=INK)
        # calendar: day 1, then flips through to day 7
        fp = prog(t, 32.5, 0.9)
        idx = min(5, int(fp * 6))
        day, flip = (1 + idx, (fp * 6) % 1) if 0 < fp < 1 else ((7, 0) if fp >= 1 else (1, 0))
        pr.calendar(cv, 240, 985, 220, 240, day, flip, pop(t, 28.55, 0.45))
        s = pop(t, 30.8, 0.4) * (1 - ease_io(prog(t, 32.4, 0.25)))
        pr.pill(cv, "ALMOST NO CHANGE", 540, 815, 36, s, -3 + wobble(t, 2, 0.8))
        s = pop(t, 34.3, 0.4) * (1 - ease_io(prog(t, 35.75, 0.25)))
        pr.badge(cv, "SHORT SPIKE", 790, 322, s, 6 + wobble(t, 3, 1.2), icon="up", size=40)
        # no superpowers
        s = pop(t, 35.85, 0.45)
        if s > 0:
            with cv.group(545, 900, s=s, rot=wobble(t, 6, 1.0)):
                cv.circle(0, 0, 78, fill="#FFFFFF", line=INK, lw=6)
                pr.bolt(cv, 0, 0, 0.95)
                pr.no_sign(cv, 0, 0, 74, lw=14)
        expr = "shock" if 34.3 < t < 35.5 else ("meh" if t > 35.8 else "happy")
        p = pose(tl, t, expr=expr, look=(-0.7, -0.6) if t < 35.8 else (0, 0),
                 arms=arms(t, [(0, "rest", "rest"), (35.8, "shrug", "shrug")]),
                 bend=("down", "down") if t > 35.8 else ("out", "out"))
        with char_pop(cv, 850, GROUND_Y, t, 28.5):
            ch.draw(cv, 0, 0, 345, p)


def s_crown(cv, tl, t, lt, dur):
    pr.rays(cv, 540, 820, -t * 8, n=18, color="#FFE27A", alpha=0.12)
    pr.floaters(cv, t, 7, alpha=0.12)
    pr.confetti(cv, t, alpha=prog(t, 41.4, 0.4))
    with camera(cv, lt, dur, 1.0, 1.05):
        pr.ground(cv, GROUND_Y, "#5B2DC2", 0.5)
        # crown is lifted onto his head
        lift = ease_io(prog(t, 38.1, 0.65))
        cy_ = lerp(-510, -404, lift)
        held = t < 38.95
        crown_arm = (lambda tt: (100, cy_ + 22)), (lambda tt: (-100, cy_ + 22))
        seq = [(0, "rest", "rest"), (37.6, crown_arm[1], crown_arm[0]), (38.95, "hip", "hip"),
               (41.4, "up", "up")]
        expr = "proud" if t > 38.8 else "happy"
        crown_s = pop(t, 37.62, 0.45)
        p = pose(tl, t, expr="joy" if 41.45 < t < 42.0 else expr, arms=arms(t, seq, 0.35),
                 crown=(0, cy_, wobble(t, 3, 0.8) * (not held), 1.15 * crown_s) if crown_s > 0 else None)
        with char_pop(cv, 540, GROUND_Y, t, 37.58):
            ch.draw(cv, 0, 0, 450, p)
        pr.burst(cv, 540, GROUND_Y - 450 * 404 / 410 - 40, t, 38.75, n=10, r0=60, r1=230)
        pr.burst(cv, 540, 820, t, 41.45, n=12, r0=200, r1=480, dur=0.8, size=30)
        lines = title_runs("YOU'RE IN", "*CONTROL*")
        sc = pop(t, 38.9, 0.5) * (1 + 0.08 * math.sin(math.pi * prog(t, 40.35, 0.4)))
        rot = shake(t, 39.1, 0.5, 4, 22, 5) + wobble(t, 1.0, 0.6)
        cv.text(lines, 540, 380, fit(lines, 128, 920), stroke=11, stroke_fill="#000000", scale=sc,
                rot=rot, shadow=9)


def s_outro(cv, tl, t, lt, dur):
    pr.floaters(cv, t, 8, alpha=0.22, n=18)
    with camera(cv, lt, dur, 1.0, 1.03):
        pr.ground(cv, GROUND_Y, "#36AE78", 0.55)
        beat = max(0.0, math.sin(2 * math.pi * 1.1 * t)) ** 6
        hs = pop(t, 42.35, 0.55) * (1 + 0.07 * beat)
        cv.glow(540, 385, 220, "#FFFFFF", alpha=0.35)
        with cv.group(540, 385, s=hs):
            pr.heart(cv, 0, 0, 100)
        for i, (txt, t0) in enumerate((("Normal & healthy.", 42.45), ("Out of control?", 45.05),
                                       ("Talk to a doctor.", 46.9))):
            p = ease_out(prog(t, t0, 0.45))
            if p > 0:
                cv.text(txt, 540, 580 + i * 72 + 30 * (1 - p), 56, color=WHITE, name="xbold", stroke=6,
                        stroke_fill="#1E6B47", alpha=p)
        slide = ease_io(prog(t, 50.3, 0.5))
        x = lerp(540, 380, slide)
        seq = [(0, "rest", "rest"), (49.0, "rest", "thumb"), (50.45, "rest", wave_hand)]
        p = pose(tl, t, expr="happy", arms=arms(t, seq))
        with char_pop(cv, x, GROUND_Y, t, 42.3):
            ch.draw(cv, 0, 0, 310, p)
        pressed = math.sin(math.pi * prog(t, 51.2, 0.25))
        pr.follow_button(cv, 790, 1000, pop(t, 50.5, 0.45) * (1 + 0.03 * math.sin(t * 5)), pressed)


SCENE_DEFS = {
    "hook": (s_hook, ("#FFB03D", "#FF4F8B")),
    "hour1": (s_hour1, ("#B3F3EA", "#62CCD8")),
    "hour3": (s_hour3, ("#D2F8F2", "#86D9E6")),
    "hour6": (s_hour6, ("#FFEDA8", "#FFC46A")),
    "night": (s_night, ("#0B1140", "#2A2F7C")),
    "testo": (s_testo, ("#E2EAFF", "#A8BBFF")),
    "crown": (s_crown, ("#6A3BE0", "#B055F2")),
    "outro": (s_outro, ("#AFF2CB", "#4CC890")),
}


# ---------------------------------------------------------------- compose

def draw_scene(i, tl, t, ss):
    name, start = SCENES[i]
    end = SCENES[i + 1][1] if i + 1 < len(SCENES) else tl.duration
    fn, (top, bottom) = SCENE_DEFS[name]
    img = gradient(top, bottom, ss).copy()
    fn(Canvas(img, ss), tl, t, t - start, end - start)
    return img


def compose(tl, t, ss, handle):
    i = tl.scene_at(t)
    img = draw_scene(i, tl, t, ss)
    start = SCENES[i][1]
    if i > 0 and t - start < TRANSITION:
        prev = draw_scene(i - 1, tl, t, ss)
        p = ease_io((t - start) / TRANSITION)
        r, cx, cy = p * 2250 * ss, 540 * ss, 900 * ss
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
        img = Image.composite(img, prev, mask)
        ImageDraw.Draw(img, "RGBA").ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, 200),
                                            width=int(16 * ss))
    overlay(Canvas(img, ss), tl, t, handle)
    return img


CAPTION_Y = 1305
CAPTION_SIZE = 94
CAPTION_MAXW = 860


def caption_lines(runs, size):
    words = [(w.upper(), YELLOW if k else WHITE) for w, k in runs]
    one = (tuple(words),)
    if text_width(" ".join(w for w, _ in words), size) <= CAPTION_MAXW or len(words) < 2:
        return one
    best = None
    for cut in range(1, len(words)):
        a, b = words[:cut], words[cut:]
        wmax = max(text_width(" ".join(w for w, _ in x), size) for x in (a, b))
        if best is None or wmax < best[0]:
            best = (wmax, (tuple(a), tuple(b)))
    return best[1]


def overlay(cv, tl, t, handle):
    c = tl.caption_at(t)
    if c is not None:
        lines = caption_lines(c["runs"], CAPTION_SIZE)
        size = fit(lines, CAPTION_SIZE, CAPTION_MAXW)
        p = prog(t, c["start"], 0.14)
        sc = lerp(0.78, 1.0, back(p, 2.2)) if p < 1 else 1.0
        y = CAPTION_Y - (len(lines) - 1) * size * 0.5
        cv.text(lines, 540, y, size, stroke=10, stroke_fill="#000000", scale=sc, shadow=7, line_gap=1.12)
    cv.text(handle, 540, 150, 34, color=WHITE, name="xbold", stroke=3, stroke_fill="#000000",
            alpha=0.8)
