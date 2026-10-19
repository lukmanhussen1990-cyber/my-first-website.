"""Procedural Manhattan intersection: streets, sidewalks, buildings, street furniture, sky."""
import bpy
import math
import random
import os
import sys
import numpy as np
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import timeline as TL  # noqa: E402

TEX = "/opt/assets/ph"
GEN = "/opt/work/assets/gen"          # generated textures (signs, interiors, emblem)


# ============================================================================ mesh builder
class MB:
    """Accumulates quads/polys with per-face material names and metric UVs."""

    def __init__(self):
        self.v, self.f, self.uv, self.m = [], [], [], []

    def poly(self, pts, mat, uvs=None):
        i0 = len(self.v)
        self.v.extend([tuple(p) for p in pts])
        self.f.append(tuple(range(i0, i0 + len(pts))))
        if uvs is None:
            uvs = self._auto_uv(pts)
        self.uv.append(uvs)
        self.m.append(mat)

    @staticmethod
    def _auto_uv(pts):
        p = np.array(pts, float)
        n = np.cross(p[1] - p[0], p[2] - p[0])
        a = np.abs(n)
        if a[2] >= a[0] and a[2] >= a[1]:
            return [(q[0], q[1]) for q in p]
        if a[0] >= a[1]:
            return [(q[1] * np.sign(n[0] or 1), q[2]) for q in p]
        return [(-q[0] * np.sign(n[1] or 1), q[2]) for q in p]

    def box(self, lo, hi, mat, skip=()):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        faces = {"-z": (0, 3, 2, 1), "+z": (4, 5, 6, 7), "-y": (0, 1, 5, 4),
                 "+x": (1, 2, 6, 5), "+y": (2, 3, 7, 6), "-x": (3, 0, 4, 7)}
        for k, idx in faces.items():
            if k in skip:
                continue
            self.poly([P[i] for i in idx], mat)

    def obox(self, origin, d, n, u0, u1, z0, z1, w0, w1, mat, skip=()):
        """Box in a facade frame: d = along-facade unit, n = outward unit (horizontal),
        u along d, w along n (outward offset), z vertical."""
        o, d, n = np.array(origin, float), np.array(d, float), np.array(n, float)

        def P(u, w, z):
            q = o + d * u + n * w
            return (q[0], q[1], z)
        c = [P(u0, w0, z0), P(u1, w0, z0), P(u1, w1, z0), P(u0, w1, z0),
             P(u0, w0, z1), P(u1, w0, z1), P(u1, w1, z1), P(u0, w1, z1)]
        faces = {"bottom": (0, 3, 2, 1), "top": (4, 5, 6, 7), "back": (0, 1, 5, 4),
                 "right": (1, 2, 6, 5), "front": (2, 3, 7, 6), "left": (3, 0, 4, 7)}
        # orientation: when d x n points up the winding above is outward
        flip = np.cross(d, n)[2] < 0
        for k, idx in faces.items():
            if k in skip:
                continue
            ids = idx[::-1] if flip else idx
            pts = [c[i] for i in ids]
            if k in ("front", "back"):
                uv = [((u0 if i in (0, 3, 4, 7) else u1), c[i][2]) for i in ids]
                self.poly(pts, mat, uv)
            else:
                self.poly(pts, mat)

    def build(self, name, collection, mats, smooth=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        names = sorted(set(self.m), key=self.m.index)
        for nm in names:
            me.materials.append(mats[nm])
        idx = {nm: i for i, nm in enumerate(names)}
        me.polygons.foreach_set("material_index", [idx[m] for m in self.m])
        uvl = me.uv_layers.new(name="UVMap")
        flat = [c for face in self.uv for uv in face for c in uv]
        uvl.data.foreach_set("uv", flat)
        if smooth:
            me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.validate()
        ob = bpy.data.objects.new(name, me)
        collection.objects.link(ob)
        return ob


# ============================================================================ materials
def _img(path, colorspace="sRGB"):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def pbr_texture_material(name, tex, scale=1.0, tint=(1, 1, 1), rough_mul=1.0, bump=0.3, extra=None,
                         spec=0.5):
    """Material from a Poly Haven texture set, mapped by UV in metres / `scale`."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    uv = nt.nodes.new("ShaderNodeUVMap")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0 / scale, 1.0 / scale, 1.0)
    nt.links.new(uv.outputs[0], mp.inputs[0])
    d = nt.nodes.new("ShaderNodeTexImage")
    d.image = _img(f"{TEX}/{tex}/diff.jpg")
    r = nt.nodes.new("ShaderNodeTexImage")
    r.image = _img(f"{TEX}/{tex}/rough.jpg", "Non-Color")
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = _img(f"{TEX}/{tex}/nor_gl.jpg", "Non-Color")
    for t in (d, r, n):
        nt.links.new(mp.outputs[0], t.inputs[0])
    tintn = nt.nodes.new("ShaderNodeMix")
    tintn.data_type = 'RGBA'
    tintn.blend_type = 'MULTIPLY'
    tintn.inputs["Factor"].default_value = 1.0
    tintn.inputs[7].default_value = (*tint, 1)
    nt.links.new(d.outputs[0], tintn.inputs[6])
    base = tintn.outputs[2]
    if extra:
        base = extra(nt, base, uv)
    nt.links.new(base, bsdf.inputs["Base Color"])
    rm = nt.nodes.new("ShaderNodeMath")
    rm.operation = 'MULTIPLY'
    rm.inputs[1].default_value = rough_mul
    rm.use_clamp = True
    nt.links.new(r.outputs[0], rm.inputs[0])
    nt.links.new(rm.outputs[0], bsdf.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = bump
    nt.links.new(n.outputs[0], nm.inputs["Color"])
    nt.links.new(nm.outputs[0], bsdf.inputs["Normal"])
    bsdf.inputs["Specular IOR Level"].default_value = spec
    return mat


def simple_material(name, color, rough=0.5, metal=0.0, emission=None, strength=0.0, coat=0.0, alpha=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    return mat


def noise_mix(nt, base, coord_out, scale, color, fac, detail=4.0, lo=0.4, hi=0.7, blend='MIX'):
    """Mix `color` into `base` through a thresholded noise mask (grime, patches...)."""
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(coord_out, nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = lo
    ramp.inputs["From Max"].default_value = hi
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = fac
    nt.links.new(ramp.outputs[0], mul.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = blend
    nt.links.new(mul.outputs[0], mix.inputs["Factor"])
    nt.links.new(base, mix.inputs[6])
    mix.inputs[7].default_value = (*color, 1)
    return mix.outputs[2]


class NT:
    """Tiny helper for building shader node trees in code."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()

    def node(self, kind, **inputs):
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if isinstance(k, str) and k.startswith("_"):
                setattr(n, k[1:], v)
                continue
            self.set(n.inputs[k], v)
        return n

    def set(self, sock, v):
        if hasattr(v, "is_output") or isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, sock)
        else:
            sock.default_value = v

    def math(self, op, a, b=0.0, clamp=False):
        n = self.nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        self.set(n.inputs[0], a)
        self.set(n.inputs[1], b)
        return n.outputs[0]

    def vmath(self, op, a, b=(0, 0, 0), scale=None):
        n = self.nt.nodes.new("ShaderNodeVectorMath")
        n.operation = op
        self.set(n.inputs[0], a)
        self.set(n.inputs[1], b)
        if scale is not None:
            self.set(n.inputs[3], scale)
        return n.outputs[0] if op not in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs[1]

    def mixc(self, fac, a, b, blend='MIX'):
        n = self.nt.nodes.new("ShaderNodeMix")
        n.data_type = 'RGBA'
        n.blend_type = blend
        self.set(n.inputs["Factor"], fac)
        self.set(n.inputs[6], a)
        self.set(n.inputs[7], b)
        return n.outputs[2]

    def mixs(self, fac, a, b):
        n = self.nt.nodes.new("ShaderNodeMixShader")
        self.set(n.inputs[0], fac)
        self.nt.links.new(a, n.inputs[1])
        self.nt.links.new(b, n.inputs[2])
        return n.outputs[0]

    def attr(self, name, kind='OBJECT'):
        n = self.nt.nodes.new("ShaderNodeAttribute")
        n.attribute_type = kind
        n.attribute_name = name
        return n

    def out(self, shader):
        o = self.nt.nodes.new("ShaderNodeOutputMaterial")
        self.nt.links.new(shader, o.inputs[0])


