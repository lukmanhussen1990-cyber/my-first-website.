# Bunker Arsenal — Minecraft Bedrock add-on (mobile, 1.21.0)

An underground military bunker + sci-fi/military weapons add-on built for **Minecraft Bedrock Edition 1.21.0**
(the `beta 1.21.0.26` build shown in the reference screenshot) on Android/iOS. Everything is Bedrock-only
(behavior pack + resource pack + stable Script API); no Java features, no experimental toggles required.

| Pack | Purpose |
|------|---------|
| `dist/BunkerArsenal.mcaddon` | One-tap install: contains both packs below |
| `dist/BunkerArsenal_BP.mcpack` | Behavior pack: items, blocks, entities, recipes, loot, structures, world-gen, scripts |
| `dist/BunkerArsenal_RP.mcpack` | Resource pack: 16×16 pixel-art icons/textures, models, flipbook animations, sounds, UI text |

## Install on a phone or tablet

1. Download `dist/BunkerArsenal.mcaddon` to the device (any browser/file app).
2. Tap the file and choose **Open with Minecraft**. Minecraft opens and imports *Bunker Arsenal* (behavior + resource pack).
3. **Play → Create New** (or edit an existing world) → **Behavior Packs → My Packs → Bunker Arsenal → Activate**.
   The resource pack is activated automatically because the behavior pack depends on it.
4. Leave *Experiments* off; nothing here needs them. Start the world.

Manual alternative (Android): unzip the `.mcaddon` and copy `BunkerArsenal_BP` to
`Android/data/com.mojang.minecraftpe/files/games/com.mojang/behavior_packs/` and `BunkerArsenal_RP` to
`.../games/com.mojang/resource_packs/`, then activate as above.

On first join you receive a **Field Terminal**, a **Service Pistol** and 2 **Light Magazines**.
Open the Field Terminal → *Field manual* for in-game help.

## Controls (touch)

| Action | How |
|--------|-----|
| Fire | Tap the screen while holding a gun (semi-auto). **Hold** to fire automatic weapons (SMG, rifle, LMG, pulse rifle) |
| Reload | Happens automatically when the magazine is empty if you carry a matching magazine. Reload early from the Armory |
| Armory / inventory interface | Use the **Field Terminal** item or tap any **Control Panel** block |
| Throw grenades | Tap with a Frag or Stun grenade selected |
| Medkit | Hold to use (1.6 s): +4 hearts, regeneration, cures poison |
| Blast doors | Tap to open; they close again after 6 s. Sealed doors need a **Bunker Keycard** |
| Crates | Tap a Supply/Weapon crate to loot it; break it afterwards to pick the crate up |
| Build a bunker | Use a **Bunker Blueprint** → pick *Command Complex* or *Outpost*, depth, entrance shaft → Build |

## The bunker

**Command Complex (47×6×47)** — reinforced steel/tuff walls with oxidized-copper panels (the Trial-Chamber palette of the reference image),
four lit corridors with pipes, vents and floor grates, and nine areas:

- **Central Command** — map table, four control consoles, server racks, wall monitors (animated), raised ceiling
- **Armory** — weapon crates, lockers, armory terminal · **Workshop** — crafting table, anvil, smithing table, furnaces
- **Storage** — loot barrels and supply crates · **Mess hall** — tables, stools, kitchen
- **Medical bay** — beds, brewing stands, medical barrels · **Barracks** — 12 beds and lockers
- **Server room** — racks, consoles, monitors · **Generator room** — copper reactor cage, copper bulbs, pipes
- **Airlock** with a reinforced ladder shaft and a surface hatch (built by the blueprint)

**Outpost (27×6×13)** — a compact three-room bunker (storage, command, bunks) that also **generates naturally**
deep underground in newly generated overworld chunks (roughly one per 180 chunks, Y −24…30). Dig or cave to find them.

Both layouts also ship as `.mcstructure` files, so with cheats on you can place them anywhere:
`/structure load bunker:command_complex ~-23 ~-8 ~-23` or `/structure load bunker:outpost ~ ~ ~`.

**Control Panel menu:** lights on/off, **Lockdown** (seals every blast door within 26 blocks, alarm lighting),
lift lockdown, 10-second alarm, Armory terminal, status report (time, personnel, hostile contacts).

## Weapons

Damage is in half-hearts. Every gun has durability (it jams when worn out) and can be repaired with Steel Plates on an anvil or in the Armory.

