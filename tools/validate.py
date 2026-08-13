#!/usr/bin/env python3
"""Static validation for the whole add-on.

Nothing here needs Minecraft. It checks the things that silently produce a pack
that imports but does not work: unparseable JSON, duplicate UUIDs, references
that point at files which do not exist, Java-Edition syntax that Bedrock will
reject, and fills over the engine's volume cap.

Exit code is non-zero if any ERROR is found. Warnings do not fail the build.

Run: python3 tools/validate.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "src" / "behavior_pack"
RP = ROOT / "src" / "resource_pack"

ERRORS: list[str] = []
WARNINGS: list[str] = []

# Script module versions known to exist in the Bedrock 1.21.0 line.
ALLOWED_SCRIPT_MODULES = {"@minecraft/server": {"1.11.0"}}
EXPECTED_MIN_ENGINE = [1, 21, 0]
FILL_LIMIT = 32768

IDENTIFIER_RE = re.compile(r"^[a-z0-9_]+:[a-z0-9_]+$")

# Per-tick block budgets.
#
# Bedrock's own fill cap is 32768, but that is a syntax limit, not a budget an
# Android device can absorb in one frame. A .mcfunction runs in a single tick,
# so the whole file's block volume — plus anything it calls — is what actually
# lands on the frame. Pacing the build by command count instead of volume put
# ~500k block writes in one tick and hard-crashed Minecraft on mobile.
MAX_FILL_BLOCKS = 8192       # any single fill command
MAX_FUNCTION_BLOCKS = 16000  # one .mcfunction, including functions it calls


def error(message: str) -> None:
    ERRORS.append(message)


def warn(message: str) -> None:
    WARNINGS.append(message)


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


# ------------------------------------------------------------ json load ----

_json_cache: dict[Path, object] = {}


def load_json(path: Path):
    if path in _json_cache:
        return _json_cache[path]
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        error(f"{rel(path)}: cannot read ({exc})")
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        error(f"{rel(path)}: invalid JSON at line {exc.lineno} col {exc.colno}: {exc.msg}")
        return None
    _json_cache[path] = data
    return data


def all_json(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.json") if p.is_file())


# ------------------------------------------------------------- manifests ---


def check_manifests() -> None:
    seen_uuids: dict[str, str] = {}
    manifests = {}

    for pack_root, label in ((BP, "behaviour"), (RP, "resource")):
        path = pack_root / "manifest.json"
        if not path.exists():
            error(f"{label} pack: manifest.json is missing")
            continue
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        manifests[label] = data

        if data.get("format_version") != 2:
            error(f"{rel(path)}: format_version must be 2, got {data.get('format_version')!r}")

        header = data.get("header") or {}
        for key in ("name", "description", "uuid", "version"):
            if key not in header:
                error(f"{rel(path)}: header is missing {key!r}")

        min_engine = header.get("min_engine_version")
        if min_engine != EXPECTED_MIN_ENGINE:
            error(
                f"{rel(path)}: min_engine_version should be {EXPECTED_MIN_ENGINE}, got {min_engine!r}"
            )

        modules = data.get("modules") or []
        if not modules:
            error(f"{rel(path)}: no modules declared")

        for uuid_value, where in [(header.get("uuid"), "header")] + [
            (m.get("uuid"), f"module[{i}]") for i, m in enumerate(modules)
        ]:
            if not uuid_value:
                error(f"{rel(path)}: {where} has no uuid")
                continue
            if uuid_value in seen_uuids:
                error(
                    f"duplicate UUID {uuid_value} used by {seen_uuids[uuid_value]} "
                    f"and {rel(path)}:{where}"
                )
            seen_uuids[uuid_value] = f"{rel(path)}:{where}"

        for index, module in enumerate(modules):
            if module.get("type") != "script":
                continue
            entry = module.get("entry")
            if not entry:
                error(f"{rel(path)}: script module has no entry")
            elif not (pack_root / entry).exists():
                error(f"{rel(path)}: script entry {entry!r} does not exist")
            if module.get("language") != "javascript":
                error(f"{rel(path)}: script module language must be 'javascript'")

        for dependency in data.get("dependencies") or []:
            name = dependency.get("module_name")
            if name is None:
                continue
            version = dependency.get("version")
            allowed = ALLOWED_SCRIPT_MODULES.get(name)
            if allowed is None:
                error(
                    f"{rel(path)}: depends on unexpected script module {name!r} — "
                    "only @minecraft/server is allowed on this target"
                )
            elif version not in allowed:
                error(
                    f"{rel(path)}: {name} version {version!r} is not known to exist in "
                    f"Bedrock 1.21.0 (expected one of {sorted(allowed)})"
                )

    # Cross-pack dependency wiring.
    if "behaviour" in manifests and "resource" in manifests:
        bp_uuid = manifests["behaviour"]["header"]["uuid"]
        rp_uuid = manifests["resource"]["header"]["uuid"]
        bp_deps = {d.get("uuid") for d in manifests["behaviour"].get("dependencies", [])}
        rp_deps = {d.get("uuid") for d in manifests["resource"].get("dependencies", [])}
        if rp_uuid not in bp_deps:
            error("behaviour manifest does not declare the resource pack as a dependency")
        if bp_uuid not in rp_deps:
            error("resource manifest does not declare the behaviour pack as a dependency")


# ---------------------------------------------------------------- assets ---


def texture_exists(pack_root: Path, reference: str) -> bool:
    """Bedrock texture paths are extension-less."""
    candidate = pack_root / reference
    if candidate.suffix:
        return candidate.exists()
    return any(candidate.with_suffix(ext).exists() for ext in (".png", ".tga", ".jpg"))


def check_atlases() -> tuple[dict, dict]:
    item_atlas = load_json(RP / "textures" / "item_texture.json") or {}
    terrain_atlas = load_json(RP / "textures" / "terrain_texture.json") or {}

    for label, atlas in (("item_texture.json", item_atlas), ("terrain_texture.json", terrain_atlas)):
        data = atlas.get("texture_data")
        if not isinstance(data, dict):
            error(f"{label}: texture_data missing or not an object")
            continue
        for key, entry in data.items():
            textures = entry.get("textures")
            paths = [textures] if isinstance(textures, str) else (textures or [])
            for reference in paths:
                if isinstance(reference, dict):
                    reference = reference.get("path", "")
                if not texture_exists(RP, reference):
                    error(f"{label}: key {key!r} points at missing texture {reference!r}")

    return item_atlas.get("texture_data", {}), terrain_atlas.get("texture_data", {})


def check_items(item_keys: dict) -> set[str]:
    identifiers = set()
    for path in all_json(BP / "items"):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        item = data.get("minecraft:item")
        if not item:
            error(f"{rel(path)}: missing 'minecraft:item'")
            continue
        identifier = (item.get("description") or {}).get("identifier")
        if not identifier or not IDENTIFIER_RE.match(identifier):
            error(f"{rel(path)}: invalid identifier {identifier!r}")
            continue
        if identifier in identifiers:
            error(f"{rel(path)}: duplicate item identifier {identifier}")
        identifiers.add(identifier)

        components = item.get("components") or {}
        icon = components.get("minecraft:icon")
        if icon is None:
            error(f"{rel(path)}: {identifier} has no minecraft:icon")
        else:
            if isinstance(icon, dict):
                keys = list((icon.get("textures") or {}).values()) or (
                    [icon["texture"]] if "texture" in icon else []
                )
            else:
                keys = [icon]
            for key in keys:
                if key not in item_keys:
                    error(
                        f"{rel(path)}: icon key {key!r} is not registered in item_texture.json"
                    )

        wearable = components.get("minecraft:wearable")
        if wearable:
            slot = wearable.get("slot")
            if not isinstance(slot, str) or not slot.startswith("slot."):
                error(f"{rel(path)}: minecraft:wearable slot {slot!r} looks wrong")
            attachable = RP / "attachables"
            found = False
            for candidate in all_json(attachable) if attachable.exists() else []:
                payload = load_json(candidate) or {}
                description = (payload.get("minecraft:attachable") or {}).get("description") or {}
                if description.get("identifier") == identifier:
                    found = True
            if not found:
                warn(
                    f"{identifier} is wearable but has no attachable — it will not "
                    "render on the player model"
                )
    return identifiers


def check_blocks(terrain_keys: dict) -> set[str]:
    identifiers = set()
    for path in all_json(BP / "blocks"):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        block = data.get("minecraft:block")
        if not block:
            error(f"{rel(path)}: missing 'minecraft:block'")
            continue
        identifier = (block.get("description") or {}).get("identifier")
        if not identifier or not IDENTIFIER_RE.match(identifier):
            error(f"{rel(path)}: invalid identifier {identifier!r}")
            continue
        if identifier in identifiers:
            error(f"{rel(path)}: duplicate block identifier {identifier}")
        identifiers.add(identifier)

        components = block.get("components") or {}
        instances = components.get("minecraft:material_instances") or {}
        if not instances:
            error(f"{rel(path)}: {identifier} has no material_instances")
        for name, instance in instances.items():
            texture = instance.get("texture")
            if texture and texture not in terrain_keys:
                error(
                    f"{rel(path)}: material instance {name!r} texture {texture!r} "
                    "is not registered in terrain_texture.json"
                )
        light = components.get("minecraft:light_emission")
        if light is not None and not (isinstance(light, int) and 0 <= light <= 15):
            error(f"{rel(path)}: light_emission must be an integer 0..15, got {light!r}")
    return identifiers


def check_entities() -> set[str]:
    """BP entity self-consistency: events, groups, loot tables, identifiers."""
    identifiers = set()
    entity_dir = BP / "entities"
    if not entity_dir.exists():
        warn("no behaviour-pack entities directory")
        return identifiers

    for path in all_json(entity_dir):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        entity = data.get("minecraft:entity")
        if not entity:
            error(f"{rel(path)}: missing 'minecraft:entity'")
            continue
        description = entity.get("description") or {}
        identifier = description.get("identifier")
        if not identifier or not IDENTIFIER_RE.match(identifier):
            error(f"{rel(path)}: invalid identifier {identifier!r}")
            continue
        if identifier in identifiers:
            error(f"{rel(path)}: duplicate entity identifier {identifier}")
        identifiers.add(identifier)

        groups = set((entity.get("component_groups") or {}).keys())
        events = entity.get("events") or {}
        event_names = set(events.keys())

        def referenced_groups(node) -> set[str]:
            found = set()
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ("add", "remove") and isinstance(value, dict):
                        for group in value.get("component_groups", []) or []:
                            found.add(group)
                    else:
                        found |= referenced_groups(value)
            elif isinstance(node, list):
                for item in node:
                    found |= referenced_groups(item)
            return found

        for group in referenced_groups(events):
            if group not in groups:
                error(f"{rel(path)}: event references undefined component group {group!r}")

        def referenced_events(node) -> set[str]:
            found = set()
            if isinstance(node, dict):
                for key, value in node.items():
                    if key == "event" and isinstance(value, str):
                        found.add(value)
                    elif key in ("trigger",) and isinstance(value, str):
                        found.add(value)
                    else:
                        found |= referenced_events(value)
            elif isinstance(node, list):
                for item in node:
                    found |= referenced_events(item)
            return found

        for name in referenced_events(entity):
            if name not in event_names and not name.startswith("minecraft:"):
                error(f"{rel(path)}: reference to undefined event {name!r}")

        def loot_tables(node) -> set[str]:
            found = set()
            if isinstance(node, dict):
                for key, value in node.items():
                    if key == "minecraft:loot" and isinstance(value, dict):
                        table = value.get("table")
                        if table:
                            found.add(table)
                    else:
                        found |= loot_tables(value)
            elif isinstance(node, list):
                for item in node:
                    found |= loot_tables(item)
            return found

        for table in loot_tables(entity):
            if not (BP / table).exists():
                error(f"{rel(path)}: loot table {table!r} does not exist")

    return identifiers


def geometry_identifiers() -> dict[str, Path]:
    found: dict[str, Path] = {}
    models = RP / "models"
    if not models.exists():
        return found
    for path in all_json(models):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        for geometry in data.get("minecraft:geometry") or []:
            identifier = (geometry.get("description") or {}).get("identifier")
            if identifier:
                found[identifier] = path
        # Legacy 1.8.0 geometry files key models directly.
        for key in data:
            if key.startswith("geometry."):
                found[key] = path
    return found


def collect_ids(root: Path, top_key: str) -> dict[str, Path]:
    found: dict[str, Path] = {}
    if not root.exists():
        return found
    for path in all_json(root):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        for identifier in (data.get(top_key) or {}):
            found[identifier] = path
    return found


def check_client_entities(bp_entities: set[str]) -> None:
    entity_dir = RP / "entity"
    if not entity_dir.exists():
        if bp_entities:
            error("resource pack has no entity/ directory but behaviour entities exist")
        return

    geometries = geometry_identifiers()
    render_controllers = collect_ids(RP / "render_controllers", "render_controllers")
    animations = collect_ids(RP / "animations", "animations")
    animations |= collect_ids(RP / "animation_controllers", "animation_controllers")

    described = set()
    for path in all_json(entity_dir):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        description = (data.get("minecraft:client_entity") or {}).get("description")
        if not description:
            error(f"{rel(path)}: missing minecraft:client_entity.description")
            continue
        identifier = description.get("identifier")
        described.add(identifier)
        if identifier not in bp_entities:
            error(f"{rel(path)}: client entity {identifier!r} has no behaviour-pack entity")

        for key, reference in (description.get("textures") or {}).items():
            if not texture_exists(RP, reference):
                error(f"{rel(path)}: texture {key!r} -> {reference!r} does not exist")

        for key, reference in (description.get("geometry") or {}).items():
            if reference not in geometries:
                error(f"{rel(path)}: geometry {key!r} -> {reference!r} is not defined")

        for reference in description.get("render_controllers") or []:
            name = reference if isinstance(reference, str) else next(iter(reference))
            if name not in render_controllers:
                error(f"{rel(path)}: render controller {name!r} is not defined")

        for key, reference in (description.get("animations") or {}).items():
            if reference not in animations:
                error(f"{rel(path)}: animation {key!r} -> {reference!r} is not defined")

    for identifier in bp_entities:
        if identifier not in described:
            error(f"behaviour entity {identifier} has no client entity in the resource pack")


def check_attachables_and_particles() -> None:
    geometries = geometry_identifiers()
    for path in all_json(RP / "attachables") if (RP / "attachables").exists() else []:
        description = ((load_json(path) or {}).get("minecraft:attachable") or {}).get(
            "description"
        ) or {}
        for key, reference in (description.get("textures") or {}).items():
            # Vanilla paths resolve at runtime against the base game.
            if reference.startswith("textures/misc/"):
                continue
            if not texture_exists(RP, reference):
                error(f"{rel(path)}: texture {key!r} -> {reference!r} does not exist")
        for key, reference in (description.get("geometry") or {}).items():
            if reference.startswith("geometry.humanoid"):
                continue  # provided by the base game
            if reference not in geometries:
                error(f"{rel(path)}: geometry {key!r} -> {reference!r} is not defined")

    for path in all_json(RP / "particles") if (RP / "particles").exists() else []:
        description = ((load_json(path) or {}).get("particle_effect") or {}).get(
            "description"
        ) or {}
        identifier = description.get("identifier")
        if not identifier or not IDENTIFIER_RE.match(identifier):
            error(f"{rel(path)}: invalid particle identifier {identifier!r}")
        reference = (description.get("basic_render_parameters") or {}).get("texture")
        if reference and not texture_exists(RP, reference):
            error(f"{rel(path)}: particle texture {reference!r} does not exist")


VANILLA_SOUND_DATA = Path(__file__).parent / "data_mojang_sounds_1_21_0.json"


def check_sounds() -> None:
    """Every referenced sound event must exist, either in this pack or in the
    1.21.0 vanilla sound table (Mojang/bedrock-samples v1.21.0.3)."""
    definitions_path = RP / "sounds" / "sound_definitions.json"
    defined = set()
    if definitions_path.exists():
        data = load_json(definitions_path) or {}
        defined = set((data.get("sound_definitions") or {}).keys())

    vanilla = set()
    vanilla_files: set[str] = set()
    if VANILLA_SOUND_DATA.exists():
        payload = load_json(VANILLA_SOUND_DATA) or {}
        vanilla = set(payload.get("sound_events", []))
        vanilla_files = set(payload.get("sound_files", []))
    else:
        warn("vanilla sound metadata is missing — sound events were not verified")

    known = defined | vanilla

    # This pack ships no .ogg data: its sound events alias vanilla audio files.
    # Those aliases must name real vanilla files or they play silence.
    if definitions_path.exists():
        data = load_json(definitions_path) or {}
        for name, payload in (data.get("sound_definitions") or {}).items():
            for sound in payload.get("sounds", []):
                reference = sound if isinstance(sound, str) else sound.get("name", "")
                if (RP / f"{reference}.ogg").exists():
                    continue
                if vanilla_files and reference not in vanilla_files:
                    error(
                        f"sound_definitions.json: {name!r} aliases {reference!r}, "
                        "which is neither a pack file nor a vanilla 1.21.0 sound file"
                    )

    sounds_path = RP / "sounds.json"
    if not sounds_path.exists():
        return
    data = load_json(sounds_path) or {}
    entities = ((data.get("entity_sounds") or {}).get("entities")) or {}
    for identifier, payload in entities.items():
        for event, value in (payload.get("events") or {}).items():
            name = value if isinstance(value, str) else value.get("sound")
            if name and known and name not in known:
                error(f"sounds.json: {identifier}.{event} -> {name!r} is not a known sound event")

    # Sounds played from functions and scripts must exist too.
    for path in sorted((BP / "functions").rglob("*.mcfunction")):
        for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            parts = raw.strip().split()
            if len(parts) >= 2 and parts[0] == "playsound" and known:
                if parts[1] not in known:
                    error(f"{rel(path)}:{line_number}: unknown sound event {parts[1]!r}")

    for path in sorted((BP / "scripts").rglob("*.js")):
        source = path.read_text(encoding="utf-8")
        for name in re.findall(r'playSound\(\s*"([^"]+)"', source):
            if known and name not in known:
                error(f"{rel(path)}: unknown sound event {name!r}")


# ------------------------------------------------------------- functions ---

BEDROCK_COMMANDS = {
    "alwaysday", "camerashake", "clear", "clearspawnpoint", "clone", "damage",
    "day", "daylock", "dialogue", "difficulty", "effect", "enchant", "event",
    "execute", "fill", "fog", "function", "gamemode", "gamerule", "give",
    "help", "inputpermission", "kill", "list", "locate", "loot", "me", "mobevent",
    "msg", "music", "particle", "playanimation", "playsound", "recipe",
    "reload", "replaceitem", "ride", "say", "schedule", "score", "scoreboard",
    "screenshot", "scriptevent", "setblock", "setmaxplayers", "setworldspawn",
    "spawnpoint", "spreadplayers", "stopsound", "structure", "summon", "tag",
    "teleport", "tell", "tellraw", "testfor", "testforblock", "testforblocks",
    "tickingarea", "time", "title", "titleraw", "tp", "w", "weather", "xp",
}

JAVA_ONLY = {
    "advancement", "attribute", "bossbar", "data", "datapack", "forceload",
    "item", "team", "trigger", "worldborder", "seed", "defaultgamemode",
}

JAVA_BLOCKSTATE_RE = re.compile(r"\[[a-z_]+=")


def parse_coord(token: str) -> float | None:
    token = token.strip()
    if token.startswith("^"):
        return None
    if token.startswith("~"):
        token = token[1:] or "0"
    try:
        return float(token)
    except ValueError:
        return None


def check_functions() -> None:
    function_root = BP / "functions"
    if not function_root.exists():
        error("behaviour pack has no functions directory")
        return

    available = {
        str(p.relative_to(function_root).with_suffix("")).replace("\\", "/")
        for p in function_root.rglob("*.mcfunction")
    }
    if not available:
        error("no .mcfunction files found")

    referenced: set[str] = set()
    script_events: set[str] = set()
    total_commands = 0

    for path in sorted(function_root.rglob("*.mcfunction")):
        for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            total_commands += 1
            where = f"{rel(path)}:{line_number}"

            if line.startswith("/"):
                error(f"{where}: commands in functions must not start with '/'")
                line = line[1:]

            parts = line.split()
            command = parts[0].lower()

            if command in JAVA_ONLY:
                error(f"{where}: '{command}' is a Java Edition command and does not exist in Bedrock")
            elif command not in BEDROCK_COMMANDS:
                error(f"{where}: unknown Bedrock command {command!r}")

            if JAVA_BLOCKSTATE_RE.search(line):
                error(
                    f"{where}: Java-style block state syntax detected — Bedrock uses "
                    '["state":value]'
                )

            if command == "function" and len(parts) > 1:
                referenced.add(parts[1].strip('"'))

            if command == "scriptevent" and len(parts) > 1:
                script_events.add(parts[1])

            if command == "fill" and len(parts) >= 7:
                coords = [parse_coord(token) for token in parts[1:7]]
                if all(c is not None for c in coords):
                    volume = 1
                    for index in range(3):
                        volume *= abs(coords[index + 3] - coords[index]) + 1
                    if volume > FILL_LIMIT:
                        error(
                            f"{where}: fill volume {int(volume)} exceeds Bedrock's "
                            f"{FILL_LIMIT} block limit"
                        )
                    elif volume > MAX_FILL_BLOCKS:
                        error(
                            f"{where}: fill volume {int(volume)} exceeds the mobile "
                            f"per-command budget of {MAX_FILL_BLOCKS} blocks"
                        )

            # `execute positioned` chains must still end in a real command.
            if command == "execute" and " run " not in f" {line} ":
                warn(f"{where}: execute without a 'run' clause")

    for name in sorted(referenced):
        if name not in available:
            error(f"function reference {name!r} does not resolve to a .mcfunction file")

    check_script_events(script_events)
    check_function_budgets(function_root, available)
    print(f"  functions: {len(available)} files, {total_commands} commands")


def function_own_volume(path: Path) -> tuple[int, list[str]]:
    """Blocks a function writes itself, and the functions it calls."""
    volume = 0
    calls: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] == "setblock":
            volume += 1
        elif parts[0] == "function" and len(parts) > 1:
            calls.append(parts[1].strip('"'))
        elif parts[0] == "fill" and len(parts) >= 7:
            coords = [parse_coord(token) for token in parts[1:7]]
            if all(c is not None for c in coords):
                span = 1
                for index in range(3):
                    span *= abs(coords[index + 3] - coords[index]) + 1
                volume += int(span)
        elif "run fill" in line or "run setblock" in line:
            volume += 1
    return volume, calls


def check_function_budgets(function_root: Path, available: set[str]) -> None:
    """No single function may blow the per-tick block budget.

    A .mcfunction executes in one tick, and so does everything it calls, so the
    transitive volume is what actually hits the frame. This is the check that
    would have caught the crash: a build paced by command count where one part
    happened to contain half a million blocks of `fill`.
    """
    own: dict[str, int] = {}
    calls: dict[str, list[str]] = {}
    for path in sorted(function_root.rglob("*.mcfunction")):
        name = str(path.relative_to(function_root).with_suffix("")).replace("\\", "/")
        own[name], calls[name] = function_own_volume(path)

    def total(name: str, seen: frozenset[str]) -> int:
        if name in seen or name not in own:
            return 0  # cycle, or unresolved reference already reported
        return own[name] + sum(
            total(callee, seen | {name}) for callee in calls.get(name, [])
        )

    worst = ("", 0)
    for name in sorted(own):
        volume = total(name, frozenset())
        if volume > worst[1]:
            worst = (name, volume)
        if volume > MAX_FUNCTION_BLOCKS:
            detail = (
                f" (it calls {len(calls[name])} functions)" if calls.get(name) else ""
            )
            error(
                f"{name}.mcfunction writes {volume:,} blocks in a single tick{detail} — "
                f"over the {MAX_FUNCTION_BLOCKS:,} mobile budget. Split it into parts "
                "the script paces one per tick."
            )
    if worst[0]:
        print(f"  per-tick budget: worst function {worst[0]} at {worst[1]:,} blocks")


VANILLA_BLOCK_DATA = Path(__file__).parent / "data_mojang_blocks_1_21_0.json"

# `<identifier>["state":value, ...]` as it appears in a command.
BLOCK_WITH_STATES_RE = re.compile(r"(minecraft:[a-z0-9_]+)\s*(\[[^\]]*\])")
STATE_PAIR_RE = re.compile(r'"([a-z0-9_:]+)"\s*:\s*("[^"]*"|true|false|-?\d+)')


def check_vanilla_blocks() -> None:
    """Check every vanilla block identifier and block state against Mojang's own
    1.21.0 metadata (bedrock-samples v1.21.0.3, module version 1.21.0-beta.0).

    This is the check that matters most: Bedrock flattened its block families on
    a different schedule from Java, so an identifier that is correct in Java, or
    correct in a later Bedrock release, can silently fail on this target.
    """
    if not VANILLA_BLOCK_DATA.exists():
        warn("vanilla block metadata is missing — block identifiers were not verified")
        return

    data = load_json(VANILLA_BLOCK_DATA)
    if not isinstance(data, dict):
        return

    valid_states: dict[str, set[str]] = {}
    for entry in data.get("data_items", []):
        valid_states[entry["name"]] = {p["name"] for p in entry.get("properties", [])}

    domains: dict[str, set] = {}
    for prop in data.get("block_properties", []):
        domains[prop["name"]] = {v["value"] for v in prop.get("values", [])}

    function_root = BP / "functions"
    seen_ids: set[str] = set()
    bad_ids: dict[str, str] = {}
    bad_states: dict[tuple[str, str], str] = {}
    bad_values: dict[tuple[str, str, object], str] = {}

    for path in sorted(function_root.rglob("*.mcfunction")):
        for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            where = f"{rel(path)}:{line_number}"

            # Strip bracketed sections first: block *states* are also namespaced
            # (`minecraft:cardinal_direction`) and must not be read as blocks.
            without_states = re.sub(r"\[[^\]]*\]", "", line)
            for identifier in re.findall(r"minecraft:[a-z0-9_]+", without_states):
                seen_ids.add(identifier)
                if identifier not in valid_states:
                    bad_ids.setdefault(identifier, where)

            for identifier, states in BLOCK_WITH_STATES_RE.findall(line):
                if identifier not in valid_states:
                    continue
                for name, raw_value in STATE_PAIR_RE.findall(states):
                    if name not in valid_states[identifier]:
                        bad_states.setdefault((identifier, name), where)
                        continue
                    if raw_value.startswith('"'):
                        value = raw_value.strip('"')
                    elif raw_value in ("true", "false"):
                        value = raw_value == "true"
                    else:
                        value = int(raw_value)
                    allowed = domains.get(name)
                    if allowed and value not in allowed:
                        bad_values.setdefault((identifier, name, value), where)

    for identifier, where in sorted(bad_ids.items()):
        error(f"{where}: {identifier} does not exist in Bedrock 1.21.0")
    for (identifier, name), where in sorted(bad_states.items()):
        allowed = sorted(valid_states.get(identifier, set()))
        error(f"{where}: {identifier} has no block state {name!r} (valid: {allowed})")
    for (identifier, name, value), where in sorted(bad_values.items(), key=lambda kv: str(kv[0])):
        error(
            f"{where}: {identifier} state {name!r} cannot be {value!r} "
            f"(valid: {sorted(domains.get(name, set()), key=str)})"
        )

    print(
        f"  vanilla blocks: {len(seen_ids)} identifiers checked against "
        f"{data.get('minecraft_version', '?')} metadata"
    )


def check_script_events(used: set[str]) -> None:
    main_path = BP / "scripts" / "main.js"
    if not main_path.exists():
        error("scripts/main.js is missing")
        return
    source = main_path.read_text(encoding="utf-8")
    handled = set(re.findall(r'"(myc:[a-z_]+)"\s*:', source))
    for identifier in sorted(used):
        if identifier not in handled:
            error(
                f"functions raise script event {identifier!r} but main.js has no handler for it"
            )


# --------------------------------------------------------------- scripts ---


def check_scripts() -> None:
    scripts_dir = BP / "scripts"
    if not scripts_dir.exists():
        error("behaviour pack has no scripts directory")
        return

    files = sorted(scripts_dir.rglob("*.js"))
    for path in files:
        source = path.read_text(encoding="utf-8")

        for module in re.findall(r'from\s+"(@minecraft/[^"]+)"', source):
            base = module.split("@")[0] if not module.startswith("@") else module
            if base not in ALLOWED_SCRIPT_MODULES:
                error(f"{rel(path)}: imports disallowed module {module!r}")

        for reference in re.findall(r'from\s+"(\./[^"]+)"', source):
            if not (path.parent / reference).exists():
                error(f"{rel(path)}: relative import {reference!r} does not resolve")

        # Synchronous runCommand is not stable on this target.
        for match in re.finditer(r"\.runCommand\s*\(", source):
            line = source[: match.start()].count("\n") + 1
            error(
                f"{rel(path)}:{line}: synchronous runCommand() is not stable in "
                "@minecraft/server 1.11.0 — use runCommandAsync()"
            )

        if "setInterval(" in source or "setTimeout(" in source:
            error(f"{rel(path)}: setInterval/setTimeout do not exist in Bedrock scripting")

    check_script_exports(files)
    check_script_syntax(files)
    print(f"  scripts: {len(files)} files")


EXPORT_RE = re.compile(
    r"^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
EXPORT_LIST_RE = re.compile(r"^export\s*\{([^}]*)\}", re.MULTILINE)
IMPORT_RE = re.compile(r'import\s*\{([^}]*)\}\s*from\s*"(\./[^"]+)"')


def check_script_exports(files: list[Path]) -> None:
    """Every named import must resolve to a real export in the target module."""
    exports: dict[Path, set[str]] = {}
    for path in files:
        source = path.read_text(encoding="utf-8")
        names = set(EXPORT_RE.findall(source))
        for group in EXPORT_LIST_RE.findall(source):
            for piece in group.split(","):
                piece = piece.strip()
                if not piece:
                    continue
                names.add(piece.split(" as ")[-1].strip())
        exports[path.resolve()] = names

    for path in files:
        source = path.read_text(encoding="utf-8")
        for group, reference in IMPORT_RE.findall(source):
            target = (path.parent / reference).resolve()
            if target not in exports:
                continue  # unresolved path already reported
            for piece in group.split(","):
                piece = piece.strip()
                if not piece:
                    continue
                name = piece.split(" as ")[0].strip()
                if name and name not in exports[target]:
                    error(
                        f"{rel(path)}: imports {name!r} from {reference}, "
                        "which does not export it"
                    )


def check_script_syntax(files: list[Path]) -> None:
    """Parse each script with Node if it is available."""
    import shutil
    import subprocess
    import tempfile

    node = shutil.which("node")
    if not node:
        warn("node is not available — script syntax was not parsed")
        return

    with tempfile.TemporaryDirectory() as tmp:
        for path in files:
            # .mjs so Node parses it as an ES module, matching Bedrock.
            copy = Path(tmp) / f"{path.stem}.mjs"
            copy.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
            result = subprocess.run(
                [node, "--check", str(copy)], capture_output=True, text=True
            )
            if result.returncode != 0:
                first = (result.stderr.strip().splitlines() or ["syntax error"])[0]
                error(f"{rel(path)}: JavaScript syntax error — {first}")


# ------------------------------------------------------------------ misc ---


def check_orphan_textures(item_keys: dict, terrain_keys: dict) -> None:
    used = set()
    for key, entry in {**item_keys, **terrain_keys}.items():
        textures = entry.get("textures")
        paths = [textures] if isinstance(textures, str) else (textures or [])
        for reference in paths:
            if isinstance(reference, dict):
                reference = reference.get("path", "")
            used.add(reference)

    for folder in ("items", "blocks"):
        directory = RP / "textures" / folder
        if not directory.exists():
            continue
        for png in sorted(directory.glob("*.png")):
            reference = f"textures/{folder}/{png.stem}"
            if reference not in used:
                warn(f"{rel(png)}: texture is not referenced by any atlas entry")


def check_lang() -> None:
    for pack_root, label in ((BP, "behaviour"), (RP, "resource")):
        path = pack_root / "texts" / "en_US.lang"
        if not path.exists():
            error(f"{label} pack: texts/en_US.lang is missing")
            continue
        keys = set()
        for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                error(f"{rel(path)}:{line_number}: lang line has no '='")
                continue
            key = line.split("=", 1)[0]
            keys.add(key)
        for required in ("pack.name", "pack.description"):
            if required not in keys:
                error(f"{rel(path)}: missing required key {required!r}")


def check_names_localised(items: set[str], blocks: set[str], entities: set[str]) -> None:
    path = RP / "texts" / "en_US.lang"
    if not path.exists():
        return
    content = path.read_text(encoding="utf-8")
    for identifier in sorted(items):
        if f"item.{identifier}=" not in content and f"item.{identifier}.name=" not in content:
            warn(f"{identifier} has no display name in en_US.lang")
    for identifier in sorted(blocks):
        if f"tile.{identifier}.name=" not in content:
            warn(f"{identifier} has no display name in en_US.lang")
    for identifier in sorted(entities):
        if f"entity.{identifier}.name=" not in content:
            warn(f"{identifier} has no display name in en_US.lang")


def check_pack_icons() -> None:
    for pack_root, label in ((BP, "behaviour"), (RP, "resource")):
        if not (pack_root / "pack_icon.png").exists():
            warn(f"{label} pack: pack_icon.png is missing")


# ------------------------------------------------------------------ main ---


def main() -> int:
    print("Validating Luxury Tech Mycelium-X ...")

    for pack_root in (BP, RP):
        for path in all_json(pack_root):
            load_json(path)

    check_manifests()
    item_keys, terrain_keys = check_atlases()
    items = check_items(item_keys)
    blocks = check_blocks(terrain_keys)
    entities = check_entities()
    check_client_entities(entities)
    check_attachables_and_particles()
    check_sounds()
    check_functions()
    check_vanilla_blocks()
    check_scripts()
    check_lang()
    check_names_localised(items, blocks, entities)
    check_orphan_textures(item_keys, terrain_keys)
    check_pack_icons()

    print(
        f"  content: {len(items)} items, {len(blocks)} blocks, {len(entities)} entities"
    )

    if WARNINGS:
        print(f"\n{len(WARNINGS)} warning(s):")
        for message in WARNINGS:
            print(f"  WARN  {message}")

    if ERRORS:
        print(f"\n{len(ERRORS)} error(s):")
        for message in ERRORS:
            print(f"  ERROR {message}")
        print("\nVALIDATION FAILED")
        return 1

    print("\nVALIDATION PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
