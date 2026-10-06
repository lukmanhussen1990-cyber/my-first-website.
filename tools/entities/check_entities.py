#!/usr/bin/env python3
"""Validate the horde entity definitions (BP) against SPEC §3 and the
Bedrock 1.21.0.26 reference.

Checks
  * strict JSON (no comments, trailing commas, NaN or duplicate keys)
  * format_version 1.21.0, description fields, identifiers == ids.js
  * every event's add/remove groups exist, every trigger / timer event exists,
    every component group is added by some event, event nodes well-formed
  * filters well-formed (known test, subject, operator, value type)
  * families per SPEC (and no vanilla species family)
  * required / forbidden components, door flags, damage_sensor friendly fire,
    pas:hunting / pas:dormant contents, exact SPEC targeting filter
  * variant / baby / sheared / born events and their groups
  * stats (health / attack / vanilla collision boxes)
  * loot tables exist, item ids exist in this build, functions/conditions
    are ones the vanilla loot tables of this build use
  * with the reference available: every component name and every field name
    we use appears in documentation/Entities.html or in a vanilla
    behavior_pack/entities/*.json of v1.21.0.26 (no invented fields)
  * generator outputs are up to date

Reference root: $PAS_VANILLA_REF, default = SPEC §0 $REF path.  Reference
based checks are skipped (with a message) when it is missing.

Exit code 0 = all good, 1 = errors.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BP = REPO / "addon" / "behavior_pack"
ENTITY_DIR = BP / "entities"
IDS_JS = BP / "scripts" / "lib" / "ids.js"
DEFAULT_REF = ("/tmp/claude-0/-home-user-my-first-website-/"
               "6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26")
REF = Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))

ERRORS: list[str] = []
NOTES: list[str] = []


def err(where: str, msg: str) -> None:
    ERRORS.append(f"{where}: {msg}")


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return str(path)


# ---------------------------------------------------------------------------
# Expectations (written independently of the generator, straight from SPEC)
# ---------------------------------------------------------------------------
SPEC_TARGET_FILTER = {
    "all_of": [
        {"any_of": [{"test": "is_family", "subject": "other", "value": f} for f in
                    ["player", "villager", "wandering_trader", "cow", "mushroomcow", "pig", "sheep", "chicken"]]},
        {"test": "is_family", "subject": "other", "operator": "!=", "value": "pas_horde"},
        {"test": "has_tag", "subject": "other", "operator": "!=", "value": "pas_incubating"},
        {"test": "has_tag", "subject": "other", "operator": "!=", "value": "pas_infected_player"},
    ]
}

# id -> expectations
EXPECT = {
    "pas:parasite": dict(health=12, attack=3, collision=None, species=None, baby=False,
                         variants={}, sheared=False, born=True, nav="minecraft:navigation.climb"),
    "pas:infected_villager": dict(health=24, attack=4, collision="villager_v2", species="villager", baby=True,
                                  variants={"pas:set_variant_": ("minecraft:variant", 15),
                                            "pas:set_mark_": ("minecraft:mark_variant", 7),
                                            "pas:set_skin_": ("minecraft:skin_id", 6)},
                                  sheared=False, born=False, nav="minecraft:navigation.walk"),
    "pas:infected_cow": dict(health=14, attack=4, collision="cow", species="cow", baby=True,
                             variants={"pas:set_variant_": ("minecraft:variant", 3)},
                             sheared=False, born=False, nav="minecraft:navigation.walk"),
    "pas:infected_pig": dict(health=14, attack=3, collision="pig", species="pig", baby=True,
                             variants={}, sheared=False, born=False, nav="minecraft:navigation.walk"),
    "pas:infected_sheep": dict(health=12, attack=3, collision="sheep", species="sheep", baby=True,
                               variants={"pas:set_color_": ("minecraft:color", 16)},
                               sheared=True, born=False, nav="minecraft:navigation.walk"),
    "pas:infected_chicken": dict(health=6, attack=2, collision="chicken", species="chicken", baby=True,
                                 variants={}, sheared=False, born=False, nav="minecraft:navigation.walk"),
    "pas:infected_human": dict(health=26, attack=5, collision="zombie", species="human", baby=False,
                               variants={}, sheared=False, born=False, nav="minecraft:navigation.walk"),
}
PARASITE_COLLISION = (0.8, 0.6)

REQUIRED_BASE = [
    "minecraft:type_family", "minecraft:persistent", "minecraft:nameable", "minecraft:physics",
    "minecraft:pushable", "minecraft:collision_box", "minecraft:health", "minecraft:attack",
    "minecraft:movement", "minecraft:movement.basic", "minecraft:jump.static", "minecraft:can_climb",
    "minecraft:damage_sensor", "minecraft:loot", "minecraft:experience_reward", "minecraft:breathable",
]
FORBIDDEN_ANYWHERE = [
    "minecraft:ageable", "minecraft:breedable", "minecraft:burns_in_daylight", "minecraft:despawn",
    "minecraft:instant_despawn", "minecraft:annotation.open_door", "minecraft:annotation.break_door",
    "minecraft:behavior.open_door", "minecraft:behavior.door_interact", "minecraft:behavior.break_door",
    "minecraft:behavior.restrict_open_door", "minecraft:behavior.flee_sun",
]
HUNTING_REQUIRED = [
    "minecraft:behavior.nearest_attackable_target", "minecraft:behavior.hurt_by_target",
    "minecraft:behavior.random_stroll", "minecraft:behavior.look_at_player",
    "minecraft:behavior.random_look_around", "minecraft:behavior.float",
]
MELEE = {"minecraft:behavior.melee_attack", "minecraft:behavior.melee_box_attack"}
FILTER_SUBJECTS = {"block", "damager", "other", "parent", "player", "self", "target"}
FILTER_OPERATORS = {"!=", "<", "<=", "<>", "=", "==", ">", ">=", "equals", "not"}
EVENT_NODE_KEYS = {"add", "remove", "sequence", "randomize", "trigger", "filters", "weight",
                   "set_property", "queue_command"}
STRING_VALUE_TESTS = {"is_family", "has_tag", "has_component"}
BOOL_VALUE_TESTS = {"in_lava", "in_water", "on_ground", "is_daytime"}


# ---------------------------------------------------------------------------
# JSON loading
# ---------------------------------------------------------------------------
def _no_dupes(pairs):
    out = {}
    for k, v in pairs:
        if k in out:
            raise ValueError(f"duplicate key {k!r}")
        out[k] = v
    return out


def _bad_const(name):
    raise ValueError(f"non-standard JSON constant {name}")


def load_strict(path: Path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text, object_pairs_hook=_no_dupes, parse_constant=_bad_const)


def strip_comments(s: str) -> str:
    """Vanilla files contain // comments and trailing commas."""
    out, i, n, ins = [], 0, len(s), False
    while i < n:
        c = s[i]
        if ins:
            out.append(c)
            if c == "\\":
                out.append(s[i + 1])
                i += 2
                continue
            if c == '"':
                ins = False
            i += 1
            continue
        if c == '"':
            ins = True
            out.append(c)
            i += 1
            continue
        if s.startswith("//", i):
            j = s.find("\n", i)
            i = n if j < 0 else j
            continue
        if s.startswith("/*", i):
            i = s.find("*/", i) + 2
            continue
        out.append(c)
        i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))


