"""Shot definitions for Episode 9 "Broke Back In" (Dale escaped from prison in a garbage truck; he and Larry chase you
to the police station, the police lock you up in maximum security for your safety... and they break back in).
Same pipeline as episodes 1-8: imports the newest episode's module chain (episode 8 -> 6 -> 4 -> 3 -> 2 -> 1) and
episode 7's prison block, prison exterior and bedroom; episode 6's car, episode 4's street/house, episode 1's police."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, model_copy, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep8 = _load("ep8shots", "ep8")           # newest episode (its chain: 6, 4, 3, 2, 1)
ep7 = _load("ep7shots", "ep7")           # prison block / prison exterior / bedroom with a door
ep6, ep4, ep3, ep2, ep1 = ep7.ep6, ep7.ep4, ep7.ep3, ep7.ep2, ep7.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, SHOCK, DEADPAN, TADA, SERENE, SLEEP,
                      face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at)  # noqa: E402
RAGE, STERN = ep1.RAGE, ep1.STERN
GRIN, SAD = ep6.GRIN, ep7.SAD
paint, glass, no_shadow, bake_mods, Car, DRIVE = ep6.paint, ep6.glass, ep6.no_shadow, ep6.bake_mods, ep6.Car, ep6.DRIVE
facing = ep4.facing

D1 = lib.DECALS
D7 = os.path.join(lib.SCRATCH, "ep7", "decals")
D9 = os.path.join(lib.SCRATCH, "ep9", "decals")
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


FLAGS = {"sd": False}


def load_char(name, loc=(0, 0, 0), rot_z=0.0, subdiv=False, tag=None):
    """Episode 4's loader (flat white tee on you_night); render subdivision only in close-ups (closeup())."""
    return ep4.load_char(name, loc, rot_z=rot_z, subdiv=bool(subdiv and FLAGS["sd"]), tag=tag)


def closeup():
    """Render subdivision for close-ups, except in MODE=fast (75% draft-final): not visible at that size, ~40% faster."""
    if os.environ.get("MODE") != "fast":
        FLAGS["sd"] = True


# ============================================================================ expressions
SCREAM = {"jawOpen": 1.0, "mouthFunnel": 0.3, "mouthStretchLeft": 0.55, "mouthStretchRight": 0.55,
          "mouthLowerDownLeft": 0.6, "mouthLowerDownRight": 0.6, "mouthUpperUpLeft": 0.45, "mouthUpperUpRight": 0.45,
          "browInnerUp": 1.0, "browOuterUpLeft": 0.8, "browOuterUpRight": 0.8, "eyeWideLeft": 1.0, "eyeWideRight": 1.0}
PANT = {"jawOpen": 0.5, "browInnerUp": 0.9, "eyeWideLeft": 0.7, "eyeWideRight": 0.7, "mouthStretchLeft": 0.3,
        "mouthStretchRight": 0.3}
PLAN = dict(SMUG, browOuterUpLeft=0.9, browOuterUpRight=0.6)


def scream(ch, n, f0=1):
    """Open-mouthed scream with a little jaw flutter so it reads as sound, not a frozen face."""
    for f in range(f0, n + 1, 4):
        face(ch, f, dict(SCREAM, jawOpen=1.0 if (f // 4) % 2 == 0 else 0.82))


# ============================================================================ motion: seamless loops
RUN = ("09_01", 0, 88)            # one stride of the CMU sprint (source frame 88 repeats frame 0's pose)
TRUDGE = ("132_45", 1031, 1330)   # one cycle of the exhausted slow walk


def loop_move(ch, n, clip, a, b, period, start, rot_z, phase=0):
    """Play source frames a..b of a clip as a seamless in-place loop (`period` output frames per cycle) and slide the
    rig along its heading at the clip's own pace, measured per character so the feet do not skate.
    Returns the ground speed in metres per frame."""
    spd = (b - a) / (lib.STEP * period)
    ch.rig.location = Vector(start)
    ch.rig.rotation_euler = (0, 0, math.radians(rot_z))
    ch.clip(clip, start=a, end=b + 1, speed=spd, in_place=False, name=f"{ch.name}_{clip}_free")
    p0, p1 = ch.world("Hips", frame=1), ch.world("Hips", frame=period + 1)
    v = Vector((p1.x - p0.x, p1.y - p0.y, 0.0)).length / period
    act = ch.clip(clip, start=a, end=b + 1, speed=spd, in_place=True, name=f"{ch.name}_{clip}_loop")
    for fc in act.fcurves:
        if not fc.data_path.startswith("pose.bones"):
            continue
        if phase:
            for kp in fc.keyframe_points:
                kp.co.x += phase
                kp.handle_left.x += phase
                kp.handle_right.x += phase
        fc.modifiers.new("CYCLES")
    s = Vector(start)
    key_loc(ch.rig, 1, s, interp="LINEAR")
    key_loc(ch.rig, n, s + facing(rot_z) * (v * (n - 1)), interp="LINEAR")
    bpy.context.scene.frame_set(1)
    return v


def frozen_run(ch, loc, rot_z, src_frame):
    """A single mid-stride frame of the sprint (the 'Let me explain' freeze)."""
    ch.rig.location = Vector(loc)
    ch.rig.rotation_euler = (0, 0, math.radians(rot_z))
    ch.hold(RUN[0], src_frame)


# ============================================================================ props
def banana_peel(name="peel"):
    root = empty(name)
    m = mat_flat("peelm", (0.95, 0.78, 0.16), rough=0.55)
    for k in range(4):
        a = math.radians(k * 90 + 20)
        p = box(f"{name}_{k}", (0.04, 0.012, 0.15), (0.045 * math.cos(a), 0.045 * math.sin(a), -0.045), m,
                rot=(35 * math.sin(a), -35 * math.cos(a), math.degrees(a) + 90), bevel=0.004)
        p.parent = root
    b = box(f"{name}_top", (0.06, 0.06, 0.05), (0, 0, 0.0), m, bevel=0.015); b.parent = root
    s = box(f"{name}_stem", (0.018, 0.018, 0.04), (0, 0, 0.04), mat_flat("peelstem", (0.25, 0.2, 0.08))); s.parent = root
    return root


def escapee(loc=(0, 0, 0), rot_z=0.0, subdiv=False, peel=True, dirty=0.28, tag="dale"):
    """Dale after the jailbreak: orange jumpsuit with his inmate number, grimy from the garbage truck, peel on head."""
    d = load_char("dale_jail", loc, rot_z=rot_z, subdiv=subdiv, tag=tag)
    ep2.chest_print(d, f"{D7}/inmate_no.png", width=0.2, name=f"inmate_{tag}")
    if dirty:
        ep4.sootify(d, dirty, skip=("eye", "body", "brow", "lash", "teeth", "tongue"))
    if peel:
        on_bone(d, banana_peel(f"peel_{tag}"), "Head", (0.02, 0.2, -0.01), rot=(-90, 0, 0))
    return d


def spot(name, loc, target, energy=1000, angle=60, blend=0.4, color=(1, 1, 1), shadow=True, radius=0.1):
    d = bpy.data.lights.new(name, "SPOT")
    d.energy = energy; d.spot_size = math.radians(angle); d.spot_blend = blend
    d.color = color; d.use_shadow = shadow; d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    o.location = Vector(loc)
    bpy.context.scene.collection.objects.link(o)
    lib.look_at(o, target)
    return o


def face_light(cam, energy=60, size=0.8, offset=(0.35, 0.35, 0.0), color=(0.85, 0.9, 1.0)):
    """Soft key light riding with the camera (child of the camera, shining where it looks): faces read at night."""
    d = bpy.data.lights.new("camkey", "AREA"); d.energy = energy; d.size = size; d.color = color
    o = bpy.data.objects.new("camkey", d); bpy.context.scene.collection.objects.link(o)
    o.parent = cam.cam; o.location = offset
    return o


def stamp(cam, img, f_hit, width=0.11, dist=0.25, y=-0.03):
    """A rubber stamp slammed onto the lens (card parented to the camera, scale punch at f_hit)."""
    d = decal("stamp", img, width, (0, 0, 0), rot=(0, 0, 0), alpha=True)
    d.parent = cam.cam
    d.location = (0.0, y, -dist)
    key_scale(d, 1, 0.0, interp="CONSTANT")
    key_scale(d, f_hit - 3, 0.0, interp="CONSTANT")
    key_scale(d, f_hit - 2, 2.3)
    key_scale(d, f_hit, 1.0)
    return d


def gavel_prop(name="gavel"):
    root = empty(name)
    w = mat_flat("gavelwood", (0.32, 0.16, 0.07), rough=0.35)
    cylinder(f"{name}_head", 0.038, 0.15, (0, 0, 0), w, rot=(0, 90, 0), verts=20).parent = root
    cylinder(f"{name}_handle", 0.011, 0.25, (0, -0.13, 0), w, rot=(90, 0, 0), verts=12).parent = root
    return root


def garbage_truck(name="gtruck", headlights=False):
    """City garbage truck: white cab, green compactor body with the CITY WASTE panel, rear hopper.
    Front faces +X; origin on the ground at the centre (7.4 m long, 2.5 m wide, 3.45 m tall). Returns (root, wheels)."""
    root = empty(name)
    green = paint("gt_green", (0.05, 0.34, 0.13), metal=0.2, rough=0.4)
    white = paint("gt_white", (0.9, 0.9, 0.88), metal=0.2, rough=0.35)
    dark = mat_flat("gt_dark", (0.03, 0.03, 0.035), rough=0.6)
    steel = mat_flat("gt_steel", (0.55, 0.56, 0.58), metal=0.8, rough=0.4)
    gl = glass("gt_glass", alpha=0.6, tint=(0.05, 0.07, 0.09))

    def part(nm, size, loc, m, bevel=0.0):
        o = box(f"{name}_{nm}", size, loc, m, bevel=bevel)
        o.parent = root
        return o
    part("chassis", (6.9, 1.5, 0.4), (0.0, 0, 0.72), dark)
    part("cab", (1.5, 2.4, 1.85), (2.85, 0, 1.75), white, bevel=0.08)
    part("cabroof", (1.35, 2.3, 0.14), (2.8, 0, 2.72), white, bevel=0.05)
    no_shadow(part("windshield", (0.04, 2.05, 0.72), (3.61, 0, 2.18), gl))
    for s in (-1, 1):
        no_shadow(part(f"sidewin{s}", (0.85, 0.03, 0.58), (2.95, s * 1.205, 2.18), gl))
        part(f"mirror{s}", (0.08, 0.1, 0.35), (3.5, s * 1.32, 2.2), dark)
    part("body", (4.7, 2.5, 2.55), (-0.2, 0, 2.18), green, bevel=0.06)
    part("hopper", (1.05, 2.42, 2.1), (-3.1, 0, 1.95), green, bevel=0.06)
    part("hopperlip", (0.5, 2.3, 0.3), (-3.45, 0, 1.0), steel)
    part("bumperF", (0.25, 2.3, 0.3), (3.65, 0, 0.75), steel, bevel=0.03)
    part("grille", (0.03, 1.4, 0.55), (3.61, 0, 1.2), dark)
    head = mat_flat("gt_head", (1, 1, 1), emit=(1.0, 0.95, 0.85), emit_strength=4)
    tail = mat_flat("gt_tail", (0.8, 0.05, 0.05), emit=(1.0, 0.05, 0.03), emit_strength=3)
    beacon = mat_flat("gt_beacon", (1.0, 0.55, 0.05), emit=(1.0, 0.5, 0.05), emit_strength=6)
    for s in (-1, 1):
        part(f"headl{s}", (0.05, 0.35, 0.2), (3.62, s * 0.88, 1.05), head)
        part(f"taill{s}", (0.05, 0.2, 0.3), (-3.64, s * 1.05, 1.15), tail)
    part("beacon", (0.2, 0.2, 0.12), (2.8, 0, 2.86), beacon)
    decal(f"{name}_panelR", f"{D9}/truck_side.png", 4.0, (-0.2, -1.26, 2.15), rot=(90, 0, 0)).parent = root
    decal(f"{name}_panelL", f"{D9}/truck_side.png", 4.0, (-0.2, 1.26, 2.15), rot=(90, 0, 180)).parent = root
    tyre = mat_flat("gt_tyre", (0.025, 0.025, 0.028), rough=0.85)
    wheels = []
    for x in (2.7, -1.35, -2.45):
        for s in (-1, 1):
            w = empty(f"{name}_wheel{x}{s}", (x, s * 1.02, 0.52)); w.parent = root
            cylinder(f"{name}_tyre{x}{s}", 0.52, 0.34, (0, 0, 0), tyre, rot=(90, 0, 0), verts=28).parent = w
            cylinder(f"{name}_rim{x}{s}", 0.3, 0.35, (0, 0, 0), steel, rot=(90, 0, 0), verts=16).parent = w
            box(f"{name}_hub{x}{s}", (0.42, 0.36, 0.06), (0, 0, 0), dark).parent = w
            wheels.append(w)
    if headlights:
        for s in (-1, 1):
            sp = spot(f"{name}_beam{s}", (3.7, s * 0.88, 1.05), (12.0, s * 0.6, 0.0), energy=9000, angle=55, blend=0.6,
                      color=(1.0, 0.95, 0.85), shadow=False)
            sp.parent = root
        point(f"{name}_beaconlight", (2.8, 0, 3.1), energy=150, color=(1.0, 0.5, 0.05), radius=0.1).parent = root
    return root, wheels


def drive_truck(root, wheels, keys, n, r=0.52):
    """keys = [(frame, (x, y), yaw_deg)]: move the truck and spin its wheels with distance."""
    for f, (x, y), yaw in keys:
        key_loc(root, f, (x, y, 0), interp="LINEAR")
        key_rot(root, f, (0, 0, yaw), interp="LINEAR")
    sc = bpy.context.scene
    prev, dist = None, 0.0
    for f in range(1, n + 1):
        sc.frame_set(f)
        p = root.matrix_world.translation.copy()
        if prev is not None:
            dist += (p - prev).dot(root.matrix_world.to_3x3() @ Vector((1, 0, 0)))
        prev = p
        for w in wheels:
            w.rotation_euler = (0, dist / r, 0)
            w.keyframe_insert("rotation_euler", frame=f)
    sc.frame_set(1)


def washing_machine(name="washer", loc=(0, 0, 0)):
    """Front-loading washer (0.6 x 0.6 x 0.85) facing -Y, with a real round door opening, glass and a dark drum.
    Returns (root, porthole_centre)."""
    root = empty(name)
    white = mat_flat("washwhite", (0.92, 0.93, 0.94), rough=0.25)
    chrome = mat_flat("washchrome", (0.85, 0.86, 0.88), metal=1.0, rough=0.2)
    W, D, H, zc, R = 0.6, 0.6, 0.85, 0.46, 0.165
    for nm, size, lc in (("back", (W, 0.02, H), (0, D / 2 - 0.01, H / 2)), ("l", (0.02, D, H), (-W / 2 + 0.01, 0, H / 2)),
                         ("r", (0.02, D, H), (W / 2 - 0.01, 0, H / 2)), ("top", (W, D, 0.02), (0, 0, H - 0.01)),
                         ("bot", (W, D, 0.04), (0, 0, 0.02))):
        box(f"{name}_{nm}", size, lc, white).parent = root
    fp = box(f"{name}_front", (W, 0.03, H), (0, -D / 2 + 0.015, H / 2), white)
    cut = cylinder(f"{name}_cut", R + 0.015, 0.3, (0, -D / 2, zc), None, rot=(90, 0, 0), verts=48)
    md = fp.modifiers.new("hole", "BOOLEAN"); md.object = cut; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    bake_mods(fp)
    bpy.data.objects.remove(cut, do_unlink=True)
    fp.parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.03, minor_radius=0.024, major_segments=48, minor_segments=12,
                                     location=(0, -D / 2 - 0.02, zc), rotation=(math.radians(90), 0, 0))
    ring = bpy.context.object; ring.name = f"{name}_ring"; ring.data.materials.append(chrome); ring.parent = root
    bpy.ops.object.shade_smooth()
    gl = cylinder(f"{name}_glass", R + 0.012, 0.008, (0, -D / 2 - 0.02, zc), glass("washglass", alpha=0.07, tint=(0.05, 0.07, 0.09)),
                  rot=(90, 0, 0), verts=48)
    no_shadow(gl); gl.parent = root
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=R + 0.035, depth=0.42, location=(0, -0.06, zc),
                                        rotation=(math.radians(90), 0, 0), end_fill_type="NOTHING")
    drum = bpy.context.object; drum.name = f"{name}_drum"
    drum.data.materials.append(mat_flat("drumsteel", (0.35, 0.36, 0.38), metal=0.9, rough=0.35))
    drum.modifiers.new("t", "SOLIDIFY").thickness = 0.01
    drum.parent = root
    cap = cylinder(f"{name}_drumback", R + 0.035, 0.01, (0, 0.15, zc), mat_flat("drumback", (0.12, 0.12, 0.13), metal=0.7, rough=0.4),
                   rot=(90, 0, 0), verts=40)
    cap.parent = root
    decal(f"{name}_panel", f"{D9}/washer_panel.png", 0.56, (0, -D / 2 - 0.002, H - 0.075), rot=(90, 0, 0)).parent = root
    root.location = Vector(loc)
    return root, Vector(loc) + Vector((0, -D / 2 - 0.02, zc))


def tumbling_laundry(centre, n, turns=1.5, name="laundry9"):
    """A few socks and shirts tumbling in the drum (spinning about the drum axis)."""
    rot = empty(name, centre)
    rnd = random.Random(3)
    cols = [(0.85, 0.2, 0.2), (0.2, 0.4, 0.85), (0.95, 0.85, 0.3), (0.95, 0.95, 0.95), (0.3, 0.7, 0.35)]
    for k in range(7):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.04, 0.13)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.04, 0.07), location=(math.cos(a) * r, 0.05 + rnd.uniform(0, 0.15), math.sin(a) * r))
        o = bpy.context.object; o.scale = (1.4, 0.6, 0.5); o.rotation_euler = (rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))
        o.data.materials.append(mat_flat(f"sock{k}", cols[k % 5], rough=0.9)); bpy.ops.object.shade_smooth()
        o.parent = rot
        o.location = (math.cos(a) * r, 0.05 + rnd.uniform(0, 0.15), math.sin(a) * r)
    key_rot(rot, 1, (0, 0, 0), interp="LINEAR")
    key_rot(rot, n, (0, -360 * turns, 0), interp="LINEAR")
    return rot


