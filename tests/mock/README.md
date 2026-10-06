# `@minecraft/server` / `@minecraft/server-ui` mock

A behavioural mock of the parts of **@minecraft/server 1.11.0** and **@minecraft/server-ui 1.1.0**
(Bedrock Preview 1.21.0.26) that the add-on uses, so the real script files in
`addon/behavior_pack/scripts/` run unchanged under `node:test`.

```
tests/mock/
  register.mjs   node --import hook entry: maps "@minecraft/server" / "@minecraft/server-ui" to the mocks
  hooks.mjs      the resolve hook
  server.mjs     @minecraft/server mock (+ test control object `__mock`)
  server-ui.mjs  @minecraft/server-ui mock (+ `__ui`)
  enums.mjs      enum values generated from the pinned typings
  vanilla.mjs    registries: mojang-blocks/items/entities/effects + our BP items/entities
  nbt.mjs        self-contained little-endian NBT reader/writer + buildMcstructure()
  harness.mjs    run the add-on in child processes (save / reload tests)
  testkit.mjs    what tests import: { mock, ui, mc, mcui, buildMcstructure, hasVanillaRef, ... }
  script-env.d.ts  `console` declaration for tsc (the game has no setTimeout/DOM/Node)
```

Run tests with `npm test` (= `node --import ./tests/mock/register.mjs --test "tests/**/*.test.mjs"`).
Each `*.test.mjs` file runs in its own process, so the add-on modules are imported once per file.

## Minimal test

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mock, ui } from "./mock/testkit.mjs";
import { world, system } from "@minecraft/server";   // same instances the add-on gets
import "../addon/behavior_pack/scripts/main.js";      // runs initKit/initTorchlight/... once

