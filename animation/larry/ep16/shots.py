"""Shot definitions for Episode 16 "Here Lies Dale" (part 1): Dale was never missing, it was Larry and Dale's plan to
move in and cuddle you. So you grab an AK-47, find Dale on your couch eating your cereal... BANG (we cut away to the
house). You dig all night in the garden, drop him in, fill the hole, put a little stone on top: HERE LIES DALE.
FINALLY. You sleep. Three days later the dirt starts to move. Vote: is Dale really dead? Part 2 reveals.
Same pipeline as episodes 1-15 (imports the newest episode, 15 -> 14 -> ...). Props are scene objects only; character
files untouched. Smoothness rules from episodes 12-15: no finger close-ups, forward-facing idle range, heads levelled,
whole-body motion through pivots, hand targets world-fixed or riding the moving prop/pivot."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector, Euler
import lib
from lib import (empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(modname, folder):
    spec = importlib.util.spec_from_file_location(modname, os.path.join(_HERE, "..", folder, "shots.py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules[modname] = m
    spec.loader.exec_module(m)
    return m


ep15 = _load("ep15shots", "ep15")         # newest episode (its chain: 14, 13, 12, ... 1)
ep14, ep13, ep12, ep11, ep9, ep7 = ep15.ep14, ep15.ep13, ep15.ep12, ep15.ep11, ep15.ep9, ep15.ep7
ep6, ep4, ep3, ep2, ep1 = ep15.ep6, ep15.ep4, ep15.ep3, ep15.ep2, ep15.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, SERENE, face, blink,
                      look_at, hand_ik, src, pose, settle, on_bone)  # noqa: E402
STERN, RAGE, SLEEP = ep1.STERN, ep1.RAGE, ep1.SLEEP
GRIN, SAD = ep6.GRIN, ep7.SAD
load_char, closeup, face_light, spot, stamp = ep9.load_char, ep9.closeup, ep9.face_light, ep9.spot, ep9.stamp
look_keys, sit_level = ep12.look_keys, ep12.sit_level
rocker, glue, rock, talk, hold, head = ep13.rocker, ep13.glue, ep13.rock, ep13.talk, ep13.hold, ep13.head
vis = ep14.vis
you_char, larry_char, dale_char, idle = ep15.you_char, ep15.larry_char, ep15.dale_char, ep15.idle
tears, sob = ep15.tears, ep15.sob

D16 = os.path.join(lib.SCRATCH, "ep16", "decals")
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


DEADFACE = {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0, "jawOpen": 0.25, "tongueOut": 0.6}
PEACEFUL = dict(SLEEP, mouthSmileLeft=0.55, mouthSmileRight=0.55)
SNUG = dict(CREEPY_ENJOY, eyeBlinkLeft=0.7, eyeBlinkRight=0.7)
WIDE = dict(SHOCK, jawOpen=0.0, mouthPressLeft=0.6, mouthPressRight=0.6)
HX, HY = 0.45, 1.0              # half-size of the grave hole (long axis along Y; head end at +Y)


# ============================================================================ props
def ak47(name="ak"):
    """Cartoon assault rifle from primitives, barrel along -Y, origin at the pistol grip."""
    root = empty(name)
    metal = mat_flat(f"{name}_metal", (0.06, 0.06, 0.065), metal=0.6, rough=0.35)
    wood = mat_flat(f"{name}_wood", (0.42, 0.2, 0.07), rough=0.45)

    def part(nm, size, loc, m, rot=(0, 0, 0), bevel=0.0):
        o = box(f"{name}_{nm}", size, loc, m, rot=rot, bevel=bevel); o.parent = root
        return o
    part("receiver", (0.055, 0.34, 0.085), (0, -0.1, 0.08), metal, bevel=0.008)
    part("handguard", (0.06, 0.2, 0.07), (0, -0.37, 0.075), wood, bevel=0.012)
    part("gastube", (0.032, 0.2, 0.03), (0, -0.37, 0.125), wood, bevel=0.008)
    c = cylinder(f"{name}_barrel", 0.011, 0.34, (0, -0.6, 0.085), metal, rot=(90, 0, 0), verts=12); c.parent = root
    part("frontsight", (0.012, 0.02, 0.05), (0, -0.73, 0.12), metal)
    part("muzzle", (0.03, 0.05, 0.03), (0, -0.78, 0.085), metal)
    part("grip", (0.04, 0.05, 0.12), (0, 0.0, -0.0), wood, rot=(-20, 0, 0), bevel=0.008)
    part("stock", (0.045, 0.3, 0.09), (0, 0.22, 0.05), wood, rot=(8, 0, 0), bevel=0.012)
    part("butt", (0.05, 0.03, 0.14), (0, 0.37, 0.02), metal)
    for k, (y, z, a) in enumerate(((-0.15, 0.0, 10), (-0.17, -0.07, 22), (-0.2, -0.13, 34))):   # curved magazine
        part(f"mag{k}", (0.04, 0.06, 0.08), (0, y, z), metal, rot=(a, 0, 0))
    return root


GRIP_R = Vector((0.0, 0.0, 0.0))          # rifle-space hand points
GRIP_L = Vector((0.0, -0.37, 0.05))


def hold_rifle(ch, piv=None, yaw_body=0.0, aim=25.0, fwd=0.18, side=-0.1, up=0.22, name="ak"):
    """Low ready: the rifle across the body, barrel forward-left and a little down; both hands on it (IK).
    yaw_body = the character's facing (degrees, 0 = -Y). Returns (rifle, right target, left target)."""
    rifle = ak47(name)
    hp = ch.world("Hips", frame=1)
    R = Euler((0, 0, math.radians(yaw_body))).to_matrix()
    off = R @ Vector((side, -fwd, up))
    rifle.location = hp + off
    rifle.rotation_euler = (math.radians(6), 0, math.radians(yaw_body + aim))
    if piv is not None:
        glue(rifle, piv)
    tr = empty(f"{name}_tr", (0, 0, 0)); tr.parent = rifle; tr.location = GRIP_R
    tl = empty(f"{name}_tl", (0, 0, 0)); tl.parent = rifle; tl.location = GRIP_L
    hand_ik(ch, "Right", tr); hand_ik(ch, "Left", tl)
    return rifle, tr, tl


