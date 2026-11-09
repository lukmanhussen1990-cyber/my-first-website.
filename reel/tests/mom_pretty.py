import bpy, sys, os, math
sys.path.insert(0, "/home/user/my-first-website./reel/scripts")
import mh
S = "/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/mp"
os.makedirs(S, exist_ok=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
pretty = {"l-eye-scale-incr": 0.35, "r-eye-scale-incr": 0.35, "mouth-upperlip-volume-incr": 0.4,
          "mouth-lowerlip-volume-incr": 0.35, "nose-scale-horiz-decr": 0.3, "nose-scale-vert-decr": 0.15}
base = dict(gender=0.0, age=44, weight=0.55, muscle=0.4, height=0.45, proportions=0.9, subdiv=0,
            skin="toigo_light_skin_with_natural_makeup.mhmat", eyebrows="eyebrow010.mhclo", eyelashes="eyelashes03.mhclo",
            clothes=["female_casualsuit02.mhclo", "shoes01.mhclo"], targets=pretty)
A = mh.make_human("MomA", hair="sonntag78_blond_with_headband.mhclo", **base)[0]
B = mh.make_human("MomB", hair="elvs_island_princess_hair.mhclo", **base)[0]
A.location.x = -0.45; B.location.x = 0.45
for r in (A, B):
    mh.apply_bvh_pose(r, "callharvey3d_standingnatural")
for o in mh.children(A):
    if "sonntag" in o.name: mh.tint_hair_keep_accessory(o, (0.02, 0.017, 0.015))
for r in (A, B):
    mh.set_face(mh.body_of(r), mouthSmileLeft=0.5, mouthSmileRight=0.5)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"; sc.render.resolution_x, sc.render.resolution_y = 1080, 1080; sc.render.resolution_percentage = 50
sc.eevee.taa_render_samples = 8; sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.8, 0.9, 1)
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(20))); bpy.context.object.data.energy = 3.5
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
hz = (A.matrix_world @ A.pose.bones["head"].head).z
cam.location = (0, -1.55, hz + 0.02); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
sc.render.filepath = f"{S}/faces.png"; bpy.ops.render.render(write_still=True)
cam.location = (0.4, -1.3, hz - 0.05); cam.rotation_euler = (math.radians(90), 0, math.radians(35)); cam.data.lens = 50
sc.render.filepath = f"{S}/faces_side.png"; bpy.ops.render.render(write_still=True)