def laundry_room():
    world_color((0.5, 0.5, 0.52), 0.35)
    wall = mat_tex("lwall", "painted_plaster_wall", scale=1.0, tint=(0.8, 0.9, 0.92))
    plane("lfloor", (8, 8), (0, 0, 0), mat_tex("lfl", "floor_tiles_02", scale=1.0, tint=(0.82, 0.82, 0.8)), uv_scale=0.8)
    box("lback", (8, 0.2, 3.0), (0, 0.42, 1.5), wall, uv_scale=0.5)
    box("lleft", (0.2, 8, 3.0), (-1.75, 0, 1.5), wall, uv_scale=0.5)
    plane("lceil", (8, 8), (0, 0, 2.6), mat_flat("lceilm", (0.9, 0.9, 0.9)), rot=(180, 0, 0))
    washer, port = washing_machine("washer", (0, 0.0, 0))
    white = mat_flat("dryerwhite", (0.9, 0.91, 0.92), rough=0.3)
    box("dryer", (0.6, 0.6, 0.85), (0.66, 0.0, 0.425), white, bevel=0.01)
    cylinder("dryerdoor", 0.2, 0.02, (0.66, -0.305, 0.46), mat_flat("dryerdoorm", (0.75, 0.76, 0.78), metal=0.6, rough=0.3), rot=(90, 0, 0))
    box("shelf", (1.4, 0.3, 0.03), (0.3, 0.25, 1.55), mat_flat("shelfm", (0.85, 0.8, 0.72)))
    for k, (c, x) in enumerate((((0.9, 0.35, 0.1), -0.15), ((0.15, 0.4, 0.85), 0.2), ((0.95, 0.85, 0.2), 0.55))):
        box(f"det{k}", (0.22, 0.16, 0.3), (x, 0.25, 1.72), mat_flat(f"detm{k}", c, rough=0.5), bevel=0.01)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=0.45, location=(-0.85, -0.25, 0.225), end_fill_type="NOTHING")
    bk = bpy.context.object; bk.data.materials.append(mat_flat("basket", (0.75, 0.85, 0.95), rough=0.5))
    bk.modifiers.new("t", "SOLIDIFY").thickness = 0.01
    area("lkey", (0.6, -1.8, 2.2), (0, 0, 0.5), energy=260, size=1.8, color=(1.0, 0.97, 0.92))
    area("ltop", (0, -0.4, 2.55), (0, 0, 0), energy=180, size=2.0, color=(0.95, 0.97, 1.0))
    return washer, port


