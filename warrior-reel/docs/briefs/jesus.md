YOUR MODULE: JESUS — src/characters/jesus.js (+ optional src/characters/jesus_*.js) and test scene src/test/jesus.js.
Build buildJesus() per DESIGN.md "Character module API", matching the reference look (full_25.png, full_34.png, full_41.png,
full_58.png) but more refined: ~1.80 m, cream-white robe (soft pixel-dither texture, subtle folds via geometry/normal shading),
a RED sash over his right shoulder running diagonally across the chest to the left hip and hanging down, long sleeves with hands
visible, sandals with visible feet, warm skin, shoulder-length wavy brown hair with a centre part, full brown beard and moustache,
gentle eyebrows, kind dark eyes (with whites and a tiny catch-light), a defined nose. Stylised low-poly but appealing and
dignified — the face is seen in close-ups filling ~40% of a 9:16 frame, so it must read clearly and look kind and calm, never
creepy. MOUTH: setMouth(0..1) must show a visibly opening dark mouth (with hint of teeth at >0.6) beneath the moustache; test at
0, 0.4, 1. setBlink(0..1) closes the eyelids. Optional setEyes/setExpression.
The ROBE must look right standing, walking and seated: use a SkinnedMesh bound with rig.bindSkin (DESIGN.md) or another robust
approach; when seated the robe drapes over the thighs and falls from the knees to the ankles; when walking the hem swings and
the sandals show alternately. update(t, { seated, walkPhase }) for secondary motion (hem sway, hair sway).
Export POSES (DESIGN.md degree format): stand, sit (seat top y=0.44: hipsPos + spine), plus walkPose(phase /*0..1 per stride cycle*/)
returning a full degree pose for a calm walking cycle (stride ~0.62 m per step, root translation handled by integrator) and
gesture poses: openPalm (right hand raised in front at chest height, palm up, as when gently explaining), handOnHeart (right hand
to chest). Also export legTargetsSeated(jesus) for rig.legIK with feet planted naturally.
Test scene src/test/jesus.js params: pose = stand | walk (use walkPhase = t) | sit | gesture | face (close-up preset). Include a
placeholder seat (top 0.44). Check many angles (az 0, 35, -35, 90, 180), full body and face close-ups (ty ~1.62, dist ~0.7,
fov 30), mouth values, and walking phases 0, 0.25, 0.5, 0.75.