| Weapon | Ammo | Damage | Mag | Rate | Range | Reload | Notes |
|--------|------|-------:|----:|-----:|------:|-------:|-------|
| Service Pistol | Light Magazine | 4 | 12 | 4/s semi | 32 | 1.2 s | Starter sidearm |
| Wasp SMG | Light Magazine | 3 | 30 | 10/s auto | 24 | 1.8 s | Quiet, high spread |
| Ranger Assault Rifle | Rifle Magazine | 5 | 30 | 6.7/s auto | 48 | 2.0 s | All-rounder |
| Breacher Shotgun | Shell Box | 3 × 7 pellets | 6 | 1.3/s | 14 | 2.5 s | Heavy knockback |
| Longshot DMR | Rifle Magazine | 11 | 8 | 1.7/s | 96 | 2.2 s | Near-zero spread |
| Bulwark LMG | Rifle Magazine | 4 | 100 | 10/s auto | 44 | 5.0 s | Slow movement |
| Pulse Rifle | Energy Cell | 5 | 40 | 6.7/s auto | 64 | 1.8 s | Energy tracers |
| Plasma Pistol | Energy Cell | 7 | 14 | 2.5/s | 28 | 1.5 s | Ignites targets |
| Railgun | Rail Slug | 22 | 1 | charge 0.6 s | 128 | 2.5 s | Pierces 5 targets |
| Thumper Launcher | Thumper Rocket | explosion | 1 | – | – | 3.5 s | Rocket entity, no block damage |
| Combat Knife | – | 7 melee | – | – | – | – | Enchantable |
| Stun Baton | – | 5 melee | – | – | – | – | Slowness + weakness on hit |
| Frag Grenade | – | explosion (power 2.5) | – | – | – | – | 2.5 s fuse, no block damage |
| Stun Grenade | – | blind + slow 5 s | – | – | – | – | 6 block radius |

**Attachments** (one per slot, attach in the Armory while holding the gun): Suppressor (muzzle, quieter, −10 % range),
Heavy Barrel (muzzle, +15 % damage, +25 % range, slower fire), Extended Magazine (+50 % mag), Reflex Sight (−40 % spread),
Foregrip (−25 % spread, +20 % knockback), Laser Sight (−50 % spread, shows an aim dot).

**Ammunition:** magazines refill a whole weapon; an **Ammo Box** unpacks into several magazines of a chosen type.
**Materials:** Steel Plate (6 iron → 4), Weapon Parts (2 iron + redstone + copper → 2). All recipes are in `addon/BunkerArsenal_BP/recipes`.

## Blocks

Reinforced Bunker Wall / Panel / Floor, Hazard Plating, Steel Floor Grate, Bunker Vent, Steel Pipe (rotates with placement),
Blast Door (2 blocks tall, sliding, lockable), Bunker Lamp (on / off / alarm), Control Panel (interactive console),
Server Rack and Wall Monitor (animated flipbook textures), Supply Crate and Weapon Crate (lootable, drop loot when broken),
Steel Locker, Steel Table.

## Mobile performance choices

- Bullets are hit-scan (one ray + one entity query per shot), tracers are capped at 8 particles (24 for the railgun).
- Only grenades and rockets are entities; they despawn or explode within seconds.
- Big scans (lights, lockdown) are sliced over several ticks; the blueprint uses `/structure load` first and a 700-blocks-per-tick builder as fallback.
- 16×16 textures, two flipbook animations, 22 kHz mono OGG sounds (107 KB total), no custom UI screens or shaders.
- Uses only stable Script API modules: `@minecraft/server 1.10.0`, `@minecraft/server-ui 1.1.0` (`min_engine_version 1.21.0`).

## Rebuilding from source

Everything (textures, sounds, structures, JSON, data tables) is generated by scripts in `tools/`:

```bash
pip install pillow        # ffmpeg must be installed for the sound synthesis
python3 tools/build_all.py
```

`build_all.py` regenerates all assets, validates every JSON file, cross-checks textures/lang entries,
runs the offline script tests (`tools/harness`, a stub of the Bedrock runtime) and writes the packages to `dist/`.
Weapon balance lives in `tools/gen_bp_items.py`; bunker layouts in `tools/gen_structures.py`; textures in `tools/gen_items_*.py` / `tools/gen_blocks.py`.

## Notes

- Natural outposts only appear in chunks generated after the pack was added to the world.
- Build the Command Complex with simulation distance 4 or higher so the whole 47×47 area is loaded.
- If the structure command is unavailable, the fallback builder is used; beds it places are the default red colour.
- Content-log warnings about unknown components mean a newer/older game version; the scripts guard every optional API.
