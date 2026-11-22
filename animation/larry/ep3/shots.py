"""Shot definitions for Episode 3 "Larry's Meat". Same pipeline as episodes 1-2: one function per shot builds the
whole scene; ep3/render_shot.py renders it. Episode 1's office and episode 2's helpers (static poses, chairs,
on_bone, turn_around, lipsync ...) are imported and reused unchanged."""
import bpy, math, os, random, sys, importlib.util
from mathutils import Vector
import lib
from lib import (load_char, empty, mat_flat, mat_tex, box, plane, decal, cylinder, model, world_hdri, world_color,
                 sun, area, point, Cam, key_loc, key_rot, key_scale, fit, bbox, drop_to)
from cuts import CUTS

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ep2shots", os.path.join(_HERE, "..", "ep2", "shots.py"))
ep2 = importlib.util.module_from_spec(_spec)
sys.modules["ep2shots"] = ep2
_spec.loader.exec_module(ep2)
ep1 = ep2.ep1
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, STERN, SHOCK, DEADPAN, SLEEP, WINK, TADA,
                      OOF, LOVESTRUCK, SERENE, face, blink, look_at, hand_ik, src, pose, settle, sit, on_bone,
                      turn_around, stare_at, lipsync, chair, SIT)  # noqa: E402

D3 = os.path.join(lib.SCRATCH, "ep3", "decals")
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


# ============================================================================ expressions / poses
BEGGING = {"browInnerUp": 1.0, "mouthPucker": 0.4, "mouthFrownLeft": 0.35, "mouthFrownRight": 0.35,
           "eyeWideLeft": 0.5, "eyeWideRight": 0.5, "mouthPressLeft": 0.2, "mouthPressRight": 0.2}
KNEEL = {"lfemur": {"rx": -4}, "rfemur": {"rx": -4}, "ltibia": {"rx": 96}, "rtibia": {"rx": 96}}
LEAN = {"lowerback": {"rx": 22}, "upperback": {"rx": 14}, "thorax": {"rx": 10}}


def kneel(ch):
    pose(ch, KNEEL)
    knee = min(("LeftLeg", "RightLeg"), key=lambda b: ch.world(b).z)
    settle(ch, knee, 0.06)


