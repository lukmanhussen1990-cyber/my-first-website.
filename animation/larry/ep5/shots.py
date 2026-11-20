"""Shot definitions for Episode 5 "Larry's Wood" (Larry begs you to sit on his wood: a hand-carved chair).
Same pipeline as episodes 1-4; reuses episode 1's office, episode 2's street/bus/driver kit and episode 4's helpers."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (load_char, empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale, fit, bbox)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ep4shots", os.path.join(_HERE, "..", "ep4", "shots.py"))
ep4 = importlib.util.module_from_spec(_spec)
sys.modules["ep4shots"] = ep4
_spec.loader.exec_module(ep4)
ep3, ep2, ep1 = ep4.ep3, ep4.ep2, ep4.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, WINK, TADA,
                      LOVESTRUCK, SERENE, face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, lipsync,
                      SIT)  # noqa: E402
from ep3shots import hold  # noqa: E402
pose_seq, facing, soot_cloud = ep4.pose_seq, ep4.facing, ep4.soot_cloud

D5 = os.path.join(lib.SCRATCH, "ep5", "decals")
_load_char = load_char


def load_char(name, *a, **k):
    ch = _load_char(name, *a, **k)
    if name == "you_astro":
        for o in ch.meshes:
            mats = [m.name.lower() for m in o.data.materials if m]
            amt = 0.02 if any("cargo" in m for m in mats) else 0.004 if any("polo" in m for m in mats) else 0
            if amt:
                dm = o.modifiers.new("loosen", "DISPLACE"); dm.mid_level = 0.0; dm.strength = amt
    return ch
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


STAND = {}
SIT_HIGH = {"lfemur": {"rx": -80}, "rfemur": {"rx": -80}, "ltibia": {"rx": 75}, "rtibia": {"rx": 75}}
SLOUCH = {"root": {"rx": -28}, "lfemur": {"rx": -70, "rz": 3}, "rfemur": {"rx": -70, "rz": -3},
          "ltibia": {"rx": 65}, "rtibia": {"rx": 65}}
FLOAT = {"lfemur": {"rx": -28}, "rfemur": {"rx": -12}, "ltibia": {"rx": 50}, "rtibia": {"rx": 28},
         "lowerback": {"rx": -6}}
LOTUS = {"lfemur": {"rx": -85, "rz": 30}, "rfemur": {"rx": -85, "rz": -30}, "ltibia": {"rx": 118},
         "rtibia": {"rx": 118}}


def sit_down(ch, f0, f1, n, seat_z, pose_from=STAND, pose_to=SIT, hold_to=None, dy=0.0):
    """Animated sit: eased joint blend from pose_from to pose_to between f0 and f1, with the rig lowered so the hips
    land at seat_z + 0.1 exactly at f1."""
    keys = [(1, pose_from), (f0, pose_from), (f1, pose_to), (n, hold_to or pose_to)]
    pose_seq(ch, keys, n)
    sc = bpy.context.scene
    z0 = ch.rig.location.z
    sc.frame_set(f1); bpy.context.view_layer.update()
    dz = seat_z + 0.1 - ch.world("Hips").z
    sc.frame_set(1)
    x0, y0 = ch.rig.location.x, ch.rig.location.y
    for f, y, z in ((1, y0, z0), (f0, y0, z0), (f1, y0 + dy, z0 + dz), (n, y0 + dy, z0 + dz)):
        key_loc(ch.rig, f, (x0, y, z))


# ============================================================================ props
def oak_mat(name="oak", light=(0.74, 0.5, 0.27), dark=(0.45, 0.27, 0.12), scale=5.0):
    """Varnished oak: a procedural grain (wave bands warped by noise) in object space, so any part reads as wood."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.38
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale * 0.35, scale * 0.35, scale * 2.5)
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "RINGS"; wv.inputs["Scale"].default_value = 3.0
    wv.inputs["Distortion"].default_value = 6.0; wv.inputs["Detail"].default_value = 3.0
    rp = nt.nodes.new("ShaderNodeValToRGB")
    rp.color_ramp.elements[0].color = (*dark, 1); rp.color_ramp.elements[1].color = (*light, 1)
    rp.color_ramp.elements[0].position = 0.15; rp.color_ramp.elements[1].position = 0.75
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], wv.inputs[0])
    nt.links.new(wv.outputs["Fac"], rp.inputs[0]); nt.links.new(rp.outputs[0], b.inputs["Base Color"])
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def carved_chair(name, loc=(0, 0, 0), rot_z=0.0, heart=True, scale=1.0):
    """Larry's hand-carved oak chair: front faces -Y at rot_z=0, a carved heart + FOR YOU on the backrest.
    Returns the root empty (origin on the floor under the seat centre)."""
    w = oak_mat()
    root = empty(name, loc); root.rotation_euler = (0, 0, math.radians(rot_z)); root.scale = (scale,) * 3
    parts = [box(f"{name}_seat", (0.48, 0.46, 0.05), (0, 0, 0.47), w, bevel=0.012)]
    for x in (-0.21, 0.21):
        parts.append(box(f"{name}_fl{x}", (0.045, 0.045, 0.45), (x, -0.19, 0.225), w, bevel=0.006))
        parts.append(box(f"{name}_bp{x}", (0.05, 0.05, 1.02), (x, 0.2, 0.51), w, bevel=0.008))
    parts.append(box(f"{name}_back", (0.42, 0.035, 0.36), (0, 0.205, 0.8), w, bevel=0.01))
    parts.append(box(f"{name}_crest", (0.52, 0.06, 0.07), (0, 0.205, 1.03), w, bevel=0.02))
    parts.append(box(f"{name}_rail", (0.42, 0.03, 0.04), (0, -0.19, 0.18), w))
    for p in parts:
        p.parent = root
    if heart:
        d = decal(f"{name}_heart", f"{D5}/chair_heart.png", 0.34, (0, 0.186, 0.8), rot=(90, 0, 0), alpha=True)
        d.parent = root
    return root


def rocking_chair(name, loc=(0, 0, 0), rot_z=0.0):
    """The carved chair on a pair of curved oak rockers."""
    root = carved_chair(name, loc, rot_z)
    w = oak_mat()
    R, a0 = 1.3, math.radians(24)
    for x in (-0.21, 0.21):
        verts, faces = [], []
        N = 24
        for i in range(N + 1):
            t = -a0 + 2 * a0 * i / N
            y, z = R * math.sin(t), R * (1 - math.cos(t))
            for dx, dz in ((-0.022, 0.0), (0.022, 0.0), (0.022, 0.05), (-0.022, 0.05)):
                verts.append((x + dx, y, z + dz))
        for i in range(N):
            a, b_ = i * 4, (i + 1) * 4
            for k in range(4):
                faces.append((a + k, a + (k + 1) % 4, b_ + (k + 1) % 4, b_ + k))
        me = bpy.data.meshes.new(f"{name}_rocker{x}"); me.from_pydata(verts, [], faces); me.update()
        o = bpy.data.objects.new(f"{name}_rocker{x}", me); bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(w); o.parent = root
    for k in root.children:
        if k.location.z < 0.3 and "_fl" in k.name:      # legs stand on the rockers
            k.location.z += 0.03
    return root


def saw(name="saw"):
    root = empty(name)
    b = box(f"{name}_blade", (0.006, 0.5, 0.11), (0, 0.3, -0.03), mat_flat("sawblade", (0.78, 0.8, 0.84), metal=0.35, rough=0.3))
    h = box(f"{name}_handle", (0.03, 0.12, 0.1), (0, 0.0, 0.0), oak_mat("handle", (0.55, 0.2, 0.1), (0.35, 0.12, 0.05)),
            bevel=0.01)
    b.parent = root; h.parent = root
    return root


def sack(name="sack"):
    """Burlap sack of wood chips with the LARRY'S WOOD CHIPS label; origin at its centre."""
    root = empty(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.2, depth=0.5, location=(0, 0, 0))
    s = bpy.context.object; s.name = f"{name}_body"
    tx = bpy.data.textures.get("sackfold") or bpy.data.textures.new("sackfold", "CLOUDS"); tx.noise_scale = 0.12
    sd = s.modifiers.new("soft", "SUBSURF"); sd.levels = 2; sd.render_levels = 2
    dm = s.modifiers.new("folds", "DISPLACE"); dm.texture = tx; dm.strength = 0.03
    bpy.ops.object.shade_smooth(); s.data.materials.append(mat_flat("burlap", (0.62, 0.48, 0.3), rough=0.95)); s.parent = root
    lb = decal(f"{name}_label", f"{D5}/sack_label.png", 0.3, (0, -0.215, 0.0), rot=(90, 0, 0)); lb.parent = root
    for i in range(14):                                       # chips heaped on the open top
        c = box(f"{name}_chip{i}", (0.05, 0.03, 0.008), (random.Random(i).uniform(-0.12, 0.12),
                random.Random(i + 50).uniform(-0.12, 0.12), 0.27), oak_mat(), rot=(0, 0, i * 37))
        c.parent = root
    return root


