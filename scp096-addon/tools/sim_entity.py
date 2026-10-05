#!/usr/bin/env python3
"""sim_entity.py - offline verifier + state-machine simulator for SCP096_BP/entities/scp096.json

Nobody on the team can run Minecraft, so this tool replaces "try it in game" with evidence:

  1. FORMAT   strict JSON (no comments / trailing commas / duplicate keys / BOM / CRLF),
              canonical layout (this file's own formatter; `--rewrite` regenerates it).
  2. REFS     every event referenced by timers / on_target_acquired / on_target_escape /
              environment_sensor / damage_sensor / lookat / melee on_kill exists; every
              component group referenced by an event exists; every group and event is used.
  3. SIM      a small interpreter of the entity JSON (events: add / remove / sequence /
              randomize / trigger / filters is_variant + has_target + actor_health +
              all_of/any_of/none_of; timers; environment sensors; lookat; on_target_acquired /
              on_target_escape; melee on_kill) that proves the DESIGN.md section 5 state machine:
                spawn -> sit(0) -> begin_walk -> walk(1) -> begin_sit -> sit(0)
                enrage from sit AND from walk -> scream(2) (3..5 s) -> begin_run -> run(3)
                calm_down (also from scream) -> sit(0) with the calm group restored
              plus: exactly one pose/rage group at any time, no duplicates, no leaked groups,
              no two groups defining the same component, correct `minecraft:variant` per state,
              stale / duplicated / reordered events, an exhaustive (state x event) table and a
              fuzz run.  3a2 repeats the "target died" scenarios in three possible engine
              worlds (dead target cleared / kept+overwritable / kept+blocking lookat).
  4. CORPUS   every (component, field, ...) path and every enum-like value (test, subject,
              operator, target, cause, deals_damage, min_difficulty ...) of the entity is
              looked up in the vanilla 1.21.0.3 behavior_pack/entities corpus; anything that
              does not occur there is printed as UNPROVEN, values that only occur in other
              filter contexts as CONTEXTUAL.
  5. BLOCKS   every minecraft:break_blocks entry exists as "minecraft:<name>" in
              metadata/vanilladata_modules/mojang-blocks.json, is lower-case and un-prefixed
              (the vanilla ravager spelling), is unique, and is not on the deny list.
  6. EVIDENCE the engine rules the simulator relies on (remove-then-add of the same group,
              group-overrides-base, shared components swapped by one event, is_variant in event
              filters) are each mined from a vanilla entity and printed.

  --selftest mutates the entity 23 different ways in memory; every mutant must be caught.

Usage:
  python3 tools/sim_entity.py                  # run everything, exit code 0 = all PASS
  python3 tools/sim_entity.py --table          # also print the component -> vanilla file:line table
  python3 tools/sim_entity.py --selftest       # mutation test of the verifier itself
  python3 tools/sim_entity.py --rewrite        # re-emit the entity file in canonical layout
  python3 tools/sim_entity.py --vanilla DIR    # bedrock-samples checkout (default below, or $BEDROCK_SAMPLES)

Only the python3 standard library is used.
"""
import argparse
import contextlib
import copy
import functools
import io
import json
import os
import random
import re
import sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.dirname(HERE)
DEFAULT_ENTITY = os.path.join(ADDON, "SCP096_BP", "entities", "scp096.json")
DEFAULT_VANILLA = os.environ.get("BEDROCK_SAMPLES", "/home/user/mojang/bedrock-samples")

ENTITY_ID = "scp:scp096"
FMT_WIDTH = 100
FAST = False  # --selftest sets this: shorter cycles / fewer fuzz seeds (same invariants)

# --------------------------------------------------------------------------------------
# contract constants (DESIGN.md section 5)
# --------------------------------------------------------------------------------------
G_CALM = "scp096:calm"
G_SIT = "scp096:pose_sit"
G_WALK = "scp096:pose_walk"
G_SCREAM = "scp096:rage_scream"
G_RUN = "scp096:rage_run"
ALL_GROUPS = [G_CALM, G_SIT, G_WALK, G_SCREAM, G_RUN]
STATES = {
    "sit": (frozenset([G_CALM, G_SIT]), 0),
    "walk": (frozenset([G_CALM, G_WALK]), 1),
    "scream": (frozenset([G_SCREAM]), 2),
    "run": (frozenset([G_RUN]), 3),
}
GROUPSET_TO_STATE = {gs: name for name, (gs, _v) in STATES.items()}
EVENTS = ["scp096:begin_walk", "scp096:begin_sit", "scp096:enrage", "scp096:begin_run", "scp096:calm_down"]
ENGINE_EVENTS = {"minecraft:entity_spawned"}  # fired by the engine, never referenced by components

DENY_EXACT = {
    "bedrock", "obsidian", "crying_obsidian", "reinforced_deepslate", "barrier", "command_block",
    "chain_command_block", "repeating_command_block", "structure_block", "structure_void", "jigsaw",
    "portal", "end_portal", "end_portal_frame", "end_gateway", "light_block", "border_block", "allow",
    "deny", "netherite_block", "ancient_debris", "respawn_anchor", "chest", "trapped_chest",
    "ender_chest", "barrel", "hopper", "dropper", "dispenser", "furnace", "blast_furnace", "smoker",
    "brewing_stand", "beacon", "enchanting_table", "anvil", "lodestone", "conduit", "spawner",
    "mob_spawner", "trial_spawner", "vault", "crafter", "bedrock_ore", "unknown",
}
DENY_SUBSTR = ["bedrock", "obsidian", "command_block", "structure", "portal", "end_gateway", "netherite",
               "ancient_debris", "reinforced", "barrier", "chest", "shulker_box", "jigsaw", "spawner"]

COMBINATORS = {"all_of", "any_of", "none_of"}
ENUM_KEYS = {"test", "subject", "operator", "target", "cause", "deals_damage", "domain", "min_difficulty"}
PREFERRED_PROOF_FILES = [
    "enderman.json", "ravager.json", "vindicator.json", "zombie.json", "camel.json", "bee.json",
    "boat.json", "iron_golem.json", "frog.json", "llama.json", "armadillo.json", "hoglin.json",
    "breeze.json", "pillager.json", "villager_v2.json", "mooshroom.json", "cave_spider.json",
    "husk.json", "wolf.json",
]


# --------------------------------------------------------------------------------------
# reporting helpers
# --------------------------------------------------------------------------------------
class Report:
    def __init__(self):
        self.checks = []  # (ok, name, detail)

    def check(self, ok, name, detail=""):
        self.checks.append((bool(ok), name, detail))
        if not ok:
            print("  FAIL  %s%s" % (name, (" -> " + detail) if detail else ""))
        return bool(ok)

    @property
    def failed(self):
        return [c for c in self.checks if not c[0]]


def section(title):
    print("\n== %s ==" % title)


# --------------------------------------------------------------------------------------
# strict + lenient JSON
# --------------------------------------------------------------------------------------
def _no_dupes(pairs):
    d = {}
    for k, v in pairs:
        if k in d:
            raise ValueError("duplicate key %r" % k)
        d[k] = v
    return d


def _bad_const(name):
    raise ValueError("non-standard JSON constant %s" % name)


def strict_loads(text):
    return json.loads(text, object_pairs_hook=_no_dupes, parse_constant=_bad_const)


class LDict(dict):
    """dict that remembers on which line each key appeared (lenient parser only)."""

    def __init__(self):
        super().__init__()
        self.lines = {}


