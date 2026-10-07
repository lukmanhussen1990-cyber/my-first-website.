"""
build.py - generates every asset of the Magic Guns add-on and packages it.

    python3 tools/build.py            # from magic-guns-addon/

Outputs (all checked in so the repo is usable without running anything):
  behavior_pack/   items, recipes, manifest, pack icon      (scripts are hand written)
  resource_pack/   geometry, textures, icons, attachables, animations,
                   particles, sounds, lang, manifest, pack icon
  dist/MagicGuns.mcaddon (+ the two .mcpack files)
  docs/            preview renders used by the README
"""

import json
import os
import shutil
import sys
import uuid
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import gunsmith  # noqa: E402
import guns  # noqa: E402
import particles  # noqa: E402
import sounds  # noqa: E402
from gunsmith import Model, glow, metal  # noqa: E402

ROOT = os.path.dirname(HERE)
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
DIST = os.path.join(ROOT, "dist")
DOCS = os.path.join(ROOT, "docs")

NS = "magic_guns"
VERSION = [1, 2, 0]
MIN_ENGINE = [1, 21, 0]
SCRIPT_API = "1.11.0"
ITEM_FORMAT = "1.20.80"
RECIPE_FORMAT = "1.20.10"
ICON_SIZE = 64
# trigger cooldowns in ticks - must match behavior_pack/scripts/weapons.js
COOLDOWN = {"arcane_revolver": 8, "inferno_blaster": 18, "frostbite_rifle": 26, "stormcaller": 24,
            "soul_reaper": 4, "void_phaser": 30, "celestial_cannon": 50}
BINDING = "q.item_slot_to_bone_name(c.item_slot)"

# Deterministic UUIDs: rebuilding never changes the packs' identity, so an
# updated .mcaddon replaces the old one instead of installing a duplicate.
_U = uuid.UUID("6f1d3c8e-5a7b-4c2d-9e0f-1a2b3c4d5e6f")
UUIDS = {k: str(uuid.uuid5(_U, k)) for k in ("bp", "bp_data", "bp_script", "rp", "rp_res")}

# ------------------------------------------------------------- gun metadata

GUNS = {
    "arcane_revolver": dict(
        name="Arcane Revolver", color="§d", durability=700, move=1.0,
        pattern=["IIM", " AS", "  S"],
        key={"I": "minecraft:iron_ingot", "M": f"{NS}:mana_crystal", "A": "minecraft:amethyst_shard", "S": "minecraft:stick"}),
    "inferno_blaster": dict(
        name="Inferno Blaster", color="§6", durability=500, move=1.0,
        pattern=["GGF", " MB", "  B"],
        key={"G": "minecraft:gold_ingot", "F": "minecraft:fire_charge", "M": f"{NS}:mana_crystal", "B": "minecraft:blaze_rod"}),
    "frostbite_rifle": dict(
        name="Frostbite Rifle", color="§b", durability=450, move=0.85,
        pattern=["PII", "SMD", "S  "],
        key={"P": "minecraft:packed_ice", "I": "minecraft:iron_ingot", "S": "minecraft:stick", "M": f"{NS}:mana_crystal", "D": "minecraft:diamond"}),
    "stormcaller": dict(
        name="Stormcaller", color="§9", durability=400, move=0.85,
        pattern=["CCL", " MI", "  S"],
        key={"C": "minecraft:copper_ingot", "L": "minecraft:lightning_rod", "M": f"{NS}:mana_crystal", "I": "minecraft:iron_ingot", "S": "minecraft:stick"}),
    "soul_reaper": dict(
        name="Soul Reaper", color="§3", durability=900, move=1.0,
        pattern=["OOL", " MB", "  B"],
        key={"O": "minecraft:obsidian", "L": "minecraft:soul_lantern", "M": f"{NS}:mana_crystal", "B": "minecraft:bone"}),
    "void_phaser": dict(
        name="Void Phaser", color="§5", durability=350, move=0.9,
        pattern=["REO", " MO", "  O"],
        key={"R": "minecraft:end_rod", "E": "minecraft:ender_eye", "O": "minecraft:obsidian", "M": f"{NS}:mana_crystal"}),
    "celestial_cannon": dict(
        name="Celestial Cannon", color="§e", durability=300, move=0.8,
        pattern=["DGS", "GMG", "G  "],
        key={"D": "minecraft:diamond", "G": "minecraft:gold_ingot", "S": "minecraft:glowstone", "M": f"{NS}:mana_crystal"}),
}

