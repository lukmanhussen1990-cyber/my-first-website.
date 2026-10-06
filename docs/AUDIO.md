# Audio and particles

All custom sounds in this add-on are synthesized from scratch by `tools/audio/synth.py`. No samples are used and no Mojang audio is copied. The infected creatures' species flavour comes from **referencing** vanilla sound files by path in `sound_definitions` (for example `sounds/mob/cow/say1`). The game loads those files from the vanilla resource pack, so nothing is redistributed.

The formats were verified against Mojang `bedrock-samples` `v1.21.0.26-preview`, covering `resource_pack/sounds/sound_definitions.json`, `resource_pack/sounds.json` and `resource_pack/particles/*.json`.

## Files

| path | what |
|---|---|
| `tools/audio/catalog.py` | Single source of truth: ids, files, categories, volumes, distances, duration bounds, species pools, entity wiring |
| `tools/audio/synth.py` | Renders every `.ogg` and writes both fragments (deterministic) |
| `tools/audio/check_audio.py` | Decodes and verifies every `.ogg`, validates both fragments, and can draw a spectrogram contact sheet |
| `addon/resource_pack/sounds/pas/<group>/<name><n>.ogg` | 50 files, about 750 KB in total |
| `addon/fragments/sound_definitions/pas.json` | The `sound_definitions` map (36 ids), merged by `tools/build.py` |
| `addon/fragments/sounds/pas.json` | Partial `sounds.json` with `entity_sounds.entities` for the 7 horde entities, deep-merged by `tools/build.py` |
| `tools/particles/gen_particles.py` | Writes and checks the 4 particle effects |
| `addon/resource_pack/particles/pas_*.json` | Particle effects, `format_version` `1.10.0` |

### Regenerate and verify

```sh
python3 tools/audio/synth.py                  # all .ogg files plus both fragments (about 10 s)
python3 tools/audio/synth.py --defs-only      # fragments only
python3 tools/audio/synth.py --only parasite/hurt --wav-dir /tmp/wav   # audition one set
python3 tools/audio/check_audio.py -v --sheet /tmp/spectrograms.png
python3 tools/particles/gen_particles.py      # write + check (use --check to verify only)
```

The vanilla cross-checks read `$PAS_VANILLA_REF`, or the `$REF` path from `docs/SPEC.md`. If neither exists, those checks are skipped with a warning.

## Audio format

* Mono, 44.1 kHz, OGG Vorbis (`ffmpeg -c:a libvorbis -q:a 4`).
* Muxing is bit-exact and metadata is stripped, so re-running `synth.py` produces byte-identical files. Every file has its own seed: the `crc32` of its resource path.
* Each sound is post-processed in four steps:
  1. DC removed and a 28 Hz high-pass applied.
  2. Leading and trailing silence trimmed, keeping a 4 ms pre-roll so attacks survive.
  3. Raised-cosine fade-in and fade-out added, plus a silent 4 ms tail.
  4. Peak-normalised to **-1 dBFS measured on the decoded Vorbis**. The encoder is re-run with a gain correction because Vorbis overshoots on dense, saturated material and smears very short transients.
* `check_audio.py` enforces these rules for every file:
  * codec `vorbis`, 1 channel, 44100 Hz;
  * duration within the per-sound bounds below;
  * decoded peak between -2.5 and 0 dBFS;
  * RMS above -40 dBFS;
  * `|DC|` at most 0.005;
  * no NaN or Inf;
  * first and last sample at most 0.02.

## Sound ids (`ids.js` `SOUNDS`)

Category follows `SPEC.md` §3: `hostile` for creatures and the infection/outbreak events, `player` for the torch and UI, and `neutral` for the base. These are all categories that vanilla uses. Every definition sets `max_distance`, and the first file of each definition has `load_on_low_memory: true` so low-memory Android devices still play something.

