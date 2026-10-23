#!/usr/bin/env python3
"""
Stickman Bridge Revenge - a 9:16 Instagram Reel drawn frame by frame with pycairo
and piped straight into ffmpeg (H.264 MP4, no audio).

    python3 stickman_bridge_revenge.py              contact sheet, then the full MP4
    python3 stickman_bridge_revenge.py --sheet      contact sheet only
    python3 stickman_bridge_revenge.py --video      MP4 only
    python3 stickman_bridge_revenge.py --frame 7.5  one PNG still at t = 7.5 s

Everything you would normally change for a new version (labels, header, colours,
timings, audio, shake, resolution) lives in CONFIG.  All drawing happens in a 1080x1920 design
space that is scaled to the output resolution.

The screen shake comes from shake_track.json (per-frame offsets measured from a
reference edit) and the soundtrack from CONFIG["audio"]; set either to None to drop it.

Requires: pycairo (pip install pycairo) and ffmpeg on PATH.
"""

import argparse
import json
import math
import os
import random
import shutil
import subprocess
import sys
import time

try:
    import cairo
except ImportError:  # pragma: no cover
    sys.exit("pycairo is required:  pip install pycairo")


# =============================================================================
# CONFIG
# =============================================================================
CONFIG = {
    # ---- output ------------------------------------------------------------
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "duration": 10.77,           # story length (s); + hold_end = audio length
    "hold_end": 0.5,             # freeze the final frame this long (s)
    "crf": 18,
    "output_video": "stickman_bridge_revenge_shake_audio.mp4",
    "output_sheet": "stickman_bridge_revenge_shake_audio_contact_sheet.png",
    "sheet_step": 0.5,           # one contact-sheet frame every N seconds
    "sheet_columns": 5,
    "seed": 7,

    # ---- audio & screen shake -----------------------------------------------
    "audio": "reel_audio.mp3",           # muxed under the video (None = silent)
    "shake_file": "shake_track.json",    # per-frame world shake offsets (None = no shake)
    "shake_offset": 0.025,               # delay the shake track (s) so its hits land on the audio
    "shake_strength": 1.0,

    # ---- Instagram safe zone (design px) ----------------------------------
    "safe_top": 200,
    "safe_bottom": 280,
    "safe_side": 60,

    # ---- text --------------------------------------------------------------
    "header_text": "REVENGE",
    "watermark": "@DarkNinja",
    # fontconfig family names, first installed one wins (":bold" = bold weight)
    "font_header": ["Inter Black", "Montserrat Black", "Arial Black", "DejaVu Sans:bold"],
    "font_label": ["Inter ExtraBold", "Montserrat ExtraBold", "Arial:bold", "DejaVu Sans:bold"],
    "font_timer": ["JetBrains Mono ExtraBold", "DejaVu Sans Mono:bold", "Courier New:bold"],
    "font_watermark": ["Inter SemiBold", "Arial:bold", "DejaVu Sans:bold"],
    "header_size": 128,
    "timer_size": 62,
    "label_size": 40,
    "watermark_size": 34,
    "header_y": 345,             # header baseline
    "timer_y": 442,              # timer baseline
    "watermark_y": 1590,         # watermark baseline
    "watermark_alpha": 0.30,

    # timer: (video time, displayed seconds) pairs, linearly interpolated
    "timer_keys": [(0.0, 0), (1.0, 0), (1.2, 10), (3.1, 45), (3.4, 90),
                   (5.55, 90), (5.85, 180), (8.0, 180), (8.3, 300)],
    "timer_plus_from": 8.3,      # append "+" from this video time on

    # ---- scene layout (design px) ------------------------------------------
    "bridge_y": 770,             # top edge of the deck (~40 % of the height)
    "horizon_y": 1210,
    "water_y": 1455,             # where falling bodies hit the river
    "sun": (780, 1105, 150),     # x, y, radius
    "slots": [180, 420, 660, 900],

    # ---- characters, left to right ----------------------------------------
    # role: bored_drop | slip_fall | steady | crack_recover
    "characters": [
        {"label": "Talent", "role": "bored_drop"},
        {"label": "Motivation", "role": "slip_fall"},
        {"label": "Discipline", "role": "steady"},
        {"label": "Revenge", "role": "crack_recover"},
    ],

    # ---- story beats (s), placed on the soundtrack's hits ---------------------
    "beats": {
        "bored": 1.2,            # Talent gets bored, kicks its legs
        "bored_hand": 1.95,      # ...lets go with one hand
        "bored_drop": 2.2,       # ...and drops (splash on the 2.7 s hit)
        "strain": 3.1,           # Motivation shakes and sweats
        "slip": 3.7,             # one hand slips
        "regrab": 4.0,           # grabs again
        "fall": 4.7,             # falls flailing (splash on the 5.2 s hit)
        "crack": 5.55,           # Revenge's plank cracks as the music drops out
        "break": 5.85,           # plank breaks, Revenge hangs by one hand
        "angry": 8.0,            # eyes snap into anger on the impact shake
        "pull": 8.2,             # starts pulling itself up through the drop
        "recover": 9.85,         # re-grabs with the injured hand
        "tight": 10.35,          # hangs tighter than before
    },

    # ---- camera ---------------------------------------------------------------
    "zoom": {"start": 8.0, "end": 10.77, "scale": 1.2,
             "target": "crack_recover",          # role to zoom toward
             "screen": (770, 945)},              # where the target ends up

    # ---- stickman geometry (design px) ---------------------------------------
    "stickman": {
        "head_r": 29, "neck": 6, "torso": 112, "shoulder_w": 15, "shoulder_drop": 9,
        "upper_arm": 70, "forearm": 66, "hip_w": 7, "thigh": 78, "shin": 76,
        "limb_w": 20, "torso_w": 23, "hand_r": 13.5,
        "grip_half": 64,         # hands sit this far left/right of the body
        "grip_drop": 5,          # hand centre below the deck top
    },

    # ---- bridge ---------------------------------------------------------------
    "bridge": {
        "plank_w": 44, "plank_gap": 6, "plank_h": 30, "beam_h": 12,
        "post_w": 16, "post_h": 150, "rail_sag": 22, "mid_rope": 80, "hanger_step": 40,
    },

    # ---- birds: x, y, speed (px/s), wingspan, flaps per second ----------------
    "birds": [(170, 548, 9, 30, 1.5), (238, 508, 10, 21, 1.9), (705, 565, -11, 26, 1.7),
              (868, 522, -9, 18, 2.1), (455, 985, 7, 14, 2.3)],

    # ---- colours ----------------------------------------------------------------
    "sky": [(0, "#190a2c"), (330, "#341350"), (620, "#6f2167"),
            (840, "#c03f6e"), (1030, "#ee6a4f"), (1210, "#ff8a2c")],
    "colors": {
        "stickman": "#000000",
        "rim": "#ffb96e",
        "rim_halo": "#ff8a52",
        "eyes": "#ffffff",
        "sweat": "#b4e2ff",
        "cut": "#e3202d",
        "wood": "#24130f",
        "wood_dark": "#170c0a",
        "rope": "#1b0e0d",
        "wood_rim": "#ff9a5a",
        "crack": "#ffcf96",
        "splinters": ["#2a160e", "#4d2b19", "#7b4a2b", "#b0703f"],
        "label": "#ffffff",
        "label_outline": "#1a0a1f",
        "label_dead": "#8f8a92",
        "header": "#ffffff",
        "timer": "#ffffff",
        "watermark": "#ffffff",
        "flame_outer": ("#ff4a1c", "#ffa21f"),   # bottom, top
        "flame_inner": ("#fff3b0", "#ffc93a"),
        "sun_core": "#fff5da",
        "sun_edge": "#ffc65e",
        "sun_glow": "#ffae4a",
        "mount_far": ("#8c3869", "#bb556e"),     # top, base
        "mount_near": ("#47163e", "#5d2046"),
        "water_tint": "#1b0a2b",
        "glitter": "#ffd9a2",
        "splash": "#fff3e6",
        "ripple": "#ffdcc2",
        "bird": "#2a1033",
    },
}


# =============================================================================
# Small helpers
# =============================================================================
TAU = math.tau


def lerp(a, b, u):
    return a + (b - a) * u


def clamp(x, lo, hi):
    return lo if x < lo else hi if x > hi else x


def dirv(a):
    """Unit vector for angle a: 0 = straight down, +pi/2 = screen right."""
    return math.sin(a), math.cos(a)


def angle_of(dx, dy):
    return math.atan2(dx, dy)


