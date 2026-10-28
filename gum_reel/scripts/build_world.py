"""Environment + props -> assets/world.blend"""
import sys, math
import numpy as np
sys.path.insert(0, '/home/user/work/scripts')
import bpy, bmesh
from mathutils import Vector, Matrix
from mats import *
from geo import *

rng = np.random.default_rng(5)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or sc.collection).children.link(c)
    return c


ENV = coll('env')
GRASS = coll('grass')
PROPS = coll('props')
STUDIO = coll('studio')

LAYOUT = dict(
    main=(0.0, 0.0), table=(0.0, -0.62), mint=(0.62, -0.1), wilt=(-0.27, -0.5),
    sap_tree=(2.62, 2.28), sap_stand=(2.18, 2.30), lift=(-0.45, -2.1),
    kitchen=(-2.6, 2.6), fire=(-2.33, 2.12), ktable=(-2.92, 2.1), sign=(-2.18, 3.3),
    seat=(2.8, -1.8),
)


# ------------------------------------------------------------------ materials
def haze(m, col_socket, loc=(300, 300), dist=90.0, color=(0.70, 0.80, 0.90)):
    cam = node(m, 'ShaderNodeCameraData', (loc[0] - 400, loc[1] + 200))
    mr = node(m, 'ShaderNodeMapRange', (loc[0] - 200, loc[1] + 200))
    mr.inputs['From Min'].default_value = 12.0
    mr.inputs['From Max'].default_value = dist
    mr.inputs['To Max'].default_value = 0.75
    link(m, cam.outputs['View Distance'], mr.inputs['Value'])
    out = mix_rgb(m, mr.outputs['Result'], col_socket, color, loc)
    link(m, out, bsdf(m).inputs['Base Color'])


def ground_material():
    m = principled('ground', (0.2, 0.45, 0.08), 0.95)
    bsdf(m).inputs['Specular IOR Level'].default_value = 0.15
    co = coord(m, 'Object')
    n1 = noise(m, co, 0.35, 3, loc=(-900, 300))
    g = ramp(m, n1.outputs['Fac'], [(0.3, (0.13, 0.34, 0.035)), (0.5, (0.20, 0.45, 0.06)), (0.7, (0.30, 0.55, 0.09))], (-650, 300))
    # fine grass speckle
    mp = node(m, 'ShaderNodeMapping', (-1000, 0)); mp.inputs['Scale'].default_value = (1, 1, 1)
    link(m, co, mp.inputs['Vector'])
    n2 = noise(m, mp.outputs['Vector'], 60, 2, loc=(-800, 0))
    g2 = mix_rgb(m, n2.outputs['Fac'], g.outputs['Color'], (0.10, 0.28, 0.03), (-450, 200), blend='MULTIPLY')
    # dirt patches
    n3 = noise(m, co, 0.9, 4, loc=(-900, -300))
    d = ramp(m, n3.outputs['Fac'], [(0.60, (0, 0, 0)), (0.66, (1, 1, 1))], (-650, -300))
    attr = node(m, 'ShaderNodeAttribute', (-900, -550), attribute_name='dirt')
    dmax = node(m, 'ShaderNodeMath', (-450, -400), operation='MAXIMUM')
    link(m, d.outputs['Color'], dmax.inputs[0]); link(m, attr.outputs['Fac'], dmax.inputs[1])
    n4 = noise(m, co, 18, 3, loc=(-650, -650))
    dirtc = ramp(m, n4.outputs['Fac'], [(0.35, (0.26, 0.17, 0.09)), (0.65, (0.40, 0.28, 0.16))], (-450, -650))
    out = mix_rgb(m, dmax.outputs['Value'], g2, dirtc.outputs['Color'], (-200, 0))
    haze(m, out, (100, 0), dist=110)
    bump(m, n2.outputs['Fac'], 0.25)
    return m


