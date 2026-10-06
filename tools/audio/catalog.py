"""Catalog of every custom sound in Parasite Apocalypse Survival.

Single source of truth shared by ``synth.py`` (which renders the .ogg files and
writes the two fragments) and ``check_audio.py`` (which verifies them).

Fragment formats (merged by tools/build.py):
* addon/fragments/sound_definitions/pas.json -> the inner ``sound_definitions``
  map of RP ``sounds/sound_definitions.json`` (vanilla 1.21.0.26 uses
  format_version "1.20.20"; fields used here exist in that format and in 1.14.0).
* addon/fragments/sounds/pas.json -> partial RP ``sounds.json`` (deep-merged),
  containing ``entity_sounds.entities`` for the 7 horde entities.

Only fields that vanilla's own sound_definitions.json uses are emitted:
definition: category, min_distance, max_distance, sounds
sound entry: name, volume, pitch, weight, load_on_low_memory
"""

from __future__ import annotations

import math

SAMPLE_RATE = 44100
PEAK_DBFS = -1.0

# Categories vanilla uses: ambient, block, bottle, hostile, music, neutral,
# player, record, ui, weather. SPEC.md section 3: hostile for creatures,
# player for torch/UI, neutral for the base.
VANILLA_CATEGORIES = {
    "ambient", "block", "bottle", "hostile", "music", "neutral",
    "player", "record", "ui", "weather",
}

# Every sound id from addon/behavior_pack/scripts/lib/ids.js SOUNDS.
# group/name -> files sounds/pas/<group>/<name><n>.ogg (n = 1..variants)
# dur = (min, max) seconds accepted by check_audio.py for every variant.
SOUNDS = [
    # --- the parasite (insectoid crawler) -------------------------------
    dict(id="pas.parasite.ambient", group="parasite", name="ambient", variants=4,
         category="hostile", volume=0.8, max_distance=16.0, dur=(0.6, 1.6),
         desc="chitter bursts, wet mandible clicks, bubbling, throaty hiss"),
    dict(id="pas.parasite.hurt", group="parasite", name="hurt", variants=4,
         category="hostile", volume=0.9, max_distance=16.0, dur=(0.25, 0.8),
         desc="raspy inharmonic FM screech with noise band"),
    dict(id="pas.parasite.death", group="parasite", name="death", variants=3,
         category="hostile", volume=1.0, max_distance=16.0, dur=(0.8, 1.8),
         desc="falling screech -> resonant gurgle -> chitin crunch and wet thud"),
    dict(id="pas.parasite.attack", group="parasite", name="attack", variants=4,
         category="hostile", volume=0.9, max_distance=16.0, dur=(0.12, 0.5),
         desc="hiss lunge, double mandible snap, short squelch"),
    dict(id="pas.parasite.step", group="parasite", name="step", variants=4,
         category="hostile", volume=0.5, max_distance=12.0, dur=(0.04, 0.25),
         desc="3-4 tiny chitin ticks (skitter)"),
    dict(id="pas.parasite.birth", group="parasite", name="birth", variants=3,
         category="hostile", volume=0.9, max_distance=16.0, dur=(0.6, 1.5),
         desc="membrane tearing crackle, big squelch, drips, newborn chitter"),
    # --- infected creatures (shared voice layer) ---------------------------
    dict(id="pas.infected.ambient", group="infected", name="ambient", variants=4,
         category="hostile", volume=0.85, max_distance=16.0, dur=(0.8, 1.6),
         desc="guttural formant moan with period-doubling growl and wet gurgle"),
    dict(id="pas.infected.hurt", group="infected", name="hurt", variants=3,
         category="hostile", volume=0.9, max_distance=16.0, dur=(0.3, 0.8),
         desc="harsh pitched-up grunt with wet splat"),
    dict(id="pas.infected.death", group="infected", name="death", variants=3,
         category="hostile", volume=1.0, max_distance=16.0, dur=(0.9, 1.8),
         desc="falling groan into death rattle, gurgle and collapse thud"),
    # --- infection / outbreak events (played by scripts) -------------------
    dict(id="pas.infection.start", group="infection", name="start", variants=3,
         category="hostile", volume=0.9, max_distance=16.0, dur=(0.5, 1.3),
         desc="needle sting with metallic ring, injection squish, heartbeat thump"),
    dict(id="pas.infection.convert", group="infection", name="convert", variants=3,
         category="hostile", volume=1.0, max_distance=24.0, dur=(0.8, 1.7),
         desc="tearing burst, low boom, gore splats, screech overtone"),
    dict(id="pas.infection.heartbeat", group="infection", name="heartbeat", variants=2,
         category="hostile", volume=0.8, max_distance=12.0, dur=(0.4, 0.9),
         desc="low saturated lub-dub double thump"),
    dict(id="pas.outbreak.start", group="outbreak", name="start", variants=2,
         category="hostile", volume=1.0, max_distance=64.0, dur=(2.6, 4.0),
         desc="ominous detuned brass-like drone swell with sinking pitch"),
    # --- items / UI --------------------------------------------------------
    dict(id="pas.torch.on", group="torch", name="on", variants=2,
         category="player", volume=0.6, max_distance=8.0, dur=(0.04, 0.2),
         desc="crisp two-stage switch click (higher)"),
    dict(id="pas.torch.off", group="torch", name="off", variants=2,
         category="player", volume=0.6, max_distance=8.0, dur=(0.04, 0.2),
         desc="crisp two-stage switch click (lower)"),
    dict(id="pas.base.build", group="base", name="build", variants=2,
         category="neutral", volume=0.8, max_distance=32.0, dur=(1.2, 2.5),
         desc="rising whoosh, pentatonic shimmer, wooden construction knocks"),
    dict(id="pas.base.done", group="base", name="done", variants=1,
         category="neutral", volume=0.8, max_distance=32.0, dur=(0.9, 2.3),
         desc="major-arpeggio bell chime with warm pad"),
    dict(id="pas.ui.open", group="ui", name="open", variants=1,
         category="player", volume=0.5, max_distance=8.0, dur=(0.08, 0.35),
         desc="soft two-tone sine beep"),
]

