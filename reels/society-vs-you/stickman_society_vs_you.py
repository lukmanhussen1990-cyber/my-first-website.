#!/usr/bin/env python3
"""
Society vs You — a 13-second 2D stickman reel (1080x1920, 30 fps, no audio).

Every frame is drawn with pycairo and piped straight into ffmpeg.

    python3 stickman_society_vs_you.py --sheet       contact sheet, 1 frame per 0.5 s
    python3 stickman_society_vs_you.py --video       the MP4
    python3 stickman_society_vs_you.py --frame 9.5   one frame as PNG (debugging)
    python3 stickman_society_vs_you.py               sheet, then video

To make a new version, change CONFIG only: labels, header, colors, layout, beats, resolution.
"""
import argparse
import math
import os
import random
import subprocess
import sys

import cairo

HERE = os.path.dirname(os.path.abspath(__file__))

# =============================================================================
# 1. CONFIG
# =============================================================================
CONFIG = {
    "video": {"width": 1080, "height": 1920, "fps": 30, "duration": 13.0,
              "hold_from": 12.5},              # last 0.5 s is a frozen final frame
    "safe": {"top": 200, "bottom": 280, "side": 60},
    "output": "stickman_society_vs_you.mp4",
    "contact_sheet": "stickman_society_vs_you_contact_sheet.png",
    "sheet": {"step": 0.5, "cols": 6, "thumb_w": 270},

    "fonts": {"header": "Inter Display Black", "label": "Inter ExtraBold",
              "bubble": "Inter Black", "watermark": "Inter SemiBold"},
    "text": {
        "header": "YOURSELF",
        "crowd": ["Family", "Friends", "Society", "Relatives"],   # left to right
        "hero": "You",
        "laugh": "HA HA",
        "watermark": "@YOURHANDLE",
        "header_size": 118, "label_size": 30, "bubble_size": 25, "watermark_size": 25,
        "label_rows": [0, 38, 0, 38],             # extra lift per crowd label so neighbours never collide
    },

    "colors": {
        # sky, top -> horizon
        "sky": [(0.0, "#060409"), (0.30, "#160b22"), (0.55, "#331338"), (0.78, "#6e2234"),
                (0.92, "#a8401f"), (1.0, "#c9581c")],
        "sun": "#a8321f", "sun_edge": "#7e2216", "sun_glow": "#c8481e",
        "far": "#2a1219",                         # distant trees / poles
        "ground_top": "#2b1a12", "ground_bottom": "#0f0a07",
        "figure": "#000000", "rim": "#ff9a4d",
        "rock": "#2c2b2f", "rock_dark": "#19181b", "rock_light": "#47444a", "rock_rim": "#ff8a45",
        "dust": "#9c7a5e", "pebble": "#3a3532", "sweat": "#d8ecff",
        "text": "#ffffff", "bubble": "#ffffff", "bubble_text": "#141414",
        "flame_outer": "#ff5a1a", "flame_mid": "#ff9a1f", "flame_inner": "#ffe27a",
    },

    "layout": {
        "horizon": 1410, "ground": 1472,          # feet stand on 'ground'
        "sun_x": 540, "sun_r": 385,
        "crowd_x": [108, 213, 318, 423],
        "crowd_back": [12, 15, 30, 26],           # how far each steps back when scared
        "friend_walk": 38,                        # Friends walks this far away (and back into depth)
        "hero_start": 1185, "hero_stop": 850, "hero_kneel": 908, "hero_chest": 852, "hero_press": 826, "hero_step": 790,
        "rock_x": 668, "rock_slam_x": 624,
    },
    "crowd_depth": [0.94, 6],                     # crowd scale and how far behind the hero they stand
    "figure": {"head_r": 34, "torso": 115, "torso_w": 32, "upper_arm": 55, "fore_arm": 52, "arm_w": 21,
               "thigh": 60, "shin": 60, "leg_w": 23.5},
    "rock": {"w": 330, "h": 335, "seed": 11},

    # story beats (seconds)
    "beats": {
        "walk_end": 1.1, "look": 1.25, "roll": 1.55, "grab": 1.85, "strain": 2.05,
        "crowd_laugh": 2.3, "whisper": [3.0, 4.15],
        "fail": 4.5, "rock_thud": 4.65, "knee_down": 4.78,
        "friend_turn": 4.9, "friend_walk": [5.0, 5.8],
        "laugh_slow": [6.0, 7.3], "gust": [6.95, 7.75], "eyes_snap": 7.75,
        "stand": 8.0, "regrip": 8.4, "lift": [8.6, 9.0, 9.6, 10.3],
        "shock": [9.55, 9.3, 9.25, 9.0],          # per crowd member (Family, Friends, Society, Relatives)
        "friend_turn_back": 9.3,
        "hero_step": [10.6, 11.2], "crowd_steps": [10.75, 11.12, 11.2, 11.58], "trip": 11.42,
        "slam": [12.0, 12.15], "stand_tall": 12.22,
    },
}

W, H = CONFIG["video"]["width"], CONFIG["video"]["height"]
FPS = CONFIG["video"]["fps"]
L, B, FIG = CONFIG["layout"], CONFIG["beats"], CONFIG["figure"]
GROUND, HORIZON = L["ground"], L["horizon"]
TAU, DEG = math.tau, math.pi / 180


# =============================================================================
# 2. MATH, EASING, COLOR
# =============================================================================
def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def lerp(a, b, k):
    return a + (b - a) * k


def inv_lerp(a, b, v):
    return clamp((v - a) / (b - a)) if b != a else 0.0


def smooth(a, b, v):
    k = inv_lerp(a, b, v)
    return k * k * (3 - 2 * k)


def bump(t, a, b):
    return 0.0 if t <= a or t >= b else math.sin(math.pi * (t - a) / (b - a))


EASE = {
    "linear": lambda k: k,
    "in_quad": lambda k: k * k,
    "out_quad": lambda k: k * (2 - k),
    "in_out_quad": lambda k: 2 * k * k if k < 0.5 else 1 - (-2 * k + 2) ** 2 / 2,
    "in_cubic": lambda k: k ** 3,
    "out_cubic": lambda k: 1 - (1 - k) ** 3,
    "in_out_cubic": lambda k: 4 * k ** 3 if k < 0.5 else 1 - (-2 * k + 2) ** 3 / 2,
    "in_out_sine": lambda k: -(math.cos(math.pi * k) - 1) / 2,
    "out_back": lambda k: 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
    "step": lambda k: 0.0 if k < 1 else 1.0,
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgba(h, a=1.0):
    r, g, b = hex_rgb(h)
    return r, g, b, a


def hash1(n):
    x = math.sin(n * 127.1 + 311.7) * 43758.5453123
    return x - math.floor(x)


def noise1(x):
    i = math.floor(x)
    f = x - i
    u = f * f * (3 - 2 * f)
    return lerp(hash1(i), hash1(i + 1), u) * 2 - 1


# =============================================================================
# 3. TIMELINE: keyframe tracks with per-segment easing
# =============================================================================
def mix(a, b, k):
    """Interpolate numbers, lists/tuples and dicts; anything else snaps at the midpoint."""
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a + (b - a) * k
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return [mix(x, y, k) for x, y in zip(a, b)]
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for key, v in b.items():
            out[key] = mix(a[key], v, k) if key in a else v
        return out
    return a if k < 0.5 else b


class Track:
    """keys = [(time, value, ease), ...]; the ease belongs to the segment that ENDS at that key."""

    def __init__(self, keys, ease="in_out_sine", resolve=lambda v: v):
        self.keys = sorted(((k[0], resolve(k[1]), k[2] if len(k) > 2 else None) for k in keys),
                           key=lambda k: k[0])
        self.ease = ease

    def at(self, t):
        K = self.keys
        if t <= K[0][0]:
            return K[0][1]
        for i in range(1, len(K)):
            if t < K[i][0]:
                t0, v0, _ = K[i - 1]
                t1, v1, e = K[i]
                return mix(v0, v1, EASE[e or self.ease]((t - t0) / (t1 - t0)))
        return K[-1][1]


# =============================================================================
# 4. STICKMAN — joint skeleton, pose keyframes, eye expressions, warm rim light
# =============================================================================
# Angles are absolute degrees: 0 = pointing down, +90 = toward the facing direction, 180 = up.
# Hands are polar targets around the shoulder: (angle, reach 0..1 of the arm), solved with 2-bone IK,
# and can be pulled to world points ("fix") to grip things like the boulder.
POSE_BASE = dict(lean=0, head=0, ground=1, hipY=-132, hipX=0,
                 legF=[4, 0], legB=[-5, -2], handF=[8, 0.97], handB=[-6, 0.97], elbowF=1, elbowB=1)

POSES = {
    "STAND": {},
    "ARMS_CROSSED": dict(lean=-4, head=-5, legF=[6, 1], legB=[-7, -3], handF=[52, 0.38], handB=[60, 0.33]),
    "SMUG": dict(lean=-6, head=-8, legF=[7, 1], legB=[-8, -3], handF=[52, 0.38], handB=[60, 0.33]),
    # walking (alternate A, PASS_A, B, PASS_B)
    "WALK_A": dict(lean=4, legF=[24, 6], legB=[-22, -28], handF=[-20, 0.97], handB=[22, 0.97]),
    "PASS_A": dict(lean=4, legF=[-2, -2], legB=[16, -40], handF=[0, 0.98], handB=[4, 0.98]),
    "WALK_B": dict(lean=4, legF=[-22, -28], legB=[24, 6], handF=[22, 0.97], handB=[-20, 0.97]),
    "PASS_B": dict(lean=4, legF=[16, -40], legB=[-2, -2], handF=[4, 0.98], handB=[0, 0.98]),
    # crowd laughing
    "LAUGH_BEND": dict(lean=16, head=-26, legF=[16, -6], legB=[-6, -12], handF=[24, 0.84], handB=[12, 0.88]),
    "POINT_LAUGH": dict(lean=8, head=-16, legF=[8, 2], legB=[-10, -4], handF=[94, 1.0], handB=[36, 0.42]),
    "LAUGH_BACK": dict(lean=-10, head=-26, legF=[10, 2], legB=[-10, -4], handF=[38, 0.44], handB=[30, 0.46]),
    "SLAP_KNEE": dict(lean=18, head=-24, legF=[34, -2], legB=[-8, -10], handF=[34, 0.9], handB=[40, 0.5]),
    "WHISPER": dict(lean=26, head=10, legF=[16, 2], legB=[-14, -8], handF=[150, 0.4], handB=[10, 0.95]),
    "LISTEN": dict(lean=14, head=26, legF=[6, 1], legB=[-8, -3], handF=[52, 0.38], handB=[60, 0.33]),
    "HOWL": dict(lean=-14, head=-30, legF=[14, 2], legB=[-12, -6], handF=[28, 0.86], handB=[40, 0.44]),
    "CHUCKLE": dict(lean=2, head=-6, legF=[6, 1], legB=[-8, -3], handF=[36, 0.46], handB=[96, 0.5]),
    "WAVE_OFF": dict(lean=2, head=-4, handF=[-150, 0.62], handB=[6, 0.97]),   # back turned, hand flicked back
    "SHOCKED": dict(lean=-8, head=-4, legF=[8, 2], legB=[-10, -4], handF=[42, 0.92], handB=[-34, 0.92]),
    "SCARED": dict(lean=-12, head=-2, legF=[12, 2], legB=[-12, -6], handF=[118, 0.72], handB=[104, 0.66]),
    "SCARED_A": dict(lean=-12, head=-2, legF=[22, 6], legB=[-24, -26], handF=[118, 0.72], handB=[104, 0.66]),
    "SCARED_B": dict(lean=-12, head=-2, legF=[-20, -24], legB=[22, 6], handF=[118, 0.72], handB=[104, 0.66]),
    "TRIP": dict(lean=-42, head=-20, legF=[64, 30], legB=[-10, -8], handF=[150, 0.9], handB=[-150, 0.9]),
    "FALLEN": dict(ground=0, hipY=-16, lean=-62, head=30, legF=[96, 70], legB=[80, 36],
                   handF=[-40, 0.98], handB=[-62, 0.98]),
    "FROZEN": dict(lean=-12, head=-2, legF=[12, 2], legB=[-12, -6], handF=[60, 0.7], handB=[40, 0.7]),
    # hero
    "LOOK_UP": dict(lean=-4, head=-24),
    "ROLL_A": dict(lean=-6, head=-10, handF=[24, 0.82], handB=[-22, 0.84]),
    "ROLL_B": dict(lean=4, head=4, handF=[-14, 0.96], handB=[14, 0.96]),
    "GRIP": dict(lean=32, head=8, legF=[40, -12], legB=[-8, -30]),
    "STRAIN": dict(lean=-14, head=-6, legF=[34, -14], legB=[-16, -26]),
    "KNEEL": dict(lean=34, head=44, legF=[86, 0], legB=[4, -88], handF=[60, 0.56], handB=[-4, 0.98]),
    "STAND_ANGRY": dict(lean=6, head=4, handF=[10, 0.95], handB=[-8, 0.95]),
    "SQUAT_GRIP": dict(lean=24, head=-4, legF=[72, -24], legB=[40, -52]),
    "LIFT_CHEST": dict(lean=-10, head=-6, legF=[26, -8], legB=[-12, -18]),
    "PRESS": dict(lean=-4, head=-8, legF=[14, 2], legB=[-14, -6]),
    "CARRY_A": dict(lean=-2, head=-4, legF=[24, 6], legB=[-20, -26]),
    "CARRY_B": dict(lean=-2, head=-4, legF=[10, 2], legB=[-10, -6]),
    "SLAM": dict(lean=36, head=10, legF=[32, -10], legB=[-22, -22]),
    "STAND_TALL": dict(lean=-2, head=0, legF=[4, 0], legB=[-4, -1], handF=[5, 0.98], handB=[-5, 0.98]),
}

FACE_BASE = dict(size=1.0, round=0.0, lid=0.0, wink=0.0, slant=0.0, low=0.0, laugh=0.0, squeeze=0.0,
                 lookX=0.0, lookY=0.0)
FACES = {
    "neutral": {},
    "smug": dict(lid=0.36, lookY=0.1),
    "curious": dict(size=1.06, lookY=-0.8, lookX=0.2),
    "laugh": dict(laugh=1.0),
    "mock": dict(wink=0.62, lid=0.12, slant=-0.2),                 # one eye narrowed
    "strain": dict(squeeze=1.0),
    "down": dict(lid=0.58, lookY=0.85),
    "angry": dict(lid=0.44, slant=1.2, low=0.14),                  # sharp narrowed slants
    "shocked": dict(round=1.0, size=1.5),
    "scared": dict(round=1.0, size=1.38, lookX=0.4),
    "calm": dict(lid=0.26),
}


def pose_of(p):
    d = dict(POSE_BASE)
    d.update(POSES[p] if isinstance(p, str) else p)
    return d


def face_of(f):
    d = dict(FACE_BASE)
    d.update(FACES[f] if isinstance(f, str) else f)
    return d


def ik2(s, t, a, b, f, bend):
    """Two-bone IK; the bend side is mirrored by facing so elbows flex naturally."""
    dx, dy = t[0] - s[0], t[1] - s[1]
    d = math.hypot(dx, dy) or 1e-6
    dc = clamp(d, abs(a - b) + 1e-3, a + b - 1e-3)
    ux, uy = dx / d, dy / d
    A = math.acos(clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1)) * f * (1 if bend >= 0 else -1)
    ex, ey = ux * math.cos(A) - uy * math.sin(A), ux * math.sin(A) + uy * math.cos(A)
    return (s[0] + ex * a, s[1] + ey * a), (s[0] + ux * dc, s[1] + uy * dc)


