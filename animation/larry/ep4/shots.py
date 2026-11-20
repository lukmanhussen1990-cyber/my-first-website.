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
def boxers(name="boxers"):
    """Heart-print boxer shorts; origin at the waistband centre, legs hang toward -Z."""
    m = bpy.data.materials.get("boxers_m") or lib.mat_image("boxers_m", f"{D4}/boxers_hearts.png", rough=0.8)
    root = empty(name, (0, 0, 0))
    wb = box(name + "_band", (0.34, 0.12, 0.05), (0, 0, -0.025), m, bevel=0.015, uv_scale=3.0); wb.parent = root
    for sx in (-1, 1):
        lg = cylinder(f"{name}_leg{sx}", 0.095, 0.24, (sx * 0.085, 0, -0.16), m, verts=16)
        lg.rotation_euler = (0, math.radians(sx * 8), 0); lib._cube_uv(lg, 3.0); lg.parent = root
    hip = box(name + "_seat", (0.34, 0.13, 0.12), (0, 0, -0.1), m, bevel=0.03, uv_scale=3.0); hip.parent = root
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
            out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
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


def soot_cloud(center, n, start=1, count=12, color=(0.08, 0.075, 0.07), seed=4):
    m = mat_flat("soot", color, rough=1.0, alpha=0.5)
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    rnd = random.Random(seed)
    for i in range(count):
        a = rnd.uniform(0, 6.28)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.25, location=center)
        d = bpy.context.object; d.data.materials.append(m); bpy.ops.object.shade_smooth()
        t0 = start + i % 4
        key_scale(d, 1, 0.01); key_scale(d, t0, 0.01); key_loc(d, t0, center)
        r = rnd.uniform(0.6, 1.4)
        key_scale(d, n, rnd.uniform(1.2, 2.2))
        key_loc(d, n, (center[0] + math.cos(a) * r, center[1] - abs(math.sin(a)) * r, center[2] + rnd.uniform(0.2, 1.0)))


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
    glass = mat_flat("winglass", (0.6, 0.7, 0.9), rough=0.05, alpha=0.25)
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
    hinge = empty("sf_hinge", (0, 0, 0)); hinge.parent = root; hinge.location = (-W / 2, -D / 2, 0)
    door = box("sf_door", (W, 0.1, H), (W / 2, -0.05, H / 2), steel, bevel=0.02); door.parent = hinge
    dial = cylinder("sf_dial", 0.11, 0.05, (W / 2 + 0.15, -0.12, H * 0.62), mat_flat("dial", (0.75, 0.75, 0.78), metal=1.0, rough=0.2),
                    rot=(90, 0, 0)); dial.parent = hinge
    hdl = box("sf_handle", (0.05, 0.06, 0.32), (W / 2 + 0.15, -0.13, H * 0.4), mat_flat("hdl", (0.75, 0.75, 0.78), metal=1.0)); hdl.parent = hinge
    pl = decal("sf_plate", f"{D4}/safe_plate.png", 0.6, (W / 2, -0.102, H * 0.88), rot=(90, 0, 0)); pl.parent = hinge
    nt = decal("sf_note", f"{D4}/note_code.png", 0.17, (W / 2 - 0.25, -0.102, H * 0.62), rot=(90, 0, 3)); nt.parent = hinge
    if door_open:
        f0, f1 = door_open
        key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (0, 0, -105))
    elif opened:
        hinge.rotation_euler = (0, 0, math.radians(-105))
    for k in range(3):
        bo = boxers(f"safe_boxers{k}"); bo.parent = root
        bo.location = (-0.25 + k * 0.25, 0.1, 0.12); bo.rotation_euler = (math.radians(90), 0, math.radians(k * 30))
    return root, hinge, dial


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


