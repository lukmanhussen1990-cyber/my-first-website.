"""Shared Blender helpers: numpy -> mesh, node building, small utilities."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix


def mesh_from_arrays(name, V, F, smooth=True, attrs=None, vec_attrs=None):
    """Create a mesh from verts (N,3) and faces (list or (M,k) array)."""
    V = np.asarray(V, dtype=np.float32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set('co', V.ravel())
    if isinstance(F, np.ndarray) and F.ndim == 2:
        k = F.shape[1]
        me.loops.add(F.size)
        me.loops.foreach_set('vertex_index', F.ravel().astype(np.int32))
        me.polygons.add(len(F))
        me.polygons.foreach_set('loop_start', np.arange(0, F.size, k, dtype=np.int32))
        me.polygons.foreach_set('loop_total', np.full(len(F), k, dtype=np.int32))
    else:
        loops = [i for f in F for i in f]
        me.loops.add(len(loops))
        me.loops.foreach_set('vertex_index', loops)
        me.polygons.add(len(F))
        lens = [len(f) for f in F]
        me.polygons.foreach_set('loop_start', np.concatenate([[0], np.cumsum(lens)[:-1]]).astype(np.int32))
        me.polygons.foreach_set('loop_total', lens)
    me.update()
    me.validate()
    if attrs:
        for an, av in attrs.items():
            a = me.attributes.new(an, 'FLOAT', 'POINT')
            a.data.foreach_set('value', np.asarray(av, dtype=np.float32))
    if vec_attrs:
        for an, av in vec_attrs.items():
            a = me.attributes.new(an, 'FLOAT_VECTOR', 'POINT')
            a.data.foreach_set('vector', np.asarray(av, dtype=np.float32).ravel())
    if smooth:
        me.shade_smooth()
    return me


def obj_from_mesh(me, name=None, coll=None):
    ob = bpy.data.objects.new(name or me.name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def get_coll(name, parent=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def verts_np(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def set_vertex_weights(ob, group, idx, w, levels=64):
    """Assign per-vertex weights quickly by quantising into levels."""
    vg = ob.vertex_groups.get(group) or ob.vertex_groups.new(name=group)
    idx = np.asarray(idx); w = np.asarray(w)
    m = w > 1e-3
    idx = idx[m]; w = w[m]
    q = np.clip(np.round(w * levels), 1, levels).astype(int)
    for lv in np.unique(q):
        sel = idx[q == lv]
        vg.add(sel.tolist(), float(lv) / levels, 'REPLACE')
    return vg


# ------------------------------------------------------------------ node helpers
class NB:
    """Tiny node-tree builder: n = NB(mat); x = n.node('ShaderNodeMath', operation='ADD')."""

    def __init__(self, mat_or_tree):
        self.t = mat_or_tree.node_tree if hasattr(mat_or_tree, 'node_tree') else mat_or_tree
        self.N = self.t.nodes
        self.L = self.t.links

    def node(self, typ, inputs=None, **props):
        n = self.N.new(typ)
        for k, v in props.items():
            setattr(n, k, v)
        if inputs:
            for k, v in inputs.items():
                self.set_in(n, k, v)
        return n

    def set_in(self, n, k, v):
        sock = n.inputs[k]
        if isinstance(v, bpy.types.NodeSocket):
            self.L.new(v, sock)
        else:
            sock.default_value = v

    def link(self, a, b):
        self.L.new(a, b)

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.N.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                self.L.new(v, n.inputs[i])
            else:
                n.inputs[i].default_value = v
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.N.new('ShaderNodeVectorMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                self.L.new(v, n.inputs[i])
            else:
                n.inputs[i].default_value = v
        if scale is not None:
            n.inputs['Scale'].default_value = scale
        out = n.outputs['Value'] if op in ('LENGTH', 'DOT_PRODUCT', 'DISTANCE') else n.outputs['Vector']
        return out

    def mix(self, fac, a, b, blend='MIX', dtype='RGBA'):
        n = self.N.new('ShaderNodeMix')
        n.data_type = dtype
        if dtype == 'RGBA':
            n.blend_type = blend
        self.set_in(n, 'Factor', fac)
        ia = 'A' if dtype != 'RGBA' else 6
        ib = 'B' if dtype != 'RGBA' else 7
        if dtype == 'RGBA':
            self.set_in(n, 6, a); self.set_in(n, 7, b)
            return n.outputs[2]
        if dtype == 'FLOAT':
            self.set_in(n, 2, a); self.set_in(n, 3, b)
            return n.outputs[0]
        self.set_in(n, 4, a); self.set_in(n, 5, b)
        return n.outputs[1]

    def smoothstep(self, x, e0, e1):
        n = self.N.new('ShaderNodeMapRange')
        n.interpolation_type = 'SMOOTHSTEP'
        n.inputs['From Min'].default_value = e0
        n.inputs['From Max'].default_value = e1
        self.set_in(n, 'Value', x)
        return n.outputs['Result']

    def maprange(self, x, a0, a1, b0, b1, clamp=True):
        n = self.N.new('ShaderNodeMapRange')
        n.clamp = clamp
        n.inputs['From Min'].default_value = a0
        n.inputs['From Max'].default_value = a1
        n.inputs['To Min'].default_value = b0
        n.inputs['To Max'].default_value = b1
        self.set_in(n, 'Value', x)
        return n.outputs['Result']

    def attr(self, name, kind='Vector'):
        n = self.N.new('ShaderNodeAttribute')
        n.attribute_name = name
        n.attribute_type = 'GEOMETRY'
        return n.outputs[kind]

    def sep(self, v):
        n = self.N.new('ShaderNodeSeparateXYZ')
        self.L.new(v, n.inputs[0])
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

    def comb(self, x, y, z):
        n = self.N.new('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            self.set_in(n, i, v)
        return n.outputs[0]

    def sphere_mask(self, p, center, radius, soft=0.5, scale=(1, 1, 1)):
        """1 at centre -> 0 at radius (per-axis scaled)."""
        d = self.vmath('SUBTRACT', p, tuple(center))
        d = self.vmath('MULTIPLY', d, tuple(1.0 / s for s in scale))
        L = self.vmath('LENGTH', d)
        return self.smoothstep(L, radius, radius * soft) if soft < 1 else None

    def rgb(self, col):
        n = self.N.new('ShaderNodeRGB')
        n.outputs[0].default_value = (*col[:3], 1.0)
        return n.outputs[0]

    def value(self, v):
        n = self.N.new('ShaderNodeValue')
        n.outputs[0].default_value = v
        return n.outputs[0]


def principled(mat):
    return mat.node_tree.nodes['Principled BSDF']


def new_mat(name, color=(0.8, 0.8, 0.8), rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs['Base Color'].default_value = (*color[:3], 1)
    b.inputs['Roughness'].default_value = rough
    return m


def look_at(ob, target, roll=0.0):
    d = Vector(target) - ob.location
    q = d.to_track_quat('-Z', 'Y')
    ob.rotation_mode = 'XYZ'
    ob.rotation_euler = q.to_euler()
    if roll:
        ob.rotation_euler.rotate_axis('Z', roll)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)
