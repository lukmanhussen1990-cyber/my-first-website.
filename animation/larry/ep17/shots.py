"""Shot definitions for Episode 17 "Here Lies Dale" (part 2): you killed Dale and buried him. That night: a big family
dinner, everyone's there, your crush sits right next to you... and Dale is sitting at the table, eating your food. Nobody
else can see him. He throws your crush out of the window; Larry rolls up in a tank and blows up the whole house; in
the smoke Larry and Dale grab you, kidnap you and lock you in their basement - and cuddle you from both sides, all night.
Same pipeline as episodes 1-16 (imports the newest episode, 16 -> 15 -> ...). Cast from the existing character files
only: the crush is the "wife" model, the family is the HR lady, the old man and the two kids. Props and sets are scene
objects; character files untouched. Smoothness rules from episodes 12-16: no finger close-ups, forward-facing idle range,
seated heads levelled, whole-body motion through pivots, hand targets world-fixed or riding the moving thing."""
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


ep16 = _load("ep16shots", "ep16")         # newest episode (its chain: 15, 14, 13, ... 1)
ep15, ep14, ep13, ep12, ep11, ep9 = ep16.ep15, ep16.ep14, ep16.ep13, ep16.ep12, ep16.ep11, ep16.ep9
ep7, ep6, ep4, ep3, ep2, ep1 = ep16.ep7, ep16.ep6, ep16.ep4, ep16.ep3, ep16.ep2, ep16.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, SERENE, TADA, face,
                      blink, look_at, hand_ik, src, pose, settle, on_bone)  # noqa: E402
STERN, RAGE = ep1.STERN, ep1.RAGE
GRIN, SAD, SCREAM = ep6.GRIN, ep7.SAD, ep9.SCREAM
load_char, closeup, face_light = ep9.load_char, ep9.closeup, ep9.face_light
look_keys, sit_level = ep12.look_keys, ep12.sit_level
rocker, glue, rock, talk, hold, head = ep13.rocker, ep13.glue, ep13.rock, ep13.talk, ep13.hold, ep13.head
vis, shards = ep14.vis, ep14.shards
you_char, larry_char, dale_char, idle = ep15.you_char, ep15.larry_char, ep15.dale_char, ep15.idle

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


LOVE = {"mouthSmileLeft": 0.7, "mouthSmileRight": 0.7, "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
        "browInnerUp": 0.9, "cheekSquintLeft": 0.45, "cheekSquintRight": 0.45}
BEAM = dict(SMILE, mouthSmileLeft=1.0, mouthSmileRight=1.0, cheekSquintLeft=0.6, cheekSquintRight=0.6)
DAZED = {"eyeBlinkLeft": 0.45, "eyeBlinkRight": 0.7, "jawOpen": 0.15, "browInnerUp": 0.5, "mouthFrownLeft": 0.3}
WIDE = dict(SHOCK, jawOpen=0.0, mouthPressLeft=0.6, mouthPressRight=0.6)
SNUG = dict(CREEPY_ENJOY, eyeBlinkLeft=0.7, eyeBlinkRight=0.7)
WINK = {"eyeBlinkLeft": 1.0, "cheekSquintLeft": 0.6, "mouthSmileLeft": 1.0, "mouthSmileRight": 0.75}
NIGHT = (0.75, 0.82, 1.0)
WARM = (1.0, 0.82, 0.6)


# ============================================================================ the dining room
TABLE = Vector((0.0, 0.95, 0.0))      # table centre (top at 0.76); long axis X
TOP_Z = 0.76
# seats: (name, chair x, chair y, facing degrees: 0 = facing -Y (the camera side), 180 = facing +Y, 90 = facing +X ...)
SEATS = {"you": (-0.38, 1.62, 0.0), "crush": (0.38, 1.62, 0.0), "grandpa": (-1.4, 0.95, 90.0),
         "dale": (1.4, 0.95, -90.0), "mom": (-0.42, 0.28, 180.0), "boy": (0.42, 0.28, 180.0)}


def dining_room(window_burst=None):
    """Your living room by night turned dining room: episode 1's room without the bed, a long table laid for dinner
    (plates, a roast, mashed potatoes, candles), warm light; the window on the right wall (x 2.6) can burst at frame
    window_burst (glass hidden, shards out)."""
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
    lg = bpy.data.objects.get("lampglow")
    if lg:
        lg.data.energy = 0.0
    for nm, en in (("fill", 90), ("bedkey", 40)):
        o = bpy.data.objects.get(nm)
        if o:
            o.data.energy = en
    world_color((0.12, 0.1, 0.09), 0.4)
    area("dinner_top", (0.0, 0.95, 2.8), (0.0, 0.95, 0.0), energy=200, size=1.6, color=WARM, shadow=True)
    area("dinner_fill", (0.0, -2.2, 2.0), (0.0, 1.0, 1.0), energy=80, size=3.0, color=WARM)
    plane("rug17", (3.4, 2.4), (0.0, 0.95, 0.006), mat_flat("rug17m", (0.42, 0.12, 0.1), rough=1.0))
    wood = mat_flat("dtable", (0.3, 0.17, 0.08), rough=0.35)
    box("dt_top", (2.3, 1.05, 0.05), (TABLE.x, TABLE.y, TOP_Z - 0.025), wood, bevel=0.01)
    for dx in (-1.05, 1.05):
        for dy in (-0.42, 0.42):
            box(f"dt_leg{dx}{dy}", (0.06, 0.06, TOP_Z - 0.05), (TABLE.x + dx, TABLE.y + dy, (TOP_Z - 0.05) / 2), wood)
    cloth = mat_flat("tablecloth", (0.95, 0.94, 0.9), rough=0.7)
    box("dt_cloth", (1.9, 0.75, 0.006), (TABLE.x, TABLE.y, TOP_Z + 0.003), cloth)
    plate = mat_flat("plate17", (0.97, 0.97, 0.98), rough=0.2)
    food = mat_flat("peas", (0.35, 0.6, 0.15), rough=0.6)
    for nm, (x, y, f) in SEATS.items():
        d = Vector((math.sin(math.radians(f)), -math.cos(math.radians(f)), 0))       # facing direction
        p = Vector((x, y, 0)) + d * 0.42
        p = Vector((max(-0.95, min(0.95, p.x)), max(TABLE.y - 0.38, min(TABLE.y + 0.38, p.y)), TOP_Z + 0.008))
        cylinder(f"plate_{nm}", 0.11, 0.012, p, plate, verts=28)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.035, location=p + Vector((0.02, 0, 0.02)))
        o = bpy.context.object; o.scale = (1.3, 1.0, 0.5); o.data.materials.append(food)
        cylinder(f"glass_{nm}", 0.028, 0.12, p + Vector((0.14, 0.0, 0.06)), mat_flat("glass17", (0.8, 0.85, 0.9), rough=0.05, alpha=0.35), verts=16)
    # the roast and the mashed potatoes
    brown = mat_flat("roast", (0.45, 0.22, 0.08), rough=0.4)
    cylinder("platter", 0.2, 0.015, (TABLE.x - 0.3, TABLE.y, TOP_Z + 0.01), plate, verts=32)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.13, location=(TABLE.x - 0.3, TABLE.y, TOP_Z + 0.09))
    r = bpy.context.object; r.scale = (1.3, 0.9, 0.7); r.data.materials.append(brown); bpy.ops.object.shade_smooth()
    cylinder("mash_bowl", 0.11, 0.07, (TABLE.x + 0.3, TABLE.y, TOP_Z + 0.035), plate, verts=28)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.1, location=(TABLE.x + 0.3, TABLE.y, TOP_Z + 0.07))
    m = bpy.context.object; m.scale = (1.0, 1.0, 0.55); m.data.materials.append(mat_flat("mash", (0.96, 0.9, 0.7), rough=0.6))
    flame = mat_flat("flame17", (1.0, 0.7, 0.3), emit=(1.0, 0.6, 0.2), emit_strength=6)
    for k, x in enumerate((-0.05, 0.05)):
        cylinder(f"candle17_{k}", 0.018, 0.24, (TABLE.x + x, TABLE.y, TOP_Z + 0.12), mat_flat("wax", (0.96, 0.95, 0.9)), verts=12)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.014, location=(TABLE.x + x, TABLE.y, TOP_Z + 0.26))
        fl = bpy.context.object; fl.scale = (1, 1, 1.8); fl.data.materials.append(flame); fl.visible_shadow = False
    point("candlelight", (TABLE.x, TABLE.y, TOP_Z + 0.4), energy=30, color=(1.0, 0.7, 0.4), radius=0.1)
    if window_burst:
        for o in bpy.data.objects:
            if o.name.startswith("pane_"):
                vis(o, f_off=window_burst)
        shards((2.62, 0.6, 1.55), (1, 0, 0.25), window_burst, 400, count=34, seed=3,
               colors=[(0.75, 0.85, 0.95), (0.6, 0.7, 0.85)], size=0.1, speed=0.12, name="winshard")