def window_cells(T, default_w=1.5, default_h=4.0):
    """Returns (cell_id_vector, frac_u, frac_v) from UV metres and object attrs cell_w/cell_h."""
    uv = T.node("ShaderNodeUVMap")
    sep = T.node("ShaderNodeSeparateXYZ", Vector=uv.outputs[0])
    cw = T.attr("cell_w").outputs["Fac"]
    ch = T.attr("cell_h").outputs["Fac"]
    cw = T.math('MAXIMUM', cw, 0.0)
    ch = T.math('MAXIMUM', ch, 0.0)
    # fall back to defaults when the attribute is missing (0)
    cw = T.math('ADD', cw, T.math('MULTIPLY', T.math('LESS_THAN', cw, 0.01), default_w))
    ch = T.math('ADD', ch, T.math('MULTIPLY', T.math('LESS_THAN', ch, 0.01), default_h))
    du = T.math('DIVIDE', sep.outputs[0], cw)
    dv = T.math('DIVIDE', sep.outputs[1], ch)
    cu, cv = T.math('FLOOR', du), T.math('FLOOR', dv)
    fu, fv = T.math('FRACT', du), T.math('FRACT', dv)
    oi = T.node("ShaderNodeObjectInfo")
    cid = T.node("ShaderNodeCombineXYZ", X=cu, Y=cv, Z=T.math('MULTIPLY', oi.outputs["Random"], 97.0))
    return cid.outputs[0], fu, fv


def glass_material(name, tint=(0.45, 0.5, 0.52), refl=0.3, rough=0.012, lit_frac=0.04, blinds=0.10,
                   spandrel=0.0, spandrel_col=(0.02, 0.025, 0.03), wobble=0.006, interior_gain=1.0):
    """Window glass that is opaque (no transmission rays): Fresnel reflection over a
    per-window interior. UV = metres along the facade / height."""
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    cid, fu, fv = window_cells(T)
    wn = T.node("ShaderNodeTexWhiteNoise", _noise_dimensions='3D', Vector=cid)
    r1 = wn.outputs["Value"]
    wn2 = T.node("ShaderNodeTexWhiteNoise", _noise_dimensions='3D',
                 Vector=T.vmath('ADD', cid, (13.1, 7.7, 3.3)))
    rcol = wn2.outputs["Color"]
    lit = T.math('LESS_THAN', r1, lit_frac)
    bl = T.math('MULTIPLY', T.math('GREATER_THAN', r1, lit_frac),
                T.math('LESS_THAN', r1, lit_frac + blinds))
    dark = T.mixc(T.math('MULTIPLY', wn2.outputs["Value"], 1.0), (0.018, 0.019, 0.021, 1), (0.05, 0.05, 0.052, 1))
    blind_col = T.mixc(wn2.outputs["Value"], (0.10, 0.095, 0.085, 1), (0.20, 0.19, 0.17, 1))
    # lit interiors: warm/cool office light, brighter near the ceiling of each cell
    lit_col = T.mixc(T.math('POWER', wn2.outputs["Value"], 2.0), (0.9, 0.85, 0.75, 1), (0.75, 0.82, 0.95, 1))
    interior = T.mixc(bl, dark, blind_col)
    interior = T.mixc(lit, interior, T.mixc(0.0, lit_col, lit_col))
    emis = T.math('MULTIPLY', lit, T.math('ADD', 0.05, T.math('MULTIPLY', fv, 0.18)))
    emis = T.math('MULTIPLY', emis, interior_gain)
    if spandrel > 0:
        is_sp = T.math('LESS_THAN', fv, spandrel)
        interior = T.mixc(is_sp, interior, (*spandrel_col, 1))
        emis = T.math('MULTIPLY', emis, T.math('SUBTRACT', 1.0, is_sp))
    inner = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": interior, "Roughness": 0.9,
                                                  "Emission Color": interior, "Emission Strength": emis})
    inner.inputs["Specular IOR Level"].default_value = 0.0
    # per-pane normal wobble (oil-canning) so reflections break up like real glazing
    geo = T.node("ShaderNodeNewGeometry")
    jit = T.vmath('SUBTRACT', rcol, (0.5, 0.5, 0.5))
    nrm = T.vmath('NORMALIZE', T.vmath('ADD', geo.outputs["Normal"], T.vmath('SCALE', jit, scale=wobble)))
    gl = T.node("ShaderNodeBsdfGlossy", Color=(*tint, 1), Roughness=rough, Normal=nrm)
    fr = T.node("ShaderNodeFresnel", IOR=1.52, Normal=nrm)
    fac = T.math('ADD', refl, T.math('MULTIPLY', fr.outputs[0], 1.0 - refl), clamp=True)
    T.out(T.mixs(fac, inner.outputs[0], gl.outputs[0]))
    return mat


def storefront_glass(name):
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    tr = T.node("ShaderNodeBsdfTransparent", Color=(0.92, 0.95, 0.94, 1))
    gl = T.node("ShaderNodeBsdfGlossy", Color=(1, 1, 1, 1), Roughness=0.02)
    fr = T.node("ShaderNodeFresnel", IOR=1.52)
    fac = T.math('ADD', 0.06, T.math('MULTIPLY', fr.outputs[0], 0.94), clamp=True)
    T.out(T.mixs(fac, tr.outputs[0], gl.outputs[0]))
    return mat


def emission_image_material(name, path, strength=1.0, rough=0.6, diffuse=0.4):
    """Image shown both as a lit surface (diffuse) and with some emission (backlit signs, shops)."""
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    uv = T.node("ShaderNodeUVMap")
    tex = T.node("ShaderNodeTexImage", Vector=uv.outputs[0])
    tex.image = _img(path)
    tex.extension = 'EXTEND'
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": tex.outputs[0], "Roughness": rough,
                                              "Emission Color": tex.outputs[0], "Emission Strength": strength})
    T.out(b.outputs[0])
    return mat


def lamp_material(name, color, prop, base=0.03, gain=18.0):
    """Signal lamp: emission = gain * object[prop] (animatable custom property)."""
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    a = T.attr(prop).outputs["Fac"]
    strength = T.math('MULTIPLY', a, gain)
    col = T.mixc(T.math('MINIMUM', a, 1.0), (*[c * base for c in color], 1), (*color, 1))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": 0.15,
                                              "Emission Color": (*color, 1), "Emission Strength": strength})
    b.inputs["Coat Weight"].default_value = 1.0
    T.out(b.outputs[0])
    return mat


def objcolor_material(name, rough=0.6, metal=0.0, coat=0.0, noise=0.15):
    """Base colour from the object colour (per-instance variation)."""
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    oi = T.node("ShaderNodeObjectInfo")
    tc = T.node("ShaderNodeTexCoord")
    nz = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=8.0, Detail=5.0)
    col = T.mixc(noise, oi.outputs["Color"], T.mixc(0.5, oi.outputs["Color"], nz.outputs["Color"], 'MULTIPLY'))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": rough, "Metallic": metal,
                                              "Coat Weight": coat})
    T.out(b.outputs[0])
    return mat


