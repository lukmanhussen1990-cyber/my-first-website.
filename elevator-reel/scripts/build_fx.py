"""FX: stink lines (geometry nodes), foam, droplets, poof clouds, streams, spin lines, money signs."""
import bpy, bmesh, math, random
from mathutils import Vector
import lib
from lib import srgb


def _sock(ng, name, typ, in_out='INPUT', default=None):
    s = ng.interface.new_socket(name=name, in_out=in_out, socket_type=typ)
    if default is not None and hasattr(s, "default_value"):
        s.default_value = default
    return s


def stink_group():
    ng = bpy.data.node_groups.get("StinkGN")
    if ng:
        return ng
    ng = bpy.data.node_groups.new("StinkGN", 'GeometryNodeTree')
    _sock(ng, "Geometry", 'NodeSocketGeometry')
    _sock(ng, "Phase", 'NodeSocketFloat', default=0.0)
    _sock(ng, "Height", 'NodeSocketFloat', default=0.45)
    _sock(ng, "Amp", 'NodeSocketFloat', default=0.035)
    _sock(ng, "Radius", 'NodeSocketFloat', default=0.012)
    _sock(ng, "Grow", 'NodeSocketFloat', default=1.0)
    _sock(ng, "Geometry", 'NodeSocketGeometry', in_out='OUTPUT')
    N = ng.nodes
    L = ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")
    line = N.new("GeometryNodeCurvePrimitiveLine")
    cxyz = N.new("ShaderNodeCombineXYZ")
    hm = N.new("ShaderNodeMath"); hm.operation = 'MULTIPLY'
    L.new(gi.outputs["Height"], hm.inputs[0]); L.new(gi.outputs["Grow"], hm.inputs[1])
    L.new(hm.outputs[0], cxyz.inputs["Z"])
    L.new(cxyz.outputs[0], line.inputs["End"])
    res = N.new("GeometryNodeResampleCurve")
    res.inputs["Count"].default_value = 36
    L.new(line.outputs[0], res.inputs["Curve"])
    pos = N.new("GeometryNodeInputPosition")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(pos.outputs[0], sep.inputs[0])
    # x offset = amp * sin(z*14 + phase) * (0.4 + z/height)
    m1 = N.new("ShaderNodeMath"); m1.operation = 'MULTIPLY'; m1.inputs[1].default_value = 15.0
    L.new(sep.outputs["Z"], m1.inputs[0])
    m2 = N.new("ShaderNodeMath"); m2.operation = 'ADD'
    L.new(m1.outputs[0], m2.inputs[0]); L.new(gi.outputs["Phase"], m2.inputs[1])
    s1 = N.new("ShaderNodeMath"); s1.operation = 'SINE'
    L.new(m2.outputs[0], s1.inputs[0])
    m3 = N.new("ShaderNodeMath"); m3.operation = 'MULTIPLY'
    L.new(s1.outputs[0], m3.inputs[0]); L.new(gi.outputs["Amp"], m3.inputs[1])
    zr = N.new("ShaderNodeMath"); zr.operation = 'DIVIDE'
    L.new(sep.outputs["Z"], zr.inputs[0]); L.new(gi.outputs["Height"], zr.inputs[1])
    za = N.new("ShaderNodeMath"); za.operation = 'ADD'; za.inputs[1].default_value = 0.35
    L.new(zr.outputs[0], za.inputs[0])
    m4 = N.new("ShaderNodeMath"); m4.operation = 'MULTIPLY'
    L.new(m3.outputs[0], m4.inputs[0]); L.new(za.outputs[0], m4.inputs[1])
    off = N.new("ShaderNodeCombineXYZ")
    L.new(m4.outputs[0], off.inputs["X"])
    setp = N.new("GeometryNodeSetPosition")
    L.new(res.outputs[0], setp.inputs["Geometry"])
    L.new(off.outputs[0], setp.inputs["Offset"])
    # taper radius
    spar = N.new("GeometryNodeSplineParameter")
    tp = N.new("ShaderNodeMath"); tp.operation = 'MULTIPLY'; tp.inputs[1].default_value = math.pi
    L.new(spar.outputs["Factor"], tp.inputs[0])
    ts = N.new("ShaderNodeMath"); ts.operation = 'SINE'
    L.new(tp.outputs[0], ts.inputs[0])
    tpw = N.new("ShaderNodeMath"); tpw.operation = 'POWER'; tpw.inputs[1].default_value = 0.35
    L.new(ts.outputs[0], tpw.inputs[0])
    rad = N.new("GeometryNodeSetCurveRadius")
    L.new(setp.outputs[0], rad.inputs["Curve"])
    L.new(tpw.outputs[0], rad.inputs["Radius"])
    circ = N.new("GeometryNodeCurvePrimitiveCircle")
    circ.inputs["Resolution"].default_value = 10
    L.new(gi.outputs["Radius"], circ.inputs["Radius"])
    c2m = N.new("GeometryNodeCurveToMesh")
    L.new(rad.outputs[0], c2m.inputs["Curve"])
    L.new(circ.outputs[0], c2m.inputs["Profile Curve"])
    if "Fill Caps" in c2m.inputs:
        c2m.inputs["Fill Caps"].default_value = True
    if "Scale" in c2m.inputs:
        pass
    sm = N.new("GeometryNodeSetShadeSmooth")
    L.new(c2m.outputs[0], sm.inputs["Geometry"])
    smat = N.new("GeometryNodeSetMaterial")
    smat.inputs["Material"].default_value = stink_material()
    L.new(sm.outputs[0], smat.inputs["Geometry"])
    L.new(smat.outputs[0], go.inputs["Geometry"])
    return ng


