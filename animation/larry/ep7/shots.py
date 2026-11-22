"""Shot definitions for Episode 7 "Group Hug" (Dale is in prison; Larry can't break him out, so he cuddles you).
Same pipeline as episodes 1-6; builds on episode 6's helpers (which pull in episodes 1-4)."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale, fit, bbox)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ep6shots", os.path.join(_HERE, "..", "ep6", "shots.py"))
ep6 = importlib.util.module_from_spec(_spec)
sys.modules["ep6shots"] = ep6
_spec.loader.exec_module(ep6)
ep4, ep3, ep2, ep1 = ep6.ep4, ep6.ep3, ep6.ep2, ep6.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, WINK, TADA, SERENE,
                      SLEEP, face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, lipsync, SIT,
                      ALL_FOURS)  # noqa
load_char, closeup, look_head, retarget_hand = ep6.load_char, ep6.closeup, ep6.look_head, ep6.retarget_hand
pose_seq, GRIN, STERN, RAGE = ep6.pose_seq, ep6.GRIN, ep6.STERN, ep6.RAGE
SAD = {"browInnerUp": 1.0, "mouthFrownLeft": 0.7, "mouthFrownRight": 0.7, "eyeSquintLeft": 0.3, "eyeSquintRight": 0.3,
       "mouthPressLeft": 0.3, "mouthPressRight": 0.3}
CRY = dict(SAD, eyeBlinkLeft=0.8, eyeBlinkRight=0.8, jawOpen=0.25, mouthStretchLeft=0.4, mouthStretchRight=0.4)
CUDDLE = {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0, "mouthSmileLeft": 0.8, "mouthSmileRight": 0.8,
          "cheekSquintLeft": 0.5, "cheekSquintRight": 0.5, "browInnerUp": 0.4}

D7 = os.path.join(lib.SCRATCH, "ep7", "decals")
SHOTS = {}


def shot(fn):
    SHOTS[fn.__name__] = fn
    return fn


def frames_of(name):
    for i, (n, t) in enumerate(CUTS[:-1]):
        if n == name:
            return round(CUTS[i + 1][1] * lib.FPS) - round(t * lib.FPS)
    raise KeyError(name)


def at(name, t):
    t0 = dict(CUTS)[name]
    return max(1, round((t - t0) * lib.FPS) + 1)


KNEEL = ep3.KNEEL if hasattr(ep3, "KNEEL") else {"lfemur": {"rx": -5}, "rfemur": {"rx": -5}, "ltibia": {"rx": 95},
                                                  "rtibia": {"rx": 95}}
LIE_SIDE = {"lfemur": {"rx": -45}, "rfemur": {"rx": -30}, "ltibia": {"rx": 60}, "rtibia": {"rx": 45}}


# ============================================================================ props
def file_tool(name="file"):
    root = empty(name)
    m = mat_flat("filesteel", (0.6, 0.62, 0.66), metal=0.6, rough=0.45)
    box(f"{name}_blade", (0.02, 0.22, 0.006), (0, 0.11, 0), m).parent = root
    box(f"{name}_tang", (0.026, 0.09, 0.016), (0, -0.04, 0), mat_flat("filehandle", (0.45, 0.2, 0.08), rough=0.6), bevel=0.005).parent = root
    return root


def cake(name="cake", with_file=True):
    """A round two-layer cake with pink icing and a metal file sticking out of the top. Origin at its base."""
    root = empty(name)
    sponge = mat_flat("sponge", (0.92, 0.78, 0.5), rough=0.8)
    icing = mat_flat("icing", (1.0, 0.72, 0.82), rough=0.35)
    cylinder(f"{name}_l1", 0.15, 0.08, (0, 0, 0.04), sponge, verts=40).parent = root
    cylinder(f"{name}_i1", 0.152, 0.015, (0, 0, 0.087), icing, verts=40).parent = root
    cylinder(f"{name}_l2", 0.15, 0.07, (0, 0, 0.13), sponge, verts=40).parent = root
    cylinder(f"{name}_i2", 0.155, 0.02, (0, 0, 0.17), icing, verts=40).parent = root
    for k in range(10):
        a = k * math.pi / 5
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=(0.12 * math.cos(a), 0.12 * math.sin(a), 0.19))
        b = bpy.context.object; b.data.materials.append(mat_flat("cherry", (0.75, 0.04, 0.08), rough=0.2)); b.parent = root
    cylinder(f"{name}_plate", 0.2, 0.01, (0, 0, 0.005), mat_flat("plate", (0.95, 0.95, 0.96), rough=0.2), verts=40).parent = root
    if with_file:
        f = file_tool(f"{name}_file"); f.parent = root
        f.location = (0.02, 0.0, 0.2); f.rotation_euler = (math.radians(-72), 0, math.radians(20))
    return root


def shovel(name="shovel"):
    root = empty(name)
    wood = mat_flat("shaftwood", (0.5, 0.33, 0.16), rough=0.6)
    steel = mat_flat("spade", (0.45, 0.47, 0.5), metal=0.6, rough=0.4)
    cylinder(f"{name}_shaft", 0.018, 1.0, (0, 0, 0.5), wood, verts=12).parent = root
    box(f"{name}_blade", (0.2, 0.025, 0.26), (0, 0, -0.1), steel, bevel=0.01).parent = root
    box(f"{name}_grip", (0.14, 0.03, 0.03), (0, 0, 1.0), wood).parent = root
    return root


def miner_helmet(ch, light=True):
    """Yellow hard hat with a head lamp (and a real spot light) on the Head bone."""
    root = empty(f"helmet_{ch.name}")
    y = mat_flat("hardhat", (0.95, 0.75, 0.05), rough=0.35)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.135, location=(0, 0, 0))
    d = bpy.context.object; d.scale = (1.0, 1.12, 0.78); d.data.materials.append(y); bpy.ops.object.shade_smooth(); d.parent = root
    cylinder("brim", 0.16, 0.012, (0, -0.02, -0.03), y, verts=32).parent = root
    lamp = cylinder("lamp", 0.03, 0.04, (0, -0.15, 0.03), mat_flat("lampglass", (1, 1, 0.9), emit=(1.0, 0.95, 0.8), emit_strength=20),
                    rot=(90, 0, 0), verts=16)
    lamp.parent = root
    on_bone(ch, root, "Head", (0, 0.12, 0.0))
    if light:
        sp = bpy.data.lights.new("headlamp", "SPOT"); sp.energy = 60; sp.spot_size = math.radians(55); sp.color = (1.0, 0.92, 0.75)
        lo = bpy.data.objects.new("headlamp", sp); bpy.context.scene.collection.objects.link(lo)
        lo.parent = root; lo.location = (0, -0.17, 0.03); lo.rotation_euler = (math.radians(90), 0, 0)
    return root


def nightlight(name="nightlight"):
    """A little moon-shaped nightlight that glows warm, with a real point light."""
    root = empty(name)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.06, location=(0, 0, 0.06))
    g = bpy.context.object; g.data.materials.append(mat_flat("nlglow", (1, 0.95, 0.7), emit=(1.0, 0.82, 0.45), emit_strength=12))
    bpy.ops.object.shade_smooth(); g.parent = root; g.visible_shadow = False
    cylinder(f"{name}_base", 0.045, 0.03, (0, 0, 0.0), mat_flat("nlbase", (0.9, 0.9, 0.92), rough=0.4), verts=20).parent = root
    l = point(f"{name}_light", (0, 0, 0.06), energy=8, color=(1.0, 0.75, 0.4), radius=0.05); l.parent = root
    return root


def photo_frame(name="dalephoto"):
    root = empty(name)
    box(f"{name}_frame", (0.2, 0.02, 0.26), (0, 0, 0), mat_flat("pframe", (0.75, 0.6, 0.25), metal=0.6, rough=0.3), bevel=0.006).parent = root
    decal(f"{name}_pic", f"{D7}/photo_dale.png", 0.17, (0, -0.012, 0), rot=(90, 0, 0)).parent = root
    return root


def fur_mat(name="fur", tint=(1.0, 1.0, 1.0)):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.95
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (5, 5, 5)
    im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(f"{D7}/fur.png", check_existing=True)
    im.projection = "BOX"; im.projection_blend = 0.3
    bc = nt.nodes.new("ShaderNodeBrightContrast"); bc.inputs["Bright"].default_value = (tint[0] - 1.0) * 0.5
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.6; bp.inputs["Distance"].default_value = 0.01
    nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], im.inputs[0])
    nt.links.new(im.outputs[0], bc.inputs["Color"]); nt.links.new(bc.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(im.outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


def bear_head(name="bearhead"):
    """Teddy bear head mask (worn over a head): round head, muzzle, nose, button eyes, two ears. Modelled Z-up,
    face toward -Y, origin at the centre of the wearer's head."""
    root = empty(name)
    f = fur_mat()
    light = fur_mat("fur_light", (1.35, 1.25, 1.1))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.19, location=(0, 0.0, 0.03))
    h = bpy.context.object; h.scale = (1.05, 1.0, 0.98); h.data.materials.append(f); bpy.ops.object.shade_smooth(); h.parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.085, location=(0, -0.17, -0.02))
    mz = bpy.context.object; mz.scale = (1.15, 0.8, 0.85); mz.data.materials.append(light); bpy.ops.object.shade_smooth(); mz.parent = root
    black = mat_flat("bearblack", (0.02, 0.015, 0.01), rough=0.15)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.028, location=(0, -0.24, 0.0))
    ns = bpy.context.object; ns.scale = (1.3, 0.8, 0.9); ns.data.materials.append(black); bpy.ops.object.shade_smooth(); ns.parent = root
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.024, location=(s * 0.075, -0.165, 0.075))
        e = bpy.context.object; e.data.materials.append(black); bpy.ops.object.shade_smooth(); e.parent = root
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.07, location=(s * 0.15, 0.0, 0.18))
        ear = bpy.context.object; ear.scale = (1.0, 0.55, 1.0); ear.data.materials.append(f); bpy.ops.object.shade_smooth(); ear.parent = root
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.045, location=(s * 0.15, -0.03, 0.18))
        ei = bpy.context.object; ei.scale = (1.0, 0.4, 1.0); ei.data.materials.append(light); bpy.ops.object.shade_smooth(); ei.parent = root
    return root