| id | cat. | files | vol | max dist | duration | design |
|---|---|---|---|---|---|---|
| `pas.parasite.ambient` | hostile | `parasite/ambient1..4` | 0.8 | 16 | 0.6-1.6 s | chitter bursts, wet mandible clicks, bubbling, throaty hiss |
| `pas.parasite.hurt` | hostile | `parasite/hurt1..4` | 0.9 | 16 | 0.25-0.8 s | raspy inharmonic FM screech with noise band |
| `pas.parasite.death` | hostile | `parasite/death1..3` | 1.0 | 16 | 0.8-1.8 s | falling screech, then resonant gurgle, then chitin crunch and wet thud |
| `pas.parasite.attack` | hostile | `parasite/attack1..4` | 0.9 | 16 | 0.12-0.5 s | hiss lunge, double mandible snap, short squelch |
| `pas.parasite.step` | hostile | `parasite/step1..4` | 0.5 | 12 | 0.04-0.25 s | 3-4 tiny chitin ticks (skitter) |
| `pas.parasite.birth` | hostile | `parasite/birth1..3` | 0.9 | 16 | 0.6-1.5 s | membrane tearing crackle, big squelch, drips, newborn chitter |
| `pas.infected.ambient` | hostile | `infected/ambient1..4` | 0.85 | 16 | 0.8-1.6 s | guttural formant moan with period-doubling growl and wet gurgle |
| `pas.infected.hurt` | hostile | `infected/hurt1..3` | 0.9 | 16 | 0.3-0.8 s | harsh pitched-up grunt with wet splat |
| `pas.infected.death` | hostile | `infected/death1..3` | 1.0 | 16 | 0.9-1.8 s | falling groan into death rattle, gurgle and collapse thud |
| `pas.infection.start` | hostile | `infection/start1..3` | 0.9 | 16 | 0.5-1.3 s | needle sting with metallic ring, injection squish, heartbeat thump |
| `pas.infection.convert` | hostile | `infection/convert1..3` | 1.0 | 24 | 0.8-1.7 s | tearing burst, low boom, gore splats, screech overtone |
| `pas.infection.heartbeat` | hostile | `infection/heartbeat1..2` | 0.8 | 12 | 0.4-0.9 s | low saturated lub-dub double thump |
| `pas.outbreak.start` | hostile | `outbreak/start1..2` | 1.0 | 64 | 2.6-4.0 s | ominous detuned brass-like drone swell with sinking pitch |
| `pas.torch.on` | player | `torch/on1..2` | 0.6 | 8 | 0.04-0.2 s | crisp two-stage switch click (higher, centroid about 6.1 kHz) |
| `pas.torch.off` | player | `torch/off1..2` | 0.6 | 8 | 0.04-0.2 s | crisp two-stage switch click (lower, centroid about 4.8 kHz) |
| `pas.base.build` | neutral | `base/build1..2` | 0.8 | 32 | 1.2-2.5 s | rising whoosh, pentatonic shimmer, wooden construction knocks |
| `pas.base.done` | neutral | `base/done1` | 0.8 | 32 | 0.9-2.3 s | C-major arpeggio bell chime with warm pad |
| `pas.ui.open` | player | `ui/open1` | 0.5 | 8 | 0.08-0.35 s | soft two-tone sine beep (660 Hz to 990 Hz) |

The script-played sounds only need these `sound_definitions` entries:
* `pas.parasite.birth`
* `pas.infection.*`
* `pas.outbreak.start`
* `pas.torch.*`
* `pas.base.*`
* `pas.ui.open`

Play them with `dimension.playSound(id, location, { volume, pitch })` or `player.playSound(id, …)`.

### Species-flavoured ids (infected creatures)

`pas.infected_<species>.<ambient|hurt|death>` exists for `villager`, `cow`, `pig`, `sheep`, `chicken` and `human` (18 ids, all `hostile`, `max_distance` 16).

Each one is a weighted pool of two kinds of entry:
* the vanilla species voice, referenced by its vanilla path and played at a lowered "sick" pitch;
* our `infected/*` moans at a pitch that suits the species' size.

The weights give the vanilla voice about 55 % of plays.

A sound definition plays **one** entry per trigger, so the creature alternates between a sick version of its own voice and the parasite moan. It does not play both at once. To get true simultaneous layering, a client entity can play `pas.infected.ambient` as an extra `sound_effects` entry from an animation.

| species | vanilla files (pitch) | our files (pitch) |
|---|---|---|
| villager | ambient `mob/villager/idle1-3` (0.68), hurt `hit1-4` (0.7), death `death` (0.62) | 1.08 |
| cow | ambient `mob/cow/say1-4` (0.62), hurt `hurt1-3` (0.66), death `hurt1-3` (0.55) | 0.88 |
| pig | ambient `mob/pig/say1-3` (0.62), hurt `say1-3` (0.72), death `death` (0.6) | 1.15 |
| sheep | `mob/sheep/say1-3` (ambient 0.6, hurt 0.7, death 0.55) | 1.2 |
| chicken | ambient `mob/chicken/say1-3` (0.7), hurt `hurt1-2` (0.72), death `hurt1-2` (0.6) | 1.6 |
| human | ambient `mob/zombie/say1-3` (0.82), hurt `hurt1-2` (0.85), death `death` (0.8) | 1.0 |

Hurt and death use the same vanilla files that vanilla itself maps to those events. For example, vanilla cow death plays `mob.cow.hurt`, and sheep use `say` for every event.

## Entity wiring (`fragments/sounds/pas.json`)

The event names were checked against vanilla `sounds.json`:
* `ambient`, `hurt`, `death` and `step` are used by most mobs.
* `attack` is the melee bite event used by fox, hoglin, zoglin, piglin, bee and panda. All of those attack with `minecraft:behavior.melee_box_attack`, so give horde entities a melee attack goal for `attack` to fire.
* `attack.strong` is only used by the player and the ravager, and is not used here.

