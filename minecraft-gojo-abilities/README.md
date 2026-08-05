# 🔵 Gojo Abilities — Minecraft Bedrock Add-On (BP + RP)

Satoru Gojo's cursed techniques as usable items for **Minecraft Bedrock / Pocket Edition 1.21.x**
(target: `1.21.0.26`, Android). Behaviour Pack + Resource Pack, with a one-tap `.mcaddon` for phones.

![the six Gojo items](docs/preview.png)

---

## 📲 Install on your phone (simple steps)

1. Download **`dist/GojoAbilities.mcaddon`**.
2. Tap the file → **Open with Minecraft**. It says "Successfully imported".
3. Edit or create a world → **Behavior Packs** → **My Packs** → **Gojo Abilities [Behavior]** → **Activate**.
   Say **Yes** if it asks about the resource pack.
4. Play, then type in chat: `/scriptevent gojo:give` — you get all 6 techniques.
5. Hold an item and **long press** the screen to use it.

---

## ⚔️ The techniques

| Item | What it does | Cooldown |
|------|--------------|----------|
| 👓 **Six Eyes Blindfold** | Instantly teleports you to whatever you are looking at (up to 60 blocks), then gives Night Vision, Speed, Haste, Jump Boost and a safe landing. Marks every mob within 30 blocks. | 8 s |
| ♾️ **Infinity** | **Toggle on/off.** While on, nothing reaches you — Resistance 250, fire immunity, no fall damage, and any mob that comes within 4 blocks is pushed straight back out. | 2 s |
| 🔵 **Cursed Technique Lapse: Blue** | Creates a point of attraction where you aim (40 blocks). For ~1 second it drags every mob within 10 blocks into the centre, then crushes them for 45 damage. | 6 s |
| 🔴 **Cursed Technique Reversal: Red** | The opposite — a repulsion blast at the point you aim. 70 damage and a huge launch for everything within 14 blocks. You get a small recoil push backwards. | 9 s |
| 🟣 **Hollow Purple** | Fires an imaginary mass that travels 60 blocks and **erases a 3×3 tunnel through terrain**, dealing 250 damage to anything caught in it. Bedrock, barriers and command blocks are never erased. | 20 s |
| ⚫ **Domain Expansion: Unlimited Void** | For 12 seconds every mob within 28 blocks is locked down (Slowness XXVI, Weakness, Blindness, Nausea, Mining Fatigue) and takes steady damage, while you get Resistance, Speed, Regeneration and Night Vision. | 60 s |

> ⚠️ **Hollow Purple destroys blocks.** Do not fire it at your base. Everything else is safe for terrain.

### Chat commands

| Command | What it does |
|---------|--------------|
| `/scriptevent gojo:give` | Gives you all 6 technique items |
| `/scriptevent gojo:help` | Lists the techniques in chat |
| `/scriptevent gojo:infinity` | Toggles Infinity without holding the item |

### Crafting recipes (survival)

```
Six Eyes         Infinity        Blue            Red             Hollow Purple    Unlimited Void
  W W W            . E .           . L .           . R .           L B L             O E O
  E D E            E N E           L N L           R N R           B N B             E N E
  W W W            . E .           . L .           . R .           L B L             O E O

W White Wool   E Ender Eye   D Diamond   N Nether Star
L Lapis Lazuli   R Redstone   B Block of Redstone   O Obsidian
```

---

## 🗂️ Project layout

```
minecraft-gojo-abilities/
├── BP/                        behaviour pack
│   ├── manifest.json          min_engine_version 1.21.0, @minecraft/server 1.11.0
│   ├── items/*.json           the 6 technique items
│   ├── recipes/*.json         crafting recipes
│   ├── scripts/main.js        every technique (Script API)
│   └── texts/en_US.lang
├── RP/                        resource pack
│   ├── textures/items/*.png   6 hand-drawn 16×16 icons
│   ├── textures/item_texture.json
│   └── texts/en_US.lang       item display names
├── tools/make_textures.py     regenerates every PNG (pure stdlib, no Pillow)
├── tools/build.sh             rebuilds dist/*.mcaddon and dist/*.mcpack
└── dist/                      ready-to-import files
```

## 🔧 Rebuilding after an edit

```bash
bash minecraft-gojo-abilities/tools/build.sh
```

## ⚙️ Notes

* Works alongside the [God Abilities](../minecraft-god-abilities/) pack — different namespaces, no conflict.
* Infinity's on/off state is kept in memory, so it switches off when the world reloads. Just tap it again.
* If you update to a much newer Bedrock version and techniques stop firing, raise the
  `@minecraft/server` version in `BP/manifest.json` (`1.13.0` for 1.21.20, `1.17.0` for 1.21.7x).
* Fan project, not affiliated with Mojang or the Jujutsu Kaisen rights holders.
