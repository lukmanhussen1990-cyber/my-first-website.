"""Story props, added on top of world_env.blend -> assets/world.blend"""
import sys, math, json
import numpy as np
sys.path.insert(0, '/home/user/work/scripts')
import bpy, bmesh
from mathutils import Vector, Matrix
from mats import *
from geo import *
from propgeo import wilt_flower_geo


def boulder(name, c, r, scale=(1, 1, 0.8), seed=0, mat=None, sink=0.25, sub=4, col=None):
    V, F = icosphere(sub, 1.0)
    d = 1 + 0.10 * wnoise(V * 1.0, 1.3, seed) + 0.025 * wnoise(V, 5.0, seed + 3)
    V = V * d[:, None] * np.array(scale) * r
    V[:, 2] += r * scale[2] * (1 - sink)
    V += np.array([c[0], c[1], 0])
    return mesh_obj(name, V, F, col, mat or bpy.data.materials['stone'])


def clay_bowl(name, c, z, r=0.17, h=0.09, col=None, water=True):
    prof = [(0.0, 0.0), (r * 0.45, 0.0), (r * 0.62, h * 0.08), (r * 0.9, h * 0.45), (r, h), (r * 0.94, h * 1.02),
            (r * 0.86, h * 0.55), (r * 0.6, h * 0.22), (0.0, h * 0.18)]
    V, F = lathe(prof, 40)
    return mesh_obj(name, V + np.array([c[0], c[1], z]), F, col, bpy.data.materials['clay'])

bpy.ops.wm.open_mainfile(filepath='/home/user/work/assets/world_env.blend')
sc = bpy.context.scene
LAYOUT = json.load(open('/home/user/work/assets/layout.json'))
PROPS = bpy.data.collections['props']
STUDIO = bpy.data.collections['studio']
MT = {m.name: m for m in bpy.data.materials}
rng = np.random.default_rng(9)


def sub(name, parent=PROPS):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def obj_at(ob, loc):
    """move mesh so its origin is at loc (vertices given in world space)."""
    V = verts_of(ob) - np.asarray(loc)
    set_verts(ob, V)
    ob.location = loc
    return ob


# ------------------------------------------------------------------ stone recolour (darker + more speckles)
for name in ('stone', 'slab'):
    m = MT[name]
    vor = m.node_tree.nodes['Voronoi Texture']
    vor.inputs['Scale'].default_value = 34
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeValToRGB' and n.inputs['Fac'].links and n.inputs['Fac'].links[0].from_node == vor:
            n.color_ramp.elements[0].position = 0.16
            n.color_ramp.elements[1].position = 0.24
base_cols = {'stone': (0.40, 0.40, 0.385), 'slab': (0.47, 0.465, 0.45)}
for name, bc in base_cols.items():
    m = MT[name]
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeValToRGB' and n.inputs['Fac'].links and n.inputs['Fac'].links[0].from_node.bl_idname == 'ShaderNodeTexNoise':
            n.color_ramp.elements[0].color = (*[c * 0.8 for c in bc], 1)
            n.color_ramp.elements[1].color = (*[c * 1.12 for c in bc], 1)

