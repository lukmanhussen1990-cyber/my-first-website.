"""Shot definitions for Episode 4 "Fresh Batch" (Larry & Dale sneak in every night to sniff your underwear).
Same pipeline as episodes 1-3; episode 1's bedroom/living room and the episode 2-3 helpers are reused unchanged."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (load_char, empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale, fit, bbox, drop_to)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ep3shots", os.path.join(_HERE, "..", "ep3", "shots.py"))
ep3 = importlib.util.module_from_spec(_spec)
sys.modules["ep3shots"] = ep3
_spec.loader.exec_module(ep3)
ep2 = ep3.ep2
ep1 = ep2.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, STERN, SHOCK, DEADPAN, SLEEP, WINK, TADA,
                      LOVESTRUCK, SERENE, DOGGY, face, blink, look_at, hand_ik, src, pose, settle, on_bone,
                      turn_around, stare_at, lipsync, SQUAT, ALL_FOURS)  # noqa: E402
from ep3shots import hold, LEAN  # noqa: E402

D4 = os.path.join(lib.SCRATCH, "ep4", "decals")
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


SNIFF = {"eyeBlinkLeft": 0.95, "eyeBlinkRight": 0.95, "noseSneerLeft": 0.7, "noseSneerRight": 0.7, "browInnerUp": 0.7,
         "mouthSmileLeft": 0.55, "mouthSmileRight": 0.55, "cheekSquintLeft": 0.4, "cheekSquintRight": 0.4}


def facing(rot_z):
    a = math.radians(rot_z)
    return Vector((math.sin(a), -math.cos(a), 0.0))


# ============================================================================ props
def boxers_mat():
    """White cotton with a repeating red-heart print (object-space mapping, so every piece tiles)."""
    m = bpy.data.materials.get("boxers_cotton")
    if m:
        return m
    m = bpy.data.materials.new("boxers_cotton"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.85
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (7, 7, 7)
    im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(f"{D4}/boxers_hearts.png", check_existing=True)
    im.extension = "REPEAT"; im.projection = "BOX"; im.projection_blend = 0.3
    nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], im.inputs[0])
    nt.links.new(im.outputs[0], b.inputs["Base Color"])
    return m


def boxers(name="boxers"):
    """Soft heart-print boxer shorts; origin at the waistband centre, legs hang toward -Z."""
    m = boxers_mat()
    band = mat_flat("boxers_band", (0.95, 0.95, 0.97), rough=0.6)
    root = empty(name, (0, 0, 0))
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.16, depth=0.045, location=(0, 0, -0.022))
    w = bpy.context.object; w.scale = (1.0, 0.62, 1.0); w.data.materials.append(band); parts.append(w)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.165, depth=0.13, location=(0, 0, -0.11))
    h = bpy.context.object; h.scale = (1.0, 0.64, 1.0); h.data.materials.append(m); parts.append(h)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.085, depth=0.17, location=(sx * 0.085, 0, -0.22),
                                            rotation=(0, math.radians(sx * 7), 0))
        lg = bpy.context.object; lg.scale = (1.0, 0.85, 1.0); lg.data.materials.append(m); parts.append(lg)
    for k, o in enumerate(parts):
        o.name = f"{name}_{k}"
        sd = o.modifiers.new("soft", "SUBSURF"); sd.levels = 1; sd.render_levels = 2
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()
        o.parent = root
    return root


def collar(ch):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.014, location=(0, 0, 0))
    c = bpy.context.object; c.name = "collar"; c.data.materials.append(mat_flat("collar_red", (0.75, 0.04, 0.05), rough=0.4))
    bpy.ops.object.shade_smooth()
    on_bone(ch, c, "Neck", (0, 0.04, 0.0))
    tag = cylinder("collar_tag", 0.02, 0.006, (0, 0, 0), mat_flat("tag_gold", (0.9, 0.7, 0.2), metal=1.0, rough=0.25),
                   rot=(90, 0, 0), verts=12)
    on_bone(ch, tag, "Neck", (0, 0.0, 0.085), rot=(0, 0, 0))
    return c


def rope_between(name, fa, fb, n, radius=0.008, color=(0.15, 0.15, 0.18)):
    """Leash: a thin cylinder re-keyed every frame between two world points fa(f), fb(f)."""
    r = cylinder(name, radius, 1.0, (0, 0, 0), mat_flat(name + "_m", color, rough=0.6), verts=8)
    r.rotation_mode = "QUATERNION"
    sc = bpy.context.scene
    for f in range(1, n + 1):
        sc.frame_set(f); bpy.context.view_layer.update()
        a, b = fa(), fb()
        d = b - a
        r.location = (a + b) / 2; r.keyframe_insert("location", frame=f)
        r.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); r.keyframe_insert("rotation_quaternion", frame=f)
        r.scale = (1, 1, max(d.length, 0.01)); r.keyframe_insert("scale", frame=f)
    sc.frame_set(1)
    return r


def sootify(ch, amount=0.6, skip=("eye",)):
    """Cover a character in chimney soot: blend every material (except eyes) toward sooty black."""
    for o in ch.meshes:
        if any(k in o.name.lower() for k in skip):
            continue
        for m in o.data.materials:
            if not m or not m.use_nodes or m.get("sooted"):
                continue
            nt = m.node_tree
            out = nt.get_output_node("EEVEE") or next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
            if not out or not out.inputs["Surface"].links:
                continue
            sh = out.inputs["Surface"].links[0].from_socket
            mix = nt.nodes.new("ShaderNodeMixShader"); dk = nt.nodes.new("ShaderNodeBsdfDiffuse")
            dk.inputs["Color"].default_value = (0.03, 0.028, 0.026, 1)
            nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 14
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value = amount * 0.6; mr.inputs["To Max"].default_value = min(1.0, amount * 1.3)
            nt.links.new(nz.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs[0], mix.inputs["Fac"])
            nt.links.new(sh, mix.inputs[1]); nt.links.new(dk.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs["Surface"])
            m["sooted"] = True


def clip_below(ch, z_cut):
    """Make a character invisible below world height z_cut (binary alpha, so no dither noise)."""
    for o in ch.meshes:
        for m in o.data.materials:
            if not m or not m.use_nodes or m.get("clipped"):
                continue
            nt = m.node_tree
            out = nt.get_output_node("EEVEE") or next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
            if not out or not out.inputs["Surface"].links:
                continue
            sh = out.inputs["Surface"].links[0].from_socket
            geo = nt.nodes.new("ShaderNodeNewGeometry"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
            lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = z_cut
            tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
            nt.links.new(geo.outputs["Position"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], lt.inputs[0])
            nt.links.new(lt.outputs[0], mix.inputs["Fac"]); nt.links.new(sh, mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs["Surface"])
            if hasattr(m, "surface_render_method") and m.surface_render_method != "BLENDED":
                m.surface_render_method = "DITHERED"
            m["clipped"] = True


def soot_cloud(center, n, start=1, count=26, color=(0.05, 0.045, 0.04), seed=4):
    """Billowing black soot: many small smooth puffs bursting out of the hearth and spreading forward."""
    m = mat_flat("soot", color, rough=1.0, alpha=0.38)
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    rnd = random.Random(seed)
    for i in range(count):
        a = rnd.uniform(-1.2, 1.2)
        r0 = rnd.uniform(0.08, 0.16)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r0, location=center)
        d = bpy.context.object; d.data.materials.append(m); bpy.ops.object.shade_smooth()
        t0 = start + i % 5
        key_scale(d, 1, 0.01); key_scale(d, t0, 0.01); key_loc(d, t0, center)
        dist = rnd.uniform(0.5, 1.3)
        key_scale(d, n, rnd.uniform(1.6, 2.8))
        key_loc(d, n, (center[0] + math.sin(a) * dist, center[1] - math.cos(a) * dist * 0.9, center[2] + rnd.uniform(0.0, 1.1)))


def digital_clock(loc, rot_z=0.0, flip_at=None, show="clock_300"):
    """Bedside alarm clock (black body + glowing red LED face). flip_at: frame where 2:59 becomes 3:00."""
    root = empty("clock", loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    b = box("clock_body", (0.24, 0.1, 0.11), (0, 0, 0.055), mat_flat("clock_body", (0.02, 0.02, 0.025), rough=0.3),
            bevel=0.012); b.parent = root
    faces = {}
    for nm in ("clock_259", "clock_300"):
        d = decal(nm, f"{D4}/{nm}.png", 0.21, (0, -0.0505, 0.058), rot=(90, 0, 0), emit=4.0); d.parent = root
        faces[nm] = d
    if flip_at:
        lib.hide_after(faces["clock_259"], flip_at)
        f = faces["clock_300"]
        f.hide_render = True; f.keyframe_insert("hide_render", frame=flip_at - 1)
        f.hide_render = False; f.keyframe_insert("hide_render", frame=flip_at)
    else:
        faces["clock_259" if show == "clock_300" else "clock_300"].hide_render = True
    point("clock_glow", (loc[0], loc[1] - 0.12, loc[2] + 0.06), energy=3, color=(1.0, 0.15, 0.1), radius=0.05)
    return root


# ============================================================================ characters
def flyer(name, n, path, tag=None):
    """Superman flight: body horizontal, face down, arms reaching forward. path = [(frame, (x, y, z))].
    Heading follows the path (head toward the direction of travel)."""
    ch = load_char(name, (0, 0, 0), subdiv=True, tag=tag or name)
    ch.tpose()
    (f0, p0), (f1, p1) = path[0], path[-1]
    d = Vector(p1) - Vector(p0)
    yaw = math.degrees(math.atan2(d.y, d.x))           # direction of travel
    ch.rig.rotation_mode = "XYZ"
    ch.rig.rotation_euler = (math.radians(90), 0, math.radians(yaw + 90))   # head -> travel direction, face down
    hip = 0.95
    for f, p in path:
        dirn = d.normalized()
        key_loc(ch.rig, f, Vector(p) - dirn * hip)
    for side, s in (("Left", 1), ("Right", -1)):
        t = empty(f"reach{side}{ch.name}", (0, 0, 0))
        ch.bake_follow(t, "Head", n, offset=(s * 0.16, 0.55, 0.02), local=True)    # beyond the crown = ahead in flight
        hand_ik(ch, side, t)
    return ch


def doggy(name, loc, rot_z, tag=None, moving=None):
    """Dale on all fours (episode-2 pose) with a red collar. moving = [(frame, (x, y))] slides him along."""
    ch = load_char(name, loc, rot_z=rot_z, subdiv=True, tag=tag or name)
    pose(ch, ALL_FOURS)
    bpy.context.scene.frame_set(1)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: ch.world(b).z)
    settle(ch, knee, 0.06)
    carrier = empty("dogcarrier", (ch.rig.location.x, ch.rig.location.y, 0))
    bpy.context.scene.frame_set(1)
    for side in ("Left", "Right"):
        sh = ch.world(f"{side}Arm")
        p = empty(f"paw{side}", (sh.x, sh.y, 0.03)); p.parent = carrier
        p.location = (sh.x - carrier.location.x, sh.y - carrier.location.y, 0.03)
        hand_ik(ch, side, p)
    if moving:
        z = ch.rig.location.z
        for f, (x, y) in moving:
            key_loc(carrier, f, (x, y, 0), interp="LINEAR")
            key_loc(ch.rig, f, (x, y, z), interp="LINEAR")
    collar(ch)
    return ch


# ============================================================================ SETS
def window_panes(open_frames=None, closed=True):
    """Two casement panes in episode 1's bedroom window (right wall x=2.6, opening y 0..1.3 approx, z 0.9..2.3)."""
    frame_m = mat_flat("winframe", (0.92, 0.92, 0.9), rough=0.4)
    glass = mat_flat("winglass", (0.25, 0.3, 0.4), rough=0.05, alpha=0.1)
    if hasattr(glass, "surface_render_method"):
        glass.surface_render_method = "BLENDED"
    hinges = []
    for side, y in ((-1, -0.08), (1, 1.28)):
        h = empty(f"winhinge{side}", (2.55, y, 0.92))
        fr = box(f"pane_frame{side}", (0.04, 0.68, 1.36), (0, -side * 0.34, 0.68), frame_m); fr.parent = h
        gl = box(f"pane_glass{side}", (0.01, 0.6, 1.26), (0, -side * 0.34, 0.68), glass); gl.parent = h
        if open_frames:
            f0, f1 = open_frames
            key_rot(h, 1, (0, 0, 0)); key_rot(h, f0, (0, 0, 0)); key_rot(h, f1, (0, 0, side * -100))
        elif not closed:
            h.rotation_euler = (0, 0, math.radians(side * -100))
        hinges.append(h)
    return hinges


