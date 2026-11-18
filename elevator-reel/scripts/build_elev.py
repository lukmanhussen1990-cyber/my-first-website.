"""Elevator episode: build sets + props on top of char_you.blend -> /opt/work/blend/elev_master.blend"""
import bpy, bmesh, math, random, sys, time
sys.path.insert(0, "/opt/work/scripts")
from mathutils import Vector, Matrix, Euler
import lib
from lib import srgb
from build_set import math_node, append_ph, render_settings, wall_material

t0 = time.time()
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/char_you.blend")
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)

C_ext = lib.coll("EXTERIOR")
C_int = lib.coll("STAIRWELL")
C_props = lib.coll("PROPS")
C_fx = lib.coll("FX")
PH = "/opt/work/assets/polyhaven"

# ------------------------------------------------------------------ layout constants
BLD = dict(x0=-4.5, x1=4.5, y0=0.0, y1=8.0, h=9.6)          # our building (front facade at y=0)
NB = dict(x0=-12.0, x1=-5.0, y0=-2.4, y1=8.0, h=13.2)       # neighbour (right side wall at x=-5)
WHEEL = Vector((-2.6, -1.25, 10.35))                         # big pulley centre (axis along Y)
WHEEL_R = 0.8
LOAD_X = WHEEL.x - WHEEL_R                                   # -3.4  (piano / box strand)
CNT_X = WHEEL.x + WHEEL_R                                    # -1.8  (counter strand: him / rock)
ROPE_Y = WHEEL.y
STAIR = dict(x=32.0, w=1.3, rise=0.18, run=0.28, n=14)       # interior stair hall far away