# ------------------------------------------------------------------ materials
amber = principled('amber', (0.80, 0.38, 0.03), 0.05)
bsdf(amber).inputs['Coat Weight'].default_value = 0.8
bsdf(amber).inputs['Subsurface Weight'].default_value = 0.4
bsdf(amber).inputs['Subsurface Radius'].default_value = (1.0, 0.5, 0.1)
bsdf(amber).inputs['Emission Color'].default_value = (1.0, 0.55, 0.05, 1)
bsdf(amber).inputs['Emission Strength'].default_value = 0.08
honey = principled('honey', (0.98, 0.62, 0.08), 0.05)
bsdf(honey).inputs['Coat Weight'].default_value = 1.0
bsdf(honey).inputs['Emission Color'].default_value = (1.0, 0.6, 0.1, 1)
bsdf(honey).inputs['Emission Strength'].default_value = 0.3
comb = principled('comb', (0.95, 0.70, 0.18), 0.35)
juice = principled('mintjuice', (0.25, 0.75, 0.12), 0.05)
bsdf(juice).inputs['Coat Weight'].default_value = 1.0
bsdf(juice).inputs['Emission Color'].default_value = (0.3, 0.8, 0.1, 1)
bsdf(juice).inputs['Emission Strength'].default_value = 0.2
gum = principled('gum', (1.0, 0.42, 0.66), 0.25)
bsdf(gum).inputs['Subsurface Weight'].default_value = 0.35
bsdf(gum).inputs['Subsurface Radius'].default_value = (1.0, 0.4, 0.5)
bsdf(gum).inputs['Coat Weight'].default_value = 0.3
bsdf(gum).inputs['Sheen Weight'].default_value = 0.3
gumball = principled('gumball', (1.0, 0.45, 0.68), 0.3)
co = coord(gumball, 'Object')
nz = noise(gumball, co, 25, 2, loc=(-700, 0))
sw = ramp(gumball, nz.outputs['Fac'], [(0.45, (1.0, 0.45, 0.68)), (0.55, (0.55, 0.9, 0.55))], (-400, 0))
link(gumball, sw.outputs['Color'], bsdf(gumball).inputs['Base Color'])
oldgum = principled('oldgum', (0.8, 0.5, 0.6), 0.6)
oi = node(oldgum, 'ShaderNodeObjectInfo', (-600, 0))
link(oldgum, oi.outputs['Color'], bsdf(oldgum).inputs['Base Color'])
wood = principled('wood', (0.45, 0.27, 0.12), 0.8)
co = coord(wood, 'Object')
mp = node(wood, 'ShaderNodeMapping', (-900, 0)); mp.inputs['Scale'].default_value = (1, 12, 12)
link(wood, co, mp.inputs['Vector'])
wv = node(wood, 'ShaderNodeTexWave', (-700, 0), wave_type='BANDS', bands_direction='X')
wv.inputs['Scale'].default_value = 3; wv.inputs['Distortion'].default_value = 6; wv.inputs['Detail'].default_value = 3
link(wood, mp.outputs['Vector'], wv.inputs['Vector'])
wr = ramp(wood, wv.outputs['Fac'], [(0.2, (0.30, 0.17, 0.07)), (0.8, (0.55, 0.34, 0.16))], (-450, 0))
link(wood, wr.outputs['Color'], bsdf(wood).inputs['Base Color'])
bump(wood, wv.outputs['Fac'], 0.2)
signtext = principled('signtext', (0.97, 0.90, 0.70), 0.5)
flint = principled('flint', (0.22, 0.24, 0.28), 0.35)
charcoal = principled('charcoal', (0.05, 0.04, 0.035), 0.9)
flame = bpy.data.materials.new('flame')
flame.use_nodes = True
nt = flame.node_tree
nt.nodes.remove(nt.nodes['Principled BSDF'])
em = nt.nodes.new('ShaderNodeEmission')
ly = nt.nodes.new('ShaderNodeAttribute'); ly.attribute_name = 'h'
fr = nt.nodes.new('ShaderNodeValToRGB')
fr.color_ramp.elements[0].color = (1.0, 0.25, 0.02, 1)
fr.color_ramp.elements[1].color = (1.0, 0.85, 0.3, 1)
nt.links.new(ly.outputs['Fac'], fr.inputs['Fac'])
nt.links.new(fr.outputs['Color'], em.inputs['Color'])
em.inputs['Strength'].default_value = 6.0
nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
snailshell = principled('snailshell', (0.55, 0.30, 0.12), 0.35)
co = coord(snailshell, 'Generated')
wv2 = node(snailshell, 'ShaderNodeTexWave', (-600, 0), wave_type='RINGS')
wv2.inputs['Scale'].default_value = 4; wv2.inputs['Distortion'].default_value = 2
link(snailshell, co, wv2.inputs['Vector'])
sr = ramp(snailshell, wv2.outputs['Fac'], [(0.3, (0.35, 0.16, 0.06)), (0.7, (0.85, 0.55, 0.22))], (-350, 0))
link(snailshell, sr.outputs['Color'], bsdf(snailshell).inputs['Base Color'])
snailbody = principled('snailbody', (0.55, 0.62, 0.42), 0.3)
bsdf(snailbody).inputs['Subsurface Weight'].default_value = 0.3
white = principled('eyewhite', (0.95, 0.95, 0.95), 0.1)
black = principled('pupil', (0.01, 0.01, 0.01), 0.1)
birdblue = principled('birdblue', (0.15, 0.42, 0.85), 0.5)
birdbelly = principled('birdbelly', (0.95, 0.85, 0.55), 0.6)
beak = principled('beak', (1.0, 0.55, 0.08), 0.4)
for m in (amber, honey, comb, juice, gum, gumball, oldgum, wood, signtext, flint, charcoal, flame, snailshell,
          snailbody, white, black, birdblue, birdbelly, beak):
    MT[m.name] = m


