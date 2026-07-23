# ⚔️ Arcane Weapons — standalone Minecraft Bedrock mod (mobile)

Just the weapons, no haunted house. A Bedrock Add-On (Behavior Pack + Resource
Pack) that adds three custom scripted weapons.

| Weapon | ID | Melee hit | Right-click ability |
|---|---|---|---|
| 🔥 **Flame Sword** | `arcane:flame_sword` | Sets target **on fire** + flame burst | **Fan of fire** (igniting fireballs) |
| 🔮 **Arcane Staff** | `arcane:arcane_staff` | Light magic strike | **Explosive fireball** |
| ⚡ **Storm Hammer** | `arcane:storm_hammer` | Calls a **lightning bolt** on the target | — |

## Install (mobile)

1. Download **`dist/ArcaneWeapons.mcaddon`** and tap it — Minecraft imports both packs.
2. Create a world → enable **Arcane Weapons [BP]** → turn **Cheats ON**.
3. In chat, run `/function arcane/give` to get all three, or
   `/give @s arcane:flame_sword` (etc.) for a single weapon.

Requires **Minecraft Bedrock 1.20.60+**. Abilities are powered by the stable
Script API (`@minecraft/server`) — no experimental toggle needed.

## Files

```
behavior_pack/
  manifest.json
  items/{flame_sword,arcane_staff,storm_hammer}.json
  scripts/main.js               # ability logic + cooldowns
  functions/arcane/give.mcfunction
resource_pack/
  manifest.json
  textures/item_texture.json
  textures/items/*.png
  texts/en_US.lang
```

Rebuild the installable file with `python3 scripts/package.py` from the repo root
(outputs `dist/ArcaneWeapons.mcaddon`).
