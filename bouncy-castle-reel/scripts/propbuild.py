"""Props for the bouncy castle reel: binoculars, air mattress, foot pump, big blower + hose,
inflatable bouncy castle (walls + towers), phone, and the water/FX prototypes reused for puffs."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler
from setbuild import coll, link, srgb, pmat, img, box, cyl, wood_mat, TEX

CASTLE_POS = (0.6, 3.4)       # centre of the mattress / castle floor on the court
CASTLE_YAW = -25.0            # front (-Y local) faces the bush
BUSH = (-3.3, -3.6)
FLOOR = (3.6, 3.0, 0.5)       # full-size mattress / castle floor (x, y, z)


def empty(name, loc=(0, 0, 0), parent=None, c=None, size=0.1):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    (c or bpy.context.scene.collection).objects.link(e)
    if parent:
        e.parent = parent
    return e


def parent_keep(ob, parent):
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_basis.inverted()


def vinyl(name, hexcol, rough=0.26):
    """shiny, squishy inflatable vinyl"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(hexcol)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = 0.6
    b.inputs["Coat Weight"].default_value = 0.55
    b.inputs["Coat Roughness"].default_value = 0.12
    # subtle seams / wrinkles
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6.0
    nz.inputs["Detail"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def rounded_box(name, size, loc, mat, c, bevel=0.12, segs=4, subdiv=2):
    ob = box(name, size, loc, mat, c)
    bv = ob.modifiers.new("round", 'BEVEL')
    bv.width = min(bevel, min(size) * 0.49)
    bv.segments = segs
    bv.limit_method = 'NONE'
    sd = ob.modifiers.new("smooth", 'SUBSURF')
    sd.levels = 1
    sd.render_levels = subdiv
    bpy.ops.object.shade_smooth()
    return ob


def tube(name, length, radius, loc, mat, c, axis='X', verts=24):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, location=loc, rotation=rot, vertices=verts)
    ob = bpy.context.active_object
    ob.name = name
    bv = ob.modifiers.new("round", 'BEVEL')
    bv.width = radius * 0.6
    bv.segments = 4
    sd = ob.modifiers.new("smooth", 'SUBSURF')
    sd.levels = 1
    sd.render_levels = 2
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(mat)
    link(ob, c)
    return ob


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


def build_mattress(c):
    """Blue quilted air mattress. Mesh is full castle-floor size; object scale makes it small."""
    m = vinyl("MattressBlue", "#2f7fe0", rough=0.22)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    # quilted channels along the length
    tc = next(n for n in nt.nodes if n.type == 'TEX_COORD')
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs["Scale"].default_value = 1.2
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    bump2 = nt.nodes.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.35
    nt.links.new(wave.outputs["Fac"], bump2.inputs["Height"])
    old = next(n for n in nt.nodes if n.type == 'BUMP' and n != bump2)
    nt.links.new(old.outputs["Normal"], bump2.inputs["Normal"])
    nt.links.new(bump2.outputs["Normal"], b.inputs["Normal"])
    root = empty("MattressRoot", (0, 0, 0), c=c, size=0.3)
    mat_ob = rounded_box("Mattress", FLOOR, (0, 0, FLOOR[2] / 2), m, c, bevel=0.22, segs=5)
    mat_ob.parent = root
    mat_ob.matrix_parent_inverse = Matrix()
    # valve
    valve = cyl("MattressValve", 0.035, 0.05, (FLOOR[0] / 2 + 0.01, -FLOOR[1] / 2 + 0.35, FLOOR[2] * 0.6),
                pmat("Valve", srgb("#e8e8e8"), rough=0.4), c, rot=(0, math.pi / 2, 0), verts=16)
    valve.parent = root
    valve.matrix_parent_inverse = Matrix()
    root.location = (CASTLE_POS[0], CASTLE_POS[1], 0)
    root.rotation_euler = (0, 0, math.radians(CASTLE_YAW))
    return root


def build_foot_pump(c):
    grey = pmat("PumpGrey", srgb("#6d7278"), rough=0.5)
    blk = pmat("PumpBlack", srgb("#1a1a1a"), rough=0.6)
    root = empty("FootPump", (0, 0, 0), c=c, size=0.15)
    base = rounded_box("PumpBase", (0.24, 0.32, 0.04), (0, 0, 0.02), blk, c, bevel=0.03, subdiv=1)
    bell = empty("PumpBellowsPivot", (0, 0.04, 0.04), c=c, size=0.05)
    bel = cyl("PumpBellows", 0.09, 0.12, (0, 0.04, 0.10), grey, c, verts=20)
    ribs = []
    for k in range(3):
        ribs.append(tube(f"PumpRib{k}", 0.001, 0.095, (0, 0.04, 0.07 + k * 0.03), blk, c, axis='Z', verts=20))
    pedal = rounded_box("PumpPedal", (0.2, 0.26, 0.03), (0, 0.0, 0.175), blk, c, bevel=0.02, subdiv=1)
    for p in [bel, pedal] + ribs:
        parent_keep(p, bell)
    for p in (base, bell):
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (0, 0, -20)
    return root