# ============================================================================ props
def steak_mat():
    m = bpy.data.materials.get("steak")
    if m:
        return m
    m = bpy.data.materials.new("steak"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.32
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9; nz.inputs["Detail"].default_value = 8
    nz.inputs["Distortion"].default_value = 1.4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.64; ramp.color_ramp.elements[0].color = (0.36, 0.02, 0.03, 1)
    ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = (0.9, 0.72, 0.66, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    return m


def steak(name="steak", size=1.0):
    """Raw marbled ribeye, lying flat (Z up), centred on its origin. ~22 x 15 cm."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=12, radius=1.0)
    s = bpy.context.object; s.name = name
    s.scale = (0.115 * size, 0.078 * size, 0.017 * size)
    bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.get("steaknoise") or bpy.data.textures.new("steaknoise", "CLOUDS")
    tex.noise_scale = 0.08
    d = s.modifiers.new("lumps", "DISPLACE"); d.texture = tex; d.strength = 0.012 * size
    bpy.ops.object.shade_smooth()
    s.data.materials.append(steak_mat())
    lib._cube_uv(s, 6.0)
    return s


def mallet(name="mallet"):
    """Meat tenderizer: wooden handle along +Y, steel head at the far end. Origin at the grip."""
    root = empty(name, (0, 0, 0))
    wood = mat_flat("mallet_wood", (0.45, 0.26, 0.12), rough=0.5)
    steel = mat_flat("mallet_steel", (0.75, 0.76, 0.78), rough=0.25, metal=1.0)
    h = cylinder(name + "_handle", 0.016, 0.3, (0, 0.12, 0), wood, rot=(90, 0, 0), verts=12); h.parent = root
    k = box(name + "_head", (0.1, 0.055, 0.055), (0, 0.29, 0), steel, bevel=0.006); k.parent = root
    return root


def hold(ch, obj, side="Right", loc=(0.0, 0.08, 0.03), rot=(0, 0, 0)):
    """Prop glued to a hand (identity-inverse Child Of, as for the phone/wallet in episode 1)."""
    ch.attach(obj, f"{side}Hand", keep_world=False)
    obj.location = Vector(loc)
    obj.rotation_euler = [math.radians(a) for a in rot]
    return obj


def burger(name="burger"):
    """Simple burger built from primitives (Z up, origin at its centre)."""
    root = empty(name, (0, 0, 0))
    bun = mat_flat("bun", (0.78, 0.48, 0.18), rough=0.45)
    for nm, z, sc, m in (("bun_bottom", -0.025, (0.065, 0.065, 0.02), bun), ("patty", -0.004, (0.07, 0.07, 0.014),
                         mat_flat("patty", (0.2, 0.09, 0.04), rough=0.7)),
                         ("lettuce", 0.008, (0.074, 0.074, 0.006), mat_flat("lettuce", (0.3, 0.65, 0.12), rough=0.6)),
                         ("bun_top", 0.03, (0.066, 0.066, 0.035), bun)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=(0, 0, z))
        o = bpy.context.object; o.name = f"{name}_{nm}"; o.scale = sc; bpy.ops.object.shade_smooth()
        o.data.materials.append(m); o.parent = root
    return root


def burger_plate(loc):
    p = model("carved_wooden_plate", loc, rot_z=0)
    fit(p, length=0.26)
    b = model("hamburger_buns", (loc[0], loc[1], loc[2] + 0.02), rot_z=30)
    fit(b, length=0.12)
    return p, b


def bell(loc, scale=1.0):
    """Bronze temple bell hanging from its top at loc; returns the pivot (rotate X/Y to swing it)."""
    bronze = mat_flat("bronze", (0.55, 0.36, 0.14), rough=0.3, metal=1.0)
    piv = empty("bell_pivot", loc)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.36 * scale, radius2=0.2 * scale, depth=0.62 * scale,
                                    location=(0, 0, -0.38 * scale))
    c = bpy.context.object; c.name = "bell_body"; c.data.materials.append(bronze); bpy.ops.object.shade_smooth()
    s = c.modifiers.new("shell", "SOLIDIFY"); s.thickness = 0.03 * scale
    c.parent = piv
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2 * scale, location=(0, 0, -0.07 * scale))
    t = bpy.context.object; t.name = "bell_crown"; t.scale = (1, 1, 0.55); t.data.materials.append(bronze)
    bpy.ops.object.shade_smooth(); t.parent = piv
    bpy.ops.mesh.primitive_torus_add(major_radius=0.36 * scale, minor_radius=0.025 * scale, location=(0, 0, -0.69 * scale))
    r = bpy.context.object; r.name = "bell_lip"; r.data.materials.append(bronze); r.parent = piv
    return piv


def coffin(loc, lid_open_frames=None, lid_open=False):
    """Polished wooden coffin, long axis along Y (head end +Y), satin lining. Lid hinged on the +X long edge."""
    wood = mat_flat("coffin_wood", (0.22, 0.09, 0.04), rough=0.18)
    satin = mat_flat("satin", (0.95, 0.93, 0.9), rough=0.45)
    brass = mat_flat("coffin_brass", (0.85, 0.66, 0.3), rough=0.25, metal=1.0)
    root = empty("coffin", loc)
    L, W, H = 2.05, 0.7, 0.42
    parts = [box("cf_bottom", (W, L, 0.05), (0, 0, 0.025), wood),
             box("cf_side_l", (0.05, L, H), (-W / 2, 0, H / 2), wood, bevel=0.01),
             box("cf_side_r", (0.05, L, H), (W / 2, 0, H / 2), wood, bevel=0.01),
             box("cf_head", (W, 0.05, H), (0, L / 2, H / 2), wood, bevel=0.01),
             box("cf_foot", (W, 0.05, H), (0, -L / 2, H / 2), wood, bevel=0.01),
             box("cf_lining", (W - 0.1, L - 0.1, 0.06), (0, 0, 0.08), satin, bevel=0.03)]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0, L / 2 - 0.25, 0.16))
    pil = bpy.context.object; pil.name = "cf_pillow"; pil.scale = (1.2, 0.6, 0.35); pil.data.materials.append(satin)
    bpy.ops.object.shade_smooth(); parts.append(pil)
    for x in (-W / 2 - 0.03, W / 2 + 0.03):
        parts.append(cylinder(f"cf_rail{x}", 0.015, L * 0.8, (x, 0, H * 0.55), brass, rot=(90, 0, 0), verts=10))
    for p in parts:
        p.parent = root
    hinge = empty("cf_hinge", (W / 2, 0, H)); hinge.parent = root
    lid = box("cf_lid", (W + 0.04, L + 0.04, 0.06), (-W / 2, 0, 0.03), wood, bevel=0.015); lid.parent = hinge
    if lid_open_frames:
        f0, f1 = lid_open_frames
        key_rot(hinge, 1, (0, 0, 0)); key_rot(hinge, f0, (0, 0, 0)); key_rot(hinge, f1, (0, 105, 0))
    elif lid_open:
        hinge.rotation_euler = (0, math.radians(105), 0)
    # stand under the coffin
    stand = box("cf_stand", (W * 0.8, L * 0.85, 0.75), (0, 0, -0.375), mat_flat("drape", (0.08, 0.05, 0.07), rough=0.9))
    stand.parent = root
    return root, H


def you_in_coffin(cx, cy, cz, eyes="closed", subdiv=True):
    """You lying in the coffin (head toward +Y), hands folded on your chest. cz = top of the lining."""
    you = load_char("you", (0, 0, 0), subdiv=subdiv)
    you.hold("137_41", 2800)
    you.rig.rotation_euler = (math.radians(-90), 0, 0)
    you.rig.location = (cx, cy - 0.92, cz + 0.13)
    for side, dx in (("Left", 0.05), ("Right", -0.05)):
        hand_ik(you, side, empty(f"fold{side}", (cx + dx, cy + 0.2, cz + 0.27)))
    face(you, 1, SLEEP if eyes == "closed" else DEADPAN)
    return you


# ============================================================================ SETS
def office_lunch_set():
    """Episode 1's office, plus a small lunch table in the open floor."""
    ep1.office_set()
    t = model("WoodenTable_01", (0.0, -1.2, 0), rot_z=0)
    fit(t, height=0.74)
    mn, mx = bbox(t)
    return mx.z


def hr_set():
    world_color((0.55, 0.57, 0.6), 0.45)
    plane("floor", (14, 14), (0, 0, 0), mat_tex("hrfloor", "dirty_carpet", scale=1.0, tint=(0.55, 0.58, 0.68)), uv_scale=0.5)
    wall = mat_tex("hrwall", "painted_plaster_wall", scale=1.0, tint=(0.9, 0.92, 0.95))
    box("w_back", (14, 0.2, 3.0), (0, 2.4, 1.5), wall, uv_scale=0.4)
    box("w_left", (0.2, 14, 3.0), (-3.2, 0, 1.5), wall, uv_scale=0.4)
    plane("ceil", (14, 14), (0, 0, 3.0), mat_flat("hrceil", (0.9, 0.9, 0.9)), rot=(180, 0, 0))
    decal("sign_hr", f"{D3}/sign_hr.png", 2.4, (0, 2.29, 2.2), rot=(90, 0, 0))
    model("metal_office_desk", (0, 1.0, 0), rot_z=180)
    decal("np_hr", f"{D3}/nameplate_hr.png", 0.42, (0.35, 0.72, 0.84), rot=(78, 0, 0))
    box("np_base", (0.44, 0.06, 0.03), (0.35, 0.73, 0.775), mat_flat("npb", (0.15, 0.15, 0.17)))
    decal("form", f"{D3}/form_complaint.png", 0.2, (-0.2, 0.75, 0.772), rot=(0, 0, 8))
    box("cabinet", (0.5, 0.6, 1.3), (-2.5, 1.9, 0.65), mat_flat("cab", (0.55, 0.57, 0.6), metal=0.4, rough=0.4), bevel=0.01)
    model("potted_plant_02", (2.2, 1.9, 0), scale=1.2)
    panel = mat_flat("hrpanel", (1, 1, 1), emit=(1.0, 0.98, 0.95), emit_strength=5)
    for x in (-1.2, 1.2):
        plane(f"hrlp{x}", (1.2, 0.6), (x, 0.8, 2.98), panel, rot=(180, 0, 0))
    sun(energy=2.2, rot=(55, 0, 160), color=(1.0, 0.96, 0.9))
    area("fill", (0.5, -3.5, 2.5), (0, 1.0, 1.2), energy=600, size=3.5, color=(1.0, 0.97, 0.94))
    area("top", (0, 0.5, 2.9), (0, 0.5, 0), energy=350, size=4)


def hr_lady(n, seated=True):
    piv, sz = chair((0, 1.55, 0), rot_z=0, seat_h=0.5)
    hr = load_char("hr", (0, 1.5, 0), rot_z=0, subdiv=True)
    if seated:
        sit(hr, sz)
    else:
        hr.clip("137_41", **src(n, 1000))
    return hr


def vegan_set():
    world_color((0.62, 0.66, 0.6), 0.5)
    plane("floor", (16, 16), (0, 0, 0), mat_tex("vfloor", "wood_floor", scale=1.0, tint=(1.0, 0.95, 0.85)), uv_scale=0.5)
    wall = mat_tex("vwall", "painted_plaster_wall", scale=1.0, tint=(0.82, 0.95, 0.8))
    box("w_back", (16, 0.2, 3.2), (0, 3.0, 1.6), wall, uv_scale=0.4)
    box("w_left", (0.2, 16, 3.2), (-4.0, 0, 1.6), wall, uv_scale=0.4)
    plane("ceil", (16, 16), (0, 0, 3.2), mat_flat("vceil", (0.95, 0.95, 0.92)), rot=(180, 0, 0))
    decal("sign_vegan", f"{D3}/sign_vegan.png", 3.0, (0, 2.89, 2.45), rot=(90, 0, 0))
    decal("nomeat", f"{D3}/sign_nomeat.png", 0.7, (-1.9, 2.89, 1.7), rot=(90, 0, 0), alpha=True)
    # salad bar: counter along X in front of the back wall
    top = mat_flat("counter_top", (0.92, 0.92, 0.9), rough=0.3)
    box("bar_base", (3.2, 0.7, 0.85), (0.3, 1.9, 0.425), mat_tex("barwood", "wood_floor", scale=1.0, tint=(0.7, 0.5, 0.3)))
    box("bar_top", (3.3, 0.8, 0.05), (0.3, 1.9, 0.875), top)
    decal("bar_label", f"{D3}/label_saladbar.png", 1.1, (0.3, 1.49, 0.62), rot=(90, 0, 0))
    greens = [mat_flat(f"leaf{i}", c, rough=0.6) for i, c in
              enumerate(((0.2, 0.55, 0.12), (0.35, 0.65, 0.15), (0.6, 0.12, 0.08), (0.9, 0.45, 0.05), (0.85, 0.8, 0.2)))]
    tex = bpy.data.textures.new("leafnz", "CLOUDS"); tex.noise_scale = 0.05
    rnd = random.Random(5)
    for i, x in enumerate((-1.0, -0.45, 0.1, 0.65, 1.2, 1.7)):
        bw = model("wooden_bowl_01", (x, 1.85, 0.9), rot_z=rnd.uniform(0, 90))
        fit(bw, length=0.38, ground=False)
        drop_to(bw, 0.9)
        for k in range(5):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rnd.uniform(0.05, 0.08),
                                                  location=(x + rnd.uniform(-0.08, 0.08), 1.85 + rnd.uniform(-0.08, 0.08), 0.98))
            g = bpy.context.object; dd = g.modifiers.new("d", "DISPLACE"); dd.texture = tex; dd.strength = 0.03
            bpy.ops.object.shade_smooth(); g.data.materials.append(greens[i % len(greens)])
    model("potted_plant_02", (2.6, 2.6, 0), scale=1.3)
    model("potted_plant_01", (-3.3, 2.4, 0), scale=1.2)
    t = model("WoodenTable_02", (-1.8, -0.4, 0)); fit(t, height=0.74)
    sun(energy=2.6, rot=(55, 0, 140), color=(1.0, 0.97, 0.9))
    area("fill", (0.5, -3.5, 2.6), (0, 1.5, 1.2), energy=650, size=4, color=(1.0, 0.98, 0.94))
    area("top", (0, 1.0, 3.1), (0, 1.0, 0), energy=300, size=4)


def salad_bowl():
    root = empty("mybowl", (0, 0, 0))
    bw = model("wooden_bowl_02", (0, 0, 0)); fit(bw, length=0.22, ground=False); bw.parent = root
    m = mat_flat("mysalad", (0.25, 0.6, 0.12), rough=0.6)
    for k in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.045, location=(0.03 * math.cos(k * 1.6), 0.03 * math.sin(k * 1.6), 0.05))
        g = bpy.context.object; g.data.materials.append(m); bpy.ops.object.shade_smooth(); g.parent = root
    return root


