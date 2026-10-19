"""Handheld phone camera, CCTV camera and the dropped-phone tumble (all keyed per frame)."""
import math
import numpy as np
import bpy
from mathutils import Vector, Matrix, Quaternion, Euler

import timeline as TL

FPS = TL.FPS
PHONE_LENS = 28.8          # 36 mm vertical sensor -> ~64 deg vertical FOV (26 mm-equiv main camera)


# ------------------------------------------------------------------------------ noise
class Noise:
    def __init__(self, seed, n=6):
        r = np.random.default_rng(seed)
        self.ph = r.uniform(0, 2 * np.pi, (3, n))
        self.fr = r.uniform(0.7, 1.3, (3, n))

    def __call__(self, t, base_f, octaves=4):
        out = np.zeros(3)
        for k in range(octaves):
            f = base_f * (2.03 ** k)
            a = 0.55 ** k
            out += a * np.sin(2 * np.pi * f * self.fr[:, k] * t + self.ph[:, k])
        return out


def smoothstep(e0, e1, x):
    u = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return u * u * (3 - 2 * u)


def kick(t, t0, amp, decay=0.5, freq=7.0):
    """Damped oscillating impulse starting at t0."""
    if t < t0:
        return 0.0
    u = t - t0
    return amp * math.exp(-u / decay) * math.sin(2 * math.pi * freq * u + 0.6)


def dir_to(p_from, p_to):
    d = Vector(p_to) - Vector(p_from)
    yaw = math.degrees(math.atan2(d.x, d.y))
    pitch = math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
    return yaw, pitch


def cam_quat(yaw, pitch, roll):
    """yaw: deg clockwise from grid north; pitch: deg up; roll: deg clockwise."""
    R = (Matrix.Rotation(math.radians(-yaw), 3, 'Z') @ Matrix.Rotation(math.radians(90 + pitch), 3, 'X')
         @ Matrix.Rotation(math.radians(-roll), 3, 'Z'))
    return R.to_quaternion()


def lerp_ang(a, b, w):
    d = (b - a + 180) % 360 - 180
    return a + d * w


# ------------------------------------------------------------------------------ aim script
def desired_aim(t, op):
    """Where the operator tries to point the phone at time t (yaw, pitch, tau)."""
    sm = TL.superman_pos(t)
    head = (sm[0], sm[1], sm[2] + 0.5)
    if t < 4.0:
        return 7.0 + 2 * math.sin(t * 0.7), 5.0, 0.6
    if t < 5.8:
        return 12.0, 9.0, 0.5
    if t < 6.25:
        return 8.0, 8.0, 0.4
    if t < 7.0:
        return 2.0, 20.0, 0.35
    if t < 12.2:
        y, p = dir_to(op, head)
        return y, min(p, 76.0), 0.2
    if t < TL.T_BEAM_ON:
        y, p = dir_to(op, head)
        return y + 5.0, p - 1.0, 0.35
    if t < TL.T_BEAM_OFF:
        y1, p1 = dir_to(op, head)
        y2, p2 = dir_to(op, TL.beam_target(t))
        return lerp_ang(y1, y2, 0.62), p1 * 0.38 + p2 * 0.62, 0.3
    if t < TL.T_TAKEOFF:
        y1, p1 = dir_to(op, head)
        y2, p2 = dir_to(op, TL.beam_target(TL.T_BEAM_OFF))
        y2b, p2b = dir_to(op, TL.beam_target(TL.T_BEAM_ON + 0.8))
        return lerp_ang(lerp_ang(y2, y2b, 0.4), y1, 0.4), (p2 + p2b) * 0.3 + p1 * 0.4, 0.45
    if t < 23.5:
        y, p = dir_to(op, head)
        return y, min(p, 80.0), 0.16
    # scene 4b: chaos, run into the plaza, take cover at the corner
    if t < 24.6:
        return 9.0, 9.0, 0.3
    if t < 25.3:
        return -25.0, -48.0, 0.2
    if t < 27.6:
        return 34.0 - 6 * smoothstep(25.3, 27.6, t), 4.0, 0.3
    if t < 29.0:
        return 22.0, 5.0, 0.4
    if t < 30.8:
        y, p = dir_to(op, head)
        return y, min(p, 70.0), 0.28
    if t < TL.T_LAUNCH:
        y, p = dir_to(op, (sm[0], sm[1], sm[2] + 1.0))
        return y + 0.6, p - 0.5, 0.5
    return 30.0, 22.0, 0.08


