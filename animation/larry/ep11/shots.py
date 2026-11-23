"""Shot definitions for Episode 11 "Stepdad" (Dale is out of prison and follows you everywhere: a tank, the sun, the
moon, the ocean floor, the North Pole, heaven, hell, a hitman... and Mom's new husband). Same pipeline as episodes
1-10: imports the newest episode (10 -> 9 -> 8/7 -> 6 -> 4 -> 3 -> 2 -> 1) plus episode 5 (Earth, stars, rocket) and
episode 2's heaven gate and angel wings."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep5 = _load("ep5shots", "ep5")            # Earth, stars, rocket
ep10 = _load("ep10shots", "ep10")         # newest episode (its chain: 9, 8, 7, 6, 4, 3, 2, 1)
ep9, ep8, ep7, ep6, ep4, ep3, ep2, ep1 = ep10.ep9, ep10.ep8, ep10.ep7, ep10.ep6, ep10.ep4, ep10.ep3, ep10.ep2, ep10.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, TADA, SERENE, SLEEP,
                      face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, sit)  # noqa: E402
RAGE, STERN = ep1.RAGE, ep1.STERN
GRIN = ep6.GRIN
load_char, closeup, face_light, spot = ep9.load_char, ep9.closeup, ep9.face_light, ep9.spot
loop_move, RUN = ep9.loop_move, ep9.RUN

D11 = os.path.join(lib.SCRATCH, "ep11", "decals")
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


YELL = dict(RAGE, eyeWideLeft=1.0, eyeWideRight=1.0)
COLD = {"eyeSquintLeft": 0.6, "eyeSquintRight": 0.6, "mouthStretchLeft": 0.7, "mouthStretchRight": 0.7,
        "browInnerUp": 0.6, "mouthShrugUpper": 0.3}
JACKKNIFE = {"lfemur": {"rx": -128}, "rfemur": {"rx": -128}, "ltibia": {"rx": 4}, "rtibia": {"rx": 4},
             "lowerback": {"rx": 25}, "upperback": {"rx": 15}}


# ============================================================================ helpers
def stand(name, loc, rot_z, n, clip=("137_28", 2400), sd=True, tag=None):
    ch = load_char(name, loc, rot_z=rot_z, subdiv=sd, tag=tag)
    ch.clip(clip[0], **src(n, clip[1]))
    return ch


def jail_dale(loc=(0, 0, 0), rot_z=0.0, sd=True, tag="dale"):
    d = load_char("dale_jail", loc, rot_z=rot_z, subdiv=sd, tag=tag)
    ep2.chest_print(d, f"{ep7.D7}/inmate_no.png", width=0.2, name=f"inmate_{tag}")
    return d


def glow_mat(name, dark, bright, strength, scale=4.0, lo=0.35, hi=0.75):
    """Procedural noise surface whose bright parts glow (sun surface, lava cracks)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.8
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 8
    rp = nt.nodes.new("ShaderNodeValToRGB")
    rp.color_ramp.elements[0].position = lo; rp.color_ramp.elements[0].color = (*dark, 1)
    rp.color_ramp.elements[1].position = hi; rp.color_ramp.elements[1].color = (*bright, 1)
    nt.links.new(nz.outputs["Fac"], rp.inputs[0])
    nt.links.new(rp.outputs[0], b.inputs["Base Color"]); nt.links.new(rp.outputs[0], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = strength
    return m


def spatula(name="spatula"):
    root = empty(name)
    steel = mat_flat("spatsteel", (0.75, 0.76, 0.78), metal=0.9, rough=0.3)
    cylinder(f"{name}_h", 0.013, 0.22, (0, 0.11, 0), mat_flat("spathandle", (0.1, 0.1, 0.1)), rot=(90, 0, 0)).parent = root
    box(f"{name}_b", (0.09, 0.11, 0.004), (0, 0.27, 0), steel).parent = root
    return root


def roast_stick(name="stick"):
    root = empty(name)
    cylinder(f"{name}_s", 0.006, 0.8, (0, 0.4, 0), mat_flat("stickwood", (0.4, 0.28, 0.15)), rot=(90, 0, 0), verts=8).parent = root
    cylinder(f"{name}_m", 0.025, 0.04, (0, 0.78, 0), mat_flat("mallow", (0.98, 0.93, 0.82), rough=0.8), rot=(90, 0, 0), verts=16).parent = root
    return root


def shell(name="shell"):
    root = empty(name)
    brass = mat_flat("brass", (0.8, 0.6, 0.25), metal=1.0, rough=0.3)
    cylinder(f"{name}_c", 0.06, 0.3, (0, 0, 0), brass, rot=(0, 90, 0), verts=20).parent = root
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.06, depth=0.14, location=(0.22, 0, 0), rotation=(0, math.radians(90), 0))
    t = bpy.context.object; t.data.materials.append(mat_flat("tip", (0.25, 0.27, 0.22), metal=0.6)); t.parent = root
    return root


def tank_prop(name="tank11"):
    """Procedural battle tank, front +X: hull, tracks with road wheels, turret on a pivot, long gun.
    Returns (root, turret_pivot, muzzle_empty)."""
    root = empty(name)
    olive = mat_flat("olive11", (0.24, 0.27, 0.15), rough=0.7)
    dark = mat_flat("track11", (0.05, 0.05, 0.05), rough=0.9)
    box(f"{name}_hull", (5.8, 3.0, 0.9), (0, 0, 1.0), olive, bevel=0.08).parent = root
    box(f"{name}_glacis", (1.2, 2.9, 0.6), (2.75, 0, 1.15), olive, rot=(0, 30, 0), bevel=0.05).parent = root
    for s in (-1, 1):
        box(f"{name}_track{s}", (6.2, 0.7, 0.95), (0, s * 1.55, 0.48), dark, bevel=0.15).parent = root
        for k in range(6):
            cylinder(f"{name}_w{s}{k}", 0.33, 0.72, (-2.5 + k * 1.0, s * 1.55, 0.42), mat_flat("roadwheel", (0.18, 0.18, 0.16)),
                     rot=(90, 0, 0), verts=18).parent = root
    piv = empty(f"{name}_turret", (-0.3, 0, 1.45)); piv.parent = root
    cylinder(f"{name}_tbase", 1.25, 0.5, (0, 0, 0.25), olive, verts=32).parent = piv
    box(f"{name}_tbody", (2.2, 1.9, 0.55), (0.1, 0, 0.6), olive, bevel=0.12).parent = piv
    cylinder(f"{name}_gun", 0.1, 3.6, (2.9, 0, 0.6), olive, rot=(0, 90, 0), verts=16).parent = piv
    cylinder(f"{name}_brake", 0.15, 0.35, (4.6, 0, 0.6), dark, rot=(0, 90, 0), verts=16).parent = piv
    cylinder(f"{name}_hatch", 0.38, 0.08, (-0.5, 0.35, 0.92), olive, verts=20).parent = piv
    mz = empty(f"{name}_muzzle", (4.85, 0, 0.6)); mz.parent = piv
    return root, piv, mz


