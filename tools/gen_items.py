#!/usr/bin/env python3
"""Generate every custom item, marker item, recipe, chest loot table, lang entry
and the item-use detection function for Lost Island: Abandoned.

Target: Minecraft Bedrock 1.21.0 (Beta 1.21.0.26).
Only item components that are stable (non-experimental) in 1.21.0 are emitted:
  minecraft:icon (string-texture form), minecraft:display_name,
  minecraft:max_stack_size, minecraft:food, minecraft:use_modifiers,
  minecraft:hand_equipped, minecraft:damage, minecraft:glint,
  minecraft:allow_off_hand, minecraft:tags, minecraft:cooldown
No 1.21.10+ components, no minecraft:custom_components, no script API.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "build", "Lost_Island_BP")
RP = os.path.join(ROOT, "build", "Lost_Island_RP")
OUT = os.path.join(ROOT, "tools", "out")

ITEM_FV = "1.20.50"
RECIPE_FV = "1.20.10"

# ---------------------------------------------------------------------------
# Item table.
#   id, display name, texture short name, menu category, stack, kind
# kind:
#   "use"  -> activatable: gets minecraft:food + using_converts_to marker
#   "mat"  -> plain material, no activation
#   "tool" -> activatable AND hand_equipped/damage
# ---------------------------------------------------------------------------
ITEMS = [
    # id                 display                        category      stack kind  extra
    ("clean_water",      "Clean Water",                 "items",       8,  "use", {}),
    ("dirty_water",      "Dirty Water",                 "items",       8,  "use", {}),
    ("boiled_water",     "Purified Water",              "items",       8,  "use", {}),
    ("canned_beans",     "Canned Beans",                "items",      16,  "use", {}),
    ("canned_meat",      "Canned Meat",                 "items",      16,  "use", {}),
    ("bandage",          "Bandage",                     "items",      16,  "use", {}),
    ("first_aid",        "First Aid Kit",               "items",       4,  "use", {}),
    ("cloth",            "Cloth",                       "items",      32,  "mat", {}),
    ("rope",             "Rope",                        "items",      16,  "mat", {}),
    ("scrap",            "Scrap Metal",                 "items",      32,  "mat", {}),
    ("battery",          "Battery",                     "items",      16,  "use", {}),
    ("flashlight_off",   "Flashlight",                  "equipment",   1,  "use", {"hand": True}),
    ("flashlight_on",    "Flashlight (On)",             "equipment",   1,  "use", {"hand": True, "glint": True}),
    ("crowbar",          "Crowbar",                     "equipment",   1,  "use", {"hand": True, "damage": 4}),
    ("keycard",          "Research Keycard",            "equipment",   1,  "use", {"glint": True}),
    ("bunker_key",       "Bunker Key",                  "equipment",   1,  "use", {"glint": True}),
    ("radio_part",       "Radio Component",             "equipment",   1,  "use", {}),
    ("fuel_can",         "Fuel Can",                    "equipment",   1,  "use", {}),
    ("mech_part",        "Mechanical Component",        "equipment",   1,  "use", {}),
    ("nav_gear",         "Navigation Equipment",        "equipment",   1,  "use", {}),
    ("flare",            "Emergency Flare",             "equipment",   4,  "use", {"hand": True}),
    ("documents",        "Research Documents",          "items",      16,  "use", {}),
    ("matches",          "Matches",                     "items",      16,  "use", {}),
    ("setup_tool",       "Lost Island - Start Kit",     "equipment",   1,  "use", {"glint": True}),
    ("debug_tool",       "Lost Island - Debug Wand",    "equipment",   1,  "use", {"glint": True}),
]

# Items whose "used" marker must NOT hand the item back (truly consumed).
CONSUMED = {
    "clean_water", "dirty_water", "boiled_water", "canned_beans", "canned_meat",
    "bandage", "first_aid", "battery", "flare", "matches",
}
# flashlight pair is handled specially (toggle), setup/debug are re-given.


def w(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def item_json(ident, display, category, stack, kind, extra, marker=False):
    comp = {
        "minecraft:icon": "li_" + ident,
        "minecraft:display_name": {"value": display},
        "minecraft:max_stack_size": 1 if marker else stack,
    }
    if marker:
        desc_cat = {"category": "none"}
    else:
        desc_cat = {"category": category}
    if not marker:
        if kind in ("use", "tool"):
            # The only reliable no-script "on use" hook in 1.21.0: a food item
            # that converts into a marker item, which a function detects.
            comp["minecraft:food"] = {
                "nutrition": extra.get("nutrition", 0),
                "saturation_modifier": extra.get("sat", 0.6),
                "can_always_eat": True,
                "using_converts_to": "li:%s_used" % ident,
            }
            comp["minecraft:use_modifiers"] = {
                "use_duration": extra.get("use_duration", 0.9),
                "movement_modifier": 0.35,
            }
        if extra.get("hand"):
            comp["minecraft:hand_equipped"] = True
        if extra.get("damage"):
            comp["minecraft:damage"] = extra["damage"]
        if extra.get("glint"):
            comp["minecraft:glint"] = True
        comp["minecraft:allow_off_hand"] = True
        comp["minecraft:tags"] = {"tags": ["li:lost_island"]}
    else:
        comp["minecraft:tags"] = {"tags": ["li:marker"]}

    return {
        "format_version": ITEM_FV,
        "minecraft:item": {
            "description": {
                "identifier": "li:%s%s" % (ident, "_used" if marker else ""),
                "menu_category": desc_cat,
            },
            "components": comp,
        },
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    lang = []
    markers = []

    for ident, display, cat, stack, kind, extra in ITEMS:
        w(os.path.join(BP, "items", ident + ".json"),
          item_json(ident, display, cat, stack, kind, extra))
        lang.append(("item.li:%s.name" % ident, display))
        if kind in ("use", "tool"):
            w(os.path.join(BP, "items", ident + "_used.json"),
              item_json(ident, display, cat, stack, kind, extra, marker=True))
            lang.append(("item.li:%s_used.name" % ident, display))
            markers.append(ident)

    with open(os.path.join(OUT, "marker_items.json"), "w") as f:
        json.dump(markers, f, indent=2)

    # ----------------------------------------------------------------- recipes
    def shaped(name, pattern, key, result, count=1):
        w(os.path.join(BP, "recipes", name + ".json"), {
            "format_version": RECIPE_FV,
            "minecraft:recipe_shaped": {
                "description": {"identifier": "li:" + name},
                "tags": ["crafting_table"],
                "pattern": pattern,
                "key": key,
                "result": {"item": result, "count": count},
            },
        })

    def shapeless(name, ingredients, result, count=1):
        w(os.path.join(BP, "recipes", name + ".json"), {
            "format_version": RECIPE_FV,
            "minecraft:recipe_shapeless": {
                "description": {"identifier": "li:" + name},
                "tags": ["crafting_table"],
                "ingredients": ingredients,
                "result": {"item": result, "count": count},
            },
        })

    def furnace(name, inp, out_item, tags=("furnace",)):
        w(os.path.join(BP, "recipes", name + ".json"), {
            "format_version": RECIPE_FV,
            "minecraft:recipe_furnace": {
                "description": {"identifier": "li:" + name},
                "tags": list(tags),
                "input": inp,
                "output": out_item,
            },
        })

    shapeless("cloth_from_wool", [{"item": "minecraft:white_wool"}], "li:cloth", 3)
    shapeless("rope_from_string", [{"item": "minecraft:string"},
                                   {"item": "minecraft:string"},
                                   {"item": "minecraft:string"}], "li:rope", 1)
    shapeless("bandage_from_cloth", [{"item": "li:cloth"}, {"item": "li:cloth"}],
              "li:bandage", 1)
    shaped("first_aid_kit", ["CBC", "BPB", "CBC"],
           {"C": {"item": "li:cloth"}, "B": {"item": "li:bandage"},
            "P": {"item": "minecraft:paper"}}, "li:first_aid", 1)
    shapeless("scrap_from_nuggets", [{"item": "minecraft:iron_nugget"},
                                     {"item": "minecraft:iron_nugget"},
                                     {"item": "minecraft:iron_nugget"},
                                     {"item": "minecraft:iron_nugget"}], "li:scrap", 1)
    shaped("battery_craft", ["S", "R", "C"],
           {"S": {"item": "li:scrap"}, "R": {"item": "minecraft:redstone"},
            "C": {"item": "minecraft:copper_ingot"}}, "li:battery", 1)
    shaped("flashlight_craft", ["SGS", "SBS", "S S"],
           {"S": {"item": "li:scrap"}, "G": {"item": "minecraft:glass_pane"},
            "B": {"item": "li:battery"}}, "li:flashlight_off", 1)
    shaped("crowbar_craft", ["  I", " I ", "I  "],
           {"I": {"item": "minecraft:iron_ingot"}}, "li:crowbar", 1)
    shapeless("dirty_water_fill", [{"item": "minecraft:glass_bottle"},
                                   {"item": "minecraft:mud"}], "li:dirty_water", 1)
    # Boiling purifies water. Furnace recipes need a burnable fuel supplied by the
    # player, which is exactly the "boil it over a fire" fantasy.
    furnace("boil_dirty_water", "li:dirty_water", "li:boiled_water")
    furnace("boil_clean_water", "li:clean_water", "li:boiled_water")
    shapeless("matches_craft", [{"item": "minecraft:stick"},
                                {"item": "minecraft:gunpowder"}], "li:matches", 4)
    shaped("flare_craft", ["P", "G", "S"],
           {"P": {"item": "minecraft:paper"}, "G": {"item": "minecraft:gunpowder"},
            "S": {"item": "li:scrap"}}, "li:flare", 2)

    # ------------------------------------------------------------ loot tables
    def entry(name, weight, cmin=1, cmax=1):
        e = {"type": "item", "name": name, "weight": weight}
        if (cmin, cmax) != (1, 1):
            e["functions"] = [{"function": "set_count",
                               "count": {"min": cmin, "max": cmax}}]
        return e

    def empty(weight):
        return {"type": "empty", "weight": weight}

    def table(name, pools):
        w(os.path.join(BP, "loot_tables", "chests", name + ".json"), {"pools": pools})

    def pool(rmin, rmax, entries):
        return {"rolls": {"min": rmin, "max": rmax}, "entries": entries}

    common = [
        entry("li:canned_beans", 12), entry("li:canned_meat", 8),
        entry("li:dirty_water", 12), entry("li:clean_water", 6),
        entry("li:cloth", 12, 1, 3), entry("li:rope", 8),
        entry("li:scrap", 12, 1, 3), entry("li:battery", 6),
        entry("li:matches", 8, 1, 2), entry("li:bandage", 8, 1, 2),
        entry("minecraft:stick", 8, 1, 4), entry("minecraft:torch", 6, 1, 4),
        entry("minecraft:stone_shovel", 3), entry("minecraft:stone_pickaxe", 3),
        empty(34),
    ]
    table("common_house", [pool(1, 3, common)])
    table("empty", [pool(1, 1, [empty(1)])])
    table("survivor_stash", [pool(1, 2, [
        entry("li:canned_beans", 14), entry("li:dirty_water", 14),
        entry("li:cloth", 10, 1, 2), entry("li:matches", 10),
        entry("li:bandage", 8), entry("minecraft:stick", 8, 2, 4),
        entry("minecraft:wooden_axe", 4), empty(20),
    ])])
    table("supermarket", [pool(1, 4, [
        entry("li:canned_beans", 16, 1, 3), entry("li:canned_meat", 12, 1, 2),
        entry("li:clean_water", 12, 1, 2), entry("li:cloth", 8),
        entry("li:matches", 8), entry("li:battery", 8),
        entry("minecraft:bread", 8, 1, 3), entry("minecraft:sugar", 4, 1, 2),
        empty(30),
    ])])
    table("medical", [pool(1, 3, [
        entry("li:bandage", 18, 1, 3), entry("li:first_aid", 8),
        entry("li:clean_water", 10), entry("li:cloth", 10, 1, 3),
        entry("minecraft:paper", 6, 1, 3), entry("li:documents", 5),
        empty(22),
    ])])
    table("police", [pool(1, 3, [
        entry("li:crowbar", 6), entry("li:bandage", 10),
        entry("li:battery", 10), entry("li:scrap", 10, 1, 3),
        entry("li:documents", 6), entry("minecraft:iron_ingot", 6, 1, 2),
        entry("minecraft:leather_chestplate", 4), empty(24),
    ])])
    table("military", [pool(1, 3, [
        entry("li:first_aid", 10), entry("li:radio_part", 5),
        entry("li:mech_part", 5), entry("li:crowbar", 6),
        entry("li:canned_meat", 10, 1, 3), entry("li:battery", 10, 1, 2),
        entry("minecraft:iron_helmet", 5), entry("minecraft:iron_chestplate", 4),
        entry("minecraft:iron_sword", 4), entry("li:documents", 8),
        empty(16),
    ])])
    table("research", [pool(1, 3, [
        entry("li:documents", 16), entry("li:keycard", 4),
        entry("li:nav_gear", 4), entry("li:radio_part", 6),
        entry("li:first_aid", 8), entry("li:battery", 10, 1, 2),
        entry("minecraft:paper", 8, 1, 4), empty(14),
    ])])
    table("mine", [pool(1, 3, [
        entry("li:scrap", 16, 1, 4), entry("li:battery", 8),
        entry("li:crowbar", 5), entry("li:rope", 10, 1, 2),
        entry("minecraft:iron_ingot", 8, 1, 3), entry("minecraft:coal", 10, 2, 6),
        entry("minecraft:torch", 8, 2, 6), empty(20),
    ])])
    table("harbour", [pool(1, 3, [
        entry("li:fuel_can", 4), entry("li:mech_part", 6),
        entry("li:rope", 12, 1, 3), entry("li:scrap", 12, 1, 3),
        entry("li:canned_meat", 8), entry("li:documents", 6),
        entry("minecraft:iron_ingot", 6, 1, 2), empty(22),
    ])])
    # --- guaranteed progression items -----------------------------------
    # These are placed at one specific container each by the location builder,
    # so the critical path never depends on a random roll.
    table("key_crowbar", [{"rolls": 1, "entries": [entry("li:crowbar", 1)]},
                          pool(1, 1, [entry("li:cloth", 10),
                                      entry("li:scrap", 10)])])
    table("key_keycard", [{"rolls": 1, "entries": [entry("li:keycard", 1)]},
                          pool(1, 1, [entry("li:documents", 10),
                                      entry("li:bandage", 6)])])
    table("key_bunker", [{"rolls": 1, "entries": [entry("li:bunker_key", 1)]},
                         pool(1, 1, [entry("li:documents", 10),
                                     entry("li:battery", 8)])])
    table("part_radio", [{"rolls": 1, "entries": [entry("li:radio_part", 1)]},
                         pool(1, 1, [entry("li:scrap", 10),
                                     entry("li:battery", 8)])])
    table("part_fuel", [{"rolls": 1, "entries": [entry("li:fuel_can", 1)]},
                        pool(1, 1, [entry("li:scrap", 10),
                                    entry("li:matches", 8)])])
    table("part_mech", [{"rolls": 1, "entries": [entry("li:mech_part", 1)]},
                        pool(1, 1, [entry("li:scrap", 10),
                                    entry("li:rope", 8)])])
    table("part_nav", [{"rolls": 1, "entries": [entry("li:nav_gear", 1)]},
                       pool(1, 1, [entry("li:documents", 8),
                                   entry("li:battery", 8)])])
    table("gas_station", [pool(1, 2, [
        entry("li:fuel_can", 5), entry("li:matches", 12, 1, 2),
        entry("li:canned_beans", 12), entry("li:scrap", 10, 1, 2),
        entry("li:battery", 8), empty(28),
    ])])

    # ---------------------------------------------- item-use detection function
    lines = [
        "# Detects marker items produced by minecraft:food/using_converts_to.",
        "# Runs twice per second from li_core/half_sec. One command per item.",
    ]
    for ident in markers:
        lines.append("execute as @a[hasitem={item=li:%s_used}] at @s run "
                     "function li_items/use_%s" % (ident, ident))
    fp = os.path.join(BP, "functions", "li_items", "detect.mcfunction")
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, "w") as f:
        f.write("\n".join(lines) + "\n")

    # ------------------------------------------------------------------- lang
    with open(os.path.join(OUT, "item_lang.txt"), "w") as f:
        for k, v in lang:
            f.write("%s=%s\n" % (k, v))

    print("items          : %d (+%d markers)" % (len(ITEMS), len(markers)))
    print("recipes        : %d" % len(os.listdir(os.path.join(BP, "recipes"))))
    print("chest tables   : %d" % len(os.listdir(os.path.join(BP, "loot_tables", "chests"))))
    print("detect commands: %d" % len(markers))


if __name__ == "__main__":
    main()