def room_cart(name="cart", loc=(0, 0, 0), rot_z=0.0):
    """Room-service cart with a floor-length white cloth, a plate and a silver cloche (dome). Returns (root, cloche)."""
    import bmesh
    root = empty(name)
    cloth = mat_flat("cartcloth", (0.95, 0.95, 0.93), rough=0.85)
    box(f"{name}_body", (0.9, 0.6, 0.86), (0, 0, 0.47), cloth, bevel=0.02).parent = root
    box(f"{name}_top", (0.96, 0.66, 0.03), (0, 0, 0.905), cloth, bevel=0.01).parent = root
    for x in (-0.38, 0.38):
        for y in (-0.24, 0.24):
            cylinder(f"{name}_w{x}{y}", 0.035, 0.025, (x, y, 0.035), mat_flat("cartwheel", (0.1, 0.1, 0.1)), rot=(90, 0, 0)).parent = root
    cylinder(f"{name}_plate", 0.19, 0.015, (0, 0, 0.928), mat_flat("plate", (0.97, 0.97, 0.97), rough=0.2), verts=40).parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=0.17, location=(0, 0, 0))
    dome = bpy.context.object; dome.name = f"{name}_cloche"
    bm = bmesh.new(); bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    bm.to_mesh(dome.data); bm.free()
    dome.scale = (1.0, 1.0, 0.85)
    dome.data.materials.append(mat_flat("cloche", (0.85, 0.86, 0.88), metal=1.0, rough=0.15))
    bpy.ops.object.shade_smooth()
    dome.modifiers.new("t", "SOLIDIFY").thickness = 0.004
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(0, 0, 0.165))
    knob = bpy.context.object; knob.data.materials.append(bpy.data.materials["cloche"]); knob.parent = dome
    dome.parent = root
    dome.location = (0, 0, 0.935)
    root.location = Vector(loc)
    root.rotation_euler = (0, 0, math.radians(rot_z))
    return root, dome


def suitcase(name="suitcase", loc=(0, 0, 0), rot_z=0.0, color=(0.6, 0.12, 0.1)):
    root = empty(name, loc)
    root.rotation_euler = (0, 0, math.radians(rot_z))
    box(f"{name}_body", (0.45, 0.22, 0.62), (0, 0, 0.33), mat_flat(f"{name}m", color, rough=0.4), bevel=0.03).parent = root
    box(f"{name}_handle", (0.16, 0.03, 0.04), (0, 0, 0.66), mat_flat("handle", (0.05, 0.05, 0.05))).parent = root
    return root


# ============================================================================ sets
LANE = -5.0                     # the runners' line on episode 4's street (street spans y -10..-3)


def night_sky(moon_loc=(-28, 70, 38), stars=160, seed=9, dist=90.0):
    world_color((0.012, 0.018, 0.05), 0.55)
    moon = mat_flat("moon9", (1, 1, 1), emit=(0.85, 0.9, 1.0), emit_strength=6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=4.0, location=moon_loc)
    mo = bpy.context.object; mo.data.materials.append(moon); bpy.ops.object.shade_smooth()
    star = mat_flat("star9", (1, 1, 1), emit=(1, 1, 1), emit_strength=8)
    rnd = random.Random(seed)
    for i in range(stars):
        a = rnd.uniform(-1.3, 1.3); e = rnd.uniform(0.25, 1.2)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.08, 0.18),
                                              location=(dist * math.sin(a), dist * math.cos(a) + 10, dist * math.sin(e)))
        bpy.context.object.data.materials.append(star)


def house_box(name, x, tint, seed=0):
    wall = mat_tex(f"{name}_wall", "painted_plaster_wall", scale=1.0, tint=tint)
    box(f"{name}_body", (9, 6, 3.0), (x, 6.5, 1.5), wall, uv_scale=0.4)
    box(f"{name}_roof", (9.4, 6.4, 0.2), (x, 6.5, 3.1), mat_flat("roof9", (0.25, 0.22, 0.22), rough=0.8))
    rnd = random.Random(seed)
    door = [(0.45, 0.12, 0.1), (0.12, 0.25, 0.45), (0.2, 0.35, 0.2), (0.35, 0.3, 0.28)][seed % 4]
    box(f"{name}_door", (1.0, 0.08, 2.1), (x, 3.47, 1.05), mat_flat(f"{name}_doorm", door, rough=0.4), bevel=0.02)
    lit = mat_flat("winglow9", (1, 1, 1), emit=(1.0, 0.75, 0.45), emit_strength=2.5)
    dark = mat_flat("windark9", (0.04, 0.05, 0.08), rough=0.1, metal=0.3)
    for wx in (-2.8, 2.8):
        box(f"{name}_win{wx}", (1.4, 0.06, 1.3), (x + wx, 3.47, 1.65), lit if rnd.random() < 0.55 else dark)
    plane(f"{name}_path", (1.4, 6), (x, 0.5, 0.005), mat_tex("hpath9", "rectangular_paving", scale=1.0), uv_scale=0.6)


def police_exterior(x=-58.0):
    """Police station across the end of the street, facade facing +X (straight at runners heading -X): block
    building, glowing glass doors, the POLICE DEPARTMENT sign, blue lamps, steps."""
    y = -6.5
    fx = x + 6.0                                   # facade plane
    blk = mat_tex("pstblk", "concrete_block_wall", scale=1.0, tint=(0.72, 0.76, 0.82))
    box("pst_body", (12, 18, 6.5), (x, y, 3.25), blk, uv_scale=0.5)
    box("pst_roof", (12.4, 18.4, 0.3), (x, y, 6.65), mat_flat("pstroof", (0.18, 0.18, 0.2)))
    decal("pst_sign", f"{D1}/sign_police.png", 7.5, (fx + 0.06, y, 4.9), rot=(90, 0, 90), emit=1.5)
    box("pst_door", (0.06, 2.8, 2.6), (fx + 0.03, y, 1.3), mat_flat("pstdoor", (0.6, 0.75, 0.85), emit=(0.85, 0.92, 1.0), emit_strength=3))
    lit = mat_flat("pstwin", (1, 1, 1), emit=(0.85, 0.92, 1.0), emit_strength=2.2)
    for wy in (-6.0, -3.8, 3.8, 6.0):
        box(f"pst_win{wy}", (0.06, 1.3, 1.3), (fx + 0.03, y + wy, 1.8), lit)
    step = mat_flat("pststep", (0.6, 0.6, 0.6), rough=0.8)
    box("pst_step1", (1.6, 5.0, 0.15), (fx + 0.8, y, 0.075), step)
    box("pst_step2", (0.9, 4.0, 0.3), (fx + 0.45, y, 0.15), step)
    blue = mat_flat("pstblue", (0.2, 0.4, 1.0), emit=(0.25, 0.45, 1.0), emit_strength=8)
    for s_ in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(fx + 0.2, y + s_ * 2.0, 2.9))
        bpy.context.object.data.materials.append(blue)
        point(f"pst_blue{s_}", (fx + 0.6, y + s_ * 2.0, 2.9), energy=500, color=(0.3, 0.5, 1.0), radius=0.25)
    point("pst_doorglow", (fx + 1.5, y, 2.4), energy=500, color=(0.85, 0.92, 1.0), radius=0.5)
    area("pst_wash", (fx + 9.0, y, 6.0), (fx, y, 3.0), energy=1200, size=6, color=(0.75, 0.85, 1.0))


def night_street(police=False, posters=True):
    """Episode 4's moonlit suburb stretched into a street: more houses and lamps along X, sidewalks, centre line,
    WANTED posters of Dale on the lamp posts. Runners use y = LANE and sprint toward -X."""
    ep4.house_exterior(night=True, chimney=False)
    walk = mat_tex("swalk9", "rectangular_paving", scale=1.0, tint=(0.8, 0.8, 0.78))
    plane("sidewalk_n", (300, 1.8), (0, -2.1, 0.03), walk, uv_scale=0.6)
    plane("sidewalk_s", (300, 1.8), (0, -10.9, 0.03), walk, uv_scale=0.6)
    curb = mat_flat("curb9", (0.55, 0.55, 0.53), rough=0.8)
    box("curb_n", (300, 0.15, 0.12), (0, -3.0, 0.06), curb)
    box("curb_s", (300, 0.15, 0.12), (0, -10.0, 0.06), curb)
    line = mat_flat("roadline9", (0.9, 0.85, 0.6), rough=0.6)
    for k in range(-30, 31):
        plane(f"dash{k}", (1.6, 0.12), (k * 4.0, -6.5, 0.012), line)
    tints = [(0.85, 0.9, 0.95), (0.95, 0.85, 0.75), (0.8, 0.88, 0.8), (0.95, 0.9, 0.82)]
    xs = (-30, -17, 17, 30) if police else (-43, -30, -17, 17, 30, 43)
    for i, x in enumerate(xs):
        house_box(f"h{i}", x, tints[i % 4], seed=i)
    lamp = bpy.data.objects.get("street_lamp_01")
    for x in (-36.5, -23.5, -10.5, 23.5, 36.5):
        if lamp:
            model_copy(lamp, (x, -2.6, 0), rot_z=90)
        point(f"lampglow{x}", (x, -2.6, 4.2), energy=400, color=(1.0, 0.8, 0.5), radius=0.3)
        if posters:
            decal(f"wanted{x}", f"{D9}/poster_wanted_dale.png", 0.42, (x, -2.79, 1.55), rot=(90, 0, 0))
    if posters:
        decal("wanted4.5", f"{D9}/poster_wanted_dale.png", 0.42, (4.5, -2.79, 1.55), rot=(90, 0, 0))
    area("streetfill", (0, -20, 8), (0, -5, 1), energy=1500, size=12, color=(0.45, 0.55, 1.0))
    if police:
        police_exterior()