def stone_material(name='stone', base=(0.50, 0.50, 0.48)):
    m = principled(name, base, 0.85)
    bsdf(m).inputs['Specular IOR Level'].default_value = 0.25
    co = coord(m, 'Object')
    vor = node(m, 'ShaderNodeTexVoronoi', (-900, 0), feature='F1')
    vor.inputs['Scale'].default_value = 26; vor.inputs['Randomness'].default_value = 1.0
    link(m, co, vor.inputs['Vector'])
    sp = ramp(m, vor.outputs['Distance'], [(0.10, (1, 1, 1)), (0.16, (0, 0, 0))], (-650, 0))
    n1 = noise(m, co, 2.5, 4, loc=(-900, 300))
    basec = ramp(m, n1.outputs['Fac'], [(0.35, tuple(c * 0.82 for c in base)), (0.65, tuple(min(c * 1.15, 1) for c in base))], (-650, 300))
    vcol = node(m, 'ShaderNodeSeparateColor', (-800, -250))
    link(m, vor.outputs['Color'], vcol.inputs['Color'])
    dark = mix_rgb(m, vcol.outputs['Red'], (0.18, 0.18, 0.18), (0.68, 0.68, 0.66), (-450, -150))
    out = mix_rgb(m, sp.outputs['Color'], basec.outputs['Color'], dark, (-250, 100))
    haze(m, out, (0, 0), dist=120)
    n2 = noise(m, co, 30, 3, loc=(-450, -450))
    bmix = node(m, 'ShaderNodeMath', (-250, -450), operation='ADD')
    link(m, n2.outputs['Fac'], bmix.inputs[0]); link(m, sp.outputs['Alpha'], bmix.inputs[1])
    bump(m, bmix.outputs['Value'], 0.35)
    return m


def leaf_material(name='leaves', a=(0.10, 0.30, 0.04), b=(0.30, 0.58, 0.10)):
    m = principled(name, a, 0.75)
    bsdf(m).inputs['Subsurface Weight'].default_value = 0.0
    co = coord(m, 'Object')
    vor = node(m, 'ShaderNodeTexVoronoi', (-900, 0), feature='F1')
    vor.inputs['Scale'].default_value = 7; vor.inputs['Randomness'].default_value = 1
    link(m, co, vor.inputs['Vector'])
    n1 = noise(m, co, 1.2, 3, loc=(-900, 300))
    c = ramp(m, n1.outputs['Fac'], [(0.3, a), (0.75, b)], (-650, 300))
    out = mix_rgb(m, vor.outputs['Distance'], c.outputs['Color'], tuple(x * 0.55 for x in a), (-350, 200))
    haze(m, out, (0, 0), dist=110)
    bump(m, vor.outputs['Distance'], 0.6)
    return m


def bark_material():
    m = principled('bark', (0.33, 0.2, 0.1), 0.9)
    co = coord(m, 'Object')
    mp = node(m, 'ShaderNodeMapping', (-1000, 0)); mp.inputs['Scale'].default_value = (6, 6, 0.6)
    link(m, co, mp.inputs['Vector'])
    n1 = noise(m, mp.outputs['Vector'], 4, 6, loc=(-800, 0))
    c = ramp(m, n1.outputs['Fac'], [(0.3, (0.20, 0.12, 0.06)), (0.7, (0.42, 0.27, 0.14))], (-550, 0))
    haze(m, c.outputs['Color'], (-200, 0), dist=110)
    bump(m, n1.outputs['Fac'], 0.5)
    return m


def grass_material():
    m = principled('grass', (0.2, 0.5, 0.1), 0.7)
    b = bsdf(m)
    b.inputs['Specular IOR Level'].default_value = 0.25
    t = node(m, 'ShaderNodeAttribute', (-900, 200), attribute_name='t')
    tint = node(m, 'ShaderNodeAttribute', (-900, -100), attribute_name='tint')
    g = ramp(m, t.outputs['Fac'], [(0.0, (0.05, 0.17, 0.02)), (0.45, (0.16, 0.42, 0.05)), (1.0, (0.40, 0.66, 0.14))], (-650, 200))
    out = mix_rgb(m, 1.0, g.outputs['Color'], tint.outputs['Color'], (-350, 100), blend='MULTIPLY')
    haze(m, out, (0, 0), dist=110)
    b.inputs['Transmission Weight'].default_value = 0.0
    m.use_backface_culling = False
    return m


def clay_material():
    m = principled('clay', (0.62, 0.30, 0.15), 0.8)
    co = coord(m, 'Object')
    n1 = noise(m, co, 14, 5, loc=(-800, 0))
    c = ramp(m, n1.outputs['Fac'], [(0.3, (0.50, 0.22, 0.10)), (0.7, (0.70, 0.36, 0.18))], (-550, 0))
    link(m, c.outputs['Color'], bsdf(m).inputs['Base Color'])
    n2 = noise(m, co, 90, 3, loc=(-550, -300))
    bump(m, n2.outputs['Fac'], 0.25)
    return m


