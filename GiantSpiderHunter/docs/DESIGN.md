# Giant Spider Hunter — Design Contract (v1.0.0)

Target: **Minecraft Bedrock Beta/Preview 1.21.0.26** (Android 14, Mali-G57). Every name in this
file is a contract shared by geometry, animations, client entity, behavior entity, script and
sounds. Do not rename anything without updating every consumer.

Ground truth for this exact build (already downloaded):

* Mojang `bedrock-samples` at tag `v1.21.0.26-preview`:
  `/tmp/claude-0/scratch/bedrock-samples` (vanilla BP entities, RP entity/animation/controller
  files, `metadata/script_modules/@minecraft/server_1.10.0.json`, `server_1.11.0.json`).
* Bedrock Dedicated Server **1.21.0.26 preview** (Linux): `/tmp/claude-0/bds/server`.
  Its binary strings are dumped to `/tmp/claude-0/bds/strings.txt`.
* Molang query/math names compiled into this build: `tools/data/molang_queries.txt`,
  `tools/data/molang_math.txt`. **Only use queries/functions in these lists.**
* Visual references (do NOT copy into the repo): `/tmp/claude-0/ref/*.jpg|png`.

No experiment toggles may be required. Script module: `@minecraft/server` **1.10.0** (stable;
verified present in metadata for 1.21.0.26; no beta APIs, no `@minecraft/server-ui`).

## 1. Repository layout

```
GiantSpiderHunter/
  packs/GiantSpiderHunter_BP/   manifest.json (done), pack_icon.png,
                                entities/giant_spider.json,
                                loot_tables/entities/giant_spider.json,
                                scripts/*.js, texts/en_US.lang, texts/languages.json
  packs/GiantSpiderHunter_RP/   manifest.json (done), pack_icon.png,
                                entity/giant_spider.entity.json,
                                models/entity/giant_spider.geo.json,
                                textures/entity/giant_spider/giant_spider.png,
                                animations/giant_spider.animation.json,
                                animation_controllers/giant_spider.animation_controllers.json,
                                render_controllers/giant_spider.render_controllers.json,
                                sounds.json, sounds/sound_definitions.json,
                                sounds/mob/giant_spider/*.ogg,
                                texts/en_US.lang, texts/languages.json
  tools/   generators (gen_*.py), validator, viewer/, bds_test/, build.py
  docs/    DESIGN.md (this), TESTING.md
  dist/    GiantSpiderHunter.mcaddon, GiantSpiderHunter-source.zip
```

UUIDs (fixed): BP header `f5896404-658c-4758-8de7-7f7971aebbac`, BP data
`f6c17588-e412-468f-8db9-44e35441d14e`, BP script `fde8790c-5955-43c3-bdc1-51a5fa5b11c0`,
RP header `945a1734-3277-466e-9bc2-43ea366d10df`, RP resources
`7cfb5fa6-2493-4d3c-9449-c5f452d1cab1`. `min_engine_version` `[1, 21, 0]`.

## 2. Identifiers

| Thing | Identifier |
|---|---|
| Entity | `horror:giant_spider` (display name "Giant Spider Hunter") |
| Spawn egg item (auto) | `horror:giant_spider_spawn_egg`, lang `item.spawn_egg.entity.horror:giant_spider.name=Giant Spider Hunter` |
| Geometry | `geometry.horror.giant_spider` |
| Texture | `textures/entity/giant_spider/giant_spider` (PNG, 128x128) |
| Materials | `default: spider` (vanilla emissive-alpha material: texels with alpha 3 glow, like vanilla spider eyes), `invisible: spider_invisible` |
| Render controller | `controller.render.horror.giant_spider` |
| Loot table | `loot_tables/entities/giant_spider.json` |

## 3. Coordinate conventions (Bedrock model space)

