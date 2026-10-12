#!/usr/bin/env python3
"""Numeric forward-kinematics check of the Giant Spider Hunter client animations.

Runs the REAL generated client files (entity scripts, animations, controllers) through the
Molang evaluator in gen_client_molang.py, frame by frame, with a simulated entity that walks /
runs / turns / stops on a 20 Hz server tick (positions interpolated for rendering), then poses
the skeleton with Bedrock rotation conventions and measures the feet:

  * planted feet stay on the ground (|height error| < 0.15 block) and do not slip (< 0.25 block
    per stance) at giant scale, for walk and run at several speeds and two frame rates
  * swing feet lift, legs never invert (knee above the hip-ankle line)
  * when the speed drops to 0 the gait stops and every foot settles on the ground
  * the small form (small_scale 0.075) behaves the same (thresholds scaled)
  * terrain offsets (horror:foot_i) are reached, growth / death / attacks stay finite
  * the step controller fires one footstep per half gait cycle at the planting group

Usage: python3 tools/gen_client_gait_report.py [--out DIR] [--sheet]
Exit code 0 when every check passes. --sheet also renders stick-figure contact sheets (PNG).
"""
import argparse
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_client_molang import Molang  # noqa: E402
import gen_client_anim as G  # noqa: E402

ROOT = os.path.dirname(HERE)
RP = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP")


# --------------------------------------------------------------------------- rotations
def rx(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def bedrock_rot(r):
    """Bedrock bone rotation (file values, model space where +X = entity's left).

    Derived from vanilla data: spider default_leg_pose (leg1 at +X with z=+45 points down, y=-45
    on the rear leg points backward) and zombie arms (x=-90 points the arm forward, -Z)."""
    return rz(-r[2]) @ ry(r[1]) @ rx(-r[0])


# --------------------------------------------------------------------------- skeleton
def skeleton():
    """Bones {name: (parent, pivot, bind_rotation)} and locators {name: (bone, pos)}.

    Uses the real geometry when the geometry agent has produced it, else DESIGN.md §4."""
    geo_path = os.path.join(RP, "models", "entity", "giant_spider.geo.json")
    bones, locs, source = {}, {}, "DESIGN.md §4 constants"
    if os.path.isfile(geo_path):
        try:
            geo = json.load(open(geo_path))
            g = [x for x in geo["minecraft:geometry"]
                 if x["description"]["identifier"] == "geometry.horror.giant_spider"][0]
            for b in g["bones"]:
                bones[b["name"]] = (b.get("parent"), np.array(b.get("pivot", [0, 0, 0]), float),
                                    np.array(b.get("rotation", [0, 0, 0]), float))
                for ln, lv in (b.get("locators") or {}).items():
                    pos = lv["offset"] if isinstance(lv, dict) else lv
                    locs[ln] = (b["name"], np.array(pos, float))
            source = os.path.relpath(geo_path, ROOT)
        except Exception as e:  # fall back to the design numbers
            print(f"warning: could not use geometry ({e}); using DESIGN constants")
            bones, locs = {}, {}
    if not bones:
        z3 = np.zeros(3)
        bones["root"] = (None, z3, z3)
        bones["body"] = ("root", np.array([0, 208.0, 0]), z3)
        bones["torso"] = ("body", np.array([0, 208.0, 0]), z3)
        bones["head"] = ("torso", np.array([0, 212.0, -34]), z3)
        bones["fang_l"] = ("head", np.array([8, 202.0, -48]), z3)
        bones["fang_r"] = ("head", np.array([-8, 202.0, -48]), z3)
        bones["abdomen"] = ("torso", np.array([0, 214.0, 16]), z3)
        for side, n in G.LEGS:
            c = G.leg_constants(side, n)
            nm = G.leg_name(side, n)
            sx = 1 if side == "l" else -1
            hip = np.array(c["hip"], float)
            bones[f"hip_{nm}"] = ("body", hip, z3)
            bones[f"femur_{nm}"] = (f"hip_{nm}", hip, z3)
            bones[f"tibia_{nm}"] = (f"femur_{nm}", hip + [sx * c["L1"], 0, 0], z3)
            bones[f"foot_{nm}"] = (f"tibia_{nm}", hip + [sx * (c["L1"] + c["L2"]), 0, 0], z3)
            locs[f"foot_tip_{nm}"] = (f"foot_{nm}", hip + [sx * (c["L1"] + c["L2"] + c["L3"]), 0, 0])
    return bones, locs, source


def pose(bones, locs, channels):
    """channels: {bone: {'rotation': v3, 'position': v3, 'scale': v3}} -> world points (px)."""
    mats = {}

    def mat(name):
        if name in mats:
            return mats[name]
        parent, pivot, bind = bones[name]
        ch = channels.get(name, {})
        R = bedrock_rot(bind + ch.get("rotation", np.zeros(3)))
        S = np.diag(ch.get("scale", np.ones(3)))
        T = ch.get("position", np.zeros(3))
        local_A = R @ S
        local_b = pivot + T - local_A @ pivot
        if parent:
            pA, pb = mat(parent)
            A, b = pA @ local_A, pA @ local_b + pb
        else:
            A, b = local_A, local_b
        mats[name] = (A, b)
        return mats[name]

    pts = {}
    for name in bones:
        A, b = mat(name)
        pts["pivot:" + name] = A @ bones[name][1] + b
    for ln, (bone, pos) in locs.items():
        A, b = mat(bone)
        pts[ln] = A @ pos + b
    return pts


# --------------------------------------------------------------------------- animation eval
class Anim:
    def __init__(self, data):
        self.d = data
        self.loop = data.get("loop", False)
        self.length = data.get("animation_length", 0.0)

    def finished(self, t):
        return self.loop is not True and t >= self.length

    def sample(self, ml, t):
        if self.loop is True and self.length:
            t = math.fmod(t, self.length)
        ml.queries["anim_time"] = t
        out = {}
        for bone, chans in self.d.get("bones", {}).items():
            for ch, val in chans.items():
                out.setdefault(bone, {})[ch] = self._channel(ml, val, t)
        return out

    def _channel(self, ml, val, t):
        if isinstance(val, (int, float, str)):
            x = ml.eval(val)
            return np.array([x, x, x])
        if isinstance(val, list):
            return np.array([ml.eval(x) for x in val])
        frames = sorted(((float(k), v) for k, v in val.items()), key=lambda kv: kv[0])

        def fv(v, which="post"):
            if isinstance(v, dict):
                v = v.get(which, v.get("post", v.get("pre")))
            return np.array([ml.eval(x) for x in v])

        if t <= frames[0][0]:
            return fv(frames[0][1], "pre")
        if t >= frames[-1][0]:
            return fv(frames[-1][1])
        for i in range(len(frames) - 1):
            t0, v0 = frames[i]
            t1, v1 = frames[i + 1]
            if t0 <= t <= t1:
                s = (t - t0) / (t1 - t0) if t1 > t0 else 1.0
                p1, p2 = fv(v0), fv(v1, "pre")
                cat = (isinstance(v0, dict) and v0.get("lerp_mode") == "catmullrom") or \
                      (isinstance(v1, dict) and v1.get("lerp_mode") == "catmullrom")
                if not cat:
                    return p1 + (p2 - p1) * s
                p0 = fv(frames[i - 1][1]) if i > 0 else p1
                p3 = fv(frames[i + 2][1]) if i + 2 < len(frames) else p2
                s2, s3 = s * s, s * s * s
                return 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * s3)
        return fv(frames[-1][1])