# ------------------------------------------------------------------ wilting flowers (geometry rebuilt per frame by the animator)
def wilt_flower_geo(h, bend, seed, droop):
    rr = np.random.default_rng(seed)
    n = 10
    t = np.linspace(0, 1, n)
    ang = bend * 1.6 * t ** 1.5
    pts = np.stack([np.sin(ang) * h * 0.5 * t * 0 + 0, np.zeros(n), np.zeros(n)], 1)
    # integrate along bent stem in the x-z plane
    seg = h / (n - 1)
    p = np.zeros(3); P = [p.copy()]
    for i in range(1, n):
        a = bend * 1.7 * ((i / (n - 1)) ** 1.4)
        p = p + seg * np.array([np.sin(a), 0, np.cos(a)])
        P.append(p.copy())
    P = np.array(P)
    Vs, Fs = tube(P, np.linspace(0.006, 0.004, n), 6)
    tip = P[-1]; tdir = P[-1] - P[-2]; tdir /= np.linalg.norm(tdir)
    size = 0.055
    nrm = tdir * (1 - droop) + np.array([0, -0.6, 0]) * (1 - bend) * 0.6
    nrm /= np.linalg.norm(nrm)
    Vf, Ff = flower_petals(tip, nrm, size, droop, seed)
    Vc, Fc = icosphere(1, size * 0.28)
    Vc = Vc * np.array([1, 1, 0.55]) + tip + nrm * size * 0.1
    return (Vs, Fs), (Vf, Ff), (Vc, Fc)


def flower_petals(center, n, size, droop, seed):
    rr = np.random.default_rng(seed)
    n = np.asarray(n, float); n /= np.linalg.norm(n)
    a = np.cross(n, [0, 0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0, 0]); a /= np.linalg.norm(a)
    b = np.cross(n, a)
    V, F = [], []
    for k in range(7):
        ang = 2 * np.pi * k / 7 + seed
        d = np.cos(ang) * a + np.sin(ang) * b
        e = -np.sin(ang) * a + np.cos(ang) * b
        base = len(V)
        V.append(center)
        for (u, w) in [(0.2, 0), (0.5, 0.45), (0.85, 0.38), (1.0, 0.0), (0.85, -0.38), (0.5, -0.45)]:
            fold = droop * 1.2 * u * u
            V.append(center + d * u * size * (1 - 0.3 * droop) + e * w * size * 0.42 + n * size * (0.08 + 0.1 * u - fold))
        for i in range(1, 6):
            F.append((base, base + i, base + i + 1))
        F.append((base, base + 6, base + 1))
    return np.array(V), F


WILT = sub('wilt')
wx, wy = LAYOUT['wilt']
WZ = 0.87
# clay flower pot on the table
prof = [(0.0, 0.0), (0.06, 0.0), (0.075, 0.03), (0.085, 0.1), (0.095, 0.125), (0.085, 0.13), (0.077, 0.11), (0.0, 0.1)]
V, F = lathe(prof, 32)
mesh_obj('flowerpot', V + np.array([wx, wy, WZ]), F, WILT, MT['clay'])
Vd, Fd = lathe([(0, 0.105), (0.078, 0.105)], 32)
dirt_m = principled('potdirt', (0.22, 0.14, 0.08), 0.95)
mesh_obj('flowerpot_dirt', Vd + np.array([wx, wy, WZ]), Fd, WILT, dirt_m)
wilt_specs = []
for i, (dx, dy, h) in enumerate([(0, 0, 0.42), (0.03, 0.02, 0.47), (-0.025, 0.02, 0.4), (0.015, -0.025, 0.37), (-0.03, -0.015, 0.45)]):
    base = np.array([wx + dx, wy + dy, WZ + 0.1])
    (Vs, Fs), (Vf, Ff), (Vc, Fc) = wilt_flower_geo(h, 0.0, i, 0.0)
    s = mesh_obj(f'wilt{i}_stem', Vs + base, Fs, WILT, MT['stem'])
    f = mesh_obj(f'wilt{i}_petals', Vf + base, Ff, WILT, MT['pink'], smooth=False)
    c = mesh_obj(f'wilt{i}_center', Vc + base, Fc, WILT, MT['fcenter'])
    wilt_specs.append(dict(i=i, base=base.tolist(), h=h))
