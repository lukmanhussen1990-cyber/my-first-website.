"""Procedural vehicles (lofted car bodies, taxis, a city bus) and traffic animation."""
import math
import random
import numpy as np
import bpy
from mathutils import Vector, Matrix, Euler

from city import MB, NT, simple_material, emission_image_material
from props import cyl, hcyl
import timeline as TL

GEN = "/opt/work/assets/gen"

# side profiles: (x along the car, top z) from front bumper to rear bumper
PROFILES = {
    "sedan": dict(L=4.85, W=1.84, belt=0.92, roof_w=0.74, wb=2.82, tire=0.33,
                  top=[(2.42, 0.62), (2.30, 0.80), (1.90, 0.89), (1.15, 0.97), (0.40, 1.44), (-0.80, 1.46),
                       (-1.55, 1.08), (-2.05, 1.02), (-2.40, 0.96), (-2.43, 0.62)]),
    "suv": dict(L=4.70, W=1.88, belt=1.05, roof_w=0.80, wb=2.75, tire=0.37,
                top=[(2.33, 0.72), (2.25, 0.95), (1.85, 1.06), (1.15, 1.14), (0.45, 1.70), (-1.95, 1.72),
                     (-2.30, 1.55), (-2.36, 0.75)]),
    "van": dict(L=5.30, W=1.98, belt=1.10, roof_w=0.86, wb=3.30, tire=0.36,
                top=[(2.63, 0.75), (2.55, 1.00), (2.05, 1.12), (1.55, 1.30), (1.05, 2.15), (-2.55, 2.20),
                     (-2.66, 2.05), (-2.66, 0.75)]),
}
CAR_COLORS = [(0.02, 0.02, 0.022), (0.85, 0.85, 0.85), (0.55, 0.56, 0.58), (0.25, 0.26, 0.28), (0.04, 0.08, 0.20),
              (0.45, 0.04, 0.04), (0.06, 0.15, 0.10), (0.75, 0.75, 0.72), (0.10, 0.10, 0.11)]
TAXI_YELLOW = (0.98, 0.70, 0.04)


def srgb(c):
    f = lambda x: x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in c) + (1.0,)


def vehicle_materials(M):
    m = bpy.data.materials.new("CarPaint")
    T = NT(m)
    oi = T.node("ShaderNodeObjectInfo")
    tc = T.node("ShaderNodeTexCoord")
    dirt = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=3.0, Detail=6.0)
    low = T.node("ShaderNodeSeparateXYZ", Vector=tc.outputs["Object"])
    grime = T.math('MULTIPLY', T.math('SUBTRACT', 1.0, T.math('MULTIPLY', low.outputs[2], 1.6), clamp=True),
                   dirt.outputs["Fac"])
    col = T.mixc(T.math('MULTIPLY', grime, 0.7), oi.outputs["Color"], (0.12, 0.11, 0.10, 1))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Metallic": 0.55, "Roughness": 0.32,
                                              "Coat Weight": 1.0, "Coat Roughness": 0.04})
    T.out(b.outputs[0])
    M["car_paint"] = m
    M["car_glass"] = simple_material("CarGlass", (0.01, 0.012, 0.014), 0.05, 0.0, coat=1.0)
    M["car_trim"] = simple_material("CarTrim", (0.015, 0.015, 0.015), 0.5)
    M["chrome"] = simple_material("Chrome", (0.8, 0.8, 0.8), 0.12, 1.0)
    M["tire"] = simple_material("Tire", (0.018, 0.018, 0.018), 0.85)
    M["rim"] = simple_material("Rim", (0.5, 0.5, 0.52), 0.3, 1.0)
    # head / tail lights: tail lights brighten with the object's 'brake' property
    hl = bpy.data.materials.new("HeadLight")
    T = NT(hl)
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": (0.9, 0.9, 0.9, 1), "Roughness": 0.05,
                                              "Emission Color": (1, 0.97, 0.9, 1), "Emission Strength": 0.4,
                                              "Coat Weight": 1.0})
    T.out(b.outputs[0])
    M["headlight"] = hl
    tl = bpy.data.materials.new("TailLight")
    T = NT(tl)
    br = T.attr("brake").outputs["Fac"]
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": (0.5, 0.02, 0.02, 1), "Roughness": 0.1,
                                              "Emission Color": (1, 0.03, 0.02, 1),
                                              "Emission Strength": T.math('ADD', 0.6, T.math('MULTIPLY', br, 9.0)),
                                              "Coat Weight": 1.0})
    T.out(b.outputs[0])
    M["taillight"] = tl
    M["taxi_sign"] = emission_image_material("TaxiSign", f"{GEN}/taxi_sign.png", strength=0.8, rough=0.3)
    M["bus_livery"] = simple_material("BusWhite", (0.78, 0.79, 0.8), 0.3, 0.1, coat=0.6)
    M["bus_stripe"] = simple_material("BusBlue", (0.02, 0.10, 0.45), 0.3, 0.1, coat=0.6)
    return M


