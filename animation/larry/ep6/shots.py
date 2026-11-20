"""Shot definitions for Episode 6 "Road Trip" (Larry and Dale follow your family car; then the forest, the gas
station and the plane). Same pipeline as episodes 1-5; episode 1-4 helpers are reused."""
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
from ep2shots import (SMILE, SMUG, CREEPY, CREEPY_ENJOY, UNEASY, DETERMINED, SHOCK, DEADPAN, WINK, TADA, SERENE,
                      SLEEP, face, blink, look_at, hand_ik, src, pose, settle, on_bone, stare_at, lipsync, SIT)  # noqa
RAGE, STERN = ep1.RAGE, ep1.STERN
pose_seq, facing = ep4.pose_seq, ep4.facing
SNIFF = ep4.SNIFF

D6 = os.path.join(lib.SCRATCH, "ep6", "decals")
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


def motion_blur(on=True, shutter=0.5):
    sc = bpy.context.scene
    sc.render.use_motion_blur = on
    sc.render.motion_blur_shutter = shutter


DRIVE = {"lfemur": {"rx": -78}, "rfemur": {"rx": -78}, "ltibia": {"rx": 58}, "rtibia": {"rx": 58},
         "lowerback": {"rx": -6}}
GRIN = dict(CREEPY_ENJOY, eyeBlinkLeft=0.0, eyeBlinkRight=0.0)


# ============================================================================ materials
def paint(name, rgb, metal=0.55, rough=0.22):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = mat_flat(name, rgb, rough=rough, metal=metal)
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in (("Coat Weight", 0.8), ("Coat Roughness", 0.04)):
        if k in b.inputs:
            b.inputs[k].default_value = v
    return m


def glass(name="carglass", alpha=0.3, tint=(0.04, 0.06, 0.09)):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = mat_flat(name, tint, rough=0.12, alpha=alpha)
    b = m.node_tree.nodes["Principled BSDF"]
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.22      # some reflection, no hard sun blob over faces
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    return m


def no_shadow(o):
    o.visible_shadow = False
    return o


def smooth(o, angle=35):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def extrude(name, pts, y0, y1, mat, bevel=0.0, seg=3, parent=None, caps=True):
    """Extrude a closed XZ polygon across Y (y0..y1). Bevel rounds every edge (car-body look). caps=False leaves the
    two Y-facing ends open (a greenhouse with its side windows rolled down)."""
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    if caps:
        bm.faces.new(a); bm.faces.new(b)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    if bevel:
        md = o.modifiers.new("bev", "BEVEL"); md.width = bevel; md.segments = seg
        md.limit_method = "ANGLE"; md.angle_limit = math.radians(25)
    smooth(o)
    if parent:
        o.parent = parent
    return o


def strut(name, p0, p1, r, mat, parent=None):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = cylinder(name, r, d.length, (p0 + p1) / 2, mat, verts=12)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    if parent:
        o.parent = parent
    return o


# ============================================================================ cars
KINDS = {
    "family": dict(L=4.3, W=1.86, belt=1.0, roof=1.6, r=0.36, wb=2.62, x_ws=0.62, rake=0.62, x_rt=-1.72, plate="plate_family"),
    "tiny": dict(L=2.55, W=1.42, belt=0.92, roof=1.5, r=0.3, wb=1.62, x_ws=0.66, rake=0.44, x_rt=-0.95, plate="plate_larry"),
    "sedan": dict(L=4.95, W=1.9, belt=0.98, roof=1.5, r=0.37, wb=2.95, x_ws=0.9, rake=0.68, x_rt=-1.45, plate="plate_black"),
}


class Car:
    """Procedural car (body tub, glass greenhouse, pillars, roof, wheels, lights, interior). Front faces +X; origin
    on the ground at the centre of the footprint. Seats: self.seat(i) -> (x, y, z_top) in car space."""

    def __init__(self, name, kind, color, interior=True, windows_down=False):
        P = dict(KINDS[kind]); self.P = P; self.name = name; self.kind = kind
        L, W, belt, roof, r, wb = P["L"], P["W"], P["belt"], P["roof"], P["r"], P["wb"]
        x_ws, rake, x_rt = P["x_ws"], P["rake"], P["x_rt"]
        self.root = root = empty(name, (0, 0, 0))
        pm = paint(f"{name}_paint", color)
        dark = mat_flat("car_dark", (0.03, 0.03, 0.035), rough=0.5)
        trim = mat_flat("car_trim", (0.08, 0.08, 0.09), rough=0.35, metal=0.3)
        chrome = mat_flat("car_chrome", (0.9, 0.9, 0.92), rough=0.35, metal=0.2, emit=(0.9, 0.9, 0.92), emit_strength=0.15)
        nose = 0.18 if kind == "tiny" else 0.12
        lower = [(-L / 2 + 0.08, 0.24), (L / 2 - 0.08, 0.24), (L / 2, 0.33), (L / 2, belt - 0.3),
                 (L / 2 - nose, belt - 0.12), (x_ws, belt), (-L / 2 + 0.12, belt), (-L / 2, belt - 0.08)]
        body = extrude(f"{name}_body", lower, -W / 2, W / 2, pm, bevel=0.11 if kind == "tiny" else 0.07, seg=5, parent=root)
        cutters = []
        for x in (-wb / 2, wb / 2):                                       # wheel arches
            c = cylinder(f"{name}_arch{x:.1f}", r + 0.06, W + 0.4, (x, 0, r), dark, rot=(90, 0, 0), verts=32)
            c.hide_render = True; c.hide_viewport = True; c.parent = root; cutters.append(c)
            md = body.modifiers.new(f"arch{x:.1f}", "BOOLEAN"); md.object = c; md.operation = "DIFFERENCE"; md.solver = "EXACT"
            liner = cylinder(f"{name}_liner{x:.1f}", r + 0.05, W - 0.62, (x, 0, r), dark, rot=(90, 0, 0), verts=32)   # stays behind the tyres
            liner.parent = root
        if interior:                                                      # hollow cabin
            cav = box(f"{name}_cavity", (x_ws - x_rt + 0.05, W - 0.14, belt), (x_rt + (x_ws - x_rt) / 2 - 0.02, 0, 0.32 + belt / 2), dark)
            cav.hide_render = True; cav.hide_viewport = True; cav.parent = root
            md = body.modifiers.new("cabin", "BOOLEAN"); md.object = cav; md.operation = "DIFFERENCE"; md.solver = "EXACT"
        body.modifiers.move(body.modifiers.find("bev"), len(body.modifiers) - 1)
        yi = W / 2 - 0.1
        gh = [(x_rt - 0.12, belt), (x_ws, belt), (x_ws - rake, roof), (x_rt, roof)]
        self.greenhouse = g = extrude(f"{name}_glass", gh, -yi, yi, glass(), parent=root, caps=not windows_down)
        no_shadow(g)
        rf = [(x_rt - 0.04, roof - 0.01), (x_ws - rake + 0.04, roof - 0.01), (x_ws - rake + 0.0, roof + 0.05), (x_rt + 0.02, roof + 0.05)]
        extrude(f"{name}_roof", rf, -yi - 0.03, yi + 0.03, pm, bevel=0.025, parent=root)
        for s in (-1, 1):
            y = s * (yi + 0.005)
            strut(f"{name}_A{s}", (x_ws, y, belt), (x_ws - rake, y, roof), 0.05, pm, root)
            strut(f"{name}_C{s}", (x_rt - 0.12, y, belt), (x_rt, y, roof), 0.08, pm, root)
            strut(f"{name}_rail{s}", (x_rt, y, roof - 0.02), (x_ws - rake, y, roof - 0.02), 0.04, pm, root)   # roof edge
            if kind != "tiny":
                xb = (x_ws + x_rt) / 2 - 0.1
                strut(f"{name}_B{s}", (xb, y, belt), (xb + 0.05, y, roof), 0.05, trim, root)
            box(f"{name}_belt{s}", (x_ws - x_rt + 0.1, 0.02, 0.03), ((x_ws + x_rt) / 2, s * (W / 2 - 0.02), belt + 0.005), trim).parent = root
            box(f"{name}_mirror{s}", (0.08, 0.16, 0.09), (x_ws - 0.06, s * (W / 2 + 0.08), belt + 0.08), pm, bevel=0.02).parent = root
            hl = cylinder(f"{name}_head{s}", 0.09 if kind != "tiny" else 0.11, 0.06, (L / 2 - 0.02, s * (W / 2 - 0.3), belt - 0.27),
                          mat_flat("headlight", (1, 1, 1), emit=(1.0, 0.97, 0.9), emit_strength=3), rot=(0, 90, 0), verts=24)
            hl.parent = root
            tl = box(f"{name}_tail{s}", (0.04, 0.26, 0.1), (-L / 2 - 0.01, s * (W / 2 - 0.22), belt - 0.16),
                     mat_flat("taillight", (0.8, 0.05, 0.05), emit=(1.0, 0.05, 0.03), emit_strength=2), bevel=0.02)
            tl.parent = root
        box(f"{name}_bumpF", (0.14, W - 0.06, 0.16), (L / 2 + 0.02, 0, 0.36), trim, bevel=0.05).parent = root
        box(f"{name}_bumpR", (0.14, W - 0.06, 0.16), (-L / 2 - 0.02, 0, 0.36), trim, bevel=0.05).parent = root
        box(f"{name}_grille", (0.03, W * 0.45, 0.14), (L / 2 + 0.005, 0, belt - 0.42), dark, bevel=0.02).parent = root
        decal(f"{name}_plateF", f"{D6}/{P['plate']}.png", 0.42, (L / 2 + 0.095, 0, 0.36), rot=(90, 0, 90)).parent = root
        decal(f"{name}_plateR", f"{D6}/{P['plate']}.png", 0.42, (-L / 2 - 0.095, 0, 0.4), rot=(90, 0, -90)).parent = root
        self.wheels = []
        tyre = mat_flat("tyre", (0.025, 0.025, 0.028), rough=0.85)
        for x in (-wb / 2, wb / 2):
            for s in (-1, 1):
                w = empty(f"{name}_wheel{x:.1f}{s}", (x, s * (W / 2 - 0.15), r)); w.parent = root
                t = cylinder(f"{name}_tyre{x:.1f}{s}", r, 0.22, (0, 0, 0), tyre, rot=(90, 0, 0), verts=32)
                md = t.modifiers.new("b", "BEVEL"); md.width = 0.05; md.segments = 3
                smooth(t); t.parent = w
                rim = cylinder(f"{name}_rim{x:.1f}{s}", r * 0.6, 0.23, (0, 0, 0), chrome, rot=(90, 0, 0), verts=24); rim.parent = w
                for k in range(5):
                    sp = box(f"{name}_spoke{x:.1f}{s}{k}", (r * 0.52, 0.02, 0.05), (0, s * 0.118, 0), dark, rot=(0, k * 72, 0))
                    sp.parent = w
                self.wheels.append(w)
        if interior:
            self.interior(P, dark)

    def interior(self, P, dark):
        name, root = self.name, self.root
        L, W, belt, roof, x_ws, rake, x_rt = P["L"], P["W"], P["belt"], P["roof"], P["x_ws"], P["rake"], P["x_rt"]
        fab = mat_flat(f"{name}_seatfab", (0.12, 0.12, 0.14), rough=0.8) if self.kind != "tiny" else \
            mat_flat("tinyseat", (0.85, 0.82, 0.75), rough=0.7)
        box(f"{name}_floor", (x_ws - x_rt, W - 0.16, 0.06), ((x_ws + x_rt) / 2, 0, 0.3), dark).parent = root
        box(f"{name}_dash", (0.42, W - 0.16, 0.24), (x_ws - 0.16, 0, belt - 0.1), dark, bevel=0.04).parent = root
        self.seats = []
        xf = x_ws - (0.95 if self.kind != "tiny" else 0.82)
        ys = (W / 2 - 0.47) if self.kind != "tiny" else 0.32
        rows = [xf] if self.kind == "tiny" else [xf, xf - 0.95]
        for xi, x in enumerate(rows):
            for s in (1, -1):
                lift = 0.16 if xi == 1 else 0.0                     # booster seats in the back for the kids
                self.seats.append((x, s * ys, 0.5 + lift))
                box(f"{name}_cush{xi}{s}", (0.5, 0.48, 0.1), (x, s * ys, 0.45), fab, bevel=0.03).parent = root
                if lift:
                    box(f"{name}_boost{s}", (0.4, 0.36, lift), (x + 0.02, s * ys, 0.5 + lift / 2),
                        mat_flat("booster", (0.15, 0.35, 0.7), rough=0.6), bevel=0.03).parent = root
                bk = box(f"{name}_back{xi}{s}", (0.1, 0.48, 0.62), (x - 0.28, s * ys, 0.8), fab, rot=(0, -10, 0), bevel=0.03)
                bk.parent = root
                if xi == 0:
                    box(f"{name}_rest{xi}{s}", (0.08, 0.24, 0.18), (x - 0.33, s * ys, 1.2), fab, bevel=0.03).parent = root
        yd = self.seats[0][1]
        wx = x_ws - 0.5
        bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.018, location=(wx, yd, 0.97),
                                         rotation=(0, math.radians(-62), 0))
        sw = bpy.context.object; sw.name = f"{name}_steer"; sw.data.materials.append(dark); sw.parent = root
        self.wheel_pos = Vector((wx, yd, 0.97))
        strut(f"{name}_column", (wx + 0.03, yd, 0.96), (x_ws - 0.25, yd, 0.82), 0.025, dark, root)
        mx, mz = x_ws - rake + 0.1, roof - 0.12
        box(f"{name}_rvm", (0.05, 0.25, 0.08), (mx, 0, mz), dark, bevel=0.015).parent = root
        mf = plane(f"{name}_rvm_face", (0.22, 0.065), (mx - 0.027, 0, mz), mat_flat("rvm_glass", (0.5, 0.55, 0.6), rough=0.05, metal=1.0),
                   rot=(90, 0, -90))
        mf.parent = root
        self.mirror = (mx, mz, mf)

    def seat_char(self, ch, i, pose_over=DRIVE, hands="wheel"):
        """Sit a character in seat i (0 front-left/driver, 1 front-right, 2 rear-left, 3 rear-right), facing +X,
        parented to the car. Call while the car root is still at the origin (before drive())."""
        x, y, ztop = self.seats[i]
        ch.rig.location = (x + 0.06, y, 0); ch.rig.rotation_euler = (0, 0, math.radians(90))
        pose(ch, pose_over)
        settle(ch, "Hips", ztop + 0.09)
        ch.rig.parent = self.root
        if hands == "wheel":
            w = self.wheel_pos
            for side, dy in (("Left", 0.15), ("Right", -0.15)):
                g = empty(f"grip{ch.name}{side}", (w.x + 0.02, w.y + dy, w.z + 0.03)); g.parent = self.root
                hand_ik(ch, side, g)
        elif hands == "lap":
            for side, dy in (("Left", 0.12), ("Right", -0.12)):
                g = empty(f"lap{ch.name}{side}", (x + 0.32, y + dy, ztop + 0.18)); g.parent = self.root
                hand_ik(ch, side, g)
        return ch

    def drive(self, keys, interp="LINEAR", n=None):
        """keys = [(frame, (x, y), yaw_deg)] or [(frame, (x, y), yaw_deg, pitch_deg)]; wheels spin with distance."""
        rt = self.root
        rt.rotation_mode = "XYZ"
        for k in keys:
            f, (x, y), yaw = k[0], k[1], k[2]
            pitch = k[3] if len(k) > 3 else 0.0
            key_loc(rt, f, (x, y, self.P["wb"] / 2 * math.sin(math.radians(pitch))), interp=interp)   # pivot ~ rear axle
            key_rot(rt, f, (0, -pitch, yaw), interp=interp)
        n = n or keys[-1][0]
        sc = bpy.context.scene
        prev, dist = None, 0.0
        for f in range(1, n + 1):
            sc.frame_set(f)
            p = rt.matrix_world.translation.copy()
            if prev is not None:
                fwd = rt.matrix_world.to_3x3() @ Vector((1, 0, 0))
                dist += (p - prev).dot(fwd)
            prev = p
            for w in self.wheels:
                w.rotation_euler = (0, dist / self.P["r"], 0); w.keyframe_insert("rotation_euler", frame=f)
        sc.frame_set(1)


