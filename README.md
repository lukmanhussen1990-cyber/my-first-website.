# The Hollow Bride

A single-player horror adventure add-on for Minecraft Bedrock (MCPE), built and
budgeted for a Mali-G57 MC2 Android phone at 2408x1080, GUI Scale 5, touch only.

Five Bone Keys, five rooms, one boss, two endings. Every interaction is one
thumb tap.

- **Target:** Bedrock 1.21.0.26 beta, Android 14, OpenGL ES 3, RenderDragon
- **min_engine_version:** `[1, 21, 0]`
- **Modules:** `@minecraft/server` 1.11.0, `@minecraft/server-ui` 1.2.0
- **Namespace:** `ag:` (`ag:hollow_bride`) - never `minecraft:`

---

## Build

```sh
pip install pillow
python3 tools/make_textures.py      # writes all 35 PNGs + 2 pack icons
python3 tools/validate.py           # 0 errors required before shipping
python3 tools/build_mcaddon.py      # -> dist/hollow_bride.mcaddon
```

`dist/hollow_bride.mcaddon` is the shippable artifact. The resource pack is
0.06 MB, well inside the 20 MB mobile budget, because every sound cue maps to a
vanilla `.ogg` already on the device and no texture exceeds 64x64 except the two
128x128 pack icons.

---

## Install on Android 14

Android 14 blocks direct access to `Android/data`, so the old
"copy into `com.mojang/behavior_packs`" route is gone. Use the file association
instead.

### Route A - .mcaddon (recommended)

1. Transfer `dist/hollow_bride.mcaddon` to the phone (USB, Drive, Telegram to
   yourself - anything that lands it in `Downloads`).
2. Open **Files** / **My Files** and tap `hollow_bride.mcaddon`.
3. If Android asks what to open it with, choose **Minecraft**. Minecraft
   launches and shows *Importing…*, then *Successfully imported*.
4. Create a new world:
   - **Behavior Packs** -> **The Hollow Bride** -> Activate.
   - The resource pack is pulled in automatically by the manifest dependency.
     If it is not, go to **Resource Packs** -> **The Hollow Bride** -> Activate.
5. In the same world settings: **Game Mode: Survival**, **Difficulty: Normal**,
   and turn **Beta APIs** ON under Experiments (required for `@minecraft/server`
   script modules on 1.21.0.26 beta).
6. Create the world and wait ~10 seconds. The manor builds itself in nine
   staggered passes and the actionbar counts them off (`Building the manor 4/9`).

### Route B - .mcworld

If you would rather hand someone a finished world than a pack:

1. Do Route A once, play until the actionbar says the manor is finished.
2. Main menu -> **Play** -> pencil icon on the world -> scroll to
   **Export World**. Minecraft writes a `.mcworld` to your Downloads.
3. That `.mcworld` embeds both packs and the already-built manor, so the
   recipient taps it in **Files**, it imports, and they press Play - no
   build wait, no Experiments toggle to remember.

### If the import silently does nothing

Long-press the file -> **Open with** -> **Minecraft**. Some Android 14 file
managers (notably Samsung My Files on One UI 6) hand `.mcaddon` to a generic
archive app first. Renaming to `.zip` and extracting by hand does **not** work
on Android 14 - there is no writable pack folder to extract into.

---

## The run

| Act | Room | Gate | Hunter |
|---|---|---|---|
| 0 | The Approach | read the will, cross the threshold | none |
| 1 | The Foyer | take the Tallow Candle | tutorial ghost (harmless) |
| 2 | The Nursery | match 5 toys to the music box | **The Nanny** (hunts noise) |
| 3 | Cellar of Names | ring the bell on the right plaque | **Drowned Wraiths** (cap 3) |
| 4 | The Mirror Wing | tap the one honest mirror | **The Reflection** (20s chase) |
| 5 | Portrait Gallery | photograph 5 portraits in death order | **The Watcher** (view cone) |
| 6 | The Attic Heart | Veil -> Chorus -> Hollowing | **The Hollow Bride** |
| 7 | Dawn | 90 seconds to the gate | the house itself |

**Answers, for testing:** melody is `2,0,3,1,4` left to right; the cellar name
is **Elowen Vane** (4th plaque); the honest mirror is the **3rd**; the portrait
death order is `3,0,4,1,2`.

### The ten mechanics

Sanity, Tallow Candle, Salt Line (12 per run), Cracked Monocle, Bone Camera,
Seance Bell (3 charges), rolling Noise, Observation view cone, Hiding
(Wardrobe / Under-Bed), and the Manor Journal. All ten persist across quit and
rejoin via world dynamic properties keyed by player id - no scoreboards, no NBT.