RIM_LAYERS = [(1.0, 3.6, 0.16), (1.6, 2.2, 0.40), (2.3, 1.2, 0.85)]   # (offset toward sun, extra width, alpha)


def rim_dir(x, y):
    """Unit vector from a point toward the sun: the lit edge faces it."""
    dx, dy = L["sun_x"] - x, (HORIZON - 80) - y
    n = math.hypot(dx, dy) or 1
    return dx / n, dy / n


class Stickman:
    def __init__(self, name, dims=FIG):
        self.name, self.D = name, dims

    def solve(self, P, ax, ay, f, sq=(1, 1), fix=None, scale=1.0):
        D = self.D if scale == 1.0 else {k: v * scale for k, v in self.D.items()}   # scale < 1 = further away

        def dirv(a):
            return f * math.sin(a * DEG), math.cos(a * DEG)

        def add(p, d, l):
            return p[0] + d[0] * l, p[1] + d[1] * l

        def leg(ang):
            k = add((0, 0), dirv(ang[0]), D["thigh"])
            return k, add(k, dirv(ang[1]), D["shin"])

        kF, aF = leg(P["legF"])
        kB, aB = leg(P["legB"])
        lowest = max(aF[1], aB[1]) + D["leg_w"] * 0.5
        hip = (ax + f * P["hipX"], ay + lerp(P["hipY"], -lowest, clamp(P["ground"])))
        off = lambda p: (hip[0] + p[0], hip[1] + p[1])
        up = (f * math.sin(P["lean"] * DEG), -math.cos(P["lean"] * DEG))
        neck = add(hip, up, D["torso"])
        shoulder = add(hip, up, D["torso"] - D["torso_w"] * 0.34)
        ha = (P["lean"] + P["head"]) * DEG
        head = add(neck, (f * math.sin(ha), -math.cos(ha)), D["head_r"] * 0.98)
        reach = D["upper_arm"] + D["fore_arm"]

        def target(h, key):
            p = add(shoulder, dirv(h[0]), reach * h[1])
            w = fix.get(key) if fix else None
            return (lerp(p[0], w[0], w[2]), lerp(p[1], w[1], w[2])) if w else p

        elbowF, handF = ik2(shoulder, target(P["handF"], "F"), D["upper_arm"], D["fore_arm"], f, P["elbowF"])
        elbowB, handB = ik2(shoulder, target(P["handB"], "B"), D["upper_arm"], D["fore_arm"], f, P["elbowB"])
        J = dict(f=f, D=D, hip=hip, neck=neck, shoulder=shoulder, head=head,
                 kneeF=off(kF), ankF=off(aF), kneeB=off(kB), ankB=off(aB),
                 elbowF=elbowF, handF=handF, elbowB=elbowB, handB=handB)
        for s, ang in (("F", P["legF"]), ("B", P["legB"])):
            J["toe" + s] = add(J["ank" + s], dirv(90 + ang[1] * 0.35), D["leg_w"] * 0.72)
        if sq[0] != 1 or sq[1] != 1:   # squash & stretch around the feet
            for k, v in J.items():
                if isinstance(v, tuple):
                    J[k] = (ax + (v[0] - ax) * sq[0], ay + (v[1] - ay) * sq[1])
        return J

    def pieces(self, J):
        D = J["D"]
        lw, aw = D["leg_w"], D["arm_w"]
        return [
            ("line", [J["hip"], J["kneeB"], J["ankB"]], lw, "legs"),
            ("line", [J["ankB"], J["toeB"]], lw * 1.12, "legs"),
            ("line", [J["shoulder"], J["elbowB"], J["handB"]], aw, "arms"),
            ("dot", J["handB"], aw * 0.62, "arms"),
            ("line", [J["hip"], J["neck"]], D["torso_w"], "body"),
            ("dot", J["head"], D["head_r"], "body"),
            ("line", [J["hip"], J["kneeF"], J["ankF"]], lw, "legs"),
            ("line", [J["ankF"], J["toeF"]], lw * 1.12, "legs"),
            ("line", [J["shoulder"], J["elbowF"], J["handF"]], aw, "arms"),
            ("dot", J["handF"], aw * 0.62, "arms"),
        ]

    @staticmethod
    def _shape(ctx, piece, extra=0.0, dx=0.0, dy=0.0):
        kind, geo, w, _ = piece
        if kind == "line":
            ctx.set_line_width(w + 2 * extra)
            ctx.move_to(geo[0][0] + dx, geo[0][1] + dy)
            for p in geo[1:]:
                ctx.line_to(p[0] + dx, p[1] + dy)
            ctx.stroke()
        else:
            ctx.arc(geo[0] + dx, geo[1] + dy, w + extra, 0, TAU)
            ctx.fill()

    def draw(self, ctx, st, parts=("legs", "arms", "body")):
        """st: x, y, f, pose, face, sq, fix, sweat. Returns the solved joints."""
        J = self.solve(st["pose"], st["x"], st["y"], st["f"], st.get("sq", (1, 1)), st.get("fix"), st.get("scale", 1.0))
        ps = [p for p in self.pieces(J) if p[3] in parts]
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        rx, ry = rim_dir(J["neck"][0], J["neck"][1])
        for off, extra, alpha in RIM_LAYERS:      # warm rim: union of shifted silhouettes, then the body on top
            ctx.push_group()
            ctx.set_source_rgba(*rgba(CONFIG["colors"]["rim"]))
            for p in ps:
                self._shape(ctx, p, extra, rx * off, ry * off)
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(alpha * st.get("rim", 1.0))
        ctx.set_source_rgba(*rgba(CONFIG["colors"]["figure"]))
        for p in ps:
            self._shape(ctx, p)
        if "body" in parts:
            self.draw_eyes(ctx, J, st["face"])
            if st.get("sweat", 0) > 0.01:
                R = J["D"]["head_r"]
                draw_drop(ctx, J["head"][0] - J["f"] * R * 0.85, J["head"][1] - R * 0.45, R * 0.15, st["sweat"])
        return J

    def draw_eyes(self, ctx, J, F):
        R, f = J["D"]["head_r"], J["f"]
        size = F["size"]
        rx = lerp(R * 0.13, R * 0.15, F["round"]) * size
        ry = lerp(R * 0.2, R * 0.15, F["round"]) * size
        cx = J["head"][0] + f * (R * 0.4 + F["lookX"] * R * 0.12)
        cy = J["head"][1] - R * 0.05 + F["lookY"] * R * 0.15
        gap = R * (0.24 + 0.04 * F["round"] * (size - 1))
        lw = R * 0.08
        w_normal = 1 - max(F["laugh"], F["squeeze"])
        for side in (-1, 1):
            ex, ey, inner = cx + side * gap, cy, -side
            front = side == (1 if f > 0 else -1)
            if w_normal > 0.01:
                lid = clamp(F["lid"] + (F["wink"] if front else 0))
                sl = F["slant"] * ry * 0.75
                ctx.push_group()
                ctx.save()
                ctx.translate(ex, ey)
                ctx.scale(rx, ry)
                ctx.arc(0, 0, 1, 0, TAU)
                ctx.restore()
                ctx.clip()
                ctx.set_source_rgb(1, 1, 1)
                ctx.paint()
                ctx.set_source_rgb(0, 0, 0)
                ly = ey - ry + lid * 2 * ry
                xi, xo = ex + inner * (rx + 2), ex - inner * (rx + 2)
                if lid > 0.001 or abs(sl) > 0.001:
                    ctx.move_to(xo, ly - sl)
                    ctx.line_to(xi, ly + sl)
                    ctx.line_to(xi, ey - ry - 8)
                    ctx.line_to(xo, ey - ry - 8)
                    ctx.close_path()
                    ctx.fill()
                if F["low"] > 0.001:
                    by = ey + ry - F["low"] * 2 * ry
                    ctx.rectangle(ex - rx - 3, by, rx * 2 + 6, ry * 2)
                    ctx.fill()
                ctx.reset_clip()
                ctx.pop_group_to_source()
                ctx.paint_with_alpha(w_normal)
            ctx.set_line_width(lw)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.set_line_join(cairo.LINE_JOIN_ROUND)
            if F["laugh"] > 0.01:        # laughing: squinting upside-down U
                ctx.set_source_rgba(1, 1, 1, F["laugh"])
                r = rx * 1.35
                ctx.new_path()
                ctx.arc(ex, ey + r * 0.45, r, math.pi + 0.25, TAU - 0.25)
                ctx.stroke()
            if F["squeeze"] > 0.01:      # strain: squeezed shut  > <
                ctx.set_source_rgba(1, 1, 1, F["squeeze"])
                w, h = rx * 1.15, ry * 0.62
                ctx.move_to(ex - inner * w, ey - h)
                ctx.line_to(ex + inner * w, ey)
                ctx.line_to(ex - inner * w, ey + h)
                ctx.stroke()


