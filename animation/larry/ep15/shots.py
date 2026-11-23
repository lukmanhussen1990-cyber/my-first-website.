"""Shot definitions for Episode 15 "Missing" (part 1): Dale has been missing for two days and it's the best two days
of your life... until Larry (still in his wedding dress from episode 14) bangs on your door, begging you to help find
his husband. The episode ends on the viewers' vote: help Larry, YES or NO? Dale stays missing.
Same pipeline as episodes 1-14 (imports the newest episode, 14 -> 13 -> ...). Costumes and props are scene objects
only; character files untouched. Smoothness rules from episodes 12-14: no finger close-ups, heads levelled, whole-body
motion through pivots, hand targets world-fixed or riding the moving pivot."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector, Euler
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_color,
                 sun, area, point, Cam, key_loc, key_rot)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep14 = _load("ep14shots", "ep14")         # newest episode (its chain: 13, 12, 11, ... 1)
ep13, ep12, ep11, ep10, ep9, ep7 = ep14.ep13, ep14.ep12, ep14.ep11, ep14.ep11.ep10, ep14.ep9, ep14.ep11.ep7
ep6, ep4, ep3, ep2, ep1 = ep14.ep6, ep14.ep11.ep4, ep14.ep3, ep14.ep2, ep14.ep1
from ep2shots import (SMILE, SMUG, CREEPY, UNEASY, DETERMINED, SHOCK, DEADPAN, TADA, SERENE, face, blink, look_at,
                      hand_ik, src, pose, settle, on_bone)  # noqa: E402
STERN, SLEEP = ep1.STERN, ep1.SLEEP
GRIN = ep6.GRIN
load_char, closeup, face_light = ep9.load_char, ep9.closeup, ep9.face_light
look_keys, sit_level = ep12.look_keys, ep12.sit_level
rocker, glue, rock, talk, hold, head = ep13.rocker, ep13.glue, ep13.rock, ep13.talk, ep13.hold, ep13.head
vis = ep14.vis

D15 = os.path.join(lib.SCRATCH, "ep15", "decals")
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


CRY = {"browInnerUp": 1.0, "mouthFrownLeft": 0.9, "mouthFrownRight": 0.9, "jawOpen": 0.35, "eyeSquintLeft": 0.6,
       "eyeSquintRight": 0.6, "mouthStretchLeft": 0.4, "mouthStretchRight": 0.4}
PUPPY = {"browInnerUp": 1.0, "eyeWideLeft": 0.6, "eyeWideRight": 0.6, "mouthPucker": 0.6, "mouthFrownLeft": 0.5,
         "mouthFrownRight": 0.5}
ANNOYED = dict(STERN, eyeSquintLeft=0.4, eyeSquintRight=0.4, mouthFrownLeft=0.6, mouthFrownRight=0.6)
BLISS = dict(SERENE, mouthSmileLeft=0.8, mouthSmileRight=0.8)
NECK = {"lowerneck": {"rx": 18}, "upperneck": {"rx": 16}}


# ============================================================================ characters & crying
def you_char(loc=(0, 0, 0), rot_z=0.0, sd=True):
    return load_char("you_casual", loc, rot_z=rot_z, subdiv=sd, tag="you")


def larry_char(loc=(0, 0, 0), rot_z=0.0, sd=True):
    """Larry, still in his wedding dress from episode 14."""
    return ep14.larry_char(loc, rot_z=rot_z, sd=sd, dress=True)


def dale_char(loc=(0, 0, 0), rot_z=0.0, sd=True):
    return load_char("dale", loc, rot_z=rot_z, subdiv=sd, tag="dale")


def idle(ch, n, start=3700):
    """Standing idle. 137_28 from 3700 keeps the head facing forward (within 3 degrees) for 90 frames; the 2400 range
    used before turns the head 90 degrees to one side."""
    ch.clip("137_28", **src(n, start))


def tears(ch, n, drops=4, life=11, seed=1):
    """Cartoon fountain tears: little drops arc out of both eyes and fall, looping (baked world positions)."""
    m = mat_flat("tear", (0.55, 0.8, 1.0), rough=0.05, emit=(0.5, 0.75, 1.0), emit_strength=0.35)
    sc = bpy.context.scene
    sc.frame_set(1); bpy.context.view_layer.update()
    pb = ch.rig.pose.bones["Head"]
    M0 = ch.rig.matrix_world @ pb.matrix
    eye = M0.inverted() @ ep6.eye_point(ch)
    r = random.Random(seed)
    objs = []
    for side in (-1, 1):
        for k in range(drops):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.011)
            d = bpy.context.object; d.name = f"tear_{ch.name}_{side}_{k}"; d.scale = (1.0, 1.0, 1.4)
            d.data.materials.append(m); bpy.ops.object.shade_smooth(); d.visible_shadow = False
            objs.append((d, side, k * life / drops + r.uniform(0, 2)))
    for f in range(1, n + 1):
        sc.frame_set(f)
        M = ch.rig.matrix_world @ ch.rig.pose.bones["Head"].matrix
        R = M.to_3x3().normalized()
        fwd, lat = R.col[2], R.col[0]
        for d, side, ph in objs:
            t = ((f + ph) % life) / life
            e = M @ Vector((eye.x + side * 0.031, eye.y - 0.012, eye.z))
            p = e + fwd * (0.07 * t) + lat * (side * 0.05 * t) + Vector((0, 0, 0.05 * t - 0.42 * t * t))
            d.location = p; d.keyframe_insert("location", frame=f)
    sc.frame_set(1)
    return [o for o, _, _ in objs]


def sob(ch, f0, f1, every=4):
    """Crying face with a sobbing jaw."""
    face(ch, f0, CRY)
    for k, f in enumerate(range(f0, f1 + 1, every)):
        ch.expr(f, {"jawOpen": 0.5 if k % 2 == 0 else 0.18, "mouthStretchLeft": 0.55 if k % 2 == 0 else 0.3,
                    "mouthStretchRight": 0.55 if k % 2 == 0 else 0.3})


def crying_larry(larry, n, piv=None, amp=2.0, period=6):
    sob(larry, 1, n)
    tears(larry, n)
    if piv is not None:
        rock(piv, [(f, amp * math.sin(2 * math.pi * f / period)) for f in range(1, n + 1)])


def hide_bouquet():
    b = bpy.data.objects.get("bouquet")
    if b:
        for o in [b] + list(b.children_recursive):
            o.hide_render = True; o.hide_viewport = True


def hide_moustache(ch):
    for o in ch.meshes:
        if "moustache" in o.name.lower():
            o.hide_render = True; o.hide_viewport = True


def moustache_prop(name="stache_prop"):
    m = mat_flat("larrystache", (0.16, 0.12, 0.1), rough=0.8)
    root = empty(name)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=0.045, location=(s * 0.036, 0, 0))
        o = bpy.context.object; o.scale = (1.3, 0.35, 0.45); o.rotation_euler = (0, s * math.radians(12), 0)
        o.data.materials.append(m); bpy.ops.object.shade_smooth(); o.parent = root
    return root


def suitcase(name="suitcase"):
    root = empty(name)
    box(f"{name}_body", (0.46, 0.17, 0.34), (0, 0, -0.24), mat_flat("suitcasem", (0.45, 0.12, 0.35), rough=0.5), bevel=0.02).parent = root
    box(f"{name}_handle", (0.14, 0.03, 0.04), (0, 0, -0.05), mat_flat("suitcaseh", (0.08, 0.08, 0.08))).parent = root
    return root


def tissues(center, spread, n, seed=4, z=0.0):
    m = mat_flat("tissue", (0.97, 0.97, 0.96), rough=0.9)
    r = random.Random(seed)
    for k in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r.uniform(0.04, 0.065),
                                              location=(center[0] + r.uniform(-spread[0], spread[0]),
                                                        center[1] + r.uniform(-spread[1], spread[1]), z + 0.04))
        t = bpy.context.object; t.name = f"tissue{k}"; t.data.materials.append(m)
        t.rotation_euler = (r.uniform(0, 3), r.uniform(0, 3), r.uniform(0, 3))


# ============================================================================ sets
def street_day():
    ep11.day_street()


def poster():
    return decal("poster", f"{D15}/poster_missing.png", 0.42, (4.5, -2.69, 1.62), rot=(90, 0, 0))


def front_door():
    """Your front door (episode 11's house with the real doorway and hallway), the MOM'S mat removed.
    Returns the hinge: rotation +Z opens it inward (75 = open)."""
    h = ep11.moms_house()
    for nm in ("matmom",):
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    return h


def door_keys(h, keys):
    for f, a in keys:
        h.rotation_euler = (0, 0, math.radians(a)); h.keyframe_insert("rotation_euler", frame=max(1, f))


def bedroom():
    ep4.bedroom_night(window_open=False, with_dresser=False, clock=False)


def bathroom(curtain_keys=None):
    """Episode 10's bathroom plus a shower corner (tray, L-shaped rail, curtain) at the back left.
    curtain_keys = [(frame, open 0..1)]: the front curtain bunches to the left."""
    ep10.bathroom(show=False)
    tp = bpy.data.objects.get("tproll")
    if tp:
        tp.hide_render = True; tp.hide_viewport = True
    por = mat_flat("porcelain15", (0.95, 0.95, 0.96), rough=0.12)
    chrome = mat_flat("rail", (0.85, 0.86, 0.88), metal=1.0, rough=0.2)
    box("tray", (0.92, 0.92, 0.07), (-1.13, 1.33, 0.035), por, bevel=0.02)
    cylinder("rail_x", 0.012, 0.94, (-1.12, 0.86, 2.05), chrome, rot=(0, 90, 0), verts=12)
    cylinder("rail_y", 0.012, 0.94, (-0.65, 1.32, 2.05), chrome, rot=(90, 0, 0), verts=12)
    cm = mat_flat("curtain15", (0.25, 0.65, 0.75), rough=0.6)

    def curtain(name, w, axis):
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=4, size=1, location=(0, 0, 0))
        c = bpy.context.object; c.name = name
        c.scale = (w, 1.92, 1); bpy.ops.object.transform_apply(scale=True)
        for v in c.data.vertices:
            v.co.x += w / 2                                  # origin at the left edge
            v.co.z = 0.035 * math.sin(v.co.x * 34)
        c.rotation_euler = (math.radians(90), 0, 0 if axis == "x" else math.radians(-90))
        c.data.materials.append(cm); bpy.ops.object.shade_smooth()
        return c
    front = curtain("curtain_front", 0.92, "x"); front.location = (-1.58, 0.86, 1.07)
    side = curtain("curtain_side", 0.92, "y"); side.location = (-0.65, 0.86, 1.07)
    if curtain_keys:
        for f, u in curtain_keys:
            front.scale = (1.0 - 0.75 * u, 1, 1); front.keyframe_insert("scale", frame=max(1, f))
    return front


def living_room():
    """Your living room by day: episode 1's room with the bed cleared out, a couch against the back wall, a rug,
    a plant; the window on the right wall (x 2.6, y -0.1..1.3, sill 0.9) is the one Larry climbs through."""
    ep4.bedroom_night(window_open=False, with_dresser=False, clock=False)
    for nm in ("bed_frame", "headboard", "mattress", "pillow", "blanket"):
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    for nm in ("painted_wooden_nightstand", "desk_lamp_arm_01"):
        o = bpy.data.objects.get(nm)
        if o:
            for c in [o] + list(o.children_recursive):
                c.hide_render = True; c.hide_viewport = True
    world_color((0.55, 0.62, 0.75), 0.42)
    sky = bpy.data.objects["win_sky"].data.materials[0].node_tree.nodes["Principled BSDF"]
    sky.inputs["Emission Color"].default_value = (0.75, 0.88, 1.0, 1)
    sky.inputs["Emission Strength"].default_value = 2.2
    for nm, col, en in (("moon", (1.0, 0.93, 0.8), 950), ("fill", (1.0, 0.95, 0.88), 280), ("bedkey", (1.0, 0.95, 0.88), 140)):
        o = bpy.data.objects.get(nm)
        if o:
            o.data.color = col; o.data.energy = en
    lg = bpy.data.objects.get("lampglow")
    if lg:
        lg.data.energy = 0.0
    area("roomtop", (0, 0.6, 2.9), (0, 0.6, 0), energy=230, size=3.0, color=(1.0, 0.96, 0.9))
    fab = mat_flat("couchfab", (0.5, 0.24, 0.07), rough=0.85)
    box("couch_base", (2.1, 0.86, 0.3), (0, 2.18, 0.15), fab, bevel=0.03)
    for k, x in enumerate((-0.62, 0.0, 0.62)):
        box(f"couch_cush{k}", (0.6, 0.78, 0.17), (x, 2.14, 0.4), fab, bevel=0.05)
    box("couch_back", (2.1, 0.24, 0.6), (0, 2.52, 0.62), fab, bevel=0.05)
    for s in (-1, 1):
        box(f"couch_arm{s}", (0.2, 0.86, 0.64), (s * 1.05, 2.18, 0.32), fab, bevel=0.05)
    plane("rug", (2.6, 1.8), (0, 0.9, 0.006), mat_flat("rug", (0.55, 0.14, 0.12), rough=1.0))
    model("potted_plant_02", (-2.1, 2.3, 0), scale=1.1)
    return 0.49                                           # seat height


def couch_sit(ch, x):
    ch.rig.location = (x, 2.18, 0); ch.rig.rotation_euler = (0, 0, 0)
    sit_level(ch, 0.49)
    for side, dx in (("Left", 0.18), ("Right", -0.18)):                    # facing -Y: left is +X
        hold(ch, side, (x + dx, 1.86, 0.66), name=f"lap_{ch.name}_{side}")


# ============================================================================ SHOTS: peace
@shot
def sh01():
    """DALE has been missing for 2 DAYS. - a MISSING poster on the lamp post outside your house."""
    n = frames_of("sh01")
    street_day()
    poster()
    cam = Cam(lens=40, loc=(4.42, -3.75, 1.6), target=(4.5, -2.7, 1.6))
    cam.key(1, loc=(4.42, -3.75, 1.6)); cam.key(n, loc=(4.46, -3.35, 1.6))
    return n


@shot
def sh02():
    """And honestly? Best two days of your LIFE. - you on the front lawn, shades on, arms out to the sun."""
    n = frames_of("sh02")
    closeup()
    street_day()
    you = you_char((1.8, 0.3, 0), rot_z=0)
    idle(you, n)
    ep6.wear_shades(you)
    piv = rocker(you, at="floor")
    hy = head(you)
    for side, dx in (("Left", 0.72), ("Right", -0.72)):
        t = empty(f"arms_{side}", hy + Vector((dx, -0.08, -0.12)))
        key_loc(t, 1, hy + Vector((dx * 0.4, -0.05, -0.75))); key_loc(t, 10, hy + Vector((dx, -0.08, -0.08)))
        glue(t, piv)
        hand_ik(you, side, t)
    rock(piv, [(f, 1.5 * math.sin(f * 0.18)) for f in range(1, n + 1)])
    face(you, 1, SMILE); face(you, 10, BLISS)
    cam = Cam(lens=34, loc=(1.6, -2.3, 1.45), target=(1.8, 0.3, 1.3))
    cam.key(1, loc=(1.6, -2.3, 1.45)); cam.key(n, loc=(1.62, -2.0, 1.45))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh03():
    """No one in your window. - night: you asleep, smiling; the window beside the bed... empty."""
    n = frames_of("sh03")
    closeup()
    bedroom()
    you = ep4.you_asleep()
    face(you, 1, SLEEP)
    cam = Cam(lens=28, loc=(-1.5, -1.3, 1.65), target=(1.5, 0.75, 1.15))
    cam.key(1, loc=(-1.5, -1.3, 1.65)); cam.key(n, loc=(-1.35, -1.1, 1.62))
    return n


@shot
def sh04():
    """No one in your shower. - you yank the shower curtain open: nobody. You smile."""
    n = frames_of("sh04")
    closeup()
    f0, f1 = 8, 16
    front = bathroom(curtain_keys=[(1, 0.0), (f0, 0.0), (f1, 1.0)])
    you = you_char((-0.8, 0.32, 0), rot_z=180)
    idle(you, n)
    sc = bpy.context.scene
    edge = empty("curtain_edge")
    for f in range(1, n + 1):
        sc.frame_set(f)
        e = front.matrix_world @ Vector((0.92, 0, 0.05))
        edge.location = e + Vector((0.0, -0.08, 0)); edge.keyframe_insert("location", frame=f)
    sc.frame_set(1)
    hand_ik(you, "Left", edge)
    look_keys(you, empty("lookshower", (-1.15, 1.45, 1.35)), [(1, 0.6)])
    face(you, 1, UNEASY); face(you, f1 + 2, SMILE)
    cam = Cam(lens=26, loc=(-1.2, 1.62, 1.45), target=(-0.8, 0.3, 1.45))      # inside the (empty) shower
    cam.key(1, loc=(-1.2, 1.62, 1.45)); cam.key(n, loc=(-1.18, 1.58, 1.45))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh05():
    """Just PEACE. - you on a sun lounger on the lawn, shades on, eyes closed, a big contented sigh."""
    n = frames_of("sh05")
    closeup()
    street_day()
    you = you_char((1.8, 0.3, 0), rot_z=0)
    idle(you, n)
    piv = rocker(you, at="floor")
    hp = you.world("Hips", frame=1)
    for side, dx in (("Left", 0.2), ("Right", -0.2)):                      # facing -Y: left is +X
        hold(you, side, hp + Vector((dx, 0.02, 0.06)), piv=piv, name=f"peace_{side}")
    rock(piv, [(1, 0.0), (int(n * 0.45), -4.0), (n, -2.5)])                # a long, deep breath
    face(you, 1, dict(SERENE, eyeBlinkLeft=1.0, eyeBlinkRight=1.0, mouthSmileLeft=0.6, mouthSmileRight=0.6))
    cam = Cam(lens=32, loc=(1.45, -2.0, 1.2), target=(1.8, 0.3, 1.45))
    cam.key(1, loc=(1.45, -2.0, 1.2)); cam.key(n, loc=(1.5, -1.75, 1.22))
    face_light(cam, energy=25, size=1.0)
    return n


# ============================================================================ SHOTS: Larry at the door
@shot
def sh06():
    """Then someone BANGS on your door. - in the hallway: the front door shudders, BANG BANG; you jump."""
    n = frames_of("sh06")
    closeup()
    h = front_door()
    b0 = at("sh06", 10.86)
    ks = [(1, 0)]
    for k in range(4):
        f = b0 + k * 5
        ks += [(f - 1, 0), (f, 1.8), (f + 2, -0.4), (f + 4, 0)]
    door_keys(h, ks)
    you = you_char((0.15, 4.75, 0), rot_z=0)
    idle(you, n)
    piv = rocker(you, at="floor")
    rock(piv, [(1, 0), (b0 - 1, 0), (b0 + 2, -5), (b0 + 8, -3), (n, -3)])
    face(you, 1, SMILE); face(you, b0 + 1, SHOCK)
    cam = Cam(lens=24, loc=(0.25, 5.62, 1.6), target=(0.0, 3.5, 1.2))
    cam.key(1, loc=(0.25, 5.62, 1.6)); cam.key(n, loc=(0.22, 5.55, 1.58))
    return n


LARRY_PORCH = (0.0, 2.72)


def larry_on_porch(n, y=None, sd=True, x=None):
    larry = larry_char((x if x is not None else LARRY_PORCH[0], y if y is not None else LARRY_PORCH[1], 0), rot_z=180, sd=sd)
    idle(larry, n)
    piv = rocker(larry, at="floor")
    crying_larry(larry, n, piv)
    return larry, piv


@shot
def sh07():
    """It's LARRY. Crying. - the door swings open: Larry on the porch, sobbing, tears flying."""
    n = frames_of("sh07")
    closeup()
    h = front_door()
    door_keys(h, [(1, 0), (4, 0), (12, 75)])
    larry, piv = larry_on_porch(n, y=2.55)                                  # skirt clear of the closed door
    cam = Cam(lens=30, loc=(0.1, 4.68, 1.6), target=(0.0, 2.55, 1.32))       # your eyes (outside the door's swing)
    cam.key(1, loc=(0.1, 4.68, 1.6)); cam.key(n, loc=(0.08, 4.55, 1.58))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh08():
    """Still in his wedding dress. - framed by the doorway: Larry in the full white dress, veil, tiara, bouquet."""
    n = frames_of("sh08")
    closeup()
    h = front_door()
    door_keys(h, [(1, 75)])
    larry, piv = larry_on_porch(n)
    cam = Cam(lens=24, loc=(0.05, 4.6, 1.2), target=(0.0, 2.7, 0.9))
    cam.key(1, loc=(0.05, 4.6, 1.2)); cam.key(n, loc=(0.05, 4.4, 1.2))
    face_light(cam, energy=40, size=1.2)
    return n


@shot
def sh09():
    """"My husband is MISSING!" - close on Larry, wailing."""
    n = frames_of("sh09")
    closeup()
    h = front_door()
    door_keys(h, [(1, 75)])
    larry, piv = larry_on_porch(n)
    hl = head(larry)
    cam = Cam(lens=40, loc=(hl.x + 0.05, hl.y + 1.05, hl.z + 0.02), target=(hl.x, hl.y, hl.z - 0.05))
    cam.key(1, loc=(hl.x + 0.05, hl.y + 1.05, hl.z + 0.02)); cam.key(n, loc=(hl.x + 0.04, hl.y + 0.85, hl.z + 0.02))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh10():
    """"You have to help me find him!" - over your shoulder: Larry clutching your shirt, begging."""
    n = frames_of("sh10")
    closeup()
    h = front_door()
    door_keys(h, [(1, 75)])
    you = you_char((0.14, 3.92, 0), rot_z=0)
    idle(you, n)
    larry, piv = larry_on_porch(n, y=3.22, x=-0.06)
    hy = head(you)
    for side, dx in (("Left", -0.1), ("Right", 0.1)):                       # Larry faces +Y: left is -X
        t = empty(f"clutch_{side}", Vector((dx, hy.y - 0.16, hy.z - 0.32)))
        for k, f in enumerate(range(1, n + 1, 6)):
            key_loc(t, f, (dx, hy.y - 0.16 - (0.03 if k % 2 else 0.0), hy.z - 0.32))
        hand_ik(larry, side, t)
    look_keys(larry, you, [(1, 0.7)])
    face(you, 1, DEADPAN)
    hl = head(larry)
    cam = Cam(lens=34, loc=(-0.3, 4.95, 1.68), target=(hl.x, hl.y, hl.z - 0.1))   # past your other shoulder
    cam.key(1, loc=(-0.3, 4.95, 1.68)); cam.key(n, loc=(-0.28, 4.8, 1.66))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh11():
    """You close the door. - you swing the door shut in his crying face."""
    n = frames_of("sh11")
    closeup()
    h = front_door()
    f0, f1 = 6, 13
    door_keys(h, [(1, 75), (f0, 75), (f1, 0), (f1 + 2, 2.5), (f1 + 4, 0)])
    you = you_char((0.12, 4.25, 0), rot_z=0)
    idle(you, n)
    sc = bpy.context.scene
    edge = empty("door_edge")
    for f in range(1, n + 1):
        sc.frame_set(f)
        edge.location = h.matrix_world @ Vector((0.85, 0.08, 1.05)); edge.keyframe_insert("location", frame=f)
    sc.frame_set(1)
    hand_ik(you, "Left", edge)
    larry, piv = larry_on_porch(n)
    face(you, 1, DEADPAN)
    cam = Cam(lens=26, loc=(0.32, 5.6, 1.6), target=(0.0, 3.4, 1.25))
    cam.key(1, loc=(0.32, 5.6, 1.6)); cam.key(n, loc=(0.3, 5.5, 1.6))
    return n


# ============================================================================ SHOTS: the living room
@shot
def sh12():
    """He climbs in through the WINDOW. - Larry slides in head first over the sill, dress and all."""
    n = frames_of("sh12")
    closeup()
    living_room()
    larry = larry_char(sd=True)
    larry.hold("137_28", 2400)
    mover = empty("climb", (4.75, 0.6, 1.08))
    mover.rotation_euler = (math.radians(90), 0, math.radians(-90))
    larry.rig.parent = mover; larry.rig.location = (0, 0, 0); larry.rig.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    hd = larry.world("Head", frame=1)
    for side, dy in (("Left", -0.2), ("Right", 0.2)):                      # head toward -X, face down
        t = empty(f"reach_{side}", hd + Vector((-0.45, dy, -0.12)))
        glue(t, mover)
        hand_ik(larry, side, t)
    key_loc(mover, 1, (4.75, 0.6, 1.08)); key_loc(mover, n, (3.25, 0.6, 1.08))
    look_keys(larry, empty("lookcam12", (0.2, -0.9, 1.5)), [(1, 0.75)])
    sob(larry, 1, n)
    cam = Cam(lens=26, loc=(1.0, -0.55, 1.45), target=(2.55, 0.6, 1.12))
    cam.key(1, loc=(1.0, -0.55, 1.45)); cam.key(n, loc=(1.1, -0.45, 1.42))
    face_light(cam, energy=30, size=1.2)
    return n


YOU_LR = (-0.5, 0.55)        # you, standing in the living room facing +X
LARRY_LR = (0.42, 0.55)      # Larry facing -X


def standoff(n, kneel=True, larry_x=None, sd=True):
    living_room()
    you = you_char((YOU_LR[0], YOU_LR[1], 0), rot_z=90, sd=sd)
    idle(you, n)
    hp = you.world("Hips", frame=1)
    for side, dy in (("Left", 0.2), ("Right", -0.2)):                      # facing +X: left is +Y
        hold(you, side, hp + Vector((0.02, dy, 0.06)), name=f"hips_{side}")
    lx = larry_x if larry_x is not None else LARRY_LR[0]
    larry = larry_char((lx, LARRY_LR[1], 0), rot_z=-90, sd=sd)
    if kneel:
        pose(larry, dict(ep3.KNEEL, **NECK))
        knee = min(("LeftLeg", "RightLeg"), key=lambda b: larry.world(b).z)
        settle(larry, knee, 0.06)
    else:
        idle(larry, n)
    return you, larry


@shot
def sh13():
    """He gets on his knees. - side on: Larry drops to his knees, hands clasped, begging up at you."""
    n = frames_of("sh13")
    closeup()
    you, larry = standoff(n)
    hl = head(larry)
    for side, dy in (("Left", -0.04), ("Right", 0.04)):
        t = empty(f"beg_{side}", hl + Vector((-0.24, dy, -0.22)))
        for k, f in enumerate(range(1, n + 1, 6)):
            key_loc(t, f, hl + Vector((-0.24, dy, -0.22 + (0.04 if k % 2 else 0.0))))
        hand_ik(larry, side, t)
    look_keys(larry, you, [(1, 0.7)]); look_keys(you, larry, [(1, 0.6)])
    sob(larry, 1, n); tears(larry, n)
    face(you, 1, ANNOYED)
    cam = Cam(lens=30, loc=(0.0, -2.2, 1.2), target=(0.0, 0.55, 0.95))
    cam.key(1, loc=(0.0, -2.2, 1.2)); cam.key(n, loc=(0.0, -1.95, 1.18))
    face_light(cam, energy=30, size=1.2)
    return n


@shot
def sh14():
    """He hugs your leg. - Larry wraps himself round your leg; you try to shake him off."""
    n = frames_of("sh14")
    closeup()
    you, larry = standoff(n, larry_x=-0.1)
    ypiv = rocker(you, at="floor")
    rock(ypiv, [(f, 2.5 * math.sin(f * 0.9)) for f in range(1, n + 1)])
    shin = you.world("RightLeg", frame=1)
    for side, dy in (("Left", -0.13), ("Right", 0.13)):
        t = empty(f"hug_{side}", shin + Vector((0.02, dy, 0.18)))
        glue(t, ypiv)
        hand_ik(larry, side, t)
    look_keys(larry, empty("knee", shin + Vector((0, 0, 0.12))), [(1, 0.8)])
    sob(larry, 1, n); tears(larry, n)
    face(you, 1, ANNOYED)
    cam = Cam(lens=30, loc=(-0.1, -1.9, 1.05), target=(-0.25, 0.55, 0.75))
    cam.key(1, loc=(-0.1, -1.9, 1.05)); cam.key(n, loc=(-0.1, -1.7, 1.02))
    face_light(cam, energy=30, size=1.2)
    return n


def offer_card(larry, img, width=0.3, fwd=0.32, down=0.34, name="card"):
    """Larry holds a sheet up in front of his chest with both hands, facing you (-X)."""
    hl = head(larry)
    c = decal(name, img, width, hl + Vector((-fwd, 0, -down)), rot=(90, 0, -90))
    hgt = width * 1150 / 900
    for side, dy in (("Left", -0.12), ("Right", 0.12)):
        hold(larry, side, hl + Vector((-fwd + 0.03, dy, -down - hgt / 2 + 0.03)), name=f"{name}_{side}")
    return c


@shot
def sh15():
    """He offers you a RAISE. - over your shoulder: Larry holds up a PAY RAISE: +$1 per year."""
    n = frames_of("sh15")
    closeup()
    you, larry = standoff(n, kneel=False, larry_x=0.5)
    offer_card(larry, f"{D15}/raise.png", name="raise")
    look_keys(larry, you, [(1, 0.6)])
    sob(larry, 1, n); tears(larry, n)
    face(you, 1, DEADPAN)
    hl = head(larry)
    cam = Cam(lens=30, loc=(-1.25, 1.75, 1.5), target=(0.25, 0.55, 1.18))
    cam.key(1, loc=(-1.25, 1.75, 1.5)); cam.key(n, loc=(-1.1, 1.6, 1.48))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh16():
    """He offers you his CAR. - out front: Larry's tiny red car with a giant bow; Larry presents it, sobbing."""
    n = frames_of("sh16")
    closeup()
    street_day()
    car = ep6.Car("larrycar", "tiny", (0.75, 0.04, 0.04))
    car.root.location = (1.9, -4.35, 0)
    red = mat_flat("bow", (0.9, 0.05, 0.08), rough=0.4)
    bow = empty("bow", (0, 0, car.P["roof"] + 0.06)); bow.parent = car.root
    for s in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.05, location=(s * 0.16, 0, 0.12),
                                         rotation=(math.radians(90), math.radians(s * 25), 0))
        o = bpy.context.object; o.data.materials.append(red); o.parent = bow
    box("bowknot", (0.12, 0.12, 0.12), (0, 0, 0.08), red, bevel=0.03).parent = bow
    box("ribbon_x", (1.3, 0.1, 0.02), (0, 0, 0.0), red).parent = bow
    box("ribbon_y", (0.1, 1.3, 0.02), (0, 0, 0.0), red).parent = bow
    larry = larry_char((0.55, -3.35, 0), rot_z=180)
    idle(larry, n)
    hl = head(larry)
    for side, dx in (("Left", -0.6), ("Right", 0.6)):                      # facing +Y: left is -X
        t = empty(f"tada_{side}", hl + Vector((dx * 0.4, 0.05, -0.8)))
        key_loc(t, 1, hl + Vector((dx * 0.4, 0.05, -0.8))); key_loc(t, 9, hl + Vector((dx, 0.1, -0.15)))
        hand_ik(larry, side, t)
    sob(larry, 1, n); tears(larry, n)
    cam = Cam(lens=30, loc=(0.2, -0.7, 1.6), target=(1.2, -3.9, 1.0))
    cam.key(1, loc=(0.2, -0.7, 1.6)); cam.key(n, loc=(0.25, -1.0, 1.55))
    face_light(cam, energy=25, size=1.0)
    return n


