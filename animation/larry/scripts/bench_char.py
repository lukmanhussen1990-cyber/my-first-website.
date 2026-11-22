# Benchmark Eevee settings on a realistic character shot. Usage: blender -b --python bench_char.py -- <char.blend> <variant> <outdir>
import bpy, sys, os, math, time, resource
sys.path.insert(0, os.path.dirname(__file__))
import mocap
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CHAR, VAR, OUTD = argv[0], argv[1], argv[2]
bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
with bpy.data.libraries.load(CHAR, link=False) as (src, dst):
    dst.objects = src.objects
for o in dst.objects:
    sc.collection.objects.link(o)
rig = next(o for o in dst.objects if o.type == "ARMATURE")
mocap.ensure_quaternion(rig)
act = mocap.retarget(rig, "/opt/cmu/amc/137.asf", "/opt/cmu/amc/137_28.amc", "idle", start=200, end=320, in_place=True)
rig.animation_data_create(); rig.animation_data.action = act

def simplify_skin(o):
    """Replace MPFB's heavy skin node tree with a lean Principled setup using the same diffuse texture."""
    for m in o.data.materials:
        if not m or not m.use_nodes: continue
        nt = m.node_tree
        tex = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image]
        diffuse = None
        for n in tex:
            nm = n.image.name.lower()
            if "normal" in nm or "nrm" in nm or "spec" in nm or "rough" in nm or "bump" in nm or "sss" in nm:
                continue
            diffuse = n.image; break
        if diffuse is None and tex: diffuse = tex[0].image
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        b.inputs["Roughness"].default_value = 0.55
        if VAR in ("lean_sss",):
            b.inputs["Subsurface Weight"].default_value = 0.15
            b.inputs["Subsurface Radius"].default_value = (0.9, 0.4, 0.25)
            b.inputs["Subsurface Scale"].default_value = 0.01
        if diffuse:
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = diffuse
            nt.links.new(t.outputs[0], b.inputs["Base Color"])
        nt.links.new(b.outputs[0], out.inputs[0])

if "nosub" in VAR:
    for o in bpy.data.objects:
        for md in getattr(o, "modifiers", []):
            if md.type == "SUBSURF":
                md.render_levels = 0; md.levels = 0
if "sunonly" in VAR:
    for l in bpy.data.lights:
        if l.type != "SUN": l.use_shadow = False
if "res25" in VAR:
    bpy.context.scene.eevee.shadow_resolution_scale = 0.25
    for l in bpy.data.lights:
        if hasattr(l, "shadow_resolution_scale"): l.shadow_resolution_scale = 0.25
if "noshadow" in VAR:
    sc_ = bpy.context.scene; sc_.eevee.use_shadows = False
if VAR.startswith("lean"):
    body = next(o for o in dst.objects if o.name.endswith(".body"))
    simplify_skin(body)

# simple room
bpy.ops.mesh.primitive_plane_add(size=20)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 3, 1.5)); bpy.context.object.scale = (10, 0.1, 3)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.58, 0.7, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
area = bpy.data.objects.new("a", bpy.data.lights.new("a", "AREA")); area.data.energy = 300; area.data.size = 2
area.location = (-1.5, -2, 2.5); area.rotation_euler = (math.radians(50), 0, math.radians(-30)); sc.collection.objects.link(area)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
cam.location = (0.4, -2.6, 1.45); cam.rotation_euler = (math.radians(86), 0, math.radians(8))
sc.render.engine = "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 4 if "4spp" in VAR else 8
if VAR in ("fast", "lean", "lean_sss") or "nosub" in VAR:
    ee.use_shadow_jitter_viewport = False
    ee.shadow_ray_count = 1
    ee.shadow_step_count = 4
    ee.use_raytracing = False
    for k, v in (("fast_gi_method", "AMBIENT_OCCLUSION_ONLY"), ("horizon_quality", 0.25), ("fast_gi_step_count", 4),
                 ("fast_gi_resolution", "4"), ("horizon_resolution", "4"), ("shadow_resolution_scale", 0.5)):
        if hasattr(ee, k):
            try: setattr(ee, k, v); print("SET", k, v)
            except Exception as e: print("SETFAIL", k, e)
    ee.use_volumetric_shadows = False
    ee.volumetric_tile_size = "16"
    for l in bpy.data.lights:
        l.use_shadow_jitter = False
        if hasattr(l, "shadow_resolution_scale"): l.shadow_resolution_scale = 0.5
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.view_settings.view_transform = "AgX"
if "sunonly" in VAR:
    for l in bpy.data.lights:
        if l.type != "SUN": l.use_shadow = False
if "res25" in VAR:
    ee.shadow_resolution_scale = 0.25
    for l in bpy.data.lights:
        if hasattr(l, "shadow_resolution_scale"): l.shadow_resolution_scale = 0.25
sc.frame_start, sc.frame_end = 1, 4
os.makedirs(OUTD, exist_ok=True)
sc.render.filepath = os.path.join(OUTD, VAR + "_")
times = []
bpy.app.handlers.render_pre.append(lambda *a: times.append(time.time()))
t0 = time.time()
bpy.ops.render.render(animation=True)
times.append(time.time())
rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024
print("BENCH", VAR, [round(times[i + 1] - times[i], 1) for i in range(len(times) - 1)], "maxrss_MB", rss)