# ---------------------------------------------------------------------------
# Species-flavoured definitions for infected creatures.
# Each one is a weighted pool: a vanilla species voice (referenced by its
# vanilla path, never copied) played at a lowered "sick" pitch, plus our own
# infected voice files at a species-appropriate pitch. A sound definition picks
# ONE entry per play, so over time the creature alternates between a sick
# version of its own voice and the parasite moan.
# ---------------------------------------------------------------------------
_V = "sounds/mob/"
SPECIES = {
    "villager": dict(
        ambient=dict(vanilla=[_V + "villager/idle1", _V + "villager/idle2", _V + "villager/idle3"], pitch=0.68),
        hurt=dict(vanilla=[_V + "villager/hit1", _V + "villager/hit2", _V + "villager/hit3", _V + "villager/hit4"], pitch=0.7),
        death=dict(vanilla=[_V + "villager/death"], pitch=0.62),
        ours_pitch=1.08, step=("mob.zombie.step", 0.4), entity_pitch=[0.9, 1.05]),
    "cow": dict(
        ambient=dict(vanilla=[_V + "cow/say1", _V + "cow/say2", _V + "cow/say3", _V + "cow/say4"], pitch=0.62),
        hurt=dict(vanilla=[_V + "cow/hurt1", _V + "cow/hurt2", _V + "cow/hurt3"], pitch=0.66),
        death=dict(vanilla=[_V + "cow/hurt1", _V + "cow/hurt2", _V + "cow/hurt3"], pitch=0.55),
        ours_pitch=0.88, step=("mob.cow.step", 0.55), entity_pitch=[0.88, 1.02]),
    "pig": dict(
        ambient=dict(vanilla=[_V + "pig/say1", _V + "pig/say2", _V + "pig/say3"], pitch=0.62),
        hurt=dict(vanilla=[_V + "pig/say1", _V + "pig/say2", _V + "pig/say3"], pitch=0.72),
        death=dict(vanilla=[_V + "pig/death"], pitch=0.6),
        ours_pitch=1.15, step=("mob.pig.step", 0.25), entity_pitch=[0.9, 1.05]),
    "sheep": dict(
        ambient=dict(vanilla=[_V + "sheep/say1", _V + "sheep/say2", _V + "sheep/say3"], pitch=0.6),
        hurt=dict(vanilla=[_V + "sheep/say1", _V + "sheep/say2", _V + "sheep/say3"], pitch=0.7),
        death=dict(vanilla=[_V + "sheep/say1", _V + "sheep/say2", _V + "sheep/say3"], pitch=0.55),
        ours_pitch=1.2, step=("mob.sheep.step", 0.4), entity_pitch=[0.9, 1.05]),
    "chicken": dict(
        ambient=dict(vanilla=[_V + "chicken/say1", _V + "chicken/say2", _V + "chicken/say3"], pitch=0.7),
        hurt=dict(vanilla=[_V + "chicken/hurt1", _V + "chicken/hurt2"], pitch=0.72),
        death=dict(vanilla=[_V + "chicken/hurt1", _V + "chicken/hurt2"], pitch=0.6),
        ours_pitch=1.6, step=("mob.chicken.step", 0.25), entity_pitch=[0.9, 1.05]),
    "human": dict(
        ambient=dict(vanilla=[_V + "zombie/say1", _V + "zombie/say2", _V + "zombie/say3"], pitch=0.82),
        hurt=dict(vanilla=[_V + "zombie/hurt1", _V + "zombie/hurt2"], pitch=0.85),
        death=dict(vanilla=[_V + "zombie/death"], pitch=0.8),
        ours_pitch=1.0, step=("mob.zombie.step", 0.45), entity_pitch=[0.88, 1.05]),
}
SPECIES_EVENTS = ("ambient", "hurt", "death")
# Share of plays that use the vanilla species voice (rest: our infected voice).
VANILLA_SHARE = 0.55
SPECIES_VOLUME = {"ambient": 0.9, "hurt": 0.95, "death": 1.0}
SPECIES_MAX_DISTANCE = 16.0

