# Work log — Minecraft Bedrock graphics add-on

- Target device: realme RMX3612, Mali-G57 MC2, Android 14, 2408x1080
- Target game: Minecraft Bedrock beta 1.21.0.26 (RenderDragon, OpenGLES ESSL_310)
- **Session start:** 2026-10-08 02:12:02Z (epoch 1791425522)
- **Deadline (start + 3h):** 2026-10-08 05:12:02Z

## Checkpoints
- 2026-10-08 02:12:02Z | elapsed 00:00:00 | 03:00:00 left — T0 — clock started
- 2026-10-08 02:20:10Z | elapsed 00:08:08 | 02:51:52 left — Research: vanilla 1.21.0.26 files cloned; fog/biomes_client/subpack/UI-modifications formats verified from official docs + web
- 2026-10-08 02:31:26Z | elapsed 00:19:24 | 02:40:36 left — v0.1 built: atmosphere+sky+water+overlay+icon, validator written
- 2026-10-08 02:34:43Z | elapsed 00:22:41 | 02:37:19 left — Texture grading (blocks+items, relief shading, ore glints) integrated; v0.2 built
- 2026-10-08 02:38:32Z | elapsed 00:26:30 | 02:33:30 left — v0.2 committed+pushed (graded textures, validator clean)
- 2026-10-08 02:46:36Z | elapsed 00:34:34 | 02:25:26 left — Ambient FX pack + consistency pass drafted; waiting on 2 reviewers
- 2026-10-08 02:49:12Z | elapsed 00:37:10 | 02:22:50 left — TGA writer verified vs independent decoder (164 files identical); sandbox full build passes; awaiting reviewers
- 2026-10-08 02:54:52Z | elapsed 00:42:50 | 02:17:10 left — KEY FIX: fogs now use own hg: identifiers + hg_*.json names (Bedrock Wiki: vanilla fogs cannot be overwritten); partial terrain_texture.json + UI merge confirmed by wiki 'Overwriting assets'
- 2026-10-08 03:01:11Z | elapsed 00:49:09 | 02:10:51 left — Docs (README, asset preview script, how-to-verify) done; ambient FX + consistency pass built in sandbox; waiting for reviewers
- 2026-10-08 03:03:36Z | elapsed 00:51:34 | 02:08:26 left — Fixed colour-washing: gamut mapping now walks back along the edit (never desaturates), OKLab delta cap 0.085, warm split-tone only on neutral texels (found via numeric outlier scan)
- 2026-10-08 03:09:53Z | elapsed 00:57:51 | 02:02:09 left — MS docs confirm: fog identifiers need a non-minecraft namespace and must be unique (our hg: ids OK); added restart-after-preset note; version bumped to 1.1.0; 3 reviewers running
- 2026-10-08 03:13:06Z | elapsed 01:01:04 | 01:58:56 left — Visual-QA reviewer done: fixed neutral-white/black split-tone, tint-mask TGAs (grass_side), ore glint misfires, flow-water streak direction, still-water glint lattice, skip lists, moon contrast, item grade; verified in sandbox
- 2026-10-08 03:19:47Z | elapsed 01:07:45 | 01:52:15 left — Worklog tidied (checkpoints grouped above the decisions section); format + ambient reviewers still running
- 2026-10-08 03:23:07Z | elapsed 01:11:05 | 01:48:55 left — Validator mutation-tested (6/6 injected defects caught) + hardened; entity pass leaves pure-grey tint masks bit-exact; 0 byte-identical vanilla files; waiting on format+ambient+README reviewers
- 2026-10-08 03:26:16Z | elapsed 01:14:14 | 01:45:46 left — v1.1.0 rebuilt in repo (validator 0 errors, schemas ok, 2170 textures vs vanilla ok) and pushed; reviewers (format, ambient, README) still running
- 2026-10-08 03:29:54Z | elapsed 01:17:52 | 01:42:08 left — Fresh-clone rebuild reproduces the committed pack exactly (2512 files, 0 diffs); raw download links verified; visual-QA re-check + format/ambient/README reviewers running
- 2026-10-08 03:38:09Z | elapsed 01:26:07 | 01:33:53 left — Format review (no blockers) applied: short preset names, 5 vanilla-identical textures dropped (build + validator now enforce it), version 1.1.1; rebuilt + validated; ambient / README / visual-QA reviewers still running
- 2026-10-08 03:42:56Z | elapsed 01:30:54 | 01:29:06 left — Ambient FX review (no blockers) applied: is_in_ui guard, plankton only in water, alpha clamp, boxes above feet, ambient pack 1.0.1; rebuilt + validated + pushed; README + visual-QA re-check reviewers still running
- 2026-10-08 03:45:21Z | elapsed 01:33:19 | 01:26:41 left — Visual-QA re-check (no regressions) follow-ups applied: warm split-tone fades earlier, leather/wolf/horse dye masks untouched, grass-side tint fringe gets no relief (dL .015 = grass_top .014); version 1.1.2; rebuilt + validated; README auditor still running
- 2026-10-08 03:47:33Z | elapsed 01:35:31 | 01:24:29 left — Packaging made deterministic (fixed zip timestamps: two builds are byte-identical, fresh-clone pack tree reproduces exactly); README counts corrected; README auditor still running
- 2026-10-08 03:49:20Z | elapsed 01:37:18 | 01:22:42 left — README rewritten after the phone-user audit (honest 'not tested' box, direct links for all 4 files, install/troubleshooting fixes, corrected legal wording); all four reviewers done

## Key decisions (why the pack looks the way it does)

* **Resource pack only.** On 1.21.0.26 / Android a normal add-on cannot replace RenderDragon `.material.bin` shaders, so
  "shader-like" is built from what packs *can* change: fog, water, sky bodies, clouds, weather, colour maps, textures, HUD.
* **Exact reference data.** Mojang's `bedrock-samples` tag `v1.21.0.26-preview` (the very build on the phone) is the source for every derived file.
* **Fogs use their own `hg:` identifiers** and `hg_*.json` file names (Bedrock Wiki, "Overwriting assets": vanilla fogs cannot be
  overwritten); Lite / Standard / Ultra each get unique ids so no registry can keep "the first one" and silently ignore a preset.
* **Partial `terrain_texture.json`** (grass side overlay colours only) and a partial `ui/hud_screen.json` are safe because
  reference files and UI files merge per key (same wiki page).
* **Colour grading in OKLab with "walk-back" gamut mapping** + a hard cap on how far any texel may move: saturated yellows (gold, sponge)
  stay saturated, marker textures such as `entity/char.png` are untouched. (Found by a numeric outlier scan, not by eye.)
* **TGA files** are re-written with the same origin bit as the vanilla file; verified against an independent decoder (164/164 identical).
* **Ambient FX is a separate optional pack** because it must replace the player client entity file (version-bound).
* Not shipped: dynamic torch light (world-modifying scripts, untestable here).
* **No redundant Mojang copies.** A texture that comes out pixel-identical to Mojang's file is dropped by `build.prune_unchanged`
  (the validator fails if one slips through); near-grey dye masks (leather / wolf / horse armour) are left to the game's own files.
* **Reproducible packaging.** Zip members carry a fixed timestamp and mode, so two builds give byte-identical `.mcaddon` / `.mcpack` files
  (a download can be verified by checksum).
* **Independent review rounds** (format/docs, Ambient FX, visual QA twice, README audit for a phone user) found no blockers in the final
  state; every finding that could be acted on without a device is applied (see the checkpoints above). What can only be settled on a phone
  is listed in the README under "Honest limits".
