"""Effects: heat vision, facade destruction, sparks, fire, smoke, dust, litter, signal states,
knocked-over street furniture, hazard lights."""
import math
import os
import random
import sys

import numpy as np
import bpy
from mathutils import Vector, Matrix, Quaternion, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "sim"))
import fx_sim  # noqa: E402
import timeline as TL  # noqa: E402
from city import NT, simple_material  # noqa: E402

CACHE = "/opt/work/cache"
FPS = TL.FPS


def link(ob, coll):
    coll.objects.link(ob)
    return ob


def mesh_object(name, verts, faces, coll, uvs=None, mats=None, matnames=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [list(f) for f in faces])
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        flat = [c for face in uvs for uv in face for c in uv]
        uvl.data.foreach_set("uv", flat)
    if mats:
        for m in mats:
            me.materials.append(m)
        if matnames:
            names = list(dict.fromkeys(matnames))
            me.polygons.foreach_set("material_index", [names.index(n) for n in matnames])
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def add_cache(ob, path):
    mc = ob.modifiers.new("Cache", 'MESH_CACHE')
    mc.cache_format = 'PC2'
    mc.filepath = path
    mc.time_mode = 'FRAME'
    mc.play_mode = 'SCENE'
    mc.frame_start = 0.0
    mc.interpolation = 'LINEAR'
    mc.deform_mode = 'OVERWRITE'
    mc.forward_axis = 'POS_Y'
    mc.up_axis = 'POS_Z'
    return mc


def key_value(owner, path, keys, interp='LINEAR'):
    for f, v in keys:
        if isinstance(path, str) and path.startswith('["'):
            owner[path[2:-2]] = v
        else:
            setattr(owner, path, v)
        owner.keyframe_insert(path, frame=f)
    ad = owner.animation_data if hasattr(owner, "animation_data") else None
    try:
        for fc in ad.action.fcurves:
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.interpolation = interp
    except Exception:
        pass


def time_value_node(T):
    """A Value node carrying the scene time in seconds (keyed linearly)."""
    v = T.nt.nodes.new("ShaderNodeValue")
    v.outputs[0].default_value = 0.0
    v.outputs[0].keyframe_insert("default_value", frame=0)
    v.outputs[0].default_value = TL.N_FRAMES / FPS
    v.outputs[0].keyframe_insert("default_value", frame=TL.N_FRAMES)
    try:
        for fc in T.nt.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
            fc.extrapolation = 'LINEAR'
    except Exception:
        pass
    return v.outputs[0]


