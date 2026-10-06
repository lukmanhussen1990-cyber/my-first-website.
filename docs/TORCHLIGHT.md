# Tactical Torchlight — how it works

The Tactical Torchlight (`pas:tactical_torchlight` / `pas:tactical_torchlight_on`) is a
hand-held light. When it is on, the area the player looks at really gets brighter for every
player in the world. This is block light that mobs, crops and other players' screens all see,
not an overlay. This document covers SPEC §5: the script in `addon/behavior_pack/scripts/torchlight/`.

## Using it

* **Toggle:** tap/use with the torch in either hand, in the air or on a block. The stack in that
  hand becomes the other variant. Its custom name, lore, keep-on-death, lock mode,
  can-destroy/can-place-on lists and item dynamic properties are kept. You hear `pas.torch.on` or
  `pas.torch.off`, and the actionbar shows `Torchlight ON` or `Torchlight OFF`. Holding the button
  toggles once, because the shared item dispatcher ignores events that come within 6 ticks of the previous one.
* **Light:** the lit torch shines in the **main hand or the off hand**. Put it away (switch the hotbar slot,
  drop it, move it into the inventory), turn it off, die, leave or change dimension, and the light is gone.

## Files

| file | role |
|---|---|
| `torchlight/index.js` | `initTorchlight()`, the toggle, the 2-tick update loop, the 40-tick maintenance pass, cleanup events |
| `torchlight/beam.js` | read-only geometry: the raycast (API plus a manual DDA fallback), anchor placement, the air-cell search |
| `torchlight/lights.js` | light-block ownership (reference counted), placing and removing, persistence, startup and pending cleanup |
| `torchlight/constants.js` | tunables (distances, levels, intervals) and block-id helpers |

## The beam

Every **2 ticks** (10 times a second), for each living player holding `pas:tactical_torchlight_on`:

1. **Ray.** The ray starts at `player.getHeadLocation()` and follows `player.getViewDirection()`:
   `dimension.getBlockFromRay(head, dir, { maxDistance: 24, includeLiquidBlocks: false, includePassableBlocks: false, excludeTypes: ["minecraft:light_block"] })`.
   The option names were verified against `BlockRaycastOptions` and `BlockFilter` in the 1.11.0 metadata.
   * Liquids and collision-less blocks (grass, flowers, torches, our own light blocks) do not stop the beam.
   * If a build rejects `excludeTypes`, the filter is dropped for the session.
   * If the raycast throws, or reports one of our light blocks as a hit, a manual voxel walk (Amanatides–Woo DDA)
     with a passability heuristic replaces it. A test checks that it matches the API raycast on 400 random rays.
   * The hit distance comes from a ray/box intersection with the hit cell, so it does not depend on
     how a build reports `faceLocation`.
2. **Anchors.** The beam places up to three light anchors along the ray:

   | anchor | where | level |
   |---|---|---|
   | spot | the cell in front of the hit face (hit block + face normal); with no hit, the beam end at 24 blocks | 15 |
   | mid | 45 % of the beam length | 13 |
   | near | 2.5 blocks ahead of the eyes | 11 |

   Mid and near stay at least 0.25 blocks in front of the hit point, so light never ends up behind a wall.
3. **Only air.** An anchor cell must be exactly `minecraft:air`, or a light block this script already owns
   (shared, or one whose level changes).
   * If it is not, the search walks back along the ray towards the eyes, in half-block steps up to 3 blocks.
   * If that fails, it tries the anchor's 6 neighbours.
   * If that fails too, the anchor is skipped.
   * Water, short grass, torches, chests, foreign light blocks and everything else are **never replaced**.
4. **Collapse.** Anchors that resolve to the same cell merge, and the highest level wins.
   For example, looking at the floor at your feet gives a single 15.
5. **Write.** New cells are placed first and stale cells are removed afterwards, so the light never flickers.
   A light block is `BlockPermutation.resolve("minecraft:light_block", { block_light_level: N })`
   (the verified 1.21.0.26 state). Newer builds that split the block into ids get `minecraft:light_block_<N>`
   as a cached fallback.

**Skipping work.** A signature (dimension, raw anchor cells and levels) is compared with the last update.
If it is unchanged, nothing is read or written except the raycast. The anchors are still re-checked once
every 20 ticks. That re-check also restores a light block that someone removed by other means.

## Ownership and cleanup

* `cells`: a global map `cellKey -> { owners: Map<playerId, wanted level> }`. The owners' keys are the
  `Set<playerId>` of SPEC §5; the wanted levels let a shared cell show the highest level. There is also a
  per-player map of the cells each player owns.
* A cell goes back to air only when its **last owner** releases it **and** it is still a light block.
  If a player replaced the light block with stone, the stone stays.
* If a released cell's chunk is unloaded, the cell goes to a **pending** list. That list is retried every
  40 ticks (at most 64 cells per pass) until the chunk loads.

| trigger | how |
|---|---|
| switching item, putting the torch away | the next update sees no lit torch in either hand |
| turning it off | immediately, in the toggle handler |
| death | `world.afterEvents.entityDie` (players only). Nothing lights up while dead, even if the torch was kept; it lights again after `playerSpawn` |
| leaving | `world.beforeEvents.playerLeave` (read-only, so it only records the id and defers the cleanup with `system.run`) **and** `world.afterEvents.playerLeave` (by `playerId`). A 40-tick sweep of players who are no longer online is the last resort |
| dimension change | `world.afterEvents.playerDimensionChange` releases the cells in `fromDimension`; each update also checks the player's dimension against the one their cells are in |
| script start | every cell stored by the previous session is cleaned up (see below) |

