#!/usr/bin/env python3
"""Build SCP-096.mcaddon (deterministic) after verifying the packs.

Usage (run from anywhere, Python 3.8+, standard library only):

    python3 tools/build_mcaddon.py                  # verify, then build SCP-096.mcaddon
    python3 tools/build_mcaddon.py --list           # print the exact list of files that go in the archive
    python3 tools/build_mcaddon.py --list --long    # same, with sizes and CRC32
    python3 tools/build_mcaddon.py --verify-only    # check an existing archive against the current sources
    python3 tools/build_mcaddon.py --allow-missing  # TEST ONLY: tolerate missing files, write a PARTIAL archive
                                                    # to the system temp dir (never to SCP-096.mcaddon)

What it does
  1. Collects only real pack files from SCP096_BP/ and SCP096_RP/ (dev junk is excluded and reported).
  2. Verifies the packs (light checks; tools/validate_addon.py is the full validator):
     manifests, UUIDs, dependencies, strict JSON, language file, cross references between the behavior
     entity, the client entity, geometry, animations, controllers, render controllers, textures and sounds,
     and that every referenced file exists.
  3. Builds the zip in memory twice (must be byte-identical), re-opens it, verifies it again, writes it
     atomically, re-opens the file on disk, verifies once more and prints the tree and the sha256.

Exit status: 0 = ok, 1 = verification failed (nothing is written), 2 = usage error.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
import zlib
from pathlib import Path, PurePosixPath

# --------------------------------------------------------------------------------------
# Constants (see DESIGN.md sections 3 and 4)
# --------------------------------------------------------------------------------------
TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
BP_DIR = "SCP096_BP"
RP_DIR = "SCP096_RP"
PACKS = (BP_DIR, RP_DIR)
OUTPUT_NAME = "SCP-096.mcaddon"
PARTIAL_NAME = "SCP-096.partial.mcaddon"
ENTITY_ID = "scp:scp096"
UUIDS_JSON = TOOLS_DIR / "uuids.json"

FIXED_DATE_TIME = (2024, 6, 13, 0, 0, 0)  # zip timestamps (deterministic output)
MAX_FILE_BYTES = 5 * 1024 * 1024
EXPECTED_MIN_ENGINE = [1, 21, 0]
MAX_SERVER_MODULE = (1, 11, 0)  # highest NON-beta @minecraft/server in Minecraft 1.21.0.x
MAX_FORMAT_VERSION = (1, 21, 0)  # highest per-file "format_version" string the 1.21.0.x game knows

# Files that must exist for a complete add-on (DESIGN.md section 3). Sound files are derived from
# sounds/sound_definitions.json and the script entry from the manifest.
REQUIRED_FILES = [
    f"{BP_DIR}/manifest.json",
    f"{BP_DIR}/pack_icon.png",
    f"{BP_DIR}/entities/scp096.json",
    f"{BP_DIR}/scripts/main.js",
    f"{RP_DIR}/manifest.json",
    f"{RP_DIR}/pack_icon.png",
    f"{RP_DIR}/texts/en_US.lang",
    f"{RP_DIR}/texts/languages.json",
    f"{RP_DIR}/models/entity/scp096.geo.json",
    f"{RP_DIR}/textures/entity/scp096.png",
    f"{RP_DIR}/entity/scp096.entity.json",
    f"{RP_DIR}/animations/scp096.animation.json",
    f"{RP_DIR}/animation_controllers/scp096.animation_controllers.json",
    f"{RP_DIR}/render_controllers/scp096.render_controllers.json",
    f"{RP_DIR}/sounds/sound_definitions.json",
    f"{RP_DIR}/sounds.json",
]
# A build cannot even be attempted without these (--allow-missing cannot waive them).
ALWAYS_REQUIRED = [f"{BP_DIR}/manifest.json", f"{RP_DIR}/manifest.json"]

# What is allowed into the archive. Everything else is skipped and listed.
ALLOWED_SUFFIXES = {
    ".json", ".js", ".png", ".tga", ".jpg", ".jpeg", ".ogg", ".wav", ".fsb", ".lang",
    ".material", ".mcfunction", ".mcstructure",
}
JUNK_DIRS = {"__pycache__", "node_modules", "previews", "tools", "typecheck", "scratch", "__MACOSX"}
JUNK_NAMES = {
    ".ds_store", "thumbs.db", "desktop.ini", ".gitignore", ".gitattributes", ".editorconfig",
    "package.json", "package-lock.json", "tsconfig.json", "jsconfig.json", ".eslintrc.json",
    "pnpm-lock.yaml", "yarn.lock",
}
JUNK_SUFFIXES = {
    ".py", ".pyc", ".pyo", ".md", ".markdown", ".map", ".bak", ".tmp", ".orig", ".rej", ".swp",
    ".psd", ".xcf", ".kra", ".blend", ".bbmodel", ".zip", ".mcaddon", ".mcpack", ".mcworld",
    ".log", ".sh", ".mjs", ".cjs", ".ts", ".txt",
}
TEXT_SUFFIXES = {".json", ".js", ".lang", ".mcfunction"}

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
LANG_FILE_RE = re.compile(r"^[a-z]{2}_[A-Z]{2}\.lang$")
SAFE_PATH_RE = re.compile(r"^[A-Za-z0-9._\-/]+$")
PNG_SIG = b"\x89PNG\r\n\x1a\n"
BOM = b"\xef\xbb\xbf"


# --------------------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------------------
class Report:
    """Collects errors / warnings; 'missing file' problems become warnings with --allow-missing."""

    def __init__(self, allow_missing: bool = False) -> None:
        self.allow_missing = allow_missing
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.missing: list[str] = []

    def error(self, msg: str) -> None:
        if msg not in self.errors:
            self.errors.append(msg)

    def warn(self, msg: str) -> None:
        if msg not in self.warnings:
            self.warnings.append(msg)

    def missing_file(self, path: str, needed_by: str) -> None:
        if path in self.missing:
            return
        self.missing.append(path)
        msg = f"MISSING FILE {path}  (needed by {needed_by})"
        if self.allow_missing:
            self.warn(msg + "  [tolerated by --allow-missing]")
        else:
            self.error(msg)

    def merge(self, other: "Report") -> None:
        for m in other.errors:
            self.error(m)
        for m in other.warnings:
            self.warn(m)


# --------------------------------------------------------------------------------------
# Strict JSON / small helpers
# --------------------------------------------------------------------------------------
def _no_duplicate_keys(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"duplicate key {key!r}")
        out[key] = value
    return out


def _reject_constant(name):
    raise ValueError(f"invalid JSON constant {name}")


def load_json_strict(data: bytes):
    """Parse strict JSON: UTF-8, no BOM, no comments, no trailing commas, no duplicate keys, no NaN."""
    if data.startswith(BOM):
        raise ValueError("file starts with a UTF-8 BOM (must not)")
    text = data.decode("utf-8")
    return json.loads(text, object_pairs_hook=_no_duplicate_keys, parse_constant=_reject_constant)


def png_size(data: bytes):
    if len(data) < 24 or data[:8] != PNG_SIG or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def parse_version_tuple(text):
    """'1.20.80' -> (1, 20, 80); returns None when it is not a plain dotted triple."""
    if not isinstance(text, str):
        return None
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", text)
    return tuple(int(x) for x in m.groups()) if m else None


def human(n: int) -> str:
    return f"{n:,} B"


# --------------------------------------------------------------------------------------
# File collection
# --------------------------------------------------------------------------------------
def classify(rel: PurePosixPath):
    """Return (include, reason_if_excluded) for a path like SCP096_RP/sounds.json."""
    parts = rel.parts
    for part in parts[1:-1]:
        if part in JUNK_DIRS or part.startswith("."):
            return False, f"dev directory '{part}/'"
    name = parts[-1]
    low = name.lower()
    if low in JUNK_NAMES:
        return False, "dev/OS junk file"
    if name.startswith("."):
        return False, "hidden file"
    if name.endswith("~"):
        return False, "editor backup file"
    suffix = PurePosixPath(low).suffix
    if suffix in JUNK_SUFFIXES:
        return False, f"dev file type '{suffix}'"
    if suffix not in ALLOWED_SUFFIXES:
        return False, f"not a pack file type ('{suffix or 'no extension'}')"
    return True, ""


def collect_files(root: Path):
    """Walk both pack folders. Returns (included{arcname: Path}, skipped[(path, reason)], problems[str])."""
    included: dict[str, Path] = {}
    skipped: list[tuple[str, str]] = []
    problems: list[str] = []
    for pack in PACKS:
        pdir = root / pack
        if not pdir.is_dir():
            problems.append(f"pack folder missing: {pack}/")
            continue
        for dirpath, dirnames, filenames in os.walk(pdir, followlinks=False):
            dirnames.sort()
            keep = []
            for d in dirnames:
                dp = Path(dirpath) / d
                rel_dir = dp.relative_to(root).as_posix()
                if dp.is_symlink():
                    problems.append(f"symbolic link not allowed: {rel_dir}")
                elif d in JUNK_DIRS or d.startswith("."):
                    skipped.append((rel_dir + "/", f"dev directory '{d}/' (whole folder)"))
                else:
                    keep.append(d)
            dirnames[:] = keep
            for fn in sorted(filenames):
                fp = Path(dirpath) / fn
                rel = fp.relative_to(root).as_posix()
                if fp.is_symlink():
                    problems.append(f"symbolic link not allowed: {rel}")
                    continue
                if not fp.is_file():
                    problems.append(f"not a regular file: {rel}")
                    continue
                ok, reason = classify(PurePosixPath(rel))
                if ok:
                    included[rel] = fp
                else:
                    skipped.append((rel, reason))
    return dict(sorted(included.items())), skipped, problems


# --------------------------------------------------------------------------------------
# Content checks (what is checked is exactly the bytes that get zipped)
# --------------------------------------------------------------------------------------
def check_path_hygiene(names, report: Report) -> None:
    seen: dict[str, str] = {}
    for name in names:
        low = name.lower()
        if low in seen and seen[low] != name:
            report.error(f"paths differ only by case: {seen[low]} / {name}")
        seen[low] = name
        if "\\" in name or name.startswith("/") or ".." in name.split("/") or "//" in name:
            report.error(f"unsafe path in archive: {name!r}")
        if " " in name:
            report.warn(f"path contains a space: {name}")
        elif not SAFE_PATH_RE.match(name):
            report.warn(f"path contains unusual characters (use [A-Za-z0-9._-/]): {name}")
        parts = name.split("/")
        inner = parts[1:]
        for i, part in enumerate(inner):
            is_last = i == len(inner) - 1
            if part != part.lower():
                if is_last and LANG_FILE_RE.match(part):
                    continue  # en_US.lang is the Mojang convention
                report.warn(f"path has uppercase letters (Android is case sensitive): {name}")
                break


def check_text_file(rel: str, data: bytes, report: Report) -> None:
    if data.startswith(BOM):
        report.error(f"{rel}: starts with a UTF-8 BOM")
    if b"\r" in data:
        report.warn(f"{rel}: contains CR characters (CRLF line endings); use LF")
    if data and not data.endswith(b"\n"):
        report.warn(f"{rel}: no newline at end of file")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        report.error(f"{rel}: not valid UTF-8 ({exc})")


def check_lang(rel: str, data: bytes, report: Report) -> dict[str, str]:
    """Check a .lang file. Trailing spaces are NOT trimmed by the game (see vanilla en_US.lang header)."""
    keys: dict[str, str] = {}
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return keys
    for lineno, line in enumerate(text.split("\n"), 1):
        line = line.rstrip("\r")
        if line == "" or line.startswith("##"):
            continue
        if "=" not in line:
            report.error(f"{rel}:{lineno}: line has no '=' (key=value): {line!r}")
            continue
        key, value = line.split("=", 1)
        if not key or key != key.strip():
            report.error(f"{rel}:{lineno}: bad key {key!r}")
        if value != value.rstrip(" \t"):
            report.error(f"{rel}:{lineno}: trailing whitespace is NOT trimmed by Minecraft and becomes part of the text")
        if "##" in value:
            report.warn(f"{rel}:{lineno}: '##' starts a comment inside a value")
        if "\t" in value:
            report.warn(f"{rel}:{lineno}: TAB in value (a TAB starts a trailing comment)")
        if key in keys:
            report.error(f"{rel}:{lineno}: duplicate key {key}")
        keys[key] = value
    return keys


def read_contents(included: dict[str, Path], report: Report):
    """Read every included file once. Returns (contents{name: bytes}, parsed{name: json})."""
    contents: dict[str, bytes] = {}
    parsed: dict[str, object] = {}
    for rel, path in included.items():
        data = path.read_bytes()
        contents[rel] = data
        suffix = PurePosixPath(rel).suffix.lower()
        if len(data) > MAX_FILE_BYTES:
            report.error(f"{rel}: {human(len(data))} is larger than the {human(MAX_FILE_BYTES)} limit")
        if len(data) == 0:
            report.warn(f"{rel}: file is empty")
        if suffix in TEXT_SUFFIXES:
            check_text_file(rel, data, report)
        if suffix == ".json" and data:
            try:
                parsed[rel] = load_json_strict(data)
            except ValueError as exc:
                report.error(f"{rel}: invalid strict JSON: {exc}")
        elif suffix == ".png" and data and png_size(data) is None:
            report.error(f"{rel}: not a valid PNG file")
        elif suffix == ".ogg" and data and data[:4] != b"OggS":
            report.error(f"{rel}: not an Ogg file (missing 'OggS' header)")
    return contents, parsed


# --------------------------------------------------------------------------------------
# Manifest checks
# --------------------------------------------------------------------------------------
def _is_version3(v) -> bool:
    return isinstance(v, list) and len(v) == 3 and all(type(x) is int and x >= 0 for x in v)


def _check_manifest(m, pack: str, report: Report, exists):
    """Validate one manifest; returns dict of roles -> uuid for cross checks."""
    label = f"{pack}/manifest.json"
    roles: dict[str, object] = {"modules": {}}
    if not isinstance(m, dict):
        report.error(f"{label}: top level must be an object")
        return roles
    allowed_top = {"format_version", "header", "modules", "dependencies", "metadata"}
    for key in m:
        if key not in allowed_top:
            report.error(f"{label}: unexpected top-level key {key!r}")
    if m.get("format_version") != 2 or type(m.get("format_version")) is not int:
        report.error(f"{label}: format_version must be the integer 2")

    header = m.get("header")
    if not isinstance(header, dict):
        report.error(f"{label}: header missing")
        header = {}
    for key in header:
        if key not in {"name", "description", "uuid", "version", "min_engine_version"}:
            report.error(f"{label}: unexpected header key {key!r}")
    for key in ("name", "description"):
        if not isinstance(header.get(key), str) or not header.get(key):
            report.error(f"{label}: header.{key} must be a non-empty string")
    if not _is_version3(header.get("version")):
        report.error(f"{label}: header.version must be [major, minor, patch] integers")
    if not _is_version3(header.get("min_engine_version")):
        report.error(f"{label}: header.min_engine_version must be [major, minor, patch] integers")
    elif header["min_engine_version"] != EXPECTED_MIN_ENGINE:
        report.warn(f"{label}: min_engine_version {header['min_engine_version']} differs from the design value {EXPECTED_MIN_ENGINE}")
    huuid = header.get("uuid")
    if not isinstance(huuid, str) or not UUID_RE.match(huuid):
        report.error(f"{label}: header.uuid {huuid!r} is not a lowercase v4 UUID")
    roles["header"] = huuid
    roles["header_version"] = header.get("version")
    roles["min_engine"] = header.get("min_engine_version")

    modules = m.get("modules")
    if not isinstance(modules, list) or not modules:
        report.error(f"{label}: modules must be a non-empty array")
        modules = []
    allowed_types = {"data", "script", "resources"}
    want = ["data", "script"] if pack == BP_DIR else ["resources"]
    types = []
    for i, mod in enumerate(modules):
        where = f"{label} modules[{i}]"
        if not isinstance(mod, dict):
            report.error(f"{where}: must be an object")
            continue
        for key in mod:
            if key not in {"type", "description", "uuid", "version", "language", "entry"}:
                report.error(f"{where}: unexpected key {key!r}")
        mtype = mod.get("type")
        types.append(mtype)
        if mtype not in allowed_types:
            report.error(f"{where}: unsupported module type {mtype!r}")
        if not isinstance(mod.get("uuid"), str) or not UUID_RE.match(mod.get("uuid", "")):
            report.error(f"{where}: uuid {mod.get('uuid')!r} is not a lowercase v4 UUID")
        if not _is_version3(mod.get("version")):
            report.error(f"{where}: version must be [major, minor, patch] integers")
        if "description" in mod and not isinstance(mod["description"], str):
            report.error(f"{where}: description must be a string")
        if mtype == "script":
            if mod.get("language") != "javascript":
                report.error(f"{where}: script module needs \"language\": \"javascript\"")
            entry = mod.get("entry")
            if not isinstance(entry, str) or not entry or entry.startswith("/") or "\\" in entry or ".." in entry.split("/"):
                report.error(f"{where}: bad script entry {entry!r}")
            elif not exists(pack, entry):
                report.missing_file(f"{pack}/{entry}", f"{where} entry")
        else:
            if "language" in mod or "entry" in mod:
                report.error(f"{where}: language/entry belong only on the script module")
        roles["modules"][mtype] = mod.get("uuid")
    if sorted(t for t in types if isinstance(t, str)) != sorted(want):
        report.error(f"{label}: modules must be exactly {want}, found {types}")

    deps = m.get("dependencies")
    dep_pack: list[dict] = []
    dep_mod: list[dict] = []
    if deps is not None:
        if not isinstance(deps, list):
            report.error(f"{label}: dependencies must be an array")
            deps = []
        for i, dep in enumerate(deps):
            where = f"{label} dependencies[{i}]"
            if not isinstance(dep, dict):
                report.error(f"{where}: must be an object")
            elif set(dep) == {"uuid", "version"}:
                dep_pack.append(dep)
            elif set(dep) == {"module_name", "version"}:
                dep_mod.append(dep)
            else:
                report.error(f"{where}: must have exactly uuid+version or module_name+version, found {sorted(dep)}")
    roles["dep_pack"] = dep_pack
    roles["dep_mod"] = dep_mod

    meta = m.get("metadata")
    if meta is not None:
        if not isinstance(meta, dict):
            report.error(f"{label}: metadata must be an object")
        else:
            for key, val in meta.items():
                if key not in {"authors", "license", "url", "generated_with", "product_type"}:
                    report.error(f"{label}: unexpected metadata key {key!r}")
            authors = meta.get("authors")
            if authors is not None and not (isinstance(authors, list) and all(isinstance(a, str) and a for a in authors)):
                report.error(f"{label}: metadata.authors must be an array of strings")
    return roles


def check_manifests(bp, rp, exists, uuids: dict | None, report: Report) -> None:
    """Cross-checks both manifests. `exists(pack_dir, relpath)` tells whether a pack file exists."""
    b = _check_manifest(bp, BP_DIR, report, exists)
    r = _check_manifest(rp, RP_DIR, report, exists)

    all_uuids = []
    for roles, pack in ((b, BP_DIR), (r, RP_DIR)):
        if isinstance(roles.get("header"), str):
            all_uuids.append((f"{pack} header", roles["header"]))
        for mtype, u in roles["modules"].items():
            if isinstance(u, str):
                all_uuids.append((f"{pack} {mtype} module", u))
    seen: dict[str, str] = {}
    for label, u in all_uuids:
        if u in seen:
            report.error(f"UUID {u} is used twice: {seen[u]} and {label}")
        seen[u] = label
    if len(all_uuids) != 5:
        report.warn(f"expected 5 UUIDs (2 headers + 3 modules), found {len(all_uuids)}")

    if uuids is not None:
        expected = {
            "bp_header": b.get("header"),
            "bp_data_module": b["modules"].get("data"),
            "bp_script_module": b["modules"].get("script"),
            "rp_header": r.get("header"),
            "rp_resources_module": r["modules"].get("resources"),
        }
        for key, actual in expected.items():
            if uuids.get(key) != actual:
                report.error(f"manifest uuid for {key} is {actual!r} but tools/uuids.json says {uuids.get(key)!r}")

    # BP -> RP dependency
    rp_uuid, rp_ver = r.get("header"), r.get("header_version")
    matches = [d for d in b["dep_pack"] if d.get("uuid") == rp_uuid]
    if not matches:
        report.error(f"{BP_DIR}/manifest.json: no dependency on the resource pack header uuid {rp_uuid}")
    for d in matches:
        if d.get("version") != rp_ver:
            report.error(f"{BP_DIR}/manifest.json: dependency version {d.get('version')} != resource pack header version {rp_ver}")
    for d in b["dep_pack"]:
        if d.get("uuid") != rp_uuid:
            report.error(f"{BP_DIR}/manifest.json: dependency on unknown pack uuid {d.get('uuid')}")
    # RP must not depend on anything (BP -> RP only: no cycles)
    if r["dep_pack"] or r["dep_mod"]:
        report.error(f"{RP_DIR}/manifest.json: the resource pack must have no dependencies")

    # script module dependency
    has_script = "script" in b["modules"]
    server = [d for d in b["dep_mod"] if d.get("module_name") == "@minecraft/server"]
    if has_script and not server:
        report.error(f"{BP_DIR}/manifest.json: script module present but no @minecraft/server dependency")
    for d in b["dep_mod"]:
        name, ver = d.get("module_name"), d.get("version")
        if name != "@minecraft/server":
            report.warn(f"{BP_DIR}/manifest.json: unexpected module dependency {name} {ver}")
            continue
        vt = parse_version_tuple(ver)
        if vt is None:
            report.error(f"{BP_DIR}/manifest.json: @minecraft/server version {ver!r} is not a stable x.y.z "
                         f"(beta / -beta versions need the Beta APIs experiment)")
        elif vt > MAX_SERVER_MODULE:
            report.error(f"{BP_DIR}/manifest.json: @minecraft/server {ver} is newer than the last stable "
                         f"module of 1.21.0 ({'.'.join(map(str, MAX_SERVER_MODULE))}); it would need the Beta APIs experiment")

    if b.get("min_engine") != r.get("min_engine"):
        report.warn("min_engine_version differs between the two packs")


# --------------------------------------------------------------------------------------
# Cross-reference checks (light)
# --------------------------------------------------------------------------------------
def check_format_versions(parsed: dict, report: Report) -> None:
    for rel, obj in parsed.items():
        if not isinstance(obj, dict) or rel.endswith("manifest.json"):
            continue
        fv = obj.get("format_version")
        if isinstance(fv, str):
            vt = parse_version_tuple(fv)
            if vt is None:
                report.error(f"{rel}: format_version {fv!r} is not x.y.z")
            elif vt > MAX_FORMAT_VERSION:
                report.error(f"{rel}: format_version {fv} is newer than Minecraft 1.21.0 understands")
        elif fv is not None and not rel.endswith("languages.json"):
            report.warn(f"{rel}: format_version is not a string ({fv!r})")


def _walk(node):
    """Yield every dict/list node (depth first)."""
    yield node
    if isinstance(node, dict):
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)


def check_bp_entities(parsed: dict, report: Report) -> dict:
    """Light behavior-entity checks. Returns {identifier: {'spawnable': bool}}."""
    found: dict[str, dict] = {}
    for rel in sorted(parsed):
        if not (rel.startswith(f"{BP_DIR}/entities/") and rel.endswith(".json")):
            continue
        obj = parsed[rel]
        ent = obj.get("minecraft:entity") if isinstance(obj, dict) else None
        if not isinstance(ent, dict):
            report.error(f"{rel}: missing top-level \"minecraft:entity\"")
            continue
        desc = ent.get("description") if isinstance(ent.get("description"), dict) else {}
        ident = desc.get("identifier")
        if not isinstance(ident, str) or ":" not in ident:
            report.error(f"{rel}: description.identifier must be 'namespace:name', got {ident!r}")
            continue
        found[ident] = {"spawnable": desc.get("is_spawnable") is True}
        groups = ent.get("component_groups") or {}
        events = ent.get("events") or {}
        if not isinstance(groups, dict) or not isinstance(events, dict):
            report.error(f"{rel}: component_groups/events must be objects")
            continue
        # component groups named in add/remove
        for ev_name, ev in events.items():
            for node in _walk(ev):
                if isinstance(node, dict):
                    for op in ("add", "remove"):
                        body = node.get(op)
                        if isinstance(body, dict):
                            for g in body.get("component_groups", []) or []:
                                if g not in groups:
                                    report.error(f"{rel}: event {ev_name!r} {op}s unknown component group {g!r}")
        # events fired from components / events
        for scope_name, scope in (("component_groups", groups), ("components", ent.get("components") or {}), ("events", events)):
            for node in _walk(scope):
                if not isinstance(node, dict):
                    continue
                for key in ("event", "look_event", "trigger"):
                    ref = node.get(key)
                    if isinstance(ref, str) and not ref.startswith("minecraft:") and ref not in events:
                        report.error(f"{rel}: {scope_name} reference unknown event {ref!r} (via key {key!r})")
        if ident == ENTITY_ID and "minecraft:entity_spawned" not in events:
            report.warn(f"{rel}: no 'minecraft:entity_spawned' event (initial state would not be set)")
    if ENTITY_ID not in found and any(r.startswith(f"{BP_DIR}/entities/") for r in parsed):
        report.error(f"no behavior entity with identifier {ENTITY_ID} in {BP_DIR}/entities/")
    return found


def _collect_ids(parsed: dict, folder: str, picker):
    ids: set[str] = set()
    for rel, obj in parsed.items():
        if rel.startswith(folder) and rel.endswith(".json") and isinstance(obj, dict):
            ids.update(picker(obj))
    return ids


def _geometry_ids(obj):
    out = []
    for item in obj.get("minecraft:geometry", []) if isinstance(obj.get("minecraft:geometry"), list) else []:
        if isinstance(item, dict) and isinstance(item.get("description"), dict):
            ident = item["description"].get("identifier")
            if isinstance(ident, str):
                out.append(ident)
    for key in obj:  # legacy 1.8 style: "geometry.name" or "geometry.name:geometry.parent"
        if isinstance(key, str) and key.startswith("geometry."):
            out.append(key.split(":")[0])
    return out


def _shortnames(entry):
    """animate / animations lists: entries are 'name' or {'name': molang}."""
    if isinstance(entry, str):
        return [entry]
    if isinstance(entry, dict):
        return list(entry.keys())
    return []


def _effects_in(node):
    """Collect 'effect' names inside a sound_effects node (dict of time -> obj|list, or list of obj)."""
    out = []
    for n in _walk(node):
        if isinstance(n, dict) and isinstance(n.get("effect"), str):
            out.append(n["effect"])
    return out


def check_rp(contents: dict, parsed: dict, bp_entities: dict, report: Report):
    """Client entity <-> geometry / animations / controllers / render controllers / textures / sounds."""
    pre = RP_DIR + "/"
    geo_ids = _collect_ids(parsed, pre + "models/", _geometry_ids)
    anim_ids = _collect_ids(parsed, pre + "animations/", lambda o: list(o.get("animations", {})) if isinstance(o.get("animations"), dict) else [])
    ctrl_ids = _collect_ids(parsed, pre + "animation_controllers/",
                            lambda o: list(o.get("animation_controllers", {})) if isinstance(o.get("animation_controllers"), dict) else [])
    rc_ids = _collect_ids(parsed, pre + "render_controllers/",
                          lambda o: list(o.get("render_controllers", {})) if isinstance(o.get("render_controllers"), dict) else [])
    sd = parsed.get(pre + "sounds/sound_definitions.json")
    sound_defs = sd.get("sound_definitions", {}) if isinstance(sd, dict) and isinstance(sd.get("sound_definitions"), dict) else {}

    # animation / controller documents by id, for the per-entity short-name checks
    anim_docs: dict[str, object] = {}
    ctrl_docs: dict[str, object] = {}
    for rel, obj in parsed.items():
        if rel.startswith(pre + "animations/") and isinstance(obj, dict) and isinstance(obj.get("animations"), dict):
            anim_docs.update(obj["animations"])
        if rel.startswith(pre + "animation_controllers/") and isinstance(obj, dict) and isinstance(obj.get("animation_controllers"), dict):
            ctrl_docs.update(obj["animation_controllers"])

    # controller graph sanity (independent of the entity)
    for cid, ctrl in ctrl_docs.items():
        states = ctrl.get("states") if isinstance(ctrl, dict) else None
        if not isinstance(states, dict) or not states:
            report.error(f"animation controller {cid}: no states")
            continue
        initial = ctrl.get("initial_state", "default")
        if initial not in states:
            report.error(f"animation controller {cid}: initial_state {initial!r} is not a state")
        for sname, state in states.items():
            for tr in (state.get("transitions", []) if isinstance(state, dict) else []):
                for target in (tr.keys() if isinstance(tr, dict) else []):
                    if target not in states:
                        report.error(f"animation controller {cid}: state {sname!r} transitions to unknown state {target!r}")

    # client entities
    client_seen = set()
    for rel in sorted(parsed):
        if not (rel.startswith(pre + "entity/") and rel.endswith(".json")):
            continue
        obj = parsed[rel]
        ce = obj.get("minecraft:client_entity") if isinstance(obj, dict) else None
        if not isinstance(ce, dict) or not isinstance(ce.get("description"), dict):
            report.error(f"{rel}: missing \"minecraft:client_entity\" / description")
            continue
        d = ce["description"]
        ident = d.get("identifier")
        client_seen.add(ident)
        if ident not in bp_entities:
            report.error(f"{rel}: client entity {ident!r} has no matching behavior entity in {BP_DIR}")

        for key, tex in (d.get("textures") or {}).items():
            if not isinstance(tex, str):
                report.error(f"{rel}: textures.{key} must be a path string")
                continue
            if not any(f"{pre}{tex}{ext}" in contents for ext in (".png", ".tga", ".jpg", ".jpeg")):
                report.missing_file(f"{pre}{tex}.png", f"{rel} textures.{key}")
        for key, gid in (d.get("geometry") or {}).items():
            if not isinstance(gid, str) or gid.split(":")[0] not in geo_ids:
                report.error(f"{rel}: geometry.{key} -> {gid!r} is not defined in {RP_DIR}/models/")
        entity_anims = d.get("animations") or {}
        for short, aid in entity_anims.items():
            if aid not in anim_ids and aid not in ctrl_ids:
                report.error(f"{rel}: animations.{short} -> {aid!r} is not an animation or controller defined in the pack")
        scripts = d.get("scripts") if isinstance(d.get("scripts"), dict) else {}
        for entry in scripts.get("animate", []) or []:
            for short in _shortnames(entry):
                if short not in entity_anims:
                    report.error(f"{rel}: scripts.animate uses {short!r} which is not in animations")
        for entry in d.get("render_controllers", []) or []:
            for rid in _shortnames(entry):
                if rid not in rc_ids:
                    report.error(f"{rel}: render controller {rid!r} is not defined in {RP_DIR}/render_controllers/")
        entity_sfx = d.get("sound_effects") or {}
        for short, sid in entity_sfx.items():
            if sid not in sound_defs:
                report.warn(f"{rel}: sound_effects.{short} -> {sid!r} is not defined in this pack's sound_definitions.json "
                            f"(fine only if it is a vanilla sound id)")
        egg = d.get("spawn_egg")
        if egg is not None:
            if not isinstance(egg, dict):
                report.error(f"{rel}: spawn_egg must be an object")
            elif "base_color" in egg or "overlay_color" in egg:
                for k in ("base_color", "overlay_color"):
                    if not isinstance(egg.get(k), str) or not HEX_COLOR_RE.match(egg.get(k, "")):
                        report.error(f"{rel}: spawn_egg.{k} must be a '#RRGGBB' string, got {egg.get(k)!r}")
        elif bp_entities.get(ident, {}).get("spawnable"):
            report.warn(f"{rel}: behavior entity is_spawnable but the client entity has no spawn_egg colors")

        # per-entity short-name checks inside animations / controllers it uses
        for short, aid in entity_anims.items():
            if aid in anim_docs:
                anim = anim_docs[aid]
                for eff in _effects_in(anim.get("sound_effects")) if isinstance(anim, dict) else []:
                    if eff not in entity_sfx:
                        report.error(f"animation {aid}: sound effect {eff!r} not listed in {rel} sound_effects")
            elif aid in ctrl_docs:
                ctrl = ctrl_docs[aid]
                for sname, state in (ctrl.get("states", {}) if isinstance(ctrl, dict) else {}).items():
                    if not isinstance(state, dict):
                        continue
                    for entry in state.get("animations", []) or []:
                        for ashort in _shortnames(entry):
                            if ashort not in entity_anims:
                                report.error(f"controller {aid} state {sname!r}: animation {ashort!r} not in {rel} animations")
                    for eff in _effects_in(state.get("sound_effects")):
                        if eff not in entity_sfx:
                            report.error(f"controller {aid} state {sname!r}: sound effect {eff!r} not listed in {rel} sound_effects")
    if ENTITY_ID not in client_seen and any(r.startswith(pre + "entity/") for r in contents):
        report.error(f"no client entity with identifier {ENTITY_ID} in {RP_DIR}/entity/")

    # geometry vs texture size (the classic silent UV bug)
    for rel, obj in parsed.items():
        if not (rel.startswith(pre + "models/") and isinstance(obj, dict)):
            continue
        for item in obj.get("minecraft:geometry", []) if isinstance(obj.get("minecraft:geometry"), list) else []:
            desc = item.get("description", {}) if isinstance(item, dict) else {}
            tw, th = desc.get("texture_width"), desc.get("texture_height")
            ident = desc.get("identifier")
            for erel, eobj in parsed.items():
                if not (erel.startswith(pre + "entity/") and isinstance(eobj, dict)):
                    continue
                ed = (eobj.get("minecraft:client_entity") or {}).get("description") or {}
                if ident in (ed.get("geometry") or {}).values():
                    for tex in (ed.get("textures") or {}).values():
                        data = contents.get(f"{pre}{tex}.png")
                        size = png_size(data) if data else None
                        if size and (tw, th) != size:
                            report.error(f"texture {pre}{tex}.png is {size[0]}x{size[1]} but {ident} declares {tw}x{th}")

    # sounds
    referenced_sounds: set[str] = set()
    if sd is not None and not isinstance(sd.get("sound_definitions"), dict):
        report.error(f"{pre}sounds/sound_definitions.json: missing \"sound_definitions\" object")
    for sid, definition in sound_defs.items():
        entries = definition.get("sounds") if isinstance(definition, dict) else None
        if not isinstance(entries, list) or not entries:
            report.error(f"sound definition {sid}: needs a non-empty \"sounds\" array")
            continue
        for entry in entries:
            name = entry if isinstance(entry, str) else (entry.get("name") if isinstance(entry, dict) else None)
            if not isinstance(name, str):
                report.error(f"sound definition {sid}: entry without a name: {entry!r}")
                continue
            hit = [pre + name + ext for ext in (".ogg", ".wav", ".fsb") if pre + name + ext in contents]
            if hit:
                referenced_sounds.update(hit)
            else:
                report.missing_file(f"{pre}{name}.ogg", f"sound definition {sid}")
    for rel in contents:
        if rel.startswith(pre + "sounds/") and rel.split(".")[-1] in ("ogg", "wav", "fsb") and rel not in referenced_sounds:
            report.warn(f"{rel}: sound file is not referenced by sound_definitions.json")
    sj = parsed.get(pre + "sounds.json")
    if isinstance(sj, dict):
        for node in _walk(sj):
            events = node.get("events") if isinstance(node, dict) else None
            if not isinstance(events, dict):
                continue
            for evname, val in events.items():
                sid = val if isinstance(val, str) else (val.get("sound") if isinstance(val, dict) else None)
                if isinstance(sid, str) and sid not in sound_defs:
                    report.warn(f"{pre}sounds.json: event {evname!r} uses {sid!r} which is not defined in this pack's "
                                f"sound_definitions.json (fine only if it is a vanilla sound id)")
    return {"geometry": geo_ids, "sounds": set(sound_defs)}


def check_lang_for_entities(contents: dict, bp_entities: dict, report: Report) -> None:
    lang_path = f"{RP_DIR}/texts/en_US.lang"
    if lang_path not in contents:
        return  # reported as missing elsewhere
    keys = check_lang(lang_path, contents[lang_path], report)
    for ident, info in bp_entities.items():
        k = f"entity.{ident}.name"
        if k not in keys:
            report.error(f"{lang_path}: missing {k}")
        if info["spawnable"]:
            k = f"item.spawn_egg.entity.{ident}.name"
            if k not in keys:
                report.error(f"{lang_path}: missing {k}")
    for hard in (("entity.scp:scp096.name", "SCP-096"), ("item.spawn_egg.entity.scp:scp096.name", "SCP-096 Spawn Egg")):
        if keys.get(hard[0]) not in (None, hard[1]):
            report.warn(f"{lang_path}: {hard[0]} is {keys[hard[0]]!r}, the design says {hard[1]!r}")
    lj = f"{RP_DIR}/texts/languages.json"
    if lj in contents:
        try:
            langs = load_json_strict(contents[lj])
        except ValueError:
            langs = None  # reported by read_contents
        if langs is not None:
            if not (isinstance(langs, list) and all(isinstance(x, str) for x in langs)):
                report.error(f"{lj}: must be an array of language codes")
            else:
                for code in langs:
                    if f"{RP_DIR}/texts/{code}.lang" not in contents:
                        report.error(f"{lj}: lists {code!r} but texts/{code}.lang does not exist")


def check_pack_icons(contents: dict, report: Report) -> None:
    for pack in PACKS:
        data = contents.get(f"{pack}/pack_icon.png")
        size = png_size(data) if data else None
        if size and size[0] != size[1]:
            report.warn(f"{pack}/pack_icon.png is {size[0]}x{size[1]}; pack icons should be square")


def run_checks(contents: dict, parsed: dict, uuids: dict | None, report: Report) -> None:
    """All content verification. Used on the source files and again on the finished archive."""
    check_path_hygiene(sorted(contents), report)
    for rel in REQUIRED_FILES:
        if rel not in contents:
            if rel in ALWAYS_REQUIRED:
                report.error(f"MISSING FILE {rel}  (cannot build without it; --allow-missing cannot waive this)")
            else:
                report.missing_file(rel, "required file list (DESIGN.md section 3)")
    bp = parsed.get(f"{BP_DIR}/manifest.json")
    rp = parsed.get(f"{RP_DIR}/manifest.json")
    if bp is not None and rp is not None:
        check_manifests(bp, rp, lambda pack, rel: f"{pack}/{rel}" in contents, uuids, report)
    check_format_versions(parsed, report)
    bp_entities = check_bp_entities(parsed, report)
    check_rp(contents, parsed, bp_entities, report)
    check_lang_for_entities(contents, bp_entities, report)
    check_pack_icons(contents, report)


# --------------------------------------------------------------------------------------
# Zip building and verification
# --------------------------------------------------------------------------------------
def build_zip_bytes(contents: dict[str, bytes]) -> bytes:
    """Deterministic zip: sorted names, fixed timestamp, fixed attributes, DEFLATE level 9."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(contents):
            zi = zipfile.ZipInfo(name, date_time=FIXED_DATE_TIME)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.create_system = 3  # Unix, so external_attr below is meaningful on every build machine
            zi.external_attr = (0o100644 & 0xFFFF) << 16
            zf.writestr(zi, contents[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return buf.getvalue()


def verify_archive(source, expected: dict[str, bytes], uuids: dict | None, allow_missing: bool):
    """Re-open the archive (bytes or path) and verify it. Returns (Report, infolist)."""
    report = Report(allow_missing)
    fh = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else open(source, "rb")
    try:
        with zipfile.ZipFile(fh) as zf:
            bad = zf.testzip()
            if bad is not None:
                report.error(f"zipfile.testzip(): first bad member is {bad}")
            infos = zf.infolist()
            names = [i.filename for i in infos]
            if len(set(names)) != len(names):
                report.error("archive contains duplicate entries")
            if names != sorted(expected):
                extra = sorted(set(names) - set(expected))
                lost = sorted(set(expected) - set(names))
                report.error(f"archive listing differs from the expected file list (extra={extra}, missing={lost})")
            if names != sorted(names):
                report.error("archive entries are not sorted")
            roots = {n.split("/")[0] for n in names}
            if roots != set(PACKS):
                report.error(f"zip root must contain exactly {sorted(PACKS)}, found {sorted(roots)}")
            for info in infos:
                n = info.filename
                if n.endswith("/"):
                    report.error(f"unexpected directory entry {n}")
                if "\\" in n or n.startswith("/") or ".." in n.split("/"):
                    report.error(f"unsafe entry name {n!r}")
                if info.date_time != FIXED_DATE_TIME:
                    report.error(f"{n}: timestamp {info.date_time} != {FIXED_DATE_TIME}")
                if info.compress_type != zipfile.ZIP_DEFLATED:
                    report.error(f"{n}: not DEFLATE compressed")
                if info.file_size > MAX_FILE_BYTES:
                    report.error(f"{n}: larger than {human(MAX_FILE_BYTES)}")
                if n in expected and zf.read(n) != expected[n]:
                    report.error(f"{n}: archived bytes differ from the source file")
            # the shipped manifests must be consistent on their own
            archived = {n: zf.read(n) for n in names if n in (f"{BP_DIR}/manifest.json", f"{RP_DIR}/manifest.json")}
            parsed = {}
            for n, data in archived.items():
                try:
                    parsed[n] = load_json_strict(data)
                except ValueError as exc:
                    report.error(f"{n} (in archive): {exc}")
            if len(parsed) == 2:
                nameset = set(names)
                check_manifests(parsed[f"{BP_DIR}/manifest.json"], parsed[f"{RP_DIR}/manifest.json"],
                                lambda pack, rel: f"{pack}/{rel}" in nameset, uuids, report)
            else:
                report.error("archive does not hold both manifest.json files")
    except zipfile.BadZipFile as exc:
        report.error(f"not a valid zip: {exc}")
        infos = []
    finally:
        fh.close()
    return report, infos


def unzip_test(path: Path) -> str | None:
    """Optional extra: run `unzip -t` when available. Returns an error string or None."""
    exe = shutil.which("unzip")
    if not exe:
        return None
    proc = subprocess.run([exe, "-tq", str(path)], capture_output=True, text=True)
    if proc.returncode != 0:
        return f"unzip -t failed: {proc.stdout.strip()} {proc.stderr.strip()}"
    return None


def print_tree(infos) -> None:
    tree: dict = {}
    for info in infos:
        node = tree
        parts = info.filename.split("/")
        for part in parts[:-1]:
            node = node.setdefault(part + "/", {})
        node[parts[-1]] = (info.file_size, info.compress_size)

    def total(n):
        return sum(v[0] if isinstance(v, tuple) else total(v) for v in n.values())

    def count(n):
        return sum(1 if isinstance(v, tuple) else count(v) for v in n.values())

    lines: list[tuple[str, str]] = []

    def walk(n, depth):
        for name in sorted(n):
            v = n[name]
            if isinstance(v, tuple):
                lines.append(("  " * depth + name, f"{human(v[0])}  (zip {human(v[1])})"))
            else:
                lines.append(("  " * depth + name, f"{human(total(v))} in {count(v)} files"))
                walk(v, depth + 1)

    walk(tree, 0)
    width = max(len(a) for a, _ in lines) if lines else 0
    for a, b in lines:
        print(f"  {a.ljust(width)}  {b}")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------
def load_uuids() -> dict | None:
    if not UUIDS_JSON.is_file():
        return None
    try:
        return json.loads(UUIDS_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def print_findings(report: Report) -> None:
    if report.warnings:
        print(f"\nWARNINGS ({len(report.warnings)}):")
        for w in report.warnings:
            print(f"  warning: {w}")
    if report.errors:
        print(f"\nERRORS ({len(report.errors)}):")
        for e in report.errors:
            print(f"  ERROR: {e}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Build SCP-096.mcaddon from SCP096_BP and SCP096_RP.")
    ap.add_argument("--list", action="store_true", help="print the exact list of files that goes into the archive and exit")
    ap.add_argument("--long", action="store_true", help="with --list: add size and CRC32 columns")
    ap.add_argument("--verify-only", action="store_true", help="verify an existing archive against the current sources; write nothing")
    ap.add_argument("--allow-missing", action="store_true",
                    help="TEST ONLY: downgrade 'missing file' errors to warnings and write a PARTIAL archive to the system temp dir")
    ap.add_argument("-o", "--output", help=f"output path (default: <addon root>/{OUTPUT_NAME})")
    args = ap.parse_args(argv)

    if args.long and not args.list:
        ap.error("--long only makes sense with --list")

    included, skipped, problems = collect_files(ROOT)

    if args.list:
        for p in problems:
            print(f"warning: {p}", file=sys.stderr)
        for rel, reason in skipped:
            print(f"excluded: {rel}  ({reason})", file=sys.stderr)
        for rel, path in included.items():
            if args.long:
                data = path.read_bytes()
                print(f"{len(data):>9}  {zlib.crc32(data):08x}  {rel}")
            else:
                print(rel)
        return 0 if not problems else 1

    default_out = (Path(tempfile.gettempdir()) / PARTIAL_NAME) if args.allow_missing else (ROOT / OUTPUT_NAME)
    out_path = Path(args.output).resolve() if args.output else default_out
    official = (ROOT / OUTPUT_NAME).resolve()
    if args.allow_missing and out_path == official:
        print("refusing: --allow-missing may not write the official SCP-096.mcaddon (choose another --output)", file=sys.stderr)
        return 2

    report = Report(allow_missing=args.allow_missing)
    for p in problems:
        report.error(p)
    print(f"Packing from {ROOT}")
    print(f"  {len(included)} files selected, {len(skipped)} excluded")
    for rel, reason in skipped:
        print(f"  excluded: {rel}  ({reason})")

    contents, parsed = read_contents(included, report)
    uuids = load_uuids()
    if uuids is None:
        report.warn("tools/uuids.json missing or unreadable; skipping the UUID-vs-design comparison")
    run_checks(contents, parsed, uuids, report)

    if args.verify_only:
        if not out_path.is_file():
            print(f"ERROR: {out_path} does not exist", file=sys.stderr)
            return 1
        rep2, infos = verify_archive(out_path, contents, uuids, args.allow_missing)
        report.merge(rep2)
        err = unzip_test(out_path)
        if err:
            report.error(err)
        print_findings(report)
        if report.errors:
            print("\nVERIFY FAILED")
            return 1
        print(f"\nVERIFY OK: {out_path} matches the current sources")
        print(f"sha256 {sha256_hex(out_path.read_bytes())}")
        return 0

    print_findings(report)
    if report.errors:
        print(f"\nBUILD ABORTED: {len(report.errors)} error(s). No archive was written"
              + (f"; an older {out_path.name} (if any) was left untouched and may be STALE." if out_path.exists() else "."))
        if report.missing and not args.allow_missing:
            print("(To test the packer while teammates are still writing files, use --allow-missing; it never writes SCP-096.mcaddon.)")
        return 1

    # Build twice in memory: must be byte-identical.
    first = build_zip_bytes(contents)
    second = build_zip_bytes(contents)
    if first != second:
        print("ERROR: two consecutive builds differ, archive is not deterministic", file=sys.stderr)
        return 1
    rep_mem, _ = verify_archive(first, contents, uuids, args.allow_missing)
    if rep_mem.errors:
        print_findings(rep_mem)
        print("\nBUILD ABORTED: the freshly built archive failed verification. Nothing was written.")
        return 1

    # Atomic write, then verify the file on disk.
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_name(out_path.name + f".tmp{os.getpid()}")
    try:
        with open(tmp, "wb") as fh:
            fh.write(first)
            fh.flush()
            os.fsync(fh.fileno())
        rep_disk, infos = verify_archive(tmp, contents, uuids, args.allow_missing)
        err = unzip_test(tmp)
        if err:
            rep_disk.error(err)
        if rep_disk.errors or tmp.read_bytes() != first:
            print_findings(rep_disk)
            print("\nBUILD ABORTED: the archive on disk failed verification. Nothing was kept.")
            return 1
        os.replace(tmp, out_path)
    finally:
        if tmp.exists():
            tmp.unlink()

    data = out_path.read_bytes()
    if report.missing:
        banner = "PARTIAL BUILD (--allow-missing): NOT FOR RELEASE"
    elif args.allow_missing:
        banner = "TEST BUILD OK (--allow-missing, nothing was missing; run without the flag for the official file)"
    else:
        banner = "BUILD OK"
    print(f"\n{banner}")
    print(f"archive : {out_path}")
    print(f"files   : {len(infos)}   size: {human(len(data))}   unpacked: {human(sum(i.file_size for i in infos))}")
    print(f"sha256  : {sha256_hex(data)}")
    print(f"checks  : built twice (identical), testzip() clean, listing == expected, bytes == sources, "
          f"manifests re-verified inside the archive" + (", unzip -t clean" if shutil.which("unzip") else ""))
    print("contents:")
    print_tree(infos)
    if report.missing:
        print(f"\nStill missing ({len(report.missing)}): " + ", ".join(report.missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
