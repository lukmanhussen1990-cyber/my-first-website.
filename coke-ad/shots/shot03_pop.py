"""Shot 03 (0:08-0:12): neck close-up; at local frame 25 the crown cap pops off in slow motion, CO2 vapor curls out."""
import math

import bpy
import numpy as np

import cokelib as C

SHOT = {"id": "03", "name": "pop", "frames": 96}
POP = 25.0
MOUTH = C.BOTTLE_LIP_TOP


def _vapor(name, loc, size):
    """Cube volume domain with an animated plume density. Returns (object, value nodes dict)."""
    V = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (0, 1)], dtype=float)
    V *= np.array([size[0] / 2, size[1] / 2, size[2]])
    F = np.array([[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]])
    me = C.mesh_from_arrays(name + "_me", V, F, smooth=False)
    m = bpy.data.materials.new(name + "_mat")
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new("ShaderNodeOutputMaterial")
    vol = N.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.92, 0.95, 1.0, 1)
    vol.inputs["Anisotropy"].default_value = 0.35
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    vals = {}
    for k, v in (("time", 0.0), ("rise", 0.0), ("amount", 0.0), ("spread", 0.006)):
        n = N.new("ShaderNodeValue")
        n.name = k
        n.outputs[0].default_value = v
        vals[k] = n
    # plume radius grows with height: R(z) = spread + 0.35*z
    rz = N.new("ShaderNodeMath"); rz.operation = "MULTIPLY_ADD"; rz.inputs[1].default_value = 0.42
    L.new(sep.outputs["Z"], rz.inputs[0]); L.new(vals["spread"].outputs[0], rz.inputs[2])
    xy = N.new("ShaderNodeCombineXYZ")
    L.new(sep.outputs["X"], xy.inputs[0]); L.new(sep.outputs["Y"], xy.inputs[1])
    rlen = N.new("ShaderNodeVectorMath"); rlen.operation = "LENGTH"
    L.new(xy.outputs[0], rlen.inputs[0])
    rn = N.new("ShaderNodeMath"); rn.operation = "DIVIDE"
    L.new(rlen.outputs["Value"], rn.inputs[0]); L.new(rz.outputs[0], rn.inputs[1])
    radial = N.new("ShaderNodeMapRange"); radial.interpolation_type = "SMOOTHSTEP"
    radial.inputs["From Min"].default_value = 1.0; radial.inputs["From Max"].default_value = 0.2
    L.new(rn.outputs[0], radial.inputs["Value"])
    # vertical extent: the front of the plume rises over time
    front = N.new("ShaderNodeMath"); front.operation = "SUBTRACT"
    L.new(vals["rise"].outputs[0], front.inputs[0]); L.new(sep.outputs["Z"], front.inputs[1])
    vert = N.new("ShaderNodeMapRange"); vert.interpolation_type = "SMOOTHSTEP"
    vert.inputs["From Min"].default_value = 0.0; vert.inputs["From Max"].default_value = 0.012
    L.new(front.outputs[0], vert.inputs["Value"])
    # swirling turbulence: noise advected upward
    off = N.new("ShaderNodeCombineXYZ")
    L.new(vals["rise"].outputs[0], off.inputs[2])
    adv = N.new("ShaderNodeVectorMath"); adv.operation = "SUBTRACT"
    L.new(tc.outputs["Object"], adv.inputs[0]); L.new(off.outputs[0], adv.inputs[1])
    nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"
    nz.inputs["Scale"].default_value = 90.0
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Roughness"].default_value = 0.6
    nz.inputs["Distortion"].default_value = 0.6
    L.new(adv.outputs[0], nz.inputs["Vector"]); L.new(vals["time"].outputs[0], nz.inputs["W"])
    wisps = N.new("ShaderNodeMapRange"); wisps.interpolation_type = "SMOOTHSTEP"
    wisps.inputs["From Min"].default_value = 0.52; wisps.inputs["From Max"].default_value = 0.8
    L.new(nz.outputs["Fac"], wisps.inputs["Value"])
    d1 = N.new("ShaderNodeMath"); d1.operation = "MULTIPLY"
    L.new(radial.outputs[0], d1.inputs[0]); L.new(vert.outputs[0], d1.inputs[1])
    d2 = N.new("ShaderNodeMath"); d2.operation = "MULTIPLY"
    L.new(d1.outputs[0], d2.inputs[0]); L.new(wisps.outputs[0], d2.inputs[1])
    d3 = N.new("ShaderNodeMath"); d3.operation = "MULTIPLY"
    L.new(d2.outputs[0], d3.inputs[0]); L.new(vals["amount"].outputs[0], d3.inputs[1])
    L.new(d3.outputs[0], vol.inputs["Density"])
    L.new(vol.outputs[0], out.inputs["Volume"])
    m.cycles.volume_step_rate = 1.0
    me.materials.append(m)
    ob = C.new_object(name, me)
    ob.location = loc
    ob.visible_shadow = False
    return ob, vals