def shovel(name="shovel"):
    """Garden spade: origin at the blade tip, handle up +Z, blade face toward -Y."""
    root = empty(name)
    wood = mat_flat(f"{name}_wood", (0.45, 0.28, 0.12), rough=0.5)
    steel = mat_flat(f"{name}_steel", (0.5, 0.52, 0.55), metal=0.8, rough=0.35)
    box(f"{name}_blade", (0.2, 0.025, 0.27), (0, 0, 0.135), steel, bevel=0.01).parent = root
    cylinder(f"{name}_handle", 0.016, 0.9, (0, 0, 0.27 + 0.45), wood, verts=12).parent = root
    box(f"{name}_grip", (0.14, 0.03, 0.03), (0, 0, 1.19), wood, bevel=0.008).parent = root
    return root


def dirt_mat():
    return mat_tex("dirt16", "coast_sand_01", scale=1.0, tint=(0.33, 0.22, 0.13))


def dig(ch, piv, sh, n, base, yaw=0.0, period=22, f0=1, lean=12.0, clods=True, toss=(0.55, 0.15)):
    """Shovelling loop. base = world point on the dig surface in front of the feet; yaw = facing (0 = -Y).
    The spade plunges, levers up and tosses to the right (+X local of the facing, i.e. toward the pile); both hands
    ride the handle (IK targets parented to the spade); the body pitches with each stroke."""
    R = Euler((0, 0, math.radians(yaw))).to_matrix()

    def P(lx, ly, lz):
        return Vector(base) + R @ Vector((lx, ly, lz))
    poses = [(0.0, P(0.0, -0.05, -0.03), -16.0, 0.0), (0.4, P(0.0, -0.1, 0.24), -52.0, 0.0),
             (0.7, P(toss[0], toss[1], 0.52), -40.0, 48.0), (1.0, P(0.0, -0.05, -0.03), -16.0, 0.0)]
    tgt_r = empty(f"{sh.name}_hr"); tgt_r.parent = sh; tgt_r.location = (0, 0, 1.17)
    tgt_l = empty(f"{sh.name}_hl"); tgt_l.parent = sh; tgt_l.location = (0, 0, 0.72)
    hand_ik(ch, "Right", tgt_r); hand_ik(ch, "Left", tgt_l)
    cyc = 0
    clod_m = dirt_mat()
    f = f0
    while f <= n + period:
        for ph, p, tilt, yw in poses:
            fr = f + int(round(ph * period))
            if fr > n + 2:
                continue
            key_loc(sh, max(1, fr), p)
            key_rot(sh, max(1, fr), (tilt, 0, yaw + yw))
        rock(piv, [(f, lean), (f + int(0.4 * period), lean * 0.3), (f + int(0.7 * period), lean * 0.55)])
        if clods:
            ft = f + int(0.62 * period)
            for k in range(3):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.04 + 0.01 * k)
                c = bpy.context.object; c.name = f"clod{cyc}_{k}"; c.data.materials.append(clod_m)
                p0 = P(toss[0] * 0.6, toss[1], 0.5)
                p1 = P(toss[0] * 1.9 + 0.08 * k, toss[1] + 0.1 * (k - 1), 0.1)
                for j, u in enumerate((0.0, 0.5, 1.0)):
                    key_loc(c, max(1, ft + int(u * 8)), p0.lerp(p1, u) + Vector((0, 0, 0.35 * 4 * u * (1 - u))), interp="LINEAR")
                vis(c, f_on=max(1, ft), f_off=ft + 10)
        cyc += 1
        f += period
    return tgt_r, tgt_l


def gravestone(loc=(0, HY + 0.12, 0), name="stone"):
    """Little rounded headstone, text facing -Y."""
    root = empty(name, loc)
    m = mat_flat("stonem", (0.45, 0.45, 0.47), rough=0.85)
    box(f"{name}_slab", (0.46, 0.1, 0.42), (0, 0, 0.21), m, bevel=0.015).parent = root
    c = cylinder(f"{name}_top", 0.23, 0.1, (0, 0, 0.42), m, rot=(90, 0, 0), verts=32); c.parent = root
    face_ = decal(f"{name}_face", f"{D16}/stone_face.png", 0.36, (0, -0.052, 0.3), rot=(90, 0, 0)); face_.parent = root
    return root


def flashlight(loc=(-0.85, -1.45, 0.05), target=(0.0, 0.2, -0.8), energy=450):
    body = cylinder("torch", 0.035, 0.2, loc, mat_flat("torchm", (0.85, 0.12, 0.08), rough=0.4), verts=16)
    d = Vector(target) - Vector(loc)
    body.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    lens = mat_flat("torchlens", (1, 1, 0.9), emit=(1.0, 0.95, 0.8), emit_strength=6)
    tip = cylinder("torchlens", 0.034, 0.01, Vector(loc) + d.normalized() * 0.1, lens, verts=16)
    tip.rotation_euler = body.rotation_euler
    return spot("torchbeam", Vector(loc) + d.normalized() * 0.12, target, energy=energy, angle=48, blend=0.5,
                color=(1.0, 0.93, 0.8), shadow=True)


# ============================================================================ sets
def night_sky():
    world_color((0.012, 0.018, 0.05), 0.55)
    moon = mat_flat("moon16", (1, 1, 1), emit=(0.85, 0.9, 1.0), emit_strength=6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=4.0, location=(-28, 70, 38)); mo = bpy.context.object
    mo.data.materials.append(moon); bpy.ops.object.shade_smooth()
    star = mat_flat("star16", (1, 1, 1), emit=(1, 1, 1), emit_strength=8)
    r = random.Random(9)
    for i in range(160):
        a = r.uniform(-1.3, 1.3); e = r.uniform(0.25, 1.2)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r.uniform(0.08, 0.18),
                                              location=(90 * math.sin(a), 90 * math.cos(a) + 10, 90 * math.sin(e)))
        bpy.context.object.data.materials.append(star)
    sun(energy=0.7, rot=(55, 0, -150), color=(0.55, 0.65, 1.0))
    area("moonfill", (-4, -6, 6), (0, 4, 1.5), energy=900, size=6, color=(0.45, 0.55, 1.0))