class Controller:
    def __init__(self, data):
        self.d = data
        self.state = data.get("initial_state", "default")
        self.state_time = 0.0
        self.entered = True
        self.events = []

    def update(self, ml, anims, dt, frame_time):
        st = self.d["states"][self.state]
        names = [a if isinstance(a, str) else list(a)[0] for a in st.get("animations", [])]
        finished = all(anims[n].finished(self.state_time) for n in names) if names else True
        ml.queries["all_animations_finished"] = 1.0 if finished else 0.0
        ml.queries["any_animation_finished"] = 1.0 if (names and any(
            anims[n].finished(self.state_time) for n in names)) else 0.0
        for tr in st.get("transitions", []):
            (target, cond), = tr.items()
            if ml.eval(cond) != 0:
                self.state = target
                self.state_time = 0.0
                nst = self.d["states"][target]
                for scr in nst.get("on_entry", []):
                    ml.run(scr)
                for se in nst.get("sound_effects", []):
                    self.events.append((frame_time, "sound", se["effect"], None))
                for pe in nst.get("particle_effects", []):
                    self.events.append((frame_time, "particle", pe["effect"], pe.get("locator")))
                break
        else:
            self.state_time += dt
        st = self.d["states"][self.state]
        return [(a if isinstance(a, str) else list(a)[0],
                 "1" if isinstance(a, str) else list(a.values())[0]) for a in st.get("animations", [])]


