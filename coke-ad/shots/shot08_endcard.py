"""Shot 08 (0:35-0:40): end-card plate: the bottle on a seamless Coca-Cola red sweep, right third of frame.
Rendered as one high-quality still (--frames 1); the finishing pass adds the push-in and typography."""
import math

import cokelib as C

SHOT = {"id": "08", "name": "endcard", "frames": 1}


def build():
    sc = C.reset_scene(res=(1920, 1080), samples=40, look="AgX - Punchy")
    st = C.make_studio("red")
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True, seed=3, mist=0.8)
    b["root"].location = (0.105, 0.0, 0.0)
    b["root"].rotation_euler = (0, 0, math.radians(-4))
    for k in ("rimL", "rimR", "frontL"):
        st[k].location.x += 0.105
    st["kick"].location.x += 0.105
    cam, tgt = C.add_camera((0.0, -0.80, 0.085), (0.0, 0.0, 0.104), lens=50, fstop=8.0)
    cam.data.dof.focus_distance = 0.80
    return sc
