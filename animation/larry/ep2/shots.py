"""Shot definitions for Episode 2 "Larry & Dale". Each shot builds its full scene; ep2/render_shot.py renders it.
Same conventions as episode 1 (scripts/shots.py): characters come from build_character.py recipes, motion from CMU
mocap, props/skies from Poly Haven, 720x1280 Eevee renders upscaled in assemble.sh.

Episode 1's set builders and helpers (office_set, interior_set, expressions, face/blink/look_at/hand_ik, src ...)
are imported from scripts/shots.py and reused unchanged, so recurring places look identical.

NOTE: written without Blender available (the session's network blocked Blender/MPFB/CMU). Every shot still needs
the usual preview pass (preview_all.sh) - bone-space prop offsets and the new static poses are first guesses."""
import bpy, math, os, random, sys, importlib.util, tempfile
from mathutils import Vector
import lib, mocap
from lib import (load_char, empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale, fit, bbox)
from cuts import CUTS

_spec = importlib.util.spec_from_file_location("ep1shots", os.path.join(os.path.dirname(lib.__file__), "shots.py"))
ep1 = importlib.util.module_from_spec(_spec)
sys.modules["ep1shots"] = ep1
_spec.loader.exec_module(ep1)
from ep1shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, STERN, SHOCK, DEADPAN, SLEEP, WINK, TADA,
                      OOF, blink, look_at, hand_ik, src)  # noqa: E402

D2 = os.path.join(lib.SCRATCH, "ep2", "decals")
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
    """Frame (1-based, inside shot `name`) for absolute timeline time t (seconds)."""
    t0 = dict(CUTS)[name]
    return max(1, round((t - t0) * lib.FPS) + 1)


# ============================================================================ new expressions
LOVESTRUCK = {"mouthSmileLeft": 0.7, "mouthSmileRight": 0.7, "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
              "browInnerUp": 0.9, "cheekSquintLeft": 0.45, "cheekSquintRight": 0.45, "mouthPucker": 0.35}
DOGGY = {"jawOpen": 0.45, "tongueOut": 0.9, "mouthSmileLeft": 0.8, "mouthSmileRight": 0.8, "eyeWideLeft": 0.6,
         "eyeWideRight": 0.6, "browInnerUp": 0.7}
SERENE = {"eyeBlinkLeft": 0.55, "eyeBlinkRight": 0.55, "mouthSmileLeft": 0.45, "mouthSmileRight": 0.45,
          "browInnerUp": 0.2}
TIRED = {"eyeBlinkLeft": 0.7, "eyeBlinkRight": 0.7, "mouthFrownLeft": 0.2, "mouthFrownRight": 0.2}
NEUTRAL = dict(ep1.NEUTRAL)
for _d in (LOVESTRUCK, DOGGY, SERENE, TIRED):
    NEUTRAL.update({k: 0.0 for k in _d})


def face(ch, frame, values):
    """Set an expression (zeroing every other key, including the episode-2 ones) at a frame."""
    v = dict(NEUTRAL)
    v.update(values)
    ch.expr(frame, v)


def lipsync(ch, f_of_t, syllables, base=CREEPY):
    """Mouth the line: syllables = [(t_start, t_end, openness, funnel)] on the absolute timeline."""
    for (a, b, op, fun) in syllables:
        fa, fm, fb = f_of_t(a), f_of_t((a + b) / 2), f_of_t(b)
        ch.expr(fa, {"jawOpen": 0.04, "mouthFunnel": 0.0})
        ch.expr(fm, {"jawOpen": op, "mouthFunnel": fun})
        ch.expr(fb, {"jawOpen": 0.04, "mouthFunnel": 0.0})


# ============================================================================ static poses from edited mocap frames
SIT = {"lfemur": {"rx": -88}, "rfemur": {"rx": -88}, "ltibia": {"rx": 88}, "rtibia": {"rx": 88}}
SQUAT = {"lfemur": {"rx": -115, "rz": 12}, "rfemur": {"rx": -115, "rz": -12}, "ltibia": {"rx": 125},
         "rtibia": {"rx": 125}, "lowerback": {"rx": 18}}
ALL_FOURS = {"root": {"rx": 88}, "lfemur": {"rx": -90}, "rfemur": {"rx": -90}, "ltibia": {"rx": 92},
             "rtibia": {"rx": 92}, "lowerneck": {"rx": -35}, "upperneck": {"rx": -25}}


def pose(ch, overrides, base=("137_41", 4200), name=None):
    """Static pose: one CMU frame (base clip/frame) with some joints replaced (degrees, ASF dof names).
    The root rotation is zeroed first (character faces -Y), then root overrides apply. Same retarget as clips.
    CMU conventions: femur rx < 0 swings the thigh forward, tibia rx > 0 bends the knee, root rx > 0 pitches
    the body forward. VERIFY each pose with clip_strip.py / preview before the full render."""
    clip, fr = base
    asf = f"{lib.CMU}/{clip.split('_')[0]}.asf"
    skel = mocap.parse_asf(asf)
    src_fr = mocap.parse_amc(f"{lib.CMU}/{clip}.amc")[fr]
    f = {k: list(v) for k, v in src_fr.items()}
    f["root"] = f["root"][:3] + [0.0, 0.0, 0.0]
    for bone, vals in overrides.items():
        dofs = ["tx", "ty", "tz", "rx", "ry", "rz"] if bone == "root" else skel["bones"][bone]["dof"]
        cur = f.get(bone, [0.0] * len(dofs))
        for k, v in vals.items():
            cur[dofs.index(k)] = v
        f[bone] = cur
    nm = name or f"{ch.name}_pose_{abs(hash(str(sorted(overrides.items())))) % 10**8}"
    p = os.path.join(tempfile.gettempdir(), nm + ".amc")
    with open(p, "w") as fh:
        fh.write(":FULLY-SPECIFIED\n:DEGREES\n1\n")
        for b in skel["order"]:
            if b in f:
                fh.write(b + " " + " ".join(f"{v:.4f}" for v in f[b]) + "\n")
    act = mocap.retarget(ch.rig, asf, p, nm, step=1, in_place=True, face=False)
    ch.rig.animation_data_create()
    ch.rig.animation_data.action = act
    return act


