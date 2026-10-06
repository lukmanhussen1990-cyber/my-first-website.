# Parasite outbreak (scripts/outbreak/)

The main feature of the add-on (SPEC §7). A parasite released with the **Parasite Outbreak** item
replicates on a timer, infects villagers, livestock and players, and converts them into infected
creatures that spread the infection further. The **Outbreak Control** item pauses, configures, cures or
cleans up the outbreak.

Target: Bedrock Preview 1.21.0.26, `@minecraft/server` 1.11.0 and `@minecraft/server-ui` 1.1.0.
Identifiers come from `scripts/lib/ids.js`. The entity contract (groups, events, families) is in SPEC §3
and `docs/ENTITIES.md`.

## Modules

| file | role |
|---|---|
| `index.js` | `initOutbreak()`: item handlers, event subscriptions, the per-tick **pump** and the 1 Hz **slow loop** |
| `api.js` | public API: `getState`, `getConfig`, `setConfig`, `startOutbreak(dim, loc, player?)`, `pause`, `resume`, `cleanup`, `cure`, `hordeCount`, `infect(entity, source)`, plus `getStatus`, `stageOf`, `curePlayer`, `convertNow`, `runGeneration`, `runtimeInfo` |
| `config.js` | `pas:config`: defaults, ranges, clamping |
| `state.js` | `pas:outbreak` state, lazy loading, purge records, the in-memory runtime (`rt`: queues and caches) |
| `horde.js` | `hordeCount()`, horde queries, `HordeBudget` (free population slots within one tick) |
| `replication.js` | start (first parasite), the generation timer, the offspring queue, spawn placement |
| `infection.js` | infection rules, `infect()`, `clearInfection()`, the incubation cycle, stage 1 → 2 |
| `conversion.js` | mob → infected creature (origin data capture) and infected creature → mob (cure) |
| `players.js` | stage-2 pulses, death → infected human, respawn/join, "Cure me" |
| `dormancy.js` | pause/resume, dormant events and tags, per-entity sync |
| `purge.js` | cleanup/cure with epochs, the purge queue, lazy purges on load, the 5-second sync sweep |
| `release.js` | the `pas:parasite_outbreak` item (block use and in-air raycast) |
| `ui.js` | server-ui forms (menu, settings, confirmations; UserBusy retry) |
| `hud.js` | actionbar HUD while the control item is held |
| `commands.js` | `/scriptevent pas:outbreak <status\|pause\|resume\|cleanup\|cure\|start>` |
| `fx.js` | particles, sounds, effects (never throw) |

## State machine

```
           release item / scriptevent start
 INACTIVE ─────────────────────────────────▶ ACTIVE ◀──────── resume ────────┐
    ▲   (generation 0, ticksToNext =             │                           │
    │    replicationSeconds*20, stats reset)     └──────── pause ───────▶ PAUSED
    │                                                                        │
    └──────────── cleanup / cure (epoch++, purges[epoch] = kind) ◀───────────┘
                  (from any state; also valid while inactive)
```

Per entity:

```
vanilla mob:  healthy ──hit by horde / infected player──▶ incubating (pas_incubating, inc_ticks)
                         ──inc_ticks 0 and room under the cap──▶ converted (removed, infected creature spawned)
                         ──inc_ticks 0 at the cap──▶ held at 0 ("dormant" feedback) until a slot frees
player:       healthy ──hit──▶ stage 1 (pas_incubating, pas:stage 1) ──▶ stage 2 (pas_infected_player, pas:stage 2)
                         death in stage 1/2 or killed by the horde ──▶ pas:infected_human "Infected <name>" (cap permitting),
                         player cleared, respawns healthy
horde entity: hunting (pas:hunting) ◀──pause/resume──▶ dormant (pas:dormant + pas_dormant tag)
```

## Timers and work budgets

