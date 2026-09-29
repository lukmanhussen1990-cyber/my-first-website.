"""Shot 02 (0:04-0:08): extreme macro glide across the beaded bottle and wordmark; one drop runs down."""
import math

import bpy
import numpy as np

import cokelib as C

SHOT = {"id": "02", "name": "macro", "frames": 96}

TH_RUN = math.radians(-80.0)  # angle of the running drop (front of the bottle is -90 deg)
Z_START, Z_END = 0.1135, 0.079
W_RUN = 0.0015  # half-width of the wiped streak (m)


def _add_wipe(mat):
    """Insert an animated vertical wipe into the bottle's mist mask. Returns the Value node holding z_drop."""
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    mist = N["mist_strength"]
    src = mist.inputs[0].links[0].from_socket  # condensation map R
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    ang = N.new("ShaderNodeMath"); ang.operation = "ARCTAN2"
    L.new(sep.outputs["Y"], ang.inputs[0]); L.new(sep.outputs["X"], ang.inputs[1])
    # small wobble of the path
    wz = N.new("ShaderNodeMath"); wz.operation = "MULTIPLY"; wz.inputs[1].default_value = 700.0
    L.new(sep.outputs["Z"], wz.inputs[0])
    ws = N.new("ShaderNodeMath"); ws.operation = "SINE"
    L.new(wz.outputs[0], ws.inputs[0])
    wa = N.new("ShaderNodeMath"); wa.operation = "MULTIPLY_ADD"
    wa.inputs[1].default_value = 0.012; wa.inputs[2].default_value = TH_RUN
    L.new(ws.outputs[0], wa.inputs[0])
    d = N.new("ShaderNodeMath"); d.operation = "SUBTRACT"
    L.new(ang.outputs[0], d.inputs[0]); L.new(wa.outputs[0], d.inputs[1])
    ad = N.new("ShaderNodeMath"); ad.operation = "ABSOLUTE"
    L.new(d.outputs[0], ad.inputs[0])
    lat = N.new("ShaderNodeMath"); lat.operation = "MULTIPLY"; lat.inputs[1].default_value = 0.0296
    L.new(ad.outputs[0], lat.inputs[0])
    side = N.new("ShaderNodeMapRange")
    side.inputs["From Min"].default_value = W_RUN * 0.55
    side.inputs["From Max"].default_value = W_RUN
    side.inputs["To Min"].default_value = 1.0
    side.inputs["To Max"].default_value = 0.0
    side.interpolation_type = "SMOOTHSTEP"
    L.new(lat.outputs[0], side.inputs["Value"])
    zdrop = N.new("ShaderNodeValue"); zdrop.name = "z_drop"; zdrop.outputs[0].default_value = Z_START + 0.01
    lo = N.new("ShaderNodeMath"); lo.operation = "SUBTRACT"
    L.new(sep.outputs["Z"], lo.inputs[0]); L.new(zdrop.outputs[0], lo.inputs[1])
    below = N.new("ShaderNodeMapRange")
    below.inputs["From Min"].default_value = 0.0
    below.inputs["From Max"].default_value = 0.0012
    below.interpolation_type = "SMOOTHSTEP"
    L.new(lo.outputs[0], below.inputs["Value"])
    above = N.new("ShaderNodeMapRange")
    above.inputs["From Min"].default_value = Z_START + 0.003
    above.inputs["From Max"].default_value = Z_START - 0.001
    above.interpolation_type = "SMOOTHSTEP"
    L.new(sep.outputs["Z"], above.inputs["Value"])
    m1 = N.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
    L.new(side.outputs[0], m1.inputs[0]); L.new(below.outputs[0], m1.inputs[1])
    m2 = N.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
    L.new(m1.outputs[0], m2.inputs[0]); L.new(above.outputs[0], m2.inputs[1])
    inv = N.new("ShaderNodeMath"); inv.operation = "MULTIPLY_ADD"
    inv.inputs[1].default_value = -0.93; inv.inputs[2].default_value = 1.0
    L.new(m2.outputs[0], inv.inputs[0])
    mm = N.new("ShaderNodeMath"); mm.operation = "MULTIPLY"
    L.new(src, mm.inputs[0]); L.new(inv.outputs[0], mm.inputs[1])
    L.new(mm.outputs[0], mist.inputs[0])
    return zdrop


