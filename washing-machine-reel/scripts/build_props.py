"""Props: tub, water, bottle, undies, clothes blobs, drum rig, motor, belt, outer tub, pump, hoses, cabinet, arrows."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler
import lib
from lib import srgb
from build_set import append_ph, math_node

DRUM_POS = Vector((2.7, -0.35, 0.0))
AXLE_Z = 0.86
DRUM_R = 0.34
DRUM_D = 0.5


# ------------------------------------------------------------ materials
def steel_mat(name, color="#5B5E62", rough=0.32, brushed=True, inside=None):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb(color)
    p.inputs["Metallic"].default_value = 0.85
    p.inputs["Roughness"].default_value = rough
    if brushed:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, 1.0, 120.0)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 6.0
        nz.inputs["Detail"].default_value = 8
        nt.links.new(mp.outputs[0], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = rough - 0.08
        mr.inputs["To Max"].default_value = rough + 0.12
        nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs[0], p.inputs["Roughness"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.05
        nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb(color)
    return m


def water_mat(name):
    """Water with animatable value node 'Dirt' (0 clean -> 1 brown) and 'Foam' (white)."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    dirt = nt.nodes.new("ShaderNodeValue"); dirt.name = "Dirt"; dirt.label = "Dirt"; dirt.outputs[0].default_value = 0.0
    foam = nt.nodes.new("ShaderNodeValue"); foam.name = "Foam"; foam.label = "Foam"; foam.outputs[0].default_value = 0.0
    c1 = nt.nodes.new("ShaderNodeMix"); c1.data_type = 'RGBA'
    c1.inputs["A"].default_value = srgb("#A9C6D2")
    c1.inputs["B"].default_value = srgb("#7A5A33")
    nt.links.new(dirt.outputs[0], c1.inputs["Factor"])
    c2 = nt.nodes.new("ShaderNodeMix"); c2.data_type = 'RGBA'
    c2.inputs["B"].default_value = srgb("#F4F6F8")
    nt.links.new(c1.outputs[2], c2.inputs["A"])
    nt.links.new(foam.outputs[0], c2.inputs["Factor"])
    nt.links.new(c2.outputs[2], p.inputs["Base Color"])
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.04
    rr.inputs["To Max"].default_value = 0.6
    nt.links.new(foam.outputs[0], rr.inputs["Value"])
    nt.links.new(rr.outputs[0], p.inputs["Roughness"])
    p.inputs["Specular IOR Level"].default_value = 0.8
    # gentle ripples
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9.0
    w = nt.nodes.new("ShaderNodeValue"); w.name = "Ripple"; w.outputs[0].default_value = 0.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(w.outputs[0], nz.inputs["W"]) if "W" in nz.inputs else None
    nz.noise_dimensions = '4D'
    nt.links.new(w.outputs[0], nz.inputs["W"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb("#A9C6D2")
    return m


def fabric_mat(name, color, scale=180.0):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb(color)
    p.inputs["Roughness"].default_value = 0.82
    p.inputs["Specular IOR Level"].default_value = 0.3
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type = 'BANDS'
    wv.inputs["Scale"].default_value = scale
    wv.inputs["Distortion"].default_value = 2.0
    wv.inputs["Detail"].default_value = 1.0
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb(color)
    return m


# ------------------------------------------------------------ tub + water
def build_tub(C, loc, name="Tub", scale=1.0):
    s = scale
    prof = [(0.0, 0.0), (0.2 * s, 0.0), (0.235 * s, 0.01 * s), (0.25 * s, 0.05 * s), (0.285 * s, 0.22 * s),
            (0.295 * s, 0.245 * s), (0.31 * s, 0.255 * s), (0.315 * s, 0.262 * s), (0.30 * s, 0.268 * s),
            (0.285 * s, 0.26 * s), (0.272 * s, 0.235 * s), (0.237 * s, 0.06 * s), (0.2 * s, 0.024 * s), (0.0, 0.024 * s)]
    t = lib.lathe(name, prof, 56, C)
    lib.smooth_by_angle(t, 50)
    lib.assign(t, bpy.data.materials.get("M_TubSteel") or steel_mat("M_TubSteel", "#4A4D52", 0.38, brushed=True))
    # handles
    hm = bpy.data.materials.get("M_TubSteel")
    for sx in (-1, 1):
        h = lib.torus(name + "_handle", 0.045 * s, 0.009 * s, (sx * 0.305 * s, 0, 0.215 * s), (math.radians(90), 0, 0), 24, 8, C,
                      arc=math.pi)
        h.rotation_euler = (math.radians(90), 0, math.radians(-90 if sx > 0 else 90))
        lib.assign(h, hm)
        h.parent = t
    t.location = loc
    # water disk
    w = lib.cylinder(name + "_water", 0.268 * s, 0.01, (0, 0, 0.2 * s), verts=48, collection=C)
    lib.assign(w, water_mat("M_" + name + "Water"))
    w.parent = t
    return t, w


# ------------------------------------------------------------ bottle
def build_bottle(C, loc):
    objs = append_ph("bleach_bottle", C)
    b = objs[0]
    b.name = "Detergent"
    b.scale = (1.2, 1.2, 1.2)
    bpy.context.view_layer.update()
    zs = [v.co.z for v in b.data.vertices]
    zmin, zmax = min(zs), max(zs)
    m = bpy.data.materials.new("M_Detergent")
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    h = zmax - zmin
    rel = math_node(nt, 'DIVIDE', math_node(nt, 'SUBTRACT', sep.outputs[2], zmin), h)
    band = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', rel, 0.30), math_node(nt, 'LESS_THAN', rel, 0.55))
    cap = math_node(nt, 'GREATER_THAN', rel, 0.86)
    c1 = nt.nodes.new("ShaderNodeMix"); c1.data_type = 'RGBA'
    c1.inputs["A"].default_value = srgb("#1F5FB8")
    c1.inputs["B"].default_value = srgb("#F7F7F4")
    nt.links.new(band, c1.inputs["Factor"])
    c2 = nt.nodes.new("ShaderNodeMix"); c2.data_type = 'RGBA'
    nt.links.new(c1.outputs[2], c2.inputs["A"])
    c2.inputs["B"].default_value = srgb("#D7262B")
    nt.links.new(cap, c2.inputs["Factor"])
    nt.links.new(c2.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 0.4
    m.diffuse_color = srgb("#1F5FB8")
    b.data.materials.clear(); b.data.materials.append(m)
    b.location = (loc[0], loc[1], loc[2] - zmin * 1.2)
    # pour spout empty (top)
    sp = bpy.data.objects.new("Detergent_spout", None)
    C.objects.link(sp)
    sp.parent = b
    tops = [v.co for v in b.data.vertices if v.co.z > zmax - 0.01]
    cx = sum(v.x for v in tops) / len(tops); cy = sum(v.y for v in tops) / len(tops)
    sp.location = (cx, cy, zmax)
    return b, sp


# ------------------------------------------------------------ undies
def build_undies(C):
    """Briefs: flat-ish cloth outline (XZ plane, facing -Y), solidified, bent. Origin at waistband centre."""
    bm = bmesh.new()
    # outline in (x, z); waistband top at z=0, crotch at z=-0.26
    nx, nz = 28, 22
    W = 0.38
    def inside(x, z):
        # z in [-0.26,0]; half width at height
        t = -z / 0.26
        if t < 0.38:
            hw = W / 2
        else:
            # leg opening: concave curve towards crotch half width 0.055
            u = (t - 0.38) / 0.62
            hw = 0.055 + (W / 2 - 0.055) * (1 - u) ** 1.6
        return abs(x) <= hw + 1e-6, hw
    grid = {}
    for j in range(nz + 1):
        z = -0.26 * j / nz
        _, hw = inside(0, z)
        for i in range(nx + 1):
            x = -hw + 2 * hw * i / nx
            # slight puff: front bulge
            y = -0.035 * math.sin(math.pi * i / nx) * math.sin(math.pi * min(1, (j + 2) / nz))
            grid[(i, j)] = bm.verts.new((x, y, z))
    uv_data = {}
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((grid[(i, j)], grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)]))
            f.material_index = 1 if j < 3 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_from_bmesh("Undies", bm, C)
    # make normals face -Y
    if o.data.polygons[len(o.data.polygons) // 2].normal.y > 0:
        for p in o.data.polygons:
            p.flip()
    sol = o.modifiers.new("Solidify", 'SOLIDIFY'); sol.thickness = 0.008; sol.offset = 0
    sub = o.modifiers.new("Sub", 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    # materials
    cot = bpy.data.materials.new("M_UndiesCotton")
    nt = cot.node_tree
    p = nt.nodes["Principled BSDF"]
    stain_v = nt.nodes.new("ShaderNodeValue"); stain_v.name = "Stain"; stain_v.outputs[0].default_value = 1.0
    wet_v = nt.nodes.new("ShaderNodeValue"); wet_v.name = "Wet"; wet_v.outputs[0].default_value = 0.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # stain shape: ellipse around (0,-0.15) distorted by noise
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    dx = math_node(nt, 'DIVIDE', sep.outputs[0], 0.11)
    dz = math_node(nt, 'DIVIDE', math_node(nt, 'ADD', sep.outputs[2], 0.155), 0.065)
    d = math_node(nt, 'SQRT', math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', dx, dx), math_node(nt, 'MULTIPLY', dz, dz)))
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 14.0; nz.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    dd = math_node(nt, 'ADD', d, math_node(nt, 'MULTIPLY', math_node(nt, 'SUBTRACT', nz.outputs["Fac"], 0.5), 0.6))
    blob = math_node(nt, 'LESS_THAN', dd, 1.0)
    st = math_node(nt, 'MULTIPLY', blob, stain_v.outputs[0])
    cm = nt.nodes.new("ShaderNodeMix"); cm.data_type = 'RGBA'
    cm.inputs["A"].default_value = srgb("#F4F2EC")
    cm.inputs["B"].default_value = srgb("#6B4423")
    nt.links.new(st, cm.inputs["Factor"])
    wm = nt.nodes.new("ShaderNodeMix"); wm.data_type = 'RGBA'; wm.blend_type = 'MULTIPLY'
    nt.links.new(cm.outputs[2], wm.inputs["A"])
    wm.inputs["B"].default_value = srgb("#B9B4AA")
    nt.links.new(wet_v.outputs[0], wm.inputs["Factor"])
    nt.links.new(wm.outputs[2], p.inputs["Base Color"])
    rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.8; rr.inputs["To Max"].default_value = 0.22
    nt.links.new(wet_v.outputs[0], rr.inputs["Value"])
    nt.links.new(rr.outputs[0], p.inputs["Roughness"])
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 260; wv.inputs["Distortion"].default_value = 1.5
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], p.inputs["Normal"])
    cot.diffuse_color = srgb("#F4F2EC")
    band = fabric_mat("M_UndiesBand", "#2F4FA8", scale=400)
    o.data.materials.append(cot)
    o.data.materials.append(band)
    return o


# ------------------------------------------------------------ clothes blobs
CLOTH_COLORS = ["#D62828", "#1D6FD1", "#F2C12E", "#7B2CBF", "#2BA84A", "#F07B1D", "#F2F2F2", "#1B2A49",
                "#E0479E", "#13A8A8", "#C1121F", "#3A86FF"]


def build_blob_library(C, n=10, seed=7):
    random.seed(seed)
    libc = lib.coll("BlobLib", C)
    mats = [fabric_mat(f"M_Cloth_{i}", c) for i, c in enumerate(CLOTH_COLORS)]
    meshes = []
    for k in range(n):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        sx, sy, sz = random.uniform(0.9, 1.25), random.uniform(0.65, 0.9), random.uniform(0.35, 0.55)
        ph = [random.uniform(0, 6.28) for _ in range(6)]
        for v in bm.verts:
            p = v.co.copy()
            r = 1.0 + 0.16 * math.sin(3 * p.x + ph[0]) * math.cos(2 * p.y + ph[1]) + 0.1 * math.sin(4 * p.z + ph[2]) \
                + 0.07 * math.sin(5 * p.x + 3 * p.y + ph[3])
            v.co = Vector((p.x * sx * r, p.y * sy * r, p.z * sz * r))
        me = bpy.data.meshes.new(f"BlobMesh_{k}")
        bm.to_mesh(me); bm.free()
        for pp in me.polygons:
            pp.use_smooth = True
        me.use_fake_user = True
        meshes.append(me)
    for m in mats:
        m.use_fake_user = True
    return meshes, mats


def make_blob(name, meshes, mats, C, size=0.13, idx=None, color=None, rng=random):
    me = meshes[idx if idx is not None else rng.randrange(len(meshes))]
    o = bpy.data.objects.new(name, me)
    C.objects.link(o)
    o.scale = (size, size, size)
    m = mats[color if color is not None else rng.randrange(len(mats))]
    o.material_slots  # ensure
    o.data.materials.clear() if False else None
    o.active_material = None
    # per-object material via object-linked slot
    if len(me.materials) == 0:
        me.materials.append(mats[0])
    o.material_slots[0].link = 'OBJECT'
    o.material_slots[0].material = m
    return o


# ------------------------------------------------------------ drum rig
def build_drum_rig(C):
    black = lib.mat("M_BlackMetal", "#17171A", rough=0.45, metal=0.3)
    drum_m = steel_mat("M_DrumSteel", "#8D9095", 0.26)
    root = bpy.data.objects.new("DrumRig", None); C.objects.link(root)
    root.location = DRUM_POS
    parts = {}
    base = lib.box("Stand_base", (0.8, 1.25, 0.05), (0, 0.28, 0.025), C, bevel=0.01); lib.assign(base, black)
    post = lib.box("Stand_post", (0.12, 0.12, AXLE_Z + 0.04), (0, 0.42, (AXLE_Z + 0.04) / 2), C, bevel=0.008); lib.assign(post, black)
    brace = lib.box("Stand_brace", (0.5, 0.08, 0.08), (0, 0.42, 0.09), C, bevel=0.006); lib.assign(brace, black)
    for o in (base, post, brace):
        o.parent = root
    # spinning group
    spin = bpy.data.objects.new("DrumSpin", None); C.objects.link(spin)
    spin.parent = root; spin.location = (0, 0, AXLE_Z)
    # drum shell: lathe around local Z then rotate so axis is Y; opening at -Y
    R, D = DRUM_R, DRUM_D
    prof = [(0.0, 0.0), (R - 0.03, 0.0), (R, 0.02), (R, D - 0.06), (R - 0.015, D - 0.02), (0.29, D - 0.0),
            (0.272, D + 0.005), (0.262, D - 0.01), (0.275, D - 0.035), (R - 0.025, D - 0.06), (R - 0.012, 0.03),
            (R - 0.04, 0.012), (0.0, 0.012)]
    shell = lib.lathe("Drum", prof, 64, C)
    lib.smooth_by_angle(shell, 50)
    lib.assign(shell, drum_m)
    # orient: lathe Z axis -> -Y (opening at -Y). Rotate +90 around X maps +Z to -Y
    shell.rotation_euler = (math.radians(90), 0, 0)
    shell.location = (0, D / 2, 0)
    shell.parent = spin
    lip = lib.torus("Drum_lip", 0.272, 0.018, (0, -D / 2 - 0.004, 0), (math.radians(90), 0, 0), 48, 12, C)
    lib.assign(lip, drum_m); lip.parent = spin
    # inner baffles (so rotation reads)
    for k in range(3):
        a = 2 * math.pi * k / 3
        bfl = lib.box(f"Drum_baffle{k}", (0.05, D - 0.1, 0.05), (0, 0, 0), C, bevel=0.015, segs=3)
        lib.assign(bfl, drum_m)
        bfl.parent = spin
        bfl.location = ((R - 0.045) * math.cos(a), 0.01, (R - 0.045) * math.sin(a))
        bfl.rotation_euler = (0, -a, 0)
    # axle, pulley, crank
    axle = lib.cylinder("Axle", 0.03, 0.42, (0, D / 2 + 0.18, 0), (math.radians(90), 0, 0), 20, C); lib.assign(axle, black)
    axle.parent = spin
    pulley = lib.cylinder("Pulley_big", 0.15, 0.035, (0, 0.56, 0), (math.radians(90), 0, 0), 40, C); lib.assign(pulley, black)
    pulley.parent = spin
    crank_arm = lib.box("Crank_arm", (0.035, 0.03, 0.24), (0, 0.62, 0.11), C, bevel=0.008); lib.assign(crank_arm, black)
    crank_arm.parent = spin
    handle_m = lib.mat("M_CrankHandle", "#8A1E1E", rough=0.4)
    crank_h = lib.cylinder("Crank_handle", 0.022, 0.13, (0, 0.69, 0.22), (math.radians(90), 0, 0), 16, C); lib.assign(crank_h, handle_m)
    crank_h.parent = spin
    grip = bpy.data.objects.new("Crank_grip", None); C.objects.link(grip); grip.parent = spin; grip.location = (0, 0.72, 0.22)
    parts.update(root=root, spin=spin, shell=shell, base=base, post=post, crank_grip=grip, crank_handle=crank_h,
                 crank_arm=crank_arm, pulley=pulley)
    # drum water (non spinning) - circular segment prism
    wat = build_drum_water(C)
    wat.parent = root; wat.location = (0, 0, AXLE_Z)
    parts["water"] = wat
    return parts


def build_drum_water(C, level=-0.07):
    bm = bmesh.new()
    R = DRUM_R - 0.02
    n = 40
    D = DRUM_D - 0.06
    # parametric: we build full disk slab and use a shape key? Simpler: keep fixed level mesh, animate scale Z later.
    pts = []
    a0 = math.acos(max(-1, min(1, level / R)))
    # angles measured from -Z (bottom): points with z <= level
    for i in range(n + 1):
        a = -math.pi / 2 - (math.pi / 2 - math.asin(level / R)) + (2 * (math.pi / 2 - math.asin(level / R))) * i / n
        pts.append((R * math.cos(a), R * math.sin(a)))
    front = [bm.verts.new((x, -D / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, D / 2, z)) for x, z in pts]
    for i in range(n):
        bm.faces.new((front[i], front[i + 1], back[i + 1], back[i]))
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    bm.faces.new((front[0], back[0], back[-1], front[-1]))  # top surface
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_from_bmesh("DrumWater", bm, C, smooth=False)
    lib.assign(o, water_mat("M_DrumWater"))
    return o


def build_motor(C, parts):
    green = lib.mat("M_MotorGreen", "#2E7D4F", rough=0.35, metal=0.3, coat=0.3)
    black = bpy.data.materials["M_BlackMetal"]
    mroot = bpy.data.objects.new("MotorRig", None); C.objects.link(mroot)
    mroot.parent = parts["root"]
    mroot.location = (0.0, 0.58, 0.05)
    blk = lib.box("Motor_block", (0.26, 0.24, 0.12), (0, 0.04, 0.06), C, bevel=0.01); lib.assign(blk, black); blk.parent = mroot
    body = lib.cylinder("Motor_body", 0.11, 0.24, (0, 0.06, 0.24), (math.radians(90), 0, 0), 40, C); lib.assign(body, green)
    body.parent = mroot
    for k in range(7):
        rib = lib.torus(f"Motor_rib{k}", 0.112, 0.008, (0, -0.045 + k * 0.03 + 0.06, 0.24), (math.radians(90), 0, 0), 40, 8, C)
        lib.assign(rib, green); rib.parent = mroot
    cap = lib.cylinder("Motor_cap", 0.085, 0.03, (0, 0.2, 0.24), (math.radians(90), 0, 0), 32, C); lib.assign(cap, black)
    cap.parent = mroot
    mp = lib.cylinder("Motor_pulley", 0.05, 0.035, (0, -0.02, 0.24), (math.radians(90), 0, 0), 24, C); lib.assign(mp, black)
    mp.parent = mroot
    # belt as curve between pulley centres (world-ish local to DrumRig)
    c1 = Vector((0, 0.56, AXLE_Z)); r1 = 0.155
    c2 = Vector((0, 0.56, 0.05 + 0.24)); r2 = 0.055
    cu = bpy.data.curves.new("Belt", 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    pts = []
    # belt loop path in XZ plane at y=0.56 (open-belt tangents)
    dz = c1.z - c2.z
    beta = math.asin((r1 - r2) / dz)
    for i in range(33):
        a = (-beta) + (math.pi + 2 * beta) * i / 32  # from right tangent over top to left
        pts.append((r1 * math.cos(a), c1.z + r1 * math.sin(a)))
    for i in range(17):
        a = math.pi + beta + (math.pi - 2 * beta) * i / 16
        pts.append((r2 * math.cos(a), c2.z + r2 * math.sin(a)))
    sp.points.add(len(pts) - 1)
    for i, (x, z) in enumerate(pts):
        sp.points[i].co = (x, 0.56, z, 1)
    sp.use_cyclic_u = True
    cu.bevel_depth = 0.012
    cu.bevel_resolution = 1
    belt = bpy.data.objects.new("Belt", cu); C.objects.link(belt)
    belt.data.materials.append(lib.mat("M_Rubber", "#101010", rough=0.7))
    belt.parent = parts["root"]
    parts.update(motor=mroot, belt=belt, motor_body=body)
    # bolts (for "bolting on" gag)
    bolts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            b = lib.cylinder("Motor_bolt", 0.012, 0.03, (sx * 0.1, 0.04 + sy * 0.09, 0.125), (0, 0, 0), 6, C)
            lib.assign(b, lib.mat("M_Bolt", "#B8B8B8", rough=0.3, metal=1.0)); b.parent = mroot
            bolts.append(b)
    parts["bolts"] = bolts
    return parts


def build_outer_tub(C, parts):
    gm = steel_mat("M_OuterTub", "#7C8087", 0.35, brushed=True)
    R, D = 0.43, 0.62
    prof = [(0.0, 0.0), (R - 0.02, 0.0), (R, 0.02), (R, D), (0.29, D), (0.285, D + 0.01), (0.27, D + 0.005),
            (0.275, D - 0.012), (R - 0.015, D - 0.012), (R - 0.015, 0.02), (0.0, 0.015)]
    ot = lib.lathe("OuterTub", prof, 64, C)
    # keep only the lower half (a trough that catches water; drum stays visible)
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(ot.data)
    kill = [f for f in bm.faces if f.calc_center_median().y > 0.06]
    _bm.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ot.data); bm.free()
    sol = ot.modifiers.new("Solid", 'SOLIDIFY'); sol.thickness = 0.012
    lib.smooth_by_angle(ot, 50)
    lib.assign(ot, gm)
    ot.rotation_euler = (math.radians(90), 0, 0)
    holder = bpy.data.objects.new("OuterTubRig", None); C.objects.link(holder)
    holder.parent = parts["root"]; holder.location = (0, 0, AXLE_Z)
    ot.parent = holder; ot.location = (0, D / 2 - 0.02, 0)
    # feet / cradle
    blk = bpy.data.materials["M_BlackMetal"]
    for sx in (-1, 1):
        leg = lib.box("OuterTub_leg", (0.06, 0.4, AXLE_Z - R + 0.04), (sx * 0.28, 0.0, -(AXLE_Z) + (AXLE_Z - R + 0.04) / 2 + 0.05), C, bevel=0.006)
        lib.assign(leg, blk); leg.parent = holder
    parts["outer"] = holder
    parts["outer_mesh"] = ot
    return parts


def hose_curve(name, pts, C, radius=0.025, mat=None, res=12):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.resolution_u = res
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); C.objects.link(o)
    if mat:
        o.data.materials.append(mat)
    return o


def build_pump(C, parts):
    red = lib.mat("M_PumpRed", "#C0262C", rough=0.35, metal=0.2, coat=0.4)
    grey = lib.mat("M_PumpGrey", "#9A9EA4", rough=0.3, metal=0.9)
    hose_m = lib.mat("M_Hose", "#1C1C1E", rough=0.55)
    pr = bpy.data.objects.new("PumpRig", None); C.objects.link(pr)
    pr.parent = parts["root"]; pr.location = (0.62, -0.25, 0.0)
    housing = lib.cylinder("Pump_housing", 0.1, 0.1, (0, 0, 0.13), (0, math.radians(90), 0), 40, C); lib.assign(housing, red)
    housing.parent = pr
    mot = lib.cylinder("Pump_motor", 0.07, 0.14, (0.12, 0, 0.13), (0, math.radians(90), 0), 32, C); lib.assign(mot, grey)
    mot.parent = pr
    foot = lib.box("Pump_foot", (0.24, 0.16, 0.03), (0.04, 0, 0.015), C, bevel=0.005); lib.assign(foot, bpy.data.materials["M_BlackMetal"])
    foot.parent = pr
    fan = lib.box("Pump_fan", (0.012, 0.15, 0.02), (-0.052, 0, 0.13), C); lib.assign(fan, grey); fan.parent = pr
    fan2 = lib.box("Pump_fan2", (0.012, 0.02, 0.15), (-0.052, 0, 0.13), C); lib.assign(fan2, grey); fan2.parent = pr
    # hoses in DrumRig local coords
    h1 = hose_curve("Hose_drain", [(0, -0.05, AXLE_Z - 0.43), (0.15, -0.2, 0.2), (0.5, -0.3, 0.13), (0.57, -0.25, 0.13)], C, 0.024, hose_m)
    h1.parent = parts["root"]
    h2 = hose_curve("Hose_out", [(0.7, -0.25, 0.13), (0.9, -0.4, 0.05), (1.15, -0.75, 0.03), (1.3, -1.05, 0.03)], C, 0.024, hose_m)
    h2.parent = parts["root"]
    grate = lib.cylinder("Drain_grate", 0.09, 0.006, (1.32, -1.1, 0.003), (0, 0, 0), 24, C)
    lib.assign(grate, lib.mat("M_Grate", "#3A3A3A", rough=0.4, metal=0.8)); grate.parent = parts["root"]
    # inlet hose from above to front of drum
    h3 = hose_curve("Hose_in", [(0.0, 0.1, 2.4), (0.0, -0.05, 1.6), (0.0, -0.45, 1.42), (0.0, -0.5, 1.22)], C, 0.022, hose_m)
    h3.parent = parts["root"]
    nozzle = lib.cylinder("Hose_nozzle", 0.03, 0.06, (0.0, -0.5, 1.19), (0, 0, 0), 16, C)
    lib.assign(nozzle, lib.mat("M_Brass", "#B08D57", rough=0.3, metal=1.0)); nozzle.parent = parts["root"]
    parts.update(pump=pr, hose_drain=h1, hose_out=h2, hose_in=h3, nozzle=nozzle, grate=grate, pump_fan=(fan, fan2))
    return parts


def build_cabinet(C, parts):
    white = lib.mat("M_CabinetWhite", "#F2F2EF", rough=0.3, coat=0.5)
    chrome = lib.mat("M_Chrome", "#E6E8EA", rough=0.12, metal=1.0)
    glass = lib.mat("M_DoorGlass", "#3A4A55", rough=0.05, alpha=0.35, spec=1.0)
    lcd = lib.mat("M_LCD", "#59C3F0", rough=0.2, emit="#6CCFF6", emit_strength=3.0)
    cab = bpy.data.objects.new("CabinetRig", None); C.objects.link(cab)
    cab.parent = parts["root"]; cab.location = (0, 0.22, 0)
    W, Dp, H = 1.04, 1.38, 1.44
    # body: box with front opening via boolean-free construction: 4 slabs around a hole
    fy = -Dp / 2  # front face y (local)
    th = 0.03
    side_l = lib.box("Cab_side", (th, Dp, H), (-W / 2 + th / 2, 0, H / 2), C, bevel=0.008)
    side_r = lib.box("Cab_side", (th, Dp, H), (W / 2 - th / 2, 0, H / 2), C, bevel=0.008)
    top = lib.box("Cab_top", (W, Dp, th), (0, 0, H - th / 2), C, bevel=0.01)
    back = lib.box("Cab_back", (W, th, H), (0, Dp / 2 - th / 2, H / 2), C)
    kick = lib.box("Cab_kick", (W - 0.02, 0.02, 0.08), (0, fy + 0.03, 0.04), C)
    lib.assign(kick, bpy.data.materials["M_BlackMetal"])
    for o in (side_l, side_r, top, back):
        lib.assign(o, white); o.parent = cab
    kick.parent = cab
    # front panel with round hole (lathe ring + corner fill using a grid of quads)
    hole_r = 0.33
    cz = AXLE_Z
    bm = bmesh.new()
    n = 64
    rect = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), 0, math.sin(a)))
        # intersect ray with rectangle [-W/2,W/2]x[0,H] centred at (0,cz)
        tx = (W / 2) / abs(d.x) if abs(d.x) > 1e-6 else 1e9
        tz = ((H - 0.2 - cz) if d.z > 0 else cz) / abs(d.z) if abs(d.z) > 1e-6 else 1e9
        t = min(tx, tz)
        outer = bm.verts.new((d.x * t, fy, cz + d.z * t))
        inner = bm.verts.new((d.x * hole_r, fy, cz + d.z * hole_r))
        rect.append((inner, outer))
    for i in range(n):
        a, b = rect[i], rect[(i + 1) % n]
        bm.faces.new((a[0], b[0], b[1], a[1]))
    # hole tunnel
    tun = []
    for i in range(n):
        a = 2 * math.pi * i / n
        tun.append(bm.verts.new((math.cos(a) * hole_r, fy + 0.06, cz + math.sin(a) * hole_r)))
    for i in range(n):
        bm.faces.new((rect[i][0], tun[i], tun[(i + 1) % n], rect[(i + 1) % n][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    front = lib.mesh_from_bmesh("Cab_front", bm, C, smooth=False)
    lib.assign(front, white); front.parent = cab
    panel = lib.box("Cab_panel", (W - 0.04, 0.04, 0.2), (0, fy - 0.0, H - 0.1 - th), C, bevel=0.01)
    lib.assign(panel, lib.mat("M_PanelWhite", "#E9EAE6", rough=0.35)); panel.parent = cab
    disp = lib.box("Cab_lcd", (0.2, 0.012, 0.07), (0.05, fy - 0.022, H - 0.13), C); lib.assign(disp, lcd); disp.parent = cab
    for k, x in enumerate((0.27, 0.34, 0.41)):
        kb = lib.cylinder("Cab_btn", 0.022, 0.03, (x, fy - 0.03, H - 0.13), (math.radians(90), 0, 0), 20, C)
        lib.assign(kb, lib.mat("M_Btn", "#3C3F45", rough=0.4)); kb.parent = cab
    knob = lib.cylinder("Cab_knob", 0.055, 0.04, (-0.3, fy - 0.03, H - 0.12), (math.radians(90), 0, 0), 32, C)
    lib.assign(knob, chrome); knob.parent = cab
    # door
    door = bpy.data.objects.new("Cab_doorRig", None); C.objects.link(door); door.parent = cab
    door.location = (-hole_r - 0.06, fy - 0.03, cz)
    ring = lib.torus("Cab_doorRing", hole_r + 0.01, 0.045, (hole_r + 0.06, 0, 0), (math.radians(90), 0, 0), 64, 16, C)
    lib.assign(ring, chrome); ring.parent = door
    gl = lib.cylinder("Cab_doorGlass", hole_r - 0.01, 0.02, (hole_r + 0.06, -0.01, 0), (math.radians(90), 0, 0), 48, C)
    lib.assign(gl, glass); gl.parent = door
    hinge = lib.box("Cab_hinge", (0.05, 0.05, 0.12), (0.0, 0.02, 0.15), C, bevel=0.005); lib.assign(hinge, chrome); hinge.parent = door
    hinge2 = lib.box("Cab_hinge", (0.05, 0.05, 0.12), (0.0, 0.02, -0.15), C, bevel=0.005); lib.assign(hinge2, chrome); hinge2.parent = door
    parts.update(cabinet=cab, door=door)
    return parts


def arrow(C, name, R=0.52, a0=35, a1=300, ccw=False, y=-0.33):
    """Yellow curved arrow in XZ plane around drum front (DrumRig local)."""
    ym = lib.mat("M_Arrow", "#F2D16B", rough=0.4, emit="#F2D16B", emit_strength=0.6)
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    n = 40
    sp.points.add(n - 1)
    angs = [math.radians(a0 + (a1 - a0) * i / (n - 1)) for i in range(n)]
    if ccw:
        angs = angs[::-1]
    for i, a in enumerate(angs):
        sp.points[i].co = (R * math.cos(a), y, AXLE_Z + R * math.sin(a), 1)
    cu.bevel_depth = 0.028
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); C.objects.link(o)
    o.data.materials.append(ym)
    # head: cone at end pointing along tangent
    a_end = angs[-1]
    direction = 1 if not ccw else -1
    tang = Vector((-math.sin(a_end), 0, math.cos(a_end))) * direction
    # since angs reversed for ccw, travel direction = decreasing angle
    if ccw:
        tang = Vector((math.sin(a_end), 0, -math.cos(a_end)))
    else:
        tang = Vector((-math.sin(a_end), 0, math.cos(a_end)))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.075, radius2=0.0, depth=0.15)
    head = lib.mesh_from_bmesh(name + "_head", bm, C)
    head.data.materials.append(ym)
    head.location = Vector((R * math.cos(a_end), y, AXLE_Z + R * math.sin(a_end))) + tang * 0.06
    head.rotation_euler = tang.to_track_quat('Z', 'Y').to_euler()
    head.parent = o
    return o
