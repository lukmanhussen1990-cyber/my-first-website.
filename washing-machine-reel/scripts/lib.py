"""Generic Blender helpers (materials, primitives, keyframes)."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler


def srgb(h):
    """hex -> linear rgba"""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (lin[0], lin[1], lin[2], 1.0)


def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(obj, collection):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mat(name, color="#ffffff", rough=0.5, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0, spec=0.5,
        coat=0.0, blended=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    col = srgb(color) if isinstance(color, str) else color
    p.inputs["Base Color"].default_value = col
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec
    if coat:
        p.inputs["Coat Weight"].default_value = coat
    if emit is not None:
        p.inputs["Emission Color"].default_value = srgb(emit) if isinstance(emit, str) else emit
        p.inputs["Emission Strength"].default_value = emit_strength
    p.inputs["Alpha"].default_value = alpha
    if blended or alpha < 1.0:
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = col
    return m


def principled(m):
    return m.node_tree.nodes.get("Principled BSDF")


def assign(obj, m, slot=None):
    if slot is None:
        obj.data.materials.clear()
        obj.data.materials.append(m)
    else:
        while len(obj.data.materials) <= slot:
            obj.data.materials.append(m)
        obj.data.materials[slot] = m
    return obj


def new_obj(name, mesh, collection=None):
    o = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(o)
    return o


def mesh_from_bmesh(name, bm, collection=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return new_obj(name, me, collection)


def lathe(name, profile, segments=48, collection=None, smooth=True, cap_bottom=False):
    """profile: list of (r, z) from bottom to top -> revolved mesh around Z."""
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile]
        rings.append(ring)
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            try:
                bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
            except ValueError:
                pass
    if cap_bottom:
        bm.faces.new([rings[i][0] for i in range(segments)][::-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, bm, collection, smooth)


def box(name, size, loc=(0, 0, 0), collection=None, bevel=0.0, segs=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = mesh_from_bmesh(name, bm, collection, smooth=False)
    o.location = loc
    if bevel > 0:
        m = o.modifiers.new("Bevel", 'BEVEL')
        m.width = bevel
        m.segments = segs
        m.limit_method = 'ANGLE'
        o.data.shade_smooth() if hasattr(o.data, "shade_smooth") else None
    return o


def cylinder(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), verts=32, collection=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r, radius2=r, depth=depth)
    o = mesh_from_bmesh(name, bm, collection, smooth=True)
    o.location = loc
    o.rotation_euler = rot
    # auto smooth via sharp edges at caps: use split normals by angle
    return o


def torus(name, R, r, loc=(0, 0, 0), rot=(0, 0, 0), maj=48, minr=12, collection=None, arc=2 * math.pi):
    bm = bmesh.new()
    rings = []
    full = abs(arc - 2 * math.pi) < 1e-6
    n_maj = maj if full else maj + 1
    for i in range(n_maj):
        a = arc * i / maj
        c = Vector((R * math.cos(a), R * math.sin(a), 0))
        ring = []
        for j in range(minr):
            b = 2 * math.pi * j / minr
            d = Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b)))
            ring.append(bm.verts.new(c + d * r))
        rings.append(ring)
    for i in range(maj if full else maj):
        r0, r1 = rings[i], rings[(i + 1) % n_maj]
        for j in range(minr):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % minr], r0[(j + 1) % minr]))
    o = mesh_from_bmesh(name, bm, collection, smooth=True)
    o.location = loc
    o.rotation_euler = rot
    return o


def icosphere(name, r, subd=3, loc=(0, 0, 0), collection=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subd, radius=r)
    o = mesh_from_bmesh(name, bm, collection, smooth=True)
    o.location = loc
    return o


def smooth_by_angle(o, angle=40):
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception as e:
        print("smooth_by_angle failed", o.name, e)


# ------------------------------------------------------------------ keyframes
def key(obj, path, frame, value=None, index=-1, interp=None):
    if value is not None:
        attr = obj
        parts = path.split(".")
        for p in parts[:-1]:
            attr = getattr(attr, p)
        if index >= 0:
            getattr(attr, parts[-1])[index] = value
        else:
            setattr(attr, parts[-1], value)
    obj.keyframe_insert(data_path=path, frame=frame, index=index)
    if interp:
        set_interp(obj, path, interp, frame)


def set_interp(idblock, path, interp, frame=None):
    ad = idblock.animation_data
    if not ad or not ad.action:
        return
    for fc in fcurves_of(idblock):
        if fc.data_path == path:
            for kp in fc.keyframe_points:
                if frame is None or abs(kp.co.x - frame) < 0.01:
                    kp.interpolation = interp


def fcurves_of(idblock):
    """Return fcurves of the active action (layered-action aware, Blender 4.4+/5.x)."""
    ad = idblock.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        slot = ad.action_slot
        for layer in act.layers:
            for strip in layer.strips:
                cb = strip.channelbag(slot)
                if cb:
                    return list(cb.fcurves)
    except Exception:
        pass
    try:
        return list(act.fcurves)
    except Exception:
        return []


def hide_key(obj, frame, hidden):
    obj.hide_render = hidden
    obj.hide_viewport = hidden
    obj.keyframe_insert("hide_render", frame=frame)
    obj.keyframe_insert("hide_viewport", frame=frame)
    for fc in fcurves_of(obj):
        if fc.data_path in ("hide_render", "hide_viewport"):
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def visible_between(obj, f0, f1, total_end=10000):
    """Visible only in [f0, f1)."""
    if f0 > 0:
        hide_key(obj, 0, True)
    hide_key(obj, f0, False)
    if f1 < total_end:
        hide_key(obj, f1, True)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)