def wood_chips(name, center, n_chips, f_burst, f_land, spread=0.9, seed=3, floor_z=0.0, static=False):
    """Chips bursting out of a point and raining onto the floor in a heap (hidden until f_burst); static=True just
    leaves the heap on the floor."""
    rnd = random.Random(seed)
    w = oak_mat("chipoak", (0.85, 0.65, 0.4), (0.6, 0.4, 0.2))
    for i in range(n_chips):
        c = box(f"{name}{i}", (rnd.uniform(0.03, 0.06), rnd.uniform(0.02, 0.035), 0.007), center, w)
        a = rnd.uniform(0, 2 * math.pi); r = spread * math.sqrt(rnd.random())
        end = (center[0] + math.cos(a) * r, center[1] + math.sin(a) * r, floor_z + 0.004 + rnd.uniform(0, 0.05) * (1 - r / spread))
        mid = ((center[0] + end[0]) / 2, (center[1] + end[1]) / 2, center[2] + rnd.uniform(0.2, 0.6))
        if static:
            c.location = end; c.rotation_euler = (0, 0, math.radians(rnd.uniform(0, 360)))
            continue
        fl = f_land + rnd.randint(-2, 4); fb = f_burst + rnd.randint(0, 3)
        key_scale(c, 1, 0.001); key_scale(c, fb - 1, 0.001); key_scale(c, fb, 1.0)
        key_loc(c, fb, center); key_loc(c, (fb + fl) // 2, mid); key_loc(c, fl, end)
        key_rot(c, fb, (0, 0, 0)); key_rot(c, fl, (rnd.uniform(-20, 20), rnd.uniform(-20, 20), rnd.uniform(0, 360)))


# ============================================================================ sets
def workshop_set():
    """Larry's garage workshop at night: bench, planks, pegboard, the calendar, one warm bulb."""
    world_color((0.02, 0.02, 0.025), 0.3)
    plane("wfloor", (12, 12), (0, 0, 0), mat_tex("wfl", "concrete_floor_02", scale=1.0, tint=(0.7, 0.68, 0.65)), uv_scale=0.5)
    wall = mat_tex("wwall", "brick_wall_02", scale=1.0, tint=(0.75, 0.6, 0.52))
    box("ww_back", (12, 0.2, 3.0), (0, 2.2, 1.5), wall, uv_scale=0.6)
    box("ww_left", (0.2, 12, 3.0), (-2.8, 0, 1.5), wall, uv_scale=0.6)
    plane("wceil", (12, 12), (0, 0, 3.0), mat_flat("wceil", (0.2, 0.2, 0.2)), rot=(180, 0, 0))
    w = oak_mat("benchoak", (0.62, 0.45, 0.28), (0.42, 0.28, 0.15))
    box("bench_top", (2.2, 0.75, 0.08), (0.2, 1.6, 0.9), w, bevel=0.01)
    for x in (-0.8, 1.2):
        for y in (1.3, 1.9):
            box(f"bench_leg{x}{y}", (0.08, 0.08, 0.86), (x, y, 0.43), w)
    box("pegboard", (2.0, 0.03, 1.0), (0.2, 2.08, 1.65), mat_flat("peg", (0.55, 0.42, 0.28), rough=0.9))
    tool = mat_flat("tool", (0.2, 0.2, 0.22), metal=0.8, rough=0.35)
    for i, (x, z, sx, sz) in enumerate(((-0.5, 1.8, 0.05, 0.35), (-0.2, 1.75, 0.25, 0.06), (0.15, 1.85, 0.04, 0.4),
                                         (0.45, 1.7, 0.18, 0.18), (0.8, 1.8, 0.05, 0.3))):
        box(f"tool{i}", (sx, 0.03, sz), (x, 2.05, z), tool)
    rnd = random.Random(5)
    for i in range(6):                                        # planks leaning on the left wall
        pl = box(f"plank{i}", (0.03, 0.22, 2.2), (-2.62 + i * 0.035, -0.8 + i * 0.26, 1.08),
                 oak_mat(f"plankoak{i % 2}", (0.75 - 0.08 * (i % 2), 0.55, 0.32), (0.5, 0.33, 0.17)), rot=(0, -8, 0))
    for k, c in enumerate(((-0.6, 0.9), (1.3, 1.1), (0.3, 1.9))):    # shavings on the floor from six months of work
        wood_chips(f"shav{k}_", (c[0], c[1], 0.0), 60, 1, 2, spread=0.45, seed=20 + k, static=True)
    decal("calendar", f"{D5}/calendar.png", 0.62, (1.85, 2.09, 1.8), rot=(90, 0, 0))
    cylinder("w_cord", 0.005, 1.0, (0.2, 0.9, 2.5), mat_flat("wcord", (0.05, 0.05, 0.05)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(0.2, 0.9, 1.98)); bl = bpy.context.object
    bl.data.materials.append(mat_flat("wbulb", (1, 1, 1), emit=(1.0, 0.8, 0.5), emit_strength=15)); bl.visible_shadow = False
    point("wbulb_light", (0.2, 0.9, 1.97), energy=260, color=(1.0, 0.78, 0.5), radius=0.08, shadow=True)
    area("wfill", (0.5, -3.0, 2.2), (0.2, 1.2, 1.0), energy=120, size=3, color=(0.55, 0.65, 1.0))


def office(chair_at=None):
    """Episode 1's open-plan office (your cubicle: desk at (0, 0.62), opening toward -Y)."""
    ep1.office_set()
    if chair_at is not None:
        return ep2.chair(chair_at, rot_z=180, seat_h=0.5)
    return None


def standing_desk(loc=(0, -0.3, 0)):
    """Tall oak standing desk with a brass HANDMADE BY LARRY plaque; front faces -Y. Returns the root."""
    w = oak_mat()
    x, y, _ = loc
    root = empty("sdesk", loc)
    parts = [box("sd_top", (1.2, 0.6, 0.05), (0, 0, 1.08), w, bevel=0.012),
             box("sd_shelf", (1.1, 0.5, 0.03), (0, 0.02, 0.35), w)]
    for dx in (-0.55, 0.55):
        for dy in (-0.25, 0.25):
            parts.append(box(f"sd_leg{dx}{dy}", (0.06, 0.06, 1.06), (dx, dy, 0.53), w, bevel=0.008))
    parts.append(box("sd_apron", (1.1, 0.03, 0.12), (0, -0.27, 0.99), w))
    for p in parts:
        p.parent = root
    pl = decal("sd_plaque", f"{D5}/plaque.png", 0.36, (0, -0.287, 0.99), rot=(90, 0, 0)); pl.parent = root
    return root


def beanbag(loc, name="beanbag"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=0.5, location=loc)
    b = bpy.context.object; b.name = name; b.scale = (1.15, 1.1, 0.62)
    tx = bpy.data.textures.get("bbfold") or bpy.data.textures.new("bbfold", "CLOUDS"); tx.noise_scale = 0.2
    dm = b.modifiers.new("folds", "DISPLACE"); dm.texture = tx; dm.strength = 0.05
    bpy.ops.object.shade_smooth()
    b.data.materials.append(mat_tex("bbfab", "denim_fabric", scale=1.0, tint=(0.95, 0.12, 0.12), normal_strength=0.5))
    return b


def bus_interior_oak():
    """Episode 2's bus interior, but every seat is carved oak with a heart on its back."""
    seats = ep2.bus_interior_set()
    w = oak_mat()
    for o in list(bpy.data.objects):
        if o.name.startswith(("seat", "seatb")) and not o.name.startswith("seatleg"):
            o.data.materials.clear(); o.data.materials.append(w)
    for (x, y) in seats:
        d = decal(f"seatheart{x}{y}", f"{D5}/chair_heart.png", 0.26, (x, y + 0.29, 0.86), rot=(90, 0, 180), alpha=True)
    return seats


def dale_driver(n):
    """Dale in the (oak) driver's seat with a uniform cap, hands on the wheel."""
    piv, sz = ep2.chair((-0.75, -4.25, 0), rot_z=0, seat_h=0.55)
    for k in piv.children:
        if k.name.startswith(("seat", "back")):
            k.data.materials.clear(); k.data.materials.append(oak_mat())
    dale = load_char("dale", (-0.75, -4.3, 0), rot_z=0, subdiv=True, tag="dale")
    ep2.sit(dale, sz)
    on_bone(dale, ep2.cap(), "Head", (0, 0.115, 0.0))
    for side, dx in (("Left", 0.16), ("Right", -0.16)):
        hand_ik(dale, side, empty(f"wheel{side}", (-0.75 + dx, -4.7, 1.1)))
    return dale


def earth(loc, radius):
    """Procedural Earth: noise continents over ocean, a cloud layer, and a thin blue atmosphere rim."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=radius, location=loc)
    e = bpy.context.object; e.name = "earth"; bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new("earth"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexCoord")
    land = nt.nodes.new("ShaderNodeTexNoise"); land.inputs["Scale"].default_value = 2.2; land.inputs["Detail"].default_value = 8
    rl = nt.nodes.new("ShaderNodeValToRGB")
    rl.color_ramp.elements[0].position = 0.52; rl.color_ramp.elements[0].color = (0.02, 0.09, 0.3, 1)
    rl.color_ramp.elements[1].position = 0.56; rl.color_ramp.elements[1].color = (0.18, 0.3, 0.1, 1)
    e2 = rl.color_ramp.elements.new(0.68); e2.color = (0.45, 0.38, 0.22, 1)
    cl = nt.nodes.new("ShaderNodeTexNoise"); cl.inputs["Scale"].default_value = 4.5; cl.inputs["Detail"].default_value = 6
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = 0.6; cr.color_ramp.elements[1].position = 0.75
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs["B"].default_value = (0.95, 0.96, 1.0, 1)
    nt.links.new(tc.outputs["Generated"], land.inputs["Vector"]); nt.links.new(land.outputs["Fac"], rl.inputs[0])
    nt.links.new(tc.outputs["Generated"], cl.inputs["Vector"]); nt.links.new(cl.outputs["Fac"], cr.inputs[0])
    nt.links.new(rl.outputs[0], mix.inputs["A"]); nt.links.new(cr.outputs[0], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    e.data.materials.append(m)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=radius * 1.015, location=loc)
    at_ = bpy.context.object; at_.name = "atmosphere"; bpy.ops.object.shade_smooth()
    am = bpy.data.materials.new("atmo"); am.use_nodes = True
    nt = am.node_tree
    for nd in list(nt.nodes):
        if nd.type == "BSDF_PRINCIPLED":
            nt.nodes.remove(nd)
    out = nt.get_output_node("EEVEE") or next(nd for nd in nt.nodes if nd.type == "OUTPUT_MATERIAL")
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.3
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.3, 0.55, 1.0, 1); em.inputs["Strength"].default_value = 3
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 3.0
    nt.links.new(lw.outputs["Facing"], pw.inputs[0]); nt.links.new(pw.outputs[0], mx.inputs["Fac"])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    if hasattr(am, "surface_render_method"):
        am.surface_render_method = "BLENDED"
    at_.data.materials.append(am); at_.visible_shadow = False
    return e


def stars(n=500, r=900, seed=1):
    st = mat_flat("star5", (1, 1, 1), emit=(1, 1, 1), emit_strength=10)
    rnd = random.Random(seed)
    for i in range(n):
        u, v = rnd.uniform(-1, 1), rnd.uniform(0, 2 * math.pi)
        s = math.sqrt(1 - u * u)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.6, 1.6),
                                              location=(r * s * math.cos(v), r * s * math.sin(v), r * u))
        bpy.context.object.data.materials.append(st)


L_MOD = 8.0          # station module: x -4..+4, y -1.1..1.1, z 0..2.2; porthole in the +Y wall at x=0; hatch at x=+4


def station_interior(hatch_open=None, earth_in_window=True):
    """Inside the space station: rack-lined module, handrails, a porthole with Earth, the airlock hatch at +X.
    Returns the hatch hinge empty (rotate about Z, positive = open)."""
    world_color((0.0, 0.0, 0.0), 0.0)
    W, H = 2.2, 2.2
    panel = mat_flat("stpanel", (0.86, 0.87, 0.88), rough=0.6)
    box("st_floor", (L_MOD, W, 0.1), (0, 0, -0.05), panel)
    box("st_ceil", (L_MOD, W, 0.1), (0, 0, H + 0.05), panel)
    box("st_wallL", (L_MOD, 0.1, H), (0, -W / 2 - 0.05, H / 2), panel)
    ep1.wall_openings("st_wallR", -L_MOD / 2, L_MOD / 2, W / 2 + 0.05, H, 0.1, [(0.0, 0.8, 0.75, 1.55)], panel)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.06, location=(0, W / 2 - 0.02, 1.15),
                                     rotation=(math.radians(90), 0, 0))
    ring = bpy.context.object; ring.data.materials.append(mat_flat("string", (0.3, 0.32, 0.35), metal=0.7, rough=0.3))
    # racks / bags / lockers on every wall
    rnd = random.Random(8)
    cols = [(0.92, 0.92, 0.9), (0.8, 0.82, 0.85), (0.6, 0.62, 0.66), (0.25, 0.35, 0.6), (0.85, 0.85, 0.78)]
    for i in range(14):
        x = -L_MOD / 2 + 0.35 + i * 0.55
        for (y, z, sy, sz) in ((-W / 2 + 0.06, None, 0.12, None), (W / 2 - 0.06, None, 0.12, None)):
            for k in range(3):
                zz = 0.25 + k * 0.7
                if y > 0 and abs(x) < 0.6 and 0.6 < zz < 1.7:
                    continue
                box(f"rack{i}_{y:.1f}_{k}", (0.5, 0.1, 0.6), (x, y, zz + 0.1), mat_flat(f"rk{(i + k) % 5}", cols[(i + k) % 5], rough=0.7),
                    bevel=0.02)
        box(f"crack{i}", (0.5, 0.6, 0.08), (x, rnd.uniform(-0.3, 0.3), H - 0.06), mat_flat(f"rk{i % 5}", cols[i % 5], rough=0.7),
            bevel=0.02)
    rail = mat_flat("strail", (0.85, 0.75, 0.45), rough=0.4)
    for y in (-W / 2 + 0.2, W / 2 - 0.2):
        cylinder(f"rail{y}", 0.018, L_MOD - 0.6, (0, y, 1.65), rail, rot=(0, 90, 0))
    light = mat_flat("stlight", (1, 1, 1), emit=(0.92, 0.96, 1.0), emit_strength=6)
    for y in (-0.5, 0.5):
        plane(f"stlight{y}", (L_MOD - 1.0, 0.12), (0, y, H - 0.11), light, rot=(180, 0, 0))
    decal("nosit", f"{D5}/sign_nosit.png", 0.7, (-1.25, W / 2 - 0.125, 1.25), rot=(90, 0, 0))
    box("st_endW", (0.1, W, H), (-L_MOD / 2, 0, H / 2), panel)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.05, location=(-L_MOD / 2 + 0.06, 0, 1.1),
                                     rotation=(0, math.radians(90), 0))
    bpy.context.object.data.materials.append(mat_flat("string2", (0.45, 0.47, 0.5), metal=0.6, rough=0.35))
    # airlock end wall with a square docking port and a round-cornered hatch
    endm = mat_flat("stend", (0.78, 0.79, 0.8), rough=0.5)
    for (sy, sz, cy, cz) in ((0.3, H, -0.95, H / 2), (0.3, H, 0.95, H / 2), (1.6, 0.12, 0, 0.06), (1.6, 0.12, 0, H - 0.06)):
        box(f"end{cy}{cz}", (0.1, sy, sz), (L_MOD / 2, cy, cz), endm)
    decal("airlock_lbl", f"{D5}/airlock.png", 0.6, (L_MOD / 2 - 0.12, 0.0, 1.85), rot=(90, 0, -90), alpha=True).parent = None
    hinge = empty("hatch_hinge", (L_MOD / 2 - 0.08, -0.8, 1.1))
    h = box("hatch", (0.08, 1.6, 1.96), (0, 0.8, 0), mat_flat("hatchm", (0.7, 0.72, 0.75), metal=0.5, rough=0.35), bevel=0.15)
    h.parent = hinge
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(-0.06, 0.8, 0), rotation=(0, math.radians(90), 0))
    wh = bpy.context.object; wh.data.materials.append(mat_flat("hwheel", (0.2, 0.2, 0.22), metal=0.8)); wh.parent = hinge
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.03, location=(-0.045, 0.8, 0.45), rotation=(0, math.radians(90), 0))
    pw = bpy.context.object; pw.data.materials.append(mat_flat("hport", (0.1, 0.12, 0.15), rough=0.05, metal=0.3)); pw.parent = hinge
    # the airlock chamber beyond the port
    box("al_floor", (2.4, 2.0, 0.1), (L_MOD / 2 + 1.25, 0, -0.05), endm)
    box("al_back", (0.1, 2.0, H), (L_MOD / 2 + 2.45, 0, H / 2), endm)
    for y in (-1.0, 1.0):
        box(f"al_side{y}", (2.4, 0.1, H), (L_MOD / 2 + 1.25, y, H / 2), endm)
    box("al_ceil", (2.4, 2.0, 0.1), (L_MOD / 2 + 1.25, 0, H + 0.05), endm)
    area("al_light", (L_MOD / 2 + 1.3, 0, H - 0.1), (L_MOD / 2 + 1.3, 0, 0), energy=120, size=1.5, color=(1.0, 0.45, 0.35))
    if hatch_open:
        f0, f1 = hatch_open
        key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (0, 0, -100))
    if earth_in_window:
        earth((0, 520, -430), 450)
        sun(energy=4.5, rot=(70, 0, 200), color=(1.0, 0.97, 0.92))
    stars(250, 700)
    area("st_key", (-2.0, -0.4, H - 0.2), (0, 0, 1.0), energy=260, size=2.0, color=(0.95, 0.97, 1.0))
    area("st_fill", (2.5, 0.4, H - 0.2), (0, 0, 1.0), energy=180, size=2.0, color=(0.9, 0.95, 1.0))
    return hinge


def floaty(ch, n, p0, p1, rot0, rot1, pose_over=FLOAT):
    """Weightless drift: a relaxed float pose, the rig gliding p0 -> p1 and slowly turning rot0 -> rot1 (euler deg)."""
    pose(ch, pose_over)
    ch.rig.rotation_mode = "XYZ"
    key_loc(ch.rig, 1, p0, interp="LINEAR"); key_loc(ch.rig, n, p1, interp="LINEAR")
    key_rot(ch.rig, 1, rot0, interp="LINEAR"); key_rot(ch.rig, n, rot1, interp="LINEAR")


# ============================================================================ SHOTS
@shot
def sh01():
    """Larry from accounting has spent - his garage at night: Larry saws a plank, sawdust flying."""
    n = frames_of("sh01")
    workshop_set()
    w = oak_mat()
    for x in (-0.45, 0.95):                                  # two sawhorses and the plank being cut
        box(f"horse{x}", (0.08, 0.5, 0.62), (x, 0.62, 0.31), w)
        box(f"horsetop{x}", (0.12, 0.5, 0.06), (x, 0.62, 0.65), w)
    box("plank_cut", (1.7, 0.24, 0.04), (0.25, 0.62, 0.7), w, bevel=0.005)
    larry = load_char("larry", (0.12, 1.12, 0), rot_z=0, subdiv=True, tag="larry")
    pose(larry, {"lowerback": {"rx": 16}, "upperback": {"rx": 8}})
    sw = saw(); sw.rotation_euler = (0, 0, math.radians(180))       # blade upright, pointing away from Larry
    for f in range(1, n + 1, 6):                                       # the saw strokes; the hand rides the handle
        key_loc(sw, f, (-0.02, 0.98, 0.79)); key_loc(sw, min(n, f + 3), (-0.02, 0.78, 0.77))
    t = empty("sawhand", (0, 0, 0)); t.parent = sw; t.location = (0, 0, 0)
    hand_ik(larry, "Right", t)
    hand_ik(larry, "Left", empty("planknd", (0.48, 0.64, 0.74)))
    face(larry, 1, CREEPY_ENJOY)
    for k, f0 in enumerate(range(2, n - 6, 5)):                 # sawdust trickling from the cut
        wood_chips(f"dust{k}_", (-0.02, 0.62, 0.68), 10, f0, f0 + 6, spread=0.25, seed=k)
    look_at(larry, (0.0, 0.62, 0.7), 0.8)
    cam = Cam(lens=28, loc=(0.8, -1.05, 1.35), target=(0.15, 0.8, 1.0))
    cam.key(1, loc=(0.8, -1.05, 1.35))
    cam.key(n, loc=(0.7, -0.8, 1.32))
    return n


@shot
def sh02():
    """SIX MONTHS - the wall calendar: day 183, every single day crossed off."""
    n = frames_of("sh02")
    workshop_set()
    cam = Cam(lens=45, loc=(1.6, 0.6, 1.8), target=(1.85, 2.09, 1.8))
    cam.key(1, loc=(1.55, 0.55, 1.78))
    cam.key(n, loc=(1.75, 1.15, 1.8))
    return n


@shot
def sh03():
    """working on something special - Larry lovingly polishes the finished chair: a heart carved in the back."""
    n = frames_of("sh03")
    workshop_set()
    ch = carved_chair("lchair", (0.2, 0.45, 0), rot_z=0)
    larry = load_char("larry", (0.85, 0.55, 0), rot_z=-90, subdiv=True, tag="larry")
    pose(larry, {"lowerback": {"rx": 20}, "upperback": {"rx": 10}})
    t = empty("rag", (0, 0, 0))
    for f in range(1, n + 1, 2):
        a = f * 0.55
        key_loc(t, f, (0.38 + 0.05 * math.cos(a), 0.63, 0.98 + 0.05 * math.sin(a)))
    hand_ik(larry, "Right", t)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0, 0, 0)); rg = bpy.context.object
    rg.scale = (1.0, 0.6, 0.8); rg.data.materials.append(mat_flat("rag", (0.85, 0.2, 0.25), rough=0.9))
    c = rg.constraints.new("COPY_LOCATION"); c.target = larry.rig; c.subtarget = "RightHand"; c.head_tail = 0.6
    face(larry, 1, LOVESTRUCK)
    look_at(larry, (0.2, 0.55, 0.85), 0.8)
    glint = mat_flat("glint", (1, 1, 1), emit=(1, 0.95, 0.8), emit_strength=30)
    for i, (x, z, f0) in enumerate(((0.05, 1.03, 6), (0.36, 0.9, 14), (-0.05, 0.5, 22))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012, location=(x, 0.36, z))
        g = bpy.context.object; g.data.materials.append(glint)
        key_scale(g, 1, 0.01); key_scale(g, f0, 0.01); key_scale(g, f0 + 3, 1.6); key_scale(g, f0 + 7, 0.01)
    cam = Cam(lens=32, loc=(0.2, -1.5, 1.2), target=(0.45, 0.5, 1.0))
    cam.key(1, loc=(0.15, -1.55, 1.2))
    cam.key(n, loc=(0.3, -1.25, 1.15))
    return n


@shot
def sh04():
    """and every day, he asks you the same thing - the office: you typing; Larry walks up carrying the chair."""
    n = frames_of("sh04")
    piv, sz = office(chair_at=(0, 0.1, 0))
    you = load_char("you", (0, 0.1, 0), rot_z=180, subdiv=True)
    ep2.sit(you, sz)
    for side, dx in (("Left", 0.12), ("Right", -0.12)):
        t = empty(f"type{side}", (0, 0, 0))
        for f in range(1, n + 1, 3):
            key_loc(t, f, (dx + 0.02 * math.sin(f * 1.7 + dx * 9), 0.45, 0.82 + 0.012 * math.cos(f * 2.3 + dx * 5)))
        hand_ik(you, side, t)
    face(you, 1, DEADPAN)
    larry = load_char("larry", (-3.3, -1.25, 0), rot_z=90, subdiv=True, tag="larry")
    larry.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    chr_ = carved_chair("carry", (0, 0, 0), rot_z=90)
    larry.bake_follow(chr_, "Hips", n, offset=(0.42, 0.0, -0.72))
    for side, dy in (("Left", 0.2), ("Right", -0.2)):
        g = empty(f"grip{side}", (0, 0, 0)); g.parent = chr_; g.location = (dy, 0.2, 1.0)
        hand_ik(larry, side, g)
    face(larry, 1, CREEPY_ENJOY)
    look_at(larry, you.rig, 0.6)
    cam = Cam(lens=26, loc=(1.2, -3.0, 1.5), target=(-0.7, -0.5, 1.1))
    cam.key(1, loc=(1.2, -3.0, 1.5))
    cam.key(n, loc=(1.0, -2.75, 1.48))
    return n


@shot
def sh05():
    """Will you sit on my WOOD? - your POV: Larry presents the carved chair, heart and all, and asks."""
    n = frames_of("sh05")
    office()
    larry = load_char("larry", (-0.3, -1.2, 0), rot_z=160, subdiv=True, tag="larry")
    pose(larry, {})
    chr_ = carved_chair("present", (-0.15, -0.8, 0.3), rot_z=160)
    for side, dx in (("Left", 0.2), ("Right", -0.2)):
        g = empty(f"pgrip{side}", (0, 0, 0)); g.parent = chr_; g.location = (dx * 1.2, 0.22, 0.72)
        hand_ik(larry, side, g)
    face(larry, 1, CREEPY_ENJOY)
    syl = [(7.30, 7.38, 0.2, 0.3), (7.38, 7.52, 0.15, 0.5), (7.52, 7.68, 0.25, 0.0), (7.68, 7.82, 0.3, 0.0),
           (7.82, 7.98, 0.25, 0.0), (7.98, 8.22, 0.3, 0.6)]
    lipsync(larry, lambda t: at("sh05", t), syl, base=CREEPY_ENJOY)
    face(larry, at("sh05", 8.3), WINK)
    cam = Cam(lens=28, loc=(0.3, 0.12, 1.3), target=(-0.3, -1.2, 1.25))
    cam.key(1, loc=(0.3, 0.12, 1.3))
    cam.key(n, loc=(0.25, -0.02, 1.3))
    look_at(larry, cam.cam, 0.85)
    return n


@shot
def sh06():
    """So you stop sitting down. - you stand up; your office chair rolls away behind you, for good."""
    n = frames_of("sh06")
    piv, sz = office(chair_at=(0, 0.1, 0))
    you = load_char("you", (0, 0.1, 0), rot_z=180, subdiv=True)
    sit_down(you, 4, 16, n, sz, pose_from=SIT, pose_to=STAND)
    # sit_down lowered the rig to land in pose_to at f1; invert: start seated, end standing on the floor
    fc = you.rig.animation_data.action.fcurves.find("location", index=2)
    if fc:
        you.rig.animation_data.action.fcurves.remove(fc)
    sc = bpy.context.scene
    sc.frame_set(1); bpy.context.view_layer.update()
    dz = sz + 0.1 - you.world("Hips").z
    for f, z in ((1, dz), (4, dz), (16, 0.0), (n, 0.0)):
        key_loc(you.rig, f, (0, 0.1, z))
    key_loc(piv, 1, (0, 0.1, 0)); key_loc(piv, 10, (0, 0.1, 0)); key_loc(piv, n, (0.3, -1.6, 0))
    key_rot(piv, 10, (0, 0, 180)); key_rot(piv, n, (0, 0, 420))
    face(you, 1, DETERMINED)
    face(you, 18, SMUG)
    cam = Cam(lens=26, loc=(1.3, -0.35, 1.3), target=(-0.1, -0.1, 0.95))
    cam.key(1, loc=(1.3, -0.35, 1.3))
    cam.key(n, loc=(1.25, -0.6, 1.35))
    return n


@shot
def sh07():
    """GENIUS! - low hero angle: you, standing tall, hands on hips."""
    n = frames_of("sh07")
    office()
    you = load_char("you", (0, -0.2, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    cam = Cam(lens=24, loc=(0.35, -1.25, 0.45), target=(0.0, -0.2, 1.4))
    cam.key(1, loc=(0.35, -1.25, 0.45))
    cam.key(n, loc=(0.3, -1.1, 0.5))
    look_at(you, cam.cam, 0.5)
    return n


@shot
def sh08():
    """But Larry carves you a wooden standing desk... - Larry whips the sheet off: a tall oak desk with a plaque."""
    n = frames_of("sh08")
    office()
    standing_desk((0, -0.3, 0))
    you = load_char("you", (0, -0.95, 0), rot_z=180, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, UNEASY)
    larry = load_char("larry", (-0.95, -0.5, 0), rot_z=102, subdiv=True, tag="larry")
    pose(larry, {})
    # the sheet: a draped cloth that flies up and off to Larry's side
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=20, y_subdivisions=20, size=1.0, location=(0, -0.3, 1.12))
    sh = bpy.context.object; sh.name = "sheet"; sh.scale = (1.5, 0.9, 1)
    tx = bpy.data.textures.new("sheetfold", "CLOUDS"); tx.noise_scale = 0.15
    dm = sh.modifiers.new("f", "DISPLACE"); dm.texture = tx; dm.strength = 0.08
    sd = sh.modifiers.new("s", "SUBSURF"); sd.levels = 1; sd.render_levels = 2
    sh.modifiers.new("t", "SOLIDIFY").thickness = 0.01
    skirt = box("sheet_skirt", (1.3, 0.7, 1.05), (0, -0.3, 0.55), mat_flat("sheetm", (0.92, 0.92, 0.9), rough=0.9))
    sh.data.materials.append(bpy.data.materials["sheetm"]); bpy.ops.object.shade_smooth()
    pull = 8
    for o in (sh, skirt):
        key_loc(o, 1, o.location[:]); key_loc(o, pull, o.location[:])
        key_loc(o, pull + 8, (o.location.x - 1.6, o.location.y + 0.6, o.location.z + 1.4))
        key_scale(o, pull, 1.0); key_scale(o, pull + 8, 0.01)
    t = empty("pullhand", (0, 0, 0))
    key_loc(t, 1, (-0.6, -0.35, 1.15)); key_loc(t, pull, (-0.6, -0.35, 1.15)); key_loc(t, pull + 6, (-1.1, -0.1, 1.9))
    key_loc(t, n, (-1.15, -0.1, 1.85))
    hand_ik(larry, "Right", t)
    face(larry, 1, CREEPY); face(larry, pull + 2, TADA)
    cam = Cam(lens=26, loc=(1.5, -2.7, 1.45), target=(-0.3, -0.45, 1.05))
    cam.key(1, loc=(1.5, -2.7, 1.45))
    cam.key(n, loc=(1.3, -2.4, 1.45))
    return n


@shot
def sh09():
    """...WITH A SEAT. - a hidden oak seat swings round on an arm behind your knees: you drop straight onto it."""
    n = frames_of("sh09")
    office()
    standing_desk((0, -0.3, 0))
    w = oak_mat()
    arm = empty("seat_arm", (0.6, -0.6, 0.0))
    a_end = 0.76
    box("arm_bar", (a_end, 0.06, 0.05), (a_end / 2, 0, 0.66), w).parent = arm
    cylinder("arm_seat", 0.19, 0.05, (a_end, 0, 0.71), w, verts=32).parent = arm
    box("arm_post", (0.07, 0.07, 0.66), (0, 0, 0.33), w).parent = arm
    key_rot(arm, 1, (0, 0, 0)); key_rot(arm, 5, (0, 0, 0)); key_rot(arm, 13, (0, 0, -142))
    you = load_char("you", (0, -0.95, 0), rot_z=180, subdiv=True)
    sit_down(you, 12, 17, n, 0.71, pose_from=STAND, pose_to=SIT_HIGH)
    face(you, 1, UNEASY); face(you, 13, SHOCK)
    cam = Cam(lens=26, loc=(2.0, -2.0, 1.3), target=(0.2, -0.7, 0.9))
    cam.key(1, loc=(2.0, -2.0, 1.3))
    cam.key(n, loc=(1.85, -1.8, 1.25))
    cam.shake(16, 21, amp=0.015, freq=0.7)
    return n


def bag_scene(n, slouched=True):
    office()
    bb = beanbag((0, -0.12, 0.27))
    bb.scale = (1.0, 0.95, 0.55)
    you = load_char("you", (0, -0.6, 0), rot_z=0, subdiv=True)
    return bb, you


@shot
def sh10():
    """So you buy a bean bag. - you fall backwards into a big red bean bag. Flump."""
    n = frames_of("sh10")
    bb, you = bag_scene(n)
    sit_down(you, 6, 18, n, 0.26, pose_from=STAND, pose_to=SLOUCH, dy=0.2)
    for f, sc_ in ((1, (1.0, 0.95, 0.55)), (17, (1.0, 0.95, 0.55)), (20, (1.1, 1.05, 0.44)), (26, (1.02, 0.97, 0.5))):
        bb.scale = sc_; bb.keyframe_insert("scale", frame=f)
    face(you, 1, SMILE); face(you, 19, SERENE)
    cam = Cam(lens=26, loc=(0.7, -2.6, 1.2), target=(0.0, -0.3, 0.75))
    cam.key(1, loc=(0.7, -2.6, 1.2))
    cam.key(n, loc=(0.6, -2.25, 1.1))
    return n


def slouched(n, burst=None):
    bb, you = bag_scene(n)
    you.rig.location.y += 0.2
    pose(you, SLOUCH)
    settle(you, "Hips", 0.36)
    return bb, you


@shot
def sh11():
    """CLEVER! - you sink in, hands behind your head. Bliss."""
    n = frames_of("sh11")
    bb, you = slouched(n)
    face(you, 1, SMUG)
    cam = Cam(lens=30, loc=(0.4, -2.2, 1.3), target=(0.0, -0.3, 0.65))
    cam.key(1, loc=(0.4, -2.2, 1.3))
    cam.key(n, loc=(0.35, -2.0, 1.25))
    return n


@shot
def sh12():
    """But the beans are WOOD CHIPS. - the bag splits; a fountain of wood chips; you sink to the floor."""
    n = frames_of("sh12")
    bb, you = slouched(n)
    burst = 10
    for f, sc_ in ((1, (1.02, 0.97, 0.5)), (burst, (1.02, 0.97, 0.5)), (burst + 14, (1.3, 1.25, 0.16))):
        bb.scale = sc_; bb.keyframe_insert("scale", frame=f)
    z0 = you.rig.location.z
    key_loc(you.rig, burst, (0, -0.4, z0)); key_loc(you.rig, burst + 14, (0, -0.4, z0 - 0.2))
    wood_chips("chip", (0.0, -0.12, 0.3), 140, burst, burst + 12, spread=1.0)
    face(you, 1, SMUG); face(you, burst + 2, SHOCK)
    cam = Cam(lens=28, loc=(0.4, -2.2, 1.05), target=(0.0, -0.35, 0.55))
    cam.key(1, loc=(0.4, -2.2, 1.05))
    cam.key(n, loc=(0.35, -2.0, 1.0))
    cam.shake(burst, burst + 6, amp=0.02, freq=0.8)
    return n


@shot
def sh13():
    """LARRY'S WOOD CHIPS. - Larry rises over the cubicle wall hugging a sack of them. Wink."""
    n = frames_of("sh13")
    bb, you = slouched(n)
    bb.scale = (1.3, 1.25, 0.16)
    you.rig.location.z -= 0.2
    wood_chips("chip", (0.0, -0.12, 0.3), 140, 1, 2, spread=1.0, static=True)
    face(you, 1, SHOCK)
    larry = load_char("larry", (0.1, 1.45, 0), rot_z=0, subdiv=True, tag="larry")
    pose(larry, {})
    key_loc(larry.rig, 1, (0.1, 1.45, -0.7)); key_loc(larry.rig, int(n * 0.55), (0.1, 1.45, 0.14))
    key_loc(larry.rig, n, (0.1, 1.45, 0.18))
    sk = sack("lsack")
    c = sk.constraints.new("COPY_LOCATION"); c.target = larry.rig; c.subtarget = "Spine1"; c.use_offset = True
    sk.location = (0.34, -0.22, 0.22)          # held up beside his grinning face
    for side, dx in (("Left", 0.2), ("Right", -0.2)):
        g = empty(f"sackgrip{side}", (0, 0, 0)); g.parent = sk; g.location = (dx, -0.05, 0.05)
        hand_ik(larry, side, g)
    face(larry, 1, CREEPY_ENJOY); face(larry, n - 8, WINK)
    cam = Cam(lens=30, loc=(0.35, -2.1, 1.3), target=(0.1, 0.7, 1.15))
    cam.key(1, loc=(0.35, -2.1, 1.3))
    cam.key(n, loc=(0.3, -1.85, 1.33))
    look_at(larry, cam.cam, 0.7)
    return n


def bus_arrival(n, f_stop, x_stop=-2.8):
    ep2.street_set()
    bus = ep2.bus_exterior((x_stop - 22, 0.6, 0))
    key_loc(bus, 1, (x_stop - 22, 0.6, 0)); key_loc(bus, f_stop, (x_stop, 0.6, 0))
    dest = decal("bus_dest5", f"{D5}/bus_dest.png", 1.9, (5.54, 0, 2.75), rot=(90, 0, 90)); dest.parent = bus
    return bus


@shot
def sh14():
    """So you take the bus home. - golden hour bus stop: you wait; the bus glides in and stops."""
    n = frames_of("sh14")
    bus_arrival(n, n - 4)
    you = load_char("you", (1.0, -1.7, 0.08), rot_z=180, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, SMILE)
    cam = Cam(lens=26, loc=(3.6, -6.2, 1.5), target=(0.6, -0.5, 1.3))
    cam.key(1, loc=(3.6, -6.2, 1.5))
    cam.key(n, loc=(3.2, -5.6, 1.45))
    return n


@shot
def sh15():
    """PERFECT! - you, smug, the bus doors right behind you."""
    n = frames_of("sh15")
    bus_arrival(n, 1)
    you = load_char("you", (1.0, -1.7, 0.08), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SMUG)
    cam = Cam(lens=26, loc=(1.45, -3.3, 0.7), target=(1.0, -1.6, 1.45))
    cam.key(1, loc=(1.45, -3.3, 0.7))
    cam.key(n, loc=(1.35, -3.1, 0.75))
    look_at(you, cam.cam, 0.5)
    return n


@shot
def sh16():
    """But every seat on the bus is made of oak, - down the aisle: rows of carved oak seats, a heart on every one."""
    n = frames_of("sh16")
    bus_interior_oak()
    you = load_char("you", (0.05, 1.55, 0), rot_z=180, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    hand_ik(you, "Right", empty("polegrip", (0.39, 1.95, 1.4)))
    face(you, 1, SHOCK)
    cam = Cam(lens=26, loc=(0.0, 4.4, 1.65), target=(0.0, -2.0, 1.0))
    cam.key(1, loc=(0.25, 4.4, 1.7), target=(-0.2, -2.0, 1.0))
    cam.key(n, loc=(-0.1, 4.1, 1.62), target=(0.0, -2.0, 1.05))
    return n


@shot
def sh17():
    """and the driver... is DALE. - over the wheel: Dale, in a driver's cap, turns slowly to the lens. Wink."""
    n = frames_of("sh17")
    bus_interior_oak()
    dale = dale_driver(n)
    cam = Cam(lens=34, loc=(0.15, -5.25, 1.55), target=(-0.75, -4.3, 1.5))
    cam.key(1, loc=(0.15, -5.25, 1.55))
    cam.key(n, loc=(0.05, -5.12, 1.55))
    stare_at(dale, cam.cam, at("sh17", 27.0), at("sh17", 27.6))
    face(dale, 1, DEADPAN); face(dale, at("sh17", 27.7), CREEPY_ENJOY)
    face(dale, n - 5, WINK)
    return n


def rocket(name="rocket"):
    """White launcher: core stage, two boosters, nose cone, fins, NO SEATS down the side. Origin at the base."""
    root = empty(name)
    white = mat_flat("rkwhite", (0.92, 0.92, 0.9), rough=0.4)
    dark = mat_flat("rkdark", (0.08, 0.08, 0.1), rough=0.5)
    parts = [cylinder(f"{name}_core", 1.6, 26, (0, 0, 13.5), white, verts=48)]
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=1.6, radius2=0.05, depth=5.0, location=(0, 0, 29.0))
    cone = bpy.context.object; cone.data.materials.append(white); bpy.ops.object.shade_smooth(); parts.append(cone)
    for z in (6, 18, 26.4):
        parts.append(cylinder(f"{name}_band{z}", 1.62, 0.6, (0, 0, z), dark, verts=48))
    for x in (-2.5, 2.5):
        parts.append(cylinder(f"{name}_srb{x}", 0.7, 16, (x, 0, 8.5), white, verts=32))
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.7, radius2=0.05, depth=2.0, location=(x, 0, 17.5))
        bc = bpy.context.object; bc.data.materials.append(white); parts.append(bc)
    for a in range(4):
        ph = math.radians(45 + a * 90)
        fin = box(f"{name}_fin{a}", (0.15, 1.8, 2.6), (math.cos(ph) * 2.3, math.sin(ph) * 2.3, 1.6), dark,
                  rot=(0, 0, math.degrees(ph) - 90))
        parts.append(fin)
    for p in parts:
        p.parent = root
    d = decal(f"{name}_txt", f"{D5}/rocket_text.png", 2.0, (0, -1.62, 14.0), rot=(90, 0, 0), alpha=True); d.parent = root
    flame = mat_flat("flame", (1, 0.6, 0.2), emit=(1.0, 0.6, 0.15), emit_strength=25)
    fl = []
    for x in (-2.5, 0.0, 2.5):
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.9 if x == 0 else 0.55, radius2=0.05, depth=7.0,
                                        location=(x, 0, -3.5), rotation=(math.radians(180), 0, 0))
        f = bpy.context.object; f.data.materials.append(flame); f.parent = root; f.visible_shadow = False; fl.append(f)
    return root, fl


