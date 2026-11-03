"""Set-building helpers: boxes, plush cushions, PBR (Poly Haven) materials, glTF import."""
import bpy
import bmesh
import math
import os
import glob
from mathutils import Vector, Matrix, Euler

from catlib import (N, M, VM, SEP, COMB, SMOOTH, MIXC, RGB, setin, sock_out, hexcol,
                    new_material, principled, output, quad_sphere)

ASSETS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))


# ----------------------------------------------------------------------------
# geometry
# ----------------------------------------------------------------------------

def add_box(bm, center, size, rot=(0, 0, 0)):
    m = (Matrix.Translation(Vector(center)) @ Euler(rot).to_matrix().to_4x4() @
         Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def mesh_obj(name, bm, coll, mats=(), smooth=True):
    me = bpy.data.meshes.new(name)
    for f in bm.faces:
        f.smooth = smooth
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def bevel(ob, width=0.01, segments=3, harden=True, angle=40):
    md = ob.modifiers.new('Bevel', 'BEVEL')
    md.width = width
    md.segments = segments
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle)
    md.harden_normals = harden
    md.use_clamp_overlap = True
    return md


def subsurf(ob, levels=2, view=1):
    md = ob.modifiers.new('Subsurf', 'SUBSURF')
    md.levels = view
    md.render_levels = levels
    return md


