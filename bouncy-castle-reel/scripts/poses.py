"""Pose library (semantic parameters for rigtools.apply_pose)."""
import copy


def P(**kw):
    base = dict(
        spine=dict(bend=0, side=0, twist=0, lower=0),
        head=dict(nod=0, turn=0, tilt=0),
        armL=dict(side_deg=8, fwd=4, twist=0, elbow=14, wrist=(0, 0, 0), clav=(0, 0, 0)),
        armR=dict(side_deg=8, fwd=4, twist=0, elbow=14, wrist=(0, 0, 0), clav=(0, 0, 0)),
        legL=dict(flex=0, abd=2, twist=0, knee=2, ankle=0),
        legR=dict(flex=0, abd=2, twist=0, knee=2, ankle=0),
        root=dict(loc=(0, 0, 0), rot=(0, 0, 0)),
        fingL=dict(curl=0.3, thumb=0.2, spread=0.0),
        fingR=dict(curl=0.3, thumb=0.2, spread=0.0),
        jaw=0,
        face={},
    )
    out = copy.deepcopy(base)
    for k, v in kw.items():
        if isinstance(v, dict) and k in out and isinstance(out[k], dict) and k != "face":
            out[k].update(v)
        else:
            out[k] = v
    return out


STAND = P()

# ---------------------------------------------------------------- faces
F_NEUTRAL = {}
F_SHOCK = dict(eyeWideLeft=1.0, eyeWideRight=1.0, browInnerUp=1.0, browOuterUpLeft=0.8, browOuterUpRight=0.8,
               mouthFunnel=0.3)
F_SMUG = dict(mouthSmileLeft=0.75, mouthSmileRight=0.25, eyeSquintLeft=0.5, eyeSquintRight=0.5,
              eyeBlinkLeft=0.35, eyeBlinkRight=0.35, browDownRight=0.3, browOuterUpLeft=0.4)
F_GRIN = dict(mouthSmileLeft=0.9, mouthSmileRight=0.9, cheekSquintLeft=0.4, eyeSquintLeft=0.3,
              eyeSquintRight=0.3, browOuterUpLeft=0.3, browOuterUpRight=0.3)
F_SAD = dict(mouthFrownLeft=0.8, mouthFrownRight=0.8, browInnerUp=0.9, eyeBlinkLeft=0.25, eyeBlinkRight=0.25,
             mouthShrugUpper=0.3)
F_DEADPAN = dict(eyeBlinkLeft=0.45, eyeBlinkRight=0.45, mouthPressLeft=0.6, mouthPressRight=0.6,
                 browDownLeft=0.2, browDownRight=0.2)
F_PANT = dict(browInnerUp=0.7, eyeSquintLeft=0.4, eyeSquintRight=0.4, mouthStretchLeft=0.3, mouthStretchRight=0.3)
F_SNEAKY = dict(mouthSmileLeft=0.55, mouthSmileRight=0.55, eyeSquintLeft=0.55, eyeSquintRight=0.55,
                browDownLeft=0.45, browDownRight=0.45)
F_EFFORT = dict(eyeSquintLeft=0.8, eyeSquintRight=0.8, mouthStretchLeft=0.6, mouthStretchRight=0.6,
                browDownLeft=0.7, browDownRight=0.7, noseSneerLeft=0.4, noseSneerRight=0.4)

# ---------------------------------------------------------------- YOU
CROUCH_LEGS = dict(legL=dict(flex=72, abd=14, knee=102, ankle=30), legR=dict(flex=72, abd=14, knee=102, ankle=30),
                   root=dict(loc=(0, 0.06, -0.395), rot=(0, 0, 0)))
CROUCH_BINOC = P(**CROUCH_LEGS, spine=dict(bend=14, lower=10), head=dict(nod=-12),
                 armL=dict(side_deg=16, fwd=86, twist=42, elbow=128), armR=dict(side_deg=16, fwd=86, twist=42, elbow=128),
                 fingL=dict(curl=0.75, thumb=0.5), fingR=dict(curl=0.75, thumb=0.5), face=F_SNEAKY)
