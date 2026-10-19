"""Crowd: ~60 pedestrians with timed waypoint plans (walk / run / idle / talk / flinch / hide),
root motion keyed per frame, gait clips as NLA strips matched to ground speed, head tracking."""
import math
import random
import numpy as np
import bpy
from mathutils import Vector

import people
import timeline as TL

P = "mixamorig:"
FPS = TL.FPS


class Plan:
    def __init__(self, kind, keys, look=None, seed=0, hide_at=None, sink=None, lod=0):
        """keys: [(t, x, y, state[, heading])]; state applies from that key to the next.
        look: [(t, influence)] for head tracking.  hide_at: time to vanish.
        sink: (t0, t1, depth) lowers the root (walking down subway stairs)."""
        self.kind, self.keys, self.look, self.seed = kind, keys, look or [], seed
        self.hide_at, self.sink, self.lod = hide_at, sink, lod


def _interp_xy(keys, t):
    if t <= keys[0][0]:
        return keys[0][1], keys[0][2]
    for a, b in zip(keys[:-1], keys[1:]):
        if a[0] <= t <= b[0]:
            u = (t - a[0]) / max(b[0] - a[0], 1e-6)
            return a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u
    return keys[-1][1], keys[-1][2]


def _state(keys, t):
    s = keys[0]
    for k in keys:
        if k[0] <= t:
            s = k
    return s


def build_person(lib, plan, name, coll, look_target, operator_xy=None):
    rng = random.Random(plan.seed)
    outfit = people.random_outfit(plan.kind, rng)
    rig = people.spawn_person(lib, plan.kind, outfit, name, coll, lod=plan.lod)
    h = rig.scale[2]
    tmpl = lib[plan.kind]["rig"]
    v_walk, v_run = tmpl["walk_speed"] * h, tmpl["run_speed"] * h
    acts = lib["actions"]
    keys = plan.keys
    # ---------------------------------------------------------------- root motion
    heading = keys[0][4] if len(keys[0]) > 4 else 0.0
    prev = _interp_xy(keys, -0.5)
    zoff = 0.0
    for f in range(-2, TL.N_FRAMES + 2):
        t = f / FPS
        x, y = _interp_xy(keys, t)
        st = _state(keys, t)
        dx, dy = x - prev[0], y - prev[1]
        if len(st) > 4 and st[3] in ("idle", "talk", "flinch", "crouch"):
            target = st[4]
        elif math.hypot(dx, dy) > 1e-4:
            target = math.atan2(dy, dx) - math.pi / 2     # rest faces -Y; heading 0 => facing -Y
            target += math.pi
        else:
            target = heading
        # shortest-angle damped turn (max ~400 deg/s)
        d = (target - heading + math.pi) % (2 * math.pi) - math.pi
        heading += max(-0.23, min(0.23, d * 0.35))
        prev = (x, y)
        z = 0.0
        if plan.sink:
            a, b, depth = plan.sink
            if t > a:
                z = -depth * min(1.0, (t - a) / (b - a))
        rig.location = (x, y, TL.CURB_H + z if not _in_street(x, y) else z)
        rig.rotation_euler = (0, 0, heading)
        rig.keyframe_insert("location", frame=f)
        rig.keyframe_insert("rotation_euler", frame=f)
    _linear(rig)
    # ---------------------------------------------------------------- gait strips
    segs = []
    for i, k in enumerate(keys):
        t0 = k[0]
        t1 = keys[i + 1][0] if i + 1 < len(keys) else 40.5
        if t1 - t0 < 0.05:
            continue
        dist = math.hypot(keys[i + 1][1] - k[1], keys[i + 1][2] - k[2]) if i + 1 < len(keys) else 0.0
        speed = dist / (t1 - t0)
        segs.append((t0, t1, k[3], speed))
    # merge too-short segments into neighbours
    merged = []
    for s in segs:
        if merged and (s[1] - s[0]) * FPS < 12 and s[2] == merged[-1][2]:
            a = merged.pop()
            merged.append((a[0], s[1], a[2], (a[3] + s[3]) / 2))
        else:
            merged.append(s)
    ad = rig.animation_data or rig.animation_data_create()
    tracks = []          # [(track, last_end_frame)]
    for i, (t0, t1, state, speed) in enumerate(merged):
        f0 = t0 * FPS - (10 if i == 0 else 4)
        f1 = t1 * FPS + 4
        if state in ("walk", "run"):
            clip = acts[f"{plan.kind}_{state}"]
            vclip = v_walk if state == "walk" else v_run
            rate = max(0.55, min(1.6, speed / max(vclip, 1e-3))) if speed > 0.05 else 1.0
        elif state == "talk":
            clip = acts[f"{plan.kind}_{rng.choice(['agree', 'headShake', 'idle'])}"]
            rate = 1.0
        elif state in ("flinch", "crouch"):
            clip = acts[f"{plan.kind}_sneak_pose"]
            rate = 1.0
        else:
            clip = acts[f"{plan.kind}_idle"]
            rate = rng.uniform(0.85, 1.1)
        k = next((j for j, (_, end) in enumerate(tracks) if end < f0 - 0.5), None)
        if k is None:
            tracks.append([ad.nla_tracks.new(), -1e9])
            k = len(tracks) - 1
        tr = tracks[k][0]
        st = tr.strips.new(f"{state}{i}", int(math.floor(f0)), clip)
        people._assign_slot(st, clip)
        cycle = max(1.0, clip.frame_range[1] - clip.frame_range[0])
        st.scale = 1.0 / rate
        st.repeat = max(0.1, (f1 - math.floor(f0)) / (cycle * st.scale))
        st.extrapolation = 'NOTHING'
        st.blend_type = 'REPLACE'
        if k > 0:
            st.blend_in = min(4.0, (st.frame_end - st.frame_start) / 3)
            st.blend_out = min(4.0, (st.frame_end - st.frame_start) / 3) if i + 1 < len(merged) else 0.0
        tracks[k][1] = st.frame_end
    # phase offset so walkers are not in lock-step
    # (handled by the random strip start offset above through t0 values)
    # ---------------------------------------------------------------- head tracking
    if plan.look:
        hb = rig.pose.bones[P + "Head"]
        c = hb.constraints.new('DAMPED_TRACK')
        c.target = look_target
        c.track_axis = 'TRACK_Z'
        nb = rig.pose.bones[P + "Neck"]
        c2 = nb.constraints.new('DAMPED_TRACK')
        c2.target = look_target
        c2.track_axis = 'TRACK_Z'
        for t, inf in [(0.0, 0.0)] + plan.look:
            c.influence = inf
            c.keyframe_insert("influence", frame=t * FPS)
            c2.influence = inf * 0.4
            c2.keyframe_insert("influence", frame=t * FPS)
    return rig


