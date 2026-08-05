# ⚡ God Abilities — Minecraft Bedrock Add-On (BP + RP)

Five god-tier ability items for **Minecraft Bedrock / Pocket Edition 1.21.x** (tested target: `1.21.0.26`, Android).
Made of a **Behaviour Pack (BP)** and a **Resource Pack (RP)** — exactly what a Bedrock "mod" is.

![the five god items](docs/preview.png)

---

## 📲 Install on your phone (Android / iOS)

1. Download **`dist/GodAbilities.mcaddon`** from this repo onto your phone.
2. Tap the downloaded file → **Open with Minecraft**. It imports both packs automatically.
3. Create or edit a world → **Behaviour Packs** → activate **God Abilities [Behaviour]**.
   The resource pack is pulled in automatically as a dependency (if not, activate it under **Resource Packs** too).
4. In the world settings, keep the defaults. No experimental toggle is required on 1.21.
5. Play. In chat run `/scriptevent godmod:give` to get all 5 items instantly,
   or craft them (recipes below), or find them in the Creative inventory under **Equipment**.

> If your file manager will not open `.mcaddon`, rename it to `.zip`, or use the two
> `.mcpack` files in `dist/` instead (import the RP first, then the BP).

---

## 🗡️ The 5 abilities

Hold the item and **use** it — long-press / tap the use button on mobile, right-click on PC.

| # | Item | Effect | Cooldown |
|---|------|--------|----------|
| 1 | ⚡ **Divine Wrath** | Calls a lightning storm on the block you are aiming at (up to 64 blocks). 4 bolts, 35 damage + knockback in a 7-block blast. | 4 s |
| 2 | 🟢 **Genesis Core** | Full heal + Regeneration IV, Absorption IV, Resistance III, Health Boost III, Fire Resistance, Night Vision — for you **and every player within 14 blocks**. Also puts out fire. | 10 s |
| 3 | 🕊️ **Wings of Heaven** | Rocket-launches you in the direction you look, then Slow Falling so the landing is safe, plus Speed III / Jump Boost IV / Resistance II. | 5 s |
| 4 | 🟣 **Void Ripper** | Drags every mob within 18 blocks toward you, holds them slowed, then after ~1.2 s annihilates everything within 10 blocks for 120 damage. | 9 s |
| 5 | 🔵 **Chrono Scepter** | Freezes time for mobs within 22 blocks (Slowness XXI, Weakness XI, Mining Fatigue VI for 15 s) while **you** get Speed V, Haste V, Resistance II. | 14 s |

### Chat commands

| Command | What it does |
|---------|--------------|
| `/scriptevent godmod:give` | Gives you all 5 god items |
| `/scriptevent godmod:help` | Shows the ability list in chat |

### Crafting recipes (survival)

All recipes use a **Nether Star** as the divine core.

```
Divine Wrath      Genesis Core        Wings of Heaven     Void Ripper       Chrono Scepter
  . N .            G A G                F . F               O E O             D C D
  . I .            A N A                F N F               E N E             G N G
  . B .            G A G                F E F               O S O             . G .

N Nether Star   I Netherite Ingot   B Blaze Rod   G Gold Ingot   A Golden Apple
F Feather       E Ender Eye/Elytra  O Obsidian    S Stick        D Diamond      C Clock
```
(`E` is Ender Eye in Void Ripper, Elytra in Wings of Heaven.)

---

## 🗂️ Project layout

```
minecraft-god-abilities/
├── BP/                        behaviour pack
│   ├── manifest.json          min_engine_version 1.21.0, @minecraft/server 1.11.0
│   ├── items/*.json           the 5 custom items (icon, glint, damage, cooldown)
│   ├── recipes/*.json         crafting recipes
│   ├── scripts/main.js        all 5 abilities (Script API)
│   └── texts/en_US.lang
├── RP/                        resource pack
│   ├── manifest.json
│   ├── textures/item_texture.json
│   ├── textures/items/*.png   5 hand-drawn 16×16 icons
│   └── texts/en_US.lang       item display names
├── tools/make_textures.py     regenerates every PNG (pure stdlib, no Pillow)
├── tools/build.sh             rebuilds dist/*.mcaddon and dist/*.mcpack
└── dist/                      ready-to-import files
```

## 🔧 Rebuilding after an edit

```bash
bash minecraft-god-abilities/tools/build.sh
```

## ⚙️ Version notes

* `min_engine_version` is `1.21.0` and the script module is pinned to `@minecraft/server` **1.11.0**,
  which is the stable version shipped with 1.21.0 — **no experimental toggle needed**.
* If you later update to a much newer Bedrock version and the abilities stop firing, open
  `BP/manifest.json` and raise the `@minecraft/server` version (e.g. `1.13.0` for 1.21.20,
  `1.17.0` for 1.21.7x). The items themselves keep working either way.
* Ability code is written defensively (`try/catch` everywhere, both `applyKnockback` signatures
  supported), so a single unsupported API call can never break the whole pack.