def dresser(loc=(-2.25, -0.6, 0), rot_z=90, drawer_open=None):
    """Chest of drawers against the left wall, front facing +X. drawer_open=(f0, f1) slides the top drawer out."""
    wood = mat_tex("dresser_wood", "wood_floor", scale=1.0, tint=(0.7, 0.5, 0.35))
    knob = mat_flat("knob", (0.85, 0.7, 0.35), metal=1.0, rough=0.3)
    root = empty("dresser", loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    b = box("dresser_body", (1.1, 0.5, 0.95), (0, 0.02, 0.475), wood, bevel=0.01); b.parent = root
    drawers = []
    for k, z in enumerate((0.78, 0.5, 0.22)):
        d = empty(f"drawer{k}", (0, 0, 0)); d.parent = root; d.location = (0, -0.25, z)
        fr = box(f"drawer_front{k}", (1.0, 0.03, 0.24), (0, -0.01, 0), wood, bevel=0.006); fr.parent = d
        bx = box(f"drawer_box{k}", (0.96, 0.44, 0.2), (0, 0.22, 0), mat_flat("drawer_in", (0.6, 0.45, 0.3))); bx.parent = d
        kn = cylinder(f"knob{k}", 0.018, 0.03, (0, -0.035, 0), knob, rot=(90, 0, 0), verts=12); kn.parent = d
        drawers.append(d)
    top = drawers[0]
    for k in range(3):
        bo = boxers(f"drawer_boxers{k}"); bo.parent = top
        bo.location = (-0.3 + k * 0.3, 0.2, 0.08); bo.rotation_euler = (math.radians(90), 0, math.radians(k * 25))
    if drawer_open:
        f0, f1 = drawer_open
        key_loc(top, 1, (0, -0.25, 0.78)); key_loc(top, f0, (0, -0.25, 0.78)); key_loc(top, f1, (0, -0.62, 0.78))
    return root, top


def bedroom_night(window_open=False, window_frames=None, with_dresser=True, drawer_open=None, clock=True, flip_at=None):
    ep1.bedroom_set()
    sky = bpy.data.objects["win_sky"].data.materials[0].node_tree.nodes["Principled BSDF"]
    sky.inputs["Emission Strength"].default_value = 0.7      # a darker night sky through the window
    sky.inputs["Emission Color"].default_value = (0.12, 0.2, 0.45, 1)
    moon = bpy.data.objects["moon"].data                    # sharper moonlight: no speckle at 4 samples
    moon.size = 0.15
    moon.energy *= 0.9
    window_panes(open_frames=window_frames, closed=not window_open)
    out = {}
    if with_dresser:
        out["dresser"], out["drawer"] = dresser(drawer_open=drawer_open)
    if clock:
        out["clock"] = digital_clock((-1.05, 1.82, 0.63), rot_z=-20, flip_at=flip_at)
    return out


def you_asleep():
    you = ep1.you_in_bed()
    return you


def house_exterior(night=True, chimney=True, kennel=False):
    """Single-storey suburban house with a flat roof and a brick chimney. Front facade at y=3.5, door at x=0."""
    if night:
        world_color((0.012, 0.018, 0.05), 0.55)
        moon = mat_flat("moon", (1, 1, 1), emit=(0.85, 0.9, 1.0), emit_strength=6)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=4.0, location=(-28, 70, 38)); mo = bpy.context.object
        mo.data.materials.append(moon); bpy.ops.object.shade_smooth()
        star = mat_flat("star", (1, 1, 1), emit=(1, 1, 1), emit_strength=8)
        rnd = random.Random(9)
        for i in range(160):
            a = rnd.uniform(-1.3, 1.3); e = rnd.uniform(0.25, 1.2)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.08, 0.18),
                                                  location=(90 * math.sin(a), 90 * math.cos(a) + 10, 90 * math.sin(e)))
            bpy.context.object.data.materials.append(star)
        sun(energy=0.7, rot=(55, 0, -150), color=(0.55, 0.65, 1.0))
        area("moonfill", (-4, -6, 6), (0, 4, 1.5), energy=900, size=6, color=(0.45, 0.55, 1.0))
    else:
        world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.0, rot_z=60)
        sun(energy=3.6, rot=(50, 0, 150), color=(1.0, 0.95, 0.87))
    ep2.ground("leafy_grass", size=300, scale=0.4)
    plane("path", (1.4, 6), (0, 0.5, 0.005), mat_tex("hpath", "rectangular_paving", scale=1.0), uv_scale=0.6)
    plane("street", (300, 7), (0, -6.5, 0.004), mat_tex("hstreet", "asphalt_02", scale=1.0), uv_scale=0.3)
    wall = mat_tex("hwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.9, 0.82))
    box("house", (9, 6, 3.0), (0, 6.5, 1.5), wall, uv_scale=0.4)
    box("roof", (9.4, 6.4, 0.2), (0, 6.5, 3.1), mat_flat("roofm", (0.25, 0.22, 0.22), rough=0.8))
    box("door", (1.0, 0.08, 2.1), (0, 3.47, 1.05), mat_flat("hdoor", (0.45, 0.12, 0.1), rough=0.4), bevel=0.02)
    glow = mat_flat("winglow", (1, 1, 1), emit=(1.0, 0.75, 0.45) if night else (0.6, 0.7, 0.85),
                    emit_strength=2.5 if night else 0.6)
    trim = mat_flat("trim", (0.95, 0.95, 0.95))
    for x in (-2.8, 2.8):
        box(f"win{x}", (1.4, 0.06, 1.3), (x, 3.47, 1.65), glow)
        box(f"wintrim{x}", (1.6, 0.08, 0.08), (x, 3.45, 1.0), trim)
    if chimney:
        brick = mat_tex("chbrick", "brick_wall_02", scale=1.0, tint=(0.9, 0.7, 0.6))
        box("chimney", (0.8, 0.8, 1.6), (2.4, 6.0, 3.95), brick, uv_scale=1.2)
        box("chimney_hole", (0.6, 0.6, 0.02), (2.4, 6.0, 4.76), mat_flat("hole", (0.01, 0.01, 0.01), rough=1))
    for i, x in enumerate((-7, 7.5, -12, 12)):
        ep1.blob_tree((x, 4 + i, 0), height=5.5, seed=i)
    model("street_lamp_01", (4.5, -2.6, 0), rot_z=90)
    if night:
        point("porch", (0, 3.0, 2.4), energy=60, color=(1.0, 0.75, 0.45), radius=0.2)
        point("lamp_glow", (4.5, -2.6, 4.2), energy=400, color=(1.0, 0.8, 0.5), radius=0.3)
    if kennel:
        kennel_prop((-2.8, 1.6, 0), rot_z=10)


def kennel_prop(loc, rot_z=0.0):
    root = empty("kennel", loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    wood = mat_tex("kwood", "wood_floor", scale=1.0, tint=(0.8, 0.45, 0.25))
    roofm = mat_flat("kroof", (0.6, 0.12, 0.08), rough=0.6)
    parts = [box("k_back", (1.5, 0.06, 1.1), (0, 0.85, 0.55), wood),
             box("k_left", (0.06, 1.7, 1.1), (-0.75, 0, 0.55), wood),
             box("k_right", (0.06, 1.7, 1.1), (0.75, 0, 0.55), wood),
             box("k_front_l", (0.45, 0.06, 1.1), (-0.53, -0.85, 0.55), wood),
             box("k_front_r", (0.45, 0.06, 1.1), (0.53, -0.85, 0.55), wood),
             box("k_front_t", (0.62, 0.06, 0.35), (0, -0.85, 0.93), wood),
             box("k_floor", (1.5, 1.7, 0.05), (0, 0, 0.025), mat_flat("kfloor", (0.05, 0.04, 0.03))),
             box("k_roof_l", (0.95, 1.9, 0.06), (-0.38, 0, 1.33), roofm, rot=(0, 35, 0)),
             box("k_roof_r", (0.95, 1.9, 0.06), (0.38, 0, 1.33), roofm, rot=(0, -35, 0))]
    for p in parts:
        p.parent = root
    plate = decal("kennel_plate", f"{D4}/kennel_dale.png", 0.62, (0, -0.89, 1.0), rot=(90, 0, 0)); plate.parent = root
    bowl = cylinder("bowl", 0.14, 0.07, (0.9, -1.2, 0.035), mat_flat("bowlm", (0.75, 0.75, 0.78), metal=0.9, rough=0.3))
    bowl.parent = root
    lbl = decal("bowl_label", f"{D4}/bowl_label.png", 0.16, (0.9, -1.341, 0.04), rot=(90, 0, 0)); lbl.parent = root
    post = cylinder("sign_post", 0.03, 1.2, (-1.4, -1.0, 0.6), mat_flat("spost", (0.3, 0.3, 0.32), metal=0.5)); post.parent = root
    sg = decal("beware", f"{D4}/sign_beware.png", 0.7, (-1.4, -1.035, 1.25), rot=(90, 0, 0)); sg.parent = root
    return root


def living_fireplace():
    ep1.interior_set()
    bpy.data.objects["vent_hole"].hide_render = True
    brick = mat_tex("fpbrick", "brick_wall_02", scale=1.0, tint=(0.85, 0.6, 0.5))
    box("fp_body", (1.8, 0.6, 1.4), (0.0, 2.6, 0.7), brick, uv_scale=1.5)
    box("fp_hole", (1.0, 0.62, 0.85), (0.0, 2.58, 0.47), mat_flat("fphole", (0.02, 0.018, 0.016), rough=1.0))
    box("fp_mantel", (2.0, 0.7, 0.1), (0.0, 2.6, 1.45), mat_flat("mantel", (0.3, 0.18, 0.1), rough=0.4))
    box("fp_flue", (1.0, 0.4, 1.8), (0.0, 2.75, 2.3), brick, uv_scale=1.5)
    sofa = model("Sofa_01", (-1.6, -0.6, 0), rot_z=60); fit(sofa, length=2.0)
    point("fp_glow", (0.0, 2.3, 0.4), energy=25, color=(1.0, 0.5, 0.2), radius=0.2)


def safe_prop(loc=(-2.05, -0.95, 0), rot_z=90, door_open=None, opened=False):
    """'UNDERWEAR VAULT': 1.0 w x 0.9 d x 1.4 h steel safe; front faces local -Y (rot_z=90 -> +X)."""
    steel = mat_flat("safe_steel", (0.28, 0.3, 0.33), rough=0.35, metal=0.8)
    root = empty("safe", loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    W, D, H = 1.0, 0.9, 1.4
    parts = [box("sf_back", (W, 0.08, H), (0, D / 2, H / 2), steel),
             box("sf_left", (0.08, D, H), (-W / 2, 0, H / 2), steel),
             box("sf_right", (0.08, D, H), (W / 2, 0, H / 2), steel),
             box("sf_top", (W, D, 0.08), (0, 0, H - 0.04), steel),
             box("sf_bottom", (W, D, 0.1), (0, 0, 0.05), steel),
             box("sf_inner", (W - 0.17, 0.02, H - 0.2), (0, D / 2 - 0.05, H / 2), mat_flat("sf_in", (0.08, 0.08, 0.09)))]
    for p in parts:
        p.parent = root
    # hinge on the local +X edge (world +Y when rot_z=90): the door swings open away from the -Y side cameras
    hinge = empty("sf_hinge", (0, 0, 0)); hinge.parent = root; hinge.location = (W / 2, -D / 2, 0)
    door = box("sf_door", (W, 0.1, H), (-W / 2, -0.05, H / 2), steel, bevel=0.02); door.parent = hinge
    dial = cylinder("sf_dial", 0.11, 0.05, (-W + 0.27, -0.12, H * 0.62), mat_flat("dial", (0.75, 0.75, 0.78), metal=1.0, rough=0.2),
                    rot=(90, 0, 0)); dial.parent = hinge
    hdl = box("sf_handle", (0.05, 0.06, 0.32), (-W + 0.27, -0.13, H * 0.4), mat_flat("hdl", (0.75, 0.75, 0.78), metal=1.0)); hdl.parent = hinge
    pl = decal("sf_plate", f"{D4}/safe_plate.png", 0.6, (-W / 2, -0.102, H * 0.88), rot=(90, 0, 0)); pl.parent = hinge
    nt = decal("sf_note", f"{D4}/note_code.png", 0.17, (-W / 2 + 0.22, -0.102, H * 0.62), rot=(90, 0, 3)); nt.parent = hinge
    if door_open:
        f0, f1 = door_open
        key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (0, 0, 105))
    elif opened:
        hinge.rotation_euler = (0, 0, math.radians(105))
    for k in range(3):
        bo = boxers(f"safe_boxers{k}"); bo.parent = root
        bo.location = (-0.25 + k * 0.25, 0.1, 0.12); bo.rotation_euler = (math.radians(90), 0, math.radians(k * 30))
    return root, hinge, dial


HAMPER = (1.4, 1.6)      # laundry hamper centre in the concrete room
H_RAD, H_TOP = 0.42, 0.7


def pose_seq(ch, keys, n, base=("137_41", 4200), name=None):
    """Animated pose: keys = [(frame, overrides), ...] (ASF dof names, degrees) eased with smoothstep between keys;
    the base CMU frame fills every other joint. Retargeted like pose(), one AMC frame per shot frame."""
    import mocap, tempfile
    clip, fr = base
    asf = f"{lib.CMU}/{clip.split('_')[0]}.asf"
    skel = mocap.parse_asf(asf)
    b0 = {k: list(v) for k, v in mocap.parse_amc(f"{lib.CMU}/{clip}.amc")[fr].items()}
    b0["root"] = b0["root"][:3] + [0.0, 0.0, 0.0]

    def apply(ov):
        f = {k: list(v) for k, v in b0.items()}
        for bone, vals in ov.items():
            dofs = ["tx", "ty", "tz", "rx", "ry", "rz"] if bone == "root" else skel["bones"][bone]["dof"]
            cur = f.get(bone, [0.0] * len(dofs))
            for k, v in vals.items():
                cur[dofs.index(k)] = v
            f[bone] = cur
        return f
    keyed = [(k, apply(ov)) for k, ov in keys]
    bones = set().union(*[set(f) for _, f in keyed])
    for _, f in keyed:
        for bn in bones:
            f.setdefault(bn, list(b0.get(bn, [0.0] * len(skel["bones"][bn]["dof"]))))
    nm = name or f"{ch.name}_pseq_{abs(hash(str(keys))) % 10**8}"
    p = os.path.join(tempfile.gettempdir(), nm + ".amc")
    with open(p, "w") as fh:
        fh.write(":FULLY-SPECIFIED\n:DEGREES\n")
        for i in range(1, n + 1):
            if i <= keyed[0][0]:
                f = keyed[0][1]
            elif i >= keyed[-1][0]:
                f = keyed[-1][1]
            else:
                for (ka, fa), (kb, fb) in zip(keyed, keyed[1:]):
                    if ka <= i <= kb:
                        t = (i - ka) / max(kb - ka, 1); t = t * t * (3 - 2 * t)
                        f = {bn: [x + (y - x) * t for x, y in zip(fa[bn], fb[bn])] for bn in fa}
                        break
            fh.write(f"{i}\n")
            for bn in skel["order"]:
                if bn in f:
                    fh.write(bn + " " + " ".join(f"{v:.4f}" for v in f[bn]) + "\n")
    act = mocap.retarget(ch.rig, asf, p, nm, step=1, in_place=True, face=False)
    ch.rig.animation_data_create()
    ch.rig.animation_data.action = act
    return act


def wicker_mat():
    m = bpy.data.materials.get("wicker_weave")
    if m:
        return m
    m = bpy.data.materials.new("wicker_weave"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.72
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (3.5, 3.5, 3.5)
    im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(f"{D4}/wicker.png", check_existing=True)
    im.extension = "REPEAT"; im.projection = "BOX"; im.projection_blend = 0.25
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.7; bump.inputs["Distance"].default_value = 0.01
    nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], im.inputs[0])
    nt.links.new(im.outputs[0], b.inputs["Base Color"]); nt.links.new(im.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def hamper(loc=HAMPER, rad=H_RAD, h=H_TOP, avoid=(), laundry=True):
    """Big round wicker laundry hamper with a hinged lid (hinge at the back, +Y). Returns the lid hinge empty
    (rotate it about X, negative = open). `avoid`: (x, y) spots the laundry heap must keep clear (faces)."""
    cx, cy = loc
    wm = wicker_mat()
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=rad * 0.86, radius2=rad, depth=h, end_fill_type="NOTHING",
                                    location=(cx, cy, h / 2))
    wall = bpy.context.object; wall.name = "hamper_wall"; wall.data.materials.append(wm)
    wall.modifiers.new("t", "SOLIDIFY").thickness = 0.022
    bpy.ops.object.shade_smooth()
    cylinder("hamper_base", rad * 0.86, 0.02, (cx, cy, 0.01), wm, verts=48)
    rim_m = mat_flat("hamper_rim", (0.26, 0.16, 0.08), rough=0.65)
    bpy.ops.mesh.primitive_torus_add(major_radius=rad + 0.004, minor_radius=0.022, major_segments=64, minor_segments=10,
                                     location=(cx, cy, h))
    rim = bpy.context.object; rim.name = "hamper_rim"; rim.data.materials.append(rim_m); bpy.ops.object.shade_smooth()
    hinge = empty("lid_hinge", (cx, cy + rad, h + 0.01))
    lid = cylinder("hamper_lid", rad * 1.05, 0.035, (0, -rad, 0.018), wm, verts=48); lid.parent = hinge
    bpy.ops.mesh.primitive_torus_add(major_radius=rad * 1.05, minor_radius=0.02, major_segments=64, minor_segments=10,
                                     location=(0, -rad, 0.02))
    lr = bpy.context.object; lr.name = "hamper_lidrim"; lr.data.materials.append(rim_m); bpy.ops.object.shade_smooth()
    lr.parent = hinge
    bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.009, location=(0, -2 * rad + 0.07, 0.05),
                                     rotation=(math.radians(90), 0, 0))
    kn = bpy.context.object; kn.name = "hamper_knob"; kn.data.materials.append(rim_m); kn.parent = hinge
    beta = 17.0
    rr = rad * (0.86 + 0.14 * (h - 0.15) / h) + 0.012
    decal("tag_laundry", f"{D4}/tag_laundry.png", 0.2,
          (cx + math.sin(math.radians(beta)) * rr, cy - math.cos(math.radians(beta)) * rr, h - 0.15), rot=(90, 0, beta))
    if laundry:
        lz = h - 0.07
        import bmesh
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=36, size=2 * rad, location=(cx, cy, lz - 0.045))
        bed = bpy.context.object; bed.name = "laundry_bed"
        bm = bmesh.new(); bm.from_mesh(bed.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.hypot(v.co.x, v.co.y) > rad * 0.95], context="VERTS")
        bm.to_mesh(bed.data); bm.free()
        tb = bpy.data.textures.get("laundry_bedn") or bpy.data.textures.new("laundry_bedn", "CLOUDS"); tb.noise_scale = 0.07
        dm = bed.modifiers.new("wr", "DISPLACE"); dm.texture = tb; dm.strength = 0.06; dm.texture_coords = "GLOBAL"
        bpy.ops.object.shade_smooth(); bed.data.materials.append(mat_flat("laundry_bed", (0.11, 0.11, 0.13), rough=0.95))
        cols = [(0.72, 0.72, 0.75), (0.16, 0.22, 0.48), (0.08, 0.08, 0.09), (0.55, 0.56, 0.6), (0.55, 0.08, 0.1),
                (0.85, 0.8, 0.7), (0.25, 0.36, 0.28)]
        tex = bpy.data.textures.get("laundry_wr") or bpy.data.textures.new("laundry_wr", "CLOUDS")
        tex.noise_scale = 0.05; tex.noise_depth = 2
        rnd = random.Random(11)
        placed = tries = 0
        while placed < 55 and tries < 1500:
            tries += 1
            sx, sy = rnd.uniform(0.13, 0.26), rnd.uniform(0.12, 0.2)
            reach = max(sx, sy) * 0.5
            a = rnd.uniform(0, 2 * math.pi); r = (rad * 0.97 - reach) * math.sqrt(rnd.random())
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            if any(math.hypot(x - ax, y - ay) - reach * 0.5 < 0.06 for ax, ay in avoid):
                continue
            bpy.ops.mesh.primitive_grid_add(x_subdivisions=20, y_subdivisions=20, size=1,
                                            location=(x, y, lz + rnd.uniform(-0.035, 0.02)))
            g = bpy.context.object; g.name = f"laundry{placed}"
            ph = rnd.uniform(0, 6.28); lobes = rnd.choice((2, 3, 5))
            def R(v):
                return 0.5 * (0.85 + 0.15 * math.sin(lobes * math.atan2(v.co.y, v.co.x) + ph))
            bm = bmesh.new(); bm.from_mesh(g.data)              # ragged round outline, not a square
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.hypot(v.co.x, v.co.y) > R(v)], context="VERTS")
            for v in bm.verts:                                  # soft mound, edges droop to the heap everywhere
                q = min(math.hypot(v.co.x, v.co.y) / R(v), 1.0)
                v.co.z = (1.0 - q * q) ** 1.5
            bm.to_mesh(g.data); bm.free()
            g.scale = (sx, sy, rnd.uniform(0.05, 0.09))
            g.rotation_euler = (rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), rnd.uniform(0, math.pi))
            dmp = g.modifiers.new("wr", "DISPLACE"); dmp.texture = tex; dmp.strength = 0.045; dmp.texture_coords = "GLOBAL"
            g.modifiers.new("t", "SOLIDIFY").thickness = 0.008
            sd = g.modifiers.new("s", "SUBSURF"); sd.levels = 1; sd.render_levels = 1
            bpy.ops.object.shade_smooth()
            g.data.materials.append(boxers_mat() if placed % 7 == 3 else
                                    mat_flat(f"laundry_c{placed % len(cols)}", cols[placed % len(cols)], rough=0.93))
            placed += 1
    return hinge