def far_facade_material(name):
    """Distant buildings: wall colour from object colour, window grid from attrs, glossy panes."""
    mat = bpy.data.materials.new(name)
    T = NT(mat)
    cid, fu, fv = window_cells(T, 1.8, 3.8)
    winw = T.attr("win_frac_u").outputs["Fac"]
    winh = T.attr("win_frac_v").outputs["Fac"]
    inu = T.math('MULTIPLY', T.math('GREATER_THAN', fu, T.math('MULTIPLY', T.math('SUBTRACT', 1.0, winw), 0.5)),
                 T.math('LESS_THAN', fu, T.math('SUBTRACT', 1.0, T.math('MULTIPLY', T.math('SUBTRACT', 1.0, winw), 0.5))))
    inv = T.math('MULTIPLY', T.math('GREATER_THAN', fv, 0.18),
                 T.math('LESS_THAN', fv, T.math('ADD', 0.18, winh)))
    win = T.math('MULTIPLY', inu, inv)
    oi = T.node("ShaderNodeObjectInfo")
    wn = T.node("ShaderNodeTexWhiteNoise", _noise_dimensions='3D', Vector=cid)
    tc = T.node("ShaderNodeTexCoord")
    grime = T.node("ShaderNodeTexNoise", Vector=tc.outputs["Object"], Scale=0.4, Detail=3.0)
    wall = T.mixc(0.35, oi.outputs["Color"], T.mixc(0.5, oi.outputs["Color"], grime.outputs["Color"], 'MULTIPLY'))
    pane = T.mixc(T.math('LESS_THAN', wn.outputs["Value"], 0.05), (0.012, 0.014, 0.017, 1), (0.35, 0.32, 0.28, 1))
    col = T.mixc(win, wall, pane)
    rough = T.math('ADD', T.math('MULTIPLY', win, -0.82), 0.85)
    emis = T.math('MULTIPLY', win, T.math('MULTIPLY', T.math('LESS_THAN', wn.outputs["Value"], 0.05), 0.08))
    b = T.node("ShaderNodeBsdfPrincipled", **{"Base Color": col, "Roughness": rough,
                                              "Emission Color": col, "Emission Strength": emis})
    b.inputs["Specular IOR Level"].default_value = 0.8
    T.out(b.outputs[0])
    return mat


def sidewalk_material():
    mat = pbr_texture_material("Sidewalk", "concrete_floor_02", scale=2.6, tint=(0.78, 0.78, 0.76),
                               rough_mul=1.0, bump=0.35)
    T = NT.__new__(NT)
    T.nt = mat.node_tree
    bsdf = [n for n in T.nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    base = bsdf.inputs["Base Color"].links[0].from_socket
    # desaturate the green-ish texture
    hsv = T.node("ShaderNodeHueSaturation", Saturation=0.35, Value=1.15, Color=base)
    uv = T.node("ShaderNodeUVMap")
    sep = T.node("ShaderNodeSeparateXYZ", Vector=uv.outputs[0])
    # 1.52 m sidewalk flags with tooled joints
    def joint(axis):
        f = T.math('FRACT', T.math('DIVIDE', axis, 1.52))
        d = T.math('MINIMUM', f, T.math('SUBTRACT', 1.0, f))
        return T.math('LESS_THAN', d, 0.006)
    j = T.math('MAXIMUM', joint(sep.outputs[0]), joint(sep.outputs[1]))
    col = T.mixc(T.math('MULTIPLY', j, 0.75), hsv.outputs[0], (0.08, 0.08, 0.08, 1))
    # chewing-gum spots
    vor = T.node("ShaderNodeTexVoronoi", Vector=T.vmath('SCALE', uv.outputs[0], scale=7.0))
    spots = T.math('LESS_THAN', vor.outputs["Distance"], 0.07)
    wn = T.node("ShaderNodeTexWhiteNoise", _noise_dimensions='3D', Vector=vor.outputs["Position"])
    spots = T.math('MULTIPLY', spots, T.math('LESS_THAN', wn.outputs["Value"], 0.35))
    col = T.mixc(T.math('MULTIPLY', spots, 0.8), col, (0.12, 0.115, 0.11, 1))
    # large-scale staining
    col = noise_mix(T.nt, col, uv.outputs[0], 0.15, (0.45, 0.43, 0.40), 0.35, lo=0.45, hi=0.75, blend='MULTIPLY')
    T.nt.links.new(col, bsdf.inputs["Base Color"])
    return mat


def stone_material(name, tint, block=(1.2, 0.6), grime=0.5):
    """Limestone ashlar: smooth stone texture + block joints + soot/grime streaks."""
    mat = pbr_texture_material(name, "rough_concrete", scale=2.5, tint=tint, bump=0.25)
    T = NT.__new__(NT)
    T.nt = mat.node_tree
    bsdf = [n for n in T.nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    base = bsdf.inputs["Base Color"].links[0].from_socket
    uv = T.node("ShaderNodeUVMap")
    sep = T.node("ShaderNodeSeparateXYZ", Vector=uv.outputs[0])
    row = T.math('FLOOR', T.math('DIVIDE', sep.outputs[1], block[1]))
    off = T.math('MULTIPLY', T.math('MODULO', row, 2.0), 0.5 * block[0])
    fu = T.math('FRACT', T.math('DIVIDE', T.math('ADD', sep.outputs[0], off), block[0]))
    fv = T.math('FRACT', T.math('DIVIDE', sep.outputs[1], block[1]))
    du = T.math('MINIMUM', fu, T.math('SUBTRACT', 1.0, fu))
    dv = T.math('MINIMUM', fv, T.math('SUBTRACT', 1.0, fv))
    j = T.math('MAXIMUM', T.math('LESS_THAN', T.math('MULTIPLY', du, block[0]), 0.006),
               T.math('LESS_THAN', T.math('MULTIPLY', dv, block[1]), 0.006))
    col = T.mixc(T.math('MULTIPLY', j, 0.45), base, (0.2, 0.18, 0.16, 1))
    # vertical soot streaks
    tc = T.node("ShaderNodeTexCoord")
    mp = T.node("ShaderNodeMapping", Vector=uv.outputs[0])
    mp.inputs["Scale"].default_value = (1.3, 0.04, 1.0)
    nz = T.node("ShaderNodeTexNoise", Vector=mp.outputs[0], Scale=3.0, Detail=6.0)
    streak = T.math('MULTIPLY', T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.45, "From Max": 0.75}).outputs[0], grime)
    col = T.mixc(streak, col, T.mixc(0.5, col, (0.25, 0.23, 0.21, 1), 'MULTIPLY'))
    bump_node = T.node("ShaderNodeBump", Strength=0.35, Distance=0.004, Height=j)
    nmap = bsdf.inputs["Normal"].links[0].from_socket
    T.nt.links.new(nmap, bump_node.inputs["Normal"])
    T.nt.links.new(bump_node.outputs[0], bsdf.inputs["Normal"])
    T.nt.links.new(col, bsdf.inputs["Base Color"])
    return mat