class Lenient:
    """Parses vanilla-style JSON (// and /* */ comments, trailing commas) and records key lines."""

    NUM = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?")

    def __init__(self, text):
        self.t = text
        self.i = 0
        self.n = len(text)
        self.line = 1

    def err(self, msg):
        raise ValueError("%s at line %d" % (msg, self.line))

    def skip(self):
        t = self.t
        while self.i < self.n:
            c = t[self.i]
            if c == "\n":
                self.line += 1
                self.i += 1
            elif c in " \t\r﻿":
                self.i += 1
            elif t.startswith("//", self.i):
                while self.i < self.n and t[self.i] != "\n":
                    self.i += 1
            elif t.startswith("/*", self.i):
                j = t.find("*/", self.i + 2)
                if j < 0:
                    self.err("unterminated comment")
                self.line += t.count("\n", self.i, j)
                self.i = j + 2
            else:
                break

    def string(self):
        t = self.t
        j = self.i + 1
        while j < self.n and t[j] != '"':
            j += 2 if t[j] == "\\" else 1
        if j >= self.n:
            self.err("unterminated string")
        s = json.loads(t[self.i:j + 1])
        self.i = j + 1
        return s

    def value(self):
        self.skip()
        if self.i >= self.n:
            self.err("unexpected end")
        c = self.t[self.i]
        if c == "{":
            return self.obj()
        if c == "[":
            return self.arr()
        if c == '"':
            return self.string()
        for lit, val in (("true", True), ("false", False), ("null", None)):
            if self.t.startswith(lit, self.i):
                self.i += len(lit)
                return val
        m = self.NUM.match(self.t, self.i)
        if not m:
            self.err("bad value %r" % self.t[self.i:self.i + 12])
        self.i = m.end()
        txt = m.group(0)
        return float(txt) if any(ch in txt for ch in ".eE") else int(txt)

    def obj(self):
        d = LDict()
        self.i += 1
        while True:
            self.skip()
            if self.i >= self.n:
                self.err("unterminated object")
            if self.t[self.i] == "}":
                self.i += 1
                return d
            if self.t[self.i] != '"':
                self.err("expected key")
            line = self.line
            k = self.string()
            self.skip()
            if self.t[self.i] != ":":
                self.err("expected ':'")
            self.i += 1
            v = self.value()
            d[k] = v
            d.lines.setdefault(k, line)
            self.skip()
            if self.t[self.i] == ",":
                self.i += 1
            elif self.t[self.i] != "}":
                self.err("expected ',' or '}'")

    def arr(self):
        a = []
        self.i += 1
        while True:
            self.skip()
            if self.i >= self.n:
                self.err("unterminated array")
            if self.t[self.i] == "]":
                self.i += 1
                return a
            a.append(self.value())
            self.skip()
            if self.t[self.i] == ",":
                self.i += 1
            elif self.t[self.i] != "]":
                self.err("expected ',' or ']'")