def rocket_smoke(center, n, start=1, count=36, seed=7):
    """Launch exhaust: big soft white billows rolling out along the pad (soft-edged alpha, like ep4's soot)."""
    m = bpy.data.materials.new("exhaust"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.93, 0.92, 0.9, 1); b.inputs["Roughness"].default_value = 1.0
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.5
    a1 = nt.nodes.new("ShaderNodeMath"); a1.operation = "MULTIPLY_ADD"
    a1.inputs[1].default_value = -1.1; a1.inputs[2].default_value = 1.0; a1.use_clamp = True
    a2 = nt.nodes.new("ShaderNodeMath"); a2.operation = "POWER"; a2.inputs[1].default_value = 1.6
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 4.0
    a3 = nt.nodes.new("ShaderNodeMath"); a3.operation = "MULTIPLY"
    nt.links.new(lw.outputs["Facing"], a1.inputs[0]); nt.links.new(a1.outputs[0], a2.inputs[0])
    nt.links.new(a2.outputs[0], a3.inputs[0]); nt.links.new(nz.outputs["Fac"], a3.inputs[1])
    nt.links.new(a3.outputs[0], b.inputs["Alpha"])
    rnd = random.Random(seed)
    for i in range(count):
        a = rnd.uniform(0, 2 * math.pi)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=rnd.uniform(1.6, 3.0), location=center)
        d = bpy.context.object; d.data.materials.append(m); bpy.ops.object.shade_smooth(); d.visible_shadow = False
        t0 = start + (i % 8) * 2
        key_scale(d, 1, 0.01); key_scale(d, t0, 0.01); key_loc(d, t0, center)
        dist = rnd.uniform(6, 20)
        key_scale(d, n, rnd.uniform(1.8, 3.2))
        key_loc(d, n, (center[0] + math.cos(a) * dist, center[1] + math.sin(a) * dist * 0.7, center[2] + rnd.uniform(0, 5)))