def courtroom():
    world_color((0.06, 0.05, 0.04), 0.4)
    plane("crt_floor", (14, 14), (0, 0, 0), mat_tex("crtfl", "wood_floor", scale=1.0, tint=(0.62, 0.45, 0.3)), uv_scale=0.6)
    wall = mat_tex("crtwall", "painted_plaster_wall", scale=1.0, tint=(0.86, 0.8, 0.68))
    box("crt_back", (14, 0.2, 4.5), (0, 4.6, 2.25), wall, uv_scale=0.4)
    box("crt_left", (0.2, 14, 4.5), (-5.5, 0, 2.25), wall, uv_scale=0.4)
    box("crt_right", (0.2, 14, 4.5), (5.5, 0, 2.25), wall, uv_scale=0.4)
    plane("crt_ceil", (14, 14), (0, 0, 4.5), mat_flat("crtceil", (0.85, 0.82, 0.76)), rot=(180, 0, 0))
    oak = ep8.wood("crt_oak", (0.52, 0.32, 0.16), (0.3, 0.17, 0.07), 0.4, coat=0.4)
    box("crt_wains", (14, 0.06, 1.2), (0, 4.47, 0.6), oak)
    box("crt_dais", (4.6, 2.2, 0.35), (0, 3.45, 0.175), oak)
    box("crt_bench", (3.4, 0.85, 1.25), (0, 2.85, 0.975), oak, bevel=0.01)
    box("crt_benchtop", (3.6, 1.0, 0.07), (0, 2.9, 1.635), oak, bevel=0.01)
    decal("crt_plaque", f"{D9}/sign_court.png", 2.8, (0, 4.48, 3.25), rot=(90, 0, 0))
    ep2.chair((0, 3.7, 0.35), rot_z=0, seat_h=0.5, high_back=True, color=(0.14, 0.06, 0.04))
    g = gavel_prop(); g.location = (0.55, 2.75, 1.71); g.rotation_euler = (0, 0, math.radians(20))
    cylinder("gavelblock", 0.07, 0.04, (0.62, 2.62, 1.69), mat_flat("gblock", (0.3, 0.15, 0.07), rough=0.4))
    leg = mat_flat("tblleg", (0.2, 0.12, 0.06), rough=0.5)
    for x in (-1.6, 1.6):
        box(f"tbl_top{x}", (1.8, 0.8, 0.05), (x, 0.9, 0.76), oak, bevel=0.01)
        box(f"tbl_front{x}", (1.8, 0.04, 0.55), (x, 0.52, 0.47), oak)
        for dx in (-0.82, 0.82):
            box(f"tbl_leg{x}{dx}", (0.06, 0.06, 0.74), (x + dx, 1.22, 0.37), leg)
        box(f"paper{x}", (0.3, 0.22, 0.004), (x + 0.3, 0.95, 0.787), mat_flat("paper9", (0.95, 0.95, 0.92)))
    for k in range(-11, 12):
        cylinder(f"bal{k}", 0.025, 0.85, (k * 0.4, -0.45, 0.425), oak, verts=10)
    box("crt_rail", (9.2, 0.1, 0.07), (0, -0.45, 0.88), oak, bevel=0.01)
    for y in (-1.6, -2.8):
        box(f"pew{y}", (8.0, 0.45, 0.06), (0, y, 0.46), oak)
        box(f"pewback{y}", (8.0, 0.06, 0.5), (0, y - 0.22, 0.75), oak)
    win = mat_flat("crtwin", (1, 1, 1), emit=(1.0, 0.95, 0.85), emit_strength=3)
    for y in (-2.0, 1.0):
        box(f"crt_win{y}", (0.05, 1.2, 2.2), (-5.39, y, 2.3), win)
    area("crt_key", (-3.5, -1.5, 3.6), (0, 1.5, 1.0), energy=600, size=3, color=(1.0, 0.93, 0.82))
    area("crt_fill", (3.5, -3.0, 3.0), (0, 1.0, 1.0), energy=300, size=4, color=(0.95, 0.95, 1.0))
    area("crt_top", (0, 2.5, 4.3), (0, 2.5, 0), energy=400, size=3, color=(1.0, 0.95, 0.88))


def cell_door(c0=0.0, k0=13):
    """Turn the right part of a cell's bars (bars k0..19 of episode 7's block) into a door hinged at its left edge,
    swinging out into the corridor (rotate the returned empty by a negative Z angle)."""
    bars_m = bpy.data.materials.get("bars")
    for k in range(k0, 20):
        o = bpy.data.objects.get(f"bar{c0}_{k}")
        if o:
            o.hide_render = True; o.hide_viewport = True
    hx = c0 + k0 * 0.12 - 0.06
    for z in (0.1, 1.2, 2.55):
        o = bpy.data.objects.get(f"rail{c0}{z}")
        if o:
            o.hide_render = True; o.hide_viewport = True
        box(f"railfix{c0}{z}", (hx - c0, 0.05, 0.05), ((c0 + hx) / 2, 0.0, z), bars_m)
    h = empty(f"celldoor{c0}", (hx, 0.0, 0.0))
    w = c0 + 2.4 - hx
    for k in range(k0, 20):
        cylinder(f"dbar{c0}_{k}", 0.018, 2.6, (c0 + k * 0.12 - hx, 0.0, 1.3), bars_m, verts=10).parent = h
    for z in (0.1, 1.2, 2.55):
        box(f"drail{c0}{z}", (w, 0.05, 0.05), (w / 2, 0.0, z), bars_m).parent = h
    box(f"dlock{c0}", (0.12, 0.09, 0.2), (w - 0.1, 0.0, 1.15), mat_flat("lockbox", (0.2, 0.21, 0.22), metal=0.8, rough=0.4)).parent = h
    cylinder(f"dhinge{c0}", 0.03, 2.5, (0, 0, 1.3), bars_m, verts=12).parent = h
    return h


def cells_night():
    """Dim episode 7's cell block for lights-out: blue moonlight through the cell windows, corridor lights low."""
    for o in bpy.data.objects:
        if o.type == "LIGHT":
            o.data.energy *= 0.22
            o.data.color = (0.6, 0.72, 1.0)
    fl = bpy.data.materials.get("fluoro")
    if fl:
        fl.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.2
    area("moonwin", (1.2, 3.6, 2.6), (1.2, 1.4, 0.6), energy=240, size=0.8, color=(0.55, 0.68, 1.0), shadow=True)
    point("corrnight", (1.6, -1.6, 2.6), energy=90, color=(0.9, 0.85, 0.7), radius=0.3, shadow=True)


def bunk_lie(name="you_night", c0=0.0, face_vals=SERENE, subdiv=False):
    """You on your back on the cell bunk (along X, head toward +X)."""
    ch = load_char(name, (0, 0, 0), subdiv=subdiv)
    ch.hold("137_41", 2800)
    ch.rig.rotation_mode = "XYZ"
    ch.rig.rotation_euler = (math.radians(-86), 0, math.radians(-90))
    ch.rig.location = (c0 + 0.22, 2.15, 0.75)
    face(ch, 1, face_vals)
    return ch


def prison_night(sign=True):
    """Episode 7's prison exterior after dark: moon and stars, floodlights on the gate and towers, the new sign."""
    hinges = ep7.prison_exterior()
    night_sky(moon_loc=(-45, 95, 48))
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type == "SUN":
            o.data.energy = 0.5; o.data.color = (0.55, 0.65, 1.0)
    area("pn_moonfill", (-10, -25, 14), (0, 12, 2), energy=3000, size=12, color=(0.45, 0.55, 1.0))
    for x in (-3.2, 3.2):
        spot(f"flood{x}", (x, 11.3, 5.9), (x * 0.4, 5.0, 0.0), energy=4500, angle=75, blend=0.5, color=(1.0, 0.9, 0.7), shadow=False)
        box(f"floodbox{x}", (0.4, 0.3, 0.25), (x, 11.45, 5.95), mat_flat("floodlamp", (1, 1, 1), emit=(1.0, 0.9, 0.7), emit_strength=10))
    for x in (-14, 14):
        point(f"towerlamp{x}", (x, 12.5, 10.0), energy=800, color=(1.0, 0.85, 0.6), radius=0.4)
        spot(f"search{x}", (x, 11.0, 10.4), (x * 0.3, -6.0, 0.0), energy=12000, angle=14, blend=0.3, color=(0.95, 0.97, 1.0), shadow=False)
    for x in (-11.0, 0.0, 11.0):                                   # wash the wall so it reads against the night
        area(f"wallwash{x}", (x, 4.0, 2.5), (x, 12.0, 4.0), energy=3500, size=8, color=(0.85, 0.88, 1.0))
    for x in (-14, 14):
        area(f"towerwash{x}", (x * 0.9, 6.0, 6.0), (x, 12.5, 7.0), energy=1500, size=4, color=(0.85, 0.88, 1.0))
    if sign:
        o = bpy.data.objects.get("psign")
        if o:
            o.hide_render = True
        decal("maxsign", f"{D9}/sign_maxsec.png", 5.6, (0, 11.54, 5.0), rot=(90, 0, 0), emit=0.8)
    return hinges


def desert_road():
    world_hdri("kloofendal_43d_clear_puresky", strength=1.0, rot_z=30)
    ep2.ground("coast_sand_01", size=400, scale=0.3, tint=(0.85, 0.72, 0.55))
    plane("droad", (400, 6), (0, 0, 0.01), mat_tex("droadm", "asphalt_02", scale=1.0), uv_scale=0.3)
    line = mat_flat("droadline", (0.95, 0.85, 0.4), rough=0.6)
    for k in range(-40, 41):
        plane(f"ddash{k}", (2.0, 0.14), (k * 5.0, 0, 0.015), line)
    rnd = random.Random(7)
    rock = mat_flat("rock9", (0.55, 0.42, 0.3), rough=0.9)
    for k in range(40):
        x = rnd.uniform(-90, 90); y = rnd.choice((-1, 1)) * rnd.uniform(6, 60)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rnd.uniform(0.3, 1.6), location=(x, y, 0))
        o = bpy.context.object; o.scale = (1.3, 1.0, 0.6); o.data.materials.append(rock)
    for k in range(12):
        ep1.blob_tree((rnd.uniform(-80, 80), rnd.choice((-1, 1)) * rnd.uniform(12, 50), 0), height=rnd.uniform(3, 5), seed=k)
    decal("dsign", f"{D9}/poster_wanted_dale.png", 0.8, (-6.0, 4.0, 1.6), rot=(90, 0, -20))
    cylinder("dsignpost", 0.04, 1.4, (-6.0, 4.04, 0.7), mat_flat("dpost", (0.4, 0.3, 0.2)))


def parking_lot():
    night_sky(moon_loc=(-30, 80, 35))
    ep2.ground("asphalt_02", size=200, scale=0.3)
    line = mat_flat("lotline", (0.92, 0.92, 0.88), rough=0.6)
    for k in range(-3, 4):
        plane(f"lot{k}", (5.4, 0.12), (0.0, k * 2.8 + 1.4, 0.01), line)
    model("street_lamp_01", (-1.5, 4.2, 0), rot_z=0)
    point("lotlamp", (-1.5, 3.2, 4.4), energy=900, color=(1.0, 0.72, 0.4), radius=0.4, shadow=True)
    area("lotfill", (6, -8, 6), (0, 0, 1), energy=500, size=6, color=(0.45, 0.55, 1.0))
    ep1.blob_tree((-9.0, 9.0, 0), height=5.5, seed=2)
    ep1.blob_tree((8.0, 10.0, 0), height=6.0, seed=3)