def chair_for(nm):
    x, y, f = SEATS[nm]
    piv, sz = ep14.wooden_chair((x, y, 0.0), facing=f, name=f"chair_{nm}")
    for c in piv.children:
        for m in c.data.materials:
            pass
    return piv, sz


def seat(ch, nm, hands_on_table=True):
    """Sit a character at its place (level head), hands resting by its plate."""
    x, y, f = SEATS[nm]
    piv, sz = chair_for(nm)
    back = Vector((0, 0.02, 0)); back.rotate(Euler((0, 0, math.radians(f))))
    ch.rig.location = (x + back.x, y + back.y, 0); ch.rig.rotation_euler = (0, 0, math.radians(f))
    sit_level(ch, sz)
    if hands_on_table:
        d = Vector((math.sin(math.radians(f)), -math.cos(math.radians(f)), 0))
        s = Vector((-d.y, d.x, 0))                                  # the character's left
        base = Vector((x, y, 0)) + d * 0.33
        for side, k in (("Left", 1), ("Right", -1)):
            p = base + s * (0.17 * k)
            hold(ch, side, (p.x, p.y, TOP_Z + 0.03), name=f"tbl_{ch.name}_{side}")
    return piv


def family(n, who=("grandpa", "mom", "boy"), sd=False):
    """The rest of the family at the table (no subdivision: background)."""
    out = {}
    cast = {"grandpa": "you_old", "mom": "hr", "boy": "kid_boy"}
    for nm in who:
        ch = load_char(cast[nm], (0, 0, 0), subdiv=sd, tag=nm)
        seat(ch, nm)
        face(ch, 1, SMILE)
        blink(ch, [8 + 7 * len(out), 40 + 5 * len(out)])
        out[nm] = ch
    return out


def you_and_crush(n, sd=True):
    you = you_char(sd=sd)
    seat(you, "you")
    crush = load_char("wife", (0, 0, 0), subdiv=sd, tag="crush")
    seat(crush, "crush")
    return you, crush


def table_scene(n, dale=False, sd=True, fam_on=True):
    """fam_on=False for close-ups: the family is off-screen (and it renders ~2x faster)."""
    dining_room()
    you, crush = you_and_crush(n, sd=sd)
    fam = family(n) if fam_on else {}
    d = None
    if dale:
        d = dale_char(sd=sd)
        seat(d, "dale")
        face(d, 1, GRIN)
    return you, crush, fam, d


def eating(ch, nm, n, f0=1, every=9):
    """A fork going plate -> mouth on the right hand (IK), jaw chewing."""
    x, y, f = SEATS[nm]
    d = Vector((math.sin(math.radians(f)), -math.cos(math.radians(f)), 0))
    plate = Vector((x, y, 0)) + d * 0.42
    plate.z = TOP_Z + 0.05
    hd = head(ch)
    mouth = hd + d * 0.16 + Vector((0, 0, -0.12))
    tr = empty(f"fork_{ch.name}")
    fk = box(f"fork_{ch.name}_m", (0.012, 0.16, 0.006), (0, 0, 0), mat_flat("fork", (0.85, 0.86, 0.88), metal=1.0, rough=0.2))
    fk.parent = tr; fk.location = (0, -0.06, 0)
    for c in ch.rig.pose.bones["RightForeArm"].constraints:
        if c.type == "IK":
            ch.rig.pose.bones["RightForeArm"].constraints.remove(c)
    hand_ik(ch, "Right", tr)
    k = 0
    for fr in range(1, n + 1, every):
        key_loc(tr, fr, plate if (k % 2 == 0 or fr < f0) else mouth)
        k += 1
    for kk in range(0, n, 5):
        ch.expr(1 + kk, {"jawOpen": 0.25 if (kk // 5) % 2 else 0.05})
    return tr


# ============================================================================ outside
def house_night():
    ep4.house_exterior(night=True, chimney=True)


def house_parts():
    names = ["house", "roof", "door", "chimney", "chimney_hole", "win-2.8", "win2.8", "wintrim-2.8", "wintrim2.8", "porch"]
    return [bpy.data.objects[n] for n in names if n in bpy.data.objects]


def rubble(y=6.5, smoke=True, fires=True):
    """The pile that used to be your house: dark lumpy mounds, broken wall stubs, beams, small fires, smoke."""
    for o in house_parts():
        o.hide_render = True; o.hide_viewport = True
    r = random.Random(4)
    wall = mat_tex("rubwall", "painted_plaster_wall", scale=1.0, tint=(0.5, 0.48, 0.45))
    dark = mat_flat("charred", (0.07, 0.06, 0.05), rough=0.9)
    for k in range(9):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0,
                                             location=(r.uniform(-3.8, 3.8), y + r.uniform(-2.2, 2.2), 0.0))
        o = bpy.context.object; o.scale = (r.uniform(0.8, 1.6), r.uniform(0.7, 1.3), r.uniform(0.25, 0.6))
        tx = bpy.data.textures.get("rub17") or bpy.data.textures.new("rub17", "CLOUDS"); tx.noise_scale = 0.25
        md = o.modifiers.new("lumps", "DISPLACE"); md.texture = tx; md.strength = 0.3
        o.data.materials.append(dark if k % 3 == 0 else wall); bpy.ops.object.shade_smooth()
    for k, (x, h) in enumerate(((-4.4, 1.6), (-1.2, 0.9), (2.6, 1.3), (4.4, 2.0))):
        box(f"stub{k}", (0.9, 0.2, h), (x, 3.55, h / 2), wall, rot=(0, r.uniform(-8, 8), 0), uv_scale=0.4)
    beam = mat_flat("beam17", (0.25, 0.15, 0.08), rough=0.7)
    for k in range(6):
        box(f"beam{k}", (2.4, 0.14, 0.14), (r.uniform(-3, 3), y + r.uniform(-2, 2), 0.5),
            beam, rot=(r.uniform(-25, 25), r.uniform(-20, 20), r.uniform(0, 180)))
    if fires:
        fire = mat_flat("fire17", (1.0, 0.45, 0.05), emit=(1.0, 0.4, 0.05), emit_strength=4.0)
        for k, (x, yy) in enumerate(((-2.6, 5.6), (1.8, 6.0), (3.6, 7.4), (-0.6, 7.6))):
            bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.25, depth=0.7, location=(x, yy, 0.55))
            f = bpy.context.object; f.data.materials.append(fire); f.visible_shadow = False
            lt = point(f"fire{k}", (x, yy, 1.0), energy=260, color=(1.0, 0.5, 0.15), radius=0.4)
            for fr in range(1, 200, 3):
                lt.data.energy = 200 + 120 * r.random(); lt.data.keyframe_insert("energy", frame=fr)
    if smoke:
        puffs(Vector((0, y - 1.0, 0.6)), 14, spread=(4.5, 2.5), seed=6)


def puffs(center, count, spread=(2.0, 2.0), seed=5, rise=0.012, n=200, scale=1.0):
    """Drifting grey smoke puffs (displaced spheres rising slowly)."""
    m = mat_flat("smoke17", (0.1, 0.1, 0.11), rough=1.0, alpha=0.85)
    r = random.Random(seed)
    tx = bpy.data.textures.get("puff17") or bpy.data.textures.new("puff17", "CLOUDS"); tx.noise_scale = 0.4
    for k in range(count):
        p0 = center + Vector((r.uniform(-spread[0], spread[0]), r.uniform(-spread[1], spread[1]), r.uniform(0, 1.5)))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r.uniform(0.5, 1.0) * scale, location=p0)
        o = bpy.context.object; o.name = f"puff{k}"
        md = o.modifiers.new("d", "DISPLACE"); md.texture = tx; md.strength = 0.35 * scale
        o.data.materials.append(m); bpy.ops.object.shade_smooth(); o.visible_shadow = False
        for f in range(1, n + 1, 10):
            key_loc(o, f, p0 + Vector((0.004 * f, 0, rise * f)))