def wrap_near(a, ref):
    return a + TAU * round((ref - a) / TAU)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mix(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def smooth(u):
    u = clamp(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


EASE = {
    "linear": lambda u: u,
    "in": lambda u: u ** 3,
    "out": lambda u: 1 - (1 - u) ** 3,
    "inout": lambda u: 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2,
    "sine": lambda u: 0.5 - 0.5 * math.cos(math.pi * u),
    "snap": lambda u: 1 - (1 - u) ** 5,
    "back": lambda u: 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
    "step": lambda u: 1.0 if u >= 1 else 0.0,
}


def resolve_font(candidates):
    """Pick the first installed family from a list like ["Inter Black", "Arial:bold"]."""
    weight_of = lambda spec: cairo.FONT_WEIGHT_BOLD if spec.endswith(":bold") else cairo.FONT_WEIGHT_NORMAL
    names = [(c.split(":")[0], weight_of(c)) for c in candidates]
    if shutil.which("fc-match"):
        for fam, weight in names:
            try:
                got = subprocess.run(["fc-match", "-f", "%{family}", fam], capture_output=True,
                                     text=True, timeout=5).stdout
            except (OSError, subprocess.SubprocessError):
                break
            if fam.lower() in got.lower():
                return fam, weight
    return names[-1]


def noise(t, seed):
    """Smooth pseudo-noise in [-1, 1] built from incommensurate sines (for trembling)."""
    return (0.55 * math.sin(TAU * 7.3 * t + seed) + 0.3 * math.sin(TAU * 11.1 * t + 2.1 * seed)
            + 0.15 * math.sin(TAU * 4.1 * t + 0.7 * seed))


# =============================================================================
# Timeline: per-channel keyframes with easing
# =============================================================================
class Track:
    """Keyframed float channels. The ease of a key shapes the segment that ends on it."""

    def __init__(self, defaults):
        self.defaults = dict(defaults)
        self.keys = {name: [(0.0, float(v), "linear")] for name, v in defaults.items()}

    def value(self, name, t):
        ks = self.keys[name]
        if t <= ks[0][0]:
            return ks[0][1]
        for (t0, v0, _), (t1, v1, ease) in zip(ks, ks[1:]):
            if t < t1:
                return lerp(v0, v1, EASE[ease]((t - t0) / (t1 - t0)))
        return ks[-1][1]

    def key(self, t, ease="inout", **vals):
        for name, v in vals.items():
            ks = [k for k in self.keys[name] if abs(k[0] - t) > 1e-6]
            ks.append((t, float(v), ease))
            ks.sort(key=lambda k: k[0])
            self.keys[name] = ks

    def ramp(self, t0, t1, ease="inout", **vals):
        """Hold each channel at its current value until t0, then ease to the new value by t1."""
        for name in vals:
            self.key(t0, "linear", **{name: self.value(name, t0)})
        self.key(t1, ease, **vals)

    def sample(self, t):
        return {name: self.value(name, t) for name in self.defaults}


# Every animatable channel of a stickman, with its default value.
CHANNELS = dict(
    hang=116.0,       # pivot -> neck distance while hanging
    pivot=0.0,        # -1 hang from left hand, 0 both hands, +1 right hand
    swing=0.0,        # pendulum angle on top of the procedural sway (rad)
    sway_amp=0.04,    # procedural sway amplitude (rad)
    lean=0.0,         # torso angle relative to the pendulum line
    head_tilt=0.0,
    grip_l=1.0,       # 1 = hand locked on the bridge (IK), 0 = free arm (FK)
    grip_r=1.0,
    grip_r_dx=0.0,    # move the right-hand grip (re-grab on another plank)
    grip_dy=0.0,      # hands sliding down the plank edge
    ua_l=-2.75, fa_l=0.2, ua_r=2.75, fa_r=-0.2,     # FK arms (upper rel. torso, fore rel. upper)
    th_l=-0.10, sh_l=0.12, th_r=0.10, sh_r=-0.12,   # FK legs (thigh rel. torso, shin rel. thigh)
    shin_l=1.0, shin_r=1.0,                         # shin length scale (foreshortened kicks)
    tremble=0.0,      # body trembling (px)
    kick=0.0,         # lazy bored leg swinging
    struggle=0.0,     # fast leg pedalling
    flail=0.0,        # windmilling arms while falling
    stretch=1.0,      # squash & stretch (1 neutral, >1 taller)
    eye_open=1.0, eye_w=1.0, eye_lid=0.0, eye_slant=0.0, eye_tilt=0.0,
    look_x=0.0, look_y=0.0,
    sweat=0.0,        # sweat drops per second
    cut=0.0,          # red cut marks on the right hand
    label_dim=0.0,    # label fades to grey
)

# Eye-shape presets (expressions).
EXPR = {
    "calm": dict(eye_open=1.0, eye_w=1.0, eye_lid=0.0, eye_slant=0.0, eye_tilt=0.0),
    "bored": dict(eye_open=1.0, eye_w=1.1, eye_lid=0.55, eye_slant=0.0, eye_tilt=0.0),
    "strain": dict(eye_open=0.2, eye_w=1.35, eye_lid=0.0, eye_slant=0.0, eye_tilt=0.32),
    "panic": dict(eye_open=1.45, eye_w=1.4, eye_lid=0.0, eye_slant=0.0, eye_tilt=0.0),
    "angry": dict(eye_open=1.0, eye_w=1.4, eye_lid=0.46, eye_slant=0.95, eye_tilt=-0.1),
}

# Joint-angle pose presets.
POSES = {
    "hang": dict(hang=116, pivot=0, lean=0, grip_l=1, grip_r=1,
                 th_l=-0.10, sh_l=0.12, th_r=0.10, sh_r=-0.12),
    "fall_casual": dict(ua_l=-2.95, fa_l=0.15, ua_r=2.95, fa_r=-0.15,
                        th_l=-0.05, sh_l=0.05, th_r=0.05, sh_r=-0.05),
    "tight_legs": dict(th_l=-0.22, sh_l=0.34, th_r=0.22, sh_r=-0.34),
}

JOINTS = ("head", "neck", "hip", "el_l", "el_r", "ha_l", "ha_r", "kn_l", "kn_r", "ft_l", "ft_r")


# =============================================================================
# Particles: splash drops, ripple rings, foam, splinters, sweat, plank chunks
# =============================================================================
class Particle:
    __slots__ = ("kind", "x", "y", "vx", "vy", "life", "age", "size", "g", "drag", "rot",
                 "vrot", "color", "alpha", "delay", "floor", "layer", "data")

    def __init__(self, kind, x, y, vx=0.0, vy=0.0, life=1.0, size=4.0, g=0.0, drag=0.0,
                 rot=0.0, vrot=0.0, color=(1, 1, 1), alpha=1.0, delay=0.0, floor=None,
                 layer="front", data=None):
        self.kind, self.x, self.y, self.vx, self.vy = kind, x, y, vx, vy
        self.life, self.age, self.size, self.g, self.drag = life, 0.0, size, g, drag
        self.rot, self.vrot, self.color, self.alpha = rot, vrot, color, alpha
        self.delay, self.floor, self.layer, self.data = delay, floor, layer, data


class Particles:
    def __init__(self, scene):
        self.scene = scene
        self.items = []
        self.rng = random.Random(scene.cfg["seed"] + 1)

    def add(self, *args, **kw):
        p = Particle(*args, **kw)
        self.items.append(p)
        return p

    # ---- emitters -------------------------------------------------------------
    def splash(self, x, y, power=1.0):
        r, C = self.rng, self.scene.colors
        k = power ** 0.45
        for _ in range(int(44 * power + 14)):                    # main spray cone
            side = r.uniform(-1, 1)
            sp = r.uniform(420, 960) * k
            self.add("drop", x + side * 26 * power, y - 3, side * sp * 0.5 + r.uniform(-30, 30),
                     -sp * r.uniform(0.55, 1.0) * (1 - 0.3 * abs(side)), life=1.8,
                     size=r.uniform(3.5, 8.5) * (0.85 + 0.25 * power), g=2600,
                     color=C["splash"], floor=y + r.uniform(-2, 12))
        for _ in range(int(9 * power + 3)):                      # tall centre column
            self.add("drop", x + r.uniform(-12, 12), y - 5, r.uniform(-70, 70),
                     -r.uniform(950, 1180) * k, life=1.8, size=r.uniform(6, 10.5), g=2600,
                     color=C["splash"], floor=y + 6)
        n = int(16 * power + 6)
        for i in range(n):                                       # low crown
            side = (i / (n - 1)) * 2 - 1
            self.add("drop", x + side * 40 * power, y - 2, side * r.uniform(260, 420) * k,
                     -r.uniform(380, 620) * k, life=1.2, size=r.uniform(4, 7), g=2600,
                     color=C["splash"], floor=y + 8)
        for i, d in enumerate((0.0, 0.25, 0.55)):                # expanding rings
            self.add("ring", x, y + 4, life=2.1, delay=d, size=(165 + 95 * power) * (1 - 0.18 * i),
                     alpha=0.9 - 0.22 * i, layer="surface", color=C["ripple"])
        self.add("foam", x, y + 2, life=1.25, size=48 * power + 18, layer="surface",
                 color=C["splash"])

    def spray(self, x, y, power=1.0):
        """Small follow-up drops while a body is still entering the water."""
        r, C = self.rng, self.scene.colors
        for _ in range(int(2 + 2 * power)):
            side = r.uniform(-1, 1)
            self.add("drop", x + side * 22, y - 2, side * r.uniform(80, 260),
                     -r.uniform(250, 620) * power ** 0.4, life=1.2, size=r.uniform(3, 6.5),
                     g=2600, color=C["splash"], floor=y + 8)

    def splinters(self, x, y, n, power=1.0):
        r, C = self.rng, self.scene.colors
        for _ in range(n):
            a = r.uniform(-2.3, 2.3) + math.pi          # mostly upward (pi = up)
            sp = r.uniform(260, 900) * power
            dx, dy = dirv(a)
            length = r.uniform(7, 22) * (0.8 + 0.3 * power)
            self.add("splinter", x + r.uniform(-12, 12), y + r.uniform(-6, 14),
                     dx * sp + 120 * power, dy * sp, life=2.2, size=length, g=2300, drag=0.4,
                     rot=r.uniform(0, TAU), vrot=r.uniform(-22, 22),
                     color=rgb(r.choice(C["splinters"])), floor=self.scene.cfg["water_y"] + r.uniform(-30, 40),
                     data=r.uniform(0.18, 0.32))

    def sweat(self, x, y, side):
        r = self.rng
        self.add("sweat", x, y, side * r.uniform(50, 135), -r.uniform(40, 150), life=0.75,
                 size=r.uniform(4.5, 6.5), g=1500, color=self.scene.colors["sweat"])

    # ---- simulation -----------------------------------------------------------
    def update(self, dt):
        alive = []
        for p in self.items:
            if p.delay > 0:
                p.delay -= dt
                alive.append(p)
                continue
            p.age += dt
            if p.age >= p.life:
                continue
            if p.g or p.vx or p.vy:
                p.vy += p.g * dt
                if p.drag:
                    f = max(0.0, 1 - p.drag * dt)
                    p.vx *= f
                    p.vy *= f
                p.x += p.vx * dt
                p.y += p.vy * dt
            p.rot += p.vrot * dt
            if p.floor is not None and p.vy > 0 and p.y > p.floor:
                if p.kind == "chunk":
                    self.splash(p.x, p.floor, 0.4)
                continue
            alive.append(p)
        self.items = alive

    # ---- drawing --------------------------------------------------------------
    def draw(self, ctx, layer):
        for p in self.items:
            if p.layer != layer or p.delay > 0:
                continue
            u = p.age / p.life
            if p.kind == "drop":
                speed = math.hypot(p.vx, p.vy)
                stretch = min(2.2, 1 + speed / 900)
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(math.atan2(p.vy, p.vx))
                ctx.scale(p.size * stretch * 0.5, p.size * 0.5 / math.sqrt(stretch) * 1.15)
                ctx.arc(0, 0, 1, 0, TAU)
                ctx.restore()
                ctx.set_source_rgba(*p.color, p.alpha * (1 - u ** 3) * 0.95)
                ctx.fill()
            elif p.kind == "ring":
                e = 1 - math.exp(-p.age * 1.5)
                rx = 18 + p.size * e
                a = p.alpha * (1 - u) ** 1.6
                for off, col, aa, w in ((0, p.color, a, 3.2 * (1 - 0.5 * e) + 1),
                                        (-5, (0.12, 0.04, 0.16), a * 0.35, 2.0)):
                    ctx.save()
                    ctx.translate(p.x, p.y + off * 0.2)
                    ctx.scale(rx + off, (rx + off) * 0.19)
                    ctx.arc(0, 0, 1, 0, TAU)
                    ctx.restore()
                    ctx.set_line_width(w)
                    ctx.set_source_rgba(*col, aa)
                    ctx.stroke()
            elif p.kind == "foam":
                grow = 1 + 0.7 * (1 - (1 - u) ** 2)
                a = 0.8 * (1 - u) ** 1.3
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.scale(p.size * grow, p.size * grow * 0.22)
                foam = cairo.RadialGradient(0, 0, 0, 0, 0, 1)
                foam.add_color_stop_rgba(0.0, *p.color, a)
                foam.add_color_stop_rgba(0.55, *p.color, a * 0.7)
                foam.add_color_stop_rgba(1.0, *p.color, 0.0)
                ctx.arc(0, 0, 1, 0, TAU)
                ctx.set_source(foam)
                ctx.fill()
                ctx.restore()
            elif p.kind == "splinter":
                w = p.size * p.data
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rot)
                ctx.move_to(-p.size / 2, 0)
                ctx.line_to(-p.size * 0.15, -w / 2)
                ctx.line_to(p.size / 2, -w * 0.15)
                ctx.line_to(p.size * 0.2, w / 2)
                ctx.close_path()
                ctx.restore()
                ctx.set_source_rgba(*p.color, 1 - u ** 4)
                ctx.fill()
            elif p.kind == "sweat":
                rr = p.size
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(math.atan2(p.vy, p.vx))
                tip = 2.4 * rr
                ang = math.acos(rr / tip)
                ctx.move_to(-tip, 0)
                ctx.line_to(rr * math.cos(math.pi + ang), rr * math.sin(math.pi + ang))
                ctx.arc(0, 0, rr, -math.pi + ang, math.pi - ang)
                ctx.close_path()
                ctx.set_source_rgba(*p.color, 0.95 * (1 - u ** 2))
                ctx.fill()
                ctx.arc(rr * 0.25, -rr * 0.3, rr * 0.3, 0, TAU)
                ctx.set_source_rgba(1, 1, 1, 0.8 * (1 - u ** 2))
                ctx.fill()
                ctx.restore()
            elif p.kind == "chunk":
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rot)
                pts = p.data
                ctx.move_to(*pts[0])
                for q in pts[1:]:
                    ctx.line_to(*q)
                ctx.close_path()
                ctx.set_source_rgb(*p.color)
                ctx.fill_preserve()
                ctx.set_source_rgba(*self.scene.colors["wood_rim"], 0.35)
                ctx.set_line_width(1.5)
                ctx.stroke()
                ctx.restore()