def bunker_room(night=False, basket_open=None, basket_opened=False):
    """Inside the windowless concrete house: bed, lamp, laundry basket at (1.4, 1.6)."""
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
    cylinder("bk_lamp_cord", 0.006, 0.9, (0.3, 0.9, 2.55), mat_flat("cord", (0.05, 0.05, 0.05)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(0.3, 0.9, 2.05)); bulb = bpy.context.object
    bulb.data.materials.append(mat_flat("bulb", (1, 1, 1), emit=(1.0, 0.85, 0.6), emit_strength=0 if night else 12))
    b = model("wicker_basket_01", (1.4, 1.6, 0), rot_z=0)
    fit(b, height=0.6)
    mn, mx = bbox(b)
    cx, cy, top = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mx.z
    rad = (mx.x - mn.x) / 2
    lid_h = empty("lid_hinge", (cx, cy + rad, top))
    lid = cylinder("lid", rad * 1.02, 0.04, (0, -rad, 0.02), mat_flat("lidm", (0.6, 0.45, 0.25), rough=0.7), verts=32)
    lid.parent = lid_h
    if basket_open:
        f0, f1 = basket_open
        key_rot(lid_h, 1, (0, 0, 0)); key_rot(lid_h, f0, (0, 0, 0)); key_rot(lid_h, f1, (-110, 0, 0))
    elif basket_opened:
        lid_h.rotation_euler = (math.radians(-110), 0, 0)
    tg = decal("tag_laundry", f"{D4}/tag_laundry.png", 0.3, (cx, mn.y - 0.005, top * 0.6), rot=(90, 0, 0))
    if night:
        area("night_fill", (0, -2.0, 2.6), (0.6, 1.3, 0.5), energy=110, size=2.5, color=(0.45, 0.55, 1.0))
        point("clock_red", (1.0, 1.3, 1.0), energy=4, color=(1.0, 0.2, 0.1), radius=0.3)
    else:
        point("bulb_light", (0.3, 0.9, 1.95), energy=420, color=(1.0, 0.85, 0.65), radius=0.15, shadow=True)
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
    flyer("larry", n, [(1, (-9.0, -1.0, 6.5)), (n, (0.5, 2.2, 3.4))], tag="larry")
    flyer("dale", n, [(1, (-10.5, 0.2, 7.3)), (n, (-1.0, 2.8, 4.1))], tag="dale")
    cam = Cam(lens=24, loc=(5.0, -9.0, 1.6), target=(-2.0, 2.0, 4.5), clip_end=3000)
    cam.key(1, loc=(5.0, -9.0, 1.6), target=(-4.0, 1.0, 5.0))
    cam.key(n, loc=(4.6, -8.4, 1.7), target=(0.0, 3.0, 3.5))
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
    cam = Cam(lens=26, loc=(-1.6, -2.4, 1.6), target=(0.2, -0.6, 1.1))
    cam.key(1, loc=(-1.6, -2.4, 1.6))
    cam.key(n, loc=(-1.4, -2.1, 1.55), target=(-0.4, -0.6, 1.1))
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
    cam = Cam(lens=34, loc=(-0.2, -1.9, 1.6), target=(-1.4, -0.55, 1.45))
    cam.key(1, loc=(-0.2, -1.9, 1.6))
    cam.key(n, loc=(-0.35, -1.65, 1.58))
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
    dale = load_char("dale", (3.4, 5.4, 3.2), rot_z=50, subdiv=True, tag="dale")
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
    if emerge:
        key_loc(larry.rig, 1, (-0.25, 2.6, -0.3)); key_loc(larry.rig, 8, (-0.25, 2.1, 0.0))
        key_loc(dale.rig, 1, (0.35, 2.6, -0.4)); key_loc(dale.rig, 11, (0.35, 2.05, 0.0))
    else:
        larry.rig.location = (-0.25, 2.1, 0); dale.rig.location = (0.35, 2.05, 0)
    for ch in (larry, dale):
        sootify(ch, 0.6)
    return larry, dale


@shot
def sh11():
    """Covered in soot. - living room: they burst out of the fireplace in a black cloud, filthy, grinning."""
    n = frames_of("sh11")
    larry, dale = fireplace_pair(n, emerge=True)
    soot_cloud((0.0, 2.2, 0.6), n, start=2)
    for ch in (larry, dale):
        face(ch, 1, CREEPY)
    cam = Cam(lens=28, loc=(0.4, -1.4, 1.35), target=(0.05, 2.1, 1.2))
    cam.key(1, loc=(0.4, -1.4, 1.35))
    cam.key(n, loc=(0.3, -0.9, 1.35))
    cam.shake(2, 10, amp=0.02, freq=0.7)
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
    bedroom_night(window_open=False)
    sf, hinge, dial = safe_prop(door_open=None, opened=True)
    key_rot(hinge, 1, (0, 0, -105)); key_rot(hinge, int(n * 0.65), (0, 0, -105)); key_rot(hinge, n - 4, (0, 0, 0))
    you = load_char("you_night", (-0.95, -0.7, 0), rot_z=-90, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    bo = boxers("hide_boxers")
    hold(you, bo, "Right", loc=(0.0, 0.09, 0.04))
    t = empty("stuff", (0, 0, 0))
    key_loc(t, 1, (-1.15, -0.95, 1.2)); key_loc(t, int(n * 0.45), (-1.75, -0.95, 0.85)); key_loc(t, n, (-1.2, -0.85, 1.05))
    hand_ik(you, "Right", t)
    lib.hide_after(bo, int(n * 0.5))
    face(you, 1, DETERMINED)
    cam = Cam(lens=28, loc=(0.6, -2.6, 1.55), target=(-1.6, -0.9, 0.9))
    cam.key(1, loc=(0.6, -2.6, 1.55))
    cam.key(n, loc=(0.4, -2.3, 1.5))
    return n


@shot
def sh14():
    """CLEVER! - you pat the locked vault, smug."""
    n = frames_of("sh14")
    bedroom_night(window_open=False)
    safe_prop()
    you = load_char("you_night", (-1.15, -0.25, 0), rot_z=-60, subdiv=True)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SMUG)
    hand_ik(you, "Right", empty("pat", (-1.6, -0.6, 1.42)))
    cam = Cam(lens=30, loc=(-0.3, -1.25, 1.05), target=(-1.2, -0.3, 1.6))
    cam.key(1, loc=(-0.3, -1.25, 1.05))
    cam.key(n, loc=(-0.38, -1.15, 1.08))
    look_at(you, cam.cam, 0.6)
    return n


@shot
def sh15():
    """But Larry already knows the code. - Larry, ear to the vault door, spins the dial... click. Wink."""
    n = frames_of("sh15")
    bedroom_night(window_open=False)
    sf, hinge, dial = safe_prop(door_open=(n - 8, n))
    for f, r in ((1, 0), (10, 120), (18, -60), (26, 200), (n - 9, 200)):
        key_rot(dial, f, (90, r, 0))
    larry = load_char("larry", (-1.1, -0.55, 0), rot_z=-100, subdiv=True, tag="larry")   # outside the door's swing
    pose(larry, LEAN)
    hand_ik(larry, "Right", empty("dialhand", (-1.5, -0.78, 0.88)))
    face(larry, 1, CREEPY)
    face(larry, n - 10, WINK)
    cam = Cam(lens=34, loc=(-0.45, -1.85, 1.3), target=(-1.35, -0.7, 1.05))
    cam.key(1, loc=(-0.55, -1.95, 1.3))
    cam.key(n, loc=(-0.65, -1.75, 1.28))
    return n


@shot
def sh16():
    """And Dale is already inside THE SAFE. - the vault door swings open: Dale, curled up inside, boxers on his head, sniffing."""
    n = frames_of("sh16")
    bedroom_night(window_open=False)
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
    larry = load_char("larry", (-0.9, -0.2, 0), rot_z=-100, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 4200))
    face(larry, 1, CREEPY_ENJOY)
    cam = Cam(lens=30, loc=(-0.5, -0.55, 1.35), target=(-2.0, -0.95, 0.95))
    cam.key(1, loc=(-0.5, -0.55, 1.35))
    cam.key(n, loc=(-0.75, -0.65, 1.28))
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
    cam = Cam(lens=26, loc=(1.6, -3.0, 1.5), target=(-2.0, 1.2, 1.0))
    cam.key(1, loc=(1.6, -3.0, 1.5))
    cam.key(n, loc=(1.3, -2.6, 1.5))
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