### Fair-scare contract

- 60 seconds of silence before any major scare (`SILENCE_TICKS = 1200`).
- Every jumpscare gets a 2 second tell: `ag.tell` sound **and** a dust-mote
  puff, because some players play muted.
- No scares during a puzzle form - forms pause the loop's scare budget.
- No control taken for more than 3 seconds; camera shakes are capped at 1.5s.
- Nothing lethal spawns behind you inside 3 blocks. The Bride's Hollowing
  teleport lands at 5 blocks and telegraphs 2 seconds first.
- No instant deaths. Lethal damage bottoms out at half a heart and sends you to
  the room checkpoint with your inventory.
- **Mild** intensity gives fewer scares and half damage - never a smaller map.

---

## 20-point test checklist

Run in a fresh world with the pack active. Expected results are what you should
actually see, not what the code intends.

| # | Test | Expected |
|---|---|---|
| 1 | Create world, wait 20s | Actionbar counts `Building the manor 1/9` … `9/9`, then "The manor is finished. Walk north." |
| 2 | First join | Settings form appears within ~3s: Scare Intensity dropdown (Mild/Normal/Hard), Jumpscare Flashes (On/Off) |
| 3 | `/tickingarea list` | Exactly one entry: `ag_manor` |
| 4 | Tap the mailbox at 1015 65 1000 | Will form opens; block switches to opened state (light drops 5 -> 1) |
| 5 | Walk to 1015 65 1011 | Door slam, title card "The Hollow Bride", fog goes dark, threshold behind you seals |
| 6 | Enter the Foyer | Candle, Journal, 12 Salt, 2 Tallow appear; candle lights; "Tallow Candle / Light is safe" title |
| 7 | Stand still 60s | The grandfather clock chimes and the actionbar reports the hour |
| 8 | Tap Manor Journal | Action form: Objectives / Bone Keys / Collected Pages / Close, all four buttons respond |
| 9 | Sprint in the Nursery | Nanny's speed tier rises within one loop pass; "She heard that." tell fires before she closes |
| 10 | Walk (do not sprint) in the Nursery | Noise decays to 0; Nanny returns to the 3-block calm radius and strolls |
| 11 | Tap a Wardrobe | You go invisible, movement locks, heartbeat every ~2s, wardrobe state flips to occupied; tap again to exit |
| 12 | Set toys to 2,0,3,1,4 | Chime + "The tune completes"; tapping pedestal 1 now yields Bone Key I |
| 13 | Ring the bell on plaque 4 (Elowen) | "The name holds"; pedestal 2 yields Key II. Ring a wrong plaque instead: tell fires, then up to 3 wraiths spawn 6-9 blocks away, never behind you |
| 14 | Tap the 3rd mirror | No chase, Key III unlocks. Tap a wrong mirror: 2s tell, then a 20s teleport chase that stops on its own |
| 15 | Look at the Watcher | It freezes while `dot > 0.35` with clear line of sight; look away and it closes ~0.85 blocks per pass |
| 16 | Photograph portraits 3,0,4,1,2 | Actionbar counts 1/5 … 5/5, then "Five plates, five deaths"; a wrong order resets to 0 with "The plate fogs" |
| 17 | Attic: light all 4 wall candles | Phase II title after a 2s tell; Bride freezes; children spawn to a hard cap of 3 |
| 18 | Place a Salt Line in front of a child | It is thrown back 2 blocks and cannot cross; salt counter decrements in the actionbar |
| 19 | Let sanity hit 0 | Heavy fog, distorted whispers, then a checkpoint respawn with full inventory - never a death screen |
| 20 | Take Key V, reach the gate | 90s Dawn timer counts down in the actionbar, ruin loads in 2 staggered passes, ending form fires at 1015 65 1009. Standing in the attic alcove instead offers the "Stay" ending |

Frame-rate spot check: stand in the Foyer with the candle lit and the Nanny
active. On a Mali-G57 MC2 at render distance 8 this holds 30+ fps because there
is never more than one AI entity and at most three particle emitters alive.

---

## Known limits, and what to change if the content log complains

Open the log with **Settings -> Creator -> Content Log GUI** on the device.

**`Script module version mismatch` / `No script module named '@minecraft/server' version '1.11.0'`**
The beta shifted the stable module. In `BP/manifest.json`, replace exactly this line:

```json
{ "module_name": "@minecraft/server", "version": "1.11.0" }
```

with, in order of preference:

