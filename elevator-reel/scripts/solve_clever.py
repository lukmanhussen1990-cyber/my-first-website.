"""Solve IK target + wrist angles for 'Clever!': left index tip on temple, right thumbs-up."""
import bpy, sys, math, json, random
sys.path.insert(0, "/opt/work/scripts")
from mathutils import Vector
import lib
bpy.ops.wm.open_mainfile(filepath="/opt/work/blend/elev_anim.blend")
sc = bpy.context.scene
S = json.load(open("/opt/work/elev/shots.json"))
rig = bpy.data.objects["You"]
pb = rig.pose.bones
k0 = S["07"][0]
F = k0 + 8
sc.frame_set(F)
# drop the curves we optimise so the depsgraph keeps our values
act = rig.animation_data.action
kill = ['pose.bones["IK_hand_l"].location', 'pose.bones["hand_l"].rotation_euler', 'pose.bones["IK_hand_r"].location',
        'pose.bones["hand_r"].rotation_euler', 'pose.bones["IK_elbow_r"].location'] + \
       [f'pose.bones["{fn}_{j}_{s}"].rotation_euler' for fn in ("index", "middle", "ring", "pinky", "thumb") for j in ("01", "02", "03") for s in "lr"]
for fc in list(lib.fcurves_of(rig)):
    if fc.data_path in kill:
        for cb in [c for l in act.layers for s in l.strips for c in s.channelbags]:
            if fc in list(cb.fcurves):
                cb.fcurves.remove(fc); break
sc.frame_set(F)


def ik(bone, pos):
    M = rig.data.bones[bone].matrix_local
    pb[bone].location = M.to_3x3().inverted() @ (Vector(pos) - M.to_translation())


def fingers(side, curl, thumb, straight_index=False):
    for fn in ("index", "middle", "ring", "pinky"):
        for j, w in (("01", 0.8), ("02", 1.0), ("03", 0.8)):
            c = 0.0 if (straight_index and fn == "index") else curl * w
            pb[f"{fn}_{j}_{side}"].rotation_euler = (math.radians(c), 0, 0)
    for j in ("02", "03"):
        pb[f"thumb_{j}_{side}"].rotation_euler = (math.radians(thumb), 0, 0)


fingers("l", 82, 35, straight_index=True)
fingers("r", 88, -5)
bpy.context.view_layer.update()
Mh = rig.matrix_world @ pb["head"].matrix
xw = (Mh.to_3x3() @ Vector((1, 0, 0))).normalized()
sx = 1 if xw.x > 0 else -1
temple = Mh @ Vector((sx * 0.07, 0.05, 0.05))
print("temple", tuple(round(v, 3) for v in temple), "headX", tuple(round(v, 2) for v in xw))
Wi = rig.matrix_world.inverted()


def evalL(p):
    ik("IK_hand_l", p[:3]); pb["hand_l"].rotation_euler = [math.radians(a) for a in p[3:6]]
    bpy.context.view_layer.update()
    tip = rig.matrix_world @ pb["index_03_l"].tail
    d = (rig.matrix_world.to_3x3() @ (pb["index_03_l"].tail - pb["index_02_l"].head)).normalized()
    tohead = (Mh.translation + Vector((0, 0, 0.08)) - tip).normalized()
    return (tip - temple).length ** 2 * 100 + 0.3 * (1 - d.dot(tohead)) + 0.00002 * sum(a * a for a in p[3:6])


def evalR(p):
    ik("IK_hand_r", p[:3]); pb["hand_r"].rotation_euler = [math.radians(a) for a in p[3:6]]
    bpy.context.view_layer.update()
    th = (rig.matrix_world.to_3x3() @ (pb["thumb_03_r"].tail - pb["thumb_02_r"].head)).normalized()
    zp = (rig.matrix_world @ pb["hand_r"].matrix).to_3x3() @ Vector((0, 0, 1))
    pos = rig.matrix_world @ pb["hand_r"].head
    want = Wi.inverted() @ Vector((-0.2, -0.34, 1.28))
    return (1 - th.z) + 0.4 * (1 - zp.normalized().dot((rig.matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized())) + 20 * (pos - want).length ** 2


def solve(fun, p0, steps):
    rng = random.Random(1)
    best = list(p0); bv = fun(best)
    for it in range(900):
        sc_ = 1.0 - it / 900
        cand = [b + rng.gauss(0, s * sc_ + s * 0.05) for b, s in zip(best, steps)]
        v = fun(cand)
        if v < bv:
            best, bv = cand, v
    return best, bv


ik("IK_elbow_l", (0.62, 0.15, 1.35))
pL, vL = solve(evalL, [0.2, -0.08, 1.58, 0, 0, 0], [0.04, 0.04, 0.04, 25, 25, 25])
evalL(pL)
tip = rig.matrix_world @ pb["index_03_l"].tail
print("LEFT", [round(x, 3) for x in pL[:3]], [round(x, 1) for x in pL[3:]], "err", round((tip - temple).length, 3), round(vL, 4))
ik("IK_elbow_r", (-0.45, 0.05, 1.0))
pR, vR = solve(evalR, [-0.2, -0.34, 1.28, 0, 0, 0], [0.02, 0.02, 0.02, 40, 40, 40])
print("RIGHT", [round(x, 3) for x in pR[:3]], [round(x, 1) for x in pR[3:]], round(vR, 4))
json.dump({"L": pL, "R": pR}, open("/opt/work/elev/clever_pose.json", "w"))
sc.render.resolution_x, sc.render.resolution_y = 270, 480
sc.eevee.taa_render_samples = 1; sc.eevee.use_shadows = False
sc.camera = bpy.data.objects["CAM_07"]
sc.render.filepath = "/opt/work/elev/tst/clever.jpg"
sc.render.image_settings.file_format = 'JPEG'
bpy.ops.render.render(write_still=True)