def monastery_set(bell_swing=None):
    """Mountain-top monastery terrace: stone floor and parapet, prayer flags, plaque, bell in a timber frame at x=-1.6."""
    world_hdri("fouriesburg_mountain_lookout", strength=1.0, rot_z=60)
    stone = mat_tex("mstone", "castle_wall_slates", scale=1.0, tint=(0.95, 0.92, 0.88))
    plane("terrace", (12, 12), (0, 0, 0), mat_tex("mfloor", "brick_floor", scale=1.0, tint=(0.85, 0.8, 0.72)), uv_scale=0.5)
    box("parapet_f", (12, 0.35, 0.9), (0, -4.0, 0.45), stone, uv_scale=0.8)
    box("parapet_l", (0.35, 8, 0.9), (-5.0, 0, 0.45), stone, uv_scale=0.8)
    box("parapet_r", (0.35, 8, 0.9), (5.0, 0, 0.45), stone, uv_scale=0.8)
    box("temple_wall", (10, 0.4, 3.4), (0, 3.6, 1.7), stone, uv_scale=0.6)
    roof = mat_flat("mroof", (0.45, 0.12, 0.08), rough=0.6)
    box("temple_roof", (10.8, 2.0, 0.18), (0, 3.2, 3.55), roof, rot=(-18, 0, 0))
    door = mat_flat("mdoor", (0.5, 0.12, 0.06), rough=0.5)
    box("temple_door", (1.4, 0.1, 2.3), (0.8, 3.38, 1.15), door, bevel=0.02)
    decal("plaque", f"{D3}/sign_monastery.png", 2.2, (0.8, 3.37, 2.75), rot=(90, 0, 0))
    # prayer flags on strings between poles
    cols = [(0.1, 0.3, 0.85), (0.95, 0.95, 0.95), (0.85, 0.1, 0.1), (0.1, 0.65, 0.2), (0.95, 0.8, 0.1)]
    fmats = [mat_flat(f"flag{i}", c, rough=0.8) for i, c in enumerate(cols)]
    pole = mat_flat("mpole", (0.35, 0.22, 0.12))
    for (xa, ya), (xb, yb) in (((-4.6, -3.6), (4.6, -3.6)), ((-4.6, -3.6), (-4.6, 3.2))):
        L = math.hypot(xb - xa, yb - ya); nflags = int(L / 0.45)
        for k in range(nflags):
            t = (k + 0.5) / nflags
            x, y = xa + (xb - xa) * t, ya + (yb - ya) * t
            z = 3.0 - 0.6 * math.sin(math.pi * t)
            ang = math.degrees(math.atan2(yb - ya, xb - xa))
            plane(f"flag{k}_{xa}{yb}", (0.3, 0.38), (x, y, z - 0.2), fmats[k % 5], rot=(90, 0, ang))
    for x, y in ((-4.6, -3.6), (4.6, -3.6), (-4.6, 3.2)):
        cylinder(f"fpole{x}{y}", 0.05, 3.2, (x, y, 1.6), pole)
    # bell frame (posts + beam + small roof)
    timber = mat_flat("timber", (0.32, 0.18, 0.08), rough=0.6)
    bx, by = -1.6, 1.2
    for dx in (-0.75, 0.75):
        box(f"bpost{dx}", (0.18, 0.18, 2.9), (bx + dx, by, 1.45), timber)
    box("bbeam", (1.8, 0.22, 0.22), (bx, by, 2.85), timber)
    box("broof", (2.3, 1.2, 0.1), (bx, by, 3.15), roof)
    piv = bell((bx, by, 2.74))
    if bell_swing:
        for f, deg in bell_swing:
            key_rot(piv, f, (deg, 0, 0))
    sun(energy=4.0, rot=(45, 0, 120), color=(1.0, 0.95, 0.85))
    return piv, (bx, by)