@shot
def sh18():
    """So you become an astronaut. - launch pad, golden hour: ignition, smoke, and the rocket climbs."""
    n = frames_of("sh18")
    world_hdri("kloofendal_43d_clear_puresky", strength=1.1, rot_z=200)
    ep2.ground("concrete_floor_02", size=600, scale=0.05)
    sun(energy=4.0, rot=(60, 0, 130), color=(1.0, 0.9, 0.78))
    tower = mat_flat("tower", (0.65, 0.12, 0.1), metal=0.4, rough=0.5)
    for z in range(0, 34, 4):
        box(f"tw_h{z}", (3.0, 3.0, 0.25), (6.5, 0, z), tower)
    for (dx, dy) in ((-1.4, -1.4), (1.4, -1.4), (-1.4, 1.4), (1.4, 1.4)):
        box(f"tw_v{dx}{dy}", (0.25, 0.25, 34), (6.5 + dx, dy, 17), tower)
    rk, flames = rocket()
    ign = 5
    for f in flames:
        key_scale(f, 1, 0.01); key_scale(f, ign, 0.01); key_scale(f, ign + 4, 1.0)
        for k in range(ign + 4, n + 1, 2):
            f.scale = (1.0, 1.0, 1.0 + 0.12 * math.sin(k * 1.7)); f.keyframe_insert("scale", frame=k)
    key_loc(rk, 1, (0, 0, 0)); key_loc(rk, ign + 6, (0, 0, 0))
    for k, z in ((ign + 16, 3.0), (ign + 26, 10.0), (n, 24.0)):
        key_loc(rk, k, (0, 0, z))
    rocket_smoke((0, 0, 1.5), n, start=ign, count=36, seed=7)
    point("ign_glow", (0, -4, 2), energy=20000, color=(1.0, 0.6, 0.25), radius=2.0)
    cam = Cam(lens=30, loc=(-30.0, -62.0, 3.0), target=(0, 0, 14.0), clip_end=4000)
    cam.key(1, loc=(-30.0, -62.0, 3.0), target=(0, 0, 14.0))
    cam.key(n, loc=(-29.0, -60.0, 3.0), target=(0, 0, 26.0))
    cam.shake(ign + 2, n, amp=0.05, freq=0.9)
    return n


