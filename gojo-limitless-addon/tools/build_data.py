"""Generate manifests, item JSON, lang, item_texture.json and the script data table.

Run:  python3 tools/build_data.py
"""
import json
import os

from defs import (
    ADDON_NAME, VERSION, MIN_ENGINE, ITEMS, LOADOUT, ITEM_FORMAT, CREATIVE_CATEGORY,
    CREATIVE_GROUP, UUID_BP_HEADER, UUID_BP_DATA, UUID_BP_SCRIPT, UUID_RP_HEADER,
    UUID_RP_DATA, SERVER_MODULE_VERSION, SERVER_UI_MODULE_VERSION, icon_key, icon_path,
    lang_key,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "Gojo_Limitless_BP")
RP = os.path.join(ROOT, "packs", "Gojo_Limitless_RP")


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def manifests():
    write_json(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "§bGojo Satoru – Limitless Addon §7[Behavior]",
            "description": "§7The Strongest's full arsenal: Infinity, Blue, Red, Hollow Purple, "
                           "Unlimited Void, Six Eyes, Teleport, Reverse Cursed Technique and Black Flash.\n"
                           "§8Script API 1.10.0 • No experiments required • Made for 1.21.0.26+",
            "uuid": UUID_BP_HEADER,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {
                "type": "data",
                "uuid": UUID_BP_DATA,
                "version": VERSION,
                "description": "Gojo items",
            },
            {
                "type": "script",
                "language": "javascript",
                "uuid": UUID_BP_SCRIPT,
                "version": VERSION,
                "entry": "scripts/main.js",
                "description": "Gojo techniques",
            },
        ],
        "dependencies": [
            {"uuid": UUID_RP_HEADER, "version": VERSION},
            {"module_name": "@minecraft/server", "version": SERVER_MODULE_VERSION},
            {"module_name": "@minecraft/server-ui", "version": SERVER_UI_MODULE_VERSION},
        ],
        "metadata": {
            "authors": ["Gojo Limitless Addon"],
            "product_type": "addon",
        },
    })
    write_json(os.path.join(RP, "manifest.json"), {
        "format_version": 2,
        "header": {
            "name": "§bGojo Satoru – Limitless Addon §7[Resources]",
            "description": "§7Icons, particles, sounds, animations and the blindfold model for the "
                           "Limitless Addon.\n§8Made for 1.21.0.26+",
            "uuid": UUID_RP_HEADER,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {
                "type": "resources",
                "uuid": UUID_RP_DATA,
                "version": VERSION,
                "description": "Gojo resources",
            },
        ],
        "dependencies": [
            {"uuid": UUID_BP_HEADER, "version": VERSION},
        ],
        "metadata": {
            "authors": ["Gojo Limitless Addon"],
            "product_type": "addon",
        },
    })


def items():
    folder = os.path.join(BP, "items")
    for f in os.listdir(folder):
        if f.endswith(".json"):
            os.remove(os.path.join(folder, f))
    for index, item in enumerate(ITEMS):
        description = {"identifier": item["id"]}
        if item.get("hidden"):
            description["menu_category"] = {"category": "none"}
        else:
            description["menu_category"] = {"category": CREATIVE_CATEGORY, "group": CREATIVE_GROUP}
        components = {
            "minecraft:icon": icon_key(item),
            "minecraft:display_name": {"value": lang_key(item)},
            "minecraft:max_stack_size": 1,
        }
        if item["kind"] == "wearable":
            components["minecraft:wearable"] = {"slot": "slot.armor.head", "protection": 0}
        else:
            components["minecraft:hand_equipped"] = bool(item.get("hand_equipped", False))
            components["minecraft:glint"] = bool(item.get("glint", False))
            components["minecraft:can_destroy_in_creative"] = False
            components["minecraft:cooldown"] = {
                "category": "gojo_" + item["key"],
                "duration": float(item["cooldown"]),
            }
        write_json(os.path.join(folder, "%02d_%s.json" % (index, item["key"])), {
            "format_version": ITEM_FORMAT,
            "minecraft:item": {"description": description, "components": components},
        })


def lang():
    lines = [
        "## Gojo Satoru - Limitless Addon",
        "pack.name=Gojo Satoru – Limitless Addon",
        "pack.description=The Strongest's full arsenal of cursed techniques.",
        "%s=Gojo Satoru – Limitless" % CREATIVE_GROUP,
    ]
    for item in ITEMS:
        lines.append("%s=%s" % (lang_key(item), item["name"]))
        # Default key the engine uses when no display_name is given.
        lines.append("item.%s=%s" % (item["id"], item["name"]))
    text = "\n".join(lines) + "\n"
    write_text(os.path.join(RP, "texts", "en_US.lang"), text)
    write_json(os.path.join(RP, "texts", "languages.json"), ["en_US"])


def item_texture():
    data = {}
    for item in ITEMS:
        data[icon_key(item)] = {"textures": icon_path(item)}
    write_json(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "gojo_limitless",
        "texture_name": "atlas.items",
        "texture_data": data,
    })


def script_data():
    table = {}
    for item in ITEMS:
        entry = {
            "key": item["key"],
            "id": item["id"],
            "name": item["name"],
            "short": item["short"],
            "color": item["color"],
            "kind": item["kind"],
            "cooldown": item.get("cooldown", 0),
            "cooldownCategory": "gojo_" + item["key"] if item["kind"] != "wearable" else "",
            "icon": icon_path(item),
            "lore": item["lore"],
        }
        table[item["key"]] = entry
    body = [
        "// AUTO-GENERATED by tools/build_data.py from tools/defs.py - do not edit by hand.",
        "",
        "/**",
        " * @typedef {{key: string, id: string, name: string, short: string, color: string,",
        " *   kind: string, cooldown: number, cooldownCategory: string, icon: string, lore: string[]}} GojoItem",
        " */",
        "",
        "/** @type {Record<string, GojoItem>} */",
        "export const ITEMS = " + json.dumps(table, indent=2, ensure_ascii=True) + ";",
        "",
        "/** @type {Record<string, GojoItem>} */",
        "export const ITEM_BY_ID = {};",
        "for (const key of Object.keys(ITEMS)) ITEM_BY_ID[ITEMS[key].id] = ITEMS[key];",
        "",
        "/** Hotbar order used by the transformation (slots 0-8). */",
        "export const LOADOUT = " + json.dumps(LOADOUT) + ";",
        "",
    ]
    write_text(os.path.join(BP, "scripts", "data", "abilities.js"), "\n".join(body))


if __name__ == "__main__":
    manifests()
    items()
    lang()
    item_texture()
    script_data()
    print("data generated")