def explosion(center, f0, n, size=4.0):
    """Fireball (expanding, fading emissive spheres), a white flash, flying debris, then smoke."""
    hot = mat_flat("fireball", (1.0, 0.25, 0.02), emit=(1.0, 0.22, 0.01), emit_strength=4.0)
    core = mat_flat("fireball_core", (1.0, 0.55, 0.08), emit=(1.0, 0.5, 0.05), emit_strength=6.0)
    r = random.Random(9)
    for k in range(7):
        off = Vector((r.uniform(-1.2, 1.2), r.uniform(-0.8, 0.8), r.uniform(0.0, 1.4))) * (size / 4.0)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=Vector(center) + off)
        b = bpy.context.object; b.name = f"fireball{k}"
        b.data.materials.append(core if k < 2 else hot); b.visible_shadow = False
        s1 = r.uniform(0.6, 1.0) * size * 0.55
        key_scale(b, 1, 0.0, interp="CONSTANT"); key_scale(b, f0 - 1, 0.0, interp="CONSTANT")
        key_scale(b, f0 + 1, s1 * 0.4); key_scale(b, f0 + 6, s1); key_scale(b, f0 + 16, s1 * 1.1); key_scale(b, f0 + 22, 0.0)
        key_loc(b, f0, Vector(center) + off); key_loc(b, f0 + 22, Vector(center) + off + Vector((0, 0, 1.5)))
    lt = point("boomlight", Vector(center) + Vector((0, -3.0, 2.0)), energy=0, color=(1.0, 0.65, 0.3), radius=1.0)
    for f, e in ((1, 0), (f0 - 1, 0), (f0, 30000), (f0 + 6, 15000), (f0 + 20, 2000), (n, 600)):
        lt.data.energy = e; lt.data.keyframe_insert("energy", frame=max(1, f))
    shards(Vector(center) + Vector((0, 0, 1.2)), (0, -1, 0.9), f0, n, count=40, seed=12,
           colors=[(0.85, 0.8, 0.72), (0.25, 0.22, 0.22), (0.45, 0.12, 0.1), (0.3, 0.18, 0.1)], size=0.45, speed=0.35,
           name="debris")
    puffs(Vector(center), 12, spread=(size * 0.6, size * 0.4), seed=8, rise=0.02, n=n, scale=1.4)


def tank_with_larry(loc=(0, 0, 0), yaw=0.0, sd=True, larry_yaw=-90.0):
    """Episode 11's tank; Larry (still in his wedding-dress top, veil and tiara) standing in the hatch."""
    tk, piv, mz = ep11.tank_prop()
    tk.location = loc; tk.rotation_euler = (0, 0, math.radians(yaw))
    larry = larry_char(sd=sd)
    for nm in ("skirt", "skirt_band"):
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    ep15.hide_bouquet()
    larry.hold("137_28", 3700)
    larry.rig.parent = piv
    larry.rig.location = (-0.5, 0.35, -0.02)                                # shorter than you: raised to stand half out
    larry.rig.rotation_euler = (0, 0, math.radians(larry_yaw))
    bpy.context.view_layer.update()
    return tk, piv, mz, larry


# ============================================================================ the basement
def basement(bulb=True):
    """Larry and Dale's basement: episode 1's bed in a bare concrete cellar, one bare bulb swinging on its cord,
    a steel door with a padlock. Returns the door hinge."""
    ep4.bedroom_night(window_open=False, with_dresser=False, clock=False)
    hide = ["w_back", "w_left", "wr_a", "wr_b", "wr_c", "wr_d", "wr_fill", "ceil", "floor", "win_sky", "moon",
            "lampglow", "fill", "bedkey"]
    for nm in hide:
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    for o in list(bpy.data.objects):
        if o.name.startswith(("pane_", "winhinge")):
            o.hide_render = True; o.hide_viewport = True
    for nm in ("painted_wooden_nightstand", "desk_lamp_arm_01"):
        o = bpy.data.objects.get(nm)
        if o:
            for c in [o] + list(o.children_recursive):
                c.hide_render = True; c.hide_viewport = True
    world_color((0.03, 0.035, 0.04), 0.3)
    conc = mat_tex("bwall17", "concrete_block_wall", scale=1.0, tint=(0.7, 0.7, 0.72))
    floor = mat_tex("bfloor17", "concrete_floor_02", scale=1.0, tint=(0.6, 0.6, 0.62))
    plane("bfloor", (8, 8), (0, 0.5, 0.0), floor, uv_scale=0.5)
    box("bw_back", (8, 0.2, 2.6), (0, 2.75, 1.3), conc, uv_scale=0.6)
    box("bw_left", (0.2, 8, 2.6), (-2.6, 0.5, 1.3), conc, uv_scale=0.6)
    box("bw_right", (0.2, 8, 2.6), (2.6, 0.5, 1.3), conc, uv_scale=0.6)
    plane("bceil", (8, 8), (0, 0.5, 2.6), mat_flat("bceilm", (0.2, 0.2, 0.21), rough=0.9), rot=(180, 0, 0))
    pipe = mat_flat("pipe17", (0.35, 0.3, 0.25), metal=0.6, rough=0.5)
    for k, y in enumerate((-0.5, 1.8)):
        cylinder(f"pipe{k}", 0.05, 8, (0, y, 2.45), pipe, rot=(0, 90, 0), verts=12)
    steel = mat_flat("steeldoor", (0.3, 0.32, 0.34), metal=0.7, rough=0.45)
    h = empty("bdoor_hinge", (-2.48, -0.9, 0))
    box("bdoor", (0.08, 1.0, 2.05), (0.0, 0.5, 1.025), steel, bevel=0.01).parent = h
    for z in (0.5, 1.5):
        box(f"bdoor_band{z}", (0.1, 1.02, 0.08), (0.0, 0.5, z), mat_flat("doorband17", (0.15, 0.15, 0.16), metal=0.8)).parent = h
    lock = empty("padlock", (0.07, 0.9, 1.0)); lock.parent = h
    box("lock_body", (0.03, 0.08, 0.09), (0, 0, 0), mat_flat("lockm", (0.8, 0.65, 0.2), metal=1.0, rough=0.3)).parent = lock
    bpy.ops.mesh.primitive_torus_add(major_radius=0.03, minor_radius=0.007, location=(0, 0, 0.06), rotation=(0, math.radians(90), 0))
    sh = bpy.context.object; sh.data.materials.append(mat_flat("shackle", (0.8, 0.8, 0.82), metal=1.0, rough=0.2)); sh.parent = lock
    if bulb:
        sw = empty("bulb_swing", (1.05, 0.1, 2.6))
        cylinder("cord", 0.006, 0.7, (0, 0, -0.35), mat_flat("cord", (0.05, 0.05, 0.05)), verts=8).parent = sw
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.05, location=(0, 0, -0.74))
        b = bpy.context.object; b.data.materials.append(mat_flat("bulb", (1, 1, 0.9), emit=(1.0, 0.85, 0.6), emit_strength=12)); b.parent = sw
        b.visible_shadow = False
        lt = point("bulblight", (0, 0, -0.8), energy=170, color=(1.0, 0.8, 0.55), radius=0.05, shadow=True); lt.parent = sw
        for f in range(1, 260, 4):
            sw.rotation_euler = (math.radians(9 * math.sin(f * 0.09)), math.radians(4 * math.sin(f * 0.07)), 0)
            sw.keyframe_insert("rotation_euler", frame=f)
    area("bfill", (0, -2.0, 2.2), (0, 1.0, 0.8), energy=60, size=3.0, color=(0.55, 0.62, 0.8))
    return h


