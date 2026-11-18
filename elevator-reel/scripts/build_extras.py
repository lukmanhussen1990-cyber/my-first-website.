"""Grandma + angry neighbour (MPFB) -> /opt/work/blend/extras.blend (collections GRANDMA, NEIGHBOUR)."""
import bpy, sys, time
sys.path.insert(0, "/opt/work/scripts")
import lib, mh_common as mc
t0 = time.time()
mc.clear_scene()
g_ph = {"gender": 0.0, "age": 0.95, "muscle": 0.3, "weight": 0.62, "proportions": 0.5, "height": 0.3, "cupsize": 0.5,
        "firmness": 0.3, "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}}
gb, gr = mc.build_human("Grandma", g_ph, skin="old_caucasian_female.mhmat", hair="bob02.mhclo",
                        clothes=("female_elegantsuit01.mhclo", "shoes06.mhclo"), skin_type="MAKESKIN", faceunits=True)
mc.add_ik(gr)
n_ph = {"gender": 1.0, "age": 0.9, "muscle": 0.4, "weight": 0.75, "proportions": 0.5, "height": 0.45, "cupsize": 0.5,
        "firmness": 0.4, "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}}
nb, nr = mc.build_human("Neighbour", n_ph, skin="old_caucasian_male.mhmat", hair="short01.mhclo",
                        clothes=("male_casualsuit06.mhclo", "shoes03.mhclo"), skin_type="MAKESKIN", faceunits=True)
mc.add_ik(nr)
# grey hair for both
for o in bpy.data.objects:
    if o.type == 'MESH' and ("bob02" in o.name or "short01" in o.name):
        for m in o.data.materials:
            if m and m.node_tree:
                for n in m.node_tree.nodes:
                    if n.type == 'BSDF_PRINCIPLED':
                        tex = n.inputs["Base Color"].links[0].from_node if n.inputs["Base Color"].links else None
                        mix = m.node_tree.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.blend_type = 'SCREEN'
                        mix.inputs["Factor"].default_value = 0.85
                        mix.inputs["B"].default_value = lib.srgb("#D8D6D2")
                        if tex:
                            m.node_tree.links.new(n.inputs["Base Color"].links[0].from_socket, mix.inputs["A"])
                        m.node_tree.links.new(mix.outputs[2], n.inputs["Base Color"])
for name, rig in (("GRANDMA", gr), ("NEIGHBOUR", nr)):
    C = lib.coll(name)
    for o in [rig] + rig.children_recursive:
        lib.link(o, C)
bpy.ops.wm.save_as_mainfile(filepath="/opt/work/blend/extras.blend")
print("EXTRAS saved", time.time() - t0, gr.name, nr.name)