def load_lenient(path: Path):
    return json.loads(strip_comments(path.read_text(encoding="utf-8")))


# ---------------------------------------------------------------------------
# ids.js
# ---------------------------------------------------------------------------
def parse_ids_js() -> dict:
    src = IDS_JS.read_text(encoding="utf-8")

    def block(name):
        m = re.search(r"export const " + name + r"\s*=\s*Object\.freeze\(\{(.*?)\}\);", src, re.S)
        if not m:
            return {}
        body = m.group(1)
        out = {}
        for km in re.finditer(r"(\w+)\s*:\s*(\"[^\"]*\"|[A-Z_]+\.[A-Z_]+)", body):
            out[km.group(1)] = km.group(2)
        return out

    ents = {k: v.strip('"') for k, v in block("ENTITIES").items()}
    fams = {k: v.strip('"') for k, v in block("FAMILIES").items()}
    tags = {k: v.strip('"') for k, v in block("TAGS").items()}
    evs = {k: v.strip('"') for k, v in block("EVENTS").items()}
    return {"ENTITIES": ents, "FAMILIES": fams, "TAGS": tags, "EVENTS": evs}


# ---------------------------------------------------------------------------
# Reference vocabulary
# ---------------------------------------------------------------------------
class Ref:
    def __init__(self, root: Path):
        self.root = root
        self.ok = (root / "documentation" / "Entities.html").is_file() and \
                  (root / "behavior_pack" / "entities").is_dir()
        self.filter_tests: set[str] = set()
        self.doc_components: dict[str, set[str]] = {}
        self.doc_component_names: set[str] = set()
        self.vanilla_fields: dict[str, set[str]] = {}
        self.vanilla_families: set[str] = set()
        self.vanilla_entities: dict[str, dict] = {}
        self.vanilla_formats: dict[str, int] = {}
        self.items: set[str] = set()
        self.loot_functions: set[str] = set()
        self.loot_conditions: set[str] = set()
        self.loot_keys: set[str] = set()
        if self.ok:
            self._docs()
            self._vanilla()
            self._items()
            self._loot()

    # -- documentation/Entities.html
    def _docs(self):
        s = (self.root / "documentation" / "Entities.html").read_text(encoding="utf-8")
        heads = [(m.start(), m.group(1), m.group(2))
                 for m in re.finditer(r'<h([12])><p id="([^"]*)">', s)]
        h1 = [(pos, name) for pos, lvl, name in heads if lvl == "1"]
        in_filters = False
        for _, name in h1:
            if name == "Filters":
                in_filters = True
                continue
            if name == "Server Entity Documentation":
                break
            if in_filters:
                self.filter_tests.add(name)
        for idx, (pos, lvl, name) in enumerate(heads):
            if lvl != "2" or not name.startswith("minecraft:"):
                continue
            end = heads[idx + 1][0] if idx + 1 < len(heads) else len(s)
            body = s[pos:end]
            fields = set()
            for row in re.finditer(r"<tr>\s*<td[^>]*>(.*?)</td>", body, re.S):
                cell = html.unescape(re.sub(r"<[^>]+>", "", row.group(1))).strip()
                if cell:
                    fields.add(cell)
            self.doc_components.setdefault(name, set()).update(fields)
        for m in re.finditer(r"<td[^>]*>(minecraft:[a-z0-9_.]+)</td>", s):
            self.doc_component_names.add(m.group(1))
        self.doc_component_names.update(self.doc_components)

    # -- vanilla behavior_pack/entities
    def _vanilla(self):
        def fields_of(obj, acc):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    acc.add(k)
                    if k in ("filters", "event_filters"):
                        continue
                    fields_of(v, acc)
            elif isinstance(obj, list):
                for x in obj:
                    fields_of(x, acc)

        for p in sorted((self.root / "behavior_pack" / "entities").glob("*.json")):
            d = load_lenient(p)
            ent = d["minecraft:entity"]
            self.vanilla_entities[p.stem] = ent
            self.vanilla_formats[d.get("format_version", "?")] = self.vanilla_formats.get(d.get("format_version", "?"), 0) + 1
            blocks = [ent.get("components", {})] + list(ent.get("component_groups", {}).values())
            for b in blocks:
                for comp, val in b.items():
                    acc = self.vanilla_fields.setdefault(comp, set())
                    fields_of(val, acc)
                    if comp == "minecraft:type_family":
                        self.vanilla_families.update(val.get("family", []))

    def _items(self):
        p = self.root / "metadata" / "vanilladata_modules" / "mojang-items.json"
        if p.is_file():
            self.items = {i["name"] for i in json.loads(p.read_text(encoding="utf-8"))["data_items"]}

    def _loot(self):
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    self.loot_keys.add(k)
                    if k == "function":
                        self.loot_functions.add(v)
                    if k == "condition":
                        self.loot_conditions.add(v)
                    walk(v)
            elif isinstance(o, list):
                for x in o:
                    walk(x)
        for p in (self.root / "behavior_pack" / "loot_tables").rglob("*.json"):
            try:
                walk(load_lenient(p))
            except Exception:  # pragma: no cover - vanilla oddities
                pass

    def known_component(self, comp: str) -> bool:
        return comp in self.doc_component_names or comp in self.vanilla_fields

    def known_fields(self, comp: str) -> set[str]:
        out = set(self.doc_components.get(comp, set())) | set(self.vanilla_fields.get(comp, set()))
        if comp.startswith("minecraft:behavior."):
            out.add("priority")
        return out