@shot
def sh19():
    """Zero gravity. - inside the station: you drift in, arms loose, slowly turning."""
    n = frames_of("sh19")
    station_interior()
    you = load_char("you_astro", (0, 0, 0), subdiv=True)
    floaty(you, n, (-0.9, -0.1, 0.12), (-0.45, -0.05, 0.18), (8, 0, -25), (14, 0, -8))
    face(you, 1, SERENE)
    cam = Cam(lens=26, loc=(1.6, -0.75, 1.25), target=(-0.5, 0.0, 1.15))
    cam.key(1, loc=(1.6, -0.75, 1.25))
    cam.key(n, loc=(1.45, -0.7, 1.22))
    return n


@shot
def sh20():
    """Nobody sits in space. - you, cross-legged in mid-air, past the NO SITTING ZONE sign; Earth in the porthole."""
    n = frames_of("sh20")
    station_interior()
    you = load_char("you_astro", (0, 0, 0), subdiv=True)
    floaty(you, n, (-0.38, 0.25, -0.38), (-0.3, 0.28, -0.33), (0, 0, -8), (4, 0, 8), pose_over=LOTUS)
    face(you, 1, SERENE)
    cam = Cam(lens=18, loc=(-0.15, -0.98, 0.95), target=(-0.35, 1.1, 0.95))
    cam.key(1, loc=(-0.1, -0.98, 0.95))
    cam.key(n, loc=(-0.3, -0.95, 0.97))
    return n