# =============================================================================
# Bridge
# =============================================================================
class Bridge:
    def __init__(self, scene):
        self.scene = scene
        cfg = scene.cfg
        b = cfg["bridge"]
        self.top = cfg["bridge_y"]
        self.pw, self.gap, self.ph, self.bh = b["plank_w"], b["plank_gap"], b["plank_h"], b["beam_h"]
        self.b = b
        pitch = self.pw + self.gap
        self.pitch = pitch
        # Align one plank exactly under the right hand of the character whose plank breaks.
        slots = cfg["slots"]
        idx = next((i for i, c in enumerate(cfg["characters"]) if c["role"] == "crack_recover"), None)
        anchor = (slots[idx] + cfg["stickman"]["grip_half"]) if idx is not None else 540
        x0 = anchor - self.pw / 2
        self.planks = [x0 + pitch * k for k in range(-40, 40) if -420 < x0 + pitch * k < 1500]
        spacing = (slots[-1] - slots[0]) / max(1, len(slots) - 1) if len(slots) > 1 else 240
        self.posts = [slots[0] - spacing / 2 + spacing * k for k in range(-2, len(slots) + 3)]
        self.crack = None

    def set_crack(self, x, t_crack, t_break):
        i = min(range(len(self.planks)), key=lambda k: abs(self.planks[k] + self.pw / 2 - x))
        jag = [(13, 0), (17, 7), (12, 13), (18, 19), (14, 25), (17, self.ph)]
        branches = [[(17, 7), (25, 10), (31, 8)], [(18, 19), (27, 23), (33, 22)]]
        self.crack = dict(i=i, tc=t_crack, tb=t_break, jag=jag, branches=branches, broken=False)
        self.scene.at(t_crack, self._crack_start)
        self.scene.at(t_break, self._break)

    def _crack_start(self):
        px = self.planks[self.crack["i"]]
        self.scene.particles.splinters(px + 20, self.top + 6, 7, power=0.6)

    def _break(self):
        c = self.crack
        c["broken"] = True
        px = self.planks[c["i"]]
        # chunk = plank to the right of the jagged crack line
        pts = [(px + x, self.top + y) for x, y in c["jag"]]
        pts += [(px + self.pw, self.top + self.ph), (px + self.pw, self.top)]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        local = [(x - cx, y - cy) for x, y in pts]
        self.scene.particles.add("chunk", cx, cy, 70, 40, life=4.0, g=2300, vrot=3.2,
                                 color=self.scene.colors["wood"], floor=self.scene.cfg["water_y"] - 8,
                                 layer="back", data=local)
        self.scene.particles.splinters(px + 24, self.top + 10, 30, power=1.0)

    def draw(self, ctx, t):
        C = self.scene.colors
        top, b = self.top, self.b
        post_top = top - b["post_h"]
        x_min, x_max = self.posts[0], self.posts[-1]
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)

        def rope(y_at_post, sag, width, color, alpha=1.0):
            for xa, xb in zip(self.posts, self.posts[1:]):
                xm = (xa + xb) / 2
                ctx.move_to(xa, y_at_post)
                ctx.curve_to(lerp(xa, xm, 0.66), y_at_post + sag * 1.33,
                             lerp(xb, xm, 0.66), y_at_post + sag * 1.33, xb, y_at_post)
            ctx.set_line_width(width)
            ctx.set_source_rgba(*color, alpha)
            ctx.stroke()

        def rail_y(x, y_at_post, sag):
            # height of a rope (approximated as a parabola) between its two posts
            for xa, xb in zip(self.posts, self.posts[1:]):
                if xa <= x <= xb:
                    u = (x - xa) / (xb - xa)
                    return y_at_post + sag * 4 * u * (1 - u)
            return y_at_post

        hand_y = post_top + 10
        mid_y = top - b["mid_rope"]
        # vertical hangers from the handrail to the deck
        ctx.set_line_width(2.2)
        ctx.set_source_rgb(*C["rope"])
        x = x_min
        while x <= x_max:
            if all(abs(x - p) > 12 for p in self.posts):
                ctx.move_to(x, rail_y(x, hand_y, b["rail_sag"]))
                ctx.line_to(x, top + 2)
            x += b["hanger_step"]
        ctx.stroke()
        rope(mid_y, b["rail_sag"] * 0.55, 3.2, C["rope"])
        rope(hand_y, b["rail_sag"], 5.0, C["rope"])
        rope(hand_y - 2.5, b["rail_sag"], 1.6, C["wood_rim"], 0.28)   # warm sky glint on top

        # posts
        for px in self.posts:
            w = b["post_w"]
            ctx.rectangle(px - w / 2, post_top + 6, w, top + self.ph - post_top - 6)
            ctx.set_source_rgb(*C["wood_dark"])
            ctx.fill()
            ctx.arc(px, post_top + 6, w * 0.62, 0, TAU)
            ctx.fill()
            ctx.move_to(px - w / 2 + 1, post_top + 8)
            ctx.line_to(px - w / 2 + 1, top)
            ctx.set_line_width(1.4)
            ctx.set_source_rgba(*C["wood_rim"], 0.3)
            ctx.stroke()

        # side beam under the plank ends
        y_beam = top + self.ph - 2
        ctx.rectangle(x_min - 300, y_beam, x_max - x_min + 600, self.bh + 2)
        ctx.set_source_rgb(*C["wood_dark"])
        ctx.fill()
        ctx.move_to(x_min - 300, y_beam + self.bh + 1)
        ctx.line_to(x_max + 300, y_beam + self.bh + 1)
        ctx.set_line_width(2.0)
        ctx.set_source_rgba(*C["wood_rim"], 0.55)
        ctx.stroke()

        # plank ends
        cr = self.crack
        for i, px in enumerate(self.planks):
            if cr and i == cr["i"] and t >= cr["tc"]:
                self._draw_cracked(ctx, px, t)
                continue
            self._plank_path(ctx, px)
            ctx.set_source_rgb(*C["wood"])
            ctx.fill()
            ctx.move_to(px + 3, top + self.ph - 1)
            ctx.line_to(px + self.pw - 3, top + self.ph - 1)
            ctx.set_line_width(1.6)
            ctx.set_source_rgba(*C["wood_rim"], 0.3)
            ctx.stroke()

    def _plank_path(self, ctx, px):
        r, y, w, h = 3.5, self.top, self.pw, self.ph
        ctx.new_sub_path()
        ctx.arc(px + w - r, y + r, r, -math.pi / 2, 0)
        ctx.arc(px + w - r, y + h - r, r, 0, math.pi / 2)
        ctx.arc(px + r, y + h - r, r, math.pi / 2, math.pi)
        ctx.arc(px + r, y + r, r, math.pi, 1.5 * math.pi)
        ctx.close_path()

    def _draw_cracked(self, ctx, px, t):
        C, cr, top = self.scene.colors, self.crack, self.top
        if not cr["broken"]:
            self._plank_path(ctx, px)
            ctx.set_source_rgb(*C["wood"])
            ctx.fill()
            u = smooth((t - cr["tc"]) / 0.22)
            jag = cr["jag"]
            n = 1 + (len(jag) - 1) * u
            ctx.move_to(px + jag[0][0], top + jag[0][1])
            for k in range(1, len(jag)):
                f = clamp(n - k, 0, 1)
                if f <= 0:
                    break
                xa, ya = jag[k - 1]
                xb, yb = jag[k]
                ctx.line_to(px + lerp(xa, xb, f), top + lerp(ya, yb, f))
            if u > 0.5:
                for br in cr["branches"]:
                    ctx.move_to(px + br[0][0], top + br[0][1])
                    for q in br[1:]:
                        ctx.line_to(px + q[0], top + q[1])
            ctx.set_line_width(2.2)
            ctx.set_line_join(cairo.LINE_JOIN_MITER)
            ctx.set_source_rgba(*C["crack"], 0.95)
            ctx.stroke()
            ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        else:
            # stub that stays on the bridge (left of the jagged break)
            ctx.move_to(px + 3, top)
            for x, y in cr["jag"]:
                ctx.line_to(px + x, top + y)
            ctx.line_to(px, top + self.ph)
            ctx.line_to(px, top + 3)
            ctx.close_path()
            ctx.set_source_rgb(*C["wood"])
            ctx.fill()