# ---------------------------------------------------------------------------
# Generic structure helpers
# ---------------------------------------------------------------------------
def check_filter(node, where: str, ref: Ref | None) -> None:
    if isinstance(node, list):
        if not node:
            err(where, "empty filter list")
        for i, x in enumerate(node):
            check_filter(x, f"{where}[{i}]", ref)
        return
    if not isinstance(node, dict) or not node:
        err(where, f"filter must be a non-empty object, got {node!r}")
        return
    groups = [k for k in ("all_of", "any_of", "none_of") if k in node]
    if groups:
        extra = set(node) - {"all_of", "any_of", "none_of"}
        if extra:
            err(where, f"filter group has unexpected keys {sorted(extra)}")
        for g in groups:
            if not isinstance(node[g], list) or not node[g]:
                err(where, f"{g} must be a non-empty list")
                continue
            for i, x in enumerate(node[g]):
                check_filter(x, f"{where}.{g}[{i}]", ref)
        return
    allowed = {"test", "subject", "operator", "value", "domain"}
    extra = set(node) - allowed
    if extra:
        err(where, f"filter has unexpected keys {sorted(extra)}")
    test = node.get("test")
    if not isinstance(test, str):
        err(where, "filter without 'test'")
        return
    if ref and ref.ok and test not in ref.filter_tests:
        err(where, f"unknown filter test {test!r} (not in Entities.html Filters)")
    if "subject" in node and node["subject"] not in FILTER_SUBJECTS:
        err(where, f"bad subject {node['subject']!r}")
    if "operator" in node and node["operator"] not in FILTER_OPERATORS:
        err(where, f"bad operator {node['operator']!r}")
    if "value" not in node:
        err(where, "filter without 'value'")
    elif test in STRING_VALUE_TESTS and not isinstance(node["value"], str):
        err(where, f"{test} needs a string value")
    elif test in BOOL_VALUE_TESTS and not isinstance(node["value"], bool):
        err(where, f"{test} needs a boolean value")