def body_fur_mix(ch, neck_z):
    """Body skin -> fur below the neck (object-space Z), so the face stays Larry when the bear head comes off."""
    for o in ch.meshes:
        if ".body" not in o.name:
            continue
        for m in o.data.materials:
            if not m or not m.use_nodes or m.get("furred"):
                continue
            nt = m.node_tree
            out = nt.get_output_node("EEVEE") or next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
            if not out or not out.inputs["Surface"].links:
                continue
            sh = out.inputs["Surface"].links[0].from_socket
            fb = nt.nodes.new("ShaderNodeBsdfPrincipled"); fb.inputs["Roughness"].default_value = 0.95
            fb.inputs["Base Color"].default_value = (0.36, 0.22, 0.11, 1)
            tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
            lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = neck_z
            mix = nt.nodes.new("ShaderNodeMixShader")
            nt.links.new(tc.outputs["Object"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], lt.inputs[0])
            nt.links.new(lt.outputs[0], mix.inputs["Fac"]); nt.links.new(sh, mix.inputs[1]); nt.links.new(fb.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs["Surface"])
            m["furred"] = True


def bear_suit(ch, head=True):
    """Larry in a teddy bear suit: every garment becomes brown fur (puffed out a little), the body is fur below the
    neck, and a teddy head mask sits over his head. Returns the head mask (rotate/move it to take it off)."""
    f = fur_mat()
    for o in ch.meshes:
        nm = o.name.lower()
        if ".body" in nm or any(k in nm for k in ("eye", "teeth", "tongue", "brow", "lash", "moustache", "glasses", "short04", "hair")):
            continue
        o.data.materials.clear(); o.data.materials.append(f)
        dm = o.modifiers.new("puff", "DISPLACE"); dm.mid_level = 0.0; dm.strength = 0.02
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    body = next(o for o in ch.meshes if ".body" in o.name)
    nz = (body.matrix_world.inverted() @ ch.world("Neck")).z
    body_fur_mix(ch, nz)
    if not head:
        return None
    hm = bear_head(f"bearhead_{ch.name}")
    on_bone(ch, hm, "Head", (0, 0.1, 0.02), rot=(-90, 0, 0))
    return hm


# ============================================================================ sets
def prison_cells(lit=True):
    """Cell block: corridor along X (y<0), cells on +Y behind bars. Cell 7 = x 0..2.4 (Dale), cell 8 = x 2.4..4.8."""
    world_color((0.06, 0.07, 0.08), 0.4)
    conc = mat_tex("pconc", "brushed_concrete", scale=1.0, tint=(0.72, 0.8, 0.74))
    plane("pfloor", (20, 12), (2.4, 0, 0), mat_tex("pfl", "concrete_floor_02", scale=1.0, tint=(0.65, 0.66, 0.66)), uv_scale=0.4)
    plane("pceil", (20, 12), (2.4, 0, 3.0), mat_flat("pceilm", (0.55, 0.57, 0.55)), rot=(180, 0, 0))
    box("pback", (20, 0.2, 3.0), (2.4, 2.7, 1.5), conc, uv_scale=0.5)
    box("pcorr", (20, 0.2, 3.0), (2.4, -3.0, 1.5), conc, uv_scale=0.5)
    for x in (-2.4, 0.0, 2.4, 4.8, 7.2):
        box(f"pdiv{x}", (0.2, 2.6, 3.0), (x, 1.3, 1.5), conc, uv_scale=0.5)
    bars = mat_flat("bars", (0.28, 0.3, 0.32), metal=0.8, rough=0.35)
    for c0 in (-2.4, 0.0, 2.4, 4.8):
        for k in range(1, 20):
            cylinder(f"bar{c0}_{k}", 0.018, 2.6, (c0 + k * 0.12, 0.0, 1.3), bars, verts=10)
        for z in (0.1, 1.2, 2.55):
            box(f"rail{c0}{z}", (2.4, 0.05, 0.05), (c0 + 1.2, 0.0, z), bars)
    rnd = random.Random(3)
    for c0 in (0.0, 2.4):
        box(f"bunk{c0}", (1.9, 0.75, 0.08), (c0 + 1.15, 2.15, 0.5), bars)
        box(f"mat{c0}", (1.85, 0.7, 0.1), (c0 + 1.15, 2.15, 0.59), mat_flat("pmatt", (0.85, 0.84, 0.78), rough=0.9), bevel=0.03)
        box(f"toilet{c0}", (0.4, 0.45, 0.42), (c0 + 0.35, 1.0, 0.21), mat_flat("steelwc", (0.75, 0.76, 0.78), metal=0.7, rough=0.3), bevel=0.06)
        box(f"pwin{c0}", (0.7, 0.05, 0.4), (c0 + 1.2, 2.6, 2.4), mat_flat("pwinsky", (1, 1, 1), emit=(0.85, 0.92, 1.0), emit_strength=3))
        for k in range(4):
            cylinder(f"pwbar{c0}{k}", 0.012, 0.4, (c0 + 0.95 + k * 0.17, 2.58, 2.4), bars, verts=8)
    decal("tally_d", f"{D7}/tally_dale.png", 1.3, (1.25, 2.59, 1.35), rot=(90, 0, 180), alpha=True)
    decal("tally_l", f"{D7}/tally_larry.png", 0.45, (3.4, 2.59, 1.35), rot=(90, 0, 180), alpha=True)
    decal("cell7", f"{D7}/cell_7.png", 0.4, (1.2, -0.04, 2.78), rot=(90, 0, 0))
    decal("cell8", f"{D7}/cell_8.png", 0.4, (3.6, -0.04, 2.78), rot=(90, 0, 0))
    light = mat_flat("fluoro", (1, 1, 1), emit=(0.9, 0.97, 1.0), emit_strength=6)
    for x in (-1.2, 1.2, 3.6, 6.0):
        plane(f"fl{x}", (1.2, 0.15), (x, -1.4, 2.98), light, rot=(180, 0, 0))
        plane(f"flc{x}", (0.9, 0.12), (x, 1.5, 2.98), light, rot=(180, 0, 0))
    area("pfill", (2.4, -2.0, 2.8), (2.4, 1.0, 1.0), energy=600, size=6, color=(0.85, 0.95, 1.0))
    area("pcell", (1.2, -0.6, 2.4), (1.2, 1.0, 1.4), energy=160, size=1.5, color=(0.9, 0.97, 1.0))
    area("pcell8", (3.6, -0.6, 2.4), (3.6, 1.0, 1.4), energy=160, size=1.5, color=(0.9, 0.97, 1.0))


def jumpsuit_dale(loc, rot_z, **k):
    d = load_char("dale_jail", loc, rot_z=rot_z, tag="dale", **k)
    ep2.chest_print(d, f"{D7}/inmate_no.png", width=0.2, name="inmateno")
    return d