def draw_drop(ctx, x, y, r, alpha=1.0, angle=0.0):
    """Sweat drop, tip pointing up (rotated by angle)."""
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.move_to(0, -r * 1.9)
    ctx.curve_to(r * 0.5, -r * 0.9, r, -r * 0.3, r, r * 0.15)
    ctx.arc(0, r * 0.15, r, 0, math.pi)
    ctx.curve_to(-r, -r * 0.3, -r * 0.5, -r * 0.9, 0, -r * 1.9)
    ctx.set_source_rgba(*rgba(CONFIG["colors"]["sweat"], alpha))
    ctx.fill()
    ctx.arc(-r * 0.35, 0.0, r * 0.28, 0, TAU)
    ctx.set_source_rgba(1, 1, 1, 0.85 * alpha)
    ctx.fill()
    ctx.restore()


# =============================================================================
# 5. BOULDER — rough outline, facets, cracks, warm edge light from the sun
# =============================================================================
class Boulder:
    """Local coordinates: origin at the bottom centre, y grows downward (the rock spans y = -h..0)."""

    def __init__(self, w, h, seed):
        self.w, self.h = w, h
        r = random.Random(seed)
        n = 34
        pts = []
        for i in range(n):
            a = i / n * TAU
            k = 1 + 0.075 * noise1(a * 1.7 + seed) + 0.035 * noise1(a * 5.3 + seed * 3) + 0.018 * (r.random() - 0.5)
            x, y = math.cos(a) * w / 2 * k, -h / 2 + math.sin(a) * h / 2 * k * 1.06
            pts.append((x, min(y, -1.0 * abs(x) / w * 6)))      # flatten the base so it sits on the ground
        self.pts = pts
        self.facets = []
        for _ in range(9):                                       # flat light/dark planes
            cx, cy = r.uniform(-w * 0.32, w * 0.32), r.uniform(-h * 0.82, -h * 0.2)
            rad, m = r.uniform(26, 62), r.randint(5, 7)
            poly = [(cx + math.cos(j / m * TAU + r.random() * 0.5) * rad * r.uniform(0.6, 1.1),
                     cy + math.sin(j / m * TAU + r.random() * 0.5) * rad * r.uniform(0.5, 0.9)) for j in range(m)]
            self.facets.append((poly, r.choice([-1, 1]) * r.uniform(0.05, 0.11)))
        self.cracks = []
        for _ in range(6):                                       # jagged cracks running in from the edge
            p = pts[r.randrange(n)]
            x, y = p[0] * 0.96, p[1] * 0.96 + (-h / 2) * 0.04
            ang = math.atan2((-h / 2) - y, -x) + r.uniform(-0.6, 0.6)
            line = [(x, y)]
            for _ in range(r.randint(4, 7)):
                ang += r.uniform(-0.7, 0.7)
                step = r.uniform(12, 26)
                x, y = x + math.cos(ang) * step, y + math.sin(ang) * step
                line.append((x, y))
            self.cracks.append(line)

    def grip(self, local, cx, by, rot):
        """World position of a local point under the current transform."""
        x, y = local[0], local[1] + self.h / 2
        c, s = math.cos(rot), math.sin(rot)
        return cx + x * c - y * s, by - self.h / 2 + x * s + y * c

    def _outline(self, ctx, dx=0.0, dy=0.0):
        p = self.pts
        ctx.move_to(p[0][0] + dx, p[0][1] + dy)
        for q in p[1:]:
            ctx.line_to(q[0] + dx, q[1] + dy)
        ctx.close_path()

    def top(self, by):
        return by - self.h * 1.04

    def draw(self, ctx, cx, by, rot):
        C = CONFIG["colors"]
        sx, sy = rim_dir(cx, by - self.h / 2)
        c, s = math.cos(-rot), math.sin(-rot)
        lx, ly = sx * c - sy * s, sx * s + sy * c                # sun direction in local space
        ctx.save()
        ctx.translate(cx, by - self.h / 2)
        ctx.rotate(rot)
        ctx.translate(0, self.h / 2)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        for off, extra, alpha in RIM_LAYERS:                     # warm rim, same recipe as the figures
            ctx.push_group()
            ctx.set_source_rgba(*rgba(C["rock_rim"]))
            self._outline(ctx, lx * off * 1.4, ly * off * 1.4)
            ctx.set_line_width(extra * 2)
            ctx.fill_preserve()
            ctx.stroke()
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(alpha)
        g = cairo.LinearGradient(lx * self.w * 0.5, -self.h / 2 + ly * self.h * 0.5,
                                 -lx * self.w * 0.5, -self.h / 2 - ly * self.h * 0.5)
        g.add_color_stop_rgb(0, *hex_rgb(C["rock_light"]))
        g.add_color_stop_rgb(0.45, *hex_rgb(C["rock"]))
        g.add_color_stop_rgb(1, *hex_rgb(C["rock_dark"]))
        self._outline(ctx)
        ctx.set_source(g)
        ctx.fill_preserve()
        ctx.save()
        ctx.clip()
        for poly, tone in self.facets:
            ctx.move_to(*poly[0])
            for q in poly[1:]:
                ctx.line_to(*q)
            ctx.close_path()
            ctx.set_source_rgba(1, 1, 1, tone) if tone > 0 else ctx.set_source_rgba(0, 0, 0, -tone * 1.6)
            ctx.fill()
        shade = cairo.LinearGradient(0, -self.h, 0, 0)            # darker toward the ground
        shade.add_color_stop_rgba(0, 0, 0, 0, 0)
        shade.add_color_stop_rgba(1, 0, 0, 0, 0.45)
        ctx.rectangle(-self.w, -self.h * 1.2, self.w * 2, self.h * 1.3)
        ctx.set_source(shade)
        ctx.fill()
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        for line in self.cracks:
            for width, col, d in ((3.2, (0.04, 0.035, 0.04, 0.95), 0.0), (1.2, rgba(C["rock_rim"], 0.35), 1.6)):
                ctx.set_line_width(width)
                ctx.set_source_rgba(*col)
                ctx.move_to(line[0][0] + lx * d, line[0][1] + ly * d)
                for q in line[1:]:
                    ctx.line_to(q[0] + lx * d, q[1] + ly * d)
                ctx.stroke()
        self._outline(ctx, -lx * 5, -ly * 5)                     # sunlit edge band just inside the outline
        self._outline(ctx)
        ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
        ctx.set_source_rgba(*rgba(C["rock_rim"], 0.32))
        ctx.fill()
        ctx.set_fill_rule(cairo.FILL_RULE_WINDING)
        ctx.restore()
        ctx.restore()