# =============================================================================
# Stickman
# =============================================================================
def ik2(sh, target, l1, l2, side):
    """Two-bone IK; the elbow bends outward (to the screen side given by `side`)."""
    dx, dy = target[0] - sh[0], target[1] - sh[1]
    d = clamp(math.hypot(dx, dy), abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3)
    base = angle_of(dx, dy)
    alpha = math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
    a1 = base - side * alpha
    el = (sh[0] + dirv(a1)[0] * l1, sh[1] + dirv(a1)[1] * l1)
    a2 = angle_of(target[0] - el[0], target[1] - el[1])
    ha = (el[0] + dirv(a2)[0] * l2, el[1] + dirv(a2)[1] * l2)
    return el, ha


class Stickman:
    def __init__(self, scene, index, spec):
        self.scene = scene
        self.label = spec["label"]
        self.role = spec["role"]
        cfg = scene.cfg
        self.g = cfg["stickman"]
        self.x = cfg["slots"][index]
        gy = cfg["bridge_y"] + self.g["grip_drop"]
        self.gl0 = (self.x - self.g["grip_half"], gy)
        self.gr0 = (self.x + self.g["grip_half"], gy)
        self.track = Track(CHANNELS)
        self.track.key(0.0, "linear", **POSES["hang"], **EXPR["calm"])
        rng = random.Random(cfg["seed"] * 31 + index)
        self.sway_f = 0.29 + 0.04 * index
        self.sway_ph = rng.uniform(0, TAU)
        self.seed = rng.uniform(0, 100)
        self.blinks = []
        self.fall = None
        self._fall_base = None
        self.splashed = False
        self.gone = False
        self.splash_power = 1.0
        self.sweat_acc = 0.0
        self.joints = None

    # ---- animation authoring helpers -------------------------------------------
    def arm_angles(self, t, side, **override):
        """FK angles that reproduce the arm exactly as solved at time t."""
        j = self.solve(t, **override)
        s = "l" if side < 0 else "r"
        sh, el, ha = j["sh_" + s], j["el_" + s], j["ha_" + s]
        a_up = angle_of(el[0] - sh[0], el[1] - sh[1])
        a_lo = angle_of(ha[0] - el[0], ha[1] - el[1])
        ua = wrap_near(a_up - j["torso_a"], -2.8 if side < 0 else 2.8)
        fa = wrap_near(a_lo - a_up, 0.0)
        return ua, fa

    def release(self, t, side, to, dur=0.35, ease="out"):
        """Let go with one hand: the free arm starts exactly where the gripping arm was."""
        s = "l" if side < 0 else "r"
        ua, fa = self.arm_angles(t, side)
        self.track.key(t, "linear", **{"ua_" + s: ua, "fa_" + s: fa})
        self.track.ramp(t, t + 0.04, "linear", **{"grip_" + s: 0.0})
        self.track.ramp(t, t + dur, ease, **to)

    def grab(self, t, side, reach=0.35, ease="inout"):
        """Reach the free arm to the grip and lock it there at time t."""
        s = "l" if side < 0 else "r"
        ua, fa = self.arm_angles(t, side, **{"grip_" + s: 1.0})
        self.track.ramp(t - reach, t, ease, **{"ua_" + s: ua, "fa_" + s: fa})
        self.track.ramp(t, t + 0.06, "linear", **{"grip_" + s: 1.0})

    def glance(self, t0, t1, role, amount=0.75):
        other = self.scene.find_role(role)
        if other is None or other is self:
            return
        sign = 1 if other.x > self.x else -1
        self.track.ramp(t0, t0 + 0.18, "inout", look_x=sign * amount, look_y=0.15)
        self.track.ramp(t1 - 0.2, t1, "inout", look_x=0.0, look_y=0.0)

    def start_fall(self, t, vx=0.0, vy=0.0, spin=0.0, g=2500.0):
        self.fall = dict(t0=t, vx=vx, vy=vy, spin=spin, g=g)

    # ---- pose evaluation ---------------------------------------------------------
    def pose(self, t, **override):
        p = self.track.sample(t)
        p.update(override)
        k = p["kick"]
        if k:
            # lazy alternating kicks: the lower leg swings toward the camera (foreshortened)
            for side, sfx, off in ((-1, "l", 0.0), (1, "r", math.pi)):
                u = (0.5 + 0.5 * math.sin(TAU * 1.05 * t + off)) ** 2
                p["th_" + sfx] += side * k * 0.1 * u
                p["sh_" + sfx] -= side * k * 0.22 * u
                p["shin_" + sfx] *= 1 - k * 0.58 * u
        st = p["struggle"]
        if st:
            ph = TAU * 2.6 * t
            p["th_l"] += st * 0.22 * math.sin(ph)
            p["sh_l"] += st * 0.35 * (0.5 + 0.5 * math.sin(ph - 1.0))
            p["th_r"] += st * 0.22 * math.sin(ph + 2.4)
            p["sh_r"] -= st * 0.35 * (0.5 + 0.5 * math.sin(ph + 1.4))
        f = p["flail"]
        if f:
            ph = TAU * 2.3 * t
            p["ua_l"] += f * 1.05 * math.sin(ph)
            p["fa_l"] += f * 0.8 * math.sin(ph + 1.4)
            p["ua_r"] += f * 1.05 * math.sin(ph + 2.4)
            p["fa_r"] += f * 0.8 * math.sin(ph + 3.8)
            p["th_l"] += f * 0.5 * math.sin(ph * 1.3 + 0.6)
            p["sh_l"] += f * 0.45 * (0.6 + 0.4 * math.sin(ph * 1.3 + 2.1))
            p["th_r"] += f * 0.5 * math.sin(ph * 1.3 + 3.7)
            p["sh_r"] -= f * 0.45 * (0.6 + 0.4 * math.sin(ph * 1.3 + 5.2))
        tr = p["tremble"]
        if tr:
            p["fa_r"] += tr * 0.012 * noise(t, self.seed + 3)
            p["fa_l"] += tr * 0.012 * noise(t, self.seed + 5)
        for tb in self.blinks:
            d = abs(t - tb)
            if d < 0.09:
                p["eye_open"] *= 0.1 + 0.9 * (d / 0.09) ** 1.5
        return p

    def sway(self, t, amp):
        return amp * math.sin(TAU * self.sway_f * t + self.sway_ph)

    def _shoulder(self, neck, torso_a, side):
        g = self.g
        dn, pr = dirv(torso_a), dirv(torso_a + math.pi / 2)
        return (neck[0] + dn[0] * g["shoulder_drop"] + side * pr[0] * g["shoulder_w"],
                neck[1] + dn[1] * g["shoulder_drop"] + side * pr[1] * g["shoulder_w"])

    def solve(self, t, **override):
        p = self.pose(t, **override)
        g = self.g
        s = p["stretch"]
        gl = (self.gl0[0], self.gl0[1] + p["grip_dy"])
        gr = (self.gr0[0] + p["grip_r_dx"], self.gr0[1] + p["grip_dy"])
        falling = self.fall is not None and t >= self.fall["t0"]
        if falling:
            if self._fall_base is None:
                j0 = self.solve(self.fall["t0"] - 1e-4)
                self._fall_base = (j0["neck"], j0["th"])
            (nx, ny), th0 = self._fall_base
            f = self.fall
            tau = t - f["t0"]
            neck = [nx + f["vx"] * tau, ny + f["vy"] * tau + 0.5 * f["g"] * tau * tau]
            th = th0 + f["spin"] * tau
        else:
            mid = ((gl[0] + gr[0]) / 2, (gl[1] + gr[1]) / 2)
            tgt = gl if p["pivot"] < 0 else gr
            a = abs(p["pivot"])
            pv = (lerp(mid[0], tgt[0], a), lerp(mid[1], tgt[1], a))
            th = p["swing"] + self.sway(t, p["sway_amp"])
            d = dirv(th)
            neck = [pv[0] + d[0] * p["hang"], pv[1] + d[1] * p["hang"]]
            if p["tremble"]:
                neck[0] += p["tremble"] * noise(t, self.seed)
                neck[1] += p["tremble"] * 0.6 * noise(t, self.seed + 1.7)
        torso_a = th * 0.85 + p["lean"]

        # keep gripping hands on the bridge: pull the body up if an arm cannot reach
        if not falling:
            reach = (g["upper_arm"] + g["forearm"]) * 0.985
            for _ in range(2):
                for side, grip, w in ((-1, gl, p["grip_l"]), (1, gr, p["grip_r"])):
                    if w <= 0:
                        continue
                    sh = self._shoulder(neck, torso_a, side)
                    dx, dy = grip[0] - sh[0], grip[1] - sh[1]
                    dist = math.hypot(dx, dy)
                    if dist > reach:
                        k = (dist - reach) / dist * w
                        neck[0] += dx * k
                        neck[1] += dy * k

        dn, pr = dirv(torso_a), dirv(torso_a + math.pi / 2)
        neck = tuple(neck)
        hip = (neck[0] + dn[0] * g["torso"] * s, neck[1] + dn[1] * g["torso"] * s)
        hd = dirv(torso_a + math.pi + p["head_tilt"])
        hlen = (g["neck"] + g["head_r"]) * s
        head = (neck[0] + hd[0] * hlen, neck[1] + hd[1] * hlen)
        j = dict(p=p, s=s, th=th, torso_a=torso_a, neck=neck, hip=hip, head=head,
                 head_rot=-(torso_a + p["head_tilt"]), gl=gl, gr=gr)

        for side, sfx, grip in ((-1, "l", gl), (1, "r", gr)):
            sh = self._shoulder(neck, torso_a, side)
            a1 = torso_a + p["ua_" + sfx]
            el = (sh[0] + dirv(a1)[0] * g["upper_arm"], sh[1] + dirv(a1)[1] * g["upper_arm"])
            a2 = a1 + p["fa_" + sfx]
            ha = (el[0] + dirv(a2)[0] * g["forearm"], el[1] + dirv(a2)[1] * g["forearm"])
            w = 0.0 if falling else p["grip_" + sfx]
            if w > 0:
                el_ik, ha_ik = ik2(sh, grip, g["upper_arm"], g["forearm"], side)
                el = (lerp(el[0], el_ik[0], w), lerp(el[1], el_ik[1], w))
                ha = (lerp(ha[0], ha_ik[0], w), lerp(ha[1], ha_ik[1], w))
            j["sh_" + sfx], j["el_" + sfx], j["ha_" + sfx] = sh, el, ha

        # legs trail the swing a little (secondary motion)
        lag = 0.0
        if not falling:
            lag = 0.9 * (self.sway(t - 0.25, p["sway_amp"]) - self.sway(t, p["sway_amp"]))
            lag += 0.6 * (self.track.value("swing", t - 0.18) - p["swing"])
        for side, sfx in ((-1, "l"), (1, "r")):
            hp = (hip[0] + side * pr[0] * g["hip_w"], hip[1] + side * pr[1] * g["hip_w"])
            a1 = torso_a + p["th_" + sfx] + lag
            kn = (hp[0] + dirv(a1)[0] * g["thigh"] * s, hp[1] + dirv(a1)[1] * g["thigh"] * s)
            a2 = a1 + p["sh_" + sfx]
            sl = g["shin"] * s * p["shin_" + sfx]
            ft = (kn[0] + dirv(a2)[0] * sl, kn[1] + dirv(a2)[1] * sl)
            j["hp_" + sfx], j["kn_" + sfx], j["ft_" + sfx] = hp, kn, ft
        return j

    # ---- drawing ----------------------------------------------------------------
    def draw(self, ctx, j):
        if self.gone:
            return
        g, p, s = self.g, j["p"], j["s"]
        C = self.scene.colors
        cfg = self.scene.cfg
        # rim light comes from the sun
        sx, sy, _ = cfg["sun"]
        chest = (lerp(j["neck"][0], j["hip"][0], 0.4), lerp(j["neck"][1], j["hip"][1], 0.4))
        lx, ly = sx - chest[0], sy - chest[1]
        dist = math.hypot(lx, ly) or 1.0
        light = (lx / dist, ly / dist)
        strength = clamp(1.25 - dist / 1000, 0.62, 1.0)

        pts = [j[k] for k in JOINTS]
        x0 = min(q[0] for q in pts) - 60
        x1 = max(q[0] for q in pts) + 60
        y0 = min(q[1] for q in pts) - 60
        y1 = max(q[1] for q in pts) + 60
        ctx.save()
        if self.fall is not None:
            y1 = min(y1, cfg["water_y"])          # body disappears into the river
        if y1 <= y0:
            ctx.restore()
            return
        ctx.rectangle(x0, y0, x1 - x0, y1 - y0)
        ctx.clip()

        def shape(c, extra, ox, oy):
            c.save()
            c.translate(ox, oy)
            c.set_line_cap(cairo.LINE_CAP_ROUND)
            c.set_line_join(cairo.LINE_JOIN_ROUND)
            lw = g["limb_w"] + extra
            c.set_line_width(lw)
            for a, b, d in ((j["hp_l"], j["kn_l"], j["ft_l"]), (j["hp_r"], j["kn_r"], j["ft_r"]),
                            (j["sh_l"], j["el_l"], j["ha_l"]), (j["sh_r"], j["el_r"], j["ha_r"])):
                c.move_to(*a)
                c.line_to(*b)
                c.line_to(*d)
            c.move_to(*j["sh_l"])
            c.line_to(*j["sh_r"])
            c.stroke()
            c.set_line_width(g["torso_w"] + extra)
            c.move_to(*j["neck"])
            c.line_to(*j["hip"])
            c.stroke()
            for ha in (j["ha_l"], j["ha_r"]):
                c.arc(ha[0], ha[1], g["hand_r"] + extra / 2, 0, TAU)
                c.fill()
            c.save()
            c.translate(*j["head"])
            c.rotate(j["head_rot"])
            c.scale(1 / math.sqrt(s), s)
            c.arc(0, 0, g["head_r"] + extra / 2, 0, TAU)
            c.restore()
            c.fill()
            c.restore()

        # soft warm halo, thin rim offset toward the sun, then the solid black body
        ctx.push_group()
        ctx.set_source_rgb(*C["rim_halo"])
        shape(ctx, 7.0, 0, 0)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(0.15 * strength)
        ctx.push_group()
        ctx.set_source_rgb(*C["rim"])
        shape(ctx, 2.0, light[0] * 2.6, light[1] * 2.6)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(0.95 * strength)
        ctx.set_source_rgb(*C["stickman"])
        shape(ctx, 0.0, 0, 0)

        self._draw_eyes(ctx, j)
        if p["cut"] > 0:
            self._draw_cuts(ctx, j)
        ctx.restore()

    def _draw_eyes(self, ctx, j):
        p, s, r = j["p"], j["s"], self.g["head_r"]
        ctx.save()
        ctx.translate(*j["head"])
        ctx.rotate(j["head_rot"])
        ctx.scale(1 / math.sqrt(s), s)
        lx, ly = p["look_x"] * r * 0.2, p["look_y"] * r * 0.14
        rx = r * 0.165 * p["eye_w"]
        ry = max(0.7, r * 0.255 * p["eye_open"])
        for side in (-1, 1):
            ctx.save()
            ctx.translate(side * r * 0.37 + lx, -r * 0.04 + ly)
            ctx.rotate(side * p["eye_tilt"])
            if p["eye_lid"] > 0.001:
                y_lid = -ry + 2 * ry * p["eye_lid"]
                k = p["eye_slant"] * -side       # >0 slant: inner corner lower (angry)
                L = rx * 3
                ctx.move_to(-L, y_lid - k * L)
                ctx.line_to(L, y_lid + k * L)
                ctx.line_to(L, L * 4)
                ctx.line_to(-L, L * 4)
                ctx.close_path()
                ctx.clip()
            ctx.save()
            ctx.scale(rx, ry)
            ctx.arc(0, 0, 1, 0, TAU)
            ctx.restore()
            ctx.set_source_rgb(*self.scene.colors["eyes"])
            ctx.fill()
            ctx.restore()
        ctx.restore()

    def _draw_cuts(self, ctx, j):
        hx, hy = j["ha_r"]
        ctx.save()
        ctx.translate(hx, hy)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_width(2.8)
        ctx.set_source_rgba(*self.scene.colors["cut"], j["p"]["cut"])
        for (ax, ay), (bx, by) in (((-6.5, -3.5), (3.5, -7.0)), ((-5.0, 2.5), (6.5, -1.5)),
                                   ((-1.5, 7.0), (4.0, 5.0))):
            ctx.move_to(ax, ay)
            ctx.line_to(bx, by)
        ctx.stroke()
        ctx.restore()


