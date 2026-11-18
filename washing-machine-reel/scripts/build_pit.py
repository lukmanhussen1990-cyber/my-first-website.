"""Trapdoor floor + brick fire pit under the worker crowd."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
import lib
from lib import srgb

PIT = dict(x0=-20.45, x1=-6.5, y0=-13.45, y1=1.05, depth=6.0)


def brick_material():
    m = bpy.data.materials.new("M_PitBrick")
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.6
    br.inputs["Mortar Size"].default_value = 0.025
    br.inputs["Color1"].default_value = srgb("#A8402A")
    br.inputs["Color2"].default_value = srgb("#C4573A")
    br.inputs["Mortar"].default_value = srgb("#3B2A22")
    br.offset = 0.5
    # brick texture works in XY; walls are vertical -> use (u,z) mapping via object coords swizzle
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = 'ADD'
    nt.links.new(sep.outputs[0], add.inputs[0]); nt.links.new(sep.outputs[1], add.inputs[1])
    cmb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(add.outputs[0], cmb.inputs[0]); nt.links.new(sep.outputs[2], cmb.inputs[1])
    nt.links.new(cmb.outputs[0], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.85
    p.inputs["Emission Color"].default_value = srgb("#FF6A1A")
    p.inputs["Emission Strength"].default_value = 0.0
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.4
    nt.links.new(br.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], p.inputs["Normal"])
    m.diffuse_color = srgb("#B5492F")
    return m


def fire_material(name="M_Fire"):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.noise_dimensions = '4D'
    nz.inputs["Scale"].default_value = 1.6; nz.inputs["Detail"].default_value = 4
    tv = nt.nodes.new("ShaderNodeValue"); tv.name = "Time"; tv.outputs[0].default_value = 0.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"]); nt.links.new(tv.outputs[0], nz.inputs["W"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position = 0.3; el[0].color = srgb("#B3170A")
    el[1].position = 0.78; el[1].color = srgb("#FFC21A")
    e2 = el.new(0.52); e2.color = srgb("#FF5A0A")
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 2.6
    p.inputs["Roughness"].default_value = 0.9
    m.diffuse_color = srgb("#FF7A12")
    return m


def build(C, floor_obj, total_frames=1700):
    P = PIT
    x0, x1, y0, y1, D = P["x0"], P["x1"], P["y0"], P["y1"], P["depth"]
    xc = (x0 + x1) / 2
    # ---- rebuild floor with a hole
    me = floor_obj.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    X0, X1, Y0, Y1 = min(xs), max(xs), min(ys), max(ys)
    bm = bmesh.new()
    def quad(a, b, c, d):
        vs = [bm.verts.new((x, y, 0)) for x, y in (a, b, c, d)]
        bm.faces.new(vs)
    quad((X0, Y0), (X1, Y0), (X1, y0), (X0, y0))      # front strip
    quad((X0, y1), (X1, y1), (X1, Y1), (X0, Y1))      # back strip
    quad((X0, y0), (x0, y0), (x0, y1), (X0, y1))      # left strip
    quad((x1, y0), (X1, y0), (X1, y1), (x1, y1))      # right strip
    bm.to_mesh(me); bm.free()
    fm = floor_obj.data.materials[0]
    # ---- trapdoors (mesh in world coords, parented to hinge empties)
    hinges = []
    for side, (ha, hb, hx) in (("L", (x0, xc, x0)), ("R", (xc, x1, x1))):
        bmd = bmesh.new()
        res = bmesh.ops.create_cube(bmd, size=1.0)
        for v in bmd.verts:
            v.co = Vector(((ha + hb) / 2 + v.co.x * (hb - ha - 0.01), (y0 + y1) / 2 + v.co.y * (y1 - y0 - 0.01), -0.03 + v.co.z * 0.06))
        dm = bpy.data.meshes.new(f"Trapdoor_{side}")
        bmd.to_mesh(dm); bmd.free()
        door = bpy.data.objects.new(f"Trapdoor_{side}", dm)
        C.objects.link(door)
        dm.materials.append(fm)
        hinge = bpy.data.objects.new(f"Hinge_{side}", None)
        C.objects.link(hinge)
        hinge.location = (hx, (y0 + y1) / 2, 0)
        door.parent = hinge
        door.matrix_parent_inverse = hinge.matrix_world.inverted()
        hinges.append(hinge)
    # ---- pit walls
    brick = brick_material()
    walls = []
    for name, loc, size in (("Pit_wF", ((x0 + x1) / 2, y0, -D / 2), (x1 - x0, 0.1, D)),
                            ("Pit_wB", ((x0 + x1) / 2, y1, -D / 2), (x1 - x0, 0.1, D)),
                            ("Pit_wL", (x0, (y0 + y1) / 2, -D / 2), (0.1, y1 - y0, D)),
                            ("Pit_wR", (x1, (y0 + y1) / 2, -D / 2), (0.1, y1 - y0, D))):
        w = lib.box(name, size, loc, C)
        lib.assign(w, brick)
        walls.append(w)
    # ---- fire bed
    fire_m = fire_material()
    bed = lib.box("Pit_fireBed", (x1 - x0, y1 - y0, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, -D), C)
    lib.assign(bed, fire_m)
    rng = random.Random(9)
    flame_m = fire_material("M_Flame")
    flames = []
    bmf = bmesh.new()
    bmesh.ops.create_cone(bmf, cap_ends=True, segments=12, radius1=1.0, radius2=0.0, depth=1.0)
    for v in bmf.verts:
        v.co.z += 0.5
        k = v.co.z
        v.co.x *= (1 - k) ** 0.6 if k < 1 else 0
        v.co.y *= (1 - k) ** 0.6 if k < 1 else 0
    fmesh = bpy.data.meshes.new("FlameMesh")
    bmf.to_mesh(fmesh); bmf.free()
    for p in fmesh.polygons:
        p.use_smooth = True
    fmesh.materials.append(flame_m)
    for i in range(95):
        fo = bpy.data.objects.new(f"Flame_{i}", fmesh)
        C.objects.link(fo)
        fo.location = (rng.uniform(x0 + 0.5, x1 - 0.5), rng.uniform(y0 + 0.5, y1 - 0.5), -D)
        base = rng.uniform(0.7, 1.25)
        h = rng.uniform(3.4, 5.6)
        fo.visible_shadow = False
        for f in range(1, total_frames + 2, 3):
            fl = 1.0 + 0.25 * math.sin(f * 0.9 + i) + 0.15 * math.sin(f * 2.3 + 2 * i)
            fo.scale = (base, base, h * fl)
            fo.keyframe_insert("scale", frame=f)
            fo.rotation_euler = (0.12 * math.sin(f * 0.5 + i), 0.12 * math.cos(f * 0.4 + i), 0)
            fo.keyframe_insert("rotation_euler", frame=f)
        flames.append(fo)
    tv = fire_m.node_tree.nodes["Time"]
    for mm in (fire_m, flame_m):
        n = mm.node_tree.nodes["Time"]
        n.outputs[0].default_value = 0.0
        n.outputs[0].keyframe_insert("default_value", frame=1)
        n.outputs[0].default_value = 60.0
        n.outputs[0].keyframe_insert("default_value", frame=total_frames)
        for fc in lib.fcurves_of(mm.node_tree):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    # glow lights (no shadows)
    lights = []
    for i, (lx, ly) in enumerate(((x0 + 3, y0 + 3.5), (x1 - 3, y0 + 3.5), (x0 + 3, y1 - 3.5), (x1 - 3, y1 - 3.5))):
        ld = bpy.data.lights.new(f"PitGlow_{i}", 'POINT')
        ld.energy = 2200
        ld.color = (1.0, 0.45, 0.12)
        ld.shadow_soft_size = 1.5
        ld.use_shadow = False
        lo = bpy.data.objects.new(f"PitGlow_{i}", ld)
        C.objects.link(lo)
        lo.location = (lx, ly, -4.6)
        lights.append(lo)
    return dict(hinges=hinges, walls=walls, bed=bed, flames=flames, lights=lights, xc=xc)
