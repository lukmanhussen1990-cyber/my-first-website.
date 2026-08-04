# ASHGRAVE MANOR — Master Prompt for a Minecraft Bedrock (Mobile) Haunted House Add-On

Built for the exact device/version in your screenshot:
**Bedrock beta 1.21.0.26 · RenderDragon · OpenGL ES 3 · Android 14 · Mali-G57 MC2 · 2408x1080 · GUI Scale 5**

How to use this file:
1. Edit **Section 0 (YOUR VERSION)** so the story is *yours*.
2. Copy **everything from `=== BEGIN PROMPT ===` to `=== END PROMPT ===`** into Claude (or any strong LLM).
3. Because the add-on is big, use the **Build Order** at the bottom — ask for one milestone per message. That gives you complete, non-truncated files instead of a giant half-finished dump.
4. Use the **Follow-Up Prompts** for fixing, expanding, and polishing.

---

## Section 0 — YOUR VERSION (fill these in before pasting)

```
MANOR NAME:        Ashgrave Manor
NAMESPACE (2-3 letters, lowercase, no spaces): ag
TONE:              Slow-burn gothic dread → violent haunting in the last act
SCARE INTENSITY:   Hard (with an in-game Mild / Normal / Hard selector)
PLAY LENGTH:       60–90 minutes, single player, co-op safe up to 4
STORY HOOK:        You inherited the house from a grandmother you never met.
                   The will has one condition: stay until sunrise.
THE ENTITY:        The Hollow Bride — she was buried in the walls on her wedding day.
THE TWIST:         The five "keys" are her five children's names. The last name is yours.
ENDING:            Escape at dawn, OR stay and take her place (two endings)
```

---

=== BEGIN PROMPT ===

## ROLE

You are a **senior Minecraft Bedrock Edition add-on engineer and horror level designer**. You ship production-quality, error-free `.mcaddon` packs that run at a stable framerate on low-to-mid Android phones. You write complete files only — never snippets, never placeholders.

## HARD TARGET (do not deviate)

| Setting | Value |
|---|---|
| Edition | **Bedrock Edition (MCPE / Pocket Edition)** — NOT Java |
| Game version | **1.21.0.26 beta** |
| Device | Android 14 phone, Mali-G57 MC2 GPU, OpenGL ES 3, RenderDragon |
| Input | **Touchscreen only** — no keyboard, no mouse, no F3 |
| Deliverable | One Behavior Pack (BP) + one Resource Pack (RP), packaged as a single `.mcaddon` |
| `min_engine_version` | `[1, 21, 0]` |

## NON-NEGOTIABLE TECHNICAL CONTRACT

**Manifests**
- `format_version: 2` in both manifests.
- Generate **6 genuinely unique UUID v4s** (2 per pack: header + module). Never reuse a UUID. Never use example UUIDs like `00000000-...`.
- BP manifest `dependencies` must include the RP header UUID **and** the script modules:
  ```json
  "dependencies": [
    { "uuid": "<RP-HEADER-UUID>", "version": [1, 0, 0] },
    { "module_name": "@minecraft/server", "version": "1.11.0" },
    { "module_name": "@minecraft/server-ui", "version": "1.2.0" }
  ]
  ```
  If the in-game content log reports a module version mismatch, tell me the exact fallback line to change.
- BP script module: `{ "type": "script", "language": "javascript", "entry": "scripts/main.js", "uuid": "...", "version": [1,0,0] }`

**Format versions — use exactly these**
| File type | `format_version` |
|---|---|
| BP entity | `"1.21.0"` |
| RP client entity | `"1.10.0"` |
| Geometry (`models/entity/*.json`) | `"1.16.0"` |
| Animation | `"1.8.0"` |
| Animation controller | `"1.10.0"` |
| Render controller | `"1.10.0"` |
| Particle | `"1.10.0"` |
| Custom block | `"1.21.0"` |
| Custom item | `"1.21.0"` |
| `sound_definitions.json` | `"1.14.0"` |
| Fog definition | `"1.16.100"` |
| Dialogue | `"1.17"` |
| Loot / trade tables | pools schema, no `format_version` |

**Identifiers**
- Every custom thing uses the namespace from Section 0 (e.g. `ag:hollow_bride`). **Never** use the `minecraft:` namespace for new content.
- Lowercase, `snake_case`, no spaces, no dashes.
- Every block/item/entity needs a `menu_category` (blocks/items) and a matching line in `RP/texts/en_US.lang`.

