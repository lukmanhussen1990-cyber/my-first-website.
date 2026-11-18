"""Room, floor, walls, windows, pendant lamps, tables, lights, world, render settings."""
import bpy, math, random
from mathutils import Vector
import lib
from lib import srgb

PH = "/opt/work/assets/polyhaven"
ROOM = dict(x0=-24.0, x1=12.0, y0=-18.0, y1=5.0, h=7.5)
TILE = 0.46


def nodes_new(nt, typ, loc=(0, 0), **inputs):
    n = nt.nodes.new(typ)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def math_node(nt, op, a=None, b=None, loc=(0, 0), clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.location = loc
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def floor_material():
    m = bpy.data.materials.new("M_Floor")
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    x = math_node(nt, 'DIVIDE', sep.outputs[0], TILE)
    y = math_node(nt, 'DIVIDE', sep.outputs[1], TILE)
    fx = math_node(nt, 'FLOOR', x)
    fy = math_node(nt, 'FLOOR', y)
    chk = math_node(nt, 'FLOORED_MODULO', math_node(nt, 'ADD', fx, fy), 2.0)
    # grout
    gx = math_node(nt, 'FRACT', x)
    gx = math_node(nt, 'MINIMUM', gx, math_node(nt, 'SUBTRACT', 1.0, gx))
    gy = math_node(nt, 'FRACT', y)
    gy = math_node(nt, 'MINIMUM', gy, math_node(nt, 'SUBTRACT', 1.0, gy))
    g = math_node(nt, 'MINIMUM', gx, gy)
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.008
    mr.inputs["From Max"].default_value = 0.016
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = 0.0
    nt.links.new(g, mr.inputs["Value"])
    grout = mr.outputs[0]
    # per-tile random tint
    tile_id = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', fx, 17.13), math_node(nt, 'MULTIPLY', fy, 7.71))
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = '1D'
    nt.links.new(tile_id, wn.inputs["W"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.5
    noise.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    c_or = nt.nodes.new("ShaderNodeMix"); c_or.data_type = 'RGBA'
    c_or.inputs["A"].default_value = srgb("#C9643A")
    c_or.inputs["B"].default_value = srgb("#DE7C4A")
    nt.links.new(wn.outputs["Value"], c_or.inputs["Factor"])
    c_cr = nt.nodes.new("ShaderNodeMix"); c_cr.data_type = 'RGBA'
    c_cr.inputs["A"].default_value = srgb("#E3D7C2")
    c_cr.inputs["B"].default_value = srgb("#F1E8D8")
    nt.links.new(wn.outputs["Value"], c_cr.inputs["Factor"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'
    nt.links.new(chk, mix.inputs["Factor"])
    nt.links.new(c_or.outputs[2], mix.inputs["A"])
    nt.links.new(c_cr.outputs[2], mix.inputs["B"])
    # subtle mottling
    mott = nt.nodes.new("ShaderNodeMix"); mott.data_type = 'RGBA'; mott.blend_type = 'MULTIPLY'
    mott.inputs["Factor"].default_value = 0.12
    nt.links.new(mix.outputs[2], mott.inputs["A"])
    nt.links.new(noise.outputs["Color"], mott.inputs["B"])
    gm = nt.nodes.new("ShaderNodeMix"); gm.data_type = 'RGBA'
    nt.links.new(grout, gm.inputs["Factor"])
    nt.links.new(mott.outputs[2], gm.inputs["A"])
    gm.inputs["B"].default_value = srgb("#5B4A3E")
    nt.links.new(gm.outputs[2], p.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.28
    rough.inputs["To Max"].default_value = 0.85
    nt.links.new(grout, rough.inputs["Value"])
    nt.links.new(rough.outputs[0], p.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    inv = math_node(nt, 'SUBTRACT', 1.0, grout)
    nt.links.new(inv, bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    p.inputs["Specular IOR Level"].default_value = 0.5
    return m


def wall_material():
    m = bpy.data.materials.new("M_Wall")
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.2
    noise.inputs["Detail"].default_value = 6
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeMix"); cr.data_type = 'RGBA'
    cr.inputs["A"].default_value = srgb("#87957F")
    cr.inputs["B"].default_value = srgb("#98A693")
    nt.links.new(noise.outputs["Fac"], cr.inputs["Factor"])
    nt.links.new(cr.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.9
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 60
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    nt.links.new(n2.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb("#8F9C8C")
    return m


def build_room(C):
    R = ROOM
    cx, cy = (R["x0"] + R["x1"]) / 2, (R["y0"] + R["y1"]) / 2
    sx, sy = R["x1"] - R["x0"], R["y1"] - R["y0"]
    bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, 0))
    fl = bpy.context.object; fl.name = "Floor"; fl.scale = (sx, sy, 1)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # world-aligned object coords
    lib.assign(fl, floor_material()); lib.link(fl, C)
    wm = wall_material()
    base_m = lib.mat("M_Baseboard", "#4E5A4E", rough=0.6)
    walls = []
    h = R["h"]
    specs = [("Wall_Back", (cx, R["y1"], h / 2), (sx, 0.2, h)),
             ("Wall_Left", (R["x0"], cy, h / 2), (0.2, sy, h)),
             ("Wall_Right", (R["x1"], cy, h / 2), (0.2, sy, h)),
             ("Wall_Front", (cx, R["y0"], h / 2), (sx, 0.2, h))]
    for name, loc, size in specs:
        w = lib.box(name, size, loc, C)
        lib.assign(w, wm)
        walls.append(w)
        bb = lib.box(name + "_base", (size[0] + (0.02 if size[0] > 1 else 0.06), size[1] + (0.06 if size[0] > 1 else 0.02), 0.16),
                     (loc[0], loc[1], 0.08), C)
        lib.assign(bb, base_m)
    ceil = lib.box("Ceiling", (sx, sy, 0.2), (cx, cy, h + 0.1), C)
    lib.assign(ceil, lib.mat("M_Ceiling", "#DADDD6", rough=0.9))
    ceil.visible_shadow = False
    # windows on back + right + left walls
    frame_m = lib.mat("M_WindowFrame", "#EDEDE6", rough=0.45)
    glass_m = bpy.data.materials.new("M_WindowSky")
    nt = glass_m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb("#DCE6EE")
    p.inputs["Emission Color"].default_value = srgb("#E8F0F6")
    p.inputs["Emission Strength"].default_value = 2.2
    p.inputs["Roughness"].default_value = 0.1
    def window(x, y, rot_z, name):
        W, H, z0 = 1.5, 3.3, 1.35
        g = lib.box(name + "_sky", (W, 0.02, H), (0, 0, 0), C); lib.assign(g, glass_m)
        parts = [g]
        t = 0.08
        for (px, pz, sw, sh) in [(-W / 2, 0, t, H + t), (W / 2, 0, t, H + t), (0, -H / 2, W + t, t), (0, H / 2, W + t, t),
                                 (0, 0, W, t * 0.6), (0, H / 4, W, t * 0.5), (0, -H / 4, W, t * 0.5), (0, 0, t * 0.6, H)]:
            f = lib.box(name + "_fr", (sw, 0.1, sh), (px, -0.04, pz), C); lib.assign(f, frame_m)
            parts.append(f)
        sill = lib.box(name + "_sill", (W + 0.3, 0.22, 0.07), (0, -0.1, -H / 2 - 0.06), C); lib.assign(sill, frame_m)
        parts.append(sill)
        for o in parts:
            o.parent = None
        # join
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for o in parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = parts[1]
        bpy.ops.object.join()
        j = bpy.context.object; j.name = name
        j.location = (x, y, z0 + H / 2)
        j.rotation_euler = (0, 0, rot_z)
        return j
    for i, x in enumerate([-21.5, -17.5, -13.5, -9.5, -5.5, -2.6, 3.8, 7.6, 10.4]):
        window(x, R["y1"] - 0.1, 0, f"Win_B{i}")
    for i, y in enumerate([-15, -11, -7, -3, 1.5]):
        window(R["x1"] - 0.1, y, math.radians(90), f"Win_R{i}")
        window(R["x0"] + 0.1, y, math.radians(-90), f"Win_L{i}")
    return fl


def append_ph(name, collection):
    f = f"{PH}/{name}/{name}_1k.blend"
    with bpy.data.libraries.load(f, link=False) as (src, dst):
        dst.objects = src.objects
    objs = [o for o in dst.objects if o is not None]
    for o in objs:
        collection.objects.link(o)
    return objs


def build_lamps(C):
    src = append_ph("hanging_industrial_lamp", C)[0]
    src.name = "LampSrc"
    enamel = lib.mat("M_LampEnamel", "#2E6A4C", rough=0.28, coat=0.3)
    inner = lib.mat("M_LampInner", "#F3F1E6", rough=0.4)
    bulb_m = lib.mat("M_Bulb", "#FFF4D8", rough=0.3, emit="#FFE9C0", emit_strength=8.0)
    cord_m = lib.mat("M_Cord", "#151515", rough=0.5)
    src.data.materials.clear()
    src.data.materials.append(enamel)
    # bbox
    bpy.context.view_layer.update()
    zs = [v.co.z for v in src.data.vertices]
    zmin, zmax = min(zs), max(zs)
    lamps = []
    positions = []
    for x in [-20, -15.5, -11, -6.5, -2, 2.5, 7]:
        for y in [-13.5, -9, -4.5, 0.6]:
            positions.append((x, y))
    low = [(-1.15, 2.1), (1.25, 2.6), (3.9, 1.9)]
    bulb = lib.icosphere("BulbSrc", 0.07, 2, collection=C); lib.assign(bulb, bulb_m)
    cord = lib.cylinder("CordSrc", 0.012, 1.0, collection=C); lib.assign(cord, cord_m)
    for i, (x, y) in enumerate(positions + low):
        z_bottom = 3.95 if i < len(positions) else 2.85
        l = src.copy(); C.objects.link(l)
        l.location = (x, y, z_bottom - zmin * l.scale.z)
        l.name = f"Lamp_{i}"
        b = bulb.copy(); C.objects.link(b); b.location = (x, y, z_bottom + 0.1)
        c = cord.copy(); C.objects.link(c)
        top = z_bottom + (zmax - zmin)
        c.scale = (1, 1, (9.0 - top)); c.location = (x, y, top + (9.0 - top) / 2)
        lamps.append(l)
    for o in (src, bulb, cord):
        bpy.data.objects.remove(o, do_unlink=True)
    return lamps


def build_tables(C):
    objs = append_ph("WoodenTable_01", C)
    t = objs[0]
    t.name = "MainTable"
    t.scale = (1.25, 1.15, 1.62)
    bpy.context.view_layer.update()
    zs = [ (t.matrix_world @ Vector(c)).z for c in t.bound_box]
    t.location = (0.0, -0.58, -min(zs) + t.location.z)
    bpy.context.view_layer.update()
    top = max((t.matrix_world @ Vector(c)).z for c in t.bound_box)
    print("Main table top z", top)
    return t, top


def build_lights_world(scene):
    w = bpy.data.worlds.new("World_Laundry")
    scene.world = w
    nt = w.node_tree
    bg = nt.nodes["Background"]
    bg.inputs[0].default_value = srgb("#C9D6E0")
    bg.inputs[1].default_value = 1.0
    sun_d = bpy.data.lights.new("Sun", 'SUN')
    sun_d.energy = 3.6
    sun_d.angle = math.radians(9)
    sun_d.color = (1.0, 0.96, 0.9)
    sun = bpy.data.objects.new("Sun", sun_d)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(42), math.radians(0), math.radians(-28))
    fill_d = bpy.data.lights.new("FillSun", 'SUN')
    fill_d.energy = 0.9
    fill_d.use_shadow = False
    fill_d.color = (0.92, 0.96, 1.0)
    fill = bpy.data.objects.new("FillSun", fill_d)
    scene.collection.objects.link(fill)
    fill.rotation_euler = (math.radians(65), 0, math.radians(150))
    return sun, fill


def render_settings(scene, res=(1080, 1920), samples=4):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.eevee.taa_render_samples = samples
    scene.eevee.use_raytracing = False
    scene.eevee.use_fast_gi = True
    scene.eevee.fast_gi_distance = 0.6
    scene.eevee.shadow_ray_count = 1
    scene.eevee.shadow_step_count = 4
    scene.render.use_persistent_data = True
    scene.render.film_transparent = False
    vs = scene.view_settings
    try:
        vs.view_transform = 'AgX'
        vs.look = 'AgX - Punchy'
    except Exception as e:
        print("view transform", e)
    vs.exposure = 0.0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.compression = 15