def gn_input_id(ng, name):
    for it in ng.interface.items_tree:
        if getattr(it, "in_out", None) == 'INPUT' and it.name == name:
            return it.identifier
    raise KeyError(name)


def stink_material():
    m = bpy.data.materials.get("M_Stink")
    if m:
        return m
    m = bpy.data.materials.new("M_Stink")
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb("#6DB33F")
    p.inputs["Emission Color"].default_value = srgb("#7CC64A")
    p.inputs["Emission Strength"].default_value = 0.35
    p.inputs["Roughness"].default_value = 0.6
    m.surface_render_method = 'DITHERED'
    m.diffuse_color = srgb("#9CCB6A")
    return m


def make_stink(name, C, loc, height=0.45, amp=0.035, radius=0.012):
    me = bpy.data.meshes.new(name)
    o = bpy.data.objects.new(name, me)
    C.objects.link(o)
    o.location = loc
    mod = o.modifiers.new("Stink", 'NODES')
    ng = stink_group()
    mod.node_group = ng
    gn_set(mod, ng, "Height", height)
    gn_set(mod, ng, "Amp", amp)
    gn_set(mod, ng, "Radius", radius)
    me.materials.append(stink_material())
    o.color = (1, 1, 1, 0.75)
    o.visible_shadow = False
    return o


def gn_set(mod, ng, name, value):
    sid = gn_input_id(ng, name)
    sock = getattr(mod.properties.inputs, sid)
    sock.value = value
    return sock.path_from_id("value")


def key_stink(o, frame, phase=None, grow=None, alpha=None):
    mod = o.modifiers["Stink"]
    ng = mod.node_group
    if phase is not None:
        o.keyframe_insert(gn_set(mod, ng, "Phase", phase), frame=frame)
    if grow is not None:
        o.keyframe_insert(gn_set(mod, ng, "Grow", grow), frame=frame)
    if alpha is not None:
        o.color[3] = alpha
        o.keyframe_insert("color", index=3, frame=frame)