**Logic layer**
- **Prefer the Script API (`@minecraft/server`) over command blocks and `/function` chains.** Commands are a fallback only.
- If you do use commands, only Bedrock-verified syntax. **Banned Java-isms:** `/execute if data`, NBT-tag selectors (`{Tags:[...]}`), `/data`, datapacks, `tick.json`, `advancements`, `predicates`, Forge/Fabric anything.
- Player progress must persist across quit/rejoin via **dynamic properties** (`world.setDynamicProperty` / `player.setDynamicProperty`), not scoreboards where avoidable.
- Wrap the whole script in try/catch at the event-handler level so one bad room never bricks the world.
- Do not put heavy work in a per-tick loop. Use `system.runInterval(fn, N)` with N ≥ 10 for scans, and stagger checks across players (one player per tick, round-robin).

## MOBILE PERFORMANCE BUDGET (treat as a spec, not a suggestion)

This phone is running ~59 FPS on a plain main menu. Your pack must not eat that.

- **Textures:** blocks/items 16×16. Entities max 64×64. **No texture above 128×128 anywhere.** Total RP under 20 MB.
- **No volumetric fog, no PBR / texture_set / MER maps, no ray tracing** — the Mali-G57 will not handle it. Fog = distance fog only.
- **Live custom entities:** ≤ 8 within a loaded area at once, ≤ 3 with pathfinding/AI active. Despawn or freeze the rest.
- **Particles:** ≤ 3 emitters visible at once, ≤ 30 particles each, lifetime ≤ 3s. No looping full-room particle fields.
- **Light:** use `minecraft:light_emission` on blocks. Do **not** spam dynamic light-source entities.
- **Structure loading:** load the manor in chunks via `/structure load` on a staggered timer, never one giant `/fill`.
- **Ticking areas:** exactly one `tickingarea` covering the manor. Remove it in the escape sequence.
- **Sounds:** mono `.ogg`, ≤ 64 kbps, ≤ 10s each except ambience loops. Total audio under 8 MB.
- **UI:** use `@minecraft/server-ui` forms (`ActionFormData`, `ModalFormData`, `MessageFormData`) — they scale correctly at GUI Scale 5 on a 2408×1080 screen. Do not build custom JSON-UI screens; they break on tall phone aspect ratios.
- **Every hint, warning and objective goes to `actionbar` or `title`**, in ≤ 45 characters per line, readable at arm's length on a phone.

## TOUCH-FIRST DESIGN RULES

- Every interaction is **tap the block** or **tap the item**. No sneak-combos, no double-tap-jump, no scroll wheel, no hotkeys.
- Interactive blocks get a ≥ 0.5 block hitbox and a subtle glow/emissive so a thumb can find them.
- No puzzle that needs precise mouse aim, fast flicks, or reading tiny text.
- No timed sequence tighter than 8 seconds.
- Auto-checkpoint on entering every room. Death = respawn at last checkpoint with inventory intact (`keepInventory` behaviour handled by script, restoring the exact item set).
- On first join, show a form: **Scare Intensity (Mild / Normal / Hard)** and **Jumpscare Flashes (On / Off)**. Store on the player. Honour it everywhere.

## THE ADVENTURE — build this

**Premise:** Section 0's story hook. The player enters at dusk. The door locks. Sunrise is the win condition.

### Progression: 5 Bone Keys, 5 rooms, one final act.

**Act 0 — The Approach**
Foggy moor, rain ambience, iron gate, mailbox with a written book (the will). Crossing the threshold triggers: door slam SFX, `title` card with the manor name, custom fog applied, and a one-way barrier so the player can't leave.

**Act 1 — The Foyer**
Grandfather clock chimes the hour on a timer and is the in-world clock (each chime = story progress). Player receives the **Tallow Candle** and the **Sanity** system starts. A tutorial ghost teaches: light = safe, dark = watched.

**Act 2 — The Nursery** → *Bone Key I*
**The Nanny** hunts by sound. Sprinting, breaking blocks, and closing doors generate a noise value; she paths to the loudest recent noise. Walking is safe. Player must hide in a **Wardrobe** block (tap to enter: invisibility + movement lock + muffled audio + heartbeat SFX). Puzzle: arrange the toy blocks to match a music-box melody.

**Act 3 — The Cellar of Names** → *Bone Key II*
Flooded, pitch dark, candle burns faster in the damp. Name plaques on the walls; the player uses the **Séance Bell** on the correct plaque (ModalFormData riddle). Drowned wraiths rise if a wrong name is rung.

**Act 4 — The Mirror Wing** → *Bone Key III*
Symmetrical rooms. **The Reflection** mirrors the player's movement inverted. One mirror is real. Break the wrong one → the Reflection steps out and chases for 20 seconds.