@shot
def sh17():
    """He offers you... his MOUSTACHE. - close: bare upper lip, Larry holds out his moustache, trembling."""
    n = frames_of("sh17")
    closeup()
    you, larry = standoff(n, kneel=False, larry_x=0.5)
    hide_moustache(larry); hide_bouquet()
    hl = head(larry)
    st = moustache_prop()
    p0 = hl + Vector((-0.3, 0.0, -0.12))
    for k, f in enumerate(range(1, n + 1, 3)):
        key_loc(st, f, p0 + Vector((0, 0, 0.006 if k % 2 else -0.006)))
    st.rotation_euler = (0, 0, math.radians(-90))
    for side, dy in (("Left", -0.07), ("Right", 0.07)):
        t = empty(f"stache_{side}", p0 + Vector((0.02, dy, -0.04)))
        glue(t, st)
        hand_ik(larry, side, t)
    look_keys(larry, you, [(1, 0.6)])
    face(larry, 1, CRY); tears(larry, n, drops=3)
    cam = Cam(lens=45, loc=(hl.x - 1.05, hl.y - 0.3, hl.z + 0.0), target=(hl.x - 0.12, hl.y, hl.z - 0.1))
    cam.key(1, loc=(hl.x - 1.05, hl.y - 0.3, hl.z + 0.0)); cam.key(n, loc=(hl.x - 0.9, hl.y - 0.25, hl.z))
    face_light(cam, energy=35, size=1.0)
    return n