# ============================================================================ heat vision
def heat_vision(coll):
    eyes = np.load(f"{CACHE}/eyes.npy")             # (F, 2, 3)
    core_m = bpy.data.materials.new("BeamCore")
    T = NT(core_m)
    a = T.attr("beam").outputs["Fac"]
    em = T.node("ShaderNodeEmission", Color=(1.0, 0.82, 0.62, 1), Strength=T.math('MULTIPLY', a, 90.0))
    T.out(em.outputs[0])
    glow_m = bpy.data.materials.new("BeamGlow")
    T = NT(glow_m)
    a = T.attr("beam").outputs["Fac"]
    lw = T.node("ShaderNodeLayerWeight", Blend=0.5)
    face = T.math('POWER', T.math('SUBTRACT', 1.0, lw.outputs["Facing"]), 2.5)
    em = T.node("ShaderNodeEmission", Color=(1.0, 0.12, 0.03, 1), Strength=T.math('MULTIPLY', a, 28.0))
    tr = T.node("ShaderNodeBsdfTransparent")
    T.out(T.mixs(T.math('MULTIPLY', face, T.math('MINIMUM', a, 1.0)), tr.outputs[0], em.outputs[0]))
    for m in (core_m, glow_m):
        m.cycles.emission_sampling = 'NONE'
    beams = []
    for side in range(2):
        for kind, r, m in (("core", 0.012, core_m), ("glow", 0.07, glow_m)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=1.0, depth=1.0, location=(0, 0, 0.5))
            ob = bpy.context.active_object
            ob.data.transform(Matrix.Translation((0, 0, 0.5)))
            ob.location = (0, 0, 0)
            ob.name = f"Beam_{kind}_{side}"
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
            ob.data.materials.append(m)
            ob.rotation_mode = 'QUATERNION'
            ob["beam"] = 0.0
            ob.visible_shadow = False
            beams.append((ob, side, r))
    rng = np.random.default_rng(9)
    f0, f1 = int(TL.T_BEAM_ON * FPS) - 3, int(TL.T_BEAM_OFF * FPS) + 4
    for ob, side, r in beams:
        for f in range(f0 - 1, f1 + 2):
            t = f / FPS
            on = 1.0 if TL.T_BEAM_ON <= t <= TL.T_BEAM_OFF else 0.0
            if TL.T_BEAM_ON - 0.1 <= t < TL.T_BEAM_ON:
                on = (t - (TL.T_BEAM_ON - 0.1)) / 0.1
            e = Vector(eyes[min(f, len(eyes) - 1), side])
            tgt = Vector(TL.beam_target(min(max(t, TL.T_BEAM_ON), TL.T_BEAM_OFF)))
            d = tgt - e
            L = d.length
            ob.location = e
            ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
            wob = 1.0 + 0.25 * rng.standard_normal()
            ob.scale = (r * wob * (1 if on > 0 else 0.0), r * wob * (1 if on > 0 else 0.0), L)
            ob["beam"] = on * (0.8 + 0.4 * rng.random())
            ob.keyframe_insert("location", frame=f)
            ob.keyframe_insert("rotation_quaternion", frame=f)
            ob.keyframe_insert("scale", frame=f)
            ob.keyframe_insert('["beam"]', frame=f)
    # lights: impact (orange-white, flickering) and a red glow at the eyes
    li = bpy.data.lights.new("ImpactLight", 'POINT')
    li.color = (1.0, 0.42, 0.12)
    li.shadow_soft_size = 0.8
    lo = link(bpy.data.objects.new("ImpactLight", li), coll)
    le = bpy.data.lights.new("EyeLight", 'POINT')
    le.color = (1.0, 0.1, 0.03)
    le.shadow_soft_size = 0.05
    leo = link(bpy.data.objects.new("EyeLight", le), coll)
    for f in range(0, TL.N_FRAMES):
        t = f / FPS
        on = 1.0 if TL.T_BEAM_ON <= t <= TL.T_BEAM_OFF else 0.0
        tg = Vector(TL.beam_target(min(max(t, TL.T_BEAM_ON), TL.T_BEAM_OFF)))
        n = Vector((-0.707, -0.707, 0.0))
        lo.location = tg + n * 2.0
        li.energy = on * (35000.0 * (0.7 + 0.6 * rng.random()))
        lo.keyframe_insert("location", frame=f)
        li.keyframe_insert("energy", frame=f)
        e = Vector(eyes[f].mean(0))
        glow = 0.0
        if TL.T_EYES <= t <= TL.T_BEAM_OFF + 0.5:
            glow = min(1.0, (t - TL.T_EYES) / 0.6)
        if TL.T_LOOK <= t <= TL.T_LAUNCH + 0.4:
            glow = max(glow, 0.25)
        leo.location = e + Vector((0, 0, 0.0))
        le.energy = glow * 60.0
        leo.keyframe_insert("location", frame=f)
        le.keyframe_insert("energy", frame=f)
    return beams


# ============================================================================ debris systems
def debris_systems(coll, M, panels, slabs, mullions):
    res = fx_sim.build_all(CACHE, panels, slabs, mullions)
    verts, faces, uvs, mats, info = res["debris"]
    names = list(dict.fromkeys(mats))
    matmap = {"glass": M["glass_tower"], "concrete": M["debris"], "metal": M["metal_alu"]}
    ob = mesh_object("TowerDebris", verts, faces, coll, uvs=uvs, mats=[matmap[n] for n in names], matnames=mats)
    ob["cell_w"], ob["cell_h"] = 1.5, 4.0
    add_cache(ob, f"{CACHE}/debris.pc2")
    v, f = res["sparks"]
    sm = bpy.data.materials.new("Sparks")
    T = NT(sm)
    em = T.node("ShaderNodeEmission", Color=(1.0, 0.55, 0.18, 1), Strength=55.0)
    T.out(em.outputs[0])
    sm.cycles.emission_sampling = 'NONE'
    so = mesh_object("Sparks", v, f, coll, mats=[sm])
    so.visible_shadow = False
    add_cache(so, f"{CACHE}/sparks.pc2")
    v, f = res["papers"]
    pm = bpy.data.materials.new("Paper")
    T = NT(pm)
    oi = T.node("ShaderNodeObjectInfo")
    tc = T.node("ShaderNodeTexCoord")
    col = T.mixc(0.3, (0.82, 0.8, 0.74, 1), (0.55, 0.45, 0.3, 1))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": 0.85, "Subsurface Weight": 0.0})
    tl = T.node("ShaderNodeBsdfTranslucent", Color=(0.7, 0.68, 0.6, 1))
    T.out(T.mixs(0.25, b.outputs[0], tl.outputs[0]))
    po = mesh_object("Papers", v, f, coll, mats=[pm])
    add_cache(po, f"{CACHE}/papers.pc2")
    return ob, so, po, info