# =============================================================================
# 6. PARTICLES — dust puffs, pebbles, sweat, "HA HA" bubbles (closed-form motion)
# =============================================================================
class Particles:
    def __init__(self):
        self.items = []

    def burst(self, t, x, y, n, seed, kind, direction=(-180, 0), speed=(20, 80), life=(0.6, 1.0),
              size=(6, 14), gravity=0.0, drag=1.5, jitter=0.0, jitter_y=None, grow=1.2, spread=0.0, alpha=0.3):
        r = random.Random(seed)
        for _ in range(n):
            a = r.uniform(*direction) * DEG
            v = r.uniform(*speed)
            self.items.append(dict(
                kind=kind, t0=t + spread * r.random(), x0=x + (r.random() - 0.5) * jitter,
                y0=y + (r.random() - 0.5) * (jitter if jitter_y is None else jitter_y),
                vx=math.cos(a) * v, vy=math.sin(a) * v, g=gravity, k=drag, life=r.uniform(*life),
                size=r.uniform(*size), grow=grow, alpha=alpha, seed=r.random() * 100,
                shape=[r.uniform(0.65, 1.1) for _ in range(6)]))

    def swirl(self, t, cx, cy, n, seed, spin=1, life=(0.7, 1.1), radius=(24, 70), size=(8, 16), alpha=0.22):
        r = random.Random(seed)
        for _ in range(n):
            self.items.append(dict(kind="swirl", t0=t + r.random() * 0.08, cx=cx, cy=cy, r0=r.uniform(*radius),
                                   th=r.uniform(0, TAU), w=spin * r.uniform(5.0, 8.0), rise=r.uniform(25, 70),
                                   life=r.uniform(*life), size=r.uniform(*size), alpha=alpha))

    def bubble(self, t, x, y, seed, pop=None, life=1.3):
        r = random.Random(seed)
        self.items.append(dict(kind="bubble", t0=t, x0=x, y0=y, life=life, pop=pop,
                               rot=r.uniform(-7, 7) * DEG, seed=r.random() * 10))

    @staticmethod
    def _drag_pos(p, tau):
        k = p["k"]
        if k < 1e-4:
            return p["x0"] + p["vx"] * tau, p["y0"] + p["vy"] * tau + 0.5 * p["g"] * tau * tau
        e = (1 - math.exp(-k * tau)) / k
        return p["x0"] + p["vx"] * e, p["y0"] + (p["vy"] - p["g"] / k) * e + (p["g"] / k) * tau

    @staticmethod
    def _pebble_pos(p, tau):
        """Ballistic fall, one small bounce, then rest on the ground."""
        g, vy, y0, floor = p["g"], p["vy"], p["y0"], GROUND - p["size"] * 0.5
        disc = vy * vy - 2 * g * (y0 - floor)
        t1 = (-vy + math.sqrt(max(disc, 0))) / g
        if tau <= t1:
            return p["x0"] + p["vx"] * tau, y0 + vy * tau + 0.5 * g * tau * tau, False
        x1 = p["x0"] + p["vx"] * t1
        vb = -0.32 * (vy + g * t1)
        t2 = -2 * vb / g
        d = tau - t1
        if d <= t2:
            return x1 + p["vx"] * 0.45 * d, floor + vb * d + 0.5 * g * d * d, False
        return x1 + p["vx"] * 0.45 * t2, floor, True

    def draw(self, ctx, t, kinds=None):
        C = CONFIG["colors"]
        for p in self.items:
            if kinds and p["kind"] not in kinds:
                continue
            tau = t - p["t0"]
            if tau < 0 or tau > p["life"] + (0.2 if p["kind"] == "bubble" else 0):
                continue
            age = tau / p["life"]
            if p["kind"] == "dust":
                x, y = self._drag_pos(p, tau)
                rad = p["size"] * (1 + p["grow"] * age)
                a = p["alpha"] * (1 - age) * min(1, tau / 0.06)
                grad = cairo.RadialGradient(x, y, 0, x, y, rad)
                grad.add_color_stop_rgba(0, *rgba(C["dust"], a))
                grad.add_color_stop_rgba(1, *rgba(C["dust"], 0))
                ctx.set_source(grad)
                ctx.arc(x, y, rad, 0, TAU)
                ctx.fill()
            elif p["kind"] == "swirl":
                ang = p["th"] + p["w"] * tau
                rad = p["r0"] * (1 + 0.7 * age)
                x = p["cx"] + math.cos(ang) * rad
                y = p["cy"] - p["rise"] * tau + math.sin(ang) * rad * 0.22
                size = p["size"] * (1 + 0.8 * age)
                a = p["alpha"] * (1 - age) * min(1, tau / 0.1)
                grad = cairo.RadialGradient(x, y, 0, x, y, size)
                grad.add_color_stop_rgba(0, *rgba(C["dust"], a))
                grad.add_color_stop_rgba(1, *rgba(C["dust"], 0))
                ctx.set_source(grad)
                ctx.arc(x, y, size, 0, TAU)
                ctx.fill()
            elif p["kind"] == "pebble":
                x, y, rest = self._pebble_pos(p, tau)
                fade = 1 - smooth(0.75, 1.0, age)
                ctx.save()
                ctx.translate(x, y)
                ctx.rotate(p["seed"] + (0 if rest else tau * 9))
                s = p["size"]
                ctx.move_to(s * p["shape"][0], 0)
                for j in range(1, 6):
                    a = j / 6 * TAU
                    ctx.line_to(math.cos(a) * s * p["shape"][j], math.sin(a) * s * p["shape"][j] * 0.8)
                ctx.close_path()
                ctx.set_source_rgba(*rgba(C["pebble"], fade))
                ctx.fill_preserve()
                ctx.set_source_rgba(*rgba(C["rock_rim"], 0.35 * fade))
                ctx.set_line_width(1.2)
                ctx.stroke()
                ctx.restore()
            elif p["kind"] == "sweat":
                x, y = self._drag_pos(p, tau)
                vx, vy = p["vx"], p["vy"] + p["g"] * tau
                draw_drop(ctx, x, y, p["size"], 1 - smooth(0.7, 1.0, age), math.atan2(vy, vx) + math.pi / 2)
            elif p["kind"] == "bubble":
                self._draw_bubble(ctx, p, t, tau)

    @staticmethod
    def _draw_bubble(ctx, p, t, tau):
        T, C = CONFIG["text"], CONFIG["colors"]
        if p["pop"] is not None and t >= p["pop"]:                 # pop: swell and vanish
            k = (t - p["pop"]) / 0.13
            if k >= 1:
                return
            scale, alpha = 1 + 0.4 * k, 1 - k
        else:
            scale = EASE["out_back"](clamp(tau / 0.16))
            alpha = 1 - smooth(p["life"] - 0.18, p["life"], tau)
        if alpha <= 0.01 or scale <= 0.01:
            return
        x = p["x0"] + math.sin(tau * 5 + p["seed"]) * 3
        y = p["y0"] - 26 * EASE["out_quad"](clamp(tau / p["life"]))
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(p["rot"] + math.sin(tau * 9 + p["seed"]) * 0.05)
        ctx.scale(scale, scale)
        set_font(ctx, CONFIG["fonts"]["bubble"], T["bubble_size"])
        ext = ctx.text_extents(T["laugh"])
        bw, bh, r = ext.x_advance + 26, T["bubble_size"] + 20, 17
        ctx.new_path()
        rounded_rect(ctx, -bw / 2, -bh / 2, bw, bh, r)
        ctx.move_to(-8, bh / 2 - 1)                                # little tail toward the laugher
        ctx.line_to(-2, bh / 2 + 11)
        ctx.line_to(6, bh / 2 - 1)
        ctx.close_path()
        ctx.set_source_rgba(*rgba(C["bubble"], alpha))
        ctx.fill()
        ctx.set_source_rgba(*rgba(C["bubble_text"], alpha))
        ctx.move_to(-ext.x_advance / 2 - ext.x_bearing * 0, ext.height / 2 - 1)
        ctx.show_text(T["laugh"])
        ctx.restore()


def rounded_rect(ctx, x, y, w, h, r):
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def set_font(ctx, family, size):
    ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)


# =============================================================================
# 7. SCENE — dusk field background (pre-rendered once), header, labels
# =============================================================================
def draw_flame(ctx, x, y, h, t):
    """Small drawn flame icon; (x, y) = bottom centre."""
    C = CONFIG["colors"]
    sway = math.sin(t * 7.0) * 0.06
    for scale, col in ((1.0, C["flame_outer"]), (0.74, C["flame_mid"]), (0.46, C["flame_inner"])):
        hh, ww = h * scale, h * 0.62 * scale
        tipx = x + ww * sway * 2
        base = y - h * (1 - scale) * 0.08
        ctx.move_to(x, base)
        ctx.curve_to(x - ww * 0.62, base, x - ww * 0.62, base - hh * 0.45, x - ww * 0.32, base - hh * 0.68)
        ctx.curve_to(x - ww * 0.24, base - hh * 0.5, x - ww * 0.1, base - hh * 0.52, x - ww * 0.06, base - hh * 0.62)
        ctx.curve_to(x - ww * 0.12, base - hh * 0.86, tipx, base - hh * 0.92, tipx + ww * 0.02, base - hh)
        ctx.curve_to(x + ww * 0.42, base - hh * 0.72, x + ww * 0.62, base - hh * 0.4, x + ww * 0.5, base - hh * 0.18)
        ctx.curve_to(x + ww * 0.42, base, x + ww * 0.18, base, x, base)
        ctx.close_path()
        g = cairo.LinearGradient(x, base - hh, x, base)
        r_, g_, b_ = hex_rgb(col)
        g.add_color_stop_rgb(0, min(1, r_ * 1.05), g_ * 0.85, b_ * 0.8)
        g.add_color_stop_rgb(1, r_, min(1, g_ * 1.1), min(1, b_ * 1.2))
        ctx.set_source(g)
        ctx.fill()


def header_layout(ctx):
    T, S = CONFIG["text"], CONFIG["safe"]
    set_font(ctx, CONFIG["fonts"]["header"], T["header_size"])
    ext = ctx.text_extents(T["header"])
    flame_h, gap = T["header_size"] * 0.86, 22
    total = flame_h * 0.62 + gap + ext.x_advance
    x0 = W / 2 - total / 2
    base = S["top"] + 62 + T["header_size"] * 0.72
    return dict(text_x=x0 + flame_h * 0.62 + gap, base=base, flame_x=x0 + flame_h * 0.31, flame_h=flame_h, ext=ext)


def tree(ctx, r, x, y, ang, length, width, depth):
    x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
    ctx.set_line_width(width)
    ctx.move_to(x, y)
    ctx.line_to(x2, y2)
    ctx.stroke()
    if depth <= 0 or length < 6:
        return
    for _ in range(2 if depth > 1 else r.choice([1, 2])):
        tree(ctx, r, x2, y2, ang + r.uniform(-0.75, 0.75), length * r.uniform(0.58, 0.78), width * 0.66, depth - 1)