**Act 5 — The Portrait Gallery** → *Bone Key IV*
**The Watcher** only moves when it is not inside the player's view cone (dot-product check between player view vector and direction-to-entity; if `dot > 0.35` and line-of-sight is clear, freeze it). Portraits swap to different, wrong-er versions of themselves when unobserved. Puzzle: photograph the five portraits with the **Bone Camera** in the order they died.

**Act 6 — The Attic Heart** → *Bone Key V + Boss*
**The Hollow Bride**, 3 phases:
- *Phase 1 — Veil:* invulnerable, chases slowly. Player must light 4 wall candles to strip the veil.
- *Phase 2 — Chorus:* she summons Children adds (max 3 alive, hard cap). Salt Lines block them.
- *Phase 3 — Hollowing:* room lights die, she teleports on a 5-second cadence toward the player's back. Damage window = only while a candle burns near her.
No instant deaths. Every phase telegraphs 2 seconds ahead with a sound cue **and** a visual cue (some players play muted).

**Act 7 — Dawn**
House starts collapsing (staggered `/structure load` of a ruined variant + falling-block SFX). 90-second escape run down a route the player already knows. Two endings:
- **Escape:** front door, sunrise, credits, and the twist reveal from Section 0.
- **Stay:** the optional locked bedroom — the player takes her place. Different credits.

### The ten mechanics (implement all)

1. **Sanity 0–100.** Drains in darkness and near entities, restores near lit candles and inside Salt Circles. Effects by tier: 75+ nothing → 50 whispers + light vignette fog → 25 hallucination entities (harmless, despawn on look-away) + camera sway → 10 heavy fog, distorted audio, false jumpscares → 0 the Bride finds you instantly.
2. **Tallow Candle** — durability drains on a timer while held/lit, faster in wind and water. Refuel with **Tallow**. Going dark is a fail-state pressure, never an instant death.
3. **Salt Line** — placeable custom block; hostile custom entities cannot path across it. Limited stock (12 total in the run).
4. **Cracked Monocle** — hold to reveal invisible clue entities and ghost-writing (implemented as entities with an alternate render controller / glowing texture toggled by script).
5. **Bone Camera** — tap to "photograph"; shows a form containing what was *actually* in the room. The hint system, in-fiction.
6. **Séance Bell** — ModalFormData: ask the house a question, get a riddle answer. Limited charges.
7. **Noise system** — a rolling noise value per player driving The Nanny's targeting.
8. **Observation system** — the view-cone check driving The Watcher and the portrait swaps.
9. **Hiding** — Wardrobe / Under-Bed blocks: tap to hide, tap to exit, entities lose target while hidden but linger nearby.
10. **Checkpoints & journal** — a **Manor Journal** item opens an ActionFormData listing objectives found, keys held, and story pages collected (12 pages hidden across the house).

### Fair-scare rules (this is what separates a good horror map from a bad one)

- Silence is a tool. At least 60 seconds of quiet before every major scare.
- Every jumpscare has a 1–2 second tell (a sound, a light flicker, a shadow).
- Never scare the player during a puzzle they can't pause.
- Never take control away for more than 3 seconds.
- Nothing lethal spawns behind the player within 3 blocks.
- Respect the intensity setting the player picked. Mild = fewer scares and no screen flashes, not a different, worse map.

## ASSETS

You cannot output binary files. So:
- **Textures:** for each one, either (a) name a vanilla texture path to reuse/recolor, or (b) give a 16×16 pixel-art spec — exact palette hex codes and a row-by-row description — **plus** a single `tools/make_textures.py` (Pillow) that writes every PNG at the correct path. One script, all textures.
- **Sounds:** don't invent files. Map every cue to an existing vanilla sound event in `sound_definitions.json` where possible (e.g. `ambient.cave`, `mob.wither.spawn`, `block.beacon.deactivate` pitched down). Only list a custom `.ogg` when nothing vanilla fits, and give me a one-line description of what to record/source.
- **Build:** ship the manor as `BP/structures/<ns>/*.mcstructure` loaded at runtime. Since you can't emit binary, instead provide `tools/build_manor.mcfunction` files that construct each room with `/fill` and `/setblock`, split so no single function exceeds 300 commands, plus the script that runs them in staggered order on first world load.

## OUTPUT FORMAT (strict)

1. Start with a **file tree** of the entire add-on.
2. Then output files **one at a time**, each as:
   ```
   ### FILE: BP/manifest.json
   ```
   followed by one fenced code block containing the **complete** file.