# ============================================================================ SHOTS: the dinner
@shot
def sh01():
    """You killed DALE. - the little headstone in the moonlit garden: HERE LIES DALE. FINALLY."""
    n = frames_of("sh01")
    ep16.backyard(filled=True, stone=True, torch=False)
    area("stonekey17", (0.6, ep16.HY - 1.2, 1.2), (0, ep16.HY + 0.12, 0.3), energy=60, size=1.0, color=NIGHT)
    cam = Cam(lens=40, loc=(0.1, ep16.HY - 1.05, 0.48), target=(0.0, ep16.HY + 0.12, 0.32))
    cam.key(1, loc=(0.1, ep16.HY - 1.05, 0.48)); cam.key(n, loc=(0.08, ep16.HY - 0.8, 0.44))
    return n


@shot
def sh02():
    """He's DEAD. Buried. GONE. - you beside the grave, shovel over your shoulder, smug; you dust off your hands."""
    n = frames_of("sh02")
    closeup()
    ep16.backyard(filled=True, stone=True, torch=False)
    you = you_char((0.95, -0.45, 0), rot_z=20)
    idle(you, n)
    hd = head(you)
    for side, dx in (("Left", 0.05), ("Right", -0.05)):
        t = empty(f"dust_{side}")
        for k, f in enumerate(range(1, n + 1, 5)):
            key_loc(t, f, hd + Vector((dx + (0.06 if (k + (side == "Left")) % 2 else -0.06), -0.33, -0.62)))
        hand_ik(you, side, t)
    face(you, 1, SMUG)
    cam = Cam(lens=32, loc=(0.2, -2.6, 1.35), target=(0.6, 0.0, 0.95))
    cam.key(1, loc=(0.2, -2.6, 1.35)); cam.key(n, loc=(0.25, -2.3, 1.32))
    face_light(cam, energy=35, size=1.2, color=NIGHT)
    return n


@shot
def sh03():
    """So that night, there's a big family dinner. - your house at night, every window glowing warm."""
    n = frames_of("sh03")
    house_night()
    cam = Cam(lens=28, loc=(-1.8, -9.5, 1.5), target=(0.0, 3.5, 1.8))
    cam.key(1, loc=(-1.8, -9.5, 1.5)); cam.key(n, loc=(-1.4, -8.4, 1.55))
    return n


@shot
def sh04():
    """Everyone's here. The whole family. - wide over the table: grandpa, mom, the kid, you and your crush."""
    n = frames_of("sh04")
    you, crush, fam, _ = table_scene(n, sd=False)
    face(you, 1, BEAM); face(crush, 1, SMILE)
    eating(fam["grandpa"], "grandpa", n)
    talk(fam["mom"], 6, 40, every=4)
    cam = Cam(lens=24, loc=(0.0, -1.55, 1.75), target=(0.0, 1.05, 0.95))
    cam.key(1, loc=(0.0, -1.55, 1.75)); cam.key(n, loc=(0.0, -1.25, 1.7))
    return n


@shot
def sh05():
    """And your CRUSH. - close on her: she smiles at you."""
    n = frames_of("sh05")
    closeup()
    you, crush, fam, _ = table_scene(n, fam_on=False)
    for o in you.meshes:                                    # the camera is your eyes
        o.hide_render = True; o.hide_viewport = True
    look_keys(crush, you, [(1, 0.0), (6, 0.7)])
    face(crush, 1, SMILE); face(crush, 10, LOVE)
    hc, hy = head(crush), head(you)
    eye = hy + Vector((0.06, -0.1, 0.08))                                   # your point of view: she smiles at the lens
    cam = Cam(lens=40, loc=eye, target=(hc.x, hc.y, hc.z + 0.02))
    cam.key(1, loc=eye); cam.key(n, loc=eye + Vector((0.08, 0.0, 0.0)))
    face_light(cam, energy=18, size=1.0, color=WARM)
    return n


@shot
def sh06():
    """She sits right next to you. - two-shot: she leans her head toward you; you can't stop grinning."""
    n = frames_of("sh06")
    closeup()
    you, crush, fam, _ = table_scene(n, fam_on=False)
    cp = rocker(crush)
    rock(cp, [(1, 0.0), (12, 0.0), (26, 3.0)])
    yaw = cp.parent
    yaw.rotation_euler.y = 0
    tilt = empty("crush_tilt")
    look_keys(crush, you, [(1, 0.5)])
    look_keys(you, crush, [(1, 0.0), (10, 0.6)])
    face(crush, 1, LOVE); face(you, 1, SMILE); face(you, 12, BEAM)
    mid = (head(you) + head(crush)) / 2
    cam = Cam(lens=26, loc=(mid.x, mid.y - 1.4, mid.z + 0.1), target=(mid.x, mid.y, mid.z - 0.08))
    cam.key(1, loc=(mid.x, mid.y - 1.4, mid.z + 0.1)); cam.key(n, loc=(mid.x, mid.y - 1.25, mid.z + 0.08))
    face_light(cam, energy=18, size=1.2, color=WARM)
    return n