def butcher_set():
    world_color((0.55, 0.55, 0.55), 0.45)
    plane("floor", (14, 14), (0, 0, 0), mat_tex("bfloor", "floor_tiles_02", scale=1.0, tint=(0.9, 0.88, 0.85)), uv_scale=0.6)
    wall = mat_tex("bwall", "painted_plaster_wall", scale=1.0, tint=(0.97, 0.97, 0.95))
    box("w_back", (14, 0.2, 3.2), (0, 2.6, 1.6), wall, uv_scale=0.4)
    box("w_left", (0.2, 14, 3.2), (-3.4, 0, 1.6), wall, uv_scale=0.4)
    plane("ceil", (14, 14), (0, 0, 3.2), mat_flat("bceil", (0.92, 0.92, 0.9)), rot=(180, 0, 0))
    decal("sign_butcher", f"{D3}/sign_butcher.png", 2.6, (0, 2.49, 2.85), rot=(90, 0, 0))
    decal("prices", f"{D3}/board_prices.png", 0.9, (-2.3, 2.49, 1.6), rot=(90, 0, 0))
    # counter with a glass display front
    box("ctr_base", (3.2, 0.8, 0.9), (0.2, 0.9, 0.45), mat_flat("ctr", (0.85, 0.1, 0.12), rough=0.4))
    box("ctr_top", (3.3, 0.85, 0.05), (0.2, 0.9, 0.925), mat_flat("ctrtop", (0.9, 0.9, 0.9), rough=0.2, metal=0.3))
    board = model("wooden_cutting_board", (0.2, 0.95, 0.95), rot_z=90)
    fit(board, length=0.55, ground=False); drop_to(board, 0.95)
    # hanging steaks on a rail
    rail = mat_flat("rail", (0.8, 0.8, 0.82), metal=1.0, rough=0.2)
    cylinder("hang_rail", 0.02, 3.6, (0.2, 2.2, 2.3), rail, rot=(0, 90, 0))
    for k, x in enumerate((-1.3, -0.8, -0.3, 0.7, 1.2, 1.7)):
        s = steak(f"hang{k}", size=1.6)
        s.rotation_euler = (math.radians(90), 0, math.radians(8 * (k % 3 - 1)))
        s.location = (x, 2.2, 2.0)
        cylinder(f"hook{k}", 0.006, 0.18, (x, 2.2, 2.2), rail)
    panel = mat_flat("bpanel", (1, 1, 1), emit=(1.0, 0.98, 0.95), emit_strength=5)
    plane("blp", (2.4, 0.5), (0.2, 1.2, 3.18), panel, rot=(180, 0, 0))
    sun(energy=2.0, rot=(55, 0, 160), color=(1.0, 0.97, 0.92))
    area("fill", (0.5, -3.5, 2.6), (0, 1.0, 1.3), energy=650, size=4)
    area("top", (0.2, 0.8, 3.1), (0.2, 0.9, 0.9), energy=350, size=3)


def funeral_set():
    """Dim funeral home: dark panelling, red carpet aisle, coffin at (0, 2.2) with candles, flowers, banner, portrait."""
    world_color((0.06, 0.05, 0.05), 0.4)
    plane("floor", (16, 16), (0, 0, 0), mat_tex("ffloor", "wood_floor", scale=1.0, tint=(0.45, 0.32, 0.25)), uv_scale=0.5)
    plane("aisle", (1.4, 10), (0, -2.0, 0.004), mat_tex("carpet", "dirty_carpet", scale=1.0, tint=(0.55, 0.08, 0.08)), uv_scale=0.6)
    panel = mat_tex("fpanel", "wood_floor", scale=1.0, tint=(0.3, 0.18, 0.12))
    box("w_back", (16, 0.2, 3.6), (0, 4.0, 1.8), panel, uv_scale=0.6)
    box("w_left", (0.2, 16, 3.6), (-4.0, 0, 1.8), panel, uv_scale=0.6)
    box("w_right", (0.2, 16, 3.6), (4.0, 0, 1.8), panel, uv_scale=0.6)
    plane("ceil", (16, 16), (0, 0, 3.6), mat_flat("fceil", (0.2, 0.17, 0.15)), rot=(180, 0, 0))
    decal("banner", f"{D3}/banner_rip.png", 3.2, (0, 3.89, 2.85), rot=(90, 0, 0), alpha=True)
    # portrait on an easel to the right of the coffin
    box("easel", (0.75, 0.05, 1.0), (1.35, 2.7, 1.25), mat_flat("easelwood", (0.25, 0.14, 0.07)))
    decal("portrait", f"{D3}/portrait_memorial.png", 0.68, (1.35, 2.67, 1.28), rot=(90, 0, -12))
    for x in (-1.15, 1.15):
        c = model("brass_candleholders", (x, 2.3, 0), rot_z=0); fit(c, height=1.15)
        point(f"candle{x}", (x, 2.3, 1.25), energy=35, color=(1.0, 0.62, 0.3), radius=0.05, shadow=False)
    for i, (x, y) in enumerate(((-1.7, 3.3), (1.9, 3.3), (-0.6, 3.5), (0.7, 3.5))):
        v = model("ceramic_vase_01", (x, y, 0), rot_z=i * 40); fit(v, height=0.55)
        fm = [mat_flat(f"flw{i}{k}", c, rough=0.7) for k, c in enumerate(((0.95, 0.95, 0.95), (0.95, 0.6, 0.7), (0.9, 0.85, 0.3)))]
        rnd = random.Random(i)
        for k in range(9):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.05, 0.08),
                                                 location=(x + rnd.uniform(-0.15, 0.15), y + rnd.uniform(-0.15, 0.15), 0.62 + rnd.uniform(0, 0.25)))
            f = bpy.context.object; f.data.materials.append(fm[k % 3]); bpy.ops.object.shade_smooth()
    ch = model("WoodenChair_01", (-2.6, -0.8, 0), rot_z=180); fit(ch, height=0.95)
    for row in range(3):
        for x in (-2.6, -1.8, -1.1, 1.1, 1.8, 2.6):
            if row == 0 and x == -2.6:
                continue
            lib.model_copy(ch, (x, -0.8 - row * 1.1, ch.location.z), rot_z=180)
    area("spot", (0, 1.2, 3.5), (0, 2.2, 0.9), energy=380, size=0.9, color=(1.0, 0.85, 0.65), shadow=True)
    area("fill", (0, -4.0, 2.4), (0, 1.5, 1.0), energy=180, size=3.0, color=(0.75, 0.75, 0.95))
    area("rim", (-2.5, 3.5, 2.5), (0, 2.0, 1.0), energy=120, size=1.0, color=(1.0, 0.7, 0.45))


def coffin_scene(n, lid=None, lid_open=False, eyes="closed"):
    funeral_set()
    cf, H = coffin((0, 2.2, 0.75), lid_open_frames=lid, lid_open=lid_open)
    you = you_in_coffin(0.0, 2.2, 0.75 + 0.11, eyes=eyes)
    return cf, you


# ============================================================================ SHOTS
@shot
def sh01():
    """You just want a normal lunch break, - office, a little lunch table: you, a burger, a contented smile."""
    n = frames_of("sh01")
    tz = office_lunch_set()
    piv, sz = chair((0.0, -0.75, 0), rot_z=0, seat_h=0.47)
    you = load_char("you", (0.0, -0.78, 0), rot_z=0, subdiv=True)
    sit(you, sz)
    burger_plate((0.08, -1.3, tz))
    hold(you, burger("held_burger"), "Right", loc=(0.0, 0.09, 0.05))
    t = empty("bite", (0, 0, 0))
    key_loc(t, 1, (-0.12, -1.18, 1.0)); key_loc(t, int(n * 0.5), (-0.08, -1.0, 1.2)); key_loc(t, n, (-0.1, -1.08, 1.12))
    hand_ik(you, "Right", t)
    face(you, 1, SMILE)
    blink(you, [30])
    cam = Cam(lens=32, loc=(0.7, -2.7, 1.45), target=(0.0, -0.85, 1.05))
    cam.key(1, loc=(0.7, -2.7, 1.45))
    cam.key(n, loc=(0.55, -2.25, 1.45))
    return n


