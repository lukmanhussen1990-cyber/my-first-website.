#!/usr/bin/env python3
"""Build the Realistic Guns add-on.

    python3 tools/build.py            # generate packs/ and dist/RealisticGuns.mcaddon
    python3 tools/build.py --previews # also render preview images into docs/previews

Generated output:
    packs/RealisticGuns_BP/   behavior pack (items, bullet entity, recipes, catalog, scripts)
    packs/RealisticGuns_RP/   resource pack (3D models, textures, attachables, animations,
                                             particles, sounds, icons)
    dist/RealisticGuns.mcaddon  both packs zipped for one-tap import on Android/Windows/iOS
"""
import argparse
import json
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from gunlib import packgen as pg                     # noqa: E402
from gunlib.specs import NS, GUNS, AMMO              # noqa: E402
from gunlib.rig import vanilla_player                # noqa: E402
from gunlib.texture import save_png                  # noqa: E402
from gunlib import icons, particles, sounds          # noqa: E402
from gunlib.gamedata import gun_data_js              # noqa: E402

BP_DIR = os.path.join(ROOT, "packs", "RealisticGuns_BP")
RP_DIR = os.path.join(ROOT, "packs", "RealisticGuns_RP")
DIST = os.path.join(ROOT, "dist", "RealisticGuns.mcaddon")
SRC_BP = os.path.join(ROOT, "src", "behavior_pack")


def log(msg):
    print(msg, flush=True)


def clean(path):
    if os.path.isdir(path):
        shutil.rmtree(path)
    os.makedirs(path)


def build_rp(built):
    rp = RP_DIR
    w = pg.write_json
    w(os.path.join(rp, "manifest.json"), pg.rp_manifest())
    pg.write_text(os.path.join(rp, "texts", "en_US.lang"), pg.rp_lang())
    w(os.path.join(rp, "texts", "languages.json"), ["en_US"])

    item_tex = {}
    for bg in built:
        gid = bg.spec["id"]
        w(os.path.join(rp, "models", "entity", NS, f"{gid}.geo.json"), bg.geo)
        save_png(bg.tex, os.path.join(rp, "textures", NS, "guns", f"{gid}.png"))
        w(os.path.join(rp, "attachables", NS, f"{gid}.attachable.json"), pg.gun_attachable(bg))
        w(os.path.join(rp, "animations", NS, f"{gid}.animation.json"), pg.gun_animations(bg))
        icon = icons.gun_icon(bg.geo, bg.tex)
        icon.save(os.path.join(_mk(rp, "textures", NS, "items"), f"{gid}.png"))
        item_tex[f"{NS}_{gid}"] = {"textures": f"textures/{NS}/items/{gid}"}

    # magazine + ammo icons
    mag_styles = {
        "mag_ak47": dict(color=(70, 72, 78), curved=1.0),
        "mag_m4a1": dict(color=(84, 86, 92), curved=0.35),
        "mag_deagle": dict(color=(190, 192, 198), curved=0.0),
        "mag_glock17": dict(color=(58, 60, 64), curved=0.0),
        "mag_awp": dict(color=(56, 58, 62), curved=0.0, wide=True),
        "mag_barrett": dict(color=(78, 82, 74), curved=0.0, wide=True),
        "mag_mp5": dict(color=(62, 64, 70), curved=1.25),
        "mag_uzi": dict(color=(66, 68, 70), curved=0.0),
        "mag_m249": dict(color=(86, 94, 62), box=True),
    }
    for g in GUNS:
        if not g.get("mag_name"):
            continue
        img = icons.magazine_icon(g["mag"], **mag_styles[g["mag"]])
        img.save(os.path.join(_mk(rp, "textures", NS, "items"), f"{g['mag']}.png"))
        item_tex[f"{NS}_{g['mag']}"] = {"textures": f"textures/{NS}/items/{g['mag']}"}
    for a in AMMO:
        img = icons.ammo_icon(a["colors"][0], a["colors"][1], shell=a["id"] == "shell_12g")
        img.save(os.path.join(_mk(rp, "textures", NS, "items"), f"{a['id']}.png"))
        item_tex[f"{NS}_{a['id']}"] = {"textures": f"textures/{NS}/items/{a['id']}"}
    w(os.path.join(rp, "textures", "item_texture.json"), {
        "resource_pack_name": "realistic_guns",
        "texture_name": "atlas.items",
        "texture_data": item_tex,
    })

    w(os.path.join(rp, "render_controllers", f"{NS}.render_controllers.json"), pg.render_controllers())

    # bullet entity (client side)
    w(os.path.join(rp, "entity", f"{NS}_bullet.entity.json"), pg.bullet_entity_rp())
    w(os.path.join(rp, "models", "entity", NS, "bullet.geo.json"), pg.bullet_geometry())
    w(os.path.join(rp, "animations", NS, "bullet.animation.json"), pg.bullet_animations())
    _bullet_texture().save(os.path.join(_mk(rp, "textures", NS, "entity"), "bullet.png"))

    # particles
    for name, eff in particles.effects().items():
        w(os.path.join(rp, "particles", NS, f"{name}.particle.json"), eff)
    for name, img in particles.textures().items():
        img.save(os.path.join(_mk(rp, "textures", NS, "particle"), f"{name}.png"))

    # sounds
    sdir = _mk(rp, "sounds", NS)
    defs = {}
    max_dist = {"Pistol": 64, "Submachine Gun": 64, "Assault Rifle": 96, "Light Machine Gun": 96,
                "Shotgun": 80, "Sniper Rifle": 160, "Heavy Sniper": 192}
    for g in GUNS:
        sounds.write_ogg(sounds.gunshot(g["sound"]), os.path.join(sdir, f"{g['id']}_fire.ogg"))
        defs[f"{NS}.{g['id']}.fire"] = {
            "category": "player",
            "min_distance": 4.0,
            "max_distance": float(max_dist[g["kind"]]),
            "sounds": [{"name": f"sounds/{NS}/{g['id']}_fire", "volume": 1.0, "load_on_low_memory": True}],
        }
    foley = {"dry": 0.8, "mag_out": 0.9, "mag_in": 1.0, "charge": 1.0, "bolt": 1.0, "pump": 1.0,
             "shell_in": 0.9, "hitmarker": 0.8}
    for k, vol in foley.items():
        sounds.write_ogg(sounds.click(k, seed=len(k) * 7), os.path.join(sdir, f"{k}.ogg"))
        defs[f"{NS}.{k}"] = {
            "category": "player",
            "min_distance": 2.0,
            "max_distance": 24.0,
            "sounds": [{"name": f"sounds/{NS}/{k}", "volume": vol, "load_on_low_memory": True}],
        }
    w(os.path.join(rp, "sounds", "sound_definitions.json"),
      {"format_version": "1.20.20", "sound_definitions": defs})

    # pack icon
    pack_icon(built, "rp").save(os.path.join(rp, "pack_icon.png"))


