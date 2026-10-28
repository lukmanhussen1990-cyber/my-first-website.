import bpy, time, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
eng = sys.argv[-2]; samples=int(sys.argv[-1])
sc.render.engine = eng
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0,0,1)); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_monkey_add(location=(2,0,1)); 
bpy.ops.mesh.primitive_plane_add(size=10)
cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co)
co.location=(0,-6,2); co.rotation_euler=(1.35,0,0); sc.camera=co
l = bpy.data.lights.new("s",'SUN'); lo=bpy.data.objects.new("s",l); sc.collection.objects.link(lo); lo.rotation_euler=(0.6,0.3,0)
w = bpy.data.worlds.new("w"); sc.world=w
sc.render.resolution_x=1080; sc.render.resolution_y=1920
if eng=='CYCLES':
    sc.cycles.samples=samples; sc.cycles.use_denoising=True; sc.cycles.device='CPU'
else:
    sc.eevee.taa_render_samples=samples
sc.render.filepath=f"/home/user/work/test/t_{eng}_{samples}.png"
for i in range(2):
    t=time.time(); bpy.ops.render.render(write_still=True); print(eng, samples, "render time", time.time()-t, flush=True)
