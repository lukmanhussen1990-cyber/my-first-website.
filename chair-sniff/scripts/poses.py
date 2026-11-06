"""Pose library (Mixamo-style stiff body poses, no facial acting). See rigpose.py for conventions."""
from rigpose import mirror

A = "aim"; R = "rot"
ARMS_DOWN = {"LeftArm": (A, (0.13, 0.03, -1)), "LeftForeArm": (A, (0.05, -0.12, -1)), "LeftHand": (A, (0.02, -0.1, -1)),
             "RightArm": (A, (-0.13, 0.03, -1)), "RightForeArm": (A, (-0.05, -0.12, -1)), "RightHand": (A, (-0.02, -0.1, -1))}
STAND = dict(ARMS_DOWN)
LEGS_SIT = {"LeftUpLeg": (A, (0.1, -1, -0.04)), "LeftLeg": (A, (0.03, 0.08, -1)), "LeftFoot": (A, (0, -1, -0.35)),
            "RightUpLeg": (A, (-0.1, -1, -0.04)), "RightLeg": (A, (-0.03, 0.08, -1)), "RightFoot": (A, (0, -1, -0.35))}
SIT = dict(LEGS_SIT, **{"Spine": (R, (4, 0, 0)),
           "LeftArm": (A, (0.12, -0.35, -1)), "LeftForeArm": (A, (0.0, -1, -0.25)), "LeftHand": (A, (0, -1, -0.4)),
           "RightArm": (A, (-0.12, -0.35, -1)), "RightForeArm": (A, (0.0, -1, -0.25)), "RightHand": (A, (0, -1, -0.4))})
SIT_TYPE = dict(SIT, **{"LeftArm": (A, (0.15, -0.55, -1)), "LeftForeArm": (A, (-0.15, -1, 0.08)), "LeftHand": (A, (-0.1, -1, 0)),
                        "RightArm": (A, (-0.15, -0.55, -1)), "RightForeArm": (A, (0.15, -1, 0.08)), "RightHand": (A, (0.1, -1, 0)),
                        "Spine": (R, (8, 0, 0)), "Head": (R, (8, 0, 0))})
SIT_GLANCE = dict(SIT, **{"Neck": (R, (0, 0, -25)), "Head": (R, (-3, 0, -30)), "Spine2": (R, (0, 0, -10))})
SIT_GLANCE_L = dict(SIT, **{"Neck": (R, (0, 0, 25)), "Head": (R, (-3, 0, 30)), "Spine2": (R, (0, 0, 10))})
SIT_HEAVY = dict(LEGS_SIT, **{"Spine": (R, (-6, 0, 0)), "Head": (R, (-8, 0, 0)),
                 "LeftArm": (A, (0.8, -0.2, -0.6)), "LeftForeArm": (A, (0.7, -0.4, -0.4)),
                 "RightArm": (A, (-0.8, -0.2, -0.6)), "RightForeArm": (A, (-0.7, -0.4, -0.4))})
# half way between standing and sitting: hips back, torso forward
SIT_MID = {"Hips": (R, (28, 0, 0)), "Spine": (R, (6, 0, 0)), "Head": (R, (-12, 0, 0)),
           "LeftUpLeg": (A, (0.1, -0.75, -0.65)), "LeftLeg": (A, (0.03, 0.3, -1)), "LeftFoot": (A, (0, -1, -0.35)),
           "RightUpLeg": (A, (-0.1, -0.75, -0.65)), "RightLeg": (A, (-0.03, 0.3, -1)), "RightFoot": (A, (0, -1, -0.35)),
           "LeftArm": (A, (0.18, -0.5, -1)), "LeftForeArm": (A, (0.05, -0.8, -0.6)),
           "RightArm": (A, (-0.18, -0.5, -1)), "RightForeArm": (A, (-0.05, -0.8, -0.6))}