def your_car(trunk=False, glovebox=False):
    """Your blue car as a sedan (it has a real trunk). Front faces +X, origin at the footprint centre."""
    car = Car("yourcar", "sedan", (0.08, 0.3, 0.72))
    P = car.P
    out = {"car": car}
    if trunk:
        L, W, belt, x_rt = P["L"], P["W"], P["belt"], P["x_rt"]
        x0, x1 = -L / 2 + 0.09, x_rt - 0.13
        plane("trunkhole", (x1 - x0 - 0.04, W - 0.26), ((x0 + x1) / 2, 0, belt + 0.004), mat_flat("trunkdark", (0.01, 0.01, 0.012), rough=1.0))
        h = empty("trunkhinge", (x1, 0, belt + 0.02))
        lid = box("trunklid", (x1 - x0, W - 0.2, 0.035), (-(x1 - x0) / 2, 0, 0), paint("yourcar_paint", (0.08, 0.3, 0.72)), bevel=0.012)
        lid.parent = h
        box("underrear", (1.0, W - 0.3, 0.3), (-L / 2 + 0.55, 0, 0.13), mat_flat("underdark", (0.005, 0.005, 0.006), rough=1.0))
        out["trunk"] = h
    if glovebox:
        xg, yg = P["x_ws"] - 0.37, -0.42
        dk = mat_flat("gbox", (0.035, 0.035, 0.04), rough=0.6)
        inner = mat_flat("gboxin", (0.12, 0.11, 0.1), rough=0.8)
        box("gb_top", (0.32, 0.6, 0.02), (xg + 0.16, yg, 0.77), dk)
        box("gb_bot", (0.32, 0.6, 0.02), (xg + 0.16, yg, 0.5), inner)
        box("gb_back", (0.02, 0.6, 0.28), (xg + 0.31, yg, 0.635), inner)
        for s in (-1, 1):
            box(f"gb_side{s}", (0.32, 0.02, 0.28), (xg + 0.16, yg + s * 0.29, 0.635), inner)
        box("gb_lower", (0.04, 0.6, 0.2), (xg, yg, 0.4), dk)
        for s in (-1, 1):
            box(f"gb_frame{s}", (0.03, 0.12, 0.27), (xg - 0.005, yg + s * 0.24, 0.635), dk)
        h = empty("gbhinge", (xg - 0.01, yg, 0.505))
        door = box("gb_door", (0.022, 0.36, 0.25), (0, 0, 0.125), dk, bevel=0.006); door.parent = h
        box("gb_latch", (0.01, 0.07, 0.02), (-0.013, 0, 0.21), mat_flat("gblatch", (0.6, 0.6, 0.62), metal=0.9)).parent = h
        point("gb_lamp", (xg + 0.25, yg, 0.72), energy=14, color=(1.0, 0.85, 0.6), radius=0.03)
        out["glovebox"] = (h, Vector((xg + 0.16, yg, 0.635)))
    return out


def recline(ch, car, seat_i, deg=24, hips_dz=0.08):
    """Sit in a car seat and lean back (sleeping)."""
    car.seat_char(ch, seat_i, pose_over=DRIVE, hands="lap")
    ch.rig.rotation_mode = "XYZ"
    ch.rig.rotation_euler = (math.radians(-deg), 0, math.radians(90))
    settle(ch, "Hips", car.seats[seat_i][2] + hips_dz)


def hotel_room():
    """Episode 7's bedroom (door in the left wall) dressed as a hotel room: door left open onto a lit corridor,
    luggage, a DO NOT DISTURB hanger; the cat flap and its door hidden."""
    door, flap, key = ep7.bedroom(window_open=False, door=True)
    for o in list(bpy.data.objects):
        if o.name.startswith(("doorp", "catflap", "flapframe", "lockplate", "keybow", "keyshaft")) or o.name in ("door", "key", "flaphinge"):
            o.hide_render = True; o.hide_viewport = True
    for o in bpy.data.objects:
        if o.type == "MESH" and o.parent and o.parent.name == "door":
            o.hide_render = True
    box("corr_back", (0.2, 4.0, 3.0), (-4.2, ep7.DOOR_Y, 1.5), mat_tex("corrwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.85, 0.7)), uv_scale=0.5)
    point("corr_lamp", (-3.4, ep7.DOOR_Y, 2.5), energy=300, color=(1.0, 0.82, 0.55), radius=0.3)
    suitcase("luggage", (1.6, -0.4, 0), rot_z=15)
    decal("dnd", f"{D9}/hanger_dnd.png", 0.12, (-2.48, ep7.DOOR_Y + 0.52, 1.0), rot=(90, 0, 90), alpha=True)
    bl = bpy.data.objects.get("blanket")
    if bl:
        bl.hide_render = True
    return door


def doorway_you(house_night=False):
    """Mom's house in daylight (episode 4's house), front door replaced by a dark open doorway, MOM'S doormat."""
    ep4.house_exterior(night=house_night, chimney=False)
    d = bpy.data.objects.get("door")
    if d:
        d.hide_render = True
    plane("doorway_dark", (1.0, 2.1), (0, 3.485, 1.05), mat_flat("doorwayin", (0.03, 0.025, 0.02), rough=1.0), rot=(90, 0, 0))
    box("doorframe_l", (0.08, 0.12, 2.15), (-0.54, 3.47, 1.07), mat_flat("dframe", (0.95, 0.95, 0.95)))
    box("doorframe_r", (0.08, 0.12, 2.15), (0.54, 3.47, 1.07), mat_flat("dframe", (0.95, 0.95, 0.95)))
    box("doorframe_t", (1.16, 0.12, 0.08), (0, 3.47, 2.15), mat_flat("dframe", (0.95, 0.95, 0.95)))
    decal("matmom", f"{D9}/mat_mom.png", 0.95, (0, 2.95, 0.012), rot=(0, 0, 0))
    plane("porch", (2.4, 1.2), (0, 2.9, 0.008), mat_tex("porchm", "rectangular_paving", scale=1.0), uv_scale=0.6)


# ============================================================================ SHOTS: the chase
def chase(n, x0, sd=(False, False, False), gaps=(3.4, 3.1), period=16):
    """You sprint toward -X screaming; escaped Dale behind you, Larry behind him (staggered across the lane)."""
    you = load_char("you_night", subdiv=sd[0])
    v = loop_move(you, n, *RUN, period, (x0, LANE, 0), -90)
    scream(you, n)
    dale = escapee(subdiv=sd[1])
    loop_move(dale, n, *RUN, period, (x0 + gaps[0], LANE + 1.05, 0), -90, phase=6)
    face(dale, 1, GRIN); blink(dale, [18])
    larry = load_char("larry", subdiv=sd[2])
    loop_move(larry, n, *RUN, period, (x0 + gaps[0] + gaps[1], LANE - 0.95, 0), -90, phase=11)
    face(larry, 1, CREEPY_ENJOY)
    return you, dale, larry, v


def track(cam, n, v, loc0, tgt0, lens=None):
    """Camera that travels with the runners (toward -X at v m/frame)."""
    d = Vector((-v * (n - 1), 0, 0))
    cam.key(1, loc=loc0, target=tgt0, interp="LINEAR")
    cam.key(n, loc=Vector(loc0) + d, target=Vector(tgt0) + d, interp="LINEAR")


@shot
def sh01():
    """(DALE) AHHH! - midnight street: you sprint at the lens in your pyjamas, screaming; Dale and Larry behind."""
    n = frames_of("sh01")
    closeup()
    night_street()
    you, dale, larry, v = chase(n, 8.0, sd=(True, False, False))
    cam = Cam(lens=38, loc=(5.4, -5.45, 1.5), target=(8.0, -5.0, 1.45))
    track(cam, n, v, (5.4, -5.45, 1.5), (8.0, -5.0, 1.42))
    cam.shake(1, n, amp=0.03, freq=1.4)
    return n


@shot
def sh02():
    """MIDNIGHT. - high wide: moon over the sleeping street, three tiny figures racing down the middle of the road."""
    n = frames_of("sh02")
    night_street()
    you, dale, larry, v = chase(n, 4.0)
    cam = Cam(lens=24, loc=(16.0, -24.0, 11.0), target=(-6.0, 0.0, 3.0), clip_end=3000)
    cam.key(1, loc=(16.0, -24.0, 11.0)); cam.key(n, loc=(15.0, -23.0, 10.4))
    return n


@shot
def sh03():
    """DALE is chasing you down the street - side tracking: Dale's grin on your heels, you fleeing just ahead."""
    n = frames_of("sh03")
    closeup()
    night_street()
    you, dale, larry, v = chase(n, -2.0, sd=(False, True, False), gaps=(2.2, 3.4))
    xm = -2.0 + 1.0
    cam = Cam(lens=28, loc=(xm - 0.4, -10.4, 1.45), target=(xm, -4.6, 1.2))
    track(cam, n, v, (xm - 0.4, -10.4, 1.45), (xm, -4.6, 1.2))
    cam.shake(1, n, amp=0.02, freq=1.2)
    face_light(cam, energy=900, size=2.0, offset=(0.6, 0.5, 0.0))
    return n


@shot
def sh04():
    """and you're SCREAMING for your life. - low front close-up: your scream against the moonlit sky."""
    n = frames_of("sh04")
    closeup()
    night_street()
    you, dale, larry, v = chase(n, 14.0, sd=(True, False, False))
    cam = Cam(lens=30, loc=(12.2, -5.9, 0.85), target=(14.0, -5.0, 1.55))
    track(cam, n, v, (12.2, -5.9, 0.85), (14.0, -5.0, 1.55))
    cam.shake(1, n, amp=0.035, freq=1.6, seed=2)
    return n


@shot
def sh05():
    """And right behind Dale... is - facing Dale as he runs at us; a sideways slide reveals Larry right behind him."""
    n = frames_of("sh05")
    closeup()
    night_street()
    y = LANE + 0.6
    dale = escapee(subdiv=True)
    v = loop_move(dale, n, *RUN, 16, (22.0, y, 0), -90, phase=6)
    face(dale, 1, GRIN); blink(dale, [20])
    larry = load_char("larry")
    loop_move(larry, n, *RUN, 16, (25.6, y, 0), -90, phase=11)
    face(larry, 1, CREEPY_ENJOY)
    d = -v * (n - 1)
    f_is = at("sh05", 6.75)
    cam = Cam(lens=42, loc=(19.6, y, 1.6), target=(22.0, y, 1.5))
    cam.key(1, loc=(19.6, y, 1.6), target=(22.0, y, 1.5), interp="LINEAR")
    cam.key(f_is, loc=(19.6 + d * f_is / n, y, 1.6), target=(22.0 + d * f_is / n, y, 1.5))
    cam.key(n, loc=(19.4 + d, y - 1.5, 1.75), target=(23.5 + d, y + 0.2, 1.45))
    face_light(cam, energy=500, size=1.5)
    return n


@shot
def sh06():
    """LARRY. - Larry's grinning face fills the frame, glasses bouncing, gaining on you."""
    n = frames_of("sh06")
    closeup()
    night_street()
    y = LANE - 0.6
    larry = load_char("larry", subdiv=True)
    v = loop_move(larry, n, *RUN, 16, (36.0, y, 0), -90, phase=11)
    face(larry, 1, CREEPY_ENJOY); blink(larry, [8])
    dale = escapee()
    loop_move(dale, n, *RUN, 16, (32.6, y + 1.7, 0), -90, phase=6)
    face(dale, 1, GRIN)
    cam = Cam(lens=45, loc=(36.0 - 2.0, y - 0.35, 1.4), target=(36.0, y, 1.42))
    track(cam, n, v, (36.0 - 2.0, y - 0.35, 1.4), (36.0, y, 1.42))
    cam.shake(1, n, amp=0.02, freq=1.3, seed=3)
    face_light(cam, energy=300, size=1.2)
    return n


@shot
def sh07():
    """You're running to the police station. - behind the three: the lit POLICE station down the street."""
    n = frames_of("sh07")
    night_street(police=True)
    you, dale, larry, v = chase(n, -24.0, gaps=(3.0, 2.8))
    cam = Cam(lens=26, loc=(-10.0, -6.2, 3.4), target=(-52.0, -6.5, 2.6), clip_end=3000)
    d = -v * (n - 1)
    cam.key(1, loc=(-10.0, -6.2, 3.4), target=(-52.0, -6.5, 2.6), interp="LINEAR")
    cam.key(n, loc=(-10.0 + d, -6.0, 3.1), target=(-52.0, -6.5, 2.8), interp="LINEAR")
    return n


@shot
def sh08():
    """Let me explain. - freeze frame: the three hang mid-stride while the camera glides round them."""
    n = frames_of("sh08")
    closeup()
    night_street()
    you = load_char("you_night", subdiv=True)
    frozen_run(you, (0.0, LANE, 0), -90, 30)
    face(you, 1, SCREAM)
    dale = escapee(subdiv=True)
    frozen_run(dale, (2.4, LANE + 0.5, 0), -90, 72)
    face(dale, 1, GRIN)
    larry = load_char("larry", subdiv=True)
    frozen_run(larry, (4.6, LANE - 0.45, 0), -90, 52)
    face(larry, 1, CREEPY_ENJOY)
    cam = Cam(lens=28, loc=(-2.2, -9.0, 1.55), target=(1.7, -5.0, 1.2))
    cam.key(1, loc=(-2.2, -9.0, 1.55)); cam.key(n, loc=(0.2, -9.8, 1.9), target=(2.0, -5.0, 1.25))
    face_light(cam, energy=900, size=2.0, offset=(0.5, 0.5, 0.0))
    return n


# ============================================================================ SHOTS: the backstory
@shot
def sh09():
    """Last week, you took Dale TO COURT. - courtroom: you point at Dale across the aisle; he shrugs, innocent."""
    n = frames_of("sh09")
    closeup()
    courtroom()
    you = load_char("you", (-1.5, 0.15, 0), rot_z=90, subdiv=True)
    you.clip("137_28", **src(n, 2400))
    hand_ik(you, "Right", empty("point_at", (-0.85, -0.05, 1.42)))
    face(you, 1, STERN)
    dale = load_char("dale", (1.5, 0.15, 0), rot_z=-90, subdiv=True)
    dale.clip("137_41", **src(n, 4150))
    for side, dy in (("Left", -0.38), ("Right", 0.38)):          # Dale faces -X: his right is +Y
        tg = empty(f"shrug{side}", (1.15, 0.15 + dy, 1.0))
        key_loc(tg, 1, (1.25, 0.15 + dy * 0.6, 0.9)); key_loc(tg, 14, (1.15, 0.15 + dy, 1.12))
        hand_ik(dale, side, tg)
    face(dale, 1, DEADPAN); face(dale, 16, dict(SMUG, browOuterUpLeft=0.9, browOuterUpRight=0.9))
    blink(dale, [30])
    cam = Cam(lens=32, loc=(-3.5, -1.25, 1.7), target=(1.0, 0.45, 1.35))
    cam.key(1, loc=(-3.5, -1.25, 1.7)); cam.key(n, loc=(-2.9, -1.05, 1.65), target=(1.1, 0.4, 1.4))
    return n


@shot
def sh10():
    """FIVE YEARS in prison. - cell 7: Dale in his jumpsuit grips the bars; a 5 YEARS stamp slams onto the frame."""
    n = frames_of("sh10")
    closeup()
    ep7.prison_cells()
    dale = load_char("dale_jail", (1.2, 0.35, 0), subdiv=True)
    ep2.chest_print(dale, f"{D7}/inmate_no.png", width=0.2, name="inmate10")
    dale.clip("137_41", **src(n, 4150))
    for side, dx in (("Left", 0.2), ("Right", -0.2)):
        hand_ik(dale, side, empty(f"bar{side}", (1.2 + dx, 0.04, 1.35)))
    face(dale, 1, SAD); blink(dale, [26])
    cam = Cam(lens=32, loc=(1.6, -2.1, 1.5), target=(1.2, 0.3, 1.45))
    cam.key(1, loc=(1.6, -2.1, 1.5)); cam.key(n, loc=(1.45, -1.35, 1.52))
    stamp(cam, f"{D9}/stamp_5years.png", 6, width=0.12, y=-0.05)
    return n


@shot
def sh11():
    """GENIUS! - outside the courtroom rail: you punch the air, delighted."""
    n = frames_of("sh11")
    closeup()
    courtroom()
    you = load_char("you", (0.0, -1.2, 0), rot_z=0, subdiv=True)
    you.clip("137_28", **src(n, 2400))
    tg = empty("fist", (-0.25, -1.3, 1.3))
    key_loc(tg, 1, (-0.28, -1.35, 1.25)); key_loc(tg, 6, (-0.25, -1.3, 1.95)); key_loc(tg, 10, (-0.25, -1.3, 1.82))
    key_loc(tg, 14, (-0.25, -1.3, 1.98)); key_loc(tg, n, (-0.25, -1.3, 1.9))
    hand_ik(you, "Right", tg)
    ep8.finger_pose(you, "Right", curl=105, thumb_up=False)
    face(you, 1, TADA)
    cam = Cam(lens=34, loc=(0.35, -3.4, 1.55), target=(0.0, -1.2, 1.55))
    cam.key(1, loc=(0.35, -3.4, 1.55)); cam.key(n, loc=(0.25, -3.0, 1.6))
    return n


@shot
def sh12():
    """But Dale ESCAPED. - cell 7 empty: two bars bent apart, a toilet-paper dummy on the bunk, the alarm flashing."""
    n = frames_of("sh12")
    ep7.prison_cells()
    bars_m = bpy.data.materials.get("bars")
    for k, bulge in ((9, -0.26), (10, 0.26)):                       # two bars bent apart into a person-sized gap
        o = bpy.data.objects.get(f"bar0.0_{k}")
        if o:
            o.hide_render = True
        x = k * 0.12
        ep6.strut(f"bent{k}a", (x, 0.0, 0.0), (x + bulge, -0.06, 1.25), 0.018, bars_m)
        ep6.strut(f"bent{k}b", (x + bulge, -0.06, 1.25), (x, 0.0, 2.6), 0.018, bars_m)
    tp = mat_flat("tpaper", (0.95, 0.95, 0.93), rough=0.9)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(2.0, 2.15, 0.78)); hd = bpy.context.object
    hd.data.materials.append(tp); bpy.ops.object.shade_smooth(); hd.scale = (1.0, 0.9, 1.05)
    for dx in (-0.045, 0.045):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.014, location=(2.0 + dx * 0.0, 2.15 + dx, 0.82))
        o = bpy.context.object; o.location = (1.89, 2.15 + dx, 0.82); o.data.materials.append(mat_flat("dot", (0.05, 0.05, 0.05)))
    box("blanketlump", (1.1, 0.6, 0.18), (1.1, 2.15, 0.72), mat_flat("greyblanket", (0.45, 0.47, 0.5), rough=0.9), bevel=0.06)
    red = point("alarm", (1.2, -1.0, 2.6), energy=0, color=(1.0, 0.06, 0.04), radius=0.2)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0.3, -1.5, 2.85))
    bec = bpy.context.object
    bm = mat_flat("beacon9", (1.0, 0.1, 0.05), emit=(1.0, 0.05, 0.02), emit_strength=0.0)
    bec.data.materials.append(bm)
    es = bm.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    for f in range(1, n + 1, 6):
        red.data.energy = 6000; red.data.keyframe_insert("energy", frame=f)
        es.default_value = 25; es.keyframe_insert("default_value", frame=f)
        red.data.energy = 0; red.data.keyframe_insert("energy", frame=f + 3)
        es.default_value = 0; es.keyframe_insert("default_value", frame=f + 3)
    cam = Cam(lens=28, loc=(1.3, -2.4, 1.4), target=(1.2, 0.6, 1.1))
    cam.key(1, loc=(1.3, -2.4, 1.4)); cam.key(n, loc=(1.2, -1.5, 1.3))
    return n


