# Second Sight — Survival God Mode

A Minecraft **Bedrock** addon (behaviour pack + resource pack) for **Minecraft
for Android**, built and tested against the version in your screenshot:
**v1.21.0.26 beta**.

Two things in one addon:

1. **Survival god mode** — you stay in Survival (hunger bar, mobs still chase
   you, blocks break at normal speed) but nothing can kill you.
2. **Second-person view** — the camera flips around and looks *at* your
   character instead of out of their eyes. Not the usual POV.

Everything runs on vanilla commands (`/camera`, `/effect`). **No experimental
toggles, no Beta APIs, no scripting** — so it will not break when your beta
build updates.

---

## Install on your phone

1. Download **`dist/SecondSightGodMode.mcaddon`** onto the phone.
2. Tap the file. Minecraft opens and imports both packs.
3. Create or edit a world → **Behaviour Packs** → activate
   *Second Sight: Survival God Mode [BP]*. The resource pack turns itself on
   with it (the BP depends on it).
4. Turn **Cheats** ON if you want the `/function` commands. The two items work
   either way.
5. Play.

If tapping the file does nothing, rename it to `.zip`, unzip it, and put
`SecondSight_BP` in `games/com.mojang/behavior_packs/` and `SecondSight_RP` in
`games/com.mojang/resource_packs/`.

---

## How you use it

You get two items. Both are **tap-to-throw** — a tap is the whole interaction,
and the item comes straight back to your inventory, so you never run out.

| Item | What a tap does |
| --- | --- |
| 👁 **Perspective Lens** | Cycles your view: **first person → second person → behind → first person** |
| ✨ **God Core** | Turns god mode **on / off** |

Get them with `/function ssgm/kit`, or from the **Equipment** tab in the
Creative inventory.

### The views

- **First person** — normal Minecraft.
- **Second person** — the camera sits in front of you looking back at your
  face. You watch your own character react while you play. This is the
  "not-the-usual-POV" mode.
- **Behind** — over-the-shoulder, like the normal third-person toggle.

You keep full control in every mode — walking, mining, fighting, inventory,
all of it. The view also **survives dying, respawning, going to the Nether and
reloading the world**; you do not have to re-toggle it.

### What god mode gives you

| Effect | Level | Why |
| --- | --- | --- |
| Resistance | 255 | Full damage immunity — mobs, fall, explosions, lava |
| Fire Resistance | 255 | Burning and lava |
| Water Breathing | 255 | No drowning |
| Regeneration | V | Instant heal-back |
| Saturation | 255 | Hunger bar never drops |
| Night Vision | 255 | See in caves |
| Strength | II | One-hit most mobs |
| Haste | II | Fast mining |

You stay in **Survival** the whole time — that is the point. The only things
that can still kill you are `/kill` and falling into the void.

---

## Commands

Cheats must be on for these. The items do not need cheats.

| Command | What it does |
| --- | --- |
| `/function ssgm/help` | Prints this cheat-sheet in chat |
| `/function ssgm/kit` | Gives you the Lens and the Core |
| `/function ssgm/god_on` | God mode on |
| `/function ssgm/god_off` | God mode off |
| `/function ssgm/view/second` | Second-person view |
| `/function ssgm/view/behind` | Over-the-shoulder view |
| `/function ssgm/view/first` | Normal view |
| `/function ssgm/reset` | Everything off, camera back to normal |

---

## How it works

- `functions/tick.json` runs `ssgm/core/tick` every game tick. That one
  function does all the work.
- The two items are `minecraft:throwable`. Throwing one spawns an invisible
  projectile (`ssgm:lens_orb` / `ssgm:god_orb`) for a moment. The tick function
  spots the orb, tags the nearest player as the thrower, kills the orb, and
  gives the item back with a `clear` + `give` pair so you always hold exactly
  one.
- View state lives in player tags (`ssgm_view1`, `ssgm_view2`). The tick
  function re-applies `/camera <player> set minecraft:third_person_front`
  (or `minecraft:third_person`) every tick, which is what makes the view stick
  through respawns and reloads.
- God mode is the `ssgm_god` tag plus eight `/effect` commands refreshed each
  tick with a 20-second duration, so they come back on their own after a death.

Because it is all tags and vanilla commands, there is no saved state to
corrupt — removing the pack removes the addon cleanly. Run
`/function ssgm/reset` first if you want your camera back before uninstalling.

---

## Building from source

```sh
python3 tools/generate_textures.py   # redraw the item icons + pack icons
python3 tools/build.py               # validate, then zip dist/SecondSightGodMode.mcaddon
```

`tools/build.py` refuses to build if any JSON is malformed, any manifest UUID
collides, any `/function` call points at a file that does not exist, or any
item icon is missing from `item_texture.json`.

## Layout

```
SecondSight_BP/
  manifest.json
  entities/          ssgm:lens_orb, ssgm:god_orb  (invisible trigger projectiles)
  items/             ssgm:perspective_lens, ssgm:god_core
  functions/
    tick.json        registers the per-tick loop
    ssgm/            commands you type
    ssgm/core/       internals
SecondSight_RP/
  manifest.json
  entity/            client-side (renders nothing) for the trigger orbs
  textures/items/    16x16 icons
  texts/en_US.lang
```