@shot
def sh02():
    """but Larry from accounting - (callback) Larry rises over his cubicle wall behind you."""
    n = frames_of("sh02")
    ep1.office_set()
    larry = load_char("larry", (1.95, 0.25, 0), rot_z=-90, subdiv=True)
    larry.clip("137_41", **src(n, 200))
    key_loc(larry.rig, 1, (1.95, 0.25, -0.75))
    key_loc(larry.rig, int(n * 0.6), (1.95, 0.25, 0.02))
    key_loc(larry.rig, n, (1.95, 0.25, 0.08))
    look_at(larry, (0.15, -0.35, 1.45), 0.9)
    face(larry, 1, CREEPY)
    cam = Cam(lens=38, loc=(0.0, -0.55, 1.42), target=(1.5, 0.25, 1.36))
    cam.key(1, loc=(0.0, -0.55, 1.42))
    cam.key(n, loc=(0.25, -0.4, 1.45))
    return n


def beg_scene(n):
    tz = office_lunch_set()
    piv, sz = chair((0.0, -0.75, 0), rot_z=0, seat_h=0.47)
    you = load_char("you", (0.0, -0.78, 0), rot_z=0, subdiv=True)
    sit(you, sz)
    burger_plate((0.08, -1.3, tz))
    larry = load_char("larry", (0.95, -0.7, 0), rot_z=-90 + 25, subdiv=True)    # kneeling at your side, facing you
    kneel(larry)
    s = steak("larry_steak")
    hold(larry, s, "Right", loc=(0.0, 0.1, 0.06), rot=(90, 0, 0))
    for side, dy in (("Right", -0.03), ("Left", 0.03)):
        hand_ik(larry, side, empty(f"beg{side}", (0.68, -0.8 + dy, 1.0)))
    return you, larry


@shot
def sh03():
    """keeps begging you - Larry on his knees beside your lunch table, steak clasped, pleading. You: deadpan."""
    n = frames_of("sh03")
    you, larry = beg_scene(n)
    face(larry, 1, BEGGING)
    look_at(larry, (0.0, -0.85, 1.25), 0.9)
    face(you, 1, DEADPAN)
    look_at(you, (0.7, -0.85, 0.9), 0.6)
    cam = Cam(lens=30, loc=(1.9, -2.3, 1.3), target=(0.45, -0.75, 0.95))
    cam.key(1, loc=(1.9, -2.3, 1.3))
    cam.key(n, loc=(1.7, -2.05, 1.27))
    return n


@shot
def sh04():
    """to BEAT HIS MEAT. - close on kneeling Larry holding the raw steak up to you, puppy eyes."""
    n = frames_of("sh04")
    you, larry = beg_scene(n)
    face(larry, 1, BEGGING)
    face(larry, n, dict(BEGGING, browInnerUp=1.0, mouthPucker=0.7))
    cam = Cam(lens=36, loc=(0.2, -1.75, 1.15), target=(0.85, -0.72, 1.0), dof=3.5)
    cam.key(1, loc=(0.2, -1.75, 1.15))
    cam.key(n, loc=(0.3, -1.6, 1.12))
    look_at(larry, cam.cam, 0.9)
    return n


@shot
def sh05():
    """So you report him to HR. - HR office: Brenda at her desk; you point back toward accounting."""
    n = frames_of("sh05")
    hr_set()
    hr = hr_lady(n)
    face(hr, 1, DEADPAN)
    you = load_char("you", (0.35, 0.05, 0), rot_z=165)
    you.clip("137_41", **src(n, 4200))
    hand_ik(you, "Right", empty("point", (0.9, -0.6, 1.4)))
    face(you, 1, DETERMINED)
    look_at(hr, (0.35, 0.05, 1.6), 0.7)
    cam = Cam(lens=28, loc=(-1.5, -1.6, 1.5), target=(0.1, 0.9, 1.15))
    cam.key(1, loc=(-1.5, -1.6, 1.5))
    cam.key(n, loc=(-1.2, -1.3, 1.5))
    return n