class ClientSpider:
    """Simulated client-side render of one giant spider entity."""

    def __init__(self, props, files=None):
        files = files or load_files()
        self.ce, self.anim_data, self.ctrl_data = files
        self.desc = self.ce["minecraft:client_entity"]["description"]
        self.props = dict(props)
        self.pos = np.zeros(3)          # server tick position (x, y, z) world blocks
        self.yaw = 0.0
        self.alive = True
        self.life = 0.0
        self.q = {
            "delta_time": 0.0,
            "life_time": 0.0,
            "anim_time": 0.0,
            "is_alive": lambda: 1.0 if self.alive else 0.0,
            "property": lambda name: self.props[name],
            "position": lambda i: float(self.qpos[int(i)]),
            "body_y_rotation": lambda: self.yaw,
            "is_invisible": 0.0,
            "target_x_rotation": 0.0,
            "target_y_rotation": 0.0,
            "all_animations_finished": 0.0,
            "any_animation_finished": 0.0,
        }
        self.ml = Molang(queries=self.q)
        self.qpos = self.pos.copy()
        self.anims = {short: Anim(self.anim_data[full]) for short, full in self.desc["animations"].items()
                      if not full.startswith("controller.")}
        self.ctrls = {short: Controller(self.ctrl_data[full]) for short, full in self.desc["animations"].items()
                      if full.startswith("controller.")}
        self.anim_time = {}
        for scr in self.desc["scripts"].get("initialize", []):
            self.ml.run(scr)
        self.bones, self.locs, self.geo_source = skeleton()

    def frame(self, dt, qpos):
        self.life += dt
        self.qpos = qpos
        self.q["delta_time"] = dt
        self.q["life_time"] = self.life
        for scr in self.desc["scripts"]["pre_animation"]:
            self.ml.run(scr)
        channels = {}

        def blend(sample, w):
            for bone, chans in sample.items():
                for ch, v in chans.items():
                    dst = channels.setdefault(bone, {})
                    if ch == "scale":
                        dst[ch] = dst.get(ch, np.ones(3)) * (1 + (v - 1) * w)
                    else:
                        dst[ch] = dst.get(ch, np.zeros(3)) + v * w

        for entry in self.desc["scripts"]["animate"]:
            name, wexpr = (entry, "1") if isinstance(entry, str) else list(entry.items())[0]
            w = self.ml.eval(wexpr)
            if name in self.ctrls:
                for aname, aw in self.ctrls[name].update(self.ml, self.anims, dt, self.life):
                    t = self.ctrls[name].state_time
                    blend(self.anims[aname].sample(self.ml, t), w * self.ml.eval(aw))
            else:
                t = self.anim_time.get(name, 0.0)
                blend(self.anims[name].sample(self.ml, t), w)
                self.anim_time[name] = t + dt
        self.channels = channels
        return pose(self.bones, self.locs, channels)

    @property
    def v(self):
        return self.ml.vars


def load_files():
    ce = json.load(open(os.path.join(RP, "entity", "giant_spider.entity.json")))
    an = json.load(open(os.path.join(RP, "animations", "giant_spider.animation.json")))["animations"]
    ct = json.load(open(os.path.join(RP, "animation_controllers",
                                     "giant_spider.animation_controllers.json")))["animation_controllers"]
    return ce, an, ct


def base_props(giant=True, state="hunting", gscale=1.0, sscale=0.075):
    p = {"horror:state": state, "horror:giant": 1.0 if giant else 0.0, "horror:small_scale": sscale,
         "horror:giant_scale": gscale, "horror:grow_time": 4.0, "horror:attack_id": 0.0,
         "horror:attack_kind": 0.0, "horror:difficulty": 2.0}
    for i in range(8):
        p[f"horror:foot_{i}"] = 0.0
    return p


# --------------------------------------------------------------------------- scenario runner
LEG_NAMES = [G.leg_name(s, n) for s, n in G.LEGS]


def world_points(pts, render_pos, yaw_deg, wpp):
    """Posed px (root scale included) -> world blocks (wpp = 1/16). Bedrock yaw: 0 faces +Z;
    model -Z is forward (DESIGN §3)."""
    th = math.radians(yaw_deg)
    out = {}
    for k, p in pts.items():
        gx, gy, gz = p
        x = (gx * math.cos(th) + gz * math.sin(th)) * wpp
        z = (gx * math.sin(th) - gz * math.cos(th)) * wpp
        out[k] = np.array([render_pos[0] + x, render_pos[1] + gy * wpp, render_pos[2] + z])
    return out


