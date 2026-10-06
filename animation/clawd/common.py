"""Small helpers shared by the Clawd park scene: colors, meshes, materials, keyframes."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


# ---------------------------------------------------------------- colors ---

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, alpha=1.0):
    """'#RRGGBB' -> linear RGBA tuple for shader inputs."""
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


# ---------------------------------------------------------- scene graph ---

def get_coll(name, parent=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def new_empty(name, parent=None, loc=(0, 0, 0), coll=None, size=0.1):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.parent = parent
    obj.location = loc
    return obj


def mesh_from_bm(name, bm, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    return me


def new_mesh_obj(name, bm_or_mesh, coll=None, parent=None, loc=(0, 0, 0),
                 mat=None, smooth=True):
    me = bm_or_mesh if isinstance(bm_or_mesh, bpy.types.Mesh) else mesh_from_bm(name, bm_or_mesh, smooth)
    if mat is not None and not me.materials:
        for m in (mat if isinstance(mat, (list, tuple)) else [mat]):
            me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.parent = parent
    obj.location = loc
    return obj


def bm_box(bm, size, center=(0, 0, 0), matrix=None):
    """Add an axis-aligned box to bm; optional matrix applied after sizing."""
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    c = Vector(center)
    for v in verts:
        co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        if matrix is not None:
            co = matrix @ co
        v.co = co + c
    return verts


def add_round(obj, bevel, segments=3, subd=2):
    """Soft toy-like rounded edges: bevel for support loops, then subdivision."""
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = bevel
    b.segments = segments
    b.limit_method = "NONE"
    if subd:
        s = obj.modifiers.new("Subd", "SUBSURF")
        s.levels = subd
        s.render_levels = subd
    return obj


def add_subd(obj, levels=2):
    s = obj.modifiers.new("Subd", "SUBSURF")
    s.levels = levels
    s.render_levels = levels
    return obj


def rot_x(a):
    return Matrix.Rotation(a, 4, "X")


def rot_y(a):
    return Matrix.Rotation(a, 4, "Y")


def rot_z(a):
    return Matrix.Rotation(a, 4, "Z")


# ------------------------------------------------------------- materials ---

def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat


def principled(name, base, rough=0.5, **inputs):
    """Principled BSDF material. Extra inputs use underscores for spaces,
    e.g. Coat_Weight=0.3, Subsurface_Weight=0.1."""
    mat = new_material(name)
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = base
    p.inputs["Roughness"].default_value = rough
    for key, val in inputs.items():
        p.inputs[key.replace("_", " ")].default_value = val
    mat.diffuse_color = base  # viewport/workbench color
    return mat


def node(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n


def link(nt, a, b):
    nt.links.new(a, b)


# ------------------------------------------------------------- animation ---

def smoothstep(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def ease_in_out(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)  # smootherstep


def ease_out_back(t, s=1.70158):
    t = min(1.0, max(0.0, t)) - 1.0
    return t * t * ((s + 1) * t + s) + 1.0


def ease_out_elastic(t, damp=6.0, freq=3.0):
    t = min(1.0, max(0.0, t))
    if t <= 0.0:
        return 0.0
    return 1.0 - math.exp(-damp * t) * math.cos(freq * 2 * math.pi * t)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_angle(a, b, t):
    d = (b - a + math.pi) % (2 * math.pi) - math.pi
    return a + d * t


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def window(t, t0, t1, ramp_in, ramp_out=None):
    """0 outside [t0,t1], eased ramps of given length at the ends, 1 inside."""
    ramp_out = ramp_in if ramp_out is None else ramp_out
    return smoothstep(t0, t0 + ramp_in, t) * (1.0 - smoothstep(t1 - ramp_out, t1, t))


def bake(obj, data_path, frames, values, interpolation="LINEAR"):
    """Insert one keyframe per frame. values: list of scalars or tuples."""
    prop = obj.path_resolve(data_path)
    is_vec = hasattr(prop, "__len__") and not isinstance(prop, str)
    for f, v in zip(frames, values):
        if is_vec:
            setattr_path(obj, data_path, v)
        else:
            setattr_path(obj, data_path, v)
        obj.keyframe_insert(data_path, frame=f)
    set_interpolation(obj, interpolation)


def setattr_path(obj, data_path, value):
    if "." in data_path or "[" in data_path:
        raise ValueError("simple data paths only")
    setattr(obj, data_path, value)


def iter_fcurves(id_data):
    ad = id_data.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    out = []
    # Blender 4.4+ layered actions
    if hasattr(act, "layers") and len(act.layers):
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend(bag.fcurves)
    elif hasattr(act, "fcurves"):
        out.extend(act.fcurves)
    return out


def set_interpolation(obj, interpolation="LINEAR"):
    for fc in iter_fcurves(obj):
        for kp in fc.keyframe_points:
            kp.interpolation = interpolation
