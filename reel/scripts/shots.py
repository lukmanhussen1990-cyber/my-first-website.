"""Shot list for the reel. Times are seconds in the voiceover (audio/voiceover.mp3).

Each shot: camera move + what every character does. Characters not used in a shot are hidden.
Motion is kept deliberately stiff (linear keys, sliding moves) like the reference video.
"""
import math
import bpy
from mathutils import Vector

from timeline import SHOTS, EVENTS  # noqa: E402


def make(ctx):
    sc, C, cam, F, D = ctx["sc"], ctx["C"], ctx["cam"], ctx["F"], ctx["D"]
    key, key_vec, fa = ctx["key"], ctx["key_vec"], ctx["face_angle"]
    POOP, BABY = ctx["POOP"], ctx["BABY_SPOT"]
    You, Mom, Baby, Cop1, Cop2 = C["You"], C["Mom"], C["Baby"], C["Cop1"], C["Cop2"]

    def write(ch, f, st, interp):
        spec = st.get("pose", "stand")
        ch.key_place(f, st["x"], st["y"], st["rz"], st.get("z"), spec, interp)
        ch.key_pose(f, spec, st.get("d"), interp)
        ch.key_face(f, interp, **st.get("face", {}))

    def perform(ch, shot, beats):
        """beats: list of (time or None, {x,y,rz,z,pose,d,face,interp})"""
        t0, t1 = shot
        f0, f1 = F(t0), F(t1)
        st = {}
        for t, b in beats:
            st.update(b)
            f = f0 if t is None else min(max(f0, F(t)), f1 - 1)
            write(ch, f, st, b.get("interp", "LINEAR"))
        write(ch, f1 - 1, st, "CONSTANT")

    def walk(t0, t1, p0, p1, base=None, step=0.3, swing=16, pose="stand"):
        """stiff walk: slide + alternating leg swing + bob"""
        base = dict(base or {})
        rz = fa(p0, p1)
        n = max(2, int((t1 - t0) / step))
        beats = []
        for i in range(n + 1):
            k = i / n
            s = swing if i % 2 else -swing
            if i in (0, n):
                s = 0
            d = dict(base.get("d", {}))
            d.update({"upperleg01.L": (s, 0, 0), "upperleg01.R": (-s, 0, 0)})
            beats.append((t0 + (t1 - t0) * k, dict(base, x=p0[0] + (p1[0] - p0[0]) * k, y=p0[1] + (p1[1] - p0[1]) * k,
                                                   rz=rz, d=d, pose=pose)))
        return beats

    def world(ch, bone, t, offset=(0, 0, 0)):
        for act in bpy.data.actions:
            for fc in act.fcurves:
                fc.update()
        sc.frame_set(F(t))
        pb = ch.rig.pose.bones[bone]
        return ch.rig.matrix_world @ (pb.head + (pb.tail - pb.head) * 0.5) + Vector(offset)

    def fwd(rz_deg, dist=1.0):
        a = math.radians(rz_deg)
        return Vector((math.sin(a) * dist, -math.cos(a) * dist, 0))

    shot = {n: (a, b) for n, a, b in SHOTS}
    everyone = [You, Mom, Baby, Cop1, Cop2]

    ctx["cast_map"] = {}

    def cast(name, *present):
        f0 = F(shot[name][0])
        ctx["cast_map"][name] = [ch.name for ch in present]
        for ch in everyone:
            ch.key_visible(f0, ch in present)

    # ---- props default state --------------------------------------------
    poop, door, diaper, sign, nums = ctx["poop"], ctx["door"], ctx["diaper"], ctx["sign"], ctx["nums"]
    ctx["key_obj_visible"](poop, 1, False)
    ctx["key_obj_visible"](poop, F(2.9), True)
    ctx["key_obj_visible"](diaper, 1, False)
    key_vec(door, "rotation_euler", 1, (0, 0, 0), "CONSTANT")
    for o in ctx["hearts"] + ctx["sparks"]:
        key(o, "hide_render", 0, 1, 1.0, "CONSTANT")
    n3, n0 = nums["3"], nums["0"]
    fl = F(EVENTS["sign_flip"])
    key_vec(n3, "scale", 1, (1, 1, 1), "LINEAR")
    key_vec(n3, "scale", fl, (1, 1, 1), "LINEAR")
    key_vec(n3, "scale", fl + 3, (1, 0, 1), "CONSTANT")
    key_vec(n0, "scale", 1, (1, 0, 1), "CONSTANT")
    key_vec(n0, "scale", fl + 3, (1, 0, 1), "LINEAR")
    key_vec(n0, "scale", fl + 6, (1.15, 1.15, 1), "LINEAR")
    key_vec(n0, "scale", fl + 9, (1, 1, 1), "LINEAR")

    # positions used across shots
    YOU_HOME = (1.2, -0.75)
    MOM_SPOT = (-0.25, 0.62)
    smile = dict(mouthSmileLeft=0.8, mouthSmileRight=0.8, cheekSquintLeft=0.3, cheekSquintRight=0.3)
    angry = dict(browDownLeft=1.0, browDownRight=1.0, mouthFrownLeft=0.5, mouthFrownRight=0.5, eyeSquintLeft=0.4,
                 eyeSquintRight=0.4)
    worried = dict(browInnerUp=1.0, mouthFrownLeft=0.6, mouthFrownRight=0.6, eyeWideLeft=0.5, eyeWideRight=0.5)
    baby_up = {"neck01": (-25, 0, 0), "head": (-20, 0, 0)}
    cop_serious = dict(browDownLeft=0.7, browDownRight=0.7, mouthFrownLeft=0.3, mouthFrownRight=0.3)

    # ---- 1 intro: he looks into the camera, love-struck (heart eyes + tongue out) ------------
    s = shot["intro"]
    cast("intro", You)
    lovestruck = dict(tongueOut=1.0, jawOpen=0.6, mouthSmileLeft=0.25, mouthSmileRight=0.25, browInnerUp=0.7,
                      browOuterUpLeft=0.5, browOuterUpRight=0.5)
    tilt = {"head": (6, 0, 16), "neck01": (0, 0, 6), "tongue01": (12, 0, 0)}  # tongue out between the lips
    you0 = (0.45, -0.15)
    perform(You, s, [(None, dict(x=you0[0], y=you0[1], rz=0, pose="stand", face=lovestruck, d=tilt)),
                     (0.7, dict(d={"head": (6, 0, 22), "neck01": (0, 0, 8), "tongue01": (12, 0, 0)}))])
    hy0 = Vector((you0[0], you0[1], 1.58))
    cam.shot(F(s[0]), F(s[1]), hy0 + Vector((0.05, -0.75, 0.03)), hy0, lens=40, push=0.18)
    tb = 'pose.bones["tongue01"].scale'
    key_vec(You.rig, tb, 1, (1.3, 2.4, 1.3), "CONSTANT")      # long tongue only in the opening
    key_vec(You.rig, tb, F(2.9), (1.0, 1.0, 1.0), "CONSTANT")
    heart_eyes(ctx, You, F(0.0))

    # ---- 1b he stares at Mom; Mom smiles back ----------------------------------------------------
    s = shot["intro2"]
    cast("intro2", You, Mom)
    mom0 = (-0.4, -0.2)
    perform(You, s, [(None, dict(x=you0[0], y=you0[1], rz=fa(you0, mom0), pose="stand", face=lovestruck, d=tilt))])
    perform(Mom, s, [(None, dict(x=mom0[0], y=mom0[1], rz=fa(mom0, you0), pose="stand2", face=smile, d={})),
                     (2.0, dict(d={"head": (0, 0, -8)}))])
    # over Mom's shoulder: he stares at her with heart eyes, tongue out
    dmy = (Vector(you0) - Vector(mom0)).normalized()
    rgt = Vector((dmy.y, -dmy.x))
    cpos = Vector(mom0) - dmy * 0.55 + rgt * 0.3
    cam.shot(F(s[0]), F(s[1]), (cpos.x, cpos.y, 1.6), (you0[0], you0[1], 1.6), lens=40, push=0.15)
    ctx["key_obj_visible"](ctx["heart_eyes"][0], F(2.9), False)
    ctx["key_obj_visible"](ctx["heart_eyes"][1], F(2.9), False)

    # ---- 2 mom walks in ------------------------------------------------------
    s = shot["mom_walks"]
    cast("mom_walks", Mom, Baby)
    perform(Mom, s, walk(s[0], s[1], (-1.35, -2.3), (-0.35, -0.75), base=dict(face={})))
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=25, pose="sit", d=baby_up, face={}))])
    cam.shot(F(s[0]), F(s[1]), (-1.95, -3.0, 1.62), (0.2, 0.2, 0.75), lens=30,
             pos1=(-1.2, -2.15, 1.55), tgt1=(0.25, 0.25, 0.6))

    # ---- 3 poop close-up -----------------------------------------------------
    s = shot["poop_close"]
    cast("poop_close", Mom)
    perform(Mom, s, walk(s[0], s[0] + 0.9, (-0.6, 1.35), MOM_SPOT, base=dict(face={})) +
            [(s[0] + 0.95, dict(rz=fa(MOM_SPOT, POOP), d={}))])
    cam.shot(F(s[0]), F(s[1]), (0.62, -0.62, 0.11), (POOP.x - 0.05, POOP.y + 0.05, 0.08), lens=32, push=0.35)

    # ---- 4 mom gasps -----------------------------------------------------------
    s = shot["mom_gasp"]
    cast("mom_gasp", Mom)
    rz_mom = fa(MOM_SPOT, POOP)
    shock_face = dict(jawOpen=0.75, eyeWideLeft=1, eyeWideRight=1, browInnerUp=1, browOuterUpLeft=1,
                      browOuterUpRight=1, mouthFunnel=0.3)
    perform(Mom, s, [(None, dict(x=MOM_SPOT[0], y=MOM_SPOT[1], rz=rz_mom, pose="stand", face={},
                                 d={"neck01": (12, 0, 0), "head": (10, 0, 0)})),
                     (s[0] + 0.12, dict(pose={"base": "stand", "upper": "shock"}, face=shock_face, d={})),
                     (s[1] - 0.6, dict(face=dict(shock_face, jawOpen=0.55)))])
    head = Vector((MOM_SPOT[0], MOM_SPOT[1], 1.5))
    cpos = head + fwd(rz_mom, 1.25) + Vector((0, 0, -0.12))
    cam.shot(F(s[0]), F(s[1]), cpos, head + Vector((0, 0, -0.1)), lens=36, push=0.2)

    # ---- 5 mom stares at you (over your shoulder) -------------------------------
    s = shot["mom_stare"]
    cast("mom_stare", Mom, You)
    rz_you = fa(YOU_HOME, MOM_SPOT)
    rz_m2 = fa(MOM_SPOT, YOU_HOME)
    perform(You, s, [(None, dict(x=YOU_HOME[0], y=YOU_HOME[1], rz=rz_you, pose="stand", face={}))])
    perform(Mom, s, [(None, dict(x=MOM_SPOT[0], y=MOM_SPOT[1], rz=rz_mom, pose="akimbo", face={},
                                 d={"neck01": (15, 0, 0), "head": (10, 0, 0)})),
                     (10.05, {}),
                     (10.65, dict(rz=rz_m2, d={}, face=angry)),
                     ])
    d = (Vector(MOM_SPOT) - Vector(YOU_HOME)).normalized()
    right = Vector((d.y, -d.x))
    cp = Vector(YOU_HOME) - d * 0.75 + right * 0.32
    cam.shot(F(s[0]), F(s[1]), (cp.x, cp.y, 1.68), (MOM_SPOT[0], MOM_SPOT[1], 1.35), lens=38, push=0.15)

    # ---- 6 you look guilty ---------------------------------------------------------
    s = shot["you_guilty"]
    cast("you_guilty", You)
    perform(You, s, [(None, dict(x=YOU_HOME[0], y=YOU_HOME[1], rz=rz_you, pose="embarrassed", face=worried,
                                 d={"head": (0, -12, 0)})),
                     (12.2, dict(d={"head": (0, 12, 0)})), (12.6, dict(d={"head": (0, -8, 0)}))])
    hy = Vector((YOU_HOME[0], YOU_HOME[1], 1.55))
    cam.shot(F(s[0]), F(s[1]), hy + fwd(rz_you, 0.95) + Vector((0, 0, -0.3)), hy, lens=40, push=0.25)

    # ---- 7 the sign ------------------------------------------------------------------
    s = shot["sign"]
    cast("sign", Mom)
    sp = ctx["SIGN_POS"]
    mom_sign = (sp.x - 0.45, sp.y - 0.32)  # right next to the sign so her raised hand reaches it
    perform(Mom, s, [(None, dict(x=mom_sign[0], y=mom_sign[1], rz=-25, pose="akimbo", face=angry)),
                     (13.9, {}), (14.25, dict(pose="armup", rz=-5)), (14.7, {}), (15.0, dict(pose="akimbo", rz=-25))])
    cam.shot(F(s[0]), F(s[1]), (sp.x - 0.05, sp.y - 2.45, 1.45), (sp.x - 0.22, sp.y, 1.45), lens=28,
             pos1=(sp.x - 0.08, sp.y - 2.0, 1.45), tgt1=(sp.x - 0.2, sp.y, 1.45))

    # ---- 8 not me ------------------------------------------------------------------------
    s = shot["not_me"]
    cast("not_me", You)
    beats = [(None, dict(x=YOU_HOME[0], y=YOU_HOME[1], rz=-25, pose="stand2", face=worried, d={}))]
    t = 16.45
    i = 0
    while t < 17.95:
        beats.append((t, dict(d={"head": (0, 22 if i % 2 else -22, 0), "neck01": (0, 8 if i % 2 else -8, 0)})))
        t += 0.2
        i += 1
    beats.append((t, dict(d={})))
    perform(You, s, beats)
    cam.shot(F(s[0]), F(s[1]), (0.55, -2.25, 0.95), (YOU_HOME[0], YOU_HOME[1], 1.35), lens=34, push=0.2)

    # ---- 9 baby reveal ------------------------------------------------------------------------
    s = shot["baby_reveal"]
    cast("baby_reveal", Baby)
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=5, pose="sit", d=baby_up, face={})),
                      (19.6, dict(d=dict(baby_up, head=(-20, 15, 0)))), (20.3, dict(d=dict(baby_up, head=(-20, -10, 0))))])
    bh = world(Baby, "head", 18.6)
    cam.shot(F(s[0]), F(s[1]), (bh.x + 0.15, bh.y - 1.35, 0.32), (bh.x, bh.y, bh.z - 0.05), lens=30, push=0.3)

    # ---- 10 you point at him (over the shoulder) -----------------------------------------------
    s = shot["point"]
    cast("point", You, Baby, Mom)
    yp = (0.75, -0.55)
    rz_pt = fa(yp, BABY) + 38
    perform(You, s, [(None, dict(x=yp[0], y=yp[1], rz=fa(yp, BABY), pose="stand", face=angry)),
                     (21.35, {}), (21.55, dict(pose="point", rz=rz_pt))])
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=-30, pose="sit", d=baby_up, face={}))])
    perform(Mom, s, [(None, dict(x=-1.75, y=-0.15, rz=fa((-1.75, -0.15), BABY), pose="stand", face={}))])
    d = (Vector(BABY[:2]) - Vector(yp)).normalized()
    right = Vector((d.y, -d.x))
    cp = Vector(yp) - d * 0.8 + right * 0.38
    cam.shot(F(s[0]), F(s[1]), (cp.x, cp.y, 1.55), (BABY.x, BABY.y, 0.35), lens=32, push=0.2)

    # ---- 11 he smiles --------------------------------------------------------------------------------
    s = shot["baby_smile"]
    cast("baby_smile", Baby)
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=0, pose="sit", d=baby_up, face={})),
                      (23.62, {}), (23.95, dict(face=dict(mouthSmileLeft=1, mouthSmileRight=1, cheekSquintLeft=0.6,
                                                             cheekSquintRight=0.6)))])
    bh = world(Baby, "head", 23.6)
    cam.shot(F(s[0]), F(s[1]), bh + Vector((0.02, -0.62, 0.0)), bh + Vector((0, 0, -0.01)), lens=40, push=0.3)

    # ---- 12 cute as hell -------------------------------------------------------------------------------
    s = shot["cute"]
    cast("cute", Baby)
    cute = dict(mouthSmileLeft=1, mouthSmileRight=1, cheekSquintLeft=0.8, cheekSquintRight=0.8, eyeSquintLeft=0.5,
                eyeSquintRight=0.5, browInnerUp=0.6)
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=0, pose="sit", d=dict(baby_up, head=(-20, 0, 14)),
                                  face=cute))])
    bh = world(Baby, "head", 25.1)
    cam.shot(F(s[0]), F(s[1]), bh + Vector((-0.38, -0.42, -0.12)), bh, lens=45, push=0.2)

    # ---- 13 mom melts (hearts) ----------------------------------------------------------------------------
    s = shot["mom_melts"]
    cast("mom_melts", Mom)
    mp = (-0.1, 0.05)
    rz = fa(mp, (0.6, -0.9))
    perform(Mom, s, [(None, dict(x=mp[0], y=mp[1], rz=rz, pose="clasp", face=dict(smile, browInnerUp=0.8),
                                 d={"head": (0, 0, -12)}))])
    mh_ = Vector((mp[0], mp[1], 1.5))
    cpos = mh_ + fwd(rz, 1.0) + Vector((0, 0, -0.08))
    cam.shot(F(s[0]), F(s[1]), cpos, mh_ + Vector((0, 0, -0.05)), lens=36, push=0.15)
    v = mh_ - cpos
    theta = math.atan2(-v.x, v.y)
    ctx["pop_glyphs"](ctx["hearts"], F(EVENTS["pop_hearts"]), mh_ + fwd(rz, 0.15) + Vector((0, 0, 0.06)), (0.15, 0.24), theta,
                      stagger=2, life=30, rise=0.18)

    # ---- 14 you're screwed ---------------------------------------------------------------------------------
    s = shot["screwed"]
    cast("screwed", You)
    perform(You, s, [(None, dict(x=YOU_HOME[0], y=YOU_HOME[1], rz=rz_you, pose="embarrassed",
                                 face=dict(worried, eyeWideLeft=1, eyeWideRight=1)))])
    cam.shot(F(s[0]), F(s[1]), hy + fwd(rz_you, 0.8) + Vector((0, 0, -0.55)), hy + Vector((0, 0, 0.02)), lens=28,
             push=0.35)

    # ---- 15 grab his diaper ----------------------------------------------------------------------------------
    s = shot["grab_diaper"]
    cast("grab_diaper", You, Baby)
    gp = (BABY[0] + 0.62, BABY[1] - 0.42)
    perform(You, s, [(None, dict(x=gp[0] + 0.3, y=gp[1] - 0.2, rz=fa(gp, BABY), pose="stand", face={})),
                     (29.2, dict(x=gp[0], y=gp[1])), (29.45, dict(pose="lean", d={"spine03": (12, 0, 0)}))])
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=fa(BABY, gp), pose="sit", d=baby_up,
                                  face=dict(mouthSmileLeft=0.5, mouthSmileRight=0.5)))])
    cam.shot(F(s[0]), F(s[1]), (BABY[0] - 0.75, BABY[1] - 1.55, 0.95), (BABY[0] + 0.25, BABY[1] - 0.15, 0.6),
             lens=30, push=0.15)

    # ---- 16 perfectly clean (sparkles + ding) -------------------------------------------------------------------
    s = shot["clean"]
    cast("clean", You)
    cp_ = (-0.2, 0.25)
    perform(You, s, [(None, dict(x=cp_[0], y=cp_[1], rz=-15, pose="armup", face=dict(browOuterUpLeft=1,
                                                                                    browOuterUpRight=1)))])
    diaper.parent = You.rig
    diaper.parent_type = "BONE"
    diaper.parent_bone = "wrist.L"
    diaper.location = (0.0, 0.05, 0.06)
    diaper.rotation_euler = (math.radians(90), 0, 0)
    ctx["key_obj_visible"](diaper, F(s[0]), True)
    ctx["key_obj_visible"](diaper, F(s[1]), False)
    dpos = world(You, "wrist.L", 32.0)
    cam_p = Vector((cp_[0] + 0.2, cp_[1] - 1.85, 0.5))
    mid = (Vector((cp_[0], cp_[1], 1.45)) + dpos) / 2  # frame his face and the diaper held up high
    cam.shot(F(s[0]), F(s[1]), cam_p, mid, lens=24, push=0.12, tgt1=mid + Vector((0, 0, 0.05)))
    v = dpos - cam_p
    ctx["pop_glyphs"](ctx["sparks"], F(EVENTS["ding"]) - 2, dpos + Vector((0, -0.12, 0.05)), 0.24,
                      math.atan2(-v.x, v.y), stagger=1, life=24, rise=0.05, spin=True)

    # ---- 17 how? nobody knows -------------------------------------------------------------------------------
    s = shot["how"]
    cast("how", Baby)
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=0, pose="sit", d=dict(baby_up, neck01=(-35, 0, 0)),
                                  face=dict(eyeLookUpLeft=0.7, eyeLookUpRight=0.7, mouthSmileLeft=0.35,
                                            mouthSmileRight=0.35, browInnerUp=0.7))),
                      (34.5, dict(d=dict(baby_up, neck01=(-35, 0, 0), head=(-20, 0, -12))))])
    bh = world(Baby, "head", 33.5)
    cam.shot(F(s[0]), F(s[1]), bh + Vector((0.12, -0.6, 0.12)), bh, lens=38, push=0.2)

    # ---- 18 the smartest thing ----------------------------------------------------------------------------------
    s = shot["smart"]
    cast("smart", You)
    sp_ = (1.25, -0.45)
    perform(You, s, [(None, dict(x=sp_[0], y=sp_[1], rz=-20, pose="stand", face=dict(smile, eyeSquintLeft=0.3,
                                                                                    eyeSquintRight=0.3))),
                     (36.6, {}), (36.85, dict(pose="phone"))])
    h18 = Vector((sp_[0], sp_[1], 1.5))
    cam.shot(F(s[0]), F(s[1]), h18 + fwd(-20, 1.7) + Vector((-0.2, 0, -0.15)), h18 + Vector((0, 0, -0.2)), lens=34,
             push=0.2)

    # ---- 19 calling the police ---------------------------------------------------------------------------------------
    s = shot["call"]
    cast("call", You)
    beats = [(None, dict(x=sp_[0], y=sp_[1], rz=-20, pose="phone", face={}))]
    t = 38.4
    i = 0
    while t < 41.2:
        beats.append((t, dict(face=dict(jawOpen=0.28 if i % 2 == 0 else 0.03, browDownLeft=0.3, browDownRight=0.3))))
        t += 0.13
        i += 1
    beats.append((41.25, dict(face=dict(smile))))
    perform(You, s, beats)
    sidev = fwd(-20 - 90, 1.0)  # character's right side (phone hand)
    cam.shot(F(s[0]), F(s[1]), h18 + sidev * 0.75 + fwd(-20, 0.35) + Vector((0, 0, 0.02)), h18 + Vector((0, 0, 0.02)),
             lens=38, push=0.3)

    # ---- 20 the police burst in --------------------------------------------------------------------------------------
    s = shot["door_burst"]
    cast("door_burst", Cop1, Cop2)
    fd = F(EVENTS["door_slam"])
    key_vec(door, "rotation_euler", fd - 1, (0, 0, 0), "LINEAR")
    key_vec(door, "rotation_euler", fd + 2, (0, 0, math.radians(112)), "LINEAR")
    key_vec(door, "rotation_euler", fd + 5, (0, 0, math.radians(98)), "LINEAR")
    key_vec(door, "rotation_euler", fd + 8, (0, 0, math.radians(102)), "CONSTANT")
    perform(Cop1, s, [(None, dict(x=4.0, y=0.78, rz=-90, pose="run", face=cop_serious)),
                      (41.5, {}), (42.15, dict(x=2.2, y=0.95))])
    perform(Cop2, s, [(None, dict(x=4.6, y=0.62, rz=-90, pose="run", face=cop_serious)),
                      (41.62, {}), (42.15, dict(x=2.75, y=0.3))])
    cam.shot(F(s[0]), F(s[1]), (0.4, -1.35, 1.35), (3.0, 0.72, 1.15), lens=26, push=0.05)

    # ---- 21 cops look at the poop -----------------------------------------------------------------------------------
    c1, c2 = (1.18, 0.52), (1.12, -0.45)
    you_spot = (-0.25, -1.35)
    mom_spot2 = (-1.55, -0.55)
    look_down = {"spine03": (12, 0, 0), "neck01": (22, 0, 0), "head": (18, 0, 0)}
    s = shot["look_poop"]
    cast("look_poop", Cop1, Cop2, You, Baby, Mom)
    perform(Cop1, s, [(None, dict(x=c1[0], y=c1[1], rz=fa(c1, POOP), pose="attention", d=look_down, face=cop_serious))])
    perform(Cop2, s, [(None, dict(x=c2[0], y=c2[1], rz=fa(c2, POOP), pose="akimbo", d=look_down, face=cop_serious))])
    perform(You, s, [(None, dict(x=you_spot[0], y=you_spot[1], rz=fa(you_spot, c1), pose="stand", face=smile))])
    perform(Mom, s, [(None, dict(x=mom_spot2[0], y=mom_spot2[1], rz=fa(mom_spot2, POOP), pose="akimbo", face={}))])
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=fa(BABY, c1), pose="sit", d=baby_up, face={}))])
    cam.shot(F(s[0]), F(s[1]), (2.05, 0.08, 1.85), (POOP.x, POOP.y, 0.1), lens=30, push=0.15)

    # ---- 22 then at the baby ------------------------------------------------------------------------------------------
    s = shot["look_baby"]
    cast("look_baby", Cop1, Cop2, Baby)
    turn_b = {"neck01": (-6, -14, 0), "head": (-8, -26, 0)}
    perform(Cop1, s, [(None, dict(x=c1[0], y=c1[1], rz=fa(c1, POOP), pose="attention", d=look_down, face=cop_serious)),
                      (44.05, dict(rz=fa(c1, BABY) + 25, d=turn_b))])
    perform(Cop2, s, [(None, dict(x=c2[0], y=c2[1], rz=fa(c2, POOP), pose="akimbo", d=look_down, face=cop_serious)),
                      (44.12, dict(rz=fa(c2, BABY) + 25, d=turn_b))])
    perform(Baby, s, [(None, dict(x=BABY[0], y=BABY[1], rz=fa(BABY, c1), pose="sit", d=baby_up,
                                  face=dict(mouthSmileLeft=0.6, mouthSmileRight=0.6)))])
    cam.shot(F(s[0]), F(s[1]), (BABY[0] - 0.45, BABY[1] + 0.32, 0.55), ((c1[0] + c2[0]) / 2, 0.1, 1.45), lens=30,
             push=0.12)

    # ---- 23 then at you (your point of view) ----------------------------------------------------------------------------
    s = shot["look_you"]
    cast("look_you", Cop1, Cop2)
    turn_y = {"neck01": (-4, 0, 0), "head": (-6, 0, 0)}
    perform(Cop1, s, [(None, dict(x=c1[0], y=c1[1], rz=fa(c1, you_spot), pose="akimbo", d=turn_y,
                                  face=dict(cop_serious, browDownLeft=1, browDownRight=1)))])
    perform(Cop2, s, [(None, dict(x=c2[0], y=c2[1], rz=fa(c2, you_spot), pose="akimbo", d=turn_y,
                                  face=dict(cop_serious, browDownLeft=1, browDownRight=1)))])
    cam.shot(F(s[0]), F(s[1]), (you_spot[0], you_spot[1], 1.3), ((c1[0] + c2[0]) / 2, 0.03, 1.62), lens=30, push=0.25)

    # ---- 24 they arrest you -------------------------------------------------------------------------------------------------
    s = shot["arrest"]
    cast("arrest", You, Cop1, Cop2)
    ap = (0.35, -0.55)
    perform(You, s, [(None, dict(x=ap[0], y=ap[1], rz=-5, pose="stand", face=worried)),
                     (46.45, {}), (46.65, dict(pose="behind", d={"head": (8, 0, 0)}))])
    perform(Cop1, s, [(None, dict(x=ap[0] + 0.62, y=ap[1] + 0.12, rz=fa((ap[0] + 0.62, ap[1] + 0.12), ap) + 25,
                                  pose="grab", face=cop_serious))])
    perform(Cop2, s, [(None, dict(x=ap[0] - 0.6, y=ap[1] + 0.15, rz=fa((ap[0] - 0.6, ap[1] + 0.15), ap) - 20,
                                  pose="shoulder", face=cop_serious))])
    cam.shot(F(s[0]), F(s[1]), (ap[0] + 0.1, ap[1] - 2.35, 1.45), (ap[0], ap[1], 1.2), lens=30, push=0.18)

    # ---- 25 dragged out; mom holds the baby ------------------------------------------------------------------------------------
    s = shot["dragged"]
    cast("dragged", You, Cop1, Cop2, Mom, Baby)
    mspot = (-1.45, -1.25)
    rz_door = fa(mspot, (2.8, 0.7))
    hold_baby(ctx, Mom, Baby, s, mspot, rz_door, perform, fwd, mom_face={}, baby_face={})
    p_start, p_end = Vector((0.55, -0.35)), Vector((2.75, 0.72))
    rz_back = fa(p_end, mspot)
    perform(You, s, [(None, dict(x=p_start.x, y=p_start.y, rz=rz_back, pose="behind", face=worried)),
                     (47.75, {}), (49.5, dict(x=p_end.x, y=p_end.y))])
    side = Vector((math.cos(math.radians(rz_back)), math.sin(math.radians(rz_back)))) * 0.55
    for cop, sg, pose in ((Cop1, 1, "grab"), (Cop2, -1, "shoulder")):
        a, b = p_start + side * sg, p_end + side * sg
        perform(cop, s, [(None, dict(x=a.x, y=a.y, rz=rz_back + 180, pose=pose, face=cop_serious)),
                         (47.75, {}), (49.5, dict(x=b.x, y=b.y))])
    back = fwd(rz_door, -0.75)
    rgt = Vector((math.cos(math.radians(rz_door)), math.sin(math.radians(rz_door)), 0)) * 0.35
    cam.shot(F(s[0]), F(s[1]), Vector((mspot[0], mspot[1], 1.72)) + back + rgt, (1.7, 0.25, 1.05), lens=30, push=0.12)

    # ---- 26 she just waved -----------------------------------------------------------------------------------------------------------
    s = shot["wave"]
    cast("wave", Mom, Baby)
    beats_wave = []
    t, i = 49.75, 0
    while t < 50.7:
        beats_wave.append((t, {"lowerarm01.R": (0, 0, 30 if i % 2 else -30), "wrist.R": (0, 0, 15 if i % 2 else -15)}))
        t += 0.18
        i += 1
    hold_baby(ctx, Mom, Baby, s, mspot, rz_door, perform, fwd, mom_face=dict(smile),
              baby_face=dict(mouthSmileLeft=0.7, mouthSmileRight=0.7), wave=beats_wave)
    mh2 = Vector((mspot[0], mspot[1], 1.32))
    cam.shot(F(s[0]), F(s[1]), mh2 + fwd(rz_door, 1.75) + Vector((0, 0, -0.05)), mh2, lens=34, push=0.12)

    # ---- 27 the wink + freeze ---------------------------------------------------------------------------------------------------------
    s = shot["wink"]
    cast("wink", Mom, Baby)
    tw = EVENTS["wink"]
    smirk = dict(mouthSmileLeft=1.0, mouthSmileRight=0.55, cheekSquintLeft=0.7)
    hold_baby(ctx, Mom, Baby, s, mspot, rz_door, perform, fwd, mom_face=dict(smile),
              baby_face=dict(smirk), baby_extra=[(tw, dict(face=dict(smirk))),
                                                 (tw + 0.1, dict(face=dict(smirk, eyeBlinkLeft=1.0, cheekSquintLeft=1.0))),
                                                 (tw + 0.55, dict(face=dict(smirk, eyeBlinkLeft=1.0, cheekSquintLeft=1.0))),
                                                 (tw + 0.7, dict(face=dict(smirk)))])
    bh = world(Baby, "head", 51.0)
    cam.shot(F(s[0]), F(s[1]), bh + fwd(rz_door, 1.0) + Vector((0, 0, 0.02)), bh + Vector((0, 0, 0.0)), lens=40,
             pos1=bh + fwd(rz_door, 0.42) + Vector((0, 0, 0.0)), ease=False)