def run_scenario(name, props, speed_fn, yaw_rate_fn=lambda t: 0.0, duration=8.0, fps=60.0,
                 jitter=0.15, qpos_interp=False, prop_fn=None, seed=1, files=None, record_every=0):
    """Simulate; returns dict with per-frame records."""
    rng = np.random.default_rng(seed)
    sp = ClientSpider(props, files)
    tick = 0.05
    t, next_tick = 0.0, 0.0
    pos_prev, pos = np.zeros(3), np.zeros(3)
    yaw_prev, yaw = 0.0, 0.0
    frames = []
    while t < duration:
        dt = (1.0 / fps) * (1 + jitter * (rng.random() * 2 - 1))
        t += dt
        while next_tick <= t:  # server ticks: advance position along the facing direction
            pos_prev, yaw_prev = pos.copy(), yaw
            v = speed_fn(next_tick)
            yaw = yaw + yaw_rate_fn(next_tick) * tick
            th = math.radians(yaw)
            pos = pos + np.array([-math.sin(th), 0, math.cos(th)]) * v * tick
            next_tick += tick
        alpha = min(1.0, max(0.0, 1 - (next_tick - t) / tick))
        render_pos = pos_prev + (pos - pos_prev) * alpha
        render_yaw = yaw_prev + (yaw - yaw_prev) * alpha
        sp.yaw = render_yaw
        if prop_fn:
            prop_fn(t, sp)
        qpos = render_pos if qpos_interp else pos
        pts = sp.frame(dt, qpos)
        wpp = sp.v["wpp"]
        # pose() already applies the root bone's scale (v.scale), so model px -> blocks is 1/16
        # (multiplying by wpp = scale/16 again shrank the small form a second time)
        wp = world_points(pts, render_pos, render_yaw, 1.0 / 16.0)
        rec = {"t": t, "gait": sp.v["gait"], "move": sp.v["move"], "run": sp.v["run"],
               "scale": sp.v["scale"], "wpp": wpp, "spd": sp.v["spd"], "true_speed": speed_fn(t),
               "w": wp, "m": pts, "bob": sp.v["bob_px"], "half": sp.v["half"]}
        if record_every and len(frames) % record_every == 0:
            rec["channels"] = {k: {c: v.copy() for c, v in d.items()} for k, d in sp.channels.items()}
        frames.append(rec)
    return {"name": name, "frames": frames, "spider": sp}


def leg_phase(gait, side, n):
    return math.fmod(gait + G.leg_constants(side, n)["phase"], 1.0)


def analyse(res, ground_fn=lambda leg: 0.0, scale_ref=1.0, steady=(1.2, 5.0), stop_at=None):
    """Per-stance slip/height and swing lift, knee orientation; returns metrics dict."""
    fr = res["frames"]
    m = {"max_h_err": 0.0, "max_slip": 0.0, "min_lift": 1e9, "knee_ok": True, "stances": 0,
         "max_h_err_all": 0.0, "max_slip_all": 0.0, "nan": False, "worst": ""}
    for side, n in G.LEGS:
        nm = G.leg_name(side, n)
        key = f"foot_tip_{nm}"
        stance = None
        swing_max = None
        for i, r in enumerate(fr):
            p = r["w"][key]
            if not np.all(np.isfinite(p)):
                m["nan"] = True
                continue
            ph = leg_phase(r["gait"], side, n)
            in_st = ph < 0.5
            # knee above the hip-ankle line (in model space; hip pivot = femur pivot)
            hp, kn, an = r["m"][f"pivot:femur_{nm}"], r["m"][f"pivot:tibia_{nm}"], r["m"][f"pivot:foot_{nm}"]
            uk = math.hypot(kn[0] - hp[0], kn[2] - hp[2])
            ua = math.hypot(an[0] - hp[0], an[2] - hp[2])
            if ua > 1e-6:
                line_y = hp[1] + (an[1] - hp[1]) * (uk / ua)
                if kn[1] <= line_y + 1e-6:
                    m["knee_ok"] = False
                    m["worst"] = f"{nm} knee below hip-ankle line at t={r['t']:.2f}"
            in_steady = steady[0] <= r["t"] <= steady[1]
            if in_st:
                h_err = abs(p[1] - ground_fn(nm)) / scale_ref
                m["max_h_err_all"] = max(m["max_h_err_all"], h_err)
                if in_steady:
                    m["max_h_err"] = max(m["max_h_err"], h_err)
                if stance is None:
                    stance = {"p0": p.copy(), "slip": 0.0, "t0": r["t"], "steady": in_steady}
                stance["slip"] = max(stance["slip"], math.hypot(p[0] - stance["p0"][0], p[2] - stance["p0"][2]))
                stance["steady"] = stance["steady"] and in_steady
                if swing_max is not None:
                    if steady[0] <= r["t"] <= steady[1] and swing_max[1]:
                        m["min_lift"] = min(m["min_lift"], swing_max[0] / scale_ref)
                    swing_max = None
            else:
                if stance is not None:
                    s = stance["slip"] / scale_ref
                    m["max_slip_all"] = max(m["max_slip_all"], s)
                    if stance["steady"]:
                        m["max_slip"] = max(m["max_slip"], s)
                        m["stances"] += 1
                    stance = None
                lift = p[1] - ground_fn(nm)
                full = r["move"] > 0.9
                if swing_max is None:
                    swing_max = [lift, full]
                else:
                    swing_max = [max(swing_max[0], lift), swing_max[1] and full]
    if m["min_lift"] == 1e9:
        m["min_lift"] = float("nan")
    if stop_at is not None:
        tail = [r for r in fr if r["t"] >= stop_at]
        last = [r for r in tail if r["t"] >= fr[-1]["t"] - 0.5]
        m["stop_h_err"] = max(abs(r["w"][f"foot_tip_{nm}"][1] - ground_fn(nm)) for r in last for nm in LEG_NAMES) / scale_ref
        mv = 0.0
        for a, b in zip(last, last[1:]):
            for nm in LEG_NAMES:
                d = np.linalg.norm(b["w"][f"foot_tip_{nm}"] - a["w"][f"foot_tip_{nm}"]) / (b["t"] - a["t"])
                mv = max(mv, d)
        m["stop_foot_speed"] = mv / scale_ref
        m["stop_gait_delta"] = abs(last[-1]["gait"] - last[0]["gait"])
        m["stop_move"] = last[-1]["move"]
    return m


