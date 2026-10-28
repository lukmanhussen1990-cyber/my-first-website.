"""Build the full set around the character: garden clearing, bush spot, river, cliff+waterfall,
props, explainer studio scene, lights, render settings.

blender -b character.blend --python build_scene.py -- out_scene.blend
"""
import os
import sys
import math
import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import common as C  # noqa: E402
import env_nature as EN  # noqa: E402
import props as PR  # noqa: E402
import fx as FX  # noqa: E402

OUT = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
sc.name = 'Garden'
env = C.get_coll('Env')
prp = C.get_coll('Props')
fxc = C.get_coll('FX')

# ------------------------------------------------------------------ layout constants
BUSH = (-6.0, -1.0)          # scene 1 hiding bush
HOLE = (0.0, 0.0)            # toilet site
SLAB = (-0.95, 0.55)         # stone table with the clay bowl
RIVER_Y = 11.0
CLIFF_Y = 36.0

# ------------------------------------------------------------------ nature
EN.sky(sc)
g = EN.ground(env)
EN.paint_dirt(g, [(HOLE[0], HOLE[1], 1.1, 1.0), (0.6, 0.4, 0.6, 1.0), (SLAB[0], SLAB[1], 0.5, 0.6),
                  (BUSH[0] + 0.6, BUSH[1] + 0.3, 0.9, 0.8), (2.2, -1.0, 0.7, 0.7), (-2.5, -0.8, 0.5, 0.6),
                  (6.0, 7.5, 1.4, 0.9), (6.0, 9.5, 1.0, 0.8)])
rock = EN.mat_rock('rock')
rock_far = EN.mat_rock('rock_cliff', base=(0.62, 0.62, 0.60), spot=(0.46, 0.46, 0.45), scale=1.2)
leaves = EN.mat_leaves('leaves')
bushmat = EN.mat_leaves('bushleaves', c1=(0.22, 0.48, 0.15), c2=(0.34, 0.60, 0.20), scale=24.0)
bark = EN.mat_bark()
fmat = EN.mat_flower()

boulders = [((2.6, 3.4), 1.05), ((-3.4, 4.2), 1.35), ((4.8, 1.2), 0.75), ((-2.2, 2.6), 0.55),
            ((1.2, 5.6), 0.9), ((-5.5, 1.8), 0.85), ((BUSH[0] - 1.6, BUSH[1] + 2.4), 1.2),
            ((BUSH[0] + 2.1, BUSH[1] + 3.2), 0.8), ((7.8, 4.5), 1.1), ((3.4, 8.3), 0.7), ((9.0, 9.0), 0.9),
            ((-8.5, 6.5), 1.4), ((-12, 3), 1.6), ((12, 2), 1.2), ((-1.0, 8.5), 0.6)]
for i, (p, r) in enumerate(boulders):
    EN.boulder(env, p, r, seed=i + 1, mat=rock)
# slab table on a round boulder
EN.boulder(env, SLAB, 0.36, seed=40, squash=0.9, mat=rock)
slab = PR.stone_slab('Slab', 0.42, 0.06, coll=env, mat=rock, seed=2)
slab.location = (SLAB[0], SLAB[1], EN.ground_height(*SLAB) + 0.52)
EN.boulder(env, (BUSH[0] + 1.4, BUSH[1] - 0.2), 0.3, seed=41, squash=0.9, mat=rock)

trees = [((-2.6, 5.4), 4.6), ((3.9, 6.2), 5.2), ((-6.8, 7.5), 5.0), ((7.5, 8.0), 4.8), ((-11, 9), 5.5),
         ((12.0, 6.0), 5.0), ((BUSH[0] - 2.8, BUSH[1] + 4.8), 4.6), ((0.8, 14.5), 5.5), ((-4.5, 15), 5.2),
         ((9.5, 15.5), 5.0), ((15, 12), 5.5), ((-15, 13), 5.0)]
for i, (p, h) in enumerate(trees):
    EN.tree(env, p, h, seed=i + 1, bark=bark, leaves=leaves)
bushes = [((1.9, 2.4), 0.55), ((-2.9, 1.6), 0.45), ((5.2, 3.6), 0.6), ((-4.6, 3.0), 0.5), ((2.8, -2.6), 0.4),
          ((-7.8, 1.5), 0.55), ((8.0, 2.0), 0.6)]