def build_blower(c):
    yel = vinyl("BlowerYellow", "#f6c21a", rough=0.35)
    blk = pmat("BlowerBlack", srgb("#202122"), rough=0.5)
    met = pmat("BlowerMetal", srgb("#9aa0a6"), rough=0.3, metal=1.0)
    root = empty("Blower", (0, 0, 0), c=c, size=0.3)
    parts = []
    parts.append(cyl("BlowerBody", 0.30, 0.42, (0, 0, 0.42), yel, c, rot=(0, math.pi / 2, 0), verts=32))
    parts.append(cyl("BlowerGrill", 0.27, 0.02, (-0.215, 0, 0.42), blk, c, rot=(0, math.pi / 2, 0), verts=32))
    parts.append(cyl("BlowerOutlet", 0.13, 0.25, (0.30, 0, 0.42), blk, c, rot=(0, math.pi / 2, 0), verts=24))
    parts.append(box("BlowerFootL", (0.5, 0.06, 0.12), (0, -0.2, 0.06), blk, c, bevel=0.01))
    parts.append(box("BlowerFootR", (0.5, 0.06, 0.12), (0, 0.2, 0.06), blk, c, bevel=0.01))
    parts.append(cyl("BlowerHandle", 0.02, 0.5, (-0.05, 0, 0.78), met, c, rot=(math.pi / 2, 0, 0), verts=12))
    parts.append(cyl("BlowerHandleL", 0.02, 0.1, (-0.05, -0.24, 0.73), met, c, verts=12))
    parts.append(cyl("BlowerHandleR", 0.02, 0.1, (-0.05, 0.24, 0.73), met, c, verts=12))
    fan = empty("BlowerFan", (-0.22, 0, 0.42), c=c, size=0.1)
    for k in range(5):
        bl = box(f"FanBlade{k}", (0.01, 0.06, 0.22), (-0.205, 0, 0.42 + 0.11), met, c)
        bl.rotation_euler = (math.radians(72 * k), 0, 0)
        bl.location = Vector((-0.205, 0, 0.42)) + Matrix.Rotation(math.radians(72 * k), 3, 'X') @ Vector((0, 0, 0.11))
        parent_keep(bl, fan)
    parts.append(fan)
    for p in parts:
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (0, 0, -20)
    return root


def build_hose(c, name, pts, radius, hexcol):
    """thick fabric hose along world points (static)"""
    m = vinyl(name + "Mat", hexcol, rough=0.55)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    c.objects.link(ob)
    cu.materials.append(m)
    return ob


def build_castle(c):
    """inflatable bouncy castle parts around the mattress (local coords, origin = floor centre)"""
    red = vinyl("CastleRed", "#e3242b")
    yel = vinyl("CastleYellow", "#ffcc1f")
    blu = vinyl("CastleBlue", "#1f63d8")
    grn = vinyl("CastleGreen", "#27b04a")
    root = empty("Castle", (0, 0, 0), c=c, size=0.5)
    X, Y, Z = FLOOR
    P = []
    wall_h = 1.35
    # back + side walls (yellow panels with red top tubes)
    walls = [("WallBack", (X - 0.5, 0.36, wall_h), (0, Y / 2 - 0.1, Z + wall_h / 2), 'X', X - 0.5),
             ("WallLeft", (0.36, Y - 0.5, wall_h), (-X / 2 + 0.1, 0, Z + wall_h / 2), 'Y', Y - 0.5),
             ("WallRight", (0.36, Y - 0.5, wall_h), (X / 2 - 0.1, 0, Z + wall_h / 2), 'Y', Y - 0.5)]
    for name, size, loc, ax, L in walls:
        w = rounded_box(name, size, loc, yel, c, bevel=0.17, segs=4)
        top = tube(name + "Top", L, 0.2, (loc[0], loc[1], Z + wall_h + 0.08), red, c, axis=ax)
        parent_keep(top, w)
        # blue vertical seam stripes
        for k in range(3):
            t = (k + 1) / 4 - 0.5
            off = Vector((t * L, 0, 0)) if ax == 'X' else Vector((0, t * L, 0))
            s = box(name + f"Stripe{k}", (0.1, 0.38, wall_h * 0.85) if ax == 'X' else (0.38, 0.1, wall_h * 0.85),
                    Vector(loc) + off, blu, c, bevel=0.03)
            parent_keep(s, w)
        P.append(w)
    # low front bumpers either side of the entrance
    for sx in (-1, 1):
        fb = rounded_box(f"WallFront{sx}", (X * 0.3, 0.36, 0.55), (sx * X * 0.33, -Y / 2 + 0.1, Z + 0.27), red, c,
                         bevel=0.17)
        P.append(fb)
    # corner towers (blue columns, red cones, yellow balls)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cx, cy = sx * (X / 2 - 0.05), sy * (Y / 2 - 0.05)
        tw = tube(f"Tower{i}", 2.3, 0.34, (cx, cy, Z + 1.15 - 0.2), blu if i % 2 == 0 else red, c, axis='Z')
        bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.02, depth=0.6, vertices=24,
                                        location=(cx, cy, Z + 2.25))
        cone = bpy.context.active_object
        cone.name = f"TowerCone{i}"
        sd = cone.modifiers.new("smooth", 'SUBSURF')
        sd.levels = 1
        sd.render_levels = 2
        bpy.ops.object.shade_smooth()
        cone.data.materials.append(red if i % 2 == 0 else yel)
        link(cone, c)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(cx, cy, Z + 2.6))
        ball = bpy.context.active_object
        ball.name = f"TowerBall{i}"
        bpy.ops.object.shade_smooth()
        ball.data.materials.append(yel if i % 2 == 0 else grn)
        link(ball, c)
        for p in (cone, ball):
            parent_keep(p, tw)
        P.append(tw)
    # entrance arch
    bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.2, location=(0, -Y / 2 + 0.1, Z + 0.55),
                                     rotation=(math.pi / 2, 0, 0))
    arch = bpy.context.active_object
    arch.name = "CastleArch"
    bm = bmesh.new()
    bm.from_mesh(arch.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.05 * 0 and v.co.z < -0.05 and False], context='VERTS')
    bm.to_mesh(arch.data)
    # keep only the top half of the torus (arch)
    bm = bmesh.new()
    bm.from_mesh(arch.data)
    kill = [v for v in bm.verts if v.co.y < -0.02]      # torus rotated: local -y becomes world -z later
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(arch.data)
    sd = arch.modifiers.new("smooth", 'SUBSURF')
    sd.levels = 1
    sd.render_levels = 2
    bpy.ops.object.shade_smooth()
    arch.data.materials.append(blu)
    link(arch, c)
    P.append(arch)
    for p in P:
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (CASTLE_POS[0], CASTLE_POS[1], 0)
    root.rotation_euler = (0, 0, math.radians(CASTLE_YAW))
    return root