def dog_from_kennel(n, out_frames):
    """Dale crawls out of the kennel (kennel at (-2.8, 1.6), door toward -Y)."""
    f0, f1 = out_frames
    dale = doggy("dale", (-2.75, 1.85, 0), rot_z=10, tag="dale",
                 moving=[(1, (-2.75, 1.85)), (f0, (-2.75, 1.85)), (f1, (-2.62, 0.9)), (n, (-2.6, 0.82))])
    return dale


@shot
def sh19():
    """But the guard dog... - low on the kennel's dark doorway: DALE on the nameplate. Something stirs."""
    n = frames_of("sh19")
    yard(n)
    dale = dog_from_kennel(n, (n - 10, n + 30))
    face(dale, 1, SERENE)
    point("kennel_rim", (-2.0, 0.2, 1.6), energy=50, color=(0.6, 0.7, 1.0), radius=0.4)
    cam = Cam(lens=30, loc=(-2.3, -1.2, 0.55), target=(-2.75, 0.75, 0.75))
    cam.key(1, loc=(-2.3, -1.2, 0.55))
    cam.key(n, loc=(-2.35, -0.85, 0.55))
    return n


@shot
def sh20():
    """is DALE. - he crawls out: red collar, tongue out, delighted. Good boy."""
    n = frames_of("sh20")
    yard(n)
    dale = dog_from_kennel(n, (1, int(n * 0.7)))
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
    cam = Cam(lens=28, loc=(-1.0, -6.0, 1.3), target=(-2.5, -2.4, 0.9))
    cam.key(1, loc=(-1.0, -6.0, 1.3), target=(-3.0, -2.4, 0.9))
    cam.key(n, loc=(0.2, -6.0, 1.3), target=(-1.0, -2.4, 0.9))
    return n