def settle(ch, bone, z, frame=1):
    """Move the rig vertically so `bone`'s head sits at world height z (seat, floor, lap)."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    dz = z - ch.world(bone).z
    ch.rig.location.z += dz
    return dz


def sit(ch, seat_z):
    pose(ch, SIT)
    settle(ch, "Hips", seat_z + 0.1)


def on_bone(ch, obj, bone, loc, rot=(-90, 0, 0)):
    """Glue a prop to a bone (identity-inverse Child Of, as in episode 1). loc/rot are in bone space:
    bone +Y runs along the bone (up for spine/head), +Z is face-forward. rot (-90,0,0) maps a prop modelled
    Z-up / front -Y onto the bone."""
    ch.attach(obj, bone, keep_world=False)
    obj.location = Vector(loc)
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def turn_around(ch, f0, f1, z0=180.0, z1=0.0):
    """Spin the whole character about its own vertical axis between frames (back-to-camera reveal)."""
    key_rot(ch.rig, 1, (0, 0, z0))
    key_rot(ch.rig, f0, (0, 0, z0))
    key_rot(ch.rig, f1, (0, 0, z1))


def stare_at(ch, target, f0, f1, influence=1.0):
    c = look_at(ch, target, 0.0)
    c.influence = 0.0; c.keyframe_insert("influence", frame=max(1, f0))
    c.influence = influence; c.keyframe_insert("influence", frame=f1)
    return c


# ============================================================================ props
def cap(color=(0.06, 0.09, 0.2), badge=(0.9, 0.75, 0.2)):
    """Peaked uniform cap (bus driver / passport officer), modelled Z-up, brim toward -Y, origin at the head top."""
    m = mat_flat("cap", color, rough=0.55)
    root = empty("cap", (0, 0, 0))
    c = cylinder("cap_crown", 0.105, 0.075, (0, 0.01, 0.035), m, verts=24); c.scale = (1.0, 1.12, 1.0); c.parent = root
    t = cylinder("cap_top", 0.118, 0.02, (0, 0.012, 0.08), m, verts=24); t.scale = (1.0, 1.15, 1.0); t.parent = root
    b = box("cap_brim", (0.19, 0.09, 0.008), (0, -0.115, 0.005), mat_flat("brim", (0.02, 0.02, 0.02), rough=0.2),
            rot=(-12, 0, 0), bevel=0.003); b.parent = root
    s = box("cap_badge", (0.04, 0.006, 0.03), (0, -0.112, 0.05), mat_flat("capbadge", badge, rough=0.25, metal=0.9))
    s.parent = root
    return root


def halo():
    bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.012, location=(0, 0, 0))
    h = bpy.context.object; h.name = "halo"; bpy.ops.object.shade_smooth()
    h.data.materials.append(mat_flat("halo", (1.0, 0.85, 0.3), emit=(1.0, 0.82, 0.35), emit_strength=6))
    return h


def wings():
    """Feathered angel wings from layered, flattened ellipsoids. Z-up, behind the back is +Y, span along X."""
    feather = mat_flat("feather", (0.97, 0.96, 0.93), rough=0.75)
    root = empty("wings", (0, 0, 0))
    for side in (-1, 1):
        for i in range(6):
            a = math.radians(15 + i * 13)
            L = 0.75 - i * 0.07
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0)
            f = bpy.context.object; f.name = f"feather_{side}_{i}"
            f.scale = (L / 2, 0.025, 0.09 - i * 0.006)
            f.rotation_euler = (0, -side * a, 0)
            f.location = (side * (0.12 + math.cos(a) * L * 0.45), 0.08 + i * 0.01, 0.1 + math.sin(a) * L * 0.45)
            bpy.ops.object.shade_smooth()
            f.data.materials.append(feather)
            f.parent = root
    return root


def angelify(ch, head_y=0.25, wings_y=0.05):
    """Halo over the head and wings on the back (bone-space offsets: tune in preview)."""
    on_bone(ch, halo(), "Head", (0, head_y, 0.0))
    on_bone(ch, wings(), "Spine1", (0, wings_y, -0.12))


def chest_print(ch, img, width=0.27, y=0.06, z=0.15, name="print"):
    """Flat decal on the chest (T-shirt print / lanyard badge). Plane normal is bone +Z (forward)."""
    d = decal(name, img, width, (0, 0, 0), rot=(0, 0, 0), alpha=True)
    on_bone(ch, d, "Spine1", (0, y, z), rot=(0, 0, 0))
    return d


def k9_vest(ch):
    vest = mat_flat("vest", (0.03, 0.03, 0.035), rough=0.6)
    root = empty("k9", (0, 0, 0))
    v = box("k9_body", (0.42, 0.3, 0.42), (0, 0, 0), vest, bevel=0.03); v.parent = root
    # vest model space: +Z toward the head, +Y out of the back, +X the dog's left
    p = decal("k9_patch", f"{D2}/patch_k9.png", 0.34, (0, 0.152, 0.02), rot=(-90, 0, 0)); p.parent = root  # reads from the front
    for x in (-0.213, 0.213):
        s = decal(f"k9_side{x}", f"{D2}/patch_k9.png", 0.26, (x, 0, 0.02), rot=(0, 90 if x > 0 else -90, 0))  # upright
        s.parent = root
    on_bone(ch, root, "Spine", (0, 0.1, 0.07))        # bone +Z points to the belly: centre the vest on the torso
    root.scale = (1.2, 1.25, 1.1)                       # big enough to sit over Dale's jacket
    return root


def mug(color=(0.9, 0.35, 0.2)):
    m = mat_flat("mug", color, rough=0.3)
    root = empty("mug", (0, 0, 0))
    c = cylinder("mug_body", 0.042, 0.1, (0, 0, 0.05), m, verts=20); c.parent = root
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.008, location=(0.047, 0, 0.05),
                                     rotation=(math.radians(90), 0, 0))
    h = bpy.context.object; h.data.materials.append(m); h.parent = root
    return root


def chair(loc, rot_z=0.0, seat_h=0.5, high_back=False, color=(0.08, 0.08, 0.09)):
    """Office / boss chair from primitives. Returns (pivot empty, seat height). Rotate the pivot to spin it."""
    leather = mat_flat("leather_" + str(len(bpy.data.materials)), color, rough=0.35)
    metal = mat_flat("chrome", (0.8, 0.8, 0.82), rough=0.15, metal=1.0)
    piv = empty("chair", loc)
    piv.rotation_euler = (0, 0, math.radians(rot_z))
    parts = [box("seat", (0.56, 0.54, 0.1), (0, 0, seat_h), leather, bevel=0.03),
             box("back", (0.56, 0.1, 1.05 if high_back else 0.6), (0, 0.3, seat_h + (0.6 if high_back else 0.36)),
                 leather, bevel=0.04),
             cylinder("pole", 0.03, seat_h - 0.08, (0, 0, (seat_h - 0.08) / 2 + 0.06), metal)]
    for i in range(5):
        a = i * 2 * math.pi / 5
        parts.append(box(f"leg{i}", (0.34, 0.05, 0.04), (math.cos(a) * 0.17, math.sin(a) * 0.17, 0.06), metal,
                         rot=(0, 0, math.degrees(a))))
    if high_back:
        for x in (-0.31, 0.31):
            parts.append(box(f"arm{x}", (0.07, 0.45, 0.06), (x, 0.0, seat_h + 0.25), leather, bevel=0.02))
    for p in parts:
        p.parent = piv
    return piv, seat_h + 0.05


# ============================================================================ SETS
def it_set():
    """Dale's lair: dark server room, blue LED racks, triple-monitor desk."""
    world_color((0.02, 0.03, 0.06), 0.3)
    plane("floor", (14, 14), (0, 0, 0), mat_tex("itfloor", "floor_tiles_02", scale=1.0, tint=(0.35, 0.38, 0.45)),
          uv_scale=0.8)
    wall = mat_flat("itwall", (0.08, 0.09, 0.12), rough=0.8)
    box("w_back", (14, 0.2, 3.0), (0, 3.2, 1.5), wall)
    plane("ceil", (14, 14), (0, 0, 3.0), mat_flat("itceil", (0.05, 0.05, 0.07)), rot=(180, 0, 0))
    rack = mat_flat("rack", (0.03, 0.03, 0.04), rough=0.4, metal=0.5)
    leds = [mat_flat(f"led{i}", c, emit=c, emit_strength=8) for i, c in
            enumerate(((0.1, 0.5, 1.0), (0.1, 1.0, 0.4), (1.0, 0.4, 0.1)))]
    rnd = random.Random(4)
    for i, x in enumerate((-3.0, -2.2, -1.4, 1.4, 2.2, 3.0)):
        box(f"rack{i}", (0.7, 0.9, 2.2), (x, 2.4, 1.1), rack, bevel=0.01)
        for k in range(26):
            box(f"led{i}_{k}", (0.025, 0.01, 0.012), (x + rnd.uniform(-0.3, 0.3), 1.945, rnd.uniform(0.2, 2.1)),
                leds[0 if rnd.random() < 0.6 else (1 if rnd.random() < 0.7 else 2)])
    model("metal_office_desk", (0, 0.62, 0), rot_z=180)
    scr = mat_flat("itscr", (0.02, 0.06, 0.12), emit=(0.15, 0.45, 1.0), emit_strength=1.1)
    frame = mat_flat("bezel", (0.02, 0.02, 0.02), rough=0.3)
    for i, (x, r) in enumerate(((-0.55, 18), (0.0, 0), (0.55, -18))):
        b = box(f"mon{i}", (0.5, 0.03, 0.3), (x, 0.75, 1.08), frame, rot=(0, 0, r), bevel=0.005)
        s = box(f"monscr{i}", (0.47, 0.005, 0.27), (x - math.sin(math.radians(r)) * 0.017, 0.733, 1.08), scr,
                rot=(0, 0, r))
    box("kbd", (0.45, 0.15, 0.02), (0, 0.45, 0.77), mat_flat("kbd", (0.05, 0.05, 0.06)))
    decal("np_dale", f"{D2}/nameplate_dale.png", 0.55, (0.0, 0.2, 0.6), rot=(90, 0, 0))
    area("monglow", (0, 1.1, 1.2), (0, 0, 1.4), energy=160, size=1.2, color=(0.35, 0.6, 1.0))
    area("key", (1.6, -2.2, 2.4), (0, 0.6, 1.3), energy=350, size=2.0, color=(0.75, 0.85, 1.0), shadow=True)
    area("rim", (-1.5, 2.0, 2.4), (0, 0.8, 1.5), energy=260, size=1.0, color=(0.2, 0.45, 1.0))


def street_set():
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.0, rot_z=120)
    ground("asphalt_02", size=300, scale=0.3)
    plane("sidewalk", (200, 4.0), (0, -3.0, 0.08), mat_tex("sw", "rectangular_paving", scale=1.0,
                                                           tint=(0.95, 0.93, 0.9)), uv_scale=0.6)
    box("curb", (200, 0.2, 0.16), (0, -0.95, 0.08), mat_flat("curb", (0.62, 0.62, 0.6), rough=0.8))
    post = mat_flat("post", (0.3, 0.3, 0.32), metal=0.6, rough=0.4)
    cylinder("stoppost", 0.04, 2.7, (1.6, -1.6, 1.35), post)
    decal("busstop", f"{D2}/sign_busstop.png", 0.55, (1.6, -1.64, 2.5), rot=(90, 0, 0))
    shelter = mat_flat("shelter", (0.85, 0.9, 0.95), rough=0.1, alpha=0.25)
    if hasattr(shelter, "surface_render_method"):
        shelter.surface_render_method = "BLENDED"
    box("shelter_back", (3.0, 0.03, 2.2), (-1.0, -4.6, 1.2), shelter)
    box("shelter_roof", (3.2, 1.6, 0.06), (-1.0, -3.9, 2.35), mat_flat("roof", (0.2, 0.25, 0.3), metal=0.5))
    box("bench", (2.0, 0.45, 0.08), (-1.0, -4.3, 0.5), mat_tex("benchwood", "wood_floor", scale=1.0))
    for i, x in enumerate((-14, -7, 7, 14, 21)):
        model("street_lamp_01", (x, -4.2, 0), rot_z=90)
        ep1.blob_tree((x + 3.5, -6.0, 0), height=5.5, seed=i)
    sun(energy=3.8, rot=(48, 0, 140), color=(1.0, 0.95, 0.87))


def ground(tex, size=200, scale=0.5, tint=None, name="ground"):
    return plane(name, (size, size), (0, 0, 0), mat_tex(name + "_m", tex, scale=1.0, tint=tint), uv_scale=scale)


def bus_exterior(loc=(0, 0, 0)):
    """City bus from primitives (body, glass band, wheels, LED route sign, livery). Front at +X, door side -Y."""
    paint = mat_flat("buspaint", (0.92, 0.92, 0.9), rough=0.35)
    glass = mat_flat("busglass", (0.05, 0.07, 0.09), rough=0.05, metal=0.3)
    tyre = mat_flat("tyre", (0.03, 0.03, 0.03), rough=0.9)
    root = empty("bus", loc)
    L, W, H = 11.0, 2.5, 3.0
    parts = [box("bus_body", (L, W, H - 0.35), (0, 0, 0.35 + (H - 0.35) / 2), paint, bevel=0.12),
             box("bus_win", (L - 1.6, W + 0.02, 1.0), (-0.3, 0, 2.0), glass, bevel=0.05),
             box("bus_wind", (0.05, W - 0.3, 1.5), (L / 2 + 0.01, 0, 1.85), glass),
             box("bus_door", (1.1, 0.04, 2.0), (L / 2 - 1.1, -W / 2 - 0.005, 1.35), glass)]
    for x in (-L / 2 + 2.0, L / 2 - 2.2):
        for y in (-W / 2 + 0.1, W / 2 - 0.1):
            parts.append(cylinder(f"wheel{x}{y}", 0.5, 0.32, (x, y, 0.5), tyre, rot=(90, 0, 0)))
    for p in parts:
        p.parent = root
    s = decal("bus_route", f"{D2}/bus_route.png", 2.0, (L / 2 + 0.04, 0, 2.75), rot=(90, 0, 90)); s.parent = root
    s2 = decal("bus_route_side", f"{D2}/bus_route.png", 2.2, (L / 2 - 2.6, -W / 2 - 0.02, 2.75), rot=(90, 0, 0))
    s2.parent = root
    lv = decal("bus_livery", f"{D2}/bus_livery.png", L - 0.5, (0, -W / 2 - 0.015, 1.0), rot=(90, 0, 0), alpha=True)
    lv.parent = root
    return root