# --------------------------------------------------------------------------- contact sheets
def draw_sheet(res, path, n=12, title="", t0=None, t1=None, view="side"):
    from PIL import Image, ImageDraw
    fr = res["frames"]
    t0 = fr[0]["t"] if t0 is None else t0
    t1 = fr[-1]["t"] if t1 is None else t1
    sel = []
    for i in range(n):
        tt = t0 + (t1 - t0) * i / max(1, n - 1)
        sel.append(min(fr, key=lambda r: abs(r["t"] - tt)))
    W, H = 300, 230
    cols = 4
    rows = (n + cols - 1) // cols
    img = Image.new("RGB", (cols * W, rows * H + 24), (238, 238, 232))
    d = ImageDraw.Draw(img)
    d.text((6, 4), title, fill=(0, 0, 0))
    for i, r in enumerate(sel):
        ox, oy = (i % cols) * W, (i // cols) * H + 24
        d.rectangle([ox, oy, ox + W - 1, oy + H - 1], outline=(150, 150, 150))
        m = r["m"]
        # model px -> image: side view (z horizontal, forward = left) or front view (x horizontal)
        sc = 0.42

        def P(p):
            if view == "side":
                return (ox + W / 2 + p[2] * sc, oy + H - 18 - p[1] * sc)
            if view == "front":
                return (ox + W / 2 - p[0] * sc, oy + H - 18 - p[1] * sc)
            return (ox + W / 2 - p[0] * sc * 0.55, oy + H / 2 + p[2] * sc * 0.55)  # top

        if view != "top":
            d.line([ox, oy + H - 18, ox + W, oy + H - 18], fill=(90, 140, 60), width=2)
        # body / torso / head / abdomen pivots as blobs
        for bn, rad, col in (("torso", 12, (60, 45, 38)), ("abdomen", 16, (50, 40, 35)), ("head", 8, (80, 30, 30))):
            k = "pivot:" + bn
            if k in m:
                x, y = P(m[k])
                d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=col)
        for side, nn in G.LEGS:
            nm = G.leg_name(side, nn)
            pts = [m[f"pivot:femur_{nm}"], m[f"pivot:tibia_{nm}"], m[f"pivot:foot_{nm}"], m[f"foot_tip_{nm}"]]
            ph = leg_phase(r["gait"], side, nn)
            col = (200, 40, 30) if ph >= 0.5 and r["move"] > 0.05 else ((40, 40, 40) if side == "l" else (90, 90, 140))
            xy = [P(p) for p in pts]
            d.line(xy[0:2], fill=col, width=5)
            d.line(xy[1:3], fill=col, width=3)
            d.line(xy[2:4], fill=col, width=2)
        d.text((ox + 4, oy + 4), f"t={r['t']:.2f} gait={r['gait']:.2f} mv={r['move']:.2f} run={r['run']:.2f}",
               fill=(0, 0, 0))
    img.save(path)
    return path