def stink_cluster(prefix, C, center, n=3, spread=0.09, height=0.42, f_in=0, f_out=100, phase_speed=0.25, rng=None,
                  radius=0.012, amp=0.035):
    """n wavy lines rising at center (world). Animated grow-in, wiggle, fade-out."""
    rng = rng or random.Random(1)
    objs = []
    for i in range(n):
        off = Vector(((i - (n - 1) / 2) * spread, rng.uniform(-0.03, 0.03), 0))
        o = make_stink(f"{prefix}_{i}", C, Vector(center) + off, height * rng.uniform(0.85, 1.15), amp, radius)
        ph0 = rng.uniform(0, 6.28)
        key_stink(o, f_in - 1, phase=ph0, grow=0.0, alpha=0.0)
        key_stink(o, f_in + 6, grow=1.0, alpha=0.8)
        key_stink(o, f_out - 5, alpha=0.8)
        key_stink(o, f_out, alpha=0.0)
        o.scale = (1, 1, 1); o.keyframe_insert("scale", frame=f_out - 5)
        o.scale = (0.2, 0.2, 0.0); o.keyframe_insert("scale", frame=f_out)
        o.scale = (1, 1, 1)
        key_stink(o, f_out, phase=ph0 - (f_out - f_in) * phase_speed)
        for fc in lib.fcurves_of(o):
            if fc.data_path.endswith(gn_input_id(o.modifiers["Stink"].node_group, "Phase") + ".value"):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        # rise motion
        o.keyframe_insert("location", frame=f_in)
        o.location.z += 0.12
        o.keyframe_insert("location", frame=f_out)
        o.location.z -= 0.12
        lib.visible_between(o, f_in - 1, f_out + 1)
        objs.append(o)
    return objs


# ---------------------------------------------------------------- foam
def foam_cluster(name, C, radius=0.24, n=26, seed=3, blob_r=0.035):
    rng = random.Random(seed)
    bm = bmesh.new()
    for i in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r = radius * math.sqrt(rng.uniform(0, 1))
        s = blob_r * rng.uniform(0.6, 1.4)
        res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=s)
        for v in res["verts"]:
            v.co = Vector((v.co.x + r * math.cos(a), v.co.y + r * math.sin(a), v.co.z * 0.45))
    o = lib.mesh_from_bmesh(name, bm, C)
    lib.assign(o, lib.mat("M_Foam", "#FBFBFB", rough=0.35, emit="#FFFFFF", emit_strength=0.15))
    return o


# ---------------------------------------------------------------- droplets
_drop_mesh = None


def droplet_mesh():
    global _drop_mesh
    if _drop_mesh is None:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        for v in bm.verts:
            if v.co.z > 0:
                v.co.z *= 1.35
        me = bpy.data.meshes.new("DropletMesh")
        bm.to_mesh(me); bm.free()
        for p in me.polygons:
            p.use_smooth = True
        me.materials.append(lib.mat("M_Droplet", "#DDEFFA", rough=0.05, emit="#E8F6FF", emit_strength=0.4, spec=1.0))
        _drop_mesh = me
    return _drop_mesh


def droplet(name, C, start, vel, f0, f_end, fps=30, size=0.011, g=-9.81, floor_z=None):
    """Ballistic droplet keyed every 2 frames from f0 to f_end."""
    o = bpy.data.objects.new(name, droplet_mesh())
    C.objects.link(o)
    o.visible_shadow = False
    start = Vector(start); vel = Vector(vel)
    o.scale = (0, 0, 0)
    o.keyframe_insert("scale", frame=f0 - 1)
    o.scale = (size, size, size)
    o.keyframe_insert("scale", frame=f0)
    f = f0
    alive_end = f_end
    while f <= f_end:
        t = (f - f0) / fps
        p = start + vel * t + Vector((0, 0, 0.5 * g * t * t))
        if floor_z is not None and p.z < floor_z:
            alive_end = f
            break
        o.location = p
        o.keyframe_insert("location", frame=f)
        f += 2
    o.scale = (size, size, size)
    o.keyframe_insert("scale", frame=alive_end - 1)
    o.scale = (0, 0, 0)
    o.keyframe_insert("scale", frame=alive_end)
    lib.visible_between(o, f0 - 1, alive_end + 1)
    return o


# ---------------------------------------------------------------- poof cloud
def poof_mesh():
    me = bpy.data.meshes.get("PoofMesh")
    if me:
        return me
    rng = random.Random(11)
    bm = bmesh.new()
    for i in range(11):
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 1))).normalized() * rng.uniform(0.25, 0.6)
        if i == 0:
            d = Vector((0, 0, 0))
        res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=rng.uniform(0.35, 0.55) if i else 0.6)
        for v in res["verts"]:
            v.co += d
    me = bpy.data.meshes.new("PoofMesh")
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(lib.mat("M_Poof", "#F4F4F2", rough=0.9, emit="#FFFFFF", emit_strength=0.35))
    return me


