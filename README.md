# Minecraft Bedrock Addons

Four mobile-ready Bedrock addons (Android / iOS / Windows / Console), each bundled into
a single file you tap to import.

| Addon | Download | Needs | What it is |
| --- | --- | --- | --- |
| **One Punch Man** | [`OnePunchMan.mcaddon`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/OnePunchMan.mcaddon) | 1.20.0+ | Normal Punch and Serious Punch items |
| **Security House** | [`SecurityHouse.mcaddon`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/SecurityHouse.mcaddon) | 1.21.0+ | One command builds a fortified one-floor house |
| **Atmos Graphics** | [`AtmosGraphics.mcpack`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/AtmosGraphics.mcpack) | 1.16.100+ | Atmospheric fog and clearer water — **the graphics pack for 1.21.0 and older** |
| **Vibrant Plus Graphics** | [`VibrantPlusGraphics.mcpack`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/VibrantPlusGraphics.mcpack) | **1.21.120+** | Full Vibrant Visuals: cinematic lighting, sky, water, colour grading |

### Which graphics pack do I need?

Check your version on the Minecraft title screen, bottom right corner.

- **Below 1.21.120** (including 1.21.0, 1.21.4x, 1.21.9x) → **Atmos Graphics**. Vibrant
  Visuals does not exist on your build, and Vibrant Plus will refuse to load.
- **1.21.120 or newer** → **Vibrant Plus Graphics**, and turn Vibrant Visuals on in video
  settings. Atmos still works if your device can't run Vibrant Visuals smoothly.

Don't run both at once — they both set fog and the higher pack in the list wins.

### Installing (same for all four)