def bus_interior_set():
    """Inside the bus, looking down the aisle (front of the bus at -Y, driver at the front left)."""
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.1, rot_z=60)
    floor = mat_flat("busfloor", (0.22, 0.23, 0.26), rough=0.8)
    plane("bfloor", (2.5, 12), (0, 0, 0), floor)
    side = mat_flat("busside", (0.9, 0.9, 0.88), rough=0.5)
    for x in (-1.25, 1.25):
        box(f"skirt{x}", (0.06, 12, 0.95), (x, 0, 0.475), side)
        box(f"top{x}", (0.06, 12, 0.5), (x, 0, 2.15), side)
        for k in range(6):
            box(f"pillar{x}{k}", (0.07, 0.12, 1.0), (x, -5 + k * 2.0, 1.45), side)
    plane("bceil", (2.5, 12), (0, 0, 2.4), mat_flat("busceil", (0.85, 0.86, 0.88), rough=0.7), rot=(180, 0, 0))
    light = mat_flat("buslight", (1, 1, 1), emit=(1.0, 0.98, 0.94), emit_strength=4)
    for x in (-0.7, 0.7):
        plane(f"strip{x}", (0.12, 10), (x, 0, 2.39), light, rot=(180, 0, 0))
    pole = mat_flat("pole", (0.95, 0.75, 0.05), rough=0.3, metal=0.4)
    for k in range(5):
        cylinder(f"pole{k}", 0.02, 2.4, (0.42, -4 + k * 2.0, 1.2), pole)
    cylinder("rail_l", 0.018, 12, (-0.4, 0, 1.95), pole, rot=(90, 0, 0))
    cylinder("rail_r", 0.018, 12, (0.4, 0, 1.95), pole, rot=(90, 0, 0))
    fab = mat_tex("seatfab", "denim_fabric", scale=1.0, tint=(0.3, 0.42, 0.85), normal_strength=0.4)
    seats = []
    for row in range(5):
        y = -2.6 + row * 1.15
        for x in (-0.85, -0.38, 0.85):
            box(f"seat{row}_{x}", (0.44, 0.44, 0.1), (x, y, 0.48), fab, bevel=0.03)
            box(f"seatb{row}_{x}", (0.44, 0.08, 0.55), (x, y + 0.24, 0.8), fab, bevel=0.03, rot=(-8, 0, 0))
            box(f"seatleg{row}_{x}", (0.06, 0.06, 0.43), (x, y, 0.215), mat_flat("sl", (0.3, 0.3, 0.32), metal=0.6))
            seats.append((x, y))
    # driver cab at the front left
    box("cab_wall", (1.0, 0.05, 1.2), (-0.75, -4.0, 0.6), side)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(-0.75, -4.75, 1.05),
                                     rotation=(math.radians(55), 0, 0))
    w = bpy.context.object; w.name = "wheel"; w.data.materials.append(mat_flat("wheelm", (0.04, 0.04, 0.04)))
    box("dash", (1.2, 0.5, 0.9), (-0.6, -5.3, 0.45), mat_flat("dash", (0.12, 0.12, 0.13)))
    plane("windshield", (2.5, 1.6), (0, -5.6, 1.6), mat_flat("ws", (1, 1, 1), emit=(0.8, 0.9, 1.0), emit_strength=2.5),
          rot=(90, 0, 0))
    sun(energy=3.0, rot=(55, 0, 70), color=(1.0, 0.95, 0.88))
    area("fill", (0, 3.0, 2.0), (0, -1.0, 1.1), energy=300, size=2.0, color=(1.0, 0.97, 0.93))
    return seats


def newcorp_set():
    """'Totally New Corp': bright white open-plan office (deliberately unlike Larry's grey cubicles)."""
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=0.8)
    plane("floor", (24, 24), (0, 0, 0), mat_tex("ncfloor", "wood_floor", scale=1.0, tint=(1.0, 0.92, 0.82)),
          uv_scale=0.5)
    wall = mat_tex("ncwall", "painted_plaster_wall", scale=1.0, tint=(1.0, 1.0, 1.0))
    box("w_back", (24, 0.2, 3.4), (0, 4.0, 1.7), wall, uv_scale=0.4)
    box("w_left", (0.2, 24, 3.4), (-6, 0, 1.7), wall, uv_scale=0.4)
    plane("ceiling", (24, 24), (0, 0, 3.3), mat_flat("ncceil", (0.97, 0.97, 0.97), rough=0.9), rot=(180, 0, 0))
    win = mat_flat("ncwin", (1, 1, 1), emit=(0.9, 0.95, 1.0), emit_strength=3.5)
    for y in (-3, 0, 3):
        plane(f"ncw{y}", (2.4, 2.4), (-5.89, y, 1.75), win, rot=(90, 0, 90))
    decal("newcorp", f"{D2}/sign_newcorp.png", 3.2, (0.0, 3.89, 2.45), rot=(90, 0, 0), alpha=True)
    model("potted_plant_02", (2.6, 3.4, 0), scale=1.4)
    model("potted_plant_01", (-2.4, 3.4, 0), scale=1.2)
    sun(energy=3.2, rot=(55, 0, -60), color=(1.0, 0.96, 0.9))
    area("fill", (0, -5, 2.8), (0, 1.0, 1.3), energy=700, size=5, color=(1.0, 0.98, 0.95))
    area("top", (0, 0, 3.2), (0, 0, 0), energy=500, size=6)


def vending_machine(loc=(0, 2.0, 0), rot_z=0.0, open_back=False):
    """Snack machine: body, glass front over the snack-grid decal, keypad. Front faces -Y."""
    root = empty("vending", loc)
    root.rotation_euler = (0, 0, math.radians(rot_z))
    red = mat_flat("vm_red", (0.75, 0.05, 0.08), rough=0.35)
    W, D, H = 1.1, 0.85, 1.95
    parts = [box("vm_back", (W, 0.05, H), (0, D / 2, H / 2), red),
             box("vm_left", (0.05, D, H), (-W / 2, 0, H / 2), red),
             box("vm_right", (0.05, D, H), (W / 2, 0, H / 2), red),
             box("vm_top", (W, D, 0.12), (0, 0, H - 0.06), red),
             box("vm_base", (W, D, 0.35), (0, 0, 0.175), red),
             box("vm_panel", (0.3, 0.06, H - 0.5), (W / 2 - 0.17, -D / 2 + 0.03, 0.35 + (H - 0.5) / 2), red)]
    glass = mat_flat("vm_glass", (0.85, 0.92, 1.0), rough=0.02, alpha=0.12)
    if hasattr(glass, "surface_render_method"):
        glass.surface_render_method = "BLENDED"
    parts.append(box("vm_glass", (W - 0.38, 0.01, H - 0.5), (-0.14, -D / 2 + 0.02, 0.35 + (H - 0.5) / 2), glass))
    for p in parts:
        p.parent = root
    snacks = decal("vm_snacks", f"{D2}/vending_front.png", W - 0.42, (-0.14, D / 2 - 0.035, 1.1), rot=(90, 0, 0),
                   emit=0.6)
    snacks.parent = root
    kp = decal("vm_keypad", f"{D2}/vending_keypad.png", 0.2, (W / 2 - 0.17, -D / 2 - 0.002, 1.25), rot=(90, 0, 0),
               emit=0.4)
    kp.parent = root
    sd = decal("vm_side", f"{D2}/vending_side.png", 0.5, (-W / 2 - 0.028, 0, 1.0), rot=(90, 0, -90)); sd.parent = root
    p = point("vm_inner", (0, 0, 1.7), energy=40, color=(0.9, 0.95, 1.0), radius=0.3); p.parent = root
    p.location = (-0.14, 0.1, 1.7)
    return root


