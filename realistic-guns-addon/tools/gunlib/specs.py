"""Single source of truth for every gun, magazine and ammo item.

Everything the generator writes (items, attachables, animations, recipes,
icons, sounds) and the gameplay data module used by the script
(scripts/gun_data.js) is derived from these tables.
"""
from .guns_ak import build_ak47, build_m4a1
from .guns_pistol import build_glock17, build_deagle
from .guns_smg import build_mp5, build_uzi
from .guns_sniper import build_awp, build_barrett
from .guns_heavy import build_spas12, build_m249

NS = "rg"

# Ammo boxes (crafted from vanilla items, used to craft magazines)
AMMO = [
    {"id": "ammo_9mm", "name": "9mm Rounds", "lore": "Pistol / SMG ammunition", "count": 16,
     "colors": ((196, 160, 70), (184, 112, 60)), "recipe": ["iron_ingot", "gunpowder", "copper_ingot"]},
    {"id": "ammo_556", "name": "5.56mm NATO Rounds", "lore": "M4A1 / M249 ammunition", "count": 12,
     "colors": ((206, 168, 74), (180, 110, 58)), "recipe": ["iron_ingot", "gunpowder", "gunpowder", "copper_ingot"]},
    {"id": "ammo_762", "name": "7.62mm Rounds", "lore": "AK-47 / AWP ammunition", "count": 10,
     "colors": ((190, 150, 64), (150, 96, 52)), "recipe": ["iron_ingot", "iron_ingot", "gunpowder", "gunpowder", "copper_ingot"]},
    {"id": "ammo_50", "name": ".50 Cal Rounds", "lore": "Desert Eagle / Barrett ammunition", "count": 6,
     "colors": ((212, 172, 80), (120, 120, 126)), "recipe": ["iron_ingot", "iron_ingot", "gunpowder", "gunpowder", "gunpowder", "copper_ingot"]},
    {"id": "shell_12g", "name": "12 Gauge Shells", "lore": "SPAS-12 ammunition (one shell = one round)",
     "count": 8, "colors": ((200, 36, 32), (200, 162, 72)), "recipe": ["paper", "gunpowder", "copper_ingot"]},
]