@shot
def sh21():
    """MUCH BETTER! - close on your face, eyes closed, a blissful weightless smile."""
    n = frames_of("sh21")
    station_interior()
    you = load_char("you_astro", (0, 0, 0), subdiv=True)
    floaty(you, n, (-0.3, 0.28, -0.33), (-0.28, 0.29, -0.31), (2, 0, 6), (4, 0, 10), pose_over=LOTUS)
    face(you, 1, dict(SERENE, eyeBlinkLeft=0.9, eyeBlinkRight=0.9))
    bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
    hh = you.world("Head")
    cam = Cam(lens=40, loc=(hh.x + 0.1, hh.y - 0.95, hh.z + 0.12), target=(hh.x, hh.y, hh.z + 0.08))
    cam.key(1, loc=(hh.x + 0.1, hh.y - 0.95, hh.z + 0.12))
    cam.key(n, loc=(hh.x + 0.08, hh.y - 0.8, hh.z + 0.1))
    return n


def station_exterior():
    world_color((0, 0, 0), 0.0)
    stars(600, 900, seed=4)
    earth((0, 60, -470), 450)
    hull = mat_flat("hull", (0.86, 0.86, 0.84), metal=0.1, rough=0.45)
    gold = mat_flat("foil", (0.85, 0.65, 0.3), metal=0.3, rough=0.4)
    cell = mat_flat("cells", (0.12, 0.2, 0.45), metal=0.3, rough=0.3)
    root = empty("station", (0, 0, 0))
    parts = [cylinder("mod_a", 1.2, 8, (0, 0, 0), hull, rot=(0, 90, 0), verts=32),
             cylinder("mod_b", 1.0, 6, (7, 0, 0), gold, rot=(0, 90, 0), verts=32),
             cylinder("mod_c", 1.0, 5, (2.0, 0, 0), hull, rot=(90, 0, 0), verts=32),
             box("truss", (0.6, 30, 0.6), (-2.0, 0, 0.0), hull)]
    for y in (-12.5, -7.5, 7.5, 12.5):
        parts.append(box(f"wing{y}", (9.0, 4.2, 0.06), (-2.0, y, 0), cell))
    for p in parts:
        p.parent = root
    sun(energy=3.5, rot=(35, 0, 120), color=(1.0, 0.97, 0.92), shadow=False)
    return root