for i, (p, r) in enumerate(bushes):
    EN.flower_bush(env, p, r, seed=i + 1, leaves=bushmat, fmat=fmat, n_flowers=int(60 * r / 0.5))
hide_bush, hide_flowers = EN.flower_bush(env, BUSH, 0.62, seed=99, leaves=bushmat, fmat=fmat, n_flowers=95)
hide_bush.name = 'HideBush'; hide_flowers.name = 'HideFlowers'
EN.hills(env)

# grass clumps (dense near the action, sparse further)
avoid = [(HOLE[0], HOLE[1], 0.75), (0.62, 0.38, 0.45), (SLAB[0], SLAB[1], 0.45), (6.0, 8.5, 1.6)]
regions = [(0, 0, 4.5, 650), (0, 3, 7, 600), (BUSH[0], BUSH[1], 3.0, 380), (6.0, 7.0, 4.0, 350),
           (0, 9, 10, 500), (-8, 4, 5, 250), (8, 4, 5, 250)]
EN.grass_field(env, regions, avoid=avoid)

# ------------------------------------------------------------------ river + cliff + waterfall
stone_small = EN.mat_rock('riverstone', base=(0.60, 0.60, 0.58), spot=(0.40, 0.40, 0.39), scale=14)
riv, riv_mat = PR.river(env, y0=RIVER_Y, stone_mat=stone_small)
cw = PR.cliff_and_waterfall(env, rock_far, y0=CLIFF_Y, top=19.0, fall_x=1.5)
for k in ('cliff', 'plateau', 'waterfall', 'pool'):
    cw[k].name = cw[k].name  # keep names
reveal = C.get_coll('Reveal', env)
for ob in [cw['cliff'], cw['plateau'], cw['waterfall'], cw['pool']] + cw['mist']:
    for cl in ob.users_collection:
        cl.objects.unlink(ob)
    reveal.objects.link(ob)

# ------------------------------------------------------------------ props
clay = PR.mat_clay()
wood = PR.mat_wood()
dark_wood = PR.mat_wood('wood_dark', c1=(0.50, 0.33, 0.19), c2=(0.36, 0.22, 0.12))
dirt = PR.mat_dirt()
rope = PR.mat_rope()
water = PR.mat_water('bowlwater', (0.42, 0.68, 0.90), 1.0)
stone_tool = EN.mat_rock('toolstone', base=(0.55, 0.55, 0.53), spot=(0.35, 0.35, 0.34), scale=20)
paint = C.new_mat('signpaint', (0.95, 0.92, 0.85), 0.6)

bowl, bowl_w = PR.bowl('Bowl', 0.19, 0.12, coll=prp, mat=clay, water=water)
bowl.location = (SLAB[0], SLAB[1], slab.location.z + 0.075)
pot_l = PR.pot('PotL', coll=prp, mat=clay)
pot_r = PR.pot('PotR', coll=prp, mat=clay)
yoke = PR.cylinder('Yoke', 0.022, 1.25, coll=prp, mat=wood, segs=12, rot=(0, math.radians(90), 0))
shovel = PR.shovel(prp, wood, stone_tool, rope)
hammer_rock = EN.displaced_sphere('HammerRock', 0.045, scale=(1.2, 0.9, 0.8), subdiv=2, amp=0.15, seed=9,
                                  mat=stone_tool, coll=prp)
leafmat = PR.mat_leaf()
for i in range(8):
    PR.leaf(f'Leaf{i}', length=0.34 + 0.05 * (i % 3), width=0.17 + 0.02 * (i % 2), coll=prp, mat=leafmat)