# (first-person previews come from fp_preview.py, which replays the vanilla rig)


def glow_alpha(mask):
    """Encode the emissive mask in the texture alpha (entity_emissive_alpha)."""
    return np.where(mask > 0.5, EMISSIVE_ALPHA, 1.0)


# entity_emissive_alpha: alpha 255 = normally lit, ~16-32 = full-bright glow,
# (0,0,0,0) = cut out.  Alpha-test parts must stay >= 128, so glow texels are
# only ever placed on glow_* bones (see Model.to_bedrock(split_glow=True)).
EMISSIVE_ALPHA = 24 / 255


# ------------------------------------------------------------------ helpers

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def icon_from_render(img, size=ICON_SIZE):
    """Crop to content, fit in a square with a 1px margin, add a soft outline."""
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > 0)
    img = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = img.size
    inner = size - 4
    s = inner / max(w, h)
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    # dark 1px outline keeps the silhouette readable on any slot colour
    alpha = canvas.split()[3]
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", canvas.size, (12, 10, 18, 0))
    outline.putalpha(grown.point(lambda v: 200 if v > 40 else 0))
    outline.alpha_composite(canvas)
    # snap alpha: crisp edges like vanilla icons
    arr = np.asarray(outline).copy()
    arr[..., 3] = np.where(arr[..., 3] > 90, 255, 0)
    return Image.fromarray(arr, "RGBA")


# ---------------------------------------------------------------- the build

def build_models():
    results = {}
    for fn in guns.ALL:
        m, meta = fn()
        name = m.name
        m.build_atlas(seed=sum(map(ord, name)))
        # Centre the model on the middle of the grip (inside the fist): every
        # hold animation assumes the hand sits at the root bone's origin.
        offset = -gunsmith.cube_center(meta["grip"])
        # no visible_bounds: vanilla trident / shield / crossbow omit them too
        geo = m.to_bedrock(f"geometry.{NS}.{name}", binding=BINDING, root_bone="magic_gun",
                           visible=None, offset=offset, split_glow=True)
        write_json(os.path.join(RP, "models", "entity", NS, f"{name}.geo.json"), geo)
        tex = m.atlas_image(glow_alpha)
        os.makedirs(os.path.join(RP, "textures", "entity", NS), exist_ok=True)
        tex.save(os.path.join(RP, "textures", "entity", NS, f"{name}.png"))
        _, glow_mask, _ = m.atlas
        opaque = m.atlas_image(lambda g: np.ones_like(g))
        render = gunsmith.render(geo, opaque, size=768, yaw=24, pitch=14, roll=-28, glow_mask=glow_mask,
                                 hide=("fp_hands",))
        icon = icon_from_render(render)
        os.makedirs(os.path.join(RP, "textures", "items", NS), exist_ok=True)
        icon.save(os.path.join(RP, "textures", "items", NS, f"{name}.png"))
        results[name] = dict(model=m, meta=meta, geo=geo, opaque=opaque, glow=glow_mask, icon=icon)
        import fp_preview
        hold = HOLD[meta["kind"]]["fp"]
        fp = fp_preview.render_fp(geo, opaque, glow_mask, hold["position"], hold["rotation"], size=(868, 400))
        os.makedirs(os.path.join(DOCS, "first_person"), exist_ok=True)
        fp.convert("RGB").save(os.path.join(DOCS, "first_person", f"{name}.png"))
        print("model", name, tex.size)
    return results


