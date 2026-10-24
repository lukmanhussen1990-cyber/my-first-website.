"""Stickman rig: proportions measured on the reference (≈22% of frame height).

A pose is a set of IK targets (hip, hands, feet) plus spine/head angles, all in
pixels relative to the ground point under the hip, written for a figure facing
right. Facing left mirrors the x axis. Expressions are numeric so they blend.
"""
from __future__ import annotations

import math

import numpy as np

from .ink import Canvas, _rng, bent, hand_circle, quad, spline, stable_seed, through

R = 46.0              # head radius
GAP = 3.0             # neck gap between torso and head
TORSO = 158.0
UARM, FARM = 76.0, 74.0
THIGH, SHIN = 88.0, 86.0
LW = 6.5              # body stroke
FW = 3.8              # face stroke

# ----------------------------------------------------------------- poses
# hand_* are relative to the hip, foot_* relative to the ground anchor.
# elbow/knee: +1 / -1 picks the bend side (see _ik), values in between straighten.
POSES = {
    "stand":        dict(hip=(0, -172), spine=0.0, bend=0.0, head=0.0,
                         hand_a=(40, -22), hand_b=(-40, -22), elbow_a=-1, elbow_b=1,
                         foot_a=(24, 0), foot_b=(-24, 0), knee_a=-0.6, knee_b=0.6),
    "stand_side":   dict(hip=(0, -166), spine=0.03, bend=0.0, head=0.0,
                         hand_a=(30, -18), hand_b=(-18, -20), elbow_a=-1, elbow_b=1,
                         foot_a=(18, 0), foot_b=(-14, 0), knee_a=-0.8, knee_b=-0.8),
    "stand_hold":   dict(hip=(0, -166), spine=0.02, bend=0.0, head=0.18,
                         hand_a=(44, -98), hand_b=(30, -104), elbow_a=1, elbow_b=1,
                         foot_a=(20, 0), foot_b=(-18, 0), knee_a=-0.6, knee_b=-0.6),
    "stand_offer":  dict(hip=(0, -166), spine=0.02, bend=0.0, head=0.0,
                         hand_a=(96, -78), hand_b=(-22, -20), elbow_a=1, elbow_b=1,
                         foot_a=(20, 0), foot_b=(-18, 0), knee_a=-0.6, knee_b=-0.6),
    "stand_cheer":  dict(hip=(0, -166), spine=-0.06, bend=0.0, head=-0.12,
                         hand_a=(62, -128), hand_b=(-58, -120), elbow_a=1, elbow_b=-1,
                         foot_a=(26, 0), foot_b=(-24, 0), knee_a=-0.6, knee_b=0.6),
    "sit":          dict(hip=(0, -94), spine=0.14, bend=0.0, head=0.08,
                         hand_a=(56, -22), hand_b=(46, -26), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_hunch_phone": dict(hip=(0, -94), spine=0.34, bend=0.28, head=0.52,
                         hand_a=(112, -62), hand_b=(100, -68), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_phone":    dict(hip=(0, -94), spine=0.08, bend=0.0, head=0.24,
                         hand_a=(104, -96), hand_b=(94, -102), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_drop":     dict(hip=(0, -94), spine=0.30, bend=0.05, head=0.30,
                         hand_a=(176, -112), hand_b=(46, -26), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_pocket":   dict(hip=(0, -94), spine=0.16, bend=0.06, head=0.42,
                         hand_a=(30, -4), hand_b=(50, -24), elbow_a=-1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_slump":    dict(hip=(0, -94), spine=0.06, bend=0.14, head=0.10,
                         hand_a=(58, -18), hand_b=(48, -22), elbow_a=1, elbow_b=1,
                         foot_a=(98, 0), foot_b=(84, 0), knee_a=-1, knee_b=-1),
    "sit_draw":     dict(hip=(0, -94), spine=0.26, bend=0.05, head=0.42,
                         hand_a=(150, -64), hand_b=(118, -60), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_sketch":   dict(hip=(0, -94), spine=0.12, bend=0.04, head=0.30,
                         hand_a=(118, -104), hand_b=(64, -100), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_book":     dict(hip=(0, -94), spine=0.10, bend=0.02, head=0.30,
                         hand_a=(100, -100), hand_b=(64, -104), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
    "sit_up":       dict(hip=(0, -94), spine=-0.02, bend=0.0, head=-0.16,
                         hand_a=(56, -22), hand_b=(46, -26), elbow_a=1, elbow_b=1,
                         foot_a=(94, 0), foot_b=(80, 0), knee_a=-1, knee_b=-1),
}

# ----------------------------------------------------------------- faces
FACES = {
    #            eye_open eye_happy eye_size brow  tilt  raise  curve  open  wavy  width sweat
    "neutral":   (1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.9, 0.0),
    "blank":     (1.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.55, 0.0),
    "sad":       (1.0, 0.0, 1.1, 1.0, 0.9, 0.1, -0.55, 0.0, 0.0, 0.8, 0.0),
    "stressed":  (1.0, 0.0, 1.15, 1.0, 1.0, 0.15, -0.2, 0.0, 1.0, 0.9, 1.0),
    "bored":     (0.55, 0.0, 1.0, 0.0, 0.0, 0.0, -0.05, 0.0, 0.0, 0.6, 0.0),
    "curious":   (1.0, 0.0, 1.1, 1.0, -0.2, 0.6, 0.1, 0.0, 0.0, 0.6, 0.0),
    "focused":   (1.0, 0.0, 1.0, 1.0, -0.55, 0.0, 0.3, 0.0, 0.0, 0.8, 0.0),
    "smile":     (1.0, 0.0, 1.05, 0.0, 0.0, 0.0, 0.85, 0.0, 0.0, 1.0, 0.0),
    "content":   (1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0, 0.95, 0.0),
    "happy":     (1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.9, 0.35, 0.0, 1.1, 0.0),
    "laugh":     (1.0, 1.0, 1.0, 0.0, 0.0, 0.2, 1.0, 1.0, 0.0, 1.2, 0.0),
    "surprised": (1.0, 0.0, 1.4, 1.0, 0.0, 1.0, 0.0, 0.55, 0.0, 0.5, 0.0),
}
FACE_KEYS = ("eye_open", "eye_happy", "eye_size", "brow", "tilt", "raise", "curve", "open", "wavy", "width", "sweat")


def face(name_or_dict):
    if isinstance(name_or_dict, dict):
        return dict(name_or_dict)
    return dict(zip(FACE_KEYS, FACES[name_or_dict]))


def pose(name_or_dict):
    if isinstance(name_or_dict, dict):
        return dict(name_or_dict)
    return dict(POSES[name_or_dict])


def blend(a: dict, b: dict, k: float) -> dict:
    out = {}
    for key, va in a.items():
        vb = b.get(key, va)
        if isinstance(va, tuple):
            out[key] = tuple(x + (y - x) * k for x, y in zip(va, vb))
        else:
            out[key] = va + (vb - va) * k
    return out


# ----------------------------------------------------------------- motions
def apply_motions(p: dict, f: dict, motions, t: float, seed):
    """Procedural motion layered on the pose. motions: [(name, t0, t1, params)]."""
    p = dict(p)
    f = dict(f)
    rr = _rng(("idle", seed))
    ph = rr.uniform(0, 6.28)
    # breathing + idle sway (never fully static)
    br = math.sin(2 * math.pi * 0.28 * t + ph)
    p["hip"] = (p["hip"][0], p["hip"][1] - 1.4 * br)
    p["spine"] += 0.012 * math.sin(2 * math.pi * 0.21 * t + ph * 1.3)
    p["head"] += 0.03 * math.sin(2 * math.pi * 0.17 * t + ph * 0.7)
    for h in ("hand_a", "hand_b"):
        p[h] = (p[h][0] + 1.6 * math.sin(2 * math.pi * 0.23 * t + ph + len(h)), p[h][1] + 1.4 * br)

    for name, t0, t1, prm in motions:
        if not (t0 <= t <= t1 + 0.35):
            continue
        u = (t - t0) / max(t1 - t0, 1e-6)
        env = min(1.0, (t - t0) / 0.18, max(0.0, (t1 + 0.35 - t) / 0.35))
        if name == "walk":
            period = prm.get("period", 0.82)
            phase = 2 * math.pi * (t - t0) / period
            stride = prm.get("stride", 34)
            s = math.sin(phase)
            c = math.cos(phase)
            lift = prm.get("lift", 18)
            fa = (p["foot_a"][0] * (1 - env) + (stride * s) * env, -lift * max(0, c) * env)
            fb = (p["foot_b"][0] * (1 - env) + (-stride * s) * env, -lift * max(0, -c) * env)
            p["foot_a"], p["foot_b"] = fa, fb
            p["knee_a"], p["knee_b"] = -1, -1
            p["hip"] = (p["hip"][0], p["hip"][1] + env * (2.5 * abs(s) - 1))
            sw = prm.get("swing", 22) * env
            p["hand_a"] = (p["hand_a"][0] - sw * s, p["hand_a"][1] + 3 * abs(s))
            p["hand_b"] = (p["hand_b"][0] + sw * s, p["hand_b"][1] + 3 * abs(s))
            p["spine"] += 0.05 * env
        elif name == "pat":  # hand pats a pocket: small fast up/down
            k = env * (0.5 + 0.5 * math.sin(2 * math.pi * 6.0 * (t - t0)))
            hx, hy = p["hand_a"]
            p["hand_a"] = (hx + 3 * k, hy - 9 * k)
        elif name == "scribble":  # pencil loops
            w = 2 * math.pi * prm.get("hz", 2.6) * (t - t0)
            hx, hy = p["hand_a"]
            p["hand_a"] = (hx + env * (9 * math.sin(w) + 14 * math.sin(0.37 * w)), hy + env * 4 * math.sin(2 * w))
            p["head"] += env * 0.04 * math.sin(0.5 * w)
        elif name == "laugh":
            w = 2 * math.pi * 4.2 * (t - t0)
            p["hip"] = (p["hip"][0], p["hip"][1] - env * 3.5 * abs(math.sin(w)))
            p["head"] += env * (-0.16 + 0.07 * math.sin(w))
            p["spine"] += env * (-0.05 + 0.03 * math.sin(w))
            for h in ("hand_a", "hand_b"):
                p[h] = (p[h][0], p[h][1] - env * 4 * abs(math.sin(w + 1)))
        elif name == "swipe":  # thumb flicks up on the phone every ~0.6 s
            ph2 = ((t - t0) % prm.get("every", 0.62)) / prm.get("every", 0.62)
            k = env * (math.sin(math.pi * min(1, ph2 / 0.35)) if ph2 < 0.35 else 0)
            hx, hy = p["hand_a"]
            p["hand_a"] = (hx + 2 * k, hy - 7 * k)
            p["head"] += env * 0.015 * k
        elif name == "nod":
            p["head"] += env * 0.10 * math.sin(2 * math.pi * 2.2 * (t - t0))
        elif name == "bounce_leg":  # nervous knee bounce
            w = 2 * math.pi * 5.5 * (t - t0)
            fx, fy = p["foot_a"]
            p["foot_a"] = (fx, fy - env * 7 * max(0, math.sin(w)))
        elif name == "page_turn":  # flick the right hand across the book
            k = env * math.sin(math.pi * min(1, (t - t0) / max(t1 - t0, 1e-3)))
            hx, hy = p["hand_a"]
            p["hand_a"] = (hx - 40 * k, hy - 18 * k)
        elif name == "shiver":
            p["hip"] = (p["hip"][0] + env * 1.5 * math.sin(2 * math.pi * 11 * t), p["hip"][1])
        elif name == "look_around":
            f["look"] = (env * math.sin(2 * math.pi * 0.7 * (t - t0)), f.get("look", (0, 0))[1])
    return p, f


# ----------------------------------------------------------------- solve
def _ik(root, target, l1, l2, bend):
    root, target = np.asarray(root, float), np.asarray(target, float)
    d = target - root
    dist = float(np.hypot(*d))
    if dist < 1e-6:
        return root + (0, l1), root + (0, l1 + l2)
    u = d / dist
    dist_c = min(dist, l1 + l2 - 0.5)
    a = (l1 * l1 - l2 * l2 + dist_c * dist_c) / (2 * dist_c)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    n = np.array([-u[1], u[0]])
    joint = root + u * a + n * h * bend
    end = root + u * dist_c
    return joint, end


def solve(p: dict, x: float, ground: float, facing: int, scale: float):
    s = scale
    fx = facing

    def P(v, base=(0.0, 0.0)):
        return np.array([base[0] + fx * v[0] * s, base[1] + v[1] * s])

    anchor = (x, ground)
    hip = P(p["hip"], anchor)
    sp = p["spine"]
    neck = hip + np.array([fx * math.sin(sp), -math.cos(sp)]) * TORSO * s
    ha = sp + p["head"]
    head = neck + np.array([fx * math.sin(ha), -math.cos(ha)]) * (R + GAP) * s
    j = {"hip": hip, "neck": neck, "head": head, "head_angle": fx * ha, "spine_angle": fx * sp}
    # hunch: torso control point pushed backwards
    mid = (hip + neck) / 2 + np.array([-fx * math.cos(sp), -math.sin(sp)]) * p["bend"] * 40 * s
    j["torso_mid"] = mid
    for side in ("a", "b"):
        target = P(p[f"hand_{side}"], hip)
        e, hnd = _ik(neck, target, UARM * s, FARM * s, p[f"elbow_{side}"] * fx)
        j[f"elbow_{side}"], j[f"hand_{side}"] = e, hnd
        ft = P(p[f"foot_{side}"], anchor)
        k, foot = _ik(hip, ft, THIGH * s, SHIN * s, p[f"knee_{side}"] * fx)
        j[f"knee_{side}"], j[f"foot_{side}"] = k, foot
    return j


# ----------------------------------------------------------------- draw
def draw_person(cv: Canvas, j: dict, fc: dict, seed, *, scale=1.0, turn=0.0, col="ink", alpha=1.0,
                dashed=False, hair=False, look=(0.0, 0.0), blink=True):
    if alpha <= 0.003:
        return
    s = scale
    lw = LW * s
    dash = [14 * s, 11 * s] if dashed else None
    a = cv.begin(alpha)
    st = lambda pts, k, w=lw: cv.stroke(pts, (seed, k), w, col, 1.0, dash=dash)  # noqa: E731
    for side in ("b", "a"):
        st(bent(j["hip"], j[f"knee_{side}"], j[f"foot_{side}"], 0.2), "leg" + side)
    st(quad(j["hip"], j["torso_mid"], j["neck"]), "torso")
    for side in ("b", "a"):
        st(bent(j["neck"], j[f"elbow_{side}"], j[f"hand_{side}"], 0.42, 14), "arm" + side)
    hx, hy = j["head"]
    r = R * s
    circle = hand_circle(hx, hy, r, seed)
    if not dashed:
        cv.fill(circle, (seed, "headfill"), "fill")
    if hair:
        _hair(cv, hx, hy, r, j["head_angle"], seed, col, lw, dash)
    st(circle, "head")
    _face(cv, hx, hy, r, j["head_angle"], turn, fc, seed, col, look, blink)
    cv.end(a)


def _hair(cv, hx, hy, r, ang, seed, col, lw, dash):
    for sgn in (-1, 1):
        pts = np.array([(0, -r - 1), (sgn * r * 0.78, -r * 0.72), (sgn * (r + 7), -r * 0.05),
                        (sgn * (r + 7), r * 0.75), (sgn * (r + 12), r + 26)])
        pts = spline(pts, 10)
        c, sn = math.cos(ang), math.sin(ang)
        pts = np.stack([pts[:, 0] * c - pts[:, 1] * sn, pts[:, 0] * sn + pts[:, 1] * c], 1) + (hx, hy)
        cv.stroke(pts, (seed, "hair", sgn), lw * 0.85, col, dash=dash)


def _face(cv, hx, hy, r, ang, turn, f, seed, col, look, blink):
    c, sn = math.cos(ang), math.sin(ang)

    def T(px, py):  # face space -> screen (rotates with the head)
        px += turn * 0.30 * r
        return np.array([hx + px * c - py * sn, hy + px * sn + py * c])

    fw = FW * r / R
    eye_dx = 0.34 * r * (1 - 0.22 * abs(turn))
    eye_y = 0.06 * r
    lx, ly = look
    eye_open = f["eye_open"]
    if blink:
        ph = (stable_seed(("blink", seed)) % 1000) / 1000 * 3.7
        if (cv.t + ph) % 3.7 < 0.11:
            eye_open = 0.0
    for sgn in (-1, 1):
        ex = sgn * eye_dx
        if f["eye_happy"] > 0.5:
            pts = np.array([T(ex + 0.15 * r * math.cos(a), eye_y - 0.02 * r + 0.10 * r * math.sin(a))
                            for a in np.linspace(0.15 * math.pi, 0.85 * math.pi, 9)])
            cv.stroke(pts, (seed, "eye", sgn), fw, col, wobble=0.3, boil=0.3)
        elif eye_open < 0.3:
            cv.stroke(np.array([T(ex - 0.11 * r, eye_y), T(ex + 0.11 * r, eye_y)]), (seed, "eyec", sgn), fw, col,
                      wobble=0.2, boil=0.2)
        else:
            px, py = T(ex + lx * 0.07 * r, eye_y + ly * 0.07 * r)
            cv.dot(px, py, 0.095 * r * f["eye_size"], col)
            if eye_open < 0.8:  # heavy lid
                cv.stroke(np.array([T(ex - 0.13 * r, eye_y - 0.05 * r), T(ex + 0.13 * r, eye_y - 0.05 * r)]),
                          (seed, "lid", sgn), fw * 0.9, col, wobble=0.2, boil=0.2)
        if f["brow"] > 0.05:
            tilt, raise_ = f["tilt"], f["raise"]
            by = -0.27 * r - 0.12 * r * raise_
            inner = (sgn * 0.12 * r, by - 0.11 * r * tilt)
            outer = (sgn * 0.48 * r, by + 0.07 * r * tilt)
            cv.stroke(np.array([T(*inner), T(*outer)]), (seed, "brow", sgn), fw, col, alpha=f["brow"],
                      wobble=0.3, boil=0.3)
    my = 0.43 * r
    w = 0.21 * r * f["width"]
    if f["open"] > 0.05:
        depth = 0.12 * r + 0.30 * r * f["open"]
        top = 0.06 * r * max(f["curve"], 0)
        pts = [T(x, my - top * (1 - (x / w) ** 2)) for x in np.linspace(-w * 1.15, w * 1.15, 9)]
        pts += [T(w * 1.15 * math.cos(a), my + depth * math.sin(a)) for a in np.linspace(0, math.pi, 13)]
        pts = np.array(pts)
        cv.fill(pts, (seed, "mouthfill"), "fill")
        cv.stroke(pts, (seed, "mouth"), fw, col, closed=True, wobble=0.3, boil=0.3)
    elif f["wavy"] > 0.5:
        xs = np.linspace(-w, w, 16)
        pts = np.array([T(x, my + 0.07 * r * math.sin((x + w) / (2 * w) * 3 * math.pi)) for x in xs])
        cv.stroke(pts, (seed, "mouthw"), fw, col, wobble=0.2, boil=0.2)
    else:
        bow = 0.17 * r * f["curve"]
        pts = np.array([T(-w, my - 0.02 * r * f["curve"]), T(0, my + bow), T(w, my - 0.02 * r * f["curve"])])
        cv.stroke(through(*pts, n=12), (seed, "mouth"), fw, col, wobble=0.25, boil=0.25)
    if f["sweat"] > 0.05:
        k = (cv.t * 0.8 + (stable_seed(seed) % 100) / 100) % 1.0
        side = -1 if turn > 0.2 else 1
        dx, dy = T(side * 1.25 * r, -0.30 * r + 0.45 * r * k)
        a = f["sweat"] * min(1, 4 * (1 - k)) * min(1, 6 * k)
        drop = [(dx + 8.5 * r / R * math.cos(t), dy + 8.5 * r / R * math.sin(t)) for t in np.linspace(0, math.pi, 9)]
        drop += [(dx, dy - 19 * r / R)]
        cv.fill(np.array(drop) + 0, (seed, "sweat"), "#8ec0f2", alpha=a)
