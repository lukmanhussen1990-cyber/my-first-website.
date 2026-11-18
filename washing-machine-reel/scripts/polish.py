"""Polish pass: procedural life, auto blinks, camera drift/punch-ins, HDRI world, better metals, extra FX."""
import bpy, math, random
from mathutils import Vector
import lib


def _fc(idblock, path, index):
    for fc in lib.fcurves_of(idblock):
        if fc.data_path == path and fc.array_index == index:
            return fc
    return None


def ensure_key(obj, path, index, frame=1):
    fc = _fc(obj, path, index)
    if fc is None:
        obj.keyframe_insert(path, index=index, frame=frame)
        fc = _fc(obj, path, index)
    return fc


def add_noise(fc, strength, scale, phase=None, offset=0.0):
    m = fc.modifiers.new('NOISE')
    m.strength = strength
    m.scale = scale
    m.phase = phase if phase is not None else random.uniform(0, 100)
    m.offset = offset
    return m


def add_sine(fc, amp, period_frames, phase=0.0):
    m = fc.modifiers.new('FNGENERATOR')
    m.function_type = 'SIN'
    m.amplitude = amp
    m.phase_multiplier = 2 * math.pi / period_frames
    m.phase_offset = phase
    m.use_additive = True
    return m


def life_noise(rig, k=1.0, seed=1):
    """Breathing + idle sway + head micro motion as additive F-curve modifiers on pose bones."""
    random.seed(seed)
    pb = rig.pose.bones
    spec = [
        ("spine_01", 0, 0.6, 70), ("spine_01", 2, 0.8, 90),
        ("spine_02", 0, 0.9, 60), ("spine_02", 2, 0.9, 80),
        ("spine_03", 1, 0.7, 75),
        ("neck_01", 0, 1.2, 45), ("neck_01", 1, 1.4, 55),
        ("head", 0, 1.6, 34), ("head", 1, 2.0, 40), ("head", 2, 1.2, 50),
    ]
    for bn, idx, deg, scale in spec:
        if bn not in pb:
            continue
        path = f'pose.bones["{bn}"].rotation_euler'
        fc = ensure_key(rig, path, idx)
        add_noise(fc, 2 * math.radians(deg) * k, scale)
    # breathing: chest pitch + shoulders up/down (period ~3.6 s)
    fc = ensure_key(rig, 'pose.bones["spine_03"].rotation_euler', 0)
    add_sine(fc, math.radians(0.9) * k, 108)
    for side, sgn in (("l", 1), ("r", -1)):
        bn = f"clavicle_{side}"
        if bn in pb:
            fc = ensure_key(rig, f'pose.bones["{bn}"].rotation_euler', 2)
            add_sine(fc, math.radians(1.1) * k * sgn, 108, phase=0.4)


def auto_blinks(rig, first=12, last=1650, gap=(66, 110), seed=5, avoid=()):
    """Insert blinks reading the existing eyeBlink curve so expressions keep their base value."""
    rng = random.Random(seed)
    owners = []
    for o in rig.children_recursive:
        if o.type == 'MESH' and o.data.shape_keys:
            kb = o.data.shape_keys.key_blocks
            if "eyeBlinkLeft" in kb or "eyeBlinkRight" in kb:
                owners.append(o.data.shape_keys)
    f = first
    frames = []
    while f < last:
        if all(abs(f - a) > 10 for a in avoid):
            frames.append(f)
        f += rng.randint(*gap)
    for key in owners:
        for unit in ("eyeBlinkLeft", "eyeBlinkRight"):
            if unit not in key.key_blocks:
                continue
            path = f'key_blocks["{unit}"].value'
            fc = None
            for c in lib.fcurves_of(key):
                if c.data_path == path:
                    fc = c
            kbk = key.key_blocks[unit]
            for bf in frames:
                b0 = fc.evaluate(bf - 1) if fc else 0.0
                b1 = fc.evaluate(bf + 6) if fc else 0.0
                if b0 > 0.6:
                    continue
                for ff, v in ((bf - 1, b0), (bf + 1, 1.0), (bf + 3, 1.0), (bf + 6, b1)):
                    kbk.value = v
                    key.keyframe_insert(path, frame=ff)
                if fc is None:
                    for c in lib.fcurves_of(key):
                        if c.data_path == path:
                            fc = c
    return frames


def camera_drift(cams, deg=0.35, scale=40):
    for i, cam in enumerate(cams):
        for idx in (0, 2):
            fc = ensure_key(cam, "rotation_euler", idx)
            add_noise(fc, 2 * math.radians(deg), scale, phase=i * 13.7 + idx * 5)