@shot
def sh13():
    """In a GARBAGE TRUCK. - the truck squeezes out as the gates slam; Dale pops out of the top, arms up, free."""
    n = frames_of("sh13")
    hinges = ep7.prison_exterior()
    truck, wheels = garbage_truck()
    xd = -1.2
    dale = escapee((xd, 0.0, 2.42), rot_z=180, peel=False, dirty=0.15)
    dale.rig.parent = truck
    dale.clip("137_41", **src(n, 4150))
    for side, dx in (("Left", -0.35), ("Right", 0.35)):
        tg = empty(f"up{side}", (xd + dx, 0.15, 4.6)); tg.parent = truck
        for f in range(1, n + 1, 6):
            key_loc(tg, f, (xd + dx * (1.0 if (f // 6) % 2 == 0 else 1.6), 0.15, 4.6))
        hand_ik(dale, side, tg)
    face(dale, 1, TADA)
    drive_truck(truck, wheels, [(1, (0.0, 13.2), -90), (n, (0.0, 1.5), -90)], n)
    f_shut = round(n * 0.62)
    for h, s_ in zip(hinges, (-1, 1)):
        key_rot(h, 1, (0, 0, s_ * -60)); key_rot(h, f_shut - 6, (0, 0, s_ * -45)); key_rot(h, f_shut, (0, 0, s_ * -3))
        key_rot(h, n, (0, 0, 0))
    cam = Cam(lens=26, loc=(10.0, 0.2, 2.2), target=(0.0, 8.0, 3.0), clip_end=3000)
    cam.key(1, loc=(10.0, 0.2, 2.2)); cam.key(n, loc=(9.4, -0.6, 2.3), target=(0.0, 5.0, 3.0))
    return n


@shot
def sh14():
    """Then he walked SIX DAYS straight - desert highway, the sun racing across the sky: Dale trudges on."""
    n = frames_of("sh14")
    closeup()
    desert_road()
    sn = sun(energy=3.8, rot=(70, 0, 120), color=(1.0, 0.9, 0.75))
    key_rot(sn, 1, (70, 0, 110), interp="LINEAR"); key_rot(sn, n, (55, 0, 250), interp="LINEAR")
    dale = escapee(subdiv=True)
    v = loop_move(dale, n, *TRUDGE, 50, (6.0, -0.8, 0), 90)
    face(dale, 1, dict(CREEPY_ENJOY, eyeBlinkLeft=0.2, eyeBlinkRight=0.2))
    cam = Cam(lens=40, loc=(10.2, -2.2, 1.2), target=(6.0, -0.8, 1.35), clip_end=3000)
    d = v * (n - 1)
    cam.key(1, loc=(10.2, -2.2, 1.2), target=(6.0, -0.8, 1.35), interp="LINEAR")
    cam.key(n, loc=(10.2 + d * 0.5, -2.4, 1.25), target=(6.0 + d, -0.8, 1.35), interp="LINEAR")
    return n


def you_in_bed9(name="you_night", subdiv=False):
    ch = load_char(name, (0, 0, 0), subdiv=subdiv)
    ch.hold("137_41", 2800)
    ch.rig.rotation_euler = (math.radians(-86), 0, 0)
    ch.rig.location = (0.0, 0.08, 0.7)
    face(ch, 1, SLEEP)
    ep4.blanket_over(ch, (-0.9, 0.9), (-0.16, 1.6), 0.59, fold_y=1.46, color=(0.14, 0.2, 0.5), half_w=0.815, foot_y=-0.07)
    return ch


@shot
def sh15():
    """to your window. - your moonlit bedroom: you sleep in the foreground; Dale's grin presses against the glass."""
    n = frames_of("sh15")
    closeup()
    ep4.bedroom_night(window_open=False, with_dresser=False)
    bl = bpy.data.objects.get("blanket")
    if bl:
        bl.hide_render = True
    you = you_in_bed9(subdiv=True)
    dale = escapee((2.86, 0.62, 0.0), rot_z=-90, subdiv=True)
    dale.clip("137_41", **src(n, 4150))
    for side, dy in (("Left", -0.3), ("Right", 0.3)):
        hand_ik(dale, side, empty(f"glass{side}", (2.63, 0.62 + dy, 1.66)))
    look_at(dale, empty("dalelook", (0.0, 1.6, 0.9)), 0.8)
    face(dale, 1, CREEPY); blink(dale, [22])
    area("underchin", (2.3, 0.62, 0.82), (2.9, 0.62, 1.62), energy=45, size=0.35, color=(0.65, 0.78, 1.0))
    cam = Cam(lens=26, loc=(-1.4, 1.75, 1.25), target=(2.2, 1.0, 1.35))
    cam.key(1, loc=(-1.4, 1.75, 1.25)); cam.key(n, loc=(-0.75, 1.5, 1.32), target=(2.3, 0.85, 1.45))
    return n


@shot
def sh16():
    """So you hide at your mom's house. CLEVER! - you peek out of Mom's front door, check both ways, smirk at us."""
    n = frames_of("sh16")
    closeup()
    doorway_you()
    you = load_char("you_casual", (0.0, 3.3, 0), rot_z=0, subdiv=True)
    you.clip("137_28", **src(n, 2400))
    look = empty("peek", (-3.0, 0.5, 1.5))
    fc = at("sh16", 25.05)
    key_loc(look, 1, (-3.0, 0.8, 1.4)); key_loc(look, 16, (-3.0, 0.8, 1.4)); key_loc(look, 26, (3.0, 0.8, 1.4))
    key_loc(look, fc - 6, (3.0, 0.8, 1.4)); key_loc(look, fc, (0.5, -2.0, 1.6))
    look_at(you, look, 0.9)
    face(you, 1, UNEASY); face(you, fc - 1, UNEASY); face(you, fc + 2, SMUG)
    blink(you, [10, fc + 12])
    cam = Cam(lens=36, loc=(0.55, -0.4, 1.55), target=(0.0, 3.3, 1.42))
    cam.key(1, loc=(0.55, -0.4, 1.55)); cam.key(n, loc=(0.35, 0.9, 1.6), target=(0.0, 3.3, 1.55))
    return n


@shot
def sh17():
    """But the guy in the WASHING MACHINE - Mom's laundry room: push in on the washer's porthole, laundry tumbling."""
    n = frames_of("sh17")
    washer, port = laundry_room()
    tumbling_laundry(port + Vector((0, 0.12, 0)), n, turns=2.0)
    cam = Cam(lens=32, loc=(0.5, -2.2, 1.15), target=(port.x, port.y, port.z))
    cam.key(1, loc=(0.5, -2.2, 1.15)); cam.key(n, loc=(0.08, -0.95, 0.62))
    return n


@shot
def sh18():
    """is LARRY. - in the porthole: Larry's face, spinning round with the wash, grinning."""
    n = frames_of("sh18")
    closeup()
    washer, port = laundry_room()
    larry = load_char("larry", (0, 0, 0), subdiv=True)
    larry.hold("137_41", 4200)
    head = larry.world("Head", frame=1)
    want = port + Vector((0, 0.13, -0.06))
    larry.rig.location = Vector(larry.rig.location) + (want - head)
    piv = empty("spin", port + Vector((0, 0.13, 0.0)))
    bpy.context.view_layer.update()
    larry.rig.parent = piv
    larry.rig.matrix_parent_inverse = piv.matrix_world.inverted()
    key_rot(piv, 1, (0, 0, 0), interp="LINEAR"); key_rot(piv, n, (0, -150, 0), interp="LINEAR")
    face(larry, 1, CREEPY_ENJOY); face(larry, 12, dict(CREEPY_ENJOY, eyeBlinkLeft=1.0, eyeBlinkRight=0.0))
    face(larry, 16, CREEPY_ENJOY)
    point("drumlight", port + Vector((0, -0.35, 0.05)), energy=8, color=(0.9, 0.95, 1.0), radius=0.1)
    cam = Cam(lens=40, loc=(0.0, -0.92, port.z + 0.02), target=(port.x, port.y, port.z))
    cam.key(1, loc=(0.0, -0.92, port.z + 0.02)); cam.key(n, loc=(0.0, -0.78, port.z + 0.01))
    return n


@shot
def sh19():
    """So you check into a hotel. PERFECT! - hotel bed: you stretch out, then a thumbs up."""
    n = frames_of("sh19")
    closeup()
    hotel_room()
    you = load_char("you_casual", (0, 0, 0), subdiv=True)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-80), 0, 0)
    you.rig.location = (0.0, 0.1, 0.72)
    ep7.duvet(y0=-0.2, y1=0.95, z=0.8, color=(0.85, 0.85, 0.82))
    fp = at("sh19", 30.29)
    tg = empty("thumb", (-0.3, 1.0, 1.0))                        # lying face up: your right is -X
    key_loc(tg, 1, (-0.32, 1.0, 0.78)); key_loc(tg, fp - 2, (-0.32, 1.0, 0.8)); key_loc(tg, fp + 5, (-0.25, 0.75, 1.32))
    hand_ik(you, "Right", tg)
    ep8.finger_pose(you, "Right", curl=110, thumb_up=True)
    face(you, 1, SERENE); face(you, fp - 1, SERENE); face(you, fp + 3, dict(SMILE, eyeBlinkLeft=0.0, eyeBlinkRight=0.0))
    cam = Cam(lens=30, loc=(1.55, 0.95, 1.95), target=(0.0, 1.5, 0.8))
    cam.key(1, loc=(1.55, 0.95, 1.95)); cam.key(n, loc=(1.25, 1.05, 1.75), target=(0.0, 1.6, 0.82))
    return n


@shot
def sh20():
    """But room service is - the door stands open; a room-service cart rolls in all by itself."""
    n = frames_of("sh20")
    hotel_room()
    you = load_char("you_casual", (0.0, 0.1, 0.72))
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-80), 0, 0)
    ep7.duvet(y0=-0.2, y1=0.95, z=0.8, color=(0.85, 0.85, 0.82))
    face(you, 1, UNEASY)
    cart, cloche = room_cart("cart", (-3.3, ep7.DOOR_Y, 0), rot_z=0)
    key_loc(cart, 1, (-3.3, ep7.DOOR_Y, 0)); key_loc(cart, n - 4, (-1.4, ep7.DOOR_Y + 0.1, 0))
    cam = Cam(lens=26, loc=(1.4, -2.4, 1.45), target=(-2.3, ep7.DOOR_Y, 0.9))
    cam.key(1, loc=(1.4, -2.4, 1.45)); cam.key(n, loc=(1.1, -2.1, 1.4), target=(-1.8, ep7.DOOR_Y, 0.9))
    return n