@shot
def sh23():
    """So you stop wearing underwear. - next morning: you dump an armful of heart boxers into the trash can."""
    n = frames_of("sh23")
    house_exterior(night=False, chimney=True)
    can = model("metal_trash_can", (0.9, 1.4, 0), rot_z=10); fit(can, height=0.95)
    you = load_char("you_casual", (0.3, 1.2, 0), rot_z=-70, subdiv=True)
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
    for nm, x, rz in (("larry", -0.55, -90), ("dale", 0.55, 90)):
        ch = load_char(nm, (x, 1.05, 0), rot_z=rz, subdiv=True, tag=nm)
        pose(ch, SQUAT)
        bpy.context.scene.frame_set(1)
        settle(ch, "Head", hips.z - 0.05)
        nose = empty(f"pocket{nm}", (math.copysign(0.18, x), 1.05, hips.z - 0.08))
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
    """no chimney, and no underwear. - inside the concrete room, arms wide, delighted."""
    n = frames_of("sh27")
    bunker_room(night=False)
    you = load_char("you_casual", (0.0, 0.2, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    for side, dx in (("Left", 0.75), ("Right", -0.75)):
        hand_ik(you, side, empty(f"wide{side}", (dx, 0.1, 1.55)))
    face(you, 1, TADA)
    cam = Cam(lens=26, loc=(0.4, -2.3, 1.4), target=(0.0, 0.5, 1.3))
    cam.key(1, loc=(0.4, -2.3, 1.4))
    cam.key(n, loc=(0.3, -1.9, 1.4))
    return n


@shot
def sh28():
    """Peace at last. - lights off, you asleep in the concrete room, smiling."""
    n = frames_of("sh28")
    bunker_room(night=True)
    you = load_char("you_night", (0, 0, 0), subdiv=True)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-86), 0, 0)
    you.rig.location = (-1.2, 0.35, 0.72)
    face(you, 1, dict(SLEEP, mouthSmileLeft=0.5, mouthSmileRight=0.5))
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=30, y_subdivisions=30, size=1, location=(-1.2, 1.0, 0.82))
    bl = bpy.context.object; bl.scale = (1.15, 1.4, 1); bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new("bkbl", "CLOUDS"); tex.noise_scale = 0.25
    dd = bl.modifiers.new("d", "DISPLACE"); dd.texture = tex; dd.strength = 0.03
    bl.modifiers.new("s", "SOLIDIFY").thickness = 0.02; bpy.ops.object.shade_smooth()
    bl.data.materials.append(mat_flat("bkblanket", (0.35, 0.45, 0.75), rough=0.9))
    cam = Cam(lens=30, loc=(0.6, -0.9, 1.9), target=(-1.2, 1.4, 0.7))
    cam.key(1, loc=(0.6, -0.9, 1.9))
    cam.key(n, loc=(0.35, -0.5, 1.8))
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
    """you open your laundry basket - in your pyjamas, half asleep, you lift the lid."""
    n = frames_of("sh30")
    lift = int(n * 0.6)
    cx, cy, top, rad = bunker_room(night=True, basket_open=(lift - 8, lift + 4))
    you = load_char("you_night", (cx - 0.55, cy - 0.45, 0), rot_z=-125, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    t = empty("lidhand", (0, 0, 0))
    key_loc(t, 1, (cx - 0.3, cy - 0.35, 1.0)); key_loc(t, lift - 8, (cx, cy - rad * 0.9, top + 0.06))
    key_loc(t, lift + 4, (cx, cy - 0.05, top + 0.55)); key_loc(t, n, (cx - 0.05, cy - 0.1, top + 0.5))
    hand_ik(you, "Right", t)
    face(you, 1, dict(SLEEP, eyeBlinkLeft=0.6, eyeBlinkRight=0.6))
    face(you, lift + 6, SHOCK)
    look_at(you, (cx, cy, top), 0.8)
    cam = Cam(lens=28, loc=(cx - 1.8, cy - 1.7, 1.45), target=(cx - 0.2, cy - 0.1, 0.8))
    cam.key(1, loc=(cx - 1.8, cy - 1.7, 1.45))
    cam.key(n, loc=(cx - 1.55, cy - 1.45, 1.4))
    return n


def faces_in_basket(n):
    """POV down into the basket: Larry's and Dale's grinning faces poking up through your laundry."""
    cx, cy, top, rad = bunker_room(night=True, basket_opened=True)
    point("basket_light", (cx, cy - 0.3, top + 0.9), energy=25, color=(0.65, 0.72, 1.0), radius=0.3)
    heads = []
    for nm, dx, tilt in (("larry", -0.1, -78), ("dale", 0.11, -74)):
        ch = load_char(nm, (cx + dx, cy, 0), rot_z=0, subdiv=True, tag=nm)
        ch.clip("137_41", **src(n, 4200))
        ch.rig.rotation_euler = (math.radians(tilt), 0, 0)          # lying back: face up, body under the floor
        bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
        h = ch.world("Head")
        ch.rig.location += Vector((cx + dx, cy + 0.02, top - 0.1)) - h
        heads.append(ch)
    rnd = random.Random(7)
    cols = [(0.9, 0.9, 0.95), (0.3, 0.4, 0.8), (0.85, 0.2, 0.25), (0.25, 0.25, 0.27)]
    for k in range(14):
        a = rnd.uniform(0, 6.28); r = rad * rnd.uniform(0.55, 0.85)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.07, 0.11), location=(cx + math.cos(a) * r, cy + math.sin(a) * r, top - 0.12))
        g = bpy.context.object; g.scale = (1.3, 1.0, 0.5); bpy.ops.object.shade_smooth()
        g.data.materials.append(mat_flat(f"laundry{k}", cols[k % 4], rough=0.9))
    return (cx, cy, top), heads


