"""Backyard set: asphalt court, shed, fence, hedge, trees, hoop, bench, bush, sky."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler

TEX = "/opt/work/tex"
R = random.Random(11)


# ------------------------------------------------------------------ helpers
def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def link(ob, c):
    for uc in ob.users_collection:
        uc.objects.unlink(ob)
    c.objects.link(ob)
    return ob


def srgb(h):
    """hex or tuple (0-255 sRGB) -> linear RGBA"""
    if isinstance(h, str):
        h = h.lstrip("#")
        h = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(h[0]), lin(h[1]), lin(h[2]), 1.0)


def pmat(name, color, rough=0.6, metal=0.0, spec=0.5, emit=None, alpha=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color if len(color) == 4 else (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    if emit:
        b.inputs["Emission Color"].default_value = (*emit[:3], 1)
        b.inputs["Emission Strength"].default_value = emit[3] if len(emit) > 3 else 1.0
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def img(name, path, colorspace="sRGB"):
    im = bpy.data.images.get(name)
    if im is None:
        im = bpy.data.images.load(path, check_existing=True)
        im.name = name
    im.colorspace_settings.name = colorspace
    return im


def box(name, size, loc, mat=None, c=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = ob.modifiers.new("bev", 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    if mat:
        ob.data.materials.append(mat)
    if c:
        link(ob, c)
    return ob


def cyl(name, r, depth, loc, mat=None, c=None, rot=(0, 0, 0), verts=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot,
                                        vertices=verts)
    ob = bpy.context.active_object
    ob.name = name
    if mat:
        ob.data.materials.append(mat)
    if c:
        link(ob, c)
    bpy.ops.object.shade_smooth()
    return ob


def ribbon(name, pts, width, z, mat, c):
    """flat strip along a 2D polyline"""
    bm = bmesh.new()
    verts = []
    for i, p in enumerate(pts):
        p = Vector((p[0], p[1], 0))
        if i == 0:
            d = Vector((pts[1][0], pts[1][1], 0)) - p
        elif i == len(pts) - 1:
            d = p - Vector((pts[i - 1][0], pts[i - 1][1], 0))
        else:
            d = Vector((pts[i + 1][0], pts[i + 1][1], 0)) - Vector((pts[i - 1][0], pts[i - 1][1], 0))
        d.normalize()
        n = Vector((-d.y, d.x, 0)) * width / 2
        verts.append((bm.verts.new((p.x + n.x, p.y + n.y, z)), bm.verts.new((p.x - n.x, p.y - n.y, z))))
    for i in range(len(verts) - 1):
        bm.faces.new((verts[i][0], verts[i][1], verts[i + 1][1], verts[i + 1][0]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    ob = bpy.data.objects.new(name, me)
    c.objects.link(ob)
    me.materials.append(mat)
    return ob


def arc_pts(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n))
            for i in range(n + 1)]


# ------------------------------------------------------------------ world
def build_world():
    sc = bpy.context.scene
    w = bpy.data.worlds.get("Sky") or bpy.data.worlds.new("Sky")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    # lighting: physical sky
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = 'NISHITA'
    sky.sun_disc = False
    sky.sun_elevation = math.radians(55)
    sky.sun_rotation = math.radians(200)
    sky.air_density = 1.2
    sky.dust_density = 0.4
    bg_light = nt.nodes.new("ShaderNodeBackground")
    bg_light.inputs[1].default_value = 0.30
    nt.links.new(sky.outputs[0], bg_light.inputs[0])
    # camera-visible: saturated blue gradient like the reference
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = srgb("#a9c4dc")
    cr.elements[1].position = 0.45
    cr.elements[1].color = srgb("#2f63a3")
    e = cr.elements.new(0.12)
    e.color = srgb("#7aa3cc")
    nt.links.new(sep.outputs[2], ramp.inputs[0])
    bg_cam = nt.nodes.new("ShaderNodeBackground")
    bg_cam.inputs[1].default_value = 1.0
    nt.links.new(ramp.outputs[0], bg_cam.inputs[0])
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bg_light.outputs[0], mix.inputs[1])
    nt.links.new(bg_cam.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])

    sun_d = bpy.data.lights.get("Sun") or bpy.data.lights.new("Sun", 'SUN')
    sun_d.energy = 4.2
    sun_d.angle = math.radians(2.5)
    sun_d.color = (1.0, 0.97, 0.92)
    sun = bpy.data.objects.get("Sun") or bpy.data.objects.new("Sun", sun_d)
    if sun.name not in sc.collection.objects:
        sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(38), 0, math.radians(-25))


def render_settings(res_x=1080, res_y=1920, samples=8):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.resolution_percentage = 100
    sc.render.fps = 30
    sc.eevee.taa_render_samples = samples
    sc.eevee.use_shadows = True
    sc.eevee.shadow_ray_count = 1
    sc.eevee.shadow_step_count = 6
    try:
        sc.eevee.use_raytracing = False
    except Exception:
        pass
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'


# ------------------------------------------------------------------ ground
def build_ground(c):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -2, 0))
    g = bpy.context.active_object
    g.name = "Asphalt"
    g.scale = (60, 60, 1)
    bpy.ops.object.transform_apply(scale=True)
    link(g, c)
    m = bpy.data.materials.new("Asphalt")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 0.35
    n1.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = srgb("#4c4f53")
    ramp.color_ramp.elements[1].color = srgb("#5d6064")
    nt.links.new(n1.outputs["Fac"], ramp.inputs[0])
    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 180
    n2.inputs["Detail"].default_value = 2
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    mixc = nt.nodes.new("ShaderNodeMixRGB")
    mixc.blend_type = 'OVERLAY'
    mixc.inputs[0].default_value = 0.25
    nt.links.new(ramp.outputs[0], mixc.inputs[1])
    nt.links.new(n2.outputs["Color"], mixc.inputs[2])
    # wet patches mask (driven per shot via the 'Puddle' objects instead)
    nt.links.new(mixc.outputs[0], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.88
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(n2.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    g.data.materials.append(m)

    line = pmat("CourtLine", srgb("#e9eae6"), rough=0.7)
    W = 0.06
    z = 0.003
    bx, by = 2.0, 7.0          # baseline center under the hoop
    lines = []
    lines.append(ribbon("Baseline", [(-5.0, by), (9.5, by)], W, z, line, c))
    lines.append(ribbon("LaneL", [(bx - 2.45, by), (bx - 2.45, by - 5.8)], W, z, line, c))
    lines.append(ribbon("LaneR", [(bx + 2.45, by), (bx + 2.45, by - 5.8)], W, z, line, c))
    lines.append(ribbon("FreeThrow", [(bx - 2.45, by - 5.8), (bx + 2.45, by - 5.8)], W, z, line, c))
    lines.append(ribbon("FTCircle", arc_pts(bx, by - 5.8, 1.8, math.pi, 2 * math.pi, 40), W, z, line, c))
    lines.append(ribbon("FTCircleTop", arc_pts(bx, by - 5.8, 1.8, 0, math.pi, 40), W, z, line, c))
    lines.append(ribbon("ThreePt", arc_pts(bx, by - 1.2, 6.75, math.pi * 1.06, math.pi * 1.94, 90), W, z, line, c))
    lines.append(ribbon("Sideline", [(-5.0, by), (-5.0, -14.0)], W, z, line, c))
    lines.append(ribbon("HalfCourt", arc_pts(bx, by - 14.3, 1.8, 0, math.pi, 40), W, z, line, c))

    curb = pmat("Curb", srgb("#b9b8b2"), rough=0.85)
    box("Curb", (40, 0.35, 0.10), (0, 7.55, 0.05), curb, c)
    gm = bpy.data.materials.new("Grass")
    gm.use_nodes = True
    nt = gm.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("grass", f"{TEX}/grass.png")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.6, 0.6, 0.6)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    grass = box("GrassStrip", (40, 1.6, 0.06), (0, 8.5, 0.03), gm, c)
    grass2 = box("GrassStripL", (1.6, 30, 0.06), (-11.6, -6, 0.03), gm, c)
    grass3 = box("GrassStripR", (1.6, 30, 0.06), (11.6, -6, 0.03), gm, c)


# ------------------------------------------------------------------ fence
def wood_mat(name, hexcol, scale=(1, 1, 18)):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs["Scale"].default_value = 3.0
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 3
    nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    base = srgb(hexcol)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(c * 0.78 for c in base[:3]) + (1,)
    ramp.color_ramp.elements[1].color = base
    nt.links.new(wave.outputs["Fac"], ramp.inputs[0])
    nb = nt.nodes.new("ShaderNodeTexNoise")
    nb.inputs["Scale"].default_value = 0.8
    nt.links.new(tc.outputs["Object"], nb.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 0.25
    nt.links.new(ramp.outputs[0], mix.inputs[1])
    nt.links.new(nb.outputs["Color"], mix.inputs[2])
    nt.links.new(mix.outputs[0], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.75
    return m


def fence_run(name, start, direction, length, c, mat, post_mat, height=1.95):
    d = Vector((direction[0], direction[1], 0)).normalized()
    start = Vector((start[0], start[1], 0))
    ang = math.atan2(d.y, d.x)
    bw, gap = 0.145, 0.018
    n = int(length / (bw + gap))
    board = box(name + "_boards", (bw, 0.022, height), (0, 0, 0), mat, c)
    arr = board.modifiers.new("arr", 'ARRAY')
    arr.count = n
    arr.use_relative_offset = False
    arr.use_constant_offset = True
    arr.constant_offset_displace = (bw + gap, 0, 0)
    board.location = (start[0], start[1], height / 2 + 0.02)
    board.rotation_euler = (0, 0, ang)
    # rails and posts on the back side (+normal)
    nrm = Vector((-d.y, d.x, 0))
    for zz in (0.35, 1.55):
        rail = box(name + f"_rail{zz}", (length, 0.04, 0.09), (0, 0, 0), post_mat, c)
        mid = Vector(start) + d * (length / 2) + nrm * 0.035
        rail.location = (mid.x, mid.y, zz)
        rail.rotation_euler = (0, 0, ang)
    npost = int(length / 2.4) + 1
    for i in range(npost):
        p = Vector(start) + d * (i * 2.4) + nrm * 0.07
        post = box(name + f"_post{i}", (0.09, 0.09, height + 0.1), (p.x, p.y, (height + 0.1) / 2), post_mat, c)


def build_fence(c):
    mat = wood_mat("FenceWood", "#c26b33")
    post = wood_mat("FencePost", "#9b5428")
    fence_run("FenceBack", (-12.0, 9.3), (1, 0, 0), 24.0, c, mat, post)
    fence_run("FenceLeft", (-12.0, -14.0), (0, 1, 0), 23.3, c, mat, post)
    fence_run("FenceRight", (12.0, 9.3), (0, -1, 0), 23.3, c, mat, post)


# ------------------------------------------------------------------ shed
def build_shed(c, center=(-6.6, 6.0), w=3.8, dpt=2.6, h=2.45):
    cx, cy = center
    siding = pmat("Siding", srgb("#c3cfd9"), rough=0.55)
    trim = pmat("Trim", srgb("#f2f3f2"), rough=0.5)
    roof = pmat("Roof", srgb("#3b3d40"), rough=0.7)
    glass = pmat("WindowGlass", srgb("#4f6f8f"), rough=0.08, spec=0.8)
    core = box("ShedCore", (w - 0.06, dpt - 0.06, h), (cx, cy, h / 2), siding, c)
    bh = 0.16
    nb = int(h / bh)
    # clapboards on each wall (array upward)
    walls = [((cx, cy - dpt / 2 - 0.012), 0, w), ((cx, cy + dpt / 2 + 0.012), math.pi, w),
             ((cx - w / 2 - 0.012, cy), -math.pi / 2, dpt), ((cx + w / 2 + 0.012, cy), math.pi / 2, dpt)]
    for i, (p, rot, length) in enumerate(walls):
        bd = box(f"Clap{i}", (length + 0.02, 0.025, bh), (0, 0, 0), siding, c, bevel=0.004)
        # tilt the board outward at the bottom
        bd.rotation_euler = (math.radians(-5), 0, rot)
        bd.location = (p[0], p[1], bh / 2 + 0.02)
        arr = bd.modifiers.new("arr", 'ARRAY')
        arr.count = nb
        arr.use_relative_offset = False
        arr.use_constant_offset = True
        arr.constant_offset_displace = (0, 0, bh)
        arr.use_object_offset = False
        # array along local Z (board tilted), fine at small angle
    # corner trims
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("CornerTrim", (0.09, 0.09, h + 0.02), (cx + sx * (w / 2 + 0.02), cy + sy * (dpt / 2 + 0.02),
                                                       h / 2), trim, c)
    # roof slab + fascia
    box("ShedRoof", (w + 0.45, dpt + 0.45, 0.10), (cx, cy, h + 0.10), roof, c)
    box("FasciaF", (w + 0.47, 0.04, 0.16), (cx, cy - dpt / 2 - 0.245, h + 0.05), trim, c)
    box("FasciaB", (w + 0.47, 0.04, 0.16), (cx, cy + dpt / 2 + 0.245, h + 0.05), trim, c)
    box("FasciaL", (0.04, dpt + 0.47, 0.16), (cx - w / 2 - 0.245, cy, h + 0.05), trim, c)
    box("FasciaR", (0.04, dpt + 0.47, 0.16), (cx + w / 2 + 0.245, cy, h + 0.05), trim, c)
    # windows: front (-Y) and right side (+X)
    def window(px, py, rot, ww=0.95, wh=0.85, z=1.45):
        f = Vector((math.sin(rot) * -1, -math.cos(rot), 0))  # outward normal for rot about Z
        o = Vector((px, py, z)) + f * 0.035
        g = box("WinGlass", (ww, 0.01, wh), (o.x, o.y, o.z), glass, c, rot=(0, 0, rot))
        t = 0.06
        for dz in (-wh / 2, wh / 2):
            box("WinFrameH", (ww + 2 * t, 0.06, t), (o.x + f.x * 0.01, o.y + f.y * 0.01, z + dz), trim, c,
                rot=(0, 0, rot))
        for dx in (-ww / 2, ww / 2):
            ox = o + Vector((math.cos(rot), math.sin(rot), 0)) * dx
            box("WinFrameV", (t, 0.06, wh + 2 * t), (ox.x + f.x * 0.01, ox.y + f.y * 0.01, z), trim, c,
                rot=(0, 0, rot))
        box("WinMullionV", (0.035, 0.05, wh), (o.x + f.x * 0.012, o.y + f.y * 0.012, z), trim, c, rot=(0, 0, rot))
        box("WinMullionH", (ww, 0.05, 0.035), (o.x + f.x * 0.012, o.y + f.y * 0.012, z), trim, c, rot=(0, 0, rot))
        box("WinSill", (ww + 0.2, 0.09, 0.05), (o.x + f.x * 0.03, o.y + f.y * 0.03, z - wh / 2 - 0.06), trim, c,
            rot=(0, 0, rot))
    window(cx - 0.6, cy - dpt / 2, 0.0)
    window(cx + w / 2, cy + 0.1, math.pi / 2)
    # door on the right half of the front
    door = pmat("ShedDoor", srgb("#bac6d0"), rough=0.5)
    box("ShedDoor", (0.9, 0.05, 1.95), (cx + 1.05, cy - dpt / 2 - 0.03, 0.99), door, c)
    box("DoorFrameT", (1.02, 0.07, 0.06), (cx + 1.05, cy - dpt / 2 - 0.04, 1.98), trim, c)
    box("DoorFrameL", (0.06, 0.07, 1.98), (cx + 0.57, cy - dpt / 2 - 0.04, 0.99), trim, c)
    box("DoorFrameR", (0.06, 0.07, 1.98), (cx + 1.53, cy - dpt / 2 - 0.04, 0.99), trim, c)
    knob = pmat("Metal", srgb("#9a9ea3"), rough=0.3, metal=1.0)
    cyl("Knob", 0.03, 0.06, (cx + 0.7, cy - dpt / 2 - 0.08, 1.0), knob, c, rot=(math.pi / 2, 0, 0))


# ------------------------------------------------------------------ foliage
def leaf_cards(c):
    """4 leaf-card objects (one atlas cell each) collected for particle instancing."""
    lc = bpy.data.collections.get("LeafCards")
    if lc:
        return lc
    lc = bpy.data.collections.new("LeafCards")
    bpy.context.scene.collection.children.link(lc)
    m = bpy.data.materials.new("LeafCard")
    m.use_nodes = True
    m.surface_render_method = 'DITHERED'
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("leaf_atlas", f"{TEX}/leaf_atlas.png")
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Subsurface Weight"].default_value = 0.0
    tr = b.inputs.get("Transmission Weight")
    m.use_backface_culling = False
    for k in range(4):
        u0, v0 = (k % 2) * 0.5, 0.5 - (k // 2) * 0.5
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in [(-0.5, 0, 0), (0.5, 0, 0), (0.5, 1, 0), (-0.5, 1, 0)]]
        f = bm.faces.new(vs)
        uv = bm.loops.layers.uv.new()
        for loop, (u, v) in zip(f.loops, [(u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.5), (u0, v0 + 0.5)]):
            loop[uv].uv = (u, v)
        me = bpy.data.meshes.new(f"LeafCard{k}")
        bm.to_mesh(me)
        me.materials.append(m)
        ob = bpy.data.objects.new(f"LeafCard{k}", me)
        lc.objects.link(ob)
    lc.hide_render = False
    # keep the source cards out of view; no shadows (huge cost on CPU EEVEE)
    for ob in lc.objects:
        ob.location = (0, 0, -50)
        ob.visible_shadow = False
    return lc


def scatter_leaves(emitter, count, size, size_rand=0.5, emit_from='FACE', seed=1):
    mod = emitter.modifiers.new("leaves", 'PARTICLE_SYSTEM')
    ps = mod.particle_system
    ps.seed = seed
    st = ps.settings
    st.type = 'HAIR'
    st.count = count
    st.hair_length = 1.0
    st.emit_from = emit_from
    st.use_emit_random = True
    st.render_type = 'COLLECTION'
    st.instance_collection = bpy.data.collections["LeafCards"]
    st.use_collection_pick_random = True
    st.particle_size = size
    st.size_random = size_rand
    st.use_rotations = True
    st.rotation_mode = 'NOR'
    st.rotation_factor_random = 0.6
    st.phase_factor_random = 2.0
    st.use_advanced_hair = True
    emitter.show_instancer_for_render = emit_from == 'FACE' and False
    return ps


def bake_leaves(emitter, flat=True):
    """Replace the leaf particle system of `emitter` by one static mesh of leaf cards
    (avoids per-frame particle evaluation, much faster renders)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = emitter.evaluated_get(dg)
    if not ev.particle_systems:
        return None
    psys = ev.particle_systems[0]
    r = random.Random(sum(ord(ch) for ch in emitter.name))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    corners = [Vector(c) for c in ((-0.5, 0, 0), (0.5, 0, 0), (0.5, 1, 0), (-0.5, 1, 0))]
    card_rot = Euler((0, math.radians(90), 0)).to_quaternion() if flat else Euler((0, 0, 0)).to_quaternion()
    mw = ev.matrix_world.copy()
    for pt in psys.particles:
        q = pt.rotation @ card_rot
        s = pt.size
        if len(pt.hair_keys):
            loc = mw @ Vector(pt.hair_keys[0].co)
        else:
            loc = Vector(pt.location)
        k = r.randrange(4)
        u0, v0 = (k % 2) * 0.5, 0.5 - (k // 2) * 0.5
        vs = [bm.verts.new(loc + q @ (c * s)) for c in corners]
        f = bm.faces.new(vs)
        for lp, (u, v) in zip(f.loops, ((u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.5), (u0, v0 + 0.5))):
            lp[uv].uv = (u, v)
    me = bpy.data.meshes.new(emitter.name + "_leaves")
    bm.to_mesh(me)
    me.materials.append(bpy.data.materials["LeafCard"])
    ob = bpy.data.objects.new(emitter.name + "_leaves", me)
    for c in emitter.users_collection:
        c.objects.link(ob)
    ob.visible_shadow = False
    for m in list(emitter.modifiers):
        if m.type == 'PARTICLE_SYSTEM':
            emitter.modifiers.remove(m)
    return ob


def bake_all_leaves():
    for ob in list(bpy.data.objects):
        if any(m.type == 'PARTICLE_SYSTEM' for m in ob.modifiers):
            is_cluster = "_cluster" in ob.name
            bake_leaves(ob, flat=not is_cluster)
            if is_cluster:
                ob.hide_render = True
                ob.hide_viewport = True


def leafy_mat():
    m = bpy.data.materials.get("HedgeLeaves")
    if m:
        return m
    m = bpy.data.materials.new("HedgeLeaves")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.9, 0.9, 0.9)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img("hedge", f"{TEX}/hedge.png")
    t.projection = 'BOX'
    t.projection_blend = 0.3
    nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    tb = nt.nodes.new("ShaderNodeTexImage")
    tb.image = img("hedge_bump", f"{TEX}/hedge_bump.png", "Non-Color")
    tb.projection = 'BOX'
    tb.projection_blend = 0.3
    nt.links.new(mp.outputs["Vector"], tb.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(tb.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.7
    return m


def blob(name, loc, size, c, seed=0, subdiv=3, disp=0.12):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new(name + "_n", 'CLOUDS')
    tex.noise_scale = 0.45
    tex.noise_depth = 2
    d = ob.modifiers.new("disp", 'DISPLACE')
    d.texture = tex
    d.strength = disp
    d.texture_coords = 'GLOBAL'
    sm = ob.modifiers.new("sub", 'SUBSURF')
    sm.levels = 1
    sm.render_levels = 1
    link(ob, c)
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(leafy_mat())
    return ob


def build_hedge(c):
    m = leafy_mat()
    # long trimmed hedge in front of the back fence (right side)
    h = box("Hedge", (8.5, 1.0, 1.35), (6.6, 8.55, 0.70), m, c, bevel=0.25)
    sm = h.modifiers.new("sub", 'SUBSURF')
    sm.levels = 1
    sm.render_levels = 2
    tex = bpy.data.textures.new("hedge_n", 'CLOUDS')
    tex.noise_scale = 0.35
    d = h.modifiers.new("disp", 'DISPLACE')
    d.texture = tex
    d.strength = 0.08
    d.texture_coords = 'GLOBAL'
    # scattered leaves for a fluffy silhouette
    bpy.ops.object.modifier_apply(modifier="bev")
    scatter_leaves(h, 2600, 0.16, seed=3)
    h.show_instancer_for_render = True


def build_bush(c, loc=(-3.3, -3.6, 0.0)):
    """the bush where YOU hides (close to camera -> more detail)"""
    b = blob("Bush", (loc[0], loc[1], 0.55), (1.15, 0.75, 0.62), c, seed=5, subdiv=4, disp=0.16)
    b2 = blob("Bush2", (loc[0] + 0.85, loc[1] + 0.15, 0.45), (0.75, 0.6, 0.5), c, seed=6, subdiv=3, disp=0.12)
    b3 = blob("Bush3", (loc[0] - 0.9, loc[1] + 0.1, 0.42), (0.7, 0.55, 0.45), c, seed=7, subdiv=3, disp=0.12)
    for i, (ob, n) in enumerate(((b, 5200), (b2, 2400), (b3, 2200))):
        scatter_leaves(ob, n, 0.12, seed=17 + i)
        ob.show_instancer_for_render = True
    return b


def make_tree(name, base, height, c, seed=0, spread=2.6):
    r = random.Random(seed)
    bark = bpy.data.materials.get("Bark") or pmat("Bark", srgb("#4a4038"), rough=0.9)
    curve = bpy.data.curves.new(name + "_curve", 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 1.0
    curve.bevel_resolution = 3
    curve.use_fill_caps = True
    clusters = []

    def branch(p0, direction, length, radius, depth):
        spl = curve.splines.new('BEZIER')
        n = 4
        spl.bezier_points.add(n - 1)
        p = Vector(p0)
        d = Vector(direction).normalized()
        for i in range(n):
            bp = spl.bezier_points[i]
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
            bp.radius = radius * (1 - 0.75 * i / (n - 1))
            d = (d + Vector((r.uniform(-0.35, 0.35), r.uniform(-0.35, 0.35), r.uniform(-0.1, 0.25)))).normalized()
            p = p + d * (length / (n - 1))
        end = spl.bezier_points[-1].co.copy()
        if depth > 0:
            k = 3 if depth == 2 else 2
            for j in range(k):
                t = r.uniform(0.45, 0.95)
                idx = min(n - 1, int(t * (n - 1)) + 1)
                start = spl.bezier_points[idx].co.copy()
                nd = (d + Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(0.1, 0.9)))).normalized()
                branch(start, nd, length * r.uniform(0.5, 0.7), radius * 0.45, depth - 1)
        else:
            clusters.append(end)

    trunk_h = height * 0.42
    branch(base, (r.uniform(-0.15, 0.15), r.uniform(-0.15, 0.15), 1), trunk_h, height * 0.028, 0)
    top = Vector(base) + Vector((0, 0, trunk_h * 0.95))
    for j in range(4):
        a = j / 4 * math.pi * 2 + r.uniform(-0.4, 0.4)
        dvec = Vector((math.cos(a), math.sin(a), r.uniform(0.8, 1.4)))
        branch(top, dvec, height * 0.38, height * 0.016, 2)
    ob = bpy.data.objects.new(name, curve)
    c.objects.link(ob)
    curve.materials.append(bark)
    # leaf clusters
    for i, p in enumerate(clusters):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r.uniform(0.7, 1.15) * height / 7.0,
                                              location=p)
        cl = bpy.context.active_object
        cl.name = f"{name}_cluster{i}"
        cl.scale = (1.0, 1.0, 0.7)
        link(cl, c)
        scatter_leaves(cl, int(260 * height / 7.0), 0.21 * height / 7.0, seed=seed * 31 + i, emit_from='VOLUME')
        cl.show_instancer_for_render = False
    return ob


