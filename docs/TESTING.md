# Testing and building

Target: Minecraft Bedrock **Preview 1.21.0.26** (Android). Script modules `@minecraft/server` 1.11.0 and
`@minecraft/server-ui` 1.1.0. Everything below runs offline except `npm install`.

## Requirements

* Node.js 22 (npm 10)
* Python 3.13 (standard library only for `tools/build.py` and `tools/validate.py`)
* The vanilla reference for this exact build (Mojang `bedrock-samples` tag `v1.21.0.26-preview`). Its location
  is read from `PAS_VANILLA_REF`, default
  `/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26`.
  Without it, vanilla checks are skipped with a warning and tests that need it are skipped.

```sh
npm install                 # typescript 5.9.3 + typings pinned to the 1.21.0.26 preview (see below)
npm run typecheck           # tsc -p tsconfig.json
npm test                    # node --import ./tests/mock/register.mjs --test "tests/**/*.test.mjs"
npm run validate            # python3 tools/validate.py
npm run build               # python3 tools/build.py  (merges fragments, validates, writes dist/)
```

## Type checking (`npm run typecheck`)

`tsconfig.json` type-checks every `addon/behavior_pack/scripts/**/*.js` (`allowJs`, `checkJs`, `strict`,
`noEmit`, target ES2020, lib ES2020 only) against:

* `@minecraft/server@1.11.0-rc.1.21.0-preview.26` – typings generated from this exact build (checked member by
  member against `metadata/script_modules/@minecraft/server_1.11.0.json`),
* `@minecraft/server-ui@1.1.0` – its `@minecraft/server` dependency is forced to the same version through
  `overrides` (`npm ls @minecraft/server` shows one copy, "deduped"),
* `@minecraft/common@1.2.0` (pinned through `overrides`; present in the 1.21.0.26 metadata).

Only `console` is declared as a global (`tests/mock/script-env.d.ts`): the game has no `setTimeout`, DOM or Node
APIs, so using them is a type error. Use JSDoc casts for `getComponent`, e.g.
`/** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (e.getComponent("minecraft:health"))`.
A method that does not exist in 1.11.0 (e.g. `system.runJob`) fails the type check.

## Unit and behaviour tests (`npm test`)

`tests/mock/register.mjs` installs a Node resolve hook that maps `@minecraft/server` and `@minecraft/server-ui`
to the behavioural mock in `tests/mock/`. The add-on's real script files are imported unchanged. The mock is
documented in [`tests/mock/README.md`](../tests/mock/README.md): tick driver, sparse dimensions with
loaded/unloaded chunks and height limits, block-state validation against `mojang-blocks.json`, entities with
families/component groups/events from the real entity JSON, damage and death events, read-only before-events,
structure placement (including our `.mcstructure`), forms, and world save/reload (in process, and across two
child processes with `tests/mock/harness.mjs`).

* Test files: `tests/**/*.test.mjs` (each file runs in its own process; the add-on is imported once per file).
  Helper scripts for child processes must *not* end in `.test.mjs` (e.g. `tests/scenarios/*.mjs`).
* `tests/lib.test.mjs` – shared library: vectors/keys/yaw, `safe`, `safeGetBlock` with unloaded and
  out-of-world locations, held-item helpers, `consumeHeld` per game mode, `giveOrDrop`; store chunking
  (> 30 000 chars, UTF-8, stale parts), corrupt data, `scheduleSave` throttling; item dispatcher debounce
  (tap, block tap with three events, hold, 6/7-tick spacing, per player, deferred out of read-only mode,
  error containment); starting kit given exactly once.
* `tests/lib_mock.test.mjs` – mock self-test against the reference: `light_block` level 15 resolves and 16 throws,
  `dark_oak_door` states, item/entity/effect id validation, height range, unloaded chunk behaviour, read-only
  mode, raycast (faces, passable/liquid flags, maxDistance, unloaded chunks), vanilla and `pas:*` families,
  dormant/active events, friendly-fire damage sensor, query options, structure rotation (Rotate90 = clockwise
  from above), `/structure load` fallback, `.mcstructure` round trip, forms, save/reload (in-process and two processes).
* Run one file: `node --import ./tests/mock/register.mjs --test tests/lib.test.mjs`.
  Run by name: `node --import ./tests/mock/register.mjs --test --test-name-pattern="debounce" "tests/**/*.test.mjs"`.

Note: `node --test tests/` (a bare directory) does not work on Node 22 (the directory is imported as a module),
hence the glob in `npm test`.

## Static validation (`npm run validate`)

`python3 tools/validate.py [--strict] [--json] [--quiet]` cross-checks both packs against each other and the
vanilla reference: strict JSON, manifests (SPEC §2 uuids, dependencies, script entry, module versions present
and non-beta in the reference), items (1.20.80 component schema, icon → `item_texture.json` → png), BP entities
(SPEC §3 families/flags/groups/events, event → group references, unreferenced groups, self-targeted events,
loot tables), RP client entities and attachables (geometry, textures, animations, animation controllers,
render controllers and the `Geometry./Texture./Material.` keys they use, `scripts.animate` keys, materials limited
to names used by vanilla client entities/attachables – the list is printed), particles, sounds (files exist as
our `.ogg/.wav/.fsb` or in the vanilla listing; every id used by `sounds.json` and `ids.js` is defined),
lang keys, script imports (relative paths resolve; only `@minecraft/server` and `@minecraft/server-ui`), and the
luxury base structure.

Content another workstream has not delivered yet is a **warning** (`missing: ...`); `--strict` turns those into
errors (use it before a release). Broken references in existing files are always errors. Exit code 1 on errors.
If generated files are not built yet, the validator reads the fragments directly.

## Build (`npm run build`)

`python3 tools/build.py [--strict] [--skip-validate] [--no-package]`

1. Merges `addon/fragments/lang/*.lang` → `resource_pack/texts/en_US.lang` (+ `pack.*` keys →
   `behavior_pack/texts/en_US.lang`) and writes `texts/languages.json` (`["en_US"]`) in both packs.
2. Merges `addon/fragments/item_texture/*.json` → `resource_pack/textures/item_texture.json`
   (`resource_pack_name` "pas", `texture_name` "atlas.items").
3. Merges `addon/fragments/sound_definitions/*.json` → `resource_pack/sounds/sound_definitions.json`
   (`format_version` "1.14.0", same layout as the vanilla file).
4. Deep-merges `addon/fragments/sounds/*.json` → `resource_pack/sounds.json`.
   A key defined twice across fragments is a build error in every merge.
5. Runs `tools/validate.py` (fails the build on errors).
6. Writes `dist/ParasiteApocalypseSurvival.mcaddon` (folders `Parasite Apocalypse BP/` and
   `Parasite Apocalypse RP/`, each with `manifest.json` at its root), `dist/ParasiteApocalypseSurvival_BP.mcpack`,
   `dist/ParasiteApocalypseSurvival_RP.mcpack` and unpacked copies in `dist/unpacked/` (git-ignored).
   Zips are deterministic (sorted entries, 1980-01-01 timestamps, fixed permissions; identical inputs give
   identical sha256) and exclude dev files (`.*`, `*.md`, `*.py`, `__pycache__`, editor/backup files, art sources).

Generated files (`texts/*.lang`, `texts/languages.json`, `item_texture.json`, `sound_definitions.json`,
`sounds.json`) are only written by `tools/build.py`; edit the fragments instead.

## Installing on the device

Copy `dist/ParasiteApocalypseSurvival.mcaddon` to the phone and open it with Minecraft Preview 1.21.0.26, or
import the two `.mcpack` files. Enable both packs on the world. No experimental toggles are needed.
