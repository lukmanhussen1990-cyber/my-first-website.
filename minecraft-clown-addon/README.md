# Horror Clown

A Minecraft **Bedrock** addon (behaviour pack + resource pack) for **Minecraft
for Android**, built for **v1.21.0.26 beta**.

It adds one mob. It flies, it heals itself, it laughs, it kills anything in
reach, and once it has seen you it does not stop and does not forget.

No experimental toggles, no Beta APIs, no scripting.

---

## Install on your phone

1. Download **`dist/HorrorClown.mcaddon`** onto the phone.
2. Tap the file. Minecraft imports both packs.
3. Edit a world → **Behaviour Packs** → **My Packs** → activate *Horror Clown
   [BP]*. The resource pack switches on with it.
4. Play. It will show up on its own after dark — or force it with
   `/function clown/summon` (cheats must be on).

---

## What it does

| | |
| --- | --- |
| **Health** | 100 (50 hearts) |
| **Damage** | 9 per hit (4.5 hearts) |
| **Regeneration** | Regeneration III re-applied every 2 seconds — roughly 1.6 HP/sec |
| **Flight** | Full free flight. Walls and cliffs do not slow it down |
| **Sight range** | 128 blocks for players, 16 blocks for everything else |
| **Memory** | 1 hour. Breaking line of sight does not lose it |
| **Other** | Immune to fire and lava, 85% knockback resistance, breaks doors, never despawns |

**It hunts you specifically.** Target reselection is switched off and the
forget timer is an hour long, so once it locks onto you it will not swap to a
passing cow and will not give up when you hide. Other mobs are only visible to
it at 16 blocks — they are things it kills on the way to you, not distractions
that save you.

**It laughs.** A witch cackle pitched down about an octave, every 3–10 seconds.
You will hear it coming before you see it.

**It never despawns.** That is deliberate — it is supposed to still be out
there when you log back in. `/function clown/purge` is the way out.

Drops red dye, sometimes a cake, occasionally a gold ingot. 25 XP.

---

## Commands

Cheats must be on.

| Command | What it does |
| --- | --- |
| `/function clown/summon` | One clown, six blocks behind you |
| `/function clown/nightmare` | Three clowns, surrounding you |
| `/function clown/purge` | Kills every clown currently loaded |
| `/function clown/help` | Prints the list in chat |

There is also a **spawn egg** in the Creative inventory.

---

## Natural spawning

It spawns in the dark (light level 0–7), on the surface and underground, in any
overworld biome, at **weight 2**. A zombie is weight 100, so this is rare on
purpose — roughly one clown for every fifty zombies.

To turn natural spawning off entirely, delete
`HorrorClown_BP/spawn_rules/clown.json` and rebuild, or just set
`minecraft:weight` to `0`. The spawn egg and the commands keep working.

---

## How it is built

- **Flight** is the bee pattern: `minecraft:movement.fly` +
  `minecraft:navigation.fly` + `minecraft:can_fly`, with `can_path_from_air`
  and `avoid_damage_blocks: false` so nothing in the terrain deters it.
- **Relentlessness** is `minecraft:behavior.nearest_attackable_target` with
  `reselect_targets: false`, `must_see_forget_duration: 3600` and
  `persist_time: 3600`, backed by `minecraft:follow_range` of 128.
- **Regeneration** is a looping `minecraft:timer` that fires an event whose
  `queue_command` applies Regeneration III for 3 seconds, every 2 seconds. It
  is self-contained in the entity, so if a future version ever drops
  `queue_command` the mob still works — it just stops healing.
- **The laugh** is `minecraft:ambient_sound_interval` pointing at an `ambient`
  event that `sounds.json` maps to `mob.witch.ambient` at pitch 0.45–0.65. No
  audio files ship with the pack; it re-pitches sounds Minecraft already has.
- **The model** is a custom 128×128 geometry that keeps the vanilla humanoid
  bone names (`head`, `body`, `leftArm`, …) in the standard UV positions, so
  `animation.humanoid.base_pose`, `animation.humanoid.move` and
  `animation.zombie.attack_bare_hand` drive it for free. The clown-only parts —
  nose, hair tufts, ruff collar, oversized shoes — live in the free UV space to
  the right. A custom `animation.ssgm_clown.hover` bobs and sways the whole
  model and lets the legs dangle.

## Building from source

```sh
python3 tools/generate_textures.py   # repaint the 128x128 texture + pack icons
python3 tools/build.py               # validate, then zip dist/HorrorClown.mcaddon
```

`tools/build.py` fails the build on the errors that would otherwise produce a
mob that loads but is invisible or silent: mismatched entity identifiers, a
texture path that points nowhere, a geometry or render controller referenced
but never defined, an animation listed in `scripts.animate` that is not in
`animations`, a texture whose real pixel size disagrees with the geometry's
declared `texture_width`/`texture_height`, a box UV island that runs off the
edge of the texture, duplicate or unparented bones, two AI behaviours sharing a
priority, a `minecraft:timer` firing an event that does not exist, and a
`minecraft:ambient_sound_interval` whose event `sounds.json` does not map.

## Layout

```
HorrorClown_BP/
  manifest.json
  entities/clown.json            AI, stats, flight, regeneration timer
  spawn_rules/clown.json         rare, dark, overworld
  loot_tables/entities/clown.json
  functions/clown/               summon, nightmare, purge, help
HorrorClown_RP/
  manifest.json
  entity/clown.entity.json       model + animation + sound wiring
  models/entity/clown.geo.json   geometry.ssgm_clown
  animations/clown.animation.json
  render_controllers/
  textures/entity/ssgm_clown.png 128x128
  sounds.json                    the cackle
  texts/en_US.lang
```