def backyard(hole=0.0, filled=False, stone=False, torch=True, pile=True):
    """Your back garden at night: lawn (with a grave hole `hole` metres deep, centred at the origin, long axis Y),
    a dirt pile, the back of the house with a lit window, fences, trees, a flashlight on the grass."""
    night_sky()
    grass = mat_tex("bgrass", "leafy_grass", scale=1.0)
    if hole > 0:
        for nm, sz, lc in (("g_l", (40, 80, 0.2), (-20 - HX, 0, -0.1)), ("g_r", (40, 80, 0.2), (20 + HX, 0, -0.1)),
                           ("g_f", (2 * HX, 40, 0.2), (0, -20 - HY, -0.1)), ("g_b", (2 * HX, 40, 0.2), (0, 20 + HY, -0.1))):
            box(nm, sz, lc, grass, uv_scale=0.4)
        dm = dirt_mat()
        for nm, sz, lc in (("pit_l", (0.1, 2 * HY + 0.2, hole), (-HX - 0.05, 0, -hole / 2)),
                           ("pit_r", (0.1, 2 * HY + 0.2, hole), (HX + 0.05, 0, -hole / 2)),
                           ("pit_f", (2 * HX, 0.1, hole), (0, -HY - 0.05, -hole / 2)),
                           ("pit_b", (2 * HX, 0.1, hole), (0, HY + 0.05, -hole / 2)),
                           ("pit_floor", (2 * HX + 0.2, 2 * HY + 0.2, 0.1), (0, 0, -hole - 0.05))):
            box(nm, sz, lc, dm, uv_scale=0.6)
    else:
        ep2.ground("leafy_grass", size=120, scale=0.4)
    dm = dirt_mat()
    if pile:
        h = 0.18 + 0.32 * min(1.0, max(hole, 0.6 if filled else 0.0) / 1.7)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=(1.35, 0.0, 0.0))
        p = bpy.context.object; p.name = "dirtpile"; p.scale = (0.55, 1.15, h)
        tx = bpy.data.textures.get("pile16") or bpy.data.textures.new("pile16", "CLOUDS"); tx.noise_scale = 0.3
        md = p.modifiers.new("lumps", "DISPLACE"); md.texture = tx; md.strength = 0.12
        p.data.materials.append(dm); bpy.ops.object.shade_smooth()
        if filled:
            p.scale = (0.45, 0.9, 0.12)
    mound = None
    if filled:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.04))
        mound = bpy.context.object; mound.name = "mound"; mound.scale = (2 * HX + 0.1, 2 * HY + 0.1, 0.3)
        bpy.ops.object.transform_apply(scale=True)
        bv = mound.modifiers.new("round", "BEVEL"); bv.width = 0.14; bv.segments = 5
        ss = mound.modifiers.new("sub", "SUBSURF"); ss.levels = 2; ss.render_levels = 2
        tx = bpy.data.textures.get("mound16") or bpy.data.textures.new("mound16", "CLOUDS"); tx.noise_scale = 0.18
        md = mound.modifiers.new("lumps", "DISPLACE"); md.texture = tx; md.strength = 0.05
        mound.data.materials.append(dm); bpy.ops.object.shade_smooth()
    st = gravestone() if stone else None
    wall = mat_tex("hbwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.9, 0.82))
    box("house_back", (12, 0.3, 3.0), (0, 7.2, 1.5), wall, uv_scale=0.4)
    box("house_roof", (12.4, 1.0, 0.2), (0, 7.0, 3.1), mat_flat("roofm16", (0.25, 0.22, 0.22), rough=0.8))
    box("backwin", (1.4, 0.06, 1.2), (-2.4, 7.04, 1.6), mat_flat("backwinglow", (1, 1, 1), emit=(1.0, 0.75, 0.45), emit_strength=2.2))
    box("backdoor", (0.95, 0.06, 2.05), (1.6, 7.04, 1.03), mat_flat("backdoorm", (0.35, 0.2, 0.1), rough=0.5))
    fence = mat_flat("fence16", (0.42, 0.3, 0.2), rough=0.8)
    for x in (-6.0, 6.0):
        box(f"fence{x}", (0.06, 14, 1.6), (x, 0, 0.8), fence)
        for k in range(-7, 8):
            box(f"post{x}{k}", (0.1, 0.1, 1.75), (x, k * 1.0, 0.87), fence)
    for i, (x, y) in enumerate(((-4.2, 4.5), (4.8, 5.2), (-5.0, -3.0))):
        ep1.blob_tree((x, y, 0), height=5.0, seed=i + 3)
    point("backporch", (1.6, 6.6, 2.4), energy=80, color=(1.0, 0.75, 0.45), radius=0.2)
    if torch:
        flashlight()
    return {"mound": mound, "stone": st}


def bedroom():
    ep4.bedroom_night(window_open=False, with_dresser=False, clock=False)


def lightning(frames, sky=True):
    """Lightning flashes through the bedroom window at the given frames."""
    bolt = area("lightning", (5.0, 0.6, 2.4), (0, 0.6, 1.4), energy=0, size=2.0, color=(0.85, 0.9, 1.0))
    bolt.data.energy = 0; bolt.data.keyframe_insert("energy", frame=1)
    nodes = bpy.data.objects["win_sky"].data.materials[0].node_tree.nodes["Principled BSDF"]
    s0 = nodes.inputs["Emission Strength"].default_value
    nodes.inputs["Emission Strength"].keyframe_insert("default_value", frame=1)
    for f in frames:
        for df, e, s in ((-1, 0, s0), (0, 9000, 8.0), (2, 0, s0), (3, 6000, 6.0), (5, 0, s0)):
            bolt.data.energy = e; bolt.data.keyframe_insert("energy", frame=max(1, f + df))
            nodes.inputs["Emission Strength"].default_value = s
            nodes.inputs["Emission Strength"].keyframe_insert("default_value", frame=max(1, f + df))
    return bolt


def in_bed_trio(n, sd=True):
    """You under the duvet in the middle; Dale and Larry lying on top of the covers on both sides, inner arms across
    your chest, heads turned to you."""
    you = ep4.you_asleep()
    hy = head(you)
    chest = you.world("Spine1", frame=1) + Vector((0, 0, 0.12))
    dale = dale_char(sd=sd)
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-86), 0, 0)
    dale.rig.location = (0.6, 0.08, 0.86)
    larry = larry_char(sd=sd)
    larry.hold("137_41", 2800)
    larry.rig.rotation_euler = (math.radians(-86), 0, 0)
    larry.rig.location = (-0.6, 0.08, 0.86)
    for nm in ("skirt", "skirt_band"):
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    ep15.hide_bouquet()
    hand_ik(dale, "Right", empty("dale_hug", chest + Vector((0.05, 0.05, 0.02))))
    hand_ik(larry, "Left", empty("larry_hug", chest + Vector((-0.05, -0.05, 0.03))))
    look_keys(dale, empty("look_you_d", hy), [(1, 0.85)])
    look_keys(larry, empty("look_you_l", hy), [(1, 0.85)])
    face(dale, 1, SNUG); face(larry, 1, SNUG)
    face(you, 1, WIDE)
    return you, dale, larry


def living_room_day():
    return ep15.living_room()