@shot
def sh06():
    """GENIUS! - you in the HR office, low-angle smug hero shot under the HUMAN RESOURCES sign."""
    n = frames_of("sh06")
    hr_set()
    you = load_char("you", (0.0, 0.0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, SMUG)
    look_at(you, (1.5, -3.5, 2.3), 0.7)
    cam = Cam(lens=32, loc=(0.35, -0.85, 1.05), target=(0.0, 0.0, 1.65))
    cam.key(1, loc=(0.35, -0.85, 1.05))
    cam.key(n, loc=(0.3, -0.75, 1.1))
    return n


@shot
def sh07():
    """But HR says it's just a steak - Brenda holds the steak up, completely unbothered."""
    n = frames_of("sh07")
    hr_set()
    hr = hr_lady(n)
    s = steak("hr_steak")
    hold(hr, s, "Right", loc=(0.0, 0.1, 0.05), rot=(90, 0, 0))
    hand_ik(hr, "Right", empty("show", (-0.2, 1.15, 1.3)))
    face(hr, 1, DEADPAN)
    blink(hr, [12, 40])
    cam = Cam(lens=36, loc=(0.25, -0.6, 1.35), target=(0.0, 1.45, 1.2))
    cam.key(1, loc=(0.25, -0.6, 1.35))
    cam.key(n, loc=(0.2, -0.3, 1.33))
    look_at(hr, cam.cam, 0.85)
    return n


@shot
def sh08():
    """and hands you a hammer. - insert: Brenda slides a meat tenderizer across the desk, next to the complaint form."""
    n = frames_of("sh08")
    hr_set()
    hr = hr_lady(n)
    m = mallet("hr_mallet")
    m.rotation_euler = (0, 0, math.radians(200))
    key_loc(m, 1, (0.1, 1.05, 0.79))
    key_loc(m, int(n * 0.7), (0.0, 0.62, 0.79))
    key_loc(m, n, (0.0, 0.6, 0.79))
    grip = empty("grip", (0, 0, 0)); grip.parent = m
    hand_ik(hr, "Right", grip)
    face(hr, 1, DEADPAN)
    cam = Cam(lens=40, loc=(0.0, -0.15, 1.25), target=(0.0, 0.78, 0.78), dof=4.0)
    cam.key(1, loc=(0.0, -0.15, 1.25))
    cam.key(n, loc=(0.0, -0.05, 1.18))
    return n


@shot
def sh09():
    """So you go vegan. - GREEN LEAF cafe: you at the salad bar with a bowl of greens, beaming."""
    n = frames_of("sh09")
    vegan_set()
    you = load_char("you", (0.0, 0.9, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 1000))
    b = salad_bowl()
    hold(you, b, "Right", loc=(0.0, 0.09, 0.05))
    hand_ik(you, "Right", empty("bowlpos", (-0.15, 0.6, 1.1)))
    face(you, 1, SMILE)
    cam = Cam(lens=28, loc=(0.8, -2.0, 1.5), target=(0.1, 1.2, 1.5))
    cam.key(1, loc=(0.8, -2.0, 1.5))
    cam.key(n, loc=(0.6, -1.6, 1.5))
    return n


@shot
def sh10():
    """CLEVER! - smug close-up with your salad, GREEN LEAF sign behind."""
    n = frames_of("sh10")
    vegan_set()
    you = load_char("you", (0.0, 1.0, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SMUG)
    look_at(you, (-1.5, -3.0, 2.3), 0.7)
    cam = Cam(lens=32, loc=(0.35, 0.2, 1.1), target=(0.0, 1.0, 1.7))
    cam.key(1, loc=(0.35, 0.2, 1.1))
    cam.key(n, loc=(0.3, 0.3, 1.13))
    return n


@shot
def sh11():
    """But Larry follows you into the salad bar, - you at the bar (back to us); Larry strolls in behind you."""
    n = frames_of("sh11")
    vegan_set()
    you = load_char("you", (0.6, 1.25, 0), rot_z=180)
    you.clip("137_41", **src(n, 4200))
    larry = load_char("larry", (-2.4, -1.2, 0), rot_z=130, subdiv=True)
    larry.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    s = steak("walk_steak")
    hold(larry, s, "Right", loc=(0.0, 0.1, 0.06), rot=(90, 0, 0))
    face(larry, 1, CREEPY)
    cam = Cam(lens=26, loc=(1.6, -2.6, 1.6), target=(-0.2, 0.6, 1.2))
    cam.key(1, loc=(1.6, -2.6, 1.6))
    cam.key(n, loc=(1.4, -2.2, 1.6))
    return n


@shot
def sh12():
    """HOLDING HIS MEAT. - Larry beside the salad bowls proudly holding the steak up, under the NO MEAT sign."""
    n = frames_of("sh12")
    vegan_set()
    larry = load_char("larry", (-1.0, 1.15, 0), rot_z=0, subdiv=True)
    larry.clip("137_41", **src(n, 600))
    s = steak("proud_steak", size=1.2)
    hold(larry, s, "Right", loc=(0.0, 0.11, 0.06), rot=(90, 0, 0))
    hand_ik(larry, "Right", empty("raise", (-1.25, 0.85, 1.55)))
    face(larry, 1, TADA)
    cam = Cam(lens=30, loc=(-0.55, -0.95, 1.4), target=(-1.1, 1.3, 1.45))
    cam.key(1, loc=(-0.55, -0.95, 1.4))
    cam.key(n, loc=(-0.6, -0.7, 1.4))
    look_at(larry, cam.cam, 0.8)
    return n


@shot
def sh13():
    """So you move to a monastery in the mountains. - drone shot pulling back: you at the parapet, peaks all around."""
    n = frames_of("sh13")
    monastery_set()
    you = load_char("you", (1.2, -3.35, 0), rot_z=0)
    you.clip("137_41", **src(n, 4200))
    face(you, 1, SERENE)
    cam = Cam(lens=24, loc=(2.8, -6.5, 2.4), target=(1.0, -2.5, 1.4), clip_end=5000)
    cam.key(1, loc=(2.8, -6.5, 2.4), target=(1.2, -3.0, 1.4))
    cam.key(n, loc=(4.5, -9.5, 4.8), target=(0.5, -1.0, 1.4))
    return n


@shot
def sh14():
    """PERFECT! - eyes closed, serene, mountain peaks behind."""
    n = frames_of("sh14")
    monastery_set()
    you = load_char("you", (1.2, -3.35, 0), rot_z=180, subdiv=True)
    you.clip("137_41", **src(n, 4150))
    face(you, 1, dict(SERENE, eyeBlinkLeft=1.0, eyeBlinkRight=1.0, mouthSmileLeft=0.6, mouthSmileRight=0.6))
    cam = Cam(lens=34, loc=(1.45, -2.45, 1.45), target=(1.2, -3.35, 1.62), clip_end=5000)
    cam.key(1, loc=(1.45, -2.45, 1.45))
    cam.key(n, loc=(1.42, -2.55, 1.47))
    return n


def monk(n, bx, by, rot_z=180, clip_start=4200):
    larry = load_char("larry_monk", (bx + 0.35, by - 0.75, 0), rot_z=rot_z, subdiv=True, tag="monk")
    larry.clip("137_41", **src(n, clip_start))
    return larry


@shot
def sh15():
    """But the monk ringing the bell - from behind: a bald monk in a brown robe pulls the bell rope."""
    n = frames_of("sh15")
    piv, (bx, by) = monastery_set(bell_swing=[(1, 0), (14, 6), (28, -5), (42, 4)])
    larry = monk(n, bx, by, rot_z=180)
    rope = cylinder("rope", 0.012, 1.3, (bx + 0.25, by - 0.05, 2.0), mat_flat("rope", (0.75, 0.65, 0.45), rough=0.9), verts=8)
    t = empty("rope_hand", (0, 0, 0))
    for f in range(1, n + 1, 3):
        key_loc(t, f, (bx + 0.27, by - 0.12, 1.55 - 0.12 * abs(math.sin(f * 0.18))))
    hand_ik(larry, "Right", t)
    face(larry, 1, CREEPY)
    cam = Cam(lens=30, loc=(bx + 1.2, by - 3.2, 1.6), target=(bx + 0.2, by, 1.9), clip_end=5000)
    cam.key(1, loc=(bx + 1.2, by - 3.2, 1.6))
    cam.key(n, loc=(bx + 1.0, by - 2.8, 1.6))
    return n


@shot
def sh16():
    """is LARRY, - the monk turns round: shaved head, same glasses, same moustache. Creepy grin."""
    n = frames_of("sh16")
    piv, (bx, by) = monastery_set()
    larry = monk(n, bx, by, rot_z=180)
    turn_around(larry, 1, 7)
    face(larry, 1, DEADPAN)
    face(larry, 7, CREEPY)
    cam = Cam(lens=38, loc=(bx + 0.5, by - 2.1, 1.45), target=(bx + 0.35, by - 0.75, 1.45), clip_end=5000)
    cam.key(1, loc=(bx + 0.5, by - 2.1, 1.45))
    cam.key(n, loc=(bx + 0.48, by - 1.9, 1.45))
    stare_at(larry, cam.cam, 6, 10)
    return n


def meat_bell(n, swing_from):
    """Larry swings a steak at the bell; returns (larry, bell pivot, steak, bell xy)."""
    hits = [swing_from, swing_from + 10, swing_from + 20]
    swing = [(1, 0)] + sum([[(h, 0), (h + 3, 9), (h + 7, -4)] for h in hits], [])
    piv, (bx, by) = monastery_set(bell_swing=swing)
    larry = monk(n, bx, by, rot_z=20, clip_start=600)
    larry.rig.location = (bx + 0.7, by - 0.25, 0)
    s = steak("bell_steak", size=1.3)
    hold(larry, s, "Right", loc=(0.0, 0.12, 0.05), rot=(90, 0, 0))
    t = empty("swing", (0, 0, 0))
    key_loc(t, 1, (bx + 0.75, by - 0.6, 1.5))
    for h in hits:
        key_loc(t, max(2, h - 4), (bx + 0.85, by - 0.7, 1.75))
        key_loc(t, h, (bx + 0.42, by - 0.15, 2.2), interp="LINEAR")
        key_loc(t, h + 3, (bx + 0.6, by - 0.4, 1.9))
    hand_ik(larry, "Right", t)
    return larry, piv, s, (bx, by)


@shot
def sh17():
    """and he's ringing it - wide: Larry, robe and all, swings at the bell. It swings."""
    n = frames_of("sh17")
    larry, piv, s, (bx, by) = meat_bell(n, 6)
    face(larry, 1, CREEPY_ENJOY)
    look_at(larry, (bx, by, 2.2), 0.7)
    cam = Cam(lens=26, loc=(bx + 2.8, by - 3.0, 1.7), target=(bx + 0.2, by, 1.9), clip_end=5000)
    cam.key(1, loc=(bx + 2.8, by - 3.0, 1.7))
    cam.key(n, loc=(bx + 2.5, by - 2.6, 1.75))
    return n


@shot
def sh18():
    """WITH HIS MEAT. - close: the raw steak slaps the bronze bell, Larry's blissful face beside it."""
    n = frames_of("sh18")
    larry, piv, s, (bx, by) = meat_bell(n, 4)
    face(larry, 1, CREEPY_ENJOY)
    look_at(larry, (bx, by, 2.2), 0.8)
    cam = Cam(lens=30, loc=(bx + 1.5, by - 1.5, 1.85), target=(bx + 0.45, by - 0.2, 1.85), clip_end=5000)
    cam.key(1, loc=(bx + 1.5, by - 1.5, 1.85))
    cam.key(n, loc=(bx + 1.4, by - 1.4, 1.85))
    for h in (4, 14, 24):
        cam.shake(h, h + 4, amp=0.01, freq=0.8)
    return n


def butcher_char(n, pounding=False):
    tony = load_char("butcher", (0.2, 1.55, 0), rot_z=0, subdiv=True, tag="butcher")
    tony.clip("137_41", **src(n, 4200 if not pounding else 1000))
    if pounding:
        m = mallet("tony_mallet")
        hold(tony, m, "Right", loc=(0.0, 0.07, 0.03), rot=(0, 0, 0))
        t = empty("pound", (0, 0, 0))
        for f in range(1, n + 1):
            ph = (f % 8) / 8.0
            z = 1.05 + 0.3 * (1 - abs(math.cos(math.pi * ph)))
            key_loc(t, f, (0.05, 1.05, z))
        hand_ik(tony, "Right", t)
        st = steak("board_steak", size=1.2)
        st.location = (0.2, 0.95, 0.985)
    return tony


@shot
def sh19():
    """So you hire a professional butcher - BIG TONY'S: a giant butcher in whites behind the counter."""
    n = frames_of("sh19")
    butcher_set()
    tony = butcher_char(n)
    face(tony, 1, STERN)
    cam = Cam(lens=24, loc=(0.3, -0.4, 1.15), target=(0.2, 1.6, 1.9))
    cam.key(1, loc=(0.3, -0.4, 1.15), target=(0.2, 1.6, 1.6))
    cam.key(n, loc=(0.3, -0.6, 1.2), target=(0.2, 1.6, 2.0))
    look_at(tony, cam.cam, 0.6)
    return n


@shot
def sh20():
    """to beat it for him. - Tony pounds the steak with the tenderizer; Larry watches, unimpressed."""
    n = frames_of("sh20")
    butcher_set()
    tony = butcher_char(n, pounding=True)
    face(tony, 1, DETERMINED)
    larry = load_char("larry", (1.15, 0.35, 0), rot_z=-125, subdiv=True)
    larry.clip("137_41", **src(n, 600))
    face(larry, 1, DEADPAN)
    look_at(larry, (0.2, 0.95, 1.0), 0.7)
    look_at(tony, (0.2, 0.95, 0.95), 0.7)
    cam = Cam(lens=28, loc=(-0.35, -0.55, 1.55), target=(0.45, 1.0, 1.3))
    cam.key(1, loc=(-0.35, -0.55, 1.55))
    cam.key(n, loc=(-0.25, -0.4, 1.52))
    return n


@shot
def sh21():
    """MUCH BETTER! - you in the butcher shop, smug low angle, BIG TONY'S sign behind."""
    n = frames_of("sh21")
    butcher_set()
    you = load_char("you", (-0.3, -0.2, 0), rot_z=0, subdiv=True)
    you.clip("137_41", **src(n, 4250))
    face(you, 1, dict(SMUG, mouthSmileRight=0.9))
    look_at(you, (1.5, -3.5, 2.3), 0.7)
    cam = Cam(lens=30, loc=(0.0, -1.05, 1.05), target=(-0.3, -0.2, 1.68))
    cam.key(1, loc=(0.0, -1.05, 1.05))
    cam.key(n, loc=(-0.05, -0.95, 1.1))
    return n


def larry_refuses(n):
    butcher_set()
    tony = butcher_char(n)
    face(tony, 1, DEADPAN)
    larry = load_char("larry", (0.9, 0.05, 0), rot_z=-20, subdiv=True)
    larry.clip("137_41", **src(n, 4200))
    return larry


@shot
def sh22():
    """But Larry says it only gets tender - Larry, hands on hips, shaking his head slowly."""
    n = frames_of("sh22")
    larry = larry_refuses(n)
    face(larry, 1, STERN)
    tgt = empty("shake", (0, 0, 0))
    for f in range(1, n + 1, 2):
        key_loc(tgt, f, (0.9 + 0.5 * math.sin(f * 0.35), -2.5, 1.5))
    look_at(larry, tgt, 0.8)
    cam = Cam(lens=36, loc=(0.55, -1.15, 1.45), target=(0.9, 0.05, 1.45))
    cam.key(1, loc=(0.55, -1.15, 1.45))
    cam.key(n, loc=(0.6, -0.95, 1.45))
    return n


@shot
def sh23():
    """WHEN YOU DO IT. - Larry points straight at you (the lens), lovestruck."""
    n = frames_of("sh23")
    larry = larry_refuses(n)
    cam = Cam(lens=34, loc=(0.75, -0.95, 1.45), target=(0.9, 0.05, 1.4))
    cam.key(1, loc=(0.75, -0.95, 1.45))
    cam.key(n, loc=(0.78, -0.8, 1.45))
    pt = empty("pointat", (0, 0, 0))
    key_loc(pt, 1, (1.05, -0.2, 1.1)); key_loc(pt, 6, (0.78, -0.35, 1.3)); key_loc(pt, n, (0.78, -0.37, 1.31))
    hand_ik(larry, "Right", pt)
    face(larry, 1, LOVESTRUCK)
    stare_at(larry, cam.cam, 1, 4)
    return n


@shot
def sh24():
    """So you fake your own death. - you in the coffin, hands folded... one eye pops open and winks at us."""
    n = frames_of("sh24")
    cf, you = coffin_scene(n, lid_open=True)
    wink_f = at("sh24", 35.7)
    face(you, 1, SLEEP)
    face(you, wink_f, dict(SLEEP, eyeBlinkRight=0.0, eyeWideRight=0.5, mouthSmileLeft=0.5, mouthSmileRight=0.6))
    face(you, wink_f + 12, SLEEP)
    bpy.context.scene.frame_set(1)
    yh = you.world("Head")
    cam = Cam(lens=40, loc=(-0.08, yh.y - 0.22, yh.z + 0.85), target=(0.0, yh.y + 0.04, yh.z))   # straight above the face
    cam.key(1, loc=(-0.08, yh.y - 0.22, yh.z + 0.85))
    cam.key(n, loc=(-0.07, yh.y - 0.18, yh.z + 0.72))
    return n


@shot
def sh25():
    """Peace at last. - wide, candlelit funeral home: coffin, flowers, REST IN PEACE. Slow push down the aisle."""
    n = frames_of("sh25")
    cf, you = coffin_scene(n, lid_open=True)
    cam = Cam(lens=28, loc=(0.0, -4.0, 1.6), target=(0.0, 2.2, 1.3))
    cam.key(1, loc=(0.0, -4.0, 1.6))
    cam.key(n, loc=(0.0, -3.2, 1.55))
    return n


@shot
def sh26():
    """But at your funeral, - Larry walks down the aisle toward your coffin, a steak in hand."""
    n = frames_of("sh26")
    cf, you = coffin_scene(n, lid_open=True)
    larry = load_char("larry", (0.0, -2.2, 0), rot_z=180, subdiv=True)
    larry.clip("07_01", **src(n, 60, speed=0.8, in_place=False))
    s = steak("funeral_steak")
    hold(larry, s, "Right", loc=(0.0, 0.1, 0.06), rot=(90, 0, 0))
    face(larry, 1, CREEPY)
    cam = Cam(lens=30, loc=(-0.75, 3.3, 2.0), target=(0.0, -1.2, 1.3))
    trk = cam.tgt
    larry.bake_follow(trk, "Head", n, offset=(0.0, 0.0, -0.1))
    cam.key(1, loc=(-0.75, 3.3, 2.0))
    cam.key(n, loc=(-0.7, 3.2, 1.95))
    return n


def larry_at_coffin(n, lid=None, lid_open=True, lean=False):
    cf, you = coffin_scene(n, lid=lid, lid_open=lid_open)
    larry = load_char("larry", (-0.7, 2.25, 0), rot_z=90, subdiv=True)         # at the coffin's open (-X) side, facing it
    if lean:
        pose(larry, LEAN)
    else:
        larry.clip("137_41", **src(n, 4200))
    return cf, you, larry


@shot
def sh27():
    """Larry opens the coffin, - the lid swings up; Larry gazes in, delighted."""
    n = frames_of("sh27")
    cf, you, larry = larry_at_coffin(n, lid=(3, 16), lid_open=False)
    t = empty("lidhand", (0, 0, 0))
    key_loc(t, 1, (-0.38, 2.25, 1.22)); key_loc(t, 3, (-0.38, 2.25, 1.22))
    key_loc(t, 16, (-0.35, 2.25, 1.75)); key_loc(t, n, (-0.45, 2.25, 1.55))
    hand_ik(larry, "Right", t)
    face(larry, 1, CREEPY)
    face(larry, 16, CREEPY_ENJOY)
    look_at(larry, (0.0, 2.6, 0.95), 0.8)
    cam = Cam(lens=30, loc=(0.9, 0.35, 1.55), target=(-0.15, 2.3, 1.2))
    cam.key(1, loc=(0.9, 0.35, 1.55))
    cam.key(n, loc=(0.8, 0.6, 1.55))
    return n


@shot
def sh28():
    """puts a steak in your hands, - insert: your folded hands; a raw steak is laid gently into them."""
    n = frames_of("sh28")
    cf, you, larry = larry_at_coffin(n)
    s = steak("gift_steak")
    key_loc(s, 1, (-0.25, 2.4, 1.45)); key_loc(s, int(n * 0.6), (0.0, 2.42, 1.17)); key_loc(s, n, (0.0, 2.42, 1.16))
    key_rot(s, 1, (0, -30, 10)); key_rot(s, int(n * 0.6), (0, 0, 0))
    hand_ik(larry, "Right", s)
    face(larry, 1, LOVESTRUCK)
    look_at(larry, (0.0, 2.42, 1.1), 0.9)
    cam = Cam(lens=40, loc=(0.45, 1.6, 1.65), target=(0.0, 2.42, 1.1), dof=3.0)
    cam.key(1, loc=(0.45, 1.6, 1.65))
    cam.key(n, loc=(0.42, 1.75, 1.6))
    return n


def steak_in_hands():
    s = steak("gift_steak")
    s.location = (0.0, 2.42, 1.16)
    return s


@shot
def sh29():
    """and whispers, - Larry leans deep into the coffin, his lips at your ear."""
    n = frames_of("sh29")
    cf, you, larry = larry_at_coffin(n, lean=True)
    steak_in_hands()
    face(larry, 1, LOVESTRUCK)
    look_at(larry, (0.0, 2.95, 1.0), 0.9)
    cam = Cam(lens=32, loc=(-0.35, 3.6, 1.6), target=(-0.25, 2.6, 1.2))
    cam.key(1, loc=(-0.35, 3.6, 1.6))
    cam.key(n, loc=(-0.32, 3.45, 1.55))
    return n


@shot
def sh30():
    """"Just one last time." - extreme close-up: Larry whispering it, lips nearly touching the lens."""
    n = frames_of("sh30")
    cf, you, larry = larry_at_coffin(n, lean=True)
    steak_in_hands()
    syll = [(43.30, 43.53, 0.25, 0.1), (43.66, 43.80, 0.3, 0.4), (43.80, 44.06, 0.3, 0.0), (44.06, 44.44, 0.25, 0.0)]
    face(larry, 1, LOVESTRUCK)
    lipsync(larry, lambda t: at("sh30", t), syll)
    bpy.context.scene.frame_set(1)
    h = larry.world("Head")
    cam = Cam(lens=50, loc=(h.x + 0.55, h.y - 0.45, h.z + 0.05), target=(h.x, h.y, h.z + 0.1), dof=2.0)
    cam.key(1, loc=(h.x + 0.55, h.y - 0.45, h.z + 0.05))
    cam.key(n, loc=(h.x + 0.45, h.y - 0.38, h.z + 0.05))
    stare_at(larry, cam.cam, 1, 3, influence=0.6)
    return n


@shot
def sh31():
    """(end) - your eyes snap open in horror, steak in your hands, Larry's face looming over you."""
    n = frames_of("sh31")
    cf, you, larry = larry_at_coffin(n, lean=True)
    steak_in_hands()
    snap = 4
    face(you, 1, SLEEP)
    face(you, snap, SHOCK)
    face(you, n, dict(SHOCK, jawOpen=0.5))
    face(larry, 1, CREEPY_ENJOY)
    bpy.context.scene.frame_set(1)
    yh = you.world("Head")
    cam = Cam(lens=32, loc=(-0.12, yh.y - 0.45, yh.z + 1.05), target=(-0.02, yh.y + 0.04, yh.z))   # above face + hands
    cam.key(1, loc=(-0.12, yh.y - 0.45, yh.z + 1.05))
    cam.key(snap, loc=(-0.12, yh.y - 0.43, yh.z + 1.0))
    cam.key(snap + 6, loc=(-0.08, yh.y - 0.2, yh.z + 0.72), lens=38)
    cam.key(n, loc=(-0.08, yh.y - 0.19, yh.z + 0.69), lens=39)
    cam.shake(snap, snap + 8, amp=0.01, freq=0.8)
    return n
