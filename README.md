# ⚔️ Legendary Weapons — Minecraft Bedrock Add-On

A weapons add-on (Behavior Pack + Resource Pack) built for **Minecraft Bedrock Beta 1.21.0.26**,
including **mobile** (Android / iOS). Adds **7 custom craftable weapons** — 5 themed weapons and
**2 magical weapons** with an enchanted glint.

`min_engine_version` is `1.21.0`, so it also loads on the 1.21.x release line.

## 🗡️ The weapons

| Weapon | Type | Damage | Durability | Crafting materials |
|--------|------|:------:|:----------:|--------------------|
| 🔥 Blaze Sword | Sword | 9 | 1400 | 2× Blaze Rod + Stick |
| ❄️ Frost Blade | Sword | 8 | 1600 | 2× Diamond + Stick |
| ⚡ Thunder Hammer | Axe | 11 | 1900 | 5× Iron Ingot + 2× Stick |
| 🐍 Venom Dagger | Sword | 6 | 900 | Emerald + Stick |
| 🌑 Shadow Scythe | Sword | 10 | 1500 | 3× Netherite Scrap + 2× Stick |
| ✨ **Arcane Blade** *(magical)* | Sword | 13 | 2400 | Amethyst + 2× Gold + Nether Star |
| 🌟 **Celestial Staff** *(magical)* | Sword | 12 | 2200 | Amethyst + 2× Gold Ingot |

All weapons are **enchantable** (anvil / enchanting table) and **repairable** with their
crafting material. The two magical weapons have the enchanted **glint** (`minecraft:foil`),
colored names, and lore text.

### Crafting patterns
Use a **crafting table**. Examples (top → bottom rows):

```
Blaze Sword       Thunder Hammer      Arcane Blade
[   ][Blz][   ]   [Fe][Fe][Fe]        [   ][Amy][   ]
[   ][Blz][   ]   [Fe][St][Fe]        [Gld][Amy][Gld]
[   ][Stk][   ]   [   ][St][   ]       [   ][Str][   ]
```

## 📱 How to install (Mobile — easiest)

1. Download **`LegendaryWeapons.mcaddon`** from this repo to your phone.
2. Tap the file — Minecraft opens and imports **both** packs automatically.
3. Create/edit a world → **Behavior Packs** → activate *Legendary Weapons [Behavior]*
   (the Resource Pack is applied automatically as a dependency).
4. Play and craft the weapons!

## 💻 Manual install (Windows / anywhere)

Copy the folders into your Minecraft `com.mojang` directory:

- `WeaponsMod_BP/` → `development_behavior_packs/`
- `WeaponsMod_RP/` → `development_resource_packs/`

Then enable both packs in your world settings.

## 📂 Project structure

```
WeaponsMod_BP/            Behavior pack (items, recipes)
  manifest.json
  items/*.json            One custom item per weapon
  recipes/*.json          Crafting-table recipes
  texts/en_US.lang
WeaponsMod_RP/            Resource pack (textures, names)
  manifest.json
  textures/item_texture.json
  textures/items/*.png    16×16 weapon icons
  texts/en_US.lang
LegendaryWeapons.mcaddon  One-tap installer (both packs zipped)
```

## 🔧 Rebuilding the `.mcaddon`

After editing pack files, re-zip both folders (keeping their folder names at the
archive root) and rename the archive to `LegendaryWeapons.mcaddon`.