def blanket_over(ch, xr, yr, mattress_z, fold_y, color=(0.3, 0.4, 0.72), res=0.025):
    """A duvet draped over a lying character: height field from the posed body (evaluated meshes), dilated and
    relaxed so it tents softly over the body, then hung over the mattress edges. Object space = world space."""
    import numpy as np
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    nx = int(round((xr[1] - xr[0]) / res)) + 1; ny = int(round((yr[1] - yr[0]) / res)) + 1
    H = np.full((ny, nx), mattress_z)
    for o in ch.meshes:
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co)
        M = np.array(oe.matrix_world); oe.to_mesh_clear()
        w = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
        ix = np.round((w[:, 0] - xr[0]) / res).astype(int); iy = np.round((w[:, 1] - yr[0]) / res).astype(int)
        ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny)
        np.maximum.at(H, (iy[ok], ix[ok]), w[ok, 2])

    def shift_max(A, k):
        P = np.pad(A, k, mode="edge"); out = A.copy()
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                out = np.maximum(out, P[k + dy:k + dy + A.shape[0], k + dx:k + dx + A.shape[1]])
        return out

    def blur(A):
        P = np.pad(A, 1, mode="edge")
        return sum(P[1 + dy:1 + dy + A.shape[0], 1 + dx:1 + dx + A.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0

    floor_ = shift_max(H, 2) + 0.03
    Z = floor_.copy()
    for _ in range(30):
        Z = np.maximum(blur(Z), floor_)
    for _ in range(3):
        Z = blur(Z)
    Z = np.maximum(Z, floor_ - 0.005)
    xs = xr[0] + np.arange(nx) * res; ys = yr[0] + np.arange(ny) * res
    xc = (xr[0] + xr[1]) / 2
    dx_out = np.clip(np.abs(xs - xc) - 0.565, 0, None)[None, :]
    dy_out = np.clip(0.33 - ys, 0, None)[:, None]
    Z = Z - 3.2 * (dx_out + dy_out)
    verts = [(float(xs[i]), float(ys[j]), float(Z[j, i])) for j in range(ny) for i in range(nx)]
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(ny - 1) for i in range(nx - 1)]
    me = bpy.data.meshes.new("duvet"); me.from_pydata(verts, [], faces); me.update()
    bl = bpy.data.objects.new("duvet", me); bpy.context.scene.collection.objects.link(bl)
    bpy.ops.object.select_all(action="DESELECT"); bl.select_set(True); bpy.context.view_layer.objects.active = bl
    tex = bpy.data.textures.new("duvet_wr", "CLOUDS"); tex.noise_scale = 0.12
    dd = bl.modifiers.new("wr", "DISPLACE"); dd.texture = tex; dd.strength = 0.012; dd.texture_coords = "GLOBAL"
    bl.modifiers.new("t", "SOLIDIFY").thickness = 0.02
    sd = bl.modifiers.new("s", "SUBSURF"); sd.levels = 1; sd.render_levels = 1
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new("duvet"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.92
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = fold_y
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
    mx.inputs["A"].default_value = (*color, 1); mx.inputs["B"].default_value = (0.92, 0.92, 0.95, 1)
    nt.links.new(tc.outputs["Object"], sp.inputs[0]); nt.links.new(sp.outputs["Y"], gt.inputs[0])
    nt.links.new(gt.outputs[0], mx.inputs["Factor"]); nt.links.new(mx.outputs["Result"], b.inputs["Base Color"])
    bl.data.materials.append(m)
    return bl


def bunker_exterior():
    world_hdri("kloofendal_43d_clear_puresky", strength=1.1, rot_z=40)
    ep2.ground("coast_sand_01", size=400, scale=0.35, tint=(0.85, 0.82, 0.75))
    conc = mat_tex("bunker_conc", "brushed_concrete", scale=1.0, tint=(0.9, 0.9, 0.88))
    box("bunker", (6, 6, 3.2), (0, 4.0, 1.6), conc, uv_scale=0.5, bevel=0.03)
    box("bk_door", (1.0, 0.1, 2.1), (0, 0.96, 1.05), mat_flat("bkdoor", (0.35, 0.37, 0.4), metal=0.7, rough=0.4), bevel=0.01)
    decal("bk_sign", f"{D4}/sign_bunker.png", 1.3, (1.6, 0.94, 1.75), rot=(90, 0, 0))
    for x in (-10, 12, -16):
        ep1.blob_tree((x, 9, 0), height=4.5, seed=x)
    sun(energy=3.8, rot=(48, 0, 150), color=(1.0, 0.95, 0.88))


def bunker_room(night=False, basket_open=None, basket_opened=False, avoid=(), laundry=True):
    """Inside the windowless concrete house: bed, lamp, laundry hamper at HAMPER."""
    world_color((0.05, 0.05, 0.06), 0.3)
    conc = mat_tex("broom_conc", "brushed_concrete", scale=1.0, tint=(0.8, 0.8, 0.78))
    plane("bfloor", (12, 12), (0, 0, 0), mat_tex("bfl", "concrete_floor_02", scale=1.0, tint=(0.75, 0.75, 0.72)), uv_scale=0.5)
    box("bw_back", (12, 0.2, 3.0), (0, 2.6, 1.5), conc, uv_scale=0.5)
    box("bw_left", (0.2, 12, 3.0), (-2.6, 0, 1.5), conc, uv_scale=0.5)
    box("bw_right", (0.2, 12, 3.0), (2.6, 0, 1.5), conc, uv_scale=0.5)
    plane("bceil", (12, 12), (0, 0, 3.0), mat_flat("bkceil", (0.5, 0.5, 0.5)), rot=(180, 0, 0))
    wood = mat_flat("bbed", (0.25, 0.2, 0.18), rough=0.6)
    box("bk_bed", (1.2, 2.1, 0.4), (-1.2, 1.3, 0.2), wood)
    box("bk_mattress", (1.1, 2.0, 0.2), (-1.2, 1.3, 0.5), mat_flat("bksheet", (0.85, 0.85, 0.9), rough=0.9), bevel=0.05)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(-1.2, 2.15, 0.65)); pw = bpy.context.object
    pw.scale = (1.4, 0.55, 0.35); pw.data.materials.append(mat_flat("bkpillow", (0.92, 0.92, 0.95))); bpy.ops.object.shade_smooth()
    cord = cylinder("bk_lamp_cord", 0.006, 0.9, (0.3, 0.9, 2.55), mat_flat("cord", (0.05, 0.05, 0.05)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0.3, 0.9, 2.05)); bulb = bpy.context.object
    bulb.data.materials.append(mat_flat("bulb", (1, 1, 1), emit=(1.0, 0.85, 0.6), emit_strength=0 if night else 12))
    for o in (cord, bulb):
        o.visible_shadow = False          # the light sits inside the bulb: no black blot on the ceiling
    cx, cy = HAMPER
    hinge = hamper(avoid=avoid, laundry=laundry)
    top, rad = H_TOP, H_RAD
    if basket_open:
        f0, f1 = basket_open
        key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (-112, 0, 0))
    elif basket_opened:
        hinge.rotation_euler = (math.radians(-112), 0, 0)
    if night:
        area("night_fill", (0, -2.0, 2.6), (0.6, 1.3, 0.5), energy=110, size=2.5, color=(0.45, 0.55, 1.0))
        point("clock_red", (-0.3, 1.95, 0.75), energy=2.5, color=(1.0, 0.2, 0.1), radius=0.3)
    else:
        point("bulb_light", (0.3, 0.9, 2.05), energy=420, color=(1.0, 0.85, 0.65), radius=0.15, shadow=True)
        area("bfill", (0, -3, 2.4), (0, 1.2, 1.0), energy=280, size=3)
    return (cx, cy, top, rad)