def collect_filters(obj, path: str, out: list):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("filters", "event_filters"):
                out.append((f"{path}.{k}", v))
            else:
                collect_filters(v, f"{path}.{k}", out)
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            collect_filters(x, f"{path}[{i}]", out)


def event_ops(node, where: str, groups: set, events: set, acc: dict) -> None:
    """Walk an event node; validate and collect adds/removes/triggers."""
    if not isinstance(node, dict):
        err(where, "event node must be an object")
        return
    extra = set(node) - EVENT_NODE_KEYS
    if extra:
        err(where, f"unknown event node keys {sorted(extra)}")
    for kind in ("add", "remove"):
        if kind in node:
            v = node[kind]
            if not isinstance(v, dict) or set(v) - {"component_groups"}:
                err(where, f"{kind} must be {{component_groups: [...]}}")
                continue
            for g in v.get("component_groups", []):
                acc[kind].add(g)
                if g not in groups:
                    err(where, f"{kind} references missing group {g!r}")
    if "trigger" in node:
        t = node["trigger"]
        name = t if isinstance(t, str) else (t.get("event") if isinstance(t, dict) else None)
        if name not in events:
            err(where, f"trigger references missing event {name!r}")
    for kind in ("sequence", "randomize"):
        if kind in node:
            if not isinstance(node[kind], list) or not node[kind]:
                err(where, f"{kind} must be a non-empty list")
                continue
            for i, x in enumerate(node[kind]):
                event_ops(x, f"{where}.{kind}[{i}]", groups, events, acc)


def field_names(obj, acc: set, path: str, out: list):
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.append((path, k))
            if k in ("filters", "event_filters"):
                continue
            field_names(v, acc, f"{path}.{k}", out)
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            field_names(x, acc, f"{path}[{i}]", out)