CROUCH_BINOC_B = P(**CROUCH_LEGS, spine=dict(bend=12, lower=10, twist=4), head=dict(nod=-10, turn=4),
                   armL=dict(side_deg=17, fwd=88, twist=42, elbow=126), armR=dict(side_deg=15, fwd=85, twist=42, elbow=129),
                   fingL=dict(curl=0.75, thumb=0.5), fingR=dict(curl=0.75, thumb=0.5), face=F_SNEAKY)
CROUCH_HOLD = P(**CROUCH_LEGS, spine=dict(bend=16, lower=10), head=dict(nod=-6),
                armL=dict(side_deg=14, fwd=40, twist=20, elbow=95), armR=dict(side_deg=20, fwd=55, twist=10, elbow=110),
                fingL=dict(curl=0.6), fingR=dict(curl=0.8, thumb=0.6), face=F_SNEAKY)
SPRING_UP = P(root=dict(loc=(0, 0, -0.06), rot=(0, 0, 0)), spine=dict(bend=-8, twist=-30, side=-8), head=dict(nod=-6, turn=20),
              armR=dict(side_deg=100, fwd=-25, twist=-85, elbow=105), armL=dict(side_deg=45, fwd=70, elbow=25),
              legL=dict(flex=30, knee=25, ankle=5), legR=dict(flex=-10, knee=30),
              fingR=dict(curl=0.85, thumb=0.6), face=F_EFFORT)
THROW_REL = P(root=dict(loc=(0, 0, -0.09), rot=(0, 0, 0)), spine=dict(bend=22, twist=30, side=6), head=dict(nod=4, turn=-15),
              armR=dict(side_deg=35, fwd=85, twist=25, elbow=15), armL=dict(side_deg=30, fwd=-25, elbow=40),
              legL=dict(flex=35, knee=30, ankle=10), legR=dict(flex=-25, knee=25, ankle=-15),
              fingR=dict(curl=0.15, thumb=0.1), face=F_EFFORT)
THROW_FOLLOW = P(root=dict(loc=(0, 0, -0.09), rot=(0, 0, 0)), spine=dict(bend=26, twist=38, side=8), head=dict(nod=8, turn=-20),
                 armR=dict(side_deg=20, fwd=55, twist=40, elbow=25), armL=dict(side_deg=35, fwd=-35, elbow=35),
                 legL=dict(flex=35, knee=30, ankle=10), legR=dict(flex=-20, knee=40, ankle=-20),
                 fingR=dict(curl=0.3), face=F_GRIN)
KNEEL_WORK_A = P(legL=dict(flex=85, abd=8, knee=95, ankle=0), legR=dict(flex=0, abd=8, knee=100, ankle=-40),
                 root=dict(loc=(0, 0, -0.42), rot=(0, 0, 0)), spine=dict(bend=35, lower=15), head=dict(nod=10),
                 armL=dict(side_deg=20, fwd=70, twist=20, elbow=40), armR=dict(side_deg=25, fwd=95, twist=-10, elbow=70),
                 fingR=dict(curl=0.9, thumb=0.7), face=F_EFFORT)
KNEEL_WORK_B = P(legL=dict(flex=85, abd=8, knee=95, ankle=0), legR=dict(flex=0, abd=8, knee=100, ankle=-40),
                 root=dict(loc=(0, 0, -0.42), rot=(0, 0, 0)), spine=dict(bend=32, lower=15, twist=-8), head=dict(nod=14),
                 armL=dict(side_deg=20, fwd=70, twist=20, elbow=45), armR=dict(side_deg=25, fwd=50, twist=-10, elbow=120),
                 fingR=dict(curl=0.9, thumb=0.7), face=F_EFFORT)
STAND_WORK = P(spine=dict(bend=18), head=dict(nod=8),
               armL=dict(side_deg=18, fwd=60, twist=15, elbow=60), armR=dict(side_deg=22, fwd=85, twist=0, elbow=55),
               fingL=dict(curl=0.7), fingR=dict(curl=0.9, thumb=0.6), face=F_EFFORT)
