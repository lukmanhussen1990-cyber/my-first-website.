# 🏚️ Haunted House — Minecraft Bedrock Add-On (Mobile)

A from-scratch **Minecraft Bedrock Edition** Add-On (works on **mobile / Pocket
Edition**, Windows 10/11, and consoles) with a **Behavior Pack (BP)** and a
**Resource Pack (RP)**. Run a single command in-game and a spooky two-story
haunted mansion is built around you — complete with a graveyard, dead trees,
broken windows, cobwebs, a witch's brewing room, and creepy purple fog.

> Bedrock Edition doesn't use Java "mods" (`.jar` files). The correct format for
> **mobile Minecraft** is an **Add-On** (Behavior Pack + Resource Pack), which is
> exactly what this is.

---

## 📥 Install on Mobile (Android / iOS) — easiest way

1. Download **`dist/HauntedHouse.mcaddon`** from this repo onto your phone.
2. Tap the downloaded file. Minecraft opens and imports **both** packs
   automatically (you'll see "Importing..." then a success message).
3. Open/Create a world → **Create New World**.
4. Go to **Behavior Packs** → activate **Haunted House Add-On [BP]**.
   The **[RP]** resource pack is applied automatically (it's a dependency).
5. Turn **Cheats / Activate Cheats: ON** (needed to run the `/function` command).
6. Play, then in the chat box run the command below.

> Prefer separate files? Use `dist/HauntedHouse_BP.mcpack` and
> `dist/HauntedHouse_RP.mcpack` and tap each one.

---

## 🧱 Build the house

Open chat (the speech-bubble at the top of the screen) and type:

```
/function haunted_house/build
```

Stand in a **flat, open area** first (Creative mode recommended) — the mansion is
built *around you*, extending in front and above your position.

### More commands

| Command | What it does |
|---|---|
| `/function haunted_house/build` | Builds the full haunted mansion + yard |
| `/function haunted_house/haunt` | Optional: summons a witch, bats, a zombie, plays eerie sounds, and rolls in spooky fog ⚠️ real mobs |
| `/function haunted_house/clear` | Removes the entire build (back to air) |
| `/fog @a remove spooky_fog` | Clears the purple fog after `haunt` |

You'll also receive a custom item, the **§5Cursed Key** (an enchanted-looking
key with a purple glint) — this is the add-on's custom item and proves both the
BP (item behavior) and RP (texture) are working.

---

## 🏚️ What gets built

- **Two-story dark-oak mansion** with a mossy-cobblestone foundation
- **Gable roof** with a **cobblestone chimney + campfire** (smoke!)
- **Broken iron-bar windows** on every side and both floors
- **Open, howling doorway** draped in cobwebs
- **Witch's room**: cauldron, crafting table, bookshelves, a glowing magma hearth
  (no open fire, so the house won't burn down)
- **Bone piles**, **soul sand**, and **hanging soul lanterns**
- **Fenced yard** with a front gate and **jack-o'-lanterns** on the posts
- **Graveyard** of cobblestone-wall tombstones on soul sand
- **Dead trees** and scattered **dead bushes**

---

## 🗂️ Project structure

```
behavior_pack/                     # BP — logic, build commands, custom item
  manifest.json
  pack_icon.png
  items/cursed_key.json            # custom item definition
  functions/haunted_house/
    build.mcfunction               # master command (calls the others)
    structure.mcfunction           # foundation, walls, floors, roof, chimney
    windows.mcfunction             # doorway + iron-bar windows
    interior.mcfunction            # hearth, furniture, cobwebs, lanterns
    exterior.mcfunction            # fence, gate, graveyard, trees, pumpkins
    haunt.mcfunction               # optional mobs, sounds, spooky fog
    clear.mcfunction               # removes the build

resource_pack/                     # RP — textures, fog, names
  manifest.json
  pack_icon.png
  textures/item_texture.json
  textures/items/cursed_key.png    # custom item texture
  fogs/spooky_fog.json             # purple haunted fog
  texts/en_US.lang, languages.json

scripts/
  make_textures.py                 # regenerates all PNGs (pure Python, no deps)
  package.py                       # rebuilds the .mcaddon / .mcpack files

dist/                              # ready-to-install packaged files
  HauntedHouse.mcaddon             # <-- tap this on mobile (both packs)
  HauntedHouse_BP.mcpack
  HauntedHouse_RP.mcpack
```

---

## 🛠️ Manual install (no `.mcaddon`)

If you'd rather copy folders (e.g. Windows 10/11 or Android file manager):

- **Behavior packs** → `.../minecraftpe/games/com.mojang/development_behavior_packs/`
- **Resource packs** → `.../minecraftpe/games/com.mojang/development_resource_packs/`

Copy the `behavior_pack` folder into the first and `resource_pack` into the
second, then activate them in your world's pack settings.

---

## 🔧 Rebuilding the packaged files

After editing any pack file, regenerate the textures and the installable
archives:

```bash
python3 scripts/make_textures.py   # regenerate PNGs
python3 scripts/package.py         # rebuild dist/*.mcaddon and *.mcpack
```

Requires only Python 3 (standard library) — no third-party packages.

---

## ✅ Compatibility

- Minecraft **Bedrock Edition 1.20+** (mobile, Windows 10/11, consoles)
- Uses stable vanilla block IDs and the `/function` command system
- **Cheats must be enabled** in the world to run `/function`

Made with 🖤 for spooky builders.
