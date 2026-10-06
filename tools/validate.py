#!/usr/bin/env python3
"""Cross-check the Parasite Apocalypse Survival packs against each other and the vanilla reference.

Checks (each section reports what it checked; see docs/TESTING.md):
  json        every .json in both packs is strict JSON (no comments/trailing commas/duplicate keys/BOM/NaN)
  manifest    uuids, module types/versions, dependencies (SPEC §2), script entry exists, script module
              versions exist in the reference metadata
  items       format_version, identifier, menu_category, components known to the 1.20.80 item schema,
              display_name, icon -> item_texture.json -> png/tga
  entities    BP entities: unique identifier, families (pas_horde/monster/mob, no vanilla species),
              is_spawnable false / is_summonable true, required groups/events (SPEC §3), every event's
              add/remove groups exist, every group referenced, self events exist, loot tables exist
  client      RP client entities: BP counterpart, geometry / textures / animations / animation
              controllers / render controllers resolve in our pack or vanilla, script keys, materials
              limited to names used by vanilla client entities/attachables, render-controller
              Geometry./Texture./Material. references
  attachables identifier is an item; same reference checks as client entities
  particles   identifier unique, format_version 1.10.0, texture resolves
  sounds      sound_definitions files exist (ours .ogg/.wav/.fsb, vanilla listing), categories,
              every sound referenced by sounds.json / ids.js SOUNDS is defined
  lang        every item / entity has a name key; pack.name present
  scripts     ids.js ITEMS/ENTITIES/SOUNDS/PARTICLES defined; relative imports resolve; only
              @minecraft/server and @minecraft/server-ui are imported
  structures  structures/pas/luxury_base.mcstructure exists and looks like LE NBT

Content another workstream has not delivered yet is reported as a WARNING ("missing: ..."), or as an
ERROR with --strict. Broken references in files that exist are always errors. Vanilla-reference checks
are skipped with a WARNING when the reference (env PAS_VANILLA_REF or the default path) is missing.

Usage: python3 tools/validate.py [--strict] [--json] [--quiet]
Exit code: 0 = no errors (warnings allowed), 1 = errors.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADDON = ROOT / "addon"
BP = ADDON / "behavior_pack"
RP = ADDON / "resource_pack"
FRAG = ADDON / "fragments"
DEFAULT_REF = Path(
    "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"
)
REF = Path(os.environ.get("PAS_VANILLA_REF") or DEFAULT_REF)

UUIDS = {
    "bp_header": "d49c4c97-9b2f-4e88-a2ad-7e392e64ca1a",
    "bp_data": "7e47444f-e8b2-4e20-821d-0df732d70ddc",
    "bp_script": "3fdec22c-e4dd-4d51-a8eb-c5925814fd04",
    "rp_header": "2d23c19d-333a-44bc-ae3b-cb4e9f8e808e",
    "rp_resources": "568e8c9a-4064-433d-978b-32a2d2b6dbb1",
}
SCRIPT_MODULES = {"@minecraft/server": "1.11.0", "@minecraft/server-ui": "1.1.0"}
MIN_ENGINE = [1, 21, 0]
ITEM_FORMAT = "1.20.80"
MENU_CATEGORIES = {"construction", "equipment", "items", "nature", "none", "commands"}
VANILLA_SPECIES_FAMILIES = {"villager", "cow", "mushroomcow", "pig", "sheep", "chicken", "wandering_trader", "player"}
TEXTURE_EXTS = (".png", ".tga", ".jpg", ".jpeg")
SOUND_EXTS_OURS = (".ogg", ".wav", ".fsb")
SOUND_EXTS_VANILLA = (".fsb", ".ogg", ".wav")
STRUCTURE = BP / "structures" / "pas" / "luxury_base.mcstructure"
STRUCTURE_ID = "pas:luxury_base"

# SPEC §3 per-entity requirements
SPECIES = {
    "pas:infected_villager": "villager",
    "pas:infected_cow": "cow",
    "pas:infected_pig": "pig",
    "pas:infected_sheep": "sheep",
    "pas:infected_chicken": "chicken",
    "pas:infected_human": "human",
}
BABY_FORMS = {"pas:infected_villager", "pas:infected_cow", "pas:infected_pig", "pas:infected_sheep", "pas:infected_chicken"}
INDEXED_EVENTS = {
    "pas:infected_villager": [("pas:set_variant_", 15), ("pas:set_mark_", 7), ("pas:set_skin_", 6)],
    "pas:infected_cow": [("pas:set_variant_", 3)],
    "pas:infected_sheep": [("pas:set_color_", 16)],
}
SOUND_CATEGORY_POLICY = [  # (prefix, expected category) - SPEC §3 notes
    ("pas.parasite.", "hostile"),
    ("pas.infected.", "hostile"),
    ("pas.infection.", "hostile"),
    ("pas.torch.", "player"),
    ("pas.ui.", "player"),
    ("pas.base.", "neutral"),
]


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------

class Report:
    def __init__(self, strict: bool):
        self.strict = strict
        self.errors: list[dict] = []
        self.warnings: list[dict] = []
        self.checks: list[dict] = []
        self.info: dict = {}

    def error(self, section: str, msg: str) -> None:
        self.errors.append({"section": section, "message": msg})

    def warn(self, section: str, msg: str) -> None:
        self.warnings.append({"section": section, "message": msg})

    def missing(self, section: str, msg: str) -> None:
        """Content that another workstream has not delivered yet."""
        (self.error if self.strict else self.warn)(section, f"missing: {msg}")

    def check(self, section: str, what: str, count: int | None = None) -> None:
        self.checks.append({"section": section, "check": what, "count": count})


def rel(p: Path) -> str:
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return str(p)


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


def _bad_constant(name):
    raise ValueError(f"invalid JSON constant {name}")


def parse_strict(path: Path):
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise ValueError("UTF-8 BOM")
    text = raw.decode("utf-8")
    return json.loads(text, object_pairs_hook=_no_dupes, parse_constant=_bad_constant)


def strip_comments(src: str) -> str:
    out = []
    i, n, ins = 0, len(src), False
    while i < n:
        c = src[i]
        if ins:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1])
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
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        out.append(c)
        i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))


def parse_lenient(path: Path):
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    return json.loads(strip_comments(text))


class Ours:
    """Strictly parsed JSON of both packs (path -> data); invalid files are recorded as errors."""

    def __init__(self, rep: Report):
        self.data: dict[Path, object] = {}
        self.bad: set[Path] = set()
        n = 0
        for base in (BP, RP):
            if not base.is_dir():
                continue
            for p in sorted(base.rglob("*.json")):
                n += 1
                try:
                    self.data[p] = parse_strict(p)
                except (ValueError, UnicodeDecodeError) as e:
                    self.bad.add(p)
                    rep.error("json", f"{rel(p)}: not strict JSON: {e}")
        rep.check("json", "strict JSON parse of every .json in both packs", n)

    def under(self, base: Path) -> dict[Path, object]:
        return {p: d for p, d in self.data.items() if base in p.parents}


# ---------------------------------------------------------------------------
# vanilla reference index
# ---------------------------------------------------------------------------

def walk_json(d: Path):
    if d.is_dir():
        yield from sorted(d.rglob("*.json"))


class Vanilla:
    def __init__(self, rep: Report):
        self.available = (REF / "resource_pack").is_dir() and (REF / "behavior_pack").is_dir()
        self.geometry: set[str] = set()
        self.textures: set[str] = set()
        self.animations: set[str] = set()
        self.controllers: set[str] = set()
        self.render_controllers: dict[str, dict] = {}
        self.materials: set[str] = set()
        self.sound_defs: set[str] = set()
        self.sound_files: set[str] = set()
        self.sound_categories: set[str] = set()
        self.particles: set[str] = set()
        self.items: set[str] = set()
        self.entities: set[str] = set()
        self.item_schema_components: set[str] = set()
        self.script_module_versions: dict[str, set[str]] = {}
        if not self.available:
            rep.warn("vanilla", f"vanilla reference not found at {REF} (set PAS_VANILLA_REF); vanilla checks skipped")
            return
        rp = REF / "resource_pack"
        for p in walk_json(rp / "models"):
            self.geometry |= geometry_ids(safe_lenient(p))
        for p in (rp / "textures").rglob("*"):
            if p.is_file() and p.suffix.lower() in TEXTURE_EXTS:
                self.textures.add(p.relative_to(rp).with_suffix("").as_posix())
        for p in walk_json(rp / "animations"):
            self.animations |= set((safe_lenient(p) or {}).get("animations", {}).keys())
        for p in walk_json(rp / "animation_controllers"):
            self.controllers |= set((safe_lenient(p) or {}).get("animation_controllers", {}).keys())
        for p in walk_json(rp / "render_controllers"):
            self.render_controllers.update((safe_lenient(p) or {}).get("render_controllers", {}))
        for sub, key in (("entity", "minecraft:client_entity"), ("attachables", "minecraft:attachable")):
            for p in walk_json(rp / sub):
                d = safe_lenient(p) or {}
                desc = (d.get(key) or {}).get("description", {})
                for m in (desc.get("materials") or {}).values():
                    if isinstance(m, str):
                        self.materials.add(m)
        sd = safe_lenient(rp / "sounds" / "sound_definitions.json") or {}
        for k, v in (sd.get("sound_definitions") or {}).items():
            self.sound_defs.add(k)
            if isinstance(v, dict) and isinstance(v.get("category"), str):
                self.sound_categories.add(v["category"])
        for p in (rp / "sounds").rglob("*"):
            if p.is_file() and p.suffix.lower() in SOUND_EXTS_VANILLA:
                self.sound_files.add(p.relative_to(rp).with_suffix("").as_posix())
        for p in walk_json(rp / "particles"):
            pid = ((safe_lenient(p) or {}).get("particle_effect") or {}).get("description", {}).get("identifier")
            if pid:
                self.particles.add(pid)
        md = REF / "metadata" / "vanilladata_modules"
        items = safe_lenient(md / "mojang-items.json") or {}
        self.items = {i["name"] for i in items.get("data_items", [])}
        ents = safe_lenient(md / "mojang-entities.json") or {}
        self.entities = {"minecraft:" + e["name"] for e in ents.get("data_items", [])}
        schema = safe_lenient(REF / "metadata" / "json_schemas" / "Components v1.20.80.json") or {}
        self.item_schema = schema
        self.item_schema_components = set((schema.get("properties") or {}).keys())
        sm = REF / "metadata" / "script_modules" / "@minecraft"
        if sm.is_dir():
            for p in sm.glob("*.json"):
                m = re.match(r"^(.*)_(\d+\.\d+\.\d+(?:-beta)?)\.json$", p.name)
                if m:
                    self.script_module_versions.setdefault("@minecraft/" + m.group(1), set()).add(m.group(2))
        rep.check(
            "vanilla",
            f"reference indexed: {len(self.geometry)} geometries, {len(self.textures)} textures, {len(self.animations)} animations, "
            f"{len(self.controllers)} animation controllers, {len(self.render_controllers)} render controllers, "
            f"{len(self.materials)} materials, {len(self.sound_defs)} sound ids, {len(self.sound_files)} sound files, "
            f"{len(self.particles)} particles, {len(self.items)} items, {len(self.entities)} entities",
        )


def safe_lenient(p: Path):
    try:
        return parse_lenient(p)
    except (OSError, ValueError):
        return None


def geometry_ids(d) -> set[str]:
    out: set[str] = set()
    if not isinstance(d, dict):
        return out
    for g in d.get("minecraft:geometry", []) or []:
        gid = (g.get("description") or {}).get("identifier") if isinstance(g, dict) else None
        if gid:
            out.add(gid)
    for k in d:
        if k.startswith("geometry."):
            out.add(k.split(":", 1)[0])
    return out


# ---------------------------------------------------------------------------
# our pack indexes
# ---------------------------------------------------------------------------

class Index:
    def __init__(self, ours: Ours):
        self.geometry: set[str] = set()
        self.animations: set[str] = set()
        self.controllers: set[str] = set()
        self.render_controllers: dict[str, dict] = {}
        self.textures: set[str] = set()
        for p, d in ours.under(RP).items():
            parts = p.relative_to(RP).parts
            if parts[0] == "models":
                self.geometry |= geometry_ids(d)
            elif parts[0] == "animations" and isinstance(d, dict):
                self.animations |= set((d.get("animations") or {}).keys())
            elif parts[0] == "animation_controllers" and isinstance(d, dict):
                self.controllers |= set((d.get("animation_controllers") or {}).keys())
            elif parts[0] == "render_controllers" and isinstance(d, dict):
                self.render_controllers.update(d.get("render_controllers") or {})
        tex = RP / "textures"
        if tex.is_dir():
            for p in tex.rglob("*"):
                if p.is_file() and p.suffix.lower() in TEXTURE_EXTS:
                    self.textures.add(p.relative_to(RP).with_suffix("").as_posix())


def texture_resolves(path: str, idx: Index, van: Vanilla) -> bool | None:
    """True/False, or None when only the (missing) vanilla reference could tell."""
    p = path.strip().rstrip("/")
    for ext in TEXTURE_EXTS:
        if p.lower().endswith(ext):
            p = p[: -len(ext)]
    if p in idx.textures:
        return True
    if van.available:
        return p in van.textures
    return None


# ---------------------------------------------------------------------------
# sections
# ---------------------------------------------------------------------------

def check_manifests(rep: Report, ours: Ours, van: Vanilla) -> None:
    S = "manifest"
    bpm, rpm = BP / "manifest.json", RP / "manifest.json"
    for m in (bpm, rpm):
        if not m.is_file():
            rep.error(S, f"{rel(m)} missing")
    bp = ours.data.get(bpm)
    rp = ours.data.get(rpm)
    uuids_seen: dict[str, str] = {}

    def note_uuid(u, where):
        if u in uuids_seen:
            rep.error(S, f"uuid {u} used twice ({uuids_seen[u]} and {where})")
        uuids_seen[u] = where

    if isinstance(bp, dict):
        h = bp.get("header", {})
        if bp.get("format_version") != 2:
            rep.error(S, "BP manifest format_version must be 2")
        if h.get("uuid") != UUIDS["bp_header"]:
            rep.error(S, f"BP header uuid {h.get('uuid')} != {UUIDS['bp_header']}")
        note_uuid(h.get("uuid"), "BP header")
        if h.get("min_engine_version") != MIN_ENGINE:
            rep.error(S, f"BP min_engine_version {h.get('min_engine_version')} != {MIN_ENGINE}")
        mods = bp.get("modules", [])
        data = [m for m in mods if m.get("type") == "data"]
        scripts = [m for m in mods if m.get("type") == "script"]
        if len(data) != 1 or data[0].get("uuid") != UUIDS["bp_data"]:
            rep.error(S, f"BP must have one data module with uuid {UUIDS['bp_data']}")
        if len(scripts) != 1 or scripts[0].get("uuid") != UUIDS["bp_script"]:
            rep.error(S, f"BP must have one script module with uuid {UUIDS['bp_script']}")
        for m in mods:
            note_uuid(m.get("uuid"), f"BP module {m.get('type')}")
        if scripts:
            sm = scripts[0]
            if sm.get("language") != "javascript":
                rep.error(S, "script module language must be 'javascript'")
            entry = sm.get("entry")
            if not entry or not (BP / entry).is_file():
                rep.error(S, f"script entry {entry!r} does not exist in the BP")
        deps = bp.get("dependencies", [])
        if not any(d.get("uuid") == UUIDS["rp_header"] for d in deps):
            rep.error(S, "BP must depend on the RP header uuid")
        for name, ver in SCRIPT_MODULES.items():
            found = [d for d in deps if d.get("module_name") == name]
            if not found:
                rep.error(S, f"BP must depend on {name} {ver}")
            elif found[0].get("version") != ver:
                rep.error(S, f"BP dependency {name} version {found[0].get('version')} != {ver}")
            if van.available:
                if ver not in van.script_module_versions.get(name, set()):
                    rep.error(S, f"{name} {ver} not present in reference metadata/script_modules")
                elif ver.endswith("-beta"):
                    rep.error(S, f"{name} {ver} is a beta module (needs experiments)")
        for d in deps:
            if "module_name" in d and d["module_name"] not in SCRIPT_MODULES:
                rep.error(S, f"unexpected script dependency {d['module_name']}")
    if isinstance(rp, dict):
        h = rp.get("header", {})
        if rp.get("format_version") != 2:
            rep.error(S, "RP manifest format_version must be 2")
        if h.get("uuid") != UUIDS["rp_header"]:
            rep.error(S, f"RP header uuid {h.get('uuid')} != {UUIDS['rp_header']}")
        note_uuid(h.get("uuid"), "RP header")
        if h.get("min_engine_version") != MIN_ENGINE:
            rep.error(S, f"RP min_engine_version {h.get('min_engine_version')} != {MIN_ENGINE}")
        mods = rp.get("modules", [])
        if len(mods) != 1 or mods[0].get("type") != "resources" or mods[0].get("uuid") != UUIDS["rp_resources"]:
            rep.error(S, f"RP must have one resources module with uuid {UUIDS['rp_resources']}")
        for m in mods:
            note_uuid(m.get("uuid"), f"RP module {m.get('type')}")
        if not any(d.get("uuid") == UUIDS["bp_header"] for d in rp.get("dependencies", [])):
            rep.error(S, "RP must depend on the BP header uuid")
    for icon in (BP / "pack_icon.png", RP / "pack_icon.png"):
        if not icon.is_file():
            rep.missing(S, f"{rel(icon)}")
    rep.check(S, "uuids, modules, dependencies, script entry, module versions in reference")


def load_item_textures(ours: Ours) -> tuple[dict, str]:
    gen = RP / "textures" / "item_texture.json"
    if gen in ours.data and isinstance(ours.data[gen], dict):
        return ours.data[gen].get("texture_data") or {}, rel(gen)
    merged = {}
    d = FRAG / "item_texture"
    if d.is_dir():
        for p in sorted(d.glob("*.json")):
            try:
                merged.update(parse_strict(p))
            except ValueError:
                pass
    return merged, "fragments (not built yet)"


def check_items(rep: Report, ours: Ours, van: Vanilla, idx: Index, ids: dict) -> dict:
    S = "items"
    items: dict[str, dict] = {}
    tex_data, tex_src = load_item_textures(ours)
    for p, d in sorted(ours.under(BP / "items").items()):
        it = d.get("minecraft:item") if isinstance(d, dict) else None
        if not isinstance(it, dict):
            rep.error(S, f"{rel(p)}: missing minecraft:item")
            continue
        if d.get("format_version") != ITEM_FORMAT:
            rep.error(S, f"{rel(p)}: format_version {d.get('format_version')!r} != {ITEM_FORMAT!r}")
        desc = it.get("description") or {}
        ident = desc.get("identifier")
        if not ident or ":" not in ident:
            rep.error(S, f"{rel(p)}: invalid identifier {ident!r}")
            continue
        if ident in items:
            rep.error(S, f"duplicate item identifier {ident} ({rel(p)})")
        items[ident] = {"file": p, "data": it}
        mc = desc.get("menu_category")
        if not isinstance(mc, dict) or mc.get("category") not in MENU_CATEGORIES:
            rep.error(S, f"{ident}: menu_category.category must be one of {sorted(MENU_CATEGORIES)}")
        elif "group" in mc and not isinstance(mc["group"], str):
            rep.error(S, f"{ident}: menu_category.group must be a string")
        comps = it.get("components") or {}
        if van.available and van.item_schema_components:
            for c in comps:
                if c not in van.item_schema_components:
                    rep.error(S, f"{ident}: component {c} is not in the 1.20.80 item component schema")
        dn = comps.get("minecraft:display_name")
        if not isinstance(dn, dict) or not isinstance(dn.get("value"), str) or not dn["value"]:
            rep.error(S, f"{ident}: minecraft:display_name.value missing")
        ms = comps.get("minecraft:max_stack_size")
        if ms is not None and not (isinstance(ms, int) and 1 <= ms <= 64) and not (isinstance(ms, dict) and isinstance(ms.get("value"), int)):
            rep.error(S, f"{ident}: minecraft:max_stack_size must be an integer 1-64")
        for b in ("minecraft:hand_equipped", "minecraft:allow_off_hand", "minecraft:glint"):
            if b in comps and not isinstance(comps[b], bool) and not (isinstance(comps[b], dict) and isinstance(comps[b].get("value"), bool)):
                rep.error(S, f"{ident}: {b} must be a boolean")
        ib = comps.get("minecraft:interact_button")
        if ib is not None and not isinstance(ib, (bool, str)):
            rep.error(S, f"{ident}: minecraft:interact_button must be a boolean or string")
        icon = comps.get("minecraft:icon")
        short = icon if isinstance(icon, str) else ((icon or {}).get("textures") or {}).get("default") if isinstance(icon, dict) else None
        if not short:
            rep.error(S, f"{ident}: minecraft:icon missing")
        elif short not in tex_data:
            rep.missing(S, f"{ident}: icon {short!r} not in item_texture data ({tex_src})")
        else:
            t = tex_data[short].get("textures") if isinstance(tex_data[short], dict) else None
            paths = t if isinstance(t, list) else [t]
            for tp in paths:
                ok = texture_resolves(str(tp), idx, van) if tp else False
                if ok is False:
                    rep.missing(S, f"{ident}: icon texture {tp!r} has no .png/.tga in the RP")
    for key, item_id in sorted((ids.get("ITEMS") or {}).items()):
        if item_id not in items:
            rep.error(S, f"ids.js ITEMS.{key} = {item_id} has no item definition in BP items/")
    rep.check(S, "format, menu_category, schema components, display_name, icon -> item_texture -> texture", len(items))
    return items


def iter_event_groups(ev, out_add: set, out_remove: set, triggers: set) -> None:
    if isinstance(ev, list):
        for e in ev:
            iter_event_groups(e, out_add, out_remove, triggers)
        return
    if not isinstance(ev, dict):
        return
    for g in ((ev.get("add") or {}).get("component_groups") or []):
        out_add.add(g)
    for g in ((ev.get("remove") or {}).get("component_groups") or []):
        out_remove.add(g)
    t = ev.get("trigger")
    if isinstance(t, str):
        triggers.add(t)
    elif isinstance(t, dict) and t.get("event") and t.get("target", "self") == "self":
        triggers.add(t["event"])
    for k in ("sequence", "randomize"):
        if k in ev:
            iter_event_groups(ev[k], out_add, out_remove, triggers)


def find_self_events(node, out: set) -> None:
    """Collect {"event": "x"} references that target self (timers, sensors, interactions...)."""
    if isinstance(node, dict):
        ev = node.get("event")
        if isinstance(ev, str) and node.get("target", "self") == "self":
            out.add(ev)
        for v in node.values():
            find_self_events(v, out)
    elif isinstance(node, list):
        for v in node:
            find_self_events(v, out)


def find_loot_tables(node, out: set) -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "minecraft:loot" and isinstance(v, dict) and isinstance(v.get("table"), str):
                out.add(v["table"])
            find_loot_tables(v, out)
    elif isinstance(node, list):
        for v in node:
            find_loot_tables(v, out)


def check_entities(rep: Report, ours: Ours, ids: dict) -> dict:
    S = "entities"
    ents: dict[str, dict] = {}
    for p, d in sorted(ours.under(BP / "entities").items()):
        ent = d.get("minecraft:entity") if isinstance(d, dict) else None
        if not isinstance(ent, dict):
            rep.error(S, f"{rel(p)}: missing minecraft:entity")
            continue
        desc = ent.get("description") or {}
        ident = desc.get("identifier")
        if not ident:
            rep.error(S, f"{rel(p)}: missing identifier")
            continue
        if ident in ents:
            rep.error(S, f"duplicate entity identifier {ident}: {rel(ents[ident]['file'])} and {rel(p)}")
        ents[ident] = {"file": p, "data": ent}
        if not d.get("format_version"):
            rep.error(S, f"{ident}: format_version missing")
        if desc.get("is_spawnable") is not False:
            rep.error(S, f"{ident}: is_spawnable must be false")
        if desc.get("is_summonable") is not True:
            rep.error(S, f"{ident}: is_summonable must be true")
        comps = ent.get("components") or {}
        groups = ent.get("component_groups") or {}
        events = ent.get("events") or {}
        fams: set[str] = set()
        for c in [comps, *groups.values()]:
            tf = (c or {}).get("minecraft:type_family")
            if isinstance(tf, dict):
                fams |= set(tf.get("family") or [])
        base_fams = set(((comps.get("minecraft:type_family") or {}).get("family")) or [])
        for f in ("pas_horde", "monster", "mob"):
            if f not in base_fams:
                rep.error(S, f"{ident}: base type_family must include {f}")
        if ident == "pas:parasite":
            for f in ("pas_parasite", "arthropod"):
                if f not in base_fams:
                    rep.error(S, f"{ident}: type_family must include {f}")
        elif ident in SPECIES:
            for f in ("pas_infected", f"pas_infected_{SPECIES[ident]}"):
                if f not in base_fams:
                    rep.error(S, f"{ident}: type_family must include {f}")
        bad = fams & VANILLA_SPECIES_FAMILIES
        if bad:
            rep.error(S, f"{ident}: must not use vanilla species families {sorted(bad)}")
        for c in ("minecraft:persistent", "minecraft:nameable", "minecraft:damage_sensor", "minecraft:health"):
            if c not in comps:
                rep.error(S, f"{ident}: base component {c} missing")
        for g in ("pas:hunting", "pas:dormant"):
            if g not in groups:
                rep.error(S, f"{ident}: component group {g} missing")
        # required events + their effect
        def adds_removes(name):
            a, r, t = set(), set(), set()
            iter_event_groups(events.get(name), a, r, t)
            return a, r

        if "minecraft:entity_spawned" not in events:
            rep.error(S, f"{ident}: event minecraft:entity_spawned missing")
        elif "pas:hunting" not in adds_removes("minecraft:entity_spawned")[0]:
            rep.error(S, f"{ident}: minecraft:entity_spawned must add pas:hunting")
        for name, add, remove in (("pas:become_dormant", "pas:dormant", "pas:hunting"), ("pas:become_active", "pas:hunting", "pas:dormant")):
            if name not in events:
                rep.error(S, f"{ident}: event {name} missing")
                continue
            a, r = adds_removes(name)
            if add not in a or remove not in r:
                rep.error(S, f"{ident}: {name} must remove {remove} and add {add}")
        if ident == "pas:parasite" and "pas:born" not in events:
            rep.error(S, f"{ident}: event pas:born missing")
        if ident in BABY_FORMS and "pas:make_baby" not in events:
            rep.error(S, f"{ident}: event pas:make_baby missing (SPEC: infected creatures with baby forms)")
        for prefix, count in INDEXED_EVENTS.get(ident, []):
            missing = [f"{prefix}{i}" for i in range(count) if f"{prefix}{i}" not in events]
            if missing:
                rep.error(S, f"{ident}: indexed events missing: {missing[:5]}{'...' if len(missing) > 5 else ''}")
        if ident == "pas:infected_sheep" and "pas:set_sheared" not in events:
            rep.error(S, f"{ident}: event pas:set_sheared missing")
        # every event's groups exist; every group referenced; triggers / self events defined
        referenced: set[str] = set()
        triggers: set[str] = set()
        for en, ev in events.items():
            a, r = set(), set()
            iter_event_groups(ev, a, r, triggers)
            for g in sorted(a | r):
                if g not in groups:
                    rep.error(S, f"{ident}: event {en} references unknown component group {g}")
            referenced |= a | r
        for g in groups:
            if g not in referenced:
                rep.warn(S, f"{ident}: component group {g} is never added/removed by an event")
        self_events: set[str] = set()
        find_self_events(comps, self_events)
        for g in groups.values():
            find_self_events(g, self_events)
        for e in sorted(triggers | self_events):
            if e not in events:
                rep.error(S, f"{ident}: references undefined event {e}")
        tables: set[str] = set()
        find_loot_tables(ent, tables)
        for t in sorted(tables):
            if not (BP / t).is_file() and not (REF / "behavior_pack" / t).is_file():
                rep.error(S, f"{ident}: loot table {t} not found")
    for key, eid in sorted((ids.get("ENTITIES") or {}).items()):
        if eid not in ents:
            rep.missing(S, f"ids.js ENTITIES.{key} = {eid} has no BP entity file")
    for eid in ents:
        if eid not in (ids.get("ENTITIES") or {}).values():
            rep.warn(S, f"{eid} is not listed in ids.js ENTITIES")
    rep.check(S, "identifiers, families, spawnable flags, required groups/events, event->group refs, triggers, loot tables", len(ents))
    return ents


def resolve_refs(rep: Report, S: str, owner: str, desc: dict, idx: Index, van: Vanilla, allow_materials: set[str] | None) -> None:
    geos = desc.get("geometry") or {}
    for k, g in geos.items():
        if g in idx.geometry:
            continue
        if van.available and g in van.geometry:
            continue
        if not van.available:
            rep.warn(S, f"{owner}: geometry {g} not in our models (vanilla unchecked)")
        else:
            rep.error(S, f"{owner}: geometry.{k} = {g} not found in our models/ or vanilla")
    for k, t in (desc.get("textures") or {}).items():
        ok = texture_resolves(t, idx, van)
        if ok is False:
            rep.error(S, f"{owner}: texture {k} = {t} has no .png/.tga in our RP or vanilla")
    for k, a in (desc.get("animations") or {}).items():
        if a.startswith("controller.animation."):
            if a not in idx.controllers and not (van.available and a in van.controllers):
                rep.error(S, f"{owner}: animation controller {k} = {a} not found")
        elif a not in idx.animations and not (van.available and a in van.animations):
            rep.error(S, f"{owner}: animation {k} = {a} not found")
    for ac in desc.get("animation_controllers") or []:
        for k, a in (ac.items() if isinstance(ac, dict) else []):
            if a not in idx.controllers and not (van.available and a in van.controllers):
                rep.error(S, f"{owner}: animation controller {k} = {a} not found")
    anim_keys = set((desc.get("animations") or {}).keys())
    scripts = desc.get("scripts") or {}
    for entry in scripts.get("animate") or []:
        names = list(entry.keys()) if isinstance(entry, dict) else [entry]
        for n in names:
            if n not in anim_keys:
                rep.error(S, f"{owner}: scripts.animate uses {n!r} which is not a key in description.animations")
    for rc in desc.get("render_controllers") or []:
        names = list(rc.keys()) if isinstance(rc, dict) else [rc]
        for n in names:
            body = idx.render_controllers.get(n) or (van.render_controllers.get(n) if van.available else None)
            if body is None:
                if van.available or n not in idx.render_controllers:
                    rep.error(S, f"{owner}: render controller {n} not found")
                continue
            text = json.dumps(body)
            for kind, key in (("Geometry", "geometry"), ("Texture", "textures"), ("Material", "materials")):
                have = set((desc.get(key) or {}).keys())
                for ref in sorted(set(re.findall(rf"\b{kind}\.([A-Za-z0-9_]+)", text))):
                    if ref not in have:
                        rep.error(S, f"{owner}: render controller {n} uses {kind}.{ref} but description.{key} has no {ref!r}")
    if allow_materials is not None:
        for k, m in (desc.get("materials") or {}).items():
            if m not in allow_materials:
                rep.error(S, f"{owner}: material {k} = {m!r} is not used by any vanilla client entity/attachable")


def check_client_entities(rep: Report, ours: Ours, van: Vanilla, idx: Index, bp_ents: dict) -> None:
    S = "client"
    allow = van.materials if van.available else None
    if allow is None:
        rep.warn(S, "material whitelist unavailable (no vanilla reference)")
    else:
        rep.info["allowed_materials"] = sorted(allow)
    seen: dict[str, Path] = {}
    for p, d in sorted(ours.under(RP / "entity").items()):
        ce = d.get("minecraft:client_entity") if isinstance(d, dict) else None
        if not isinstance(ce, dict):
            rep.error(S, f"{rel(p)}: missing minecraft:client_entity")
            continue
        desc = ce.get("description") or {}
        ident = desc.get("identifier")
        if not ident:
            rep.error(S, f"{rel(p)}: missing identifier")
            continue
        if ident in seen:
            rep.error(S, f"duplicate client entity {ident}: {rel(seen[ident])} and {rel(p)}")
        seen[ident] = p
        if ident not in bp_ents and not (van.available and ident in van.entities):
            rep.error(S, f"{ident}: client entity has no BP entity counterpart")
        resolve_refs(rep, S, ident, desc, idx, van, allow)
    for eid in bp_ents:
        if eid not in seen:
            rep.missing(S, f"{eid}: no RP client entity in resource_pack/entity/")
    rep.check(S, "BP counterpart, geometry/textures/animations/controllers/render controllers resolve, scripts keys, materials whitelist", len(seen))


def check_attachables(rep: Report, ours: Ours, van: Vanilla, idx: Index, items: dict) -> None:
    S = "attachables"
    allow = van.materials if van.available else None
    seen: dict[str, Path] = {}
    for p, d in sorted(ours.under(RP / "attachables").items()):
        at = d.get("minecraft:attachable") if isinstance(d, dict) else None
        if not isinstance(at, dict):
            rep.error(S, f"{rel(p)}: missing minecraft:attachable")
            continue
        desc = at.get("description") or {}
        ident = desc.get("identifier")
        if not ident:
            rep.error(S, f"{rel(p)}: missing identifier")
            continue
        if ident in seen:
            rep.error(S, f"duplicate attachable {ident}")
        seen[ident] = p
        if ident not in items and not (van.available and ident in van.items):
            rep.error(S, f"{ident}: attachable identifier does not match any item")
        resolve_refs(rep, S, ident, desc, idx, van, allow)
    for need in ("pas:tactical_torchlight", "pas:tactical_torchlight_on"):
        if need not in seen:
            rep.missing(S, f"attachable {need} (SPEC §5)")
    rep.check(S, "identifier is an item, references resolve, materials whitelist", len(seen))


def check_particles(rep: Report, ours: Ours, van: Vanilla, idx: Index) -> set[str]:
    S = "particles"
    ids: dict[str, Path] = {}
    for p, d in sorted(ours.under(RP / "particles").items()):
        pe = d.get("particle_effect") if isinstance(d, dict) else None
        if not isinstance(pe, dict):
            rep.error(S, f"{rel(p)}: missing particle_effect")
            continue
        if d.get("format_version") != "1.10.0":
            rep.warn(S, f"{rel(p)}: format_version {d.get('format_version')!r} (SPEC: 1.10.0)")
        ident = (pe.get("description") or {}).get("identifier")
        if not ident:
            rep.error(S, f"{rel(p)}: missing identifier")
            continue
        if ident in ids:
            rep.error(S, f"duplicate particle identifier {ident}: {rel(ids[ident])} and {rel(p)}")
        ids[ident] = p
        tex = ((pe.get("description") or {}).get("basic_render_parameters") or {}).get("texture")
        if not tex:
            rep.error(S, f"{ident}: basic_render_parameters.texture missing")
        else:
            ok = texture_resolves(tex, idx, van)
            if ok is False:
                rep.error(S, f"{ident}: texture {tex} has no .png/.tga in our RP or vanilla")
            elif ok is None:
                rep.warn(S, f"{ident}: texture {tex} not in our RP (vanilla unchecked)")
    rep.check(S, "identifier unique, format_version, texture resolves", len(ids))
    return set(ids)


def load_sound_defs(ours: Ours) -> tuple[dict, str]:
    gen = RP / "sounds" / "sound_definitions.json"
    if gen in ours.data and isinstance(ours.data[gen], dict):
        return ours.data[gen].get("sound_definitions") or {}, rel(gen)
    merged = {}
    d = FRAG / "sound_definitions"
    if d.is_dir():
        for p in sorted(d.glob("*.json")):
            try:
                merged.update(parse_strict(p))
            except ValueError:
                pass
    return merged, "fragments (not built yet)"


def load_sounds_json(ours: Ours) -> tuple[dict, str]:
    gen = RP / "sounds.json"
    if gen in ours.data and isinstance(ours.data[gen], dict):
        return ours.data[gen], rel(gen)
    merged: dict = {}

    def merge(a, b):
        for k, v in b.items():
            if isinstance(v, dict) and isinstance(a.get(k), dict):
                merge(a[k], v)
            else:
                a[k] = v

    d = FRAG / "sounds"
    if d.is_dir():
        for p in sorted(d.glob("*.json")):
            try:
                merge(merged, parse_strict(p))
            except ValueError:
                pass
    return merged, "fragments (not built yet)"


def collect_sound_refs(node, out: set) -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "sound" and isinstance(v, str):
                out.add(v)
            elif k == "events" and isinstance(v, dict):
                for ev in v.values():
                    if isinstance(ev, str):
                        out.add(ev)
                    else:
                        collect_sound_refs(ev, out)
            else:
                collect_sound_refs(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_sound_refs(v, out)


def check_sounds(rep: Report, ours: Ours, van: Vanilla, ids: dict, bp_ents: dict) -> None:
    S = "sounds"
    defs, src = load_sound_defs(ours)
    files_checked = 0
    cats = van.sound_categories or {"ambient", "block", "bottle", "bucket", "hostile", "music", "neutral", "player", "record", "ui", "weather"}
    for sid, sd in sorted(defs.items()):
        if not isinstance(sd, dict):
            rep.error(S, f"{sid}: definition must be an object")
            continue
        cat = sd.get("category")
        if cat not in cats:
            rep.error(S, f"{sid}: category {cat!r} not one of {sorted(cats)}")
        for prefix, want in SOUND_CATEGORY_POLICY:
            if sid.startswith(prefix) and cat != want:
                rep.warn(S, f"{sid}: category {cat!r}, SPEC suggests {want!r}")
        for s in sd.get("sounds") or []:
            name = s if isinstance(s, str) else (s.get("name") if isinstance(s, dict) else None)
            if not name:
                rep.error(S, f"{sid}: sound entry without name")
                continue
            files_checked += 1
            if any((RP / (name + e)).is_file() for e in SOUND_EXTS_OURS):
                continue
            if van.available and name in van.sound_files:
                continue
            if not van.available and not name.startswith("sounds/pas/"):
                rep.warn(S, f"{sid}: {name} not in our RP (vanilla unchecked)")
                continue
            rep.error(S, f"{sid}: sound file {name}(.ogg/.wav/.fsb) not found in our RP or vanilla")
    sj, sj_src = load_sounds_json(ours)
    refs: set[str] = set()
    collect_sound_refs(sj, refs)
    refs.discard("")
    for r in sorted(refs):
        if r in defs:
            continue
        if van.available and r in van.sound_defs:
            continue
        if not van.available and not r.startswith("pas."):
            continue
        rep.error(S, f"sounds.json ({sj_src}) references undefined sound {r}")
    ents = ((sj.get("entity_sounds") or {}).get("entities") or {}) if isinstance(sj, dict) else {}
    for eid in ents:
        if eid.startswith("pas:") and eid not in bp_ents:
            rep.error(S, f"sounds.json entity_sounds.entities.{eid} is not a BP entity")
    for eid in bp_ents:
        if eid not in ents:
            rep.missing(S, f"{eid}: no entity_sounds.entities entry in sounds.json")
    for key, sid in sorted((ids.get("SOUNDS") or {}).items()):
        if sid not in defs:
            rep.missing(S, f"ids.js SOUNDS.{key} = {sid} not defined in sound_definitions ({src})")
    rep.check(S, f"sound_definitions ({src}): categories, {files_checked} file refs; sounds.json ({sj_src}) refs; ids.js SOUNDS", len(defs))


def read_lang_keys() -> tuple[set[str], str]:
    gen = RP / "texts" / "en_US.lang"
    files = [gen] if gen.is_file() else sorted((FRAG / "lang").glob("*.lang")) if (FRAG / "lang").is_dir() else []
    keys: set[str] = set()
    for f in files:
        for line in f.read_text(encoding="utf-8-sig").splitlines():
            s = line.strip()
            if s and not s.startswith("##") and "=" in s:
                keys.add(s.split("=", 1)[0].strip())
    return keys, (rel(gen) if gen.is_file() else "fragments (not built yet)")


def check_lang(rep: Report, items: dict, bp_ents: dict) -> None:
    S = "lang"
    keys, src = read_lang_keys()
    if not keys:
        rep.missing(S, "no lang keys at all")
    for iid in items:
        if f"item.{iid}.name" not in keys and f"item.{iid}" not in keys:
            rep.error(S, f"{iid}: no item.{iid}.name / item.{iid} key in {src}")
    for eid in bp_ents:
        if f"entity.{eid}.name" not in keys:
            rep.error(S, f"{eid}: no entity.{eid}.name key in {src}")
    if "pack.name" not in keys:
        rep.error(S, f"pack.name missing in {src}")
    bp_lang = BP / "texts" / "en_US.lang"
    for f in (RP / "texts" / "languages.json", BP / "texts" / "languages.json", bp_lang):
        if not f.is_file():
            rep.missing(S, f"{rel(f)} (run tools/build.py)")
    rep.check(S, f"name keys for {len(items)} items and {len(bp_ents)} entities in {src}", len(keys))


def parse_ids_js() -> dict:
    p = BP / "scripts" / "lib" / "ids.js"
    out: dict[str, dict] = {}
    if not p.is_file():
        return out
    src = p.read_text(encoding="utf-8")
    for m in re.finditer(r"export const (\w+)\s*=\s*Object\.freeze\(\{(.*?)\}\);", src, re.S):
        body = re.sub(r"//[^\n]*", "", m.group(2))
        out[m.group(1)] = dict(re.findall(r'(\w+)\s*:\s*"([^"]*)"', body))
    return out


IMPORT_RE = re.compile(r"""(?:^|[;\s])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)""", re.M)


def check_scripts(rep: Report, ids: dict, particles: set[str], van: Vanilla) -> None:
    S = "scripts"
    sdir = BP / "scripts"
    files = sorted(sdir.rglob("*.js")) if sdir.is_dir() else []
    allowed = set(SCRIPT_MODULES)
    for f in files:
        text = f.read_text(encoding="utf-8")
        no_comments = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        no_comments = re.sub(r"(^|[^:])//[^\n]*", r"\1", no_comments)
        for m in IMPORT_RE.finditer(no_comments):
            spec = m.group(1) or m.group(2) or m.group(3)
            if spec.startswith("."):
                target = (f.parent / spec).resolve()
                if not target.is_file():
                    rep.error(S, f"{rel(f)}: import {spec!r} does not resolve")
            elif spec not in allowed:
                rep.error(S, f"{rel(f)}: imports {spec!r} (only {sorted(allowed)} exist in the game)")
    if not ids:
        rep.error(S, "addon/behavior_pack/scripts/lib/ids.js missing or unparsable")
    for key, pid in sorted((ids.get("PARTICLES") or {}).items()):
        if pid not in particles and not (van.available and pid in van.particles):
            rep.missing(S, f"ids.js PARTICLES.{key} = {pid} not defined by any particle file")
    for sub in ("torchlight", "house", "outbreak"):
        if not (sdir / sub / "index.js").is_file():
            rep.missing(S, f"scripts/{sub}/index.js")
    rep.check(S, "relative imports resolve, only server/server-ui modules, ids.js PARTICLES defined (ITEMS/ENTITIES/SOUNDS in their sections)", len(files))


def check_structures(rep: Report) -> None:
    S = "structures"
    if not STRUCTURE.is_file():
        rep.missing(S, rel(STRUCTURE))
    else:
        head = STRUCTURE.read_bytes()[:3]
        if len(head) < 3 or head[0] != 0x0A:
            rep.error(S, f"{rel(STRUCTURE)}: not a little-endian NBT compound")
    meta = BP / "scripts" / "house" / "blueprint_meta.js"
    if meta.is_file() and STRUCTURE_ID not in meta.read_text(encoding="utf-8"):
        rep.error(S, f"{rel(meta)} does not reference {STRUCTURE_ID}")
    rep.check(S, "luxury_base.mcstructure exists and starts with an NBT compound; blueprint_meta references it")


# ---------------------------------------------------------------------------

def run(strict: bool) -> Report:
    rep = Report(strict)
    rep.info["reference"] = str(REF)
    ours = Ours(rep)
    van = Vanilla(rep)
    idx = Index(ours)
    ids = parse_ids_js()
    check_manifests(rep, ours, van)
    items = check_items(rep, ours, van, idx, ids)
    bp_ents = check_entities(rep, ours, ids)
    check_client_entities(rep, ours, van, idx, bp_ents)
    check_attachables(rep, ours, van, idx, items)
    particles = check_particles(rep, ours, van, idx)
    check_sounds(rep, ours, van, ids, bp_ents)
    check_lang(rep, items, bp_ents)
    check_scripts(rep, ids, particles, van)
    check_structures(rep)
    return rep


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true", help="treat missing content (other workstreams) as errors")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--quiet", action="store_true", help="only print errors and the summary")
    args = ap.parse_args(argv)
    rep = run(args.strict)
    ok = not rep.errors
    if args.json:
        print(json.dumps({"ok": ok, "strict": args.strict, "errors": rep.errors, "warnings": rep.warnings, "checks": rep.checks, "info": rep.info}, indent=2))
        return 0 if ok else 1
    if not args.quiet:
        print(f"validate: reference {REF} ({'found' if (REF / 'resource_pack').is_dir() else 'MISSING'})")
        for c in rep.checks:
            n = f" [{c['count']}]" if c["count"] is not None else ""
            print(f"  check {c['section']:<11} {c['check']}{n}")
        if rep.info.get("allowed_materials"):
            print(f"  allowed materials (used by vanilla client entities/attachables): {', '.join(rep.info['allowed_materials'])}")
        for w in rep.warnings:
            print(f"WARNING [{w['section']}] {w['message']}")
    for e in rep.errors:
        print(f"ERROR   [{e['section']}] {e['message']}")
    print(f"validate: {len(rep.errors)} error(s), {len(rep.warnings)} warning(s){' (strict)' if args.strict else ''} -> {'OK' if ok else 'FAILED'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