@shot
def sh07():
    """Best night of your LIFE. - close on you, the happiest man alive."""
    n = frames_of("sh07")
    closeup()
    you, crush, fam, _ = table_scene(n, fam_on=False)
    face(you, 1, BEAM); blink(you, [20])
    hy = head(you)
    cam = Cam(lens=45, loc=(hy.x + 0.1, hy.y - 1.0, hy.z + 0.02), target=(hy.x, hy.y, hy.z - 0.04))
    cam.key(1, loc=(hy.x + 0.1, hy.y - 1.0, hy.z + 0.02)); cam.key(n, loc=(hy.x + 0.08, hy.y - 0.8, hy.z + 0.02))
    face_light(cam, energy=18, size=1.0, color=WARM)
    return n


@shot
def sh08():
    """Then you look up... - your smile slowly drops as your eyes turn to the end of the table."""
    n = frames_of("sh08")
    closeup()
    you, crush, fam, _ = table_scene(n, fam_on=False)
    endp = empty("table_end", (SEATS["dale"][0], SEATS["dale"][1], 1.15))
    look_keys(you, endp, [(1, 0.0), (8, 0.0), (22, 0.85)])
    face(you, 1, BEAM); face(you, 14, BEAM); face(you, 28, UNEASY)
    hy = head(you)
    cam = Cam(lens=40, loc=(hy.x + 0.55, hy.y - 1.05, hy.z + 0.02), target=(hy.x, hy.y, hy.z - 0.05))
    cam.key(1, loc=(hy.x + 0.55, hy.y - 1.05, hy.z + 0.02)); cam.key(n, loc=(hy.x + 0.45, hy.y - 0.88, hy.z + 0.02))
    face_light(cam, energy=18, size=1.0, color=WARM)
    return n


@shot
def sh09():
    """and DALE is sitting at the table, - the end of the table: Dale, alive, waving at you."""
    n = frames_of("sh09")
    closeup()
    you, crush, fam, dale = table_scene(n, dale=True)
    hd = head(dale)
    wave = empty("wave09")
    for k, f in enumerate(range(1, n + 1, 6)):
        key_loc(wave, f, hd + Vector((-0.3, 0.16 + (0.07 if k % 2 else 0.0), 0.12)))
    for c in dale.rig.pose.bones["RightForeArm"].constraints:
        if c.type == "IK":
            dale.rig.pose.bones["RightForeArm"].constraints.remove(c)
    hand_ik(dale, "Right", wave)
    look_keys(dale, you, [(1, 0.8)])
    cam = Cam(lens=34, loc=(-0.2, -0.2, 1.45), target=(hd.x, hd.y, hd.z - 0.15))
    cam.key(1, loc=(-0.2, -0.2, 1.45)); cam.key(n, loc=(0.05, -0.05, 1.42))
    face_light(cam, energy=16, size=1.0, color=WARM)
    return n


@shot
def sh10():
    """eating your food. - close on Dale shovelling it in, very happy."""
    n = frames_of("sh10")
    closeup()
    you, crush, fam, dale = table_scene(n, dale=True)
    eating(dale, "dale", n, every=7)
    face(dale, 1, SMILE)
    hd = head(dale)
    cam = Cam(lens=42, loc=(hd.x - 1.1, hd.y - 0.35, hd.z + 0.0), target=(hd.x, hd.y, hd.z - 0.12))
    cam.key(1, loc=(hd.x - 1.1, hd.y - 0.35, hd.z + 0.0)); cam.key(n, loc=(hd.x - 0.9, hd.y - 0.3, hd.z))
    face_light(cam, energy=16, size=1.0, color=WARM)
    return n


@shot
def sh11():
    """You scream, "DALE!" - you jump up out of your chair, pointing, screaming."""
    n = frames_of("sh11")
    closeup()
    dining_room()
    crush = load_char("wife", (0, 0, 0), subdiv=True, tag="crush")
    seat(crush, "crush")
    you = you_char((SEATS["you"][0], SEATS["you"][1] + 0.05, 0), rot_z=0)
    idle(you, n)
    ep14.wooden_chair((SEATS["you"][0], SEATS["you"][1] + 0.35, 0), facing=0.0, name="chair_you_back")
    hy = head(you)
    pt = empty("point11", hy + Vector((0.45, -0.45, -0.1)))
    key_loc(pt, 1, hy + Vector((0.15, -0.2, -0.6))); key_loc(pt, 6, hy + Vector((0.45, -0.45, -0.1)))
    hand_ik(you, "Left", pt)
    look_keys(you, empty("dale_spot", (SEATS["dale"][0], SEATS["dale"][1], 1.15)), [(1, 0.8)])
    face(you, 1, SCREAM)
    look_keys(crush, you, [(1, 0.6)])
    face(crush, 1, SHOCK)
    cam = Cam(lens=34, loc=(hy.x - 0.25, hy.y - 1.25, hy.z - 0.05), target=(hy.x + 0.05, hy.y, hy.z - 0.15))
    cam.key(1, loc=(hy.x - 0.25, hy.y - 1.25, hy.z - 0.05)); cam.key(n, loc=(hy.x - 0.2, hy.y - 1.05, hy.z - 0.05))
    cam.shake(1, 10, amp=0.02, freq=1.5)
    face_light(cam, energy=18, size=1.0, color=WARM)
    return n


@shot
def sh12():
    """But no one else can see him. - wide: the whole family staring at YOU, while Dale waves right beside them."""
    n = frames_of("sh12")
    you, crush, fam, dale = table_scene(n, dale=True, sd=False)
    hd = head(dale)
    wave = empty("wave12")
    for k, f in enumerate(range(1, n + 1, 6)):
        key_loc(wave, f, hd + Vector((-0.3, 0.16 + (0.07 if k % 2 else 0.0), 0.12)))
    for c in dale.rig.pose.bones["RightForeArm"].constraints:
        if c.type == "IK":
            dale.rig.pose.bones["RightForeArm"].constraints.remove(c)
    hand_ik(dale, "Right", wave)
    for nm, ch in list(fam.items()) + [("crush", crush)]:
        look_keys(ch, you, [(1, 0.75)])
        face(ch, 1, DEADPAN)
    face(you, 1, WIDE)
    look_keys(you, dale, [(1, 0.7)])
    cam = Cam(lens=22, loc=(0.35, -1.75, 1.85), target=(0.45, 1.0, 0.95))
    cam.key(1, loc=(0.35, -1.75, 1.85)); cam.key(n, loc=(0.4, -1.55, 1.82))
    return n


@shot
def sh13():
    """Only YOU. - close on Dale: he winks at you."""
    n = frames_of("sh13")
    closeup()
    you, crush, fam, dale = table_scene(n, dale=True, fam_on=False)
    look_keys(dale, you, [(1, 0.85)])
    face(dale, 1, GRIN); face(dale, 10, WINK); face(dale, 18, GRIN)
    hd = head(dale)
    hy = head(you)
    dirv = (hy - hd).normalized()
    cam = Cam(lens=45, loc=hd + dirv * 0.9 + Vector((0, 0, 0.03)), target=hd + Vector((0, 0, -0.02)))
    cam.key(1, loc=hd + dirv * 0.9 + Vector((0, 0, 0.03))); cam.key(n, loc=hd + dirv * 0.72 + Vector((0, 0, 0.03)))
    face_light(cam, energy=18, size=1.0, color=WARM)
    return n