BEND = {"Hips": (R, (55, 0, 0)), "Spine": (R, (14, 0, 0)), "Spine1": (R, (10, 0, 0)), "Spine2": (R, (6, 0, 0)),
        "Neck": (R, (-10, 0, 0)), "Head": (R, (-5, 0, 0)),
        "LeftUpLeg": (A, (0.06, 0.3, -1)), "LeftLeg": (A, (0.04, -0.3, -1)), "LeftFoot": (A, (0, -1, -0.3)),
        "RightUpLeg": (A, (-0.06, 0.3, -1)), "RightLeg": (A, (-0.04, -0.3, -1)), "RightFoot": (A, (0, -1, -0.3)),
        "LeftArm": (A, (0.25, -0.5, -1)), "LeftForeArm": (A, (0.1, -0.5, -1)), "LeftHand": (A, (0, -0.4, -1)),
        "RightArm": (A, (-0.25, -0.5, -1)), "RightForeArm": (A, (-0.1, -0.5, -1)), "RightHand": (A, (0, -0.4, -1))}
# deep bend + bent knees: nose goes down to seat height; hands on knees
SNIFF = {"Hips": (R, (62, 0, 0)), "Spine": (R, (16, 0, 0)), "Spine1": (R, (12, 0, 0)), "Spine2": (R, (8, 0, 0)),
         "Neck": (R, (-6, 0, 0)), "Head": (R, (6, 0, 0)),
         "LeftUpLeg": (A, (0.12, -0.55, -1)), "LeftLeg": (A, (0.05, 0.55, -1)), "LeftFoot": (A, (0, -1, -0.3)),
         "RightUpLeg": (A, (-0.12, -0.55, -1)), "RightLeg": (A, (-0.05, 0.55, -1)), "RightFoot": (A, (0, -1, -0.3)),
         "LeftArm": (A, (0.25, -0.55, -1)), "LeftForeArm": (A, (0.05, -0.3, -1)), "LeftHand": (A, (0, -0.4, -1)),
         "RightArm": (A, (-0.25, -0.55, -1)), "RightForeArm": (A, (-0.05, -0.3, -1)), "RightHand": (A, (0, -0.4, -1))}
SNIFF_IN = dict(SNIFF, **{"Head": (R, (12, 0, 0)), "Neck": (R, (0, 0, 0))})   # head pushed further down (inhale)
SNIFF_HAPPY = dict(SNIFF, **{"Spine2": (R, (8, 6, 0)), "Head": (R, (4, 10, 0)),
                             "RightArm": (A, (-0.5, -0.3, 0.2)), "RightForeArm": (A, (-0.1, -0.2, 1)), "RightHand": (A, (0, 0, 1))})
RECOIL = {"Hips": (R, (-6, 0, 0)), "Spine": (R, (-10, 0, 0)), "Spine1": (R, (-8, 0, 0)), "Neck": (R, (-8, 0, 0)), "Head": (R, (-18, 0, 8)),
          "LeftUpLeg": (A, (0.08, 0.35, -1)), "LeftLeg": (A, (0.06, 0.4, -1)), "LeftFoot": (A, (0, -1, -0.3)),
          "RightUpLeg": (A, (-0.08, -0.15, -1)), "RightLeg": (A, (-0.06, -0.05, -1)),
          "LeftArm": (A, (0.7, -0.6, 0.2)), "LeftForeArm": (A, (-0.2, -0.5, 1)), "LeftHand": (A, (-0.1, -0.3, 1)),
          "RightArm": (A, (-0.7, -0.6, 0.2)), "RightForeArm": (A, (0.2, -0.5, 1)), "RightHand": (A, (0.1, -0.3, 1))}