* **Pump (every tick).** It runs the replication countdown, spawns queued offspring and conversions
  (**≤ 8 spawns per tick**, `MAX_SPAWNS_PER_TICK`), processes the incubation batch (**≤ 32 entities per
  tick**, `INC_PER_TICK`), the purge queue (≤ 32 per tick), the sync sweep (≤ 48 per tick) and deferred jobs.
  When nothing is queued, each step is a single length check.
* **Replication countdown.** `ticksToNext` is decremented **every tick** while the outbreak is active and not
  paused. This differs from the SPEC's "-= 20 per second" wording. The result is the same, but a generation
  fires on exactly the tick the interval ends: 1 → 2 → 4 → 8 at exactly 600/1200/1800 ticks. The 1 Hz loop
  saves the state, so at most 19 ticks of countdown can be lost if the game crashes.
* **Generation.** The script takes a snapshot of the loaded, living `pas:parasite`. With `budget = populationCap -
  hordeCount()`, the first `min(snapshot, budget)` parasites each get one queued offspring. Then
  `generation++` and `ticksToNext = replicationSeconds*20`. Each offspring spawns with a plain
  `dimension.spawnEntity("pas:parasite", loc)`, which fires `minecraft:entity_spawned` and gives the
  hunting group. It spawns on a loaded free cell next to its parent, preferring cells with ground below, and
  rotating through the 8 neighbours. The new entity gets `pas:epoch`, is made dormant if the outbreak is
  paused, and then receives the optional `pas:born` flourish, the birth particle and the birth sound. The
  `id<event>` spawn syntax is never used.
* **Slow loop (every 20 ticks).** It starts a new incubation cycle, runs the stage-2 pulses and the HUD,
  runs the sync sweep every 5th cycle (5 s), and saves the state, every second while active and otherwise
  only when it changed.
* **Incubation cycle (1 Hz).** The cycle collects every loaded entity tagged `pas_incubating` in all
  three dimensions and processes them at ≤ 32 per tick. For each entity it runs a purge check
  (`inc_epoch < epoch`, or no active outbreak, means the infection is cleared), decrements `pas:inc_ticks` by
  20 and gives feedback. At 0, a mob is queued for conversion if `hordeCount() + queued conversions < cap`,
  and otherwise holds at 0; a player moves to stage 2. If a cycle has not finished before the next one is
  due, the next one is skipped, so a huge number of incubating mobs slows incubation down instead of
  overrunning the tick budget.

## Population cap

`hordeCount()` counts the loaded entities with family `pas_horde` in the overworld, the nether and the end,
**minus horde entities that are dying** (died, still playing the death animation), **plus queued offspring**.
The dying refinement lets a kill free its slot immediately. Replication, conversion, released parasites
and infected-human spawns all check it. Within one tick the script uses `HordeBudget`, so many
conversions only query the world once.

## Infection rules

The script handles infection in `world.afterEvents.entityHurt`. It acts only when `damage > 0`, the
outbreak is active and not paused, and the attacker is a horde entity or a player in stage 1 or 2. The
target must be infectable, healthy and alive:

* **Infectable:** its type is a key of `CONVERSIONS` (villager_v2, villager, wandering_trader, cow,
  mooshroom, pig, sheep, chicken), or it is a player in survival or adventure (`player.getGameMode()`)
  while `infectPlayers` is on.
* **Healthy:** it has no `pas_incubating` or `pas_infected_player` tag and is not horde. Horde entities are
  never infected.

When a target is infected, it gets tag `pas_incubating` and the properties `pas:inc_ticks`, `pas:inc_total`
and `pas:inc_epoch` (players also get `pas:stage = 1`). The script spawns `pas:infection_spores` at the
entity's feet (the particle rises about 0.9 blocks by itself) and plays `pas.infection.start`.

* **Mobs** get slowness, amplifier 1, refreshed every second.
* **Players** get a title, an actionbar countdown, `pas.infection.heartbeat` every second, and nausea
  pulses every 10 seconds.