# ============================================================================ fire inside the floors
def fire(coll, panels, info):
    fm = bpy.data.materials.new("Fire")
    T = NT(fm)
    tval = time_value_node(T)
    tc = T.node("ShaderNodeTexCoord")
    comb = T.node("ShaderNodeCombineXYZ", X=0.0, Y=0.0, Z=T.math('MULTIPLY', tval, -1.6))
    p = T.vmath('ADD', T.vmath('SCALE', tc.outputs["Object"], scale=0.9), comb.outputs[0])
    nz = T.node("ShaderNodeTexNoise", Vector=p, Scale=1.6, Detail=6.0, Roughness=0.6)
    nz.noise_dimensions = '3D'
    flame = T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.5, "From Max": 0.78}).outputs[0]
    flame = T.math('POWER', flame, 1.8)
    a = T.attr("fire").outputs["Fac"]
    ramp = T.nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.6, 0.06, 0.0, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.75, 0.3, 1)
    T.set(ramp.inputs[0], flame)
    em = T.node("ShaderNodeEmission", Color=ramp.outputs[0], Strength=T.math('MULTIPLY', T.math('MULTIPLY', flame, a), 22.0))
    dark = T.node("ShaderNodeBsdfDiffuse", Color=(0.02, 0.018, 0.016, 1))
    T.out(T.mixs(T.math('MINIMUM', T.math('MULTIPLY', flame, a), 1.0), dark.outputs[0], em.outputs[0]))
    fm.cycles.emission_sampling = 'NONE'
    # a burning backdrop strip 2-6 m behind the facade on every damaged floor
    import city
    mb = city.MB()
    seen = set()
    for p_ in panels:
        key = (p_["face"], round(p_["u0"], 2), round(p_["z0"], 2))
        if key in seen:
            continue
        seen.add(key)
        F = city.Facade(p_["o"], (p_["o"][0] + p_["d"][0], p_["o"][1] + p_["d"][1]))
        F.quad(mb, p_["u0"], p_["u1"], p_["z0"] + 0.05, p_["z1"] - 0.35, -3.5, "fire")
    ob = mb.build("FireStrips", coll, {"fire": fm})
    ob["fire"] = 0.0
    key_value(ob, '["fire"]', [(0, 0.0), (int((TL.T_BEAM_ON + 0.2) * FPS), 0.0), (int((TL.T_BEAM_ON + 1.2) * FPS), 0.8),
                              (int(TL.T_BEAM_OFF * FPS), 1.0), (int(25 * FPS), 1.0), (TL.N_FRAMES, 0.9)])
    # fire lights
    rng = np.random.default_rng(4)
    lights = []
    for i, u in enumerate((0.15, 0.5, 0.85)):
        ax, ay = TL.CHAMFER_A
        bx, by = TL.CHAMFER_B
        pos = Vector((ax + (bx - ax) * u + 2.5, ay + (by - ay) * u + 2.5, 52.0))
        ld = bpy.data.lights.new(f"FireLight{i}", 'POINT')
        ld.color = (1.0, 0.45, 0.12)
        ld.shadow_soft_size = 1.5
        lo = link(bpy.data.objects.new(f"FireLight{i}", ld), coll)
        lo.location = pos
        for f in range(0, TL.N_FRAMES, 2):
            t = f / FPS
            ramp_on = min(1.0, max(0.0, (t - (TL.T_BEAM_ON + 0.4 + i * 0.7)) / 1.0))
            ld.energy = ramp_on * 9000.0 * (0.65 + 0.7 * rng.random())
            ld.keyframe_insert("energy", frame=f)
        lights.append(lo)
    return ob


# ============================================================================ volumes
def volume_box(name, lo, hi, mat, coll):
    me = bpy.data.meshes.new(name)
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me.from_pydata(v, [], f)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.visible_shadow = True
    return ob


