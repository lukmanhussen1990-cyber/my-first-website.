"""Shared data tables describing the NPC Kingdom add-on.

Both pack generators import from here so identifiers, colours, names and
gameplay numbers can never drift apart.
"""

NAMESPACE = "npck"

# ---------------------------------------------------------------------------
# Mobs
# ---------------------------------------------------------------------------
ROLES = [
    "builder", "farmer", "miner", "lumberjack", "guard", "archer", "knight",
    "healer", "merchant", "blacksmith", "royal_guard", "general", "advisor",
]
ENEMIES = [
    "bandit", "raider", "dark_knight", "undead_soldier", "enemy_archer",
    "enemy_wizard",
]
BOSSES = ["bandit_king", "dark_wizard", "undead_emperor"]
ALL_MOBS = ROLES + ENEMIES + BOSSES

MARKERS = ["m_tap", "m_rally", "m_talk", "m_core", "throne_seat"]

SPAWN_EGG_COLORS = {
    "builder":        ("#9A6B3A", "#E0A81E"),
    "farmer":         ("#7FA24A", "#D9BE6A"),
    "miner":          ("#4A4A56", "#C24A22"),
    "lumberjack":     ("#B0392F", "#4A5A38"),
    "guard":          ("#B4B4BE", "#2F5BA8"),
    "archer":         ("#3E6B38", "#2F5A2C"),
    "knight":         ("#C6C6D2", "#B0302A"),
    "healer":         ("#EFEFE6", "#C63A32"),
    "merchant":       ("#6B3E8E", "#F0C64A"),
    "blacksmith":     ("#8A5A2E", "#3A2A20"),
    "royal_guard":    ("#F0C64A", "#6B2A8E"),
    "general":        ("#7A1E1E", "#F0C64A"),
    "advisor":        ("#2F4A8E", "#EFEFE6"),
    "bandit":         ("#4A3A2A", "#2E2418"),
    "raider":         ("#54324A", "#7A2A2A"),
    "dark_knight":    ("#2A2A34", "#7A1414"),
    "undead_soldier": ("#5A6B4A", "#6B6B60"),
    "enemy_archer":   ("#2E3A2A", "#1E2A1A"),
    "enemy_wizard":   ("#46226B", "#9AE0FF"),
    "bandit_king":    ("#6B4A22", "#F0C64A"),
    "dark_wizard":    ("#1E1030", "#D86AFF"),
    "undead_emperor": ("#4A4438", "#F0C64A"),
}

# role -> (health, attack damage, movement speed, class, work tag)
ROLE_STATS = {
    "builder":     (20, 2, 0.26, "worker",   "build"),
    "farmer":      (20, 2, 0.25, "worker",   "farm"),
    "miner":       (22, 3, 0.25, "worker",   "mine"),
    "lumberjack":  (22, 3, 0.26, "worker",   "chop"),
    "guard":       (30, 5, 0.28, "soldier",  "patrol"),
    "archer":      (24, 3, 0.27, "soldier",  "shoot"),
    "knight":      (40, 7, 0.26, "soldier",  "patrol"),
    "healer":      (20, 1, 0.27, "support",  "heal"),
    "merchant":    (20, 1, 0.25, "civilian", "trade"),
    "blacksmith":  (24, 3, 0.25, "worker",   "forge"),
    "royal_guard": (44, 8, 0.30, "soldier",  "escort"),
    "general":     (50, 9, 0.29, "soldier",  "command"),
    "advisor":     (20, 1, 0.25, "civilian", "advise"),
}

# enemy -> (health, damage, speed, ranged projectile or None, wave tier)
ENEMY_STATS = {
    "bandit":         (20, 4, 0.30, None, 1),
    "raider":         (26, 5, 0.31, None, 2),
    "undead_soldier": (24, 4, 0.24, None, 2),
    "enemy_archer":   (18, 3, 0.29, "minecraft:arrow", 3),
    "dark_knight":    (40, 8, 0.28, None, 4),
    "enemy_wizard":   (22, 5, 0.27, "minecraft:shulker_bullet", 4),
}

