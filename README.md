# Amusement Park Mod — Minecraft Bedrock `.mcaddon`

An add-on for **Minecraft Bedrock 1.21+ (Pocket / mobile, Windows, console)** that puts
amusement-park builder items in your inventory. Hold one, **tap the ground, and the ride
builds itself** in front of you — block by block, facing the way you are looking.

Built and tested against `1.21.0` (works on the 1.21.0.26 beta and later releases).

Download: **[`dist/AmusementPark.mcaddon`](dist/AmusementPark.mcaddon)**

---

## Install on a phone (Android / iOS)

1. Download `dist/AmusementPark.mcaddon` to your device (tap the file above → **Download raw file**).
2. Open the downloaded file. Your phone will hand it to Minecraft, and Minecraft imports both packs.
   If it doesn't open automatically, use your Files app → Downloads → tap `AmusementPark.mcaddon`.
3. Create or edit a world → **Behavior Packs** → activate **Amusement Park Mod**.
   The matching resource pack is pulled in automatically.
4. Leave **Cheats** on if you want to `/give` yourself items; otherwise everything is in the
   creative inventory or craftable.
5. Play. In creative, search the inventory for **"builder"** or open the **Construction** tab.

No experimental toggles are required — the pack uses the stable scripting API.

## Using it

Hold a builder item and **tap the ground** (tap-and-hold on touch). Stand somewhere open —
each ride clears and levels its own plot first, so don't do it inside your house.

| Item | What it builds |
| --- | --- |
| Ferris Wheel Builder | 28-block wheel, 12 lit gondolas, A-frame supports, queue line |
| Roller Coaster Builder | A real 128-rail circuit with two hills, powered station, supports and a cart |
| Carousel Builder | Striped turntable, 12 horses on brass poles, cone canopy |
| Drop Tower Builder | 44-block tower, glass drop shaft, four gondolas, warning lights |
| Bumper Cars Builder | Checkerboard rink, striped barrier, roof lights, 8 parked cars |
| Swing Ride Builder | Banded mast, 16 chain swings, rainbow canopy |
| Park Entrance Builder | "FUN PARK" arch, two gate towers, ticket booths, turnstiles |
| Food Court Builder | Four stalls with awnings and campfires, picnic tables, planters |
| **Amusement Park Kit** | The whole park: every ride above, avenue, plaza, fences, lamps, trees |
| Park Undo Wand | Puts back whatever you built last |

The Park Kit places ~230,000 blocks and takes a few seconds on a phone — the progress counter
runs in the action bar while it works. Give it a flat area roughly **107 × 109 blocks**.

### Getting the items

- **Creative:** inventory → Construction tab (or search "builder").
- **Survival:** craft them — each builder is a stick + iron ingot + one signature item
  (rail for the coaster, minecart for bumper cars, gold block for the carousel, …).
  The Park Kit costs a diamond, an emerald, and gold/iron/redstone blocks.
- **Commands:** `/give @s apark:park_kit`

### Chat commands

Typing works too, if tapping is awkward:

```
!help      !ferris   !coaster   !carousel   !tower
!bumper    !swing    !gate      !food       !park     !undo
```

Command blocks can use `/scriptevent apark:build ferris` (or any name from the list).

## Notes and limits

- Builds are **destructive** — they clear their plot. That is what the undo wand is for.
- The undo wand remembers one build at a time, up to 60,000 blocks, and only until the
  world is closed. A full Park Kit is larger than that, so undoing one leaves some of it behind.
- Rides build away from you, facing the direction you were looking. The coaster's plot is
  the largest single ride at roughly 46 × 60 blocks.
- Blocks far outside your simulation distance can't be written; the finish message reports
  any that were out of range. Standing near the middle of a big build avoids this.

## Repository layout

```
addon/behavior_packs/amusement_park_bp/    items, recipes, scripts/main.js
addon/resource_packs/amusement_park_rp/    item textures, item_texture.json, lang
dist/AmusementPark.mcaddon                 the packaged add-on
build.sh                                   validate + zip into dist/
validate.py                                manifest/texture/lang/recipe consistency checks
```

Rebuild after editing:

```bash
./build.sh
```

## How the builders work

`scripts/main.js` describes every ride as a JavaScript **generator** that yields one block
placement at a time. A scheduler drains those generators with a per-tick budget
(≈2,200 blocks or 9 ms, whichever comes first), so even the full park never blocks the game
or trips the script watchdog on a phone.

Two details worth knowing if you edit it:

- **Block names.** Bedrock 1.21 renamed a lot of blocks (`minecraft:concrete` →
  `minecraft:red_concrete`, and so on). Every palette entry is a list of candidate ids and the
  first one that resolves on your version wins, so the pack still works on older worlds.
- **Orientation.** Rides are written in local coordinates (right / up / forward) and a frame
  maps them into the world based on which way you were facing. The roller coaster computes its
  rail shapes — straights, curves and slopes — in world space afterwards, so the circuit
  connects correctly in all four facings.