RECOIL_BIG = {"Hips": (R, (-14, 0, 0)), "Spine": (R, (-16, 0, 0)), "Spine1": (R, (-12, 0, 0)), "Neck": (R, (-12, 0, 0)), "Head": (R, (-25, 0, -12)),
              "LeftUpLeg": (A, (0.15, -0.55, -0.8)), "LeftLeg": (A, (0.1, 0.2, -1)), "LeftFoot": (A, (0, -1, 0.2)),
              "RightUpLeg": (A, (-0.08, 0.2, -1)), "RightLeg": (A, (-0.06, 0.25, -1)),
              "LeftArm": (A, (0.8, -0.2, 0.7)), "LeftForeArm": (A, (0.3, -0.2, 1)), "LeftHand": (A, (0.1, 0, 1)),
              "RightArm": (A, (-0.8, -0.2, 0.7)), "RightForeArm": (A, (-0.3, -0.2, 1)), "RightHand": (A, (-0.1, 0, 1))}
FIST = dict(STAND, **{"RightArm": (A, (-0.3, -0.15, 1)), "RightForeArm": (A, (-0.05, -0.1, 1)), "RightHand": (A, (0, 0, 1)),
                      "Spine": (R, (-4, 0, -6)), "Head": (R, (-10, 0, 0)),
                      "LeftArm": (A, (0.3, 0.1, -1)), "LeftForeArm": (A, (-0.25, -0.6, -0.4))})
FIST_DOWN = dict(STAND, **{"RightArm": (A, (-0.25, -0.35, -0.7)), "RightForeArm": (A, (0.1, -0.5, 1)), "RightHand": (A, (0, -0.2, 1)),
                           "Spine": (R, (6, 0, 4)), "Head": (R, (5, 0, 0))})
WALK_C = {"LeftUpLeg": (A, (0.04, -0.42, -1)), "LeftLeg": (A, (0.04, -0.38, -1)), "LeftFoot": (A, (0, -1, 0.05)),
          "RightUpLeg": (A, (-0.04, 0.38, -1)), "RightLeg": (A, (-0.04, 0.62, -1)), "RightFoot": (A, (0, -0.6, -1)),
          "LeftArm": (A, (0.13, 0.28, -1)), "LeftForeArm": (A, (0.05, 0.05, -1)), "LeftHand": (A, (0.02, 0.0, -1)),
          "RightArm": (A, (-0.13, -0.3, -1)), "RightForeArm": (A, (-0.05, -0.55, -1)), "RightHand": (A, (-0.02, -0.3, -1)),
          "Spine": (R, (3, 0, 4))}
WALK_P = {"LeftUpLeg": (A, (0.04, 0.02, -1)), "LeftLeg": (A, (0.04, 0.05, -1)), "LeftFoot": (A, (0, -1, -0.3)),
          "RightUpLeg": (A, (-0.04, -0.28, -1)), "RightLeg": (A, (-0.04, 0.45, -1)), "RightFoot": (A, (0, -1, -0.5)),
          "LeftArm": (A, (0.13, 0.0, -1)), "LeftForeArm": (A, (0.05, -0.15, -1)), "LeftHand": (A, (0.02, -0.1, -1)),
          "RightArm": (A, (-0.13, 0.0, -1)), "RightForeArm": (A, (-0.05, -0.15, -1)), "RightHand": (A, (-0.02, -0.1, -1)),
          "Spine": (R, (3, 0, 0))}
WALK = [WALK_C, WALK_P, mirror(WALK_C), mirror(WALK_P)]
SNEAK_C = dict(WALK_C, **{"Hips": (R, (18, 0, 0)), "Spine": (R, (8, 0, 4)), "Head": (R, (-14, 0, 0)),
                          "LeftArm": (A, (0.3, -0.4, -0.9)), "LeftForeArm": (A, (0.1, -1, -0.1)),
                          "RightArm": (A, (-0.3, -0.4, -0.9)), "RightForeArm": (A, (-0.1, -1, -0.1))})