@shot
def sh14():
    """Your crush thinks you're CRAZY. - she slides her chair away from you, eyes wide."""
    n = frames_of("sh14")
    closeup()
    dining_room()
    you = you_char(sd=True)
    seat(you, "you")
    crush = load_char("wife", (0, 0, 0), subdiv=True, tag="crush")
    x, y, f = SEATS["crush"]
    mover = empty("crush_slide", (0, 0, 0))
    piv, sz = ep14.wooden_chair((0.0, 0.0, 0.0), facing=0.0, name="chair_crush_s")
    piv.parent = mover
    crush.rig.location = (0.0, 0.02, 0); crush.rig.rotation_euler = (0, 0, 0)
    sit_level(crush, sz)
    crush.rig.parent = mover
    key_loc(mover, 1, (x, y, 0)); key_loc(mover, 8, (x, y, 0)); key_loc(mover, 26, (x + 0.55, y + 0.05, 0))
    look_keys(crush, you, [(1, 0.7)])
    face(crush, 1, UNEASY); face(crush, 10, dict(UNEASY, browInnerUp=1.0, eyeWideLeft=0.9, eyeWideRight=0.9))
    face(you, 1, WIDE)
    look_keys(you, empty("dale_spot14", (SEATS["dale"][0], SEATS["dale"][1], 1.15)), [(1, 0.7)])
    mid = (head(you) + Vector((x + 0.3, y, head(you).z))) / 2
    cam = Cam(lens=24, loc=(0.25, -0.2, 1.45), target=(0.25, 1.62, 1.0))
    cam.key(1, loc=(0.25, -0.2, 1.45)); cam.key(n, loc=(0.25, -0.05, 1.43))
    face_light(cam, energy=18, size=1.2, color=WARM)
    return n


@shot
def sh15():
    """Dale smiles. - slow push on Dale's creepy smile."""
    n = frames_of("sh15")
    closeup()
    you, crush, fam, dale = table_scene(n, dale=True, fam_on=False)
    look_keys(dale, crush, [(1, 0.0), (6, 0.8)])
    face(dale, 1, DEADPAN); face(dale, 10, CREEPY)
    hd = head(dale)
    cam = Cam(lens=50, loc=(hd.x - 0.95, hd.y - 0.45, hd.z + 0.02), target=(hd.x, hd.y, hd.z - 0.02))
    cam.key(1, loc=(hd.x - 0.95, hd.y - 0.45, hd.z + 0.02)); cam.key(n, loc=(hd.x - 0.7, hd.y - 0.33, hd.z + 0.02))
    face_light(cam, energy=18, size=0.9, color=WARM)
    return n


@shot
def sh16():
    """Then he grabs your crush - Dale behind her chair, hands on her shoulders; up she goes, kicking."""
    n = frames_of("sh16")
    closeup()
    dining_room()
    you = you_char(sd=True)
    seat(you, "you")
    crush = load_char("wife", (0, 0, 0), subdiv=True, tag="crush")
    x, y, f = SEATS["crush"]
    ep14.wooden_chair((x, y, 0.0), facing=0.0, name="chair_crush_g")
    lift = empty("crush_lift", (x, y, 0))
    crush.rig.location = (0.0, 0.02, 0); crush.rig.rotation_euler = (0, 0, 0)
    sit_level(crush, 0.485)
    crush.rig.parent = lift
    f0 = 12
    key_loc(lift, 1, (x, y, 0)); key_loc(lift, f0, (x, y, 0)); key_loc(lift, n, (x + 0.25, y + 0.1, 0.75))
    key_rot(lift, 1, (0, 0, 0)); key_rot(lift, f0, (0, 0, 0)); key_rot(lift, n, (0, 0, -35))
    dale = dale_char((x, y + 0.62, 0), rot_z=0)
    idle(dale, n)
    bpy.context.view_layer.update()
    for side, dx in (("Left", 0.17), ("Right", -0.17)):                     # Dale faces -Y: left is +X
        t = empty(f"grab_{side}")
        t.parent = lift
        t.location = Vector((dx, 0.12, 1.12))
        hand_ik(dale, side, t)
    for side, dx in (("Left", 0.35), ("Right", -0.35)):                     # her arms flail up
        t = empty(f"flail_{side}")
        for k, fr in enumerate(range(1, n + 1, 4)):
            z = 1.15 if fr < f0 else 1.45 + (0.12 if k % 2 else 0.0)
            key_loc(t, fr, (x + dx, y - 0.2, z))
        hand_ik(crush, side, t)
    face(crush, 1, LOVE); face(crush, f0, SCREAM)
    face(dale, 1, CREEPY)
    look_keys(you, crush, [(1, 0.6)]); face(you, 1, WIDE)
    cam = Cam(lens=28, loc=(0.1, -1.0, 1.55), target=(x + 0.1, y + 0.2, 1.25))
    cam.key(1, loc=(0.1, -1.0, 1.55)); cam.key(n, loc=(0.15, -0.85, 1.6))
    face_light(cam, energy=18, size=1.2, color=WARM)
    return n


def flung(ch, n, f0, f1, p0, p1, height=1.5, spin=360.0):
    """A character flung through the air in a starfish (T-pose), tumbling along an arc."""
    ch.tpose()
    root = empty(f"fling_{ch.name}", p0)
    ch.rig.parent = root; ch.rig.location = (0, 0, -1.0); ch.rig.rotation_euler = (math.radians(-80), 0, 0)
    for f in range(1, n + 1):
        u = min(1.0, max(0.0, (f - f0) / max(1, f1 - f0)))
        pos = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, height * 4 * u * (1 - u)))
        root.location = pos; root.keyframe_insert("location", frame=f)
        root.rotation_euler = (math.radians(spin * u * 0.4), math.radians(spin * u), 0); root.keyframe_insert("rotation_euler", frame=f)
    return root


@shot
def sh17():
    """and THROWS her out the window. - outside: the front window bursts and your crush sails across the lawn."""
    n = frames_of("sh17")
    house_night()
    f_hit = 5
    w = bpy.data.objects.get("win2.8")
    if w:
        vis(w, f_off=f_hit)
    shards((2.8, 3.4, 1.65), (0, -1, 0.3), f_hit, n, count=40, seed=4,
           colors=[(1.0, 0.8, 0.5), (0.8, 0.85, 0.9)], size=0.12, speed=0.16, name="frontshard")
    point("windowlight", (2.8, 3.8, 1.6), energy=120, color=WARM, radius=0.4)
    crush = load_char("wife", (0, 0, 0), subdiv=False, tag="crush")
    root = flung(crush, n, f_hit, n - 2, (2.8, 3.6, 1.7), (0.4, -2.6, 0.4), height=2.0)
    face(crush, 1, SCREAM)
    cam = Cam(lens=26, loc=(-1.6, -5.2, 1.4), target=(2.8, 3.4, 1.7))
    sc = bpy.context.scene
    for f in range(1, n + 1, 2):
        sc.frame_set(f)
        p = root.matrix_world.translation.copy() if f >= f_hit else Vector((2.8, 3.4, 1.7))
        cam.key(f, target=p, interp="LINEAR")
    sc.frame_set(1)
    cam.key(1, loc=(-1.6, -5.2, 1.4)); cam.key(n, loc=(-1.9, -5.6, 1.4))
    return n


