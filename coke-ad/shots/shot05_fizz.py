"""Shot 05 (0:19-0:24): close on the top of the frosted glass: backlit ice at the surface, a foam ring,
bubble streams rising along the front wall, tiny droplets jumping out of the fizz. Slow push-in."""
import math

import numpy as np

import cokelib as C

SHOT = {"id": "05", "name": "fizz", "frames": 120}
LEVEL = 0.128
FPS = 24.0


def build():
    sc = C.reset_scene(res=(1024, 576), samples=8)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.35, glow_center=(0.0, 0.13), glow_radius=0.6)
    kick = st["kick"]
    kick.location = (0.0, 0.40, 0.092)
    kick.data.size_y = 0.04
    kick.data.energy *= 0.8

    g = C.make_glass("Glass", level=0.14, seed=13, drops=1300, mist=0.55)
    liq = C.GlassLiquid("GlassCola", g["root"], level=LEVEL, rings=50)
    ice_specs = [((-0.012, 0.006, LEVEL - 0.004), (14, 6, 25)), ((0.012, 0.010, LEVEL - 0.005), (-9, 17, 70)),
                 ((0.001, -0.011, LEVEL - 0.007), (22, -8, 12)), ((0.003, 0.004, LEVEL - 0.027), (35, 22, 48))]
    ices = []
    for i, (p, r) in enumerate(ice_specs):
        ice = C.make_ice_cube(f"Ice{i}", size=0.0245, seed=i + 7, parent=g["root"])
        ice.location = p
        ice.rotation_euler = np.radians(r)
        ices.append(ice)
    liq.cut_with(ices)

    rng = np.random.default_rng(5)
    # nucleation sites along the front inner wall (camera side)
    ns = 40
    th = rng.uniform(math.radians(-140), math.radians(-40), ns)
    zz = rng.uniform(0.06, LEVEL - 0.012, ns)
    rr = C.glass_inner_radius(zz) - rng.uniform(0.0006, 0.004, ns)
    src = np.c_[rr * np.cos(th), rr * np.sin(th), zz]
    per = 12
    streams = C.bubble_streams(ns, per, 3, C.glass_inner_radius, 0.06, LEVEL - 0.0008, speed=0.02,
                               wobble=0.0003, sources=src, size=(0.00025, 0.0007), grow=1.8)
    sw = C.SphereSwarm("Bubbles", ns * per, C.mat_bubble(), parent=g["root"], subdiv=2)
    # bubbles clinging to the inner wall
    nc = 160
    cth = rng.uniform(math.radians(-150), math.radians(-30), nc)
    cz = rng.uniform(0.07, LEVEL - 0.003, nc)
    cr = rng.uniform(0.0002, 0.0008, nc)
    cling = C.SphereSwarm("Cling", nc, C.mat_bubble(), parent=g["root"], subdiv=2)
    # foam ring along the wall
    R = C.glass_inner_radius(LEVEL) - 0.0006
    nf = 650
    fth = rng.uniform(0, 2 * np.pi, nf)
    frho = R * (1 - np.abs(rng.normal(0, 0.04, nf)))
    fr = rng.uniform(0.0003, 0.001, nf)
    fz = rng.uniform(0, 1, nf)
    foam_mat = C.mat_simple("FoamFine", **{"Base Color": (0.82, 0.64, 0.48, 1), "Transmission Weight": 0.7,
                                           "IOR": 1.33, "Roughness": 0.06, "Coat Weight": 1.0,
                                           "Coat Roughness": 0.02})
    foam = C.SphereSwarm("Foam", nf, foam_mat, parent=g["root"], subdiv=1)
    # fizz spray: droplets jumping above the surface (slow motion)
    nsp = 120
    spr_r = np.sqrt(rng.uniform(0, 1, nsp)) * (R - 0.002)
    spr_t = rng.uniform(0, 2 * np.pi, nsp)
    spx, spy = spr_r * np.cos(spr_t), spr_r * np.sin(spr_t)
    spv = rng.uniform(0.25, 0.6, nsp)
    spa = rng.uniform(0, 2 * np.pi, nsp)
    spper = rng.uniform(18, 40, nsp)
    spph = rng.uniform(0, 1, nsp)
    spr = rng.uniform(0.0001, 0.0003, nsp)
    spray = C.SphereSwarm("Spray", nsp, C.mat_cola("SprayCola"), parent=g["root"], subdiv=1)
    slow = 1 / 6.0

    cam, tgt = C.add_camera((0.0, -0.30, 0.122), (0.0, 0.0, 0.122), lens=100, fstop=5.6)
    cam.data.dof.focus_object = None

    def update(f):
        t = (f - 1) / (SHOT["frames"] - 1)
        e = C.ease_in_out(t) * 0.6 + 0.4 * t
        a = math.radians(C.lerp(-97, -84, e))
        dist = C.lerp(0.30, 0.255, e)
        z = C.lerp(0.118, 0.127, e)
        cam.location = (dist * math.cos(a), dist * math.sin(a), z)
        tgt.location = (0.0, 0.0, z - 0.004)
        cam.data.dof.focus_distance = dist - 0.03
        Cb, Rb = streams(f + 400)
        sw.set(Cb, Rb)
        grow = 1 + 0.25 * t
        rw = C.glass_inner_radius(cz) - cr * grow - 0.0001
        cling.set(np.c_[rw * np.cos(cth), rw * np.sin(cth), cz], cr * grow)
        foam.set(np.c_[frho * np.cos(fth), frho * np.sin(fth), LEVEL + 0.2 * fr + 0.0006 * fz], fr * (1 - 0.2 * t))
        php = (spph + f / spper) % 1.0
        tt = php * spper / FPS * slow
        z_ = LEVEL + spv * 0.95 * tt - 4.9 * tt ** 2
        xy = 0.25 * spv * tt
        alive = z_ > LEVEL
        spray.set(np.c_[spx + np.cos(spa) * xy, spy + np.sin(spa) * xy, np.where(alive, z_, LEVEL - 0.01)],
                  np.where(alive, spr, 0.0))

    C.on_frame(update)
    update(1)
    return sc