def airport_set():
    world_hdri("kloofendal_43d_clear_puresky", strength=1.2, rot_z=30)
    plane("floor", (40, 40), (0, 0, 0), mat_tex("apfloor", "floor_tiles_02", scale=1.0, tint=(0.95, 0.95, 0.97),
                                                 rough_mult=0.4), uv_scale=0.4)
    wall = mat_tex("apwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.96, 0.98))
    box("w_back", (40, 0.2, 6.0), (0, 8.0, 3.0), wall, uv_scale=0.3)
    win = mat_flat("apwin", (1, 1, 1), emit=(0.85, 0.93, 1.0), emit_strength=3.0)
    for x in (-9, -4.5, 0, 4.5, 9):
        plane(f"apw{x}", (3.6, 3.6), (x, 7.89, 3.2), win, rot=(90, 0, 0))
    col = mat_flat("column", (0.92, 0.92, 0.94), rough=0.3)
    for x in (-6.75, -2.25, 2.25, 6.75):
        cylinder(f"col{x}", 0.3, 6.0, (x, 6.5, 3.0), col)
    decal("arrivals", f"{D2}/sign_arrivals.png", 4.5, (0, 7.85, 5.2), rot=(90, 0, 0))
    plane("apceil", (40, 40), (0, 0, 6.0), mat_flat("apceil", (0.9, 0.9, 0.92)), rot=(180, 0, 0))
    sun(energy=3.5, rot=(50, 0, 160), color=(1.0, 0.96, 0.9))
    area("fill", (0, -6, 4.0), (0, 2.0, 1.2), energy=900, size=6, color=(1.0, 0.98, 0.96))


def passport_booth(loc=(0, 1.2, 0)):
    """Passport-control booth: desk counter toward -Y, officer seat behind, glass screen, sign on top."""
    root = empty("booth", loc)
    navy = mat_flat("booth", (0.1, 0.18, 0.32), rough=0.4)
    glass = mat_flat("booth_glass", (0.85, 0.92, 1.0), rough=0.02, alpha=0.12)
    if hasattr(glass, "surface_render_method"):
        glass.surface_render_method = "BLENDED"
    parts = [box("bt_front", (1.6, 0.1, 1.1), (0, -0.5, 0.55), navy),
             box("bt_counter", (1.7, 0.45, 0.05), (0, -0.55, 1.12), mat_tex("btwood", "wood_floor", scale=1.0)),
             box("bt_left", (0.08, 1.2, 2.3), (-0.8, 0.1, 1.15), navy),
             box("bt_right", (0.08, 1.2, 2.3), (0.8, 0.1, 1.15), navy),
             box("bt_roof", (1.7, 1.3, 0.1), (0, 0.1, 2.35), navy),
             box("bt_glass", (1.5, 0.01, 1.0), (0, -0.45, 1.75), glass)]
    for p in parts:
        p.parent = root
    s = decal("bt_sign", f"{D2}/sign_passport.png", 1.6, (0, -0.56, 2.52), rot=(90, 0, 0)); s.parent = root
    return root


def ring_set():
    """Boxing ring in a dark arena: posts, three ropes, apron print, FIGHT NIGHT banner, spotlight."""
    world_color((0.02, 0.02, 0.03), 0.4)
    plane("arena", (60, 60), (0, 0, 0), mat_flat("arena", (0.05, 0.05, 0.06), rough=0.9))
    S, Hh = 5.0, 1.0
    box("ring", (S, S, Hh), (0, 0, Hh / 2), mat_flat("canvas", (0.85, 0.85, 0.82), rough=0.85), bevel=0.02)
    decal("apron", f"{D2}/ring_apron.png", S - 0.4, (0, -S / 2 - 0.005, Hh * 0.55), rot=(90, 0, 0))
    post = mat_flat("ringpost", (0.85, 0.85, 0.88), rough=0.2, metal=0.9)
    cols = [mat_flat("rope_r", (0.8, 0.05, 0.05)), mat_flat("rope_w", (0.95, 0.95, 0.95)),
            mat_flat("rope_b", (0.05, 0.15, 0.8))]
    c = S / 2 - 0.12
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        cylinder(f"post{sx}{sy}", 0.06, 1.45, (sx * c, sy * c, Hh + 0.72), post)
        box(f"pad{sx}{sy}", (0.18, 0.18, 1.1), (sx * c, sy * c, Hh + 0.6), cols[0 if sx < 0 else 2], bevel=0.03)
    for k, z in enumerate((Hh + 0.45, Hh + 0.85, Hh + 1.25)):
        for (a, b) in (((-c, -c), (c, -c)), ((c, -c), (c, c)), ((c, c), (-c, c)), ((-c, c), (-c, -c))):
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z)
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            r = cylinder(f"rope{k}{a}{b}", 0.025, L, mid, cols[k], rot=(90, 0, 0) if a[0] == b[0] else (0, 90, 0))
    decal("banner", f"{D2}/banner_fight.png", 4.5, (0, 4.5, 5.0), rot=(90, 0, 0), emit=1.2)
    area("spot", (0, -1.0, 7.5), (0, 0, Hh), energy=4500, size=1.8, color=(1.0, 0.95, 0.85), shadow=True)
    area("rimL", (-4, 3, 4), (0, 0, Hh + 1.2), energy=900, size=1.0, color=(1.0, 0.6, 0.2))
    area("rimR", (4, 3, 4), (0, 0, Hh + 1.2), energy=900, size=1.0, color=(0.2, 0.55, 1.0))
    area("fill", (0, -6, 3), (0, 0, Hh + 1.0), energy=500, size=3.0, color=(0.9, 0.92, 1.0))
    return Hh


def hospital_set(flat_from=None):
    world_color((0.6, 0.62, 0.6), 0.3)
    plane("floor", (10, 10), (0, 0, 0), mat_tex("hfloor", "floor_tiles_02", scale=1.0, tint=(0.85, 0.9, 0.88)),
          uv_scale=0.6)
    wall = mat_tex("hwall", "painted_plaster_wall", scale=1.0, tint=(0.78, 0.9, 0.84))
    box("w_back", (10, 0.2, 3.0), (0, 2.75, 1.5), wall, uv_scale=0.5)
    box("w_left", (0.2, 10, 3.0), (-2.6, 0, 1.5), wall, uv_scale=0.5)
    plane("ceil", (10, 10), (0, 0, 3.0), mat_flat("hceil", (0.92, 0.93, 0.92)), rot=(180, 0, 0))
    frame = mat_flat("bedframe", (0.85, 0.86, 0.88), rough=0.3, metal=0.6)
    box("bed_frame", (1.1, 2.2, 0.3), (0, 1.0, 0.45), frame)
    box("mattress", (1.0, 2.1, 0.2), (0, 1.0, 0.7), mat_flat("hsheet", (0.92, 0.94, 0.96), rough=0.9), bevel=0.05)
    box("rail_l", (0.04, 1.2, 0.3), (-0.56, 0.9, 0.95), frame)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, 1.82, 0.88)); p = bpy.context.object
    p.scale = (1.15, 0.5, 0.3); bpy.ops.object.shade_smooth()
    p.data.materials.append(mat_flat("hpillow", (0.95, 0.95, 0.97), rough=0.9))
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=30, y_subdivisions=30, size=1, location=(0, 0.62, 1.05))
    bl = bpy.context.object; bl.name = "blanket"; bl.scale = (1.15, 1.35, 1); bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new("hbl", "CLOUDS"); tex.noise_scale = 0.25
    dsp = bl.modifiers.new("d", "DISPLACE"); dsp.texture = tex; dsp.strength = 0.03
    bl.modifiers.new("s", "SOLIDIFY").thickness = 0.02
    bpy.ops.object.shade_smooth()
    bl.data.materials.append(mat_flat("hblanket", (0.7, 0.82, 0.95), rough=0.9))
    # heart monitor on a stand, screen faces the camera side (-Y, +X)
    cylinder("mon_pole", 0.025, 1.3, (0.95, 1.6, 0.65), frame)
    MR = 30
    box("mon_box", (0.5, 0.12, 0.36), (0.95, 1.6, 1.42), mat_flat("monbox", (0.15, 0.16, 0.18), rough=0.4),
        rot=(0, 0, MR), bevel=0.01)
    sx, sy = math.sin(math.radians(MR)), -math.cos(math.radians(MR))      # screen normal
    beat = decal("mon_beat", f"{D2}/monitor_beat.png", 0.44, (0.95 + 0.065 * sx, 1.6 + 0.065 * sy, 1.42),
                 rot=(90, 0, MR), emit=3.0)
    flat = decal("mon_flat", f"{D2}/monitor_flat.png", 0.44, (0.95 + 0.066 * sx, 1.6 + 0.066 * sy, 1.42),
                 rot=(90, 0, MR), emit=3.0)
    if flat_from:
        lib.hide_after(beat, flat_from)
        flat.hide_render = True; flat.keyframe_insert("hide_render", frame=flat_from - 1)
        flat.hide_render = False; flat.keyframe_insert("hide_render", frame=flat_from)
    else:
        flat.hide_render = True
    cylinder("iv_pole", 0.015, 1.9, (-0.8, 1.7, 0.95), frame)
    box("iv_bag", (0.14, 0.04, 0.22), (-0.8, 1.7, 1.75), mat_flat("ivbag", (0.9, 0.95, 1.0), alpha=0.6))
    win = mat_flat("sunset", (1, 1, 1), emit=(1.0, 0.65, 0.4), emit_strength=3.0)
    plane("hwin", (1.6, 1.3), (-2.49, 0.4, 1.6), win, rot=(90, 0, 90))
    sun(energy=1.6, rot=(65, 0, -80), color=(1.0, 0.72, 0.5))
    area("fill", (1.5, -2.0, 2.4), (0, 1.0, 0.8), energy=200, size=2.5, color=(0.95, 0.98, 1.0))
    area("top", (0, 1.0, 2.9), (0, 1.0, 0.7), energy=90, size=1.5)


def you_in_hospital_bed(subdiv=True):
    you = load_char("you_old", (0, 0, 0), subdiv=subdiv)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-80), 0, 0)
    you.rig.location = (0.0, 0.1, 0.92)
    face(you, 1, TIRED)
    return you


_CLOUD = {}


def cloud(loc, r=1.0, seed=0):
    if not _CLOUD:
        m = mat_flat("cloud", (0.98, 0.95, 0.9), rough=1.0, emit=(1.0, 0.93, 0.85), emit_strength=0.1)
        tex = bpy.data.textures.new("cloudnoise", "CLOUDS"); tex.noise_scale = 0.7
        _CLOUD.update(m=m, tex=tex)
    rnd = random.Random(seed)
    for i in range(4):
        rr = r * rnd.uniform(0.55, 1.0)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=rr, location=(
            loc[0] + rnd.uniform(-r, r) * 0.8, loc[1] + rnd.uniform(-r, r) * 0.8, loc[2] + rnd.uniform(-0.2, 0.3) * r))
        b = bpy.context.object
        b.scale = (1.0, 1.0, 0.55)
        d = b.modifiers.new("d", "DISPLACE"); d.texture = _CLOUD["tex"]; d.strength = rr * 0.3
        bpy.ops.object.shade_smooth()
        b.data.materials.append(_CLOUD["m"])


def heaven_set(gate_open_frames=None):
    """Clouds, golden pearly gates (two hinged halves) and the HEAVEN sign. Gate centre at (0, 4, 0)."""
    world_color((1.0, 0.86, 0.62), 0.75)
    plane("cloudfloor", (200, 200), (0, 0, -0.05), mat_flat("cloudbase", (0.95, 0.9, 0.82), rough=1.0,
                                                            emit=(1.0, 0.9, 0.75), emit_strength=0.12))
    rnd = random.Random(11)
    for i in range(36):
        x, y = rnd.uniform(-16, 16), rnd.uniform(-4, 30)
        if abs(x) < 2.2 and y < 8:
            continue
        cloud((x, y, 0.1), r=rnd.uniform(0.7, 1.8), seed=i)
    gold = mat_flat("gold", (1.0, 0.76, 0.3), rough=0.25, metal=1.0)
    for x in (-1.6, 1.6):
        cylinder(f"gpillar{x}", 0.22, 4.2, (x, 4.0, 2.1), mat_flat("pearl", (0.98, 0.96, 0.93), rough=0.2))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(x, 4.0, 4.4)); o = bpy.context.object
        o.data.materials.append(gold); bpy.ops.object.shade_smooth()
    halves = []
    for side in (-1, 1):
        hinge = empty(f"ghinge{side}", (side * 1.38, 4.0, 0))
        for k in range(7):
            x = side * (-0.1 - k * 0.2)
            h = 3.0 + 0.35 * math.cos((k / 6) * math.pi / 2)
            b = cylinder(f"gbar{side}{k}", 0.025, h, (x, 0, h / 2 + 0.05), gold, verts=10); b.parent = hinge
        for z in (0.5, 1.6, 2.7):
            r = cylinder(f"grail{side}{z}", 0.03, 1.32, (side * -0.68, 0, z), gold, rot=(0, 90, 0), verts=10)
            r.parent = hinge
        if gate_open_frames:
            f0, f1 = gate_open_frames
            key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (0, 0, -side * 95))
        halves.append(hinge)
    decal("heaven_sign", f"{D2}/sign_heaven.png", 2.6, (0, 3.95, 4.95), rot=(90, 0, 0), alpha=True, emit=0.6)
    sun(energy=3.0, rot=(35, 0, 160), color=(1.0, 0.88, 0.68))
    area("glow", (0, 7.0, 3.5), (0, 0, 1.5), energy=1500, size=4.0, color=(1.0, 0.8, 0.5))
    area("fill", (0, -5.0, 3.0), (0, 3.0, 1.5), energy=500, size=4.0, color=(1.0, 0.95, 0.88))
    return halves