ENTITY_IDS = {
    "parasite": "pas:parasite",
    "villager": "pas:infected_villager",
    "cow": "pas:infected_cow",
    "pig": "pas:infected_pig",
    "sheep": "pas:infected_sheep",
    "chicken": "pas:infected_chicken",
    "human": "pas:infected_human",
}


def by_id(sound_id: str) -> dict:
    for s in SOUNDS:
        if s["id"] == sound_id:
            return s
    raise KeyError(sound_id)


def file_stems(spec: dict) -> list[str]:
    """Resource paths without extension, e.g. sounds/pas/parasite/ambient1."""
    return [f"sounds/pas/{spec['group']}/{spec['name']}{i}" for i in range(1, spec["variants"] + 1)]


def species_id(species: str, event: str) -> str:
    return f"pas.infected_{species}.{event}"


def _weights(n_vanilla: int, n_ours: int) -> tuple[int, int]:
    """Integer weights so the vanilla pool gets VANILLA_SHARE of plays."""
    share = round(VANILLA_SHARE * 20)
    wv, wo = n_ours * share, n_vanilla * (20 - share)
    g = math.gcd(wv, wo)
    return wv // g, wo // g


def build_sound_definitions() -> dict:
    defs: dict = {}
    for spec in SOUNDS:
        entries = []
        for i, stem in enumerate(file_stems(spec)):
            e = {"name": stem, "volume": spec["volume"]}
            if i == 0:
                e["load_on_low_memory"] = True
            entries.append(e)
        defs[spec["id"]] = {
            "category": spec["category"],
            "max_distance": spec["max_distance"],
            "sounds": entries,
        }
    for species, cfg in SPECIES.items():
        for event in SPECIES_EVENTS:
            ev = cfg[event]
            ours_spec = by_id(f"pas.infected.{event}")
            ours = file_stems(ours_spec)
            wv, wo = _weights(len(ev["vanilla"]), len(ours))
            vol = SPECIES_VOLUME[event]
            entries = []
            for i, stem in enumerate(ours):
                e = {"name": stem, "volume": vol, "pitch": cfg["ours_pitch"], "weight": wo}
                if i == 0:
                    e["load_on_low_memory"] = True
                entries.append(e)
            for path in ev["vanilla"]:
                entries.append({"name": path, "volume": vol, "pitch": ev["pitch"], "weight": wv})
            defs[species_id(species, event)] = {
                "category": "hostile",
                "max_distance": SPECIES_MAX_DISTANCE,
                "sounds": entries,
            }
    return defs


def build_entity_sounds() -> dict:
    """Partial sounds.json. Event names verified against vanilla sounds.json
    (1.21.0.26): ambient, hurt, death, step and attack (melee bite, as used by
    fox/hoglin/zoglin/piglin)."""
    ents: dict = {
        ENTITY_IDS["parasite"]: {
            "volume": 1.0,
            "pitch": [0.9, 1.12],
            "events": {
                "ambient": "pas.parasite.ambient",
                "hurt": "pas.parasite.hurt",
                "death": "pas.parasite.death",
                "attack": "pas.parasite.attack",
                "step": {"sound": "pas.parasite.step", "volume": 0.5, "pitch": [0.9, 1.15]},
            },
        }
    }
    for species, cfg in SPECIES.items():
        step_sound, step_vol = cfg["step"]
        ents[ENTITY_IDS[species]] = {
            "volume": 1.0,
            "pitch": cfg["entity_pitch"],
            "events": {
                "ambient": species_id(species, "ambient"),
                "hurt": species_id(species, "hurt"),
                "death": species_id(species, "death"),
                "attack": {"sound": "pas.parasite.attack", "volume": 0.7, "pitch": [0.6, 0.75]},
                "step": {"sound": step_sound, "volume": step_vol, "pitch": [0.8, 0.95]},
            },
        }
    return {"entity_sounds": {"entities": ents}}


def all_sound_ids() -> list[str]:
    return list(build_sound_definitions().keys())
