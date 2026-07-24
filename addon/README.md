# Blocky Pet — Minecraft (Bedrock / Mobile) Add-On

A custom pet that looks like the reference image: a red-orange blocky
creature with two black eyes, little arms on each side, and four stubby legs.
It can be **spawned from your inventory** and will **follow you** once tamed.

> **Why an Add-On and not a "mod"?** Minecraft on mobile (phones/tablets) is
> **Bedrock Edition**, which does not run Java mods (Forge/Fabric). Bedrock uses
> **Add-Ons** made of a Behavior Pack + Resource Pack — that is exactly what
> this is, so it works on Android/iOS, Windows 10/11, and consoles.

## What's included
- `behavior_pack/` — the entity logic (spawn egg, movement, taming, follow).
- `resource_pack/` — the 3D model, texture, and spawn-egg colors.
- `../BlockyPet.mcaddon` — both packs zipped together for one-tap install.

## Install on mobile (Android / iOS)
1. Copy **`BlockyPet.mcaddon`** to your phone.
2. Tap the file — it opens in Minecraft and imports automatically.
3. Create/edit a world → **Behavior Packs** and **Resource Packs** →
   activate **Blocky Pet** in both lists.
4. Make sure **Creative** mode is on (or `/give`) so the spawn egg is available.

## Install on Windows 10/11
Same as above — double-click `BlockyPet.mcaddon`, then activate both packs
on your world.

## How to use it
- **Spawn it (inventory):** In Creative, open your inventory → **Items** tab →
  find **"Spawn Blocky Pet"** (red egg with black speckles). Place it in the
  world. You can also run `/summon rp:red_pet`.
- **Make it follow you:** Hold an **apple, wheat, bone, or cooked beef**, then
  tap/right-click the pet once to tame it. After taming it follows you around.
- **Name it:** Use a name tag on it if you like (it's nameable).
- **Leash it:** It can be leashed.

## Customizing
- **Color:** edit `resource_pack/textures/entity/red_pet.png` (16×16). The large
  area is the body color; the small dark patch is the eyes.
- **Shape:** edit the cubes in
  `resource_pack/models/entity/red_pet.geo.json` (16 units = 1 block).
- **Speed / follow distance:** edit `minecraft:movement` and
  `minecraft:behavior.follow_owner` in `behavior_pack/entities/red_pet.json`.

After editing the folders, re-zip them into a `.mcaddon` to reinstall.
