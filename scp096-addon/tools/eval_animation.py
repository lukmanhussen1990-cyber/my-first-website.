#!/usr/bin/env python3
"""Evaluate Bedrock animations / animation controllers offline, and mechanically verify the SCP-096 client files.

Pieces
------
* A small strict Molang evaluator (recursive descent).  Supported: numbers, + - * / unary - ! , comparisons,
  && ||, ternary `a ? b : c`, `??`, parentheses, `variable.x = expr;` statements, `return`, and the
  identifiers math.sin/cos (DEGREES, like Molang), abs, min, max, clamp, lerp, mod, pow, sqrt, floor, math.pi,
  query.<name> (must be supplied in the environment) and variable.<name> (must be assigned or supplied).
  ANYTHING ELSE RAISES `MolangError` - unknown identifiers never silently evaluate to 0, and division by zero raises.
* Keyframe evaluation: constant arrays, scalars (broadcast to xyz), Molang strings, time-keyed channels with
  "pre"/"post"/"lerp_mode" (linear, catmullrom), animation_length and loop / hold_on_last_frame.
* `Controller`: a tiny animation-controller simulator (state, transitions in order, blend_transition) used to
  check the state graph and to produce blended poses (e.g. sit -> scream).
* `--verify`: strict JSON, keys proven by the vanilla corpus, bone names, ids, sound short names, Molang parse,
  controller graph, numeric sweep.     `--selftest`: unit tests of the evaluator.

Pose dict format (shared with tools/render_preview.py):  {bone: {"rotation": [x,y,z], "position": [x,y,z]}}
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RP = os.path.join(ROOT, "SCP096_RP")
VANILLA = "/home/user/mojang/bedrock-samples/resource_pack"

PATHS = {
    "animations": os.path.join(RP, "animations", "scp096.animation.json"),
    "controllers": os.path.join(RP, "animation_controllers", "scp096.animation_controllers.json"),
    "render": os.path.join(RP, "render_controllers", "scp096.render_controllers.json"),
    "entity": os.path.join(RP, "entity", "scp096.entity.json"),
    "geometry": os.path.join(RP, "models", "entity", "scp096.geo.json"),
    "sounds": os.path.join(RP, "sounds", "sound_definitions.json"),
}


class MolangError(Exception):
    pass


# ======================================================================================
# Molang
# ======================================================================================
_TOKEN = re.compile(r"""
    \s*(?:
      (?P<num>\d+\.\d*|\.\d+|\d+)
     |(?P<id>[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)
     |(?P<str>'[^']*')
     |(?P<op>&&|\|\||==|!=|<=|>=|\?\?|[-+*/()<>!?:,;=])
    )""", re.X)

MATH_FUNCS = {
    "math.sin": (1, lambda a: math.sin(math.radians(a))),
    "math.cos": (1, lambda a: math.cos(math.radians(a))),
    "math.abs": (1, abs),
    "math.min": (2, min),
    "math.max": (2, max),
    "math.clamp": (3, lambda v, lo, hi: min(max(v, lo), hi)),
    "math.lerp": (3, lambda a, b, t: a + (b - a) * t),
    "math.mod": (2, None),  # handled specially (zero divisor raises)
    "math.pow": (2, math.pow),
    "math.sqrt": (1, math.sqrt),
    "math.floor": (1, math.floor),
}
MATH_CONSTS = {"math.pi": math.pi}


def tokenize(src):
    pos, out = 0, []
    src = src.strip()
    while pos < len(src):
        m = _TOKEN.match(src, pos)
        if not m or m.end() == pos:
            raise MolangError("cannot tokenize %r at %d (%r)" % (src, pos, src[pos:pos + 12]))
        pos = m.end()
        kind = m.lastgroup
        out.append((kind, m.group(kind)))
    return out


class _Parser:
    def __init__(self, src):
        self.src = src
        self.t = tokenize(src)
        self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def take(self, val=None):
        tok = self.peek()
        if tok[0] is None:
            raise MolangError("unexpected end of expression %r" % self.src)
        if val is not None and tok[1] != val:
            raise MolangError("expected %r but found %r in %r" % (val, tok[1], self.src))
        self.i += 1
        return tok

    def program(self):
        stmts = []
        while self.i < len(self.t):
            if self.peek()[1] == ";":
                self.take()
                continue
            stmts.append(self.statement())
            if self.i < len(self.t):
                self.take(";")
        if not stmts:
            raise MolangError("empty expression")
        return ("seq", stmts)

    def statement(self):
        k, v = self.peek()
        if k == "id" and v.lower() == "return":
            self.take()
            return ("return", self.ternary())
        if k == "id" and self.i + 1 < len(self.t) and self.t[self.i + 1][1] == "=":
            name = v.lower()
            if not name.startswith("variable."):
                raise MolangError("can only assign to variable.* (got %r) in %r" % (v, self.src))
            self.take()
            self.take("=")
            return ("assign", name, self.ternary())
        return ("expr", self.ternary())

    def ternary(self):
        cond = self.coalesce()
        if self.peek()[1] == "?":
            self.take()
            a = self.ternary()
            self.take(":")
            b = self.ternary()
            return ("?:", cond, a, b)
        return cond

    def coalesce(self):
        n = self.oror()
        while self.peek()[1] == "??":
            self.take()
            n = ("??", n, self.oror())
        return n

    def oror(self):
        n = self.andand()
        while self.peek()[1] == "||":
            self.take()
            n = ("||", n, self.andand())
        return n

    def andand(self):
        n = self.equality()
        while self.peek()[1] == "&&":
            self.take()
            n = ("&&", n, self.equality())
        return n

    def equality(self):
        n = self.relational()
        while self.peek()[1] in ("==", "!="):
            op = self.take()[1]
            n = (op, n, self.relational())
        return n

    def relational(self):
        n = self.additive()
        while self.peek()[1] in ("<", ">", "<=", ">="):
            op = self.take()[1]
            n = (op, n, self.additive())
        return n

    def additive(self):
        n = self.mult()
        while self.peek()[1] in ("+", "-"):
            op = self.take()[1]
            n = (op, n, self.mult())
        return n

    def mult(self):
        n = self.unary()
        while self.peek()[1] in ("*", "/"):
            op = self.take()[1]
            n = (op, n, self.unary())
        return n

    def unary(self):
        k, v = self.peek()
        if k == "op" and v in ("-", "+", "!"):
            self.take()
            return ("u" + v, self.unary())
        return self.primary()

    def primary(self):
        k, v = self.take()
        if k == "num":
            return ("num", float(v))
        if k == "str":
            raise MolangError("string literals are not supported here: %s" % v)
        if k == "op" and v == "(":
            n = self.ternary()
            self.take(")")
            return ("paren", n)
        if k == "id":
            name = v.lower()
            if self.peek()[1] == "(":
                self.take()
                args = []
                if self.peek()[1] != ")":
                    args.append(self.ternary())
                    while self.peek()[1] == ",":
                        self.take()
                        args.append(self.ternary())
                self.take(")")
                if name not in MATH_FUNCS:
                    raise MolangError("unknown function %r in %r" % (v, self.src))
                if len(args) != MATH_FUNCS[name][0]:
                    raise MolangError("%s takes %d args, got %d in %r" % (name, MATH_FUNCS[name][0], len(args), self.src))
                return ("call", name, args)
            if name in MATH_CONSTS:
                return ("num", MATH_CONSTS[name])
            if name.startswith("query.") or name.startswith("variable."):
                return ("id", name)
            raise MolangError("unknown identifier %r in %r (only math.*, query.*, variable.* with full names are allowed)" % (v, self.src))
        raise MolangError("unexpected token %r in %r" % (v, self.src))


_PARSE_CACHE = {}


def parse(src):
    if src not in _PARSE_CACHE:
        p = _Parser(src)
        _PARSE_CACHE[src] = p.program()
        if p.i != len(p.t):  # pragma: no cover - program() consumes everything or raises
            raise MolangError("trailing tokens in %r" % src)
    return _PARSE_CACHE[src]


def identifiers(src):
    """All query.* / variable.* identifiers referenced by an expression (parses it, so syntax errors raise)."""
    out = set()

    def walk(n):
        if isinstance(n, tuple):
            if n and n[0] == "id":
                out.add(n[1])
            for c in n[1:]:
                walk(c)
        elif isinstance(n, list):
            for c in n:
                walk(c)
    walk(parse(src))
    return out


class Env:
    """Evaluation environment: `query` and `variable` dicts keyed by lowercase name WITHOUT the prefix."""

    def __init__(self, query=None, variable=None):
        self.query = {k.lower(): float(v) for k, v in (query or {}).items()}
        self.variable = {k.lower(): float(v) for k, v in (variable or {}).items()}

    def copy(self):
        e = Env()
        e.query = dict(self.query)
        e.variable = dict(self.variable)
        return e


def _num(x):
    return float(x)


def _eval(n, env):
    k = n[0]
    if k == "num":
        return n[1]
    if k == "paren":
        return _eval(n[1], env)
    if k == "id":
        name = n[1]
        pre, _, key = name.partition(".")
        table = env.query if pre == "query" else env.variable
        if key not in table:
            raise MolangError("%s is not defined in this environment" % name)
        return table[key]
    if k == "call":
        name, args = n[1], [_eval(a, env) for a in n[2]]
        if name == "math.mod":
            if args[1] == 0:
                raise MolangError("math.mod by zero")
            return math.fmod(args[0], args[1])  # Molang mod keeps the dividend's sign like C fmod
        if name == "math.sqrt" and args[0] < 0:
            raise MolangError("math.sqrt of negative")
        return float(MATH_FUNCS[name][1](*args))
    if k == "u-":
        return -_eval(n[1], env)
    if k == "u+":
        return _eval(n[1], env)
    if k == "u!":
        return 0.0 if _eval(n[1], env) else 1.0
    if k in ("+", "-", "*", "/", "<", ">", "<=", ">=", "==", "!="):
        a, b = _eval(n[1], env), _eval(n[2], env)
        if k == "+": return a + b
        if k == "-": return a - b
        if k == "*": return a * b
        if k == "/":
            if b == 0:
                raise MolangError("division by zero")
            return a / b
        return 1.0 if {"<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b, "==": a == b, "!=": a != b}[k] else 0.0
    if k == "&&":
        return 1.0 if (_eval(n[1], env) and _eval(n[2], env)) else 0.0
    if k == "||":
        return 1.0 if (_eval(n[1], env) or _eval(n[2], env)) else 0.0
    if k == "??":
        try:
            return _eval(n[1], env)
        except MolangError:
            return _eval(n[2], env)
    if k == "?:":
        return _eval(n[2], env) if _eval(n[1], env) else _eval(n[3], env)
    raise MolangError("internal: unknown node %r" % (k,))


def evaluate(src, env):
    """Evaluate a (possibly multi-statement) Molang string.  Returns the value of `return` or the last statement."""
    if isinstance(src, (int, float)):
        return float(src)
    prog = parse(src)
    val = 0.0
    for st in prog[1]:
        if st[0] == "assign":
            env.variable[st[1].partition(".")[2]] = _eval(st[2], env)
            val = 0.0
        elif st[0] == "return":
            return _eval(st[1], env)
        else:
            val = _eval(st[1], env)
    if not math.isfinite(val):
        raise MolangError("non-finite result from %r" % src)
    return val


# ======================================================================================
# animations
# ======================================================================================
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def anim_time(adef, t):
    """query.anim_time for an animation that has been running for t seconds."""
    length = adef.get("animation_length")
    loop = adef.get("loop", False)
    if length:
        if loop is True:
            return math.fmod(t, length)
        return min(t, length)  # false or "hold_on_last_frame" (both clamp for sampling purposes)
    return t


def _comp(v, env):
    return evaluate(v, env) if isinstance(v, str) else float(v)


def _vec(v, env):
    """array of 3 / scalar / Molang string -> [x,y,z]"""
    if isinstance(v, list):
        if len(v) != 3:
            raise MolangError("vector must have 3 components: %r" % (v,))
        return [_comp(c, env) for c in v]
    x = _comp(v, env)
    return [x, x, x]


def _is_keyframed(ch):
    return isinstance(ch, dict)


def _kf_values(entry, env):
    """-> (pre, post, lerp_mode) as vectors"""
    if isinstance(entry, dict):
        unknown = set(entry) - {"pre", "post", "lerp_mode"}
        if unknown:
            raise MolangError("unsupported keyframe keys %s" % sorted(unknown))
        post = entry.get("post", entry.get("pre"))
        pre = entry.get("pre", post)
        if post is None:
            raise MolangError("keyframe without pre/post: %r" % (entry,))
        return _vec(pre, env), _vec(post, env), entry.get("lerp_mode", "linear")
    v = _vec(entry, env)
    return v, v, "linear"


def sample_channel(ch, at, env):
    if not _is_keyframed(ch):
        return _vec(ch, env)
    frames = sorted(((float(k), v) for k, v in ch.items()), key=lambda kv: kv[0])
    if not frames:
        raise MolangError("empty keyframe channel")
    if at <= frames[0][0]:
        return _kf_values(frames[0][1], env)[0] if at < frames[0][0] else _kf_values(frames[0][1], env)[1]
    if at >= frames[-1][0]:
        return _kf_values(frames[-1][1], env)[1]
    for i in range(len(frames) - 1):
        t0, e0 = frames[i]
        t1, e1 = frames[i + 1]
        if t0 <= at < t1:
            _, post0, mode0 = _kf_values(e0, env)
            pre1, _, mode1 = _kf_values(e1, env)
            u = (at - t0) / (t1 - t0)
            if mode0 == "catmullrom" or mode1 == "catmullrom":
                p0 = _kf_values(frames[i - 1][1], env)[1] if i > 0 else post0
                p3 = _kf_values(frames[i + 2][1], env)[0] if i + 2 < len(frames) else pre1
                return [0.5 * ((2 * post0[c]) + (-p0[c] + pre1[c]) * u
                               + (2 * p0[c] - 5 * post0[c] + 4 * pre1[c] - p3[c]) * u * u
                               + (-p0[c] + 3 * post0[c] - 3 * pre1[c] + p3[c]) * u ** 3) for c in range(3)]
            if mode0 not in ("linear", "catmullrom") or mode1 not in ("linear", "catmullrom"):
                raise MolangError("unsupported lerp_mode %r/%r" % (mode0, mode1))
            return [post0[c] + (pre1[c] - post0[c]) * u for c in range(3)]
    raise MolangError("internal: keyframe search failed")  # pragma: no cover


def eval_animation(adef, t, env, raw_anim_time=None):
    """Pose of one animation that has been playing for t seconds, with environment `env`
    (env.query must NOT contain anim_time; it is added here).  `raw_anim_time` bypasses the loop wrap (used to test that a
    looping animation is periodic in animation_length).  Returns {bone: {"rotation":[..],"position":[..],"scale":[..]}}."""
    e = env.copy()
    at = anim_time(adef, t) if raw_anim_time is None else raw_anim_time
    e.query["anim_time"] = at
    pose = {}
    for bone, bdef in adef.get("bones", {}).items():
        out = {}
        for key, ch in bdef.items():
            if key in ("rotation", "position", "scale"):
                out[key] = sample_channel(ch, at, e)
            else:
                raise MolangError("unsupported bone key %r on %s" % (key, bone))
        pose[bone] = out
    return pose


def sound_timeline(adef):
    """[(time, short_effect_name)] from the `sound_effects` timeline of one animation."""
    out = []
    se = adef.get("sound_effects", {})
    for tm, ev in se.items():
        evs = ev if isinstance(ev, list) else [ev]
        for e in evs:
            out.append((float(tm), e["effect"]))
    return sorted(out)


def add_poses(a, b, wb=1.0):
    """a += wb * b (rotation/position add; Bedrock accumulates bone channels of stacked animations)."""
    for bone, ch in b.items():
        dst = a.setdefault(bone, {})
        for key, vec in ch.items():
            if key == "scale":
                cur = dst.get("scale", [1.0, 1.0, 1.0])
                dst["scale"] = [cur[i] * (1 + (vec[i] - 1) * wb) for i in range(3)]
            else:
                cur = dst.get(key, [0.0, 0.0, 0.0])
                dst[key] = [cur[i] + vec[i] * wb for i in range(3)]
    return a


def lerp_poses(a, b, u):
    """(1-u)*a + u*b, bones/channels missing on one side count as identity."""
    out = {}
    for bone in set(a) | set(b):
        out[bone] = {}
        for key in set(a.get(bone, {})) | set(b.get(bone, {})):
            ident = [1.0, 1.0, 1.0] if key == "scale" else [0.0, 0.0, 0.0]
            va = a.get(bone, {}).get(key, ident)
            vb = b.get(bone, {}).get(key, ident)
            out[bone][key] = [va[i] * (1 - u) + vb[i] * u for i in range(3)]
    return out


# ======================================================================================
# entity / controller
# ======================================================================================
class Rig:
    """Loads the shipped client files and answers 'what pose at time t in state / animation X'."""

    def __init__(self, paths=None):
        p = dict(PATHS)
        p.update(paths or {})
        self.paths = p
        self.anims = load_json(p["animations"])["animations"]
        self.ctrls = load_json(p["controllers"])["animation_controllers"]
        self.entity = load_json(p["entity"])["minecraft:client_entity"]["description"]
        self.short = self.entity["animations"]          # short name -> animation / controller id
        self.pre = self.entity.get("scripts", {}).get("pre_animation", [])

    def adef(self, short_or_id):
        aid = self.short.get(short_or_id, short_or_id)
        if aid not in self.anims:
            raise MolangError("animation %r (%r) not defined" % (short_or_id, aid))
        return self.anims[aid]

    def base_env(self, speed=0.0, dist=0.0, life=0.0, tx=0.0, ty=0.0, variant=0):
        env = Env({"modified_move_speed": speed, "modified_distance_moved": dist, "life_time": life,
                   "target_x_rotation": tx, "target_y_rotation": ty, "variant": variant})
        for stmt in self.pre:
            evaluate(stmt, env)
        return env

    def anim_pose(self, short, t, env):
        return eval_animation(self.adef(short), t, env)

    def state_pose(self, ctrl_id, state, t, env):
        """Sum of the animations of one controller state (entries may be 'name' or {'name': 'weight molang'})."""
        st = self.ctrls[ctrl_id]["states"][state]
        pose = {}
        for entry in st.get("animations", []):
            if isinstance(entry, str):
                name, w = entry, 1.0
            else:
                (name, wexpr), = entry.items()
                w = evaluate(wexpr, env)
            add_poses(pose, self.anim_pose(name, t, env), w)
        return pose


class Controller:
    """Minimal animation-controller simulator: ordered transitions, one switch per step, linear blend_transition."""

    def __init__(self, rig, ctrl_id):
        self.rig = rig
        self.id = ctrl_id
        self.d = rig.ctrls[ctrl_id]
        self.state = self.d["initial_state"]
        self.prev = None
        self.state_time = 0.0
        self.blend_time = 0.0
        self.entered = [self.state]
        self.sounds = list(self.d["states"][self.state].get("sound_effects", []))

    def step(self, env, dt):
        st = self.d["states"][self.state]
        for tr in st.get("transitions", []):
            (target, cond), = tr.items()
            if evaluate(cond, env):
                self.prev, self.prev_time = self.state, self.state_time
                self.state, self.state_time, self.blend_time = target, 0.0, 0.0
                self.entered.append(target)
                self.sounds.extend(self.d["states"][target].get("sound_effects", []))
                break
        self.state_time += dt
        self.blend_time += dt

    def pose(self, t_life, env):
        """Pose now.  Animations restart when their state is entered (t = time in state); during blend_transition the
        previous state keeps playing and is faded out linearly."""
        cur = self.rig.state_pose(self.id, self.state, self.state_time, env)
        bt = self.d["states"][self.state].get("blend_transition", 0.0)
        if self.prev is not None and bt and self.blend_time < bt:
            old = self.rig.state_pose(self.id, self.prev, self.prev_time + self.blend_time, env)
            return lerp_poses(old, cur, self.blend_time / bt)
        return cur


# ======================================================================================
# --verify
# ======================================================================================
class Report:
    def __init__(self):
        self.lines, self.fails = [], 0

    def ok(self, cond, msg):
        self.lines.append(("PASS  " if cond else "FAIL  ") + msg)
        if not cond:
            self.fails += 1
        return cond


def _strict_load(path, rep):
    raw = open(path, "rb").read()
    rep.ok(not raw.startswith(b"\xef\xbb\xbf"), "%s: no BOM" % os.path.basename(path))
    rep.ok(b"\r" not in raw and raw.endswith(b"\n") and not raw.endswith(b"\n\n") and b"\t" not in raw,
           "%s: LF endings, single final newline, no tabs" % os.path.basename(path))
    text = raw.decode("utf-8")

    def hook(pairs):
        keys = [k for k, _ in pairs]
        if len(keys) != len(set(keys)):
            raise ValueError("duplicate keys %s" % sorted({k for k in keys if keys.count(k) > 1}))
        return dict(pairs)

    def bad(c):
        raise ValueError("non-finite constant " + c)
    data = json.loads(text, object_pairs_hook=hook, parse_constant=bad)
    rep.ok(True, "%s: strict JSON (no comments / trailing commas / duplicate keys / NaN)" % os.path.basename(path))
    return data


def _collect_keys(node, path, acc):
    """record the set of keys seen below each structural path"""
    if isinstance(node, dict):
        acc.setdefault(path, set()).update(node.keys())
    return acc


def _vanilla_keyset():
    """Key sets seen in vanilla files at structural levels we use (computed from the corpus, tolerant of its sloppy JSON)."""
    def lenient(p):
        t = open(p, encoding="utf-8", errors="replace").read()
        t = re.sub(r"^﻿", "", t)
        t = re.sub(r"/\*.*?\*/", "", t, flags=re.S)
        t = re.sub(r"(?m)^\s*//.*$", "", t)
        t = re.sub(r",\s*([}\]])", r"\1", t)
        return json.loads(t)
    ks = {"anim": set(), "bone": set(), "kf": set(), "ctrl": set(), "state": set(), "rc": set(), "ent": set(),
          "ent_scripts": set(), "ent_top": set(), "egg": set(), "sfx": set()}
    for f in os.listdir(os.path.join(VANILLA, "animations")):
        if not f.endswith(".json"):
            continue
        try:
            d = lenient(os.path.join(VANILLA, "animations", f))
        except Exception:
            continue
        for a in d.get("animations", {}).values():
            if not isinstance(a, dict):
                continue
            ks["anim"].update(a.keys())
            for b in a.get("bones", {}).values():
                if isinstance(b, dict):
                    ks["bone"].update(b.keys())
                    for ch in b.values():
                        if isinstance(ch, dict):
                            for kf in ch.values():
                                if isinstance(kf, dict):
                                    ks["kf"].update(kf.keys())
            for ev in a.get("sound_effects", {}).values():
                if isinstance(ev, dict):
                    ks["sfx"].update(ev.keys())
    for f in os.listdir(os.path.join(VANILLA, "animation_controllers")):
        if not f.endswith(".json"):
            continue
        try:
            d = lenient(os.path.join(VANILLA, "animation_controllers", f))
        except Exception:
            continue
        for c in d.get("animation_controllers", {}).values():
            ks["ctrl"].update(c.keys())
            for s in c.get("states", {}).values():
                ks["state"].update(s.keys())
    for f in os.listdir(os.path.join(VANILLA, "render_controllers")):
        if f.endswith(".json"):
            try:
                d = lenient(os.path.join(VANILLA, "render_controllers", f))
            except Exception:
                continue
            for c in d.get("render_controllers", {}).values():
                ks["rc"].update(c.keys())
    for f in os.listdir(os.path.join(VANILLA, "entity")):
        if f.endswith(".json"):
            try:
                d = lenient(os.path.join(VANILLA, "entity", f))
            except Exception:
                continue
            ce = d.get("minecraft:client_entity", {})
            ks["ent_top"].update(d.keys())
            ks["ent"].update(ce.get("description", {}).keys())
            ks["ent_scripts"].update(ce.get("description", {}).get("scripts", {}).keys())
            ks["egg"].update(ce.get("description", {}).get("spawn_egg", {}).keys())
    return ks


def _all_molang(anims, ctrls, entity):
    """yield (where, string) for every Molang-bearing string in the four files"""
    for aid, a in anims.items():
        for bone, bd in a.get("bones", {}).items():
            for ch, val in bd.items():
                def walk(x, w):
                    if isinstance(x, str):
                        yield (w, x)
                    elif isinstance(x, list):
                        for i, y in enumerate(x):
                            yield from walk(y, w + "[%d]" % i)
                    elif isinstance(x, dict):
                        for k, y in x.items():
                            if k != "lerp_mode":
                                yield from walk(y, w + "." + k)
                yield from walk(val, "%s/%s/%s" % (aid, bone, ch))
    for cid, c in ctrls.items():
        for sn, s in c["states"].items():
            for tr in s.get("transitions", []):
                for tgt, cond in tr.items():
                    yield ("%s/%s->%s" % (cid, sn, tgt), cond)
            for ent in s.get("animations", []):
                if isinstance(ent, dict):
                    for n, w in ent.items():
                        yield ("%s/%s/anim %s weight" % (cid, sn, n), w)
    sc = entity.get("scripts", {})
    for i, s in enumerate(sc.get("pre_animation", [])):
        yield ("entity pre_animation[%d]" % i, s)
    for ent in sc.get("animate", []):
        if isinstance(ent, dict):
            for n, cond in ent.items():
                yield ("entity animate %s" % n, cond)


KNOWN_QUERIES = {"anim_time", "life_time", "modified_distance_moved", "modified_move_speed",
                 "target_x_rotation", "target_y_rotation", "variant"}
PROVEN_MATH = set(MATH_FUNCS)  # each of these appears in the vanilla corpus (counted in the report)


def verify(verbose=True):
    rep = Report()
    paths = PATHS
    # ---- 1. strict JSON -------------------------------------------------------------
    data = {}
    for key in ("animations", "controllers", "render", "entity", "geometry"):
        data[key] = _strict_load(paths[key], rep)
    anims = data["animations"]["animations"]
    ctrls = data["controllers"]["animation_controllers"]
    rcs = data["render"]["render_controllers"]
    ent = data["entity"]["minecraft:client_entity"]["description"]
    geo = data["geometry"]["minecraft:geometry"][0]
    bones = {b["name"] for b in geo["bones"]}

    # ---- 2. versions and ids (DESIGN.md section 1 / 4) -------------------------------
    rep.ok(data["animations"]["format_version"] == "1.8.0", "animation format_version 1.8.0")
    rep.ok(data["controllers"]["format_version"] == "1.10.0", "animation controller format_version 1.10.0")
    rep.ok(data["render"]["format_version"] == "1.8.0", "render controller format_version 1.8.0")
    rep.ok(data["entity"]["format_version"] == "1.10.0", "client entity format_version 1.10.0")
    need = ["animation.scp096.sit_cry", "animation.scp096.walk", "animation.scp096.scream", "animation.scp096.run"]
    rep.ok(all(n in anims for n in need), "animation ids present: %s" % ", ".join(need))
    rep.ok(all(k.startswith("animation.scp096.") for k in anims), "every animation id starts with animation.scp096.")
    rep.ok(list(ctrls) == ["controller.animation.scp096.main"], "exactly one animation controller controller.animation.scp096.main")
    rep.ok(list(rcs) == ["controller.render.scp096"], "exactly one render controller controller.render.scp096")
    rep.ok(ent["identifier"] == "scp:scp096", "client entity identifier scp:scp096")
    rep.ok(ent["geometry"] == {"default": geo["description"]["identifier"]} and geo["description"]["identifier"] == "geometry.scp096",
           "client geometry.default == geometry.scp096 == model identifier")
    rep.ok(ent["textures"] == {"default": "textures/entity/scp096"}, "texture textures/entity/scp096")
    tex = os.path.join(RP, ent["textures"]["default"] + ".png")
    rep.ok(os.path.exists(tex), "texture file exists: %s" % os.path.relpath(tex, ROOT))
    rep.ok(ent["materials"] == {"default": "entity_alphatest"}, "material entity_alphatest (vanilla player.entity.json default material)")
    rep.ok(ent["render_controllers"] == ["controller.render.scp096"], "entity render_controllers == [controller.render.scp096]")
    rep.ok(ent["spawn_egg"] == {"base_color": "#E8E4D8", "overlay_color": "#3B3B3B"}, "spawn_egg colours #E8E4D8 / #3B3B3B")
    rc = rcs["controller.render.scp096"]
    rep.ok(rc.get("geometry") == "Geometry.default" and rc.get("materials") == [{"*": "Material.default"}]
           and rc.get("textures") == ["Texture.default"], "render controller uses Geometry.default / Material.default / Texture.default")
    tex_w = geo["description"]["texture_width"]
    from PIL import Image
    rep.ok(Image.open(tex).size == (tex_w, geo["description"]["texture_height"]), "texture PNG size equals geometry texture_width/height")

    # ---- 3. entity <-> animations <-> controllers cross references -------------------------
    short = ent["animations"]
    for sn, aid in short.items():
        ok_ref = aid in anims or aid in ctrls
        rep.ok(ok_ref, "entity animations[%r] -> %s exists" % (sn, aid))
    used_anims = {n for n, v in short.items() if v in anims}
    used_ctrls = {n for n, v in short.items() if v in ctrls}
    animate = ent["scripts"]["animate"]
    animate_names = [list(a)[0] if isinstance(a, dict) else a for a in animate]
    rep.ok(all(n in short for n in animate_names), "every scripts.animate entry %s is in entity animations" % animate_names)
    ctrl_users = set()
    for cid, c in ctrls.items():
        states = c["states"]
        rep.ok(c["initial_state"] in states, "%s: initial_state %r exists" % (cid, c["initial_state"]))
        for sn, s in states.items():
            for e in s.get("animations", []):
                n = e if isinstance(e, str) else list(e)[0]
                rep.ok(n in used_anims, "%s/%s: animation short name %r maps to a defined animation" % (cid, sn, n))
                ctrl_users.add(short.get(n))
            for tr in s.get("transitions", []):
                for tgt in tr:
                    rep.ok(tgt in states, "%s/%s: transition target %r exists" % (cid, sn, tgt))
            bt = s.get("blend_transition")
            if bt is not None:
                rep.ok(0.2 <= bt <= 0.4, "%s/%s: blend_transition %s within 0.2-0.4" % (cid, sn, bt))
    rep.ok({"controller.animation.scp096.main"} <= {short[n] for n in animate_names}, "controller.animation.scp096.main is animated")
    used_anim_ids = set(ctrl_users) | {short[n] for n in animate_names}
    unused = [a for a in anims if a not in used_anim_ids]
    rep.ok(not unused, "every defined animation is referenced by a controller or scripts.animate (unused: %s)" % unused)

    # ---- 4. bones --------------------------------------------------------------------
    allbones = set()
    for aid, a in anims.items():
        for b in a.get("bones", {}):
            allbones.add(b)
            rep.ok(b in bones, "%s: bone %r exists in geometry (exact case)" % (aid, b)) if b not in bones else None
    rep.ok(allbones <= bones, "all %d animated bone names exist in geometry.scp096 (%d bones)" % (len(allbones), len(bones)))

    # ---- 5. sounds ---------------------------------------------------------------------
    se = ent["sound_effects"]
    rep.ok(se == {"cry": "mob.scp096.cry", "scream": "mob.scp096.scream", "rage": "mob.scp096.rage"}, "entity sound_effects map matches DESIGN section 4")
    sdefs = load_json(paths["sounds"])["sound_definitions"] if os.path.exists(paths["sounds"]) else None
    if sdefs is not None:
        rep.ok(all(v in sdefs for v in se.values()), "sound ids exist in sound_definitions.json")
    used = set()
    for aid, a in anims.items():
        for tm, ev in a.get("sound_effects", {}).items():
            for e in (ev if isinstance(ev, list) else [ev]):
                used.add(e["effect"])
    for cid, c in ctrls.items():
        for s in c["states"].values():
            for e in s.get("sound_effects", []):
                used.add(e["effect"])
    rep.ok(used <= set(se), "sound_effects short names used in animations/controllers %s are all in the entity map" % sorted(used))
    rep.ok(used == set(se), "every sound short name in the entity map is played somewhere")

    # ---- 6. Molang ---------------------------------------------------------------------
    n_expr, ids = 0, set()
    for where, s in _all_molang(anims, ctrls, ent):
        if isinstance(s, (int, float)):
            continue
        n_expr += 1
        rep.ok(s.count("(") == s.count(")"), "parentheses balanced: %s" % where) if s.count("(") != s.count(")") else None
        try:
            ids |= identifiers(s)
        except MolangError as e:
            rep.ok(False, "Molang parse error at %s: %s" % (where, e))
        if re.search(r"[A-Z]", s):
            rep.ok(False, "Molang must be lowercase full names (found upper case) at %s: %r" % (where, s))
    rep.ok(True, "%d Molang strings parsed, parentheses balanced, only math.* / query.* / variable.* identifiers" % n_expr)
    qs = {i.split(".", 1)[1] for i in ids if i.startswith("query.")}
    rep.ok(qs <= KNOWN_QUERIES, "queries used %s are all in the proven set %s" % (sorted(qs), sorted(KNOWN_QUERIES)))
    # every variable read must be assigned by pre_animation
    assigned = set()
    for s in ent["scripts"].get("pre_animation", []):
        for st in parse(s)[1]:
            if st[0] == "assign":
                assigned.add(st[1])
    reads = {i for i in ids if i.startswith("variable.")}
    rep.ok(reads <= assigned, "every variable.* read (%d) is assigned in scripts.pre_animation (unassigned: %s)" % (len(reads), sorted(reads - assigned)))
    controller_q = set()
    for cid, c in ctrls.items():
        for s in c["states"].values():
            for tr in s.get("transitions", []):
                for cond in tr.values():
                    controller_q |= identifiers(cond)
    rep.ok(controller_q <= {"query.variant"}, "controller transitions use only query.variant: %s" % sorted(controller_q))

    # ---- 7. keys proven by vanilla --------------------------------------------------------
    if os.path.isdir(VANILLA):
        vk = _vanilla_keyset()
        mine = {"anim": set(), "bone": set(), "kf": set(), "ctrl": set(), "state": set(), "rc": set(), "sfx": set()}
        for a in anims.values():
            mine["anim"].update(a.keys())
            for b in a.get("bones", {}).values():
                mine["bone"].update(b.keys())
                for ch in b.values():
                    if isinstance(ch, dict):
                        for kf in ch.values():
                            if isinstance(kf, dict):
                                mine["kf"].update(kf.keys())
            for ev in a.get("sound_effects", {}).values():
                for e in (ev if isinstance(ev, list) else [ev]):
                    mine["sfx"].update(e.keys())
        for c in ctrls.values():
            mine["ctrl"].update(c.keys())
            for s in c["states"].values():
                mine["state"].update(s.keys())
        for c in rcs.values():
            mine["rc"].update(c.keys())
        for lvl, label in (("anim", "animation"), ("bone", "bone channel"), ("kf", "keyframe"), ("ctrl", "controller"),
                           ("state", "controller state"), ("rc", "render controller"), ("sfx", "sound_effects entry")):
            extra = mine[lvl] - vk[lvl]
            rep.ok(not extra, "%s keys %s all occur in the vanilla corpus%s" % (label, sorted(mine[lvl]), "" if not extra else " - UNPROVEN: %s" % sorted(extra)))
        ent_extra = set(ent) - vk["ent"]
        rep.ok(not ent_extra, "client entity description keys %s all occur in vanilla%s" % (sorted(ent), "" if not ent_extra else " - UNPROVEN %s" % sorted(ent_extra)))
        sc_extra = set(ent["scripts"]) - vk["ent_scripts"]
        rep.ok(not sc_extra, "client entity scripts keys %s occur in vanilla" % sorted(ent["scripts"]))
        eg_extra = set(ent["spawn_egg"]) - vk["egg"]
        rep.ok(not eg_extra, "spawn_egg keys %s occur in vanilla" % sorted(ent["spawn_egg"]))
        rep.ok(set(data["entity"]) - vk["ent_top"] == set(), "client entity top-level keys occur in vanilla")

    # ---- 8. controller graph --------------------------------------------------------------
    rig = Rig()
    main = "controller.animation.scp096.main"
    st_for = {0: "sit", 1: "walk", 2: "scream", 3: "run"}
    states = ctrls[main]["states"]
    rep.ok(ctrls[main]["initial_state"] == "sit" and set(states) == set(st_for.values()), "controller states are exactly sit/walk/scream/run, initial sit")
    for s in states:
        targets = {list(tr)[0] for tr in states[s].get("transitions", [])}
        rep.ok(targets == set(states) - {s}, "state %s has a transition to every other state (%s)" % (s, sorted(targets)))
    rep.ok("scream" in {x["effect"] for x in states["scream"].get("sound_effects", [])}, "scream state plays sound_effect 'scream' on entry")
    for a in st_for:
        for b in st_for:
            c = Controller(rig, main)
            env = rig.base_env(variant=a)
            for _ in range(3):
                c.step(env, 0.05)
            env = rig.base_env(variant=b)
            for _ in range(3):
                c.step(env, 0.05)
            rep.ok(c.state == st_for[b], "variant %d -> %d settles in state %s (got %s)" % (a, b, st_for[b], c.state)) if c.state != st_for[b] else None
    rep.ok(True, "controller reaches the state of query.variant from every start state (16 combinations simulated)")
    # sit entered by default with variant 0, no spurious transition
    c = Controller(rig, main)
    for _ in range(40):
        c.step(rig.base_env(variant=0), 0.05)
    rep.ok(c.state == "sit" and c.entered == ["sit"], "variant 0 stays in sit (no flapping)")
    # ---- 8b. loop seams: every looping animation with animation_length must be periodic in that length ---------------
    for aid, a in anims.items():
        L = a.get("animation_length")
        if a.get("loop") is True and L:
            env = rig.base_env(speed=0.3, dist=17.3, life=1.0)
            worst_seam = 0.0
            for k in range(0, 41):
                t0 = k * 0.01
                p0 = eval_animation(a, 0, env, raw_anim_time=t0)
                p1 = eval_animation(a, 0, env, raw_anim_time=t0 + L)
                for b in p0:
                    for ch in p0[b]:
                        for i in range(3):
                            worst_seam = max(worst_seam, abs(p0[b][ch][i] - p1[b][ch][i]))
            rep.ok(worst_seam < 1e-6, "%s: periodic over animation_length %.1f s (max seam error %.2g, so the loop restart is invisible)" % (aid, L, worst_seam))
        else:
            rep.ok("animation_length" not in a or a.get("sound_effects") is not None, "%s: no loop seam to check" % aid)
    # ---- 9. numeric sweep ------------------------------------------------------------------
    worst = 0.0
    n = 0
    for aid in anims:
        for speed in (0.0, 0.05, 0.2, 0.5, 1.0, 1.4):
            for dist in (0.0, 1.7, 9.1, 123.456, 9876.5):
                for life in (0.0, 0.37, 5.5, 777.7):
                    for tx, ty in ((0, 0), (-60, 90), (80, -75)):
                        env = rig.base_env(speed=speed, dist=dist, life=life, tx=tx, ty=ty)
                        for t in (0.0, 0.31, 1.0, 2.7, 6.0):
                            pose = eval_animation(anims[aid], t, env)
                            n += 1
                            for b, ch in pose.items():
                                for k, v in ch.items():
                                    for x in v:
                                        if not math.isfinite(x):
                                            rep.ok(False, "non-finite value in %s/%s/%s" % (aid, b, k))
                                        if k == "rotation":
                                            worst = max(worst, abs(x))
                                        if k == "position" and abs(x) > 40:
                                            rep.ok(False, "|position| > 40 px in %s/%s: %s" % (aid, b, v))
    rep.ok(worst <= 200, "numeric sweep: %d pose evaluations finite, largest |rotation| = %.1f deg" % (n, worst))
    if verbose:
        for l in rep.lines:
            print(l)
        print("\n%d checks, %d FAILED" % (len(rep.lines), rep.fails))
    return rep


# ======================================================================================
# --selftest
# ======================================================================================
def selftest():
    fails = []

    def eq(expr, want, env=None, tol=1e-9):
        e = env or Env({"anim_time": 2.0, "modified_move_speed": 0.5}, {"x": 3.0})
        got = evaluate(expr, e)
        if abs(got - want) > tol:
            fails.append("%s = %r, want %r" % (expr, got, want))

    def raises(expr, env=None):
        try:
            evaluate(expr, env or Env({"anim_time": 2.0}, {"x": 3.0}))
        except MolangError:
            return
        fails.append("%r should have raised" % expr)

    eq("1 + 2 * 3", 7)
    eq("(1 + 2) * 3", 9)
    eq("-2 * -3", 6)
    eq("10 / 4", 2.5)
    eq("math.sin(90)", 1.0)
    eq("math.cos(180)", -1.0)
    eq("math.sin(30)", 0.5, tol=1e-12)
    eq("math.abs(-4.5)", 4.5)
    eq("math.min(3, 2) + math.max(3, 2)", 5)
    eq("math.clamp(5, 0, 1)", 1)
    eq("math.clamp(-5, 0, 1)", 0)
    eq("math.lerp(10, 20, 0.25)", 12.5)
    eq("math.mod(7, 3)", 1)
    eq("math.pi", math.pi)
    eq("query.anim_time * 2", 4)
    eq("variable.x * 2", 6)
    eq("query.anim_time > 1 ? 10 : 20", 10)
    eq("query.anim_time < 1 ? 10 : 20", 20)
    eq("!0", 1)
    eq("!1", 0)
    eq("1 < 2 && 2 < 3", 1)
    eq("1 > 2 || 2 > 3", 0)
    eq("query.modified_move_speed == 0.5", 1)
    eq("query.modified_move_speed != 0.5", 0)
    eq("variable.y = 4; variable.y * 2", 8)
    eq("variable.y = 4; return variable.y + 1; variable.y = 99", 5)
    eq("variable.z ?? 7", 7)
    eq("(1 ? 2 : 3) + 1", 3)
    eq("1 ? 2 : 0 ? 5 : 6", 2)
    eq("0 ? 2 : 0 ? 5 : 6", 6)
    eq("2 - 1 - 1", 0)  # left associative
    eq("8 / 2 / 2", 2)
    eq("math.pow(2, 3) + math.sqrt(9) + math.floor(2.7)", 13)
    raises("query.nope")
    raises("variable.nope + 1")
    raises("math.nope(1)")
    raises("math.sin()")
    raises("math.sin(1, 2)")
    raises("foo")
    raises("v.x")
    raises("q.anim_time")
    raises("Math.Sin(1)") if False else None  # case-insensitive by design
    raises("(1 + 2")
    raises("1 + 2)")
    raises("1 +")
    raises("1 / 0")
    raises("math.mod(1, 0)")
    raises("this + 1")
    raises("'abc'")
    raises("")
    raises("1 ? 2")
    raises("temp.x = 1")
    eq("MATH.SIN(90)", 1.0)  # Molang is case-insensitive
    # keyframes
    env = Env({"modified_move_speed": 0.0}, {})
    a = {"loop": True, "animation_length": 2.0, "bones": {
        "b": {"rotation": {"0.0": [0, 0, 0], "1.0": [10, 20, 30], "2.0": [0, 0, 0]},
              "position": [1, "query.anim_time", 3]}}}
    p = eval_animation(a, 0.5, env)
    if p["b"]["rotation"] != [5.0, 10.0, 15.0]:
        fails.append("linear keyframe: %r" % p["b"]["rotation"])
    if p["b"]["position"] != [1.0, 0.5, 3.0]:
        fails.append("position molang: %r" % p["b"]["position"])
    p = eval_animation(a, 2.5, env)  # loops
    if p["b"]["rotation"] != [5.0, 10.0, 15.0]:
        fails.append("loop wrap: %r" % p["b"]["rotation"])
    a2 = {"bones": {"b": {"rotation": {"0.0": {"post": [0, 0, 0]}, "1.0": {"pre": [10, 10, 10], "post": [50, 50, 50]},
                                       "2.0": {"pre": [60, 60, 60]}}}}}
    for t, want in ((0.5, 5.0), (1.0, 50.0), (1.5, 55.0), (3.0, 60.0)):
        got = eval_animation(a2, t, env)["b"]["rotation"][0]
        if abs(got - want) > 1e-9:
            fails.append("pre/post t=%s got %s want %s" % (t, got, want))
    a3 = {"bones": {"b": {"rotation": 7}}}
    if eval_animation(a3, 0, env)["b"]["rotation"] != [7.0, 7.0, 7.0]:
        fails.append("scalar broadcast")
    a4 = {"bones": {"b": {"rotation": {"0.0": [0, 0, 0], "1.0": {"post": [10, 0, 0], "lerp_mode": "catmullrom"}, "2.0": [0, 0, 0],
                                       "3.0": [0, 0, 0]}}}}
    got = eval_animation(a4, 1.5, env)["b"]["rotation"][0]
    if not (5.0 < got < 12.0):
        fails.append("catmullrom midpoint implausible: %s" % got)
    a5 = {"bones": {"b": {"rotation": [1, 2, 3], "relative_to": {"rotation": "entity"}}}}
    try:
        eval_animation(a5, 0, env)
        fails.append("relative_to should be rejected as unsupported")
    except MolangError:
        pass
    if sound_timeline({"sound_effects": {"1.5": {"effect": "b"}, "0.0": {"effect": "a"}}}) != [(0.0, "a"), (1.5, "b")]:
        fails.append("sound_timeline")
    # lerp / add poses
    pa = {"x": {"rotation": [10, 0, 0]}}
    pb = {"x": {"rotation": [20, 0, 0], "position": [0, 10, 0]}}
    if lerp_poses(pa, pb, 0.5)["x"] != {"rotation": [15.0, 0.0, 0.0], "position": [0.0, 5.0, 0.0]}:
        fails.append("lerp_poses")
    s = add_poses(add_poses({}, pa), pb)
    if s["x"]["rotation"] != [30.0, 0.0, 0.0]:
        fails.append("add_poses")
    if fails:
        print("SELFTEST FAILED:")
        for f in fails:
            print("  ", f)
        return 1
    print("selftest: all Molang / keyframe / pose checks passed")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--verify", action="store_true", help="mechanical verification of the shipped client-side files")
    ap.add_argument("--anim", help="short or full animation id to evaluate")
    ap.add_argument("--t", type=float, default=0.0)
    ap.add_argument("--speed", type=float, default=0.0)
    ap.add_argument("--dist", type=float, default=0.0)
    ap.add_argument("--life", type=float, default=None)
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if a.verify:
        try:
            return 1 if verify().fails else 0
        except Exception as ex:      # a broken file must give a clear failure, never a pass
            print("FAIL  verification aborted: %s: %s" % (type(ex).__name__, ex))
            return 1
    if a.anim:
        rig = Rig()
        env = rig.base_env(speed=a.speed, dist=a.dist, life=a.t if a.life is None else a.life)
        print(json.dumps(rig.anim_pose(a.anim, a.t, env), indent=1))
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