def flower_material(name, color):
    m = principled(name, color, 0.5)
    b = bsdf(m)
    b.inputs['Subsurface Weight'].default_value = 0.0
    # per-object colour override (used for wilting)
    oi = node(m, 'ShaderNodeObjectInfo', (-700, 0))
    out = mix_rgb(m, 1.0, (*color,), oi.outputs['Color'], (-400, 0), blend='MULTIPLY')
    link(m, out, b.inputs['Base Color'])
    return m


MT = dict(ground=ground_material(), stone=stone_material(), slab=stone_material('slab', (0.58, 0.57, 0.55)),
          leaves=leaf_material(), bush=leaf_material('bush', (0.08, 0.26, 0.04), (0.22, 0.48, 0.08)),
          mintleaf=leaf_material('mintleaf', (0.20, 0.55, 0.10), (0.42, 0.78, 0.22)),
          hill=leaf_material('hill', (0.16, 0.40, 0.07), (0.30, 0.56, 0.12)),
          bark=bark_material(), grass=grass_material(), clay=clay_material(),
          pink=flower_material('pink', (0.95, 0.30, 0.55)), magenta=flower_material('magenta', (0.85, 0.12, 0.40)),
          fcenter=flower_material('fcenter', (0.98, 0.78, 0.15)), stem=flower_material('stem', (0.18, 0.45, 0.08)),
          water=principled('water', (0.55, 0.70, 0.85), 0.05))
MT['bush'].node_tree.nodes['Voronoi Texture'].inputs['Scale'].default_value = 16
MT['hill'].node_tree.nodes['Voronoi Texture'].inputs['Scale'].default_value = 0.4


# ------------------------------------------------------------------ ground
def build_ground():
    n = 220
    xs = np.linspace(-60, 60, n)
    X, Y = np.meshgrid(xs, xs, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), np.zeros(n * n)], 1)
    r = np.hypot(P[:, 0], P[:, 1])
    amp = 0.03 + 0.35 * np.clip((r - 8) / 25, 0, 1)
    P[:, 2] = amp * wnoise(P * np.array([1, 1, 0]), 0.15) - 0.02
    F = []
    for i in range(n - 1):
        for j in range(n - 1):
            a = i * n + j
            F.append((a, a + n, a + n + 1, a + 1))
    # dirt under the key spots
    dirt = np.zeros(len(P))
    for (cx, cy), rr in [(LAYOUT['lift'], 0.9), (LAYOUT['main'], 1.1), (LAYOUT['kitchen'], 1.3), (LAYOUT['fire'], 0.8), (LAYOUT['sap_stand'], 0.7), (LAYOUT['seat'], 0.9)]:
        d = np.hypot(P[:, 0] - cx, P[:, 1] - cy)
        dirt = np.maximum(dirt, np.clip((rr - d) / 0.5, 0, 1))
    g = mesh_obj('ground', P, F, ENV, MT['ground'], attrs={'dirt': ('POINT', 'FLOAT', dirt)})
    return g


def ground_h(x, y):
    return -0.02


# ------------------------------------------------------------------ rocks
def boulder(name, c, r, scale=(1, 1, 0.8), seed=0, mat=None, sink=0.25, sub=4, col=None):
    V, F = icosphere(sub, 1.0)
    d = 1 + 0.10 * wnoise(V * 1.0, 1.3, seed) + 0.025 * wnoise(V, 5.0, seed + 3)
    V = V * d[:, None] * np.array(scale) * r
    V[:, 2] += r * scale[2] * (1 - sink)
    V += np.array([c[0], c[1], 0])
    ob = mesh_obj(name, V, F, col or ENV, mat or MT['stone'])
    return ob


def slab(name, c, z, r=0.52, th=0.08, seed=0, col=None, nside=11):
    rr = np.random.default_rng(seed)
    ang = np.sort(rr.uniform(0, 2 * np.pi, nside))
    rad = r * rr.uniform(0.86, 1.08, nside)
    top = np.stack([rad * np.cos(ang), rad * np.sin(ang) * 0.85, np.full(nside, th / 2)], 1)
    bot = top * np.array([0.97, 0.97, -1])
    V = np.concatenate([top, bot, [[0, 0, th / 2 + 0.004], [0, 0, -th / 2]]]) + np.array([c[0], c[1], z])
    F = []
    for i in range(nside):
        j = (i + 1) % nside
        F.append((i, j, nside + j, nside + i))
        F.append((2 * nside, j, i))
        F.append((2 * nside + 1, nside + i, nside + j))
    ob = mesh_obj(name, V, F, col or ENV, MT['slab'], smooth=False)
    bev = ob.modifiers.new('bev', 'BEVEL'); bev.width = 0.012; bev.segments = 2; bev.limit_method = 'ANGLE'
    ob.data.shade_smooth()
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    except Exception:
        pass
    return ob