STAND_REACH_UP = P(spine=dict(bend=-6), head=dict(nod=-35),
                   armL=dict(side_deg=20, fwd=150, twist=0, elbow=20), armR=dict(side_deg=20, fwd=160, twist=0, elbow=15),
                   fingL=dict(curl=0.7), fingR=dict(curl=0.7), face=F_EFFORT)
LOOK_UP_PULL = P(spine=dict(bend=-4), head=dict(nod=-38),
                 armR=dict(side_deg=12, fwd=40, twist=10, elbow=70), armL=dict(side_deg=10, fwd=10, elbow=20),
                 fingR=dict(curl=0.9, thumb=0.7), face=dict(browInnerUp=0.6, eyeWideLeft=0.3, eyeWideRight=0.3))
SOAKED = P(spine=dict(bend=2), head=dict(nod=-2),
           armL=dict(side_deg=24, fwd=6, elbow=18), armR=dict(side_deg=24, fwd=6, elbow=18),
           fingL=dict(curl=0.1, thumb=0.1), fingR=dict(curl=0.1, thumb=0.1), face=F_DEADPAN)
LEVER_REACH = P(spine=dict(bend=18, twist=-6), head=dict(nod=4),
                armL=dict(side_deg=12, fwd=62, twist=20, elbow=35), armR=dict(side_deg=10, fwd=58, twist=20, elbow=40),
                legL=dict(flex=18, knee=15), legR=dict(flex=-8, knee=10),
                fingL=dict(curl=0.9, thumb=0.7), fingR=dict(curl=0.9, thumb=0.7), face=F_SNEAKY)
LEVER_PULL = P(spine=dict(bend=-12, twist=-4), head=dict(nod=-4),
               armL=dict(side_deg=12, fwd=40, twist=20, elbow=60), armR=dict(side_deg=10, fwd=36, twist=20, elbow=65),
               legL=dict(flex=-10, knee=25, ankle=35), legR=dict(flex=30, knee=40, ankle=10),
               root=dict(loc=(0, 0.12, -0.075), rot=(0, 0, 0)),
               fingL=dict(curl=0.9, thumb=0.7), fingR=dict(curl=0.9, thumb=0.7), face=F_EFFORT)
TIRED_BASE = P(spine=dict(bend=28, lower=6), head=dict(nod=-18),
               armL=dict(side_deg=10, fwd=12, elbow=12), armR=dict(side_deg=10, fwd=12, elbow=12),
               fingL=dict(curl=0.2), fingR=dict(curl=0.2), jaw=9, face=F_PANT)
PROUD = P(spine=dict(bend=-8), head=dict(nod=-8, tilt=4),
          armL=dict(side_deg=30, fwd=50, twist=-30, elbow=95), armR=dict(side_deg=30, fwd=50, twist=-30, elbow=95),
          fingL=dict(curl=0.55, thumb=0.4), fingR=dict(curl=0.55, thumb=0.4), face=F_GRIN)
PROUD_B = P(spine=dict(bend=-10), head=dict(nod=-10, tilt=-3),
            armL=dict(side_deg=32, fwd=58, twist=-30, elbow=92), armR=dict(side_deg=30, fwd=60, twist=-30, elbow=90),
            fingL=dict(curl=0.55, thumb=0.4), fingR=dict(curl=0.55, thumb=0.4), face=F_GRIN)

# ---------------------------------------------------------------- FRIEND
F_IDLE = P(armL=dict(side_deg=14, fwd=8, elbow=20), armR=dict(side_deg=14, fwd=8, elbow=20), head=dict(nod=-3),
           face=dict(eyeBlinkLeft=0.15, eyeBlinkRight=0.15))
F_SCRATCH_A = P(armR=dict(side_deg=16, fwd=38, twist=55, elbow=105), armL=dict(side_deg=16, fwd=6, elbow=20),
                head=dict(nod=4, turn=-6), spine=dict(bend=-4),
                fingR=dict(curl=0.55, thumb=0.3), face=dict(eyeBlinkLeft=0.4, eyeBlinkRight=0.4, mouthSmileLeft=0.3))
