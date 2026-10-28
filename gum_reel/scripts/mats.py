"""Material / node helpers shared by world + props builders."""
import bpy


def principled(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color[:3], 1)
    b.inputs['Roughness'].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def node(m, typ, loc=(0, 0), **props):
    n = m.node_tree.nodes.new(typ)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n


def link(m, a, b):
    m.node_tree.links.new(a, b)


def sock(n, name, typ='RGBA', out=False):
    socks = n.outputs if out else n.inputs
    for so in socks:
        if so.name == name and so.type == typ and so.enabled:
            return so
    for so in socks:
        if so.name == name and so.type == typ:
            return so
    raise KeyError(name)


def mix_rgb(m, fac_socket, a, b, loc=(0, 0), blend='MIX'):
    mx = node(m, 'ShaderNodeMix', loc, data_type='RGBA', blend_type=blend)
    if isinstance(a, tuple):
        sock(mx, 'A').default_value = (*a[:3], 1)
    else:
        link(m, a, sock(mx, 'A'))
    if isinstance(b, tuple):
        sock(mx, 'B').default_value = (*b[:3], 1)
    else:
        link(m, b, sock(mx, 'B'))
    if isinstance(fac_socket, (int, float)):
        sock(mx, 'Factor', 'VALUE').default_value = fac_socket
    else:
        link(m, fac_socket, sock(mx, 'Factor', 'VALUE'))
    return sock(mx, 'Result', out=True)


def coord(m, kind='Object', loc=(-1200, 0)):
    tc = node(m, 'ShaderNodeTexCoord', loc)
    return tc.outputs[kind]


def noise(m, vec, scale, detail=2.0, rough=0.5, loc=(0, 0)):
    n = node(m, 'ShaderNodeTexNoise', loc)
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    if vec is not None:
        link(m, vec, n.inputs['Vector'])
    return n


def ramp(m, fac, stops, loc=(0, 0)):
    r = node(m, 'ShaderNodeValToRGB', loc)
    el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1][:3], 1)
    el[1].position, el[1].color = stops[-1][0], (*stops[-1][1][:3], 1)
    for p, c in stops[1:-1]:
        e = el.new(p); e.color = (*c[:3], 1)
    link(m, fac, r.inputs['Fac'])
    return r


def bump(m, height, strength=0.3, loc=(0, -400)):
    b = node(m, 'ShaderNodeBump', loc)
    b.inputs['Strength'].default_value = strength
    link(m, height, b.inputs['Height'])
    link(m, b.outputs['Normal'], bsdf(m).inputs['Normal'])
    return b


def emission_mat(name, color, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color[:3], 1)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m