def poof(name, C, loc, f0, size=0.9, dur=12):
    o = bpy.data.objects.new(name, poof_mesh())
    C.objects.link(o)
    o.location = loc
    o.visible_shadow = False
    o.rotation_euler = (0, 0, random.uniform(0, 6.28))
    for f, s in [(f0 - 1, 0.0), (f0, 0.25), (f0 + 3, 1.0), (f0 + 6, 1.12), (f0 + dur, 0.0)]:
        o.scale = (size * s,) * 3
        o.keyframe_insert("scale", frame=f)
    o.keyframe_insert("rotation_euler", frame=f0)
    o.rotation_euler.z += 0.8
    o.keyframe_insert("rotation_euler", frame=f0 + dur)
    lib.visible_between(o, f0 - 1, f0 + dur + 1)
    return o


# ---------------------------------------------------------------- liquid stream
def stream(name, C, top, bottom, radius=0.012, color="#2E7FD0", emit=0.3, alpha=1.0):
    """A vertical-ish cylinder from top to bottom (world). Origin at top so scale Z = length factor."""
    m = lib.mat("M_" + name, color, rough=0.08, emit=color, emit_strength=emit, alpha=alpha, spec=1.0)
    top, bottom = Vector(top), Vector(bottom)
    L = (top - bottom).length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=radius, radius2=radius * 0.8, depth=1.0)
    for v in bm.verts:
        v.co.z -= 0.5  # top at z=0, bottom at z=-1
        # wobble
    o = lib.mesh_from_bmesh(name, bm, C)
    lib.assign(o, m)
    o.location = top
    d = (bottom - top).normalized()
    o.rotation_euler = (-d).to_track_quat('Z', 'Y').to_euler()
    o.scale = (1, 1, L)
    o.visible_shadow = False
    return o


def spin_lines(name, C, center, radius=0.55, n=4, y=-0.36):
    """White motion arcs around drum front (local to given parent after creation)."""
    m = lib.mat("M_SpinLine", "#FFFFFF", rough=0.5, emit="#FFFFFF", emit_strength=1.2)
    objs = []
    root = bpy.data.objects.new(name, None)
    C.objects.link(root)
    root.location = center
    for k in range(n):
        cu = bpy.data.curves.new(f"{name}_{k}", 'CURVE'); cu.dimensions = '3D'
        sp = cu.splines.new('POLY')
        a0 = 2 * math.pi * k / n
        pts = 14
        sp.points.add(pts - 1)
        rr = radius + (k % 2) * 0.05
        for i in range(pts):
            a = a0 + math.radians(55) * i / (pts - 1)
            sp.points[i].co = (rr * math.cos(a), y, rr * math.sin(a), 1)
            sp.points[i].radius = math.sin(math.pi * i / (pts - 1)) + 0.05
        cu.bevel_depth = 0.008
        cu.bevel_resolution = 1
        o = bpy.data.objects.new(f"{name}_{k}", cu)
        C.objects.link(o)
        o.data.materials.append(m)
        o.parent = root
        o.visible_shadow = False
        objs.append(o)
    return root


def money_sign(name, C, loc, size=0.22):
    font_path = "/usr/share/fonts/opentype/montserrat/Montserrat-ExtraBold.otf"
    cu = bpy.data.curves.new(name, 'FONT')
    try:
        cu.font = bpy.data.fonts.load(font_path, check_existing=True)
    except Exception as e:
        print("font load", e)
    cu.body = "$"
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = 0.04
    cu.bevel_depth = 0.008
    cu.size = size
    o = bpy.data.objects.new(name, cu)
    C.objects.link(o)
    o.location = loc
    o.rotation_euler = (math.radians(90), 0, 0)
    o.data.materials.append(lib.mat("M_Money", "#2FBF4A", rough=0.3, emit="#3DDC5A", emit_strength=0.6, metal=0.2))
    o.visible_shadow = False
    return o