def build_trees(c):
    spots = [(-9.5, 12.0, 7.5), (-4.0, 13.5, 8.5), (1.5, 12.2, 7.0), (7.5, 13.0, 8.0), (13.0, 11.5, 7.0),
             (-14.5, 4.0, 7.5), (-15.0, -6.0, 8.0), (15.0, 2.0, 7.0), (4.0, 17.0, 9.0), (-11.0, 18.0, 9.0)]
    for i, (x, y, h) in enumerate(spots):
        make_tree(f"Tree{i}", (x, y, 0), h, c, seed=i + 3)


# ------------------------------------------------------------------ hoop, bench, tower
def build_hoop(c, base=(2.0, 7.6)):
    pole_m = pmat("HoopPole", srgb("#3c4a5a"), rough=0.35, metal=0.8)
    white = pmat("Backboard", srgb("#f3f4f4"), rough=0.35)
    orange = pmat("Rim", srgb("#e0541c"), rough=0.35, metal=0.5)
    netm = pmat("Net", srgb("#f0f0f0"), rough=0.8)
    blue = pmat("BoardLine", srgb("#2b5c9c"), rough=0.4)
    x, y = base
    cyl("HoopPole", 0.06, 3.3, (x, y, 1.65), pole_m, c)
    box("HoopArm", (0.07, 0.75, 0.07), (x, y - 0.35, 3.18), pole_m, c)
    bz = 3.35
    box("Backboard", (1.8, 0.04, 1.05), (x, y - 0.72, bz), white, c)
    for (sx, sz, ox, oz) in [(0.6, 0.04, 0, 0.21), (0.6, 0.04, 0, -0.21), (0.04, 0.45, -0.3, 0),
                             (0.04, 0.45, 0.3, 0)]:
        box("BoardLine", (sx, 0.01, sz), (x + ox, y - 0.745, bz - 0.15 + oz), blue, c)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.23, minor_radius=0.012, location=(x, y - 0.98, 3.05))
    rim = bpy.context.active_object
    rim.name = "Rim"
    rim.data.materials.append(orange)
    link(rim, c)
    net = cyl("Net", 0.23, 0.42, (x, y - 0.98, 2.84), netm, c, verts=16, r2=0.15)
    net.modifiers.new("wire", 'WIREFRAME').thickness = 0.006
    bpy.ops.object.select_all(action='DESELECT')