# fp = first-person grip position in camera space (px), aim = convergence distance (px)
# kick = (back px, muzzle-up deg, duration ticks), cycle = bolt/pump animation ticks
GUNS = [
    {
        "id": "ak47", "name": "AK-47", "kind": "Assault Rifle", "builder": build_ak47,
        "ammo": "ammo_762", "mag": "mag_ak47", "mag_name": "AK-47 Magazine (30)", "capacity": 30,
        "mag_ammo_cost": 3, "damage": 7.0, "pellets": 1, "headshot": 1.6, "rpm": 600, "auto": True,
        "spread": 1.6, "range": 96, "velocity": 6.0, "recoil": (1.25, 0.55), "shake": 0.045,
        "reload_ticks": 50, "kick": (0.9, 3.0, 3), "melee": 4,
        "fp": {"grip": (6.2, -6.9, 9.6), "aim": 150, "bore": 1.9, "roll": -2},
        "recoil_pivot": (0, 1.6, -4.0), "mag_drop": 6.5,
        "sound": {"type": "rifle", "pitch": 0.95, "body": 1.0, "crack": 1.0, "tail": 0.55, "seed": 11},
        "recipe": ["III", "WGI", " M "], "recipe_key": {"I": "iron_ingot", "W": "planks",
                                                       "G": "gunpowder", "M": "iron_block"},
    },
    {
        "id": "m4a1", "name": "M4A1", "kind": "Assault Rifle", "builder": build_m4a1,
        "ammo": "ammo_556", "mag": "mag_m4a1", "mag_name": "M4A1 STANAG Magazine (30)", "capacity": 30,
        "mag_ammo_cost": 3, "damage": 6.0, "pellets": 1, "headshot": 1.6, "rpm": 800, "auto": True,
        "spread": 1.2, "range": 96, "velocity": 6.5, "recoil": (0.95, 0.4), "shake": 0.035,
        "reload_ticks": 44, "kick": (0.7, 2.4, 3), "melee": 4,
        "fp": {"grip": (6.0, -6.8, 9.5), "aim": 150, "bore": 1.95, "roll": -2},
        "recoil_pivot": (0, 1.8, -4.0), "mag_drop": 6.0,
        "sound": {"type": "rifle", "pitch": 1.12, "body": 0.85, "crack": 1.15, "tail": 0.5, "seed": 12},
        "recipe": ["III", "QGI", " M "], "recipe_key": {"I": "iron_ingot", "Q": "quartz",
                                                       "G": "gunpowder", "M": "iron_block"},
    },
    {
        "id": "deagle", "name": "Desert Eagle", "kind": "Pistol", "builder": build_deagle,
        "ammo": "ammo_50", "mag": "mag_deagle", "mag_name": "Desert Eagle Magazine (7)", "capacity": 7,
        "mag_ammo_cost": 2, "damage": 12.0, "pellets": 1, "headshot": 1.75, "rpm": 240, "auto": False,
        "spread": 1.0, "range": 64, "velocity": 5.0, "recoil": (4.5, 1.2), "shake": 0.09,
        "reload_ticks": 36, "kick": (1.1, 9.0, 5), "melee": 3,
        "fp": {"grip": (4.7, -5.4, 10.4), "aim": 120, "bore": 1.85, "roll": 0},
        "recoil_pivot": (0, -1.0, -1.0), "mag_drop": 5.0,
        "sound": {"type": "magnum", "pitch": 0.85, "body": 1.25, "crack": 1.1, "tail": 0.7, "seed": 21},
        "recipe": ["II ", "IG ", " I "], "recipe_key": {"I": "iron_ingot", "G": "gold_ingot"},
    },
    {
        "id": "glock17", "name": "Glock 17", "kind": "Pistol", "builder": build_glock17,
        "ammo": "ammo_9mm", "mag": "mag_glock17", "mag_name": "Glock 17 Magazine (17)", "capacity": 17,
        "mag_ammo_cost": 2, "damage": 5.0, "pellets": 1, "headshot": 1.75, "rpm": 400, "auto": False,
        "spread": 1.2, "range": 56, "velocity": 5.0, "recoil": (1.8, 0.6), "shake": 0.04,
        "reload_ticks": 28, "kick": (0.8, 6.0, 4), "melee": 3,
        "fp": {"grip": (4.6, -5.3, 10.2), "aim": 120, "bore": 1.8, "roll": 0},
        "recoil_pivot": (0, -1.0, -1.0), "mag_drop": 5.0,
        "sound": {"type": "pistol", "pitch": 1.15, "body": 0.8, "crack": 1.0, "tail": 0.45, "seed": 22},
        "recipe": ["II ", "IP ", " I "], "recipe_key": {"I": "iron_ingot", "P": "black_dye"},
    },
    {
        "id": "awp", "name": "AWP", "kind": "Sniper Rifle", "builder": build_awp,
        "ammo": "ammo_762", "mag": "mag_awp", "mag_name": "AWP Magazine (5)", "capacity": 5,
        "mag_ammo_cost": 2, "damage": 30.0, "pellets": 1, "headshot": 2.0, "rpm": 40, "auto": False,
        "spread": 4.0, "spread_scoped": 0.0, "range": 220, "velocity": 9.0, "recoil": (6.5, 1.5),
        "shake": 0.12, "reload_ticks": 64, "kick": (1.6, 7.0, 6), "cycle_ticks": 30, "melee": 4,
        "zoom_fov": 24, "fp": {"grip": (6.4, -7.2, 10.2), "aim": 170, "bore": 2.1, "roll": -2},
        "recoil_pivot": (0, 2.0, -5.0), "mag_drop": 5.0,
        "sound": {"type": "sniper", "pitch": 0.8, "body": 1.4, "crack": 1.3, "tail": 1.2, "seed": 31},
        "recipe": ["GII", "SIB", " M "], "recipe_key": {"G": "glass_pane", "I": "iron_ingot",
                                                       "S": "green_dye", "B": "iron_block",
                                                       "M": "gunpowder"},
    },
    {
        "id": "barrett", "name": "Barrett M82", "kind": "Heavy Sniper", "builder": build_barrett,
        "ammo": "ammo_50", "mag": "mag_barrett", "mag_name": "Barrett M82 Magazine (10)", "capacity": 10,
        "mag_ammo_cost": 3, "damage": 40.0, "pellets": 1, "headshot": 2.0, "rpm": 120, "auto": False,
        "spread": 5.0, "spread_scoped": 0.0, "range": 260, "velocity": 9.5, "recoil": (9.0, 2.0),
        "shake": 0.2, "reload_ticks": 76, "kick": (2.2, 9.0, 8), "melee": 5,
        "zoom_fov": 18, "fp": {"grip": (6.8, -7.7, 10.8), "aim": 180, "bore": 2.2, "roll": -2},
        "recoil_pivot": (0, 2.0, -6.0), "mag_drop": 5.5,
        "sound": {"type": "heavy", "pitch": 0.62, "body": 1.7, "crack": 1.5, "tail": 1.5, "seed": 32},
        "recipe": ["GBB", "IIB", " M "], "recipe_key": {"G": "glass_pane", "B": "iron_block",
                                                       "I": "iron_ingot", "M": "gunpowder"},
    },
    {
        "id": "mp5", "name": "MP5", "kind": "Submachine Gun", "builder": build_mp5,
        "ammo": "ammo_9mm", "mag": "mag_mp5", "mag_name": "MP5 Magazine (30)", "capacity": 30,
        "mag_ammo_cost": 3, "damage": 4.5, "pellets": 1, "headshot": 1.6, "rpm": 800, "auto": True,
        "spread": 1.9, "range": 64, "velocity": 5.0, "recoil": (0.7, 0.45), "shake": 0.03,
        "reload_ticks": 40, "kick": (0.6, 2.0, 3), "melee": 3,
        "fp": {"grip": (5.6, -6.4, 9.4), "aim": 130, "bore": 1.75, "roll": -2},
        "recoil_pivot": (0, 1.5, -3.5), "mag_drop": 5.5,
        "sound": {"type": "smg", "pitch": 1.2, "body": 0.7, "crack": 0.9, "tail": 0.4, "seed": 41},
        "recipe": ["III", " GI", "  I"], "recipe_key": {"I": "iron_ingot", "G": "gunpowder"},
    },
    {
        "id": "uzi", "name": "UZI", "kind": "Submachine Gun", "builder": build_uzi,
        "ammo": "ammo_9mm", "mag": "mag_uzi", "mag_name": "UZI Magazine (32)", "capacity": 32,
        "mag_ammo_cost": 4, "damage": 4.0, "pellets": 1, "headshot": 1.6, "rpm": 600, "auto": True,
        "spread": 2.6, "range": 52, "velocity": 5.0, "recoil": (0.85, 0.6), "shake": 0.03,
        "reload_ticks": 36, "kick": (0.6, 2.5, 3), "melee": 3,
        "fp": {"grip": (5.0, -5.8, 10.0), "aim": 120, "bore": 1.75, "roll": 0},
        "recoil_pivot": (0, -1.0, -1.5), "mag_drop": 5.0,
        "sound": {"type": "smg", "pitch": 1.05, "body": 0.75, "crack": 0.85, "tail": 0.4, "seed": 42},
        "recipe": ["III", " IG", " I "], "recipe_key": {"I": "iron_ingot", "G": "gunpowder"},
    },
    {
        "id": "spas12", "name": "SPAS-12", "kind": "Shotgun", "builder": build_spas12,
        "ammo": "shell_12g", "mag": "shell_12g", "mag_name": None, "capacity": 8,
        "mag_ammo_cost": 0, "damage": 3.5, "pellets": 8, "headshot": 1.4, "rpm": 100, "auto": False,
        "spread": 5.5, "range": 32, "velocity": 4.5, "recoil": (5.0, 1.4), "shake": 0.1,
        "reload_ticks": 12, "shell_reload": True, "kick": (1.4, 8.0, 6), "cycle_ticks": 12,
        "melee": 4, "fp": {"grip": (6.0, -6.9, 9.6), "aim": 140, "bore": 2.3, "roll": -2},
        "recoil_pivot": (0, 1.8, -4.0), "mag_drop": 3.0,
        "sound": {"type": "shotgun", "pitch": 0.78, "body": 1.6, "crack": 0.8, "tail": 0.9, "seed": 51},
        "recipe": ["III", "BGI", " W "], "recipe_key": {"I": "iron_ingot", "B": "iron_block",
                                                       "G": "gunpowder", "W": "black_dye"},
    },
    {
        "id": "m249", "name": "M249", "kind": "Light Machine Gun", "builder": build_m249,
        "ammo": "ammo_556", "mag": "mag_m249", "mag_name": "M249 Ammo Box (100)", "capacity": 100,
        "mag_ammo_cost": 8, "damage": 6.0, "pellets": 1, "headshot": 1.5, "rpm": 850, "auto": True,
        "spread": 2.2, "range": 100, "velocity": 6.5, "recoil": (0.85, 0.65), "shake": 0.05,
        "reload_ticks": 90, "kick": (0.8, 2.2, 3), "melee": 5,
        "fp": {"grip": (6.4, -7.3, 10.0), "aim": 150, "bore": 2.15, "roll": -2},
        "recoil_pivot": (0, 1.8, -4.5), "mag_drop": 4.5,
        "sound": {"type": "lmg", "pitch": 1.0, "body": 1.1, "crack": 1.05, "tail": 0.65, "seed": 61},
        "recipe": ["IIB", "IGB", "M M"], "recipe_key": {"I": "iron_ingot", "B": "iron_block",
                                                       "G": "gunpowder", "M": "iron_ingot"},
    },
]

GUN_BY_ID = {g["id"]: g for g in GUNS}


def fire_interval_ticks(g):
    return 1200.0 / g["rpm"]