* **Stage-2 players** get the actionbar `☣ INFECTED — your attacks spread the parasite`, hunger (5 s
  every 10 s) and nausea (4 s every 15 s).

All effect ids (`slowness`, `nausea`, `hunger`, `regeneration`) exist in this build's
`mojang-effects.json`. Effects use `addEffect(id, ticks, {amplifier, showParticles: false})`.

## Conversion and cure

The original is removed with `remove()`, so it drops nothing. The infected entity spawns at the same
location with the same rotation. It gets the events below, `pas:epoch`, `pas:origin`,
`pas:origin_data` (JSON) and the nameTag. The script then shows the `pas:conversion_burst` particle and
plays `pas.infection.convert`.

| origin | captured | infected entity events | cure (vanilla events of this build) |
|---|---|---|---|
| villager_v2 | `minecraft:variant` (profession 0–14), `mark_variant` (biome), `skin_id` | `pas:set_variant_<p>`, `pas:set_mark_<b>`, `pas:set_skin_<s>` | `minecraft:become_<profession>`. The vanilla spelling is `become_sheperd`. Unskilled uses `become_unskilled`. The biome and skin are written through `EntityMarkVariantComponent.value` / `EntitySkinIdComponent.value` (both writable in 1.11.0), 2 ticks after the spawn so the spawn event's groups do not overwrite them |
| villager (v1) | variant 0–4, mapped to v2 farmer 1, librarian 5, cleric 7, armorer 8, butcher 11 | `pas:set_variant_<v2>` | `minecraft:spawn_farmer/_librarian/_cleric/_armorer/_butcher`, which keeps the same v1 variant value |
| wandering_trader | – | none (variant 0) | plain spawn |
| cow | – | `pas:set_variant_0` | adult: `minecraft:ageable_grow_up` |
| mooshroom | variant (vanilla `mooshroom.json`: 0 = `mooshroom_red`, 1 = `mooshroom_brown`) | red → `pas:set_variant_1`, brown → `pas:set_variant_2` | adult: `minecraft:become_red_adult` (+ `minecraft:become_brown`); baby: `minecraft:entity_born` + `become_red`/`become_brown` |
| sheep | `minecraft:color`, `minecraft:is_sheared` | `pas:set_color_<c>`, `pas:set_sheared` | `minecraft:on_sheared`; the colour is written through `EntityColorComponent.value` (writable in 1.11.0), 2 ticks after the spawn |
| pig, chicken | – | – | adult: `minecraft:ageable_grow_up` |
| any | `minecraft:is_baby`, nameTag | `pas:make_baby` | baby: `minecraft:entity_born`, which adds the vanilla baby group with `minecraft:is_baby` in every one of these files; nameTag restored |

**What the cure cannot restore:**

* **Nitwit villagers.** There is no `become_nitwit` event, so the villager keeps the profession its spawn
  rolled.
* **The adult group on babies.** A baby made with `entity_born` keeps any adult group the vanilla spawn
  event rolled, because no vanilla event removes the adult group. It still has `is_baby` and grows up
  normally.
* **Anything not listed in the table.** This includes trades, villager experience and gossip, inventories,
  saddles, leashes, health, potion effects, custom loot, the wandering trader's despawn timer (a cured
  trader gets a fresh one) and mooshroom flower-stew state.
* **Players.** An infected human is only removed by the cure. The player has already respawned.

## Pause / resume

* **Pause** saves the countdown, sets `paused`, and sends `pas:become_dormant` to every loaded horde
  entity while adding the `pas_dormant` tag. **Resume** sends `pas:become_active` and removes the tag.
* While paused, the replication timer, incubations, conversions and stage-2 pulses are frozen, and no new
  infection starts.
* Offspring still queued when the pause happens spawn dormant, and so do parasites released while paused.
* An entity that loads later is synced in `entityLoad`.
* Every 5 seconds a sweep compares each loaded horde entity's tag **and** its real AI state:
  `minecraft:behavior.nearest_attackable_target` exists only in `pas:hunting`. The sweep repairs any
  mismatch, for example after a missed event.
