# Luxury Tech Mansion + Mycelium-X Outbreak

A Minecraft **Bedrock Edition** add-on for **1.21.0** (built and verified against the
1.21.0 beta line, including Android beta **1.21.0.26**).

Deliverable: **`dist/Luxury_Tech_Mycelium_X.mcaddon`**

It contains two packs in one file — a behaviour pack and a resource pack — that
deploy a fully-furnished modern luxury technology mansion on command, and layer a
fictional fungal outbreak on top of it that the mansion can be defended against.

> Mycelium-X is entirely invented for this add-on. It is a number between 0 and 100
> attached to a player, moved around by in-game mobs and blocks. It does not model,
> describe or reference anything real.

---

## 1. How to import it on Android

1. Download **`Luxury_Tech_Mycelium_X.mcaddon`** to your phone or tablet.
2. Tap the file (in your browser's download list, or in the Files app).
3. Choose **Minecraft** if Android asks which app should open it.
4. Minecraft launches and shows *"Importing…"*, then a success message.
   Both packs are now installed — you do not need to unzip anything.

If tapping the file does nothing, open the Files app, long-press the file →
**Open with** → **Minecraft**. If your browser saved it as `.zip`, rename the
extension back to `.mcaddon` first.

## 2. Which packs to activate

Create a new world (or edit an existing one) and activate **both**:

| Pack | Where | Name |
|---|---|---|
| Behaviour | Settings → **Behaviour Packs** | *Luxury Tech Mansion + Mycelium-X [Behaviour]* |
| Resource | Settings → **Resource Packs** | *Luxury Tech Mansion + Mycelium-X [Resources]* |

Activating the behaviour pack usually pulls the resource pack in automatically,
because the two declare each other as dependencies. Check both lists anyway.

You must also turn on:

- **Cheats / "Activate Cheats"** — every command below needs it.

## 3. Are experiments required?

**No.** Nothing in this pack needs an experimental toggle.

It uses the *stable* `@minecraft/server` **1.11.0** scripting module, which is the
stable module shipped with the 1.21.0 line, plus ordinary data-driven entities,
items, blocks and functions. No beta APIs, no "Beta APIs" toggle, no
"Holiday Creator Features", no "Custom Biomes".

## 4. How to build the mansion

Stand where you want the front door, then:

```
/function tech_house
```

The building is placed **one section per tick** — 85 sections, about 532,000 block
operations, roughly **4 seconds**. Each section is budgeted to at most ~12,000
blocks so no single frame is ever overloaded. You will see progress messages in
chat and *"Deployment complete. Systems online."* when it finishes.

The origin is your feet. The building extends roughly 40 blocks out in each
horizontal direction, 34 up and 30 down — pick somewhere open and flat.

| Command | What it does |
|---|---|
| `/function tech_house` | Paced deployment. **Use this one.** |
| `/function tech_house_now` | Same build, 3 sections per tick (~1.5s). Heavier. |
| `/function tech_house_clear` | Removes the whole build volume (also paced). |

### What's inside

**Exterior** — pillared entrance canopy, driveway, landscaped garden with paths,
trees, hedges and flowerbeds, a large swimming pool with deck and diving board,
and a three-bay garage.

**Ground floor** — double-height living room, designer kitchen with island,
dining area, guest bathroom, entrance hall with a feature staircase.

**First floor** — master bedroom with walk-in wardrobe and en-suite, two further
bedrooms, a luxury bathroom, glass-railed balconies.

**Second floor** — home cinema with tiered seating and a screen wall, gym,
gaming room with a six-screen PC setup, lounge.

**Rooftop** — terrace, hot tub, helipad markings, glass railing, seating.

**Basement** — server room, security room with a camera monitor wall and control
panels, laboratory, and two secret rooms behind hidden doors.

**Bunker (deeper)** — living quarters, emergency supply stores, a sealed
glass-walled quarantine cell, a bunker control panel, and a concealed escape
tunnel running ~38 blocks out to a hidden hatch in the garden.

## 5. How to start the outbreak

```
/function outbreak_start
```

Danger escalates once per Minecraft day, to a maximum at day 5:

| Day | Threat | What appears |
|---|---|---|
| 1 | Level 1 | Walkers, Spore Crawlers |
| 2 | Level 2 | + Infected Runners |
| 3 | Level 3 | + Fungal Brutes, contamination starts spreading from nests |
| 4 | Level 4 | + Mycelium Stalkers, spawn pressure doubles |
| 5 | Level 5 | Full outbreak — the surface is hostile |

`/function outbreak_stop` ends it, removes every infected mob and nest, and clears
everyone's infection.

## 6. All commands

**Mansion**

| Command | Effect |
|---|---|
| `/function tech_house` | Deploy the mansion at your position |
| `/function tech_house_now` | Deploy fast (heavier on mobile) |
| `/function tech_house_clear` | Remove the mansion |
| `/function house_lockdown` | Seal it: shutters, alarms, emergency lighting, quarantine |
| `/function house_unlock` | Release lockdown, restore normal lighting |

**Outbreak**

| Command | Effect |
|---|---|
| `/function outbreak_start` | Begin the outbreak |
| `/function outbreak_stop` | End it and clear all infection |
| `/function outbreak_status` | Threat report: state, day, level, lockdown, nearby counts |
| `/function nest_here` | Plant a fungal nest and contaminated zone at your feet |

**Player**

| Command | Effect |
|---|---|
| `/function give_kit` | Full equipment kit |
| `/function scan` | Run a scan without holding the scanner |
| `/function cure_me` | Clear your own infection |
| `/function infect_me` | Add 25 infection (for testing) |
| `/function myc_help` | Print this command list in chat |

Your infection is a normal scoreboard value, so this works too:

```
/scoreboard objectives setdisplay sidebar myc_inf
```

## 7. How the infection scanner works

Get one with `/function give_kit`, or find it in the creative **Equipment** tab.

**To use it:** hold the **Mycelium-X Scanner** and either tap/use it, or
**sneak** while holding it. The sneak path exists because tapping thin air is
awkward on a touchscreen. It has a 2-second cooldown.

It prints a live readout to chat:

```
MYCELIUM-X SCAN

Infection: 37%
Status: INFECTED
||||||||||||||||||||
Nearby contamination: HIGH
Hostile signatures: 4 within 24m
Fungal nests: 1 within 48m
Outbreak: LEVEL 3 (day 3)
```

Every number is measured when you press it, not decorative:

- **Infection** — your live 0–100 value.
- **Status** — HEALTHY / EXPOSED / INFECTED / CRITICAL.
- **Nearby contamination** — samples a lattice of blocks around you and weights
  each contaminated block type it finds.
- **Hostile signatures** — a real radius query for infected mobs within 24 blocks.
- **Fungal nests** — nest cores within 48 blocks.

The **Contamination Detector** is the second device: it sweeps a wider radius and
gives you the **distance and compass direction of the nearest nest**, so you can
hunt sources down rather than stumble onto them.

Both devices lose a point of durability per reading.

### Infection stages

| Stage | Range | Effect |
|---|---|---|
| HEALTHY | 0–9 | none |
| EXPOSED | 10–39 | occasional spore cough; clears on its own over time |
| INFECTED | 40–74 | Weakness, periodic Nausea — **and it now climbs by itself** |
| CRITICAL | 75–100 | Weakness II, Mining Fatigue, Slowness, Wither ticks, blindness flashes |

Below 40 your body slowly clears it. At 40 and above it rises until you treat it —
that is the point at which the medical kit stops being optional.

**You catch it from:** being hit by an infected mob (the main vector), standing in
or on contaminated blocks, and being next to a Spore Crawler when it bursts.

## 8. Equipment

| Item | Effect |
|---|---|
| **Spore Mask** (helmet) | Cuts airborne infection by 70% |
| **Protective Suit** (chest) | Cuts infection from bites by 60% |
| **Biofilter Cartridge** | Use with a mask on: 120s of near-total airborne filtering (90%). Also repairs the mask and suit |
| **Emergency Medical Kit** | −25 infection, Regeneration II, removes Wither |
| **Mycelium Suppressant** | −40 infection and 60s of *total* immunity |
| **Mycelium-X Scanner** | The readout above |
| **Contamination Detector** | Range and bearing to the nearest nest |

Wearing the mask and the suit together is better than either alone.

## 9. The infected

| Mob | Health | Speed | Damage | Behaviour |
|---|---|---|---|---|
| **Infected Walker** | 20 | 0.21 | 3 | Baseline shambler. Common. |
| **Infected Runner** | 14 | 0.28 → **0.42** | 4 | Lopes until it sees you, then sprints and leaps. Fragile. |
| **Fungal Brute** | 60 | 0.19 | 9 | Huge (scale 1.4), knockback-resistant, slow, hits hard. Rare. |
| **Spore Crawler** | 10 | 0.30 | 2 | Tiny (scale 0.5), climbs, **bursts into spores on death**. |
| **Mycelium Stalker** | 34 | 0.20 → **0.28** | 6 | **Invisible until it attacks**, then reveals and speeds up. Very rare. |

Each has its own model, skin, sounds, loot and behaviour set.

**Nests** (`myc:nest_core`) anchor the outbreak. They spawn infected while a player
is nearby and spread contamination outward at threat level 3+. Destroy the nest
core to shut a site down — that is the intended way to push back.

## 10. Mansion ↔ outbreak integration

- **Lockdown** (`/function house_lockdown`, or automatically at threat level 3+ when
  six or more infected close on the house while you are home) fills the entrance,
  garden door, pool door, all three garage bays and both ends of the escape tunnel
  with security shutters.
- **Alarms and emergency lighting** switch on with lockdown: every alarm light in
  the building goes red and every smart light turns to emergency red. Unlock puts
  it all back.
- **Quarantine** — engaging lockdown teleports anyone at CRITICAL into the sealed
  medical cell. Standing in it decontaminates you steadily.
- **The bunker** is sealed air: while you are inside it you cannot be infected.
- **The laboratory** runs a free continuous assay on anyone standing in it.
- **The control room and security desk** display live outbreak state on your action
  bar when you stand at them.
- **Automatic doors** open as you approach anywhere in the building, and close
  behind you.

## 11. Mobile performance

This was a design constraint, not an afterthought.

- **One** repeating interval exists in the entire pack, at 2 Hz. Everything else
  divides down from it (doors 0.5s, infection 1s, equipment 2s, director 5s).
- **No `tick.json`**, so there is no per-tick command function.
- **No vanilla spawn rules for the infected.** Every spawn goes through the
  director, which caps the population at `3 + 2 × level` within 48 blocks of a
  player (13 at maximum threat). Nothing spawns off-screen and accumulates.
- **Alarms and emergency lights cost nothing while idle.** They are a handful of
  `fill … replace` sweeps at the moment lockdown toggles, not a light controller.
- **Bulk work is paced.** Building and lockdown both drain through a command queue
  a few commands per tick rather than thousands in one frame.
- **No world scans.** Every entity query is radius-bounded; the per-second
  infection check reads three blocks per player.
- **Particle emitters are one-shot only** — nothing emits continuously.
- The whole add-on is ~100 KiB and ships no audio (its sound events alias vanilla
  audio files).

## 12. Known limitations

- **This has not been run inside Minecraft.** No Minecraft client or server exists in
  the environment this was built in, so it could not be imported or played. What
  *was* done is described in "Validation" below. Real-device verification is still
  needed, and behaviour tuning (spawn rates, infection speed) may want adjusting
  once it has been played.
- **The mansion needs open, flat ground.** It clears its own volume, but it does not
  adapt to terrain — deploying it on a mountainside or over water will look wrong
  and may leave the pool or garden hanging.
- **Only one mansion at a time.** The origin is stored globally, so deploying a
  second one repoints lockdown, quarantine and the room systems at the new build.
- **There is no single-tick "build it all now" function**, deliberately. Chaining
  every section from one `.mcfunction` runs ~532,000 block writes in one tick and
  crashes Minecraft on Android. Only the script can pace the work, so the script
  is the only supported way to build. The build therefore needs the behaviour
  pack's scripting to be working.
- **Lockdown shutters are placed by volume**, so if you stand exactly in a doorway
  when it seals you will be pushed out of the block.
- **Infection persists per player via scoreboard.** If a player's scoreboard entry
  is cleared manually, their infection resets to 0.
- **English only** — `en_US.lang` is the only localisation supplied.
- **The pack is not signed or marketplace-formatted**; it is a plain `.mcaddon` for
  personal use.

---

## Validation

`python3 tools/build.py` regenerates everything, validates, packages, and then
re-opens the archive and checks it. The build refuses to package if validation fails.

`tools/validate.py` checks:

- every JSON file parses; manifests have the right shape, `format_version` and
  `min_engine_version`; no UUID is used twice; the two packs depend on each other;
  the script entry exists; the script module version is one that exists on this target
- **every vanilla block identifier and block state against Mojang's own 1.21.0 block
  metadata** (`Mojang/bedrock-samples` @ `v1.21.0.3`, module version `1.21.0-beta.0`),
  including state *names* and their permitted *values*
- **every sound event against Mojang's 1.21.0 vanilla sound table**, and that each
  aliased audio path is a real vanilla file
- item icons resolve through `item_texture.json` to files on disk; block textures
  resolve through `terrain_texture.json`; particle and attachable textures exist
- entity `component_groups` / `events` are internally consistent, loot tables exist,
  every behaviour entity has a client entity and vice versa, and every geometry,
  render controller and animation a client entity references is actually defined
- `.mcfunction` linting: unknown commands, Java-Edition-only commands, Java block
  state syntax (`[facing=north]`), fills over Bedrock's 32768-block volume cap,
  leading slashes, and unresolved `function` references
- **per-tick block budgets** — no single `fill` may exceed 8,192 blocks, and no
  function may write more than 16,000 blocks in one tick *including every function
  it calls*. A `.mcfunction` runs in a single tick, so transitive volume is what
  actually lands on the frame
- every `scriptevent` raised by a function has a handler in `main.js`
- scripts import only the allowed module, relative imports resolve, **named imports
  resolve to real exports**, no synchronous `runCommand`, no `setTimeout`/`setInterval`,
  and **every script parses as an ES module under Node**

The validator was negative-tested: injected faults (a bad block id, a bad block
state, a Java-only command, an unknown sound, an import of a non-existent export,
an oversized fill, and a function chaining the whole build into one tick) were each
caught and failed the build.

The mansion generator additionally proves its own lockdown contract — it simulates
every block operation and fails the build if any sealable opening is not pure air in
the final state.

**Not verified:** in-game behaviour. Nothing here substitutes for loading the pack
on a device.

## Building from source

```bash
python3 tools/build.py        # generate + validate + package
python3 tools/validate.py     # validate only
```

| Tool | Produces |
|---|---|
| `gen_textures.py` | item, block, armour, particle and pack-icon PNGs |
| `gen_entity_art.py` | entity geometry and matching skins from one shared bone table |
| `gen_content.py` | items, blocks, attachables, particles, texture atlases, sound definitions |
| `gen_functions.py` | command entry points and both `.lang` files |
| `gen_mansion.py` | the mansion as relative-coordinate `.mcfunction` parts |
| `gen_mansion_data.py` | bridges the mansion index into the runtime |

Textures are generated procedurally by `tools/pngwrite.py`, a small stdlib-only PNG
writer, so no binary art is checked in by hand.

See `CONVENTIONS.md` for the format versions and naming rules everything follows.