def smoke_plume(coll):
    """Dark smoke rising from the gutted floors, leaning downwind (toward the north-east)."""
    m = bpy.data.materials.new("SmokePlume")
    T = NT(m)
    tval = time_value_node(T)
    tc = T.node("ShaderNodeTexCoord")
    p = tc.outputs["Object"]           # object at origin with identity transform -> world coords
    sep = T.node("ShaderNodeSeparateXYZ", Vector=p)
    src = Vector((20.5, 12.5, 50.0))
    rise = T.math('MAXIMUM', T.math('SUBTRACT', sep.outputs[2], src.z), 0.0)
    cx = T.math('ADD', src.x, T.math('MULTIPLY', rise, -0.30))
    cy = T.math('ADD', src.y, T.math('MULTIPLY', rise, -0.12))
    dx = T.math('SUBTRACT', sep.outputs[0], cx)
    dy = T.math('SUBTRACT', sep.outputs[1], cy)
    r = T.math('SQRT', T.math('ADD', T.math('MULTIPLY', dx, dx), T.math('MULTIPLY', dy, dy)))
    rad = T.math('ADD', 4.0, T.math('MULTIPLY', rise, 0.32))
    core = T.math('SUBTRACT', 1.0, T.math('DIVIDE', r, rad), clamp=True)
    # smoke grows with time after the beam, and leaves at the top of the box
    grow = T.math('DIVIDE', T.math('SUBTRACT', tval, TL.T_BEAM_ON + 0.6), 3.0, clamp=True)
    reach = T.math('MULTIPLY', T.math('SUBTRACT', tval, TL.T_BEAM_ON + 0.6), 9.0)
    below = T.math('LESS_THAN', rise, reach)
    off = T.node("ShaderNodeCombineXYZ", X=T.math('MULTIPLY', tval, 1.0), Y=T.math('MULTIPLY', tval, 0.4),
                 Z=T.math('MULTIPLY', tval, -3.2))
    q = T.vmath('ADD', T.vmath('SCALE', p, scale=0.07), T.vmath('SCALE', off.outputs[0], scale=0.07))
    nz = T.node("ShaderNodeTexNoise", Vector=q, Scale=1.0, Detail=8.0, Roughness=0.62)
    billow = T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.38, "From Max": 0.72}).outputs[0]
    dens = T.math('MULTIPLY', T.math('MULTIPLY', T.math('POWER', core, 0.8), billow), T.math('MULTIPLY', grow, below))
    dens = T.math('MULTIPLY', dens, 1.6)
    # glow from the fire at the base
    base_glow = T.math('SUBTRACT', 1.0, T.math('DIVIDE', rise, 4.0), clamp=True)
    vol = T.node("ShaderNodeVolumePrincipled", Color=(0.06, 0.055, 0.05, 1), Density=dens, Anisotropy=0.25,
                 **{"Emission Strength": T.math('MULTIPLY', T.math('MULTIPLY', base_glow, dens), 6.0),
                    "Emission Color": (1.0, 0.35, 0.08, 1)})
    o = T.nt.nodes.new("ShaderNodeOutputMaterial")
    T.nt.links.new(vol.outputs[0], o.inputs["Volume"])
    m.cycles.emission_sampling = 'NONE'
    return volume_box("SmokePlume", (-25.0, -15.0, 42.0), (40.0, 40.0, 150.0), m, coll)