rim, hole_dark, pile = PR.hole_and_pile(prp, dirt, *HOLE)
seat_root, planks = PR.plank_seat(prp, wood, dark_wood)
seat_root.location = (HOLE[0], HOLE[1], EN.ground_height(*HOLE))
tank = PR.tank_assembly(prp, wood, dark_wood, rope, paint, base=(HOLE[0], HOLE[1], 0.0))
bamboo = PR.mat_bamboo()
bamboo_node = PR.mat_wood('bamboo_node', c1=(0.55, 0.55, 0.25), c2=(0.45, 0.45, 0.20))
# bamboo pipe from the waterfall (cliff) to the tank top
P0 = Vector((1.5, CLIFF_Y - 1.0, 7.5))
P1 = Vector((HOLE[0] + 0.05, HOLE[1] + 0.45, 2.42))
n_seg = 14
pipe_segments = []
for k in range(n_seg):
    a = P0.lerp(P1, k / n_seg)
    b = P0.lerp(P1, (k + 1) / n_seg)
    sag = Vector((0, 0, -0.35 * math.sin(math.pi * (k + 0.5) / n_seg)))
    seg = PR.bamboo_segment(f'Pipe{k:02d}', (b - a).length + 0.06, 0.07, bamboo, bamboo_node, prp)
    seg.location = a + sag
    d = (b - a).normalized()
    seg.rotation_mode = 'QUATERNION'
    seg.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    pipe_segments.append(seg)
    # supports every few segments
    if k % 3 == 1 and k < n_seg - 1:
        top = a + sag
        z0 = EN.ground_height(top.x, top.y)
        sp = PR.cylinder(f'PipeSupport{k}', 0.03, max(0.3, top.z - z0), loc=(top.x, top.y, z0), coll=prp,
                         mat=dark_wood, segs=10)
        sp.parent = seg
        sp.matrix_parent_inverse = seg.matrix_world.inverted()

# poop: one in the dug hole, one beside the hiding bush (scene 1)
pmat = PR.mat_poop()
pp = PR.poop('Poop', prp, pmat, size=1.25)
pp.location = (HOLE[0] + 0.02, HOLE[1] + 0.01, EN.ground_height(*HOLE) - 0.012)
pb = PR.poop('PoopBush', prp, pmat, size=1.0)
pb.location = (BUSH[0] - 0.62, BUSH[1] + 0.40, EN.ground_height(BUSH[0] - 0.62, BUSH[1] + 0.40) - 0.01)
pb.rotation_euler = (0, 0, 1.2)

# ------------------------------------------------------------------ effects objects (hidden by default)
FX.build_all(fxc)

# ------------------------------------------------------------------ neighbour arm
FX.neighbour_arm(prp)

# ------------------------------------------------------------------ lights
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(42), 0, math.radians(-38))
sun.data.energy = 3.6
sun.data.color = (1.0, 0.97, 0.92)
sun.data.angle = math.radians(4)
sun.data.use_contact_shadow = True
sun.data.contact_shadow_distance = 0.15
sun.data.shadow_cascade_max_distance = 25
sun.data.shadow_cascade_count = 3
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(65), 0, math.radians(150))
fill.data.energy = 0.6
fill.data.use_shadow = False
eyelight = bpy.data.objects.new('EyeLight', bpy.data.lights.new('EyeLight', 'POINT'))
sc.collection.objects.link(eyelight)
eyelight.data.energy = 0.0
eyelight.data.shadow_soft_size = 0.02
eyelight.data.use_shadow = False

# ------------------------------------------------------------------ cheap shadows: only nearby solid things cast
for m in bpy.data.materials:
    if m.name in ('grass_blade', 'hills', 'rock_cliff', 'plateau', 'waterfall', 'pool', 'river', 'mist', 'ground',
                  'stink', 'smoke', 'droplet', 'stream', 'confetti', 'tear', 'flywing'):
        m.shadow_method = 'NONE'

# ------------------------------------------------------------------ render settings
sc.render.engine = 'BLENDER_EEVEE'
ee = sc.eevee
ee.taa_render_samples = 8
ee.use_soft_shadows = True
ee.use_gtao = True
ee.gtao_distance = 0.25
ee.gtao_factor = 1.0
ee.shadow_cube_size = '1024'
ee.shadow_cascade_size = '2048'
ee.use_shadow_high_bitdepth = True
ee.bokeh_max_size = 60.0
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.fps = 30
sc.render.resolution_x = 1080
sc.render.resolution_y = 1920
sc.render.image_settings.file_format = 'PNG'
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'
cam.data.sensor_height = 36.0
cam.data.clip_start = 0.02
cam.data.clip_end = 600
cam.data.dof.use_dof = True

# ------------------------------------------------------------------ explainer studio (separate scene)
FX.build_studio()

bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print('saved scene', OUT)
