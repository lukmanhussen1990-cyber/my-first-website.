"""Bean: the hoodie-wearing bean guy.

Local coordinates: origin between the feet on the ground, y down, about 410
units tall. `draw` scales him to the requested height.
"""
import math
from dataclasses import dataclass, field

import numpy as np

from gfx import INK, clamp, ellipse_pts, fade, lerp

SKIN = "#F7C594"
SKIN_D = "#E7A673"
HOOD = "#FF7043"
HOOD_D = "#DD5530"
HOOD_L = "#FF9A70"
PANTS = "#3B4A86"
SHOE = "#2B2F4A"
WHITE = "#FFFFFF"
BLUSH = "#FF7F9E"
TALL = 410.0
OL = 5.5  # outline width

BODY_C = (0.0, -236.0)
BODY_RX, BODY_RY = 124.0, 170.0
SHOULDER = 104.0, -196.0
UPPER, FORE = 66.0, 64.0


@dataclass
class Pose:
    expr: str = "happy"          # happy, shock, calm, sleep, proud, meh, smile
    blink: float = 0.0           # 0 open .. 1 closed
    mouth: float = 0.0           # talking openness 0..1
    look: tuple = (0.0, 0.0)     # pupil offset -1..1
    arms: tuple = ("rest", "rest")   # (left, right): preset name or (x, y) hand target
    bend: tuple = ("out", "out")  # elbow placement per arm: out, down, up
    bounce: float = 0.0          # vertical offset (negative = up)
    squash: float = 0.0          # >0 stretches tall
    tilt: float = 0.0
    flip: bool = False
    sweat: float = 0.0           # alpha of the sweat drop
    crown: tuple | None = None   # (x, y, rot, scale) of the crown in local coords
    skip_arm: str | None = None  # 'l' or 'r'
    only_arm: str | None = None
    hide_limbs: bool = False     # tucked under a blanket
    extra: dict = field(default_factory=dict)


ARM_PRESETS = {
    # right-arm hand targets; the left arm mirrors x
    "rest": (140.0, -76.0),
    "cheeks": (108.0, -268.0),
    "up": (178.0, -372.0),
    "hip": (128.0, -128.0),
    "shrug": (196.0, -262.0),
    "zen": (36.0, -146.0),
    "point": (232.0, -232.0),
    "thumb": (176.0, -300.0),
    "crown": (64.0, -440.0),
    "wave": (186.0, -350.0),
}


def bean_pts(cx, cy, rx, ry, n=120, flare=0.07, power=2.5):
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    c, s = np.cos(th), np.sin(th)
    x = np.sign(c) * np.abs(c) ** (2 / power)
    y = np.sign(s) * np.abs(s) ** (2 / power)
    return np.c_[cx + rx * (1 + flare * y) * x, cy + ry * y]


def neck_y(x):
    return -224.0 + 22.0 * (1 - (x / BODY_RX) ** 2)


def _hoodie_poly():
    pts = bean_pts(*BODY_C, BODY_RX, BODY_RY, n=240)
    below = pts[:, 1] > neck_y(pts[:, 0])
    start = int(np.argmin(below))  # an index outside the region
    pts, below = np.roll(pts, -start, 0), np.roll(below, -start)
    run = pts[below]
    x0, x1 = run[-1, 0], run[0, 0]
    xs = np.linspace(x0, x1, 30)
    return np.vstack([run, np.c_[xs, neck_y(xs)]])


BODY = bean_pts(*BODY_C, BODY_RX, BODY_RY)
HOODIE = _hoodie_poly()


def ik(shoulder, target, l1, l2, bend, side):
    """Elbow position for a two-bone arm; bend picks which of the two solutions."""
    sx, sy = shoulder
    tx, ty = target
    dx, dy = tx - sx, ty - sy
    d = math.hypot(dx, dy)
    reach = l1 + l2
    if d > reach * 0.999:  # cartoon stretch: lengthen both bones
        k = d / (reach * 0.999)
        l1, l2 = l1 * k, l2 * k
        reach = l1 + l2
    d = max(d, 1e-3)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    mx, my = sx + a * dx / d, sy + a * dy / d
    a_ = (mx + h * dy / d, my - h * dx / d)
    b_ = (mx - h * dy / d, my + h * dx / d)
    key = {"out": lambda e: e[0] * side, "down": lambda e: e[1], "up": lambda e: -e[1]}[bend]
    return max((a_, b_), key=key)


def _hand_target(arm, side):
    if isinstance(arm, str):
        x, y = ARM_PRESETS[arm]
        return (x * side, y)
    return arm


