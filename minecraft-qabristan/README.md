# 🪦 Qabristan — Minecraft Bedrock Add-On (BP + RP)

**Qabristan (قبرستان)** — a graveyard. This add-on gives you a shovel that raises a whole walled
graveyard out of the ground, a lantern that wakes what sleeps in it, and a bell that puts it back
to rest.

For **Minecraft Bedrock / Pocket Edition 1.21.x** (target: `1.21.0.26`, Android).

![the four Qabristan items](docs/preview.png)

---

## 📲 Install and use (simple steps)

1. Download **`dist/Qabristan.mcaddon`**.
2. Tap the file → **Open with Minecraft** → "Successfully imported".
3. World settings → **Behavior Packs** → **Qabristan [Behavior]** → **Activate** (say Yes to the resource pack).
4. In chat: `/scriptevent qabr:give` — you get all 4 items.
5. Stand on **flat open ground**, hold the **Gravedigger's Shovel** and **long press**. Wait ~9 seconds.

> ⚠️ The shovel replaces the ground around you (about 27 × 23 blocks). Use it on empty land.

---

## 🪦 The items

| Item | What it does | Cooldown |
|------|--------------|----------|
| ⛏️ **Gravedigger's Shovel** | Builds the whole graveyard around you and remembers where the gate is. | 30 s |
| 🏮 **Cursed Lantern** | Wakes **13 undead** in a ring around you — 6 zombies, 4 skeletons, 2 husks and a named **Qabristan Guardian** (a buffed wither skeleton). They are fire resistant, so daylight will not save you. | 20 s |
| 🔔 **Soul Bell** | Banishes **every undead within 24 blocks** at once, and gives you Resistance III, Regeneration II and Night Vision. This is the counter to the lantern. | 15 s |
| 🧭 **Spirit Compass** | Teleports you back to your graveyard gate and tells you how many undead are within 40 blocks. | 10 s |

**Kill the Guardian** and it leaves its grave goods: 3 diamonds, 5 emeralds, 2 golden apples and 16 bones.

### What the shovel builds

```
                          gate  (soul lanterns on both posts)
        ┌──────────────────╨──────────────────┐
        │  🪦 🪦 🪦        gravel path        🪦 🪦 🪦  │
        │  🪦 🪦 🪦     ┌───────────┐        🪦 🪦 🪦  │   stone brick wall,
        │  🪦 🪦 🪦     │   TOMB    │        🪦 🪦 🪦  │   mossy in places,
        │  🪦 🪦 🪦     │  quartz + │        🪦 🪦 🪦  │   slab capped
        │              │ stairs ↓  │                 │
        │  old spruce  └───────────┘   old spruce    │
        └────────────────────────────────────────────┘
                     ↓ crypt below the tomb
```

* **24 graves** in rows — headstones of stone brick, mossy stone brick, cobblestone, mossy
  cobblestone and polished andesite, each capped with a slab, with a raised earth mound.
* **Walled enclosure** with a gravel path, an arched gate and soul lantern posts.
* **A quartz tomb** in the centre with a stepped dome and a soul lantern inside.
* **A crypt underneath** — mossy cobblestone, cobwebs, soul lanterns, bone blocks and **3 chests
  with buried treasure** (diamonds, emeralds, gold, golden apples, iron, bones).
* **Four old spruce trees** in the corners.

### Chat commands

| Command | What it does |
|---------|--------------|
| `/scriptevent qabr:give` | Gives you all 4 items |
| `/scriptevent qabr:build` | Builds the graveyard where you stand |
| `/scriptevent qabr:help` | Explains everything in chat |

### Crafting recipes

```
Gravedigger's Shovel   Cursed Lantern   Soul Bell        Spirit Compass
    . I .                  . I .          G G G             . G .
    . S .                  I N I          G B G             G C G
    . S .                  . I .          . G .             . G .

I Iron Ingot   S Stick   N Soul Sand   G Gold Ingot   B Bone Block   C Compass
```

---

## 🔨 How it works

`BP/scripts/main.js` writes ~190 `fill` / `setblock` / `replaceitem` commands and runs **24 per
tick**, so the graveyard rises smoothly even on a phone. Every command is in its own `try/catch`,
so an unsupported block just gets skipped and counted instead of stopping the build.

Only block ids that exist on every 1.21 build are used — no walls, stairs or other
orientation-dependent blocks — so the graveyard can never come out with pieces missing or
facing the wrong way.

## 🗂️ Project layout

```
minecraft-qabristan/
├── BP/manifest.json          min_engine_version 1.21.0, @minecraft/server 1.11.0
├── BP/items/*.json           the 4 items
├── BP/recipes/*.json         crafting recipes
├── BP/scripts/main.js        graveyard plan + summon / banish / compass logic
├── RP/                       4 hand-drawn 16×16 icons and item names
├── tools/make_textures.py    regenerates the PNGs (pure stdlib)
├── tools/build.sh            rebuilds dist/*.mcaddon and dist/*.mcpack
└── dist/                     ready-to-import files
```

## ⚙️ Notes

* Works alongside the other add-ons in this repo — different namespaces, no conflict.
* The remembered gate location survives world reloads (stored as a world property), with an
  in-memory fallback if your version does not support that.
* This is a Minecraft fantasy build — a spooky graveyard with undead, in the same spirit as
  vanilla's zombies and skeletons.