def sunglasses(name):
    """Black wayfarers, modelled Z-up with the lenses facing -Y (on_bone(..., rot=(-90,0,0)) puts them on a face)."""
    root = empty(name)
    m = mat_flat("shades", (0.01, 0.01, 0.012), rough=0.06, metal=0.4)
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.03, location=(s * 0.035, 0, 0))
        l = bpy.context.object; l.name = f"{name}_lens{s}"; l.scale = (1.2, 0.32, 0.82)
        bpy.ops.object.shade_smooth(); l.data.materials.append(m); l.parent = root
        box(f"{name}_temple{s}", (0.005, 0.11, 0.007), (s * 0.07, 0.055, 0.008), m).parent = root
    box(f"{name}_bridge", (0.03, 0.008, 0.008), (0, 0, 0.01), m).parent = root
    box(f"{name}_brow", (0.15, 0.012, 0.012), (0, -0.002, 0.022), m, bevel=0.004).parent = root
    return root


def eye_point(ch):
    """World-space midpoint between the eyes, read from the eye mesh (works for any body / age)."""
    bpy.context.view_layer.update()
    eyes = [o for o in ch.meshes if "high-poly" in o.name.lower() or ".eye" in o.name.lower()]
    o = eyes[0] if eyes else ch.body
    dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    vs = [oe.matrix_world @ v.co for v in me.vertices]
    oe.to_mesh_clear()
    if not eyes:                                    # fallback: front of the head
        return ch.world("Head") + Vector((0, 0, 0.08))
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return (mn + mx) / 2


def wear_shades(ch, key=None, fwd=0.03):
    """Sunglasses placed from the real eye position (converted into Head bone space) plus a little forward."""
    g = sunglasses(f"shades_{ch.name}")
    sc = bpy.context.scene; sc.frame_set(1); bpy.context.view_layer.update()
    pb = ch.rig.pose.bones["Head"]
    M = ch.rig.matrix_world @ pb.matrix
    loc = M.inverted() @ eye_point(ch)
    on_bone(ch, g, "Head", (loc.x, loc.y, loc.z + fwd))
    return g


def glint(loc, f, parent=None, size=0.05):
    """A four-point star flash (lens glint) peaking at frame f."""
    m = mat_flat("glint", (1, 1, 1), emit=(1, 1, 0.95), emit_strength=40)
    root = empty("glint", loc)
    if parent:
        root.parent = parent
    for a in (0, 90):
        b = box(f"glintbar{a}", (size, 0.002, size * 0.08), (0, 0, 0), m, rot=(0, a, 0)); b.parent = root
        no_shadow(b)
    for k, s in ((1, 0.01), (f - 3, 0.01), (f, 1.0), (f + 4, 0.01)):
        key_scale(root, max(1, k), s)
    key_rot(root, f - 3, (0, 0, 0)); key_rot(root, f + 4, (0, 60, 0))
    return root


def cabin_light(car, energy=60):
    l = point(f"{car.name}_cabin", (car.seats[0][0] + 0.6, 0, car.P["roof"] - 0.15), energy=energy, color=(1.0, 0.95, 0.9), radius=0.3)
    l.parent = car.root
    return l


def larry_and_dale(car, shades=True, larry_hands="wheel", sd=True):
    larry = load_char("larry", (0, 0, 0), subdiv=sd, tag="larry")
    dale = load_char("dale", (0, 0, 0), subdiv=sd, tag="dale")
    car.seat_char(larry, 0, hands=larry_hands)
    car.seat_char(dale, 1, hands="lap", pose_over=dict(DRIVE, lowerneck={"rx": 10}, upperneck={"rz": -12}))
    if shades:
        wear_shades(larry); wear_shades(dale)
    return larry, dale


def family_in(car, you_hands="wheel", sd=True, kids=True):
    you = load_char("you_casual", (0, 0, 0), subdiv=sd)
    wife = load_char("wife", (0, 0, 0), subdiv=sd)
    if not kids:
        car.seat_char(you, 0, hands=you_hands); car.seat_char(wife, 1, hands="lap")
        return you, wife, None, None
    boy = load_char("kid_boy", (0, 0, 0), subdiv=sd)
    girl = load_char("kid_girl", (0, 0, 0), subdiv=sd)
    car.seat_char(you, 0, hands=you_hands)
    car.seat_char(wife, 1, hands="lap")
    car.seat_char(boy, 2, hands="lap", pose_over=SIT)
    car.seat_char(girl, 3, hands="lap", pose_over=SIT)
    return you, wife, boy, girl


# ============================================================================ the coast road
_PROTO = {}


def tree_protos():
    """Three blob-tree variants built once into hidden collections, placed with cheap collection instances."""
    if _PROTO:
        return _PROTO["cols"]
    cols = []
    for k in range(3):
        before = set(bpy.data.objects)
        ep1.blob_tree((0, 0, 0), height=5.5 + k, seed=40 + k)
        col = bpy.data.collections.new(f"treeproto{k}")
        for o in set(bpy.data.objects) - before:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            col.objects.link(o)
        cols.append(col)
    _PROTO["cols"] = cols
    return cols


def tree_at(loc, k=0, s=1.0, rz=0.0):
    e = bpy.data.objects.new("tree", None)
    e.instance_type = "COLLECTION"; e.instance_collection = tree_protos()[k % 3]
    e.location = loc; e.scale = (s, s, s); e.rotation_euler = (0, 0, rz)
    bpy.context.scene.collection.objects.link(e)
    return e


def water_mat():
    m = bpy.data.materials.get("sea")
    if m:
        return m
    m = bpy.data.materials.new("sea"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.02, 0.17, 0.26, 1); b.inputs["Roughness"].default_value = 0.06
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.6; nz.inputs["Detail"].default_value = 6
    tc = nt.nodes.new("ShaderNodeTexCoord"); nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.25
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