@shot
def sh22():
    """Peace at last. - outside: the station glides silently over Earth."""
    n = frames_of("sh22")
    st = station_exterior()
    key_rot(st, 1, (8, 0, -15), interp="LINEAR"); key_rot(st, n, (8, 0, -9), interp="LINEAR")
    cam = Cam(lens=30, loc=(16, -24, 9), target=(0, 0, -2), clip_end=4000)
    cam.key(1, loc=(16, -24, 9), target=(0, 0, -2))
    cam.key(n, loc=(13, -25, 8.5), target=(0, 0, -2))
    return n


@shot
def sh23():
    """But then... there's a knock on the airlock. - the hatch thuds three times; you spin round, wide-eyed."""
    n = frames_of("sh23")
    hinge = station_interior(earth_in_window=False)
    knocks = [at("sh23", 36.7), at("sh23", 36.95), at("sh23", 37.2)]
    for f in knocks:
        key_rot(hinge, f - 1, (0, 0, 0)); key_rot(hinge, f, (0, 0, -1.2)); key_rot(hinge, f + 2, (0, 0, 0))
    you = load_char("you_astro", (0, 0, 0), subdiv=True)
    floaty(you, n, (1.0, -0.2, -0.2), (1.05, -0.2, -0.18), (0, 0, -66), (0, 0, -66), pose_over=LOTUS)
    rf = you.rig.animation_data.action.fcurves.find("rotation_euler", index=2)
    if rf:
        you.rig.animation_data.action.fcurves.remove(rf)
    for f, rz in ((1, -66), (knocks[0] + 2, -66), (knocks[0] + 14, 80), (n, 84)):     # spins round to the hatch
        you.rig.rotation_euler = (0, 0, math.radians(rz)); you.rig.keyframe_insert("rotation_euler", index=2, frame=f)
    face(you, 1, SERENE); face(you, knocks[0] + 1, SHOCK)
    cam = Cam(lens=26, loc=(-1.0, -0.6, 1.25), target=(3.8, 0.0, 1.15))
    cam.key(1, loc=(-1.0, -0.6, 1.25))
    cam.key(n, loc=(-0.4, -0.5, 1.22))
    for f in knocks:
        cam.shake(f, f + 3, amp=0.012, freq=0.9)
    return n


