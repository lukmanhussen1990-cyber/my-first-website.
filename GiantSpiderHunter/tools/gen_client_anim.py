#!/usr/bin/env python3
"""Generate the Giant Spider Hunter client-side files (resource pack).

Writes (deterministic, re-run after changing any constant):
  packs/GiantSpiderHunter_RP/entity/giant_spider.entity.json
  packs/GiantSpiderHunter_RP/animations/giant_spider.animation.json
  packs/GiantSpiderHunter_RP/animation_controllers/giant_spider.animation_controllers.json
  packs/GiantSpiderHunter_RP/render_controllers/giant_spider.render_controllers.json
  packs/GiantSpiderHunter_RP/texts/en_US.lang, texts/languages.json

Everything follows docs/DESIGN.md sections 3, 4, 6 and 8. The long per-leg Molang (gait + 2-bone
IK) is generated here so all 8 legs stay consistent. docs/ANIMATION.md explains the maths.

Rotation conventions (Bedrock model space, verified against the vanilla spider default_leg_pose,
see docs/ANIMATION.md):
  * a bone extending along +X (left leg): positive Z rotation lowers its tip
  * a bone extending along -X (right leg): positive Z rotation raises its tip
  * left hip: positive Y rotation swings the leg forward (-Z); right hip: negative Y
  * positive X rotation pitches the front (-Z end) of a bone down / raises its +Z end
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP")
ENTITY_ID = "horror:giant_spider"
NAME = "Giant Spider Hunter"

# --------------------------------------------------------------------------- DESIGN.md §4
# (docs/MODEL.md; must match tools/gen_geometry.py exactly)
HIP_X = 34.0
HIP_Y = 206.0
HIP_Z = [-34.0, -16.0, 2.0, 20.0]          # pair 1..4, front -> back
K = [1.08, 1.00, 0.96, 1.04]               # per-pair length factor
L1_BASE, L2_BASE, L3_BASE = 160.0, 220.0, 200.0   # femur / tibia / metatarsus+tarsus+claw
R_BASE = 270.0                              # neutral foot horizontal radius from hip
NEUTRAL_ANGLE = [52.0, 20.0, -16.0, -48.0]  # from the lateral axis toward forward
FOOT_TILT = 8.0                             # metatarsus tilted outward from vertical

# --------------------------------------------------------------------------- DESIGN.md §8
# Gait (docs/VISUAL_PLAN.md M3/M4, docs/ANIMATION.md). The stride follows the speed like a real
# legged animal (Alexander's dynamic-similarity rule: cycle length / hip height = 2.3 * Fr^0.3,
# Fr = v^2 / (g * hip height)), so the giant takes slow heavy steps when it walks (a step every
# ~3 s at 1.5 b/s) and long ones when it runs (~1.8 s per step at 9 b/s, scale 1.4).
STRIDE_K = 237.0                            # px; = 2.3 * HIP_Y / 2 (half cycle = one step)
STRIDE_V0 = 11.2                            # b/s; = sqrt(9.8 * HIP_Y / 16) at scale 1
STRIDE_MIN, STRIDE_MAX = 60.0, 200.0        # px, foot travel along the body axis per stance
LIFT_BASE, LIFT_PER_STRIDE = 35.0, 0.35     # swing lift px = clamp(35 + 0.35 * stride, 55, 100)
LIFT_MIN, LIFT_MAX = 55.0, 100.0            # (~half the body height at a run, like ref_giant_walk)
SWING_REACH = 1.15                          # the foot reaches its landing point at 1/1.15 of the swing,
                                            # then plants straight down
LIFT_SHAPE = 0.7                            # lift = sin(180 w)^0.7: high, flat-topped arc
TUCK = 22.0                                 # metatarsus swings this much inward at mid-swing
DEATH_TILT = 32.0                           # metatarsus splays outward by this much when dead
SPD_KP, SPD_KV = 6.0, 12.0                  # distance tracker (PLL): lag 1/KP s, smooth speed
PAIR_PHASE = [0.0, 0.02, 0.04, 0.06]        # small metachronal offsets (<= 0.06)
GROUP_A = {"l1", "r2", "l3", "r4"}          # phase 0; group B {r1, l2, r3, l4} phase 0.5
TERRAIN_CLAMP_PX = 220.0
STEP_DELAY = 0.03                           # step sound/dust slightly after the first touchdown
# idle fidget: after FIDGET_DELAY s of standing still, three legs occasionally lift and replant
# (solved in the IK, so the foot comes back down exactly where it was)
FIDGET_DELAY = 3.0
FIDGET = {"l2": (1.3, 6.1, 30.0), "r3": (4.2, 7.3, 24.0), "r1": (2.6, 8.9, 34.0)}  # offset, period, px
FIDGET_LEN = 0.7

LEGS = [(side, n) for side in ("l", "r") for n in (1, 2, 3, 4)]   # foot_0..7 order


def leg_name(side, n):
    return f"{side}{n}"


def foot_index(side, n):
    return (0 if side == "l" else 4) + (n - 1)


def leg_constants(side, n):
    k = K[n - 1]
    a = math.radians(NEUTRAL_ANGLE[n - 1])
    R = R_BASE * k
    L1, L2, L3 = L1_BASE * k, L2_BASE * k, L3_BASE * k
    group_a = leg_name(side, n) in GROUP_A
    return {
        "k": k, "L1": L1, "L2": L2, "L3": L3,
        "dx": R * math.cos(a),             # outward (lateral) distance hip -> neutral foot
        "dzn": -R * math.sin(a),           # z offset hip -> neutral foot (forward = -Z)
        "dmin": abs(L1 - L2) + 1.0,
        "dmax": L1 + L2 - 1.0,
        "phase": (0.0 if group_a else 0.5) + PAIR_PHASE[n - 1],
        "hip": ((HIP_X if side == "l" else -HIP_X), HIP_Y, HIP_Z[n - 1]),
        "group_a": group_a,
        "tremble": ((n - 1) * 90 + (0 if side == "l" else 45)) % 360,
    }


def f(x, nd=4):
    """Compact number formatting for Molang."""
    s = f"{x:.{nd}f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


# --------------------------------------------------------------------------- pre_animation
def pre_animation():
    s = []
    # 1. properties, size blending ------------------------------------------------------
    s.append(
        "v.dt = math.clamp(q.delta_time, 0, 0.25);"
        "v.age = (v.age ?? 0) + v.dt;"
        "v.dying = q.property('horror:state') == 'dying' || !q.is_alive;"
        "v.hunting = q.property('horror:state') == 'hunting';"
        "t.target = q.property('horror:giant') ? 1 : 0;"
        "t.sb = v.size_blend ?? t.target;"
        "t.rate = v.dt / math.max(q.property('horror:grow_time'), 0.5);"
        "v.size_blend = v.age < 0.3 ? t.target : (t.target > t.sb ? math.min(t.target, t.sb + t.rate) : math.max(t.target, t.sb - t.rate));"
        "v.ease = math.hermite_blend(v.size_blend);"
        "v.scale = math.lerp(q.property('horror:small_scale'), q.property('horror:giant_scale'), v.ease);"
        "v.wpp = math.max(v.scale, 0.001) / 16;"
        "v.tw = math.clamp((v.size_blend - 0.5) * 4, 0, 1);"
        "v.grow_flex = math.sin(v.size_blend * 180);"
        "v.seen_attack = v.age < 0.3 ? q.property('horror:attack_id') : (v.seen_attack ?? q.property('horror:attack_id'));"
    )
    # 2. motion: slip-free distance (from the entity position), turning, gait phase -------
    # q.position may update only on the 20 Hz server tick while frames run at 24-60 fps, so the
    # distance moved is fed through a tracking filter (v.dpend = distance not yet walked,
    # v.spd = smooth speed estimate, lag 1/KP s). Every metre consumed advances the gait by
    # exactly the distance the planted feet travel, so they do not slip.
    s.append(
        "t.x = q.position(0);"
        "t.z = q.position(2);"
        "t.dx = t.x - (v.px ?? t.x);"
        "t.dz = t.z - (v.pz ?? t.z);"
        "v.px = t.x;"
        "v.pz = t.z;"
        "t.dd = math.sqrt(t.dx * t.dx + t.dz * t.dz);"
        "t.yaw = q.body_y_rotation;"
        "t.turn = math.min(math.abs(math.min_angle(t.yaw - (v.pyaw ?? t.yaw))), 120 * v.dt);"
        "v.pyaw = t.yaw;"
        "v.dpend = (v.dpend ?? 0) + (t.dd < 6 ? t.dd : 0) + t.turn * 1.5708 * v.wpp;"
        f"v.spd = math.lerp(v.spd ?? 0, v.dpend * {f(SPD_KP)}, math.min(1, v.dt * {f(SPD_KV)}));"
        "t.use = math.min(v.dpend, math.max(v.spd, 0) * v.dt);"
        "v.dpend = v.dpend - t.use;"
        "t.mt = math.clamp((v.spd - 0.03) / (0.1 + 0.5 * v.scale), 0, 1);"
        "v.move = math.lerp(v.move ?? 0, t.mt, math.min(1, v.dt * 5));"
        "t.rt = v.hunting * math.clamp((v.spd - 3) / 2.5, 0, 1);"
        "v.run = math.lerp(v.run ?? 0, t.rt, math.min(1, v.dt * 1.5));"
        # speed-dependent stride; frozen while standing so a stopped gait stays exactly still
        f"t.so = v.stride ?? {f(STRIDE_MIN)};"
        f"t.st = math.clamp({f(STRIDE_K)} * math.pow(math.max(v.spd, 0) / ({f(STRIDE_V0)} * math.sqrt(v.scale)), 0.6),"
        f" {f(STRIDE_MIN)}, {f(STRIDE_MAX)});"
        "v.stride = v.move > 0.05 ? math.lerp(t.so, t.st, math.min(1, v.dt * 2)) : t.so;"
        f"v.lift = math.clamp({f(LIFT_BASE)} + {f(LIFT_PER_STRIDE)} * v.stride, {f(LIFT_MIN)}, {f(LIFT_MAX)}) * v.move;"
        "t.pa = math.mod(v.gait ?? 0.25, 1);"
        "t.sa = t.pa < 0.5 ? t.pa * 2 : t.pa * 2 - 1;"
        # (0.5 - t.sa) * (1 - so / stride) keeps the planted feet in place when the stride changes
        "v.gait = math.mod(t.pa + (0.5 - t.sa) * (1 - t.so / v.stride) * 0.5 + math.min(t.use / (2 * v.stride * v.wpp), 0.2) + 1, 1);"
        "v.half = math.mod(v.gait + %s, 1) < 0.5 ? 0 : 1;" % f(1 - STEP_DELAY)
    )
    # 3. posture weights, terrain smoothing, body height ---------------------------------
    fh = []
    for side, n in LEGS:
        nm = leg_name(side, n)
        fh.append(f"v.fh_{nm} = math.lerp(v.fh_{nm} ?? 0, q.property('horror:foot_{foot_index(side, n)}'), t.k);")
    avg = " + ".join(f"v.fh_{leg_name(s_, n_)}" for s_, n_ in LEGS)
    s.append(
        "v.stalk = math.lerp(v.stalk ?? 0, q.property('horror:state') == 'stalking', math.min(1, v.dt * 2));"
        "v.grow_w = math.lerp(v.grow_w ?? 0, q.property('horror:state') == 'growing', math.min(1, v.dt * 3));"
        "v.dead = v.dying ? math.min(1, (v.dead ?? 0) + v.dt / 1.6) : math.max(0, (v.dead ?? 0) - v.dt);"
        "v.dead_e = math.hermite_blend(v.dead);"
        "v.reach = (1 - 0.2 * v.dead_e) * (1 + 0.1 * v.grow_w * v.grow_flex);"
        "v.gtrem = 26 * v.grow_w * v.grow_flex;"
        "t.k = math.min(1, v.dt * 3);"
        + "".join(fh) +
        f"t.avg = ({avg}) / 8;"
        # body: sinks just after each touchdown and rises through the stance (one bob per step),
        # runs lower; stalking crouch; death drop; average terrain height
        "v.bob_px = (-math.cos(math.mod(v.gait, 0.5) * 720 - 36) * (3 + 4 * v.run) - 14 * v.run) * v.move"
        " - 30 * v.stalk - 150 * v.dead_e + math.clamp(t.avg / v.wpp * 0.4, -64, 64) * v.tw;"
        f"v.hipy = {f(HIP_Y)} + v.bob_px;"
        # idle fidget weight: only after standing still (not growing, not dying) for a while
        "v.still = (v.move > 0.05 || v.grow_w > 0.05 || v.dying) ? 0 : (v.still ?? 0) + v.dt;"
        f"v.fid = math.clamp(v.still - {f(FIDGET_DELAY)}, 0, 1);"
    )
    # 4. per-leg gait + 2-bone IK (one complex expression per leg) -----------------------
    for side, n in LEGS:
        s.append(leg_script(side, n))
    return s


def leg_script(side, n):
    """Gait foot target + metatarsus angle + 2-bone IK (femur/tibia) for one leg.

    Stance (p < 0.5): the foot moves linearly from +S/2 to -S/2 along the body axis (planted).
    Swing: the foot reaches its landing point at 1/SWING_REACH of the swing and then plants
    straight down; lift = H * sin(180 w)^LIFT_SHAPE (rises fast, carried high, decisive plant).
    The metatarsus tilts FOOT_TILT outward when planted and tucks TUCK inward at mid-swing."""
    c = leg_constants(side, n)
    nm = leg_name(side, n)
    L1, L3 = c["L1"], c["L3"]
    sgn = "" if side == "l" else "-"
    fid = ""
    if nm in FIDGET:
        o, per, amp = FIDGET[nm]
        fid = (f" + v.fid * (math.mod(q.life_time + {f(o)}, {f(per)}) < {f(FIDGET_LEN)})"
               f" * math.sin(math.mod(q.life_time + {f(o)}, {f(per)}) * {f(180 / FIDGET_LEN)}) * {f(amp)}")
    return (
        f"t.p = math.mod(v.gait + {f(c['phase'])}, 1);"
        "t.w = math.max(t.p * 2 - 1, 0);"
        "t.sw = math.sin(t.w * 180);"
        f"t.f = v.stride * (t.p < 0.5 ? 0.5 - t.p * 2 : math.hermite_blend(math.min(t.w * {f(SWING_REACH)}, 1)) - 0.5);"
        f"t.tl = {f(FOOT_TILT)} + {f(DEATH_TILT)} * v.dead_e - {f(TUCK)} * t.sw * v.move;"
        f"t.dx = {f(c['dx'])} * v.reach;"
        f"t.dz = {f(c['dzn'])} - t.f;"
        f"t.au = math.sqrt(t.dx * t.dx + t.dz * t.dz) - {f(L3)} * math.sin(t.tl);"
        f"t.av = math.clamp(v.fh_{nm} / v.wpp, -{f(TERRAIN_CLAMP_PX)}, {f(TERRAIN_CLAMP_PX)}) * v.tw"
        f" + v.lift * math.pow(t.sw, {f(LIFT_SHAPE)})"
        f" + v.gtrem * math.max(0, math.sin(q.life_time * 260 + {f(c['tremble'])})){fid}"
        f" - v.hipy + {f(L3)} * math.cos(t.tl);"
        f"t.d = math.clamp(math.sqrt(t.au * t.au + t.av * t.av), {f(c['dmin'])}, {f(c['dmax'])});"
        f"t.a = math.atan2(t.av, t.au) + math.acos(math.clamp((t.d * t.d - {f(c['L2'] ** 2 - L1 * L1, 2)})"
        f" / ({f(2 * L1)} * t.d), -1, 1));"
        f"t.t = math.atan2(t.av - {f(L1)} * math.sin(t.a), t.au - {f(L1)} * math.cos(t.a));"
        f"v.hip_{nm} = {sgn}math.atan2(-t.dz, t.dx);"
        f"v.fem_{nm} = {'-' if side == 'l' else ''}t.a;"
        f"v.tib_{nm} = {'t.a - t.t' if side == 'l' else 't.t - t.a'};"
        f"v.ft_{nm} = {'t.t + 90 - t.tl' if side == 'l' else '-t.t - 90 + t.tl'};"
    )


# --------------------------------------------------------------------------- animation helpers
def vec(x=0, y=0, z=0):
    return [x, y, z]


def neg(expr):
    """Negate a Molang expression or number."""
    if isinstance(expr, (int, float)):
        return -expr
    return f"-({expr})"


def add_leg(bones, side, n, raise_=None, fold=None, foot=None, fwd=None):
    """Additive leg deltas in 'semantic' units, mirrored for the right side.

    raise_ : femur elevation (+ = up), fold : tibia folds down/inward (+), foot: foot folds (+),
    fwd : hip yaw toward the front (+). Values may be numbers, Molang strings or keyframe dicts
    (dict values are lists [x, y, z] in semantic units on the relevant axis only).
    """
    nm = leg_name(side, n)
    left = side == "l"

    def conv(v, sign_left):
        s = sign_left if left else -sign_left
        if isinstance(v, dict):
            return {t: conv(val, sign_left) for t, val in v.items()}
        if isinstance(v, list):
            return [conv(x, sign_left) for x in v]
        if s > 0:
            return v
        return neg(v)

    def put(bone, axis, v, sign_left):
        if v is None:
            return
        val = conv(v, sign_left)
        if isinstance(val, dict):
            frames = {}
            for t, x in val.items():
                arr = [0, 0, 0]
                arr[axis] = x
                frames[t] = {"post": arr, "lerp_mode": "catmullrom"}
            bones.setdefault(bone, {})["rotation"] = frames
        else:
            arr = [0, 0, 0]
            arr[axis] = val
            bones.setdefault(bone, {})["rotation"] = arr

    put(f"hip_{nm}", 1, fwd, +1)
    put(f"femur_{nm}", 2, raise_, -1)
    put(f"tibia_{nm}", 2, fold, +1)
    put(f"foot_{nm}", 2, foot, +1)


def keys(pairs, axis=None):
    """{time: value} -> catmullrom keyframe dict for a rotation/position channel."""
    out = {}
    for t, v in pairs:
        val = v if isinstance(v, list) else [v, 0, 0]
        if axis is not None and not isinstance(v, list):
            val = [0, 0, 0]
            val[axis] = v
        out[f(t, 4) if t != int(t) else f"{t:.1f}"] = {"post": val, "lerp_mode": "catmullrom"}
    return out


def semantic_keys(pairs):
    return {(f(t, 4) if t != int(t) else f"{t:.1f}"): v for t, v in pairs}


# --------------------------------------------------------------------------- animations
def animations():
    A = {}
    # size: uniform scale of the whole model around the ground point
    A["animation.horror.giant_spider.size"] = {
        "loop": True,
        "bones": {"root": {"scale": ["v.scale", "v.scale", "v.scale"]}},
    }
    # legs_ik: absolute IK angles + body height
    bones = {"body": {"position": [0, "v.bob_px", 0]}}
    for side, n in LEGS:
        nm = leg_name(side, n)
        bones[f"hip_{nm}"] = {"rotation": [0, f"v.hip_{nm}", 0]}
        bones[f"femur_{nm}"] = {"rotation": [0, 0, f"v.fem_{nm}"]}
        bones[f"tibia_{nm}"] = {"rotation": [0, 0, f"v.tib_{nm}"]}
        bones[f"foot_{nm}"] = {"rotation": [0, 0, f"v.ft_{nm}"]}
    A["animation.horror.giant_spider.legs_ik"] = {"loop": True, "bones": bones}

    # idle (weight 1 - move): breathing, abdomen pulse, fang twitch, occasional leg twitch
    bones = {
        "torso": {
            "position": [0, "math.sin(q.life_time * 72) * 0.8", 0],
            "rotation": ["math.sin(q.life_time * 72 + 40) * 0.6", 0, "math.sin(q.life_time * 31) * 0.4"],
        },
        "abdomen": {
            "rotation": ["math.sin(q.life_time * 72 - 30) * 1.6", "math.sin(q.life_time * 23) * 1.2", 0],
        },
        "head": {"rotation": ["math.sin(q.life_time * 55) * 1.2", 0, 0]},
        "fang_l": {"rotation": ["(math.mod(q.life_time, 3.7) < 0.45) * math.sin(q.life_time * 1600) * 6", 0,
                                "4 + (math.mod(q.life_time, 3.7) < 0.45) * math.sin(q.life_time * 1600) * 9"]},
        "fang_r": {"rotation": ["(math.mod(q.life_time, 3.7) < 0.45) * math.sin(q.life_time * 1600) * 6", 0,
                                "-4 - (math.mod(q.life_time, 3.7) < 0.45) * math.sin(q.life_time * 1600) * 9"]},
    }
    # (the occasional leg fidget is solved in the IK so the foot replants where it was: FIDGET)
    A["animation.horror.giant_spider.idle"] = {"loop": True, "bones": bones}

    # stalk (weight v.stalk; the crouch itself is in pre_animation)
    bones = {
        "torso": {"rotation": [4, 0, 0]},
        "head": {"rotation": ["3 + math.sin(q.life_time * 40) * 3",
                              "math.sin(q.life_time * 33) * 6 + math.sin(q.life_time * 108) * 2",
                              "math.sin(q.life_time * 33) * 2"]},
        "abdomen": {"rotation": ["14 + (math.mod(q.life_time, 2.3) < 0.5) * math.sin(q.life_time * 1300) * 3",
                                 "math.sin(q.life_time * 27) * 3", 0]},
        "fang_l": {"rotation": [0, 0, "6 + math.sin(q.life_time * 90) * 3"]},
        "fang_r": {"rotation": [0, 0, "-6 - math.sin(q.life_time * 90) * 3"]},
    }
    A["animation.horror.giant_spider.stalk"] = {"loop": True, "bones": bones}

    # walk (weight move * (1 - run)): restrained sway synced to the gait
    A["animation.horror.giant_spider.walk"] = {
        "loop": True,
        "bones": {
            "torso": {"rotation": ["math.sin(v.gait * 720 + 50) * 1.0", "math.sin(v.gait * 360) * 1.0",
                                   "math.sin(v.gait * 360 + 90) * 1.5"]},
            "abdomen": {"rotation": ["math.sin(v.gait * 720 - 40) * 1.5", "math.sin(v.gait * 360 + 150) * 1.5",
                                     "math.sin(v.gait * 360 + 60) * 1.0"]},
            "head": {"rotation": ["math.sin(v.gait * 720 + 100) * 1.2", "math.sin(v.gait * 360 + 200) * 1.5", 0]},
        },
    }
    # run (weight move * run): forward lean, stronger bounce, abdomen bounce
    A["animation.horror.giant_spider.run"] = {
        "loop": True,
        "bones": {
            "torso": {"rotation": ["4 + math.sin(v.gait * 720 + 50) * 2", "math.sin(v.gait * 360) * 1.5",
                                   "math.sin(v.gait * 360 + 90) * 2.5"]},
            "abdomen": {"rotation": ["-3 + math.sin(v.gait * 720 - 70) * 2.5", "math.sin(v.gait * 360 + 150) * 2.5", 0]},
            "head": {"rotation": ["-6 + math.sin(v.gait * 720 + 120) * 2", 0, 0]},
            "fang_l": {"rotation": [0, 0, "-6 + math.sin(v.gait * 720) * 4"]},
            "fang_r": {"rotation": [0, 0, "6 - math.sin(v.gait * 720) * 4"]},
        },
    }
    # grow (weight v.grow_w): shudder, rear up, legs flex and splay while scaling up
    bones = {
        "torso": {"rotation": ["-8 * v.grow_flex + math.sin(q.life_time * 2100) * 1.4",
                               "math.sin(q.life_time * 1700) * 1.1",
                               "math.sin(q.life_time * 1900) * 1.4"]},
        "head": {"rotation": ["-14 * v.grow_flex + math.sin(q.life_time * 2400) * 2", 0, 0]},
        "abdomen": {"rotation": ["10 * v.grow_flex + math.sin(q.life_time * 1500) * 3", 0, 0]},
        "fang_l": {"rotation": [0, 0, "-18 * v.grow_flex + math.sin(q.life_time * 2000) * 5"]},
        "fang_r": {"rotation": [0, 0, "18 * v.grow_flex - math.sin(q.life_time * 2000) * 5"]},
    }
    # (the legs' flex/splay/tremble while growing is solved in the IK so the feet stay planted:
    #  see v.gtrem and v.reach in pre_animation)
    A["animation.horror.giant_spider.grow"] = {"loop": True, "bones": bones}

    # attack_ground (kind 0): wind-up (front legs rise, body rears) -> stab down at ~0.35 s
    bones = {
        "torso": {"rotation": keys([(0, 0), (0.25, -13), (0.36, 6), (0.55, 4), (1.0, 0)])},
        "head": {"rotation": keys([(0, 0), (0.25, -12), (0.36, 14), (0.6, 8), (1.0, 0)])},
        "abdomen": {"rotation": keys([(0, 0), (0.25, 10), (0.38, -6), (1.0, 0)])},
        "fang_l": {"rotation": keys([(0, 0), (0.25, -20), (0.36, 12), (0.7, 0), (1.0, 0)], axis=2)},
        "fang_r": {"rotation": keys([(0, 0), (0.25, 20), (0.36, -12), (0.7, 0), (1.0, 0)], axis=2)},
    }
    for side in ("l", "r"):
        add_leg(bones, side, 1,
                raise_=semantic_keys([(0, 0), (0.22, 58), (0.28, 60), (0.36, -6), (0.55, -4), (1.0, 0)]),
                fold=semantic_keys([(0, 0), (0.22, -45), (0.28, -40), (0.36, 6), (0.55, 4), (1.0, 0)]),
                fwd=semantic_keys([(0, 0), (0.22, 12), (0.36, 6), (1.0, 0)]))
        add_leg(bones, side, 2,
                raise_=semantic_keys([(0, 0), (0.25, 16), (0.38, -2), (1.0, 0)]),
                fold=semantic_keys([(0, 0), (0.25, -8), (0.38, 2), (1.0, 0)]))
    A["animation.horror.giant_spider.attack_ground"] = {
        "loop": False,
        "animation_length": 1.0,
        "bones": bones,
        "particle_effects": {
            "0.36": [{"effect": "dust_plume", "locator": "foot_tip_l1"},
                     {"effect": "dust_plume", "locator": "foot_tip_r1"}],
        },
    }
    # attack_high (kind 1): front legs sweep up and inward toward an airborne target
    bones = {
        "torso": {"rotation": keys([(0, 0), (0.3, -20), (0.45, -24), (0.7, -8), (1.0, 0)])},
        "head": {"rotation": keys([(0, 0), (0.3, -22), (0.45, -26), (1.0, 0)])},
        "abdomen": {"rotation": keys([(0, 0), (0.3, 12), (0.5, 8), (1.0, 0)])},
        "fang_l": {"rotation": keys([(0, 0), (0.3, -22), (0.45, 14), (0.8, 0), (1.0, 0)], axis=2)},
        "fang_r": {"rotation": keys([(0, 0), (0.3, 22), (0.45, -14), (0.8, 0), (1.0, 0)], axis=2)},
    }
    for side in ("l", "r"):
        add_leg(bones, side, 1,
                raise_=semantic_keys([(0, 0), (0.3, 70), (0.44, 88), (0.6, 70), (1.0, 0)]),
                fold=semantic_keys([(0, 0), (0.3, -95), (0.44, -55), (0.6, -40), (1.0, 0)]),
                foot=semantic_keys([(0, 0), (0.3, -20), (0.44, 25), (1.0, 0)]),
                fwd=semantic_keys([(0, 0), (0.3, -6), (0.44, 22), (0.6, 14), (1.0, 0)]))
        add_leg(bones, side, 2,
                raise_=semantic_keys([(0, 0), (0.32, 34), (0.46, 40), (1.0, 0)]),
                fold=semantic_keys([(0, 0), (0.32, -40), (0.46, -25), (1.0, 0)]),
                fwd=semantic_keys([(0, 0), (0.32, 4), (0.46, 12), (1.0, 0)]))
    A["animation.horror.giant_spider.attack_high"] = {
        "loop": False, "animation_length": 1.0, "bones": bones}
    # bite (kind 2): head lunge + fangs snap
    A["animation.horror.giant_spider.bite"] = {
        "loop": False,
        "animation_length": 0.6,
        "bones": {
            "torso": {"rotation": keys([(0, 0), (0.14, -5), (0.28, 9), (0.6, 0)]),
                      "position": keys([(0, 0), (0.14, 3), (0.28, -8), (0.6, 0)], axis=2)},
            "head": {"rotation": keys([(0, 0), (0.14, -16), (0.28, 22), (0.42, 10), (0.6, 0)]),
                     "position": keys([(0, 0), (0.14, 2), (0.28, -10), (0.6, 0)], axis=2)},
            "fang_l": {"rotation": keys([(0, 0), (0.14, [-12, 0, -28]), (0.26, [10, 0, 16]), (0.4, [4, 0, 6]), (0.6, 0)])},
            "fang_r": {"rotation": keys([(0, 0), (0.14, [-12, 0, 28]), (0.26, [10, 0, -16]), (0.4, [4, 0, -6]), (0.6, 0)])},
        },
    }
    # death: legs curl inward and up, body sinks (pre_animation), shudders; holds final pose
    shudder = "math.sin(q.anim_time * 1500) * 3 * math.max(0, 1 - q.anim_time / 2.2)"
    bones = {
        "torso": {"rotation": [f"6 + {shudder}", 0, f"{shudder} * 0.8"]},
        "head": {"rotation": keys([(0, 0), (0.8, 16), (2.5, 22)])},
        "abdomen": {"rotation": keys([(0, 0), (1.0, -8), (2.5, -12)])},
        "fang_l": {"rotation": keys([(0, 0), (0.5, -25), (1.6, 18), (2.5, 22)], axis=2)},
        "fang_r": {"rotation": keys([(0, 0), (0.5, 25), (1.6, -18), (2.5, -22)], axis=2)},
    }
    for side, n in LEGS:
        d = (n - 1) * 0.12 + (0.0 if side == "l" else 0.06)
        add_leg(bones, side, n,
                raise_=semantic_keys([(0, 0), (0.6 + d, 18), (1.4 + d, 34), (2.5, 38)]),
                fold=semantic_keys([(0, 0), (0.6 + d, 35), (1.4 + d, 62), (2.5, 70)]),
                foot=semantic_keys([(0, 0), (0.6 + d, 25), (1.4 + d, 50), (2.5, 55)]),
                fwd=semantic_keys([(0, 0), (1.4 + d, {1: -10, 2: -4, 3: 4, 4: 10}[n]), (2.5, {1: -12, 2: -5, 3: 5, 4: 12}[n])]))
    A["animation.horror.giant_spider.death"] = {
        "loop": "hold_on_last_frame", "animation_length": 2.5, "bones": bones}
    # look_at_target
    A["animation.horror.giant_spider.look_at_target"] = {
        "loop": True,
        "bones": {"head": {"rotation": ["math.clamp(q.target_x_rotation, -30, 30)",
                                        "math.clamp(q.target_y_rotation, -35, 35)", 0]}},
    }
    # convert semantic keyframe dicts written by add_leg into catmullrom keyframes
    for anim in A.values():
        for bone in anim.get("bones", {}).values():
            for ch, val in bone.items():
                if isinstance(val, dict):
                    for t, kf in list(val.items()):
                        if not isinstance(kf, dict):
                            val[t] = {"post": kf, "lerp_mode": "catmullrom"}
    return {"format_version": "1.8.0", "animations": A}


# --------------------------------------------------------------------------- controllers
def controllers():
    atk = "q.property('horror:attack_id') != v.seen_attack && !v.dying && q.property('horror:attack_kind') == "
    on_entry = ["v.seen_attack = q.property('horror:attack_id');"]
    attack = {
        "initial_state": "default",
        "states": {
            "default": {
                "transitions": [{"ground": atk + "0"}, {"high": atk + "1"}, {"bite": atk + "2"}],
                "blend_transition": 0.2,
            },
            "ground": {"animations": ["attack_ground"], "on_entry": on_entry,
                       "transitions": [{"default": "q.all_animations_finished || v.dying"}],
                       "blend_transition": 0.15},
            "high": {"animations": ["attack_high"], "on_entry": on_entry,
                     "transitions": [{"default": "q.all_animations_finished || v.dying"}],
                     "blend_transition": 0.15},
            "bite": {"animations": ["bite"], "on_entry": on_entry,
                     "transitions": [{"default": "q.all_animations_finished || v.dying"}],
                     "blend_transition": 0.1},
        },
    }
    group_a = [leg_name(s, n) for s, n in LEGS if leg_name(s, n) in GROUP_A]
    group_b = [leg_name(s, n) for s, n in LEGS if leg_name(s, n) not in GROUP_A]
    moving = "v.move > 0.3 && !v.dying"
    giant = "v.size_blend > 0.5"
    to_a = [{"plant_a_giant": f"v.half == 0 && {moving} && {giant}"},
            {"plant_a_small": f"v.half == 0 && {moving}"},
            {"quiet_a": "v.half == 0"}]
    to_b = [{"plant_b_giant": f"v.half == 1 && {moving} && {giant}"},
            {"quiet_b": "v.half == 1"}]
    steps = {
        "initial_state": "default",
        "states": {
            "default": {"transitions": [{"quiet_a": "v.half == 0"}, {"quiet_b": "v.half == 1"}]},
            "quiet_a": {"transitions": to_b},
            "quiet_b": {"transitions": to_a},
            "plant_a_giant": {
                "sound_effects": [{"effect": "step_giant"}],
                "particle_effects": [{"effect": "dust_plume", "locator": f"foot_tip_{l}"} for l in group_a],
                "transitions": to_b,
            },
            "plant_b_giant": {
                "sound_effects": [{"effect": "step_giant"}],
                "particle_effects": [{"effect": "dust_plume", "locator": f"foot_tip_{l}"} for l in group_b],
                "transitions": to_a,
            },
            "plant_a_small": {
                "sound_effects": [{"effect": "step_small"}],
                "transitions": to_b,
            },
        },
    }
    death = {
        "initial_state": "default",
        "states": {
            "default": {"transitions": [{"dead": "v.dying"}]},
            "dead": {"animations": ["death"], "blend_transition": 0.4,
                     "transitions": [{"default": "!v.dying"}]},
        },
    }
    return {
        "format_version": "1.10.0",
        "animation_controllers": {
            "controller.animation.horror.giant_spider.attack": attack,
            "controller.animation.horror.giant_spider.steps": steps,
            "controller.animation.horror.giant_spider.death": death,
        },
    }


# --------------------------------------------------------------------------- client entity
def client_entity():
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": ENTITY_ID,
                "materials": {"default": "spider", "invisible": "spider_invisible"},
                "textures": {"default": "textures/entity/giant_spider/giant_spider"},
                "geometry": {"default": "geometry.horror.giant_spider"},
                "render_controllers": ["controller.render.horror.giant_spider"],
                "scripts": {
                    "initialize": [
                        "v.size_blend = q.property('horror:giant') ? 1 : 0;",
                        "v.seen_attack = q.property('horror:attack_id');",
                        "v.gait = 0.25;",
                        "v.stride = %s;" % f(STRIDE_MIN),
                        "v.move = 0;",
                        "v.run = 0;",
                    ],
                    "pre_animation": pre_animation(),
                    "animate": [
                        "size",
                        "legs",
                        {"idle": "(1 - v.move) * (1 - v.dead_e)"},
                        {"walk": "v.move * (1 - v.run)"},
                        {"run": "v.move * v.run"},
                        {"stalk": "v.stalk * (1 - v.dead_e)"},
                        {"grow": "v.grow_w"},
                        {"look": "1 - v.dead_e"},
                        "attack_controller",
                        "steps_controller",
                        "death_controller",
                    ],
                    "should_update_bones_and_effects_offscreen": "1.0",
                    "should_update_effects_offscreen": "1.0",
                },
                "animations": {
                    "size": "animation.horror.giant_spider.size",
                    "legs": "animation.horror.giant_spider.legs_ik",
                    "idle": "animation.horror.giant_spider.idle",
                    "stalk": "animation.horror.giant_spider.stalk",
                    "walk": "animation.horror.giant_spider.walk",
                    "run": "animation.horror.giant_spider.run",
                    "grow": "animation.horror.giant_spider.grow",
                    "attack_ground": "animation.horror.giant_spider.attack_ground",
                    "attack_high": "animation.horror.giant_spider.attack_high",
                    "bite": "animation.horror.giant_spider.bite",
                    "death": "animation.horror.giant_spider.death",
                    "look": "animation.horror.giant_spider.look_at_target",
                    "attack_controller": "controller.animation.horror.giant_spider.attack",
                    "steps_controller": "controller.animation.horror.giant_spider.steps",
                    "death_controller": "controller.animation.horror.giant_spider.death",
                },
                "sound_effects": {
                    "step_giant": "mob.giant_spider.step",
                    "step_small": "mob.giant_spider.step_small",
                },
                "particle_effects": {
                    "dust_plume": "minecraft:dust_plume",
                },
                "spawn_egg": {"base_color": "#2a1f1a", "overlay_color": "#8b1a10"},
            }
        },
    }


def render_controllers():
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.horror.giant_spider": {
                "arrays": {"materials": {"Array.materials": ["Material.default", "Material.invisible"]}},
                "geometry": "Geometry.default",
                "materials": [{"*": "Array.materials[q.is_invisible]"}],
                "textures": ["Texture.default"],
            }
        },
    }


LANG = f"""## Giant Spider Hunter - resource pack strings
entity.{ENTITY_ID}.name={NAME}
item.spawn_egg.entity.{ENTITY_ID}.name={NAME}
pack.name={NAME} (Resources)
pack.description=Model, textures, animations and sounds for the {NAME}.
"""


def write_json(rel_path, data):
    path = os.path.join(RP, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return path, len(text)


def write_text(rel_path, text):
    path = os.path.join(RP, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return path, len(text)


def main():
    outputs = [
        write_json("entity/giant_spider.entity.json", client_entity()),
        write_json("animations/giant_spider.animation.json", animations()),
        write_json("animation_controllers/giant_spider.animation_controllers.json", controllers()),
        write_json("render_controllers/giant_spider.render_controllers.json", render_controllers()),
        write_text("texts/en_US.lang", LANG),
        write_json("texts/languages.json", ["en_US"]),
    ]
    for path, size in outputs:
        print(f"{os.path.relpath(path, ROOT):75s} {size:>7,d} bytes")


if __name__ == "__main__":
    main()