SNEAK_P = dict(WALK_P, **{"Hips": (R, (18, 0, 0)), "Spine": (R, (8, 0, 0)), "Head": (R, (-14, 0, 0)),
                          "LeftArm": (A, (0.3, -0.4, -0.9)), "LeftForeArm": (A, (0.1, -1, -0.1)),
                          "RightArm": (A, (-0.3, -0.4, -0.9)), "RightForeArm": (A, (-0.1, -1, -0.1))})
SNEAK = [SNEAK_C, SNEAK_P, mirror(SNEAK_C), mirror(SNEAK_P)]
SPRAY = dict(STAND, **{"Spine": (R, (12, 0, 0)), "Spine1": (R, (6, 0, 0)), "Head": (R, (18, 0, 0)),
                       "RightArm": (A, (-0.08, -1, -0.75)), "RightForeArm": (A, (0.2, -1, -0.55)), "RightHand": (A, (0.2, -1, -0.15))})
HOLD = dict(STAND, **{"Spine": (R, (6, 0, 0)), "Head": (R, (12, 0, 0)),
                      "LeftArm": (A, (0.15, -1, -0.55)), "LeftForeArm": (A, (-0.35, -1, 0.0)), "LeftHand": (A, (-0.4, -1, 0)),
                      "RightArm": (A, (-0.15, -1, -0.55)), "RightForeArm": (A, (0.35, -1, 0.0)), "RightHand": (A, (0.4, -1, 0))})
HOLD_LOW = dict(HOLD, **{"Hips": (R, (35, 0, 0)), "Spine": (R, (12, 0, 0)), "Head": (R, (5, 0, 0)),
                         "LeftUpLeg": (A, (0.06, 0.1, -1)), "RightUpLeg": (A, (-0.06, 0.1, -1)),
                         "LeftArm": (A, (0.15, -0.8, -1)), "LeftForeArm": (A, (-0.3, -1, -0.3)),
                         "RightArm": (A, (-0.15, -0.8, -1)), "RightForeArm": (A, (0.3, -1, -0.3))})
PUSH = dict(STAND, **{"Hips": (R, (15, 0, 0)), "Spine": (R, (6, 0, 0)), "Head": (R, (-10, 0, 0)),
                      "LeftArm": (A, (0.1, -1, -0.4)), "LeftForeArm": (A, (-0.05, -1, 0.1)),
                      "RightArm": (A, (-0.1, -1, -0.4)), "RightForeArm": (A, (0.05, -1, 0.1))})
PRESENT = dict(STAND, **{"LeftArm": (A, (1, -0.4, -0.5)), "LeftForeArm": (A, (1, -0.6, 0.1)), "LeftHand": (A, (1, -0.5, 0.2)),
                         "RightArm": (A, (-1, -0.4, -0.5)), "RightForeArm": (A, (-1, -0.6, 0.1)), "RightHand": (A, (-1, -0.5, 0.2)),
                         "Head": (R, (-6, 0, 0))})
PROUD = dict(STAND, **{"LeftArm": (A, (0.7, 0.15, -0.7)), "LeftForeArm": (A, (-0.6, -0.2, -0.3)), "LeftHand": (A, (-0.5, -0.2, -0.6)),
                       "RightArm": (A, (-0.7, 0.15, -0.7)), "RightForeArm": (A, (0.6, -0.2, -0.3)), "RightHand": (A, (0.5, -0.2, -0.6)),
                       "Spine": (R, (-5, 0, 0)), "Head": (R, (-8, 0, 0))})
# nose stuck: torso pulls back while the head stays down (neck stretched)
STUCK = dict(SNIFF, **{"Hips": (R, (48, 0, 0)), "Spine": (R, (8, 0, 0)), "Neck": (R, (18, 0, 0)), "Head": (R, (20, 0, 0)),
                       "LeftArm": (A, (0.5, 0.5, -0.6)), "LeftForeArm": (A, (0.6, 0.0, -0.6)),
                       "RightArm": (A, (-0.5, 0.5, -0.6)), "RightForeArm": (A, (-0.6, 0.0, -0.6))})