* `pas:become_active` is filtered on that component, and group changes apply on the entity's next tick
  (see docs/ENTITIES.md). Sending dormant and then active to one entity in the **same** tick would leave it
  dormant, so a pause and resume within one tick is applied one tick later.

## Cleanup, cure and epochs

`cleanup()` and `cure()` both:

* set `epoch++` and `purges[epoch] = "cleanup"|"cure"` (the last 64 purge records are kept);
* set the outbreak inactive with generation 0;
* drop all queues.

Then every loaded horde entity, incubating mob and infected player is purged, the first 32 immediately
and the rest at 32 per tick.

* **Cleanup** removes the horde and clears every infection. Infected creatures are not reverted.
* **Cure** removes parasites and infected humans, reverts infected creatures to their `pas:origin` (see
  the table above), and clears every infection.
* **Cleared** means the tags, `pas:inc_*`, `pas:stage = 0` and the nausea/hunger/slowness effects are
  removed.

Entities that were unloaded, and players who were offline, still carry their old `pas:epoch` /
`pas:inc_epoch`. They are handled **lazily**: through `entityLoad`, the startup reconcile, the 5 s sweep,
the incubation cycle, or `playerSpawn` for a joining player. Each gets the **first purge recorded after its
epoch**. For example, a creature that was unloaded during a cleanup and then a cure is removed, not
reverted.

## Persistence and reload

| what | where |
|---|---|
| config | world property `pas:config` (JSON via `lib/store`), saved on every change |
| outbreak state | world property `pas:outbreak`, saved on every start, generation, pause, resume, purge and config change, plus every second while active |
| infection | entity tags `pas_incubating` / `pas_infected_player` and the properties `pas:inc_ticks`, `pas:inc_total`, `pas:inc_epoch`, `pas:stage` (updated every second) |
| horde | `pas:epoch`, `pas:origin`, `pas:origin_data`, the `pas_dormant` tag and the component groups |

Nothing reads the world at import time. The first event handler or interval loads config and state
(`ensureLoaded()`), and one tick later a startup reconcile checks every loaded horde entity for epoch and
dormancy. The countdown resumes from the saved `ticksToNext`: the next generation comes exactly
`ticksToNext` ticks after the load tick. Incubations resume from the saved `pas:inc_ticks`. The work
queues are not persisted. A pending offspring that has not spawned yet is lost on a crash. That window is
at most 1 or 2 ticks, and the generation counter has already advanced.

## Controls

* **Parasite Outbreak** (`pas:parasite_outbreak`):
  * Tap a block to release a parasite on top of it. If the cell above is blocked, it goes in front of the
    clicked face. If the clicked block is grass or a snow layer on solid ground, it goes inside that cell.
  * Tapping in the air raycasts up to 10 blocks to the ground. Otherwise the player sees "Aim at the
    ground".
  * The cap is checked first. A successful release shows a title and plays a sound for everyone (first
    release only).
  * The item is consumed in survival and adventure only, and only when a parasite was released.
* **Outbreak Control** (`pas:outbreak_control`), tapped anywhere, opens the menu:
  * Status: mode, generation, parasites, infected, incubating (and how many are held at the cap), infected
    players, population/cap, the next-generation countdown, stats, and your own infection.
  * **Pause/Resume** (shown only while an outbreak runs).
  * **Settings**: sliders replication 10–300 s step 5, mob incubation 5–120 s step 5, player incubation
    10–300 s step 5, population cap 4–200 step 4; toggles infect players and show HUD. Settings are
    clamped and persisted. A shorter replication interval also shortens the running countdown.
  * **Cure everything** and **Clean up outbreak** each ask for confirmation.
  * **Cure me** (only when you are infected).
  * **Close**.

  A form canceled as `UserBusy` is shown again up to 5 times, 10 ticks apart.