def make_materials():
    M = {}
    def asphalt_extra(nt, base, uv):
        c = noise_mix(nt, base, uv.outputs[0], 0.06, (0.55, 0.55, 0.55), 0.55, lo=0.52, hi=0.62, blend='MIX')
        return noise_mix(nt, c, uv.outputs[0], 1.5, (0.6, 0.6, 0.62), 0.5, lo=0.4, hi=0.8, blend='MULTIPLY')
    M["asphalt"] = pbr_texture_material("Asphalt", "asphalt_02", scale=3.0, tint=(0.85, 0.85, 0.87), bump=0.6,
                                        extra=asphalt_extra)
    M["sidewalk"] = sidewalk_material()
    M["curb"] = pbr_texture_material("Curb", "rough_concrete", scale=1.5, tint=(0.62, 0.63, 0.64), bump=0.4)
    M["plaza"] = pbr_texture_material("PlazaGranite", "granite_tile", scale=2.4, tint=(1.15, 1.12, 1.1),
                                      rough_mul=0.8, bump=0.3)
    for nm, col in (("paint_white", (0.78, 0.78, 0.75)), ("paint_yellow", (0.78, 0.56, 0.06)),
                    ("paint_green", (0.10, 0.36, 0.17)), ("paint_red", (0.42, 0.09, 0.07))):
        m = pbr_texture_material(nm, "asphalt_02", scale=3.0, tint=(1, 1, 1), bump=0.35, rough_mul=0.9)
        T = NT.__new__(NT)
        T.nt = m.node_tree
        bsdf = [n for n in T.nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
        tex = bsdf.inputs["Base Color"].links[0].from_socket
        uv = [n for n in T.nt.nodes if n.type == 'UVMAP'][0]
        nz = T.node("ShaderNodeTexNoise", Vector=uv.outputs[0], Scale=2.2, Detail=8.0)
        worn = T.node("ShaderNodeMapRange", Value=nz.outputs["Fac"], **{"From Min": 0.38, "From Max": 0.62}).outputs[0]
        col = T.mixc(T.math('MULTIPLY', worn, 0.85), T.mixc(0.25, (*col, 1), tex, 'MULTIPLY'), (*col, 1))
        T.nt.links.new(col, bsdf.inputs["Base Color"])
        M[nm] = m
    M["limestone"] = stone_material("Limestone", (1.05, 0.95, 0.80))
    M["limestone_dark"] = stone_material("LimestoneDark", (0.72, 0.66, 0.58), grime=0.7)
    M["brick_red"] = pbr_texture_material("BrickRed", "red_bricks_04", scale=1.6, tint=(0.85, 0.8, 0.78), bump=0.5)
    M["brick_brown"] = pbr_texture_material("BrickBrown", "brick_wall_02", scale=2.0, tint=(0.72, 0.62, 0.55), bump=0.5)
    M["granite"] = pbr_texture_material("Granite", "granite_tile", scale=1.8, tint=(0.9, 0.9, 0.92), rough_mul=0.45,
                                        bump=0.2, spec=0.7)
    M["dark_panel"] = pbr_texture_material("DarkPanel", "concrete_tile_facade", scale=2.2, tint=(1.1, 1.1, 1.1),
                                           rough_mul=0.7, bump=0.3)
    M["concrete"] = pbr_texture_material("Concrete", "rough_concrete", scale=2.5, tint=(0.7, 0.7, 0.7), bump=0.3)
    M["debris"] = pbr_texture_material("DebrisConcrete", "concrete_debris", scale=0.8, tint=(0.8, 0.8, 0.8), bump=0.6)
    M["charred"] = pbr_texture_material("Charred", "concrete_debris", scale=1.5, tint=(0.07, 0.06, 0.055), bump=0.8)
    M["metal_dark"] = simple_material("MetalDark", (0.035, 0.032, 0.03), 0.38, 0.85)
    M["metal_bronze"] = simple_material("MetalBronze", (0.10, 0.075, 0.05), 0.35, 0.9)
    M["metal_alu"] = simple_material("MetalAlu", (0.55, 0.56, 0.58), 0.3, 1.0)
    M["metal_galv"] = simple_material("MetalGalv", (0.42, 0.43, 0.42), 0.45, 0.85)
    M["metal_black"] = simple_material("MetalBlack", (0.012, 0.012, 0.013), 0.45, 0.4, coat=0.3)
    M["rubber"] = simple_material("Rubber", (0.02, 0.02, 0.02), 0.75)
    M["roof"] = pbr_texture_material("Roof", "concrete_floor_02", scale=4.0, tint=(0.38, 0.38, 0.38), bump=0.3)
    M["wood_tank"] = simple_material("WoodTank", (0.20, 0.13, 0.08), 0.85)
    M["glass_tower"] = glass_material("GlassTower", tint=(0.52, 0.62, 0.66), refl=0.52, spandrel=0.24,
                                      spandrel_col=(0.03, 0.035, 0.04), lit_frac=0.03, blinds=0.06)
    M["glass_tower2"] = glass_material("GlassTower2", tint=(0.58, 0.58, 0.56), refl=0.45, spandrel=0.28,
                                       spandrel_col=(0.05, 0.05, 0.05), lit_frac=0.03, blinds=0.06)
    M["glass_window"] = glass_material("GlassWindow", tint=(0.66, 0.68, 0.70), refl=0.30, lit_frac=0.05,
                                       blinds=0.18, wobble=0.012, interior_gain=1.0)
    M["storefront"] = storefront_glass("StorefrontGlass")
    M["far"] = far_facade_material("FarFacade")
    M["objcolor"] = objcolor_material("ObjColor")
    M["objcolor_gloss"] = objcolor_material("ObjColorGloss", rough=0.3, coat=0.5, noise=0.05)
    M["awning"] = objcolor_material("Awning", rough=0.85, noise=0.3)
    M["black_plastic"] = simple_material("BlackPlastic", (0.012, 0.012, 0.012), 0.4)
    M["signal_body"] = simple_material("SignalBody", (0.45, 0.35, 0.02), 0.5, 0.2)
    M["sig_red"] = lamp_material("SigRed", (1.0, 0.06, 0.02), "lamp_r")
    M["sig_yel"] = lamp_material("SigYellow", (1.0, 0.55, 0.05), "lamp_y")
    M["sig_grn"] = lamp_material("SigGreen", (0.1, 1.0, 0.55), "lamp_g")
    M["ped_hand"] = lamp_material("PedHand", (1.0, 0.35, 0.05), "lamp_hand", gain=10.0)
    M["ped_walk"] = lamp_material("PedWalk", (0.9, 0.95, 1.0), "lamp_walk", gain=10.0)
    M["street_sign"] = simple_material("StreetSignGreen", (0.02, 0.18, 0.08), 0.35)
    M["sign_white"] = simple_material("SignWhite", (0.8, 0.8, 0.8), 0.4)
    M["hydrant"] = simple_material("HydrantRed", (0.45, 0.04, 0.03), 0.45, coat=0.4)
    M["subway_green"] = simple_material("SubwayGreen", (0.02, 0.12, 0.06), 0.4, 0.4)
    M["globe"] = simple_material("GlobeGreen", (0.1, 0.5, 0.2), 0.2, emission=(0.2, 0.9, 0.35), strength=1.5)
    M["dark"] = simple_material("DarkHole", (0.004, 0.004, 0.004), 0.9)
    M["shed_green"] = simple_material("ShedGreen", (0.07, 0.17, 0.09), 0.6, 0.3)
    M["plywood"] = simple_material("Plywood", (0.48, 0.38, 0.25), 0.8)
    return M


# ============================================================================ streets
Y_FAR = 1300.0
X_FAR = 320.0


def street_centers():
    k = int(Y_FAR // TL.BLOCK)
    return [i * TL.BLOCK for i in range(-k, k + 1)]


def arc(cx, cy, r, a0, a1, n=8):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def block_outline(x0, x1, y0, y1, r_corners):
    """Rectangle with rounded corners where flagged: r_corners = dict(sw, se, ne, nw) radii (0 = sharp)."""
    pts = []
    r = r_corners
    pts += arc(x0 + r["sw"], y0 + r["sw"], r["sw"], math.pi, 1.5 * math.pi) if r["sw"] else [(x0, y0)]
    pts += arc(x1 - r["se"], y0 + r["se"], r["se"], 1.5 * math.pi, 2 * math.pi) if r["se"] else [(x1, y0)]
    pts += arc(x1 - r["ne"], y1 - r["ne"], r["ne"], 0, 0.5 * math.pi) if r["ne"] else [(x1, y1)]
    pts += arc(x0 + r["nw"], y1 - r["nw"], r["nw"], 0.5 * math.pi, math.pi) if r["nw"] else [(x0, y1)]
    return pts


def build_streets(coll, M):
    mb = MB()
    # asphalt base
    mb.poly([(-X_FAR, -Y_FAR, 0), (X_FAR, -Y_FAR, 0), (X_FAR, Y_FAR, 0), (-X_FAR, Y_FAR, 0)], "asphalt")
    h = TL.CURB_H
    cs = street_centers()
    for side in (-1, 1):
        for a, b in zip(cs[:-1], cs[1:]):
            y0, y1 = a + TL.ST_HALF, b - TL.ST_HALF
            if side > 0:
                x0, x1 = TL.AVE_HALF, X_FAR
                rc = dict(sw=3.0, nw=3.0, se=0, ne=0)
            else:
                x0, x1 = -X_FAR, -TL.AVE_HALF
                rc = dict(se=3.0, ne=3.0, sw=0, nw=0)
            pts = block_outline(x0, x1, y0, y1, rc)
            # sidewalk top (inset by the 0.15 m curb band)
            mb.poly([(p[0], p[1], h) for p in pts], "sidewalk",
                    uvs=[(p[0], p[1]) for p in pts])
            # curb faces
            n = len(pts)
            for i in range(n):
                p, q = pts[i], pts[(i + 1) % n]
                if abs(p[0]) >= X_FAR - 1e-6 and abs(q[0]) >= X_FAR - 1e-6:
                    continue
                L = math.hypot(q[0] - p[0], q[1] - p[1])
                mb.poly([(p[0], p[1], 0), (q[0], q[1], 0), (q[0], q[1], h), (p[0], p[1], h)], "curb",
                        uvs=[(0, 0), (L, 0), (L, h), (0, h)])
    mb.build("Streets", coll, M)

    # ------------------------------------------------------------------ markings
    mk = MB()
    z = 0.004

    def rect(x0, y0, x1, y1, mat):
        mk.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], mat,
                uvs=[(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    lim = 640.0
    for a, b in zip(cs[:-1], cs[1:]):
        if b < -lim or a > lim:
            continue
        ys, ye = a + TL.BLY + 0.5, b - TL.BLY - 0.5        # between crosswalks
        # bike lane (green) + buffer hatch + lane lines
        rect(-TL.AVE_HALF + 0.15, ys, -8.2, ye, "paint_green")
        rect(-8.2, ys, -8.05, ye, "paint_white")
        rect(-7.45, ys, -7.3, ye, "paint_white")
        yy = ys + 1.0
        while yy < ye - 2.0:
            mk.poly([(-8.05, yy, z), (-7.45, yy + 0.6, z), (-7.45, yy + 0.95, z), (-8.05, yy + 0.35, z)], "paint_white")
            yy += 3.0
        rect(-4.95, ys, -4.8, ye, "paint_white")                 # parking lane edge
        for lx in (-1.05, 2.8):                                   # dashed lane lines
            yy = ys + 2.0
            while yy < ye - 3.0:
                rect(lx - 0.075, yy, lx + 0.075, yy + 3.0, "paint_white")
                yy += 12.0
        rect(6.6, ys, 6.8, ye, "paint_white")                    # bus lane line
        rect(6.8, ys, TL.AVE_HALF - 0.15, ye, "paint_red")
        # stop line before the south crosswalk of the next intersection (northbound traffic)
        rect(-4.8, b - TL.BLY - 1.4, 6.6, b - TL.BLY - 0.8, "paint_white")
    for c in cs:
        if abs(c) > lim:
            continue
        # zebra crosswalks across the avenue (bars along Y)
        for yc in (c + TL.ST_HALF + 2.3, c - TL.ST_HALF - 2.3):
            xx = -TL.AVE_HALF + 0.6
            while xx < TL.AVE_HALF - 0.6:
                rect(xx, yc - 2.0, xx + 0.6, yc + 2.0, "paint_white")
                xx += 1.2
        # across the cross street (bars along X)
        for xc in (TL.AVE_HALF + 2.6, -TL.AVE_HALF - 2.6):
            yy = c - TL.ST_HALF + 0.5
            while yy < c + TL.ST_HALF - 0.5:
                rect(xc - 2.0, yy, xc + 2.0, yy + 0.6, "paint_white")
                yy += 1.2
        # cross-street stop line (westbound traffic stops east of the avenue)
        rect(TL.AVE_HALF + 5.2, c - TL.ST_HALF + 0.3, TL.AVE_HALF + 5.8, c + TL.ST_HALF - 0.3, "paint_white")
    mk.build("Markings", coll, M)

    # manholes / utility plates
    rng = random.Random(4)
    mh = MB()
    for i in range(70):
        if rng.random() < 0.6:
            x, y = rng.uniform(-9, 9), rng.uniform(-400, 400)
        else:
            c = rng.choice(cs[10:-10])
            x, y = rng.uniform(-60, 60), c + rng.uniform(-3.5, 3.5)
        r = rng.choice([0.38, 0.38, 0.45])
        pts = [(x + r * math.cos(a), y + r * math.sin(a), 0.006) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        mh.poly(pts, "metal_dark")
    mh.build("Manholes", coll, M)


# ============================================================================ buildings
STYLES = {
    "limestone": dict(kind="punched", wall="limestone", glass="glass_window", base="granite", fh=3.7, bay=2.2,
                      win_w=1.2, win_h=2.05, depth=0.28, cornice=True, sill=True),
    "limestone_dark": dict(kind="punched", wall="limestone_dark", glass="glass_window", base="granite", fh=3.6,
                           bay=2.0, win_w=1.15, win_h=2.0, depth=0.26, cornice=True, sill=True),
    "brick": dict(kind="punched", wall="brick_red", glass="glass_window", base="limestone_dark", fh=3.3, bay=2.0,
                  win_w=1.0, win_h=1.75, depth=0.2, cornice=True, sill=True),
    "brick_brown": dict(kind="punched", wall="brick_brown", glass="glass_window", base="limestone", fh=3.4, bay=2.1,
                        win_w=1.05, win_h=1.8, depth=0.2, cornice=True, sill=True),
    "curtain_blue": dict(kind="curtain", glass="glass_tower", mullion="metal_alu", base="granite", fh=4.0, bay=1.5,
                         fin=0.14),
    "curtain_dark": dict(kind="curtain", glass="glass_tower2", mullion="metal_dark", base="granite", fh=4.0, bay=1.5,
                         fin=0.12),
    "curtain_fins": dict(kind="curtain", glass="glass_tower", mullion="metal_bronze", base="granite", fh=4.0, bay=1.5,
                         fin=0.45),
    "ribbon": dict(kind="ribbon", wall="limestone", glass="glass_window", base="granite", fh=3.8, bay=1.5, sp_h=1.25),
    "ribbon_dark": dict(kind="ribbon", wall="dark_panel", glass="glass_tower2", base="granite", fh=3.9, bay=1.5,
                        sp_h=1.3),
    "grid": dict(kind="grid", wall="concrete", glass="glass_window", base="granite", fh=4.0, bay=3.0, depth=0.5),
}
FAR_COLORS = [(0.55, 0.50, 0.42), (0.45, 0.30, 0.22), (0.38, 0.25, 0.18), (0.62, 0.60, 0.56), (0.30, 0.33, 0.36),
              (0.20, 0.24, 0.27), (0.50, 0.46, 0.40), (0.68, 0.64, 0.58), (0.28, 0.20, 0.16), (0.35, 0.40, 0.44)]

SHOPS = ["DELI & GROCERY", "PHARMACY", "PIZZA", "BAGELS & COFFEE", "NAIL SPA", "OPTICAL", "NEWS & LOTTO",
         "HALAL GRILL", "DRY CLEANERS", "SUSHI BAR", "CAFE", "FLORIST", "WINE & LIQUORS", "DINER", "GIFTS",
         "BARBER SHOP", "THAI KITCHEN", "SHOE REPAIR", "WIRELESS", "BANK"]


class Facade:
    """Frame for one face of a building: origin o (x,y), unit direction d, outward normal n."""

    def __init__(self, p0, p1):
        self.o = np.array(p0, float)
        v = np.array(p1, float) - self.o
        self.L = float(np.linalg.norm(v))
        self.d = v / self.L
        self.n = np.array([self.d[1], -self.d[0]])

    def P(self, u, w, z):
        q = self.o + self.d * u + self.n * w
        return (float(q[0]), float(q[1]), float(z))

    def quad(self, mb, u0, u1, z0, z1, w, mat, uv=None, inward=False):
        pts = [self.P(u0, w, z0), self.P(u1, w, z0), self.P(u1, w, z1), self.P(u0, w, z1)]
        if uv is None:
            uv = [(u0, z0), (u1, z0), (u1, z1), (u0, z1)]
        if inward:
            pts, uv = pts[::-1], uv[::-1]
        mb.poly(pts, mat, uv)

    def box(self, mb, u0, u1, z0, z1, w0, w1, mat, skip=()):
        o3 = (self.o[0], self.o[1], 0.0)
        mb.obox(o3, (self.d[0], self.d[1], 0.0), (self.n[0], self.n[1], 0.0), u0, u1, z0, z1, w0, w1, mat, skip)


def storefronts(mb, F, z0, zf0, S, rng, M, detail, lobby=False):
    """Ground floor shop units along a facade."""
    L = F.L
    u = 0.0
    pil = 0.55
    F.box(mb, 0, pil, z0, zf0, -0.4, 0.05, S["base"])
    u = pil
    while u < L - 2.0:
        w = min(L - pil - u, rng.uniform(5.5, 9.5) if not lobby else rng.uniform(12, 20))
        if L - pil - (u + w) < 3.0:
            w = L - pil - u
        a, b = u, u + w
        gl_top = zf0 - (1.25 if not lobby else 0.6)
        # bulkhead, glass, frame, sign band, wall above
        F.box(mb, a, b, z0, z0 + 0.45, -0.38, -0.02, S["base"], skip=("back",))
        F.quad(mb, a, b, z0 + 0.45, gl_top, -0.35, "storefront")
        for uu in np.linspace(a, b, max(2, int(w / 2.6)) + 1):
            F.box(mb, uu - 0.035, uu + 0.035, z0 + 0.45, gl_top, -0.36, -0.28, "metal_dark", skip=("back",))
        F.box(mb, a, b, gl_top, gl_top + 0.07, -0.36, -0.28, "metal_dark", skip=("back",))
        if not lobby:
            sign = rng.choice(SHOPS)
            smat = M.get("sign:" + sign)
            F.box(mb, a + 0.1, b - 0.1, gl_top + 0.1, zf0 - 0.3, -0.38, 0.1, "metal_dark", skip=("back",))
            if smat is not None:
                F.quad(mb, a + 0.15, b - 0.15, gl_top + 0.13, zf0 - 0.33, 0.101, "sign:" + sign,
                       uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
            F.box(mb, a, b, zf0 - 0.3, zf0, -0.38, 0.0, S["base"], skip=("back",))
            if detail >= 2 and rng.random() < 0.35:
                k = rng.randrange(5)
                p0, p1 = F.P(a + 0.1, 0.0, gl_top + 0.05), F.P(b - 0.1, 0.0, gl_top + 0.05)
                q0, q1 = F.P(a + 0.1, 1.25, gl_top - 0.55), F.P(b - 0.1, 1.25, gl_top - 0.55)
                mb.poly([p0, p1, q1, q0][::-1], f"awning{k}")
                mb.poly([q0, q1, F.P(b - 0.1, 1.25, gl_top - 0.85), F.P(a + 0.1, 1.25, gl_top - 0.85)][::-1], f"awning{k}")
        else:
            F.box(mb, a, b, gl_top, zf0, -0.38, 0.0, S["base"], skip=("back",))
        # interior box behind the glass
        if detail >= 1:
            depth = rng.uniform(3.5, 6.0)
            wi = -0.35 - depth
            pool = ["intimg6", "intimg7"] if lobby else [f"intimg{i}" for i in range(6)]
            imat = rng.choice([k for k in pool if k in M] or ["dark"])
            F.quad(mb, a, b, z0 + 0.0, gl_top + 0.4, wi, imat, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
            fl = [F.P(a, -0.35, z0 + 0.02), F.P(b, -0.35, z0 + 0.02), F.P(b, wi, z0 + 0.02), F.P(a, wi, z0 + 0.02)]
            mb.poly(fl, "interior_floor")
            cl = [F.P(a, -0.35, gl_top + 0.4), F.P(a, wi, gl_top + 0.4), F.P(b, wi, gl_top + 0.4), F.P(b, -0.35, gl_top + 0.4)]
            mb.poly(cl, "interior_ceiling")
            mb.poly([F.P(a, -0.35, z0), F.P(a, -0.35, gl_top + 0.4), F.P(a, wi, gl_top + 0.4), F.P(a, wi, z0)], "interior_wall")
            mb.poly([F.P(b, wi, z0), F.P(b, wi, gl_top + 0.4), F.P(b, -0.35, gl_top + 0.4), F.P(b, -0.35, z0)], "interior_wall")
        F.box(mb, b, b + pil, z0, zf0, -0.4, 0.05, S["base"])
        u = b + pil


def upper_facade(mb, F, zf0, z1, S, rng, detail, top_cornice=True):
    L = F.L
    kind = S["kind"]
    nb = max(1, int(round(L / S["bay"])))
    bay = L / nb
    nf = max(1, int(round((z1 - zf0) / S["fh"])))
    fh = (z1 - zf0) / nf
    uvg = lambda u0, u1, za, zb: [(u0, za - zf0), (u1, za - zf0), (u1, zb - zf0), (u0, zb - zf0)]
    if kind == "punched":
        dep = S["depth"]
        ww = min(S["win_w"], bay - 0.45)
        wh = min(S["win_h"], fh - 0.8)
        sill = 0.85
        F.quad(mb, 0, L, zf0, z1, -dep, S["glass"], uv=uvg(0, L, zf0, z1))
        pw = bay - ww
        for i in range(nb + 1):
            uc = i * bay
            F.box(mb, max(0, uc - pw / 2), min(L, uc + pw / 2), zf0, z1, -dep, 0.0, S["wall"], skip=("back",))
        bands = [(zf0, zf0 + sill)]
        for j in range(nf):
            zt = zf0 + j * fh + sill + wh
            zb = zf0 + (j + 1) * fh + sill if j < nf - 1 else z1
            bands.append((zt, min(zb, z1)))
        for za, zb in bands:
            if zb > za:
                F.box(mb, 0, L, za, zb, -dep, 0.0, S["wall"], skip=("back",))
        if detail >= 2 and S.get("sill"):
            for j in range(nf):
                zs = zf0 + j * fh + sill
                for i in range(nb):
                    uc = (i + 0.5) * bay
                    F.box(mb, uc - ww / 2 - 0.06, uc + ww / 2 + 0.06, zs - 0.09, zs, -dep, 0.07, S["wall"], skip=("back",))
                    F.box(mb, uc - 0.03, uc + 0.03, zs, zs + wh, -dep, -dep + 0.05, "metal_dark", skip=("back",))
    elif kind == "curtain":
        F.quad(mb, 0, L, zf0, z1, 0.0, S["glass"], uv=uvg(0, L, zf0, z1))
        if detail >= 1:
            fin = S["fin"] if detail >= 2 else min(S["fin"], 0.12)
            for i in range(nb + 1):
                uc = i * bay
                F.box(mb, max(0, uc - 0.035), min(L, uc + 0.035), zf0, z1, 0.0, fin, S["mullion"], skip=("back",))
            for j in range(nf + 1):
                zc = zf0 + j * fh
                F.box(mb, 0, L, max(zf0, zc - 0.05), min(z1, zc + 0.05), 0.0, 0.05, S["mullion"], skip=("back",))
    elif kind == "ribbon":
        F.quad(mb, 0, L, zf0, z1, -0.22, S["glass"], uv=uvg(0, L, zf0, z1))
        for j in range(nf):
            za = zf0 + j * fh
            F.box(mb, 0, L, za, za + S["sp_h"], -0.22, 0.1, S["wall"], skip=("back",))
        F.box(mb, 0, L, z1 - 0.6, z1, -0.22, 0.1, S["wall"], skip=("back",))
        if detail >= 1:
            for i in range(nb + 1):
                uc = i * bay
                F.box(mb, max(0, uc - 0.03), min(L, uc + 0.03), zf0, z1, -0.22, -0.16, "metal_alu", skip=("back",))
    elif kind == "grid":
        dep = S["depth"]
        F.quad(mb, 0, L, zf0, z1, -dep, S["glass"], uv=uvg(0, L, zf0, z1))
        for i in range(nb + 1):
            uc = i * bay
            F.box(mb, max(0, uc - 0.25), min(L, uc + 0.25), zf0, z1, -dep, 0.0, S["wall"], skip=("back",))
        for j in range(nf + 1):
            zc = zf0 + j * fh
            F.box(mb, 0, L, max(zf0, zc - 0.35), min(z1, zc + 0.35), -dep, 0.0, S["wall"], skip=("back",))
    if top_cornice and S.get("cornice"):
        F.box(mb, -0.3, L + 0.3, z1 - 0.9, z1 - 0.35, 0.0, 0.35, S["wall"])
        F.box(mb, -0.6, L + 0.6, z1 - 0.35, z1, 0.0, 0.75, S["wall"])
    return bay, fh


def roof_and_parapet(mb, x0, x1, y0, y1, z, mat_wall, parapet=1.0):
    mb.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], "roof")
    t = 0.3
    for (a0, a1, b0, b1) in ((x0, x1, y0, y0 + t), (x0, x1, y1 - t, y1), (x0, x0 + t, y0, y1), (x1 - t, x1, y0, y1)):
        mb.box((a0, b0, z), (a1, b1, z + parapet), mat_wall)


def water_tower(mb, cx, cy, z, rng):
    r = rng.uniform(2.0, 3.0)
    h = rng.uniform(4.0, 5.5)
    legs = rng.uniform(2.5, 4.0)
    for a in np.linspace(0, 2 * math.pi, 6, endpoint=False):
        lx, ly = cx + 0.8 * r * math.cos(a), cy + 0.8 * r * math.sin(a)
        mb.box((lx - 0.12, ly - 0.12, z), (lx + 0.12, ly + 0.12, z + legs), "metal_dark")
    mb.box((cx - r, cy - r, z + legs - 0.25), (cx + r, cy + r, z + legs), "metal_dark")
    seg = 20
    zb, zt = z + legs, z + legs + h
    ring = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, seg, endpoint=False)]
    for i in range(seg):
        p, q = ring[i], ring[(i + 1) % seg]
        mb.poly([(p[0], p[1], zb), (q[0], q[1], zb), (q[0], q[1], zt), (p[0], p[1], zt)], "wood_tank")
        mb.poly([(p[0], p[1], zt), (q[0], q[1], zt), (cx, cy, zt + 0.55 * r)], "wood_tank")
        for hz in (0.25, 0.5, 0.75):
            zz = zb + hz * h
            mb.poly([(p[0] * 1.0, p[1], zz), (q[0], q[1], zz), (q[0], q[1], zz + 0.06), (p[0], p[1], zz + 0.06)], "metal_dark")


def building(coll, M, name, x0, x1, y0, y1, height, style, street, rng, detail=2, tiers=None, gf_h=None,
             shops=True, lobby_sides=(), water=False, props=None):
    """Rectangular building. street: set of sides with full facades ('S','E','N','W')."""
    S = STYLES[style]
    mb = MB()
    gf_h = gf_h or (rng.uniform(4.6, 5.6) if shops else 6.0)
    tiers = tiers or [(height, 0.0)]           # list of (top z, inset of street sides)
    z_base = TL.CURB_H
    zlo = z_base
    bay_fh = (S.get("bay", 2), S.get("fh", 4))
    for ti, (ztop, inset) in enumerate(tiers):
        ins = {s: (inset if s in street else 0.0) for s in "SENW"}
        X0, X1 = x0 + ins["W"], x1 - ins["E"]
        Y0, Y1 = y0 + ins["S"], y1 - ins["N"]
        sides = {"S": ((X0, Y0), (X1, Y0)), "E": ((X1, Y0), (X1, Y1)),
                 "N": ((X1, Y1), (X0, Y1)), "W": ((X0, Y1), (X0, Y0))}
        for s, (p0, p1) in sides.items():
            F = Facade(p0, p1)
            if s in street:
                zf0 = zlo
                if ti == 0:
                    zf0 = zlo + gf_h
                    if detail >= 1:
                        storefronts(mb, F, zlo, zf0, S, rng, M, detail, lobby=(s in lobby_sides or not shops))
                    else:
                        F.quad(mb, 0, F.L, zlo, zf0, 0.0, S["base"])
                    F.box(mb, -0.05, F.L + 0.05, zf0 - 0.35, zf0, 0.0, 0.12, S["base"])
                if detail >= 1:
                    bay_fh = upper_facade(mb, F, zf0, ztop, S, rng, detail,
                                          top_cornice=(ti == len(tiers) - 1 or tiers[ti + 1][1] > inset))
                else:
                    F.quad(mb, 0, F.L, zf0, ztop, 0.0, "far")
            else:
                wall = S.get("wall", "dark_panel")
                if wall.startswith("limestone") or S["kind"] == "curtain":
                    wall = "brick_brown" if S["kind"] == "punched" else "dark_panel"
                F.quad(mb, 0, F.L, zlo, ztop, 0.0, wall)
        roof_wall = S.get("wall", S.get("mullion", "concrete"))
        roof_and_parapet(mb, X0, X1, Y0, Y1, ztop, roof_wall if S["kind"] != "curtain" else S["mullion"],
                         parapet=1.0 if S["kind"] != "curtain" else 1.5)
        zlo = ztop
    # rooftop extras on the last tier
    if water:
        water_tower(mb, (X0 + X1) / 2 + rng.uniform(-3, 3), (Y0 + Y1) / 2 + rng.uniform(-3, 3), ztop, rng)
    if detail >= 1:
        bx = rng.uniform(0.25, 0.4) * (X1 - X0)
        by = rng.uniform(0.25, 0.4) * (Y1 - Y0)
        cx, cy = (X0 + X1) / 2 + rng.uniform(-2, 2), (Y0 + Y1) / 2 + rng.uniform(-2, 2)
        mb.box((cx - bx / 2, cy - by / 2, ztop), (cx + bx / 2, cy + by / 2, ztop + rng.uniform(3, 6)), "concrete")
    ob = mb.build(name, coll, M)
    ob["cell_w"] = float(bay_fh[0])
    ob["cell_h"] = float(bay_fh[1])
    if props:
        for k, v in props.items():
            ob[k] = v
    return ob


def far_building(coll, M, name, x0, x1, y0, y1, height, rng):
    mb = MB()
    mb.box((x0, y0, TL.CURB_H), (x1, y1, height), "far", skip=("-z",))
    if rng.random() < 0.5 and height > 60:
        sx, sy = (x1 - x0) * 0.2, (y1 - y0) * 0.2
        mb.box((x0 + sx, y0 + sy, height), (x1 - sx, y1 - sy, height + rng.uniform(15, 60)), "far", skip=("-z",))
    ob = mb.build(name, coll, M)
    col = rng.choice(FAR_COLORS)
    ob.color = (*[c ** 2.2 for c in col], 1)
    ob["cell_w"] = rng.choice([1.5, 1.8, 2.2, 3.0])
    ob["cell_h"] = rng.choice([3.4, 3.8, 4.0])
    glassy = rng.random() < 0.35
    ob["win_frac_u"] = 0.92 if glassy else rng.uniform(0.45, 0.7)
    ob["win_frac_v"] = 0.72 if glassy else rng.uniform(0.45, 0.6)
    return ob


def extra_materials(M):
    for i, s in enumerate(SHOPS):
        M["sign:" + s] = emission_image_material(f"Sign_{i:02d}", f"{GEN}/sign_{i:02d}.jpg", strength=0.35, rough=0.4)
    for i in range(8):
        M[f"intimg{i}"] = emission_image_material(f"Interior_{i}", f"{GEN}/interior_{i}.jpg", strength=0.35, rough=0.8)
    M["interior_floor"] = simple_material("InteriorFloor", (0.10, 0.09, 0.085), 0.3)
    M["interior_ceiling"] = simple_material("InteriorCeiling", (0.8, 0.8, 0.78), 0.8, emission=(1, 0.96, 0.88),
                                            strength=0.6)
    M["interior_wall"] = simple_material("InteriorWall", (0.45, 0.43, 0.40), 0.8)
    for k, col in enumerate([(0.03, 0.14, 0.06), (0.30, 0.03, 0.05), (0.03, 0.05, 0.16), (0.02, 0.02, 0.02),
                             (0.45, 0.08, 0.03)]):
        M[f"awning{k}"] = simple_material(f"Awning{k}", col, 0.85)
    for nm in ("st_w41", "st_6av", "st_oneway"):
        M[nm] = emission_image_material(nm, f"{GEN}/{nm}.jpg", strength=0.05, rough=0.35)
    M["ped_hand_img"] = emission_image_material("PedHandImg", f"{GEN}/ped_hand.png", strength=0.0)
    return M


# ============================================================================ layout
def build_buildings(coll, M):
    rng = random.Random(1234)
    out = {}
    bl, bly = TL.BLX, TL.BLY
    # ---------------- SW block (operator side)
    out["W1"] = building(coll, M, "W1_corner", -46, -bl, -33, -bly, 54.0, "limestone", {"E", "N", "S"}, rng,
                         detail=2, water=True)
    out["W2"] = building(coll, M, "W2_plaza_tower", -58, -27, -63, -33, 122.0, "curtain_dark", {"E", "S"}, rng,
                         detail=2, shops=False, lobby_sides=("E",))
    out["W3"] = building(coll, M, "W3_brick", -40, -bl, -70.5, -63, 22.0, "brick", {"E", "S", "N"}, rng,
                         detail=2, water=True)
    # ---------------- NW block
    out["W4"] = building(coll, M, "W4_prewar", -52, -bl, bly, 40, 128.0, "limestone_dark", {"E", "S"}, rng,
                         detail=2, tiers=[(62.0, 0.0), (100.0, 3.5), (128.0, 7.5)])
    out["W5"] = building(coll, M, "W5_glass", -50, -bl, 40, 70.5, 176.0, "curtain_blue", {"E", "N"}, rng,
                         detail=2, shops=False, lobby_sides=("E",))
    # ---------------- NE block (target tower is built separately)
    out["E2"] = building(coll, M, "E2_ribbon", bl, 48, 52, 70.5, 86.0, "ribbon", {"W", "N"}, rng, detail=2)
    # ---------------- SE block
    out["E3"] = building(coll, M, "E3_corner_brick", bl, 42, -30, -bly, 24.0, "brick", {"W", "N"}, rng,
                         detail=2, water=True)
    out["E5"] = building(coll, M, "E5_limestone", 42, 70, -30, -bly, 48.0, "limestone", {"N"}, rng, detail=2)
    out["E4"] = building(coll, M, "E4_fins", bl, 60, -70.5, -30, 152.0, "curtain_fins", {"W", "S", "N"}, rng,
                         detail=2, shops=False, lobby_sides=("W",))

    # ---------------- cross-street rows near the intersection
    def row(prefix, xa, xb, y0, y1, face, det, hlo, hhi):
        x = xa
        step = 1 if xb > xa else -1
        i = 0
        while (x < xb) if step > 0 else (x > xb):
            w = rng.uniform(9, 26)
            x2 = x + step * w
            lo, hi = sorted((x, x2))
            h = rng.choice([rng.uniform(hlo, hlo * 2), rng.uniform(hlo, hhi)])
            st = rng.choice(["brick", "brick_brown", "limestone", "limestone_dark", "ribbon", "grid", "curtain_dark"])
            if h < 40 and st.startswith("curtain"):
                st = "brick"
            out[f"{prefix}{i}"] = building(coll, M, f"{prefix}{i}", lo, hi, y0, y1, h, st, {face}, rng, detail=det,
                                           water=(h < 60 and rng.random() < 0.4))
            x = x2
            i += 1
    row("RowSW", -46, -190, -35, -bly, "N", 1, 18, 90)
    row("RowNW", -52, -190, bly, 36, "S", 1, 18, 110)
    row("RowNE", 62, 190, bly, 36, "S", 1, 20, 120)
    row("RowSE", 70, 190, -35, -bly, "N", 1, 18, 90)

    # ---------------- avenue street walls further north / south
    cs = street_centers()
    k = 0
    for a, b in zip(cs[:-1], cs[1:]):
        if a >= -1.0 and b <= 81.0 or (a >= -81.0 and b <= 1.0):
            continue          # the two hero blocks
        y0, y1 = a + bly, b - bly
        for side in (-1, 1):
            y = y0
            while y < y1 - 1:
                w = rng.uniform(14, 32)
                if y1 - (y + w) < 10:
                    w = y1 - y
                depth = rng.uniform(25, 45)
                xin, xout = side * bl, side * (bl + depth)
                x0, x1 = min(xin, xout), max(xin, xout)
                h = float(np.clip(rng.lognormvariate(math.log(70), 0.6), 18, 320))
                yc = (y + y + w) / 2
                face = "E" if side < 0 else "W"
                if abs(yc) < 260:
                    st = rng.choice(list(STYLES))
                    if h > 120 and STYLES[st]["kind"] == "punched":
                        st = rng.choice(["curtain_blue", "curtain_dark", "curtain_fins", "ribbon_dark"])
                    tiers = None
                    if h > 70 and STYLES[st]["kind"] == "punched" and rng.random() < 0.6:
                        tiers = [(h * 0.55, 0.0), (h * 0.8, 3.0), (h, 6.0)]
                    sides = {face}
                    if abs(y - y0) < 0.5:
                        sides.add("S")
                    if abs(y + w - y1) < 0.5:
                        sides.add("N")
                    building(coll, M, f"Ave{k}", x0, x1, y, y + w, h, st, sides, rng, detail=1, tiers=tiers,
                             water=(h < 70 and rng.random() < 0.35))
                else:
                    far_building(coll, M, f"AveFar{k}", x0, x1, y, y + w, h, rng)
                k += 1
                y += w
    # skyline behind the street walls (visible when looking up)
    for i in range(160):
        x = rng.choice([-1, 1]) * rng.uniform(60, 300)
        y = rng.uniform(-900, 900)
        if abs(y) < 120 and abs(x) < 200:
            continue
        w, d = rng.uniform(20, 45), rng.uniform(20, 45)
        h = float(np.clip(rng.lognormvariate(math.log(110), 0.5), 40, 380))
        far_building(coll, M, f"Sky{i}", x, x + w, y, y + d, h, rng)
    # far walls at the ends of the cross street
    for side in (-1, 1):
        for j, yy in enumerate(np.arange(-60, 60, 20)):
            far_building(coll, M, f"End{side}_{j}", side * 300 - 15, side * 300 + 15, yy, yy + 20,
                         rng.uniform(40, 160), rng)
    return out


# ============================================================================ sky & sun
def setup_world(scene, hdri=f"{TEX}/kloofendal_48d_partly_cloudy_puresky_4k.hdr", sun_strength=5.5,
                sky_strength=1.0):
    world = bpy.data.worlds.new("Sky")
    scene.world = world
    T = NT(world)
    img = bpy.data.images.load(hdri, check_existing=True)
    # locate the HDRI's sun (brightest pixel) to rotate the sky so it agrees with our sun lamp
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    lum = px.reshape(h, w, 4)[..., :3].sum(-1)
    yy, xx = np.unravel_index(np.argmax(lum), lum.shape)
    u = (xx + 0.5) / w                       # Blender equirect: u=0.5 -> -Y? (computed below)
    hdri_az_math = (u - 0.5) * 2 * math.pi   # angle in the XY plane, measured from +X counter-clockwise
    sx, sy, sz = TL.sun_dir()
    want = math.atan2(sy, sx)
    rot_z = math.pi - hdri_az_math - want
    tc = T.node("ShaderNodeTexCoord")
    mp = T.node("ShaderNodeMapping", Vector=tc.outputs["Generated"])
    mp.inputs["Rotation"].default_value = (0, 0, rot_z)
    env = T.node("ShaderNodeTexEnvironment", Vector=mp.outputs[0])
    env.image = img
    # clamp the HDRI sun (the sun lamp provides direct light)
    clamp = T.node("ShaderNodeMix")
    clamp.data_type = 'RGBA'
    clamp.blend_type = 'DARKEN'
    T.set(clamp.inputs["Factor"], 1.0)
    T.set(clamp.inputs[6], env.outputs[0])
    T.set(clamp.inputs[7], (6.0, 6.0, 6.0, 1.0))
    bg = T.node("ShaderNodeBackground", Color=clamp.outputs[2], Strength=sky_strength)
    o = T.nt.nodes.new("ShaderNodeOutputWorld")
    T.nt.links.new(bg.outputs[0], o.inputs[0])
    # sun lamp
    sun = bpy.data.lights.new("Sun", 'SUN')
    sun.energy = sun_strength
    sun.angle = math.radians(0.53)
    sun.color = (1.0, 0.96, 0.9)
    so = bpy.data.objects.new("Sun", sun)
    scene.collection.objects.link(so)
    d = Vector(TL.sun_dir())
    so.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    print("HDRI sun pixel", xx, yy, "rot_z", math.degrees(rot_z))
    return world, so