leafparts = []
for k in range(9):
    ang = rng.uniform(0, 2 * np.pi)
    d = np.array([np.cos(ang), np.sin(ang), 0])
    L = rng.uniform(0.08, 0.13)
    side = np.cross(d, [0, 0, 1])
    V = []
    for j, t in enumerate(np.linspace(0, 1, 6)):
        pt = np.array([wx, wy, WZ + 0.1]) + d * L * t + np.array([0, 0, 0.5 * L * np.sin(t * 2.2)])
        w_ = 0.016 * np.sin(np.pi * min(t * 1.1, 1)) + 0.002
        V += [pt - side * w_, pt + side * w_]
    F = [(2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2) for j in range(5)]
    leafparts.append((np.array(V), F))
V, F = merge(leafparts)
mesh_obj('wilt_leaves', V, F, WILT, MT['stem'])

# ------------------------------------------------------------------ mint bush + handful
MINT = sub('mint')


def leaf_shape(size, serr=True):
    V = [(0, 0, 0)]
    pts = []
    for t in np.linspace(0.05, 1, 9):
        w = 0.5 * np.sin(np.pi * t) ** 0.8 * (1 + (0.12 * (np.sin(t * 40) > 0) if serr else 0))
        pts.append((t, w))
    for t, w in pts:
        V.append((t * size, w * size * 0.6, 0.06 * size * w))
    for t, w in pts[::-1]:
        V.append((t * size, -w * size * 0.6, 0.06 * size * w))
    V = np.array(V)
    n = len(V)
    F = [(0, i, i + 1) for i in range(1, n - 1)]
    return V, F


def place_leaves(center, radius, count, size, seed, hscale=1.0, up_only=True):
    rr = np.random.default_rng(seed)
    parts = []
    Vl, Fl = leaf_shape(size)
    for i in range(count):
        u = rr.normal(size=3); u /= np.linalg.norm(u)
        if up_only and u[2] < -0.3:
            u[2] = -u[2] * 0.5
        p = np.asarray(center) + u * radius * np.array([1, 1, hscale])
        d = u + rr.normal(0, 0.4, 3); d /= np.linalg.norm(d)
        side = np.cross(d, [0, 0, 1.0]); side /= max(np.linalg.norm(side), 1e-6)
        up = np.cross(side, d)
        s = rr.uniform(0.8, 1.2)
        R = np.stack([d, side, up], 1)
        parts.append(((Vl * s) @ R.T + p, Fl))
    return merge(parts)


mx, my = LAYOUT['mint']
mc = np.array([mx, my, 0.62])
V, F = icosphere(3, 1.0)
V = V * (1 + 0.08 * wnoise(V, 3, 2))[:, None] * np.array([0.3, 0.3, 0.33]) + mc
mesh_obj('mint_core', V, F, MINT, MT['bush'])
V, F = place_leaves(mc, 0.31, 420, 0.055, 1, hscale=1.08)
mesh_obj('mint_leaves', V, F, MINT, MT['mintleaf'], smooth=False)
# stems to the ground
V, F = merge([tube([[mx + dx, my + dy, -0.02], [mx + dx * 0.5, my + dy * 0.5, 0.35]], 0.012, 6) for dx, dy in [(0.05, 0), (-0.04, 0.03), (0, -0.05)]])
mesh_obj('mint_stems', V, F, MINT, MT['stem'])
V, F = place_leaves((0, 0, 0), 0.03, 12, 0.05, 7, up_only=False)
mesh_obj('mint_handful', V, F, MINT, MT['mintleaf'], smooth=False)
V, F = place_leaves((0, 0, 0), 0.02, 6, 0.04, 8, up_only=False)
mesh_obj('mint_pinch', V, F, MINT, MT['mintleaf'], smooth=False)

# ------------------------------------------------------------------ green juice drops (instanced per frame)
JUICE = sub('juice')
for i in range(8):
    V, F = uvsphere(12, 8, 1.0)
    V = V * np.array([0.0045, 0.0045, 0.0065])
    V[:, 2] -= np.clip(V[:, 2], None, 0) * 0.8
    mesh_obj(f'drop{i}', V, F, JUICE, juice)
V, F = uvsphere(16, 8, 1.0)
mesh_obj('juice_smear', V * np.array([0.03, 0.012, 0.04]), F, JUICE, juice)

