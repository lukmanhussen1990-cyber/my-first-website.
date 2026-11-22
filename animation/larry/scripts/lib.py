"""Shared helpers for building the Larry shots (run inside Blender)."""
import bpy, os, math, random
from mathutils import Vector, Matrix, Euler, Quaternion
import mocap, polyhaven

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.environ.get("LARRY_WORK", os.path.expanduser("~/larry_work"))
CHARDIR = os.path.join(SCRATCH, "chars")
DECALS = os.path.join(SCRATCH, "decals")
CMU = "/opt/cmu/amc"
FPS = 24
STEP = 120 // FPS  # CMU is 120 fps


def scene():
    return bpy.context.scene


def reset(samples=6):
    bpy.ops.wm.read_homefile(use_empty=True)
    sc = scene()
    sc.render.fps = FPS
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    ee = sc.eevee
    ee.taa_render_samples = samples
    ee.use_shadow_jitter_viewport = False
    ee.shadow_ray_count = 1
    ee.shadow_step_count = 4
    ee.use_raytracing = False
    ee.shadow_resolution_scale = 0.5
    ee.fast_gi_method = "AMBIENT_OCCLUSION_ONLY"
    ee.use_volumetric_shadows = False
    sc.render.resolution_x, sc.render.resolution_y = 720, 1280
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"
    sc.render.film_transparent = False
    return sc


