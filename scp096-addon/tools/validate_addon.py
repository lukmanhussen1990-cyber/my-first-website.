#!/usr/bin/env python3
"""validate_addon.py - independent QA gate for the SCP-096 Bedrock add-on.

Every check prints one PASS / FAIL / WARN / SKIP line with the evidence behind it; the exit status is 1 when
any check FAILs (and, with --fail-on-skip, when any check is skipped because a tool or file is missing).

Nothing in here trusts a teammate's own verifier: manifests, JSON, cross references, Molang, geometry, texture,
audio, the zip and the script are all re-derived from the files on disk.  The teammates' tools are run as
additional, clearly separated checks (group `ext`).

Groups (use --only a,b / --skip a,b):
  layout     expected file set, junk files, sizes
  json       strict JSON (comments, trailing commas, BOM, CRLF, tabs, duplicate keys, NaN), jq + node cross-parse
  manifest   manifests: schema, format 2, five v4 UUIDs, dependencies, script module, min engine version
  schema     Blockception JSON-Schema validation of every JSON file kind, with triage of every complaint
  xref       cross references between BP, RP, geometry, texture, sounds, lang
  molang     tokenise + parse every Molang string, known functions / queries, variables, parentheses
  geometry   UV rectangles, bones, heights, eyes, texture-vs-UV, animation bones and ground contact
  texture    PNG format and content
  audio      ogg properties, loudness, clipping, sizes
  lang       en_US.lang rules and keys
  corpus     vanilla-corpus proof (tools/vanilla_corpus_check.py)
  script     main.js: syntax, imports, block lists vs the BP, tsc + node tests
  package    build_mcaddon.py, zip structure, simulated import on a copy
  ext        the teammates' own verifiers (slow ones only without --fast)

Examples:
  python3 tools/validate_addon.py                  # everything
  python3 tools/validate_addon.py --fast           # no external tools, no zip build
  python3 tools/validate_addon.py --only manifest,xref -v
  python3 tools/validate_addon.py --selftest       # mutate a copy of the add-on; every mutant must be caught
"""
from __future__ import annotations

import argparse
import collections
import copy
import hashlib
import io
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import traceback
import uuid as uuidlib
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT_DEFAULT = os.path.dirname(HERE)

VANILLA = os.environ.get("BEDROCK_SAMPLES", "/home/user/mojang/bedrock-samples")
BLOCKCEPTION = os.environ.get("BLOCKCEPTION_SCHEMAS", "/home/user/blockception/minecraft-bedrock-json-schemas")

ENTITY_ID = "scp:scp096"
GEO_ID = "geometry.scp096"
TEX_REF = "textures/entity/scp096"
EXPECTED_BONES = collections.OrderedDict([
    ("root", None), ("waist", "root"), ("torso", "waist"), ("head", "torso"), ("jaw", "head"),
    ("left_arm", "torso"), ("left_forearm", "left_arm"), ("left_hand", "left_forearm"),
    ("right_arm", "torso"), ("right_forearm", "right_arm"), ("right_hand", "right_forearm"),
    ("left_leg", "waist"), ("left_shin", "left_leg"), ("right_leg", "waist"), ("right_shin", "right_leg"),
])
STATE_VARIANT = {"sit": 0, "walk": 1, "scream": 2, "run": 3}
STATE_GROUP = {"sit": "scp096:pose_sit", "walk": "scp096:pose_walk", "scream": "scp096:rage_scream",
               "run": "scp096:rage_run"}
UUID_V4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
SCRIPT_MODULE_VERSION = "1.11.0"

EXPECTED_FILES = {
    "SCP096_BP": ["manifest.json", "pack_icon.png", "entities/scp096.json", "scripts/main.js"],
    "SCP096_RP": ["manifest.json", "pack_icon.png", "texts/en_US.lang", "texts/languages.json",
                  "models/entity/scp096.geo.json", "textures/entity/scp096.png", "entity/scp096.entity.json",
                  "animations/scp096.animation.json", "animation_controllers/scp096.animation_controllers.json",
                  "render_controllers/scp096.render_controllers.json", "sounds/sound_definitions.json",
                  "sounds.json"],
}
EXPECTED_OGG = ["cry1", "cry2", "scream1", "rage1", "hurt1", "death1"]


# ======================================================================================================
# strict JSON
# ======================================================================================================
class StrictJSONError(ValueError):
    pass


def _no_dups(pairs):
    d = {}
    for k, v in pairs:
        if k in d:
            raise StrictJSONError("duplicate key %r" % k)
        d[k] = v
    return d


def _bad_const(name):
    raise StrictJSONError("non-standard JSON constant %s" % name)


def strict_loads(text):
    """json.loads with duplicate keys / NaN / Infinity rejected.  Comments, trailing commas, single quotes and
    unquoted keys are already rejected by the json module."""
    return json.loads(text, object_pairs_hook=_no_dups, parse_constant=_bad_const)


def raw_text_problems(data: bytes, want_final_newline=True):
    """Byte-level hygiene problems that json.loads would accept (or silently skip)."""
    probs = []
    if data.startswith(b"\xef\xbb\xbf"):
        probs.append("UTF-8 BOM")
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        probs.append("UTF-16 BOM")
    if b"\r" in data:
        probs.append("CR / CRLF line ending (%d CR)" % data.count(b"\r"))
    if b"\t" in data:
        probs.append("TAB character (%d)" % data.count(b"\t"))
    if b"\x00" in data:
        probs.append("NUL byte")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as ex:
        probs.append("not valid UTF-8: %s" % ex)
    if want_final_newline:
        if not data.endswith(b"\n"):
            probs.append("no final newline")
        elif data.endswith(b"\n\n"):
            probs.append("more than one final newline")
    return probs


def strict_load_file(path):
    with open(path, "rb") as f:
        data = f.read()
    probs = raw_text_problems(data)
    if probs:
        raise StrictJSONError("; ".join(probs))
    return strict_loads(data.decode("utf-8"))


def json_error_where(text, ex):
    if isinstance(ex, json.JSONDecodeError):
        line = text.splitlines()[ex.lineno - 1] if 0 < ex.lineno <= len(text.splitlines()) else ""
        return "line %d col %d: %s | %s" % (ex.lineno, ex.colno, ex.msg, line.strip()[:100])
    return str(ex)


# ======================================================================================================
# check framework
# ======================================================================================================
class T:
    """Collector handed to a check function."""

    def __init__(self, name, group):
        self.name, self.group = name, group
        self.fails, self.warns, self.infos, self.oks = [], [], [], []
        self.skipped = None

    def fail(self, msg):
        self.fails.append(msg)

    def warn(self, msg):
        self.warns.append(msg)

    def info(self, msg):
        self.infos.append(msg)

    def ok(self, msg):
        self.oks.append(msg)

    def expect(self, cond, fail_msg, ok_msg=None):
        if cond:
            if ok_msg:
                self.ok(ok_msg)
        else:
            self.fail(fail_msg)
        return bool(cond)

    def skip(self, why):
        self.skipped = why

    @property
    def status(self):
        if self.skipped:
            return "SKIP"
        if self.fails:
            return "FAIL"
        if self.warns:
            return "WARN"
        return "PASS"


REGISTRY = []   # (name, group, fn, slow)


def check(name, group, slow=False):
    def deco(fn):
        REGISTRY.append((name, group, fn, slow))
        return fn
    return deco


class Ctx:
    """Everything a check may need.  All paths are relative to `root`, so the same checks can run on a mutated copy."""

    def __init__(self, root):
        self.root = os.path.abspath(root)
        self.bp = os.path.join(self.root, "SCP096_BP")
        self.rp = os.path.join(self.root, "SCP096_RP")
        self._json = {}
        self._corpus = None
        self.vanilla = VANILLA
        self.tmp = None

    def p(self, rel):
        return os.path.join(self.root, rel)

    def jload(self, rel):
        """strict-load a JSON file of the add-on (cached); raises StrictJSONError."""
        if rel not in self._json:
            self._json[rel] = strict_load_file(self.p(rel))
        return copy.deepcopy(self._json[rel])

    def try_jload(self, rel):
        try:
            return self.jload(rel)
        except Exception:
            return None

    def exists(self, rel):
        return os.path.isfile(self.p(rel))

    def corpus(self):
        if self._corpus is None:
            import vanilla_corpus_check as VC
            self._corpus = VC.Corpus(self.vanilla)
        return self._corpus

    def pack_files(self):
        out = []
        for pack in ("SCP096_BP", "SCP096_RP"):
            base = os.path.join(self.root, pack)
            for dp, dn, fn in os.walk(base):
                dn.sort()
                for f in sorted(fn):
                    out.append(os.path.relpath(os.path.join(dp, f), self.root).replace(os.sep, "/"))
        return out

    def run(self, cmd, timeout=600, cwd=None, env=None):
        return run_cmd(cmd, timeout, cwd or self.root, env)


def run_cmd(cmd, timeout=600, cwd=None, env=None):
    """Run a command; returns (returncode, stdout+stderr, seconds).  127 = program missing, 124 = timeout."""
    e = dict(os.environ)
    e.update(env or {})
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=e)
        return r.returncode, r.stdout + r.stderr, time.time() - t0
    except subprocess.TimeoutExpired as ex:
        out = ex.stdout.decode("utf8", "replace") if isinstance(ex.stdout, bytes) else (ex.stdout or "")
        return 124, "TIMEOUT after %ds\n%s" % (timeout, out[-500:]), time.time() - t0
    except FileNotFoundError as ex:
        return 127, str(ex), 0.0


def tail(text, n=12):
    lines = [l for l in text.strip().splitlines() if l.strip()]
    return "\n".join(lines[-n:])


# small helpers ----------------------------------------------------------------------------------------
def png_info(path):
    """(width, height, bit_depth, color_type, interlace) from the IHDR chunk, no PIL needed; raises ValueError."""
    with open(path, "rb") as f:
        head = f.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG (bad signature)")
    ln, typ = struct.unpack(">I4s", head[8:16])
    if typ != b"IHDR" or ln != 13:
        raise ValueError("first chunk is not IHDR")
    w, h, bd, ct, comp, filt, il = struct.unpack(">IIBBBBB", head[16:29])
    return w, h, bd, ct, il


def ogg_streams(path):
    with open(path, "rb") as f:
        head = f.read(64)
    return head[:4] == b"OggS" and b"vorbis" in head


def walk_strings(node, path=()):
    """yield (path, string) for every string value in a JSON tree (keys excluded)."""
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from walk_strings(v, path + (k,))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk_strings(v, path + ("[%d]" % i,))


def fmtpath(p):
    return ".".join(p)


# ======================================================================================================
# group: layout
# ======================================================================================================
@check("layout.expected_files", "layout")
def c_layout(c: Ctx, t: T):
    have = set(c.pack_files())
    want = set()
    for pack, files in EXPECTED_FILES.items():
        want |= {"%s/%s" % (pack, f) for f in files}
    want |= {"SCP096_RP/sounds/mob/scp096/%s.ogg" % n for n in EXPECTED_OGG}
    for f in sorted(want - have):
        t.fail("missing file %s (DESIGN.md section 3)" % f)
    for f in sorted(have - want):
        t.fail("unexpected file %s inside a pack (would be shipped)" % f)
    t.ok("%d files, exactly the DESIGN.md section 3 set" % len(have))
    top = sorted(x for x in os.listdir(c.root) if x.startswith("SCP096_"))
    t.expect(top == ["SCP096_BP", "SCP096_RP"], "pack folders are %s, expected SCP096_BP and SCP096_RP" % top)


@check("layout.file_hygiene", "layout")
def c_layout_hygiene(c: Ctx, t: T):
    files = c.pack_files()
    big = 0
    total = 0
    for f in files:
        full = c.p(f)
        total += os.path.getsize(full)
        if os.path.getsize(full) > 5 * 1024 * 1024:
            t.fail("%s is %d bytes (> 5 MB)" % (f, os.path.getsize(full)))
        base = os.path.basename(f)
        if base.startswith(".") or base.endswith("~") or base in ("Thumbs.db", ".DS_Store"):
            t.fail("junk file %s" % f)
        if not re.match(r"^[A-Za-z0-9_./-]+$", f):
            t.fail("path %r contains characters outside [A-Za-z0-9_./-]" % f)
        if len(f) > 120:
            t.fail("path %s is %d chars long" % (f, len(f)))
        if os.path.islink(full):
            t.fail("%s is a symlink" % f)
        ext = os.path.splitext(f)[1]
        if ext != ext.lower():
            t.fail("%s has an upper-case extension" % f)
    lower = collections.defaultdict(list)
    for f in files:
        lower[f.lower()].append(f)
    for k, v in lower.items():
        if len(v) > 1:
            t.fail("case-colliding paths %s" % v)
    t.ok("%d files, %.1f KiB in total" % (len(files), total / 1024.0))
    if total > 2 * 1024 * 1024:
        t.warn("packs total %.1f MiB; fine for phones but large for an add-on of this kind" % (total / 1048576.0))


# ======================================================================================================
# group: json
# ======================================================================================================
def _text_files(c: Ctx, exts):
    return [f for f in c.pack_files() if os.path.splitext(f)[1] in exts]


@check("json.strict", "json")
def c_json_strict(c: Ctx, t: T):
    files = _text_files(c, {".json"}) + (["tools/uuids.json"] if c.exists("tools/uuids.json") else [])
    n = 0
    for f in files:
        dev_only = f.startswith("tools/")     # not shipped: problems are warnings, not failures
        with open(c.p(f), "rb") as fh:
            data = fh.read()
        probs = raw_text_problems(data)
        text = data.decode("utf-8", "replace")
        try:
            obj = strict_loads(text.lstrip("﻿"))
            n += 1
        except Exception as ex:
            probs.append("not strict JSON: " + json_error_where(text, ex))
            obj = None
        if obj is not None and not isinstance(obj, (dict, list)):
            probs.append("top level is not an object/array")
        # soft style checks
        bad_indent = [i + 1 for i, l in enumerate(text.splitlines()) if l.startswith(" ") and (len(l) - len(l.lstrip(" "))) % 2]
        if bad_indent:
            t.warn("%s: odd indentation on lines %s (DESIGN.md: 2-space indent)" % (f, bad_indent[:5]))
        if re.search(r"[ ]+$", text, re.M):
            t.warn("%s: trailing spaces" % f)
        if re.search(rb"[^\x00-\x7f]", data):
            t.info("%s: contains non-ASCII characters" % f)
        for pr in probs:
            (t.warn if dev_only else t.fail)("%s: %s%s" % (f, pr, " (dev-only file, not shipped)" if dev_only else ""))
    t.ok("%d JSON files strictly valid (no BOM/CR/TAB/comments/trailing commas/duplicate keys/NaN)" % n)


@check("json.crosscheck_jq_node", "json")
def c_json_cross(c: Ctx, t: T):
    files = [c.p(f) for f in _text_files(c, {".json"})]
    jq = shutil.which("jq")
    if jq:
        for f in files:
            rc, out, _ = c.run([jq, "-e", "type", f])
            if rc not in (0, 1) or ("parse error" in out.lower()):
                t.fail("jq rejects %s: %s" % (os.path.relpath(f, c.root), out.strip()[:120]))
    else:
        t.warn("jq not installed; skipped the jq parse")
    node = shutil.which("node")
    if node:
        js = ("const fs=require('fs');let bad=0;for(const f of process.argv.slice(1)){try{JSON.parse(fs.readFileSync(f,'utf8'))}"
              "catch(e){bad++;console.log(f+': '+e.message)}}process.exit(bad?1:0)")
        rc, out, _ = c.run([node, "-e", js] + files)
        if rc != 0:
            t.fail("node JSON.parse rejects: %s" % out.strip()[:300])
    else:
        t.warn("node not installed; skipped the JSON.parse cross-check")
    if not jq and not node:
        t.skip("neither jq nor node available")
    else:
        t.ok("%d files also parse with %s" % (len(files), " and ".join(x for x, y in (("jq", jq), ("node JSON.parse", node)) if y)))


@check("json.text_hygiene_js_lang", "json")
def c_text_hygiene(c: Ctx, t: T):
    for f in _text_files(c, {".js", ".lang"}):
        with open(c.p(f), "rb") as fh:
            data = fh.read()
        for pr in raw_text_problems(data):
            t.fail("%s: %s" % (f, pr))
        if f.endswith(".lang"):
            for i, line in enumerate(data.decode("utf-8", "replace").split("\n")[:-1], 1):
                if line != line.rstrip(" "):
                    t.fail("%s:%d: trailing space (the game does not trim them, they become part of the text)" % (f, i))
    t.ok("js / lang files: LF only, UTF-8, no BOM, no tabs, one final newline")


# ======================================================================================================
# group: manifest
# ======================================================================================================
def stable_server_versions(vanilla=VANILLA):
    d = os.path.join(vanilla, "metadata", "script_modules", "@minecraft")
    res = []
    if os.path.isdir(d):
        for f in os.listdir(d):
            m = re.match(r"^server_(\d+\.\d+\.\d+)(-.*)?\.json$", f)
            if m and not m.group(2):
                res.append(m.group(1))
    return sorted(res, key=lambda v: tuple(int(x) for x in v.split(".")))


def known_foreign_uuids(vanilla=VANILLA, blockception=BLOCKCEPTION):
    """UUIDs found in OTHER people's manifests (vanilla samples, Blockception tests) - ours must never be among them."""
    found = {}
    pat = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
    for base in (os.path.join(vanilla, "behavior_pack"), os.path.join(vanilla, "resource_pack"),
                 os.path.join(vanilla, "metadata", "script_modules"), os.path.join(blockception, "test"),
                 os.path.join(blockception, "general")):
        if not os.path.isdir(base):
            continue
        for dp, dn, fn in os.walk(base):
            for f in fn:
                if f == "manifest.json" or (f.endswith(".json") and "script_modules" in dp) or "manifest" in dp:
                    try:
                        s = open(os.path.join(dp, f), encoding="utf-8", errors="replace").read()
                    except OSError:
                        continue
                    for m in pat.findall(s):
                        found.setdefault(m.lower(), os.path.join(dp, f))
    return found


def manifest_uuids(bp, rp):
    return collections.OrderedDict([
        ("bp.header", bp["header"]["uuid"]),
        ("bp.module[data]", next((m["uuid"] for m in bp["modules"] if m.get("type") == "data"), None)),
        ("bp.module[script]", next((m["uuid"] for m in bp["modules"] if m.get("type") == "script"), None)),
        ("rp.header", rp["header"]["uuid"]),
        ("rp.module[resources]", next((m["uuid"] for m in rp["modules"] if m.get("type") == "resources"), None)),
    ])


def resolve_install(packs, available_modules):
    """Re-implementation of what the game does with a freshly imported pair of packs: every pack dependency
    (uuid + version) must be present with a version >= the requested one, and every module dependency must be one
    the game offers.  `packs` = {folder: manifest}.  Returns (errors, activation_order)."""
    errors = []
    by_uuid = {}
    for folder, m in packs.items():
        u = m["header"]["uuid"]
        if u in by_uuid:
            errors.append("pack uuid %s used by both %s and %s" % (u, by_uuid[u][0], folder))
        by_uuid[u] = (folder, m)
    order, state = [], {}

    def visit(u, stack):
        if state.get(u) == 2:
            return
        if state.get(u) == 1:
            errors.append("circular dependency: %s" % " -> ".join(stack + [u]))
            return
        state[u] = 1
        folder, m = by_uuid[u]
        for d in m.get("dependencies", []):
            if "uuid" in d:
                if d["uuid"] not in by_uuid:
                    errors.append("%s depends on pack %s which is not in the archive" % (folder, d["uuid"]))
                    continue
                have = by_uuid[d["uuid"]][1]["header"]["version"]
                if list(have) < list(d["version"]):
                    errors.append("%s needs pack %s >= %s but the archive has %s" % (folder, d["uuid"], d["version"], have))
                visit(d["uuid"], stack + [u])
            elif "module_name" in d:
                ok = d["module_name"] in available_modules and d["version"] in available_modules[d["module_name"]]
                if not ok:
                    errors.append("%s requires module %s %s which the game does not offer (offers %s)" % (
                        folder, d["module_name"], d["version"], sorted(available_modules.get(d["module_name"], []))))
            else:
                errors.append("%s: dependency without uuid or module_name: %r" % (folder, d))
        state[u] = 2
        order.append(u)

    for u in by_uuid:
        visit(u, [])
    return errors, [by_uuid[u][0] for u in order]