# ------------------------------------------------------------------ sap tree details
SAP = sub('sap')
tx, ty = LAYOUT['sap_tree']
sparts = []
for (a, z, s) in [(-2.1, 1.32, 1.0), (-1.95, 1.22, 0.7), (-2.3, 1.40, 0.6), (-1.85, 1.10, 0.5)]:
    p = np.array([tx + 0.17 * np.cos(a), ty + 0.17 * np.sin(a), z])
    V, F = uvsphere(16, 8, 1.0)
    V = V * np.array([0.035, 0.03, 0.05]) * s
    out = np.array([np.cos(a), np.sin(a), 0])
    V = V + p + out * 0.008
    sparts.append((V, F))
    drip = [p + out * 0.012 + np.array([0, 0, -0.02 * k]) for k in range(6)]
    sparts.append(tube(drip, np.linspace(0.009, 0.004, 6) * s, 6))
V, F = merge(sparts)
mesh_obj('sap_on_tree', V, F, SAP, amber)
V, F = icosphere(2, 1.0)
V = V * (1 + 0.15 * wnoise(V, 3, 5))[:, None] * np.array([0.018, 0.014, 0.014])
mesh_obj('sap_lump', V, F, SAP, amber)
V, F = icosphere(1, 1.0)
V = V * np.array([0.045, 0.02, 0.012])
mesh_obj('flint', V, F, SAP, flint, smooth=False)
mesh_obj('sap_strings', np.zeros((3, 3)), [(0, 1, 2)], SAP, amber)
# scrape marks / sap smear on the flint tip
V, F = uvsphere(10, 6, 1.0)
mesh_obj('flint_sap', V * np.array([0.012, 0.012, 0.008]), F, SAP, amber)

# ------------------------------------------------------------------ kitchen
KIT = sub('kitchen')
fx_, fy_ = LAYOUT['fire']
# stone ring
for k in range(9):
    a = 2 * np.pi * k / 9
    boulder(f'firestone{k}', (fx_ + 0.27 * np.cos(a), fy_ + 0.27 * np.sin(a)), 0.085, (1.2, 1.0, 0.8), seed=60 + k, sink=0.2, sub=2, col=KIT)
# pot supports (three stacked stones)
for k in range(3):
    a = 2 * np.pi * k / 3 + 0.4
    V, F = icosphere(2, 1.0)
    V = V * (1 + 0.1 * wnoise(V, 2, k))[:, None] * np.array([0.07, 0.07, 0.12]) + np.array([fx_ + 0.15 * np.cos(a), fy_ + 0.15 * np.sin(a), 0.1])
    mesh_obj(f'potstone{k}', V, F, KIT, MT['stone'])
# logs
for k, a in enumerate([0.3, 1.9, 3.5]):
    d = np.array([np.cos(a), np.sin(a), 0])
    P = [np.array([fx_, fy_, 0.03]) - d * 0.16, np.array([fx_, fy_, 0.06]) + d * 0.16]
    V, F = tube(P, 0.03, 10)
    mesh_obj(f'log{k}', V, F, KIT, MT['bark'])
V, F = icosphere(2, 1.0)
mesh_obj('embers', V * np.array([0.14, 0.14, 0.03]) + np.array([fx_, fy_, 0.0]), F, KIT, charcoal)
for k in range(5):
    prof = [(0, 0), (0.035, 0.03), (0.04, 0.07), (0.028, 0.12), (0.012, 0.17), (0, 0.2)]
    V, F = lathe(prof, 12)
    h = np.clip(V[:, 2] / 0.2, 0, 1)
    ob = mesh_obj(f'flame{k}', V, F, KIT, flame, attrs={'h': ('POINT', 'FLOAT', h)})
    a = 2 * np.pi * k / 5
    ob.location = (fx_ + 0.06 * np.cos(a), fy_ + 0.06 * np.sin(a), 0.02)
    ob.visible_shadow = False
# fire light
fl = bpy.data.lights.new('firelight', 'POINT'); fl.energy = 25; fl.color = (1.0, 0.55, 0.2); fl.shadow_soft_size = 0.2
flo = bpy.data.objects.new('firelight', fl); KIT.objects.link(flo); flo.location = (fx_, fy_, 0.3)
# pot
pz = 0.2
prof = [(0, 0), (0.09, 0.0), (0.15, 0.05), (0.175, 0.12), (0.165, 0.19), (0.14, 0.215), (0.15, 0.235), (0.135, 0.235),
        (0.125, 0.21), (0.15, 0.17), (0.155, 0.12), (0.135, 0.06), (0, 0.04)]
