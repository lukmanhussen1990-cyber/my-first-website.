#!/usr/bin/env python3
"""Static checks for the eyeball guardian client files (run from anywhere).

    python3 tools/preview/check_client.py

* strict JSON parse of every file this checker covers
* every bone named in animations / part_visibility exists in the geometry
* every locator used by the animation controller exists
* every Molang expression parses and only uses whitelisted queries/functions
  (all of them used by vanilla 1.21.0 resource packs)
* render controller Texture.* / Material.* / Geometry.* keys exist in the
  client entity, every texture path resolves to a PNG (128x128)
* cube count <= 110, all UV rectangles inside the 64x64 UV space
Exit code 1 on any problem.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bedrock_render as br  # noqa: E402
from PIL import Image  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_RP")
FILES = {
    "geo": os.path.join(RP, "models", "entity", "eyeball_guardian.geo.json"),
    "anim": os.path.join(RP, "animations", "eyeball_guardian.animation.json"),
    "ac": os.path.join(RP, "animation_controllers", "eyeball_guardian.animation_controllers.json"),
    "rc": os.path.join(RP, "render_controllers", "eyeball_guardian.render_controllers.json"),
    "entity": os.path.join(RP, "entity", "eyeball_guardian.entity.json"),
}
QUERIES = {"query.life_time", "query.delta_time", "query.property", "query.target_x_rotation",
           "query.target_y_rotation", "query.anim_time"}
FUNCS = {"math.sin", "math.cos", "math.clamp", "math.mod", "math.lerp", "math.abs", "math.min", "math.max"}
problems = []


def strict_load(path):
    def bad_const(c):
        raise ValueError("non-JSON constant %s" % c)
    with open(path) as f:
        return json.load(f, parse_constant=bad_const)


def check_molang(expr, where):
    if isinstance(expr, (int, float, bool)):
        return
    for name in re.findall(r"\b(?:query|q)\.[a-z_]+", expr):
        if name.replace("q.", "query.") not in QUERIES:
            problems.append("%s: query not whitelisted: %s" % (where, name))
    for name in re.findall(r"\bmath\.[a-z_]+", expr):
        if name not in FUNCS:
            problems.append("%s: function not whitelisted: %s" % (where, name))
    for stmt in [s for s in expr.split(";") if s.strip()]:
        body = stmt.split("=", 1)[1] if re.match(r"\s*variable\.[a-z_]+\s*=[^=]", stmt) else stmt
        try:
            br.eval_molang(body, {"__props__": {"ceg:skin": 1, "ceg:rage": 1, "ceg:level": 3}})
        except Exception as e:  # noqa: BLE001
            problems.append("%s: molang does not parse: %r (%s)" % (where, stmt, e))


def walk_channels(obj, where):
    if isinstance(obj, dict):
        for k, v in obj.items():
            walk_channels(v, where + "/" + k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            walk_channels(v, "%s[%d]" % (where, i))
    elif isinstance(obj, str):
        check_molang(obj, where)


def main():
    data = {}
    for k, p in FILES.items():
        try:
            data[k] = strict_load(p)
        except Exception as e:  # noqa: BLE001
            problems.append("%s: JSON error %s" % (p, e))
    if problems:
        return finish()
    geo = data["geo"]["minecraft:geometry"][0]
    bones = {b["name"] for b in geo["bones"]}
    locators = set()
    for b in geo["bones"]:
        locators |= set(b.get("locators", {}))
        if b.get("parent") and b["parent"] not in bones:
            problems.append("bone %s has unknown parent %s" % (b["name"], b["parent"]))
    ncubes = sum(len(b.get("cubes", [])) for b in geo["bones"])
    if ncubes > 110:
        problems.append("too many cubes: %d" % ncubes)
    tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
    for b in geo["bones"]:
        for c in b.get("cubes", []):
            for face, fv in c["uv"].items():
                u, v = fv["uv"]
                su, sv = fv["uv_size"]
                for uu in (u, u + su):
                    if not (0 <= uu <= tw):
                        problems.append("uv out of range %s %s %s" % (b["name"], face, fv))
                for vv in (v, v + sv):
                    if not (0 <= vv <= th):
                        problems.append("uv out of range %s %s %s" % (b["name"], face, fv))
    # animations
    for aid, a in data["anim"]["animations"].items():
        for bone, chans in a.get("bones", {}).items():
            if bone not in bones:
                problems.append("%s animates unknown bone %s" % (aid, bone))
            walk_channels(chans, aid + "/" + bone)
    # client entity
    desc = data["entity"]["minecraft:client_entity"]["description"]
    for k in ("initialize", "pre_animation"):
        for i, s in enumerate(desc["scripts"].get(k, [])):
            check_molang(s, "entity scripts.%s[%d]" % (k, i))
    check_molang(desc["scripts"]["scale"], "entity scale")
    for entry in desc["scripts"]["animate"]:
        if isinstance(entry, dict):
            for name, cond in entry.items():
                check_molang(cond, "animate " + name)
                if name not in desc["animations"]:
                    problems.append("animate references unknown %s" % name)
        elif entry not in desc["animations"]:
            problems.append("animate references unknown %s" % entry)
    anim_ids = set(data["anim"]["animations"])
    ac_ids = set(data["ac"]["animation_controllers"])
    for short, full in desc["animations"].items():
        if full not in anim_ids and full not in ac_ids:
            problems.append("entity animation %s -> %s not defined" % (short, full))
    for tkey, tpath in desc["textures"].items():
        png = os.path.join(RP, tpath + ".png")
        if not os.path.exists(png):
            problems.append("missing texture %s" % png)
        else:
            im = Image.open(png)
            if im.size != (128, 128):
                problems.append("%s is %s, expected 128x128" % (png, im.size))
    # animation controller
    for cid, ctrl in data["ac"]["animation_controllers"].items():
        states = ctrl["states"]
        if ctrl["initial_state"] not in states:
            problems.append("%s: bad initial_state" % cid)
        for sname, st in states.items():
            for pe in st.get("particle_effects", []):
                if pe["effect"] not in desc.get("particle_effects", {}):
                    problems.append("%s/%s: effect %s not in entity particle_effects" % (cid, sname, pe["effect"]))
                if pe.get("locator") and pe["locator"] not in locators:
                    problems.append("%s/%s: unknown locator %s" % (cid, sname, pe["locator"]))
                if "pre_effect_script" in pe:
                    check_molang(pe["pre_effect_script"], "%s/%s pre_effect_script" % (cid, sname))
            for s in st.get("on_entry", []):
                check_molang(s, "%s/%s on_entry" % (cid, sname))
            for tr in st.get("transitions", []):
                for target, cond in tr.items():
                    if target not in states:
                        problems.append("%s/%s: transition to unknown %s" % (cid, sname, target))
                    check_molang(cond, "%s/%s transition" % (cid, sname))
    # render controllers
    for rid in desc["render_controllers"]:
        if rid not in data["rc"]["render_controllers"]:
            problems.append("render controller %s not defined" % rid)
    for rid, rc in data["rc"]["render_controllers"].items():
        text = json.dumps(rc)
        for key in re.findall(r"Texture\.([a-z_]+)", text):
            if key not in desc["textures"]:
                problems.append("%s: Texture.%s not in entity textures" % (rid, key))
        for key in re.findall(r"Material\.([a-z_]+)", text):
            if key not in desc["materials"]:
                problems.append("%s: Material.%s not in entity materials" % (rid, key))
        for key in re.findall(r"Geometry\.([a-z_]+)", text):
            if key not in desc["geometry"]:
                problems.append("%s: Geometry.%s not in entity geometry" % (rid, key))
        for pv in rc.get("part_visibility", []):
            for bone, cond in pv.items():
                if bone != "*" and bone not in bones:
                    problems.append("%s: part_visibility unknown bone %s" % (rid, bone))
                check_molang(cond, rid + " part_visibility")
        for t in rc.get("textures", []):
            m = re.match(r"Array\.([a-z_]+)\[(.*)\]$", t)
            if m:
                check_molang(m.group(2), rid + " texture index")
                arr = rc["arrays"]["textures"]["Array." + m.group(1)]
                for skin in range(4):
                    for rage in (0, 1):
                        idx = br.eval_molang(m.group(2), {"__props__": {"ceg:skin": skin, "ceg:rage": rage}})
                        if not 0 <= idx < len(arr):
                            problems.append("%s: index %s out of range" % (rid, idx))
                        elif "glow" in rid:
                            want = "%s_%s" % (["crimson", "void", "frost", "toxic"][skin], "rage" if rage else "glow")
                            if arr[int(idx)] != "Texture." + want:
                                problems.append("%s: skin %d rage %d -> %s" % (rid, skin, rage, arr[int(idx)]))
        if "color" in rc:
            for ch, v in rc["color"].items():
                check_molang(v, rid + " color." + ch)
    print("checked: %d bones, %d cubes, %d animations, %d textures" % (len(bones), ncubes, len(anim_ids), len(desc["textures"])))
    return finish()


def finish():
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("OK - no problems found")


if __name__ == "__main__":
    main()
