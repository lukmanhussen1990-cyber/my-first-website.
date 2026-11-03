"""A clean modern laptop: aluminium base with real keys, touchpad, opening lid with a
screen that plays a movie texture, and a cute paw sticker on the back of the lid.
Local frame: origin = bottom centre of the base, user side = +Y, hinge at -Y edge."""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

from catlib import (N, M, SEP, SMOOTH, MIXC, setin, sock_out, hexcol, new_material,
                    principled, output)
from scenelib import add_box, mesh_obj, bevel, solid

W, D, T = 0.312, 0.216, 0.0155       # base size
LID_T = 0.0065
OPEN_ANGLE = math.radians(112)


def screen_material(movie_path=None, frames=750):
    mat, nt = new_material('Laptop_Screen')
    uv = N(nt, 'ShaderNodeTexCoord').outputs['UV']
    if movie_path:
        tex = N(nt, 'ShaderNodeTexImage', -400, 0)
        img = bpy.data.images.load(movie_path, check_existing=True)
        img.source = 'MOVIE'
        tex.image = img
        tex.image_user.frame_duration = frames
        tex.image_user.frame_start = 1
        tex.image_user.frame_offset = 0
        tex.image_user.use_auto_refresh = True
        tex.extension = 'CLIP'
        nt.links.new(uv, tex.inputs['Vector'])
        col = tex.outputs['Color']
    else:
        col = hexcol('#EAF0FF')
    b = principled(nt, hexcol('#05070A'), 0.08)
    setin(nt, b, 'Emission Color', col)
    setin(nt, b, 'Emission Strength', 1.35)
    setin(nt, b, 'Coat Weight', 1.0)
    setin(nt, b, 'Coat Roughness', 0.05)
    output(nt, sock_out(b, 'BSDF'))
    return mat


def paw_sticker_material():
    mat, nt = new_material('Laptop_PawSticker')
    p = N(nt, 'ShaderNodeTexCoord').outputs['Object']
    x, y, z = SEP(nt, p)
    # paw print: one pad + 4 toes (in lid local x/y plane)
    def disc(cx, cy, rx, ry):
        dx = M(nt, 'DIVIDE', M(nt, 'SUBTRACT', x, cx), rx)
        dy = M(nt, 'DIVIDE', M(nt, 'SUBTRACT', y, cy), ry)
        d = M(nt, 'SQRT', M(nt, 'ADD', M(nt, 'MULTIPLY', dx, dx), M(nt, 'MULTIPLY', dy, dy)))
        return M(nt, 'SUBTRACT', 1.0, SMOOTH(nt, d, 0.9, 1.0))
    pad = disc(0.0, 0.092, 0.024, 0.019)
    toes = [disc(-0.026, 0.122, 0.009, 0.011), disc(-0.009, 0.133, 0.009, 0.011),
            disc(0.009, 0.133, 0.009, 0.011), disc(0.026, 0.122, 0.009, 0.011)]
    m = pad
    for t in toes:
        m = M(nt, 'MAXIMUM', m, t)
    col = MIXC(nt, m, hexcol('#C9CDD3'), hexcol('#FF8FB0'))
    b = principled(nt, col, M(nt, 'MULTIPLY_ADD', m, 0.15, 0.28))
    setin(nt, b, 'Metallic', M(nt, 'SUBTRACT', 1.0, m))
    output(nt, sock_out(b, 'BSDF'))
    return mat


def build_laptop(coll, movie_path=None, frames=750):
    alu = solid('Laptop_Alu', '#C9CDD3', 0.32, metal=1.0)
    alu_dark = solid('Laptop_AluDark', '#9EA3AA', 0.28, metal=1.0)
    keys_m = solid('Laptop_Keys', '#25282E', 0.55, spec=0.3)
    bezel = solid('Laptop_Bezel', '#0B0C0E', 0.25)
    sticker = paw_sticker_material()
    scr = screen_material(movie_path, frames)

    bm = bmesh.new()
    add_box(bm, (0, 0, T / 2), (W, D, T))
    base = mesh_obj('Laptop_Base', bm, coll, [alu])
    bevel(base, 0.0045, 3)
    # keys
    kb = bmesh.new()
    kw, kd, gap = 0.0172, 0.0162, 0.0033
    rows = 5
    y0 = -D / 2 + 0.024
    for r in range(rows):
        cols = 14
        yy = y0 + r * (kd + gap) + kd / 2
        for c in range(cols):
            xx = -((cols - 1) * (kw + gap)) / 2 + c * (kw + gap)
            add_box(kb, (xx, yy, T + 0.0012), (kw, kd, 0.0024))
    # space bar row
    yy = y0 + rows * (kd + gap) + kd / 2
    add_box(kb, (0, yy, T + 0.0012), (0.105, kd, 0.0024))
    for xx in (-0.093, -0.073, 0.073, 0.093, -0.113, 0.113):
        add_box(kb, (xx, yy, T + 0.0012), (kw, kd, 0.0024))
    keys = mesh_obj('Laptop_Keys', kb, coll, [keys_m])
    bevel(keys, 0.0012, 2)
    keys.parent = base
    tp = bmesh.new()
    add_box(tp, (0, D / 2 - 0.045, T + 0.0002), (0.105, 0.062, 0.0006))
    pad = mesh_obj('Laptop_Touchpad', tp, coll, [alu_dark])
    bevel(pad, 0.002, 2)
    pad.parent = base
    # lid: built lying flat on +Y from the hinge (closed state); screen on its -Z face.
    lb = bmesh.new()
    add_box(lb, (0, D / 2, LID_T / 2), (W, D, LID_T))
    lid = mesh_obj('Laptop_Lid', lb, coll, [alu])
    bevel(lid, 0.0035, 3)
    sb = bmesh.new()
    add_box(sb, (0, D / 2, -0.0004), (W - 0.008, D - 0.008, 0.0008))
    bz = mesh_obj('Laptop_Bezel', sb, coll, [bezel])
    bz.parent = lid
    disp = bpy.data.meshes.new('Laptop_Display')
    dw, dd = W - 0.024, D - 0.03
    ya, yb = D / 2 - dd / 2 + 0.004, D / 2 + dd / 2 + 0.004
    zz = -0.0011
    disp.from_pydata([(-dw / 2, ya, zz), (-dw / 2, yb, zz), (dw / 2, yb, zz), (dw / 2, ya, zz)], [], [(0, 1, 2, 3)])
    uvl = disp.uv_layers.new(name='UVMap')
    for li, uvc in enumerate([(1, 0), (1, 1), (0, 1), (0, 0)]):
        uvl.data[li].uv = uvc
    disp_ob = bpy.data.objects.new('Laptop_Display', disp)
    coll.objects.link(disp_ob)
    disp.materials.append(scr)
    disp_ob.parent = lid
    # paw sticker on the outer (+Z) face
    pm = bpy.data.meshes.new('Laptop_Sticker')
    s_ = 0.07
    zc = LID_T + 0.0004
    pm.from_pydata([(-s_, 0.105 - s_, zc), (s_, 0.105 - s_, zc), (s_, 0.105 + s_, zc), (-s_, 0.105 + s_, zc)], [], [(0, 1, 2, 3)])
    st_ob = bpy.data.objects.new('Laptop_Sticker', pm)
    coll.objects.link(st_ob)
    pm.materials.append(sticker)
    st_ob.parent = lid
    lid.parent = base
    lid.location = (0, -D / 2, T)
    lid.rotation_euler = (OPEN_ANGLE, 0, 0)
    return base, lid, disp_ob