# ----------------------------------------------------------------------------- characters
class Char:
    def __init__(self, name, rig, objs):
        self.name, self.rig, self.objs = name, rig, objs
        self.body = next(o for o in objs if ".body" in o.name)
        self.meshes = [o for o in objs if o.type == "MESH"]

    # --- animation
    def clip(self, clip, start=0, end=None, speed=1.0, in_place=False, offset=0, yaw=0.0, name=None, face=True):
        subj = clip.split("_")[0]
        act = mocap.retarget(self.rig, f"{CMU}/{subj}.asf", f"{CMU}/{clip}.amc", name or f"{self.name}_{clip}",
                             start=start, end=end, step=STEP, speed=speed, in_place=in_place, yaw_deg=yaw, face=face)
        if offset:
            for fc in act.fcurves:
                for kp in fc.keyframe_points:
                    kp.co.x += offset
        self.rig.animation_data_create()
        self.rig.animation_data.action = act
        return act

    def hold(self, clip, src_frame, yaw=0.0, face=True):
        """Static pose taken from one mocap frame (in place)."""
        act = self.clip(clip, start=src_frame, end=src_frame + 1, in_place=True, yaw=yaw,
                        name=f"{self.name}_{clip}_{src_frame}", face=face)
        return act

    def tpose(self):
        """ASF rest pose (T-pose) as a static pose."""
        sk = mocap.parse_asf(f"{CMU}/07.asf")
        import tempfile
        p = os.path.join(tempfile.gettempdir(), "zero.amc")
        if not os.path.exists(p):
            names = [n for n in sk["order"] if n != "root"]
            lines = [":FULLY-SPECIFIED", ":DEGREES", "1", "root 0 17 0 0 0 0"]
            for n in names:
                lines.append(n + " " + " ".join("0" for _ in sk["bones"][n]["dof"]))
            open(p, "w").write("\n".join(lines) + "\n")
        act = mocap.retarget(self.rig, f"{CMU}/07.asf", p, f"{self.name}_tpose", step=1, in_place=True)
        self.rig.animation_data_create(); self.rig.animation_data.action = act
        return act

    def bone_rot(self, bone, frame, euler_deg, mode="XYZ"):
        """Add a local rotation offset to a pose bone via a second action layer (NLA-free: keyframe on top)."""
        pb = self.rig.pose.bones[bone]
        q = Euler([math.radians(a) for a in euler_deg], mode).to_quaternion()
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=frame)

    # --- face
    def expr(self, frame, values, interp="BEZIER"):
        """Keyframe ARKit face units on every mesh that has them. values: {name: weight}."""
        for o in self.meshes:
            sk = o.data.shape_keys
            if not sk:
                continue
            for k, v in values.items():
                kb = sk.key_blocks.get(k)
                if kb is None:
                    continue
                kb.value = v
                kb.keyframe_insert("value", frame=frame)

    def expr_hold(self, values, f0=1, f1=None):
        self.expr(f0, values)
        if f1:
            self.expr(f1, values)

    # --- constraints
    def ik(self, bone, target, chain=2, pole=None, influence=1.0):
        pb = self.rig.pose.bones[bone]
        c = pb.constraints.new("IK")
        c.target = target
        c.chain_count = chain
        c.influence = influence
        if pole is not None:
            c.pole_target = pole
            c.pole_angle = math.radians(-90)
        return c

    def world(self, bone, tail=False, frame=None):
        if frame is not None:
            scene().frame_set(frame)
        bpy.context.view_layer.update()
        pb = self.rig.pose.bones[bone]
        return self.rig.matrix_world @ (pb.tail if tail else pb.head)

    def attach(self, obj, bone, keep_world=True):
        """Parent obj to a bone (Child Of constraint, set inverse at current frame)."""
        c = obj.constraints.new("CHILD_OF")
        c.target = self.rig
        c.subtarget = bone
        if hasattr(c, "set_inverse_pending"):
            c.set_inverse_pending = False
        bpy.context.view_layer.update()
        if keep_world:
            c.inverse_matrix = (self.rig.matrix_world @ self.rig.pose.bones[bone].matrix).inverted()
        else:
            c.inverse_matrix = Matrix.Identity(4)
        return c

    def bake_follow(self, obj, bone, n, offset=(0, 0, 0), local=False, extra=None, tail=False):
        """Keyframe obj's world location to follow a bone (+offset) for frames 1..n."""
        sc = scene()
        for f in range(1, n + 1):
            sc.frame_set(f)
            pb = self.rig.pose.bones[bone]
            M = self.rig.matrix_world @ pb.matrix
            base = self.rig.matrix_world @ (pb.tail if tail else pb.head)
            off = Vector(offset)
            if local:
                off = M.to_3x3() @ off
            if extra:
                off = off + Vector(extra(f))
            obj.location = base + off
            obj.keyframe_insert("location", frame=f)
        sc.frame_set(1)

    def subdiv(self, on=True):
        for o in self.meshes:
            for md in o.modifiers:
                if md.type == "SUBSURF":
                    md.render_levels = 1 if on else 0
                    md.levels = 0

    def tint_skin(self, rgb, factor=1.0):
        """Multiply skin colour (used for the rage face)."""
        mats = [m for m in self.body.data.materials if m]
        for m in mats:
            nt = m.node_tree
            out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
            sh = out.inputs["Surface"].links[0].from_socket
            mix = nt.nodes.new("ShaderNodeMixShader")
            em = nt.nodes.new("ShaderNodeBsdfDiffuse"); em.inputs["Color"].default_value = (*rgb, 1)
            mix.inputs["Fac"].default_value = factor
            nt.links.new(sh, mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs["Surface"])
        return mats

    def set_color(self, fragment, rgb):
        for o in self.meshes:
            if fragment in o.name.lower():
                for m in o.data.materials:
                    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m and m.use_nodes else None
                    if b:
                        mixes = [n for n in m.node_tree.nodes if n.type == "MIX" and n.blend_type == "MULTIPLY"]
                        if mixes:
                            mixes[-1].inputs[7].default_value = (*rgb, 1)
                        else:
                            for l in list(b.inputs["Base Color"].links):
                                m.node_tree.links.remove(l)
                            b.inputs["Base Color"].default_value = (*rgb, 1)

    def hide(self, fragment):
        for o in self.meshes:
            if fragment in o.name.lower():
                o.hide_render = True


def load_char(name, loc=(0, 0, 0), rot_z=0.0, scale=1.0, subdiv=False, tag=None):
    sc = scene()
    with bpy.data.libraries.load(f"{CHARDIR}/{name}.blend", link=False) as (src, dst):
        dst.objects = src.objects
    coll = bpy.data.collections.new(tag or name)
    sc.collection.children.link(coll)
    objs = [o for o in dst.objects if o is not None]
    for o in objs:
        coll.objects.link(o)
    rig = next(o for o in objs if o.type == "ARMATURE")
    rig.location = Vector(loc)
    rig.rotation_euler = (0, 0, math.radians(rot_z))
    rig.scale = (scale, scale, scale)
    mocap.ensure_quaternion(rig)
    ch = Char(tag or name, rig, objs)
    ch.subdiv(subdiv)
    return ch