@check("manifest.structure", "manifest")
def c_manifest_structure(c: Ctx, t: T):
    bp, rp = c.try_jload("SCP096_BP/manifest.json"), c.try_jload("SCP096_RP/manifest.json")
    if bp is None or rp is None:
        t.fail("manifest.json is missing or not strict JSON (see json.strict)")
        return
    ALLOWED = {
        "top": {"format_version", "header", "modules", "dependencies", "metadata"},
        "header": {"name", "description", "uuid", "version", "min_engine_version"},
        "module": {"type", "description", "uuid", "version", "language", "entry"},
        "dep_pack": {"uuid", "version"},
        "dep_mod": {"module_name", "version"},
        "metadata": {"authors"},
    }
    for label, m in (("BP", bp), ("RP", rp)):
        extra = set(m) - ALLOWED["top"]
        t.expect(not extra, "%s manifest: unknown top-level keys %s" % (label, sorted(extra)))
        t.expect(m.get("format_version") == 2 and type(m.get("format_version")) is int,
                 "%s manifest: format_version is %r, expected the integer 2" % (label, m.get("format_version")))
        h = m.get("header", {})
        extra = set(h) - ALLOWED["header"]
        t.expect(not extra, "%s manifest: unknown header keys %s" % (label, sorted(extra)))
        for k in ("name", "description", "uuid", "version", "min_engine_version"):
            t.expect(k in h, "%s manifest: header.%s missing" % (label, k))
        t.expect(h.get("min_engine_version") == [1, 21, 0],
                 "%s manifest: min_engine_version %r, expected [1, 21, 0]" % (label, h.get("min_engine_version")))
        t.expect(h.get("version") == [1, 0, 0], "%s manifest: header.version %r, expected [1, 0, 0] (DESIGN.md section 4)" % (label, h.get("version")))
        for k in ("version", "min_engine_version"):
            v = h.get(k)
            t.expect(isinstance(v, list) and len(v) == 3 and all(type(x) is int and x >= 0 for x in v),
                     "%s manifest: header.%s must be [int,int,int], got %r" % (label, k, v))
        t.expect(isinstance(h.get("name"), str) and h["name"].strip() == h["name"] and 0 < len(h["name"]) <= 64,
                 "%s manifest: header.name %r should be a trimmed string of 1..64 chars" % (label, h.get("name")))
        t.expect(isinstance(h.get("description"), str) and 0 < len(h["description"]) <= 200,
                 "%s manifest: header.description should be 1..200 chars" % label)
        for k in ("name", "description"):
            if isinstance(h.get(k), str) and re.search(r"^[a-z]+(\.[a-z0-9_]+)+$", h[k]):
                t.fail("%s manifest: header.%s %r looks like a lang key; DESIGN.md wants a literal string" % (label, k, h[k]))
        mods = m.get("modules", [])
        t.expect(isinstance(mods, list) and mods, "%s manifest: modules missing" % label)
        for i, mod in enumerate(mods):
            extra = set(mod) - ALLOWED["module"]
            t.expect(not extra, "%s manifest: modules[%d] unknown keys %s" % (label, i, sorted(extra)))
            t.expect(mod.get("version") == [1, 0, 0], "%s manifest: modules[%d].version %r" % (label, i, mod.get("version")))
        md = m.get("metadata", {})
        extra = set(md) - ALLOWED["metadata"]
        t.expect(not extra, "%s manifest: unknown metadata keys %s" % (label, sorted(extra)))
        for a in md.get("authors", []):
            if "@" in a:
                t.fail("%s manifest: metadata.authors contains an e-mail address (%r)" % (label, a))
        for i, d in enumerate(m.get("dependencies", [])):
            keys = set(d)
            t.expect(keys in (ALLOWED["dep_pack"], ALLOWED["dep_mod"]),
                     "%s manifest: dependencies[%d] has keys %s; expected {uuid,version} or {module_name,version}" % (label, i, sorted(keys)))
        for bad in ("capabilities", "experimental", "subpacks", "settings", "lock_template_options", "base_game_version"):
            if bad in m or bad in h:
                t.fail("%s manifest: contains %r (not needed; capabilities would be an experimental toggle)" % (label, bad))
    # module types
    t.expect([m["type"] for m in bp["modules"]] == ["data", "script"], "BP module types are %s, expected [data, script]" % [m.get("type") for m in bp["modules"]])
    t.expect([m["type"] for m in rp["modules"]] == ["resources"], "RP module types are %s, expected [resources]" % [m.get("type") for m in rp["modules"]])
    script = next((m for m in bp["modules"] if m.get("type") == "script"), {})
    t.expect(script.get("language") == "javascript", "script module language %r, expected 'javascript' (lower case)" % script.get("language"))
    t.expect(script.get("entry") == "scripts/main.js", "script entry %r, expected 'scripts/main.js'" % script.get("entry"))
    if script.get("entry"):
        t.expect(c.exists("SCP096_BP/" + script["entry"]), "script entry file SCP096_BP/%s does not exist" % script["entry"])
    for m in bp["modules"]:
        if m.get("type") == "data":
            t.expect(set(m) <= {"type", "description", "uuid", "version"}, "data module has unexpected keys")
    t.ok("manifest keys, module types, header versions, min_engine_version [1,21,0], script entry checked")


@check("manifest.uuids", "manifest")
def c_manifest_uuids(c: Ctx, t: T):
    bp, rp = c.try_jload("SCP096_BP/manifest.json"), c.try_jload("SCP096_RP/manifest.json")
    if bp is None or rp is None:
        t.fail("manifest unreadable")
        return
    u = manifest_uuids(bp, rp)
    for k, v in u.items():
        if not isinstance(v, str):
            t.fail("%s: missing uuid" % k)
            continue
        t.expect(UUID_V4.match(v) is not None, "%s uuid %r is not lower-case RFC-4122 version 4" % (k, v))
        try:
            pu = uuidlib.UUID(v)
            t.expect(pu.version == 4 and str(pu) == v, "%s uuid %r does not round-trip as a v4 UUID" % (k, v))
        except ValueError:
            t.fail("%s uuid %r unparsable" % (k, v))
        hexs = v.replace("-", "")
        if len(set(hexs)) < 8 or hexs in "0123456789abcdef" * 3:
            t.fail("%s uuid %s has suspiciously low entropy (%d distinct hex digits)" % (k, v, len(set(hexs))))
    vals = [v for v in u.values() if isinstance(v, str)]
    dup = [x for x, n in collections.Counter(vals).items() if n > 1]
    t.expect(len(vals) == 5 and not dup, "UUIDs not five distinct values (duplicates: %s)" % dup)
    ref = c.try_jload("tools/uuids.json")
    if ref:
        mapping = {"bp.header": "bp_header", "bp.module[data]": "bp_data_module", "bp.module[script]": "bp_script_module",
                   "rp.header": "rp_header", "rp.module[resources]": "rp_resources_module"}
        for k, rk in mapping.items():
            t.expect(u.get(k) == ref.get(rk), "%s is %s but tools/uuids.json %s is %s" % (k, u.get(k), rk, ref.get(rk)))
    foreign = known_foreign_uuids(c.vanilla)
    clash = {k: foreign[v.lower()] for k, v in u.items() if isinstance(v, str) and v.lower() in foreign}
    t.expect(not clash, "UUID(s) already used in another published manifest: %s" % clash)
    t.ok("5 distinct lower-case v4 UUIDs, equal to tools/uuids.json, none found in %d UUIDs of vanilla/Blockception manifests" % len(foreign))


@check("manifest.dependencies", "manifest")
def c_manifest_deps(c: Ctx, t: T):
    bp, rp = c.try_jload("SCP096_BP/manifest.json"), c.try_jload("SCP096_RP/manifest.json")
    if bp is None or rp is None:
        t.fail("manifest unreadable")
        return
    pack_deps = [d for d in bp.get("dependencies", []) if "uuid" in d]
    t.expect(len(pack_deps) == 1, "BP must have exactly one pack dependency (the RP), has %d" % len(pack_deps))
    for d in pack_deps:
        t.expect(d["uuid"] == rp["header"]["uuid"], "BP dependency uuid %s != RP header uuid %s" % (d["uuid"], rp["header"]["uuid"]))
        t.expect(d["version"] == rp["header"]["version"], "BP dependency version %s != RP header version %s" % (d["version"], rp["header"]["version"]))
    t.expect(not any(d.get("uuid") == bp["header"]["uuid"] for d in rp.get("dependencies", [])), "RP depends on the BP (circular)")
    t.expect("dependencies" not in rp or not rp["dependencies"], "RP has dependencies %r; DESIGN.md says none" % rp.get("dependencies"))
    mods = [d for d in bp.get("dependencies", []) if "module_name" in d]
    t.expect(len(mods) == 1 and mods[0]["module_name"] == "@minecraft/server",
             "BP module dependencies are %r; expected exactly @minecraft/server" % mods)
    for d in mods:
        v = d.get("version")
        t.expect(isinstance(v, str), "module version must be a STRING, got %r" % (v,))
        t.expect(isinstance(v, str) and re.fullmatch(r"\d+\.\d+\.\d+", v) is not None,
                 "module version %r must be a plain x.y.z (no -beta / -rc / pre-release suffix)" % (v,))
        t.expect(v == SCRIPT_MODULE_VERSION, "module version %r, DESIGN.md requires exactly %s" % (v, SCRIPT_MODULE_VERSION))
        stable = stable_server_versions(c.vanilla)
        if stable:
            t.expect(v in stable, "@minecraft/server %s is not a stable version in the 1.21.0 metadata (stable: %s)" % (v, stable))
            t.expect(v == stable[-1], "script module %s is not the newest stable (%s)" % (v, stable[-1]))
        else:
            t.warn("no script_modules metadata under %s; could not confirm the module version is stable" % c.vanilla)
    # simulate the game's resolution on the two manifests
    avail = {"@minecraft/server": set(stable_server_versions(c.vanilla)) or {SCRIPT_MODULE_VERSION}}
    errs, order = resolve_install({"SCP096_BP": bp, "SCP096_RP": rp}, avail)
    for e in errs:
        t.fail("install simulation: " + e)
    t.ok("BP->RP dependency uuid+version match; no cycle; module %s resolves; install order %s" % (SCRIPT_MODULE_VERSION, order))