def clay_bowl(name, c, z, r=0.17, h=0.09, col=None, water=True):
    prof = [(0.0, 0.0), (r * 0.45, 0.0), (r * 0.62, h * 0.08), (r * 0.9, h * 0.45), (r, h), (r * 0.94, h * 1.02),
            (r * 0.86, h * 0.55), (r * 0.6, h * 0.22), (0.0, h * 0.18)]
    V, F = lathe(prof, 40)
    V += np.array([c[0], c[1], z])
    ob = mesh_obj(name, V, F, col or PROPS, MT['clay'])
    if water:
        Vw, Fw = lathe([(0, h * 0.7), (r * 0.9, h * 0.7)], 40)
        mesh_obj(name + '_water', Vw + np.array([c[0], c[1], z]), Fw, col or PROPS, MT['water'])
    return ob


# ------------------------------------------------------------------ trees / bushes
def tree(name, c, h=3.4, seed=0, canopy=True, col=None, trunk_r=0.15):
    rr = np.random.default_rng(seed)
    zs = np.linspace(-0.2, h, 9)
    bend = rr.normal(0, 0.08, 2)
    pts = np.stack([c[0] + bend[0] * (zs / h) ** 2, c[1] + bend[1] * (zs / h) ** 2, zs], 1)
    rad = trunk_r * (1.25 - 0.5 * zs / h)
    rad[0] *= 1.3
    V, F = tube(pts, rad, 14)
    V += 0.012 * wnoise(V * 3, 2.0, seed)[:, None] * np.array([1, 1, 0])
    tr = mesh_obj(name + '_trunk', V, F, col or ENV, MT['bark'])
    parts = []
    if canopy:
        top = pts[-1]
        for i in range(rr.integers(6, 10)):
            off = rr.normal(0, 1, 3) * np.array([0.75, 0.75, 0.45])
            rb = rr.uniform(0.75, 1.15)
            Vb, Fb = icosphere(3, 1.0)
            Vb = Vb * (1 + 0.12 * wnoise(Vb, 2.0, seed + i))[:, None] * rb
            Vb[:, 2] *= 0.8
            parts.append((Vb + top + off + np.array([0, 0, 0.55]), Fb))
        V, F = merge(parts)
        mesh_obj(name + '_canopy', V, F, col or ENV, MT['leaves'])
    return tr


def flower_mesh(center, normal, size, petals=5, seed=0):
    rr = np.random.default_rng(seed)
    n = np.asarray(normal, float); n /= np.linalg.norm(n)
    a = np.cross(n, [0, 0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0, 0]); a /= np.linalg.norm(a)
    b = np.cross(n, a)
    V, F = [], []
    rot0 = rr.uniform(0, 2 * np.pi)
    for k in range(petals):
        ang = rot0 + 2 * np.pi * k / petals
        d = np.cos(ang) * a + np.sin(ang) * b
        e = -np.sin(ang) * a + np.cos(ang) * b
        base = len(V)
        L, W = size, size * 0.42
        pts = [(0.15, 0), (0.45, 0.55), (0.8, 0.5), (1.0, 0.0), (0.8, -0.5), (0.45, -0.55)]
        V.append(center + n * size * 0.05)
        for (u, w) in pts:
            V.append(center + d * u * L + e * w * W + n * size * (0.1 + 0.15 * u))
        for i in range(1, 6):
            F.append((base, base + i, base + i + 1))
        F.append((base, base + 6, base + 1))
    return np.array(V), F