V, F = lathe(prof, 40)
mesh_obj('pot', V + np.array([fx_, fy_, pz]), F, KIT, MT['clay'])
V, F = lathe([(0, 0), (0.15, 0)], 40)
pm = principled('potmix', (0.95, 0.6, 0.12), 0.15)
bsdf(pm).inputs['Coat Weight'].default_value = 0.6
bsdf(pm).inputs['Emission Color'].default_value = (1, 0.6, 0.1, 1); bsdf(pm).inputs['Emission Strength'].default_value = 0.15
MT['potmix'] = pm
mesh_obj('pot_mix', V + np.array([fx_, fy_, pz + 0.175]), F, KIT, pm)
for k in range(6):
    V, F = uvsphere(10, 6, 1.0)
    ob = mesh_obj(f'bubble_s{k}', V * 0.012, F, KIT, pm)
# stirring stick
V, F = tube([[0, 0, 0], [0, 0, 0.42]], 0.011, 8)
mesh_obj('stick', V, F, KIT, wood)
# honeycomb (hex prism grid)
parts = []
for i in range(5):
    for j in range(4):
        cx = i * 0.026 + (j % 2) * 0.013
        cy = j * 0.0225
        prof = []
        Vh, Fh = lathe([(0.012, -0.012), (0.0135, -0.012), (0.0135, 0.012), (0.012, 0.012), (0.012, -0.006), (0.0, -0.006)], 6)
        R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])
        parts.append((Vh @ R.T * np.array([1, 1, 1]) + np.array([0, cx - 0.05, cy - 0.034]), Fh))
V, F = merge(parts)
ob = mesh_obj('honeycomb', V, F, KIT, comb, smooth=False)
V, F = uvsphere(12, 8, 1.0)
mesh_obj('honey_fill', V * np.array([0.01, 0.06, 0.045]), F, KIT, honey)
mesh_obj('honey_drip', np.zeros((3, 3)), [(0, 1, 2)], KIT, honey)
# gum balls on the slab
kx, ky = LAYOUT['ktable']
for k in range(7):
    V, F = uvsphere(16, 8, 1.0)
    ob = mesh_obj(f'gumball{k}', V * 0.016, F, KIT, gumball)
    a = rng.uniform(0, 2 * np.pi); r = rng.uniform(0.05, 0.22)
    ob.location = (kx + r * np.cos(a), ky - 0.05 + r * np.sin(a) * 0.6, 0.817)
    ob.rotation_euler = rng.uniform(0, 6.28, 3)
# a bowl of mint leaves on the kitchen slab
clay_bowl('kbowl', (kx + 0.2, ky + 0.12), 0.80, r=0.1, h=0.06, col=KIT, water=False)
V, F = place_leaves((kx + 0.2, ky + 0.12, 0.85), 0.05, 30, 0.04, 11)
mesh_obj('kbowl_mint', V, F, KIT, MT['mintleaf'], smooth=False)
# sign
sx_, sy_ = LAYOUT['sign']
SZ = 2.16
V, F = merge([tube([[sx_ - 0.42, sy_, -0.05], [sx_ - 0.42, sy_, SZ + 0.2]], 0.032, 8), tube([[sx_ + 0.42, sy_, -0.05], [sx_ + 0.42, sy_, SZ + 0.2]], 0.032, 8)])
mesh_obj('sign_posts', V, F, KIT, wood)
bpy.ops.mesh.primitive_cube_add(size=1.0)
board = bpy.context.active_object
board.name = 'sign_board'
board.scale = (1.05, 0.04, 0.36)
board.location = (sx_, sy_ - 0.035, SZ)
for c in board.users_collection:
    c.objects.unlink(board)
KIT.objects.link(board)
board.data.materials.append(wood)
bev = board.modifiers.new('bev', 'BEVEL'); bev.width = 0.02; bev.segments = 2
font = bpy.data.fonts.load('/home/user/work/assets/fonts/Poppins-Black.ttf')
for i, (txt, z, size) in enumerate([('CHEW-MASTER', SZ + 0.045, 0.125), ('3000', SZ - 0.1, 0.12)]):
    cu = bpy.data.curves.new(f'signtxt{i}', 'FONT')
    cu.body = txt; cu.font = font; cu.size = size; cu.extrude = 0.006
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    to = bpy.data.objects.new(f'sign_text{i}', cu)
    KIT.objects.link(to)
    to.location = (sx_, sy_ - 0.062, z)
    to.rotation_euler = (math.radians(90), 0, 0)
    cu.materials.append(signtext)

