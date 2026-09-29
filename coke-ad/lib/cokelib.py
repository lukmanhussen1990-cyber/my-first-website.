"""Shared scene & asset library for the Coca-Cola spec ad.

Everything is procedural: geometry is generated with numpy, textures with Pillow,
and all animation is analytic (driven by the frame number) so any frame can be
rendered on its own.  Units are meters.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.interpolate import CubicSpline, PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(ROOT, "assets", "fonts")
SCRATCH = os.environ.get(
    "COKE_SCRATCH",
    "/tmp/claude-0/-home-user-my-first-website-/0735c37f-ff6b-57d4-b08a-d20fb3844685/scratchpad",
)
TEX = os.path.join(SCRATCH, "tex")
os.makedirs(TEX, exist_ok=True)

CM = 0.01
MM = 0.001
COKE_RED = (0.80, 0.0, 0.022)  # linear-sRGB approximation of the brand red
WORDMARK_FONT = os.path.join(FONTS, "DancingScript-Bold.otf")

# ---------------------------------------------------------------------------
# scene setup
# ---------------------------------------------------------------------------

_frame_callbacks = []


def _frame_handler(scene, *_):
    f = scene.frame_current + scene.frame_subframe
    for cb in _frame_callbacks:
        cb(f)


def on_frame(cb):
    """Register cb(frame_float) to run before every frame (and motion-blur subframe) is evaluated."""
    _frame_callbacks.append(cb)
    return cb


def reset_scene(res=None, samples=None, fps=24, look="AgX - Medium High Contrast"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _frame_callbacks.clear()
    for h in list(bpy.app.handlers.frame_change_pre):
        bpy.app.handlers.frame_change_pre.remove(h)
    bpy.app.handlers.frame_change_pre.append(_frame_handler)

    sc = bpy.context.scene
    env_res = os.environ.get("COKE_RES")
    if env_res:
        res = tuple(int(v) for v in env_res.lower().split("x"))
    res = res or (1280, 720)
    env_s = os.environ.get("COKE_SAMPLES")
    samples = int(env_s) if env_s else (samples or 32)

    r = sc.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.fps = fps
    r.film_transparent = False
    r.use_persistent_data = True
    r.filter_size = 1.2
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "16"
    r.use_motion_blur = False
    r.motion_blur_shutter = 0.5

    c = sc.cycles
    c.device = "CPU"
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.adaptive_min_samples = 0
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_prefilter = "ACCURATE"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    c.denoising_quality = "HIGH"
    c.max_bounces = 16
    c.diffuse_bounces = 2
    c.glossy_bounces = 5
    c.transmission_bounces = 16
    c.volume_bounces = 0
    c.transparent_max_bounces = 8
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 0.4
    c.sample_clamp_direct = 0.0
    c.sample_clamp_indirect = 6.0
    c.use_animated_seed = True
    c.use_light_tree = True

    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = look
    sc.view_settings.exposure = 0.0

    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    sc.frame_start = 1
    sc.frame_end = 1
    return sc


# ---------------------------------------------------------------------------
# small math helpers
# ---------------------------------------------------------------------------


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ease_in_out(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ease_out(t, p=2.0):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** p


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------------------
# mesh helpers
# ---------------------------------------------------------------------------


def mesh_from_arrays(name, V, faces, loop_uvs=None, mat_index=None, smooth=True):
    """V: (N,3); faces: (M,k) int array or list of int arrays; loop_uvs: {'name': (L,2)} per loop."""
    me = bpy.data.meshes.new(name)
    V = np.asarray(V, dtype=np.float32)
    if isinstance(faces, np.ndarray):
        loops = faces.ravel().astype(np.int32)
        sizes = np.full(len(faces), faces.shape[1], dtype=np.int32)
    else:
        sizes = np.array([len(f) for f in faces], dtype=np.int32)
        loops = np.concatenate(faces).astype(np.int32)
    starts = np.zeros(len(sizes), dtype=np.int32)
    starts[1:] = np.cumsum(sizes)[:-1]
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.ravel())
    me.loops.add(len(loops))
    me.loops.foreach_set("vertex_index", loops)
    me.polygons.add(len(sizes))
    me.polygons.foreach_set("loop_start", starts)
    if mat_index is not None:
        me.polygons.foreach_set("material_index", np.asarray(mat_index, dtype=np.int32))
    me.update(calc_edges=True)
    if loop_uvs:
        for uvname, uv in loop_uvs.items():
            layer = me.uv_layers.new(name=uvname)
            layer.data.foreach_set("uv", np.asarray(uv, dtype=np.float32).ravel())
    if smooth:
        me.polygons.foreach_set("use_smooth", np.ones(len(sizes), dtype=bool))
    me.update()
    return me


def new_object(name, data, parent=None, collection=None):
    ob = bpy.data.objects.new(name, data)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def new_empty(name, loc=(0, 0, 0), parent=None, size=0.05):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = size
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent is not None:
        ob.parent = parent
    return ob


def set_verts(me, V):
    me.vertices.foreach_set("co", np.asarray(V, dtype=np.float32).ravel())
    me.update()


def resample_profile(pts, n):
    """Smooth a polyline of (r, z) control points with a chord-length spline and resample it by arc length."""
    pts = np.asarray(pts, dtype=float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    csr = PchipInterpolator(d, pts[:, 0])
    csz = PchipInterpolator(d, pts[:, 1])
    fine = np.linspace(0, d[-1], 4000)
    P = np.c_[csr(fine), csz(fine)]
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, s[-1], n)
    return np.c_[np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])]


def lathe_verts(profile, T, radial=None, theta0=0.0):
    """Vertex positions only (same ordering as lathe()), vectorised for per-frame updates."""
    prof = np.asarray(profile, dtype=float)
    th = theta0 + 2 * np.pi * np.arange(T) / T
    pole = prof[:, 0] < 1e-9
    out = []
    for i in range(len(prof)):
        r, z = prof[i]
        if pole[i]:
            out.append(np.array([[0.0, 0.0, z]]))
        else:
            out.append(None)
    ring_idx = np.where(~pole)[0]
    R = prof[ring_idx, 0][:, None]
    Z = np.broadcast_to(prof[ring_idx, 1][:, None], (len(ring_idx), T))
    if radial is not None:
        R = R * radial(th[None, :], Z)
    ringV = np.stack([R * np.cos(th)[None, :] * np.ones_like(Z), R * np.sin(th)[None, :] * np.ones_like(Z), Z], axis=-1)
    for k, i in enumerate(ring_idx):
        out[i] = ringV[k]
    return np.concatenate(out)


def lathe(profile, T, radial=None, theta0=0.0, uv_v=None):
    """Revolve a (r,z) profile around Z.

    profile points with r == 0 become poles.  radial(theta, z) -> multiplier for r.
    Returns V, faces(list), loop_uv (per-loop u,v), ring index per face.
    Normals point to the right of the profile direction (outward when the profile runs up the outside).
    """
    prof = np.asarray(profile, dtype=float)
    P = len(prof)
    th = theta0 + 2 * np.pi * np.arange(T) / T
    if uv_v is None:
        uv_v = prof[:, 1]
    verts = []
    index = np.zeros((P, T), dtype=np.int64)
    pole = prof[:, 0] < 1e-9
    n = 0
    for i in range(P):
        r, z = prof[i]
        if pole[i]:
            verts.append(np.array([[0.0, 0.0, z]]))
            index[i, :] = n
            n += 1
        else:
            m = radial(th, z) if radial else np.ones(T)
            rr = r * m
            verts.append(np.c_[rr * np.cos(th), rr * np.sin(th), np.full(T, z)])
            index[i, :] = n + np.arange(T)
            n += T
    V = np.concatenate(verts)
    faces, uvs, ring = [], [], []
    for i in range(P - 1):
        for j in range(T):
            j1 = (j + 1) % T
            a, b, c, d = index[i, j], index[i, j1], index[i + 1, j1], index[i + 1, j]
            u0, u1 = j / T, (j + 1) / T
            v0, v1 = uv_v[i], uv_v[i + 1]
            if pole[i] and pole[i + 1]:
                continue
            if pole[i]:
                faces.append([a, c, d])
                uvs.append([(0.5 * (u0 + u1), v0), (u1, v1), (u0, v1)])
            elif pole[i + 1]:
                faces.append([a, b, c])
                uvs.append([(u0, v0), (u1, v0), (0.5 * (u0 + u1), v1)])
            else:
                faces.append([a, b, c, d])
                uvs.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
            ring.append(i)
    faces = [np.array(f) for f in faces]
    loop_uv = np.array([uv for f in uvs for uv in f], dtype=np.float32)
    return V, faces, loop_uv, np.array(ring)


# ---------------------------------------------------------------------------
# textures
# ---------------------------------------------------------------------------


def _load_image(path, name=None, colorspace="sRGB"):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def wordmark_image(path, width=8192, height=2048, copies=((0.75, 1.0), (0.25, 1.0)), text="Coca-Cola",
                   text_w_frac=0.31, font=WORDMARK_FONT, extra_lines=True):
    """White script wordmark on transparent, for a cylindrical wrap (x = around, y = up)."""
    if os.path.exists(path):
        return path
    ss = 1
    img = Image.new("L", (width * ss, height * ss), 0)
    d = ImageDraw.Draw(img)
    target_w = text_w_frac * width * ss
    size = 400
    f = ImageFont.truetype(font, size)
    bb = d.textbbox((0, 0), text, font=f)
    size = int(size * target_w / (bb[2] - bb[0]))
    f = ImageFont.truetype(font, size)
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    for cx, _ in copies:
        x = cx * width * ss - tw / 2 - bb[0]
        y = height * ss * 0.5 - th / 2 - bb[1]
        d.text((x, y), text, font=f, fill=255)
        if extra_lines:
            # small secondary line of type beneath the wordmark, like the real ACL
            fs = ImageFont.truetype(os.path.join(FONTS, "montserrat-600-normal.ttf"), int(height * 0.075))
            sub = "T R A D E M A R K    R E G I S T E R E D"
            sb = d.textbbox((0, 0), sub, font=fs)
            d.text((cx * width * ss - (sb[2] - sb[0]) / 2, height * ss * 0.86), sub, font=fs, fill=200)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    rgba = Image.merge("RGBA", (Image.new("L", img.size, 255),) * 3 + (img,))
    rgba.save(path)
    return path


def condensation_map(path, seed=7, width=2048, height=2048, n_runs=26, z_top=0.165, H=0.196, radius=0.029,
                     z_runs=(0.07, 0.16)):
    """R = mist density, G = run (wiped streak) mask. x = around (u), y = height (v = z/H)."""
    if os.path.exists(path):
        return path
    rng = np.random.default_rng(seed)
    yy = (np.arange(height)[::-1, None] + 0.5) / height * H  # z for each row (row 0 = top)
    xx = (np.arange(width)[None, :] + 0.5) / width
    # mist: cold where the liquid is, fading above the fill line and near the base
    mist = smoothstep(z_top + 0.004, z_top - 0.012, yy) * smoothstep(0.002, 0.012, yy)
    mist = np.broadcast_to(mist, (height, width)).copy()
    # low-frequency variation
    noise = np.zeros((height, width))
    for k in range(6):
        fx, fz = rng.integers(1, 6), rng.uniform(4, 20)
        ph, ph2 = rng.uniform(0, 2 * np.pi, 2)
        noise += np.sin(2 * np.pi * fx * xx + ph) * np.sin(fz * yy / H * np.pi * 2 + ph2) / (k + 1)
    mist *= np.clip(0.78 + 0.22 * noise, 0, 1)
    runs = np.zeros((height, width))
    run_list = []
    for i in range(n_runs):
        u0 = rng.uniform(0, 1)
        z0 = rng.uniform(*z_runs)
        length = rng.uniform(0.015, 0.07)
        z1 = max(0.01, z0 - length)
        w = rng.uniform(0.0011, 0.0022)
        run_list.append((u0, z0, z1, w))
        rows = np.where((yy[:, 0] <= z0) & (yy[:, 0] >= z1))[0]
        for rrow in rows:
            z = yy[rrow, 0]
            wob = 0.0012 * np.sin(z * 900 + i) + 0.0006 * np.sin(z * 2300 + 3 * i)
            uc = u0 + wob / (2 * np.pi * radius)
            du = (xx[0] - uc + 0.5) % 1.0 - 0.5
            dist = np.abs(du) * 2 * np.pi * radius
            taper = 0.6 + 0.4 * (z0 - z) / max(z0 - z1, 1e-6)
            m = smoothstep(w * taper, w * taper * 0.55, dist)
            runs[rrow] = np.maximum(runs[rrow], m)
    mist = mist * (1 - 0.92 * runs)
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[..., 0] = np.clip(mist * 255, 0, 255)
    img[..., 1] = np.clip(runs * 255, 0, 255)
    Image.fromarray(img).save(path)
    np.save(path + ".runs.npy", np.array(run_list))
    return path


# ---------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------


def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def _principled(nodes, **kw):
    p = nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        p.inputs[k].default_value = v
    return p


def mat_simple(name, **kw):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **kw)
    L.new(p.outputs[0], out.inputs[0])
    return m


def _noise(N, L, scale, detail=4.0, coord="Object", roughness=0.5):
    tc = N.new("ShaderNodeTexCoord")
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nz.inputs["Roughness"].default_value = roughness
    L.new(tc.outputs[coord], nz.inputs["Vector"])
    return nz


def _map_range(N, L, src, a, b, c, d):
    mr = N.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = a
    mr.inputs["From Max"].default_value = b
    mr.inputs["To Min"].default_value = c
    mr.inputs["To Max"].default_value = d
    L.new(src, mr.inputs["Value"])
    return mr.outputs["Result"]


def mat_glass(name="Glass", tint=(0.975, 0.99, 0.982), rough=(0.0, 0.012)):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (*tint, 1), "Transmission Weight": 1.0, "IOR": 1.5, "Roughness": 0.0})
    nz = _noise(N, L, 60.0, 3)
    L.new(_map_range(N, L, nz.outputs["Fac"], 0.35, 0.75, rough[0], rough[1]), p.inputs["Roughness"])
    # faint waviness of blown glass
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.035
    nz2 = _noise(N, L, 140.0, 2)
    L.new(nz2.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], p.inputs["Normal"])
    L.new(p.outputs[0], out.inputs[0])
    return m


def mat_bottle_outer(name="BottleOuter", mist_strength=1.0, label_path=None, cond_path=None,
                     z0=0.074, z1=0.116, H=0.196, micro_bump=None):
    """Outer skin of the bottle: glass + condensation mist + white ACL wordmark paint."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    uv = N.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    tc = N.new("ShaderNodeTexCoord")

    glass = _principled(N, **{"Base Color": (0.975, 0.99, 0.982, 1), "Transmission Weight": 1.0, "IOR": 1.5,
                              "Roughness": 0.0})
    nzr = _noise(N, L, 60.0, 3)
    L.new(_map_range(N, L, nzr.outputs["Fac"], 0.35, 0.75, 0.0, 0.012), glass.inputs["Roughness"])

    # condensation map (x = around, y = z/H)
    cond = N.new("ShaderNodeTexImage")
    cond.image = _load_image(cond_path, colorspace="Non-Color")
    cond.interpolation = "Cubic"
    L.new(uv.outputs["UV"], cond.inputs["Vector"])
    sep = N.new("ShaderNodeSeparateColor")
    L.new(cond.outputs["Color"], sep.inputs[0])
    mist_amt = N.new("ShaderNodeMath")
    mist_amt.operation = "MULTIPLY"
    mist_amt.inputs[1].default_value = mist_strength
    L.new(sep.outputs[0], mist_amt.inputs[0])
    mist_amt.label = "mist_strength"
    mist_amt.name = "mist_strength"

    # micro droplets: voronoi domes -> bump
    vor = N.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.distance = "EUCLIDEAN"
    vor.inputs["Scale"].default_value = 5200.0
    vor.inputs["Randomness"].default_value = 1.0
    L.new(tc.outputs["Object"], vor.inputs["Vector"])
    dome = N.new("ShaderNodeMath")
    dome.operation = "POWER"
    one_minus = N.new("ShaderNodeMath")
    one_minus.operation = "SUBTRACT"
    one_minus.inputs[0].default_value = 1.0
    L.new(vor.outputs["Distance"], one_minus.inputs[1])
    dome.inputs[1].default_value = 0.6
    L.new(one_minus.outputs[0], dome.inputs[0])
    vor2 = N.new("ShaderNodeTexVoronoi")
    vor2.inputs["Scale"].default_value = 2400.0
    L.new(tc.outputs["Object"], vor2.inputs["Vector"])
    om2 = N.new("ShaderNodeMath")
    om2.operation = "SUBTRACT"
    om2.inputs[0].default_value = 1.0
    L.new(vor2.outputs["Distance"], om2.inputs[1])
    thr2 = _map_range(N, L, om2.outputs[0], 0.25, 0.9, 0.0, 1.0)
    hsum = N.new("ShaderNodeMath")
    hsum.operation = "ADD"
    L.new(dome.outputs[0], hsum.inputs[0])
    L.new(thr2, hsum.inputs[1])
    hmul = N.new("ShaderNodeMath")
    hmul.operation = "MULTIPLY"
    L.new(hsum.outputs[0], hmul.inputs[0])
    L.new(mist_amt.outputs[0], hmul.inputs[1])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.00008
    L.new(hmul.outputs[0], bump.inputs["Height"])

    misted = _principled(N, **{"Base Color": (0.95, 0.97, 0.98, 1), "Transmission Weight": 1.0, "IOR": 1.36,
                               "Roughness": 0.16})
    if micro_bump is None:
        micro_bump = os.environ.get("COKE_MICROBUMP", "0") == "1"
    if micro_bump:
        L.new(bump.outputs["Normal"], misted.inputs["Normal"])
    haze = N.new("ShaderNodeBsdfTranslucent")
    haze.inputs["Color"].default_value = (0.9, 0.93, 0.95, 1)
    haze_mix = N.new("ShaderNodeMixShader")
    haze_mix.inputs[0].default_value = 0.03
    L.new(misted.outputs[0], haze_mix.inputs[1])
    L.new(haze.outputs[0], haze_mix.inputs[2])

    mix_mist = N.new("ShaderNodeMixShader")
    mclamp = _map_range(N, L, mist_amt.outputs[0], 0.0, 1.0, 0.0, 0.92)
    L.new(mclamp, mix_mist.inputs[0])
    L.new(glass.outputs[0], mix_mist.inputs[1])
    L.new(haze_mix.outputs[0], mix_mist.inputs[2])

    shader = mix_mist.outputs[0]
    if label_path:
        mp = N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, H / (z1 - z0), 1.0)
        mp.inputs["Location"].default_value = (0.0, -z0 / (z1 - z0), 0.0)
        L.new(uv.outputs["UV"], mp.inputs["Vector"])
        lab = N.new("ShaderNodeTexImage")
        lab.image = _load_image(label_path)
        lab.extension = "CLIP"
        lab.interpolation = "Cubic"
        L.new(mp.outputs["Vector"], lab.inputs["Vector"])
        paint = _principled(N, **{"Base Color": (0.86, 0.86, 0.84, 1), "Roughness": 0.32,
                                  "Subsurface Weight": 0.15, "Subsurface Radius": (0.001, 0.001, 0.001)})
        pbump = N.new("ShaderNodeBump")
        pbump.inputs["Strength"].default_value = 0.4
        pbump.inputs["Distance"].default_value = 0.0002
        L.new(lab.outputs["Alpha"], pbump.inputs["Height"])
        if micro_bump:
            L.new(bump.outputs["Normal"], pbump.inputs["Normal"])
        L.new(pbump.outputs["Normal"], paint.inputs["Normal"])
        prough = _map_range(N, L, mist_amt.outputs[0], 0.0, 1.0, 0.25, 0.5)
        L.new(prough, paint.inputs["Roughness"])
        mix_l = N.new("ShaderNodeMixShader")
        L.new(lab.outputs["Alpha"], mix_l.inputs[0])
        L.new(shader, mix_l.inputs[1])
        L.new(paint.outputs[0], mix_l.inputs[2])
        shader = mix_l.outputs[0]
    L.new(shader, out.inputs[0])
    return m


