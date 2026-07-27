# SCP-096 — Minecraft Bedrock Addon (Mobile)

A Minecraft **Bedrock Edition** addon (works on Android / iOS / Windows 10-11) that adds
**SCP-096, "The Shy Guy"** as a custom mob with its own **spawn egg in the creative
inventory**. Ships as a behavior pack (BP) + resource pack (RP) bundled into one
`.mcaddon` file — tap it on your phone and Minecraft installs both packs.

## ⬇ Direct download

**[Tap here to install: SCP-096.mcaddon](https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/scp-096-minecraft-mod-hni3eb/downloads/SCP-096.mcaddon)**

Separate packs, if you prefer:

| File | Link |
| --- | --- |
| Behavior pack only | [SCP-096_BP.mcpack](https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/scp-096-minecraft-mod-hni3eb/downloads/SCP-096_BP.mcpack) |
| Resource pack only | [SCP-096_RP.mcpack](https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/scp-096-minecraft-mod-hni3eb/downloads/SCP-096_RP.mcpack) |

On a phone the link downloads the file; tap the downloaded file and Minecraft opens
and imports it. There is also a tap-friendly download page in [`index.html`](index.html).

## Install

1. Tap the download link above (on the phone that has Minecraft installed).
2. Open the downloaded file — Minecraft launches and imports both packs.
3. Create/edit a world → **Behavior Packs** → activate **SCP-096 Behavior Pack**
   (the resource pack is pulled in automatically as a dependency).
4. In game, open the creative inventory, search **SCP-096**, and grab the
   **Spawn SCP-096** egg. Or run `/give @s scp:scp_096_spawn_egg`.

Requires Minecraft Bedrock **1.16+**. No experimental toggles. Java Edition is not supported.

## What SCP-096 does

| | |
| --- | --- |
| Identifier | `scp:scp_096` |
| Spawn egg item | `scp:scp_096_spawn_egg` |
| Health | 250 |
| Damage when enraged | 14 |
| Speed when enraged | 0.42 (much faster than a walking player) |
| Docile | Hunched over, wanders slowly, deals no damage |
| Trigger | A player gets within 12 blocks in its line of sight, or hits it |
| Enraged | Sprints, tracks any player up to 128 blocks away, ignores line of sight, breaks doors, climbs walls, immune to knockback |
| Calms down | ~50-70 seconds after it loses its target |
| Immunities | Fall damage, fire (lava still hurts it) |

Natural spawning is deliberately **off** — SCP-096 only appears from the spawn egg or
`/summon scp:scp_096`, so it can't ambush you while you're mining.

### One honest caveat about the trigger

In the original SCP lore, SCP-096 rages when someone sees **its face**. Bedrock's data-driven
entity system has no "player is looking at this entity" check, so the trigger here is
*proximity + the mob having line of sight to you* (`minecraft:target_nearby_sensor` with
`must_see: true`). In practice it feels the same — get close enough to see it and it goes off —
but it will also trigger if you sneak into its view from behind, which strict lore wouldn't.

## Repository layout

```
addon/
  SCP096_BP/                     behavior pack
    manifest.json
    entities/scp_096.json        AI, states, stats, spawn egg enable
    texts/en_US.lang
  SCP096_RP/                     resource pack
    manifest.json
    entity/scp_096.entity.json   model/texture/animation bindings + spawn egg icon
    models/entity/scp_096.geo.json
    animations/scp_096.animation.json
    render_controllers/
    textures/entity/scp_096.png
    textures/items/scp_096_spawn_egg.png
    sounds.json
    texts/en_US.lang
downloads/                       built .mcaddon / .mcpack files
tools/
  make_textures.py               regenerates the PNGs (no dependencies)
  build.py                       validates JSON and rebuilds downloads/
index.html                       mobile download page
```

## Rebuilding after an edit

```bash
python3 tools/make_textures.py   # only if you changed the texture generator
python3 tools/build.py           # validates every JSON, then rezips downloads/
```

`build.py` fails loudly if any pack JSON is malformed or a manifest is missing, so a
broken pack never gets shipped.

## Credits / licence

SCP-096 is a creation of the [SCP Foundation](https://scp-wiki.wikidot.com/scp-096) community,
licensed **CC BY-SA 3.0**; this fan addon is released under the same licence. Not affiliated
with or endorsed by Mojang, Microsoft, or the SCP Foundation.