def dust_volume(coll):
    """Street-level dust: a front rolling down the avenue (scene 4), haze in the intersection
    (scene 5) and blasts at the landing / launch / final impact.  One procedural field."""
    m = bpy.data.materials.new("Dust")
    T = NT(m)
    tval = time_value_node(T)
    tc = T.node("ShaderNodeTexCoord")
    p = tc.outputs["Object"]
    sep = T.node("ShaderNodeSeparateXYZ", Vector=p)
    x, y, z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    # rolling front: y_front(t) moves from the intersection toward the south
    yf = T.math('SUBTRACT', 26.0, T.math('MULTIPLY', T.math('MAXIMUM', T.math('SUBTRACT', tval, 17.5), 0.0), 5.2))
    yf = T.math('MAXIMUM', yf, -34.0)
    behind = T.math('DIVIDE', T.math('SUBTRACT', y, T.math('SUBTRACT', yf, 9.0)), 9.0, clamp=True)
    height = T.math('ADD', 6.0, T.math('MULTIPLY', T.math('SUBTRACT', T.math('MINIMUM', tval, 28.0), 17.5), 1.4))
    hfall = T.math('SUBTRACT', 1.0, T.math('DIVIDE', z, T.math('MAXIMUM', height, 1.0)), clamp=True)
    started = T.math('DIVIDE', T.math('SUBTRACT', tval, 17.6), 1.5, clamp=True)
    front = T.math('MULTIPLY', T.math('MULTIPLY', behind, hfall), started)
    # once the front has rolled past, the dust settles and thins out (scene 5 must see through it)
    age = T.math('MAXIMUM', T.math('ADD', T.math('SUBTRACT', tval, 22.5), T.math('DIVIDE', y, 5.2)), 0.0)
    settle = T.math('ADD', 0.3, T.math('MULTIPLY', T.math('EXPONENT', T.math('MULTIPLY', age, -0.4)), 0.7))
    front = T.math('MULTIPLY', front, settle)
    # blast spheres: (centre, start time, growth speed, max radius, strength)
    blasts = [((0.5, 2.5, 1.0), TL.T_DESCEND + 0.95, 14.0, 16.0, 0.45),
              ((0.0, 2.0, 1.0), TL.T_LAUNCH, 18.0, 16.0, 0.5),
              ((-26.6, -52.0, 2.0), TL.T_IMPACT, 24.0, 36.0, 6.0)]
    total = front
    for (c, t0, spd, rmax, s) in blasts:
        d = T.vmath('DISTANCE', p, c)
        age = T.math('MAXIMUM', T.math('SUBTRACT', tval, t0), 0.0)
        rad = T.math('MINIMUM', T.math('MULTIPLY', age, spd), rmax)
        shell = T.math('SUBTRACT', 1.0, T.math('DIVIDE', d, T.math('MAXIMUM', rad, 0.01)), clamp=True)
        alive = T.math('GREATER_THAN', tval, t0)
        fade = T.math('SUBTRACT', 1.0, T.math('DIVIDE', age, 14.0), clamp=True)
        blast = T.math('MULTIPLY', T.math('MULTIPLY', shell, alive), s * 1.0)
        blast = T.math('MULTIPLY', blast, T.math('ADD', 0.35, T.math('MULTIPLY', fade, 0.65)))
        total = T.math('ADD', total, blast)
    # general haze while he hovers in the intersection (scene 5) and after
    haze_t = T.math('DIVIDE', T.math('SUBTRACT', tval, TL.T_DESCEND + 0.8), 1.2, clamp=True)
    haze = T.math('MULTIPLY', T.math('MULTIPLY', haze_t, T.math('SUBTRACT', 1.0, T.math('DIVIDE', z, 18.0), clamp=True)), 0.045)
    total = T.math('ADD', total, haze)
    off = T.node("ShaderNodeCombineXYZ", X=T.math('MULTIPLY', tval, 0.6), Y=T.math('MULTIPLY', tval, -1.5),
                 Z=T.math('MULTIPLY', tval, 0.25))
    q = T.vmath('ADD', T.vmath('SCALE', p, scale=0.11), T.vmath('SCALE', off.outputs[0], scale=0.11))
    nz = T.node("ShaderNodeTexNoise", Vector=q, Scale=1.0, Detail=7.0, Roughness=0.6)
    billow = T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.3, "From Max": 0.75}).outputs[0]
    dens = T.math('MULTIPLY', T.math('MULTIPLY', total, billow), 0.11)
    vol = T.node("ShaderNodeVolumePrincipled", Color=(0.55, 0.5, 0.42, 1), Density=dens, Anisotropy=0.55)
    o = T.nt.nodes.new("ShaderNodeOutputMaterial")
    T.nt.links.new(vol.outputs[0], o.inputs["Volume"])
    m.cycles.emission_sampling = 'NONE'
    ob = volume_box("DustField", (-30.0, -70.0, 0.0), (30.0, 40.0, 26.0), m, coll)
    # only render it once it exists (saves time in scenes 1-3)
    ob.hide_render = True
    ob.keyframe_insert("hide_render", frame=int(17.5 * FPS) - 1)
    ob.hide_render = False
    ob.keyframe_insert("hide_render", frame=int(17.5 * FPS))
    return ob


