"""Shot 07 (0:29-0:35): hero pack shot: open bottle and a full glass on the wet black floor, red glow behind,
the camera slowly arcs; a strip-light glint sweeps across both."""
import math

import numpy as np

import cokelib as C

SHOT = {"id": "07", "name": "hero", "frames": 144}
LEVEL = 0.118


def build():
    sc = C.reset_scene(res=(1152, 648), samples=8)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.25, glow_center=(0.0, 0.11), glow_radius=0.8)
    b = C.make_contour_bottle("Bottle", fill_z=0.150, cap=False, seed=3)
    b["root"].location = (-0.058, 0.0, 0.0)
    b["root"].rotation_euler = (0, 0, math.radians(8))
    cap = C.make_crown_cap("LooseCap")
    cap.location = (0.012, -0.075, 0.0062)
    cap.rotation_euler = (math.radians(180), math.radians(-6), math.radians(35))

    g = C.make_glass("Glass", level=LEVEL, seed=11)
    g["root"].location = (0.066, 0.03, 0.0)
    liq = C.GlassLiquid("GlassCola", g["root"], level=LEVEL)
    ices = []
    for i, (p, r) in enumerate([((-0.013, -0.008, LEVEL - 0.003), (12, 5, 30)), ((0.014, 0.004, LEVEL - 0.002), (-8, 14, 75)),
                                ((0.0, 0.014, LEVEL - 0.006), (20, -10, 10)), ((0.002, -0.004, LEVEL - 0.026), (35, 20, 50))]):
        ice = C.make_ice_cube(f"Ice{i}", size=0.026, seed=i, parent=g["root"])
        ice.location = p
        ice.rotation_euler = np.radians(r)
        ices.append(ice)
    liq.cut_with(ices)
    streams = C.bubble_streams(18, 12, 1, C.glass_inner_radius, 0.02, LEVEL - 0.001, speed=0.028)
    sw = C.SphereSwarm("Bubbles", 18 * 12, C.mat_bubble(), parent=g["root"])
    rng = np.random.default_rng(3)
    R = C.glass_inner_radius(LEVEL) - 0.0006
    nf = 500
    fth = rng.uniform(0, 2 * np.pi, nf)
    frho = R * (1 - np.abs(rng.normal(0, 0.04, nf)))
    fr = rng.uniform(0.0003, 0.001, nf)
    foam_mat = C.mat_simple("FoamFine", **{"Base Color": (0.82, 0.64, 0.48, 1), "Transmission Weight": 0.7,
                                           "IOR": 1.33, "Roughness": 0.06, "Coat Weight": 1.0,
                                           "Coat Roughness": 0.02})
    foam = C.SphereSwarm("Foam", nf, foam_mat, parent=g["root"], subdiv=1)
    foam.set(np.c_[frho * np.cos(fth), frho * np.sin(fth), LEVEL + 0.2 * fr], fr)

    sweep = C.emissive_card("Sweep", (0.0, -0.42, 0.12), (0.04, 0.7), (1, 1, 1), 0.0, look_at=(0, 0, 0.1))
    C.exclude_receivers(sweep, [st["floor"]], "sweep_excl")
    s_sweep = C.card_strength_socket(sweep)

    cam, tgt = C.add_camera((0, -0.72, 0.07), (0.004, 0.0, 0.088), lens=55, fstop=5.6)
    cam.data.dof.focus_object = None

    def update(f):
        t = (f - 1) / (SHOT["frames"] - 1)
        e = C.ease_in_out(t)
        a = math.radians(C.lerp(-101, -81, e))
        d = C.lerp(0.74, 0.68, e)
        cam.location = (d * math.cos(a), d * math.sin(a), C.lerp(0.066, 0.08, e))
        cam.data.dof.focus_distance = d
        ts = (f - 44) / 70.0
        sweep.location = (C.lerp(-0.4, 0.42, C.ease_in_out(ts)), -0.42, 0.12)
        s_sweep.default_value = 30.0 * float(C.smoothstep(0.0, 0.12, ts) * C.smoothstep(1.05, 0.85, ts))
        Cb, Rb = streams(f + 200)
        sw.set(Cb, Rb)

    C.on_frame(update)
    update(1)
    return sc