F_SCRATCH_B = P(armR=dict(side_deg=18, fwd=30, twist=62, elbow=112), armL=dict(side_deg=16, fwd=6, elbow=20),
                head=dict(nod=2, turn=-4), spine=dict(bend=-5),
                fingR=dict(curl=0.75, thumb=0.3), face=dict(eyeBlinkLeft=0.5, eyeBlinkRight=0.5, mouthSmileLeft=0.35))
F_MATRIX = P(root=dict(loc=(0, -0.05, -0.192), rot=(0, 0, 0)), spine=dict(bend=-42, lower=-30), head=dict(nod=-22),
             legL=dict(flex=30, abd=12, knee=70, ankle=40), legR=dict(flex=30, abd=12, knee=70, ankle=40),
             armL=dict(side_deg=75, fwd=20, twist=-10, elbow=40), armR=dict(side_deg=75, fwd=20, twist=-10, elbow=40),
             fingL=dict(curl=0.1), fingR=dict(curl=0.1), jaw=10, face=F_SHOCK)
F_WALK_BASE = P(armL=dict(side_deg=14, fwd=6, elbow=20), armR=dict(side_deg=14, fwd=6, elbow=20),
                head=dict(nod=-3), face=dict(mouthSmileLeft=0.2, mouthSmileRight=0.2))
F_SIT = P(root=dict(loc=(0, 0, -0.42)), legL=dict(flex=88, abd=8, knee=80, ankle=10),
          legR=dict(flex=88, abd=8, knee=80, ankle=10),
          armL=dict(side_deg=18, fwd=20, elbow=40), armR=dict(side_deg=18, fwd=20, elbow=40),
          face=dict(eyeBlinkLeft=0.2, eyeBlinkRight=0.2))
F_SIT_SMUG = P(root=dict(loc=(0, 0, -0.42)), legL=dict(flex=88, abd=8, knee=80, ankle=10),
               legR=dict(flex=88, abd=8, knee=80, ankle=10), spine=dict(bend=-6), head=dict(nod=-10, tilt=6),
               armL=dict(side_deg=14, fwd=28, twist=60, elbow=118), armR=dict(side_deg=14, fwd=34, twist=55, elbow=112),
               face=F_SMUG)
F_SIT_SMUG_B = P(root=dict(loc=(0, 0, -0.42)), legL=dict(flex=88, abd=8, knee=80, ankle=10),
                 legR=dict(flex=88, abd=8, knee=80, ankle=10), spine=dict(bend=-8), head=dict(nod=-14, tilt=-4, turn=8),
                 armL=dict(side_deg=14, fwd=28, twist=60, elbow=118), armR=dict(side_deg=14, fwd=34, twist=55, elbow=112),
                 face=F_SMUG)
F_FALL = P(root=dict(loc=(0, 0, -0.42), rot=(-15, 0, 0)), legL=dict(flex=70, abd=20, knee=40, ankle=20),
           legR=dict(flex=60, abd=20, knee=50, ankle=20), spine=dict(bend=-15), head=dict(nod=-10),
           armL=dict(side_deg=150, fwd=10, elbow=30), armR=dict(side_deg=150, fwd=10, elbow=30),
           fingL=dict(curl=0.05), fingR=dict(curl=0.05), jaw=16, face=F_SHOCK)
F_IN_WATER = P(root=dict(loc=(0, 0, -0.30)), legL=dict(flex=80, abd=12, knee=115, ankle=35),
               legR=dict(flex=75, abd=12, knee=118, ankle=40),
               spine=dict(bend=5), head=dict(nod=4),
               armL=dict(side_deg=40, fwd=30, elbow=30), armR=dict(side_deg=40, fwd=30, elbow=30),
               fingL=dict(curl=0.1), fingR=dict(curl=0.1), face=F_SAD)
F_CLIMB = P(root=dict(loc=(0, 0, -0.25)), legL=dict(flex=95, abd=10, knee=110, ankle=10), legR=dict(flex=20, abd=8, knee=40),
            spine=dict(bend=30), head=dict(nod=-15),
            armL=dict(side_deg=25, fwd=80, twist=10, elbow=35), armR=dict(side_deg=25, fwd=80, twist=10, elbow=35),
            fingL=dict(curl=0.8), fingR=dict(curl=0.8), face=F_SAD)