def muzzle_flash(loc, f):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.6, location=loc)
    fl = bpy.context.object
    fl.data.materials.append(mat_flat("flash", (1, 0.8, 0.4), emit=(1.0, 0.75, 0.3), emit_strength=25))
    fl.visible_shadow = False
    key_scale(fl, 1, 0.0, interp="CONSTANT"); key_scale(fl, f - 1, 0.0, interp="CONSTANT")
    key_scale(fl, f, 1.6); key_scale(fl, f + 3, 0.0)
    lt = point("flashlight", loc, energy=0, color=(1.0, 0.7, 0.3), radius=0.5)
    for ff, e in ((1, 0), (f - 1, 0), (f, 20000), (f + 4, 0)):
        lt.data.energy = e; lt.data.keyframe_insert("energy", frame=ff)
    return fl


# ============================================================================ sets
def day_street():
    """Episode 4's house in daylight, a few more houses and lamps down the street."""
    ep4.house_exterior(night=False, chimney=False)
    dark = mat_flat("windark11", (0.08, 0.1, 0.14), rough=0.1, metal=0.3)
    for i, x in enumerate((-17, 17, -30, 30)):
        wall = mat_tex(f"dh{i}_wall", "painted_plaster_wall", scale=1.0, tint=[(0.85, 0.9, 0.95), (0.95, 0.85, 0.75), (0.8, 0.88, 0.8), (0.95, 0.9, 0.82)][i])
        box(f"dh{i}", (9, 6, 3.0), (x, 6.5, 1.5), wall, uv_scale=0.4)
        box(f"dh{i}_roof", (9.4, 6.4, 0.2), (x, 6.5, 3.1), mat_flat("roof11", (0.25, 0.22, 0.22), rough=0.8))
        box(f"dh{i}_door", (1.0, 0.08, 2.1), (x, 3.47, 1.05), mat_flat(f"dh{i}_doorm", (0.2, 0.3, 0.45)), bevel=0.02)
        for wx in (-2.8, 2.8):
            box(f"dh{i}_win{wx}", (1.4, 0.06, 1.3), (x + wx, 3.47, 1.65), dark)
    plane("dwalk", (300, 1.8), (0, -2.1, 0.03), mat_tex("dwalkm", "rectangular_paving", scale=1.0), uv_scale=0.6)
    box("dcurb", (300, 0.15, 0.12), (0, -3.0, 0.06), mat_flat("dcurbm", (0.6, 0.6, 0.58)))


def sun_surface():
    world_color((0.0, 0.0, 0.0), 0.0)
    ep5.stars(400, 600, seed=3)
    plane("sunground", (400, 400), (0, 0, 0), glow_mat("sunsurf", (0.85, 0.12, 0.0), (1.0, 0.5, 0.03), 1.1, scale=0.6))
    rnd = random.Random(5)
    for k in range(10):                                    # solar flares: glowing arcs
        bpy.ops.mesh.primitive_torus_add(major_radius=rnd.uniform(3, 7), minor_radius=rnd.uniform(0.15, 0.35),
                                         location=(rnd.uniform(-40, 40), rnd.uniform(15, 60), 0), rotation=(math.radians(90), 0, rnd.uniform(0, 3)))
        bpy.context.object.data.materials.append(mat_flat("flare", (1, 0.4, 0.05), emit=(1.0, 0.35, 0.02), emit_strength=3))
    area("sunkey", (0, -6, 8), (0, 0, 1), energy=1800, size=6, color=(1.0, 0.75, 0.45))
    area("sunbounce", (0, 0, -0.5), (0, 0, 3), energy=600, size=10, color=(1.0, 0.55, 0.2))


def lounger(loc, rot_z=0.0):
    root = empty("lounger", loc); root.rotation_euler = (0, 0, math.radians(rot_z))
    fab = mat_flat("loungefab", (0.15, 0.55, 0.85), rough=0.8)
    frame = mat_flat("loungeframe", (0.9, 0.9, 0.9), metal=0.6)
    box("lng_seat", (0.6, 1.1, 0.06), (0, -0.2, 0.32), fab).parent = root
    box("lng_back", (0.6, 0.85, 0.06), (0, 0.62, 0.62), fab, rot=(-50, 0, 0)).parent = root
    for x in (-0.28, 0.28):
        for y in (-0.7, 0.5):
            cylinder(f"lng_leg{x}{y}", 0.015, 0.32, (x, y, 0.16), frame).parent = root
    return root


def moon_set():
    world_color((0.0, 0.0, 0.0), 0.0)
    ep5.stars(600, 700, seed=4)
    ep5.earth((-60, 260, 70), 28)
    ground = mat_tex("moonground", "coast_sand_01", scale=1.0, tint=(0.5, 0.5, 0.52))
    plane("moonplane", (400, 400), (0, 0, 0), ground, uv_scale=0.3)
    rnd = random.Random(2)
    rim = mat_flat("craterrim", (0.42, 0.42, 0.44), rough=1.0)
    for k in range(18):
        r = rnd.uniform(0.6, 3.0)
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=r * 0.18, location=(rnd.uniform(-25, 25), rnd.uniform(3, 50), 0.0))
        t = bpy.context.object; t.scale = (1, 1, 0.35); t.data.materials.append(rim)
    for k in range(12):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rnd.uniform(0.2, 0.9), location=(rnd.uniform(-15, 15), rnd.uniform(2, 30), 0))
        o = bpy.context.object; o.scale = (1.3, 1.0, 0.7); o.data.materials.append(rim)
    sun(energy=4.5, rot=(55, 0, 40), color=(1.0, 1.0, 0.98), angle=0.5)
    area("moonfill", (0, -8, 4), (0, 0, 1), energy=250, size=6, color=(0.7, 0.8, 1.0))


