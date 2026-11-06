"""Helpers for build_scene.py: asset import/normalisation, materials, actors, cameras, keyframes."""
import math
import os

import bpy
from mathutils import Euler, Matrix, Vector

import rigpose as rp

FPS = 30


def F(t):
    """time (s) -> frame (frame 1 shows t=0)"""
    return int(round(t * FPS)) + 1


# ------------------------------------------------------------------ assets
def _bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def import_model(path, name, size, axis="z", coll=None):
    """Import a glTF/GLB, put it under an empty `name` whose origin is the bottom centre,
    scaled so that the bbox extent along `axis` ('z', 'x', 'y' or 'max') equals `size` metres."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    mn, mx = _bbox(new)
    ext = mx - mn
    cur = {"x": ext.x, "y": ext.y, "z": ext.z, "max": max(ext)}[axis]
    s = size / cur
    root = bpy.data.objects.new(name, None)
    (coll or bpy.context.scene.collection).objects.link(root)
    bc = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        (coll or bpy.context.scene.collection).objects.link(o)
        if o.parent is None:
            o.parent = root
            o.location = o.location - bc
        if o.type == "MESH":
            o.name = f"{name}__{o.name}"
    root.scale = (s, s, s)
    root["size"] = [ext.x * s, ext.y * s, ext.z * s]
    bpy.context.view_layer.update()
    return root


def meshes(root):
    return [o for o in root.children_recursive if o.type == "MESH"]


def local_points(root):
    """All mesh vertices in root space (scaled, before root rotation/translation)."""
    inv = root.matrix_world.inverted()
    pts = []
    for o in meshes(root):
        m = inv @ o.matrix_world
        pts += [m @ v.co for v in o.data.vertices]
    S = Matrix.Diagonal(root.scale.to_4d())
    return [S @ p for p in pts]


def chair_info(root):
    """Seat height (largest upward-facing area between 0.3 and 0.8 m) and front direction."""
    inv = root.matrix_world.inverted()
    S = Matrix.Diagonal(root.scale.to_4d())
    bins, pts = {}, []
    for o in meshes(root):
        m = S @ inv @ o.matrix_world
        n3 = m.to_3x3()
        for poly in o.data.polygons:
            c = m @ poly.center
            nz = (n3 @ poly.normal).normalized().z
            area = poly.area * (root.scale.x ** 2)
            if nz > 0.85 and 0.3 < c.z < 0.8 and abs(c.x) < 0.2 and abs(c.y) < 0.2:   # central = seat, not armrests
                k = round(c.z * 100)
                bins[k] = bins.get(k, 0.0) + area
        vs = o.data.vertices
        pts += [m @ vs[i].co for i in range(0, len(vs), 7)]
    if bins:   # highest of the substantial horizontal surfaces (the top of a seat cushion, not the frame under it)
        top_area = max(bins.values())
        seat = max(k for k, v in bins.items() if v > 0.35 * top_area) / 100.0
    else:
        seat = 0.46
    H = max(p.z for p in pts)
    top = [p for p in pts if p.z > max(seat + 0.25, 0.75 * H)]
    back = Vector((sum(p.x for p in top) / len(top), sum(p.y for p in top) / len(top))) if top else Vector((0, 0.1))
    front = -back.normalized() if back.length > 0.02 else Vector((0, -1))
    yaw = -math.pi / 2 - math.atan2(front.y, front.x)      # rotation that makes the front face -Y
    q = round(yaw / (math.pi / 2)) * (math.pi / 2)          # snap to 90 degrees when close
    if abs(q - yaw) < math.radians(20):
        yaw = q
    root["seat_z"] = seat
    root["front_yaw"] = yaw
    return seat, yaw


def place(obj, x, y, z=0.0, face=0.0):
    """face: world facing angle of the object's front (0 = -Y, pi = +Y, -pi/2 = -X, pi/2 = +X)."""
    obj.location = (x, y, z)
    obj.rotation_euler = (0, 0, obj.get("front_yaw", 0.0) + face)


def face_dir(dx, dy):
    return math.atan2(dx, -dy)


def key_obj(obj, f, loc=None, rot=None, scale=None, interp=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=f)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=f)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert("scale", frame=f)


def key_visible(objs, f, visible):
    for o in objs:
        o.hide_render = not visible
        o.hide_viewport = False
        o.keyframe_insert("hide_render", frame=f)


def constant_interp(obj, path_prefix="hide_render"):
    ad = obj.animation_data
    if ad and ad.action:
        for fc in iter_fcurves(ad.action):
            if fc.data_path.startswith(path_prefix):
                for k in fc.keyframe_points:
                    k.interpolation = "CONSTANT"


def iter_fcurves(action):
    if hasattr(action, "fcurves") and len(getattr(action, "fcurves", [])):
        yield from action.fcurves
        return
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