def mana_crystal_icon():
    m = Model("mana_crystal", {
        "core": glow((0.45, 0.75, 1.0), (0.18, 0.25, 0.75)),
        "tip": glow((0.75, 0.55, 1.0), (0.35, 0.15, 0.7)),
        "base": metal((0.8, 0.6, 0.2), (1, 0.9, 0.5)),
    })
    m.bone("magic_gun")
    m.bone("body", "magic_gun")
    # stacked, shrinking prisms turned 45 degrees -> faceted crystal silhouette
    for (y0, y1, r, mat) in ((-6.0, -4.5, 0.7, "tip"), (-4.5, -2.5, 1.4, "core"), (-2.5, 2.5, 2.0, "core"),
                             (2.5, 4.5, 1.4, "core"), (4.5, 6.5, 0.8, "tip"), (6.5, 7.5, 0.35, "tip")):
        m.box("body", (-r, y0, -r), (r, y1, r), mat, rotation=(0, 45, 0), pivot=(0, 0, 0))
    m.box("body", (-2.6, -0.8, -0.35), (2.6, 0.8, 0.35), "base", rotation=(0, 45, 0), pivot=(0, 0, 0))
    m.build_atlas(seed=99)
    geo = m.to_bedrock("geometry.tmp")
    _, g, _ = m.atlas
    r = gunsmith.render(geo, m.atlas_image(lambda x: np.ones_like(x)), size=512, yaw=20, pitch=12, roll=-12, glow_mask=g)
    icon = icon_from_render(r)
    icon.save(os.path.join(RP, "textures", "items", NS, "mana_crystal.png"))
    return icon


