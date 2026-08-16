# Luxury Tech House — Minecraft Bedrock add-on

Builds and runs a functional futuristic smart mansion. Tap the ground with the
**Luxury Tech House Builder** and the estate goes up around you; the **Mansion
Tech Remote** opens the control panel for doors, lifts, lighting and the
concealed systems.

## Install

Download `dist/LuxuryTechHouse.mcaddon` and open it — Minecraft imports both
packs. In the world settings, apply **Luxury Tech House BP**; the resource pack
comes along with it automatically.

The mansion is placed with `/fill`, so the world needs **Cheats → Activate
Cheats** switched on. If it is off, the Builder now says so in chat instead of
appearing to do nothing.

## Requirements

Minecraft Bedrock **1.21.0** or newer, including the 1.21.0 beta. No
experimental toggles are needed.

`min_engine_version` is pinned to 1.21.0. The script modules ask for the
*lowest* releases that contain every API the add-on touches — `@minecraft/server`
1.7.0 and `@minecraft/server-ui` 1.0.0 — rather than the newest. Minecraft
fulfils a minor-version dependency with any higher minor in the same major, so
asking low is what makes the pack work across the widest range of builds;
asking for a version the running game does not have makes the script module
silently fail to load while the items still register. `build.sh` fails the
build if `min_engine_version` or an item `format_version` drifts above the
target.

Items use `format_version` 1.20.50 with `"minecraft:icon": {"texture": ...}`,
which is exactly what Mojang's own behaviour pack ships inside 1.21.0.

## Fixes in this branch

Two reported problems: the item texture was invisible, and tapping to build did
nothing.

**Invisible item texture.** The items declared `"format_version": "1.21.0"` but
wrote their icon in the newer shape:

```json
"minecraft:icon": { "textures": { "default": "lux_house_builder" } }
```

The `textures` map is not part of the 1.21.0 item schema — that schema only
understands `{ "texture": "..." }` — so the icon field parsed to nothing and
both tools rendered blank. The PNGs and `item_texture.json` were fine all along.
The icon is now written in the shape 1.21.0 actually reads:

```json
"minecraft:icon": { "texture": "lux_house_builder" }
```

**Tapping to build did nothing.** Three separate causes:

1. The build was reachable only through `itemUse`, which is the mid-air
   long-press. Tapping a block with the Builder — the obvious move on a phone —
   delivers `itemUseOn` instead, and nothing was listening. Both routes, plus
   `playerInteractWithBlock` where the engine has it, now go through one
   debounced entry point, so a tap that arrives on several channels still
   builds exactly once. `/scriptevent lux:build` works as a manual fallback.
2. `world.beforeEvents.playerInteractWithBlock` does not exist in
   `@minecraft/server` 1.11.0 at all — that pair first appears in 1.17.0. The
   subscription threw and was swallowed by the `safe()` wrapper. It stays
   wrapped, so it is a no-op on 1.21.0 and lights up by itself on a newer
   engine. Until then the hidden triggers (lectern, flower pot, lodestone) are
   inert; each has a physical button beside it and the Tech Remote's Concealed
   Systems panel drives all of them, so nothing is unreachable.
3. Every failure was silent. A world with cheats off rejected all 2,282 build
   commands while the progress bar filled to 100% over untouched ground. The
   queue now counts successes and failures, and the Builder reports "none of the
   block commands were allowed to run" with the fix, or a partial-failure
   warning when only some commands are rejected.

## Updating an installed copy

Minecraft keys an installed pack on uuid **and** version, and a re-import that
matches both leaves the copy already on disk untouched — a fixed pack then
behaves exactly like the broken one. Every release that needs to reach an
existing install must bump `version` in both manifests, and the behaviour
pack's dependency entry has to track the resource pack's new version.
`build.sh` fails the build if those two disagree.

## Layout

```
src/luxury_tech_house_bp/   behaviour pack — items, scripts, manifest
src/luxury_tech_house_rp/   resource pack — icons, item_texture.json, lang
tools/test.js               offline test harness
node_modules/@minecraft/    hand-written mocks the harness runs against
build.sh                    validates the JSON and zips dist/*.mcaddon
```

## Development

```bash
node tools/test.js                # against a current script API
MC_API=1.11.0 node tools/test.js  # against what 1.21.0 actually exposes
./build.sh                        # validates, writes dist/LuxuryTechHouse.mcaddon
```

`MC_API=1.11.0` drops `playerInteractWithBlock` from the mocks to match the
1.21.0 surface, which is how the "does it still build with that event missing?"
case is covered.

`node_modules/@minecraft/*` is committed on purpose: those are small
hand-written stand-ins for the Minecraft script APIs, not fetched packages. They
let the add-on's real logic run under plain Node so the build pipeline can be
exercised without a console.