F_CLIMB_B = P(root=dict(loc=(0, 0, -0.18)), legL=dict(flex=70, abd=10, knee=95, ankle=10), legR=dict(flex=40, abd=8, knee=70),
              spine=dict(bend=40), head=dict(nod=-10),
              armL=dict(side_deg=28, fwd=70, twist=10, elbow=60), armR=dict(side_deg=28, fwd=70, twist=10, elbow=60),
              fingL=dict(curl=0.8), fingR=dict(curl=0.8), face=F_SAD)

# test poses -----------------------------------------------------------------
ARMS_FWD = P(armL=dict(side_deg=0, fwd=90, elbow=0), armR=dict(side_deg=0, fwd=90, elbow=0))
ELBOW90 = P(armL=dict(side_deg=5, fwd=0, elbow=90), armR=dict(side_deg=5, fwd=0, elbow=90))
T_POSE = P(armL=dict(side_deg=90, fwd=0, elbow=0), armR=dict(side_deg=90, fwd=0, elbow=0))
CROUCH = P(root=dict(loc=(0, 0, -0.42), rot=(0, 0, 0)), spine=dict(bend=20),
           legL=dict(flex=95, abd=8, knee=120, ankle=-25), legR=dict(flex=95, abd=8, knee=120, ankle=-25))
BINOC = P(spine=dict(bend=8), head=dict(nod=-4),
          armL=dict(side_deg=18, fwd=78, twist=30, elbow=140, wrist=(0, 0, 0)),
          armR=dict(side_deg=18, fwd=78, twist=30, elbow=140, wrist=(0, 0, 0)),
          fingL=dict(curl=0.7, thumb=0.4), fingR=dict(curl=0.7, thumb=0.4))
SIT = P(root=dict(loc=(0, 0, -0.42)), legL=dict(flex=90, abd=6, knee=90, ankle=0),
        legR=dict(flex=90, abd=6, knee=90, ankle=0))
ARMS_CROSSED = P(armL=dict(side_deg=14, fwd=28, twist=60, elbow=118),
                 armR=dict(side_deg=14, fwd=34, twist=55, elbow=112))
THROW_WIND = P(spine=dict(twist=-25, side=-6, bend=-4),
               armR=dict(side_deg=95, fwd=-30, twist=40, elbow=95),
               armL=dict(side_deg=40, fwd=60, elbow=30),
               legL=dict(flex=25, knee=10), legR=dict(flex=-12, knee=15))
WALK_A = P(armL=dict(side_deg=8, fwd=-22, elbow=20), armR=dict(side_deg=8, fwd=26, elbow=30),
           legL=dict(flex=28, knee=8, ankle=8), legR=dict(flex=-18, knee=28, ankle=-12))
FISTS = P(fingL=dict(curl=1.0, thumb=0.8), fingR=dict(curl=1.0, thumb=0.8),
          armL=dict(side_deg=10, fwd=40, elbow=100), armR=dict(side_deg=10, fwd=40, elbow=100))
SHOCK = P(jaw=14, face=dict(eyeWideLeft=1.0, eyeWideRight=1.0, browInnerUp=1.0, browOuterUpLeft=0.8,
                            browOuterUpRight=0.8))

TEST = [("STAND", STAND), ("ARMS_FWD", ARMS_FWD), ("ELBOW90", ELBOW90), ("T_POSE", T_POSE),
        ("CROUCH", CROUCH), ("BINOC", BINOC), ("SIT", SIT), ("ARMS_CROSSED", ARMS_CROSSED),
        ("THROW_WIND", THROW_WIND), ("WALK_A", WALK_A), ("FISTS", FISTS), ("SHOCK", SHOCK)]


