"""Generates bottle_puzzle_solution.mp4 - animated solution of the bottle volume puzzle."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, FFMpegWriter
from matplotlib.patches import Polygon, Rectangle
from matplotlib.transforms import Affine2D
import imageio_ffmpeg

plt.rcParams["animation.ffmpeg_path"] = imageio_ffmpeg.get_ffmpeg_exe()

FPS = 30
H, BODY, SHOULDER = 27, 18, 21          # bottle height, body top, shoulder top (cm)
LIQ_UP, LIQ_DOWN = 14, 19               # liquid heights upright / upside-down
AIR = H - LIQ_DOWN                      # 8 cm air gap
ANSWER = 750 * LIQ_UP / (LIQ_UP + AIR)  # 477.27 cm^3

RED, GLASS, CAP, AIRC = "#e8553a", "#dfe9f5", "#3f7fbf", "#9fc9ff"

# Scene timings (seconds)
T = dict(intro=3, fill=3, flip=3, air=4, combine=5, answer=6)
starts, t0 = {}, 0
for k, v in T.items():
    starts[k] = t0; t0 += v
TOTAL = t0

bottle_xy = [(-4, 0), (4, 0), (4, BODY), (1.5, SHOULDER), (1.5, H), (-1.5, H),
             (-1.5, SHOULDER), (-4, BODY)]

fig = plt.figure(figsize=(12.8, 7.2), dpi=100, facecolor="black")
ax = fig.add_axes([0.02, 0.05, 0.42, 0.9]); ax.set_facecolor("black")
tx = fig.add_axes([0.46, 0.05, 0.52, 0.9]); tx.set_facecolor("black")
for a in (ax, tx):
    a.set_xticks([]); a.set_yticks([])
    for s in a.spines.values(): s.set_visible(False)
ax.set_xlim(-12, 12); ax.set_ylim(-3, 30); ax.set_aspect("equal")
tx.set_xlim(0, 10); tx.set_ylim(0, 10)


def ease(p):
    p = min(max(p, 0), 1)
    return p * p * (3 - 2 * p)


def phase(name, t):
    return (t - starts[name]) / T[name]


def draw_bottle(angle, liquid_rect, liquid_alpha=1.0, air_rect=None):
    tr = Affine2D().rotate_deg_around(0, H / 2, angle) + ax.transData
    body = Polygon(bottle_xy, closed=True, fc=GLASS, ec="white", lw=2, transform=tr)
    ax.add_patch(body)
    cap = Rectangle((-1.6, H - 1.2), 3.2, 1.2, fc=CAP, ec="none", transform=tr)
    ax.add_patch(cap)
    if air_rect is not None:
        y0, y1 = air_rect
        a = Rectangle((-5, y0), 10, y1 - y0, fc=AIRC, alpha=0.8, transform=tr)
        a.set_clip_path(body); ax.add_patch(a)
    if liquid_rect is not None:
        y0, y1 = liquid_rect
        liq = Rectangle((-5, y0), 10, y1 - y0, fc=RED, alpha=liquid_alpha, transform=tr)
        liq.set_clip_path(body); ax.add_patch(liq)
    ax.add_patch(Polygon(bottle_xy, closed=True, fill=False, ec="white", lw=2, transform=tr))


def dim(x, y0, y1, label, color="white", right=False):
    ax.annotate("", (x, y0), (x, y1), arrowprops=dict(arrowstyle="|-|", color=color, lw=2))
    ax.text(x + 0.6 if right else x - 0.6, (y0 + y1) / 2, label, color=color, fontsize=16,
            ha="left" if right else "right", va="center", fontweight="bold")


def text(y, s, size=20, color="white", alpha=1.0, **kw):
    tx.text(0.2, y, s, color=color, fontsize=size, alpha=alpha, va="center", **kw)


def frame(i):
    t = i / FPS
    ax.clear(); tx.clear()
    ax.set_xlim(-12, 12); ax.set_ylim(-3, 30); ax.set_aspect("equal"); ax.axis("off")
    tx.set_xlim(0, 10); tx.set_ylim(0, 10); tx.axis("off")

    text(9.4, "Bottle Volume Puzzle", 28, "#ffcc66", fontweight="bold")

    if t < starts["fill"]:                       # intro
        draw_bottle(0, None)
        dim(-6, 0, H, "27 cm")
        ax.text(0, -1.8, "width 8 cm", color="white", ha="center", fontsize=14)
        a = ease(phase("intro", t) * 2)
        text(7.8, "Full bottle holds 750 cm³", 22, alpha=a)
        text(6.9, "Height = 27 cm", 20, alpha=a)
        text(5.6, "How much liquid is inside?", 22, "#ff8866", alpha=ease(phase("intro", t) * 2 - 1))

    elif t < starts["flip"]:                     # fill upright
        p = ease(phase("fill", t))
        draw_bottle(0, (0, LIQ_UP * p))
        dim(-6, 0, LIQ_UP * p, f"{LIQ_UP * p:.0f} cm", RED)
        text(7.8, "Step 1: Bottle standing up", 22)
        text(6.9, "Liquid height = 14 cm", 20, RED, alpha=p)
        text(6.0, "(the bottom part is a perfect cylinder)", 16, "#bbbbbb", alpha=p)

    elif t < starts["air"]:                      # flip
        p = ease(phase("flip", t))
        ang = 180 * p
        up_alpha, down_alpha = max(0, 1 - 2 * p), max(0, 2 * p - 1)
        draw_bottle(ang, (0, LIQ_UP), up_alpha)
        if down_alpha > 0:
            draw_bottle(ang, (AIR, H), down_alpha)
        text(7.8, "Step 2: Turn it upside down", 22)
        text(6.9, "Same liquid, it now fills the neck", 18, alpha=p)
        if p >= 1:
            dim(-6, 0, LIQ_DOWN, "19 cm", RED)

    elif t < starts["combine"]:                  # air gap
        p = ease(phase("air", t) * 1.5)
        draw_bottle(180, (AIR, H), air_rect=(0, AIR))
        dim(-6, 0, LIQ_DOWN, "19 cm", RED)
        dim(6.8, LIQ_DOWN, H, "8 cm", AIRC, right=True)
        text(7.8, "Step 3: Look at the air", 22)
        text(6.9, "Air gap = 27 − 19 = 8 cm", 20, AIRC, alpha=p)
        text(5.9, "The air is in the cylinder part too!", 18, alpha=ease(phase("air", t) * 1.5 - 0.5))

    else:                                        # combine & answer
        pc = ease(phase("combine", t) * 1.3)
        # stacked equivalent cylinder: liquid 14 + air 8 = 22 cm
        ax.add_patch(Rectangle((-4, 0), 8, LIQ_UP, fc=RED, ec="white", lw=2))
        ax.add_patch(Rectangle((-4, LIQ_UP), 8, AIR * pc, fc=AIRC, ec="white", lw=2))
        dim(-6, 0, LIQ_UP, "14 cm", RED)
        if pc > 0.05:
            dim(6.8, LIQ_UP, LIQ_UP + AIR * pc, "8 cm", AIRC, right=True)
        ax.text(0, -1.8, "equivalent cylinder", color="#bbbbbb", ha="center", fontsize=14)
        text(7.8, "Step 4: Liquid + air = whole bottle", 21)
        text(6.9, "14 cm + 8 cm = 22 cm  ↔  750 cm³", 20, alpha=pc)
        if t >= starts["answer"]:
            pa = ease(phase("answer", t) * 2)
            text(5.8, "Liquid = 750 × 14 / 22", 22, "#ffffff", alpha=pa)
            text(4.4, f"Liquid ≈ {ANSWER:.1f} cm³", 32, "#ffcc66", alpha=ease(phase("answer", t) * 2 - 0.6),
                 fontweight="bold")
            text(3.2, "(about 64% of the bottle)", 16, "#bbbbbb", alpha=ease(phase("answer", t) * 2 - 1))


anim = FuncAnimation(fig, frame, frames=int(TOTAL * FPS))
anim.save("bottle_puzzle_solution.mp4", writer=FFMpegWriter(fps=FPS, bitrate=2500,
          extra_args=["-pix_fmt", "yuv420p", "-vcodec", "libx264"]))
print("saved", TOTAL, "s")
