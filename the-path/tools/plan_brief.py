"""Phase 1 planning tool for THE PATH.

Validates brief/timeline.json and brief/camera_16x9.json, solves the camera
flight (C2 quintic Hermite through the keys), renders the planning diagrams
and injects frame-exact tables into BRIEF.md between <!-- GEN:name --> markers.

Pillow + NumPy only. Run:  python3 the-path/tools/plan_brief.py
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRIEF = ROOT / "brief"
OUT = BRIEF / "diagrams"
FPS = 60
W, H = 1920, 1080
G = 9810.0  # world units per s^2 treated as 1 g (1 unit ~ 1 mm) for auto-bank

FONT_DIR = Path("/usr/share/fonts/opentype/inter")
SCENE_COLORS = {
    "S1": (88, 204, 2), "S2": (137, 226, 25), "S3": (28, 176, 246), "S4": (255, 150, 0),
    "S5": (255, 200, 0), "S6": (206, 130, 255), "S7": (88, 204, 2), "S8": (240, 240, 240),
    "S9": (137, 226, 25), "S10": (120, 140, 150),
}
LAYER_COLORS = {
    "hero": (255, 200, 0), "impact": (255, 120, 60), "whoosh": (28, 176, 246), "ui": (200, 210, 215),
    "path": (88, 204, 2), "character": (206, 130, 255), "texture": (120, 160, 170), "text": (240, 240, 240),
}
BG = (6, 10, 12)
PANEL = (19, 31, 36)
GRID = (55, 70, 79)
INK = (226, 232, 235)
DIM = (130, 145, 152)

# Phase 1 estimates of the natural read per VO segment (s); used only until a segment
# carries "measured" times from the edited take (tools/vo_edit.py).
VO_EST = {1: 2.20, 2: 1.00, 3: 1.65, 4: 1.30, 5: 2.25, 6: 2.45, 7: 1.30, 8: 0.62}


def frame_of(t: float) -> int:
    return int(round(t * FPS + 1e-9))


def load():
    tl = json.loads((BRIEF / "timeline.json").read_text(encoding="utf-8"))
    cam = json.loads((BRIEF / "camera_16x9.json").read_text(encoding="utf-8"))
    return tl, cam


# ----------------------------------------------------------------- timeline

def resolve_timeline(tl):
    problems = []
    scenes = []
    for s in tl["scenes"]:
        f0, f1 = frame_of(s["t0"]), frame_of(s["t1"])
        scenes.append({**s, "f0": f0, "f1": f1})
    for a, b in zip(scenes, scenes[1:]):
        if a["f1"] != b["f0"]:
            problems.append(f"scene gap/overlap between {a['id']} and {b['id']}")
    if scenes[0]["f0"] != 0 or scenes[-1]["f1"] != tl["total_frames"]:
        problems.append("scenes do not span 0..total_frames")

    by_id = {s["id"]: s for s in scenes}
    events = []
    for e in tl["events"]:
        f = e["f"] if "f" in e else frame_of(e["t"])
        t = e.get("t", f / FPS)
        sc = by_id[e["scene"]]
        if not (sc["f0"] <= f < sc["f1"]):
            problems.append(f"event {e['id']} f{f} outside {sc['id']} [{sc['f0']},{sc['f1']})")
        events.append({**e, "f": f, "t": t})
    events.sort(key=lambda e: (e["f"], e["id"]))

    sfx = []
    for c in tl["sfx"]:
        sc = by_id[c["scene"]]
        if not (sc["f0"] <= c["f"] < sc["f1"]):
            problems.append(f"sfx {c['n']} {c['name']} f{c['f']} outside {sc['id']}")
        sfx.append({**c, "t": c["f"] / FPS, "sample": c["f"] * tl["samples_per_frame"]})

    vo = []
    for seg in tl["vo"]["segments"]:
        f = frame_of(seg["anchor_t"])
        m = seg.get("measured")
        est_end = m["end_t"] if m else seg["anchor_t"] + VO_EST[seg["n"]]
        if m and m["onset_f"] != f:
            problems.append(f"VO segment {seg['n']} measured onset f{m['onset_f']} is not on its anchor f{f}")
        if est_end > seg["must_end_before_t"]:
            problems.append(f"VO segment {seg['n']} {'measured' if m else 'estimated'} end {est_end:.2f}s > {seg['must_end_before_t']}s")
        vo.append({**seg, "f": f, "est_end_t": est_end})
    for a, b in zip(vo, vo[1:]):
        if a["est_end_t"] >= b["anchor_t"]:
            problems.append(f"VO segments {a['n']}/{b['n']} overlap (estimate)")

    # hero cues must sit in VO gaps (measured once Phase 3 has locked the take)
    for h in tl["hero_audio"]:
        t = h["f"] / FPS
        for seg in vo:
            if seg["anchor_t"] - 0.02 < t < seg["est_end_t"]:
                problems.append(f"hero cue {h['id']} at {t:.2f}s overlaps VO segment {seg['n']} (estimate)")
    return scenes, events, sfx, vo, problems


# ------------------------------------------------------------------- camera

def _hermite5(p0, v0, a0, p1, v1, a1, T, u):
    """Quintic Hermite on [0, T] evaluated at normalized u in [0,1]. Returns p, v, a."""
    u = np.asarray(u, dtype=float)[:, None]
    u2, u3, u4, u5 = u * u, u ** 3, u ** 4, u ** 5
    h0 = 1 - 10 * u3 + 15 * u4 - 6 * u5
    h1 = u - 6 * u3 + 8 * u4 - 3 * u5
    h2 = 0.5 * u2 - 1.5 * u3 + 1.5 * u4 - 0.5 * u5
    h3 = 0.5 * u3 - u4 + 0.5 * u5
    h4 = -4 * u3 + 7 * u4 - 3 * u5
    h5 = 10 * u3 - 15 * u4 + 6 * u5
    p = h0 * p0 + h1 * (v0 * T) + h2 * (a0 * T * T) + h3 * (a1 * T * T) + h4 * (v1 * T) + h5 * p1
    d0 = -30 * u2 + 60 * u3 - 30 * u4
    d1 = 1 - 18 * u2 + 32 * u3 - 15 * u4
    d2 = u - 4.5 * u2 + 6 * u3 - 2.5 * u4
    d3 = 1.5 * u2 - 4 * u3 + 2.5 * u4
    d4 = -12 * u2 + 28 * u3 - 15 * u4
    d5 = 30 * u2 - 60 * u3 + 30 * u4
    v = (d0 * p0 + d1 * (v0 * T) + d2 * (a0 * T * T) + d3 * (a1 * T * T) + d4 * (v1 * T) + d5 * p1) / T
    e0 = -60 * u + 180 * u2 - 120 * u3
    e1 = -36 * u + 96 * u2 - 60 * u3
    e2 = 1 - 9 * u + 18 * u2 - 10 * u3
    e3 = 3 * u - 12 * u2 + 10 * u3
    e4 = -24 * u + 84 * u2 - 60 * u3
    e5 = 60 * u - 180 * u2 + 120 * u3
    a = (e0 * p0 + e1 * (v0 * T) + e2 * (a0 * T * T) + e3 * (a1 * T * T) + e4 * (v1 * T) + e5 * p1) / (T * T)
    return p, v, a


def solve_channel(times, values, holds):
    """Velocity and acceleration at every key, shared by both neighbouring quintic
    segments, so the flight is C2 by construction.

    Holds: v = a = 0.  Pass keys: per-axis monotone tangent (Fritsch-Butland
    weighted harmonic mean, zero at a local extremum), so a key reached at the end
    of a fast move settles instead of overshooting.  Acceleration is the minmod of
    the two adjacent cubic-Hermite end accelerations (smaller magnitude when they
    agree in sign, else zero), so a hard deceleration into a key is never carried
    into a long slow segment after it."""
    n = len(times)
    vals = np.asarray(values, dtype=float)
    vel = np.zeros_like(vals)
    acc = np.zeros_like(vals)
    for i in range(1, n - 1):
        if holds[i]:
            continue
        h0, h1 = times[i] - times[i - 1], times[i + 1] - times[i]
        s0 = (vals[i] - vals[i - 1]) / h0
        s1 = (vals[i + 1] - vals[i]) / h1
        same = (s0 * s1) > 0
        with np.errstate(divide="ignore", invalid="ignore"):
            hm = 3 * (h0 + h1) / ((2 * h1 + h0) / s0 + (h1 + 2 * h0) / s1)
        vel[i] = np.where(same, hm, 0.0)
    for i in range(1, n - 1):
        if holds[i]:
            continue
        h0, h1 = times[i] - times[i - 1], times[i + 1] - times[i]
        a_in = (-6 * (vals[i] - vals[i - 1]) / h0 + 2 * vel[i - 1] + 4 * vel[i]) / h0
        a_out = (6 * (vals[i + 1] - vals[i]) / h1 - 4 * vel[i] - 2 * vel[i + 1]) / h1
        acc[i] = np.where(a_in * a_out > 0, np.where(np.abs(a_in) < np.abs(a_out), a_in, a_out), 0.0)
    return vel, acc


def yaw_pitch(pos, target):
    d = np.asarray(target, float) - np.asarray(pos, float)
    return math.atan2(d[0], d[2]), math.atan2(d[1], math.hypot(d[0], d[2]))


def forward_from(yp):
    yaw, pitch = yp[..., 0], yp[..., 1]
    return np.stack([np.cos(pitch) * np.sin(yaw), np.sin(pitch), np.cos(pitch) * np.cos(yaw)], axis=-1)


def build_camera(cam):
    """Orientation is interpolated as (yaw, pitch) angles, never as look-at points:
    a target point sweeping past the camera would flip the view direction."""
    keys = cam["keys"]
    t = np.array([k["f"] / FPS for k in keys])
    holds = [k["type"] == "hold" for k in keys]
    yp = np.array([yaw_pitch(k["pos"], k["target"]) for k in keys], float)
    yp[:, 0] = np.unwrap(yp[:, 0])
    chans = {
        "pos": np.array([k["pos"] for k in keys], float),
        "yp": yp,
        "f_px": np.array([[k["f_px"]] for k in keys], float),
        "focus": np.array([[k["focus"]] for k in keys], float),
        "aperture": np.array([[k["aperture"]] for k in keys], float),
    }
    solved = {c: solve_channel(t, v, holds) for c, v in chans.items()}
    frames = np.arange(keys[0]["f"], keys[-1]["f"] + 1)
    ts = frames / FPS
    out = {c: np.zeros((len(frames), chans[c].shape[1])) for c in chans}
    vel = {c: np.zeros_like(out[c]) for c in chans}
    accel = {c: np.zeros_like(out[c]) for c in chans}
    for i in range(len(keys) - 1):
        lo, hi = t[i], t[i + 1]
        m = (ts >= lo) & ((ts < hi) if i < len(keys) - 2 else (ts <= hi))
        if not m.any():
            continue
        u = (ts[m] - lo) / (hi - lo)
        for c in chans:
            v0, a0 = solved[c][0][i], solved[c][1][i]
            v1, a1 = solved[c][0][i + 1], solved[c][1][i + 1]
            p, v, a = _hermite5(chans[c][i], v0, a0, chans[c][i + 1], v1, a1, hi - lo, u)
            out[c][m], vel[c][m], accel[c][m] = p, v, a
    out["fwd"] = forward_from(out["yp"])
    out["target"] = out["pos"] + out["fwd"] * out["focus"]
    return frames, out, vel, accel


def basis(pos, target, roll_deg=0.0):
    fwd = target - pos
    fwd = fwd / np.linalg.norm(fwd)
    up_w = np.array([0.0, 1.0, 0.0])
    right = np.cross(up_w, fwd)
    right /= np.linalg.norm(right)
    up = np.cross(fwd, right)
    if roll_deg:
        r = math.radians(roll_deg)
        right, up = right * math.cos(r) + up * math.sin(r), -right * math.sin(r) + up * math.cos(r)
    return right, up, fwd


def project(p, pos, target, f_px, roll_deg=0.0):
    right, up, fwd = basis(pos, target, roll_deg)
    d = np.asarray(p, float) - pos
    z = d @ fwd
    return W / 2 + f_px * (d @ right) / z, H / 2 - f_px * (d @ up) / z, z


def camera_report(cam, frames, out, vel, accel, scenes):
    pos, tgt, fpx = out["pos"], out["target"], out["f_px"][:, 0]
    fwd = out["fwd"]
    ang = np.zeros(len(frames))
    ang[1:] = np.degrees(np.arccos(np.clip(np.sum(fwd[1:] * fwd[:-1], axis=1), -1, 1))) * FPS
    speed = np.linalg.norm(vel["pos"], axis=1)
    acc = np.linalg.norm(accel["pos"], axis=1)
    dist = np.maximum(out["focus"][:, 0], 300.0)
    # screen motion estimate (px/frame) at the focus plane: translation + rotation + zoom
    lat = np.array([np.linalg.norm(v - (v @ d) * d) for v, d in zip(vel["pos"], fwd)])
    axial = np.abs(np.sum(vel["pos"] * fwd, axis=1))
    zoom = np.abs(vel["f_px"][:, 0]) / np.maximum(fpx, 1) * 960
    radial = axial / dist * 960  # dolly in/out streaks content at the frame edge
    screen = (lat * fpx / dist + np.radians(ang) * fpx + zoom + radial) / FPS
    bank = np.zeros(len(frames))
    holds = [k["f"] for k in cam["keys"] if k["type"] == "hold"]
    ab = cam["auto_bank"]
    for i, f in enumerate(frames):
        right, _, _ = basis(pos[i], tgt[i])
        a_lat = accel["pos"][i] @ right
        b = float(np.clip(-ab["gain_deg_per_g"] * a_lat / G, -ab["max_deg"], ab["max_deg"]))
        near = min(abs(f - h) for h in holds)
        if near < ab["disabled_within_f_of_hold"]:
            b *= near / ab["disabled_within_f_of_hold"]
        bank[i] = b
    # continuity check: largest frame-to-frame change in acceleration relative to its scale
    jerk = np.linalg.norm(np.diff(accel["pos"], axis=0), axis=1) * FPS
    rows = []
    for s in scenes:
        m = (frames >= s["f0"]) & (frames < s["f1"])
        # 180-degree shutter: blur length = half the per-frame motion; one sample per ~2 px of blur
        mb = np.clip(np.ceil(0.5 * screen[m] / 2.0), 1, 16)
        rows.append({
            "scene": s["id"], "name": s["name"],
            "max_speed": float(speed[m].max()), "max_accel_g": float(acc[m].max() / G),
            "max_ang": float(ang[m].max()), "max_screen": float(screen[m].max()),
            "mb_avg": float(mb.mean()), "mb_max": int(mb.max()), "max_bank": float(np.abs(bank[m]).max()),
        })
    # home-pose checks: station centre must land on frame centre at its home pose
    checks = []
    for sid, st in cam["stations"].items():
        if "home" not in st:
            continue
        hp = st["home"]
        u, v, z = project(st["center"], np.array(hp["pos"], float), np.array(hp["target"], float), hp["f"])
        scale = hp["f"] / z
        checks.append({"station": sid, "u": u, "v": v, "px_per_unit": scale})
    return {"speed": speed, "acc": acc, "ang": ang, "screen": screen, "bank": bank, "jerk": jerk,
            "rows": rows, "home_checks": checks}


# ----------------------------------------------------------------- drawing

def font(size, weight="Regular"):
    return ImageFont.truetype(str(FONT_DIR / f"Inter-{weight}.otf"), size)


class Canvas:
    """2x supersampled drawing surface, downsampled with Lanczos on save."""

    def __init__(self, w, h, ss=2):
        self.ss = ss
        self.img = Image.new("RGB", (w * ss, h * ss), BG)
        self.d = ImageDraw.Draw(self.img)

    def line(self, pts, fill, width=1.0):
        self.d.line([(x * self.ss, y * self.ss) for x, y in pts], fill=fill, width=max(1, int(round(width * self.ss))), joint="curve")

    def rect(self, box, fill=None, outline=None, width=1.0, radius=0):
        b = [c * self.ss for c in box]
        self.d.rounded_rectangle(b, radius=radius * self.ss, fill=fill, outline=outline, width=max(1, int(width * self.ss)))

    def circle(self, x, y, r, fill=None, outline=None, width=1.0):
        s = self.ss
        self.d.ellipse([(x - r) * s, (y - r) * s, (x + r) * s, (y + r) * s], fill=fill, outline=outline, width=max(1, int(width * s)))

    def text(self, xy, txt, size=14, fill=INK, weight="Regular", anchor="la"):
        self.d.text((xy[0] * self.ss, xy[1] * self.ss), txt, font=font(size * self.ss, weight), fill=fill, anchor=anchor)

    def save(self, path):
        w, h = self.img.size
        self.img.resize((w // self.ss, h // self.ss), Image.LANCZOS).save(path, optimize=True)


def draw_timeline(tl, scenes, events, sfx, vo, cam_rep, frames, path):
    Wd, Hd = 2400, 1180
    c = Canvas(Wd, Hd)
    x0, x1 = 190, Wd - 40
    total = tl["total_frames"]

    def X(f):
        return x0 + (x1 - x0) * f / total

    c.text((40, 28), "THE PATH  -  master timeline (60 fps, 1272 frames, 100 BPM in D major)", 26, INK, "Bold")
    measured = all("measured" in s for s in tl["vo"]["segments"])
    c.text((40, 64), "Frame-exact plan from brief/timeline.json. " + ("VO bars are the measured segments of the edited take (vo/words.json)."
           if measured else "VO bars use estimated read lengths until Phase 3 locks them to the selected take."), 15, DIM)

    lanes = [("Scenes", 120, 70), ("Camera", 205, 46), ("Voice-over", 265, 70), ("Music", 350, 70),
             ("Hero cues", 435, 92), ("SFX cues", 542, 120), ("Text legible", 676, 470)]
    for name, y, h in lanes:
        c.rect((x0, y, x1, y + h), fill=PANEL, radius=6)
        c.text((40, y + h / 2), name, 16, DIM, "SemiBold", anchor="lm")

    # bars and seconds grid
    for b in range(0, 10):
        f = b * 144
        if f > total:
            break
        c.line([(X(f), 110), (X(f), 1150)], GRID, 1)
        c.text((X(f) + 4, 96), f"bar {b + 1}", 12, DIM)
    for s in range(0, 22):
        f = s * 60
        c.line([(X(f), 1150), (X(f), 1158)], DIM, 1)
        c.text((X(f), 1162), f"{s}s", 12, DIM, anchor="ma")

    # scenes
    y, h = lanes[0][1], lanes[0][2]
    for s in scenes:
        col = SCENE_COLORS[s["id"]]
        c.rect((X(s["f0"]) + 1, y + 6, X(s["f1"]) - 1, y + h - 6), fill=tuple(int(v * 0.35) for v in col), outline=col, width=1.5, radius=5)
        c.text((X(s["f0"]) + 8, y + 14), s["id"], 15, col, "Bold")
        c.text((X(s["f0"]) + 8, y + 36), f"{s['name']}", 13, INK)
        c.text((X(s["f0"]) + 8, y + 52), f"f{s['f0']}-{s['f1'] - 1}", 11, DIM)

    # camera motion strip: locked / drift / move / fast
    y, h = lanes[1][1], lanes[1][2]
    sp = cam_rep["screen"]

    def motion_col(v):
        if v < 0.05:
            return (22, 30, 34)
        if v < 2.0:
            return (40, 96, 104)
        k = min(1.0, (v - 2.0) / 60.0)
        k2 = min(1.0, max(0.0, (v - 62.0) / 140.0))
        return (int(150 + 105 * k), int(110 + 40 * k - 75 * k2), int(40 + 35 * k2))

    for i, f in enumerate(frames[:-1]):
        c.rect((X(f), y + 8, X(f + 1) + 0.6, y + h - 8), fill=motion_col(sp[i]))
    lx = x1 - 560
    for label, v in (("locked / rest", 0.0), ("slow drift", 1.0), ("move", 30.0), ("fast move (> 60 px/frame)", 200.0)):
        c.rect((lx, y - 14, lx + 14, y - 4), fill=motion_col(v))
        c.text((lx + 18, y - 9), label, 11, DIM, anchor="lm")
        lx += 120

    # VO
    y, h = lanes[2][1], lanes[2][2]
    for seg in vo:
        fa, fe = seg["f"], frame_of(seg["est_end_t"])
        c.rect((X(fa), y + 12, X(fe), y + h - 12), fill=(28, 70, 92), outline=(28, 176, 246), width=1.2, radius=5)
        c.line([(X(fa), y + 4), (X(fa), y + h - 4)], (255, 255, 255), 2)
        label = seg["text"] if len(seg["text"]) < 26 else seg["text"][:24] + "..."
        c.text((X(fa) + 5, y + 18), f"{seg['n']}  {label}", 11, INK)
        c.text((X(fa) + 5, y + 38), f"@{seg['anchor_t']:.2f}s f{fa}", 11, (28, 176, 246))

    # music
    y, h = lanes[3][1], lanes[3][2]
    mcol = {"Intro": (88, 204, 2), "Lesson": (88, 204, 2), "Build": (255, 150, 0), "Drop": (255, 200, 0),
            "Lift": (206, 130, 255), "Breath": (120, 140, 150), "Resolve": (137, 226, 25)}
    for sec in tl["music"]["sections"]:
        col = mcol[sec["name"]]
        c.rect((X(sec["f0"]) + 1, y + 10, X(sec["f1"] + 1) - 1, y + h - 10), fill=tuple(int(v * 0.3) for v in col), outline=col, width=1.2, radius=5)
        c.text((X(sec["f0"]) + 6, y + 16), sec["name"], 13, col, "SemiBold")
        ch = sec["chords"] if len(sec["chords"]) < 22 else sec["chords"][:20] + "..."
        if X(sec["f1"]) - X(sec["f0"]) > 60:
            c.text((X(sec["f0"]) + 6, y + 36), ch, 11, DIM)

    # hero cues
    y, h = lanes[4][1], lanes[4][2]
    hero_ev = [e for e in events if e["kind"] == "hero"]
    for i, e in enumerate(hero_ev):
        xx = X(e["f"])
        yy = y + 18 + (i % 3) * 24
        c.line([(xx, y + 4), (xx, y + h - 4)], (255, 200, 0), 1.2)
        c.d.polygon([((xx) * 2, (yy - 6) * 2), ((xx + 6) * 2, yy * 2), (xx * 2, (yy + 6) * 2), ((xx - 6) * 2, yy * 2)], fill=(255, 200, 0))
        c.text((xx + 9, yy), f"{e['id']} f{e['f']}", 11, INK, anchor="lm")

    # SFX cues
    y, h = lanes[5][1], lanes[5][2]
    layers = list(LAYER_COLORS)
    for cue in sfx:
        li = layers.index(cue["layer"])
        yy = y + 10 + li * (h - 20) / (len(layers) - 1)
        col = LAYER_COLORS[cue["layer"]]
        c.circle(X(cue["f"]), yy, 3.2, fill=col)
    for li, ln in enumerate(layers):
        yy = y + 10 + li * (h - 20) / (len(layers) - 1)
        c.text((x0 - 8, yy), ln, 10, LAYER_COLORS[ln], anchor="rm")
    c.text((x1 - 6, y - 2), f"{len(sfx)} cues", 11, DIM, anchor="rb")

    # text legibility windows
    y, h = lanes[6][1], lanes[6][2]
    rows = tl["text_on_screen"]
    rh = (h - 16) / len(rows)
    for i, r in enumerate(rows):
        f0, f1 = r["readable_f"]
        yy = y + 8 + i * rh
        dur = (f1 - f0) / FPS
        col = (88, 204, 2) if dur >= 0.6 else (255, 150, 0)
        c.rect((X(f0), yy + 3, X(f1), yy + rh - 3), fill=tuple(int(v * 0.45) for v in col), outline=col, width=1, radius=3)
        c.text((X(f1) + 6, yy + rh / 2), f"{r['text']}  ({dur:.2f}s)", 11, INK, anchor="lm")
    c.save(path)


def axis_vec(ax_a, a, ax_b, b):
    """3-vector with value a on axis ax_a, b on axis ax_b, zero elsewhere."""
    v = [0.0, 0.0, 0.0]
    v[ax_a], v[ax_b] = a, b
    return v


def draw_camera(cam, frames, out, rep, scenes, path):
    Wd, Hd = 2400, 1500
    c = Canvas(Wd, Hd)
    c.text((40, 28), "THE PATH  -  one continuous camera flight through one world (16:9 keys)", 26, INK, "Bold")
    c.text((40, 64), f"Quintic Hermite through {len(cam['keys'])} keys: holds have zero velocity and acceleration; position, velocity and acceleration are continuous everywhere (C2).", 15, DIM)
    pos, tgt = out["pos"], out["target"]
    st = cam["stations"]

    def scene_of(f):
        for s in scenes:
            if s["f0"] <= f < s["f1"]:
                return s["id"]
        return "S10"

    pts_world = [np.array(v["center"]) for v in st.values() if "center" in v]
    pts_world += [np.array(n) for n in st["B"]["nodes"]] + [np.array(n) for n in st["G"]["course_nodes"].values()]
    allp = np.vstack([pos, np.array(pts_world)])

    def panel(box, ax_h, ax_v, flip_v, title, sub):
        bx0, by0, bx1, by1 = box
        c.rect(box, fill=PANEL, radius=10)
        c.text((bx0 + 18, by0 + 14), title, 18, INK, "SemiBold")
        c.text((bx0 + 18, by0 + 40), sub, 12, DIM)
        lo = allp[:, [ax_h, ax_v]].min(axis=0) - 900
        hi = allp[:, [ax_h, ax_v]].max(axis=0) + 900
        iw, ih = bx1 - bx0 - 60, by1 - by0 - 90
        sc = min(iw / (hi[0] - lo[0]), ih / (hi[1] - lo[1]))
        cx = bx0 + 30 + (iw - sc * (hi[0] - lo[0])) / 2
        cy = by0 + 70 + (ih - sc * (hi[1] - lo[1])) / 2

        def P(p):
            u = cx + (p[ax_h] - lo[0]) * sc
            vv = (p[ax_v] - lo[1]) * sc
            v = cy + (sc * (hi[1] - lo[1]) - vv if flip_v else vv)
            return u, v

        # grid every 2000 units
        for g in range(int(lo[0] // 2000) * 2000, int(hi[0]) + 1, 2000):
            u, _ = P(axis_vec(ax_h, g, ax_v, lo[1]))
            c.line([(u, cy), (u, cy + sc * (hi[1] - lo[1]))], (30, 44, 50), 1)
        for g in range(int(lo[1] // 2000) * 2000, int(hi[1]) + 1, 2000):
            _, v = P(axis_vec(ax_h, lo[0], ax_v, g))
            c.line([(cx, v), (cx + sc * (hi[0] - lo[0]), v)], (30, 44, 50), 1)
        # stations
        for sid, s in st.items():
            if "center" in s and sid != "J":  # J (end card) shares I's position
                u, v = P(s["center"])
                c.rect((u - 7, v - 7, u + 7, v + 7), fill=(10, 16, 19), outline=(220, 230, 235), width=1.5, radius=3)
                c.text((u + 10, v - 10), f"{sid}", 13, INK, "Bold")
        for n in st["B"]["nodes"]:
            u, v = P(n)
            c.circle(u, v, 4, fill=(88, 204, 2))
        for name, n in st["G"]["course_nodes"].items():
            u, v = P(n)
            col = {"languages": (88, 204, 2), "math": (28, 176, 246), "music": (206, 130, 255), "chess": (240, 240, 240)}[name]
            c.circle(u, v, 7, fill=col)
        u, v = P(st["G"]["fork"])
        c.circle(u, v, 5, outline=(88, 204, 2), width=2)
        # camera path coloured by scene
        prev = None
        for i, f in enumerate(frames):
            p = P(pos[i])
            if prev is not None:
                c.line([prev, p], SCENE_COLORS[scene_of(f)], 2.2)
            prev = p
        # view arrows at keys
        for k in cam["keys"]:
            p = np.array(k["pos"], float)
            d = np.array(k["target"], float) - p
            d = d / np.linalg.norm(d) * 650
            a, b = P(p), P(p + d)
            c.line([a, b], (255, 255, 255), 1.2)
            c.circle(a[0], a[1], 3.5, fill=(255, 255, 255))
        return P

    panel((30, 100, 810, 900), 0, 2, True, "Top view (X right, Z away)", "white ticks = view direction at each key")
    panel((830, 100, 1610, 900), 0, 1, True, "Front view (X right, Y up)", "the journey descends left-to-right, then forks")
    k684 = next(k for k in cam["keys"] if k["f"] == 684)
    k866 = next(k for k in cam["keys"] if k["f"] == 866)
    pull = np.linalg.norm(np.array(k866["pos"], float) - np.array(k684["pos"], float))
    panel((1630, 100, 2370, 900), 2, 1, True, "Side view (Z away, Y up)", f"S7 snaps back {pull:,.0f} units (f684 to f700, then drifts); S9 breathes back 1,570")

    # speed graphs
    gx0, gy0, gx1, gy1 = 30, 930, 2370, 1470
    c.rect((gx0, gy0, gx1, gy1), fill=PANEL, radius=10)
    c.text((gx0 + 18, gy0 + 14), "Camera speed (units/s, green) and angular speed (deg/s, purple) per frame", 18, INK, "SemiBold")
    px0, px1, py0, py1 = gx0 + 70, gx1 - 30, gy0 + 60, gy1 - 40
    total = frames[-1]
    for s in scenes:
        u0 = px0 + (px1 - px0) * s["f0"] / total
        u1 = px0 + (px1 - px0) * min(s["f1"], total) / total
        col = SCENE_COLORS[s["id"]]
        c.rect((u0, py0, u1, py1), fill=tuple(int(v * 0.12) + 8 for v in col))
        c.text((u0 + 4, py0 + 4), s["id"], 12, col, "Bold")
    sp, an = rep["speed"], rep["ang"]
    smax, amax = sp.max() * 1.05, max(an.max(), 1) * 1.05

    def curve(vals, vmax, col):
        prev = None
        for i, f in enumerate(frames):
            p = (px0 + (px1 - px0) * f / total, py1 - (py1 - py0) * vals[i] / vmax)
            if prev:
                c.line([prev, p], col, 2)
            prev = p

    curve(sp, smax, (88, 204, 2))
    curve(an, amax, (206, 130, 255))
    c.text((px0 - 8, py0), f"{smax:,.0f}", 11, (88, 204, 2), anchor="ra")
    c.text((px1, py0 - 18), f"angular max {an.max():.0f} deg/s", 11, (206, 130, 255), anchor="ra")
    for sec in range(0, 22, 1):
        u = px0 + (px1 - px0) * sec * 60 / total
        c.text((u, py1 + 6), f"{sec}s", 11, DIM, anchor="ma")
    c.save(path)


# ------------------------------------------------------------------ tables

def md_tables(tl, scenes, events, sfx, vo, cam, rep):
    t = {}
    rows = ["| Scene | Name | Start | End | Frames | Length | Station |", "|---|---|---|---|---|---|---|"]
    for s in scenes:
        rows.append(f"| {s['id']} | {s['name']} | {s['t0']:.2f} s | {s['t1']:.2f} s | f{s['f0']}–f{s['f1'] - 1} | {s['f1'] - s['f0']} f ({(s['f1'] - s['f0']) / FPS:.2f} s) | {s['station']} |")
    t["scenes"] = "\n".join(rows)

    rows = ["| Frame | Time | Scene | Event | Spec |", "|---:|---:|---|---|:---:|"]
    for e in events:
        spec = "given" if e.get("given") else ""
        if e.get("given") and "given_t" in e and frame_of(e["given_t"]) != e["f"]:
            spec = f"given {e['given_t']:.2f} s; follows the VO"
        elif "vo_lock" in e:
            spec = (spec + "; " if spec else "") + "on the VO"
        rows.append(f"| {e['f']} | {e['f'] / FPS:.3f} s | {e['scene']} | **{e['id']}**: {e['what']} | {spec} |")
    t["events"] = "\n".join(rows)

    measured = all("measured" in v for v in vo)
    rows = ["| # | Segment (cut only at the take's own pauses) | Anchor | Frame | Sample @48 kHz | Must end before | "
            + ("Measured end |" if measured else "Est. end |"), "|---:|---|---:|---:|---:|---:|---:|"]
    for seg in vo:
        rows.append(f"| {seg['n']} | {seg['text']} | {seg['anchor_t']:.2f} s{'' if seg['given'] else ' *'} | {seg['f']} | {seg['f'] * 800:,} | {seg['must_end_before_t']:.2f} s | {seg['est_end_t']:.2f} s |")
    t["vo"] = "\n".join(rows)

    rows = ["| # | Frame | Time | Scene | Cue | Layer | Sound |", "|---:|---:|---:|---|---|---|---|"]
    for cue in sfx:
        rows.append(f"| {cue['n']} | {cue['f']} | {cue['t']:.3f} | {cue['scene']} | `{cue['name']}` | {cue['layer']} | {cue['desc']} |")
    t["sfx"] = "\n".join(rows)

    rows = ["| Key | Frame | Type | Camera position | Look-at target | Lens (px) | Focus | Aperture | Purpose |", "|---:|---:|---|---|---|---:|---:|---:|---|"]
    for i, k in enumerate(cam["keys"]):
        p = ", ".join(f"{v:,}" for v in k["pos"])
        g = ", ".join(f"{v:,}" for v in k["target"])
        rows.append(f"| K{i:02d} | {k['f']} | {k['type']} | ({p}) | ({g}) | {k['f_px']} | {k['focus']:,} | {k['aperture']} | {k['note']} |")
    t["camera_keys"] = "\n".join(rows)

    rows = ["| Scene | Max speed (units/s) | Max accel (g) | Max turn (deg/s) | Max screen motion (px/frame) | Motion-blur samples (avg / max) | Max auto-bank |", "|---|---:|---:|---:|---:|---:|---:|"]
    for r in rep["rows"]:
        rows.append(f"| {r['scene']} {r['name']} | {r['max_speed']:,.0f} | {r['max_accel_g']:.2f} | {r['max_ang']:.0f} | {r['max_screen']:.0f} | {r['mb_avg']:.1f} / {r['mb_max']} | {r['max_bank']:.1f}° |")
    t["camera_report"] = "\n".join(rows)

    rows = ["| Station | Projected center at home pose | Scale (px per unit) |", "|---|---|---:|"]
    for h in rep["home_checks"]:
        rows.append(f"| {h['station']} | ({h['u']:.2f}, {h['v']:.2f}) | {h['px_per_unit']:.4f} |")
    t["home_checks"] = "\n".join(rows)

    rows = ["| Text | Scene | Fully legible | Duration |", "|---|---|---|---:|"]
    for r in tl["text_on_screen"]:
        f0, f1 = r["readable_f"]
        rows.append(f"| {r['text']} | {r['scene']} | f{f0}–f{f1} | {(f1 - f0) / FPS:.2f} s |")
    t["legibility"] = "\n".join(rows)
    return t


def inject(md_path: Path, tables: dict):
    if not md_path.exists():
        return False
    s = md_path.read_text(encoding="utf-8")
    for name, body in tables.items():
        pat = re.compile(rf"(<!-- GEN:{name} -->)(.*?)(<!-- /GEN:{name} -->)", re.S)
        s, n = pat.subn(lambda m: f"{m.group(1)}\n{body}\n{m.group(3)}", s)
    md_path.write_text(s, encoding="utf-8")
    return True


def main():
    tl, cam = load()
    scenes, events, sfx, vo, problems = resolve_timeline(tl)
    frames, out, vel, accel = build_camera(cam)
    assert frames[0] == 0 and frames[-1] == tl["total_frames"] - 1, "camera keys must span every frame"
    rep = camera_report(cam, frames, out, vel, accel, scenes)
    OUT.mkdir(parents=True, exist_ok=True)
    draw_timeline(tl, scenes, events, sfx, vo, rep, frames, OUT / "timeline.png")
    draw_camera(cam, frames, out, rep, scenes, OUT / "camera_path.png")
    tables = md_tables(tl, scenes, events, sfx, vo, cam, rep)
    injected = inject(ROOT / "BRIEF.md", tables)

    print(f"scenes {len(scenes)}  events {len(events)}  sfx cues {len(sfx)}  vo segments {len(vo)}")
    print(f"camera frames {len(frames)}  max speed {rep['speed'].max():,.0f} u/s  max turn {rep['ang'].max():.0f} deg/s")
    print("home checks:", ", ".join(f"{h['station']}=({h['u']:.1f},{h['v']:.1f})" for h in rep["home_checks"]))
    for r in rep["rows"]:
        print(f"  {r['scene']:>3} speed {r['max_speed']:>8,.0f}  accel {r['max_accel_g']:5.2f} g  turn {r['max_ang']:5.0f} deg/s  "
              f"screen {r['max_screen']:6.1f} px/f  mb {r['mb_avg']:.1f}/{r['mb_max']}  bank {r['max_bank']:.1f}")
    hero = [e for e in events if e["kind"] == "hero"]
    print("screen motion at hero frames (px/frame):",
          ", ".join(f"{e['id']}@{e['f']}={rep['screen'][e['f']]:.1f}" for e in hero))
    print("BRIEF.md tables injected" if injected else "BRIEF.md not found (tables not injected)")
    print("PROBLEMS:" if problems else "no problems found")
    for p in problems:
        print("  -", p)


if __name__ == "__main__":
    main()
