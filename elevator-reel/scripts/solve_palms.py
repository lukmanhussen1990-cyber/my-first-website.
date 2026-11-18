import bpy, sys, math, json
sys.path.insert(0, "/opt/work/scripts")
from mathutils import Vector, Euler
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_anim.blend")
sc = bpy.context.scene
S = json.load(open("/opt/work/elev/shots.json"))
rig = bpy.data.objects["You"]
i0 = S["05b"][0]
sc.frame_set(i0 + 10)
cam = bpy.data.objects["CAM_05b"]
camp = cam.matrix_world.translation.copy()
rig.animation_data_clear()
pb = rig.pose.bones


def ik(bone, pos):
    M = rig.data.bones[bone].matrix_local
    pb[bone].location = M.to_3x3().inverted() @ (Vector(pos) - M.to_translation())


P = json.loads(sys.argv[sys.argv.index("--") + 1])
ik("IK_hand_l", P["l"]); ik("IK_hand_r", P["r"]); ik("IK_elbow_l", P["el"]); ik("IK_elbow_r", P["er"])
best = {}
for side in ("l", "r"):
    res = []
    for x in range(-80, 81, 10):
        for y in range(-180, 180, 10):
            pb["hand_" + side].rotation_euler = (math.radians(x), math.radians(y), 0)
            bpy.context.view_layer.update()
            M = rig.matrix_world @ pb["hand_" + side].matrix
            zax = (M.to_3x3() @ Vector((0, 0, 1))).normalized()
            yax = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
            to_cam = (camp - M.translation).normalized()
            sc_ = zax.dot(to_cam) + 0.6 * yax.dot(Vector((0, 0, 1))) - 0.002 * abs(x)
            res.append((sc_, x, y, round(zax.dot(to_cam), 2), round(yax.z, 2)))
    res.sort(reverse=True)
    print("BEST", side, res[:3])
    best[side] = res[0]