def coast_road(x0=-150.0, x1=950.0, trees_from=None, trees_to=None):
    """A straight two-lane coastal highway along +X. Lanes: right y=-1.8 (our direction), left y=+1.8.
    Sea and beach on the right (-Y), grassy hills and trees on the left (+Y)."""
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.05, rot_z=200)
    sun(energy=3.8, rot=(52, 0, 210), color=(1.0, 0.95, 0.88))
    L = x1 - x0; cx = (x0 + x1) / 2
    plane("road", (L, 8.0), (cx, 0, 0.0), mat_tex("asph", "asphalt_02", scale=1.0, tint=(0.8, 0.8, 0.82)), uv_scale=0.25)
    white = mat_flat("lane_white", (0.92, 0.92, 0.9), rough=0.6)
    dash = box("lane_dash", (3.0, 0.14, 0.01), (x0 + 2, 0, 0.006), white)
    ar = dash.modifiers.new("arr", "ARRAY"); ar.use_relative_offset = False; ar.use_constant_offset = True
    ar.constant_offset_displace = (9.0, 0, 0); ar.count = int(L / 9)
    for y in (-3.75, 3.75):
        box(f"edge{y}", (L, 0.14, 0.01), (cx, y, 0.006), white)
    sh = mat_tex("gravel", "coast_sand_01", scale=1.0, tint=(0.6, 0.58, 0.55))
    plane("shoulderR", (L, 4.0), (cx, -6.0, 0.003), sh, uv_scale=0.4)
    plane("shoulderL", (L, 3.0), (cx, 5.5, 0.003), sh, uv_scale=0.4)
    plane("beach", (L, 40.0), (cx, -28.0, -0.55), mat_tex("bsand", "coast_sand_01", scale=1.0, tint=(1.0, 0.95, 0.85)), uv_scale=0.1,
          rot=(1.3, 0, 0))                                      # slopes down to the waterline
    plane("sea", (L + 2000, 1500), (cx, -797.0, -0.72), water_mat())
    plane("land", (L, 400), (cx, 207.0, -0.02), mat_tex("lgrass", "leafy_grass", scale=1.0, tint=(0.85, 0.95, 0.75)), uv_scale=0.05)
    gr = mat_flat("guard", (0.75, 0.76, 0.78), rough=0.3, metal=0.8)
    post = box("gpost", (0.12, 0.12, 0.8), (x0 + 1, -8.0, 0.4), gr)
    ar = post.modifiers.new("arr", "ARRAY"); ar.use_relative_offset = False; ar.use_constant_offset = True
    ar.constant_offset_displace = (4.0, 0, 0); ar.count = int(L / 4)
    box("grail", (L, 0.06, 0.3), (cx, -7.92, 0.72), gr, bevel=0.02)
    rnd = random.Random(12)
    a = trees_from if trees_from is not None else x0
    b = trees_to if trees_to is not None else x1
    x = a
    while x < b:
        tree_at((x + rnd.uniform(-3, 3), rnd.uniform(9, 16), 0), k=rnd.randint(0, 2), s=rnd.uniform(0.8, 1.25), rz=rnd.uniform(0, 6))
        if rnd.random() < 0.6:
            tree_at((x + rnd.uniform(-3, 3), rnd.uniform(20, 45), 0), k=rnd.randint(0, 2), s=rnd.uniform(1.0, 1.5))
        x += rnd.uniform(9, 16)
    hill = mat_flat("hill", (0.2, 0.36, 0.14), rough=0.9)
    for i in range(10):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1,
                                             location=(x0 + i * L / 9, rnd.uniform(120, 220), -10))
        h = bpy.context.object; h.scale = (rnd.uniform(60, 110), rnd.uniform(40, 70), rnd.uniform(25, 45))
        bpy.ops.object.shade_smooth(); h.data.materials.append(hill)
    return L


def follow(obj, cam):
    cam.cam.parent = obj; cam.tgt.parent = obj
    return cam


def tracker(name, keys, interp="LINEAR"):
    """An empty that moves like a car (keys = [(frame, (x, y))]) for cameras that ride along."""
    e = empty(name, (0, 0, 0))
    for f, (x, y) in keys:
        key_loc(e, f, (x, y, 0), interp=interp)
    return e


V = 0.9          # cruising speed, metres per frame (~78 km/h)


# ============================================================================ SHOTS: the highway chase
@shot
def sh01():
    """LARRY AND DALE are following your family car - first frame: their grinning faces through the windshield
    of a tiny red car, matching sunglasses; Dale points ahead at your car."""
    n = frames_of("sh01")
    motion_blur()
    coast_road(trees_from=-60, trees_to=160)
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), windows_down=True)
    cabin_light(red)
    larry, dale = larry_and_dale(red)
    hh = dale.world("Head", frame=1)
    hand_ik(dale, "Right", empty("point", (hh.x + 0.55, hh.y + 0.05, hh.z - 0.05)))
    red.drive([(1, (0.0, -1.8), 0), (n, (V * n, -1.8), 0)])
    face(larry, 1, GRIN); face(dale, 1, GRIN)
    blink(larry, [30]); blink(dale, [33])
    cam = follow(red.root, Cam(lens=28, loc=(2.0, 0.05, 1.42), target=(0.0, 0.0, 1.12), clip_end=3000))
    cam.key(1, loc=(2.0, 0.05, 1.42)); cam.key(n, loc=(1.8, 0.0, 1.4))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.55)
    return n


@shot
def sh02():
    """your family car, AGAIN. - high side tracking shot: your blue family car, the tiny red car tailgating."""
    n = frames_of("sh02")
    motion_blur()
    coast_road(trees_from=0, trees_to=200)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    family_in(fam, sd=False); larry_and_dale(red, sd=False)
    fam.drive([(1, (60.0, -1.8), 0), (n, (60 + V * n, -1.8), 0)])
    red.drive([(1, (55.6, -1.8), 0), (n, (55.6 + V * n, -1.8), 0)])
    tr = tracker("trk", [(1, (58.0, -1.8)), (n, (58 + V * n, -1.8))])
    cam = follow(tr, Cam(lens=24, loc=(-6.0, 8.5, 4.2), target=(0.5, -0.5, 0.7), clip_end=3000))
    cam.key(1, loc=(-6.0, 8.5, 4.2)); cam.key(n, loc=(-2.5, 7.0, 2.8))
    return n


@shot
def sh03():
    """You just wanted a nice family trip to the beach - inside your car: you at the wheel, your wife, two kids
    in the back, everyone smiling; the sea flashing by."""
    n = frames_of("sh03")
    motion_blur()
    coast_road(trees_from=0, trees_to=200)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    you, wife, boy, girl = family_in(fam)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.14, location=(-0.78, 0.0, 0.95))
    ball = bpy.context.object; ball.data.materials.append(mat_flat("beachball", (1.0, 0.85, 0.1), rough=0.3))
    bpy.ops.object.shade_smooth(); ball.parent = fam.root
    fam.drive([(1, (80.0, -1.8), 0), (n, (80 + V * n, -1.8), 0)])
    face(you, 1, SMILE); face(wife, 1, SMILE); face(boy, 1, TADA); face(girl, 1, SMILE)
    blink(you, [20]); blink(wife, [36]); blink(girl, [12, 50])
    for o in bpy.data.objects:
        if o.name.startswith("family_rvm"):
            o.hide_render = True                                   # keep faces clear in this shot
    cam = follow(fam.root, Cam(lens=22, loc=(2.85, 0.15, 1.42), target=(-0.7, 0.0, 1.05), clip_end=3000))
    cam.key(1, loc=(2.85, 0.15, 1.42)); cam.key(n, loc=(2.6, 0.0, 1.38))
    return n


def mirror_feed(car, n, shot_name, lens=24, res=(480, 140)):
    """What the rear-view mirror sees: a camera at the mirror looking back, rendered small for frames 1..n, then
    mapped (left-right flipped, like a mirror) onto the mirror face as an image sequence."""
    sc = bpy.context.scene
    mx, mz, face_obj = car.mirror
    mc = bpy.data.objects.new("mirrorcam", bpy.data.cameras.new("mirrorcam")); sc.collection.objects.link(mc)
    mc.data.lens = lens; mc.data.clip_start = 0.05; mc.data.clip_end = 2000
    mc.parent = car.root; mc.location = (mx - 0.08, 0, mz - 0.02); mc.rotation_euler = (math.radians(90), 0, math.radians(90))
    out = os.path.join(lib.SCRATCH, "ep6", "mirror", shot_name)
    os.makedirs(out, exist_ok=True)
    keep = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage,
            sc.render.filepath, sc.frame_start, sc.frame_end, sc.eevee.taa_render_samples)
    sc.camera = mc; sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.render.filepath = os.path.join(out, "m_"); sc.frame_start, sc.frame_end = 1, n
    sc.eevee.taa_render_samples = 2
    face_obj.hide_render = True
    bpy.ops.render.render(animation=True)
    face_obj.hide_render = False
    (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage,
     sc.render.filepath, sc.frame_start, sc.frame_end, sc.eevee.taa_render_samples) = keep
    m = bpy.data.materials.new("mirrorfeed"); m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type == "BSDF_PRINCIPLED":
            nt.nodes.remove(nd)
    outn = next(nd for nd in nt.nodes if nd.type == "OUTPUT_MATERIAL")
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (-1, 1, 1); mp.inputs["Location"].default_value = (1, 0, 0)
    im = nt.nodes.new("ShaderNodeTexImage")
    im.image = bpy.data.images.load(os.path.join(out, "m_0001.png")); im.image.source = "SEQUENCE"
    im.image_user.frame_duration = n; im.image_user.frame_start = 1; im.image_user.use_auto_refresh = True
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 1.0
    nt.links.new(tc.outputs["UV"], mp.inputs[0]); nt.links.new(mp.outputs[0], im.inputs[0])
    nt.links.new(im.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], outn.inputs["Surface"])
    face_obj.data.materials.clear(); face_obj.data.materials.append(m)
    return mc


def lean_out(ch, keys, side=-1, sill=None):
    """Lean a seated character sideways out of the car window. keys = [(frame, degrees)]; side -1 = toward the
    character's right (-Y when facing +X), +1 = left (+Y). `sill` (car-space x, y, z) is where the hips end up when
    fully leaned (blended in over the first 25 degrees), so the body pivots at the window, not at the floor."""
    sc = bpy.context.scene
    base = ch.rig.location.copy()
    par = ch.rig.parent
    for f, deg in keys:
        sc.frame_set(f)
        ch.rig.rotation_euler = (0, math.radians(deg * side), math.radians(90))
        ch.rig.location = base
        bpy.context.view_layer.update()
        if sill is not None:
            h = ch.world("Hips")
            t = (par.matrix_world @ Vector(sill)) if par else Vector(sill)
            ch.rig.location = base + (t - h) * min(1.0, deg / 25.0)
        ch.rig.keyframe_insert("rotation_euler", frame=f); ch.rig.keyframe_insert("location", frame=f)
    sc.frame_set(1)


def look_head(ch, other, infl=0.8):
    c = look_at(ch, other.rig, infl)
    c.subtarget = "Head"
    return c


@shot
def sh04():
    """but in the rearview mirror, - over your shoulder onto the mirror: behind the kids, a tiny red car, closing."""
    n = frames_of("sh04")
    motion_blur()
    coast_road(trees_from=0, trees_to=220)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    you, wife, boy, girl = family_in(fam)
    larry, dale = larry_and_dale(red)
    face(larry, 1, GRIN); face(dale, 1, GRIN); face(boy, 1, SMILE); face(girl, 1, SMILE)
    face(you, 1, SMILE); face(you, n - 18, UNEASY)
    fam.drive([(1, (100.0, -1.8), 0), (n, (100 + V * n, -1.8), 0)])
    red.drive([(1, (92.0, -1.8), 0), (n, (96.0 + V * n, -1.8), 0)])
    mirror_feed(fam, n, "sh04", lens=26)
    mx, mz, _ = fam.mirror
    cam = follow(fam.root, Cam(lens=38, loc=(-0.08, 0.16, 1.4), target=(mx, 0.0, mz), dof=2.2, clip_end=3000))
    cam.key(1, loc=(-0.08, 0.16, 1.4)); cam.key(n, loc=(0.0, 0.12, 1.42))
    return n


@shot
def sh05():
    """two grown men in a tiny red car, - side tracking shot: the tiny red car, two big men crammed inside."""
    n = frames_of("sh05")
    motion_blur()
    coast_road(trees_from=100, trees_to=300)
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), windows_down=True)
    cabin_light(red)
    larry, dale = larry_and_dale(red)
    face(larry, 1, GRIN); face(dale, 1, GRIN); blink(larry, [24]); blink(dale, [40])
    red.drive([(1, (150.0, -1.8), 0), (n, (150 + V * n, -1.8), 0)])
    cam = follow(red.root, Cam(lens=24, loc=(1.6, -3.1, 0.8), target=(-0.1, 0.0, 0.9), clip_end=3000))
    cam.key(1, loc=(1.6, -3.1, 0.8)); cam.key(n, loc=(0.4, -3.3, 0.9))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.5)
    return n