def cola_absorption(depth_rgb_m=(0.010, 0.0040, 0.0020)):
    """Absorption coefficients (1/m) from the depth at which each channel falls to 1/e."""
    return tuple(1.0 / d for d in depth_rgb_m)


def mat_cola(name="Cola", sigma=None, ior=1.34):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.cycles.homogeneous_volume = True
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "IOR": ior, "Roughness": 0.0})
    L.new(p.outputs[0], out.inputs["Surface"])
    sig = np.array(sigma or cola_absorption())
    dens = float(sig.max())
    va = N.new("ShaderNodeVolumeAbsorption")
    va.inputs["Color"].default_value = (*(1 - sig / dens), 1)
    va.inputs["Density"].default_value = dens
    L.new(va.outputs[0], out.inputs["Volume"])
    return m


def mat_water(name="Water"):
    return mat_simple(name, **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "IOR": 1.333,
                               "Roughness": 0.0})


def mat_bubble(name="Bubble", ior=1.0 / 1.34):
    return mat_simple(name, **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "IOR": ior,
                               "Roughness": 0.0})


def mat_ice(name="Ice"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (0.97, 0.985, 1.0, 1), "Transmission Weight": 1.0, "IOR": 1.31,
                          "Roughness": 0.02})
    nz = _noise(N, L, 90.0, 5)
    L.new(_map_range(N, L, nz.outputs["Fac"], 0.4, 0.75, 0.0, 0.14), p.inputs["Roughness"])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.0005
    nz2 = _noise(N, L, 260.0, 3)
    L.new(nz2.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], p.inputs["Normal"])
    L.new(p.outputs[0], out.inputs["Surface"])
    return m