@shot
def sh31():
    """and two faces smile up at you... - straight down into the basket: Larry and Dale, packed in your laundry, grinning up."""
    n = frames_of("sh31")
    (cx, cy, top), (larry, dale) = faces_in_basket(n)
    cam = Cam(lens=30, loc=(cx, cy - 0.12, top + 1.25), target=(cx, cy, top - 0.1))
    cam.key(1, loc=(cx, cy - 0.12, top + 1.25))
    cam.key(n, loc=(cx, cy - 0.1, top + 0.95))
    for ch in (larry, dale):
        stare_at(ch, cam.cam, 1, 3)
        face(ch, 1, CREEPY)
        blink(ch, [int(n * 0.55) + (3 if ch is dale else 0)])
    return n


@shot
def sh32():
    """FRESH BATCH? - closer: both mouth it in unison, then hold the grin. (end)"""
    n = frames_of("sh32")
    (cx, cy, top), (larry, dale) = faces_in_basket(n)
    cam = Cam(lens=34, loc=(cx, cy - 0.1, top + 0.85), target=(cx, cy, top - 0.1))
    cam.key(1, loc=(cx, cy - 0.1, top + 0.85))
    cam.key(n, loc=(cx, cy - 0.08, top + 0.68))
    syll = [(50.29, 50.55, 0.28, 0.1), (50.55, 50.87, 0.38, 0.0)]
    for ch in (larry, dale):
        stare_at(ch, cam.cam, 1, 2)
        face(ch, 1, CREEPY_ENJOY)
        lipsync(ch, lambda t: at("sh32", t), syll)
        face(ch, at("sh32", 51.0), CREEPY)
    return n