def sun_shafts(coll):
    """Sunbeams breaking through the gaps between the buildings into the settling dust (scene 5 on).
    Emissive shafts slanting in from the west behind the hovering figure, streaked along their
    length; cheaper and more controllable than lighting the whole dust field with a spot light."""
    m = bpy.data.materials.new("SunShafts")
    T = NT(m)
    tval = time_value_node(T)
    p = T.node("ShaderNodeTexCoord").outputs["Object"]
    az, el = math.radians(290.0), math.radians(48.0)
    d = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    total = None
    for (gx, gy, r, w) in ((10.4, 10.0, 1.4, 1.0), (7.5, 16.8, 1.0, 0.8), (18.7, 17.2, 0.9, 0.7), (0.5, 9.0, 2.2, 0.35)):
        rel = T.vmath('SUBTRACT', p, (gx, gy, 0.0))
        along = T.vmath('DOT_PRODUCT', rel, d)
        dist = T.vmath('LENGTH', T.vmath('SUBTRACT', rel, T.vmath('SCALE', d, scale=along)))
        core = T.math('SUBTRACT', 1.0, T.math('DIVIDE', dist, r), clamp=True)
        core = T.math('MULTIPLY', T.math('POWER', core, 1.6), w)
        total = core if total is None else T.math('ADD', total, core)
    z = T.node("ShaderNodeSeparateXYZ", Vector=p).outputs[2]
    ground = T.math('DIVIDE', z, 2.0, clamp=True)
    top = T.math('SUBTRACT', 1.0, T.math('DIVIDE', T.math('SUBTRACT', z, 28.0), 14.0), clamp=True)
    # streaks: noise squashed along the beam direction, drifting with the dust
    squash = T.vmath('SUBTRACT', p, T.vmath('SCALE', d, scale=T.math('MULTIPLY', T.vmath('DOT_PRODUCT', p, d), 0.92)))
    off = T.node("ShaderNodeCombineXYZ", X=T.math('MULTIPLY', tval, 0.25), Y=T.math('MULTIPLY', tval, -0.4), Z=0.0)
    q = T.vmath('ADD', T.vmath('SCALE', squash, scale=0.9), off.outputs[0])
    nz = T.node("ShaderNodeTexNoise", Vector=q, Scale=1.0, Detail=3.0, Roughness=0.5)
    streak = T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.38, "From Max": 0.68}).outputs[0]
    on = T.math('DIVIDE', T.math('SUBTRACT', tval, TL.T_DESCEND + 0.4), 1.4, clamp=True)
    k = T.math('MULTIPLY', T.math('MULTIPLY', T.math('MULTIPLY', total, streak), T.math('MULTIPLY', ground, top)), on)
    em = T.node("ShaderNodeEmission", Color=(1.0, 0.88, 0.7, 1.0), Strength=T.math('MULTIPLY', k, 0.6))
    o = T.nt.nodes.new("ShaderNodeOutputMaterial")
    T.nt.links.new(em.outputs[0], o.inputs["Volume"])
    m.cycles.emission_sampling = 'NONE'
    ob = volume_box("SunShafts", (-40.0, -14.0, 0.0), (26.0, 44.0, 45.0), m, coll)
    ob.visible_shadow = False
    ob.hide_render = True
    ob.keyframe_insert("hide_render", frame=int(TL.T_DESCEND * FPS) - 1)
    ob.hide_render = False
    ob.keyframe_insert("hide_render", frame=int(TL.T_DESCEND * FPS))
    return ob


# ============================================================================ street reactions
def signal_program(P):
    """Lamp states over time + flicker during scene 5 + the damaged mid-block signal."""
    rng = random.Random(3)
    S = P["signals"]

    def heads(poles, kind="car"):
        out = []
        for pk in poles:
            for ob in S[pk]:
                if kind == "car" and "_head" in ob.name:
                    out.append(ob)
                if kind == "ped" and "_ped" in ob.name:
                    out.append(ob)
        return out

    def program(obs, segments, flicker_from=None, flicker_to=None):
        for ob in obs:
            last = None
            for (t, r, y, g) in segments:
                f = int(t * FPS)
                for k, v in (("lamp_r", r), ("lamp_y", y), ("lamp_g", g)):
                    if last is not None:
                        ob[k] = last[k]
                        ob.keyframe_insert(f'["{k}"]', frame=f - 1)
                    ob[k] = v
                    ob.keyframe_insert(f'["{k}"]', frame=f)
                last = dict(lamp_r=r, lamp_y=y, lamp_g=g)
            if flicker_from is not None:
                f = int(flicker_from * FPS)
                while f < int(flicker_to * FPS):
                    on = rng.random() < 0.55
                    for k in ("lamp_r", "lamp_y", "lamp_g"):
                        ob[k] = (1.0 if (on and k == "lamp_r") else (0.6 if on and rng.random() < 0.2 else 0.0))
                        ob.keyframe_insert(f'["{k}"]', frame=f)
                    f += rng.randint(1, 4)
            for k in ("lamp_r", "lamp_y", "lamp_g"):
                try:
                    for fc in ob.animation_data.action.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'CONSTANT'
                except Exception:
                    pass
    main_ave = heads([k for k in S if k.startswith(("NW", "NE")) and k.endswith("+0")])
    main_cross = heads([k for k in S if k.startswith(("SW", "SE")) and k.endswith("+0")])
    others = heads([k for k in S if (k.endswith("-80") or k.endswith("+80"))])
    mid = heads(["MidW", "MidE"])
    program(main_ave, [(0, 0, 0, 1), (11.5, 0, 1, 0), (14.5, 1, 0, 0)], TL.T_DESCEND, 40.0)
    program(main_cross, [(0, 1, 0, 0), (14.5, 0, 0, 1)], TL.T_DESCEND + 0.4, 40.0)
    program(others, [(0, 0, 0, 1), (12.0, 0, 1, 0), (15.0, 1, 0, 0)])
    program(mid, [(0, 1, 0, 0), (4.9, 0, 0, 1)], TL.T_DESCEND + 0.9, 40.0)
    # pedestrian heads at the mid-block crossing: WALK during scene 1, then hand
    for ob in heads(["MidW", "MidE"], "ped"):
        for (t, hand, walk) in ((0, 0.0, 1.0), (4.6, 1.0, 0.0)):
            ob["lamp_hand"], ob["lamp_walk"] = hand, walk
            ob.keyframe_insert('["lamp_hand"]', frame=int(t * FPS))
            ob.keyframe_insert('["lamp_walk"]', frame=int(t * FPS))
    # the mid-block pole by the plaza is bent by the landing shockwave
    pole = S["MidW"][0]
    t_hit = TL.T_DESCEND + 1.02
    pole.rotation_mode = 'XYZ'
    keys = [(t_hit - 0.05, 0.0), (t_hit + 0.12, 0.30), (t_hit + 0.25, 0.22), (t_hit + 0.45, 0.26), (40.0, 0.26)]
    for t, a in keys:
        pole.rotation_euler = (a * 0.35, -a, 0.0)
        pole.keyframe_insert("rotation_euler", frame=int(t * FPS))
    for ob in S["MidW"][1:]:
        if "_head" in ob.name:
            ob.rotation_mode = 'XYZ'
            base = ob.rotation_euler.copy()
            for t, sw in ((t_hit, 0.0), (t_hit + 0.2, 0.9), (t_hit + 0.6, 0.45), (t_hit + 1.2, 0.7), (t_hit + 2.5, 0.6), (40, 0.62)):
                ob.rotation_euler = (base.x + sw, base.y + 0.3 * sw, base.z)
                ob.keyframe_insert("rotation_euler", frame=int(t * FPS))