* **HUD**: while the control is held in either hand and `showHud` is on, the actionbar shows
  `☣ ACTIVE | Gen 3 | Horde 11/64 | Next 24s`, plus your own stage, once every 20 ticks. While the HUD is
  showing, the infection actionbar messages are suppressed so they do not flicker.
* **Commands** (cheats): `/scriptevent pas:outbreak status|pause|resume|cleanup|cure|start`. `start`
  releases a parasite at the source entity, or on top of a command block. The reply goes to the player who
  ran the command, otherwise to everyone.

## Player takeover limitation

Bedrock scripting cannot give a human-controlled player to the AI: there is no API to possess, puppet
or path-find a `Player`. A stage-2 player therefore stays in control. Their attacks spread the infection,
and they get hunger and nausea pulses. When they die infected, or are killed by the horde, a humanoid NPC
`pas:infected_human` named "Infected <name>" is spawned where they died, if the cap allows. The player
respawns healthy.

## Performance notes (mobile)

* There are no per-tick world scans. Each tick runs only queue length checks unless work is queued.
* Once per second the script runs one tag-filtered `getEntities` per dimension for incubation, one
  `getPlayers({tags})`, and, only when someone holds the control, the HUD count.
* Every 5 seconds it runs one family-filtered query per dimension for the sweep.
* Each tick is bounded: ≤ 8 spawns, ≤ 32 incubation updates, ≤ 32 purges, ≤ 48 sweep checks.
* Offspring placement costs at most 16 `getBlock` calls per spawn.
* Every handler, interval and form callback is wrapped (`safe`/`runSafe`/promise catch). A failure is
  logged up to 5 times per label and never escapes. A failed spawn drops its queue entry, so pending
  counts cannot leak. A failed conversion is retried on the next cycle, and a failed cure revert by the
  sweep.
* `Dimension.getBlock` may return `undefined` or throw `LocationInUnloadedChunkError` in unloaded chunks.
  Both are handled by `safeGetBlock`.

## Tests

`npm test` runs these files. They use the behavioural mock and each test asserts concrete numbers.

| file | covers |
|---|---|
| `tests/outbreak_core.test.mjs` | 1 item start (block, air raycast, creative, cap, blocked/plant cells); 2 exact doubling at 600/1200/1800 ticks, ≤ 8 spawns/tick; 3 cap 64, cap 6, cap counting infected creatures in other dimensions, held conversion completing after a kill, infected-human cap; 12 spawn failures, unloaded parents (both `getBlock` behaviours), conversion retry, 400 incubating mobs within budgets |
| `tests/outbreak_infection.test.mjs` | 4 villager → cow → pig chain with origin data and stats, origin capture for mooshrooms/sheep/babies/v1 villagers/traders; 5 rules (no horde-on-horde, no re-infection, damage 0, healthy attackers, creative, `infectPlayers`, inactive); 6 player stages, pulses, transmission, death → "Infected Alex", respawn, Cure me, offline incubation |
| `tests/outbreak_control.test.mjs` | 7 pause/resume (frozen timers, late loads, same-tick toggle, sweep repair, dormant offspring); 8 cleanup (lazy purge on load, ≤ 32/tick); 9 cure (profession/biome/name, mooshroom colour, baby, sheep colour/sheared, nitwit, players, lazy cure, cleanup-then-cure ordering); 11 UI flows, settings persisted and clamped, confirmations, UserBusy retry, HUD throttling, scriptevent commands |
| `tests/outbreak_reload.test.mjs` | 10 save/reload in two processes (`tests/outbreak_scenarios/`), running and paused |

## Not testable offline

These need a device running Preview 1.21.0.26:

* the actual AI (targeting and melee from the entity JSON);
* the timing of entity-event group changes;
* that writing `mark_variant`, `skin_id` or `color` changes the vanilla render;
* that the vanilla spawn randomisation does not override the cure events, which are sent right after the
  spawn;
* particle and sound appearance;
* the form layout on a phone.