def build():
    sc = C.reset_scene(samples=int(__import__("os").environ.get("COKE_SAMPLES", "16")))
    sc.frame_end = SHOT["frames"]
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    sc.cycles.volume_bounces = 0
    sc.cycles.volume_step_rate = 2.0
    st = C.make_studio("dark", glow=1.3, glow_center=(0.0, 0.19), glow_radius=0.6)
    # rims a little higher for the neck
    for k in ("rimL", "rimR", "frontL", "frontR"):
        st[k].location.z = 0.19
    st["kick"].data.energy = 0.0
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=True, seed=3)
    root = b["root"]
    root.rotation_euler = (0, 0, math.radians(-8))
    cap = b["cap"]
    cap_rest = np.array(cap.location)
    cap.rotation_mode = "XYZ"

    # CO2 vapor above the mouth (object origin at the mouth)
    vap, vv = _vapor("Vapor", (0, 0, MOUTH - 0.002), (0.07, 0.07, 0.09))

    # spray droplets thrown out of the mouth
    rng = np.random.default_rng(12)
    nsp = 46
    ang = rng.uniform(0, 2 * np.pi, nsp)
    elev = rng.uniform(np.radians(55), np.radians(85), nsp)
    spd = rng.uniform(0.35, 0.9, nsp)  # m/s (real time)
    vel = np.c_[np.cos(ang) * np.cos(elev), np.sin(ang) * np.cos(elev), np.sin(elev)] * spd[:, None]
    start = np.c_[np.cos(ang) * 0.0085, np.sin(ang) * 0.0085, np.full(nsp, MOUTH + 0.0005)]
    rad = rng.uniform(0.00018, 0.0006, nsp)
    delay = rng.uniform(0, 3.0, nsp)
    spray = C.SphereSwarm("Spray", nsp, C.mat_cola("SprayCola"), subdiv=2)

    # bubbles bursting up through the cola in the neck
    nb = 170
    bth = rng.uniform(0, 2 * np.pi, nb)
    brr = np.sqrt(rng.uniform(0, 1, nb)) * 0.0085
    bz0 = rng.uniform(0.118, 0.155, nb)
    bsp = rng.uniform(0.012, 0.03, nb)
    bdel = rng.uniform(0, 30, nb)
    brad = rng.uniform(0.00015, 0.0005, nb)
    bub = C.SphereSwarm("NeckBubbles", nb, C.mat_bubble(), parent=root, subdiv=1)

    cam, tgt = C.add_camera((0.012, -0.30, 0.172), (0.0, 0.0, 0.184), lens=100, fstop=4.0)
    cam.data.dof.focus_object = None
    cam.data.dof.focus_distance = 0.30
    slow = 1.0 / 16.0  # slow-motion factor (real seconds per film second)
    fps = 24.0

    def update(f):
        t = (f - 1) / (SHOT["frames"] - 1)
        # camera: slow drift up, tilting up with the cap
        cam.location = (C.lerp(0.012, -0.004, t), C.lerp(-0.30, -0.285, t), C.lerp(0.172, 0.182, C.ease_in_out(t)))
        up = C.ease_in_out((f - POP) / 50.0)
        tgt.location = (0.0, 0.0, 0.184 + 0.016 * up)
        dt = max(0.0, f - POP) / fps * slow  # real time since the pop
        if f < POP:
            k = C.smoothstep(POP - 9, POP, f)
            cap.location = tuple(cap_rest + np.array([0, 0, 0.00015 * k * math.sin(f * 2.7)]))
            cap.rotation_euler = (math.radians(0.8 * k * math.sin(f * 3.1)), math.radians(0.6 * k * math.cos(f * 2.3)), 0)
        else:
            v0, g = 1.25, 9.81
            h = v0 * dt - 0.5 * g * dt * dt
            cap.location = tuple(cap_rest + np.array([0.18 * h, 0.05 * h, h]))
            cap.rotation_euler = (math.radians(1400 * dt), math.radians(-600 * dt), math.radians(900 * dt))
        # vapor
        age = max(0.0, f - POP)
        vv["amount"].outputs[0].default_value = 320.0 * float(C.smoothstep(0, 3, age)) * float(C.smoothstep(75, 20, age))
        vv["rise"].outputs[0].default_value = 0.004 + 0.0011 * age
        vv["time"].outputs[0].default_value = 0.012 * f
        vv["spread"].outputs[0].default_value = 0.006 + 0.00012 * age
        # spray (slow motion ballistics); hidden before the pop
        ts = np.maximum(0.0, (f - POP - delay)) / fps * slow
        P = start + vel * ts[:, None] + np.array([0, 0, -0.5 * 9.81]) * (ts ** 2)[:, None]
        alive = (f >= POP + delay) & (P[:, 2] > MOUTH - 0.03)
        R = np.where(alive, rad, 0.0)
        P = np.where(alive[:, None], P, np.array([0, 0, 0.1]))
        spray.set(P, R)
        # neck bubbles: start after the pop, rise and vanish at the surface
        tb = np.maximum(0.0, f - POP - bdel)
        z = bz0 + bsp * tb / fps * 2.2
        live = (f > POP + bdel) & (z < 0.1575)
        Cb = np.c_[brr * np.cos(bth) + 0.0004 * np.sin(tb * 0.7), brr * np.sin(bth), z]
        Rb = np.where(live, brad * (1 + 0.6 * np.clip(tb / 40, 0, 1)), 0.0)
        bub.set(np.where(live[:, None], Cb, np.array([0, 0, 0.13])), Rb)

    C.on_frame(update)
    update(1)
    return sc