# ============================================================================ SHOTS
@shot
def sh01():
    """Every night at 3 AM, - bedside clock flips 2:59 -> 3:00 AM; you asleep behind it in the moonlight."""
    n = frames_of("sh01")
    bedroom_night(flip_at=at("sh01", 0.9))
    you = you_asleep()
    cam = Cam(lens=45, loc=(-0.55, 1.15, 0.85), target=(-1.05, 1.82, 0.7), dof=2.2)
    cam.key(1, loc=(-0.55, 1.15, 0.85))
    cam.key(n, loc=(-0.62, 1.32, 0.8))
    return n


@shot
def sh02():
    """two grown men fly - night sky over your house: Larry and Dale soar in, Superman-style, moon behind."""
    n = frames_of("sh02")
    house_exterior(night=True)
    larry = flyer("larry", n, [(1, (-9.0, -1.0, 6.5)), (n, (0.5, 2.2, 3.4))], tag="larry")
    flyer("dale", n, [(1, (-10.5, 0.2, 7.3)), (n, (-1.0, 2.8, 4.1))], tag="dale")
    cam = Cam(lens=28, loc=(2.6, -6.2, 2.0), target=(-3.0, 1.0, 5.0), clip_end=3000)
    larry.bake_follow(cam.tgt, "Hips", n, offset=(-0.6, 0.6, 0.0))       # pan with the flyers
    cam.key(1, loc=(2.6, -6.2, 2.0))
    cam.key(n, loc=(2.0, -5.0, 2.3))
    return n