# ============================================================================ SHOTS
@shot
def sh01():
    """You just want a normal life. - sunny living room, you with a coffee mug, content smile, slow push-in."""
    n = frames_of("sh01")
    ep1.interior_set()
    bpy.data.objects["vent_hole"].hide_render = True      # episode 1's Larry vent: not in the "normal life" home
    you = load_char("you", (0, 0.2, 0), subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMILE)
    face(you, n, dict(SMILE, eyeSquintLeft=0.35, eyeSquintRight=0.35))
    blink(you, [30])
    look_at(you, (1.2, -3.0, 1.6), 0.5)
    cam = Cam(lens=32, loc=(0.6, -3.3, 1.35), target=(0.0, 0.2, 1.3))
    cam.key(1, loc=(0.6, -3.3, 1.35))
    cam.key(n, loc=(0.4, -2.4, 1.42), target=(0.0, 0.2, 1.38))
    return n


@shot
def sh02():
    """But Larry from accounting - (episode 1 callback) Larry's head rises over his cubicle wall, nameplate below."""
    n = frames_of("sh02")
    ep1.office_set()
    larry = load_char("larry", (1.95, 0.25, 0), rot_z=-90, subdiv=True)
    larry.clip("137_41", **src(n, 200))
    key_loc(larry.rig, 1, (1.95, 0.25, -0.75))
    key_loc(larry.rig, int(n * 0.55), (1.95, 0.25, 0.02))
    key_loc(larry.rig, n, (1.95, 0.25, 0.08))
    look_at(larry, (0.15, -0.35, 1.45), 0.9)
    face(larry, 1, CREEPY)
    cam = Cam(lens=38, loc=(0.0, -0.55, 1.42), target=(1.5, 0.25, 1.36))   # episode 1 sh02 framing
    cam.key(1, loc=(0.0, -0.55, 1.42))
    cam.key(n, loc=(0.25, -0.4, 1.45))
    return n


@shot
def sh03():
    """is obsessed with you. - inside Larry's cubicle: a shrine of your polaroids, he cradles one lovingly."""
    n = frames_of("sh03")
    ep1.office_set()
    # shrine on the inner face of his cubicle's back partition (y ~ 1.02, facing -Y)
    red = mat_flat("string", (0.8, 0.05, 0.05))
    spots = ((-0.45, 1.0, -6), (-0.05, 1.08, 4), (0.35, 0.96, -3), (0.72, 1.06, 7))
    for k, (x, z, r) in enumerate(spots):
        decal(f"pol{k}", f"{D2}/polaroid_{k}.png", 0.24, (x + 3.0, 1.015, z), rot=(90, 0, r), alpha=True)
    for (a, b) in zip(spots, spots[1:]):
        mid = Vector(((a[0] + b[0]) / 2 + 3.0, 1.01, (a[1] + b[1]) / 2 + 0.1))
        d = Vector((b[0] - a[0], 0, b[1] - a[1]))
        s = cylinder("str", 0.003, d.length, mid, red, verts=6)
        s.rotation_mode = "QUATERNION"; s.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    larry = load_char("larry", (3.0, 0.0, 0), rot_z=15, subdiv=True)
    larry.clip("137_41", **src(n, 800))
    held = decal("pol_held", f"{D2}/polaroid_2.png", 0.14, (0, 0, 0), rot=(0, 0, 0), alpha=True)
    larry.attach(held, "RightHand", keep_world=False)
    held.location = (0.0, 0.09, 0.03)
    tgt = empty("hold", (2.86, -0.26, 1.36))
    hand_ik(larry, "Right", tgt)
    face(larry, 1, LOVESTRUCK)
    face(larry, n, dict(LOVESTRUCK, mouthPucker=0.8))
    look_at(larry, tgt, 0.8)
    cam = Cam(lens=36, loc=(2.5, -1.45, 1.5), target=(3.0, 0.35, 1.3), dof=4.0)
    cam.key(1, loc=(2.5, -1.45, 1.5))
    cam.key(n, loc=(2.6, -1.15, 1.48))
    return n


@shot
def sh04():
    """And so is Dale from IT. - server-room glow; tall Dale rises from behind his monitors, badge on, creepy wave."""
    n = frames_of("sh04")
    it_set()
    dale = load_char("dale", (0.0, 1.15, 0), rot_z=0, subdiv=True)
    dale.clip("137_41", **src(n, 1000))
    key_loc(dale.rig, 1, (0.0, 1.15, -0.9))
    key_loc(dale.rig, int(n * 0.5), (0.0, 1.15, 0.0))
    key_loc(dale.rig, n, (0.0, 1.15, 0.03))
    chest_print(dale, f"{D2}/badge_dale.png", width=0.08, y=0.0, z=0.13, name="badge")
    wave = empty("wave", (0.35, 0.95, 1.95))
    for f in range(1, n + 1, 3):
        key_loc(wave, f, (0.35 + 0.08 * math.sin(f * 0.5), 0.95, 1.95))
    hand_ik(dale, "Left", wave)
    face(dale, 1, CREEPY)
    blink(dale, [int(n * 0.75)])
    cam = Cam(lens=32, loc=(0.25, -0.75, 1.4), target=(0.0, 1.1, 1.65))
    cam.key(1, loc=(0.25, -0.75, 1.4))
    cam.key(n, loc=(0.2, -0.5, 1.45))
    look_at(dale, cam.cam, 0.85)
    return n


@shot
def sh05():
    """So you take a different bus to work. - bus stop; a city bus glides in and stops; you, briefcase-proud."""
    n = frames_of("sh05")
    street_set()
    bus = bus_exterior((-25.0, 0.6, 0))
    stop = int(n * 0.62)
    key_loc(bus, 1, (-25.0, 0.6, 0))
    key_loc(bus, stop, (3.0, 0.6, 0), interp="BEZIER")
    key_loc(bus, n, (3.0, 0.6, 0))
    you = load_char("you", (1.0, -1.6, 0.08), rot_z=-60)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMILE)
    cam = Cam(lens=26, loc=(-2.6, -2.4, 1.5), target=(1.5, -0.6, 1.5))
    cam.key(1, loc=(-2.6, -2.4, 1.5))
    cam.key(n, loc=(-2.2, -2.2, 1.5))
    look_at(you, (6.0, 0.0, 1.8), 0.6)
    return n


@shot
def sh06():
    """GENIUS! - seated on the bus, low-angle hero close-up, smug."""
    n = frames_of("sh06")
    bus_interior_set()
    you = load_char("you", (0.85, -0.15, 0), rot_z=0, subdiv=True)
    sit(you, 0.53)
    face(you, 1, SMUG)
    look_at(you, (2.5, -4.0, 2.2), 0.7)
    cam = Cam(lens=34, loc=(0.55, -1.05, 0.85), target=(0.85, -0.15, 1.18))
    cam.key(1, loc=(0.55, -1.05, 0.85))
    cam.key(n, loc=(0.6, -0.9, 0.9))
    return n


def driver(n, turn=None):
    """Larry in the driver's seat with a uniform cap, hands on the wheel. turn=(f0, f1) turns his head to the lens."""
    ch_, sz = chair((-0.75, -4.25, 0), rot_z=0, seat_h=0.55)
    larry = load_char("larry", (-0.75, -4.3, 0), rot_z=0, subdiv=True)
    sit(larry, sz)
    on_bone(larry, cap(), "Head", (0, 0.105, 0.0))
    for side, dx in (("Left", 0.16), ("Right", -0.16)):
        hand_ik(larry, side, empty(f"wheel{side}", (-0.75 + dx, -4.7, 1.1)))
    return larry


@shot
def sh07():
    """But the bus driver... is - push down the aisle toward the driver's back (mustard polo, cap)."""
    n = frames_of("sh07")
    bus_interior_set()
    larry = driver(n)
    face(larry, 1, CREEPY)
    cam = Cam(lens=30, loc=(0.1, 1.5, 1.55), target=(-0.75, -4.4, 1.25))
    cam.key(1, loc=(0.1, 1.5, 1.55))
    cam.key(n, loc=(-0.15, -2.6, 1.5), target=(-0.75, -4.4, 1.3))
    return n


@shot
def sh08():
    """LARRY. - over the wheel: Larry turns his head straight into the lens, creepy grin. (honk after the word)"""
    n = frames_of("sh08")
    bus_interior_set()
    larry = driver(n)
    cam = Cam(lens=34, loc=(0.15, -5.25, 1.55), target=(-0.75, -4.3, 1.45))
    cam.key(1, loc=(0.15, -5.25, 1.55))
    cam.key(n, loc=(0.05, -5.15, 1.53))
    stare_at(larry, cam.cam, 3, 10)
    face(larry, 1, DEADPAN)
    face(larry, 8, CREEPY)
    blink(larry, [n - 6])
    return n


def lap_scene(n):
    bus_interior_set()
    you = load_char("you", (0.85, 1.0, 0), rot_z=0, subdiv=True)
    sit(you, 0.53)
    dale = load_char("dale", (0.92, 0.74, 0), rot_z=-90, subdiv=True)   # sideways across your thighs, facing the aisle
    pose(dale, SIT)
    bpy.context.scene.frame_set(1)
    thigh = (you.world("LeftLeg") + you.world("Hips")) / 2
    settle(dale, "Hips", thigh.z + 0.14)
    return you, dale