def phone_track():
    """Per-frame (location, quaternion, lens) for the phone camera."""
    nz_hand = Noise(1)
    nz_walk = Noise(2)
    nz_pos = Noise(3)
    nz_fear = Noise(4)
    out = []
    yaw, pitch = 7.0, 5.0
    prev_op = TL.operator_pos(0.0)
    phase = 0.0
    for f in range(TL.N_FRAMES):
        t = f / FPS
        op = TL.operator_pos(t)
        speed = math.hypot(op[0] - prev_op[0], op[1] - prev_op[1]) * FPS if f else 1.25
        prev_op = op
        dy, dp, tau = desired_aim(t, op)
        w = 1.0 - math.exp(-(1.0 / FPS) / max(tau, 0.02))
        yaw = lerp_ang(yaw, dy, w)
        pitch = pitch + (dp - pitch) * w
        roll = 0.0
        # the near-drop: phone whips down to the pavement and back up
        a, b = TL.T_FUMBLE
        if a <= t <= b:
            u = (t - a) / (b - a)
            dip = math.sin(math.pi * min(1.0, u * 1.35)) if u < 0.74 else 0.0
            pitch_f = pitch - 100.0 * dip
            roll = 34.0 * math.sin(math.pi * u) * (1 if u < 0.5 else 0.6)
            yaw_f = yaw + 25.0 * math.sin(2 * math.pi * u)
        else:
            pitch_f, yaw_f = pitch, yaw
        # gait
        phase += 2 * math.pi * (speed / 0.72) / FPS
        run = smoothstep(23.9, 24.4, t) * (1 - smoothstep(27.9, 28.6, t))
        walk_amp = min(1.0, speed / 1.2) * (1 - run)
        bob = (0.012 * walk_amp + 0.038 * run) * math.sin(phase)
        sway = (0.008 * walk_amp + 0.03 * run) * math.sin(phase / 2)
        lens = PHONE_LENS
        if 12.5 <= t < 19.6:          # the operator zooms in on the hovering figure
            lens = PHONE_LENS * (1.0 + 0.6 * smoothstep(12.5, 13.0, t) * (1 - smoothstep(19.3, 19.55, t)))
        if 31.5 <= t:                 # 2x when he turns to the camera, then pushes in on his face
            zoom = 1.0 + 1.0 * smoothstep(31.5, 32.1, t) + 3.0 * smoothstep(33.0, 33.6, t)
            if t >= TL.T_LAUNCH:      # and lets go of the zoom as he launches
                zoom = 1.0 + (zoom - 1.0) * (1 - smoothstep(TL.T_LAUNCH, TL.T_LAUNCH + 0.12, t))
            lens = PHONE_LENS * zoom
        zf = lens / PHONE_LENS        # a braced operator: shake stays about constant on screen when zoomed
        # shakes (degrees)
        hand = (nz_hand(t, 0.9) * 0.35 + nz_hand(t * 1.7, 4.0) * 0.12) / max(1.0, zf / 2.0)
        fear = nz_fear(t, 7.5) * (0.25 * smoothstep(12.5, 13.5, t) + 0.35 * smoothstep(29.0, 30.0, t) * (1 - smoothstep(35.3, 35.4, t)))
        fear = fear / max(1.0, zf / 1.6)
        gait = np.array([1.2 * math.sin(phase + 0.4), 0.8 * math.sin(phase / 2), 1.1 * math.sin(phase / 2 + 1.0)])
        gait *= walk_amp * 0.6 + run * 3.2
        k = (kick(t, TL.T_BOOM1, 4.5, 0.45, 6.0) + kick(t, TL.T_WAKE + 0.15, 7.0, 0.6, 5.0)
             + kick(t, 14.15, 1.2, 0.3) + kick(t, 15.3, 1.5, 0.3) + kick(t, 16.1, 1.4, 0.3)
             + kick(t, 18.6, 2.0, 0.4) + kick(t, 19.85, 5.0, 0.5, 5.5) + kick(t, 30.62, 3.5, 0.5, 6.0)
             + kick(t, TL.T_LAUNCH, 6.0, 0.25, 8.0))
        rot = hand + fear + gait + np.array([k, 0.6 * k, 0.8 * k])
        q = cam_quat(yaw_f + rot[1], pitch_f + rot[0], roll + rot[2])
        fwd = q @ Vector((0, 0, -1))
        right = q @ Vector((1, 0, 0))
        pos = Vector((op[0], op[1], op[2] + TL.CURB_H - 0.08)) + fwd * 0.3
        pos += Vector((0, 0, bob)) + right * sway
        pos += Vector(nz_pos(t, 1.2)) * 0.003
        out.append((pos, q, lens))
    return drop_phone(out)