| entity | ambient / hurt / death | attack | step |
|---|---|---|---|
| `pas:parasite` (pitch 0.9-1.12) | `pas.parasite.*` | `pas.parasite.attack` | `pas.parasite.step` vol 0.5 |
| `pas:infected_villager` | `pas.infected_villager.*` | `pas.parasite.attack` vol 0.7, pitch 0.6-0.75 | `mob.zombie.step` 0.4 |
| `pas:infected_cow` | `pas.infected_cow.*` | same | `mob.cow.step` 0.55 |
| `pas:infected_pig` | `pas.infected_pig.*` | same | `mob.pig.step` 0.25 |
| `pas:infected_sheep` | `pas.infected_sheep.*` | same | `mob.sheep.step` 0.4 |
| `pas:infected_chicken` | `pas.infected_chicken.*` | same | `mob.chicken.step` 0.25 |
| `pas:infected_human` | `pas.infected_human.*` | same | `mob.zombie.step` 0.45 |

Infected step events reference **vanilla sound ids** such as `mob.cow.step`, played at pitch 0.8-0.95.

## How the sounds are made (DSP summary)

* **Primitives:**
  * white, pink and brown noise;
  * zero-phase FFT filters (low-, high- and band-pass);
  * a causal TPT state-variable filter with per-sample cutoff and Q, used for sweeps and formants;
  * FM operators;
  * a Rosenberg glottal pulse train with jitter, shimmer and period-doubling (vocal-fry growl);
  * a 3-formant vowel filter bank with vowel morphing;
  * damped-resonator clicks (chitin ticks);
  * rising-chirp bubbles (wet sounds);
  * Poisson crackle (tearing);
  * resonant squelch sweeps;
  * saturated pitch-drop thumps. The harmonics keep heartbeats audible on phone speakers.
* **Space:** a synthetic convolution reverb (exponentially decaying noise IR whose high band decays faster).
* **Parasite** sounds are insectoid: clicks, FM screeches, hiss and bubbles.
* **Infected** sounds are vocal: a glottal source through formants, a growl modulator, low gurgles, and a 3.8 kHz low-pass for a muffled, guttural tone.
* **Outbreak horn:** band-limited additive saws on a root and fifth, with a late minor-ninth, through a swelling low-pass. The pitch sags 1.5 semitones at the end, over a rumble and a beating 880/932 Hz shimmer.

## Particles (`ids.js` `PARTICLES`)

All four effects:
* use `format_version` `1.10.0`;
* use the vanilla atlas `textures/particle/particles` (128×128) with UVs taken from vanilla effects, tinted with `minecraft:particle_appearance_tinting`;
* use `minecraft:emitter_lifetime_once` (`active_time` ≤ 0.5 s) and a finite `max_lifetime` (≤ 1.4 s), so every `spawnParticle` call cleans itself up;
* add no custom textures.

| id | material | count | lifetime | look |
|---|---|---|---|---|
| `pas:infection_spores` | blend | 6-10 (instant) | 0.8-1.3 s | Crimson motes spawn in a 0.9×1.5×0.9 box centred 0.9 above the given location (pass the entity's feet location), then drift up and swirl. They fade in and out and are unlit, so they show at night. Generic puff flipbook `[32,0]`. Made for one `spawnParticle` per second. |
| `pas:conversion_burst` | alpha | 40 (instant) | 0.5-1.0 s | About 35 % are grey-brown smoke puffs that rise. The rest are red/brown gore-spore chunks that fly outward, fall and collide with the ground. Puff flipbook `[56,0]` (as `basic_smoke`/`redstone_wire_dust`), lit. |
| `pas:birth_splatter` | alpha | 15 (instant) | 0.45-0.8 s | Small red droplets thrown up from 0.2 above the location. They fall with gravity and stop on the ground. Flipbook `[40,0]`, lit. |
| `pas:build_sparkle` | blend | 25 (steady, 50/s for 0.5 s) | 0.8-1.4 s | White to gold sparkles rise from a 2×1×2 area and fade out. Sparkle flipbook `[56,88]` (as `endrod`), unlit. |

`gen_particles.py --check` verifies that:
* only components used by vanilla 1.21.0.26 particles appear;
* the identifiers match `ids.js`;
* every flipbook frame lies inside the atlas;
* every effect stays within its particle budget;
* there are no looping, expression or manual emitters, and every particle has a lifetime.

## Limitations

* I could not listen to the sounds, so they were judged from spectrograms (contact sheet), spectral centroids and level statistics. Tune volumes in `tools/audio/catalog.py` and re-run `synth.py`.
* A species pool alternates between vanilla and custom voices rather than layering them (see above).
* Whether `attack` fires depends on the entity's melee goal, as it does for vanilla mobs.
* `tools/build.py` should wrap the definitions with the vanilla `format_version` (`"1.20.20"`); `"1.14.0"` also works. The fragment only uses fields present in vanilla's file.