# =========================================================================== BOUNCY CASTLE
F_BORED = dict(eyeBlinkLeft=0.35, eyeBlinkRight=0.35, mouthPressLeft=0.3, mouthPressRight=0.3)
F_WINCE = dict(eyeBlinkLeft=1.0, eyeBlinkRight=1.0, mouthStretchLeft=0.9, mouthStretchRight=0.9,
               browDownLeft=0.9, browDownRight=0.9, noseSneerLeft=0.8, noseSneerRight=0.8)
F_HAPPY = dict(mouthSmileLeft=1.0, mouthSmileRight=1.0, eyeSquintLeft=0.35, eyeSquintRight=0.35,
               browOuterUpLeft=0.5, browOuterUpRight=0.5)

PHONE_ARMS = dict(armR=dict(side_deg=12, fwd=42, twist=34, elbow=112, wrist=(0, 0, 0), clav=(0, 0, 0)),
                  armL=dict(side_deg=14, fwd=36, twist=40, elbow=104, wrist=(0, 0, 0), clav=(0, 0, 0)),
                  fingR=dict(curl=0.55, thumb=0.2), fingL=dict(curl=0.5, thumb=0.3))
SIT_FLOOR = dict(root=dict(loc=(0, 0.02, -0.80), rot=(0, 0, 0)),
                 legL=dict(flex=86, abd=8, twist=0, knee=8, ankle=-18), legR=dict(flex=86, abd=8, twist=0, knee=8, ankle=-18))
SIT_CROSS = dict(root=dict(loc=(0, 0.02, -0.80), rot=(0, 0, 0)),
                 legL=dict(flex=78, abd=42, twist=38, knee=128, ankle=10), legR=dict(flex=78, abd=42, twist=38, knee=128, ankle=10))

C_PHONE = P(head=dict(nod=24, turn=0, tilt=0), spine=dict(bend=6), face=F_BORED, **PHONE_ARMS)
C_PHONE_B = P(head=dict(nod=27, turn=3, tilt=-2), spine=dict(bend=7),
              face=dict(F_BORED, mouthSmileLeft=0.2), **dict(PHONE_ARMS, armL=dict(side_deg=14, fwd=34, twist=40, elbow=108)))
C_SIT_PHONE = P(spine=dict(bend=10), head=dict(nod=22), face=F_BORED, **SIT_FLOOR, **PHONE_ARMS)
C_SIT_SQUISH = P(spine=dict(bend=4), head=dict(nod=4), face=dict(browInnerUp=0.5, eyeWideLeft=0.4, eyeWideRight=0.4),
                 **SIT_FLOOR, **PHONE_ARMS)
C_SHOCK_GROUND = P(root=dict(loc=(0, 0.06, -0.80), rot=(-8, 0, 0)), spine=dict(bend=-10), head=dict(nod=-6),
                   legL=dict(flex=80, abd=16, knee=10, ankle=-15), legR=dict(flex=76, abd=16, knee=14, ankle=-15),
                   armL=dict(side_deg=26, fwd=-38, elbow=8), armR=dict(side_deg=40, fwd=30, twist=20, elbow=70),
                   fingL=dict(curl=0.1), fingR=dict(curl=0.55, thumb=0.2), jaw=14, face=F_SHOCK)
C_RIDE_UP = P(spine=dict(bend=0), head=dict(nod=-12), face=dict(F_SHOCK), jaw=8, **SIT_FLOOR,
              **dict(PHONE_ARMS, armL=dict(side_deg=55, fwd=10, elbow=20)))
C_FLY_A = P(spine=dict(bend=-15), head=dict(nod=-15),
            armL=dict(side_deg=150, fwd=10, elbow=25), armR=dict(side_deg=150, fwd=-10, elbow=30),
            legL=dict(flex=35, abd=25, knee=60), legR=dict(flex=-10, abd=25, knee=40),
            fingL=dict(curl=0.05), fingR=dict(curl=0.05), jaw=16, face=F_SHOCK)
C_FLY_B = P(spine=dict(bend=10, twist=10), head=dict(nod=5),
            armL=dict(side_deg=120, fwd=40, elbow=50), armR=dict(side_deg=165, fwd=-20, elbow=15),
            legL=dict(flex=60, abd=15, knee=90), legR=dict(flex=20, abd=30, knee=20),
            fingL=dict(curl=0.05), fingR=dict(curl=0.05), jaw=16, face=F_SHOCK)
