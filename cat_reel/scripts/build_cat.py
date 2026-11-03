"""Build the reusable CuteCat (chibi orange tabby) and save it as cute_cat.blend.

    blender -b --python build_cat.py -- <out.blend>

Everything is made from primitives: quad-spheres, lofted rings and curves,
smooth shaded with Subdivision Surface. The rig has bones for root, body, head,
ears, eyes (blink), mouth (hiss / meow), 4 legs + paws and a 4-bone tail.
Actions: walk_cycle, sit, look_around, tail_swish, blink, hiss (stored on muted
NLA tracks so appending the CuteCat collection brings them along).
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catlib as C  # noqa: E402
from catlib import (N, M, VM, SEP, COMB, SMOOTH, MIXC, RGB, VALUE, ELLIPSE_MASK, setin,
                    sock_out, hexcol, new_material, principled, output, quad_sphere,
                    make_obj, frame_from_forward, frame_from_up)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), '..', 'cute_cat.blend')

PAL = dict(
    fur='#F69A42', stripe='#CC6324', white='#FFF6EC', blush='#FF8DA4',
    nose='#F58799', ear_pink='#F7A3B5', mouth='#4A2820', mouth_in='#5E1A26',
    tongue='#F2788B', fang='#FFFFFF', iris_top='#2F6A2E', iris_bot='#B9E46F',
    pupil='#06060A', eye_rim='#16301A')

HEAD_C = Vector((0.0, -0.105, 0.262))
BODY_C = Vector((0.0, 0.005, 0.123))

# ----------------------------------------------------------------------------
# reset file
# ----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = 'CuteCat'
cat_coll = bpy.data.collections.new('CuteCat')
scene.collection.children.link(cat_coll)


def loft(rings, cap_start=True, cap_end=True, attr=None, attr_vals=None):
    """Connect rings (lists of Vectors, same length) with quads; fan caps."""
    bm = bmesh.new()
    lay = bm.verts.layers.float.new(attr) if attr else None
    vrings = []
    for ri, ring in enumerate(rings):
        vr = [bm.verts.new(p) for p in ring]
        if lay:
            for v in vr:
                v[lay] = attr_vals[ri]
        vrings.append(vr)
    n = len(rings[0])
    for a, b in zip(vrings[:-1], vrings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap_start:
        c = bm.verts.new(sum(rings[0], Vector()) / n)
        if lay:
            c[lay] = attr_vals[0]
        for i in range(n):
            bm.faces.new((vrings[0][(i + 1) % n], vrings[0][i], c))
    if cap_end:
        c = bm.verts.new(sum(rings[-1], Vector()) / n)
        if lay:
            c[lay] = attr_vals[-1]
        for i in range(n):
            bm.faces.new((vrings[-1][i], vrings[-1][(i + 1) % n], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def ellipsoid(r, cuts=4):
    bm = quad_sphere(cuts)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    return bm


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------

def fur_bsdf(nt, coord, stripe, white, blush=0.0, rough=0.62, fine_scale=230.0):
    base = RGB(nt, hexcol(PAL['fur']))
    col = MIXC(nt, stripe, base, hexcol(PAL['stripe']))
    col = MIXC(nt, white, col, hexcol(PAL['white']))
    if not isinstance(blush, float) or blush > 0:
        col = MIXC(nt, M(nt, 'MULTIPLY', blush, 0.62), col, hexcol(PAL['blush']))
    nz = N(nt, 'ShaderNodeTexNoise')
    setin(nt, nz, 'Vector', coord)
    setin(nt, nz, 'Scale', fine_scale)
    setin(nt, nz, 'Detail', 4.0)
    setin(nt, nz, 'Roughness', 0.62)
    var = M(nt, 'MULTIPLY_ADD', sock_out(nz, 'Fac'), 0.18, 0.91)
    col = MIXC(nt, 1.0, col, COMB(nt, var, var, var), blend='MULTIPLY')
    # big soft colour variation (darker back, lighter belly is done by masks)
    lw = N(nt, 'ShaderNodeLayerWeight')
    setin(nt, lw, 'Blend', 0.3)
    rim = M(nt, 'MULTIPLY', M(nt, 'POWER', sock_out(lw, 'Facing'), 2.2), 0.42)
    lighter = MIXC(nt, 0.45, col, hexcol('#FFF1DC'))
    col = MIXC(nt, rim, col, lighter)
    bump = N(nt, 'ShaderNodeBump')
    setin(nt, bump, 'Strength', 0.12)
    setin(nt, bump, 'Distance', 0.0015)
    setin(nt, bump, 'Height', sock_out(nz, 'Fac'))
    b = principled(nt, col, rough)
    setin(nt, b, 'Specular IOR Level', 0.32)
    setin(nt, b, 'Sheen Weight', 0.55)
    setin(nt, b, 'Sheen Roughness', 0.32)
    setin(nt, b, 'Normal', sock_out(bump, 'Normal'))
    return sock_out(b, 'BSDF')


def stripes_1d(nt, coord_scalar, period, width=0.28, noise_vec=None, distort=0.0):
    """dark bands along a scalar coordinate. returns 0..1 (1 = stripe)."""
    ph = M(nt, 'MULTIPLY', coord_scalar, 2 * math.pi / period)
    if noise_vec is not None and distort:
        nz = N(nt, 'ShaderNodeTexNoise')
        setin(nt, nz, 'Vector', noise_vec)
        setin(nt, nz, 'Scale', 18.0)
        setin(nt, nz, 'Detail', 2.0)
        ph = M(nt, 'ADD', ph, M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', sock_out(nz, 'Fac'), 0.5), distort))
    s = M(nt, 'MULTIPLY_ADD', M(nt, 'SINE', ph), 0.5, 0.5)
    return SMOOTH(nt, s, 1.0 - width, 1.0 - width + 0.12)


def mat_head(blush_pts):
    mat, nt = new_material('Cat_Fur_Head')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    # forehead stripes (vertical bands converging to an "M")
    fx = M(nt, 'MULTIPLY', x, M(nt, 'ADD', 1.0, M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', z, 0.03), 4.0)))
    fore = stripes_1d(nt, fx, 0.026, width=0.24, noise_vec=p, distort=1.2)
    fore_mask = M(nt, 'MULTIPLY', SMOOTH(nt, z, 0.04, 0.062),
                  M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'ABSOLUTE', x), 0.03, 0.052)))
    fore = M(nt, 'MULTIPLY', fore, fore_mask)
    # cheek stripes (horizontal) on the sides
    cheek = stripes_1d(nt, M(nt, 'ADD', z, 0.004), 0.021, width=0.24, noise_vec=p, distort=0.9)
    cheek_mask = M(nt, 'MULTIPLY', SMOOTH(nt, M(nt, 'ABSOLUTE', x), 0.083, 0.1),
                   M(nt, 'MULTIPLY', SMOOTH(nt, z, -0.06, -0.04), M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, z, 0.0, 0.02))))
    cheek = M(nt, 'MULTIPLY', cheek, M(nt, 'MULTIPLY', cheek_mask, SMOOTH(nt, y, -0.075, -0.04)))
    stripe = M(nt, 'MAXIMUM', fore, cheek)
    # white muzzle (two puffs) + chin
    m1 = ELLIPSE_MASK(nt, p, (0.021, -0.085, -0.058), (0.036, 0.05, 0.03), 0.4)
    m2 = ELLIPSE_MASK(nt, p, (-0.021, -0.085, -0.058), (0.036, 0.05, 0.03), 0.4)
    m3 = ELLIPSE_MASK(nt, p, (0.0, -0.06, -0.085), (0.05, 0.07, 0.03), 0.5)
    white = M(nt, 'MAXIMUM', M(nt, 'MAXIMUM', m1, m2), m3)
    # blush
    b1 = ELLIPSE_MASK(nt, p, tuple(blush_pts[0]), (0.021, 0.02, 0.016), 0.9)
    b2 = ELLIPSE_MASK(nt, p, tuple(blush_pts[1]), (0.021, 0.02, 0.016), 0.9)
    blush = M(nt, 'MAXIMUM', b1, b2)
    output(nt, fur_bsdf(nt, p, stripe, white, blush))
    return mat


def mat_body():
    mat, nt = new_material('Cat_Fur_Body')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    # bands across the back, bending down the flanks
    yy = M(nt, 'ADD', y, M(nt, 'MULTIPLY', M(nt, 'ABSOLUTE', x), 0.35))
    st = stripes_1d(nt, yy, 0.036, width=0.27, noise_vec=p, distort=1.4)
    back_mask = SMOOTH(nt, z, -0.035, 0.01)
    stripe = M(nt, 'MULTIPLY', st, back_mask)
    # dorsal darker line
    dorsal = M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'ABSOLUTE', x), 0.008, 0.02)),
               SMOOTH(nt, z, 0.04, 0.06))
    stripe = M(nt, 'MAXIMUM', stripe, M(nt, 'MULTIPLY', dorsal, 0.7))
    chest = ELLIPSE_MASK(nt, p, (0.0, -0.11, -0.005), (0.05, 0.06, 0.06), 0.45)
    belly = ELLIPSE_MASK(nt, p, (0.0, -0.01, -0.075), (0.055, 0.105, 0.035), 0.5)
    white = M(nt, 'MAXIMUM', chest, belly)
    output(nt, fur_bsdf(nt, p, stripe, white))
    return mat


def mat_leg():
    mat, nt = new_material('Cat_Fur_Leg')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    st = stripes_1d(nt, z, 0.026, width=0.22, noise_vec=p, distort=1.0)
    st = M(nt, 'MULTIPLY', st, M(nt, 'MULTIPLY', SMOOTH(nt, z, -0.05, -0.04), M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, z, -0.022, -0.012))))
    st = M(nt, 'MULTIPLY', st, 0.75)
    sock = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, z, -0.062, -0.05))
    output(nt, fur_bsdf(nt, p, st, sock))
    return mat


def mat_tail():
    mat, nt = new_material('Cat_Fur_Tail')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    at = N(nt, 'ShaderNodeAttribute')
    at.attribute_type = 'GEOMETRY'
    at.attribute_name = 'tail_t'
    t = sock_out(at, 'Fac')
    st = stripes_1d(nt, t, 0.14, width=0.3, noise_vec=p, distort=0.8)
    st = M(nt, 'MULTIPLY', st, SMOOTH(nt, t, 0.08, 0.18))
    tip = SMOOTH(nt, t, 0.88, 0.95)
    stripe = M(nt, 'MAXIMUM', st, M(nt, 'MULTIPLY', tip, 0.85))
    output(nt, fur_bsdf(nt, p, stripe, 0.0))
    return mat


def mat_ear():
    mat, nt = new_material('Cat_Ear')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    # inner pink triangle on the front face (local -Y), shrinking towards the tip
    half = M(nt, 'MULTIPLY', 0.030, M(nt, 'SUBTRACT', 1.0, M(nt, 'DIVIDE', z, 0.066)))
    inside = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'SUBTRACT', M(nt, 'ABSOLUTE', x), half), -0.004, 0.002))
    front = SMOOTH(nt, y, 0.002, -0.004)
    lowcut = SMOOTH(nt, z, 0.004, 0.012)
    pink = M(nt, 'MULTIPLY', M(nt, 'MULTIPLY', inside, front), lowcut)
    # orange outside with stripes at the base
    furc = fur_bsdf(nt, p, 0.0, 0.0)
    pinkcol = MIXC(nt, SMOOTH(nt, z, 0.0, 0.06), hexcol(PAL['ear_pink']), hexcol('#FFC4CF'))
    pb = principled(nt, pinkcol, 0.55)
    setin(nt, pb, 'Sheen Weight', 0.3)
    mix = N(nt, 'ShaderNodeMixShader')
    nt.links.new(pink, mix.inputs[0])
    nt.links.new(furc, mix.inputs[1])
    nt.links.new(sock_out(pb, 'BSDF'), mix.inputs[2])
    output(nt, mix.outputs[0])
    return mat


def mat_simple(name, col, rough=0.5, **kw):
    mat, nt = new_material(name)
    b = principled(nt, hexcol(col) if isinstance(col, str) else col, rough)
    for k, v in kw.items():
        setin(nt, b, k, v)
    output(nt, sock_out(b, 'BSDF'))
    return mat


def mat_paw():
    mat, nt = new_material('Cat_Paw')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    # two little toe grooves on the top-front of the paw
    g1 = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'ABSOLUTE', M(nt, 'SUBTRACT', x, 0.0085)), 0.0009, 0.0022))
    g2 = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'ABSOLUTE', M(nt, 'ADD', x, 0.0085)), 0.0009, 0.0022))
    zone = M(nt, 'MULTIPLY', SMOOTH(nt, y, -0.012, -0.024), SMOOTH(nt, z, -0.004, 0.006))
    groove = M(nt, 'MULTIPLY', M(nt, 'MAXIMUM', g1, g2), zone)
    col = MIXC(nt, M(nt, 'MULTIPLY', groove, 0.55), hexcol(PAL['white']), hexcol('#C9B8A8'))
    lw = N(nt, 'ShaderNodeLayerWeight')
    rim = M(nt, 'MULTIPLY', M(nt, 'POWER', sock_out(lw, 'Facing'), 2.0), 0.3)
    col = MIXC(nt, rim, col, hexcol('#FFFFFF'))
    nz = N(nt, 'ShaderNodeTexNoise')
    setin(nt, nz, 'Vector', p)
    setin(nt, nz, 'Scale', 260.0)
    bump = N(nt, 'ShaderNodeBump')
    setin(nt, bump, 'Strength', 0.1)
    setin(nt, bump, 'Distance', 0.0015)
    setin(nt, bump, 'Height', sock_out(nz, 'Fac'))
    b = principled(nt, col, 0.6)
    setin(nt, b, 'Sheen Weight', 0.5)
    setin(nt, b, 'Specular IOR Level', 0.3)
    setin(nt, b, 'Normal', sock_out(bump, 'Normal'))
    output(nt, sock_out(b, 'BSDF'))
    return mat


def drv_bone(sock, rig, bone, ttype):
    fc = sock.driver_add('default_value')
    d = fc.driver
    d.type = 'SUM'
    v = d.variables.new()
    v.name = 'x'
    v.type = 'TRANSFORMS'
    t = v.targets[0]
    t.id = rig
    t.bone_target = bone
    t.transform_type = ttype
    t.transform_space = 'LOCAL_SPACE'


def mat_eye(rig, ex, ez, side):
    """Big shiny chibi eye: iris, big pupil, 2 highlights, shader eyelids driven by
    the lid.<side> bone (loc.y = blink, loc.x = slit pupils, rot.z = angry lids) and an
    optional rainbow hypno spiral (rig['spiral_eyes'])."""
    sgn = 1.0 if side == 'L' else -1.0
    mat, nt = new_material('Cat_Eye.' + side)
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    u = M(nt, 'DIVIDE', x, ex)
    v = M(nt, 'DIVIDE', z, ez)
    r = M(nt, 'SQRT', M(nt, 'ADD', M(nt, 'MULTIPLY', u, u), M(nt, 'MULTIPLY', v, v)))
    ang = M(nt, 'ARCTAN2', v, u)
    blink = VALUE(nt, 0.0, 'Blink')
    slit = VALUE(nt, 0.0, 'Slit')
    angry = VALUE(nt, 0.0, 'Angry')
    drv_bone(blink.outputs[0], rig, 'lid.' + side, 'LOC_Y')
    drv_bone(slit.outputs[0], rig, 'lid.' + side, 'LOC_X')
    drv_bone(angry.outputs[0], rig, 'lid.' + side, 'ROT_Z')
    b_, sl_, an_ = blink.outputs[0], slit.outputs[0], angry.outputs[0]
    # iris gradient + radial streaks
    g = SMOOTH(nt, v, 0.55, -0.9)
    iris = MIXC(nt, g, hexcol(PAL['iris_top']), hexcol(PAL['iris_bot']))
    nz = N(nt, 'ShaderNodeTexNoise')
    setin(nt, nz, 'Vector', COMB(nt, M(nt, 'MULTIPLY', ang, 3.0), M(nt, 'MULTIPLY', r, 0.6), 0.0))
    setin(nt, nz, 'Scale', 6.0)
    setin(nt, nz, 'Detail', 3.0)
    streak = M(nt, 'MULTIPLY_ADD', sock_out(nz, 'Fac'), 0.6, 0.7)
    iris = MIXC(nt, 1.0, iris, COMB(nt, streak, streak, streak), blend='MULTIPLY')
    # big pupil (narrows to a slit with the Slit control)
    pw = M(nt, 'MULTIPLY_ADD', sl_, -0.46, 0.66)
    ph = M(nt, 'MULTIPLY_ADD', sl_, 0.12, 0.80)
    pu = M(nt, 'DIVIDE', u, pw)
    pv = M(nt, 'DIVIDE', M(nt, 'SUBTRACT', v, 0.05), ph)
    pd = M(nt, 'SQRT', M(nt, 'ADD', M(nt, 'MULTIPLY', pu, pu), M(nt, 'MULTIPLY', pv, pv)))
    pupil = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, pd, 0.955, 1.02))
    col = MIXC(nt, pupil, iris, hexcol(PAL['pupil']))
    rim = SMOOTH(nt, r, 0.84, 0.99)
    col = MIXC(nt, M(nt, 'MULTIPLY', rim, 0.85), col, hexcol(PAL['eye_rim']))
    # two highlights (big + small)
    d1 = VM(nt, 'DISTANCE', COMB(nt, u, v, 0.0), (0.30, 0.37, 0.0))
    d2 = VM(nt, 'DISTANCE', COMB(nt, u, v, 0.0), (-0.31, -0.33, 0.0))
    h1 = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, d1, 0.205, 0.245))
    h2 = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, d2, 0.085, 0.11))
    hl = M(nt, 'MAXIMUM', h1, h2)
    # spiral (hypno) mode
    smix = VALUE(nt, 0.0, 'SpiralMix')
    sph = VALUE(nt, 0.0, 'SpiralPhase')
    fc = smix.outputs[0].driver_add('default_value')
    drv = fc.driver
    drv.type = 'SUM'
    var = drv.variables.new()
    var.name = 'spiral'
    var.type = 'SINGLE_PROP'
    var.targets[0].id_type = 'OBJECT'
    var.targets[0].id = rig
    var.targets[0].data_path = '["spiral_eyes"]'
    fc2 = sph.outputs[0].driver_add('default_value')
    fc2.driver.type = 'SCRIPTED'
    fc2.driver.expression = 'frame*0.05'
    sm = smix.outputs[0]
    s = M(nt, 'ADD', M(nt, 'MULTIPLY', ang, 2.0 / (2 * math.pi)), M(nt, 'MULTIPLY', r, 2.1))
    s = M(nt, 'SUBTRACT', s, sph.outputs[0])
    f = M(nt, 'FRACT', s)
    tri = M(nt, 'MULTIPLY', M(nt, 'ABSOLUTE', M(nt, 'SUBTRACT', f, 0.5)), 2.0)
    band = SMOOTH(nt, tri, 0.44, 0.56)
    hue = M(nt, 'FRACT', M(nt, 'ADD', M(nt, 'MULTIPLY', r, 0.7), M(nt, 'MULTIPLY', sph.outputs[0], -0.3)))
    hsv = N(nt, 'ShaderNodeCombineColor')
    hsv.mode = 'HSV'
    nt.links.new(hue, hsv.inputs[0])
    hsv.inputs[1].default_value = 1.0
    hsv.inputs[2].default_value = 1.0
    spiral_col = MIXC(nt, band, hsv.outputs[0], hexcol('#2A0A4A'))
    center = M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, r, 0.07, 0.12))
    spiral_col = MIXC(nt, center, spiral_col, hexcol('#FFFFFF'))
    col = MIXC(nt, sm, col, spiral_col)
    # eyelids (fur coloured) + lash line
    uu = M(nt, 'MULTIPLY', u, u)
    A = M(nt, 'MULTIPLY_ADD', b_, -1.52, 1.12)
    K = M(nt, 'MULTIPLY_ADD', b_, -0.72, 0.22)
    vedge = M(nt, 'ADD', A, M(nt, 'MULTIPLY', K, M(nt, 'SUBTRACT', 1.0, uu)))
    vedge = M(nt, 'ADD', vedge, M(nt, 'MULTIPLY', an_, M(nt, 'MULTIPLY_ADD', u, 0.62 * sgn, -0.66)))
    dv = M(nt, 'SUBTRACT', v, vedge)
    up = SMOOTH(nt, dv, -0.025, 0.025)
    low = M(nt, 'MULTIPLY', SMOOTH(nt, b_, 0.7, 0.93), M(nt, 'SUBTRACT', 1.0, up))
    lid = M(nt, 'MAXIMUM', up, low)
    lid_on = M(nt, 'MAXIMUM', SMOOTH(nt, b_, 0.04, 0.15), SMOOTH(nt, an_, 0.04, 0.15))
    lid = M(nt, 'MULTIPLY', lid, lid_on)
    stroke = M(nt, 'MULTIPLY', M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, M(nt, 'ABSOLUTE', dv), 0.05, 0.11)), lid_on)
    lidcol = MIXC(nt, SMOOTH(nt, v, -1.0, 1.0), hexcol('#F2A257'), hexcol('#E58B3A'))
    col = MIXC(nt, lid, col, lidcol)
    col = MIXC(nt, stroke, col, hexcol('#5A2E1C'))
    hl_eff = M(nt, 'MULTIPLY', hl, M(nt, 'SUBTRACT', 1.0, M(nt, 'MULTIPLY', sm, 0.55)))
    hl_eff = M(nt, 'MULTIPLY', hl_eff, M(nt, 'SUBTRACT', 1.0, M(nt, 'MAXIMUM', lid, stroke)))
    col = MIXC(nt, hl_eff, col, hexcol('#FFFFFF'))
    skin = M(nt, 'MAXIMUM', lid, stroke)
    b = principled(nt, col, M(nt, 'MULTIPLY_ADD', skin, 0.55, 0.05))
    setin(nt, b, 'Coat Weight', M(nt, 'SUBTRACT', 1.0, skin))
    setin(nt, b, 'Coat Roughness', 0.03)
    setin(nt, b, 'Specular IOR Level', M(nt, 'MULTIPLY_ADD', skin, -0.3, 0.6))
    setin(nt, b, 'Sheen Weight', M(nt, 'MULTIPLY', skin, 0.5))
    setin(nt, b, 'Emission Color', col)
    emis = M(nt, 'ADD', M(nt, 'MULTIPLY', hl_eff, 2.2),
             M(nt, 'MULTIPLY', M(nt, 'MULTIPLY', sm, 0.9), M(nt, 'SUBTRACT', 1.0, skin)))
    setin(nt, b, 'Emission Strength', emis)
    output(nt, sock_out(b, 'BSDF'))
    return mat


# ----------------------------------------------------------------------------
# geometry
# ----------------------------------------------------------------------------

def build_head():
    bm = quad_sphere(7)
    for v in bm.verts:
        x, y, z = v.co.x * 0.118, v.co.y * 0.098, v.co.z * 0.100
        if z < 0.01:                                  # chubby mochi cheeks
            k = min(1.0, (0.01 - z) / 0.075)
            x *= 1.0 + 0.11 * k
            y *= 1.0 + 0.03 * k
        if y < -0.05:                                 # flatter face plane
            y = -0.05 + (y + 0.05) * 0.8
        if z > 0.065:
            z = 0.065 + (z - 0.065) * 0.88
        if z < -0.07:                                 # rounder chin bottom
            z = -0.07 + (z + 0.07) * 0.85
        v.co = Vector((x, y, z))
    return bm


def build_body():
    bm = quad_sphere(6)
    for v in bm.verts:
        x, y, z = v.co.x * 0.074, v.co.y * 0.118, v.co.z * 0.070
        if z < 0:
            x *= 1.0 + 0.07 * (-z / 0.07)            # pear-shaped tummy
        if z < -0.034:
            z = -0.034 + (z + 0.034) * 0.75           # flat-ish bottom
        if y < -0.06:
            z += 0.012 * ((-0.06 - y) / 0.058)         # proud chest
        if y > 0.07:
            x *= 1.0 + 0.04 * ((y - 0.07) / 0.048)     # round haunches
        v.co = Vector((x, y, z))
    neck = ellipsoid((0.058, 0.056, 0.052), 4)
    me_tmp = bpy.data.meshes.new('tmp')
    bm_xform_ = Matrix.Translation((0.0, -0.066, 0.046))
    for v in neck.verts:
        v.co = bm_xform_ @ v.co
    neck.to_mesh(me_tmp)
    neck.free()
    bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
    return bm


def build_leg(radius, top=0.012, bottom=-(C.LEG_LEN - 0.013)):
    bm = quad_sphere(4)
    for v in bm.verts:
        x, y, z = v.co.x * radius, v.co.y * radius, v.co.z * radius
        z = z + (top if v.co.z > 0 else bottom)
        # slightly thicker at the top (shoulder / thigh)
        k = max(0.0, min(1.0, (z - bottom) / (top - bottom)))
        x *= 0.92 + 0.16 * k
        y *= 0.92 + 0.2 * k
        v.co = Vector((x, y, z))
    return bm


def build_ear():
    """Lofted, flattened, cupped cone. Local: base at z=0, axis +Z, front = -Y."""
    rings = []
    H, R = 0.07, 0.046
    levels = 10
    seg = 20
    for i in range(levels + 1):
        h = i / levels
        rr = R * (1.0 - h) ** 0.95 + 0.0035
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            x = math.cos(a) * rr
            y = math.sin(a) * rr * 0.48
            if y < 0:                          # cup the front face
                inner = max(0.0, 1.0 - abs(x) / (rr * 0.82))
                y *= 1.0 - 0.55 * inner * (1.0 - h * 0.7)
            ring.append(Vector((x, y, h * H)))
        rings.append(ring)
    return loft(rings, cap_start=True, cap_end=True)


def catmull(pts, t):
    n = len(pts) - 1
    seg = min(int(t * n), n - 1)
    lt = t * n - seg
    p0 = pts[max(seg - 1, 0)]
    p1 = pts[seg]
    p2 = pts[seg + 1]
    p3 = pts[min(seg + 2, n)]
    t2, t3 = lt * lt, lt * lt * lt
    return 0.5 * ((2 * p1) + (-p0 + p2) * lt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


TAIL_PTS = [Vector(p) for p in [(0, 0.095, 0.138), (0, 0.145, 0.156), (0, 0.192, 0.200),
                                 (0, 0.214, 0.260), (0, 0.205, 0.318), (0, 0.178, 0.350)]]


def tail_radius(t):
    base = 0.022 + 0.011 * math.sin(min(1.0, t / 0.75) * math.pi * 0.55)
    if t > 0.86:                                  # rounded tip
        k = (t - 0.86) / 0.14
        base *= math.sqrt(max(0.0, 1.0 - k * k)) * 0.85 + 0.15 * (1 - k)
    return base


def build_tail():
    rings, ts = [], []
    steps, seg = 36, 14
    for i in range(steps + 1):
        t = i / steps
        c = catmull(TAIL_PTS, t)
        c2 = catmull(TAIL_PTS, min(1.0, t + 0.01))
        c1 = catmull(TAIL_PTS, max(0.0, t - 0.01))
        tan = (c2 - c1).normalized()
        side = Vector((1, 0, 0))
        nrm = tan.cross(side).normalized()
        r = max(0.0012, tail_radius(t))
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            ring.append(c + side * math.cos(a) * r * 1.05 + nrm * math.sin(a) * r)
        rings.append(ring)
        ts.append(t)
    return loft(rings, cap_start=True, cap_end=True, attr='tail_t', attr_vals=ts)


def bvh_of(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def cast(bvh, origin, direction):
    loc, nor, _i, _d = bvh.ray_cast(Vector(origin), Vector(direction).normalized())
    if loc is None:
        raise RuntimeError(f'ray miss {origin} {direction}')
    return loc, nor


# --- create objects --------------------------------------------------------
mats = {}
head_bm = build_head()
head = make_obj('Cat_Head', head_bm, cat_coll, subsurf=2)
head.location = HEAD_C
bpy.context.view_layer.update()
hb = bvh_of(head)


def face_point(x, z):
    return cast(hb, (x, -0.5, z), (0, 1, 0))


eyeL_p, eyeL_n = face_point(0.049, -0.004)
eyeR_p, eyeR_n = face_point(-0.049, -0.004)
nose_p, nose_n = face_point(0.0, -0.041)
mouth_p, mouth_n = face_point(0.0, -0.069)
bl_L, _ = face_point(0.076, -0.04)
bl_R, _ = face_point(-0.076, -0.04)

EYE_R = (0.033, 0.016, 0.041)
eyes = []
for side, p, n in (('L', eyeL_p, eyeL_n), ('R', eyeR_p, eyeR_n)):
    nn = (n + Vector((0, -1.2, 0))).normalized()        # less sideways than the normal
    rot = frame_from_forward(nn)
    center = p - nn * (EYE_R[1] - 0.0048)
    e = make_obj(f'Cat_Eye.{side}', ellipsoid(EYE_R, 5), cat_coll, subsurf=2)
    e.matrix_world = Matrix.Translation(HEAD_C + center) @ rot.to_4x4()
    eyes.append(e)

# nose: rounded inverted triangle
nb = quad_sphere(4)
for v in nb.verts:
    x, y, z = v.co.x * 0.0135, v.co.y * 0.0072, v.co.z * 0.0094
    t = (v.co.z + 1.0) * 0.5
    x *= 0.5 + 0.5 * t
    v.co = Vector((x, y, z))
nose = make_obj('Cat_Nose', nb, cat_coll, subsurf=2)
nn = (nose_n + Vector((0, -0.6, 0))).normalized()
nose.matrix_world = Matrix.Translation(HEAD_C + nose_p + nn * 0.0008) @ frame_from_forward(nn).to_4x4()

# "w" mouth (curve with bevel), projected onto the face
cu = bpy.data.curves.new('Cat_MouthW', 'CURVE')
cu.dimensions = '3D'
cu.bevel_depth = 0.00135
cu.bevel_resolution = 3
cu.use_fill_caps = True
z0 = -0.0545
pts_w = []
for i in range(25):
    a = math.pi - math.pi * i / 24          # left arc: outer -> centre
    pts_w.append((-0.0078 + 0.0078 * math.cos(a), z0 - 0.0072 * math.sin(a) + 0.0016 * (1 - i / 24)))
left = pts_w[:25]   # right arc = mirror of the left one
right = [(-x, zz) for (x, zz) in reversed(left[:-1])]
pts_w = left + right
mw_center_local = None
spl = cu.splines.new('POLY')
spl.points.add(len(pts_w) - 1)
for i, (x, zz) in enumerate(pts_w):
    p, n = face_point(x, zz)
    q = p + n * 0.0009
    spl.points[i].co = (q.x, q.y, q.z, 1.0)
ph = cu.splines.new('POLY')
ph.points.add(5)
for i in range(6):
    zz = -0.0465 - (-0.0465 - z0) * i / 5
    p, n = face_point(0.0, zz)
    q = p + n * 0.0009
    ph.points[i].co = (q.x, q.y, q.z, 1.0)
mouth_w = bpy.data.objects.new('Cat_MouthW', cu)
cat_coll.objects.link(mouth_w)
mouth_w.location = HEAD_C
mw_center = HEAD_C + face_point(0.0, z0)[0]

# open mouth (hidden inside the head at rest; the 'mouth' bone pushes it out)
mo_bm = bmesh.new()
tmp = ellipsoid((0.029, 0.0078, 0.025), 4)
tmp.to_mesh(me_tmp := bpy.data.meshes.new('tmp'))
tmp.free()
mo_bm.from_mesh(me_tmp)
for f in mo_bm.faces:
    f.material_index = 0
tongue = ellipsoid((0.0145, 0.005, 0.0082), 3)
tongue.to_mesh(me_tmp)
tongue.free()
start = len(mo_bm.faces)
mo_bm.from_mesh(me_tmp)
mo_bm.faces.ensure_lookup_table()
for f in mo_bm.faces[start:]:
    f.material_index = 1
tv = set(v for f in mo_bm.faces[start:] for v in f.verts)
for v in tv:
    v.co += Vector((0.0, -0.0036, -0.0135))
for sx in (0.0115, -0.0115):
    fang = bmesh.new()
    bmesh.ops.create_cone(fang, cap_ends=True, cap_tris=False, segments=8, radius1=0.0032, radius2=0.0003, depth=0.0092)
    for v in fang.verts:
        v.co = Vector((v.co.x + sx, v.co.y - 0.0074, -v.co.z + 0.0058))
    fang.to_mesh(me_tmp)
    fang.free()
    s0 = len(mo_bm.faces)
    mo_bm.from_mesh(me_tmp)
    mo_bm.faces.ensure_lookup_table()
    for f in mo_bm.faces[s0:]:
        f.material_index = 2
bpy.data.meshes.remove(me_tmp)
mouth_open = make_obj('Cat_MouthOpen', mo_bm, cat_coll, subsurf=1)
mn = (mouth_n + Vector((0, -0.8, 0))).normalized()
MOUTH_VIS = HEAD_C + mouth_p - mn * 0.0052
MOUTH_PUSH = C.MOUTH_PUSH
mouth_open.matrix_world = (Matrix.Translation(MOUTH_VIS + Vector((0, MOUTH_PUSH, 0))) @
                           frame_from_forward(mn).to_4x4())

# ears
ears = []
for side, sx in (('L', 1), ('R', -1)):
    d = Vector((sx * math.sin(math.radians(36)), -0.05, math.cos(math.radians(36)))).normalized()
    p, n = cast(hb, d * 0.0, d)        # from head centre outward
    base = p - d * 0.012
    rot = frame_from_up(d, fwd_hint=(sx * 0.18, -1.0, 0.0))
    e = make_obj(f'Cat_Ear.{side}', build_ear(), cat_coll, subsurf=2)
    e.matrix_world = Matrix.Translation(HEAD_C + base) @ rot.to_4x4()
    ears.append((e, HEAD_C + base, d))

# cheek fluff tufts (joined into one object)
tb = bmesh.new()
me_tmp = bpy.data.meshes.new('tmp')
for sx in (1, -1):
    for (zz, ang, ln) in ((-0.03, -42, 0.017), (-0.052, -62, 0.014)):
        p, n = cast(hb, (sx * 0.5, -0.03, zz), (-sx, 0, 0))
        dirv = Vector((sx * math.cos(math.radians(ang)), -0.15, math.sin(math.radians(ang)))).normalized()
        c = bmesh.new()
        bmesh.ops.create_cone(c, cap_ends=True, cap_tris=False, segments=10, radius1=0.0125, radius2=0.0015, depth=ln)
        for v in c.verts:
            v.co.z += ln * 0.5
            v.co.y *= 0.42
        rot = frame_from_up(dirv, fwd_hint=(0, -1, 0))
        for v in c.verts:
            v.co = p - n * 0.0075 + rot @ v.co
        c.to_mesh(me_tmp)
        c.free()
        tb.from_mesh(me_tmp)
bpy.data.meshes.remove(me_tmp)
tufts = make_obj('Cat_CheekFluff', tb, cat_coll, subsurf=2)
tufts.location = HEAD_C

body = make_obj('Cat_Body', build_body(), cat_coll, subsurf=2)
body.location = BODY_C
bpy.context.view_layer.update()

legs = {}
for leg, piv in C.LEG_PIVOTS.items():
    rad = 0.0285 if '_f' in leg else 0.0315
    ob = make_obj(f'Cat_{leg}', build_leg(rad), cat_coll, subsurf=2)
    ob.location = piv
    paw = make_obj(f'Cat_{leg.replace("leg", "paw")}', ellipsoid((0.0285, 0.0335, 0.0215), 4), cat_coll, subsurf=2)
    paw.location = Vector((piv.x, piv.y - 0.006, C.PAW_H))
    legs[leg] = (ob, paw)

tail = make_obj('Cat_Tail', build_tail(), cat_coll, subsurf=2)

# ----------------------------------------------------------------------------
# armature
# ----------------------------------------------------------------------------
arm = bpy.data.armatures.new('CatRig')
rig = bpy.data.objects.new('CatRig', arm)
cat_coll.objects.link(rig)
rig.show_in_front = True
arm.display_type = 'STICK'
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.edit_bones


def bone(name, head_, tail_, parent=None, connect=False, deform=False):
    b = eb.new(name)
    b.head = Vector(head_)
    b.tail = Vector(tail_)
    b.roll = 0.0
    b.use_deform = deform
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b


bone('root', (0, 0, 0), (0, 0.12, 0))
bone('body', C.BODY_PIVOT, C.BODY_PIVOT + Vector((0, 0.155, 0)), 'root')
bone('head', (0, -0.09, 0.18), (0, -0.09, 0.262), 'body')
for e, base, d in ears:
    bone('ear.' + e.name[-1], base, base + d * 0.06, 'head')
for e in eyes:
    c = e.matrix_world.translation
    bone('eye.' + e.name[-1], c, c + Vector((0, 0, 0.02)), 'head')
    lc = c + Vector((0, -0.025, 0.045))
    bone('lid.' + e.name[-1], lc, lc + Vector((0, 0, 0.015)), 'head')
mo_c = mouth_open.matrix_world.translation
bone('mouth', mo_c, mo_c + Vector((0, 0, 0.02)), 'head')
bone('mouth_w', mw_center, mw_center + Vector((0, 0, 0.02)), 'head')
for leg, piv in C.LEG_PIVOTS.items():
    tip = Vector((piv.x, piv.y, C.PAW_H))
    bone(leg, piv, tip, 'body')
    pb_ = bone(leg.replace('leg', 'paw'), tip, tip + Vector((0, 0, -0.02)), leg, connect=True)
    pb_.inherit_scale = 'NONE'
tts = [0.06, 0.3, 0.53, 0.77, 1.0]
prev = 'body'
for i, name in enumerate(C.TAIL_BONES):
    bone(name, catmull(TAIL_PTS, tts[i]), catmull(TAIL_PTS, tts[i + 1]), prev, connect=(i > 0), deform=True)
    prev = name
bpy.ops.object.mode_set(mode='OBJECT')

# custom controls
rig['spiral_eyes'] = 0.0
rig.id_properties_ui('spiral_eyes').update(min=0.0, max=1.0, soft_min=0.0, soft_max=1.0,
                                             description='0 = normal eyes, 1 = rainbow hypno spirals')


def parent_to_bone(ob, bname):
    b = arm.bones[bname]
    world = ob.matrix_world.copy()
    tail_m = rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = bname
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = tail_m.inverted() @ world


for ob in (head, nose, tufts):
    parent_to_bone(ob, 'head')
parent_to_bone(mouth_w, 'mouth_w')
parent_to_bone(mouth_open, 'mouth')
for e in eyes:
    parent_to_bone(e, 'eye.' + e.name[-1])
for e, _b, _d in ears:
    parent_to_bone(e, 'ear.' + e.name[-1])
for ob in (body,):
    parent_to_bone(ob, 'body')
for leg, (ob, paw) in legs.items():
    parent_to_bone(ob, leg)
    parent_to_bone(paw, leg.replace('leg', 'paw'))

# tail skinning
tail.parent = rig
tail.parent_type = 'OBJECT'
tail.matrix_parent_inverse = Matrix.Identity(4)
for name in C.TAIL_BONES:
    tail.vertex_groups.new(name=name)
mods = tail.modifiers
sub = mods['Subsurf']
am = mods.new('Armature', 'ARMATURE')
am.object = rig
tail.modifiers.move(len(tail.modifiers) - 1, 0)
lay = tail.data.attributes['tail_t']
centers = [(tts[i] + tts[i + 1]) * 0.5 for i in range(4)]
for v in tail.data.vertices:
    t = lay.data[v.index].value
    ws = []
    for i, c in enumerate(centers):
        h = (tts[i + 1] - tts[i]) * 0.9
        ws.append(max(0.0, 1.0 - abs(t - c) / h))
    if t <= centers[0]:
        ws = [1, 0, 0, 0]
    if t >= centers[-1]:
        ws = [0, 0, 0, 1]
    s = sum(ws) or 1.0
    for i, w in enumerate(ws):
        if w > 0:
            tail.vertex_groups[C.TAIL_BONES[i]].add([v.index], w / s, 'REPLACE')

# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------
head_inv = Matrix.Translation(-HEAD_C)
blush_pts = [bl_L + Vector((0, -0.004, 0)), bl_R + Vector((0, -0.004, 0))]
m_head = mat_head(blush_pts)
m_body = mat_body()
m_leg = mat_leg()
m_tail = mat_tail()
m_ear = mat_ear()
m_paw = mat_paw()
m_eyes = {sd: mat_eye(rig, EYE_R[0], EYE_R[2], sd) for sd in ('L', 'R')}
m_nose = mat_simple('Cat_Nose', PAL['nose'], 0.28, **{'Coat Weight': 0.6, 'Coat Roughness': 0.15})
m_mouth = mat_simple('Cat_MouthLine', PAL['mouth'], 0.5)
m_mouth_in = mat_simple('Cat_MouthInside', PAL['mouth_in'], 0.45)
m_tongue = mat_simple('Cat_Tongue', PAL['tongue'], 0.35)
m_fang = mat_simple('Cat_Fang', PAL['fang'], 0.25)


def mat_fluff(name, colhex):
    mat, nt = new_material(name)
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    col_soc = None
    mat_ = mat
    b = fur_bsdf(nt, p, 0.0, 1.0 if colhex == 'white' else 0.0)
    output(nt, b)
    return mat_


m_fluff_head = mat_fluff('Cat_Fluff_Cheek', 'orange')

head.data.materials.append(m_head)
body.data.materials.append(m_body)
tail.data.materials.append(m_tail)
for e in eyes:
    e.data.materials.append(m_eyes[e.name[-1]])
for e, _b, _d in ears:
    e.data.materials.append(m_ear)
nose.data.materials.append(m_nose)
mouth_w.data.materials.append(m_mouth)
for m in (m_mouth_in, m_tongue, m_fang):
    mouth_open.data.materials.append(m)
tufts.data.materials.append(m_fluff_head)
for leg, (ob, paw) in legs.items():
    ob.data.materials.append(m_leg)
    paw.data.materials.append(m_paw)

# ----------------------------------------------------------------------------
# actions (stored on muted NLA tracks)
# ----------------------------------------------------------------------------
rig.animation_data_create()


def make_action(name, frames, state_fn, loop=False):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for f in range(frames[0], frames[1] + 1):
        st = state_fn(f)
        C.apply_state(rig, st)
        C.key_state(rig, f)
    if loop:
        act.use_cyclic = True
        act.use_frame_range = True
        act.frame_start, act.frame_end = frames[0], frames[1]
    tr = rig.animation_data.nla_tracks.new()
    tr.name = name
    strip = tr.strips.new(name, frames[0], act)
    tr.mute = True
    rig.animation_data.action = None
    return act


def st_walk(f):
    st = C.stand_state()
    C.walk_state(st, ((f - 1) % C.CYCLE) / C.CYCLE)
    return st


def st_sit(f):
    st = C.stand_state()
    C.sit_state(st, min(1.0, (f - 1) / 15.0))
    st.blink = C.blink_value(f, 20)
    return st


def st_look(f):
    st = C.stand_state()
    t = (f - 1) / 71.0
    keys = [(0, 0, 0, 0), (0.2, 0.55, -0.05, 0.12), (0.45, 0.55, -0.05, 0.12),
            (0.65, -0.5, 0.05, -0.12), (0.85, -0.5, 0.05, -0.12), (1.0, 0, 0, 0)]
    for (t0, y0, p0, r0), (t1, y1, p1, r1) in zip(keys[:-1], keys[1:]):
        if t0 <= t <= t1:
            k = C.ease((t - t0) / (t1 - t0))
            st.head_yaw, st.head_pitch, st.head_roll = C.lerp(y0, y1, k), C.lerp(p0, p1, k), C.lerp(r0, r1, k)
    st.blink = C.blink_value(f, 36)
    C.tail_state(st, f / 48.0, amp=0.12)
    return st


def st_tail(f):
    st = C.stand_state()
    C.tail_state(st, (f - 1) / 40.0, amp=0.42)
    return st


def st_blink(f):
    st = C.stand_state()
    st.blink = C.blink_value(f, 2, 7)
    return st


def st_hiss(f):
    st = C.stand_state()
    C.hiss_state(st, min(1.0, (f - 1) / 6.0))
    C.tail_state(st, f / 12.0, amp=0.18)
    return st


make_action('walk_cycle', (1, C.CYCLE), st_walk, loop=True)
make_action('sit', (1, 30), st_sit)
make_action('look_around', (1, 72), st_look)
make_action('tail_swish', (1, 40), st_tail, loop=True)
make_action('blink', (1, 10), st_blink)
make_action('hiss', (1, 30), st_hiss)

# leave the rig in rest pose
C.apply_state(rig, C.stand_state())
for pb in rig.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
for ob in cat_coll.objects:
    for md in ob.modifiers:
        if md.type == 'SUBSURF':
            md.levels = 1

# ----------------------------------------------------------------------------
# preview setup (separate collection – not part of the asset)
# ----------------------------------------------------------------------------
prev_coll = bpy.data.collections.new('Preview')
scene.collection.children.link(prev_coll)
world = bpy.data.worlds.new('PreviewWorld')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = hexcol('#D9E4F2')
bg.inputs['Strength'].default_value = 0.9
floor_me = bpy.data.meshes.new('PreviewFloor')
fb = bmesh.new()
bmesh.ops.create_grid(fb, x_segments=1, y_segments=1, size=3.0)
fb.to_mesh(floor_me)
fb.free()
floor = bpy.data.objects.new('PreviewFloor', floor_me)
prev_coll.objects.link(floor)
floor.data.materials.append(mat_simple('PreviewFloor', '#E8DCCB', 0.7))


def add_light(name, typ, loc, rot, energy, size=1.0, color='#FFFFFF'):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = energy
    ld.color = hexcol(color)[:3]
    if typ == 'AREA':
        ld.size = size
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = rot
    prev_coll.objects.link(ob)
    return ob


add_light('Key', 'AREA', (-0.9, -1.1, 1.3), (math.radians(52), 0, math.radians(-38)), 120, 1.2, '#FFF1E0')
add_light('Fill', 'AREA', (1.2, -0.8, 0.6), (math.radians(70), 0, math.radians(55)), 40, 1.5, '#E6F0FF')
add_light('Rim', 'AREA', (0.4, 1.0, 1.0), (math.radians(-55), 0, math.radians(160)), 70, 0.8, '#FFFFFF')
cam_d = bpy.data.cameras.new('PreviewCam')
cam_d.lens = 70
cam = bpy.data.objects.new('PreviewCam', cam_d)
prev_coll.objects.link(cam)
cam.location = (-0.55, -1.25, 0.42)
tgt = bpy.data.objects.new('PreviewTarget', None)
prev_coll.objects.link(tgt)
tgt.location = (0, -0.03, 0.2)
con = cam.constraints.new('TRACK_TO')
con.target = tgt
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'
scene.camera = cam
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 900
scene.render.resolution_y = 1100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy'
scene.frame_start, scene.frame_end = 1, 72

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT), compress=True)
print('SAVED', os.path.abspath(OUT))
print('EYES', [tuple(round(c, 4) for c in e.matrix_world.translation) for e in eyes])