def _in_street(x, y):
    on_ave = abs(x) < TL.AVE_HALF
    on_st = any(abs(y - c) < TL.ST_HALF for c in (0.0, -TL.BLOCK, TL.BLOCK))
    return on_ave or on_st


def _linear(ob):
    ad = ob.animation_data
    if not ad or not ad.action:
        return
    try:
        fcs = ad.action.fcurves
    except Exception:
        return
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


# ============================================================================ the plans
def make_plans():
    R = random.Random(2024)
    plans = []

    def add(kind, keys, look=None, **kw):
        plans.append(Plan(kind, keys, look, seed=len(plans) * 7 + 3, **kw))

    def kind():
        return R.choice(["male", "female"])

    def look_up(t_start, peak=0.85):
        return [(t_start, 0.0), (t_start + 0.6, peak), (TL.T_BEAM_ON + 0.4, peak), (TL.T_BEAM_ON + 1.2, 0.2)]

    # --- 1. west sidewalk (operator's side) -------------------------------------------
    for i in range(12):
        north = R.random() < 0.5
        x = R.choice([-14.9, -11.7, -15.3, -11.4]) + R.uniform(-0.2, 0.2)
        v = R.uniform(1.15, 1.5)
        y0 = R.uniform(-95, -5) if i > 1 else (-49.5 - i * 1.5)       # two overtake the operator
        if i <= 1:
            north = True
            x = -14.6 if i == 0 else -11.6
        tp = TL.T_BEAM_ON + R.uniform(0.1, 1.4)
        stop = TL.T_BOOM1 + R.uniform(0.2, 1.2)
        d = 1 if north else -1
        y_stop = y0 + d * v * stop
        keys = [(0.0, x, y0, "walk"), (stop, x, y_stop, "idle", math.pi + R.uniform(-0.4, 0.4))]
        if R.random() < 0.35:
            keys.insert(1, (TL.T_RUMBLE + R.uniform(0, 1), x, y0 + d * v * (TL.T_RUMBLE + 0.5), "walk"))
        if R.random() < 0.5:
            keys.append((TL.T_WAKE + 0.05, x, y_stop, "flinch", math.pi))
            keys.append((TL.T_WAKE + 0.8, x, y_stop, "idle", math.pi))
        # panic: run south, a few into the plaza lobby
        yr = y_stop
        if R.random() < 0.3 and yr < -30:
            keys.append((tp, x, yr, "run"))
            keys.append((tp + 4.0, -26.0, -48.0 - R.uniform(0, 6), "run"))
            add(kind(), keys, look_up(stop), hide_at=tp + 4.0)
        else:
            keys.append((tp, x, yr, "run"))
            keys.append((tp + 25.0, x + R.uniform(-0.6, 0.6), yr - 25.0 * R.uniform(3.6, 4.4), "run"))
            add(kind(), keys, look_up(stop), lod=1 if i <= 1 else 0)
    # --- 2. east sidewalk -------------------------------------------------------------
    for i in range(11):
        north = R.random() < 0.5
        x = R.choice([11.1, 15.2, 14.7]) + R.uniform(-0.15, 0.15)
        v = R.uniform(1.15, 1.5)
        y0 = R.uniform(-90, 60)
        d = 1 if north else -1
        stop = TL.T_BOOM1 + R.uniform(0.2, 1.5)
        ys = y0 + d * v * stop
        keys = [(0.0, x, y0, "walk"), (stop, x, ys, "idle", math.pi + R.uniform(-0.5, 0.3))]
        tp = TL.T_BEAM_ON + R.uniform(0.0, 1.5)
        if -45 < ys < -15 and R.random() < 0.6:
            # into the subway
            keys += [(tp, x, ys, "run"), (tp + abs(ys + 20.5) / 4.0 + 0.4, 12.5, -20.6, "run"),
                     (tp + abs(ys + 20.5) / 4.0 + 2.2, 12.5, -26.5, "run")]
            add(kind(), keys, look_up(stop), sink=(tp + abs(ys + 20.5) / 4.0 + 0.4, tp + abs(ys + 20.5) / 4.0 + 2.2, 1.6),
                hide_at=tp + abs(ys + 20.5) / 4.0 + 2.3)
        else:
            keys += [(tp, x, ys, "run"), (tp + 25.0, x, ys - 25.0 * R.uniform(3.5, 4.3), "run")]
            add(kind(), keys, look_up(stop))
    # --- 3. NE corner by the tower: flee across the intersection --------------------------
    for i in range(6):
        x, y = R.uniform(11.0, 15.0), R.uniform(12, 30)
        stop = TL.T_BOOM1 + R.uniform(0.1, 0.8)
        keys = [(0.0, x, y - 1.3 * stop, "walk"), (stop, x, y, "idle", math.pi - R.uniform(0.2, 0.9))]
        tp = TL.T_BEAM_ON + R.uniform(0.0, 0.6)
        mid = (R.uniform(-6, 6), R.uniform(-4, 4))
        keys += [(tp, x, y, "run"), (tp + 4.0, mid[0], mid[1], "run"),
                 (tp + 12.0, R.choice([-13.5, 12.5]), -45.0, "run"), (tp + 25.0, R.choice([-13.5, 12.5]), -95.0, "run")]
        add(kind(), keys, look_up(stop, 0.95))
    # --- 4. runners crossing the intersection while the CCTV records (20.0 - 23.5 s) ---------
    for i in range(9):
        xs = R.uniform(-13, 13) if i > 2 else R.choice([11.5, 13.5])
        t_cross = 20.2 + i * 0.36
        v = R.uniform(3.6, 4.6)
        y_start = 2.0 + v * (t_cross - 17.5)
        x_end = R.uniform(-14, 14)
        keys = [(0.0, xs, y_start + 40, "idle", math.pi), (17.5, xs, y_start, "run"),
                (t_cross, xs * 0.8, 0.0, "run"), (t_cross + 18.0, x_end, -v * 18.0, "run")]
        if i in (1, 2):         # cross the cross street in front of the braking taxi
            keys = [(0.0, 13.0, 25.0, "idle", math.pi), (18.8, 13.0, 9.0, "run"), (20.9, 15.0, 0.5, "run"),
                    (21.6, 16.5, -7.5, "run"), (40.0, 14.0, -80.0, "run")]
        add(kind(), keys, [(17.4, 0.0), (17.8, 0.5), (19.0, 0.0)])
    # --- 5. scene 4b: running past the operator toward the south -------------------------
    for i in range(6):
        x = R.choice([-11.8, -14.6, -15.2, -12.4])
        t_pass = 23.8 + i * 0.75
        v = R.uniform(3.8, 4.8)
        keys = [(0.0, x, -41 + v * (t_pass - 14.0) + 30, "idle", math.pi), (14.0, x, -41 + v * (t_pass - 14.0), "run"),
                (t_pass + 20.0, x, -41 - v * 20.0, "run")]
        add(kind(), keys)
    # --- 6. cross-street pedestrians -----------------------------------------------------
    for i in range(6):
        side = R.choice([-1, 1])
        y = side * R.uniform(6.2, 8.8)
        x0 = R.uniform(-70, 70)
        if abs(x0) < 18:
            x0 += 25 * np.sign(x0 or 1)
        d = R.choice([-1, 1])
        stop = TL.T_BOOM1 + R.uniform(0.2, 1.0)
        keys = [(0.0, x0, y, "walk"), (stop, x0 + d * 1.3 * stop, y, "idle", math.pi + (0.6 if x0 < 0 else -0.6))]
        tp = TL.T_BEAM_ON + R.uniform(0.2, 1.2)
        xs = x0 + d * 1.3 * stop
        keys += [(tp, xs, y, "run"), (tp + 25, xs + np.sign(xs) * 100, y, "run")]
        add(kind(), keys, look_up(stop))
    # --- 7. mid-block crosswalk (scene 1: two people cross the road) ----------------------
    for i, (xa, xb, t0) in enumerate(((7.5, -11.5, 0.0), (5.0, -11.8, 0.4), (-8.5, 11.4, 0.0), (-3.0, 11.6, 0.0))):
        y = -31.0 + (i - 1.5) * 0.7
        dur = abs(xb - xa) / 1.35
        keys = [(t0, xa, y, "walk"), (t0 + dur, xb, y, "walk"),
                (t0 + dur + 0.1, xb, y - 4 if xb < 0 else y + 3, "walk"), (TL.T_BOOM1 + 0.5, xb, y - 6 if xb < 0 else y + 9, "idle", math.pi),
                (TL.T_BEAM_ON + 0.5, xb, y - 6 if xb < 0 else y + 9, "run"), (TL.T_BEAM_ON + 25.5, xb, -120.0, "run")]
        if t0 > 0:
            keys.insert(0, (0.0, xa + 0.6, y, "walk"))
        add(kind(), keys, look_up(TL.T_BOOM1 + 0.6))
    # --- 8. halal cart vendor + customers --------------------------------------------------
    add("male", [(0.0, -10.55, -14.5, "talk", -math.pi / 2), (TL.T_BEAM_ON + 0.8, -10.55, -14.5, "run"),
                 (TL.T_BEAM_ON + 20.8, -9.5, -105, "run")], look_up(TL.T_BOOM1 + 0.3))
    for j, (x, y) in enumerate(((-12.5, -13.7), (-12.7, -15.7))):
        add(kind(), [(0.0, x, y, "talk", math.pi / 2), (TL.T_BEAM_ON + 0.3 + j * 0.4, x, y, "run"),
                     (TL.T_BEAM_ON + 20.3, x - 1, -110, "run")], look_up(TL.T_BOOM1 + 0.4))
    # --- 9. bus stop -----------------------------------------------------------------------
    for j in range(3):
        y = 40.5 + j * 1.3
        add(kind(), [(0.0, 12.3 + 0.4 * (j % 2), y, "idle", -math.pi / 2), (TL.T_BEAM_ON + 0.2 * j, 12.3, y, "run"),
                     (TL.T_BEAM_ON + 25, 12.8, y - 100, "run")], look_up(TL.T_BOOM1 + 0.5))
    # --- 10. sprinters past the dropped phone (scene 6) -----------------------------------
    for j, (x, t_pass) in enumerate(((-15.25, 36.45), (-14.2, 36.95), (-15.6, 37.55), (-13.4, 38.2))):
        v = 5.0
        keys = [(0.0, x, -34.15 + v * (t_pass - 30.0) + 40, "idle", math.pi), (30.0, x, -34.15 + v * (t_pass - 30.0), "run"),
                (t_pass + 6.0, x - 0.4, -34.15 - v * 6.0, "run")]
        add(kind(), keys, lod=1)
    # --- 11. cowering behind the planter (scene 5) & plaza chatters (scene 1) -------------
    add(kind(), [(0.0, -21.5, -50.0, "talk", math.pi / 2), (TL.T_BEAM_ON + 0.6, -21.5, -50.0, "run"),
                 (TL.T_BEAM_ON + 3.0, -22.4, -44.6, "crouch", -math.pi / 2)], look_up(TL.T_BOOM1 + 0.4))
    add(kind(), [(0.0, -20.6, -50.4, "talk", -math.pi / 2), (TL.T_BEAM_ON + 0.4, -20.6, -50.4, "run"),
                 (TL.T_BEAM_ON + 3.5, -26.2, -55.0, "run")], look_up(TL.T_BOOM1 + 0.4), hide_at=TL.T_BEAM_ON + 3.5)
    return plans