def profile_z(top, x):
    xs = [p[0] for p in top][::-1]
    zs = [p[1] for p in top][::-1]
    return float(np.interp(x, xs, zs))


def car_body(kind, taxi=False):
    """Lofted body. Local frame: +X forward, +Y left, Z up, ground at z=0."""
    P = PROFILES[kind]
    L, W, belt = P["L"], P["W"], P["belt"]
    top = P["top"]
    x_front, x_rear = top[0][0], top[-1][0]
    zb = 0.24
    # cabin span: where the roof line is above the belt
    stations = np.linspace(x_front, x_rear, 34)
    K = 13                                    # points per half section
    sections = []
    for x in stations:
        zt = profile_z(top, x)
        f = min(1.0, (x_front - x) / 0.25, (x - x_rear) / 0.25)
        f = max(0.15, f)
        hw = W / 2 * (0.86 + 0.14 * math.sqrt(f))
        zbelt = min(zt, belt)
        cabin = zt > belt + 0.03
        pts = []
        # bottom centre -> bottom side -> side up to belt -> (cabin) -> roof centre
        pts.append((0.0, zb))
        pts.append((hw - 0.12, zb))
        pts.append((hw - 0.03, zb + 0.06))
        pts.append((hw, zb + 0.2))
        pts.append((hw, 0.5 * (zb + zbelt) + 0.05))
        pts.append((hw - 0.01, zbelt - 0.08))
        pts.append((hw - 0.05, zbelt))
        if cabin:
            rw = W / 2 * P["roof_w"]
            pts.append((hw - 0.09, zbelt + 0.02))
            pts.append((rw + 0.06 + 0.25 * (hw - rw), zbelt + 0.45 * (zt - zbelt)))
            pts.append((rw + 0.03, zt - 0.08))
            pts.append((rw - 0.05, zt - 0.015))
            pts.append((rw * 0.5, zt))
        else:
            pts.append((hw - 0.15, zbelt + 0.01))
            pts.append((hw * 0.75, zt))
            pts.append((hw * 0.5, zt))
            pts.append((hw * 0.35, zt))
            pts.append((hw * 0.2, zt))
        pts.append((0.0, zt))
        assert len(pts) == K, len(pts)
        sections.append((x, pts, cabin, zbelt, zt))
    mb = MB()
    for si in range(len(sections) - 1):
        xa, pa, ca, ba, ta = sections[si]
        xb, pb, cb, bb, tb = sections[si + 1]
        for side in (1, -1):
            for k in range(K - 1):
                q = [(xa, side * pa[k][0], pa[k][1]), (xb, side * pb[k][0], pb[k][1]),
                     (xb, side * pb[k + 1][0], pb[k + 1][1]), (xa, side * pa[k + 1][0], pa[k + 1][1])]
                if side < 0:
                    q = q[::-1]
                zc = (pa[k][1] + pa[k + 1][1]) / 2
                mat = "car_paint"
                if k < 2:
                    mat = "car_trim"
                elif (ca and cb) and 7 <= k <= 9:
                    mat = "car_glass"
                elif (not ca or not cb) and k >= 7 and zc > belt + 0.05 and (xa > 0) != (xb > 0):
                    mat = "car_glass"
                # windshield / rear window: the roof strips between belt and roof at the cabin ends
                if k >= 10 and (ca != cb):
                    mat = "car_glass"
                mb.poly(q, mat)
    # nose & tail caps with lights
    for end, (x, pts, cab, zbelt, zt) in (("front", sections[0]), ("rear", sections[-1])):
        loop = [(x, p[0], p[1]) for p in pts] + [(x, -p[0], p[1]) for p in pts[::-1]]
        if end == "front":
            loop = loop[::-1]
        mb.poly(loop, "car_paint")
        s = 1 if end == "front" else -1
        light = "headlight" if end == "front" else "taillight"
        for side in (1, -1):
            y0, y1 = side * (W / 2 - 0.42), side * (W / 2 - 0.08)
            z0, z1 = 0.62, 0.74
            xx = x + s * 0.004
            pts4 = [(xx, y0, z0), (xx, y1, z0), (xx, y1, z1), (xx, y0, z1)]
            if (s > 0) != (side > 0):
                pts4 = pts4[::-1]
            mb.poly(pts4 if s > 0 else pts4[::-1], light)
        if end == "front":
            xx = x + 0.005
            mb.poly([(xx, -0.45, 0.42), (xx, 0.45, 0.42), (xx, 0.45, 0.6), (xx, -0.45, 0.6)], "car_trim")
    # wheels
    wb, tr = P["wb"], P["tire"]
    for wx in (wb / 2, -wb / 2):
        for side in (1, -1):
            yc = side * (W / 2 - 0.13)
            hcyl(mb, (wx, yc - 0.11, tr), (wx, yc + 0.11, tr), tr, "tire", 16)
            hcyl(mb, (wx, yc + side * 0.112 - 0.002, tr), (wx, yc + side * 0.114, tr), tr * 0.62, "rim", 12)
    # mirrors
    for side in (1, -1):
        mb.box((0.55, side * (W / 2 - 0.02) - 0.07, belt + 0.05), (0.7, side * (W / 2 + 0.16), belt + 0.2), "car_paint")
    if taxi:
        zt = profile_z(top, -0.2)
        mb.box((-0.55, -0.3, zt), (0.05, 0.3, zt + 0.04), "car_trim")
        for side in (1, -1):
            y = side * 0.25
            pts = [(-0.5, y, zt + 0.04), (0.0, y, zt + 0.04), (0.0, y * 0.9, zt + 0.3), (-0.5, y * 0.9, zt + 0.3)]
            mb.poly(pts if side > 0 else pts[::-1], "taxi_sign", uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
        mb.box((-0.5, -0.23, zt + 0.3), (0.0, 0.23, zt + 0.32), "car_trim")
    return mb


def make_vehicle(coll, M, name, kind, color, taxi=False):
    mb = car_body(kind, taxi)
    ob = mb.build(name, coll, M)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.shade_smooth()
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    except Exception:
        pass
    ob.color = srgb(color)
    ob["brake"] = 0.0
    return ob


def make_bus(coll, M, name):
    mb = MB()
    L, W, H = 12.2, 2.55, 3.2
    mb.box((-L / 2, -W / 2, 0.35), (L / 2, W / 2, H), "bus_livery")
    for side in (1, -1):
        y = side * (W / 2 + 0.003)
        pts = [(-L / 2 + 0.4, y, 1.35), (L / 2 - 0.4, y, 1.35), (L / 2 - 0.4, y, 2.55), (-L / 2 + 0.4, y, 2.55)]
        mb.poly(pts if side > 0 else pts[::-1], "car_glass")
        pts = [(-L / 2 + 0.2, y, 0.9), (L / 2 - 0.2, y, 0.9), (L / 2 - 0.2, y, 1.15), (-L / 2 + 0.2, y, 1.15)]
        mb.poly(pts if side > 0 else pts[::-1], "bus_stripe")
    x = L / 2 + 0.003
    mb.poly([(x, -W / 2 + 0.15, 1.1), (x, W / 2 - 0.15, 1.1), (x, W / 2 - 0.15, 2.9), (x, -W / 2 + 0.15, 2.9)][::-1], "car_glass")
    for wx in (L / 2 - 2.6, -L / 2 + 3.2):
        for side in (1, -1):
            yc = side * (W / 2 - 0.2)
            hcyl(mb, (wx, yc - 0.15, 0.5), (wx, yc + 0.15, 0.5), 0.5, "tire", 16)
    ob = mb.build(name, coll, M)
    ob["brake"] = 0.0
    return ob


# ------------------------------------------------------------------------------ traffic
def key_path(ob, fn, frames, wheel_r=0.33):
    """fn(t) -> (x, y, heading, brake). Keys location/rotation per frame."""
    for f in frames:
        t = f / TL.FPS
        x, y, h, br = fn(t)
        ob.location = (x, y, 0.0)
        ob.rotation_euler = (0, 0, h)
        ob["brake"] = br
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("rotation_euler", frame=f)
        ob.keyframe_insert('["brake"]', frame=f)
    if ob.animation_data and ob.animation_data.action:
        try:
            fcs = ob.animation_data.action.fcurves
        except Exception:
            fcs = []
        for fc in fcs:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'


def speed_track(v0, events, n_frames=TL.N_FRAMES):
    """Distance and speed for every frame given a starting speed and [(t_start, t_end, v_target)]
    linear speed ramps (single forward integration)."""
    sub = 4
    dt = 1.0 / (TL.FPS * sub)
    s, v = 0.0, v0
    S, Vv = [], []
    for i in range(n_frames * sub):
        tt = i * dt
        if i % sub == 0:
            S.append(s)
            Vv.append(v)
        for (a, b, vt) in events:
            if a <= tt < b:
                v += (vt - v) * min(1.0, dt / max(b - tt, dt))
        s += v * dt
    return S, Vv


def build_traffic(coll, M):
    """Moving and parked vehicles. Returns dict name -> object."""
    rng = random.Random(21)
    V = {}
    frames = range(0, TL.N_FRAMES)
    lanes = {1: -2.9, 2: 0.85, 3: 4.7}

    # northbound avenue traffic (heading +Y means rotation pi/2 for a +X-forward body)
    north = [
        # name, kind, colour index or "taxi", lane, y at t=0, speed, behaviour
        ("TaxiHero", "sedan", "taxi", 2, -21.0, 10.5, "through"),   # drives through the intersection at ~2 s
        ("Taxi09", "sedan", "taxi", 1, 8.0, 10.0, "through"),
        ("Car10", "sedan", 7, 3, 32.0, 10.0, "through"),
        ("Taxi11", "sedan", "taxi", 2, 62.0, 11.0, "through"),
        ("Car01", "suv", 0, 1, -37.6, 0.0, "queue"),                # waiting at the mid-block red light
        ("Taxi02", "sedan", "taxi", 3, -37.8, 0.0, "queue"),
        ("Car03", "sedan", 4, 2, -37.6, 0.0, "queue"),
        ("Taxi04", "sedan", "taxi", 1, -43.8, 0.0, "queue"),
        ("Van05", "van", 1, 3, -44.4, 0.0, "queue"),
        ("Car06", "sedan", 2, 2, -43.9, 0.0, "queue"),
        ("Taxi07", "sedan", "taxi", 2, -50.2, 0.0, "queue"),
        ("Car08", "suv", 5, 1, -50.0, 0.0, "queue"),
    ]
    T_GREEN = 4.9
    for name, kind, col, lane, y0, v0, beh in north:
        taxi = col == "taxi"
        color = TAXI_YELLOW if taxi else CAR_COLORS[col]
        ob = make_vehicle(coll, M, name, kind, color, taxi)
        x = lanes[lane] + rng.uniform(-0.15, 0.15)
        table = []
        if beh == "through":
            ev = [(9.5 + rng.uniform(0, 1.0), 12.0 + rng.uniform(0, 1.0), 0.0)]
            S, Vv = speed_track(v0, ev)
            for f in frames:
                t = f / TL.FPS
                br = 1.0 if t > ev[0][0] else 0.0
                table.append((x, y0 + S[f], math.pi / 2, br))
        else:
            # queued: pull away on green, brake when the sonic boom hits, stay stopped
            lag = (y0 + 37.6) / -6.2 * 0.7 + rng.uniform(0, 0.2)      # cars behind react later
            t_go = T_GREEN + lag
            t_brake = TL.T_BOOM1 + 0.25 + rng.uniform(0, 0.4)
            a_go, a_br = 2.6, 5.0
            for f in frames:
                t = f / TL.FPS
                if t < t_go:
                    y, br = y0, 1.0
                elif t < t_brake:
                    tt = t - t_go
                    y, br = y0 + 0.5 * a_go * tt * tt, 0.0
                else:
                    tt = max(0.0, t_brake - t_go)
                    vb = a_go * tt
                    yb = y0 + 0.5 * a_go * tt * tt
                    td = min(t - t_brake, vb / a_br)
                    y, br = yb + vb * td - 0.5 * a_br * td * td, 1.0
                table.append((x, y, math.pi / 2, br))
        key_path(ob, lambda t, tb=table: tb[min(int(round(t * TL.FPS)), len(tb) - 1)], frames)
        V[name] = ob

    # westbound cross-street traffic: queued at the red light in scene 1, the hero taxi brakes in scene 4
    west = [("TaxiBrake", "sedan", "taxi", 34.0), ("CarW1", "sedan", 3, 42.0), ("CarW2", "suv", 6, 49.5),
            ("TaxiW3", "sedan", "taxi", 57.0)]
    for i, (name, kind, col, x0) in enumerate(west):
        taxi = col == "taxi"
        ob = make_vehicle(coll, M, name, kind, TAXI_YELLOW if taxi else CAR_COLORS[col], taxi)
        y = -1.4
        table = []
        for f in frames:
            t = f / TL.FPS
            if name == "TaxiBrake":
                # creeps through the red at 19 s trying to escape, brakes hard at T_TAXI_BRAKE
                if t < 19.0:
                    xx, br = x0, 1.0
                else:
                    tt = min(t, TL.T_TAXI_BRAKE) - 19.0
                    xx = x0 - (2.2 * tt * tt)          # accelerating (a = 4.4 m/s^2)
                    vb = 4.4 * (TL.T_TAXI_BRAKE - 19.0)
                    br = 0.0
                    if t > TL.T_TAXI_BRAKE:
                        td = t - TL.T_TAXI_BRAKE
                        dec = 9.0
                        tstop = vb / dec
                        td = min(td, tstop)
                        xx -= vb * td - 0.5 * dec * td * td
                        br = 1.0
                h = math.pi
            else:
                xx, br, h = x0, 1.0, math.pi
            table.append((xx, y, h, br))
        key_path(ob, lambda t, tb=table: tb[min(int(round(t * TL.FPS)), len(tb) - 1)], frames)
        V[name] = ob

    # bus at the stop (east side bus lane, north block)
    bus = make_bus(coll, M, "Bus")
    bus.location = (8.25, 46.0, 0.0)
    bus.rotation_euler = (0, 0, math.pi / 2)
    V["Bus"] = bus

    # parked cars: west parking lane along the avenue + both sides of the cross street
    k = 0
    for y in np.arange(-150, 150, 6.2):
        if any(abs(y - c) < 14 for c in (0, -80, 80)) or abs(y - (-31)) < 5 or rng.random() < 0.15:
            continue
        kind = rng.choice(["sedan", "sedan", "suv", "van"]) if rng.random() < 0.85 else "sedan"
        taxi = rng.random() < 0.12
        ob = make_vehicle(coll, M, f"Parked{k}", kind, TAXI_YELLOW if taxi else rng.choice(CAR_COLORS), taxi)
        ob.location = (-6.15 + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.4, 0.4), 0)
        ob.rotation_euler = (0, 0, math.pi / 2 + rng.uniform(-0.02, 0.02))
        V[ob.name] = ob
        k += 1
    for side in (-1, 1):
        for x in np.arange(-150, 150, 6.0):
            if abs(x) < 22 or rng.random() < 0.2:
                continue
            kind = rng.choice(["sedan", "suv", "sedan", "van"])
            ob = make_vehicle(coll, M, f"ParkedX{k}", kind, rng.choice(CAR_COLORS))
            ob.location = (x + rng.uniform(-0.3, 0.3), side * 3.75, 0)
            ob.rotation_euler = (0, 0, math.pi + rng.uniform(-0.02, 0.02))
            V[ob.name] = ob
            k += 1
    return V