@shot
def sh06():
    """matching SUNGLASSES. - tight on both faces: they turn to camera in perfect sync; two lens glints."""
    n = frames_of("sh06")
    motion_blur()
    coast_road(trees_from=150, trees_to=300)
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), windows_down=True)
    cabin_light(red)
    larry, dale = larry_and_dale(red)
    red.drive([(1, (200.0, -1.8), 0), (n, (200 + V * n, -1.8), 0)])
    cam = follow(red.root, Cam(lens=46, loc=(2.05, -0.02, 1.48), target=(-0.05, 0.0, 1.2), clip_end=3000))
    cam.key(1, loc=(2.05, -0.02, 1.48)); cam.key(n, loc=(1.95, 0.0, 1.46))
    for ch, f in ((larry, 18), (dale, 21)):
        c = ch.rig.pose.bones["Head"].constraints
        stare_at(ch, cam.cam, 4, 12)
        face(ch, 1, DEADPAN); face(ch, 12, GRIN)
        g = bpy.data.objects[f"shades_{ch.name}"]
        glint((-0.035, -0.02, 0.006), f, parent=g, size=0.06)
    return n


@shot
def sh07():
    """So you speed up, - your face at the wheel: jaw set, you stamp on the gas (camera kick)."""
    n = frames_of("sh07")
    motion_blur()
    coast_road(trees_from=200, trees_to=360)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    you, wife, _, _ = family_in(fam, kids=False)
    fam.drive([(1, (250.0, -1.8), 0), (n, (250 + V * n * 1.15, -1.8), 0)])
    face(you, 1, DETERMINED); face(wife, 1, UNEASY)
    look_head(wife, you, 0.6)
    cam = follow(fam.root, Cam(lens=32, loc=(0.05, 1.45, 1.38), target=(-0.33, 0.45, 1.3), clip_end=3000))
    cam.key(1, loc=(0.05, 1.45, 1.38)); cam.key(n, loc=(-0.05, 1.3, 1.36))
    cam.shake(6, n, amp=0.012, freq=0.8)
    return n


@shot
def sh08():
    """GENIUS! - low alongside your car as it surges ahead; the little red car shrinks behind."""
    n = frames_of("sh08")
    motion_blur()
    coast_road(trees_from=220, trees_to=420)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    family_in(fam, sd=False, kids=False); larry_and_dale(red, sd=False)
    fam.drive([(1, (300.0, -1.8), 0), (n, (300 + V * n * 1.7, -1.8), 0)], interp="BEZIER")
    red.drive([(1, (294.0, -1.8), 0), (n, (294 + V * n, -1.8), 0)])
    cam = follow(fam.root, Cam(lens=20, loc=(-0.6, -3.0, 0.55), target=(-4.5, -0.2, 0.9), clip_end=3000))
    cam.key(1, loc=(-0.6, -3.0, 0.55)); cam.key(n, loc=(-1.2, -3.1, 0.6))
    return n


@shot
def sh09():
    """But Larry FLOORS IT. - roadside, low: the tiny red car pops a wheelie and roars past in a cloud of smoke."""
    n = frames_of("sh09")
    motion_blur()
    coast_road(trees_from=300, trees_to=420)
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    larry, dale = larry_and_dale(red, sd=False)
    face(larry, 1, GRIN); face(dale, 1, TADA)
    x0 = 355.0
    red.drive([(1, (x0, -1.8), 0, 0), (6, (x0 + 1.0, -1.8), 0, 0), (12, (x0 + 4.5, -1.8), 0, 18), (30, (x0 + 22, -1.8), 0, 20),
               (36, (x0 + 30, -1.8), 0, 4), (n, (x0 + 38, -1.8), 0, 0)], interp="BEZIER")
    for k, f0 in enumerate((5, 9, 13)):
        ep4.soot_cloud((x0 - 0.8 + k * 1.5, -1.8, 0.35), n, start=f0, count=8, color=(0.62, 0.62, 0.64), seed=20 + k)
    cam = Cam(lens=22, loc=(x0 + 9.0, -5.2, 0.45), target=(x0 + 2.0, -1.8, 0.9), clip_end=3000)
    cam.key(1, loc=(x0 + 9.0, -5.2, 0.45), target=(x0 + 2.0, -1.8, 0.9))
    cam.key(n, loc=(x0 + 9.5, -5.2, 0.45), target=(x0 + 22.0, -1.8, 1.0))
    cam.shake(8, 20, amp=0.02, freq=0.9)
    return n