def draw_arm(cv, side, arm, bend):
    """side: +1 right (screen right), -1 left."""
    sh = (SHOULDER[0] * side, SHOULDER[1])
    hand = _hand_target(arm, side)
    el = ik(sh, hand, UPPER, FORE, bend, side)
    pts = [sh, el, hand]
    cv.ostroke(pts, 30, HOOD, OL)
    # cuff
    dx, dy = hand[0] - el[0], hand[1] - el[1]
    d = math.hypot(dx, dy) or 1
    cuff = (hand[0] - dx / d * 14, hand[1] - dy / d * 14)
    cv.circle(*cuff, 17, fill=HOOD_D, line=INK, lw=OL)
    cv.circle(*hand, 19, fill=SKIN, line=INK, lw=OL)


def draw_eye(cv, x, y, p, side):
    e = p.expr
    rx, ry = 31.0, 38.0
    if e == "shock":
        rx, ry = 35.0, 45.0
    if e == "sleep":
        cv.arc(x, y - 4, 24, 14, 20, 160, 7, INK)
        return
    if e == "joy":
        cv.arc(x, y + 10, 24, 22, 200, 340, 8, INK)
        return
    if e == "calm":
        # peaceful closed eyes, lashes curving down
        cv.arc(x, y - 6, 25, 17, 15, 165, 8, INK)
        return
    open_ = 1 - clamp(p.blink)
    if open_ < 0.18:
        cv.arc(x, y + 2, 26, 10, 15, 165, 7, INK)
        return
    lx, ly = p.look
    cv.ellipse(x, y, rx, ry, fill=WHITE, line=INK, lw=OL)
    pr = 12.0 if e == "shock" else 17.0
    px, py = x + lx * (rx - pr - 4), y + ly * (ry - pr - 6) + 3
    cv.circle(px, py, pr, fill=INK)
    cv.circle(px - pr * 0.38, py - pr * 0.42, pr * 0.38, fill=WHITE)
    cv.circle(px + pr * 0.35, py + pr * 0.35, pr * 0.17, fill=WHITE)
    if open_ < 0.999:
        # eyelid coming down from the top
        lid_y = lerp(y - ry, y + ry, 1 - open_)
        th = np.linspace(180, 360, 40)
        arc = np.c_[x + (rx + 4) * np.cos(np.radians(th)), y + (ry + 4) * np.sin(np.radians(th))]
        arc = arc[arc[:, 1] <= lid_y]
        lid = np.vstack([[[x - rx - 4, lid_y]], arc, [[x + rx + 4, lid_y]]]) if len(arc) else None
        if lid is not None:
            cv.poly(lid, fill=SKIN)
            cv.stroke([(x - rx - 2, lid_y), (x + rx + 2, lid_y)], 6, INK)


def draw_brows(cv, p):
    e = p.expr
    for side in (-1, 1):
        x = 46 * side
        if e == "shock":
            pts = [(x - 20 * side, -382), (x, -392), (x + 22 * side, -384)]
        elif e in ("proud", "determined"):
            pts = [(x - 22 * side, -366), (x + 22 * side, -376)]
        elif e == "meh":
            pts = [(x - 22 * side, -380), (x + 20 * side, -374)]
        elif e in ("calm", "sleep"):
            pts = [(x - 20 * side, -364), (x, -369), (x + 20 * side, -365)]
        else:
            pts = [(x - 20 * side, -370), (x, -378), (x + 20 * side, -372)]
        cv.stroke(pts, 8, INK)


def draw_mouth(cv, p):
    e, o = p.expr, clamp(p.mouth)
    cx, cy = 0.0, -270.0
    if e == "shock":
        rx, ry = 17 + 5 * o, 22 + 9 * o
        cv.ellipse(cx, cy + 6, rx, ry, fill="#6B1D33", line=INK, lw=OL)
        cv.ellipse(cx, cy + 6 + ry * 0.45, rx * 0.6, ry * 0.35, fill="#FF7A8A")
        return
    if e == "sleep":
        cv.ellipse(cx + 6, cy + 4, 8, 6 + 3 * o, fill="#6B1D33", line=INK, lw=4)
        return
    if e == "meh" and o < 0.12:
        cv.stroke([(-20, cy + 2), (20, cy - 2)], 7, INK)
        return
    if o < 0.08:
        w = 26 if e != "calm" else 20
        cv.arc(cx, cy - 10, w, 16, 25, 155, 7, INK)
        return
    # open talking smile: flat-ish top, round bottom
    w = 27.0 if e != "calm" else 22.0
    depth = 8 + 26 * o
    top = cy - 4
    th = np.radians(np.linspace(0, 180, 30))
    pts = np.vstack([np.c_[w * np.cos(th), top + depth * np.sin(th)], [[-w, top]]])
    cv.poly(pts, fill="#6B1D33", line=INK, lw=OL)
    if depth > 16:
        cv.ellipse(0, top + depth * 0.72, w * 0.55, depth * 0.28, fill="#FF7A8A")
    cv.rrect(-w * 0.62, top - 1, w * 0.62, top + min(8, depth * 0.3), 3, fill=WHITE)