def find_event_refs(obj, out: list, path: str = ""):
    """Events referenced from components (timer time_down_event, sensors…)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("event", "time_down_event", "on_damage") and isinstance(v, str):
                out.append((path + "." + k, v))
            find_event_refs(v, out, path + "." + k)
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            find_event_refs(x, out, f"{path}[{i}]")


def canon(o):
    if isinstance(o, dict):
        return {k: canon(v) for k, v in sorted(o.items())}
    if isinstance(o, list):
        items = [canon(x) for x in o]
        return sorted(items, key=lambda x: json.dumps(x, sort_keys=True))
    return o


# ---------------------------------------------------------------------------
# Per-entity checks
# ---------------------------------------------------------------------------
def check_entity(path: Path, ids: dict, ref: Ref | None) -> None:
    where = rel(path)
    try:
        doc = load_strict(path)
    except Exception as e:  # noqa: BLE001
        err(where, f"not strict JSON: {e}")
        return
    if set(doc) != {"format_version", "minecraft:entity"}:
        err(where, f"top-level keys {sorted(doc)}")
    if doc.get("format_version") != "1.21.0":
        err(where, f"format_version {doc.get('format_version')!r} != '1.21.0'")
    if ref and ref.ok and "1.21.0" not in ref.vanilla_formats:
        err(where, "reference has no vanilla entity with format 1.21.0?")
    ent = doc.get("minecraft:entity", {})
    if set(ent) - {"description", "component_groups", "components", "events"}:
        err(where, f"unexpected minecraft:entity keys {sorted(set(ent) - {'description', 'component_groups', 'components', 'events'})}")
    desc = ent.get("description", {})
    ident = desc.get("identifier")
    if ident not in EXPECT:
        err(where, f"unknown identifier {ident!r}")
        return
    if path.name != "pas_" + ident.split(":", 1)[1] + ".json":
        err(where, f"file name does not match identifier {ident}")
    if ident not in ids["ENTITIES"].values():
        err(where, f"{ident} not in ids.js ENTITIES")
    if desc.get("is_spawnable") is not False:
        err(where, "description.is_spawnable must be false")
    if desc.get("is_summonable") is not True:
        err(where, "description.is_summonable must be true")
    allowed_desc = {"identifier", "is_spawnable", "is_summonable", "properties"}
    if set(desc) - allowed_desc:
        err(where, f"description has unexpected keys {sorted(set(desc) - allowed_desc)} "
                   "(is_experimental is not used by any 1.21.0-format vanilla entity)")

    exp = EXPECT[ident]
    groups = ent.get("component_groups", {})
    comps = ent.get("components", {})
    events = ent.get("events", {})
    gnames, enames = set(groups), set(events)

    # ---- events / groups graph
    adds: dict[str, set] = {}
    removes: dict[str, set] = {}
    all_added: set = set()
    for ename, node in events.items():
        acc = {"add": set(), "remove": set()}
        event_ops(node, f"{where} event {ename}", gnames, enames, acc)
        adds[ename], removes[ename] = acc["add"], acc["remove"]
        all_added |= acc["add"]
    for g in gnames - all_added:
        err(where, f"component group {g!r} is never added by any event")
    refs: list = []
    find_event_refs(groups, refs)
    find_event_refs(comps, refs)
    for p, ev in refs:
        if ev not in enames:
            err(where, f"{p} references missing event {ev!r}")

    # ---- filters
    flist: list = []
    collect_filters(ent, "entity", flist)
    for p, f in flist:
        check_filter(f, f"{where} {p}", ref)

    # ---- forbidden components / AI placement
    blocks = [("components", comps)] + [(f"group {g}", b) for g, b in groups.items()]
    for label, b in blocks:
        for c in b:
            if c in FORBIDDEN_ANYWHERE:
                err(where, f"{label} contains forbidden {c}")
            if c == "minecraft:type_family" and label != "components":
                err(where, f"{label} overrides type_family")
            if ref and ref.ok and not ref.known_component(c):
                err(where, f"{label}: component {c} is not in Entities.html nor in any vanilla entity")
            if ref and ref.ok:
                known = ref.known_fields(c)
                names: list = []
                field_names(b[c], set(), c, names)
                for fp, fname in names:
                    if fname not in known:
                        err(where, f"{label}: field {fp}.{fname} not documented and not used by vanilla")
    for c in comps:
        if c.startswith("minecraft:behavior."):
            err(where, f"base components contain AI goal {c}; all AI belongs in pas:hunting")

    # ---- required base components
    for c in REQUIRED_BASE:
        if c not in comps:
            err(where, f"missing base component {c}")
    if exp["nav"] not in comps:
        err(where, f"missing {exp['nav']}")
    nav = comps.get(exp["nav"], {})
    if nav.get("can_pass_doors") is not True or nav.get("can_open_doors") is not False \
            or nav.get("can_break_doors") is not False:
        err(where, "navigation must have can_pass_doors true, can_open_doors false, can_break_doors false")
    for other in ("minecraft:navigation.walk", "minecraft:navigation.climb", "minecraft:navigation.generic"):
        if other != exp["nav"] and other in comps:
            err(where, f"unexpected second navigation {other}")

    # ---- families
    fam = comps.get("minecraft:type_family", {}).get("family", [])
    want = {"pas_horde", "monster", "mob"}
    if exp["species"] is None:
        want |= {"pas_parasite", "arthropod"}
    else:
        want |= {"pas_infected", f"pas_infected_{exp['species']}"}
    if set(fam) != want or len(fam) != len(set(fam)):
        err(where, f"families {fam} != {sorted(want)}")
    if ids["FAMILIES"]:
        if ids["FAMILIES"].get("HORDE") not in fam:
            err(where, "ids.js FAMILIES.HORDE missing from families")
    if ref and ref.ok:
        bad = (set(fam) & ref.vanilla_families) - {"monster", "mob", "arthropod"}
        if bad:
            err(where, f"vanilla species families used: {sorted(bad)}")

    # ---- stats
    hp = comps.get("minecraft:health", {})
    if hp.get("value") != exp["health"] or hp.get("max") != exp["health"]:
        err(where, f"health {hp} != {exp['health']}")
    if comps.get("minecraft:attack", {}).get("damage") != exp["attack"]:
        err(where, f"attack {comps.get('minecraft:attack')} != {exp['attack']}")
    mv = comps.get("minecraft:movement", {}).get("value", 0)
    if not (0 < mv < 0.5):
        err(where, f"implausible movement {mv}")
    cb = comps.get("minecraft:collision_box", {})
    if exp["collision"] is None:
        want_cb = PARASITE_COLLISION
    elif ref and ref.ok:
        v = ref.vanilla_entities[exp["collision"]]["components"]["minecraft:collision_box"]
        want_cb = (v["width"], v["height"])
    else:
        want_cb = None
    if want_cb and (cb.get("width"), cb.get("height")) != want_cb:
        err(where, f"collision_box {cb} != {want_cb}")
    if not isinstance(comps.get("minecraft:experience_reward", {}).get("on_death"), (str, int, float)):
        err(where, "experience_reward.on_death missing")
    if comps.get("minecraft:persistent") != {}:
        err(where, "minecraft:persistent must be {}")

    # ---- damage sensor (friendly fire + fall)
    trig = comps.get("minecraft:damage_sensor", {}).get("triggers")
    if not isinstance(trig, list):
        err(where, "damage_sensor.triggers must be a list")
        trig = []
    ff = [t for t in trig if t.get("deals_damage") is False and canon(t.get("on_damage", {}).get("filters")) ==
          canon({"test": "is_family", "subject": "other", "value": "pas_horde"}) and "cause" not in t]
    if len(ff) != 1:
        err(where, "damage_sensor needs exactly one all-cause trigger: other is_family pas_horde -> deals_damage false")
    for t in trig:
        if "deals_damage" in t and not isinstance(t["deals_damage"], bool):
            err(where, "deals_damage must be a boolean in 1.21.0")
    fall = any(t.get("cause") == "fall" and t.get("deals_damage") is False for t in trig)
    if ident in ("pas:parasite", "pas:infected_chicken") and not fall:
        err(where, "must be immune to fall damage")

    # ---- pas:hunting
    hunt = groups.get("pas:hunting")
    if hunt is None:
        err(where, "missing component group pas:hunting")
        hunt = {}
    for c in HUNTING_REQUIRED:
        if c not in hunt:
            err(where, f"pas:hunting lacks {c}")
    if not (MELEE & set(hunt)):
        err(where, "pas:hunting lacks a melee attack goal")
    if ident == "pas:parasite":
        if "minecraft:behavior.leap_at_target" not in hunt:
            err(where, "parasite pas:hunting lacks leap_at_target")
        if "minecraft:can_climb" not in comps or exp["nav"] != "minecraft:navigation.climb":
            err(where, "parasite must climb like a spider")
    nat = hunt.get("minecraft:behavior.nearest_attackable_target", {})
    if nat.get("must_see") is not False or nat.get("reselect_targets") is not True:
        err(where, "nearest_attackable_target needs must_see false and reselect_targets true")
    if not (16 <= float(nat.get("within_radius", 0)) <= 32):
        err(where, "nearest_attackable_target within_radius should be ~24")
    et = nat.get("entity_types", [])
    if len(et) != 1 or canon(et[0].get("filters")) != canon(SPEC_TARGET_FILTER):
        err(where, "nearest_attackable_target filter is not exactly the SPEC §3 filter")
    hbt = hunt.get("minecraft:behavior.hurt_by_target", {}).get("entity_types", [])
    if not hbt or any(canon(x.get("filters")) != canon(
            {"test": "is_family", "subject": "other", "operator": "!=", "value": "pas_horde"}) for x in hbt):
        err(where, "hurt_by_target must exclude pas_horde")
    for label, b in blocks:
        if label != "group pas:hunting" and any(
                c in b for c in {"minecraft:behavior.nearest_attackable_target", "minecraft:behavior.hurt_by_target",
                                 "minecraft:behavior.leap_at_target"} | MELEE):
            err(where, f"targeting/combat AI outside pas:hunting ({label})")

    # ---- pas:dormant
    dorm = groups.get("pas:dormant")
    if dorm is None:
        err(where, "missing component group pas:dormant")
        dorm = {}
    if dorm.get("minecraft:movement", {}).get("value") != 0:
        err(where, "pas:dormant must set movement 0")
    beh = {c for c in dorm if c.startswith("minecraft:behavior.")}
    if beh - {"minecraft:behavior.look_at_player"}:
        err(where, f"pas:dormant has AI goals {sorted(beh)}")

    # ---- lifecycle events
    for e in ("minecraft:entity_spawned", "minecraft:entity_born", "minecraft:entity_transformed"):
        if e not in events or "pas:hunting" not in adds.get(e, set()):
            err(where, f"{e} must add pas:hunting")
    ev_dormant = ids["EVENTS"].get("DORMANT", "pas:become_dormant")
    ev_active = ids["EVENTS"].get("ACTIVE", "pas:become_active")
    if adds.get(ev_dormant) != {"pas:dormant"} or removes.get(ev_dormant) != {"pas:hunting"}:
        err(where, f"{ev_dormant} must remove pas:hunting and add pas:dormant")
    if adds.get(ev_active) != {"pas:hunting"} or removes.get(ev_active) != {"pas:dormant"}:
        err(where, f"{ev_active} must remove pas:dormant and add pas:hunting")

    # ---- baby
    ev_baby = ids["EVENTS"].get("MAKE_BABY", "pas:make_baby")
    if exp["baby"]:
        if ev_baby not in events:
            err(where, f"missing {ev_baby}")
        else:
            for g in adds[ev_baby]:
                b = groups.get(g, {})
                if "minecraft:is_baby" not in b or b.get("minecraft:scale", {}).get("value") != 0.5:
                    err(where, f"baby group {g} needs is_baby + scale 0.5")
                if "minecraft:collision_box" in b:
                    cbb = b["minecraft:collision_box"]
                    eff = (cbb["width"] * 0.5, cbb["height"] * 0.5)
                    adult = (cb.get("width"), cb.get("height"))
                    if abs(eff[0] - adult[0] / 2) > 1e-6 or abs(eff[1] - adult[1] / 2) > 1e-6:
                        err(where, "baby collision would not be half the adult box "
                                   "(scale already scales the collision box)")
    elif ev_baby in events:
        err(where, f"{ev_baby} not expected on {ident}")

    # ---- indexed variants
    for prefix, (comp, count) in exp["variants"].items():
        kind_groups: dict[int, str] = {}
        for i in range(count):
            ev = f"{prefix}{i}"
            if ev not in events:
                err(where, f"missing event {ev}")
                continue
            a = adds[ev]
            if len(a) != 1:
                err(where, f"{ev} must add exactly one group, adds {sorted(a)}")
                continue
            g = next(iter(a))
            kind_groups[i] = g
            if groups.get(g, {}).get(comp, {}).get("value") != i or len(groups.get(g, {})) != 1:
                err(where, f"{ev} -> {g} must contain only {comp} {{value: {i}}}")
        for i, g in kind_groups.items():
            others = {kind_groups[j] for j in kind_groups if j != i}
            if removes[f"{prefix}{i}"] != others:
                err(where, f"{prefix}{i} must remove exactly the other {len(others)} groups of its kind")
        extra = {e for e in events if e.startswith(prefix)} - {f"{prefix}{i}" for i in range(count)}
        if extra:
            err(where, f"unexpected events {sorted(extra)}")
        if comps.get(comp, {}).get("value") != 0:
            err(where, f"base default {comp} 0 missing")
    for prefix in ("pas:set_variant_", "pas:set_mark_", "pas:set_skin_", "pas:set_color_"):
        if prefix not in exp["variants"] and any(e.startswith(prefix) for e in events):
            err(where, f"{prefix}* not expected on {ident}")

    ev_sheared = ids["EVENTS"].get("SET_SHEARED", "pas:set_sheared")
    if exp["sheared"]:
        if ev_sheared not in events or not any("minecraft:is_sheared" in groups.get(g, {}) for g in adds[ev_sheared]):
            err(where, f"{ev_sheared} must add a group with minecraft:is_sheared")
    elif ev_sheared in events:
        err(where, f"{ev_sheared} not expected")
    ev_born = ids["EVENTS"].get("BORN", "pas:born")
    if exp["born"] != (ev_born in events):
        err(where, f"{ev_born} presence wrong")

    # ---- loot tables
    tables = [b["minecraft:loot"]["table"] for _, b in blocks if "minecraft:loot" in b]
    for t in tables:
        check_loot(BP / t, ref)


CHECKED_LOOT: set = set()


def check_loot(path: Path, ref: Ref | None) -> None:
    where = rel(path)
    if path in CHECKED_LOOT:
        return
    CHECKED_LOOT.add(path)
    if not path.is_file():
        err(where, "referenced loot table does not exist")
        return
    try:
        d = load_strict(path)
    except Exception as e:  # noqa: BLE001
        err(where, f"not strict JSON: {e}")
        return
    pools = d.get("pools")
    if not isinstance(pools, list) or not pools:
        err(where, "pools must be a non-empty list")
        return
    for i, p in enumerate(pools):
        if not p.get("entries"):
            err(where, f"pool {i} has no entries")
        for e in p.get("entries", []):
            name = e.get("name")
            if e.get("type") != "item" or not isinstance(name, str):
                err(where, f"pool {i}: bad entry {e}")
            elif ref and ref.ok and ref.items and name not in ref.items:
                err(where, f"pool {i}: item {name} does not exist in this build")
            for f in e.get("functions", []):
                if ref and ref.ok and f.get("function") not in ref.loot_functions:
                    err(where, f"pool {i}: loot function {f.get('function')} unused by vanilla")
        for c in p.get("conditions", []):
            if ref and ref.ok and c.get("condition") not in ref.loot_conditions:
                err(where, f"pool {i}: loot condition {c.get('condition')} unused by vanilla")
    if ref and ref.ok:
        keys: set = set()

        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    keys.add(k)
                    walk(v)
            elif isinstance(o, list):
                for x in o:
                    walk(x)
        walk(d)
        unknown = keys - ref.loot_keys
        if unknown:
            err(where, f"loot keys never used by vanilla loot tables: {sorted(unknown)}")


# ---------------------------------------------------------------------------
def main() -> int:
    ids = parse_ids_js()
    if not ids["ENTITIES"]:
        err("ids.js", "could not parse ENTITIES")
    ref = Ref(REF) if REF.exists() else None
    if ref is None or not ref.ok:
        NOTES.append(f"SKIP reference checks: {REF} not found (set PAS_VANILLA_REF)")
        ref = None

    files = sorted(ENTITY_DIR.glob("*.json"))
    seen = set()
    for p in files:
        check_entity(p, ids, ref)
        try:
            seen.add(load_strict(p)["minecraft:entity"]["description"]["identifier"])
        except Exception:  # noqa: BLE001
            pass
    for ident in ids["ENTITIES"].values():
        if ident not in seen:
            err("entities/", f"no definition for {ident} from ids.js")
    for lp in sorted((BP / "loot_tables" / "pas").rglob("*.json")):
        check_loot(lp, ref)
        if lp not in CHECKED_LOOT:
            pass
    unused = sorted(set((BP / "loot_tables" / "pas").rglob("*.json")) - CHECKED_LOOT)
    for u in unused:
        NOTES.append(f"loot table not referenced by any entity: {u.relative_to(REPO)}")

    # ids.js events used by the scripts must exist where SPEC says
    ev = ids["EVENTS"]
    for key in ("DORMANT", "ACTIVE", "BORN", "MAKE_BABY", "SET_SHEARED"):
        if key not in ev:
            err("ids.js", f"EVENTS.{key} missing")

    # generator freshness
    sys.dont_write_bytecode = True  # keep tools/entities free of __pycache__
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        import gen_entities  # type: ignore
        for path, text in gen_entities.outputs().items():
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                err(str(path.relative_to(REPO)), "out of date; run python3 tools/entities/gen_entities.py")
    except Exception as e:  # noqa: BLE001
        err("gen_entities.py", f"could not run generator: {e}")

    for n in NOTES:
        print("note:", n)
    if ref:
        print(f"reference: {REF} ({len(ref.vanilla_entities)} vanilla entities, "
              f"{len(ref.doc_components)} documented components, {len(ref.filter_tests)} filter tests)")
    print(f"checked {len(files)} entity files, {len(CHECKED_LOOT)} loot tables")
    if ERRORS:
        for e in ERRORS:
            print("ERROR", e)
        print(f"{len(ERRORS)} error(s)")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