@shot
def sh09():
    """And the guy sitting on your lap... is - wide: a lanky stranger sits on your lap, facing forward."""
    n = frames_of("sh09")
    you, dale = lap_scene(n)
    face(you, 1, DEADPAN)
    blink(you, [20])
    look_at(you, (1.6, -4.0, 1.5), 0.6)
    face(dale, 1, SERENE)
    look_at(dale, (-2.0, 0.7, 1.6), 0.6)
    cam = Cam(lens=28, loc=(-0.35, -1.05, 1.4), target=(0.85, 0.85, 1.2))
    cam.key(1, loc=(-0.35, -1.05, 1.4))
    cam.key(n, loc=(-0.25, -0.8, 1.4))
    return n


@shot
def sh10():
    """DALE. - close two-shot: Dale slowly turns his face to yours, inches away, creepy smile; you sweat."""
    n = frames_of("sh10")
    you, dale = lap_scene(n)
    face(you, 1, UNEASY)
    face(dale, 1, SERENE)
    face(dale, 8, CREEPY)
    bpy.data.objects["pole2"].hide_render = True          # the aisle pole crossed the lens
    look_at(dale, (-2.0, 0.7, 1.6), 0.6)
    cam = Cam(lens=40, loc=(0.1, -0.35, 1.6), target=(0.95, 0.85, 1.5), dof=2.8)
    cam.key(1, loc=(0.1, -0.35, 1.6))
    cam.key(n, loc=(0.2, -0.25, 1.6))
    stare_at(dale, cam.cam, 2, 10, influence=0.95)          # turns into the lens, cheek to cheek with you
    return n


@shot
def sh11():
    """So you quit your job. - you storm out of Larry's office carrying your box of desk stuff."""
    n = frames_of("sh11")
    ep1.office_set()
    you = load_char("you", (0.5, -0.4, 0), rot_z=0)
    you.clip("07_01", **src(n, 60, in_place=False))
    b, mn, mx = ep1.big_box((0, 0, 0), open_top=True, W=0.45, D=0.32, H=0.28)
    you.bake_follow(b, "Hips", n, offset=(0.0, -0.32, 0.05))
    for side, dx in (("Left", 0.23), ("Right", -0.23)):
        t = empty(f"boxgrip{side}", (dx, 0.0, 0.2)); t.parent = b
        hand_ik(you, side, t)
    pl = model("potted_plant_01", (0, 0, 0.02), scale=0.35); pl.parent = b
    face(you, 1, DETERMINED)
    cam = Cam(lens=28, loc=(1.6, -3.8, 1.3), target=(0.4, 0.0, 1.1))
    trk = cam.tgt
    you.bake_follow(trk, "Hips", n, offset=(0.0, 0.0, 0.15))
    cam.key(1, loc=(1.6, -3.8, 1.3))
    cam.key(n, loc=(1.2, -3.6, 1.3))
    return n


@shot
def sh12():
    """CLEVER! - new job: bright 'Totally New Corp' office, low-angle smug close-up under the sign."""
    n = frames_of("sh12")
    newcorp_set()
    you = load_char("you", (0, 2.6, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SMUG)
    look_at(you, (-2.0, -3.0, 2.4), 0.8)
    cam = Cam(lens=30, loc=(0.4, 1.7, 1.0), target=(0.0, 2.6, 1.75))
    cam.key(1, loc=(0.4, 1.7, 1.0))
    cam.key(n, loc=(0.35, 1.8, 1.05))
    return n


def boss_office(n, spin=None):
    """Boss desk with CEO nameplate, high-back chair (facing away), you in front of the desk."""
    newcorp_set()
    model("metal_office_desk", (0, 1.6, 0), rot_z=180)
    box("plaque_base", (0.5, 0.06, 0.03), (0.0, 1.27, 0.785), mat_flat("plaque", (0.15, 0.1, 0.06), rough=0.3))
    decal("np_ceo", f"{D2}/nameplate_ceo.png", 0.46, (0.0, 1.265, 0.86), rot=(78, 0, 0))   # desk plaque
    piv, sz = chair((0, 2.35, 0), rot_z=0, seat_h=0.5, high_back=True)
    larry = load_char("larry", (0, 0, 0), rot_z=0, subdiv=True)
    sit(larry, sz)
    larry.rig.parent = piv
    larry.rig.location = (0, -0.02, larry.rig.location.z)
    for side, dx in (("Left", 0.05), ("Right", -0.05)):
        t = empty(f"steeple{side}", (dx, -0.37, 1.12)); t.parent = piv     # chair-local, spins with the chair
        hand_ik(larry, side, t)
    if spin:
        f0, f1 = spin
        key_rot(piv, 1, (0, 0, 180)); key_rot(piv, f0, (0, 0, 180))
        key_rot(piv, f1, (0, 0, 360 + 0), interp="BEZIER")
    else:
        key_rot(piv, 1, (0, 0, 180))
    return larry, piv


@shot
def sh13():
    """But your new boss... is - the big leather chair behind the CEO desk, turned away. Creak."""
    n = frames_of("sh13")
    larry, piv = boss_office(n)
    you = load_char("you", (0.75, -0.35, 0), rot_z=180)
    you.clip("137_41", **src(n, 4200))
    face(larry, 1, SMUG)
    for f, r in ((1, 180), (int(n * 0.5), 186), (n, 178)):
        key_rot(piv, f, (0, 0, r))
    cam = Cam(lens=30, loc=(-0.45, -1.9, 1.5), target=(0.05, 2.2, 1.15))
    cam.key(1, loc=(-0.45, -1.9, 1.5))
    cam.key(n, loc=(-0.35, -1.45, 1.45))
    return n


@shot
def sh14():
    """LARRY. - the chair spins round: Larry, fingers steepled, smug. Nameplate: LARRY - CEO - YOUR NEW BOSS."""
    n = frames_of("sh14")
    larry, piv = boss_office(n, spin=(1, 9))
    face(larry, 1, SMUG)
    face(larry, 12, CREEPY)
    cam = Cam(lens=34, loc=(0.0, -0.55, 1.05), target=(0.0, 2.2, 1.2))   # low enough to read the CEO nameplate
    cam.key(1, loc=(0.0, -0.55, 1.05))
    cam.key(n, loc=(0.0, -0.2, 1.08))
    stare_at(larry, cam.cam, 9, 14)
    return n


@shot
def sh15():
    """And the guy inside the vending machine... is - break room: you punch B3 on the snack machine."""
    n = frames_of("sh15")
    newcorp_set()
    vm = vending_machine((1.2, 2.9, 0))
    you = load_char("you", (1.25, 1.95, 0), rot_z=165)
    you.clip("137_41", **src(n, 1000))
    press = empty("press", (1.57, 2.5, 1.25))
    key_loc(press, 1, (1.45, 2.3, 1.1))
    key_loc(press, at("sh15", 20.55), (1.57, 2.47, 1.25))
    key_loc(press, at("sh15", 20.65), (1.55, 2.4, 1.24))
    key_loc(press, at("sh15", 20.75), (1.58, 2.47, 1.2))
    key_loc(press, n, (1.5, 2.35, 1.15))
    hand_ik(you, "Right", press)
    face(you, 1, SMILE)
    look_at(you, (1.0, 2.6, 1.2), 0.7)
    cam = Cam(lens=28, loc=(-0.6, -0.3, 1.4), target=(1.1, 2.6, 1.25))
    cam.key(1, loc=(-0.6, -0.3, 1.4))
    cam.key(n, loc=(-0.3, 0.2, 1.4))
    return n


@shot
def sh16():
    """DALE. - through the glass: Dale is folded up inside between the snack rows, face to the glass. Thunk."""
    n = frames_of("sh16")
    newcorp_set()
    vm = vending_machine((1.2, 2.9, 0))
    bpy.data.objects["vm_glass"].hide_render = True       # close-up: the glass only fogged the frame
    dale = load_char("dale", (1.06, 2.95, 0), rot_z=0, subdiv=True)
    pose(dale, SQUAT)
    settle(dale, "Hips", 0.75)
    for side, dx in (("Left", 0.16), ("Right", -0.16)):
        hand_ik(dale, side, empty(f"glass{side}", (1.06 + dx, 2.5, 1.35)))
    face(dale, 1, CREEPY)
    blink(dale, [int(n * 0.6)])
    cam = Cam(lens=40, loc=(1.0, 1.45, 1.3), target=(1.06, 2.9, 1.25))
    cam.key(1, loc=(1.0, 1.45, 1.3))
    cam.key(n, loc=(1.02, 1.75, 1.28))
    cam.shake(1, 6, amp=0.01, freq=0.7)
    look_at(dale, cam.cam, 0.9)
    return n


@shot
def sh17():
    """So you move to another country. - arrivals hall: you (sunglasses outfit) stride in with your suitcase."""
    n = frames_of("sh17")
    airport_set()
    you = load_char("you_sun", (0.3, 4.0, 0), rot_z=0)
    you.clip("70_01", **src(n, 120, in_place=False))
    s = model("vintage_suitcase", (0, 0, 0), rot_z=90)
    fit(s, height=0.5, ground=False)
    for k in list(s.children)[1:]:
        k.hide_render = True
    mn, mx = bbox(s)
    you.bake_follow(s, "RightHand", n, offset=(0.0, 0.0, -(mx.z - mn.z) * 0.95))
    face(you, 1, SMILE)
    cam = Cam(lens=28, loc=(1.3, -0.6, 1.45), target=(0.3, 3.0, 1.35))
    cam.key(1, loc=(1.3, -0.6, 1.45))
    cam.key(n, loc=(1.15, -0.9, 1.45), target=(0.3, 2.0, 1.35))
    return n


@shot
def sh18():
    """PERFECT! - sunglasses, big grin, sunlit arrivals sign behind."""
    n = frames_of("sh18")
    airport_set()
    you = load_char("you_sun", (0, 5.5, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, dict(SMILE, jawOpen=0.15, mouthSmileLeft=1.0, mouthSmileRight=1.0))
    look_at(you, (0.6, 2.0, 1.5), 0.6)
    cam = Cam(lens=34, loc=(0.5, 4.25, 1.2), target=(0.0, 5.5, 1.7))
    cam.key(1, loc=(0.5, 4.25, 1.2))
    cam.key(n, loc=(0.45, 4.4, 1.25))
    return n


@shot
def sh19():
    """But the guy stamping your passport... is - insert: open passport on the booth counter, heart stamp x2."""
    n = frames_of("sh19")
    world_color((0.45, 0.47, 0.5), 0.5)
    plane("counter", (3, 3), (0, 0, 0), mat_tex("ctr", "wood_floor", scale=1.0, tint=(0.6, 0.45, 0.32)), uv_scale=1.0)
    decal("passport", f"{D2}/passport_open.png", 0.26, (0, 0, 0.001), rot=(0, 0, 3))
    hits = [at("sh19", 26.25), at("sh19", 26.72)]
    for k, (h, dx) in enumerate(zip(hits, (0.05, 0.07))):
        st = decal(f"ink{k}", f"{D2}/stamp_heart.png", 0.08, (dx, -0.01 - 0.02 * k, 0.0015 + k * 0.0002),
                   rot=(0, 0, -8 + 14 * k), alpha=True)
        st.hide_render = True; st.keyframe_insert("hide_render", frame=h - 1)
        st.hide_render = False; st.keyframe_insert("hide_render", frame=h)
    rubber = mat_flat("rubber", (0.12, 0.1, 0.1), rough=0.8)
    wood = mat_flat("handle", (0.45, 0.25, 0.12), rough=0.4)
    stamp = empty("stamp", (0.06, -0.02, 0.3))
    for o in (box("stamp_base", (0.07, 0.07, 0.02), (0, 0, 0.01), rubber),
              box("stamp_block", (0.065, 0.065, 0.025), (0, 0, 0.032), wood),
              cylinder("stamp_neck", 0.008, 0.06, (0, 0, 0.075), wood)):
        o.parent = stamp
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0, 0, 0.12)); kn = bpy.context.object
    kn.data.materials.append(wood); kn.parent = stamp; bpy.ops.object.shade_smooth()
    key_loc(stamp, 1, (0.05, -0.01, 0.32))
    for k, (h, dx) in enumerate(zip(hits, (0.05, 0.07))):
        y = -0.01 - 0.02 * k
        key_loc(stamp, max(2, h - 6), (dx, y, 0.22))
        key_loc(stamp, h, (dx, y, 0.002), interp="LINEAR")
        key_loc(stamp, h + 3, (dx, y, 0.002))
    key_loc(stamp, n, (0.12, -0.06, 0.4))
    sun(energy=2.3, rot=(35, 10, 40), color=(1, 0.95, 0.88))
    area("fill", (-0.4, -0.5, 0.8), (0, 0, 0), energy=25, size=1)
    cam = Cam(lens=45, loc=(0.0, -0.3, 0.4), target=(0.0, -0.01, 0.0))
    cam.key(1, loc=(0.0, -0.3, 0.4))
    cam.key(n, loc=(0.0, -0.26, 0.34))
    for h in hits:
        cam.shake(h, h + 6, amp=0.005, freq=0.7)
    return n


