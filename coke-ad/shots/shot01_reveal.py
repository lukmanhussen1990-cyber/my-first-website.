"""Shot 01 (0:00-0:04): darkness, a strip light sweeps across the frosted bottle, red glow rises, slow push-in."""
import math

import cokelib as C

SHOT = {"id": "01", "name": "reveal", "frames": 96}


def build():
    sc = C.reset_scene(samples=8)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.0, glow_center=(0.0, 0.12), glow_radius=0.7)
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True, seed=3)
    root = b["root"]

    # sweeping strips: one behind (refracts through the bottle), one in front (travelling highlight)
    back = C.emissive_card("SweepBack", (0.0, 0.26, 0.12), (0.05, 0.7), (1.0, 0.96, 0.92), 0.0, look_at=(0, 0, 0.12))
    front = C.emissive_card("SweepFront", (0.0, -0.34, 0.13), (0.035, 0.7), (1, 1, 1), 0.0, look_at=(0, 0, 0.11))
    C.exclude_receivers(front, [st["floor"]], "front_excl")
    C.exclude_receivers(back, [st["floor"]], "back_excl")
    s_back, s_front = C.card_strength_socket(back), C.card_strength_socket(front)
    s_glow = C.backdrop_strength_socket(st["backdrop"])
    rims = [C.card_strength_socket(st[k]) for k in ("rimL", "rimR", "frontL", "frontR")]
    rim_full = [s.default_value for s in rims]
    lights = {k: st[k].data.energy for k in ("rimL_l", "rimR_l", "top", "fill", "kick")}

    cam, tgt = C.add_camera((0.0, -0.66, 0.058), (0.0, 0.0, 0.099), lens=50, fstop=4.0)
    cam.data.dof.focus_object = None
    n = SHOT["frames"]

    def update(f):
        t = (f - 1) / (n - 1)
        # camera push-in with a slight rise
        e = C.ease_in_out(t) * 0.7 + t * 0.3
        cam.location = (0.012 * (1 - e), C.lerp(-0.66, -0.53, e), C.lerp(0.05, 0.062, e))
        cam.data.dof.focus_distance = abs(cam.location[1]) - 0.03
        # slow turntable
        root.rotation_euler = (0, 0, math.radians(C.lerp(-16, 6, C.ease_in_out(t))))
        # back strip crosses left -> right; front strip right -> left, later
        tb = (f - 3) / 62.0
        back.location = (C.lerp(-0.42, 0.42, C.ease_in_out(tb)), 0.26, 0.12)
        s_back.default_value = 38.0 * C.smoothstep(0.0, 0.12, tb) * C.smoothstep(1.1, 0.85, tb)
        tf = (f - 26) / 58.0
        front.location = (C.lerp(0.36, -0.36, C.ease_in_out(tf)), -0.34, 0.13)
        s_front.default_value = 22.0 * C.smoothstep(0.0, 0.1, tf) * C.smoothstep(1.05, 0.8, tf)
        # the studio comes up
        s_glow.default_value = 0.2 * C.smoothstep(8, 88, f) ** 1.3
        k = float(C.smoothstep(34, 92, f))
        for s, full in zip(rims, rim_full):
            s.default_value = full * k
        for name, full in lights.items():
            st[name].data.energy = full * float(C.smoothstep(40, 96, f)) * (1.0 if name != "kick" else 1.0)
        st["kick"].data.energy = lights["kick"] * float(C.smoothstep(20, 80, f))

    C.on_frame(update)
    update(1)
    return sc