@shot
def sh18():
    """Then the ground starts SHAKING. - the dinner table rattles, the candles jump, the family grabs the table."""
    n = frames_of("sh18")
    you, crush, fam, dale = table_scene(n, sd=False)
    for o in bpy.data.objects:
        if o.name.startswith(("plate_", "glass_", "candle17", "mash", "platter")):
            base = o.location.copy()
            for f in range(1, n + 1, 2):
                key_loc(o, f, base + Vector((0.006 * math.sin(f * 2.1 + base.x * 5), 0.006 * math.cos(f * 1.7), 0.004 * abs(math.sin(f * 2.9)))))
    ch_hide = bpy.data.objects.get("chair_crush")
    crush_meshes = [o for o in bpy.data.objects if o.users_collection and o.users_collection[0].name == "crush"]
    for o in crush_meshes:
        o.hide_render = True
    if ch_hide:
        for c in [ch_hide] + list(ch_hide.children_recursive):
            c.hide_render = True
    for nm, ch in list(fam.items()) + [("you", you)]:
        face(ch, 1, SHOCK)
    cam = Cam(lens=24, loc=(0.0, -1.55, 1.75), target=(0.0, 1.05, 0.95))
    cam.key(1, loc=(0.0, -1.55, 1.75)); cam.key(n, loc=(0.0, -1.35, 1.72))
    cam.shake(1, n, amp=0.05, freq=1.2)
    return n


@shot
def sh19():
    """Outside... it's LARRY. - the tank rumbles up the street toward your house, Larry in the hatch."""
    n = frames_of("sh19")
    closeup()
    house_night()
    tk, piv, mz, larry = tank_with_larry(loc=(-9.0, -6.4, 0), yaw=0.0, larry_yaw=90.0)   # riding forward
    key_loc(tk, 1, (-9.0, -6.4, 0)); key_loc(tk, n, (-2.5, -6.4, 0))
    key_rot(piv, 1, (0, 0, 0)); key_rot(piv, int(n * 0.6), (0, 0, 0)); key_rot(piv, n, (0, 0, 60))
    face(larry, 1, RAGE)
    area("tankkey", (0.5, -10.5, 3.5), (-4.0, -6.4, 1.2), energy=900, size=3.0, color=NIGHT)
    cam = Cam(lens=55, loc=(1.8, -8.6, 2.3), target=(-5.5, -6.4, 2.2))
    sc = bpy.context.scene
    for f in range(1, n + 1, 2):
        sc.frame_set(f)
        cam.key(f, target=larry.world("Spine1") + Vector((0.0, 0.0, -0.05)), interp="LINEAR")
    sc.frame_set(1)
    cam.key(1, loc=(1.8, -8.6, 2.3)); cam.key(n, loc=(1.6, -8.4, 2.25))
    return n


@shot
def sh20():
    """In a TANK. - close on Larry in the hatch: veil, tiara, pure rage; the turret swings to the house."""
    n = frames_of("sh20")
    closeup()
    house_night()
    tk, piv, mz, larry = tank_with_larry(loc=(-2.5, -6.4, 0), yaw=0.0)
    key_rot(piv, 1, (0, 0, 60)); key_rot(piv, n, (0, 0, 90))
    face(larry, 1, RAGE)
    bpy.context.view_layer.update()
    hl = head(larry)
    cam = Cam(lens=40, loc=(hl.x + 0.4, hl.y - 1.6, hl.z + 0.05), target=(hl.x, hl.y, hl.z - 0.1))
    cam.key(1, loc=(hl.x + 0.4, hl.y - 1.6, hl.z + 0.05)); cam.key(n, loc=(hl.x + 0.3, hl.y - 1.35, hl.z + 0.05))
    face_light(cam, energy=50, size=1.0, color=NIGHT)
    return n


@shot
def sh21():
    """BOOM! - the barrel fires: a huge muzzle flash."""
    n = frames_of("sh21")
    house_night()
    tk, piv, mz, larry = tank_with_larry(loc=(-2.5, -6.4, 0), yaw=0.0, sd=False)
    key_rot(piv, 1, (0, 0, 90))
    bpy.context.view_layer.update()
    f_fire = 3
    mzp = mz.matrix_world.translation.copy()
    ep11.muzzle_flash(mzp, f_fire)
    face(larry, 1, RAGE)
    cam = Cam(lens=26, loc=(mzp.x + 3.2, mzp.y - 2.6, 1.6), target=(mzp.x, mzp.y + 0.5, mzp.z))
    cam.key(1, loc=(mzp.x + 3.2, mzp.y - 2.6, 1.6))
    cam.shake(f_fire, f_fire + 10, amp=0.07, freq=2.0)
    return n


@shot
def sh22():
    """He blows up the ENTIRE house. - the house erupts in a fireball; roof and walls fly; smoke."""
    n = frames_of("sh22")
    house_night()
    f_boom = 4
    parts = house_parts()
    for o in parts:
        vis(o, f_off=f_boom + 2)
    rub = len(bpy.data.objects)
    rubble(smoke=False, fires=True)
    for o in list(bpy.data.objects)[rub:]:
        if o.type in ("MESH", "LIGHT"):
            vis(o, f_on=f_boom + 2)
    explosion((0.0, 6.5, 1.2), f_boom, n, size=5.0)
    cam = Cam(lens=22, loc=(0.0, -8.0, 1.7), target=(0.0, 5.0, 2.6))
    cam.key(1, loc=(0.0, -8.0, 1.7)); cam.key(n, loc=(0.0, -8.8, 1.8))
    cam.shake(f_boom, f_boom + 14, amp=0.09, freq=1.6)
    return n


@shot
def sh23():
    """And in the smoke, - the rubble; you sit up out of the debris, black with soot, dazed."""
    n = frames_of("sh23")
    closeup()
    house_night()
    rubble()
    you = you_char((0.4, 2.3, 0.0), rot_z=0)
    pose(you, ep2.SIT)
    settle(you, "Hips", 0.12)
    ep4.sootify(you, amount=0.55)
    face(you, 1, DAZED); blink(you, [12, 26])
    hy = head(you)
    cam = Cam(lens=32, loc=(hy.x + 0.6, hy.y - 2.1, hy.z + 0.25), target=(hy.x, hy.y, hy.z - 0.25))
    cam.key(1, loc=(hy.x + 0.6, hy.y - 2.1, hy.z + 0.25)); cam.key(n, loc=(hy.x + 0.5, hy.y - 1.8, hy.z + 0.22))
    face_light(cam, energy=40, size=1.2, color=(1.0, 0.7, 0.45))
    return n


def kidnap_trio(n, start=(0.4, 2.3), carry_from=None, carry_to=None, walk_from=None):
    """You (sooty) between Larry (your right, -X side when facing -Y... placed by world x) and Dale; each grips one of
    your arms; optionally the three are carried along by a mover (you lifted, feet dangling)."""
    mover = empty("trio", (start[0], start[1], 0))
    you = you_char(sd=True)
    you.hold("137_28", 3700)
    you.rig.parent = mover; you.rig.location = (0, 0, 0); you.rig.rotation_euler = (0, 0, 0)
    ep4.sootify(you, amount=0.55)
    larry = larry_char(sd=True)
    for nm in ("skirt", "skirt_band"):
        o = bpy.data.objects.get(nm)
        if o:
            o.hide_render = True; o.hide_viewport = True
    ep15.hide_bouquet()
    larry.rig.parent = mover; larry.rig.location = (0.62, 0.05, 0); larry.rig.rotation_euler = (0, 0, 0)
    dale = dale_char(sd=True)
    dale.rig.parent = mover; dale.rig.location = (-0.62, 0.05, 0); dale.rig.rotation_euler = (0, 0, 0)
    for ch in (larry, dale):
        if walk_from is not None:
            ch.clip("07_01", **src(n, 60, speed=0.9))
        else:
            ch.hold("137_28", 3700)
    bpy.context.view_layer.update()
    la = you.world("LeftArm", frame=1); ra = you.world("RightArm", frame=1)
    t1 = empty("larry_grip"); t1.parent = mover; t1.location = mover.matrix_world.inverted() @ (la + Vector((0.08, -0.02, -0.12)))
    t2 = empty("dale_grip"); t2.parent = mover; t2.location = mover.matrix_world.inverted() @ (ra + Vector((-0.08, -0.02, -0.12)))
    hand_ik(larry, "Right", t1)
    hand_ik(dale, "Left", t2)
    return mover, you, larry, dale


