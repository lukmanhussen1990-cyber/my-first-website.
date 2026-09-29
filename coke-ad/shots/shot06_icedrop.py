"""Shot 06 (0:24-0:29): super slow motion ice cube dropping into the full glass; impact at local frame 25
(0:25.0) throws a crown of cola and droplets, ripples spread, a cloud of bubbles trails the cube."""
import math

import numpy as np

import cokelib as C

SHOT = {"id": "06", "name": "icedrop", "frames": 120}
LEVEL = 0.132
FPS = 24.0
IMPACT = 25.0
SLOW = 1 / 10.0
HIT = np.array([0.003, -0.003])
ICE = 0.0235


def build():
    sc = C.reset_scene(res=(1024, 576), samples=8)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.3, glow_center=(0.0, 0.15), glow_radius=0.6)
    st["kick"].location = (0.0, 0.40, 0.05)
    st["kick"].data.size_y = 0.05
    st["kick"].data.energy *= 0.7

    def rt(f):
        return max(0.0, f - IMPACT) / FPS * SLOW  # real seconds since the impact

    def surface(x, y, f):
        t = rt(f)
        if t <= 0:
            return 0.00006 * np.sin(700 * x + 0.3 * f) * np.sin(640 * y - 0.2 * f)
        r = np.hypot(x - HIT[0], y - HIT[1])
        c = 0.25  # capillary-gravity wave speed (m/s)
        front = c * t
        wave = 0.0022 * np.exp(-t / 0.35) * np.sin(2 * np.pi * (r - front) / 0.009) * np.exp(-((r - front) / 0.012) ** 2)
        crater = -0.006 * np.exp(-(r / 0.009) ** 2) * math.sin(min(math.pi, t / 0.09 * math.pi)) * (t < 0.09)
        return wave + crater

    g = C.make_glass("Glass", level=LEVEL, seed=19, drops=1300, mist=0.6)
    liq = C.GlassLiquid("GlassCola", g["root"], level=LEVEL, rings=56, T=128, surface_fn=surface)
    floaters = [((-0.018, 0.013, LEVEL - 0.005), (14, 6, 25)), ((0.019, 0.015, LEVEL - 0.006), (-9, 17, 70))]
    ices = []
    for i, (p, r) in enumerate(floaters):
        ice = C.make_ice_cube(f"Ice{i}", size=ICE, seed=i + 11, parent=g["root"])
        ice.location = p
        ice.rotation_euler = np.radians(r)
        ices.append(ice)
    drop = C.make_ice_cube("DropIce", size=0.024, seed=31, parent=g["root"])
    drop.rotation_mode = "XYZ"
    ices.append(drop)
    liq.cut_with(ices)

    rng = np.random.default_rng(8)
    # splash droplets
    nd = 90
    ang = rng.uniform(0, 2 * np.pi, nd)
    vr = rng.uniform(0.12, 0.45, nd)
    vz = rng.uniform(0.35, 0.95, nd)
    d0 = rng.uniform(0.008, 0.013, nd)
    rad = rng.uniform(0.0004, 0.0017, nd) * np.where(rng.uniform(0, 1, nd) < 0.15, 1.6, 1.0)
    delay = rng.uniform(0.0, 0.02, nd)
    drops = C.SphereSwarm("SplashDrops", nd, C.mat_cola("SplashCola"), parent=g["root"], subdiv=2)
    # crown sheet: thin lathe ring around the impact
    T = 72
    prof_n = 10
    crown_me = C.mesh_from_arrays("Crown_me", np.zeros((prof_n * T, 3)),
                                  [np.array([i * T + j, i * T + (j + 1) % T, (i + 1) * T + (j + 1) % T, (i + 1) * T + j])
                                   for i in range(prof_n - 1) for j in range(T)])
    crown_me.materials.append(C.mat_cola())
    crown = C.new_object("Crown", crown_me, g["root"])
    crown.visible_shadow = False
    fing = rng.uniform(0.6, 1.4, T)
    fing = np.convolve(np.r_[fing[-3:], fing, fing[:3]], np.ones(4) / 4, mode="same")[3:-3]
    # bubble cloud dragged down by the cube
    nb = 220
    b_off = rng.normal(0, 1, (nb, 3)) * np.array([0.007, 0.007, 0.006])
    b_r = rng.uniform(0.0002, 0.0011, nb)
    b_v = rng.uniform(0.04, 0.12, nb)
    bub = C.SphereSwarm("DragBubbles", nb, C.mat_bubble(), parent=g["root"], subdiv=2)

    cam, tgt = C.add_camera((0.0, -0.36, 0.168), (0.0, 0.0, 0.142), lens=100, fstop=6.3)
    cam.data.dof.focus_object = None
    cam.data.dof.focus_distance = 0.36

    def cube_state(f):
        """Drop cube centre z and rotation (deg) at frame f."""
        z_contact = LEVEL + 0.012
        if f <= IMPACT:
            tf = (IMPACT - f) / FPS * SLOW  # real seconds before contact
            v_imp = 1.2
            z = z_contact + v_imp * tf + 0.5 * 9.81 * tf * tf
            spin = -40 * tf
        else:
            t = rt(f)
            # plunge, then buoyant damped bob to float height
            z_float = LEVEL - 0.004
            z = z_float + (z_contact - z_float - 0.012) * math.exp(-t / 0.12) * math.cos(t * 9.0) - 0.012 * math.exp(-t / 0.05)
            z = min(z, z_contact)
            spin = 30 * t
        return z, np.array([18 + 3 * spin, -10 + 2 * spin, 35 + 5 * spin])

    def update(f):
        tt = (f - 1) / (SHOT["frames"] - 1)
        cam.location = (C.lerp(0.006, -0.006, tt), C.lerp(-0.36, -0.33, C.ease_in_out(tt)), C.lerp(0.168, 0.164, tt))
        t = rt(f)
        z, rot = cube_state(f)
        drop.location = (HIT[0], HIT[1], z)
        drop.rotation_euler = np.radians(rot)
        for (p, r), ice in zip(floaters, ices[:2]):
            bob = 0.0012 * math.exp(-t / 0.5) * math.sin(t * 22 + p[0] * 300) * (t > 0.02)
            ice.location = (p[0], p[1], p[2] + bob + 0.0002 * math.sin(f * 0.1 + p[1] * 500))
        liq.update(LEVEL, f)
        # droplets (ballistic, slow motion)
        td = np.maximum(0.0, t - delay)
        rr = d0 + vr * td
        zz = LEVEL + 0.002 + vz * td - 4.905 * td ** 2
        alive = (t > delay) & (zz > LEVEL - 0.001)
        P = np.c_[HIT[0] + rr * np.cos(ang), HIT[1] + rr * np.sin(ang), zz]
        # fake motion blur: stretch along the (mostly vertical) velocity by the shutter travel
        vzf = np.abs(vz - 9.81 * td) * SLOW / FPS * 0.5
        S = np.c_[np.ones(nd), np.ones(nd), 1 + vzf / np.maximum(rad, 1e-5)]
        drops.set(np.where(alive[:, None], P, np.array([0, 0, LEVEL - 0.02])), np.where(alive, rad, 0.0), S)
        # crown sheet
        if 0 < t < 0.14:
            k = t / 0.14
            Rc = 0.007 + 0.013 * (1 - (1 - k) ** 2)
            Hc = 0.013 * math.sin(math.pi * k ** 0.8)
            th = 2 * np.pi * np.arange(T) / T
            V = []
            for i in range(prof_n):
                u = i / (prof_n - 1)
                h = -0.001 + u * Hc * fing
                rad_ = Rc + 0.004 * u * u * k - 0.0006 * (1 - u)
                V.append(np.c_[HIT[0] + rad_ * np.cos(th), HIT[1] + rad_ * np.sin(th), LEVEL + h])
            V = np.vstack(V)
            # give it thickness by pushing alternate rows? keep as a thin sheet; the tube is closed by solidify below
            C.set_verts(crown_me, V)
            crown.hide_render = False
        else:
            crown.hide_render = True
        # bubbles: dragged down with the cube, then rise back
        if t > 0:
            base = np.array([HIT[0], HIT[1], LEVEL - 0.014])
            P = base + b_off * (1 + 3 * t) + np.c_[np.zeros(nb), np.zeros(nb), b_v * np.maximum(0, t - 0.08)]
            live = P[:, 2] < LEVEL - 0.0005
            bub.set(np.where(live[:, None], P, base), np.where(live, b_r, 0.0))
        else:
            bub.set(np.zeros((nb, 3)) + np.array([0, 0, LEVEL - 0.03]), np.zeros(nb))

    mod = crown.modifiers.new("Thick", "SOLIDIFY")
    mod.thickness = 0.0007
    mod.offset = 0
    C.on_frame(update)
    update(1)
    return sc