## Persistence and crash safety

* Every owned and pending cell is saved in the world dynamic property `pas:torch_cells` as
  `[[dimId, x, y, z], ...]`, through `store.scheduleSave` (at most one write per 20 ticks).
* **On startup**, on the first tick, every stored cell is queued.
  * A queued cell is set to air only if it still holds a light block that nobody owns.
  * Cells in unloaded chunks stay pending **and stay in the saved list**, so the next reload still knows
    about them, until the chunk loads and they can be cleared. A light block cannot be orphaned by a crash or reload.
* Corrupt entries, unknown dimensions and coordinates outside the height range are ignored.

## Performance (mobile budget)

* A player who is not holding the lit torch costs two equipment-slot reads per update: no raycast, no block reads, no writes.
  The 40-tick maintenance pass does nothing when there are no pending cells and no tracked players.
* A lit player costs:
  * 1 native raycast per update;
  * on change only, about 3 block reads (worst case 3×13 while searching for air);
  * at most 6 block writes per update: 3 placements plus 3 removals, plus rare re-levels of shared cells.
* A player standing still costs 0 writes, and about 3 reads per second for the re-check.
* No full-world scans. All work is per player and bounded. Every handler and interval is wrapped by `safe()`,
  and each player is updated inside its own try/catch.

## Tests

`npm test` runs `tests/torch.test.mjs` (38 tests in-process against the mock) and `tests/torch_reload.test.mjs`
(three child processes). Highlights:

* toggle in either hand with item data kept, a block tap, holding the button;
* exact light permutations for a dark room, the light following the view, a floor look (collapse), the beam end, a thin wall;
* water, grass, torch, chest and foreign light blocks never touched;
* every cleanup path, including the replaced-with-stone case and unloaded chunks;
* reference counting with different levels;
* void, unloaded chunks and the throwing `getBlock` variant;
* DDA fallback parity, a raycast that rejects the filter or hits light blocks, and the permutation fallback;
* write and read budgets;
* crash, then a reload with the chunk unloaded, then a second reload, then the chunk loads, with the list empty at the end.

## Limitations (Bedrock Preview 1.21.0.26 on Android, RenderDragon, Mali-G57)

* **No real dynamic lights.** Scripts on this build cannot create dynamic light sources, spot or cone lights,
  or dynamic shadows. Vibrant Visuals and deferred lighting are not available on this build and device.
  Held items do not emit light in Bedrock.
* **What it really is.** The light comes from invisible `minecraft:light_block` blocks placed in air cells.
  * That gives **block granularity**: the anchors jump from cell to cell.
  * The maximum level is 15.
  * The light spreads **in all directions**, dropping one level per block, and vanilla smooth lighting blends it.
  * There is no cone, no sharp beam edge, no falloff by angle and no shadows cast by the beam.
* **The beam is an approximation.** It is three anchors along the view ray, updated 10 times a second.
  When you move or turn fast, the lit area trails slightly, because the engine recomputes and sends lighting
  after each block change. On a slow device the relighting can lag a little more.
* **No air, no light.** Underwater, inside lava, or in any spot with no air within reach of an anchor gets no light.
  @minecraft/server 1.11.0 has no waterlogging API, so a light block cannot be put inside water, and replacing
  water is not allowed. Water that later flows into a lit cell is vanilla behaviour; the cleanup only ever turns
  light blocks back into air.
* **Other players.**
  * Everyone sees the illuminated area. It is real world light, consistent in multiplayer.
  * They do not see the light blocks themselves; Bedrock only shows those to players holding a light block item.
  * The torch model and its glowing lens come from the attachable. The beam itself is not a visible geometry.
  * Lit cells also count for mob spawning, which needs block light 0, and for plant growth.
* **Interaction with building.**
  * Light blocks are replaceable. A player can place a block into a lit cell; the script then leaves that block alone.
  * Looking at the open sky puts the spot at the beam end, 24 blocks away. That is harmless but useless.
* **Crash window.** The cell list is saved at most once per second. If the game crashes within about one second
  of a light block being placed, before that save, and Bedrock had already written the chunk containing the
  block, that block can survive as an orphan. Bedrock saves chunks and world data independently, so a script
  cannot close this window completely.
* **Fallback raycast.** It is only used if `getBlockFromRay` fails. It uses a built-in list of collision-less
  blocks, so an unusual block from a newer version could stop or pass the beam differently there.

## Untestable offline

These need a device check in Preview 1.21.0.26:
* the look of the lighting: smooth-lighting gradients, and how fast relighting is on the Mali-G57;
* whether `getBlockFromRay` treats `minecraft:light_block` as passable, and whether it honours `excludeTypes`
  (both are handled either way);
* whether `getBlock` in unloaded chunks returns `undefined` or throws (both are handled);
* how the off-hand item use is reported (the toggle looks for the used item in either hand);
* the exact moment Bedrock persists dynamic properties compared with chunks.