def mat_ice_core(name="IceCore"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.cycles.homogeneous_volume = False
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    tr = N.new("ShaderNodeBsdfTransparent")
    L.new(tr.outputs[0], out.inputs["Surface"])
    vs = N.new("ShaderNodeVolumeScatter")
    vs.inputs["Color"].default_value = (0.95, 0.97, 1.0, 1)
    nz = _noise(N, L, 300.0, 4)
    dens = _map_range(N, L, nz.outputs["Fac"], 0.45, 0.7, 0.0, 250.0)
    L.new(dens, vs.inputs["Density"])
    L.new(vs.outputs[0], out.inputs["Volume"])
    return m


def mat_cap_paint(name="CapPaint", label_path=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (0.62, 0.004, 0.012, 1), "Metallic": 0.55, "Roughness": 0.28,
                          "Coat Weight": 1.0, "Coat Roughness": 0.06})
    nz = _noise(N, L, 400.0, 2)
    L.new(_map_range(N, L, nz.outputs["Fac"], 0.3, 0.7, 0.22, 0.36), p.inputs["Roughness"])
    shader = p.outputs[0]
    if label_path:
        tc = N.new("ShaderNodeTexCoord")
        mp = N.new("ShaderNodeMapping")
        # object-space x,y in [-0.0135, 0.0135] -> [0,1]
        mp.inputs["Scale"].default_value = (1 / 0.027, 1 / 0.027, 1)
        mp.inputs["Location"].default_value = (0.5, 0.5, 0)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        img = N.new("ShaderNodeTexImage")
        img.image = _load_image(label_path)
        img.extension = "CLIP"
        L.new(mp.outputs["Vector"], img.inputs["Vector"])
        white = _principled(N, **{"Base Color": (0.85, 0.85, 0.83, 1), "Roughness": 0.3, "Coat Weight": 1.0,
                                  "Coat Roughness": 0.06})
        # only on the top face (normal z > 0.9)
        geo = N.new("ShaderNodeNewGeometry")
        sepn = N.new("ShaderNodeSeparateXYZ")
        vt = N.new("ShaderNodeVectorTransform")
        vt.vector_type = "NORMAL"
        vt.convert_from = "WORLD"
        vt.convert_to = "OBJECT"
        L.new(geo.outputs["Normal"], vt.inputs[0])
        L.new(vt.outputs[0], sepn.inputs[0])
        top = _map_range(N, L, sepn.outputs["Z"], 0.95, 0.99, 0.0, 1.0)
        fac = N.new("ShaderNodeMath")
        fac.operation = "MULTIPLY"
        L.new(img.outputs["Alpha"], fac.inputs[0])
        L.new(top, fac.inputs[1])
        mx = N.new("ShaderNodeMixShader")
        L.new(fac.outputs[0], mx.inputs[0])
        L.new(shader, mx.inputs[1])
        L.new(white.outputs[0], mx.inputs[2])
        shader = mx.outputs[0]
    L.new(shader, out.inputs["Surface"])
    return m


def mat_cap_inner(name="CapInner"):
    return mat_simple(name, **{"Base Color": (0.55, 0.55, 0.56, 1), "Metallic": 1.0, "Roughness": 0.35})


def mat_foam(name="Foam"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (0.52, 0.30, 0.17, 1), "Roughness": 0.12, "Subsurface Weight": 0.6,
                          "Subsurface Radius": (0.004, 0.0018, 0.0009), "Subsurface Scale": 1.0,
                          "Coat Weight": 0.6, "Coat Roughness": 0.02, "Transmission Weight": 0.25, "IOR": 1.33})
    L.new(p.outputs[0], out.inputs["Surface"])
    return m


def mat_emission(name, color, strength):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    e = N.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    L.new(e.outputs[0], out.inputs["Surface"])
    return m


# ---------------------------------------------------------------------------
# contour bottle
# ---------------------------------------------------------------------------

BOTTLE_H = 0.196
BOTTLE_OUTER_CM = [
    # (r, z) in cm, from the base centre (punt) out and up to the mouth
    (0.0, 0.62), (0.9, 0.52), (1.6, 0.30), (2.05, 0.10), (2.30, 0.0), (2.52, 0.03), (2.70, 0.13),
    (2.80, 0.32), (2.88, 0.75), (2.92, 1.6), (2.80, 3.0), (2.60, 4.4), (2.63, 5.4), (2.80, 6.6),
    (2.96, 7.8), (3.02, 9.3), (2.97, 10.8), (2.74, 12.0), (2.35, 13.2), (1.88, 14.3), (1.48, 15.3),
    (1.28, 16.3), (1.19, 17.4), (1.20, 18.3), (1.25, 18.55), (1.37, 18.72), (1.405, 18.92),
    (1.38, 19.14), (1.31, 19.33), (1.24, 19.5), (1.12, 19.6),
]
BOTTLE_LIP_TOP = 0.1960
LABEL_Z0, LABEL_Z1 = 0.074, 0.116