Units are model pixels (16 px = 1 block). **+Y up, ground = y 0, forward = −Z** (head end),
**+X = the spider's LEFT side** (vanilla zombie `leftArm` is at +X). Bone rotations are Euler
degrees applied in Bedrock/Blockbench order. Expected (to be confirmed by the viewer against
the vanilla spider `default_leg_pose`, which makes legs reach the ground):

* A bone extending along **+X** (left leg): **positive Z rotation lowers its tip**.
* A bone extending along **−X** (right leg): positive Z rotation raises its tip.
* Left leg yaw bone: positive Y rotation swings its tip **forward (−Z)**; right leg: negative Y
  swings forward.

The viewer agent owns verifying these signs; the visual agent must read the viewer result
(`tools/viewer/CONVENTIONS.md`) before finalising animation signs, or verify them with its own
FK check against the vanilla spider.

World mapping (for the script's terrain sampler): with entity body yaw θ (Bedrock yaw degrees,
0 = facing +Z/south, 90 = facing −X/west), a model point (gx, gy, gz) px at scale s maps to world
offset `x = (gx·cosθ + gz·sinθ)·s/16`, `y = gy·s/16`, `z = (gx·sinθ − gz·cosθ)·s/16`
(left(θ) = (cosθ, sinθ), forward(θ) = (−sinθ, cosθ); geometry −Z = forward).

## 4. Geometry (`geometry.horror.giant_spider`, format_version "1.12.0")

Built at **giant scale 1.0** by `tools/gen_geometry.py` (deterministic generator; per-face UVs).
Bind pose: every leg segment is horizontal and straight (zero rotations) so animation values are
absolute angles. Keep total cubes ≲ 90 and bones = 39.

`visible_bounds_width: 72`, `visible_bounds_height: 60`, `visible_bounds_offset: [0, 28, 0]`
(blocks; covers giant_scale up to 2.5 with spread legs).

Bone hierarchy and pivots (px):

```
root            pivot [0,0,0]                      (uniform scale animation only)
└ body          pivot [0,208,0]   parent root      (position bob; legs follow)
  ├ torso       pivot [0,208,0]   parent body      (visual sway/lean only; legs NOT children)
  │ ├ head      pivot [0,212,-34] parent torso     (look-at, attack lunge)
  │ │ ├ fang_l  pivot [8,202,-48]  parent head
  │ │ └ fang_r  pivot [-8,202,-48] parent head
  │ └ abdomen   pivot [0,214,16]  parent torso     (hangs down-back ~30°, breathing pulse)
  ├ hip_l1..hip_l4, hip_r1..hip_r4   parent body   (yaw only, about Y)
  │ └ femur_xn  same pivot as hip    (elevation, about Z)
  │   └ tibia_xn pivot at knee       (bend, about Z)
  │     └ foot_xn pivot at ankle     (about Z) + locator foot_tip_xn at tip
```

Leg n = 1..4 front→back. **(v2 proportions — revised after comparing renders with the
references: thicker legs, much wider arch, bigger body.)** Hip attach points: x = ±30, y = 206,
z = [−30, −14, 2, 18]. Per-pair length factor k = [1.08, 1.00, 0.96, 1.04]. Segment lengths (px):
femur L1 = 200k, tibia L2 = 290k, foot L3 = 50k. Thickness (px): femur 34 (pair 1: 36), chunky
angular knee joint block ~44, tibia 20 tapering to 16, ankle block ~20, foot 12 → claw 8.
Left legs extend toward +X, right legs mirror toward −X. Pivot of tibia = hip + (±L1,0,0); pivot
of foot = hip + (±(L1+L2),0,0); locator `foot_tip_xn` at hip + (±(L1+L2+L3),0,0).

Neutral foot placement (stance centre, on ground y=0): horizontal radius from hip
R = 260k, angle from the lateral axis toward forward a = [52°, 20°, −16°, −48°].
Left: (30 + R·cos a, 0, z_hip − R·sin a). Right: (−30 − R·cos a, 0, z_hip − R·sin a).
Resulting rest pose (k=1): femur rises ~35° to knees ~20 blocks high and ~12 blocks out, tibia
descends at ~−71°, feet span ~36 blocks — the wide "M" arch of the reference.

