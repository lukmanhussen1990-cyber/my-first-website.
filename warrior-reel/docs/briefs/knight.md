YOUR MODULE: the KNIGHT and his SWORD — src/characters/knight.js (+ optional src/characters/knight_*.js) and test scene src/test/knight.js.
Build buildKnight() per DESIGN.md "Character module API": a big, imposing armoured knight (~1.92 m with helmet; use Humanoid dims
roughly shoulderW 0.46, upperArm 0.31, foreArm 0.28, thigh 0.47, shin 0.45) in the same visual family as the reference knight
(see full_8.png, full_20.png, full_28.png, full_46.png): weathered silver plate (subtle pixel-noise grime, scratches, darker
crevices), closed armet/great-helm with visor eye-slits and breaths and a ridge, gorget, layered pauldrons (lames) with brown
leather straps and buckles, breastplate with a central ridge, brown leather belt with a brass buckle, faulds/tassets, dark
padded/mail under-layer visible at joints, vambraces, couters, DARK LEATHER GAUNTLETS (as in reference) whose right fist really
closes around the sword grip, cuisses, poleyns, greaves, sabatons. A DARK CAPE (deep charcoal-navy, slightly frayed hem) from the
shoulders: hangs behind when standing; when seated it drapes back over the rock behind him without clipping into the body.
Armour pieces must follow the bones (parent to bones) with no visible gaps or gross interpenetration in the poses below.

The SWORD (separate Group, see DESIGN.md): realistic arming sword, steel blade with a fuller, slightly bright specular edge,
cross-guard, dark leather grip with wire/strip wrapping, wheel pommel. Export SWORD constants, GRIP_R and POMMEL_L.
ALSO export a helper the integrator will use every frame:
  solveSwordHands(knight, swordPos /*Vector3 world*/, swordQuat /*Quaternion world*/, { left: 'pommel' | 'free' | 'knee', leftTarget?: Vector3 })
which places the sword at that transform and uses rig.armIK + rig.setWorldQuat so the right fist holds the grip (and, with
left:'pommel', the left palm rests on the pommel; with 'knee', the left hand rests on the left knee/thigh). Make sure the
elbow poles look natural for each case.
Also export POSES: degree poses (DESIGN.md pose format) at least: seated (hipsPos so he sits on a seat top of y=0.48, slight
forward hunch, tense), seatedRelaxed (shoulders dropped, head slightly bowed, spine more upright/at peace), stand (heroic but calm).
And legTargetsSeated(knight) giving foot targets (world) for rig.legIK so feet are planted naturally in front of the rock.

Test scene src/test/knight.js params: pose = sit_grip | sit_rest | stand_down. Include a placeholder rock (seat top 0.48, ~0.75 m
wide) for the seated poses. In sit_grip the right hand grips the sword with the blade pointing up and forward/outward to his right
(away from his left side, where Jesus will sit), tilted ~25-35 deg from vertical, clearly visible; in sit_rest the sword stands
point-down on the ground in front of him (tip touching ground ~0.35 m in front of his knees) with both hands stacked on the hilt;
in stand_down he stands holding the sword point-down in his right hand at his side, tip resting on the ground slightly forward.
Verify from many angles (az 0, 30, -40, 90, 180; close-ups of the fist on the grip with dist ~0.6; helmet close-up) and also
grip=1 (squeezing) vs grip=0.
