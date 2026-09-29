# Natural Disaster Simulator (Minecraft Bedrock 1.21.0.26)

Behavior pack + resource pack in one file: `Natural_Disasters_1.21.0.26.mcaddon` (repo root).
Script API targets `@minecraft/server` 1.10.0 and `@minecraft/server-ui` 1.1.0 (no experiments needed for the scripts).

## Install (Android)
1. Copy `Natural_Disasters_1.21.0.26.mcaddon` to the phone and tap it (or open it with Minecraft). Both packs import.
2. Create/edit a world, open **Behavior Packs** and **Resource Packs**, activate *Natural Disaster Simulator BP* and *RP*.
3. Turn on **Cheats** if you want `/give` and `/scriptevent`. Creative mode shows the items in the **Items** tab (search "Spawn", "Earthquake", "Disaster").

## Items (hold one and tap/use it - the disaster starts where you look, up to 96 blocks away)
| Item | Effect |
|---|---|
| Spawn Tornado / Spawn EF5 Tornado | travelling funnel that pulls, lifts, spins and throws mobs, players, items and debris |
| Spawn Tsunami | moving wall of water that shoves everything and floods low ground (temporary water) |
| Spawn Volcano | ash column, lava fountain, flying lava bombs, burning ground |
| Earthquake M4 / M6 / M9 | camera shake, rumble, dust, falling debris, ground cracks (M6/M9) |
| Meteor Strike | falling fireball, whistle, explosion, crater, fire, smoke, expanding shockwave |
| Supercell | thunderstorm, rain, wind gusts, lightning |
| Hurricane | huge cyclone with a calm eye, violent eyewall, spiral rain bands, flying debris |
| Wildfire | fire that spreads cell by cell through grass, leaves and wood, pushed by wind |
| Blizzard | whiteout fog, snow, wind; exposed entities are slowed and slowly frozen |
| Sinkhole | ground cracks, then a bowl collapses from the centre outward, pulling entities in |
| STOP ALL DISASTERS | ends everything instantly, removes temporary entities/particles, restores temporary blocks |
| Disaster Controller | settings form (see below) |

`/give @s nd:spawn_tornado` (ids: `spawn_tornado, spawn_ef5_tornado, spawn_tsunami, spawn_volcano, earthquake_m4, earthquake_m6, earthquake_m9, meteor_strike, supercell, hurricane, wildfire, blizzard, sinkhole, stop_all_disasters, disaster_controller`, all prefixed `nd:`).

## Disaster Controller (world settings, saved with the world)
Strength 1-5, duration 25-300 %, **block destruction ON/OFF**, mob damage ON/OFF, player damage ON/OFF, automatic random disasters ON/OFF + interval, performance (Low/Balanced/High), debug logging, reset to safe defaults.

### Safety defaults
* **Block destruction is OFF by default.** With it OFF nothing is permanently changed: craters, cracks, flood water, snow and ice are placed as *temporary* edits, journaled and put back when the disaster ends (also after a crash/quit: the journal is saved in world properties and replayed on the next load). Explosions and lightning are cosmetic (particles, sound, knockback, optional damage) instead of real.
* Turning destruction ON asks for confirmation and is clearly marked as permanent. Bedrock, spawners, chests, command blocks, portals, beds and other protected blocks are never touched.
* Damage switches are honoured everywhere; when damage is OFF, thrown entities also get fall protection.
* Automatic disasters are OFF by default.

## Performance on phones
Particle, sound, entity, block-operation and victim-scan budgets per tick; effects are culled by distance to players; updates run every 2-4 ticks (staggered); max concurrent disasters 2/3/4 by quality; all temporary entities are tagged `nd_temp`, capped, time-limited and swept on load. Use **Low** on weak devices.

## Commands (optional, need cheats)
`/scriptevent nd:spawn <disaster> [variant]`, `nd:stop`, `nd:status`, `nd:reset`, `nd:set <setting> <value>`.

## Development
```
cd natural-disasters/tools && npm ci
./node_modules/.bin/tsc -p tsconfig.json          # type-check all scripts against the 1.10.0 typings
python3 validate.py                                # JSON, UUIDs, dependencies, assets, ids, forbidden APIs
node --import ./sim/register.mjs ./sim/run.mjs     # headless simulation of every disaster on a mock world
python3 build.py                                   # all of the above, then builds the .mcaddon
python3 gen_sounds.py; python3 gen_visuals.py; python3 gen_icons.py; python3 gen_behavior_entities.py   # regenerate assets
```

## What has and has not been verified
Verified here: TypeScript check of every script against the real 1.10.0 typings; JSON/manifest/UUID/dependency/asset/id validation; a strict headless simulation (39 disaster runs across three setting profiles plus item debounce, concurrency cap, STOP ALL, controller form, script events, auto scheduler and crash recovery) confirming no script errors, budgets respected, all temporary blocks/entities/fog/shake/weather cleaned up, and damage switches honoured.
**Not verified:** actual play in Minecraft on an Android device (world launch, touch activation, real rendering of particles/fog/sounds, real physics feel). The simulation uses a mock of the Script API, and particle/fog/entity JSON was written from the documented formats, so visual tuning (sizes, speeds, sound levels) may need adjustment on device.