def build():
    sc = C.reset_scene(res=(960, 540), samples=12)
    sc.frame_end = SHOT["frames"]
    st = C.make_studio("dark", glow=1.2, glow_center=(0.0, 0.10), glow_radius=0.8)
    b = C.make_contour_bottle("Bottle", fill_z=0.158, cap=False, seed=3)
    mat = b["glass"].data.materials[0]
    mat.node_tree.nodes["mist_strength"].inputs[1].default_value = 0.35
    zdrop = _add_wipe(mat)
    for k, f in (("frontL", 0.6), ("frontR", 0.5), ("rimL", 0.25), ("rimR", 0.25)):
        sock = C.card_strength_socket(st[k])
        sock.default_value *= f
    st["fill"].data.energy *= 0.5

    # the running drop: a single elongated droplet that slides along the surface
    surf = C.bottle_surface()
    P, Nn, tz = surf.point(np.array([TH_RUN]), np.array([Z_START]))
    run_me = C.droplets_mesh("RunDrop_me", P, Nn, tz, np.array([0.0019]), np.array([0.0027]),
                             np.array([0.0011]), sag=np.array([1.0]), seg=20, rings=7)
    run_me.materials.append(C.mat_water())
    run = C.new_object("RunDrop", run_me, b["root"])
    run.visible_shadow = False
    run_V0 = C.DROP_INFO[run_me.name]["V"] - P[0]

    # droplets swallowed by the run
    dinfo = C.DROP_INFO[b["drops"].data.name]
    dP, dr, nv, dV = dinfo["P"], dinfo["r"], dinfo["nv"], dinfo["V"]
    th = np.arctan2(dP[:, 1], dP[:, 0])
    lat = np.abs(((th - TH_RUN + np.pi) % (2 * np.pi)) - np.pi) * 0.0296
    in_path = (lat < W_RUN + dr) & (dP[:, 2] < Z_START + 0.002) & (dP[:, 2] > Z_END - 0.004)
    path_idx = np.where(in_path)[0]

    n = SHOT["frames"]
    cam, tgt = C.add_camera((0, -0.15, 0.1), (0, -0.03, 0.1), lens=100, fstop=3.5)
    cam.data.dof.focus_object = None

    def z_of(f):
        # the drop hesitates, then accelerates (stick-slip), timed so it crosses frame centre mid-shot
        t = np.clip((f - 14) / (n - 14), 0, 1)
        return Z_START - (Z_START - Z_END) * (0.25 * t + 0.75 * t ** 2.2)

    def update(f):
        t = (f - 1) / (n - 1)
        e = C.ease_in_out(t) * 0.6 + 0.4 * t
        a = math.radians(C.lerp(-100.0, -84.0, e))
        rc = 0.215
        zc = C.lerp(0.128, 0.097, e)
        cam.location = (rc * math.cos(a), rc * math.sin(a), zc)
        at = a + math.radians(3.0)
        rs = 0.0296
        look = (rs * math.cos(at), rs * math.sin(at), zc - 0.006)
        tgt.location = look
        cam.data.dof.focus_distance = math.dist(cam.location, look) - 0.001
        zd = float(z_of(f))
        zdrop.outputs[0].default_value = zd
        Pd, Nd, tzd = surf.point(np.array([TH_RUN + 0.012 * math.sin(zd * 700)]), np.array([zd]))
        C.set_verts(run_me, run_V0 + Pd[0])
        # swallow droplets the run has passed
        V = dV.copy().reshape(-1, nv, 3)
        gone = path_idx[dP[path_idx, 2] > zd - 0.0008]
        V[gone] = dP[gone][:, None, :] - 0.0005 * (dP[gone] / np.linalg.norm(dP[gone], axis=1, keepdims=True))[:, None, :]
        C.set_verts(b["drops"].data, V.reshape(-1, 3))

    C.on_frame(update)
    update(1)
    return sc