def bush(name, c, r=0.45, zc=None, flowers=40, seed=0, mat=None, col=None, fmat='pink', hscale=0.85):
    rr = np.random.default_rng(seed)
    zc = r * hscale * 0.8 if zc is None else zc
    Vb, Fb = icosphere(4, 1.0)
    Vb = Vb * (1 + 0.09 * wnoise(Vb, 2.5, seed) + 0.04 * wnoise(Vb, 7, seed + 1))[:, None]
    Vb = Vb * np.array([r, r, r * hscale]) + np.array([c[0], c[1], zc])
    mesh_obj(name, Vb, Fb, col or ENV, mat or MT['bush'])
    if flowers:
        parts, cparts = [], []
        for i in range(flowers):
            u = rr.normal(size=3); u /= np.linalg.norm(u)
            if u[2] < -0.2:
                u[2] = -u[2]
            p = np.array([c[0], c[1], zc]) + u * np.array([r, r, r * hscale]) * 1.02
            s = rr.uniform(0.035, 0.05)
            parts.append(flower_mesh(p, u, s, seed=seed * 100 + i))
            Vc, Fc = icosphere(1, s * 0.25)
            cparts.append((Vc * np.array([1, 1, 0.5]) + p + u * s * 0.12, Fc))
        V, F = merge(parts)
        mesh_obj(name + '_flowers', V, F, col or ENV, MT[fmat], smooth=False)
        V, F = merge(cparts)
        mesh_obj(name + '_fcenters', V, F, col or ENV, MT['fcenter'])


def grass_blades(centers, col, name, tall=False, seed=0):
    rr = np.random.default_rng(seed)
    V, F, T, C = [], [], [], []
    for (cx, cy, nb, hmin, hmax) in centers:
        for _ in range(nb):
            p = np.array([cx, cy, -0.02]) + np.append(rr.normal(0, 0.035 if tall else 0.05, 2), 0)
            h = rr.uniform(hmin, hmax)
            w = rr.uniform(0.006, 0.011) * (1.4 if tall else 1.0)
            ang = rr.uniform(0, 2 * np.pi)
            d = np.array([np.cos(ang), np.sin(ang), 0])
            side = np.array([-np.sin(ang + 0.6), np.cos(ang + 0.6), 0])
            lean = rr.uniform(0.15, 0.55)
            base = len(V)
            segs = 4
            for s in range(segs + 1):
                t = s / segs
                q = p + np.array([0, 0, h * t]) + d * lean * h * t * t
                ww = w * (1 - t) ** 0.7
                if s < segs:
                    V.append(q - side * ww); V.append(q + side * ww); T += [t, t]
                else:
                    V.append(q); T.append(1.0)
            for s in range(segs - 1):
                a = base + 2 * s
                F.append((a, a + 1, a + 3, a + 2))
            a = base + 2 * (segs - 1)
            F.append((a, a + 1, a + 2))
            tint = rr.uniform(0.75, 1.15) * np.array([rr.uniform(0.9, 1.15), 1.0, rr.uniform(0.8, 1.0)])
            C += [np.append(tint, 1)] * (2 * segs + 1)
    return mesh_obj(name, V, F, col, MT['grass'], attrs={'t': ('POINT', 'FLOAT', T), 'tint': ('POINT', 'FLOAT_COLOR', C)})


def build_grass():
    keepout = [(LAYOUT['main'], 0.45), (LAYOUT['table'], 0.5), (LAYOUT['kitchen'], 0.5), (LAYOUT['fire'], 0.55),
               (LAYOUT['ktable'], 0.5), (LAYOUT['sap_stand'], 0.4), (LAYOUT['sap_tree'], 0.25), (LAYOUT['seat'], 0.6),
               (LAYOUT['mint'], 0.35), (LAYOUT['lift'], 0.7)]
    rr = np.random.default_rng(3)
    tiles = {}
    # tall clumps
    for _ in range(2600):
        x, y = rr.uniform(-9, 9), rr.uniform(-7, 11)
        r = np.hypot(x, y)
        if rr.random() > np.exp(-r / 7.0) + 0.05:
            continue
        if any(np.hypot(x - cx, y - cy) < rad for (cx, cy), rad in keepout):
            continue
        key = (int(np.floor(x / 3)), int(np.floor(y / 3)))
        tiles.setdefault(key, []).append((x, y, int(rr.integers(8, 18)), 0.15, rr.uniform(0.3, 0.55)))
    # short tufts
    for _ in range(9000):
        x, y = rr.uniform(-9, 9), rr.uniform(-7, 11)
        r = np.hypot(x, y)
        if rr.random() > np.exp(-r / 5.0) + 0.03:
            continue
        if any(np.hypot(x - cx, y - cy) < rad * 0.8 for (cx, cy), rad in keepout):
            continue
        key = (int(np.floor(x / 3)), int(np.floor(y / 3)))
        tiles.setdefault(key, []).append((x, y, int(rr.integers(4, 9)), 0.05, 0.16))
    for k, cs in tiles.items():
        grass_blades(cs, GRASS, f'grass_{k[0]}_{k[1]}', seed=hash(k) % 1000)