# =============================================================================
# Roles: each one turns the story beats into keyframes for one stickman
# =============================================================================
def role_bored_drop(c, scene):
    b, tr = scene.beats, c.track
    t0, t1, t2 = b["bored"], b["bored_hand"], b["bored_drop"]
    d = t1 - t0
    c.blinks += [0.85, t0 + 0.55 * d]
    tr.ramp(t0, t0 + 0.4 * d, "inout", head_tilt=0.1, look_x=0.4, look_y=0.35, **EXPR["bored"])
    tr.ramp(t0, t0 + 0.6, "inout", kick=1.0, sway_amp=0.065)
    tr.ramp(t0 + 0.45 * d, t0 + 0.7 * d, "inout", look_x=-0.35, look_y=-0.15)
    tr.ramp(t0 + 0.75 * d, t1 - 0.03, "inout", look_x=0.15, look_y=0.4)
    # first one hand, casually...
    tr.ramp(t1, t1 + 0.32, "inout", pivot=-1, hang=114, kick=0.35)
    c.release(t1, +1, to=dict(ua_r=1.75, fa_r=1.1), dur=0.4, ease="inout")
    # ...then the other, dropping straight into the river
    c.release(t2, -1, to=dict(ua_l=-2.95, fa_l=0.15), dur=0.45)
    c.start_fall(t2, vx=8, vy=-20, spin=0.22)
    tr.ramp(t2, t2 + 0.45, "out", ua_r=2.9, fa_r=-0.2, kick=0.0, head_tilt=0.0, stretch=1.04,
            th_l=-0.05, sh_l=0.05, th_r=0.05, sh_r=-0.05)
    tr.ramp(t2 + 0.1, t2 + 0.7, "inout", label_dim=1.0)


def role_slip_fall(c, scene):
    b, tr = scene.beats, c.track
    ts, tsl, trg, tf = b["strain"], b["slip"], b["regrab"], b["fall"]
    c.blinks += [1.45, 3.1]
    c.splash_power = 1.65
    c.glance(b["bored_drop"] + 0.05, b["bored_drop"] + 0.6, "bored_drop", 0.6)
    # shaking hard, sweating, eyes squeezed
    tr.ramp(ts, ts + 0.25, "out", tremble=4.5, struggle=1.0, hang=108, sweat=7.0, sway_amp=0.03,
            **EXPR["strain"])
    # one hand slips off and flails...
    tr.ramp(tsl, tsl + 0.16, "out", pivot=-1, hang=116, stretch=1.06, swing=-0.1, **EXPR["panic"])
    tr.ramp(tsl + 0.16, tsl + 0.32, "inout", stretch=1.0)
    tr.ramp(tsl + 0.12, trg, "inout", pivot=-0.35, swing=0.1)
    c.release(tsl, +1, to=dict(ua_r=2.3, fa_r=0.7), dur=0.16)
    # ...grabs the bridge again
    c.grab(trg, +1, reach=trg - tsl - 0.16)
    tr.ramp(trg, trg + 0.22, "inout", pivot=0, swing=0, hang=108, **EXPR["strain"])
    tr.ramp(trg, trg + 0.08, "out", stretch=0.95)
    tr.ramp(trg + 0.08, trg + 0.3, "inout", stretch=1.0)
    # both hands slide off the edge: falls flailing
    tr.ramp(tf - 0.16, tf, "in", grip_dy=11, **EXPR["panic"])
    c.release(tf, -1, to=dict(ua_l=-2.5, fa_l=-0.3), dur=0.2)
    c.release(tf, +1, to=dict(ua_r=2.5, fa_r=0.3), dur=0.2)
    c.start_fall(tf, vx=-14, vy=-40, spin=-0.45)
    tr.ramp(tf, tf + 0.18, "out", flail=1.0, struggle=0, tremble=0, sweat=0, stretch=1.03)
    tr.ramp(tf + 0.1, tf + 0.7, "inout", label_dim=1.0)


