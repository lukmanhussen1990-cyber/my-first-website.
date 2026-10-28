"""Eyeballs with a procedural iris + eyelid shells that rotate to blink."""
import math
import bpy
import numpy as np


def _mesh_from(name, V, F, attrs=None):
    me = bpy.data.meshes.new(name)
    V = np.asarray(V, dtype=np.float32)
    me.vertices.add(len(V))
    me.vertices.foreach_set('co', V.ravel())
    loops = [i for f in F for i in f]
    me.loops.add(len(loops))
    me.loops.foreach_set('vertex_index', loops)
    me.polygons.add(len(F))
    starts = np.cumsum([0] + [len(f) for f in F[:-1]])
    me.polygons.foreach_set('loop_start', starts)
    me.polygons.foreach_set('loop_total', [len(f) for f in F])
    me.update()
    me.validate()
    if attrs:
        for an, av in attrs.items():
            a = me.attributes.new(an, 'FLOAT', 'POINT')
            a.data.foreach_set('value', np.asarray(av, dtype=np.float32))
    me.shade_smooth()
    return me


def eye_material(name='eye', iris=(0.30, 0.46, 0.58)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N = nt.nodes
    L = nt.links
    bsdf = N['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.07
    bsdf.inputs['Coat Weight'].default_value = 0.6
    bsdf.inputs['Coat Roughness'].default_value = 0.03
    tc = N.new('ShaderNodeTexCoord')
    nrm = N.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'
    L.new(tc.outputs['Object'], nrm.inputs[0])
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(nrm.outputs[0], sep.inputs[0])
    # rho = sqrt(x^2 + z^2)  (gaze axis = -Y)
    x2 = N.new('ShaderNodeMath'); x2.operation = 'MULTIPLY'
    L.new(sep.outputs['X'], x2.inputs[0]); L.new(sep.outputs['X'], x2.inputs[1])
    z2 = N.new('ShaderNodeMath'); z2.operation = 'MULTIPLY'
    L.new(sep.outputs['Z'], z2.inputs[0]); L.new(sep.outputs['Z'], z2.inputs[1])
    s = N.new('ShaderNodeMath'); s.operation = 'ADD'
    L.new(x2.outputs[0], s.inputs[0]); L.new(z2.outputs[0], s.inputs[1])
    rho = N.new('ShaderNodeMath'); rho.operation = 'SQRT'
    L.new(s.outputs[0], rho.inputs[0])
    front = N.new('ShaderNodeMath'); front.operation = 'LESS_THAN'
    L.new(sep.outputs['Y'], front.inputs[0]); front.inputs[1].default_value = 0.0

    def ramp(inp, stops):
        r = N.new('ShaderNodeValToRGB')
        cr = r.color_ramp
        cr.interpolation = 'EASE'
        cr.elements[0].position = stops[0][0]; cr.elements[0].color = stops[0][1]
        cr.elements[1].position = stops[1][0]; cr.elements[1].color = stops[1][1]
        for pos, col in stops[2:]:
            e = cr.elements.new(pos); e.color = col
        L.new(inp, r.inputs[0])
        return r

    ir = iris
    dark = tuple(c * 0.35 for c in ir)
    col = ramp(rho.outputs[0], [
        (0.0, (0.01, 0.01, 0.012, 1)),
        (0.150, (0.01, 0.01, 0.012, 1)),
        (0.175, (ir[0] * 0.7, ir[1] * 0.7, ir[2] * 0.7, 1)),
        (0.30, (ir[0], ir[1], ir[2], 1)),
        (0.415, (ir[0] * 0.8, ir[1] * 0.8, ir[2] * 0.8, 1)),
        (0.455, (dark[0], dark[1], dark[2], 1)),
        (0.475, (0.80, 0.76, 0.72, 1)),
        (0.80, (0.86, 0.80, 0.77, 1)),
        (1.0, (0.80, 0.60, 0.58, 1)),
    ])
    # iris streak noise
    noise = N.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 60.0
    noise.inputs['Detail'].default_value = 2.0
    L.new(tc.outputs['Object'], noise.inputs['Vector'])
    irismask = N.new('ShaderNodeMath'); irismask.operation = 'LESS_THAN'
    L.new(rho.outputs[0], irismask.inputs[0]); irismask.inputs[1].default_value = 0.46
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    L.new(irismask.outputs[0], mul.inputs[0]); L.new(front.outputs[0], mul.inputs[1])
    nf = N.new('ShaderNodeMath'); nf.operation = 'MULTIPLY'
    L.new(mul.outputs[0], nf.inputs[0]); nf.inputs[1].default_value = 0.35
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'OVERLAY'
    L.new(nf.outputs[0], mix.inputs['Factor'])
    L.new(col.outputs['Color'], mix.inputs['A'])
    L.new(noise.outputs['Color'], mix.inputs['B'])
    # back hemisphere -> sclera colour
    mix2 = N.new('ShaderNodeMix'); mix2.data_type = 'RGBA'
    L.new(front.outputs[0], mix2.inputs['Factor'])
    mix2.inputs['A'].default_value = (0.80, 0.62, 0.60, 1)
    L.new(mix.outputs['Result'], mix2.inputs['B'])
    L.new(mix2.outputs['Result'], bsdf.inputs['Base Color'])
    return m


def make_eyeball(name, center, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = name
    # rotate mesh so a pole points along -Y (nicer iris topology)
    me = ob.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    co = co[:, [0, 2, 1]] * np.array([1, -1, 1])
    me.vertices.foreach_set('co', co.ravel())
    me.update()
    bpy.ops.object.shade_smooth()
    me.materials.append(mat)
    ob.location = center
    return ob


def lid_mesh(name, radius_in, radius_out, upper=True, el_edge=0.0, curve=0.5,
             az_max=1.30, el_far=1.7, n_az=40, n_el=14, n_rim=6):
    """Spherical shell lid around the origin, gaze -Y.

    Upper lid covers elevations above edge(az) = el_edge - curve*(az/az_max)^2;
    lower lid covers below edge(az) = el_edge + curve*(az/az_max)^2.
    """
    sgn = 1.0 if upper else -1.0
    azs = np.linspace(-az_max, az_max, n_az)
    rows = []  # list of (radius, el_offset_func) rows from far outer -> edge -> far inner
    prof = []
    # outer surface: from far to edge
    for i in range(n_el):
        t = i / (n_el - 1)
        prof.append(('o', t))
    for j in range(1, n_rim):
        prof.append(('r', j / n_rim))
    for i in range(n_el):
        t = 1 - i / (n_el - 1)
        prof.append(('i', t))
    rim_r = 0.5 * (radius_out - radius_in)
    rmid = 0.5 * (radius_out + radius_in)
    V = []
    rimattr = []
    for kind, t in prof:
        for az in azs:
            edge = el_edge - sgn * curve * (az / az_max) ** 2
            far = sgn * el_far
            if kind in ('o', 'i'):
                el = far + (edge - far) * (t ** 0.8)
                r = radius_out if kind == 'o' else radius_in
                rim = max(0.0, (t - 0.8) / 0.2)
            else:
                # half-circle rim in the (r, el) plane, bulging past the edge
                ang = math.pi * t
                r = rmid + rim_r * math.cos(ang)
                el = edge - sgn * (rim_r * math.sin(ang)) / rmid
                rim = 1.0
            ca = math.cos(el)
            V.append((r * math.sin(az) * ca, -r * math.cos(az) * ca, r * math.sin(el)))
            rimattr.append(rim)
    ncols = n_az
    nrows = len(prof)
    F = []
    for rr in range(nrows - 1):
        for c in range(ncols - 1):
            a = rr * ncols + c
            b = a + 1
            d = a + ncols
            e = d + 1
            F.append((a, b, e, d) if upper else (a, d, e, b))
    return _mesh_from(name, V, F, {'rim': rimattr})


def make_lids(prefix, center, eye_r, mat, upper_el=0.21, lower_el=-0.42):
    up = lid_mesh(prefix + '_lidU', eye_r + 0.0005, eye_r + 0.0017, True, el_edge=0.0, curve=0.24,
                  az_max=1.45)
    lo = lid_mesh(prefix + '_lidD', eye_r + 0.0004, eye_r + 0.0014, False, el_edge=0.0, curve=0.20,
                  az_max=1.45)
    obs = []
    for me, el in ((up, upper_el), (lo, lower_el)):
        me.materials.append(mat)
        ob = bpy.data.objects.new(me.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = center
        ob.rotation_mode = 'XYZ'
        ob.rotation_euler = (-el, 0, 0)   # +x rotation moves the edge down
        obs.append(ob)
    return obs