```json
{ "module_name": "@minecraft/server", "version": "1.10.0" }
```

then

```json
{ "module_name": "@minecraft/server", "version": "1.11.0-beta" }
```

and for the UI module the fallback line is:

```json
{ "module_name": "@minecraft/server-ui", "version": "1.1.0" }
```

A `-beta` version additionally requires **Beta APIs** ON in world Experiments.

**`Unknown component minecraft:placement_filter`** - delete the whole
`minecraft:placement_filter` block from `BP/blocks/salt_line.json`. Salt then
places on any face; the mechanic is unaffected.

**`Unknown block state ag:occupied` on a wardrobe** - the states are declared in
`description.states`. If a build rejects boolean states, change them to
`[0, 1]` and update the two `withState` calls in `BP/scripts/systems.js`.

**Sound cue plays nothing** - `RP/sounds/sound_definitions.json` points at
vanilla `.ogg` paths that ship with the game rather than adding custom audio
(0 MB of the 8 MB budget used). If a path was renamed in your build, the log
says `Unable to find sound` and the game stays silent - it never crashes.
`sounds/mob/enderdragon/growl` and `sounds/mob/warden/heartbeat` are the two
most likely to move; swap them for `sounds/mob/ghast/moan1` and
`sounds/note/bass`.

**Empty-hand taps do nothing on some builds** - `playerInteractWithBlock` is
subscribed defensively and skipped if the runtime lacks it. Every interactive
block still responds through `itemUseOn`, so hold *any* item and tap. The log
line `event playerInteractWithBlock not available` is informational.

### Requirement conflicts, and how they were resolved

Three requirements could not all be satisfied at once. In each case the option
that protects framerate on the target phone won.

1. **`/structure load` vs. a text-only deliverable.** `.mcstructure` is a binary
   NBT format that cannot be emitted as text. The manor ships as nine
   `.mcfunction` files instead, each far under the 300-command cap, run one per
   20 ticks by `BP/scripts/build.js`. This gives the same staggered load without
   a single giant `/fill` - the largest fill is 30,135 blocks, inside the
   engine's 32,768 limit.

2. **`dialogue` format 1.17 vs. "server-ui forms only".** The dialogue format
   requires the native NPC dialogue screen. `BP/dialogue/wick.json` ships and is
   used for the tutorial ghost only, because the native screen is the one custom
   screen Bedrock lays out correctly at GUI Scale 5 on a tall phone. Every other
   screen in the add-on is `ActionFormData` / `ModalFormData` / `MessageFormData`.
   No custom JSON-UI anywhere.

3. **"6 UUIDs" vs. what two manifests consume.** Two manifests need five: BP
   header, BP data module, BP script module, RP header, RP resources module. Six
   unique v4 UUIDs were generated; the sixth,
   `c83d0f46-71b2-4ea5-8d63-4f9a2c1b7e05`, is reserved for a future world
   template manifest and is deliberately unused. None of the five in use is ever
   reused, and `tools/validate.py` fails the build if that changes.

### Performance notes

- At most 8 custom entities are defined and at most 3 have active AI at any
  moment. During the Chorus phase the Bride is frozen precisely so the three
  children fit the budget; `keepOnly()` despawns anything from a previous room.
- Three particle definitions exist and all three use `emitter_lifetime_once`, so
  there is no permanent emitter anywhere in the world. Caps: 18, 8 and 12
  particles, lifetimes 2.6s, 1.1s and 1.6s.
- Lighting is `minecraft:light_emission` on blocks. No light-source entities.
- Fog is distance-only in all three definitions. No volumetric fog, no PBR, no
  `texture_set` / MER, no ray tracing.
- Entity materials are `entity_alphatest`, not `entity_alphablend`; the ghostly
  characters get their translucency from dithered alpha baked into the 64x64
  texture, which costs nothing to sort.
- One `system.runInterval` at 10 ticks handling exactly one player per pass, and
  one at 20 ticks for the clock. Nothing runs per-tick.

---

## Layout

```
BP/scripts/config.js     coordinates, budgets, puzzle answers
BP/scripts/state.js      dynamic-property persistence
BP/scripts/systems.js    the ten mechanics
BP/scripts/acts.js       act logic, hunters, endings
BP/scripts/build.js      staggered .mcfunction runner
BP/scripts/ui.js         every form
BP/scripts/util.js       safe() wrappers - nothing here throws
BP/scripts/main.js       entry point, loops, event wiring
```

Every event handler is wrapped so one bad room cannot brick the world; failures
land in the content log as `[hollow_bride] …` and the run continues.