@shot
def sh20():
    """LARRY. - the officer behind the booth glass: Larry in a uniform cap, leaning in, stamp by his cheek."""
    n = frames_of("sh20")
    airport_set()
    passport_booth((0, 1.2, 0))
    bpy.data.objects["bt_glass"].hide_render = True      # glass fogged the whole frame
    piv, sz = chair((0, 1.45, 0), rot_z=0, seat_h=0.62)
    larry = load_char("larry", (0, 1.4, 0), rot_z=0, subdiv=True)
    sit(larry, sz)
    on_bone(larry, cap(), "Head", (0, 0.105, 0.0))
    stamp = empty("held_stamp", (0, 0, 0))
    for o in (box("hs_base", (0.07, 0.07, 0.02), (0, 0, 0.01), mat_flat("hsr", (0.12, 0.1, 0.1))),
              box("hs_block", (0.065, 0.065, 0.025), (0, 0, 0.032), mat_flat("hsw", (0.45, 0.25, 0.12)))):
        o.parent = stamp
    larry.attach(stamp, "RightHand", keep_world=False)
    stamp.location = (0, 0.08, 0.02)
    hand_ik(larry, "Right", empty("cheek", (-0.19, 1.16, 1.3)))
    face(larry, 1, CREEPY)
    face(larry, n, CREEPY_ENJOY)
    cam = Cam(lens=34, loc=(0.2, -0.05, 1.5), target=(0.0, 1.4, 1.42))
    cam.key(1, loc=(0.2, -0.05, 1.5))
    cam.key(n, loc=(0.12, 0.15, 1.5))
    look_at(larry, cam.cam, 0.9)
    return n


def dog_dale(loc, rot_z=0.0, tongue=False):
    dale = load_char("dale", loc, rot_z=rot_z, subdiv=True)
    pose(dale, ALL_FOURS)
    bpy.context.scene.frame_set(1)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: dale.world(b).z)
    settle(dale, knee, 0.06)
    bpy.context.scene.frame_set(1)
    for side in ("Left", "Right"):
        sh = dale.world(f"{side}Arm")
        hand_ik(dale, side, empty(f"paw{side}", (sh.x, sh.y, 0.03)))
    k9_vest(dale)
    return dale


@shot
def sh21():
    """And the dog sniffing your bags... is - low wide: a 'dog' in a K-9 vest sniffs your suitcase. Sniff sniff."""
    n = frames_of("sh21")
    airport_set()
    you = load_char("you_sun", (0.6, 2.0, 0), rot_z=-20)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, DEADPAN)
    s = model("vintage_suitcase", (0.05, 1.8, 0), rot_z=90)
    fit(s, height=0.5)
    for k in list(s.children)[1:]:
        k.hide_render = True
    dale = dog_dale((-0.95, 1.85, 0), rot_z=90)
    nose = empty("nose", (0, 0, 0))
    for f in range(1, n + 1, 3):
        key_loc(nose, f, (0.0 + 0.06 * math.sin(f * 0.9), 1.8, 0.45 + 0.05 * math.sin(f * 1.3)))
    look_at(dale, nose, 0.9)
    face(dale, 1, SERENE)
    cam = Cam(lens=24, loc=(-1.0, -1.1, 0.5), target=(-0.5, 1.9, 0.5))
    cam.key(1, loc=(-1.0, -1.1, 0.5))
    cam.key(n, loc=(-0.9, -0.75, 0.48))
    return n


@shot
def sh22():
    """DALE. - the 'dog' looks up into the lens: it's Dale, tongue out, delighted. (woof after the word)"""
    n = frames_of("sh22")
    airport_set()
    dale = dog_dale((0.0, 1.8, 0), rot_z=0)
    face(dale, 1, SERENE)
    face(dale, 5, DOGGY)
    cam = Cam(lens=38, loc=(0.08, -0.25, 0.8), target=(0.0, 1.05, 0.62), dof=2.8)   # in front of his face, low
    cam.key(1, loc=(0.08, -0.25, 0.8))
    cam.key(n, loc=(0.06, -0.05, 0.76))
    stare_at(dale, cam.cam, 1, 6)
    return n


def guard_up(ch, f=None):
    """Boxing guard: fists in front of the chin (IK targets follow the head)."""
    n = bpy.context.scene.frame_end if f is None else f
    for side, dx in (("Left", 0.13), ("Right", -0.13)):
        t = empty(f"fist{side}{ch.name}", (0, 0, 0))
        ch.bake_follow(t, "Head", max(n, 2), offset=(dx * 1.1, -0.27, 0.27), local=True)  # bone: +Y up, +Z forward
        hand_ik(ch, side, t)


@shot
def sh23():
    """So you make them fight over you. - boxing ring, FIGHT NIGHT; you in the centre, Larry and Dale in their corners."""
    n = frames_of("sh23")
    lib.set_frames(n)
    Hh = ring_set()
    you = load_char("you", (0, 0.2, Hh), rot_z=0)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    larry = load_char("larry", (-1.7, 0.6, Hh), rot_z=-70, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 600))
    guard_up(larry, n)
    face(larry, 1, STERN)
    dale = load_char("dale", (1.7, 0.6, Hh), rot_z=70, subdiv=True, tag="dale")
    dale.clip("137_41", **src(n, 1000))
    guard_up(dale, n)
    face(dale, 1, STERN)
    cam = Cam(lens=24, loc=(0.4, -5.0, 2.4), target=(0.0, 0.4, Hh + 1.0))
    cam.key(1, loc=(0.4, -5.0, 2.4))
    cam.key(n, loc=(0.3, -4.3, 2.3))
    return n


@shot
def sh24():
    """MUCH BETTER! - you in the spotlight, smug low angle, banner glowing behind."""
    n = frames_of("sh24")
    Hh = ring_set()
    you = load_char("you", (0, 0.2, Hh), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, dict(SMUG, mouthSmileRight=0.9))
    look_at(you, (-1.5, -4.0, Hh + 2.4), 0.7)
    cam = Cam(lens=30, loc=(0.35, -0.75, Hh + 1.0), target=(0.0, 0.2, Hh + 1.65))
    cam.key(1, loc=(0.35, -0.75, Hh + 1.0))
    cam.key(n, loc=(0.3, -0.65, Hh + 1.05))
    return n


@shot
def sh25():
    """But they team up instead. - Larry and Dale meet over your head in a big high five. You: deadpan."""
    n = frames_of("sh25")
    lib.set_frames(n)
    Hh = ring_set()
    you = load_char("you", (0, 0.2, Hh), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, DEADPAN)
    blink(you, [at("sh25", 35.3)])
    larry = load_char("larry", (-0.62, 0.45, Hh), rot_z=-90, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 600))
    dale = load_char("dale", (0.62, 0.45, Hh), rot_z=90, subdiv=True, tag="dale")
    dale.clip("137_41", **src(n, 1000))
    hit = at("sh25", 34.98)
    for ch, sx in ((larry, -1), (dale, 1)):
        t = empty(f"hi5{ch.name}", (0, 0, 0))
        key_loc(t, 1, (sx * 0.5, 0.45, Hh + 1.2))
        key_loc(t, max(2, hit - 5), (sx * 0.25, 0.42, Hh + 2.15))
        key_loc(t, hit, (sx * 0.03, 0.42, Hh + 2.05), interp="LINEAR")
        key_loc(t, n, (sx * 0.05, 0.42, Hh + 2.0))
        hand_ik(ch, "Right" if sx < 0 else "Left", t)
        face(ch, 1, SMILE)
        face(ch, hit, TADA)
    cam = Cam(lens=24, loc=(0.3, -1.95, Hh + 1.4), target=(0.0, 0.35, Hh + 1.55))
    cam.key(1, loc=(0.3, -1.95, Hh + 1.4))
    cam.key(n, loc=(0.25, -1.75, Hh + 1.42))
    cam.shake(hit, hit + 5, amp=0.015, freq=0.7)
    return n


