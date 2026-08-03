# Devil vs Angel — Minecraft Bedrock Add-On

A Minecraft **Bedrock** add-on with two spawn eggs.

- **Devil Spawn Egg** — spawns a huge, burning, horned monster. It sets you on fire,
  sets the ground on fire, and torches nearly every mob and block around it.
- **Angel Spawn Egg** — spawns a winged, glowing guardian. It hunts down every devil
  in the area, puts the fires out, shields you, and it **wins**.

Built for **Minecraft Bedrock 1.21** (`min_engine_version` `1.21.0`) — the version in
the screenshot, beta `1.21.0.26` on Android. Works on phone, tablet, Windows and
console, since it is a pure behaviour + resource pack with no experimental toggles
required.

---

## Install on Android (phone / tablet)

1. Download **`dist/DevilVsAngel.mcaddon`** onto your phone.
2. Tap the file. Minecraft opens and imports both packs.
3. Make a world (or edit an existing one) → **Behaviour Packs** → activate
   *Devil vs Angel [Behavior]*. The resource pack turns itself on with it.
4. Turn **Cheats ON** for that world. The devil's fire and the angel's holy damage
   are driven by a tick function, and functions need cheats enabled.
5. Play. Open the Creative inventory, search **"Devil"** or **"Angel"**, and you
   will find the two spawn eggs in the spawn-egg tab.

If tapping the file does nothing, use a file manager (like Files by Google), long-press
`DevilVsAngel.mcaddon`, and choose **Open with → Minecraft**.

### Prefer the two packs separately

Import `dist/DevilVsAngel_BP.mcpack` and `dist/DevilVsAngel_RP.mcpack` instead —
both are required, the add-on will not work with only one.

---

## What each mob does

### Devil — `devil_angel:devil`

| | |
|---|---|
| Health | 150 |
| Melee damage | 12 |
| Ranged | Fireballs, 3-shot bursts, up to 24 blocks |
| Size | 1.15× a player, 2.6 blocks tall |

- **Burns you.** Lights fire in the block you are standing in and deals fire damage
  within 6 blocks.
- **Burns everything almost.** Lays fire in a 5×2×5 area around itself as it walks,
  and scorches every other mob within 6 blocks. The fire only fills *air*, so it
  never deletes your build — it just sets it alight and lets it spread naturally.
- **Looks scary and bad.** Charred red hide with glowing ember cracks, a glowing
  ribcage and burning heart, yellow eyes under a heavy brow, a jagged grin, curved
  horns, a burning barbed tail and torn bat wings. The eyes and embers are emissive,
  so they glow in the dark.
- Immune to fire and lava, walks straight through lava, breaks doors, drops fire
  charges, blaze powder, magma cream and the occasional netherite scrap.
- Attacks players, villagers, the angel and other mobs — but never other devils.

### Angel — `devil_angel:angel`

| | |
|---|---|
| Health | 400 |
| Melee damage | 30 |
| Holy smite | 10 damage to every devil within 14 blocks, ~2.5× a second |
| Movement | Flies (hovers) |

- **Fights the devil and wins.** It only ever targets devils — never you, never your
  animals. It flies straight at one from up to 64 blocks away. Even before it lands a
  hit, its holy aura is already burning the devil down, so the fight ends the same way
  every time.
- Immune to fire, lava, projectiles and falling, so the devil simply cannot kill it.
- **Undoes the damage:** extinguishes the devil's fire in a 9×5×9 area around itself,
  and gives every player within 14 blocks Fire Resistance, Regeneration and Absorption.
- White and gold robed figure with a spinning glowing halo, glowing cyan eyes, a glowing
  chest sigil and big feathered wings with gilded tips.
- Drops feathers, gold ingots, glowstone dust and sometimes a golden apple.

**Want to watch the fight?** Spawn a devil, back off a few blocks, then spawn an angel.

---

## Commands

Cheats must be on.

```
/summon devil_angel:devil
/summon devil_angel:angel
/give @s devil_angel:devil_spawn_egg
/give @s devil_angel:angel_spawn_egg
/kill @e[type=devil_angel:devil]
```

---

## Repo layout

```
addon/
  BP/                              behaviour pack
    manifest.json
    entities/devil.json            stats, AI, fireballs, targeting
    entities/angel.json            stats, flight, devil-only targeting
    functions/tick.json            registers the per-tick function
    functions/devil_angel/
      tick.mcfunction              throttles the heavy work to ~2.5x/sec
      pulse.mcfunction             the fire, the smiting, the blessings
    loot_tables/entities/*.json
  RP/                              resource pack
    entity/*.entity.json           model + texture + spawn egg colours
    models/entity/*.geo.json       the two custom models
    animations/*.animation.json    idle, walk, fly, head tracking
    render_controllers/
    textures/entity/*.png          64x64 textures
    sounds.json                    ghast moans for the devil, chimes for the angel
tools/
  make_textures.py                 regenerates the textures and pack icons
  build.py                         packs everything into dist/
dist/                              the installable files
```

## Rebuilding

```bash
python3 tools/make_textures.py    # regenerate textures (only if you edit them)
python3 tools/build.py            # rebuild dist/
```

Both scripts are pure Python standard library — nothing to install.

## Performance note

Everything heavy runs on a throttled pulse (~2.5 times a second, not 20), and the
fill volumes were kept small deliberately so this stays smooth on a phone. Spawning
a dozen devils at once will still cost you frames — that is the fire spreading, not
the add-on.