def knock_over(movers):
    """Cafe furniture and the A-frame sign topple when the debris gust hits (scene 4)."""
    rng = random.Random(8)
    for name, ob in movers.items():
        t0 = rng.uniform(21.8, 24.5) if "Cafe" in name else 22.6
        f0 = int(t0 * FPS)
        loc0 = ob.location.copy()
        rot0 = ob.rotation_euler.copy()
        ob.keyframe_insert("location", frame=f0)
        ob.keyframe_insert("rotation_euler", frame=f0)
        d = Vector((rng.uniform(-0.4, 0.6), rng.uniform(-1.6, -0.6), 0))
        tip = rng.choice([-1, 1]) * math.radians(rng.uniform(80, 100))
        ob.location = loc0 + d * 0.6 + Vector((0, 0, 0.15))
        ob.rotation_euler = (rot0.x + tip * 0.6, rot0.y + rng.uniform(-0.4, 0.4), rot0.z + rng.uniform(-0.6, 0.6))
        ob.keyframe_insert("location", frame=f0 + 6)
        ob.keyframe_insert("rotation_euler", frame=f0 + 6)
        ob.location = loc0 + d + Vector((0, 0, 0.18 if "Table" not in name else 0.3))
        ob.rotation_euler = (rot0.x + tip, rot0.y, rot0.z + rng.uniform(-0.8, 0.8))
        ob.keyframe_insert("location", frame=f0 + 12)
        ob.keyframe_insert("rotation_euler", frame=f0 + 12)