def render_background():
    C, T = CONFIG["colors"], CONFIG["text"]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    r = random.Random(4)
    sky = cairo.LinearGradient(0, 0, 0, HORIZON)
    for off, col in C["sky"]:
        sky.add_color_stop_rgb(off, *hex_rgb(col))
    ctx.set_source(sky)
    ctx.paint()
    for _ in range(70):                                            # a few faint stars up high
        sx, sy = r.uniform(0, W), r.uniform(0, 640)
        ctx.set_source_rgba(1, 0.92, 0.86, r.uniform(0.15, 0.45) * (1 - sy / 700))
        ctx.arc(sx, sy, r.uniform(0.7, 1.6), 0, TAU)
        ctx.fill()
    sx, sy, sr = L["sun_x"], HORIZON + 8, L["sun_r"]
    glow = cairo.RadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 2.6)  # wide dim glow
    glow.add_color_stop_rgba(0, *rgba(C["sun_glow"], 0.42))
    glow.add_color_stop_rgba(1, *rgba(C["sun_glow"], 0))
    ctx.set_source(glow)
    ctx.paint()
    disc = cairo.RadialGradient(sx, sy - sr * 0.3, 0, sx, sy, sr)
    disc.add_color_stop_rgb(0, *hex_rgb(C["sun"]))
    disc.add_color_stop_rgb(1, *hex_rgb(C["sun_edge"]))
    ctx.arc(sx, sy, sr, 0, TAU)
    ctx.set_source(disc)
    ctx.fill()
    haze = cairo.LinearGradient(0, HORIZON - 140, 0, HORIZON)      # dusty haze on the horizon
    haze.add_color_stop_rgba(0, 0.85, 0.42, 0.2, 0)
    haze.add_color_stop_rgba(1, 0.85, 0.42, 0.2, 0.32)
    ctx.rectangle(0, HORIZON - 140, W, 140)
    ctx.set_source(haze)
    ctx.fill()
    # distant electric poles receding to the right, with sagging wires
    ctx.set_source_rgba(*rgba(C["far"], 0.95))
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    poles = [(30, 158), (232, 132), (410, 110), (560, 93), (690, 79), (800, 67), (895, 58), (975, 50), (1045, 44)]
    tops = []
    for x, h in poles:
        ctx.set_line_width(max(2.2, h * 0.04))
        ctx.move_to(x, HORIZON + 2)
        ctx.line_to(x, HORIZON - h)
        ctx.stroke()
        arm = h * 0.3
        ctx.set_line_width(max(1.6, h * 0.025))
        ctx.move_to(x - arm, HORIZON - h * 0.9)
        ctx.line_to(x + arm, HORIZON - h * 0.9)
        ctx.stroke()
        for dx in (-arm * 0.85, 0, arm * 0.85):
            ctx.arc(x + dx, HORIZON - h * 0.9 - 2.5, max(1.5, h * 0.018), 0, TAU)
            ctx.fill()
        tops.append((x, HORIZON - h * 0.9 - 3, arm * 0.85))
    ctx.set_line_width(1.1)
    for (x1, y1, a1), (x2, y2, a2) in zip(tops, tops[1:]):
        for k in (-1, 0, 1):
            px1, px2 = x1 + k * a1, x2 + k * a2
            sag = (px2 - px1) * 0.07
            ctx.move_to(px1, y1)
            ctx.curve_to(px1 + (px2 - px1) * 0.33, y1 + sag, px1 + (px2 - px1) * 0.66, y2 + sag, px2, y2)
            ctx.stroke()
    for (x, h, seed) in ((70, 205, 3), (868, 150, 8), (1012, 96, 5)):   # dead trees
        rr = random.Random(seed)
        ctx.set_source_rgba(*rgba(C["far"], 1))
        tree(ctx, rr, x, HORIZON + 2, -math.pi / 2 + rr.uniform(-0.08, 0.08), h * 0.42, h * 0.07, 5)
    # ground
    gnd = cairo.LinearGradient(0, HORIZON, 0, H)
    gnd.add_color_stop_rgb(0, *hex_rgb(C["ground_top"]))
    gnd.add_color_stop_rgb(1, *hex_rgb(C["ground_bottom"]))
    ctx.rectangle(0, HORIZON, W, H - HORIZON)
    ctx.set_source(gnd)
    ctx.fill()
    ctx.save()                                                     # warm sheen of the sun on the dust
    ctx.translate(sx, HORIZON)
    ctx.scale(1, 0.2)
    sheen = cairo.RadialGradient(0, 0, 0, 0, 0, 620)
    sheen.add_color_stop_rgba(0, 0.78, 0.32, 0.14, 0.28)
    sheen.add_color_stop_rgba(1, 0.78, 0.32, 0.14, 0)
    ctx.set_source(sheen)
    ctx.arc(0, 0, 620, 0, TAU)
    ctx.fill()
    ctx.restore()
    for _ in range(2600):                                          # dirt texture, larger toward the camera
        y = HORIZON + (H - HORIZON) * r.random() ** 1.4
        depth = (y - HORIZON) / (H - HORIZON)
        x = r.uniform(0, W)
        light = r.random() < 0.45
        ctx.set_source_rgba(0.27, 0.18, 0.13, r.uniform(0.06, 0.18)) if light else ctx.set_source_rgba(0.03, 0.02, 0.015, r.uniform(0.2, 0.45))
        ctx.arc(x, y, (0.5 + r.random() * 1.6) * (0.4 + depth * 1.6), 0, TAU)
        ctx.fill()
    ctx.set_line_width(1.2)
    for _ in range(260):                                           # faint furrows
        y = HORIZON + (H - HORIZON) * r.random() ** 1.3
        depth = (y - HORIZON) / (H - HORIZON)
        x, ln = r.uniform(-40, W), r.uniform(20, 90) * (0.4 + depth)
        ctx.set_source_rgba(0.24, 0.16, 0.11, r.uniform(0.08, 0.2))
        ctx.move_to(x, y)
        ctx.line_to(x + ln, y + r.uniform(-1.5, 1.5))
        ctx.stroke()
    for _ in range(170):                                           # small pebbles
        y = HORIZON + 6 + (H - HORIZON - 6) * r.random() ** 1.2
        depth = (y - HORIZON) / (H - HORIZON)
        x, rad = r.uniform(0, W), r.uniform(1.6, 5.5) * (0.45 + depth * 1.4)
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(1, 0.62)
        ctx.arc(0, 0, rad, 0, TAU)
        ctx.set_source_rgba(0.17, 0.15, 0.14, 0.95)
        ctx.fill()
        ctx.arc(-rad * 0.15 * (1 if x > sx else -1), -rad * 0.35, rad * 0.55, 0, TAU)
        ctx.set_source_rgba(0.55, 0.28, 0.16, 0.16)
        ctx.fill()
        ctx.restore()
    # header text (the flame is drawn per frame)
    hl = header_layout(ctx)
    set_font(ctx, CONFIG["fonts"]["header"], T["header_size"])
    ctx.move_to(hl["text_x"] + 3, hl["base"] + 5)
    ctx.set_source_rgba(0, 0, 0, 0.4)
    ctx.show_text(T["header"])
    ctx.move_to(hl["text_x"], hl["base"])
    ctx.set_source_rgba(*rgba(C["text"]))
    ctx.show_text(T["header"])
    # faint watermark inside the bottom safe zone (letter-spaced)
    set_font(ctx, CONFIG["fonts"]["watermark"], T["watermark_size"])
    spacing = 6
    widths = [ctx.text_extents(ch).x_advance for ch in T["watermark"]]
    x = W / 2 - (sum(widths) + spacing * (len(widths) - 1)) / 2
    y = H - CONFIG["safe"]["bottom"] - 34
    ctx.set_source_rgba(1, 1, 1, 0.32)
    for ch, w in zip(T["watermark"], widths):
        ctx.move_to(x, y)
        ctx.show_text(ch)
        x += w + spacing
    surf.flush()
    return surf


def draw_label(ctx, text, x, y, alpha=1.0):
    """Clean white bold label centred at x with its baseline at y, soft shadow for legibility."""
    if alpha <= 0.01:
        return
    T = CONFIG["text"]
    set_font(ctx, CONFIG["fonts"]["label"], T["label_size"])
    ext = ctx.text_extents(text)
    S = CONFIG["safe"]
    x0 = clamp(x - ext.x_advance / 2, S["side"], W - S["side"] - ext.x_advance)
    for dx, dy, a in ((0, 3, 0.35), (0, 1.5, 0.35)):
        ctx.move_to(x0 + dx, y + dy)
        ctx.set_source_rgba(0, 0, 0, a * alpha)
        ctx.show_text(text)
    ctx.move_to(x0, y)
    ctx.set_source_rgba(*rgba(CONFIG["colors"]["text"], alpha))
    ctx.show_text(text)


def ground_shadow(ctx, x, rx, alpha, y=GROUND):
    if alpha <= 0.01:
        return
    ctx.save()
    ctx.translate(x, y - 2)
    ctx.scale(1, 0.16)
    g = cairo.RadialGradient(0, 0, 0, 0, 0, rx)
    g.add_color_stop_rgba(0, 0, 0, 0, 0.5 * alpha)
    g.add_color_stop_rgba(1, 0, 0, 0, 0)
    ctx.set_source(g)
    ctx.arc(0, 0, rx, 0, TAU)
    ctx.fill()
    ctx.restore()


# =============================================================================
# 8. CHOREOGRAPHY — the story, built from CONFIG beats
# =============================================================================
ROCK = Boulder(CONFIG["rock"]["w"], CONFIG["rock"]["h"], CONFIG["rock"]["seed"])
RW, RH = ROCK.w, ROCK.h
FX = Particles()
MAN = Stickman("figure")


def walk_keys(t0, t1, step, names=("WALK_A", "PASS_A", "WALK_B", "PASS_B")):
    keys, t, i = [], t0 + step, 0
    while t < t1 - 1e-6:
        keys.append((t, names[i % 4]))
        t, i = t + step, i + 1
    return keys


def steps_back(t, beats, pose_a="SCARED_A", pose_b="SCARED_B", rest="SCARED"):
    s0, s1, s2, s3 = beats
    return [(s0, rest), (lerp(s0, s1, 0.5), pose_a), (s1, rest), (lerp(s2, s3, 0.5), pose_b), (s3, rest)]


SB = B["crowd_steps"]
POSES["AWAY_A"] = dict(POSES["WALK_A"], handF=[-150, 0.62], handB=[18, 0.97])
POSES["AWAY_P"] = dict(POSES["PASS_A"], handF=[-120, 0.62], handB=[4, 0.98])
POSES["AWAY_B"] = dict(POSES["WALK_B"], handF=[-150, 0.62], handB=[-16, 0.97])
POSES["AWAY_Q"] = dict(POSES["PASS_B"], handF=[-120, 0.62], handB=[0, 0.98])

