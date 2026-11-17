"""Water FX built from keyframed linked-duplicate drops (deterministic, no sim caches)."""
import bpy, math, random
from mathutils import Vector, Matrix, Quaternion

G = 9.81
FPS = 30.0


def _fc_set(ob, path, index, frames, values, interp='LINEAR'):
    if ob.animation_data is None:
        ob.animation_data_create()
    act = ob.animation_data.action
    if act is None:
        act = bpy.data.actions.new(ob.name + "_act")
        ob.animation_data.action = act
    fc = act.fcurves.find(path, index=index) or act.fcurves.new(path, index=index)
    ad = ob.animation_data
    if hasattr(ad, "action_slot") and ad.action_slot is None and len(act.slots) > 0:
        ad.action_slot = act.slots[0]
    fc.keyframe_points.add(len(frames))
    for kp, f, v in zip(fc.keyframe_points[-len(frames):], frames, values):
        kp.co = (f, v)
        kp.interpolation = interp
    fc.update()


def _new_drop(proto, name, coll):
    ob = bpy.data.objects.new(name, proto.data)
    coll.objects.link(ob)
    ob.visible_shadow = False
    ob.hide_render = False
    return ob


def fx_coll(name="FX"):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def burst(origin, frame, n=80, speed=(2.0, 4.5), up=(0.4, 1.0), spread=1.0, size=(0.012, 0.03),
          life=(14, 30), seed=1, ground=0.0, direction=None, f_end=None, stretch=1.0, prefix="drop",
          drag=0.0):
    """Splash burst: n drops from origin at frame with random velocities.
    direction: optional bias vector. Drops vanish when they reach the ground or end of life."""
    r = random.Random(seed)
    proto = bpy.data.objects["DropProto"]
    c = fx_coll()
    drops = []
    for i in range(n):
        ob = _new_drop(proto, f"{prefix}{seed}_{i}", c)
        a = r.uniform(0, 2 * math.pi)
        horiz = r.uniform(0.2, 1.0) * spread
        v = Vector((math.cos(a) * horiz, math.sin(a) * horiz, r.uniform(*up)))
        if direction is not None:
            v = (v * 0.6 + Vector(direction).normalized() * 0.8)
        v = v.normalized() * r.uniform(*speed)
        s = r.uniform(*size)
        lifetime = r.randint(*life)
        f0 = frame + r.choice((0, 0, 1, 1, 2))
        p = Vector(origin) + Vector((r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), r.uniform(-0.02, 0.05)))
        frames, xs, ys, zs, sx, sz, rw, rx, ry, rz = [], [], [], [], [], [], [], [], [], []
        vel = v.copy()
        for k in range(lifetime + 1):
            f = f0 + k
            if f_end and f > f_end:
                break
            frames.append(f)
            xs.append(p.x); ys.append(p.y); zs.append(p.z)
            spd = vel.length
            el = 1.0 + min(0.8, spd * 0.11) * stretch
            sx.append(s); sz.append(s * el)
            q = Vector((0, 0, 1)).rotation_difference(vel.normalized() if spd > 1e-4 else Vector((0, 0, 1)))
            rw.append(q.w); rx.append(q.x); ry.append(q.y); rz.append(q.z)
            dt = 1.0 / FPS
            vel.z -= G * dt
            vel *= (1.0 - drag)
            p = p + vel * dt
            if p.z < ground + s:
                p.z = ground + s * 0.3
                frames.append(f + 1)
                xs.append(p.x); ys.append(p.y); zs.append(p.z)
                sx.append(s * 1.6); sz.append(s * 0.25)
                rw.append(1); rx.append(0); ry.append(0); rz.append(0)
                break
        ob.rotation_mode = 'QUATERNION'
        _fc_set(ob, "location", 0, frames, xs)
        _fc_set(ob, "location", 1, frames, ys)
        _fc_set(ob, "location", 2, frames, zs)
        _fc_set(ob, "scale", 0, frames, sx)
        _fc_set(ob, "scale", 1, frames, sx)
        _fc_set(ob, "scale", 2, frames, sz)
        for idx, vals in enumerate((rw, rx, ry, rz)):
            _fc_set(ob, "rotation_quaternion", idx, frames, vals)
        # visibility window
        fe = frames[-1] + 1
        _fc_set(ob, "hide_render", 0, [frame - 50, f0, fe], [1, 0, 1], 'CONSTANT')
        drops.append(ob)
    return drops


def crown(loc, frame, radius=0.5, height=0.6, dur=14, seed=0, name="crown", squash=1.0):
    """expanding splash sheet that rises and fades"""
    proto = bpy.data.objects["CrownProto"]
    c = fx_coll()
    ob = bpy.data.objects.new(f"{name}{seed}", proto.data)
    c.objects.link(ob)
    ob.visible_shadow = False
    ob.location = loc
    frames = [frame - 1, frame, frame + int(dur * 0.35), frame + dur]
    sxy = [0.01, radius * 0.5, radius * 1.0, radius * 1.25]
    sz = [0.01, height * 0.6, height * 1.0 * squash, height * 0.35]
    alpha = [0.0, 0.55, 0.4, 0.0]
    _fc_set(ob, "scale", 0, frames, sxy, 'BEZIER')
    _fc_set(ob, "scale", 1, frames, sxy, 'BEZIER')
    _fc_set(ob, "scale", 2, frames, sz, 'BEZIER')
    _fc_set(ob, "color", 3, frames, alpha, 'LINEAR')
    _fc_set(ob, "hide_render", 0, [frame - 50, frame, frame + dur + 1], [1, 0, 1], 'CONSTANT')
    return ob