C_SPLAT = P(spine=dict(bend=0), head=dict(nod=0, turn=0),
            armL=dict(side_deg=135, fwd=0, elbow=10), armR=dict(side_deg=135, fwd=0, elbow=10),
            legL=dict(flex=0, abd=22, knee=5), legR=dict(flex=0, abd=22, knee=5),
            fingL=dict(curl=0.0, thumb=0.0), fingR=dict(curl=0.0, thumb=0.0),
            face=dict(eyeBlinkLeft=1.0, eyeBlinkRight=1.0, mouthPucker=0.8, browInnerUp=0.6))
C_SLUMP = P(root=dict(loc=(0, 0.02, -0.80), rot=(0, 0, 0)), spine=dict(bend=20), head=dict(nod=25, tilt=12),
            legL=dict(flex=80, abd=18, knee=20, ankle=-10), legR=dict(flex=70, abd=18, knee=30, ankle=-10),
            armL=dict(side_deg=25, fwd=5, elbow=10), armR=dict(side_deg=25, fwd=5, elbow=10),
            face=dict(eyeBlinkLeft=0.8, eyeBlinkRight=0.6, mouthFunnel=0.4))
C_SIT_CROSS = P(spine=dict(bend=4), head=dict(nod=14, tilt=-4), face=dict(F_BORED, mouthSmileLeft=0.25),
                **SIT_CROSS, **PHONE_ARMS)
C_SIT_ARMS = P(spine=dict(bend=-2), head=dict(nod=-4, tilt=5), face=F_SMUG, **SIT_CROSS,
               armL=dict(side_deg=14, fwd=28, twist=60, elbow=118), armR=dict(side_deg=14, fwd=34, twist=55, elbow=112),
               fingR=dict(curl=0.55, thumb=0.2))
C_GRABBED = P(spine=dict(bend=-6), head=dict(nod=-8, turn=-25), jaw=10, face=F_SHOCK, **SIT_CROSS,
              armR=dict(side_deg=20, fwd=60, twist=10, elbow=40), armL=dict(side_deg=30, fwd=20, elbow=40),
              fingR=dict(curl=0.2), fingL=dict(curl=0.2))
C_LEAP = P(spine=dict(bend=25), head=dict(nod=-25),
           armL=dict(side_deg=15, fwd=165, elbow=10), armR=dict(side_deg=15, fwd=170, elbow=10),
           legL=dict(flex=-25, abd=8, knee=40), legR=dict(flex=-10, abd=8, knee=20),
           fingL=dict(curl=0.15), fingR=dict(curl=0.15), jaw=6, face=dict(eyeWideLeft=0.8, eyeWideRight=0.8, browInnerUp=0.6))
C_BOUNCE_UP = P(spine=dict(bend=-6), head=dict(nod=-12),
                armL=dict(side_deg=150, fwd=15, elbow=25), armR=dict(side_deg=150, fwd=15, elbow=25),
                legL=dict(flex=55, abd=10, knee=95, ankle=10), legR=dict(flex=55, abd=10, knee=95, ankle=10),
                fingL=dict(curl=0.1), fingR=dict(curl=0.1), jaw=6, face=F_HAPPY)
C_BOUNCE_LAND = P(root=dict(loc=(0, 0, -0.26), rot=(0, 0, 0)), spine=dict(bend=12), head=dict(nod=0),
                  armL=dict(side_deg=70, fwd=20, elbow=40), armR=dict(side_deg=70, fwd=20, elbow=40),
                  legL=dict(flex=55, abd=12, knee=95, ankle=40), legR=dict(flex=55, abd=12, knee=95, ankle=40),
                  fingL=dict(curl=0.2), fingR=dict(curl=0.2), face=F_HAPPY)