# --- the crowd: Family, Friends, Society, Relatives (left to right) -------------------------
cx0 = L["crowd_x"]
back = L["crowd_back"]
CROWD = [
    dict(  # Family: bends over slapping his knees
        x=Track([(0, cx0[0]), (SB[0], cx0[0]), (SB[1], cx0[0] - back[0] / 2), (SB[2], cx0[0] - back[0] / 2), (SB[3], cx0[0] - back[0])]),
        f=[(0, 1)],
        pose=Track([(0, "ARMS_CROSSED"), (2.42, "ARMS_CROSSED"), (2.62, "LAUGH_BACK", "out_back"), (4.6, "LAUGH_BACK"),
                    (4.78, "HOWL"), (6.0, "HOWL"), (7.0, "CHUCKLE"), (8.22, "CHUCKLE"), (8.42, "LAUGH_BACK"),
                    (9.55, "LAUGH_BACK"), (9.68, "SHOCKED", "out_cubic")] + steps_back(0, SB), resolve=pose_of),
        face=Track([(0, "smug"), (2.5, "smug"), (2.58, "laugh"), (6.9, "laugh"), (7.1, "mock"), (8.32, "mock"), (8.4, "laugh"),
                    (9.55, "laugh"), (9.61, "shocked", "out_back"), (10.7, "shocked"), (10.85, "scared")], resolve=face_of),
        laugh=Track([(0, 0), (2.45, 0), (2.65, 0.85), (4.6, 0.85), (4.75, 1.25), (6.0, 1.25), (7.3, 0.15), (7.8, 0),
                     (8.25, 0), (8.45, 0.45), (9.55, 0.45), (9.62, 0)]),
        shock=B["shock"][0], slap=True),
    dict(  # Friends: points and mocks, turns his back and walks off, turns back in shock
        x=Track([(0, cx0[1]), (B["friend_walk"][0], cx0[1]), (B["friend_walk"][1], cx0[1] - L["friend_walk"], "linear"),
                 (SB[0], cx0[1] - L["friend_walk"]), (SB[1], cx0[1] - L["friend_walk"] - back[1] / 2),
                 (SB[2], cx0[1] - L["friend_walk"] - back[1] / 2), (SB[3], cx0[1] - L["friend_walk"] - back[1])]),
        f=[(0, 1), (B["friend_turn"], -1), (B["friend_turn_back"], 1)],
        depth=Track([(0, CONFIG["crowd_depth"]), (B["friend_walk"][0], CONFIG["crowd_depth"]),
                     (B["friend_walk"][1], [0.84, 26.0], "linear"), (SB[0], [0.84, 26.0]), (SB[3], [0.8, 32.0])]),
        pose=Track([(0, "ARMS_CROSSED"), (2.5, "ARMS_CROSSED"), (2.7, "LAUGH_BEND", "out_back"), (4.6, "LAUGH_BEND"),
                    (4.76, "SLAP_KNEE"), (B["friend_turn"], "SLAP_KNEE"), (B["friend_walk"][0], "WAVE_OFF")]
                   + walk_keys(B["friend_walk"][0], B["friend_walk"][1], 0.2, ("AWAY_A", "AWAY_P", "AWAY_B", "AWAY_Q"))
                   + [(B["friend_walk"][1], "WAVE_OFF"), (B["friend_walk"][1] + 0.35, "ARMS_CROSSED"),
                      (B["friend_turn_back"], "ARMS_CROSSED"), (B["friend_turn_back"] + 0.14, "SHOCKED", "out_cubic")]
                   + steps_back(0, SB), resolve=pose_of),
        face=Track([(0, "smug"), (2.6, "smug"), (2.68, "mock"), (3.4, "mock"), (3.48, "laugh"), (B["friend_turn"], "laugh"),
                    (B["friend_turn"] + 0.08, "mock"), (B["friend_turn_back"], "mock"), (B["friend_turn_back"] + 0.06, "shocked", "out_back"),
                    (10.7, "shocked"), (10.85, "scared")], resolve=face_of),
        laugh=Track([(0, 0), (2.55, 0), (2.75, 0.85), (4.6, 0.85), (4.75, 1.2), (B["friend_turn"], 1.2), (5.05, 0.3), (5.8, 0)]),
        shock=B["friend_turn"] + 0.02, slap=False),
    dict(  # Society: laughs, leans in to hear the whisper, laughs harder
        x=Track([(0, cx0[2]), (SB[0], cx0[2]), (SB[1], cx0[2] - back[2] / 2), (SB[2], cx0[2] - back[2] / 2), (SB[3], cx0[2] - back[2])]),
        f=[(0, 1)],
        pose=Track([(0, "ARMS_CROSSED"), (2.5, "ARMS_CROSSED"), (2.72, "LAUGH_BEND", "out_back"), (B["whisper"][0], "LAUGH_BEND"),
                    (B["whisper"][0] + 0.2, "LISTEN"), (B["whisper"][1] - 0.05, "LISTEN"), (B["whisper"][1] + 0.15, "LAUGH_BEND", "out_back"),
                    (6.0, "LAUGH_BEND"), (7.0, "CHUCKLE"), (8.25, "CHUCKLE"), (8.45, "LAUGH_BEND"), (9.25, "LAUGH_BEND"),
                    (9.38, "SHOCKED", "out_cubic")] + steps_back(0, SB), resolve=pose_of),
        face=Track([(0, "smug"), (2.62, "smug"), (2.7, "laugh"), (B["whisper"][0] + 0.1, "laugh"), (B["whisper"][0] + 0.2, "mock"),
                    (B["whisper"][1], "mock"), (B["whisper"][1] + 0.08, "laugh"), (6.9, "laugh"), (7.1, "smug"), (8.35, "smug"),
                    (8.43, "laugh"), (9.25, "laugh"), (9.31, "shocked", "out_back"), (10.7, "shocked"), (10.85, "scared")], resolve=face_of),
        laugh=Track([(0, 0), (2.6, 0), (2.8, 0.85), (B["whisper"][0], 0.85), (B["whisper"][0] + 0.15, 0.08), (B["whisper"][1], 0.08),
                     (B["whisper"][1] + 0.15, 1.3), (6.0, 1.3), (7.3, 0.15), (7.8, 0), (8.28, 0), (8.48, 0.45), (9.25, 0.45), (9.32, 0)]),
        shock=B["shock"][2], slap=False),
    dict(  # Relatives: laughs, whispers in Society's ear, slaps his knee, trips and falls
        x=Track([(0, cx0[3]), (B["whisper"][0], cx0[3]), (B["whisper"][0] + 0.2, cx0[3] - 34), (B["whisper"][1], cx0[3] - 34),
                 (B["whisper"][1] + 0.2, cx0[3] - 12), (SB[0], cx0[3] - 12), (SB[1], cx0[3] - 12 - back[3] / 2),
                 (SB[2], cx0[3] - 12 - back[3] / 2), (B["trip"], cx0[3] - 12 - back[3] * 0.8), (B["trip"] + 0.38, cx0[3] - 12 - back[3] - 34)]),
        f=[(0, 1), (B["whisper"][0] + 0.05, -1), (B["whisper"][1], 1)],
        pose=Track([(0, "ARMS_CROSSED"), (2.4, "ARMS_CROSSED"), (2.62, "POINT_LAUGH", "out_back"), (B["whisper"][0], "POINT_LAUGH"),
                    (B["whisper"][0] + 0.2, "WHISPER"), (B["whisper"][1] - 0.05, "WHISPER"), (B["whisper"][1] + 0.15, "SLAP_KNEE", "out_back"),
                    (6.0, "SLAP_KNEE"), (7.0, "CHUCKLE"), (8.25, "CHUCKLE"), (8.45, "SLAP_KNEE"), (9.0, "SLAP_KNEE"),
                    (9.13, "SHOCKED", "out_cubic"), (SB[0], "SCARED"), (lerp(SB[0], SB[1], 0.5), "SCARED_A"), (SB[1], "SCARED"),
                    (B["trip"] - 0.08, "SCARED_B"), (B["trip"] + 0.12, "TRIP", "out_quad"), (B["trip"] + 0.38, "FALLEN", "in_quad")],
                   resolve=pose_of),
        face=Track([(0, "smug"), (2.52, "smug"), (2.6, "laugh"), (B["whisper"][0], "laugh"), (B["whisper"][0] + 0.1, "mock"),
                    (B["whisper"][1], "mock"), (B["whisper"][1] + 0.08, "laugh"), (6.9, "laugh"), (7.1, "mock"), (8.35, "mock"),
                    (8.43, "laugh"), (9.0, "laugh"), (9.06, "shocked", "out_back"), (10.7, "shocked"), (10.85, "scared")], resolve=face_of),
        laugh=Track([(0, 0), (2.5, 0), (2.7, 0.85), (B["whisper"][0], 0.85), (B["whisper"][0] + 0.12, 0), (B["whisper"][1], 0),
                     (B["whisper"][1] + 0.15, 1.3), (6.0, 1.3), (7.3, 0.15), (7.8, 0), (8.28, 0), (8.48, 0.45), (9.0, 0.45), (9.07, 0)]),
        shock=B["shock"][3], slap=True, falls=True),
]
for i, m in enumerate(CROWD):
    m["name"], m["phase"] = CONFIG["text"]["crowd"][i], i * 1.7


def facing_at(keys, t):
    f = keys[0][1]
    for kt, v in keys:
        if t >= kt:
            f = v
    return f


def turn_squash(keys, t):
    """Quick horizontal squash whenever a character flips direction."""
    s = 1.0
    for kt, _ in keys[1:]:
        if kt <= t < kt + 0.12:
            s = min(s, lerp(0.72, 1.0, (t - kt) / 0.12))
    return s


def label_y(J):
    """Baseline of a name label: just above the head."""
    return J["head"][1] - J["D"]["head_r"] - 22


def crowd_label_pos(m, t, row):
    """Label anchor: the standing head height (stable while laughing); follows the head only if he falls down."""
    base = crowd_state(m, t, with_laugh=False)
    J = MAN.solve(base["pose"], base["x"], base["y"], base["f"], scale=base["scale"])
    S = MAN.solve(pose_of("STAND"), base["x"], base["y"], base["f"], scale=base["scale"])
    k = smooth(60, 140, J["head"][1] - S["head"][1])
    return lerp(lerp(base["x"], J["head"][0], 0.35), J["head"][0], k), lerp(label_y(S) - row, label_y(J), k)


def crowd_state(m, t, with_laugh=True):
    pose = m["pose"].at(t)
    amp = m["laugh"].at(t) if with_laugh else 0.0
    f = facing_at(m["f"], t)
    sq = [turn_squash(m["f"], t), 1.0]
    if amp > 0.001:                                   # laugh shake: bob, rock and (for some) slap the knee
        w = TAU * (4.2 + 0.6 * amp) * t + m["phase"]
        pose = dict(pose, lean=pose["lean"] + 5 * amp * math.sin(w), head=pose["head"] + 9 * amp * math.sin(w + 0.8))
        if m["slap"]:
            pose["handF"] = [pose["handF"][0] + 16 * amp * math.sin(TAU * 2.4 * t + m["phase"]), pose["handF"][1]]
        sq = [sq[0] * (1 + 0.02 * amp * math.sin(w)), 1 - 0.035 * amp * (0.5 + 0.5 * math.sin(w))]
    if m.get("falls") and t >= B["trip"] + 0.36:      # landing bump when he hits the ground
        sq = [sq[0], 1 - 0.1 * bump(t, B["trip"] + 0.36, B["trip"] + 0.46)]
    scale, back = m["depth"].at(t) if "depth" in m else CONFIG["crowd_depth"]   # further away = smaller, higher
    return dict(x=m["x"].at(t), y=GROUND - back, f=f, pose=pose, face=m["face"].at(t), sq=tuple(sq), scale=scale)


# --- the hero: "You" ---------------------------------------------------------------------------
HL = L
hero_x = Track([(0, HL["hero_start"]), (B["walk_end"], HL["hero_stop"], "linear"), (B["fail"], HL["hero_stop"]),
                (B["knee_down"], HL["hero_kneel"], "out_quad"), (B["stand"], HL["hero_kneel"]),
                (B["regrip"] - 0.02, HL["hero_stop"], "in_out_sine"), (B["lift"][0], HL["hero_stop"]),
                (B["lift"][2], HL["hero_chest"]), (B["lift"][3], HL["hero_press"]), (B["hero_step"][0], HL["hero_press"]),
                (B["hero_step"][1], HL["hero_step"])])
