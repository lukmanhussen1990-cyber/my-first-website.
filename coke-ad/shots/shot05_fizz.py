"""Shot 05 (0:19-0:24): close on the fizzing surface from above: floating ice, foam ring, popping bubbles,
tiny droplets jumping out of the fizz. Slow push-in with a gentle orbit."""
import math

import numpy as np

import cokelib as C

SHOT = {"id": "05", "name": "fizz", "frames": 120}
LEVEL = 0.139
FPS = 24.0


def build():
    sc = C.reset_scene(res=(1024, 576), samples=10)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.25, glow_center=(0.0, 0.10), glow_radius=0.7)
    # high cards so the liquid surface and the ice catch long reflections
    C.emissive_card("TopStripA", (-0.10, 0.28, 0.42), (0.05, 0.5), (1.0, 0.97, 0.94), 14.0, look_at=(0, 0, 0.13))
    C.emissive_card("TopStripB", (0.16, 0.24, 0.38), (0.04, 0.45), (0.95, 0.97, 1.0), 10.0, look_at=(0, 0, 0.13))

    def ripples(x, y, f):
        t = f / FPS
        r = np.hypot(x, y)
        return (0.00012 * np.sin(900 * x + 3.1 * t) * np.sin(760 * y - 2.3 * t)
                + 0.00008 * np.sin(1400 * r - 6.0 * t))

    g = C.make_glass("Glass", level=0.146, seed=17, drops=1300, mist=0.75)
    liq = C.GlassLiquid("GlassCola", g["root"], level=LEVEL, rings=60)
    ice_specs = [((-0.011, 0.006, LEVEL - 0.004), (14, 6, 25)), ((0.012, 0.010, LEVEL - 0.005), (-9, 17, 70)),
                 ((0.002, -0.013, LEVEL - 0.006), (22, -8, 12))]
    ices = []
    for i, (p, r) in enumerate(ice_specs):
        ice = C.make_ice_cube(f"Ice{i}", size=0.0235, seed=i + 7, parent=g["root"])
        ice.location = p
        ice.rotation_euler = np.radians(r)
        ices.append(ice)
    liq.cut_with(ices)

    rng = np.random.default_rng(5)
    R = C.glass_inner_radius(LEVEL) - 0.0006
    # foam ring along the wall and a few patches
    nf = 1300
    fth = rng.uniform(0, 2 * np.pi, nf)
    frho = R * (1 - np.abs(rng.normal(0, 0.035, nf)))
    fr = rng.uniform(0.00015, 0.00065, nf) * (1 + 0.8 * (rng.uniform(0, 1, nf) < 0.08))
    fz = rng.uniform(0, 1, nf)
    foam_mat = C.mat_simple("FoamFine", **{"Base Color": (0.82, 0.64, 0.48, 1), "Transmission Weight": 0.7,
                                           "IOR": 1.33, "Roughness": 0.06, "Coat Weight": 1.0,
                                           "Coat Roughness": 0.02})
    foam = C.SphereSwarm("Foam", nf, foam_mat, parent=g["root"], subdiv=1)
    # surface bubbles that swell and pop
    nb = 260
    bx, by = [], []
    while len(bx) < nb:
        x, y = rng.uniform(-R, R, 2)
        if x * x + y * y < (R - 0.001) ** 2:
            bx.append(x)
            by.append(y)
    bx, by = np.array(bx), np.array(by)
    bph = rng.uniform(0, 1, nb)
    bper = rng.uniform(20, 60, nb)
    brad = rng.uniform(0.0002, 0.0008, nb)
    sbub = C.SphereSwarm("SurfBubbles", nb, C.mat_simple("BubbleFilm", **{"Base Color": (1, 1, 1, 1),
                         "Transmission Weight": 1.0, "IOR": 1.33, "Roughness": 0.0, "Thin Film Thickness": 450.0}),
                         parent=g["root"], subdiv=2)
    # fizz spray: droplets jumping from popped bubbles (slow motion)
    nsp = 180
    spx, spy = bx[rng.integers(0, nb, nsp)], by[rng.integers(0, nb, nsp)]
    spv = rng.uniform(0.25, 0.6, nsp)
    spa = rng.uniform(0, 2 * np.pi, nsp)
    spl = rng.uniform(0.05, 0.25, nsp)
    spper = rng.uniform(18, 40, nsp)
    spph = rng.uniform(0, 1, nsp)
    spr = rng.uniform(0.00008, 0.00028, nsp)
    spray = C.SphereSwarm("Spray", nsp, C.mat_cola("SprayCola"), parent=g["root"], subdiv=1)
    slow = 1 / 6.0

    cam, tgt = C.add_camera((0.0, -0.22, 0.25), (0.0, 0.0, 0.135), lens=85, fstop=5.0)
    cam.data.dof.focus_object = None

    def update(f):
        t = (f - 1) / (SHOT["frames"] - 1)
        e = C.ease_in_out(t) * 0.6 + 0.4 * t
        a = math.radians(C.lerp(-100, -80, e))
        dist = C.lerp(0.25, 0.205, e)
        el = math.radians(C.lerp(36, 32, e))
        cam.location = (dist * math.cos(el) * math.cos(a), dist * math.cos(el) * math.sin(a),
                        0.137 + dist * math.sin(el))
        tgt.location = (0.0, 0.0, 0.136)
        cam.data.dof.focus_distance = dist - 0.004
        foam.set(np.c_[frho * np.cos(fth + 0.02 * t), frho * np.sin(fth + 0.02 * t), LEVEL + 0.2 * fr + 0.0005 * fz],
                 fr * (1 - 0.25 * t))
        ph = (bph + f / bper) % 1.0
        rb = brad * np.sqrt(ph) * (ph < 0.92)
        sbub.set(np.c_[bx, by, np.full(nb, LEVEL + 0.00005) + 0.25 * rb], rb)
        php = (spph + f / spper) % 1.0
        tt = php * spper / FPS * slow
        vz = spv * math.sin(1.25)
        z = LEVEL + vz * tt - 4.9 * tt ** 2
        xy = spl * spv * tt
        alive = z > LEVEL
        spray.set(np.c_[spx + np.cos(spa) * xy, spy + np.sin(spa) * xy, np.where(alive, z, LEVEL - 0.01)],
                  np.where(alive, spr, 0.0))

    C.on_frame(update)
    update(1)
    return sc
