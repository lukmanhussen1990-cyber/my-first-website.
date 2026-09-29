"""Library test stills: python3 test_assets.py [hero|macro|red|all]"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
import cokelib as C  # noqa: E402

OUT = os.path.join(C.SCRATCH, "tests", "lib")
os.makedirs(OUT, exist_ok=True)


def hero_props(with_glass=True):
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True)
    b["root"].location = (-0.055, 0.0, 0.0)
    b["root"].rotation_euler = (0, 0, np.radians(4))
    if with_glass:
        g = C.make_glass("Glass", level=0.112)
        g["root"].location = (0.07, 0.03, 0.0)
        liq = C.GlassLiquid("GlassCola", g["root"], level=0.112)
        ices = []
        for i, (x, y, z, rx, ry, rz) in enumerate([(-0.013, -0.009, 0.110, 12, 5, 30), (0.014, 0.004, 0.113, -8, 14, 75),
                                                   (0.0, 0.014, 0.106, 20, -10, 10), (0.002, -0.004, 0.086, 35, 20, 50)]):
            ice = C.make_ice_cube(f"Ice{i}", size=0.026, seed=i, parent=g["root"])
            ice.location = (x, y, z)
            ice.rotation_euler = np.radians((rx, ry, rz))
            ices.append(ice)
        liq.cut_with(ices)
        rad = C.glass_inner_radius
        fn = C.bubble_streams(14, 10, 1, rad, 0.016, 0.110, speed=0.03)
        sw = C.SphereSwarm("Bubbles", 140, C.mat_bubble(), parent=g["root"])
        Cc, R = fn(10.0)
        sw.set(Cc, R)
    return b


def render(name, twice=False):
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(OUT, name + ".png")
    for k in range(2 if twice else 1):
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"RENDER {name} {sc.render.resolution_x}x{sc.render.resolution_y} s={sc.cycles.samples}: {time.time() - t:.1f}s", flush=True)


def hero():
    C.reset_scene(res=(640, 360), samples=24)
    C.make_studio("dark")
    hero_props()
    C.add_camera((0.02, -0.78, 0.075), (0.008, 0.0, 0.092), lens=60, fstop=5.6)
    render("hero", twice="--twice" in sys.argv)


def macro():
    C.reset_scene(res=(640, 360), samples=24)
    C.make_studio("dark")
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=False)
    C.add_camera((0.035, -0.17, 0.10), (0.0, -0.029, 0.095), lens=100, fstop=4.0)
    render("macro")


def bottle():
    C.reset_scene(res=(640, 360), samples=24)
    C.make_studio("dark")
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True)
    C.add_camera((0.0, -0.56, 0.10), (0.0, 0.0, 0.10), lens=85, fstop=8)
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 405, 720
    render("bottle")


def red():
    C.reset_scene(res=(640, 360), samples=24)
    C.make_studio("red")
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True)
    b["root"].location = (0.10, 0.0, 0.0)
    C.add_camera((0.0, -0.75, 0.11), (0.0, 0.0, 0.11), lens=60, fstop=8)
    render("red")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    for fn in (hero, macro, red, bottle):
        if which in ("all", fn.__name__):
            fn()
    sys.stdout.flush()
    os._exit(0)  # the bpy module can deadlock during interpreter shutdown