def column(top, bottom, frame, dur=8, n=60, radius=0.12, seed=3, size=(0.02, 0.045)):
    """a falling slug of water (bucket dump) made of many drops travelling top->bottom"""
    r = random.Random(seed)
    proto = bpy.data.objects["DropProto"]
    c = fx_coll()
    top, bottom = Vector(top), Vector(bottom)
    out = []
    for i in range(n):
        ob = _new_drop(proto, f"col{seed}_{i}", c)
        delay = r.uniform(0, dur * 0.5)
        off = Vector((r.uniform(-1, 1) * radius, r.uniform(-1, 1) * radius, r.uniform(0, 0.2)))
        f0 = frame + delay
        f1 = f0 + dur * r.uniform(0.6, 0.9)
        s = r.uniform(*size)
        frames = [frame - 50, f0, f1]
        _fc_set(ob, "location", 0, [f0, f1], [top.x + off.x, bottom.x + off.x * 2.5])
        _fc_set(ob, "location", 1, [f0, f1], [top.y + off.y, bottom.y + off.y * 2.5])
        _fc_set(ob, "location", 2, [f0, f1], [top.z + off.z, bottom.z + off.z * 0.5], 'BEZIER')
        _fc_set(ob, "scale", 0, [f0, f1], [s, s])
        _fc_set(ob, "scale", 1, [f0, f1], [s, s])
        _fc_set(ob, "scale", 2, [f0, f1], [s * 2.5, s * 3.5])
        _fc_set(ob, "hide_render", 0, [frame - 50, int(f0), int(f1) + 1], [1, 0, 1], 'CONSTANT')
        out.append(ob)
    return out


def drips(rig, f0, f1, every=2, seed=5, size=(0.008, 0.016), meshes=None, ground=0.0):
    """water dripping off a wet character: drops spawn at random vertices of its meshes and fall."""
    r = random.Random(seed)
    proto = bpy.data.objects["DropProto"]
    c = fx_coll()
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    meshes = meshes or [m for m in rig.meshes if any(k in m.name for k in ("casualsuit", "short0", "body"))]
    out = []
    k = 0
    for f in range(f0, f1, every):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        m = r.choice(meshes)
        ev = m.evaluated_get(dg)
        me = ev.to_mesh()
        if len(me.vertices) == 0:
            ev.to_mesh_clear()
            continue
        # prefer low vertices (hems, chin, fingertips) for natural drips
        cand = [me.vertices[r.randrange(len(me.vertices))] for _ in range(12)]
        v = min(cand, key=lambda vv: (ev.matrix_world @ vv.co).z + r.uniform(0, 0.4))
        p = ev.matrix_world @ v.co
        ev.to_mesh_clear()
        if p.z <= ground + 0.06:
            continue
        ob = _new_drop(proto, f"drip{seed}_{k}", c)
        k += 1
        s = r.uniform(*size)
        frames, zs = [], []
        z, vz = p.z, 0.0
        ff = f
        while z > ground and ff < f + 40:
            frames.append(ff)
            zs.append(z)
            vz -= G / FPS
            z += vz / FPS
            ff += 1
        frames.append(ff)
        zs.append(ground + 0.002)
        _fc_set(ob, "location", 0, [f], [p.x], 'CONSTANT')
        _fc_set(ob, "location", 1, [f], [p.y], 'CONSTANT')
        _fc_set(ob, "location", 2, frames, zs)
        _fc_set(ob, "scale", 0, [f, frames[-2], frames[-1]], [s, s, s * 1.8])
        _fc_set(ob, "scale", 1, [f, frames[-2], frames[-1]], [s, s, s * 1.8])
        _fc_set(ob, "scale", 2, [f, frames[-2], frames[-1]], [s * 1.6, s * 2.2, s * 0.2])
        _fc_set(ob, "hide_render", 0, [f - 50, f, frames[-1] + 1], [1, 0, 1], 'CONSTANT')
        out.append(ob)
    return out


def puddle(idx, loc, frames_scales, rot=0.0):
    """grow a puddle: frames_scales = [(frame, (sx, sy)), ...]"""
    ob = bpy.data.objects[f"Puddle{idx}"]
    ob.hide_render = False
    ob.location = (loc[0], loc[1], 0.004 + idx * 0.0007)
    ob.rotation_euler = (0, 0, math.radians(rot))
    for f, (sx, sy) in frames_scales:
        ob.scale = (sx, sy, 1)
        ob.keyframe_insert("scale", frame=f)
    return ob


def ripple(surface, frame, center=(0, 0), height=0.06, speed=0.12, width=0.35, damp=40):
    """animated wave modifier on a water surface starting at frame"""
    w = surface.modifiers.new("ripple", 'WAVE')
    w.use_normal = False
    w.use_x = True
    w.use_y = True
    w.start_position_x = center[0]
    w.start_position_y = center[1]
    w.height = height
    w.width = width
    w.speed = speed
    w.narrowness = 1.2
    w.time_offset = frame
    w.lifetime = 0
    w.damping_time = damp
    w.falloff_radius = 0
    return w


def sweat(rig, f0, f1, every=5, seed=9):
    """sweat drops flying off the head"""
    r = random.Random(seed)
    out = []
    for i, f in enumerate(range(f0, f1, every)):
        bpy.context.scene.frame_set(f)
        hm = rig.obj.matrix_world @ rig.obj.pose.bones["head"].matrix
        p = hm @ Vector((r.choice((-0.07, 0.07)), 0.12, 0.0))
        side = 1 if r.random() > 0.5 else -1
        d = burst(p, f, n=1, speed=(1.2, 1.8), up=(0.8, 1.0), spread=0.6, size=(0.012, 0.016), life=(10, 14),
                  seed=seed * 100 + i, prefix="sweat",
                  direction=(hm.to_3x3() @ Vector((side, 0.0, 0.0))) + Vector((0, 0, 1.2)))
        out += d
    return out