# ----------------------------------------------------------------------------- objects & materials
def empty(name="target", loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = Vector(loc)
    scene().collection.objects.link(e)
    return e


def mat_flat(name, rgb, rough=0.6, metal=0.0, emit=None, emit_strength=1.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    return m


def mat_tex(name, tex_id, scale=1.0, tint=None, rough_mult=1.0, normal_strength=1.0, rot=0.0):
    """PBR material from a Poly Haven texture set; object-space box-ish mapping via UV*scale."""
    maps = polyhaven.texture(tex_id)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale) if not isinstance(scale, (tuple, list)) else (*scale, 1)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot))
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    def img(path, non_color=False):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            t.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], t.inputs[0])
        return t
    if "diffuse" in maps:
        d = img(maps["diffuse"])
        if tint:
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(d.outputs[0], mix.inputs[6]); nt.links.new(mix.outputs[2], b.inputs["Base Color"])
        else:
            nt.links.new(d.outputs[0], b.inputs["Base Color"])
    if "rough" in maps:
        r = img(maps["rough"], True)
        if rough_mult != 1.0:
            mm = nt.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY"; mm.inputs[1].default_value = rough_mult
            nt.links.new(r.outputs[0], mm.inputs[0]); nt.links.new(mm.outputs[0], b.inputs["Roughness"])
        else:
            nt.links.new(r.outputs[0], b.inputs["Roughness"])
    elif "arm" in maps:
        a = img(maps["arm"], True)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(a.outputs[0], sep.inputs[0]); nt.links.new(sep.outputs[1], b.inputs["Roughness"])
    if "nor_gl" in maps and normal_strength > 0:
        n = img(maps["nor_gl"], True)
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs[0], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
    return m


def mat_image(name, path, rough=0.5, emit=0.0, alpha=False):
    """Material showing a single image (decals, signs, documents)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    t.extension = "CLIP"
    nt.links.new(t.outputs[0], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if emit:
        nt.links.new(t.outputs[0], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    if alpha:
        nt.links.new(t.outputs[1], b.inputs["Alpha"])
        m.blend_method = "HASHED" if hasattr(m, "blend_method") else m.blend_method
    return m


def box(name, size, loc, mat=None, rot=(0, 0, 0), bevel=0.0, uv_scale=1.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=[math.radians(a) for a in rot])
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _cube_uv(o, uv_scale)
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 2
    if mat:
        o.data.materials.append(mat)
    return o


def _cube_uv(o, s=1.0):
    """World-size box projection UVs so textures keep real-world scale (1 UV unit = 1 m / s)."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new()
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                uv[li].uv = (v.y * s, v.z * s)
            elif ax == 1:
                uv[li].uv = (v.x * s, v.z * s)
            else:
                uv[li].uv = (v.x * s, v.y * s)


def plane(name, size, loc, mat=None, rot=(0, 0, 0), uv_scale=1.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=[math.radians(a) for a in rot])
    o = bpy.context.object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _cube_uv(o, uv_scale)
    if mat:
        o.data.materials.append(mat)
    return o


def decal(name, img_path, width, loc, rot=(90, 0, 0), emit=0.0, rough=0.5, alpha=False):
    """Vertical image card with correct aspect (width in metres)."""
    im = bpy.data.images.load(img_path, check_existing=True)
    h = width * im.size[1] / im.size[0]
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=[math.radians(a) for a in rot])
    o = bpy.context.object
    o.name = name
    o.scale = (width, h, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat_image(name + "_m", img_path, rough=rough, emit=emit, alpha=alpha))
    return o


def cylinder(name, radius, depth, loc, mat=None, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc,
                                        rotation=[math.radians(a) for a in rot])
    o = bpy.context.object
    o.name = name
    if mat:
        o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def model_copy(root, loc=(0, 0, 0), rot_z=0.0):
    """Linked duplicate of an appended model root (shares mesh data)."""
    new_root = empty(root.name + "_cp", loc)
    new_root.rotation_euler = (0, 0, math.radians(rot_z))
    new_root.scale = root.scale.copy()
    for o in root.children:
        c = o.copy()
        scene().collection.objects.link(c)
        c.parent = new_root
    return new_root