# YOU (new actions)
PUMP_UP = P(spine=dict(bend=8), head=dict(nod=10), legR=dict(flex=48, abd=6, knee=72, ankle=20),
            legL=dict(flex=0, abd=4, knee=4), armL=dict(side_deg=35, fwd=30, elbow=80), armR=dict(side_deg=35, fwd=30, elbow=80),
            fingL=dict(curl=0.9, thumb=0.7), fingR=dict(curl=0.9, thumb=0.7), face=F_EFFORT)
PUMP_DOWN = P(spine=dict(bend=12), head=dict(nod=14), legR=dict(flex=22, abd=6, knee=26, ankle=4),
              legL=dict(flex=0, abd=4, knee=8), armL=dict(side_deg=30, fwd=10, elbow=95), armR=dict(side_deg=30, fwd=10, elbow=95),
              fingL=dict(curl=0.9, thumb=0.7), fingR=dict(curl=0.9, thumb=0.7), face=F_SNEAKY)
DRAG_BASE = P(spine=dict(bend=28), head=dict(nod=-10),
              armL=dict(side_deg=10, fwd=62, twist=20, elbow=20), armR=dict(side_deg=10, fwd=62, twist=20, elbow=20),
              fingL=dict(curl=0.9, thumb=0.7), fingR=dict(curl=0.9, thumb=0.7), face=F_EFFORT)
WINCE = P(**CROUCH_LEGS, spine=dict(bend=4, lower=6), head=dict(nod=10, turn=-18, tilt=8),
          armL=dict(side_deg=18, fwd=40, twist=30, elbow=110), armR=dict(side_deg=18, fwd=40, twist=30, elbow=110),
          fingL=dict(curl=0.75, thumb=0.5), fingR=dict(curl=0.75, thumb=0.5), jaw=3, face=F_WINCE)
SNEAK_A = P(spine=dict(bend=32), head=dict(nod=-18),
            armL=dict(side_deg=28, fwd=70, twist=-20, elbow=100), armR=dict(side_deg=28, fwd=70, twist=-20, elbow=100),
            legL=dict(flex=40, abd=8, knee=60, ankle=-10), legR=dict(flex=5, abd=8, knee=40, ankle=-30),
            root=dict(loc=(0, 0, -0.14), rot=(0, 0, 0)), fingL=dict(curl=0.3), fingR=dict(curl=0.3), face=F_SNEAKY)
SNEAK_B = P(spine=dict(bend=32), head=dict(nod=-18),
            armL=dict(side_deg=28, fwd=72, twist=-20, elbow=98), armR=dict(side_deg=28, fwd=68, twist=-20, elbow=102),
            legL=dict(flex=5, abd=8, knee=40, ankle=-30), legR=dict(flex=40, abd=8, knee=60, ankle=-10),
            root=dict(loc=(0, 0, -0.14), rot=(0, 0, 0)), fingL=dict(curl=0.3), fingR=dict(curl=0.3), face=F_SNEAKY)
GRAB = P(spine=dict(bend=30), head=dict(nod=-10),
         armR=dict(side_deg=18, fwd=70, twist=10, elbow=15), armL=dict(side_deg=30, fwd=40, elbow=80),
         legL=dict(flex=30, knee=40, ankle=10), legR=dict(flex=-10, knee=30, ankle=-20),
         root=dict(loc=(0, 0, -0.10), rot=(0, 0, 0)), fingR=dict(curl=0.85, thumb=0.6), face=F_SNEAKY)
WATCH_BINOC = P(spine=dict(bend=-2), head=dict(nod=-4),
                armL=dict(side_deg=16, fwd=86, twist=42, elbow=128), armR=dict(side_deg=16, fwd=86, twist=42, elbow=128),
                fingL=dict(curl=0.75, thumb=0.5), fingR=dict(curl=0.75, thumb=0.5), face=F_GRIN)
WATCH_BINOC_B = P(spine=dict(bend=-4, twist=4), head=dict(nod=-6, turn=4),
                  armL=dict(side_deg=17, fwd=88, twist=42, elbow=126), armR=dict(side_deg=15, fwd=85, twist=42, elbow=129),
                  fingL=dict(curl=0.75, thumb=0.5), fingR=dict(curl=0.75, thumb=0.5), face=F_GRIN)