@shot
def sh18():
    """But here's the problem. - close on you: the smile goes; you think."""
    n = frames_of("sh18")
    closeup()
    you, larry = standoff(n, kneel=False, larry_x=0.5, sd=True)
    look_keys(you, empty("think", (YOU_LR[0] + 1.0, YOU_LR[1] - 0.8, 1.9)), [(1, 0.0), (8, 0.6)])
    face(you, 1, DEADPAN); face(you, 10, UNEASY); face(you, n, DETERMINED)
    hy = head(you)
    cam = Cam(lens=45, loc=(hy.x + 0.9, hy.y - 0.55, hy.z + 0.02), target=(hy.x, hy.y, hy.z - 0.04))
    cam.key(1, loc=(hy.x + 0.9, hy.y - 0.55, hy.z + 0.02)); cam.key(n, loc=(hy.x + 0.72, hy.y - 0.45, hy.z + 0.02))
    face_light(cam, energy=30, size=1.0)
    return n


# ============================================================================ SHOTS: the problem
@shot
def sh19():
    """If you help Larry, Dale comes back. FOREVER. - night: Dale under the street lamp outside, grinning, waving."""
    n = frames_of("sh19")
    closeup()
    ep4.house_exterior(night=True, chimney=True)
    point("lamplight", (4.5, -2.6, 3.05), energy=320, color=(1.0, 0.8, 0.5), radius=0.2, shadow=True)
    dale = dale_char((3.75, -2.15, 0), rot_z=0)
    idle(dale, n)
    hd = head(dale)
    t = empty("wave19")
    for k, f in enumerate(range(1, n + 1, 8)):
        key_loc(t, f, hd + Vector((-0.42 + (0.1 if k % 2 else 0.0), -0.08, 0.15)))
    hand_ik(dale, "Right", t)
    face(dale, 1, GRIN)
    cam = Cam(lens=34, loc=(3.45, -6.0, 1.35), target=(3.75, -2.15, 1.45))
    cam.key(1, loc=(3.45, -6.0, 1.35)); cam.key(n, loc=(3.5, -5.3, 1.4))
    face_light(cam, energy=30, size=1.0, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh20():
    """In your window. - from your bed: Dale's grinning face at the window, waving slowly."""
    n = frames_of("sh20")
    closeup()
    bedroom()
    dale = dale_char((3.0, 0.6, 0), rot_z=-90)
    idle(dale, n)
    hd = head(dale)
    t = empty("wave20")
    for k, f in enumerate(range(1, n + 1, 8)):
        key_loc(t, f, hd + Vector((-0.12, 0.38 + (0.08 if k % 2 else 0.0), 0.12)))
    hand_ik(dale, "Right", t)
    look_keys(dale, empty("lookbed", (0.3, 0.6, 1.2)), [(1, 0.6)])
    face(dale, 1, GRIN)
    cam = Cam(lens=34, loc=(0.4, 0.15, 1.35), target=(2.75, 0.62, 1.55))
    cam.key(1, loc=(0.4, 0.15, 1.35)); cam.key(n, loc=(0.75, 0.25, 1.4))
    face_light(cam, energy=60, size=1.0, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh21():
    """In your shower. - the shower curtain whips open: Dale, grinning."""
    n = frames_of("sh21")
    closeup()
    bathroom(curtain_keys=[(1, 0.0), (4, 0.0), (10, 1.0)])
    dale = dale_char((-1.05, 1.3, 0), rot_z=0)
    idle(dale, n)
    face(dale, 1, GRIN)
    look_keys(dale, empty("lookcam21", (-1.0, -1.2, 1.55)), [(1, 0.6)])
    cam = Cam(lens=30, loc=(-1.0, -1.2, 1.55), target=(-1.08, 1.2, 1.42))
    cam.key(1, loc=(-1.0, -1.2, 1.55)); cam.key(n, loc=(-1.0, -1.0, 1.53))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh22():
    """In your BED. - you wake up: Dale lying next to you on top of the covers, staring, grinning."""
    n = frames_of("sh22")
    closeup()
    bedroom()
    you = ep4.you_asleep()
    dale = dale_char()
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-86), 0, 0)
    dale.rig.location = (0.56, 0.08, 0.86)
    hy = head(you)
    look_keys(dale, empty("lookyou", hy), [(1, 0.85)])
    face(dale, 1, GRIN)
    face(you, 1, SLEEP); face(you, 8, SHOCK); blink(you, [5])
    look_keys(you, empty("lookdale", head(dale)), [(1, 0.0), (9, 0.55)])
    cam = Cam(lens=30, loc=(-1.2, 0.85, 1.5), target=(0.3, 1.75, 0.9))        # your side: you, then Dale's grin
    cam.key(1, loc=(-1.2, 0.85, 1.5)); cam.key(n, loc=(-1.05, 0.95, 1.45))
    face_light(cam, energy=50, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh23():
    """But if you don't help, Larry moves in. - Larry walks in through your front door, sobbing, suitcase in hand."""
    n = frames_of("sh23")
    closeup()
    h = front_door()
    door_keys(h, [(1, 75)])
    larry = larry_char((0.05, 1.7, 0), rot_z=180)
    larry.clip("07_01", **src(n, 60, speed=0.75, in_place=False))
    sc_ = suitcase()
    on_bone(larry, sc_, "RightHand", (0.0, 0.08, 0.0), rot=(0, 0, 0))
    sob(larry, 1, n); tears(larry, n)
    cam = Cam(lens=26, loc=(0.22, 5.62, 1.45), target=(0.0, 3.0, 1.1))
    cam.key(1, loc=(0.22, 5.62, 1.45)); cam.key(n, loc=(0.2, 5.6, 1.45))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh24():
    """And he NEVER stops crying. - your couch: Larry sobbing into his hands, tissues everywhere; you, dead-eyed."""
    n = frames_of("sh24")
    closeup()
    living_room()
    larry = larry_char()
    couch_sit(larry, 0.45)
    piv = rocker(larry)
    hl = head(larry)
    for side, dx in (("Left", 0.07), ("Right", -0.07)):
        for c in larry.rig.pose.bones[f"{side}ForeArm"].constraints:
            if c.type == "IK":
                larry.rig.pose.bones[f"{side}ForeArm"].constraints.remove(c)
        hold(larry, side, hl + Vector((dx, -0.17, -0.06)), piv=piv, name=f"face_{side}")
    crying_larry(larry, n, piv, amp=3.0, period=7)
    you = you_char()
    couch_sit(you, -0.5)
    face(you, 1, DEADPAN); blink(you, [30])
    look_keys(you, empty("lookcam24", (0.0, -1.0, 1.15)), [(1, 0.6)])
    tissues((0.2, 1.75), (0.9, 0.35), 14)
    tissues((0.55, 2.05), (0.3, 0.2), 6, seed=7, z=0.48)
    cam = Cam(lens=28, loc=(0.0, -1.05, 1.2), target=(0.0, 2.1, 0.85))
    cam.key(1, loc=(0.0, -1.05, 1.2)); cam.key(n, loc=(0.0, -0.8, 1.15))
    face_light(cam, energy=30, size=1.4)
    return n


# ============================================================================ SHOTS: the vote
@shot
def sh25():
    """So what do you do? - you, to the camera, a big shrug."""
    n = frames_of("sh25")
    closeup()
    living_room()
    you = you_char((0.0, 0.6, 0), rot_z=0)
    idle(you, n)
    hy = head(you)
    for side, dx in (("Left", 0.42), ("Right", -0.42)):
        t = empty(f"shrug_{side}")
        key_loc(t, 1, hy + Vector((dx * 0.45, -0.05, -0.78))); key_loc(t, 9, hy + Vector((dx, -0.22, -0.42)))
        key_loc(t, n, hy + Vector((dx, -0.24, -0.4)))
        hand_ik(you, side, t)
    face(you, 1, UNEASY)
    look_keys(you, empty("lookcam25", (0.0, -1.3, 1.55)), [(1, 0.7)])
    cam = Cam(lens=34, loc=(0.0, -1.35, 1.55), target=(0.0, 0.6, 1.35))
    cam.key(1, loc=(0.0, -1.35, 1.55)); cam.key(n, loc=(0.0, -1.15, 1.55))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh26():
    """Help Larry find Dale? - close on Larry: the biggest puppy eyes, hands clasped under his chin."""
    n = frames_of("sh26")
    closeup()
    living_room()
    larry = larry_char((0.0, 0.7, 0), rot_z=0)
    idle(larry, n)
    hide_bouquet()
    hl = head(larry)
    for side, dx in (("Left", 0.04), ("Right", -0.04)):
        hold(larry, side, hl + Vector((dx, -0.2, -0.24)), name=f"clasp_{side}")
    face(larry, 1, PUPPY)
    tears(larry, n, drops=2, life=16)
    look_keys(larry, empty("lookcam26", (0.0, -0.6, 1.5)), [(1, 0.7)])
    cam = Cam(lens=42, loc=(0.0, hl.y - 1.05, hl.z + 0.02), target=(0.0, hl.y, hl.z - 0.1))
    cam.key(1, loc=(0.0, hl.y - 1.05, hl.z + 0.02)); cam.key(n, loc=(0.0, hl.y - 0.85, hl.z + 0.02))
    face_light(cam, energy=35, size=1.0)
    return n


def couch_pair(n, shades=False):
    living_room()
    larry = larry_char()
    couch_sit(larry, 0.45)
    piv = rocker(larry)
    crying_larry(larry, n, piv, amp=2.5, period=7)
    you = you_char()
    couch_sit(you, -0.5)
    if shades:
        ep6.wear_shades(you)
    tissues((0.2, 1.75), (0.9, 0.35), 14)
    tissues((0.55, 2.05), (0.3, 0.2), 6, seed=7, z=0.48)
    return you, larry


@shot
def sh27():
    """or enjoy the peace... with a crying Larry on your couch? - you lounge in shades; Larry wails beside you."""
    n = frames_of("sh27")
    closeup()
    you, larry = couch_pair(n, shades=True)
    face(you, 1, BLISS)
    look_keys(larry, you, [(1, 0.5)])
    cam = Cam(lens=26, loc=(0.0, -1.25, 1.25), target=(0.0, 2.1, 0.85))
    cam.key(1, loc=(0.0, -1.25, 1.25)); cam.key(n, loc=(0.0, -1.0, 1.2))
    face_light(cam, energy=30, size=1.4)
    return n


@shot
def sh28():
    """Comment YES or NO. - you hold up two cards to the camera: a green YES and a red NO."""
    n = frames_of("sh28")
    closeup()
    living_room()
    you = you_char((0.0, 0.6, 0), rot_z=0)
    idle(you, n)
    hy = head(you)
    cw = 0.34
    ch_ = cw * 560 / 800
    for k, (img, dx, side) in enumerate(((f"{D15}/card_yes.png", -0.3, "Right"), (f"{D15}/card_no.png", 0.3, "Left"))):
        c = decal(f"card{k}", img, cw, (0, 0, 0), rot=(90, 0, 0))
        base = hy + Vector((dx, -0.4, -0.3))
        for j, f in enumerate(range(1, n + 1, 10)):
            key_loc(c, f, base + Vector((0, 0, 0.04 if (j + k) % 2 else 0.0)))
        t = empty(f"cardhand{k}", base + Vector((0, 0.03, -ch_ / 2 + 0.02)))
        glue(t, c)
        hand_ik(you, side, t)
    face(you, 1, SMILE)
    look_keys(you, empty("lookcam28", (0.0, -1.4, 1.5)), [(1, 0.7)])
    cam = Cam(lens=30, loc=(0.0, -1.45, 1.5), target=(0.0, 0.6, 1.35))
    cam.key(1, loc=(0.0, -1.45, 1.5)); cam.key(n, loc=(0.0, -1.3, 1.5))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh29():
    """PART 2 is up to you. - you and Larry on the couch, both slowly turn and stare into the lens."""
    n = frames_of("sh29")
    closeup()
    you, larry = couch_pair(n)
    camp = (0.0, -0.9, 1.15)
    look_keys(you, empty("lookcam29", camp), [(1, 0.0), (6, 0.0), (18, 0.75)])
    look_keys(larry, empty("lookcam29b", camp), [(1, 0.0), (8, 0.0), (20, 0.75)])
    face(you, 1, DEADPAN)
    cam = Cam(lens=28, loc=(0.0, -1.0, 1.15), target=(0.0, 2.1, 0.88))
    cam.key(1, loc=(0.0, -1.0, 1.15)); cam.key(n, loc=(0.0, -0.45, 1.05))
    face_light(cam, energy=30, size=1.4)
    return n
