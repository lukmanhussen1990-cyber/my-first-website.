# One Punch Man Addon — Minecraft Bedrock (Mobile)

A Minecraft **Bedrock Edition** addon (Android / iOS / Windows / Console) that adds two
inventory items from One Punch Man:

| Item | How you use it | What it does |
| --- | --- | --- |
| **Normal Punch** | Tap/hold to throw the shockwave, or hit a mob directly | 25 melee damage. Fires a fist shockwave that flies straight and detonates on impact — 30 impact damage plus a TNT-sized crater. 0.75s cooldown. |
| **Serious Punch** | Same, but hold on to something | 120 melee damage. Fires a wave that **carves a tunnel of explosions through the terrain as it flies**, then finishes with a huge blast on impact (200 impact damage). Chews through obsidian and bedrock. 8s cooldown. |

Both are throwable *and* usable as melee weapons, never break, and appear in the
creative inventory under **Equipment → Sword**.

---

## Install on mobile (the easy way)

1. Download **[`dist/OnePunchMan.mcaddon`](dist/OnePunchMan.mcaddon)** onto your phone
   (on GitHub: open the file → **Download raw file**).
2. Open the downloaded file. Android will offer "Open with Minecraft"; on iOS use
   **Share → Copy to Minecraft**.
3. Minecraft launches and imports both packs automatically. You'll see
   "Successfully imported One Punch Man Addon".
4. Create or edit a world → **Behavior Packs** → activate *One Punch Man Addon*.
   The resource pack is pulled in automatically as a dependency (if it isn't,
   activate it under **Resource Packs** too).
5. Play. No experimental toggles are required — the addon is pure JSON, no scripting.

### Getting the items

Creative: search `Normal Punch` / `Serious Punch` in the inventory.

Survival commands:
```
/give @s opm:normal_punch
/give @s opm:serious_punch
```

Survival crafting (crafting table):

**Normal Punch** — 4 leather around 1 iron block
```
 L
LIL
 L
```

**Serious Punch** — 4 diamond blocks + 4 netherite ingots around a Normal Punch
```
DND
NPN
DND
```

---

## Repository layout

```
OPM_BP/                          behavior pack (logic)
  manifest.json
  items/normal_punch.json        item + throwable/projectile components
  items/serious_punch.json
  entities/normal_punch_wave.json    the flying shockwave
  entities/serious_punch_wave.json   flying wave that spawns blasts along its path
  entities/serious_blast.json        the individual trail explosions
  recipes/                       crafting recipes
  texts/en_US.lang               item + pack names
OPM_RP/                          resource pack (visuals)
  textures/items/*.png           16x16 item icons
  textures/item_texture.json     icon atlas
  entity/*.entity.json           invisible render definitions for the waves
  models/entity/opm_blank.geo.json
  render_controllers/
dist/OnePunchMan.mcaddon         ready-to-import bundle
tools/make_textures.py           regenerates the PNGs (no dependencies)
tools/build.py                   validates the packs and rebuilds the .mcaddon
```

### Rebuilding after an edit

```bash
python3 tools/make_textures.py   # only if you changed the sprites
python3 tools/build.py           # validates JSON + cross-references, rewrites dist/
```

`build.py` checks that every JSON file parses, that pack UUIDs are unique, that each
item's `projectile_entity` actually exists, that every behavior entity has a client-side
definition, and that every icon resolves to a real PNG.

---

## Tuning the destruction

Everything lives in the `minecraft:explode` components. Higher `power` = bigger crater.

| What you want | File | Change |
| --- | --- | --- |
| Bigger normal punch crater | `OPM_BP/entities/normal_punch_wave.json` | `power` (currently `3.5`, TNT is `4`) |
| Bigger serious punch finish | `OPM_BP/entities/serious_punch_wave.json` | `power` (currently `8`) |
| Wider / denser destruction tunnel | `OPM_BP/entities/serious_blast.json` | `power` (currently `3.5`) |
| Longer destruction tunnel | `OPM_BP/entities/serious_punch_wave.json` | `minecraft:timer` `time` (currently `3.0` seconds of flight) |
| More blasts along the tunnel | `OPM_BP/entities/serious_punch_wave.json` | `min_wait_time` / `max_wait_time` (currently `0.2`s between blasts) |
| **Stop it eating obsidian and bedrock** | `serious_punch_wave.json` + `serious_blast.json` | delete the `"max_resistance": 5.0` lines |

### Two things to know before you crank the numbers up

- **`max_resistance: 5.0` on the Serious Punch is deliberate.** It caps every block's
  blast resistance at 5, which is what lets it blow through obsidian, ancient debris,
  and **bedrock** — including the bottom of the world and the Nether roof. That is the
  series-accurate behaviour you asked for, but it *will* punch holes in terrain you may
  care about. Remove the line if you'd rather keep bedrock intact.
- **Mobile performance.** Explosion power scales roughly cubically in blocks destroyed:
  power `8` is already thousands of blocks per blast, and the serious punch fires ~15
  trail blasts on top of that. Pushing `power` past ~12 on a phone will stutter badly or
  hang the world. Raise it in small steps.

---

## Compatibility

- Written against the stable Bedrock JSON formats (items `1.20.30`, entities `1.16.0`,
  recipes `1.20.10`); `min_engine_version` is `1.20.0`. These formats are still
  supported by current 1.21.x clients.
- **No experimental toggles and no scripting**, so it works on mobile, on Realms, and
  in multiplayer without extra setup.
- Explosions ignore the `mobGriefing` gamerule (`destroy_affected_by_griefing: false`),
  so the punches always break blocks. In a server world where you don't want that, set
  that field to `true` and turn `mobGriefing` off.

## Status / what wasn't verified

The packs are structurally validated by `tools/build.py` (JSON parses, UUIDs unique,
every cross-reference between items, entities, textures and render definitions
resolves). They have **not** been launched in an actual Minecraft client from this
environment — no Bedrock client is available here — so the balance numbers above are
design targets, not measured in-game results. If Minecraft reports a content error on
import, check **Settings → Creator → Content Log** for the exact file.