def draw_crown(cv, x, y, rot=0.0, s=1.0):
    with cv.group(x, y, s=s, rot=rot):
        pts = [(-70, 0), (-80, -78), (-40, -38), (0, -96), (40, -38), (80, -78), (70, 0)]
        cv.poly(pts, fill="#FFC93C", line=INK, lw=OL)
        cv.rrect(-74, -14, 74, 10, 6, fill="#F2A900", line=INK, lw=OL)
        for px, py, r in ((-80, -78, 9), (0, -96, 10), (80, -78, 9)):
            cv.circle(px, py, r, fill="#FFE27A", line=INK, lw=4)
        cv.circle(0, -2, 9, fill="#FF4D6D", line=INK, lw=3.5)
        cv.circle(-40, -2, 7, fill="#4DA3FF", line=INK, lw=3.5)
        cv.circle(40, -2, 7, fill="#4DA3FF", line=INK, lw=3.5)
        cv.poly([(-52, -20), (-60, -60), (-46, -40)], fill=fade("#FFFFFF", 0.55))


def draw(cv, x, y, height, p: Pose, shadow=True):
    s = height / TALL
    if shadow and p.only_arm is None:
        lift = clamp(-p.bounce / 60)
        cv.soft_shadow(x, y + 4, 120 * s * (1 - 0.25 * lift), 20 * s, alpha=0.28 * (1 - 0.4 * lift))
    sx = s * (1 - p.squash * 0.6) * (-1 if p.flip else 1)
    sy = s * (1 + p.squash)
    with cv.group(x, y + p.bounce, sx=sx, sy=sy, rot=p.tilt):
        if p.only_arm:
            side = 1 if p.only_arm == "r" else -1
            idx = 1 if side == 1 else 0
            draw_arm(cv, side, p.arms[idx], p.bend[idx])
            return
        # legs + shoes
        if not p.hide_limbs:
            for side in (-1, 1):
                cv.ostroke([(36 * side, -90), (40 * side, -20)], 32, PANTS, OL)
            for side in (-1, 1):
                cv.ellipse(48 * side, -12, 36, 19, fill=SHOE, line=INK, lw=OL)
                cv.ellipse(48 * side + 10 * side, -18, 10, 5, fill=fade(WHITE, 0.7))
        # body
        cv.poly(BODY, fill=SKIN, line=INK, lw=OL)
        cv.poly(HOODIE, fill=HOOD)
        # soft side shading on the hoodie
        cv.poly(HOODIE[HOODIE[:, 0] > 40], fill=fade(HOOD_D, 0.35))
        cv.poly(BODY, line=INK, lw=OL)
        # head shine
        cv.ellipse(-62, -366, 20, 30, fill=fade(WHITE, 0.35))
        # pocket
        cv.rrect(-66, -150, 66, -96, 20, fill=HOOD_D, line=INK, lw=4.5)
        # hood collar + strings
        xs = np.linspace(-104, 104, 30)
        cv.ostroke(np.c_[xs, neck_y(xs) + 2], 26, HOOD_L, OL)
        for side in (-1, 1):
            cv.stroke([(22 * side, -194), (25 * side, -150)], 6, "#FFF2E2")
            cv.circle(25 * side, -148, 6, fill="#FFF2E2", line=INK, lw=3)
        # face
        draw_brows(cv, p)
        for side in (-1, 1):
            draw_eye(cv, 46 * side, -318, p, side)
        for side in (-1, 1):
            cv.ellipse(84 * side, -278, 19, 10, fill=fade(BLUSH, 0.55))
        draw_mouth(cv, p)
        if p.sweat > 0:
            a = clamp(p.sweat)
            with cv.group(118, -372, alpha=a):
                cv.poly(np.vstack([[[0, -26]], ellipse_pts(0, 0, 13, 15, -20, 200, 24)]),
                        fill="#8FD8FF", line=INK, lw=4)
        if p.crown is not None:
            cx, cy, cr, cs = p.crown
            draw_crown(cv, cx, cy, cr, cs)
        # arms in front
        for side, idx in ((-1, 0), (1, 1)):
            if p.hide_limbs:
                break
            if p.skip_arm == ("l" if side == -1 else "r"):
                continue
            draw_arm(cv, side, p.arms[idx], p.bend[idx])