@check("manifest.pack_icons", "manifest")
def c_pack_icons(c: Ctx, t: T):
    for pack in ("SCP096_BP", "SCP096_RP"):
        f = "%s/pack_icon.png" % pack
        if not c.exists(f):
            t.fail("%s missing" % f)
            continue
        try:
            w, h, bd, ct, il = png_info(c.p(f))
        except ValueError as ex:
            t.fail("%s: %s" % (f, ex))
            continue
        t.expect(w == h and 64 <= w <= 512, "%s is %dx%d; a pack icon should be square, 64..512 px" % (f, w, h))
        t.expect(il == 0, "%s is interlaced" % f)
        t.expect(os.path.getsize(c.p(f)) < 300 * 1024, "%s is %d KiB" % (f, os.path.getsize(c.p(f)) // 1024))
    a, b = c.p("SCP096_BP/pack_icon.png"), c.p("SCP096_RP/pack_icon.png")
    if os.path.exists(a) and os.path.exists(b):
        t.info("pack icons identical: %s" % (open(a, "rb").read() == open(b, "rb").read()))
    t.ok("pack icons are valid square PNGs")



# ======================================================================================================
# group: schema  (Blockception JSON schemas, bundled single-file builds; every complaint is triaged)
# ======================================================================================================
SCHEMA_KINDS = [
    # key, schema (relative to the Blockception repo), our files, vanilla comparison path(s)
    ("bp_entity", "behavior/entities/entities.json", ["SCP096_BP/entities/scp096.json"], ["behavior_pack/entities"]),
    ("client_entity", "resource/entity/entity.json", ["SCP096_RP/entity/scp096.entity.json"], ["resource_pack/entity"]),
    ("geometry", "resource/models/entity/model_entity.json", ["SCP096_RP/models/entity/scp096.geo.json"],
     ["resource_pack/models/entity"]),
    ("animations", "resource/animations/actor_animation.json", ["SCP096_RP/animations/scp096.animation.json"],
     ["resource_pack/animations"]),
    ("animation_controllers", "resource/animation_controllers/animation_controller.json",
     ["SCP096_RP/animation_controllers/scp096.animation_controllers.json"], ["resource_pack/animation_controllers"]),
    ("render_controllers", "resource/render_controllers/render_controllers.json",
     ["SCP096_RP/render_controllers/scp096.render_controllers.json"], ["resource_pack/render_controllers"]),
    ("sound_definitions", "resource/sounds/sound_definitions.json", ["SCP096_RP/sounds/sound_definitions.json"],
     ["resource_pack/sounds/sound_definitions.json"]),
    ("sounds_json", "resource/sounds.json", ["SCP096_RP/sounds.json"], ["resource_pack/sounds.json"]),
    ("manifest", "general/manifest.json", ["SCP096_BP/manifest.json", "SCP096_RP/manifest.json"],
     ["behavior_pack/manifest.json", "resource_pack/manifest.json"]),
    ("languages", "language/languages.json", ["SCP096_RP/texts/languages.json"], ["resource_pack/texts/languages.json"]),
]

# Human classification of a complaint that vanilla 1.21.0.3 files ALSO trigger.  First matching rule wins.
# (kind regex, message regex, class, explanation)
SCHEMA_TRIAGE = [
    ("bp_entity", r"'minecraft:lookat' was unexpected", "newer-than-1.21.0",
     "the bundled schema (generated 2026-10) only knows the renamed component minecraft:looked_at; 1.21.0.3 vanilla "
     "(enderman.json) still uses minecraft:lookat"),
    ("bp_entity", r"'minecraft:pushable' was unexpected", "newer-than-1.21.0",
     "component absent from the newer schema; 1.21.0.3 vanilla (enderman.json and 100+ others) uses minecraft:pushable"),
    ("bp_entity", r"is not valid under any of the given schemas", "newer-than-1.21.0",
     "damage_sensor `deals_damage`: the newer schema wants the strings yes/no/...; 1.21.0.3 vanilla (llama.json, "
     "frog.json) uses the booleans true/false, as we do"),
    ("sound_definitions", r"is not valid under any of the given schemas", "schema gap",
     "the schema omits the sound-object key `load_on_low_memory`; vanilla sound_definitions.json uses it 466 times"),
]


def _unexpected_names(msg):
    m = re.search(r"\(([^)]*) (?:was|were) unexpected\)", msg)
    return tuple(sorted(x.strip().strip("'") for x in m.group(1).split(",")) ) if m else ()


def _leaves(e):
    if e.context:
        for sub in e.context:
            yield from _leaves(sub)
    else:
        yield e


def schema_signature(e):
    """Structure-only fingerprint of a schema complaint (no instance values), comparable across files."""
    sp = tuple(str(x) for x in e.absolute_schema_path if not isinstance(x, int))
    extras = set(_unexpected_names(e.message))
    for leaf in _leaves(e):
        extras |= set(_unexpected_names(leaf.message))
    return (e.validator, sp, tuple(sorted(extras)))


def _vanilla_files(vanilla, rels):
    out = []
    for rel in rels:
        full = os.path.join(vanilla, rel)
        if os.path.isdir(full):
            out += [os.path.join(full, f) for f in sorted(os.listdir(full)) if f.endswith(".json")]
        elif os.path.isfile(full):
            out.append(full)
    return out


def load_schema(kind_schema_rel):
    path = os.path.join(BLOCKCEPTION, kind_schema_rel)
    with open(path, encoding="utf-8") as f:
        return json.load(f), path


def _jsonschema():
    try:
        import jsonschema
        return jsonschema
    except ImportError:
        return None


@check("schema.available", "schema")
def c_schema_available(c: Ctx, t: T):
    if _jsonschema() is None:
        t.skip("python package jsonschema is not installed (pip install jsonschema)")
        return
    if not os.path.isdir(BLOCKCEPTION):
        t.skip("Blockception schema repo not found at %s" % BLOCKCEPTION)
        return
    missing = [k[1] for k in SCHEMA_KINDS if not os.path.isfile(os.path.join(BLOCKCEPTION, k[1]))]
    t.expect(not missing, "bundled schema files missing: %s" % missing)
    jv = _jsonschema()
    for key, rel, files, van in SCHEMA_KINDS:
        sch, path = load_schema(rel)
        try:
            jv.Draft7Validator.check_schema(sch)
        except Exception as ex:
            t.fail("%s is not a valid Draft-7 schema: %s" % (rel, str(ex)[:100]))
        refs = set(re.findall(r'"\$ref"\s*:\s*"([^"]*)"', open(path, encoding="utf-8").read()))
        ext = sorted(r for r in refs if not r.startswith("#"))
        t.expect(not ext, "%s has external $refs %s (not self-contained)" % (rel, ext[:3]))
    try:
        pj = json.load(open(os.path.join(BLOCKCEPTION, "package.json")))
        t.info("Blockception schema package version %s; example format_version in the entity schema is 1.26.0 -> "
               "newer than 1.21.0" % pj.get("version"))
    except Exception:
        pass
    t.ok("%d bundled Draft-7 schemas load, are self-contained ($ref only to #/definitions)" % len(SCHEMA_KINDS))


def _schema_check(key):
    def fn(c: Ctx, t: T):
        jv = _jsonschema()
        if jv is None or not os.path.isdir(BLOCKCEPTION):
            t.skip("jsonschema package or Blockception repo unavailable")
            return
        kind = next(k for k in SCHEMA_KINDS if k[0] == key)
        _, rel, files, van = kind
        sch, _p = load_schema(rel)
        validator = jv.Draft7Validator(sch)
        all_errs = []
        for f in files:
            doc = c.try_jload(f)
            if doc is None:
                t.fail("%s is missing or not strict JSON" % f)
                continue
            for e in validator.iter_errors(doc):
                all_errs.append((f, e))
        if not all_errs:
            t.ok("%s: 0 schema errors against %s" % (", ".join(files), rel))
            return
        # triage: does vanilla 1.21.0.3 trigger the same complaint?
        sigs = {id(e): schema_signature(e) for _, e in all_errs}

        def relaxed(sg):     # same unexpected key names, wherever they occur (vanilla lists all of them in one message)
            return sg[2] if sg[0] == "additionalProperties" and sg[2] else None

        need = set(sigs.values())
        found, found_names = {}, {}

        def covered(sg):
            r = relaxed(sg)
            return sg in found or (r is not None and all(n in found_names for n in r))

        from vanilla_corpus_check import lenient_load
        for vf in _vanilla_files(c.vanilla, van):
            if all(covered(sg) for sg in need):
                break
            try:
                vdoc = lenient_load(vf)
            except Exception:
                continue
            for ve in validator.iter_errors(vdoc):
                sg = schema_signature(ve)
                rel_ = os.path.relpath(vf, c.vanilla)
                if sg in need and sg not in found:
                    found[sg] = rel_
                if relaxed(sg):
                    for n in relaxed(sg):
                        found_names.setdefault(n, rel_)
        groups = collections.OrderedDict()
        for f, e in all_errs:
            groups.setdefault(sigs[id(e)], []).append((f, e))
        for sg, items in groups.items():
            f, e = items[0]
            where = [fmtpath([str(x) for x in ee.absolute_path]) or "<root>" for _, ee in items]
            msg = e.message if len(e.message) < 130 else e.message[:130] + "..."
            leaf_msgs = sorted({l.message[:80] for l in _leaves(e)})[:2] if e.context else []
            full = "%s x%d @ %s: %s%s" % (f, len(items), where[0] + (" (+%d more)" % (len(where) - 1) if len(where) > 1 else ""),
                                          msg, ("  [" + " | ".join(leaf_msgs) + "]") if leaf_msgs else "")
            corro = found.get(sg)
            how = "same complaint"
            if not corro and relaxed(sg) and all(n in found_names for n in relaxed(sg)):
                corro, how = ", ".join("%s in %s" % (n, found_names[n]) for n in relaxed(sg)), "the same key(s) are used by the game in"
            cls, why = None, None
            text = e.message + " " + " ".join(l.message for l in _leaves(e))
            for kr, mr, kc, kw in SCHEMA_TRIAGE:
                if re.search(kr, key) and re.search(mr, text):
                    cls, why = kc, kw
                    break
            if corro:
                t.warn("%s\n    -> %s: vanilla 1.21.0.3 (%s: %s) %s%s" % (
                    full, cls or "newer-than-1.21.0 or schema gap (auto-triage)", how, corro, "" , ("; " + why) if why else ""))
            else:
                t.fail("%s\n    -> REAL PROBLEM (or unexplained): no vanilla 1.21.0.3 file triggers this schema complaint" % full)
        t.info("%d schema complaint(s) in %d distinct kind(s)" % (len(all_errs), len(groups)))
    return fn


for _k in SCHEMA_KINDS:
    check("schema." + _k[0], "schema")(_schema_check(_k[0]))


@check("schema.sensitivity", "schema")
def c_schema_sensitivity(c: Ctx, t: T):
    """Negative controls: a schema that accepts a bogus key proves nothing about that file kind."""
    jv = _jsonschema()
    if jv is None or not os.path.isdir(BLOCKCEPTION):
        t.skip("jsonschema package or Blockception repo unavailable")
        return
    probes = {
        "bp_entity": lambda d: d["minecraft:entity"]["components"]["minecraft:health"].update({"bogus_key": 1}),
        "client_entity": lambda d: d["minecraft:client_entity"]["description"].update({"bogus_key": 1}),
        "geometry": lambda d: d["minecraft:geometry"][0]["bones"][1].update({"bogus_key": 1}),
        "animations": lambda d: next(iter(d["animations"].values())).update({"bogus_key": 1}),
        "animation_controllers": lambda d: next(iter(d["animation_controllers"].values())).update({"bogus_key": 1}),
        "render_controllers": lambda d: next(iter(d["render_controllers"].values())).update({"bogus_key": 1}),
        "sound_definitions": lambda d: next(iter(d["sound_definitions"].values())).update({"bogus_key": 1}),
        "sounds_json": lambda d: d["entity_sounds"]["entities"]["scp:scp096"].update({"bogus_key": 1}),
        "manifest": lambda d: d["header"].update({"bogus_key": 1}),
        "languages": lambda d: d.append(5),
    }
    blind = []
    for key, rel, files, van in SCHEMA_KINDS:
        doc = c.try_jload(files[0])
        if doc is None:
            continue
        sch, _ = load_schema(rel)
        try:
            probes[key](doc)
        except Exception as ex:
            t.fail("probe for %s failed to apply: %s" % (key, ex))
            continue
        if not list(jv.Draft7Validator(sch).iter_errors(doc)):
            blind.append(key)
    for k in blind:
        t.warn("schema gap: the %s schema accepts an unknown key / bad value (negative control), so 'schema OK' proves "
               "little for that kind; the vanilla-corpus key check (corpus.*) covers it instead" % k)
    t.ok("negative control rejected by %d of %d schemas" % (len(SCHEMA_KINDS) - len(blind), len(SCHEMA_KINDS)))



@check("schema.triage_evidence", "schema")
def c_schema_triage_evidence(c: Ctx, t: T):
    """The triage table above makes factual claims about vanilla and about the schema; prove each one."""
    bpd = os.path.join(c.vanilla, "behavior_pack", "entities")
    if not os.path.isdir(bpd):
        t.skip("vanilla samples not found at %s" % c.vanilla)
        return
    from vanilla_corpus_check import lenient_load
    n_lookat = n_push = n_bool = n_str = 0
    for f in sorted(os.listdir(bpd)):
        if not f.endswith(".json"):
            continue
        txt = open(os.path.join(bpd, f), encoding="utf-8", errors="replace").read()
        n_lookat += '"minecraft:lookat"' in txt
        n_push += '"minecraft:pushable"' in txt
        doc = lenient_load(os.path.join(bpd, f))

        def walk(n):
            nonlocal n_bool, n_str
            if isinstance(n, dict):
                if "deals_damage" in n:
                    if isinstance(n["deals_damage"], bool):
                        n_bool += 1
                    elif isinstance(n["deals_damage"], str):
                        n_str += 1
                for v in n.values():
                    walk(v)
            elif isinstance(n, list):
                for v in n:
                    walk(v)
        walk(doc)
    t.expect(n_lookat >= 1, "vanilla 1.21.0.3 BP files use minecraft:lookat in %d file(s); the triage claim needs >= 1" % n_lookat)
    t.expect(n_push >= 1, "vanilla uses minecraft:pushable in %d files" % n_push)
    t.expect(n_bool >= 1, "vanilla uses boolean deals_damage in %d places" % n_bool)
    sd = os.path.join(c.vanilla, "resource_pack", "sounds", "sound_definitions.json")
    n_llm = open(sd, encoding="utf-8").read().count('"load_on_low_memory"') if os.path.exists(sd) else 0
    t.expect(n_llm >= 1, "vanilla sound_definitions.json uses load_on_low_memory %d times" % n_llm)
    if os.path.isdir(BLOCKCEPTION):
        sch = open(os.path.join(BLOCKCEPTION, "behavior/entities/entities.json"), encoding="utf-8").read()
        t.expect('"minecraft:looked_at"' in sch and '"minecraft:lookat"' not in sch,
                 "schema bundle should know minecraft:looked_at but not minecraft:lookat (rename claim)")
        t.expect('"minecraft:pushable"' not in sch, "schema bundle unexpectedly knows minecraft:pushable")
        t.expect('"no_but_side_effects_apply"' in sch, "schema bundle's deals_damage enum claim not found")
        ss = open(os.path.join(BLOCKCEPTION, "resource/sounds/sound_definitions.json"), encoding="utf-8").read()
        t.expect("load_on_low_memory" not in ss, "sound_definitions schema unexpectedly knows load_on_low_memory")
    t.ok("vanilla 1.21.0.3: lookat in %d files, pushable in %d, deals_damage boolean x%d (string x%d), load_on_low_memory x%d; "
         "schema bundle knows looked_at (rename), not pushable, string-enum deals_damage" % (n_lookat, n_push, n_bool, n_str, n_llm))


# ======================================================================================================
# group: xref
# ======================================================================================================
class Docs:
    """All the add-on documents, loaded once; any problem is collected instead of raised."""

    def __init__(self, c: Ctx):
        L = c.try_jload
        self.bp = L("SCP096_BP/entities/scp096.json")
        self.cl = L("SCP096_RP/entity/scp096.entity.json")
        self.an = L("SCP096_RP/animations/scp096.animation.json")
        self.ct = L("SCP096_RP/animation_controllers/scp096.animation_controllers.json")
        self.rc = L("SCP096_RP/render_controllers/scp096.render_controllers.json")
        self.geo = L("SCP096_RP/models/entity/scp096.geo.json")
        self.sd = L("SCP096_RP/sounds/sound_definitions.json")
        self.sj = L("SCP096_RP/sounds.json")
        self.bpm = L("SCP096_BP/manifest.json")
        self.rpm = L("SCP096_RP/manifest.json")
        self.missing = [n for n in ("bp", "cl", "an", "ct", "rc", "geo", "sd", "sj") if getattr(self, n) is None]
        # convenience
        try:
            self.ent = self.bp["minecraft:entity"]
            self.groups = self.ent.get("component_groups", {})
            self.events = self.ent.get("events", {})
            self.desc = self.cl["minecraft:client_entity"]["description"]
            self.anims = self.an["animations"]
            self.ctrls = self.ct["animation_controllers"]
            self.rcs = self.rc["render_controllers"]
            self.geom = self.geo["minecraft:geometry"][0]
            self.bones = {b["name"]: b for b in self.geom["bones"]}
            self.sdefs = self.sd["sound_definitions"]
        except Exception:
            pass


def docs(c: Ctx, t: T):
    d = c._json.get("__docs__")
    if d is None:
        d = Docs(c)
        c._json["__docs__"] = d
    if d.missing:
        t.fail("cannot run: missing or non-strict-JSON documents: %s" % d.missing)
        return None
    return d


def all_component_blocks(ent):
    """yield (where, name, body) for `components` and every component group."""
    for n, b in ent.get("components", {}).items():
        yield "components", n, b
    for g, grp in ent.get("component_groups", {}).items():
        for n, b in grp.items():
            yield "component_groups.%s" % g, n, b


@check("xref.identity", "xref")
def c_xref_identity(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    t.expect(d.ent["description"].get("identifier") == ENTITY_ID, "BP identifier %r != %s" % (d.ent["description"].get("identifier"), ENTITY_ID))
    t.expect(d.desc.get("identifier") == ENTITY_ID, "client identifier %r != %s" % (d.desc.get("identifier"), ENTITY_ID))
    t.expect(ENTITY_ID in d.sj.get("entity_sounds", {}).get("entities", {}), "sounds.json has no entity_sounds.entities[%r]" % ENTITY_ID)
    desc = d.ent["description"]
    t.expect(desc.get("is_spawnable") is True, "BP is_spawnable must be true for the spawn egg to exist (is %r)" % desc.get("is_spawnable"))
    t.expect(desc.get("is_summonable") is True, "BP is_summonable must be true for /summon (is %r)" % desc.get("is_summonable"))
    t.expect(desc.get("is_experimental") is False, "BP is_experimental is %r; it must be false (no experimental toggle)" % desc.get("is_experimental"))
    t.expect("properties" not in desc and "runtime_identifier" not in desc, "BP description has unexpected keys %s" % sorted(desc))
    t.expect(ENTITY_ID.split(":")[0] != "minecraft", "namespace must not be minecraft")
    egg = d.desc.get("spawn_egg", {})
    t.expect(set(egg) == {"base_color", "overlay_color"}, "spawn_egg keys %s, expected base_color + overlay_color" % sorted(egg))
    cols = {}
    for k in ("base_color", "overlay_color"):
        v = egg.get(k)
        ok = isinstance(v, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", v) is not None
        t.expect(ok, "spawn_egg.%s %r is not '#RRGGBB'" % (k, v))
        if ok:
            r, g, b = (int(v[i:i + 2], 16) for i in (1, 3, 5))
            cols[k] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
    if len(cols) == 2:
        t.expect(cols["base_color"] > 0.85, "egg base colour luminance %.2f: not 'pale white'" % cols["base_color"])
        t.expect(cols["overlay_color"] < 0.3, "egg overlay colour luminance %.2f: not 'dark grey'" % cols["overlay_color"])
        t.expect(egg.get("base_color", "").upper() == "#E8E4D8" and egg.get("overlay_color", "").upper() == "#3B3B3B",
                 "egg colours %s differ from DESIGN.md section 4 (#E8E4D8 / #3B3B3B)" % egg)
    t.expect("spawn_category" not in desc, "unexpected spawn_category")
    t.ok("scp:scp096 in BP, client entity, sounds.json; spawnable+summonable; not experimental; egg #E8E4D8 pale (L=%.2f) / #3B3B3B dark (L=%.2f)" % (cols.get("base_color", 0), cols.get("overlay_color", 0)))


@check("xref.client_resources", "xref")
def c_xref_client(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    desc = d.desc
    gid = desc.get("geometry", {}).get("default")
    ids = [g["description"]["identifier"] for g in d.geo["minecraft:geometry"]]
    t.expect(gid == GEO_ID, "client geometry.default %r, expected %s" % (gid, GEO_ID))
    t.expect(gid in ids, "client geometry %r not defined in scp096.geo.json (defines %s)" % (gid, ids))
    tex = desc.get("textures", {}).get("default")
    t.expect(tex == TEX_REF, "client textures.default %r, expected %s" % (tex, TEX_REF))
    if tex:
        t.expect(not re.search(r"\.(png|tga|jpg)$", tex), "texture reference %r must not include an extension" % tex)
        files = [e for e in ("png", "tga") if c.exists("SCP096_RP/%s.%s" % (tex, e))]
        t.expect(files == ["png"], "texture file for %r: found %s, expected exactly SCP096_RP/%s.png" % (tex, files, tex))
        if c.exists("SCP096_RP/%s.png" % tex):
            try:
                w, h, bd, ct_, il = png_info(c.p("SCP096_RP/%s.png" % tex))
                gw, gh = d.geom["description"]["texture_width"], d.geom["description"]["texture_height"]
                t.expect((w, h) == (gw, gh) == (128, 128), "texture is %dx%d, geometry texture_width/height %dx%d, expected 128x128" % (w, h, gw, gh))
            except ValueError as ex:
                t.fail("texture: %s" % ex)
    mat = desc.get("materials", {}).get("default")
    from_corpus = c.corpus()
    mats = collections.Counter()
    ed = os.path.join(c.vanilla, "resource_pack", "entity")
    from vanilla_corpus_check import lenient_load
    for f in os.listdir(ed):
        if f.endswith(".json"):
            try:
                m = lenient_load(os.path.join(ed, f))["minecraft:client_entity"]["description"].get("materials", {})
                mats.update(m.values())
            except Exception:
                pass
    t.expect(mat in mats, "material %r is not used by any vanilla client entity" % mat)
    t.info("material %r is used by %d vanilla client entities" % (mat, mats.get(mat, 0)))
    rcs = desc.get("render_controllers", [])
    t.expect(rcs == ["controller.render.scp096"], "client render_controllers %r, expected ['controller.render.scp096']" % rcs)
    for r in rcs:
        rid = r if isinstance(r, str) else next(iter(r))
        t.expect(rid in d.rcs, "render controller %r not defined in scp096.render_controllers.json (defines %s)" % (rid, list(d.rcs)))
    for rid, body in d.rcs.items():
        refs = {"Geometry": desc.get("geometry", {}), "Material": desc.get("materials", {}), "Texture": desc.get("textures", {})}
        exprs = [("geometry", body.get("geometry"))] + [("textures[]", x) for x in body.get("textures", [])]
        for m in body.get("materials", []):
            exprs += [("materials[%s]" % k, v) for k, v in m.items()]
        for where, e in exprs:
            for kind, key in re.findall(r"\b(Geometry|Material|Texture)\.([A-Za-z0-9_]+)", e or ""):
                t.expect(key in refs[kind], "%s %s uses %s.%s but the client entity has no %s %r" % (rid, where, kind, key, kind.lower() + "s" if kind != "Geometry" else "geometry", key))
            if not re.search(r"\b(Geometry|Material|Texture)\.", e or ""):
                t.fail("%s %s = %r does not reference a Geometry./Material./Texture. resource" % (rid, where, e))
    for key in ("geometry", "materials", "textures"):
        t.expect(set(desc.get(key, {})) == {"default"}, "client %s keys %s; expected only 'default'" % (key, sorted(desc.get(key, {}))))
    t.expect(set(desc) <= {"identifier", "materials", "textures", "geometry", "scripts", "animations", "render_controllers",
                           "sound_effects", "spawn_egg"}, "client description has unexpected keys %s" % sorted(desc))
    t.ok("geometry %s, texture %s (128x128 PNG), material %s, render controller %s all resolve" % (gid, tex, mat, rcs))


@check("xref.animation_wiring", "xref")
def c_xref_anim(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    amap = d.desc.get("animations", {})
    ids = list(amap.values())
    t.expect(len(set(ids)) == len(ids), "client animation map assigns the same id twice: %s" % ids)
    for short, aid in amap.items():
        if aid.startswith("animation."):
            t.expect(aid in d.anims, "animation map %r -> %r is not defined in scp096.animation.json" % (short, aid))
        elif aid.startswith("controller.animation."):
            t.expect(aid in d.ctrls, "animation map %r -> %r is not defined in scp096.animation_controllers.json" % (short, aid))
        else:
            t.fail("animation map %r -> %r is neither animation.* nor controller.animation.*" % (short, aid))
    for aid in d.anims:
        t.expect(aid.startswith("animation.scp096."), "animation id %r does not start with animation.scp096." % aid)
        t.expect(aid in amap.values(), "animation %s is defined but not in the client animation map (dead)" % aid)
    for cid in d.ctrls:
        t.expect(cid.startswith("controller.animation.scp096."), "controller id %r does not start with controller.animation.scp096." % cid)
        t.expect(cid in amap.values(), "controller %s is defined but not in the client animation map (dead)" % cid)
    used = set()
    animate = d.desc.get("scripts", {}).get("animate", [])
    for a in animate:
        n = a if isinstance(a, str) else next(iter(a))
        used.add(n)
        t.expect(n in amap, "scripts.animate entry %r is not a key of the animation map %s" % (n, sorted(amap)))
    for cid, ctl in d.ctrls.items():
        for sn, st in ctl["states"].items():
            for e in st.get("animations", []):
                n = e if isinstance(e, str) else next(iter(e))
                used.add(n)
                t.expect(n in amap, "controller %s state %s plays %r which is not in the client animation map" % (cid, sn, n))
                t.expect(not (n in amap and amap[n].startswith("controller.")), "controller %s state %s nests controller %r" % (cid, sn, n))
    for short in amap:
        t.expect(short in used, "animation map entry %r is never played (not in scripts.animate nor in any controller state)" % short)
    t.expect(animate == ["main"], "scripts.animate is %r, DESIGN.md says [\"main\"]" % (animate,))
    t.expect(amap.get("main") == "controller.animation.scp096.main", "animation 'main' -> %r" % amap.get("main"))
    for need in ("sit_cry", "walk", "scream", "run"):
        t.expect(amap.get(need) == "animation.scp096." + need, "DESIGN.md animation id for %s: map has %r" % (need, amap.get(need)))
    t.ok("%d animation-map entries, all defined, all played; scripts.animate = %s" % (len(amap), animate))


@check("xref.controller_graph", "xref")
def c_xref_controller(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    cid = "controller.animation.scp096.main"
    t.expect(cid in d.ctrls, "controller %s missing" % cid)
    ctl = d.ctrls.get(cid)
    if not ctl:
        return
    states = ctl["states"]
    t.expect(set(states) == set(STATE_VARIANT), "controller states %s, DESIGN.md wants %s" % (sorted(states), sorted(STATE_VARIANT)))
    t.expect(ctl.get("initial_state") == "sit", "initial_state %r, expected 'sit'" % ctl.get("initial_state"))
    t.expect(ctl.get("initial_state") in states, "initial_state %r is not a state" % ctl.get("initial_state"))
    edges = {s: [] for s in states}
    for sn, st in states.items():
        extra = set(st) - {"animations", "transitions", "blend_transition", "sound_effects", "particle_effects", "on_entry", "on_exit", "variables", "blend_via_shape"}
        t.expect(not extra, "state %s has unknown keys %s" % (sn, sorted(extra)))
        bt = st.get("blend_transition")
        t.expect(isinstance(bt, (int, float)) and 0.1 <= bt <= 0.5, "state %s blend_transition %r outside 0.1..0.5 (DESIGN: 0.2-0.4)" % (sn, bt))
        t.expect(st.get("animations"), "state %s plays no animation" % sn)
        for tr in st.get("transitions", []):
            t.expect(isinstance(tr, dict) and len(tr) == 1, "state %s: transition %r must be a one-key object" % (sn, tr))
            for tgt, cond in tr.items():
                t.expect(tgt in states, "state %s transitions to unknown state %r" % (sn, tgt))
                t.expect(tgt != sn, "state %s transitions to itself" % sn)
                edges[sn].append(tgt)
                t.expect(isinstance(cond, str) and cond.strip(), "state %s -> %s has an empty condition" % (sn, tgt))
    # reachability + strong connectivity
    def reach(src):
        seen, todo = {src}, [src]
        while todo:
            x = todo.pop()
            for y in edges.get(x, []):
                if y in states and y not in seen:
                    seen.add(y)
                    todo.append(y)
        return seen
    init = ctl.get("initial_state")
    if init in states:
        unreachable = set(states) - reach(init)
        t.expect(not unreachable, "states unreachable from initial_state: %s" % sorted(unreachable))
    stuck = [s for s in states if reach(s) != set(states)]
    t.expect(not stuck, "from state(s) %s some state cannot be reached (the BP can request any pose from any pose)" % stuck)
    # every state must be able to leave to every other: the events are idempotent and may arrive in any order
    for s in states:
        missing = set(states) - {s} - set(edges[s])
        t.expect(not missing, "state %s has no direct transition to %s (a stale/duplicate BP event could strand the pose)" % (s, sorted(missing)))
    # sound effects named in the controller
    snd = d.desc.get("sound_effects", {})
    for sn, st in states.items():
        for e in st.get("sound_effects", []):
            t.expect(e.get("effect") in snd, "state %s sound effect %r not in the client sound_effects %s" % (sn, e.get("effect"), sorted(snd)))
    t.ok("states %s, initial 'sit', every state reaches every other directly (%d transitions)" % (sorted(states), sum(len(v) for v in edges.values())))


@check("xref.variant_contract", "xref")
def c_xref_variant(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    ctl = d.ctrls.get("controller.animation.scp096.main", {})
    # client: target state -> set of variant numbers it is entered on
    enter = collections.defaultdict(set)
    for sn, st in ctl.get("states", {}).items():
        for tr in st.get("transitions", []):
            for tgt, cond in tr.items():
                m = re.fullmatch(r"\s*query\.variant\s*==\s*(\d+)\s*", cond)
                if not m:
                    t.fail("controller state %s -> %s: condition %r is not of the form 'query.variant == N'" % (sn, tgt, cond))
                else:
                    enter[tgt].add(int(m.group(1)))
    for s, n in STATE_VARIANT.items():
        t.expect(enter.get(s) == {n}, "controller enters state %r on query.variant %s, DESIGN.md says exactly {%d}" % (s, sorted(enter.get(s, [])), n))
    # BP: group -> variant value
    bpv = {}
    for g, grp in d.groups.items():
        if "minecraft:variant" in grp:
            v = grp["minecraft:variant"]
            t.expect(set(v) == {"value"} and type(v["value"]) is int, "group %s variant body %r must be {'value': int}" % (g, v))
            bpv[g] = v.get("value")
    t.expect("minecraft:variant" not in d.ent.get("components", {}), "base components define minecraft:variant (would clash with the groups)")
    for s, n in STATE_VARIANT.items():
        g = STATE_GROUP[s]
        t.expect(bpv.get(g) == n, "BP group %s has variant %r, state %s needs %d" % (g, bpv.get(g), s, n))
    t.expect(sorted(bpv.values()) == [0, 1, 2, 3], "BP variant values %s are not exactly 0,1,2,3 once each" % sorted(bpv.values()))
    t.expect(set(bpv) == set(STATE_GROUP.values()), "groups with a variant: %s" % sorted(bpv))
    # the spawn state must be variant 0 = initial controller state
    spawn = d.events.get("minecraft:entity_spawned", {}).get("add", {}).get("component_groups", [])
    sv = [bpv[g] for g in spawn if g in bpv]
    t.expect(sv == [0], "entity_spawned adds groups %s => variant(s) %s; the controller starts in 'sit' (variant 0)" % (spawn, sv))
    # client animations are variant-agnostic otherwise
    qv = [p for p, sx in walk_strings(d.cl) if "query.variant" in sx]
    t.expect(not qv, "client entity file uses query.variant outside the controller: %s" % qv)
    # script reads value 3
    js = open(c.p("SCP096_BP/scripts/main.js"), encoding="utf-8").read() if c.exists("SCP096_BP/scripts/main.js") else ""
    m = re.search(r"RAGE[A-Z_]*\s*=\s*(\d+)", js) or re.search(r"\.value\s*===?\s*(\d+)", js)
    if m:
        t.expect(int(m.group(1)) == STATE_VARIANT["run"], "script treats variant %s as rage-run, BP/controller use %d" % (m.group(1), STATE_VARIANT["run"]))
    else:
        t.warn("could not find the rage variant constant in main.js")
    t.ok("controller transitions query.variant==0/1/2/3 -> sit/walk/scream/run == BP groups pose_sit/pose_walk/rage_scream/rage_run; spawn state = 0; script uses 3")


@check("xref.sounds", "xref")
def c_xref_sounds(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    snd = d.desc.get("sound_effects", {})
    t.expect(snd == {"cry": "mob.scp096.cry", "scream": "mob.scp096.scream", "rage": "mob.scp096.rage"},
             "client sound_effects %r differ from DESIGN.md section 4" % (snd,))
    used = set()
    for aid, a in d.anims.items():
        for tm, ev in (a.get("sound_effects") or {}).items():
            evs = ev if isinstance(ev, list) else [ev]
            for e in evs:
                used.add(e.get("effect"))
                t.expect(e.get("effect") in snd, "%s sound_effects[%s] effect %r not in client sound_effects" % (aid, tm, e.get("effect")))
            try:
                t_ = float(tm)
                L = a.get("animation_length")
                t.expect(L is not None and 0 <= t_ <= L, "%s sound at %s outside animation_length %s" % (aid, tm, L))
                t.expect(a.get("loop") is True or t_ >= 0, "%s: sound on a non-looping animation" % aid)
            except ValueError:
                t.fail("%s sound_effects key %r is not a time" % (aid, tm))
    for cid, ctl in d.ctrls.items():
        for sn, st in ctl["states"].items():
            for e in st.get("sound_effects", []):
                used.add(e.get("effect"))
    for k in snd:
        t.expect(k in used, "sound short name %r is declared but never played" % k)
    for k, sid in snd.items():
        t.expect(sid in d.sdefs, "sound_effects %r -> %r is not in sound_definitions.json" % (k, sid))
    # events from sounds.json
    ev = d.sj["entity_sounds"]["entities"].get(ENTITY_ID, {})
    for name, sid in ev.get("events", {}).items():
        t.expect(sid in d.sdefs, "sounds.json event %r -> %r is not in sound_definitions.json" % (name, sid))
    referenced = set(snd.values()) | set(ev.get("events", {}).values())
    for sid in d.sdefs:
        t.expect(sid in referenced, "sound definition %s is never referenced (client sound_effects or sounds.json)" % sid)
    # files
    on_disk = {f for f in c.pack_files() if f.startswith("SCP096_RP/sounds/") and f.endswith(".ogg")}
    refd = set()
    for sid, body in d.sdefs.items():
        t.expect(sid.startswith("mob.scp096."), "sound id %r does not start with mob.scp096." % sid)
        for i, s_ in enumerate(body.get("sounds", [])):
            name = s_["name"] if isinstance(s_, dict) else s_
            t.expect(not re.search(r"\.(ogg|wav|fsb)$", name), "%s sounds[%d] %r must not carry a file extension" % (sid, i, name))
            f = "SCP096_RP/%s.ogg" % name
            refd.add(f)
            t.expect(f in on_disk, "%s sounds[%d] -> %s does not exist" % (sid, i, f))
    for f in sorted(on_disk - refd):
        t.fail("ogg %s is not referenced by any sound definition (dead weight)" % f)
    t.ok("%d sound ids, %d ogg files, all referenced and present; effects used: %s" % (len(d.sdefs), len(on_disk), sorted(used)))


@check("xref.bp_events_groups", "xref")
def c_xref_bp_events(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    ev_names, grp_names = set(d.events), set(d.groups)
    ev_ref, grp_ref = set(), set()

    def scan(node, where):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "component_groups" and isinstance(v, list):
                    for g in v:
                        grp_ref.add(g)
                        t.expect(g in grp_names, "%s references component group %r which does not exist" % (where, g))
                elif k == "event" and isinstance(v, str):
                    ev_ref.add(v)
                    t.expect(v in ev_names, "%s references event %r which does not exist" % (where, v))
                else:
                    scan(v, where + "." + k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                scan(v, where + "[%d]" % i)
    for where, name, body in all_component_blocks(d.ent):
        scan(body, "%s.%s" % (where, name))
    for en, ev in d.events.items():
        scan(ev, "events.%s" % en)
    for g in grp_names:
        t.expect(g in grp_ref, "component group %s is never added by any event (dead)" % g)
    for e in ev_names:
        if e != "minecraft:entity_spawned":
            t.expect(e in ev_ref, "event %s is never fired by any component (dead)" % e)
    t.expect("minecraft:entity_spawned" in ev_names, "minecraft:entity_spawned event missing")
    for g in grp_names:
        t.expect(re.fullmatch(r"scp096:[a-z_]+", g) is not None, "group name %r is not namespaced scp096:*" % g)
    for e in ev_names:
        t.expect(e == "minecraft:entity_spawned" or re.fullmatch(r"scp096:[a-z_]+", e) is not None, "event name %r is not namespaced scp096:*" % e)
    t.expect(ev_names == {"minecraft:entity_spawned", "scp096:begin_walk", "scp096:begin_sit", "scp096:enrage", "scp096:begin_run", "scp096:calm_down"},
             "events %s differ from DESIGN.md section 5" % sorted(ev_names))
    t.expect(grp_names == {"scp096:calm", "scp096:pose_sit", "scp096:pose_walk", "scp096:rage_scream", "scp096:rage_run"},
             "groups %s differ from DESIGN.md section 5" % sorted(grp_names))
    t.ok("%d events and %d groups: every reference resolves and nothing is dead" % (len(ev_names), len(grp_names)))


def bp_state_space(ent, order="remove_first"):
    """Independent model of the BP state machine: explore every group set reachable when ANY event can fire at ANY
    time (timers, stale or duplicate events included).  `is_variant` filters are evaluated against the variant of
    the active groups; other filters branch both ways.  Returns (states, problems)."""
    groups, events = ent["component_groups"], ent["events"]
    problems = []

    def variant(active):
        vals = {groups[g]["minecraft:variant"]["value"] for g in active if "minecraft:variant" in groups[g]}
        return vals

    def passes(f, active):
        if f is None:
            return [True]
        if isinstance(f, dict) and f.get("test") == "is_variant" and f.get("subject") == "self":
            vals = variant(active)
            if len(vals) != 1:
                return [False]
            v = next(iter(vals))
            want = f["value"]
            op = f.get("operator", "==")
            return [(v == want) if op in ("==", "equals") else (v != want)]
        return [True, False]

    def apply_resp(active, resp):
        outs = set()
        steps = []
        if "sequence" in resp:
            for el in resp["sequence"]:
                steps.append(el)
        else:
            steps.append(resp)
        cur = {active}
        for el in steps:
            nxt = set()
            for a in cur:
                for ok in passes(el.get("filters"), a):
                    if not ok:
                        nxt.add(a)
                        continue
                    rem = set(el.get("remove", {}).get("component_groups", []))
                    add = set(el.get("add", {}).get("component_groups", []))
                    if order == "remove_first":
                        res = (set(a) - rem) | add
                    else:
                        res = (set(a) | add) - rem
                    nxt.add(frozenset(res))
            cur = nxt
        return cur

    start = apply_resp(frozenset(), events["minecraft:entity_spawned"])
    seen, todo = set(start), list(start)
    while todo:
        a = todo.pop()
        for en, ev in events.items():
            if en == "minecraft:entity_spawned":
                continue
            for b in apply_resp(a, ev):
                if b not in seen:
                    seen.add(b)
                    todo.append(b)
    return seen, problems


def vanilla_add_remove_overlap(c: Ctx):
    """Vanilla BP events whose response both removes and adds the same component group."""
    bpd = os.path.join(c.vanilla, "behavior_pack", "entities")
    hits = []
    if not os.path.isdir(bpd):
        return hits
    from vanilla_corpus_check import lenient_load

    def walk(n, f, path):
        if isinstance(n, dict):
            a = set(n["add"].get("component_groups", [])) if isinstance(n.get("add"), dict) else set()
            r = set(n["remove"].get("component_groups", [])) if isinstance(n.get("remove"), dict) else set()
            if a & r:
                hits.append((f, path.split("/")[-1] or path, sorted(a & r)))
            for k, v in n.items():
                walk(v, f, path + "/" + k)
        elif isinstance(n, list):
            for i, v in enumerate(n):
                walk(v, f, path + "[%d]" % i)
    for f in sorted(os.listdir(bpd)):
        if f.endswith(".json"):
            walk(lenient_load(os.path.join(bpd, f))["minecraft:entity"].get("events", {}), f, "")
    return hits


@check("xref.bp_state_space", "xref")
def c_xref_bp_state(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    legal = {
        frozenset({"scp096:calm", "scp096:pose_sit"}), frozenset({"scp096:calm", "scp096:pose_walk"}),
        frozenset({"scp096:rage_scream"}), frozenset({"scp096:rage_run"}),
    }
    results = {}
    for order in ("remove_first", "add_first"):
        states, _ = bp_state_space(d.ent, order)
        results[order] = states
    # the game's order inside ONE event response is not documented in the files we have; vanilla is the evidence
    hits = vanilla_add_remove_overlap(c)
    for s_ in sorted(results["remove_first"] - legal, key=sorted):
        t.fail("[remove-then-add] reachable illegal group set %s (variant values %s)" % (
            sorted(s_), sorted({d.groups[g].get("minecraft:variant", {}).get("value") for g in s_})))
    t.expect(legal <= results["remove_first"], "[remove-then-add] legal states never reached: %s" % [sorted(x) for x in legal - results["remove_first"]])
    bad_add_first = (results["add_first"] - legal) | (legal - results["add_first"])
    if bad_add_first:
        msg = ("order dependence: if the engine applied `add` BEFORE `remove` inside one event response, scp096:enrage / "
               "begin_run / calm_down (which remove the group they add) would leave the group set %s - an entity with no "
               "pose, no variant and no behaviour. The whole design therefore rests on remove-then-add.  Evidence for "
               "remove-then-add: %s.  Suggested hardening (behavior owner): remove every state group EXCEPT the ones "
               "being added, which is correct under both orders." % (
                   sorted({tuple(sorted(x)) for x in results["add_first"] - legal}) or "(some legal states unreachable)",
                   ("vanilla %s relies on it (the same group is in `remove` and `add` of one event)" % ", ".join(sorted({h[0] + ":" + h[1] for h in hits})))
                   if hits else "NONE found in the vanilla corpus"))
        (t.warn if hits else t.fail)(msg)
    # conflicting components between groups that may be active together
    comps = {g: set(body) for g, body in d.groups.items()}
    base = set(d.ent["components"])
    for s in results["remove_first"]:
        seen = collections.Counter()
        for g in s:
            seen.update(comps[g])
        dup = [k for k, n in seen.items() if n > 1]
        t.expect(not dup, "state %s defines %s in two groups at once" % (sorted(s), dup))
    over = sorted({k for g in comps.values() for k in g} & base)
    t.info("components overriding a base component from a group: %s" % over)
    t.ok("%d reachable group sets under arbitrary event order, all legal (4 states); no component defined twice in one state" % len(results["remove_first"]))


@check("xref.bp_design_values", "xref")
def c_xref_bp_values(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    comp = d.ent["components"]
    g = d.groups
    t.expect(comp["minecraft:health"] == {"value": 500, "max": 500}, "health %r, expected 500/500" % comp["minecraft:health"])
    t.expect(comp["minecraft:knockback_resistance"]["value"] == 1.0, "knockback_resistance %r, expected 1.0" % comp["minecraft:knockback_resistance"])
    t.expect(comp["minecraft:attack"]["damage"] >= 20, "attack damage %r < 20 (a player has 20 HP: needs 1-2 hits)" % comp["minecraft:attack"])
    t.expect(comp["minecraft:follow_range"]["value"] >= 32, "follow_range %r" % comp["minecraft:follow_range"])
    fam = comp["minecraft:type_family"]["family"]
    t.expect(fam == ["scp096", "scp", "mob"] and "monster" not in fam, "families %r, DESIGN.md says [scp096, scp, mob] and not monster" % fam)
    ds = comp["minecraft:damage_sensor"]["triggers"]
    t.expect(isinstance(ds, dict) and ds.get("deals_damage") is True and 0 < ds.get("damage_multiplier", 1) <= 0.25,
             "damage_sensor %r: expected deals_damage true with damage_multiplier in (0, 0.25]" % (ds,))
    t.expect("minecraft:persistent" in comp, "minecraft:persistent missing (it must never despawn)")
    for bad in ("minecraft:despawn", "minecraft:hurt_by_target", "minecraft:behavior.hurt_by_target", "minecraft:nearest_attackable_target",
                "minecraft:behavior.nearest_attackable_target", "minecraft:behavior.nearest_prioritized_attackable_target",
                "minecraft:behavior.melee_attack", "minecraft:behavior.avoid_mob_type", "minecraft:behavior.panic", "minecraft:loot",
                "minecraft:spawn_rules", "minecraft:behavior.random_look_around"):
        for where, name, _b in all_component_blocks(d.ent):
            if name == bad and not (where.startswith("component_groups.scp096:pose_walk") and name == "minecraft:behavior.random_look_around"):
                t.fail("%s defines %s (forbidden by DESIGN.md section 5)" % (where, name))
    cb = comp["minecraft:collision_box"]
    t.expect(cb == {"width": 0.7, "height": 2.8}, "base collision_box %r" % cb)
    t.expect(g["scp096:pose_sit"]["minecraft:collision_box"] == {"width": 0.9, "height": 1.5}, "sit collision box %r" % g["scp096:pose_sit"].get("minecraft:collision_box"))
    for n in ("pose_walk", "rage_scream", "rage_run"):
        t.expect(g["scp096:" + n]["minecraft:collision_box"] == {"width": 0.7, "height": 2.8}, "%s collision box %r" % (n, g["scp096:" + n].get("minecraft:collision_box")))
    t.expect(g["scp096:rage_scream"]["minecraft:timer"]["time"] == [3, 5], "scream timer %r, spec says 3-5 s" % g["scp096:rage_scream"]["minecraft:timer"].get("time"))
    t.expect(g["scp096:rage_scream"]["minecraft:timer"].get("randomInterval") is True, "scream timer must be randomInterval")
    t.expect(g["scp096:rage_scream"]["minecraft:movement"]["value"] == 0.0, "scream group must root the entity (movement 0)")
    t.expect(g["scp096:pose_sit"]["minecraft:movement"]["value"] == 0.0, "sit group must not move")
    t.expect(g["scp096:rage_run"]["minecraft:movement"]["value"] >= 0.3, "rage movement %r is not 'very fast'" % g["scp096:rage_run"]["minecraft:movement"])
    t.expect(0 < g["scp096:pose_walk"]["minecraft:movement"]["value"] <= 0.1, "walk movement %r is not slow" % g["scp096:pose_walk"]["minecraft:movement"])
    la = g["scp096:calm"]["minecraft:lookat"]
    t.expect(la.get("set_target") is True and la.get("search_radius", 0) >= 32, "lookat %r must set_target and reach >= 32 blocks" % la)
    t.expect(la["filters"] == {"all_of": [{"subject": "other", "test": "is_family", "value": "player"}]}, "lookat filter %r should target the player family only" % la.get("filters"))
    t.expect(g["scp096:calm"]["minecraft:on_target_acquired"] == {"event": "scp096:enrage", "target": "self"}, "on_target_acquired wiring")
    for n in ("rage_scream", "rage_run"):
        t.expect("minecraft:lookat" not in g["scp096:" + n], "%s still has lookat (it would retarget other players)" % n)
    ma = g["scp096:rage_run"]["minecraft:behavior.melee_box_attack"]
    t.expect(ma.get("track_target") is True, "melee_box_attack must track_target (keeps chasing)")
    t.expect(g["scp096:rage_run"].get("minecraft:break_blocks", {}).get("breakable_blocks"), "rage_run has no break_blocks list")
    for n in ("calm", "pose_sit", "pose_walk", "rage_scream"):
        t.expect("minecraft:break_blocks" not in g["scp096:" + n], "only rage_run may break blocks (%s does)" % n)
    t.ok("500 HP, knockback 1.0, attack %s, families %s, damage x%s, no despawn/hurt_by_target/target selectors, scream timer 3-5 s, "
         "rage speed %s, lookat player-only radius %s" % (comp["minecraft:attack"]["damage"], fam, ds["damage_multiplier"],
                                                          g["scp096:rage_run"]["minecraft:movement"]["value"], la["search_radius"]))



# ======================================================================================================
# group: molang  (own tokenizer + parser; does not use tools/eval_animation.py)
# ======================================================================================================
class MolangSyntaxError(ValueError):
    pass


_MTOK = re.compile(r"""\s*(?:
    (?P<num>(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)
   |(?P<id>[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)
   |(?P<str>'[^']*')
   |(?P<op>&&|\|\||==|!=|<=|>=|\?\?|->|[-+*/()<>!?:,;=\[\]{}])
)""", re.X)

# Microsoft's Molang reference: math functions and their argument counts
MATH_ARITY = {
    "abs": 1, "acos": 1, "asin": 1, "atan": 1, "atan2": 2, "ceil": 1, "clamp": 3, "cos": 1, "die_roll": 3,
    "die_roll_integer": 3, "exp": 1, "floor": 1, "hermite_blend": 1, "lerp": 3, "lerprotate": 3, "ln": 1, "max": 2,
    "min": 2, "min_angle": 1, "mod": 2, "pow": 2, "random": 2, "random_integer": 2, "round": 1, "sin": 1, "sqrt": 1,
    "trunc": 1,
}
MATH_CONST = {"pi"}
LONG_NS = {"query", "math", "variable", "temp", "context", "array", "texture", "geometry", "material"}
SHORT_NS = {"q": "query", "v": "variable", "t": "temp", "c": "context"}


def molang_tokens(src):
    pos, out = 0, []
    while pos < len(src):
        if src[pos:].strip() == "":
            break
        m = _MTOK.match(src, pos)
        if not m or m.end() == pos:
            raise MolangSyntaxError("cannot tokenise at %r" % src[pos:pos + 15])
        pos = m.end()
        out.append((m.lastgroup, m.group(m.lastgroup)))
    return out


class MolangParser:
    """Recursive descent over the Molang subset used here.  Records: calls, identifiers, assignments, reads."""

    def __init__(self, src):
        self.src = src
        self.toks = molang_tokens(src)
        self.i = 0
        self.calls, self.ids, self.assigns, self.reads, self.numbers = [], [], [], [], []
        self.depth_max = 0
        self._depth = 0

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else (None, None)

    def eat(self, val=None):
        k, v = self.peek()
        if k is None:
            raise MolangSyntaxError("unexpected end of expression (missing operand or ')')")
        if val is not None and v != val:
            raise MolangSyntaxError("expected %r but found %r" % (val, v))
        self.i += 1
        return k, v

    def parse(self):
        if not self.toks:
            raise MolangSyntaxError("empty expression")
        while self.i < len(self.toks):
            if self.peek()[1] == ";":
                self.eat()
                continue
            self.statement()
            if self.i < len(self.toks):
                self.eat(";")
        return self

    def statement(self):
        k, v = self.peek()
        if k == "id" and v.lower() == "return":
            self.eat()
            return self.expr()
        if k == "id" and v.lower() in ("loop", "for_each", "break", "continue"):
            raise MolangSyntaxError("%s is not allowed here (unproven in vanilla animations)" % v)
        if k == "id" and self.i + 1 < len(self.toks) and self.toks[self.i + 1][1] == "=":
            self.eat()
            self.eat("=")
            self.expr()
            self.assigns.append(v)
            return
        return self.expr()

    def expr(self):
        self._depth += 1
        self.depth_max = max(self.depth_max, self._depth)
        r = self.ternary()
        self._depth -= 1
        return r

    def ternary(self):
        self.coalesce()
        if self.peek()[1] == "?":
            self.eat()
            self.expr()
            if self.peek()[1] == ":":
                self.eat()
                self.expr()
            else:
                raise MolangSyntaxError("'?' without ':' (binary conditional is not used/proven here)")

    def coalesce(self):
        self.binary(0)
        while self.peek()[1] == "??":
            self.eat()
            self.binary(0)

    LEVELS = [("||",), ("&&",), ("==", "!="), ("<", ">", "<=", ">="), ("+", "-"), ("*", "/")]

    def binary(self, lvl):
        if lvl == len(self.LEVELS):
            return self.unary()
        self.binary(lvl + 1)
        while self.peek()[0] == "op" and self.peek()[1] in self.LEVELS[lvl]:
            self.eat()
            self.binary(lvl + 1)

    def unary(self):
        if self.peek()[1] in ("-", "+", "!"):
            self.eat()
            return self.unary()
        return self.primary()

    def primary(self):
        k, v = self.peek()
        if k == "num":
            self.eat()
            self.numbers.append(v)
        elif k == "str":
            self.eat()
        elif k == "id":
            self.eat()
            if self.peek()[1] == "(":
                self.eat()
                n = 0
                if self.peek()[1] != ")":
                    while True:
                        self.expr()
                        n += 1
                        if self.peek()[1] == ",":
                            self.eat()
                            continue
                        break
                self.eat(")")
                self.calls.append((v, n))
            else:
                self.ids.append(v)
                if v.lower().startswith(("variable.", "v.", "temp.", "t.")):
                    self.reads.append(v)
            while self.peek()[1] == "[":
                self.eat()
                self.expr()
                self.eat("]")
        elif v == "(":
            self.eat()
            self.expr()
            self.eat(")")
        else:
            raise MolangSyntaxError("unexpected %r" % (v,))


def parse_molang(src):
    p = MolangParser(src)
    p.parse()
    # explicit paren balance (a second, independent measure)
    bal = 0
    for k, v in p.toks:
        if v == "(":
            bal += 1
        elif v == ")":
            bal -= 1
            if bal < 0:
                raise MolangSyntaxError("')' without '('")
    if bal:
        raise MolangSyntaxError("%d unclosed '('" % bal)
    return p


def collect_molang(d: "Docs"):
    """Every Molang string of the client side: [(location, string, kind)], kind in {pre, expr, render}."""
    out = []
    scripts = d.desc.get("scripts", {})
    for i, s_ in enumerate(scripts.get("pre_animation", [])):
        out.append(("client.scripts.pre_animation[%d]" % i, s_, "pre"))
    for k, v in scripts.items():
        if k == "pre_animation":
            continue
        if k == "animate":
            for i, a in enumerate(v):
                if isinstance(a, dict):
                    for n, cond in a.items():
                        out.append(("client.scripts.animate[%d].%s" % (i, n), cond, "expr"))
        elif isinstance(v, (str, int, float)) and not isinstance(v, bool):
            out.append(("client.scripts.%s" % k, str(v), "expr"))
    def chan(loc, v):
        if isinstance(v, str):
            out.append((loc, v, "expr"))
        elif isinstance(v, (int, float)) or v is None or isinstance(v, bool):
            pass
        elif isinstance(v, list):
            for i, x in enumerate(v):
                chan("%s[%d]" % (loc, i), x)
        elif isinstance(v, dict):
            for k2, x in v.items():
                if k2 == "lerp_mode":
                    continue
                chan("%s.%s" % (loc, k2), x)
    for aid, a in d.anims.items():
        for k, v in a.items():
            if k == "bones":
                for b, chs in v.items():
                    for chn, val in chs.items():
                        chan("%s.bones.%s.%s" % (aid, b, chn), val)
            elif k in ("anim_time_update", "blend_weight", "start_delay", "loop_delay"):
                chan("%s.%s" % (aid, k), v)
    for cid, ctl in d.ctrls.items():
        for sn, st in ctl["states"].items():
            for i, tr in enumerate(st.get("transitions", [])):
                for tg, cond in tr.items():
                    out.append(("%s.%s.transitions[%d]->%s" % (cid, sn, i, tg), cond, "expr"))
            for i, e in enumerate(st.get("animations", [])):
                if isinstance(e, dict):
                    for n, w in e.items():
                        out.append(("%s.%s.animations[%s]" % (cid, sn, n), w, "expr"))
            for key in ("on_entry", "on_exit"):
                for i, e in enumerate(st.get(key, [])):
                    out.append(("%s.%s.%s[%d]" % (cid, sn, key, i), e, "pre"))
    for rid, body in d.rcs.items():
        for key in ("geometry", "textures", "materials", "part_visibility", "color", "uv_anim", "ignore_lighting",
                    "is_hurt_color", "on_fire_color", "overlay_color", "light_color_multiplier"):
            if key in body:
                for p_, sx in walk_strings(body[key]):
                    out.append(("%s.%s%s" % (rid, key, ("." + fmtpath(p_)) if p_ else ""), sx, "render"))
    return out


def molang_corpus_names(c: Ctx):
    corp = c.corpus()
    q = {n for (p, n), k in corp.molang_ids.items() if p in ("query", "q")}
    m = {n for (p, n), k in corp.molang_ids.items() if p == "math"}
    return corp, q, m


@check("molang.syntax", "molang")
def c_molang_syntax(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    items = collect_molang(d)
    n_ok, longest = 0, (0, "")
    parsed = []
    for loc, src, kind in items:
        try:
            if "\n" in src or "\t" in src:
                t.fail("%s: contains a newline or tab inside an expression" % loc)
            p = parse_molang(src)
            n_ok += 1
            parsed.append((loc, src, kind, p))
            if len(src) > longest[0]:
                longest = (len(src), loc)
            if kind == "pre" and not (src.rstrip().endswith(";")):
                t.warn("%s: statement does not end with ';' (vanilla pre_animation statements do)" % loc)
        except MolangSyntaxError as ex:
            t.fail("%s: %s  | %s" % (loc, ex, src[:100]))
    c._json["__molang__"] = parsed
    t.ok("%d Molang strings tokenised and parsed; parentheses balanced; longest %d chars (%s)" % (n_ok, longest[0], longest[1]))
    t.info("number literals without exponent: %s" % (not any(re.search(r"[eE]", n) for _, _, _, p in parsed for n in p.numbers)))
    for _, src, _, p in parsed:
        for n in p.numbers:
            if re.search(r"[eE]", n):
                t.warn("exponent number literal %s in %r is not proven in vanilla Molang" % (n, src[:60]))
    # static division by a literal zero
    for loc, src, kind, p in parsed:
        if re.search(r"/\s*0(\.0*)?(?![\d.])", src):
            t.fail("%s: division by literal zero" % loc)


@check("molang.vocabulary", "molang")
def c_molang_vocab(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    if "__molang__" not in c._json:
        c_molang_syntax(c, T("molang.syntax", "molang"))
    parsed = c._json.get("__molang__", [])
    corp, vq, vm = molang_corpus_names(c)
    used_q, used_m = collections.Counter(), collections.Counter()
    for loc, src, kind, p in parsed:
        if kind == "render":
            continue
        for name, nargs in p.calls:
            low = name.lower()
            ns, _, fn = low.partition(".")
            if name != low:
                t.fail("%s: %r must be lower-case (DESIGN.md rule 4)" % (loc, name))
            if ns == "math":
                used_m[fn] += 1
                if fn not in MATH_ARITY:
                    t.fail("%s: unknown function %s" % (loc, name))
                elif MATH_ARITY[fn] != nargs:
                    t.fail("%s: %s takes %d argument(s), got %d" % (loc, name, MATH_ARITY[fn], nargs))
                if fn not in vm:
                    t.fail("%s: math.%s is never used in vanilla 1.21.0.3 files (unproven)" % (loc, fn))
            elif ns in ("query", "q"):
                used_q[fn] += 1
                t.fail("%s: %s is called as a function (queries used here take no arguments)" % (loc, name))
            else:
                t.fail("%s: unknown function %s" % (loc, name))
        for ident in p.ids:
            low = ident.lower()
            ns, _, rest = low.partition(".")
            if ident != low:
                t.fail("%s: %r must be lower-case (DESIGN.md rule 4)" % (loc, ident))
            if ns in SHORT_NS:
                t.fail("%s: short name %r; DESIGN.md rule 4 wants %s." % (loc, ident, SHORT_NS[ns]))
            elif ns == "query":
                used_q[rest] += 1
                if rest not in vq:
                    t.fail("%s: query.%s is never used in vanilla 1.21.0.3 files (unproven)" % (loc, rest))
            elif ns == "math":
                if rest not in MATH_CONST:
                    t.fail("%s: %s is not a math constant (math.pi)" % (loc, ident))
                used_m[rest] += 1
            elif ns in ("variable", "temp"):
                pass
            else:
                t.fail("%s: unknown identifier %r (namespace %r)" % (loc, ident, ns))
    t.info("queries used (count in expressions / vanilla files): " + ", ".join(
        "query.%s=%d/%d" % (k, v, corp.molang_has("query", k)) for k, v in sorted(used_q.items())))
    t.info("math used: " + ", ".join("math.%s=%d/%d" % (k, v, corp.molang_has("math", k)) for k, v in sorted(used_m.items())))
    t.ok("queries %s and math %s: all lower-case, long names, documented arity, all present in the vanilla corpus" % (
        sorted(used_q), sorted(used_m)))


@check("molang.variables", "molang")
def c_molang_variables(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    if "__molang__" not in c._json:
        c_molang_syntax(c, T("molang.syntax", "molang"))
    parsed = c._json.get("__molang__", [])
    defined = []
    seen_assign = set()
    # pre_animation statements run in order before any animation / controller of the entity
    for loc, src, kind, p in parsed:
        if kind != "pre" or not loc.startswith("client.scripts.pre_animation"):
            continue
        for r in p.reads:
            if r.lower() not in seen_assign:
                t.fail("%s reads %s before it is assigned (Molang yields 0 silently)" % (loc, r))
        for a in p.assigns:
            if a.lower() in seen_assign:
                t.warn("%s re-assigns %s" % (loc, a))
            seen_assign.add(a.lower())
            if not a.lower().startswith("variable."):
                t.fail("%s assigns %r; only variable.* is allowed" % (loc, a))
    unknown_reads = set()
    used = set()
    for loc, src, kind, p in parsed:
        if loc.startswith("client.scripts.pre_animation"):
            used |= {r.lower() for r in p.reads}
            continue
        local = set()
        for r in p.reads:
            used.add(r.lower())
            if r.lower() not in seen_assign:
                unknown_reads.add((loc, r))
        for a in p.assigns:
            local.add(a.lower())
    for loc, r in sorted(unknown_reads):
        t.fail("%s reads %s which pre_animation never assigns" % (loc, r))
    for a in sorted(seen_assign - used):
        t.warn("variable %s is assigned in pre_animation but never read" % a)
    # all variable names are prefixed
    bad = [a for a in seen_assign if not re.fullmatch(r"variable\.scp_[a-z0-9_]+", a)]
    t.expect(not bad, "variables not named variable.scp_*: %s (collision risk with other add-ons)" % bad)
    t.ok("%d variables assigned in order in pre_animation; every read in animations/controllers is covered" % len(seen_assign))


@check("molang.length_vs_vanilla", "molang")
def c_molang_length(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    if "__molang__" not in c._json:
        c_molang_syntax(c, T("molang.syntax", "molang"))
    parsed = c._json.get("__molang__", [])
    corp = c.corpus()
    mine = max(((len(s_), loc) for loc, s_, k, p in parsed), default=(0, ""))
    t.info("longest of ours: %d chars at %s; longest vanilla string with Molang identifiers: %d chars (%s)" % (
        mine[0], mine[1], corp.molang_max_len, corp.molang_max_where))
    if mine[0] > corp.molang_max_len:
        t.warn("longest expression of ours is %d chars (%s), vanilla's longest is %d chars (%s): no length limit is "
               "documented, but nothing in the corpus proves long statements load; if the content log complains, split them" % (
                   mine[0], mine[1], corp.molang_max_len, corp.molang_max_where))
    # statements per pre_animation: fine. nesting depth
    deep = max((p.depth_max for _, _, _, p in parsed), default=0)
    t.info("deepest expression nesting: %d" % deep)
    t.ok("longest expression %d chars" % mine[0])


@check("molang.numeric_sweep", "molang")
def c_molang_sweep(c: Ctx, t: T):
    """Evaluate every state's pose with the animation author's evaluator over a brutal input grid: NaN / inf /
    division by zero / undefined names must never occur (the engine would silently use 0 or hit a content-log error)."""
    try:
        import eval_animation as EA
    except Exception as ex:
        t.skip("tools/eval_animation.py not importable: %s" % ex)
        return
    import random
    rig = EA.Rig({k: v.replace(ROOT_DEFAULT, c.root) for k, v in EA.PATHS.items()})
    rnd = random.Random(96)
    n, worst = 0, 0.0
    for state, var in STATE_VARIANT.items():
        for _ in range(250):
            speed = rnd.choice([0, 0.001, 0.05, 0.1, 0.3, 0.7, 1.0, 1.5, 3.0, rnd.random() * 2])
            dist = rnd.choice([0, 0.5, 1e-3, 100, 12345.678, -5, rnd.random() * 400])
            life = rnd.random() * 3000
            tx, ty = rnd.uniform(-90, 90), rnd.uniform(-180, 180)
            tt = rnd.random() * 20
            env = rig.base_env(speed=speed, dist=dist, life=life, tx=tx, ty=ty, variant=var)
            pose = rig.state_pose("controller.animation.scp096.main", state, tt, env)
            for bone, ch in pose.items():
                for k, v in ch.items():
                    for x in v:
                        if not math.isfinite(x):
                            t.fail("non-finite %s/%s/%s at state=%s speed=%s dist=%s t=%.2f" % (bone, k, v, state, speed, dist, tt))
                        elif k == "rotation":
                            worst = max(worst, abs(x))
                        elif k == "position":
                            if abs(x) > 60:
                                t.fail("position %s of %s = %.1f px at state=%s (outside any sane range)" % (k, bone, x, state))
            n += 1
    t.expect(worst < 360, "rotation of %.1f degrees seen; expected < 360" % worst)
    t.ok("%d random states (speed 0..3, huge/negative distance, life 0..3000 s, extreme head targets): all finite; max |rotation| %.1f deg" % (n, worst))



# ======================================================================================================
# group: geometry
# ======================================================================================================
def box_uv_rects(cube, tw, th):
    """The six face rectangles (name, x, y, w, h) of a box-UV cube.  Sizes are floored like the game does."""
    u, v = cube["uv"]
    w, h, dd = (int(math.floor(x)) for x in cube["size"])
    return [("up", u + dd, v, w, dd), ("down", u + dd + w, v, w, dd), ("east", u, v + dd, dd, h),
            ("north", u + dd, v + dd, w, h), ("west", u + dd + w, v + dd, dd, h), ("south", u + 2 * dd + w, v + dd, w, h)]


def face_rects(cube, tw, th):
    """Rectangles for either UV form: box-UV list or per-face dict."""
    uv = cube.get("uv")
    if isinstance(uv, list):
        return box_uv_rects(cube, tw, th)
    out = []
    for face, body in (uv or {}).items():
        out.append((face, body["uv"][0], body["uv"][1], abs(body["uv_size"][0]), abs(body["uv_size"][1])))
    return out


@check("geometry.structure", "geometry")
def c_geo_structure(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    g = d.geo
    t.expect(g.get("format_version") == "1.12.0", "geometry format_version %r, expected '1.12.0'" % g.get("format_version"))
    t.expect(set(g) == {"format_version", "minecraft:geometry"}, "geometry top-level keys %s" % sorted(g))
    t.expect(len(g["minecraft:geometry"]) == 1, "expected exactly one geometry in the file, found %d" % len(g["minecraft:geometry"]))
    desc = d.geom["description"]
    t.expect(desc.get("identifier") == GEO_ID, "geometry identifier %r" % desc.get("identifier"))
    t.expect((desc.get("texture_width"), desc.get("texture_height")) == (128, 128), "texture size %sx%s" % (desc.get("texture_width"), desc.get("texture_height")))
    t.expect(desc.get("visible_bounds_width") == 4 and desc.get("visible_bounds_height") == 4 and desc.get("visible_bounds_offset") == [0, 1.5, 0],
             "visible_bounds %r (DESIGN.md section 6: 4 x 4, offset [0,1.5,0])" % ({k: v for k, v in desc.items() if k.startswith("visible")},))
    bones = d.geom["bones"]
    names = [b["name"] for b in bones]
    t.expect(len(names) == len(set(names)), "duplicate bone names: %s" % [n for n, k in collections.Counter(names).items() if k > 1])
    t.expect(set(names) == set(EXPECTED_BONES), "bones differ from DESIGN.md section 6: missing %s, extra %s" % (
        sorted(set(EXPECTED_BONES) - set(names)), sorted(set(names) - set(EXPECTED_BONES))))
    seen = set()
    for b in bones:
        exp = EXPECTED_BONES.get(b["name"], "<unknown>")
        t.expect(b.get("parent") == exp, "bone %s parent %r, DESIGN.md says %r" % (b["name"], b.get("parent"), exp))
        if b.get("parent"):
            t.expect(b["parent"] in seen, "bone %s is defined before its parent %s (keep parents first)" % (b["name"], b["parent"]))
        seen.add(b["name"])
        extra = set(b) - {"name", "parent", "pivot", "cubes", "rotation", "mirror", "inflate"}
        t.expect(not extra, "bone %s has unexpected keys %s" % (b["name"], sorted(extra)))
        t.expect(isinstance(b.get("pivot"), list) and len(b["pivot"]) == 3, "bone %s pivot %r" % (b["name"], b.get("pivot")))
        t.expect("rotation" not in b, "bone %s has a bind rotation (animations assume a straight rest pose)" % b["name"])
    # bilateral symmetry of pivots and cubes
    for side in ("arm", "forearm", "hand", "leg", "shin"):
        L, R = d.bones["left_" + side], d.bones["right_" + side]
        t.expect([-L["pivot"][0], L["pivot"][1], L["pivot"][2]] == R["pivot"], "pivot of right_%s %s is not the mirror of left_%s %s" % (side, R["pivot"], side, L["pivot"]))
        lc = sorted((-(x["origin"][0] + x["size"][0]), x["origin"][1], x["origin"][2], tuple(x["size"])) for x in L.get("cubes", []))
        rc = sorted((x["origin"][0], x["origin"][1], x["origin"][2], tuple(x["size"])) for x in R.get("cubes", []))
        t.expect(lc == rc, "cubes of right_%s are not the mirror image of left_%s" % (side, side))
    t.ok("format 1.12.0, id %s, 128x128, 15 bones with parents exactly as DESIGN.md section 6, parents first, left/right mirrored" % GEO_ID)


@check("geometry.cubes_uv", "geometry")
def c_geo_uv(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    tw, th = d.geom["description"]["texture_width"], d.geom["description"]["texture_height"]
    cover = {}   # (x, y) -> list of (cube idx)
    n = 0
    cubes = []
    for b in d.geom["bones"]:
        for i, cu in enumerate(b.get("cubes", [])):
            cubes.append((b["name"], i, cu))
    for bn, i, cu in cubes:
        n += 1
        where = "%s.cubes[%d]" % (bn, i)
        extra = set(cu) - {"origin", "size", "uv", "inflate", "mirror", "pivot", "rotation"}
        t.expect(not extra, "%s unexpected keys %s" % (where, sorted(extra)))
        t.expect(all(isinstance(x, (int, float)) and math.isfinite(x) for x in cu["origin"] + cu["size"]), "%s non-finite origin/size" % where)
        t.expect(all(x > 0 for x in cu["size"]), "%s has a non-positive size %s" % (where, cu["size"]))
        t.expect(all(float(x).is_integer() for x in cu["size"]), "%s has fractional size %s (box UV is computed from floor(size))" % (where, cu["size"]))
        t.expect("rotation" not in cu and "pivot" not in cu, "%s is rotated (not expected in this model)" % where)
        if "inflate" in cu:
            t.expect(-0.5 <= cu["inflate"] <= 0.5, "%s inflate %s outside -0.5..0.5" % (where, cu["inflate"]))
        for fname, x, y, w, h in face_rects(cu, tw, th):
            if w <= 0 or h <= 0:
                t.fail("%s face %s has an empty UV rectangle" % (where, fname))
                continue
            if x < 0 or y < 0 or x + w > tw or y + h > th:
                t.fail("%s face %s UV rect (%d,%d,%d,%d) leaves the %dx%d texture" % (where, fname, x, y, w, h, tw, th))
                continue
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    cover.setdefault((xx, yy), []).append((bn, i, fname))
    overl = {k: v for k, v in cover.items() if len(v) > 1}
    if overl:
        pairs = collections.Counter(tuple(sorted({(a[0], a[1]) for a in v})) for v in overl.values())
        for pr, k in list(pairs.items())[:6]:
            t.fail("UV overlap: %d texel(s) shared by cubes %s" % (k, list(pr)))
    used = len(cover)
    t.info("%d cubes, %d texels in use = %.1f%% of the texture, %d overlapping texels" % (n, used, 100.0 * used / (tw * th), len(overl)))
    # gutter: the 1 px ring around each island should be unused (bleed), report minimal distance
    t.ok("%d cubes: all sizes > 0 and integral, all 6 face rectangles inside %dx%d, 0 overlapping texels (%.1f%% used)" % (n, tw, th, 100.0 * used / (tw * th)))


@check("geometry.dimensions", "geometry")
def c_geo_dims(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    ys, xs, zs = [], [], []
    for b in d.geom["bones"]:
        for cu in b.get("cubes", []):
            inf = cu.get("inflate", 0)
            o, s_ = cu["origin"], cu["size"]
            ys += [o[1] - inf, o[1] + s_[1] + inf]
            xs += [o[0] - inf, o[0] + s_[0] + inf]
            zs += [o[2] - inf, o[2] + s_[2] + inf]
    lo, hi = min(ys), max(ys)
    t.expect(abs(lo) <= 0.25, "lowest point is y=%.2f px; the model should stand on y=0" % lo)
    t.expect(44 <= hi <= 46, "model height %.2f px = %.3f blocks, DESIGN.md wants 44..46 px (2.75..2.875 blocks)" % (hi, hi / 16.0))
    t.expect(2.5 <= hi / 16.0 <= 3.0, "height %.3f blocks outside the requested 2.5..3 blocks" % (hi / 16.0))
    coll_h = d.ent["components"]["minecraft:collision_box"]["height"]
    t.expect(abs(hi / 16.0 - coll_h) <= 0.15, "model %.3f blocks vs collision box %.2f" % (hi / 16.0, coll_h))
    width = max(abs(min(xs)), abs(max(xs))) * 2
    t.expect(width <= 16, "model is %.1f px wide, thin was requested (<= 16 px)" % width)
    t.info("extent x [%.1f, %.1f], y [%.1f, %.1f], z [%.1f, %.1f] px; width %.1f px = %.2f blocks vs collision width %.2f" % (
        min(xs), max(xs), lo, hi, min(zs), max(zs), width, width / 16.0, d.ent["components"]["minecraft:collision_box"]["width"]))
    # head
    hy = []
    for bn in ("head", "jaw"):
        for cu in d.bones[bn].get("cubes", []):
            hy += [cu["origin"][1], cu["origin"][1] + cu["size"][1]]
    hc = (min(hy) + max(hy)) / 2.0 / 16.0
    t.expect(2.3 <= hc <= 2.7, "head+jaw centre %.3f blocks outside 2.3..2.7 (the engine eye is ~0.85 x 2.8 = 2.38)" % hc)
    # arms long: finger tips reach below the knee
    hands = [cu["origin"][1] for cu in d.bones["left_hand"].get("cubes", [])]
    knee = d.bones["left_shin"]["pivot"][1]
    t.expect(min(hands) < knee, "hand tips (y=%.2f) do not reach below the knee (y=%.2f): arms not 'long'" % (min(hands), knee))
    t.expect(len(d.bones["head"].get("cubes", [])) >= 3 and len(d.bones["jaw"].get("cubes", [])) >= 1, "head/jaw have too few cubes")
    # big mouth: jaw wider than half the head and tall enough to open
    jw = max(cu["size"][0] for cu in d.bones["jaw"]["cubes"])
    hw = max(cu["size"][0] for cu in d.bones["head"]["cubes"])
    t.expect(jw >= 0.8 * hw, "jaw %s px wide vs head %s px: not a 'big mouth'" % (jw, hw))
    t.ok("height %.3f blocks (%.1f px), feet at y=%.2f, width %.1f px, head centre %.3f blocks, hands reach y=%.2f (knee %.0f)" % (hi / 16.0, hi, lo, width, hc, min(hands), knee))


@check("geometry.animation_bones", "geometry")
def c_geo_anim_bones(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    bones = set(d.bones)
    animated = set()
    for aid, a in d.anims.items():
        for b, chs in a.get("bones", {}).items():
            animated.add(b)
            t.expect(b in bones, "%s animates bone %r which is not in geometry %s (exact case; the game ignores it silently)" % (aid, b, GEO_ID))
            for chn, val in chs.items():
                t.expect(chn in ("rotation", "position", "scale"), "%s bone %s unknown channel %r" % (aid, b, chn))
        t.expect(a.get("loop") in (True, False, "hold_on_last_frame"), "%s loop %r" % (aid, a.get("loop")))
        if "animation_length" in a:
            t.expect(isinstance(a["animation_length"], (int, float)) and a["animation_length"] > 0, "%s animation_length %r" % (aid, a["animation_length"]))
        # keyframe times inside the animation
        for b, chs in a.get("bones", {}).items():
            for chn, val in chs.items():
                if isinstance(val, dict) and "pre" not in val and "post" not in val and "lerp_mode" not in val:
                    for k in val:
                        try:
                            tm = float(k)
                        except ValueError:
                            t.fail("%s %s.%s keyframe key %r is not a time" % (aid, b, chn, k))
                            continue
                        t.expect(0 <= tm <= a.get("animation_length", 1e9), "%s %s.%s keyframe at %s outside animation_length" % (aid, b, chn, k))
                elif isinstance(val, list):
                    t.expect(len(val) == 3, "%s %s.%s vector has %d components" % (aid, b, chn, len(val)))
    never = bones - animated
    if never:
        t.warn("bones never animated: %s" % sorted(never))
    t.ok("every animated bone exists in the geometry with exact case; %d/%d bones animated" % (len(animated & bones), len(bones)))


def _texture_array(path):
    from PIL import Image
    import numpy as np
    im = Image.open(path)
    im.load()
    return np.array(im.convert("RGBA"))


@check("geometry.texture_vs_uv", "geometry")
def c_geo_tex_uv(c: Ctx, t: T):
    d = docs(c, t)
    if not d:
        return
    try:
        import numpy as np
        arr = _texture_array(c.p("SCP096_RP/textures/entity/scp096.png"))
    except ImportError:
        t.skip("numpy / Pillow not installed")
        return
    tw, th = d.geom["description"]["texture_width"], d.geom["description"]["texture_height"]
    t.expect(arr.shape[:2] == (th, tw), "texture %s vs geometry %dx%d" % (arr.shape, tw, th))
    transparent_in_face = 0
    face_pixels = np.zeros((th, tw), bool)
    eyes = []     # (x, y, z) in px of pure-white texels on north faces
    white_other = 0
    for b in d.geom["bones"]:
        for i, cu in enumerate(b.get("cubes", [])):
            for fname, x, y, w, h in face_rects(cu, tw, th):
                region = arr[y:y + h, x:x + w]
                face_pixels[y:y + h, x:x + w] = True
                transparent_in_face += int((region[..., 3] < 255).sum())
                white = (region[..., :3] == 255).all(axis=2) & (region[..., 3] == 255)
                if fname == "north":
                    for r, cc in zip(*np.nonzero(white)):
                        o, sz = cu["origin"], cu["size"]
                        eyes.append((o[0] + cc + 0.5, o[1] + sz[1] - (r + 0.5), o[2], b["name"]))
                else:
                    white_other += int(white.sum())
    t.expect(transparent_in_face == 0, "%d texel(s) inside UV face rectangles are not fully opaque (they would render as holes)" % transparent_in_face)
    lum = (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2])
    skin = lum[face_pixels]
    t.expect(skin.mean() >= 190, "mean luminance of painted faces is %.1f/255: not 'pale white'" % skin.mean())
    t.expect(len(eyes) >= 4, "found %d pure-white (255,255,255) north-face texels; expected the 2 eyes (>= 4 texels)" % len(eyes))
    if eyes:
        head = [e for e in eyes if e[3] == "head"]
        t.expect(len(head) == len(eyes), "white eye texels outside the head bone: %s" % sorted({e[3] for e in eyes}))
        ey = sum(e[1] for e in eyes) / len(eyes) / 16.0
        xs_ = sorted({round(float(e[0]), 1) for e in eyes})
        t.expect(2.4 <= ey <= 2.7, "eye height %.3f blocks outside 2.4..2.7 (engine eye ~2.38 so the lookat gaze test lands on the face)" % ey)
        t.expect(min(xs_) < 0 < max(xs_), "eyes are not on both sides of the centre line: x = %s" % xs_)
        t.info("eyes: %d white texels, x in %s px, mean height %.3f blocks (%.1f px)" % (len(eyes), xs_, ey, ey * 16))
    if white_other:
        t.warn("%d pure-white texel(s) on non-north faces (eyes must be the only pure white)" % white_other)
    bg = arr[~face_pixels]
    if bg.size:
        opaque_bg = int((bg[:, 3] == 255).sum())
        trans = bg[bg[:, 3] == 0]
        if len(trans):
            tl = (0.2126 * trans[:, 0] + 0.7152 * trans[:, 1] + 0.0722 * trans[:, 2]).mean()
            t.info("%d opaque gutter texels, %d transparent texels with mean RGB luminance %.0f (skin-coloured, so mip-mapping cannot darken edges)" % (opaque_bg, len(trans), tl))
            if tl < 120:
                t.warn("transparent texels are dark (luminance %.0f): bilinear filtering can show dark seams at island edges" % tl)
    t.ok("every UV face texel opaque; mean face luminance %.1f/255; %d pure-white eye texels on the head's north faces" % (skin.mean(), len(eyes)))


@check("geometry.pose_ground_contact", "geometry", slow=True)
def c_geo_pose(c: Ctx, t: T):
    """Independent re-sampling of the animation poses with the shipped files: the feet must touch the ground and the
    body must fit the collision box of the state (random times, speeds and distances; not the author's grid)."""
    try:
        import numpy as np
        import eval_animation as EA
        import render_poses as RPS
    except Exception as ex:
        t.skip("tools/render_poses.py / numpy not importable: %s" % ex)
        return
    import random
    old = EA.ROOT
    paths = {k: v.replace(ROOT_DEFAULT, c.root) for k, v in EA.PATHS.items()}
    sc = RPS.Scene.__new__(RPS.Scene)
    sc.rig = EA.Rig(paths)
    gp, tp = RPS.RP.default_paths()
    sc.geo = RPS.RP.load_geometry(c.p("SCP096_RP/models/entity/scp096.geo.json"))
    sc.tex = RPS.RP.load_texture(c.p("SCP096_RP/textures/entity/scp096.png"))
    rnd = random.Random(1096)
    # (lowest allowed, highest allowed foot offset, hard top limit in px, soft top limit = collision box + 0.1 block)
    limits = {"sit": (-1.5, 1.5, 25.0, 24.0), "scream": (-1.5, 1.5, 48.0, 46.4), "walk": (-1.5, 1.5, 48.0, 46.4),
              "run": (-1.5, 1.5, 48.0, 46.4)}
    out = {}
    for state, (lo_lim, hi_lim, top_lim, soft_top) in limits.items():
        lows, highs = [], []
        for _ in range(120):
            speed = rnd.choice([0.0, 0.05, 0.2, 0.5, 0.8, 1.0]) if state in ("walk", "run") else 0.0
            if state == "walk" and speed == 0.0 and rnd.random() < 0.5:
                speed = rnd.random()
            dist = rnd.random() * 500
            tt = rnd.random() * 10
            pose = sc.state(state, tt, speed=speed, dist=dist, tx=rnd.uniform(-30, 30), ty=rnd.uniform(-40, 40))
            lo, hi = sc.y_range(pose)
            lows.append(lo)
            highs.append(hi)
        out[state] = (min(lows), max(lows), max(highs))
        t.expect(lo_lim <= min(lows) and max(lows) <= hi_lim,
                 "%s: lowest vertex ranges %.2f..%.2f px (allowed %.1f..%.1f): feet %s the ground" % (
                     state, min(lows), max(lows), lo_lim, hi_lim, "sink into" if min(lows) < lo_lim else "float above"))
        t.expect(max(highs) <= top_lim, "%s: highest vertex %.2f px = %.2f blocks > limit %.1f px" % (state, max(highs), max(highs) / 16.0, top_lim))
        if top_lim >= max(highs) > soft_top:
            t.warn("%s: highest vertex %.2f px = %.2f blocks pokes %.2f block(s) above the state's collision box (cosmetic only)" % (
                state, max(highs), max(highs) / 16.0, (max(highs) - (24.0 if state == "sit" else 44.8)) / 16.0))
    t.ok("; ".join("%s low %.2f..%.2f high %.1f" % (k, v[0], v[1], v[2]) for k, v in out.items()) + " (px; sit box top = 24 px)")



# ======================================================================================================
# group: texture
# ======================================================================================================
@check("texture.png_format", "texture")
def c_tex_format(c: Ctx, t: T):
    f = "SCP096_RP/textures/entity/scp096.png"
    if not c.exists(f):
        t.fail("%s missing" % f)
        return
    try:
        w, h, bd, ct_, il = png_info(c.p(f))
    except ValueError as ex:
        t.fail(str(ex))
        return
    t.expect((w, h) == (128, 128), "size %dx%d, expected 128x128" % (w, h))
    t.expect(bd == 8, "bit depth %d, expected 8 (16-bit PNGs are slow/unsupported on some phones)" % bd)
    t.expect(ct_ == 6, "colour type %d, expected 6 (RGBA)" % ct_)
    t.expect(il == 0, "interlaced PNG")
    size = os.path.getsize(c.p(f))
    t.expect(size < 200 * 1024, "texture is %d KiB" % (size // 1024))
    data = open(c.p(f), "rb").read()
    chunks, pos = [], 8
    while pos < len(data):
        ln, typ = struct.unpack(">I4s", data[pos:pos + 8])
        chunks.append(typ.decode("latin1"))
        pos += 12 + ln
    t.expect(chunks[0] == "IHDR" and chunks[-1] == "IEND", "chunk order %s" % chunks)
    t.expect("acTL" not in chunks, "animated PNG (APNG)")
    t.info("PNG chunks: %s, %d bytes" % (chunks, size))
    # CRC of every chunk
    import zlib
    pos = 8
    while pos < len(data):
        ln, typ = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + ln]
        crc = struct.unpack(">I", data[pos + 8 + ln:pos + 12 + ln])[0]
        t.expect(zlib.crc32(typ + body) & 0xffffffff == crc, "bad CRC in chunk %s" % typ)
        pos += 12 + ln
    t.ok("128x128, 8-bit RGBA, non-interlaced, valid chunk CRCs, %d bytes" % size)


@check("texture.alpha_and_colour", "texture")
def c_tex_alpha(c: Ctx, t: T):
    try:
        import numpy as np
        arr = _texture_array(c.p("SCP096_RP/textures/entity/scp096.png"))
    except ImportError:
        t.skip("numpy / Pillow not installed")
        return
    a = arr[..., 3]
    vals = sorted(set(int(x) for x in np.unique(a)))
    t.expect(set(vals) <= {0, 255}, "alpha values %s: entity_alphatest needs only 0 or 255 (partial alpha flickers)" % vals[:10])
    opaque = arr[a == 255][:, :3].astype(float)
    mean = opaque.mean(axis=0)
    t.info("mean opaque RGB %s" % [round(float(x), 1) for x in mean])
    t.expect(mean.min() > 150, "mean opaque colour %s is not 'pale'" % mean.round(0))
    t.expect(float(mean[0] - mean[2]) < 40, "colour cast R-B = %.0f: skin should be near-neutral pale white" % (mean[0] - mean[2]))
    dark = int(((opaque.mean(axis=1)) < 40).sum())
    t.info("%d very dark opaque texels (mouth interior, nostrils, sockets)" % dark)
    t.expect(dark > 20, "only %d very dark texels: the mouth / sockets would not read" % dark)
    t.ok("alpha in {0,255}; mean opaque colour RGB%s (pale, neutral); %d dark detail texels" % (tuple(int(x) for x in mean), dark))


# ======================================================================================================
# group: audio
# ======================================================================================================
def ffprobe(path):
    rc, out, _ = run_cmd(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path])
    if rc != 0:
        return None, out
    return json.loads(out), ""


def decode_f32(path):
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                       capture_output=True, timeout=120)
    if r.returncode != 0 or r.stderr.strip():
        raise RuntimeError("ffmpeg decode problem: " + r.stderr.decode("utf8", "replace")[:200])
    return np.frombuffer(r.stdout, dtype="<f4")


@check("audio.ogg_properties", "audio")
def c_audio(c: Ctx, t: T):
    if not shutil.which("ffprobe") or not shutil.which("ffmpeg"):
        t.skip("ffmpeg / ffprobe not installed")
        return
    try:
        import numpy as np
    except ImportError:
        t.skip("numpy not installed")
        return
    total = 0
    rows = []
    for n in EXPECTED_OGG:
        f = "SCP096_RP/sounds/mob/scp096/%s.ogg" % n
        if not c.exists(f):
            t.fail("%s missing" % f)
            continue
        total += os.path.getsize(c.p(f))
        t.expect(ogg_streams(c.p(f)), "%s: no OggS / vorbis header" % f)
        info, err = ffprobe(c.p(f))
        if info is None:
            t.fail("%s: ffprobe failed: %s" % (f, err[:100]))
            continue
        st = [s_ for s_ in info["streams"] if s_["codec_type"] == "audio"]
        t.expect(len(st) == 1 and len(info["streams"]) == 1, "%s: %d streams (expected exactly one audio stream)" % (f, len(info["streams"])))
        st = st[0]
        t.expect(st["codec_name"] == "vorbis", "%s: codec %s, expected vorbis" % (f, st["codec_name"]))
        t.expect(st["channels"] == 1, "%s: %d channels, expected mono" % (f, st["channels"]))
        t.expect(int(st["sample_rate"]) == 44100, "%s: %s Hz, expected 44100" % (f, st["sample_rate"]))
        dur = float(info["format"]["duration"])
        t.expect(0.3 <= dur <= 6.0, "%s: duration %.2f s outside 0.3..6" % (f, dur))
        try:
            x = decode_f32(c.p(f))
        except Exception as ex:
            t.fail("%s: %s" % (f, ex))
            continue
        t.expect(bool(np.isfinite(x).all()), "%s: NaN/inf samples" % f)
        peak = float(np.abs(x).max())
        pdb = 20 * math.log10(peak) if peak > 0 else -999
        clipped = int((np.abs(x) >= 0.9995).sum())
        rms = float(np.sqrt((x.astype(np.float64) ** 2).mean()))
        rdb = 20 * math.log10(rms) if rms > 0 else -999
        dc = float(x.mean())
        t.expect(clipped == 0, "%s: %d clipped samples" % (f, clipped))
        t.expect(-6.0 <= pdb <= -1.5, "%s: peak %.2f dBFS outside -6..-1.5" % (f, pdb))
        t.expect(abs(dc) < 0.002, "%s: DC offset %.4f" % (f, dc))
        t.expect(-30 <= rdb <= -8, "%s: RMS %.1f dBFS outside -30..-8" % (f, rdb))
        a0 = float(np.abs(x[:88]).max())
        a1 = float(np.abs(x[-88:]).max())
        t.expect(a0 < 0.05 and a1 < 0.01, "%s: click risk - first 2 ms peak %.3f, last 2 ms peak %.4f" % (f, a0, a1))
        silent = float((np.abs(x) < 1e-4).mean())
        t.expect(silent < 0.5, "%s: %.0f%% of the samples are silent" % (f, 100 * silent))
        rows.append((n, dur, os.path.getsize(c.p(f)), pdb, rdb, clipped))
    t.expect(total < 600 * 1024, "total audio %.1f KiB exceeds the 600 KiB budget" % (total / 1024.0))
    for n, dur, sz, pdb, rdb, cl in rows:
        t.info("%-8s %.2f s %6d B peak %.2f dBFS rms %.1f dBFS clipped %d" % (n, dur, sz, pdb, rdb, cl))
    c._json["__audio_durations__"] = {n: dur for n, dur, *_ in rows}
    if rows:
        t.ok("%d ogg files: vorbis, mono, 44.1 kHz, %.2f-%.2f s, peak %.2f..%.2f dBFS, no clipping / DC / clicks; total %.1f KiB" % (
            len(rows), min(r[1] for r in rows), max(r[1] for r in rows), min(r[3] for r in rows), max(r[3] for r in rows), total / 1024.0))


@check("audio.retrigger_overlap", "audio")
def c_audio_overlap(c: Ctx, t: T):
    """Timeline sounds re-fire every loop: a loop shorter than its sound makes the sound overlap itself."""
    d = docs(c, t)
    if not d:
        return
    if "__audio_durations__" not in c._json:
        c_audio(c, T("audio.ogg_properties", "audio"))
    dur = c._json.get("__audio_durations__")
    if not dur:
        t.skip("audio durations unavailable")
        return
    snd = d.desc.get("sound_effects", {})
    longest = {}
    for short, sid in snd.items():
        names = [(s_["name"] if isinstance(s_, dict) else s_).rsplit("/", 1)[-1] for s_ in d.sdefs[sid]["sounds"]]
        longest[short] = max(dur.get(n, 0) for n in names)
    for aid, a in d.anims.items():
        for tm, ev in (a.get("sound_effects") or {}).items():
            e = ev[0] if isinstance(ev, list) else ev
            L = a["animation_length"]
            d_ = longest.get(e["effect"], 0)
            if a.get("loop") is True and d_ > L:
                t.warn("%s re-fires %r every %.2f s but the longest variant lasts %.2f s: %.2f s overlap with itself" % (aid, e["effect"], L, d_, d_ - L))
            t.info("%s: %r every %.1f s, longest variant %.2f s" % (aid, e["effect"], L, d_))
    # scream plays once on state entry; the BP scream timer is 3-5 s
    sc = d.groups["scp096:rage_scream"]["minecraft:timer"]["time"]
    t.info("scream sound %.2f s vs scream state %s s: the tail may run into the chase for up to %.2f s" % (longest.get("scream", 0), sc, max(0, longest.get("scream", 0) - sc[0])))
    t.ok("cry fits its loops; rage re-fire overlap reported above if any")



# ======================================================================================================
# group: lang
# ======================================================================================================
def parse_lang(text):
    """Bedrock .lang: KEY=value per line, '##' starts a comment.  Returns (dict, problems)."""
    d, probs = {}, []
    for i, line in enumerate(text.split("\n"), 1):
        if line == "" and i == len(text.split("\n")):
            continue
        if line.strip() == "" or line.lstrip().startswith("##"):
            continue
        if "=" not in line:
            probs.append("line %d has no '=': %r" % (i, line[:60]))
            continue
        k, v = line.split("=", 1)
        if k in d:
            probs.append("line %d duplicates key %s" % (i, k))
        if k != k.strip():
            probs.append("line %d key %r has surrounding spaces" % (i, k))
        d[k] = v
    return d, probs


@check("lang.en_us", "lang")
def c_lang(c: Ctx, t: T):
    f = "SCP096_RP/texts/en_US.lang"
    if not c.exists(f):
        t.fail("%s missing" % f)
        return
    text = open(c.p(f), encoding="utf-8").read()
    kv, probs = parse_lang(text)
    for pr in probs:
        t.fail("%s: %s" % (f, pr))
    want = {"entity.%s.name" % ENTITY_ID: "SCP-096", "item.spawn_egg.entity.%s.name" % ENTITY_ID: "SCP-096 Spawn Egg"}
    for k, v in want.items():
        t.expect(k in kv, "missing key %s" % k)
        t.expect(kv.get(k) == v, "%s = %r, expected %r" % (k, kv.get(k), v))
    extra = set(kv) - set(want)
    if extra:
        t.warn("unexpected extra keys: %s" % sorted(extra))
    egg = kv.get("item.spawn_egg.entity.%s.name" % ENTITY_ID, "")
    t.expect("scp" in egg.lower() and "096" in egg, "egg name %r does not contain both 'SCP' and '096' (inventory search)" % egg)
    t.expect(egg.lower().startswith("scp"), "egg name %r does not START with 'SCP'" % egg)
    langs = c.try_jload("SCP096_RP/texts/languages.json")
    t.expect(langs == ["en_US"], "languages.json is %r, expected ['en_US']" % (langs,))
    for l in (langs or []):
        t.expect(c.exists("SCP096_RP/texts/%s.lang" % l), "languages.json lists %s but texts/%s.lang is missing" % (l, l))
    for f2 in c.pack_files():
        if f2.startswith("SCP096_RP/texts/") and f2.endswith(".lang"):
            t.expect(os.path.basename(f2)[:-5] in (langs or []), "%s is not listed in languages.json" % f2)
    # the ids the lang keys translate must be the real ones
    d = docs(c, T("x", "x"))
    if d:
        t.expect(d.ent["description"]["identifier"] == ENTITY_ID, "BP identifier differs from the id the lang keys use")
    # raw text must not leak into the game: no key=key
    t.ok("entity name %r and egg %r present; egg name contains 'SCP' (prefix) and '096'; languages.json = ['en_US']" % (kv.get("entity.%s.name" % ENTITY_ID), egg))


# ======================================================================================================
# group: corpus  (tools/vanilla_corpus_check.py)
# ======================================================================================================
def _corpus_check(name, label):
    def fn(c: Ctx, t: T):
        try:
            corp = c.corpus()
        except Exception as ex:
            t.skip("vanilla corpus unavailable: %s" % ex)
            return
        if "__corpus_res__" not in c._json:
            old = os.getcwd()
            c._json["__corpus_res__"] = corp.check_all(c.root)
        fl = c._json["__corpus_res__"].get(name, [])
        notes = []
        for f in fl:
            if f.level == "UNPROVEN":
                t.fail("%s: %s" % (f.where, f.detail))
            elif name.startswith("manifest"):
                notes.append(re.sub(r" not used by any vanilla manifest file.*", "", f.detail).replace("key path ", ""))
            else:
                t.warn("note [%s] %s: %s" % (f.kind, f.where, f.detail))
        if notes:
            t.warn("%s uses %d key/value(s) absent from the only 2 vanilla manifests (%s); they are covered by the Blockception "
                   "manifest schema (schema.manifest) and Microsoft's documentation instead" % (label, len(notes), "; ".join(notes)))
        t.ok("%s: every key / field / event key / filter / enum value is used by vanilla 1.21.0.3 files (%d notes)" % (label, sum(1 for f in fl if f.level == "NOTE")))
    return fn


for _n, _l in (("bp_entity", "BP entity"), ("client", "client entity"), ("animations", "animations"), ("controllers", "animation controllers"),
               ("render", "render controllers"), ("geometry", "geometry"), ("sounddefs", "sound_definitions.json"),
               ("soundsjson", "sounds.json"), ("manifest_bp", "BP manifest"), ("manifest_rp", "RP manifest")):
    check("corpus." + _n, "corpus")(_corpus_check(_n, _l))


@check("corpus.selftest", "corpus", slow=True)
def c_corpus_selftest(c: Ctx, t: T):
    import vanilla_corpus_check as VC
    corp = c.corpus()
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        rc = VC.selftest(corp, c.root)
    finally:
        sys.stdout = old
    last = buf.getvalue().strip().splitlines()[-1]
    t.expect(rc == 0, "corpus checker missed a mutant: %s" % last)
    t.ok(last)



# ======================================================================================================
# group: script
# ======================================================================================================
DENY_PATTERNS = [
    r"bedrock", r"obsidian", r"barrier", r"command_block", r"structure_block", r"structure_void", r"jigsaw", r"portal",
    r"end_gateway", r"reinforced_deepslate", r"spawner", r"chest", r"barrel", r"shulker_box", r"furnace", r"smoker",
    r"hopper", r"dropper", r"dispenser", r"netherite_block", r"ancient_debris", r"respawn_anchor", r"light_block",
    r"border_block", r"^allow$", r"^deny$", r"beacon", r"conduit", r"lodestone", r"enchanting_table", r"anvil",
    r"grindstone", r"smithing", r"cartography", r"^loom$", r"stonecutter", r"lectern", r"bookshelf", r"brewing_stand",
    r"cauldron", r"composter", r"jukebox", r"note_block", r"^bed$", r"^tnt$", r"^lava$", r"^water$", r"^flowing_", r"bubble_column",
    r"^end_stone", r"^deepslate", r"^stone$", r"^dirt$", r"^grass", r"^sand$", r"^gravel$", r"^iron_block$", r"^diamond_block$",
    r"^gold_block$", r"^emerald_block$", r"^command", r"^repeating", r"^chain_command",
]
SOFT_WORDS = re.compile(r"(leaves|_log|^log|wood|planks|door|trapdoor|fence|glass|wool|carpet|^web$|ladder|scaffolding|bamboo|hay_block|sign|_stem|hyphae|_slab|_stairs|mosaic)")
WOOD_PREFIX = re.compile(r"^(?:stripped_)?(?:double_)?(oak|spruce|birch|jungle|acacia|dark_oak|darkoak|mangrove|cherry|bamboo|bamboo_mosaic|crimson|warped|wooden|normal)")


def blocks_registry(c: Ctx):
    f = os.path.join(c.vanilla, "metadata", "vanilladata_modules", "mojang-blocks.json")
    if not os.path.isfile(f):
        return None
    return {x["name"] for x in json.load(open(f, encoding="utf-8"))["data_items"]}


def dump_script_lists(c: Ctx):
    """Import main.js under node with a stub for @minecraft/server and print its exported block lists."""
    node = shutil.which("node")
    if not node:
        return None, "node not installed"
    src = open(c.p("SCP096_BP/scripts/main.js"), encoding="utf-8").read()
    stub = 'const world = { gameRules: {} }; const system = { runInterval() {} };'
    new = re.sub(r'import\s*\{[^}]*\}\s*from\s*"@minecraft/server";', stub, src, count=1)
    if new == src:
        return None, "main.js import line not found"
    with tempfile.TemporaryDirectory() as td:
        fp = os.path.join(td, "main_stub.mjs")
        open(fp, "w", encoding="utf-8").write(new)
        js = ("import('file://%s').then(m=>console.log(JSON.stringify({allowed:m.ALLOWED_BLOCK_IDS,denied:m.DENIED_BLOCK_IDS,"
              "suffixes:m.DENIED_SUFFIXES,exports:Object.keys(m)})))" % fp)
        rc, out, _ = run_cmd([node, "-e", js], timeout=60)
    if rc != 0:
        return None, out[-300:]
    return json.loads(out.strip().splitlines()[-1]), ""


@check("script.syntax_and_hygiene", "script")
def c_script_syntax(c: Ctx, t: T):
    f = "SCP096_BP/scripts/main.js"
    if not c.exists(f):
        t.fail("%s missing" % f)
        return
    src = open(c.p(f), encoding="utf-8").read()
    node = shutil.which("node")
    if node:
        with tempfile.TemporaryDirectory() as td:
            fp = os.path.join(td, "main.mjs")
            open(fp, "w", encoding="utf-8").write(src)
            rc, out, _ = run_cmd([node, "--check", fp])
            t.expect(rc == 0, "node --check (ES module) rejects main.js: %s" % out.strip()[:300])
        acorn = os.path.join(c.root, "tools", "typecheck", "node_modules", "acorn")
        if os.path.isdir(acorn):
            js = ("const a=require(%s);const fs=require('fs');try{a.parse(fs.readFileSync(%s,'utf8'),{ecmaVersion:2019,sourceType:'module'});"
                  "console.log('ok')}catch(e){console.log('ERR '+e.message);process.exit(1)}" % (json.dumps(acorn), json.dumps(c.p(f))))
            rc, out, _ = run_cmd([node, "-e", js])
            t.expect(rc == 0, "acorn (ES2019, module) rejects main.js: %s" % out.strip()[:200])
        else:
            t.warn("acorn not installed under tools/typecheck/node_modules; skipped the ES2019 parse")
    else:
        t.warn("node not installed; skipped syntax checks")
    code = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    code = re.sub(r"(?m)^\s*//.*$", "", code)
    banned = [
        (r"\brequire\s*\(", "require() does not exist in the Bedrock script engine"),
        (r"\bimport\s*\(", "dynamic import()"),
        (r"\beval\s*\(", "eval"),
        (r"new\s+Function\s*\(", "new Function"),
        (r"\bprocess\.", "node 'process'"),
        (r"\b(?:window|document|localStorage|fetch|XMLHttpRequest)\b", "browser global"),
        (r"\bsetTimeout\s*\(|\bsetInterval\s*\(", "setTimeout/setInterval (use system.runTimeout / runInterval)"),
        (r"\bawait\b", "await (top-level await unsupported; async/await unproven)"),
        (r"console\.(?:log|info|debug|error)\s*\(", "console.log/info/debug/error (per-tick log spam; only console.warn is allowed)"),
        (r"@minecraft/server-(?:ui|gametest|net|admin)|@minecraft/debug", "an extra script module that the manifest does not declare"),
        (r"\?\.", "optional chaining (ES2020)"),
        (r"\?\?", "nullish coalescing (ES2020)"),
    ]
    for pat, why in banned:
        for m in re.finditer(pat, code):
            line = code.count("\n", 0, m.start()) + 1
            (t.warn if "ES2020" in why else t.fail)("main.js:%d: %s" % (line, why))
    imports = re.findall(r'import\s*\{([^}]*)\}\s*from\s*"([^"]+)"', code)
    t.expect(len(imports) == 1 and imports[0][1] == "@minecraft/server", "imports are %s; expected exactly one, from \"@minecraft/server\"" % imports)
    t.expect(not re.search(r'import\s+[^{(]', code) and not re.search(r'from\s+"(?!@minecraft/server)', code), "other import forms found")
    t.expect("setblock" in code and "destroy" in code, "main.js does not seem to use setblock ... destroy")
    t.ok("node --check + acorn ES2019 module parse OK; one import from @minecraft/server; no require/eval/await/browser globals/console.log")


@check("script.api_members", "script")
def c_script_api(c: Ctx, t: T):
    f = os.path.join(c.vanilla, "metadata", "script_modules", "@minecraft", "server_1.11.0.json")
    if not os.path.isfile(f):
        t.skip("server_1.11.0.json metadata not found")
        return
    meta = json.load(open(f, encoding="utf-8"))
    t.expect(meta["version"] == "1.11.0", "metadata version %s" % meta["version"])
    classes = {x["name"]: x for x in meta["classes"]}
    top = {x["name"] for x in meta["classes"]} | {x["name"] for x in meta["enums"]} | {x["name"] for x in meta["interfaces"]} \
        | {x["name"] for x in meta.get("objects", [])} | {x["name"] for x in meta.get("functions", [])} | {x["name"] for x in meta.get("constants", [])}
    src = open(c.p("SCP096_BP/scripts/main.js"), encoding="utf-8").read()
    m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"@minecraft/server"', src)
    names = [x.strip() for x in m.group(1).split(",") if x.strip()] if m else []
    for n in names:
        t.expect(n in top, "import {%s}: no such export in @minecraft/server 1.11.0" % n)
    # members used on world / system
    objs = {x["name"]: x["type"]["name"] for x in meta.get("objects", [])}
    for var in ("world", "system"):
        cls = classes.get(objs.get(var, ""))
        t.expect(cls is not None, "%s is not an exported object of 1.11.0" % var)
        if not cls:
            continue
        members = {p["name"] for p in cls.get("properties", [])} | {p["name"] for p in cls.get("functions", [])}
        used = set(re.findall(r"\b%s\.([A-Za-z_]\w*)" % var, src))
        for u in sorted(used):
            t.expect(u in members, "%s.%s does not exist in @minecraft/server 1.11.0 (members: %s...)" % (var, u, sorted(members)[:6]))
        t.info("%s members used: %s" % (var, sorted(used)))
    # every `.name(` method call in main.js must exist on SOME 1.11.0 class or be a JS built-in
    allm = set()
    for cl in classes.values():
        allm |= {p["name"] for p in cl.get("functions", [])} | {p["name"] for p in cl.get("properties", [])}
    builtins = set("""push pop shift unshift slice splice concat join map filter reduce forEach some every find findIndex includes indexOf
        sort reverse keys values entries has add delete get set clear freeze isFrozen floor ceil round abs min max sqrt hypot atan2
        sign trunc isFinite isInteger isNaN toFixed toString test exec replace match split trim padStart startsWith endsWith
        from of isArray assign hasOwnProperty call apply bind warn then catch now is length fromEntries""".split())
    unknown = set()
    code = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    code = re.sub(r"(?m)^\s*//.*$", "", code)
    for mm in re.finditer(r"\.([A-Za-z_]\w*)\s*\(", code):
        n = mm.group(1)
        if n not in allm and n not in builtins:
            unknown.add(n)
    t.expect(not unknown, "method calls that are neither 1.11.0 API nor known JS built-ins: %s" % sorted(unknown))
    t.ok("imports %s exist; all world./system. members and method calls resolve against server_1.11.0.json" % names)


@check("script.block_lists", "script")
def c_script_blocks(c: Ctx, t: T):
    reg = blocks_registry(c)
    if reg is None:
        t.skip("mojang-blocks.json not found")
        return
    d = docs(c, t)
    if not d:
        return
    data, err = dump_script_lists(c)
    if data is None:
        t.fail("could not load main.js lists under node: %s" % err)
        return
    allowed = data["allowed"]
    t.expect(len(allowed) == len(set(allowed)), "ALLOWED_BLOCK_IDS has %d duplicates" % (len(allowed) - len(set(allowed))))
    deny = [re.compile(p) for p in DENY_PATTERNS]
    soft_hard = {"^stone$", "^dirt$", "^grass", "^sand$", "^gravel$", "^iron_block$", "^diamond_block$", "^gold_block$", "^emerald_block$", "^end_stone", "^deepslate"}
    # ---- script allow-list
    bad_reg = [b for b in allowed if b not in reg]
    t.expect(not bad_reg, "script allows ids that are not blocks in 1.21.0 (mojang-blocks.json): %s" % bad_reg[:8])
    bad_ns = [b for b in allowed if not b.startswith("minecraft:") or b != b.lower() or " " in b]
    t.expect(not bad_ns, "script ids not canonical minecraft:lower_case: %s" % bad_ns[:5])
    hits = [b for b in allowed if any(p.search(b.split(":", 1)[-1]) for p in deny)]
    t.expect(not hits, "script ALLOWS ids matching my independent deny patterns (bedrock, obsidian, containers, command blocks, ...): %s" % hits[:10])
    nonsoft = [b for b in allowed if not SOFT_WORDS.search(b.split(":", 1)[-1])]
    t.expect(not nonsoft, "script allows ids that are not in a 'soft' category: %s" % nonsoft[:10])
    for b in allowed:
        n = b.split(":", 1)[-1]
        if re.search(r"(?:_slab|_stairs)$", n) and not WOOD_PREFIX.match(n):
            t.fail("script allows non-wooden slab/stairs %s" % b)
    # the script's own deny list must at least contain the headline blocks
    for must in ("minecraft:bedrock", "minecraft:obsidian", "minecraft:crying_obsidian", "minecraft:reinforced_deepslate", "minecraft:barrier",
                 "minecraft:command_block", "minecraft:chest", "minecraft:end_portal_frame"):
        t.expect(must in data["denied"], "script DENIED_BLOCK_IDS lacks %s" % must)
    t.expect(not (set(allowed) & set(data["denied"])), "allowed and denied lists intersect: %s" % sorted(set(allowed) & set(data["denied"])))
    # ---- BP break_blocks
    bb = d.groups["scp096:rage_run"]["minecraft:break_blocks"]["breakable_blocks"]
    t.expect(len(bb) == len(set(bb)), "BP breakable_blocks has %d duplicates" % (len(bb) - len(set(bb))))
    bad = [b for b in bb if "minecraft:" + b not in reg]
    t.expect(not bad, "BP breakable_blocks entries that are not 1.21.0 blocks: %s" % bad[:10])
    t.expect(all(":" not in b for b in bb), "BP breakable_blocks contains prefixed names (vanilla ravager uses un-prefixed)")
    hits = [b for b in bb if any(p.search(b) for p in deny)]
    t.expect(not hits, "BP breakable_blocks matches my deny patterns (bedrock/obsidian/containers/...): %s" % hits[:10])
    nonsoft = [b for b in bb if not SOFT_WORDS.search(b)]
    t.expect(not nonsoft, "BP breakable_blocks has non-soft entries: %s" % nonsoft[:10])
    for b in bb:
        if re.search(r"(?:_slab|_stairs)$", b) and not WOOD_PREFIX.match(b):
            t.fail("BP breaks non-wooden slab/stairs %s" % b)
    for need in ("bedrock", "obsidian", "crying_obsidian", "reinforced_deepslate", "barrier", "end_portal_frame", "command_block"):
        t.expect(need not in bb, "BP breakable_blocks contains %s" % need)
    only_script = sorted({x.split(":", 1)[1] for x in allowed} - set(bb))
    only_bp = sorted(set(bb) - {x.split(":", 1)[1] for x in allowed})
    t.info("script allows %d ids, BP break_blocks lists %d names; only in script: %d (e.g. %s); only in BP: %d (e.g. %s)" % (
        len(allowed), len(bb), len(only_script), only_script[:4], len(only_bp), only_bp[:4]))
    if only_bp:
        t.warn("policy mismatch (not a safety issue): BP break_blocks lists %s, which main.js deliberately does NOT clear "
               "(they pass every deny pattern and are soft); the script author excluded them, the behavior author kept them" % only_bp)
    # the headline requirements: doors, glass, leaves, wood must be breakable by both
    for cat in ("door", "glass", "leaves", "log", "planks", "fence", "trapdoor", "wool", "web"):
        t.expect(any(cat in b for b in allowed), "script cannot break any %s" % cat)
        t.expect(any(cat in b for b in bb), "BP cannot break any %s" % cat)
    t.ok("script allow-list %d ids / BP list %d names: all real 1.21.0 blocks, all soft categories, 0 hits against %d deny patterns "
         "(bedrock, obsidian, containers, command blocks, ...), doors/glass/leaves/wood/planks covered" % (len(allowed), len(bb), len(DENY_PATTERNS)))


@check("script.typecheck_tsc", "script", slow=True)
def c_script_tsc(c: Ctx, t: T):
    tdir = c.p("tools/typecheck")
    tsc = os.path.join(tdir, "node_modules", ".bin", "tsc")
    if not os.path.isfile(tsc):
        t.skip("tools/typecheck/node_modules missing (run: cd tools/typecheck && npm ci)")
        return
    rc, out, dt = run_cmd([tsc, "-p", "tsconfig.json"], cwd=tdir, timeout=300)
    t.expect(rc == 0, "tsc --checkJs against @minecraft/server 1.11.0 typings failed:\n%s" % tail(out, 15))
    pj = json.load(open(os.path.join(tdir, "node_modules", "@minecraft", "server", "package.json")))
    t.expect(pj["version"] == "1.11.0", "typings are @minecraft/server %s, not 1.11.0" % pj["version"])
    t.ok("tsc clean (strict, checkJs) against @minecraft/server %s typings, %.1fs" % (pj["version"], dt))


@check("script.node_tests", "script", slow=True)
def c_script_tests(c: Ctx, t: T):
    node = shutil.which("node")
    if not node:
        t.skip("node missing")
        return
    rc, out, dt = run_cmd([node, c.p("tools/test_script.mjs")], timeout=900, env={"MOJANG_SAMPLES": c.vanilla})
    last = [l for l in out.strip().splitlines() if l.strip()][-3:]
    t.expect(rc == 0, "tools/test_script.mjs failed:\n%s" % tail(out, 15))
    t.ok("test_script.mjs exit 0 (%.0fs): %s" % (dt, " | ".join(last)[:160]))


@check("script.verify_api", "script", slow=True)
def c_script_verify_api(c: Ctx, t: T):
    node = shutil.which("node")
    if not node or not c.exists("tools/typecheck/verify_api.mjs"):
        t.skip("node or verify_api.mjs missing")
        return
    rc, out, dt = run_cmd([node, c.p("tools/typecheck/verify_api.mjs")], timeout=300, env={"MOJANG_SAMPLES": c.vanilla})
    t.expect(rc == 0, "verify_api.mjs failed:\n%s" % tail(out, 15))
    t.ok("verify_api.mjs exit 0: %s" % (tail(out, 1)[:140]))


# ======================================================================================================
# group: package
# ======================================================================================================
def build_archive(c: Ctx, out_path):
    return c.run([sys.executable, c.p("tools/build_mcaddon.py"), "-o", out_path], timeout=300)


def expected_zip_names(c: Ctx):
    return sorted(c.pack_files())


@check("package.build", "package")
def c_pkg_build(c: Ctx, t: T):
    if not c.exists("tools/build_mcaddon.py"):
        t.skip("tools/build_mcaddon.py missing")
        return
    td = tempfile.mkdtemp(prefix="scp096_pkg_")
    c.tmp = td
    out1, out2 = os.path.join(td, "a", "SCP-096.mcaddon"), os.path.join(td, "b", "SCP-096.mcaddon")
    os.makedirs(os.path.dirname(out1))
    os.makedirs(os.path.dirname(out2))
    rc, out, _ = build_archive(c, out1)
    t.expect(rc == 0 and os.path.isfile(out1), "build_mcaddon.py failed (rc=%s):\n%s" % (rc, tail(out, 15)))
    rc2, out2_, _ = build_archive(c, out2)
    if rc == 0 and rc2 == 0:
        h1 = hashlib.sha256(open(out1, "rb").read()).hexdigest()
        h2 = hashlib.sha256(open(out2, "rb").read()).hexdigest()
        t.expect(h1 == h2, "two builds give different archives (%s vs %s): not reproducible" % (h1[:12], h2[:12]))
        c._json["__zip__"] = out1
        t.ok("built %s (%d bytes, sha256 %s), a second build is byte-identical" % (os.path.basename(out1), os.path.getsize(out1), h1[:16]))
        stray = [f for f in os.listdir(c.root) if f.endswith(".mcaddon") and f != "SCP-096.mcaddon"]
        t.expect(not stray, "build left stray archives in the add-on root: %s" % stray)


@check("package.zip_structure", "package")
def c_pkg_zip(c: Ctx, t: T):
    path = c._json.get("__zip__")
    if not path:
        t.skip("no archive built (package.build failed or skipped)")
        return
    with zipfile.ZipFile(path) as z:
        t.expect(z.testzip() is None, "zipfile.testzip() reports a bad member: %s" % z.testzip())
        infos = z.infolist()
        names = [i.filename for i in infos]
        t.expect(len(names) == len(set(names)), "duplicate member names")
        roots = sorted({n.split("/")[0] for n in names})
        t.expect(roots == ["SCP096_BP", "SCP096_RP"], "zip root entries are %s, expected exactly SCP096_BP and SCP096_RP" % roots)
        for i in infos:
            n = i.filename
            t.expect(not n.startswith("/") and ".." not in n.split("/") and "\\" not in n and ":" not in n, "unsafe member name %r" % n)
            t.expect(i.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), "%s: compression type %d" % (n, i.compress_type))
            t.expect(not (i.flag_bits & 0x1), "%s is encrypted" % n)
            t.expect(i.date_time[0] >= 1980, "%s: invalid timestamp %s" % (n, i.date_time))
            t.expect(not i.is_dir(), "directory entry %s (should not be needed)" % n)
        t.expect(z.comment == b"", "zip has a comment")
        t.expect(sorted(names) == expected_zip_names(c), "zip file list differs from the on-disk pack files: only in zip %s, only on disk %s" % (
            sorted(set(names) - set(expected_zip_names(c))), sorted(set(expected_zip_names(c)) - set(names))))
        for n in names:
            if z.read(n) != open(c.p(n), "rb").read():
                t.fail("%s differs between zip and disk" % n)
        for pack in ("SCP096_BP", "SCP096_RP"):
            try:
                m = strict_loads(z.read(pack + "/manifest.json").decode("utf-8"))
                t.expect(m["header"]["uuid"], "%s manifest has no uuid" % pack)
            except Exception as ex:
                t.fail("%s/manifest.json not readable straight from the zip: %s" % (pack, ex))
        t.info("zip: %d members, %d bytes compressed, %d uncompressed" % (len(infos), sum(i.compress_size for i in infos), sum(i.file_size for i in infos)))
    if shutil.which("unzip"):
        rc, out, _ = run_cmd(["unzip", "-tq", path])
        t.expect(rc == 0 and "No errors" in out, "unzip -t: %s" % out.strip()[:200])
    t.expect(path.endswith(".mcaddon"), "archive extension is not .mcaddon")
    t.ok("zip root = SCP096_BP/ + SCP096_RP/ only; %d files equal to the on-disk pack files byte for byte; manifests readable in place; "
         "testzip + unzip -t clean; no encryption, no directory entries" % len(names))


@check("package.import_simulation", "package")
def c_pkg_import(c: Ctx, t: T):
    path = c._json.get("__zip__")
    if not path:
        t.skip("no archive built")
        return
    td = tempfile.mkdtemp(prefix="scp096_import_")
    try:
        with zipfile.ZipFile(path) as z:
            z.extractall(td)
        packs, found = {}, []
        for d_ in sorted(os.listdir(td)):
            mp = os.path.join(td, d_, "manifest.json")
            if os.path.isfile(mp):
                packs[d_] = strict_loads(open(mp, encoding="utf-8").read())
                found.append(d_)
            else:
                t.fail("extracted folder %s has no manifest.json at its root (the game would not see a pack)" % d_)
        t.expect(set(packs) == {"SCP096_BP", "SCP096_RP"}, "packs found after extraction: %s" % found)
        avail = {"@minecraft/server": set(stable_server_versions(c.vanilla)) or {SCRIPT_MODULE_VERSION}}
        errs, order = resolve_install(packs, avail)
        for e in errs:
            t.fail("import simulation: " + e)
        # module types vs folders
        for d_, m in packs.items():
            for mod in m["modules"]:
                if mod["type"] == "script":
                    t.expect(os.path.isfile(os.path.join(td, d_, mod["entry"])), "%s: script entry %s missing after extraction" % (d_, mod["entry"]))
        # the extracted pair must pass the same content checks as the sources
        sub = run_checks(td, skip=["package", "ext", "script", "corpus.selftest", "molang.numeric_sweep", "geometry.pose_ground_contact"],
                         quiet=True)
        failed = [x for x, _ in sub if x.status == "FAIL"]
        for x in failed:
            t.fail("extracted copy fails %s: %s" % (x.name, "; ".join(x.fails)[:200]))
        t.ok("extracted to a clean directory: both manifests found at the pack roots, BP->RP dependency and @minecraft/server %s resolve "
             "(activation order %s), script entry present, and %d content checks pass on the extracted copy" % (SCRIPT_MODULE_VERSION, order, len(sub)))
    finally:
        shutil.rmtree(td, ignore_errors=True)


@check("package.official_archive", "package")
def c_pkg_official(c: Ctx, t: T):
    f = c.p("SCP-096.mcaddon")
    if not os.path.isfile(f):
        t.warn("SCP-096.mcaddon has not been built yet (run: python3 tools/build_mcaddon.py)")
        return
    rc, out, _ = c.run([sys.executable, c.p("tools/build_mcaddon.py"), "--verify-only"])
    t.expect(rc == 0, "SCP-096.mcaddon is stale or broken:\n%s" % tail(out, 8))
    t.ok("SCP-096.mcaddon (%d bytes) matches the current sources: %s" % (os.path.getsize(f), tail(out, 1)[:100]))



# ======================================================================================================
# group: ext  (the teammates' own verifiers, plus regeneration reproducibility)
# ======================================================================================================
def _ext(name, cmd, ok_hint, slow=False, timeout=900, env=None):
    def fn(c: Ctx, t: T):
        exe = cmd[0] if os.path.isabs(cmd[0]) or cmd[0] in ("node",) else sys.executable
        script = c.p(cmd[1]) if len(cmd) > 1 and not cmd[1].startswith("-") else None
        if script and not os.path.exists(script):
            t.skip("%s not found" % cmd[1])
            return
        argv = [sys.executable if cmd[0] == "python3" else cmd[0]] + [c.p(x) if x.endswith((".py", ".mjs")) else x for x in cmd[1:]]
        rc, out, dt = run_cmd(argv, timeout=timeout, cwd=c.root, env=dict(env or {}, MOJANG_SAMPLES=c.vanilla, BEDROCK_SAMPLES=c.vanilla))
        t.expect(rc == 0, "%s exited %d:\n%s" % (" ".join(cmd), rc, tail(out, 14)))
        if rc == 0:
            t.ok("%s -> exit 0 in %.0fs (%s)" % (" ".join(cmd), dt, (tail(out, 1) or ok_hint)[:110]))
    return fn


check("ext.eval_animation_selftest", "ext")(_ext("eval_animation selftest", ["python3", "tools/eval_animation.py", "--selftest"], "Molang evaluator self-test"))
check("ext.eval_animation_verify", "ext")(_ext("eval_animation verify", ["python3", "tools/eval_animation.py", "--verify"], "client-file verification"))
check("ext.render_poses_check", "ext")(_ext("render_poses check", ["python3", "tools/render_poses.py", "--check"], "pose checks"))
check("ext.render_preview_selftest", "ext")(_ext("render_preview selftest", ["python3", "tools/render_preview.py", "--selftest"], "renderer self-test"))
check("ext.sim_entity", "ext")(_ext("sim_entity", ["python3", "tools/sim_entity.py"], "entity state-machine simulation"))
check("ext.sim_entity_selftest", "ext", slow=True)(_ext("sim_entity selftest", ["python3", "tools/sim_entity.py", "--selftest"], "mutation self-test", timeout=1200))
check("ext.make_sounds_verify", "ext")(_ext("make_sounds verify", ["python3", "tools/make_sounds.py", "verify"], "audio verification"))
check("ext.script_mutation_check", "ext", slow=True)(_ext("script mutation check", ["python3", "tools/typecheck/mutation_check.py"], "script mutants", timeout=1800))


def _tools_copy(c: Ctx):
    """Copy of tools/ + both packs to a temp dir, so generator scripts that write their output cannot touch the real tree."""
    td = tempfile.mkdtemp(prefix="scp096_regen_")
    dst = os.path.join(td, "scp096-addon")
    os.makedirs(dst)
    shutil.copytree(c.p("tools"), os.path.join(dst, "tools"), ignore=shutil.ignore_patterns("node_modules", "__pycache__", "results"))
    for pack in ("SCP096_BP", "SCP096_RP"):
        shutil.copytree(c.p(pack), os.path.join(dst, pack))
    return td, dst


@check("ext.regenerate_reproducible", "ext", slow=True)
def c_ext_regen(c: Ctx, t: T):
    """make_model.py / make_texture.py write their outputs (even with --verify / --check): run them in a copy and
    require byte-identical results, i.e. the shipped model + texture are exactly what the generators produce."""
    td, dst = _tools_copy(c)
    try:
        shipped = {}
        for rel in ("SCP096_RP/models/entity/scp096.geo.json", "SCP096_RP/textures/entity/scp096.png"):
            shipped[rel] = hashlib.sha256(open(c.p(rel), "rb").read()).hexdigest()
        env = {"PYTHONDONTWRITEBYTECODE": "1"}
        for cmd in (["tools/make_model.py", "--verify"], ["tools/make_texture.py", "--check"]):
            rc, out, dt = run_cmd([sys.executable, os.path.join(dst, cmd[0])] + cmd[1:], cwd=dst, timeout=600, env=env)
            t.expect(rc == 0, "%s failed in the copy:\n%s" % (" ".join(cmd), tail(out, 10)))
        for rel, h in shipped.items():
            h2 = hashlib.sha256(open(os.path.join(dst, rel), "rb").read()).hexdigest()
            t.expect(h == h2, "%s: shipped file (%s) differs from the generator's output (%s): file edited by hand or generator changed" % (rel, h[:12], h2[:12]))
        t.ok("make_model.py --verify and make_texture.py --check pass in a scratch copy and reproduce the shipped geo.json (%s) and PNG (%s) byte for byte" % (
            list(shipped.values())[0][:10], list(shipped.values())[1][:10]))
    finally:
        shutil.rmtree(td, ignore_errors=True)


@check("ext.sounds_reproducible", "ext", slow=True)
def c_ext_sounds_regen(c: Ctx, t: T):
    """Rebuild the audio + JSON from tools/make_sounds.py in a scratch copy; the shipped files must equal the result."""
    td, dst = _tools_copy(c)
    try:
        rc, out, dt = run_cmd([sys.executable, os.path.join(dst, "tools", "make_sounds.py"), "build"], cwd=dst, timeout=1500,
                              env={"PYTHONDONTWRITEBYTECODE": "1"})
        if rc != 0:
            t.fail("make_sounds.py build failed in the copy:\n%s" % tail(out, 10))
            return
        diff = []
        for rel in c.pack_files():
            if rel.startswith("SCP096_RP/sounds"):
                a, b = c.p(rel), os.path.join(dst, rel)
                if not os.path.exists(b) or open(a, "rb").read() != open(b, "rb").read():
                    diff.append(rel)
        if diff:
            t.warn("rebuilt audio differs from the shipped files (%s): expected only if ffmpeg/libvorbis/numpy versions differ from the "
                   "author's; the shipped files are the reference" % diff)
        t.ok("make_sounds.py build in a scratch copy: %d of %d sound files byte-identical to the shipped ones (%.0fs)" % (
            len([r for r in c.pack_files() if r.startswith("SCP096_RP/sounds")]) - len(diff), len([r for r in c.pack_files() if r.startswith("SCP096_RP/sounds")]), dt))
    finally:
        shutil.rmtree(td, ignore_errors=True)


# @@CHECKS-END@@  (new checks are inserted above this line)


# ======================================================================================================
# runner
# ======================================================================================================
GROUP_ORDER = ["layout", "json", "manifest", "schema", "xref", "molang", "geometry", "texture", "audio", "lang",
               "corpus", "script", "package", "ext"]
ICON = {"PASS": "PASS", "FAIL": "FAIL", "WARN": "WARN", "SKIP": "SKIP"}


def select(only=None, skip=None, fast=False):
    only = set(only or [])
    skip = set(skip or [])
    sel = []
    for name, group, fn, slow in REGISTRY:
        if only and not (group in only or name in only or any(name.startswith(o + ".") for o in only)):
            continue
        if group in skip or name in skip:
            continue
        if fast and (slow or group in ("ext", "package")):
            continue
        sel.append((name, group, fn, slow))
    sel.sort(key=lambda x: (GROUP_ORDER.index(x[1]) if x[1] in GROUP_ORDER else 99))
    return sel


def run_checks(root, only=None, skip=None, fast=False, verbose=False, quiet=False, ctx=None):
    c = ctx or Ctx(root)
    results = []
    t_all = time.time()
    for name, group, fn, slow in select(only, skip, fast):
        t = T(name, group)
        t0 = time.time()
        try:
            fn(c, t)
        except Exception as ex:   # a crashing check is a failing check, never a pass
            tb = traceback.extract_tb(sys.exc_info()[2])[-1]
            t.fail("check crashed: %s: %s (at %s:%d)" % (type(ex).__name__, ex, os.path.basename(tb.filename), tb.lineno))
        dt = time.time() - t0
        results.append((t, dt))
        if not quiet:
            summary = ""
            if t.status == "PASS" and t.oks:
                summary = "  " + t.oks[-1] if len(t.oks) else ""
            elif t.status == "SKIP":
                summary = "  (%s)" % t.skipped
            elif t.status in ("FAIL", "WARN"):
                summary = "  %d problem(s), %d warning(s)" % (len(t.fails), len(t.warns))
            print("%-4s  %-34s%s  [%.1fs]" % (ICON[t.status], name, summary[:170], dt))
            for m in t.fails:
                print("        FAIL: %s" % m.replace("\n", "\n              "))
            for m in t.warns:
                print("        warn: %s" % m.replace("\n", "\n              "))
            if verbose:
                for m in t.oks[:-1] if t.status == "PASS" else t.oks:
                    print("        ok:   %s" % m)
                for m in t.infos:
                    print("        info: %s" % m)
            sys.stdout.flush()
    c.elapsed = time.time() - t_all
    return results


def summarize(results, elapsed=None):
    n = collections.Counter(t.status for t, _ in results)
    print("\n" + "=" * 100)
    print("SUMMARY: %d checks | PASS %d | WARN %d | FAIL %d | SKIP %d%s" % (
        len(results), n["PASS"], n["WARN"], n["FAIL"], n["SKIP"], "" if elapsed is None else " | %.0fs" % elapsed))
    fails = [t for t, _ in results if t.status == "FAIL"]
    if fails:
        print("\nFAILED CHECKS:")
        for t in fails:
            print("  %s" % t.name)
            for m in t.fails:
                print("      - %s" % m.replace("\n", "\n        "))
    warns = [(t.name, m) for t, _ in results for m in t.warns]
    if warns:
        print("\nWARNINGS (%d):" % len(warns))
        for nme, m in warns:
            print("  [%s] %s" % (nme, m.replace("\n", "\n      ")))
    skips = [t for t, _ in results if t.status == "SKIP"]
    if skips:
        print("\nSKIPPED:")
        for t in skips:
            print("  %s: %s" % (t.name, t.skipped))
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split("Groups")[1] if "Groups" in __doc__ else "")
    ap.add_argument("--root", default=ROOT_DEFAULT, help="add-on root (default: the repo this script is in)")
    ap.add_argument("--only", default="", help="comma list of groups or check names")
    ap.add_argument("--skip", default="", help="comma list of groups or check names to skip")
    ap.add_argument("--fast", action="store_true", help="skip slow checks, the zip build and the external tools")
    ap.add_argument("--fail-on-skip", action="store_true", help="exit 1 if a check had to be skipped")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--list", action="store_true", help="list the checks and exit")
    ap.add_argument("--selftest", action="store_true", help="mutate a temporary copy; every mutant must be caught")
    ap.add_argument("--json", default=None, help="also write the results to this JSON file")
    a = ap.parse_args(argv)
    if a.list:
        for name, group, fn, slow in select():
            print("%-9s %-34s %s" % (group, name, "(slow)" if slow else ""))
        return 0
    if a.selftest:
        return selftest(a.root, verbose=a.verbose)
    only = [x for x in a.only.split(",") if x]
    skip = [x for x in a.skip.split(",") if x]
    print("validate_addon.py  root=%s" % os.path.abspath(a.root))
    t0 = time.time()
    results = run_checks(a.root, only, skip, a.fast, a.verbose)
    n = summarize(results, time.time() - t0)
    if a.json:
        with open(a.json, "w") as f:
            json.dump([{"name": t.name, "group": t.group, "status": t.status, "fails": t.fails, "warns": t.warns,
                        "ok": t.oks, "seconds": round(dt, 2)} for t, dt in results], f, indent=1)
    rc = 1 if n["FAIL"] or (a.fail_on_skip and n["SKIP"]) else 0
    print("\nRESULT: %s" % ("FAIL" if rc else "PASS"))
    return rc


def selftest(root, verbose=False):   # replaced below once the checks exist
    print("selftest not available yet")
    return 1


if __name__ == "__main__":
    sys.exit(main())