1. Download the file onto your phone (on GitHub: open it → **Download raw file**).
2. Open it. Android offers "Open with Minecraft"; on iOS use **Share → Copy to Minecraft**.
3. Minecraft imports it automatically.
4. Activate it in your world settings:
   - One Punch Man and Security House → **Behavior Packs**. The matching resource pack
     comes along as a dependency.
   - Atmos Graphics and Vibrant Plus Graphics → **Resource Packs**. Vibrant Plus also
     needs Vibrant Visuals switched on in video settings — see
     [its section](#4-vibrant-plus-graphics).

No experimental toggles and no scripting anywhere. If a browser saves the file as `.zip`,
rename it back to `.mcaddon` or `.mcpack`.

---

# 1. One Punch Man

| Item | How you use it | What it does |
| --- | --- | --- |
| **Normal Punch** | Tap/hold to throw the shockwave, or hit a mob directly | 25 melee damage. Fires a fist shockwave that flies straight and detonates on impact — 30 impact damage plus a TNT-sized crater. 0.75s cooldown. |
| **Serious Punch** | Same, but hold on to something | 120 melee damage. Fires a wave that **carves a tunnel of explosions through the terrain as it flies**, then finishes with a huge blast on impact (200 impact damage). Chews through obsidian and bedrock. 8s cooldown. |

Both are throwable *and* melee weapons, never break, and sit in the creative inventory
under **Equipment → Sword**.

```
/give @s opm:normal_punch
/give @s opm:serious_punch
```

Survival crafting — **Normal Punch** is 4 leather around an iron block; **Serious Punch**
is 4 diamond blocks + 4 netherite ingots around a Normal Punch:

```
 L          DND
LIL         NPN
 L          DND
```

### Tuning the destruction

Everything lives in the `minecraft:explode` components. Higher `power` = bigger crater.

| What you want | File | Change |
| --- | --- | --- |
| Bigger normal punch crater | `OPM_BP/entities/normal_punch_wave.json` | `power` (currently `3.5`, TNT is `4`) |
| Bigger serious punch finish | `OPM_BP/entities/serious_punch_wave.json` | `power` (currently `8`) |
| Denser destruction tunnel | `OPM_BP/entities/serious_blast.json` | `power` (currently `3.5`) |
| Longer destruction tunnel | `OPM_BP/entities/serious_punch_wave.json` | `minecraft:timer` `time` (currently `3.0`s of flight) |
| More blasts along the tunnel | `OPM_BP/entities/serious_punch_wave.json` | `min_wait_time` / `max_wait_time` (currently `0.2`s apart) |
| **Stop it eating obsidian and bedrock** | `serious_punch_wave.json` + `serious_blast.json` | delete the `"max_resistance": 5.0` lines |

Two things before you crank the numbers:

- **`max_resistance: 5.0` on the Serious Punch is deliberate.** It caps every block's blast
  resistance at 5, which is what lets it blow through obsidian, ancient debris and
  **bedrock** — including the world floor and the Nether roof. Series-accurate, but it
  will punch holes in terrain you may care about.
- **Mobile performance.** Blocks destroyed scale roughly cubically with `power`. Power `8`
  is already thousands of blocks per blast, and the serious punch fires ~15 trail blasts on
  top of that. Past ~12 a phone will stutter badly. Raise it in small steps.

---

# 2. Security House

One command drops a fully sealed, blast-proof compound around you.

```
/function house/build      build it where you stand
/function house/remove     delete it again
```

Needs **cheats enabled** (that's what `/function` requires — nothing else). Stand where you
want the middle of the living room, on flat-ish ground, and run it. The command clears
terrain in a 33×33 footprint first, so don't run it inside a base you like.

### What you get

`#` reinforced wall · `V` vault wall · `D` iron door · `l` lever · `p` pressure plate
`c` chest · `b` bed · `B` bookshelf · `E` enchanting table · `o` workstation

```
    #########################
    #########################        outer wall, 2 blocks thick, 8 tall
    ##                     ##
    ## p        p        p ##        patrol corridor, roofed over
    ##                     ##
    ##   ###############   ##
    ##   #ccccV    oooo#   ##        vault (top left) + workshop
    ##   #c   V       o#   ##
    ##   #c   V       o#   ##
    ##   #c l V       o#   ##
    ##   #VVDVV       o#   ##        vault door
    ##   #  l         o#   ##
    ## p #             # p ##        <- you stand here
    ##   #o       B B B#   ##
    ##   #             #   ##
    ##   #b       B E B#   ##        bed + enchanting corner
    ##   #b            #   ##
    ##   #        B B o#   ##
    ##   #cccc  l    cc#   ##
    ##   ######DD#######   ##        front door
    ##         l           ##
    ## p    p       p    p ##
    ##         pp          ##        entry alarm
    ########### l###########
    ###########DD###########         main gate
                l
```

Security, layer by layer from the outside in:

1. **Lava moat** — a one-deep trench ringing the whole platform, with a single causeway
   lined up with the gate.
2. **Anti-climb overhang** — the perimeter wall's top row juts out one block, so spiders
   can't come over the outside face.
3. **Double perimeter wall** — 2 blocks thick, 8 tall, 1200 explosion resistance. Creeper
   and TNT proof.
4. **Roofed compound** — the whole 25×25 area is capped at head height +8, so nothing
   drops, flies or shoots in. An iron-bar parapet makes the roof safe to walk.
5. **Patrol corridor** — a lit ring between the outer wall and the house, seeded with
   **9 arrow traps** (dispenser in the floor facing up, pressure plate on top).
6. **Entry alarm** — plates just inside the gate light redstone lamps and sound note
   blocks, so anything coming through is loud and visible.
7. **Iron doors at every threshold** — gate, front door, vault. Iron doors can't be opened
   by hand or by mobs; each one has a lever on both sides.
8. **The house** — 13×13 interior, 900-resistance walls, blast glass windows, sealed
   ceiling.
9. **Vault** — 4×4 safe room in the corner behind its own iron door, walls at 3600
   explosion resistance, lined with chests.
10. **Solid foundation** — two full layers under the floor, so nothing tunnels or spawns
    from below.
11. **Alarm lamps everywhere** — 66 of them in the floors and ceilings at light level 15,
    so there is nowhere dark enough to spawn in.

Fitted out with: bed, crafting table, furnace, blast furnace, smoker, anvil, grindstone,
cartography table, stonecutter, loom, brewing stand, cauldron, enchanting table ringed by
bookshelves, and 15 chests.

### Two things you have to do yourself

- **Load the arrow traps.** Bedrock commands cannot put items into containers, so the nine
  dispensers are placed but empty. Drop arrows in them.
- **Chests come empty**, for the same reason.

### The blocks

All five are craftable and usable on their own, in the creative menu under Construction.

| Block | Mining | Blast resistance | Notes |
| --- | --- | --- | --- |
| Reinforced Wall | 12.5s | 1200 | main structure |
| Security Floor | 9.0s | 900 | floors |
| Vault Wall | 20.0s | 3600 | toughest block in the pack |
| Blast Glass | 6.0s | 900 | see-through, still blast proof |
| Alarm Lamp | 3.0s | 900 | light level 15 |

For reference, vanilla obsidian is 1200 and stone is 6.

### Resizing the house

`tools/make_house.py` is the source of truth — the `.mcfunction` files are generated from
it. The footprint constants sit at the top:

```python
APRON = 16      # outer edge of the platform
MOAT  = 14      # lava trench ring
PERIM_IN, PERIM_OUT = 11, 12   # perimeter wall
HOUSE = 7       # house wall
INT   = 6       # interior half-width
```

Change them, then:

```bash
python3 tools/make_house.py     # regenerate the commands
python3 tools/verify_house.py   # prove the result is still sealed
python3 tools/build.py          # revalidate and rebuild dist/
```

`fill` refuses more than 32768 blocks per command, and `make_house.py` raises if a change
pushes a fill over that.

---

# 3. Atmos Graphics — for 1.21.0 and older

The graphics pack for builds from before Vibrant Visuals existed. Nothing to switch on,
no experimental toggles, and it runs on low-end phones.

### Applying it on mobile

1. Download **`AtmosGraphics.mcpack`** and open it. Minecraft imports it.
2. World → **Settings → Resource Packs → My Packs → Atmos Graphics → Activate**.
   Or **Settings → Global Resources** to apply it to every world at once.
3. That's it. Go outside and look at the horizon, then dive underwater.

To check it actually loaded, run `/fog @s push atmos:default test` — if the command
succeeds, the pack's fog definitions are registered. `/fog @s pop test` undoes it.

### What it changes

| | |
| --- | --- |
| **Distance haze** | Soft blue aerial perspective from 60% of your render distance outward, so hills and mountains sit back in the air instead of being cut off flat |
| **Clearer water** | Underwater visibility from vanilla's 60 blocks out to 95, and up to 180 in warm oceans, with a smooth fade as you dive in |
| **Heavier rain** | Storms drop the view to a grey-blue murk instead of barely changing anything |
| **Per-biome mood** | Swamps get thick low green murk and 24-block water, deserts and mesas get warm dust, ice plains get a pale cold haze, jungles get humid green, the Nether gets a deep red close-in glow, the End gets violet-black void |

11 fog definitions mapped over 32 biomes.

### Tuning it

`tools/make_atmos.py` is the source — the fog files are generated from it. Then
`python3 tools/make_atmos.py && python3 tools/verify_atmos.py && python3 tools/build.py`.

| Want | Change |
| --- | --- |
| Less haze, longer views | Raise `fog_start` toward `1.0` (vanilla is `0.92`) |
| Thick, moody fog | Lower `fog_start` toward `0.2` |
| Even clearer water | Raise the `water()` distance — it's in blocks, vanilla is 60 |
| Vanilla fog back in one biome | Delete that biome's line from `BIOME_FOG` |

`fog_start`/`fog_end` are fractions of your render distance when
`render_distance_type` is `"render"`, so the look holds at any view distance.
Water fog is measured in blocks instead.

### The honest ceiling

On pre-1.21.120 builds, distance fog is essentially the only rendering control a resource
pack gets. There is no way to add shadows, reflections, bloom or real lighting — those
arrived with Vibrant Visuals. Anything advertising "shaders" for these versions is either
for pre-1.16.200 (before RenderDragon removed GLSL support) or is a fog pack like this one.

---

# 4. Vibrant Plus Graphics

A graphics pack that rewrites how the world is lit, coloured and rendered: sun and moon
intensity across the day, sky scattering colours, water clarity and waves, light colours
for every torch and lantern, and a filmic colour grade over the whole image.

### Read this first — how graphics packs work on Bedrock

**GLSL shader packs do not work on Bedrock mobile any more.** Minecraft switched to the
RenderDragon engine in 1.16.200 and removed the `shaders/glsl` path that old "shader
packs" used. Anything still advertised as a mobile shader pack is either for an ancient
version, or is just a texture pack with a fog tweak.

What replaced it is **Vibrant Visuals** — Mojang's own deferred renderer, with real
directional shadows, reflections, volumetric lighting and PBR. It is data-driven through
resource packs, and that is what this pack drives. It is the supported way to change
Bedrock's graphics today, and it works on phones.

### Requirements

- Minecraft Bedrock **1.21.120 or newer** (the `pbr` pack capability requires it).
- A device that offers Vibrant Visuals. It's demanding — on older or budget phones the
  option may be missing or will cost you a lot of frames.

### Applying it on mobile

1. Download **`VibrantPlusGraphics.mcpack`** and open it. Minecraft imports it.
2. **Turn Vibrant Visuals on** — this is the step people miss, and without it the pack
   does nothing at all:
   **Settings → Video → Graphics Mode → Vibrant Visuals.**
   If that option isn't there, your version or device doesn't support it yet.
3. Open your world → **Settings → Resource Packs → My Packs → Vibrant Plus Graphics →
   Activate.**
4. Go outside around sunrise or sunset, and look at some water.

Global packs work too: **Settings → Global Resources → Vibrant Plus Graphics** applies it
to every world at once.

### What it changes

| File | What it drives |
| --- | --- |
| `lighting/global.json` | Sun 118,000 lux at noon falling to 0.6 at midnight, warm golden sun colour at dawn/dusk, cool blue moonlight, 8° orbital tilt for longer shadows, ambient dropped to 0.014 lux and sky intensity to 0.82 so caves are genuinely dark |
| `atmospherics/atmospherics.json` | Sky colours keyframed through the day — deep blue zenith, white-blue midday horizon, orange-into-magenta sunset, near-black midnight — plus Rayleigh and Mie scattering strength and sun glare shape |
| `water/water.json` | Clear blue water (low CDOM/chlorophyll/sediment), 24-octave waves, and caustics at power 3 |
| `color_grading/color_grading.json` | Teal-and-orange film grade: cool shadows, warm highlights, +16% contrast, +12% saturation, 6200K, ACES tone mapping |
| `local_lighting/local_lighting.json` | Torches, lanterns, redstone torches and end rods promoted to **point lights** — real dynamic shadows from your torch — with hand-picked colours; campfires, glowstone, sea lanterns, shroomlight, lava and magma get tinted static light |
| `pbr/global.json` | Default surface roughness for every block, mob, item and particle that has no texture set, so the whole world catches a subtle sheen instead of looking flat |

### Tuning it

Every value is range-checked by `tools/verify_graphics.py` against the documented limits,
so if you edit something and get it wrong you'll be told which field and what the range is
instead of hunting through the content log.

| Want | File | Field |
| --- | --- | --- |
| Brighter nights | `lighting/global.json` | `moon.illuminance` (0.42), `ambient.illuminance` (0.014) |
| Darker, harsher shadows | `lighting/global.json` | `sky.intensity` — lower is darker, floor is 0.1 |
| Less saturated look | `color_grading/color_grading.json` | `midtones.saturation` (1.12) |
| Warmer or cooler image | `color_grading/color_grading.json` | `temperature.temperature` (6200K) |
| A different film curve | `color_grading/color_grading.json` | `tone_mapping.operator` — `aces`, `hable`, `generic`, `reinhard`, `reinhard_luma`, `reinhard_luminance` |
| Calmer water | `water/water.json` | `waves.depth` (0.85), `waves.octaves` (24) |
| Better performance | `water/water.json`, `local_lighting/local_lighting.json` | drop `waves.octaves`, set `caustics.enabled` to false, and switch point lights back to `static_light` — point lights are by far the most expensive thing here |

### Why there are no per-block PBR textures

A texture set can only reference images **inside its own resource pack** — the game will
not let a pack attach a normal or MER map to a vanilla texture it doesn't also ship. So
adding true per-block PBR means redrawing every block texture in the game, which is a
texture-art project, not a config one. This pack instead uses `pbr/global.json` to set
sensible material defaults for everything at once, which is where most of the benefit is
for the effort.

---

## Repository layout

```
OPM_BP/ OPM_RP/     One Punch Man behavior + resource pack
SEC_BP/ SEC_RP/     Security House behavior + resource pack
ATM_RP/             Atmos Graphics resource pack (fog, pre-Vibrant-Visuals)
VIS_RP/             Vibrant Plus Graphics resource pack
  SEC_BP/blocks/           the five custom blocks
  SEC_BP/functions/house/  build.mcfunction and the steps it calls
dist/               the three ready-to-import bundles
tools/
  make_textures.py        One Punch Man item icons
  make_house_textures.py  Security House block textures
  make_house.py           generates the house .mcfunction files
  make_atmos.py           generates the fog definitions and biome assignments
  make_graphics_icon.py   both graphics pack icons
  verify_house.py         replays the build in a voxel grid, proves it is sealed
  verify_graphics.py      range-checks every Vibrant Visuals value against the docs
  verify_atmos.py         checks fog ranges and that every biome resolves to a real fog
  build.py                validates every pack, rebuilds all four bundles
```

Rebuild everything after an edit:

```bash
python3 tools/build.py && python3 tools/verify_house.py \
  && python3 tools/verify_graphics.py && python3 tools/verify_atmos.py
```

`build.py` checks that every JSON parses, that pack UUIDs are unique, that each item's
`projectile_entity` exists, that every custom entity has a client-side definition, that
every icon and block texture resolves to a real PNG, and that no `.mcfunction` references
a block or function that doesn't exist.

`verify_house.py` replays `house/build` into a voxel grid and asserts you aren't entombed,
that the ceiling and roof have no holes, that flood fill from open ground reaches neither
the corridor nor the living room, and that every lever is adjacent to a door it can drive.

## Compatibility

- One Punch Man: stable formats (items `1.20.30`, entities `1.16.0`, recipes `1.20.10`),
  `min_engine_version` `1.20.0`.
- Security House: blocks use format `1.21.0`, `min_engine_version` `1.21.0`.
- Atmos Graphics: fog format `1.16.100`, `min_engine_version` `1.16.100`. Works on
  everything from 1.16.100 up, including 1.21.0.
- Vibrant Plus Graphics: `min_engine_version` `1.21.120`, and it needs Vibrant Visuals
  switched on in video settings.
- None of them need experimental toggles or scripting, so all three work on mobile, on
  Realms and in multiplayer.

One consequence of running both at once: the Serious Punch's `max_resistance: 5.0` caps
*every* block's blast resistance, so it goes through the security house too. Nothing in
Minecraft stops Saitama.

## Status / what wasn't verified

All three packs are structurally validated by `tools/build.py`; the house geometry is
verified by simulation in `tools/verify_house.py`; and every graphics value is
range-checked against the published schemas by `tools/verify_graphics.py`. None of them
has been launched in an actual Minecraft client from this environment — there is no
Bedrock client here — so damage numbers, explosion sizes, block-state rotations and the
final look of the graphics pack are design targets, not measured results.

Specifically worth checking in game, because they are the parts a simulation can't prove:

- **Door and bed rotations.** Iron doors and beds carry a `direction` block state. If one
  lands facing an odd way, break it and place it again — the geometry around it is right.
- **The graphics pack's look.** Range-checking proves the files will load; it cannot tell
  you whether the sunset is the colour you wanted. The tuning table above is where to
  adjust it.
- If Minecraft reports a content error on import, **Settings → Creator → Content Log**
  names the exact file.

## Sources

Vibrant Visuals schemas used for the graphics pack come from the Minecraft creator docs:
[Vibrant Visuals Resource Packs](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks),
[Light Sources](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/lightingcustomization),
[Atmospheric Effects](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/atmosphericscustomization),
[Water Effects](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/watercustomization),
[Color Grading and Tone Mapping](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/colorgradingtonemappingcustomization),
[Texture Sets](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/texturesetsreference/texturesetsconcepts/texturesetsintroduction).
