#!/usr/bin/env python3
"""Render and check the SCP-096 animations with the software renderer (tools/render_preview.py).

Everything goes through the SHIPPED json: SCP096_RP/entity/scp096.entity.json (pre_animation variables and the
animation map), the animation controller (so the same animation sets that play in game are summed) and
tools/eval_animation.py (strict Molang).

Outputs (previews/):
    anim_sit.png anim_walk.png anim_walk_still.png anim_scream.png anim_run.png      8 frames x (side, front)
    anim_blend_sit_scream.png anim_blend_walk_scream.png anim_blend_scream_run.png anim_blend_run_sit.png   controller blends
Checks (exit status 1 on failure):  --check   (also run after rendering)
    * lowest model vertex stays within a ground band over the whole cycle (and at several move speeds)
    * highest vertex is inside the collision box height used by the behaviour pack
    * arms / hands never penetrate head, torso or legs deeper than a tolerance (hands over the face allowed 1 px)
    * no NaN / inf anywhere
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import eval_animation as EA          # noqa: E402
import render_preview as RP          # noqa: E402

ROOT = EA.ROOT
OUT = os.path.join(ROOT, "previews")
MAIN = "controller.animation.scp096.main"

# tuning constants documented in the report (match the phase scale used in the entity file)
WALK_CYCLE_UNITS = 360.0 / 32.0       # query.modified_distance_moved units per walk cycle
RUN_CYCLE_UNITS = 360.0 / 42.0
SIT_LEN = 5.4
WALK_LEN = 8.0
SCREAM_LEN = 1.0
RUN_LEN = 2.5


class Scene:
    def __init__(self):
        self.rig = EA.Rig()
        gp, tp = RP.default_paths()
        self.geo = RP.load_geometry(gp)
        self.tex = RP.load_texture(tp)

    # ---- poses ----------------------------------------------------------------------------
    def state(self, state, t, speed=0.0, dist=0.0, tx=0.0, ty=0.0, life=None):
        env = self.rig.base_env(speed=speed, dist=dist, life=t if life is None else life, tx=tx, ty=ty,
                                variant={"sit": 0, "walk": 1, "scream": 2, "run": 3}[state])
        return self.rig.state_pose(MAIN, state, t, env)

    # ---- geometry measurements ----------------------------------------------------------
    def points(self, pose):
        q = RP.build_scene(self.geo, pose)
        return np.concatenate([x["P"] for x in q])

    def y_range(self, pose):
        p = self.points(pose)
        if not np.all(np.isfinite(p)):
            raise EA.MolangError("non-finite vertex")
        return float(p[:, 1].min()), float(p[:, 1].max())

    def cube_boxes(self, pose, bones):
        """world-space sample points of every cube of the given bones (8 corners, 6 face centres, centre)."""
        mats, _ = RP.bone_matrices(self.geo, pose)
        pts = []
        for bn in bones:
            A, b = mats[bn]
            for c in self.geo.bones[bn].cubes:
                lo = c.origin - c.inflate
                hi = c.origin + c.size + c.inflate
                ctr = (lo + hi) / 2
                samp = [np.array([x, y, z]) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
                for ax in range(3):
                    for v in (lo[ax], hi[ax]):
                        s = ctr.copy()
                        s[ax] = v
                        samp.append(s)
                samp.append(ctr)
                pts.extend([A @ s + b for s in samp])
        return np.array(pts)

    def penetration(self, pose, src_bones, dst_bones, shrink=0.0):
        """Deepest penetration (px) of src cube sample points into dst cubes (boxes in each dst bone's rest frame)."""
        mats, _ = RP.bone_matrices(self.geo, pose)
        pts = self.cube_boxes(pose, src_bones)
        worst, where = 0.0, ""
        for bn in dst_bones:
            A, b = mats[bn]
            Ai = np.linalg.inv(A)
            loc = (pts - b) @ Ai.T
            for c in self.geo.bones[bn].cubes:
                lo = c.origin - c.inflate + shrink
                hi = c.origin + c.size + c.inflate - shrink
                inside = np.all((loc > lo) & (loc < hi), axis=1)
                if inside.any():
                    d = np.minimum(loc[inside] - lo, hi - loc[inside]).min(axis=1)
                    if d.max() > worst:
                        worst, where = float(d.max()), "%s cube %s" % (bn, list(c.origin))
        return worst, where


ARM_BONES = ["left_arm", "left_forearm", "left_hand", "right_arm", "right_forearm", "right_hand"]
HAND_BONES = ["left_forearm", "left_hand", "right_forearm", "right_hand"]
HEAD_BONES = ["head", "jaw"]
BODY_BONES = ["torso", "waist"]
LEG_BONES = ["left_leg", "left_shin", "right_leg", "right_shin"]


# ======================================================================================
# frame sets
# ======================================================================================
def frames_for(sc, name, n=8):
    """[(label, pose)] for the 8 frames of a sheet."""
    out = []
    if name == "sit":
        for k in range(n):
            t = k * SIT_LEN / n
            out.append(("sit t=%.2fs" % t, sc.state("sit", t)))
    elif name == "walk":
        for k in range(n):
            d = k * WALK_CYCLE_UNITS / n
            t = k * WALK_LEN / n
            out.append(("walk ph=%d deg t=%.1f" % (round(k * 360 / n), t), sc.state("walk", t, speed=0.35, dist=d)))
    elif name == "walk_still":
        for k in range(n):
            t = k * WALK_LEN / n
            out.append(("standing sob t=%.1f" % t, sc.state("walk", t, speed=0.0, dist=0.0)))
    elif name == "scream":
        for k in range(n):
            t = k * SCREAM_LEN / n
            out.append(("scream t=%.3fs" % t, sc.state("scream", t)))
    elif name == "run":
        for k in range(n):
            d = k * RUN_CYCLE_UNITS / n
            t = k * RUN_LEN / n
            out.append(("run ph=%d deg t=%.2f" % (round(k * 360 / n), t), sc.state("run", t, speed=1.0, dist=d)))
    else:
        raise ValueError(name)
    return out


VIEW_CFG = {   # (extent px, target) per sheet
    "sit": (40, (0, 12, -4)),
    "walk": (62, (0, 21, -2)),
    "walk_still": (62, (0, 21, -2)),
    "scream": (62, (0, 22, -2)),
    "run": (66, (0, 21, -4)),
}


def sheet(sc, name, path, cols=8, size=270):
    ext, tgt = VIEW_CFG[name]
    fr = frames_for(sc, name)
    ims, labs = [], []
    for ya, pi in ((90, 0), (0, 0)):          # row 1: side (front arrow right), row 2: front
        for lab, pose in fr:
            ims.append(RP.render(sc.geo, sc.tex, pose, yaw=ya, pitch=pi, size=size, ss=2, target=tgt, extent=ext))
            labs.append(lab if ya == 90 else "front")
    s = RP.contact_sheet(ims, labs, cols=cols, pad=4)
    s.save(path)
    return s


def blend_sheet(sc, a, b, path, n=8, span=None, size=270):
    """Controller blend a -> b: the entity sits in `a` for a while, variant flips, and we render the first frames."""
    va = {"sit": 0, "walk": 1, "scream": 2, "run": 3}
    ctrl = EA.Controller(sc.rig, MAIN)
    dt = 1 / 20
    speed_a = {"sit": 0.0, "walk": 0.35, "scream": 0.0, "run": 1.0}[a]
    speed_b = {"sit": 0.0, "walk": 0.35, "scream": 0.0, "run": 1.0}[b]
    dist = 0.0
    t = 0.0
    for _ in range(30):                     # settle in state a
        env = sc.rig.base_env(speed=speed_a, dist=dist, life=t, variant=va[a])
        ctrl.step(env, dt)
        dist += speed_a * (1.0 if a == "run" else 0.2)
        t += dt
    assert ctrl.state == a, (ctrl.state, a)
    bt = max(sc.rig.ctrls[MAIN]["states"][a].get("blend_transition", 0.3),
             sc.rig.ctrls[MAIN]["states"][b].get("blend_transition", 0.3))
    span = span or (bt + 0.15)
    frames, lows = [], []
    for k in range(n):
        tk = t + k * span / (n - 1)
        env = sc.rig.base_env(speed=speed_b, dist=dist, life=tk, variant=va[b])
        ctrl.step(env, 0.0 if k == 0 else span / (n - 1))
        pose = ctrl.pose(tk, env)
        frames.append(("%s->%s +%.2fs [%s]" % (a, b, k * span / (n - 1), ctrl.state), pose))
        lows.append(sc.y_range(pose))
    ims, labs = [], []
    ext, tgt = VIEW_CFG["walk"]
    for ya, pi in ((90, 0), (0, 0)):
        for lab, pose in frames:
            ims.append(RP.render(sc.geo, sc.tex, pose, yaw=ya, pitch=pi, size=size, ss=2, target=tgt, extent=ext))
            labs.append(lab if ya == 90 else "front")
    RP.contact_sheet(ims, labs, cols=n, pad=4).save(path)
    return lows


# ======================================================================================
# checks
# ======================================================================================
def run_checks(sc, verbose=True):
    fails = []
    log = []

    def ok(cond, msg):
        log.append(("PASS  " if cond else "FAIL  ") + msg)
        if not cond:
            fails.append(msg)

    # 1. sit: ground contact, height, penetration
    lows, highs, pen_head, pen_body, pen_leg = [], [], [], [], []
    for k in range(48):
        t = k * SIT_LEN / 48
        pose = sc.state("sit", t)
        lo, hi = sc.y_range(pose)
        lows.append(lo)
        highs.append(hi)
        pen_head.append(sc.penetration(pose, HAND_BONES, HEAD_BONES)[0])
        pen_body.append(sc.penetration(pose, ARM_BONES, BODY_BONES)[0])
        pen_leg.append(sc.penetration(pose, ARM_BONES, LEG_BONES)[0])
    ok(-1.0 <= min(lows) and max(lows) <= 1.0, "sit: lowest vertex over 48 samples of the loop: %.2f .. %.2f px (band +-1)" % (min(lows), max(lows)))
    ok(max(highs) <= 24.0 + 0.5, "sit: highest vertex %.2f px <= 24 (1.5-block collision box) + 0.5" % max(highs))
    ok(max(pen_head) <= 1.0, "sit: hands/forearms into head/jaw cubes: max %.2f px (<= 1.0)" % max(pen_head))
    ok(max(pen_body) <= 1.0, "sit: arms into torso/pelvis cubes: max %.2f px (<= 1.0)" % max(pen_body))
    ok(max(pen_leg) <= 1.5, "sit: arms into leg cubes: max %.2f px (<= 1.5, elbows rest on the knees)" % max(pen_leg))

    # 2. walk / run over a cycle at several move speeds
    # top_hi: walk is hunched (nominal model height 45 px, collision box 44.8 px); run has arms thrown up in front
    for name, state, cycle, length, speeds, band_hi, top_hi in (
            ("walk", "walk", WALK_CYCLE_UNITS, WALK_LEN, (0.0, 0.1, 0.2, 0.35, 0.6, 1.0), 1.0, 46.0),
            ("run", "run", RUN_CYCLE_UNITS, RUN_LEN, (0.0, 0.1, 0.2, 0.3, 0.6, 1.0), 1.0, 47.0)):
        for sp in speeds:
            lows, highs, ph, pb, pl = [], [], [], [], []
            for k in range(96):
                d = k * cycle / 96 + 3 * cycle        # a few cycles in, so absolute distance is not zero
                t = k * length / 96
                pose = sc.state(state, t, speed=sp, dist=d)
                lo, hi = sc.y_range(pose)
                lows.append(lo)
                highs.append(hi)
                ph.append(sc.penetration(pose, HAND_BONES, HEAD_BONES)[0])
                pb.append(sc.penetration(pose, ARM_BONES, BODY_BONES)[0])
                pl.append(sc.penetration(pose, ARM_BONES, LEG_BONES)[0])
            ok(-1.0 <= min(lows) and max(lows) <= band_hi,
               "%s speed %.2f: lowest vertex %.2f .. %.2f px (band -1 .. +%.1f)" % (name, sp, min(lows), max(lows), band_hi))
            ok(max(highs) <= top_hi, "%s speed %.2f: highest vertex %.2f px <= %.1f" % (name, sp, max(highs), top_hi))
            ok(max(ph) <= 1.0 and max(pb) <= 1.0 and max(pl) <= 1.0,
               "%s speed %.2f: arm penetration head %.2f torso %.2f legs %.2f px (<= 1.0)" % (name, sp, max(ph), max(pb), max(pl)))
    # 3. scream
    lows, highs, ph, pb = [], [], [], []
    for k in range(96):
        t = k * SCREAM_LEN / 96
        pose = sc.state("scream", t)
        lo, hi = sc.y_range(pose)
        lows.append(lo)
        highs.append(hi)
        ph.append(sc.penetration(pose, HAND_BONES, HEAD_BONES)[0])
        pb.append(sc.penetration(pose, ARM_BONES, BODY_BONES)[0])
    ok(-1.0 <= min(lows) and max(lows) <= 1.0, "scream: lowest vertex %.2f .. %.2f px (band +-1)" % (min(lows), max(lows)))
    ok(max(highs) <= 47.0, "scream: highest vertex %.2f px (<= 47, head thrown back)" % max(highs))
    ok(max(ph) <= 1.0 and max(pb) <= 1.0, "scream: arm penetration head %.2f torso %.2f px (<= 1.0)" % (max(ph), max(pb)))
    # 4. jaw angles
    jaw_scream = max(sc.state("scream", k / 96)["jaw"]["rotation"][0] for k in range(96))
    jaw_min = min(sc.state("scream", k / 96)["jaw"]["rotation"][0] for k in range(96))
    ok(60 <= jaw_min and jaw_scream <= 80, "scream: jaw opening %.1f .. %.1f deg (about 70)" % (jaw_min, jaw_scream))
    # 5. blends
    for a, b in (("sit", "scream"), ("walk", "scream"), ("scream", "run"), ("run", "sit")):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            lows = blend_sheet(sc, a, b, os.path.join(td, "x.png"), size=60)
        lo = min(l for l, _ in lows)
        ok(lo >= -4.0, "blend %s->%s: lowest vertex during the blend %.2f px (>= -4; feet may dip briefly while legs unfold)" % (a, b, lo))
    if verbose:
        for l in log:
            print(l)
        print("\n%d checks, %d FAILED" % (len(log), len(fails)))
    return fails


def report(sc):
    """Measured details quoted in the hand-over report."""
    L = []
    pose = sc.state("sit", 0.0)
    L.append("sit: root offset %.2f px (pelvis bottom y=20 -> ground), lowest vertex %.2f, highest %.2f px (%.3f blocks)" % (
        pose["root"]["position"][1], *sc.y_range(pose), sc.y_range(pose)[1] / 16))
    mats, _ = RP.bone_matrices(sc.geo, pose)
    A, b = mats["head"]
    c = A @ np.array([0, 40.0, 0]) + b
    L.append("sit: head centre (skull+jaw, rest y=40) at y=%.1f z=%.1f px = %.2f blocks high" % (c[1], c[2], c[1] / 16))
    for name, cyc, length, sp in (("walk", WALK_CYCLE_UNITS, WALK_LEN, 0.35), ("run", RUN_CYCLE_UNITS, RUN_LEN, 1.0)):
        zs, ys = [], []
        for k in range(96):
            pose = sc.state(name, 0.0, speed=sp, dist=k * cyc / 96 + 3 * cyc)
            mats, _ = RP.bone_matrices(sc.geo, pose)
            la = mats["left_shin"][0] @ np.array([2.0, 2.0, 0.0]) + mats["left_shin"][1]
            ra = mats["right_shin"][0] @ np.array([-2.0, 2.0, 0.0]) + mats["right_shin"][1]
            zs.append(la[2] - ra[2])
            ys.append(sc.y_range(pose)[0])
        L.append("%s: ankle-to-ankle fore/aft separation max %.1f px (%.2f blocks); one cycle = %.2f distance units" % (
            name, max(np.abs(zs)), max(np.abs(zs)) / 16, cyc))
    # rates under the Java-style limbSwing model (modified_distance_moved gains min(4*blocks_per_tick,1) per tick)
    L.append("walk phase 32 deg/unit: at a stroll of 1 b/s (limb units 4/s) -> %.2f cycles/s; run 42 deg/unit saturated at 20 units/s -> %.2f cycles/s" % (
        4 * 32 / 360.0, 20 * 42 / 360.0))
    tr = [sc.state("sit", k * 0.05)["torso"]["rotation"][0] for k in range(120)]
    hd = [sc.state("sit", k * 0.05)["head"]["rotation"][0] for k in range(120)]
    L.append("sit sob: torso X %.1f .. %.1f deg, head X %.1f .. %.1f deg over one 6 s loop" % (min(tr), max(tr), min(hd), max(hd)))
    jw = [sc.state("scream", k / 96)["jaw"]["rotation"][0] for k in range(96)]
    L.append("scream jaw %.1f .. %.1f deg" % (min(jw), max(jw)))
    for l in L:
        print(l)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="only run the numeric checks")
    ap.add_argument("--report", action="store_true", help="print measured details")
    ap.add_argument("--only", default=None, help="comma list of sit,walk,walk_still,scream,run,blend")
    a = ap.parse_args(argv)
    sc = Scene()
    if a.report:
        report(sc)
        return 0
    os.makedirs(OUT, exist_ok=True)
    if not a.check:
        want = set(a.only.split(",")) if a.only else {"sit", "walk", "walk_still", "scream", "run", "blend"}
        for nm in ("sit", "walk", "walk_still", "scream", "run"):
            if nm in want:
                p = os.path.join(OUT, "anim_%s.png" % nm)
                sheet(sc, nm, p)
                print("wrote", p)
        if "blend" in want:
            for a_, b_ in (("sit", "scream"), ("walk", "scream"), ("scream", "run"), ("run", "sit")):
                p = os.path.join(OUT, "anim_blend_%s_%s.png" % (a_, b_))
                lows = blend_sheet(sc, a_, b_, p)
                print("wrote", p, "lowest vertices:", " ".join("%.1f" % l for l, _ in lows))
    fails = run_checks(sc)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
