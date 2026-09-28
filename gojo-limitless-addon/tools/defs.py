"""Single source of truth for the Gojo Satoru - Limitless Addon.

Every generator in tools/ reads from here so item JSON, lang entries,
item_texture.json and the script-side ability table can never drift apart.
"""

ADDON_NAME = "Gojo Satoru – Limitless Addon"
VERSION = [1, 0, 0]
MIN_ENGINE = [1, 21, 0]

# Fixed UUIDs (never regenerate - Minecraft identifies packs by these).
UUID_BP_HEADER = "eaf0eb40-e436-49cf-9268-a1446312e1be"
UUID_BP_DATA = "08cabe73-a795-4f73-8543-8c7557e0c947"
UUID_BP_SCRIPT = "0e5c9a16-3048-4918-a1bf-2d60d46deaa7"
UUID_RP_HEADER = "66594258-38a3-4e4f-ac0d-5050896ea4d0"
UUID_RP_DATA = "af95e0a3-9950-4c2e-957c-f1318ac3d1a7"

# Stable Script API versions shipped in Minecraft Preview 1.21.0.26
# (1.11.0 was still a release candidate in that build).
SERVER_MODULE_VERSION = "1.10.0"
SERVER_UI_MODULE_VERSION = "1.1.0"

ITEM_FORMAT = "1.20.80"
CREATIVE_CATEGORY = "equipment"
CREATIVE_GROUP = "itemGroup.name.gojo"

# Order here == creative inventory order == hotbar loadout order.
# cooldown is in seconds and is used for BOTH the item JSON cooldown
# component (hotbar sweep overlay) and the script-side cooldown.
ITEMS = [
    {
        "key": "transformation",
        "id": "gojo:transformation",
        "name": "§f§lGojo Satoru: Transformation",
        "short": "Transformation",
        "color": "§f",
        "cooldown": 3.0,
        "kind": "transformation",
        "glint": True,
        "lore": [
            "§7Tap: become Gojo Satoru.",
            "§7Grants all 9 techniques + buffs.",
            "§7Sneak + tap: Limitless menu",
            "§8(settings, guide, release)",
        ],
    },
    {
        "key": "infinity",
        "id": "gojo:infinity",
        "name": "§bInfinity",
        "short": "Infinity",
        "color": "§b",
        "cooldown": 1.0,
        "kind": "toggle",
        "lore": [
            "§7Tap: toggle ON / OFF.",
            "§7Attacks and projectiles slow",
            "§7down and stop before reaching you.",
        ],
    },
    {
        "key": "lapse_blue",
        "id": "gojo:lapse_blue",
        "name": "§9Cursed Technique Lapse: Blue",
        "short": "Lapse: Blue",
        "color": "§9",
        "cooldown": 6.0,
        "kind": "ability",
        "lore": [
            "§7Tap: create a point of attraction",
            "§7that violently pulls in and",
            "§7crushes nearby enemies.",
        ],
    },
    {
        "key": "reversal_red",
        "id": "gojo:reversal_red",
        "name": "§cCursed Technique Reversal: Red",
        "short": "Reversal: Red",
        "color": "§c",
        "cooldown": 8.0,
        "kind": "ability",
        "lore": [
            "§7Tap: fire a repelling blast",
            "§7with massive knockback and",
            "§7area damage.",
        ],
    },
    {
        "key": "hollow_purple",
        "id": "gojo:hollow_purple",
        "name": "§5§lHollow Technique: Purple",
        "short": "Hollow Purple",
        "color": "§5",
        "cooldown": 25.0,
        "kind": "ability",
        "lore": [
            "§7Tap: merge Blue and Red into",
            "§7imaginary mass that erases",
            "§7everything in its path.",
        ],
    },
    {
        "key": "unlimited_void",
        "id": "gojo:unlimited_void",
        "name": "§d§lDomain Expansion: Unlimited Void",
        "short": "Unlimited Void",
        "color": "§d",
        "cooldown": 45.0,
        "kind": "ability",
        "lore": [
            "§7Tap: expand your domain.",
            "§7Enemies inside are paralysed",
            "§7by infinite information.",
        ],
    },
    {
        "key": "six_eyes",
        "id": "gojo:six_eyes",
        "name": "§3Six Eyes",
        "short": "Six Eyes",
        "color": "§3",
        "cooldown": 1.0,
        "kind": "toggle",
        "lore": [
            "§7Tap: toggle ON / OFF.",
            "§7Night vision, target analysis,",
            "§7+25% technique damage.",
        ],
    },
    {
        "key": "teleport",
        "id": "gojo:teleport",
        "name": "§bTeleport",
        "short": "Teleport",
        "color": "§b",
        "cooldown": 1.5,
        "kind": "ability",
        "lore": [
            "§7Tap: blink to where you look",
            "§7(up to 32 blocks). Look at an",
            "§7enemy to appear behind it.",
        ],
    },
    {
        "key": "reverse_cursed_technique",
        "id": "gojo:reverse_cursed_technique",
        "name": "§aReverse Cursed Technique",
        "short": "Reverse Cursed Technique",
        "color": "§a",
        "cooldown": 15.0,
        "kind": "ability",
        "lore": [
            "§7Tap: rapidly regenerate health",
            "§7and cleanse harmful effects.",
        ],
    },
    {
        "key": "black_flash",
        "id": "gojo:black_flash",
        "name": "§4Black Flash",
        "short": "Black Flash",
        "color": "§4",
        "cooldown": 4.0,
        "kind": "ability",
        "hand_equipped": True,
        "lore": [
            "§7Tap or hit: dash and strike",
            "§7with distorted cursed energy.",
            "§7Chain hits to enter the Zone.",
        ],
    },
    {
        "key": "blindfold",
        "id": "gojo:blindfold",
        "name": "§fGojo's Blindfold",
        "short": "Blindfold",
        "color": "§f",
        "kind": "wearable",
        "lore": [
            "§7Wear on your head.",
            "§7Lifts automatically while",
            "§7Six Eyes is active.",
        ],
    },
    {
        "key": "blindfold_lifted",
        "id": "gojo:blindfold_lifted",
        "name": "§fGojo's Blindfold §3(Six Eyes)",
        "short": "Blindfold (lifted)",
        "color": "§f",
        "kind": "wearable",
        "hidden": True,
        "lore": [
            "§7Six Eyes unveiled.",
        ],
    },
]

# The nine techniques placed on the hotbar by the transformation (slot 0..8).
LOADOUT = [
    "infinity",
    "lapse_blue",
    "reversal_red",
    "hollow_purple",
    "unlimited_void",
    "six_eyes",
    "teleport",
    "reverse_cursed_technique",
    "black_flash",
]


def icon_key(item):
    return "gojo_" + item["key"]


def icon_path(item):
    return "textures/items/gojo/" + item["key"]


def lang_key(item):
    return "item.gojo." + item["key"]