STUCK2 = dict(STUCK, **{"Hips": (R, (42, 0, 0)), "Spine": (R, (4, 0, 0)), "Neck": (R, (24, 0, 0)), "Head": (R, (24, 0, 0)),
                        "LeftArm": (A, (0.2, -0.9, 0.2)), "LeftForeArm": (A, (0.6, -0.4, 0.8)),
                        "RightArm": (A, (-0.2, -0.9, 0.2)), "RightForeArm": (A, (-0.6, -0.4, 0.8))})
PLACE = dict(SNIFF, **{"Hips": (R, (45, 0, 0)), "Head": (R, (20, 0, 0)),
                       "LeftArm": (A, (0.12, -1, -0.9)), "LeftForeArm": (A, (-0.25, -1, -0.5)), "LeftHand": (A, (-0.3, -1, -0.5)),
                       "RightArm": (A, (-0.12, -1, -0.9)), "RightForeArm": (A, (0.25, -1, -0.5)), "RightHand": (A, (0.3, -1, -0.5))})
SHOCK = dict(STAND, **{"Spine": (R, (-4, 0, 0)), "Head": (R, (-4, 0, 0)),
                       "LeftArm": (A, (0.4, -0.5, 0.4)), "LeftForeArm": (A, (-0.6, 0.0, 0.8)), "LeftHand": (A, (-0.4, 0, 1)),
                       "RightArm": (A, (-0.4, -0.5, 0.4)), "RightForeArm": (A, (0.6, 0.0, 0.8)), "RightHand": (A, (0.4, 0, 1))})
# lying on the back after the fall (used with the rig object rotated back 90 deg)
FALLEN = {"LeftUpLeg": (A, (0.3, -0.9, -0.3)), "LeftLeg": (A, (0.25, -0.3, -1)), "RightUpLeg": (A, (-0.3, -0.9, -0.3)),
          "RightLeg": (A, (-0.25, -0.3, -1)), "Head": (R, (20, 0, 10)),
          "LeftArm": (A, (1, 0.2, 0.2)), "LeftForeArm": (A, (1, -0.3, 0.4)),
          "RightArm": (A, (-1, 0.2, 0.2)), "RightForeArm": (A, (-1, -0.3, 0.4))}
SIT_LEAN = dict(LEGS_SIT, **{"Hips": (R, (35, 0, 0)), "Spine": (R, (16, 0, 0)), "Spine1": (R, (10, 0, 0)), "Head": (R, (6, 0, 0)),
                "LeftUpLeg": (A, (0.12, -1, 0.3)), "RightUpLeg": (A, (-0.12, -1, 0.3)),
                "LeftArm": (A, (0.3, -0.5, -1)), "LeftForeArm": (A, (0.1, -0.6, -1)),
                "RightArm": (A, (-0.3, -0.5, -1)), "RightForeArm": (A, (-0.1, -0.6, -1))})
SIT_ROLL = dict(LEGS_SIT, **{"Spine": (R, (-4, 0, 0)), "Head": (R, (2, 0, 0)),
                "LeftUpLeg": (A, (0.14, -1, -0.1)), "LeftLeg": (A, (0.05, -0.25, -1)),
                "RightUpLeg": (A, (-0.14, -1, -0.1)), "RightLeg": (A, (-0.05, 0.3, -1)),
                "LeftArm": (A, (0.25, -0.2, -1)), "LeftForeArm": (A, (0.05, -1, -0.2)),
                "RightArm": (A, (-0.25, -0.2, -1)), "RightForeArm": (A, (-0.05, -1, -0.2))})
# close-up variant: chin lifted so the face (not the top of the head) is seen next to the seat
SNIFF_CU = dict(SNIFF, **{"Neck": (R, (-22, 0, 0)), "Head": (R, (-30, 0, 0))})
SNIFF_CU_IN = dict(SNIFF, **{"Neck": (R, (-18, 0, 0)), "Head": (R, (-22, 0, 0))})