def build_bp(built):
    bp = BP_DIR
    w = pg.write_json
    w(os.path.join(bp, "manifest.json"), pg.bp_manifest())
    pg.write_text(os.path.join(bp, "texts", "en_US.lang"), pg.bp_lang())
    w(os.path.join(bp, "texts", "languages.json"), ["en_US"])
    for g in GUNS:
        w(os.path.join(bp, "items", NS, "guns", f"{g['id']}.item.json"), pg.gun_item(g))
        w(os.path.join(bp, "recipes", NS, f"{g['id']}.recipe.json"), pg.gun_recipe(g))
        if g.get("mag_name"):
            w(os.path.join(bp, "items", NS, "magazines", f"{g['mag']}.item.json"), pg.mag_item(g))
            w(os.path.join(bp, "recipes", NS, f"{g['mag']}.recipe.json"), pg.mag_recipe(g))
    for a in AMMO:
        w(os.path.join(bp, "items", NS, "ammo", f"{a['id']}.item.json"), pg.ammo_item(a))
        w(os.path.join(bp, "recipes", NS, f"{a['id']}.recipe.json"), pg.ammo_recipe(a))
    w(os.path.join(bp, "entities", NS, "bullet.entity.json"), pg.bullet_entity_bp())
    w(os.path.join(bp, "item_catalog", "crafting_item_catalog.json"), pg.crafting_catalog())
    # scripts: hand written sources + generated data module
    shutil.copytree(os.path.join(SRC_BP, "scripts"), os.path.join(bp, "scripts"), dirs_exist_ok=True)
    pg.write_text(os.path.join(bp, "scripts", "gun_data.js"), gun_data_js(built))
    pack_icon(built, "bp").save(os.path.join(bp, "pack_icon.png"))


def _mk(*parts):
    p = os.path.join(*parts)
    os.makedirs(p, exist_ok=True)
    return p


def _bullet_texture():
    from PIL import Image
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for x in range(16):
        for y in range(16):
            px[x, y] = (255, 214, 120, 255) if (x + y) % 3 else (255, 236, 170, 255)
    return img


_ICON_CACHE = {}


def pack_icon(built, which):
    if which in _ICON_CACHE:
        return _ICON_CACHE[which]
    by = {bg.spec["id"]: bg for bg in built}
    gid, sub = ("ak47", "RESOURCE PACK") if which == "rp" else ("barrett", "BEHAVIOR PACK")
    bg = by[gid]
    img = icons.gun_render(bg.geo, bg.tex, 236, tilt=18)
    _ICON_CACHE[which] = icons.pack_icon([(img, (10, -10))], subtitle=sub)
    return _ICON_CACHE[which]


