"""Procedural materials for the caveman (Eevee legacy friendly).

All masks use the 'rest' point attribute (rest-pose position in metres) so the
patterns stick to the skin while the mesh deforms.
"""
import math
import bpy
from common import NB, new_mat, principled

TAU = 2 * math.pi


def _sym(nb, rest):
    """rest with |x| so one mask covers both sides."""
    x, y, z = nb.sep(rest)
    ax = nb.math('ABSOLUTE', x)
    return nb.comb(ax, y, z), x, y, z


def _ball(nb, p, c, r, soft=0.0):
    d = nb.vmath('DISTANCE', p, c)
    return nb.smoothstep(d, r, r * soft)


def skin_material(name='skin'):
    m = new_mat(name, (0.80, 0.56, 0.44), 0.5)
    nb = NB(m)
    b = principled(m)
    rest = nb.attr('rest')
    ps, x, y, z = _sym(nb, rest)

    col = nb.rgb((0.77, 0.515, 0.385))
    # mottled variation
    noi = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 55.0, 'Detail': 2.0})
    var = nb.maprange(noi.outputs['Fac'], 0.3, 0.7, 0.93, 1.05)
    col = nb.mix(1.0, col, nb.comb(var, var, var), 'MULTIPLY')
    # rosy cheeks, nose, ears, lips
    rosy = nb.rgb((0.88, 0.40, 0.32))
    cheeks = _ball(nb, ps, (0.043, -0.074, 1.536), 0.030, 0.0)
    nose = _ball(nb, ps, (0.0, -0.112, 1.530), 0.026, 0.0)
    ears = _ball(nb, ps, (0.078, 0.014, 1.556), 0.040, 0.2)
    knuck = _ball(nb, ps, (0.0, -0.095, 1.493), 0.016, 0.2)
    f = nb.math('MAXIMUM', nb.math('MULTIPLY', cheeks, 0.62), nb.math('MULTIPLY', nose, 0.80))
    f = nb.math('MAXIMUM', f, nb.math('MULTIPLY', ears, 0.45))
    f = nb.math('MAXIMUM', f, nb.math('MULTIPLY', knuck, 0.40))
    col = nb.mix(f, col, rosy)
    # liver spots on the bald scalp
    vor = nb.node('ShaderNodeTexVoronoi', {'Vector': rest, 'Scale': 38.0})
    spot = nb.smoothstep(vor.outputs['Distance'], 0.16, 0.06)
    sx, sy, sz = nb.sep(vor.outputs['Color'])
    keep = nb.math('GREATER_THAN', sx, 0.72)
    scalp = nb.smoothstep(z, 1.615, 1.645)
    sp = nb.math('MULTIPLY', nb.math('MULTIPLY', spot, keep), nb.math('MULTIPLY', scalp, 0.55))
    col = nb.mix(sp, col, nb.rgb((0.55, 0.36, 0.24)))
    nb.link(col, b.inputs['Base Color'])

    # roughness: shiny bald head and nose tip
    rough = nb.maprange(scalp, 0, 1, 0.55, 0.44)
    rough = nb.math('SUBTRACT', rough, nb.math('MULTIPLY', nose, 0.12))
    nb.link(rough, b.inputs['Roughness'])
    b.inputs['Subsurface Weight'].default_value = 0.18
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
    b.inputs['Subsurface Scale'].default_value = 0.004
    b.inputs['Specular IOR Level'].default_value = 0.36

    # ---------------- wrinkles (bump)
    # forehead: horizontal grooves
    wav = nb.math('SINE', nb.math('MULTIPLY', x, 55.0))
    zz = nb.math('ADD', z, nb.math('MULTIPLY', wav, 0.0022))
    ph = nb.math('COSINE', nb.math('MULTIPLY', zz, TAU / 0.0088))
    groove = nb.math('POWER', nb.math('ADD', nb.math('MULTIPLY', ph, 0.5), 0.5), 10.0)
    brk = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 22.0, 'Detail': 1.0})
    groove = nb.math('MULTIPLY', groove, nb.smoothstep(brk.outputs['Fac'], 0.38, 0.58))
    fmask = nb.math('MULTIPLY', nb.smoothstep(z, 1.606, 1.616), nb.smoothstep(z, 1.652, 1.638))
    ax, _, _ = nb.sep(ps)
    fmask = nb.math('MULTIPLY', fmask, nb.smoothstep(ax, 0.056, 0.036))
    fmask = nb.math('MULTIPLY', fmask, nb.smoothstep(y, -0.045, -0.065))
    h_fore = nb.math('MULTIPLY', groove, fmask)
    # crow's feet: radial lines from the outer eye corner
    cx = nb.math('SUBTRACT', ax, 0.047)
    cz = nb.math('SUBTRACT', z, 1.5705)
    ang = nb.math('ARCTAN2', cz, cx)
    rad = nb.math('SQRT', nb.math('ADD', nb.math('MULTIPLY', cx, cx), nb.math('MULTIPLY', cz, cz)))
    rays = nb.math('POWER', nb.math('ADD', nb.math('MULTIPLY', nb.math('COSINE', nb.math('MULTIPLY', ang, 16.0)), 0.5), 0.5), 5.0)
    cmask = nb.math('MULTIPLY', nb.smoothstep(rad, 0.004, 0.008), nb.smoothstep(rad, 0.019, 0.011))
    cmask = nb.math('MULTIPLY', cmask, nb.smoothstep(cx, -0.004, 0.003))
    h_crow = nb.math('MULTIPLY', rays, cmask)
    # under-eye arcs
    ex = nb.math('SUBTRACT', ax, 0.032)
    ez = nb.math('SUBTRACT', z, 1.571)
    er = nb.math('SQRT', nb.math('ADD', nb.math('MULTIPLY', ex, ex), nb.math('MULTIPLY', ez, ez)))
    arcs = nb.math('POWER', nb.math('ADD', nb.math('MULTIPLY', nb.math('COSINE', nb.math('MULTIPLY', er, TAU / 0.0045)), 0.5), 0.5), 4.0)
    amask = nb.math('MULTIPLY', nb.smoothstep(er, 0.0145, 0.0165), nb.smoothstep(er, 0.027, 0.021))
    amask = nb.math('MULTIPLY', amask, nb.smoothstep(ez, -0.004, -0.010))
    h_arc = nb.math('MULTIPLY', arcs, amask)
    # neck rings
    nring = nb.math('POWER', nb.math('ADD', nb.math('MULTIPLY', nb.math('COSINE', nb.math('MULTIPLY', z, TAU / 0.011)), 0.5), 0.5), 6.0)
    nmask = nb.math('MULTIPLY', nb.smoothstep(z, 1.395, 1.41), nb.smoothstep(z, 1.47, 1.455))
    h_neck = nb.math('MULTIPLY', nring, nb.math('MULTIPLY', nmask, 0.7))
    h = nb.math('ADD', nb.math('ADD', nb.math('MULTIPLY', h_fore, 0.8), nb.math('MULTIPLY', h_crow, 0.45)), nb.math('ADD', nb.math('MULTIPLY', h_arc, 0.3), h_neck))
    h = nb.math('MULTIPLY', h, -1.0)
    # fine pores
    pores = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 900.0, 'Detail': 1.0})
    h = nb.math('ADD', h, nb.math('MULTIPLY', pores.outputs['Fac'], 0.12))
    bump = nb.node('ShaderNodeBump', {'Strength': 0.42, 'Distance': 0.0010})
    nb.link(h, bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def tunic_material(name='leopard'):
    m = new_mat(name, (0.58, 0.34, 0.15), 0.85)
    nb = NB(m)
    b = principled(m)
    rest = nb.attr('rest')
    warp = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 7.0, 'Detail': 2.0})
    wv = nb.vmath('SUBTRACT', warp.outputs['Color'], (0.5, 0.5, 0.5))
    p = nb.vmath('ADD', rest, nb.vmath('MULTIPLY', wv, (0.06, 0.06, 0.06)))
    vor = nb.node('ShaderNodeTexVoronoi', {'Vector': p, 'Scale': 7.0})
    rx, ry, rz = nb.sep(vor.outputs['Color'])
    spots = nb.smoothstep(vor.outputs['Distance'], 0.47, 0.37)
    spots = nb.math('MULTIPLY', spots, nb.math('GREATER_THAN', rx, 0.12))
    # irregular ragged spot edges
    edge = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 60.0, 'Detail': 2.0})
    spots = nb.math('MULTIPLY', spots, nb.maprange(edge.outputs['Fac'], 0.10, 0.30, 0.0, 1.0))
    base = nb.rgb((0.62, 0.335, 0.125))
    # warm variation over the hide
    var = nb.node('ShaderNodeTexNoise', {'Vector': rest, 'Scale': 14.0, 'Detail': 2.0})
    base = nb.mix(nb.maprange(var.outputs['Fac'], 0.3, 0.7, 0.0, 0.30), base, nb.rgb((0.70, 0.42, 0.18)))
    col = nb.mix(spots, base, nb.rgb((0.21, 0.095, 0.035)))
    # fur streaks (stretched noise)
    fur = nb.node('ShaderNodeTexNoise', {'Vector': nb.vmath('MULTIPLY', rest, (260.0, 260.0, 40.0)), 'Scale': 1.0,
                                        'Detail': 2.0})
    shade = nb.maprange(fur.outputs['Fac'], 0.25, 0.75, 0.82, 1.08)
    col = nb.mix(1.0, col, nb.comb(shade, shade, shade), 'MULTIPLY')
    nb.link(col, b.inputs['Base Color'])
    b.inputs['Sheen Weight'].default_value = 0.25
    b.inputs['Sheen Roughness'].default_value = 0.5
    b.inputs['Specular IOR Level'].default_value = 0.25
    bump = nb.node('ShaderNodeBump', {'Strength': 0.35, 'Distance': 0.002})
    nb.link(fur.outputs['Fac'], bump.inputs['Height'])
    nb.link(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def hair_material(name='hair', color=(0.80, 0.79, 0.76), root=(0.58, 0.54, 0.48)):
    m = new_mat(name, color, 0.45)
    nb = NB(m)
    b = principled(m)
    u = nb.attr('u', 'Fac')
    rnd = nb.attr('rand', 'Fac')
    c = nb.mix(nb.maprange(rnd, 0, 1, 0.0, 0.25), nb.rgb(color), nb.rgb((0.95, 0.93, 0.88)))
    c = nb.mix(nb.maprange(rnd, 0, 1, 0.0, 0.3), c, nb.rgb((0.72, 0.70, 0.66)))
    c = nb.mix(nb.smoothstep(u, 0.22, 0.0), c, nb.rgb(root))
    # fake cylindrical strand shading across the ribbon width
    v = nb.attr('v', 'Fac')
    cyl = nb.math('SINE', nb.math('MULTIPLY', v, math.pi))
    sh = nb.maprange(cyl, 0, 1, 0.62, 1.0)
    c = nb.mix(1.0, c, nb.comb(sh, sh, sh), 'MULTIPLY')
    nb.link(c, b.inputs['Base Color'])
    b.inputs['Sheen Weight'].default_value = 0.5
    b.inputs['Specular IOR Level'].default_value = 0.6
    b.inputs['Roughness'].default_value = 0.42
    m.use_backface_culling = False
    return m


def simple(name, color, rough=0.5, **kw):
    m = new_mat(name, color, rough)
    b = principled(m)
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m