def side_by_side(n, x0, y_red=1.15):
    """Your car in the right lane; the red car alongside, hugging the centre line; Dale out of his window."""
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), windows_down=True)
    you, wife, boy, girl = family_in(fam)
    larry, dale = larry_and_dale(red)
    W = red.P["W"]
    sx, sy, _ = red.seats[1]
    lean_out(dale, [(1, 48)], side=-1, sill=(sx + 0.05, -W / 2 + 0.12, red.P["belt"] + 0.02))
    t = empty("wave", (0, 0, 0)); t.parent = red.root
    for f in range(1, n + 1, 5):
        up = (f // 5) % 2
        key_loc(t, f, (sx + 0.15, -W / 2 - 0.55, 1.85 + 0.12 * up))
    hand_ik(dale, "Right", t)
    face(dale, 1, GRIN)
    fam.drive([(1, (x0, -1.8), 0), (n, (x0 + V * n, -1.8), 0)])
    red.drive([(1, (x0 - 0.4, y_red), 0), (n, (x0 - 0.4 + V * n, y_red), 0)])
    return fam, red, (you, wife, boy, girl), (larry, dale)


@shot
def sh10():
    """Dale is hanging out the window, - ahead of both cars: the red car alongside yours, Dale out of his window."""
    n = frames_of("sh10")
    motion_blur()
    coast_road(trees_from=380, trees_to=560)
    fam, red, fam_chars, (larry, dale) = side_by_side(n, 420.0)
    face(larry, 1, GRIN)
    tr = tracker("trk", [(1, (420.0, 0)), (n, (420 + V * n, 0))])
    cam = follow(tr, Cam(lens=24, loc=(6.8, 0.6, 1.9), target=(-0.2, 0.0, 1.15), clip_end=3000))
    cam.key(1, loc=(6.8, 0.6, 1.9)); cam.key(n, loc=(5.6, 0.2, 1.7))
    look_head(dale, fam_chars[2], 0.7)
    return n


@shot
def sh11():
    """waving at YOUR KIDS. - from the back seat: Dale's grinning face at your daughter's window; she waves back."""
    n = frames_of("sh11")
    motion_blur()
    coast_road(trees_from=420, trees_to=600)
    fam, red, (you, wife, boy, girl), (larry, dale) = side_by_side(n, 470.0)
    gx, gy, gz = fam.seats[2]
    t = empty("girlwave", (0, 0, 0)); t.parent = fam.root
    for f in range(1, n + 1, 4):
        key_loc(t, f, (gx + 0.2, gy + 0.18 + 0.06 * ((f // 4) % 2), gz + 0.75))
    hand_ik(girl, "Left", t)
    face(girl, 1, TADA); face(boy, 1, SHOCK)
    look_head(girl, dale, 0.6); look_head(boy, dale, 0.6)
    look_head(dale, girl, 0.8)
    cam = follow(fam.root, Cam(lens=20, loc=(gx - 0.05, -0.55, 1.28), target=(gx + 0.1, 2.2, 1.3), clip_end=3000))
    cam.key(1, loc=(gx - 0.05, -0.55, 1.28)); cam.key(n, loc=(gx + 0.05, -0.45, 1.3))
    return n


PULL = 600.0      # where both cars stop on the shoulder (x of your car)


def parked(windows_down=True, kids=True, sd=True):
    """Both cars stopped on the right shoulder: your car at PULL, the red car 6.5 m behind."""
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), windows_down=windows_down)
    larry, dale = larry_and_dale(red, sd=sd)
    fam.root.location = (PULL, -5.3, 0)
    red.root.location = (PULL - 6.5, -5.3, 0)
    return fam, red, larry, dale


@shot
def sh12():
    """So you pull over, - high and wide: both cars brake and pull onto the shoulder, one behind the other."""
    n = frames_of("sh12")
    motion_blur()
    coast_road(trees_from=520, trees_to=680)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    family_in(fam, sd=False); larry_and_dale(red, sd=False)
    fam.drive([(1, (PULL - 16, -1.8), 0), (12, (PULL - 4, -3.6), -12), (n, (PULL, -5.3), 0)], interp="BEZIER")
    red.drive([(1, (PULL - 22.5, -1.8), 0), (13, (PULL - 10.5, -3.6), -12), (n, (PULL - 6.5, -5.3), 0)], interp="BEZIER")
    cam = Cam(lens=26, loc=(PULL + 6, 9.0, 9.0), target=(PULL - 7, -4.0, 0.5), clip_end=3000)
    cam.key(1, loc=(PULL + 6, 9.0, 9.0), target=(PULL - 9, -3.5, 0.5)); cam.key(n, loc=(PULL + 4, 7.5, 7.5), target=(PULL - 4, -5.0, 0.6))
    return n


@shot
def sh13():
    """get out, and march right up to them. - you storm along the shoulder toward the red car, fists clenched."""
    n = frames_of("sh13")
    coast_road(trees_from=520, trees_to=680)
    fam, red, larry, dale = parked()
    face(larry, 1, GRIN); face(dale, 1, GRIN)
    you = load_char("you_casual", (PULL - 0.6, -4.05, 0), rot_z=-90, subdiv=True)
    you.clip("07_01", **src(n, 60, speed=1.45, in_place=False))
    face(you, 1, STERN)
    cam = Cam(lens=26, loc=(PULL - 5.2, -3.7, 1.0), target=(PULL - 2.0, -4.0, 1.25), clip_end=3000)
    cam.key(1, loc=(PULL - 5.2, -3.7, 1.0), target=(PULL - 1.5, -4.0, 1.3))
    cam.key(n, loc=(PULL - 5.4, -3.6, 1.0), target=(PULL - 3.6, -4.0, 1.4))
    return n


def at_window(n, sd=True):
    """You standing at the red car's driver window (its left side), facing the car."""
    coast_road(trees_from=560, trees_to=640)
    fam, red, larry, dale = parked(sd=sd)
    rx = PULL - 6.5 + red.seats[0][0]
    you = load_char("you_casual", (rx + 0.1, -5.3 + red.P["W"] / 2 + 0.42, 0), rot_z=0, subdiv=True)
    return fam, red, larry, dale, you, rx


@shot
def sh14():
    """LEAVE ME ALONE! - from inside the red car, up through the open window: you, red-faced, finger jabbing down."""
    n = frames_of("sh14")
    fam, red, larry, dale, you, rx = at_window(n)
    you.clip("137_41", **src(n, 4300))
    hh = you.world("Head", frame=1)
    t = empty("jab", (0, 0, 0))
    for f in range(1, n + 1, 4):
        key_loc(t, f, (rx + 0.1, hh.y - 0.55, 1.15 + 0.06 * ((f // 4) % 2)))
    hand_ik(you, "Right", t)
    face(you, 1, RAGE)
    syl = [(22.40, 22.54, 0.6, 0.0), (22.54, 22.76, 0.45, 0.1), (22.76, 23.14, 0.85, 0.2)]
    lipsync(you, lambda t_: at("sh14", t_), syl, base=RAGE)
    face(larry, 1, DEADPAN); face(dale, 1, DEADPAN)
    cam = Cam(lens=20, loc=(rx - 0.25, -5.25, 1.05), target=(rx + 0.1, hh.y, hh.z), clip_end=3000)
    cam.key(1, loc=(rx - 0.25, -5.25, 1.05)); cam.key(n, loc=(rx - 0.2, -5.2, 1.0))
    cam.shake(1, n, amp=0.008, freq=0.9)
    look_at(you, (rx, -5.3, 1.1), 0.6)
    return n


@shot
def sh15():
    """They don't say a word, - over your shoulder, down into the car: both slowly turn and look up at you. Silence."""
    n = frames_of("sh15")
    fam, red, larry, dale, you, rx = at_window(n)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, STERN)
    hh = you.world("Head", frame=1)
    cam = Cam(lens=30, loc=(hh.x + 0.35, hh.y + 0.3, hh.z + 0.12), target=(rx + 0.1, -5.25, 1.15), clip_end=3000)
    cam.key(1, loc=(hh.x + 0.35, hh.y + 0.3, hh.z + 0.12)); cam.key(n, loc=(hh.x + 0.3, hh.y + 0.22, hh.z + 0.05))
    for ch, d in ((larry, 0), (dale, 2)):
        stare_at(ch, empty(f"eyes{ch.name}", (hh.x, hh.y, hh.z + 0.05)), 5 + d, 15 + d)
        face(ch, 1, DEADPAN)
        blink(ch, [26])
        g = bpy.data.objects[f"shades_{ch.name}"]
        key_loc(g, 16, tuple(g.location)); key_loc(g, n, (g.location.x, g.location.y - 0.018, g.location.z + 0.004))
    return n


@shot
def sh16():
    """they just lean in and SNIFF YOUR PANTS. - side on: both lean out of the window, noses at your pockets."""
    n = frames_of("sh16")
    fam, red, larry, dale, you, rx = at_window(n)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, STERN); face(you, 22, UNEASY); face(you, 44, SHOCK)
    look_at(you, (rx, -5.0, 1.0), 0.8)
    W = red.P["W"]; belt = red.P["belt"]
    hips = you.world("Hips", frame=1)
    for ch, sill, deg, f0 in ((larry, (red.seats[0][0] + 0.05, W / 2 - 0.12, belt + 0.02), 46, 6),
                              (dale, (red.seats[1][0] + 0.12, 0.12, belt + 0.28), 68, 10)):
        lean_out(ch, [(1, 0), (f0, 0), (f0 + 14, deg), (n, deg + 4)], side=1, sill=sill)
        nose = empty(f"pocket{ch.name}", (hips.x + (0.05 if ch is larry else -0.08), hips.y - 0.12, hips.z - 0.05))
        look_at(ch, nose, 0.9)
        face(ch, 1, DEADPAN); face(ch, f0 + 12, SNIFF)
    cam = Cam(lens=26, loc=(rx - 2.9, -2.6, 1.25), target=(rx + 0.1, -4.6, 1.05), clip_end=3000)
    cam.key(1, loc=(rx - 2.9, -2.6, 1.25)); cam.key(n, loc=(rx - 2.4, -2.9, 1.15))
    return n


@shot
def sh17():
    """So you SCREAM - close on your face: a full-body scream; the camera shakes."""
    n = frames_of("sh17")
    fam, red, larry, dale, you, rx = at_window(n, sd=False)
    you.clip("137_41", **src(n, 4300))
    face(you, 1, SHOCK); face(you, 4, dict(RAGE, jawOpen=1.0, eyeWideLeft=1.0, eyeWideRight=1.0))
    hh = you.world("Head", frame=1)
    for side, dx in (("Left", 0.13), ("Right", -0.13)):
        hand_ik(you, side, empty(f"cheek{side}", (hh.x + dx, hh.y - 0.1, hh.z + 0.02)))
    cam = Cam(lens=40, loc=(hh.x + 0.2, hh.y - 1.15, hh.z + 0.05), target=(hh.x, hh.y, hh.z + 0.05), clip_end=3000)
    cam.key(1, loc=(hh.x + 0.2, hh.y - 1.15, hh.z + 0.05)); cam.key(n, loc=(hh.x + 0.1, hh.y - 0.85, hh.z + 0.05))
    cam.shake(4, n, amp=0.025, freq=1.2)
    return n


@shot
def sh18():
    """and run back to the car. - wide: you sprint back to your car; their heads swivel to follow you."""
    n = frames_of("sh18")
    fam, red, larry, dale, you, rx = at_window(n, sd=False)
    W = red.P["W"]; belt = red.P["belt"]
    for ch, sill, deg in ((larry, (red.seats[0][0] + 0.05, W / 2 - 0.12, belt + 0.02), 46),
                          (dale, (red.seats[1][0] + 0.12, 0.12, belt + 0.28), 68)):
        lean_out(ch, [(1, deg)], side=1, sill=sill)
        look_head(ch, you, 0.8)
        face(ch, 1, SNIFF)
    you.rig.rotation_euler = (0, 0, math.radians(-90 + 180))
    you.rig.location = (rx + 0.4, -4.1, 0)
    you.clip("09_01", **src(n, 0, speed=0.75, in_place=False))
    face(you, 1, dict(RAGE, jawOpen=1.0))
    cam = Cam(lens=24, loc=(rx - 4.5, -1.6, 1.4), target=(rx + 3.0, -4.6, 0.9), clip_end=3000)
    cam.key(1, loc=(rx - 4.5, -1.6, 1.4)); cam.key(n, loc=(rx - 4.0, -1.3, 1.5), target=(rx + 5.0, -4.6, 1.0))
    return n


# ============================================================================ the forest shortcut
LOTUS = {"lfemur": {"rx": -85, "rz": 30}, "rfemur": {"rx": -85, "rz": -30}, "ltibia": {"rx": 118}, "rtibia": {"rx": 118}}
JX = 700.0        # x where the dirt shortcut leaves the highway (to the left, +Y)


def dirt_mat():
    return mat_tex("dirt", "coast_sand_01", scale=1.0, tint=(0.62, 0.48, 0.32))


def junction():
    """The dirt shortcut leaving the highway at JX, the SECRET SHORTCUT sign, and the forest swallowing it."""
    plane("dirt_jn", (5.0, 60.0), (JX, 33.5, 0.008), dirt_mat(), uv_scale=0.3)
    for x in (JX - 3.4, JX - 3.0):
        pass
    for k, x in enumerate((JX - 3.6,)):
        cylinder(f"sgnpost{k}", 0.05, 2.2, (x, 5.4, 1.1), mat_flat("sgnpost", (0.3, 0.2, 0.1)))
    decal("sign_short", f"{D6}/sign_shortcut.png", 1.6, (JX - 3.6, 5.35, 2.15), rot=(90, 0, 180))
    rnd = random.Random(31)
    for i in range(70):
        x = JX + rnd.uniform(-30, 30); y = rnd.uniform(9, 70)
        if abs(x - JX) < 3.8:
            continue
        tree_at((x, y, 0), k=rnd.randint(0, 2), s=rnd.uniform(1.0, 1.5), rz=rnd.uniform(0, 6))


def forest(x0=-40.0, x1=160.0, clearing=None):
    """Deep forest: a dirt track along +X (y=0), dense trees both sides, dappled sun. clearing=(x, y) opens a glade."""
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=0.8, rot_z=120)
    sun(energy=4.2, rot=(40, 0, 150), color=(1.0, 0.93, 0.82))
    L = x1 - x0; cx = (x0 + x1) / 2
    plane("fground", (L + 120, 220), (cx, 0, -0.02), mat_tex("fgrass", "leafy_grass", scale=1.0, tint=(0.72, 0.85, 0.6)), uv_scale=0.06)
    plane("ftrack", (L, 4.2), (cx, 0, 0.004), dirt_mat(), uv_scale=0.3)
    rnd = random.Random(5)
    x = x0
    while x < x1:
        for side in (-1, 1):
            for k in range(3):
                y = side * rnd.uniform(4.0, 9.0 + k * 9)
                tx = x + rnd.uniform(-2, 2)
                if clearing and math.hypot(tx - clearing[0], y - clearing[1]) < 9:
                    continue
                tree_at((tx, y, 0), k=rnd.randint(0, 2), s=rnd.uniform(1.1, 1.7), rz=rnd.uniform(0, 6))
        x += rnd.uniform(3.5, 6.0)
    if clearing:
        plane("glade", (14, 12), (clearing[0], clearing[1], 0.002), mat_tex("glgrass", "leafy_grass", scale=1.0, tint=(0.9, 1.0, 0.75)),
              uv_scale=0.4)


def dust(car, n, f0=1, every=3, color=(0.62, 0.5, 0.36)):
    """Dust kicked up behind a car on the dirt track (puffs left where the rear wheels were)."""
    sc = bpy.context.scene
    for f in range(f0, n, every):
        sc.frame_set(f)
        p = car.root.matrix_world @ Vector((-car.P["wb"] / 2 - 0.3, 0, 0.25))
        ep4.soot_cloud(tuple(p), n, start=f, count=3, color=color, seed=f)
    sc.frame_set(1)


def picnic(x, y, rz=0.0):
    """Checked blanket, wicker basket, sandwiches, two glasses of red wine."""
    m = bpy.data.materials.new("gingham"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.5, 1.5, 1.5)
    im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(f"{D6}/gingham.png", check_existing=True)
    nt.links.new(tc.outputs["UV"], mp.inputs[0]); nt.links.new(mp.outputs[0], im.inputs[0]); nt.links.new(im.outputs[0], b.inputs["Base Color"])
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=16, y_subdivisions=16, size=2.4, location=(x, y, 0.012))
    bl = bpy.context.object; bl.name = "blanket"; bl.data.materials.append(m)
    tx = bpy.data.textures.new("blk", "CLOUDS"); tx.noise_scale = 0.4
    dm = bl.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 0.02
    bk = model("wicker_basket_01", (x + 0.75, y + 0.65, 0.01), rot_z=30); fit(bk, height=0.35)
    bread = mat_flat("bread", (0.92, 0.75, 0.45), rough=0.8); fill = mat_flat("fill", (0.35, 0.65, 0.2), rough=0.7)
    for k, (dx, dy) in enumerate(((0.1, -0.5), (-0.25, -0.55))):
        box(f"sand{k}a", (0.16, 0.16, 0.03), (x + dx, y + dy, 0.03), bread, bevel=0.01)
        box(f"sand{k}b", (0.165, 0.165, 0.012), (x + dx, y + dy, 0.052), fill)
        box(f"sand{k}c", (0.16, 0.16, 0.03), (x + dx, y + dy, 0.073), bread, bevel=0.01)
    return bl


def wine_glass(name):
    root = empty(name)
    g = glass("wineglass", alpha=0.25, tint=(0.9, 0.95, 1.0))
    cylinder(f"{name}_stem", 0.005, 0.09, (0, 0, -0.045), g, verts=8).parent = root
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.02, radius2=0.04, depth=0.08, location=(0, 0, 0.04), end_fill_type="NOTHING")
    c = bpy.context.object; c.data.materials.append(g); c.parent = root
    cylinder(f"{name}_wine", 0.03, 0.035, (0, 0, 0.025), mat_flat("wine", (0.35, 0.02, 0.05), rough=0.1), verts=20).parent = root
    return root


@shot
def sh19():
    """So you take a secret shortcut through the forest. - from above: your car swings off the highway onto a dirt
    track past a SECRET SHORTCUT sign and dives into the trees, dust trailing."""
    n = frames_of("sh19")
    motion_blur()
    coast_road(trees_from=JX - 80, trees_to=JX + 80)
    junction()
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    family_in(fam, sd=False, kids=False)
    fam.drive([(1, (JX - 24, -1.8), 0), (16, (JX - 4.5, -1.4), 18), (30, (JX, 6.0), 82), (n, (JX + 0.6, 26.0), 90)],
              interp="BEZIER")
    dust(fam, n, f0=24, every=3)
    cam = Cam(lens=24, loc=(JX + 16, -14, 12), target=(JX - 6, 0, 0), clip_end=3000)
    cam.key(1, loc=(JX + 16, -14, 12), target=(JX - 10, -1, 0.5)); cam.key(n, loc=(JX + 12, -9, 14), target=(JX + 0.5, 16, 0.5))
    return n


@shot
def sh20():
    """CLEVER! - through your windshield: you, smug, steering down the forest track; leaf shadows sliding over."""
    n = frames_of("sh20")
    motion_blur()
    forest(x0=-10, x1=90)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    you, wife, _, _ = family_in(fam, kids=False)
    fam.drive([(1, (10.0, 0), 0), (n, (10 + 0.55 * n, 0), 0)])
    face(you, 1, SMUG); face(wife, 1, SMILE)
    sx, sy, sz = fam.seats[0]
    cam = follow(fam.root, Cam(lens=40, loc=(2.6, sy - 0.25, 1.45), target=(sx - 0.1, sy, 1.32), clip_end=3000))
    cam.key(1, loc=(2.6, sy - 0.25, 1.45)); cam.key(n, loc=(2.4, sy - 0.2, 1.43))
    look_at(you, cam.cam, 0.4)
    return n


GLADE = (70.0, 7.5)


def picnickers(sd=True):
    """Larry and Dale cross-legged on their picnic blanket, the tiny red car parked behind them."""
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04))
    red.root.location = (GLADE[0] + 1.0, GLADE[1] + 4.0, 0); red.root.rotation_euler = (0, 0, math.radians(-20))
    picnic(GLADE[0], GLADE[1])
    out = []
    for nm, dx in (("larry", -0.45), ("dale", 0.45)):
        ch = load_char(nm, (GLADE[0] + dx, GLADE[1] + 0.2, 0), rot_z=-10, subdiv=sd, tag=nm)
        pose(ch, LOTUS)
        settle(ch, "Hips", 0.14)
        wear_shades(ch)
        out.append(ch)
    return red, out