def hold_baby(ctx, Mom, Baby, s, mspot, rz, perform, fwd, mom_face, baby_face, wave=None, baby_extra=None):
    """Mom stands holding the baby against her chest (both facing the same way)."""
    mom_beats = [(None, dict(x=mspot[0], y=mspot[1], rz=rz, pose="clasp", face=mom_face, d={}))]
    if wave:
        mom_beats = [(None, dict(x=mspot[0], y=mspot[1], rz=rz, pose={"base": "clasp", "armR": "wave"},
                                 face=mom_face, d={}))]
        mom_beats += [(t, dict(d=d)) for t, d in wave]
    perform(Mom, s, mom_beats)
    p = Vector((mspot[0], mspot[1], 0)) + fwd(rz, 0.24)
    z = 0.98 + Baby.ground_z("sit")
    beats = [(None, dict(x=p.x, y=p.y, z=z, rz=rz, pose="sit", d={"neck01": (-25, 0, 0), "head": (-15, 0, 0)},
                         face=baby_face))]
    beats += baby_extra or []
    perform(Baby, s, beats)


def heart_eyes(ctx, ch, frame):
    """two big red hearts over his eyes (like the reference), attached to the head so they follow it"""
    import os
    from mathutils import Matrix
    sc = ctx["sc"]
    for act in bpy.data.actions:
        for fc in act.fcurves:
            fc.update()
    sc.frame_set(frame)
    rig = ch.rig
    mat = bpy.data.materials.new("HeartEyeRed")
    mat.use_nodes = True
    bs = mat.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (0.42, 0.0, 0.005, 1)   # deep glossy red like the reference
    bs.inputs["Roughness"].default_value = 0.18
    bs.inputs["Coat Weight"].default_value = 0.8
    font = bpy.data.fonts.load(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets",
                                            "fonts", "DejaVuSans-Bold.ttf"), check_existing=True)
    hb = rig.pose.bones["head"]
    up = ((rig.matrix_world @ hb.tail) - (rig.matrix_world @ hb.head)).normalized()
    objs = []
    for side in ("L", "R"):
        eb = rig.pose.bones[f"eye.{side}"]
        e0, e1 = rig.matrix_world @ eb.head, rig.matrix_world @ eb.tail
        fwd = (e1 - e0).normalized()
        upo = (up - fwd * up.dot(fwd)).normalized()
        x = upo.cross(fwd)
        cu = bpy.data.curves.new(f"HeartEye{side}", "FONT")
        cu.body = "\u2665"
        cu.font = font
        cu.size = 0.085
        cu.align_x, cu.align_y = "CENTER", "CENTER"
        cu.extrude = 0.008
        cu.bevel_depth = 0.004
        cu.bevel_resolution = 3
        o = bpy.data.objects.new(f"HeartEye{side}", cu)
        sc.collection.objects.link(o)
        o.data.materials.append(mat)
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = "head"
        bpy.context.view_layer.update()
        m = Matrix((x, upo, fwd)).transposed().to_4x4()
        m.translation = e0 + fwd * 0.03 + upo * 0.004
        o.matrix_world = m
        objs.append(o)
        ctx["key_obj_visible"](o, 1, True)
    ctx["heart_eyes"] = objs
