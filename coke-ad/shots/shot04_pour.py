"""Shot 04 (0:12-0:19): the bottle pours a backlit cola stream into a glass of ice; the level rises, foam builds."""
import math

import bpy
import numpy as np

import cokelib as C

SHOT = {"id": "04", "name": "pour", "frames": 168}
FPS = 24.0
TILT = math.radians(-146.0)
MOUTH = np.array([0.036, 0.0, 0.198])
LEVEL0, LEVEL1, FILL_END = 0.026, 0.118, 158


def _level_fn():
    """Constant volumetric flow into the bell glass -> level(frame)."""
    z = np.linspace(C.GLASS_INNER_BASE, 0.15, 800)
    r = C.glass_inner_radius(z)
    vol = np.concatenate([[0], np.cumsum(np.pi * r[:-1] ** 2 * np.diff(z))])
    v0, v1 = np.interp(LEVEL0, z, vol), np.interp(LEVEL1, z, vol)

    def level(f):
        k = np.clip((f - 1) / (FILL_END - 1), 0, 1)
        k = k if f <= FILL_END else 1.0
        return float(np.interp(v0 + (v1 - v0) * k, vol, z))

    return level


class Stream:
    """Tube following a gravity parabola from the bottle mouth to the liquid surface."""

    def __init__(self, rings=56, seg=20):
        self.rings, self.seg = rings, seg
        n = rings * seg + 2
        F = []
        for i in range(rings - 1):
            for j in range(seg):
                a, b = i * seg + j, i * seg + (j + 1) % seg
                F.append([a, b, b + seg, a + seg])
        top, bot = rings * seg, rings * seg + 1
        for j in range(seg):
            F.append([top, (j + 1) % seg, j])
            F.append([bot, (rings - 1) * seg + j, (rings - 1) * seg + (j + 1) % seg])
        self.me = C.mesh_from_arrays("Stream_me", np.zeros((n, 3)), [np.array(f) for f in F])
        self.me.materials.append(C.mat_cola())
        self.obj = C.new_object("Stream", self.me)
        self.obj.visible_shadow = False
        rng = np.random.default_rng(4)
        self.ph = rng.uniform(0, 2 * np.pi, 6)

    def update(self, start, vel, z_end, r0, f):
        g = np.array([0.0, 0.0, -9.81])
        # time at which the parabola reaches z_end (a bit below the surface)
        a, b, c = 0.5 * g[2], vel[2], start[2] - (z_end - 0.004)
        T = (-b - math.sqrt(max(b * b - 4 * a * c, 0.0))) / (2 * a)
        s = np.linspace(-0.012, T, self.rings)  # start slightly inside the neck
        P = start[None, :] + vel[None, :] * s[:, None] + 0.5 * g[None, :] * (s ** 2)[:, None]
        V = vel[None, :] + g[None, :] * s[:, None]
        speed = np.linalg.norm(V, axis=1)
        tang = V / speed[:, None]
        side = np.cross(tang, np.array([0.0, 1.0, 0.0]))
        side /= np.linalg.norm(side, axis=1, keepdims=True)
        up = np.cross(side, tang)
        r = r0 * np.sqrt(np.linalg.norm(vel) / speed)  # continuity: thinner as it accelerates
        th = 2 * np.pi * np.arange(self.seg) / self.seg
        t = f / FPS
        wob = np.zeros((self.rings, self.seg))
        for k in range(3):
            wob += 0.06 / (k + 1) * np.sin((k + 2) * th[None, :] + 90 * (k + 1) * s[:, None] - 9 * (k + 1) * t
                                           + self.ph[k])
        wob += 0.05 * np.sin(140 * s[:, None] - 20 * t + self.ph[4])  # travelling ripples
        rr = r[:, None] * (1 + wob)
        pts = (P[:, None, :] + rr[..., None] * (np.cos(th)[None, :, None] * side[:, None, :]
                                                + np.sin(th)[None, :, None] * up[:, None, :]))
        allv = np.vstack([pts.reshape(-1, 3), P[:1], P[-1:]])
        C.set_verts(self.me, allv)
        return P[-1]