# --------------------------------------------------------------------------- main
def ramp(v, t_up=0.5, t_hold=4.5, t_down=0.3):
    def fn(t):
        if t < 0.2:
            return 0.0
        t -= 0.2
        if t < t_up:
            return v * t / t_up
        if t < t_up + t_hold:
            return v
        if t < t_up + t_hold + t_down:
            return v * (1 - (t - t_up - t_hold) / t_down)
        return 0.0
    return fn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/claude-0/work/anim/report")
    ap.add_argument("--sheet", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    files = load_files()
    print(f"skeleton source: {skeleton()[2]}")
    ok = True
    lines = []

    def check(cond, msg):
        nonlocal ok
        lines.append(("PASS " if cond else "FAIL ") + msg)
        print(lines[-1])
        ok = ok and cond

    # ---- giant: walk and run at several speeds, two frame rates, two q.position models
    STOP = 0.2 + 0.5 + 4.5 + 0.3
    DECEL = STOP - 0.3   # the ramp-down starts here; "steady" stances end before it (the
                         # deceleration is covered by the "incl. accel/decel" figure)
    for state, speeds in (("hunting", (1.5, 3.0, 6.0, 9.0, 11.0, 14.0)), ("cooldown", (2.0,))):
        for v in speeds:
            for fps, interp in ((60, False), (30, True), (24, False)):
                res = run_scenario(f"giant {state} {v} b/s", base_props(True, state), ramp(v),
                                   duration=STOP + 2.0, fps=fps, qpos_interp=interp, files=files)
                mt = analyse(res, steady=(1.6, DECEL - 0.05), stop_at=STOP)
                fr = res["frames"]
                st = [r for r in fr if 1.6 <= r["t"] <= DECEL - 0.05]
                runw = sum(r["run"] for r in st[-10:]) / 10
                check(not mt["nan"] and mt["knee_ok"] and mt["max_h_err"] < 0.15 and mt["max_slip"] < 0.25
                      and mt["min_lift"] > 1.5 and mt["stop_h_err"] < 0.15 and mt["stop_foot_speed"] < 0.05
                      and mt["stop_gait_delta"] < 1e-6 and mt["stances"] > 0,
                      f"giant {state:8s} {v:5.1f} b/s {fps}fps qpos={'interp' if interp else 'tick'}: "
                      f"stances={mt['stances']:3d} planted|dy|max={mt['max_h_err']:.3f} slip max={mt['max_slip']:.3f} "
                      f"(incl. accel/decel {mt['max_slip_all']:.3f}) min swing lift={mt['min_lift']:.2f} "
                      f"run={runw:.2f} knee_ok={mt['knee_ok']} stop: |dy|={mt['stop_h_err']:.3f} "
                      f"foot v={mt['stop_foot_speed']:.4f} gait frozen={mt['stop_gait_delta'] < 1e-6} {mt['worst']}")
                if args.sheet and fps == 60 and v in (3.0, 11.0) and state == "hunting":
                    draw_sheet(res, os.path.join(args.out, f"fk_giant_{state}_{int(v)}_side.png"), 12,
                               f"giant {state} {v} b/s side view (red = swing)", 2.0, 4.0)
                    draw_sheet(res, os.path.join(args.out, f"fk_giant_{state}_{int(v)}_front.png"), 8,
                               f"giant {state} {v} b/s front view", 2.0, 3.5, view="front")
                    draw_sheet(res, os.path.join(args.out, f"fk_giant_{state}_{int(v)}_top.png"), 8,
                               f"giant {state} {v} b/s top view", 2.0, 3.5, view="top")
    # ---- small form at small_scale 0.075 (thresholds scaled by size ratio)
    for state, v in (("stalking", 0.6), ("stalking", 1.5), ("idle", 1.0), ("cooldown", 3.0)):
        res = run_scenario(f"small {state} {v}", base_props(False, state), ramp(v), duration=STOP + 2.0,
                           fps=60, files=files)
        ratio = 0.075
        mt = analyse(res, scale_ref=ratio, steady=(1.6, DECEL - 0.05), stop_at=STOP)
        check(not mt["nan"] and mt["knee_ok"] and mt["max_h_err"] < 0.15 and mt["max_slip"] < 0.25
              and mt["min_lift"] > 1.5 and mt["stop_h_err"] < 0.15 and mt["stop_foot_speed"] < 0.05,
              f"small {state:8s} {v:4.1f} b/s: stances={mt['stances']} planted|dy|={mt['max_h_err'] * ratio:.4f} b "
              f"slip={mt['max_slip'] * ratio:.4f} b (= {mt['max_slip']:.3f} giant-equivalent) "
              f"lift={mt['min_lift'] * ratio:.3f} b knee_ok={mt['knee_ok']} stop |dy|={mt['stop_h_err'] * ratio:.4f}")
        if args.sheet and v == 1.5:
            draw_sheet(res, os.path.join(args.out, "fk_small_stalking_side.png"), 12,
                       "small stalking 1.5 b/s side view (model px)", 2.0, 3.0)
    # ---- turning in place: the gait must advance (legs step) and stop afterwards
    res = run_scenario("turn in place", base_props(True, "hunting"), lambda t: 0.0,
                       yaw_rate_fn=lambda t: 90.0 if 0.5 < t < 3.5 else 0.0, duration=5.5, files=files)
    fr = res["frames"]
    g_adv = sum(1 for a, b in zip(fr, fr[1:]) if 0.6 < a["t"] < 3.4 and abs(b["gait"] - a["gait"]) > 1e-9)
    lifted = max(max(r["w"][f"foot_tip_{nm}"][1] for nm in LEG_NAMES) for r in fr if 1 < r["t"] < 3.4)
    end = [r for r in fr if r["t"] > 5.0]
    settle = max(abs(r["w"][f"foot_tip_{nm}"][1]) for r in end for nm in LEG_NAMES)
    check(g_adv > 100 and lifted > 1.0 and settle < 0.15,
          f"turn in place 90 deg/s: gait advanced on {g_adv} frames, max foot lift {lifted:.2f} b, "
          f"after stop max |dy| {settle:.3f} b")
    # ---- walking a curve (informational slip, must stay finite and feet near ground)
    # (the turn stops together with the walk: a spider still turning in place keeps stepping)
    res = run_scenario("curve", base_props(True, "hunting"), ramp(6.0),
                       yaw_rate_fn=lambda t: 30.0 * ramp(6.0)(t) / 6.0, duration=STOP + 2, files=files)
    mt = analyse(res, steady=(1.6, DECEL - 0.05), stop_at=STOP)
    check(not mt["nan"] and mt["knee_ok"] and mt["max_h_err"] < 0.15 and mt["stop_h_err"] < 0.15,
          f"curve 6 b/s turning 30 deg/s: planted |dy| {mt['max_h_err']:.3f} slip {mt['max_slip']:.3f} b "
          f"(turning slip is expected; feet are re-placed every step)")
    # ---- terrain: hillside (left feet +3 blocks, right feet -4 blocks) and a step
    props = base_props(True, "hunting")
    terr = {"l1": 3.0, "l2": 2.5, "l3": 2.0, "l4": 1.5, "r1": -4.0, "r2": -3.5, "r3": -3.0, "r4": -4.5}
    for i, nm in enumerate(LEG_NAMES):
        props[f"horror:foot_{i}"] = terr[nm]
    res = run_scenario("terrain", props, ramp(4.0), duration=STOP + 2, files=files)
    mt = analyse(res, ground_fn=lambda nm: terr[nm], steady=(2.5, DECEL - 0.05), stop_at=STOP)
    check(not mt["nan"] and mt["knee_ok"] and mt["max_h_err"] < 0.15 and mt["max_slip"] < 0.25
          and mt["stop_h_err"] < 0.15,
          f"terrain (feet targets +3..-4.5 b) 4 b/s: planted |dy| {mt['max_h_err']:.3f} slip {mt['max_slip']:.3f} "
          f"stop |dy| {mt['stop_h_err']:.3f} knee_ok={mt['knee_ok']}")
    if args.sheet:
        draw_sheet(res, os.path.join(args.out, "fk_terrain_front.png"), 8, "terrain hillside front view",
                   3.0, 4.5, view="front")
    # ---- growth (stalking small -> growing giant -> hunting), feet stay on the ground
    def grow_props(t, sp):
        if t > 0.5:
            sp.props["horror:state"] = "growing"
            sp.props["horror:giant"] = 1.0
        if t > 5.0:
            sp.props["horror:state"] = "hunting"
    res = run_scenario("grow", base_props(False, "stalking"), lambda t: 0.0, duration=7.0, prop_fn=grow_props,
                       files=files)
    fr = res["frames"]
    sc_end = fr[-1]["scale"]
    hmax = max(abs(r["w"][f"foot_tip_{nm}"][1]) for r in fr for nm in LEG_NAMES if r["t"] > 5.8)
    hgrow = max(r["w"][f"foot_tip_{nm}"][1] for r in fr for nm in LEG_NAMES if 0.5 < r["t"] < 4.6)
    fin = all(np.all(np.isfinite(r["w"][f"foot_tip_{nm}"])) for r in fr for nm in LEG_NAMES)
    check(fin and abs(sc_end - 1.0) < 1e-6 and hmax < 0.15 and hgrow < 2.0,
          f"growth 0.075 -> 1.0 over grow_time 4 s: final scale {sc_end:.3f}, tremble lift max {hgrow:.2f} b, "
          f"settled |dy| {hmax:.3f} b")
    if args.sheet:
        draw_sheet(res, os.path.join(args.out, "fk_grow_side.png"), 8, "growing (model px, side)", 0.4, 5.6)
    # ---- reload during giant state: no growth replay, attack not replayed
    p = base_props(True, "hunting")
    p["horror:attack_id"] = 41.0
    res = run_scenario("reload", p, lambda t: 0.0, duration=1.5, files=files)
    sp = res["spider"]
    check(abs(res["frames"][0]["scale"] - 1.0) < 1e-9 and sp.ctrls["attack_controller"].state == "default"
          and not any(e[1] == "sound" for e in sp.ctrls["attack_controller"].events),
          f"reload as giant with attack_id=41: first-frame scale {res['frames'][0]['scale']:.3f}, attack "
          f"controller state '{sp.ctrls['attack_controller'].state}' (no replay)")
    # ---- attacks: each kind plays once per attack_id increment and returns to default
    for kind, anim in ((0, "attack_ground"), (1, "attack_high"), (2, "bite")):
        def atk(t, sp, kind=kind):
            if t > 1.0 and sp.props["horror:attack_id"] < 1:
                sp.props["horror:attack_id"] = 1.0
                sp.props["horror:attack_kind"] = float(kind)
        res = run_scenario(f"attack {kind}", base_props(True, "hunting"), lambda t: 0.0, duration=3.0, prop_fn=atk,
                           files=files, record_every=1)
        fr = res["frames"]
        c = res["spider"].ctrls["attack_controller"]
        played = [r["t"] for r in fr if any(abs(v).max() > 1e-6 for v in
                                            r["channels"].get("femur_l1" if kind < 2 else "head", {}).values())]
        states = sorted(set(round(x, 1) for x in played))
        fin = all(np.all(np.isfinite(r["w"][f"foot_tip_{nm}"])) for r in fr for nm in LEG_NAMES)
        check(fin and c.state == "default" and res["spider"].v["seen_attack"] == 1.0,
              f"attack kind {kind} ({anim}): controller back to default, seen_attack=1, finite pose")
        if args.sheet:
            draw_sheet(res, os.path.join(args.out, f"fk_{anim}_side.png"), 8, f"{anim} side view", 1.0, 2.1)
            draw_sheet(res, os.path.join(args.out, f"fk_{anim}_front.png"), 8, f"{anim} front view", 1.0, 2.1,
                       view="front")
    # ---- death
    def die(t, sp):
        if t > 0.5:
            sp.props["horror:state"] = "dying"
    res = run_scenario("death", base_props(True, "hunting"), lambda t: 0.0, duration=4.0, prop_fn=die, files=files)
    fr = res["frames"]
    fin = all(np.all(np.isfinite(r["w"][f"foot_tip_{nm}"])) for r in fr for nm in LEG_NAMES)
    body_y = fr[-1]["m"]["pivot:hip_l1"][1] / 16.0
    check(fin and res["spider"].ctrls["death_controller"].state == "dead" and body_y < 6.0,
          f"death: controller 'dead', final hip height {body_y:.2f} b (sinks), pose finite")
    if args.sheet:
        draw_sheet(res, os.path.join(args.out, "fk_death_side.png"), 8, "death side view", 0.4, 3.6)
        draw_sheet(res, os.path.join(args.out, "fk_death_front.png"), 8, "death front view", 0.4, 3.6, view="front")
    # ---- step controller: one step event per half gait cycle while moving
    res = run_scenario("steps", base_props(True, "hunting"), ramp(9.0), duration=STOP + 2, files=files)
    fr = res["frames"]
    ev = res["spider"].ctrls["steps_controller"].events
    snd = [e for e in ev if e[1] == "sound" and 1.6 < e[0] < STOP - 0.1]
    halves = sum(1 for a, b in zip(fr, fr[1:]) if 1.6 < a["t"] < STOP - 0.1 and a["half"] != b["half"])
    parts = [e for e in ev if e[1] == "particle" and 1.6 < e[0] < STOP - 0.1]
    late = [e for e in ev if e[1] == "sound" and e[0] > STOP + 0.6]
    check(abs(len(snd) - halves) <= 1 and len(parts) == 4 * len(snd) and not late and snd,
          f"steps controller (giant 9 b/s): {len(snd)} step_giant sounds for {halves} half-cycles, "
          f"{len(parts)} dust_plume particles, {len(late)} steps after stopping")
    res = run_scenario("steps small", base_props(False, "cooldown"), ramp(3.0), duration=STOP + 2, files=files)
    ev = res["spider"].ctrls["steps_controller"].events
    snd = [e for e in ev if e[1] == "sound" and 1.6 < e[0] < STOP - 0.1]
    check(snd and all(e[2] == "step_small" for e in snd) and not any(e[1] == "particle" for e in ev),
          f"steps controller (small 3 b/s): {len(snd)} step_small sounds, no dust")
    # Molang cost per frame
    ce = files[0]["minecraft:client_entity"]["description"]
    n_pre = sum(s.count(";") for s in ce["scripts"]["pre_animation"])
    per_leg = ce["scripts"]["pre_animation"][-1].count(";")
    check(per_leg <= 25, f"Molang cost: {n_pre} pre_animation statements per frame, {per_leg} per leg")
    with open(os.path.join(args.out, "report.txt"), "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
