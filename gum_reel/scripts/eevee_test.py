import bpy, time, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = sys.argv[-1] if len(sys.argv) > 1 else 'BLENDER_EEVEE'
print("engine", sc.render.engine)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0,0,1))
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_plane_add(size=10)
cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co)
co.location=(0,-6,2); co.rotation_euler=(1.35,0,0); sc.camera=co
l = bpy.data.lights.new("s",'SUN'); lo=bpy.data.objects.new("s",l); sc.collection.objects.link(lo); lo.rotation_euler=(0.6,0.3,0)
w = bpy.data.worlds.new("w"); sc.world=w; w.use_nodes=True
sc.render.resolution_x=540; sc.render.resolution_y=960
sc.render.filepath="/home/user/work/test/eevee_test.png"
t=time.time(); bpy.ops.render.render(write_still=True); print("render time", time.time()-t)
t=time.time(); bpy.ops.render.render(write_still=True); print("render time2", time.time()-t)