def keep_clear_of_operator(plans):
    """Shift pedestrians sideways if they would pass through the camera operator."""
    for pl in plans:
        for k in range(len(pl.keys)):
            t, x, y = pl.keys[k][:3]
            ox, oy, _ = TL.operator_pos(t)
            dx, dy = x - ox, y - oy
            if math.hypot(dx, dy) < 0.75:
                s = 1 if dx >= 0 else -1
                lst = list(pl.keys[k])
                lst[1] = ox + s * 0.8
                pl.keys[k] = tuple(lst)


def build_crowd(lib, coll):
    look = bpy.data.objects.new("LookTarget", None)
    coll.objects.link(look)
    for f in range(TL.N_FRAMES):
        t = f / FPS
        if t < 7.0:
            p = (0.0, 300.0, 140.0)
        else:
            p = TL.superman_pos(t)
        look.location = p
        look.keyframe_insert("location", frame=f)
    plans = make_plans()
    keep_clear_of_operator(plans)
    rigs = []
    for i, pl in enumerate(plans):
        rigs.append(build_person(lib, pl, f"Ped{i:02d}", coll, look))
    print("crowd:", len(rigs), "pedestrians")
    return rigs, plans


def cull(rigs, plans, phone_track):
    """Render a pedestrian only while it can appear in the active camera (plus margin)."""
    from mathutils import Vector, Quaternion
    import cameras
    cctv_pos = Vector((-15.7, 9.2, 7.8))
    cctv_q = cameras.cam_quat(148.0, -14.0, 0.0)
    shots = [(a, b, cam) for (_, a, b, cam) in TL.SHOTS]
    n_vis = 0
    for rig, pl in zip(rigs, plans):
        vis = np.zeros(TL.N_FRAMES, bool)
        for f in range(TL.N_FRAMES):
            t = f / FPS
            if pl.hide_at is not None and t >= pl.hide_at:
                continue
            cam = next((c for (a, b, c) in shots if a <= f <= b), "CamPhone")
            if cam == "CamCCTV":
                cpos, cq = cctv_pos, cctv_q
                tan_h, tan_v = math.tan(math.radians(50)), math.tan(math.radians(50)) * 9 / 16
            else:
                cpos, cq, lens = phone_track[f]
                tan_v = 18.0 / lens
                tan_h = tan_v * 720 / 1280
            x, y = _interp_xy(pl.keys, t)
            p = Vector((x, y, TL.CURB_H + 1.0))
            v = cq.inverted() @ (p - cpos)
            depth = -v.z
            if depth < -1.5 or v.length > 160.0:
                continue
            d = max(depth, 0.5)
            if abs(v.x) / d < tan_h + 0.35 + 1.2 / d and abs(v.y) / d < tan_v + 0.35 + 1.4 / d:
                vis[f] = True
        # dilate so nobody pops at the frame edge (motion blur, shadows, fast pans)
        dil = vis.copy()
        for k in range(1, 9):
            dil[k:] |= vis[:-k]
            dil[:-k] |= vis[k:]
        obs = [rig] + [bpy.data.objects[n] for n in rig["parts"]]
        prev = None
        for f in range(TL.N_FRAMES):
            h = not dil[f]
            if h != prev:
                for ob in obs:
                    ob.hide_render = h
                    ob.keyframe_insert("hide_render", frame=f)
                prev = h
        n_vis += int(dil.any())
    print("cull: pedestrians ever visible", n_vis, "of", len(rigs), flush=True)