def drop_phone(track):
    """Replace the end of the track with the dropped phone tumbling and coming to rest on its side."""
    f_rel = int(round(TL.T_DROP * FPS))
    p0, q0, lens0 = track[f_rel]
    v0 = (q0 @ Vector((0, 0, -1))) * 0.6 + Vector((0.15, -0.25, -0.35))
    axis = Vector((0.8, 0.35, 0.5)).normalized()
    rest = Vector(TL.PHONE_REST)
    q_rest = cam_quat(36.0, 14.0, 90.0)
    t_land = TL.T_PHONE_LAND
    g = 9.81
    for f in range(f_rel, TL.N_FRAMES):
        t = f / FPS
        tau = t - TL.T_DROP
        if t < t_land:
            pos = p0 + v0 * tau + Vector((0, 0, -0.5 * g * tau * tau))
            # aim the fall so it lands at the rest spot
            u = tau / (t_land - TL.T_DROP)
            pos = pos.lerp(Vector((rest.x, rest.y, pos.z)), u * u)
            pos.z = max(pos.z, rest.z)
            q = Quaternion(axis, 11.0 * tau) @ q0
        else:
            u = t - t_land
            hop = 0.05 * math.exp(-u / 0.12) * abs(math.sin(math.pi * u / 0.18)) if u < 0.5 else 0.0
            pos = rest + Vector((0, 0, hop))
            q_land = Quaternion(axis, 11.0 * (t_land - TL.T_DROP)) @ q0
            s = smoothstep(0.0, 0.32, u)
            wob = Quaternion(Vector((0.2, 1, 0.1)).normalized(), 0.25 * math.exp(-u / 0.15) * math.sin(u * 40))
            q = wob @ q_land.slerp(q_rest, s)
            # the tremendous impact behind the phone
            j = kick(t, TL.T_IMPACT + 0.05, 1.0, 0.35, 11.0)
            pos += Vector((0.012 * j, -0.008 * j, 0.015 * abs(j)))
            q = Quaternion(Vector((0.3, 0.2, 1)).normalized(), math.radians(4.0 * j)) @ q
        track[f] = (pos, q, PHONE_LENS)
    return track


def build_cameras(coll):
    cams = {}
    data = bpy.data.cameras.new("CamPhone")
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 36.0
    data.lens = PHONE_LENS
    data.clip_start = 0.01
    data.clip_end = 3000.0
    cam = bpy.data.objects.new("CamPhone", data)
    coll.objects.link(cam)
    cam.rotation_mode = 'QUATERNION'
    track = phone_track()
    for f, (pos, q, lens) in enumerate(track):
        cam.location = pos
        cam.rotation_quaternion = q
        data.lens = lens
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        data.keyframe_insert("lens", frame=f)
    cams["CamPhone"] = cam
    # CCTV on the north-west corner looking south-east across the intersection
    dc = bpy.data.cameras.new("CamCCTV")
    dc.sensor_fit = 'HORIZONTAL'
    dc.sensor_width = 36.0
    dc.lens = 15.0
    dc.clip_start = 0.05
    dc.clip_end = 3000.0
    cc = bpy.data.objects.new("CamCCTV", dc)
    coll.objects.link(cc)
    cc.rotation_mode = 'QUATERNION'
    cc.location = (-15.7, 9.2, 7.8)
    for f in range(560, 760):
        t = f / FPS
        j = kick(t, 20.6, 0.25, 0.3, 9.0) + kick(t, 21.7, 0.35, 0.3, 9.0) + kick(t, 22.6, 0.2, 0.3, 9.0)
        cc.rotation_quaternion = cam_quat(148.0, -14.0 + j, j * 0.5)
        cc.keyframe_insert("rotation_quaternion", frame=f)
    cams["CamCCTV"] = cc
    for c in cams.values():
        ad = c.animation_data
        try:
            for fc in ad.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        except Exception:
            pass
    return cams