def box_obj(name, coll, center, size, mats=(), bev=0.01, seg=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    add_box(bm, (0, 0, 0), size)
    ob = mesh_obj(name, bm, coll, mats)
    ob.location = center
    ob.rotation_euler = rot
    if bev:
        bevel(ob, bev, seg)
    return ob


def cushion(name, coll, center, size, mats=(), puff=0.18, cuts=4, rot=(0, 0, 0), round_=0.5):
    """Plush cushion: subdivided cube, rounded and puffed, with subsurf."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    thin = min(range(3), key=lambda i: size[i])          # puff along the thinnest axis
    others = [i for i in range(3) if i != thin]
    for v in bm.verts:
        n = Vector(v.co)
        ln = max(abs(n.x), abs(n.y), abs(n.z))
        sph = n.normalized() * ln
        p = n.lerp(sph, round_ * 0.35)
        bulge = (1 - n[others[0]] ** 2) * (1 - n[others[1]] ** 2)
        p[thin] *= 1.0 + puff * bulge
        v.co = Vector((p.x * sx, p.y * sy, p.z * sz))
    ob = mesh_obj(name, bm, coll, mats)
    ob.location = center
    ob.rotation_euler = rot
    subsurf(ob, 2, 1)
    return ob


def cylinder(bm, center, radius, depth, segs=24, r2=None, rot=(0, 0, 0)):
    m = Matrix.Translation(Vector(center)) @ Euler(rot).to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius,
                          radius2=radius if r2 is None else r2, depth=depth, matrix=m)


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------

def _img(path, noncolor=False):
    img = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    return img


def tex_node(nt, path, vec, noncolor=False, proj='BOX', blend=0.25, x=-600, y=0):
    n = N(nt, 'ShaderNodeTexImage', x, y)
    n.image = _img(path, noncolor)
    n.projection = proj
    if proj == 'BOX':
        n.projection_blend = blend
    n.interpolation = 'Linear'
    nt.links.new(vec, n.inputs['Vector'])
    return n


def pbr(name, tex_id, scale=1.0, res='2k', tint=None, tint_mix=1.0, hue=None, sat=1.0, val=1.0,
        rough_mult=1.0, rough_add=0.0, nstr=1.0, proj='BOX', coords='Object', rot=(0, 0, 0),
        sheen=0.0, sheen_tint=None, coat=0.0, spec=0.5, offset=(0, 0, 0)):
    """Poly Haven PBR material using diff / nor_gl / rough maps with box projection."""
    mat, nt = new_material(name)
    d = os.path.join(ASSETS, 'textures', tex_id)

    def f(kind):
        c = glob.glob(os.path.join(d, f'{tex_id}_{kind}_*.jpg'))
        return c[0] if c else None
    tc = N(nt, 'ShaderNodeTexCoord', -1100, 0)
    mp = N(nt, 'ShaderNodeMapping', -900, 0)
    nt.links.new(tc.outputs[coords], mp.inputs['Vector'])
    mp.inputs['Scale'].default_value = (scale, scale, scale) if not isinstance(scale, tuple) else scale
    mp.inputs['Rotation'].default_value = rot
    mp.inputs['Location'].default_value = offset
    vec = mp.outputs['Vector']
    diff = tex_node(nt, f('diff'), vec, proj=proj, y=300)
    col = diff.outputs['Color']
    if hue is not None or sat != 1.0 or val != 1.0:
        hs = N(nt, 'ShaderNodeHueSaturation', -300, 300)
        hs.inputs['Hue'].default_value = 0.5 if hue is None else hue
        hs.inputs['Saturation'].default_value = sat
        hs.inputs['Value'].default_value = val
        nt.links.new(col, hs.inputs['Color'])
        col = hs.outputs['Color']
    if tint is not None:
        col = MIXC(nt, tint_mix, col, hexcol(tint), blend='MULTIPLY')
    b = principled(nt, col, 0.5, 0, 0)
    rp = f('rough')
    if rp:
        rough = tex_node(nt, rp, vec, noncolor=True, proj=proj, y=0)
        r = M(nt, 'MULTIPLY_ADD', rough.outputs['Color'], rough_mult, rough_add, clamp=True)
        setin(nt, b, 'Roughness', r)
    npth = f('nor_gl')
    if npth and nstr > 0:
        nrm = tex_node(nt, npth, vec, noncolor=True, proj=proj, y=-300)
        nm = N(nt, 'ShaderNodeNormalMap', -300, -300)
        nm.inputs['Strength'].default_value = nstr
        nt.links.new(nrm.outputs['Color'], nm.inputs['Color'])
        setin(nt, b, 'Normal', nm.outputs['Normal'])
    setin(nt, b, 'Specular IOR Level', spec)
    if sheen:
        setin(nt, b, 'Sheen Weight', sheen)
        setin(nt, b, 'Sheen Roughness', 0.35)
        if sheen_tint:
            setin(nt, b, 'Sheen Tint', hexcol(sheen_tint))
    if coat:
        setin(nt, b, 'Coat Weight', coat)
        setin(nt, b, 'Coat Roughness', 0.08)
    output(nt, sock_out(b, 'BSDF'), 300, 0)
    return mat


def solid(name, col, rough=0.5, metal=0.0, emit=None, emit_str=0.0, sheen=0.0, coat=0.0, spec=0.5,
          noise_bump=0.0, noise_scale=60.0):
    mat, nt = new_material(name)
    b = principled(nt, hexcol(col) if isinstance(col, str) else col, rough, 0, 0)
    setin(nt, b, 'Metallic', metal)
    setin(nt, b, 'Specular IOR Level', spec)
    if emit:
        setin(nt, b, 'Emission Color', hexcol(emit))
        setin(nt, b, 'Emission Strength', emit_str)
    if sheen:
        setin(nt, b, 'Sheen Weight', sheen)
        setin(nt, b, 'Sheen Roughness', 0.4)
    if coat:
        setin(nt, b, 'Coat Weight', coat)
        setin(nt, b, 'Coat Roughness', 0.1)
    if noise_bump:
        tc = N(nt, 'ShaderNodeTexCoord', -700, -300)
        nz = N(nt, 'ShaderNodeTexNoise', -500, -300)
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        nz.inputs['Scale'].default_value = noise_scale
        nz.inputs['Detail'].default_value = 6.0
        bp = N(nt, 'ShaderNodeBump', -300, -300)
        bp.inputs['Strength'].default_value = noise_bump
        bp.inputs['Distance'].default_value = 0.002
        nt.links.new(sock_out(nz, 'Fac'), bp.inputs['Height'])
        setin(nt, b, 'Normal', bp.outputs['Normal'])
    output(nt, sock_out(b, 'BSDF'), 300, 0)
    return mat


def emissive(name, col, strength=5.0):
    mat, nt = new_material(name)
    e = N(nt, 'ShaderNodeEmission')
    e.inputs['Color'].default_value = hexcol(col)
    e.inputs['Strength'].default_value = strength
    output(nt, e.outputs[0])
    return mat


# ----------------------------------------------------------------------------
# Poly Haven glTF import
# ----------------------------------------------------------------------------

def import_model(asset_id, coll, loc=(0, 0, 0), rot_z=0.0, scale=1.0, name=None):
    """Import a Poly Haven glTF, parent its meshes to an empty placed at loc."""
    g = glob.glob(os.path.join(ASSETS, 'models', asset_id, '*.gltf'))[0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name or asset_id, None)
    coll.objects.link(root)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        if o.parent is None:
            o.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, rot_z)
    root.scale = (scale, scale, scale)
    return root, new
