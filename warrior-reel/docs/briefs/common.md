You are part of a team producing a ~60 s vertical (1080x1920) animated Instagram Reel, "The Warrior Who Couldn't Forgive":
a medieval knight sits by a river gripping his sword, consumed by a wish for revenge; Jesus sits with him and teaches that
true strength is ruling your anger; the knight lowers his sword (tip to the ground), and they end standing side by side in
warm golden sunlight. Everything is rendered procedurally with Three.js r169 in headless Chromium (software WebGL).

Project root: /home/user/my-first-website./warrior-reel  (Node project; three.js in node_modules; run commands from the project root).
READ FIRST: /home/user/my-first-website./warrior-reel/docs/DESIGN.md (layout, axes, APIs, style, perf budget, file ownership) and the core files it names
(src/core/rig.js, src/core/util.js, src/core/stage.js, src/test/studio_lib.js, src/test/studio.js, render/shoot.mjs).
Reference video frames (the look to match and surpass): /tmp/claude-0/-home-user-my-first-website-/8e87b992-8f6b-5beb-bf81-e714aaa05691/scratchpad/ref/full_2.png, full_8.png, full_14.png, full_20.png, full_25.png,
full_28.png, full_34.png, full_41.png, full_46.png, full_58.png, full_63.png (view them with the Read tool).
Timing truth: /home/user/my-first-website./warrior-reel/timeline/timeline.json.

Rules:
- Only create/edit files you own (see DESIGN.md "File ownership"). Never edit src/core/*, src/boot.js, render/*.mjs.
- Deterministic: no Math.random()/Date at render time (use rng/noise1 from src/core/util.js).
- Iterate VISUALLY: render stills with node render/shoot.mjs (see DESIGN.md "Tools"), Read the PNGs, fix, repeat. Do at least
  4 render-inspect-fix rounds. Look critically at silhouettes, proportions, joints, interpenetration, materials, readability
  in a 9:16 frame, and similarity to the reference style. Write previews under out/previews/<your-module>/.
- Software WebGL is slow-ish: prefer 540x960 previews; keep the scene within the perf budget.
- Your final answer must be a concise report: files written, exported API (exact names/signatures), how to pose/use it,
  key preview image paths (the 3-4 best ones), measured triangle count / draw calls if relevant, and known issues.