def build_env():
    build_ground()
    # sky-line hills
    for i, (x, y, rx, ry, rz) in enumerate([(-45, 60, 40, 18, 9), (10, 75, 45, 20, 12), (60, 55, 35, 18, 8),
                                             (-80, 40, 30, 15, 7), (85, 30, 30, 15, 6), (-20, 95, 50, 20, 14)]):
        V, F = icosphere(4, 1.0)
        V = V * np.array([rx, ry, rz]) + np.array([x, y, -rz * 0.35])
        mesh_obj(f'hill{i}', V, F, ENV, MT['hill'])
    # boulders
    for i, (x, y, r, sc_, s) in enumerate([(-2.3, 4.2, 1.35, (1.2, 0.9, 0.85), 1), (2.4, 4.6, 1.7, (1.1, 0.9, 0.8), 2),
                                           (0.2, 7.5, 2.2, (1.3, 1.0, 0.8), 3), (-4.8, 1.2, 1.0, (1, 1, 0.8), 4),
                                           (4.9, 0.8, 1.2, (1, 0.9, 0.85), 5), (-1.9, -3.6, 0.55, (1, 1, 0.8), 6),
                                           (5.5, 4.5, 1.1, (1, 1, 0.8), 7), (-5.5, 5.5, 1.5, (1.1, 1, 0.8), 8),
                                           (1.2, 1.8, 0.45, (1, 1, 0.8), 9), (-1.1, 1.2, 0.35, (1, 1, 0.8), 10),
                                           (3.6, -3.5, 0.5, (1, 1, 0.8), 11), (-3.6, -1.6, 0.6, (1, 1, 0.75), 12)]):
        boulder(f'boulder{i}', (x, y), r, sc_, seed=s)
    # main table on a round boulder
    tx, ty = LAYOUT['table']
    boulder('table_base', (tx, ty), 0.36, (1, 1, 1.12), seed=20, sink=0.0, sub=4)
    slab('table_slab', (tx, ty), 0.83, r=0.5, seed=21)
    clay_bowl('bowl', (tx + 0.08, ty - 0.02), 0.87, r=0.16, h=0.085)
    # kitchen table
    kx, ky = LAYOUT['ktable']
    boulder('ktable_base', (kx, ky), 0.33, (1, 1, 1.1), seed=22, sink=0.0)
    slab('ktable_slab', (kx, ky), 0.76, r=0.44, seed=23)
    # seat boulder
    sx, sy = LAYOUT['seat']
    boulder('seat', (sx, sy), 0.4, (1.15, 1.0, 0.85), seed=24, sink=0.5)
    # trees
    for i, (x, y, h, s) in enumerate([(-1.3, 5.3, 3.8, 1), (1.6, 6.2, 4.2, 2), (-4.2, 3.6, 3.6, 3), (4.4, 3.2, 3.9, 4),
                                       (-6.5, -0.5, 3.5, 5), (6.8, -1.2, 3.7, 6), (0.4, 11, 4.5, 7), (-3.0, 8.5, 4.0, 8),
                                       (3.5, 9.5, 4.2, 9), (-8.5, 6, 4.0, 10), (8.5, 6.5, 4.3, 11)]):
        tree(f'tree{i}', (x, y), h, seed=s)
    tree('sap_tree', LAYOUT['sap_tree'], 3.6, seed=31, trunk_r=0.17)
    # bushes
    for i, (x, y, r, fl, fm) in enumerate([(-1.25, 0.75, 0.42, 45, 'pink'), (1.55, 1.05, 0.5, 50, 'pink'),
                                            (-3.4, 2.0, 0.45, 40, 'magenta'), (3.6, 1.4, 0.4, 35, 'pink'),
                                            (-0.6, 3.2, 0.55, 50, 'pink'), (0.9, 3.4, 0.4, 30, 'magenta'),
                                            (-2.2, -1.2, 0.38, 30, 'pink'), (2.0, -0.9, 0.36, 28, 'magenta'),
                                            (3.4, -1.0, 0.42, 35, 'pink'), (-3.3, 3.3, 0.4, 30, 'pink')]):
        bush(f'bush{i}', (x, y), r, flowers=fl, seed=40 + i, fmat=fm)


build_env()
build_grass()
for m_ in bpy.data.materials:
    m_.use_fake_user = True
import json
json.dump(LAYOUT, open('/home/user/work/assets/layout.json', 'w'))
bpy.ops.wm.save_as_mainfile(filepath='/home/user/work/assets/world_env.blend')
print('saved env')