def role_steady(c, scene):
    b, tr = scene.beats, c.track
    tr.key(0.0, "linear", sway_amp=0.02)
    c.blinks += [1.15, 3.7, 7.9, 11.3]
    # perfectly calm - only glances over
    c.glance(b["fall"] + 0.05, b["fall"] + 0.75, "slip_fall", 0.7)
    c.glance(b["crack"] + 0.15, b["crack"] + 1.35, "crack_recover", 0.75)
    c.glance(b["recover"] - 0.45, b["recover"] + 0.5, "crack_recover", 0.75)


def role_crack_recover(c, scene):
    b, tr = scene.beats, c.track
    tc, tb, ta, tp, trc, tt = b["crack"], b["break"], b["angry"], b["pull"], b["recover"], b["tight"]
    c.blinks += [1.75, 4.35]
    c.glance(b["fall"] + 0.1, b["fall"] + 0.65, "slip_fall", 0.5)
    scene.bridge.set_crack(c.gr0[0], tc, tb)
    # the plank cracks: startled look up at it
    tr.ramp(tc, tc + 0.1, "snap", tremble=0.8, look_x=0.5, look_y=-0.5, **EXPR["panic"])
    # it breaks: hand slips, body swings under the left hand
    tr.ramp(tb, tb + 0.28, "inout", pivot=-1, hang=114, sway_amp=0.0)
    tr.ramp(tb, tb + 0.1, "out", stretch=1.07)
    tr.ramp(tb + 0.1, tb + 0.45, "inout", stretch=1.0)
    for dt, a in ((0.32, -0.16), (0.72, 0.1), (1.12, -0.065), (1.55, 0.04), (2.0, -0.02), (2.5, 0.01)):
        tr.key(tb + dt, "sine", swing=a)
    c.release(tb, +1, to=dict(ua_r=1.7, fa_r=1.2), dur=0.16)
    tr.ramp(tb + 0.16, tb + 0.55, "inout", ua_r=0.6, fa_r=-0.4)
    tr.ramp(tb + 0.02, tb + 0.16, "out", cut=1.0)
    tr.ramp(tb + 0.04, tb + 0.14, "snap", look_x=0, look_y=0, **EXPR["strain"])
    tr.ramp(tb, tb + 0.3, "out", tremble=3.0, sweat=2.8, struggle=0.25)
    tr.key(tb + 0.5, "step", grip_r_dx=-scene.bridge.pitch)   # re-grab the next plank in
    # anger
    tr.ramp(ta, ta + 0.08, "snap", **EXPR["angry"])
    tr.ramp(ta, ta + 0.4, "inout", tremble=2.0, head_tilt=0.06, struggle=0.0)
    # pull up on the left arm while the injured arm reaches back to the bridge
    tr.ramp(tp, trc - 0.1, "inout", hang=92, swing=0.0)
    tr.ramp(tp, tp + 0.7, "inout", ua_r=2.0, fa_r=1.15)
    c.grab(trc, +1, reach=trc - (tp + 0.7))
    # hang tighter than before
    tr.ramp(trc, tt, "inout", pivot=0, hang=86, **POSES["tight_legs"])
    tr.ramp(trc, trc + 0.08, "out", stretch=0.95)
    tr.ramp(trc + 0.08, trc + 0.35, "inout", stretch=1.0)
    tr.ramp(trc, tt, "inout", tremble=1.3, sweat=1.2)


ROLES = {
    "bored_drop": role_bored_drop,
    "slip_fall": role_slip_fall,
    "steady": role_steady,
    "crack_recover": role_crack_recover,
}