@shot
def sh24():
    """Larry and Dale GRAB you. - out of the smoke, one from each side, they grab your arms; you yelp."""
    n = frames_of("sh24")
    closeup()
    house_night()
    rubble()
    mover, you, larry, dale = kidnap_trio(n)
    l0 = larry.rig.location.copy(); d0 = dale.rig.location.copy()
    for ch, p0, dx in ((larry, l0, 1.0), (dale, d0, -1.0)):
        ch.rig.location = p0 + Vector((dx * 0.9, 0.3, 0)); ch.rig.keyframe_insert("location", frame=1)
        ch.rig.location = p0; ch.rig.keyframe_insert("location", frame=12)
    face(you, 1, DAZED); face(you, 13, SHOCK)
    face(larry, 1, SNUG); face(dale, 1, GRIN)
    look_keys(larry, you, [(1, 0.6)]); look_keys(dale, you, [(1, 0.6)])
    hy = head(you)
    cam = Cam(lens=28, loc=(hy.x, hy.y - 2.6, hy.z - 0.1), target=(hy.x, hy.y, hy.z - 0.35))
    cam.key(1, loc=(hy.x, hy.y - 2.6, hy.z - 0.1)); cam.key(n, loc=(hy.x, hy.y - 2.3, hy.z - 0.1))
    face_light(cam, energy=45, size=1.4, color=(1.0, 0.7, 0.45))
    return n


@shot
def sh25():
    """They kidnap you. - they march off down the street, you dangling between them, legs kicking."""
    n = frames_of("sh25")
    house_night()
    rubble()
    mover, you, larry, dale = kidnap_trio(n, start=(0.4, -1.5), walk_from=True)
    key_loc(mover, 1, (0.4, -1.5, 0.0)); key_loc(mover, n, (0.4, -1.5 - 0.035 * n, 0.0))
    key_rot(mover, 1, (0, 0, 0))
    you.rig.location = (0, 0, 0.18); you.rig.keyframe_insert("location", frame=1)
    for k, f in enumerate(range(1, n + 1, 4)):
        you.rig.location = (0, 0, 0.18 + (0.04 if k % 2 else 0.0)); you.rig.keyframe_insert("location", frame=f)
    face(you, 1, SCREAM); face(larry, 1, SNUG); face(dale, 1, GRIN)
    cam = Cam(lens=28, loc=(1.6, -4.6, 1.45), target=(0.4, -1.9, 1.1))
    cam.key(1, loc=(1.6, -4.6, 1.45)); cam.key(n, loc=(1.6, -5.4, 1.45), target=(0.4, -3.0, 1.1))
    face_light(cam, energy=40, size=1.4, color=NIGHT)
    return n


# ============================================================================ SHOTS: the basement
@shot
def sh26():
    """They lock you in their BASEMENT. - the steel door slams; the padlock snaps shut; the bare bulb swings."""
    n = frames_of("sh26")
    h = basement()
    for f, a in ((1, -75), (8, -75), (16, 0), (18, 3), (20, 0)):
        h.rotation_euler = (0, 0, math.radians(a)); h.keyframe_insert("rotation_euler", frame=f)
    lock = bpy.data.objects["padlock"]
    for f, z in ((1, 1.08), (20, 1.08), (26, 1.0), (28, 1.02), (30, 1.0)):
        lock.location = (0.07, 0.9, z); lock.keyframe_insert("location", frame=f)
    cam = Cam(lens=26, loc=(0.8, 0.4, 1.4), target=(-2.4, -0.4, 1.1))
    cam.key(1, loc=(0.8, 0.4, 1.4)); cam.key(n, loc=(0.6, 0.3, 1.35))
    cam.shake(16, 22, amp=0.03, freq=1.6)
    return n


@shot
def sh27():
    """And then they CUDDLE you. - the basement bed: you squeezed between them, both snuggling in."""
    n = frames_of("sh27")
    closeup()
    basement()
    you, dale, larry = ep16.in_bed_trio(n)
    ep4.sootify(you, amount=0.4)
    blink(you, [24])
    cam = Cam(lens=30, loc=(0.0, 0.25, 2.4), target=(0.0, 1.7, 0.72))
    cam.key(1, loc=(0.0, 0.25, 2.4)); cam.key(n, loc=(0.0, 0.45, 2.3))
    face_light(cam, energy=30, size=1.4, color=(1.0, 0.85, 0.65))
    return n


@shot
def sh28():
    """From both sides. All night. - high above the three of them under the swinging bulb; the night crawls."""
    n = frames_of("sh28")
    closeup()
    basement()
    you, dale, larry = ep16.in_bed_trio(n)
    ep4.sootify(you, amount=0.4)
    for f in range(12, n, 14):
        you.expr(f, {"eyeBlinkLeft": 0.0}); you.expr(f + 2, {"eyeSquintLeft": 0.8}); you.expr(f + 5, {"eyeSquintLeft": 0.0})
    cam = Cam(lens=40, loc=(0.0, 0.35, 2.55), target=(0.0, 1.72, 0.72))
    cam.key(1, loc=(0.0, 0.35, 2.55)); cam.key(n, loc=(0.0, 0.6, 2.4))
    face_light(cam, energy=30, size=1.6, color=(1.0, 0.85, 0.65))
    return n


@shot
def sh29():
    """"HELP!" - close on you, screaming at the ceiling."""
    n = frames_of("sh29")
    closeup()
    basement()
    you, dale, larry = ep16.in_bed_trio(n)
    ep4.sootify(you, amount=0.4)
    face(you, 1, SCREAM)
    hy = head(you)
    cam = Cam(lens=36, loc=(hy.x, hy.y - 0.6, hy.z + 0.85), target=(hy.x, hy.y, hy.z))
    cam.key(1, loc=(hy.x, hy.y - 0.6, hy.z + 0.85)); cam.key(n, loc=(hy.x, hy.y - 0.5, hy.z + 0.7))
    cam.shake(1, n, amp=0.015, freq=1.5)
    face_light(cam, energy=40, size=1.0, color=(1.0, 0.85, 0.65))
    return n


@shot
def sh30():
    """But no one can hear you. - outside a quiet house at night; one tiny basement window glows; we drift up to the
    stars."""
    n = frames_of("sh30")
    house_night()
    box("basement_win", (0.7, 0.06, 0.3), (-2.8, 3.47, 0.22), mat_flat("bwin", (1, 1, 1), emit=(1.0, 0.8, 0.5), emit_strength=2.5))
    cam = Cam(lens=26, loc=(-2.2, -4.5, 0.6), target=(-2.8, 3.5, 0.5))
    cam.key(1, loc=(-2.2, -4.5, 0.6), target=(-2.8, 3.5, 0.5))
    cam.key(n, loc=(-1.0, -8.5, 3.2), target=(-1.5, 6.0, 4.0))
    return n