@shot
def sh03():
    """through your bedroom window. - the window bursts open; they sail in over your bed."""
    n = frames_of("sh03")
    burst = 17                                         # Larry's head reaches the window around here
    bedroom_night(window_frames=(burst - 2, burst + 2))
    you = you_asleep()
    flyer("larry", n, [(1, (6.0, 0.4, 1.75)), (n, (0.2, 0.5, 1.95))], tag="larry")
    flyer("dale", n, [(1, (8.0, 0.8, 1.6)), (n, (1.3, 0.9, 1.75))], tag="dale")
    cam = Cam(lens=26, loc=(-1.9, -1.6, 1.5), target=(2.4, 0.6, 1.6))
    cam.key(1, loc=(-1.9, -1.6, 1.5))
    cam.key(n, loc=(-1.7, -1.3, 1.5), target=(1.0, 0.6, 1.6))
    cam.shake(burst, burst + 6, amp=0.02, freq=0.7)
    return n


def landed(name, loc, rot_z, n, tag, start=4200):
    ch = load_char(name, loc, rot_z=rot_z, subdiv=True, tag=tag)
    ch.clip("137_41", **src(n, start))
    return ch


@shot
def sh04():
    """LARRY from accounting - landed in your moonlit bedroom: hands on hips, superhero pose, creepy grin."""
    n = frames_of("sh04")
    bedroom_night(window_open=True)
    you_asleep()
    larry = landed("larry", (1.3, -0.9, 0), 230, n, "larry")
    face(larry, 1, CREEPY)
    cam = Cam(lens=30, loc=(0.6, -2.4, 1.0), target=(1.3, -0.9, 1.4))
    cam.key(1, loc=(0.6, -2.4, 1.0))
    cam.key(n, loc=(0.7, -2.1, 1.05))
    look_at(larry, cam.cam, 0.8)
    return n


@shot
def sh05():
    """and DALE from IT. - Dale lands beside him, same pose. The moon behind them."""
    n = frames_of("sh05")
    bedroom_night(window_open=True)
    you_asleep()
    larry = landed("larry", (1.3, -0.9, 0), 230, n, "larry")
    dale = landed("dale", (2.0, -0.35, 0), 230, n, "dale", start=4150)
    key_loc(dale.rig, 1, (2.0, -0.35, 0.6)); key_loc(dale.rig, 6, (2.0, -0.35, 0.0), interp="LINEAR")
    face(larry, 1, CREEPY); face(dale, 1, CREEPY)
    cam = Cam(lens=28, loc=(0.4, -2.8, 1.1), target=(1.6, -0.6, 1.45))
    cam.key(1, loc=(0.4, -2.8, 1.1))
    cam.key(n, loc=(0.55, -2.45, 1.12))
    cam.shake(6, 10, amp=0.015, freq=0.7)
    look_at(larry, cam.cam, 0.7); look_at(dale, cam.cam, 0.7)
    return n


@shot
def sh06():
    """They're here for one thing... - they tiptoe across the room toward your chest of drawers."""
    n = frames_of("sh06")
    bedroom_night(window_open=True)
    you_asleep()
    for nm, loc, start in (("larry", (0.9, -1.0, 0), 60), ("dale", (1.6, -0.5, 0), 120)):
        ch = load_char(nm, loc, rot_z=-80, subdiv=True, tag=nm)
        ch.clip("07_01", **src(n, start, speed=0.55, in_place=False))
        face(ch, 1, CREEPY_ENJOY)
    cam = Cam(lens=26, loc=(-1.85, -1.75, 1.35), target=(0.9, -0.5, 1.25))   # from the dresser: they creep toward us
    cam.key(1, loc=(-1.85, -1.75, 1.35))
    cam.key(n, loc=(-1.95, -1.9, 1.35), target=(0.3, -0.6, 1.25))
    return n


def sniffers(n, drawer=None):
    """Larry and Dale at the open top drawer, each sniffing a pair of heart boxers."""
    out = bedroom_night(window_open=True, drawer_open=drawer)
    larry = load_char("larry", (-1.35, -0.85, 0), rot_z=-95, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 600))
    dale = load_char("dale", (-1.3, -0.25, 0), rot_z=-80, subdiv=True, tag="dale")
    dale.clip("137_41", **src(n, 1000))
    for ch, dx in ((larry, -0.05), (dale, 0.05)):
        bo = boxers(f"sniff_{ch.name}")
        hold(ch, bo, "Right", loc=(0.0, 0.09, 0.04), rot=(0, 0, 0))
        hh = ch.world("Head", frame=1)
        hand_ik(ch, "Right", empty(f"nose{ch.name}", (hh.x - 0.18, hh.y + dx, hh.z - 0.02)))
    return larry, dale