def cereal_bowl(name="bowl"):
    root = empty(name)
    cer = mat_flat("ceramic", (0.95, 0.95, 0.96), rough=0.2)
    milk = mat_flat("milk", (0.98, 0.97, 0.93), rough=0.3)
    flake = mat_flat("flake", (0.85, 0.55, 0.15), rough=0.6)
    cylinder(f"{name}_body", 0.08, 0.065, (0, 0, 0.0325), cer, verts=24).parent = root
    cylinder(f"{name}_milk", 0.072, 0.004, (0, 0, 0.062), milk, verts=24).parent = root
    r = random.Random(5)
    for k in range(9):
        a = r.uniform(0, 6.28); rr = r.uniform(0, 0.055)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012, location=(rr * math.cos(a), rr * math.sin(a), 0.066))
        o = bpy.context.object; o.scale = (1.3, 1.3, 0.5); o.data.materials.append(flake); o.parent = root
    return root


def spoon(name="spoon"):
    root = empty(name)
    m = mat_flat("spoonm", (0.85, 0.86, 0.88), metal=1.0, rough=0.2)
    box(f"{name}_handle", (0.012, 0.12, 0.006), (0, 0.06, 0), m).parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.022, location=(0, -0.01, 0))
    b = bpy.context.object; b.scale = (0.8, 1.2, 0.35); b.data.materials.append(m); b.parent = root
    return root