Body (much bigger than v1): angular cephalothorax ≈ 64 w × 40 h × 76 l px with a raised dorsal
ridge and plated underside; head block at the front with 8 small eye texels (glowing, alpha 3) and
two hanging fangs; large abdomen ≈ 84 w × 76 h × 116 l px hanging down-back ~35°, so thorax +
abdomen read as the big inverted-V wedge between the knees in the reference.
Silhouette target: `/tmp/claude-0/ref/ref_thumbnail.jpg` (primary), `ref_giant_hero.png`,
`ref_giant_walk.jpg`, `ref_air_chase.jpg` — thick plank-like angular upper limbs with clearly
visible lighter bevel edges and end caps, big blocky knee joints, thinner long lower limbs, knees
well above the body, body above tree canopy, feet spread ~36 blocks.

## 5. Texture (`gen_texture.py` → 128×128 PNG)

Dark brown / charcoal wood (#33261f–#45342a base), clearly visible lighter warm-brown bevel edges
(#7d5f48, 1–2 texels) and lighter end caps on every limb segment like the reference "wooden"
plank look (see ref_thumbnail.jpg), subtle grain/noise, darker joint caps, bristle
specks. Abdomen: charcoal with faint brown chevrons; underside slightly lighter. Eyes: deep red
(#a60202/#ff0e0e) with **alpha = 3** so the vanilla `spider` material makes them glow; every other
texel alpha 255 (no transparency). Per-face UV regions sized to keep ~2 world px per texel on the
giant.

## 6. Entity properties (BP `description.properties`)

| Property | Type | Range / values | Default | client_sync |
|---|---|---|---|---|
| `horror:state` | enum | `idle, stalking, growing, hunting, cooldown, dying` | `idle` | true |
| `horror:giant` | bool | | false | true |
| `horror:small_scale` | float | [0.02, 0.5] | 0.075 | true |
| `horror:giant_scale` | float | [0.25, 3.0] | 1.0 | true |
| `horror:grow_time` | float | [0.5, 20.0] | 4.0 | true |
| `horror:attack_id` | int | [0, 1000000] | 0 | true |
| `horror:attack_kind` | int | [0, 2] | 0 | true |
| `horror:foot_0` … `horror:foot_7` | float | [−24.0, 24.0] | 0.0 | true |
| `horror:difficulty` | int | [0, 3] | 2 | false |

`foot_i` order: 0 l1, 1 l2, 2 l3, 3 l4, 4 r1, 5 r2, 6 r3, 7 r4. Value = terrain surface height at
that leg's neutral foot position minus entity y, in **blocks** (0 for the small form).
`attack_kind`: 0 = ground stab (front legs stab down), 1 = high reach (legs sweep upward at an
airborne target), 2 = bite (fangs + head lunge, point blank).
`attack_id` increments by 1 per strike (wraps at 1000000 → 1).

## 7. Behavior entity (`entities/giant_spider.json`, format_version "1.21.0")

`description`: identifier `horror:giant_spider`, `spawn_category: "monster"`,
`is_spawnable: true`, `is_summonable: true`, properties above.

**Base components** (never redefine any of these inside a component group):
`type_family [giant_spider, monster, arthropod, mob]`, `health {value 1000, max 1000}` (health
buffer: real HP = health − 500; the script sets current = 500 + config.health on first spawn),
`movement {value 0.3}`, `movement.basic`, `jump.static`, `navigation.walk {can_path_over_water,
avoid_damage_blocks, can_walk, can_jump...}`, `variable_max_auto_step {base_value 1.0625,
jump_prevented_value 0.5625}`, `physics`, `pushable {is_pushable false, is_pushable_by_piston
false}`, `knockback_resistance {value 1.0}`, `breathable {breathes_air, breathes_water,
suffocate_time 0, total_supply 15}`, `nameable`, `persistent`, `follow_range {value 96, max
96}`, `conditional_bandwidth_optimization`, `is_hidden_when_invisible`, `loot {table
loot_tables/entities/giant_spider.json}`, `experience_reward`, and ONE `environment_sensor` with
triggers:

1. `is_difficulty == peaceful` → `horror:peaceful_despawn`
2. `actor_health <= 500` AND `enum_property horror:state != dying` → `horror:start_dying`
3. difficulty easy/normal/hard AND `int_property horror:difficulty` differs → `horror:set_difficulty_1/2/3`

**Component groups** (exact names):

| Group | Contents |
|---|---|
| `horror:form_small` | `collision_box {0.9 × 0.7}`, `custom_hit_test` one box ≈ pivot [0,0.45,0] 1.2×0.9 |
| `horror:form_giant` | `collision_box {1.4 × 2.9}`, `custom_hit_test` boxes: ground core pivot [0,1.5,0] 3×3, body pivot [0,13,0] 6×5 |
| `horror:state_idle` | look_at_player, random_look_around, random_stroll (slow, frequent), float, damage_sensor (fall/suffocation immune) |
| `horror:state_stalking` | look_at_player (look_distance 64, high probability, long look_time), random_look_around, random_stroll (speed 0.6, interval ~200), float, damage_sensor (fall/suffocation immune) |
| `horror:state_growing` | damage_sensor `all` immune, look_at_player only (no locomotion), `timer` 25 s → `horror:growth_timeout` (fallback) |
| `horror:state_hunting` | `nearest_attackable_target` (players, must_see false, within 72, reselect), `hurt_by_target`, `melee_box_attack` (track_target, require_complete_path false, speed_multiplier tuned so chase ≈ 9–11 blocks/s), `minecraft:attack {damage 0}` (**script is the single damage authority**), float, damage_sensor (fall/suffocation immune) |
| `horror:state_cooldown` | random_stroll (fast, continuous), avoid_mob_type players (walks away), random_look_around, float, damage_sensor (fall/suffocation immune) |
| `horror:state_dying` | damage_sensor `all` immune, no behaviors, `timer` 8 s → `horror:death_timeout` (fallback) |
| `horror:despawn` | `instant_despawn` |

**Events** (exact names). Every `to_*` removes all six state groups, adds its group, and sets
`horror:state` via `set_property`:

| Event | Effect |
|---|---|
| `minecraft:entity_spawned` | add form_small + state_stalking; state=stalking; giant=false |
| `horror:to_idle` / `horror:to_stalking` | state group; form_small (remove form_giant); giant=false |
| `horror:to_growing` | state_growing; form_giant (remove form_small); giant=true |
| `horror:to_hunting` | state_hunting; form_giant; giant=true |
| `horror:to_cooldown` | state_cooldown; form_small; giant=false (visual shrinks back) |
| `horror:to_dying`, `horror:start_dying` | state_dying; state=dying (form unchanged) |
| `horror:growth_timeout` | same as `horror:to_hunting` |
| `horror:death_timeout`, `horror:peaceful_despawn`, `horror:despawn` | add `horror:despawn` |
| `horror:set_difficulty_1/2/3` | set_property horror:difficulty |
| `horror:spawn_giant` | test helper: same as to_hunting (usable as `/summon horror:giant_spider ~ ~ ~ 0 0 horror:spawn_giant` — 1.21.0.26 rejects the old `<pos> <event>` form, the event must follow yRot/xRot) |

## 8. Client entity, animations, controllers

Client entity `format_version "1.10.0"`, identifier `horror:giant_spider`, `scripts`:
`initialize`, `pre_animation`, `animate`,
`should_update_bones_and_effects_offscreen: "1.0"`, `should_update_effects_offscreen: "1.0"`.
`spawn_egg {base_color "#2a1f1a", overlay_color "#8b1a10"}`.

### pre_animation responsibilities (all in `v.*` variables, per frame)

* Read properties with `q.property('horror:...')` (enum compares as string, e.g.
  `q.property('horror:state') == 'hunting'`).
* **Size**: `v.size_blend` moves toward 1 when `horror:giant` is true, toward 0 otherwise, at
  rate `q.delta_time / grow_time`; eased (smoothstep). `v.scale = lerp(small_scale,
  giant_scale, ease)`. Initialize `v.size_blend` to the current target in `initialize` so a
  reload never replays growth. `v.wpp = v.scale / 16` (blocks per model px).
* **Gait phase** (slip-free): `v.ddist = clamp(q.modified_distance_moved − v.last_dist, 0, 4)`;
  add a turning term from `q.yaw_speed`; stride `S_px = lerp(130, 180, v.run)`;
  `v.gait += (v.ddist + turn) / (2·S_px·v.wpp)`; wrap with `math.mod`.
  `v.move` (0..1) smoothed from `q.ground_speed` (moving when > ~0.15·scale·16·0.1…; tune);
  `v.run` (0..1) = hunting state AND ground speed above ~4 blocks/s, smoothed.
* **Tetrapod gait**: group A {l1, r2, l3, r4} phase offset 0, group B {r1, l2, r3, l4} offset
  0.5 (+ small per-pair offsets ≤ 0.06 for organic feel). Duty factor 0.5. Stance: foot moves
  linearly from +S/2 (forward) to −S/2 along the body axis (forward = −Z); swing: smoothstep
  back to front with lift `H·sin(180·w)·v.move` (H = lerp(55, 85, v.run) px). Stationary ⇒ phase
  stops ⇒ stepping stops; lifted legs lower via `v.move`.
* **Terrain**: `v.fh_i` smoothed toward `q.property('horror:foot_i')` (blocks); foot target
  y_px = `v.fh_i / v.wpp` (clamped ±220 px) + lift. Ignore (0) while `v.size_blend < 0.5`.
* **Body**: height offset `v.bob_px` (walk bob ±3 px synced to gait; run lower −10 px; stalking
  crouch −30 px; death drop toward −180 px).
* **2-bone IK per leg** (in the leg's vertical plane): target T = foot − hip (hip y includes
  bob). `uh = √(dx²+dz²)`; left yaw = `atan2(−dz, dx)` (right legs mirrored); ankle = T moved
  up L3 along a foot direction tilted 12° outward; `d = clamp(|ankle|, |L1−L2|+1, L1+L2−1)`;
  `φ = atan2(av, au)`; `γ = acos(clamp((L1²+d²−L2²)/(2·L1·d), −1, 1))`; femur elevation
  `α = φ + γ` (knee up); knee K = L1(cos α, sin α); tibia absolute `θ2 = atan2(av−Ky, au−Kx)`;
  foot absolute `θ3 = atan2(Ty−av, uh−au)`. Molang trig is in **degrees**.
  Bone values (left legs, sign per §3): hip y = yaw, femur z = −α, tibia z = −(θ2−α),
  foot z = −(θ3−θ2); right legs mirror the signs.

### Animations (`animations/giant_spider.animation.json`, format "1.8.0")

| Short name (client entity) | Identifier | Purpose |
|---|---|---|
| `size` | `animation.horror.giant_spider.size` | root scale = `v.scale` |
| `legs` | `animation.horror.giant_spider.legs_ik` | applies IK angles to all 32 leg bones + body bob |
| `idle` | `animation.horror.giant_spider.idle` | breathing, abdomen pulse, fang twitch, occasional leg twitch (additive) |
| `stalk` | `animation.horror.giant_spider.stalk` | crouched creeping posture, slow head sway, abdomen raised/twitch |
| `walk` | `animation.horror.giant_spider.walk` | restrained body roll/pitch sway synced to `v.gait` |
| `run` | `animation.horror.giant_spider.run` | forward lean, stronger bob, abdomen bounce |
| `grow` | `animation.horror.giant_spider.grow` | shudder/tremble, legs flex and splay while scaling up |
| `attack_ground` | `animation.horror.giant_spider.attack_ground` | wind-up (front legs rise, body rears) then stab down (~0.35 s to impact), recover; total ~1.0 s |
| `attack_high` | `animation.horror.giant_spider.attack_high` | front legs sweep up and inward to strike an airborne target; total ~1.0 s |
| `bite` | `animation.horror.giant_spider.bite` | head lunge + fangs snap, ~0.6 s |
| `death` | `animation.horror.giant_spider.death` | legs curl inward and up, body sinks, shudders; holds final pose (~2.5 s) |
| `look` | `animation.horror.giant_spider.look_at_target` | head yaw/pitch from `q.target_*_rotation` (clamped) |

Additive layering: `legs` (IK base) is always weight 1 while alive; others add deltas.
Weights in `animate`: `walk` = `v.move·(1−v.run)`, `run` = `v.move·v.run`, `idle` =
`1−v.move`, `stalk` when state is stalking, `grow` while growing.

### Animation controllers (`format "1.10.0"`)

* `controller.animation.horror.giant_spider.attack` — plays `attack_ground` / `attack_high` /
  `bite` (by `horror:attack_kind`) whenever `q.property('horror:attack_id') != v.seen_attack`;
  `on_entry` stores `v.seen_attack`; returns when `q.all_animations_finished`. `initialize`
  sets `v.seen_attack` to the current property so reloads don't replay.
* `controller.animation.horror.giant_spider.steps` — footstep sounds + dust: toggles states on
  each half gait cycle while `v.move > 0.3`; giant (`v.size_blend > 0.5`) plays `step_giant`
  sound + `minecraft:dust_plume` particles at the planted group's foot locators; small plays
  `step_small`.
* `controller.animation.horror.giant_spider.death` — enters `death` when state is dying (or
  `!q.is_alive`), stays there.

Render controller: geometry default, material default (`Material.default`), texture default;
supports invisibility material when `q.is_invisible`.

Particles allowed (vanilla, verified present): `minecraft:dust_plume`,
`minecraft:knockback_roar_particle`, `minecraft:huge_explosion_emitter`,
`minecraft:death_explosion_emitter`, `minecraft:campfire_smoke_particle`,
`minecraft:basic_smoke_particle`, `minecraft:critical_hit_emitter`.

## 9. Sounds

Original sounds synthesized by `tools/gen_sounds.py` (numpy → WAV → `ffmpeg -c:a libvorbis`,
mono). Never use audio from the reference videos. `sound_definitions.json` format "1.20.20",
category `hostile`, files under `sounds/mob/giant_spider/`.

| Sound id | Variants | Notes | max_distance |
|---|---|---|---|
| `mob.giant_spider.step` | 4 | giant footfall: deep thud + dirt crunch + wood creak | 96 |
| `mob.giant_spider.step_small` | 3 | tiny tick/scuttle | 16 |
| `mob.giant_spider.roar` | 2 | aggression: low growl + rising screech, ~2.5 s | 128 |
| `mob.giant_spider.grow` | 2 | cracking chitin, creaks, rising rumble, ~3.5 s | 96 |
| `mob.giant_spider.attack` | 3 | whoosh + impact | 64 |
| `mob.giant_spider.bite` | 2 | fang snap + hiss | 32 |
| `mob.giant_spider.hurt` | 3 | short screech | 48 |
| `mob.giant_spider.death` | 2 | long descending screech + collapse | 96 |
| `mob.giant_spider.ambient` | 3 | stalker chitter/clicks/hiss | 24 |
| `mob.giant_spider.heartbeat` | 1 | chase heartbeat (played to hunted player) | 16 |

`sounds.json` → `entity_sounds.entities["horror:giant_spider"]` events `ambient`, `hurt`,
`death` (no engine `step`; footsteps come from the steps controller).

## 10. Script (`scripts/`, @minecraft/server 1.10.0)

Files: `main.js` (entry, wiring), `config.js` (all tunables, documented), plus modules as the
script agent sees fit (`state.js`, `spawner.js`, `stalker.js`, `hunter.js`, `terrain.js`,
`challenge.js`, `commands.js`, `util.js`). APIs must exist in `server_1.10.0.json`
(e.g. `Player.getGameMode` does NOT exist in 1.10 → use `player.matches({gameMode})` /
`excludeGameModes`; `world.getDifficulty` does not exist → difficulty comes from the
`horror:difficulty` property / peaceful despawn event; `Block.typeId` is 1.11 → use
`block.permutation.type.id`; `isValid()` is a method; `dimension.playSound` is 1.11 → use
`world.playSound`). Wrap every engine call that can throw (unloaded chunk, invalid entity).

### State machine (per spider controller, driven every 2 ticks with per-task throttles)

`idle → stalking → growing → hunting → cooldown → (stalking | despawn)`, plus `dying`.

* **idle**: no eligible player within 64 → wander. Becomes stalking when one appears.
* **stalking** (small form): focus = nearest eligible player. Face them (gradual
  `setRotation`, ≤ 15°/tick). Keep 14–44 blocks: when out of the player's view and too far/near
  or every 15–30 s, relocate to a hidden surface spot 20–32 blocks away (behind the player's
  view cone, prefer next to tree trunks). Ambient chitter occasionally.
  Aggression triggers: (a) **look**: player view direction within 12° of the spider body centre,
  distance ≤ 56, clear line of sight (`dimension.getBlockFromRay`, leaves block it) for ≥ 0.6 s
  accumulated; (b) **approach**: distance ≤ 10; (c) **attacked** by a player (`entityHurt`);
  (d) **timeout**: `stalkTimeoutSeconds` (90) → `stalkTimeoutAction` 'hunt' (default) or
  'vanish'.
* **growing**: `triggerEvent('horror:to_growing')`, roar (world + to focus player), grow sound,
  camera shake for nearby players, particles; after `growthDurationSeconds` →
  `horror:to_hunting`. Invulnerable and stationary.
* **hunting** (giant): pursuit by vanilla AI; script handles strikes, escape, terrain, speed
  scaling, heartbeat. **Strikes** (single damage authority): every 2 ticks find eligible
  players within the giant's real reach (from the spider's location and `giant_scale` s):
  airborne/elevated (> 3 blocks above ground): distance from body centre (y + 13·s) ≤ 9.5·s;
  ground: horizontal distance ≤ 7·s anywhere, or ≤ 12.5·s inside the front 120° arc, and
  vertical offset ≤ 4·s; point blank (≤ 2.5 blocks) → kind 2 bite. On a valid strike: increment
  `attack_id`, set `attack_kind`, attack sound; after `strikeWindupSeconds` (0.35) re-check reach
  (+15% tolerance) then `applyDamage(damage × difficultyMult, {cause: entityAttack,
  damagingEntity: spider})` and knockback; cooldown `attackCooldownSeconds` (1.6). Never damage
  a player outside reach just because it is the target.
  **Escape**: contact = (distance ≤ contactRange 24) OR (distance ≤ 72 AND line of sight from
  body centre). Escape when distance ≥ `escapeDistance` (64) for `escapeDistanceSeconds` (3),
  OR no contact for `breakContactSeconds` (15), OR chase time ≥ `maxChaseSeconds` (240).
  `relentless: true` disables escape (only death/leave/creative ends it). Focus player dies,
  leaves, changes dimension or becomes creative/spectator → cooldown.
* **cooldown**: `horror:to_cooldown` (shrinks back, walks away, harmless) for
  `postChaseCooldownSeconds` (45); then if an eligible player is within 48 → stalking (fresh
  stalk timer, cannot trigger again for at least 10 s), else despawn and end the encounter.
* **dying**: entered by the entity itself (`horror:start_dying` from the health buffer) — script
  observes `dataDrivenEntityTrigger`, plays death sound/particles, after 3 s runs
  `loot spawn` for the loot table + xp orbs at the body, then `horror:despawn`; ends encounter.

### Terrain adaptation (giant only)

Every `terrainSampleIntervalTicks` (6) and only if moved > 0.75 block or turned > 10°: for each
leg's neutral foot point (scaled by s, rotated by body yaw — use velocity heading when moving,
else `getRotation().y`), find the ground column height: scan from entity y + 6·s down to
y − 10·s, skipping air, liquids-as-surface allowed, leaves/logs/wood/stems/vines/plants (the
legs pass between trees to the real ground). Per-column cache (5 s). Write
`horror:foot_i = clamp(groundTop − entity.y, −24, 24)` only when it changed by > 0.2.
Budget ≤ 120 `getBlock` calls per update. Unloaded chunk → keep previous value.

### Auto spawner (single system, enabled by default)

Every 20 ticks. Per eligible player (survival/adventure, overworld, alive): accumulate overworld
seconds (reset on leaving the overworld / respawn grace); first encounter when ≥ random 60–120 s.
At most **one auto-managed hunter** (tag `gsh_auto`, dynamic property `gsh:encounter` = serial;
world dynamic property `gsh:active` = JSON {serial, entityId, focusId, ...}). Candidate positions:
random angle (prefer outside the player's view), distance 32–48, scan column (≤ 48 `getBlock`)
for solid non-leaf/non-log ground with 3 blocks of non-solid headroom, not liquid/lava/magma/
cactus, loaded (getBlock defined incl. neighbours), ≥ 24 from other players. Prefer forest
(column passes through leaves/logs or a log within 3 blocks) for the first 60% of attempts,
then accept any valid land. ≤ 4 candidates/s, ≤ 40 per search, then back off 10 s.
Peaceful: if a spawned spider fires `horror:peaceful_despawn`, back off 120 s.
Encounter cooldown between encounters: random 300–480 s (persisted, counts down only while an
eligible player is online). Respawn grace 90 s after the focus player dies.
Reload/chunk handling: on script start read `gsh:active`; re-attach on `entityLoad`/periodic
scan (`dimension.getEntities({type})` every 10 s); if not found within 60 s while the focus
player is > 128 blocks from its last known position, end the encounter and record the serial as
retired; any loaded `gsh_auto` spider whose serial ≠ active is removed (duplicate/orphan).
Manual spiders (egg/summon, no `gsh_auto` tag) run the same AI but are not counted.

### Config & commands

`config.js` exports `CONFIG` with every tunable above (sizes, growth, health, damage per
difficulty, speeds via Speed/Slowness effect levels `chaseSpeedMultiplier`, ranges, timers,
challenge mode, debug). In-game overrides (persisted in world dynamic property
`gsh:config`): `/scriptevent gsh:config <key> <value>`, `/scriptevent gsh:challenge on|off`,
`/scriptevent gsh:spawn` (force an encounter near you), `/scriptevent gsh:status`,
`/scriptevent gsh:reset`, `/scriptevent gsh:debug on|off`.

### Optional challenge mode (OFF by default)

When on: each eligible player once gets an elytra + fireworks and a warning title/chat text
("Something dangerous roams this world. If it begins chasing you, RUN. You may only use the
Elytra and fireworks while being chased."). Lives (default 3) tracked per player; on reaching 0
→ spectator (`runCommandAsync('gamemode spectator @s')`). Flight restriction: firework use
cancelled (`beforeEvents.itemUse`) when not being chased; if gliding while not chased the elytra
is moved from the chest slot to the inventory (`minecraft:equippable`). Hunting works the same
with challenge mode off.

## 11. Verification

* Static: JSON parse, manifest/UUID/dependency checks, every referenced identifier resolves
  (geometry, textures, animations, controllers, sounds, loot table), every Molang query/math
  name is in `tools/data/*.txt`, `node --check` all scripts, every Script API member exists in
  `server_1.10.0.json`.
* Viewer renders (model + animations, Molang evaluated) compared with references.
* Runtime: BDS 1.21.0.26 loads packs (content log clean), script runs, bot player tests.