def _window(z, a, b, fade):
    return smoothstep(a, a + fade, z) * smoothstep(b, b - fade, z)


def bottle_flute_radial(n=12, amp_low=0.050, amp_up=0.060, lo=(0.009, 0.0735), up=(0.1175, 0.160)):
    def f(th, z):
        u = (n * th / (2 * np.pi)) % 1.0
        x = 2 * u - 1
        prof = 1 - np.sqrt(np.clip(1 - x * x, 0, 1)) ** 0.9  # 0 at rib crest, 1 at the groove
        prof = prof ** 1.6
        amp = amp_low * _window(z, lo[0], lo[1], 0.009) + amp_up * _window(z, up[0], up[1], 0.012)
        return 1 - amp * prof
    return f


def _outer_profile(n=420):
    pts = np.array(BOTTLE_OUTER_CM) * CM
    return resample_profile(pts, n)


def _offset_inward(prof, thickness_fn):
    d = np.gradient(prof, axis=0)
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    normal = np.c_[d[:, 1], -d[:, 0]]  # right of the direction = outward for an upward outer profile
    t = thickness_fn(prof[:, 1])
    return prof - normal * t[:, None]


def bottle_profiles():
    """Returns (outer, inner) (r,z) profiles in meters. inner runs from the mouth down to the inner base centre."""
    outer = _outer_profile()
    body = outer[outer[:, 1] > 0.011]
    body = body[body[:, 0] > 0]

    def thick(z):
        return 0.0030 + 0.0012 * smoothstep(0.03, 0.012, z) + 0.0006 * smoothstep(0.15, 0.175, z)

    inner = _offset_inward(body, thick)
    inner = inner[(inner[:, 1] > 0.0135) & (inner[:, 1] < 0.1942)]
    inner[:, 0] = np.maximum(inner[:, 0], 0.0082)
    # inner bottom (thick glass base with a gently domed floor)
    rb = inner[0, 0]
    zb = inner[0, 1]
    bottom = np.array([(rb * 0.8, zb - 0.0012), (rb * 0.45, zb - 0.0010), (0.0, zb - 0.0006)])
    inner = np.vstack([inner[::-1], bottom])  # from top (mouth) down to the axis
    lip = np.array([(0.0112, 0.1960), (0.0100, 0.19605), (0.0090, 0.1955)])
    return outer, inner, lip


class LatheSurface:
    """Analytic outer surface r(z) * radial(theta, z) used to place droplets on bottle/glass."""

    def __init__(self, outer_profile, radial, zmin, zmax, rmin=0.005):
        side = outer_profile[(outer_profile[:, 1] > zmin) & (outer_profile[:, 1] < zmax) & (outer_profile[:, 0] > rmin)]
        side = side[np.argsort(side[:, 1])]
        _, idx = np.unique(np.round(side[:, 1], 7), return_index=True)
        side = side[idx]
        self.cs = CubicSpline(side[:, 1], side[:, 0])
        self.radial = radial
        self.r0 = float(np.median(side[:, 0]))

    def point(self, theta, z):
        cs, radial = self.cs, self.radial
        r = cs(z) * radial(theta, z)
        P = np.c_[r * np.cos(theta), r * np.sin(theta), z]
        eps = 1e-4
        r_z = (cs(z + eps) * radial(theta, z + eps) - cs(z - eps) * radial(theta, z - eps)) / (2 * eps)
        r_t = (cs(z) * radial(theta + eps, z) - cs(z) * radial(theta - eps, z)) / (2 * eps)
        dPdz = np.c_[r_z * np.cos(theta), r_z * np.sin(theta), np.ones_like(z)]
        dPdt = np.c_[r_t * np.cos(theta) - r * np.sin(theta), r_t * np.sin(theta) + r * np.cos(theta),
                     np.zeros_like(z)]
        Nrm = np.cross(dPdt, dPdz)
        Nrm /= np.linalg.norm(Nrm, axis=1, keepdims=True)
        tz = dPdz / np.linalg.norm(dPdz, axis=1, keepdims=True)
        return P, Nrm, tz


_BOTTLE_SURF = None


def bottle_surface():
    global _BOTTLE_SURF
    if _BOTTLE_SURF is None:
        _BOTTLE_SURF = LatheSurface(_outer_profile(900), bottle_flute_radial(), 0.004, 0.1955, 0.012)
    return _BOTTLE_SURF


def bottle_surface_point(theta, z, radial=None):
    return bottle_surface().point(theta, z)


def _cap_template(seg=14, rings=5):
    """Unit droplet: dome over the unit disc in XY, height 1 along +Z, closed at the base. Returns V, F."""
    V = [(0, 0, 1.0)]
    for k in range(1, rings + 1):
        phi = (k / rings) * (np.pi / 2)
        for s in range(seg):
            a = 2 * np.pi * s / seg
            V.append((np.sin(phi) * np.cos(a), np.sin(phi) * np.sin(a), np.cos(phi)))
    V.append((0, 0, 0))
    V = np.array(V)
    F = []
    for s in range(seg):
        F.append([0, 1 + s, 1 + (s + 1) % seg])
    for k in range(rings - 1):
        b0, b1 = 1 + k * seg, 1 + (k + 1) * seg
        for s in range(seg):
            s1 = (s + 1) % seg
            F.append([b0 + s, b1 + s, b1 + s1, b0 + s1])
    last = 1 + (rings - 1) * seg
    c = len(V) - 1
    for s in range(seg):
        F.append([c, last + (s + 1) % seg, last + s])
    return V, F


def droplets_mesh(name, P, Nrm, tz, rt, rz, h, embed=0.00005, seg=14, rings=5, sag=None):
    """Instance droplet domes at surface points. rt/rz: tangential and vertical radii, h: height."""
    TV, TF = _cap_template(seg, rings)
    if sag is None:
        sag = np.zeros(len(P))
    tt = np.cross(Nrm, tz)
    tt /= np.linalg.norm(tt, axis=1, keepdims=True)
    tzv = np.cross(tt, Nrm)
    nv = len(TV)
    x = TV[:, 0][None, :]
    y = TV[:, 1][None, :]
    zz = TV[:, 2][None, :]
    # gravity sag: shift the dome's mass downwards (teardrop)
    yb = y - sag[:, None] * (1 - y) * 0.35 * zz
    Vw = (P[:, None, :]
          + (x * rt[:, None])[..., None] * tt[:, None, :]
          + (yb * rz[:, None])[..., None] * tzv[:, None, :]
          + (zz * h[:, None] - embed)[..., None] * Nrm[:, None, :])
    V = Vw.reshape(-1, 3)
    faces = []
    for i in range(len(P)):
        off = i * nv
        for f in TF:
            faces.append(np.array(f) + off)
    me = mesh_from_arrays(name, V, faces)
    DROP_INFO[me.name] = {"P": P, "r": rt, "nv": nv, "V": V.copy()}
    return me


DROP_INFO = {}


