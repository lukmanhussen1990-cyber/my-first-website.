"""Shot definitions for Episode 8 "Dale's Deck" (you invent the paint roller to oil Dale's massive deck).
Tool-invention format like the reference: tight POV close-ups of your hands and each new tool. Builds on episode 6's
helpers (which pull in episodes 1-4)."""
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
                      face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, lipsync)  # noqa
load_char, look_head, pose_seq, strut = ep6.load_char, ep6.look_head, ep6.pose_seq, ep6.strut
GRIN = ep6.GRIN
OOF = ep1.OOF
WINCE = {"eyeSquintLeft": 1.0, "eyeSquintRight": 1.0, "eyeBlinkLeft": 0.7, "eyeBlinkRight": 0.7, "browDownLeft": 0.9,
         "browDownRight": 0.9, "noseSneerLeft": 0.8, "noseSneerRight": 0.8, "mouthStretchLeft": 0.8,
         "mouthStretchRight": 0.8, "jawOpen": 0.25, "mouthUpperUpLeft": 0.6, "mouthUpperUpRight": 0.6}
BEG = {"browInnerUp": 1.0, "eyeWideLeft": 0.5, "eyeWideRight": 0.5, "mouthPucker": 0.4, "mouthFrownLeft": 0.4,
       "mouthFrownRight": 0.4}
KNEEL = ep3.KNEEL
KNEEL_LEAN = dict(KNEEL, lowerback={"rx": 32}, upperback={"rx": 14}, thorax={"rx": 6})

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


# ============================================================================ wood
DZ = 0.32                      # deck top height
DX0, DX1, DY0, DY1 = -6.0, 6.0, -3.0, 3.35