def build_bench(c, loc=(-2.0, 8.1)):
    wood = wood_mat("BenchWood", "#a0673a", scale=(1, 18, 1))
    metal = pmat("BenchMetal", srgb("#55595e"), rough=0.4, metal=0.8)
    x, y = loc
    for i in range(3):
        box("BenchPlank", (1.9, 0.11, 0.035), (x, y - 0.12 + i * 0.12, 0.46), wood, c, bevel=0.008)
    for sx in (-0.8, 0.8):
        box("BenchLeg", (0.05, 0.35, 0.44), (x + sx, y, 0.22), metal, c)


def build_tower(c):
    """distant white cooling tower (a running gag in this series)"""
    H = 48.0
    rt, zt = 12.0, 0.72 * H
    cc = zt / math.sqrt((21.0 / rt) ** 2 - 1)
    prof = []
    for i in range(25):
        z = H * i / 24
        prof.append((rt * math.sqrt(1 + ((z - zt) / cc) ** 2), z))
    bm = bmesh.new()
    rings = []
    seg = 48
    for rr, z in prof:
        rings.append([bm.verts.new((rr * math.cos(2 * math.pi * k / seg), rr * math.sin(2 * math.pi * k / seg), z))
                      for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    me = bpy.data.meshes.new("CoolingTower")
    bm.to_mesh(me)
    ob = bpy.data.objects.new("CoolingTower", me)
    c.objects.link(ob)
    ob.location = (-75, 270, -2)
    me.materials.append(pmat("Concrete", srgb("#ecebe6"), rough=0.9))
    for p in me.polygons:
        p.use_smooth = True


def opaque_shadows():
    for m in bpy.data.materials:
        low = m.name.lower()
        if not any(k in low for k in ("short0", "eyebrow", "eyelash", "leaf", "steam", "water", "acrylic", "splash")):
            try:
                m.use_transparent_shadow = False
            except Exception:
                pass


def build_all():
    c = coll("SET")
    build_world()
    render_settings()
    build_ground(c)
    build_fence(c)
    build_shed(c)
    leaf_cards(c)
    build_hedge(c)
    build_bush(c)
    build_trees(c)
    build_hoop(c)
    build_bench(c)
    build_tower(c)
    opaque_shadows()
    bake_all_leaves()
    return c