def abandoned_bags(coll, M):
    """Shopping bags dropped by fleeing people (appear when the panic starts)."""
    import city
    rng = random.Random(12)
    mb = city.MB()
    spots = [(-13.6, -30.5), (-12.2, -24.0), (-14.8, -44.5), (12.8, -16.0), (-11.9, -36.2), (13.6, -36.0)]
    for (x, y) in spots:
        a = rng.uniform(0, math.pi)
        lay = rng.random() < 0.5
        w, d, h = 0.32, 0.14, 0.38
        if lay:
            h, d = d, h
        c = Vector((x, y, TL.CURB_H + h / 2))
        R = Matrix.Rotation(a, 3, 'Z')
        pts = [Vector((sx * w / 2, sy * d / 2, sz * h / 2)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        pts = [R @ p + c for p in pts]
        faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
        for fc in faces:
            mb.poly([tuple(pts[i]) for i in fc], rng.choice(["paper_bag", "paper_bag", "bag_white"]))
    M2 = {"paper_bag": simple_material("PaperBag", (0.45, 0.32, 0.18), 0.85),
          "bag_white": simple_material("BagWhite", (0.8, 0.8, 0.78), 0.5)}
    ob = mb.build("AbandonedBags", coll, M2)
    ob.hide_render = True
    ob.keyframe_insert("hide_render", frame=int((TL.T_BEAM_ON + 0.5) * FPS))
    ob.hide_render = False
    ob.keyframe_insert("hide_render", frame=int((TL.T_BEAM_ON + 0.5) * FPS) + 1)
    return ob


def hazard_lights(V):
    """Stopped cars: hazard / alarm flashing of the rear lamps after the wake (car alarms)."""
    rng = random.Random(6)
    for name, ob in V.items():
        if not name.startswith("Parked") or rng.random() < 0.55:
            continue
        t0 = TL.T_WAKE + rng.uniform(0.2, 1.5)
        period = rng.uniform(0.45, 0.8)
        f = int(t0 * FPS)
        ob["brake"] = ob.get("brake", 0.0)
        while f < TL.N_FRAMES:
            for v, dt in ((1.0, period / 2), (0.0, period / 2)):
                ob["brake"] = v
                ob.keyframe_insert('["brake"]', frame=f)
                f += max(1, int(dt * FPS))
        try:
            for fc in ob.animation_data.action.fcurves:
                if fc.data_path == '["brake"]':
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'CONSTANT'
        except Exception:
            pass


def fireballs(coll, info):
    """Bright bursts where the beam blows panels out (short-lived emissive volumes)."""
    m = bpy.data.materials.new("Fireball")
    T = NT(m)
    tc = T.node("ShaderNodeTexCoord")
    d = T.vmath('LENGTH', tc.outputs["Object"])
    nz = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=3.2, Detail=10.0, Roughness=0.7)
    fall = T.math('SUBTRACT', 1.0, T.math('ADD', T.math('MULTIPLY', d, 1.15), T.math('MULTIPLY', nz.outputs["Fac"], 0.9)), clamp=True)
    fall = T.math('POWER', T.math('MULTIPLY', fall, 2.2), 1.6)
    a = T.attr("heat").outputs["Fac"]
    ramp = T.nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.5, 0.05, 0.0, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.85, 0.5, 1)
    T.set(ramp.inputs[0], T.math('MULTIPLY', fall, a))
    vol = T.node("ShaderNodeVolumePrincipled", Color=(0.03, 0.028, 0.025, 1), Density=T.math('MULTIPLY', fall, 4.0),
                 **{"Emission Strength": T.math('MULTIPLY', T.math('MULTIPLY', T.math('POWER', fall, 2.0), a), 30.0),
                    "Emission Color": ramp.outputs[0]})
    o = T.nt.nodes.new("ShaderNodeOutputMaterial")
    T.nt.links.new(vol.outputs[0], o.inputs["Volume"])
    m.cycles.emission_sampling = 'NONE'
    rng = np.random.default_rng(2)
    times = np.linspace(TL.T_BEAM_ON + 0.15, TL.T_BEAM_OFF - 0.1, 7)
    for i, t0 in enumerate(times):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
        ob = bpy.context.active_object
        ob.name = f"Fireball{i}"
        for c in ob.users_collection:
            c.objects.unlink(ob)
        coll.objects.link(ob)
        ob.data.materials.append(m)
        tg = Vector(TL.beam_target(t0)) + Vector((-0.707, -0.707, 0)) * 1.5
        ob.location = tg
        ob["heat"] = 0.0
        keys = [(t0 - 0.04, 0.05, 0.0), (t0, 0.6, 1.0), (t0 + 0.25, 2.6, 0.8), (t0 + 0.7, 3.6, 0.25), (t0 + 1.1, 4.0, 0.0)]
        for (t, s, h) in keys:
            ob.scale = (s, s, s * 0.9)
            ob["heat"] = h
            ob.location = tg + Vector((0, 0, 0.8 * max(0.0, t - t0)))
            f = t * FPS
            ob.keyframe_insert("scale", frame=f)
            ob.keyframe_insert('["heat"]', frame=f)
            ob.keyframe_insert("location", frame=f)
        ob.hide_render = True
        ob.keyframe_insert("hide_render", frame=int((t0 - 0.1) * FPS))
        ob.hide_render = False
        ob.keyframe_insert("hide_render", frame=int((t0 - 0.1) * FPS) + 1)
        ob.keyframe_insert("hide_render", frame=int((t0 + 1.1) * FPS))
        ob.hide_render = True
        ob.keyframe_insert("hide_render", frame=int((t0 + 1.1) * FPS) + 1)


def build_all(sc, M, panels, slabs, mullions, P, movers, V):
    coll = bpy.data.collections.new("FX")
    sc.collection.children.link(coll)
    heat_vision(coll)
    deb, sparks, papers, info = debris_systems(coll, M, panels, slabs, mullions)
    fire(coll, panels, info)
    smoke = smoke_plume(coll)
    smoke.hide_render = True
    smoke.keyframe_insert("hide_render", frame=int(TL.T_BEAM_ON * FPS))
    smoke.hide_render = False
    smoke.keyframe_insert("hide_render", frame=int(TL.T_BEAM_ON * FPS) + 1)
    dust_volume(coll)
    sun_shafts(coll)
    fireballs(coll, info)
    signal_program(P)
    knock_over(movers)
    abandoned_bags(coll, M)
    hazard_lights(V)
    print("FX built: debris bodies", info["n_bodies"], flush=True)