# =============================================================================
# Scene
# =============================================================================
class Scene:
    W, H = 1080, 1920      # design space
    MARGIN = 280           # world drawn beyond the left/right frame edges (zoom, shake)
    VMARGIN = 160          # world drawn beyond the top/bottom frame edges (shake)
    PAD = 40               # extra width of the reflection for ripple offsets

    def __init__(self, cfg):
        self.cfg = cfg
        self.beats = cfg["beats"]
        C = {}
        for k, v in cfg["colors"].items():
            if isinstance(v, str):
                C[k] = rgb(v)
            elif k == "splinters":
                C[k] = v
            else:
                C[k] = tuple(rgb(x) for x in v)
        self.colors = C
        self.rng = random.Random(cfg["seed"])
        self.fonts = {k: resolve_font(cfg[k]) for k in
                      ("font_header", "font_label", "font_timer", "font_watermark")}
        self.events = []
        self.particles = Particles(self)
        self.bridge = Bridge(self)
        self.chars = [Stickman(self, i, spec) for i, spec in enumerate(cfg["characters"])]
        for c in self.chars:
            ROLES[c.role](c, self)
        self.events.sort(key=lambda e: (e[0], e[1]))
        self._build_background()

    def at(self, t, fn):
        self.events.append((t, len(self.events), fn))

    def find_role(self, role):
        return next((c for c in self.chars if c.role == role), None)

    # ---- simulation -------------------------------------------------------------
    def step(self, t, dt):
        while self.events and self.events[0][0] <= t + 1e-9:
            self.events.pop(0)[2]()
        for c in self.chars:
            c.joints = c.solve(t)
        wy = self.cfg["water_y"]
        r = self.g_head = self.cfg["stickman"]["head_r"]
        for c in self.chars:
            j = c.joints
            rate = j["p"]["sweat"]
            if rate > 0 and not c.gone:
                c.sweat_acc += rate * dt
                while c.sweat_acc >= 1:
                    c.sweat_acc -= 1
                    side = self.rng.choice((-1, 1))
                    hr = j["head_rot"]
                    ox, oy = side * r * 0.9, -r * 0.35
                    x = j["head"][0] + ox * math.cos(hr) - oy * math.sin(hr)
                    y = j["head"][1] + ox * math.sin(hr) + oy * math.cos(hr)
                    self.particles.sweat(x, y, side)
            if c.fall is None or t < c.fall["t0"] or c.gone:
                continue
            pts = [j[k] for k in JOINTS]
            low = max(pts, key=lambda q: q[1])
            top_y = min(q[1] for q in pts) - r
            if not c.splashed and low[1] >= wy:
                c.splashed = True
                self.particles.splash((low[0] + j["hip"][0]) / 2, wy, c.splash_power)
            elif c.splashed and top_y < wy:
                self.particles.spray(j["hip"][0], wy, c.splash_power)
            if c.splashed and top_y > wy + 20:
                c.gone = True
        self.particles.update(dt)

    # ---- static background ----------------------------------------------------
    def _build_background(self):
        cfg, C = self.cfg, self.colors
        W, M, Hz = self.W, self.MARGIN, cfg["horizon_y"]
        sx, sy, sr = cfg["sun"]

        V = self.VMARGIN

        def paint_sky(with_sun):
            surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W + 2 * M, Hz + V + 4)
            c = cairo.Context(surf)
            c.translate(M, V)
            grad = cairo.LinearGradient(0, 0, 0, Hz)
            for y, col in cfg["sky"]:
                grad.add_color_stop_rgb(clamp(y / Hz, 0, 1), *rgb(col))
            c.set_source(grad)
            c.rectangle(-M, -V, W + 2 * M, Hz + V + 4)
            c.fill()
            glow = cairo.RadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4.4)
            glow.add_color_stop_rgba(0.0, *C["sun_glow"], 0.6 if with_sun else 0.4)
            glow.add_color_stop_rgba(0.3, *C["sun_glow"], 0.25 if with_sun else 0.18)
            glow.add_color_stop_rgba(1.0, *C["sun_glow"], 0.0)
            c.set_source(glow)
            c.paint()
            if with_sun:
                halo = cairo.RadialGradient(sx, sy, sr * 0.96, sx, sy, sr * 1.25)
                halo.add_color_stop_rgba(0, *C["sun_edge"], 0.75)
                halo.add_color_stop_rgba(1, *C["sun_edge"], 0.0)
                c.set_source(halo)
                c.arc(sx, sy, sr * 1.25, 0, TAU)
                c.fill()
                disc = cairo.RadialGradient(sx - sr * 0.1, sy - sr * 0.2, 0, sx, sy, sr)
                disc.add_color_stop_rgb(0.0, *C["sun_core"])
                disc.add_color_stop_rgb(0.55, *mix(C["sun_core"], C["sun_edge"], 0.35))
                disc.add_color_stop_rgb(1.0, *C["sun_edge"])
                c.set_source(disc)
                c.arc(sx, sy, sr, 0, TAU)
                c.fill()
            rng = random.Random(cfg["seed"] + 5)
            far = [(-300, 150), (-150, 205), (130, 250), (300, 175), (430, 190), (600, 115),
                   (700, 70), (790, 48), (900, 92), (1060, 215), (1250, 165), (1400, 120)]
            near = [(-300, 70), (-200, 90), (60, 132), (300, 72), (520, 108), (700, 40), (840, 30),
                    (990, 112), (1200, 82), (1400, 60)]
            self._mountains(c, far, Hz, C["mount_far"], rng, 11)
            haze = cairo.LinearGradient(0, Hz - 110, 0, Hz)
            haze.add_color_stop_rgba(0, *C["sun_glow"], 0.0)
            haze.add_color_stop_rgba(1, *C["sun_glow"], 0.32)
            c.set_source(haze)
            c.rectangle(-M, Hz - 110, W + 2 * M, 114)
            c.fill()
            self._mountains(c, near, Hz, C["mount_near"], rng, 6)
            return surf

        self.sky = paint_sky(True)

        # mirrored, darkened copy for the river (ripples are applied per frame);
        # the sun itself shows up as a glitter column instead of a mirrored disc
        wh = self.H - Hz
        refl = cairo.ImageSurface(cairo.FORMAT_RGB24, W + 2 * M + 2 * self.PAD, wh + V)
        r = cairo.Context(refl)
        r.translate(self.PAD, 0)
        r.scale(1, -1 / 1.25)
        r.translate(0, -Hz)
        r.set_source_surface(paint_sky(False), 0, -V)
        r.get_source().set_extend(cairo.EXTEND_PAD)
        r.paint()
        r.identity_matrix()
        col = cairo.RadialGradient(0, 0, 0, 0, 0, 1)
        col.add_color_stop_rgba(0, *C["sun_edge"], 0.5)
        col.add_color_stop_rgba(0.45, *C["sun_glow"], 0.2)
        col.add_color_stop_rgba(1, *C["sun_glow"], 0.0)
        r.save()
        r.translate(self.PAD + M + sx, 0)
        r.scale(sr * 1.1, wh * 0.8)
        r.set_source(col)
        r.paint()
        r.restore()
        r.set_operator(cairo.OPERATOR_MULTIPLY)
        dark = cairo.LinearGradient(0, 0, 0, wh)
        dark.add_color_stop_rgb(0.0, 0.88, 0.78, 0.86)
        dark.add_color_stop_rgb(0.5, 0.7, 0.58, 0.74)
        dark.add_color_stop_rgb(1.0, 0.44, 0.36, 0.56)
        r.set_source(dark)
        r.paint()
        self.refl = refl

        rng = random.Random(cfg["seed"] + 9)
        self.glitter = []
        for _ in range(90):
            d = rng.random() ** 1.6
            self.glitter.append(dict(v=3 + d * wh * 0.7, x=rng.gauss(0, 0.8) * (14 + 140 * d),
                                     w=rng.uniform(8, 30) + 120 * d * rng.random(),
                                     ph=rng.uniform(0, TAU), a=rng.uniform(0.35, 0.85) * (1 - 0.55 * d)))
        self.streaks = []
        for _ in range(26):
            d = rng.random()
            self.streaks.append(dict(v=wh * d ** 1.3, x=rng.uniform(-M, W + M),
                                     w=rng.uniform(60, 260) * (0.4 + d), ph=rng.uniform(0, TAU),
                                     light=rng.random() < 0.55))

    def _mountains(self, c, ctrl, base_y, colors, rng, rough):
        M = self.MARGIN
        pts = []
        x = -M - 20
        while x <= self.W + M + 20:
            for (xa, ha), (xb, hb) in zip(ctrl, ctrl[1:]):
                if xa <= x <= xb:
                    u = (x - xa) / (xb - xa)
                    h = lerp(ha, hb, 0.5 - 0.5 * math.cos(math.pi * u))
                    break
            else:
                h = ctrl[-1][1]
            pts.append((x, base_y - h - rng.uniform(-1, 1) * rough))
            x += 9
        c.move_to(-M - 20, base_y + 4)
        for q in pts:
            c.line_to(*q)
        c.line_to(self.W + M + 20, base_y + 4)
        c.close_path()
        top_y = min(q[1] for q in pts)
        g = cairo.LinearGradient(0, top_y, 0, base_y)
        g.add_color_stop_rgb(0, *colors[0])
        g.add_color_stop_rgb(1, *colors[1])
        c.set_source(g)
        c.fill()

    # ---- frame drawing ----------------------------------------------------------
    def camera(self, t):
        z = self.cfg["zoom"]
        u = EASE["inout"](clamp((t - z["start"]) / (z["end"] - z["start"]), 0, 1))
        tgt = self.find_role(z["target"])
        if tgt is None:
            return 1.0, (540, 960), (540, 960)
        focus = (tgt.x - 25, self.cfg["bridge_y"] + 175)
        scr = (lerp(focus[0], z["screen"][0], u), lerp(focus[1], z["screen"][1], u))
        return lerp(1.0, z["scale"], u), focus, scr

    def render(self, ctx, t, shake=(0.0, 0.0)):
        zoom, focus, scr = self.camera(t)
        ctx.save()
        ctx.translate(*shake)            # screen shake moves the world, not the text overlay
        ctx.translate(*scr)
        ctx.scale(zoom, zoom)
        ctx.translate(-focus[0], -focus[1])
        ctx.set_source_surface(self.sky, -self.MARGIN, -self.VMARGIN)
        ctx.paint()
        self._draw_birds(ctx, t)
        self._draw_water(ctx, t)
        self.bridge.draw(ctx, t)
        self.particles.draw(ctx, "back")
        for c in self.chars:
            c.draw(ctx, c.joints)
        self.particles.draw(ctx, "surface")
        self.particles.draw(ctx, "front")
        self._draw_labels(ctx)
        ctx.restore()
        self._draw_header(ctx, t)
        self._draw_timer(ctx, t)
        self._draw_watermark(ctx)

    def _draw_water(self, ctx, t):
        Hz, W, M, C = self.cfg["horizon_y"], self.W, self.MARGIN, self.colors
        wh = self.H - Hz
        ctx.save()
        ctx.rectangle(-M, Hz, W + 2 * M, wh + self.VMARGIN)
        ctx.clip()
        strip = 3
        for v in range(0, wh + self.VMARGIN, strip):
            d = v / wh
            amp = 1.0 + 11.0 * d ** 1.5
            dx = amp * (0.65 * math.sin(0.05 * v - 1.6 * t) + 0.35 * math.sin(0.017 * v + 1.1 * t + 0.8))
            ctx.set_source_surface(self.refl, -M - self.PAD + dx, Hz)
            ctx.rectangle(-M, Hz + v, W + 2 * M, strip + 1)
            ctx.fill()
        # slow shimmer streaks
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        for s in self.streaks:
            d = s["v"] / wh
            x = s["x"] + 14 * math.sin(0.35 * t + s["ph"])
            a = (0.05 + 0.06 * d) * (0.6 + 0.4 * math.sin(0.9 * t + s["ph"]))
            ctx.move_to(x - s["w"] / 2, Hz + s["v"])
            ctx.line_to(x + s["w"] / 2, Hz + s["v"])
            ctx.set_line_width(1.5 + 2.5 * d)
            col = C["glitter"] if s["light"] else (0.08, 0.02, 0.12)
            ctx.set_source_rgba(*col, a * (1.3 if not s["light"] else 1.0))
            ctx.stroke()
        # sun glitter column
        sx = self.cfg["sun"][0]
        for gl in self.glitter:
            d = gl["v"] / wh
            x = sx + gl["x"] + (3 + 8 * d) * math.sin(0.8 * t + gl["ph"])
            w = gl["w"] * (0.75 + 0.25 * math.sin(1.1 * t + 2 * gl["ph"]))
            a = gl["a"] * (0.6 + 0.4 * math.sin(1.4 * t + gl["ph"]))
            ctx.move_to(x - w / 2, Hz + gl["v"])
            ctx.line_to(x + w / 2, Hz + gl["v"])
            ctx.set_line_width(1.6 + 2.6 * d)
            ctx.set_source_rgba(*C["glitter"], a)
            ctx.stroke()
        ctx.restore()
        # thin bright horizon line
        ctx.move_to(-M, Hz + 0.5)
        ctx.line_to(W + M, Hz + 0.5)
        ctx.set_line_width(1.5)
        ctx.set_source_rgba(*C["sun_glow"], 0.45)
        ctx.stroke()

    def _draw_birds(self, ctx, t):
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        for i, (x0, y0, vx, span, hz) in enumerate(self.cfg["birds"]):
            x = x0 + vx * t
            y = y0 + 4 * math.sin(0.8 * t + i * 1.7)
            f = math.sin(TAU * hz * t + i * 2.3)
            s = span / 2
            tip = y - s * (0.05 + 0.45 * f)
            mid = y - s * (0.42 - 0.12 * f)
            ctx.move_to(x - s, tip)
            ctx.curve_to(x - s * 0.7, mid, x - s * 0.3, mid, x, y)
            ctx.curve_to(x + s * 0.3, mid, x + s * 0.7, mid, x + s, tip)
            ctx.set_line_width(max(2.0, span * 0.11))
            ctx.set_source_rgb(*self.colors["bird"])
            ctx.stroke()

    def _set_font(self, ctx, key, size):
        fam, weight = self.fonts[key]
        ctx.select_font_face(fam, cairo.FONT_SLANT_NORMAL, weight)
        ctx.set_font_size(size)

    def _draw_labels(self, ctx):
        cfg, C = self.cfg, self.colors
        slots = cfg["slots"]
        spacing = (slots[-1] - slots[0]) / max(1, len(slots) - 1) if len(slots) > 1 else 400
        size = cfg["label_size"]
        self._set_font(ctx, "font_label", size)
        widest = max(ctx.text_extents(c.label).width for c in self.chars)
        size = size * min(1.0, (spacing - 26) / widest)
        self._set_font(ctx, "font_label", size)
        y = cfg["bridge_y"] - 19
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        for c in self.chars:
            dim = c.joints["p"]["label_dim"]
            ext = ctx.text_extents(c.label)
            x = c.x - ext.width / 2 - ext.x_bearing
            ctx.move_to(x, y)
            ctx.text_path(c.label)
            ctx.set_line_width(7)
            ctx.set_source_rgba(*C["label_outline"], 0.6 * (1 - 0.4 * dim))
            ctx.stroke_preserve()
            ctx.set_source_rgba(*mix(C["label"], C["label_dead"], dim), 1 - 0.15 * dim)
            ctx.fill()

    def _draw_header(self, ctx, t):
        cfg, C = self.cfg, self.colors
        text = cfg["header_text"].upper()
        size = cfg["header_size"]
        self._set_font(ctx, "font_header", size)
        ext = ctx.text_extents(text)
        fh = size * 0.88
        fw = fh * 0.7
        gap = size * 0.16
        x = self.W / 2 - (ext.width + gap + fw) / 2
        y = cfg["header_y"]
        ctx.move_to(x - ext.x_bearing, y)
        ctx.set_source_rgb(*C["header"])
        ctx.show_text(text)
        self._draw_flame(ctx, x + ext.width + gap + fw / 2, y + 2, fh, t)

    def _draw_flame(self, ctx, cx, base, h, t):
        C = self.colors
        k = h / 124.0
        flick = 1 + 0.035 * math.sin(TAU * 2.1 * t) + 0.02 * math.sin(TAU * 3.7 * t + 1)
        lean = 0.05 * math.sin(TAU * 1.6 * t)
        ctx.save()
        ctx.translate(cx, base)
        ctx.scale(k, k * flick)
        ctx.transform(cairo.Matrix(1, 0, -lean, 1, 0, 0))
        ctx.move_to(0, 0)
        ctx.curve_to(-27, 0, -43, -18, -43, -42)
        ctx.curve_to(-43, -62, -31, -74, -27, -94)
        ctx.curve_to(-18, -82, -12, -77, -8, -70)
        ctx.curve_to(-6, -90, 2, -107, 15, -124)
        ctx.curve_to(17, -105, 31, -92, 37, -75)
        ctx.curve_to(45, -58, 43, -30, 39, -22)
        ctx.curve_to(33, -8, 19, 0, 0, 0)
        ctx.close_path()
        g = cairo.LinearGradient(0, 0, 0, -124)
        g.add_color_stop_rgb(0, *C["flame_outer"][0])
        g.add_color_stop_rgb(1, *C["flame_outer"][1])
        ctx.set_source(g)
        ctx.fill()
        ctx.move_to(2, -5)
        ctx.curve_to(-14, -5, -23, -17, -23, -31)
        ctx.curve_to(-23, -45, -13, -56, -6, -67)
        ctx.curve_to(-2, -56, 6, -51, 10, -59)
        ctx.curve_to(19, -47, 23, -36, 21, -26)
        ctx.curve_to(19, -13, 12, -5, 2, -5)
        ctx.close_path()
        g = cairo.LinearGradient(0, -5, 0, -67)
        g.add_color_stop_rgb(0, *C["flame_inner"][0])
        g.add_color_stop_rgb(1, *C["flame_inner"][1])
        ctx.set_source(g)
        ctx.fill()
        ctx.restore()

    def timer_text(self, t):
        keys = self.cfg["timer_keys"]
        v = keys[-1][1]
        if t <= keys[0][0]:
            v = keys[0][1]
        for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
            if t0 <= t < t1:
                v = lerp(v0, v1, (t - t0) / (t1 - t0))
                break
        v = int(v + 1e-6)
        plus = "+" if t >= self.cfg["timer_plus_from"] else ""
        return f"{v // 60}:{v % 60:02d}", plus

    def _draw_timer(self, ctx, t):
        cfg = self.cfg
        main, plus = self.timer_text(t)
        self._set_font(ctx, "font_timer", cfg["timer_size"])
        w = ctx.text_extents(main).x_advance
        ctx.move_to(self.W / 2 - w / 2, cfg["timer_y"])
        ctx.set_source_rgb(*self.colors["timer"])
        ctx.show_text(main + plus)

    def _draw_watermark(self, ctx):
        cfg = self.cfg
        self._set_font(ctx, "font_watermark", cfg["watermark_size"])
        ext = ctx.text_extents(cfg["watermark"])
        ctx.move_to(self.W / 2 - ext.width / 2 - ext.x_bearing, cfg["watermark_y"])
        ctx.set_source_rgba(*self.colors["watermark"], cfg["watermark_alpha"])
        ctx.show_text(cfg["watermark"])