@shot
def sh21():
    """DALE. - the cloche lifts: Dale's head on the plate, grinning up at you."""
    n = frames_of("sh21")
    closeup()
    hotel_room()
    cx, cy = -1.2, -0.8
    cart, cloche = room_cart("cart", (cx, cy, 0), rot_z=90)
    dale = escapee((0, 0, 0), rot_z=48, subdiv=True, peel=True)
    dale.hold("137_41", 4200)
    for side, dx in (("Left", 0.08), ("Right", -0.08)):
        hand_ik(dale, side, empty(f"tuck{side}", (cx + dx, cy, 0.45)))
    head = dale.world("Head", frame=1)
    want = Vector((cx, cy, 0.935 + 0.075))
    dale.rig.location = Vector(dale.rig.location) + (want - head)
    face(dale, 1, GRIN); face(dale, 14, dict(GRIN, eyeBlinkLeft=1.0)); face(dale, 18, GRIN)
    key_loc(cloche, 1, (0, 0, 0.935)); key_loc(cloche, 3, (0, 0, 0.935)); key_loc(cloche, 11, (0.05, 0, 1.8))
    cam = Cam(lens=40, loc=(-0.15, -1.75, 1.42), target=(cx, cy, 1.1))
    cam.key(1, loc=(-0.15, -1.75, 1.42)); cam.key(n, loc=(-0.35, -1.55, 1.34), target=(cx, cy, 1.12))
    return n


@shot
def sh22():
    """So you sleep in your car. MUCH BETTER! - inside your car at night: you doze at the wheel, then smile."""
    n = frames_of("sh22")
    closeup()
    parking_lot()
    out = your_car()
    car = out["car"]
    you = load_char("you_night", subdiv=True)
    car.seat_char(you, 0, pose_over=DRIVE, hands="lap")
    x, y, z = car.seats[0]
    look_at(you, empty("dozeback", (x - 0.9, y - 0.15, 1.9)), 0.55)
    face(you, 1, SLEEP)
    fm = at("sh22", 35.11)
    face(you, fm - 1, SLEEP); face(you, fm + 3, dict(SERENE, mouthSmileLeft=0.85, mouthSmileRight=0.85))
    point("dashglow", (x + 0.75, y - 0.2, 1.0), energy=10, color=(0.4, 0.6, 1.0), radius=0.1)
    point("lampspill", (x + 0.2, y - 0.6, 1.5), energy=6, color=(1.0, 0.75, 0.45), radius=0.2)
    x1, y1, _ = car.seats[1]
    cam = Cam(lens=28, loc=(x1 + 0.35, y1 - 0.05, 1.22), target=(x - 0.05, y, 1.12))
    cam.key(1, loc=(x1 + 0.35, y1 - 0.05, 1.22)); cam.key(n, loc=(x1 + 0.3, y1 + 0.2, 1.2), target=(x - 0.02, y, 1.14))
    return n


@shot
def sh23():
    """But Dale is IN THE TRUNK. - behind your car: the trunk lid pops and Dale rises out of it, waving."""
    n = frames_of("sh23")
    parking_lot()
    out = your_car(trunk=True)
    car = out["car"]
    h = out["trunk"]
    key_rot(h, 1, (0, 0, 0)); key_rot(h, 4, (0, 0, 0)); key_rot(h, 9, (0, 72, 0))
    dale = escapee((-1.95, 0.0, -0.9), rot_z=-90)
    dale.clip("113_27", **src(n, 40))
    key_loc(dale.rig, 1, (-1.95, 0.0, -0.95)); key_loc(dale.rig, 7, (-1.95, 0.0, -0.95)); key_loc(dale.rig, 15, (-1.95, 0.0, -0.08))
    face(dale, 1, GRIN)
    cam = Cam(lens=30, loc=(-7.2, -1.9, 1.6), target=(-2.2, 0.0, 1.25))
    cam.key(1, loc=(-7.2, -1.9, 1.6)); cam.key(n, loc=(-6.2, -1.5, 1.5))
    face_light(cam, energy=700, size=1.5, offset=(0.4, 0.4, 0.0))
    return n


