"""Re-render the three frames where a dug-out pit layer sits at exactly zero
height (a flattened box renders black); the empty layer is simply hidden."""
import bpy
bpy.ops.wm.open_mainfile(filepath='bunker.blend')
sc = bpy.context.scene
sc.render.use_persistent_data = False
for f in (631, 793, 829):
    sc.frame_set(f)
    for n in ('fill_gravel', 'fill_soil', 'fill_clay'):
        o = bpy.data.objects[n]
        o.hide_render = o.scale.z < 1e-3
    sc.render.filepath = f'frames/{f:04d}.png'
    bpy.ops.render.render(write_still=True)
    print('FIXED', f, [(n, round(bpy.data.objects[n].scale.z, 3)) for n in ('fill_gravel', 'fill_soil', 'fill_clay')])