@shot
def sh21():
    """but they're already there, - chase cam behind your car: round the bend, a clearing... a tiny red car."""
    n = frames_of("sh21")
    motion_blur()
    forest(x0=-10, x1=110, clearing=GLADE)
    fam = Car("family", "family", (0.08, 0.3, 0.72))
    family_in(fam, sd=False, kids=False)
    red, (larry, dale) = picnickers(sd=False)
    fam.drive([(1, (36.0, 0), 0), (n, (36 + 0.42 * n, 0), 0)], interp="BEZIER")
    dust(fam, n, every=4)
    cam = follow(fam.root, Cam(lens=26, loc=(-6.0, -1.4, 2.2), target=(14.0, 4.0, 0.8), clip_end=3000))
    cam.key(1, loc=(-6.0, -1.4, 2.2)); cam.key(n, loc=(-5.5, -1.2, 2.0), target=(20.0, 7.0, 0.8))
    return n


@shot
def sh22():
    """parked, HAVING A PICNIC. - the glade: Larry and Dale on a checked blanket, raising red wine to you."""
    n = frames_of("sh22")
    forest(x0=30, x1=110, clearing=GLADE)
    red, (larry, dale) = picnickers()
    fam = Car("family", "family", (0.08, 0.3, 0.72), interior=False)
    fam.root.location = (GLADE[0] - 4.5, 1.0, 0); fam.root.rotation_euler = (0, 0, math.radians(15))
    for ch, side in ((larry, "Right"), (dale, "Left")):
        g = wine_glass(f"wine_{ch.name}")
        ep3.hold(ch, g, side, loc=(0.0, 0.08, 0.035), rot=(0, 0, 0))
        hh = ch.world("Head", frame=1)
        t = empty(f"toast{ch.name}", (0, 0, 0))
        dx = -0.3 if side == "Right" else 0.3
        key_loc(t, 1, (hh.x + dx, hh.y - 0.35, hh.z - 0.35)); key_loc(t, 14, (hh.x + dx * 0.7, hh.y - 0.4, hh.z + 0.1))
        key_loc(t, n, (hh.x + dx * 0.7, hh.y - 0.42, hh.z + 0.12))
        hand_ik(ch, side, t)
        face(ch, 1, GRIN)
    cam = Cam(lens=30, loc=(GLADE[0] - 0.4, GLADE[1] - 4.0, 1.3), target=(GLADE[0], GLADE[1] + 0.2, 0.75), clip_end=3000)
    cam.key(1, loc=(GLADE[0] - 0.4, GLADE[1] - 4.0, 1.3)); cam.key(n, loc=(GLADE[0] - 0.3, GLADE[1] - 3.2, 1.15))
    for ch in (larry, dale):
        look_at(ch, cam.cam, 0.7)
    return n


# ============================================================================ the gas station
def gas_station():
    world_hdri("kloofendal_43d_clear_puresky", strength=1.0, rot_z=60)
    sun(energy=3.8, rot=(50, 0, 140), color=(1.0, 0.95, 0.88))
    plane("gs_ground", (120, 120), (0, 0, 0), mat_tex("gsconc", "concrete_floor_02", scale=1.0, tint=(0.85, 0.85, 0.83)), uv_scale=0.15)
    plane("gs_road", (300, 8), (0, -12, 0.004), mat_tex("asph", "asphalt_02", scale=1.0, tint=(0.8, 0.8, 0.82)), uv_scale=0.25)
    red = mat_flat("gsred", (0.85, 0.08, 0.06), rough=0.4); white = mat_flat("gswhite", (0.95, 0.95, 0.94), rough=0.5)
    box("canopy", (14, 9, 0.6), (0, 0, 5.2), white, bevel=0.05)
    box("canopy_band", (14.1, 9.1, 0.25), (0, 0, 5.1), red)
    light = mat_flat("gslight", (1, 1, 1), emit=(1, 0.98, 0.95), emit_strength=6)
    for x in (-4.5, 0, 4.5):
        for y in (-2.5, 2.5):
            plane(f"gsl{x}{y}", (1.6, 0.6), (x, y, 4.89), light, rot=(180, 0, 0))
    for x in (-5.5, 5.5):
        for y in (-3.5, 3.5):
            box(f"gspil{x}{y}", (0.4, 0.4, 4.9), (x, y, 2.45), white)
    for i, y in enumerate((-1.6, 1.6)):
        box(f"island{i}", (5.0, 1.0, 0.18), (0, y, 0.09), mat_flat("island", (0.6, 0.6, 0.6)))
        for x in (-1.2, 1.2):
            box(f"pump{i}{x}", (0.7, 0.45, 1.7), (x, y, 1.03), white, bevel=0.04)
            box(f"pumpr{i}{x}", (0.72, 0.47, 0.25), (x, y, 1.8), red, bevel=0.03)
            decal(f"pscr{i}{x}", f"{D6}/pump_screen.png", 0.32, (x, y - 0.235, 1.35), rot=(90, 0, 0), emit=0.8)
    shop = mat_tex("shopwall", "painted_plaster_wall", scale=1.0, tint=(0.95, 0.93, 0.88))
    box("shop", (12, 6, 3.6), (0, 11, 1.8), shop, uv_scale=0.5)
    box("shopwin", (7, 0.05, 1.8), (0, 7.97, 1.5), mat_flat("shopglass", (0.2, 0.28, 0.32), rough=0.05, metal=0.3))
    box("shopband", (12.1, 6.1, 0.5), (0, 11, 3.4), red)
    cylinder("gs_pole", 0.18, 7.5, (9.0, -6.5, 3.75), mat_flat("gspole", (0.5, 0.5, 0.52), metal=0.6))
    decal("gs_sign", f"{D6}/sign_gas.png", 2.2, (9.0, -6.72, 6.3), rot=(90, 0, 0))
    for i, x in enumerate((-25, -18, 22, 30)):
        ep1.blob_tree((x, 14 + i, 0), height=6, seed=60 + i)


@shot
def sh23():
    """So you swap cars at a gas station. - wide: you lead the family from your blue car to a sleek black one."""
    n = frames_of("sh23")
    gas_station()
    fam = Car("family", "family", (0.08, 0.3, 0.72), interior=False)
    fam.root.location = (-1.0, -3.0, 0)
    blk = Car("sedan", "sedan", (0.02, 0.02, 0.025), interior=False)
    blk.root.location = (9.5, -3.2, 0)
    walkers = []
    for k, (nm, y, sp, dly) in enumerate((("you_casual", -4.4, 1.0, 0), ("wife", -5.1, 1.0, 12), ("kid_boy", -4.1, 1.25, 30),
                                           ("kid_girl", -5.4, 1.25, 50))):
        ch = load_char(nm, (1.2 - k * 0.7, y, 0), rot_z=90, subdiv=False)
        ch.clip("07_01", **src(n, 60 + dly, speed=sp, in_place=False))
        face(ch, 1, SMILE)
        walkers.append(ch)
    cam = Cam(lens=24, loc=(5.0, -14.0, 2.4), target=(4.0, -3.5, 1.0), clip_end=3000)
    cam.key(1, loc=(5.0, -14.0, 2.4)); cam.key(n, loc=(6.5, -13.0, 2.2), target=(6.0, -3.5, 1.0))
    return n


def sedan_inside(driver=True, kids=True, sd=True):
    """Inside the black sedan: you, a kid and your wife across the back seat; the chauffeur (Dale) up front."""
    gas_station()
    blk = Car("sedan", "sedan", (0.02, 0.02, 0.025))
    blk.root.location = (0, 0, 0)
    xr = blk.seats[2][0]
    blk.seats += [(xr, 0.0, blk.seats[2][2])]
    you = load_char("you_casual", (0, 0, 0), subdiv=sd)
    wife = load_char("wife", (0, 0, 0), subdiv=sd)
    blk.seat_char(you, 2, hands="lap", pose_over=SIT)
    blk.seat_char(wife, 3, hands="lap", pose_over=SIT)
    boy = None
    if kids:
        boy = load_char("kid_boy", (0, 0, 0), subdiv=sd)
        blk.seat_char(boy, 4, hands="lap", pose_over=SIT)
    dale = None
    if driver:
        dale = load_char("dale", (0, 0, 0), subdiv=sd, tag="dale")
        blk.seat_char(dale, 0)
        on_bone(dale, ep2.cap(color=(0.03, 0.03, 0.04), badge=(0.85, 0.7, 0.2)), "Head", (0, 0.118, 0.0))
        wear_shades(dale)
    return blk, you, wife, boy, dale


@shot
def sh24():
    """PERFECT! - the plush back seat of the black car: you stretch out, arm round your wife, very pleased."""
    n = frames_of("sh24")
    blk, you, wife, boy, dale = sedan_inside(driver=False)
    face(you, 1, SMUG); face(wife, 1, SMILE); face(boy, 1, TADA)
    xr, yr, zr = blk.seats[2]
    cam = Cam(lens=22, loc=(xr + 1.45, -0.15, 1.35), target=(xr, 0.0, 1.05), clip_end=3000)
    cam.key(1, loc=(xr + 1.45, -0.15, 1.35)); cam.key(n, loc=(xr + 1.3, -0.05, 1.32))
    look_at(you, cam.cam, 0.5)
    return n


@shot
def sh25():
    """but the new car comes with a driver, - from the back seat: the back of a chauffeur's cap. Very tall."""
    n = frames_of("sh25")
    blk, you, wife, boy, dale = sedan_inside()
    face(you, 1, SMILE); face(you, n - 20, UNEASY)
    look_head(you, dale, 0.4)
    xr = blk.seats[2][0]
    cam = Cam(lens=28, loc=(xr - 0.15, 0.12, 1.32), target=(blk.seats[0][0], blk.seats[0][1], 1.3), dof=2.8, clip_end=3000)
    cam.key(1, loc=(xr - 0.15, 0.12, 1.32)); cam.key(n, loc=(xr + 0.3, 0.2, 1.3))
    return n


@shot
def sh26():
    """and it's DALE. - the chauffeur turns round over his seat: Dale, sunglasses, grin. Wink."""
    n = frames_of("sh26")
    blk, you, wife, boy, dale = sedan_inside(kids=False)
    xr = blk.seats[2][0]
    cam = Cam(lens=34, loc=(xr + 0.25, 0.25, 1.32), target=(blk.seats[0][0], blk.seats[0][1], 1.36), dof=2.8, clip_end=3000)
    cam.key(1, loc=(xr + 0.25, 0.25, 1.32)); cam.key(n, loc=(xr + 0.45, 0.32, 1.32))
    stare_at(dale, cam.cam, 2, 9, 0.95)
    face(dale, 1, DEADPAN); face(dale, 8, GRIN); face(dale, n - 7, WINK)
    return n