3. **No ellipses. No `// ...rest of the code`. No "similar to above". No TODO.** If a file is long, output it long.
4. All JSON must be valid: no comments, no trailing commas, double quotes only.
5. After the files: **Install steps for Android 14** (Android/data is restricted on 14 — package as `.mcaddon`, open with the file manager, let Minecraft import it; explain the `.mcworld` route too).
6. Then a **Test Checklist** — 20 numbered checks, each with the exact expected result.
7. Then **Known Limits** — anything you had to approximate, and what to change if the content log errors.

## SELF-CHECK BEFORE YOU ANSWER

- [ ] Every UUID is unique and real
- [ ] Every `format_version` matches the table above
- [ ] Every identifier uses the custom namespace and has a `.lang` entry
- [ ] Every custom block/item has a `menu_category`
- [ ] No Java Edition syntax anywhere
- [ ] No texture over 128×128, no volumetric fog, no PBR
- [ ] No more than 3 AI entities active at once
- [ ] Every interaction works with a single thumb tap
- [ ] The player cannot softlock: every door reopens, every key is re-obtainable, every room has an escape
- [ ] No file was truncated

If any requirement conflicts with another, tell me which and why, pick the option that keeps the framerate stable on the target phone, and proceed. Do not stop to ask permission.

=== END PROMPT ===

---

## Build Order (send one per message — this is how you get complete files)

| # | Ask for |
|---|---|
| 1 | Both manifests, the full file tree, `pack_icon` spec, `en_US.lang`, and `scripts/main.js` skeleton with the module/event wiring and the intensity-selector form |
| 2 | The Sanity + Candle + Noise + Observation systems (`scripts/systems/*.js`) |
| 3 | All custom items (Candle, Tallow, Salt, Monocle, Camera, Bell, Journal, 5 Bone Keys) + `item_texture.json` |
| 4 | All custom blocks (Wardrobe, Under-Bed, Salt Line, Portraits, Mirrors, Plaques, Wall Candles) + `blocks.json` + `terrain_texture.json` |
| 5 | The Hollow Bride: BP entity, RP client entity, geometry, animations, render controller, boss script |
| 6 | The Nanny, The Watcher, The Reflection, Children adds, hallucination entities |
| 7 | Fog, particles, `sound_definitions.json`, ambience scheduler |
| 8 | Room-by-room build functions + the staggered loader + checkpoints |
| 9 | Acts 0–7 story scripting, dialogue, journal pages, both endings |
| 10 | `tools/make_textures.py`, install steps, test checklist |

## Follow-Up Prompts

**Fix pass**
> Here is my Minecraft content log error: `<paste>`. Diagnose the exact file and line, explain the root cause in one sentence, and output the corrected complete file. Bedrock 1.21.0.26, Android. Do not change anything unrelated.

**Performance pass**
> Audit the add-on for mobile performance on a Mali-G57 / Android 14 phone. Find every per-tick loop, oversized texture, uncapped entity spawn, and looping particle. Give me a table of issue → fix → estimated FPS impact, then output the corrected files.

**Scare-quality pass**
> Review Acts 2–6 purely as horror pacing. Where is the tension flat? Where is a scare unearned or unfair? Rewrite the weakest three sequences with a proper build → tell → payoff → release structure. Keep every technical constraint.

**Expansion pass**
> Add a sixth room — `<your idea>` — with one new mechanic that reuses existing systems (no new entity AI). Output only the new and modified files.

**Polish pass**
> Add: a title-screen-quality intro cinematic using camera commands, a credits sequence, an achievement/journal completion tracker, and a secret third ending gated behind all 12 story pages.

## Quick version (if you only have one message)

> Build a complete Minecraft **Bedrock 1.21.0.26** haunted house add-on (BP + RP, `.mcaddon`) for an **Android 14 phone, Mali-G57 GPU, touch-only** — "Ashgrave Manor", a 60–90 minute horror adventure. Include: a Sanity system, a burning Tallow Candle, Salt Lines, hiding spots, 5 Bone Keys across 5 puzzle rooms, a 3-phase boss (The Hollow Bride), two endings. Use the Script API (`@minecraft/server` 1.11.0, `@minecraft/server-ui` 1.2.0) — no Java Edition syntax. Mobile budget: 16×16 block textures, ≤64×64 entity textures, ≤3 AI entities active, ≤3 particle emitters, no volumetric fog, no PBR, all interaction by single tap. Manifests `format_version: 2`, `min_engine_version [1,21,0]`, real unique UUIDs. Output the full file tree first, then every file complete — no ellipses, no placeholders — then Android install steps and a 20-point test checklist. Start with milestone 1 (manifests, file tree, `main.js` skeleton) and ask me to say "next" for each following milestone.