def model(asset_id, loc=(0, 0, 0), rot_z=0.0, scale=1.0, name=None):
    """Append a Poly Haven model; returns a parent empty controlling all its objects."""
    path = polyhaven.model(asset_id)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = src.objects
    root = empty(name or asset_id, loc)
    root.rotation_euler = (0, 0, math.radians(rot_z))
    root.scale = (scale, scale, scale)
    for o in dst.objects:
        if o is None:
            continue
        scene().collection.objects.link(o)
        if o.parent is None:
            o.parent = root
    return root


def append_blend(path, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name="asset", filt=None):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if (filt is None or filt(n))]
    root = empty(name, loc)
    root.rotation_euler = [math.radians(a) for a in rot]
    root.scale = (scale, scale, scale)
    for o in dst.objects:
        if o is None or o.type in ("LIGHT", "CAMERA"):
            continue
        scene().collection.objects.link(o)
        if o.parent is None:
            o.parent = root
    return root


# ----------------------------------------------------------------------------- world, lights, camera
def world_hdri(hdri_id, strength=1.0, rot_z=0.0, tint=None):
    sc = scene()
    w = bpy.data.worlds.new("world")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(polyhaven.hdri(hdri_id), check_existing=True)
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_z))
    nt.links.new(tc.outputs["Generated"], mp.inputs[0]); nt.links.new(mp.outputs[0], env.inputs[0])
    if tint:
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1; mix.inputs[7].default_value = (*tint, 1)
        nt.links.new(env.outputs[0], mix.inputs[6]); nt.links.new(mix.outputs[2], bg.inputs[0])
    else:
        nt.links.new(env.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = strength
    return w


def world_color(rgb, strength=1.0):
    sc = scene()
    w = bpy.data.worlds.new("world")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*rgb, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = strength
    return w


def sun(energy=3.5, rot=(50, 0, 30), color=(1.0, 0.96, 0.9), angle=2.0, shadow=True):
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = energy
    d.color = color
    d.angle = math.radians(angle)
    d.use_shadow = shadow
    o = bpy.data.objects.new("sun", d)
    o.rotation_euler = [math.radians(a) for a in rot]
    scene().collection.objects.link(o)
    return o


def area(name, loc, target, energy=200, size=1.0, color=(1, 1, 1), shadow=False, shape="SQUARE", size_y=None):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.size = size
    d.shape = shape
    if size_y:
        d.shape = "RECTANGLE"; d.size_y = size_y
    d.color = color
    d.use_shadow = shadow
    o = bpy.data.objects.new(name, d)
    o.location = Vector(loc)
    scene().collection.objects.link(o)
    look_at(o, target)
    return o


def point(name, loc, energy=50, color=(1, 1, 1), radius=0.1, shadow=False):
    d = bpy.data.lights.new(name, "POINT")
    d.energy = energy
    d.color = color
    d.shadow_soft_size = radius
    d.use_shadow = shadow
    o = bpy.data.objects.new(name, d)
    o.location = Vector(loc)
    scene().collection.objects.link(o)
    return o


def look_at(obj, target):
    t = Vector(target) if not hasattr(target, "location") else target.location
    d = t - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


class Cam:
    """Camera with a look-at target; keyframe both for moves."""

    def __init__(self, lens=35, loc=(0, -5, 1.6), target=(0, 0, 1.4), dof=None, clip_end=500):
        sc = scene()
        self.cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        sc.collection.objects.link(self.cam)
        sc.camera = self.cam
        self.cam.data.lens = lens
        self.cam.data.sensor_width = 36
        self.cam.data.clip_end = clip_end
        self.cam.data.clip_start = 0.02
        self.tgt = empty("cam_target", target)
        self.cam.location = Vector(loc)
        c = self.cam.constraints.new("TRACK_TO")
        c.target = self.tgt
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
        if dof:
            self.cam.data.dof.use_dof = True
            self.cam.data.dof.focus_object = self.tgt
            self.cam.data.dof.aperture_fstop = dof

    def key(self, frame, loc=None, target=None, lens=None, interp="BEZIER"):
        if loc is not None:
            self.cam.location = Vector(loc)
            self.cam.keyframe_insert("location", frame=frame)
        if target is not None:
            self.tgt.location = Vector(target)
            self.tgt.keyframe_insert("location", frame=frame)
        if lens is not None:
            self.cam.data.lens = lens
            self.cam.data.keyframe_insert("lens", frame=frame)
        for ob in (self.cam, self.tgt, self.cam.data):
            ad = ob.animation_data
            if ad and ad.action:
                for fc in ad.action.fcurves:
                    for kp in fc.keyframe_points:
                        if kp.co.x == frame:
                            kp.interpolation = interp

    def roll(self, frame, deg):
        """Roll via a child offset: uses delta rotation around view axis (applied after track)."""
        self.cam.delta_rotation_euler = (0, 0, 0)
        # roll the up axis by rotating the track: emulate with constraint influence trick not needed; use scene camera roll
        self.cam.data["roll"] = deg

    def shake(self, f0, f1, amp=0.02, freq=0.35, seed=1):
        """Handheld/impact shake on target position between frames f0..f1 (noise modifier)."""
        if not self.tgt.animation_data or not self.tgt.animation_data.action:
            self.tgt.keyframe_insert("location", frame=f0)
        act = self.tgt.animation_data.action
        for i in range(3):
            fc = act.fcurves.find("location", index=i) or act.fcurves.new("location", index=i)
            if not fc.keyframe_points:
                fc.keyframe_points.insert(f0, self.tgt.location[i])
            md = fc.modifiers.new("NOISE")
            md.scale = 1.0 / max(freq, 0.01)
            md.strength = amp
            md.phase = seed * 7 + i * 13
            md.use_restricted_range = True
            md.frame_start, md.frame_end = f0, f1
            md.blend_in, md.blend_out = 1, 2


def set_frames(n):
    sc = scene()
    sc.frame_start = 1
    sc.frame_end = n


def hide_after(obj, frame):
    obj.hide_render = False
    obj.keyframe_insert("hide_render", frame=frame - 1)
    obj.hide_render = True
    obj.keyframe_insert("hide_render", frame=frame)


def fcurves_constant(obj):
    ad = obj.animation_data
    if ad and ad.action:
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"


def key_loc(obj, frame, loc, interp="BEZIER"):
    obj.location = Vector(loc)
    obj.keyframe_insert("location", frame=frame)
    _interp(obj, frame, interp)


def key_rot(obj, frame, rot_deg, interp="BEZIER"):
    obj.rotation_euler = [math.radians(a) for a in rot_deg]
    obj.keyframe_insert("rotation_euler", frame=frame)
    _interp(obj, frame, interp)


def key_scale(obj, frame, s, interp="BEZIER"):
    obj.scale = (s, s, s) if not isinstance(s, (tuple, list)) else s
    obj.keyframe_insert("scale", frame=frame)
    _interp(obj, frame, interp)


def _interp(obj, frame, interp):
    ad = obj.animation_data
    if ad and ad.action:
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 1e-3:
                    kp.interpolation = interp


# ----------------------------------------------------------------------------- model fitting & mesh edits
def bbox(root):
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    objs = [root] + list(root.children_recursive) if hasattr(root, "children_recursive") else [root]
    for o in objs:
        if o.type == "MESH":
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


def fit(root, height=None, length=None, ground=True):
    """Uniformly scale a model root so its height (or longest horizontal side) matches; sit it on z=root.z."""
    mn, mx = bbox(root)
    size = mx - mn
    s = 1.0
    if height:
        s = height / max(size.z, 1e-6)
    elif length:
        s = length / max(size.x, size.y, 1e-6)
    root.scale = root.scale * s
    if ground:
        drop_to(root, root.location.z)
    return s


def drop_to(root, z=0.0):
    mn, mx = bbox(root)
    root.location.z += z - mn.z


def remove_top(obj, frac=0.06):
    """Delete upward-facing faces near the top of a mesh (to open a box)."""
    import bmesh
    me = obj.data
    bm = bmesh.new(); bm.from_mesh(me)
    zmax = max(v.co.z for v in bm.verts); zmin = min(v.co.z for v in bm.verts)
    thr = zmax - (zmax - zmin) * frac
    kill = [f for f in bm.faces if f.normal.z > 0.6 and f.calc_center_median().z > thr]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(me); bm.free()
    return len(kill)


def first_material(root):
    for o in [root] + list(root.children_recursive):
        if o.type == "MESH" and o.data.materials:
            return o.data.materials[0]
    return None


def mesh_children(root):
    return [o for o in [root] + list(root.children_recursive) if o.type == "MESH"]