hero_pose = Track(
    [(0, "WALK_A")] + walk_keys(0, B["walk_end"], 0.15) +
    [(B["walk_end"] + 0.08, "STAND", "out_quad"), (B["look"], "STAND"), (B["look"] + 0.18, "LOOK_UP"), (B["roll"], "LOOK_UP"),
     (B["roll"] + 0.08, "ROLL_A"), (B["roll"] + 0.16, "ROLL_B"), (B["roll"] + 0.24, "ROLL_A"), (B["grab"], "STAND"),
     (B["strain"] - 0.04, "GRIP"), (B["strain"] + 0.16, "STRAIN"), (B["fail"], "STRAIN"), (B["knee_down"], "KNEEL", "in_quad"),
     (B["stand"], "KNEEL"), (B["regrip"] - 0.02, "STAND_ANGRY", "in_out_cubic"), (B["lift"][0] - 0.04, "SQUAT_GRIP"),
     (B["lift"][1], "SQUAT_GRIP"), (B["lift"][2], "LIFT_CHEST"), (B["lift"][3], "PRESS", "in_out_cubic"),
     (B["hero_step"][0], "PRESS"), (lerp(*B["hero_step"], 0.5), "CARRY_A"), (B["hero_step"][1], "CARRY_B"),
     (B["hero_step"][1] + 0.12, "PRESS"), (B["slam"][0], "PRESS"), (B["slam"][1] - 0.03, "SLAM", "in_quad"),
     (B["stand_tall"], "SLAM"), (B["stand_tall"] + 0.24, "STAND_TALL", "out_cubic")], resolve=pose_of)
hero_face = Track([(0, "neutral"), (B["look"], "neutral"), (B["look"] + 0.1, "curious"), (B["roll"] + 0.05, "curious"),
                   (B["roll"] + 0.15, "neutral"), (B["strain"], "neutral"), (B["strain"] + 0.1, "strain"), (B["fail"], "strain"),
                   (B["fail"] + 0.12, "down"), (B["eyes_snap"] - 0.01, "down"), (B["eyes_snap"] + 0.05, "angry", "out_cubic"),
                   (B["stand_tall"], "angry"), (B["stand_tall"] + 0.24, "calm")], resolve=face_of)
hero_sweat = Track([(0, 0), (2.3, 0), (2.5, 1), (B["fail"] + 0.1, 1), (B["fail"] + 0.4, 0), (9.2, 0), (9.4, 0.8), (10.6, 0.8), (10.8, 0)])
HERO_SQ = [(B["walk_end"] + 0.05, 0.04, 0.1), (B["knee_down"], 0.1, 0.1), (B["regrip"] - 0.05, -0.05, 0.12),
           (B["lift"][1], 0.05, 0.1), (B["lift"][2], -0.04, 0.12), (B["lift"][3], -0.05, 0.12),
           (B["hero_step"][1], 0.05, 0.08), (B["slam"][1], 0.12, 0.1), (B["stand_tall"] + 0.22, -0.035, 0.12)]
HERO_SQ += [(k[0], 0.03, 0.06) for k in walk_keys(0, B["walk_end"], 0.15) if k[1].startswith("WALK")]


def squash_at(events, t):
    s = 0.0
    for t0, a, decay in events:
        d = t - t0
        if -0.03 <= d <= 0.6:
            s += a * (1 + d / 0.03 if d < 0 else math.exp(-d / decay))
    return 1 + 0.7 * s, 1 - s


rock_track = Track([(0, [L["rock_x"], GROUND, 0]), (B["fail"], [L["rock_x"], GROUND - 6, 0.6]),
                    (B["rock_thud"], [L["rock_x"], GROUND, 0], "in_quad"), (B["lift"][0], [L["rock_x"], GROUND, 0]),
                    (B["lift"][1], [L["rock_x"] + 8, GROUND - 56, -2.5]), (B["lift"][2], [L["rock_x"] + 17, GROUND - 160, -3.5]),
                    (B["lift"][3], [HL["hero_press"] + 7, GROUND - 336, 0], "in_out_cubic"),
                    (B["hero_step"][0], [HL["hero_press"] + 7, GROUND - 336, 0]),
                    (B["hero_step"][1], [HL["hero_step"] + 7, GROUND - 336, 0]), (B["slam"][0], [HL["hero_step"] + 7, GROUND - 336, 0]),
                    (B["slam"][1], [L["rock_slam_x"], GROUND, -6], "in_quad"), (B["slam"][1] + 0.09, [L["rock_slam_x"], GROUND - 11, 1.5], "out_quad"),
                    (B["slam"][1] + 0.17, [L["rock_slam_x"], GROUND, 0], "in_quad")])
grip_w = Track([(0, 0), (B["grab"] + 0.05, 0), (B["strain"] - 0.01, 1), (B["fail"], 1), (B["fail"] + 0.1, 0),
                (B["regrip"] + 0.02, 0), (B["lift"][0] - 0.04, 1), (B["slam"][1] - 0.07, 1), (B["slam"][1] - 0.03, 0)])
grip_pts = Track([(0, [RW / 2 - 6, -RH * 0.5, RW / 2 - 10, -RH * 0.4]), (B["fail"], [RW / 2 - 6, -RH * 0.5, RW / 2 - 10, -RH * 0.4]),
                  (B["regrip"], [RW / 2 - 12, -RH * 0.36, RW / 2 - 20, -RH * 0.28]), (B["lift"][1], [RW / 2 - 12, -RH * 0.36, RW / 2 - 20, -RH * 0.28]),
                  (B["lift"][2], [RW / 2 - 34, -4, RW / 2 - 52, -4]), (B["lift"][3], [-20, -2, 20, -2], "in_out_cubic")])


def rock_at(t):
    cx, by, rot = rock_track.at(t)
    env = smooth(B["strain"] + 0.1, B["strain"] + 0.4, t) * (1 - smooth(B["fail"] - 0.15, B["fail"], t))
    if env > 0:                                       # barely moves: tiny lift and wobble
        by -= (3 + 3 * math.sin(TAU * 1.7 * t)) * env
        rot += 0.7 * math.sin(TAU * 9 * t) * env
        cx += 1.0 * math.sin(TAU * 13 * t) * env
    if B["lift"][3] <= t < B["slam"][0]:
        by += 2.5 * math.sin(TAU * 1.3 * (t - B["lift"][3]))
    return cx, by, rot * DEG


def hero_state(t, base=False):
    pose = hero_pose.at(t)
    x = hero_x.at(t)
    sq = list(squash_at(HERO_SQ, t))
    strain = smooth(B["strain"] + 0.1, B["strain"] + 0.3, t) * (1 - smooth(B["fail"] - 0.05, B["fail"], t))
    if strain > 0 and not base:                       # legs shake, whole body trembles
        pose = dict(pose, legF=[pose["legF"][0] + 3 * strain * math.sin(TAU * 17 * t), pose["legF"][1] + 4 * strain * math.sin(TAU * 19 * t + 1)],
                    legB=[pose["legB"][0] + 3 * strain * math.sin(TAU * 18 * t + 2), pose["legB"][1] + 4 * strain * math.sin(TAU * 16 * t)])
        x += 1.3 * strain * math.sin(TAU * 23 * t)
        sq = [sq[0], sq[1] * (1 - 0.03 * strain)]
    breath = smooth(B["knee_down"] + 0.3, B["knee_down"] + 0.6, t) * (1 - smooth(B["stand"] - 0.2, B["stand"], t))
    if breath > 0 and not base:
        pose = dict(pose, lean=pose["lean"] + 1.2 * breath * math.sin(TAU * 0.6 * t))
    cx, by, rot = rock_at(t)
    gw = grip_w.at(t)
    fix = None
    if gw > 0.001:
        p = grip_pts.at(t)
        fF, fB = ROCK.grip((p[0], p[1]), cx, by, rot), ROCK.grip((p[2], p[3]), cx, by, rot)
        fix = {"F": (fF[0], fF[1], gw), "B": (fB[0], fB[1], gw)}
    return dict(x=x, y=GROUND, f=-1, pose=pose, face=hero_face.at(t), sq=tuple(sq), fix=fix, sweat=hero_sweat.at(t))


# --- particle cues -------------------------------------------------------------------------------
def dust(t, x, y, n, seed, **kw):
    args = dict(direction=(-180, 0), speed=(30, 140), life=(0.6, 1.1), size=(8, 18), gravity=-25, drag=3.0, jitter=20,
                jitter_y=6, grow=1.4, alpha=0.26)
    args.update(kw)
    FX.burst(t, x, y, n, seed, "dust", **args)


for k in walk_keys(0, B["walk_end"], 0.15):                       # hero footsteps on the walk-in
    if k[1].startswith("WALK"):
        dust(k[0], hero_x.at(k[0]) - 14, GROUND - 4, 3, int(k[0] * 100), size=(5, 10), alpha=0.18, speed=(15, 60))
for tt in (2.35, 2.95, 3.6, 4.2):                                 # the rock grinds as he strains
    dust(tt, L["rock_x"] + RW * 0.35, GROUND - 4, 4, int(tt * 77), size=(6, 12), alpha=0.2)
dust(B["rock_thud"], L["rock_x"], GROUND - 6, 16, 465, jitter=RW * 0.9, speed=(60, 220), size=(12, 26), alpha=0.3)
dust(B["knee_down"], HL["hero_kneel"] + 10, GROUND - 6, 6, 478, size=(8, 15))
dust(B["lift"][0] + 0.05, L["rock_x"], GROUND - 6, 12, 865, jitter=RW * 0.8, speed=(50, 180), size=(10, 22), alpha=0.28)
for i, tt in enumerate(walk_keys(B["friend_walk"][0], B["friend_walk"][1], 0.2)):
    if tt[1] == "WALK_A" or tt[1] == "WALK_B":
        dust(tt[0], CROWD[1]["x"].at(tt[0]), GROUND - 4, 2, 600 + i, size=(4, 8), alpha=0.15)
for i, m in enumerate(CROWD):                                     # scared steps back
    for j, s in enumerate((SB[1], SB[3] if i != 3 else B["trip"] + 0.36)):
        dust(s, m["x"].at(s), GROUND - 4, 3 if j == 0 or i != 3 else 10, 700 + i * 10 + j, size=(5, 11) if i != 3 or j == 0 else (10, 20),
             alpha=0.2)
dust(B["hero_step"][1], HL["hero_step"] - 18, GROUND - 4, 7, 1120, size=(8, 16))
dust(B["slam"][1], L["rock_slam_x"], GROUND - 8, 34, 1215, jitter=RW * 0.95, direction=(-180, 0), speed=(160, 520),
     life=(0.28, 0.42), size=(14, 32), grow=1.8, drag=4.0, alpha=0.42)