def make_mcaddon():
    os.makedirs(os.path.dirname(DIST), exist_ok=True)
    if os.path.exists(DIST):
        os.remove(DIST)
    with zipfile.ZipFile(DIST, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for pack_dir, arc_root in ((BP_DIR, "RealisticGuns_BP"), (RP_DIR, "RealisticGuns_RP")):
            for base, dirs, files in os.walk(pack_dir):
                dirs.sort()
                for f in sorted(files):
                    full = os.path.join(base, f)
                    rel = os.path.relpath(full, pack_dir).replace(os.sep, "/")
                    info = zipfile.ZipInfo(f"{arc_root}/{rel}", date_time=(2025, 8, 6, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    with open(full, "rb") as fh:
                        z.writestr(info, fh.read())
    return DIST


def validate():
    """Sanity checks: every JSON parses, every referenced texture/sound exists."""
    problems = []
    for root in (BP_DIR, RP_DIR):
        for base, _, files in os.walk(root):
            for f in files:
                if f.endswith(".json"):
                    try:
                        with open(os.path.join(base, f), encoding="utf-8") as fh:
                            json.load(fh)
                    except Exception as e:  # noqa: BLE001
                        problems.append(f"bad json {os.path.join(base, f)}: {e}")
    def exists_tex(path):
        return os.path.exists(os.path.join(RP_DIR, path + ".png"))
    with open(os.path.join(RP_DIR, "textures", "item_texture.json")) as fh:
        for k, v in json.load(fh)["texture_data"].items():
            if not exists_tex(v["textures"]):
                problems.append(f"missing item texture {v['textures']}")
    with open(os.path.join(RP_DIR, "sounds", "sound_definitions.json")) as fh:
        for k, v in json.load(fh)["sound_definitions"].items():
            for s in v["sounds"]:
                if not os.path.exists(os.path.join(RP_DIR, s["name"] + ".ogg")):
                    problems.append(f"missing sound {s['name']}")
    for base, _, files in os.walk(os.path.join(RP_DIR, "attachables")):
        for f in files:
            with open(os.path.join(base, f)) as fh:
                d = json.load(fh)["minecraft:attachable"]["description"]
            for t in d["textures"].values():
                if not t.startswith("textures/misc/") and not exists_tex(t):
                    problems.append(f"missing attachable texture {t}")
    for base, _, files in os.walk(os.path.join(RP_DIR, "particles")):
        for f in files:
            with open(os.path.join(base, f)) as fh:
                t = json.load(fh)["particle_effect"]["description"]["basic_render_parameters"]["texture"]
            if not exists_tex(t):
                problems.append(f"missing particle texture {t}")
    return problems


def render_previews(built):
    from gunlib.preview import turnaround, first_person, third_person
    from PIL import Image, ImageDraw
    out = _mk(ROOT, "docs", "previews")
    player = vanilla_player()
    fps = []
    for bg in built:
        gid = bg.spec["id"]
        turnaround(bg.geo, bg.tex, os.path.join(out, f"{gid}_turnaround.png"), size=(1000, 750),
                   title=bg.spec["name"])
        fp_pos, fp_rot = bg.fp
        img = first_person(bg.geo, bg.tex, player, {"pos": fp_pos, "rot": fp_rot},
                           os.path.join(out, f"{gid}_first_person.png"), size=(720, 324))
        ImageDraw.Draw(img).text((8, 6), bg.spec["name"], fill=(255, 255, 255, 255))
        fps.append(img)
        tp_pos, tp_rot = bg.tp
        third_person(bg.geo, bg.tex, player, {"pos": tp_pos, "rot": tp_rot},
                     os.path.join(out, f"{gid}_third_person.png"), eye=(-34, 24, -30), size=(420, 420))
    W, H = fps[0].size
    sheet = Image.new("RGBA", (W * 2, H * 5))
    for i, im in enumerate(fps):
        sheet.paste(im, ((i % 2) * W, (i // 2) * H))
    sheet.save(os.path.join(out, "first_person_all.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--previews", action="store_true")
    args = ap.parse_args()
    player = vanilla_player()
    log("Building gun models + textures ...")
    built = []
    for g in GUNS:
        bg = pg.build_gun(g, player)
        log(f"  {g['name']:<14} parts={len(bg.model.parts):3d}  texel density={bg.density}")
        built.append(bg)
    clean(BP_DIR)
    clean(RP_DIR)
    log("Writing resource pack ...")
    build_rp(built)
    log("Writing behavior pack ...")
    build_bp(built)
    problems = validate()
    if problems:
        for p in problems:
            log("PROBLEM: " + p)
        sys.exit(1)
    path = make_mcaddon()
    log(f"OK -> {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} KiB)")
    if args.previews:
        log("Rendering previews ...")
        render_previews(built)


if __name__ == "__main__":
    main()
