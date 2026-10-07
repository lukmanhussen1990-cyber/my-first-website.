"""
validate.py - static checks for the built packs (run after build.py).

    python3 tools/validate.py [path/to/bedrock-samples]

Cross-checks every reference in the add-on: manifests, items -> icons ->
textures, attachables -> geometry / animations / bones / render controller,
geometry UVs -> texture size, glow alpha rules, sound and particle ids used
by the scripts, recipes, the player entity patch and the .mcaddon layout.
With Mojang's bedrock-samples checkout it also checks vanilla sound /
particle ids the script plays.
"""

import glob
import json
import os
import re
import sys
import zipfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
NS = "magic_guns"
errors = []
checks = 0


def err(msg):
    errors.append(msg)


def ok(cond, msg):
    global checks
    checks += 1
    if not cond:
        err(msg)
    return cond


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main(samples=None):
    # 1. every JSON parses
    for path in glob.glob(os.path.join(ROOT, "*_pack", "**", "*.json"), recursive=True):
        try:
            load(path)
        except Exception as e:  # noqa: BLE001
            err(f"bad JSON {path}: {e}")

    # 2. manifests
    bpm, rpm = load(os.path.join(BP, "manifest.json")), load(os.path.join(RP, "manifest.json"))
    uuids = [bpm["header"]["uuid"], rpm["header"]["uuid"]] + [m["uuid"] for m in bpm["modules"] + rpm["modules"]]
    ok(len(set(uuids)) == len(uuids), "manifest UUIDs are not unique")
    ok({"uuid": rpm["header"]["uuid"], "version": rpm["header"]["version"]} in bpm["dependencies"], "BP does not depend on RP")
    ok({"uuid": bpm["header"]["uuid"], "version": bpm["header"]["version"]} in rpm["dependencies"], "RP does not depend on BP")
    script = [m for m in bpm["modules"] if m["type"] == "script"][0]
    ok(os.path.exists(os.path.join(BP, script["entry"])), "script entry missing")
    ok(any(d.get("module_name") == "@minecraft/server" and d.get("version") == "1.11.0" for d in bpm["dependencies"]),
       "@minecraft/server 1.11.0 dependency missing")
    for pack in (BP, RP):
        ok(os.path.exists(os.path.join(pack, "pack_icon.png")), f"pack_icon missing in {pack}")

    # 3. items -> icons -> textures, names -> lang
    item_tex = load(os.path.join(RP, "textures", "item_texture.json"))["texture_data"]
    lang = dict(line.split("=", 1) for line in open(os.path.join(RP, "texts", "en_US.lang"), encoding="utf-8").read().splitlines() if "=" in line)
    items = {}
    for path in glob.glob(os.path.join(BP, "items", "*.json")):
        it = load(path)["minecraft:item"]
        ident = it["description"]["identifier"]
        items[ident] = it
        comps = it["components"]
        key = comps["minecraft:icon"]["textures"]["default"]
        if ok(key in item_tex, f"{ident}: icon key {key} not in item_texture.json"):
            ok(os.path.exists(os.path.join(RP, item_tex[key]["textures"] + ".png")), f"{ident}: icon png missing")
        ok(comps["minecraft:display_name"]["value"] in lang, f"{ident}: display name not in en_US.lang")
    guns = [i for i in items if i != f"{NS}:mana_crystal"]
    ok(len(guns) == 7, f"expected 7 guns, found {len(guns)}")

    # 4. recipes
    for path in glob.glob(os.path.join(BP, "recipes", "*.json")):
        r = load(path)
        body = r.get("minecraft:recipe_shaped") or r.get("minecraft:recipe_shapeless")
        ok("unlock" in body, f"{path}: recipe without unlock")
        res = body["result"]["item"]
        ok(res in items, f"{path}: result {res} is not a pack item")
        if "pattern" in body:
            chars = {c for row in body["pattern"] for c in row if c != " "}
            ok(chars == set(body["key"]), f"{path}: pattern/key mismatch")
            ok(len({len(row) for row in body["pattern"]}) == 1, f"{path}: ragged pattern")
        ings = [v["item"] for v in (body.get("key") or {}).values()] + [i["item"] for i in body.get("ingredients", [])]
        for i in ings:
            if i.startswith(NS + ":"):
                ok(i in items, f"{path}: unknown ingredient {i}")

    # 5. animations / render controllers available
    anims = {}
    for path in glob.glob(os.path.join(RP, "animations", "*.json")):
        anims.update(load(path)["animations"])
    rcs = {}
    for path in glob.glob(os.path.join(RP, "render_controllers", "*.json")):
        rcs.update(load(path)["render_controllers"])
    geos = {}
    for path in glob.glob(os.path.join(RP, "models", "**", "*.geo.json"), recursive=True):
        for g in load(path)["minecraft:geometry"]:
            geos[g["description"]["identifier"]] = g

    # 6. attachables -> geometry, textures, animations, bones
    atts = {}
    for path in glob.glob(os.path.join(RP, "attachables", "**", "*.json"), recursive=True):
        d = load(path)["minecraft:attachable"]["description"]
        atts[d["identifier"]] = d
    for g in guns:
        if not ok(g in atts, f"{g}: no attachable"):
            continue
        d = atts[g]
        geo = geos.get(d["geometry"]["default"])
        if not ok(geo is not None, f"{g}: geometry {d['geometry']['default']} missing"):
            continue
        bones = {b["name"]: b for b in geo["bones"]}
        ok(any("binding" in b for b in geo["bones"]), f"{g}: no bound root bone")
        for b in geo["bones"]:
            if "parent" in b:
                ok(b["parent"] in bones, f"{g}: bone {b['name']} has unknown parent {b['parent']}")
        for rc in d["render_controllers"]:
            ok(rc in rcs or rc.startswith("controller.render.item_default"), f"{g}: render controller {rc} missing")
        for mat_key in ("default", "enchanted", "glow"):
            ok(mat_key in d["materials"], f"{g}: material {mat_key} missing")
        tex_path = os.path.join(RP, d["textures"]["default"] + ".png")
        if not ok(os.path.exists(tex_path), f"{g}: texture {tex_path} missing"):
            continue
        img = np.asarray(Image.open(tex_path).convert("RGBA"))
        H, W = img.shape[:2]
        desc = geo["description"]
        ok((W, H) == (desc["texture_width"], desc["texture_height"]), f"{g}: texture size {W}x{H} != geometry")
        ok(W & (W - 1) == 0 and H & (H - 1) == 0 and max(W, H) <= 256, f"{g}: texture {W}x{H} not pow2/<=256")
        used = np.zeros((H, W), bool)
        for b in geo["bones"]:
            glow_bone = b["name"].startswith("glow_")
            for c in b.get("cubes", []):
                for face, fd in c["uv"].items():
                    u, v = fd["uv"]
                    w, h = fd["uv_size"]
                    u0, u1 = sorted((u, u + w))
                    v0, v1 = sorted((v, v + h))
                    if not ok(0 <= u0 and u1 <= W and 0 <= v0 and v1 <= H, f"{g}: uv out of bounds in {b['name']}"):
                        continue
                    rect = img[int(v0):int(v1), int(u0):int(u1)]
                    used[int(v0):int(v1), int(u0):int(u1)] = True
                    if not glow_bone:
                        ok((rect[..., 3] >= 128).all(), f"{g}: alpha-test bone {b['name']} has see-through texels")
        # each face rect carries a 1-texel bleed guard (incl. corners): count it as used
        pad = np.zeros((H + 2, W + 2), bool)
        for dy in range(3):
            for dx in range(3):
                pad[dy:dy + H, dx:dx + W] |= used
        unused = img[~pad[1:H + 1, 1:W + 1]]
        ok((unused == 0).all(), f"{g}: unused texels are not (0,0,0,0)")
        # animations referenced exist and touch real bones
        for short, full in d["animations"].items():
            if ok(full in anims, f"{g}: animation {full} missing"):
                for bone in anims[full].get("bones", {}):
                    ok(bone in bones, f"{g}: animation {full} drives unknown bone {bone}")
        for entry in d["scripts"]["animate"]:
            name = entry if isinstance(entry, str) else next(iter(entry))
            ok(name in d["animations"], f"{g}: animate entry {name} not declared")

    # 7. sounds
    sdefs = load(os.path.join(RP, "sounds", "sound_definitions.json"))["sound_definitions"]
    for sid, sd in sdefs.items():
        for s in sd["sounds"]:
            name = s["name"] if isinstance(s, dict) else s
            ok(os.path.exists(os.path.join(RP, name + ".ogg")), f"sound file {name}.ogg missing")
    js = "".join(open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(BP, "scripts", "*.js")))
    used_sounds = set(re.findall(r'"((?:magic_guns|random|mob|ambient|item|block|note|firework|beacon)\.[a-z_.]+)"', js))
    vanilla_sounds = set()
    vanilla_particles = set()
    if samples:
        vanilla_sounds = set(load(os.path.join(samples, "resource_pack", "sounds", "sound_definitions.json"))["sound_definitions"])
        for p in glob.glob(os.path.join(samples, "resource_pack", "particles", "*.json")):
            # some vanilla files are lenient JSON (trailing commas): read the id with a regex
            vanilla_particles.update(re.findall(r'"identifier"\s*:\s*"([^"]+)"', open(p, encoding="utf-8").read()))
    for sid in used_sounds:
        if sid.startswith(NS + "."):
            ok(sid in sdefs, f"script plays undefined sound {sid}")
        elif samples:
            ok(sid in vanilla_sounds, f"script plays unknown vanilla sound {sid}")

    # 8. particles
    customs = {load(p)["particle_effect"]["description"]["identifier"] for p in glob.glob(os.path.join(RP, "particles", "*.json"))}
    # particle ids: fx(dim, "id", ...), particle: "id", trail: "id", impact: "id"
    pids = set(re.findall(r'fx\([^,]+,\s*"([a-z_]+:[a-z_]+)"', js))
    pids |= set(re.findall(r'(?:particle|trail|impact):\s*"([a-z_]+:[a-z_]+)"', js))
    for pid in pids:
        if pid.startswith(NS + ":"):
            if pid.split(":")[1] in {i.split(":")[1] for i in items}:
                continue  # item id, not a particle
            ok(pid in customs, f"script spawns undefined particle {pid}")
        elif samples and pid in ("minecraft:large_explosion", "minecraft:snowflake_particle", "minecraft:soul_particle",
                                 "minecraft:portal_reverse_particle", "minecraft:totem_particle",
                                 "minecraft:electric_spark_particle"):
            ok(pid in vanilla_particles, f"script spawns unknown vanilla particle {pid}")
    for p in glob.glob(os.path.join(RP, "particles", "*.json")):
        tex = load(p)["particle_effect"]["description"]["basic_render_parameters"]["texture"]
        ok(os.path.exists(os.path.join(RP, tex + ".png")), f"{p}: particle texture missing")

    # 9. weapons in script == items, cooldown categories match
    script_guns = set(re.findall(r'id: "(magic_guns:[a-z_]+)"', js))
    ok(script_guns == set(guns), f"script weapons {sorted(script_guns)} != items {sorted(guns)}")
    for g in guns:
        cd = items[g]["components"].get("minecraft:cooldown", {})
        ok(cd.get("category") == g.replace(":", "_"), f"{g}: cooldown category mismatch")
        m = re.search(r'id: "%s",.*?cooldown: (\d+),' % re.escape(g), js, re.S)
        if ok(m is not None, f"{g}: cooldown not found in script"):
            ok(abs(int(m.group(1)) / 20 - cd.get("duration", -1)) < 1e-6, f"{g}: item cooldown != script cooldown")

    # 10. player entity patch
    pe = load(os.path.join(RP, "entity", "player.entity.json"))["minecraft:client_entity"]["description"]
    for k in ("magic_guns_aim_pistol", "magic_guns_aim_rifle"):
        ok(pe["animations"].get(k) in anims, f"player animation {k} missing")
    ok(pe.get("enable_attachables") is True, "player lost enable_attachables")

    # 11. packaged add-on layout
    with zipfile.ZipFile(os.path.join(ROOT, "dist", "MagicGuns.mcaddon")) as z:
        names = z.namelist()
        ok("MagicGuns_BP/manifest.json" in names and "MagicGuns_RP/manifest.json" in names, ".mcaddon layout wrong")
        ok(not any("__pycache__" in n for n in names), ".mcaddon contains junk")
    for mp in ("MagicGuns_BP.mcpack", "MagicGuns_RP.mcpack"):
        with zipfile.ZipFile(os.path.join(ROOT, "dist", mp)) as z:
            ok("manifest.json" in z.namelist(), f"{mp}: manifest not at root")

    print(f"{checks} checks, {len(errors)} problems")
    for e in errors:
        print("  -", e)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else None))