def build():
    sc = C.reset_scene(res=(1024, 576), samples=8)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.15, glow_center=(0.02, 0.12), glow_radius=0.75)
    level = _level_fn()

    g = C.make_glass("Glass", level=0.145, seed=11, drops=1100, mist=0.8)
    liq = C.GlassLiquid("GlassCola", g["root"], level=LEVEL0)
    ice_specs = [  # rest position, rotation (deg), rise factor as the cola lifts it
        ((-0.005, 0.003, 0.0275), (8, 4, 20), 0.0),
        ((-0.007, -0.004, 0.053), (32, 18, 55), 0.3),
        ((-0.006, 0.005, 0.077), (-15, 28, 10), 0.6),
        ((-0.009, -0.002, 0.100), (20, -12, 70), 0.9),
        ((-0.004, -0.010, 0.121), (40, 10, 35), 1.0),
    ]
    ices = []
    for i, (p, r, _) in enumerate(ice_specs):
        ice = C.make_ice_cube(f"Ice{i}", size=0.0245, seed=i + 3, parent=g["root"])
        ice.location = p
        ice.rotation_euler = np.radians(r)
        ices.append(ice)
    liq.cut_with(ices)

    b = C.make_contour_bottle("Bottle", fill_z=None, cap=False, seed=5, drops=1200, mist=0.7)
    root = b["root"]
    axis = np.array([math.sin(TILT), 0.0, math.cos(TILT)])
    root.rotation_euler = (0, TILT, 0)
    root.location = tuple(MOUTH - axis * C.BOTTLE_LIP_TOP)

    stream = Stream()
    # a small backlight that only the stream can see (light linking), so the stream glows amber
    k2 = C.area_light("StreamKick", (0.03, 0.30, 0.15), size=(0.3, 0.34), energy=9.0, color=(1.0, 0.58, 0.32),
                      look_at=(0.03, -1.0, 0.15), visible_glossy=False)
    col = bpy.data.collections.new("stream_only")
    col.objects.link(stream.obj)
    k2.light_linking.receiver_collection = col

    # foam head and bubbles
    rng = np.random.default_rng(9)
    nf = 900
    f_rho = 1 - (1 - np.sqrt(rng.uniform(0, 1, nf))) ** 1.5
    f_phi = rng.uniform(0, 2 * np.pi, nf)
    f_r = rng.uniform(0.00035, 0.0015, nf)
    f_t = np.sort(rng.uniform(4, 150, nf))
    foam = C.SphereSwarm("Foam", nf, C.mat_foam(), parent=g["root"], subdiv=1)
    nb = 280
    b_x, b_y = rng.uniform(-1, 1, nb), rng.uniform(-1, 1, nb)
    b_ph = rng.uniform(0, 1, nb)
    b_v = rng.uniform(0.02, 0.05, nb)
    b_r = rng.uniform(0.00015, 0.0006, nb)
    bub = C.SphereSwarm("Bubbles", nb, C.mat_bubble(), parent=g["root"], subdiv=1)
    ns = 36  # splash droplets hopping at the impact point
    s_ang = rng.uniform(0, 2 * np.pi, ns)
    s_v = rng.uniform(0.15, 0.35, ns)
    s_up = rng.uniform(0.25, 0.55, ns)
    s_per = rng.uniform(6, 14, ns)
    s_ph = rng.uniform(0, 1, ns)
    s_r = rng.uniform(0.0002, 0.0007, ns)
    splash = C.SphereSwarm("Splash", ns, C.mat_cola("SplashCola"), subdiv=1)

    cam, tgt = C.add_camera((0.0, -0.66, 0.10), (0.012, 0.0, 0.113), lens=58, fstop=5.6)
    cam.data.dof.focus_object = None

    kick = st["kick"]
    kick_e = kick.data.energy * 0.55

    def update(f):
        t = (f - 1) / (SHOT["frames"] - 1)
        e = C.ease_in_out(t)
        cam.location = (C.lerp(0.0, 0.01, e), C.lerp(-0.66, -0.58, e), C.lerp(0.10, 0.106, e))
        cam.data.dof.focus_distance = math.dist(cam.location, (0.0, 0.0, 0.1))
        lv = level(f)
        # the pour tapers off at the very end as the bottle lifts
        taper = float(C.smoothstep(168, 150, f))
        tilt = TILT + math.radians(10.0) * (1 - taper)
        ax = np.array([math.sin(tilt), 0.0, math.cos(tilt)])
        root.rotation_euler = (0, tilt, 0)
        root.location = tuple(MOUTH - ax * C.BOTTLE_LIP_TOP)
        lip = MOUTH + np.array([0.0035 * ax[2], 0.0, -0.0035 * ax[0]]) * -1 + ax * 0.0015
        vel = ax * (0.22 * (0.4 + 0.6 * taper))
        hit = stream.update(lip, vel, lv, 0.0047 * (0.25 + 0.75 * taper), f)
        stream.obj.hide_render = taper < 0.02
        # ice settles/lifts a little as the cola rises
        for (p, r, lift), ice in zip(ice_specs, ices):
            sub = C.smoothstep(p[2] - 0.01, p[2] + 0.012, lv)
            wob = 0.0006 * math.sin(f * 0.21 + p[2] * 300) * sub
            ice.location = (p[0] + 0.0008 * math.sin(f * 0.07 + p[1] * 900) * sub, p[1],
                            p[2] + lift * 0.0045 * sub + wob)
            ice.rotation_euler = np.radians(np.array(r) + np.array([2.5, -1.5, 4.0]) * sub * math.sin(f * 0.05 + p[0]))
        liq.update(lv, f)
        # foam floats on the surface, piling up over time
        rg = C.glass_inner_radius(lv) - 0.0008
        vis = f > f_t
        grow = np.clip((f - f_t) / 12.0, 0, 1)
        rho = f_rho * (rg - f_r)
        Cf = np.c_[rho * np.cos(f_phi), rho * np.sin(f_phi), np.full(nf, lv) + 0.3 * f_r
                   + 0.0012 * (f_rho > 0.85) * rng_stack]
        foam.set(Cf, np.where(vis, f_r * grow, 0.0))
        # rising bubbles inside the liquid
        base = C.GLASS_INNER_BASE + 0.002
        H = max(lv - base - 0.002, 0.001)
        z = base + ((b_ph + b_v * f / FPS / 0.06) % 1.0) * H
        rz = C.glass_inner_radius(z) * 0.85
        Cb = np.c_[b_x * rz * 0.7, b_y * rz * 0.7, z]
        bub.set(Cb, np.where(H > 0.004, b_r, 0.0))
        # splash droplets hopping around the impact point (glass-local coordinates)
        ph = ((f / s_per) + s_ph) % 1.0
        tt = ph * s_per / FPS
        dx = np.cos(s_ang) * s_v * tt
        dy = np.sin(s_ang) * s_v * tt
        dz = s_up * tt - 4.9 * tt ** 2
        alive = (dz > -0.001) & (taper > 0.2)
        Cs = np.c_[hit[0] + dx, hit[1] + dy, lv + np.maximum(dz, 0)]
        splash.set(Cs, np.where(alive, s_r, 0.0))
        # the low kicker only rises with the liquid so it never shows through empty glass
        kick.location.z = min(0.065, lv - 0.05)
        kick.data.size_y = max(0.02, min(0.16, (lv - 0.02) * 1.1))
        kick.data.energy = kick_e * float(C.smoothstep(0.03, 0.07, lv))

    rng_stack = np.random.default_rng(10).uniform(0, 1, nf)
    C.on_frame(update)
    update(1)
    return sc