def dale_on_couch(n, eat=True, wave_from=None):
    """Dale on your couch in your living room, cereal bowl in his left hand, spoon going bowl -> mouth."""
    dale = dale_char()
    ep15.couch_sit(dale, 0.0)
    hp = dale.world("Hips", frame=1)
    hd = head(dale)
    bowl = cereal_bowl()
    bowl.location = hp + Vector((0.06, -0.3, 0.2))
    tl = empty("bowl_hand", bowl.location + Vector((0.06, 0.02, 0.02)))
    ep6.retarget_hand(dale, "Left", tl)
    tr = empty("spoon_hand")
    sp = spoon(); sp.parent = tr; sp.location = (-0.02, -0.06, 0.0)
    ep6.retarget_hand(dale, "Right", tr)
    low = bowl.location + Vector((-0.03, 0.0, 0.1))
    mouth = hd + Vector((-0.04, -0.2, -0.17))
    f = 1
    k = 0
    while f <= n:
        if wave_from is not None and f >= wave_from:
            break
        key_loc(tr, f, low if k % 2 == 0 else mouth)
        f += 9; k += 1
    if wave_from is not None:
        key_loc(tr, wave_from, mouth)
        for j, fw in enumerate(range(wave_from + 6, n + 1, 5)):
            key_loc(tr, fw, hd + Vector((-0.32 - (0.07 if j % 2 else 0.0), -0.15, 0.14)))
    for kk in range(0, n, 6):
        dale.expr(1 + kk, {"jawOpen": 0.28 if (kk // 6) % 2 else 0.05})
    return dale, bowl


# ============================================================================ SHOTS: the plan
@shot
def sh01():
    """You are going to KILL DALE TONIGHT! - you by the bedroom window, lightning, a face of pure murder."""
    n = frames_of("sh01")
    closeup()
    bedroom()
    you = you_char((1.85, 0.45, 0), rot_z=-60)
    idle(you, n)
    face(you, 1, STERN); face(you, 14, RAGE)
    lightning([12, 52])
    hy = head(you)
    cam = Cam(lens=45, loc=(hy.x - 0.55, hy.y - 0.65, hy.z + 0.02), target=(hy.x, hy.y, hy.z - 0.03))
    cam.key(1, loc=(hy.x - 0.55, hy.y - 0.65, hy.z + 0.02)); cam.key(n, loc=(hy.x - 0.42, hy.y - 0.5, hy.z + 0.02))
    face_light(cam, energy=40, size=1.0, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh02():
    """Because Dale was NEVER missing. - the MISSING poster on the lamp post; a red FAKE stamp slams onto it."""
    n = frames_of("sh02")
    ep4.house_exterior(night=True, chimney=True)
    decal("poster", f"{D15}/poster_missing.png", 0.42, (4.5, -2.69, 1.62), rot=(90, 0, 0))
    point("posterlight", (4.4, -3.4, 2.2), energy=60, color=(1.0, 0.85, 0.6), radius=0.2)
    cam = Cam(lens=40, loc=(4.42, -3.75, 1.6), target=(4.5, -2.7, 1.6))
    cam.key(1, loc=(4.42, -3.75, 1.6)); cam.key(n, loc=(4.46, -3.4, 1.6))
    stamp(cam, f"{D16}/stamp_fake.png", at("sh02", 4.25), width=0.085, dist=0.25, y=0.0)
    return n


@shot
def sh03():
    """It was all a PLAN. - the plan board on the living-room wall: red string, steps 1 to 4, hearts."""
    n = frames_of("sh03")
    living_room_day()
    box("cork", (1.66, 0.04, 1.16), (0.0, 2.62, 1.8), mat_flat("corkframe", (0.36, 0.24, 0.13), rough=0.7))
    decal("plan", f"{D16}/plan_board.png", 1.6, (0.0, 2.595, 1.8), rot=(90, 0, 0))
    cam = Cam(lens=30, loc=(0.0, 0.3, 1.78), target=(0.0, 2.6, 1.8))
    cam.key(1, loc=(0.0, 0.3, 1.78)); cam.key(n, loc=(0.0, 1.05, 1.8))
    return n


@shot
def sh04():
    """Dale disappears. - night: Dale tiptoes off down the street with a little suitcase, looking back, grinning."""
    n = frames_of("sh04")
    closeup()
    ep4.house_exterior(night=True, chimney=True)
    dale = dale_char((-1.4, -1.0, 0), rot_z=90)
    dale.clip("07_01", **src(n, 60, speed=0.75, in_place=False))
    on_bone(dale, ep15.suitcase(), "RightHand", (0.0, 0.08, 0.0), rot=(0, 0, 0))
    look_keys(dale, empty("lookback", (-2.5, -4.2, 1.6)), [(1, 0.0), (8, 0.7), (n, 0.7)])
    face(dale, 1, GRIN)
    cam = Cam(lens=30, loc=(0.2, -4.6, 1.4), target=(0.2, -0.6, 1.1))
    cam.key(1, loc=(0.2, -4.6, 1.4)); cam.key(n, loc=(0.4, -4.4, 1.4))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh05():
    """Larry cries. - at your door: Larry in the wedding dress, wailing, tears flying."""
    n = frames_of("sh05")
    closeup()
    h = ep15.front_door()
    ep15.door_keys(h, [(1, 75)])
    larry, piv = ep15.larry_on_porch(n)
    hl = head(larry)
    cam = Cam(lens=40, loc=(hl.x + 0.05, hl.y + 1.05, hl.z + 0.02), target=(hl.x, hl.y, hl.z - 0.05))
    cam.key(1, loc=(hl.x + 0.05, hl.y + 1.05, hl.z + 0.02)); cam.key(n, loc=(hl.x + 0.04, hl.y + 0.85, hl.z + 0.02))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh06():
    """You feel bad. - you in the doorway, hand on your heart, guilty little face."""
    n = frames_of("sh06")
    closeup()
    h = ep15.front_door()
    ep15.door_keys(h, [(1, 75)])
    you = you_char((0.15, 4.25, 0), rot_z=0)
    idle(you, n)
    hd = head(you)
    scratch = empty("scratch_hand")                                          # guilty scratch of the back of the head
    for k, f in enumerate(range(1, frames_of("sh06") + 1, 5)):
        key_loc(scratch, f, hd + Vector((-0.11, 0.06 + (0.02 if k % 2 else 0.0), 0.05)))
    hand_ik(you, "Right", scratch)
    face(you, 1, SAD)
    hy = head(you)
    cam = Cam(lens=40, loc=(hy.x - 0.05, hy.y - 1.3, hy.z - 0.02), target=(hy.x, hy.y, hy.z - 0.12))
    cam.key(1, loc=(hy.x - 0.05, hy.y - 1.3, hy.z - 0.02)); cam.key(n, loc=(hy.x - 0.04, hy.y - 1.1, hy.z - 0.02))
    face_light(cam, energy=40, size=1.0)
    return n


@shot
def sh07():
    """You let Larry in. - Larry sobs his way in through your front door, suitcase in hand."""
    n = frames_of("sh07")
    closeup()
    h = ep15.front_door()
    ep15.door_keys(h, [(1, 75)])
    larry = larry_char((0.05, 1.9, 0), rot_z=180)
    larry.clip("07_01", **src(n, 60, speed=0.75, in_place=False))
    on_bone(larry, ep15.suitcase(), "RightHand", (0.0, 0.08, 0.0), rot=(0, 0, 0))
    sob(larry, 1, n); tears(larry, n)
    cam = Cam(lens=26, loc=(0.22, 5.62, 1.45), target=(0.0, 3.0, 1.1))
    cam.key(1, loc=(0.22, 5.62, 1.45)); cam.key(n, loc=(0.2, 5.6, 1.45))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh08():
    """And then they CUDDLE you. - foot of the bed: you wide awake, squeezed between Dale and Larry, both snuggling."""
    n = frames_of("sh08")
    closeup()
    bedroom()
    you, dale, larry = in_bed_trio(n)
    blink(you, [26])
    cam = Cam(lens=30, loc=(0.0, 0.25, 2.55), target=(0.0, 1.7, 0.72))       # high over the foot of the bed: three heads
    cam.key(1, loc=(0.0, 0.25, 2.55)); cam.key(n, loc=(0.0, 0.45, 2.45))
    face_light(cam, energy=40, size=1.4, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh09():
    """From both sides. All night. - straight down from the ceiling on the three of you; time crawls."""
    n = frames_of("sh09")
    closeup()
    bedroom()
    you, dale, larry = in_bed_trio(n)
    for f in range(12, n, 14):
        you.expr(f, {"eyeBlinkLeft": 0.0}); you.expr(f + 2, {"eyeSquintLeft": 0.8}); you.expr(f + 5, {"eyeSquintLeft": 0.0})
    cam = Cam(lens=26, loc=(0.0, 0.15, 2.1), target=(0.0, 1.75, 0.74))
    cam.key(1, loc=(0.0, 0.15, 2.1)); cam.key(n, loc=(0.0, 0.35, 2.0))
    face_light(cam, energy=35, size=1.6, color=(0.75, 0.82, 1.0), offset=(0.0, 0.0, 0.0))
    return n


@shot
def sh10():
    """So you're DONE. - close: you, standing in the dark, one eye twitching."""
    n = frames_of("sh10")
    closeup()
    bedroom()
    you = you_char((-1.2, -0.6, 0), rot_z=-20)
    idle(you, n)
    face(you, 1, STERN)
    for f in range(6, n, 5):
        you.expr(f, {"eyeSquintLeft": 0.9}); you.expr(f + 2, {"eyeSquintLeft": 0.2})
    hy = head(you)
    cam = Cam(lens=50, loc=(hy.x + 0.25, hy.y - 0.85, hy.z + 0.0), target=(hy.x, hy.y, hy.z - 0.03))
    cam.key(1, loc=(hy.x + 0.25, hy.y - 0.85, hy.z + 0.0)); cam.key(n, loc=(hy.x + 0.2, hy.y - 0.7, hy.z))
    face_light(cam, energy=35, size=0.8, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh11():
    """You grab an AK-47. - low angle: you with the rifle, one sharp pull on the bolt."""
    n = frames_of("sh11")
    closeup()
    bedroom()
    you = you_char((-0.4, -0.7, 0), rot_z=0)
    idle(you, n)
    piv = rocker(you, at="floor")
    rifle, tr, tl = hold_rifle(you, piv)
    tl.location = GRIP_L
    tl.keyframe_insert("location", frame=1); tl.keyframe_insert("location", frame=10)
    tl.location = Vector((0.06, -0.08, 0.1)); tl.keyframe_insert("location", frame=15)
    tl.location = Vector((0.06, -0.02, 0.1)); tl.keyframe_insert("location", frame=18)
    tl.location = GRIP_L; tl.keyframe_insert("location", frame=26)
    face(you, 1, STERN); face(you, 16, RAGE)
    hy = head(you)
    cam = Cam(lens=28, loc=(hy.x + 1.25, hy.y - 1.15, 1.2), target=(hy.x + 0.1, hy.y - 0.25, 1.22))
    cam.key(1, loc=(hy.x + 1.25, hy.y - 1.15, 1.2)); cam.key(n, loc=(hy.x + 1.1, hy.y - 1.0, 1.22))
    face_light(cam, energy=40, size=1.0, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh12():
    """You find Dale on your couch. - over your shoulder, rifle in the foreground: Dale on the couch, cereal."""
    n = frames_of("sh12")
    closeup()
    living_room_day()
    dale, bowl = dale_on_couch(n)
    you = you_char((0.3, -0.25, 0), rot_z=180)
    idle(you, n)
    piv = rocker(you, at="floor")
    hold_rifle(you, piv, yaw_body=180)
    face(dale, 1, SMILE)
    cam = Cam(lens=28, loc=(1.3, -1.05, 1.55), target=(0.0, 1.9, 0.95))
    cam.key(1, loc=(1.3, -1.05, 1.55)); cam.key(n, loc=(1.2, -0.85, 1.53))
    return n


@shot
def sh13():
    """Eating your cereal. - close on Dale, happily shovelling your cereal."""
    n = frames_of("sh13")
    closeup()
    living_room_day()
    dale, bowl = dale_on_couch(n)
    face(dale, 1, SMILE)
    hd = head(dale)
    cam = Cam(lens=40, loc=(hd.x + 0.15, hd.y - 1.25, hd.z - 0.12), target=(hd.x, hd.y, hd.z - 0.25))
    cam.key(1, loc=(hd.x + 0.15, hd.y - 1.25, hd.z - 0.12)); cam.key(n, loc=(hd.x + 0.12, hd.y - 1.05, hd.z - 0.12))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh14():
    """"Morning, honey!" - Dale looks up at you and waves the spoon, beaming."""
    n = frames_of("sh14")
    closeup()
    living_room_day()
    dale, bowl = dale_on_couch(n, wave_from=4)
    look_keys(dale, empty("lookyou14", (0.3, -0.6, 1.6)), [(1, 0.0), (5, 0.8)])
    face(dale, 1, SMILE); face(dale, 6, GRIN)
    talk(dale, 4, 14, every=3)
    hd = head(dale)
    cam = Cam(lens=40, loc=(hd.x + 0.1, hd.y - 1.2, hd.z + 0.05), target=(hd.x, hd.y, hd.z - 0.12))
    cam.key(1, loc=(hd.x + 0.1, hd.y - 1.2, hd.z + 0.05)); cam.key(n, loc=(hd.x + 0.08, hd.y - 1.0, hd.z + 0.05))
    face_light(cam, energy=30, size=1.0)
    return n


@shot
def sh15():
    """BANG! - outside: your house in the morning sun; a white flash in the window; the camera jolts."""
    n = frames_of("sh15")
    ep4.house_exterior(night=False, chimney=True)
    w = bpy.data.objects.get("win2.8")
    flash = point("flash", (2.8, 3.9, 1.6), energy=0, color=(1.0, 0.95, 0.8), radius=0.5)
    fm = mat_flat("winflash", (1, 1, 1), emit=(1.0, 0.95, 0.85), emit_strength=0.0)
    pane = box("flashpane", (1.38, 0.02, 1.28), (2.8, 3.43, 1.65), fm)
    b = fm.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    for f, e, s in ((1, 0, 0.0), (3, 0, 0.0), (4, 25000, 30.0), (6, 4000, 6.0), (9, 0, 0.0)):
        flash.data.energy = e; flash.data.keyframe_insert("energy", frame=f)
        b.default_value = s; b.keyframe_insert("default_value", frame=f)
    cam = Cam(lens=26, loc=(1.2, -9.5, 1.6), target=(0.8, 3.5, 1.9))
    for f, dx, dz in ((1, 0, 0), (4, 0, 0), (5, 0.08, -0.06), (6, -0.06, 0.05), (7, 0.04, -0.03), (9, 0, 0)):
        cam.key(f, loc=(1.2 + dx, -9.5, 1.6 + dz), interp="LINEAR")
    cam.key(n, loc=(1.2, -9.2, 1.6))
    return n


# ============================================================================ SHOTS: the garden
def digger(n, hole, yaw=0.0, x=0.0, y=-0.25, sd=True, period=22, lean=12.0):
    """You standing at the bottom of the hole (or on the grass when hole == 0), digging."""
    you = you_char((x, y, -hole), rot_z=yaw, sd=sd)
    idle(you, n)
    piv = rocker(you, at="floor")
    sp = shovel()
    R = Euler((0, 0, math.radians(yaw))).to_matrix()
    base = Vector((x, y, -hole)) + R @ Vector((0.0, -0.42, 0.0))
    dig(you, piv, sp, n, base, yaw=yaw, period=period, lean=lean)
    face(you, 1, STERN)
    return you, sp


@shot
def sh16():
    """Then you dig. - by torchlight: you, spade in hand, the first shovelfuls flying onto the pile."""
    n = frames_of("sh16")
    closeup()
    backyard(hole=0.3)
    you, sp = digger(n, 0.3)
    cam = Cam(lens=30, loc=(-1.6, -2.6, 1.3), target=(0.2, 0.0, 0.7))
    cam.key(1, loc=(-1.6, -2.6, 1.3)); cam.key(n, loc=(-1.45, -2.4, 1.28))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh17():
    """All night. In the garden. - wide: the moon, the back of the house, a tiny figure digging by torchlight."""
    n = frames_of("sh17")
    backyard(hole=0.45)
    you, sp = digger(n, 0.45, sd=False)
    cam = Cam(lens=24, loc=(-3.2, -7.5, 2.6), target=(0.0, 1.0, 1.2))
    cam.key(1, loc=(-3.2, -7.5, 2.6)); cam.key(n, loc=(-3.0, -7.0, 2.5))
    return n


@shot
def sh18():
    """Deep. - knee-deep in the hole, still digging."""
    n = frames_of("sh18")
    closeup()
    backyard(hole=0.6)
    you, sp = digger(n, 0.6, period=20)
    cam = Cam(lens=28, loc=(-1.3, -2.0, 0.75), target=(0.0, -0.1, 0.35))
    cam.key(1, loc=(-1.3, -2.0, 0.75)); cam.key(n, loc=(-1.2, -1.85, 0.72))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh19():
    """DEEPER. - waist-deep now."""
    n = frames_of("sh19")
    closeup()
    backyard(hole=1.05)
    you, sp = digger(n, 1.05, period=18)
    cam = Cam(lens=28, loc=(-1.2, -1.75, 0.55), target=(0.0, -0.15, 0.1))
    cam.key(1, loc=(-1.2, -1.75, 0.55)); cam.key(n, loc=(-1.12, -1.65, 0.53))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh20():
    """DEEPER. - from the lip of the grave, looking down: only your head and the spade still showing."""
    n = frames_of("sh20")
    closeup()
    backyard(hole=1.7)
    you, sp = digger(n, 1.7, period=16)
    cam = Cam(lens=24, loc=(-0.5, -1.45, 1.35), target=(0.0, -0.1, -0.6))
    cam.key(1, loc=(-0.5, -1.45, 1.35)); cam.key(n, loc=(-0.45, -1.4, 1.25))
    face_light(cam, energy=40, size=1.2, color=(0.75, 0.82, 1.0))
    return n


def dale_dead(drop=None, z_bottom=-1.7, sd=True):
    """Dale lying flat on his back (stiff), eyes shut, tongue out; drop=(f0, f1) drops him into the hole."""
    dale = dale_char(sd=sd)
    dale.hold("137_41", 2800)
    dale.rig.rotation_euler = (math.radians(-86), 0, 0)
    zb = z_bottom + 0.26
    if drop:
        f0, f1 = drop
        for f, z in ((1, 0.55), (f0, 0.55), (f1, zb), (f1 + 3, zb + 0.08), (f1 + 6, zb)):
            dale.rig.location = (0.0, -0.85, z); dale.rig.keyframe_insert("location", frame=f)
    else:
        dale.rig.location = (0.0, -0.85, zb)
    face(dale, 1, DEADFACE)
    return dale


@shot
def sh21():
    """You drop him in. - down into the grave: Dale drops in flat as a plank, eyes shut, tongue out."""
    n = frames_of("sh21")
    closeup()
    backyard(hole=1.7)
    dale = dale_dead(drop=(4, 12))
    cam = Cam(lens=24, loc=(0.35, -1.75, 1.75), target=(0.0, 0.0, -1.35))
    cam.key(1, loc=(0.35, -1.75, 1.75)); cam.key(n, loc=(0.32, -1.6, 1.65))
    face_light(cam, energy=40, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh22():
    """You fill the hole. - side on: you shovel dirt from the pile; the grave fills up over Dale."""
    n = frames_of("sh22")
    closeup()
    backyard(hole=1.7)
    dale = dale_dead()
    dm = dirt_mat()
    fill_root = empty("fill_root", (0, 0, -1.7))
    fb = box("fill", (2 * HX, 2 * HY, 1.0), (0, 0, 0.5), dm, uv_scale=0.6); fb.parent = fill_root
    key_scale(fill_root, 1, (1, 1, 0.02))
    key_scale(fill_root, n, (1, 1, 1.67))
    you, sp = digger(n, 0.0, yaw=-90, x=1.0, y=0.1, period=18, lean=10)
    cam = Cam(lens=26, loc=(-1.9, -2.6, 1.55), target=(0.4, 0.1, 0.25))
    cam.key(1, loc=(-1.9, -2.6, 1.55)); cam.key(n, loc=(-1.75, -2.45, 1.5))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh23():
    """You even put a little stone on top. - behind the grave: you lower the little headstone onto the mound."""
    n = frames_of("sh23")
    closeup()
    b = backyard(filled=True)
    st = gravestone(loc=(0, HY + 0.12, 0))
    you = you_char((0.0, HY + 0.85, 0), rot_z=0)
    idle(you, n)
    piv = rocker(you, at="floor")
    f0, f1 = 6, 30
    up = Vector((0, HY + 0.45, 0.78)); down = Vector((0, HY + 0.12, 0.0))
    key_loc(st, 1, up); key_loc(st, f0, up); key_loc(st, f1, down)
    rock(piv, [(1, 0.0), (f0, 0.0), (f1, 32.0), (f1 + 10, 32.0), (n, 4.0)])
    hands = []
    for side, dx in (("Left", 0.25), ("Right", -0.25)):                    # facing -Y: left is +X
        t = empty(f"stonehand_{side}")
        key_loc(t, 1, up + Vector((dx, 0.0, 0.25))); key_loc(t, f0, up + Vector((dx, 0.0, 0.25)))
        key_loc(t, f1, down + Vector((dx, 0.0, 0.25))); key_loc(t, f1 + 8, down + Vector((dx, 0.05, 0.3)))
        key_loc(t, n, you.world("Hips", frame=1) + Vector((dx * 0.85, 0.0, 0.0)))
        hand_ik(you, side, t)
        hands.append(t)
    face(you, 1, DETERMINED); face(you, f1 + 6, SMUG)
    cam = Cam(lens=28, loc=(0.9, -1.9, 1.25), target=(0.0, HY + 0.4, 0.5))
    cam.key(1, loc=(0.9, -1.9, 1.25)); cam.key(n, loc=(0.8, -1.7, 1.2))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh24():
    """"Here lies Dale. FINALLY." - close on the little stone in the moonlight."""
    n = frames_of("sh24")
    backyard(filled=True, stone=True)
    sp = shovel(); sp.location = (0.75, HY + 0.3, 0.0); sp.rotation_euler = (math.radians(-8), 0, math.radians(20))
    cam = Cam(lens=40, loc=(0.1, HY - 0.95, 0.45), target=(0.0, HY + 0.12, 0.32))
    cam.key(1, loc=(0.1, HY - 0.95, 0.45)); cam.key(n, loc=(0.08, HY - 0.7, 0.42))
    area("stonekey", (0.6, HY - 1.2, 1.2), (0, HY + 0.12, 0.3), energy=60, size=1.0, color=(0.75, 0.82, 1.0))
    return n


# ============================================================================ SHOTS: peace
@shot
def sh25():
    """And for the first time in months... you SLEEP. - alone in your bed, the biggest peaceful smile."""
    n = frames_of("sh25")
    closeup()
    bedroom()
    you = ep4.you_asleep()
    face(you, 1, PEACEFUL)
    cam = Cam(lens=34, loc=(-0.85, 1.05, 1.35), target=(0.0, 1.78, 0.74))
    cam.key(1, loc=(-0.85, 1.05, 1.35)); cam.key(n, loc=(-0.7, 1.2, 1.28))
    face_light(cam, energy=30, size=1.2, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh26():
    """No one in your window. - the bedroom window at night: just the moon."""
    n = frames_of("sh26")
    bedroom()
    cam = Cam(lens=30, loc=(0.6, 0.0, 1.55), target=(2.6, 0.62, 1.6))
    cam.key(1, loc=(0.6, 0.0, 1.55)); cam.key(n, loc=(0.9, 0.15, 1.55))
    return n


@shot
def sh27():
    """No one in your shower. - curtain open: empty."""
    n = frames_of("sh27")
    ep15.bathroom(curtain_keys=[(1, 1.0)])
    cam = Cam(lens=30, loc=(-1.0, -1.2, 1.55), target=(-1.08, 1.2, 1.3))
    cam.key(1, loc=(-1.0, -1.2, 1.55)); cam.key(n, loc=(-1.0, -0.95, 1.53))
    return n


@shot
def sh28():
    """No one in your bed. PEACE. - you asleep, the other side of the bed empty; the camera drifts back."""
    n = frames_of("sh28")
    closeup()
    bedroom()
    you = ep4.you_asleep()
    face(you, 1, PEACEFUL)
    cam = Cam(lens=30, loc=(1.05, 0.45, 1.85), target=(0.2, 1.62, 0.72))       # your face and the empty half
    cam.key(1, loc=(1.05, 0.45, 1.85)); cam.key(n, loc=(1.35, 0.05, 2.05))
    face_light(cam, energy=30, size=1.4, color=(0.75, 0.82, 1.0))
    return n


# ============================================================================ SHOTS: three days later
def churn(mound, stone, f0, n, amp=1.0):
    """The dirt starts to move: the mound's lumps crawl (displace texture driven by a moving empty), it heaves, the
    stone wobbles, pebbles hop."""
    drv = empty("churn", (0, 0, 0))
    md = mound.modifiers.get("lumps")
    md.texture_coords = "OBJECT"; md.texture_coords_object = drv
    md.strength = 0.05
    md.keyframe_insert("strength", frame=1); md.keyframe_insert("strength", frame=f0)
    md.strength = 0.05 + 0.1 * amp; md.keyframe_insert("strength", frame=n)
    r = random.Random(7)
    for f in range(1, n + 1, 2):
        u = max(0.0, (f - f0) / max(1, n - f0))
        key_loc(drv, f, (0.0, 0.0, 0.0) if f < f0 else (0.06 * math.sin(f * 0.7) * amp, 0.05 * math.cos(f * 0.9) * amp, 0.02 * f * u * amp))
        if f >= f0:
            s = 1.0 + 0.06 * amp * u * (0.5 + 0.5 * math.sin(f * 1.3))
            key_scale(mound, f, (1.0, 1.0, s))
            if stone is not None:
                key_rot(stone, f, (2.5 * amp * u * math.sin(f * 1.7), 2.0 * amp * u * math.sin(f * 1.1 + 1), 0))
    key_scale(mound, 1, (1, 1, 1)); key_scale(mound, max(1, f0 - 1), (1, 1, 1))
    if stone is not None:
        key_rot(stone, 1, (0, 0, 0)); key_rot(stone, max(1, f0 - 1), (0, 0, 0))
    m = mat_flat("pebble", (0.35, 0.33, 0.3), rough=0.8)
    for k in range(10):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r.uniform(0.02, 0.035),
                                              location=(r.uniform(-0.35, 0.35), r.uniform(-0.8, 0.8), 0.2))
        p = bpy.context.object; p.data.materials.append(m)
        base = p.location.copy()
        for f in range(1, n + 1, 3):
            hop = 0.0 if f < f0 else abs(math.sin(f * 0.8 + k)) * 0.05 * amp * (f - f0) / max(1, n - f0)
            key_loc(p, f, base + Vector((0, 0, hop)))


@shot
def sh29():
    """Until 3 DAYS LATER... - the grave at night, still and quiet."""
    n = frames_of("sh29")
    backyard(filled=True, stone=True, torch=False)
    cam = Cam(lens=26, loc=(-1.6, -3.4, 1.6), target=(0.0, 0.3, 0.3))
    cam.key(1, loc=(-1.6, -3.4, 1.6)); cam.key(n, loc=(-1.4, -3.0, 1.5))
    return n


@shot
def sh30():
    """when the dirt starts to MOVE. - low and close: the mound heaves and crawls, pebbles hop, the stone shudders."""
    n = frames_of("sh30")
    b = backyard(filled=True, stone=True, torch=False)
    churn(b["mound"], b["stone"], at("sh30", 49.0), n, amp=1.0)
    area("moundkey", (-0.9, -1.6, 1.3), (0, 0, 0.1), energy=120, size=1.2, color=(0.75, 0.82, 1.0))
    cam = Cam(lens=30, loc=(-0.6, -1.85, 0.42), target=(0.0, 0.2, 0.12))
    cam.key(1, loc=(-0.6, -1.85, 0.42)); cam.key(n, loc=(-0.5, -1.6, 0.4))
    return n


@shot
def sh31():
    """Is Dale really DEAD? - from outside the bedroom window: you, staring out into the garden, terrified."""
    n = frames_of("sh31")
    closeup()
    bedroom()
    you = you_char((2.05, 0.6, 0), rot_z=90)
    idle(you, n)
    face(you, 1, WIDE); blink(you, [30])
    hy = head(you)
    cam = Cam(lens=30, loc=(2.45, -0.3, hy.z + 0.02), target=(hy.x, hy.y + 0.05, hy.z - 0.06))   # by the window, on your face
    cam.key(1, loc=(2.45, -0.3, hy.z + 0.02)); cam.key(n, loc=(2.45, -0.2, hy.z + 0.02))
    face_light(cam, energy=50, size=1.0, color=(0.75, 0.82, 1.0))
    return n


@shot
def sh32():
    """Comment YES or NO. - you hold up the two cards to the camera."""
    n = frames_of("sh32")
    closeup()
    bedroom()
    you = you_char((0.0, -0.6, 0), rot_z=0)
    idle(you, n)
    hy = head(you)
    cw = 0.29
    ch_ = cw * 560 / 800
    for k, (img, dx, side) in enumerate(((f"{D15}/card_yes.png", -0.25, "Right"), (f"{D15}/card_no.png", 0.25, "Left"))):
        c = decal(f"card{k}", img, cw, (0, 0, 0), rot=(90, 0, 0), emit=0.4)
        base = hy + Vector((dx, -0.4, -0.3))
        for j, f in enumerate(range(1, n + 1, 10)):
            key_loc(c, f, base + Vector((0, 0, 0.04 if (j + k) % 2 else 0.0)))
        t = empty(f"cardhand{k}", base + Vector((0, 0.03, -ch_ / 2 + 0.02)))
        glue(t, c)
        hand_ik(you, side, t)
    face(you, 1, UNEASY)
    look_keys(you, empty("lookcam32", (0.0, -2.0, 1.5)), [(1, 0.7)])
    cam = Cam(lens=30, loc=(0.0, -2.35, 1.5), target=(0.0, -0.6, 1.35))
    cam.key(1, loc=(0.0, -2.35, 1.5)); cam.key(n, loc=(0.0, -2.2, 1.5))
    face_light(cam, energy=50, size=1.2)
    return n


@shot
def sh33():
    """PART 2 reveals. - slow push in on the little stone... the dirt heaves once more, the stone tips."""
    n = frames_of("sh33")
    b = backyard(filled=True, stone=True, torch=False)
    churn(b["mound"], b["stone"], n - 14, n, amp=1.3)
    area("stonekey33", (0.6, HY - 1.2, 1.2), (0, HY + 0.12, 0.3), energy=60, size=1.0, color=(0.75, 0.82, 1.0))
    cam = Cam(lens=34, loc=(0.15, HY - 2.0, 0.65), target=(0.0, HY + 0.1, 0.3))
    cam.key(1, loc=(0.15, HY - 2.0, 0.65)); cam.key(n, loc=(0.1, HY - 1.1, 0.48))
    return n