def wood(name, light, dark, rough, coat=0.0, cracks=0.0):
    """Wood grain in world space (so separate patches line up with the planks): stretched noise + wave rings."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = rough
    if coat and "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.05
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.6, 9.0, 9.0)
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Y"
    wv.inputs["Scale"].default_value = 2.0; wv.inputs["Distortion"].default_value = 8.0; wv.inputs["Detail"].default_value = 4
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 6
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MULTIPLY_ADD"; mx.inputs[2].default_value = 0.0
    nt.links.new(geo.outputs["Position"], mp.inputs[0]); nt.links.new(mp.outputs[0], wv.inputs["Vector"])
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    nt.links.new(wv.outputs["Fac"], mx.inputs[0]); mx.inputs[1].default_value = 0.7
    ad = nt.nodes.new("ShaderNodeMath"); ad.operation = "MULTIPLY_ADD"; ad.inputs[1].default_value = 0.3
    nt.links.new(nz.outputs["Fac"], ad.inputs[0]); nt.links.new(mx.outputs[0], ad.inputs[2])
    rp = nt.nodes.new("ShaderNodeValToRGB")
    rp.color_ramp.elements[0].color = (*dark, 1); rp.color_ramp.elements[1].color = (*light, 1)
    rp.color_ramp.elements[0].position = 0.25; rp.color_ramp.elements[1].position = 0.8
    nt.links.new(ad.outputs[0], rp.inputs[0]); nt.links.new(rp.outputs[0], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.25 + cracks
    nt.links.new(ad.outputs[0], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


def dry_wood():
    return wood("drywood", (0.58, 0.54, 0.48), (0.33, 0.3, 0.26), 0.9, cracks=0.5)


def oiled_wood():
    return wood("oiledwood", (0.7, 0.36, 0.12), (0.32, 0.13, 0.04), 0.14, coat=1.0)


def oil_mat():
    m = bpy.data.materials.get("oil")
    if m:
        return m
    m = mat_flat("oil", (0.62, 0.3, 0.05), rough=0.04)
    b = m.node_tree.nodes["Principled BSDF"]
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = 1.0
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = 0.3
    return m


# ============================================================================ set
def backyard(oiled=False):
    """Sunny back garden: episode 4's house (day), a fence hiding the street, and Dale's MASSIVE plank deck in front of
    the house (x -6..6, y -3..3.35, top at DZ)."""
    ep4.house_exterior(night=False, chimney=False)
    wd = oiled_wood() if oiled else dry_wood()
    pw, gap = 0.14, 0.012
    y = DY0
    k = 0
    while y + pw <= DY1 + 1e-6:
        box(f"plank{k}", (DX1 - DX0, pw, 0.03), ((DX0 + DX1) / 2, y + pw / 2, DZ - 0.015), wd, bevel=0.004)
        y += pw + gap; k += 1
    skirt = wood("skirtwood", (0.4, 0.36, 0.3), (0.26, 0.23, 0.19), 0.9)
    box("deck_frame", (DX1 - DX0, DY1 - DY0, DZ - 0.03), ((DX0 + DX1) / 2, (DY0 + DY1) / 2, (DZ - 0.03) / 2), skirt)
    box("step1", (1.6, 0.35, 0.16), (0, DY0 - 0.18, 0.08), wd, bevel=0.004)
    fence = wood("fencewood", (0.62, 0.48, 0.32), (0.42, 0.3, 0.18), 0.8)
    box("fence", (40, 0.06, 1.8), (0, -6.0, 0.9), fence)
    for i in range(-20, 21):
        box(f"fpost{i}", (0.1, 0.1, 1.9), (i * 1.0, -5.95, 0.95), fence)
    for x in (-9.5, 9.5):
        box(f"fside{x}", (0.06, 9.6, 1.8), (x, -1.2, 0.9), fence)
    for i, (x, y_) in enumerate(((-8, -4.5), (8.5, -4.2), (-9, 1.5))):
        ep1.blob_tree((x, y_, 0), height=5.0 + i, seed=70 + i)
    sun(energy=4.0, rot=(48, 0, 160), color=(1.0, 0.95, 0.87))


def oil_patch(name, x0, x1, y0, y1, keys=None, axis="x"):
    """A glossy oiled area on the deck (just above the dry planks). keys = [(frame, fraction 0..1)] grows it along
    `axis` from its x0 / y0 edge."""
    piv = empty(name, (x0, y0, DZ + 0.0015))
    p = box(f"{name}_m", (x1 - x0, y1 - y0, 0.002), ((x1 - x0) / 2, (y1 - y0) / 2, 0), oiled_wood())
    p.parent = piv
    if keys:
        for f, fr in keys:
            sc = (max(fr, 0.001), 1, 1) if axis == "x" else (1, max(fr, 0.001), 1)
            piv.scale = sc; piv.keyframe_insert("scale", frame=f)
    return piv


# ============================================================================ props
def bucket(loc, name="bucket"):
    root = empty(name, loc)
    m = mat_flat("bucketmetal", (0.75, 0.77, 0.8), metal=0.7, rough=0.3)
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.13, radius2=0.155, depth=0.3, end_fill_type="NGON",
                                    location=(0, 0, 0.15))
    b = bpy.context.object; b.data.materials.append(m)
    b.modifiers.new("t", "SOLIDIFY").thickness = 0.006
    bm = b.data
    import bmesh
    bmm = bmesh.new(); bmm.from_mesh(bm)
    top = [f for f in bmm.faces if f.normal.z > 0.9 and f.calc_center_median().z > 0.1]
    bmesh.ops.delete(bmm, geom=top, context="FACES"); bmm.to_mesh(bm); bmm.free()
    bpy.ops.object.shade_smooth(); b.parent = root
    cylinder(f"{name}_oil", 0.147, 0.01, (0, 0, 0.26), oil_mat(), verts=40).parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.155, minor_radius=0.006, location=(0, 0, 0.3)); r = bpy.context.object
    r.data.materials.append(m); r.parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.15, minor_radius=0.005, location=(0, 0, 0.3), rotation=(math.radians(90), 0, 0))
    h = bpy.context.object; h.data.materials.append(m); h.scale = (1, 1, 1.1); h.parent = root
    lbl = box(f"{name}_label", (0.002, 0.16, 0.1), (0.137, 0, 0.15), mat_flat("buckettlabel", (0.95, 0.75, 0.1), rough=0.5),
              rot=(0, -5, 0)); lbl.parent = root
    return root


def brush(name="brush", with_twine=True):
    """Home-made brush: a wooden handle with a bundle of bristles tied on with twine. Origin at the grip end, handle
    along +Z, bristles at the top end."""
    root = empty(name)
    hw = mat_flat("brushhandle", (0.62, 0.42, 0.22), rough=0.6)
    cylinder(f"{name}_handle", 0.018, 0.34, (0, 0, 0.17), hw, verts=16).parent = root
    bm = mat_flat("bristle", (0.16, 0.11, 0.07), rough=0.85)
    rnd = random.Random(3)
    for i in range(36):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0, 0.03)
        strut(f"{name}_br{i}", (math.cos(a) * r * 0.6, math.sin(a) * r * 0.3, 0.31),
              (math.cos(a) * r * 1.3, math.sin(a) * r * 0.6, 0.45 + rnd.uniform(-0.01, 0.01)), 0.0035, bm, root)
    if with_twine:
        tw = mat_flat("twine", (0.78, 0.66, 0.44), rough=0.9)
        for k in range(4):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.026, minor_radius=0.004, location=(0, 0, 0.33 + k * 0.01))
            t = bpy.context.object; t.name = f"{name}_twine{k}"; t.data.materials.append(tw); t.parent = root
    return root


def fuzz_mat():
    m = bpy.data.materials.get("fuzz")
    if m:
        return m
    m = bpy.data.materials.new("fuzz"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.92, 0.9, 0.84, 1); b.inputs["Roughness"].default_value = 1.0
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 1.0
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 180; nz.inputs["Detail"].default_value = 4
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.9
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


def roller(name="roller", sleeve=True, oiled=False):
    """Paint roller: grip handle along +Z from the origin, a bent wire frame, and an axle along X carrying the fuzzy
    sleeve. Returns (root, sleeve_spin_empty, sleeve_object, tip) where tip = handle end where a pole screws in."""
    root = empty(name)
    grip = mat_flat("rgrip", (0.85, 0.15, 0.1), rough=0.4)
    wire = mat_flat("rwire", (0.8, 0.8, 0.82), metal=1.0, rough=0.25)
    cylinder(f"{name}_grip", 0.017, 0.14, (0, 0, 0.07), grip, verts=16).parent = root
    cylinder(f"{name}_ferrule", 0.012, 0.02, (0, 0, 0.15), wire, verts=12).parent = root
    p = [(0, 0, 0.16), (0, 0, 0.3), (0.05, 0, 0.36), (0.05, 0, 0.42), (0.0, 0, 0.42)]    # the bent wire (crank)
    for i, (a, b_) in enumerate(zip(p, p[1:])):
        strut(f"{name}_wire{i}", a, b_, 0.0035, wire, root)
    spin = empty(f"{name}_spin", (0, 0, 0.42)); spin.parent = root
    spin.rotation_mode = "XYZ"
    strut(f"{name}_axle", (0, 0, 0.42), (-0.25, 0, 0.42), 0.003, wire, root)
    sl = None
    if sleeve:
        sl = cylinder(f"{name}_sleeve", 0.036, 0.23, (-0.125, 0, 0), fuzz_mat(), rot=(0, 90, 0), verts=32)
        sd = sl.modifiers.new("s", "SUBSURF"); sd.levels = 1; sd.render_levels = 1
        bpy.ops.object.shade_smooth()
        if oiled:
            sl.data.materials.clear(); sl.data.materials.append(oil_mat())
        sl.parent = spin
    tip = empty(f"{name}_tip", (0, 0, 0)); tip.parent = root
    return root, spin, sl, tip


def tray(loc, name="tray", rot_z=0.0):
    """Ribbed metal paint tray (ramp with ribs toward +X, deep well with oil at -X)."""
    root = empty(name, loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    m = mat_flat("traymetal", (0.68, 0.7, 0.72), metal=0.8, rough=0.3)
    box(f"{name}_base", (0.42, 0.32, 0.01), (0, 0, 0.005), m).parent = root
    for s in (-1, 1):
        box(f"{name}_side{s}", (0.42, 0.01, 0.07), (0, s * 0.16, 0.035), m).parent = root
    box(f"{name}_back", (0.01, 0.32, 0.07), (0.21, 0, 0.035), m).parent = root
    box(f"{name}_front", (0.01, 0.32, 0.07), (-0.21, 0, 0.035), m).parent = root
    rp = box(f"{name}_ramp", (0.27, 0.3, 0.006), (0.06, 0, 0.035), m, rot=(0, 9, 0)); rp.parent = root
    for k in range(9):
        x = -0.06 + k * 0.028
        r = box(f"{name}_rib{k}", (0.008, 0.29, 0.008), (x, 0, 0.04 + (x - 0.06) * -0.158 + 0.003), m, rot=(0, 9, 0)); r.parent = root
    pool = box(f"{name}_pool", (0.13, 0.3, 0.025), (-0.14, 0, 0.018), oil_mat()); pool.parent = root
    return root, pool


def drips(name, src_fn, n, f0, f1, every=2, floor_z=DZ, seed=4, spread=0.12):
    """Oil drops falling from a moving source (src_fn(frame) -> world Vector) and splatting into puddles."""
    rnd = random.Random(seed)
    om = oil_mat()
    sc = bpy.context.scene
    for k, f in enumerate(range(f0, f1, every)):
        sc.frame_set(f); bpy.context.view_layer.update()
        p = src_fn() + Vector((rnd.uniform(-spread, spread), rnd.uniform(-0.03, 0.03), -0.03))
        t_fall = max(2, int(math.sqrt(max(p.z - floor_z, 0.01) * 2 / 9.8) * 24))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012, location=tuple(p))
        d = bpy.context.object; d.name = f"{name}{k}"; d.data.materials.append(om); bpy.ops.object.shade_smooth()
        key_scale(d, 1, 0.001); key_scale(d, f - 1, 0.001)
        d.scale = (0.8, 0.8, 1.6); d.keyframe_insert("scale", frame=f)
        key_loc(d, f, tuple(p)); key_loc(d, f + t_fall, (p.x, p.y, floor_z + 0.004))
        d.scale = (2.6, 2.6, 0.12); d.keyframe_insert("scale", frame=f + t_fall + 1)
    sc.frame_set(1)


def splinters(ch, side, count=22, seed=1):
    """Wooden slivers stuck all over a hand (bone space: +Y along the hand toward the fingers)."""
    rnd = random.Random(seed)
    m = mat_flat("splinter", (0.3, 0.2, 0.1), rough=0.8)
    for i in range(count):
        bone = rnd.choice((f"{side}Hand", f"{side}Hand", f"{side}FingerBase", f"{side}HandFinger1", f"{side}ForeArm"))
        L = rnd.uniform(0.03, 0.06)
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.004, radius2=0.0006, depth=L, location=(0, 0, 0))
        s = bpy.context.object; s.name = f"spl{side}{i}"; s.data.materials.append(m)
        y = rnd.uniform(0.0, 0.08) if bone != f"{side}ForeArm" else rnd.uniform(0.15, 0.24)
        on_bone(ch, s, bone, (rnd.uniform(-0.03, 0.03), y, rnd.choice((-1, 1)) * rnd.uniform(0.012, 0.03)),
                rot=(rnd.uniform(-70, 70), rnd.uniform(-70, 70), rnd.uniform(0, 360)))


def finger_pose(ch, side, curl=110, thumb_up=True):
    """Fist with the thumb up: drop any keyed finger motion and set the finger bones by hand."""
    act = ch.rig.animation_data.action if ch.rig.animation_data else None
    names = (f"{side}FingerBase", f"{side}HandFinger1", f"{side[0]}Thumb")
    if act:
        for fc in list(act.fcurves):
            if any(f'"{n}"' in fc.data_path for n in names):
                act.fcurves.remove(fc)
    from mathutils import Euler
    for n, ang in ((f"{side}FingerBase", curl), (f"{side}HandFinger1", curl)):
        pb = ch.rig.pose.bones[n]; pb.rotation_mode = "XYZ"; pb.rotation_euler = (math.radians(ang), 0, 0)
        pb.keyframe_insert("rotation_euler", frame=1)
    tb = ch.rig.pose.bones[f"{side[0]}Thumb"]; tb.rotation_mode = "XYZ"
    tb.rotation_euler = (math.radians(0 if thumb_up else 40), 0, 0); tb.keyframe_insert("rotation_euler", frame=1)


def head_off(ch, cut=0.865):
    """First-person view: hide the head (eyes, teeth, hair, brows...) and make the body transparent above the neck
    (Generated = rest-pose coordinates, so it holds in any pose)."""
    for o in ch.meshes:
        nm = o.name.lower()
        if ".body" in nm:
            for m in o.data.materials:
                if not m or not m.use_nodes or m.get("headless"):
                    continue
                nt = m.node_tree
                out = nt.get_output_node("EEVEE") or next((x for x in nt.nodes if x.type == "OUTPUT_MATERIAL"), None)
                if not out or not out.inputs["Surface"].links:
                    continue
                sh = out.inputs["Surface"].links[0].from_socket
                tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
                gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = cut
                tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
                nt.links.new(tc.outputs["Generated"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], gt.inputs[0])
                nt.links.new(gt.outputs[0], mx.inputs["Fac"]); nt.links.new(sh, mx.inputs[1]); nt.links.new(tr.outputs[0], mx.inputs[2])
                nt.links.new(mx.outputs[0], out.inputs["Surface"])
                if hasattr(m, "surface_render_method"):
                    m.surface_render_method = "DITHERED"
                m["headless"] = True
        elif any(k in nm for k in ("high-poly", "teeth", "tongue", "eyebrow", "eyelash", "short0", "hair")):
            o.hide_render = True


def pov(you, n, target, lens=28, push=0.0, fwd=0.06, up=0.06):
    """Your point of view (head hidden): the camera at your eyes looking at `target`; push moves it toward it."""
    head_off(you)
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    pb = you.rig.pose.bones["Head"]
    M = you.rig.matrix_world @ pb.matrix
    eye = M @ Vector((0, 0.09, fwd))                               # bone +Y up the head, +Z = face-forward
    eye.z += up - 0.0
    t = Vector(target)
    d = (t - eye).normalized()
    cam = Cam(lens=lens, loc=tuple(eye), target=tuple(t))
    cam.cam.data.clip_start = 0.02
    cam.key(1, loc=tuple(eye)); cam.key(n, loc=tuple(eye + d * push))
    return cam


def orient(obj, z_dir, x_dir):
    """Rotate obj so its local +Z points along z_dir and local +X along (the part of) x_dir (perpendicular to Z)."""
    from mathutils import Matrix
    z = Vector(z_dir).normalized()
    x = Vector(x_dir); x = (x - z * x.dot(z)).normalized()
    y = z.cross(x)
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = Matrix((x, y, z)).transposed().to_euler()


def place_roller(rl, sleeve_at, handle_dir, axle_dir, frame=None):
    """Put the roller so the sleeve centre sits at `sleeve_at`, the handle runs from the sleeve back along -handle_dir
    (handle_dir = from grip toward sleeve) and the axle (local -X) points along axle_dir."""
    orient(rl, handle_dir, -Vector(axle_dir))
    bpy.context.view_layer.update()
    R = rl.rotation_euler.to_matrix()
    rl.location = Vector(sleeve_at) - R @ Vector((-0.125, 0, 0.42))
    if frame is not None:
        rl.keyframe_insert("location", frame=frame); rl.keyframe_insert("rotation_euler", frame=frame)


def kneeling_you(loc, rot_z, lean=True):
    you = load_char("you_work", loc, rot_z=rot_z)
    pose(you, KNEEL_LEAN if lean else KNEEL)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: you.world(b).z)
    settle(you, knee, DZ + 0.06)
    return you


def dale_char(loc, rot_z):
    return load_char("dale_tee", loc, rot_z=rot_z, tag="dale")


# ============================================================================ SHOTS
@shot
def sh01():
    """DALE begs you to - Dale on his deck, hands clasped, pleading straight at you."""
    n = frames_of("sh01")
    backyard()
    dale = dale_char((0.3, 0.8, DZ), 0)
    dale.clip("137_41", **src(n, 4150))
    hh = dale.world("Head", frame=1)
    for side, dx in (("Left", 0.04), ("Right", -0.04)):
        t = empty(f"beg{side}", (0, 0, 0))
        for f in range(1, n + 1, 4):
            key_loc(t, f, (hh.x + dx, hh.y - 0.28, hh.z - 0.42 + 0.03 * ((f // 4) % 2)))
        hand_ik(dale, side, t)
    face(dale, 1, BEG)
    cam = Cam(lens=32, loc=(0.6, -1.6, 1.85), target=(0.3, 0.8, 1.55))
    cam.key(1, loc=(0.6, -1.6, 1.85)); cam.key(n, loc=(0.5, -1.15, 1.85))
    look_at(dale, cam.cam, 0.6)
    return n


@shot
def sh02():
    """oil up his massive DECK, - crane up: the enormous grey deck; Dale tiny on it, pointing at it desperately."""
    n = frames_of("sh02")
    backyard()
    dale = dale_char((-1.5, 1.6, DZ), 20)
    dale.clip("137_41", **src(n, 4150))
    hh = dale.world("Head", frame=1)
    t = empty("point", (0, 0, 0))
    for f in range(1, n + 1, 4):
        key_loc(t, f, (hh.x + 0.25, hh.y - 0.6, hh.z - 0.75 - 0.05 * ((f // 4) % 2)))
    hand_ik(dale, "Right", t)
    face(dale, 1, BEG)
    cam = Cam(lens=24, loc=(5.0, -9.0, 2.2), target=(0.0, 0.5, 0.4), clip_end=3000)
    cam.key(1, loc=(5.0, -9.0, 2.2)); cam.key(n, loc=(4.0, -8.0, 6.5), target=(0.0, 0.2, 0.2))
    return n


def slap_hands(you, n, x0, y, f_every=6, h_up=0.28):
    """Both hands slapping down on the planks in front of you, alternating."""
    for side, dx, ph in (("Left", -0.14, 0), ("Right", 0.14, f_every // 2)):      # facing +Y: your left is -X
        t = empty(f"slap{side}", (0, 0, 0))
        for f in range(1, n + 1, f_every):
            fu, fd = f + ph, f + ph + f_every // 2
            key_loc(t, max(1, fu), (x0 + dx, y, DZ + h_up))
            key_loc(t, max(1, fd), (x0 + dx * 1.2, y - 0.04, DZ + 0.04), interp="LINEAR")
        hand_ik(you, side, t)


@shot
def sh03():
    """so you slap it on with your bare hands. - POV: your bare hands slap oil onto the grey planks; it glistens."""
    n = frames_of("sh03")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180)
    hx, hy = 0.0, -1.0
    slap_hands(you, n, hx, hy)
    oil_patch("slapoil", hx - 0.3, hx + 0.3, hy - 0.15, hy + 0.35, keys=[(1, 0.2), (n, 1.0)])
    bucket((0.6, -1.2, DZ))
    face(you, 1, DETERMINED)
    pov(you, n, (hx, hy + 0.05, DZ), lens=22, push=0.06)
    return n


@shot
def sh04():
    """Except his deck is dry and rough, - macro on the cracked grey planks; splinters stick up; your hand slides."""
    n = frames_of("sh04")
    backyard()
    you = kneeling_you((0.0, -1.55, 0), 180)
    rnd = random.Random(8)
    sm = mat_flat("fibre", (0.55, 0.5, 0.42), rough=0.9)
    for i in range(40):                                          # raised fibres along the plank grain
        x = rnd.uniform(-0.5, 0.5); y = -1.0 + rnd.uniform(-0.15, 0.15)
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.004, radius2=0.0004, depth=rnd.uniform(0.02, 0.05),
                                        location=(x, y, DZ + 0.01), rotation=(0, math.radians(rnd.uniform(55, 80)), math.radians(rnd.choice((0, 180)) + rnd.uniform(-15, 15))))
        bpy.context.object.data.materials.append(sm)
    t = empty("slide", (0, 0, 0))
    key_loc(t, 1, (0.35, -1.0, DZ + 0.03)); key_loc(t, n, (-0.35, -1.0, DZ + 0.03))
    hand_ik(you, "Right", t)
    hand_ik(you, "Left", empty("restL", (-0.3, -1.3, DZ + 0.25)))
    cam = Cam(lens=32, loc=(0.75, -0.75, DZ + 0.16), target=(0.0, -1.0, DZ + 0.03))             # low, at plank level
    cam.key(1, loc=(0.75, -0.75, DZ + 0.14)); cam.key(n, loc=(0.6, -0.78, DZ + 0.12))
    cam.cam.data.clip_start = 0.02
    return n


@shot
def sh05():
    """so you just get SPLINTERS. - your hands held up to your face: covered in splinters, trembling."""
    n = frames_of("sh05")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180, lean=False)
    hh = you.world("Head", frame=1)
    for side, dx in (("Left", -0.13), ("Right", 0.13)):
        t = empty(f"show{side}", (0, 0, 0))
        for f in range(1, n + 1, 2):
            key_loc(t, f, (hh.x + dx + 0.006 * ((f // 2) % 2), hh.y + 0.32, hh.z - 0.12))
        hand_ik(you, side, t)
        splinters(you, side, seed=3 if side == "Left" else 9)
    face(you, 1, WINCE)
    pov(you, n, (hh.x, hh.y + 0.34, hh.z - 0.12), lens=26)
    return n


@shot
def sh06():
    """(wince) - your face, eyes screwed shut, teeth gritted."""
    n = frames_of("sh06")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180, lean=False)
    hh = you.world("Head", frame=1)
    for side, dx in (("Left", -0.15), ("Right", 0.15)):
        hand_ik(you, side, empty(f"up{side}", (hh.x + dx, hh.y + 0.3, hh.z - 0.2)))
        splinters(you, side, seed=3 if side == "Left" else 9)
    face(you, 1, WINCE)
    cam = Cam(lens=40, loc=(hh.x + 0.15, hh.y + 0.95, hh.z + 0.05), target=(hh.x, hh.y, hh.z + 0.05))
    cam.key(1, loc=(hh.x + 0.15, hh.y + 0.95, hh.z + 0.05)); cam.key(n, loc=(hh.x + 0.1, hh.y + 0.75, hh.z + 0.05))
    cam.shake(1, n, amp=0.01, freq=1.2)
    return n


@shot
def sh07():
    """So you tie bristles to a wooden handle - POV: one hand holds the handle up, the other winds twine round a
    bundle of bristles; the twine loops appear one by one."""
    n = frames_of("sh07")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180, lean=False)
    hh = you.world("Head", frame=1)
    br = brush("newbrush")
    br.location = (hh.x - 0.02, hh.y + 0.4, hh.z - 0.55); br.rotation_euler = (math.radians(-25), 0, 0)
    tw = [o for o in br.children if "twine" in o.name]
    for k, o in enumerate(tw):
        f = 6 + k * int((n - 10) / len(tw))
        key_scale(o, 1, 0.01); key_scale(o, f, 0.01); key_scale(o, f + 4, 1.0)
    bpy.context.view_layer.update()
    hold = br.matrix_world @ Vector((0, 0, 0.08))
    hand_ik(you, "Left", empty("holdL", tuple(hold)))
    top = br.matrix_world @ Vector((0, 0, 0.34))
    t = empty("wind", (0, 0, 0))
    for f in range(1, n + 1, 3):
        a = f * 0.9
        key_loc(t, f, (top.x - 0.05 * math.cos(a), top.y - 0.05 * math.sin(a) - 0.02, top.z - 0.02))
    hand_ik(you, "Right", t)
    face(you, 1, DETERMINED)
    pov(you, n, tuple(top - Vector((0, 0, 0.1))), lens=30, push=0.04)
    return n


def brush_strokes(you, n, br, x0, x1, y, strokes=3, start=1):
    """Brush the planks: strokes along X; the brush is held in the right hand; an oiled strip follows the brush."""
    tgt = empty("brushtip", (0, 0, 0))
    seg = max(2, (n - start) // (2 * strokes))
    keys = []
    f = start
    for s in range(strokes):
        keys += [(f, x0), (f + seg, x1)]; f += 2 * seg
    xs = [x for _, x in keys]
    for (f, x) in keys:
        key_loc(tgt, min(n, f), (x, y - 0.25, DZ + 0.2))
    ep3.hold(you, br, "Right", loc=(0.0, 0.05, 0.02), rot=(-90, 0, 0))          # held: handle along the fingers
    hand_ik(you, "Right", tgt)
    oil_patch("stroke", min(xs), max(xs), y - 0.07, y + 0.07, keys=[(start, 0.05), (start + seg, 1.0)])
    return tgt


@shot
def sh08():
    """and STROKE IT instead. - side close: you brush oil along the planks, a glossy stripe behind every stroke."""
    n = frames_of("sh08")
    backyard()
    you = kneeling_you((0.0, -1.55, 0), 180)
    br = brush("strokebrush")
    brush_strokes(you, n, br, 0.35, -0.3, -1.05, strokes=2)
    hand_ik(you, "Left", empty("leanL", (-0.25, -1.2, DZ + 0.05)))
    bucket((0.75, -1.25, DZ))
    face(you, 1, SMILE)
    cam = Cam(lens=30, loc=(-0.6, -0.55, DZ + 0.4), target=(0.05, -1.05, DZ + 0.06))
    cam.key(1, loc=(-0.6, -0.55, DZ + 0.4)); cam.key(n, loc=(-0.5, -0.6, DZ + 0.36))
    return n


@shot
def sh09():
    """CLEVER! - low angle: you, kneeling, hold the brush up proudly."""
    n = frames_of("sh09")
    backyard()
    you = kneeling_you((0.0, -1.55, 0), 180, lean=False)
    br = brush("proudbrush")
    hh = you.world("Head", frame=1)
    br.location = (hh.x - 0.25, hh.y + 0.15, hh.z - 0.2); br.rotation_euler = (math.radians(-10), math.radians(-15), 0)
    bpy.context.view_layer.update()
    hand_ik(you, "Right", empty("raise", tuple(br.matrix_world @ Vector((0, 0, 0.06)))))
    face(you, 1, SMUG)
    oil_patch("doneoil", -0.4, 0.45, -1.2, -0.85)
    cam = Cam(lens=24, loc=(0.1, -0.35, DZ + 0.25), target=(0.0, -1.55, 1.15))
    cam.key(1, loc=(0.1, -0.35, DZ + 0.25)); cam.key(n, loc=(0.05, -0.45, DZ + 0.28))
    look_at(you, cam.cam, 0.5)
    return n


@shot
def sh10():
    """But his deck is SO WIDE it takes forever to cover. - straight up from above: you, a tiny figure in the corner
    with a tiny glossy patch, pulling back to reveal the whole enormous grey deck."""
    n = frames_of("sh10")
    backyard()
    cx, cy = DX0 + 0.9, DY0 + 0.9
    you = kneeling_you((cx, cy - 0.5, 0), 180)
    br = brush("cornerbrush")
    brush_strokes(you, n, br, cx + 0.3, cx - 0.3, cy, strokes=4)
    oil_patch("cornerpatch", cx - 0.4, cx + 0.4, cy + 0.07, cy + 0.4)
    cam = Cam(lens=26, loc=(cx, cy - 0.3, 3.2), target=(cx, cy, 0.3), clip_end=3000)
    cam.key(1, loc=(cx + 0.05, cy - 0.3, 3.0), target=(cx, cy, 0.3))
    cam.key(n, loc=(0.0, -2.0, 17.0), target=(0.0, 0.2, 0.0))
    return n


@shot
def sh11():
    """So you swap to a FUZZY SLEEVE - POV close: you slide the fuzzy roller sleeve onto the bent wire frame."""
    n = frames_of("sh11")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180, lean=False)
    hh = you.world("Head", frame=1)
    rl, spin, sl, tip = roller("newroller")
    rl.location = (hh.x + 0.1, hh.y + 0.42, hh.z - 0.6); rl.rotation_euler = (math.radians(-20), 0, 0)
    key_loc(sl, 1, (-0.42, 0, 0)); key_loc(sl, int(n * 0.75), (-0.125, 0, 0))
    bpy.context.view_layer.update()
    hand_ik(you, "Left", empty("rgrip", tuple(rl.matrix_world @ Vector((0, 0, 0.06)))))
    t = empty("slidehand", (0, 0, 0))
    t.parent = rl
    for f, x in ((1, -0.45), (int(n * 0.75), -0.16), (n, -0.18)):
        key_loc(t, f, (x, 0.0, 0.42))
    hand_ik(you, "Right", t)
    face(you, 1, DETERMINED)
    pov(you, n, tuple(rl.matrix_world @ Vector((-0.12, 0, 0.36))), lens=30, push=0.04)
    return n


@shot
def sh12():
    """that spins on a bent wire frame. - the roller held up; you flick the sleeve and it spins like crazy."""
    n = frames_of("sh12")
    backyard()
    you = kneeling_you((0.0, -1.5, 0), 180, lean=False)
    hh = you.world("Head", frame=1)
    rl, spin, sl, tip = roller("spinroller")
    rl.location = (hh.x + 0.12, hh.y + 0.4, hh.z - 0.55); rl.rotation_euler = (math.radians(-15), 0, 0)
    flick = 10
    key_rot(spin, 1, (0, 0, 0)); key_rot(spin, flick, (0, 0, 0))
    for f in range(flick + 2, n + 1, 2):
        spin.rotation_euler = (math.radians(55 * (f - flick)), 0, 0); spin.keyframe_insert("rotation_euler", frame=f)
    bpy.context.view_layer.update()
    hand_ik(you, "Left", empty("sgrip", tuple(rl.matrix_world @ Vector((0, 0, 0.06)))))
    t = empty("flick", (0, 0, 0)); t.parent = rl
    key_loc(t, 1, (-0.12, -0.06, 0.48)); key_loc(t, flick - 2, (-0.12, -0.06, 0.48)); key_loc(t, flick + 3, (-0.14, 0.04, 0.34))
    key_loc(t, n, (-0.18, 0.05, 0.3))
    hand_ik(you, "Right", t)
    face(you, 1, SMILE); face(you, flick + 2, TADA)
    bpy.context.scene.render.use_motion_blur = True
    pov(you, n, tuple(rl.matrix_world @ Vector((-0.12, 0, 0.38))), lens=30)
    return n


@shot
def sh13():
    """GENIUS! - you stand on the deck holding the roller up like a trophy, low angle, sun behind."""
    n = frames_of("sh13")
    backyard()
    you = load_char("you_work", (0.0, -1.2, DZ), rot_z=0)
    you.clip("137_41", **src(n, 4200))
    hh = you.world("Head", frame=1)
    rl, spin, sl, tip = roller("trophy")
    rl.location = (hh.x - 0.28, hh.y - 0.1, hh.z + 0.15); rl.rotation_euler = (0, math.radians(8), math.radians(90))
    bpy.context.view_layer.update()
    hand_ik(you, "Right", empty("trophygrip", tuple(rl.matrix_world @ Vector((0, 0, 0.06)))))
    face(you, 1, TADA)
    cam = Cam(lens=22, loc=(0.35, -2.25, DZ + 0.35), target=(0.0, -1.2, 1.55))
    cam.key(1, loc=(0.35, -2.25, DZ + 0.35)); cam.key(n, loc=(0.3, -2.1, DZ + 0.38))
    look_at(you, cam.cam, 0.4)
    return n


@shot
def sh14():
    """Except it DRIPS EVERYWHERE when you dip it in the bucket. - side close: dunk, lift; oil pours off the sleeve
    all over the deck and your boots."""
    n = frames_of("sh14")
    backyard()
    you = load_char("you_work", (0.0, -1.2, DZ), rot_z=0)
    pose(you, {"lowerback": {"rx": 22}, "upperback": {"rx": 10}})
    bk = bucket((0.0, -1.62, DZ))
    rl, spin, sl, tip = roller("dunk", oiled=True)
    dip, lift = int(n * 0.25), int(n * 0.45)
    for f, z in ((1, DZ + 0.62), (dip, DZ + 0.3), (dip + 6, DZ + 0.22), (lift, DZ + 0.66), (n, DZ + 0.7)):
        place_roller(rl, (0.0, -1.62, z), (0.2, -0.5, -1.0), (1, 0, 0), frame=f)
    bpy.context.view_layer.update()
    g = empty("dunkgrip", (0, 0, 0)); g.parent = rl; g.location = (0, 0, 0.06)
    hand_ik(you, "Right", g)
    def sleeve_pos():
        return sl.matrix_world.translation.copy() if sl else rl.matrix_world.translation
    drips("drip", sleeve_pos, n, lift - 2, n - 2, every=2, seed=6, spread=0.1)
    face(you, 1, SMILE); face(you, lift + 6, SHOCK)
    look_at(you, (0.0, -1.6, DZ + 0.3), 0.7)
    cam = Cam(lens=30, loc=(0.95, -2.3, 0.95), target=(0.0, -1.62, 0.72))
    cam.key(1, loc=(0.95, -2.3, 0.95)); cam.key(n, loc=(0.85, -2.2, 0.92))
    return n


@shot
def sh15():
    """So you add a RIBBED METAL TRAY - close: the shiny ribbed tray comes down onto the deck, oil in its well."""
    n = frames_of("sh15")
    backyard()
    tr, pool = tray((0.0, -1.0, DZ), rot_z=0)
    key_loc(tr, 1, (0.0, -1.0, DZ + 0.4)); key_loc(tr, int(n * 0.6), (0.0, -1.0, DZ))
    you = kneeling_you((0.0, -1.6, 0), 180)
    for side, dy in (("Left", 0.16), ("Right", -0.16)):
        g = empty(f"traygrip{side}", (0, 0, 0)); g.parent = tr; g.location = (0.0, dy * 1.05, 0.06)
        hand_ik(you, side, g)
    cam = Cam(lens=34, loc=(0.55, -0.45, DZ + 0.42), target=(0.0, -1.0, DZ + 0.05))
    cam.key(1, loc=(0.55, -0.45, DZ + 0.42)); cam.key(n, loc=(0.45, -0.55, DZ + 0.38))
    return n


@shot
def sh16():
    """to roll off the EXTRA JUICE. - the oily roller rolls up and down the ribs; the excess squeezes into the well."""
    n = frames_of("sh16")
    backyard()
    tr, pool = tray((0.0, -1.0, DZ), rot_z=0)
    rl, spin, sl, tip = roller("trayroll", oiled=True)
    seg = 8
    for k, f in enumerate(range(1, n + 1, seg)):
        x = 0.11 if k % 2 == 0 else -0.03
        place_roller(rl, (x, -1.0, DZ + 0.075 + (0.11 - x) * -0.12), (1.0, 0, -1.1), (0, 1, 0), frame=f)
        spin.rotation_euler = (math.radians(-k * 220), 0, 0); spin.keyframe_insert("rotation_euler", frame=f)
    key_scale(pool, 1, 1.0)
    pool.scale = (1, 1, 1.5); pool.keyframe_insert("scale", frame=n)
    you = kneeling_you((-0.75, -1.0, 0), 90)
    g = empty("rollgrip", (0, 0, 0)); g.parent = rl; g.location = (0, 0, 0.06)
    hand_ik(you, "Right", g)
    def sleeve_pos():
        return sl.matrix_world.translation.copy()
    drips("traydrip", sleeve_pos, n, 4, n - 3, every=4, floor_z=DZ + 0.03, seed=8, spread=0.08)
    cam = Cam(lens=34, loc=(0.35, -0.35, DZ + 0.45), target=(0.02, -1.0, DZ + 0.06))
    cam.key(1, loc=(0.35, -0.35, DZ + 0.45)); cam.key(n, loc=(0.3, -0.42, DZ + 0.4))
    return n


@shot
def sh17():
    """But your back HURTS from kneeling down to work on his deck. - you roll on your knees, then freeze and grab your
    lower back, grimacing."""
    n = frames_of("sh17")
    backyard()
    you = load_char("you_work", (0.0, -1.5, 0), rot_z=180)
    ow = at("sh17", 29.4)
    LEANB = dict(KNEEL, lowerback={"rx": -6}, upperback={"rx": -2})
    pose_seq(you, [(1, KNEEL_LEAN), (ow, KNEEL_LEAN), (ow + 8, LEANB), (n, LEANB)], n)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: you.world(b, frame=1).z)
    settle(you, knee, DZ + 0.06)
    rl, spin, sl, tip = roller("kneelroll", oiled=True)
    for k, f in enumerate(range(1, ow + 1, 8)):
        place_roller(rl, (0.0, -0.85 if k % 2 == 0 else -0.6, DZ + 0.04), (0, 1.0, -0.9), (1, 0, 0), frame=f)
        spin.rotation_euler = (math.radians(-k * 260), 0, 0); spin.keyframe_insert("rotation_euler", frame=f)
    place_roller(rl, (0.05, -0.8, DZ + 0.04), (0, 1.0, -0.9), (1, 0, 0), frame=ow + 6)
    g = empty("kgrip", (0, 0, 0)); g.parent = rl; g.location = (0, 0, 0.06)
    hand_ik(you, "Right", g)
    bpy.context.scene.frame_set(ow + 8); bpy.context.view_layer.update()
    back = you.world("Spine")
    t = empty("backhand", (0, 0, 0))
    key_loc(t, 1, (0.2, -1.2, DZ + 0.06)); key_loc(t, ow, (0.2, -1.2, DZ + 0.06))
    key_loc(t, ow + 8, (back.x + 0.12, back.y - 0.12, back.z - 0.02)); key_loc(t, n, (back.x + 0.12, back.y - 0.12, back.z - 0.02))
    hand_ik(you, "Left", t)
    bpy.context.scene.frame_set(1)
    oil_patch("kneeloil", -0.15, 0.15, -1.0, -0.4, keys=[(1, 0.3), (ow, 1.0)], axis="y")
    face(you, 1, DETERMINED); face(you, ow + 2, WINCE)
    cam = Cam(lens=28, loc=(-1.5, -0.5, 1.05), target=(0.0, -1.2, 0.75))
    cam.key(1, loc=(-1.5, -0.5, 1.05)); cam.key(n, loc=(-1.3, -0.6, 1.0))
    cam.shake(ow, ow + 4, amp=0.01, freq=1.0)
    return n


@shot
def sh18():
    """So you screw a LONG POLE onto the handle - close: the pole twists into the end of the roller handle."""
    n = frames_of("sh18")
    backyard()
    you = load_char("you_work", (0.0, -1.2, DZ), rot_z=0)
    you.clip("137_41", **src(n, 4200))
    hh = you.world("Head", frame=1)
    rl, spin, sl, tip = roller("poleroll", oiled=True)
    base = Vector((hh.x - 0.05, hh.y - 0.42, hh.z - 0.55))
    rl.location = tuple(base); rl.rotation_euler = (math.radians(-100), 0, 0)
    bpy.context.view_layer.update()
    pm = mat_flat("polealu", (0.82, 0.83, 0.85), metal=0.9, rough=0.25)
    pole = empty("pole", (0, 0, 0)); pole.parent = rl
    cylinder("pole_m", 0.013, 1.6, (0, 0, -0.8), pm, verts=16).parent = pole
    cylinder("pole_tip", 0.011, 0.04, (0, 0, 0.0), mat_flat("poletip", (0.2, 0.2, 0.22), rough=0.5), verts=12).parent = pole
    for k in range(6):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.012, minor_radius=0.0018, location=(0, 0, -0.005 - k * 0.006))
        th = bpy.context.object; th.data.materials.append(mat_flat("thread", (0.25, 0.25, 0.27), rough=0.4)); th.parent = pole
    pole.rotation_mode = "XYZ"
    in_f = int(n * 0.8)
    for f in range(1, n + 1, 2):
        u = min(1.0, (f - 1) / in_f)
        pole.location = (0, 0, -0.08 * (1 - u)); pole.rotation_euler = (0, 0, math.radians(-900 * u))
        pole.keyframe_insert("location", frame=f); pole.keyframe_insert("rotation_euler", frame=f)
    hand_ik(you, "Left", empty("holdroll", tuple(rl.matrix_world @ Vector((0, 0, 0.07)))))
    t = empty("twist", (0, 0, 0)); t.parent = rl
    for f in range(1, n + 1, 4):
        a = f * 0.8
        key_loc(t, f, (0.035 * math.cos(a), 0.035 * math.sin(a), -0.12))
    hand_ik(you, "Right", t)
    face(you, 1, DETERMINED)
    tipw = rl.matrix_world @ Vector((0, 0, -0.04))
    cam = Cam(lens=40, loc=(tipw.x + 0.45, tipw.y - 0.35, tipw.z + 0.12), target=tuple(tipw))
    cam.key(1, loc=(tipw.x + 0.45, tipw.y - 0.35, tipw.z + 0.12)); cam.key(n, loc=(tipw.x + 0.38, tipw.y - 0.3, tipw.z + 0.1))
    return n


@shot
def sh19():
    """to glide back and forth while standing. - you stand tall and glide the roller up and down the deck on the long
    pole; glossy stripes spread across the planks."""
    n = frames_of("sh19")
    backyard()
    you = load_char("you_work", (0.0, -0.4, DZ), rot_z=0)                     # facing -Y, toward the roller
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    hh = you.world("Head", frame=1)
    rl, spin, sl, tip = roller("glide", oiled=True)
    seg = 10
    for k, f in enumerate(range(1, n + 1, seg)):
        y = -2.0 if k % 2 == 0 else -1.15
        place_roller(rl, (0.05, y, DZ + 0.04), (0, -1.0, -0.75), (1, 0, 0), frame=f)
        spin.rotation_euler = (math.radians(k * 400), 0, 0); spin.keyframe_insert("rotation_euler", frame=f)
    hands = empty("polehands", (0, 0, 0))
    for k, f in enumerate(range(1, n + 1, seg)):
        dy = -0.2 if k % 2 == 0 else 0.15
        key_loc(hands, f, (0.05, -0.7 + dy, DZ + 0.95))
    for side, dz in (("Left", 0.0), ("Right", -0.25)):
        g = empty(f"pg{side}", (0, 0, 0)); g.parent = hands; g.location = (0.0, -0.05 * (dz != 0), dz)
        hand_ik(you, side, g)
    ep4.rope_between("polerod", lambda: rl.matrix_world @ Vector((0, 0, 0.0)), lambda: hands.matrix_world.translation + Vector((0, 0, 0.05)),
                     n, radius=0.013, color=(0.82, 0.83, 0.85))
    oil_patch("glidestrip", -0.09, 0.19, -2.05, -0.9, keys=[(1, 0.1), (seg, 1.0)], axis="y")
    oil_patch("doneA", -1.2, -0.12, -2.4, -0.9)
    cam = Cam(lens=24, loc=(2.3, -2.6, 1.5), target=(0.0, -1.1, 0.85))
    cam.key(1, loc=(2.3, -2.6, 1.5)); cam.key(n, loc=(2.1, -2.4, 1.45))
    return n


@shot
def sh20():
    """Now Dale loves how you treat HIS DECK. - the whole deck gleams; Dale beams, big thumbs up; you, proud, beside
    him leaning on the pole. Wink."""
    n = frames_of("sh20")
    backyard(oiled=True)
    dale = dale_char((-0.3, 0.2, DZ), 0)
    dale.clip("137_41", **src(n, 4150))
    hh = dale.world("Head", frame=1)
    up = empty("thumb", (hh.x - 0.12, hh.y - 0.45, hh.z - 0.22))
    hand_ik(dale, "Right", up)
    finger_pose(dale, "Right")
    face(dale, 1, GRIN); face(dale, n - 14, WINK)
    you = load_char("you_work", (0.75, 0.4, DZ), rot_z=-15)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    rl, spin, sl, tip = roller("restroll", oiled=True)
    rl.location = (1.05, 0.15, DZ + 0.04 + 0.42); rl.rotation_euler = (math.radians(180), 0, 0)
    pole_top = Vector((1.0, 0.25, DZ + 1.25))
    ep6.strut("restpole", tuple(rl.location), tuple(pole_top), 0.013, mat_flat("polealu2", (0.82, 0.83, 0.85), metal=0.9, rough=0.25))
    hand_ik(you, "Left", empty("poletop", tuple(pole_top)))
    glint = mat_flat("deckglint", (1, 1, 1), emit=(1, 0.95, 0.85), emit_strength=40)
    rnd = random.Random(2)
    for i in range(10):
        f0 = rnd.randint(4, n - 10)
        g = box(f"glint{i}", (0.06, 0.002, 0.006), (rnd.uniform(-3, 3), rnd.uniform(-2.5, -0.6), DZ + 0.01), glint, rot=(0, 0, 45))
        g2 = box(f"glintb{i}", (0.06, 0.002, 0.006), (0, 0, 0), glint, rot=(0, 0, 90)); g2.parent = g
        key_scale(g, 1, 0.01); key_scale(g, f0, 0.01); key_scale(g, f0 + 3, 1.0); key_scale(g, f0 + 7, 0.01)
    cam = Cam(lens=30, loc=(0.3, -3.0, 1.6), target=(0.15, 0.3, 1.3))
    cam.key(1, loc=(0.35, -3.3, 1.6)); cam.key(n, loc=(0.2, -2.4, 1.6))
    look_at(dale, cam.cam, 0.6)
    return n
