# Magical Black Hole – Minecraft Bedrock add-on

A magical black hole you keep in your inventory. Use it and a swirling black hole
forms in front of you. It pulls in and swallows everything nearby: dropped items,
mobs, XP orbs, arrows, TNT and (if you want) the blocks around it. Use it again and
it collapses, sending everything it swallowed straight to your inventory.

Made for **Minecraft Bedrock 1.21.0.26 (beta)** on Android. It also works on newer
versions. No experimental toggles are needed.

## Install (Android / phone)

1. Download **[`dist/MagicalBlackHole.mcaddon`](dist/MagicalBlackHole.mcaddon)** to your phone.
   On GitHub, open the file and tap **Download** (or "View raw").
2. Tap the downloaded file. Minecraft opens and says *Import started… Successfully imported*
   twice (once for each pack).
   - If tapping does nothing, open your file manager, long-press the file → **Open with → Minecraft**.
3. In Minecraft, **Create New World** (or edit a world) → **Behavior Packs** → **Available** →
   activate **Magical Black Hole (Behavior)**. The resource pack is added automatically.
4. Play!

## How to use it

| Action | What happens |
| --- | --- |
| **Use** the Magical Black Hole (tap the screen while holding it) | A black hole forms a few blocks in front of you |
| **Use it again** | Your black hole collapses and everything inside goes to your inventory (extra items drop at your feet) |
| **Sneak + use** | Opens the settings menu |

You get one **for free** the first time you join a world. You can also:

- find it in the creative inventory (**Equipment** tab, search "black hole")
- use the command `/give @s blackhole:magic_black_hole`
- craft it:

  ```
  Obsidian    Ender Pearl   Obsidian
  Ender Pearl Eye of Ender  Ender Pearl
  Obsidian    Ender Pearl   Obsidian
  ```

### What the black hole does

- **Pulls** everything within its range (10 blocks when small, up to 38 when huge) in a spiral.
- **Swallows** whatever reaches its centre:
  - dropped items, including enchanted or named ones (they keep their enchantments)
  - mobs (their drops and XP get swallowed too)
  - XP orbs, arrows, tridents, TNT and end crystals (swallowed safely, no explosions)
  - other players get pulled and hurt (you, the owner, are always safe)
- **Devours blocks** around it, so it digs a round crater. The blocks come back to you as items.
  Bedrock, portals, command blocks and other unbreakable blocks are never eaten.
- **Grows** as it eats, up to the maximum size you choose.
- **Evaporates** when its lifetime ends and still gives everything back to you.

### Settings (sneak + use)

| Setting | Default | Meaning |
| --- | --- | --- |
| Devour blocks | ON | Turn OFF to only pull in items and mobs and keep your builds safe |
| Maximum size | 4 | 1 = tiny, 8 = gigantic (bigger means stronger pull and a bigger crater) |
| Lifetime | 1 minute | 15 s, 30 s, 1 min, 2 min, 5 min, or until you recall it |
| Pull other players | ON | Whether other (survival) players get pulled in |
| Protect pets and named mobs | ON | Tamed animals and mobs with a name tag are left alone |

Changing a setting also updates your black hole that's already open.

## For developers

```
packs/MagicalBlackHole_BP/   behavior pack (item, entity, recipe, scripts/)
packs/MagicalBlackHole_RP/   resource pack (model, textures, particles, animation)
tools/generate_textures.py   regenerates every PNG (needs Pillow)
tools/build.py               zips both packs into dist/MagicalBlackHole.mcaddon
```

Scripts use the stable `@minecraft/server` **1.10.0** and `@minecraft/server-ui` **1.1.0**
modules, the newest stable versions in 1.21.0.26.

Rebuild after changing anything:

```sh
python3 tools/generate_textures.py   # only if you changed the textures
python3 tools/build.py
```
