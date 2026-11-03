"""Cozy sunny living room set for the cat reels.

build(scene) creates: room shell (wood floor, beige walls with white wainscoting,
windows + curtains, ceiling), velvet sofa, coffee table, rug, bookshelf with books,
plants, armchair, side table, lamps, wall art, wall clock, lights + world, the owner
(on the sofa) with a laptop on the lap, and appends the CuteCat from cute_cat.blend.
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catlib as C  # noqa: E402
from catlib import N, M, SEP, SMOOTH, MIXC, setin, sock_out, hexcol, new_material, principled, output  # noqa
from scenelib import (ASSETS, add_box, mesh_obj, bevel, subsurf, box_obj, cushion, cylinder, pbr,
                      solid, emissive, import_model)
import owner as OW  # noqa: E402
import laptop as LP  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
X0, X1, Y0, Y1, H = -2.8, 2.8, -2.6, 2.2, 2.7
WIN_Y = (-0.35, 1.05)
WIN_W, WIN_Z0, WIN_Z1 = 1.0, 0.85, 2.25
SEAT_Z = 0.45
OWNER_POS = Vector((-0.12, 1.62, SEAT_Z))
SUN_DIR = None


def coll_new(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def look_rot(direction, up='Y'):
    return Vector(direction).to_track_quat('-Z', up).to_euler()


# ----------------------------------------------------------------------------
def build_room(coll, mats):
    # floor
    bm = bmesh.new()
    add_box(bm, ((X0 + X1) / 2, (Y0 + Y1) / 2, -0.01), (X1 - X0, Y1 - Y0, 0.02))
    mesh_obj('Floor', bm, coll, [mats['floor']])
    # ceiling
    bm = bmesh.new()
    add_box(bm, ((X0 + X1) / 2, (Y0 + Y1) / 2, H + 0.03), (X1 - X0 + 0.3, Y1 - Y0 + 0.3, 0.06))
    mesh_obj('Ceiling', bm, coll, [mats['ceiling']])
    # walls (upper beige); right wall has two window openings
    t = 0.14
    bm = bmesh.new()
    add_box(bm, ((X0 + X1) / 2, Y1 + t / 2, H / 2), (X1 - X0 + 2 * t, t, H))          # back
    add_box(bm, ((X0 + X1) / 2, Y0 - t / 2, H / 2), (X1 - X0 + 2 * t, t, H))          # front
    add_box(bm, (X0 - t / 2, (Y0 + Y1) / 2, H / 2), (t, Y1 - Y0, H))                  # left
    xr = X1 + t / 2
    add_box(bm, (xr, (Y0 + Y1) / 2, WIN_Z0 / 2), (t, Y1 - Y0, WIN_Z0))               # below windows
    add_box(bm, (xr, (Y0 + Y1) / 2, (WIN_Z1 + H) / 2), (t, Y1 - Y0, H - WIN_Z1))     # above
    edges = [Y0]
    for wy in WIN_Y:
        edges += [wy - WIN_W / 2, wy + WIN_W / 2]
    edges.append(Y1)
    for a, b in zip(edges[0::2], edges[1::2]):
        add_box(bm, (xr, (a + b) / 2, (WIN_Z0 + WIN_Z1) / 2), (t, b - a, WIN_Z1 - WIN_Z0))
    mesh_obj('Walls', bm, coll, [mats['wall']])

    # wainscoting / trims (white)
    trim = bmesh.new()
    WZ = 0.86

    def wall_run(axis, fixed, a, b, normal_sign, skip=()):
        """trim along a wall: axis 'x' (wall at y=fixed) or 'y' (wall at x=fixed)."""
        def box(c_along, c_z, along, z, off, thick):
            if axis == 'x':
                add_box(trim, (c_along, fixed + normal_sign * (off + thick / 2), c_z), (along, thick, z))
            else:
                add_box(trim, (fixed + normal_sign * (off + thick / 2), c_along, c_z), (thick, along, z))
        L = b - a
        box((a + b) / 2, WZ / 2, L, WZ, 0.0, 0.012)               # backing panel
        box((a + b) / 2, 0.065, L, 0.13, 0.012, 0.016)            # baseboard
        box((a + b) / 2, WZ + 0.015, L, 0.05, 0.012, 0.022)       # chair rail
        box((a + b) / 2, H - 0.06, L, 0.12, 0.0, 0.035)           # crown
        n = max(1, int(L / 0.78))
        pw = (L - 0.12 * (n + 1)) / n
        for i in range(n):
            c0 = a + 0.12 + i * (pw + 0.12)
            cc = c0 + pw / 2
            if any(s0 <= cc <= s1 for s0, s1 in skip):
                continue
            z0, z1 = 0.24, WZ - 0.12
            fw = 0.028
            box(cc, z0 + fw / 2, pw, fw, 0.012, 0.012)
            box(cc, z1 - fw / 2, pw, fw, 0.012, 0.012)
            box(c0 + fw / 2, (z0 + z1) / 2, fw, z1 - z0, 0.012, 0.012)
            box(c0 + pw - fw / 2, (z0 + z1) / 2, fw, z1 - z0, 0.012, 0.012)
    wall_run('x', Y1, X0, X1, -1)
    wall_run('x', Y0, X0, X1, +1)
    wall_run('y', X0, Y0, Y1, +1)
    wall_run('y', X1, Y0, Y1, -1)
    # window frames, mullions, sills
    for wy in WIN_Y:
        fx = X1 - 0.01
        y0, y1 = wy - WIN_W / 2, wy + WIN_W / 2
        fwid = 0.075
        add_box(trim, (fx, y0 + fwid / 2 - 0.02, (WIN_Z0 + WIN_Z1) / 2), (0.16, fwid, WIN_Z1 - WIN_Z0 + 0.1))
        add_box(trim, (fx, y1 - fwid / 2 + 0.02, (WIN_Z0 + WIN_Z1) / 2), (0.16, fwid, WIN_Z1 - WIN_Z0 + 0.1))
        add_box(trim, (fx, wy, WIN_Z1 + 0.02), (0.16, WIN_W + 0.1, fwid))
        add_box(trim, (X1 - 0.04, wy, WIN_Z0 - 0.005), (0.22, WIN_W + 0.16, 0.045))      # sill
        add_box(trim, (X1 + 0.03, wy, (WIN_Z0 + WIN_Z1) / 2), (0.035, 0.035, WIN_Z1 - WIN_Z0))   # mullion v
        add_box(trim, (X1 + 0.03, wy, WIN_Z0 + 0.62 * (WIN_Z1 - WIN_Z0)), (0.035, WIN_W, 0.035))  # mullion h
    tr = mesh_obj('Trims', trim, coll, [mats['trim']])
    bevel(tr, 0.004, 2)
    # curtains + rod
    cb = bmesh.new()
    for wy in WIN_Y:
        for side in (-1, 1):
            yc = wy + side * (WIN_W / 2 + 0.12)
            w = 0.42
            cols, rows = 28, 14
            verts = []
            for r in range(rows + 1):
                z = 0.03 + (2.44 - 0.03) * r / rows
                row = []
                for c in range(cols + 1):
                    u = c / cols
                    y = yc - w / 2 + w * u
                    gather = 1.0 - 0.25 * (z / 2.44)
                    x = X1 - 0.11 + 0.028 * math.sin(u * math.pi * 7) * gather
                    row.append(cb.verts.new((x, y, z)))
                verts.append(row)
            for r in range(rows):
                for c in range(cols):
                    cb.faces.new((verts[r][c], verts[r][c + 1], verts[r + 1][c + 1], verts[r + 1][c]))
    cur = mesh_obj('Curtains', cb, coll, [mats['curtain']])
    sol = cur.modifiers.new('Solidify', 'SOLIDIFY')
    sol.thickness = 0.008
    rb = bmesh.new()
    cylinder(rb, (X1 - 0.11, (Y0 + Y1) / 2 - 0.25, 2.47), 0.014, 3.6, 16, rot=(math.pi / 2, 0, 0))
    for yy in ((Y0 + Y1) / 2 - 2.05, (Y0 + Y1) / 2 + 1.55):
        bmesh.ops.create_uvsphere(rb, u_segments=12, v_segments=8, radius=0.03,
                                  matrix=Matrix.Translation((X1 - 0.11, yy, 2.47)))
    mesh_obj('CurtainRod', rb, coll, [mats['metal_dark']])


def build_sofa(coll, mats):
    v = mats['velvet']
    sx, sy = 0.0, 1.74
    for lx in (-1.02, 1.02):
        for ly in (sy - 0.4, sy + 0.38):
            bm = bmesh.new()
            cylinder(bm, (sx + lx, ly, 0.04), 0.026, 0.08, 16, r2=0.02)
            mesh_obj('Sofa_Leg', bm, coll, [mats['wood_dark']])
    box_obj('Sofa_Base', coll, (sx, sy, 0.185), (2.2, 0.92, 0.21), [v], bev=0.035)
    box_obj('Sofa_Back', coll, (sx, 2.1, 0.585), (2.2, 0.2, 0.6), [v], bev=0.05)
    for ax in (-1.0, 1.0):
        box_obj('Sofa_Arm', coll, (sx + ax, sy - 0.01, 0.465), (0.2, 0.94, 0.37), [v], bev=0.06, seg=4)
    for cx in (-0.6, 0.0, 0.6):
        cushion('Sofa_Seat', coll, (cx, 1.655, 0.37), (0.6, 0.73, 0.17), [v], puff=0.22)
        cushion('Sofa_BackCushion', coll, (cx, 1.93, 0.69), (0.6, 0.2, 0.46), [v], puff=0.25,
                rot=(-0.16, 0, 0))
    cushion('Sofa_Pillow', coll, (-0.8, 1.84, 0.68), (0.4, 0.1, 0.4), [mats['pillow1']], puff=1.1,
            rot=(-0.3, 0.12, 0.1), round_=0.7)
    cushion('Sofa_Pillow', coll, (0.82, 1.84, 0.67), (0.38, 0.1, 0.38), [mats['pillow2']], puff=1.1,
            rot=(-0.3, -0.12, -0.14), round_=0.7)
    # knitted throw on the right arm
    tb = bmesh.new()
    cols, rows = 16, 22
    vs = []
    for r in range(rows + 1):
        t = r / rows
        row = []
        for c in range(cols + 1):
            u = c / cols
            y = 1.35 + 0.6 * u
            # drape over the arm: across the top then down the outside
            ang = t * math.pi * 0.95
            x = 1.0 + 0.13 * math.sin(ang) + 0.02 * math.sin(u * 9)
            z = 0.665 + 0.0 * t
            if t > 0.5:
                z = 0.665 - (t - 0.5) * 0.7
                x = 1.0 + 0.13 + 0.01 * math.sin(u * 9)
            else:
                x = 0.86 + (t / 0.5) * 0.27
            row.append(tb.verts.new((x, y, z + 0.012 * math.sin(u * 13 + t * 5))))
        vs.append(row)
    for r in range(rows):
        for c in range(cols):
            tb.faces.new((vs[r][c], vs[r][c + 1], vs[r + 1][c + 1], vs[r + 1][c]))
    th = mesh_obj('Sofa_Throw', tb, coll, [mats['throw']])
    so = th.modifiers.new('Solidify', 'SOLIDIFY')
    so.thickness = 0.012
    subsurf(th, 1, 1)


def build_tables(coll, mats):
    # coffee table
    cx, cy = -0.05, 0.62
    box_obj('CoffeeTable_Top', coll, (cx, cy, 0.4), (1.1, 0.6, 0.045), [mats['wood_table']], bev=0.012)
    box_obj('CoffeeTable_Shelf', coll, (cx, cy, 0.12), (0.98, 0.48, 0.025), [mats['wood_table']], bev=0.006)
    lb = bmesh.new()
    for lx in (-0.47, 0.47):
        for ly in (-0.23, 0.23):
            cylinder(lb, (cx + lx, cy + ly, 0.19), 0.024, 0.38, 16, r2=0.018)
    mesh_obj('CoffeeTable_Legs', lb, coll, [mats['wood_table']])
    # props: mug, books, remote
    mb = bmesh.new()
    cylinder(mb, (0.33, 0.7, 0.4225 + 0.047), 0.04, 0.094, 32)
    mug = mesh_obj('Mug', mb, coll, [mats['ceramic']])
    bevel(mug, 0.004, 2)
    tor = bmesh.new()
    # handle (torus via sweep of small circles)
    R, r = 0.026, 0.007
    ring_n, seg_n = 16, 8
    rings = []
    for i in range(ring_n + 1):
        a = -math.pi / 2 + math.pi * i / ring_n
        c = Vector((0.33 + 0.04 + R * math.cos(a) * 0.8, 0.7, 0.4225 + 0.05 + R * math.sin(a)))
        tng = Vector((-math.sin(a), 0, math.cos(a)))
        nrm = Vector((math.cos(a), 0, math.sin(a)))
        ring = [tor.verts.new(c + nrm * r * math.cos(2 * math.pi * j / seg_n) + Vector((0, 1, 0)) * r * math.sin(2 * math.pi * j / seg_n)) for j in range(seg_n)]
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(seg_n):
            tor.faces.new((a[j], a[(j + 1) % seg_n], b[(j + 1) % seg_n], b[j]))
    mesh_obj('MugHandle', tor, coll, [mats['ceramic']])
    cb = bmesh.new()
    cylinder(cb, (0.33, 0.7, 0.4225 + 0.085), 0.036, 0.002, 32)
    mesh_obj('Coffee', cb, coll, [mats['coffee']])
    box_obj('Book_Table1', coll, (0.12, 0.5, 0.4225 + 0.014), (0.24, 0.17, 0.028), [mats['book_a']], bev=0.003)
    box_obj('Book_Table2', coll, (0.13, 0.5, 0.4225 + 0.039), (0.21, 0.15, 0.022), [mats['book_b']], bev=0.003,
            rot=(0, 0, 0.12))
    box_obj('Remote', coll, (-0.18, 0.72, 0.4225 + 0.009), (0.045, 0.16, 0.018), [mats['plastic_dark']], bev=0.006,
            rot=(0, 0, -0.35))
    import_model('potted_plant_04', coll, loc=(-0.44, 0.52, 0.4225), scale=0.95)
    # side table (right of sofa) with vase + lamp
    sx, sy = 1.38, 1.95
    st = bmesh.new()
    cylinder(st, (sx, sy, 0.555), 0.24, 0.03, 40)
    cylinder(st, (sx, sy, 0.29), 0.028, 0.52, 16)
    cylinder(st, (sx, sy, 0.012), 0.15, 0.024, 32)
    sto = mesh_obj('SideTable', st, coll, [mats['walnut']])
    bevel(sto, 0.006, 2)
    import_model('ceramic_vase_01', coll, loc=(sx + 0.08, sy + 0.05, 0.57), scale=0.75)
    lamp = bmesh.new()
    bmesh.ops.create_uvsphere(lamp, u_segments=24, v_segments=16, radius=0.07,
                              matrix=Matrix.Translation((sx - 0.1, sy - 0.04, 0.64)))
    cylinder(lamp, (sx - 0.1, sy - 0.04, 0.75), 0.01, 0.16, 12)
    mesh_obj('TableLamp_Base', lamp, coll, [mats['ceramic_sage']])
    shade = bmesh.new()
    bmesh.ops.create_cone(shade, cap_ends=False, segments=32, radius1=0.15, radius2=0.11, depth=0.17,
                          matrix=Matrix.Translation((sx - 0.1, sy - 0.04, 0.88)))
    sh = mesh_obj('TableLamp_Shade', shade, coll, [mats['lampshade']])
    so = sh.modifiers.new('Solidify', 'SOLIDIFY')
    so.thickness = 0.004


def build_rug(coll, mats):
    box_obj('Rug', coll, (0.0, 0.92, 0.003), (2.9, 2.0, 0.006), [mats['rug']], bev=0.0025, seg=2)


def build_shelf(coll, mats):
    root, objs = import_model('Shelf_01', coll, loc=(X0 + 0.005, 0.55, 0.0), rot_z=math.radians(90))
    # find shelf boards (upward faces) in the model
    me = objs[0].data
    zs = sorted(set(round(p.center.z, 3) for p in me.polygons if p.normal.z > 0.95 and p.area > 0.05))
    rnd = random.Random(7)
    pal = ['#8E3B32', '#2F4A6B', '#C9A25A', '#4F6B48', '#D9CBB0', '#6B4A7A', '#B8643C', '#33363B',
           '#A8B8C8', '#E3D6BF', '#7C2F2A', '#40665E']
    bm = bmesh.new()
    books = []
    shelf_tops = [z for z in zs if 0.15 < z < 2.0]
    for si, z in enumerate(shelf_tops):
        if si == 2:
            continue        # this shelf gets the encyclopedia set
        y = -0.46
        while y < 0.44:
            w = rnd.uniform(0.022, 0.048)
            hgt = rnd.uniform(0.17, 0.27)
            dep = rnd.uniform(0.15, 0.2)
            lean = rnd.random() < 0.08
            if rnd.random() < 0.06:
                y += rnd.uniform(0.05, 0.12)       # gap
                continue
            col = rnd.choice(pal)
            books.append(((0.0 + 0.0, y + w / 2, z + hgt / 2), (dep, w, hgt), col, lean))
            y += w + rnd.uniform(0.0, 0.004)
    # build books grouped by colour
    groups = {}
    for (c, s, col, lean) in books:
        groups.setdefault(col, []).append((c, s, lean))
    for col, items in groups.items():
        bm = bmesh.new()
        for (c, s, lean) in items:
            # shelf local: x along depth (wall->room), y along width
            cx = X0 + 0.005 + 0.257 / 2 + 0.005
            add_box(bm, (cx, 0.55 + c[1], c[2]), s, rot=(0.12 if lean else 0.0, 0, 0))
        ob = mesh_obj('Books', bm, coll, [solid('Book_' + col, col, 0.55, sheen=0.1)])
        bevel(ob, 0.002, 1)
    if len(shelf_tops) > 2:
        z = shelf_tops[2]
        import_model('book_encyclopedia_set_01', coll, loc=(X0 + 0.06, 0.25, z), rot_z=math.radians(90))
    top = max(zs) if zs else 2.08
    import_model('potted_plant_04', coll, loc=(X0 + 0.14, 0.85, top), scale=1.05)
    return shelf_tops


def build_decor(coll, mats):
    import_model('potted_plant_02', coll, loc=(X0 + 0.42, Y1 - 0.42, 0.0), rot_z=math.radians(-30), scale=1.35)
    import_model('potted_plant_01', coll, loc=(X1 - 0.45, Y0 + 0.75, 0.0), rot_z=math.radians(40), scale=1.0)
    import_model('ArmChair_01', coll, loc=(1.95, 0.32, 0.0), rot_z=math.radians(-97), scale=1.05)
    import_model('fancy_picture_frame_01', coll, loc=(0.0, Y1 - 0.004, 1.5), scale=1.75)
    import_model('hanging_picture_frame_02', coll, loc=(X0 + 0.004, -0.85, 1.45), rot_z=math.radians(-90), scale=1.1)
    clock_root, clock_objs = import_model('wall_clock', coll, loc=(1.5, Y1 - 0.004, 1.78), scale=1.0, name='WallClock')
    for sx in (-0.86, 0.86):
        import_model('industrial_wall_lamp', coll, loc=(sx, Y1 - 0.004, 1.55), scale=0.85)
    import_model('modern_ceiling_lamp_01', coll, loc=(-0.05, 0.62, H - 1.173), scale=1.0)
    # cat bed + yarn ball
    bed = bmesh.new()
    R, r = 0.24, 0.075
    rings = []
    for i in range(32):
        a = 2 * math.pi * i / 32
        c = Vector((math.cos(a) * R, math.sin(a) * R, r))
        ring = []
        for j in range(12):
            b = 2 * math.pi * j / 12
            nrm = Vector((math.cos(a) * math.cos(b), math.sin(a) * math.cos(b), math.sin(b)))
            ring.append(bed.verts.new(c + nrm * r * Vector((1, 1, 0.9))))
        rings.append(ring)
    for i in range(32):
        a, b = rings[i], rings[(i + 1) % 32]
        for j in range(12):
            bed.faces.new((a[j], a[(j + 1) % 12], b[(j + 1) % 12], b[j]))
    bmesh.ops.create_cone(bed, cap_ends=True, segments=32, radius1=0.22, radius2=0.22, depth=0.05,
                          matrix=Matrix.Translation((0, 0, 0.03)))
    bo = mesh_obj('CatBed', bed, coll, [mats['bed']])
    subsurf(bo, 2, 1)
    bo.location = (1.45, -0.55, 0.0)
    yb = bmesh.new()
    bmesh.ops.create_uvsphere(yb, u_segments=24, v_segments=16, radius=0.045)
    yo = mesh_obj('YarnBall', yb, coll, [mats['yarn']])
    yo.location = (0.95, 0.05, 0.045)
    return clock_root, clock_objs


def make_mats():
    m = {}
    m['floor'] = pbr('Floor_Wood', 'wood_floor', scale=0.55, rot=(0, 0, math.pi / 2), rough_mult=0.85, nstr=0.6,
                     proj='FLAT', sat=1.1)
    m['wall'] = pbr('Wall_Beige', 'beige_wall_001', scale=0.5, tint='#FBF1E1', tint_mix=0.5, nstr=0.35, val=1.3)
    m['ceiling'] = solid('Ceiling', '#F6F2EA', 0.8, emit='#FFF6EA', emit_str=0.35, noise_bump=0.05, noise_scale=30)
    m['trim'] = solid('Trim_White', '#F4F1EA', 0.38, spec=0.5, noise_bump=0.04, noise_scale=40)
    m['curtain'] = pbr('Curtain_Linen', 'cotton_jersey', scale=5.0, sat=0.0, val=1.45, tint='#F1E6D6', nstr=0.6,
                       sheen=0.5)
    m['metal_dark'] = solid('Metal_Dark', '#2B2B2E', 0.35, metal=1.0)
    m['velvet'] = pbr('Sofa_Velvet', 'velour_velvet', scale=3.0, sat=0.0, val=2.4, tint='#2C6A57', nstr=0.7,
                      sheen=1.0, sheen_tint='#8ED1B6', rough_mult=1.0)
    m['pillow1'] = pbr('Pillow_Mustard', 'velour_velvet', scale=3.0, sat=0.0, val=2.4, tint='#E0A33A', nstr=0.7,
                       sheen=0.8, sheen_tint='#FFE2A0')
    m['pillow2'] = pbr('Pillow_Blush', 'cotton_jersey', scale=5.0, sat=0.0, val=1.6, tint='#EBC2B6', nstr=0.8,
                       sheen=0.5)
    m['throw'] = pbr('Throw_Knit', 'cotton_jersey', scale=3.0, sat=0.0, val=1.5, tint='#E9E1D2', nstr=1.2, sheen=0.6)
    m['wood_dark'] = pbr('Wood_Dark', 'walnut_veneer', scale=2.0, val=0.6)
    m['wood_table'] = pbr('Wood_Table', 'wood_table_001', scale=1.2, coat=0.35)
    m['walnut'] = pbr('Wood_Walnut', 'walnut_veneer', scale=1.5, coat=0.25)
    m['rug'] = pbr('Rug_Herringbone', 'poly_wool_herringbone', scale=2.2, sat=0.25, val=1.25, tint='#E4DACB',
                   tint_mix=0.6, nstr=1.0, sheen=0.6)
    m['ceramic'] = solid('Ceramic_White', '#F2EFEA', 0.15, coat=0.6)
    m['ceramic_sage'] = solid('Ceramic_Sage', '#9DB59A', 0.25, coat=0.5)
    m['coffee'] = solid('Coffee', '#3B2416', 0.1, coat=1.0)
    m['book_a'] = solid('Book_A', '#2F4A6B', 0.6)
    m['book_b'] = solid('Book_B', '#C9A25A', 0.6)
    m['plastic_dark'] = solid('Plastic_Dark', '#1E1F22', 0.4)
    m['lampshade'] = solid('LampShade', '#F4E7CF', 0.7, emit='#FFD9A0', emit_str=1.2, sheen=0.3)
    m['bed'] = pbr('CatBed_Fabric', 'cotton_jersey', scale=5.0, sat=0.0, val=1.4, tint='#D8B4A0', nstr=1.0, sheen=0.7)
    m['yarn'] = solid('Yarn', '#D2454B', 0.8, sheen=0.8, noise_bump=0.6, noise_scale=140)
    return m


def build_world(scene, strength=0.85, rot_z=0.0):
    w = bpy.data.worlds.new('SunnyGarden')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = N(nt, 'ShaderNodeTexCoord', -900, 0)
    mp = N(nt, 'ShaderNodeMapping', -700, 0)
    mp.inputs['Rotation'].default_value = (0, 0, rot_z)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    env = N(nt, 'ShaderNodeTexEnvironment', -500, 0)
    env.image = bpy.data.images.load(os.path.join(ASSETS, 'hdri', 'suburban_garden_4k.hdr'), check_existing=True)
    nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    # clamp the sun out of the HDRI (a real Sun lamp does the sunlight with shadows)
    clamp = N(nt, 'ShaderNodeMix', -250, 0)
    clamp.data_type = 'RGBA'
    clamp.blend_type = 'DARKEN'
    setin(nt, clamp, 'Factor_Float', 1.0)
    setin(nt, clamp, 'A_Color', env.outputs['Color'])
    setin(nt, clamp, 'B_Color', (2.2, 2.2, 2.2, 1.0))
    bg = N(nt, 'ShaderNodeBackground', 0, 0)
    bg.inputs['Strength'].default_value = strength
    nt.links.new(sock_out(clamp, 'Result_Color'), bg.inputs['Color'])
    out = N(nt, 'ShaderNodeOutputWorld', 200, 0)
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    w.sun_threshold = 1000.0
    return w


def add_light(coll, name, typ, loc, energy, color='#FFFFFF', size=0.1, rot=(0, 0, 0), shadow=True,
              size_y=None, spot=None):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = energy
    ld.color = hexcol(color)[:3]
    ld.use_shadow = shadow
    if typ == 'AREA':
        ld.shape = 'RECTANGLE'
        ld.size = size
        ld.size_y = size_y or size
    elif typ in ('POINT', 'SPOT'):
        ld.shadow_soft_size = size
    elif typ == 'SUN':
        ld.angle = size
    if spot:
        ld.spot_size = spot
        ld.spot_blend = 0.6
    ob = bpy.data.objects.new(name, ld)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def build_lights(coll):
    global SUN_DIR
    el, az = math.radians(21), math.radians(14)
    d = Vector((-math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), -math.sin(el)))
    SUN_DIR = d
    sun = add_light(coll, 'Sun', 'SUN', (3.5, 0, 3.0), 9.0, '#FFD9A8', size=math.radians(1.4),
                    rot=look_rot(d))
    fill = add_light(coll, 'Fill', 'AREA', (-0.4, -2.2, 2.2), 280, '#FFE8CC', size=3.2, size_y=1.6,
                     rot=look_rot(Vector((0.1, 1.0, -0.55))), shadow=True)
    back = add_light(coll, 'BounceBack', 'AREA', (0.0, 1.0, 2.62), 90, '#FFE9D2', size=3.0, size_y=2.0,
                     rot=(0, 0, 0), shadow=False)
    lamps = []
    for sx in (-0.86, 0.86):
        lamps.append(add_light(coll, 'Sconce', 'POINT', (sx, Y1 - 0.1, 1.55), 6, '#FFB866', size=0.04, shadow=False))
    lamps.append(add_light(coll, 'Pendant', 'POINT', (-0.05, 0.62, 1.88), 14, '#FFD29A', size=0.08, shadow=False))
    lamps.append(add_light(coll, 'TableLamp', 'POINT', (1.28, 1.91, 0.86), 10, '#FFC47A', size=0.06, shadow=False))
    return sun, fill, lamps


def append_cat(coll):
    path = os.path.join(ROOT, 'cute_cat.blend')
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.collections = ['CuteCat']
    cat = dst.collections[0]
    coll.children.link(cat)
    rig = [o for o in cat.objects if o.type == 'ARMATURE'][0]
    return cat, rig


def build(scene, screen_movie=None, frames=750):
    random.seed(3)
    set_c = coll_new('Set', scene.collection)
    room_c = coll_new('Room', set_c)
    furn_c = coll_new('Furniture', set_c)
    light_c = coll_new('Lights', scene.collection)
    char_c = coll_new('Characters', scene.collection)
    mats = make_mats()
    build_room(room_c, mats)
    build_sofa(furn_c, mats)
    build_tables(furn_c, mats)
    build_rug(furn_c, mats)
    shelf_tops = build_shelf(furn_c, mats)
    clock_root, clock_objs = build_decor(furn_c, mats)
    build_world(scene, 0.9, rot_z=math.radians(200))
    sun, fill, lamps = build_lights(light_c)
    # owner + laptop on the lap
    rig_o, ctrl = OW.build_owner(char_c, OWNER_POS, 0.0)
    base, lid, disp = LP.build_laptop(char_c, screen_movie, frames)
    base.parent = rig_o
    base.location = (0.0, -0.27, 0.172)
    base.rotation_euler = (0.05, 0, 0)
    scr_light = add_light(char_c, 'ScreenGlow', 'AREA', (0, 0, 0), 4.0, '#DCE6FF', size=0.26, size_y=0.17,
                          shadow=False)
    scr_light.parent = lid
    scr_light.location = (0, LP.D / 2, -0.03)
    scr_light.rotation_euler = (math.pi, 0, 0)
    cat_c, rig_c = append_cat(char_c)
    return dict(owner=rig_o, ctrl=ctrl, laptop=base, lid=lid, display=disp, cat=rig_c, cat_coll=cat_c,
                sun=sun, fill=fill, lamps=lamps, clock=(clock_root, clock_objs), mats=mats,
                screen_light=scr_light, shelf_tops=shelf_tops)


def render_settings(scene, res=100, samples=12):
    r = scene.render
    r.engine = 'BLENDER_EEVEE_NEXT'
    r.resolution_x, r.resolution_y = 1080, 1920
    r.resolution_percentage = res
    r.fps = 30
    ee = scene.eevee
    ee.taa_render_samples = samples
    ee.use_shadows = True
    ee.shadow_ray_count = 1
    ee.shadow_step_count = 6
    ee.use_raytracing = False
    ee.use_volumetric_shadows = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.view_settings.exposure = 0.0
    r.film_transparent = False