def tee_duo(n):
    """Larry and Dale in matching white tees with your face printed on them, arms round each other."""
    Hh = ring_set()
    larry = load_char("larry_tee", (-0.33, 0.3, Hh), rot_z=0, subdiv=True, tag="larry")
    larry.clip("137_41", **src(n, 4150))
    dale = load_char("dale_tee", (0.33, 0.3, Hh), rot_z=0, subdiv=True, tag="dale")
    dale.clip("137_41", **src(n, 4200))
    chest_print(larry, f"{D2}/tshirt_print.png", width=0.26, y=0.04, z=0.25, name="print_larry")   # clears his belly
    chest_print(dale, f"{D2}/tshirt_print.png", width=0.25, y=0.06, z=0.2, name="print_dale")
    sl = empty("dale_waist", (0, 0, 0)); dale.bake_follow(sl, "Hips", n, offset=(-0.1, 0.08, 0.1))  # behind Dale's hip
    hand_ik(larry, "Left", sl)
    sr = empty("larry_shoulder", (0, 0, 0)); larry.bake_follow(sr, "RightArm", n, offset=(0.0, 0.0, 0.05))
    hand_ik(dale, "Right", sr)
    return Hh, larry, dale


@shot
def sh26():
    """Matching T-shirts. - the reveal: both in white tees with your face in a heart, proud as parents. Twinkle."""
    n = frames_of("sh26")
    lib.set_frames(n)
    Hh, larry, dale = tee_duo(n)
    for ch in (larry, dale):
        face(ch, 1, TADA)
    cam = Cam(lens=30, loc=(0.0, -2.0, Hh + 1.4), target=(0.0, 0.3, Hh + 1.3))
    cam.key(1, loc=(0.0, -2.0, Hh + 1.4))
    cam.key(n, loc=(0.0, -1.75, Hh + 1.4))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.8)
    return n


@shot
def sh27():
    """With YOUR FACE. - push in on the prints, then tilt up to their grins."""
    n = frames_of("sh27")
    lib.set_frames(n)
    Hh, larry, dale = tee_duo(n)
    for ch in (larry, dale):
        face(ch, 1, CREEPY)
        face(ch, n, CREEPY_ENJOY)
    cam = Cam(lens=30, loc=(0.0, -1.35, Hh + 1.35), target=(0.0, 0.3, Hh + 1.35))   # both prints, then both faces
    cam.key(1, loc=(0.0, -1.35, Hh + 1.35), target=(0.0, 0.3, Hh + 1.35), lens=30)
    cam.key(int(n * 0.45), loc=(0.0, -1.15, Hh + 1.35), target=(0.0, 0.3, Hh + 1.37), lens=30)
    cam.key(n, loc=(0.0, -1.3, Hh + 1.6), target=(0.0, 0.3, Hh + 1.64), lens=28)
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.8)
    return n


@shot
def sh28():
    """Seventy years later, - hospital room at sunset: very old you in bed, monitor beeping. Slow push."""
    n = frames_of("sh28")
    hospital_set()
    you = you_in_hospital_bed()
    blink(you, [20, 50])
    cam = Cam(lens=28, loc=(1.9, -1.4, 1.9), target=(0.1, 1.2, 0.95))
    cam.key(1, loc=(1.9, -1.4, 1.9))
    cam.key(n, loc=(1.45, -0.7, 1.75))
    return n


@shot
def sh29():
    """you finally die. - the monitor: beats... flatline on 'die'."""
    n = frames_of("sh29")
    flat = at("sh29", 40.95)
    hospital_set(flat_from=flat)
    you_in_hospital_bed(subdiv=False)
    cam = Cam(lens=45, loc=(1.6, 0.6, 1.5), target=(0.98, 1.54, 1.42), dof=3.5)
    cam.key(1, loc=(1.6, 0.6, 1.5))
    cam.key(n, loc=(1.45, 0.85, 1.48))
    return n


@shot
def sh30():
    """Peace at last. - heaven: you (white tee, young again) walk the clouds toward the golden gates. Harp, choir."""
    n = frames_of("sh30")
    heaven_set()
    you = load_char("you_sun", (0.0, -1.5, 0), rot_z=180)     # white tee + shorts; sunglasses off in heaven
    you.hide("sunglass")
    you.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    face(you, 1, SERENE)
    cam = Cam(lens=28, loc=(0.7, -3.6, 1.2), target=(0.0, 3.0, 1.9))
    cam.key(1, loc=(0.7, -3.6, 1.2))
    cam.key(n, loc=(0.5, -3.0, 1.35), target=(0.0, 3.5, 2.2))
    return n


def angel(name, loc, n, rot_z=180.0, tag=None, clip_start=4200):
    ch = load_char(name, loc, rot_z=rot_z, subdiv=True, tag=tag)
    ch.clip("137_41", **src(n, clip_start))
    angelify(ch)
    return ch


@shot
def sh31():
    """But the angel at heaven's gate... is - over your shoulder: an angel stands at the gate, back to us."""
    n = frames_of("sh31")
    heaven_set()
    you = load_char("you_sun", (1.0, 1.0, 0), rot_z=180)
    you.hide("sunglass")
    you.clip("137_41", **src(n, 4200))
    larry = angel("larry", (-0.9, 3.4, 0), n, rot_z=180, tag="larry")
    face(larry, 1, CREEPY)
    cam = Cam(lens=32, loc=(1.3, -0.6, 1.65), target=(-0.85, 3.4, 1.5))
    cam.key(1, loc=(1.3, -0.6, 1.65))
    cam.key(n, loc=(1.2, -0.1, 1.62))
    return n


@shot
def sh32():
    """LARRY. - the angel turns round: halo, wings... Larry. Creepy grin into the lens. (choir cuts dead)"""
    n = frames_of("sh32")
    heaven_set()
    larry = angel("larry", (-0.9, 3.4, 0), n, rot_z=180, tag="larry")
    turn_around(larry, 1, 7)
    face(larry, 1, DEADPAN)
    face(larry, 7, CREEPY)
    cam = Cam(lens=40, loc=(-0.6, 1.9, 1.4), target=(-0.9, 3.4, 1.45))
    cam.key(1, loc=(-0.6, 1.9, 1.4))
    cam.key(n, loc=(-0.65, 2.2, 1.42))
    stare_at(larry, cam.cam, 6, 10)
    return n


@shot
def sh33():
    """And the other angel... is - pan across the gate to a second, much taller angel, back to us."""
    n = frames_of("sh33")
    heaven_set()
    larry = angel("larry", (-0.9, 3.4, 0), n, rot_z=0, tag="larry")
    face(larry, 1, CREEPY)
    dale = angel("dale", (0.9, 3.4, 0), n, rot_z=180, tag="dale", clip_start=1000)
    face(dale, 1, CREEPY)
    cam = Cam(lens=32, loc=(-0.9, 0.2, 1.5), target=(-0.8, 3.4, 1.5))
    cam.key(1, loc=(-0.9, 0.2, 1.5), target=(-0.8, 3.4, 1.5))
    cam.key(n, loc=(0.6, 0.4, 1.6), target=(0.9, 3.4, 1.7))
    return n


@shot
def sh34():
    """DALE. - the tall angel turns: Dale, halo crooked on his ginger hair, the same grin."""
    n = frames_of("sh34")
    heaven_set()
    dale = angel("dale", (0.9, 3.4, 0), n, rot_z=180, tag="dale", clip_start=1000)
    turn_around(dale, 1, 6)
    face(dale, 1, DEADPAN)
    face(dale, 6, CREEPY)
    cam = Cam(lens=38, loc=(0.75, 1.7, 1.55), target=(0.9, 3.4, 1.6))
    cam.key(1, loc=(0.75, 1.7, 1.55))
    cam.key(n, loc=(0.78, 1.95, 1.56))
    stare_at(dale, cam.cam, 5, 9)
    return n


@shot
def sh35():
    """'We've been waiting for you.' - both angels side by side, gates swinging open behind; they say it in
    unison into the lens; snap zoom + shake on the sting; assemble.sh grades the last beat red."""
    n = frames_of("sh35")
    lib.set_frames(n)
    heaven_set(gate_open_frames=(1, at("sh35", 49.4)))
    larry = angel("larry", (-0.33, 2.6, 0), n, rot_z=8, tag="larry", clip_start=4150)
    dale = angel("dale", (0.33, 2.6, 0), n, rot_z=-8, tag="dale", clip_start=4200)
    syll = [(48.48, 48.64, 0.3, 0.1), (48.64, 48.74, 0.2, 0.0), (48.74, 48.86, 0.3, 0.0), (48.86, 48.96, 0.15, 0.0),
            (48.96, 49.28, 0.25, 0.3), (49.28, 49.49, 0.3, 0.7)]
    for ch in (larry, dale):
        face(ch, 1, CREEPY)
        lipsync(ch, lambda t: at("sh35", t), syll)
        face(ch, at("sh35", 49.55), CREEPY_ENJOY)
    blink(dale, [at("sh35", 49.9)])
    sting = at("sh35", 49.55)
    cam = Cam(lens=30, loc=(0.0, -1.0, 1.5), target=(0.0, 2.6, 1.55))      # both faces stay in frame to the end
    cam.key(1, loc=(0.0, -1.0, 1.5), lens=30)
    cam.key(sting - 1, loc=(0.0, -0.5, 1.52), lens=30, interp="CONSTANT")
    cam.key(sting, loc=(0.0, -0.45, 1.55), lens=37, interp="CONSTANT")
    cam.key(n, loc=(0.0, -0.35, 1.55), lens=39)
    cam.shake(sting, n, amp=0.01, freq=0.8)
    for ch in (larry, dale):
        stare_at(ch, cam.cam, 1, 4)
    return n


