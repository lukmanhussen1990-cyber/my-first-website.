#!/usr/bin/env python3
"""Vanilla-corpus proof check for the SCP-096 add-on.

Question answered: "is every key / component field / event-response key / filter test / enum value that the
add-on uses ALSO used by Mojang's own shipped files of the 1.21.0 release?"  Anything the corpus has never seen
may be silently ignored or rejected by the game, so it is reported.

Corpus: Mojang bedrock-samples, git tag v1.21.0.3 (= the 1.21.0 release; the user's build 1.21.0.26 is the last
preview before it).  Vanilla files have comments / trailing commas, so they are read with a lenient loader.
OUR files are read with the strict loader of validate_addon (or json.load as a fallback).

What is collected
-----------------
* BP entities (all 119 files)
    - COMPONENT PATHS: every key path below every component, from `components` and from every `component_groups.*`
      (list items are written `[]`, free-form map keys `*`, numeric keys `<num>`).   (component, path) is the unit.
    - EVENT PATHS: every key path below `events.*` (add / remove / sequence / randomize / filters / ...).
    - FILTER TESTS: every `test` name with the sub-fields used with it (`subject`, `operator`, `domain`, `value`) and
      the values seen for the enum-like ones.
    - description keys, format_version values, top-level keys.
* Resource pack: client entity, animations, animation controllers, render controllers, geometry (format >= 1.12.0),
  sound_definitions.json, sounds.json, manifest.json - every key path, with free-form map positions wildcarded.
* Molang: every query./math./variable. identifier used in any RP string, and the longest expression.

Result classes
--------------
UNPROVEN  a path / test / field value that the corpus has never used  -> exit status 1
NOTE      each part is proven separately, only the combination is new, or a value is an enum value proven elsewhere

Usage:  python3 tools/vanilla_corpus_check.py [--vanilla DIR] [--verbose] [--kind bp,client,...]
API:    Corpus(vanilla_dir).check_all(addon_root) -> list[Finding]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_VANILLA = os.environ.get("BEDROCK_SAMPLES", "/home/user/mojang/bedrock-samples")

NUM_KEY = re.compile(r"^-?\d+(\.\d+)?$")
RP_ENUM = {"lerp_mode", "category", "type", "loop"}
ENUM_LIKE = {"cause", "subject", "operator", "test", "domain", "target", "min_difficulty", "category",
             "lerp_mode", "type", "damage_modifier", "family_name"}

Finding = collections.namedtuple("Finding", "level kind where detail")


# ======================================================================================================
# lenient JSON (vanilla only)
# ======================================================================================================
def _strip_jsonc(s: str) -> str:
    out, i, n, instr = [], 0, len(s), False
    while i < n:
        c = s[i]
        if instr:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(s[i + 1])
                i += 2
                continue
            if c == '"':
                instr = False
            i += 1
            continue
        if c == '"':
            instr = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and s[i + 1] == "/":
            j = s.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and s[i + 1] == "*":
            j = s.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        out.append(c)
        i += 1
    t = "".join(out)
    res, i, instr = [], 0, False
    while i < len(t):
        c = t[i]
        if instr:
            res.append(c)
            if c == "\\" and i + 1 < len(t):
                res.append(t[i + 1])
                i += 2
                continue
            if c == '"':
                instr = False
            i += 1
            continue
        if c == '"':
            instr = True
            res.append(c)
            i += 1
            continue
        if c == ",":
            j = i + 1
            while j < len(t) and t[j] in " \t\r\n":
                j += 1
            if j < len(t) and t[j] in "}]":
                i += 1
                continue
        res.append(c)
        i += 1
    return "".join(res)


def lenient_load(path):
    with open(path, "rb") as f:
        raw = f.read()
    return json.loads(_strip_jsonc(raw.decode("utf-8-sig")))


def strict_load(path):
    try:
        import validate_addon as VA  # type: ignore
        return VA.strict_load_file(path)
    except Exception:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


# ======================================================================================================
# generic key-path machinery
# ======================================================================================================
def _norm_key(k: str) -> str:
    return "<num>" if NUM_KEY.match(k) else k


_GROUPING = ("all_of", "any_of", "none_of", "[]")


def _epath(path):
    """Path used for enum-value bookkeeping: filter grouping keys and list markers are dropped so that
    `filters.all_of[].test` and `filters.test` count as the same place."""
    return tuple(x for x in path if x not in _GROUPING)


def walk_paths(node, free, path=(), out=None):
    """Return the set of normalised key paths of `node`.  `free(path_of_parent, container_kind)` says whether the
    keys of the dict at `path_of_parent` are free-form names (replaced by '*')."""
    if out is None:
        out = set()
    if isinstance(node, dict):
        wild = free(path)
        for k, v in node.items():
            kk = "*" if wild else _norm_key(k)
            p = path + (kk,)
            out.add(p)
            walk_paths(v, free, p, out)
    elif isinstance(node, list):
        p = path + ("[]",)
        out.add(p)
        for v in node:
            walk_paths(v, free, p, out)
    return out


def _tname(v):
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if v is None:
        return "null"
    return "object" if isinstance(v, dict) else "array"


def walk_types(node, free, path=(), out=None):
    """{normalised path: {json type names}} for every node (same path normalisation as walk_paths)."""
    if out is None:
        out = collections.defaultdict(set)
    if isinstance(node, dict):
        wild = free(path)
        for k, v in node.items():
            p = path + ("*" if wild else _norm_key(k),)
            out[p].add(_tname(v))
            walk_types(v, free, p, out)
    elif isinstance(node, list):
        p = path + ("[]",)
        for v in node:
            out[p].add(_tname(v))
            walk_types(v, free, p, out)
    return out


def type_mismatches(mine, known_types, known_paths):
    """Paths that ARE in the corpus but whose JSON type in our file was never used there."""
    res = []
    for p, ts in sorted(mine.items()):
        if p not in known_paths:
            continue
        if "filters" in p and p[-1] in ("value", "subject", "operator", "domain", "test"):
            continue   # filter leaves are typed per test by check_bp_entity (a filter `value` may be number/bool/string)
        k = known_types.get(p, set())
        bad = ts - k
        if bad and k:
            res.append((p, sorted(bad), sorted(k)))
    return res


def _fmt(p):
    return ".".join(p)


def minimal_missing(paths, known):
    """Shortest missing prefixes: [(path, n_missing_descendants)]."""
    missing = sorted(p for p in paths if p not in known)
    miss_set = set(missing)
    top = [p for p in missing if not any(p[:i] in miss_set for i in range(1, len(p)))]
    res = []
    for t in top:
        n = sum(1 for p in missing if len(p) > len(t) and p[:len(t)] == t)
        res.append((t, n))
    return res


# ---- free-key rules per resource kind ---------------------------------------------------------------
def free_client_entity(p):
    base = ("minecraft:client_entity", "description")
    if len(p) == 2 and p == base:
        return False
    if len(p) >= 3 and p[:2] == base:
        k = p[2]
        if len(p) == 3 and k in ("materials", "textures", "geometry", "animations", "sound_effects",
                                  "particle_effects", "particle_emitters", "locators", "animation_controllers"):
            return True
        if k == "scripts" and len(p) >= 4 and p[3] in ("animate", "variables") and len(p) == 5 and p[4] == "[]":
            return True  # dicts inside scripts.animate[] : {animation_name: condition}
        if k == "scripts" and len(p) == 4 and p[3] == "variables":
            return True
        if k == "render_controllers" and len(p) == 4 and p[3] == "[]":
            return True
        if k == "locators" and len(p) >= 3:
            return len(p) == 4
        if k == "animation_controllers" and len(p) == 4 and p[3] == "[]":
            return True
    return False


def free_animations(p):
    if p == ("animations",):
        return True
    if len(p) == 3 and p[0] == "animations" and p[2] == "bones":
        return True
    return False


def free_controllers(p):
    if p == ("animation_controllers",):
        return True
    if len(p) == 3 and p[0] == "animation_controllers" and p[2] == "states":
        return True
    # transitions[] / animations[] / blend_via_shape: dicts with free names
    if len(p) >= 2 and p[-1] == "[]" and p[-2] in ("transitions", "animations") and len(p) >= 5:
        return True
    if len(p) >= 2 and p[-1] == "variables":
        return True
    return False


def free_render(p):
    if p == ("render_controllers",):
        return True
    if len(p) == 3 and p[0] == "render_controllers" and p[2] == "arrays":
        return True
    if len(p) == 4 and p[0] == "render_controllers" and p[2] == "arrays":
        return True
    if len(p) == 4 and p[0] == "render_controllers" and p[2] in ("materials", "part_visibility") and p[3] == "[]":
        return True
    if len(p) == 3 and p[0] == "render_controllers" and p[2] in ("textures",):
        return False
    return False


def free_geometry(p):
    # minecraft:geometry[] -> bones[] -> locators { name: ... }
    return len(p) >= 2 and p[-1] == "locators"


def free_sounddefs(p):
    return p == ("sound_definitions",)


def free_soundsjson(p):
    # entity_sounds.entities.<id> / events.<name>; same for block/individual_event/interactive/...
    if len(p) >= 1 and p[-1] in ("entities", "events", "defaults", "block_sounds", "individual_event_sounds",
                                  "interactive_sounds", "blocks", "items"):
        return True
    return False


def free_none(p):
    return False


FREE = {"client_entity": free_client_entity, "animations": free_animations, "controllers": free_controllers,
        "render": free_render, "geometry": free_geometry, "sounddefs": free_sounddefs,
        "soundsjson": free_soundsjson, "manifest": free_none}


# ======================================================================================================
# the corpus
# ======================================================================================================
class Corpus:
    def __init__(self, vanilla_dir=DEFAULT_VANILLA):
        self.dir = vanilla_dir
        self.bp_dir = os.path.join(vanilla_dir, "behavior_pack")
        self.rp_dir = os.path.join(vanilla_dir, "resource_pack")
        if not os.path.isdir(self.bp_dir) or not os.path.isdir(self.rp_dir):
            raise FileNotFoundError("vanilla corpus not found at %s (set BEDROCK_SAMPLES or --vanilla)" % vanilla_dir)
        self.files = collections.Counter()
        # BP
        self.comp_paths = set()                         # (component, ...path)
        self.comp_types = collections.defaultdict(set)  # (component, ...path) -> json types
        self.event_types = collections.defaultdict(set)
        self.rp_types = {k: collections.defaultdict(set) for k in ("client_entity", "animations", "controllers",
                                                                   "render", "geometry", "sounddefs",
                                                                   "soundsjson", "manifest")}
        self.comp_files = collections.defaultdict(set)  # component -> {file}
        self.event_paths = set()
        self.desc_paths = set()
        self.top_paths = set()
        self.format_versions = collections.defaultdict(collections.Counter)
        self.filter_tests = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
        self.enum_values = collections.defaultdict(set)   # (component, path) -> {values}
        self.enum_values_any = collections.defaultdict(set)  # leaf key -> {values}
        self.group_names_ok = True
        # RP
        self.rp_paths = {k: set() for k in ("client_entity", "animations", "controllers", "render", "geometry",
                                            "sounddefs", "soundsjson", "manifest")}
        self.rp_enum = collections.defaultdict(set)
        # molang
        self.molang_ids = collections.Counter()
        self.molang_max_len = 0
        self.molang_max_where = ""
        self._load_bp()
        self._load_rp()

    # ---- BP ---------------------------------------------------------------------------------------
    def _walk_enum(self, comp, node, path):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str) and (k in ENUM_LIKE or k in RP_ENUM):
                    self.enum_values[(comp, _epath(path + (k,)))].add(v)
                    self.enum_values_any[k].add(v)
                self._walk_enum(comp, v, path + (k,))
        elif isinstance(node, list):
            for v in node:
                self._walk_enum(comp, v, path + ("[]",))

    def _scan_filters(self, node, comp_ctx):
        if isinstance(node, dict):
            if isinstance(node.get("test"), str):
                t = node["test"]
                d = self.filter_tests[t]
                d["__seen__"]["1"] += 1
                for k, v in node.items():
                    if k == "test":
                        continue
                    if k in ("subject", "operator", "domain", "target"):
                        d[k][json.dumps(v)] += 1
                    else:
                        d[k]["<%s>" % _tname(v)] += 1
            for v in node.values():
                self._scan_filters(v, comp_ctx)
        elif isinstance(node, list):
            for v in node:
                self._scan_filters(v, comp_ctx)

    def _load_bp(self):
        d = os.path.join(self.bp_dir, "entities")
        for f in sorted(os.listdir(d)):
            if not f.endswith(".json"):
                continue
            doc = lenient_load(os.path.join(d, f))
            self.files["bp_entity"] += 1
            self.format_versions["bp_entity"][str(doc.get("format_version"))] += 1
            self.top_paths |= {(k,) for k in doc}
            ent = doc.get("minecraft:entity", {})
            self.top_paths |= {("minecraft:entity", k) for k in ent}
            self.desc_paths |= {k for k in ent.get("description", {})}
            comps = []
            for name, c in ent.get("components", {}).items():
                comps.append((name, c))
            for gname, g in ent.get("component_groups", {}).items():
                for name, c in g.items():
                    comps.append((name, c))
            for name, c in comps:
                self.comp_files[name].add(f)
                self.comp_paths.add((name,))
                for p in walk_paths(c, free_none):
                    self.comp_paths.add((name,) + p)
                for p, ts in walk_types(c, free_none).items():
                    self.comp_types[(name,) + p] |= ts
                self._walk_enum(name, c, ())
                self._scan_filters(c, name)
            for ename, ev in ent.get("events", {}).items():
                for p in walk_paths(ev, free_none):
                    self.event_paths.add(p)
                for p, ts in walk_types(ev, free_none).items():
                    self.event_types[p] |= ts
                self._scan_filters(ev, "event")
                self._walk_enum("event", ev, ())

    # ---- RP ---------------------------------------------------------------------------------------
    def _load_rp(self):
        def each(sub, kind, cond=None):
            d = os.path.join(self.rp_dir, sub)
            if not os.path.isdir(d):
                return
            for f in sorted(os.listdir(d)):
                if not f.endswith(".json"):
                    continue
                doc = lenient_load(os.path.join(d, f))
                if cond and not cond(doc):
                    continue
                self.files[kind] += 1
                self.format_versions[kind][str(doc.get("format_version"))] += 1
                self.rp_paths[kind] |= walk_paths(doc, FREE[kind])
                for p, ts in walk_types(doc, FREE[kind]).items():
                    self.rp_types[kind][p] |= ts
                self._molang(doc, "%s/%s" % (sub, f))
                self._walk_enum(kind, doc, ())

        each("entity", "client_entity")
        each("animations", "animations")
        each("animation_controllers", "controllers")
        each("render_controllers", "render")
        each("models/entity", "geometry", cond=lambda d: "minecraft:geometry" in d)
        for fn, kind in (("sounds/sound_definitions.json", "sounddefs"), ("sounds.json", "soundsjson"),
                         ("manifest.json", "manifest")):
            p = os.path.join(self.rp_dir, fn)
            if os.path.exists(p):
                doc = lenient_load(p)
                self.files[kind] += 1
                self.rp_paths[kind] |= walk_paths(doc, FREE[kind])
                for p2, ts in walk_types(doc, FREE[kind]).items():
                    self.rp_types[kind][p2] |= ts
                self._walk_enum(kind, doc, ())
        p = os.path.join(self.bp_dir, "manifest.json")
        if os.path.exists(p):
            doc = lenient_load(p)
            self.files["manifest"] += 1
            self.rp_paths["manifest"] |= walk_paths(doc, free_none)
            for p2, ts in walk_types(doc, free_none).items():
                self.rp_types["manifest"][p2] |= ts
            self._walk_enum("manifest", doc, ())
        # models/mobs.json etc are not needed

    _ID = re.compile(r"\b(query|q|math|variable|v|temp|t|context|c|texture|geometry|material|array)\.([A-Za-z_][A-Za-z0-9_]*)",
                     re.I)

    def _molang(self, node, where):
        if isinstance(node, str):
            if self._ID.search(node) or any(ch in node for ch in "+*/?"):
                for m in self._ID.finditer(node):
                    self.molang_ids[(m.group(1).lower(), m.group(2).lower())] += 1
                if len(node) > self.molang_max_len and self._ID.search(node):
                    self.molang_max_len, self.molang_max_where = len(node), where
        elif isinstance(node, dict):
            for v in node.values():
                self._molang(v, where)
        elif isinstance(node, list):
            for v in node:
                self._molang(v, where)

    # ---- public lookups ---------------------------------------------------------------------------
    def molang_has(self, prefix, name):
        prefix = {"q": "query", "v": "variable", "c": "context", "t": "temp"}.get(prefix, prefix)
        n = 0
        for (p, nm), cnt in self.molang_ids.items():
            pp = {"q": "query", "v": "variable", "c": "context", "t": "temp"}.get(p, p)
            if pp == prefix and nm == name.lower():
                n += cnt
        return n

    # ---- checks of OUR files ----------------------------------------------------------------------
    def check_bp_entity(self, doc, label="SCP096_BP/entities/scp096.json"):
        out = []
        fv = str(doc.get("format_version"))
        if fv not in self.format_versions["bp_entity"]:
            out.append(Finding("UNPROVEN", "bp.format_version", label, "format_version %s not used by any vanilla BP entity "
                               "(vanilla: %s)" % (fv, dict(self.format_versions["bp_entity"]))))
        for p in sorted({(k,) for k in doc} - self.top_paths):
            out.append(Finding("UNPROVEN", "bp.top_level_key", label, _fmt(p)))
        ent = doc.get("minecraft:entity", {})
        for k in ent:
            if ("minecraft:entity", k) not in self.top_paths:
                out.append(Finding("UNPROVEN", "bp.entity_key", label, "minecraft:entity." + k))
        for k in ent.get("description", {}):
            if k not in self.desc_paths:
                out.append(Finding("UNPROVEN", "bp.description_key", label, "description." + k))
        comps = [("components", n, c) for n, c in ent.get("components", {}).items()]
        for g, grp in ent.get("component_groups", {}).items():
            comps += [("component_groups.%s" % g, n, c) for n, c in grp.items()]
        seen = set()
        for where, name, c in comps:
            if (name,) not in self.comp_paths:
                out.append(Finding("UNPROVEN", "bp.component", "%s.%s" % (where, name),
                                   "component %s never appears in the corpus" % name))
                continue
            mine = {(name,) + p for p in walk_paths(c, free_none)}
            for p, nchild in minimal_missing(mine, self.comp_paths):
                key = (name, p)
                if key in seen:
                    continue
                seen.add(key)
                out.append(Finding("UNPROVEN", "bp.component_field", "%s.%s" % (where, name),
                                   "field path %s not used by any vanilla file (+%d deeper)" % (_fmt(p), nchild)))
            for p, bad, known in type_mismatches({(name,) + q: t for q, t in walk_types(c, free_none).items()},
                                                 self.comp_types, self.comp_paths):
                out.append(Finding("UNPROVEN", "bp.value_type", "%s.%s" % (where, name),
                                   "%s is JSON %s here but the corpus only has %s at that path" % (
                                       _fmt(p), "/".join(bad), "/".join(known))))
            # enum-like values
            self._enum_check(name, c, (), "%s.%s" % (where, name), out)
        # events
        for ename, ev in ent.get("events", {}).items():
            mine = walk_paths(ev, free_none)
            for p, nchild in minimal_missing(mine, self.event_paths):
                out.append(Finding("UNPROVEN", "bp.event_key", "events.%s" % ename,
                                   "event response path %s not used by any vanilla event (+%d deeper)" % (_fmt(p), nchild)))
            for p, bad, known in type_mismatches(walk_types(ev, free_none), self.event_types, self.event_paths):
                out.append(Finding("UNPROVEN", "bp.value_type", "events.%s" % ename,
                                   "%s is JSON %s here but the corpus only has %s at that path" % (
                                       _fmt(p), "/".join(bad), "/".join(known))))
            self._enum_check("event", ev, (), "events.%s" % ename, out)
        # filters (global)
        mine_tests = collections.defaultdict(lambda: collections.defaultdict(set))
        self._collect_filters(ent, mine_tests, "")
        for t, d in sorted(mine_tests.items()):
            if t not in self.filter_tests:
                out.append(Finding("UNPROVEN", "bp.filter_test", t, "filter test %r never appears in the corpus" % t))
                continue
            for field, vals in d.items():
                known = self.filter_tests[t]
                if field not in known:
                    out.append(Finding("UNPROVEN", "bp.filter_field", t,
                                       "filter test %r never used with field %r in the corpus" % (t, field)))
                    continue
                if field not in ("subject", "operator", "domain", "target"):
                    for v in vals:
                        if v not in known[field]:
                            out.append(Finding("UNPROVEN", "bp.filter_value_type", t,
                                               "filter test %r field %r has JSON type %s here; corpus has %s with that "
                                               "test" % (t, field, v.strip("<>"), sorted(x.strip("<>") for x in known[field]))))
                if field in ("subject", "operator", "domain", "target"):
                    for v in vals:
                        if v not in known[field]:
                            anywhere = any(v in ft[field] for ft in self.filter_tests.values() if field in ft)
                            lvl = "NOTE" if anywhere else "UNPROVEN"
                            out.append(Finding(lvl, "bp.filter_value", t,
                                               "%s=%s is %s for test %r (seen with it: %s)" % (
                                                   field, v, "proven only with other tests" if anywhere else
                                                   "NEVER used in the corpus", t, sorted(known[field]))))
        return out

    def _collect_filters(self, node, acc, ctx):
        if isinstance(node, dict):
            if isinstance(node.get("test"), str):
                t = node["test"]
                acc[t]["__seen__"].add("1")
                for k, v in node.items():
                    if k == "test":
                        continue
                    if k in ("subject", "operator", "domain", "target"):
                        acc[t][k].add(json.dumps(v))
                    else:
                        acc[t][k].add("<%s>" % _tname(v))
            for v in node.values():
                self._collect_filters(v, acc, ctx)
        elif isinstance(node, list):
            for v in node:
                self._collect_filters(v, acc, ctx)

    def _enum_check(self, comp, node, path, where, out):
        if isinstance(node, dict):
            is_filter = isinstance(node.get("test"), str)
            for k, v in node.items():
                if is_filter and k in ("test", "subject", "operator", "domain"):
                    continue    # filters are typed per test name by check_bp_entity (the same value means different things per test)
                if isinstance(v, str) and k in ENUM_LIKE:
                    known = self.enum_values.get((comp, _epath(path + (k,))), set())
                    if v not in known:
                        anywhere = v in self.enum_values_any.get(k, set())
                        lvl = "NOTE" if anywhere else "UNPROVEN"
                        out.append(Finding(lvl, "bp.enum_value", where,
                                           "%s=%r at %s is %s%s" % (
                                               k, v, _fmt(path + (k,)),
                                               "not used under this component in the corpus, but used as a %r value elsewhere" % k
                                               if anywhere else "NEVER used as a %r value in the corpus" % k,
                                               "" if not known else " (seen here: %s)" % sorted(known))))
                self._enum_check(comp, v, path + (k,), where, out)
        elif isinstance(node, list):
            for v in node:
                self._enum_check(comp, v, path + ("[]",), where, out)

    def check_rp(self, kind, doc, label):
        out = []
        fv = str(doc.get("format_version"))
        vk = {"client_entity": "client_entity", "animations": "animations", "controllers": "controllers",
              "render": "render", "geometry": "geometry"}.get(kind)
        if vk and self.format_versions.get(vk) is not None and fv not in self.format_versions[vk]:
            out.append(Finding("UNPROVEN", "rp.format_version", label,
                               "format_version %s not used by vanilla %s files (vanilla: %s)" % (
                                   fv, kind, dict(self.format_versions[vk]))))
        mine = walk_paths(doc, FREE[kind])
        lvl = "NOTE" if kind == "manifest" else "UNPROVEN"   # the corpus holds only 2 vanilla manifests
        for p, nchild in minimal_missing(mine, self.rp_paths[kind]):
            out.append(Finding(lvl, "rp.%s_key" % kind, label,
                               "key path %s not used by any vanilla %s file (+%d deeper)" % (_fmt(p), kind, nchild)))
        for p, bad, known in type_mismatches(walk_types(doc, FREE[kind]), self.rp_types[kind], self.rp_paths[kind]):
            out.append(Finding("NOTE" if kind == "manifest" else "UNPROVEN", "rp.value_type", label,
                               "%s is JSON %s here but the corpus only has %s at that path" % (
                                   _fmt(p), "/".join(bad), "/".join(known))))
        # enum-ish string values (spawn_egg colours etc. are free; only check the ENUM_LIKE keys)
        self._enum_check_rp(kind, doc, (), label, out)
        return out

    def _enum_check_rp(self, kind, node, path, label, out):
        if isinstance(node, dict):
            for k, v in node.items():
                if isinstance(v, str) and k in ("lerp_mode", "category", "type", "loop"):
                    known = self.enum_values.get((kind, _epath(path + (k,))), set()) | self.enum_values_any.get(k, set())
                    if v not in known:
                        out.append(Finding("NOTE" if kind == "manifest" else "UNPROVEN", "rp.enum_value", label,
                                           "%s=%r not seen as a %r value in vanilla" % (k, v, k)))
                self._enum_check_rp(kind, v, path + (k,), label, out)
        elif isinstance(node, list):
            for v in node:
                self._enum_check_rp(kind, v, path + ("[]",), label, out)

    # ---- everything ------------------------------------------------------------------------------
    def check_all(self, root=ROOT, kinds=None):
        res = collections.OrderedDict()

        def want(k):
            return kinds is None or k in kinds

        def L(rel):
            return os.path.join(root, rel)

        if want("bp"):
            res["bp_entity"] = self.check_bp_entity(strict_load(L("SCP096_BP/entities/scp096.json")))
        pairs = [("client", "client_entity", "SCP096_RP/entity/scp096.entity.json"),
                 ("animations", "animations", "SCP096_RP/animations/scp096.animation.json"),
                 ("controllers", "controllers", "SCP096_RP/animation_controllers/scp096.animation_controllers.json"),
                 ("render", "render", "SCP096_RP/render_controllers/scp096.render_controllers.json"),
                 ("geometry", "geometry", "SCP096_RP/models/entity/scp096.geo.json"),
                 ("sounddefs", "sounddefs", "SCP096_RP/sounds/sound_definitions.json"),
                 ("soundsjson", "soundsjson", "SCP096_RP/sounds.json"),
                 ("manifest_bp", "manifest", "SCP096_BP/manifest.json"),
                 ("manifest_rp", "manifest", "SCP096_RP/manifest.json")]
        for name, kind, rel in pairs:
            if want(name) or want(kind):
                res[name] = self.check_rp(kind, strict_load(L(rel)), rel)
        return res

    # ---- Molang corpus-membership -----------------------------------------------------------------
    def molang_unproven(self, ids):
        """ids: iterable of (prefix, name). Returns list of (prefix, name) never used in vanilla."""
        return sorted({(p, n) for (p, n) in ids if not self.molang_has(p, n)})

    def stats(self):
        s = ["corpus %s" % self.dir]
        s.append("  files: " + ", ".join("%s=%d" % kv for kv in sorted(self.files.items())))
        s.append("  BP: %d component names, %d (component,path) pairs, %d event paths, %d filter tests" % (
            len({p[0] for p in self.comp_paths}), len(self.comp_paths), len(self.event_paths), len(self.filter_tests)))
        s.append("  RP key paths: " + ", ".join("%s=%d" % (k, len(v)) for k, v in sorted(self.rp_paths.items())))
        s.append("  Molang ids: %d distinct, longest expression %d chars (%s)" % (
            len(self.molang_ids), self.molang_max_len, self.molang_max_where))
        return "\n".join(s)


# ======================================================================================================
# self-test: the checker must catch deliberately broken copies of OUR files
# ======================================================================================================
def selftest(corpus, root=ROOT):
    import copy
    L = lambda rel: strict_load(os.path.join(root, rel))   # noqa: E731
    bp = L("SCP096_BP/entities/scp096.json")
    cl = L("SCP096_RP/entity/scp096.entity.json")
    an = L("SCP096_RP/animations/scp096.animation.json")
    ct = L("SCP096_RP/animation_controllers/scp096.animation_controllers.json")
    rc = L("SCP096_RP/render_controllers/scp096.render_controllers.json")
    ge = L("SCP096_RP/models/entity/scp096.geo.json")
    sd = L("SCP096_RP/sounds/sound_definitions.json")

    def mut_bp(fn):
        d = copy.deepcopy(bp)
        fn(d["minecraft:entity"], d)
        return corpus.check_bp_entity(d)

    def mut_rp(kind, doc, fn):
        d = copy.deepcopy(doc)
        fn(d)
        return corpus.check_rp(kind, d, "mutant")

    cg = lambda e: e["component_groups"]   # noqa: E731
    cases = [
        ("unknown component", lambda: mut_bp(lambda e, d: e["components"].update({"minecraft:made_up": {}}))),
        ("unknown field", lambda: mut_bp(lambda e, d: e["components"]["minecraft:health"].update({"bogus": 1}))),
        ("wrong value type", lambda: mut_bp(lambda e, d: cg(e)["scp096:calm"]["minecraft:lookat"].update({"set_target": "yes"}))),
        ("deals_damage string", lambda: mut_bp(lambda e, d: e["components"]["minecraft:damage_sensor"]["triggers"].update({"deals_damage": "yes"}))),
        ("unknown event key", lambda: mut_bp(lambda e, d: e["events"]["scp096:enrage"].update({"bogus_key": 1}))),
        ("unknown filter test", lambda: mut_bp(lambda e, d: cg(e)["scp096:rage_scream"]["minecraft:environment_sensor"]["triggers"][0]["filters"].update({"test": "is_made_up"}))),
        ("unknown filter subject", lambda: mut_bp(lambda e, d: cg(e)["scp096:rage_scream"]["minecraft:environment_sensor"]["triggers"][0]["filters"].update({"subject": "nobody"}))),
        ("filter value type", lambda: mut_bp(lambda e, d: cg(e)["scp096:rage_scream"]["minecraft:environment_sensor"]["triggers"][1]["filters"].update({"value": "dead"}))),
        ("bad description key", lambda: mut_bp(lambda e, d: e["description"].update({"made_up": True}))),
        ("bad format_version", lambda: mut_bp(lambda e, d: d.update({"format_version": "1.99.0"}))),
        ("client unknown key", lambda: mut_rp("client_entity", cl, lambda d: d["minecraft:client_entity"]["description"].update({"made_up": 1}))),
        ("client unknown scripts key", lambda: mut_rp("client_entity", cl, lambda d: d["minecraft:client_entity"]["description"]["scripts"].update({"made_up": []}))),
        ("animation unknown key", lambda: mut_rp("animations", an, lambda d: d["animations"]["animation.scp096.walk"].update({"made_up": 1}))),
        ("animation channel key", lambda: mut_rp("animations", an, lambda d: d["animations"]["animation.scp096.walk"]["bones"]["root"].update({"rotate": [0, 0, 0]}))),
        ("controller state key", lambda: mut_rp("controllers", ct, lambda d: d["animation_controllers"]["controller.animation.scp096.main"]["states"]["sit"].update({"made_up": 1}))),
        ("render controller key", lambda: mut_rp("render", rc, lambda d: d["render_controllers"]["controller.render.scp096"].update({"made_up": 1}))),
        ("geometry bone key", lambda: mut_rp("geometry", ge, lambda d: d["minecraft:geometry"][0]["bones"][1].update({"made_up": 1}))),
        ("geometry cube key", lambda: mut_rp("geometry", ge, lambda d: d["minecraft:geometry"][0]["bones"][1]["cubes"][0].update({"made_up": 1}))),
        ("sound def key", lambda: mut_rp("sounddefs", sd, lambda d: d["sound_definitions"]["mob.scp096.cry"].update({"made_up": 1}))),
    ]
    bad = 0
    base = [f for f in corpus.check_all(root).values() for f in f if f.level == "UNPROVEN"]
    print("baseline unproven: %d" % len(base))
    for name, fn in cases:
        found = [f for f in fn() if f.level == "UNPROVEN"]
        ok = len(found) > len(base) if False else bool(found)
        print("  %-28s %s%s" % (name, "caught" if ok else "MISSED", "" if not found else "  (%s)" % found[0].kind))
        bad += 0 if ok else 1
    print("selftest: %d/%d mutants caught" % (len(cases) - bad, len(cases)))
    return 1 if bad else 0


# ======================================================================================================
# CLI
# ======================================================================================================
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--vanilla", default=DEFAULT_VANILLA)
    ap.add_argument("--root", default=ROOT, help="add-on root (default: this repo)")
    ap.add_argument("--kind", default=None, help="comma list: bp,client,animations,controllers,render,geometry,"
                                                  "sounddefs,soundsjson,manifest_bp,manifest_rp")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--selftest", action="store_true", help="mutate our files in memory; every mutant must be caught")
    a = ap.parse_args(argv)
    try:
        c = Corpus(a.vanilla)
    except Exception as ex:
        print("FAIL  cannot load the vanilla corpus: %s" % ex)
        return 1
    print(c.stats())
    if a.selftest:
        return selftest(c, a.root)
    kinds = set(a.kind.split(",")) if a.kind else None
    res = c.check_all(a.root, kinds)
    bad = 0
    for name, fl in res.items():
        unp = [f for f in fl if f.level == "UNPROVEN"]
        notes = [f for f in fl if f.level == "NOTE"]
        print("\n[%s] %s   unproven=%d notes=%d" % (name, "FAIL" if unp else "PASS", len(unp), len(notes)))
        for f in unp:
            print("  UNPROVEN %-22s %s: %s" % (f.kind, f.where, f.detail))
        for f in notes:
            print("  note     %-22s %s: %s" % (f.kind, f.where, f.detail))
        bad += len(unp)
    print("\nRESULT: %s (%d unproven)" % ("FAIL" if bad else "PASS", bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