# boss -> (health, damage, speed, scale, projectile, display name)
BOSS_STATS = {
    "bandit_king":    (200, 12, 0.32, 1.2, None, "Bandit King"),
    "dark_wizard":    (180, 9, 0.30, 1.15, "minecraft:shulker_bullet", "Dark Wizard"),
    "undead_emperor": (300, 14, 0.28, 1.4, None, "Undead Emperor"),
}

# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
# (id, key, display name, mark_variant used for the animation state)
ORDERS = [
    (0, "work", "Work", 1),
    (1, "follow", "Follow Me", 0),
    (2, "stay", "Stay Here", 0),
    (3, "patrol", "Patrol This Area", 5),
    (4, "defend", "Defend The Kingdom", 5),
    (5, "attack", "Attack Target", 5),
    (6, "retreat", "Retreat", 0),
    (7, "gather", "Gather Resources", 1),
    (8, "build", "Build", 4),
    (9, "repair", "Repair", 4),
    (10, "home", "Return Home", 0),
    (11, "celebrate", "Celebrate", 2),
]
ORDER_BY_KEY = {o[1]: o for o in ORDERS}

# ---------------------------------------------------------------------------
# Kingdom levels
# ---------------------------------------------------------------------------
# level -> (name, requirements to reach the NEXT level)
LEVELS = {
    1: ("Camp", {"wood": 64, "stone": 32, "food": 32, "iron": 0, "gold": 0, "emerald": 0}),
    2: ("Village", {"wood": 160, "stone": 128, "food": 96, "iron": 16, "gold": 0, "emerald": 0}),
    3: ("Town", {"wood": 320, "stone": 256, "food": 192, "iron": 64, "gold": 24, "emerald": 8}),
    4: ("City", {"wood": 512, "stone": 512, "food": 384, "iron": 128, "gold": 64, "emerald": 32}),
    5: ("Kingdom", None),
}

RESOURCES = ["food", "wood", "stone", "iron", "gold", "emerald"]
RESOURCE_LABELS = {
    "food": "Food", "wood": "Wood", "stone": "Stone",
    "iron": "Iron", "gold": "Gold", "emerald": "Emeralds",
}

# ---------------------------------------------------------------------------
# Buildings: id -> (display name, required level, dx, dz)
# ---------------------------------------------------------------------------
BUILDINGS = [
    ("house_1",         "Small House",     1, -12, -12),
    ("house_2",         "Small House",     1,  12, -12),
    ("storage",         "Storage Building",1, -16,   0),
    ("house_3",         "Small House",     2, -12,  12),
    ("house_4",         "Small House",     2,  12,  12),
    ("farm",            "Farm",            2,  20,  20),
    ("town_hall",       "Town Hall",       3,   0, -16),
    ("market",          "Market",          3,  16,   0),
    ("blacksmith",      "Blacksmith",      3, -28,   0),
    ("guard_tower",     "Guard Tower",     3,  20, -20),
    ("barracks",        "Barracks",        4, -20, -20),
    ("training_ground", "Training Ground", 4,  28,   0),
    ("hospital",        "Hospital",        4, -20,  20),
    ("stable",          "Stable",          4,   0, -28),
    ("prison",          "Prison",          4,   0,  28),
    ("walls",           "Defensive Walls", 4,   0,   0),
    ("main_gate",       "Main Gate",       4,   0, -38),
    ("castle",          "Castle",          5,   0,  16),
    ("throne_room",     "Throne Room",     5,   0,  16),
    ("treasury",        "Treasury",        5,  30,  20),
]

# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
ITEMS = [
    {"id": "npck:core_stone", "name": "Kingdom Core", "texture": "kingdom_core",
     "category": "items", "group": "itemGroup.name.egg", "stack": 1},
    {"id": "npck:command_staff", "name": "Royal Command Staff", "texture": "command_staff",
     "category": "equipment", "group": "itemGroup.name.sword", "stack": 1, "hand": True},
    {"id": "npck:command_banner", "name": "Royal Command Banner", "texture": "command_banner",
     "category": "equipment", "group": "itemGroup.name.banner", "stack": 1, "hand": True},
    {"id": "npck:royal_ledger", "name": "Royal Ledger", "texture": "royal_ledger",
     "category": "items", "group": "itemGroup.name.miscFood", "stack": 1},
    {"id": "npck:celebration_horn", "name": "Celebration Horn", "texture": "celebration_horn",
     "category": "items", "group": "itemGroup.name.miscFood", "stack": 1, "hand": True},
    {"id": "npck:war_horn", "name": "War Horn", "texture": "war_horn",
     "category": "items", "group": "itemGroup.name.miscFood", "stack": 1, "hand": True},
    {"id": "npck:royal_crown", "name": "Royal Crown", "texture": "royal_crown",
     "category": "equipment", "group": "itemGroup.name.helmet", "stack": 1,
     "armor": ("slot.armor.head", 4, 220, "armor_head")},
    {"id": "npck:royal_chestplate", "name": "Royal Chestplate", "texture": "royal_chestplate",
     "category": "equipment", "group": "itemGroup.name.chestplate", "stack": 1,
     "armor": ("slot.armor.chest", 8, 320, "armor_torso")},
    {"id": "npck:royal_leggings", "name": "Royal Leggings", "texture": "royal_leggings",
     "category": "equipment", "group": "itemGroup.name.leggings", "stack": 1,
     "armor": ("slot.armor.legs", 6, 300, "armor_legs")},
    {"id": "npck:royal_boots", "name": "Royal Boots", "texture": "royal_boots",
     "category": "equipment", "group": "itemGroup.name.boots", "stack": 1,
     "armor": ("slot.armor.feet", 4, 260, "armor_feet")},
]

# ---------------------------------------------------------------------------
# Dialogue
# ---------------------------------------------------------------------------
DIALOGUE = {
    "builder":     ["My king, what are your orders?", "The walls need repairs.",
                    "I'll have it standing by nightfall."],
    "farmer":      ["The harvest is ready.", "Good soil, good kingdom.",
                    "I'll gather resources."],
    "miner":       ["I'll gather resources.", "There is iron in these rocks.",
                    "My pick is sharp, my king."],
    "lumberjack":  ["I'll gather resources.", "Timber for the kingdom!",
                    "These woods will serve us well."],
    "guard":       ["Enemy spotted!", "The gate is secure, my king.",
                    "For the kingdom!"],
    "archer":      ["My arrows are ready.", "Enemy spotted!",
                    "Nothing gets past the wall."],
    "knight":      ["For the kingdom!", "Point me at the enemy.",
                    "I fear no dark knight."],
    "healer":      ["Rest, and be well.", "None shall fall today.",
                    "Bring me the wounded."],
    "merchant":    ["Fine goods, fair prices!", "Our kingdom is growing!",
                    "Trade brings prosperity."],
    "blacksmith":  ["The forge is hot, my king.", "Steel for the army!",
                    "I can arm every soldier you send me."],
    "royal_guard": ["My king, what are your orders?", "I will not leave your side.",
                    "Stay behind me, your grace."],
    "general":     ["The army awaits your command.", "For the kingdom!",
                    "Give the word and we march."],
    "advisor":     ["Our kingdom is growing!", "Shall I read you the ledger?",
                    "Wise rulers plan for winter."],
}

# ---------------------------------------------------------------------------
def pretty(identifier):
    special = {
        "npc": "NPC",
        "m": "Marker",
    }
    words = []
    for part in identifier.split("_"):
        words.append(special.get(part, part.capitalize()))
    return " ".join(words)


def hostile_filter():
    return {
        "any_of": [
            {"test": "is_family", "subject": "other", "value": "monster"},
            {"test": "is_family", "subject": "other", "value": "illager"},
            {"test": "is_family", "subject": "other", "value": "npck_enemy"},
        ]
    }


def friendly_filter():
    return {
        "any_of": [
            {"test": "is_family", "subject": "other", "value": "player"},
            {"test": "is_family", "subject": "other", "value": "villager"},
            {"test": "is_family", "subject": "other", "value": "npck_friendly"},
            {"test": "is_family", "subject": "other", "value": "irongolem"},
        ]
    }