# ============================================================================ the plane
def plane_model(name="jet", title=True):
    """A white airliner along +X (nose at +X), origin at the wing root on the fuselage axis."""
    root = empty(name)
    white = mat_flat("jetwhite", (0.94, 0.95, 0.96), rough=0.3, metal=0.1)
    blue = mat_flat("jetblue", (0.08, 0.22, 0.6), rough=0.35)
    grey = mat_flat("jetgrey", (0.6, 0.62, 0.65), rough=0.35, metal=0.5)
    R, Lf = 1.9, 26.0
    parts = [cylinder(f"{name}_fus", R, Lf, (0, 0, 0), white, rot=(0, 90, 0), verts=48)]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=R, location=(Lf / 2, 0, 0))
    nose = bpy.context.object; nose.scale = (1.7, 1.0, 1.0); nose.data.materials.append(white); bpy.ops.object.shade_smooth()
    parts.append(nose)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=R, radius2=0.35, depth=8.0, location=(-Lf / 2 - 4.0, 0, 0.6),
                                    rotation=(0, math.radians(-90), 0))
    tail = bpy.context.object; tail.data.materials.append(white); bpy.ops.object.shade_smooth(); parts.append(tail)
    belly = cylinder(f"{name}_belly", R * 1.003, Lf, (0, 0, 0), blue, rot=(0, 90, 0), verts=48)
    belly.scale = (1, 1, 1); parts.append(belly)
    cut = box(f"{name}_bellycut", (Lf + 1, 2 * R + 1, 2 * R), (0, 0, R * 0.55), white)
    cut.hide_render = True; cut.hide_viewport = True
    md = belly.modifiers.new("cut", "BOOLEAN"); md.object = cut; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    for s in (-1, 1):
        w = extrude(f"{name}_wing{s}", [(-2.0, -0.18), (2.6, -0.18), (2.8, 0.05), (-1.8, 0.12)], 0, s * 15.5, white, bevel=0.05)
        w.location = (0, 0, -1.0); w.rotation_euler = (math.radians(-s * 4), 0, math.radians(s * -24)); parts.append(w)
        e = cylinder(f"{name}_eng{s}", 0.75, 3.2, (1.9, s * 5.5, -1.85), grey, rot=(0, 90, 0), verts=32); parts.append(e)
        h = extrude(f"{name}_hstab{s}", [(-1.4, -0.08), (1.0, -0.08), (1.1, 0.04), (-1.3, 0.08)], 0, s * 5.5, white, bevel=0.03)
        h.location = (-Lf / 2 - 5.0, 0, 0.7); h.rotation_euler = (0, 0, math.radians(s * -28)); parts.append(h)
    fin = extrude(f"{name}_fin", [(-3.0, 0), (1.2, 0), (-1.8, 4.6), (-3.6, 4.6)], -0.12, 0.12, blue, bevel=0.04)
    fin.location = (-Lf / 2 - 4.5, 0, 1.6); parts.append(fin)
    for p in parts:
        p.parent = root
    for s in (-1, 1):
        d = decal(f"{name}_wins{s}", f"{D6}/plane_windows.png", Lf - 2, (0.5, s * (R + 0.01), 0.45),
                  rot=(90, 0, 0 if s < 0 else 180), alpha=True); d.parent = root
        if title:
            t = decal(f"{name}_title{s}", f"{D6}/plane_title.png", 9.0, (3.0, s * (R + 0.02), 1.15),
                      rot=(90, 0, 0 if s < 0 else 180), alpha=True); t.parent = root
        cw = box(f"{name}_cockpitwin{s}", (1.2, 0.05, 0.45), (Lf / 2 + 1.6, s * (R * 0.72), 0.85), mat_flat("cwin", (0.04, 0.05, 0.07), rough=0.05),
                 rot=(0, 0, s * 25)); cw.parent = root
    return root


def runway():
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.1, rot_z=40)
    sun(energy=3.8, rot=(48, 0, 120), color=(1.0, 0.95, 0.88))
    plane("rw_grass", (2000, 600), (0, 0, -0.02), mat_tex("rwg", "leafy_grass", scale=1.0, tint=(0.8, 0.9, 0.7)), uv_scale=0.02)
    plane("runway", (1600, 45), (0, 0, 0.0), mat_tex("rwasph", "asphalt_02", scale=1.0, tint=(0.7, 0.7, 0.72)), uv_scale=0.1)
    white = mat_flat("rwwhite", (0.95, 0.95, 0.93), rough=0.6)
    d = box("rw_dash", (30, 0.9, 0.01), (-780, 0, 0.006), white)
    ar = d.modifiers.new("arr", "ARRAY"); ar.use_relative_offset = False; ar.use_constant_offset = True
    ar.constant_offset_displace = (60, 0, 0); ar.count = 27
    for y in (-21, 21):
        box(f"rw_edge{y}", (1600, 0.9, 0.01), (0, y, 0.006), white)
    for i in range(14):
        tree_at((-300 + i * 45, 90 + (i % 3) * 20, 0), k=i % 3, s=1.6)


@shot
def sh27():
    """So you ditch the car and take a plane. - low beside the runway: the airliner thunders past and lifts off."""
    n = frames_of("sh27")
    motion_blur()
    runway()
    jet = plane_model()
    jet.rotation_mode = "XYZ"
    for f, x, z, pitch in ((1, -140, 3.6, 0), (24, -40, 3.6, 0), (40, 25, 5.5, 8), (n, 70, 9.5, 10)):
        key_loc(jet, f, (x, 0, z)); key_rot(jet, f, (0, -pitch, 0))            # nose up
    cam = Cam(lens=22, loc=(10, -42, 1.5), target=(-60, 0, 4.0), clip_end=4000)
    cam.key(1, target=(-120, 0, 4.0)); cam.key(28, target=(-10, 0, 4.5)); cam.key(n, target=(60, 0, 9.0))
    cam.shake(18, 40, amp=0.02, freq=0.9)
    return n


def cabin_set(sign_on=None):
    """Airliner cabin along +X: two-two seats, overhead bins, oval windows full of cloud-bright sky, a seatbelt sign
    panel over every row. sign_on=frame lights the signs."""
    world_color((0.7, 0.8, 0.95), 0.6)
    wall = mat_flat("cabwall", (0.9, 0.9, 0.88), rough=0.5)
    plane("cabfloor", (14, 3.4), (0, 0, 0), mat_tex("cabcarpet", "dirty_carpet", scale=1.0, tint=(0.35, 0.4, 0.6)), uv_scale=0.6)
    for s in (-1, 1):
        ep1.wall_openings(f"cabwall{s}", -7, 7, s * 1.75, 2.3, 0.1, [(x, 0.32, 0.95, 1.4) for x in (-4.2, -3.2, -2.2, -1.2, -0.2, 0.8, 1.8, 2.8)], wall)
        box(f"bin{s}", (14, 0.55, 0.42), (0, s * 1.42, 2.02), wall, bevel=0.04)
    plane("cabceil", (14, 3.6), (0, 0, 2.35), wall, rot=(180, 0, 0))
    box("cabfront", (0.1, 3.6, 2.4), (6.0, 0, 1.2), wall)
    sky = mat_flat("cabsky", (1, 1, 1), emit=(0.75, 0.88, 1.0), emit_strength=2.2)
    for s in (-1, 1):
        plane(f"cabskyplane{s}", (16, 3), (0, s * 2.3, 1.2), sky, rot=(90, 0, 0))
    seat = mat_flat("cabseat", (0.12, 0.22, 0.48), rough=0.7)
    rows = [-3.2, -2.2, -1.2, -0.2, 0.8, 1.8, 2.8]
    seats = []
    for x in rows:
        for y in (-1.2, -0.72, 0.72, 1.2):
            box(f"cs{x}{y}", (0.46, 0.44, 0.1), (x, y, 0.44), seat, bevel=0.03)
            box(f"cb{x}{y}", (0.1, 0.44, 0.7), (x - 0.27, y, 0.82), seat, rot=(0, -8, 0), bevel=0.03)
            seats.append((x, y, 0.49))
        for s in (-1, 1):
            off = decal(f"belt_off{x}{s}", f"{D6}/seatbelt_off.png", 0.26, (x - 0.1, s * 0.96, 1.8), rot=(180 - 30 * s, 0, 90), emit=0.2)
            on = decal(f"belt_on{x}{s}", f"{D6}/seatbelt_on.png", 0.26, (x - 0.1, s * 0.959, 1.8), rot=(180 - 30 * s, 0, 90), emit=3.0)
            if sign_on:
                on.hide_render = True; on.keyframe_insert("hide_render", frame=sign_on - 1)
                on.hide_render = False; on.keyframe_insert("hide_render", frame=sign_on)
                lib.hide_after(off, sign_on)
            else:
                on.hide_render = True
    box("cockpitdoor", (0.06, 0.8, 1.95), (5.94, 0, 0.98), mat_flat("cdoor", (0.75, 0.76, 0.78), rough=0.4))
    decal("crewonly", f"{D6}/crew_only.png", 0.42, (5.9, 0, 1.55), rot=(90, 0, -90))
    area("cabfill", (0, 0, 2.25), (0, 0, 0), energy=500, size=6, color=(1.0, 0.97, 0.92))
    return seats


def seated_family(seats_xy, sd=True):
    """You by the window (row x, y=-1.2), your wife beside you; kids in the row in front."""
    out = []
    for nm, (x, y) in zip(("you_casual", "wife", "kid_boy", "kid_girl"), seats_xy):
        ch = load_char(nm, (x + 0.06, y, 0), rot_z=90, subdiv=sd)
        pose(ch, SIT)
        settle(ch, "Hips", 0.58 if nm.startswith("kid") else 0.59)
        for side, dy in (("Left", 0.12), ("Right", -0.12)):
            hand_ik(ch, side, empty(f"lap{nm}{side}", (x + 0.36, y + dy, 0.72)))
        out.append(ch)
    return out


def neck_pillow(ch):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.045, location=(0, 0, 0))
    t = bpy.context.object; t.name = "neckpillow"; t.scale = (1.0, 1.0, 0.8)
    t.data.materials.append(mat_flat("pillowc", (0.95, 0.55, 0.15), rough=0.9)); bpy.ops.object.shade_smooth()
    on_bone(ch, t, "Neck", (0, 0.05, -0.02))
    return t


@shot
def sh28():
    """MUCH BETTER! - the cabin: you in the window seat with a neck pillow, the family beside you. Bliss."""
    n = frames_of("sh28")
    cabin_set()
    you, wife, boy, girl = seated_family([(-0.2, -1.2), (-0.2, -0.72), (0.8, -1.2), (0.8, -0.72)])
    neck_pillow(you)
    face(you, 1, SMUG); face(wife, 1, SMILE)
    cam = Cam(lens=24, loc=(1.15, -0.2, 1.45), target=(-0.25, -1.0, 1.05), clip_end=200)
    cam.key(1, loc=(1.15, -0.2, 1.45)); cam.key(n, loc=(1.05, -0.3, 1.42))
    look_at(you, cam.cam, 0.4)
    return n


@shot
def sh29():
    """Peace at last. - closer: you sink back, eyes close, a little smile; clouds glow in the window."""
    n = frames_of("sh29")
    cabin_set()
    you, wife = seated_family([(-0.2, -1.2), (-0.2, -0.72)])
    neck_pillow(you)
    face(you, 1, SERENE); face(you, 16, dict(SLEEP, mouthSmileLeft=0.45, mouthSmileRight=0.45)); face(wife, 1, SLEEP)
    hh = you.world("Head", frame=1)
    cam = Cam(lens=38, loc=(hh.x + 1.3, hh.y + 0.55, hh.z + 0.12), target=(hh.x, hh.y, hh.z), dof=2.4, clip_end=200)
    cam.key(1, loc=(hh.x + 1.3, hh.y + 0.55, hh.z + 0.12)); cam.key(n, loc=(hh.x + 0.95, hh.y + 0.4, hh.z + 0.08))
    return n