# =============================================================================
# Rendering: frames -> ffmpeg, contact sheet, stills
# =============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def asset_path(name):
    return name if os.path.isabs(name) else os.path.join(BASE_DIR, name)


class ShakeTrack:
    """Per-frame screen offsets (design px), e.g. measured from a reference edit."""

    def __init__(self, cfg):
        self.frames, self.fps = [], 30
        if cfg.get("shake_file"):
            with open(asset_path(cfg["shake_file"])) as f:
                data = json.load(f)
            self.frames, self.fps = data["frames"], data["fps"]
        self.offset = cfg.get("shake_offset", 0.0)
        self.strength = cfg.get("shake_strength", 1.0)

    def at(self, t):
        i = int(round((t - self.offset) * self.fps))
        if 0 <= i < len(self.frames):
            dx, dy = self.frames[i]
            return dx * self.strength, dy * self.strength
        return 0.0, 0.0


class Renderer:
    def __init__(self, cfg):
        self.cfg = cfg
        self.W, self.H, self.fps = cfg["width"], cfg["height"], cfg["fps"]
        self.surface = cairo.ImageSurface(cairo.FORMAT_RGB24, self.W, self.H)
        self.ctx = cairo.Context(self.surface)
        self.scene = Scene(cfg)
        self.shake = ShakeTrack(cfg)
        self.n_story = int(round(cfg["duration"] * self.fps))   # frame n_story is t = duration
        self.n_total = self.n_story + max(1, int(round(cfg["hold_end"] * self.fps)))

    def frame_time(self, i):
        return min(i / self.fps, self.cfg["duration"])

    def draw(self, t, t_video):
        ctx = self.ctx
        ctx.save()
        ctx.scale(self.W / Scene.W, self.H / Scene.H)
        self.scene.render(ctx, t, self.shake.at(t_video))
        ctx.restore()
        self.surface.flush()

    def run(self, want=None):
        """Step the simulation through every frame; draw the ones in `want` (None = all).
        Frames after the story are the frozen final frame (the shake keeps running)."""
        dt = 1.0 / self.fps
        for i in range(self.n_total):
            t = self.frame_time(i)
            if i <= self.n_story:
                self.scene.step(t, dt)
            if want is None or i in want:
                self.draw(t, i / self.fps)
                yield i, i / self.fps


def safe_zone_overlay(ctx, cfg):
    W, H = Scene.W, Scene.H
    ctx.save()
    ctx.set_dash([18, 12])
    ctx.set_line_width(3)
    ctx.set_source_rgba(0.3, 1.0, 0.6, 0.85)
    ctx.rectangle(cfg["safe_side"], cfg["safe_top"], W - 2 * cfg["safe_side"],
                  H - cfg["safe_top"] - cfg["safe_bottom"])
    ctx.stroke()
    ctx.restore()


def render_contact_sheet(cfg, out_path):
    r = Renderer(cfg)
    step, cols = cfg["sheet_step"], cfg["sheet_columns"]
    times = [k * step for k in range((r.n_total - 1) // int(round(step * r.fps)) + 1)]
    want = {int(round(t * r.fps)): t for t in times}
    tw = 270
    th = int(round(tw * r.H / r.W))
    pad, cap, head = 14, 40, 86
    rows = math.ceil(len(times) / cols)
    sw, sh = cols * tw + (cols + 1) * pad, head + rows * (th + cap + pad) + pad
    sheet = cairo.ImageSurface(cairo.FORMAT_RGB24, sw, sh)
    sc = cairo.Context(sheet)
    sc.set_source_rgb(0.09, 0.09, 0.1)
    sc.paint()
    sc.select_font_face("sans-serif", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    sc.set_font_size(30)
    sc.set_source_rgb(1, 1, 1)
    sc.move_to(pad, 48)
    sc.show_text("Stickman Bridge Revenge - contact sheet (1 frame / %.1fs)" % step)
    sc.set_font_size(19)
    sc.set_source_rgb(0.55, 0.95, 0.7)
    sc.move_to(pad, 74)
    sc.show_text("dashed green = Instagram safe zone (sheet only, not in the video)")
    k = 0
    for i, t in r.run(set(want)):
        row, col = divmod(k, cols)
        x = pad + col * (tw + pad)
        y = head + row * (th + cap + pad)
        sc.save()
        sc.translate(x, y)
        sc.scale(tw / r.W, th / r.H)
        sc.set_source_surface(r.surface, 0, 0)
        sc.get_source().set_filter(cairo.FILTER_GOOD)
        sc.paint()
        sc.scale(r.W / Scene.W, r.H / Scene.H)
        safe_zone_overlay(sc, cfg)
        sc.restore()
        sc.set_source_rgb(0.85, 0.85, 0.88)
        sc.select_font_face("monospace", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        sc.set_font_size(22)
        sc.move_to(x + 4, y + th + 28)
        sc.show_text("t = %5.2fs" % t)
        k += 1
    sheet.write_to_png(out_path)
    return out_path


def render_video(cfg, out_path):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")
    r = Renderer(cfg)
    pix = "bgr0" if sys.byteorder == "little" else "0rgb"   # cairo RGB24 memory layout
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", pix, "-s", f"{r.W}x{r.H}", "-r", str(r.fps), "-i", "-"]
    audio = cfg.get("audio")
    if audio:
        cmd += ["-i", asset_path(audio)]
    cmd += ["-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(cfg["crf"]), "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    if audio:   # pad the audio with silence if it is shorter, end with the video
        cmd += ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-af", "apad", "-shortest"]
    else:
        cmd += ["-an"]
    cmd += ["-movflags", "+faststart", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t_start = time.time()
    written = 0
    for i, t in r.run():
        proc.stdin.write(bytes(r.surface.get_data()))
        written += 1
        if i % 30 == 0:
            print(f"  frame {written}/{r.n_total}  t={t:5.2f}s  ({time.time() - t_start:5.1f}s)", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"  wrote {written} frames ({written / r.fps:.2f}s) in {time.time() - t_start:.1f}s")
    return out_path


def render_still(cfg, t_still, out_path):
    r = Renderer(cfg)
    target = int(clamp(round(t_still * r.fps), 0, r.n_total - 1))
    for _ in r.run({target}):
        pass
    r.surface.write_to_png(out_path)
    return out_path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", action="store_true", help="render the contact sheet only")
    ap.add_argument("--video", action="store_true", help="render the MP4 only")
    ap.add_argument("--frame", type=float, help="render one PNG still at this time (s)")
    ap.add_argument("--out-dir", default=BASE_DIR)
    args = ap.parse_args()
    cfg = CONFIG
    os.makedirs(args.out_dir, exist_ok=True)
    if args.frame is not None:
        path = os.path.join(args.out_dir, "frame_%05.2f.png" % args.frame)
        print("still:", render_still(cfg, args.frame, path))
        return
    do_sheet = args.sheet or not args.video
    do_video = args.video or not args.sheet
    if do_sheet:
        print("contact sheet:", render_contact_sheet(cfg, os.path.join(args.out_dir, cfg["output_sheet"])))
    if do_video:
        print("rendering video...")
        print("video:", render_video(cfg, os.path.join(args.out_dir, cfg["output_video"])))


if __name__ == "__main__":
    main()
