## 3. How it works (so you can tune it)

| State | `minecraft:variant` | What happens |
|---|---|---|
| Sit | 0 | sits on the ground, hugging its knees, hands over its face, sobbing (cry sound). After 12–30 s it stands and walks. |
| Walk | 1 | upright, hunched, slow shuffle (≈2 blocks/s) and sobbing. After 8–20 s it sits again. |
| Scream | 2 | triggered: rooted in place, jaw wide open, arms spread, scream sound, **3–5 s** (random). |
| Run | 3 | rage sprint (movement 0.4 ≈ 17 blocks/s, much faster than a sprinting player), melee attack **300 damage**, breaks soft blocks. |

* **Trigger:** `minecraft:lookat` (the same engine gaze/line-of-sight test Endermen use, search radius 64, aimed at the head) with `set_target: true`. Whoever looks at it becomes its target; there is no `hurt_by_target` / `nearest_attackable_target`, so **other players and mobs are ignored**.
* **Back to calm:** when the target dies or is lost (`on_target_escape`, a `has_target == false` sensor, a target-health sensor, and the melee `on_kill`) the entity returns to *calm + sit*.
* **Tough:** 500 HP, `knockback_resistance` 1.0, `damage_sensor` multiplier ×0.1, no `minecraft:despawn`, plus `minecraft:persistent` → it never despawns.
* **Block breaking (soft blocks only):** two layers. (1) `minecraft:break_blocks` (same component the Ravager uses) with a list of leaves, logs/wood, planks, doors, trapdoors, fences/gates, glass/panes, wool, etc. (2) `scripts/main.js` clears the 3-wide × 3-high lane ahead of a *running* SCP-096 with `setblock … air destroy`, so the path can open. Both use allow-lists; **bedrock, obsidian, crying obsidian, reinforced deepslate, barriers, command/structure blocks, portals, chests and other containers, spawners, netherite and ancient debris are on a hard deny-list and are never touched.**
* **Script module:** `@minecraft/server` **1.11.0** (no beta needed). On 1.21.0 preview 26 some script members (`Block.typeId`, `Block.setType`, `World.gameRules`) are still Beta-only, so the script works without them (it identifies blocks through the item they drop, and if it cannot read the `mobGriefing` game rule it assumes it is on).
* **Sounds:** six original OGG files synthesised for this add-on (crying ×2, scream, rage screech, hurt, death). The scream plays once when it is triggered; crying plays from the sit/walk animations; the rage sound repeats while it runs.

## 4. How to test (about 10 minutes)

**Before you start:** Settings → **Creator** → *Content Log Settings* → turn on **Enable Content Log GUI** (and *Enable Content Log File*). Any red/yellow line that mentions `scp`, `SCP096`, `scp096` is a bug I want to see (screenshot it).

1. **Import + packs:** both packs import; the world lists them; the content log stays clean on world load.
2. **Egg:** inventory → search "SCP" and "096" → *SCP-096 Spawn Egg*, pale egg with dark spots. The entity name reads *SCP-096* (not a raw `entity.scp:...` key).
3. **Calm:** it sits, sobs (you hear crying nearby), and every 12–30 s stands and shuffles around, hunched, still sobbing. It does not attack. Run past it without looking at its head — nothing happens.
4. **Size/look:** tall (≈2.8 blocks), thin, pale white, long arms, no hair, white eyes, wide mouth.
5. **Trigger (Survival only!):** creative/spectator players do not set off this kind of gaze check, just like Endermen. Look at its head/face from a few blocks away. Expected: it freezes, throws its head back, mouth wide, arms out, **screams for 3–5 s**, then sprints at you. If you stand 20+ blocks away, aim carefully at the head.
6. **Rage:** much faster than your sprint. Another player (or a mob) standing near it is ignored. It breaks doors, glass, leaves, wood in its way (needs `mobGriefing` on — default). Put an obsidian or bedrock wall between you and it: those must stay.
7. **Kill:** it kills you in one or two hits (armour barely matters; a Totem of Undying or Resistance V will save you).
8. **Calm again:** after you respawn it is back to sitting and crying. Look at it again → it triggers again (5 s look cooldown).
9. **Toughness:** hit it with a diamond sword → barely scratches 500 HP; knockback is nil.
10. **Persistence:** leave it alone for several in-game days; it does not despawn.

### Things I could not prove without a real game (please tell me if you see them)
* The very first trigger: if looking at it never makes it scream, send me a screenshot of the content log (the whole rage chain hangs on the engine's `lookat` → `on_target_acquired`, copied from the vanilla Enderman).
* After it kills you: if it calms down but never triggers again, tell me (an engine target-clearing edge case).
* Sit pose: the engine aims the gaze test at about 1.3 blocks high; the sitting head is about 1.0 block. If a sitting SCP-096 is hard to trigger, trigger it while it walks, or look at it from a bit above.
* Loudness: the scream is deliberately loud (about 9 dB above the crying). If it is too much, lower the `volume` values in `SCP096_RP/sounds/sound_definitions.json`.
* Limb animation signs and walk speed were solved from vanilla evidence and rendered, not seen in game. If arms/hands look wrong in a pose, tell me which one.
* `setblock` from a script when cheats are off, and chat feedback from it: if "Block placed" spam appears, run `/gamerule sendcommandfeedback false`.

### If something shows in the content log
* "module @minecraft/server version … not found": your build lacks module 1.11.0 — send me the exact line; the model, AI and sounds still work without the script (only the extra block clearing is lost; `break_blocks` still works).
* The egg or entity shows a raw key such as `entity.scp:scp096.name`: your game language is not English — switch to English (US).
* Last resort for script problems: *Settings → Game → Experiments → Beta APIs* ON (not normally needed).

## 5. Built-in sound fallback (if you dislike the synthesised sounds)
In `SCP096_RP/sounds/sound_definitions.json`, replace each custom `sounds` entry (e.g. `"sounds/mob/scp096/cry1"`) with a vanilla sound path, or point `SCP096_RP/entity/scp096.entity.json → sound_effects` at a vanilla event id:

| custom | vanilla replacement (alt) |
|---|---|
| `mob.scp096.cry` | `mob.ghast.moan` (`mob.wolf.whine`) |
| `mob.scp096.scream` | `mob.ghast.scream` (`mob.endermen.scream`) |
| `mob.scp096.rage` | `mob.endermen.scream` (`mob.warden.roar`) |
| `mob.scp096.hurt` | `mob.endermen.hit` (`mob.zombie.hurt`) |
| `mob.scp096.death` | `mob.ghast.death` (`mob.endermen.death`) |

## 6. Developer notes
* `DESIGN.md` — the contract between all files.
* `tools/` — generators (`make_model.py`, `make_texture.py`, `make_sounds.py`), preview renderers (`render_preview.py`, `render_poses.py`), checkers (`validate_addon.py`, `sim_entity.py`, `test_script.mjs`, `typecheck/`), packer (`build_mcaddon.py`).
* `previews/` — rendered model, pose and audio-spectrogram images.
* Rebuild: `python3 tools/build_mcaddon.py && python3 tools/gen_guide.py`.