def write_items():
    for name, g in GUNS.items():
        item = {
            "format_version": ITEM_FORMAT,
            "minecraft:item": {
                "description": {
                    "identifier": f"{NS}:{name}",
                    "menu_category": {"category": "equipment"},
                },
                "components": {
                    "minecraft:icon": {"textures": {"default": f"{NS}_{name}"}},
                    "minecraft:display_name": {"value": f"item.{NS}.{name}.name"},
                    "minecraft:max_stack_size": 1,
                    "minecraft:hand_equipped": True,
                    "minecraft:allow_off_hand": False,
                    "minecraft:can_destroy_in_creative": False,
                    "minecraft:damage": 3,
                    "minecraft:durability": {"max_durability": g["durability"]},
                    # A long "use" makes the gun a usable item: tap fires once,
                    # holding keeps the use going so the script can auto-fire.
                    "minecraft:use_modifiers": {"use_duration": 30, "movement_modifier": g["move"]},
                    "minecraft:interact_button": "Shoot",
                    # Category per gun: drives the hotbar cooldown sweep and the
                    # attachable's recoil kick (the script restarts it per shot).
                    "minecraft:cooldown": {"category": f"{NS}_{name}", "duration": COOLDOWN[name] / 20},
                    "minecraft:enchantable": {"slot": "bow", "value": 12},
                    "minecraft:repairable": {
                        "repair_items": [{"items": [f"{NS}:mana_crystal"], "repair_amount": max(50, g["durability"] // 4)}]
                    },
                    "minecraft:tags": {"tags": [f"{NS}:gun"]},
                },
            },
        }
        write_json(os.path.join(BP, "items", f"{name}.json"), item)
    crystal = {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": f"{NS}:mana_crystal", "menu_category": {"category": "items"}},
            "components": {
                "minecraft:icon": {"textures": {"default": f"{NS}_mana_crystal"}},
                "minecraft:display_name": {"value": f"item.{NS}.mana_crystal.name"},
                "minecraft:max_stack_size": 64,
                "minecraft:glint": True,
            },
        },
    }
    write_json(os.path.join(BP, "items", "mana_crystal.json"), crystal)


def write_recipes():
    for name, g in GUNS.items():
        recipe = {
            "format_version": RECIPE_FORMAT,
            "minecraft:recipe_shaped": {
                "description": {"identifier": f"{NS}:{name}"},
                "tags": ["crafting_table"],
                "pattern": g["pattern"],
                "key": {k: {"item": v} for k, v in g["key"].items()},
                "unlock": [{"item": f"{NS}:mana_crystal"}],
                "result": {"item": f"{NS}:{name}", "count": 1},
            },
        }
        write_json(os.path.join(BP, "recipes", f"{name}.json"), recipe)
    write_json(os.path.join(BP, "recipes", "mana_crystal.json"), {
        "format_version": RECIPE_FORMAT,
        "minecraft:recipe_shapeless": {
            "description": {"identifier": f"{NS}:mana_crystal"},
            "tags": ["crafting_table"],
            "ingredients": [
                {"item": "minecraft:amethyst_shard"},
                {"item": "minecraft:lapis_lazuli"},
                {"item": "minecraft:glowstone_dust"},
                {"item": "minecraft:redstone"},
            ],
            "unlock": [{"item": "minecraft:amethyst_shard"}],
            "result": {"item": f"{NS}:mana_crystal", "count": 2},
        },
    })


# Hold transforms for the root bone (grip centred at the origin, barrel -Z).
#
# First person: solved against the vanilla first-person rig (player.animation
# .json: rightarm pos [13.5,-10,12] rot [95,-45,115], rightitem pos (0,0,-1),
# bound geometry hung 24 px below the rightitem pivot) so that the grip sits
# 6.3 px right, 6.5 px below and 9.5 px in front of the eye with the barrel
# parallel to the view - an FPS framing in the lower right of the screen.
# The same chain reproduces the vanilla trident (upright, prongs at eye level
# on the right) and the spyglass eyepiece at the eye, so it is trusted.
# Third person: for the raised-arm aim pose of player.entity.json.
HOLD = {
    "pistol": {
        "fp": {"position": [-5.82, 28.23, -6.02], "rotation": [82.64, 61.26, -51.57]},
        "tp": {"position": [0.0, 22.5, -1.0], "rotation": [90.0, 0.0, 0.0]},
    },
    "rifle": {
        "fp": {"position": [-5.82, 28.23, -6.02], "rotation": [82.64, 61.26, -51.57]},
        "tp": {"position": [3.0, 22.5, -1.0], "rotation": [90.0, 0.0, 0.0]},
    },
}

RENDER_CONTROLLER = f"controller.render.{NS}.gun"


def write_attachables(models):
    anims = {}
    for kind, poses in HOLD.items():
        for view, p in poses.items():
            bones = {"magic_gun": {"position": p["position"], "rotation": p["rotation"]}}
            if view == "tp":
                # the player's own arm holds the gun in third person: hide the glove
                bones["fp_hands"] = {"scale": 0}
            anims[f"animation.{NS}.{kind}.{view}"] = {"loop": True, "bones": bones}
    # recoil kick, driven by the item cooldown the script starts on every shot
    anims[f"animation.{NS}.recoil"] = {"loop": True, "bones": {"body": {
        "position": [0, 0, "1.6 * math.pow(v.recoil, 3)"],
        "rotation": ["-12 * math.pow(v.recoil, 3)", 0, 0],
    }}}
    for name, r in models.items():
        meta = r["meta"]
        kind = meta["kind"]
        # Conditions use only c.is_first_person, exactly like the vanilla bow and
        # crossbow.  Guns cannot go in the off hand (allow_off_hand false), so no
        # slot check is needed - and c.item_slot is not used by any vanilla
        # attachable condition, so it is not relied on here.
        animations = {
            "fp": f"animation.{NS}.{kind}.fp",
            "tp": f"animation.{NS}.{kind}.tp",
            "recoil": f"animation.{NS}.recoil",
        }
        animate = [
            {"fp": "c.is_first_person"},
            {"tp": "!c.is_first_person"},
            {"recoil": "v.recoil > 0.0"},
        ]
        for bone_name, axis in meta["spin"].items():
            key = f"animation.{NS}.{name}.spin"
            rot = {"x": ["q.life_time * 120", 0, 0], "y": [0, "q.life_time * 120", 0], "z": [0, 0, "q.life_time * 120"]}[axis]
            anims[key] = {"loop": True, "bones": {bone_name: {"rotation": rot}}}
            animations["spin"] = key
            animate.append("spin")
        att = {
            "format_version": "1.10.0",
            "minecraft:attachable": {
                "description": {
                    "identifier": f"{NS}:{name}",
                    "materials": {
                        "default": "entity_alphatest",
                        "enchanted": "entity_alphatest_glint",
                        "glow": "entity_emissive_alpha",
                    },
                    "textures": {
                        "default": f"textures/entity/{NS}/{name}",
                        "enchanted": "textures/misc/enchanted_item_glint",
                    },
                    "geometry": {"default": f"geometry.{NS}.{name}"},
                    "animations": animations,
                    "scripts": {
                        "pre_animation": [
                            "v.cd_total = q.cooldown_time('slot.weapon.mainhand');",
                            "v.recoil = (v.cd_total > 0.0) ? math.clamp(q.cooldown_time_remaining('slot.weapon.mainhand') / v.cd_total, 0.0, 1.0) : 0.0;",
                        ],
                        "animate": animate,
                    },
                    "render_controllers": [RENDER_CONTROLLER],
                }
            },
        }
        # top level, like every vanilla attachable
        write_json(os.path.join(RP, "attachables", f"{NS}_{name}.json"), att)
    write_json(os.path.join(RP, "animations", f"{NS}.attachables.animation.json"),
               {"format_version": "1.10.0", "animations": anims})
    # Metal parts: alpha-test (glint when enchanted).  Bones named glow_*:
    # always emissive, their low-alpha texels render full-bright.
    write_json(os.path.join(RP, "render_controllers", f"{NS}.render_controllers.json"), {
        "format_version": "1.10.0",
        "render_controllers": {
            RENDER_CONTROLLER: {
                "geometry": "geometry.default",
                "materials": [
                    {"*": "variable.is_enchanted ? material.enchanted : material.default"},
                    {"glow_*": "material.glow"},
                ],
                "textures": ["texture.default", "texture.enchanted"],
            }
        },
    })


def write_player_aim(models):
    """Third-person aim pose.  Bedrock only has aiming poses for the vanilla bow
    and crossbow, so the player client entity is copied verbatim from the
    1.21.0.26 vanilla resource pack (tools/vanilla/) and only gains a variable,
    two animations and two animate entries.  Never active in first person,
    where the attachable's hand placement relies on the vanilla arm."""
    with open(os.path.join(HERE, "vanilla", "player.entity.json"), encoding="utf-8") as f:
        player = json.load(f)
    desc = player["minecraft:client_entity"]["description"]
    pistols = [f"'{NS}:{n}'" for n, r in models.items() if r["meta"]["kind"] == "pistol"]
    rifles = [f"'{NS}:{n}'" for n, r in models.items() if r["meta"]["kind"] == "rifle"]
    desc["scripts"]["pre_animation"].append(
        "variable.magic_guns_aim = query.is_item_name_any('slot.weapon.mainhand', %s) ? 1.0 : "
        "(query.is_item_name_any('slot.weapon.mainhand', %s) ? 2.0 : 0.0);" % (", ".join(pistols), ", ".join(rifles)))
    desc["animations"]["magic_guns_aim_pistol"] = f"animation.{NS}.player.aim_pistol"
    desc["animations"]["magic_guns_aim_rifle"] = f"animation.{NS}.player.aim_rifle"
    cond = "!variable.is_first_person && !query.is_sleeping"
    desc["scripts"]["animate"] += [
        {"magic_guns_aim_pistol": f"variable.magic_guns_aim == 1.0 && {cond}"},
        {"magic_guns_aim_rifle": f"variable.magic_guns_aim == 2.0 && {cond}"},
    ]
    write_json(os.path.join(RP, "entity", "player.entity.json"), player)
    # same arm angles as vanilla animation.player.crossbow_hold ("- this"
    # cancels the walk / attack swing so the arms stay on target)
    right = ["query.is_swimming ? 0.0 : -93.0 + query.target_x_rotation - query.is_sneaking * 27.0 - this",
             "query.is_swimming ? 0.0 : math.clamp(query.target_y_rotation, -60.0, 45.0) - this", 0.0]
    left = ["query.is_swimming ? 0.0 : -93.0 + query.target_x_rotation - query.is_sneaking * 27.0 - this",
            "query.is_swimming ? 0.0 : 42.0 + math.clamp(query.target_y_rotation, -45.0, 5.0) - this",
            "query.is_sneaking * -15.0"]
    write_json(os.path.join(RP, "animations", f"{NS}.player.animation.json"), {
        "format_version": "1.10.0",
        "animations": {
            f"animation.{NS}.player.aim_pistol": {"loop": True, "bones": {"rightarm": {"rotation": right}}},
            f"animation.{NS}.player.aim_rifle": {"loop": True, "bones": {"rightarm": {"rotation": right},
                                                                         "leftarm": {"rotation": left}}},
        },
    })


def write_rp_text(models):
    tex = {
        "resource_pack_name": NS,
        "texture_name": "atlas.items",
        "texture_data": {f"{NS}_{n}": {"textures": f"textures/items/{NS}/{n}"} for n in list(GUNS) + ["mana_crystal"]},
    }
    write_json(os.path.join(RP, "textures", "item_texture.json"), tex)
    lines = [f"pack.name=Magic Guns Resources", "pack.description=Realistic 3D magical guns, particles and sounds"]
    for n, g in GUNS.items():
        lines.append(f"item.{NS}.{n}.name={g['color']}{g['name']}")
    lines.append(f"item.{NS}.mana_crystal.name=§bMana Crystal")
    write_text(os.path.join(RP, "texts", "en_US.lang"), "\n".join(lines) + "\n")
    write_json(os.path.join(RP, "texts", "languages.json"), ["en_US"])
    write_text(os.path.join(BP, "texts", "en_US.lang"),
               "pack.name=Magic Guns\npack.description=Seven magical & supernatural guns for Bedrock (mobile friendly)\n")
    write_json(os.path.join(BP, "texts", "languages.json"), ["en_US"])


def write_sound_defs():
    defs = {}
    for snd in sounds.SOUNDS:
        family, kind = snd.split("_")
        family = {"inferno": "inferno", "arcane": "arcane", "frost": "frost", "storm": "storm",
                  "soul": "soul", "void": "void", "holy": "holy"}[family]
        defs[f"{NS}.{family}.{kind}"] = {
            "category": "player",
            "min_distance": 4.0 if kind == "fire" else 2.0,
            "max_distance": 48.0 if kind == "fire" else 32.0,
            "sounds": [{"name": f"sounds/{NS}/{snd}" + ("" if i == 1 else f"_{i}"), "volume": 1.0,
                        "load_on_low_memory": True}
                       for i in range(1, getattr(sounds, "VARIANTS", {}).get(snd, 1) + 1)],
        }
    write_json(os.path.join(RP, "sounds", "sound_definitions.json"),
               {"format_version": "1.14.0", "sound_definitions": defs})


def write_manifests():
    common_meta = {"authors": ["lukmanhussen1990"], "license": "MIT"}
    bp = {
        "format_version": 2,
        "header": {
            "name": "pack.name",
            "description": "pack.description",
            "uuid": UUIDS["bp"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": UUIDS["bp_data"], "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": UUIDS["bp_script"], "version": VERSION,
             "entry": "scripts/main.js"},
        ],
        "dependencies": [
            {"uuid": UUIDS["rp"], "version": VERSION},
            {"module_name": "@minecraft/server", "version": SCRIPT_API},
        ],
        "metadata": common_meta,
    }
    rp = {
        "format_version": 2,
        "header": {
            "name": "pack.name",
            "description": "pack.description",
            "uuid": UUIDS["rp"],
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": UUIDS["rp_res"], "version": VERSION}],
        "dependencies": [{"uuid": UUIDS["bp"], "version": VERSION}],
        "metadata": common_meta,
    }
    write_json(os.path.join(BP, "manifest.json"), bp)
    write_json(os.path.join(RP, "manifest.json"), rp)


def pack_icon(models):
    W = 256
    img = Image.new("RGBA", (W, W), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for y in range(W):  # night-sky gradient
        t = y / W
        d.line([(0, y), (W, y)], fill=(int(28 + 30 * t), int(10 + 8 * t), int(48 + 40 * t), 255))
    rng = np.random.default_rng(3)
    for _ in range(40):
        x, y = rng.integers(0, W, 2)
        b = int(rng.integers(120, 255))
        d.point((int(x), int(y)), fill=(b, b, 255, 255))
    picks = [("frostbite_rifle", 236), ("arcane_revolver", 150), ("celestial_cannon", 236)]
    rendered = []
    for n, w in picks:
        r = models[n]
        rend = gunsmith.render(r["geo"], r["opaque"], size=900, yaw=24, pitch=14, roll=-10, glow_mask=r["glow"],
                               hide=("fp_hands",))
        a = np.asarray(rend)[..., 3]
        ys, xs = np.where(a > 0)
        rend = rend.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        rend = rend.resize((w, max(1, int(rend.height * w / rend.width))), Image.LANCZOS)
        rendered.append(rend)
    gap = (W - sum(r.height for r in rendered)) / (len(rendered) + 1)
    y = gap
    for rend in rendered:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        layer.paste(rend, ((W - rend.width) // 2, int(y)), rend)
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(7)))
        img.alpha_composite(layer)
        y += rend.height + gap
    img = img.convert("RGB")
    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def previews(models):
    os.makedirs(DOCS, exist_ok=True)
    tiles = []
    for n, r in models.items():
        im = gunsmith.render(r["geo"], r["opaque"], size=480, yaw=28, pitch=16, roll=0, glow_mask=r["glow"],
                             bg=(24, 22, 34, 255), hide=("fp_hands",))
        d = ImageDraw.Draw(im)
        d.text((12, 10), GUNS[n]["name"], fill=(235, 230, 255, 255))
        tiles.append(im)
    cols = 2
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGBA", (480 * cols, 480 * rows), (24, 22, 34, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 480, (i // cols) * 480))
    sheet.convert("RGB").save(os.path.join(DOCS, "guns.png"))
    # third-person: the aim pose holding every gun
    import tp_preview
    tps = []
    for n, r in models.items():
        kind = r["meta"]["kind"]
        tps.append(tp_preview.render_tp(r["geo"], r["opaque"], r["glow"], kind, HOLD[kind]["tp"], size=300, yaw=-38))
    strip = Image.new("RGBA", (300 * len(tps), 300))
    for i, t in enumerate(tps):
        strip.paste(t, (i * 300, 0))
    strip.convert("RGB").save(os.path.join(DOCS, "third_person.png"))
    fps = [Image.open(os.path.join(DOCS, "first_person", f"{n}.png")).resize((434, 200), Image.LANCZOS) for n in models]
    sheet = Image.new("RGB", (434 * 2 + 6, (200 + 6) * ((len(fps) + 1) // 2)), (20, 20, 28))
    for i, im in enumerate(fps):
        sheet.paste(im, ((i % 2) * 440, (i // 2) * 206))
    sheet.save(os.path.join(DOCS, "first_person.png"))
    icons = Image.new("RGBA", ((ICON_SIZE + 8) * 8, ICON_SIZE + 8), (139, 139, 139, 255))
    names = list(models) + ["mana_crystal"]
    for i, n in enumerate(names):
        ic = Image.open(os.path.join(RP, "textures", "items", NS, f"{n}.png"))
        icons.alpha_composite(ic, (i * (ICON_SIZE + 8) + 4, 4))
    icons.convert("RGB").save(os.path.join(DOCS, "icons.png"))


def zipdir(src, dst, prefix=""):
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(src):
            dirs.sort()
            for f in sorted(files):
                full = os.path.join(base, f)
                rel = os.path.relpath(full, src).replace(os.sep, "/")
                info = zipfile.ZipInfo(prefix + rel, date_time=(2024, 6, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(full, "rb") as fh:
                    z.writestr(info, fh.read())


def package():
    os.makedirs(DIST, exist_ok=True)
    zipdir(BP, os.path.join(DIST, "MagicGuns_BP.mcpack"))
    zipdir(RP, os.path.join(DIST, "MagicGuns_RP.mcpack"))
    addon = os.path.join(DIST, "MagicGuns.mcaddon")
    with zipfile.ZipFile(addon, "w", zipfile.ZIP_DEFLATED) as z:
        for folder, src in (("MagicGuns_BP", BP), ("MagicGuns_RP", RP)):
            for base, dirs, files in os.walk(src):
                dirs.sort()
                for f in sorted(files):
                    full = os.path.join(base, f)
                    rel = os.path.relpath(full, src).replace(os.sep, "/")
                    info = zipfile.ZipInfo(f"{folder}/{rel}", date_time=(2024, 6, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    with open(full, "rb") as fh:
                        z.writestr(info, fh.read())
    print("packaged", addon, os.path.getsize(addon), "bytes")


def main():
    models = build_models()
    mana_crystal_icon()
    write_items()
    write_recipes()
    write_attachables(models)
    write_player_aim(models)
    write_rp_text(models)
    particles.main(RP)
    sounds.main(RP)
    write_sound_defs()
    write_manifests()
    pack_icon(models)
    previews(models)
    package()


if __name__ == "__main__":
    main()