def build_phone(c):
    blk = pmat("PhoneBody", srgb("#111214"), rough=0.3)
    scr = pmat("PhoneScreen", srgb("#1b2a3a"), rough=0.1, emit=(0.55, 0.75, 1.0, 1.6))
    root = empty("Phone", (0, 0, 0), c=c, size=0.03)
    body = rounded_box("PhoneBody", (0.075, 0.008, 0.155), (0, 0, 0), blk, c, bevel=0.006, segs=3, subdiv=1)
    screen = box("PhoneScreen", (0.066, 0.001, 0.142), (0, -0.0045, 0), scr, c)
    for p in (body, screen):
        p.parent = root
        p.matrix_parent_inverse = Matrix()
    root.location = (0, 0, -20)
    return root


def build_fx_protos(c):
    """air-puff prototype (white soft sphere) + reuse of a 'drop' for small debris; star for impact"""
    puff = pmat("Puff", srgb("#ffffff"), rough=1.0, alpha=0.75)
    nt = puff.node_tree
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.75
    nt.links.new(oi.outputs["Alpha"], mul.inputs[0])
    nt.links.new(mul.outputs[0], nt.nodes["Principled BSDF"].inputs["Alpha"])
    nt.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 1, 1, 1)
    nt.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.4
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=(0, -34, 0))
    p = bpy.context.active_object
    p.name = "DropProto"          # fx.burst() instances this
    p.data.materials.append(puff)
    p.visible_shadow = False
    bpy.ops.object.shade_smooth()
    link(p, c)
    # "crown" proto = ring of puffs for pop / landings
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.25, location=(0, -36, 0))
    cr = bpy.context.active_object
    cr.name = "CrownProto"
    cr.data.materials.append(puff)
    cr.visible_shadow = False
    bpy.ops.object.shade_smooth()
    link(cr, c)
    # cartoon impact star
    star = pmat("ImpactStar", srgb("#fff4b0"), rough=1.0, emit=(1.0, 0.95, 0.6, 2.0), alpha=0.95)
    bm = bmesh.new()
    n = 10
    cen = bm.verts.new((0, 0, 0))
    ring = []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = 1.0 if k % 2 == 0 else 0.45
        ring.append(bm.verts.new((r * math.cos(a), 0, r * math.sin(a))))
    for k in range(n):
        bm.faces.new((cen, ring[k], ring[(k + 1) % n]))
    me = bpy.data.meshes.new("ImpactStar")
    bm.to_mesh(me)
    me.materials.append(star)
    so = bpy.data.objects.new("ImpactStar", me)
    c.objects.link(so)
    so.location = (0, -38, 0)
    so.visible_shadow = False


def build_all():
    c = coll("PROPS")
    build_binoculars(c)
    build_mattress(c)
    build_foot_pump(c)
    build_blower(c)
    build_castle(c)
    build_phone(c)
    build_fx_protos(c)
    for m in bpy.data.materials:
        low = m.name.lower()
        if not any(k in low for k in ("puff", "leaf", "ponytail", "long0", "short0", "eyebrow", "eyelash", "star")):
            try:
                m.use_transparent_shadow = False
            except Exception:
                pass
    return c
