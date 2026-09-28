# Gojo Satoru – Limitless Addon (Minecraft Bedrock 1.21.0.26+)

**Download:** [`dist/Gojo_Limitless.mcaddon`](dist/Gojo_Limitless.mcaddon)

![icons](docs/icons_preview.png)

## Install (Android / mobile)
1. Download `Gojo_Limitless.mcaddon` and tap it. Minecraft opens and imports **both** packs.
2. Create or edit a world: **Behavior Packs → Gojo Satoru – Limitless Addon → Activate** (the resource pack is added automatically).
3. No experimental toggles are required. The scripts only use the **stable** Script API of 1.21.0.26 (`@minecraft/server` 1.10.0, `@minecraft/server-ui` 1.1.0).
4. In game: Creative inventory → **Equipment** tab (at the end), or search **Gojo**. In Survival, craft the Transformation item (amethyst shard on top, lapis + eye of ender + redstone in the middle, diamond below) or use `/give @s gojo:transformation`.

## Controls (touch friendly)
Select a technique and **tap the screen**. Tapping the air, a block or a mob all cast it. The white sweep on the hotbar icon and the action bar show each cooldown.
**Sneak + tap** the Transformation item to open the Limitless menu (transform/release, toggles, settings, guide). You can also open it with `/scriptevent gojo:menu`.

| Technique | What it does | Cooldown |
|---|---|---|
| Gojo Satoru: Transformation | Puts all 9 techniques on your hotbar (your items move into the inventory, nothing is deleted), turns Infinity on, equips the blindfold with white hair, and gives Speed II, Strength II, Resistance, Jump Boost and Haste, plus a Limitless aura | 3 s |
| Infinity (toggle) | Enemies slow down as they approach and can't cross the barrier. Projectiles decelerate, stop in mid-air and dissolve (a player's trident drops instead). Hits that still connect are nullified; other damage is reduced by 80% | 1 s |
| Lapse: Blue | Point of attraction where you look (or on the tapped mob). It pulls everything within 10 blocks, crushes enemies for 4 s, then collapses | 6 s |
| Reversal: Red | Charges in your hand, then fires an orb that explodes with massive knockback and area damage | 8 s |
| Hollow Purple | Blue and Red form at your sides and merge, then imaginary mass flies 90 blocks erasing enemies (damage is at least 80, or 45% of max health) | 25 s |
| Domain Expansion: Unlimited Void | 14-block domain for 12 s: void fog, starfield dome and galaxy floor. Enemies are paralysed, can't attack, take damage over time and have their projectiles dissolved. You get Strength III inside | 45 s |
| Six Eyes (toggle) | Night vision, +25% technique damage, target HP/distance on the HUD, blue eye markers above enemies (even invisible players). Lifts the blindfold to reveal glowing eyes | 1 s |
| Teleport | Blink up to 32 blocks to where you look. Look at or tap an enemy to appear behind it. Slow falling if you land in mid-air | 1.5 s |
| Reverse Cursed Technique | Heals 10 hearts over 2 s and cleanses poison, wither, slowness and other harmful effects | 15 s |
| Black Flash | Dash and strike with distorted cursed energy (black lightning, red sparks). Chaining within 8 s enters the Zone: +25% damage per stack | 4 s |

## Safety & performance
- Techniques can never damage, pull or knock back their caster. Terrain destruction keeps a 4.5-block safe zone around you and never erases bedrock, containers, portals or command blocks.
- **Settings** (menu): particle quality Low/Medium/High (Low for older phones), terrain destruction (**off** by default), PvP, sparing pets and villagers, cinematic titles, camera shake and HUD.
- No custom entities. All visuals are client-side particles, and heavy effects re-emit on a budget. The addon does not override any vanilla file (no `player.json` replacement).

## Building from source
```
python3 tools/build_data.py && python3 tools/art.py && python3 tools/particles.py \
  && python3 tools/sounds.py && python3 tools/models.py
python3 tools/validate.py <path-to-Mojang-bedrock-samples@v1.21.0.26-preview>
node tests/smoke.mjs
python3 tools/package.py   # -> dist/Gojo_Limitless.mcaddon
```
`validate.py` checks strict JSON, manifests and dependencies, the item components against Mojang's 1.20.80 schema, and every texture, lang key, particle, sound, animation, fog and recipe reference. It also checks that every sound file exists in vanilla 1.21.0.26. `tests/smoke.mjs` runs the real scripts against a functional mock of the Script API and plays every technique (76 checks). The scripts also type-check against the official `@minecraft/server@1.10.0` typings.