def lenient_load(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return Lenient(f.read()).value()


# --------------------------------------------------------------------------------------
# canonical formatter (2-space indent, short scalar arrays inline, long ones wrapped)
# --------------------------------------------------------------------------------------
def _scalar(v):
    return json.dumps(v, ensure_ascii=False)


def _is_scalar(v):
    return not isinstance(v, (dict, list))


def format_json(obj, indent=0):
    pad = "  " * indent
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        parts = []
        for k, v in obj.items():
            parts.append("%s  %s: %s" % (pad, json.dumps(k, ensure_ascii=False), format_json(v, indent + 1)))
        return "{\n" + ",\n".join(parts) + "\n" + pad + "}"
    if isinstance(obj, list):
        if not obj:
            return "[]"
        if all(_is_scalar(x) for x in obj):
            inline = "[" + ", ".join(_scalar(x) for x in obj) + "]"
            if len(pad) + len(inline) + 24 <= FMT_WIDTH:  # 24 = room for the key in front
                return inline
            lines, cur = [], ""
            for x in obj:
                tok = _scalar(x) + ","
                if cur and len(pad) + 2 + len(cur) + 1 + len(tok) > FMT_WIDTH:
                    lines.append(cur)
                    cur = tok
                else:
                    cur = (cur + " " + tok) if cur else tok
            lines.append(cur)
            lines[-1] = lines[-1].rstrip(",")
            return "[\n" + "\n".join(pad + "  " + ln for ln in lines) + "\n" + pad + "]"
        parts = [pad + "  " + format_json(x, indent + 1) for x in obj]
        return "[\n" + ",\n".join(parts) + "\n" + pad + "]"
    return _scalar(obj)


def canonical_text(doc):
    return format_json(doc) + "\n"


# --------------------------------------------------------------------------------------
# corpus path index
# --------------------------------------------------------------------------------------
def collect_paths(node, path, paths, values, file=None, depth=0):
    """Record every key path (list indices and all_of/any_of/none_of stripped) below `node`."""
    if isinstance(node, dict):
        for k, v in node.items():
            p = path if k in COMBINATORS else path + (k,)
            line = node.lines.get(k, 0) if isinstance(node, LDict) else 0
            if p not in paths:
                paths[p] = []
            if file is not None and len(paths[p]) < 40:
                paths[p].append((file, line))
            if k in ENUM_KEYS and isinstance(v, (str, bool)):
                values.setdefault((p, v), []).append((file, line) if file else None)
            collect_paths(v, p, paths, values, file, depth + 1)
    elif isinstance(node, list):
        for item in node:
            collect_paths(item, path, paths, values, file, depth + 1)


def index_entity(doc, file=None):
    """Return (paths, values) for one entity document (vanilla lenient or ours)."""
    paths, values = {}, {}
    root = doc.get("minecraft:entity", {})
    for key in ("format_version",):
        if key in doc:
            paths.setdefault(("<root>", key), []).append((file, 0))
            values.setdefault((("<root>", key), doc[key]), []).append((file, 0))
    collect_paths(root.get("description", {}), ("<description>",), paths, values, file)
    comp_sets = [root.get("components", {})] + list(root.get("component_groups", {}).values())
    for cs in comp_sets:
        if not isinstance(cs, dict):
            continue
        for ck, cv in cs.items():
            line = cs.lines.get(ck, 0) if isinstance(cs, LDict) else 0
            paths.setdefault((ck,), []).append((file, line))
            collect_paths(cv, (ck,), paths, values, file)
    for _en, ev in root.get("events", {}).items():
        collect_paths(ev, ("<event>",), paths, values, file)
    return paths, values


@functools.lru_cache(maxsize=4)
def load_vanilla_docs(entities_dir):
    docs, bad = {}, []
    for fn in sorted(os.listdir(entities_dir)):
        if not fn.endswith(".json"):
            continue
        try:
            docs[fn] = lenient_load(os.path.join(entities_dir, fn))
        except Exception as e:  # pragma: no cover - corpus parse problem
            bad.append((fn, str(e)))
    return docs, bad


@functools.lru_cache(maxsize=4)
def build_corpus(entities_dir):
    paths, values = {}, {}
    docs, bad = load_vanilla_docs(entities_dir)
    for fn, doc in docs.items():
        p, v = index_entity(doc, fn)
        for k, locs in p.items():
            paths.setdefault(k, []).extend(locs[:6])
        for k, locs in v.items():
            values.setdefault(k, []).extend(locs[:6])
    return paths, values, len(docs), bad


def best_proofs(locs, n=2):
    """Pick up to n (file, line) proofs, preferring well-known reference files."""
    seen, out = set(), []
    ordered = sorted(
        (loc for loc in locs if loc),
        key=lambda fl: (PREFERRED_PROOF_FILES.index(fl[0]) if fl[0] in PREFERRED_PROOF_FILES else 999, fl[0], fl[1]),
    )
    for f, ln in ordered:
        if f in seen:
            continue
        seen.add(f)
        out.append("%s:%d" % (f, ln))
        if len(out) >= n:
            break
    return out


# --------------------------------------------------------------------------------------
# the simulator
# --------------------------------------------------------------------------------------
class SimError(Exception):
    pass


def _compare(op, cur, val):
    table = {"==": cur == val, "equals": cur == val, "!=": cur != val, "not": cur != val,
             "<": cur < val, "<=": cur <= val, ">": cur > val, ">=": cur >= val}
    if op not in table:
        raise SimError("unsupported operator %r" % op)
    return table[op]


class Sim:
    """Interpreter of the entity JSON. Time is in seconds, one tick = 0.05 s."""

    TICK = 0.05

    # How the (unknown) engine treats a target that died.  Nobody can run the game, so the simulator
    # runs every scenario under each plausible world and requires the SCP to calm down in all of them:
    #   A  engine clears a dead target (fires on_target_escape, has_target becomes false)
    #   B1 dead target stays set; lookat may overwrite it with any player (re-fires on_target_acquired)
    #   B2 dead target stays set; lookat ignores everybody while a target is set (worst case)
    WORLDS = ("A", "B1", "B2")

    def __init__(self, doc, rng=None, sample="random", world="A"):
        ent = doc["minecraft:entity"]
        self.world = world
        self.target_health = 20.0
        self.base = ent.get("components", {})
        self.defs = ent.get("component_groups", {})
        self.events = ent.get("events", {})
        self.rng = rng or random.Random(1)
        self.sample = sample  # "random" | "min" | "max"
        self.active = []  # group names, activation order
        self.timers = {}  # group -> {"deadline", "spec"}
        self.target = None
        self.time = 0.0
        self.log = []
        self.fired = 0
        self.readds = 0

    # ---- effective components -------------------------------------------------
    def effective(self):
        eff, owners = {}, {}
        for k, v in self.base.items():
            eff[k] = v
            owners.setdefault(k, []).append("<base>")
        for g in self.active:
            for k, v in self.defs[g].items():
                eff[k] = v
                owners.setdefault(k, []).append(g)
        return eff, owners

    def conflicts(self):
        _eff, owners = self.effective()
        out = []
        for k, own in owners.items():
            groups = [o for o in own if o != "<base>"]
            if len(groups) > 1:
                out.append((k, groups))
        return out

    def variant(self):
        eff, _ = self.effective()
        v = eff.get("minecraft:variant")
        return v["value"] if v else 0  # engine default variant is 0

    def state(self):
        return GROUPSET_TO_STATE.get(frozenset(self.active))

    # ---- filters ----------------------------------------------------------------
    def test(self, f):
        if "all_of" in f or "any_of" in f or "none_of" in f:
            res = True
            if "all_of" in f:
                res = res and all(self.test(x) for x in f["all_of"])
            if "any_of" in f:
                res = res and any(self.test(x) for x in f["any_of"])
            if "none_of" in f:
                res = res and not any(self.test(x) for x in f["none_of"])
            return res
        name = f.get("test")
        subject = f.get("subject", "self")
        op = f.get("operator", "==")
        val = f.get("value", True)
        if name == "actor_health":
            if subject == "target":
                cur = self.target_health if self.target is not None else None
            elif subject == "self":
                cur = 500.0
            else:
                raise SimError("actor_health: unsupported subject %r" % subject)
            return False if cur is None else _compare(op, cur, val)
        if subject != "self":
            raise SimError("simulator only supports subject self here, got %r for test %r" % (subject, name))
        if name == "is_variant":
            return _compare(op, self.variant(), val)
        if name == "has_target":
            return _compare(op, self.target is not None, val)
        raise SimError("unsupported filter test %r" % name)

    def passes(self, resp):
        flt = resp.get("filters")
        return True if flt is None else self.test(flt)

    # ---- event execution -------------------------------------------------------
    def fire(self, name, depth=0):
        if depth > 8:
            raise SimError("event recursion too deep at %s" % name)
        if name not in self.events:
            raise SimError("event %r is not defined" % name)
        self.fired += 1
        self.log.append("t=%.2f fire %s (groups=%s)" % (self.time, name, ",".join(self.active)))
        self.run(self.events[name], depth)

    def run(self, resp, depth):
        known = {"add", "remove", "sequence", "randomize", "trigger", "filters", "weight"}
        extra = set(resp) - known
        if extra:
            raise SimError("unsupported event keys %s" % sorted(extra))
        if not self.passes(resp):
            return
        if "remove" in resp:  # remove first (proved by vanilla villager_v2 schedule_* + camel start_sitting)
            for g in resp["remove"].get("component_groups", []):
                if g not in self.defs:
                    raise SimError("remove of unknown group %r" % g)
                if g in self.active:
                    self.active.remove(g)
                    self.timers.pop(g, None)
        if "add" in resp:
            for g in resp["add"].get("component_groups", []):
                if g not in self.defs:
                    raise SimError("add of unknown group %r" % g)
                if g in self.active:
                    self.readds += 1  # re-add of an active group re-initialises it
                    self.timers.pop(g, None)
                else:
                    self.active.append(g)
                self.start_timer(g)
        if "randomize" in resp:
            entries = resp["randomize"]
            total = sum(e.get("weight", 1) for e in entries)
            roll, acc = self.rng.uniform(0, total), 0
            for e in entries:
                acc += e.get("weight", 1)
                if roll <= acc:
                    self.run(e, depth + 1)
                    break
        if "sequence" in resp:
            for sub in resp["sequence"]:
                self.run(sub, depth + 1)
        if "trigger" in resp:
            t = resp["trigger"]
            self.fire(t if isinstance(t, str) else t["event"], depth + 1)

    # ---- timers ----------------------------------------------------------------
    def start_timer(self, g):
        tm = self.defs[g].get("minecraft:timer")
        if not tm:
            return
        t = tm["time"]
        if isinstance(t, list):
            lo, hi = t
            if self.sample == "min":
                dur = lo
            elif self.sample == "max":
                dur = hi
            elif tm.get("randomInterval", True):
                dur = self.rng.uniform(lo, hi)
            else:
                dur = lo
        else:
            dur = t
        self.timers[g] = {"deadline": self.time + dur, "spec": tm, "start": self.time}

    def run_timers(self, shuffle=False):
        due = [g for g, t in self.timers.items() if t["deadline"] <= self.time + 1e-9]
        if shuffle:
            self.rng.shuffle(due)
        for g in due:
            if g not in self.timers:  # removed by an earlier event this tick
                continue
            t = self.timers[g]
            ev = t["spec"]["time_down_event"]
            name = ev if isinstance(ev, str) else ev["event"]
            if t["spec"].get("looping", True):
                self.start_timer(g)
            else:
                self.timers.pop(g)
            self.fire(name)

    # ---- sensors / target model --------------------------------------------------
    def run_sensors(self):
        eff, _ = self.effective()
        s = eff.get("minecraft:environment_sensor")
        if not s:
            return
        trig = s["triggers"]
        for tr in ([trig] if isinstance(trig, dict) else trig):
            if self.passes(tr):
                self.fire(tr["event"])

    def acquire_target(self, who):
        self.target = who
        self.target_health = 20.0
        eff, _ = self.effective()
        h = eff.get("minecraft:on_target_acquired")
        if h:
            self.fire(h["event"])

    def lose_target(self):
        if self.target is None:
            return
        self.target = None
        eff, _ = self.effective()
        h = eff.get("minecraft:on_target_escape")
        if h:
            self.fire(h["event"])

    def target_dies(self, by_scp=False, kill_event_first=True):
        """The target's health drops to 0.  by_scp: the SCP's melee hit did it (melee on_kill fires).
        Whether the engine then clears the dead target depends on the world (see WORLDS)."""
        if self.target is None:
            return
        self.target_health = 0.0
        eff, _ = self.effective()
        kill = eff.get("minecraft:behavior.melee_box_attack", {}).get("on_kill") if by_scp else None
        if kill and kill_event_first:
            self.fire(kill["event"])
        if self.world == "A":
            self.lose_target()
        if kill and not kill_event_first:
            self.fire(kill["event"])

    def player_looks(self, who):
        """Engine lookat: only possible while `minecraft:lookat` is an active component."""
        eff, _ = self.effective()
        la = eff.get("minecraft:lookat")
        if not la or not la.get("set_target"):
            return False
        if self.target is not None and self.world != "B1":
            return False  # world A never has a target here; world B2 ignores lookers while a target is set
        self.acquire_target(who)
        return True

    def tick(self, shuffle=False):
        self.time += self.TICK
        if shuffle and self.rng.random() < 0.5:
            self.run_sensors()
            self.run_timers(shuffle=True)
        else:
            self.run_timers(shuffle=shuffle)
            self.run_sensors()

    def advance(self, seconds):
        for _ in range(int(round(seconds / self.TICK))):
            self.tick()

    def spawn(self):
        self.fire("minecraft:entity_spawned")


# --------------------------------------------------------------------------------------
# invariants
# --------------------------------------------------------------------------------------
def structural_problems(sim, settled=False):
    p = []
    if len(set(sim.active)) != len(sim.active):
        p.append("duplicate active groups %s" % sim.active)
    st = sim.state()
    if st is None:
        p.append("active groups %s are not one of the 4 legal states" % sorted(sim.active))
        return p
    if sim.variant() != STATES[st][1]:
        p.append("variant %s != %s for state %s" % (sim.variant(), STATES[st][1], st))
    for k, owners in sim.conflicts():
        p.append("component %s defined by several active groups %s" % (k, owners))
    eff, _ = sim.effective()
    in_rage = st in ("scream", "run")
    if in_rage and ("minecraft:lookat" in eff or "minecraft:on_target_acquired" in eff):
        p.append("lookat/on_target_acquired active while raging (would retarget other players)")
    if not in_rage and ("minecraft:lookat" not in eff or "minecraft:on_target_acquired" not in eff):
        p.append("calm state without lookat/on_target_acquired")
    if st != "run":
        for forbidden in ("minecraft:behavior.melee_box_attack", "minecraft:break_blocks",
                          "minecraft:annotation.break_door"):
            if forbidden in eff:
                p.append("%s active outside the run state" % forbidden)
    for never in ("minecraft:behavior.hurt_by_target", "minecraft:behavior.nearest_attackable_target",
                  "minecraft:despawn"):
        if never in eff:
            p.append("%s must never be present" % never)
    if set(sim.timers) - set(sim.active):
        p.append("timer leaked from removed group(s) %s" % sorted(set(sim.timers) - set(sim.active)))
    if settled and in_rage and (sim.target is None or sim.target_health <= 0):
        p.append("settled rage state without a living target (sensors failed to calm down)")
    return p


# --------------------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------------------
def check_format(rep, path):
    section("1. FORMAT")
    raw = open(path, "rb").read()
    rep.check(not raw.startswith(b"\xef\xbb\xbf"), "no UTF-8 BOM")
    rep.check(b"\r" not in raw, "LF line endings only")
    rep.check(raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "exactly one final newline")
    text = raw.decode("utf-8")
    try:
        doc = strict_loads(text)
        rep.check(True, "strict JSON (no comments, trailing commas, duplicate keys, NaN)")
    except Exception as e:
        rep.check(False, "strict JSON", str(e))
        return None
    rep.check(canonical_text(doc) == text, "canonical layout (python3 tools/sim_entity.py --rewrite to fix)")
    rep.check(doc.get("format_version") == "1.20.80", "format_version 1.20.80", repr(doc.get("format_version")))
    ent = doc.get("minecraft:entity", {})
    d = ent.get("description", {})
    rep.check(d == {"identifier": ENTITY_ID, "is_spawnable": True, "is_summonable": True, "is_experimental": False},
              "description is exactly identifier/is_spawnable/is_summonable/is_experimental=false", json.dumps(d))
    rep.check(set(ent) == {"description", "component_groups", "components", "events"}, "entity sections",
              str(sorted(ent)))
    return doc


def referenced_events(doc):
    """Yield (where, event_name) for every event reference found in components / groups."""
    ent = doc["minecraft:entity"]
    scopes = [("<base>", ent["components"])] + [(g, c) for g, c in ent["component_groups"].items()]
    for scope, comps in scopes:
        for ck, cv in comps.items():
            where = "%s/%s" % (scope, ck)
            if ck == "minecraft:timer":
                ev = cv.get("time_down_event")
                if ev is not None:
                    yield where, ev if isinstance(ev, str) else ev["event"]
            elif ck in ("minecraft:on_target_acquired", "minecraft:on_target_escape"):
                if "event" in cv:
                    yield where, cv["event"]
            elif ck == "minecraft:environment_sensor":
                trig = cv["triggers"]
                for t in ([trig] if isinstance(trig, dict) else trig):
                    if "event" in t:
                        yield where, t["event"]
            elif ck == "minecraft:damage_sensor":
                trig = cv["triggers"]
                for t in ([trig] if isinstance(trig, dict) else trig):
                    od = t.get("on_damage", {})
                    if "event" in od:
                        yield where, od["event"]
            elif ck == "minecraft:lookat":
                if "look_event" in cv:
                    yield where, cv["look_event"]


def referenced_groups(events):
    def walk(node):
        if isinstance(node, dict):
            for k in ("add", "remove"):
                if k in node:
                    for g in node[k].get("component_groups", []):
                        yield g
            for k, v in node.items():
                if k not in ("add", "remove"):
                    yield from walk(v)
        elif isinstance(node, list):
            for x in node:
                yield from walk(x)

    for en, ev in events.items():
        for g in walk(ev):
            yield en, g


def check_refs(rep, doc):
    section("2. REFERENCES")
    ent = doc["minecraft:entity"]
    events, groups = ent["events"], ent["component_groups"]
    refs = list(referenced_events(doc))
    for where, ev in refs:
        rep.check(ev in events, "event %s (referenced by %s) exists" % (ev, where))
    used_events = {ev for _w, ev in refs} | ENGINE_EVENTS
    for ev in events:
        rep.check(ev in used_events, "event %s is referenced by something (or engine-fired)" % ev)
    rep.check(set(events) == set(EVENTS) | ENGINE_EVENTS, "event set == DESIGN.md section 5", str(sorted(events)))
    grefs = list(referenced_groups(events))
    for en, g in grefs:
        rep.check(g in groups, "group %s (used by %s) exists" % (g, en))
    used_groups = {g for _e, g in grefs}
    for g in groups:
        rep.check(g in used_groups, "group %s is added/removed by some event" % g)
    rep.check(set(groups) == set(ALL_GROUPS), "group set == DESIGN.md section 5", str(sorted(groups)))
    print("  %d event references, %d group references checked" % (len(refs), len(grefs)))


def scenario(doc, seed=1, sample="random", world="A"):
    s = Sim(doc, random.Random(seed), sample, world)
    s.spawn()
    return s


def expect_state(rep, sim, name, label):
    got = sim.state()
    ok = got == name and not structural_problems(sim)
    rep.check(ok, label, "state=%s groups=%s problems=%s" % (got, sim.active, structural_problems(sim)))
    return ok


def check_walkthrough(rep, doc):
    section("3a. SIM walkthrough (DESIGN.md section 5)")
    # --- spawn ---
    s = scenario(doc)
    expect_state(rep, s, "sit", "spawn -> sit, variant 0, calm group present")
    rep.check(s.variant() == 0, "spawn variant == 0")
    # --- sit -> walk -> sit, with min and max timers ---
    for mode, (lo_s, hi_s) in (("min", (12, 12)), ("max", (30, 30))):
        s = scenario(doc, sample=mode)
        s.advance(lo_s - 0.2)
        rep.check(s.state() == "sit", "sit lasts until the %s timer (%s s)" % (mode, lo_s))
        s.advance(0.5)
        expect_state(rep, s, "walk", "begin_walk after %s sit timer -> walk, variant 1" % mode)
    s = scenario(doc, sample="min")
    s.advance(12.2)
    s.advance(8.0)
    expect_state(rep, s, "sit", "begin_sit after 8 s walk -> sit, variant 0, calm restored")
    rep.check(G_CALM in s.active, "calm group still present after walk -> sit")
    # sit/walk cycle for 20 simulated minutes, random timers
    for seed in range(2 if FAST else 5):
        s = scenario(doc, seed)
        seen = set()
        for _ in range(int((240 if FAST else 1200) / Sim.TICK)):
            s.tick()
            seen.add(s.state())
            pr = structural_problems(s)
            if pr:
                rep.check(False, "sit/walk cycle seed %d invariant" % seed, "; ".join(pr))
                break
        else:
            rep.check(seen == {"sit", "walk"}, "sit<->walk cycle (%d min) seed %d visits only sit+walk" % (4 if FAST else 20, seed), str(seen))
    # --- enrage from sit ---
    s = scenario(doc)
    s.advance(1.0)
    rep.check(s.player_looks("A"), "player looks at sitting SCP -> lookat acquires target")
    expect_state(rep, s, "scream", "enrage from sit -> scream, variant 2")
    t_scream = s.time
    # --- other player cannot retarget ---
    rep.check(not s.player_looks("B"), "second player looking during rage is ignored (no lookat component)")
    expect_state(rep, s, "scream", "still scream after second player looked")
    # --- scream 3..5 s then run ---
    s.advance(2.9)
    expect_state(rep, s, "scream", "still screaming 2.9 s after enrage")
    s.advance(2.2)
    expect_state(rep, s, "run", "run (variant 3) by 5.1 s after enrage")
    # --- target dies in run: melee on_kill, on_target_escape and the sensors all fire ---
    s.target_dies(by_scp=True)
    expect_state(rep, s, "sit", "target dies while running -> calm_down -> sit(0)")
    eff, _ = s.effective()
    rep.check(G_CALM in s.active and "minecraft:lookat" in eff, "calm group (lookat) restored after calm_down")
    rep.check(s.variant() == 0, "variant 0 after calm_down")
    s.tick()
    expect_state(rep, s, "sit", "sensor tick after calm_down does not disturb calm state")
    # --- re-trigger works a second time ---
    rep.check(s.player_looks("B"), "after calming, a (different) player can trigger again")
    expect_state(rep, s, "scream", "second enrage -> scream")
    # --- enrage from walk ---
    s = scenario(doc, sample="min")
    s.advance(12.5)
    expect_state(rep, s, "walk", "precondition: walking")
    rep.check(s.player_looks("A"), "player looks at walking SCP -> acquires target")
    expect_state(rep, s, "scream", "enrage from walk -> scream, variant 2")
    eff, _ = s.effective()
    rep.check(G_WALK not in s.active and "minecraft:behavior.random_stroll" not in eff, "walk goals gone while screaming")
    s.advance(5.1)
    expect_state(rep, s, "run", "scream -> run after <= 5 s")
    # --- calm_down from scream ---
    s = scenario(doc)
    s.player_looks("A")
    s.advance(1.0)
    expect_state(rep, s, "scream", "precondition: screaming")
    s.target_dies()
    expect_state(rep, s, "sit", "target dies while screaming -> calm_down -> sit(0)")
    # --- scream duration distribution ---
    durs = []
    for seed in range(60 if FAST else 300):
        s = scenario(doc, seed)
        s.player_looks("A")
        t0 = s.time
        while s.state() == "scream":
            s.tick()
        durs.append(s.time - t0)
    rep.check(min(durs) >= 3.0 - 1e-6 and max(durs) <= 5.0 + Sim.TICK + 1e-6,
              "scream lasts 3..5 s over %d random runs" % len(durs), "min=%.2f max=%.2f" % (min(durs), max(durs)))
    print("  scream durations: min %.2f s, max %.2f s, mean %.2f s" % (min(durs), max(durs), sum(durs) / len(durs)))
    # --- sensor alone (no on_target_escape) also calms: simulate a silently cleared target ---
    s = scenario(doc)
    s.player_looks("A")
    s.advance(3.0)
    s.target = None  # target vanished without an escape trigger
    s.tick()
    expect_state(rep, s, "sit", "has_target==false sensor alone calms the SCP (redundancy)")
    # --- double calm_down in the same tick (escape + sensor) ---
    s = scenario(doc)
    s.player_looks("A")
    s.advance(4.0)
    s.target_dies(by_scp=True)
    s.fire("scp096:calm_down")
    s.tick()
    expect_state(rep, s, "sit", "duplicate calm_down in one tick leaves exactly calm+sit")


# expected result of "can a player trigger the SCP again after it calmed down?" per world.
# B2 (lookat ignores everybody while a stale dead target is set) is a KNOWN LIMITATION: JSON cannot clear a target.
RETRIGGER_EXPECTED = {"A": (True, True), "B1": (True, True), "B2": (False, False)}


def check_worlds(rep, doc):
    section("3a2. SIM dead-target worlds (what the engine does with a dead target is unknown)")
    print("  world  scp kills(on_kill 1st)  scp kills(engine 1st)  dies in run  dies in scream  re-trigger: victim / other")
    for world in Sim.WORLDS:
        cells = []
        for label, setup in (
            ("scp kill, on_kill first", lambda s: s.target_dies(by_scp=True, kill_event_first=True)),
            ("scp kill, engine first", lambda s: s.target_dies(by_scp=True, kill_event_first=False)),
            ("other death in run", lambda s: s.target_dies()),
        ):
            s = scenario(doc, world=world)
            s.player_looks("A")
            s.advance(5.2)
            expect_state(rep, s, "run", "[%s] precondition: running (%s)" % (world, label))
            setup(s)
            s.tick()
            ok = s.state() == "sit" and not structural_problems(s, settled=True)
            rep.check(ok, "[%s] %s -> calm sit within 1 tick" % (world, label), "state=%s" % s.state())
            cells.append("ok" if ok else "FAIL")
            if label.startswith("other"):
                again = {}
                for who, nm in (("A", "victim"), ("B", "other")):
                    s2 = scenario(doc, world=world)
                    s2.player_looks("A")
                    s2.advance(5.2)
                    s2.target_dies()
                    s2.tick()
                    s2.advance(2.0)
                    got = s2.player_looks(who) and s2.state() == "scream"
                    again[nm] = got
                exp = RETRIGGER_EXPECTED[world]
                rep.check((again["victim"], again["other"]) == exp,
                          "[%s] re-trigger after calm: victim=%s other=%s (expected %s)" % (world, again["victim"], again["other"], exp))
                retr = "%s / %s%s" % (again["victim"], again["other"], "  <- KNOWN LIMITATION" if exp == (False, False) else "")
        s = scenario(doc, world=world)
        s.player_looks("A")
        s.advance(1.0)
        s.target_dies()
        s.tick()
        ok_scream = s.state() == "sit" and not structural_problems(s, settled=True)
        rep.check(ok_scream, "[%s] target dies while screaming -> calm sit" % world, "state=%s" % s.state())
        print("  %-5s  %-22s  %-21s  %-11s  %-14s  %s" % (world, cells[0], cells[1], cells[2], "ok" if ok_scream else "FAIL", retr))
    # a world-B stale dead target must not make the calm SCP walk/sit cycle misbehave either
    s = scenario(doc, world="B2")
    s.player_looks("A")
    s.advance(5.2)
    s.target_dies()
    s.tick()
    seen = set()
    for _ in range(int(120 / Sim.TICK)):
        s.tick()
        seen.add(s.state())
    rep.check(seen == {"sit", "walk"} and not structural_problems(s), "[B2] calm sit<->walk cycle continues with a stale target", str(seen))


def check_stale_events(rep, doc):
    section("3b. SIM stale / duplicated / reordered events")
    # begin_walk / begin_sit stale during rage must be ignored
    for st_name, prep in (("scream", lambda s: (s.player_looks("A"), s.advance(0.5))),
                          ("run", lambda s: (s.player_looks("A"), s.advance(5.1)))):
        for ev in ("scp096:begin_walk", "scp096:begin_sit"):
            s = scenario(doc)
            prep(s)
            before = (s.state(), list(s.active))
            s.fire(ev)
            rep.check((s.state(), list(s.active)) == before and not structural_problems(s),
                      "stale %s during %s is ignored" % (ev, st_name))
    # begin_sit while sitting, begin_walk while walking
    s = scenario(doc)
    s.fire("scp096:begin_sit")
    expect_state(rep, s, "sit", "begin_sit while sitting is a no-op")
    s.fire("scp096:begin_walk")
    s.fire("scp096:begin_walk")
    expect_state(rep, s, "walk", "begin_walk twice -> walk once (no duplicate pose groups)")
    # begin_run stale during calm: becomes run for <= 1 tick, sensor heals it
    s = scenario(doc)
    s.fire("scp096:begin_run")
    rep.check(s.state() == "run" and not structural_problems(s), "stale begin_run in calm is still ONE legal state")
    s.tick()
    expect_state(rep, s, "sit", "stale begin_run (no target) is healed by the has_target sensor")
    # enrage fired twice
    s = scenario(doc)
    s.player_looks("A")
    s.fire("scp096:enrage")
    expect_state(rep, s, "scream", "duplicate enrage keeps a single scream group")
    # timer + lookat in the same tick, both orders
    for order in ("timer_first", "look_first"):
        s = scenario(doc, sample="min")
        s.advance(11.95)
        s.time += Sim.TICK
        if order == "timer_first":
            s.run_timers()
            s.player_looks("A")
        else:
            s.player_looks("A")
            s.run_timers()
        expect_state(rep, s, "scream", "same-tick sit timer + lookat (%s) -> scream, nothing leaked" % order)
    # walk timer firing in the same tick as the lookat
    for order in ("timer_first", "look_first"):
        s = scenario(doc, sample="min")
        s.advance(12.05)
        s.advance(7.95)
        s.time += Sim.TICK
        if order == "timer_first":
            s.run_timers()
            s.player_looks("A")
        else:
            s.player_looks("A")
            s.run_timers()
        expect_state(rep, s, "scream", "same-tick walk timer + lookat (%s) -> scream" % order)


def check_graph(rep, doc):
    section("3c. SIM exhaustive transition table + fuzz")
    spawn = scenario(doc)
    start_active = list(spawn.active)
    all_events = EVENTS
    table = {}
    for st, (gs, _v) in STATES.items():
        for ev in all_events:
            s = Sim(doc, random.Random(0))
            s.active = [g for g in ALL_GROUPS if g in gs]
            s.target = "A" if st in ("scream", "run") else None
            for g in list(s.active):
                s.start_timer(g)
            s.fire(ev)
            pr = structural_problems(s)
            rep.check(not pr and s.state() is not None, "(%s) --%s--> legal single state" % (st, ev), "; ".join(pr))
            table[(st, ev)] = s.state()
    names = list(STATES)
    print("  transition table (rows = current state, columns = injected event):")
    print("    %-8s" % "" + "".join("%-13s" % e.split(":")[1] for e in all_events))
    for st in names:
        print("    %-8s" % st + "".join("%-13s" % table[(st, e)] for e in all_events))
    # expected cells
    exp = {
        ("sit", "scp096:begin_walk"): "walk", ("sit", "scp096:begin_sit"): "sit",
        ("walk", "scp096:begin_walk"): "walk", ("walk", "scp096:begin_sit"): "sit",
        ("scream", "scp096:begin_walk"): "scream", ("scream", "scp096:begin_sit"): "scream",
        ("run", "scp096:begin_walk"): "run", ("run", "scp096:begin_sit"): "run",
    }
    for st in names:
        exp[(st, "scp096:enrage")] = "scream"
        exp[(st, "scp096:begin_run")] = "run"
        exp[(st, "scp096:calm_down")] = "sit"
    bad = {k: (v, table[k]) for k, v in exp.items() if table[k] != v}
    rep.check(not bad, "transition table equals the intended one", str(bad))
    # fuzz: random interleavings of ticks, looks, target loss, stale events
    fuzz_steps, bad_runs = 0, 0
    n_seeds, n_steps = (6, 1500) if FAST else (45, 4000)
    for seed in range(n_seeds):
        rng = random.Random(1000 + seed)
        s = Sim(doc, rng, world=Sim.WORLDS[seed % 3])
        s.spawn()
        for _ in range(n_steps):
            r = rng.random()
            if r < 0.55:
                s.tick(shuffle=True)
                pr = structural_problems(s, settled=True)
            elif r < 0.70:
                s.player_looks(rng.choice("ABC"))
                pr = structural_problems(s)
            elif r < 0.76:
                s.lose_target()
                pr = structural_problems(s)
            elif r < 0.82:
                s.target_dies(by_scp=rng.random() < 0.5, kill_event_first=rng.random() < 0.5)
                pr = structural_problems(s)
            else:
                s.fire(rng.choice(EVENTS))
                pr = structural_problems(s)
            fuzz_steps += 1
            if pr:
                bad_runs += 1
                print("    fuzz seed %d: %s" % (seed, "; ".join(pr)))
                print("      last log: " + " | ".join(s.log[-4:]))
                break
    rep.check(bad_runs == 0, "fuzz: %d random steps over %d seeds keep every invariant" % (fuzz_steps, n_seeds))
    rep.check(start_active == [G_CALM, G_SIT], "spawn activates exactly [calm, pose_sit]", str(start_active))


def check_design_values(rep, doc):
    section("3d. DESIGN.md values per state")
    s = scenario(doc)
    eff, _ = s.effective()

    def get(k, field=None):
        v = eff.get(k)
        return v if field is None or v is None else v.get(field)

    rep.check(get("minecraft:health") == {"value": 500, "max": 500}, "health 500/500")
    rep.check(get("minecraft:knockback_resistance", "value") == 1.0, "knockback_resistance 1.0")
    rep.check(get("minecraft:follow_range", "value") >= 64, "follow_range >= 64")
    rep.check(get("minecraft:attack", "damage") >= 100, "attack damage >= 100 (one-hit kill)", str(get("minecraft:attack")))
    ds = get("minecraft:damage_sensor")["triggers"]
    rep.check(ds.get("cause") == "all" and ds.get("deals_damage") is True and 0 < ds.get("damage_multiplier", 1) <= 0.1,
              "damage_sensor: all causes, deals_damage true, multiplier <= 0.1", json.dumps(ds))
    rep.check("minecraft:persistent" in eff and "minecraft:despawn" not in json.dumps(doc), "persistent and no despawn anywhere")
    fam = get("minecraft:type_family", "family")
    rep.check("monster" not in fam and "mob" in fam and "scp096" in fam, "families exclude monster", str(fam))
    nav = get("minecraft:navigation.walk")
    rep.check(nav.get("can_break_doors") is True and nav.get("can_path_over_water") is False, "navigation.walk flags", json.dumps(nav))
    rep.check(doc["minecraft:entity"]["components"].get("minecraft:collision_box") == {"width": 0.7, "height": 2.8},
              "base collision_box 0.7 x 2.8")
    txt = json.dumps(doc)
    for never in ("hurt_by_target", "nearest_attackable_target", "look_event", "minecraft:loot", "spawn_rules"):
        rep.check(never not in txt, "no %s anywhere" % never)

    def state_eff(name):
        sim = Sim(doc)
        sim.active = [g for g in ALL_GROUPS if g in STATES[name][0]]
        return sim.effective()[0]

    e = state_eff("sit")
    rep.check(e["minecraft:collision_box"] == {"width": 0.9, "height": 1.5}, "sit: collision 0.9 x 1.5")
    rep.check(e["minecraft:movement"]["value"] == 0.0, "sit: movement 0")
    rep.check(e["minecraft:timer"]["time"] == [12, 30], "sit: timer 12..30 s")
    la = e["minecraft:lookat"]
    rep.check(la["search_radius"] == 64.0 and la["set_target"] is True and la["look_cooldown"] == 5.0
              and la["filters"] == {"all_of": [{"subject": "other", "test": "is_family", "value": "player"}]},
              "calm: lookat equals the vanilla enderman form (player family)")
    rep.check(e["minecraft:on_target_acquired"] == {"event": "scp096:enrage", "target": "self"}, "calm: on_target_acquired -> enrage")
    e = state_eff("walk")
    rep.check(e["minecraft:collision_box"] == {"width": 0.7, "height": 2.8}, "walk: collision 0.7 x 2.8")
    rep.check(0.04 <= e["minecraft:movement"]["value"] <= 0.1, "walk: movement ~0.06", str(e["minecraft:movement"]))
    rep.check(e["minecraft:behavior.random_stroll"]["speed_multiplier"] <= 1.0, "walk: random_stroll speed_multiplier <= 1")
    rep.check("minecraft:behavior.random_look_around" in e and e["minecraft:timer"]["time"] == [8, 20], "walk: random_look_around + timer 8..20 s")
    e = state_eff("scream")
    rep.check(e["minecraft:movement"]["value"] == 0.0 and e["minecraft:timer"]["time"] == [3, 5], "scream: rooted, timer 3..5 s")
    rep.check("minecraft:on_target_escape" in e and "minecraft:environment_sensor" in e, "scream: target-lost safety (escape + sensor)")
    e = state_eff("run")
    rep.check(e["minecraft:movement"]["value"] >= 0.3, "run: movement >= 0.3 (very fast)", str(e["minecraft:movement"]))
    mba = e["minecraft:behavior.melee_box_attack"]
    rep.check(mba.get("track_target") is True and mba.get("speed_multiplier") == 1.0, "run: melee_box_attack tracks target")
    rep.check(e["minecraft:annotation.break_door"]["break_time"] <= 3, "run: annotation.break_door fast", json.dumps(e["minecraft:annotation.break_door"]))
    rep.check(len(e["minecraft:break_blocks"]["breakable_blocks"]) > 100, "run: break_blocks list present")
    rep.check("minecraft:on_target_escape" in e and "minecraft:environment_sensor" in e, "run: target-lost safety (escape + sensor)")
    rep.check(mba.get("on_kill") == {"event": "scp096:calm_down", "target": "self"}, "run: melee on_kill -> calm_down")
    for gname in (G_SCREAM, G_RUN):
        trig = doc["minecraft:entity"]["component_groups"][gname]["minecraft:environment_sensor"]["triggers"]
        flt = sorted((t["filters"].get("test"), t["filters"].get("subject"), t["filters"].get("operator", "=="),
                      t["filters"].get("value"), t["event"]) for t in trig)
        want = sorted([("has_target", "self", "==", False, "scp096:calm_down"),
                       ("actor_health", "target", "<=", 0, "scp096:calm_down")])
        rep.check(flt == want, "%s: sensors = no target OR target health <= 0 -> calm_down" % gname, str(flt))
        rep.check(doc["minecraft:entity"]["component_groups"][gname]["minecraft:on_target_escape"]
                  == {"event": "scp096:calm_down", "target": "self"}, "%s: on_target_escape -> calm_down" % gname)


def check_blocks(rep, doc, blocks_json):
    section("5. BLOCK LIST (minecraft:break_blocks)")
    run = doc["minecraft:entity"]["component_groups"][G_RUN]
    lst = run["minecraft:break_blocks"]["breakable_blocks"]
    mb = json.load(open(blocks_json, encoding="utf-8"))
    names = {x["name"] for x in mb["data_items"]}
    print("  %d entries; registry (%s) has %d blocks" % (len(lst), mb.get("minecraft_version"), len(names)))
    rep.check(len(lst) == len(set(lst)), "no duplicate entries")
    missing = [n for n in lst if "minecraft:" + n not in names]
    rep.check(not missing, "every entry exists as minecraft:<name> in mojang-blocks.json", str(missing[:10]))
    rep.check(all(n == n.lower() and ":" not in n and n.strip() == n for n in lst), "entries are lower-case, un-prefixed (vanilla ravager spelling)")
    deny = [n for n in lst if n in DENY_EXACT or any(sub in n for sub in DENY_SUBSTR)]
    rep.check(not deny, "no deny-listed block (bedrock/obsidian/reinforced deepslate/command/containers/...)", str(deny))
    must = ["oak_leaves", "azalea_leaves", "mangrove_leaves", "oak_log", "stripped_oak_wood", "oak_planks", "wooden_door",
            "iron_door", "trapdoor", "iron_trapdoor", "fence_gate", "oak_fence", "glass", "glass_pane", "tinted_glass",
            "white_stained_glass", "white_stained_glass_pane", "white_wool", "web", "ladder", "hay_block", "bamboo",
            "scaffolding", "oak_slab", "oak_stairs", "standing_sign", "wall_sign", "oak_hanging_sign", "crimson_stem",
            "crimson_hyphae", "cherry_leaves", "acacia_door", "warped_door", "oak_double_slab"]
    rep.check(all(m in lst for m in must), "all required soft block families present", str([m for m in must if m not in lst]))
    cats = {
        "leaves": sum(n.endswith("_leaves") or n == "azalea_leaves_flowered" for n in lst),
        "logs/wood/stems": sum(bool(re.search(r"_(log|wood|stem|hyphae)$", n)) for n in lst),
        "planks": sum(n.endswith("_planks") for n in lst),
        "doors": sum(n.endswith("door") and "trap" not in n for n in lst),
        "trapdoors": sum(n.endswith("trapdoor") or n == "trapdoor" for n in lst),
        "fences+gates": sum("fence" in n for n in lst),
        "glass": sum("glass" in n for n in lst),
        "wool+carpet": sum(n.endswith("_wool") or n.endswith("_carpet") for n in lst),
        "slabs/stairs": sum(bool(re.search(r"(slab|stairs)$", n)) for n in lst),
        "signs": sum(n.endswith("sign") for n in lst),
    }
    print("  categories: " + ", ".join("%s=%d" % kv for kv in cats.items()))
    rep.check(all(v > 0 for v in cats.values()), "every requested family is represented")
    return lst, names


def vanilla_ravager_report(vanilla_dir, names):
    path = os.path.join(vanilla_dir, "behavior_pack", "entities", "ravager.json")
    doc = lenient_load(path)
    lst = doc["minecraft:entity"]["components"]["minecraft:break_blocks"]["breakable_blocks"]
    legacy = [n for n in lst if "minecraft:" + n not in names]
    print("  vanilla ravager.json: %d entries, all un-prefixed; %d of them are NOT block names in mojang-blocks.json: %s"
          % (len(lst), len(legacy), ", ".join(legacy)))


def check_corpus(rep, doc, vanilla_dir, want_table):
    section("4. VANILLA CORPUS (component / field / enum-value audit)")
    ent_dir = os.path.join(vanilla_dir, "behavior_pack", "entities")
    cpaths, cvalues, nfiles, bad = build_corpus(ent_dir)
    print("  corpus: %d vanilla behavior_pack/entities files, %d distinct key paths, %d enum values%s"
          % (nfiles, len(cpaths), len(cvalues), (", unparsable: %s" % bad) if bad else ""))
    rep.check(not bad and nfiles > 100, "corpus parsed")
    opaths, ovalues = index_entity(doc, None)
    unproven_paths = sorted(p for p in opaths if p not in cpaths)
    strict_missing = sorted(((p, v) for (p, v) in ovalues if (p, v) not in cvalues), key=lambda x: (x[0], str(x[1])))
    # filter tests / subjects / operators are generic: accept a value that the corpus uses in ANY filter context
    anywhere = {}
    for (p, v), locs in cvalues.items():
        anywhere.setdefault((p[-1], v), []).extend(locs)
    unproven_vals = [(p, v) for (p, v) in strict_missing if (p[-1], v) not in anywhere]
    contextual = [(p, v) for (p, v) in strict_missing if (p[-1], v) in anywhere]
    # top-level (component, field) view requested by the task
    pairs = sorted(p for p in opaths if len(p) == 2 and not p[0].startswith("<"))
    unproven_pairs = [p for p in pairs if p not in cpaths]
    print("  (component, field) pairs in the entity: %d, unproven: %d" % (len(pairs), len(unproven_pairs)))
    print("  all key paths in the entity: %d, unproven: %d" % (len(opaths), len(unproven_paths)))
    print("  enum-like values in the entity: %d, not at the same path in the corpus: %d, unproven anywhere: %d"
          % (len(ovalues), len(strict_missing), len(unproven_vals)))
    for p in unproven_paths:
        print("    UNPROVEN PATH  %s" % " / ".join(p))
    for p, v in contextual:
        print("    CONTEXTUAL     %s = %r  (value proven in other filter contexts: %s)"
              % (" / ".join(p), v, ", ".join(best_proofs(anywhere[(p[-1], v)], 3))))
    for p, v in unproven_vals:
        print("    UNPROVEN VALUE %s = %r" % (" / ".join(p), v))
    comps = sorted({p[0] for p in opaths if not p[0].startswith("<")})
    unproven_comps = [c for c in comps if (c,) not in cpaths]
    rep.check(not unproven_comps, "every component name occurs in the vanilla corpus", str(unproven_comps))
    rep.check(not unproven_paths, "every (component, field, ...) path occurs in the vanilla corpus")
    rep.check(not unproven_vals, "every enum-like value (test/subject/operator/cause/...) occurs in the vanilla corpus")
    if want_table:
        print("\n  PROOF TABLE  (component -> field paths -> first vanilla occurrences as file:line)")
        for c in comps:
            proofs = best_proofs(cpaths.get((c,), []), 3)
            print("  %-42s %s" % (c, ", ".join(proofs) if proofs else "-- NONE --"))
            for p in sorted(p for p in opaths if p[0] == c and len(p) > 1):
                pr = best_proofs(cpaths.get(p, []), 2)
                print("      %-60s %s" % ("/".join(p[1:]), ", ".join(pr) if pr else "-- NONE --"))
        print("\n  EVENT / DESCRIPTION / ENUM PROOFS")
        for p in sorted(p for p in opaths if p[0].startswith("<")):
            pr = best_proofs(cpaths.get(p, []), 2)
            print("      %-60s %s" % ("/".join(p), ", ".join(pr) if pr else "-- NONE --"))
        for (p, v) in sorted(ovalues, key=lambda x: (x[0], str(x[1]))):
            pr = best_proofs(cvalues.get((p, v), []), 2)
            print("      %-60s %-18s %s" % ("/".join(p), repr(v), ", ".join(pr) if pr else "-- NONE --"))
    return cpaths


def _event_responses(node):
    """Yield every response object (event body, sequence element, randomize entry) below an event."""
    if isinstance(node, dict):
        yield node
        for k in ("sequence", "randomize"):
            for sub in node.get(k, []) if isinstance(node.get(k), list) else []:
                yield from _event_responses(sub)


def check_engine_assumptions(rep, vanilla_dir):
    """The simulator encodes a few engine rules. Prove each one is exercised by a vanilla entity."""
    section("6. ENGINE-SEMANTICS EVIDENCE (mechanically mined from the vanilla corpus)")
    docs, _bad = load_vanilla_docs(os.path.join(vanilla_dir, "behavior_pack", "entities"))
    same_group, variant_filter, swap_shared, override = [], [], [], []
    for fn, doc in docs.items():
        ent = doc["minecraft:entity"]
        groups = ent.get("component_groups", {})
        for en, ev in ent.get("events", {}).items():
            for r in _event_responses(ev):
                add = r.get("add", {}).get("component_groups", []) if isinstance(r.get("add"), dict) else []
                rem = r.get("remove", {}).get("component_groups", []) if isinstance(r.get("remove"), dict) else []
                if set(add) & set(rem):
                    same_group.append((fn, en, sorted(set(add) & set(rem))[0]))
                shared = set()
                for a in add:
                    for rname in rem:
                        if a != rname and a in groups and rname in groups:
                            shared |= set(groups[a]) & set(groups[rname])
                if shared and "minecraft:collision_box" in shared:
                    swap_shared.append((fn, en, "add before remove in JSON" if list(r).index("add") < list(r).index("remove") else "remove first"))
                flt = r.get("filters")
                if flt and "is_variant" in json.dumps(flt) and ("add" in r or "remove" in r):
                    variant_filter.append((fn, en))
        base = ent.get("components", {})
        for gname, g in groups.items():
            for c in g:
                if c in base and c in ("minecraft:movement", "minecraft:variant", "minecraft:navigation.walk", "minecraft:collision_box"):
                    override.append((fn, gname, c))

    def show(label, rows, minimum=1):
        print("  %-62s %d found, e.g. %s" % (label, len(rows), "; ".join("/".join(r) for r in rows[:2]) or "-"))
        rep.check(len(rows) >= minimum, "corpus evidence: " + label)

    show("event removes AND re-adds the same group (remove-then-add, idempotent setters)", same_group)
    show("groups sharing collision_box swapped by one event (camel sit/stand)", swap_shared)
    show("event-level 'sequence' + is_variant filter + add/remove", variant_filter)
    show("group overrides a base component (movement/variant/navigation/collision_box)", override)


# --------------------------------------------------------------------------------------
def run_doc_checks(rep, doc, vanilla_dir, want_table=False):
    """Everything except the file-format check (so mutated in-memory documents can be tested)."""
    check_refs(rep, doc)
    try:
        check_walkthrough(rep, doc)
        check_worlds(rep, doc)
        check_stale_events(rep, doc)
        check_graph(rep, doc)
        check_design_values(rep, doc)
    except Exception as e:  # SimError, KeyError (component missing), TypeError ... = the document is broken
        rep.check(False, "simulation ran without interpreter errors", "%s: %s" % (type(e).__name__, e))
    blocks_json = os.path.join(vanilla_dir, "metadata", "vanilladata_modules", "mojang-blocks.json")
    try:
        check_corpus(rep, doc, vanilla_dir, want_table)
        _lst, names = check_blocks(rep, doc, blocks_json)
        vanilla_ravager_report(vanilla_dir, names)
        check_engine_assumptions(rep, vanilla_dir)
    except Exception as e:
        rep.check(False, "corpus / block audit ran", "%s: %s" % (type(e).__name__, e))


def mutants(doc):
    """(name, mutated copy) pairs. Each one breaks exactly one promise; the verifier must notice."""
    out = []

    def mut(name, fn):
        d = copy.deepcopy(doc)
        fn(d["minecraft:entity"])
        out.append((name, d))

    g = lambda e, n: e["component_groups"][n]
    mut("begin_walk loses its is_variant guard", lambda e: e["events"]["scp096:begin_walk"]["sequence"][0].pop("filters"))
    mut("begin_sit loses its is_variant guard", lambda e: e["events"]["scp096:begin_sit"]["sequence"][0].pop("filters"))
    mut("begin_run keeps the scream group", lambda e: e["events"]["scp096:begin_run"]["remove"].update(
        {"component_groups": ["scp096:calm"]}))
    mut("calm_down forgets to restore calm", lambda e: e["events"]["scp096:calm_down"]["add"].update(
        {"component_groups": ["scp096:pose_sit"]}))
    mut("enrage forgets to remove pose_walk", lambda e: e["events"]["scp096:enrage"]["remove"].update(
        {"component_groups": ["scp096:calm", "scp096:pose_sit"]}))
    mut("rage_run variant is 2", lambda e: g(e, "scp096:rage_run")["minecraft:variant"].update({"value": 2}))
    mut("scream lasts 1..2 s", lambda e: g(e, "scp096:rage_scream")["minecraft:timer"].update({"time": [1, 2]}))
    mut("run group loses target-lost safety", lambda e: (g(e, "scp096:rage_run").pop("minecraft:on_target_escape"),
                                                           g(e, "scp096:rage_run").pop("minecraft:environment_sensor")))
    mut("run group loses melee on_kill", lambda e: g(e, "scp096:rage_run")["minecraft:behavior.melee_box_attack"].pop("on_kill"))
    mut("rage groups lose the target-health sensor trigger", lambda e: [
        g(e, n)["minecraft:environment_sensor"]["triggers"].pop() for n in ("scp096:rage_scream", "scp096:rage_run")])
    mut("rage groups lose the has_target sensor trigger", lambda e: [
        g(e, n)["minecraft:environment_sensor"]["triggers"].pop(0) for n in ("scp096:rage_scream", "scp096:rage_run")])
    mut("lookat leaks into the scream group", lambda e: g(e, "scp096:rage_scream").update(
        {"minecraft:lookat": copy.deepcopy(g(e, "scp096:calm")["minecraft:lookat"])}))
    mut("unknown field minecraft:movement/speed_x", lambda e: g(e, "scp096:rage_run")["minecraft:movement"].update({"speed_x": 1}))
    mut("bedrock in break_blocks", lambda e: g(e, "scp096:rage_run")["minecraft:break_blocks"]["breakable_blocks"].append("bedrock"))
    mut("prefixed block name", lambda e: g(e, "scp096:rage_run")["minecraft:break_blocks"]["breakable_blocks"].append("minecraft:oak_log"))
    mut("made-up block name", lambda e: g(e, "scp096:rage_run")["minecraft:break_blocks"]["breakable_blocks"].append("oak_leaves2"))
    mut("timer fires a missing event", lambda e: g(e, "scp096:pose_sit")["minecraft:timer"]["time_down_event"].update(
        {"event": "scp096:begin_stroll"}))
    mut("minecraft:despawn added", lambda e: e["components"].update({"minecraft:despawn": {"despawn_from_distance": {}}}))
    mut("damage_sensor multiplier 1.0", lambda e: e["components"]["minecraft:damage_sensor"]["triggers"].update(
        {"damage_multiplier": 1.0}))
    mut("hurt_by_target added to base", lambda e: e["components"].update({"minecraft:behavior.hurt_by_target": {"priority": 1}}))
    mut("sensor tests an unproven value (cause)", lambda e: e["components"]["minecraft:damage_sensor"]["triggers"].update(
        {"cause": "everything"}))
    mut("melee attack left in the sit group", lambda e: g(e, "scp096:pose_sit").update(
        {"minecraft:behavior.melee_box_attack": {"priority": 2}}))
    mut("unused group", lambda e: e["component_groups"].update({"scp096:orphan": {"minecraft:variant": {"value": 9}}}))
    return out


def selftest(vanilla_dir, entity_path):
    global FAST
    FAST = True
    doc = strict_loads(open(entity_path, encoding="utf-8").read())
    with contextlib.redirect_stdout(io.StringIO()):
        base = Report()
        run_doc_checks(base, doc, vanilla_dir)
    print("selftest: unmodified entity -> %d checks, %d failed" % (len(base.checks), len(base.failed)))
    missed = 0 if not base.failed else 1
    if base.failed:
        print("  unmodified entity must pass first")
    for name, md in mutants(doc):
        with contextlib.redirect_stdout(io.StringIO()):
            r = Report()
            run_doc_checks(r, md, vanilla_dir)
        caught = [c[1] for c in r.failed]
        print("  mutant %-52s %s" % (name, ("caught by: " + caught[0]) if caught else "NOT DETECTED"))
        if not caught:
            missed += 1
    print("selftest: %s" % ("PASS - every mutant was detected" if not missed else "FAIL - %d problem(s)" % missed))
    return 0 if not missed else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entity", default=DEFAULT_ENTITY)
    ap.add_argument("--vanilla", default=DEFAULT_VANILLA)
    ap.add_argument("--table", action="store_true", help="print the component -> vanilla file:line proof table")
    ap.add_argument("--rewrite", action="store_true", help="re-emit the entity file in canonical layout and exit")
    ap.add_argument("--selftest", action="store_true", help="mutate the entity 23 ways; every mutant must be caught")
    args = ap.parse_args()

    if args.rewrite:
        with open(args.entity, "r", encoding="utf-8") as f:
            doc = strict_loads(f.read())
        with open(args.entity, "w", encoding="utf-8", newline="\n") as f:
            f.write(canonical_text(doc))
        print("rewrote", args.entity)
        return 0
    if args.selftest:
        return selftest(args.vanilla, args.entity)

    rep = Report()
    print("sim_entity.py: %s" % args.entity)
    doc = check_format(rep, args.entity)
    if doc is None:
        print("\nRESULT: FAIL (file is not strict JSON)")
        return 1
    run_doc_checks(rep, doc, args.vanilla, args.table)

    total, failed = len(rep.checks), rep.failed
    print("\n%d checks, %d passed, %d failed" % (total, total - len(failed), len(failed)))
    for _ok, name, detail in failed:
        print("  FAILED: %s %s" % (name, detail))
    print("RESULT: %s" % ("PASS" if not failed else "FAIL"))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
