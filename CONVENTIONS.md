# Luxury Tech Mycelium-X — build conventions

Target: **Minecraft Bedrock 1.21.0.26 (Android beta)**. Not Java. No experiments required.

## Hard rules

- Namespace for everything: `myc`. Identifiers are `myc:snake_case`.
- Behaviour pack root: `src/behavior_pack/`. Resource pack root: `src/resource_pack/`.
- Script module is `@minecraft/server` **1.11.0** only. No `@minecraft/server-ui`, no beta modules.
  - Only APIs that are stable in 1.11.0. Use `runCommandAsync` (never sync `runCommand`).
- No `.mcstructure` binaries. The mansion is built from `.mcfunction` files using
  **relative coordinates (`~ ~ ~`)**, positioned by the caller via `execute positioned`.
- No natural `spawn_rules` for infected mobs. All spawning is script-driven and budget-capped.
- Mobile performance: no per-tick world scans, no unbounded entity queries, particle emitters
  must be short-lived and low-rate.

## Format versions (verified for the 1.21.0 line)

| File kind | `format_version` |
|---|---|
| BP entity | `1.21.0` |
| BP item | `1.20.50` |
| BP block | `1.20.60` |
| RP client entity | `1.10.0` |
| RP geometry | `1.12.0` |
| RP render controller | `1.8.0` |
| RP animation | `1.8.0` |
| RP animation controller | `1.10.0` |
| RP particle | `1.10.0` |
| `sound_definitions.json` | `1.14.0` |
| manifests | `2` |

## Entity roster

All infected share family `myc_infected` plus `monster` and `undead`.

| Identifier | Health | Speed | Damage | Notes |
|---|---|---|---|---|
| `myc:infected_walker` | 20 | 0.21 | 3 | baseline, common |
| `myc:infected_runner` | 14 | 0.42 | 4 | fast, fragile, leaps |
| `myc:fungal_brute` | 60 | 0.19 | 9 | tanky, knockback resistant, rare |
| `myc:spore_crawler` | 10 | 0.30 | 2 | small, explodes into spores on death |
| `myc:mycelium_stalker` | 34 | 0.28 | 6 | invisible at range, very rare, night hunter |

Support entity: `myc:nest_core` — a static, non-moving spawn anchor with 40 HP.

## Texture registry

Item textures live in `src/resource_pack/textures/items/` and are registered in
`textures/item_texture.json` under these short keys:

`myc_scanner`, `myc_spore_mask`, `myc_protective_suit`, `myc_medkit`,
`myc_suppressant`, `myc_contamination_detector`, `myc_spore_sample`, `myc_biofilter`

Block textures live in `src/resource_pack/textures/blocks/` registered in
`textures/terrain_texture.json` under: `myc_fungal_growth`, `myc_infected_block`,
`myc_nest`, `myc_spore_vent`, `myc_lab_panel`, `myc_server_rack`, `myc_screen`,
`myc_alarm_light`, `myc_clean_panel`

Entity textures live in `src/resource_pack/textures/entity/myc/<name>.png`.

## Scoreboard objectives (created by the script, also readable from functions)

| Objective | Meaning |
|---|---|
| `myc_inf` | per-player infection 0..100 |
| `myc_sys` | global fake-player state: `#outbreak` 0/1, `#day`, `#level` 1..5, `#lockdown` 0/1 |
| `myc_pos` | mansion origin: `#mx`, `#my`, `#mz` |

## Script events (fired from `.mcfunction`, handled in `scripts/main.js`)

`myc:build`, `myc:build_now`, `myc:outbreak_start`, `myc:outbreak_stop`,
`myc:outbreak_status`, `myc:lockdown`, `myc:unlock`, `myc:scan`, `myc:cure`,
`myc:infect`, `myc:nest`, `myc:kit`

## Localisation

Every user-facing string goes in `texts/en_US.lang` of the owning pack.
Name keys: items use `item.myc:x` (both `item.myc:x` and `item.myc:x.name` are
emitted, since Bedrock has resolved custom item names through each of them
across releases), blocks use `tile.myc:x.name`, entities use `entity.myc:x.name`.