def prison_exterior():
    """High grey wall along X at y=12 with a steel gate at x=0, a sign, watchtowers and razor wire; a road up to it."""
    world_hdri("kloofendal_43d_clear_puresky", strength=1.0, rot_z=30)
    sun(energy=3.8, rot=(48, 0, 150), color=(1.0, 0.95, 0.88))
    ep2.ground("coast_sand_01", size=300, scale=0.3, tint=(0.7, 0.72, 0.6))
    plane("proad", (6, 30), (0, -3, 0.005), mat_tex("prasph", "asphalt_02", scale=1.0), uv_scale=0.3)
    wall = mat_tex("pwall", "brushed_concrete", scale=1.0, tint=(0.75, 0.75, 0.73))
    ep1.wall_openings("pextwall", -40, 40, 12.0, 6.0, 0.8, [(0.0, 4.0, 0.0, 4.2)], wall)
    gate = mat_flat("gatesteel", (0.3, 0.33, 0.36), metal=0.7, rough=0.4)
    hinges = []
    for s in (-1, 1):
        h = empty(f"gatehinge{s}", (s * 2.0, 11.6, 0)); hinges.append(h)
        g = box(f"gate{s}", (2.0, 0.12, 4.2), (-s * 1.0, 0, 2.1), gate, bevel=0.02); g.parent = h
        for k in range(5):
            b = box(f"gaterib{s}{k}", (0.06, 0.16, 4.2), (-s * (0.2 + k * 0.4), -0.02, 2.1), gate); b.parent = h
    decal("psign", f"{D7}/sign_prison.png", 5.0, (0, 11.55, 5.0), rot=(90, 0, 0))
    wire = mat_flat("razor", (0.7, 0.72, 0.75), metal=0.9, rough=0.3)
    for k in range(40):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.012, location=(-40 + k * 2.0, 12.0, 6.25),
                                         rotation=(0, math.radians(90), 0))
        t = bpy.context.object; t.data.materials.append(wire)
        ar = t.modifiers.new("arr", "ARRAY"); ar.count = 8; ar.use_relative_offset = False; ar.use_constant_offset = True
        ar.constant_offset_displace = (0, 0, 0.25)
    for x in (-14, 14):
        box(f"tower{x}", (3, 3, 9), (x, 12.5, 4.5), wall, uv_scale=0.5)
        box(f"towercab{x}", (3.6, 3.6, 1.8), (x, 12.5, 9.9), mat_flat("towercab", (0.25, 0.28, 0.3)), bevel=0.05)
        box(f"towerroof{x}", (4.2, 4.2, 0.25), (x, 12.5, 10.95), wall)
    return hinges


def visiting_room():
    world_color((0.08, 0.09, 0.1), 0.4)
    wall = mat_tex("vwall", "painted_plaster_wall", scale=1.0, tint=(0.75, 0.82, 0.88))
    plane("vfloor", (10, 10), (0, 0, 0), mat_tex("vfl", "floor_tiles_02", scale=1.0, tint=(0.75, 0.76, 0.78)), uv_scale=0.6)
    box("vback", (10, 0.2, 3.0), (0, 2.5, 1.5), wall, uv_scale=0.5)
    plane("vceil", (10, 10), (0, 0, 3.0), mat_flat("vceilm", (0.75, 0.75, 0.75)), rot=(180, 0, 0))
    decal("vsign", f"{D7}/sign_visiting.png", 1.8, (0, 2.39, 2.3), rot=(90, 0, 0))
    tab = mat_flat("vtable", (0.85, 0.86, 0.88), rough=0.4)
    box("vtable", (1.6, 0.9, 0.05), (0, 0, 0.76), tab, bevel=0.01)
    for x in (-0.7, 0.7):
        for y in (-0.38, 0.38):
            cylinder(f"vleg{x}{y}", 0.025, 0.74, (x, y, 0.37), mat_flat("vlegm", (0.3, 0.3, 0.32), metal=0.7))
    area("vfill", (0, -2.5, 2.8), (0, 0.5, 0.8), energy=500, size=4, color=(0.95, 0.98, 1.0))
    area("vtop", (0, 0, 2.9), (0, 0, 0), energy=300, size=3, color=(0.95, 0.98, 1.0))


def warden_office(hole=False):
    world_color((0.06, 0.06, 0.07), 0.4)
    wall = mat_tex("wwall", "painted_plaster_wall", scale=1.0, tint=(0.82, 0.78, 0.68))
    plane("wofloor", (10, 10), (0, 0, 0), mat_tex("wofl", "wood_floor", scale=1.0, tint=(0.7, 0.55, 0.42)), uv_scale=0.6)
    box("woback", (10, 0.2, 3.0), (0, 2.6, 1.5), wall, uv_scale=0.5)
    box("woleft", (0.2, 10, 3.0), (-3.0, 0, 1.5), wall, uv_scale=0.5)
    plane("woceil", (10, 10), (0, 0, 3.0), mat_flat("woceilm", (0.8, 0.8, 0.78)), rot=(180, 0, 0))
    desk = ep6.oak_mat("deskoak", (0.45, 0.28, 0.14), (0.3, 0.17, 0.08)) if hasattr(ep6, "oak_mat") else mat_flat("desk", (0.4, 0.25, 0.12))
    box("wodesk", (1.8, 0.8, 0.06), (0, 1.5, 0.76), desk, bevel=0.01)
    box("wodeskfront", (1.8, 0.05, 0.7), (0, 1.12, 0.38), desk)
    decal("wonameplate", f"{D7}/nameplate_warden.png", 0.45, (0, 1.09, 0.6), rot=(90, 0, 0))
    cylinder("flagpole", 0.02, 2.4, (1.4, 2.3, 1.2), mat_flat("flagpole", (0.8, 0.7, 0.3), metal=0.8, rough=0.3))
    box("flag", (0.03, 0.9, 0.6), (1.4, 1.85, 2.0), mat_flat("flag", (0.12, 0.2, 0.5), rough=0.8))
    if hole:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.45, depth=0.04, location=(0, 0.1, 0.0))
        hl = bpy.context.object; hl.data.materials.append(mat_flat("hole", (0.03, 0.02, 0.015), rough=1.0))
        rnd = random.Random(4)
        dirt = mat_flat("dirtclump", (0.32, 0.22, 0.12), rough=1.0)
        for k in range(18):
            a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.45, 0.85)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rnd.uniform(0.05, 0.12),
                                                  location=(math.cos(a) * r, 0.1 + math.sin(a) * r, 0.02))
            c = bpy.context.object; c.scale = (1.3, 1.0, 0.55); c.data.materials.append(dirt)
            t = box(f"tile{k}", (0.22, 0.22, 0.03), (math.cos(a) * (r + 0.1), 0.1 + math.sin(a) * (r + 0.1), 0.05),
                    mat_flat("tileshard", (0.6, 0.45, 0.32), rough=0.5), rot=(rnd.uniform(-30, 30), rnd.uniform(-30, 30), rnd.uniform(0, 90)))
    area("wofill", (0, -2.5, 2.6), (0, 0.8, 0.9), energy=450, size=4, color=(1.0, 0.95, 0.88))
    area("wotop", (0, 0.8, 2.9), (0, 0.8, 0), energy=200, size=2, color=(1.0, 0.95, 0.88))


def tunnel():
    """A dug tunnel along +Y: rough dirt tube, timber frames, hanging lantern."""
    world_color((0.0, 0.0, 0.0), 0.0)
    dirt = mat_tex("tdirt", "coast_sand_01", scale=1.0, tint=(0.45, 0.3, 0.17))
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.15, depth=10, location=(0, 2, 0.95), rotation=(math.radians(90), 0, 0),
                                        end_fill_type="NOTHING")
    t = bpy.context.object; t.data.materials.append(dirt)
    tx = bpy.data.textures.new("tunnelrough", "CLOUDS"); tx.noise_scale = 0.3
    sd = t.modifiers.new("s", "SUBSURF"); sd.levels = 2; sd.render_levels = 2
    dm = t.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 0.18
    bpy.ops.object.shade_smooth()
    lib._cube_uv(t, 1.0) if hasattr(lib, "_cube_uv") else None
    wood = mat_flat("timber", (0.42, 0.28, 0.14), rough=0.8)
    for y in (2.6, 4.4):
        for s in (-1, 1):
            box(f"post{y}{s}", (0.1, 0.1, 1.85), (s * 0.75, y, 0.92), wood)
        box(f"beam{y}", (1.7, 0.12, 0.12), (0, y, 1.82), wood)
    plane("tfloor", (1.4, 10), (0, 2, 0.0), mat_tex("tdirtf", "coast_sand_01", scale=1.0, tint=(0.4, 0.27, 0.15)), uv_scale=0.5)
    l = point("lantern", (0.55, 2.4, 1.6), energy=40, color=(1.0, 0.65, 0.3), radius=0.05, shadow=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0.55, 2.4, 1.6))
    bpy.context.object.data.materials.append(mat_flat("lantglow", (1, 0.8, 0.4), emit=(1.0, 0.7, 0.35), emit_strength=15))
    bpy.context.object.visible_shadow = False


# ---------------------------------------------------------------------------- the bedroom (episode 1's, with a door)
DOOR_Y = -0.9          # the bedroom door is in the left wall (x=-2.6), centred at y=DOOR_Y, opening inward (+X)