@shot
def sh24():
    """And Larry is IN THE GLOVEBOX. - inside your car: the glovebox drops open; Larry peers out, lit by its lamp."""
    n = frames_of("sh24")
    closeup()
    parking_lot()
    out = your_car(glovebox=True)
    car = out["car"]
    h, gpos = out["glovebox"]
    key_rot(h, 1, (0, 0, 0)); key_rot(h, 8, (0, 0, 0)); key_rot(h, 13, (0, -86, 0))
    you = load_char("you_night", subdiv=True)
    car.seat_char(you, 0, pose_over=DRIVE, hands="lap")
    face(you, 1, SLEEP); face(you, 14, SLEEP); face(you, 20, SHOCK)
    larry = load_char("larry", (0, 0, 0), rot_z=-90, subdiv=True)
    larry.hold("137_41", 4200)
    head = larry.world("Head", frame=1)
    want = gpos + Vector((0.04, 0.0, -0.06))
    larry.rig.location = Vector(larry.rig.location) + (want - head)
    face(larry, 1, CREEPY_ENJOY); blink(larry, [30])
    point("gb_fill", (gpos.x - 0.45, gpos.y + 0.1, gpos.z + 0.25), energy=5, color=(0.5, 0.6, 1.0), radius=0.1)
    cam = Cam(lens=30, loc=(gpos.x - 0.85, gpos.y + 0.32, gpos.z + 0.3), target=(gpos.x, gpos.y, gpos.z - 0.02))
    cam.key(1, loc=(gpos.x - 0.85, gpos.y + 0.32, gpos.z + 0.3)); cam.key(n, loc=(gpos.x - 0.6, gpos.y + 0.22, gpos.z + 0.22))
    return n


@shot
def sh25():
    """That's why YOU'RE RUNNING. - back on the street: the chase, low and wide, the three thundering at us."""
    n = frames_of("sh25")
    closeup()
    night_street()
    you, dale, larry, v = chase(n, 10.0, sd=(True, False, False), gaps=(2.4, 2.6))
    cam = Cam(lens=22, loc=(6.0, -6.4, 0.5), target=(11.0, -4.9, 1.5))
    track(cam, n, v, (6.0, -6.4, 0.5), (11.0, -4.9, 1.5))
    cam.shake(1, n, amp=0.03, freq=1.5, seed=5)
    return n


# ============================================================================ SHOTS: the police
@shot
def sh26():
    """At the police station, - you slam both hands on the counter, gasping; the officer looks up."""
    n = frames_of("sh26")
    closeup()
    ep1.police_set()
    cop = load_char("cop", (0.2, 0.55, 0), rot_z=0, subdiv=True)
    cop.clip("137_28", **src(n, 2400))
    face(cop, 1, DEADPAN); face(cop, 6, SHOCK)
    you = load_char("you_night", (-0.25, -0.9, 0), rot_z=180, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    for side, dx in (("Left", -0.28), ("Right", 0.28)):
        tg = empty(f"slam{side}", (-0.25 + dx, -0.35, 1.12))
        key_loc(tg, 1, (-0.25 + dx, -0.5, 1.45)); key_loc(tg, 4, (-0.25 + dx, -0.32, 1.13))
        hand_ik(you, side, tg)
    face(you, 1, PANT)
    cam = Cam(lens=28, loc=(1.9, -2.2, 1.55), target=(-0.05, 0.0, 1.35))
    cam.key(1, loc=(1.9, -2.2, 1.55)); cam.key(n, loc=(1.7, -1.9, 1.55))
    cam.shake(3, 9, amp=0.04, freq=2.0)
    return n


@shot
def sh27():
    """the officer HAS A PLAN. The safest place on earth? - the cop raises a finger, then leans in, eyebrows up."""
    n = frames_of("sh27")
    closeup()
    ep1.police_set()
    cop = load_char("cop", (0.2, 0.55, 0), rot_z=0, subdiv=True)
    cop.clip("137_28", **src(n, 2400))
    tg = empty("plan", (-0.05, 0.25, 1.62))                      # the cop faces -Y: his right is -X
    key_loc(tg, 1, (-0.1, 0.35, 1.05)); key_loc(tg, 8, (-0.02, 0.22, 1.66)); key_loc(tg, at("sh27", 43.9), (-0.02, 0.22, 1.66))
    key_loc(tg, at("sh27", 44.4), (-0.15, 0.2, 1.15))
    hand_ik(cop, "Right", tg)
    ep8.finger_pose(cop, "Right", curl=100, thumb_up=False)
    fl = at("sh27", 44.0)
    face(cop, 1, PLAN); face(cop, fl, PLAN); face(cop, fl + 6, dict(SMUG, browOuterUpLeft=1.0, browOuterUpRight=1.0, browInnerUp=0.6))
    key_loc(cop.rig, 1, (0.2, 0.55, 0)); key_loc(cop.rig, fl, (0.2, 0.55, 0)); key_loc(cop.rig, fl + 10, (0.2, 0.42, 0))
    blink(cop, [20, 60])
    cam = Cam(lens=40, loc=(0.0, -1.8, 1.65), target=(0.2, 0.5, 1.6))
    cam.key(1, loc=(0.0, -1.8, 1.65)); cam.key(n, loc=(0.1, -1.05, 1.62), target=(0.2, 0.45, 1.62))
    return n


@shot
def sh28():
    """MAXIMUM SECURITY PRISON. - the prison at night: floodlights, razor wire, watchtowers, the sign."""
    n = frames_of("sh28")
    prison_night()
    cam = Cam(lens=24, loc=(1.5, -1.5, 1.4), target=(0.0, 12.0, 4.4), clip_end=3000)
    cam.key(1, loc=(1.5, -1.5, 1.4)); cam.key(n, loc=(0.8, 1.5, 3.2), target=(0.0, 12.0, 5.2))
    return n


@shot
def sh29():
    """So you get your own cell. - cell 7: the door swings shut on you; you wave goodbye, delighted."""
    n = frames_of("sh29")
    closeup()
    ep7.prison_cells()
    h = cell_door()
    key_rot(h, 1, (0, 0, -95)); key_rot(h, 16, (0, 0, 0))
    you = load_char("you_night", (1.05, 0.9, 0), rot_z=0, subdiv=True)
    you.clip("113_27", **src(n, 40))
    face(you, 1, dict(SMILE, cheekSquintLeft=0.5, cheekSquintRight=0.5))
    cam = Cam(lens=28, loc=(1.5, -2.3, 1.5), target=(1.15, 0.8, 1.3))
    cam.key(1, loc=(1.5, -2.3, 1.5)); cam.key(n, loc=(1.4, -1.7, 1.45))
    return n


@shot
def sh30():
    """Peace at last. - lights out: you lie on the bunk, eyes closed, smiling; moonlight through the bars."""
    n = frames_of("sh30")
    closeup()
    ep7.prison_cells()
    cell_door()
    cells_night()
    you = bunk_lie(subdiv=True)
    cam = Cam(lens=32, loc=(2.3, 1.0, 1.55), target=(1.7, 2.1, 0.85))
    cam.key(1, loc=(2.3, 1.0, 1.55)); cam.key(n, loc=(2.15, 1.35, 1.35))
    return n


@shot
def sh31():
    """That night, a garbage truck pulls into the prison. - headlights sweep up the road; the gates swing open."""
    n = frames_of("sh31")
    hinges = prison_night()
    truck, wheels = garbage_truck(headlights=True)
    drive_truck(truck, wheels, [(1, (0.0, -12.0), 90), (n, (0.0, 9.5), 90)], n)
    for h, s in zip(hinges, (-1, 1)):
        key_rot(h, 1, (0, 0, 0)); key_rot(h, 14, (0, 0, 0)); key_rot(h, 40, (0, 0, s * -88))
    cam = Cam(lens=26, loc=(-4.5, -20.0, 1.3), target=(0.0, 4.0, 2.0), clip_end=3000)
    cam.key(1, loc=(-4.5, -20.0, 1.3)); cam.key(n, loc=(-3.6, -12.0, 1.6), target=(0.0, 12.0, 2.6))
    return n


@shot
def sh32():
    """Your cell door CREAKS OPEN. - from the corridor: the barred door swings slowly open on you, asleep."""
    n = frames_of("sh32")
    closeup()
    ep7.prison_cells()
    h = cell_door()
    cells_night()
    key_rot(h, 1, (0, 0, 0)); key_rot(h, 6, (0, 0, -3)); key_rot(h, n, (0, 0, -78))
    you = bunk_lie(face_vals=SLEEP, subdiv=True)
    cam = Cam(lens=26, loc=(2.45, -1.75, 1.55), target=(1.15, 2.1, 0.78))
    cam.key(1, loc=(2.45, -1.75, 1.55)); cam.key(n, loc=(2.35, -1.25, 1.45), target=(1.25, 2.1, 0.8))
    return n


@shot
def sh33():
    """WE BROKE BACK IN. - your view from the bunk: Larry and garbage-covered Dale in the open doorway, grinning down."""
    n = frames_of("sh33")
    closeup()
    ep7.prison_cells()
    h = cell_door()
    h.rotation_euler = (0, 0, math.radians(-80))
    cells_night()
    pov = Vector((1.95, 2.12, 0.98))                                 # your point of view from the bunk (you are the camera)
    dale = escapee((1.78, -0.22, 0), rot_z=185, subdiv=True)
    dale.clip("137_41", **src(n, 4150))
    look_at(dale, empty("dalelook33", pov), 0.95)
    face(dale, 1, GRIN); blink(dale, [34])
    larry = load_char("larry", (2.22, -0.62, 0), rot_z=170, subdiv=True)
    larry.clip("113_27", **src(n, 40))
    look_at(larry, empty("larrylook33", pov), 0.9)
    ep4.sootify(larry, 0.22, skip=("eye", "body", "brow", "lash", "teeth", "tongue", "glasses"))
    face(larry, 1, CREEPY_ENJOY)
    point("doorlight", (1.9, -1.6, 2.4), energy=160, color=(1.0, 0.9, 0.7), radius=0.3, shadow=True)
    area("facesfill", (1.95, 1.6, 1.4), (1.95, -0.4, 1.55), energy=60, size=0.8, color=(0.75, 0.85, 1.0))
    cam = Cam(lens=24, loc=pov, target=(1.98, -0.35, 1.5))
    cam.key(1, loc=pov); cam.key(n, loc=pov + Vector((0.0, -0.45, 0.12)), target=(1.98, -0.35, 1.55))
    return n