# ------------------------------------------------------------------ materials
def tile_mat(name, c1, c2, size, grout="#7E7B76", rough=0.7):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    x = math_node(nt, 'DIVIDE', sep.outputs[0], size); y = math_node(nt, 'DIVIDE', sep.outputs[1], size)
    fx = math_node(nt, 'FLOOR', x); fy = math_node(nt, 'FLOOR', y)
    tid = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', fx, 13.7), math_node(nt, 'MULTIPLY', fy, 7.1))
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = '1D'; nt.links.new(tid, wn.inputs["W"])
    gx = math_node(nt, 'FRACT', x); gx = math_node(nt, 'MINIMUM', gx, math_node(nt, 'SUBTRACT', 1.0, gx))
    gy = math_node(nt, 'FRACT', y); gy = math_node(nt, 'MINIMUM', gy, math_node(nt, 'SUBTRACT', 1.0, gy))
    g = math_node(nt, 'MINIMUM', gx, gy)
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.01
    mr.inputs["From Max"].default_value = 0.022; mr.inputs["To Min"].default_value = 1.0; mr.inputs["To Max"].default_value = 0.0
    nt.links.new(g, mr.inputs["Value"])
    cm = nt.nodes.new("ShaderNodeMix"); cm.data_type = 'RGBA'
    cm.inputs["A"].default_value = srgb(c1); cm.inputs["B"].default_value = srgb(c2)
    nt.links.new(wn.outputs["Value"], cm.inputs["Factor"])
    gm = nt.nodes.new("ShaderNodeMix"); gm.data_type = 'RGBA'
    nt.links.new(mr.outputs[0], gm.inputs["Factor"]); nt.links.new(cm.outputs[2], gm.inputs["A"])
    gm.inputs["B"].default_value = srgb(grout)
    nt.links.new(gm.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.3
    nt.links.new(math_node(nt, 'SUBTRACT', 1.0, mr.outputs[0]), bump.inputs["Height"])
    nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb(c1)
    return m


def plaster_mat(name, c1, c2):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.9; nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeMix"); cr.data_type = 'RGBA'
    cr.inputs["A"].default_value = srgb(c1); cr.inputs["B"].default_value = srgb(c2)
    nt.links.new(nz.outputs["Fac"], cr.inputs["Factor"])
    nt.links.new(cr.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.9
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 50
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
    nt.links.new(n2.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb(c1)
    return m


def wood_mat(name, c1="#B07A45", c2="#8E5C30", scale=3.0, rough=0.6):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 8.0, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = scale
    wv.inputs["Distortion"].default_value = 6.0; wv.inputs["Detail"].default_value = 3
    nt.links.new(mp.outputs[0], wv.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeMix"); cr.data_type = 'RGBA'
    cr.inputs["A"].default_value = srgb(c1); cr.inputs["B"].default_value = srgb(c2)
    nt.links.new(wv.outputs["Fac"], cr.inputs["Factor"])
    nt.links.new(cr.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb(c1)
    return m


M = {}
M["facade"] = plaster_mat("M_FacadeGreen", "#86957F", "#98A693")
M["neigh"] = plaster_mat("M_FacadeCream", "#E2D2A2", "#EEE0B8")
M["across"] = plaster_mat("M_FacadeRose", "#D9A89A", "#E6BCAE")
M["trim"] = lib.mat("M_Trim", "#EDEDE6", rough=0.45)
M["sky_glass"] = lib.mat("M_WinGlass", "#9FB6C4", rough=0.08, spec=1.0, metal=0.2)
M["win_dark"] = lib.mat("M_WinInterior", "#2C3438", rough=0.5)
M["door"] = lib.mat("M_DoorGreen", "#2E5A44", rough=0.35, coat=0.4)
M["sidewalk"] = tile_mat("M_Sidewalk", "#C9C6BE", "#BEBBB3", 0.6, grout="#8D8A84")
M["road"] = plaster_mat("M_Asphalt", "#3A3C40", "#45474B")
M["curb"] = lib.mat("M_Curb", "#AAA8A2", rough=0.8)
M["wood"] = wood_mat("M_Wood")
M["wood_dark"] = wood_mat("M_WoodDark", "#6E4A2A", "#55361E")
M["iron"] = lib.mat("M_Iron", "#26262A", rough=0.4, metal=0.8)
M["rope"] = wood_mat("M_Rope", "#D2B07A", "#B08D55", scale=12.0, rough=0.85)
M["piano"] = lib.mat("M_PianoBlack", "#0C0C0E", rough=0.12, coat=1.0, spec=0.8)
M["key_w"] = lib.mat("M_KeyWhite", "#F5F2E8", rough=0.25)
M["key_b"] = lib.mat("M_KeyBlack", "#0A0A0A", rough=0.3)
M["gold"] = lib.mat("M_Gold", "#C9A24A", rough=0.25, metal=1.0)
M["red_btn"] = lib.mat("M_RedButton", "#D3171C", rough=0.25, coat=0.6, emit="#FF2020", emit_strength=0.4)
M["steel"] = lib.mat("M_Steel", "#B9BEC4", rough=0.18, metal=1.0)
M["stair_tread"] = wood_mat("M_Tread", "#9A6A3E", "#7C5230", scale=2.0, rough=0.45)
M["riser"] = lib.mat("M_Riser", "#EEE8DC", rough=0.6)
M["hall_wall"] = wall_material()
M["hall_floor"] = wood_mat("M_HallFloor", "#A3734A", "#86592F", scale=1.5, rough=0.5)
M["glass_shard"] = lib.mat("M_Shard", "#DDEFF7", rough=0.05, emit="#EAF7FF", emit_strength=0.5, spec=1.0)


# ------------------------------------------------------------------ helpers
def window(name, C, center, w=1.15, h=1.75, axis='Y', face=-1, depth=0.12, glass=True, pane=True):
    """Window on a wall. axis='Y' -> wall is XZ plane facing face*Y; axis='X' -> wall YZ plane facing face*X."""
    parts = []
    t = 0.07
    back = lib.box(name + "_back", (w, 0.02, h), (0, 0.08, 0), C); lib.assign(back, M["win_dark"]); parts.append(back)
    if pane:
        pn = lib.box(name + "_pane", (w, 0.02, h), (0, 0, 0), C)
        lib.assign(pn, M["sky_glass"] if glass else M["win_dark"])
        parts.append(pn)
    for (px, pz, sw, sh) in [(-w / 2, 0, t, h + t), (w / 2, 0, t, h + t), (0, -h / 2, w + t, t), (0, h / 2, w + t, t),
                             (0, h * 0.18, w, t * 0.7), (0, 0, t * 0.7, h)]:
        f = lib.box(name + "_fr", (sw, 0.1, sh), (px, -0.04, pz), C); lib.assign(f, M["trim"]); parts.append(f)
    sill = lib.box(name + "_sill", (w + 0.25, 0.2, 0.07), (0, -0.1, -h / 2 - 0.05), C); lib.assign(sill, M["trim"]); parts.append(sill)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    j = bpy.context.object; j.name = name
    j.location = center
    if axis == 'Y':
        j.rotation_euler = (0, 0, 0 if face < 0 else math.pi)
    else:
        j.rotation_euler = (0, 0, -math.pi / 2 if face > 0 else math.pi / 2)
    return j


def building(name, C, d, mat, floors, win_cols, face_y=True, door_x=None, side_windows=None):
    x0, x1, y0, y1, h = d["x0"], d["x1"], d["y0"], d["y1"], d["h"]
    b = lib.box(name, (x1 - x0, y1 - y0, h), ((x0 + x1) / 2, (y0 + y1) / 2, h / 2), C)
    lib.assign(b, mat)
    par = lib.box(name + "_parapet", (x1 - x0 + 0.2, y1 - y0 + 0.2, 0.5), ((x0 + x1) / 2, (y0 + y1) / 2, h + 0.25), C)
    lib.assign(par, M["trim"])
    roof = lib.box(name + "_roofIn", (x1 - x0 - 0.4, y1 - y0 - 0.4, 0.3), ((x0 + x1) / 2, (y0 + y1) / 2, h + 0.36), C)
    lib.assign(roof, lib.mat("M_RoofTar", "#5A5C5E", rough=0.9))
    fh = h / floors
    for k in range(1, floors):
        band = lib.box(name + "_band", (x1 - x0 + 0.08, 0.1, 0.16), ((x0 + x1) / 2, y0 - 0.04, k * fh), C)
        lib.assign(band, M["trim"])
    wins = []
    for k in range(floors):
        zc = k * fh + fh * 0.55
        for cx in win_cols:
            if door_x is not None and k == 0 and abs(cx - door_x) < 0.8:
                continue
            wins.append(window(f"{name}_w{k}_{cx:.1f}", C, (cx, y0 - 0.01, zc)))
    if door_x is not None:
        dr = lib.box(name + "_door", (1.25, 0.12, 2.3), (door_x, y0 - 0.04, 1.15), C, bevel=0.01); lib.assign(dr, M["door"])
        fr = lib.box(name + "_doorframe", (1.5, 0.08, 2.5), (door_x, y0 - 0.01, 1.25), C); lib.assign(fr, M["trim"])
        knob = lib.icosphere(name + "_knob", 0.04, 2, (door_x + 0.45, y0 - 0.12, 1.1), C); lib.assign(knob, M["gold"])
    if side_windows:
        for k, (sx, sy, sz, face) in enumerate(side_windows):
            breakable = k < 2
            wins.append(window(f"{name}_sw_{sy:.1f}_{sz:.1f}", C, (sx, sy, sz), axis='X', face=face, pane=not breakable))
            if breakable:
                bp_ = lib.box(f"BreakPane_{k}", (0.02, 1.15, 1.75), (sx + 0.01 * face, sy, sz), C)
                lib.assign(bp_, M["sky_glass"])
    return b, wins


def rope_obj(name, C, radius=0.025):
    """Unit rope along -Z from origin (length 1). Scale Z = length."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=radius, radius2=radius, depth=1.0)
    for v in bm.verts:
        v.co.z -= 0.5
    o = lib.mesh_from_bmesh(name, bm, C)
    lib.assign(o, M["rope"])
    return o


# ------------------------------------------------------------------ exterior
def build_exterior():
    C = C_ext
    # ground: sidewalk + curb + road + far sidewalk
    sw = lib.box("Sidewalk", (60, 4.0, 0.12), (0, -2.0, 0.0), C); lib.assign(sw, M["sidewalk"])
    sw.location.z = -0.06
    road = lib.box("Road", (60, 9.0, 0.1), (0, -8.6, -0.13), C); lib.assign(road, M["road"])
    curb = lib.box("Curb", (60, 0.2, 0.18), (0, -4.05, -0.03), C); lib.assign(curb, M["curb"])
    sw2 = lib.box("Sidewalk2", (60, 4.0, 0.12), (0, -15.1, -0.06), C); lib.assign(sw2, M["sidewalk"])
    for o in (sw, sw2):
        bpy.context.view_layer.objects.active = o
    # stripes on road
    for i in range(-6, 7):
        st = lib.box("RoadLine", (1.6, 0.14, 0.01), (i * 4.0, -8.6, -0.075), C)
        lib.assign(st, lib.mat("M_RoadLine", "#EDE9DC", rough=0.6))
    # our building
    b, wins = building("Bld", C, BLD, M["facade"], 3, [-3.2, -1.0, 1.2, 3.4], door_x=1.2)
    # front stoop step
    stp = lib.box("Stoop", (2.0, 0.6, 0.15), (1.2, -0.3, 0.075), C); lib.assign(stp, M["curb"])
    # neighbour (taller, cream) with side windows facing +X at x=-5
    side = [(NB["x1"] + 0.01, -1.25, 1.9, +1), (NB["x1"] + 0.01, -1.25, 5.25, +1), (NB["x1"] + 0.01, -1.25, 8.55, +1),
            (NB["x1"] + 0.01, 2.0, 5.25, +1), (NB["x1"] + 0.01, 2.0, 8.55, +1)]
    nb, nwins = building("Neigh", C, NB, M["neigh"], 4, [-10.6, -8.5, -6.4], side_windows=side)
    # across the street (backdrop facing +Y)
    AC = dict(x0=-14, x1=14, y0=-25, y1=-17.2, h=11.0)
    ab = lib.box("Across", (AC["x1"] - AC["x0"], AC["y1"] - AC["y0"], AC["h"]), (0, (AC["y0"] + AC["y1"]) / 2, AC["h"] / 2), C)
    lib.assign(ab, M["across"])
    for k in range(3):
        for cx in range(-12, 13, 3):
            window(f"Across_w{k}_{cx}", C, (cx, AC["y1"] + 0.01, 1.9 + k * 3.4), face=+1)
    # right-hand building (beyond ours) for continuity
    RB = dict(x0=5.2, x1=14.0, y0=-0.6, y1=8.0, h=10.8)
    rb, _ = building("RightBld", C, RB, M["across"], 3, [6.6, 9.0, 11.4, 13.2])
    # hoist beam on the roof + brace
    beam_len = 2.2
    beam = lib.box("HoistBeam", (0.22, beam_len, 0.22), (WHEEL.x, WHEEL.y + beam_len / 2 - 0.25, WHEEL.z + 0.62), C, bevel=0.01)
    lib.assign(beam, M["wood_dark"])
    brace = lib.box("HoistBrace", (0.16, 1.5, 0.16), (WHEEL.x, -0.05, WHEEL.z - 0.1), C, bevel=0.01)
    brace.rotation_euler = (math.radians(-42), 0, 0); lib.assign(brace, M["wood_dark"])
    post = lib.box("HoistPost", (0.22, 0.22, 1.2), (WHEEL.x, 0.75, BLD["h"] + 0.6 + 0.2), C, bevel=0.01); lib.assign(post, M["wood_dark"])
    return dict(wins=wins, nwins=nwins)


def build_wheel():
    C = C_props
    root = bpy.data.objects.new("WheelRig", None); C.objects.link(root)
    root.location = WHEEL
    spin = bpy.data.objects.new("WheelSpin", None); C.objects.link(spin); spin.parent = root
    rim = lib.torus("Wheel_rim", WHEEL_R, 0.06, (0, 0, 0), (math.radians(90), 0, 0), 64, 12, C); lib.assign(rim, M["wood_dark"]); rim.parent = spin
    groove = lib.torus("Wheel_groove", WHEEL_R - 0.02, 0.035, (0, 0, 0), (math.radians(90), 0, 0), 64, 8, C); lib.assign(groove, M["iron"]); groove.parent = spin
    for k in range(6):
        a = math.pi * k / 6
        sp = lib.box("Wheel_spoke", (0.06, 0.06, 2 * WHEEL_R - 0.05), (0, 0, 0), C); lib.assign(sp, M["wood_dark"])
        sp.rotation_euler = (0, a, 0); sp.parent = spin
    hub = lib.cylinder("Wheel_hub", 0.11, 0.16, (0, 0, 0), (math.radians(90), 0, 0), 24, C); lib.assign(hub, M["iron"]); hub.parent = spin
    axle = lib.cylinder("Wheel_axle", 0.035, 0.5, (0, 0, 0), (math.radians(90), 0, 0), 12, C); lib.assign(axle, M["iron"]); axle.parent = root
    hang = lib.box("Wheel_hanger", (0.12, 0.06, 0.62), (0, 0.2, 0.31), C); lib.assign(hang, M["iron"]); hang.parent = root
    hang2 = lib.box("Wheel_hanger", (0.12, 0.06, 0.62), (0, -0.2, 0.31), C); lib.assign(hang2, M["iron"]); hang2.parent = root
    return root, spin


def build_piano(C, name="Piano"):
    root = bpy.data.objects.new(name, None); C.objects.link(root)
    W, D, H = 1.22, 0.56, 1.18
    body = lib.box(name + "_body", (W, D, H - 0.1), (0, 0.05, 0.05 + (H - 0.1) / 2), C, bevel=0.015); lib.assign(body, M["piano"])
    lid = lib.box(name + "_lid", (W + 0.04, D + 0.04, 0.05), (0, 0.05, H + 0.0), C, bevel=0.01); lib.assign(lid, M["piano"])
    shelf = lib.box(name + "_shelf", (W - 0.04, 0.28, 0.06), (0, -D / 2 - 0.08, 0.7), C, bevel=0.008); lib.assign(shelf, M["piano"])
    keys = lib.box(name + "_keys", (W - 0.14, 0.2, 0.025), (0, -D / 2 - 0.1, 0.743), C); lib.assign(keys, M["key_w"])
    for i in range(36):
        if i % 7 in (2, 6):
            continue
        k = lib.box(name + "_bk", (0.012, 0.11, 0.02), (-0.5 + i * 0.0286 + 0.014, -D / 2 - 0.06, 0.764), C)
        lib.assign(k, M["key_b"])
    fall = lib.box(name + "_fall", (W - 0.06, 0.04, 0.16), (0, -D / 2 + 0.0, 0.84), C, bevel=0.005); lib.assign(fall, M["piano"])
    fall.rotation_euler = (math.radians(-12), 0, 0)
    for sx in (-1, 1):
        leg = lib.box(name + "_leg", (0.07, 0.07, 0.62), (sx * (W / 2 - 0.08), -D / 2 - 0.16, 0.36), C, bevel=0.01); lib.assign(leg, M["piano"])
        toe = lib.box(name + "_toe", (0.09, 0.32, 0.06), (sx * (W / 2 - 0.08), -D / 2 - 0.06, 0.03), C, bevel=0.01); lib.assign(toe, M["piano"])
    for px in (-0.06, 0.06):
        pd = lib.box(name + "_pedal", (0.04, 0.12, 0.02), (px, -D / 2 - 0.05, 0.08), C); lib.assign(pd, M["gold"])
    plate = lib.box(name + "_logo", (0.16, 0.01, 0.025), (0, -D / 2 - 0.003, 0.97), C); lib.assign(plate, M["gold"])
    for o in list(C.objects):
        if o.name.startswith(name + "_") and o.parent is None:
            o.parent = root
    return root


def build_box():
    """Wooden cabin 1.7 x 1.7 x 2.3 with open front (-Y); origin at floor centre; hook ring on top."""
    C = C_props
    root = bpy.data.objects.new("Cabin", None); C.objects.link(root)
    W, D, H = 1.7, 1.7, 2.3
    planks = []
    fl = lib.box("Cabin_floor", (W, D, 0.12), (0, 0, 0.06), C, bevel=0.01); planks.append(fl)
    for k in range(6):
        z = 0.25 + k * 0.36
        for (nm, size, loc) in (("Cabin_back", (W, 0.06, 0.3), (0, D / 2 - 0.03, z)),
                                ("Cabin_left", (0.06, D, 0.3), (-W / 2 + 0.03, 0, z)),
                                ("Cabin_right", (0.06, D, 0.3), (W / 2 - 0.03, 0, z))):
            p = lib.box(nm, size, loc, C, bevel=0.008); planks.append(p)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = lib.box("Cabin_post", (0.1, 0.1, H), (sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), H / 2), C, bevel=0.01); planks.append(p)
    roof = lib.box("Cabin_roof", (W + 0.06, D + 0.06, 0.1), (0, 0, H), C, bevel=0.01); planks.append(roof)
    for p in planks:
        lib.assign(p, M["wood"]); p.parent = root
    ring = lib.torus("Cabin_ring", 0.1, 0.022, (0, 0, H + 0.14), (math.radians(90), 0, 0), 24, 8, C); lib.assign(ring, M["iron"]); ring.parent = root
    plate = lib.box("Cabin_panel", (0.18, 0.06, 0.3), (W / 2 - 0.16, -D / 2 + 0.3, 1.15), C, bevel=0.01)
    lib.assign(plate, lib.mat("M_PanelGrey", "#5E6266", rough=0.4, metal=0.5)); plate.parent = root
    plate.rotation_euler = (0, 0, math.radians(-90))
    btn = lib.cylinder("Cabin_button", 0.06, 0.05, (W / 2 - 0.2, -D / 2 + 0.3, 1.2), (0, math.radians(90), 0), 24, C)
    lib.assign(btn, M["red_btn"]); btn.parent = root
    return root


def build_shaft():
    """Wooden lattice shaft around the load strand, built in 6 stages (objects named Shaft_s{k})."""
    C = lib.coll("SHAFT", C_props)
    cx, cy = LOAD_X, ROPE_Y
    hw = 1.02
    stages = []
    H = WHEEL.z - 0.2
    n = 6
    for k in range(n):
        z0 = H * k / n; z1 = H * (k + 1) / n
        objs = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                p = lib.box(f"Shaft_post_{k}", (0.12, 0.12, z1 - z0), (cx + sx * hw, cy + sy * hw, (z0 + z1) / 2), C)
                objs.append(p)
        for (sx, sy, along) in ((0, 1, 'x'), (-1, 0, 'y'), (1, 0, 'y')):
            size = (2 * hw, 0.1, 0.12) if along == 'x' else (0.1, 2 * hw, 0.12)
            p = lib.box(f"Shaft_beam_{k}", size, (cx + sx * hw, cy + sy * hw, z1 - 0.06), C)
            objs.append(p)
        # diagonal planks on back and sides
        for (sx, sy, along) in ((0, 1, 'x'), (-1, 0, 'y'), (1, 0, 'y')):
            L = math.hypot(2 * hw, z1 - z0)
            ang = math.atan2(z1 - z0, 2 * hw)
            size = (L, 0.06, 0.1) if along == 'x' else (0.06, L, 0.1)
            p = lib.box(f"Shaft_diag_{k}", size, (cx + sx * hw, cy + sy * hw, (z0 + z1) / 2), C)
            p.rotation_euler = (0, -ang, 0) if along == 'x' else (ang, 0, 0)
            objs.append(p)
        for o in objs:
            lib.assign(o, M["wood"])
        # join stage
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        st = bpy.context.object; st.name = f"Shaft_s{k}"
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # origin at stage bottom centre so it can pop/scale from below
        bot = Vector((cx, cy, z0))
        st.data.transform(Matrix.Translation(-bot)); st.location = bot
        stages.append(st)
    return stages


def build_motor():
    C = C_props
    green = lib.mat("M_MotorGreen", "#2E7D4F", rough=0.35, metal=0.3, coat=0.3)
    root = bpy.data.objects.new("MotorRig", None); C.objects.link(root)
    root.location = (WHEEL.x, 0.55, BLD["h"] + 0.5)
    blk = lib.box("Motor_block", (0.5, 0.42, 0.2), (0, 0, 0.1), C, bevel=0.01); lib.assign(blk, M["iron"]); blk.parent = root
    body = lib.cylinder("Motor_body", 0.2, 0.42, (0, 0, 0.42), (math.radians(90), 0, 0), 40, C); lib.assign(body, green); body.parent = root
    for k in range(7):
        rib = lib.torus(f"Motor_rib{k}", 0.205, 0.012, (0, -0.18 + k * 0.06, 0.42), (math.radians(90), 0, 0), 40, 8, C)
        lib.assign(rib, green); rib.parent = root
    mp = lib.cylinder("Motor_pulley", 0.09, 0.06, (0, -0.26, 0.42), (math.radians(90), 0, 0), 24, C); lib.assign(mp, M["iron"]); mp.parent = root
    return root


def build_elevator_portal():
    """Modern steel elevator front at street level around the shaft (final reveal)."""
    C = lib.coll("MODERN", C_props)
    cx, cy = LOAD_X, ROPE_Y - 1.05
    root = bpy.data.objects.new("ModernRig", None); C.objects.link(root)
    root.location = (cx, cy, 0)
    W, H = 2.3, 2.75
    frame_parts = [lib.box("Mod_frameL", (0.22, 0.25, H), (-W / 2, 0, H / 2), C), lib.box("Mod_frameR", (0.22, 0.25, H), (W / 2, 0, H / 2), C),
                   lib.box("Mod_frameT", (W + 0.22, 0.25, 0.42), (0, 0, H + 0.21), C)]
    for p in frame_parts:
        lib.assign(p, M["steel"]); p.parent = root
    wall = lib.box("Mod_wall", (2.6, 0.12, 7.0), (0, 0.06, 3.2 + 3.5), C)
    lib.assign(wall, lib.mat("M_ModGlass", "#456878", rough=0.05, metal=0.6, spec=1.0)); wall.parent = root
    for k in range(1, 6):
        mb = lib.box("Mod_mullion", (2.62, 0.16, 0.08), (0, 0.02, 3.2 + k * 1.4), C); lib.assign(mb, M["steel"]); mb.parent = root
    for sx in (-1, 1):
        mv = lib.box("Mod_mullionV", (0.1, 0.16, 10.4), (sx * 1.3, 0.02, 5.2), C); lib.assign(mv, M["steel"]); mv.parent = root
    side = lib.box("Mod_side", (0.1, 2.2, 10.4), (-1.3, 1.45, 5.2), C); lib.assign(side, lib.mat("M_ModGlass2", "#4A7080", rough=0.05, metal=0.6)); side.parent = root
    side2 = lib.box("Mod_side", (0.1, 2.2, 10.4), (1.3, 1.45, 5.2), C); lib.assign(side2, bpy.data.materials["M_ModGlass2"]); side2.parent = root
    # door leaves (animated to slide open)
    dl = lib.box("Mod_doorL", (W / 2 - 0.12, 0.06, H - 0.1), (-W / 4 + 0.03, -0.05, (H - 0.1) / 2), C); lib.assign(dl, M["steel"]); dl.parent = root
    dr = lib.box("Mod_doorR", (W / 2 - 0.12, 0.06, H - 0.1), (W / 4 - 0.03, -0.05, (H - 0.1) / 2), C); lib.assign(dr, M["steel"]); dr.parent = root
    ind = lib.box("Mod_indicator", (0.9, 0.04, 0.24), (0, -0.14, H + 0.22), C)
    lib.assign(ind, lib.mat("M_Indicator", "#0B0D10", rough=0.3)); ind.parent = root
    arrow_m = lib.mat("M_IndArrow", "#FFB020", emit="#FFB020", emit_strength=6.0)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-0.07, 0, -0.06), (0.07, 0, -0.06), (0, 0, 0.07))]
    bm.faces.new(v)
    ar = lib.mesh_from_bmesh("Mod_arrow", bm, C, smooth=False); lib.assign(ar, arrow_m); ar.parent = root
    ar.location = (-0.25, -0.17, H + 0.22)
    # floor number text
    cu = bpy.data.curves.new("Mod_num", 'FONT')
    cu.font = bpy.data.fonts.load("/usr/share/fonts/opentype/montserrat/Montserrat-ExtraBold.otf", check_existing=True)
    cu.body = "3"; cu.size = 0.2; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    num = bpy.data.objects.new("Mod_num", cu); C.objects.link(num); num.parent = root
    num.location = (0.15, -0.17, H + 0.21); num.rotation_euler = (math.radians(90), 0, 0)
    num.data.materials.append(arrow_m)
    # call button panel
    pan = lib.box("Mod_callpanel", (0.14, 0.04, 0.3), (W / 2 + 0.32, -0.12, 1.2), C); lib.assign(pan, M["steel"]); pan.parent = root
    cb = lib.cylinder("Mod_callbtn", 0.035, 0.02, (W / 2 + 0.32, -0.15, 1.24), (math.radians(90), 0, 0), 20, C)
    lib.assign(cb, lib.mat("M_CallBtn", "#FFD27A", emit="#FFC14D", emit_strength=4.0)); cb.parent = root
    # cabin interior (steel box behind the doors)
    cab_parts = [lib.box("Mod_cab_back", (W, 0.06, H), (0, 1.75, H / 2), C), lib.box("Mod_cab_l", (0.06, 1.8, H), (-W / 2 + 0.05, 0.85, H / 2), C),
                 lib.box("Mod_cab_r", (0.06, 1.8, H), (W / 2 - 0.05, 0.85, H / 2), C), lib.box("Mod_cab_floor", (W, 1.8, 0.06), (0, 0.85, 0.03), C)]
    for p in cab_parts:
        lib.assign(p, M["steel"]); p.parent = root
    ceil = lib.box("Mod_cab_light", (W - 0.2, 1.6, 0.04), (0, 0.85, H - 0.05), C)
    lib.assign(ceil, lib.mat("M_CabLight", "#FFF3D6", emit="#FFF0CC", emit_strength=4.0)); ceil.parent = root
    rail = lib.cylinder("Mod_rail", 0.025, W - 0.3, (0, 1.65, 0.95), (0, math.radians(90), 0), 16, C); lib.assign(rail, M["gold"]); rail.parent = root
    return root


# ------------------------------------------------------------------ stairwell hall (interior set at x~32)
def build_stairwell():
    C = C_int
    x, w, rise, run, n = STAIR["x"], STAIR["w"], STAIR["rise"], STAIR["run"], STAIR["n"]
    floor = lib.box("Hall_floor", (12, 14, 0.1), (x + 3.5, 1.5, -0.05), C); lib.assign(floor, M["hall_floor"])
    for i in range(n):
        tr = lib.box(f"Step_t{i}", (w, run + 0.03, 0.04), (x, i * run + run / 2, (i + 1) * rise - 0.02), C, bevel=0.006)
        lib.assign(tr, M["stair_tread"])
        rs = lib.box(f"Step_r{i}", (w - 0.02, 0.02, rise), (x, i * run, i * rise + rise / 2), C)
        lib.assign(rs, M["riser"])
    # stringer under the steps (solid side)
    L = n * run
    bm = bmesh.new()
    pts = [(0, 0), (L, n * rise), (L, n * rise - 0.35), (0.6, 0)]
    for side in (-1, 1):
        pass
    sg = lib.box("Stair_stringer", (0.06, L * 1.2, 0.3), (x + w / 2 + 0.03, L / 2, n * rise / 2), C)
    sg.rotation_euler = (math.atan2(n * rise, L), 0, 0); lib.assign(sg, M["riser"])
    # left wall + back wall
    wl = lib.box("Hall_wallL", (0.2, 14, 6), (x - w / 2 - 0.1, 1.5, 3), C); lib.assign(wl, M["hall_wall"])
    wb = lib.box("Hall_wallB", (12, 0.2, 6), (x + 3.5, n * run + 1.4, 3), C); lib.assign(wb, M["hall_wall"])
    base = lib.box("Hall_base", (0.04, 14, 0.15), (x - w / 2 + 0.01, 1.5, 0.075), C); lib.assign(base, lib.mat("M_HallBase", "#4E5A4E", rough=0.6))
    # landing at top
    land = lib.box("Hall_landing", (w + 1.5, 1.4, 0.1), (x + 0.75, n * run + 0.7, n * rise - 0.05), C); lib.assign(land, M["stair_tread"])
    # railing (open side)
    for i in range(0, n, 2):
        bal = lib.cylinder(f"Baluster_{i}", 0.02, 0.85, (x + w / 2 - 0.05, i * run + run / 2, (i + 1) * rise + 0.42), (0, 0, 0), 10, C)
        lib.assign(bal, M["trim"])
    rail = lib.cylinder("Handrail", 0.035, math.hypot(L, n * rise) + 0.2, (x + w / 2 - 0.05, L / 2, n * rise / 2 + 0.9), (math.atan2(L, n * rise) * -1 + math.pi / 2 * 0, 0, 0), 12, C)
    rail.rotation_euler = (-(math.pi / 2 - math.atan2(n * rise, L)), 0, 0)
    lib.assign(rail, M["wood_dark"])
    newel = lib.box("Newel", (0.12, 0.12, 1.1), (x + w / 2 - 0.05, -0.05, 0.55), C, bevel=0.01); lib.assign(newel, M["wood_dark"])
    # a window + picture frame on the wall for scale
    window("Hall_window", C, (x - w / 2 + 0.01, 2.0, 2.6), axis='X', face=+1)
    pic = lib.box("Hall_picture", (0.04, 0.7, 0.5), (x - w / 2 + 0.02, 0.4, 1.9), C); lib.assign(pic, lib.mat("M_Picture", "#C9A24A", metal=0.8, rough=0.3))
    for (nm, loc, en, sh) in (("HallKey", (x + 3.5, -1.5, 4.2), 900, True), ("HallFill", (x + 4.0, 3.5, 3.0), 350, False)):
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = 2.5; ld.use_shadow = sh
        ld.color = (1.0, 0.93, 0.82)
        ld.use_custom_distance = True; ld.cutoff_distance = 14
        lo = bpy.data.objects.new(nm, ld); C.objects.link(lo); lo.location = loc
        d = Vector((x, 1.8, 1.5)) - Vector(loc); lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    lamp = lib.icosphere("Hall_lampbulb", 0.12, 2, (x + 0.2, 1.6, 4.6), C)
    lib.assign(lamp, lib.mat("M_HallBulb", "#FFF2D0", emit="#FFE6B0", emit_strength=10))
    return dict(stair_top=(x, L, n * rise))


# ------------------------------------------------------------------ build all
ext = build_exterior()
wroot, wspin = build_wheel()
piano = build_piano(C_props, "Piano")
piano.location = (LOAD_X, ROPE_Y, 0.0)
piano2 = build_piano(C_int, "PianoHall")
cabin = build_box()
cabin.location = (LOAD_X, ROPE_Y, 0.0)
stages = build_shaft()
motor = build_motor()
modern = build_elevator_portal()
hall = build_stairwell()
# rope pieces
for nm in ("Rope_load", "Rope_cnt", "Rope_hands", "Rope_belt"):
    r = rope_obj(nm, C_props, 0.026 if nm != "Rope_belt" else 0.02)
# boulder
objs = append_ph("boulder_01", C_props)
meshes_ = [o for o in objs if o.type == 'MESH']
rock = max(meshes_, key=lambda o: len(o.data.vertices))
mw = rock.matrix_world.copy(); rock.parent = None; rock.matrix_world = mw
for o in objs:
    if o is not rock:
        bpy.data.objects.remove(o, do_unlink=True)
rock.name = "Rock"
rock.location = (0, 0, 0); rock.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()
dims = rock.dimensions
s = 1.25 / max(dims)
rock.scale = (s, s, s)
bpy.context.view_layer.update()
# hammer
hobjs = append_ph("cross_pein_hammer", C_props)
hammer = hobjs[0]; hammer.name = "Hammer"
# lights / world / render
w = bpy.data.worlds.new("World_Street"); sc.world = w
nt = w.node_tree
bg = nt.nodes["Background"]
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(f"{PH}/kloofendal_48d_partly_cloudy_puresky/kloofendal_48d_partly_cloudy_puresky_2k.exr")
mp = nt.nodes.new("ShaderNodeMapping"); tc = nt.nodes.new("ShaderNodeTexCoord")
mp.inputs["Rotation"].default_value = (0, 0, math.radians(110))
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.9
w.use_sun_shadow = False
sun_d = bpy.data.lights.new("Sun", 'SUN'); sun_d.energy = 4.2; sun_d.angle = math.radians(4); sun_d.color = (1.0, 0.96, 0.9)
sun = bpy.data.objects.new("Sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(48), 0, math.radians(-35))
render_settings(sc, res=(1080, 1920), samples=4)
sc["layout"] = dict(wheel=list(WHEEL), wheel_r=WHEEL_R, load_x=LOAD_X, cnt_x=CNT_X, rope_y=ROPE_Y,
                    bld_h=BLD["h"], stair=STAIR, stair_top=list(hall["stair_top"]))
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/elev_master.blend")
print("ELEV MASTER saved", time.time() - t0)