# ------------------------------------------------------------------ materials
def pbr_material(name, texdir, scale=1.0, tint=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    files = os.listdir(texdir)
    def img(tag, non_color=False):
        f = next((x for x in files if tag in x.lower()), None)
        if not f:
            return None
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(texdir, f), check_existing=True)
        if non_color:
            n.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n
    d = img("diff")
    if d:
        if tint:
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(d.outputs["Color"], mix.inputs[6])
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            nt.links.new(d.outputs["Color"], bsdf.inputs["Base Color"])
    r = img("rough", True)
    if r:
        nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    n = img("nor_gl", True)
    if n:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def flat_material(name, color, rough=0.5, metallic=0.0, alpha=1.0, emission=None, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Alpha"].default_value = alpha
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission
    if emission:
        b.inputs["Emission Color"].default_value = (*emission[0], 1)
        b.inputs["Emission Strength"].default_value = emission[1]
    if alpha < 1.0:
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    return m


def box(name, size, loc, mat, coll=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    if coll:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    return o


def uv_box_project(o, unit=1.0):
    """World-scaled cube UVs so tiled textures keep real-world size."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = o.matrix_world @ l.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u / unit, v / unit)
    bm.to_mesh(o.data)
    bm.free()


# ------------------------------------------------------------------ actors
NOSE = Vector((0.0, 0.085, 0.105))   # in Head-bone space: up the bone, forward of the face


class Actor:
    def __init__(self, name):
        self.name = name
        self.rig = bpy.data.objects[f"{name}_rig"]
        self.objs = list(bpy.data.collections[f"CHR_{name}"].objects)
        self.rig.rotation_mode = "XYZ"

    def _solve(self, pose, loc, yaw, tilt=0.0):
        basis, posed = rp.solve(self.rig, pose)
        M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(tilt, 4, "X")
        return basis, posed, M

    def point(self, posed, M, short, at="head", offset=None):
        if offset is not None:
            return M @ (posed[rp.P + short] @ offset)
        return rp.bone_point(self.rig, posed, short, at, M)

    def ground_offset(self, posed, M):
        zs = [self.point(posed, M, "LeftToeBase", "tail").z, self.point(posed, M, "RightToeBase", "tail").z,
              self.point(posed, M, "LeftFoot").z - 0.062, self.point(posed, M, "RightFoot").z - 0.062]
        return min(zs)

    def key(self, f, pose, loc, yaw, ground=True, hips=None, nose=None, tilt=0.0, zoff=0.0):
        """Key a full-body pose. loc = (x, y[, z]); ground=True puts the lowest foot on z=0.
        hips=(x,y,z): place so the Hips joint lands there (sitting).  nose=(x,y,z): place the nose there."""
        loc = Vector((loc[0], loc[1], loc[2] if len(loc) > 2 else 0.0))
        basis, posed, M = self._solve(pose, loc, yaw, tilt)
        if hips is not None:
            h = self.point(posed, M, "Hips")
            loc += Vector(hips) - h
        elif nose is not None:
            n = self.point(posed, M, "Head", offset=NOSE)
            loc += Vector(nose) - n
        elif ground:
            loc.z -= self.ground_offset(posed, M)
        loc.z += zoff
        self.rig.location = loc
        self.rig.rotation_euler = (tilt, 0, yaw)
        self.rig.keyframe_insert("location", frame=f)
        self.rig.keyframe_insert("rotation_euler", frame=f)
        for name, q in basis.items():
            pb = self.rig.pose.bones[name]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f, group=name)
        return loc

    def nose_world(self, pose, loc, yaw):
        basis, posed, M = self._solve(pose, Vector((*loc[:2], 0)), yaw)
        return self.point(posed, M, "Head", offset=NOSE)

    def hand_world(self, pose, loc, yaw, side="Right"):
        basis, posed, M = self._solve(pose, Vector((*loc[:2], 0)), yaw)
        return self.point(posed, M, side + "Hand", "tail")

    def walk(self, f0, f1, p0, p1, cycle=None, step=0.36, face=None):
        """Walk (or sneak) from p0 to p1 between frames f0..f1, stepping every `step` seconds."""
        import poses as PZ
        cycle = cycle or PZ.WALK
        p0, p1 = Vector((*p0[:2], 0)), Vector((*p1[:2], 0))
        yaw = face if face is not None else face_dir(*(p1 - p0)[:2])
        n = max(2, int(round((f1 - f0) / (step * FPS / 2))))
        for i in range(n + 1):
            t = i / n
            f = int(round(f0 + (f1 - f0) * t))
            self.key(f, cycle[i % 4], p0.lerp(p1, t), yaw)
        return yaw


def look_at(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def make_camera(name, f0, f1, loc, target, lens=35, push=0.0, coll=None, shift_y=0.0):
    cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
    (coll or bpy.context.scene.collection).objects.link(cam)
    cam.data.lens = lens
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 36
    cam.data.clip_start = 0.02
    cam.data.clip_end = 60
    cam.data.shift_y = shift_y
    loc, target = Vector(loc), Vector(target)
    cam.location = loc
    look_at(cam, target)
    cam.keyframe_insert("location", frame=f0)
    cam.keyframe_insert("rotation_euler", frame=f0)
    if push:
        cam.location = loc.lerp(target, push)
        look_at(cam, target)
    cam.keyframe_insert("location", frame=f1)
    cam.keyframe_insert("rotation_euler", frame=f1)
    m = bpy.context.scene.timeline_markers.new(name, frame=f0)
    m.camera = cam
    return cam