def ocean_floor(n):
    world_color((0.02, 0.18, 0.28), 1.0)
    plane("seabed", (200, 200), (0, 0, 0), mat_tex("seasand", "coast_sand_01", scale=1.0, tint=(0.75, 0.85, 0.8)), uv_scale=0.4)
    rnd = random.Random(6)
    weed = mat_flat("seaweed", (0.1, 0.45, 0.2), rough=0.6)
    for k in range(26):
        x, y = rnd.uniform(-5, 5), rnd.uniform(0.5, 9)
        h = rnd.uniform(0.8, 2.4)
        w = box(f"weed{k}", (0.06, 0.02, h), (x, y, h / 2), weed)
        ph = rnd.uniform(0, 6)
        for f in range(1, n + 1, 6):
            key_rot(w, f, (math.degrees(0.12 * math.sin(f * 0.25 + ph)), math.degrees(0.15 * math.sin(f * 0.2 + ph)), 0))
    rock = mat_flat("searock", (0.25, 0.3, 0.3), rough=0.9)
    for k in range(10):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rnd.uniform(0.3, 1.0), location=(rnd.uniform(-6, 6), rnd.uniform(1, 12), 0))
        o = bpy.context.object; o.scale = (1.4, 1.0, 0.6); o.data.materials.append(rock)
    bub = mat_flat("bubble", (0.8, 0.95, 1.0), rough=0.05, emit=(0.6, 0.85, 1.0), emit_strength=0.6, alpha=0.5)
    for k in range(30):
        x, y, z0 = rnd.uniform(-2.5, 2.5), rnd.uniform(-1, 5), rnd.uniform(0, 2)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.02, 0.06), location=(x, y, z0))
        b = bpy.context.object; b.data.materials.append(bub); b.visible_shadow = False
        key_loc(b, 1, (x, y, z0), interp="LINEAR"); key_loc(b, n, (x + 0.1, y, z0 + rnd.uniform(1.0, 2.0)), interp="LINEAR")
    sun(energy=2.2, rot=(10, 0, 0), color=(0.55, 0.85, 1.0))
    area("seakey", (0, -4, 6), (0, 2, 0), energy=900, size=8, color=(0.5, 0.85, 1.0))


def north_pole():
    world_color((0.72, 0.84, 0.97), 1.0)
    plane("snow", (300, 300), (0, 0, 0), mat_flat("snowm", (0.95, 0.97, 1.0), rough=0.9))
    red = mat_flat("polered", (0.85, 0.05, 0.08), rough=0.4)
    white = mat_flat("polewhite", (0.97, 0.97, 0.97), rough=0.4)
    for k in range(10):
        cylinder(f"pole{k}", 0.09, 0.25, (1.6, 1.0, 0.125 + k * 0.25), red if k % 2 == 0 else white, verts=20)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(1.6, 1.0, 2.6))
    bpy.context.object.data.materials.append(mat_flat("poleball", (0.95, 0.8, 0.3), metal=1.0, rough=0.25))
    decal("npsign", f"{D11}/sign_northpole.png", 1.2, (1.6, 0.9, 1.9), rot=(90, 0, 10))
    import bmesh
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.5, location=(-2.2, 4.0, 0))
    ig = bpy.context.object; ig.name = "igloo"
    bm = bmesh.new(); bm.from_mesh(ig.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS"); bm.to_mesh(ig.data); bm.free()
    ig.data.materials.append(mat_flat("ice", (0.9, 0.95, 1.0), rough=0.5)); bpy.ops.object.shade_smooth()
    box("iglooentry", (0.9, 0.9, 0.9), (-2.2, 2.6, 0.45), mat_flat("ice", (0.9, 0.95, 1.0), rough=0.5), bevel=0.2)
    box("igloodoor", (0.55, 0.02, 0.6), (-2.2, 2.14, 0.32), mat_flat("igloodark", (0.08, 0.1, 0.14)))
    rnd = random.Random(8)
    for k in range(60):                                    # snow drifts
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.4, 1.4), location=(rnd.uniform(-30, 30), rnd.uniform(6, 60), 0))
        o = bpy.context.object; o.scale = (2.0, 1.4, 0.35); o.data.materials.append(mat_flat("snowm2", (0.93, 0.96, 1.0), rough=0.9))
    sun(energy=3.2, rot=(60, 0, 30), color=(1.0, 0.98, 0.95))


def hell_set(n):
    world_color((0.12, 0.02, 0.01), 0.6)
    plane("hellground", (200, 200), (0, 0, 0), glow_mat("lava", (0.035, 0.018, 0.014), (1.0, 0.2, 0.0), 3.0, scale=1.4, lo=0.58, hi=0.61))
    rock = mat_flat("hellrock", (0.1, 0.05, 0.04), rough=0.9)
    rnd = random.Random(11)
    for k in range(16):
        h = rnd.uniform(2, 7)
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=rnd.uniform(0.6, 1.6), depth=h, location=(rnd.uniform(-14, 14), rnd.uniform(5, 30), h / 2))
        bpy.context.object.data.materials.append(rock)
    decal("hellsign", f"{D11}/sign_hell.png", 2.4, (-1.8, 3.0, 2.0), rot=(90, 0, 15), emit=0.6)
    cylinder("hellpost1", 0.06, 2.0, (-2.8, 3.25, 1.0), rock)
    cylinder("hellpost2", 0.06, 2.0, (-0.8, 2.75, 1.0), rock)
    fire = mat_flat("fire", (1, 0.3, 0.02), emit=(1.0, 0.25, 0.01), emit_strength=4.5)
    for k in range(14):                                    # flames dotted around
        x, y = rnd.uniform(-8, 8), rnd.uniform(4, 20)
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.4, depth=1.2, location=(x, y, 0.6))
        fl = bpy.context.object; fl.data.materials.append(fire); fl.visible_shadow = False
        for f in range(1, n + 1, 3):
            key_scale(fl, f, (1.0, 1.0, rnd.uniform(0.7, 1.4)))
    area("hellkey", (0, -5, 5), (0, 1, 1), energy=1400, size=6, color=(1.0, 0.45, 0.2))
    area("hellup", (0, 0, 0.2), (0, 0, 3), energy=500, size=10, color=(1.0, 0.3, 0.05))


def fire_pit(loc, n):
    x, y = loc
    log = mat_flat("log", (0.25, 0.15, 0.08), rough=0.9)
    for a in (0, 60, 120):
        cylinder(f"log{a}", 0.07, 0.8, (x, y, 0.08), log, rot=(90, 0, a), verts=10)
    fire = mat_flat("pitfire", (1, 0.3, 0.02), emit=(1.0, 0.25, 0.01), emit_strength=2.5)
    rnd = random.Random(4)
    for k in range(4):
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.18, depth=0.6, location=(x + rnd.uniform(-0.1, 0.1), y + rnd.uniform(-0.1, 0.1), 0.35))
        fl = bpy.context.object; fl.data.materials.append(fire); fl.visible_shadow = False
        for f in range(1, n + 1, 2):
            key_scale(fl, f, (1.0, 1.0, rnd.uniform(0.6, 1.5)))
    lt = point("pitlight", (x, y, 0.6), energy=200, color=(1.0, 0.5, 0.15), radius=0.3, shadow=True)
    for f in range(1, n + 1, 2):
        lt.data.energy = 150 + 100 * rnd.random(); lt.data.keyframe_insert("energy", frame=f)


