"""Props: binoculars, water balloons, bucket frame, dunk tank (seat, lever, target), baseballs, puddles."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler
from setbuild import coll, link, srgb, pmat, img, box, cyl, wood_mat, TEX

# world placement of the two action spots
SPOT_A = (-4.4, 2.6)          # friend's first spot (in front of the shed)
TANK_POS = (0.9, 3.0)         # dunk tank
TANK_YAW = -31.0              # front of the tank faces the bush
BUSH = (-3.3, -3.6)


def empty(name, loc=(0, 0, 0), parent=None, c=None, size=0.1):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    (c or bpy.context.scene.collection).objects.link(e)
    if parent:
        e.parent = parent
    return e


def parent_keep(ob, parent):
    """Parent ob to parent, where both are currently expressed in the same (root-local) frame
    and parent has no parent yet."""
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_basis.inverted()


def water_fx_mat():
    """juicy cartoon water for drops / splashes; alpha also follows object color alpha"""
    m = bpy.data.materials.get("WaterFX")
    if m:
        return m
    m = bpy.data.materials.new("WaterFX")
    m.use_nodes = True
    m.surface_render_method = 'BLENDED'
    m.use_transparent_shadow = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb("#9fd6ff")
    b.inputs["Roughness"].default_value = 0.03
    b.inputs["Specular IOR Level"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.33
    b.inputs["Transmission Weight"].default_value = 0.35
    b.inputs["Emission Color"].default_value = srgb("#bfe6ff")
    b.inputs["Emission Strength"].default_value = 0.25
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = 'ADD'
    add.inputs[1].default_value = 0.55
    nt.links.new(lw.outputs["Facing"], add.inputs[0])
    clamp = nt.nodes.new("ShaderNodeClamp")
    nt.links.new(add.outputs[0], clamp.inputs[0])
    nt.links.new(clamp.outputs[0], mul.inputs[0])
    nt.links.new(oi.outputs["Alpha"], mul.inputs[1])
    nt.links.new(mul.outputs[0], b.inputs["Alpha"])
    return m


def tank_water_mat():
    m = bpy.data.materials.get("TankWater")
    if m:
        return m
    m = bpy.data.materials.new("TankWater")
    m.use_nodes = True
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb("#1f78d6")
    b.inputs["Roughness"].default_value = 0.04
    b.inputs["Specular IOR Level"].default_value = 0.9
    b.inputs["Alpha"].default_value = 0.62
    b.inputs["Emission Color"].default_value = srgb("#2f8fe8")
    b.inputs["Emission Strength"].default_value = 0.35
    return m


def acrylic_mat():
    m = bpy.data.materials.get("Acrylic")
    if m:
        return m
    m = bpy.data.materials.new("Acrylic")
    m.use_nodes = True
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.92, 0.97, 1.0, 1)
    b.inputs["Roughness"].default_value = 0.02
    b.inputs["Specular IOR Level"].default_value = 1.0
    b.inputs["Alpha"].default_value = 0.05
    return m


# ------------------------------------------------------------------ props
def build_binoculars(c):
    black = pmat("BinoBlack", srgb("#141516"), rough=0.45)
    lens = pmat("BinoLens", srgb("#6d9ccc"), rough=0.05, spec=1.0)
    root = empty("Binoculars", (0, 0, 0), c=c, size=0.05)
    parts = []
    for sx in (-0.038, 0.038):
        parts.append(cyl("BinoTube", 0.034, 0.11, (sx, -0.07, 0), black, c, rot=(math.pi / 2, 0, 0)))
        parts.append(cyl("BinoEye", 0.022, 0.04, (sx, -0.005, 0), black, c, rot=(math.pi / 2, 0, 0)))
        parts.append(cyl("BinoLens", 0.03, 0.004, (sx, -0.127, 0), lens, c, rot=(math.pi / 2, 0, 0)))
    parts.append(box("BinoBridge", (0.05, 0.05, 0.03), (0, -0.06, 0.0), black, c, bevel=0.008))
    for p in parts:
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (0, 0, -20)
    return root


def build_balloons(c):
    cols = {"Red": "#e8202a", "Blue": "#1f6fe0", "Yellow": "#ffd21f", "Green": "#2ec44a", "Pink": "#ff4fb3",
            "Orange": "#ff8a1c"}
    out = []
    for i, (n, h) in enumerate(cols.items()):
        m = bpy.data.materials.new(f"Balloon{n}")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = srgb(h)
        b.inputs["Roughness"].default_value = 0.12
        b.inputs["Coat Weight"].default_value = 0.6
        b.inputs["Subsurface Weight"].default_value = 0.3
        b.inputs["Subsurface Radius"].default_value = (0.05, 0.05, 0.05)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=16, location=(i * 0.3, -30, 0))
        bl = bpy.context.active_object
        bl.name = f"Balloon{n}"
        bl.scale = (0.085, 0.085, 0.105)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        # pinch a teardrop at the bottom
        for v in bl.data.vertices:
            if v.co.z < -0.06:
                v.co.x *= 0.75 + (v.co.z + 0.105) * 5
                v.co.y *= 0.75 + (v.co.z + 0.105) * 5
        bpy.ops.object.shade_smooth()
        bl.data.materials.append(m)
        knot = cyl(f"BalloonKnot{n}", 0.012, 0.02, (i * 0.3, -30, -0.112), m, c, verts=10, r2=0.006)
        link(bl, c)
        parent_keep(knot, bl)
        out.append(bl)
    return out


def build_bucket_rig(c):
    """A-frame with crossbar, hanging metal bucket with water, pull string."""
    pine = wood_mat("Pine", "#ddc39b", scale=(1, 1, 14))
    rope = pmat("Rope", srgb("#cdb48a"), rough=0.9)
    metal = pmat("Galvanized", srgb("#b9bfc4"), rough=0.32, metal=1.0)
    water = tank_water_mat()
    root = empty("BucketRig", (0, 0, 0), c=c, size=0.3)
    parts = []
    H = 2.55
    span = 2.1
    for sx in (-span / 2, span / 2):
        for sy in (-0.45, 0.45):
            ang = math.atan2(0.45, H) * (-1 if sy < 0 else 1)
            leg = box("BucketLeg", (0.07, 0.07, H / math.cos(ang) + 0.05), (sx, sy / 2, H / 2), pine, c,
                      rot=(ang, 0, 0), bevel=0.006)
            parts.append(leg)
        parts.append(box("BucketBrace", (0.06, 0.6, 0.06), (sx, 0, 0.7), pine, c, bevel=0.005))
    bar = box("BucketBar", (span + 0.25, 0.08, 0.08), (0, 0, H), pine, c, bevel=0.006)
    parts.append(bar)
    # bucket hangs below the bar on a short rope; pivot at the bar
    pivot = empty("BucketPivot", (0, 0, H - 0.04), c=c, size=0.1)
    hang = cyl("BucketRope", 0.008, 0.16, (0, 0, H - 0.12), rope, c, verts=8)
    bpy.ops.mesh.primitive_cone_add(radius1=0.13, radius2=0.17, depth=0.30, vertices=28,
                                    location=(0, 0, H - 0.40), end_fill_type='NOTHING')
    bucket = bpy.context.active_object
    bucket.name = "Bucket"
    bm = bmesh.new()
    bm.from_mesh(bucket.data)
    bmesh.ops.contextual_create(bm, geom=[v for v in bm.verts if v.co.z < 0])
    bm.to_mesh(bucket.data)
    sol = bucket.modifiers.new("thick", 'SOLIDIFY')
    sol.thickness = 0.006
    bucket.data.materials.append(metal)
    bpy.ops.object.shade_smooth()
    link(bucket, c)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.005, location=(0, 0, H - 0.25),
                                     rotation=(0, math.pi / 2, 0))
    handle = bpy.context.active_object
    handle.name = "BucketHandle"
    handle.data.materials.append(metal)
    link(handle, c)
    wsurf = cyl("BucketWater", 0.158, 0.012, (0, 0, H - 0.31), water, c, verts=28)
    for p in (hang, bucket):
        parent_keep(p, pivot)
    for p in (handle, wsurf):
        p.parent = bucket
        p.matrix_parent_inverse = bucket.matrix_basis.inverted()
    parts += [pivot]
    for p in parts:
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (SPOT_A[0], SPOT_A[1], 0)
    return root


def build_tank(c):
    pine = wood_mat("Pine", "#ddc39b", scale=(1, 1, 14))
    seatwood = wood_mat("SeatWood", "#c79a63", scale=(14, 1, 1))
    metal = pmat("TankMetal", srgb("#8e959c"), rough=0.35, metal=1.0)
    red = pmat("LeverRed", srgb("#d8231f"), rough=0.3)
    blackgrip = pmat("Grip", srgb("#151515"), rough=0.5)
    strapm = pmat("Strap", srgb("#d02020"), rough=0.6)
    acr = acrylic_mat()
    water = tank_water_mat()
    root = empty("DunkTank", (0, 0, 0), c=c, size=0.4)
    W, Dp, H = 1.8, 1.3, 1.35
    P = []
    # base + posts + rails (local coordinates)
    P.append(box("TankBase", (W + 0.1, Dp + 0.1, 0.12), (0, 0, 0.06), pine, c, bevel=0.01))
    for sx in (-W / 2, W / 2):
        for sy in (-Dp / 2, Dp / 2):
            P.append(box("TankPost", (0.1, 0.1, H), (sx, sy, H / 2 + 0.06), pine, c, bevel=0.008))
    for sy in (-Dp / 2, Dp / 2):
        P.append(box("TankRailX", (W + 0.1, 0.1, 0.1), (0, sy, H + 0.06), pine, c, bevel=0.008))
    for sx in (-W / 2, W / 2):
        P.append(box("TankRailY", (0.1, Dp + 0.1, 0.1), (sx, 0, H + 0.06), pine, c, bevel=0.008))
    # acrylic walls (front/left/right) and wooden back
    P.append(box("AcrylicFront", (W - 0.1, 0.02, H - 0.06), (0, -Dp / 2, H / 2 + 0.1), acr, c))
    P.append(box("AcrylicL", (0.02, Dp - 0.1, H - 0.06), (-W / 2, 0, H / 2 + 0.1), acr, c))
    P.append(box("AcrylicR", (0.02, Dp - 0.1, H - 0.06), (W / 2, 0, H / 2 + 0.1), acr, c))
    P.append(box("TankBack", (W - 0.1, 0.04, H - 0.06), (0, Dp / 2, H / 2 + 0.1), pine, c))
    # water body + surface
    wl = 1.10
    P.append(box("TankWaterBody", (W - 0.14, Dp - 0.14, wl - 0.12), (0, 0, 0.12 + (wl - 0.12) / 2), water, c))
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=36, size=1, location=(0, 0, wl + 0.002))
    ws = bpy.context.active_object
    ws.name = "TankWaterSurface"
    ws.scale = (W - 0.14, Dp - 0.14, 1)
    bpy.ops.object.transform_apply(scale=True)
    ws.data.materials.append(water)
    link(ws, c)
    P.append(ws)
    # back frame (cage posts + backrest) rising above the tank
    for sx in (-0.55, 0.55):
        P.append(box("CagePost", (0.09, 0.09, 1.25), (sx, Dp / 2 - 0.02, H + 0.62), pine, c, bevel=0.006))
    P.append(box("CageTop", (1.3, 0.09, 0.09), (0, Dp / 2 - 0.02, H + 1.25), pine, c, bevel=0.006))
    P.append(box("Backrest", (1.05, 0.04, 0.32), (0, Dp / 2 - 0.05, H + 0.55), seatwood, c, bevel=0.006))
    # sign
    sign = pmat("Sign", srgb("#ffd21f"), rough=0.5)
    P.append(box("DunkSign", (0.9, 0.02, 0.22), (0, Dp / 2 - 0.08, H + 1.05), sign, c))
    # seat on a hinge at the back (pivot rotates about local X)
    seat_z = 1.56
    pivot = empty("SeatPivot", (0, 0.38, seat_z), c=c, size=0.15)
    seat = box("Seat", (1.0, 0.42, 0.05), (0, 0.17, seat_z), seatwood, c, bevel=0.006)
    for sx in (-0.52, 0.52):
        P.append(box("SeatBracket", (0.05, 0.1, 0.25), (sx, 0.38, seat_z - 0.1), metal, c))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.025, location=(0, 0.2, seat_z + 0.22))
    strap = bpy.context.active_object
    strap.name = "SeatStrap"
    strap.scale = (1.15, 0.8, 1.6)
    strap.data.materials.append(strapm)
    link(strap, c)
    for p in (seat, strap):
        parent_keep(p, pivot)
    P.append(pivot)
    # lever on the left-front corner (pivot rotates about local X)
    lb = box("LeverBase", (0.16, 0.22, 0.12), (-W / 2 - 0.22, -Dp / 2 + 0.25, 0.06), metal, c, bevel=0.01)
    P.append(lb)
    lpiv = empty("LeverPivot", (-W / 2 - 0.22, -Dp / 2 + 0.25, 0.12), c=c, size=0.1)
    larm = cyl("LeverArm", 0.022, 1.05, (-W / 2 - 0.22, -Dp / 2 + 0.25, 0.12 + 0.52), red, c, verts=16)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(-W / 2 - 0.22, -Dp / 2 + 0.25, 0.12 + 1.06))
    lgrip = bpy.context.active_object
    lgrip.name = "LeverGrip"
    lgrip.data.materials.append(blackgrip)
    link(lgrip, c)
    bpy.ops.object.shade_smooth()
    for p in (larm, lgrip):
        parent_keep(p, lpiv)
    P.append(lpiv)
    rod = cyl("LeverRod", 0.01, 1.2, (-W / 2 - 0.12, 0.0, 0.5), metal, c, rot=(math.radians(60), 0, 0), verts=8)
    P.append(rod)
    # target arm on the right side, bullseye facing front (-Y)
    arm_len = 1.35
    P.append(cyl("TargetArm", 0.03, arm_len, (W / 2 + arm_len / 2, -Dp / 2 + 0.2, 1.62), metal, c,
                 rot=(0, math.pi / 2, 0), verts=12))
    P.append(cyl("TargetPost", 0.03, 1.62, (W / 2 + arm_len, -Dp / 2 + 0.2, 0.81), metal, c, verts=12))
    P.append(cyl("TargetFoot", 0.18, 0.05, (W / 2 + arm_len, -Dp / 2 + 0.2, 0.025), metal, c, verts=20))
    tpiv = empty("TargetPivot", (W / 2 + arm_len, -Dp / 2 + 0.12, 1.62), c=c, size=0.1)
    bull = pmat("Bullseye", srgb("#ffffff"), rough=0.4)
    nt = bull.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("bullseye", f"{TEX}/bullseye.png")
    nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    bpy.ops.mesh.primitive_cylinder_add(radius=0.27, depth=0.035, vertices=48,
                                        location=(W / 2 + arm_len, -Dp / 2 + 0.12, 1.62 - 0.30),
                                        rotation=(math.pi / 2, 0, 0))
    disc = bpy.context.active_object
    disc.name = "Bullseye"
    # planar UVs facing -Y for the bullseye texture
    bm = bmesh.new()
    bm.from_mesh(disc.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.x / 0.54 + 0.5, co.y / 0.54 + 0.5)
    bm.to_mesh(disc.data)
    disc.data.materials.append(bull)
    link(disc, c)
    hang = cyl("TargetHanger", 0.012, 0.05, (W / 2 + arm_len, -Dp / 2 + 0.12, 1.62 - 0.025), metal, c, verts=8)
    for p in (disc, hang):
        parent_keep(p, tpiv)
    P.append(tpiv)
    # parent everything to root (local coords -> world via root transform)
    for p in P:
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (TANK_POS[0], TANK_POS[1], 0)
    root.rotation_euler = (0, 0, math.radians(TANK_YAW))
    return root


def build_baseballs(c):
    m = bpy.data.materials.new("Baseball")
    m.use_nodes = True
    nt = m.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("baseball", f"{TEX}/baseball.png")
    nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    nt.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
    out = []
    for i in range(5):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.037, segments=32, ring_count=16, location=(i * 0.2, -32, 0))
        b = bpy.context.active_object
        b.name = f"Baseball{i}"
        b.data.materials.append(m)
        bpy.ops.object.shade_smooth()
        link(b, c)
        out.append(b)
    return out


def build_fx_protos(c):
    """drop prototype, splash sheet prototype, puddles, wet splat decal"""
    wm = water_fx_mat()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=12, ring_count=8, location=(0, -34, 0))
    d = bpy.context.active_object
    d.name = "DropProto"
    for v in d.data.vertices:          # teardrop: pointy top
        if v.co.z > 0:
            v.co.x *= 1 - v.co.z * 0.55
            v.co.y *= 1 - v.co.z * 0.55
            v.co.z *= 1.5
    d.data.materials.append(wm)
    d.visible_shadow = False
    bpy.ops.object.shade_smooth()
    link(d, c)
    # splash crown: open tube with jagged rim
    bm = bmesh.new()
    seg = 36
    rings = []
    for j, (r_, z_) in enumerate([(0.55, 0.0), (0.75, 0.25), (1.0, 0.6), (1.15, 1.0)]):
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            jag = 1.0 if j < 3 else (1.0 + 0.35 * ((k * 7919) % 5) / 4.0)
            ring.append(bm.verts.new((r_ * math.cos(a), r_ * math.sin(a), z_ * jag)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[j][k], rings[j][(k + 1) % seg], rings[j + 1][(k + 1) % seg], rings[j + 1][k]))
    me = bpy.data.meshes.new("CrownProto")
    bm.to_mesh(me)
    cr = bpy.data.objects.new("CrownProto", me)
    c.objects.link(cr)
    me.materials.append(wm)
    for p in me.polygons:
        p.use_smooth = True
    cr.location = (0, -36, 0)
    cr.visible_shadow = False
    # puddle material (dark glossy water film on asphalt)
    pm = bpy.data.materials.new("Puddle")
    pm.use_nodes = True
    pm.surface_render_method = 'BLENDED'
    b = pm.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb("#2a3138")
    b.inputs["Roughness"].default_value = 0.04
    b.inputs["Specular IOR Level"].default_value = 1.0
    b.inputs["Alpha"].default_value = 0.75
    rng = random.Random(4)
    for i in range(4):
        bm = bmesh.new()
        n = 40
        cen = bm.verts.new((0, 0, 0))
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            rr = 1.0 + 0.18 * math.sin(3 * a + i) + 0.1 * math.sin(7 * a + 2 * i) + rng.uniform(-0.04, 0.04)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0)))
        for k in range(n):
            bm.faces.new((cen, ring[k], ring[(k + 1) % n]))
        me = bpy.data.meshes.new(f"Puddle{i}")
        bm.to_mesh(me)
        me.materials.append(pm)
        pu = bpy.data.objects.new(f"Puddle{i}", me)
        c.objects.link(pu)
        pu.location = (i * 3, -40, 0.004)
        pu.visible_shadow = False
    # wet splat decal (on the shed wall)
    sm = bpy.data.materials.new("WetSplat")
    sm.use_nodes = True
    sm.surface_render_method = 'BLENDED'
    nt = sm.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb("#3b5161")
    b.inputs["Roughness"].default_value = 0.06
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("splat", f"{TEX}/splat.png", "Non-Color")
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    nt.links.new(t.outputs["Color"], mul.inputs[0])
    nt.links.new(oi.outputs["Alpha"], mul.inputs[1])
    nt.links.new(mul.outputs[0], b.inputs["Alpha"])
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -42, 0))
    sp = bpy.context.active_object
    sp.name = "WetSplat"
    sp.data.materials.append(sm)
    sp.visible_shadow = False
    link(sp, c)
    # sweat drop
    sw = bpy.data.objects.new("SweatProto", d.data)
    c.objects.link(sw)
    sw.location = (2, -34, 0)


def build_all():
    c = coll("PROPS")
    build_binoculars(c)
    build_balloons(c)
    build_bucket_rig(c)
    build_tank(c)
    build_baseballs(c)
    build_fx_protos(c)
    for m in bpy.data.materials:
        low = m.name.lower()
        if not any(k in low for k in ("water", "acrylic", "splash", "puddle", "splat", "leaf", "short0",
                                      "eyebrow", "eyelash", "steam")):
            try:
                m.use_transparent_shadow = False
            except Exception:
                pass
    for ob in bpy.data.objects:
        if ob.data is not None and hasattr(ob.data, "materials"):
            for mm in ob.data.materials:
                if mm and mm.name in ("TankWater", "Acrylic", "WaterFX", "Puddle", "WetSplat"):
                    ob.visible_shadow = False
    return c