def visitors(n, p_larry0, p_larry1, p_dale0, p_dale1, chair_at):
    """Larry and Dale drifting in with the rocking chair between them (both grip its crest rail). The chair rides
    just in front of them (within arm's reach); Dale keeps level with Larry."""
    p_dale0 = (p_larry0[0] + 0.05, p_dale0[1], p_larry0[2] - 0.27)       # Dale is taller: keep his head off the ceiling
    p_dale1 = (p_larry1[0] + 0.05, p_dale1[1], p_larry1[2] - 0.27)
    chair_at = ((p_larry0[0] - 0.45, 0.0, chair_at[0][2]), (p_larry1[0] - 0.45, 0.0, chair_at[1][2]))
    rc = rocking_chair("rocker", (0, 0, 0), rot_z=-90)
    key_loc(rc, 1, chair_at[0], interp="LINEAR"); key_loc(rc, n, chair_at[1], interp="LINEAR")
    key_rot(rc, 1, (0, -8, -90), interp="LINEAR"); key_rot(rc, n, (0, 6, -84), interp="LINEAR")
    out = []
    for nm, p0, p1, rz, side, gx in (("larry", p_larry0, p_larry1, -85, "Right", 0.22), ("dale", p_dale0, p_dale1, -95, "Left", -0.22)):
        ch = load_char(nm, (0, 0, 0), subdiv=True, tag=nm)
        tilt = 9 if nm == "larry" else -7
        floaty(ch, n, (p0[0], p0[1], p0[2] + 0.12), (p1[0], p1[1], p1[2] + 0.14), (tilt, 6, rz), (tilt + 5, 10, rz + 6))
        g = empty(f"crest{nm}", (0, 0, 0)); g.parent = rc; g.location = (gx, 0.2, 1.03)
        hand_ik(ch, side, g)
        face(ch, 1, CREEPY_ENJOY)
        out.append(ch)
    return rc, out


@shot
def sh24():
    """Larry and Dale float in, carrying a wooden rocking chair. - the hatch swings open: in they drift."""
    n = frames_of("sh24")
    hinge = station_interior(hatch_open=(1, 12), earth_in_window=False)
    rc, (larry, dale) = visitors(n, (5.0, -0.45, 0.25), (2.6, -0.45, 0.28), (5.3, 0.45, 0.14), (2.9, 0.45, 0.16),
                                 ((4.3, 0.0, 0.55), (1.9, 0.0, 0.6)))
    cam = Cam(lens=26, loc=(-0.6, -0.55, 1.2), target=(3.2, 0.0, 1.05))
    cam.key(1, loc=(-0.6, -0.55, 1.2))
    cam.key(n, loc=(-0.85, -0.5, 1.2))
    for ch in (larry, dale):
        stare_at(ch, cam.cam, 6, 16, 0.85)
    return n


@shot
def sh25():
    """Houston... - Larry, close, a finger to his ear like he's on the radio."""
    n = frames_of("sh25")
    station_interior(hatch_open=(1, 1), earth_in_window=False)
    bpy.data.objects["hatch_hinge"].rotation_euler = (0, 0, math.radians(-100))
    rc, (larry, dale) = visitors(n, (1.6, -0.45, 0.28), (1.5, -0.45, 0.3), (1.9, 0.45, 0.16), (1.8, 0.45, 0.18),
                                 ((0.9, 0.0, 0.6), (0.8, 0.0, 0.62)))
    hh = larry.world("Head", frame=1)
    hand_ik(larry, "Left", empty("ear", (hh.x - 0.02, hh.y - 0.13, hh.z + 0.08)))      # the free hand, at his ear
    lipsync(larry, lambda t: at("sh25", t), [(42.14, 42.27, 0.25, 0.4), (42.27, 42.42, 0.2, 0.1)], base=CREEPY_ENJOY)
    cam = Cam(lens=40, loc=(hh.x - 1.1, hh.y - 0.35, hh.z + 0.05), target=(hh.x, hh.y, hh.z + 0.05))
    cam.key(1, loc=(hh.x - 1.1, hh.y - 0.35, hh.z + 0.05))
    cam.key(n, loc=(hh.x - 0.95, hh.y - 0.3, hh.z + 0.05))
    look_at(larry, cam.cam, 0.9)
    return n


@shot
def sh26():
    """he's gonna sit on MY WOOD. - both grin at you over the rocking chair, rocking gently in zero-g. (end)"""
    n = frames_of("sh26")
    station_interior(hatch_open=(1, 1), earth_in_window=False)
    bpy.data.objects["hatch_hinge"].rotation_euler = (0, 0, math.radians(-100))
    rc, (larry, dale) = visitors(n, (1.5, -0.45, 0.3), (1.25, -0.45, 0.32), (1.8, 0.45, 0.18), (1.55, 0.45, 0.2),
                                 ((0.8, 0.0, 0.62), (0.55, 0.0, 0.64)))
    for k in range(1, n + 1, 6):                          # the empty rocker rocks for you
        rc.rotation_euler = (0, math.radians(7 * math.sin(k * 0.26)), math.radians(-90 + k * 0.05))
        rc.keyframe_insert("rotation_euler", frame=k)
    syl = [(42.94, 43.22, 0.25, 0.1), (43.22, 43.36, 0.2, 0.3), (43.36, 43.66, 0.3, 0.0), (43.66, 43.8, 0.3, 0.0),
           (43.8, 43.94, 0.25, 0.0), (43.94, 44.28, 0.3, 0.6)]
    lipsync(larry, lambda t: at("sh26", t), syl, base=CREEPY_ENJOY)
    face(larry, at("sh26", 44.5), CREEPY_ENJOY)
    face(dale, at("sh26", 44.6), WINK)
    cam = Cam(lens=24, loc=(-2.3, -0.15, 1.15), target=(1.0, 0.0, 1.2))
    cam.key(1, loc=(-2.3, -0.15, 1.15))
    cam.key(n, loc=(-1.75, -0.1, 1.15))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.85)
    return n