def moms_house():
    """Mom's house in daylight (episode 4's house) with a real doorway cut into the front wall (a short warm hallway
    behind it), the MOM'S doormat (episode 9), and a front door hinged on the left that opens inward.
    Returns the hinge empty (rotate it +Z to open)."""
    ep4.house_exterior(night=False, chimney=False)
    house = bpy.data.objects["house"]
    d = bpy.data.objects.get("door")
    if d:
        d.hide_render = True; d.hide_viewport = True
    cut = box("doorcut", (1.0, 2.4, 2.1), (0, 4.65, 1.05))
    md = house.modifiers.new("doorhole", "BOOLEAN"); md.object = cut; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    cut.hide_viewport = False
    ep6.bake_mods(house)
    bpy.data.objects.remove(cut, do_unlink=True)
    lib._cube_uv(house, 0.4)
    trim = mat_flat("dframe", (0.95, 0.95, 0.95))
    for nm, sz, lc in (("dfl", (0.08, 0.14, 2.15), (-0.54, 3.47, 1.07)), ("dfr", (0.08, 0.14, 2.15), (0.54, 3.47, 1.07)),
                       ("dft", (1.16, 0.14, 0.08), (0, 3.47, 2.15))):
        box(nm, sz, lc, trim)
    box("hallend", (1.0, 0.1, 2.1), (0, 5.8, 1.05), mat_tex("hallwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.85, 0.72)), uv_scale=0.5)
    plane("hallfloor", (1.0, 2.4), (0, 4.65, 0.004), mat_tex("hallfl", "wood_floor", scale=1.0, tint=(0.7, 0.55, 0.42)), uv_scale=0.6)
    decal("matmom", f"{ep9.D9}/mat_mom.png", 0.95, (0, 2.95, 0.012), rot=(0, 0, 0))
    plane("porch", (2.4, 1.2), (0, 2.9, 0.008), mat_tex("porchm", "rectangular_paving", scale=1.0), uv_scale=0.6)
    h = empty("momdoor", (-0.5, 3.52, 0))
    box("momdoorpanel", (1.0, 0.05, 2.08), (0.5, 0.0, 1.04), mat_flat("momdoorm", (0.45, 0.12, 0.1), rough=0.4), bevel=0.02).parent = h
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0.88, -0.05, 1.0))
    k = bpy.context.object; k.data.materials.append(mat_flat("knob11", (0.85, 0.7, 0.3), metal=1.0, rough=0.25)); k.parent = h
    point("hallglow", (0, 4.9, 1.9), energy=160, color=(1.0, 0.85, 0.65), radius=0.3, shadow=True)
    return h


def stepdad(loc=(0, 3.62, 0), sd=True):
    """Dale in Mom's doorway: STEPDAD apron, spatula."""
    d = load_char("dale", loc, rot_z=0, subdiv=sd)
    ep2.chest_print(d, f"{D11}/apron_stepdad.png", width=0.48, y=-0.04, z=0.31, name="apron")
    on_bone(d, spatula(), "RightHand", (0.0, 0.08, 0.02), rot=(0, 0, 0))
    return d