@shot
def sh07():
    """your UNDERWEAR. - the top drawer slides open; both bury their noses in your heart boxers, eyes closed."""
    n = frames_of("sh07")
    larry, dale = sniffers(n, drawer=(1, 6))
    for ch in (larry, dale):
        face(ch, 1, CREEPY_ENJOY); face(ch, 8, SNIFF)
    cam = Cam(lens=30, loc=(-2.05, -1.65, 1.7), target=(-1.35, -0.55, 1.4))   # beside the dresser: faces + drawer
    cam.key(1, loc=(-2.05, -1.65, 1.7))
    cam.key(n, loc=(-2.0, -1.5, 1.65))
    return n


@shot
def sh08():
    """So you lock the window. - you (pyjamas) snap a padlock onto the window latch, determined."""
    n = frames_of("sh08")
    bedroom_night(window_open=False)
    you = load_char("you_night", (2.05, 0.6, 0), rot_z=90, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    latch = (2.5, 0.6, 1.5)
    lockm = mat_flat("padlock", (0.75, 0.62, 0.2), metal=1.0, rough=0.25)
    pl = empty("padlock", latch)
    box("pl_body", (0.03, 0.08, 0.09), (0, 0, -0.03), lockm, bevel=0.008).parent = pl
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.007, location=(0, 0, 0.03), rotation=(math.radians(90), 0, math.radians(90)))
    t = bpy.context.object; t.data.materials.append(mat_flat("shackle", (0.8, 0.8, 0.82), metal=1.0, rough=0.2)); t.parent = pl
    key_scale(pl, 1, 0.01); key_scale(pl, int(n * 0.45), 0.01); key_scale(pl, int(n * 0.5), 1.0)
    hand = empty("latchhand", (0, 0, 0))
    key_loc(hand, 1, (2.25, 0.45, 1.25)); key_loc(hand, int(n * 0.45), (2.45, 0.55, 1.5)); key_loc(hand, n, (2.3, 0.5, 1.35))
    hand_ik(you, "Right", hand)
    face(you, 1, DETERMINED)
    look_at(you, latch, 0.7)
    cam = Cam(lens=32, loc=(0.9, -0.6, 1.6), target=(2.3, 0.6, 1.45))
    cam.key(1, loc=(0.9, -0.6, 1.6))
    cam.key(n, loc=(1.1, -0.35, 1.58))
    return n


@shot
def sh09():
    """GENIUS! - pyjama hero shot: you, smug, low angle, the padlocked window behind you."""
    n = frames_of("sh09")
    bedroom_night(window_open=False)
    you = load_char("you_night", (1.9, 0.6, 0), rot_z=-90, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, SMUG)
    look_at(you, (-1.5, -2.5, 2.3), 0.7)
    cam = Cam(lens=30, loc=(1.15, 0.3, 1.0), target=(1.9, 0.6, 1.65))
    cam.key(1, loc=(1.15, 0.3, 1.0))
    cam.key(n, loc=(1.22, 0.32, 1.05))
    return n


@shot
def sh10():
    """But they come down the chimney instead. - up on your roof: Larry drops into the chimney, Dale right behind."""
    n = frames_of("sh10")
    house_exterior(night=True)
    larry = load_char("larry", (2.4, 6.0, 4.75), rot_z=0, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 4200))
    drop = int(n * 0.45)
    key_loc(larry.rig, 1, (2.4, 6.0, 4.78)); key_loc(larry.rig, drop, (2.4, 6.0, 4.78))
    key_loc(larry.rig, n, (2.4, 6.0, 2.6), interp="LINEAR")
    face(larry, 1, CREEPY_ENJOY)
    dale = load_char("dale", (3.2, 6.6, 3.2), rot_z=-50, subdiv=True, tag="dale")      # right of the chimney, facing it
    dale.clip("137_41", **src(n, 1000))
    face(dale, 1, CREEPY)
    look_at(dale, (2.4, 6.0, 4.9), 0.7)
    cam = Cam(lens=28, loc=(5.6, 2.4, 4.6), target=(2.6, 6.0, 4.6), clip_end=3000)
    cam.key(1, loc=(5.6, 2.4, 4.6))
    cam.key(n, loc=(5.3, 2.8, 4.4), target=(2.5, 6.0, 4.3))
    return n


def fireplace_pair(n, emerge=True):
    living_fireplace()
    larry = load_char("larry", (-0.25, 2.4, 0), rot_z=0, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 4200))
    dale = load_char("dale", (0.35, 2.35, 0), rot_z=0, subdiv=True, tag="dale")
    dale.clip("137_41", **src(n, 4150))
    if emerge:   # drop down the flue (hidden in the brick), land in the black hearth, step out
        for ch, x, y1, f in ((larry, -0.25, 2.1, 0), (dale, 0.25, 2.05, 3)):
            key_loc(ch.rig, 1, (x, 2.68, 1.3)); key_loc(ch.rig, 4 + f, (x, 2.68, 1.3))
            key_loc(ch.rig, 8 + f, (x, 2.68, 0.0), interp="LINEAR")
            key_loc(ch.rig, 16 + f, (x, y1, 0.0))
    else:
        larry.rig.location = (-0.25, 2.1, 0); dale.rig.location = (0.35, 2.05, 0)
    for ch in (larry, dale):
        sootify(ch, 0.8)
    return larry, dale


@shot
def sh11():
    """Covered in soot. - living room: they burst out of the fireplace in a black cloud, filthy, grinning."""
    n = frames_of("sh11")
    larry, dale = fireplace_pair(n, emerge=True)
    soot_cloud((0.0, 2.3, 0.45), n, start=7)
    for ch in (larry, dale):
        face(ch, 1, CREEPY)
    cam = Cam(lens=28, loc=(0.3, -0.35, 1.35), target=(0.0, 2.2, 1.05))
    cam.key(1, loc=(0.3, -0.35, 1.35))
    cam.key(n, loc=(0.25, -0.1, 1.35))
    cam.shake(8, 14, amp=0.02, freq=0.7)
    return n


@shot
def sh12():
    """HOLDING YOUR BOXERS. - sooty close-up: both raise a pair of heart boxers like a trophy."""
    n = frames_of("sh12")
    larry, dale = fireplace_pair(n, emerge=False)
    for ch, x in ((larry, -0.5), (dale, 0.6)):
        bo = boxers(f"trophy_{ch.name}")
        hold(ch, bo, "Right" if ch is larry else "Left", loc=(0.0, 0.09, 0.04), rot=(0, 0, 0))
        hand_ik(ch, "Right" if ch is larry else "Left", empty(f"raise{ch.name}", (x, 1.85, 1.95 if ch is dale else 1.75)))
        face(ch, 1, TADA)
    cam = Cam(lens=32, loc=(0.1, 0.25, 1.45), target=(0.05, 2.05, 1.55))
    cam.key(1, loc=(0.1, 0.25, 1.45))
    cam.key(n, loc=(0.1, 0.45, 1.45))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.7)
    return n


@shot
def sh13():
    """So you hide your underwear in a safe. - you stuff your boxers into the UNDERWEAR VAULT; the door swings shut."""
    n = frames_of("sh13")
    bedroom_night(window_open=False, with_dresser=False)
    sf, hinge, dial = safe_prop(door_open=None, opened=True)
    key_rot(hinge, 1, (0, 0, 105)); key_rot(hinge, int(n * 0.65), (0, 0, 105)); key_rot(hinge, n - 4, (0, 0, 0))
    you = load_char("you_night", (-0.95, -1.05, 0), rot_z=-90, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    bo = boxers("hide_boxers")
    hold(you, bo, "Right", loc=(0.0, 0.09, 0.04))
    t = empty("stuff", (0, 0, 0))
    key_loc(t, 1, (-1.15, -1.1, 1.2)); key_loc(t, int(n * 0.45), (-1.75, -0.95, 0.85)); key_loc(t, n, (-1.2, -1.05, 1.05))
    hand_ik(you, "Right", t)
    lib.hide_after(bo, int(n * 0.5))
    face(you, 1, DETERMINED)
    cam = Cam(lens=28, loc=(-1.15, -2.55, 1.55), target=(-1.5, -0.85, 1.0))   # your left side: profile + vault
    cam.key(1, loc=(-1.15, -2.55, 1.55))
    cam.key(n, loc=(-1.1, -2.3, 1.5))
    return n


@shot
def sh14():
    """CLEVER! - you pat the locked vault, smug."""
    n = frames_of("sh14")
    bedroom_night(window_open=False, with_dresser=False)
    safe_prop()
    you = load_char("you_night", (-1.15, -0.25, 0), rot_z=-60, subdiv=True)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SMUG)
    hand_ik(you, "Right", empty("pat", (-1.6, -0.6, 1.42)))
    cam = Cam(lens=26, loc=(-0.25, -1.65, 1.25), target=(-1.45, -0.6, 1.3))   # you + the vault in frame
    cam.key(1, loc=(-0.25, -1.65, 1.25))
    cam.key(n, loc=(-0.3, -1.5, 1.27))
    look_at(you, cam.cam, 0.6)
    return n


@shot
def sh15():
    """But Larry already knows the code. - Larry, ear to the vault door, spins the dial... click. Wink."""
    n = frames_of("sh15")
    bedroom_night(window_open=False, with_dresser=False)
    sf, hinge, dial = safe_prop(door_open=(n - 8, n))
    for f, r in ((1, 0), (10, 120), (18, -60), (26, 200), (n - 9, 200)):
        key_rot(dial, f, (90, r, 0))
    larry = load_char("larry", (-1.1, -1.25, 0), rot_z=-82, subdiv=True, tag="larry")   # at the dial, door swings away
    pose(larry, LEAN)
    hand_ik(larry, "Right", empty("dialhand", (-1.5, -1.18, 0.88)))
    face(larry, 1, CREEPY)
    face(larry, n - 10, WINK)
    cam = Cam(lens=32, loc=(-1.1, -2.7, 1.3), target=(-1.4, -1.05, 1.0))   # Larry's left: ear on the door
    cam.key(1, loc=(-1.1, -2.7, 1.3))
    cam.key(n, loc=(-1.05, -2.5, 1.28))
    return n