dust(B["slam"][1], L["rock_slam_x"], GROUND - 20, 14, 1216, jitter=RW * 0.6, direction=(-150, -30), speed=(80, 260),
     life=(0.25, 0.36), size=(12, 24), grow=1.6, drag=3.0, alpha=0.34)
rp = random.Random(9)
tt = B["lift"][0] + 0.1
while tt < B["slam"][0]:                                          # pebbles crumbling off the lifted rock
    cx, by, rot = rock_at(tt)
    px, py = ROCK.grip((rp.uniform(-RW * 0.42, RW * 0.42), -3), cx, by, rot)
    FX.burst(tt, px, py, 1, rp.randrange(10 ** 6), "pebble", direction=(60, 120), speed=(10, 60), life=(1.0, 1.5),
             size=(3.2, 6.8), gravity=1800, drag=0.0)
    tt += rp.uniform(0.06, 0.13)
tt = B["lift"][0]
while tt < B["lift"][3]:                                          # dust swirling at his feet as he lifts
    FX.swirl(tt, hero_x.at(tt), GROUND - 10, 2, int(tt * 1000), spin=1)
    tt += 0.07
FX.burst(B["slam"][1], L["rock_slam_x"], GROUND - 20, 12, 1217, "pebble", direction=(-160, -20), speed=(120, 320),
         life=(0.9, 1.4), size=(2.5, 5.5), gravity=1800, drag=0.0, jitter=RW * 0.8)
for i, tt in enumerate([2.35, 2.7, 3.05, 3.4, 3.75, 4.1, 4.4, 9.15, 9.5, 9.85, 10.2]):   # sweat flying off
    st = hero_state(tt, base=True)
    J = MAN.solve(st["pose"], st["x"], st["y"], st["f"], st["sq"], st["fix"])
    FX.burst(tt, J["head"][0] + 10, J["head"][1] - 14, 2, 900 + i, "sweat", direction=(-75, -25), speed=(140, 250),
             life=(0.55, 0.7), size=(4.5, 6), gravity=1400, drag=0.3)

# "HA HA" bubbles: spawned above each laugher's label while they laugh, popped the moment they're shocked
for i, m in enumerate(CROWD):
    tt, r, n = 2.55, random.Random(31 + i), 0
    while tt < m["shock"]:
        amp = m["laugh"].at(tt)
        if amp > 0.3:
            lx, ly = crowd_label_pos(m, tt, 0)
            side = 1 if n % 2 else -1
            FX.bubble(tt, lx + side * r.uniform(6, 14), ly - max(CONFIG["text"]["label_rows"]) - 52 - (i % 2) * 50 - (n % 2) * 8,
                      r.randrange(10 ** 6), pop=m["shock"], life=0.85)
            n += 1
            tt += 1.0 if amp < 1.0 else 0.8
        else:
            tt += 0.1 if amp > 0.05 else 0.25


# --- ambient dust in the air, and the gust during the quiet pause --------------------------------
MOTES = [(random.Random(i).uniform(0, W + 120), random.Random(i + 500).uniform(380, 1600),
          random.Random(i + 900).uniform(8, 30), random.Random(i + 1300).uniform(1.0, 3.4),
          random.Random(i + 1700).uniform(0.1, 0.32), random.Random(i + 2100).uniform(0, TAU)) for i in range(90)]
GUST = [(random.Random(i + 3000).uniform(0, 0.55), random.Random(i + 3100).uniform(1240, 1520),
         random.Random(i + 3200).uniform(900, 1500), random.Random(i + 3300).uniform(1.2, 3.0)) for i in range(34)]


def draw_motes(ctx, t, front):
    for x0, y0, v, size, a, ph in MOTES:
        if (size > 2.7) != front:
            continue
        x = (x0 - v * t) % (W + 120) - 60
        y = y0 + 10 * math.sin(0.7 * t + ph)
        ctx.set_source_rgba(0.95, 0.68, 0.45, a)
        ctx.arc(x, y, size, 0, TAU)
        ctx.fill()


def draw_gust(ctx, t):
    g0, g1 = B["gust"]
    if not (g0 <= t <= g1):
        return
    env = bump(t, g0, g1)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for d, y, v, size in GUST:
        x = W + 60 - (t - g0 - d) * v
        if -80 < x < W + 80 and t > g0 + d:
            ctx.set_source_rgba(0.95, 0.7, 0.48, 0.38 * env)
            ctx.arc(x, y, size, 0, TAU)
            ctx.fill()
            ctx.set_source_rgba(0.95, 0.7, 0.48, 0.12 * env)
            ctx.set_line_width(size * 0.8)
            ctx.move_to(x, y)
            ctx.line_to(x + v * 0.06, y + 1)
            ctx.stroke()


# =============================================================================
# 9. FRAME RENDERER + OUTPUT
# =============================================================================
BG = render_background()


def render_frame(ctx, t):
    t = min(t, CONFIG["video"]["hold_from"])          # the last half second is a frozen final frame
    ctx.set_source_surface(BG, 0, 0)
    ctx.paint()
    hl = header_layout(ctx)
    draw_flame(ctx, hl["flame_x"], hl["base"] + 6, hl["flame_h"], t)
    draw_motes(ctx, t, front=False)

    cx, by, rot = rock_at(t)
    hs = hero_state(t)
    states = [crowd_state(m, t) for m in CROWD]
    for st in states:
        ground_shadow(ctx, st["x"], 56 * st["scale"], 0.75, st["y"])
    ground_shadow(ctx, hs["x"], 56, 0.75)
    ground_shadow(ctx, cx, RW * 0.62, 1 - clamp((GROUND - by) / 200))
    for st in sorted(states, key=lambda s: s["scale"]):   # whoever is further away is drawn first
        MAN.draw(ctx, st)
    ROCK.draw(ctx, cx, by, rot)                        # the hero always reads in front of the rock he grips
    MAN.draw(ctx, hs)
    FX.draw(ctx, t, kinds=("dust", "swirl", "pebble", "sweat"))
    draw_gust(ctx, t)
    draw_motes(ctx, t, front=True)

    # labels: fixed to each character's un-shaken posture so they don't jitter with the laughter
    labels = []
    for m, row in zip(CROWD, CONFIG["text"]["label_rows"]):
        labels.append([m["name"], *crowd_label_pos(m, t, row)])
    J = MAN.solve(hero_state(t, base=True)["pose"], hs["x"], hs["y"], hs["f"])
    y = label_y(J)
    over = clamp(1 - abs(cx - J["head"][0]) / (RW * 0.5))   # rock overhead -> label sits above the rock
    labels.append([CONFIG["text"]["hero"], J["head"][0], lerp(y, min(y, ROCK.top(by) - 22), smooth(0.25, 0.6, over))])
    avoid_label_overlap(ctx, labels)
    for text, x, y in labels:
        draw_label(ctx, text, x, y)
    FX.draw(ctx, t, kinds=("bubble",))


def avoid_label_overlap(ctx, labels):
    """Lift a label onto a second row (smoothly, by how much it overlaps) when it would collide with a neighbour."""
    set_font(ctx, CONFIG["fonts"]["label"], CONFIG["text"]["label_size"])
    S, lh = CONFIG["safe"], CONFIG["text"]["label_size"] + 8
    spans = []
    for text, x, _ in labels:
        w = ctx.text_extents(text).x_advance
        x0 = clamp(x - w / 2, S["side"], W - S["side"] - w)
        spans.append((x0, x0 + w))
    for i in range(len(labels)):
        for j in range(i):
            overlap = min(spans[i][1], spans[j][1]) - max(spans[i][0], spans[j][0]) + 10
            if overlap > 0 and abs(labels[i][2] - labels[j][2]) < lh:
                labels[i][2] -= smooth(0, 22, overlap) * lh


def new_surface():
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    return s, cairo.Context(s)


def export_frame(t, path):
    s, ctx = new_surface()
    render_frame(ctx, t)
    s.write_to_png(path)
    print("frame", t, "->", path)


def export_sheet(path, times=None):
    C = CONFIG["sheet"]
    times = times or [round(i * C["step"], 3) for i in range(int(CONFIG["video"]["duration"] / C["step"]) + 1)]
    cols, tw = C["cols"], C["thumb_w"]
    th, gap, lab = int(tw * H / W), 14, 40
    rows = math.ceil(len(times) / cols)
    sheet = cairo.ImageSurface(cairo.FORMAT_ARGB32, cols * tw + (cols + 1) * gap, rows * (th + lab) + (rows + 1) * gap)
    sc = cairo.Context(sheet)
    sc.set_source_rgb(0.07, 0.07, 0.07)
    sc.paint()
    frame, fctx = new_surface()
    for i, t in enumerate(times):
        render_frame(fctx, t)
        frame.flush()
        x, y = gap + (i % cols) * (tw + gap), gap + (i // cols) * (th + lab + gap)
        sc.save()
        sc.translate(x, y)
        sc.scale(tw / W, th / H)
        pat = cairo.SurfacePattern(frame)
        pat.set_filter(cairo.FILTER_BEST)
        sc.set_source(pat)
        sc.paint()
        sc.restore()
        set_font(sc, CONFIG["fonts"]["label"], 22)
        sc.set_source_rgb(0.86, 0.86, 0.86)
        sc.move_to(x + 4, y + th + 29)
        sc.show_text(f"{t:.2f}s" if abs(t * 10 - round(t * 10)) > 1e-6 else f"{t:.1f}s")
    sheet.write_to_png(path)
    print("contact sheet ->", path)


def export_video(path):
    n = int(round(CONFIG["video"]["duration"] * FPS))
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
           "-preset", "slow", "-movflags", "+faststart", "-an", path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    s, ctx = new_surface()
    for i in range(n):
        render_frame(ctx, i / FPS)
        s.flush()
        proc.stdin.write(bytes(s.get_data()))
        if (i + 1) % 30 == 0 or i + 1 == n:
            print(f"\r  frame {i + 1}/{n}", end="", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg failed")
    print("\nvideo ->", path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", action="store_true", help="export the contact sheet only")
    ap.add_argument("--video", action="store_true", help="render the MP4 only")
    ap.add_argument("--frame", type=float, action="append", help="export single frame(s) at these times")
    ap.add_argument("--sheet-times", help="comma-separated times for a custom review sheet")
    ap.add_argument("--out-dir", default=HERE)
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    if a.frame:
        for t in a.frame:
            export_frame(t, os.path.join(a.out_dir, f"frame_{t:05.2f}.png"))
        return
    if a.sheet_times:
        export_sheet(os.path.join(a.out_dir, "review_sheet.png"), [float(v) for v in a.sheet_times.split(",")])
        return
    if a.sheet or not a.video:
        export_sheet(os.path.join(a.out_dir, CONFIG["contact_sheet"]))
    if a.video or not a.sheet:
        export_video(os.path.join(a.out_dir, CONFIG["output"]))


if __name__ == "__main__":
    main()
