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

Minecraft Bedrock **1.21.60** or newer. No experimental toggles are needed.

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
The items now declare `"format_version": "1.21.60"`, which is the schema the
`textures` map belongs to.

**Tapping to build did nothing.** Three separate causes:

1. The behaviour pack asked for `@minecraft/server` **1.11.0**, which does not
   contain `playerInteractWithBlock` on either `beforeEvents` or `afterEvents` —
   that pair only exists from 1.17.0. The subscription threw, was swallowed by
   the `safe()` wrapper, and every hidden trigger and secret door in the house
   was dead. Bumped to `@minecraft/server` 1.17.0 and `@minecraft/server-ui`
   1.3.0, with `min_engine_version` raised to 1.21.60 to match.
2. The build was reachable only through `itemUse`, which is the mid-air
   long-press. Tapping a block with the Builder — the obvious move on a phone —
   delivers `itemUseOn` / `playerInteractWithBlock` instead, and nothing was
   listening. All routes now go through one debounced entry point, so a tap that
   arrives on three channels still builds exactly once. `/scriptevent lux:build`
   works as a manual fallback.
3. Every failure was silent. A world with cheats off rejected all 2,282 build
   commands while the progress bar filled to 100% over untouched ground. The
   queue now counts successes and failures, and the Builder reports "none of the
   block commands were allowed to run" with the fix, or a partial-failure
   warning when only some commands are rejected.

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
node tools/test.js   # exercises every build trigger path, no device needed
./build.sh           # validates JSON, writes dist/LuxuryTechHouse.mcaddon
```

`node_modules/@minecraft/*` is committed on purpose: those are small
hand-written stand-ins for the Minecraft script APIs, not fetched packages. They
let the add-on's real logic run under plain Node so the build pipeline can be
exercised without a console.