@shot
def sh16():
    """And Dale is already inside THE SAFE. - the vault door swings open: Dale, curled up inside, boxers on his head, sniffing."""
    n = frames_of("sh16")
    bedroom_night(window_open=False, with_dresser=False)
    sf, hinge, dial = safe_prop(door_open=(1, 8))
    dale = load_char("dale", (-2.1, -0.95, 0.1), rot_z=90, subdiv=True, tag="dale")
    pose(dale, SQUAT)
    settle(dale, "Hips", 0.6)
    hat = boxers("dale_hat"); on_bone(dale, hat, "Head", (0, 0.2, 0.0), rot=(-90, 0, 0))
    snf = boxers("dale_sniff")
    hold(dale, snf, "Right", loc=(0.0, 0.09, 0.04))
    hh = dale.world("Head", frame=1)
    hand_ik(dale, "Right", empty("dalenose", (hh.x + 0.18, hh.y, hh.z - 0.02)))
    face(dale, 1, SNIFF)
    face(dale, n - 12, dict(SNIFF, eyeBlinkLeft=0.0, eyeBlinkRight=0.0, eyeWideLeft=0.6, eyeWideRight=0.6))
    cam = Cam(lens=30, loc=(-0.55, -2.0, 1.4), target=(-2.0, -0.95, 0.85))
    cam.key(1, loc=(-0.55, -2.0, 1.4))
    cam.key(n, loc=(-0.75, -1.85, 1.35))
    return n


def yard(n, night=True):
    house_exterior(night=night, kennel=True)


@shot
def sh17():
    """So you get a guard dog. - front yard at night: kennel, BEWARE OF DOG, a full bowl. You, proud."""
    n = frames_of("sh17")
    yard(n)
    you = load_char("you_night", (-1.2, 0.6, 0), rot_z=20, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMILE)
    cam = Cam(lens=26, loc=(0.7, -2.1, 1.25), target=(-2.1, 1.2, 0.9))
    cam.key(1, loc=(0.7, -2.1, 1.25))
    cam.key(n, loc=(0.5, -1.8, 1.22))
    return n


