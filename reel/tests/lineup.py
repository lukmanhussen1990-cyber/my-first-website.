import bpy, sys, os, time, math
sys.path.insert(0, os.path.join(os.path.dirname(bpy.data.filepath) if bpy.data.filepath else "", "/home/user/my-first-website./reel/scripts"))
import mh
t0 = time.time()
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

specs = [
 ("You", dict(gender=1.0, age=25, weight=0.62, muscle=0.45, skin="young_caucasian_male.mhmat", hair="short02.mhclo",
              clothes=["male_casualsuit06.mhclo", "shoes02.mhclo"])),
 ("Mom", dict(gender=0.0, age=50, weight=0.65, muscle=0.4, skin="middleage_caucasian_female.mhmat", hair="bob02.mhclo",
              eyebrows="eyebrow009.mhclo", clothes=["female_casualsuit01.mhclo", "elvs_ladies_apron.mhclo", "shoes01.mhclo"])),
 ("Baby", dict(gender=1.0, age=1, weight=0.8, skin="young_caucasian_male.mhmat", hair="", eyebrows="eyebrow010.mhclo",
              clothes=["elvs_crude_bootyshorts.mhclo"])),
 ("Cop1", dict(gender=1.0, age=32, weight=0.6, muscle=0.7, height=0.65, race=("african",), skin="young_african_male.mhmat",
              hair="short04.mhclo", clothes=["elvs_male_shirt_tie_tucked1.mhclo", "elvs_male_trouser.mhclo", "mindfront_patrol_cap.mhclo", "shoes06.mhclo"])),
 ("Cop2", dict(gender=1.0, age=45, weight=0.75, muscle=0.6, height=0.55, race=("african",), skin="middleage_african_male.mhmat",
              hair="short02.mhclo", clothes=["elvs_male_shirt_tie_tucked1.mhclo", "elvs_male_trouser.mhclo", "mindfront_patrol_cap.mhclo", "shoes06.mhclo"])),
]
rigs = {}
for i, (n, s) in enumerate(specs):
    t = time.time()
    rig, body = mh.make_human(n, **s)
    rig.location.x = (i - 2) * 0.75
    rigs[n] = rig
    print("MADE", n, round(time.time() - t, 1), [o.name for o in mh.children(rig)])

try:
    mh.apply_bvh_pose(rigs["You"], "callharvey3d_standingnatural")
    mh.apply_bvh_pose(rigs["Mom"], "callharvey3d_standingnatural")
    mh.apply_bvh_pose(rigs["Cop1"], "callharvey3d_standingatattention")
    mh.apply_bvh_pose(rigs["Cop2"], "callharvey3d_standingnatural")
    mh.apply_bvh_pose(rigs["Baby"], "callharvey3d_sittingfloor2")
except Exception as e:
    print("POSE ERR", e)
try:
    mh.set_face(mh.body_of(rigs["Baby"]), mouthSmileLeft=1.0, mouthSmileRight=1.0, eyeBlinkLeft=1.0)
    mh.set_face(mh.body_of(rigs["Mom"]), jawOpen=0.6, eyeWideLeft=1, eyeWideRight=1, browInnerUp=1)
except Exception as e:
    print("FACE ERR", e)
for n in ("Cop1", "Cop2"):
    for o in mh.children(rigs[n]):
        if "shirt" in o.name.lower(): mh.tint(o, (0.05, 0.09, 0.22))
        if "trouser" in o.name.lower(): mh.tint(o, (0.03, 0.04, 0.08))
        if "cap" in o.name.lower(): mh.tint(o, (0.03, 0.05, 0.13), keep_detail=0.2)
for o in mh.children(rigs["Baby"]):
    if "short" in o.name.lower(): mh.tint(o, (0.95, 0.95, 0.95), keep_detail=0.15)

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.resolution_percentage = 50
sc.eevee.taa_render_samples = 16
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.75, 1, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(30))); bpy.context.object.data.energy = 4
bpy.ops.mesh.primitive_plane_add(size=20)
cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -5.2, 1.0); co.rotation_euler = (math.radians(88), 0, 0); cam.lens = 24
sc.render.filepath = sys.argv[-1]
t = time.time(); bpy.ops.render.render(write_still=True); print("RENDER", round(time.time() - t, 1), "TOTAL", round(time.time() - t0, 1))
bpy.ops.wm.save_as_mainfile(filepath="/tmp/claude-0/-home-user-my-first-website-/3c59c3fd-21fb-5fbc-8069-3de2349d9bdd/scratchpad/lineup.blend")