@shot
def sh30():
    """But then the seatbelt sign DINGS. - looking up past your face: the sign lights up; your eyes snap open."""
    n = frames_of("sh30")
    on = at("sh30", 50.3)
    cabin_set(sign_on=on)
    you, = seated_family([(-0.2, -1.2)])
    neck_pillow(you)
    face(you, 1, dict(SLEEP, mouthSmileLeft=0.45, mouthSmileRight=0.45)); face(you, on + 2, SHOCK)
    hh = you.world("Head", frame=1)
    cam = Cam(lens=26, loc=(hh.x + 0.55, hh.y + 0.3, hh.z - 0.18), target=(-0.3, -0.95, 1.8), clip_end=200)
    cam.key(1, loc=(hh.x + 0.55, hh.y + 0.3, hh.z - 0.18)); cam.key(n, loc=(hh.x + 0.5, hh.y + 0.32, hh.z - 0.12))
    cam.shake(on, on + 5, amp=0.01, freq=1.0)
    return n


@shot
def sh31():
    """The pilot clears his throat. - slow push down the aisle to the cockpit door: CREW ONLY."""
    n = frames_of("sh31")
    cabin_set(sign_on=1)
    seated_family([(-0.2, -1.2), (-0.2, -0.72)], sd=False)
    cam = Cam(lens=30, loc=(-3.5, 0.0, 1.55), target=(6.0, 0.0, 1.3), clip_end=200)
    cam.key(1, loc=(-3.5, 0.0, 1.55)); cam.key(n, loc=(1.5, 0.0, 1.5))
    return n


def cockpit_set():
    """Cockpit facing +X: windscreen onto cloud tops, the instrument panel, two seats, yokes."""
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.2, rot_z=80)
    sun(energy=3.5, rot=(40, 0, 110), color=(1.0, 0.96, 0.9))
    dark = mat_flat("ckdark", (0.12, 0.12, 0.13), rough=0.5); wall = mat_flat("ckwall", (0.7, 0.71, 0.72), rough=0.5)
    box("ck_floor", (3.0, 2.6, 0.1), (0, 0, -0.05), dark)
    box("ck_back", (0.1, 2.6, 2.2), (-1.4, 0, 1.1), wall)
    decal("ck_door", f"{D6}/crew_only.png", 0.35, (-1.34, 0, 1.6), rot=(90, 0, 90))
    for s in (-1, 1):
        box(f"ck_side{s}", (3.0, 0.1, 0.9), (0, s * 1.3, 0.45), wall)
        box(f"ck_sidetop{s}", (3.0, 0.1, 0.35), (0, s * 1.3, 2.05), wall)
    box("ck_roof", (3.0, 2.7, 0.1), (0, 0, 2.25), wall)
    box("ck_panel", (0.5, 2.4, 0.5), (1.3, 0, 0.95), dark, bevel=0.03)
    decal("ck_gauges", f"{D6}/cockpit_panel.png", 2.2, (1.04, 0, 1.08), rot=(90, 0, -90), emit=1.2)
    glass_m = glass("ckglass", alpha=0.08, tint=(0.5, 0.6, 0.7))
    box("ck_wind", (0.05, 2.5, 0.75), (1.6, 0, 1.65), glass_m, rot=(0, -25, 0))
    for y in (-0.62, 0.62):
        box(f"ckseat{y}", (0.5, 0.5, 0.12), (-0.1, y, 0.45), mat_flat("ckseat", (0.15, 0.15, 0.17), rough=0.6), bevel=0.03)
        box(f"ckseatb{y}", (0.12, 0.5, 0.85), (-0.38, y, 0.95), mat_flat("ckseat", (0.15, 0.15, 0.17), rough=0.6), bevel=0.03)
        box(f"yoke{y}", (0.04, 0.32, 0.12), (0.7, y, 0.95), dark, bevel=0.02)
        strut(f"yokecol{y}", (0.72, y, 0.9), (1.05, y, 0.7), 0.025, dark)
    for k in range(10):
        ep2.cloud((40 + k * 12, -50 + (k % 4) * 30, -14 - (k % 3) * 3), r=9, seed=k)
    area("ck_fill", (0.9, 0, 2.0), (-0.3, 0, 1.2), energy=220, size=1.5, color=(0.95, 0.97, 1.0))


def pilots(sd=True):
    caps = []
    out = []
    for nm, y, col in (("larry", 0.62, (0.95, 0.95, 0.96)), ("dale", -0.62, (0.05, 0.08, 0.2))):
        ch = load_char(nm, (-0.04, y, 0), rot_z=90, subdiv=sd, tag=nm)
        pose(ch, SIT)
        settle(ch, "Hips", 0.6)
        on_bone(ch, ep2.cap(color=col, badge=(0.9, 0.75, 0.2)), "Head", (0, 0.105 if nm == "larry" else 0.118, 0.0))
        wear_shades(ch)
        out.append(ch)
    return out


@shot
def sh32():
    """Good afternoon, family. This is your captain... LARRY. - in the cockpit: Larry, captain's cap, PA handset."""
    n = frames_of("sh32")
    cockpit_set()
    larry, dale = pilots()
    hs = box("handset", (0.05, 0.05, 0.18), (0, 0, 0), mat_flat("hs", (0.05, 0.05, 0.05)), bevel=0.01)
    ep3.hold(larry, hs, "Right", loc=(0.0, 0.08, 0.03), rot=(0, 0, 0))
    hh = larry.world("Head", frame=1)
    hand_ik(larry, "Right", empty("mic", (hh.x + 0.1, hh.y - 0.06, hh.z - 0.08)))
    for side, dy in (("Left", 0.16),):
        hand_ik(larry, side, empty(f"yokeL{side}", (0.7, 0.62 + dy, 0.95)))
    for side, dy in (("Left", 0.14), ("Right", -0.14)):
        hand_ik(dale, side, empty(f"yokeD{side}", (0.7, -0.62 + dy, 0.95)))
    face(dale, 1, GRIN)
    syl = [(52.96, 53.06, 0.3, 0.2), (53.06, 53.4, 0.35, 0.1), (53.4, 53.76, 0.3, 0.0), (53.76, 54.34, 0.25, 0.0),
           (54.34, 54.62, 0.25, 0.1), (54.62, 54.96, 0.35, 0.0), (55.46, 55.54, 0.45, 0.0), (55.54, 55.9, 0.3, 0.0)]
    lipsync(larry, lambda t: at("sh32", t), syl, base=GRIN)
    cam = Cam(lens=26, loc=(1.0, 0.25, 1.38), target=(-0.1, 0.4, 1.25), clip_end=3000)
    cam.key(1, loc=(1.0, 0.25, 1.38)); cam.key(n, loc=(0.9, 0.42, 1.36), target=(-0.1, 0.55, 1.28))
    look_at(larry, cam.cam, 0.6)
    return n


@shot
def sh33():
    """and your co-pilot... DALE. - Dale, navy cap, gives a slow salute; Larry presents him with an open palm."""
    n = frames_of("sh33")
    cockpit_set()
    larry, dale = pilots()
    hh = dale.world("Head", frame=1)
    t = empty("salute", (0, 0, 0))
    key_loc(t, 1, (hh.x + 0.35, hh.y + 0.1, hh.z - 0.5)); key_loc(t, 16, (hh.x + 0.08, hh.y + 0.06, hh.z + 0.08))
    key_loc(t, n, (hh.x + 0.08, hh.y + 0.06, hh.z + 0.09))
    hand_ik(dale, "Left", t)
    hand_ik(dale, "Right", empty("yokeDR", (0.7, -0.76, 0.95)))
    lh = larry.world("Head", frame=1)
    hand_ik(larry, "Right", empty("present", (lh.x + 0.4, lh.y - 0.45, lh.z - 0.25)))
    face(dale, 1, DEADPAN); face(dale, 14, GRIN); face(larry, 1, GRIN)
    lipsync(larry, lambda t_: at("sh33", t_), [(56.16, 56.38, 0.25, 0.1), (56.38, 56.92, 0.3, 0.0), (57.38, 57.5, 0.35, 0.0)], base=GRIN)
    cam = Cam(lens=30, loc=(0.95, -0.2, 1.38), target=(-0.1, -0.5, 1.28), clip_end=3000)
    cam.key(1, loc=(0.95, -0.2, 1.38)); cam.key(n, loc=(0.85, -0.38, 1.36))
    look_at(dale, cam.cam, 0.7); look_head(larry, dale, 0.6)
    return n


@shot
def sh34():
    """ARE WE THERE YET? - both turn to camera, lean in together and ask in unison, grinning."""
    n = frames_of("sh34")
    cockpit_set()
    larry, dale = pilots()
    for ch, y in ((larry, 0.62), (dale, -0.62)):
        pose_seq(ch, [(1, SIT), (10, dict(SIT, lowerback={"rx": 16}, upperback={"rx": 8})), (n, dict(SIT, lowerback={"rx": 18}, upperback={"rx": 9}))], n)
        for side, dy in (("Left", 0.15), ("Right", -0.15)):
            hand_ik(ch, side, empty(f"yk{ch.name}{side}", (0.7, y + dy, 0.95)))
        face(ch, 1, GRIN)
        lipsync(ch, lambda t: at("sh34", t), [(58.18, 58.28, 0.4, 0.0), (58.28, 58.38, 0.2, 0.3), (58.38, 58.54, 0.3, 0.0),
                                             (58.54, 58.74, 0.35, 0.2)], base=GRIN)
        face(ch, at("sh34", 59.0), GRIN)
    cam = Cam(lens=24, loc=(1.05, 0.0, 1.35), target=(-0.1, 0.0, 1.25), clip_end=3000)
    cam.key(1, loc=(1.05, 0.0, 1.35)); cam.key(n, loc=(0.85, 0.0, 1.33))
    for ch in (larry, dale):
        stare_at(ch, cam.cam, 1, 6)
    return n


@shot
def sh35():
    """(end) - above the clouds: the airliner cruises on... with a tiny red car strapped to its roof."""
    n = frames_of("sh35")
    world_hdri("kloofendal_48d_partly_cloudy_puresky", strength=1.2, rot_z=80)
    sun(energy=4.0, rot=(40, 0, 120), color=(1.0, 0.96, 0.9))
    jet = plane_model()
    red = Car("tiny", "tiny", (0.75, 0.04, 0.04), interior=False)
    red.root.parent = jet; red.root.location = (1.0, 0, 1.88); red.root.scale = (1.4, 1.4, 1.4)
    rope = mat_flat("rope", (0.75, 0.62, 0.35), rough=0.9)
    for x in (-0.4, 2.4):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.98, minor_radius=0.035, location=(x, 0, 0), rotation=(0, math.radians(90), 0))
        r = bpy.context.object; r.data.materials.append(rope); r.parent = jet
    for k in range(18):
        ep2.cloud((-200 + k * 26, -40 + (k % 5) * 22, -22 - (k % 3) * 4), r=10, seed=k + 30)
    key_loc(jet, 1, (0, 0, 0), interp="LINEAR"); key_loc(jet, n, (28, 0, 0.3), interp="LINEAR")
    jet.rotation_euler = (math.radians(3), 0, 0)
    cam = Cam(lens=28, loc=(14, -30, 6), target=(0, 0, 1.0), clip_end=5000)
    tr = tracker("trk", [(1, (0, 0)), (n, (28, 0))])
    follow(tr, cam)
    cam.key(1, loc=(14, -30, 6)); cam.key(n, loc=(8, -26, 4.5))
    return n