def bedroom(window_open=False, door=True):
    ep4.bedroom_night(window_open=window_open, with_dresser=False)
    old = bpy.data.objects.get("blanket")
    if old:
        old.hide_render = True
    if door:
        wl = bpy.data.objects.get("w_left")
        wm = wl.data.materials[0]
        wl.hide_render = True; wl.hide_viewport = True
        y0, y1 = -5.0, 5.0
        # wall with the doorway (0.9 x 2.05)
        box("wl_a", (0.2, (DOOR_Y - 0.45) - y0, 3.0), (-2.6, (y0 + DOOR_Y - 0.45) / 2, 1.5), wm, uv_scale=0.5)
        box("wl_b", (0.2, y1 - (DOOR_Y + 0.45), 3.0), (-2.6, (y1 + DOOR_Y + 0.45) / 2, 1.5), wm, uv_scale=0.5)
        box("wl_c", (0.2, 0.9, 0.95), (-2.6, DOOR_Y, 2.525), wm, uv_scale=0.5)
        dm = mat_flat("doorwood", (0.92, 0.9, 0.86), rough=0.4)
        trim = mat_flat("doortrim", (0.98, 0.98, 0.97), rough=0.3)
        for (sy, sz, cy, cz) in ((0.06, 2.12, DOOR_Y - 0.48, 1.06), (0.06, 2.12, DOOR_Y + 0.48, 1.06), (1.02, 0.06, DOOR_Y, 2.08)):
            box(f"dtrim{cy}{cz}", (0.24, sy, sz), (-2.6, cy, cz), trim)
        # the door: a frame of panels around a cat-flap hole (0.46 w x 0.5 h, bottom at 0.06)
        door = empty("door", (-2.53, DOOR_Y, 0))
        fw, fh, fb = 0.46, 0.5, 0.06
        for (sy, sz, cy, cz) in ((0.9, 2.05 - fb - fh, 0, fb + fh + (2.05 - fb - fh) / 2), ((0.9 - fw) / 2, fh + fb, -(fw / 2 + (0.9 - fw) / 4), (fh + fb) / 2),
                                 ((0.9 - fw) / 2, fh + fb, (fw / 2 + (0.9 - fw) / 4), (fh + fb) / 2), (fw, fb, 0, fb / 2)):
            p = box(f"doorp{cy:.2f}{cz:.2f}", (0.045, sy, sz), (0, cy, cz), dm); p.parent = door
        knob = mat_flat("knobbrass", (0.85, 0.7, 0.3), metal=1.0, rough=0.25)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0.04, 0.33, 1.0)); k = bpy.context.object
        k.data.materials.append(knob); k.parent = door
        lockp = box("lockplate", (0.01, 0.05, 0.1), (0.028, 0.33, 0.9), knob); lockp.parent = door
        key = empty("key", (0.04, 0.33, 0.88)); key.parent = door
        box("keybow", (0.006, 0.035, 0.035), (0.03, 0, 0), knob).parent = key
        box("keyshaft", (0.03, 0.006, 0.008), (0.0, 0, 0), knob).parent = key
        # the cat flap: hinged at its top edge, swings inward
        fh_e = empty("flaphinge", (0.0, 0.0, fb + fh)); fh_e.parent = door
        fl = box("catflap", (0.02, fw - 0.02, fh - 0.02), (0, 0, -fh / 2), mat_flat("flapplastic", (0.85, 0.85, 0.82), rough=0.3), bevel=0.01)
        fl.parent = fh_e
        box("flapframe", (0.05, fw + 0.04, 0.03), (0, 0, 0.01), trim).parent = fh_e
        return door, fh_e, key
    return None, None, None


def in_bed(name="you_night", x=0.0, face_up=True, **k):
    """A character lying on their back in episode 1's bed (head on the pillow, +Y)."""
    ch = load_char(name, (0, 0, 0), **k)
    ch.hold("137_41", 2800)
    ch.rig.rotation_euler = (math.radians(-86), 0, 0)
    ch.rig.location = (x, 0.08, 0.7)
    return ch


def side_lying(name, x, facing_x, tag=None, z=0.74):
    """A character lying on their side in the bed, head on the pillow (+Y), facing -X (facing_x=-1) or +X (+1)."""
    ch = load_char(name, (0, 0, 0), tag=tag or name)
    pose(ch, LIE_SIDE)
    ch.rig.rotation_mode = "XYZ"
    ch.rig.rotation_euler = (math.radians(-90), math.radians(90 * facing_x), 0)
    ch.rig.location = (x, 0.12, z)
    return ch