# ------------------------------------------------------------------ chewing gum pieces
GUM = sub('gum')
V, F = icosphere(3, 1.0)
V = V * (1 + 0.12 * wnoise(V, 2.5, 3))[:, None] * 0.016
mesh_obj('gum_piece', V, F, GUM, gum)
mesh_obj('gum_strand', np.zeros((3, 3)), [(0, 1, 2)], GUM, gum)
V, F = uvsphere(48, 24, 1.0)
mesh_obj('bubble', V, F, GUM, gum)
# splat blobs (placed on the face by the animator)
for k in range(14):
    V, F = icosphere(2, 1.0)
    V = V * (1 + 0.25 * wnoise(V, 2, k))[:, None]
    mesh_obj(f'splat{k}', V, F, GUM, gum)
# old gum under the main table slab
tx_, ty_ = LAYOUT['table']
parts = {}
cols = [(1.0, 0.45, 0.66), (0.55, 0.85, 0.5), (0.5, 0.7, 1.0), (1.0, 0.85, 0.35), (0.75, 0.7, 0.68), (0.95, 0.6, 0.8)]
UNDER = sub('under_gum')
for k in range(320):
    a = rng.uniform(0, 2 * np.pi); r = 0.45 * np.sqrt(rng.uniform(0.04, 1))
    V, F = icosphere(1, 1.0)
    s = rng.uniform(0.012, 0.022)
    V = V * (1 + 0.25 * wnoise(V, 2, k))[:, None] * np.array([s, s, s * 0.55])
    p = np.array([tx_ + r * np.cos(a), ty_ + r * np.sin(a) * 0.82, 0.79 - s * 0.25])
    ci = k % len(cols)
    parts.setdefault(ci, []).append((V + p, F))
for ci, pl in parts.items():
    V, F = merge(pl)
    m = principled(f'oldgum{ci}', tuple(c * 0.92 for c in cols[ci]), 0.55)
    mesh_obj(f'under_gum{ci}', V, F, UNDER, m)

# ------------------------------------------------------------------ snail
SNAIL = sub('snail')
t = np.linspace(0, 1, 60)
ang = t * 2.6 * 2 * np.pi
rad = 0.004 + 0.028 * t
P = np.stack([np.cos(ang) * rad * 1.0, np.zeros_like(t) + t * 0.012, np.sin(ang) * rad], 1)
V, F = tube(P[::-1], (0.003 + 0.021 * t)[::-1], 14)
ob = mesh_obj('snail_shell', V, F, SNAIL, snailshell)
P = np.array([[-0.05, 0, -0.022], [-0.02, 0, -0.026], [0.02, 0, -0.026], [0.045, 0, -0.02], [0.06, 0, -0.005]])
V, F = tube(P, [0.008, 0.013, 0.013, 0.011, 0.009], 12)
mesh_obj('snail_body', V, F, SNAIL, snailbody)
for k, sy in enumerate((-1, 1)):
    P = np.array([[0.058, 0.004 * sy, 0.0], [0.065, 0.008 * sy, 0.02], [0.07, 0.012 * sy, 0.033]])
    V, F = tube(P, 0.0018, 6)
    mesh_obj(f'snail_stalk{k}', V, F, SNAIL, snailbody)
    V, F = uvsphere(10, 6, 0.005)
    mesh_obj(f'snail_eye{k}', V + P[-1], F, SNAIL, white)
    V, F = uvsphere(8, 6, 0.0022)
    mesh_obj(f'snail_pupil{k}', V + P[-1] + np.array([0.004, 0, -0.001]), F, SNAIL, black)
    # heavy half-closed lids
    V, F = uvsphere(10, 6, 0.0056)
    V = V[V[:, 2] > -10]
    Vl, Fl = uvsphere(10, 6, 0.0057)
    Vl[:, 2] = np.maximum(Vl[:, 2], 0.0)
    mesh_obj(f'snail_lid{k}', Vl + P[-1] + np.array([0, 0, -0.0005]), Fl, SNAIL, snailbody)

# ------------------------------------------------------------------ birds
BIRDS = sub('birds')