test("kit on first join", () => {
  mock.reset();                                        // fresh world, subscriptions kept
  const p = mock.addPlayer({ name: "Steve" });         // queues playerJoin + playerSpawn(initialSpawn)
  mock.tick();                                         // jobs -> world sim -> queued after-events
  assert.equal(p.getDynamicProperty("pas:kit_v1"), true);
});
```

## Reference data

`vanilla.mjs` reads the bedrock-samples clone for 1.21.0.26 from `$PAS_VANILLA_REF` (default: the
scratchpad path in `docs/SPEC.md`):

* `metadata/vanilladata_modules/mojang-blocks.json` – block names + state names/types/values. Defaults are the
  first listed value of each state (e.g. `block_light_level` 0, `minecraft:cardinal_direction` "south").
* `mojang-items.json`, `mojang-entities.json`, `mojang-effects.json` – valid ids for `new ItemStack`,
  `spawnEntity`, `addEffect` (unknown id → throws).
* `behavior_pack/entities/*.json` – vanilla entity definitions (families, health, events, groups), parsed leniently
  (they contain comments).

Our own `addon/behavior_pack/items/*.json` (max stack size) and `addon/behavior_pack/entities/*.json`
(families, groups, events, damage sensor) are read too. For `pas:*` entity types without a file yet a built-in
fallback that follows SPEC §3 is used. Without the reference, block/item/entity validation is permissive and
tests that need it should skip: `test("...", { skip: hasVanillaRef() ? false : "no ref" }, ...)`.

## How faithful is it?

| area | behaviour |
|---|---|
| ticks | `system.run` = next tick, `runTimeout(cb,n)` = n ticks (min 1), `runInterval(cb,n)` every n ticks, `clearRun`. One `mock.tick()` = `currentTick++`, run due jobs, simulate (effects, death removal, structure animation), then deliver queued after-events. |
| after-events | Events caused by API calls (`applyDamage`, `kill`, `spawnEntity`, `teleport`, `addPlayer` …) are **queued** and delivered at the end of the tick (or `mock.flush()`), like the game. `mock.fireAfter()` delivers synchronously. |
| before-events | Delivered synchronously in **read-only mode**: every function the 1.11.0 metadata marks as not allowed in read-only mode (`setPermutation`, `setType`, `spawnEntity`, `addTag`, `triggerEvent`, `applyDamage`, `Container.setItem`, `ItemStack.amount=`, `setActionBar`, `structureManager.place/get`, …) throws `Native function [...] does not have required privileges`. Reads, `world.setDynamicProperty` and `system.run` are allowed (as in the metadata). |
| errors in handlers | Recorded in `mock.errors`; `tick()`/`fire*()`/`flush()` then throw a `MockHandlerError` (set `mock.setOptions({throwHandlerErrors:false})` to only record). The game would log them. |
| height | overworld `heightRange` {min:-64,max:320}, nether {0,128}, the_end {0,256}; `max` is exclusive. Out of range → `LocationOutOfWorldBoundariesError` (getBlock, spawnEntity, spawnParticle, place). |
| unloaded chunks | `getBlock` returns `undefined` (documented 1.11.0 return value); `mock.setOptions({unloadedGetBlock:"throw"})` makes it throw `LocationInUnloadedChunkError` instead (the typings list both). A `Block` handle whose chunk unloads throws `LocationInUnloadedChunkError` on access and `isValid()` is false. `spawnEntity`/`spawnParticle`/`place` throw. Entities in unloaded chunks are invalid, absent from `getEntities`/`getEntity`; unloading fires `entityRemove` (before+after), reloading fires `entityLoad`. Players are always loaded. |
| blocks | Sparse storage, default `minecraft:air`. `isLiquid` = water/flowing_water/lava/flowing_lava. Container blocks (chest, trapped_chest, barrel, shulker boxes, hopper, dispenser, dropper, furnaces, brewing stand) get a `minecraft:inventory` component; replacing the block removes it. No block tags (`getTags()` = []). |
| raycast | `getBlockFromRay` is an exact voxel DDA. Air is never hit; liquids only with `includeLiquidBlocks`; passable blocks (no collision: `light_block`, grass/flowers/ferns, torches, rails, buttons, plates, signs, banners, crops, vines, snow_layer, cobweb, …, see `vanilla.mjs`; override with `mock.vanilla.setPassable(id, bool)`) only with `includePassableBlocks`. `faceLocation` is relative to the block. Stops (returns undefined) at unloaded chunks. `maxDistance` default 1000. `includeTypes/excludeTypes/…Permutations` filter hits; `includeTags` never matches. |
| entities | Families = `minecraft:type_family` of base components overridden by active component groups. `triggerEvent` applies `add`/`remove`/`sequence`/`randomize`/`trigger` (filters: `has_tag`, `is_family`, `has_component`, `is_variant`, `is_mark_variant`, `is_skin_id`, `is_color`, `is_baby`, `is_game_mode`; others → false + warning) and **throws for an event the definition does not define**. `spawnEntity("type<event>")` runs that event *instead of* `minecraft:entity_spawned` (like `/summon`). Vanilla mobs do **not** run `minecraft:entity_spawned` by default (deterministic adults; `mock.setOptions({runVanillaSpawnEvents:true})`). |
| damage | `applyDamage` → health −= amount, queued `entityHurt` {damage, damageSource{cause, damagingEntity}} + `entityHealthChanged`; at 0 `entityDie`. `minecraft:damage_sensor` triggers with `deals_damage:false` and `on_damage.filters` (subject other = damager) cancel damage (returns false, no event) → horde friendly fire is blocked if the BP entity says so. Creative/spectator players take no damage. `kill()` → `entityDie` (cause `override`). Dead mobs stay valid for `deathRemovalTicks` (20) then are removed (`entityRemove`). Dead players stay; `mock.respawnPlayer(p)`. |
| components | `minecraft:health` (`currentValue/effectiveMax/setCurrentValue/resetToMaxValue`), `type_family`, `variant`/`mark_variant`/`skin_id`/`color`/`scale` (value from the active component group or `mock.setComponent`), `is_baby`/`is_sheared`/`is_tamed` (presence), `inventory` (players: 36 slots; others if defined), `equippable` (players: Mainhand = inventory slot `selectedSlotIndex`, Offhand/Head/Chest/Legs/Feet), `item` (dropped items). Short ids ("health") work. |
| effects | Validated against mojang-effects; durations count down per tick. `Effect.typeId` is stored without the `minecraft:` prefix; `getEffect` accepts either. |
| dynamic properties | world/entity/item: boolean, number, string, Vector3; anything else throws. Strings longer than **32767 UTF-8 bytes** throw (stricter than or equal to the game's 32767-character limit). Items: only non-stackable items. |
| items | `new ItemStack(id, n)` validates id and 1–255, clamps to max stack (our items from their JSON; vanilla 64/16/1 heuristics). `getItem` returns copies. `Container.addItem` fills matching stacks then empty slots (hotbar first) and returns the leftover. |
| structures | `createEmpty` (needs `ns:` id, unique), `setBlockPermutation` (bounds checked; structure_void throws), `getBlockPermutation`, `createFromWorld`, `get` (memory, then `addon/behavior_pack/structures/<ns>/<name>.mcstructure`), `delete` (pack structures throw), `place`. Rotation: **Rotate90 = clockwise viewed from above**: local (dx,dz) → (−dz,dx), box size x↔z, origin = min corner. `mock.setOptions({rotate90:"ccw"})` simulates an engine whose Rotate90 turns counter-clockwise (Rotate90 ↔ Rotate270, also for `/structure load 90_degrees`), so tests can prove that code calibrates the direction instead of assuming it. Block states are rotated for `minecraft:cardinal_direction`, `minecraft:facing_direction`, `minecraft:block_face`, `facing_direction`, `direction` (legacy S/W/N/E order; trapdoors use the E/W/S/N order), `weirdo_direction`, `pillar_axis`, `portal_axis`, `torch_facing_direction`, `ground_sign_direction`, `lever_direction` (from PocketMine 5.16 semantics). Rail/vine/multi-face bits are not rotated; mirror moves blocks but does not mirror states. Palette index −1 keeps the world block, structure_void is skipped, waterlogging is ignored, chest `Items` NBT fills the container. `animationMode` Layers/Blocks spreads placement over `animationSeconds` (off: `mock.setOptions({animateStructures:false})`). Errors: unknown structure → `InvalidStructureError`, out of height → `LocationOutOfWorldBoundariesError`, unloaded chunk → `LocationInUnloadedChunkError`, integrity outside [0,1]. The `.mcstructure` palette is validated against mojang-blocks (bytes → booleans for bool states). |
| commands | `runCommand` records to `mock.records.commands`; `structure load <name> x y z [rot] [mirror] [layer_by_layer\|block_by_block secs] [includeEntities] [includeBlocks] …` is executed through `structureManager.place` (both overloads from mojang-commands.json); everything else returns `successCount: 0` unless `mock.setCommandHandler((cmd, {dimension, source}) => ({successCount}) \| undefined)` handles it (throw `CommandError` to simulate failure). |
| scoreboard, camera, cooldowns, music | stubs. |

## `mock` (from `testkit.mjs`)

Call as methods (`mock.tick()`), they use `this`.

**time** – `tick(n=1)`, `runUntil(pred, max=2000)`, `flush()` (deliver queued after-events), `settle()`
(await promise callbacks such as `form.show().then(...)`), `currentTick`, `jobs()`.

**world** – `reset({options, keepSubscriptions=true, resetClock=false})`: clears blocks, entities, players, world
properties, structures, records. Subscriptions, pending `system` jobs, the tick counter and entity ids carry
over (modules imported once keep working; time never goes backwards). Dimension objects are stable, so a
cached `world.getDimension("overworld")` stays valid. `setOptions({...})`, `options`.

**blocks** – `setBlock(dimId, loc, nameOrPerm, states?)`, `fill(dimId, from, to, name, states?)`,
`blockName(dimId, loc)`, `blockPerm(dimId, loc)`, `listBlocks(dimId, name?)`, `countBlocks(dimId, name)`,
`containerAt(dimId, loc)`, `dimension(id)`.

**chunks** – `unloadChunk(dimId, cx, cz)`, `loadChunk(...)`, `unloadAt(dimId, loc)`, `loadAt(...)`,
`setLoadedPredicate(dimId, (cx, cz) => bool)` (no load/unload events), `isChunkLoaded(dimId, loc)`.

**players** – `addPlayer({name, location, dimension, gameMode, rotation, spawn=true})` (a player that left
rejoins with the same id/inventory/props), `removePlayer(p, {before=true, after=true})` (beforeEvents.playerLeave sync + afterEvents queued; either can be suppressed),
`respawnPlayer(p, {location})`, `setMainhand(p, idOrStack, n)`, `setOffhand(...)`, `give(p, id, n, slot?)`,
`inventory(p)`, `setView(p, {headLocation, viewDirection, rotation})` (otherwise derived from rotation:
yaw 0 = +z, yaw 90 = −x, pitch 90 = down; head = feet + 1.62).

**entities** – `spawn(typeId, loc, {dimension})` (bypasses read-only), `setComponent(e, id, value|null)`,
`setHealth(e, cur, max?)`, `setFamilies(e, list|undefined)`, `move(e, loc, dim?)`, `groups(e)` (active component
groups), `isDead(e)`, `allEntities()`, `triggered(e?)` (event names passed to `triggerEvent`).

**events** – `fireAfter(name, ev)`, `fireBefore(name, ev)` (returns ev; check `ev.cancel`), `fireSystemAfter(name, ev)`,
`queueAfter(name, ev)`, `scriptEvent(id, message, {sourceEntity})`.
Item use gestures: `useItem(p, {stack})` (before+after itemUse), `useItemOn(p, block|loc, face, {faceLocation,
stack, withItemUse})` (before+after itemUseOn, optionally + itemUse), `holdUse(p, {ticks, every=4, block, face})`
(repeats while advancing time).

**records** – `records.{sounds, particles, commands, messages, actionbars, titles, triggered,
structurePlacements, spawned, music, explosions}` (each entry has `tick`), `clearRecords()`,
`lastActionBar(p)`, `messagesTo(p)`, `errors`, `warnings` (content problems such as an event adding an unknown
component group).

**structures** – `loadStructureFile(id, path)`, `parseStructure(buffer)`, `structureAnimationsPending()`,
`structureTransform(local, size, rotation, mirror)`. Build test files with
`buildMcstructure({size, palette:[{name, states}], indices, blockEntities})` (index = (x·sizeY + y)·sizeZ + z).

**save/reload** – `saveWorld()` → JSON-safe snapshot (blocks, containers, unloaded chunks, entities with
tags/props/groups/component overrides/effects/health, players with inventory/equipment, world props, world-saved
structures, tick). `loadWorld(snapshot)` replaces the world (players come back *offline*), then
`startup()` queues `worldInitialize`, `entityLoad` for every loaded entity and join + `playerSpawn(initialSpawn)`
for the saved players.

## `ui` (server-ui)

```js
ui.respond({ selection: 2 }, player);            // next ActionForm/MessageForm shown to player
ui.respond({ values: { "Population cap": 100 } }); // ModalForm: by label or index; others keep defaults
ui.respond({ formValues: [30, 20, 45, 64, true, true] });
ui.respond({ canceled: true, cancelationReason: "UserBusy" });
ui.respond({ reject: "PlayerQuit" });             // show() rejects with FormRejectError
ui.pressButton(/Pause|Resume/);                   // pick the matching ActionForm button
ui.setHandler((rec) => rec.title === "Settings" ? { values: { 0: 60 } } : undefined);
await mock.settle();                              // let .then() handlers run
ui.shown / ui.last()                              // {kind, playerId, title, body, buttons, button1, button2, controls, tick}
```
Without a queued response a form resolves `{canceled: true, cancelationReason: "UserClosed"}`. Modal values are
validated against the controls (slider range, toggle boolean, dropdown index).

## Save / reload across processes (`harness.mjs`)

Module state (Maps in the add-on) only resets with a new process, so reload tests run two child processes:

```js
// tests/outbreak_reload.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "./mock/harness.mjs";

test("outbreak survives a reload", async () => {
  const a = await runScenario({ script: new URL("./scenarios/outbreak_a.mjs", import.meta.url) });
  const b = await runScenario({ script: new URL("./scenarios/outbreak_b.mjs", import.meta.url), load: a.world });
  assert.equal(b.result.parasites, a.result.parasites);
});
```

```js
// tests/scenarios/outbreak_a.mjs  (not named *.test.mjs, so the runner does not pick it up)
import { scenario } from "../mock/harness.mjs";
const sc = await scenario.begin();   // loads PAS_SCENARIO_IN if given, imports main.js, mock.startup()
const { mock, ui, server } = sc;     // server = the @minecraft/server mock module
const p = mock.addPlayer({ name: "Steve" });
mock.tick(5);
// ... play ...
sc.end({ parasites: server.world.getDimension("overworld").getEntities({ type: "pas:parasite" }).length });
```

`scenario.begin({importAddon, startup, before(mock)})`; `sc.loaded` tells whether a world was loaded.
`runScenario({script | source, load, env, timeoutMs, allowFailure})` resolves `{code, stdout, stderr, result, world}`
and throws (with the child's output) on a non-zero exit. Inline `source` scripts import the harness with
`await import(process.env.PAS_HARNESS)` and must use absolute URLs for other imports.

## Known gaps

No physics/AI/pathfinding (mobs never move or attack by themselves — drive combat with `applyDamage`), no
redstone, no block tags, no item components on `ItemStack` (`getComponent` → undefined), no scoreboard, no
entity properties (`getProperty` → undefined), molang/particles/sounds are only recorded, `/structure` is the only
command executed, block-state rotation covers the common direction states only, `getEntitiesFromRay` uses a
0.8-block radius around the entity position. Vanilla validation is only as good as the 1.21.0.26 samples.