# ============================================================================ SHOTS
@shot
def sh01():
    """You are so F***ING sick of DALE! - you yell at the lens; Dale peeks round the house behind you."""
    n = frames_of("sh01")
    closeup()
    day_street()
    you = stand("you_casual", (0.6, -1.2, 0), 0, n)
    for side, dx in (("Left", 0.25), ("Right", -0.25)):
        tg = empty(f"fist{side}", (0.6 + dx, -1.5, 1.25))
        for f in range(1, n + 1, 4):
            key_loc(tg, f, (0.6 + dx, -1.5, 1.25 + (0.06 if (f // 4) % 2 else 0.0)))
        hand_ik(you, side, tg)
        ep8.finger_pose(you, side, curl=105, thumb_up=False)
    for f in range(1, n + 1, 5):
        face(you, f, dict(YELL, jawOpen=1.0 if (f // 5) % 2 == 0 else 0.7))
    dale = jail_dale((-1.3, 2.6, 0), rot_z=-15, sd=False)
    dale.clip("137_28", **src(n, 2400))
    face(dale, 1, CREEPY)
    cam = Cam(lens=34, loc=(0.9, -3.6, 1.55), target=(0.4, -1.2, 1.45))
    cam.key(1, loc=(0.9, -3.6, 1.55)); cam.key(n, loc=(0.85, -3.2, 1.55))
    cam.shake(1, n, amp=0.02, freq=1.4)
    return n


@shot
def sh02():
    """Ever since he got out of prison, - the prison gates open; Dale strolls out, free, grinning."""
    n = frames_of("sh02")
    hinges = ep7.prison_exterior()
    for h, s in zip(hinges, (-1, 1)):
        h.rotation_euler = (0, 0, math.radians(s * -85))
    dale = jail_dale((0.0, 12.0, 0), rot_z=0, sd=True)
    dale.clip("07_01", **src(n, 60, speed=0.9, in_place=False))
    face(dale, 1, GRIN)
    closeup()
    cam = Cam(lens=30, loc=(1.2, 6.0, 1.0), target=(0.0, 11.0, 1.5))
    cam.key(1, loc=(1.2, 6.0, 1.0)); cam.key(n, loc=(1.0, 5.5, 1.05), target=(0.0, 10.0, 1.5))
    return n


@shot
def sh03():
    """he follows you EVERYWHERE. - walking down the street, Dale right on your heels, matching every step."""
    n = frames_of("sh03")
    closeup()
    day_street()
    you = load_char("you_casual", (6.0, -1.9, 0), rot_z=-90, subdiv=True)
    you.clip("07_01", **src(n, 60, speed=1.0, in_place=False))
    face(you, 1, UNEASY); face(you, 30, dict(UNEASY, browDownLeft=0.5))
    dale = jail_dale((7.0, -1.75, 0), rot_z=-90, sd=True)
    dale.clip("07_01", **src(n, 60, speed=1.0, in_place=False))
    face(dale, 1, CREEPY_ENJOY)
    cam = Cam(lens=26, loc=(4.6, -4.4, 1.55), target=(6.6, -1.8, 1.35))
    cam.key(1, loc=(4.6, -4.4, 1.55), interp="LINEAR"); cam.key(n, loc=(2.2, -4.4, 1.55), target=(4.2, -1.8, 1.35), interp="LINEAR")
    return n


@shot
def sh04():
    """So you buy a TANK and fire it at him. - the tank on the street swings its turret and fires."""
    n = frames_of("sh04")
    day_street()
    tk, piv, mz = tank_prop()
    tk.location = (-6.0, -6.4, 0)
    key_rot(piv, 1, (0, 0, 40)); key_rot(piv, 22, (0, 0, 0))
    you = load_char("you_casual", (0, 0, 0), rot_z=-90)
    you.hold("137_28", 2400)
    you.rig.parent = piv
    you.rig.location = (-0.5, 0.35, -0.45)
    you.rig.rotation_euler = (0, 0, math.radians(-90))
    face(you, 1, DETERMINED)
    f_fire = at("sh04", 7.75)
    bpy.context.view_layer.update()
    muzzle_flash(Vector((-6.0 - 0.3 + 4.85 + 0.2, -6.4, 1.45 + 0.6)), f_fire)
    cam = Cam(lens=26, loc=(1.5, -12.5, 1.2), target=(-4.0, -6.4, 1.8), clip_end=3000)
    cam.key(1, loc=(1.5, -12.5, 1.2)); cam.key(n, loc=(1.2, -11.8, 1.3))
    cam.shake(f_fire, f_fire + 8, amp=0.06, freq=2.0)
    return n


@shot
def sh05():
    """GENIUS! - you, half out of the tank hatch, give a big thumbs up."""
    n = frames_of("sh05")
    closeup()
    day_street()
    tk, piv, mz = tank_prop()
    tk.location = (0, 0, 0); tk.rotation_euler = (0, 0, math.radians(90))
    you = load_char("you_casual", (0, 0, 0), rot_z=0, subdiv=True)
    you.hold("137_28", 2400)
    you.rig.parent = piv
    you.rig.location = (-0.5, 0.35, -0.42)
    you.rig.rotation_euler = (0, 0, math.radians(-90))
    bpy.context.view_layer.update()
    hd = you.world("Head", frame=1)
    hand_ik(you, "Right", empty("thumbsup", (hd.x + 0.25, hd.y - 0.3, hd.z - 0.1)))
    ep8.finger_pose(you, "Right", curl=110, thumb_up=True)
    face(you, 1, TADA)
    cam = Cam(lens=40, loc=(hd.x + 0.4, hd.y - 1.9, hd.z + 0.1), target=(hd.x, hd.y, hd.z - 0.15))
    cam.key(1, loc=(hd.x + 0.4, hd.y - 1.9, hd.z + 0.1)); cam.key(n, loc=(hd.x + 0.35, hd.y - 1.6, hd.z + 0.1))
    return n


@shot
def sh06():
    """But Dale catches the shell and THROWS IT BACK. - one-handed catch, wind-up, and it's flying home."""
    n = frames_of("sh06")
    closeup()
    day_street()
    dale = jail_dale((2.0, -5.2, 0), rot_z=-90, sd=True)
    dale.hold("137_28", 2400)
    sh = shell()
    f_catch, f_back, f_throw = 12, 30, 38
    rh = dale.world("RightShoulder", frame=1)
    catch_p = Vector((rh.x - 0.55, rh.y - 0.15, rh.z - 0.05))
    back_p = Vector((rh.x + 0.35, rh.y - 0.1, rh.z + 0.35))
    throw_p = Vector((rh.x - 0.6, rh.y - 0.1, rh.z + 0.2))
    tg = empty("catchhand", catch_p)
    key_loc(tg, 1, catch_p + Vector((0.1, 0, -0.3))); key_loc(tg, f_catch - 3, catch_p)
    key_loc(tg, f_catch, catch_p); key_loc(tg, f_back, back_p); key_loc(tg, f_throw, throw_p); key_loc(tg, n, throw_p + Vector((0, 0, -0.3)))
    hand_ik(dale, "Right", tg)
    key_loc(sh, 1, catch_p + Vector((-9.0, 0, 0.6)), interp="LINEAR"); key_loc(sh, f_catch, catch_p, interp="LINEAR")
    key_loc(sh, f_back, back_p); key_loc(sh, f_throw, throw_p, interp="LINEAR"); key_loc(sh, n, throw_p + Vector((-12.0, 0, 0.8)), interp="LINEAR")
    key_rot(sh, 1, (0, 0, 0)); key_rot(sh, f_catch, (0, 0, 0)); key_rot(sh, f_throw, (0, 0, 180))
    face(dale, 1, DEADPAN); face(dale, f_catch + 2, SMUG); face(dale, f_throw, GRIN)
    cam = Cam(lens=32, loc=(1.2, -9.2, 1.45), target=(1.6, -5.2, 1.35))
    cam.key(1, loc=(1.2, -9.2, 1.45)); cam.key(n, loc=(1.0, -8.6, 1.45))
    return n


@shot
def sh07():
    """So you fly to the SUN. - your rocket burns through space toward a gigantic sun."""
    n = frames_of("sh07")
    world_color((0.0, 0.0, 0.0), 0.0)
    ep5.stars(700, 800, seed=7)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=80, location=(0, 420, 30))
    s = bpy.context.object; s.data.materials.append(glow_mat("sunball", (0.9, 0.18, 0.0), (1.0, 0.55, 0.04), 2.5, scale=2.0))
    bpy.ops.object.shade_smooth()
    rk, flames = ep5.rocket("rocket11")
    rk.rotation_euler = (math.radians(-90), 0, 0)
    key_loc(rk, 1, (0, 0, 0), interp="LINEAR"); key_loc(rk, n, (0, 40, 2), interp="LINEAR")
    sun(energy=3.0, rot=(-80, 0, 0), color=(1.0, 0.8, 0.55))
    cam = Cam(lens=28, loc=(3.0, -14.0, 3.5), target=(0, 20.0, 2.0), clip_end=5000)
    cam.key(1, loc=(3.0, -14.0, 3.5), interp="LINEAR"); cam.key(n, loc=(3.0, 18.0, 3.8), target=(0, 60, 4), interp="LINEAR")
    return n


@shot
def sh08():
    """CLEVER! - you on the blazing surface of the sun, sunglasses on, very pleased with yourself."""
    n = frames_of("sh08")
    closeup()
    sun_surface()
    you = stand("you_casual", (0, 0, 0), 0, n)
    ep6.wear_shades(you)
    face(you, 1, SMUG)
    cam = Cam(lens=40, loc=(0.4, -2.4, 1.5), target=(0.0, 0.0, 1.45))
    cam.key(1, loc=(0.4, -2.4, 1.5)); cam.key(n, loc=(0.35, -2.1, 1.5))
    return n


@shot
def sh09():
    """But Dale is already there, working on his tan. - Dale on a sun lounger, shades on, soaking it up."""
    n = frames_of("sh09")
    closeup()
    sun_surface()
    lounger((0, 0.5, 0), rot_z=0)
    dale = jail_dale((0, 0, 0), rot_z=0, sd=True)
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-58), 0, 0)
    dale.rig.location = (0.0, -0.45, 0.45)
    look_at(dale, empty("skylook", (0.8, -2.5, 2.4)), 0.8)
    ep6.wear_shades(dale)
    face(dale, 1, dict(SERENE, mouthSmileLeft=0.7, mouthSmileRight=0.7))
    cam = Cam(lens=32, loc=(1.6, -2.4, 1.3), target=(0.0, 0.0, 0.7))
    cam.key(1, loc=(1.6, -2.4, 1.3)); cam.key(n, loc=(1.2, -1.9, 1.2))
    return n


@shot
def sh10():
    """So you RUN. - across the moon, Earth hanging in the black sky."""
    n = frames_of("sh10")
    closeup()
    moon_set()
    you = load_char("you_casual", subdiv=True)
    v = loop_move(you, n, *RUN, 16, (2.0, 2.0, 0), -90)
    face(you, 1, SHOCK)
    cam = Cam(lens=26, loc=(1.0, -2.2, 0.8), target=(1.5, 2.0, 1.2), clip_end=3000)
    d = -v * (n - 1)
    cam.key(1, loc=(1.0, -2.2, 0.8), target=(1.5, 2.0, 1.2), interp="LINEAR")
    cam.key(n, loc=(1.0 + d, -2.2, 0.8), target=(1.5 + d, 2.0, 1.2), interp="LINEAR")
    return n


@shot
def sh11():
    """The moon? - you on the moon, catching your breath: finally alone."""
    n = frames_of("sh11")
    closeup()
    moon_set()
    you = stand("you_casual", (0, 0, 0), 0, n)
    face(you, 1, SERENE)
    cam = Cam(lens=30, loc=(0.6, -2.6, 1.4), target=(0.0, 0.0, 1.35), clip_end=3000)
    cam.key(1, loc=(0.6, -2.6, 1.4)); cam.key(n, loc=(0.5, -2.3, 1.4))
    return n


@shot
def sh12():
    """DALE. - Dale right behind you on the moon, waving."""
    n = frames_of("sh12")
    closeup()
    moon_set()
    dale = jail_dale((0, 0, 0), rot_z=0, sd=True)
    dale.clip("113_27", **src(n, 80))
    face(dale, 1, GRIN)
    hd = dale.world("Head", frame=1)
    cam = Cam(lens=40, loc=(0.3, -1.9, hd.z - 0.05), target=(0.0, 0.0, hd.z - 0.15), clip_end=3000)
    cam.key(1, loc=(0.3, -1.9, hd.z - 0.05)); cam.key(n, loc=(0.25, -1.7, hd.z - 0.05))
    face_light(cam, energy=150, size=1.0)
    return n


@shot
def sh13():
    """The bottom of the ocean? - you on the seabed among the weed, bubbles rising."""
    n = frames_of("sh13")
    closeup()
    ocean_floor(n)
    you = stand("you_casual", (0, 2.0, 0), 0, n)
    face(you, 1, dict(UNEASY, mouthPucker=0.6, cheekPuff=0.7))
    cam = Cam(lens=30, loc=(0.6, -0.8, 1.4), target=(0.0, 2.0, 1.25))
    cam.key(1, loc=(0.6, -0.8, 1.4)); cam.key(n, loc=(0.5, -0.4, 1.35))
    return n


@shot
def sh14():
    """DALE. - Dale waving from between the seaweed."""
    n = frames_of("sh14")
    closeup()
    ocean_floor(n)
    dale = jail_dale((0.3, 2.5, 0), rot_z=0, sd=True)
    dale.clip("113_27", **src(n, 80))
    face(dale, 1, dict(GRIN, cheekPuff=0.6))
    cam = Cam(lens=36, loc=(0.4, 0.3, 1.5), target=(0.3, 2.5, 1.45))
    cam.key(1, loc=(0.4, 0.3, 1.5)); cam.key(n, loc=(0.35, 0.55, 1.5))
    face_light(cam, energy=120, size=1.0)
    return n


@shot
def sh15():
    """The North Pole? - you hug yourself by the striped pole, teeth chattering."""
    n = frames_of("sh15")
    closeup()
    north_pole()
    you = stand("you_casual", (0.5, 0.7, 0), 0, n)
    sp = you.world("Spine1", frame=1)
    for side, dx in (("Left", -0.12), ("Right", 0.12)):
        tg = empty(f"hug{side}", (sp.x + dx, sp.y - 0.18, sp.z + 0.05))
        for f in range(1, n + 1, 2):
            key_loc(tg, f, (sp.x + dx + (0.015 if f % 4 == 1 else -0.015), sp.y - 0.18, sp.z + 0.05))
        hand_ik(you, side, tg)
    face(you, 1, COLD)
    cam = Cam(lens=30, loc=(0.9, -2.0, 1.5), target=(0.9, 0.8, 1.4))
    cam.key(1, loc=(0.9, -2.0, 1.5)); cam.key(n, loc=(0.85, -1.7, 1.5))
    return n


@shot
def sh16():
    """DALE. - Dale crawls out of the igloo and waves."""
    n = frames_of("sh16")
    closeup()
    north_pole()
    dale = jail_dale((-2.2, 1.7, 0), rot_z=0, sd=True)
    dale.clip("113_27", **src(n, 80))
    face(dale, 1, GRIN)
    cam = Cam(lens=32, loc=(-1.7, -1.2, 1.5), target=(-2.2, 1.9, 1.3))
    cam.key(1, loc=(-1.7, -1.2, 1.5)); cam.key(n, loc=(-1.75, -0.9, 1.5))
    face_light(cam, energy=150, size=1.0)
    return n


@shot
def sh17():
    """So you die and go to HEAVEN. - you, halo and wings, walk up to the pearly gates."""
    n = frames_of("sh17")
    closeup()
    ep2.heaven_set()
    you = load_char("you_casual", (0.0, -1.0, 0), rot_z=180, subdiv=True)
    you.clip("07_01", **src(n, 60, speed=0.7, in_place=False))
    ep2.angelify(you)
    cam = Cam(lens=28, loc=(0.8, -4.5, 1.6), target=(0.0, 3.0, 1.8))
    cam.key(1, loc=(0.8, -4.5, 1.6)); cam.key(n, loc=(0.6, -3.6, 1.6))
    return n


@shot
def sh18():
    """PERFECT! - close on you, halo glowing, blissed out."""
    n = frames_of("sh18")
    closeup()
    ep2.heaven_set()
    you = stand("you_casual", (0.0, 1.5, 0), 0, n)
    ep2.angelify(you)
    face(you, 1, dict(SERENE, mouthSmileLeft=0.8, mouthSmileRight=0.8))
    hd = you.world("Head", frame=1)
    cam = Cam(lens=42, loc=(0.3, hd.y - 1.6, hd.z + 0.05), target=(hd.x, hd.y, hd.z))
    cam.key(1, loc=(0.3, hd.y - 1.6, hd.z + 0.05)); cam.key(n, loc=(0.25, hd.y - 1.35, hd.z + 0.05))
    return n


@shot
def sh19():
    """But the angel at the gate is DALE. - the gates swing open: angel Dale, wings out, arms wide."""
    n = frames_of("sh19")
    closeup()
    ep2.heaven_set(gate_open_frames=(4, 24))
    dale = jail_dale((0.0, 4.6, 0), rot_z=0, sd=True)
    dale.clip("137_41", **src(n, 4150))
    ep2.angelify(dale)
    for side, dx in (("Left", 0.75), ("Right", -0.75)):
        tg = empty(f"wide{side}", (dx, 4.4, 1.6))
        key_loc(tg, 1, (dx * 0.3, 4.4, 1.0)); key_loc(tg, 24, (dx * 0.3, 4.4, 1.0)); key_loc(tg, 36, (dx, 4.4, 1.65))
        hand_ik(dale, side, tg)
    face(dale, 1, GRIN)
    cam = Cam(lens=30, loc=(0.3, 0.6, 1.5), target=(0.0, 4.6, 1.6))
    cam.key(1, loc=(0.3, 0.6, 1.5)); cam.key(n, loc=(0.25, 1.4, 1.55))
    return n


@shot
def sh20():
    """So you go to HELL. - fire, lava cracks, WELCOME TO HELL: you arrive."""
    n = frames_of("sh20")
    closeup()
    hell_set(n)
    you = load_char("you_casual", (0.6, 0.2, 0), rot_z=180, subdiv=True)
    you.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    cam = Cam(lens=26, loc=(1.5, -3.5, 1.4), target=(0.0, 3.0, 1.6))
    cam.key(1, loc=(1.5, -3.5, 1.4)); cam.key(n, loc=(1.3, -3.0, 1.4))
    return n


@shot
def sh21():
    """MUCH BETTER! - you in hell, smiling: at least Dale isn't here."""
    n = frames_of("sh21")
    closeup()
    hell_set(n)
    you = stand("you_casual", (0.0, 0.5, 0), 0, n)
    face(you, 1, SMILE)
    hd = you.world("Head", frame=1)
    cam = Cam(lens=38, loc=(0.4, hd.y - 2.0, hd.z), target=(hd.x, hd.y, hd.z - 0.2))
    cam.key(1, loc=(0.4, hd.y - 2.0, hd.z)); cam.key(n, loc=(0.35, hd.y - 1.7, hd.z))
    return n


@shot
def sh22():
    """But the guy roasting marshmallows is DALE. - Dale by the fire pit, marshmallow on a stick, grinning."""
    n = frames_of("sh22")
    closeup()
    hell_set(n)
    fire_pit((0.0, 0.6), n)
    dale = jail_dale((0.0, -0.25, 0), rot_z=180, sd=True)
    sit(dale, 0.42)
    box("hellstool", (0.45, 0.4, 0.42), (0.0, -0.3, 0.21), mat_flat("stoolrock", (0.12, 0.06, 0.04), rough=0.9))
    st = roast_stick()
    on_bone(dale, st, "RightHand", (0.0, 0.04, 0.02), rot=(-75, 0, 0))
    hand_ik(dale, "Right", empty("roasthand", (0.12, 0.12, 0.85)))
    face(dale, 1, CREEPY_ENJOY); blink(dale, [40])
    cam = Cam(lens=32, loc=(0.9, 1.9, 1.15), target=(0.0, -0.2, 0.9))
    cam.key(1, loc=(0.9, 1.9, 1.15)); cam.key(n, loc=(0.7, 1.6, 1.1))
    face_light(cam, energy=25, size=1.0, color=(1.0, 0.75, 0.55))
    return n


@shot
def sh23():
    """So you hire a HITMAN, - black suit, dark glasses: the hitman walks down the street toward us."""
    n = frames_of("sh23")
    closeup()
    day_street()
    hm = load_char("bodyguard", (2.0, -0.5, 0), rot_z=-90, subdiv=True)
    hm.clip("07_01", **src(n, 60, speed=0.7, in_place=False))
    face(hm, 1, STERN)
    cam = Cam(lens=30, loc=(-2.0, -1.4, 1.0), target=(1.0, -0.6, 1.6))
    cam.key(1, loc=(-2.0, -1.4, 1.0)); cam.key(n, loc=(-2.4, -1.5, 1.0), target=(0.2, -0.6, 1.6))
    return n


@shot
def sh24():
    """the best in the business. - close: the hitman cracks his knuckles."""
    n = frames_of("sh24")
    closeup()
    day_street()
    hm = stand("bodyguard", (0.0, 0.0, 0), 0, n)
    sp = hm.world("Spine1", frame=1)
    for side, dx in (("Left", -0.03), ("Right", 0.03)):
        tg = empty(f"knuckle{side}", (sp.x + dx, sp.y - 0.35, sp.z + 0.05))
        for f in range(1, n + 1, 6):
            key_loc(tg, f, (sp.x + dx * (1 if (f // 6) % 2 else 2), sp.y - 0.35, sp.z + 0.05))
        hand_ik(hm, side, tg)
    face(hm, 1, STERN)
    hd = hm.world("Head", frame=1)
    cam = Cam(lens=36, loc=(0.4, -2.0, hd.z - 0.2), target=(0.0, 0.0, hd.z - 0.35))
    cam.key(1, loc=(0.4, -2.0, hd.z - 0.2)); cam.key(n, loc=(0.3, -1.7, hd.z - 0.2))
    return n


@shot
def sh25():
    """But Dale folds him like a LAWN CHAIR. - the hitman folded double on the pavement; Dale dusts off his hands."""
    n = frames_of("sh25")
    closeup()
    day_street()
    hm = load_char("bodyguard", (0, 0, 0), rot_z=0)
    pose(hm, JACKKNIFE)
    hm.rig.rotation_mode = "XYZ"
    hm.rig.rotation_euler = (math.radians(-90), 0, math.radians(90))
    hm.rig.location = (0.4, -1.0, 0.25)
    dale = jail_dale((-0.9, -0.6, 0), rot_z=-60, sd=True)
    dale.hold("137_28", 2400)
    sp = dale.world("Spine1", frame=1)
    for side, dx in (("Left", 0.04), ("Right", -0.04)):
        tg = empty(f"dust{side}", (sp.x + dx, sp.y - 0.3, sp.z - 0.1))
        for f in range(1, n + 1, 3):
            key_loc(tg, f, (sp.x + dx + (0.06 if (f // 3) % 2 else -0.06) * (1 if side == "Left" else -1), sp.y - 0.3, sp.z - 0.1))
        hand_ik(dale, side, tg)
    face(dale, 1, SMUG)
    cam = Cam(lens=28, loc=(1.8, -3.6, 1.4), target=(-0.2, -0.8, 0.8))
    cam.key(1, loc=(1.8, -3.6, 1.4)); cam.key(n, loc=(1.6, -3.2, 1.35))
    return n


@shot
def sh26():
    """So you run home to your MOM. - sprinting down the street toward Mom's house."""
    n = frames_of("sh26")
    closeup()
    ep4.house_exterior(night=False, chimney=False)
    you = load_char("you_casual", subdiv=True)
    v = loop_move(you, n, *RUN, 16, (10.0, -1.9, 0), -90)
    face(you, 1, dict(UNEASY, jawOpen=0.4))
    cam = Cam(lens=28, loc=(6.0, -3.6, 1.2), target=(10.0, -1.9, 1.3))
    d = -v * (n - 1)
    cam.key(1, loc=(6.0, -3.6, 1.2), target=(10.0, -1.9, 1.3), interp="LINEAR")
    cam.key(n, loc=(6.0 + d * 0.6, -3.6, 1.2), target=(10.0 + d, -1.9, 1.3), interp="LINEAR")
    return n


@shot
def sh27():
    """The one place Dale would never go. - you on Mom's doorstep (MOM'S mat), relieved, knocking."""
    n = frames_of("sh27")
    closeup()
    moms_house()
    you = load_char("you_casual", (0.1, 2.75, 0), rot_z=180, subdiv=True)
    you.hold("137_28", 2400)
    tg = empty("knock", (0.35, 3.35, 1.4))
    for f in range(1, n + 1, 5):
        key_loc(tg, f, (0.35, 3.33 if (f // 5) % 2 else 3.4, 1.4))
    hand_ik(you, "Right", tg)
    look_at(you, empty("backlook", (2.5, -1.0, 1.5)), 0.0)
    face(you, 1, dict(SERENE, eyeBlinkLeft=0.2, eyeBlinkRight=0.2))
    cam = Cam(lens=30, loc=(1.6, 0.6, 1.5), target=(0.1, 3.0, 1.4))
    cam.key(1, loc=(1.6, 0.6, 1.5)); cam.key(n, loc=(1.4, 0.95, 1.5))
    return n


@shot
def sh28():
    """She opens the door. - the front door swings open into the warm hallway..."""
    n = frames_of("sh28")
    closeup()
    h = moms_house()
    key_rot(h, 1, (0, 0, 0)); key_rot(h, 6, (0, 0, 0)); key_rot(h, n, (0, 0, 70))
    you = load_char("you_casual", (0.1, 2.7, 0), rot_z=180)
    you.hold("137_28", 2400)
    dale = stepdad((0.05, 4.05, 0), sd=False)
    dale.hold("137_28", 2400)
    face(dale, 1, CREEPY_ENJOY)
    cam = Cam(lens=30, loc=(0.75, 1.05, 1.65), target=(0.0, 3.6, 1.35))
    cam.key(1, loc=(0.75, 1.05, 1.65)); cam.key(n, loc=(0.65, 1.3, 1.6))
    return n


@shot
def sh29():
    """Honey, meet your new STEPDAD. - Dale in the doorway: WORLD'S BEST STEPDAD apron, spatula, huge grin."""
    n = frames_of("sh29")
    closeup()
    h = moms_house()
    h.rotation_euler = (0, 0, math.radians(75))
    dale = stepdad((0.05, 3.9, 0))
    dale.hold("137_28", 2400)
    hand_ik(dale, "Right", empty("spatup", (-0.25, 3.62, 1.3)))
    look_at(dale, empty("lookcam29", (0.3, 1.5, 1.5)), 0.85)
    face(dale, 1, GRIN)
    cam = Cam(lens=32, loc=(0.3, 1.5, 1.5), target=(0.05, 3.7, 1.25))
    cam.key(1, loc=(0.3, 1.5, 1.5)); cam.key(n, loc=(0.25, 1.85, 1.5))
    face_light(cam, energy=90, size=0.9)
    return n


@shot
def sh30():
    """HI, SON. - close on Dale, waving the spatula."""
    n = frames_of("sh30")
    closeup()
    h = moms_house()
    h.rotation_euler = (0, 0, math.radians(75))
    dale = stepdad((0.05, 3.9, 0))
    dale.hold("137_28", 2400)
    tg = empty("wavespat", (-0.3, 3.62, 1.65))
    for f in range(1, n + 1, 6):
        key_loc(tg, f, (-0.3 + (0.1 if (f // 6) % 2 else 0.0), 3.62, 1.65))
    hand_ik(dale, "Right", tg)
    face(dale, 1, GRIN); face(dale, 8, dict(CREEPY_ENJOY, eyeBlinkLeft=0.0, eyeBlinkRight=0.0))
    hd = dale.world("Head", frame=1)
    look_at(dale, empty("lookcam30", (0.15, hd.y - 1.4, hd.z)), 0.9)
    cam = Cam(lens=45, loc=(0.15, hd.y - 1.4, hd.z), target=(hd.x, hd.y, hd.z - 0.08))
    cam.key(1, loc=(0.15, hd.y - 1.4, hd.z)); cam.key(n, loc=(0.12, hd.y - 1.15, hd.z))
    face_light(cam, energy=100, size=0.9)
    return n