def make_condensation_drops(name, seed=3, count=2400, z_range=(0.012, 0.162), rmin=0.0002, rmax=0.0017,
                            cond_path=None, avoid_runs=True, theta_range=None, surface=None):
    surface = surface or bottle_surface()
    rng = np.random.default_rng(seed)
    runs = np.load(cond_path + ".runs.npy") if cond_path and os.path.exists(cond_path + ".runs.npy") else np.zeros((0, 4))
    cand = count * 6
    th = rng.uniform(0, 2 * np.pi, cand) if theta_range is None else rng.uniform(*theta_range, cand)
    z = rng.uniform(*z_range, cand)
    # power-law sizes: many small, few big
    a = 2.7
    u = rng.uniform(0, 1, cand)
    r = (rmin ** (1 - a) + u * (rmax ** (1 - a) - rmin ** (1 - a))) ** (1 / (1 - a))
    order = np.argsort(-r)
    th, z, r = th[order], z[order], r[order]
    keep = []
    grid = {}
    cell = 0.003
    R0 = surface.r0
    for i in range(cand):
        if len(keep) >= count:
            break
        x = th[i] * R0
        if avoid_runs and len(runs):
            du = np.abs(((th[i] / (2 * np.pi)) - runs[:, 0] + 0.5) % 1 - 0.5) * 2 * np.pi * R0
            inrun = (du < runs[:, 3] * 1.3) & (z[i] < runs[:, 1]) & (z[i] > runs[:, 2])
            if inrun.any():
                continue
        gx, gz = int(x // cell), int(z[i] // cell)
        ok = True
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j in grid.get((gx + dx, gz + dz), ()):
                    ddx = (x - th[j] * R0)
                    ddz = z[i] - z[j]
                    if ddx * ddx + ddz * ddz < (r[i] + r[j] + 0.00015) ** 2:
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                break
        if ok:
            keep.append(i)
            grid.setdefault((gx, gz), []).append(i)
    keep = np.array(keep)
    th, z, r = th[keep], z[keep], r[keep]
    # big drops at the bottom of each run
    for (u0, z0, z1, w) in runs:
        th = np.r_[th, u0 * 2 * np.pi]
        z = np.r_[z, z1 + 0.0012]
        r = np.r_[r, w * 1.25]
    P, Nrm, tz = surface.point(th, z)
    sag = np.clip((r - 0.0009) / 0.0012, 0, 1)
    rz = r * (1 + 0.35 * sag)
    h = r * rng.uniform(0.36, 0.52, len(r))
    return droplets_mesh(name, P, Nrm, tz, r, rz, h, sag=sag)


def make_contour_bottle(name="Bottle", fill_z=0.160, cap=True, condensation=True, mist=1.0, label=True,
                        liquid=True, drops=2400, seed=3, T=240):
    """Build the contour bottle. Returns dict(root, glass, liquid, cap, drops).

    The root Empty sits at the centre of the base (z=0).  fill_z: height of the cola surface (m) or None for full.
    """
    root = new_empty(name, size=0.1)
    outer, inner, lip = bottle_profiles()
    radial = bottle_flute_radial()
    prof = np.vstack([outer, lip, inner])
    n_outer = len(outer)
    V, F, luv, ring = lathe(prof, T, radial, uv_v=prof[:, 1] / BOTTLE_H)
    mat_idx = (ring >= n_outer - 1).astype(np.int32)
    me = mesh_from_arrays(name + "_glass_me", V, F, loop_uvs={"UVMap": luv}, mat_index=mat_idx)
    cond_path = condensation_map(os.path.join(TEX, f"condensation_{seed}.png"), seed=seed) if condensation else None
    label_path = wordmark_image(os.path.join(TEX, "wordmark_wrap.png")) if label else None
    if condensation:
        outer_mat = mat_bottle_outer(f"{name}_Outer", mist_strength=mist, label_path=label_path, cond_path=cond_path)
    else:
        blank = os.path.join(TEX, "blank_cond.png")
        if not os.path.exists(blank):
            Image.new("RGB", (8, 8), 0).save(blank)
        outer_mat = mat_bottle_outer(f"{name}_Outer", mist_strength=0.0, label_path=label_path, cond_path=blank)
    me.materials.append(outer_mat)
    me.materials.append(mat_glass())
    glass = new_object(name + "_glass", me, root)
    out = {"root": root, "glass": glass, "liquid": None, "cap": None, "drops": None}

    if liquid:
        gap = 0.00012
        inn = inner[::-1].copy()  # axis/bottom -> up to the mouth
        inn = inn[inn[:, 0] > 1e-6]
        # shrink slightly away from the glass
        d = np.gradient(inn, axis=0)
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        nrm = np.c_[-d[:, 1], d[:, 0]]  # pointing toward the axis (inward) for an upward inner profile
        inn = inn + nrm * gap
        top = fill_z if fill_z is not None else 0.1935
        inn = inn[inn[:, 1] < top]
        r_top = np.interp(top, inn[:, 1], inn[:, 0])
        base_z = inn[0, 1]
        men = 0.0009  # meniscus climbs the wall
        surf = [(r_top, top)]
        for k in range(1, 12):
            rr = r_top * (1 - k / 12)
            surf.append((rr, top - men * (1 - np.exp(-(r_top - rr) / 0.0012))))
        surf[-1] = (0.0, surf[-1][1])
        lp = np.vstack([[(0.0, base_z + 0.0003)], inn, surf])
        lp = lp[np.r_[True, np.any(np.diff(lp, axis=0) != 0, axis=1)]]
        Vl, Fl, _, _ = lathe(lp, T // 2)
        # liquid follows the flutes of the inner wall
        th = np.arctan2(Vl[:, 1], Vl[:, 0])
        scale = radial(th, Vl[:, 2])
        Vl[:, 0] *= scale
        Vl[:, 1] *= scale
        mel = mesh_from_arrays(name + "_liquid_me", Vl, Fl)
        mel.materials.append(mat_cola())
        out["liquid"] = new_object(name + "_liquid", mel, root)

    if cap:
        out["cap"] = make_crown_cap(name + "_cap", parent=root)
        out["cap"].location = (0, 0, BOTTLE_LIP_TOP - 0.0062)
    if condensation and drops:
        dm = make_condensation_drops(name + "_drops_me", seed=seed, count=drops, cond_path=cond_path,
                                     z_range=(0.012, min(0.162, (fill_z or 0.19) + 0.002)))
        dm.materials.append(mat_water())
        out["drops"] = new_object(name + "_drops", dm, root)
        out["drops"].visible_shadow = False
    return out


def make_crown_cap(name="Cap", parent=None, T=168):
    prof_out = np.array([
        (0.01625, 0.0), (0.01612, 0.0008), (0.0158, 0.0022), (0.0155, 0.0038), (0.0151, 0.0050),
        (0.01455, 0.0058), (0.0138, 0.00625), (0.0128, 0.0064), (0.0, 0.00645)])
    prof_in = np.array([
        (0.0, 0.00615), (0.0127, 0.0061), (0.0136, 0.0059), (0.0145, 0.0053), (0.0149, 0.0042),
        (0.0152, 0.0026), (0.01555, 0.0010), (0.01595, 0.0)])
    po = resample_profile(prof_out, 40)  # outside: skirt edge -> top centre
    pi = resample_profile(prof_in, 36)  # inside: top centre -> skirt edge

    def crimp(th, z):
        k = smoothstep(0.0048, 0.0010, z)
        return 1 + 0.045 * k * np.cos(21 * th)

    V, F, luv, ring = lathe(np.vstack([po, pi]), T, crimp)
    n_out = len(po)
    mat_idx = (ring >= n_out - 1).astype(np.int32)
    me = mesh_from_arrays(name + "_me", V, F, loop_uvs={"UVMap": luv}, mat_index=mat_idx)
    top_lbl = cap_label_image(os.path.join(TEX, "cap_label.png"))
    me.materials.append(mat_cap_paint(label_path=top_lbl))
    me.materials.append(mat_cap_inner())
    ob = new_object(name, me, parent)
    return ob


def cap_label_image(path, size=1024):
    if os.path.exists(path):
        return path
    img = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(WORDMARK_FONT, 100)
    t = "Coca-Cola"
    bb = d.textbbox((0, 0), t, font=f)
    s = int(100 * size * 0.78 / (bb[2] - bb[0]))
    f = ImageFont.truetype(WORDMARK_FONT, s)
    bb = d.textbbox((0, 0), t, font=f)
    d.text(((size - (bb[2] - bb[0])) / 2 - bb[0], (size - (bb[3] - bb[1])) / 2 - bb[1]), t, font=f, fill=255)
    # thin ring near the edge
    d.ellipse((size * 0.06, size * 0.06, size * 0.94, size * 0.94), outline=255, width=int(size * 0.012))
    img = img.filter(ImageFilter.GaussianBlur(1.0))
    rgba = Image.merge("RGBA", (Image.new("L", img.size, 255),) * 3 + (img,))
    rgba.save(path)
    return path


# ---------------------------------------------------------------------------
# bell glass, cola in the glass, ice, bubbles, foam
# ---------------------------------------------------------------------------

GLASS_OUTER_CM = [
    (0.0, 0.0), (2.45, 0.0), (2.78, 0.06), (2.93, 0.25), (2.95, 0.55), (2.84, 1.2), (2.68, 2.2),
    (2.57, 3.4), (2.60, 4.6), (2.80, 6.2), (3.12, 8.0), (3.50, 10.0), (3.84, 12.0), (4.08, 13.8),
    (4.20, 15.0), (4.215, 15.35),
]
GLASS_H = 0.1545


def glass_profiles():
    outer = resample_profile(np.array(GLASS_OUTER_CM) * CM, 260)
    wall = 0.0023
    side = outer[outer[:, 1] > 0.013]
    inner = _offset_inward(side, lambda z: np.full_like(z, wall))
    inner = inner[inner[:, 1] < GLASS_H - 0.0004]
    inner = inner[inner[:, 1] > 0.0135]
    rb, zb = inner[0]
    bottom = np.array([(rb - 0.0012, zb - 0.0004), (rb * 0.6, zb - 0.0005), (0.0, zb - 0.0005)])
    inner = np.vstack([inner[::-1], bottom])
    rim_o = outer[-1]
    rim_i = inner[0]
    lip = np.array([(rim_o[0] - 0.0004, rim_o[1] + 0.00055), ((rim_o[0] + rim_i[0]) / 2, rim_o[1] + 0.0007),
                    (rim_i[0] + 0.0004, rim_i[1] + 0.00055)])
    return outer, inner, lip


def glass_flutes(n=12, amp=0.035):
    def f(th, z):
        u = (n * th / (2 * np.pi)) % 1.0
        x = 2 * u - 1
        prof = (1 - np.sqrt(np.clip(1 - x * x, 0, 1))) ** 1.4
        return 1 - amp * prof * _window(z, 0.004, 0.052, 0.01)
    return f


def glass_inner_radius(z):
    _, inner, _ = glass_profiles()
    inn = inner[::-1]
    wall = inn[inn[:, 1] >= inn[0, 1] + 0.0005]
    wall = wall[np.r_[True, np.diff(wall[:, 1]) > 0]]
    return np.interp(z, wall[:, 1], wall[:, 0])


GLASS_INNER_BASE = 0.0133


def make_glass(name="Glass", T=200, parent=None, condensation=True, level=0.112, seed=11, drops=1500, mist=1.0):
    root = new_empty(name, size=0.08, parent=parent)
    outer, inner, lip = glass_profiles()
    prof = np.vstack([outer, lip, inner])
    radial = glass_flutes()
    V, F, luv, ring = lathe(prof, T, radial, uv_v=prof[:, 1] / GLASS_H)
    mat_idx = (ring >= len(outer) - 1).astype(np.int32)
    me = mesh_from_arrays(name + "_glass_me", V, F, loop_uvs={"UVMap": luv}, mat_index=mat_idx)
    out = {"root": root}
    if condensation:
        cpath = condensation_map(os.path.join(TEX, f"glass_condensation_{seed}_{int(level * 1000)}.png"), seed=seed,
                                 z_top=level, H=GLASS_H, radius=0.034, n_runs=18, z_runs=(0.03, level - 0.004))
        me.materials.append(mat_bottle_outer(f"{name}_Outer", mist_strength=mist, label_path=None, cond_path=cpath))
    else:
        me.materials.append(mat_glass())
    me.materials.append(mat_glass())
    out["glass"] = new_object(name + "_glass", me, root)
    if condensation and drops:
        surf = LatheSurface(outer, radial, 0.003, GLASS_H - 0.001, 0.01)
        dm = make_condensation_drops(name + "_drops_me", seed=seed, count=drops, cond_path=cpath,
                                     z_range=(0.006, level + 0.001), surface=surf, rmax=0.0015)
        dm.materials.append(mat_water())
        out["drops"] = new_object(name + "_drops", dm, root)
        out["drops"].visible_shadow = False
    return out


class GlassLiquid:
    """Cola inside the bell glass with an animatable fill level and optional surface displacement."""

    def __init__(self, name, glass_root, level=0.11, rings=70, T=160, gap=0.00012, surface_fn=None):
        self.T = T
        self.rings = rings
        self.gap = gap
        self.surface_fn = surface_fn  # f(x, y, frame) -> dz
        _, inner, _ = glass_profiles()
        inn = inner[::-1]
        wall = inn[inn[:, 1] >= inn[0, 1] + 0.0005]
        self.inn = wall[np.r_[True, np.diff(wall[:, 1]) > 0]]
        self.base_z = inn[0, 1] + gap
        V, F = self._build(level, 0.0)
        me = mesh_from_arrays(name + "_me", V, F)
        me.materials.append(mat_cola())
        self.obj = new_object(name, me, glass_root)
        self.me = me
        self.cutters = None

    def cut_with(self, ice_objects, gap_scale=1.012):
        """Carve the ice out of the liquid (so the ice itself stays clear) using hidden, slightly larger cutters."""
        col = bpy.data.collections.new(self.obj.name + "_cutters")
        bpy.context.scene.collection.children.link(col)
        for ice in ice_objects:
            c = bpy.data.objects.new(ice.name + "_cut", ice.data.copy())
            c.data.materials.clear()
            col.objects.link(c)
            c.parent = ice
            c.scale = (gap_scale,) * 3
            c.hide_render = True
            c.display_type = "WIRE"
        col.hide_render = True
        mod = self.obj.modifiers.new("IceCut", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.operand_type = "COLLECTION"
        mod.collection = col
        mod.solver = os.environ.get("COKE_BOOL", "EXACT")
        self.cutters = col
        return mod

    def _profile(self, level):
        n_wall = 36
        zs = np.linspace(self.inn[0, 1], level, n_wall)
        rs = np.interp(zs, self.inn[:, 1], self.inn[:, 0]) - self.gap
        r_top = rs[-1]
        men = 0.0010
        k = np.linspace(0, 1, self.rings)[1:]
        rr = r_top * (1 - k) ** 1.0
        surf_z = level - men * (1 - np.exp(-(r_top - rr) / 0.0015))
        prof = np.vstack([[(0.0, self.base_z)], [(rs[0] - 0.001, self.base_z)], np.c_[rs, zs], np.c_[rr, surf_z]])
        prof[-1, 0] = 0.0
        self.n_wall = n_wall
        return prof

    def _build(self, level, frame):
        prof = self._profile(level)
        V, F, _, _ = lathe(prof, self.T)
        return self._displace(V, prof, frame), F

    def _displace(self, V, prof, frame):
        if self.surface_fn is None:
            return V
        # displace only the top-surface vertices (after the wall rings)
        start = 1 + (self.n_wall + 1) * self.T
        top = V[start:]
        top[:, 2] += self.surface_fn(top[:, 0], top[:, 1], frame)
        V[start:] = top
        return V

    def update(self, level, frame=0.0):
        prof = self._profile(level)
        V = lathe_verts(prof, self.T)
        V = self._displace(V, prof, frame)
        set_verts(self.me, V)


def make_ice_cube(name, size=0.026, seed=0, parent=None, res=10, core=False):
    rng = np.random.default_rng(seed + 101)
    # cube grid on each face
    g = np.linspace(-1, 1, res + 1)
    pts, faces = [], []
    idx = {}

    def vid(p):
        key = tuple(np.round(p, 6))
        if key not in idx:
            idx[key] = len(pts)
            pts.append(p)
        return idx[key]

    for axis in range(3):
        for sgn in (-1, 1):
            for i in range(res):
                for j in range(res):
                    quad = []
                    for (a, b) in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                        p = np.zeros(3)
                        p[axis] = sgn
                        p[(axis + 1) % 3] = g[a]
                        p[(axis + 2) % 3] = g[b]
                        quad.append(vid(p))
                    if sgn < 0:
                        quad = quad[::-1]
                    faces.append(quad)
    P = np.array(pts)
    # rounded box (superellipsoid projection)
    e = 7.0
    nrm = (np.abs(P) ** e).sum(1) ** (1 / e)
    Q = P / nrm[:, None]
    Q = 0.72 * Q + 0.28 * P / np.linalg.norm(P, axis=1, keepdims=True) * 1.1
    scale = rng.uniform(0.9, 1.08, 3)
    Q *= scale
    # organic melt noise
    for k in range(5):
        d = rng.normal(size=3)
        d /= np.linalg.norm(d)
        fr = rng.uniform(1.5, 4.5)
        ph = rng.uniform(0, 2 * np.pi)
        Q += (0.035 / (k + 1)) * np.sin(fr * Q @ d + ph)[:, None] * Q / np.linalg.norm(Q, axis=1, keepdims=True)
    V = Q * size / 2
    faces = [np.array(f) for f in faces]
    me = mesh_from_arrays(name + "_me", V, faces)
    me.materials.append(mat_ice())
    ob = new_object(name, me, parent)
    if core:
        cm = mesh_from_arrays(name + "_core_me", V * 0.45 * np.array([1, 1, 0.7]), faces)
        cm.materials.append(mat_ice_core())
        c = new_object(name + "_core", cm, ob)
    return ob


def icosphere(subdiv=1):
    t = (1 + 5 ** 0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
         (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11),
         (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    V = [np.array(v, dtype=float) / np.linalg.norm(v) for v in V]
    for _ in range(subdiv):
        cache = {}
        nf = []

        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache:
                m = V[a] + V[b]
                V.append(m / np.linalg.norm(m))
                cache[k] = len(V) - 1
            return cache[k]

        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = nf
    return np.array(V), np.array(F)


class SphereSwarm:
    """A mesh of N spheres whose centres/radii are set per frame by fn(frame) -> (C (N,3), R (N,))."""

    def __init__(self, name, n, material, parent=None, subdiv=1, squash=None):
        self.TV, TF = icosphere(subdiv)
        self.n = n
        self.nv = len(self.TV)
        self.squash = squash
        faces = (TF[None, :, :] + (np.arange(n) * self.nv)[:, None, None]).reshape(-1, 3)
        V = np.zeros((n * self.nv, 3))
        self.me = mesh_from_arrays(name + "_me", V, faces)
        self.me.materials.append(material)
        self.obj = new_object(name, self.me, parent)

    def set(self, C, R, S=None):
        TV = self.TV if S is None else None
        if S is None:
            V = C[:, None, :] + R[:, None, None] * self.TV[None, :, :]
        else:
            V = C[:, None, :] + (R[:, None, None] * S[:, None, :]) * self.TV[None, :, :]
        set_verts(self.me, V.reshape(-1, 3))


def bubble_streams(n_streams, per_stream, seed, radius_fn, z0, z1, speed=0.02, fps=24, wobble=0.0006,
                   sources=None, size=(0.0003, 0.0009), grow=1.6):
    """Analytic rising bubble streams. Returns fn(frame) -> (C, R).

    sources: (n_streams, 3) nucleation points (default: random on the inner wall near the base).
    radius_fn(z) gives the container inner radius to keep bubbles inside.
    """
    rng = np.random.default_rng(seed)
    if sources is None:
        th = rng.uniform(0, 2 * np.pi, n_streams)
        zz = rng.uniform(z0, z0 + (z1 - z0) * 0.6, n_streams)
        rr = radius_fn(zz) - 0.0012
        sources = np.c_[rr * np.cos(th), rr * np.sin(th), zz]
    sp = speed * rng.uniform(0.7, 1.3, n_streams)
    phase = rng.uniform(0, 1, (n_streams, per_stream))
    base_r = rng.uniform(*size, n_streams)
    wob_ph = rng.uniform(0, 2 * np.pi, (n_streams, per_stream))
    period = (z1 - sources[:, 2]) / sp  # seconds for a bubble to reach the top

    def fn(frame):
        t = frame / fps
        C = np.zeros((n_streams, per_stream, 3))
        R = np.zeros((n_streams, per_stream))
        for s in range(n_streams):
            ph = (t / period[s] + np.arange(per_stream) / per_stream + phase[s, 0]) % 1.0
            z = sources[s, 2] + ph * (z1 - sources[s, 2])
            # accelerate as they grow (buoyancy): ease-in on height
            z = sources[s, 2] + (ph ** 1.25) * (z1 - sources[s, 2])
            pull = 1.0 - 0.25 * ph  # drift slightly toward the centre while rising
            x = sources[s, 0] * pull + wobble * np.sin(ph * 40 + wob_ph[s])
            y = sources[s, 1] * pull + wobble * np.cos(ph * 33 + wob_ph[s])
            C[s, :, 0], C[s, :, 1], C[s, :, 2] = x, y, z
            R[s] = base_r[s] * (1 + (grow - 1) * ph) * smoothstep(0.0, 0.03, ph) * smoothstep(1.0, 0.97, ph)
        return C.reshape(-1, 3), R.reshape(-1)

    return fn


def foam_layer(name, n, radius, level_z, seed=5, parent=None, rmin=0.0004, rmax=0.0016):
    """Clumps of foam bubbles floating on the surface. Returns (SphereSwarm, base arrays)."""
    rng = np.random.default_rng(seed)
    r = np.sqrt(rng.uniform(0, 1, n)) * radius
    th = rng.uniform(0, 2 * np.pi, n)
    # denser near the wall
    r = radius * (1 - (1 - np.sqrt(rng.uniform(0, 1, n))) ** 1.6)
    br = rng.uniform(rmin, rmax, n) * (0.6 + 0.6 * (r / radius))
    C = np.c_[r * np.cos(th), r * np.sin(th), np.full(n, level_z)]
    sw = SphereSwarm(name, n, mat_foam(), parent=parent, subdiv=1)
    return sw, C, br


# ---------------------------------------------------------------------------
# studio
# ---------------------------------------------------------------------------


def area_light(name, loc, rot=None, size=(0.2, 1.0), energy=50.0, color=(1, 1, 1), spread=180.0,
               look_at=None, visible_glossy=True, visible_camera=False, shape="RECTANGLE"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = shape
    ld.size = size[0]
    ld.size_y = size[1]
    ld.energy = energy
    ld.color = color
    ld.spread = math.radians(spread)
    ob = new_object(name, ld)
    ob.location = loc
    if look_at is not None:
        d = Vector(look_at) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    elif rot is not None:
        ob.rotation_euler = rot
    ob.visible_glossy = visible_glossy
    ob.visible_camera = visible_camera
    return ob


def emissive_card(name, loc, size, color, strength, look_at, visible_camera=False, soft_edge=True):
    """A visible emissive rectangle (softbox face) for crisp reflections, not directly visible to the camera."""
    V = np.array([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]]) * np.array([size[0], size[1], 1])
    uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    me = mesh_from_arrays(name + "_me", V, np.array([[0, 1, 2, 3]]), loop_uvs={"UVMap": uv})
    m = bpy.data.materials.new(name + "_mat")
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    e = N.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    if soft_edge:
        uvn = N.new("ShaderNodeUVMap")
        sep = N.new("ShaderNodeSeparateXYZ")
        L.new(uvn.outputs["UV"], sep.inputs[0])
        # soft falloff towards the edges like a real softbox diffusion panel
        fx = N.new("ShaderNodeMath"); fx.operation = "PINGPONG"; fx.inputs[1].default_value = 0.5
        fy = N.new("ShaderNodeMath"); fy.operation = "PINGPONG"; fy.inputs[1].default_value = 0.5
        L.new(sep.outputs["X"], fx.inputs[0])
        L.new(sep.outputs["Y"], fy.inputs[0])
        mx = _map_range(N, L, fx.outputs[0], 0.0, 0.12, 0.0, 1.0)
        my = _map_range(N, L, fy.outputs[0], 0.0, 0.06, 0.0, 1.0)
        mm = N.new("ShaderNodeMath"); mm.operation = "MULTIPLY"
        L.new(mx, mm.inputs[0]); L.new(my, mm.inputs[1])
        sm = N.new("ShaderNodeMath"); sm.operation = "MULTIPLY"; sm.inputs[1].default_value = strength
        L.new(mm.outputs[0], sm.inputs[0])
        L.new(sm.outputs[0], e.inputs["Strength"])
        e.name = "emit"
        sm.name = "strength"
    L.new(e.outputs[0], out.inputs[0])
    m.cycles.emission_sampling = "NONE"
    me.materials.append(m)
    ob = new_object(name, me)
    ob.location = loc
    d = Vector(look_at) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    ob.visible_camera = visible_camera
    ob.visible_shadow = False
    ob.visible_diffuse = False
    return ob


def exclude_receivers(emitter, objects, name=None):
    """Light linking: `emitter` (light or emissive object) does not light/reflect in `objects` (e.g. the floor)."""
    col = bpy.data.collections.new(name or (emitter.name + "_excl"))
    for ob in objects:
        col.objects.link(ob)
    emitter.light_linking.receiver_collection = col
    for co in col.collection_objects:
        co.light_linking.link_state = "EXCLUDE"
    return col


def card_strength_socket(card):
    m = card.data.materials[0]
    n = m.node_tree.nodes.get("strength")
    return n.inputs[1] if n else m.node_tree.nodes["emit"].inputs["Strength"]


def glow_backdrop(name="Backdrop", y=1.4, center=(0.0, 0.12), radius=0.9, color=COKE_RED, strength=1.2,
                  width=8.0, height=4.0, falloff=1.6):
    """Emissive backdrop plane facing -Y with a radial glow (deep red centre falling off to black)."""
    V = np.array([[-width / 2, y, -0.5], [width / 2, y, -0.5], [width / 2, y, height], [-width / 2, y, height]])
    me = mesh_from_arrays(name + "_me", V, np.array([[0, 3, 2, 1]]))
    m = bpy.data.materials.new(name + "_mat")
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    sub = N.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = (center[0], y, center[1])
    L.new(tc.outputs["Object"], sub.inputs[0])
    ln = N.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
    L.new(sub.outputs[0], ln.inputs[0])
    dv = N.new("ShaderNodeMath"); dv.operation = "DIVIDE"; dv.inputs[1].default_value = radius
    L.new(ln.outputs["Value"], dv.inputs[0])
    # smooth gaussian-ish falloff: exp(-(d^falloff)*2)
    pw = N.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = falloff
    L.new(dv.outputs[0], pw.inputs[0])
    mu = N.new("ShaderNodeMath"); mu.operation = "MULTIPLY"; mu.inputs[1].default_value = -2.2
    L.new(pw.outputs[0], mu.inputs[0])
    ex = N.new("ShaderNodeMath"); ex.operation = "EXPONENT"
    L.new(mu.outputs[0], ex.inputs[0])
    st = N.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = strength
    st.name = "strength"
    L.new(ex.outputs[0], st.inputs[0])
    e = N.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    L.new(st.outputs[0], e.inputs["Strength"])
    L.new(e.outputs[0], out.inputs[0])
    m.cycles.emission_sampling = "NONE"
    me.materials.append(m)
    ob = new_object(name, me)
    ob.visible_shadow = False
    return ob


def backdrop_strength_socket(ob):
    return ob.data.materials[0].node_tree.nodes["strength"].inputs[1]


def wet_floor(name="Floor", size=6.0, z=0.0, rough=(0.03, 0.14), base=0.004):
    V = np.array([[-size, -size, z], [size, -size, z], [size, size, z], [-size, size, z]])
    me = mesh_from_arrays(name + "_me", V, np.array([[0, 1, 2, 3]]))
    m = bpy.data.materials.new(name + "_mat")
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (base, base, base, 1), "Roughness": 0.08, "Coat Weight": 1.0,
                          "Coat Roughness": 0.015, "Specular IOR Level": 0.5})
    nz = _noise(N, L, 8.0, 6)
    L.new(_map_range(N, L, nz.outputs["Fac"], 0.35, 0.7, rough[0], rough[1]), p.inputs["Roughness"])
    # water film patches: smoother coat where "wet"
    nz2 = _noise(N, L, 3.0, 3)
    L.new(_map_range(N, L, nz2.outputs["Fac"], 0.4, 0.6, 0.06, 0.005), p.inputs["Coat Roughness"])
    L.new(p.outputs[0], out.inputs[0])
    me.materials.append(m)
    return new_object(name, me)


def make_studio(style="dark", glow=1.0, backdrop_y=1.3, glow_center=(0.0, 0.11), glow_radius=0.75):
    """Standard studio rigs. Returns dict of objects (floor, backdrop, lights, cards)."""
    out = {}
    if style == "dark":
        out["floor"] = wet_floor()
        out["backdrop"] = glow_backdrop(y=backdrop_y, center=glow_center, radius=glow_radius, strength=0.2 * glow)
        # tall strip softboxes behind-left / behind-right: rim reflections down the glass edges
        out["rimL"] = emissive_card("RimL", (-0.34, 0.22, 0.13), (0.07, 0.62), (1.0, 0.97, 0.94), 26.0,
                                    look_at=(0, 0, 0.11))
        out["rimR"] = emissive_card("RimR", (0.36, 0.20, 0.13), (0.07, 0.62), (0.94, 0.97, 1.0), 26.0,
                                    look_at=(0, 0, 0.11))
        out["rimL_l"] = area_light("RimL_light", (-0.34, 0.24, 0.14), size=(0.06, 0.6), energy=10.0,
                                   look_at=(0, 0, 0.11), visible_glossy=False)
        out["rimR_l"] = area_light("RimR_light", (0.36, 0.22, 0.14), size=(0.06, 0.6), energy=10.0,
                                   look_at=(0, 0, 0.11), visible_glossy=False)
        # front strips: the long crisp highlight on the face of the glass
        out["frontL"] = emissive_card("FrontL", (-0.22, -0.55, 0.16), (0.05, 0.7), (1, 1, 1), 16.0,
                                      look_at=(0, 0, 0.1))
        out["frontR"] = emissive_card("FrontR", (0.30, -0.50, 0.16), (0.03, 0.7), (1, 1, 1), 9.0,
                                      look_at=(0, 0, 0.1))
        # soft overhead key for the cap/top and a gentle floor sheen
        out["top"] = area_light("Top", (0.0, -0.1, 0.75), size=(0.6, 0.6), energy=10.0, look_at=(0, 0, 0.1),
                                visible_glossy=False)
        # soft front fill so the white ACL paint and the cap read properly
        out["fill"] = area_light("Fill", (-0.35, -0.65, 0.35), size=(0.9, 0.9), energy=2.5, look_at=(0, 0, 0.1),
                                 visible_glossy=False)
        # hidden kicker right behind the product: makes the cola glow ruby
        out["kick"] = area_light("Kicker", (0.0, 0.40, 0.065), size=(0.26, 0.16), energy=1.6,
                                 color=(1.0, 0.62, 0.42), look_at=(0, -1, 0.09), visible_glossy=False)
        for k in ("frontL", "frontR"):
            exclude_receivers(out[k], [out["floor"]])
    elif style == "red":
        out["sweep"] = red_sweep()
        out["top"] = area_light("Top", (0.0, -0.15, 0.9), size=(1.2, 0.8), energy=90.0, look_at=(0, 0.1, 0.0))
        out["rimL"] = emissive_card("RimL", (-0.35, 0.18, 0.14), (0.08, 0.6), (1, 0.96, 0.94), 22.0,
                                    look_at=(0, 0, 0.11))
        out["rimR"] = emissive_card("RimR", (0.35, 0.18, 0.14), (0.08, 0.6), (1, 0.96, 0.94), 22.0,
                                    look_at=(0, 0, 0.11))
        out["frontL"] = emissive_card("FrontL", (-0.24, -0.55, 0.16), (0.05, 0.7), (1, 1, 1), 14.0,
                                      look_at=(0, 0, 0.1))
        out["kick"] = area_light("Kicker", (0.0, 0.3, 0.10), size=(0.16, 0.26), energy=16.0,
                                 color=(1.0, 0.7, 0.55), look_at=(0, -1, 0.09), visible_glossy=False)
    return out


def red_sweep(name="Sweep", depth=3.0, width=6.0, radius=0.6, wall_h=3.0, y_wall=0.9):
    """Seamless cyc: floor (z=0) curving up into a wall at y=y_wall."""
    prof = []
    for y in np.linspace(-depth, y_wall - radius, 12):
        prof.append((y, 0.0))
    for a in np.linspace(0, np.pi / 2, 24)[1:]:
        prof.append((y_wall - radius + radius * np.sin(a), radius - radius * np.cos(a)))
    for z in np.linspace(radius, wall_h, 8)[1:]:
        prof.append((y_wall, z))
    prof = np.array(prof)
    xs = np.linspace(-width / 2, width / 2, 3)
    V = np.array([(x, y, z) for (y, z) in prof for x in xs])
    F = []
    nx = len(xs)
    for i in range(len(prof) - 1):
        for j in range(nx - 1):
            a = i * nx + j
            F.append([a, a + 1, a + 1 + nx, a + nx])
    me = mesh_from_arrays(name + "_me", V, np.array(F))
    m = bpy.data.materials.new(name + "_mat")
    nt, N, L = _nodes(m)
    out = N.new("ShaderNodeOutputMaterial")
    p = _principled(N, **{"Base Color": (0.62, 0.004, 0.018, 1), "Roughness": 0.42, "Coat Weight": 0.25,
                          "Coat Roughness": 0.08})
    L.new(p.outputs[0], out.inputs[0])
    me.materials.append(m)
    return new_object(name, me)


def light_sweep_card(name, y=-0.45, z=0.11, height=0.8, width=0.05, strength=40.0, look_at=(0, 0, 0.1)):
    """A vertical strip card that shots animate across X for the 'glint sweep' effect."""
    return emissive_card(name, (0.0, y, z), (width, height), (1, 1, 1), strength, look_at=look_at)


# ---------------------------------------------------------------------------
# camera
# ---------------------------------------------------------------------------


def add_camera(loc, look_at, lens=85.0, fstop=None, focus=None, sensor=36.0, name="Cam", clip=(0.005, 50.0)):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = sensor
    cd.clip_start, cd.clip_end = clip
    cam = new_object(name, cd)
    cam.location = loc
    tgt = new_empty(name + "_target", loc=look_at, size=0.02)
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.aperture_blades = 7
        cd.dof.aperture_rotation = math.radians(10)
        if isinstance(focus, (int, float)):
            cd.dof.focus_distance = focus
        elif focus is not None:
            cd.dof.focus_object = focus
        else:
            cd.dof.focus_object = tgt
    bpy.context.scene.camera = cam
    return cam, tgt


def keyframes(ob, path, keys, interp="BEZIER", index=-1):
    """keys: list of (frame, value). Bezier with auto-clamped handles gives ease-in/out."""
    for f, v in keys:
        setattr(ob, path, v) if index < 0 else getattr(ob, path).__setitem__(index, v)
        ob.keyframe_insert(data_path=path, frame=f, index=index)
    ad = ob.animation_data
    if ad and ad.action:
        for fc in _fcurves(ad.action):
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.interpolation = interp


def _fcurves(action):
    try:
        return action.fcurves
    except AttributeError:  # layered actions
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out.extend(cb.fcurves)
        return out


def path_camera(cam, tgt, frames, cam_fn, tgt_fn=None):
    """Drive camera and target positions analytically: cam_fn(t in [0,1]) -> (x,y,z)."""
    n = frames

    def cb(f):
        t = (f - 1) / max(n - 1, 1)
        cam.location = cam_fn(t)
        if tgt_fn:
            tgt.location = tgt_fn(t)

    on_frame(cb)
    cb(1)
    return cb