def make_bird(name):
    parts = []
    V, F = uvsphere(16, 10, 1.0)
    parts_b = [(V * np.array([0.05, 0.075, 0.045]), F), (V * 0.038 + np.array([0, -0.07, 0.03]), F)]
    Vb, Fb = merge(parts_b)
    body = mesh_obj(name + '_body', Vb, Fb, BIRDS, birdblue)
    V2, F2 = uvsphere(12, 8, 1.0)
    mesh_obj(name + '_belly', V2 * np.array([0.04, 0.05, 0.03]) + np.array([0, -0.01, -0.017]), F2, BIRDS, birdbelly)
    Vk, Fk = lathe([(0.012, 0), (0.0, 0.03)], 8)
    R = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
    mesh_obj(name + '_beak', Vk @ R.T + np.array([0, -0.10, 0.03]), Fk, BIRDS, beak)
    for k, sx in enumerate((-1, 1)):
        Ve, Fe = uvsphere(10, 8, 0.011)
        mesh_obj(f'{name}_eye{k}', Ve + np.array([sx * 0.022, -0.092, 0.045]), Fe, BIRDS, white)
        Vp, Fp = uvsphere(8, 6, 0.0055)
        mesh_obj(f'{name}_pupil{k}', Vp + np.array([sx * 0.025, -0.1, 0.047]), Fp, BIRDS, black)
        Vw, Fw = uvsphere(12, 6, 1.0)
        Vw = Vw * np.array([0.07, 0.035, 0.008]) + np.array([sx * 0.07, 0.0, 0])
        mesh_obj(f'{name}_wing{k}', Vw, Fw, BIRDS, birdblue)
    Vt, Ft = uvsphere(10, 6, 1.0)
    mesh_obj(name + '_tail', Vt * np.array([0.025, 0.05, 0.006]) + np.array([0, 0.1, 0.01]), Ft, BIRDS, birdblue)


for b in range(4):
    make_bird(f'bird{b}')

# ------------------------------------------------------------------ explainer studio (far away at x=100)
SX = 100.0
prof = [(-8.0, 0.0)] + [(1.5 + 2.0 * np.sin(a), 2.0 - 2.0 * np.cos(a)) for a in np.linspace(0, np.pi / 2, 12)] + [(3.5, 10.0)]
V, F = [], []
xs = np.linspace(-8, 8, 9)
for x in xs:
    for (y, z) in prof:
        V.append((SX + x, y, z))
m_ = len(prof)
for i in range(len(xs) - 1):
    for j in range(m_ - 1):
        a_ = i * m_ + j
        F.append((a_, a_ + m_, a_ + m_ + 1, a_ + 1))
studio_m = principled('studio_bg', (0.42, 0.62, 0.86), 0.9)
bsdf(studio_m).inputs['Emission Color'].default_value = (0.42, 0.62, 0.86, 1)
bsdf(studio_m).inputs['Emission Strength'].default_value = 0.12
cyc = mesh_obj('studio_cyc', V, F, STUDIO, studio_m)
sub_m = cyc.modifiers.new('sub', 'SUBSURF'); sub_m.levels = 2; sub_m.render_levels = 2
glass = principled('glassgum', (1.0, 0.55, 0.75), 0.08)
bsdf(glass).inputs['Alpha'].default_value = 0.35
bsdf(glass).inputs['Coat Weight'].default_value = 1.0
glass.surface_render_method = 'BLENDED'
V, F = uvsphere(48, 24, 1.0)
mesh_obj('ex_ball', V, F, STUDIO, glass)
fiber = principled('fiber', (0.97, 0.97, 0.97), 0.3)
bsdf(fiber).inputs['Emission Color'].default_value = (1, 1, 1, 1); bsdf(fiber).inputs['Emission Strength'].default_value = 0.3
for k in range(9):
    mesh_obj(f'ex_fiber{k}', np.zeros((3, 3)), [(0, 1, 2)], STUDIO, fiber)
arrow_m = principled('arrow', (0.25, 0.85, 0.35), 0.4)
bsdf(arrow_m).inputs['Emission Color'].default_value = (0.25, 0.85, 0.35, 1); bsdf(arrow_m).inputs['Emission Strength'].default_value = 0.4
for k in range(2):
    Vs, Fs = tube([[0, 0, 0], [0.22, 0, 0]], 0.022, 16)
    Vc, Fc = lathe([(0.055, 0), (0.0, 0.1)], 20)
    R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]])
    V, F = merge([(Vs, Fs), (Vc @ R.T + np.array([0.22, 0, 0]), Fc)])
    mesh_obj(f'ex_arrow{k}', V, F, STUDIO, arrow_m)
# studio key light
kl = bpy.data.lights.new('studio_key', 'AREA'); kl.energy = 90; kl.size = 3
klo = bpy.data.objects.new('studio_key', kl); STUDIO.objects.link(klo)
klo.location = (SX - 1.5, -3, 3); klo.rotation_euler = (math.radians(50), 0, math.radians(-30))

json.dump(dict(wilt=wilt_specs, studio_x=SX), open('/home/user/work/assets/props.json', 'w'))
bpy.ops.wm.save_as_mainfile(filepath='/home/user/work/assets/world.blend')
print('saved props')