def lens_punch(cam, f0, f1, lens0, lens1):
    cam.data.lens = lens0
    cam.data.keyframe_insert("lens", frame=f0)
    cam.data.lens = lens1
    cam.data.keyframe_insert("lens", frame=f1)
    for fc in lib.fcurves_of(cam.data):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.easing = 'EASE_IN_OUT'


def hdri_world(sc, path, strength=1.0, rot_deg=0.0, tint=(1, 1, 1, 1)):
    w = sc.world
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_deg))
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path, check_existing=True)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["B"].default_value = tint
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], mix.inputs["A"])
    nt.links.new(mix.outputs[2], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    w.use_sun_shadow = False


def better_metals():
    m = bpy.data.materials.get("M_DrumSteel")
    if m:
        p = m.node_tree.nodes["Principled BSDF"]
        p.inputs["Roughness"].default_value = 0.16
        for n in m.node_tree.nodes:
            if n.type == 'MAP_RANGE':
                n.inputs["To Min"].default_value = 0.1
                n.inputs["To Max"].default_value = 0.24
        # darken the drum interior with AO
        nt = m.node_tree
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.35
        ao.samples = 8
        base_link = p.inputs["Base Color"].links[0] if p.inputs["Base Color"].links else None
        mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
        mul.inputs["Factor"].default_value = 0.75
        if base_link:
            nt.links.new(base_link.from_socket, mul.inputs["A"])
        else:
            mul.inputs["A"].default_value = p.inputs["Base Color"].default_value
        nt.links.new(ao.outputs["Color"], mul.inputs["B"])
        ao.inputs["Color"].default_value = (1, 1, 1, 1)
        nt.links.new(mul.outputs[2], p.inputs["Base Color"])
    for name, rough in (("M_TubSteel", 0.26), ("M_OuterTub", 0.22), ("M_Chrome", 0.06), ("M_Bolt", 0.2)):
        mm = bpy.data.materials.get(name)
        if mm:
            pp = mm.node_tree.nodes["Principled BSDF"]
            pp.inputs["Roughness"].default_value = rough
            for n in mm.node_tree.nodes:
                if n.type == 'MAP_RANGE':
                    n.inputs["To Min"].default_value = max(0.02, rough - 0.08)
                    n.inputs["To Max"].default_value = rough + 0.1
    cab = bpy.data.materials.get("M_CabinetWhite")
    if cab:
        cab.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.8
        cab.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.22


def ripple_rings(C, center, f0, n=3, max_r=0.24, z_off=0.004):
    m = lib.mat("M_Ripple", "#E8F2F8", rough=0.1, emit="#FFFFFF", emit_strength=0.4)
    rings = []
    for i in range(n):
        r = lib.torus(f"Ripple_{f0}_{i}", 1.0, 0.012, Vector(center) + Vector((0, 0, z_off)), (0, 0, 0), 48, 6, C)
        lib.assign(r, m)
        r.visible_shadow = False
        fs = f0 + i * 4
        for ff, s, zs in ((fs - 1, 0.0, 1.0), (fs, 0.03, 1.0), (fs + 14, max_r * (1 - 0.15 * i), 1.0)):
            r.scale = (s, s, zs)
            r.keyframe_insert("scale", frame=ff)
        r.keyframe_insert("scale", frame=fs + 14)
        lib.visible_between(r, fs, fs + 15)
        rings.append(r)
    return rings


def embers(C, box, f0, f1, n=90, seed=3):
    rng = random.Random(seed)
    m = lib.mat("M_Ember", "#FF8A1C", rough=0.5, emit="#FFB347", emit_strength=8.0)
    bm_mesh = bpy.data.meshes.get("EmberMesh")
    import bmesh
    if bm_mesh is None:
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        bm_mesh = bpy.data.meshes.new("EmberMesh"); bm.to_mesh(bm_mesh); bm.free()
        bm_mesh.materials.append(m)
    x0, x1, y0, y1, z0 = box
    for i in range(n):
        o = bpy.data.objects.new(f"Ember_{i}", bm_mesh)
        C.objects.link(o)
        o.visible_shadow = False
        s = rng.uniform(0.02, 0.05)
        st = rng.randint(f0, f1 - 10)
        p = Vector((rng.uniform(x0, x1), rng.uniform(y0, y1), z0 + rng.uniform(0, 2.0)))
        v = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.uniform(2.0, 4.0)))
        for k in range(0, 31, 3):
            tt = k / 30
            o.location = p + v * tt
            o.scale = (s * (1 - tt * 0.6),) * 3
            o.keyframe_insert("location", frame=st + k)
            o.keyframe_insert("scale", frame=st + k)
        lib.visible_between(o, st, st + 31)