def duvet(y0=-0.2, y1=1.05, z=0.86, w=1.75, color=(0.28, 0.36, 0.78)):
    """A thick duvet over the bed from the feet to the chest (hides whatever legs are tangled underneath)."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=30, size=1, location=(0, (y0 + y1) / 2, z))
    d = bpy.context.object; d.name = "duvet7"; d.scale = (w, y1 - y0, 1); bpy.ops.object.transform_apply(scale=True)
    for v in d.data.vertices:                                  # drape over the mattress edges
        ex = max(0.0, abs(v.co.x) - 0.72)
        v.co.z -= 2.2 * ex * ex * 4
    tx = bpy.data.textures.new("duv7", "CLOUDS"); tx.noise_scale = 0.18
    dm = d.modifiers.new("wr", "DISPLACE"); dm.texture = tx; dm.strength = 0.05
    d.modifiers.new("t", "SOLIDIFY").thickness = 0.04
    sd = d.modifiers.new("s", "SUBSURF"); sd.levels = 1; sd.render_levels = 1
    bpy.ops.object.shade_smooth()
    d.data.materials.append(mat_tex("duv7m", "denim_fabric", scale=1.0, tint=tuple(c * 1.3 for c in color), normal_strength=0.3))
    lib._cube_uv(d, 1.5)
    return d


class _Group:
    def __init__(self, chars):
        self.meshes = [o for c in chars for o in c.meshes]


def cover(chars, to_y=1.35):
    """Drape a duvet over everyone in the bed (from the foot up to to_y), shaped from their bodies (episode 4's)."""
    return ep4.blanket_over(_Group(chars), (-0.9, 0.9), (-0.16, to_y + 0.15), 0.59, fold_y=to_y, color=(0.12, 0.18, 0.45),
                            half_w=0.815, foot_y=-0.07)


def garden_night():
    """Backyard at night for the hammock: episode 4's house (night), grass, two posts and the hammock between them."""
    ep4.house_exterior(night=True, chimney=False)
    wood = mat_flat("hpost", (0.35, 0.22, 0.12), rough=0.7)
    for x in (-2.0, 2.0):
        cylinder(f"hpost{x}", 0.08, 2.0, (x, -1.0, 1.0), wood, verts=16)
    import bmesh
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=14, size=1, location=(0, -1.0, 0))
    h = bpy.context.object; h.name = "hammock"; h.scale = (3.4, 1.2, 1); bpy.ops.object.transform_apply(scale=True)
    for v in h.data.vertices:
        u = v.co.x / 1.7
        sag = 0.65 * max(0.0, 1 - u * u)
        wy = 1 - (v.co.y / 0.6) ** 2
        v.co.z = 1.45 - sag - 0.12 * max(wy, 0) * max(0.0, 1 - u * u)
        v.co.y *= (0.25 + 0.75 * max(0.0, 1 - u * u) ** 0.5)
    h.location = (0, -1.0, 0)
    h.modifiers.new("t", "SOLIDIFY").thickness = 0.015
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new("hammockstripe"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.85
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Y"; wv.inputs["Scale"].default_value = 2.5
    rp = nt.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.interpolation = "CONSTANT"
    rp.color_ramp.elements[0].color = (0.9, 0.2, 0.15, 1); rp.color_ramp.elements[1].position = 0.5
    rp.color_ramp.elements[1].color = (0.95, 0.9, 0.75, 1)
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"]); nt.links.new(wv.outputs["Fac"], rp.inputs[0])
    nt.links.new(rp.outputs[0], b.inputs["Base Color"])
    h.data.materials.append(m)
    rope = mat_flat("hrope", (0.75, 0.65, 0.45), rough=0.9)
    for s in (-1, 1):
        for dy in (-0.15, 0.0, 0.15):
            ep6.strut(f"hrope{s}{dy}", (s * 1.7, -1.0 + dy * 0.3, 1.45), (s * 1.98, -1.0, 1.75), 0.008, rope)
    return h


# ============================================================================ SHOTS: the prison
@shot
def sh01():
    """DALE is in prison FOR FIVE YEARS, - cell 7: Dale in an orange jumpsuit grips the bars, sighing. Push in."""
    n = frames_of("sh01")
    prison_cells()
    dale = jumpsuit_dale((1.2, 0.35, 0), 0)
    dale.clip("137_41", **src(n, 4150))
    for side, dx in (("Left", 0.2), ("Right", -0.2)):
        hand_ik(dale, side, empty(f"bar{side}", (1.2 + dx, 0.04, 1.35)))
    face(dale, 1, SAD); blink(dale, [30])
    cam = Cam(lens=30, loc=(1.6, -2.2, 1.5), target=(1.2, 0.3, 1.45))
    cam.key(1, loc=(1.6, -2.2, 1.5)); cam.key(n, loc=(1.4, -1.3, 1.52))
    return n


@shot
def sh02():
    """and LARRY from accounting is not handling it well. - outside the prison wall: Larry sobbing, FREE DALE sign."""
    n = frames_of("sh02")
    prison_exterior()
    larry = load_char("larry", (2.8, 9.5, 0), rot_z=-10, tag="larry")
    larry.clip("137_41", **src(n, 600))
    sg = empty("freedale")
    cylinder("signstick", 0.015, 1.1, (0, 0, -0.55), mat_flat("stick", (0.5, 0.35, 0.2))).parent = sg
    decal("signcard", f"{D7}/sign_freedale.png", 0.7, (0, -0.01, 0.15), rot=(90, 0, 0)).parent = sg
    hh = larry.world("Head", frame=1)
    sg.location = (hh.x + 0.25, hh.y - 0.25, hh.z + 0.25)
    hand_ik(larry, "Right", empty("signgrip", (hh.x + 0.25, hh.y - 0.24, hh.z - 0.4)))
    for f in range(1, n + 1, 6):                                  # sobbing shoulders
        sg.rotation_euler = (0, math.radians(3 * math.sin(f)), 0); sg.keyframe_insert("rotation_euler", frame=f)
    face(larry, 1, CRY)
    for f in range(1, n + 1, 8):
        larry.expr(f, {"jawOpen": 0.15 + 0.15 * ((f // 8) % 2)})
    cam = Cam(lens=30, loc=(2.2, 7.0, 1.5), target=(2.75, 9.5, 1.55), clip_end=3000)
    cam.key(1, loc=(2.2, 7.0, 1.5)); cam.key(n, loc=(2.4, 7.7, 1.5))
    look_at(larry, cam.cam, 0.4)
    return n


@shot
def sh03():
    """He tries to break him out. - Larry, determined, creeps along the wall at night-ish dusk with a cake box."""
    n = frames_of("sh03")
    prison_exterior()
    larry = load_char("larry", (-4.5, 10.6, 0), rot_z=90, tag="larry")           # walks +X toward the gate
    larry.clip("07_01", **src(n, 60, speed=0.6, in_place=False))
    ck = cake("sneakcake", with_file=False)
    larry.bake_follow(ck, "Hips", n, offset=(0.38, 0.0, 0.18))
    for side, dy in (("Left", 0.14), ("Right", -0.14)):
        g = empty(f"cakegrip{side}", (0, 0, 0)); g.parent = ck; g.location = (0.0, dy, 0.05)
        hand_ik(larry, side, g)
    face(larry, 1, DETERMINED)
    cam = Cam(lens=30, loc=(-2.6, 7.4, 1.0), target=(-4.3, 10.6, 1.1), clip_end=3000)
    larry.bake_follow(cam.tgt, "Hips", n, offset=(0.3, 0, 0.15))
    cam.key(1, loc=(-2.6, 7.4, 1.0)); cam.key(n, loc=(-1.6, 7.6, 1.0))
    return n


def visit(n, sd=False):
    visiting_room()
    larry = load_char("larry", (0, -0.72, 0), rot_z=180, tag="larry")          # faces +Y, across the table
    ep2.sit(larry, 0.47)
    dale = jumpsuit_dale((0, 0.72, 0), 0)                                      # faces -Y
    ep2.sit(dale, 0.47)
    for y, rz in ((-0.72, 180), (0.72, 0)):
        ep2.chair((0, y, 0), rot_z=rz, seat_h=0.47, color=(0.2, 0.25, 0.32))
    return larry, dale


@shot
def sh04():
    """A file baked in a cake? - the visiting table: Larry slides a pink cake across to Dale; a file pokes out of it."""
    n = frames_of("sh04")
    larry, dale = visit(n)
    ck = cake("visitcake")
    key_loc(ck, 1, (0, -0.25, 0.79)); key_loc(ck, int(n * 0.55), (0, 0.15, 0.79))
    for side, dy in (("Left", 0.17), ("Right", -0.17)):
        g = empty(f"slide{side}", (0, 0, 0)); g.parent = ck; g.location = (dy, -0.1, 0.1)
        hand_ik(larry, side, g)
    face(larry, 1, WINK); face(dale, 1, TADA)
    look_at(larry, dale.rig, 0.0)
    cam = Cam(lens=30, loc=(1.15, -0.55, 1.2), target=(0.0, 0.1, 0.95))
    cam.key(1, loc=(1.15, -0.55, 1.2)); cam.key(n, loc=(0.75, -0.2, 1.08), target=(0.0, 0.12, 0.88))
    return n


@shot
def sh05():
    """Dale eats THE FILE. - Dale, cake crumbs everywhere, chomping; the file sticking out of his mouth."""
    n = frames_of("sh05")
    larry, dale = visit(n)
    ck = cake("eatencake", with_file=False); ck.location = (0, 0.32, 0.79); ck.scale = (1, 1, 0.45)
    f = file_tool("mouthfile")
    on_bone(dale, f, "Head", (0.01, 0.035, 0.085), rot=(90, 0, 15))          # sticking straight out of his mouth
    for k in range(1, n + 1, 3):
        dale.expr(k, {"jawOpen": 0.05 + 0.18 * ((k // 3) % 2), "cheekPuff": 0.6, "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
                      "mouthSmileLeft": 0.3, "mouthSmileRight": 0.3})
    face(larry, 1, SHOCK)
    hh = dale.world("Head", frame=1)
    cam = Cam(lens=34, loc=(hh.x - 0.25, hh.y - 1.2, hh.z + 0.05), target=(hh.x, hh.y, hh.z - 0.05))
    cam.key(1, loc=(hh.x - 0.25, hh.y - 1.2, hh.z + 0.05)); cam.key(n, loc=(hh.x - 0.2, hh.y - 1.0, hh.z + 0.02))
    look_at(dale, cam.cam, 0.6)
    return n


@shot
def sh06():
    """A secret tunnel? - underground: Larry in a miner's helmet, digging toward us by headlamp."""
    n = frames_of("sh06")
    tunnel()
    larry = load_char("larry", (0, 1.2, 0), rot_z=0, tag="larry")           # digging toward us
    pose_seq(larry, [(f, {"lowerback": {"rx": 22 + 10 * ((f // 6) % 2)}, "upperback": {"rx": 10}}) for f in range(1, n + 1, 6)], n)
    miner_helmet(larry)
    sv = shovel(); sv.rotation_euler = (math.radians(-55), 0, 0)
    for f in range(1, n + 1, 6):
        key_loc(sv, f, (0.05, 0.55 - 0.2 * ((f // 6) % 2), 0.35))
    for side, dz in (("Right", 0.55), ("Left", 0.25)):
        g = empty(f"shovelgrip{side}", (0, 0, 0)); g.parent = sv; g.location = (0, 0, dz + 0.3)
        hand_ik(larry, side, g)
    face(larry, 1, DETERMINED)
    area("tfill", (0.4, -0.5, 1.7), (0.0, 1.2, 1.3), energy=60, size=0.8, color=(1.0, 0.75, 0.45))
    cam = Cam(lens=24, loc=(0.3, -0.7, 1.2), target=(0.0, 1.2, 1.1))
    cam.key(1, loc=(0.3, -0.7, 1.2)); cam.key(n, loc=(0.25, -0.4, 1.2))
    return n


@shot
def sh07():
    """It comes up in THE WARDEN'S OFFICE. - the floor bursts: Larry pops up in front of the warden's desk."""
    n = frames_of("sh07")
    warden_office(hole=True)
    warden = load_char("butcher", (0, 1.95, 0), rot_z=0, tag="warden")
    ep2.sit(warden, 0.5)
    ep4.plain_cloth(warden, "worksuit", (0.08, 0.12, 0.28))
    on_bone(warden, ep2.cap(), "Head", (0, 0.125, 0.0))
    face(warden, 1, DEADPAN); face(warden, 14, SHOCK)
    larry = load_char("larry", (0, 0.1, 0), rot_z=0, tag="larry")
    larry.hold("137_41", 4200)
    miner_helmet(larry, light=False)
    for f, z in ((1, -1.6), (6, -1.6), (12, -0.55), (16, -0.62), (n, -0.6)):
        key_loc(larry.rig, f, (0, 0.1, z))
    for side, dx in (("Left", 0.35), ("Right", -0.35)):
        hand_ik(larry, side, empty(f"rim{side}", (dx, 0.0, 0.05)))
    face(larry, 1, TADA)
    ep4.soot_cloud((0, 0.1, 0.1), n, start=6, count=14, color=(0.45, 0.32, 0.18), seed=5)
    cam = Cam(lens=26, loc=(-1.6, -2.4, 1.3), target=(0.0, 1.0, 0.8))
    cam.key(1, loc=(-1.6, -2.4, 1.3)); cam.key(n, loc=(-1.4, -2.1, 1.25))
    cam.shake(6, 12, amp=0.02, freq=0.8)
    look_at(larry, warden.rig, 0.0)
    return n


@shot
def sh08():
    """A fake guard uniform? - the cell corridor: Larry in a guard's cap swaggers up, jangling keys, saluting."""
    n = frames_of("sh08")
    prison_cells()
    larry = load_char("larry", (4.6, -1.2, 0), rot_z=-90, tag="larry")       # walks -X to Dale's cell
    larry.clip("07_01", **src(n, 60, speed=0.7, in_place=False))
    on_bone(larry, ep2.cap(), "Head", (0, 0.105, 0.0))
    ep6.wear_shades(larry)
    hh = larry.world("Head", frame=1)
    dale = jumpsuit_dale((1.2, 0.4, 0), 0)
    dale.clip("137_41", **src(n, 4150))
    face(dale, 1, TADA); face(larry, 1, SMUG)
    cam = Cam(lens=28, loc=(0.6, -1.9, 1.45), target=(4.2, -1.1, 1.35))
    larry.bake_follow(cam.tgt, "Head", n, offset=(0, 0, -0.1))
    cam.key(1, loc=(0.6, -1.9, 1.45)); cam.key(n, loc=(0.9, -1.9, 1.45))
    return n


@shot
def sh09():
    """Larry gets locked up FOR THREE HOURS. - Larry behind the bars of cell 8 (three tally marks); Dale waves from 7."""
    n = frames_of("sh09")
    prison_cells()
    larry = load_char("larry", (3.4, 0.4, 0), rot_z=0, tag="larry")
    larry.clip("137_41", **src(n, 600))
    on_bone(larry, ep2.cap(), "Head", (0, 0.105, 0.0))
    for side, dx in (("Left", 0.16), ("Right", -0.16)):
        hand_ik(larry, side, empty(f"lbar{side}", (3.4 + dx, 0.04, 1.3)))
    face(larry, 1, CRY)
    dale = jumpsuit_dale((1.7, 0.35, 0), 20)
    dale.clip("137_41", **src(n, 4150))
    t = empty("dwave", (0, 0, 0))
    for f in range(1, n + 1, 5):
        key_loc(t, f, (1.75 + 0.07 * ((f // 5) % 2), 0.1, 1.8))
    hand_ik(dale, "Right", t)
    face(dale, 1, TADA)
    cam = Cam(lens=24, loc=(2.5, -2.6, 1.45), target=(2.5, 0.3, 1.3))
    cam.key(1, loc=(2.5, -2.6, 1.45)); cam.key(n, loc=(2.6, -2.2, 1.42))
    return n


# ============================================================================ SHOTS: the bedroom
@shot
def sh10():
    """So that night, Larry climbs into your bed - you asleep; Larry crawls up the bed from the foot."""
    n = frames_of("sh10")
    bedroom()
    you = in_bed()
    face(you, 1, SLEEP)
    cover([you])
    larry = load_char("larry", (0.42, -0.15, 0), rot_z=180, tag="larry")
    pose(larry, ALL_FOURS)
    bpy.context.scene.frame_set(1)
    ep2.settle(larry, min(("LeftLeg", "RightLeg"), key=lambda b: larry.world(b).z), 0.66)
    z = larry.rig.location.z
    car = empty("crawl", (0, 0, 0))
    for side in ("Left", "Right"):
        sh = larry.world(f"{side}Arm")
        p = empty(f"paw{side}", (0, 0, 0)); p.parent = car; p.location = (sh.x, sh.y, 0.66)
        hand_ik(larry, side, p)
    for f, y in ((1, 0.0), (n, 0.75)):
        key_loc(car, f, (0, y, 0)); key_loc(larry.rig, f, (0.42, -0.15 + y, z))
    face(larry, 1, CREEPY_ENJOY)
    cam = Cam(lens=26, loc=(1.6, -2.4, 1.6), target=(0.1, 0.6, 0.8))
    cam.key(1, loc=(1.6, -2.4, 1.6)); cam.key(n, loc=(1.4, -2.0, 1.55))
    return n


def spoon(n, sad=False):
    """Top-down: you on your back; Larry on his side at your left (+X), arm over your chest, head on your shoulder."""
    bedroom()
    you = in_bed()
    larry = side_lying("larry", 0.42, -1, tag="larry")
    hand_ik(larry, "Left", empty("overchest", (-0.12, 1.3, 0.92)))           # his top arm, over your chest
    cover([you, larry], to_y=1.1)
    return you, larry


@shot
def sh11():
    """and SPOONS YOU. - from above: Larry wrapped round you, cheek on your shoulder; your eyes snap open."""
    n = frames_of("sh11")
    you, larry = spoon(n)
    face(you, 1, SLEEP); face(you, 8, SHOCK)
    face(larry, 1, CUDDLE)
    cam = Cam(lens=30, loc=(0.2, 0.75, 2.45), target=(0.2, 1.6, 0.8))
    cam.key(1, loc=(0.2, 0.7, 2.55)); cam.key(n, loc=(0.2, 0.9, 2.3))
    return n


@shot
def sh12():
    """Because without Dale, he has no one to cuddle. - close: Larry's sad face on your shoulder; a framed photo of Dale."""
    n = frames_of("sh12")
    you, larry = spoon(n)
    face(you, 1, DEADPAN); face(larry, 1, CRY)
    ph = photo_frame(); ph.location = (-1.25, 1.95, 0.75); ph.rotation_euler = (math.radians(-8), 0, math.radians(25))
    hh = larry.world("Head", frame=1)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.008, location=(hh.x - 0.03, hh.y - 0.05, hh.z + 0.06))
    tear = bpy.context.object; tear.data.materials.append(mat_flat("tear", (0.7, 0.85, 1.0), rough=0.05, metal=0.2))
    key_loc(tear, 1, tuple(tear.location)); key_loc(tear, n, (hh.x - 0.03, hh.y - 0.13, hh.z + 0.0))
    cam = Cam(lens=32, loc=(hh.x - 0.1, hh.y - 0.45, hh.z + 1.0), target=(hh.x - 0.22, hh.y + 0.05, hh.z - 0.05))
    cam.key(1, loc=(hh.x - 0.1, hh.y - 0.45, hh.z + 1.0)); cam.key(n, loc=(hh.x - 0.12, hh.y - 0.38, hh.z + 0.85))
    return n


def at_door(n, you_clip=4200):
    door, flap, key = bedroom()
    you = load_char("you_night", (-2.15, DOOR_Y + 0.25, 0), rot_z=-90 + 0)
    return door, flap, key, you


@shot
def sh13():
    """So you lock your bedroom door. - you turn the key in the lock, determined. Click."""
    n = frames_of("sh13")
    door, flap, key, you = at_door(n)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, DETERMINED)
    kw = key.matrix_world.translation if False else None
    for f, r in ((1, 0), (int(n * 0.5), 0), (int(n * 0.65), 90), (n, 90)):
        key_rot(key, f, (r, 0, 0))
    hand_ik(you, "Right", empty("keyhand", (-2.45, DOOR_Y + 0.33, 0.9)))
    look_at(you, (-2.5, DOOR_Y + 0.33, 0.9), 0.8)
    cam = Cam(lens=28, loc=(-1.75, DOOR_Y + 1.35, 1.45), target=(-2.35, DOOR_Y + 0.25, 1.1))     # in front: face + key
    cam.key(1, loc=(-1.75, DOOR_Y + 1.35, 1.45)); cam.key(n, loc=(-1.85, DOOR_Y + 1.15, 1.42))
    return n


@shot
def sh14():
    """GENIUS! - you turn from the locked door, dust off your hands, smug."""
    n = frames_of("sh14")
    door, flap, key, you = at_door(n)
    key.rotation_euler = (math.radians(90), 0, 0)
    you.rig.rotation_euler = (0, 0, math.radians(90))
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    cam = Cam(lens=26, loc=(-0.9, DOOR_Y + 0.2, 1.1), target=(-2.15, DOOR_Y + 0.25, 1.4))
    cam.key(1, loc=(-0.9, DOOR_Y + 0.2, 1.1)); cam.key(n, loc=(-1.05, DOOR_Y + 0.2, 1.15))
    look_at(you, cam.cam, 0.5)
    return n


@shot
def sh15():
    """But Larry comes in through THE CAT FLAP. - low at the door: the little flap swings up; Larry's head squeezes in."""
    n = frames_of("sh15")
    door, flap, key = bedroom()
    key.rotation_euler = (math.radians(90), 0, 0)
    larry = load_char("larry", (-3.4, DOOR_Y, 0), rot_z=90, tag="larry")       # outside, facing into the room
    pose(larry, dict(ALL_FOURS, lowerneck={"rx": -45}, upperneck={"rx": -30}))
    bpy.context.scene.frame_set(1)
    ep2.settle(larry, "Head", 0.33)
    z = larry.rig.location.z
    hd = larry.world("Head", frame=1)
    off = hd.x - larry.rig.location.x
    for f, hx in ((1, -2.9), (8, -2.9), (18, -2.42), (n, -2.36)):
        key_loc(larry.rig, f, (hx - off, DOOR_Y, z))
    key_rot(flap, 1, (0, 0, 0)); key_rot(flap, 9, (0, 0, 0)); key_rot(flap, 16, (0, -70, 0)); key_rot(flap, n, (0, -65, 0))
    face(larry, 1, GRIN)
    cam = Cam(lens=24, loc=(-1.55, DOOR_Y - 0.55, 0.35), target=(-2.5, DOOR_Y, 0.32))
    cam.key(1, loc=(-1.55, DOOR_Y - 0.55, 0.35)); cam.key(n, loc=(-1.75, DOOR_Y - 0.45, 0.33))
    look_at(larry, cam.cam, 0.7)
    return n


def fur_arm(bear, chest, f0=None, f1=None):
    """A big furry teddy arm from the bear's shoulder: raised, then (f0..f1) it swings down across your chest."""
    from mathutils import Quaternion
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    S = bear.world("LeftArm")
    C = Vector(chest)
    L = (C - S).length
    piv = empty("furarm", tuple(S)); piv.rotation_mode = "QUATERNION"
    arm = cylinder("furarm_m", 0.075, L, (0, 0, L / 2), fur_mat(), verts=20); arm.parent = piv
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.095, location=(0, 0, L)); paw = bpy.context.object
    paw.scale = (1.0, 1.0, 0.8); paw.data.materials.append(fur_mat("fur_light", (1.35, 1.25, 1.1))); paw.parent = piv
    bpy.ops.object.shade_smooth()
    hug = Vector((0, 0, 1)).rotation_difference((C - S).normalized())
    up = Vector((0, 0, 1)).rotation_difference(Vector((0.05, -1.0, 0.25)).normalized())     # resting along his side
    for f, q in (((1, up), (f0, up), (f1, hug)) if f0 else ((1, hug),)):
        piv.rotation_quaternion = q; piv.keyframe_insert("rotation_quaternion", frame=f)
    return piv


def bear_in_bed(n, unmask=None):
    """Larry in the teddy suit lying on his side at your left (+X), facing you; you on your back."""
    bedroom()
    you = in_bed()
    bear = side_lying("larry", 0.42, -1, tag="larry")
    hm = bear_suit(bear)
    cover([you, bear], to_y=0.95)
    return you, bear, hm


@shot
def sh16():
    """So you put a giant teddy bear in your bed. - you, proud, pat the huge bear tucked in beside your pillow."""
    n = frames_of("sh16")
    bedroom()
    bear = side_lying("larry", 0.2, -1, tag="larry")
    hm = bear_suit(bear)
    cover([bear], to_y=1.2)
    you = load_char("you_night", (-1.15, 0.9, 0), rot_z=-90)
    you.clip("137_41", **src(n, 4200))
    hand_ik(you, "Right", empty("pat", (-0.45, 1.05, 0.95)))
    face(you, 1, SMILE)
    cam = Cam(lens=26, loc=(0.9, -1.6, 1.7), target=(-0.3, 1.1, 0.9))
    cam.key(1, loc=(0.9, -1.6, 1.7)); cam.key(n, loc=(0.75, -1.3, 1.6))
    return n


@shot
def sh17():
    """CLEVER! - from above: you snuggle into the bear, blissful."""
    n = frames_of("sh17")
    you, bear, hm = bear_in_bed(n)
    face(you, 1, CUDDLE)
    hand_ik(you, "Left", empty("hugbear", (0.32, 1.25, 0.88)))
    cam = Cam(lens=30, loc=(0.2, 0.7, 3.0), target=(0.2, 1.15, 0.7))
    cam.key(1, loc=(0.2, 0.7, 3.0)); cam.key(n, loc=(0.2, 0.8, 2.8))
    return n


@shot
def sh18():
    """But when you hug the bear, IT HUGS YOU BACK. - the bear's arm wraps round you; your eyes fly open."""
    n = frames_of("sh18")
    you, bear, hm = bear_in_bed(n)
    hand_ik(you, "Left", empty("hugbear", (0.32, 1.25, 0.88)))
    fur_arm(bear, (-0.12, 1.32, 0.95), at("sh18", 34.25), at("sh18", 34.85))
    face(you, 1, CUDDLE); face(you, at("sh18", 34.8), SHOCK)
    hh = you.world("Head", frame=1)
    cam = Cam(lens=30, loc=(hh.x - 0.9, hh.y - 0.9, hh.z + 0.8), target=(hh.x + 0.2, hh.y - 0.05, hh.z))
    cam.key(1, loc=(hh.x - 0.9, hh.y - 0.9, hh.z + 0.8)); cam.key(n, loc=(hh.x - 0.7, hh.y - 0.7, hh.z + 0.7))
    return n


@shot
def sh19():
    """It's Larry. IN A BEAR SUIT. - the bear head tips back: Larry's grinning face inside the suit. Wink."""
    n = frames_of("sh19")
    you, bear, hm = bear_in_bed(n)
    fur_arm(bear, (-0.12, 1.32, 0.95))
    off = at("sh19", 35.85)
    p0 = tuple(hm.location); r0 = tuple(math.degrees(a) for a in hm.rotation_euler)
    key_loc(hm, 1, p0); key_loc(hm, off, p0); key_loc(hm, off + 6, (p0[0], p0[1] + 0.12, p0[2] - 0.16))
    key_rot(hm, 1, r0); key_rot(hm, off, r0); key_rot(hm, off + 6, (r0[0] - 75, r0[1], r0[2]))
    face(you, 1, SHOCK)
    face(bear, 1, GRIN); face(bear, n - 8, WINK)
    hh = bear.world("Head", frame=1)
    cam = Cam(lens=30, loc=(hh.x - 0.62, hh.y + 0.08, hh.z + 0.3), target=(hh.x - 0.05, hh.y + 0.1, hh.z + 0.02))   # your POV
    cam.key(1, loc=(hh.x - 0.62, hh.y + 0.08, hh.z + 0.3)); cam.key(n, loc=(hh.x - 0.55, hh.y + 0.08, hh.z + 0.28))
    look_at(bear, cam.cam, 0.5)
    return n


# ============================================================================ SHOTS: the hammock
HY = -1.0


def hammock_you(lean=0.0, x=-0.4):
    you = load_char("you_night", (0, 0, 0))
    you.hold("137_41", 2800)
    you.rig.rotation_mode = "XYZ"
    you.rig.rotation_euler = (math.radians(-80), 0, math.radians(-90))       # lying along the hammock, head to +X
    you.rig.location = (-0.85 + x * 0.0, HY, 0.82)
    return you


@shot
def sh20():
    """So you sleep in a hammock. - the moonlit garden: you settle into a striped hammock between two posts."""
    n = frames_of("sh20")
    garden_night()
    you = hammock_you()
    z0 = you.rig.location.z
    key_loc(you.rig, 1, (you.rig.location.x, HY, z0 + 0.35)); key_loc(you.rig, 14, (you.rig.location.x, HY, z0))
    face(you, 1, SMILE)
    cam = Cam(lens=26, loc=(1.8, -5.0, 1.7), target=(0.0, HY, 1.1))
    cam.key(1, loc=(1.8, -5.0, 1.7)); cam.key(n, loc=(1.3, -4.3, 1.6))
    return n


@shot
def sh21():
    """PERFECT! - closer: you smile at the stars, swaying gently."""
    n = frames_of("sh21")
    garden_night()
    you = hammock_you()
    face(you, 1, dict(SMILE, eyeBlinkLeft=0.4, eyeBlinkRight=0.4))
    hh = you.world("Head", frame=1)
    cam = Cam(lens=34, loc=(hh.x + 0.4, hh.y - 1.3, hh.z + 0.6), target=(hh.x + 0.25, hh.y, hh.z))
    cam.key(1, loc=(hh.x + 0.4, hh.y - 1.3, hh.z + 0.6)); cam.key(n, loc=(hh.x + 0.35, hh.y - 1.15, hh.z + 0.55))
    return n


@shot
def sh22():
    """But Larry is already in it, holding a nightlight. - pull back: Larry squeezed in beside you, lit from below."""
    n = frames_of("sh22")
    garden_night()
    you = hammock_you(x=-0.35)
    larry = load_char("larry", (0, 0, 0), tag="larry")
    larry.hold("137_41", 2800)
    larry.rig.rotation_mode = "XYZ"
    larry.rig.rotation_euler = (math.radians(-80), math.radians(12), math.radians(-90))
    larry.rig.location = (-0.8, HY + 0.24, 0.98)
    nl = nightlight()
    hh = larry.world("Head", frame=1)
    nl.location = (hh.x + 0.1, hh.y - 0.22, hh.z - 0.12)
    hand_ik(larry, "Right", empty("nlgrip", (hh.x + 0.1, hh.y - 0.22, hh.z - 0.14)))
    face(you, 1, SMILE); face(you, 10, SHOCK)
    face(larry, 1, GRIN)
    cam = Cam(lens=34, loc=(hh.x + 0.1, hh.y - 1.3, hh.z + 0.5), target=(hh.x - 0.1, hh.y, hh.z))
    cam.key(1, loc=(hh.x - 0.2, hh.y - 1.1, hh.z + 0.5), target=(you.world("Head", frame=1).x + 0.2, HY, hh.z))
    cam.key(14, target=(hh.x - 0.1, hh.y - 0.05, hh.z))
    cam.key(n, loc=(hh.x + 0.15, hh.y - 1.5, hh.z + 0.55), target=(hh.x - 0.15, hh.y - 0.05, hh.z))
    look_at(larry, cam.cam, 0.7)
    return n


# ============================================================================ SHOTS: release and the group hug
def warden_char(loc, rot_z):
    w = load_char("butcher", loc, rot_z=rot_z, tag="warden")
    ep4.plain_cloth(w, "worksuit", (0.08, 0.12, 0.28))
    on_bone(w, ep2.cap(), "Head", (0, 0.125, 0.0))
    return w


@shot
def sh23():
    """So you go to the prison and BEG THEM TO LET DALE OUT. - at the gate: you on your knees before the warden."""
    n = frames_of("sh23")
    prison_exterior()
    w = warden_char((0.4, 10.6, 0), 0)
    w.clip("137_41", **src(n, 4300))
    face(w, 1, STERN)
    you = load_char("you_casual", (0.3, 9.6, 0), rot_z=180)
    ep3.kneel(you)
    hh = you.world("Head", frame=1)
    t = empty("beg", (0, 0, 0))
    for f in range(1, n + 1, 6):
        key_loc(t, f, (hh.x, hh.y + 0.25, hh.z - 0.25 + 0.05 * ((f // 6) % 2)))
    for side in ("Left", "Right"):
        hand_ik(you, side, t)
    face(you, 1, CRY)
    look_head(you, w, 0.8)
    cam = Cam(lens=26, loc=(2.4, 9.9, 1.2), target=(0.3, 10.1, 1.15), clip_end=3000)      # side on: you and the warden
    cam.key(1, loc=(2.4, 9.9, 1.2)); cam.key(n, loc=(2.1, 9.95, 1.15))
    return n


@shot
def sh24():
    """MUCH BETTER! - the gate swings open: Dale strides out, arms raised. Free."""
    n = frames_of("sh24")
    hinges = prison_exterior()
    for h, s in zip(hinges, (-1, 1)):
        key_rot(h, 1, (0, 0, 0)); key_rot(h, 12, (0, 0, s * 80))
    dale = jumpsuit_dale((0, 12.6, 0), 0)
    dale.clip("07_01", **src(n, 60, speed=0.9, in_place=False))
    for side, dx in (("Left", 0.4), ("Right", -0.4)):
        t = empty(f"free{side}", (0, 0, 0))
        dale.bake_follow(t, "Head", n, offset=(dx, -0.05, 0.4))
        hand_ik(dale, side, t)
    face(dale, 1, TADA)
    cam = Cam(lens=24, loc=(1.2, 6.0, 1.3), target=(0.0, 11.5, 1.6), clip_end=3000)
    cam.key(1, loc=(1.2, 6.0, 1.3)); cam.key(n, loc=(1.0, 6.6, 1.3))
    return n


@shot
def sh25():
    """Now Larry has his best friend back. - Larry and Dale in a big spinning hug outside the gate."""
    n = frames_of("sh25")
    prison_exterior()
    piv = empty("hugpivot", (0, 9.5, 0))
    larry = load_char("larry", (0, 9.5 - 0.16, 0), rot_z=180, tag="larry")     # facing each other, chest to chest
    dale = jumpsuit_dale((0, 9.5 + 0.17, 0), 0)
    larry.hold("137_41", 4200); dale.hold("137_41", 4200)
    for ch in (larry, dale):
        ch.rig.parent = piv
    larry.rig.location = (0, -0.16, 0); dale.rig.location = (0, 0.17, 0)
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    for a, b in ((larry, dale), (dale, larry)):
        bk = b.world("Spine" if b is dale else "Spine1")
        for side, dx in (("Left", 0.18), ("Right", -0.18)):
            g = empty(f"hug{a.name}{side}", (0, 0, 0)); g.parent = piv
            g.location = (piv.matrix_world.inverted() @ Vector((bk.x + dx, bk.y + (0.12 if b is dale else -0.12), bk.z + 0.1)))
            hand_ik(a, side, g)
    key_rot(piv, 1, (0, 0, 0)); key_rot(piv, n, (0, 0, 300))
    face(larry, 1, CUDDLE); face(dale, 1, CUDDLE)
    cam = Cam(lens=28, loc=(2.2, 6.6, 1.6), target=(0.0, 9.5, 1.25), clip_end=3000)
    cam.key(1, loc=(2.2, 6.6, 1.6)); cam.key(n, loc=(1.8, 7.1, 1.5))
    return n


@shot
def sh26():
    """Peace at last. - you asleep alone in bed, moonlight, a little smile."""
    n = frames_of("sh26")
    bedroom()
    you = in_bed()
    cover([you])
    face(you, 1, dict(SLEEP, mouthSmileLeft=0.5, mouthSmileRight=0.5))
    cam = Cam(lens=30, loc=(0.9, -0.1, 2.25), target=(0.0, 1.55, 0.75))
    cam.key(1, loc=(0.9, -0.1, 2.25)); cam.key(n, loc=(0.7, 0.2, 2.1))
    return n


def trio():
    """You on your back in the middle; Larry on his side at your left (+X), Dale at your right (-X), both facing you,
    arms over you. Returns you, larry, dale."""
    bedroom()
    you = in_bed()
    larry = side_lying("larry", 0.36, -1, tag="larry")
    dale = load_char("dale_jail", (0, 0, 0), tag="dale")
    pose(dale, LIE_SIDE)
    dale.rig.rotation_mode = "XYZ"
    dale.rig.rotation_euler = (math.radians(-90), math.radians(90), 0)       # on his side, facing you (+X)
    dale.rig.location = (-0.37, 0.02, 0.74)
    hand_ik(larry, "Left", empty("larryarm", (-0.12, 1.3, 0.88)))
    hand_ik(dale, "Right", empty("dalearm", (0.12, 1.18, 0.88)))
    cover([you, larry])
    return you, larry, dale


@shot
def sh27():
    """But that night, you wake up SQUEEZED IN THE MIDDLE. - from above: your eyes snap open between them."""
    n = frames_of("sh27")
    you, larry, dale = trio()
    face(you, 1, SLEEP); face(you, at("sh27", 52.3), SHOCK)
    face(larry, 1, CUDDLE); face(dale, 1, CUDDLE)
    cam = Cam(lens=26, loc=(0.0, 0.9, 2.0), target=(0.0, 1.6, 0.75))
    cam.key(1, loc=(0.0, 1.0, 1.85)); cam.key(n, loc=(0.0, 0.5, 2.6))
    return n


@shot
def sh28():
    """LARRY on your left. - close: Larry's cheek squashed on your shoulder, grinning up at you."""
    n = frames_of("sh28")
    closeup()
    you, larry, dale = trio()
    face(you, 1, SHOCK); face(larry, 1, GRIN); face(dale, 1, CUDDLE)
    hh = larry.world("Head", frame=1)
    cam = Cam(lens=30, loc=(hh.x - 0.25, hh.y - 0.3, hh.z + 0.9), target=(hh.x - 0.12, hh.y + 0.12, hh.z + 0.05))
    cam.key(1, loc=(hh.x - 0.25, hh.y - 0.3, hh.z + 0.9)); cam.key(n, loc=(hh.x - 0.23, hh.y - 0.25, hh.z + 0.78))
    look_at(larry, cam.cam, 0.6)
    return n


@shot
def sh29():
    """DALE on your right. - close: Dale, still in his jumpsuit, grinning."""
    n = frames_of("sh29")
    closeup()
    you, larry, dale = trio()
    face(you, 1, SHOCK); face(dale, 1, GRIN); face(larry, 1, CUDDLE)
    hh = dale.world("Head", frame=1)
    cam = Cam(lens=30, loc=(hh.x + 0.25, hh.y - 0.3, hh.z + 0.9), target=(hh.x + 0.12, hh.y + 0.12, hh.z + 0.05))
    cam.key(1, loc=(hh.x + 0.25, hh.y - 0.3, hh.z + 0.9)); cam.key(n, loc=(hh.x + 0.23, hh.y - 0.25, hh.z + 0.78))
    look_at(dale, cam.cam, 0.6)
    return n


@shot
def sh30():
    """Thanks for getting me out, buddy. GROUP HUG? - from the foot of the bed: Dale says it; they squeeze you tight."""
    n = frames_of("sh30")
    closeup()
    you, larry, dale = trio()
    for nm in ("larryarm", "dalearm"):
        e = bpy.data.objects[nm]
        key_loc(e, 1, tuple(e.location)); key_loc(e, at("sh30", 58.4), tuple(e.location))
        key_loc(e, at("sh30", 58.8), (e.location.x * 0.4, e.location.y + 0.02, e.location.z - 0.05))
    syl = [(56.74, 56.92, 0.25, 0.0), (56.92, 57.08, 0.2, 0.2), (57.08, 57.22, 0.3, 0.0), (57.22, 57.44, 0.2, 0.0),
           (57.44, 57.6, 0.3, 0.3), (57.6, 57.78, 0.25, 0.4), (58.28, 58.46, 0.3, 0.6), (58.46, 58.68, 0.35, 0.2)]
    lipsync(dale, lambda t: at("sh30", t), syl, base=GRIN)
    face(dale, at("sh30", 58.9), GRIN)
    face(larry, 1, CUDDLE); face(larry, at("sh30", 58.5), GRIN)
    face(you, 1, SHOCK); face(you, at("sh30", 58.6), dict(SHOCK, jawOpen=0.5))
    cam = Cam(lens=34, loc=(0.0, 0.35, 2.1), target=(0.0, 1.62, 0.85))
    cam.key(1, loc=(0.0, 0.35, 2.1)); cam.key(n, loc=(0.0, 0.6, 1.95))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.5)
    return n