@shot
def sh18():
    """PERFECT! - low angle: smug you, porch light behind."""
    n = frames_of("sh18")
    yard(n)
    you = load_char("you_night", (-1.2, 0.6, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, SMUG)
    look_at(you, (1.5, -3.0, 2.3), 0.7)
    point("you_key", (-0.6, -0.4, 2.0), energy=60, color=(1.0, 0.8, 0.6), radius=0.3)
    cam = Cam(lens=30, loc=(-0.85, -0.2, 1.05), target=(-1.2, 0.6, 1.65))
    cam.key(1, loc=(-0.85, -0.2, 1.05))
    cam.key(n, loc=(-0.88, -0.12, 1.08))
    return n


def dog_from_kennel(n, out_frames, y0=2.15):
    """Dale crawls out of the kennel (kennel at (-2.8, 1.6), door toward -Y). out_frames=None keeps him inside."""
    if out_frames is None:
        return doggy("dale", (-2.75, y0, 0), rot_z=10, tag="dale")
    f0, f1 = out_frames
    dale = doggy("dale", (-2.75, y0, 0), rot_z=10, tag="dale",
                 moving=[(1, (-2.75, y0)), (f0, (-2.75, y0)), (f1, (-2.62, 0.9)), (n, (-2.6, 0.82))])
    return dale


@shot
def sh19():
    """But the guard dog... - low on the kennel's dark doorway: DALE on the nameplate. Something stirs."""
    n = frames_of("sh19")
    yard(n)
    dale = dog_from_kennel(n, None, y0=2.3)          # deep in the dark kennel: just a shape and two eyes
    face(dale, 1, SERENE)
    face(dale, int(n * 0.6), dict(SERENE, eyeBlinkLeft=0.0, eyeBlinkRight=0.0, eyeWideLeft=0.8, eyeWideRight=0.8))
    cam = Cam(lens=30, loc=(-2.3, -1.2, 0.55), target=(-2.75, 0.75, 0.75))
    cam.key(1, loc=(-2.3, -1.2, 0.55))
    cam.key(n, loc=(-2.35, -0.85, 0.55))
    return n


@shot
def sh20():
    """is DALE. - he crawls out: red collar, tongue out, delighted. Good boy."""
    n = frames_of("sh20")
    yard(n)
    dale = dog_from_kennel(n, (1, int(n * 0.7)), y0=2.3)
    face(dale, 1, SERENE); face(dale, 6, DOGGY)
    point("kennel_rim", (-2.0, 0.2, 1.6), energy=50, color=(0.6, 0.7, 1.0), radius=0.4)
    cam = Cam(lens=32, loc=(-2.45, -0.75, 0.75), target=(-2.65, 0.85, 0.55))
    cam.key(1, loc=(-2.45, -0.75, 0.75))
    cam.key(n, loc=(-2.45, -0.6, 0.72))
    stare_at(dale, cam.cam, 4, 10)
    return n


@shot
def sh21():
    """Again. - your dead-eyed stare into the lens. Slow blink."""
    n = frames_of("sh21")
    yard(n)
    you = load_char("you_night", (-1.2, 0.6, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, DEADPAN)
    blink(you, [int(n * 0.5)])
    point("you_key", (-0.6, -0.4, 2.0), energy=60, color=(1.0, 0.8, 0.6), radius=0.3)
    cam = Cam(lens=50, loc=(-1.15, -0.45, 1.6), target=(-1.2, 0.6, 1.6))
    cam.key(1, loc=(-1.15, -0.45, 1.6))
    cam.key(n, loc=(-1.16, -0.3, 1.6))
    look_at(you, cam.cam, 0.9)
    return n


@shot
def sh22():
    """And Larry is walking him. - down the moonlit sidewalk: Larry strolls, Dale trots on all fours, leash taut."""
    n = frames_of("sh22")
    house_exterior(night=True)
    larry = load_char("larry", (-2.6, -2.35, 0), rot_z=-90, subdiv=True, tag="larry")
    larry.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    d = facing(-90)
    dale = doggy("dale", (-4.2, -2.6, 0), rot_z=-90, tag="dale",
                 moving=[(1, (-4.2, -2.6)), (n, (-4.2 + d.x * 2.0, -2.6 + d.y * 2.0))])
    face(larry, 1, SMUG); face(dale, 1, DOGGY)
    rope_between("leash", lambda: larry.world("RightHand"), lambda: dale.world("Neck") + Vector((0, 0, 0.02)), n)
    cam = Cam(lens=30, loc=(-2.6, -6.0, 1.3), target=(-3.2, -2.4, 0.9))
    larry.bake_follow(cam.tgt, "Hips", n, offset=(-0.7, 0.0, -0.2))     # track the pair down the sidewalk
    cam.key(1, loc=(-2.6, -6.0, 1.3))
    cam.key(n, loc=(-4.6, -6.0, 1.3))
    return n


@shot
def sh23():
    """So you stop wearing underwear. - next morning: you dump an armful of heart boxers into the trash can."""
    n = frames_of("sh23")
    house_exterior(night=False, chimney=True)
    can = model("metal_trash_can", (0.9, 1.4, 0), rot_z=10)
    kids = [o for o in can.children_recursive if o.type == "MESH"]           # the asset holds two cans + lids: keep one
    bpy.context.view_layer.update()
    c0 = sum((Vector(o.matrix_world.translation) for o in kids), Vector()) / max(1, len(kids))
    first = min(kids, key=lambda o: (o.matrix_world.translation - c0).length)
    for o in kids:
        if (o.matrix_world.translation - first.matrix_world.translation).length > 0.3:
            o.hide_render = True
    fit(can, height=0.95)
    you = load_char("you_casual", (-0.05, 1.05, 0), rot_z=-70, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    face(you, 1, DETERMINED); face(you, int(n * 0.6), SMILE)
    pile = empty("pile", (0, 0, 0))
    for k in range(4):
        bo = boxers(f"dump{k}"); bo.parent = pile
        bo.location = (k * 0.05 - 0.07, 0, k * 0.06); bo.rotation_euler = (math.radians(70), 0, math.radians(k * 40))
    key_loc(pile, 1, (0.55, 1.1, 1.25)); key_loc(pile, int(n * 0.4), (0.8, 1.35, 1.35))
    key_loc(pile, int(n * 0.75), (0.9, 1.4, 0.75), interp="LINEAR")
    for side in ("Left", "Right"):
        t = empty(f"carry{side}", (0, 0, 0)); t.parent = pile; t.location = (0.0, -0.12 if side == "Left" else 0.12, -0.05)
        hand_ik(you, side, t)
    cam = Cam(lens=28, loc=(2.6, -1.6, 1.55), target=(0.6, 1.3, 1.0))
    cam.key(1, loc=(2.6, -1.6, 1.55))
    cam.key(n, loc=(2.3, -1.3, 1.5))
    return n


@shot
def sh24():
    """MUCH BETTER! - you in jeans, sunny morning, smug low angle."""
    n = frames_of("sh24")
    house_exterior(night=False)
    you = load_char("you_casual", (0.0, 1.0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, dict(SMUG, mouthSmileRight=0.9))
    look_at(you, (1.5, -3.0, 2.3), 0.7)
    cam = Cam(lens=30, loc=(0.35, 0.15, 1.05), target=(0.0, 1.0, 1.68))
    cam.key(1, loc=(0.35, 0.15, 1.05))
    cam.key(n, loc=(0.3, 0.25, 1.08))
    return n


@shot
def sh25():
    """But now they SNIFF YOUR JEANS. - Larry and Dale crouched either side of you, noses at your jean pockets. You: dead inside."""
    n = frames_of("sh25")
    house_exterior(night=False)
    you = load_char("you_casual", (0.0, 1.0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, DEADPAN)
    blink(you, [int(n * 0.6)])
    bpy.context.scene.frame_set(1)
    hips = you.world("Hips")
    for nm, x, rz in (("larry", -0.45, 90), ("dale", 0.45, -90)):            # facing you, either side
        ch = load_char(nm, (x, 1.08, 0), rot_z=rz, subdiv=True, tag=nm)
        pose(ch, SQUAT)
        bpy.context.scene.frame_set(1)
        settle(ch, "Head", hips.z - 0.02)
        nose = empty(f"pocket{nm}", (math.copysign(0.14, x), 0.98, hips.z - 0.1))
        stare_at(ch, nose, 1, 2)
        face(ch, 1, SNIFF)
    cam = Cam(lens=28, loc=(0.25, -1.9, 1.15), target=(0.0, 1.0, 1.0))
    cam.key(1, loc=(0.25, -1.9, 1.15))
    cam.key(n, loc=(0.2, -1.6, 1.15))
    return n


@shot
def sh26():
    """So you move into a house with no windows, - a bare concrete cube in the middle of nowhere. One door. One sign."""
    n = frames_of("sh26")
    bunker_exterior()
    you = load_char("you_casual", (0.6, -0.2, 0), rot_z=10)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMILE)
    cam = Cam(lens=24, loc=(5.5, -9.0, 2.5), target=(0.0, 2.0, 1.6), clip_end=3000)
    cam.key(1, loc=(5.5, -9.0, 2.5))
    cam.key(n, loc=(3.5, -7.0, 1.9), target=(0.4, 1.5, 1.5))
    return n


@shot
def sh27():
    """no chimney, and no underwear. - inside the concrete room: both arms shoot up, victory."""
    n = frames_of("sh27")
    bunker_room(night=False)
    you = load_char("you_casual", (0.0, 0.2, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    for side, sx in (("Left", 1), ("Right", -1)):
        t = empty(f"cheer{side}", (0, 0, 0))
        key_loc(t, 1, (sx * 0.34, 0.12, 1.02))
        key_loc(t, 9, (sx * 0.52, 0.2, 1.96))
        key_loc(t, 16, (sx * 0.47, 0.18, 1.86))
        key_loc(t, 23, (sx * 0.53, 0.2, 1.97))
        key_loc(t, 31, (sx * 0.48, 0.18, 1.88))
        key_loc(t, n, (sx * 0.52, 0.2, 1.95))
        hand_ik(you, side, t)
    face(you, 1, SMILE)
    face(you, 7, TADA)
    cam = Cam(lens=26, loc=(0.4, -2.3, 1.4), target=(0.0, 0.5, 1.35))
    cam.key(1, loc=(0.4, -2.3, 1.4))
    cam.key(n, loc=(0.3, -1.95, 1.4))
    return n


@shot
def sh28():
    """Peace at last. - lights off, you asleep in the concrete room under a duvet, smiling. Slow push in."""
    n = frames_of("sh28")
    bunker_room(night=True)
    you = load_char("you_night", (0, 0, 0), subdiv=True)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-86), 0, 0)
    you.rig.location = (-1.2, 0.35, 0.72)
    face(you, 1, dict(SLEEP, mouthSmileLeft=0.5, mouthSmileRight=0.5))
    blanket_over(you, (-1.84, -0.56), (0.24, 1.7), 0.6, fold_y=1.56)
    point("moonless_fill", (-0.4, 1.6, 1.6), energy=18, color=(0.55, 0.65, 1.0), radius=0.3)
    cam = Cam(lens=30, loc=(0.35, -0.3, 1.75), target=(-1.2, 1.35, 0.72))
    cam.key(1, loc=(0.35, -0.3, 1.75), target=(-1.2, 1.35, 0.72))
    cam.key(n, loc=(-0.1, 0.65, 1.5), target=(-1.2, 1.8, 0.75))
    return n


@shot
def sh29():
    """But that night, - the clock again: 2:59... 3:00 AM."""
    n = frames_of("sh29")
    bunker_room(night=True)
    box("bk_stand", (0.4, 0.35, 0.55), (-0.3, 2.2, 0.275), mat_flat("bkstand", (0.2, 0.2, 0.2)))
    digital_clock((-0.3, 2.15, 0.55), rot_z=0, flip_at=at("sh29", 45.55))
    cam = Cam(lens=45, loc=(0.05, 1.45, 0.75), target=(-0.3, 2.1, 0.62), dof=2.0)
    cam.key(1, loc=(0.05, 1.45, 0.75))
    cam.key(n, loc=(-0.05, 1.6, 0.72))
    return n


@shot
def sh30():
    """you open your laundry basket - in your pyjamas, half asleep, you lean in and lift the hamper lid... freeze."""
    n = frames_of("sh30")
    lift = int(n * 0.45)
    cx, cy, top, rad = bunker_room(night=True)
    hinge = bpy.data.objects["lid_hinge"]
    key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, lift - 6, (0, 0, 0))
    key_rot(hinge, lift, (-40, 0, 0)); key_rot(hinge, lift + 6, (-112, 0, 0))
    you = load_char("you_night", (cx - 0.16, cy - rad - 0.25, 0), rot_z=180, subdiv=True)
    LEANX = {"lowerback": {"rx": 24}, "upperback": {"rx": 14}, "thorax": {"rx": 8}}
    UPRIGHT = {"lowerback": {"rx": -4}, "upperback": {"rx": 0}, "thorax": {"rx": 0}}
    pose_seq(you, [(1, LEANX), (lift - 4, LEANX), (lift + 5, UPRIGHT), (n, UPRIGHT)], n)
    t = empty("lidhand", (0, 0, 0))
    knob = (cx, cy - rad + 0.07, top + 0.07)
    key_loc(t, 1, knob); key_loc(t, lift - 6, knob)
    key_loc(t, lift, (cx, cy - 0.18, top + 0.5))
    key_loc(t, lift + 5, (cx - 0.08, cy - rad - 0.06, 1.3))
    key_loc(t, n, (cx - 0.08, cy - rad - 0.07, 1.33))
    hand_ik(you, "Right", t)
    face(you, 1, dict(SLEEP, eyeBlinkLeft=0.6, eyeBlinkRight=0.6))
    face(you, lift - 1, dict(SLEEP, eyeBlinkLeft=0.5, eyeBlinkRight=0.5))
    face(you, lift + 3, SHOCK)
    look_at(you, (cx, cy, top), 0.8)
    cam = Cam(lens=28, loc=(cx - 1.9, cy - 0.85, 0.98), target=(cx - 0.15, cy - 0.45, 0.88))
    cam.key(1, loc=(cx - 1.9, cy - 0.85, 0.98))
    cam.key(n, loc=(cx - 1.65, cy - 0.8, 0.96))
    return n


FACES_XY = [(HAMPER[0] - 0.12, HAMPER[1] - 0.05), (HAMPER[0] + 0.13, HAMPER[1] - 0.05)]
LOOK_UP = {"lowerneck": {"rx": -20}, "upperneck": {"rx": -16}}


def faces_in_basket(n):
    """You look down into the hamper: Larry's and Dale's heads poke up out of your laundry, hands on the rim."""
    cx, cy, top, rad = bunker_room(night=True, basket_opened=True, avoid=[(x, y - 0.05) for x, y in FACES_XY])
    point("basket_light", (cx, cy - 0.5, top + 0.95), energy=24, color=(0.65, 0.72, 1.0), radius=0.3)
    heads = []
    for nm, (hx, hy) in zip(("larry", "dale"), FACES_XY):
        ch = load_char(nm, (hx, hy, 0), rot_z=0, subdiv=True, tag=nm)
        pose(ch, LOOK_UP)
        bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
        ch.rig.location += Vector((hx, hy, top - 0.01)) - ch.world("Head")
        clip_below(ch, top - 0.16)        # whatever is buried under the laundry can't poke out through the wicker
        heads.append(ch)
    return (cx, cy, top), heads


@shot
def sh31():
    """and two faces smile up at you... - your POV down into the hamper: Larry and Dale in your laundry, grinning up."""
    n = frames_of("sh31")
    (cx, cy, top), (larry, dale) = faces_in_basket(n)
    cam = Cam(lens=30, loc=(cx, cy - 0.85, top + 1.05), target=(cx, cy - 0.04, top + 0.03))
    cam.key(1, loc=(cx, cy - 0.85, top + 1.05))
    cam.key(n, loc=(cx, cy - 0.7, top + 0.9))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 1.0)
        face(ch, 1, CREEPY)
        blink(ch, [int(n * 0.55) + (3 if ch is dale else 0)])
    return n


@shot
def sh32():
    """FRESH BATCH? - closer: both mouth it in unison, then hold the grin. (end)"""
    n = frames_of("sh32")
    (cx, cy, top), (larry, dale) = faces_in_basket(n)
    cam = Cam(lens=34, loc=(cx, cy - 0.52, top + 0.74), target=(cx, cy - 0.02, top + 0.07))
    cam.key(1, loc=(cx, cy - 0.52, top + 0.74))
    cam.key(n, loc=(cx, cy - 0.42, top + 0.62))
    syll = [(50.29, 50.55, 0.28, 0.1), (50.55, 50.87, 0.38, 0.0)]
    for ch in (larry, dale):
        look_at(ch, cam.cam, 1.0)
        face(ch, 1, CREEPY_ENJOY)
        lipsync(ch, lambda t: at("sh32", t), syll)
        face(ch, at("sh32", 51.0), CREEPY)
    return n
