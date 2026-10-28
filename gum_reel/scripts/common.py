"""Shared helpers: load caveman, pose him, render settings, camera."""
import math, json
import numpy as np
import bpy
from mathutils import Vector, Matrix, Euler, Quaternion

ASSETS = '/home/user/work/assets'
LM = {k: np.array(v) if isinstance(v, list) else v for k, v in json.load(open(f'{ASSETS}/landmarks.json')).items()}


def load_caveman(scene=None):
    scene = scene or bpy.context.scene
    with bpy.data.libraries.load(f'{ASSETS}/caveman.blend', link=False) as (src, dst):
        dst.collections = ['caveman']
    c = dst.collections[0]
    scene.collection.children.link(c)
    rig = bpy.data.objects['caveman_rig']
    return Rig(rig)


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


class Rig:
    """Pose in *armature-space* euler angles (degrees) relative to rest, applied as if the parent were at rest."""

    def __init__(self, ob):
        self.ob = ob
        self.B = {}
        self.Binv = {}
        for b in ob.data.bones:
            m = b.matrix_local.to_3x3()
            self.B[b.name] = m
            self.Binv[b.name] = m.inverted()
        self.lips = bpy.data.objects.get('lips')
        self.cheek_scale = 1.0

    def reset(self):
        for pb in self.ob.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        for c in ('forearm.L', 'forearm.R'):
            self.ob.pose.bones[c].constraints['IK'].influence = 0
        for c in ('hand.L', 'hand.R'):
            self.ob.pose.bones[c].constraints['IKrot'].influence = 0
        for c in ('shin.L', 'shin.R'):
            self.ob.pose.bones[c].constraints['IK'].influence = 1
        for c in ('foot.L', 'foot.R'):
            self.ob.pose.bones[c].constraints['IKrot'].influence = 1
        if self.lips and self.lips.data.shape_keys:
            for kb in self.lips.data.shape_keys.key_blocks[1:]:
                kb.value = 0

    def rot(self, bone, e, order='XYZ'):
        R = Euler([math.radians(a) for a in e], order).to_matrix()
        q = (self.Binv[bone] @ R @ self.B[bone]).to_quaternion()
        self.ob.pose.bones[bone].rotation_quaternion = q

    def rot_q(self, bone, Rm):
        q = (self.Binv[bone] @ Rm @ self.B[bone]).to_quaternion()
        self.ob.pose.bones[bone].rotation_quaternion = q

    def loc(self, bone, v):
        self.ob.pose.bones[bone].location = self.Binv[bone] @ Vector(v)

    def scale(self, bone, s):
        self.ob.pose.bones[bone].scale = (s, s, s) if np.isscalar(s) else s

    def ik(self, bone_ctrl, influence):
        """bone_ctrl: 'forearm.L' style chain owner. Also drives the matching rotation copy."""
        pb = self.ob.pose.bones[bone_ctrl]
        pb.constraints['IK'].influence = influence
        end = {'forearm.L': 'hand.L', 'forearm.R': 'hand.R', 'shin.L': 'foot.L', 'shin.R': 'foot.R'}[bone_ctrl]
        self.ob.pose.bones[end].constraints['IKrot'].influence = influence

    def target(self, ik_bone, pos, e=(0, 0, 0)):
        """Place an IK target bone at armature-space position pos with armature-space rotation e."""
        b = self.ob.data.bones[ik_bone]
        head = b.head_local
        self.loc(ik_bone, Vector(pos) - head)
        self.rot(ik_bone, e)

    def shape(self, name, v):
        if self.lips:
            self.lips.data.shape_keys.key_blocks[name].value = v

    def world(self, bone, point='head'):
        """world position of a bone head/tail (after depsgraph update)."""
        pb = self.ob.pose.bones[bone]
        m = self.ob.matrix_world @ pb.matrix
        if point == 'head':
            return m.translation.copy()
        return (self.ob.matrix_world @ (pb.matrix @ Vector((0, pb.length, 0)))).copy()

    def bone_matrix(self, bone):
        pb = self.ob.pose.bones[bone]
        return self.ob.matrix_world @ pb.matrix


def setup_render(scene, w=1080, h=1920, samples=8):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    ee = scene.eevee
    ee.taa_render_samples = samples
    try:
        ee.use_shadows = True
        ee.shadow_ray_count = 1
        ee.shadow_step_count = 4
        ee.shadow_resolution_scale = 0.75
    except Exception as e:
        print('eevee opt', e)
    scene.render.hair_type = 'STRIP'
    scene.render.hair_subdiv = 0
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.film_transparent = False


def sky_world(scene, zen=(0.33, 0.55, 0.90), hor=(0.78, 0.86, 0.95), strength=0.7):
    w = bpy.data.worlds.new('sky')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*hor, 1)
    ramp.color_ramp.elements[1].position = 0.35
    ramp.color_ramp.elements[1].color = (*zen, 1)
    gnd = ramp.color_ramp.elements.new(0.0)
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return w


def add_sun(scene, rot=(50, 10, -35), energy=2.6, color=(1.0, 0.96, 0.88), angle=3.0):
    s = bpy.data.lights.new('sun', 'SUN')
    s.energy = energy; s.color = color; s.angle = math.radians(angle)
    o = bpy.data.objects.new('sun', s)
    scene.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def make_camera(scene, name='cam'):
    cam = bpy.data.cameras.new(name)
    co = bpy.data.objects.new(name, cam)
    scene.collection.objects.link(co)
    scene.camera = co
    cam.sensor_fit = 'VERTICAL'
    cam.sensor_height = 24
    cam.clip_start = 0.01
    cam.clip_end = 400
    return co


def look_at(co, eye, target, roll=0.0):
    eye, target = Vector(eye), Vector(target)
    co.location = eye
    q = (target - eye).to_track_quat('-Z', 'Y')
    if roll:
        q = q @ Quaternion((0, 0, 1), math.radians(roll))
    co.rotation_euler = q.to_euler()
