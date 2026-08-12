#!/usr/bin/env python3
"""Writes the player-facing .mcfunction entry points and both lang files.

Most entry points are one-liners that raise a script event, because the logic
lives in scripts/. Keeping them generated means the command list, the in-game
help text and the README can never drift apart.

Run: python3 tools/gen_functions.py
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "src" / "behavior_pack"
RP = ROOT / "src" / "resource_pack"


def tellraw(text: str) -> str:
    """Bedrock tellraw takes a rawtext object, not a Java text component."""
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'tellraw @s {{"rawtext":[{{"text":"{escaped}"}}]}}'


# name -> (description, body lines)
FUNCTIONS: dict[str, tuple[str, list[str]]] = {
    "tech_house": (
        "Deploy the luxury tech mansion at your position (paced over ticks).",
        [
            tellraw("§b[TECH MANSION] §7Surveying site..."),
            "scriptevent myc:build",
        ],
    ),
    "tech_house_now": (
        "Deploy the mansion as fast as the game allows. Heavier on mobile.",
        [
            tellraw("§b[TECH MANSION] §7Fast deployment - expect a brief pause."),
            "scriptevent myc:build_now",
        ],
    ),
    "tech_house_clear": (
        "Remove the deployed mansion.",
        ["scriptevent myc:clear"],
    ),
    "outbreak_start": (
        "Begin the Mycelium-X outbreak. Danger rises each Minecraft day.",
        ["scriptevent myc:outbreak_start"],
    ),
    "outbreak_stop": (
        "End the outbreak, clear infection and remove all infected.",
        ["scriptevent myc:outbreak_stop"],
    ),
    "outbreak_status": (
        "Print the current outbreak report.",
        ["scriptevent myc:outbreak_status"],
    ),
    "house_lockdown": (
        "Seal the mansion: shutters down, alarms on, emergency lighting.",
        ["scriptevent myc:lockdown"],
    ),
    "house_unlock": (
        "Release lockdown and restore normal lighting.",
        ["scriptevent myc:unlock"],
    ),
    "scan": (
        "Run a Mycelium-X scan without holding the scanner.",
        ["scriptevent myc:scan"],
    ),
    "nest_here": (
        "Plant a fungal nest and contaminated zone at your feet.",
        ["scriptevent myc:nest"],
    ),
    "cure_me": (
        "Clear your own infection.",
        ["scriptevent myc:cure"],
    ),
    "infect_me": (
        "Raise your own infection by 25 (for testing).",
        ["scriptevent myc:infect 25"],
    ),
    "myc_help": (
        "List every command in chat.",
        ["scriptevent myc:help"],
    ),
    "give_kit": (
        "Give yourself the full survival equipment kit.",
        [
            "give @s myc:scanner 1",
            "give @s myc:contamination_detector 1",
            "give @s myc:spore_mask 1",
            "give @s myc:protective_suit 1",
            "give @s myc:medkit 4",
            "give @s myc:suppressant 3",
            "give @s myc:biofilter 6",
            tellraw("§a[SUPPLY] §7Equipment kit issued. Wear the mask and suit."),
            tellraw("§7Hold the scanner and §fsneak§7, or tap with it, to scan."),
        ],
    ),
}


ITEM_NAMES = {
    "myc:scanner": "Mycelium-X Scanner",
    "myc:contamination_detector": "Contamination Detector",
    "myc:medkit": "Emergency Medical Kit",
    "myc:suppressant": "Mycelium Suppressant",
    "myc:biofilter": "Biofilter Cartridge",
    "myc:spore_sample": "Mycelium-X Spore Sample",
    "myc:spore_mask": "Spore Mask",
    "myc:protective_suit": "Protective Suit",
}

BLOCK_NAMES = {
    "myc:clean_panel": "Clean Wall Panel",
    "myc:screen": "Wall Display",
    "myc:server_rack": "Server Rack",
    "myc:lab_panel": "Laboratory Panel",
    "myc:control_panel": "Control Panel",
    "myc:alarm_light": "Alarm Light",
    "myc:alarm_light_on": "Alarm Light (Active)",
    "myc:emergency_light": "Emergency Light",
    "myc:fungal_growth": "Fungal Growth",
    "myc:infected_block": "Infected Stone",
    "myc:nest": "Fungal Nest",
    "myc:spore_vent": "Spore Vent",
}

ENTITY_NAMES = {
    "myc:infected_walker": "Infected Walker",
    "myc:infected_runner": "Infected Runner",
    "myc:fungal_brute": "Fungal Brute",
    "myc:spore_crawler": "Spore Crawler",
    "myc:mycelium_stalker": "Mycelium Stalker",
    "myc:nest_core": "Fungal Nest Core",
}


def write_functions() -> int:
    target = BP / "functions"
    target.mkdir(parents=True, exist_ok=True)
    for name, (description, body) in FUNCTIONS.items():
        lines = [f"# {description}", ""]
        lines.extend(body)
        (target / f"{name}.mcfunction").write_text("\n".join(lines) + "\n")
    return len(FUNCTIONS)


def write_lang() -> None:
    bp_lines = [
        "pack.name=Luxury Tech Mansion + Mycelium-X [Behaviour]",
        "pack.description=Mansion deployment, smart-home systems, the Mycelium-X "
        "outbreak, infected mobs and protective equipment.",
    ]
    (BP / "texts").mkdir(parents=True, exist_ok=True)
    (BP / "texts" / "en_US.lang").write_text("\n".join(bp_lines) + "\n")
    (BP / "texts" / "languages.json").write_text('[\n  "en_US"\n]\n')

    rp_lines = [
        "pack.name=Luxury Tech Mansion + Mycelium-X [Resources]",
        "pack.description=Textures, models, animations and sounds for the Luxury "
        "Tech Mansion and the Mycelium-X outbreak.",
        "",
        "## Items",
    ]
    for identifier, label in ITEM_NAMES.items():
        # Bedrock has used both of these keys for custom items across releases;
        # emitting both means the name resolves either way.
        rp_lines.append(f"{'item.' + identifier}={label}")
        rp_lines.append(f"{'item.' + identifier}.name={label}")

    rp_lines += ["", "## Blocks"]
    for identifier, label in BLOCK_NAMES.items():
        rp_lines.append(f"tile.{identifier}.name={label}")

    rp_lines += ["", "## Entities"]
    for identifier, label in ENTITY_NAMES.items():
        rp_lines.append(f"entity.{identifier}.name={label}")

    (RP / "texts").mkdir(parents=True, exist_ok=True)
    (RP / "texts" / "en_US.lang").write_text("\n".join(rp_lines) + "\n")
    (RP / "texts" / "languages.json").write_text('[\n  "en_US"\n]\n')


def main() -> None:
    count = write_functions()
    write_lang()
    print(
        f"wrote {count} functions, 2 lang files "
        f"({len(ITEM_NAMES)} items, {len(BLOCK_NAMES)} blocks, {len(ENTITY_NAMES)} entities)"
    )


if __name__ == "__main__":
    main()
